import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LinksProvider } from "./context/LinksContext";
import Login from "./components/Login";
import Home from "./pages/Home";
import Documents from "./components/Documents";
import Fleet from "./components/Fleet";
import SASPRoster from "./components/SASPRoster";
import AdminMenu from "./components/AdminMenu";
import Bulletins from "./components/Bulletins";
import FTOPage from "./pages/FTO";
import PromotionsTab from "./components/PromotionsTab";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return <div>Loading...</div>;
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) {
    return <div>Loading...</div>;
  }
  return user && isAdmin ? <>{children}</> : <Navigate to="/home" replace />;
};

const SgtPlusRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const adminVoterRanks = [
    "sergeant",
    "staff sergeant",
    "lieutenant",
    "captain",
    "commander",
    "assistant commissioner",
    "deputy commissioner",
    "commissioner",
  ];
  const isSgtPlus =
    user && adminVoterRanks.includes(user.rank?.toLowerCase() || "");

  if (loading) {
    return <div>Loading...</div>;
  }
  return user && isSgtPlus ? <>{children}</> : <Navigate to="/home" replace />;
};

const App: React.FC = () => {
  return (
    <LinksProvider>
      <div>
        <Router>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents"
                element={
                  <ProtectedRoute>
                    <Documents />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fleet"
                element={
                  <ProtectedRoute>
                    <Fleet />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sasp-roster"
                element={
                  <ProtectedRoute>
                    <SASPRoster />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminMenu />
                  </AdminRoute>
                }
              />
              <Route
                path="/bulletins"
                element={
                  <ProtectedRoute>
                    <Bulletins />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fto"
                element={
                  <ProtectedRoute>
                    <FTOPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/promotions"
                element={
                  <SgtPlusRoute>
                    <PromotionsTab />
                  </SgtPlusRoute>
                }
              />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </AuthProvider>
        </Router>
        <ToastContainer />
      </div>
    </LinksProvider>
  );
};

export default App;
