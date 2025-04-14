import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { User, Task } from "../types/User";
import { images } from "../data/images";

interface TasksProps {
  user: User;
}

const Tasks: React.FC<TasksProps> = ({ user }) => {
  const [background, setBackground] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserTasks = async () => {
      if (!user || !user.email) {
        setError("User data is not available.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const tasksCollectionRef = collection(
          dbFirestore,
          "users",
          user.email,
          "tasks"
        );
        const tasksSnapshot = await getDocs(tasksCollectionRef);
        const fetchedTasks = tasksSnapshot.docs.map((taskDoc) => {
          const data = taskDoc.data();
          return {
            id: taskDoc.id,
            ...data,
            assignedAt:
              data.assignedAt instanceof Timestamp
                ? data.assignedAt.toDate().toISOString()
                : data.assignedAt || new Date(0).toISOString(),
          } as Task;
        });

        fetchedTasks.sort((a, b) => {
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }
          return (
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
        });

        setTasks(fetchedTasks);
      } catch (err) {
        console.error("Error fetching user tasks:", err);
        setError("Failed to load tasks.");
      } finally {
        setLoading(false);
      }
    };

    const randomImage = images[Math.floor(Math.random() * images.length)];
    setBackground(randomImage);

    fetchUserTasks();
  }, [user]);

  const toggleTaskCompletion = async (
    taskId: string,
    currentStatus: boolean
  ) => {
    if (!user || !user.email) return;
    const taskDocRef = doc(dbFirestore, "users", user.email, "tasks", taskId);
    try {
      await updateDoc(taskDocRef, { completed: !currentStatus });
      setTasks((prevTasks) =>
        prevTasks
          .map((task) =>
            task.id === taskId ? { ...task, completed: !currentStatus } : task
          )
          .sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return (
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
          })
      );
    } catch (err) {
      console.error("Error updating task completion:", err);
      alert("Failed to update task status.");
    }
  };

  const updateTaskProgress = async (taskId: string, change: number) => {
    if (!user || !user.email) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.type !== "goal-oriented" || task.goal == null) return;

    const newProgress = Math.max(
      0,
      Math.min(task.goal, (task.progress ?? 0) + change)
    );

    const taskDocRef = doc(dbFirestore, "users", user.email, "tasks", taskId);
    try {
      await updateDoc(taskDocRef, { progress: newProgress });
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId ? { ...t, progress: newProgress } : t
        )
      );
    } catch (err) {
      console.error("Error updating task progress:", err);
      alert("Failed to update task progress.");
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
    <Layout>
      <div
        className="fixed inset-0 bg-cover bg-center opacity-40 -z-10 backdrop-blur-md"
        style={{ backgroundImage: `url(${background})` }}
      ></div>

      <div className="page-content">
        <div className="max-w-7xl mx-auto px-6 pt-12">
          <h1 className="text-4xl font-black uppercase text-center mb-4 drop-shadow-md">
            Your Tasks
          </h1>
          <p className="text-lg font-semibold text-center mb-8">
            Manage your assigned duties.
          </p>

          {loading ? (
            <div className="text-center text-yellow-300 italic">
              Loading tasks...
            </div>
          ) : error ? (
            <div className="text-center text-red-500">{error}</div>
          ) : tasks.length === 0 ? (
            <div className="text-center text-yellow-300 italic">
              🎉 No tasks assigned. Enjoy the peace!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`bg-black/80 border ${
                    task.completed ? "border-green-600" : "border-yellow-400"
                  } text-yellow-400 rounded-lg p-5 shadow-lg space-y-3 flex flex-col`}
                >
                  <h3
                    className={`text-lg font-semibold ${
                      task.completed ? "line-through text-gray-500" : ""
                    }`}
                  >
                    {task.description}
                  </h3>
                  <small className="text-xs text-gray-400 block">
                    Assigned: {formatAssignedAt(task.assignedAt)}
                  </small>

                  {task.type === "goal-oriented" && task.goal != null && (
                    <div className="mt-1 flex-grow">
                      <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden my-1">
                        <div
                          className="h-full bg-yellow-400 transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              ((task.progress ?? 0) / task.goal) * 100
                            )}%`,
                          }}
                        ></div>
                      </div>
                      <p className="text-sm text-center">
                        Progress: {task.progress ?? 0} / {task.goal}
                      </p>
                      {!task.completed && (
                        <div className="flex justify-center gap-2 mt-2">
                          <button
                            className="button-secondary text-xs px-2 py-1 rounded-full"
                            onClick={() => updateTaskProgress(task.id, -1)}
                            disabled={(task.progress ?? 0) <= 0}
                          >
                            -1
                          </button>
                          <button
                            className="button-secondary text-xs px-2 py-1 rounded-full"
                            onClick={() => updateTaskProgress(task.id, 1)}
                            disabled={(task.progress ?? 0) >= task.goal}
                          >
                            +1
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {task.type !== "goal-oriented" && (
                    <div className="flex-grow"></div>
                  )}

                  <button
                    className={`w-full mt-4 px-4 py-2 rounded-md font-semibold shadow transition ${
                      task.completed
                        ? "bg-gray-600 hover:bg-gray-500 text-white"
                        : "bg-yellow-400 hover:bg-yellow-300 text-black button-primary"
                    }`}
                    onClick={() =>
                      toggleTaskCompletion(task.id, task.completed)
                    }
                  >
                    {task.completed ? "✅ Mark Incomplete" : "Mark Complete"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Tasks;
