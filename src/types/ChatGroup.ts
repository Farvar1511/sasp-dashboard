import { Timestamp } from 'firebase/firestore';

export interface ChatGroup {
  id: string; // Firestore document ID
  type: 'group';
  groupName: string;
  members: string[]; // Array of member emails
  createdAt: Timestamp;
  lastMessage?: string; // Optional: For display in sidebar
  lastMessageTimestamp?: Timestamp; // Optional: For sorting/display
}
