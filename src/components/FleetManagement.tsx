import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { User as AuthUser } from "../types/User";

interface FleetVehicle {
  id: string; // Document ID (same as plate)
  plate: string;
  vehicle: string;
  division: string;
  assignee: string;
  restrictions: string;
  inService: boolean;
}

// Function to process and group fleet data
const processFleetData = (
  vehiclesData: FleetVehicle[]
): {
  sortedFleet: FleetVehicle[];
  groupedFleet: { [division: string]: FleetVehicle[] };
} => {
  // Sort primarily by division, then by plate
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

const FleetManagement: React.FC<{ user: AuthUser }> = ({ user }) => {
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);
  const [groupedFleet, setGroupedFleet] = useState<{
    [division: string]: FleetVehicle[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<FleetVehicle | null>(
    null
  );
  const [showAddVehicleForm, setShowAddVehicleForm] = useState(false);
  const [newVehicle, setNewVehicle] = useState<Partial<FleetVehicle>>({
    plate: "",
    vehicle: "",
    division: "Patrol",
    assignee: "COMMUNAL",
    restrictions: "",
    inService: true,
  });
  const [addVehicleError, setAddVehicleError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFleet = async () => {
      setLoading(true);
      setError(null);
      try {
        const fleetSnapshot = await getDocs(collection(dbFirestore, "fleet"));
        const vehiclesData = fleetSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id, // Use Firestore document ID
            plate: data.plate || doc.id, // Fallback to ID if plate field missing
            vehicle: data.vehicle || "Unknown Vehicle",
            division: data.division || "Unknown Division",
            assignee: data.assignee || "N/A",
            restrictions: data.restrictions || "",
            inService: data.inService !== undefined ? data.inService : true,
          } as FleetVehicle;
        });

        const { sortedFleet, groupedFleet: processedGroupedFleet } =
          processFleetData(vehiclesData);
        setFleet(sortedFleet);
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

  const handleEditChange = (field: keyof FleetVehicle, value: any) => {
    if (!editingVehicle) return;
    // Prevent editing plate directly in the form if it's the ID
    if (field === "plate") return;
    setEditingVehicle((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const saveVehicleChanges = async () => {
    if (!editingVehicle) return;

    const vehicleDocRef = doc(dbFirestore, "fleet", editingVehicle.id); // Use ID which should be the plate

    // Prepare data, exclude id and plate (as plate is the ID)
    const { id, plate, ...dataToUpdate } = editingVehicle;

    try {
      await updateDoc(vehicleDocRef, dataToUpdate);

      const updatedFleetList = fleet.map((v) =>
        v.id === editingVehicle.id ? editingVehicle : v
      );
      const { sortedFleet, groupedFleet: updatedGroupedFleet } =
        processFleetData(updatedFleetList);
      setFleet(sortedFleet);
      setGroupedFleet(updatedGroupedFleet);

      setEditingVehicle(null);
    } catch (err) {
      console.error("Error updating vehicle:", err);
      alert(
        `Failed to save changes. Error: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  const handleNewVehicleChange = (field: keyof FleetVehicle, value: any) => {
    setNewVehicle((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddNewVehicle = async () => {
    setAddVehicleError(null);
    if (!newVehicle.plate || !newVehicle.vehicle || !newVehicle.division) {
      setAddVehicleError("Plate, Vehicle, and Division are required.");
      return;
    }
    // Consider adding validation for plate format if needed

    const vehicleDocRef = doc(dbFirestore, "fleet", newVehicle.plate); // Use plate as the document ID

    const { id, ...dataToAdd } = {
      // Ensure id isn't accidentally included
      ...newVehicle,
      // Ensure boolean is set correctly
      inService:
        newVehicle.inService !== undefined ? newVehicle.inService : true,
    };

    try {
      await setDoc(vehicleDocRef, dataToAdd);

      const addedVehicle: FleetVehicle = {
        id: newVehicle.plate, // ID is the plate
        plate: newVehicle.plate,
        vehicle: dataToAdd.vehicle || "Unknown Vehicle",
        division: dataToAdd.division || "Unknown Division",
        assignee: dataToAdd.assignee || "N/A",
        restrictions: dataToAdd.restrictions || "",
        inService: dataToAdd.inService,
      };

      const updatedFleetList = [...fleet, addedVehicle];
      const { sortedFleet, groupedFleet: updatedGroupedFleet } =
        processFleetData(updatedFleetList);
      setFleet(sortedFleet);
      setGroupedFleet(updatedGroupedFleet);

      setNewVehicle({
        plate: "",
        vehicle: "",
        division: "Patrol",
        assignee: "COMMUNAL",
        restrictions: "",
        inService: true,
      });
      setShowAddVehicleForm(false);
      alert("Vehicle added successfully!");
    } catch (err) {
      console.error("Error adding vehicle:", err);
      setAddVehicleError(
        `Failed to add vehicle. Error: ${
          err instanceof Error ? err.message : String(err)
        }. Does a vehicle with this plate already exist?`
      );
    }
  };

  return (
    <Layout user={user}>
      <div className="page-content space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-[#f3c700]">
            Fleet Management
          </h1>
          <button
            className="button-primary text-sm px-3 py-1.5"
            onClick={() => setShowAddVehicleForm(!showAddVehicleForm)}
          >
            {showAddVehicleForm ? "Cancel Add" : "Add Vehicle"}
          </button>
        </div>

        {showAddVehicleForm && (
          <div className="admin-section p-4 mb-6">
            <h2 className="section-header text-xl mb-3">Add New Vehicle</h2>
            {addVehicleError && (
              <p className="text-red-500 mb-3 text-sm">{addVehicleError}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Plate (ID)"
                value={newVehicle.plate || ""}
                onChange={(e) =>
                  handleNewVehicleChange("plate", e.target.value.toUpperCase())
                } // Force uppercase
                className="input text-sm"
                required
              />
              <input
                type="text"
                placeholder="Vehicle Model"
                value={newVehicle.vehicle || ""}
                onChange={(e) =>
                  handleNewVehicleChange("vehicle", e.target.value)
                }
                className="input text-sm"
                required
              />
              <input
                type="text"
                placeholder="Division"
                value={newVehicle.division || ""}
                onChange={(e) =>
                  handleNewVehicleChange("division", e.target.value)
                }
                className="input text-sm"
                required
              />
              <input
                type="text"
                placeholder="Assignee"
                value={newVehicle.assignee || ""}
                onChange={(e) =>
                  handleNewVehicleChange("assignee", e.target.value)
                }
                className="input text-sm"
              />
              <input
                type="text"
                placeholder="Restrictions"
                value={newVehicle.restrictions || ""}
                onChange={(e) =>
                  handleNewVehicleChange("restrictions", e.target.value)
                }
                className="input text-sm"
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="newInService"
                  checked={!!newVehicle.inService}
                  onChange={(e) =>
                    handleNewVehicleChange("inService", e.target.checked)
                  }
                  className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="newInService" className="text-sm text-gray-300">
                  In Service
                </label>
              </div>
            </div>
            <button
              className="button-primary text-sm px-3 py-1.5 mt-4"
              onClick={handleAddNewVehicle}
            >
              Save New Vehicle
            </button>
          </div>
        )}

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
                  <th className="p-2">Actions</th>
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
                          }`}
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
                          {editingVehicle?.id === v.id ? (
                            <>
                              {/* Edit Mode */}
                              <td className="p-1 border-r border-gray-600 font-mono">
                                {v.plate}
                              </td>{" "}
                              {/* Plate not editable */}
                              <td className="p-1 border-r border-gray-600">
                                <input
                                  type="text"
                                  value={editingVehicle.vehicle}
                                  onChange={(e) =>
                                    handleEditChange("vehicle", e.target.value)
                                  }
                                  className="input-table"
                                />
                              </td>
                              <td className="p-1 border-r border-gray-600">
                                <input
                                  type="text"
                                  value={editingVehicle.assignee}
                                  onChange={(e) =>
                                    handleEditChange("assignee", e.target.value)
                                  }
                                  className="input-table"
                                />
                              </td>
                              <td className="p-1 border-r border-gray-600">
                                <input
                                  type="text"
                                  value={editingVehicle.restrictions}
                                  onChange={(e) =>
                                    handleEditChange(
                                      "restrictions",
                                      e.target.value
                                    )
                                  }
                                  className="input-table"
                                />
                              </td>
                              <td className="p-1 border-r border-gray-600 text-center">
                                <input
                                  type="checkbox"
                                  checked={!!editingVehicle.inService}
                                  onChange={(e) =>
                                    handleEditChange(
                                      "inService",
                                      e.target.checked
                                    )
                                  }
                                  className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                />
                              </td>
                              <td className="p-1 flex gap-1">
                                <button
                                  onClick={saveVehicleChanges}
                                  className="button-primary text-xs px-1 py-0.5"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingVehicle(null)}
                                  className="button-secondary text-xs px-1 py-0.5"
                                >
                                  Cancel
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              {/* View Mode */}
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
                              <td className="p-2">
                                <button
                                  onClick={() => setEditingVehicle(v)}
                                  className="button-secondary text-xs px-1 py-0.5"
                                >
                                  Edit
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  ) : null
              )}
            </table>
          </div>
        )}
      </div>
      {/* Reusing styles from RosterManagement */}
      <style>{`
        .input-table { background-color: #374151; color: white; border: 1px solid #4b5563; border-radius: 4px; padding: 2px 4px; width: 100%; min-width: 80px; font-size: 0.875rem; }
        .form-checkbox { display: inline-block; vertical-align: middle; }
        .category-vertical { writing-mode: vertical-lr; text-orientation: mixed; white-space: nowrap; transform: rotate(180deg); padding: 8px 4px; }
      `}</style>
    </Layout>
  );
};

export default FleetManagement;
