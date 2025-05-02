import { Timestamp } from 'firebase/firestore'; // Ensure Timestamp is imported

// Define SizePresetKey type (copy from DepartmentChatPopup if not already globally defined)
const sizePresets = {
  Small: { listWidth: 280, chatWidth: 380, height: 500 },
  Medium: { listWidth: 340, chatWidth: 450, height: 600 },
  Large: { listWidth: 400, chatWidth: 550, height: 700 },
  'Extra Large': { listWidth: 450, chatWidth: 650, height: 800 },
};
export type SizePresetKey = keyof typeof sizePresets;


// -----------------------------
// 🔐 Certification Types
// -----------------------------
export type CertStatus = "CERT" | "LEAD" | "SUPER" | "TRAIN" | null;

// -----------------------------
// 📋 Task Interface (Subcollection: /users/:id/tasks)
// -----------------------------
export interface UserTask {
  id: string; // Firestore document ID
  task: string; // Description of the task
  type: "goal" | "normal"; // Task type
  issuedby: string; // Name of the issuer
  issueddate: string; // Date string (e.g., "MM/DD/YYYY") - Consider using Timestamp if precision is needed
  issuedtime: string; // Time string (e.g., "HH:MM AM/PM") - Consider merging with issueddate into a Timestamp
  progress?: number; // Optional: Only for 'goal' type
  completed: boolean; // Completion status
  goal?: number; // Optional: Goal target for 'goal' type
  archived: boolean; // Archived status
  startDate?: string | null; // Optional start date (YYYY-MM-DD)
  dueDate?: string | null; // Optional due date (YYYY-MM-DD)
}

// -----------------------------
// ⚖️ Discipline Entry Interface (Subcollection: /users/:id/discipline)
// -----------------------------
export interface DisciplineEntry {
  id: string; // Firestore document ID
  type: "written warning" | "verbal warning" | "suspension" | "strike"; // Discipline type
  disciplinenotes: string; // Details of the disciplinary action
  issuedby: string; // Name of the issuer
  issueddate: string; // Date string
  issuedtime: string; // Time string
}

// -----------------------------
// 📝 Note Entry Interface (Subcollection: /users/:id/notes)
// -----------------------------
export interface NoteEntry {
  id: string; // Firestore document ID
  note: string; // Content of the note
  issuedby: string; // Name of the issuer
  issueddate: string; // Date string
  issuedtime: string; // Time string
}

// -----------------------------
// 📢 Bulletin Entry Interface (Collection: /bulletins)
// -----------------------------
export interface BulletinEntry {
  id: string; // Firestore document ID (Auto-generated)
  title: string; // Title of the bulletin
  content: string; // Content of the bulletin
  createdAt: Timestamp; // Firestore timestamp
  postedByName: string; // Name of the user who posted the bulletin
  postedByRank: string; // Rank of the user who posted the bulletin
}

// -----------------------------
// 📢 FTO Announcement Interface (Collection: /ftoAnnouncements)
// -----------------------------
export interface FTOAnnouncement {
  id: string; // Firestore document ID
  title: string;
  content: string; // HTML content from TipTap
  authorName: string;
  authorRank: string;
  createdAt: Timestamp;
}

// -----------------------------
// 🔓 Authenticated User (from AuthContext/Firebase Auth)
// -----------------------------
export interface User {
  uid: string; // Firebase Auth UID
  email: string | null; // Can be null from Auth
  displayName?: string | null; // Firebase Auth display name
  photoURL?: string | null; // Add photoURL if not already present

