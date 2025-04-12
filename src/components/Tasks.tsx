import React, { useEffect, useState } from "react";
import Layout from "./Layout";
import { User } from "../types/User";
import { images } from "../data/images";

interface Task {
  id: string;
  description: string;
  assignedAt: string;
  completed: boolean;
  type?: string;
  progress?: number;
  goal?: number;
}

interface TasksProps {
  user: User;
}

const Tasks: React.FC<TasksProps> = ({ user }) => {
  const [background, setBackground] = useState("");
  const [tasks, setTasks] = useState<Task[]>(user.tasks);

  useEffect(() => {
    const randomImage = images[Math.floor(Math.random() * images.length)];
    setBackground(randomImage);
  }, []);

  return (
    <Layout user={user}>
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center blur-sm opacity-50 -z-10"
        style={{ backgroundImage: `url(${background})` }}
      ></div>

      {/* Main Content */}
      <div className="page-content">
        <div className="max-w-7xl mx-auto px-6 pt-12">
          {/* Header */}
          <h1 className="text-4xl font-black uppercase text-center mb-4 drop-shadow-md">
            Tasks
          </h1>
          <p className="text-lg font-semibold text-center mb-8">
            This is where your tasks will be displayed.
          </p>

          {/* Tasks */}
          {tasks.length === 0 ? (
            <div className="text-center text-yellow-300 italic">
              🎉 No tasks assigned. Enjoy the peace!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-gray-800 text-yellow-400 rounded-lg p-5 shadow-lg space-y-3"
                >
                  <h3 className="text-lg font-semibold">{task.description}</h3>
                  <p className="text-sm text-yellow-300">
                    Assigned: {new Date(task.assignedAt).toLocaleString()}
                  </p>

                  {task.type === "goal-oriented" && task.goal && (
                    <div>
                      <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400"
                          style={{
                            width: `${(task.progress! / task.goal!) * 100}%`,
                          }}
                        ></div>
                      </div>
                      <p className="text-sm">
                        Progress: {task.progress} / {task.goal}
                      </p>
                    </div>
                  )}

                  {task.completed ? (
                    <div className="text-green-400 font-semibold text-center">
                      ✅ Task Completed
                    </div>
                  ) : (
                    <div className="text-red-400 font-semibold text-center">
                      ⏳ Task In Progress
                    </div>
                  )}
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
