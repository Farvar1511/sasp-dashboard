import { User } from '../types/User'; // Assuming User type is here
import { Timestamp, FieldValue } from 'firebase/firestore'; // Import Timestamp and FieldValue if needed for other types

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
  updatedAt?: Timestamp; // Allow FieldValue for serverTimestamp()
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
  updatedAt: Timestamp | FieldValue;  assignedToId?: string | null;
  assignedToName?: string | null;
  lastUpdatedAt?: Timestamp;
  imageLinks?: string[];
  details?: string; // JSON string containing incidentReport, evidence, photos, location, namesOfInterest, gangInfo, updates
}

/**
 * Checks if a user has the required CIU certification level.
 * Allowed levels: TRAIN, CERT, LEAD, SUPER
 */
export const hasCIUPermission = (user: User | null): boolean => {
  if (!user || !user.certifications || !user.certifications.CIU) {
    return false;
  }
  const ciuCert = user.certifications.CIU.toUpperCase();
  // Add 'TRAIN' to the allowed list
  return ['TRAIN', 'CERT', 'LEAD', 'SUPER'].includes(ciuCert);
};
