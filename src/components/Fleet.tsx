import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { User as AuthUser } from "../types/User";

// --- Reused Interface and Processing Logic ---
interface FleetVehicle {
  id: string;
  plate: string;
  vehicle: string;
  division: string;
  assignee: string;
  restrictions: string;
  inService: boolean;
}

const processFleetData = (
  vehiclesData: FleetVehicle[]
): {
  sortedFleet: FleetVehicle[];
  groupedFleet: { [division: string]: FleetVehicle[] };
} => {
  const sortedFleet = [...vehiclesData].sort((a, b) => {
    if (a.division !== b.division) {
      return a.division.localeCompare(b.division);
    }
    return a.plate.localeCompare(b.plate);
  });

  const grouped: { [division: string]: FleetVehicle[] } = {};
  sortedFleet.forEach((v) => {
    const divisionKey = v.division || "Unknown";
    if (!grouped[divisionKey]) {
      grouped[divisionKey] = [];
    }
    grouped[divisionKey].push(v);
  });

  return { sortedFleet, groupedFleet: grouped };
};
// --- End Reused ---

const Fleet: React.FC<{ user: AuthUser }> = ({ user }) => {
  const [groupedFleet, setGroupedFleet] = useState<{
    [division: string]: FleetVehicle[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFleet = async () => {
      setLoading(true);
      setError(null);
      try {
        const fleetSnapshot = await getDocs(collection(dbFirestore, "fleet"));
        const vehiclesData = fleetSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            plate: data.plate || doc.id,
            vehicle: data.vehicle || "Unknown Vehicle",
            division: data.division || "Unknown Division",
            assignee: data.assignee || "N/A",
            restrictions: data.restrictions || "",
            inService: data.inService !== undefined ? data.inService : true,
          } as FleetVehicle;
        });

        const { groupedFleet: processedGroupedFleet } =
          processFleetData(vehiclesData);
        setGroupedFleet(processedGroupedFleet);
      } catch (err) {
        console.error("Error fetching fleet:", err);
        setError("Failed to load fleet data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchFleet();
  }, []);

  return (
    <Layout user={user}>
      <div className="page-content space-y-6">
        <h1 className="text-3xl font-bold text-[#f3c700]">Fleet List</h1>

        {loading && <p className="text-yellow-400 italic">Loading fleet...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-full bg-gray-900/50 border border-gray-700 text-sm">
              <thead className="bg-gray-800 text-yellow-400">
                <tr>
                  <th className="p-2 border-r border-gray-600 w-8"></th>{" "}
                  {/* Division Column */}
                  <th className="p-2 border-r border-gray-600">Plate</th>
                  <th className="p-2 border-r border-gray-600">Vehicle</th>
                  <th className="p-2 border-r border-gray-600">Assignee</th>
                  <th className="p-2 border-r border-gray-600">Restrictions</th>
                  <th className="p-2 border-r border-gray-600">In Service</th>
                </tr>
              </thead>
              {Object.entries(groupedFleet).map(
                ([division, vehiclesInDivision]) =>
                  vehiclesInDivision.length > 0 ? (
                    <tbody key={division} className="text-gray-300">
                      {vehiclesInDivision.map((v, index) => (
                        <tr
                          key={v.id}
                          className={`border-t border-gray-700 hover:bg-gray-800/50 ${
                            !v.inService ? "opacity-60" : ""
                          }`} // Apply opacity if not in service
                        >
                          {index === 0 && (
                            <td
                              rowSpan={vehiclesInDivision.length}
                              className="p-2 border-r border-l border-gray-600 align-middle text-center font-semibold text-yellow-300 category-vertical"
                              style={{ writingMode: "vertical-lr" }}
                            >
                              {division}
                            </td>
                          )}
                          {/* View Mode Only */}
                          <td className="p-2 border-r border-gray-600 font-mono">
                            {v.plate}
                          </td>
                          <td className="p-2 border-r border-gray-600">
                            {v.vehicle}
                          </td>
                          <td className="p-2 border-r border-gray-600">
                            {v.assignee}
                          </td>
                          <td className="p-2 border-r border-gray-600">
                            {v.restrictions || "-"}
                          </td>
                          <td
                            className={`p-0 border-r border-gray-600 text-center align-middle`}
                          >
                            <span
                              className={`block w-full h-full px-2 py-2 font-semibold ${
                                v.inService
                                  ? "bg-green-600 text-white"
                                  : "bg-red-600 text-white"
                              }`}
                            >
                              {v.inService ? "YES" : "NO"}
                            </span>
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
      {/* Style for vertical text */}
      <style>{`
        .category-vertical {
          writing-mode: vertical-lr;
          text-orientation: mixed;
          white-space: nowrap;
          transform: rotate(180deg);
          padding: 8px 4px;
        }
        table {
          border-collapse: separate;
          border-spacing: 0 8px;
        }
        tbody tr {
          background-color: #1f2937;
          border-radius: 8px;
          overflow: hidden;
        }
        tbody tr:hover {
          background-color: #374151;
        }
        tbody td {
          border-top: 1px solid #4b5563;
          border-bottom: 1px solid #4b5563;
          border-radius: 8px;
        }
        thead th {
          border-bottom: 2px solid #4b5563;
          border-radius: 8px;
        }
      `}</style>
    </Layout>
  );
};

export default Fleet;
