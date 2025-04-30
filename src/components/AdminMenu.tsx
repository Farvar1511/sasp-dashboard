import React, { useState, useEffect, useMemo, useCallback, JSX } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import Layout from "./Layout";
import {
  collection,
  getDocs,
  writeBatch, 
  query,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
  Timestamp,
  deleteField,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import { formatIssuedAt, isOlderThanDays, formatTimestampDateTime, getCurrentDateTimeStrings } from "../utils/timeHelpers";
import { FaEdit, FaTrash, FaArrowUp, FaEye, FaEyeSlash, FaCheckCircle } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { RosterUser, DisciplineEntry, NoteEntry, UserTask, FirestoreUserWithDetails } from "../types/User";
import EditUserModal from "./EditUserModal";
import AddUserModal from "./AddUserModal"; // Import the new modal
import EditTaskModal from "./EditTaskModal"; // Import the new task modal
import UserCardDetailsTabs from "./UserCardDetailsTabs"; // Import the new tabs component
import { toast } from "react-toastify";
import ConfirmationModal from "./ConfirmationModal";
import { where as firestoreWhere, QueryConstraint } from "firebase/firestore";
import { limit as firestoreLimit } from "firebase/firestore";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion"; // Keep for now if used elsewhere, otherwise remove

export const rankCategories = {
  CADET: "Cadets",
  TROOPER: "State Troopers",
  SUPERVISOR: "Supervisors",
  COMMAND: "Command",
  HIGH_COMMAND: "High Command",
};

const commandPlusRanks = [
  "Lieutenant",
  "Captain",
  "Commander",
  "Assistant Commissioner",
  "Deputy Commissioner",
  "Commissioner",
].map(rank => rank.toLowerCase());

const highCommandRanks = [
  "Assistant Commissioner",
  "Deputy Commissioner",
  "Commissioner",
].map(rank => rank.toLowerCase());

const needsHighCommandVoteRanks = [
  "Corporal",
  "Sergeant",
  "Staff Sergeant",
  "Lieutenant",
].map(rank => rank.toLowerCase());

const eligibleVoterRanks = [
  "Sergeant",
  "Staff Sergeant",
  "Lieutenant",
  "Captain",
  "Commander",
  "Assistant Commissioner",
  "Deputy Commissioner",
  "Commissioner",
].map(rank => rank.toLowerCase());

export const getRankCategory = (rank: string): keyof typeof rankCategories | null => {
  const lowerRank = rank.toLowerCase();
  if (lowerRank === "cadet") return "CADET";
  if (["trooper", "trooper first class", "corporal"].includes(lowerRank))
    return "TROOPER";
  if (["sergeant", "staff sergeant"].includes(lowerRank)) return "SUPERVISOR";
  if (["lieutenant", "captain", "commander"].includes(lowerRank)) return "COMMAND";
  if (
    ["assistant commissioner", "deputy commissioner", "commissioner"].includes(
      lowerRank
    )
  )
    return "HIGH_COMMAND";
  return null;
};

const convertToString = (
  value: string | Timestamp | Date | null | undefined
): string => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString().split("T")[0];
  } else if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  return value || "";
};

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

const filterOptions = {
  ALL: "All Ranks",
  ...rankCategories,
  ...Object.fromEntries(availableRanks.map((rank) => [rank, rank])),
};

const assignTaskFilterOptions = {
  SELECT: "-- Select by Rank/Category --",
  ALL: "All Users",
  ...rankCategories,
  ...Object.fromEntries(availableRanks.map((rank) => [rank, rank])),
};

// Helper function to get rank abbreviation
const getRankAbbreviation = (rank: string): string => {
  const lowerRank = rank.toLowerCase();
  const abbreviations: { [key: string]: string } = {
    commissioner: "Comm.",
    "deputy commissioner": "DComm.",
    "assistant commissioner": "AComm.",
    commander: "Cmdr.",
    captain: "Capt.",
    lieutenant: "Lt.",
    "staff sergeant": "SSgt.",
    sergeant: "Sgt.",
    corporal: "Cpl.",
    "trooper first class": "TFC.",
    trooper: "Tpr.",
    cadet: "Cdt.",
  };
  return abbreviations[lowerRank] || rank; // Fallback to full rank if no abbreviation
};

// Helper function to format issuer name
const formatIssuerName = (rank: string | undefined, name: string | undefined): string => {
  if (!rank || !name) return "Admin"; // Fallback if rank or name is missing

  const rankAbbreviation = getRankAbbreviation(rank);
  const nameParts = name.trim().split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

  if (!firstName) return name; // Fallback to full name if first name is missing

  const firstInitial = firstName.charAt(0).toUpperCase();

  if (!lastName) return `${rankAbbreviation} ${firstInitial}.`; // Format if only first name exists

  return `${rankAbbreviation} ${firstInitial}. ${lastName}`;
};

