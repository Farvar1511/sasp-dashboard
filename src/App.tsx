import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

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
  const [loading, setLoading] = useState(true); // Add loading state

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.email!);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              email: firebaseUser.email!,
              name: userData.name || 'Unknown', // Provide default value if missing
              rank: userData.rank || 'Unknown', // Provide default value if missing
              tasks: userData.tasks || [], // Provide default value if missing
            });
          } else {
            console.error('User data not found in Firestore.');
            setUser(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false); // Set loading to false after processing
    });

    return () => unsubscribe();
  }, []);

  // Handler function to log the user out
  const handleLogout = () => {
    console.log('User logged out');
    setUser(null); // Clear the user state
  };

  if (loading) {
    // Show a loading screen while user data is being fetched
    return <div>Loading...</div>;
  }

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
              <Login onLogin={(loggedInUser) => setUser(loggedInUser)} /> // Render Login if no user is logged in
            )
          }
        />
        {/* Render Tasks only if a user is logged in */}
        {user && <Route path="/tasks" element={<Tasks user={user} />} />}
        {/* Render Badge Lookup */}
        <Route path="/badge-lookup" element={<BadgeLookup />} />
        {/* Render Admin Menu only if a user is logged in and has the required rank */}
        {user && user.rank && ['Staff Sergeant', 'Commander', 'Commissioner'].includes(user.rank) && (
          <Route path="/admin-menu" element={<AdminMenu currentUser={user} />} />
        )}
      </Routes>
    </Router>
  );
}

export default App;
