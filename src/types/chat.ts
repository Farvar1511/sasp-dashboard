import { Timestamp, FieldValue } from 'firebase/firestore';

export interface ChatMessage {
    id: string;
    sender: "me" | "other"; // Add sender property
    name: string; // Sender's display name
    avatarUrl?: string; // Sender's avatar URL
    time?: string; // Formatted time string
    type?: "text" | "image" | "file"; // Message type (optional, default to text if content exists)
    content?: string; // Text content or URL for image/file
    timestamp: Timestamp | FieldValue; // Firestore timestamp for sorting/ordering
    uid: string; // User ID (e.g., CID or email)
    groupId?: string; // Group ID for group messages (optional)
    senderId?: string; // Original sender ID (e.g., CID)
    recipientId?: string; // Original recipient ID (for direct messages)
    text?: string; // Original text content
    imageUrl?: string; // Original image URL
    senderName?: string; // Original sender name from Firestore message doc
    isEmbedded?: boolean; // Add this optional property
}

