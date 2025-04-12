import { getDatabase, ref, onValue, update } from "firebase/database"; // Import Firebase database functions

// Function to listen for real-time updates to users from Firebase
export const listenToUsers = (callback) => {
  const db = getDatabase();
  const usersRef = ref(db, "users"); // Assuming "users" is the key in your Firebase database
  onValue(usersRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val()); // Pass the updated users data to the callback
    } else {
      console.error("No data available");
      callback([]);
    }
  });
};

/**
 * Utility function to check if a user has admin privileges.
 * @param {string} rank - The rank of the user.
 * @returns {boolean} - True if the user has admin privileges, false otherwise.
 */
export const hasAdminPrivileges = (rank) => {
  const adminRanks = ["Staff Sergeant", "SSgt.", "Commander", "Commissioner"];
  return adminRanks.includes(rank);
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
