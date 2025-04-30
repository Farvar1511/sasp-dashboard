"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
    getDocs,
    doc,
    getDoc, // Ensure getDoc is imported
    updateDoc,
    setDoc,
    arrayUnion,
    arrayRemove,
    Timestamp,
    QuerySnapshot,
    DocumentData,
    FieldValue, // Keep FieldValue
} from 'firebase/firestore';
import { db as dbFirestore } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { User } from '../types/User';
import { ChatGroup } from '../types/ChatGroup';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
// Import Settings icon and Popover components
import { SearchIcon, Loader2, Users, Plus, X, ArrowLeft, Settings, BellOff } from 'lucide-react'; // Add BellOff
import { toast } from 'react-toastify';
import { formatUserName, getAvatarFallback } from './Chat/utils';
import { ChatWindow } from './ChatWindow';
import { getDirectChatId } from './Chat/CIUChatInterface';
import { ChatMessage } from '../types/chat';
import { cn } from '../lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { useNotificationStore, UnreadNotification } from '../store/notificationStore'; // Keep existing imports
import { FaEyeSlash, FaSave, FaEye } from 'react-icons/fa'; // Import FaEye
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "./ui/context-menu";
import { Checkbox } from './ui/checkbox';
import { Label } from "./ui/label"; // Ensure Label is imported if not already
import { Textarea } from './ui/textarea';
// Import Popover, Slider
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "./ui/popover";
import { Slider } from "./ui/slider";
// Import RadioGroup
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
// Import Chevron icons for collapsible section
import { ChevronDown, ChevronRight } from 'lucide-react';


const chatContext = 'department';

// --- Size Presets Definition ---
const sizePresets = {
    Small: { listWidth: 280, chatWidth: 380, height: 500 },
    Medium: { listWidth: 340, chatWidth: 450, height: 600 }, // Current default
    Large: { listWidth: 400, chatWidth: 550, height: 700 },
    'Extra Large': { listWidth: 450, chatWidth: 650, height: 800 },
};
// Define SizePresetKey as the keys of sizePresets
type SizePresetKey = keyof typeof sizePresets;

// Interface for combined display items
interface DisplayChat {
    id: string; // Firestore document ID
    type: 'group' | 'direct';
    target: ChatGroup | User;
    lastMessageTimestamp: Timestamp | null;
    isUnread: boolean;
    stableId: string; // Unique ID (Firestore ID for group, generated for direct)
}

// Update props: Remove isOpen.
interface DepartmentChatPopupProps {
    onClose: () => void;
    allUsers: User[]; // Add allUsers prop
}

// Remove original width/height constants
const gapWidth = 16;
const listLeftPosition = 88;

