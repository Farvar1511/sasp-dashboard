import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { computeIsAdmin } from "../utils/isadmin";

const AdminRoute: React.FC = () => {
  const { user } = useAuth();

  const isAdmin = computeIsAdmin(user); // Ensure admin access matches the menu logic

  if (!isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
