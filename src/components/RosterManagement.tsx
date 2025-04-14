import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  getDocs,
  Timestamp,
  doc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { useAuth } from "../context/AuthContext"; // Import useAuth
import fullRosterTemplate, {
  normalizeTemplateCertKeys,
} from "../data/FullRosterData";
import {
  rankOrder,
  CertStatus,
  certificationKeys,
  divisionKeys,
  getCertStyle,
} from "../data/rosterConfig";

// Helper to format dates as M/D/YY
const formatDateForDisplay = (
  dateValue: string | Timestamp | null | undefined
): string => {
  if (!dateValue) return "-";
  try {
    let date: Date;
    if (dateValue instanceof Timestamp) {
      date = dateValue.toDate();
    } else if (typeof dateValue === "string") {
      date = new Date(
        dateValue.includes("T") ? dateValue : `${dateValue}T00:00:00`
      );
      if (isNaN(date.getTime())) return "-";
    } else {
      return "-";
    }
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear() % 100; // Two-digit year
    return `${month}/${day}/${year}`;
  } catch (e) {
    console.error("Error formatting date for display:", e);
    return "-";
  }
};

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

interface RosterUser {
  id: string;
  name: string;
  rank: string;
  badge?: string;
  callsign?: string;
  certifications?: { [key: string]: CertStatus | null };
  loaStartDate?: string | Timestamp | null;
  loaEndDate?: string | Timestamp | null;
  isActive?: boolean;
  discordId?: string;
  email?: string;
  joinDate?: string | Timestamp | null;
  lastPromotionDate?: string | Timestamp | null;
  isPlaceholder?: boolean;
  category?: string | null;
}

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

const initialNewUserData: Omit<
  RosterUser,
  "id" | "category" | "isPlaceholder"
> = {
  email: "",
  name: "",
  rank: "",
  badge: "",
  callsign: "",
  certifications: {},
  loaStartDate: null,
  loaEndDate: null,
  isActive: true,
  discordId: "",
  joinDate: null,
  lastPromotionDate: null,
};

