import { Timestamp } from "firebase/firestore";

// ... existing types (User, FleetVehicle, RosterUser) ...

export type CertStatus = "TRAIN" | "CERT" | "LEAD" | "SUPER" | "ASSIST";

export interface Task {
  id: string;
  description: string;
  type: "goal" | "normal";
  goal?: number | null;
  progress?: number;
  assignedAt?: Timestamp | string | Date; // Allow multiple types initially
  completed: boolean;
}

export interface DisciplineRecord {
  note: string;
  issuedAt?: Timestamp | Date; // Allow Timestamp or Date
}

export interface Note {
  id: string;
  content: string;
  createdAt: Timestamp | Date; // Allow Timestamp or Date
  author?: string; // Optional: Track who created the note
}

// Update FirestoreUserWithTasks if needed to include discipline/notes directly
// Or rely on fetching them within the modal as implemented above
export interface FirestoreUserWithTasks {
  id: string; // Typically the email or a unique ID
  name: string;
  rank: string;
  badge: string;
  callsign?: string;
  isActive: boolean;
  discordId?: string;
  loaStartDate?: Timestamp | string | null;
  loaEndDate?: Timestamp | string | null;
  certifications?: { [key: string]: "LEAD" | "SUPER" | "CERT" | null };
  joinDate?: Timestamp | string | null;
  lastPromotionDate?: Timestamp | string | null;
  tasks: Task[]; // Keep tasks if passed from AdminMenu, otherwise modal fetches
  discipline?: DisciplineRecord | null; // Optional if fetched in modal
  notes?: Note[]; // Optional if fetched in modal
  assignedVehicleId?: string | null; // Added for consistency
}
