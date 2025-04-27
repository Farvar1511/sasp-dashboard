import { Timestamp, FieldValue } from 'firebase/firestore'; // Import FieldValue
import { User } from '../types/User'; // Import the User type
import { computeIsAdmin } from './isadmin'; // Import admin check

// Define interfaces
export interface Gang {
  id: string;
  name: string;
  description?: string | null; // Added description
  level?: number | null; // Changed to number | null
  clothingInfo?: string;
  locationInfo?: string;
  vehiclesInfo?: string; // General info about vehicles
  createdByName?: string;
  createdAt?: Timestamp;
  updatedByName?: string;
  updatedAt?: Timestamp | FieldValue; // Allow FieldValue for serverTimestamp()
  notes?: string; // Main notes field for the gang
  photoUrl?: string;
}

export interface GangMember {
  id: string;
  gangId: string; // Ensure this is present if using top-level collection
  name: string;
  rankInGang: string | null; // Allow null
  phoneNumber?: string | null;
  notes?: string | null;
  addedAt: Timestamp;
  addedBy: string; // User ID who added
  addedByName: string; // User Name who added
  addedById?: string; // User ID who added (potentially redundant)
  sortOrder?: number;
}

// Interface for specific vehicle sightings/records (subcollection)
export interface GangVehicle {
    id: string; // Firestore doc ID
    plate: string;
    model?: string; // Optional
    memberName?: string; // Who was seen with it
    activityNotes: string; // Crime/Suspicious activity
    timestamp: Timestamp;
    addedByName?: string; // Added
}

// Interface for individual notes/updates (subcollection)
export interface GangNote {
    id: string; // Firestore doc ID
    note: string;
    author: string; // Changed from authorId for simplicity
    timestamp: Timestamp;
}


// --- Case File Interface --- 
export type CaseStatus = 'Open - Unassigned' | 'Open - Assigned' | 'Under Review' | 'Closed - Solved' | 'Closed - Unsolved' | 'Archived';

export interface CaseFile {
  id: string;
  title: string;
  description: string; // Brief overview
  status: CaseStatus;
  createdAt: Timestamp;
  createdBy: string; // User ID
  createdByName: string; // User Name
  // Add other potential fields based on CreateCaseModal
  assignedToId?: string | null;
  assignedToName?: string | null;
  lastUpdatedAt?: Timestamp;
  imageLinks?: string[];
  details?: string; // JSON string containing incidentReport, evidence, photos, location, namesOfInterest, gangInfo, updates
}

// --- CIU Permissions ---
// Function to check if a user has permission to manage CIU features
export const hasCIUPermission = (user: User | null): boolean => {
  if (!user) return false;

  const isAdmin = computeIsAdmin(user); // Use the imported helper
  const ciuCert = user.certifications?.CIU?.toUpperCase();
  return isAdmin || ciuCert === 'LEAD' || ciuCert === 'SUPER';
};
