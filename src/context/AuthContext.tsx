import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db as dbFirestore } from "../firebase";
import { User as AppUser } from "../types/User"; // Import your custom User type

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true); // Start loading

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        setLoading(true); // Set loading true whenever auth state might change
        if (firebaseUser && firebaseUser.email) {
          // Ensure email exists
          const userDocRef = doc(dbFirestore, "users", firebaseUser.email);
          try {
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              // Check ONLY for the isadmin? boolean field (matching Firestore)
              const isAdminStatus = userData["isadmin?"] === true; // Use bracket notation for the field with '?'

              // Combine Firebase Auth data with Firestore data
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                name: userData.name || "Unknown",
                rank: userData.rank || "Unknown",
                badge: userData.badge,
                cid: userData.cid,
                isAdmin: isAdminStatus, // Use the direct boolean check
                callsign: userData.callsign,
                certifications: userData.certifications,
                loaStartDate: userData.loaStartDate,
                loaEndDate: userData.loaEndDate,
                isActive: userData.isActive,
                discordId: userData.discordId,
              });
            } else {
              console.warn(
                "User document not found in Firestore for:",
                firebaseUser.email
              );
              setUser(null); // User exists in Auth but not Firestore, treat as logged out/error
            }
          } catch (error) {
            console.error("Error fetching user data from Firestore:", error);
            setUser(null); // Error fetching data, treat as logged out
          } finally {
            setLoading(false); // Firestore fetch finished (success or error)
          }
        } else {
          // User is signed out
          setUser(null);
          setLoading(false); // No user, loading finished
        }
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Run only on mount

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
