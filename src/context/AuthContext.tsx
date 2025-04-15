import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { User } from "../types/User";

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
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  isAdmin: false,
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
              isAdmin, // Inject isAdmin flag
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
  }, []);

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
      window.location.reload();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
