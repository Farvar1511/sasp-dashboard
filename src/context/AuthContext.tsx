import React, { createContext, useContext, useState, useEffect } from "react";
import { User as FirebaseUser, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { User } from "../types/User";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(null); // Reset user state
      setLoading(true); // Start loading

      if (firebaseUser && firebaseUser.email) {
        const userEmail = firebaseUser.email;
        try {
          const userDocRef = doc(db, "users", userEmail);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();

            // Map Firestore data to the User interface
            const completeUser: User = {
              uid: firebaseUser.uid, // Add the uid property
              email: userEmail,
              name: userData.name,
              rank: userData.rank,
              badge: userData.badge,
              role: userData.role || "user",
              callsign: userData.callsign,
              certifications: userData.certifications || {},
              isActive: userData.isActive ?? false,
              loaStartDate: userData.loaStartDate || undefined,
              loaEndDate: userData.loaEndDate || undefined,
              discordId: userData.discordId || undefined,
              discipline: userData.discipline || undefined, // Now valid
              disciplineIssuedAt: userData.disciplineIssuedAt || undefined, // Now valid
              notes: userData.notes || undefined, // Now valid
              notesIssuedAt: userData.notesIssuedAt || undefined, // Now valid
              joinDate: userData.joinDate || undefined,
              lastPromotionDate: userData.lastPromotionDate || undefined,
              category: userData.category || undefined,
              cid: userData.cid || undefined,
              isPlaceholder: userData.isPlaceholder ?? false,
              isAdmin: userData.isadmin ?? false, // Map `isadmin?` to `isAdmin`
            };

            setUser(completeUser);
          } else {
            console.error(`User profile not found for email: ${userEmail}`);
            setUser(null);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser(null);
        }
      } else {
        console.log("User is signed out or missing email.");
        setUser(null);
      }

      setLoading(false); // Stop loading
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    console.warn("Login function not fully implemented.");
  };

  const logout = () => {
    auth.signOut().catch((error) => {
      console.error("Sign out error:", error);
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
