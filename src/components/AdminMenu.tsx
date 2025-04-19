import React, { useState, useEffect, useMemo, useCallback, JSX } from "react";
import { NavLink } from "react-router-dom";
import Layout from "./Layout";
import {
  collection,
  getDocs,
  writeBatch,
  query,
  orderBy,
  doc,
  deleteDoc,
  addDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import { formatIssuedAt } from "../utils/timeHelpers";
import { getRandomBackgroundImage } from "../utils/backgroundImage";
import { FaEdit, FaTrash } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { RosterUser, DisciplineEntry, NoteEntry } from "../types/User";
import EditUserModal from "./EditUserModal";
import { UserTask } from "../types/User";
import { toast } from "react-toastify";
import ConfirmationModal from "./ConfirmationModal";

// NEW HELPER to combine issueddate and issuedtime:
const getAssignedAt = (task: UserTask): string => {
  const combined = `${task.issueddate} ${task.issuedtime}`;
  const date = new Date(combined);
  return isNaN(date.getTime()) ? combined : date.toLocaleString();
};

const formatDateForDisplay = (dateValue: string | null | undefined): string => {
  if (!dateValue) return "N/A";
  const parsedDate = new Date(dateValue);
  if (!isNaN(parsedDate.getTime())) {
    return `${parsedDate.getMonth() + 1}/${parsedDate.getDate()}/${
      parsedDate.getFullYear() % 100
    }`;
  }
  return dateValue; // Return the original string if parsing fails
};

const convertToString = (
  value: string | Timestamp | null | undefined
): string => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString().split("T")[0]; // Convert to YYYY-MM-DD format
  }
  return value || "N/A"; // Default to "N/A" if null or undefined
};

interface FirestoreUserWithDetails extends RosterUser {
  tasks: UserTask[];
  disciplineEntries: DisciplineEntry[];
  generalNotes: NoteEntry[];
}

const availableRanks = [
  "Cadet",
  "Trooper",
  "Trooper First Class",
  "Corporal",
  "Sergeant",
  "Staff Sergeant",
  "Lieutenant",
  "Captain",
  "Commander",
  "Assistant Commissioner",
  "Deputy Commissioner",
  "Commissioner",
];

const getCurrentDateTimeStrings = () => {
  const now = new Date();
  const date = now.toLocaleDateString();
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date, time };
};

