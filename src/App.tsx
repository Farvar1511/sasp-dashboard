import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./components/Login";
import Dashboard from "./components/HomePage";
import Bulletins from "./components/Bulletins";
import AdminBulletins from "./components/AdminBulletins";
import BadgeLookup from "./components/BadgeLookup";
import AdminMenu from "./components/AdminMenu";
import DisciplineNotes from "./components/DisciplineNotes";
import RosterManagement from "./components/RosterManagement";
import SASPRoster from "./components/SASPRoster";
import FleetManagement from "./components/FleetManagement";
import Fleet from "./components/Fleet";
import MyDashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";

function AppContent() {
  const { user, loading } = useAuth(); // Get user and loading state from useAuth

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-black text-yellow-400">
        Loading Authentication...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} /> {/* Home */}
        <Route path="/bulletins" element={<Bulletins />} />
        <Route path="/badge-lookup" element={<BadgeLookup />} />
        {user && <Route path="/sasp-roster" element={<SASPRoster />} />}
        {user && <Route path="/fleet" element={<Fleet user={user} />} />}
        <Route path="/my-dashboard" element={<MyDashboard />} />
        {/* Admin Routes (Nested under ProtectedRoute) */}
        <Route element={<AdminRoute />}>
          {user && <Route path="/admin" element={<AdminMenu user={user} />} />}
          {user && (
            <Route
              path="/admin/discipline"
              element={<DisciplineNotes user={user} />}
            />
          )}
          <Route path="/admin/roster" element={<RosterManagement />} />
          <Route path="/admin/fleet" element={<FleetManagement />} />
          <Route path="/admin/bulletins" element={<AdminBulletins />} />{" "}
          {/* Add this route */}
        </Route>
      </Route>
      {/* Fallback Route */}
      <Route path="*" element={<LoginPage />} /> {/* Or a NotFound component */}
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
