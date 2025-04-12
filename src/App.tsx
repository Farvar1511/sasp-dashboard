import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
              name: userData.name || 'Unknown',
              rank: userData.rank || 'Unknown',
              tasks: userData.tasks || [],
              isAdmin: userData.isAdmin || false, // Use isAdmin from Firestore
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
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    // Show a loading screen while user data is being fetched
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        {/* Redirect to Login if user is not logged in */}
        <Route
          path="/"
          element={
            user ? (
              <Dashboard user={user} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <Login onLogin={(loggedInUser) => setUser(loggedInUser)} />
            )
          }
        />
        {user && <Route path="/tasks" element={<Tasks user={user} />} />}
        <Route path="/badge-lookup" element={<BadgeLookup />} />
        {user && (user.isAdmin || ['Staff Sergeant', 'SSgt.', 'Commander', 'Commissioner'].includes(user.rank)) && (
          <Route path="/admin-menu" element={<AdminMenu currentUser={user} />} />
        )}
      </Routes>
    </Router>
  );
}

export default App;
