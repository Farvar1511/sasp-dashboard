import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { User as AuthUser, Task } from "../types/User";
import { useNavigate } from "react-router-dom";
import { formatDateToShort, formatAssignedAt } from "../utils/timeHelpers"; // Import the helper functions

interface FirestoreUser {
  id: string;
  name: string;
  rank: string;
  badge: string;
  callsign: string;
  certifications: { [key: string]: string | null };
  discordId: string;
  isActive: boolean;
  loaStartDate: string | null;
  loaEndDate: string | null;
  tasks: Task[];
  assignedVehicle?: string | null;
}

interface DisciplineEntry {
  id: string;
  type: "commendation" | "verbal" | "written" | "suspension" | "termination";
  note: string;
  issuedBy: string;
  issuedAt: Timestamp;
}

interface GeneralNoteEntry {
  id: string;
  note: string;
  issuedBy: string;
  issuedAt: Timestamp;
}

interface EditingDisciplineStateModal
  extends Omit<DisciplineEntry, "issuedBy" | "issuedAt"> {}
interface EditingNoteStateModal
  extends Omit<GeneralNoteEntry, "issuedBy" | "issuedAt"> {}

type CertStatus = "LEAD" | "SUPER" | "CERT" | null;

export default function AdminMenu({ user }: { user: AuthUser }) {
  const [allUsersData, setAllUsersData] = useState<FirestoreUser[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<FirestoreUser | null>(null);
  const [editedName, setEditedName] = useState<string>("");
  const [editedRank, setEditedRank] = useState<string>("");
  const [editedBadge, setEditedBadge] = useState<string>("");
  const [editedCallsign, setEditedCallsign] = useState<string>("");
  const [editedDiscordId, setEditedDiscordId] = useState<string>("");
  const [editedIsActive, setEditedIsActive] = useState<boolean>(false);
  const [editedLoaStart, setEditedLoaStart] = useState<string | null>(null);
  const [editedLoaEnd, setEditedLoaEnd] = useState<string | null>(null);
  const [editedCerts, setEditedCerts] = useState<{ [key: string]: CertStatus }>(
    {}
  );
  const [assignedVehicle, setAssignedVehicle] = useState<string | null>(null);

  const [modalDisciplineEntries, setModalDisciplineEntries] = useState<
    DisciplineEntry[]
  >([]);
  const [modalNotesEntries, setModalNotesEntries] = useState<
    GeneralNoteEntry[]
  >([]);
  const [modalTasks, setModalTasks] = useState<Task[]>([]);
  const [modalDataLoading, setModalDataLoading] = useState<boolean>(false);
  const [modalDataError, setModalDataError] = useState<string | null>(null);
  const [showAddDisciplineForm, setShowAddDisciplineForm] = useState(false);
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newDisciplineType, setNewDisciplineType] =
    useState<DisciplineEntry["type"]>("verbal");
  const [newDisciplineNote, setNewDisciplineNote] = useState("");
  const [newGeneralNote, setNewGeneralNote] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskType, setNewTaskType] = useState<"goal" | "normal">("goal");
  const [newTaskGoal, setNewTaskGoal] = useState<number>(0);
  const [editingDiscipline, setEditingDiscipline] =
    useState<EditingDisciplineStateModal | null>(null);
  const [editingNote, setEditingNote] = useState<EditingNoteStateModal | null>(
    null
  );
  const [modalSubmitError, setModalSubmitError] = useState<string | null>(null);

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [fleetData, setFleetData] = useState<
    {
      id: string;
      plate: string;
      vehicle?: string;
      inService?: boolean;
    }[]
  >([]); // Define fleetData state

  const navigate = useNavigate();

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prevSelected) =>
      prevSelected.includes(userId)
        ? prevSelected.filter((id) => id !== userId)
        : [...prevSelected, userId]
    );
  };

  const selectAllUsers = () => {
    const allUserIds = allUsersData.map((user) => user.id);
    setSelectedUsers(allUserIds);
  };

  const clearAllSelections = () => {
    setSelectedUsers([]);
  };

  useEffect(() => {
    const fetchUsersAndTasks = async () => {
      setUsersLoading(true);
      setUsersError(null);
      try {
        const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
        const usersDataPromises = usersSnapshot.docs.map(async (userDoc) => {
          const userData = userDoc.data();
          const userId = userDoc.id;

          const tasksCollectionRef = collection(
            dbFirestore,
            "users",
            userId,
            "tasks"
          );
          const tasksSnapshot = await getDocs(tasksCollectionRef);
          const tasks = tasksSnapshot.docs.map((taskDoc) => ({
            id: taskDoc.id,
            ...taskDoc.data(),
          })) as Task[];

          return {
            id: userId,
            name: userData.name || "Unknown",
            rank: userData.rank || "Unknown",
            badge: userData.badge || "N/A",
            callsign: userData.callsign || "N/A",
            isActive: userData.isActive ?? false,
            discordId: userData.discordId || "N/A",
            loaStartDate: userData.loaStartDate || null,
            loaEndDate: userData.loaEndDate || null,
            certifications: userData.certifications || {},
            tasks: tasks,
            assignedVehicle: userData.assignedVehicle || null,
          };
        });

        const resolvedUsersData = await Promise.all(usersDataPromises);
        setAllUsersData(resolvedUsersData);
      } catch (error) {
        console.error("Error fetching users/tasks from Firestore:", error);
        setUsersError("Failed to load user or task data.");
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsersAndTasks();
  }, []);

  useEffect(() => {
    const fetchFleetData = async () => {
      try {
        const fleetSnapshot = await getDocs(collection(dbFirestore, "fleet"));
        const fleet = fleetSnapshot.docs.map((doc) => ({
          id: doc.id,
          plate: doc.data().plate || "Unknown",
          vehicle: doc.data().vehicle || "Unknown",
          inService: doc.data().inService ?? true, // Default to true if not specified
        }));
        setFleetData(fleet); // Populate fleetData state
      } catch (error) {
        console.error("Error fetching fleet data:", error);
      }
    };

    fetchFleetData();
  }, []);

  const fetchSelectedUserData = useCallback(async () => {
    if (!selectedUser) {
      setModalDisciplineEntries([]);
      setModalNotesEntries([]);
      setModalTasks([]);
      return;
    }

    setModalDataLoading(true);
    setModalDataError(null);
    try {
      const userId = selectedUser.id;

      const disciplineColRef = collection(
        dbFirestore,
        "users",
        userId,
        "discipline"
      );
      const disciplineQuery = query(
        disciplineColRef,
        orderBy("issuedAt", "desc")
      );
      const disciplineSnapshot = await getDocs(disciplineQuery);
      setModalDisciplineEntries(
        disciplineSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as DisciplineEntry[]
      );

      const notesColRef = collection(dbFirestore, "users", userId, "notes");
      const notesQuery = query(notesColRef, orderBy("issuedAt", "desc"));
      const notesSnapshot = await getDocs(notesQuery);
      setModalNotesEntries(
        notesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as GeneralNoteEntry[]
      );

      const tasksColRef = collection(dbFirestore, "users", userId, "tasks");
      const tasksQuery = query(tasksColRef, orderBy("assignedAt", "desc"));
      const tasksSnapshot = await getDocs(tasksQuery);
      setModalTasks(
        tasksSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Task[]
      );
    } catch (error) {
      console.error("Error fetching selected user data:", error);
      setModalDataError("Failed to load records for this user.");
    } finally {
      setModalDataLoading(false);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (selectedUser) {
      fetchSelectedUserData();
      setShowAddDisciplineForm(false);
      setShowAddNoteForm(false);
      setShowAddTaskForm(false);
      setEditingDiscipline(null);
      setEditingNote(null);
      setNewDisciplineNote("");
      setNewGeneralNote("");
      setNewTaskDescription("");
      setModalSubmitError(null);
    } else {
      setModalDisciplineEntries([]);
      setModalNotesEntries([]);
      setModalTasks([]);
    }
  }, [selectedUser, fetchSelectedUserData]);

  const assignTaskToSelectedUser = async () => {
    if (
      !selectedUser ||
      !newTaskDescription.trim() ||
      (newTaskType === "goal" && newTaskGoal <= 0)
    ) {
      setModalSubmitError(
        "Please provide a valid task description and goal (if applicable)."
      );
      return;
    }
    setModalSubmitError(null);

    try {
      const taskData = {
        description: newTaskDescription.trim(),
        goal: newTaskType === "goal" ? newTaskGoal : null,
        progress: 0,
        assignedAt: serverTimestamp(),
        completed: false,
        type: newTaskType,
      };

      const tasksCollectionRef = collection(
        dbFirestore,
        "users",
        selectedUser.id,
        "tasks"
      );
      await addDoc(tasksCollectionRef, taskData);

      alert("Task assigned successfully!");
      setNewTaskDescription("");
      setNewTaskGoal(0);
      setNewTaskType("goal");
      setShowAddTaskForm(false);
      await fetchSelectedUserData();
    } catch (error) {
      console.error("Error assigning task:", error);
      setModalSubmitError("Failed to assign task.");
    }
  };

  const handleSelectUser = (user: FirestoreUser) => {
    setSelectedUser(user);
    setEditedName(user.name);
    setEditedRank(user.rank);
    setEditedBadge(user.badge);
    setEditedCallsign(user.callsign);
    setEditedDiscordId(user.discordId);
    setEditedIsActive(user.isActive);
    setEditedLoaStart(
      user.loaStartDate ? formatDateToShort(new Date(user.loaStartDate)) : null
    );
    setEditedLoaEnd(
      user.loaEndDate ? formatDateToShort(new Date(user.loaEndDate)) : null
    );
    setEditedCerts(
      Object.fromEntries(
        Object.entries(user.certifications || {}).map(([key, value]) => [
          key,
          value === "LEAD" || value === "SUPER" || value === "CERT"
            ? value
            : null,
        ])
      )
    );
    setAssignedVehicle(user.assignedVehicle || null);
  };

  const handleCancelEditUser = () => {
    setSelectedUser(null);
    setEditedName("");
    setEditedRank("");
    setEditedBadge("");
    setEditedCallsign("");
    setEditedDiscordId("");
    setEditedIsActive(true);
    setEditedLoaStart(null);
    setEditedLoaEnd(null);
    setEditedCerts({});
    setAssignedVehicle(null);
  };

  const handleCertChange = (certKey: string, value: CertStatus) => {
    setEditedCerts((prev) => ({
      ...prev,
      [certKey]: value,
    }));
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) {
      alert("No user selected for update.");
      return;
    }

    try {
      const userRef = doc(dbFirestore, "users", selectedUser.id);

      const updateData: Partial<FirestoreUser> = {
        name: editedName.trim(),
        rank: editedRank.trim(),
        badge: editedBadge.trim(),
        callsign: editedCallsign.trim(),
        discordId: editedDiscordId.trim(),
        isActive: editedIsActive,
        loaStartDate: editedLoaStart
          ? new Date(editedLoaStart).toISOString()
          : null,
        loaEndDate: editedLoaEnd ? new Date(editedLoaEnd).toISOString() : null,
        certifications: editedCerts,
        assignedVehicle: assignedVehicle || null,
      };

      await updateDoc(userRef, updateData);

      if (assignedVehicle) {
        const fleetDoc = fleetData.find(
          (vehicle) => vehicle.plate === assignedVehicle
        );
        if (fleetDoc) {
          const fleetRef = doc(dbFirestore, "fleet", fleetDoc.id);
          await updateDoc(fleetRef, { assignee: editedName.trim() });
        }
      }

      setAllUsersData((prevUsers) =>
        prevUsers.map((u) =>
          u.id === selectedUser.id ? { ...u, ...updateData } : u
        )
      );

      setSelectedUser(null);
      alert("Roster data updated successfully!");
    } catch (error) {
      console.error("Error updating user or fleet data:", error);
      alert("Failed to update roster data. Please try again.");
    }
  };

  const handleAddDiscipline = async () => {
    if (!selectedUser || !newDisciplineNote.trim()) {
      setModalSubmitError("Please ensure discipline details are entered.");
      return;
    }
    setModalSubmitError(null);
    try {
      const disciplineColRef = collection(
        dbFirestore,
        "users",
        selectedUser.id,
        "discipline"
      );
      await addDoc(disciplineColRef, {
        type: newDisciplineType,
        note: newDisciplineNote.trim(),
        issuedBy: user.name,
        issuedAt: serverTimestamp(),
      });
      setNewDisciplineNote("");
      setNewDisciplineType("verbal");
      setShowAddDisciplineForm(false);
      await fetchSelectedUserData();
      alert("Discipline entry added!");
    } catch (error) {
      console.error("Error adding discipline entry:", error);
      setModalSubmitError("Failed to add discipline entry.");
    }
  };

  const handleAddNote = async () => {
    if (!selectedUser || !newGeneralNote.trim()) {
      setModalSubmitError("Please ensure a note is entered.");
      return;
    }
    setModalSubmitError(null);
    try {
      const notesColRef = collection(
        dbFirestore,
        "users",
        selectedUser.id,
        "notes"
      );
      await addDoc(notesColRef, {
        note: newGeneralNote.trim(),
        issuedBy: user.name,
        issuedAt: serverTimestamp(),
      });
      setNewGeneralNote("");
      setShowAddNoteForm(false);
      await fetchSelectedUserData();
      alert("General note added!");
    } catch (error) {
      console.error("Error adding general note:", error);
      setModalSubmitError("Failed to add general note.");
    }
  };

  const handleDeleteDiscipline = async (entryId: string) => {
    if (!selectedUser || !window.confirm("Delete this discipline entry?"))
      return;
    try {
      const entryDocRef = doc(
        dbFirestore,
        "users",
        selectedUser.id,
        "discipline",
        entryId
      );
      await deleteDoc(entryDocRef);
      await fetchSelectedUserData();
      alert("Discipline entry deleted.");
    } catch (error) {
      console.error("Error deleting discipline entry:", error);
      alert("Failed to delete discipline entry.");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedUser || !window.confirm("Delete this general note?")) return;
    try {
      const noteDocRef = doc(
        dbFirestore,
        "users",
        selectedUser.id,
        "notes",
        noteId
      );
      await deleteDoc(noteDocRef);
      await fetchSelectedUserData();
      alert("General note deleted.");
    } catch (error) {
      console.error("Error deleting general note:", error);
      alert("Failed to delete general note.");
    }
  };

  const handleStartEditDiscipline = (entry: DisciplineEntry) => {
    setEditingDiscipline({
      id: entry.id,
      type: entry.type,
      note: entry.note,
    });
    setEditingNote(null);
    setShowAddDisciplineForm(false);
    setShowAddNoteForm(false);
  };

  const handleStartEditNote = (entry: GeneralNoteEntry) => {
    setEditingNote({ id: entry.id, note: entry.note });
    setEditingDiscipline(null);
    setShowAddDisciplineForm(false);
    setShowAddNoteForm(false);
  };

  const handleCancelEdit = () => {
    setEditingDiscipline(null);
    setEditingNote(null);
  };

  const handleSaveDisciplineEdit = async () => {
    if (!editingDiscipline || !selectedUser) return;
    const { id, note, type } = editingDiscipline;
    if (!note.trim()) {
      alert("Discipline details cannot be empty.");
      return;
    }
    try {
      const entryDocRef = doc(
        dbFirestore,
        "users",
        selectedUser.id,
        "discipline",
        id
      );
      await updateDoc(entryDocRef, { note: note.trim(), type: type });
      setEditingDiscipline(null);
      await fetchSelectedUserData();
      alert("Discipline entry updated.");
    } catch (error) {
      console.error("Error updating discipline entry:", error);
      alert("Failed to update discipline entry.");
    }
  };

  const handleSaveNoteEdit = async () => {
    if (!editingNote || !selectedUser) return;
    const { id, note } = editingNote;
    if (!note.trim()) {
      alert("Note cannot be empty.");
      return;
    }
    try {
      const noteDocRef = doc(
        dbFirestore,
        "users",
        selectedUser.id,
        "notes",
        id
      );
      await updateDoc(noteDocRef, { note: note.trim() });
      setEditingNote(null);
      await fetchSelectedUserData();
      alert("General note updated.");
    } catch (error) {
      console.error("Error updating general note:", error);
      alert("Failed to update general note.");
    }
  };

  const rankOrder = [
    "1E-1",
    "1E-2",
    "1E-3",
    "2E-1",
    "2E-2",
    "2E-3",
    "3E-1",
    "3E-2",
    "3E-3",
    "Supervisor",
    "Senior Officer",
    "Officer",
    "Cadet",
    "Corporal",
  ];

  const sortedUsersData = [...allUsersData].sort((a, b) => {
    const rankA = rankOrder.indexOf(a.rank);
    const rankB = rankOrder.indexOf(b.rank);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    return a.callsign.localeCompare(b.callsign);
  });

  async function deleteTask(userId: string, taskId: string): Promise<void> {
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    try {
      const taskDocRef = doc(dbFirestore, "users", userId, "tasks", taskId);
      await deleteDoc(taskDocRef);
      alert("Task deleted successfully.");
      await fetchSelectedUserData();
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Failed to delete task. Please try again.");
    }
  }

  function getDisciplineColor(type: string) {
    switch (type) {
      case "commendation":
        return "text-green-400";
      case "verbal":
        return "text-yellow-400";
      case "written":
        return "text-orange-400";
      case "suspension":
        return "text-red-500";
      case "termination":
        return "text-red-700";
      default:
        return "text-gray-400";
    }
  }

  function formatTimestamp(issuedAt: Timestamp): React.ReactNode {
    const date = issuedAt.toDate();
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <Layout>
      <div className="page-content space-y-6">
        <div className="flex flex-wrap gap-4 mb-4">
          <button
            className="button-primary px-3 py-1.5 text-sm"
            onClick={() => navigate("/admin/discipline")}
          >
            Discipline & Notes
          </button>
          <button
            className="button-secondary px-3 py-1.5 text-sm"
            onClick={() => navigate("/admin/roster")}
          >
            Roster Management
          </button>
          <button
            className="button-secondary px-3 py-1.5 text-sm"
            onClick={() => navigate("/admin/fleet")}
          >
            Fleet Management
          </button>
          <button
            className="button-secondary px-3 py-1.5 text-sm"
            onClick={() => navigate("/admin/bulletins")}
          >
            Admin Bulletins
          </button>
        </div>

        <div className="admin-section p-4">
          <h2 className="section-header text-xl mb-3">Users</h2>
          {usersLoading && (
            <p className="text-yellow-400 italic text-sm">Loading users...</p>
          )}
          {usersError && (
            <p className="text-red-500 mb-4 text-sm">{usersError}</p>
          )}
          {!usersLoading && !usersError && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedUsersData.map((userData) => (
                <div
                  key={userData.id}
                  className="user-card p-3 border border-gray-700 rounded-lg bg-gray-900/50 flex flex-col"
                >
                  <div className="flex-grow">
                    <h3 className="text-lg font-semibold text-yellow-400 truncate">
                      {userData.name}{" "}
                      <span className="text-xs text-gray-400">
                        ({userData.rank})
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500 truncate mb-1">
                      Badge: {userData.badge}
                    </p>
                    <p className="text-xs text-gray-500 truncate mb-2">
                      Callsign: {userData.callsign}
                    </p>
                    <p className="text-xs text-gray-500 italic mb-2">
                      {userData.tasks?.length || 0} task(s) assigned.
                    </p>
                    <div className="space-y-2">
                      {userData.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-2 rounded border border-gray-600 bg-gray-700/50"
                        >
                          <p
                            className={`inline ${
                              task.completed ? "line-through text-gray-500" : ""
                            }`}
                          >
                            {task.description}
                          </p>
                          <small className="text-gray-400 block mt-1 text-xs">
                            Type: {task.type}
                            {task.type === "goal-oriented" &&
                              ` | Goal: ${task.goal ?? "N/A"}, Progress: ${
                                task.progress ?? 0
                              }`}
                            | Status:{" "}
                            {task.completed ? (
                              <span className="text-green-400">Completed</span>
                            ) : (
                              <span className="text-yellow-400">
                                In Progress
                              </span>
                            )}
                            | Assigned:{" "}
                            {task.assignedAt
                              ? formatAssignedAt(
                                  task.assignedAt instanceof Timestamp
                                    ? task.assignedAt.toDate()
                                    : new Date(task.assignedAt)
                                )
                              : "N/A"}
                          </small>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    className="button-primary text-xs px-2 py-1 mt-auto"
                    onClick={() => handleSelectUser(userData)}
                  >
                    View / Edit Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedUser && (
          <div className="fixed inset-0 bg-black/80 z-50">
            <div className="absolute top-0 left-0 w-full h-full bg-gray-900 p-8 overflow-hidden">
              <button
                onClick={handleCancelEditUser}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl font-bold z-10"
                title="Close"
              >
                &times;
              </button>

              <h2 className="text-3xl font-bold mb-8 text-yellow-400">
                Manage User: {selectedUser.name} ({selectedUser.badge})
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                <div className="lg:col-span-1 space-y-6">
                  <h3 className="text-2xl font-semibold text-yellow-300 border-b border-gray-700 pb-4 mb-6">
                    Roster Info
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-400">
                      Name
                    </label>
                    <input
                      type="text"
                      className="input text-sm"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400">
                      Rank
                    </label>
                    <input
                      type="text"
                      className="input text-sm"
                      value={editedRank}
                      onChange={(e) => setEditedRank(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400">
                      Badge
                    </label>
                    <input
                      type="text"
                      className="input text-sm"
                      value={editedBadge}
                      onChange={(e) => setEditedBadge(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400">
                      Callsign
                    </label>
                    <input
                      type="text"
                      className="input text-sm"
                      value={editedCallsign}
                      onChange={(e) => setEditedCallsign(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400">
                      Assigned Vehicle Plate
                    </label>
                    <select
                      className="input text-sm"
                      value={assignedVehicle || ""}
                      onChange={(e) =>
                        setAssignedVehicle(e.target.value || null)
                      }
                    >
                      <option value="">None</option>
                      {fleetData
                        .filter((v: any) => v.inService !== false)
                        .sort((a, b) => a.plate.localeCompare(b.plate))
                        .map((vehicle: any) => (
                          <option key={vehicle.id} value={vehicle.plate}>
                            {vehicle.plate} ({vehicle.vehicle || "N/A"})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400">
                      Discord ID
                    </label>
                    <input
                      type="text"
                      className="input text-sm"
                      value={editedDiscordId}
                      onChange={(e) => setEditedDiscordId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400">
                      LOA Start Date
                    </label>
                    <input
                      type="date"
                      className="input text-sm"
                      value={editedLoaStart || ""}
                      onChange={(e) =>
                        setEditedLoaStart(e.target.value || null)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400">
                      LOA End Date
                    </label>
                    <input
                      type="date"
                      className="input text-sm"
                      value={editedLoaEnd || ""}
                      onChange={(e) => setEditedLoaEnd(e.target.value || null)}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      id="isActiveCheckboxModal"
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                      checked={editedIsActive}
                      onChange={(e) => setEditedIsActive(e.target.checked)}
                    />
                    <label
                      htmlFor="isActiveCheckboxModal"
                      className="text-sm font-medium text-gray-300"
                    >
                      Is Active Member
                    </label>
                  </div>
                  <div className="space-y-3 pt-4 border-t border-gray-600 mt-4">
                    <h4 className="text-md font-semibold text-yellow-300">
                      Divisions & Certs
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {["SWAT", "K9", "FTO", "CIU", "MBU", "HEAT", "ACU"].map(
                        (key) => (
                          <div key={key} className="flex items-center gap-2">
                            <label className="text-sm w-16 flex-shrink-0">
                              {key}:
                            </label>
                            <select
                              className="input input-xs flex-grow"
                              value={editedCerts[key] || ""}
                              onChange={(e) =>
                                handleCertChange(
                                  key,
                                  e.target.value as CertStatus
                                )
                              }
                            >
                              <option value="">None</option>
                              {["SWAT", "K9", "FTO", "CIU"].includes(key) ? (
                                <>
                                  <option value="CERT">CERT</option>
                                  <option value="LEAD">LEAD</option>
                                  <option value="SUPER">SUPER</option>
                                </>
                              ) : (
                                <option value="CERT">CERT</option>
                              )}
                            </select>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                  <button
                    className="button-primary text-sm px-4 py-2 mt-6 w-full"
                    onClick={handleUpdateUser}
                  >
                    Save Roster Changes
                  </button>
                </div>

                <div className="lg:col-span-1 space-y-4">
                  <div className="border border-gray-700 rounded p-3 bg-gray-800/30">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-semibold text-yellow-400">
                        Discipline
                      </h3>
                      <button
                        className="button-secondary text-xs px-2 py-1"
                        onClick={() => {
                          setShowAddDisciplineForm(!showAddDisciplineForm);
                          setShowAddNoteForm(false);
                          setEditingDiscipline(null);
                          setEditingNote(null);
                        }}
                        disabled={!!editingDiscipline || !!editingNote}
                      >
                        {showAddDisciplineForm ? "Cancel" : "Add New"}
                      </button>
                    </div>
                    {showAddDisciplineForm && (
                      <div className="bg-gray-700/50 p-3 rounded space-y-2 mb-3">
                        <select
                          className="input text-sm w-full"
                          value={newDisciplineType}
                          onChange={(e) =>
                            setNewDisciplineType(
                              e.target.value as DisciplineEntry["type"]
                            )
                          }
                        >
                          <option value="commendation">Commendation</option>
                          <option value="verbal">Verbal Warning</option>
                          <option value="written">Written Warning</option>
                          <option value="suspension">Suspension</option>
                          <option value="termination">Termination</option>
                        </select>
                        <textarea
                          className="input text-sm w-full"
                          rows={2}
                          value={newDisciplineNote}
                          onChange={(e) => setNewDisciplineNote(e.target.value)}
                          placeholder="Discipline details..."
                        />
                        {modalSubmitError && (
                          <p className="text-red-500 text-xs">
                            {modalSubmitError}
                          </p>
                        )}
                        <button
                          className="button-primary text-sm px-3 py-1"
                          onClick={handleAddDiscipline}
                        >
                          Submit Entry
                        </button>
                      </div>
                    )}
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1 text-sm">
                      {modalDataLoading && (
                        <p className="italic text-gray-400">Loading...</p>
                      )}
                      {modalDataError && (
                        <p className="text-red-500">{modalDataError}</p>
                      )}
                      {!modalDataLoading &&
                        modalDisciplineEntries.length === 0 && (
                          <p className="italic text-gray-500">No records.</p>
                        )}
                      {modalDisciplineEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className={`p-2 rounded border ${
                            editingDiscipline?.id === entry.id
                              ? "border-blue-500 bg-gray-700"
                              : "border-gray-600 bg-gray-700/50"
                          } relative group`}
                        >
                          {editingDiscipline?.id === entry.id ? (
                            <div className="space-y-2">
                              <select
                                className="input text-sm w-full"
                                value={editingDiscipline.type}
                                onChange={(e) =>
                                  setEditingDiscipline({
                                    ...editingDiscipline,
                                    type: e.target
                                      .value as DisciplineEntry["type"],
                                  })
                                }
                              >
                                <option value="commendation">
                                  Commendation
                                </option>
                                <option value="verbal">Verbal Warning</option>
                                <option value="written">Written Warning</option>
                                <option value="suspension">Suspension</option>
                                <option value="termination">Termination</option>
                              </select>
                              <textarea
                                className="input text-sm w-full"
                                value={editingDiscipline.note}
                                onChange={(e) =>
                                  setEditingDiscipline({
                                    ...editingDiscipline,
                                    note: e.target.value,
                                  })
                                }
                                rows={3}
                              />
                              <div className="flex gap-2 pt-1">
                                <button
                                  className="button-primary text-xs px-2 py-1"
                                  onClick={handleSaveDisciplineEdit}
                                >
                                  Save
                                </button>
                                <button
                                  className="button-secondary text-xs px-2 py-1"
                                  onClick={handleCancelEdit}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span
                                className={`font-semibold ${getDisciplineColor(
                                  entry.type
                                )}`}
                              >
                                {entry.type.charAt(0).toUpperCase() +
                                  entry.type.slice(1)}
                                :
                              </span>{" "}
                              {entry.note}
                              <small className="text-gray-400 block mt-1 text-xs">
                                By: {entry.issuedBy} on{" "}
                                {formatTimestamp(entry.issuedAt)}
                              </small>
                              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  title="Edit"
                                  className="bg-blue-600 hover:bg-blue-500 text-white p-1 rounded text-xs disabled:opacity-50"
                                  onClick={() =>
                                    handleStartEditDiscipline(entry)
                                  }
                                  disabled={
                                    !!editingDiscipline ||
                                    !!editingNote ||
                                    showAddDisciplineForm ||
                                    showAddNoteForm
                                  }
                                >
                                  ✏️
                                </button>
                                <button
                                  title="Delete"
                                  className="bg-red-600 hover:bg-red-500 text-white p-1 rounded text-xs disabled:opacity-50"
                                  onClick={() =>
                                    handleDeleteDiscipline(entry.id)
                                  }
                                  disabled={
                                    !!editingDiscipline ||
                                    !!editingNote ||
                                    showAddDisciplineForm ||
                                    showAddNoteForm
                                  }
                                >
                                  🗑️
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-gray-700 rounded p-3 bg-gray-800/30">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-semibold text-yellow-400">
                        General Notes
                      </h3>
                      <button
                        className="button-secondary text-xs px-2 py-1"
                        onClick={() => {
                          setShowAddNoteForm(!showAddNoteForm);
                          setShowAddDisciplineForm(false);
                          setEditingDiscipline(null);
                          setEditingNote(null);
                        }}
                        disabled={!!editingDiscipline || !!editingNote}
                      >
                        {showAddNoteForm ? "Cancel" : "Add New"}
                      </button>
                    </div>
                    {showAddNoteForm && (
                      <div className="bg-gray-700/50 p-3 rounded space-y-2 mb-3">
                        <textarea
                          className="input text-sm w-full"
                          rows={2}
                          value={newGeneralNote}
                          onChange={(e) => setNewGeneralNote(e.target.value)}
                          placeholder="General note details..."
                        />
                        {modalSubmitError && (
                          <p className="text-red-500 text-xs">
                            {modalSubmitError}
                          </p>
                        )}
                        <button
                          className="button-primary text-sm px-3 py-1"
                          onClick={handleAddNote}
                        >
                          Submit Note
                        </button>
                      </div>
                    )}
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1 text-sm">
                      {modalDataLoading && (
                        <p className="italic text-gray-400">Loading...</p>
                      )}
                      {modalDataError && (
                        <p className="text-red-500">{modalDataError}</p>
                      )}
                      {!modalDataLoading && modalNotesEntries.length === 0 && (
                        <p className="italic text-gray-500">No notes.</p>
                      )}
                      {modalNotesEntries.map((note) => (
                        <div
                          key={note.id}
                          className={`p-2 rounded border ${
                            editingNote?.id === note.id
                              ? "border-blue-500 bg-gray-700"
                              : "border-gray-600 bg-gray-700/50"
                          } relative group`}
                        >
                          {editingNote?.id === note.id ? (
                            <div className="space-y-2">
                              <textarea
                                className="input text-sm w-full"
                                value={editingNote.note}
                                onChange={(e) =>
                                  setEditingNote({
                                    ...editingNote,
                                    note: e.target.value,
                                  })
                                }
                                rows={3}
                              />
                              <div className="flex gap-2 pt-1">
                                <button
                                  className="button-primary text-xs px-2 py-1"
                                  onClick={handleSaveNoteEdit}
                                >
                                  Save
                                </button>
                                <button
                                  className="button-secondary text-xs px-2 py-1"
                                  onClick={handleCancelEdit}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {note.note}
                              <small className="text-gray-400 block mt-1 text-xs">
                                By: {note.issuedBy} on{" "}
                                {formatTimestamp(note.issuedAt)}
                              </small>
                              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  title="Edit"
                                  className="bg-blue-600 hover:bg-blue-500 text-white p-1 rounded text-xs disabled:opacity-50"
                                  onClick={() => handleStartEditNote(note)}
                                  disabled={
                                    !!editingDiscipline ||
                                    !!editingNote ||
                                    showAddDisciplineForm ||
                                    showAddNoteForm
                                  }
                                >
                                  ✏️
                                </button>
                                <button
                                  title="Delete"
                                  className="bg-red-600 hover:bg-red-500 text-white p-1 rounded text-xs disabled:opacity-50"
                                  onClick={() => handleDeleteNote(note.id)}
                                  disabled={
                                    !!editingDiscipline ||
                                    !!editingNote ||
                                    showAddDisciplineForm ||
                                    showAddNoteForm
                                  }
                                >
                                  🗑️
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-1 space-y-4">
                  <div className="border border-gray-700 rounded p-3 bg-gray-800/30">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-semibold text-yellow-400">
                        Assigned Tasks
                      </h3>
                      <button
                        className="button-secondary text-xs px-2 py-1"
                        onClick={() => setShowAddTaskForm(!showAddTaskForm)}
                      >
                        {showAddTaskForm ? "Cancel" : "Assign New"}
                      </button>
                    </div>
                    {showAddTaskForm && (
                      <div className="bg-gray-700/50 p-3 rounded space-y-2 mb-3">
                        <textarea
                          className="input text-sm w-full"
                          placeholder="Task Description"
                          rows={2}
                          value={newTaskDescription}
                          onChange={(e) =>
                            setNewTaskDescription(e.target.value)
                          }
                        />
                        <div className="flex gap-2 items-center">
                          <select
                            className="input text-sm flex-grow"
                            value={newTaskType}
                            onChange={(e) =>
                              setNewTaskType(
                                e.target.value as "goal" | "normal"
                              )
                            }
                          >
                            <option value="goal">Goal-Oriented</option>
                            <option value="normal">Normal</option>
                          </select>
                          {newTaskType === "goal" && (
                            <input
                              type="number"
                              className="input text-sm w-24"
                              placeholder="Goal"
                              value={newTaskGoal}
                              onChange={(e) =>
                                setNewTaskGoal(Number(e.target.value))
                              }
                            />
                          )}
                        </div>
                        {modalSubmitError && (
                          <p className="text-red-500 text-xs">
                            {modalSubmitError}
                          </p>
                        )}
                        <button
                          className="button-primary text-sm px-3 py-1"
                          onClick={assignTaskToSelectedUser}
                        >
                          Assign Task
                        </button>
                      </div>
                    )}
                    <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1 text-sm">
                      {modalDataLoading && (
                        <p className="italic text-gray-400">Loading...</p>
                      )}
                      {modalDataError && (
                        <p className="text-red-500">{modalDataError}</p>
                      )}
                      {!modalDataLoading && modalTasks.length === 0 && (
                        <p className="italic text-gray-500">
                          No tasks assigned.
                        </p>
                      )}
                      {modalTasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-2 rounded border border-gray-600 bg-gray-700/50 relative group"
                        >
                          <p
                            className={`inline ${
                              task.completed ? "line-through text-gray-500" : ""
                            }`}
                          >
                            {task.description}
                          </p>
                          <small className="text-gray-400 block mt-1 text-xs">
                            Type: {task.type}
                            {task.type === "goal-oriented" &&
                              ` | Goal: ${task.goal ?? "N/A"}, Progress: ${
                                task.progress ?? 0
                              }`}
                            | Status:{" "}
                            {task.completed ? (
                              <span className="text-green-400">Completed</span>
                            ) : (
                              <span className="text-yellow-400">
                                In Progress
                              </span>
                            )}
                            | Assigned:{" "}
                            {task.assignedAt
                              ? formatAssignedAt(
                                  task.assignedAt instanceof Timestamp
                                    ? task.assignedAt.toDate()
                                    : new Date(task.assignedAt)
                                )
                              : "N/A"}
                          </small>
                          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              title="Delete Task"
                              className="bg-red-600 hover:bg-red-500 text-white p-1 rounded text-xs"
                              onClick={() =>
                                deleteTask(selectedUser.id, task.id)
                              }
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