export default function AdminMenu(): JSX.Element {
  const { user: currentUser } = useAuth(); // Get currentUser
  const location = useLocation();
  // Update state type to use FirestoreUserWithDetails
  const [usersData, setUsersData] = useState<FirestoreUserWithDetails[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkTaskDescription, setBulkTaskDescription] = useState<string>(""); // State for task description
  const [bulkTaskType, setBulkTaskType] = useState<"goal" | "normal">("normal");
  const [bulkTaskGoal, setBulkTaskGoal] = useState<number>(1); // Default goal to 1
  const [isAssigning, setIsAssigning] = useState(false);
  // Update state type to use FirestoreUserWithDetails
  const [editingUser, setEditingUser] = useState<FirestoreUserWithDetails | null>(null);
  const [editingTask, setEditingTask] = useState<(UserTask & { userId: string }) | null>(null); // State for editing task
  const [taskToDelete, setTaskToDelete] = useState<{ userId: string; taskId: string } | null>(null); // State still useful for rendering logic
  const [confirmationModal, setConfirmationModal] = useState<{
    show: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [isAssignTaskOpen, setIsAssignTaskOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"rank" | "name">("rank");
  const [selectedAssignFilter, setSelectedAssignFilter] = useState<string>("SELECT");
  const [showHiddenCards, setShowHiddenCards] = useState<boolean>(false);
  const [showOnlyUsersWithCompletedTasks, setShowOnlyUsersWithCompletedTasks] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); // State for Add User Modal
  const [showInactiveUsers, setShowInactiveUsers] = useState<boolean>(false); // State for showing inactive users - Default to false

  const fetchAdminData = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
      const usersToClearLOA: string[] = []; // Keep track of users needing LOA cleared
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize today's date

      // Helper function to parse LOA dates robustly (can be defined outside or reused)
      const parseLoaDate = (dateValue: string | Timestamp | null | undefined): Date | null => {
        if (!dateValue) return null;
        let date: Date | null = null;
        try {
          if (dateValue instanceof Timestamp) {
            date = dateValue.toDate();
          } else if (typeof dateValue === 'string') {
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
               date = new Date(dateValue + 'T00:00:00');
            } else {
               date = new Date(dateValue);
            }
          }
          if (date && !isNaN(date.getTime())) {
            date.setHours(0, 0, 0, 0);
            return date;
          }
        } catch (e) { console.error("Error parsing LOA date for cleanup check:", dateValue, e); }
        return null;
      };


      const usersPromises = usersSnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data() as Partial<RosterUser & { lastSignInTime?: Timestamp | string | null, promotionStatus?: any, loaStartDate?: any, loaEndDate?: any }>;
        const userEmail = userDoc.id;
        const name = typeof userData.name === "string" ? userData.name : userEmail;

        // --- Check for expired LOA ---
        const endDate = parseLoaDate(userData.loaEndDate);
        if (endDate && endDate < today) {
          // If loaEndDate exists and is in the past, mark for clearing
          usersToClearLOA.push(userEmail);
        }
        // --- End Check ---

        // Fetch tasks - Use 'task' field consistently
        const tasksSnapshot = await getDocs(
          query(
            collection(dbFirestore, "users", userEmail, "tasks"),
            orderBy("issueddate", "desc")
          )
        );
        const tasks = tasksSnapshot.docs.map((taskDoc) => {
          const data = taskDoc.data();
          // Use 'task' field directly, matching UserTask interface
          if (
            typeof data.task === "string" && // Check Firestore field name 'task'
            (data.type === "goal" || data.type === "normal") &&
            typeof data.issuedby === "string" &&
            typeof data.issueddate === "string" &&
            typeof data.issuedtime === "string" &&
            typeof data.completed === "boolean" &&
            (data.type === "goal" ? typeof data.progress === "number" : true) &&
            (data.type === "goal" ? typeof data.goal === "number" : true)
            // No need to explicitly check for 'archived' here, just include it if present
          ) {
            return {
              id: taskDoc.id,
              task: data.task, // Use 'task' field directly
              type: data.type,
              issuedby: data.issuedby,
              issueddate: data.issueddate,
              issuedtime: data.issuedtime,
              progress: data.progress,
              completed: data.completed,
              goal: data.goal,
              archived: data.archived ?? false, // Include archived, default to false
            } as UserTask; // Cast to local UserTask type
          }
          console.warn("Skipping invalid task data:", data);
          return null;
        }).filter((task): task is UserTask => task !== null);

        // Fetch discipline
        const disciplineSnapshot = await getDocs(
          query(
            collection(dbFirestore, "users", userEmail, "discipline"),
            orderBy("issueddate", "desc")
          )
        );
        const disciplineEntries = disciplineSnapshot.docs.map((entryDoc) => {
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
        }).filter((entry): entry is DisciplineEntry => entry !== null);

        // Fetch notes
        const notesSnapshot = await getDocs(
          query(
            collection(dbFirestore, "users", userEmail, "notes"),
            orderBy("issueddate", "desc")
          )
        );
        const generalNotes = notesSnapshot.docs.map((noteDoc) => {
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
        }).filter((note): note is NoteEntry => note !== null);

        return {
          id: userEmail,
          email: userData.email || "", // Store email if present, else empty
          name: name,
          rank: userData.rank || "Unranked",
          badge: userData.badge || "N/A",
          callsign: userData.callsign || "",
          isActive: userData.isActive ?? true,
          discordId: userData.discordId || "-",
          cid: userData.cid || "", // Ensure cid is handled
          joinDate: userData.joinDate || null,
          lastPromotionDate: userData.lastPromotionDate || null,
          loaStartDate: userData.loaStartDate || null, // Ensure these are included
          loaEndDate: userData.loaEndDate || null,
          certifications: userData.certifications || {},
          role: userData.role || "", // Ensure role is handled
          isPlaceholder: userData.isPlaceholder ?? false,
          category: userData.category || null, // Ensure category is handled
          assignedVehicleId: userData.assignedVehicleId || null, // Ensure assignedVehicleId is handled
          tasks: tasks,
          disciplineEntries: disciplineEntries,
          generalNotes: generalNotes,
          lastSignInTime: userData.lastSignInTime || null,
          promotionStatus: userData.promotionStatus || { votes: {} },
          isAdmin:
            userData.role?.toLowerCase() === "admin" ||
            highCommandRanks.includes(userData.rank?.toLowerCase() || ""),
          displayName: name,
        } as FirestoreUserWithDetails;
      });

      const resolvedUsersData = await Promise.all(usersPromises);

      // --- Perform LOA Cleanup ---
      if (usersToClearLOA.length > 0) {
        console.log(`Found ${usersToClearLOA.length} users with expired LOAs. Clearing dates...`);
        const batch = writeBatch(dbFirestore);
        usersToClearLOA.forEach(userId => {
          const userRef = doc(dbFirestore, "users", userId);
          batch.update(userRef, {
            loaStartDate: deleteField(), // Use deleteField() to remove the field
            loaEndDate: deleteField()
          });
        });
        try {
          await batch.commit();
          console.log("Successfully cleared expired LOA dates.");
          // Optionally: Refetch data or update state locally if needed immediately
          // For simplicity, we'll let the next render cycle use the fetched data (which might be slightly stale regarding LOA)
          // Or filter the resolvedUsersData locally before setting state:
          resolvedUsersData.forEach(user => {
              if (usersToClearLOA.includes(user.id)) {
                  user.loaStartDate = null;
                  user.loaEndDate = null;
              }
          });

        } catch (updateError) {
          console.error("Error clearing expired LOA dates:", updateError);
          toast.error("Failed to automatically clear some expired LOA dates.");
        }
      }
      // --- End LOA Cleanup ---


      setUsersData(
        resolvedUsersData.filter(
          (user) => user !== null && !user.isPlaceholder
        ) as FirestoreUserWithDetails[] // Keep cast here as filter might change type slightly
      );
    } catch (error) {
      setUsersError("Failed to load user, task, or discipline data.");
      console.error("Error fetching admin data:", error);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // Effect to update selected users based on the filter dropdown
  useEffect(() => {
    if (selectedAssignFilter === "SELECT") {
      setSelectedUsers([]); // Clear selection if default is chosen
      return;
    }

    let filteredForSelection = [...usersData];

    // Apply isActive filter unless showing inactive
    if (!showInactiveUsers) {
        filteredForSelection = filteredForSelection.filter(user => user.isActive);
    }

    if (selectedAssignFilter !== "ALL") {
      if (Object.keys(rankCategories).includes(selectedAssignFilter)) {
        // Filter by category
        filteredForSelection = filteredForSelection.filter(
          (user) => getRankCategory(user.rank) === selectedAssignFilter
        );
      } else {
        // Filter by specific rank
        filteredForSelection = filteredForSelection.filter(
          (user) => user.rank === selectedAssignFilter
        );
      }
    }
    // If 'ALL', no additional rank/category filtering needed beyond isActive

    setSelectedUsers(filteredForSelection.map(user => user.id));

  }, [selectedAssignFilter, usersData, showInactiveUsers]); // Add showInactiveUsers dependency


  const filteredUsersData = useMemo(() => {
    // Ensure the type used within this function matches the state
    let filtered: FirestoreUserWithDetails[] = [...usersData].sort((a, b) => {
      if (sortBy === "rank") {
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
        const aOrder = rankOrder[a.rank] || Infinity;
        const bOrder = rankOrder[b.rank] || Infinity;
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
      }
      return a.name.localeCompare(b.name);
    });

    if (!showInactiveUsers) {
      filtered = filtered.filter(user => user.isActive); // Filter out inactive users
    }

    if (selectedCategory !== "ALL") {
      if (Object.keys(rankCategories).includes(selectedCategory)) {
        filtered = filtered.filter(
          (user) => getRankCategory(user.rank) === selectedCategory
        );
      } else {
        filtered = filtered.filter((user) => user.rank === selectedCategory);
      }
    }

    if (searchTerm) {
      filtered = filtered.filter((user) =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (!showHiddenCards) {
      const now = Timestamp.now();
      filtered = filtered.filter(user => {
        const hideUntil = user.promotionStatus?.hideUntil;
        return !hideUntil || hideUntil.toMillis() <= now.toMillis();
      });
    }

    if (showOnlyUsersWithCompletedTasks) {
      filtered = filtered.filter(user =>
        user.tasks?.some(task => task.completed) // Check only for completed, ignore archived status
      );
    }

    return filtered;
  }, [usersData, sortBy, selectedCategory, searchTerm, showHiddenCards, showOnlyUsersWithCompletedTasks, showInactiveUsers]); // Add showInactiveUsers to dependency array

  const buttonPrimary =
    "px-4 py-2 bg-[#f3c700] text-black font-bold rounded hover:bg-yellow-300 transition-colors duration-200";
  const buttonSecondary =
    "px-3 py-1 border border-[#f3c700] text-[#f3c700] rounded hover:bg-[#f3c700]/10 transition-colors duration-200 text-xs";
  const buttonDanger =
    "px-4 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-500 transition-colors duration-200";
  const inputStyle =
    "w-full p-2 bg-black/80 text-white rounded border border-[#f3c700] text-sm focus:ring-[#f3c700] focus:border-[#f3c700]";
  const cardBase =
    "p-4 bg-black/80 rounded-lg shadow-lg border border-[#f3c700]/50";
  const textPrimary = "text-white";
  const textSecondary = "text-white/70";
  const textAccent = "text-[#f3c700]";
  const borderAccent = "border-[#f3c700]";

  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleSave = () => {
    // Combined save handler for both modals
    setEditingUser(null); // Close edit modal if open
    setIsAddModalOpen(false); // Close add modal if open
    fetchAdminData(); // Refresh the user list
  };

  const handleAssignTask = async () => {
    if (!bulkTaskDescription.trim()) {
      toast.error("Please enter a task description.");
      return;
    }
    if (selectedUsers.length === 0) {
      toast.error("Please select at least one user.");
      return;
    }
    if (bulkTaskType === "goal" && bulkTaskGoal <= 0) {
      toast.error("Goal value must be greater than 0 for goal tasks.");
      return;
    }

    setIsAssigning(true);
    const { currentDate, currentTime } = getCurrentDateTimeStrings();
    const batch = writeBatch(dbFirestore);
    const issuerName = currentUser?.displayName || currentUser?.name || "Admin";

    selectedUsers.forEach((userId) => {
      const taskRef = doc(collection(dbFirestore, "users", userId, "tasks"));
      const taskData: { [key: string]: any } = {
        task: bulkTaskDescription.trim(),
        type: bulkTaskType,
        issuedby: issuerName,
        issueddate: currentDate,
        issuedtime: currentTime,
        completed: false,
        archived: false, // Initialize archived as false
      };
      if (bulkTaskType === "goal") {
        taskData.goal = bulkTaskGoal;
        taskData.progress = 0;
      }
      batch.set(taskRef, taskData);
    });

    try {
      await batch.commit();
      toast.success(`Task assigned to ${selectedUsers.length} user(s).`);
      setBulkTaskDescription(""); // Still reset the description input state
      setBulkTaskType("normal");
      setBulkTaskGoal(1);
      setSelectedUsers([]);
      setSelectedAssignFilter("SELECT"); // Reset dropdown
      setIsAssignTaskOpen(false); // Optionally close the section
      fetchAdminData(); // Refresh data to show new tasks
    } catch (error) {
      console.error("Error assigning bulk task:", error);
      toast.error("Failed to assign task.");
    } finally {
      setIsAssigning(false);
    }
  };

  // --- Task Edit/Delete/Toggle/Archive Handlers ---
  const handleOpenEditTaskModal = (user: FirestoreUserWithDetails, task: UserTask) => {
    setEditingTask({ ...task, userId: user.id });
  };

  const handleSaveTask = async (userId: string, taskId: string, updatedTaskData: Partial<UserTask>) => {
    const taskRef = doc(dbFirestore, "users", userId, "tasks", taskId);
    const dataToSave: { [key: string]: any } = { ...updatedTaskData };

    // ... existing logic to handle task field and goal/progress ...
    // Ensure archived field is included if present
    if (updatedTaskData.archived !== undefined) {
        dataToSave.archived = updatedTaskData.archived;
    }


    try {
      await updateDoc(taskRef, dataToSave);
      toast.success("Task updated successfully!");
      setEditingTask(null); // Close modal
      fetchAdminData(); // Refresh data
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error(`Failed to update task: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw error; // Re-throw error so modal knows saving failed
    }
  };

  const handleOpenDeleteTaskConfirmation = (userId: string, taskId: string) => {
    setTaskToDelete({ userId, taskId });
    setConfirmationModal({
        show: true,
        message: "Are you sure you want to delete this task? This action cannot be undone.",
        onConfirm: () => handleDeleteTask(userId, taskId),
    });
  };

  const handleDeleteTask = async (userId: string, taskId: string) => {
    const taskRef = doc(dbFirestore, "users", userId, "tasks", taskId);
    try {
        await deleteDoc(taskRef);
        toast.success("Task deleted successfully!");
        fetchAdminData(); // Refresh data
    } catch (error) {
        console.error("Error deleting task:", error);
        toast.error(`Failed to delete task: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
        setConfirmationModal(null);
        setTaskToDelete(null);
    }
 };

 const handleCancelDeleteTask = () => {
    setConfirmationModal(null);
    setTaskToDelete(null);
 };

 const handleToggleTaskCompletion = async (userId: string, taskId: string, currentStatus: boolean) => {
    const taskRef = doc(dbFirestore, "users", userId, "tasks", taskId);
    const newStatus = !currentStatus;

    // Prevent marking goal task complete if progress < goal
    const task = usersData.find(u => u.id === userId)?.tasks.find(t => t.id === taskId);
    if (task?.type === "goal" && newStatus && (task.progress ?? 0) < (task.goal ?? Infinity)) {
        toast.warn("Goal task cannot be marked complete until progress reaches the goal.");
        return;
    }

    try {
      await updateDoc(taskRef, { completed: newStatus });
      toast.success(`Task marked as ${newStatus ? 'complete' : 'incomplete'}.`);
      fetchAdminData(); // Refresh data
    } catch (error) {
      console.error("Error toggling task completion:", error);
      toast.error(`Failed to update task status: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // New handler for archiving tasks
  const handleArchiveTask = async (userId: string, taskId: string, currentArchivedStatus: boolean) => {
    const taskRef = doc(dbFirestore, "users", userId, "tasks", taskId);
    const newArchivedStatus = !currentArchivedStatus;

    try {
      await updateDoc(taskRef, { archived: newArchivedStatus });
      toast.success(`Task ${newArchivedStatus ? 'archived' : 'unarchived'}.`);
      fetchAdminData(); // Refresh data
    } catch (error) {
      console.error("Error archiving/unarchiving task:", error);
      toast.error(`Failed to update task archive status: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };


  return (
    <Layout>
      <div
        className="relative z-10 page-content space-y-6 p-6 text-white/80 min-h-screen"
      >
        <div className="bg-black/75 text-[#f3c700] font-sans p-4 rounded-lg shadow-lg mb-6">
          <h1 className="text-2xl font-bold text-center mb-4">Admin Management</h1>

          <div className="flex space-x-6 border-b border-[#f3c700] mb-6">
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'text-[#f3c700] border-b-2 border-[#f3c700] pointer-events-none'
                    : 'text-white/60 hover:text-[#f3c700]'
                }`
              }
            >
              Admin Menu
            </NavLink>

            <NavLink
              to="/promotions"
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'text-[#f3c700] border-b-2 border-[#f3c700] pointer-events-none'
                    : 'text-white/60 hover:text-[#f3c700]'
                }`
              }
              aria-current={location.pathname === '/promotions' ? 'page' : undefined}
            >
              Promotions
            </NavLink>

            <NavLink
              to="/bulletins"
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'text-[#f3c700] border-b-2 border-[#f3c700] pointer-events-none'
                    : 'text-white/60 hover:text-[#f3c700]'
                }`
              }
              aria-current={location.pathname === '/bulletins' ? 'page' : undefined}
            >
              Bulletins
            </NavLink>
          </div>
        </div>

        {/* Add Trooper Button */}
        <div className="mb-4 flex justify-end">
             <button
                onClick={handleOpenAddModal}
                className={`${buttonPrimary}`}
             >
                Add Trooper
             </button>
        </div>


        {/* Assign Task Section */}
        <button
          className={`${buttonPrimary} mb-4`}
          onClick={() => setIsAssignTaskOpen((prev) => !prev)}
        >
          {isAssignTaskOpen ? "Close Assign Task" : "Assign Task"}
        </button>
        {isAssignTaskOpen && (
          <div className={`${cardBase} space-y-4 mb-6`}>
            <h2 className={`text-xl font-bold ${textAccent}`}>Assign Task</h2>
            <textarea
              className={inputStyle}
              placeholder="Enter task description..."
              value={bulkTaskDescription} // Use description state
              onChange={(e) => setBulkTaskDescription(e.target.value)} // Update description state
            />
            <div>
              <label className={`block text-sm font-medium ${textAccent} mb-2`}>
                Task Type:
              </label>
              <select
                className={inputStyle}
                value={bulkTaskType}
                onChange={(e) => {
                  const newType = e.target.value as "goal" | "normal";
                  setBulkTaskType(newType);
                  if (newType === 'normal') {
                    setBulkTaskGoal(1); // Reset goal if switching to normal
                  }
                }}
              >
                <option value="normal">Normal Task</option>
                <option value="goal">Goal Task</option>
              </select>
            </div>
            {bulkTaskType === "goal" && (
              <div>
                <label
                  className={`block text-sm font-medium ${textAccent} mb-2`}
                >
                  Goal Value:
                </label>
                <input
                  type="number"
                  min="1" // Ensure goal is positive
                  className={inputStyle}
                  placeholder="Enter goal value (e.g., 5)"
                  value={bulkTaskGoal}
                  onChange={(e) => setBulkTaskGoal(Math.max(1, Number(e.target.value)))} // Ensure goal is at least 1
                />
              </div>
            )}
            <div>
              <label className={`block text-sm font-medium ${textAccent} mb-2`}>
                Select Users by Rank/Category:
              </label>
              <select
                className={inputStyle}
                value={selectedAssignFilter}
                onChange={(e) => setSelectedAssignFilter(e.target.value)}
              >
                {Object.entries(assignTaskFilterOptions).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
              {!showInactiveUsers && selectedAssignFilter !== 'SELECT' && (
                <p className="text-xs text-white/50 italic mt-1">
                  Note: Only active users are selected based on the filter above.
                </p>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-white mt-4">
                Selected Users ({selectedUsers.length}):
              </h3>
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 bg-black/80 p-3 rounded ${borderAccent} max-h-60 overflow-y-auto custom-scrollbar`}
              >
                {[...usersData] // Display users based on main data, selection handled by checkbox
                  .filter(user => showInactiveUsers || user.isActive) // Filter based on showInactiveUsers toggle
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((user) => (
                    <label
                      key={user.id}
                      className={`flex items-center space-x-2 p-2 rounded border cursor-pointer transition-colors duration-200 ${
                        selectedUsers.includes(user.id)
                          ? "bg-[#f3c700] text-black border-[#f3c700]"
                          : `bg-black/90 text-white border-white/20 hover:border-[#f3c700]/50`
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => setSelectedUsers((prev) =>
                          prev.includes(user.id)
                            ? prev.filter((id) => id !== user.id)
                            : [...prev, user.id]
                        )}
                        className="h-4 w-4 text-[#f3c700] border-white/30 rounded focus:ring-[#f3c700] bg-black/50 flex-shrink-0"
                      />
                      <span className="text-xs leading-tight">
                        {user.name} <br />
                        <span className="text-[10px] opacity-80">
                          {user.rank} - {user.badge || 'N/A'} {!user.isActive ? '(Inactive)' : ''}
                        </span>
                      </span>
                    </label>
                  ))}
              </div>
            </div>
            <div className="flex justify-between items-center pt-4">
              <button className={buttonDanger} onClick={() => setSelectedUsers([])}>
                Clear Selections
              </button>
              <button
                className={buttonPrimary}
                onClick={handleAssignTask} // Call the new handler
                disabled={isAssigning || selectedUsers.length === 0 || !bulkTaskDescription.trim()} // Disable if assigning, no users, or no description
              >
                {isAssigning ? "Assigning..." : "Assign Task"}
              </button>
            </div>
          </div>
        )}

        {/* Users Overview Section */}
        <div className={`${cardBase}`}>
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4 flex-wrap">
            <h2 className={`section-header text-2xl font-bold ${textAccent} border-none pb-0`}>
              Users Overview
            </h2>
            <div className="flex gap-4 flex-wrap sm:flex-nowrap justify-end items-center w-full sm:w-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "rank" | "name")}
                className={`${inputStyle} max-w-xs sm:max-w-[120px]`}
              >
                <option value="rank">Sort: Rank</option>
                <option value="name">Sort: Name</option>
              </select>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`${inputStyle} max-w-xs sm:max-w-[180px]`}
              >
                {Object.entries(filterOptions).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${inputStyle} max-w-xs sm:max-w-[200px]`}
              />
              <label className="flex items-center gap-2 cursor-pointer text-xs text-white/80 hover:text-white">
                <input
                  type="checkbox"
                  checked={showInactiveUsers}
                  onChange={(e) => setShowInactiveUsers(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#f3c700] focus:ring-[#f3c700] bg-black/50"
                />
                Show Inactive
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-white/80 hover:text-white">
                <input
                  type="checkbox"
                  checked={showHiddenCards}
                  onChange={(e) => setShowHiddenCards(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#f3c700] focus:ring-[#f3c700] bg-black/50"
                />
                {showHiddenCards ? <FaEye size="0.9em"/> : <FaEyeSlash size="0.9em"/>}
                Show Hidden
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-white/80 hover:text-white">
                <input
                  type="checkbox"
                  checked={showOnlyUsersWithCompletedTasks}
                  onChange={(e) => setShowOnlyUsersWithCompletedTasks(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-500 focus:ring-green-500 bg-black/50"
                />
                <FaCheckCircle size="0.9em" className="text-green-500"/>
                Has Completed Tasks
              </label>
            </div>
          </div>
          {usersLoading && (
            <p className="italic text-white/60">Loading users...</p>
          )}
          {usersError && <p className="text-red-500">{usersError}</p>}
          {!usersLoading && !usersError && (
            <>
              {filteredUsersData.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUsersData.map((userData) => {
                    const isCommandPlus = commandPlusRanks.includes(userData.rank.toLowerCase());
                    const eligibleForPromotion = !isCommandPlus && isOlderThanDays(userData.lastPromotionDate, 14);
                    const needsHCVote = needsHighCommandVoteRanks.includes(userData.rank.toLowerCase());

                    const now = Timestamp.now();
                    const isHiddenByRule = userData.promotionStatus?.hideUntil && userData.promotionStatus.hideUntil.toMillis() > now.toMillis();

                    // --- LOA Check ---
                    let isOnLOA = false;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Normalize today's date to midnight for comparison

                    // Helper function to parse LOA dates robustly
                    const parseLoaDate = (dateValue: string | Timestamp | null | undefined): Date | null => {
                      if (!dateValue) return null;
                      let date: Date | null = null;

                      try {
                        if (dateValue instanceof Timestamp) {
                          date = dateValue.toDate();
                        } else if (typeof dateValue === 'string') {
                          // Try parsing common formats - JS Date constructor is quite flexible
                          // Add T00:00:00 for YYYY-MM-DD to hint local time, otherwise let it parse
                          if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                             date = new Date(dateValue + 'T00:00:00');
                          } else {
                             date = new Date(dateValue); // Handles MM/DD/YYYY, M/D/YY etc.
                          }
                        }

                        if (date && !isNaN(date.getTime())) {
                          date.setHours(0, 0, 0, 0); // Normalize to midnight
                          return date;
                        }
                      } catch (e) {
                         console.error("Error during LOA date parsing:", dateValue, e);
                      }

                      // console.warn("Could not parse LOA date:", dateValue); // Optional: Log if parsing failed
                      return null;
                    };

                    const startDate = parseLoaDate(userData.loaStartDate);
                    const endDate = parseLoaDate(userData.loaEndDate);

                    if (startDate && endDate) {
                      // Check if today is within the LOA range (inclusive)
                      if (today >= startDate && today <= endDate) {
                        isOnLOA = true;
                      }
                    }
                    // --- End LOA Check ---


                    function formatDateForDisplay(dateString: string | Timestamp | null | undefined): string {
                      if (!dateString) return "N/A";
                      let date: Date;
                      if (dateString instanceof Timestamp) {
                        date = dateString.toDate();
                      } else {
                        date = new Date(dateString);
                      }
                      if (isNaN(date.getTime())) {
                        return "Invalid Date";
                      }
                      return date.toLocaleDateString(undefined, {
                        year: "numeric", month: "short", day: "numeric",
                      });
                    }

                    // Sort tasks: completed first, then by issue date descending (implicitly handled by initial fetch)
                    const sortedTasks = [...(userData.tasks || [])].sort((a, b) => {
                        if (a.completed === b.completed) return 0;
                        return a.completed ? 1 : -1;
                    });

                    // Define LOA specific styles
                    const loaCardClass = isOnLOA ? 'border-orange-500 bg-orange-900/20' : '';
                    const loaTextClass = isOnLOA ? 'text-orange-400' : '';

                    return (
                      <div
                        key={userData.id}
                        className={`user-card p-3 border ${borderAccent}/50 rounded-lg flex flex-col bg-black/90 text-white shadow-md min-h-[250px] ${isHiddenByRule && showHiddenCards ? 'opacity-70 border-dashed border-orange-500' : ''} ${loaCardClass}`}
                        title={`${isHiddenByRule && showHiddenCards ? `Normally hidden until ${formatTimestampDateTime(userData.promotionStatus?.hideUntil)}` : ''}${isOnLOA ? ' User is currently on LOA' : ''}`}
                      >
                        <div className="flex-grow">
                          {/* ... User Header Info (Name, Rank, Badges etc.) ... */}
                          <div className="flex justify-between items-start mb-1">
                            <h4 className={`font-semibold ${textAccent} ${loaTextClass}`}> {/* Apply LOA text class */}
                              {userData.name}
                            </h4>
                            <div className="flex flex-col items-end gap-1">
                              {/* LOA Badge */}
                              {isOnLOA && (
                                <span className="text-xs text-orange-400 bg-orange-900/60 px-1.5 py-0.5 rounded border border-orange-600 flex items-center gap-1">
                                  On LOA
                                </span>
                              )}
                              {/* Hidden Badge */}
                              {isHiddenByRule && showHiddenCards && (
                                <span className="text-xs text-orange-400 bg-orange-900/60 px-1.5 py-0.5 rounded border border-orange-600 flex items-center gap-1">
                                  <FaEyeSlash size="0.65rem"/> Hidden
                                </span>
                              )}
                              {/* Eligible Badge */}
                              {eligibleForPromotion && !(isHiddenByRule && showHiddenCards) && !isOnLOA && ( // Hide eligibility if on LOA
                                <Link
                                  to={`/promotions?focusUser=${userData.id}`}
                                  className="flex items-center gap-1 text-xs text-green-400 bg-green-900/50 px-1.5 py-0.5 rounded border border-green-600 hover:bg-green-800/50 transition-colors duration-150"
                                  title={`Eligible for Promotion (Last: ${formatDateForDisplay(userData.lastPromotionDate)}) - Click to view in Promotions`}
                                >
                                  <FaArrowUp size="0.65rem" />
                                  <span>Eligible</span>
                                </Link>
                              )}
                              {/* HC Approval Badge */}
                              {eligibleForPromotion && needsHCVote && !(isHiddenByRule && showHiddenCards) && !isOnLOA && ( // Hide HC approval if on LOA
                                <div className="text-xs text-yellow-400/80 italic px-1.5 py-0.5 rounded bg-yellow-900/50 border border-yellow-600/50" title="Promotion to this rank requires High Command review">
                                  Requires HC Approval
                                </div>
                              )}
                            </div>
                          </div>
                          <p className={`text-sm ${textSecondary} ${loaTextClass}`}> {/* Apply LOA text class */}
                            {userData.rank} - {userData.callsign || "N/A"}
                          </p>
                          <p className={`text-sm ${textSecondary} mb-2 ${loaTextClass}`}> {/* Apply LOA text class */}
                            Badge: {userData.badge}
                          </p>

                          {/* Replace Accordion with Tabs Component */}
                          <UserCardDetailsTabs
                              userData={userData}
                              tasks={userData.tasks || []} // Pass all tasks
                              disciplineEntries={userData.disciplineEntries || []}
                              generalNotes={userData.generalNotes || []}
                              onEditTask={handleOpenEditTaskModal}
                              onDeleteTask={handleOpenDeleteTaskConfirmation}
                              onToggleTaskCompletion={handleToggleTaskCompletion}
                              onArchiveTask={handleArchiveTask} // Pass the archive handler
                              textAccent={textAccent}
                              textSecondary={textSecondary}
                          />

                        </div>
                        <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
                          <span className="text-xs text-white/50 italic">
                            Last Signed In: {formatTimestampDateTime(userData.lastSignInTime)}
                          </span>
                          <button
                            className={`${buttonSecondary}`}
                            onClick={() => setEditingUser(userData)}
                          >
                            Manage User
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-white/60 italic text-center py-4">
                  No users found matching the current filters or eligible for display.
                </p>
              )}
            </>
          )}
        </div>

        {/* Edit User Modal */}
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
              email: editingUser.email || "", // Ensure email is handled if empty
              role: editingUser.role || "", // Ensure role is handled
              isPlaceholder: editingUser.isPlaceholder ?? false,
              tasks: editingUser.tasks || [],
              disciplineEntries: editingUser.disciplineEntries || [],
              generalNotes: editingUser.generalNotes || [],
              promotionStatus: editingUser.promotionStatus,
            }}
            onClose={() => setEditingUser(null)}
            onSave={handleSave} // Use combined save handler
          />
        )}

        {/* Add User Modal */}
        {isAddModalOpen && (
          <AddUserModal
            onClose={handleCloseAddModal}
            onSave={handleSave} // Use combined save handler
          />
        )}

        {/* Edit Task Modal */}
        {editingTask && (
            <EditTaskModal
                task={editingTask}
                onClose={() => setEditingTask(null)}
                onSave={handleSaveTask}
            />
        )}

        {/* Confirmation Modal for Task Deletion */}
        {confirmationModal && confirmationModal.show && taskToDelete && (
            <ConfirmationModal
                isOpen={confirmationModal.show}
                title="Confirm Action"
                message={confirmationModal.message}
                onConfirm={confirmationModal.onConfirm}
                onCancel={handleCancelDeleteTask}
                onClose={handleCancelDeleteTask}
                confirmText="Yes, Delete"
                cancelText="Cancel"
            />
        )}

      </div>
    </Layout>
  );
}
/**
 * Wrapper for Firestore's where function to match the expected type.
 */
function where(fieldPath: string, opStr: string, value: any): QueryConstraint {
  return firestoreWhere(fieldPath, opStr as any, value);
}
function limit(count: number): QueryConstraint {
  return firestoreLimit(count);
}

