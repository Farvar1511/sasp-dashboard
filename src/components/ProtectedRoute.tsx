import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { User as AuthUser } from "../types/User"; // Assuming this type includes null possibility

interface ProtectedRouteProps {
  user: AuthUser | null | undefined; // Allow undefined during loading
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ user }) => {
  // If user state is still loading (undefined), maybe show loading indicator or null
  // This check depends on how your AuthProvider handles initial loading state
  if (user === undefined) {
    // Optional: Or a proper loading spinner component
    return (
      <div className="flex justify-center items-center h-screen bg-black text-yellow-400">
        Checking Authentication...
      </div>
    );
  }

  // If user is not logged in (null), redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user is logged in, render the child route content
  return <Outlet />;
};

export default ProtectedRoute;
