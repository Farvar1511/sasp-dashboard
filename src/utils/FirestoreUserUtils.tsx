import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";

/** Certification Status for each key in "certifications" map */
export type CertStatus = "CERT" | "LEAD" | "SUPER" | "TRAIN" | null;

/** A single user task document stored in /users/:email/tasks */
export interface UserTask {
  id: string;
  task: string;
  type: "goal" | "normal";
  issuedby: string;
  issueddate: string;
  issuedtime: string;
  progress?: number;
  completed: boolean;
  goal?: number;
}

/** A single discipline doc from /users/:email/discipline */
export interface DisciplineEntry {
  id: string;
  type: string;
  disciplinenotes: string;
  issuedby: string;
  issueddate: string;
  issuedtime: string;
}

/** A single note doc from /users/:email/notes */
export interface NoteEntry {
  id: string;
  note: string;
  issuedby: string;
  issueddate: string;
  issuedtime: string;
}

/** The main user doc from /users/:email */
export interface RosterUser {
  id: string;
  email?: string;
  name: string;
  rank: string;
  badge?: string;
  callsign?: string;
  category?: string;
  certifications?: { [key: string]: CertStatus };
  loaStartDate?: Timestamp | null;
  loaEndDate?: Timestamp | null;
  joinDate?: Timestamp | null;
  lastPromotionDate?: Timestamp | null;
  isActive?: boolean;
  isPlaceholder?: boolean;
  isadmin?: boolean;
  cid?: string;
  discordId?: string;
  role?: string;
  assignedVehicleId?: string | null;
}

/**
 * Fetch user + subcollections (tasks, discipline, notes) from Firestore,
 * returning them in one combined object.
 */
export async function fetchUserData(email: string) {
  if (!email) {
    throw new Error("Email is required to fetch user data");
  }

  // Fetch main user doc
  const userDocRef = doc(dbFirestore, "users", email);
  const userSnap = await getDoc(userDocRef);
  if (!userSnap.exists()) {
    throw new Error(`No user found in Firestore with doc ID: ${email}`);
  }
  const userData = { id: userSnap.id, ...userSnap.data() } as RosterUser;

  // Fetch tasks subcollection
  const tasksRef = collection(dbFirestore, "users", email, "tasks");
  const tasksSnap = await getDocs(
    query(tasksRef, orderBy("issueddate", "desc"))
  );
  const tasks = tasksSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as UserTask[];

  // Fetch discipline subcollection
  const disciplineRef = collection(dbFirestore, "users", email, "discipline");
  const disciplineSnap = await getDocs(
    query(disciplineRef, orderBy("issueddate", "desc"))
  );
  const discipline = disciplineSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as DisciplineEntry[];

  // Fetch notes subcollection
  const notesRef = collection(dbFirestore, "users", email, "notes");
  const notesSnap = await getDocs(
    query(notesRef, orderBy("issueddate", "desc"))
  );
  const notes = notesSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as NoteEntry[];

  return {
    user: userData,
    tasks,
    discipline,
    notes,
  };
}

/**
 * Convert LOA fields to Firestore Timestamps if stored as strings.
 */
export function convertLOAFieldsToTimestamp(user: RosterUser): RosterUser {
  const updatedUser = { ...user };
  const dateFields = [
    "loaStartDate",
    "loaEndDate",
    "joinDate",
    "lastPromotionDate",
  ] as const;

  dateFields.forEach((field) => {
    const value = updatedUser[field];
    if (typeof value === "string" && value) {
      const date = new Date(`${value}T00:00:00`);
      if (!isNaN(date.getTime())) {
        updatedUser[field] = Timestamp.fromDate(date);
      } else {
        console.warn(
          `Skipping invalid date string "${value}" for field "${field}"`
        );
      }
    }
  });

  return updatedUser;
}
