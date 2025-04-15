import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./components/Login"; // Login page
import Home from "./pages/Home"; // Home page
import Documents from "./components/Documents"; // Documents page
import Bulletins from "./components/Bulletins";
import SASPRoster from "./components/SASPRoster";
import Fleet from "./components/Fleet";
import AdminMenu from "./components/AdminMenu";
import DisciplineNotes from "./components/DisciplineNotes";
import AdminRoute from "./components/AdminRoute";
import { computeIsAdmin } from "./utils/isadmin";

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-black">
        <div className="text-[#f3c700] text-xl">Loading...</div>
      </div>
    );
  }

  const isAdmin = computeIsAdmin(user); // Use computeIsAdmin to check admin access

  return user ? (
    isAdmin || window.location.pathname !== "/admin" ? (
      <Outlet />
    ) : (
      <Navigate to="/home" replace />
    )
  ) : (
    <Navigate to="/login" replace />
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-black">
        <div className="text-[#f3c700] text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        {user && (
          <>
            <Route path="/" element={<Documents />} /> {/* Documents page */}
            <Route path="/Home" element={<Home />} /> {/* Home page */}
            <Route path="/bulletins" element={<Bulletins />} />
            <Route path="/sasp-roster" element={<SASPRoster />} />
            <Route path="/fleet" element={<Fleet />} />
            {/* Admin Routes */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminMenu />} />
              <Route
                path="/admin/discipline"
                element={<DisciplineNotes user={user} />}
              />
            </Route>
          </>
        )}
      </Route>
      <Route path="*" element={<Login />} />
    </Routes>
  );
}

export default App;