const RosterManagement: React.FC = () => {
  const { user } = useAuth(); // Get user from context (useful for future permission checks)
  const [groupedRoster, setGroupedRoster] = useState<{
    [category: string]: RosterUser[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideVacant, setHideVacant] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedRank, setSelectedRank] = useState<string>("All");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editedUserData, setEditedUserData] = useState<RosterUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserData, setNewUserData] =
    useState<Omit<RosterUser, "id" | "category" | "isPlaceholder">>(
      initialNewUserData
    );
  const [isSavingNewUser, setIsSavingNewUser] = useState(false);
  const [newUserError, setNewUserError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndMergeRoster = async () => {
      setLoading(true);
      setError(null);
      try {
        const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
        const liveUsersData = usersSnapshot.docs.map((doc) => {
          const data = doc.data();
          const normalizedCerts = data.certifications
            ? Object.entries(data.certifications).reduce(
                (acc, [key, value]) => {
                  const upperValue =
                    typeof value === "string" ? value.toUpperCase() : null;
                  const validStatus = ["LEAD", "SUPER", "CERT"].includes(
                    upperValue || ""
                  )
                    ? (upperValue as CertStatus)
                    : null;
                  acc[key.toUpperCase()] = validStatus;
                  return acc;
                },
                {} as { [key: string]: CertStatus | null }
              )
            : {};
          return {
            id: doc.id,
            name: data.name || "Unknown",
            rank: data.rank || "Unknown",
            badge: data.badge || "N/A",
            callsign: data.callsign || "",
            certifications: normalizedCerts,
            loaStartDate: data.loaStartDate || null,
            loaEndDate: data.loaEndDate || null,
            isActive: data.isActive !== undefined ? data.isActive : true,
            discordId: data.discordId || "-",
            email: doc.id,
            joinDate: data.joinDate || null,
            lastPromotionDate: data.lastPromotionDate || null,
            isPlaceholder: false,
          } as RosterUser;
        });

        const liveUserMap = new Map<string, RosterUser>();
        liveUsersData.forEach((user) => {
          if (user.callsign) {
            liveUserMap.set(user.callsign, user);
          }
        });

        const mergedRoster: RosterUser[] = fullRosterTemplate
          .map((templateEntry) => {
            const liveUser = templateEntry.callsign
              ? liveUserMap.get(templateEntry.callsign)
              : undefined;
            if (liveUser) {
              liveUser.discordId = liveUser.discordId || "-";
              return {
                ...liveUser,
                callsign: templateEntry.callsign,
                isPlaceholder: false,
              };
            } else {
              const templateCerts = normalizeTemplateCertKeys(
                templateEntry.certifications
              );
              return {
                id: `template-${templateEntry.callsign || Math.random()}`,
                name: templateEntry.name || "VACANT",
                rank: templateEntry.rank || "",
                badge: templateEntry.badge || "N/A",
                callsign: templateEntry.callsign,
                certifications: templateCerts,
                loaStartDate: templateEntry.loaStartDate || null,
                loaEndDate: templateEntry.loaEndDate || null,
                isActive: templateEntry.isActive === true ? true : false,
                discordId: templateEntry.discordId || "-",
                email: templateEntry.email || "",
                joinDate: templateEntry.joinDate || null,
                lastPromotionDate: templateEntry.lastPromotionDate || null,
                isPlaceholder: true,
              } as RosterUser;
            }
          })
          .filter((u) => !hideVacant || u.name !== "VACANT");

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

    fetchAndMergeRoster();
  }, [hideVacant, searchTerm, selectedRank, refreshTrigger]);

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

  const handleEditClick = (userToEdit: RosterUser) => {
    if (userToEdit.isPlaceholder) return;
    setEditingUserId(userToEdit.id);
    setEditedUserData({ ...userToEdit });
  };

  const handleCancelClick = () => {
    setEditingUserId(null);
    setEditedUserData(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    if (!editedUserData) return;

    const { name, value, type } = e.target;

    if (name.startsWith("cert-")) {
      const certKey = name.split("-")[1].toUpperCase();
      const certValue = value === "" ? null : (value as CertStatus);
      setEditedUserData({
        ...editedUserData,
        certifications: {
          ...editedUserData.certifications,
          [certKey]: certValue,
        },
      });
    } else if (type === "checkbox") {
      const { checked } = e.target as HTMLInputElement;
      setEditedUserData({
        ...editedUserData,
        [name]: checked,
        loaStartDate: checked ? null : editedUserData.loaStartDate,
      });
    } else {
      setEditedUserData({
        ...editedUserData,
        [name]: value,
      });
    }
  };

  const handleSaveClick = async () => {
    if (!editedUserData || !editingUserId || editedUserData.isPlaceholder)
      return;

    setIsSaving(true);
    setError(null);

    try {
      const userRef = doc(dbFirestore, "users", editingUserId);

      const dataToSave: Partial<RosterUser> = {
        ...editedUserData,
        joinDate: editedUserData.joinDate || null,
        lastPromotionDate: editedUserData.lastPromotionDate || null,
        loaStartDate: editedUserData.loaStartDate || null,
        certifications: Object.entries(editedUserData.certifications || {})
          .filter(([key]) =>
            [...divisionKeys, ...certificationKeys].includes(key)
          )
          .reduce((acc, [key, value]) => {
            acc[key.toUpperCase()] = value;
            return acc;
          }, {} as { [key: string]: CertStatus | null }),
      };

      delete dataToSave.id;
      delete dataToSave.isPlaceholder;
      delete dataToSave.category;
      delete dataToSave.email;

      await updateDoc(userRef, dataToSave);

      setEditingUserId(null);
      setEditedUserData(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Error updating user:", err);
      setError(`Failed to save changes for ${editedUserData.name}.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAddModal = () => {
    setNewUserData(initialNewUserData);
    setNewUserError(null);
    setShowAddUserModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddUserModal(false);
    setNewUserError(null);
  };

  const handleNewUserInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setNewUserData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSaveNewUser = async () => {
    if (!newUserData.email || !newUserData.name || !newUserData.rank) {
      setNewUserError("Email, Name, and Rank are required.");
      return;
    }

    setIsSavingNewUser(true);
    setNewUserError(null);

    try {
      const userRef = doc(dbFirestore, "users", newUserData.email);

      const dataToSave = {
        ...newUserData,
        joinDate: newUserData.joinDate || null,
        lastPromotionDate: newUserData.lastPromotionDate || null,
        loaStartDate: newUserData.isActive
          ? null
          : newUserData.loaStartDate || null,
        loaEndDate: null,
        certifications: {},
      };

      delete (dataToSave as any).email; // Ensure email is not saved as a field

      await setDoc(userRef, dataToSave);

      handleCloseAddModal();
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Error adding new user:", err);
      setNewUserError(
        "Failed to add user. Email might already exist or another error occurred."
      );
    } finally {
      setIsSavingNewUser(false);
    }
  };

  const totalColSpan =
    5 + divisionKeys.length + certificationKeys.length + 4 + 1;
  const certStatusOptions: (CertStatus | "")[] = [
    "",
    "CERT",
    "SUPER",
    "LEAD",
  ].filter((opt) => opt !== null) as (CertStatus | "")[];
  const rankOptions = ["", ...Object.keys(rankOrder)];

  return (
    <Layout>
      <div className="page-content space-y-6">
        <h1 className="text-3xl font-bold text-[#f3c700]">
          SASP Roster Management
        </h1>
        <div className="flex flex-col md:flex-row gap-4 mb-4 items-center">
          <input
            type="text"
            placeholder="Search Roster (Name, Badge, Callsign, Rank, Discord)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input flex-grow"
          />
          <select
            value={selectedRank}
            onChange={(e) => setSelectedRank(e.target.value)}
            className="input md:w-auto"
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
              className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="hideVacantToggle"
              className="text-sm text-gray-300 whitespace-nowrap"
            >
              Hide Vacant
            </label>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="btn bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium whitespace-nowrap"
          >
            Add New User
          </button>
        </div>

        {isSaving && <p className="text-blue-400 italic">Saving changes...</p>}
        {loading && !isSaving && (
          <p className="text-yellow-400 italic">Loading roster...</p>
        )}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto custom-scrollbar">
            <table
              className="min-w-full border border-gray-700 text-sm"
              style={{ backgroundColor: "rgba(17, 24, 39, 0.90)" }}
            >
              <thead className="bg-gray-800 text-yellow-400">
                <tr>
                  <th
                    rowSpan={2}
                    className="p-1 border-r border-b border-gray-600 w-8"
                  ></th>
                  <th
                    colSpan={5}
                    className="p-1 border-r border-b border-gray-600 text-center font-semibold"
                  >
                    PERSONNEL INFORMATION
                  </th>
                  <th
                    colSpan={divisionKeys.length}
                    className="p-1 border-r border-b border-gray-600 text-center font-semibold"
                  >
                    DIVISION INFORMATION
                  </th>
                  <th
                    colSpan={certificationKeys.length}
                    className="p-1 border-r border-b border-gray-600 text-center font-semibold"
                  >
                    CERTIFICATIONS
                  </th>
                  <th
                    colSpan={4}
                    className="p-1 border-b border-gray-600 text-center font-semibold"
                  >
                    ADDITIONAL INFORMATION
                  </th>
                  <th
                    rowSpan={2}
                    className="p-1 border-b border-gray-600 text-center font-semibold"
                  >
                    ACTIONS
                  </th>
                </tr>
                <tr>
                  <th className="p-2 border-r border-gray-600">CALLSIGN</th>
                  <th className="p-2 border-r border-gray-600">BADGE #</th>
                  <th className="p-2 border-r border-gray-600">RANK</th>
                  <th className="p-2 border-r border-gray-600">NAME</th>
                  <th className="p-2 border-r border-gray-600">DISCORD</th>
                  {divisionKeys.map((div) => (
                    <th key={div} className="p-2 border-r border-gray-600">
                      {div}
                    </th>
                  ))}
                  {certificationKeys.map((cert) => (
                    <th key={cert} className="p-2 border-r border-gray-600">
                      {cert === "MOTO" ? "MBU" : cert}
                    </th>
                  ))}
                  <th className="p-2 border-r border-gray-600">JOIN</th>
                  <th className="p-2 border-r border-gray-600">PROMO</th>
                  <th className="p-2 border-r border-gray-600">ACTIVE</th>
                  <th className="p-2">INACTIVE / LOA SINCE</th>
                </tr>
              </thead>
              {categoryOrder.map((category) => {
                const usersInCategory = groupedRoster[category] || [];
                return usersInCategory.length > 0 ? (
                  <tbody key={category} className="text-gray-300">
                    {usersInCategory.map((u, index) => {
                      const isVacant = u.name === "VACANT" || u.isPlaceholder;
                      const isLastInCategory =
                        index === usersInCategory.length - 1;
                      const isEditing = editingUserId === u.id;

                      return (
                        <tr
                          key={u.id}
                          className={`border-t border-gray-700 ${
                            isEditing ? "bg-blue-900/30" : "hover:bg-white/5"
                          } ${isVacant ? "italic opacity-60" : ""} ${
                            !isVacant && !u.isActive ? "opacity-60" : ""
                          } ${
                            isLastInCategory
                              ? "border-b-4 border-yellow-400"
                              : ""
                          }`}
                        >
                          {index === 0 && (
                            <td
                              rowSpan={usersInCategory.length}
                              className="p-2 border-r border-l border-gray-600 align-middle text-center font-semibold text-yellow-300 category-vertical"
                              style={{ writingMode: "vertical-lr" }}
                            >
                              {category}
                            </td>
                          )}
                          <td className="p-1 border-r border-gray-600">
                            {isEditing ? (
                              <input
                                type="text"
                                name="callsign"
                                value={editedUserData?.callsign || ""}
                                onChange={handleInputChange}
                                className="input-edit"
                              />
                            ) : (
                              u.callsign || "-"
                            )}
                          </td>
                          <td className="p-1 border-r border-gray-600">
                            {isEditing ? (
                              <input
                                type="text"
                                name="badge"
                                value={editedUserData?.badge || ""}
                                onChange={handleInputChange}
                                className="input-edit"
                              />
                            ) : (
                              u.badge || "-"
                            )}
                          </td>
                          <td
                            className={`p-1 border-r border-gray-600 ${
                              !isEditing && u.rank
                                ? "bg-[#f3c700] text-black font-semibold"
                                : ""
                            }`}
                          >
                            {isEditing ? (
                              <select
                                name="rank"
                                value={editedUserData?.rank || ""}
                                onChange={handleInputChange}
                                className="input-edit"
                              >
                                {rankOptions.map((r) => (
                                  <option key={r} value={r}>
                                    {r || "Select Rank"}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              u.rank || "-"
                            )}
                          </td>
                          <td className="p-1 border-r border-gray-600">
                            {isEditing ? (
                              <input
                                type="text"
                                name="name"
                                value={editedUserData?.name || ""}
                                onChange={handleInputChange}
                                className="input-edit"
                              />
                            ) : (
                              u.name
                            )}
                          </td>
                          <td className="p-1 border-r border-gray-600">
                            {isEditing ? (
                              <input
                                type="text"
                                name="discordId"
                                value={editedUserData?.discordId || ""}
                                onChange={handleInputChange}
                                className="input-edit"
                              />
                            ) : (
                              u.discordId || "-"
                            )}
                          </td>
                          {divisionKeys.map((divKey) => {
                            const upperKey = divKey.toUpperCase();
                            const currentStatus = isEditing
                              ? editedUserData?.certifications?.[upperKey] ??
                                null
                              : u.certifications?.[upperKey] ?? null;
                            const style = getCertStyle(currentStatus);
                            return (
                              <td
                                key={divKey}
                                className={`p-0 border-r border-gray-600 text-center align-middle`}
                              >
                                {isEditing ? (
                                  <select
                                    name={`cert-${upperKey}`}
                                    value={currentStatus || ""}
                                    onChange={handleInputChange}
                                    className="input-edit-cert"
                                  >
                                    {certStatusOptions.map((opt) => (
                                      <option key={opt} value={opt || ""}>
                                        {opt || "-"}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span
                                    className={`cert-span rounded-md ${style.bgColor} ${style.textColor}`}
                                  >
                                    {currentStatus || "-"}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          {certificationKeys.map((certKey) => {
                            const upperKey = certKey.toUpperCase();
                            const currentStatus = isEditing
                              ? editedUserData?.certifications?.[upperKey] ??
                                null
                              : u.certifications?.[upperKey] ?? null;
                            const style = getCertStyle(currentStatus);
                            return (
                              <td
                                key={certKey}
                                className={`p-0 border-r border-gray-600 text-center align-middle`}
                              >
                                {isEditing ? (
                                  <select
                                    name={`cert-${upperKey}`}
                                    value={currentStatus || ""}
                                    onChange={handleInputChange}
                                    className="input-edit-cert"
                                  >
                                    {certStatusOptions.map((opt) => (
                                      <option key={opt} value={opt || ""}>
                                        {opt || "-"}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span
                                    className={`cert-span rounded-md ${style.bgColor} ${style.textColor}`}
                                  >
                                    {currentStatus || "-"}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-1 border-r border-gray-600">
                            {isEditing ? (
                              <input
                                type="date"
                                name="joinDate"
                                value={
                                  editedUserData?.joinDate instanceof Timestamp
                                    ? editedUserData.joinDate
                                        .toDate()
                                        .toISOString()
                                        .split("T")[0]
                                    : editedUserData?.joinDate || ""
                                }
                                onChange={handleInputChange}
                                className="input-edit-date"
                              />
                            ) : (
                              formatDateForDisplay(u.joinDate)
                            )}
                          </td>
                          <td className="p-1 border-r border-gray-600">
                            {isEditing ? (
                              <input
                                type="date"
                                name="lastPromotionDate"
                                value={
                                  editedUserData?.lastPromotionDate instanceof
                                  Timestamp
                                    ? editedUserData.lastPromotionDate
                                        .toDate()
                                        .toISOString()
                                        .split("T")[0]
                                    : editedUserData?.lastPromotionDate || ""
                                }
                                onChange={handleInputChange}
                                className="input-edit-date"
                              />
                            ) : (
                              formatDateForDisplay(u.lastPromotionDate)
                            )}
                          </td>
                          <td
                            className={`p-0 border-r border-gray-600 text-center align-middle`}
                          >
                            {isEditing ? (
                              <input
                                type="checkbox"
                                name="isActive"
                                checked={editedUserData?.isActive ?? true}
                                onChange={handleInputChange}
                                className="form-checkbox h-5 w-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 mx-auto block"
                              />
                            ) : isVacant ? (
                              <span className="cert-span rounded-md text-gray-500">
                                -
                              </span>
                            ) : (
                              <span
                                className={`cert-span rounded-md ${
                                  u.isActive
                                    ? "bg-green-600 text-white"
                                    : "bg-red-600 text-white"
                                }`}
                              >
                                {u.isActive ? "YES" : "NO"}
                              </span>
                            )}
                          </td>
                          <td className="p-1">
                            {isEditing ? (
                              <input
                                type="date"
                                name="loaStartDate"
                                value={
                                  editedUserData?.loaStartDate instanceof
                                  Timestamp
                                    ? editedUserData.loaStartDate
                                        .toDate()
                                        .toISOString()
                                        .split("T")[0]
                                    : editedUserData?.loaStartDate || ""
                                }
                                onChange={handleInputChange}
                                className="input-edit-date"
                                disabled={editedUserData?.isActive ?? true}
                              />
                            ) : !isVacant && !u.isActive ? (
                              formatDateForDisplay(u.loaStartDate)
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="p-1 border-l border-gray-600">
                            {isEditing ? (
                              <div className="flex gap-1 justify-center">
                                <button
                                  onClick={handleSaveClick}
                                  disabled={isSaving}
                                  className="btn-action bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                >
                                  {isSaving ? "..." : "Save"}
                                </button>
                                <button
                                  onClick={handleCancelClick}
                                  disabled={isSaving}
                                  className="btn-action bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : !isVacant ? (
                              <button
                                onClick={() => handleEditClick(u)}
                                className="btn-action bg-blue-600 hover:bg-blue-700"
                              >
                                Edit
                              </button>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                ) : null;
              })}
              {Object.values(groupedRoster).every((arr) => arr.length === 0) &&
                !loading && (
                  <tbody>
                    <tr>
                      <td
                        colSpan={totalColSpan + 1}
                        className="text-center p-4 text-gray-400 italic"
                      >
                        No users found matching the criteria.
                      </td>
                    </tr>
                  </tbody>
                )}
            </table>
          </div>
        )}

        {showAddUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold text-yellow-400 mb-4">
                Add New Roster Member
              </h2>
              {newUserError && (
                <p className="text-red-500 text-sm mb-3">{newUserError}</p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveNewUser();
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-300 mb-1"
                    >
                      Email (Required - ID)
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={newUserData.email}
                      onChange={handleNewUserInputChange}
                      required
                      className="input-modal"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-gray-300 mb-1"
                    >
                      Name (Required)
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={newUserData.name}
                      onChange={handleNewUserInputChange}
                      required
                      className="input-modal"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="rank"
                      className="block text-sm font-medium text-gray-300 mb-1"
                    >
                      Rank (Required)
                    </label>
                    <select
                      id="rank"
                      name="rank"
                      value={newUserData.rank}
                      onChange={handleNewUserInputChange}
                      required
                      className="input-modal"
                    >
                      {rankOptions.map((r) => (
                        <option key={r} value={r}>
                          {r || "Select Rank"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="callsign"
                      className="block text-sm font-medium text-gray-300 mb-1"
                    >
                      Callsign
                    </label>
                    <input
                      type="text"
                      id="callsign"
                      name="callsign"
                      value={newUserData.callsign}
                      onChange={handleNewUserInputChange}
                      className="input-modal"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="badge"
                      className="block text-sm font-medium text-gray-300 mb-1"
                    >
                      Badge #
                    </label>
                    <input
                      type="text"
                      id="badge"
                      name="badge"
                      value={newUserData.badge}
                      onChange={handleNewUserInputChange}
                      className="input-modal"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="discordId"
                      className="block text-sm font-medium text-gray-300 mb-1"
                    >
                      Discord ID
                    </label>
                    <input
                      type="text"
                      id="discordId"
                      name="discordId"
                      value={newUserData.discordId}
                      onChange={handleNewUserInputChange}
                      className="input-modal"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="joinDate"
                      className="block text-sm font-medium text-gray-300 mb-1"
                    >
                      Join Date
                    </label>
                    <input
                      type="date"
                      id="joinDate"
                      name="joinDate"
                      value={
                        newUserData.joinDate instanceof Timestamp
                          ? newUserData.joinDate
                              .toDate()
                              .toISOString()
                              .split("T")[0]
                          : newUserData.joinDate || ""
                      }
                      onChange={handleNewUserInputChange}
                      className="input-modal"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lastPromotionDate"
                      className="block text-sm font-medium text-gray-300 mb-1"
                    >
                      Last Promotion Date
                    </label>
                    <input
                      type="date"
                      id="lastPromotionDate"
                      name="lastPromotionDate"
                      value={
                        newUserData.lastPromotionDate instanceof Timestamp
                          ? newUserData.lastPromotionDate
                              .toDate()
                              .toISOString()
                              .split("T")[0]
                          : newUserData.lastPromotionDate || ""
                      }
                      onChange={handleNewUserInputChange}
                      className="input-modal"
                    />
                  </div>
                  <div className="flex items-center mt-4">
                    <input
                      type="checkbox"
                      id="isActiveNew"
                      name="isActive"
                      checked={newUserData.isActive}
                      onChange={handleNewUserInputChange}
                      className="form-checkbox h-5 w-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="isActiveNew"
                      className="ml-2 text-sm font-medium text-gray-300"
                    >
                      Is Active
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseAddModal}
                    disabled={isSavingNewUser}
                    className="btn bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingNewUser}
                    className="btn bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                  >
                    {isSavingNewUser ? "Saving..." : "Save User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <style>{`
        .category-vertical {
            writing-mode: vertical-lr;
            text-orientation: mixed;
            white-space: nowrap;
            transform: rotate(180deg);
            padding: 8px 4px;
            background-color: #111827;
            border-left: 2px solid #4b5563;
            border-right: 2px solid #4b5563;
        }
        table {
            border-collapse: collapse;
            width: 100%;
        }
        thead th {
            position: sticky;
            top: 0;
            background-color: #1f2937;
            color: #f3c700;
            text-align: center;
            padding: 8px;
            border: 2px solid #4b5563;
            z-index: 10;
            font-family: 'Inter', sans-serif;
        }
         thead tr:nth-child(2) th {
             background-color: #374151;
             top: 36px;
             z-index: 11;
             font-family: 'Inter', sans-serif;
        }
        tbody td {
            padding: 8px;
            border: 2px solid #4b5563;
            text-align: center;
            vertical-align: middle;
            font-family: 'Inter', sans-serif;
        }
        tbody tr:hover {
            background-color: rgba(255, 255, 255, 0.05);
        }
        .cert-span {
            display: inline-block;
            width: auto;
            min-width: 40px;
            height: auto;
            padding: 4px 8px;
            font-weight: 600;
            border-radius: 0.375rem;
            line-height: 1.25;
        }
        tbody td.p-0 {
            padding: 4px;
        }
        .input-edit, .input-edit-cert, .input-edit-date, .input-edit select {
            background-color: #374151;
            color: #e5e7eb;
            border: 1px solid #4b5563;
            border-radius: 0.25rem;
            padding: 2px 4px;
            width: 100%;
            box-sizing: border-box;
            font-size: 0.875rem;
        }
        .input-edit-cert {
            min-width: 60px;
        }
        .input-edit-date {
             min-width: 120px;
        }
        .input-edit:focus, .input-edit-cert:focus, .input-edit-date:focus {
            outline: none;
            border-color: #f3c700;
            box-shadow: 0 0 0 1px #f3c700;
        }
        .input-edit-date::-webkit-calendar-picker-indicator {
            filter: invert(0.8);
        }
        .btn-action {
            padding: 2px 6px;
            border-radius: 0.25rem;
            color: white;
            font-size: 0.75rem;
            font-weight: 500;
            transition: background-color 0.2s;
            white-space: nowrap;
        }
        .input-modal {
            background-color: #4b5563;
            color: #e5e7eb;
            border: 1px solid #6b7280;
            border-radius: 0.375rem;
            padding: 8px 12px;
            width: 100%;
            box-sizing: border-box;
            font-size: 0.875rem;
        }
        .input-modal:focus {
            outline: none;
            border-color: #f3c700;
            box-shadow: 0 0 0 1px #f3c700;
        }
        .input-modal[type="date"]::-webkit-calendar-picker-indicator {
            filter: invert(0.8);
        }
      `}</style>
    </Layout>
  );
};

export default RosterManagement;
