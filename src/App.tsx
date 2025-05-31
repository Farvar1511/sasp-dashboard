import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./components/Login";
import Home from "./pages/Home";
import SASPRoster from "./components/SASPRoster";
import Fleet from "./components/Fleet";
import Documents from "./components/Documents";
import FTO from "./pages/FTO";
import CIUManagement from "./pages/CIUManagement";
import AdminMenu from "./components/AdminMenu";
import PromotionsTab from "./components/PromotionsTab"; // Import PromotionsTab
import Bulletins from "./components/Bulletins"; // Import Bulletins
import ProtectedRoute from "./components/ProtectedRoute";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css"; // Ensure global styles are imported
import { LinksProvider } from "./context/LinksContext"; // Import LinksProvider
import Outfits from "./components/Outfits"; // Import Outfits component
import PublicSubmitCIUTip from './pages/PublicSubmitCIUTip'; // Import PublicSubmitCIUTip component

function App() {
  return (
    // Move Router to wrap AuthProvider and LinksProvider
    <Router>
      <AuthProvider>
        <LinksProvider> {/* Wrap with LinksProvider */}
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            {/* Ensure the route for /roster exists and uses the SASPRoster component */}
            <Route
              path="/roster"
              element={
                <ProtectedRoute>
                  <SASPRoster />
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
              path="/documents"
              element={
                <ProtectedRoute>
                  <Documents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/fto"
              element={
                <ProtectedRoute requiredRole="isFTOQualifiedOrCadet">
                  <FTO />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ciu"
              element={
                <ProtectedRoute requiredRole="canAccessCIU">
                  <CIUManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="isAdmin">
                  <AdminMenu />
                </ProtectedRoute>
              }
            />
            {/* Add routes for Promotions and Bulletins */}
            <Route
              path="/promotions"
              element={
                <ProtectedRoute requiredRole="isAdmin">
                  <PromotionsTab />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bulletins"
              element={
                <ProtectedRoute requiredRole="isAdmin">
                  <Bulletins />
                </ProtectedRoute>
              }
            />
            <Route
              path="/outfits"
              element={
                <ProtectedRoute>
                  <Outfits />
                </ProtectedRoute>
              }
            />
            <Route path="/submit-ciu-tip" element={<PublicSubmitCIUTip />} />
            {/* Add other routes as needed */}
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
            theme="dark" // Use dark theme for toast
          />
        </LinksProvider> {/* Close LinksProvider */}
      </AuthProvider>
    </Router> // Close Router
  );
}

export default App;
