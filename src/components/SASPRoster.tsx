import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  getDocs,
  Timestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { useAuth } from "../context/AuthContext";
import { RosterUser, CertStatus } from "../types/User";
import fullRosterTemplate, {
  normalizeTemplateCertKeys,
} from "../data/FullRosterData";
import {
  rankOrder,
  certificationKeys,
  divisionKeys,
  getCertStyle,
} from "../data/rosterConfig";
import { backgroundImages } from "../data/images";
import { computeIsAdmin } from "../utils/isadmin";
import { formatDateToMMDDYY } from "../utils/timeHelpers";
import { toast } from "react-toastify"; // Import toastify
import "react-toastify/dist/ReactToastify.css"; // Import toastify styles

const rankCategories: { [key: string]: string[] } = {
  "High Command": [
    "Commissioner",
    "Assistant Deputy Commissioner",
    "Deputy Commissioner",
    "Assistant Commissioner",
    "Commander",
  ],
  Command: ["Captain", "Lieutenant"],
  Supervisors: ["Staff Sergeant", "Sergeant"],
  "State Troopers": ["Corporal", "Trooper First Class", "Trooper"],
  Cadets: ["Cadet"],
};

const categoryOrder = [
  "High Command",
  "Command",
  "Supervisors",
  "State Troopers",
  "Cadets",
];

const processRosterData = (
  usersData: RosterUser[]
): {
  groupedRoster: { [category: string]: RosterUser[] };
} => {
  const categorizedUsers = usersData
    .map((user) => {
      let category = null;
      for (const cat of categoryOrder) {
        if (rankCategories[cat]?.includes(user.rank)) {
          category = cat;
          break;
        }
      }
      return { ...user, category };
    })
    .filter((user) => user.category !== null);

  categorizedUsers.sort((a, b) => {
    const rankA = rankOrder[a.rank] ?? rankOrder.Unknown;
    const rankB = rankOrder[b.rank] ?? rankOrder.Unknown;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    const callsignA = a.callsign || "";
    const callsignB = b.callsign || "";
    return callsignA.localeCompare(callsignB);
  });

  const grouped: { [category: string]: RosterUser[] } = {};
  categoryOrder.forEach((cat) => {
    grouped[cat] = [];
  });
  categorizedUsers.forEach((u) => {
    grouped[u.category!].push(u);
  });

  return { groupedRoster: grouped };
};

const convertToString = (
  value: string | Timestamp | null | undefined
): string => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString().split("T")[0];
  }
  return value || "N/A";
};

