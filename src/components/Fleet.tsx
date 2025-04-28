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
import { FaPlus, FaTrash, FaTable, FaThLarge } from "react-icons/fa";
import { computeIsAdmin } from "../utils/isadmin";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { cn } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import FleetCard from "./FleetCard"; // Keep FleetCard import
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";

// Revert the FleetVehicle interface to match Firestore structure
export interface FleetVehicle {
  id: string;
  plate: string; // Single string
  vehicle: string;
  division: string;
  inService: boolean;
  assignee: string; // Can be empty string or name
  restrictions?: string; // Single string, optional
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

// Define the trunk loadout data
const trunkLoadout = [
  { item: "5.56x45", quantity: 250 },
  { item: "Service Pistol Ammo (9mm Default)", quantity: 250 },
  { item: "Empty Evidence Bag", quantity: 100 },
  { item: "12 Gauge", quantity: 50 },
  { item: "Fingerprint Kit", quantity: 25 },
  { item: "Fingerprint Tape", quantity: 25 },
  { item: "Heavy Armor", quantity: 25 },
  { item: "Bean Bag", quantity: 25 },
  { item: "Taser Cartridge", quantity: 25 },
  { item: "Mikrosil", quantity: 10 },
  { item: "DNA Field Swab Kit", quantity: 10 },
  { item: "SASP Barricade", quantity: 10 },
  { item: "Flare", quantity: 10 },
  { item: "Spike Strip", quantity: 5 },
  { item: "Jerry Can", quantity: 4 },
  { item: "Repair Kit (Advanced Preferred)", quantity: 1 },
  { item: "Fire Extinguisher", quantity: 1 },
  { item: "First Aid", quantity: 1 },
];

// Helper function to initialize checklist state
const initializeCheckedState = () => {
  const initialState: { [key: string]: boolean } = {};
  trunkLoadout.forEach(item => {
    initialState[item.item] = false;
  });
  return initialState;
};


const Fleet: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isAdmin = computeIsAdmin(currentUser);
  const [fleetData, setFleetData] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<FleetVehicle | null>(
    null
  );
  const [newVehicles, setNewVehicles] = useState<Partial<FleetVehicle>[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDivision, setFilterDivision] = useState("All");
  const [hideOutOfService, setHideOutOfService] = useState(true);
  const [activeTab, setActiveTab] = useState<"fleet" | "loadout">("fleet"); // State for active tab
  const [checkedItems, setCheckedItems] = useState<{ [key: string]: boolean }>(initializeCheckedState); // State for checklist
  const [viewMode, setViewMode] = useState<"card" | "table">("card"); // Add view mode state, default to 'card'

  const fetchFleetData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fleetQuery = query(
        collection(dbFirestore, "fleet")
        // orderBy("plate") // Or orderBy("vehicle")
      );
      const querySnapshot = await getDocs(fleetQuery);
      const vehicles = querySnapshot.docs.map(
        (doc) => {
          const data = doc.data();
          // Map directly to the reverted interface
          return {
            id: doc.id,
            plate: data.plate || "NO PLATE",
            vehicle: data.vehicle || "Unknown Vehicle",
            division: data.division === "MOTO" ? "MBU" : (data.division || "Unknown Division"),
            inService: data.inService ?? true,
            assignee: data.assignee || "", // Use empty string if undefined/null
            restrictions: data.restrictions || "", // Use empty string if undefined/null
          } as FleetVehicle;
        }
      );
      // Sort after fetching/mapping
      vehicles.sort((a, b) => a.vehicle.localeCompare(b.vehicle));
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
    // Sorting by vehicle name is now done in fetchFleetData or can be kept here
    const sortedData = [...fleetData].sort((a, b) =>
      a.vehicle.localeCompare(b.vehicle)
    );