export const DepartmentChatPopup: React.FC<DepartmentChatPopupProps> = ({
    onClose,
    allUsers,
}) => {
    const { user: currentUser } = useAuth();
    const [loadingChats, setLoadingChats] = useState(true);
    const [allUserChats, setAllUserChats] = useState<DocumentData[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState(''); // Search term for the main chat list
    const [unreadChats, setUnreadChats] = useState<Set<string>>(new Set());
    const [hiddenChatIds, setHiddenChatIds] = useState<Set<string>>(new Set()); // Initialize empty
    const [selectedChat, setSelectedChat] = useState<DisplayChat | null>(null);
    // REMOVE showHiddenChats state
    // const [showHiddenChats, setShowHiddenChats] = useState<boolean>(false);
    // ADD isHiddenChatsExpanded state
    const [isHiddenChatsExpanded, setIsHiddenChatsExpanded] = useState<boolean>(false);
    const setNotifications = useNotificationStore(state => state.setNotifications);
    const clearNotifications = useNotificationStore(state => state.clearNotifications); // Import clearNotifications
    const getUnreadCount = useNotificationStore(state => state.getUnreadCount); // Import getUnreadCount
    const listPopupRef = useRef<HTMLDivElement>(null);
    const chatPopupRef = useRef<HTMLDivElement>(null);
    const settingsPopoverRef = useRef<HTMLDivElement>(null); // <-- Add ref for settings popover
    const chatInputRef = useRef<HTMLTextAreaElement>(null);
    const currentChatIdRef = useRef<string | null>(null);

    // --- State for Active Chat View ---
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);

    // --- State for View Management ---
    type ViewMode = 'list' | 'create';
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    // --- State for Create View ---
    const [createSearchTerm, setCreateSearchTerm] = useState('');
    const [createGroupName, setCreateGroupName] = useState('');
    const [createSelectedMembers, setCreateSelectedMembers] = useState<Set<string>>(new Set());
    const [isCreating, setIsCreating] = useState(false); // Loading state for create actions
    const [fontSizePercent, setFontSizePercent] = useState(100);
    const [selectedSizePreset, setSelectedSizePreset] = useState<SizePresetKey>('Medium');
    const [isSavingSettings, setIsSavingSettings] = useState(false); // State for saving settings

    // --- Calculate Dynamic Dimensions ---
    const { listWidth: currentListWidth, chatWidth: currentChatWidth, height: currentPopupHeight } = useMemo(() => {
        return sizePresets[selectedSizePreset];
    }, [selectedSizePreset]);

    // Filter allUsers to exclude self
    const otherUsers = useMemo(() => {
        if (!Array.isArray(allUsers)) {
            return [];
        }
        return allUsers.filter(u => u.cid !== currentUser?.cid);
    }, [allUsers, currentUser?.cid]);

    // Filter users for the 'create' view based on createSearchTerm
    const createAvailablePersonnel = useMemo(() => {
        const lowerSearchTerm = createSearchTerm.toLowerCase();
        return otherUsers
            .filter(user => formatUserName(user).toLowerCase().includes(lowerSearchTerm))
            .sort((a, b) => formatUserName(a).localeCompare(formatUserName(b)));
    }, [otherUsers, createSearchTerm]);

    // --- Effects ---

    // REMOVE THIS EFFECT:
    // // Load hidden chats
    // useEffect(() => {
    //     if (currentUser?.hiddenChats_department) {
    //         setHiddenChatIds(new Set(currentUser.hiddenChats_department));
    //     }
    // }, [currentUser?.hiddenChats_department]);

    // ADD THIS EFFECT: Fetch hidden chats directly on mount
    useEffect(() => {
        let isMounted = true; // Flag to prevent state update on unmounted component
        if (currentUser?.email) {
            const userDocRef = doc(dbFirestore, 'users', currentUser.email);
            getDoc(userDocRef).then(docSnap => {
                if (isMounted && docSnap.exists()) {
                    const data = docSnap.data();
                    const hiddenChats = data[`hiddenChats_${chatContext}`]; // Use template literal
                    if (Array.isArray(hiddenChats)) {
                        setHiddenChatIds(new Set(hiddenChats));
                        console.log(`DepartmentChat: Initial hidden chats loaded for ${currentUser.email}:`, hiddenChats);
                    } else {
                         // Field might not exist yet, which is fine, initialize as empty
                         setHiddenChatIds(new Set());
                         console.log(`DepartmentChat: No 'hiddenChats_${chatContext}' field found for ${currentUser.email}, initializing empty.`);
                    }
                } else if (isMounted) {
                    // Document doesn't exist, initialize as empty
                    setHiddenChatIds(new Set());
                     console.log(`DepartmentChat: User document not found for ${currentUser.email} on initial load, initializing empty hidden chats.`);
                }
            }).catch(error => {
                console.error("DepartmentChatPopup: Error fetching user document for initial hidden chats:", error);
                // Optionally set an error state or keep hiddenChatIds empty
                if (isMounted) {
                    setHiddenChatIds(new Set()); // Fallback to empty on error
                }
            });
        } else {
            // No user email yet, initialize as empty
            setHiddenChatIds(new Set());
            console.log("DepartmentChatPopup: No user email available on mount, initializing empty hidden chats.");
        }

        return () => {
            isMounted = false; // Cleanup flag
        };
        // Run only once on mount
    }, [currentUser?.email]); // Re-run if email changes (e.g., login/logout)


    // Load User Settings (Font Size, Window Size)
    useEffect(() => {
        // Use email instead of uid
        if (currentUser?.email) {
            const userDocRef = doc(dbFirestore, 'users', currentUser.email); // Use email
            getDoc(userDocRef).then(docSnap => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as User; // Cast to User type
                    const deptSettings = data.chatSettings?.department;
                    if (deptSettings) {
                        if (deptSettings.fontSizePercent !== undefined) {
                            setFontSizePercent(deptSettings.fontSizePercent);
                        }
                        if (deptSettings.sizePreset !== undefined && sizePresets[deptSettings.sizePreset]) {
                            setSelectedSizePreset(deptSettings.sizePreset);
                        }
                    }
                }
            }).catch(error => {
                console.error("DepartmentChatPopup: Error loading user settings:", error);
                // Optionally show a toast error
            });
        }
        // Only run when currentUser.email changes
    }, [currentUser?.email]);


    // Firestore Listeners and Data Fetching (Main List)
    useEffect(() => {
        if (!currentUser?.cid) {
            setLoadingChats(false);
            setAllUserChats([]);
            setUnreadChats(new Set());
            setNotifications('department', []); // Clear notifications
            return;
        }
        setLoadingChats(true); // Set combined loading state
        setError(null);

        // Listener for ALL chats (groups and direct) for the current user in this context
        const allChatsQuery = query(
            collection(dbFirestore, 'chats'),
            where('members', 'array-contains', currentUser.cid),
            where('context', '==', chatContext)
        );

        const unsubscribe = onSnapshot(allChatsQuery, async (snapshot: QuerySnapshot<DocumentData>) => {
            const chatsData: DocumentData[] = [];
            const newUnreadChats = new Set<string>();
            let changedHiddenIds = false; // Flag to check if hiddenChatIds needs update
            const hiddenChatsUpdate: { [key: string]: any } = {}; // Firestore update object
            const currentHiddenSet = new Set(hiddenChatIds); // Capture current hidden state

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const firestoreDocId = doc.id; // Firestore Doc ID
                chatsData.push({ id: firestoreDocId, ...data }); // Store raw data including ID

                // Unread Check Logic
                const lastMessageTimestamp = data.lastMessageTimestamp as Timestamp | undefined;
                const userLastReadTimestamp = currentUser?.cid ? data.lastRead?.[currentUser.cid] as Timestamp | undefined : undefined;

                let isUnread = false;
                if (lastMessageTimestamp) {
                    // If user has never read or last message is newer
                    if (!userLastReadTimestamp || lastMessageTimestamp.toMillis() > userLastReadTimestamp.toMillis()) {
                        // Determine stable ID for the check
                        let stableIdToCheck = '';
                        if (data.type === 'group') {
                            stableIdToCheck = firestoreDocId;
                        } else if (data.type === 'direct' && currentUser?.cid) {
                            const members = data.members as string[] || [];
                            const otherMemberCid = members.find(cid => cid !== currentUser.cid);
                            if (otherMemberCid) {
                                stableIdToCheck = getDirectChatId(currentUser.cid, otherMemberCid, chatContext);
                            }
                        }

                        // Don't count the currently selected chat as unread immediately
                        if (stableIdToCheck !== currentChatIdRef.current) {
                            isUnread = true;
                            newUnreadChats.add(firestoreDocId); // Add Firestore ID to unread set
                        }
                    }
                }

                // Unhide on Receive Logic (Persistent)
                let stableId = '';
                if (data.type === 'group') {
                    stableId = firestoreDocId; // Group ID is the stable ID
                } else if (data.type === 'direct' && currentUser?.cid) {
                    const members = data.members as string[] || [];
                    const otherMemberCid = members.find(cid => cid !== currentUser.cid);
                    if (otherMemberCid) {
                        stableId = getDirectChatId(currentUser.cid, otherMemberCid, chatContext);
                    }
                }

                // Check if this chat is currently hidden (using captured state) and if it's unread
                if (stableId && currentHiddenSet.has(stableId) && isUnread) {
                    // Prepare to remove from Firestore hidden list
                    // Use arrayRemove for Firestore update
                    hiddenChatsUpdate[`hiddenChats_${chatContext}`] = arrayRemove(stableId);
                    changedHiddenIds = true;
                    // Also remove locally immediately for UI update
                    setHiddenChatIds(prev => { // This state update is fine here
                        const newSet = new Set(prev);
                        newSet.delete(stableId);
                        return newSet;
                    });
                    console.log(`DepartmentChat: Unhiding chat ${stableId} due to new message.`);
                }
            });

            setAllUserChats(chatsData); // Update state with all relevant chats
            setUnreadChats(newUnreadChats); // Update unread set
            setLoadingChats(false); // Mark combined loading as false

            // Update Firestore if any chats were unhidden
            // Ensure currentUser.email exists before attempting update
            if (changedHiddenIds && currentUser?.email) { // <--- Change uid to email
                const userDocRef = doc(dbFirestore, 'users', currentUser.email); // <--- Change uid to email
                try {
                    await updateDoc(userDocRef, hiddenChatsUpdate); // Use hiddenChatsUpdate object
                    console.log(`DepartmentChat: Updated hidden chats in Firestore for user ${currentUser.email}.`); // <--- Log using email
                } catch (error) {
                    console.error('DepartmentChatPopup: Error updating hiddenChats:', error);
                    // Consider reverting local state change on error if needed
                }
            }

        }, (err) => {
            console.error(`DepartmentChat: Error fetching all chats for context ${chatContext}:`, err);
            setError(prev => prev ? `${prev}, Failed to load chats` : 'Failed to load chats');
            setLoadingChats(false);
        });

        // Cleanup function
        return () => unsubscribe();

    }, [currentUser?.cid, currentUser?.email, setNotifications, chatContext, hiddenChatIds]); // <--- Add currentUser.email to dependency array


    // --- Effect to fetch messages for selectedChat AND manage viewMode ---
    useEffect(() => {
        let unsubscribe = () => {}; // Initialize unsubscribe

        if (selectedChat && currentUser?.cid) {
            setIsLoadingMessages(true);
            const chatDocIdToListen = selectedChat.id;
            const chatDocRef = doc(dbFirestore, 'chats', chatDocIdToListen);
            const messagesRef = collection(chatDocRef, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'asc'));

            unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedMessages: ChatMessage[] = snapshot.docs.map(doc => {
                    const data = doc.data();
                    const timestampSource = data.timestamp;
                    let timestamp: Timestamp | FieldValue;
                    if (timestampSource instanceof Timestamp) {
                        timestamp = timestampSource;
                    } else {
                        timestamp = serverTimestamp();
                    }
                    const senderUser = allUsers.find(u => u.cid === data.senderId);
                    const messageContent = data.imageUrl || data.text || '';
                    const messageType = data.imageUrl ? 'image' : 'text';

                    return {
                        id: doc.id,
                        uid: doc.id,
                        senderId: data.senderId || 'unknown',
                        type: messageType,
                        content: messageContent,
                        timestamp: timestamp,
                        senderName: data.senderName || 'Unknown User',
                        sender: currentUser?.cid && data.senderId === currentUser.cid ? 'me' : 'other',
                        name: data.senderName || 'Unknown User',
                        avatarUrl: senderUser?.photoURL || undefined,
                        time: timestamp instanceof Timestamp ? timestamp.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Pending...',
                    };
                });

                setMessages(fetchedMessages);
                setIsLoadingMessages(false);
                setChatError(null);

                // Update lastRead timestamp
                try {
                     updateDoc(chatDocRef, {
                        [`lastRead.${currentUser.cid}`]: serverTimestamp()
                     }).catch(err => console.error("DepartmentChatPopup: Error updating lastRead timestamp:", err));
                } catch (updateError) {
                     console.error("DepartmentChatPopup: Exception during lastRead update:", updateError);
                }

            }, (error) => {
                console.error("DepartmentChatPopup: Error fetching messages:", error);
                setChatError("Failed to load messages.");
                setIsLoadingMessages(false);
            });

        } else {
            // If selectedChat becomes null (e.g., going back), ensure view is 'list'
            setMessages([]);
            setIsLoadingMessages(false);
            setChatError(null);
        }

        // Cleanup function for the snapshot listener
        return () => unsubscribe();

    }, [selectedChat, currentUser?.cid, allUsers]); // Keep dependencies


    // --- Display Logic ---
    const displayChats = useMemo((): DisplayChat[] => {
        if (!currentUser?.cid) return [];

        const processedChatsMap = new Map<string, DisplayChat>(); // Key: Stable ID

        allUserChats.forEach(chatData => {
            const firestoreDocId = chatData.id;
            const members = chatData.members as string[] || [];
            const memberCount = members.length;
            const lastMsgTimestamp = chatData.lastMessageTimestamp instanceof Timestamp
                ? chatData.lastMessageTimestamp
                : null;
            let stableId: string | null = null;
            let displayChat: DisplayChat | null = null;

            // --- Check for Direct Chat (Exactly 2 members) ---
            if (memberCount === 2) {
                const otherMemberCid = members.find(cid => cid !== currentUser.cid);
                if (otherMemberCid) {
                    const user = otherUsers.find(p => p.cid === otherMemberCid);
                    if (user && currentUser.cid) {
                        stableId = getDirectChatId(currentUser.cid, otherMemberCid, chatContext);
                        displayChat = {
                            id: firestoreDocId, // Use Firestore Doc ID
                            stableId: stableId || '', // Fallback
                            type: 'direct', // Force type to 'direct' for display
                            target: user,
                            lastMessageTimestamp: lastMsgTimestamp,
                            isUnread: unreadChats.has(firestoreDocId),
                        };
                    } else if (!user) {
                        console.warn(`DepartmentChat: Could not find user details for 2-member chat participant CID: ${otherMemberCid}. Chat ID: ${firestoreDocId}`);
                    }
                } else {
                     console.warn(`DepartmentChat: Could not determine other member for 2-member chat ${firestoreDocId}. Members:`, members);
                }
            }
            // --- Check for Group Chat (3 or more members AND type is 'group') ---
            else if (memberCount >= 3 && chatData.type === 'group') {
                stableId = firestoreDocId; // Group ID is the stable ID
                const group: ChatGroup = {
                    id: firestoreDocId,
                    groupName: chatData.groupName || 'Unknown Group',
                    type: 'group',
                    members: members,
                    createdBy: chatData.createdBy || '',
                    createdAt: chatData.createdAt instanceof Timestamp ? chatData.createdAt : Timestamp.now(),
                    lastMessageTimestamp: lastMsgTimestamp ?? undefined,
                    typingUsers: chatData.typingUsers || [],
                    lastRead: chatData.lastRead || {},
                    context: chatContext,
                };
                displayChat = {
                    id: firestoreDocId,
                    stableId: stableId || '',
                    type: 'group', // Keep type as 'group'
                    target: group,
                    lastMessageTimestamp: lastMsgTimestamp,
                    isUnread: unreadChats.has(firestoreDocId),
                };
            }
            // --- Handle other invalid/ignored cases ---
            else {
                 if (memberCount === 1 && members[0] === currentUser.cid) {
                     // Ignore chats with only the current user
                     // console.log(`DepartmentChat: Ignoring chat ${firestoreDocId} with only self as member.`);
                 } else if (memberCount >= 3 && chatData.type !== 'group') {
                     // Log potentially misconfigured group chats (>=3 members but wrong type)
                     console.warn(`DepartmentChat: Ignoring chat ${firestoreDocId}. Expected type 'group' for ${memberCount} members, but found type '${chatData.type}'. Members:`, members);
                 } else {
                     // Log other unexpected states
                     console.warn(`DepartmentChat: Ignoring chat ${firestoreDocId} due to unexpected state. Member Count: ${memberCount}, Type: ${chatData.type}, Members:`, members);
                 }
            }


            // Ensure stableId is truthy before using it as a map key
            if (displayChat && stableId) {
                const existing = processedChatsMap.get(stableId);
                // Update if no existing, or if current chat has a newer message
                if (!existing || (lastMsgTimestamp && (!existing.lastMessageTimestamp || lastMsgTimestamp.toMillis() > existing.lastMessageTimestamp.toMillis()))) {
                    processedChatsMap.set(stableId, displayChat);
                } else if (existing && displayChat.isUnread && !existing.isUnread) {
                    // If the current doc instance is unread, update the existing entry's unread status and Firestore ID
                    processedChatsMap.set(stableId, { ...existing, isUnread: true, id: firestoreDocId });
                }
                // If existing is unread and current is not, keep existing (don't overwrite unread status)
            }
        });

        // ... rest of displayChats memo (sorting) ...
        const combined = Array.from(processedChatsMap.values());

        combined.sort((a, b) => {
            // 1. Sort by type ('direct' first)
            if (a.type === 'direct' && b.type === 'group') return -1;
            if (a.type === 'group' && b.type === 'direct') return 1;

            // 2. Sort by unread status (unread first) - within the same type
            if (a.isUnread && !b.isUnread) return -1;
            if (!a.isUnread && b.isUnread) return 1;

            // 3. Then sort by last message timestamp (newest first) - within the same type and read status
            const timeA = a.lastMessageTimestamp?.toMillis() ?? 0;
            const timeB = b.lastMessageTimestamp?.toMillis() ?? 0;
            if (timeA !== timeB) {
                return timeB - timeA;
            }

            // 4. Finally, sort by name alphabetically as a tie-breaker
            const nameA = a.type === 'group' ? (a.target as ChatGroup).groupName : formatUserName(a.target as User);
            const nameB = b.type === 'group' ? (b.target as ChatGroup).groupName : formatUserName(b.target as User);
            return nameA.localeCompare(nameB);
        });

        return combined;
    }, [allUserChats, otherUsers, currentUser?.cid, unreadChats, chatContext]); // No change needed here


    // --- Zustand Notification Update Effect ---
    useEffect(() => {
        if (!currentUser?.cid) {
            setNotifications('department', []);
            return;
        }

        const derivedNotifications: UnreadNotification[] = [];
        unreadChats.forEach(firestoreDocId => {
            const chatInfo = displayChats.find(dc => dc.id === firestoreDocId);
            // Ensure the chat is NOT hidden OR we are showing hidden chats before creating a notification
            // (Notifications should generally only show for non-hidden chats)
            if (chatInfo && !hiddenChatIds.has(chatInfo.stableId)) { // Keep original logic: only notify for non-hidden
                const name = chatInfo.type === 'group'
                    ? (chatInfo.target as ChatGroup).groupName
                    : formatUserName(chatInfo.target as User);
                const targetId = chatInfo.type === 'group'
                    ? chatInfo.id // Group ID
                    : (chatInfo.target as User).cid; // User CID

                // Ensure targetId is not undefined before pushing
                if (targetId) {
                    derivedNotifications.push({
                        id: firestoreDocId,
                        name,
                        targetId,
                        context: chatContext,
                        timestamp: chatInfo.lastMessageTimestamp || null, // Add timestamp
                        targetType: chatInfo.type, // Add targetType
                        stableId: chatInfo.stableId, // Add stableId
                    });
                }
            }
        });
        // Set the filtered notifications
        setNotifications('department', derivedNotifications);
        // No change in dependencies needed here, notification logic remains the same
    }, [unreadChats, setNotifications, displayChats, currentUser?.cid, hiddenChatIds]);


    // Filtered and Sorted Chats for Display (Main List) - UPDATED
    const { visibleChats, hiddenChats } = useMemo(() => {
        const lowerSearchTerm = searchTerm.toLowerCase();
        const visible: DisplayChat[] = [];
        const hidden: DisplayChat[] = [];

        displayChats.forEach(chat => {
            const name = chat.type === 'group'
                ? (chat.target as ChatGroup).groupName
                : formatUserName(chat.target as User);

            // Filter by search term first
            if (name.toLowerCase().includes(lowerSearchTerm)) {
                // Then separate into visible or hidden
                if (hiddenChatIds.has(chat.stableId)) {
                    hidden.push(chat);
                } else {
                    visible.push(chat);
                }
            }
        });

        // Sort hidden chats similarly to visible ones (optional, but good for consistency)
        hidden.sort((a, b) => {
            const timeA = a.lastMessageTimestamp?.toMillis() ?? 0;
            const timeB = b.lastMessageTimestamp?.toMillis() ?? 0;
            if (timeA !== timeB) return timeB - timeA;
            const nameA = a.type === 'group' ? (a.target as ChatGroup).groupName : formatUserName(a.target as User);
            const nameB = b.type === 'group' ? (b.target as ChatGroup).groupName : formatUserName(b.target as User);
            return nameA.localeCompare(nameB);
        });


        return { visibleChats: visible, hiddenChats: hidden };
        // REMOVE showHiddenChats dependency
    }, [displayChats, searchTerm, hiddenChatIds]);


    // --- Callbacks ---
    const handleChatSelect = useCallback((chat: DisplayChat) => {
        // REMOVE check related to showHiddenChats
        // Selecting a hidden chat (from the expanded list) is now always allowed.
        setSelectedChat(chat); // This triggers the useEffect to switch viewMode to 'chat'
        currentChatIdRef.current = chat.stableId; // Update ref
        setNewMessage(''); // Clear input when switching chats
        setChatError(null); // Clear errors
        // Reset create view state when selecting an existing chat
        setCreateSearchTerm('');
        setCreateGroupName('');
        setCreateSelectedMembers(new Set());
        // REMOVE showHiddenChats dependency
    }, [hiddenChatIds]);

    // Renamed from handleGoBackToList for clarity
    const handleReturnToList = useCallback(() => {
        setSelectedChat(null);
        currentChatIdRef.current = null;
        // Reset create view state when returning to list
        setCreateSearchTerm('');
        setCreateGroupName('');
        setCreateSelectedMembers(new Set());
        setViewMode('list'); // Explicitly set view mode back to list
    }, []);

    const handleOpenCreateView = () => {
        setSelectedChat(null); // Ensure no chat is selected
        setViewMode('create'); // Switch to create view
        // Reset create view state
        setCreateSearchTerm('');
        setCreateGroupName('');
        setCreateSelectedMembers(new Set());
    };

    // --- Message Sending Logic ---
    const handleSendMessage = useCallback(async () => {
        if (!newMessage.trim() || !currentUser?.cid || !selectedChat) return;

        setIsSendingMessage(true);
        const userCid = currentUser.cid;
        const trimmedMessage = newMessage.trim();
        const { target, id: chatDocIdToSend } = selectedChat; // Use Firestore ID directly
        let recipientCid: string | undefined = undefined;
        let isGroupChat = 'groupName' in target;
        let members: string[] = [];

        if (isGroupChat) {
            if ('members' in target) {
                members = target.members || [];
            }
        } else if ('cid' in target && target.cid) { // Direct chat
            recipientCid = target.cid;
            members = [userCid, recipientCid];
        } else {
            toast.error("Invalid chat target.");
            setIsSendingMessage(false);
            return;
        }

        if (!chatDocIdToSend) {
            toast.error("Could not determine chat ID to send message.");
            setIsSendingMessage(false);
            return;
        }

        const chatDocRef = doc(dbFirestore, 'chats', chatDocIdToSend);
        const messagesRef = collection(chatDocRef, 'messages');
        const isImageUrl = /\.(jpg|jpeg|png|gif|webp)$/i.test(trimmedMessage) && /^https?:\/\//i.test(trimmedMessage);

        const messageData = {
            senderId: userCid,
            timestamp: serverTimestamp(),
            senderName: formatUserName(currentUser),
            ...(isImageUrl ? { imageUrl: trimmedMessage } : { text: trimmedMessage }),
            ...(recipientCid && !isGroupChat && { recipientId: recipientCid }),
        };

        const chatUpdateData = {
            lastMessageTimestamp: serverTimestamp(),
            lastMessageText: isImageUrl ? "[Image]" : trimmedMessage.substring(0, 50),
            [`lastRead.${userCid}`]: serverTimestamp(),
            // No need to update members/type/context here usually, unless creating
        };

        try {
            // Only update the chat doc, creation is handled elsewhere (CreateGroupModal/handleStartDirectChat)
            await updateDoc(chatDocRef, chatUpdateData);

            // Add the message to the subcollection
            await addDoc(messagesRef, messageData);

            setNewMessage('');

        } catch (error) {
            console.error("DepartmentChatPopup: Error sending message:", error);
            toast.error("Failed to send message.");
        } finally {
            setIsSendingMessage(false);
        }
    }, [newMessage, currentUser, selectedChat]);

    // --- Create View Callbacks ---
    const handleCreateMemberToggle = (cid: string) => {
        setCreateSelectedMembers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(cid)) {
                newSet.delete(cid);
            } else {
                newSet.add(cid);
            }
            return newSet;
        });
    };

    // --- Group/Direct Chat Creation Callbacks (Adapted) ---
    const handleCreateGroup = useCallback(async (name: string, selectedMemberCids: string[]) => {
        if (!currentUser?.cid) {
            toast.error("Cannot create group without logged-in user.");
            throw new Error("User not logged in");
        }
        const userCid = currentUser.cid;
        if (!name.trim() || selectedMemberCids.length === 0) {
            toast.warn("Group name and at least one member are required.");
            throw new Error("Invalid input");
        }
        const allMemberCids = Array.from(new Set([userCid, ...selectedMemberCids]));
        const now = serverTimestamp();
        const initialLastRead: { [cid: string]: any } = { [userCid]: now };
        const groupData: Omit<ChatGroup, 'id'> & { context: 'department' } = {
            groupName: name.trim(), type: 'group', context: chatContext, members: allMemberCids,
            createdBy: userCid, createdAt: now, lastMessageTimestamp: now, lastRead: initialLastRead,
        };

        setIsCreating(true); // Set loading state
        try {
            const docRef = await addDoc(collection(dbFirestore, 'chats'), groupData);
            toast.success(`Group "${name}" created successfully.`);

            // Create the DisplayChat object for the new group
            const newGroupForSelection: ChatGroup = {
                id: docRef.id, groupName: groupData.groupName, type: 'group', members: groupData.members,
                createdBy: groupData.createdBy, createdAt: Timestamp.now(),
                lastMessageTimestamp: Timestamp.now(),
                lastRead: { [userCid]: Timestamp.now() }, context: chatContext,
            };
            const newDisplayChat: DisplayChat = {
                id: docRef.id, stableId: docRef.id, type: 'group', target: newGroupForSelection,
                lastMessageTimestamp: newGroupForSelection.lastMessageTimestamp instanceof Timestamp ? newGroupForSelection.lastMessageTimestamp : null,
                isUnread: false,
            };

            // Set selected chat and switch view
            setSelectedChat(newDisplayChat); // This will trigger useEffect to set viewMode='chat'
            currentChatIdRef.current = newDisplayChat.stableId;
            setViewMode('list'); // Ensure list/create view is 'list'

            // Reset create state
            setCreateGroupName('');
            setCreateSelectedMembers(new Set());
            setCreateSearchTerm('');

        } catch (err) {
            console.error("Error creating group:", err);
            toast.error("Failed to create group.");
            // Don't reset viewMode on error
            throw err; // Re-throw error if needed
        } finally {
            setIsCreating(false); // Clear loading state
        }
    }, [currentUser?.cid, chatContext]);

    const handleStartDirectChat = useCallback(async (memberCid: string) => {
        if (!currentUser?.cid) return;
        const userCid = currentUser.cid;
        const targetUser = otherUsers.find(u => u.cid === memberCid);

        if (targetUser) {
            const directChatId = getDirectChatId(userCid, memberCid, chatContext);
            const chatDocRef = doc(dbFirestore, 'chats', directChatId);
            let firestoreDocId: string = directChatId;
            let chatDataToUse: DocumentData | null = null;

            setIsCreating(true); // Set loading state
            try {
                const docSnap = await getDoc(chatDocRef);
                if (!docSnap.exists()) {
                    // ... create new chat doc logic ...
                    const now = Timestamp.now();
                    const initialChatData = {
                        members: [userCid, memberCid], type: 'direct', context: chatContext,
                        createdAt: serverTimestamp(), lastMessageTimestamp: null,
                        lastRead: { [userCid]: serverTimestamp() },
                    };
                    await setDoc(chatDocRef, initialChatData);
                    chatDataToUse = { ...initialChatData, createdAt: now, lastRead: { [userCid]: now } };
                    console.log(`DepartmentChat: Created direct chat doc ${directChatId}`);
                } else {
                    chatDataToUse = docSnap.data();
                }
            } catch (error) {
                 console.error(`DepartmentChat: Error checking/creating direct chat doc ${directChatId}:`, error);
                 toast.error("Failed to start chat.");
                 setIsCreating(false); // Clear loading state on error
                 return;
            }

            if (!chatDataToUse) {
                toast.error("Failed to load chat data.");
                setIsCreating(false); // Clear loading state
                return;
            }

            // Create the DisplayChat object
            const newDisplayChat: DisplayChat = {
                id: firestoreDocId, stableId: directChatId, type: 'direct', target: targetUser,
                lastMessageTimestamp: chatDataToUse.lastMessageTimestamp instanceof Timestamp ? chatDataToUse.lastMessageTimestamp : null,
                isUnread: false,
            };

            // Set selected chat and switch view
            setSelectedChat(newDisplayChat); // This will trigger useEffect to set viewMode='chat'
            currentChatIdRef.current = newDisplayChat.stableId;
            setViewMode('list'); // Ensure list/create view is 'list'

            // Reset create state
            setCreateGroupName('');
            setCreateSelectedMembers(new Set());
            setCreateSearchTerm('');
            setIsCreating(false); // Clear loading state on success

        } else {
            toast.error("Could not find selected user to start chat.");
            setIsCreating(false); // Clear loading state
        }
    }, [otherUsers, currentUser?.cid, chatContext]);


    // --- Hide Chat Logic ---
    const handleHideChat = useCallback(async (stableChatId: string) => {
        // Use email instead of uid
        if (!currentUser?.email) {
             console.error("DepartmentChat: Cannot hide chat, missing current user's email.");
             toast.error("Could not hide chat. User identifier missing."); // User feedback
             return;
        }
        const userDocRef = doc(dbFirestore, 'users', currentUser.email); // Use email

        // Check if already hidden (no need to proceed if it is)
        if (hiddenChatIds.has(stableChatId)) {
            // If we are showing hidden chats, and the user clicks "Hide" on an already hidden chat,
            // we don't need to do anything (it's already hidden).
            // If we are NOT showing hidden chats, this option wouldn't be available anyway (it's disabled).
            console.log(`DepartmentChat: Chat ${stableChatId} is already hidden.`);
            return;
        }


        // Optimistically update UI
        setHiddenChatIds(prev => new Set(prev).add(stableChatId));

        // REMOVED: Logic that deselected the chat if it was the one being hidden.

        try {
            await updateDoc(userDocRef, {
                [`hiddenChats_${chatContext}`]: arrayUnion(stableChatId)
            });
            console.log(`DepartmentChat: Chat ${stableChatId} hidden for user ${currentUser.email}.`); // Log using email
            toast.info("Chat hidden. New messages will unhide it.");
        } catch (error) {
            console.error("Error hiding chat:", error);
            toast.error("Failed to hide chat. Please try again.");
            // Revert optimistic UI update on error
            setHiddenChatIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(stableChatId);
                return newSet;
            });
        }
    }, [currentUser?.email, chatContext, hiddenChatIds]); // Update dependency


    // --- Unhide Chat Logic ---
    const handleUnhideChat = useCallback(async (stableChatId: string) => {
        // Use email instead of uid
        if (!currentUser?.email) {
            console.error("DepartmentChat: Cannot unhide chat, missing current user's email.");
            toast.error("Could not unhide chat. User identifier missing.");
            return;
        }
        const userDocRef = doc(dbFirestore, 'users', currentUser.email); // Use email

        // Optimistically update UI
        setHiddenChatIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(stableChatId);
            return newSet;
        });

        try {
            await updateDoc(userDocRef, {
                [`hiddenChats_${chatContext}`]: arrayRemove(stableChatId) // Use arrayRemove
            });
            console.log(`DepartmentChat: Chat ${stableChatId} unhidden for user ${currentUser.email}.`); // Log using email
            toast.success("Chat unhidden.");
        } catch (error) {
            console.error("Error unhiding chat:", error);
            toast.error("Failed to unhide chat. Please try again.");
            // Revert optimistic UI update on error
            setHiddenChatIds(prev => new Set(prev).add(stableChatId)); // Add it back
        }
    }, [currentUser?.email, chatContext]); // Update dependency


    // --- Save Settings Logic ---
    const handleSaveSettings = async () => {
        // Use email instead of uid
        if (!currentUser?.email) {
            toast.error("Cannot save settings. User email not found.");
            return;
        }
        setIsSavingSettings(true);
        const userDocRef = doc(dbFirestore, 'users', currentUser.email); // Use email
        try {
            await updateDoc(userDocRef, {
                'chatSettings.department': { // Use dot notation for nested fields
                    fontSizePercent: fontSizePercent,
                    sizePreset: selectedSizePreset,
                }
            });
            toast.success("Chat settings saved!");
            // Optionally close the popover here if desired
            // document.dispatchEvent(new MouseEvent('mousedown')); // Simulate click outside to close popover
        } catch (error) {
            // Log the email used for debugging
            console.error(`DepartmentChatPopup: Error saving settings for user ${currentUser.email}:`, error);
            toast.error("Failed to save settings.");
        } finally {
            setIsSavingSettings(false);
        }
    };

    // --- Clear All Notifications Logic ---
    const handleClearAllNotifications = useCallback(() => {
        clearNotifications(chatContext);
        toast.info("All department notifications cleared.");
    }, [clearNotifications]);


    // --- Click Outside Effect ---
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Ignore right-clicks completely
            if (event.button === 2) {
                return;
            }

            const target = event.target as Node;
            const clickedInsideList = listPopupRef.current?.contains(target);
            const clickedInsideChat = chatPopupRef.current?.contains(target);
            const clickedInsideSettings = settingsPopoverRef.current?.contains(target); // <-- Check settings popover ref
            const clickedInsideModal = (target as Element).closest('[role="dialog"][aria-modal="true"]');
            const clickedInsideContextMenu = (target as Element).closest('[data-radix-context-menu-content]');

            // If the click originated inside any of these elements, do nothing.
            // Add clickedInsideSettings to the condition
            if (clickedInsideList || clickedInsideChat || clickedInsideModal || clickedInsideContextMenu || clickedInsideSettings) {
                return;
            }

            // Otherwise, call the main close function.
            onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]); // Keep dependencies minimal


    // --- Render ---
    const isLoading = loadingChats;
    // Update chatWindowLeft calculation
    const chatWindowLeft = listLeftPosition + currentListWidth + gapWidth;

    // Get unread count for conditional rendering
    const departmentUnreadCount = getUnreadCount(chatContext);

    // --- Divider Logic Variables ---
    // Reset these flags before mapping in the return statement
    let directMessagesHeaderRendered = false;
    let groupChatsHeaderRendered = false;
    // Recalculate based on the potentially reclassified visibleChats
    const finalHasDirectMessages = visibleChats.some(chat => chat.type === 'direct');
    const finalHasGroupChats = visibleChats.some(chat => chat.type === 'group');

    // Helper function to render a single chat item (to avoid repetition)
    const renderChatItem = (chat: DisplayChat, isHiddenSection: boolean) => {
        const isSelected = selectedChat?.stableId === chat.stableId;
        return (
            <ContextMenu key={chat.stableId}>
                <ContextMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg h-auto",
                            isSelected ? "bg-muted/70 shadow-inner" : "hover:bg-muted/60",
                            "relative transition-opacity duration-200" // Keep transition
                        )}
                        onClick={() => handleChatSelect(chat)}
                        // Disable button if it's hidden but the section is collapsed (shouldn't happen with current logic, but safe)
                        disabled={isHiddenSection && !isHiddenChatsExpanded}
                    >
                        {/* Unread badge only for non-hidden chats (or decide if hidden should show too) */}
                        {!isHiddenSection && chat.isUnread && (
                            <Badge
                                variant="destructive"
                                className="absolute left-2 top-1/2 -translate-y-1/2 h-2 w-2 p-0 rounded-full"
                            />
                        )}
                        <Avatar className="h-10 w-10 border border-border shadow-sm flex-shrink-0 ml-3">
                            {chat.type === 'group' ? (
                                <AvatarFallback><Users className="h-5 w-5" /></AvatarFallback>
                            ) : (
                                <>
                                    <AvatarImage src={(chat.target as User).photoURL ?? undefined} alt={formatUserName(chat.target as User)} />
                                    <AvatarFallback>{getAvatarFallback(chat.target as User)}</AvatarFallback>
                                </>
                            )}
                        </Avatar>
                        <div className="flex-grow overflow-hidden text-left">
                            <div className="font-medium text-sm truncate text-foreground">
                                {chat.type === 'group' ? (chat.target as ChatGroup).groupName : formatUserName(chat.target as User)}
                            </div>
                        </div>
                        {/* REMOVE eye icon */}
                    </Button>
                </ContextMenuTrigger>
                <ContextMenuContent
                    className="w-48"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    // Add this line to stop the mousedown event from bubbling up
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {/* Conditionally render Hide/Unhide based on section */}
                    {isHiddenSection ? (
                        <ContextMenuItem
                            onSelect={() => { handleUnhideChat(chat.stableId); }}
                            className="text-primary focus:text-primary focus:bg-primary/10 cursor-pointer"
                        >
                            <FaEye className="mr-2 h-4 w-4" />
                            Unhide Chat
                        </ContextMenuItem>
                    ) : (
                        <ContextMenuItem
                            onSelect={() => { handleHideChat(chat.stableId); }}
                            className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                        >
                            <FaEyeSlash className="mr-2 h-4 w-4" />
                            Hide Chat
                        </ContextMenuItem>
                    )}
                </ContextMenuContent>
            </ContextMenu>
        );
    };


    return (
        <React.Fragment>
            {/* List View / Create View Popup Container */}
            <div
                ref={listPopupRef}
                className={cn(
                    "fixed top-16 z-50 bg-black/[.99]",
                    "border border-border rounded-xl shadow-2xl",
                    // Use dynamic width class (Tailwind needs full class names)
                    // We'll use inline style for width for simplicity here
                    `flex flex-col overflow-hidden`,
                    "transition-all duration-300 ease-in-out"
                )}
                 // Apply dynamic height and width via inline style
                 style={{
                     left: `${listLeftPosition}px`,
                     height: `${currentPopupHeight}px`,
                     width: `${currentListWidth}px`
                 }}
                onClick={e => e.stopPropagation()} // Keep this one too, for clicks on the main list popup background
            >
                {/* --- Conditional Rendering based on viewMode (List or Create) --- */}

                {/* Render List View Content */}
                {viewMode === 'list' && (
                    <>
                        {/* Header for List View */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-black/80 flex-shrink-0">
                            <h2 className="font-semibold text-lg text-foreground">Department Chats</h2>
                            <div className="flex items-center gap-1"> {/* Wrap buttons */}
                                {/* Clear All Notifications Button */}
                                {departmentUnreadCount > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleClearAllNotifications}
                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                                        title="Clear All Notifications"
                                    >
                                        <BellOff className="h-5 w-5" />
                                    </Button>
                                )}
                                {/* Settings Popover */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                                            title="Chat Settings"
                                        >
                                            <Settings className="h-5 w-5" />
                                        </Button>
                                    </PopoverTrigger>
                                    {/* Add ref here */}
                                    <PopoverContent
                                        ref={settingsPopoverRef}
                                        className="w-72 mr-4"
                                        side="bottom"
                                        align="end"
                                        onClick={(e) => e.stopPropagation()}
                                        onPointerDownOutside={(e) => e.preventDefault()}
                                    >
                                        <div className="grid gap-4">
                                            <div className="space-y-2">
                                                <h4 className="font-medium leading-none">Settings</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    Adjust chat appearance.
                                                </p>
                                            </div>
                                            <div className="grid gap-4">
                                                {/* Font Size Slider */}
                                                <div className="grid grid-cols-3 items-center gap-4">
                                                    <Label htmlFor="fontSize">Font Size</Label>
                                                    <Slider
                                                        id="fontSize"
                                                        min={80}
                                                        max={130}
                                                        step={5}
                                                        value={[fontSizePercent]}
                                                        onValueChange={(value) => setFontSizePercent(value[0])}
                                                        className="col-span-2 h-8"
                                                    />
                                                </div>
                                                <div className="text-center text-xs text-muted-foreground -mt-2 mb-2"> {/* Adjusted margin */}
                                                    {fontSizePercent}%
                                                </div>

                                                {/* Size Preset Radio Group */}
                                                {/* Keep the inner stopPropagation as a backup, though the outer one should handle it */}
                                                <div className="grid gap-2" onClick={(e) => e.stopPropagation()}>
                                                    {/* Update Label htmlFor and add id to RadioGroup */}
                                                    <Label htmlFor="window-size-group" className="mb-1">Window Size</Label>
                                                    <RadioGroup
                                                        id="window-size-group" // Add ID here
                                                        value={selectedSizePreset}
                                                        onValueChange={(value) => setSelectedSizePreset(value as SizePresetKey)}
                                                        className="grid grid-cols-2 gap-2" // Arrange in 2 columns
                                                    >
                                                        {Object.keys(sizePresets).map((key) => (
                                                            <div key={key} className="flex items-center space-x-2">
                                                                <RadioGroupItem value={key} id={`size-${key}`} />
                                                                <Label htmlFor={`size-${key}`} className="text-sm font-normal cursor-pointer">
                                                                    {key}
                                                                </Label>
                                                            </div>
                                                        ))}
                                                    </RadioGroup>
                                                </div>
                                            </div>
                                            {/* Save Button */}
                                            <Button
                                                onClick={handleSaveSettings}
                                                disabled={isSavingSettings}
                                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                                            >
                                                {isSavingSettings ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <FaSave className="mr-2 h-4 w-4" />
                                                )}
                                                Save Settings
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                {/* New Chat Button */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleOpenCreateView}
                                    className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                                    title="New Chat / Group"
                                >
                                    <Plus className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                        {/* Search Input for List View */}
                        <div className="p-4 border-b border-border bg-black/80 flex-shrink-0">
                            <div className="relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="department-chat-search"
                                    placeholder="Search chats..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-10 rounded-md shadow-inner bg-muted/50 placeholder:text-muted-foreground"
                                />
                            </div>
                        </div>
                        {/* Scrollable Chat List */}
                        <ScrollArea className="flex-grow custom-scrollbar min-h-0">
                            <div className="space-y-1 p-2">
                                {isLoading ? (
                                    <div className="flex justify-center items-center h-full py-10">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : error ? (
                                    <p className="text-center text-destructive text-sm p-4">{error}</p>
                                ) : (visibleChats.length === 0 && hiddenChats.length === 0) ? ( // Check both lists
                                    <p className="text-center text-muted-foreground text-sm p-4">
                                        {searchTerm ? 'No chats match your search.' : 'No active chats.'}
                                    </p>
                                ) : (
                                    <>
                                        {/* --- Render Visible Chats --- */}
                                        {visibleChats.map((chat) => {
                                            const isDirect = chat.type === 'direct';
                                            const isGroup = chat.type === 'group';
                                            let showDirectHeader = false;
                                            let showGroupDivider = false;
                                            let showGroupHeader = false;

                                            // Logic to show headers/dividers for VISIBLE chats
                                            if (isDirect && !directMessagesHeaderRendered) {
                                                showDirectHeader = true;
                                                directMessagesHeaderRendered = true;
                                            }
                                            if (isGroup && !groupChatsHeaderRendered) {
                                                if (finalHasDirectMessages) {
                                                    showGroupDivider = true;
                                                }
                                                showGroupHeader = true;
                                                groupChatsHeaderRendered = true;
                                            }

                                            return (
                                                <React.Fragment key={chat.stableId}>
                                                    {showDirectHeader && (
                                                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">
                                                            Direct Messages
                                                        </div>
                                                    )}
                                                    {showGroupDivider && (
                                                        <div className="my-2 border-t border-border/50 mx-2"></div>
                                                    )}
                                                    {showGroupHeader && (
                                                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                            Group Chats
                                                        </div>
                                                    )}
                                                    {/* Render the chat item using the helper */}
                                                    {renderChatItem(chat, false)}
                                                </React.Fragment>
                                            );
                                        })}

                                        {/* --- Render Hidden Chats Section --- */}
                                        {hiddenChats.length > 0 && (
                                            <>
                                                {/* Collapsible Header/Divider */}
                                                <div
                                                    className="flex items-center justify-between px-2 py-2 mt-3 mb-1 border-t border-b border-border/50 cursor-pointer hover:bg-muted/40 rounded"
                                                    onClick={() => setIsHiddenChatsExpanded(!isHiddenChatsExpanded)}
                                                >
                                                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                        {isHiddenChatsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                        Hidden Chats
                                                    </div>
                                                    <Badge variant="secondary" className="text-xs">{hiddenChats.length}</Badge>
                                                </div>

                                                {/* Conditionally Render Hidden Chat Items */}
                                                {isHiddenChatsExpanded && (
                                                    <div className="space-y-1 pt-1">
                                                        {hiddenChats.map((chat) => (
                                                            // Render the chat item using the helper, marking it as hidden
                                                            renderChatItem(chat, true)
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        </ScrollArea>
                        {/* Stylish Footer */}
                        <div className="h-4 flex-shrink-0 bg-gradient-to-t from-black/[.99] via-black/[.99] to-transparent pointer-events-none">
                            {/* This div creates a fade-out effect at the bottom */}
                        </div>
                    </>
                )}

                {/* Render Create View Content */}
                {viewMode === 'create' && (
                    <>
                        {/* Header for Create View */}
                        <div className="flex items-center gap-2 px-3 py-4 border-b border-border bg-black/80 flex-shrink-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleReturnToList} // This should now work correctly
                                className="text-muted-foreground hover:text-foreground"
                                title="Back to Chats"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <h2 className="font-semibold text-lg text-foreground">New Chat / Group</h2>
                        </div>
                        {/* Search Input for Create View */}
                        <div className="p-4 border-b border-border bg-black/80 flex-shrink-0">
                            <div className="relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="department-create-search"
                                    placeholder="Search personnel..."
                                    value={createSearchTerm}
                                    onChange={(e) => setCreateSearchTerm(e.target.value)}
                                    className="pl-10 h-10 rounded-md shadow-inner bg-muted/50 placeholder:text-muted-foreground"
                                    disabled={isCreating}
                                />
                            </div>
                        </div>
                        {/* Group Name Input (Conditional) */}
                        {createSelectedMembers.size > 0 && (
                            <div className="p-4 border-b border-border bg-black/80 space-y-2 flex-shrink-0">
                                <Label htmlFor="groupName" className="text-sm font-medium">Group Name (Required for {createSelectedMembers.size + 1} members)</Label>
                                <Input
                                    id="groupName"
                                    value={createGroupName}
                                    onChange={(e) => setCreateGroupName(e.target.value)}
                                    placeholder="Enter group name..."
                                    disabled={isCreating}
                                    className="h-10 rounded-md bg-muted/50 placeholder:text-muted-foreground"
                                />
                            </div>
                        )}
                        {/* Scrollable User List for Selection */}
                        <ScrollArea className="flex-grow custom-scrollbar min-h-0"> {/* Ensure min-h-0 for flex */}
                             {/* ADD p-2 here */}
                            <div className="space-y-1 p-2">
                                {createAvailablePersonnel.length === 0 ? (
                                    <p className="text-center text-muted-foreground text-sm p-4">
                                        {createSearchTerm ? 'No personnel match your search.' : 'No personnel found.'}
                                    </p>
                                ) : (
                                    createAvailablePersonnel.map(user => (
                                        user.cid ? (
                                            <div key={user.id} className="flex items-center space-x-3 p-2 hover:bg-muted rounded">
                                                <Checkbox
                                                    id={`create-member-${user.id}`}
                                                    checked={createSelectedMembers.has(user.cid)}
                                                    onCheckedChange={() => handleCreateMemberToggle(user.cid!)}
                                                    disabled={isCreating}
                                                    className="border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                                />
                                                <Avatar className="h-8 w-8 border border-border">
                                                    <AvatarImage src={user.photoURL || undefined} alt={formatUserName(user)} />
                                                    <AvatarFallback>{getAvatarFallback(user)}</AvatarFallback>
                                                </Avatar>
                                                <Label htmlFor={`create-member-${user.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate flex-grow cursor-pointer">
                                                    {formatUserName(user)}
                                                </Label>
                                                {createSelectedMembers.size === 0 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleStartDirectChat(user.cid!)}
                                                        disabled={isCreating}
                                                        className="ml-auto text-xs h-7 px-2"
                                                    >
                                                        Chat
                                                    </Button>
                                                )}
                                            </div>
                                        ) : null
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                        {/* Footer with Action Button (Conditional) */}
                        {createSelectedMembers.size > 0 && (
                            <div className="p-4 border-t border-border bg-black/80 flex justify-end flex-shrink-0">
                                <Button
                                    onClick={() => handleCreateGroup(createGroupName, Array.from(createSelectedMembers))}
                                    disabled={isCreating || !createGroupName.trim() || createSelectedMembers.size === 0}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                >
                                    {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Create Group ({createSelectedMembers.size + 1})
                                </Button>
                            </div>
                        )}
                    </>
                )}

                {/* Stylish Footer for Create View */}
                {viewMode === 'create' && (
                    <div className="h-4 flex-shrink-0 bg-gradient-to-t from-black/[.99] via-black/[.99] to-transparent pointer-events-none"></div>
                )}

            </div>

            {/* Separate Chat View Popup Container (Renders when selectedChat is not null) */}
            {currentUser && selectedChat && (
                <div
                    ref={chatPopupRef}
                    className={cn(
                        "fixed top-16 z-40 bg-black/[.99]", // Lower z-index than list
                        "border border-border rounded-xl shadow-2xl",
                        "flex flex-col min-h-0",
                        "overflow-hidden",
                        // Use dynamic width class (Tailwind needs full class names)
                        // We'll use inline style for width for simplicity here
                        "transition-all duration-300 ease-in-out"
                    )}
                    // Apply dynamic height and width via inline style
                    style={{
                        left: `${chatWindowLeft}px`,
                        height: `${currentPopupHeight}px`,
                        width: `${currentChatWidth}px` // Apply dynamic width
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    <ChatWindow
                        chatTarget={selectedChat.target}
                        messages={messages}
                        newMessage={newMessage}
                        onNewMessageChange={setNewMessage}
                        onSendMessage={handleSendMessage}
                        isLoading={isLoadingMessages}
                        isSending={isSendingMessage}
                        currentUser={currentUser}
                        inputRef={chatInputRef}
                        onClose={handleReturnToList}
                        allUsers={allUsers}
                        // Pass font size state
                        fontSizePercent={fontSizePercent}
                        className="shadow-none border-none bg-transparent"
                    />
                </div>
            )}

        </React.Fragment>
    );
};

