import React, { useState, useEffect } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { User as AuthUser } from "../types/User";

// --- Reused constants and types from RosterManagement ---
const rankOrder: { [key: string]: number } = {
  Commissioner: 1,
  "Deputy Commissioner": 2,
  "Assistant Commissioner": 3,
  Commander: 4,
  Captain: 5,
  Lieutenant: 6,
  "Staff Sergeant": 7,
  Sergeant: 8,
  Corporal: 9,
  "Trooper First Class": 10,
  Trooper: 11,
  Cadet: 12,
  Unknown: 99,
};

const rankCategories: { [key: string]: string[] } = {
  "High Command": [
    "Commissioner",
    "Deputy Commissioner",
    "Assistant Commissioner",
    "Commander",
  ],
  Command: ["Captain", "Lieutenant"],
  Supervisors: ["Staff Sergeant", "Sergeant"],
  "State Troopers": ["Corporal", "Trooper First Class", "Trooper"],
  Cadets: ["Cadet"],
};

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

const certificationKeys = ["HEAT", "MOTO", "ACU"];
const divisionKeys = ["SWAT", "CIU", "K9", "FTO"];
const allCertAndDivisionKeys = [
  ...certificationKeys,
  ...divisionKeys,
  "OVERWATCH",
]; // Keep OVERWATCH if needed

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
}

const processRosterData = (
  usersData: RosterUser[]
): {
  sortedRoster: RosterUser[];
  groupedRoster: { [category: string]: RosterUser[] };
} => {
  const sortedRoster = [...usersData].sort((a, b) => {
    const rankA = rankOrder[a.rank] ?? rankOrder.Unknown;
    const rankB = rankOrder[b.rank] ?? rankOrder.Unknown;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.name.localeCompare(b.name);
  });

  const grouped: { [category: string]: RosterUser[] } = {};
  Object.keys(rankCategories).forEach((category) => {
    grouped[category] = [];
  });
  grouped["Other"] = [];

  sortedRoster.forEach((u) => {
    let foundCategory = false;
    for (const category in rankCategories) {
      if (rankCategories[category].includes(u.rank)) {
        grouped[category].push(u);
        foundCategory = true;
        break;
      }
    }
    if (!foundCategory) {
      grouped["Other"].push(u);
    }
  });

  return { sortedRoster, groupedRoster: grouped };
};

const formatDateForInput = (
  dateValue: string | Timestamp | undefined | null
): string => {
  if (!dateValue) return "";
  try {
    // Handle both Firestore Timestamps and date strings (like 'YYYY-MM-DD')
    const date =
      dateValue instanceof Timestamp
        ? dateValue.toDate()
        : new Date(dateValue + "T00:00:00"); // Add time part to avoid timezone issues with YYYY-MM-DD
    if (isNaN(date.getTime())) return "";
    // Format consistently, e.g., YYYY-MM-DD
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
    const fetchRoster = async () => {
      setLoading(true);
      setError(null);
      try {
        const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
        const usersData = usersSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "Unknown",
            rank: data.rank || "Unknown",
            badge: data.badge || "N/A",
            callsign: data.callsign || "",
            certifications: data.certifications || {},
            loaStartDate: data.loaStartDate || undefined,
            loaEndDate: data.loaEndDate || undefined,
            isActive: data.isActive !== undefined ? data.isActive : true,
            discordId: data.discordId || "",
            email: doc.id,
          } as RosterUser;
        });

        const { groupedRoster: processedGroupedRoster } =
          processRosterData(usersData);
        setGroupedRoster(processedGroupedRoster);
      } catch (err) {
        console.error("Error fetching roster:", err);
        setError("Failed to load roster. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchRoster();
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
                  {/* Headers matching RosterManagement view */}
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
              {Object.entries(groupedRoster).map(
                ([category, usersInCategory]) =>
                  usersInCategory.length > 0 ? (
                    <tbody key={category} className="text-gray-300">
                      <tr className="bg-gray-800/70 sticky top-0 z-10">
                        <td
                          // Adjust colspan: 4 standard + certs + divs + 4 additional
                          colSpan={
                            4 +
                            certificationKeys.length +
                            divisionKeys.length +
                            4
                          }
                          className="p-1.5 font-bold text-yellow-300 text-center text-base tracking-wider"
                        >
                          {category}
                        </td>
                      </tr>
                      {usersInCategory.map((u) => (
                        <tr
                          key={u.id}
                          className="border-t border-gray-700 hover:bg-gray-800/50"
                        >
                          {/* View Mode Only */}
                          <td className="p-2 border-r border-gray-600">
                            {u.badge}
                          </td>
                          <td className="p-2 border-r border-gray-600 bg-yellow-600/20">
                            {u.rank}
                          </td>
                          <td className="p-2 border-r border-gray-600">
                            {u.name}
                          </td>
                          <td className="p-2 border-r border-gray-600">
                            {u.callsign}
                          </td>
                          {/* Certifications */}
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
                          {/* Divisions */}
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
                          {/* Additional Info */}
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
                            <span
                              className={`block w-full h-full px-2 py-2 font-semibold ${
                                u.isActive
                                  ? "bg-green-600 text-white"
                                  : "bg-red-600 text-white"
                              }`}
                            >
                              {u.isActive ? "YES" : "NO"}
                            </span>
                          </td>
                          <td className="p-2 border-r border-gray-600">
                            {u.discordId || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  ) : null
              )}
            </table>
          </div>
        )}
      </div>
      {/* Include styles if needed, or rely on global styles */}
    </Layout>
  );
};

export default SASPRoster;
