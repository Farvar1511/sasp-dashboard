import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore"; // Added Timestamp import
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { useAuth } from "../context/AuthContext";
import EditUserModal from "./EditUserModal";
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
import { backgroundImages } from "../data/images"; // Ensure backgroundImages is used
import { computeIsAdmin } from "../utils/isadmin";

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

// Helper to format dates as M/D/YY
const formatDateForDisplay = (
  dateValue: string | Timestamp | null | undefined
): string => {
  if (!dateValue) return "-";
  const parsedDate =
    dateValue instanceof Timestamp ? dateValue.toDate() : new Date(dateValue);
  if (!isNaN(parsedDate.getTime())) {
    return `${parsedDate.getMonth() + 1}/${parsedDate.getDate()}/${
      parsedDate.getFullYear() % 100
    }`;
  }
  return "-"; // Return a dash if parsing fails
};

const convertToString = (
  value: string | Timestamp | null | undefined
): string => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString().split("T")[0]; // Convert to YYYY-MM-DD format
  }
  return value || "N/A"; // Default to "N/A" if null or undefined
};

const SASPRoster: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isAdmin = computeIsAdmin(currentUser); // Use centralized admin check
  const [groupedRoster, setGroupedRoster] = useState<{
    [category: string]: RosterUser[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideVacant, setHideVacant] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedRank, setSelectedRank] = useState<string>("All");
  const [selectedUserForEdit, setSelectedUserForEdit] =
    useState<RosterUser | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string>("");

  useEffect(() => {
    // Set a random background image
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
              const validStatus = ["LEAD", "SUPER", "CERT"].includes(
                upperValue || ""
              )
                ? (upperValue as CertStatus)
                : null;
              acc[key.toUpperCase()] = validStatus;
              return acc;
            }, {} as { [key: string]: CertStatus })
          : {};
        return {
          id: doc.id, // Email as the document ID
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
          email: doc.id, // Email is the document ID
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

      const convertTimestampToString = (
        value: string | Timestamp | null | undefined
      ): string | null => {
        if (value instanceof Timestamp) {
          return value.toDate().toISOString().split("T")[0]; // Convert to YYYY-MM-DD format
        }
        return value || null;
      };

      const mergedRoster: RosterUser[] = fullRosterTemplate
        .map((templateEntry) => {
          const liveUser = templateEntry.callsign
            ? liveUserMap.get(templateEntry.callsign)
            : undefined;
          if (liveUser) {
            return {
              ...liveUser,
              callsign: templateEntry.callsign,
              isPlaceholder: false,
            };
          } else {
            const normalizedTemplateEntry =
              normalizeTemplateCertKeys(templateEntry); // Pass the entire templateEntry
            const templateCerts = Object.entries(
              normalizedTemplateEntry.certifications
            ).reduce((acc, [key, value]) => {
              const validStatus = ["LEAD", "SUPER", "CERT"].includes(
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
              loaStartDate: convertTimestampToString(
                normalizedTemplateEntry.loaStartDate
              ),
              loaEndDate: convertTimestampToString(
                normalizedTemplateEntry.loaEndDate
              ),
              joinDate: convertTimestampToString(
                normalizedTemplateEntry.joinDate
              ),
              lastPromotionDate: convertTimestampToString(
                normalizedTemplateEntry.lastPromotionDate
              ),
              isActive:
                normalizedTemplateEntry.isActive === true ? true : false,
              discordId: normalizedTemplateEntry.discordId || "-",
              email: normalizedTemplateEntry.email || "",
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
                  <th
                    className="p-2 border border-[#f3c700] w-8"
                    rowSpan={2}
                  ></th>
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
                        const isVacant = u.name === "VACANT";
                        return (
                          <tr
                            key={u.id}
                            className={`border-t border-[#f3c700] hover:bg-[#f3c700]/10 transition ${
                              isVacant ? "text-white italic opacity-60" : ""
                            } ${!isVacant && !u.isActive ? "opacity-50" : ""}`}
                          >
                            <td className="p-2 border border-[#f3c700]">
                              {u.callsign || "-"}
                            </td>
                            <td className="p-2 border border-[#f3c700]">
                              {u.badge || "-"}
                            </td>
                            <td
                              className={`p-2 border border-[#f3c700] ${
                                u.rank
                                  ? "bg-[#f3c700] text-black font-semibold"
                                  : ""
                              }`}
                            >
                              {u.rank || "-"}
                            </td>
                            <td className="p-2 border border-[#f3c700]">
                              {u.name}
                            </td>
                            <td className="p-2 border border-[#f3c700]">
                              {u.discordId || "-"}
                            </td>
                            {divisionKeys.map((divKey) => {
                              const currentStatus =
                                u.certifications?.[divKey.toUpperCase()] ??
                                null;
                              const style = getCertStyle(currentStatus);
                              return (
                                <td
                                  key={divKey}
                                  className={`p-0 border border-[#f3c700] text-center align-middle`}
                                >
                                  <span
                                    className={`block w-full text-xs py-1 font-semibold rounded ${style.bgColor} ${style.textColor}`}
                                  >
                                    {currentStatus || "-"}
                                  </span>
                                </td>
                              );
                            })}
                            {certificationKeys.map((certKey) => {
                              const currentStatus =
                                u.certifications?.[certKey.toUpperCase()] ??
                                null;
                              const style = getCertStyle(currentStatus);
                              return (
                                <td
                                  key={certKey}
                                  className={`p-0 border border-[#f3c700] text-center align-middle`}
                                >
                                  <span
                                    className={`block w-full text-xs py-1 font-semibold rounded ${style.bgColor} ${style.textColor}`}
                                  >
                                    {currentStatus || "-"}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="p-2 border border-[#f3c700]">
                              {formatDateForDisplay(u.joinDate)}
                            </td>
                            <td className="p-2 border border-[#f3c700]">
                              {formatDateForDisplay(u.lastPromotionDate)}
                            </td>
                            <td
                              className={`p-0 border border-[#f3c700] text-center align-middle`}
                            >
                              {isVacant ? (
                                <span className="cert-span text-white block w-full h-full">
                                  -
                                </span>
                              ) : (
                                <span
                                  className={`cert-span ${
                                    u.isActive
                                      ? "bg-green-600 text-white"
                                      : "bg-red-600 text-white"
                                  } block w-full h-full`}
                                >
                                  {u.isActive ? "YES" : "NO"}
                                </span>
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700]">
                              {!isVacant && !u.isActive
                                ? formatDateForDisplay(u.loaStartDate)
                                : "-"}
                            </td>
                            {isAdmin && (
                              <td className="p-2 border border-[#f3c700] text-center">
                                <button
                                  onClick={() => setSelectedUserForEdit(u)}
                                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs py-1 px-2 block w-full h-full"
                                  title="Edit User"
                                >
                                  Edit
                                </button>
                              </td>
                            )}
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
      {selectedUserForEdit && (
        <EditUserModal
          user={{
            ...selectedUserForEdit,
            badge: selectedUserForEdit.badge || "N/A",
            callsign: selectedUserForEdit.callsign || "-",
            discordId: selectedUserForEdit.discordId || "-",
            certifications: selectedUserForEdit.certifications || {},
            assignedVehicleId:
              selectedUserForEdit.assignedVehicleId ?? undefined,
            loaStartDate: convertToString(selectedUserForEdit.loaStartDate),
            loaEndDate: convertToString(selectedUserForEdit.loaEndDate),
            joinDate: convertToString(selectedUserForEdit.joinDate),
            lastPromotionDate: convertToString(
              selectedUserForEdit.lastPromotionDate
            ),
            category: selectedUserForEdit.category || "Uncategorized",
            cid: selectedUserForEdit.cid || "", // Ensure cid is always a string
            email: selectedUserForEdit.email || "", // Ensure email is always a string
            role: selectedUserForEdit.role || "Unknown", // Ensure role is always a string
            isPlaceholder: selectedUserForEdit.isPlaceholder ?? false, // Ensure isPlaceholder is always a boolean
            isActive: selectedUserForEdit.isActive ?? true,
            tasks: selectedUserForEdit.tasks || [],
            disciplineEntries: selectedUserForEdit.disciplineEntries || [],
            generalNotes: selectedUserForEdit.generalNotes || [],
          }}
          onClose={() => setSelectedUserForEdit(null)}
          onSave={() => {
            fetchAndMergeRoster();
            setSelectedUserForEdit(null);
          }}
        />
      )}
    </Layout>
  );
};

export default SASPRoster;
