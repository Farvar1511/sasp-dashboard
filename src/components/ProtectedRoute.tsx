import React from "react";
import { Navigate } from "react-router-dom"; // Removed Outlet import
import { useAuth } from "../context/AuthContext";

// Define props to accept children
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth(); // Added loading check

  // Display loading indicator while authentication status is being determined
  if (loading) {
    // Optional: Add a loading indicator consistent with the one in App.tsx
    return <div className="flex justify-center items-center h-screen bg-black text-[#f3c700]">Loading...</div>;
  }

  // If loading is finished and there's no user, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If loading is finished and user exists, render the children passed to the component
  return <>{children}</>; // Render children instead of Outlet
};

export default ProtectedRoute;
