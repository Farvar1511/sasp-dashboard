import React from "react";
import Layout from "./Layout";
import { User } from "../types/User"; // Import the shared User type

interface TasksProps {
  user: User; // Define the user prop
}

const Tasks: React.FC<TasksProps> = ({ user }) => {
  return (
    <Layout user={user}>
      {/* Your Tasks UI here */}
      <h1 className="text-2xl font-bold">Hello, {user.name}</h1>
    </Layout>
  );
};

export default Tasks;
