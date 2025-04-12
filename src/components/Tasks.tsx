import React from "react";
import Layout from "./Layout";
import { User } from "../types/User"; // Import the shared User type

interface TasksProps {
  user: User; // Define the user prop
}

const Tasks: React.FC<TasksProps> = ({ user }) => {
  return (
    <Layout user={user}>
      <div className="page-content">
        <h1 className="text-2xl font-bold">Tasks</h1>
        {/* Add task-related content */}
      </div>
    </Layout>
  );
};

export default Tasks;
