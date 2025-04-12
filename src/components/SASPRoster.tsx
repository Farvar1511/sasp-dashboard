import React, { useState, useEffect } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { User as AuthUser } from "../types/User";
// Import the template and normalization function
import fullRosterTemplate, {
  normalizeTemplateCertKeys,
} from "../data/FullRosterData"; // Adjust path if needed

// --- Reused constants and types from RosterManagement ---
const rankOrder: { [key: string]: number } = {
  Commissioner: 1,
  "Assistant Deputy Commissioner": 2, // Added rank
  "Deputy Commissioner": 3, // Adjusted number
  "Assistant Commissioner": 4, // Adjusted number
  Commander: 5, // Adjusted number
  Captain: 6, // Adjusted number
  Lieutenant: 7, // Adjusted number
  "Staff Sergeant": 8, // Adjusted number
  Sergeant: 9, // Adjusted number
  Corporal: 10, // Adjusted number
  "Trooper First Class": 11, // Adjusted number
  Trooper: 12, // Adjusted number
  Cadet: 13, // Adjusted number
  Unknown: 99,
};

const rankCategories: { [key: string]: string[] } = {
  "High Command": [
    "Commissioner",
    "Assistant Deputy Commissioner", // Added rank
    "Deputy Commissioner",
    "Assistant Commissioner",
    "Commander",
  ],
  Command: ["Captain", "Lieutenant"],
  Supervisors: ["Staff Sergeant", "Sergeant"],
  "State Troopers": ["Corporal", "Trooper First Class", "Trooper"],
  Cadets: ["Cadet"],
};

// Define the desired order for categories
const categoryOrder = [
  "High Command",
  "Command",
  "Supervisors",
  "State Troopers",
  "Cadets",
];

type CertStatus = "LEAD" | "SUPER" | "CERT" | null;

const certOptions: {
  value: CertStatus;
  label: string;
  bgColor: string;
  textColor: string;
}[] = [
  {
    value: null,
    label: "None",
    bgColor: "bg-gray-700",
    textColor: "text-gray-300",
  },
  {
    value: "CERT",
    label: "CERT",
    bgColor: "bg-green-600",
    textColor: "text-white",
  },
  {
    value: "LEAD",
    label: "LEAD",
    bgColor: "bg-blue-600",
    textColor: "text-white",
  },
  {
    value: "SUPER",
    label: "SUPER",
    bgColor: "bg-orange-600",
    textColor: "text-white",
  },
];

// Match keys used in RosterManagement and FullRosterData normalization
const certificationKeys = ["HEAT", "MOTO", "ACU"];
const divisionKeys = ["SWAT", "CIU", "K9", "FTO"];

interface RosterUser {
  id: string;
  name: string;
  rank: string;
  badge?: string;
  callsign?: string;
  certifications?: {
    [key: string]: CertStatus;
  };
  loaStartDate?: string | Timestamp;
  loaEndDate?: string | Timestamp;
  isActive?: boolean;
  discordId?: string;
  email?: string;
  isPlaceholder?: boolean; // Keep this flag from merge logic
  category?: string | null; // Added by processRosterData
}

// --- Reused helper functions from RosterManagement ---

