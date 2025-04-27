import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  User as FirebaseUser,
  updateProfile, // Import updateProfile
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"; // Import updateDoc
import { auth, db } from "../firebase"; // db might be named dbFirestore in your project
import { useNavigate } from "react-router-dom";
import { User, RosterUser } from "../types/User"; // Assuming RosterUser is the Firestore user type
import { computeIsAdmin } from "../utils/isadmin";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfilePhoto: (newPhotoURL: string) => Promise<void>; // Add function type
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Use email or name as the document ID, matching your Firestore structure
          // Adjust this logic if your document ID is different (e.g., firebaseUser.uid)
          const userDocId = firebaseUser.email || firebaseUser.displayName; // Or determine ID based on your structure
          if (!userDocId) {
            throw new Error("Cannot determine user document ID.");
          }
          const userRef = doc(db, "users", userDocId); // Use correct db instance
          const userDoc = await getDoc(userRef);

          let userData: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL, // Get photoURL from Firebase Auth
            // Initialize other fields as undefined or default
            id: userDocId,
            name: undefined,
            rank: undefined,
            // ... other fields
          };

          if (userDoc.exists()) {
            const firestoreData = userDoc.data() as RosterUser;
            // Merge Firestore data into the user object
            const mergedData = {
              ...userData,
              ...firestoreData,
              id: userDoc.id, // Ensure Firestore doc ID is set
            };
            // Calculate admin status using the fully merged data
            userData = {
              ...mergedData,
              isAdmin: computeIsAdmin(mergedData),
            };
          } else {
            // If Firestore doc doesn't exist, calculate isAdmin based on initial userData (from Auth)
            userData.isAdmin = computeIsAdmin(userData);
            console.warn(`Firestore document not found for user: ${userDocId}`);
            // Optionally create a basic Firestore doc if it doesn't exist
            // await setDoc(userRef, { name: firebaseUser.displayName || 'New User', email: firebaseUser.email, rank: 'Unknown', /* other defaults */ });
          }
          setUser(userData);
        } catch (error) {
          console.error("Failed to fetch user data from Firestore:", error);
          setUser(null); // Log out user if Firestore fetch fails critically
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
    // Use the pre-calculated isAdmin field if available, otherwise compute it
    return user.isAdmin ?? computeIsAdmin(user);
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
            lastSignInTime: new Date(), // Use server timestamp object
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

  // Function to update user profile photo
  const updateUserProfilePhoto = async (newPhotoURL: string) => {
    if (!auth.currentUser) {
      throw new Error("No authenticated user found.");
    }
    if (!user || !user.id) {
      throw new Error("User data or ID is missing in context.");
    }

    try {
      // 1. Update Firebase Auth profile
      await updateProfile(auth.currentUser, { photoURL: newPhotoURL });

      // 2. Update Firestore document (optional but recommended)
      const userRef = doc(db, "users", user.id); // Use the correct user ID from context
      await updateDoc(userRef, { photoURL: newPhotoURL });

      // 3. Update local state immediately for better UX
      setUser((prevUser) =>
        prevUser ? { ...prevUser, photoURL: newPhotoURL } : null
      );
    } catch (error) {
      console.error("Error updating profile photo:", error);
      throw error; // Re-throw to be caught in the modal
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin, login, logout, updateUserProfilePhoto }} // Add updateUserProfilePhoto to value
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
