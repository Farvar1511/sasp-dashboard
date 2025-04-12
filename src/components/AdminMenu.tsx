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
import { images } from "../data/images";

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
  const [background, setBackground] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const randomImage = images[Math.floor(Math.random() * images.length)];
    setBackground(randomImage);
  }, []);

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
      setEditingTask(null);
    } catch (err) {
      console.error("Error saving task edits:", err);
      setError("Failed to save task edits.");
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
      <div
        className="fixed inset-0 bg-cover bg-center blur-sm opacity-50 -z-10"
        style={{ backgroundImage: `url(${background})` }}
      ></div>

      <div className="page-content">
        <div className="admin-panel space-y-12">
          <div className="admin-section">
            <h2 className="section-header">Assign Task</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <select
                className="input"
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
                className="input"
                placeholder="Task Description"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
              />
              <select
                className="input"
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
                  className="input"
                  placeholder="Goal (if applicable)"
                  value={taskGoal}
                  onChange={(e) => setTaskGoal(Number(e.target.value))}
                />
              )}
            </div>
            <button className="button-primary mt-4" onClick={assignTask}>
              Assign Task
            </button>
          </div>

          <div className="admin-section">
            <h2 className="section-header">Create Bulletin</h2>
            <input
              className="input"
              placeholder="Bulletin Title"
              value={bulletinTitle}
              onChange={(e) => setBulletinTitle(e.target.value)}
            />
            <textarea
              className="input"
              placeholder="Bulletin Body"
              value={bulletinBody}
              onChange={(e) => setBulletinBody(e.target.value)}
            ></textarea>
            <button className="button-primary mt-4" onClick={createBulletin}>
              Create Bulletin
            </button>
          </div>

          <div className="admin-section">
            <h2 className="section-header">User Task Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {users.map((user) => (
                <div className="user-card" key={user.email}>
                  <h3 className="font-bold mb-2">
                    {user.name} ({user.rank})
                  </h3>
                  {user.tasks.map((task) => (
                    <div className="task-card" key={task.id}>
                      <p>{task.description}</p>
                      {task.goal && (
                        <p className="text-xs">
                          Goal: {task.progress}/{task.goal}
                        </p>
                      )}
                      <div className="flex gap-2 mt-1">
                        {!task.completed && (
                          <button
                            className="text-yellow-400 hover:text-yellow-300"
                            onClick={() =>
                              setEditingTask({
                                taskId: task.id,
                                description: task.description,
                                goal: task.goal,
                              })
                            }
                          >
                            ✏️
                          </button>
                        )}
                        <button
                          className="text-red-500 hover:text-red-300"
                          onClick={() => deleteTask(user.email, task.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminMenu;