  // --- Fields merged from Firestore '/users' doc ---
  id?: string; // Firestore doc ID (usually email or name)
  name?: string; // User's full name from Firestore
  rank?: string;
  badge?: string;
  callsign?: string;
  role?: string;
  cid?: string;
  certifications?: { [key: string]: CertStatus };
  isActive?: boolean;
  isAdmin?: boolean; // Calculated based on role/rank
  isPlaceholder?: boolean;
  joinDate?: string | Timestamp | null;
  lastPromotionDate?: string | Timestamp | null;
  loaStartDate?: string | Timestamp | null;
  loaEndDate?: string | Timestamp | null;
  discordId?: string;
  category?: string | null;
  lastSignInTime?: Timestamp | string | null; // Last sign-in time from Firebase Auth
  hiddenChats?: Set<string>; // Set of chat IDs to hide
  hiddenChats_department?: Set<string>; // Set of department IDs to hide
  hiddenChats_ciu?: Set<string>; // Set of CIU IDs to hide
  isCIU?: boolean; // Add isCIU property
  isCadet?: boolean; // Add isCadet property
  isFTOqualified?: boolean; // Add isFTOqualified property
  isFTO?: boolean; // Add isFTO property
  isFTOCadet?: boolean; // Add isFTOCadet property
  canAccessCIU?: boolean; // Optional property for CIU access
  permissions?: string[]; // Add the permissions property
  // Add chat settings structure
  chatSettings?: {
      department?: {
          fontSizePercent?: number;
          sizePreset?: SizePresetKey;
      };
      // Add other contexts like 'ciu' here if needed later
  };
}

// -----------------------------
// 🧑‍✈️ Full Firestore User Document (Collection: /users)
// -----------------------------
export interface RosterUser {
  id: string; // Same as email (doc ID)
  name: string;
  rank: string;
  badge?: string;
  callsign?: string;
  certifications?: { [key: string]: CertStatus };
  isActive?: boolean;
  discordId?: string;
  cid?: string; // Character ID?
  email?: string; // Often the same as id
  joinDate?: string | Timestamp | null;
  lastPromotionDate?: string | Timestamp | null;
  loaStartDate?: string | Timestamp | null;
  loaEndDate?: string | Timestamp | null;
  tasks?: UserTask[]; // Populated in AdminMenu/Home
  disciplineEntries?: DisciplineEntry[]; // Populated in AdminMenu/Home
  generalNotes?: NoteEntry[]; // Populated in AdminMenu/Home
  isPlaceholder?: boolean; // For template entries
  category?: string | null; // UI grouping (High Command, etc.)
  role?: string; // e.g., 'admin', 'user'
  isAdmin?: boolean; // derived/calculated field
  assignedVehicleId?: string | null; // Assigned vehicle ID (plate)
  photoURL?: string | null; // Add photoURL for consistency
  lastSignInTime?: Timestamp | string | null; // Ensure this exists if used in AdminMenu
  promotionStatus?: {
    votes?: { [voterId: string]: 'Approve' | 'Deny' | 'Needs Time' };
    hideUntil?: Timestamp | null; // Hide card until this time if majority Deny/Needs Time
    lastVoteTimestamp?: Timestamp; // Track when the last vote affecting status occurred
  };
}

// -----------------------------
// 🚓 Fleet Vehicle (Firestore Collection: /fleet)
// -----------------------------
export interface FleetVehicle {
  id: string; // Firestore document ID (usually the plate)
  vehicle: string; // e.g., "2018 Charger"
  plate: string;
  division?: string; // e.g., "Patrol", "SWAT"
  restrictions?: string;
  assignee?: string; // Name of the user or "COMMUNAL"
  inService?: boolean;
  notes?: string;
  lastChecked?: Timestamp | null;
  lastCheckedBy?: string;
}

// -----------------------------
// 📝 FTO Cadet Note Interface (Collection: /ftoCadetNotes)
// -----------------------------
export interface FTOCadetNote {
  id: string; // Firestore document ID
  cadetId: string; // ID of the cadet the note is for
  cadetName: string; // Name of the cadet
  ftoId: string; // ID of the FTO who wrote the note
  ftoName: string; // Name of the FTO
  ftoRank: string; // Rank of the FTO
  note: string; // Content of the note
  createdAt: Timestamp; // Firestore timestamp
}

// -----------------------------
// ✨ Firestore User with Details (Extended RosterUser for components like AdminMenu)
// -----------------------------
export interface FirestoreUserWithDetails extends RosterUser {
  tasks: UserTask[];
  generalNotes: NoteEntry[];
  disciplineEntries: DisciplineEntry[];
  displayName?: string; // Add displayName if used in AdminMenu rendering
}
