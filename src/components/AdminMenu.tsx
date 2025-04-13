import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { User as AuthUser, Task } from "../types/User";
import { useNavigate } from "react-router-dom";

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

  const [editingTask, setEditingTask] = useState<{
    userId: string;
    taskId: string;
    description: string;
  } | null>(null);

  const [showAddBulletin, setShowAddBulletin] = useState(false);
  const [showAssignTask, setShowAssignTask] = useState(false);

  const [bulletinTitle, setBulletinTitle] = useState("");
  const [bulletinBody, setBulletinBody] = useState("");
  const [bulletinError, setBulletinError] = useState<string | null>(null);

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [taskDescription, setTaskDescription] = useState<string>("");
  const [taskGoal, setTaskGoal] = useState<number>(0);
  const [editingGoalTask, setEditingGoalTask] = useState<{
    userId: string;
    taskId: string;
    description: string;
    goal: number;
    progress: number;
  } | null>(null);

  const [fleetData, setFleetData] = useState<{ id: string; plate: string }[]>(
    []
  );

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

  const selectAllBelowSupervisor = () => {
    const belowSupervisorIds = allUsersData
      .filter((user) => user.rank.toLowerCase() !== "supervisor")
      .map((user) => user.id);
    setSelectedUsers(belowSupervisorIds);
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
        }));
        setFleetData(fleet);
      } catch (error) {
        console.error("Error fetching fleet data:", error);
      }
    };

    fetchFleetData();
  }, []);

  const addBulletin = async () => {
    if (!bulletinTitle || !bulletinBody) {
      setBulletinError("Bulletin title and body are required.");
      return;
    }
    setBulletinError(null);
    try {
      await addDoc(collection(dbFirestore, "bulletins"), {
        title: bulletinTitle,
        body: bulletinBody,
        createdAt: serverTimestamp(),
      });
      setBulletinTitle("");
      setBulletinBody("");
      setShowAddBulletin(false);
      alert("Bulletin added successfully!");
    } catch (err) {
      console.error("Error adding bulletin:", err);
      setBulletinError("Failed to add bulletin.");
    }
  };

  const startEditingTask = (
    userId: string,
    taskId: string,
    currentDescription: string
  ) => {
    setEditingTask({ userId, taskId, description: currentDescription });
  };

  const saveTaskEdit = async () => {
    if (!editingGoalTask) return;
    const { userId, taskId, description, goal, progress } = editingGoalTask;

    if (!description.trim() || goal <= 0 || progress < 0) {
      alert("Please provide valid task details.");
      return;
    }

    const taskDocRef = doc(dbFirestore, "users", userId, "tasks", taskId);
    try {
      await updateDoc(taskDocRef, {
        description: description.trim(),
        goal,
        progress,
      });

      setAllUsersData((prevUsers) =>
        prevUsers.map((u) => {
          if (u.id === userId) {
            return {
              ...u,
              tasks: u.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, description: description.trim(), goal, progress }
                  : t
              ),
            };
          }
          return u;
        })
      );

      setEditingGoalTask(null);
      alert("Task updated successfully!");
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Failed to update task. Please try again.");
    }
  };

  const assignTask = async () => {
    if (
      !taskDescription.trim() ||
      taskGoal <= 0 ||
      selectedUsers.length === 0
    ) {
      alert("Please provide a valid task description, goal, and select users.");
      return;
    }

    try {
      const taskData = {
        description: taskDescription.trim(),
        goal: taskGoal,
        progress: 0,
        assignedAt: serverTimestamp(),
        completed: false,
      };

      for (const userId of selectedUsers) {
        const tasksCollectionRef = collection(
          dbFirestore,
          "users",
          userId,
          "tasks"
        );
        await addDoc(tasksCollectionRef, taskData);
      }

      alert("Task assigned successfully!");
      setTaskDescription("");
      setTaskGoal(0);
      setSelectedUsers([]);
      setShowAssignTask(false);
    } catch (error) {
      console.error("Error assigning task:", error);
      alert("Failed to assign task. Please try again.");
    }
  };

  const startEditingGoalTask = (
    userId: string,
    taskId: string,
    description: string,
    goal: number,
    progress: number
  ) => {
    setEditingGoalTask({ userId, taskId, description, goal, progress });
  };

  const deleteTask = async (userId: string, taskId: string) => {
    const taskDocRef = doc(dbFirestore, "users", userId, "tasks", taskId);
    try {
      await deleteDoc(taskDocRef);
      setAllUsersData((prevUsers) =>
        prevUsers.map((u) => {
          if (u.id === userId) {
            return {
              ...u,
              tasks: u.tasks.filter((t) => t.id !== taskId),
            };
          }
          return u;
        })
      );
      alert("Task deleted successfully!");
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Failed to delete task. Please try again.");
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
    setEditedLoaStart(user.loaStartDate);
    setEditedLoaEnd(user.loaEndDate);
    setEditedCerts(
      Object.fromEntries(
        Object.entries(user.certifications).map(([key, value]) => [
          key,
          value === "LEAD" || value === "SUPER" || value === "CERT"
            ? value
            : null,
        ])
      )
    );
    setAssignedVehicle(user.assignedVehicle || null);
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
        loaStartDate: editedLoaStart || null,
        loaEndDate: editedLoaEnd || null,
        certifications: editedCerts,
        assignedVehicle: assignedVehicle || null,
      };

      // Update the user document in Firestore
      await updateDoc(userRef, updateData);

      // Update the fleet document if a vehicle is assigned
      if (assignedVehicle) {
        const fleetDoc = fleetData.find((vehicle) => vehicle.plate === assignedVehicle);
        if (fleetDoc) {
          const fleetRef = doc(dbFirestore, "fleet", fleetDoc.id);
          await updateDoc(fleetRef, { assignee: editedName.trim() });
        }
      }

      // Update the local state
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
  ];

  const sortedUsersData = [...allUsersData].sort((a, b) => {
    const rankA = rankOrder.indexOf(a.rank);
    const rankB = rankOrder.indexOf(b.rank);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    return a.callsign.localeCompare(b.callsign);
  });

  return (
    <Layout user={user}>
      <div className="page-content space-y-6">
        <h1 className="text-3xl font-bold text-[#f3c700]">Admin Menu</h1>

        <div className="flex flex-wrap gap-4 mb-4">
          <button
            className="button-primary px-3 py-1.5 text-sm"
            onClick={() => {
              setShowAddBulletin(false);
              setShowAssignTask(!showAssignTask);
            }}
          >
            {showAssignTask ? "Hide" : "Show"} Assign Task
          </button>
          <button
            className="button-primary px-3 py-1.5 text-sm"
            onClick={() => {
              setShowAssignTask(false);
              setShowAddBulletin(!showAddBulletin);
            }}
          >
            {showAddBulletin ? "Hide" : "Show"} Add Bulletin
          </button>
          <button
            className="button-secondary px-3 py-1.5 text-sm"
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
        </div>

        {showAssignTask && (
          <div className="admin-section p-4 mb-6">
            <h2 className="section-header text-xl mb-3">Assign Task</h2>
            <textarea
              className="input mb-2 text-sm"
              placeholder="Task Description"
              rows={2}
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
            />
            <input
              type="number"
              className="input mb-2 text-sm"
              placeholder="Task Goal (e.g., 100)"
              value={taskGoal}
              onChange={(e) => setTaskGoal(Number(e.target.value))}
            />
            <div className="mb-4">
              <div className="flex gap-2 mb-2">
                <button
                  className="button-primary text-sm px-3 py-1.5"
                  onClick={selectAllUsers}
                >
                  Select All
                </button>
                <button
                  className="button-primary text-sm px-3 py-1.5"
                  onClick={selectAllBelowSupervisor}
                >
                  Select All Below Supervisor
                </button>
                <button
                  className="button-secondary text-sm px-3 py-1.5"
                  onClick={clearAllSelections}
                >
                  Clear All
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {allUsersData.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 bg-gray-800 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      id={`user-${user.id}`}
                      className="h-4 w-4 text-yellow-500 focus:ring-yellow-500"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                    />
                    <label
                      htmlFor={`user-${user.id}`}
                      className="text-sm text-gray-300"
                    >
                      {user.name} ({user.rank})
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <button
              className="button-primary text-sm px-3 py-1.5"
              onClick={assignTask}
            >
              Assign Task
            </button>
          </div>
        )}

        {showAddBulletin && (
          <div className="admin-section p-4 mb-6">
            <h2 className="section-header text-xl mb-3">Add Bulletin</h2>
            {bulletinError && (
              <p className="text-red-500 mb-3 text-sm">{bulletinError}</p>
            )}
            <input
              type="text"
              className="input mb-2 text-sm"
              placeholder="Bulletin Title"
              value={bulletinTitle}
              onChange={(e) => setBulletinTitle(e.target.value)}
            />
            <textarea
              className="input mb-3 text-sm"
              placeholder="Bulletin Body"
              rows={3}
              value={bulletinBody}
              onChange={(e) => setBulletinBody(e.target.value)}
            />
            <button
              className="button-primary text-sm px-3 py-1.5"
              onClick={addBulletin}
            >
              Add Bulletin
            </button>
          </div>
        )}

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
                  className="user-card p-3 border border-gray-700 rounded-lg bg-gray-900/50"
                >
                  <h3 className="text-lg font-semibold text-yellow-400 truncate">
                    {userData.name}{" "}
                    <span className="text-xs text-gray-400">
                      ({userData.rank})
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 truncate mb-2">
                    Badge: {userData.badge}
                  </p>
                  <p className="text-xs text-gray-500 truncate mb-2">
                    Callsign: {userData.callsign}
                  </p>
                  <div className="mt-1 space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                    {userData.tasks && userData.tasks.length > 0 ? (
                      userData.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="task-card bg-gray-800/70 p-2 rounded border border-gray-600 relative group text-xs"
                        >
                          {editingGoalTask?.taskId === task.id ? (
                            <div className="flex flex-col gap-1">
                              <textarea
                                className="input text-xs p-1"
                                value={editingGoalTask.description}
                                onChange={(e) =>
                                  setEditingGoalTask({
                                    ...editingGoalTask,
                                    description: e.target.value,
                                  })
                                }
                                rows={2}
                              />
                              <input
                                type="number"
                                className="input text-xs p-1"
                                placeholder="Goal"
                                value={editingGoalTask.goal}
                                onChange={(e) =>
                                  setEditingGoalTask({
                                    ...editingGoalTask,
                                    goal: Number(e.target.value),
                                  })
                                }
                              />
                              <input
                                type="number"
                                className="input text-xs p-1"
                                placeholder="Progress"
                                value={editingGoalTask.progress}
                                onChange={(e) =>
                                  setEditingGoalTask({
                                    ...editingGoalTask,
                                    progress: Number(e.target.value),
                                  })
                                }
                              />
                              <div className="flex gap-1">
                                <button
                                  className="button-primary text-xs px-1.5 py-0.5"
                                  onClick={saveTaskEdit}
                                >
                                  Save
                                </button>
                                <button
                                  className="button-secondary text-xs px-1.5 py-0.5"
                                  onClick={() => setEditingGoalTask(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p
                                className={`inline ${
                                  task.completed
                                    ? "line-through text-gray-500"
                                    : ""
                                }`}
                              >
                                {task.description}
                              </p>
                              <small className="text-[10px] text-gray-400 block">
                                Goal: {task.goal}, Progress: {task.progress},{" "}
                                Status:{" "}
                                {task.completed ? (
                                  <span className="text-green-500">
                                    Completed
                                  </span>
                                ) : (
                                  <span className="text-yellow-500">
                                    In Progress
                                  </span>
                                )}
                              </small>
                              <div className="absolute top-0.5 right-0.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  title="Edit Task"
                                  className="bg-blue-600 hover:bg-blue-500 text-white p-0.5 rounded text-[10px]"
                                  onClick={() =>
                                    setEditingGoalTask({
                                      userId: userData.id,
                                      taskId: task.id,
                                      description: task.description,
                                      goal: task.goal ?? 0,
                                      progress: task.progress ?? 0,
                                    })
                                  }
                                >
                                  ✏️
                                </button>
                                <button
                                  title="Delete Task"
                                  className="bg-red-600 hover:bg-red-500 text-white p-0.5 rounded text-[10px]"
                                  onClick={() =>
                                    deleteTask(userData.id, task.id)
                                  }
                                >
                                  🗑️
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 italic">
                        No tasks assigned.
                      </p>
                    )}
                  </div>
                  <button
                    className="button-primary text-xs px-2 py-1 mt-2"
                    onClick={() => handleSelectUser(userData)}
                  >
                    Edit Roster Data
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedUser && (
          <div className="fixed inset-0 bg-black/90 z-50 flex justify-center items-center p-4">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-lg relative max-h-[90vh] overflow-y-auto custom-scrollbar">
              <button
                className="absolute top-2 right-3 text-red-500 hover:text-red-400 text-3xl font-bold leading-none"
                onClick={() => setSelectedUser(null)}
              >
                &times;
              </button>
              <h2 className="section-header text-xl mb-4">
                Edit Roster Data for {selectedUser.name} ({selectedUser.rank})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
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
                  <label className="block text-sm font-medium text-gray-400 mb-1">
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
                  <label className="block text-sm font-medium text-gray-400 mb-1">
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
                  <label className="block text-sm font-medium text-gray-400 mb-1">
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
                  <label className="block text-sm font-medium text-gray-400 mb-1">
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
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    LOA Start Date
                  </label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={editedLoaStart || ""}
                    onChange={(e) => setEditedLoaStart(e.target.value || null)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    LOA End Date
                  </label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={editedLoaEnd || ""}
                    onChange={(e) => setEditedLoaEnd(e.target.value || null)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="isActiveCheckbox"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                    checked={editedIsActive}
                    onChange={(e) => setEditedIsActive(e.target.checked)}
                  />
                  <label
                    htmlFor="isActiveCheckbox"
                    className="text-sm font-medium text-gray-300"
                  >
                    Is Active
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Assign Vehicle
                  </label>
                  <select
                    className="input text-sm"
                    value={assignedVehicle || ""}
                    onChange={(e) => setAssignedVehicle(e.target.value || null)}
                  >
                    <option value="">None</option>
                    {fleetData.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.plate}>
                        {vehicle.plate}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-yellow-400 mb-2 border-t border-gray-700 pt-3">
                Certifications
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {["ACU", "CIU", "FTO", "HEAT", "K9", "MOTO", "SWAT"].map(
                  (certKey) => (
                    <div key={certKey} className="flex items-center gap-2">
                      <label className="text-sm w-20 flex-shrink-0">
                        {certKey}:
                      </label>
                      <select
                        className="input text-sm flex-grow"
                        value={editedCerts[certKey] || ""}
                        onChange={(e) =>
                          handleCertChange(
                            certKey,
                            e.target.value as CertStatus
                          )
                        }
                      >
                        <option value="">None</option>
                        <option value="CERT">CERT</option>
                        <option value="LEAD">LEAD</option>
                        <option value="SUPER">SUPER</option>
                      </select>
                    </div>
                  )
                )}
              </div>
              <button
                className="button-primary text-sm px-4 py-2 mt-6 w-full"
                onClick={handleUpdateUser}
              >
                Save Roster Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
