import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import your components
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Tasks from './components/Tasks';
import BadgeLookup from './components/BadgeLookup';
import AdminMenu from './components/AdminMenu';

// Import the shared User interface
import { User } from './types/User';

function App() {
  // State to hold the current user (null means no user is logged in)
  const [user, setUser] = useState<User | null>(null);

  // Handler function to be called when a user logs in
  const handleLogin = (loggedInUser: User) => {
    console.log('User logged in:', loggedInUser);
    setUser(loggedInUser); // Update the user state
  };

  // Handler function to log the user out
  const handleLogout = () => {
    console.log('User logged out');
    setUser(null); // Clear the user state
  };

  return (
    <Router>
      <Routes>
        {/* Render Dashboard or Login based on user state */}
        <Route
          path="/"
          element={
            user ? (
              <Dashboard user={user} /> // Render Dashboard if user is logged in
            ) : (
              <Login onLogin={handleLogin} /> // Render Login if no user is logged in
            )
          }
        />
        {/* Render Tasks only if a user is logged in */}
        {user && <Route path="/tasks" element={<Tasks user={user} />} />}
        {/* Render Badge Lookup */}
        <Route path="/badge-lookup" element={<BadgeLookup />} />
        {/* Render Admin Menu only if a user is logged in */}
        {user && <Route path="/admin-menu" element={<AdminMenu currentUser={user} />} />}
      </Routes>
    </Router>
  );
}

export default App;
