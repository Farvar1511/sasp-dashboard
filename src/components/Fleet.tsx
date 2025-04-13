import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { User as AuthUser } from "../types/User";

interface Vehicle {
  id: string;
  vehicle: string;
  plate?: string;
  division?: string;
  restrictions?: string;
  assignee?: string;
  inService?: boolean;
  lastCheckedOutBy?: string;
  lastCheckedOutAt?: Timestamp;
  notes?: string;
}

const Fleet: React.FC<{ user: AuthUser }> = ({ user }) => {
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDivision, setSelectedDivision] = useState<string>("All");

  useEffect(() => {
    const fetchFleet = async () => {
      setLoading(true);
      setError(null);
      try {
        const fleetSnapshot = await getDocs(collection(dbFirestore, "fleet"));
        const fleetData = fleetSnapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Vehicle)
        );
        setFleet(fleetData);
      } catch (err) {
        console.error("Error fetching fleet:", err);
        setError("Failed to load fleet data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchFleet();
  }, []);

  const uniqueDivisions = useMemo(() => {
    const divisions = new Set<string>(["All"]);
    fleet.forEach((v) => {
      if (v.division && v.division.trim()) {
        divisions.add(v.division.trim());
      }
    });
    return Array.from(divisions).sort();
  }, [fleet]);

  const filteredFleet = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return fleet.filter((v) => {
      const matchesSearch =
        !lowerSearchTerm ||
        v.vehicle?.toLowerCase().includes(lowerSearchTerm) ||
        v.plate?.toLowerCase().includes(lowerSearchTerm) ||
        v.division?.toLowerCase().includes(lowerSearchTerm) ||
        v.assignee?.toLowerCase().includes(lowerSearchTerm);

      const matchesDivision =
        selectedDivision === "All" || v.division === selectedDivision;

      return matchesSearch && matchesDivision;
    });
  }, [fleet, searchTerm, selectedDivision]);

  const formatTimestamp = (ts: Timestamp | undefined): string => {
    if (!ts) return "-";
    const date = ts.toDate();
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  return (
    <Layout user={user}>
      <div className="page-content space-y-6">
        <h1 className="text-3xl font-bold text-[#f3c700]">SASP Fleet</h1>

        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="Search Fleet..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input flex-grow"
          />
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="input md:w-auto"
          >
            {uniqueDivisions.map((division) => (
              <option key={division} value={division}>
                {division === "All" ? "All Divisions" : division}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="text-yellow-400 italic">Loading fleet...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-full bg-gray-900/50 border border-gray-700 text-sm">
              <thead className="bg-gray-800 text-yellow-400">
                <tr>
                  <th className="p-2 border-r border-gray-600">Vehicle</th>
                  <th className="p-2 border-r border-gray-600">Plate</th>
                  <th className="p-2 border-r border-gray-600">Division</th>
                  <th className="p-2 border-r border-gray-600">Restrictions</th>
                  <th className="p-2 border-r border-gray-600">Assignee</th>
                  <th className="p-2 border-r border-gray-600">In Service</th>
                  <th className="p-2 border-r border-gray-600">
                    Last Checkout
                  </th>
                  <th className="p-2">Notes</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {filteredFleet.map((v) => (
                  <tr
                    key={v.id}
                    className="border-t border-gray-700 hover:bg-gray-800/50"
                  >
                    <td className="p-2 border-r border-gray-600">
                      {v.vehicle}
                    </td>
                    <td className="p-2 border-r border-gray-600">
                      {v.plate || "-"}
                    </td>
                    <td className="p-2 border-r border-gray-600">
                      {v.division || "-"}
                    </td>
                    <td className="p-2 border-r border-gray-600">
                      {v.restrictions || "-"}
                    </td>
                    <td className="p-2 border-r border-gray-600">
                      {v.assignee || "Communal"}
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
                    <td className="p-2 border-r border-gray-600">
                      {v.lastCheckedOutBy
                        ? `${v.lastCheckedOutBy} (${formatTimestamp(
                            v.lastCheckedOutAt
                          )})`
                        : "-"}
                    </td>
                    <td className="p-2">{v.notes || "-"}</td>
                  </tr>
                ))}
                {filteredFleet.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center p-4 text-gray-400 italic"
                    >
                      No vehicles found matching the criteria.
                    </td>
                  </tr>
                )}
              </tbody>
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
