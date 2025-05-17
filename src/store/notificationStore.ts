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
    unreadCount: number; // Count of unread messages
}

export interface NotificationStore {
    notifications: Record<string, UnreadNotification[]>; // Correctly typed
    setNotifications: (context: string, notifications: UnreadNotification[]) => void;
    clearNotifications: (context: string) => void;
    getUnreadCount: (context: string) => number;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
    notifications: {}, // Initial state is an empty object

    setNotifications: (context, newNotifications) =>
        set(state => ({
            notifications: {
                ...state.notifications,
                [context]: newNotifications,
            },
        })),

    clearNotifications: (context) =>
        set(state => ({
            notifications: {
                ...state.notifications,
                [context]: [],
            },
        })),

    getUnreadCount: (context) => {
        const contextNotifications = get().notifications[context] || [];
        return contextNotifications.reduce((sum, notif) => sum + (notif.unreadCount || 0), 0);
    },
}));