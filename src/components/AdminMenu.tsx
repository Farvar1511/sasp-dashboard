import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import Layout from "./Layout";
import { useNavigate } from "react-router-dom";

interface Task {
  id: string;
  description: string;
  assignedAt: string;
  completed: boolean;
  type: "normal" | "goal-oriented";
  goal?: number;
  progress?: number;
}

interface User {
  email: string;
  name: string;
  rank: string;
  tasks: Task[];
}

interface AdminMenuProps {
  currentUser: User;
}

const AdminMenu: React.FC<AdminMenuProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskType, setTaskType] = useState<"normal" | "goal-oriented">(
    "normal"
  );
  const [taskGoal, setTaskGoal] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [bulletinTitle, setBulletinTitle] = useState("");
  const [bulletinBody, setBulletinBody] = useState("");
  const [editingTask, setEditingTask] = useState<{
    taskId: string;
    description: string;
    goal?: number;
  } | null>(null);
  const navigate = useNavigate();

  // 🔄 Load users and their tasks
  useEffect(() => {
    const fetchUsers = async (): Promise<void> => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const usersList: User[] = [];

        for (const docSnap of usersSnap.docs) {
          const data = docSnap.data();
          const user: User = {
            email: docSnap.id,
            name: data.name,
            rank: data.rank,
            tasks: [],
          };

          const tasksSnap = await getDocs(
            collection(db, "users", docSnap.id, "tasks")
          );
          tasksSnap.forEach((taskDoc) => {
            const taskData = taskDoc.data();
            user.tasks.push({
              id: taskDoc.id,
              description: taskData.description,
              assignedAt: taskData.assignedAt,
              completed: taskData.completed,
              type: taskData.type,
              goal: taskData.goal,
              progress: taskData.progress,
            });
          });

          usersList.push(user);
        }

        setUsers(usersList);
      } catch (err) {
        console.error("Failed to load users:", err);
        setError("Failed to load users from Firestore.");
      }
    };

    fetchUsers();
  }, []);

  // 📝 Assign a new task
  const assignTask = async (): Promise<void> => {
    if (!selectedUserId || !taskDescription) {
      alert("Please select a user and enter a task.");
      return;
    }

    const taskId = uuidv4();
    const task: Task = {
      id: taskId,
      description: taskDescription,
      assignedAt: new Date().toISOString(),
      completed: false,
      type: taskType,
      ...(taskType === "goal-oriented" && { goal: taskGoal, progress: 0 }),
    };

    try {
      const taskRef = doc(db, "users", selectedUserId, "tasks", taskId);
      await setDoc(taskRef, task);

      alert("✅ Task assigned!");
      setTaskDescription("");
      setSelectedUserId("");
      setTaskType("normal");
      setTaskGoal(0);

      // Update local state
      setUsers((prev) =>
        prev.map((user) =>
          user.email === selectedUserId
            ? { ...user, tasks: [...user.tasks, task] }
            : user
        )
      );
    } catch (err) {
      console.error("Failed to assign task:", err);
      setError("Error assigning task.");
    }
  };

  // 🗑️ Delete a completed task
  const deleteTask = async (
    userEmail: string,
    taskId: string
  ): Promise<void> => {
    try {
      const taskRef = doc(db, "users", userEmail, "tasks", taskId);
      await deleteDoc(taskRef);

      setUsers((prev) =>
        prev.map((user) =>
          user.email === userEmail
            ? {
                ...user,
                tasks: user.tasks.filter((task) => task.id !== taskId),
              }
            : user
        )
      );
    } catch (err) {
      console.error("Failed to delete task:", err);
      alert("Error deleting task");
    }
  };

  // ✏️ Save edited task
  const saveTaskEdits = async (userEmail: string) => {
    if (!editingTask) return;

    try {
      const taskRef = doc(db, "users", userEmail, "tasks", editingTask.taskId);
      const updates: Partial<Task> = { description: editingTask.description };
      if (editingTask.goal !== undefined) updates.goal = editingTask.goal;

      await updateDoc(taskRef, updates);

      setUsers((prev) =>
        prev.map((user) =>
          user.email === userEmail
            ? {
                ...user,
                tasks: user.tasks.map((task) =>
                  task.id === editingTask.taskId
                    ? {
                        ...task,
                        description: editingTask.description,
                        goal: editingTask.goal,
                      }
                    : task
                ),
              }
            : user
        )
      );
      setEditingTask(null); // Exit edit mode
    } catch (err) {
      console.error("Error saving task edits:", err);
      setError("Failed to save task edits.");
    }
  };

  // 📢 Create a bulletin
  const createBulletin = async () => {
    if (!bulletinTitle || !bulletinBody) {
      alert("Please provide both a title and body for the bulletin.");
      return;
    }

    try {
      const newBulletin = {
        title: bulletinTitle,
        body: bulletinBody,
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, "bulletins"), newBulletin); // Add to Firestore
      alert("✅ Bulletin created successfully!");
      setBulletinTitle("");
      setBulletinBody("");
    } catch (err) {
      console.error("Error creating bulletin:", err);
      alert("Failed to create bulletin.");
    }
  };

  if (error) {
    return (
      <div className="error-message">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate("/")}>Back to Dashboard</button>
      </div>
    );
  }

  return (
    <Layout user={currentUser}>
      <div className="page-content">
        <div className="max-w-6xl mx-auto p-6 space-y-10">
          <h1 className="text-3xl font-bold">Admin Control Panel</h1>
          <div className="admin-menu-container">
            <h2>Admin Menu</h2>
            <div className="admin-menu">
              <div>
                <label>
                  Select User:
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                  >
                    <option value="">--Select User--</option>
                    {users.map((user) => (
                      <option key={user.email} value={user.email}>
                        {user.name} ({user.rank})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <label>
                  Task:
                  <input
                    type="text"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                  />
                </label>
              </div>
              <div>
                <label>
                  Task Type:
                  <select
                    value={taskType}
                    onChange={(e) =>
                      setTaskType(e.target.value as "normal" | "goal-oriented")
                    }
                  >
                    <option value="normal">Normal</option>
                    <option value="goal-oriented">Goal-Oriented</option>
                  </select>
                </label>
              </div>
              {taskType === "goal-oriented" && (
                <div>
                  <label>
                    Goal:
                    <input
                      type="number"
                      value={taskGoal}
                      onChange={(e) => setTaskGoal(Number(e.target.value))}
                    />
                  </label>
                </div>
              )}
              <button onClick={assignTask}>Assign Task</button>
            </div>

            <div className="admin-menu">
              <h3>Create Bulletin</h3>
              <input
                type="text"
                placeholder="Bulletin Title"
                value={bulletinTitle}
                onChange={(e) => setBulletinTitle(e.target.value)}
              />
              <textarea
                placeholder="Bulletin Body"
                value={bulletinBody}
                onChange={(e) => setBulletinBody(e.target.value)}
              />
              <button onClick={createBulletin}>Create Bulletin</button>
            </div>

            <div className="user-tasks">
              <h3>Users and Their Tasks</h3>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {users.map((user) => (
                  <div
                    key={user.email}
                    className="bg-gray-900 p-4 rounded-lg shadow space-y-2 border border-yellow-400"
                  >
                    <h3 className="text-xl font-semibold">
                      {user.name} ({user.rank})
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {user.tasks.length > 0 ? (
                        user.tasks.map((task) => (
                          <li
                            key={task.id}
                            className="bg-black p-2 rounded border border-gray-700"
                          >
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                              }}
                            >
                              {editingTask?.taskId === task.id ? (
                                <>
                                  <input
                                    type="text"
                                    value={editingTask.description}
                                    onChange={(e) =>
                                      setEditingTask((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              description: e.target.value,
                                            }
                                          : null
                                      )
                                    }
                                    placeholder="Edit task description"
                                  />
                                  {task.type === "goal-oriented" && (
                                    <input
                                      type="number"
                                      value={editingTask.goal ?? ""}
                                      onChange={(e) =>
                                        setEditingTask((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                goal: Number(e.target.value),
                                              }
                                            : null
                                        )
                                      }
                                      placeholder="Edit goal"
                                    />
                                  )}
                                  <div
                                    style={{ display: "flex", gap: "0.5rem" }}
                                  >
                                    <button
                                      onClick={() => saveTaskEdits(user.email)}
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingTask(null)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <span>{task.description}</span>
                                  {task.type === "goal-oriented" && (
                                    <span className="text-xs">
                                      Goal: {task.progress}/{task.goal}
                                    </span>
                                  )}
                                  <div className="flex gap-2 mt-1">
                                    {!task.completed && (
                                      <button
                                        className="edit-icon"
                                        onClick={() =>
                                          setEditingTask({
                                            taskId: task.id,
                                            description: task.description,
                                            goal: task.goal,
                                          })
                                        }
                                        title="Edit Task"
                                      >
                                        ✏️
                                      </button>
                                    )}
                                    <button
                                      className="delete-icon"
                                      onClick={() =>
                                        deleteTask(user.email, task.id)
                                      }
                                      title="Delete Task"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="#fff"
                                        width="16"
                                        height="16"
                                      >
                                        <path d="M3 6h18v2H3V6zm2 3h14v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9zm5 2v8h2v-8H8zm4 0v8h2v-8h-2zM9 4V2h6v2h5v2H4V4h5z" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </li>
                        ))
                      ) : (
                        <li className="italic text-yellow-300">No tasks</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminMenu;