export default function AdminMenu(): JSX.Element {
  const { user: currentUser } = useAuth();
  const [usersData, setUsersData] = useState<FirestoreUserWithDetails[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkTaskDescription, setBulkTaskDescription] = useState("");
  const [bulkTaskType, setBulkTaskType] = useState<"goal" | "normal">("normal");
  const [bulkTaskGoal, setBulkTaskGoal] = useState<number>(0);
  const [isAssigning, setIsAssigning] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [selectedUsersByName, setSelectedUsersByName] = useState<
    { value: string; label: string }[]
  >([]);
  const [editingUser, setEditingUser] =
    useState<FirestoreUserWithDetails | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<{
    show: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [isAssignTaskOpen, setIsAssignTaskOpen] = useState(false);
  const [selectedRank, setSelectedRank] = useState<string | null>(null);
  const [taskDescription, setTaskDescription] = useState("");
  const [editingTask, setEditingTask] = useState<{
    userId: string;
    task: UserTask;
  } | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<{
    userId: string;
    taskId: string;
  } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<string>("");

  const handleRankSelection = (rank: string) => {
    setSelectedRank(rank);
    const usersInRank = usersData
      .filter((user) => user.rank === rank)
      .map((user) => user.email);
    setSelectedUsers(
      usersInRank.filter((email): email is string => email !== undefined)
    );
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );

    // Ensure selectedUserId is set to the first selected user
    setSelectedUserId((prev) =>
      selectedUsers.includes(userId) ? null : userId
    );
  };

  const handleAssignTask = async () => {
    console.log("Selected Users:", selectedUsers);
    console.log("Task Description (newTask):", newTask);

    if (selectedUsers.length === 0) {
      toast.error("Please select at least one user.");
      return;
    }

    if (!newTask || newTask.trim() === "") {
      console.error("Task description is empty or whitespace.");
      toast.error("Task description cannot be empty.");
      return;
    }

    try {
      const { date, time } = getCurrentDateTimeStrings();

      const newTaskData: Omit<UserTask, "id"> = {
        task: newTask.trim(),
        type: bulkTaskType,
        issuedby: currentUser?.name || "System",
        issueddate: date,
        issuedtime: time,
        completed: false,
        progress: 0,
        ...(bulkTaskType === "goal" ? { goal: bulkTaskGoal } : {}),
      };

      const batch = writeBatch(dbFirestore);

      selectedUsers.forEach((userId) => {
        const userTasksRef = collection(dbFirestore, "users", userId, "tasks");
        const newTaskRef = doc(userTasksRef);
        batch.set(newTaskRef, newTaskData);
      });

      await batch.commit();

      // Update local state
      setUsersData((prevUsers) =>
        prevUsers.map((user) =>
          selectedUsers.includes(user.id)
            ? {
                ...user,
                tasks: [
                  ...user.tasks,
                  {
                    ...newTaskData,
                    id: Date.now().toString(), // Generate a unique ID for local state
                  },
                ],
              }
            : user
        )
      );

      toast.success(`Task assigned to ${selectedUsers.length} user(s).`);
      setNewTask(""); // Clear the task input field
      setBulkTaskGoal(0); // Reset goal input
      setBulkTaskType("normal"); // Reset task type
    } catch (error) {
      console.error("Error assigning task:", error);
      toast.error("Failed to assign task.");
    }
  };

  const handleClearSelections = () => {
    setSelectedRank(null);
    setSelectedUsers([]);
    setTaskDescription("");
    setBulkTaskType("normal"); // Reset task type to default
  };

  useEffect(() => {
    setBackgroundImage(getRandomBackgroundImage());
  }, []);

  const fetchAdminData = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
      const usersPromises = usersSnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data() as Partial<RosterUser>;
        const userEmail = userDoc.id;
        if (!userEmail) {
          console.error("User email missing");
          return null;
        }
        const name =
          typeof userData.name === "string" ? userData.name : "Unknown";

        const tasksSnapshot = await getDocs(
          query(
            collection(dbFirestore, "users", userEmail, "tasks"),
            orderBy("issueddate", "desc")
          )
        );
        const tasks = tasksSnapshot.docs
          .map((taskDoc) => {
            const data = taskDoc.data();
            if (
              typeof data.task === "string" &&
              (data.type === "goal" || data.type === "normal") &&
              typeof data.issuedby === "string" &&
              typeof data.issueddate === "string" &&
              typeof data.issuedtime === "string" &&
              typeof data.completed === "boolean" &&
              (data.type === "goal" ? typeof data.progress === "number" : true)
            ) {
              return {
                id: taskDoc.id,
                task: data.task,
                type: data.type,
                issuedby: data.issuedby,
                issueddate: data.issueddate,
                issuedtime: data.issuedtime,
                progress: data.progress,
                completed: data.completed,
                goal: data.goal,
              } as UserTask;
            }
            return null;
          })
          .filter((task): task is UserTask => task !== null);

        const disciplineSnapshot = await getDocs(
          query(
            collection(dbFirestore, "users", userEmail, "discipline"),
            orderBy("issueddate", "desc")
          )
        );
        const disciplineEntries = disciplineSnapshot.docs
          .map((entryDoc) => {
            const data = entryDoc.data();
            if (
              typeof data.type === "string" &&
              typeof data.disciplinenotes === "string" &&
              typeof data.issuedby === "string" &&
              typeof data.issueddate === "string" &&
              typeof data.issuedtime === "string"
            ) {
              return {
                id: entryDoc.id,
                type: data.type,
                disciplinenotes: data.disciplinenotes,
                issuedby: data.issuedby,
                issueddate: data.issueddate,
                issuedtime: data.issuedtime,
              } as DisciplineEntry;
            }
            return null;
          })
          .filter((entry): entry is DisciplineEntry => entry !== null);

        const notesSnapshot = await getDocs(
          query(
            collection(dbFirestore, "users", userEmail, "notes"),
            orderBy("issueddate", "desc")
          )
        );
        const generalNotes = notesSnapshot.docs
          .map((noteDoc) => {
            const data = noteDoc.data();
            if (
              typeof data.note === "string" &&
              typeof data.issuedby === "string" &&
              typeof data.issueddate === "string" &&
              typeof data.issuedtime === "string"
            ) {
              return {
                id: noteDoc.id,
                note: data.note,
                issuedby: data.issuedby,
                issueddate: data.issueddate,
                issuedtime: data.issuedtime,
              } as NoteEntry;
            }
            return null;
          })
          .filter((note): note is NoteEntry => note !== null);

        return {
          id: userEmail,
          email: userEmail,
          name: name,
          rank: userData.rank || "Unranked",
          badge: userData.badge || "N/A",
          callsign: userData.callsign || "",
          isActive: userData.isActive ?? true,
          discordId: userData.discordId || "-",
          cid: userData.cid,
          joinDate: userData.joinDate || null,
          lastPromotionDate: userData.lastPromotionDate || null,
          loaStartDate: userData.loaStartDate || null,
          loaEndDate: userData.loaEndDate || null,
          certifications: userData.certifications || {},
          role: userData.role,
          isPlaceholder: userData.isPlaceholder ?? false,
          category: userData.category,
          assignedVehicleId: userData.assignedVehicleId,
          tasks: tasks,
          disciplineEntries: disciplineEntries,
          generalNotes: generalNotes,
          isAdmin:
            userData.role?.toLowerCase() === "admin" ||
            availableRanks
              .slice(availableRanks.indexOf("Lieutenant"))
              .map((r) => r.toLowerCase())
              .includes(userData.rank?.toLowerCase() || ""),
          displayName: name,
        } as FirestoreUserWithDetails;
      });

      const resolvedUsersData = await Promise.all(usersPromises);
      setUsersData(
        resolvedUsersData.filter(
          (user) => user !== null
        ) as FirestoreUserWithDetails[]
      );
    } catch (error) {
      console.error("Error fetching admin data:", error);
      setUsersError("Failed to load user, task, or discipline data.");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const handleRoleSelectionChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const rank = event.target.value;
    const isChecked = event.target.checked;
    setSelectedRoles((prev) =>
      isChecked ? [...prev, rank] : prev.filter((r) => r !== rank)
    );
    const userEmailsInRank = usersData
      .filter((u) => u.rank === rank && u.email)
      .map((u) => u.email!);
    setSelectedUsers((prev) => {
      const currentSet = new Set(prev);
      if (isChecked) {
        userEmailsInRank.forEach((email) => currentSet.add(email));
      } else {
        userEmailsInRank.forEach((email) => currentSet.delete(email));
      }
      return Array.from(currentSet);
    });
  };

  const handleUserByNameSelectionChange = (
    selectedOptions: readonly { value: string; label: string }[] | null
  ) => {
    const selectedEmails = selectedOptions
      ? selectedOptions.map((o) => o.value)
      : [];
    setSelectedUsersByName(selectedOptions ? [...selectedOptions] : []);
    setSelectedUsers((prev) => {
      const currentSet = new Set(prev);
      selectedEmails.forEach((email) => currentSet.add(email));
      return Array.from(currentSet);
    });
  };

  const removeUserFromSelection = (userEmailToRemove: string) => {
    setSelectedUsers((prev) =>
      prev.filter((email) => email !== userEmailToRemove)
    );
    setSelectedUsersByName((prev) =>
      prev.filter((u) => u.value !== userEmailToRemove)
    );
  };

  const clearUserSelection = () => {
    setSelectedUsers([]);
    setSelectedRoles([]);
    setSelectedUsersByName([]);
  };

  const handleBulkAssignTask = async () => {
    if (selectedUsers.length === 0) {
      toast.error("Please select at least one user or role.");
      return;
    }
    if (!bulkTaskDescription.trim()) {
      toast.error("Task description cannot be empty.");
      return;
    }
    if (bulkTaskType === "goal" && bulkTaskGoal <= 0) {
      toast.error("Goal must be greater than 0 for goal tasks.");
      return;
    }
    if (!currentUser?.email) {
      toast.error("User email missing.");
      return;
    }
    setIsAssigning(true);

    try {
      const batch = writeBatch(dbFirestore);
      const { date, time } = getCurrentDateTimeStrings();

      const taskData: Omit<UserTask, "id"> = {
        task: bulkTaskDescription.trim(),
        type: bulkTaskType,
        ...(bulkTaskType === "goal" && { goal: bulkTaskGoal }),
        progress: 0,
        completed: false,
        issuedby: currentUser!.name || currentUser!.email,
        issueddate: date,
        issuedtime: time,
      };

      selectedUsers.forEach((userEmail) => {
        if (!userEmail) {
          console.warn("Skipping task assignment for undefined user email.");
          return;
        }
        const userTasksRef = collection(
          dbFirestore,
          "users",
          userEmail,
          "tasks"
        );
        const newTaskRef = doc(userTasksRef);
        batch.set(newTaskRef, taskData);
      });

      await batch.commit();
      toast.success(`Task assigned to ${selectedUsers.length} user(s).`);
      fetchAdminData();
      clearUserSelection();
      setBulkTaskDescription("");
      setBulkTaskType("normal");
      setBulkTaskGoal(0);
    } catch (error) {
      console.error("Error assigning task:", error);
      toast.error("Failed to assign task.");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDeleteTask = async (
    userEmail: string | undefined,
    taskId: string
  ) => {
    if (!userEmail) {
      console.error("User email is missing.");
      toast.error("User email is missing.");
      return;
    }
    setTaskToDelete({ userId: userEmail, taskId });
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      const taskRef = doc(
        dbFirestore,
        "users",
        taskToDelete.userId,
        "tasks",
        taskToDelete.taskId
      );
      await deleteDoc(taskRef);
      setUsersData((prev) =>
        prev.map((user) =>
          user.id === taskToDelete.userId
            ? {
                ...user,
                tasks: user.tasks.filter(
                  (task) => task.id !== taskToDelete.taskId
                ),
              }
            : user
        )
      );
      toast.success("Task deleted successfully.");
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task.");
    } finally {
      setTaskToDelete(null);
      setIsConfirmModalOpen(false);
    }
  };

  const handleEditTask = () => {
    if (!editingTask || !editingTask.task.task.trim()) {
      toast.error("Task description cannot be empty.");
      return;
    }
    setUsersData((prevUsers) =>
      prevUsers.map((user) =>
        user.id === editingTask.userId
          ? {
              ...user,
              tasks: user.tasks.map((task) =>
                task.id === editingTask.task.id
                  ? { ...task, task: editingTask.task.task }
                  : task
              ),
            }
          : user
      )
    );
    toast.success("Task updated successfully!");
    setEditingTask(null);
  };

  const userOptions = useMemo(() => {
    return [...usersData]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((user) => ({
        value: user.email,
        label: `${user.name} (${user.rank || "N/A"})`,
      }));
  }, [usersData]);

  const selectedUserDisplayNames = useMemo(() => {
    const selectedSet = new Set(selectedUsers);
    return usersData
      .filter((user) => user.email && selectedSet.has(user.email))
      .map((user) => ({ email: user.email!, name: user.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedUsers, usersData]);

  const rankOrder: { [key: string]: number } = {
    Commissioner: 1,
    "Deputy Commissioner": 2,
    "Assistant Commissioner": 3,
    Commander: 4,
    Captain: 5,
    Lieutenant: 6,
    "Staff Sergeant": 7,
    Sergeant: 8,
    Corporal: 9,
    "Trooper First Class": 10,
    Trooper: 11,
    Cadet: 12,
  };

  const sortedUsersData = useMemo(() => {
    return [...usersData].sort((a, b) => {
      const aOrder = rankOrder[a.rank] || Infinity;
      const bOrder = rankOrder[b.rank] || Infinity;
      return aOrder - bOrder;
    });
  }, [usersData]);

  const closeEditUserModal = () => {
    setEditingUser(null);
  };

  return (
    <Layout>
      <div
        className="page-content space-y-6 p-6 text-gray-300 min-h-screen"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Tabs Container */}
        <div className="bg-black/75 text-[#f3c700] font-inter p-4 rounded-lg shadow-lg mb-6">
          <div className="flex space-x-6 border-b border-[#f3c700]">
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium ${
                  isActive
                    ? "text-[#f3c700] border-b-2 border-[#f3c700]"
                    : "text-gray-400 hover:text-[#f3c700]"
                }`
              }
            >
              Admin Menu
            </NavLink>
            <NavLink
              to="/bulletins"
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium ${
                  isActive
                    ? "text-[#f3c700] border-b-2 border-[#f3c700]"
                    : "text-gray-400 hover:text-[#f3c700]"
                }`
              }
            >
              Bulletins
            </NavLink>
          </div>
        </div>
        {/* Assign Task Button */}
        <button
          className="px-4 py-2 bg-[#f3c700] text-black font-bold rounded hover:bg-yellow-300"
          onClick={() => setIsAssignTaskOpen((prev) => !prev)}
        >
          {isAssignTaskOpen ? "Close Assign Task" : "Assign Task"}
        </button>
        {isAssignTaskOpen && (
          <div className="bg-black/70 text-[#f3c700] font-inter p-4 rounded-lg shadow-lg space-y-4">
            <h2 className="text-xl font-bold">Assign Task</h2>
            {/* Task Description */}
            <textarea
              className="w-full p-2 bg-black/80 text-white rounded border border-[#f3c700] text-sm"
              placeholder="Enter task description..."
              value={newTask}
              onChange={(e) => {
                console.log("Task Input Changed:", e.target.value);
                setNewTask(e.target.value);
              }}
            />
            {/* Task Type Selection */}
            <div>
              <label className="block text-sm font-medium text-[#f3c700] mb-2">
                Task Type:
              </label>
              <select
                className="w-full p-2 bg-black/80 text-white rounded border border-[#f3c700] text-sm"
                value={bulkTaskType}
                onChange={(e) =>
                  setBulkTaskType(e.target.value as "goal" | "normal")
                }
              >
                <option value="normal">Normal Task</option>
                <option value="goal">Goal Task</option>
              </select>
            </div>
            {/* Goal Input (conditionally displayed) */}
            {bulkTaskType === "goal" && (
              <div>
                <label className="block text-sm font-medium text-[#f3c700] mb-2">
                  Goal Value:
                </label>
                <input
                  type="number"
                  className="w-full p-2 bg-black/80 text-white rounded border border-[#f3c700] text-sm"
                  placeholder="Enter goal value"
                  value={bulkTaskGoal}
                  onChange={(e) => setBulkTaskGoal(Number(e.target.value))}
                />
              </div>
            )}
            {/* Selected Users */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Selected Users:</h3>
              <div className="grid grid-cols-2 gap-2 bg-black/80 p-3 rounded border border-[#f3c700]">
                {usersData.map((user) => (
                  <label
                    key={user.id}
                    className={`flex items-center space-x-2 p-2 rounded border ${
                      selectedUsers.includes(user.id)
                        ? "bg-[#f3c700] text-black"
                        : "bg-black/90 text-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => handleUserToggle(user.id)}
                      className="h-4 w-4 text-[#f3c700] border-[#f3c700] rounded focus:ring-[#f3c700] bg-black"
                    />
                    <span className="text-sm">{user.name}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <button
                className="px-4 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-500"
                onClick={handleClearSelections}
              >
                Clear Selections
              </button>
              <button
                className="px-4 py-2 bg-[#f3c700] text-black font-bold rounded hover:bg-yellow-300"
                onClick={handleAssignTask}
              >
                Assign Task
              </button>
            </div>
          </div>
        )}
        {/* Users Overview */}
        <div className="admin-section p-6 bg-black bg-opacity-85 rounded-lg shadow-lg border border-[#f3c700]">
          <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700]">
            Users Overview
          </h2>
          {usersLoading && (
            <p className="italic text-gray-400">Loading users...</p>
          )}
          {usersError && <p className="text-red-500">{usersError}</p>}
          {!usersLoading && !usersError && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedUsersData.map((userData) => (
                <div
                  key={userData.id}
                  className="user-card p-3 border border-[#f3c700] rounded-lg flex flex-col bg-black bg-opacity-90 text-white"
                >
                  <div className="flex-grow">
                    <h4 className="font-semibold text-[#f3c700]">
                      {userData.name}
                    </h4>
                    <p className="text-sm text-gray-400">
                      {userData.rank} - Badge: {userData.badge}
                    </p>
                    <p className="text-sm text-gray-400 mb-2">
                      Callsign: {userData.callsign || "N/A"}
                    </p>
                    <p className="text-xs text-gray-500 italic mb-2">
                      {userData.tasks?.length || 0} task(s) assigned.
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                      {userData.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-1.5 rounded border border-[#f3c700] bg-black bg-opacity-90 relative group"
                        >
                          <div className="absolute top-1 right-1 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            {editingTask &&
                            editingTask.userId === userData.id &&
                            editingTask.task.id === task.id ? (
                              <button
                                onClick={handleEditTask}
                                className="button-primary"
                              >
                                Saved
                              </button>
                            ) : (
                              <FaEdit
                                className="text-[#f3c700] hover:text-yellow-300 cursor-pointer h-3 w-3"
                                title="Edit Task"
                                onClick={() =>
                                  setEditingTask({
                                    userId: userData.id,
                                    task,
                                  })
                                }
                              />
                            )}
                            <FaTrash
                              className="text-red-500 hover:text-red-400 cursor-pointer h-3 w-3"
                              title="Delete Task"
                              onClick={() =>
                                handleDeleteTask(userData.email, task.id)
                              }
                            />
                          </div>
                          {editingTask &&
                          editingTask.userId === userData.id &&
                          editingTask.task.id === task.id ? (
                            <input
                              type="text"
                              value={editingTask.task.task}
                              onChange={(e) =>
                                setEditingTask({
                                  userId: userData.id,
                                  task: {
                                    ...editingTask.task,
                                    task: e.target.value,
                                  },
                                })
                              }
                              className="input"
                            />
                          ) : (
                            <p
                              className={`inline text-xs ${
                                task.completed
                                  ? "line-through text-gray-500"
                                  : "text-gray-300"
                              }`}
                            >
                              {task.task}
                            </p>
                          )}
                          <small className="text-gray-400 block mt-1 text-[10px]">
                            Type: {task.type}
                            {task.type === "goal" &&
                              ` | Progress: ${task.progress ?? 0}/${
                                task.goal ?? "N/A"
                              }`}
                            | Status:{" "}
                            {task.completed ? (
                              <span className="text-green-400">Completed</span>
                            ) : (
                              <span className="text-[#f3c700]">
                                In Progress
                              </span>
                            )}
                            | Assigned: {getAssignedAt(task)} | Issued By:{" "}
                            {task.issuedby || "Unknown"}
                          </small>
                        </div>
                      ))}
                      {userData.tasks.length === 0 && (
                        <p className="text-gray-500 italic text-xs">
                          No tasks assigned.
                        </p>
                      )}
                    </div>
                    <h5 className="text-xs text-gray-500 italic mb-1 mt-2 border-t border-[#f3c700] pt-1">
                      Discipline ({userData.disciplineEntries?.length || 0}):
                    </h5>
                    <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar pr-1 text-xs">
                      {userData.disciplineEntries &&
                      userData.disciplineEntries.length > 0 ? (
                        userData.disciplineEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="p-1.5 rounded border border-[#f3c700] bg-black bg-opacity-90"
                          >
                            <p className="text-gray-300 font-medium uppercase text-[10px]">
                              {entry.type}
                            </p>
                            <p className="text-gray-300 truncate">
                              {entry.disciplinenotes}
                            </p>
                            <small className="text-gray-400 block mt-0.5 text-[10px]">
                              By: {entry.issuedby} on{" "}
                              {formatIssuedAt(
                                entry.issueddate,
                                entry.issuedtime
                              )}
                            </small>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 italic">No discipline.</p>
                      )}
                    </div>
                    <h5 className="text-xs text-gray-500 italic mb-1 mt-2 border-t border-[#f3c700] pt-1">
                      Notes ({userData.generalNotes?.length || 0}):
                    </h5>
                    <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar pr-1 text-xs">
                      {userData.generalNotes &&
                      userData.generalNotes.length > 0 ? (
                        userData.generalNotes.map((note) => (
                          <div
                            key={note.id}
                            className="p-1.5 rounded border border-[#f3c700] bg-black bg-opacity-90"
                          >
                            <p className="text-gray-300 font-medium text-[10px]">
                              {note.note}
                            </p>
                            <small className="text-gray-400 block mt-0.5 text-[10px]">
                              By: {note.issuedby} on{" "}
                              {formatIssuedAt(note.issueddate, note.issuedtime)}
                            </small>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 italic">No notes.</p>
                      )}
                    </div>
                  </div>
                  <button
                    className="button-secondary mt-2 text-xs px-3 py-1 self-end"
                    onClick={() => setEditingUser(userData)}
                  >
                    Manage User
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {editingUser && (
          <EditUserModal
            user={{
              ...editingUser,
              badge: editingUser.badge || "N/A",
              callsign: editingUser.callsign || "-",
              discordId: editingUser.discordId || "-",
              certifications: editingUser.certifications || {},
              assignedVehicleId: editingUser.assignedVehicleId || undefined,
              loaStartDate: convertToString(editingUser.loaStartDate),
              loaEndDate: convertToString(editingUser.loaEndDate),
              joinDate: convertToString(editingUser.joinDate),
              lastPromotionDate: convertToString(editingUser.lastPromotionDate),
              isActive: editingUser.isActive ?? true,
              name: editingUser.name || "Unknown",
              rank: editingUser.rank || "Unranked",
              id: editingUser.id || "",
              category: editingUser.category || "Uncategorized",
              cid: editingUser.cid || "Unknown",
              email: editingUser.email || "Unknown",
              role: editingUser.role || "Unknown",
              isPlaceholder: editingUser.isPlaceholder ?? false,
              tasks: editingUser.tasks || [],
              disciplineEntries: editingUser.disciplineEntries || [],
              generalNotes: editingUser.generalNotes || [],
            }}
            onClose={closeEditUserModal}
            onSave={() => {
              fetchAdminData();
              closeEditUserModal();
            }}
          />
        )}
        <ConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={confirmDeleteTask}
          title="Delete Task"
          message="Are you sure you want to delete this task? This action cannot be undone."
        />
      </div>
    </Layout>
  );
}