    // Then, apply the filters
    return sortedData.filter((vehicle) => {
      const divisionMatch =
        filterDivision === "All" || vehicle.division === filterDivision;

      // Update search logic for single plate/assignee/restrictions
      const searchMatch =
        !searchTerm ||
        vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.assignee.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (vehicle.restrictions && vehicle.restrictions.toLowerCase().includes(searchTerm.toLowerCase())); // Search restrictions string

      // Overall vehicle inService status
      const inServiceMatch = hideOutOfService ? vehicle.inService : true;

      return divisionMatch && searchMatch && inServiceMatch;
    });
  }, [fleetData, filterDivision, searchTerm, hideOutOfService]);

  // Keep the memo hook to group filtered data by vehicle model
  const groupedFleetData = useMemo(() => {
    const grouped = new Map<string, FleetVehicle[]>();
    filteredFleet.forEach((vehicle) => {
      const model = vehicle.vehicle;
      if (!grouped.has(model)) {
        grouped.set(model, []);
      }
      grouped.get(model)?.push(vehicle);
    });
    // Sort the map entries by model name for consistent order
    return new Map([...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }, [filteredFleet]);

  const handleSaveVehicle = async () => {
    if (!editingVehicle?.id) return;
    const vehicleRef = doc(dbFirestore, "fleet", editingVehicle.id);
    const { id, ...updateData } = editingVehicle;
    try {
      await updateDoc(vehicleRef, updateData);
      setEditingVehicle(null);
      toast.success("Vehicle data saved successfully!", {
        position: "top-right",
        style: { backgroundColor: "black", color: "#f3c700" },
      });

      fetchFleetData();
    } catch (error) {
      console.error("Error saving vehicle:", error);
      toast.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          position: "top-right",
          style: { backgroundColor: "black", color: "#f3c700" },
        }
      );
    }
  };

  const handleAddVehicles = async () => {
    if (!newVehicles || newVehicles.length === 0) return;

    // Basic validation: Ensure required fields are present for each vehicle
    const validVehicles = newVehicles.filter(
      (vehicle) => vehicle.plate && vehicle.vehicle
    );

    if (validVehicles.length !== newVehicles.length) {
      toast.error("Please fill in Plate and Vehicle Model for all rows.", {
        position: "top-right",
        style: { backgroundColor: "black", color: "#f3c700" },
      });
      return;
    }

    try {
      const vehicleRef = collection(dbFirestore, "fleet");
      // Add each vehicle individually (consider batch writes for large numbers)
      for (const vehicle of validVehicles) {
        await addDoc(vehicleRef, {
          ...vehicle,
          // Ensure defaults if not set
          division: vehicle.division || "Patrol",
          inService: vehicle.inService ?? true,
          assignee: vehicle.assignee || "COMMUNAL",
          restrictions: vehicle.restrictions || "",
        });
      }

      setNewVehicles([]); // Clear the form
      toast.success(
        `${validVehicles.length} vehicle(s) added successfully!`,
        {
          position: "top-right",
          style: { backgroundColor: "black", color: "#f3c700" },
        }
      );

      fetchFleetData(); // Refresh the list
    } catch (error) {
      console.error("Error adding vehicles:", error);
      toast.error(
        `Error adding vehicles: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          position: "top-right",
          style: { backgroundColor: "black", color: "#f3c700" },
        }
      );
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!window.confirm("Are you sure you want to delete this vehicle?"))
      return;
    try {
      const vehicleRef = doc(dbFirestore, "fleet", vehicleId);
      await deleteDoc(vehicleRef);
      toast.success("Vehicle deleted successfully!", {
        position: "top-right",
        style: { backgroundColor: "black", color: "#f3c700" },
      });

      fetchFleetData();
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      toast.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          position: "top-right",
          style: { backgroundColor: "black", color: "#f3c700" },
        }
      );
    }
  };

  const openAddVehicleForm = () => {
    if (!isAdmin) return;
    setNewVehicles([
      {
        plate: "",
        vehicle: "",
        division: "Patrol",
        inService: true,
        assignee: "COMMUNAL",
        restrictions: "",
      },
    ]);
  };

  // Helper function to update a specific vehicle in the newVehicles array
  const handleNewVehicleChange = (
    index: number,
    field: keyof FleetVehicle,
    value: any
  ) => {
    setNewVehicles((prev) =>
      prev.map((vehicle, i) =>
        i === index ? { ...vehicle, [field]: value } : vehicle
      )
    );
  };

  // Helper function to add a new row to the form
  const addNewVehicleRow = () => {
    setNewVehicles((prev) => [
      ...prev,
      {
        plate: "",
        vehicle: "",
        division: "Patrol",
        inService: true,
        assignee: "COMMUNAL",
        restrictions: "",
      },
    ]);
  };

  // Helper function to remove a row from the form
  const removeNewVehicleRow = (index: number) => {
    setNewVehicles((prev) => prev.filter((_, i) => i !== index));
  };

  // Handler for checkbox change
  const handleCheckboxChange = (item: string, checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      setCheckedItems(prev => ({ ...prev, [item]: checked }));
    }
  };

  // Handler for uncheck all button
  const handleUncheckAll = () => {
    setCheckedItems(initializeCheckedState());
  };


  return (
    <Layout>
      <div className="page-content p-6 text-white min-h-screen">
        <h1 className="text-3xl font-bold mb-6 text-[#f3c700]">
          Fleet Management
        </h1>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-700">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("fleet")}
              className={cn(
                "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm",
                activeTab === "fleet"
                  ? "border-[#f3c700] text-[#f3c700]"
                  : "border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500"
              )}
            >
              Fleet List
            </button>
            <button
              onClick={() => setActiveTab("loadout")}
              className={cn(
                "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm",
                activeTab === "loadout"
                  ? "border-[#f3c700] text-[#f3c700]"
                  : "border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500"
              )}
            >
              Trunk Loadout
            </button>
          </nav>
        </div>

        {/* Conditional Content Based on Active Tab */}
        {activeTab === "fleet" && (
          <>
            {/* Filters and View Toggle - Refactored with Shadcn */}
            <div className="flex flex-col md:flex-row gap-3 mb-6 items-center">
              {/* Search Input */}
              <Input
                type="text"
                placeholder="Search Vehicle, Plate, Assignee, Restriction..." // Updated placeholder
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 flex-grow bg-black/80 border-gray-700 text-white focus:border-[#f3c700] focus:ring-[#f3c700]"
              />
              {/* Division Select */}
              <Select
                value={filterDivision}
                onValueChange={(value) => setFilterDivision(value)}
              >
                <SelectTrigger className="h-9 w-full md:w-[180px] bg-black/80 border-gray-700 text-white focus:border-[#f3c700] focus:ring-[#f3c700]">
                  <SelectValue placeholder="Filter Division" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white">
                  <SelectItem value="All" className="focus:bg-gray-700">All Divisions</SelectItem>
                  {divisions.map((div) => (
                    <SelectItem key={div} value={div} className="focus:bg-gray-700">
                      {div}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Hide Out-of-Service Checkbox */}
              <div className="flex items-center space-x-2 bg-black/80 border border-gray-700 rounded px-3 h-9">
                <Checkbox
                  id="hide-oos"
                  checked={hideOutOfService}
                  onCheckedChange={(checked) => setHideOutOfService(Boolean(checked))}
                  className="border-gray-500 data-[state=checked]:bg-[#f3c700] data-[state=checked]:text-black"
                />
                <Label htmlFor="hide-oos" className="text-sm font-medium text-yellow-400 cursor-pointer whitespace-nowrap">
                  Hide OOS
                </Label>
              </div>

              {/* View Toggle Buttons */}
              <div className="flex gap-2 ml-auto">
                 <Button
                    variant={viewMode === 'card' ? 'default' : 'outline'}
                    size="sm" // Keep size consistent or adjust as needed (h-9)
                    onClick={() => setViewMode('card')}
                    className={cn(
                        "flex items-center gap-1 h-9", // Added h-9
                        viewMode === 'card' ? 'bg-[#f3c700] text-black hover:bg-yellow-300' : 'border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-white bg-black/80' // Added bg-black/80 for outline
                    )}
                    title="Card View"
                 >
                    <FaThLarge />
                 </Button>
                 <Button
                    variant={viewMode === 'table' ? 'default' : 'outline'}
                    size="sm" // Keep size consistent or adjust as needed (h-9)
                    onClick={() => setViewMode('table')}
                    className={cn(
                        "flex items-center gap-1 h-9", // Added h-9
                        viewMode === 'table' ? 'bg-[#f3c700] text-black hover:bg-yellow-300' : 'border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-white bg-black/80' // Added bg-black/80 for outline
                    )}
                    title="Table View"
                 >
                    <FaTable />
                 </Button>
              </div>

              {/* Add Vehicle Button */}
              {isAdmin && (
                <Button
                  variant="default" // Use Shadcn Button variant
                  size="sm" // Consistent size (h-9)
                  className="h-9 flex items-center gap-2 px-4 bg-[#f3c700] text-black font-bold hover:bg-yellow-300" // Apply styles
                  onClick={openAddVehicleForm}
                >
                  <FaPlus /> Add Vehicle
                </Button>
              )}
            </div>

            {loading && (
              <p className="text-center text-yellow-400">
                Loading fleet data...
              </p>
            )}
            {error && <p className="text-center text-red-500">{error}</p>}

            {!loading && !error && (
              <>
                {/* Card View - Uses FleetCard with grouped data */}
                {viewMode === 'card' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedFleetData.size > 0 ? (
                      Array.from(groupedFleetData.entries()).map(([modelName, vehicles]) => (
                        <FleetCard
                          key={modelName}
                          modelName={modelName}
                          vehicles={vehicles}
                        />
                      ))
                    ) : (
                      <p className="col-span-full text-center p-4 text-gray-500 italic">
                        No vehicles found matching criteria.
                      </p>
                    )}
                  </div>
                )}

                {/* Table View */}
                {viewMode === 'table' && (
                  <div className="overflow-x-auto custom-scrollbar shadow-lg border border-gray-800 rounded">
                    <table className="min-w-full border-collapse text-sm text-center bg-black bg-opacity-80">
                      <thead className="bg-black text-[#f3c700]">
                        <tr>
                          <th className="p-3 border-r border-gray-700 text-base">Status</th>
                          <th className="p-3 border-r border-gray-700 text-base">Plate</th>
                          <th className="p-3 border-r border-gray-700 text-base">Vehicle</th>
                          <th className="p-3 border-r border-gray-700 text-base">Division</th>
                          <th className="p-3 border-r border-gray-700 text-base">Assignee</th>
                          <th className={`p-3 ${isAdmin ? 'border-r border-gray-700' : ''} text-base`}>Restrictions</th>
                          {isAdmin && (
                            <th className="p-3 text-base">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="text-gray-300">
                        {/* Render filteredFleet directly in table view */}
                        {filteredFleet.length > 0 ? (
                          filteredFleet.map((vehicle) => (
                            <tr
                              key={vehicle.id}
                              className="border-t border-gray-800 hover:bg-gray-900/90"
                            >
                              <td className="p-3 border-r border-gray-700 text-center align-middle">
                                <span
                                  className={`inline-block w-3 h-3 rounded-full ${
                                    vehicle.inService ? "bg-green-500" : "bg-red-500"
                                  }`}
                                  title={
                                    vehicle.inService ? "In Service" : "Out of Service"
                                  }
                                ></span>
                              </td>
                              <td className="p-3 border-r border-gray-700 text-center align-middle font-mono">{vehicle.plate}</td>
                              <td className="p-3 border-r border-gray-700 text-center align-middle">{vehicle.vehicle}</td>
                              <td className="p-3 border-r border-gray-700 text-center align-middle">{vehicle.division}</td>
                              <td className="p-3 border-r border-gray-700 text-center align-middle">{vehicle.assignee || "COMMUNAL"}</td>
                              <td className={`p-3 ${isAdmin ? 'border-r border-gray-700' : ''} text-center align-middle`}>{vehicle.restrictions || "-"}</td>
                              {isAdmin && (
                                <td className="p-2 text-center align-middle">
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
              </>
            )}
          </>
        )}

        {activeTab === "loadout" && (
          // Use Shadcn Card and Table for Trunk Loadout Checklist
          <Card
            className="border-gray-700 text-white"
            style={{ backgroundColor: 'var(--color-secondary)' }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-yellow-400 text-lg font-medium"> {/* Adjusted size */}
                Standard Communal Trunk Loadout Checklist
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUncheckAll}
                className="bg-gray-700 border-gray-600 hover:bg-gray-600 text-yellow-400 hover:text-yellow-300"
              >
                Uncheck All
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700 hover:bg-[var(--color-muted)]">
                    <TableHead className="w-10"></TableHead> {/* Checkbox column */}
                    <TableHead className="text-yellow-400">Item</TableHead>
                    <TableHead className="text-yellow-400 text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trunkLoadout.map((item) => (
                    <TableRow key={item.item} className="border-gray-700 hover:bg-[var(--color-muted)]">
                      <TableCell>
                        <Checkbox
                          id={`check-${item.item}`}
                          checked={checkedItems[item.item]}
                          onCheckedChange={(checked) => handleCheckboxChange(item.item, checked)}
                          className="border-gray-500 data-[state=checked]:bg-yellow-500 data-[state=checked]:text-black"
                        />
                      </TableCell>
                      <TableCell className="font-medium text-gray-300">
                        <label htmlFor={`check-${item.item}`} className="cursor-pointer">
                          {item.item}
                        </label>
                      </TableCell>
                      <TableCell className="text-right text-gray-300">{item.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Modals (Keep outside conditional rendering or ensure they work with tabs) */}
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

        {newVehicles.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            {/* Increase max-w and padding */}
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto custom-scrollbar">
              <h2 className="text-xl font-bold text-yellow-400 mb-6"> {/* Increased mb */}
                Add New Vehicle(s)
              </h2>

              {/* Iterate over newVehicles array to create rows */}
              {newVehicles.map((vehicle, index) => (
                <div
                  key={index}
                  // Increased gap and mb
                  className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-6 border-b border-gray-700 pb-6 items-end"
                >
                  {/* Plate Input */}
                  <div>
                    {/* Increased mb */}
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Plate
                    </label>
                    <input
                      type="text"
                      placeholder="Plate"
                      // Added padding py-2
                      className="input input-sm bg-gray-700 border-gray-600 text-white w-full py-2"
                      value={vehicle.plate || ""}
                      onChange={(e) =>
                        handleNewVehicleChange(
                          index,
                          "plate",
                          e.target.value.toUpperCase()
                        )
                      }
                    />
                  </div>
                  {/* Vehicle Model Input */}
                  <div>
                    {/* Increased mb */}
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Vehicle Model
                    </label>
                    <input
                      type="text"
                      placeholder="Vehicle Model"
                      // Added padding py-2
                      className="input input-sm bg-gray-700 border-gray-600 text-white w-full py-2"
                      value={vehicle.vehicle || ""}
                      onChange={(e) =>
                        handleNewVehicleChange(index, "vehicle", e.target.value)
                      }
                    />
                  </div>
                  {/* Division Select */}
                  <div>
                    {/* Increased mb */}
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Division
                    </label>
                    <select
                      // Added padding py-2
                      className="input input-sm bg-gray-700 border-gray-600 text-white w-full py-2"
                      value={vehicle.division || "Patrol"}
                      onChange={(e) =>
                        handleNewVehicleChange(index, "division", e.target.value)
                      }
                    >
                      {divisions.map((div) => (
                        <option key={div} value={div}>
                          {div}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Assignee Input */}
                  <div>
                    {/* Increased mb */}
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Assignee
                    </label>
                    <input
                      type="text"
                      placeholder="Assignee or COMMUNAL"
                      // Added padding py-2
                      className="input input-sm bg-gray-700 border-gray-600 text-white w-full py-2"
                      value={vehicle.assignee || "COMMUNAL"}
                      onChange={(e) =>
                        handleNewVehicleChange(index, "assignee", e.target.value)
                      }
                    />
                  </div>
                  {/* Restrictions Textarea */}
                  <div className="md:col-span-2">
                    {/* Increased mb */}
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Restrictions
                    </label>
                    <textarea
                      placeholder="Restrictions"
                      // Added padding py-2
                      className="input input-sm bg-gray-700 border-gray-600 text-white w-full text-xs py-2"
                      rows={1} // Keep rows small
                      value={vehicle.restrictions || ""}
                      onChange={(e) =>
                        handleNewVehicleChange(
                          index,
                          "restrictions",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  {/* In Service Checkbox & Remove Button */}
                  {/* Adjusted alignment and spacing */}
                  <div className="flex items-center justify-between h-full pt-4 pb-1">
                    <label className="flex items-center gap-2 text-gray-300 text-sm whitespace-nowrap"> {/* Increased gap and text size */}
                      <input
                        type="checkbox"
                        // Increased size
                        className="h-5 w-5 rounded border-gray-500 bg-gray-600 text-yellow-500 focus:ring-yellow-500"
                        checked={vehicle.inService ?? true}
                        onChange={(e) =>
                          handleNewVehicleChange(
                            index,
                            "inService",
                            e.target.checked
                          )
                        }
                      />
                      In Svc
                    </label>
                    {/* Show remove button only if more than one row exists */}
                    {newVehicles.length > 1 && (
                      <button
                        onClick={() => removeNewVehicleRow(index)}
                        // Added padding for easier clicking
                        className="text-red-500 hover:text-red-400 ml-3 p-1"
                        title="Remove Row"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Action Buttons */}
              {/* Increased mt */}
              <div className="flex justify-between items-center mt-8">
                <button
                  // Adjusted padding/text size
                  className="button-secondary flex items-center gap-2 px-4 py-2 text-base"
                  onClick={addNewVehicleRow}
                >
                  <FaPlus /> Add Row
                </button>
                {/* Increased gap */}
                <div className="flex gap-5">
                  <button
                    className="button-secondary px-4 py-2"
                    onClick={() => setNewVehicles([])} // Clear form on cancel
                  >
                    Cancel
                  </button>
                  <button
                    className="button-primary px-4 py-2"
                    onClick={handleAddVehicles} // Call the updated handler
                  >
                    Add Vehicle(s)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Fleet;
