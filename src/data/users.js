import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { getDatabase, ref, update } from "firebase/database"; // Import Firebase database functions

// Function to listen for real-time updates to users from Firestore
export const listenToUsers = (callback) => {
  const usersRef = collection(db, "users");
  return onSnapshot(usersRef, (snapshot) => {
    const users = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(users);
  });
};

/**
 * Utility function to check if a user has admin privileges.
 * @param {string} rank - The rank of the user.
 * @param {boolean} isAdmin - Whether the user has admin privileges.
 * @returns {boolean} - True if the user has admin privileges, false otherwise.
 */
export const hasAdminPrivileges = (rank, isAdmin) => {
  const adminRanks = ["Staff Sergeant", "SSgt.", "Commander", "Commissioner"];
  return isAdmin || adminRanks.includes(rank);
};

/**
 * Assign a task to a user in Firebase.
 * @param {string} userId - The unique identifier for the user (e.g., CID or email).
 * @param {object} task - The task object to assign.
 */
export const assignTask = async (userId, task) => {
  const db = getDatabase();
  const userTasksRef = ref(db, `users/${userId}/tasks`);
  try {
    await update(userTasksRef, {
      [task.id]: task, // Use task ID as the key
    });
    console.log(`Task assigned to user ${userId}:`, task);
  } catch (error) {
    console.error("Error assigning task:", error);
  }
};
