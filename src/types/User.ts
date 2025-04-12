import { Timestamp } from "firebase/firestore";

export interface Task {
  id: string;
  description: string;
  assignedAt: string | Timestamp; // Allow both for flexibility during fetch/update
  completed: boolean;
  type: "normal" | "goal-oriented";
  category?: "General" | "Tasks for Promotion" | string; // Add category, allow custom strings too
  goal?: number;
  progress?: number;
}

export interface User {
  uid: string; // Firebase Auth UID
  email: string;
  name: string;
  rank: string;
  badge?: string;
  cid?: string;
  isAdmin?: boolean;
  // Roster fields
  callsign?: string;
  certifications?: {
    ACU?: boolean;
    CIU?: boolean;
    K9?: boolean;
    Heat?: boolean;
    MOTO?: boolean;
    FTO?: boolean;
  };
  loaStartDate?: string | Timestamp; // Store as ISO string or Timestamp
  loaEndDate?: string | Timestamp;
  isActive?: boolean; // Default should be true
  discordId?: string;
}

// Interface for discipline/notes entries (can be expanded)
export interface DisciplineNote {
  id: string;
  timestamp: Timestamp;
  entry: string;
  adminName: string; // Record who added the note
}
