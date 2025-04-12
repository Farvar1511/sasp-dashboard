import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { User } from "../types/User"; // Use the User type which should include isAdmin

interface AdminRouteProps {
  user: User | null | undefined; // User object from auth context
}

const AdminRoute: React.FC<AdminRouteProps> = ({ user }) => {
  // Check if user exists and has the isAdmin flag set to true
  const isAdmin = user?.isAdmin === true;

  if (!isAdmin) {
    // Redirect non-admins to the main dashboard or show an error page
    // console.warn("Access denied: User is not an admin.");
    return <Navigate to="/" replace />;
    // Alternatively, render an "Unauthorized" component:
    // return <div>Unauthorized Access</div>;
  }

  // If user is an admin, render the nested admin routes
  return <Outlet />;
};

export default AdminRoute;
