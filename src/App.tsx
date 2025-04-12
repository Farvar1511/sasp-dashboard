import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Tasks from "./components/Tasks";
import Bulletins from "./components/Bulletins";
import BadgeLookup from "./components/BadgeLookup";
import AdminMenu from "./components/AdminMenu";
import DisciplineNotes from "./components/DisciplineNotes";
import RosterManagement from "./components/RosterManagement";
import SASPRoster from "./components/SASPRoster";
import FleetManagement from "./components/FleetManagement"; // Import Admin Fleet
import Fleet from "./components/Fleet"; // Import User Fleet View
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-black text-yellow-400">
        Loading Authentication...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute user={user} />}>
        <Route path="/" element={<Dashboard user={user!} />} />
        <Route path="/tasks" element={<Tasks user={user!} />} />
        <Route path="/bulletins" element={<Bulletins user={user!} />} />
        <Route path="/badge-lookup" element={<BadgeLookup />} />
        <Route path="/sasp-roster" element={<SASPRoster user={user!} />} />
        <Route path="/fleet" element={<Fleet user={user!} />} />{" "}
        {/* Add route for Fleet view */}
        {/* Admin Routes */}
        <Route element={<AdminRoute user={user} />}>
          <Route path="/admin" element={<AdminMenu user={user!} />} />
          <Route
            path="/admin/discipline"
            element={<DisciplineNotes user={user!} />}
          />
          <Route
            path="/admin/roster"
            element={<RosterManagement user={user!} />}
          />
          <Route
            path="/admin/fleet"
            element={<FleetManagement user={user!} />} // Add route for Fleet Management
          />
        </Route>
      </Route>

      {/* Fallback Route (Optional) */}
      <Route path="*" element={<Login />} />
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
