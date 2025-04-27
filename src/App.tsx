import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import Home from "./pages/Home";
import AdminMenu from "./components/AdminMenu";
import SASPRoster from "./components/SASPRoster";
import Fleet from "./components/Fleet";
import Documents from "./components/Documents";
import FTO from "./pages/FTO";
import PromotionsTab from "./components/PromotionsTab";
import Bulletins from "./components/Bulletins";
import DisciplineNotesPage from "./components/DisciplineNotesPage"; // Import DisciplineNotesPage
import CIUManagement from "./pages/CIUManagement"; // Import the new CIU Management component
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles/base.css";

// ... (ProtectedRoute component remains the same) ...
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    // Optional: Add a loading indicator
    return <div className="flex justify-center items-center h-screen bg-black text-[#f3c700]">Loading...</div>;
  }
  return user ? children : <Navigate to="/login" replace />;
};


function App() {
  return (
    // Router should wrap AuthProvider
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={<ProtectedRoute><Home /></ProtectedRoute>}
          />
           <Route
            path="/home"
            element={<ProtectedRoute><Home /></ProtectedRoute>}
          />
          <Route
            path="/admin"
            element={<ProtectedRoute><AdminMenu /></ProtectedRoute>}
          />
          <Route
            path="/sasp-roster"
            element={<ProtectedRoute><SASPRoster /></ProtectedRoute>}
          />
           <Route
            path="/fleet"
            element={<ProtectedRoute><Fleet /></ProtectedRoute>}
          />
           <Route
            path="/documents"
            element={<ProtectedRoute><Documents /></ProtectedRoute>}
          />
           <Route
            path="/fto"
            element={<ProtectedRoute><FTO /></ProtectedRoute>}
          />
          <Route
            path="/promotions"
            element={<ProtectedRoute><PromotionsTab /></ProtectedRoute>}
          />
           <Route
            path="/bulletins"
            element={<ProtectedRoute><Bulletins /></ProtectedRoute>}
          />
           {/* Add Route for Discipline & Notes */}
           <Route
            path="/discipline-notes"
            element={<ProtectedRoute><DisciplineNotesPage /></ProtectedRoute>}
          />
           {/* Add Route for CIU Management */}
           <Route
            path="/ciu-management" // Updated path
            element={<ProtectedRoute><CIUManagement /></ProtectedRoute>} // Use new component
          />
          {/* Add other routes as needed */}
          <Route path="*" element={<Navigate to="/" replace />} /> {/* Fallback route */}
        </Routes>
        <ToastContainer
          position="bottom-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="dark"
        />
      </AuthProvider>
    </Router>
  );
}

export default App;
