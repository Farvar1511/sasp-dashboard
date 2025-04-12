import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase"; // Firestore DB
import Layout from "./Layout";
import { User as AuthUser, Task } from "../types/User"; // Import types, rename User to AuthUser to avoid conflict
import { useNavigate } from "react-router-dom"; // Import useNavigate

// Interface for user data fetched from Firestore
interface FirestoreUser {
  id: string; // Document ID (usually email)
  name: string;
  rank: string;
  email: string;
  badge?: string; // Optional fields based on your example
  cid?: string;
  tasks: Task[]; // Tasks will be fetched and added here
  isAdmin?: boolean; // Add isAdmin if relevant
}

export default function AdminMenu({ user }: { user: AuthUser }) {
  // Bulletin State
  const [bulletinTitle, setBulletinTitle] = useState("");
  const [bulletinBody, setBulletinBody] = useState("");
  const [bulletinError, setBulletinError] = useState<string | null>(null);

  // User & Task State
  const [allUsersData, setAllUsersData] = useState<FirestoreUser[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Assign Task State
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [taskDescription, setTaskDescription] = useState<string>("");
  const [taskType, setTaskType] = useState<"normal" | "goal-oriented">(
    "normal"
  );
  const [taskCategory, setTaskCategory] = useState<string>("General"); // New state for category
  const [taskGoal, setTaskGoal] = useState<number | string>("");
  const [assignError, setAssignError] = useState<string | null>(null);

  // Editing Task State
  const [editingTask, setEditingTask] = useState<{
    userId: string;
    taskId: string;
    description: string;
  } | null>(null);

  const [editingGoalProgress, setEditingGoalProgress] = useState<{
    userId: string;
    taskId: string;
    goal: number;
    progress: number;
  } | null>(null); // State for editing goal/progress

  // State for collapsible sections
  const [showAddBulletin, setShowAddBulletin] = useState(false);
  const [showAssignTask, setShowAssignTask] = useState(false);

  const navigate = useNavigate(); // Hook for navigation

  // Fetch Users and their Tasks from Firestore
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
            category: taskDoc.data().category || "General", // Ensure category defaults if missing
            assignedAt:
              taskDoc.data().assignedAt instanceof Timestamp
                ? taskDoc.data().assignedAt.toDate().toISOString()
                : taskDoc.data().assignedAt || new Date(0).toISOString(),
          })) as Task[];

          tasks.sort(
            (a, b) =>
              new Date(
                b.assignedAt instanceof Timestamp
                  ? b.assignedAt.toDate()
                  : b.assignedAt
              ).getTime() -
              new Date(
                a.assignedAt instanceof Timestamp
                  ? a.assignedAt.toDate()
                  : a.assignedAt
              ).getTime()
          );

          return {
            id: userId,
            name: userData.name || "Unknown",
            rank: userData.rank || "Unknown",
            email: userData.email || userId,
            badge: userData.badge || "N/A", // Default badge if missing
            cid: userData.cid,
            tasks: tasks,
          };
        });

        const resolvedUsersData = await Promise.all(usersDataPromises);
        resolvedUsersData.sort((a, b) => a.name.localeCompare(b.name));
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

  // --- Bulletin Logic ---
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

  // --- Task Logic (Firestore) ---
  const assignTask = async () => {
    if (!selectedUserId || !taskDescription) {
      setAssignError("Please select a user and enter a task description.");
      return;
    }
    if (
      taskType === "goal-oriented" &&
      (!taskGoal || isNaN(Number(taskGoal)) || Number(taskGoal) <= 0)
    ) {
      setAssignError("Please enter a valid positive number for the goal.");
      return;
    }
    setAssignError(null);

    const userTasksCollectionRef = collection(
      dbFirestore,
      "users",
      selectedUserId,
      "tasks"
    );

    const newTaskData: Omit<Task, "id"> = {
      description: taskDescription,
      assignedAt: new Date().toISOString(),
      completed: false,
      type: taskType,
      category: taskCategory, // Add category
      ...(taskType === "goal-oriented" && {
        goal: Number(taskGoal),
        progress: 0,
      }),
    };

    try {
      const docRef = await addDoc(userTasksCollectionRef, newTaskData);
      console.log(
        `Task assigned to user ${selectedUserId} with ID: ${docRef.id}`
      );

      const addedTask: Task = { ...newTaskData, id: docRef.id };
      setAllUsersData((prevUsers) =>
        prevUsers.map((u) => {
          if (u.id === selectedUserId) {
            const updatedTasks = [addedTask, ...u.tasks];
            updatedTasks.sort(
              (a, b) =>
                new Date(
                  b.assignedAt instanceof Timestamp
                    ? b.assignedAt.toDate()
                    : b.assignedAt
                ).getTime() -
                new Date(
                  a.assignedAt instanceof Timestamp
                    ? a.assignedAt.toDate()
                    : a.assignedAt
                ).getTime()
            );
            return { ...u, tasks: updatedTasks };
          }
          return u;
        })
      );

      setTaskDescription("");
      setTaskType("normal");
      setTaskGoal("");
      setTaskCategory("General"); // Reset category
      setSelectedUserId("");
      setShowAssignTask(false);
      alert("Task assigned successfully!");
    } catch (error) {
      console.error("Error assigning task:", error);
      setAssignError("Failed to assign task.");
    }
  };

  const startEditingTask = (
    userId: string,
    taskId: string,
    currentDescription: string
  ) => {
    setEditingGoalProgress(null); // Close goal editing if open
    setEditingTask({ userId, taskId, description: currentDescription });
  };

  const saveTaskEdit = async () => {
    if (!editingTask) return;
    const { userId, taskId, description } = editingTask;
    if (!description.trim()) {
      alert("Task description cannot be empty.");
      return;
    }

    const taskDocRef = doc(dbFirestore, "users", userId, "tasks", taskId);
    try {
      await updateDoc(taskDocRef, { description: description.trim() });

      setAllUsersData((prevUsers) =>
        prevUsers.map((u) => {
          if (u.id === userId) {
            return {
              ...u,
              tasks: u.tasks.map((t) =>
                t.id === taskId ? { ...t, description: description.trim() } : t
              ),
            };
          }
          return u;
        })
      );

      setEditingTask(null);
    } catch (error) {
      console.error("Error updating task description:", error);
      alert("Failed to update task description.");
    }
  };

  const deleteTask = async (userId: string, taskId: string) => {
    if (!confirm(`Are you sure you want to delete this task?`)) return;

    const taskDocRef = doc(dbFirestore, "users", userId, "tasks", taskId);
    try {
      await deleteDoc(taskDocRef);
      console.log(`Task ${taskId} deleted for user ${userId}`);

      setAllUsersData((prevUsers) =>
        prevUsers.map((u) => {
          if (u.id === userId) {
            return { ...u, tasks: u.tasks.filter((t) => t.id !== taskId) };
          }
          return u;
        })
      );
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Failed to delete task.");
    }
  };

  const startEditingGoalProgress = (
    userId: string,
    taskId: string,
    currentGoal: number,
    currentProgress: number
  ) => {
    setEditingTask(null); // Close description editing if open
    setEditingGoalProgress({
      userId,
      taskId,
      goal: currentGoal,
      progress: currentProgress,
    });
  };

  const saveGoalProgressEdit = async () => {
    if (!editingGoalProgress) return;
    const { userId, taskId, goal, progress } = editingGoalProgress;

    if (
      isNaN(Number(goal)) ||
      Number(goal) <= 0 ||
      isNaN(Number(progress)) ||
      Number(progress) < 0
    ) {
      alert(
        "Please enter valid numbers for goal (positive) and progress (non-negative)."
      );
      return;
    }
    const finalProgress = Math.min(Number(progress), Number(goal));

    const taskDocRef = doc(dbFirestore, "users", userId, "tasks", taskId);
    try {
      await updateDoc(taskDocRef, {
        goal: Number(goal),
        progress: finalProgress,
      });

      setAllUsersData((prevUsers) =>
        prevUsers.map((u) => {
          if (u.id === userId) {
            return {
              ...u,
              tasks: u.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, goal: Number(goal), progress: finalProgress }
                  : t
              ),
            };
          }
          return u;
        })
      );

      setEditingGoalProgress(null);
    } catch (error) {
      console.error("Error updating goal/progress:", error);
      alert("Failed to update goal/progress.");
    }
  };

  const formatAssignedAt = (
    assignedAtValue: string | Timestamp | undefined
  ): string => {
    if (!assignedAtValue) return "Date unknown";
    try {
      const date =
        assignedAtValue instanceof Timestamp
          ? assignedAtValue.toDate()
          : new Date(assignedAtValue);
      return date.toLocaleString();
    } catch {
      return "Invalid date";
    }
  };

  return (
    <Layout user={user}>
      <div className="page-content space-y-6">
        <h1 className="text-3xl font-bold text-[#f3c700]">Admin Menu</h1>

        <div className="flex flex-wrap gap-4 mb-4">
          <button
            className="button-primary px-3 py-1.5 text-sm"
            onClick={() => {
              setShowAddBulletin(!showAddBulletin);
              setShowAssignTask(false);
            }}
          >
            {showAddBulletin ? "Hide" : "Show"} Add Bulletin
          </button>
          <button
            className="button-primary px-3 py-1.5 text-sm"
            onClick={() => {
              setShowAssignTask(!showAssignTask);
              setShowAddBulletin(false);
            }}
          >
            {showAssignTask ? "Hide" : "Show"} Assign Task
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

        {showAssignTask && (
          <div className="admin-section p-4 mb-6">
            <h2 className="section-header text-xl mb-3">Assign Task</h2>
            {assignError && (
              <p className="text-red-500 mb-3 text-sm">{assignError}</p>
            )}
            <select
              className="input mb-2 text-sm"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={usersLoading}
            >
              <option value="">-- Select User --</option>
              {allUsersData.map((userData) => (
                <option key={userData.id} value={userData.id}>
                  {userData.name} ({userData.rank}) - {userData.badge}
                </option>
              ))}
            </select>
            <textarea
              className="input mb-2 text-sm"
              placeholder="Task Description"
              rows={2}
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
            />
            <select
              className="input mb-2 text-sm"
              value={taskCategory}
              onChange={(e) => setTaskCategory(e.target.value)}
            >
              <option value="General">General</option>
              <option value="Tasks for Promotion">Tasks for Promotion</option>
            </select>
            <div className="flex gap-4 items-center mb-2 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="taskType"
                  value="normal"
                  checked={taskType === "normal"}
                  onChange={() => setTaskType("normal")}
                />{" "}
                Normal
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="taskType"
                  value="goal-oriented"
                  checked={taskType === "goal-oriented"}
                  onChange={() => setTaskType("goal-oriented")}
                />{" "}
                Goal-Oriented
              </label>
            </div>
            {taskType === "goal-oriented" && (
              <input
                type="number"
                className="input mb-3 text-sm"
                placeholder="Goal (e.g., 10)"
                value={taskGoal}
                onChange={(e) => setTaskGoal(e.target.value)}
                min="1"
              />
            )}
            <button
              className="button-primary text-sm px-3 py-1.5"
              onClick={assignTask}
              disabled={usersLoading}
            >
              Assign Task
            </button>
          </div>
        )}

        <div className="admin-section p-4">
          <h2 className="section-header text-xl mb-3">
            Users & Assigned Tasks
          </h2>
          {usersLoading && (
            <p className="text-yellow-400 italic text-sm">Loading users...</p>
          )}
          {usersError && (
            <p className="text-red-500 mb-4 text-sm">{usersError}</p>
          )}
          {!usersLoading && !usersError && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allUsersData.length > 0 ? (
                allUsersData.map((userData) => (
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
                    <div className="mt-1 space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                      {userData.tasks && userData.tasks.length > 0 ? (
                        userData.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="task-card bg-gray-800/70 p-2 rounded border border-gray-600 relative group text-xs"
                          >
                            {editingTask?.taskId === task.id ? (
                              <div className="flex flex-col gap-1">
                                <textarea
                                  className="input text-xs p-1"
                                  value={editingTask.description}
                                  onChange={(e) =>
                                    setEditingTask({
                                      ...editingTask,
                                      description: e.target.value,
                                    })
                                  }
                                  rows={2}
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
                                    onClick={() => setEditingTask(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : editingGoalProgress?.taskId === task.id ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                  <label
                                    htmlFor={`prog-${task.id}`}
                                    className="text-[10px] flex-shrink-0"
                                  >
                                    Prog:
                                  </label>
                                  <input
                                    id={`prog-${task.id}`}
                                    type="number"
                                    className="input text-xs p-0.5 w-12"
                                    value={editingGoalProgress.progress}
                                    onChange={(e) =>
                                      setEditingGoalProgress({
                                        ...editingGoalProgress,
                                        progress: Number(e.target.value),
                                      })
                                    }
                                    min="0"
                                    max={editingGoalProgress.goal}
                                  />
                                  <span className="text-[10px]">/</span>
                                  <label
                                    htmlFor={`goal-${task.id}`}
                                    className="text-[10px] flex-shrink-0"
                                  >
                                    Goal:
                                  </label>
                                  <input
                                    id={`goal-${task.id}`}
                                    type="number"
                                    className="input text-xs p-0.5 w-12"
                                    value={editingGoalProgress.goal}
                                    onChange={(e) =>
                                      setEditingGoalProgress({
                                        ...editingGoalProgress,
                                        goal: Number(e.target.value),
                                      })
                                    }
                                    min="1"
                                  />
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    className="button-primary text-xs px-1.5 py-0.5"
                                    onClick={saveGoalProgressEdit}
                                  >
                                    Save
                                  </button>
                                  <button
                                    className="button-secondary text-xs px-1.5 py-0.5"
                                    onClick={() => setEditingGoalProgress(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {task.category &&
                                  task.category !== "General" && (
                                    <span className="text-[9px] bg-blue-600 text-white px-1 rounded-sm mr-1">
                                      {task.category}
                                    </span>
                                  )}
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
                                  Assigned: {formatAssignedAt(task.assignedAt)}
                                </small>
                                {task.type === "goal-oriented" &&
                                  task.goal != null && (
                                    <div className="mt-1">
                                      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden my-0.5">
                                        <div
                                          className="h-full bg-yellow-400"
                                          style={{
                                            width: `${Math.min(
                                              100,
                                              ((task.progress ?? 0) /
                                                task.goal) *
                                                100
                                            )}%`,
                                          }}
                                        ></div>
                                      </div>
                                      <p
                                        className="text-[10px] text-gray-400 cursor-pointer hover:text-yellow-300"
                                        onClick={() =>
                                          startEditingGoalProgress(
                                            userData.id,
                                            task.id,
                                            task.goal!,
                                            task.progress ?? 0
                                          )
                                        }
                                        title="Click to edit progress/goal"
                                      >
                                        Prog: {task.progress ?? 0}/{task.goal}{" "}
                                        ✏️
                                      </p>
                                    </div>
                                  )}
                                {task.completed && (
                                  <span className="text-green-500 text-[10px] font-bold">
                                    ✅ Done
                                  </span>
                                )}
                                <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    title="Edit Description"
                                    className="bg-blue-600 hover:bg-blue-500 text-white p-0.5 rounded text-[10px]"
                                    onClick={() =>
                                      startEditingTask(
                                        userData.id,
                                        task.id,
                                        task.description
                                      )
                                    }
                                  >
                                    ✏️
                                  </button>
                                  {task.type === "goal-oriented" && (
                                    <button
                                      title="Edit Goal/Progress"
                                      className="bg-purple-600 hover:bg-purple-500 text-white p-0.5 rounded text-[10px]"
                                      onClick={() =>
                                        startEditingGoalProgress(
                                          userData.id,
                                          task.id,
                                          task.goal!,
                                          task.progress ?? 0
                                        )
                                      }
                                    >
                                      📊
                                    </button>
                                  )}
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
                  </div>
                ))
              ) : (
                <p className="text-yellow-400 italic text-sm">
                  No users found.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
