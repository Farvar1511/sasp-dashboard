import { create } from 'zustand';
import { Timestamp } from 'firebase/firestore';

export interface UnreadNotification {
    id: string;
    name: string;
    context: string;
    timestamp: Timestamp | null;
    targetType: 'group' | 'direct';
    targetId: string;
    stableId: string; // Added stableId property
}

interface NotificationState {
    ciuNotifications: UnreadNotification[];
    departmentNotifications: UnreadNotification[];
    setNotifications: (source: 'ciu' | 'department', notifications: UnreadNotification[]) => void;
    getAllNotifications: () => UnreadNotification[];
    getTotalUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    ciuNotifications: [],
    departmentNotifications: [],
    setNotifications: (source, notifications) => {
        // Ensure unique notifications per source before setting
        const uniqueNotifications = Array.from(new Map(notifications.map(n => [n.id, n])).values());
        if (source === 'ciu') {
            set({ ciuNotifications: uniqueNotifications });
        } else {
            set({ departmentNotifications: uniqueNotifications });
        }
        // Log combined count after update
        // console.log(`Notifications updated (${source}). Total: ${get().getTotalUnreadCount()}`);
    },
    getAllNotifications: () => {
        const { ciuNotifications, departmentNotifications } = get();
        // Combine and sort by timestamp descending
        const combined = [...ciuNotifications, ...departmentNotifications];
        // Ensure unique notifications across both sources before sorting
        const uniqueCombined = Array.from(new Map(combined.map(n => [n.id, n])).values());
        return uniqueCombined.sort((a, b) => {
            const timeA = a.timestamp?.toMillis() ?? 0;
            const timeB = b.timestamp?.toMillis() ?? 0;
            return timeB - timeA;
        });
    },
    getTotalUnreadCount: () => {
        // Count unique notification IDs across both sources
        const { ciuNotifications, departmentNotifications } = get();
        const allIds = new Set([...ciuNotifications.map(n => n.id), ...departmentNotifications.map(n => n.id)]);
        return allIds.size;
    },
}));