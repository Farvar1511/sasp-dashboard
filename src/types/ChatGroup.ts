import { Timestamp, FieldValue } from 'firebase/firestore'; // Import FieldValue
import { User } from './User'; // Import User type

export interface ChatGroup {
    id: string; // Firestore document ID
    groupName: string;
    type: 'group';
    members: string[]; // Array of user emails
    createdBy: string; // Email of the creator
    createdAt: Timestamp | FieldValue; // Allow FieldValue for serverTimestamp() on write
    lastMessageTimestamp?: Timestamp | FieldValue; // Allow FieldValue for serverTimestamp() on write
    typingUsers?: string[]; // Optional: Array of emails of users currently typing
    lastRead?: { [email: string]: Timestamp | FieldValue }; 
    context: 'ciu' | 'department';
    iconUrl?: string; // Optional icon URL for the group
    participants?: User[]; // Add participants as an optional property

}
