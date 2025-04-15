import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { User as AuthUser } from "../types/User";
import fullRosterTemplate, {
  normalizeTemplateCertKeys,
} from "../data/FullRosterData";
import {
  rankOrder,
  CertStatus,
  certificationKeys,
  divisionKeys,
  getCertStyle,
  formatDate,
} from "../data/rosterConfig";

const rankCategories: { [key: string]: string[] } = {
  "High Command": [
    "Commissioner",
    "Deputy Commissioner",
    "Assistant Commissioner",
    "Commander",
  ],
  "Command": ["Captain", "Lieutenant"],
  "Supervisors": ["Staff Sergeant", "Sergeant"],
  "State Troopers": ["Corporal", "Trooper First Class", "Trooper"],
  "Cadets": ["Cadet"],
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

const SASPRoster: React.FC = () => {
  const [groupedRoster, setGroupedRoster] = useState<{
    [category: string]: RosterUser[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideVacant, setHideVacant] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedRank, setSelectedRank] = useState<string>("All");

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
  }, [hideVacant, searchTerm, selectedRank]);

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
      <div className="page-content space-y-6">
        <h1 className="text-3xl font-bold text-[#f3c700]">SASP Roster</h1>

        <div className="flex flex-col md:flex-row gap-4 mb-4">
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
        </div>

        {loading && <p className="text-yellow-400 italic">Loading roster...</p>}
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
                      const isVacant = u.name === "VACANT";
                      const isLastInCategory =
                        index === usersInCategory.length - 1;
                      return (
                        <tr
                          key={u.id}
                          className={`border-t border-gray-700 hover:bg-white/5 ${
                            isVacant ? "italic opacity-60" : ""
                          } ${!isVacant && !u.isActive ? "opacity-60" : ""} ${
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
                          <td className="p-2 border-r border-gray-600">
                            {u.callsign || "-"}
                          </td>
                          <td className="p-2 border-r border-gray-600">
                            {u.badge || "-"}
                          </td>
                          <td
                            className={`p-2 border-r border-gray-600 ${
                              u.rank
                                ? "bg-[#f3c700] text-black font-semibold"
                                : ""
                            }`}
                          >
                            {u.rank || "-"}
                          </td>
                          <td className="p-2 border-r border-gray-600">
                            {u.name}
                          </td>
                          <td className="p-2 border-r border-gray-600">
                            {u.discordId || "-"}
                          </td>
                          {divisionKeys.map((divKey) => {
                            const currentStatus =
                              u.certifications?.[divKey.toUpperCase()] ?? null;
                            const style = getCertStyle(currentStatus);
                            return (
                              <td
                                key={divKey}
                                className={`p-0 border-r border-gray-600 text-center align-middle`}
                              >
                                <span
                                  className={`cert-span rounded-md ${style.bgColor} ${style.textColor}`}
                                >
                                  {currentStatus || "-"}
                                </span>
                              </td>
                            );
                          })}
                          {certificationKeys.map((certKey) => {
                            const currentStatus =
                              u.certifications?.[certKey.toUpperCase()] ?? null;
                            const style = getCertStyle(currentStatus);
                            return (
                              <td
                                key={certKey}
                                className={`p-0 border-r border-gray-600 text-center align-middle`}
                              >
                                <span
                                  className={`cert-span rounded-md ${style.bgColor} ${style.textColor}`}
                                >
                                  {currentStatus || "-"}
                                </span>
                              </td>
                            );
                          })}
                          <td className="p-2 border-r border-gray-600">
                            {formatDateForDisplay(u.joinDate)}
                          </td>
                          <td className="p-2 border-r border-gray-600">
                            {formatDateForDisplay(u.lastPromotionDate)}
                          </td>
                          <td
                            className={`p-0 border-r border-gray-600 text-center align-middle`}
                          >
                            {isVacant ? (
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
                          <td className="p-2">
                            {!isVacant && !u.isActive
                              ? formatDateForDisplay(u.loaStartDate)
                              : "-"}
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
      `}</style>
    </Layout>
  );
};

export default SASPRoster;
