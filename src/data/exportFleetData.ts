import { collection, getDocs } from "firebase/firestore";
import { db as dbFirestore } from "../firebase";


export interface FleetVehicle {
  id: string;
  plate: string;
  vehicle: string;
  division: string;
  inService: boolean;
  assignee: string;
  restrictions: string;
}

/**
 * Fetches fleet data from Firestore.
 * @returns {Promise<FleetVehicle[]>} A promise that resolves to an array of FleetVehicle objects.
 */
export async function exportFleetData(): Promise<FleetVehicle[]> {
  try {
    const fleetSnapshot = await getDocs(collection(dbFirestore, "fleet"));
    return fleetSnapshot.docs.map((doc) => ({
      id: doc.id,
      plate: doc.data().plate || "",
      vehicle: doc.data().vehicle || "Unknown",
      division: doc.data().division || "Unknown",
      inService: doc.data().inService ?? true,
      assignee: doc.data().assignee || "Unassigned",
      restrictions: doc.data().restrictions || "",
    }));
  } catch (error) {
    console.error("Error fetching fleet data:", error);
    throw new Error("Failed to fetch fleet data.");
  }
}