const processRosterData = (
  usersData: RosterUser[]
): {
  sortedRoster: RosterUser[];
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
      if (
        !category &&
        user.rank &&
        user.rank !== "Unknown" &&
        user.rank !== ""
      ) {
        console.warn(
          `User ${user.name} (${user.callsign}) has rank "${user.rank}" which doesn't fit into defined categories.`
        );
      }
      return { ...user, category };
    })
    .filter((user) => user.category !== null);

  const sortedRoster = categorizedUsers.sort((a, b) => {
    const categoryIndexA = categoryOrder.indexOf(a.category!);
    const categoryIndexB = categoryOrder.indexOf(b.category!);
    if (categoryIndexA !== categoryIndexB) {
      return categoryIndexA - categoryIndexB;
    }
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
  sortedRoster.forEach((u) => {
    grouped[u.category!].push(u);
  });

  return { sortedRoster, groupedRoster: grouped };
};

const formatDateForInput = (
  dateValue: string | Timestamp | undefined | null
): string => {
  if (!dateValue) return "";
  try {
    const date =
      dateValue instanceof Timestamp ? dateValue.toDate() : new Date(dateValue);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
  } catch {
    return "";
  }
};

const getCertStyle = (
  status: CertStatus
): { bgColor: string; textColor: string } => {
  return (
    certOptions.find((opt) => opt.value === status) || {
      bgColor: "bg-gray-700",
      textColor: "text-gray-300",
    }
  );
};
// --- End Reused ---

const SASPRoster: React.FC<{ user: AuthUser }> = ({ user }) => {
  const [groupedRoster, setGroupedRoster] = useState<{
    [category: string]: RosterUser[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                  acc[key.toUpperCase()] = value as CertStatus;
                  return acc;
                },
                {} as { [key: string]: CertStatus }
              )
            : {};
          return {
            id: doc.id,
            name: data.name || "Unknown",
            rank: data.rank || "Unknown",
            badge: data.badge || "N/A",
            callsign: data.callsign || "",
            certifications: normalizedCerts,
            loaStartDate: data.loaStartDate || undefined,
            loaEndDate: data.loaEndDate || undefined,
            isActive: data.isActive !== undefined ? data.isActive : true,
            discordId: data.discordId || "",
            email: doc.id,
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
              return {
                ...liveUser,
                callsign: templateEntry.callsign,
                isPlaceholder: false,
              };
            } else {
              return {
                id: `template-${templateEntry.callsign || Math.random()}`,
                name: templateEntry.name || "VACANT",
                rank: templateEntry.rank || "",
                badge: templateEntry.badge || "N/A",
                callsign: templateEntry.callsign,
                certifications: normalizeTemplateCertKeys(
                  templateEntry.certifications
                ),
                loaStartDate: templateEntry.loaStartDate || undefined,
                loaEndDate: templateEntry.loaEndDate || undefined,
                isActive: templateEntry.isActive === true ? true : false,
                discordId: templateEntry.discordId || "",
                email: templateEntry.email || "",
                isPlaceholder: true,
              } as RosterUser;
            }
          }
        );

        const { groupedRoster: processedGroupedRoster } =
          processRosterData(mergedRoster);

        setGroupedRoster(processedGroupedRoster);
      } catch (err) {
        console.error("Error fetching or merging roster:", err);
        setError("Failed to load roster. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchAndMergeRoster();
  }, []);

  return (
    <Layout user={user}>
      <div className="page-content space-y-6">
        <h1 className="text-3xl font-bold text-[#f3c700]">SASP Roster</h1>

        {loading && <p className="text-yellow-400 italic">Loading roster...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-full bg-gray-900/50 border border-gray-700 text-sm">
              <thead className="bg-gray-800 text-yellow-400">
                <tr>
                  <th className="p-2 border-r border-gray-600 w-8"></th>{" "}
                  {/* Category */}
                  <th className="p-2 border-r border-gray-600">Badge</th>
                  <th className="p-2 border-r border-gray-600">Rank</th>
                  <th className="p-2 border-r border-gray-600">Name</th>
                  <th className="p-2 border-r border-gray-600">Callsign</th>
                  {certificationKeys.map((cert) => (
                    <th key={cert} className="p-2 border-r border-gray-600">
                      {cert}
                    </th>
                  ))}
                  {divisionKeys.map((div) => (
                    <th key={div} className="p-2 border-r border-gray-600">
                      {div}
                    </th>
                  ))}
                  <th className="p-2 border-r border-gray-600">LOA Start</th>
                  <th className="p-2 border-r border-gray-600">LOA End</th>
                  <th className="p-2 border-r border-gray-600">Active</th>
                  <th className="p-2 border-r border-gray-600">Discord ID</th>
                </tr>
              </thead>
              {categoryOrder.map((category) => {
                const usersInCategory = groupedRoster[category] || [];
                return usersInCategory.length > 0 ? (
                  <tbody key={category} className="text-gray-300">
                    {usersInCategory.map((u, index) => {
                      const isVacant = u.name === "VACANT";
                      return (
                        <tr
                          key={u.id}
                          className={`border-t border-gray-700 ${
                            isVacant ? "italic opacity-60" : ""
                          } ${!isVacant && !u.isActive ? "opacity-60" : ""}`}
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
                          <td className="p-2 border-r border-gray-600 font-mono">
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
                            {u.callsign || "-"}
                          </td>
                          {certificationKeys.map((certKey) => {
                            const currentStatus =
                              u.certifications?.[certKey] || null;
                            const style = getCertStyle(currentStatus);
                            return (
                              <td
                                key={certKey}
                                className={`p-0 border-r border-gray-600 text-center align-middle`}
                              >
                                <span
                                  className={`block w-full h-full px-2 py-2 font-semibold ${style.bgColor} ${style.textColor}`}
                                >
                                  {currentStatus || "-"}
                                </span>
                              </td>
                            );
                          })}
                          {divisionKeys.map((divKey) => {
                            const currentStatus =
                              u.certifications?.[divKey] || null;
                            const style = getCertStyle(currentStatus);
                            return (
                              <td
                                key={divKey}
                                className={`p-0 border-r border-gray-600 text-center align-middle`}
                              >
                                <span
                                  className={`block w-full h-full px-2 py-2 font-semibold ${style.bgColor} ${style.textColor}`}
                                >
                                  {currentStatus || "-"}
                                </span>
                              </td>
                            );
                          })}
                          <td className="p-2 border-r border-gray-600">
                            {u.loaStartDate
                              ? formatDateForInput(u.loaStartDate)
                              : "-"}
                          </td>
                          <td className="p-2 border-r border-gray-600">
                            {u.loaEndDate
                              ? formatDateForInput(u.loaEndDate)
                              : "-"}
                          </td>
                          <td
                            className={`p-0 border-r border-gray-600 text-center align-middle`}
                          >
                            {isVacant ? (
                              <span className="block w-full h-full px-2 py-2 text-gray-500">
                                -
                              </span>
                            ) : (
                              <span
                                className={`block w-full h-full px-2 py-2 font-semibold ${
                                  u.isActive
                                    ? "bg-green-600 text-white"
                                    : "bg-red-600 text-white"
                                }`}
                              >
                                {u.isActive ? "YES" : "NO"}
                              </span>
                            )}
                          </td>
                          <td className="p-2 border-r border-gray-600">
                            {u.discordId || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                ) : null;
              })}
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
        }
      `}</style>
    </Layout>
  );
};

export default SASPRoster;
