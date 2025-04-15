import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { User, UserTask } from "../types/User";
import { getRandomBackgroundImage } from "../utils/backgroundImage";

// NEW HELPER: Combines issueddate and issuedtime from a task to produce an assignedAt string.
const getAssignedAt = (task: UserTask): string => {
  const combined = `${task.issueddate} ${task.issuedtime}`;
  const date = new Date(combined);
  return isNaN(date.getTime()) ? combined : date.toLocaleString();
};

interface TasksProps {
  user: User | null;
}

const Tasks: React.FC<TasksProps> = ({ user }) => {
  const [background, setBackground] = useState("");
  const [tasks, setTasks] = useState<UserTask[]>([]);

  useEffect(() => {
    const fetchUserTasks = async () => {
      if (!user || !user.email) {
        return;
      }

      try {
        const tasksCollectionRef = collection(
          dbFirestore,
          "users",
          user.email,
          "tasks"
        );
        const tasksQuery = query(
          tasksCollectionRef,
          orderBy("issueddate", "desc"),
          orderBy("issuedtime", "desc")
        );
        const tasksSnapshot = await getDocs(tasksQuery);

        const fetchedTasks = tasksSnapshot.docs
          .map((doc) => {
            const data = doc.data();
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
                id: doc.id,
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
          .filter((task): task is UserTask => task !== null)
          .sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            const dateTimeA = `${a.issueddate} ${a.issuedtime}`;
            const dateTimeB = `${b.issueddate} ${b.issuedtime}`;
            return dateTimeB.localeCompare(dateTimeA);
          });

        setTasks(fetchedTasks);
      } catch (err) {
        console.error("Error fetching user tasks:", err);
      }
    };

    setBackground(getRandomBackgroundImage());
    fetchUserTasks();
  }, [user]);

  const toggleTaskCompletion = async (
    taskId: string,
    currentStatus: boolean
  ) => {
    if (!user || !user.email) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newStatus = !currentStatus;

    if (task.type === "goal" && newStatus) {
      const currentProgress = task.progress ?? 0;
      const goal = task.goal ?? Infinity;
      if (goal !== Infinity && currentProgress < goal) {
        alert(
          `Goal task cannot be marked complete. Progress (${currentProgress}/${goal}) is not 100%.`
        );
        return;
      }
    }

    const taskDocRef = doc(dbFirestore, "users", user.email, "tasks", taskId);
    try {
      await updateDoc(taskDocRef, { completed: newStatus });
      setTasks((prevTasks) =>
        prevTasks
          .map((t) => (t.id === taskId ? { ...t, completed: newStatus } : t))
          .sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            const dateTimeA = `${a.issueddate} ${a.issuedtime}`;
            const dateTimeB = `${b.issueddate} ${b.issuedtime}`;
            return dateTimeB.localeCompare(dateTimeA);
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
    if (!task || task.type !== "goal" || task.goal == null) return;

    const currentProgress = task.progress ?? 0;
    const newProgress = Math.max(
      0,
      Math.min(task.goal, currentProgress + change)
    );

    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === taskId ? { ...t, progress: newProgress } : t
      )
    );

    const taskDocRef = doc(dbFirestore, "users", user.email, "tasks", taskId);
    try {
      await updateDoc(taskDocRef, { progress: newProgress });
    } catch (err) {
      console.error("Error updating task progress:", err);
      alert("Failed to update task progress.");
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId ? { ...t, progress: currentProgress } : t
        )
      );
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
          <h1 className="text-4xl font-black uppercase text-center mb-4 drop-shadow-md text-yellow-400">
            Your Tasks
          </h1>
          {tasks.length > 0 && (
            <div className="space-y-4">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 bg-gray-800 border border-gray-700 rounded-lg shadow-sm"
                >
                  <small className="text-xs text-gray-400 block">
                    Assigned: {getAssignedAt(task)}
                  </small>

                  {task.type === "goal" && task.goal != null && (
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

                  {task.type !== "goal" && <div className="flex-grow"></div>}

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
