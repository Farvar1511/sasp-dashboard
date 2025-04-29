"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback, ElementRef } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
    getDocs,
    limit,
    doc,
    getDoc,
    updateDoc,
    setDoc,
    arrayUnion,
    arrayRemove,
    Timestamp,
    QuerySnapshot,
    DocumentData,
    deleteField, // Import deleteField
} from 'firebase/firestore';
import { db as dbFirestore } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { User } from '../types/User';
import { ChatGroup } from '../types/ChatGroup'; // Import ChatGroup
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { SearchIcon, Loader2, Users, Plus, Settings, EyeOff, XIcon } from 'lucide-react'; // Import XIcon
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu"; // Import DropdownMenu components
import { toast } from 'react-toastify';
import { formatUserName, getAvatarFallback } from './Chat/utils';
import { ChatWindow } from './ChatWindow';
import { getDirectChatId } from './Chat/CIUChatInterface'; // Assuming getDirectChatId is exported or moved
import { ChatMessage } from '../types/chat';
import { cn } from '../lib/utils';
import { ScrollArea } from './ui/scroll-area';
import {
    Sheet,
    SheetContent,
} from "../components/ui/sheet";
import CreateGroupModal from './Chat/CreateGroupModal'; // Import CreateGroupModal
import { Badge } from './ui/badge'; // Ensure Badge is imported
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'; // Import VisuallyHidden
import { DialogTitle, DialogDescription } from '@radix-ui/react-dialog'; // Import Dialog primitives for Sheet accessibility
import { useNotificationStore, UnreadNotification } from '../store/notificationStore'; // Import Zustand store
import { FaEyeSlash } from 'react-icons/fa'; // Import FaEyeSlash
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "./ui/context-menu"; // Ensure ContextMenu components are imported
import { ChatInput } from './ui/chat/chat-input'; // Import ChatInput

const chatContext = 'department'; // Define context

// Interface for combined display items
interface DisplayChat {
    id: string; // Firestore Doc ID (group or direct)
    type: 'group' | 'direct';
    target: ChatGroup | User;
    lastMessageTimestamp: Timestamp | null;
    isUnread: boolean;
    // Add stable key for direct chats (used for hiding/selection)
    stableId: string; // Group ID or Generated Direct Chat ID
}

// Define the type for the selected chat state
type SelectedChatState = {
    id: string; // Stable ID (Group ID or Generated Direct ID)
    type: 'group' | 'direct';
    target: ChatGroup | User;
} | null;

// Remove onUnreadCountChange prop
interface DepartmentChatPopupProps {
    isOpen: boolean;
    onClose: () => void;
    // onUnreadCountChange: (count: number) => void;
}

// Define width options - Updated with vw units
const widthOptions = {
    small: { label: 'Small (20vw)', class: 'sm:w-[20vw]' },
    medium: { label: 'Medium (40vw)', class: 'sm:w-[40vw]' },
    large: { label: 'Large (60vw)', class: 'sm:w-[60vw]' },
    xlarge: { label: 'Extra Large (80vw)', class: 'sm:w-[80vw]' }, // Adjusted to 95vw
};
const defaultWidthClass = widthOptions.medium.class; // Default width remains medium

// Define font size options - Updated with more realistic percentages
const fontSizeOptions = {
    80: { label: '80%' },
    90: { label: '90%' },
    100: { label: '100% (Default)' },
    110: { label: '110%' },
    120: { label: '120%' },
};
const defaultFontSizePercent = 100; // Default font size percentage

