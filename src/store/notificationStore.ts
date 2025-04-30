import { create } from 'zustand';
import { Timestamp } from 'firebase/firestore';

export interface UnreadNotification {
    id: string; // Firestore document ID of the chat
    name: string; // Name of the user or group
    context: 'ciu' | 'department'; // Context of the chat
    timestamp: Timestamp | null; // Timestamp of the last unread message
    targetType: 'direct' | 'group'; // Type of the chat target
    targetId: string; // CID for direct, Firestore ID for group
    stableId: string; // Stable ID (direct chat ID or group Firestore ID)
}


export interface NotificationState {
    notifications: UnreadNotification[];
    setNotifications: (type: 'ciu' | 'department', newNotifications: UnreadNotification[]) => void;
    clearNotifications: (type: 'ciu' | 'department') => void;
    removeNotification: (stableId: string) => void;
    getUnreadCount: (type: 'ciu' | 'department') => number; // Add method signature
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],

    setNotifications: (type, newNotifications) => {
        set(state => {
            // Filter out existing notifications of the same type
            const otherNotifications = state.notifications.filter(n => n.context !== type);
            // Combine with new notifications for the type
            const updatedNotifications = [...otherNotifications, ...newNotifications];
            // Sort all notifications by timestamp (newest first)
            updatedNotifications.sort((a, b) => (b.timestamp?.toMillis() ?? 0) - (a.timestamp?.toMillis() ?? 0));
            return { notifications: updatedNotifications };
        });
    },

    clearNotifications: (type) => {
        set(state => ({
            notifications: state.notifications.filter(n => n.context !== type),
        }));
    },

    removeNotification: (stableId) => {
        set(state => ({
            notifications: state.notifications.filter(n => n.stableId !== stableId),
        }));
    },

    // Implement getUnreadCount method
    getUnreadCount: (type) => {
        const state = get(); // Get current state
        return state.notifications.filter(n => n.context === type).length;
    },
}));