import { Timestamp, FieldValue } from 'firebase/firestore'; // Import FieldValue

export interface ChatGroup {
    id: string; // Firestore document ID
    groupName: string;
    type: 'group';
    members: string[]; // Array of user emails
    createdBy: string; // Email of the creator
    createdAt: Timestamp | FieldValue; // Allow FieldValue for serverTimestamp() on write
    lastMessageTimestamp?: Timestamp | FieldValue; // Allow FieldValue for serverTimestamp() on write
    typingUsers?: string[]; // Optional: Array of emails of users currently typing
    // Add other group-specific fields if needed
}
