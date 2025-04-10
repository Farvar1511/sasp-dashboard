import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import your components
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Tasks from './components/Tasks';
import BadgeLookup from './components/BadgeLookup'; // New Badge Lookup Component

function App() {
  // Define the shape of the User object
  interface User {
    id?: string;
    name: string;
    rank: string;
    email: string;
  }

  // State to hold the current user (null means no user is logged in)
  const [user, setUser] = useState<User | null>(null);

  // Handler function to be called when a user logs in
  const handleLogin = (loggedInUser: User) => {
    console.log('User logged in:', loggedInUser);
    setUser(loggedInUser);
  };

  // Handler function to log the user out
  const handleLogout = () => {
    console.log('User logged out');
    setUser(null);
  };

  return (
    <Router>
      <Routes>
        {/*
          For the root path ("/"), we conditionally render:
          - Dashboard (if a user is logged in), passing the user and logout handler.
          - Login (if no user is logged in), passing the login handler.
        */}
        <Route path="/" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Login onLogin={handleLogin} />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/badge-lookup" element={<BadgeLookup />} /> {/* New Route for Badge Lookup */}
      </Routes>
    </Router>
  );
}

export default App;
