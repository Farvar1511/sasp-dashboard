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
// Import types from the central location
import { CertStatus, UserTask, DisciplineEntry, NoteEntry, RosterUser } from '../types/User';

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
