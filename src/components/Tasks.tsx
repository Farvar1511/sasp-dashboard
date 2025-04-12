import { useEffect, useState } from "react";
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
import { db } from "../firebase";
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
  isAdmin?: boolean;
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
  const [bulletinTitle, setBulletinTitle] = useState("");
  const [bulletinBody, setBulletinBody] = useState("");
  const [editingTask, setEditingTask] = useState<{
    taskId: string;
    description: string;
    goal?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
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

  const assignTask = async () => {
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
      await addDoc(collection(db, "bulletins"), newBulletin);
      alert("✅ Bulletin created!");
      setBulletinTitle("");
      setBulletinBody("");
    } catch (err) {
      console.error("Error creating bulletin:", err);
      alert("Failed to create bulletin.");
    }
  };

  const deleteTask = async (userEmail: string, taskId: string) => {
    try {
      await deleteDoc(doc(db, "users", userEmail, "tasks", taskId));
      setUsers((prev) =>
        prev.map((user) =>
          user.email === userEmail
            ? { ...user, tasks: user.tasks.filter((t) => t.id !== taskId) }
            : user
        )
      );
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  const saveTaskEdits = async (userEmail: string) => {
    if (!editingTask) return;

    try {
      const taskRef = doc(db, "users", userEmail, "tasks", editingTask.taskId);
      await updateDoc(taskRef, {
        description: editingTask.description,
        ...(editingTask.goal !== undefined && { goal: editingTask.goal }),
      });

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

      setEditingTask(null);
    } catch (err) {
      console.error("Error saving task edits:", err);
      setError("Failed to save edits.");
    }
  };

  if (error) {
    return (
      <Layout user={currentUser}>
        <div className="text-red-500 p-6 text-center font-semibold">
          {error}
        </div>
        <button className="button-primary" onClick={() => navigate("/")}>
          Back to Dashboard
        </button>
      </Layout>
    );
  }

  return (
    <Layout user={currentUser}>
      <div className="max-w-6xl mx-auto p-6 space-y-10">
        <h1 className="text-3xl font-bold">Admin Control Panel</h1>

        {/* Task Assignment */}
        <section className="bg-gray-800 p-6 rounded-lg shadow space-y-4">
          <h2 className="text-2xl font-bold mb-2">Assign Task</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select
              className="p-2 bg-gray-700 text-yellow-400 border border-yellow-400 rounded-md"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Select User</option>
              {users.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.name} ({u.rank})
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Task Description"
              className="p-2 bg-gray-700 text-yellow-400 border border-yellow-400 rounded-md"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
            />
            <select
              className="p-2 bg-gray-700 text-yellow-400 border border-yellow-400 rounded-md"
              value={taskType}
              onChange={(e) =>
                setTaskType(e.target.value as "normal" | "goal-oriented")
              }
            >
              <option value="normal">Normal</option>
              <option value="goal-oriented">Goal-Oriented</option>
            </select>
            {taskType === "goal-oriented" && (
              <input
                type="number"
                placeholder="Goal Number"
                className="p-2 bg-gray-700 text-yellow-400 border border-yellow-400 rounded-md"
                value={taskGoal}
                onChange={(e) => setTaskGoal(Number(e.target.value))}
              />
            )}
          </div>
          <button className="button-primary mt-2" onClick={assignTask}>
            Assign Task
          </button>
        </section>

        {/* Bulletin Creator */}
        <section className="bg-gray-800 p-6 rounded-lg shadow space-y-4">
          <h2 className="text-2xl font-bold">Create Bulletin</h2>
          <input
            type="text"
            placeholder="Bulletin Title"
            className="w-full p-2 bg-gray-700 text-yellow-400 border border-yellow-400 rounded-md"
            value={bulletinTitle}
            onChange={(e) => setBulletinTitle(e.target.value)}
          />
          <textarea
            placeholder="Bulletin Body"
            className="w-full p-2 bg-gray-700 text-yellow-400 border border-yellow-400 rounded-md"
            value={bulletinBody}
            onChange={(e) => setBulletinBody(e.target.value)}
          />
          <button className="button-primary" onClick={createBulletin}>
            Create Bulletin
          </button>
        </section>

        {/* Users and Tasks */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold">User Task Overview</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => (
              <div
                key={user.email}
                className="bg-gray-800 p-4 rounded-lg shadow space-y-2"
              >
                <h3 className="text-xl font-semibold">
                  {user.name} ({user.rank})
                </h3>
                <ul className="space-y-2 text-sm">
                  {user.tasks.length > 0 ? (
                    user.tasks.map((task) => (
                      <li key={task.id} className="bg-black p-2 rounded">
                        {editingTask?.taskId === task.id ? (
                          <div className="space-y-2">
                            <input
                              className="w-full p-1 bg-gray-700 text-yellow-400 border border-yellow-400 rounded"
                              type="text"
                              value={editingTask.description}
                              onChange={(e) =>
                                setEditingTask((prev) =>
                                  prev
                                    ? { ...prev, description: e.target.value }
                                    : null
                                )
                              }
                            />
                            {task.type === "goal-oriented" && (
                              <input
                                className="w-full p-1 bg-gray-700 text-yellow-400 border border-yellow-400 rounded"
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
                              />
                            )}
                            <div className="flex gap-2">
                              <button
                                className="button-primary"
                                onClick={() => saveTaskEdits(user.email)}
                              >
                                Save
                              </button>
                              <button
                                className="button-secondary"
                                onClick={() => setEditingTask(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span>{task.description}</span>
                            {task.type === "goal-oriented" && (
                              <span className="text-xs">
                                Goal: {task.progress}/{task.goal}
                              </span>
                            )}
                            <div className="flex gap-2 mt-1">
                              <button
                                className="text-sm text-yellow-400 hover:underline"
                                onClick={() =>
                                  setEditingTask({
                                    taskId: task.id,
                                    description: task.description,
                                    goal: task.goal,
                                  })
                                }
                              >
                                ✏️ Edit
                              </button>
                              <button
                                className="text-sm text-red-500 hover:underline"
                                onClick={() => deleteTask(user.email, task.id)}
                              >
                                🗑 Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    ))
                  ) : (
                    <li className="italic text-yellow-300">No tasks</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default AdminMenu;
