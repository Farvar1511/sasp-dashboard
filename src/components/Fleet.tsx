import React, { useState, useEffect, useMemo, useCallback } from "react";
import Layout from "./Layout";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { FaPlus } from "react-icons/fa"; // Modified
import { computeIsAdmin } from "../utils/isadmin";

interface FleetVehicle {
  id: string;
  plate: string;
  vehicle: string;
  division: string;
  inService: boolean;
  assignee: string;
  restrictions: string;
}

const divisions = [
  "Patrol",
  "SWAT",
  "K9",
  "CIU",
  "MBU",
  "HEAT",
  "ACU",
  "Training",
  "Patrol [Offroad]",
  "Patrol [Parking]",
];

const Fleet: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isAdmin = computeIsAdmin(currentUser); // Use centralized admin check
  const [fleetData, setFleetData] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<FleetVehicle | null>(
    null
  );
  const [newVehicle, setNewVehicle] = useState<Partial<FleetVehicle> | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDivision, setFilterDivision] = useState("All");
  const [hideOutOfService, setHideOutOfService] = useState(true); // New state

  const fetchFleetData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fleetQuery = query(
        collection(dbFirestore, "fleet"),
        orderBy("plate")
      );
      const querySnapshot = await getDocs(fleetQuery);
      const vehicles = querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
            division:
              doc.data().division === "MOTO" ? "MBU" : doc.data().division, // Treat MOTO as MBU
          } as FleetVehicle)
      );
      setFleetData(vehicles);
    } catch (err) {
      console.error("Error fetching fleet data:", err);
      setError(
        `Failed to load fleet data: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFleetData();
  }, [fetchFleetData]);

  const filteredFleet = useMemo(() => {
    return fleetData.filter((vehicle) => {
      const divisionMatch =
        filterDivision === "All" || vehicle.division === filterDivision;
      const searchMatch =
        !searchTerm ||
        vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.assignee.toLowerCase().includes(searchTerm.toLowerCase());
      const inServiceMatch = hideOutOfService ? vehicle.inService : true;
      return divisionMatch && searchMatch && inServiceMatch;
    });
  }, [fleetData, filterDivision, searchTerm, hideOutOfService]);

  const handleSaveVehicle = async () => {
    if (!editingVehicle?.id) return;
    const vehicleRef = doc(dbFirestore, "fleet", editingVehicle.id);
    const { id, ...updateData } = editingVehicle;
    try {
      await updateDoc(vehicleRef, updateData);
      setEditingVehicle(null);
      // Refresh fleet data after update
      fetchFleetData();
    } catch (error) {
      console.error("Error saving vehicle:", error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleAddVehicle = async () => {
    if (!newVehicle) return;
    try {
      const vehicleRef = collection(dbFirestore, "fleet");
      await addDoc(vehicleRef, newVehicle);
      setNewVehicle(null);
      // Refresh fleet data after adding
      fetchFleetData();
    } catch (error) {
      console.error("Error adding vehicle:", error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!window.confirm("Are you sure you want to delete this vehicle?"))
      return;
    try {
      const vehicleRef = doc(dbFirestore, "fleet", vehicleId);
      await deleteDoc(vehicleRef);
      // Refresh fleet data after deletion
      fetchFleetData();
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const openAddVehicleForm = () => {
    if (!isAdmin) return;
    setNewVehicle({
      plate: "",
      vehicle: "",
      division: "Patrol",
      inService: true,
      assignee: "COMMUNAL",
      restrictions: "",
    });
  };

  return (
    <Layout>
      <div className="page-content p-6 text-white min-h-screen">
        <h1 className="text-3xl font-bold mb-6 text-[#f3c700]">
          Fleet Management
        </h1>

        <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
          <input
            type="text"
            placeholder="Search Plate, Vehicle, Assignee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input flex-grow bg-gray-900 border-gray-700 text-white focus:border-[#f3c700] focus:ring-[#f3c700]"
          />
          <select
            value={filterDivision}
            onChange={(e) => setFilterDivision(e.target.value)}
            className="input md:w-auto bg-gray-900 border-gray-700 text-white focus:border-[#f3c700] focus:ring-[#f3c700]"
          >
            <option value="All">All Divisions</option>
            {divisions.map((div) => (
              <option key={div} value={div}>
                {div}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-yellow-400 bg-black bg-opacity-90 p-2 rounded">
            <input
              type="checkbox"
              checked={hideOutOfService}
              onChange={(e) => setHideOutOfService(e.target.checked)}
              className="form-checkbox h-4 w-4 text-[#f3c700] bg-gray-700 border-gray-600 rounded focus:ring-[#f3c700]"
            />
            Hide Out-of-Service Vehicles
          </label>
          {isAdmin && (
            <button
              className="button-primary flex items-center gap-2 px-4 py-2"
              onClick={openAddVehicleForm}
            >
              <FaPlus /> Add Vehicle
            </button>
          )}
        </div>

        {loading && (
          <p className="text-center text-yellow-400">Loading fleet data...</p>
        )}
        {error && <p className="text-center text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto custom-scrollbar shadow-lg border border-gray-800 rounded">
            <table className="min-w-full border-collapse text-sm text-center bg-black bg-opacity-80">
              <thead className="bg-black text-[#f3c700]">
                <tr>
                  <th className="p-3">Status</th>
                  <th className="p-3">Plate</th>
                  <th className="p-3">Vehicle</th>
                  <th className="p-3">Division</th>
                  <th className="p-3">Assignee</th>
                  <th className="p-3">Restrictions</th>
                  {isAdmin && (
                    <th className="p-2 border border-gray-800 text-center font-semibold">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {filteredFleet.length > 0 ? (
                  filteredFleet.map((vehicle) => (
                    <tr
                      key={vehicle.id}
                      className="border-t border-gray-800 hover:bg-gray-900/90"
                    >
                      <td className="p-3 align-middle">
                        <span
                          className={`inline-block w-3 h-3 rounded-full ${
                            vehicle.inService ? "bg-green-500" : "bg-red-500"
                          }`}
                          title={
                            vehicle.inService ? "In Service" : "Out of Service"
                          }
                        ></span>
                      </td>
                      <td className="p-3 font-mono">{vehicle.plate}</td>
                      <td className="p-3">{vehicle.vehicle}</td>
                      <td className="p-3">{vehicle.division}</td>
                      <td className="p-3">{vehicle.assignee}</td>
                      <td className="p-3">{vehicle.restrictions || "-"}</td>
                      {isAdmin && (
                        <td className="p-2 border border-gray-800 text-center">
                          <button
                            onClick={() => setEditingVehicle(vehicle)}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-xs py-1 px-2 rounded"
                            title="Edit Vehicle"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteVehicle(vehicle.id)}
                            className="bg-red-600 hover:bg-red-500 text-white text-xs py-1 px-2 rounded ml-2"
                            title="Delete Vehicle"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={isAdmin ? 7 : 6}
                      className="text-center p-4 text-gray-500 italic"
                    >
                      No vehicles found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {editingVehicle && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
              <h2 className="text-xl font-bold text-yellow-400 mb-4">
                Edit Vehicle: {editingVehicle.plate}
              </h2>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Plate
              </label>
              <input
                type="text"
                placeholder="Plate"
                className="input bg-gray-700 border-gray-600 text-white mb-3 w-full"
                value={editingVehicle.plate}
                onChange={(e) =>
                  setEditingVehicle((prev) =>
                    prev
                      ? { ...prev, plate: e.target.value.toUpperCase() }
                      : null
                  )
                }
              />
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Vehicle Model
              </label>
              <input
                type="text"
                placeholder="Vehicle Model"
                className="input bg-gray-700 border-gray-600 text-white mb-3 w-full"
                value={editingVehicle.vehicle}
                onChange={(e) =>
                  setEditingVehicle((prev) =>
                    prev ? { ...prev, vehicle: e.target.value } : null
                  )
                }
              />
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Division
              </label>
              <select
                className="input bg-gray-700 border-gray-600 text-white mb-3 w-full"
                value={editingVehicle.division}
                onChange={(e) =>
                  setEditingVehicle((prev) =>
                    prev ? { ...prev, division: e.target.value } : null
                  )
                }
              >
                {divisions.map((div) => (
                  <option key={div} value={div}>
                    {div}
                  </option>
                ))}
              </select>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Assignee (Name or COMMUNAL)
              </label>
              <input
                type="text"
                placeholder="Assignee Name or COMMUNAL"
                className="input bg-gray-700 border-gray-600 text-white mb-3 w-full"
                value={editingVehicle.assignee}
                onChange={(e) =>
                  setEditingVehicle((prev) =>
                    prev ? { ...prev, assignee: e.target.value } : null
                  )
                }
              />
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Restrictions
              </label>
              <textarea
                placeholder="Restrictions (e.g., Supervisor, HEAT, MOTO)"
                className="input bg-gray-700 border-gray-600 text-white mb-3 w-full text-sm"
                rows={2}
                value={editingVehicle.restrictions}
                onChange={(e) =>
                  setEditingVehicle((prev) =>
                    prev ? { ...prev, restrictions: e.target.value } : null
                  )
                }
              />
              <label className="flex items-center gap-2 text-gray-300 mb-4">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-500 bg-gray-600 text-yellow-500 focus:ring-yellow-500"
                  checked={editingVehicle.inService}
                  onChange={(e) =>
                    setEditingVehicle((prev) =>
                      prev ? { ...prev, inService: e.target.checked } : null
                    )
                  }
                />
                In Service
              </label>
              <div className="flex justify-end gap-4">
                <button
                  className="button-secondary px-4 py-2"
                  onClick={() => setEditingVehicle(null)}
                >
                  Cancel
                </button>
                <button
                  className="button-primary px-4 py-2"
                  onClick={handleSaveVehicle}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {newVehicle && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
              <h2 className="text-xl font-bold text-yellow-400 mb-4">
                Add New Vehicle
              </h2>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Plate
              </label>
              <input
                type="text"
                placeholder="Plate"
                className="input bg-gray-700 border-gray-600 text-white mb-3 w-full"
                value={newVehicle.plate || ""}
                onChange={(e) =>
                  setNewVehicle((prev) =>
                    prev
                      ? { ...prev, plate: e.target.value.toUpperCase() }
                      : null
                  )
                }
              />
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Vehicle Model
              </label>
              <input
                type="text"
                placeholder="Vehicle Model"
                className="input bg-gray-700 border-gray-600 text-white mb-3 w-full"
                value={newVehicle.vehicle || ""}
                onChange={(e) =>
                  setNewVehicle((prev) =>
                    prev ? { ...prev, vehicle: e.target.value } : null
                  )
                }
              />
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Division
              </label>
              <select
                className="input bg-gray-700 border-gray-600 text-white mb-3 w-full"
                value={newVehicle.division || "Patrol"}
                onChange={(e) =>
                  setNewVehicle((prev) =>
                    prev ? { ...prev, division: e.target.value } : null
                  )
                }
              >
                {divisions.map((div) => (
                  <option key={div} value={div}>
                    {div}
                  </option>
                ))}
              </select>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Assignee
              </label>
              <input
                type="text"
                placeholder="Assignee Name or COMMUNAL"
                className="input bg-gray-700 border-gray-600 text-white mb-3 w-full"
                value={newVehicle.assignee || "COMMUNAL"}
                onChange={(e) =>
                  setNewVehicle((prev) =>
                    prev ? { ...prev, assignee: e.target.value } : null
                  )
                }
              />
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Restrictions
              </label>
              <textarea
                placeholder="Restrictions (e.g., Supervisor, HEAT)"
                className="input bg-gray-700 border-gray-600 text-white mb-3 w-full text-sm"
                rows={2}
                value={newVehicle.restrictions || ""}
                onChange={(e) =>
                  setNewVehicle((prev) =>
                    prev ? { ...prev, restrictions: e.target.value } : null
                  )
                }
              />
              <label className="flex items-center gap-2 text-gray-300 mb-4">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-500 bg-gray-600 text-yellow-500 focus:ring-yellow-500"
                  checked={newVehicle.inService ?? true}
                  onChange={(e) =>
                    setNewVehicle((prev) =>
                      prev ? { ...prev, inService: e.target.checked } : null
                    )
                  }
                />
                In Service
              </label>
              <div className="flex justify-end gap-4">
                <button
                  className="button-secondary px-4 py-2"
                  onClick={() => setNewVehicle(null)}
                >
                  Cancel
                </button>
                <button
                  className="button-primary px-4 py-2"
                  onClick={handleAddVehicle}
                >
                  Add Vehicle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Fleet;
