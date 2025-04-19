import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore"; // Re-import Timestamp
import { auth, db } from "../firebase";
import { User } from "../types/User";
import { useNavigate } from "react-router-dom"; // Import useNavigate

// Define rank order for admin check
const adminRanks = [
  "lieutenant",
  "captain",
  "commander",
  "assistant commissioner",
  "deputy commissioner",
  "commissioner",
];

interface AuthContextProps {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  isAdmin: false,
  logout: async () => {},
  login: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); // Ensure useNavigate is used correctly

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        try {
          const userDocRef = doc(db, "users", firebaseUser.email);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const firestoreData = userSnap.data();
            const isAdmin =
              firestoreData.role?.toLowerCase() === "admin" ||
              adminRanks.includes(firestoreData.rank?.toLowerCase() || "");

            const fullUser: User = {
              ...firestoreData,
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              id: userSnap.id,
              isAdmin,
            };
            setUser(fullUser);
          } else {
            console.warn(
              `User doc not found in Firestore for email: ${firebaseUser.email}`
            );
            setUser(null);
          }
        } catch (error) {
          console.error("Failed to fetch user data from Firestore:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []); // Ensure this effect runs only once on mount

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const userRankLower = user.rank?.toLowerCase() || "";
    const userRoleLower = user.role?.toLowerCase() || "";
    return userRoleLower === "admin" || adminRanks.includes(userRankLower);
  }, [user]);

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      navigate("/login", { replace: true }); // Redirect to login after logout
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Update Firestore with lastSignInTime using server timestamp
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDocRef = doc(db, "users", firebaseUser.email);
          await updateDoc(userDocRef, {
            lastSignInTime: Timestamp.now(), // Use server timestamp object
          });
          console.log("Successfully updated lastSignInTime for user:", firebaseUser.email);
        } catch (firestoreError) {
          console.error("Failed to update lastSignInTime in Firestore:", firestoreError);
        }
      }

      navigate("/home"); // Navigate to Home page
    } catch (error) {
      console.error("Login failed:", error);
      throw error; // Re-throw the error so the Login component can catch it
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, logout, login }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