export const DepartmentChatPopup: React.FC<DepartmentChatPopupProps> = ({ isOpen, onClose }) => {
    const inputRef = useRef<HTMLTextAreaElement>(null); // Change ref type back to HTMLTextAreaElement

    // State for width class, initialized with the default
    const [chatWidthClass, setChatWidthClass] = useState<string>(defaultWidthClass);
    // State for font size percentage
    const [fontSizePercent, setFontSizePercent] = useState<number>(defaultFontSizePercent);
    const { user: currentUser, loading: authLoading } = useAuth(); // Add authLoading
    const [users, setUsers] = useState<User[]>([]);
    const [departmentGroups, setDepartmentGroups] = useState<ChatGroup[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [loadingChats, setLoadingChats] = useState(true);
    const [allUserChats, setAllUserChats] = useState<DocumentData[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedChat, setSelectedChat] = useState<SelectedChatState>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Keep ref for potential future use, but logic removed
    const currentChatIdRef = useRef<string | null>(null);
    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
    const [unreadChats, setUnreadChats] = useState<Set<string>>(new Set()); // Stores Firestore Doc IDs
    // Use hiddenChatIds state for local filtering
    const [hiddenChatIds, setHiddenChatIds] = useState<Set<string>>(new Set()); // Stores Stable IDs (Group ID or Generated Direct ID)
    const sidebarRef = useRef<HTMLDivElement>(null); // Ref for the sidebar
    const sheetContentRef = useRef<HTMLDivElement>(null); // Ref for the sheet content
    // Add ref for dropdown content - Use ElementRef<typeof DropdownMenuContent> for correct type
    const dropdownContentRef = useRef<ElementRef<typeof DropdownMenuContent>>(null);
    // Get Zustand setter
    const setNotifications = useNotificationStore(state => state.setNotifications);


    const getChatDocRef = useCallback((chatId: string | null) => {
        if (!chatId) return null;
        return doc(dbFirestore, 'chats', chatId);
    }, []);

    const allUsersIncludingSelf = useMemo(() => {
        if (!currentUser) return [];
        // Ensure currentUser is first if needed, or just combine
        return [currentUser, ...users];
    }, [currentUser, users]);

    // Load hidden chats from user profile on mount
    useEffect(() => {
        if (currentUser?.hiddenChats_department) {
            // Initialize hiddenChatIds state from Firestore user data
            // These IDs are the "stable IDs" (Group ID or Generated Direct ID)
            setHiddenChatIds(new Set(currentUser.hiddenChats_department));
        }
    }, [currentUser?.hiddenChats_department]); // Depend on the specific field


    // --- Firestore Listeners and Data Fetching ---
    useEffect(() => {
        // Wait for auth and user CID
        if (authLoading || !currentUser?.cid) {
            setLoadingUsers(false);
            setLoadingChats(false);
            setUsers([]);
            setAllUserChats([]);
            setUnreadChats(new Set());
            setNotifications('department', []); // Clear notifications
            return;
        }
        setLoadingUsers(true);
        // setLoadingGroups(true); // Groups are loaded via allUserChats listener now
        setLoadingChats(true); // Set combined loading state
        setError(null);

        // Fetch users (unchanged)
        const fetchUsers = async () => {
            try {
                const usersRef = collection(dbFirestore, 'users');
                const q = query(usersRef);
                const querySnapshot = await getDocs(q);
                const fetchedUsers: User[] = [];
                querySnapshot.forEach((doc) => {
                    const userData = doc.data() as User;
                    if (userData.cid) {
                        fetchedUsers.push({ id: doc.id, ...userData });
                    }
                });
                // Filter out the current user from the main user list
                setUsers(fetchedUsers.filter(u => u.cid !== currentUser.cid));
            } catch (error) {
                console.error('Error fetching users:', error);
                setError(prev => prev ? `${prev}, Failed to load users` : 'Failed to load users');
            } finally {
                setLoadingUsers(false);
            }
        };
        fetchUsers(); // Call fetchUsers

        // Listener for ALL chats (groups and direct) for the current user in this context
        const allChatsQuery = query(
            collection(dbFirestore, 'chats'),
            where('members', 'array-contains', currentUser.cid),
            where('context', '==', chatContext)
        );

        const unsubscribe = onSnapshot(allChatsQuery, async (snapshot: QuerySnapshot<DocumentData>) => { // Make async
            const chatsData: DocumentData[] = [];
            const newUnreadChats = new Set<string>();
            let changedHiddenIds = false; // Flag to check if hiddenChatIds needs update
            const hiddenChatsUpdate: { [key: string]: any } = {}; // Firestore update object

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const chatId = doc.id; // Firestore Doc ID
                chatsData.push({ id: chatId, ...data }); // Store raw data including ID

                // Unread Check Logic
                const lastMessageTimestamp = data.lastMessageTimestamp as Timestamp | undefined;
                const userLastReadTimestamp = currentUser?.cid ? data.lastRead?.[currentUser.cid] as Timestamp | undefined : undefined;

                let isUnread = false;
                if (lastMessageTimestamp) {
                    // If user has never read or last message is newer
                    if (!userLastReadTimestamp || lastMessageTimestamp.toMillis() > userLastReadTimestamp.toMillis()) {
                        // Don't count the currently selected chat as unread immediately
                        if (chatId !== currentChatIdRef.current) {
                            isUnread = true;
                            newUnreadChats.add(chatId);
                        }
                    }
                }

                // Unhide on Receive Logic (Persistent)
                let stableId = '';
                if (data.type === 'group') {
                    stableId = chatId; // Group ID is the stable ID
                } else if (data.type === 'direct' && currentUser?.cid) {
                    const members = data.members as string[] || [];
                    const otherMemberCid = members.find(cid => cid !== currentUser.cid);
                    if (otherMemberCid) {
                        stableId = getDirectChatId(currentUser.cid, otherMemberCid, chatContext);
                    }
                }

                // Check if this chat is currently hidden and if it's unread
                if (stableId && hiddenChatIds.has(stableId) && isUnread) {
                    // Prepare to remove from Firestore hidden list
                    hiddenChatsUpdate[`hiddenChats_${chatContext}`] = arrayRemove(stableId);
                    changedHiddenIds = true;
                    // Also remove locally immediately for UI update
                    setHiddenChatIds(prev => {
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
            setLoadingGroups(false); // Also mark group loading as false

            // Update Firestore if any chats were unhidden
            if (changedHiddenIds && currentUser?.uid) {
                const userDocRef = doc(dbFirestore, 'users', currentUser.uid);
                try {
                    await updateDoc(userDocRef, hiddenChatsUpdate);
                    console.log(`DepartmentChat: Updated hidden chats in Firestore for user ${currentUser.uid}.`);
                } catch (error) {
                    console.error("Error updating hidden chats in Firestore:", error);
                    toast.error("Failed to sync hidden chat status.");
                }
            }

        }, (err) => {
            console.error(`DepartmentChat: Error fetching all chats for context ${chatContext}:`, err);
            setError(prev => prev ? `${prev}, Failed to load chats` : 'Failed to load chats');
            setLoadingChats(false);
            setLoadingGroups(false);
        });

        // Cleanup function
        return () => unsubscribe();

    }, [authLoading, currentUser?.cid, currentUser?.uid, setNotifications, chatContext, hiddenChatIds]); // Added dependencies

    const updateLastReadTimestamp = useCallback(async (chatId: string) => {
        if (!currentUser?.cid || !chatId) return;
        const userCid = currentUser.cid;
        const chatDocRef = getChatDocRef(chatId);
        if (!chatDocRef) return;

        try {
            await updateDoc(chatDocRef, {
                [`lastRead.${userCid}`]: serverTimestamp()
            });
        } catch (err) {
             if (err instanceof Error && (err.message.includes("No document to update") || err.message.includes("not found"))) {
                 console.warn(`DepartmentChat: Chat doc ${chatId} might not exist yet for updating lastRead.`);
             } else {
                console.error(`DepartmentChat: Error updating lastRead timestamp for chat ${chatId}:`, err);
             }
        }
    }, [currentUser?.cid, getChatDocRef]);


    // --- Display Logic ---
    const displayChats = useMemo((): DisplayChat[] => {
        if (!currentUser?.cid || loadingUsers || loadingChats) return [];

        const processedChatsMap = new Map<string, DisplayChat>(); // Key: Stable ID (Group ID or Generated Direct ID)

        // Ensure stableId is always assigned within the loop or handled if null/undefined
        allUserChats.forEach(chatData => {
            const firestoreDocId = chatData.id;
            const lastMsgTimestamp = chatData.lastMessageTimestamp instanceof Timestamp
                ? chatData.lastMessageTimestamp
                : null;
            let stableId: string | null = null; // Initialize stableId as potentially null
            let displayChat: DisplayChat | null = null;

            if (chatData.type === 'group') {
                stableId = firestoreDocId;
                const group: ChatGroup = {
                    id: firestoreDocId,
                    groupName: chatData.groupName || 'Unknown Group',
                    type: 'group',
                    members: chatData.members || [],
                    createdBy: chatData.createdBy || '',
                    createdAt: chatData.createdAt instanceof Timestamp ? chatData.createdAt : Timestamp.now(),
                    lastMessageTimestamp: lastMsgTimestamp ?? undefined,
                    typingUsers: chatData.typingUsers || [],
                    lastRead: chatData.lastRead || {},
                    context: chatContext,
                };
                displayChat = {
                    id: firestoreDocId, // Firestore Doc ID
                    stableId: stableId || '', // Ensure stableId is a string
                    type: 'group',
                    target: group,
                    lastMessageTimestamp: lastMsgTimestamp,
                    isUnread: unreadChats.has(firestoreDocId),
                };

            } else if (chatData.type === 'direct' || !chatData.type) {
                const members = chatData.members as string[] || [];
                const otherMemberCid = members.find(cid => cid !== currentUser.cid);

                if (otherMemberCid) {
                    const user = users.find(p => p.cid === otherMemberCid);
                    if (user && currentUser.cid) {
                        stableId = getDirectChatId(currentUser.cid, otherMemberCid, chatContext);
                        displayChat = {
                            id: firestoreDocId, // Firestore Doc ID
                            stableId: stableId, // Assign stableId
                            type: 'direct',
                            target: user,
                            lastMessageTimestamp: lastMsgTimestamp,
                            isUnread: unreadChats.has(firestoreDocId),
                        };
                    }
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

        const combined = Array.from(processedChatsMap.values());

        combined.sort((a, b) => {
            // Sort primarily by unread status (unread first)
            if (a.isUnread && !b.isUnread) return -1;
            if (!a.isUnread && b.isUnread) return 1;

            // Then sort by last message timestamp (newest first)
            const timeA = a.lastMessageTimestamp?.toMillis() ?? 0;
            const timeB = b.lastMessageTimestamp?.toMillis() ?? 0;
            if (timeA !== timeB) {
                return timeB - timeA;
            }

            // Finally, sort by name alphabetically as a tie-breaker
            const nameA = a.type === 'group' ? (a.target as ChatGroup).groupName : formatUserName(a.target as User);
            const nameB = b.type === 'group' ? (b.target as ChatGroup).groupName : formatUserName(b.target as User);
            return nameA.localeCompare(nameB);
        });

        return combined;
    }, [allUserChats, users, currentUser?.cid, unreadChats, loadingUsers, loadingChats, chatContext]);

    // --- Zustand Notification Update Effect ---
    useEffect(() => {
        if (!currentUser?.cid) {
            setNotifications('department', []);
            return;
        }

        const unreadNotifications: UnreadNotification[] = [];
        unreadChats.forEach(firestoreDocId => {
            // Find the corresponding DisplayChat using the Firestore Doc ID
            const chatInfo = displayChats.find(dc => dc.id === firestoreDocId); // Now displayChats is guaranteed to be available
            if (chatInfo) {
                const name = chatInfo.type === 'group'
                    ? (chatInfo.target as ChatGroup).groupName
                    : formatUserName(chatInfo.target as User);
                const targetId = chatInfo.type === 'group'
                    ? chatInfo.id // Group ID
                    : (chatInfo.target as User).cid; // User CID

                // Ensure targetId is not undefined before pushing
                if (targetId) {
                    unreadNotifications.push({
                        id: firestoreDocId,
                        name: name,
                        context: chatContext,
                        timestamp: chatInfo.lastMessageTimestamp,
                        targetType: chatInfo.type,
                        targetId: targetId, // targetId is now confirmed to be a string
                        stableId: chatInfo.stableId, // Ensure stableId is included
                    });
                } else {
                    console.warn(`DepartmentChat: Could not determine targetId for notification:`, chatInfo);
                }
            }
        });

        setNotifications('department', unreadNotifications);

    }, [unreadChats, setNotifications, displayChats, currentUser?.cid]); // displayChats is now a valid dependency here

    // Filtered and Sorted Chats for Display (including hidden filter)
    const filteredSortedDisplayChats = useMemo(() => {
        // Start with the already sorted displayChats
        let chatsToDisplay = displayChats;

        // Apply search filter if searchTerm exists
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            chatsToDisplay = chatsToDisplay.filter(chat => {
                const name = chat.type === 'group'
                    ? (chat.target as ChatGroup).groupName
                    : formatUserName(chat.target as User);
                return name.toLowerCase().includes(lowerSearchTerm);
            });
        }

        // Apply hidden filter if hiddenChatIds has entries
        if (hiddenChatIds.size > 0) {
            chatsToDisplay = chatsToDisplay.filter(chat => !hiddenChatIds.has(chat.stableId)); // Filter OUT hidden chats
        }

        return chatsToDisplay;
    }, [displayChats, searchTerm, hiddenChatIds]); // Dependencies


    // --- Message Fetching and Chat Selection Effects ---
    useEffect(() => {
        if (!currentUser?.cid || !selectedChat) {
            setMessages([]);
            currentChatIdRef.current = null;
            return;
        }
        setLoadingMessages(true);
        setError(null);

        // Use the ID from the selectedChat state (which is the stable key: group ID or generated directChatId)
        const chatId = selectedChat.id;
        currentChatIdRef.current = chatId; // Store the stable ID

        // Find the corresponding DisplayChat item again to get the Firestore Doc ID for marking read
        const displayChatItem = displayChats.find(dc => {
             if (selectedChat.type === 'group') {
                 return dc.type === 'group' && dc.id === chatId;
             } else { // Direct chat
                 // Match based on the target user's CID stored in the selectedChat state
                 return dc.type === 'direct' && (dc.target as User).cid === (selectedChat.target as User).cid;
             }
         });
        const firestoreDocId = displayChatItem?.id; // This ID might be different from chatId for direct chats

        // Mark as read using the Firestore document ID if it exists and is unread
        if (firestoreDocId && unreadChats.has(firestoreDocId)) {
            updateLastReadTimestamp(firestoreDocId);
            setUnreadChats(prev => {
                const newSet = new Set(prev);
                newSet.delete(firestoreDocId);
                return newSet;
            });
        }

        if (!chatId) { // Should not happen if selection logic is correct
            setLoadingMessages(false);
            setError("Could not determine chat ID.");
            toast.error("Could not load messages for the selected chat.");
            return;
        }

        // Fetch messages using the stable chatId (group ID or generated directChatId)
        // Firestore security rules should handle context and membership checks.
        const messagesRef = collection(dbFirestore, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));
        const unsubscribeMessages = onSnapshot(q, (snapshot) => {
            console.log(`[Debug] onSnapshot: chatId=${chatId}, snapshot size=`, snapshot.size);
            const fetchedMessages: ChatMessage[] = snapshot.docs.map(doc => {
                const data = doc.data();
                const senderCid = data.senderId;
                // Find sender details in the memoized list
                const senderDetails = allUsersIncludingSelf.find(u => u.cid === senderCid);
                return {
                    // Ensure all necessary properties for ChatMessage are included
                    id: doc.id,
                    uid: data.recipientId || '', // Use recipientId or senderId based on context
                    sender: senderCid === currentUser.cid ? "me" : "other",
                    name: data.senderName || formatUserName(senderDetails) || 'Unknown User',
                    avatarUrl: senderDetails?.photoURL ?? undefined,
                    time: data.timestamp instanceof Timestamp ? data.timestamp.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '...',
                    type: data.imageUrl ? 'image' : "text", // Explicitly set type
                    content: data.text || data.imageUrl || "",
                    timestamp: data.timestamp,
                };
            });
            setMessages(fetchedMessages); // Update messages state here
            setLoadingMessages(false);
            setError(null);
        }, (err) => {
            console.error(`DepartmentChat: Error fetching messages for chat ${chatId}:`, err);
            setError("Failed to load messages.");
            toast.error(`Failed to load messages.`);
            setLoadingMessages(false);
        });


        // Cleanup function
        return () => {
            unsubscribeMessages();
        };
        // Update dependencies: added displayChats
    }, [currentUser?.cid, selectedChat, getChatDocRef, users, updateLastReadTimestamp, unreadChats, allUsersIncludingSelf, displayChats]);


    // --- Callbacks ---
    const handleChatSelect = useCallback((chatTarget: User | ChatGroup) => {
        const newSelectedChatType = 'groupName' in chatTarget ? 'group' : 'direct';
        const newSelectedTarget = chatTarget;
        let newSelectedChatId = ''; // This will be the key for the ChatWindow

        if (newSelectedChatType === 'group') {
            newSelectedChatId = (chatTarget as ChatGroup).id; // Group ID is stable
        } else {
            // It's a direct chat (User)
            const targetUser = chatTarget as User;
            // Ensure both CIDs are definitely strings before calling getDirectChatId
            if (currentUser?.cid && targetUser.cid) {
                 // TypeScript now knows currentUser.cid and targetUser.cid are strings here
                newSelectedChatId = getDirectChatId(currentUser.cid, targetUser.cid, chatContext);
            } else {
                console.error("DepartmentChat: Cannot select chat, missing CIDs.", { currentUserCid: currentUser?.cid, targetUserCid: targetUser.cid });
                toast.error("Cannot select chat due to missing identifiers.");
                return;
            }
        }

        // Find the corresponding DisplayChat to get the *Firestore document ID* for marking read, etc.
        // This might be different from newSelectedChatId for direct chats if the doc doesn't exist yet.
        const displayChatItem = displayChats.find(dc => {
            if (dc.type === 'group' && newSelectedChatType === 'group') {
                return dc.id === (chatTarget as ChatGroup).id;
            }
            if (dc.type === 'direct' && newSelectedChatType === 'direct') {
                return (dc.target as User).cid === (chatTarget as User).cid;
            }
            return false;
        });

        const firestoreDocId = displayChatItem?.id; // This is the ID used for Firestore operations (might be undefined for new direct chats)

        // --- Removed the error toast if displayChatItem is not found ---
        // if (!displayChatItem) {
        //     console.warn("DepartmentChat: Could not find existing display chat item for selection (might be a new direct chat):", chatTarget);
        //     // toast.error("Could not select chat."); // REMOVED THIS LINE
        //     // return; // Don't return, proceed with selection
        // }

        // Stop typing indicator logic (if any)
        if (currentChatIdRef.current && currentUser?.cid && currentChatIdRef.current !== firestoreDocId) {
            // Stop typing in the old chat (using firestoreDocId if available)
            // Example: stopTypingIndicator(currentChatIdRef.current);
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        setSelectedChat({
            type: newSelectedChatType,
            target: newSelectedTarget,
            // Use the stable generated/group ID for the state ID, which matches the ChatWindow key
            id: newSelectedChatId
        });
        setMessages([]); // Clear messages for the new chat
        setNewMessage(''); // Clear the input field
        // Marking as read is handled in the useEffect for selectedChat using firestoreDocId if available
    }, [currentUser?.cid, displayChats, chatContext]); // Added chatContext dependency

    // --- Message Send Handler ---
    const handleSendMessage = useCallback(async () => {
        console.log("[Debug] handleSendMessage: newMessage =", newMessage);
        if (!newMessage.trim() || !currentUser?.cid || !selectedChat || isSending) return;
        const userCid = currentUser.cid;

        setIsSending(true);
        const trimmedMessage = newMessage.trim();
        // Clear input state immediately
        setNewMessage('');

        const chatId = selectedChat.id;
        let isGroupChat = selectedChat.type === 'group';
        let members: string[] = [];
        let recipientCid: string | undefined = undefined;

        if (!chatId) {
            toast.error("Could not determine chat ID to send message.");
            setIsSending(false);
            // Restore message if needed, though it was cleared above
            // setNewMessage(trimmedMessage);
            return;
        }

        // Find the Firestore document ID for marking read
        const displayChatItem = displayChats.find(dc => {
             if (selectedChat.type === 'group') {
                 return dc.type === 'group' && dc.id === chatId;
             } else {
                 return dc.type === 'direct' && (dc.target as User).cid === (selectedChat.target as User).cid;
             }
         });
        const firestoreDocId = displayChatItem?.id; // May be undefined for new direct chats

        // Mark as read using the Firestore document ID if it exists and is unread
        if (firestoreDocId && unreadChats.has(firestoreDocId)) {
            updateLastReadTimestamp(firestoreDocId); // Call the separate function
            setUnreadChats(prev => {
                const newSet = new Set(prev);
                newSet.delete(firestoreDocId);
                return newSet;
            });
        }

        if (isGroupChat) {
            members = (selectedChat.target as ChatGroup).members;
        } else {
            const targetUser = selectedChat.target as User;
            if (!targetUser.cid) {
                toast.error("Selected user is missing an identifier.");
                setIsSending(false);
                // setNewMessage(trimmedMessage); // Restore if needed
                return;
            }
            recipientCid = targetUser.cid;
            members = [userCid, recipientCid];
        }

        const messagesRef = collection(dbFirestore, 'chats', chatId, 'messages');
        const chatDocRef = getChatDocRef(chatId);
        const isImageUrl = /\.(jpg|jpeg|png|gif|webp)$/i.test(trimmedMessage) && /^https?:\/\//i.test(trimmedMessage);

        const messageData: { [key: string]: any } = {
            senderId: userCid,
            timestamp: serverTimestamp(),
            senderName: formatUserName(currentUser),
            ...(isImageUrl ? { imageUrl: trimmedMessage } : { text: trimmedMessage }),
            ...(recipientCid && { recipientId: recipientCid }),
        };

        try {
            // Add the message
            await addDoc(messagesRef, messageData);

            // Update chat metadata
            if (chatDocRef) {
                const chatDocSnap = await getDoc(chatDocRef);
                const now = serverTimestamp();
                const lastMessagePreview = isImageUrl ? "[Image]" : trimmedMessage.substring(0, 50);

                const updateData: { [key: string]: any } = {
                    lastMessageTimestamp: now,
                    [`lastRead.${userCid}`]: now,
                    lastMessageText: lastMessagePreview,
                    context: chatContext,
                    members: arrayUnion(...members),
                    type: isGroupChat ? 'group' : 'direct',
                };

                if (chatDocSnap.exists()) {
                    if (chatDocSnap.data().context !== chatContext) {
                        console.error(`DepartmentChat: Context mismatch! Chat ${chatId}, expected ${chatContext}, got ${chatDocSnap.data().context}`);
                        toast.error("Error sending message: Context mismatch.");
                    } else {
                        await updateDoc(chatDocRef, updateData);
                    }
                } else {
                    const initialChatData = {
                        ...updateData,
                        createdAt: now,
                        members: members, // Overwrite arrayUnion with the actual array
                        lastRead: { [userCid]: now }
                    };
                    await setDoc(chatDocRef, initialChatData);
                    console.log(`DepartmentChat: Created chat doc ${chatId}`);
                }
            }
            // Input was already cleared and focus set earlier
        } catch (err) {
            console.error(`DepartmentChat: Error sending message or updating metadata for ${chatId}:`, err);
            toast.error("Failed to send message.");
            // Restore message on failure if desired (though focus is already set)
            // setNewMessage(trimmedMessage);
        } finally {
            setIsSending(false);
            // Focus is now handled by useEffect in ChatWindow
        }
    }, [
        newMessage,
        currentUser,
        selectedChat,
        isSending,
        unreadChats,
        updateLastReadTimestamp,
        getChatDocRef,
        displayChats,
        chatContext,
    ]);

    const handleCreateGroup = useCallback(async (name: string, selectedMemberCids: string[]) => {
        if (!currentUser?.cid) {
            toast.error("Cannot create group without logged-in user.");
            throw new Error("User not logged in");
        }
        const userCid = currentUser.cid; // Assign after check

        if (!name.trim() || selectedMemberCids.length === 0) {
            toast.warn("Group name and at least one member are required.");
            throw new Error("Invalid input");
        }

        const allMemberCids = Array.from(new Set([userCid, ...selectedMemberCids])); // Use userCid
        const now = serverTimestamp();
        const initialLastRead: { [cid: string]: any } = {};
        initialLastRead[userCid] = now; // Use userCid

        const groupData: Omit<ChatGroup, 'id'> & { context: 'department' } = {
            groupName: name.trim(),
            type: 'group',
            context: chatContext,
            members: allMemberCids,
            createdBy: userCid, // Use userCid
            createdAt: now,
            lastMessageTimestamp: now,
            lastRead: initialLastRead,
        };

        try {
            const docRef = await addDoc(collection(dbFirestore, 'chats'), groupData);
            toast.success(`Group "${name}" created successfully.`);
            setIsCreateGroupModalOpen(false);

            const newGroupForSelection: ChatGroup = {
                id: docRef.id, // Use the generated ID
                groupName: groupData.groupName,
                type: 'group',
                members: groupData.members,
                createdBy: groupData.createdBy,
                createdAt: Timestamp.now(),
                lastMessageTimestamp: Timestamp.now(),
                lastRead: { [userCid]: Timestamp.now() }, // Use userCid
                context: chatContext,
            };
            handleChatSelect(newGroupForSelection); // Select the new group
        } catch (err) {
            console.error("Error creating group:", err);
            toast.error("Failed to create group.");
            throw err;
        }
    }, [currentUser?.cid, handleChatSelect, chatContext]); // Keep original dependency

    const handleStartDirectChat = useCallback(async (memberCid: string) => {
        if (!currentUser?.cid) return;
        const userCid = currentUser.cid; // Assign after check

        const targetUser = users.find(u => u.cid === memberCid);
        if (targetUser) {
            // Generate the stable direct chat ID
            const directChatId = getDirectChatId(userCid, memberCid, chatContext); // Use userCid
            const chatDocRef = getChatDocRef(directChatId); // Use stable ID
            let docExists = false;
            if (chatDocRef) {
                const docSnap = await getDoc(chatDocRef);
                docExists = docSnap.exists();
            }

            // Select the user to open the chat window
            handleChatSelect(targetUser); // This now sets selectedChat.id to directChatId
            setIsCreateGroupModalOpen(false);

            // If the document doesn't exist, create it now using the stable directChatId
            if (!docExists && chatDocRef) {
                try {
                    const now = serverTimestamp();
                    const initialChatData = {
                        members: [userCid, memberCid], // Use userCid
                        type: 'direct',
                        context: chatContext,
                        createdAt: now,
                        lastMessageTimestamp: null, // No message yet
                        lastRead: { [userCid]: now }, // Use userCid
                    };
                    await setDoc(chatDocRef, initialChatData); // Use stable ID
                    console.log(`DepartmentChat: Preemptively created direct chat doc ${directChatId}`);
                } catch (error) {
                    console.error(`DepartmentChat: Failed to preemptively create direct chat doc ${directChatId}:`, error);
                }
            }

        } else {
            toast.error("Could not find selected user to start chat.");
        }
        // Update dependencies: added chatContext
    }, [users, handleChatSelect, currentUser?.cid, getChatDocRef, chatContext]);

    const handleDeselectChat = useCallback((sheetOpenState?: boolean) => {
        if (sheetOpenState === true) return; // Don't deselect if sheet is forced open
        setSelectedChat(null);
        setMessages([]);
        setNewMessage('');
        currentChatIdRef.current = null;
    }, []); // Removed currentUser?.cid dependency as it's stable within session

    // --- Hide Chat Logic ---
    const handleHideChat = useCallback(async (stableChatId: string) => {
        // Use currentUser.email as Firestore doc ID for the 'users' collection
        if (!currentUser?.email) { // Check for email instead of uid
             console.error("DepartmentChat: Cannot hide chat, missing current user's email.");
             toast.error("Could not hide chat. User identifier missing.");
             return;
        }
        // Use the email to reference the user document
        const userDocRef = doc(dbFirestore, 'users', currentUser.email); // Use email here

        // Optimistically update UI
        setHiddenChatIds(prev => new Set(prev).add(stableChatId));

        // Deselect chat if it's the one being hidden
        if (selectedChat?.id === stableChatId) {
            handleDeselectChat(false);
        }

        try {
            await updateDoc(userDocRef, {
                [`hiddenChats_${chatContext}`]: arrayUnion(stableChatId)
            });
            console.log(`DepartmentChat: Chat ${stableChatId} hidden for user ${currentUser.email}`); // Log using email
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
        // Update dependency from uid to email
    }, [currentUser?.email, chatContext, selectedChat?.id, handleDeselectChat]); // Keep dependencies


    // Effect to handle clicks outside the sidebar and sheet content when sheet is open (non-modal)
    useEffect(() => {
        // Only run if the sheet is supposed to be open
        if (!selectedChat) {
            return;
        }

        const handleClickOutside = (event: MouseEvent) => {
            // Check if the click is outside the sidebar AND outside the sheet content AND outside the dropdown content
            if (
                sidebarRef.current &&
                !sidebarRef.current.contains(event.target as Node) &&
                sheetContentRef.current &&
                !sheetContentRef.current.contains(event.target as Node) &&
                // Add check for dropdown content ref
                dropdownContentRef.current &&
                !dropdownContentRef.current.contains(event.target as Node)
            ) {
                handleDeselectChat(false); // Close the sheet
            }
        };

        // Add listener on mount/when selectedChat changes to truthy
        document.addEventListener('mousedown', handleClickOutside);

        // Cleanup listener on unmount/when selectedChat changes to falsy
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
        // Add dropdownContentRef.current to dependencies if needed, though refs usually don't trigger effects
    }, [selectedChat, handleDeselectChat]); // Dependencies: selectedChat state and the callback

    // --- Memoized Values for Child Components ---
    // Remove messagesForChatWindow memoization as passing raw messages directly
    // const messagesForChatWindow = useMemo(() => { ... }, [messages]);

    // --- Cleanup and Visibility Effect ---
    useEffect(() => {
        if (!isOpen) {
            handleDeselectChat(false);
            setSearchTerm('');
            setError(null);
            setIsCreateGroupModalOpen(false);
        }
    }, [isOpen, handleDeselectChat]);

    if (!isOpen) {
        return null;
    }

    // Update isLoading check
    const isLoading = authLoading || loadingUsers || loadingChats; // Include authLoading

    // --- Render ---
    return (
        <React.Fragment>
            {/* Sidebar Container */}
            <div
                ref={sidebarRef}
                // Ensure it's fixed to the top and uses full screen height
                className="fixed top-0 left-0 h-screen w-64 bg-card border-r border-border flex flex-col shadow-lg z-50"
                onClick={e => e.stopPropagation()} // Keep stopping propagation
            >
                <div className="p-4 border-b border-border flex-shrink-0 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">Department Chat</h2>
                    <div className="flex items-center space-x-1">
                        {/* Add Group Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsCreateGroupModalOpen(true)}
                            title="New Group Chat"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                        {/* Settings Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                {/* Wrap Button to stop propagation */}
                                <div onClick={(e) => e.stopPropagation()}>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        title="Chat Settings" // Updated title
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                ref={dropdownContentRef} // Attach the ref here
                                align="end"
                                onClick={(e) => e.stopPropagation()} // Keep stopPropagation
                            >
                                <DropdownMenuLabel>Chat Window Width</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {/* Map over updated widthOptions */}
                                {Object.entries(widthOptions).map(([key, option]) => (
                                    <DropdownMenuItem
                                        key={`width-${key}`}
                                        // onClick updates the state with the selected class
                                        onClick={() => setChatWidthClass(option.class)}
                                        disabled={chatWidthClass === option.class}
                                    >
                                        {option.label}
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Message Font Size</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {/* Map over UPDATED font size options */}
                                {Object.entries(fontSizeOptions).map(([percent, option]) => (
                                    <DropdownMenuItem
                                        key={`font-${percent}`}
                                        onClick={() => setFontSizePercent(Number(percent))}
                                        disabled={fontSizePercent === Number(percent)}
                                    >
                                        {option.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {/* Close Sidebar Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose} // Call the main onClose prop
                            title="Close Chat Panel"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <XIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className="p-4 border-b border-border flex-shrink-0">
                    <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center">
                            <SearchIcon className="h-4 w-4 text-muted-foreground" />
                        </span>
                        <Input
                            id="department-chat-search" // <-- Add unique ID
                            placeholder="Search chats..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-primary h-9 rounded-md"
                        />
                    </div>
                </div>
                <ScrollArea className="flex-grow custom-scrollbar">
                    <div className="space-y-1 p-2">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-full py-10">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : error ? (
                            <p className="text-center text-destructive text-sm p-4">{error}</p>
                        ) : filteredSortedDisplayChats.length === 0 ? ( // Use filteredSortedDisplayChats
                            <p className="text-center text-muted-foreground text-sm p-4">
                                {searchTerm ? 'No chats match your search.' : 'No active chats.'}
                            </p>
                        ) : (
                            filteredSortedDisplayChats.map(chat => { // Use filteredSortedDisplayChats
                                // Determine the ID to use for selection check (stable ID)
                                let checkId = '';
                                const targetUser = chat.target as User; // Cast once for clarity
                                if (chat.type === 'group') {
                                    checkId = chat.id;
                                } else if (currentUser?.cid && targetUser.cid) { // Check if targetUser.cid is truthy (string)
                                    checkId = getDirectChatId(currentUser.cid, targetUser.cid, chatContext);
                                }

                                const isSelected = selectedChat?.id === checkId;
                                const target = chat.target;
                                const name = chat.type === 'group'
                                    ? (target as ChatGroup).groupName
                                    : formatUserName(target as User);
                                const isUnread = chat.isUnread;

                                return (
                                    // Wrap the Button with ContextMenuTrigger
                                    <ContextMenu key={chat.stableId}>
                                        <ContextMenuTrigger asChild>
                                            {/* The Button itself is the trigger */}
                                            <Button
                                                variant="ghost"
                                                className={cn(
                                                    "w-full flex items-center justify-start gap-3 px-3 py-2 h-auto rounded-md transition-colors relative", // Added relative for badge
                                                    isSelected ? "bg-muted" : "hover:bg-muted",
                                                    // Adjust left padding if needed due to badge potentially overlapping avatar
                                                    "pl-6" // Keep padding for potential badge
                                                )}
                                                onClick={() => handleChatSelect(chat.target)}
                                            >
                                                {/* Unread Indicator Badge */}
                                                {isUnread && !isSelected && (
                                                    <Badge
                                                        variant="destructive"
                                                        className="absolute left-1 top-1/2 -translate-y-1/2 h-4 w-4 p-0 flex items-center justify-center rounded-full text-[10px]"
                                                    >
                                                        !
                                                    </Badge>
                                                )}
                                                {/* Avatar */}
                                                {chat.type === 'group' ? (
                                                    <Avatar className="h-9 w-9 flex-shrink-0 bg-muted text-muted-foreground">
                                                        <AvatarFallback><Users className="h-5 w-5"/></AvatarFallback>
                                                    </Avatar>
                                                ) : (
                                                    <Avatar className="h-9 w-9 flex-shrink-0">
                                                        <AvatarImage src={(target as User).photoURL || undefined} alt={name} />
                                                        <AvatarFallback>{getAvatarFallback(target as User)}</AvatarFallback>
                                                    </Avatar>
                                                )}
                                                {/* Name */}
                                                <div className="flex-grow overflow-hidden text-left"> {/* Removed pl-2 */}
                                                    <span className={cn(
                                                        "text-sm text-foreground truncate block", // Base text size for list item
                                                        // Corrected conditional class application
                                                        { 'font-medium': isSelected }
                                                    )}>
                                                        {name}
                                                    </span>
                                                </div>
                                            </Button>
                                        </ContextMenuTrigger>
                                        {/* Context Menu Content */}
                                        <ContextMenuContent className="w-48">
                                            <ContextMenuItem
                                                onSelect={(e) => {
                                                    e.preventDefault(); // Prevent default browser context menu
                                                    handleHideChat(chat.stableId);
                                                }}
                                                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer" // Added cursor-pointer
                                            >
                                                <FaEyeSlash className="mr-2 h-4 w-4" />
                                                Hide Chat
                                            </ContextMenuItem>
                                            {/* Add other context menu items here if needed */}
                                        </ContextMenuContent>
                                    </ContextMenu>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Chat Window Sheet */}
            <Sheet
                open={!!selectedChat}
                modal={false}
            >
                <SheetContent
                    // Remove key prop
                    ref={sheetContentRef}
                    side="left"
                    // Ensure sheet content is also fixed top, uses screen height, and positioned next to sidebar
                    className={cn(
                        "fixed top-0 h-screen p-0 border-l border-border bg-background flex flex-col ml-64 z-50", // Added fixed, top-0, h-screen
                        // REMOVED chatWidthClass from here (it's applied to inner div)
                        "[&_[data-slot=sheet-close]]:hidden"
                    )}
                    onClick={e => e.stopPropagation()}
                    onEscapeKeyDown={(e) => {
                        e.preventDefault();
                        handleDeselectChat(false);
                    }}
                    style={{ pointerEvents: 'auto' }} // Keep pointerEvents style
                >
                    {/* Inner wrapper div to control width and ensure flex column takes full height */}
                    <div className={cn("flex flex-col h-full w-full", chatWidthClass)}>
                        {/* Add VisuallyHidden Title and Description for SheetContent */}
                        <VisuallyHidden>
                            <DialogTitle>Chat Window</DialogTitle>
                            <DialogDescription>
                                Displays the selected chat messages and input field. Currently viewing {selectedChat ? (selectedChat.type === 'group' && 'groupName' in selectedChat.target ? `group chat ${selectedChat.target.groupName}` : `direct message with ${formatUserName(selectedChat.target as User)}`) : 'no chat'}.
                            </DialogDescription>
                        </VisuallyHidden>

                        {selectedChat && currentUser && ( // Ensure currentUser is also available
                            <ChatWindow
                                chatTarget={selectedChat.target}
                                messages={messages}
                                newMessage={newMessage}
                                onNewMessageChange={setNewMessage}
                                onSendMessage={handleSendMessage} // <-- Use original handleSendMessage here
                                onClose={() => handleDeselectChat(false)}
                                isLoading={loadingMessages}
                                isSending={isSending}
                                context={chatContext}
                                currentUser={currentUser}
                                allUsers={allUsersIncludingSelf}
                                fontSizePercent={fontSizePercent}
                                inputRef={inputRef} // Ensure inputRef is passed down (type now matches)
                            />
                        )}
                    </div> {/* End of inner wrapper div */}
                </SheetContent>
            </Sheet>

            {/* Create Group Modal */}
            <CreateGroupModal
                isOpen={isCreateGroupModalOpen}
                onClose={() => setIsCreateGroupModalOpen(false)}
                onCreateGroup={handleCreateGroup} // Pass memoized callback
                onStartDirectChat={handleStartDirectChat} // Pass memoized callback
                personnel={users}
                currentUserCid={currentUser?.cid}
            />
        </React.Fragment>
    );
};