const SASPRoster: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isAdmin = computeIsAdmin(currentUser);
  const [groupedRoster, setGroupedRoster] = useState<{
    [category: string]: RosterUser[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideVacant, setHideVacant] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedRank, setSelectedRank] = useState<string>("All");
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editedRowData, setEditedRowData] = useState<Partial<RosterUser>>({});

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * backgroundImages.length);
    setBackgroundImage(backgroundImages[randomIndex]);
  }, []);

  const fetchAndMergeRoster = async () => {
    setLoading(true);
    setError(null);
    try {
      const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
      const liveUsersData = usersSnapshot.docs.map((doc) => {
        const data = doc.data();
        const normalizedCerts = data.certifications
          ? Object.entries(data.certifications).reduce((acc, [key, value]) => {
              const upperValue =
                typeof value === "string" ? value.toUpperCase() : null;
              const validStatus = ["TRAIN", "LEAD", "SUPER", "CERT"].includes(
                upperValue || ""
              )
                ? (upperValue as CertStatus)
                : null;
              acc[key.toUpperCase()] = validStatus;
              return acc;
            }, {} as { [key: string]: CertStatus })
          : {};
        return {
          id: doc.id,
          name: data.name || "Unknown",
          rank: data.rank || "Unknown",
          badge: data.badge || "N/A",
          callsign: data.callsign || "",
          certifications: normalizedCerts,
          loaStartDate:
            typeof data.loaStartDate === "string" ? data.loaStartDate : null,
          loaEndDate:
            typeof data.loaEndDate === "string" ? data.loaEndDate : null,
          isActive: data.isActive !== undefined ? data.isActive : true,
          discordId: data.discordId || "-",
          email: doc.id,
          joinDate: typeof data.joinDate === "string" ? data.joinDate : null,
          lastPromotionDate:
            typeof data.lastPromotionDate === "string"
              ? data.lastPromotionDate
              : null,
          isPlaceholder: false,
        } as RosterUser;
      });

      const liveUserMap = new Map<string, RosterUser>();
      liveUsersData.forEach((user) => {
        if (user.callsign) {
          liveUserMap.set(user.callsign, user);
        }
      });

      const mergedRoster: RosterUser[] = fullRosterTemplate.map(
        (templateEntry) => {
          const liveUser = templateEntry.callsign
            ? liveUserMap.get(templateEntry.callsign)
            : undefined;

          if (liveUser) {
            if (
              templateEntry.callsign &&
              liveUserMap.has(templateEntry.callsign)
            ) {
              liveUserMap.delete(templateEntry.callsign);
            }
            return {
              ...liveUser,
              callsign: templateEntry.callsign,
              isPlaceholder: false,
            };
          } else {
            const normalizedTemplateEntry =
              normalizeTemplateCertKeys(templateEntry);
            const templateCerts = Object.entries(
              normalizedTemplateEntry.certifications
            ).reduce((acc, [key, value]) => {
              const validStatus = ["TRAIN", "LEAD", "SUPER", "CERT"].includes(
                value?.toUpperCase() || ""
              )
                ? typeof value === "string"
                  ? (value.toUpperCase() as CertStatus)
                  : null
                : null;
              acc[key.toUpperCase()] = validStatus;
              return acc;
            }, {} as { [key: string]: CertStatus });
            return {
              id: `template-${templateEntry.callsign || Math.random()}`,
              name: normalizedTemplateEntry.name || "VACANT",
              rank: normalizedTemplateEntry.rank || "",
              badge: normalizedTemplateEntry.badge || "N/A",
              callsign: normalizedTemplateEntry.callsign,
              certifications: templateCerts,
              loaStartDate: normalizedTemplateEntry.loaStartDate || null,
              loaEndDate: normalizedTemplateEntry.loaEndDate || null,
              joinDate: normalizedTemplateEntry.joinDate || null,
              lastPromotionDate:
                normalizedTemplateEntry.lastPromotionDate || null,
              isActive:
                normalizedTemplateEntry.isActive === true ? true : false,
              discordId: normalizedTemplateEntry.discordId || "-",
              email: normalizedTemplateEntry.email || "",
              isPlaceholder: true,
            } as RosterUser;
          }
        }
      );

      // Add any remaining live users that were not matched to the template
      liveUserMap.forEach((user) => {
        mergedRoster.push(user);
      });

      const lowerSearchTerm = searchTerm.toLowerCase();
      const filteredRoster = mergedRoster.filter((u) => {
        const matchesSearch =
          !lowerSearchTerm ||
          u.name?.toLowerCase().includes(lowerSearchTerm) ||
          u.badge?.toLowerCase().includes(lowerSearchTerm) ||
          u.callsign?.toLowerCase().includes(lowerSearchTerm) ||
          u.rank?.toLowerCase().includes(lowerSearchTerm) ||
          u.discordId?.toLowerCase().includes(lowerSearchTerm);
        const matchesRank = selectedRank === "All" || u.rank === selectedRank;
        return matchesSearch && matchesRank;
      });

      const { groupedRoster: processedGroupedRoster } =
        processRosterData(filteredRoster);
      setGroupedRoster(processedGroupedRoster);
    } catch (err) {
      console.error("Error fetching or merging roster:", err);
      setError("Failed to load roster. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndMergeRoster();
  }, [hideVacant, searchTerm, selectedRank, isAdmin]);

  const uniqueRanks = useMemo(() => {
    const ranks = new Set<string>(["All"]);
    Object.values(groupedRoster)
      .flat()
      .forEach((u) => {
        if (u.rank && u.rank.trim()) {
          ranks.add(u.rank.trim());
        }
      });
    return Array.from(ranks).sort((a, b) => {
      if (a === "All") return -1;
      if (b === "All") return 1;
      return (rankOrder[a] ?? 99) - (rankOrder[b] ?? 99);
    });
  }, [groupedRoster]);

  const totalColSpan = 5 + divisionKeys.length + certificationKeys.length + 4;

  const handleEditClick = (user: RosterUser) => {
    setEditingRowId(user.id);
    setEditedRowData(user);
  };

  const handleSaveClick = async () => {
    try {
      if (!editedRowData.id || editedRowData.id.trim() === "") {
        console.error("The row does not have a valid Firestore document ID.");
        toast.error("Cannot save rows without a valid Firestore document ID.");
        return;
      }

      if (!editedRowData.name || !editedRowData.callsign) {
        console.error("The row does not have a valid name and callsign.");
        toast.error("Cannot save rows without a valid name and callsign.");
        return;
      }

      const userRef = doc(dbFirestore, "users", editedRowData.id); // Use the correct document ID

      const updatedData = {
        ...editedRowData,
        joinDate: formatDateToMMDDYY(editedRowData.joinDate),
        lastPromotionDate: formatDateToMMDDYY(editedRowData.lastPromotionDate),
        loaStartDate: formatDateToMMDDYY(editedRowData.loaStartDate),
        loaEndDate: formatDateToMMDDYY(editedRowData.loaEndDate),
        certifications: Object.fromEntries(
          certificationKeys.map((key) => [
            key.toUpperCase(),
            editedRowData.certifications?.[key.toUpperCase()] || "",
          ])
        ), // Ensure all certifications are strings
      };

      await updateDoc(userRef, updatedData); // Write the updated data to Firestore

      toast.success(`Roster edit saved for ${editedRowData.name || "current row"}`);
      setEditingRowId(null);
      setEditedRowData({});
      fetchAndMergeRoster(); // Refresh the roster data
    } catch (error) {
      console.error("Error saving user data:", error);
      toast.error("Failed to save user data. Please try again.");
    }
  };

  const handleCancelClick = () => {
    setEditingRowId(null);
    setEditedRowData({});
    toast.info("Edit cancelled."); // Toastify notification for cancel
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setEditedRowData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Helper function to determine allowed certification options
  const getCertificationOptions = (key: string) => {
    const restrictedKeys = ["HEAT", "MBU", "ACU"];
    if (restrictedKeys.includes(key.toUpperCase())) {
      return ["", "CERT"]; // Only allow None (blank) or CERT
    }
    return ["", "LEAD", "SUPER", "CERT", "TRAIN"]; // Default options
  };

  return (
    <Layout>
      <div
        className="page-content space-y-6 p-6 text-white min-h-screen"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <h1 className="text-3xl font-bold text-[#f3c700]">SASP Roster</h1>

        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="Search Roster (Name, Badge, Callsign, Rank, Discord)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input flex-grow bg-black bg-opacity-75 border border-[#f3c700] text-white focus:border-[#f3c700] focus:ring-[#f3c700]"
          />
          <select
            value={selectedRank}
            onChange={(e) => setSelectedRank(e.target.value)}
            className="input md:w-auto bg-black bg-opacity-75 border border-[#f3c700] text-white focus:border-[#f3c700] focus:ring-[#f3c700]"
          >
            {uniqueRanks.map((rank) => (
              <option key={rank} value={rank}>
                {rank === "All" ? "All Ranks" : rank}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hideVacantToggle"
              checked={hideVacant}
              onChange={(e) => setHideVacant(e.target.checked)}
              className="form-checkbox h-4 w-4 text-[#f3c700] bg-black bg-opacity-75 border border-[#f3c700] rounded focus:ring-[#f3c700]"
            />
            <label
              htmlFor="hideVacantToggle"
              className="text-sm text-white whitespace-nowrap"
            >
              Hide Vacant
            </label>
          </div>
        </div>

        {loading && <p className="text-[#f3c700] italic">Loading roster...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="rounded-lg border border-[#f3c700] bg-black bg-opacity-80 overflow-x-auto shadow-lg">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-black bg-opacity-90 text-[#f3c700] font-semibold">
                <tr>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}></th>{" "}
                  {/* Blank column header */}
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    CALLSIGN
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    BADGE #
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    RANK
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    NAME
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    DISCORD
                  </th>
                  <th
                    className="p-2 border border-[#f3c700]"
                    colSpan={divisionKeys.length}
                  >
                    Divisions
                  </th>
                  <th
                    className="p-2 border border-[#f3c700]"
                    colSpan={certificationKeys.length}
                  >
                    Certifications
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    JOIN
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    PROMO
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    ACTIVE
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    INACTIVE / LOA SINCE
                  </th>
                </tr>
                <tr>
                  {divisionKeys.map((divKey) => (
                    <th key={divKey} className="p-2 border border-[#f3c700]">
                      {divKey.toUpperCase()}
                    </th>
                  ))}
                  {certificationKeys.map((certKey) => (
                    <th key={certKey} className="p-2 border border-[#f3c700]">
                      {certKey.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              {categoryOrder.map((category, categoryIndex) => {
                const usersInCategory = groupedRoster[category] || [];
                return usersInCategory.length > 0 ? (
                  <React.Fragment key={category}>
                    {categoryIndex > 0 && (
                      <tbody>
                        <tr>
                          <td
                            colSpan={totalColSpan + (isAdmin ? 1 : 0)}
                            className="h-6"
                          ></td>
                        </tr>
                      </tbody>
                    )}
                    <tbody className="bg-black bg-opacity-85 text-white">
                      <tr>
                        <td
                          rowSpan={usersInCategory.length + 1}
                          className="text-center text-md font-bold text-[#f3c700] py-4 uppercase border-r border-[#f3c700] whitespace-pre-line"
                          style={{
                            writingMode: "vertical-rl",
                            textOrientation: "upright",
                          }}
                        >
                          {category}
                        </td>
                      </tr>
                      {usersInCategory.map((u, index) => {
                        const isEditing = editingRowId === u.id;
                        const isVacant = u.name === "VACANT";
                        return (
                          <tr
                            key={u.id}
                            className={`border-t border-[#f3c700] hover:bg-[#f3c700]/10 transition ${
                              isVacant ? "text-white italic opacity-60" : ""
                            } ${!isVacant && !u.isActive ? "opacity-50" : ""}`}
                          >
                            <td className="p-2 border border-[#f3c700]">
                              {isEditing ? (
                                <input
                                  type="text"
                                  name="callsign"
                                  value={editedRowData.callsign || ""}
                                  onChange={handleInputChange}
                                  className="input w-full bg-gray-700 border-gray-600 text-white"
                                />
                              ) : (
                                u.callsign || "-"
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700]">
                              {isEditing ? (
                                <input
                                  type="text"
                                  name="badge"
                                  value={editedRowData.badge || ""}
                                  onChange={handleInputChange}
                                  className="input w-full bg-gray-700 border-gray-600 text-white"
                                />
                              ) : (
                                u.badge || "-"
                              )}
                            </td>
                            <td
                              className={`p-2 border border-[#f3c700] ${
                                u.rank
                                  ? "bg-[#f3c700] text-black font-semibold"
                                  : ""
                              }`}
                            >
                              {isEditing ? (
                                <select
                                  name="rank"
                                  value={editedRowData.rank || ""}
                                  onChange={handleInputChange}
                                  className="input w-full bg-gray-700 border-gray-600 text-white"
                                >
                                  {Object.keys(rankOrder).map((rank) => (
                                    <option key={rank} value={rank}>
                                      {rank}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                u.rank || "-"
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700]">
                              {isEditing ? (
                                <input
                                  type="text"
                                  name="name"
                                  value={editedRowData.name || ""}
                                  onChange={handleInputChange}
                                  className="input w-full bg-gray-700 border-gray-600 text-white"
                                />
                              ) : (
                                u.name
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700]">
                              {isEditing ? (
                                <input
                                  type="text"
                                  name="discordId"
                                  value={editedRowData.discordId || ""}
                                  onChange={handleInputChange}
                                  className="input w-full bg-gray-700 border-gray-600 text-white"
                                />
                              ) : (
                                u.discordId || "-"
                              )}
                            </td>
                            {divisionKeys.map((divKey) => (
                              <td
                                key={divKey}
                                className="p-2 border border-[#f3c700]"
                              >
                                {isEditing ? (
                                  <select
                                    name={`certifications.${divKey.toUpperCase()}`}
                                    value={
                                      editedRowData.certifications?.[
                                        divKey.toUpperCase()
                                      ] || ""
                                    }
                                    onChange={(e) =>
                                      setEditedRowData((prev) => ({
                                        ...prev,
                                        certifications: {
                                          ...prev.certifications,
                                          [divKey.toUpperCase()]: e.target
                                            .value as CertStatus,
                                        },
                                      }))
                                    }
                                    className="input w-full bg-gray-700 border-gray-600 text-white"
                                  >
                                    {getCertificationOptions(divKey).map(
                                      (option) => (
                                        <option key={option} value={option}>
                                          {option || "-"}
                                        </option>
                                      )
                                    )}
                                  </select>
                                ) : (
                                  <span
                                    className={`px-2 py-1 rounded ${
                                      u.certifications?.[
                                        divKey.toUpperCase()
                                      ] === "LEAD"
                                        ? "bg-blue-600 text-white"
                                        : u.certifications?.[
                                            divKey.toUpperCase()
                                          ] === "SUPER"
                                        ? "bg-yellow-600 text-white"
                                        : u.certifications?.[
                                            divKey.toUpperCase()
                                          ] === "CERT"
                                        ? "bg-green-600 text-white"
                                        : u.certifications?.[
                                          divKey.toUpperCase()
                                        ] === "TRAIN"
                                        ? "bg-orange-600"
                                        : "bg-gray-700 text-gray-400"
                                    }`}
                                  >
                                    {u.certifications?.[
                                      divKey.toUpperCase()
                                    ] || "-"}
                                  </span>
                                )}
                              </td>
                            ))}
                            {certificationKeys.map((certKey) => (
                              <td
                                key={certKey}
                                className="p-2 border border-[#f3c700]"
                              >
                                {isEditing ? (
                                  <select
                                    name={`certifications.${certKey.toUpperCase()}`}
                                    value={
                                      editedRowData.certifications?.[
                                        certKey.toUpperCase()
                                      ] || ""
                                    }
                                    onChange={(e) =>
                                      setEditedRowData((prev) => ({
                                        ...prev,
                                        certifications: {
                                          ...prev.certifications,
                                          [certKey.toUpperCase()]: e.target
                                            .value as CertStatus,
                                        },
                                      }))
                                    }
                                    className="input w-full bg-gray-700 border-gray-600 text-white"
                                  >
                                    {getCertificationOptions(certKey).map(
                                      (option) => (
                                        <option key={option} value={option}>
                                          {option || "-"}
                                        </option>
                                      )
                                    )}
                                  </select>
                                ) : (
                                  <span
                                    className={`px-2 py-1 rounded ${
                                      u.certifications?.[
                                        certKey.toUpperCase()
                                      ] === "LEAD"
                                        ? "bg-blue-600 text-white"
                                        : u.certifications?.[
                                            certKey.toUpperCase()
                                          ] === "SUPER"
                                        ? "bg-orange-500 text-white"
                                        : u.certifications?.[
                                            certKey.toUpperCase()
                                          ] === "CERT"
                                        ? "bg-green-600 text-white"
                                        : u.certifications?.[
                                          certKey.toUpperCase()
                                        ] === "TRAIN"
                                        ? "bg-orange-600"
                                        : "bg-gray-700 text-gray-400"
                                    }`}
                                  >
                                    {u.certifications?.[
                                      certKey.toUpperCase()
                                    ] || "-"}
                                  </span>
                                )}
                              </td>
                            ))}
                            <td className="p-2 border border-[#f3c700]">
                              {isEditing ? (
                                <input
                                  type="text"
                                  name="joinDate"
                                  value={
                                    editedRowData.joinDate instanceof Timestamp
                                      ? editedRowData.joinDate
                                          .toDate()
                                          .toISOString()
                                          .split("T")[0]
                                      : editedRowData.joinDate || ""
                                  }
                                  onChange={handleInputChange}
                                  placeholder="MM/DD/YY"
                                  className="input w-full bg-gray-700 border-gray-600 text-white"
                                />
                              ) : (
                                formatDateToMMDDYY(u.joinDate) || "-"
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700]">
                              {isEditing ? (
                                <input
                                  type="text"
                                  name="lastPromotionDate"
                                  value={
                                    editedRowData.lastPromotionDate instanceof
                                    Timestamp
                                      ? editedRowData.lastPromotionDate
                                          .toDate()
                                          .toISOString()
                                          .split("T")[0]
                                      : editedRowData.lastPromotionDate || ""
                                  }
                                  onChange={handleInputChange}
                                  placeholder="MM/DD/YY"
                                  className="input w-full bg-gray-700 border-gray-600 text-white"
                                />
                              ) : (
                                formatDateToMMDDYY(u.lastPromotionDate) || "-"
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700]">
                              {isEditing ? (
                                <select
                                  name="isActive"
                                  value={
                                    editedRowData.isActive ? "true" : "false"
                                  }
                                  onChange={(e) =>
                                    setEditedRowData((prev) => ({
                                      ...prev,
                                      isActive: e.target.value === "true",
                                    }))
                                  }
                                  className="input w-full bg-gray-700 border-gray-600 text-white"
                                >
                                  <option value="true">YES</option>
                                  <option value="false">NO</option>
                                </select>
                              ) : (
                                <span
                                  className={`px-2 py-1 rounded ${
                                    u.isActive
                                      ? "bg-green-600 text-white"
                                      : "bg-red-600 text-white"
                                  }`}
                                >
                                  {u.isActive ? "YES" : "NO"}
                                </span>
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700]">
                              {isEditing ? (
                                <input
                                  type="text"
                                  name="loaStartDate"
                                  value={
                                    editedRowData.loaStartDate instanceof
                                    Timestamp
                                      ? editedRowData.loaStartDate
                                          .toDate()
                                          .toISOString()
                                          .split("T")[0]
                                      : editedRowData.loaStartDate || ""
                                  }
                                  onChange={handleInputChange}
                                  placeholder="MM/DD/YY"
                                  className="input w-full bg-gray-700 border-gray-600 text-white"
                                />
                              ) : (
                                formatDateToMMDDYY(u.loaStartDate) || "-"
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700]">
                              {isEditing ? (
                                <input
                                  type="text"
                                  name="loaEndDate"
                                  value={
                                    editedRowData.loaEndDate instanceof
                                    Timestamp
                                      ? editedRowData.loaEndDate
                                          .toDate()
                                          .toISOString()
                                          .split("T")[0]
                                      : editedRowData.loaEndDate || ""
                                  }
                                  onChange={handleInputChange}
                                  placeholder="MM/DD/YY"
                                  className="input w-full bg-gray-700 border-gray-600 text-white"
                                />
                              ) : (
                                formatDateToMMDDYY(u.loaEndDate) || "-"
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700] text-center">
                              {isEditing ? (
                                <div className="flex gap-2 justify-center">
                                  <button
                                    onClick={handleSaveClick}
                                    className="bg-green-600 hover:bg-green-500 text-white text-xs py-1 px-2 rounded"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelClick}
                                    className="bg-red-600 hover:bg-red-500 text-white text-xs py-1 px-2 rounded"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleEditClick(u)}
                                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs py-1 px-2 rounded"
                                >
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </React.Fragment>
                ) : null;
              })}
              {Object.values(groupedRoster).every((arr) => arr.length === 0) &&
                !loading && (
                  <tbody>
                    <tr>
                      <td
                        colSpan={totalColSpan + (isAdmin ? 1 : 0)}
                        className="text-center p-4 text-white italic"
                      >
                        No users found matching the criteria.
                      </td>
                    </tr>
                  </tbody>
                )}
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SASPRoster;
