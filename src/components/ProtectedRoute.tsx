import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { User } from "../types/User"; // Assuming User type includes authentication status or relevant info

interface ProtectedRouteProps {
  user: User | null | undefined; // User object or null/undefined if not logged in
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ user }) => {
  // If user is explicitly null or undefined (not logged in), redirect to login
  if (user === null || user === undefined) {
    return <Navigate to="/login" replace />;
  }

  // If user exists (is logged in), render the nested routes
  return <Outlet />;
};

export default ProtectedRoute;
