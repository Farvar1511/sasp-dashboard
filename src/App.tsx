import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./components/Login"; // Login page
import Home from "./pages/Home"; // Home page
import Documents from "./components/Documents"; // Documents page
import Fleet from "./components/Fleet"; // Fleet page
import SASPRoster from "./components/SASPRoster"; // SASP Roster page
import AdminMenu from "./components/AdminMenu"; // Admin Menu page

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={<Home />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/sasp-roster" element={<SASPRoster />} />
          <Route path="/admin" element={<AdminMenu />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
