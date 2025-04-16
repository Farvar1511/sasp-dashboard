import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider } from "./context/AuthContext";
import { LinksProvider } from "./context/LinksContext";
import Login from "./components/Login"; // Login page
import Home from "./pages/Home"; // Home page
import Documents from "./components/Documents"; // Documents page
import Fleet from "./components/Fleet"; // Fleet page
import SASPRoster from "./components/SASPRoster"; // SASP Roster page
import AdminMenu from "./components/AdminMenu"; // Admin Menu page
import Bulletins from "./components/Bulletins"; // Bulletins page

const App: React.FC = () => {
  return (
    <LinksProvider>
      <div>
        <Router>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/home" element={<Home />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/fleet" element={<Fleet />} />
              <Route path="/sasp-roster" element={<SASPRoster />} />
              <Route path="/admin" element={<AdminMenu />} />
              <Route path="/bulletins" element={<Bulletins />} />{" "}
              {/* Added Bulletins route */}
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
