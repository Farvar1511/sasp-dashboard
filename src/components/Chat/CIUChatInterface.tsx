import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
} from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types/User';
import { ChatGroup } from '../../types/ChatGroup';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '../ui/dropdown-menu';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ChatMessageList } from '../ui/chat/chat-message-list';
import { ChatBubble, ChatBubbleAvatar, ChatBubbleMessage } from '../ui/chat/chat-bubble';
import { ChatInput } from '../ui/chat/chat-input';
import { toast } from 'react-toastify';
import { hasCIUPermission } from '../../utils/ciuUtils';
import { cn } from '../../lib/utils';
import { FaUsers, FaUser, FaPlus, FaSmile, FaTimes, FaEyeSlash } from 'react-icons/fa';
import CreateGroupModal from './CreateGroupModal';
import { formatUserName, getAvatarFallback } from './utils';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { useNotificationStore, UnreadNotification } from '../../store/notificationStore';

export const getDirectChatId = (cid1: string, cid2: string, context: 'ciu' | 'department'): string => {
    if (!cid1 || !cid2 || !context) {
        console.error("Cannot generate direct chat ID with invalid CIDs or context:", cid1, cid2, context);
        return '';
    }
    const sanitize = (cid: string) => cid.replace(/[^a-zA-Z0-9_-]/g, '_');
    return [sanitize(cid1), sanitize(cid2)].sort().join('--') + `--${context}`;
};


interface Message {
    id: string;
    senderId: string;
    receiverId?: string;
    text?: string;
    imageUrl?: string;
    timestamp: Timestamp | null;
    senderName?: string;
}

interface DisplayChat {
    id: string; // Firestore Doc ID (group or direct)
    type: 'group' | 'direct';
    target: ChatGroup | User;
    lastMessageTimestamp: Timestamp | null;
    isUnread: boolean;
    stableId: string; // Group ID or Generated Direct Chat ID
}


interface CIUChatInterfaceProps {
    // No props currently needed
}

const TYPING_TIMEOUT_MS = 3000;

export const CIUChatInterface: React.FC<CIUChatInterfaceProps> = () => {
    // --- Start of component body ---
    const { user: currentUser, loading: authLoading } = useAuth();
    const [ciuPersonnel, setCiuPersonnel] = useState<User[]>([]);
    const [selectedChat, setSelectedChat] = useState<User | ChatGroup | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingChats, setLoadingChats] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const messageContainerRef = useRef<HTMLDivElement>(null);
    const [typingIndicatorUsers, setTypingIndicatorUsers] = useState<string[]>([]);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const currentChatIdRef = useRef<string | null>(null);
    const [unreadChats, setUnreadChats] = useState<Set<string>>(new Set());
    const [hiddenChatIds, setHiddenChatIds] = useState<Set<string>>(new Set());
    const [allUserChats, setAllUserChats] = useState<DocumentData[]>([]);

    const chatContext = 'ciu';
    const setNotifications = useNotificationStore(state => state.setNotifications);

    const scrollToBottom = () => {
        if (messageContainerRef.current) {
            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
        }
    };

    // Load hidden chats from user profile on mount
    useEffect(() => {
        if (currentUser?.hiddenChats_ciu) {
            setHiddenChatIds(new Set(currentUser.hiddenChats_ciu));
        }
    }, [currentUser?.hiddenChats_ciu]);

    // Fetch CIU Personnel
    useEffect(() => {
        if (!currentUser?.cid) {
             console.log("CIUChat: Current user or CID not available yet.");
             setLoadingUsers(false);
             setCiuPersonnel([]);
             return;
        }
        console.log("CIUChat: Current User CID:", currentUser.cid);

        setLoadingUsers(true);
        const fetchPersonnel = async () => {
            try {
                const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
                console.log(`CIUChat: Fetched ${usersSnapshot.docs.length} total user documents.`);

                const usersData = usersSnapshot.docs
                    .map(doc => {
                        const data = doc.data();
                        console.log(`CIUChat: Processing doc ID: ${doc.id}, Data:`, data);
                        return { id: doc.id, cid: data.cid, ...data } as User; // Expect 'cid' field
                    })
                    .filter(u => {
                        const isCurrentUser = u.cid === currentUser.cid;
                        const hasPermission = hasCIUPermission(u);
                        if (!u.cid) {
                            console.warn(`CIUChat: User doc ${u.id} missing CID, excluding.`);
                            return false;
                        }
                        console.log(`CIUChat: Filtering user ${u.id} (CID: ${u.cid}). Is current user? ${isCurrentUser}. Has CIU permission? ${hasPermission}. Keep? ${!isCurrentUser && hasPermission}`);
                        return !isCurrentUser && hasPermission;
                    });

                usersData.sort((a, b) => formatUserName(a).localeCompare(formatUserName(b)));
                setCiuPersonnel(usersData);
            } catch (err) {
                console.error("Error fetching CIU personnel:", err);
                setError("Failed to load users.");
                toast.error("Failed to load CIU personnel for chat.");
            } finally {
                setLoadingUsers(false);
            }
        };
        fetchPersonnel();
    }, [currentUser?.cid]);

    const getChatDocRef = useCallback((chatId: string | null) => {
        if (!chatId) return null;
        return doc(dbFirestore, 'chats', chatId);
    }, []);

    // Fetch ALL User Chats & Handle Unread/Unhide on Receive
    useEffect(() => {
        if (authLoading || !currentUser?.cid) {
            setLoadingChats(false);
            setAllUserChats([]);
            setUnreadChats(new Set());
            setNotifications('ciu', []); // Clear notifications if user logs out/changes
            return;
        }
        setLoadingChats(true);

        const allChatsQuery = query(
            collection(dbFirestore, 'chats'),
            where('members', 'array-contains', currentUser.cid),
            where('context', '==', chatContext) // Filter for CIU context chats
        );

        const unsubscribe = onSnapshot(allChatsQuery, async (snapshot: QuerySnapshot<DocumentData>) => {
            const chatsData: DocumentData[] = [];
            const newUnreadChats = new Set<string>();
            let changedHiddenIds = false; // Flag to check if hiddenChatIds needs update
            const hiddenChatsUpdate: { [key: string]: any } = {}; // Firestore update object

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const chatId = doc.id; // Firestore Doc ID
                chatsData.push({ id: chatId, ...data }); // Store raw data

                // Unread Check Logic
                const lastMessageTimestamp = data.lastMessageTimestamp as Timestamp | undefined;
                const userLastReadTimestamp = currentUser?.cid ? data.lastRead?.[currentUser.cid] as Timestamp | undefined : undefined;

                let isUnread = false;
                if (lastMessageTimestamp) {
                    if (!userLastReadTimestamp || lastMessageTimestamp.toMillis() > userLastReadTimestamp.toMillis()) {
                        if (chatId !== currentChatIdRef.current) {
                             isUnread = true;
                             newUnreadChats.add(chatId);
                        }
                    }
                }

                // Unhide on Receive Logic (Persistent)
                let stableId = '';
                if (data.type === 'group') {
                    stableId = chatId;
                } else { // Direct chat
                    const members = data.members as string[] || [];
                    const otherMemberCid = members.find(cid => cid !== currentUser.cid);
                    if (otherMemberCid && currentUser.cid) {
                        stableId = getDirectChatId(currentUser.cid, otherMemberCid, chatContext);
                    }
                }

                if (stableId && isUnread && hiddenChatIds.has(stableId)) {
                    console.log(`CIUChat: Chat ${stableId} is unread and hidden, unhiding persistently.`);
                    changedHiddenIds = true;
                    hiddenChatsUpdate[`hiddenChats_${chatContext}`] = arrayRemove(stableId);
                    setHiddenChatIds(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(stableId);
                        return newSet;
                    });
                }
            });

            setAllUserChats(chatsData);
            setUnreadChats(newUnreadChats);
            setLoadingChats(false);

            if (changedHiddenIds && currentUser?.uid) {
                const userDocRef = doc(dbFirestore, 'users', currentUser.uid);
                try {
                    await updateDoc(userDocRef, hiddenChatsUpdate);
                    console.log(`CIUChat: Updated hidden chats in Firestore for user ${currentUser.uid}`);
                } catch (error) {
                    console.error(`CIUChat: Failed to update hidden chats in Firestore:`, error);
                }
            }

            // Derive and set notifications for Zustand store AFTER processing all chats
            const derivedNotifications = chatsData
                .filter(chatData => newUnreadChats.has(chatData.id)) // Filter for unread chats
                .map(chatData => {
                    const firestoreDocId = chatData.id; // Firestore Doc ID
                    const lastMsgTimestamp = chatData.lastMessageTimestamp instanceof Timestamp
                        ? chatData.lastMessageTimestamp
                        : null;
                    let name = 'Unknown Chat';
                    let targetType: 'group' | 'direct' = 'direct';
                    let targetId = ''; // Group ID or User CID
                    let stableId = ''; // Group ID or Generated Direct ID

                    if (chatData.type === 'group') {
                        name = chatData.groupName || 'Unknown Group';
                        targetType = 'group';
                        targetId = firestoreDocId;
                        stableId = firestoreDocId; // Group ID is the stable ID
                    } else {
                        const members = chatData.members as string[] || [];
                        const otherMemberCid = members.find(cid => cid !== currentUser?.cid); // Safe check for currentUser
                        if (otherMemberCid) {
                            const user = ciuPersonnel.find(p => p.cid === otherMemberCid);
                            name = user ? formatUserName(user) : 'Unknown User';
                            targetType = 'direct';
                            targetId = otherMemberCid; // Store the other user's CID
                            if (currentUser?.cid) { // Ensure currentUser.cid exists
                                stableId = getDirectChatId(currentUser.cid, otherMemberCid, chatContext);
                            }
                        }
                    }

                    // Ensure targetId and stableId are assigned before returning
                    if (!targetId || !stableId) {
                        console.warn("CIUChat: Could not determine targetId or stableId for notification:", chatData);
                        return null; // Return null if essential IDs are missing
                    }

                    return {
                        id: firestoreDocId, // Firestore Doc ID
                        name: name,
                        context: chatContext,
                        timestamp: lastMsgTimestamp,
                        targetType: targetType,
                        targetId: targetId,
                        stableId: stableId, // Include stable ID
                    } as UnreadNotification;
                })
                // Filter out nulls (from missing IDs) and notifications corresponding to locally hidden chats
                .filter((notification): notification is UnreadNotification => !!notification && !hiddenChatIds.has(notification.stableId));

            setNotifications('ciu', derivedNotifications);

        }, (err) => {
            console.error("Error fetching all user chats:", err);
            setError("Failed to load chats.");
            toast.error("Failed to load chats.");
            setLoadingChats(false);
            setAllUserChats([]);
            setUnreadChats(new Set());
            setNotifications('ciu', []); // Clear notifications on error
        });

        return () => {
            unsubscribe();
        };
    }, [authLoading, currentUser?.cid, currentUser?.uid, getChatDocRef, chatContext, setNotifications, hiddenChatIds, ciuPersonnel]);


    // --- Update Last Read Timestamp ---
    const updateLastReadTimestamp = useCallback(async (chatId: string) => {
        if (!currentUser?.cid || !chatId) return; // Check for CID
        const chatDocRef = getChatDocRef(chatId);
        if (!chatDocRef) return;

        try {
            await updateDoc(chatDocRef, {
                [`lastRead.${currentUser.cid}`]: serverTimestamp()
            });
            console.log(`Updated lastRead for ${currentUser.cid} in chat ${chatId}`);
        } catch (err) {
            if (err instanceof Error && (err.message.includes("No document to update") || err.message.includes("not found"))) {
                console.warn(`Chat doc ${chatId} might not exist yet for updating lastRead.`);
            } else {
                console.error(`Error updating lastRead timestamp for chat ${chatId}:`, err);
            }
        }
    }, [currentUser?.cid, getChatDocRef]);


    // --- Typing Indicator Logic ---
    const signalTyping = useCallback(async () => {
        const chatId = currentChatIdRef.current;
        const userCid = currentUser?.cid; // Use CID
        if (!chatId || !userCid) return;

        const chatDocRef = getChatDocRef(chatId);
        if (!chatDocRef) return;

        try {
            await updateDoc(chatDocRef, {
                typingUsers: arrayUnion(userCid) // Add CID to array
            });
        } catch (err) {
            console.error("Error signaling typing:", err);
        }
    }, [currentUser?.cid, getChatDocRef]);

    const signalStoppedTyping = useCallback(async () => {
        const chatId = currentChatIdRef.current;
        const userCid = currentUser?.cid; // Use CID
        if (!chatId || !userCid) return;

        const chatDocRef = getChatDocRef(chatId);
        if (!chatDocRef) return;

        try {
            await updateDoc(chatDocRef, {
                typingUsers: arrayRemove(userCid) // Remove CID from array
            });
        } catch (err) {
            console.error("Error signaling stopped typing:", err);
        }
    }, [currentUser?.cid, getChatDocRef]);

    // Effect to handle user input changes for typing indicator
    useEffect(() => {
        if (!selectedChat || !currentUser?.cid) return; // Check for CID

        if (newMessage.trim()) {
            signalTyping(); // Update Firestore immediately

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            typingTimeoutRef.current = setTimeout(() => {
                signalStoppedTyping();
            }, TYPING_TIMEOUT_MS);

        } else {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
                signalStoppedTyping(); // Signal stopped immediately if input cleared
            }
        }

        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [newMessage, selectedChat, currentUser?.cid, signalTyping, signalStoppedTyping]);


    // Fetch Messages and Listen for Typing Indicators
    useEffect(() => {
        if (!currentUser?.cid || !selectedChat) { // Check for CID
            setMessages([]);
            setTypingIndicatorUsers([]);
            currentChatIdRef.current = null; // Clear current chat ID ref
            return;
        }

        setLoadingMessages(true);
        setError(null); // Clear previous errors
        let chatId = '';

        if ('groupName' in selectedChat) {
            // It's a group chat
            chatId = selectedChat.id ?? '';
        } else {
            // It's a direct chat (User)
            if (currentUser.cid && selectedChat.cid !== undefined) {
                chatId = getDirectChatId(currentUser.cid, selectedChat.cid, chatContext);
            } else {
                console.error("Cannot fetch messages: Missing CID for direct chat.", { currentUserCid: currentUser.cid, selectedChatCid: selectedChat.cid });
                setError("Could not determine chat ID due to missing user identifier.");
                setLoadingMessages(false);
                currentChatIdRef.current = null;
                return; // Stop execution if CIDs are missing
            }
        }

        currentChatIdRef.current = chatId; // Store current chat ID

        if (!chatId) {
             setLoadingMessages(false);
             setError("Could not determine chat ID.");
             toast.error("Could not load messages for the selected chat.");
             return;
        }

        // Listener for Messages (Subcollection)
        const messagesRef = collection(dbFirestore, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));
        const unsubscribeMessages = onSnapshot(q, (snapshot) => {
            const fetchedMessages: Message[] = [];
            snapshot.forEach(doc => {
                 const data = doc.data();
                 const timestamp = data.timestamp instanceof Timestamp ? data.timestamp : null;
                 fetchedMessages.push({
                     id: doc.id,
                     senderId: data.senderId, // Sender's CID
                     receiverId: data.receiverId,
                     text: data.text,
                     imageUrl: data.imageUrl, // Add imageUrl here
                     timestamp: timestamp,
                     senderName: data.senderName,
                 });
            });
             fetchedMessages.sort((a, b) => (a.timestamp?.toMillis() ?? 0) - (b.timestamp?.toMillis() ?? 0));
             setMessages(fetchedMessages);
             setLoadingMessages(false);
             setError(null);
             setTimeout(scrollToBottom, 50);
        }, (err) => {
            console.error("Error fetching messages:", err);
            setError("Failed to load messages.");
            const chatName = 'groupName' in selectedChat ? selectedChat.groupName : formatUserName(selectedChat);
            toast.error(`Failed to load messages for ${chatName}.`);
            setLoadingMessages(false);
        });

        // Listener for Chat Document (Typing Indicators, Group Info)
        const chatDocRef = getChatDocRef(chatId); // References doc(dbFirestore, 'chats', chatId)
        let unsubscribeChatDoc: (() => void) | null = null;
        if (chatDocRef) {
            unsubscribeChatDoc = onSnapshot(chatDocRef, (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    const typingCids = (data?.typingUsers || []) as string[]; // Expecting CIDs
                    setTypingIndicatorUsers(typingCids.filter(cid => cid !== currentUser.cid)); // Filter by CID
                } else {
                    setTypingIndicatorUsers([]);
                }
            }, (err) => {
                console.error("Error listening to chat document:", err);
                setTypingIndicatorUsers([]);
            });
        }

        // Cleanup function
        return () => {
            unsubscribeMessages(); // Unsubscribe from messages
            if (unsubscribeChatDoc) {
                unsubscribeChatDoc(); // Unsubscribe from chat doc listener
            }
            // Signal stopped typing for the current user (CID) in this chat
            if (currentChatIdRef.current && currentUser?.cid) {
                 signalStoppedTyping(); // Use the callback for consistency
            }
            // Clear timeout ref on cleanup
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        };
    }, [currentUser?.cid, selectedChat, getChatDocRef, signalStoppedTyping]);

    // Scroll to bottom when selectedChat changes and messages load initially
    useEffect(() => {
        if (selectedChat && loadingMessages === false) {
            scrollToBottom();
        }
    }, [selectedChat, loadingMessages]);


    // --- Message Sending Logic ---
    const handleSendMessage = async () => {
        if (!newMessage.trim() || !currentUser?.cid || !selectedChat) return;

        const userCid = currentUser.cid;
        const trimmedMessage = newMessage.trim();
        let chatId = '';
        let isGroupChat = 'groupName' in selectedChat;
        let members: string[] = [];
        let recipientCid: string | undefined = undefined;

        if (isGroupChat) {
            chatId = selectedChat.id ?? '';
            members = (selectedChat as ChatGroup).members || [];
        } else {
            const targetUser = selectedChat as User;
            if (!targetUser.cid) {
                toast.error("Selected user is missing an identifier.");
                return;
            }
            recipientCid = targetUser.cid;
            chatId = getDirectChatId(userCid, recipientCid, chatContext);
            members = [userCid, recipientCid];
        }

        if (!chatId) {
            toast.error("Could not determine chat ID to send message.");
            return;
        }

        // Mark as read immediately
        updateLastReadTimestamp(chatId);
        setUnreadChats(prev => {
            const newSet = new Set(prev);
            newSet.delete(chatId);
            return newSet;
        });

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
            await addDoc(messagesRef, messageData);
            setNewMessage('');

            if (chatDocRef) {
                const chatDocSnap = await getDoc(chatDocRef);
                const now = serverTimestamp();
                const lastMessagePreview = isImageUrl ? "[Image]" : trimmedMessage.substring(0, 50);

                const updateData: { [key: string]: any } = {
                    lastMessageTimestamp: now,
                    [`lastRead.${userCid}`]: now,
                    lastMessageText: lastMessagePreview,
                    context: chatContext,
                    type: isGroupChat ? 'group' : 'direct',
                    // Only include members update for existing docs
                    // members: arrayUnion(...members), // REMOVED from base updateData
                };

                if (chatDocSnap.exists()) {
                    const chatData = chatDocSnap.data() as { context?: string }; // Type assertion
                    if (chatData.context !== chatContext) {
                        console.error(`Context mismatch! Trying to update chat ${chatId} with context ${chatContext}, but doc has context ${chatData.context}`);
                        toast.error("Error sending message: Context mismatch.");
                        return;
                    }
                    // Add members update specifically for existing docs
                    await updateDoc(chatDocRef, { ...updateData, members: arrayUnion(...members) });
                    console.log("Chat metadata updated for existing chat:", chatId);
                } else {
                    // Construct initialChatData directly without delete
                    const initialChatData = {
                        // Include fields from updateData except members arrayUnion
                        lastMessageTimestamp: now,
                        [`lastRead.${userCid}`]: now,
                        lastMessageText: lastMessagePreview,
                        context: chatContext,
                        type: isGroupChat ? 'group' : 'direct',
                        // Add other required fields for a new document
                        createdAt: now,
                        members: members, // Set the initial members array directly
                        typingUsers: [], // Initialize typing users
                        // lastRead needs to be initialized correctly for the sender
                        lastRead: { [userCid]: now },
                    };

                    await setDoc(chatDocRef, initialChatData);
                    console.log("Chat document created for new chat:", chatId);
                }
            }
        } catch (err) {
            console.error("Error sending message or updating chat metadata:", err);
            toast.error("Failed to send message.");
        }
    };

    // --- Group Creation Logic ---
    const handleCreateGroup = async (name: string, selectedMemberCids: string[]) => {
        if (!currentUser?.cid) { // Check for CID
            toast.error("Cannot create group without logged-in user.");
            return;
        }
        if (!name.trim()) {
            toast.warn("Group name cannot be empty.");
            return;
        }
        if (selectedMemberCids.length === 0) {
            toast.warn("Please select at least one member for the group.");
            return;
        }

        const allMemberCids = Array.from(new Set([currentUser.cid, ...selectedMemberCids])); // Use CIDs
        const now = serverTimestamp(); // Use server timestamp

        // Initialize lastRead map with the creator's CID
        const initialLastRead: { [cid: string]: any } = {};
        initialLastRead[currentUser.cid] = now; // Use CID

        // Add context: 'ciu'
        const groupData: Omit<ChatGroup, 'id'> & { context: 'ciu' } = { // Add context to type if ChatGroup doesn't have it
            groupName: name.trim(),
            type: 'group',
            context: chatContext, // Add context identifier
            members: allMemberCids, // Store member CIDs
            createdBy: currentUser.cid, // Store creator CID
            createdAt: now,
            lastMessageTimestamp: now, // Initialize timestamp
            typingUsers: [], // Initialize typing users (CIDs)
            lastRead: initialLastRead, // Initialize lastRead map (keys are CIDs)
        };

        try {
            // Creating a new group document in the 'chats' collection
            const docRef = await addDoc(collection(dbFirestore, 'chats'), groupData);
            toast.success(`Group "${name}" created successfully.`);
            handleCloseCreateGroupModal(); // Close modal on success

            // Optionally, select the newly created group
            const newGroup: ChatGroup = {
                id: docRef.id,
                groupName: groupData.groupName,
                type: 'group',
                members: groupData.members,
                createdBy: groupData.createdBy,
                createdAt: Timestamp.now(), // Use client timestamp for immediate selection
                lastMessageTimestamp: Timestamp.now(),
                lastRead: { [currentUser.cid]: Timestamp.now() }, // Use CID
                context: groupData.context,
            };
            setSelectedChat(newGroup); // Select the new group

        } catch (err) {
            console.error("Error creating group:", err);
            toast.error("Failed to create group.");
            throw err; // Re-throw error to signal failure to modal
        }
    };

    // --- Chat Selection Handler ---
    const handleChatSelect = useCallback((chatTarget: User | ChatGroup) => {
        // Clear previous typing indicator (using CID)
        if (currentChatIdRef.current && currentUser?.cid) {
            const cleanupChatRef = getChatDocRef(currentChatIdRef.current);
            if (cleanupChatRef) {
                updateDoc(cleanupChatRef, {
                    typingUsers: arrayRemove(currentUser.cid) // Remove CID
                }).catch(err => console.error("Error cleaning up typing status on chat switch:", err));
            }
        }
        // Clear timeout ref on chat switch
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }

        setSelectedChat(chatTarget);
        setMessages([]); // Clear messages immediately on selection
        setTypingIndicatorUsers([]); // Clear typing indicators immediately
        setNewMessage(''); // Clear input field
        setShowEmojiPicker(false); // Hide emoji picker

        // Determine chatId for the selected chat (using CID)
        let chatIdToMarkRead = '';
        let targetCid: string | undefined = undefined;

        if ('groupName' in chatTarget) {
            chatIdToMarkRead = chatTarget.id;
        } else if (currentUser?.cid) {
            if (chatTarget.cid !== undefined) {
                targetCid = chatTarget.cid;
                chatIdToMarkRead = getDirectChatId(currentUser.cid, targetCid, chatContext);
            } else {
                console.error("Selected user is missing CID:", chatTarget);
                toast.error("Cannot select user without a valid identifier.");
            }
        }

        // Mark the selected chat as read
        if (chatIdToMarkRead) {
            updateLastReadTimestamp(chatIdToMarkRead);
            setUnreadChats(prev => {
                const newSet = new Set(prev);
                newSet.delete(chatIdToMarkRead);
                return newSet;
            });
        }

    }, [currentUser?.cid, getChatDocRef, updateLastReadTimestamp, chatContext]);


    // --- Direct Chat Start Logic (from Modal) ---
    const handleStartDirectChatFromModal = useCallback((memberCid: string) => {
        const targetUser = ciuPersonnel.find(p => p.cid === memberCid);
        if (targetUser) {
            console.log("Starting direct chat via modal with:", targetUser);
            handleChatSelect(targetUser);
            handleCloseCreateGroupModal(); // Use the function defined below
        } else {
            console.error("Could not find user with CID to start direct chat:", memberCid);
            toast.error("Failed to find selected user.");
        }
    }, [ciuPersonnel, handleChatSelect]);


    // --- Typing Users Display Names ---
    const getTypingUserNames = () => {
        const typingUsers = typingIndicatorUsers
            .map(cid => {
                const user = ciuPersonnel.find(p => p.cid === cid);
                return user ? formatUserName(user) : null;
            })
            .filter((name): name is string => !!name); // Filter out nulls
        return typingUsers.join(', ');
    };


    const isLoading = loadingUsers || loadingChats;
    const selectedChatId = selectedChat ? ('groupName' in selectedChat ? selectedChat.id : selectedChat.cid) : null;


    // --- Emoji Picker Handler ---
    const onEmojiClick = (emojiData: EmojiClickData, event: MouseEvent) => {
        setNewMessage(prevMessage => prevMessage + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    // --- Modal Handlers ---
    const handleCloseCreateGroupModal = () => {
        setIsCreateGroupModalOpen(false);
    };

    const handleOpenCreateGroupModal = () => {
        setIsCreateGroupModalOpen(true);
    };

    // --- Close Chat Handler ---
    const handleCloseChat = useCallback(() => {
        // Check currentUser before calling signalStoppedTyping
        if (currentUser?.cid) {
            signalStoppedTyping();
        }
        // Clear timeout ref
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }

        // Reset state
        setSelectedChat(null);
        setMessages([]);
        setTypingIndicatorUsers([]);
        setNewMessage('');
        setShowEmojiPicker(false);
        currentChatIdRef.current = null;
        setError(null);

    }, [currentUser?.cid, signalStoppedTyping]);

    // --- Hide Chat Handler ---
    const handleHideChat = useCallback((stableChatId: string) => {
        if (!currentUser?.uid) return; // Need UID to update user doc
        const userDocRef = doc(dbFirestore, 'users', currentUser.uid);

        // Optimistically update UI
        setHiddenChatIds(prev => new Set(prev).add(stableChatId));

        // Deselect chat if it's the one being hidden
        const currentSelectedStableId = selectedChat
            ? ('groupName' in selectedChat
                ? selectedChat.id
                : (selectedChat.cid && currentUser?.cid ? getDirectChatId(currentUser.cid, selectedChat.cid, chatContext) : null))
            : null;
        if (currentSelectedStableId === stableChatId) {
            handleCloseChat();
        }

        // Update Firestore persistently
        updateDoc(userDocRef, {
            [`hiddenChats_${chatContext}`]: arrayUnion(stableChatId)
        }).then(() => {
            console.log(`CIUChat: Chat ${stableChatId} hidden persistently for user ${currentUser.uid}`);
            toast.info("Chat hidden. New messages will unhide it.");
        }).catch((error) => {
            console.error("Error hiding chat persistently:", error);
            toast.error("Failed to save hidden chat status.");
            // Revert optimistic UI update on error
            setHiddenChatIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(stableChatId);
                return newSet;
            });
        });

    }, [selectedChat, currentUser?.cid, currentUser?.uid, handleCloseChat, chatContext]);


    // --- Derive Sorted Chat Lists for Sidebar ---
    const sortedDisplayChats = useMemo((): DisplayChat[] => {
        if (!currentUser?.cid || !allUserChats || !ciuPersonnel) return [];

        const processedChatsMap = allUserChats.reduce((accMap, chatData) => {
            const chatId = chatData.id; // Firestore document ID
            const lastMsgTimestamp = chatData.lastMessageTimestamp instanceof Timestamp
                ? chatData.lastMessageTimestamp
                : null;
            const createdAtTimestamp = chatData.createdAt instanceof Timestamp
                ? chatData.createdAt
                : null;
            const effectiveTimestamp = lastMsgTimestamp || createdAtTimestamp;

            let stableId: string | null = null; // Initialize stableId

            if (chatData.type === 'group') {
                stableId = chatId; // Group ID is the stable ID
                const group: ChatGroup = {
                    id: chatId,
                    groupName: chatData.groupName || 'Unknown Group',
                    type: 'group',
                    members: chatData.members || [],
                    createdBy: chatData.createdBy || '',
                    createdAt: createdAtTimestamp || Timestamp.now(),
                    lastMessageTimestamp: effectiveTimestamp || undefined,
                    typingUsers: chatData.typingUsers || [],
                    lastRead: chatData.lastRead || {},
                    context: chatContext,
                };
                const displayChat: DisplayChat = {
                    id: chatId, // Firestore Doc ID
                    stableId: stableId || '', // Assign stableId with fallback to an empty string
                    type: 'group',
                    target: group,
                    lastMessageTimestamp: effectiveTimestamp,
                    isUnread: unreadChats.has(chatId),
                };

                // Use stableId (chatId for groups) as the map key
                const existing = accMap.get(stableId);
                if (!existing || (effectiveTimestamp && (!existing.lastMessageTimestamp || effectiveTimestamp.toMillis() > existing.lastMessageTimestamp.toMillis()))) {
                    accMap.set(stableId, displayChat);
                } else if (existing && displayChat.isUnread && !existing.isUnread) {
                     accMap.set(stableId, { ...existing, isUnread: true, id: chatId }); // Update unread status and potentially the Firestore ID if needed
                }

            } else if (chatData.type === 'direct' || !chatData.type) {
                const members = chatData.members as string[] || [];
                const otherMemberCid = members.find(cid => cid !== currentUser.cid);

                if (otherMemberCid && currentUser.cid) {
                    const user = ciuPersonnel.find(p => p.cid === otherMemberCid);
                    if (user) {
                        stableId = getDirectChatId(currentUser.cid, otherMemberCid, chatContext); // Generated Direct Chat ID
                        const displayChat: DisplayChat = {
                            id: chatId, // Store Firestore Doc ID here
                            stableId: stableId, // Store Generated Direct Chat ID here
                            type: 'direct',
                            target: user,
                            lastMessageTimestamp: effectiveTimestamp,
                            isUnread: unreadChats.has(chatId), // Check unread using Firestore Doc ID
                        };

                        // Use stableId (generated direct ID) as the map key
                        const existing = accMap.get(stableId);
                        if (!existing || (effectiveTimestamp && (!existing.lastMessageTimestamp || effectiveTimestamp.toMillis() > existing.lastMessageTimestamp.toMillis()))) {
                            accMap.set(stableId, displayChat);
                        } else if (existing && displayChat.isUnread && !existing.isUnread) {
                             accMap.set(stableId, { ...existing, isUnread: true, id: chatId }); // Update unread status and Firestore ID
                        }
                    } else {
                         console.warn(`Direct chat ${chatId}: Could not find user data for CID ${otherMemberCid}`);
                    }
                } else {
                     if (!otherMemberCid) console.warn(`Direct chat ${chatId}: Could not determine other member CID.`);
                }
            } else {
                 console.warn(`Chat ${chatId}: Unknown or invalid type "${chatData.type}"`);
            }

            return accMap;
        }, new Map<string, DisplayChat>()); // Map keyed by stableId

        const processedChats = Array.from(processedChatsMap.values()) as DisplayChat[]; // Explicitly cast to DisplayChat[]

        // Sort logic remains the same
        processedChats.sort((a, b) => {
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

        return processedChats;

    }, [allUserChats, ciuPersonnel, currentUser?.cid, unreadChats, chatContext]);


    // --- Render ---
    return (
        <div
            className="flex h-[calc(100vh-220px)] border rounded-lg overflow-hidden"
            style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-foreground)',
            }}
        >
            {/* User List Sidebar */}
            <div
                className="w-1/5 border-r p-2 flex flex-col"
                style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-background)',
                }}
            >
                {/* Sidebar Header */}
                <div className="flex justify-between items-center mb-2 px-2">
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>Chats</h3>
                    <div className="flex items-center space-x-1">
                        {/* Create Group Button - Keep variant/size, adjust color if needed */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleOpenCreateGroupModal}
                            title="New Chat / Group"
                            className="text-muted-foreground hover:text-foreground" // Keep hover class for interaction
                            // style={{ color: 'var(--color-muted-foreground)' }} // Base color set by variant/class
                        >
                            <FaPlus className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Chat List */}
                {isLoading ? (
                    <p className="px-2" style={{ color: 'var(--color-muted-foreground)' }}>Loading chats...</p>
                ) : error ? (
                     <p className="px-2" style={{ color: 'var(--color-destructive)' }}>{error}</p>
                ) : sortedDisplayChats.length === 0 ? (
                     <p className="px-2" style={{ color: 'var(--color-muted-foreground)' }}>No chats available.</p>
                ): (
                    <ScrollArea className="h-full custom-scrollbar">
                        {/* Render Groups */}
                        {sortedDisplayChats.some(c => c.type === 'group' && !hiddenChatIds.has(c.stableId)) && ( // Use stableId for hidden check
                            <div className="mb-3">
                                <h4 className="text-xs font-semibold uppercase px-2 mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Groups</h4>
                                {sortedDisplayChats
                                    .filter(chat => chat.type === 'group' && !hiddenChatIds.has(chat.stableId)) // Use stableId
                                    .map(displayChat => {
                                        const group = displayChat.target as ChatGroup;
                                        const isUnread = displayChat.isUnread;
                                        const isSelected = selectedChatId === group.id; // Selection still uses Firestore ID for groups
                                        return (
                                            <div
                                                key={displayChat.stableId} // Use stableId as key
                                                className={cn(
                                                    "w-full flex items-center p-2 rounded cursor-pointer transition-colors duration-150 hover:bg-muted relative group", // Keep hover
                                                    isSelected ? "font-semibold" : "" // Keep font weight change
                                                )}
                                                style={{
                                                    backgroundColor: isSelected ? 'var(--color-muted)' : undefined,
                                                    color: isUnread && !isSelected ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
                                                }}
                                                onClick={() => handleChatSelect(group)}
                                            >
                                                {isUnread && !isSelected && (
                                                    <span
                                                        className="absolute left-0 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full ml-[-4px]"
                                                        style={{ backgroundColor: 'var(--color-primary)' }} // Use primary for indicator
                                                    ></span>
                                                )}
                                                <Avatar className="h-8 w-8 mr-3 flex-shrink-0">
                                                    <AvatarFallback><FaUsers /></AvatarFallback>
                                                </Avatar>
                                                <div className="flex-grow overflow-hidden">
                                                    <span
                                                        className={cn("truncate font-medium text-sm")}
                                                        style={{ color: isSelected || (isUnread && !isSelected) ? 'var(--color-foreground)' : 'var(--color-muted-foreground)' }}
                                                    >
                                                        {group.groupName}
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => { e.stopPropagation(); handleHideChat(group.id); }} // Use stableId
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" // Keep hover/group-hover
                                                    title="Hide Chat"
                                                >
                                                    <FaEyeSlash className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        );
                                })}

                            </div>
                        )}

                        {/* Render Direct Messages */}
                         {sortedDisplayChats.some(c => c.type === 'direct' && !hiddenChatIds.has(c.stableId)) && ( // Use stableId for hidden check
                            <div>
                                <h4 className="text-xs font-semibold uppercase px-2 mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Direct Messages</h4>
                                {sortedDisplayChats
                                    .filter(chat => chat.type === 'direct' && !hiddenChatIds.has(chat.stableId)) // Use stableId
                                    .map(displayChat => {
                                        const user = displayChat.target as User;
                                        const stableId = displayChat.stableId; // This is the generated direct chat ID
                                        const isUnread = displayChat.isUnread;
                                        const isSelected = selectedChat && !('groupName' in selectedChat) && selectedChat.cid === user.cid;
                                        return (
                                            <div
                                                key={stableId} // Use stableId as key
                                                className={cn(
                                                    "w-full flex items-center p-2 rounded cursor-pointer transition-colors duration-150 hover:bg-muted relative group", // Keep hover
                                                    isSelected ? "font-semibold" : "" // Keep font weight
                                                )}
                                                style={{
                                                    backgroundColor: isSelected ? 'var(--color-muted)' : undefined,
                                                    color: isUnread && !isSelected ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
                                                }}
                                                onClick={() => handleChatSelect(user)}
                                            >
                                                {isUnread && !isSelected && (
                                                    <span
                                                        className="absolute left-0 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full ml-[-4px]"
                                                        style={{ backgroundColor: 'var(--color-primary)' }} // Use primary for indicator
                                                    ></span>
                                                )}
                                                <Avatar className="h-8 w-8 mr-3 flex-shrink-0">
                                                    <AvatarImage src={user.photoURL || undefined} alt={formatUserName(user)} />
                                                    <AvatarFallback>{getAvatarFallback(user)}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-grow overflow-hidden">
                                                    <span
                                                        className={cn("truncate font-medium text-sm")}
                                                        style={{ color: isSelected || (isUnread && !isSelected) ? 'var(--color-foreground)' : 'var(--color-muted-foreground)' }}
                                                    >
                                                        {formatUserName(user)}
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => { e.stopPropagation(); handleHideChat(stableId); }} // Use stableId
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" // Keep hover/group-hover
                                                    title="Hide Chat"
                                                    disabled={!stableId} // Disable if ID couldn't be generated
                                                >
                                                    <FaEyeSlash className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        );
                                })}
                            </div>
                         )}
                    </ScrollArea>
                )}
            </div>


            {/* Chat Area */}
            <div
                className="w-4/5 flex flex-col"
                style={{ backgroundColor: 'var(--color-background)' }}
            >
                {selectedChat ? (
                    <>
                        {/* Chat Header */}
                        <div
                            className="border-b p-3 flex items-center space-x-2"
                            style={{
                                borderColor: 'var(--color-border)',
                                backgroundColor: 'var(--color-muted)', // Use muted for header bg
                            }}
                        >
                             <Avatar className="h-8 w-8 flex-shrink-0">
                                {'groupName' in selectedChat ? (
                                    <AvatarFallback><FaUsers /></AvatarFallback> // Group Icon
                                ) : (
                                    <>
                                        <AvatarImage src={selectedChat.photoURL || undefined} alt={formatUserName(selectedChat)} />
                                        <AvatarFallback>{getAvatarFallback(selectedChat)}</AvatarFallback>
                                    </>
                                )}
                            </Avatar>
                            <h3 className="text-lg font-semibold truncate flex-grow" style={{ color: 'var(--color-foreground)' }}>
                                {'groupName' in selectedChat ? selectedChat.groupName : formatUserName(selectedChat)}
                            </h3>
                            {'groupName' in selectedChat && (
                                <div className="flex items-center space-x-1 overflow-hidden ml-auto pl-2">
                                  {selectedChat.members // Contains CIDs
                                    .map((cid: string): User | undefined => ciuPersonnel.find((p: User) => p.cid === cid)) // Find by CID
                                    .filter((member: User | undefined): member is User => !!member && member.cid !== currentUser?.cid) // Check CID
                                    .slice(0, 4)
                                    .map((member: User) => ( // member is guaranteed to be User here due to filter
                                      <Avatar key={member.id} className="h-6 w-6 border-2" title={formatUserName(member)} style={{ borderColor: 'var(--color-muted)' }}> {/* Use muted for border */}
                                        <AvatarImage src={member.photoURL || undefined} alt={formatUserName(member)} />
                                        <AvatarFallback className="text-xs">{getAvatarFallback(member)}</AvatarFallback>
                                      </Avatar>
                                    ))
                                  }
                                  {/* Optional: Show "+X more" - Use theme muted colors */}
                                  {selectedChat.members.filter((cid: string): boolean => { // Filter by CID
                                    const member = ciuPersonnel.find((p: User) => p.cid === cid); // Find by CID
                                    return !!member && member.cid !== currentUser?.cid; // Check CID
                                  }).length > 4 && (
                                    <div className="flex items-center justify-center h-6 w-6 rounded-full text-xs border-2" style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-muted-foreground)', borderColor: 'var(--color-muted)' }}>
                                      +{selectedChat.members.filter((cid: string): boolean => {
                                        const member = ciuPersonnel.find((p: User) => p.cid === cid); // Find by CID
                                        return !!member && member.cid !== currentUser?.cid; // Check CID
                                      }).length - 4}
                                    </div>
                                  )}
                                </div>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleCloseChat}
                                title="Close Chat"
                                className="text-muted-foreground hover:text-destructive ml-2 flex-shrink-0" // Keep hover
                            >
                                <FaTimes className="h-5 w-5" />
                            </Button>
                        </div>


                        {/* Scrollable Message Container */}
                        <div ref={messageContainerRef} className="flex-grow p-4 overflow-y-auto space-y-3 relative custom-scrollbar">
                            <ChatMessageList className="space-y-3">
                                {messages.map(msg => {
                                    const isSent = msg.senderId === currentUser?.cid;
                                    const senderUser = isSent
                                        ? currentUser
                                        : ciuPersonnel.find(p => p.cid === msg.senderId) || null;
                                    const timestamp = msg.timestamp?.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) ?? '';
                                    const senderName = msg.senderName || formatUserName(senderUser);
                                    const senderAvatarSrc = senderUser?.photoURL || undefined;
                                    const senderAvatarFallback = getAvatarFallback(senderUser);
                                    const showSenderName = !isSent && selectedChat && 'groupName' in selectedChat;

                                    return (
                                        <ChatBubble
                                            key={msg.id}
                                            variant={isSent ? 'sent' : 'received'}
                                            className={cn(
                                                "px-3 py-2 rounded-lg shadow-sm max-w-[75%]",
                                                isSent ? 'self-end' : 'self-start' // Keep alignment classes
                                            )}
                                            style={{
                                                backgroundColor: isSent ? 'var(--color-primary)' : 'var(--color-muted)',
                                                color: isSent ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                                            }}
                                        >
                                            {!isSent && (
                                                <ChatBubbleAvatar
                                                    src={senderAvatarSrc}
                                                    fallback={senderAvatarFallback}
                                                    className="h-6 w-6 mr-2"
                                                />
                                            )}
                                            <div className="flex flex-col">
                                                {showSenderName && (
                                                    <p className="text-xs mb-0.5 font-medium" style={{ color: 'var(--color-muted-foreground)', opacity: 0.8 }}>{senderName}</p>
                                                )}
                                                {/* Conditionally render Image or Text */}
                                                {msg.imageUrl ? (
                                                    <img
                                                        src={msg.imageUrl}
                                                        alt="Sent image"
                                                        className="max-w-xs max-h-60 rounded-md object-contain my-1" // Adjust size as needed
                                                        // Add loading state?
                                                    />
                                                ) : (
                                                    <ChatBubbleMessage className="text-sm leading-snug">
                                                        {msg.text}
                                                    </ChatBubbleMessage>
                                                )}
                                                {/* Replace ChatBubbleTimestamp with a div */}
                                                {timestamp && (
                                                    <div
                                                        className="text-xs mt-1 opacity-70 text-right" // Added text-right
                                                        style={{ color: isSent ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)', opacity: 0.8 }}
                                                    >
                                                        {timestamp}
                                                    </div>
                                                )}
                                            </div>
                                        </ChatBubble>
                                    );
                                })}

                                {/* Loading Indicator - Use theme muted */}
                                {loadingMessages && (
                                     <ChatBubble variant="received" className="self-start px-3 py-2 rounded-lg shadow-sm" style={{ backgroundColor: 'var(--color-muted)'}}>
                                         <ChatBubbleAvatar fallback="?" className="h-6 w-6 mr-2" />
                                         <ChatBubbleMessage isLoading={true} className="text-sm" style={{ color: 'var(--color-foreground)' }}>&nbsp;</ChatBubbleMessage>
                                     </ChatBubble>
                                )}

                                {/* Typing Indicator - Use theme muted */}
                                {typingIndicatorUsers.length > 0 && (
                                    <ChatBubble variant="received" className="self-start px-3 py-2 rounded-lg shadow-sm max-w-[75%]" style={{ backgroundColor: 'var(--color-muted)'}}>
                                        <div className="flex flex-col">
                                             <p className="text-xs mb-0.5 font-medium" style={{ color: 'var(--color-muted-foreground)', opacity: 0.8 }}>
                                                {getTypingUserNames()} {typingIndicatorUsers.length === 1 ? 'is' : 'are'} typing...
                                             </p>
                                             <div className="flex space-x-1 items-center h-4">
                                                <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.3s]" style={{ backgroundColor: 'var(--color-muted-foreground)', opacity: 0.6 }}></span>
                                                <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.15s]" style={{ backgroundColor: 'var(--color-muted-foreground)', opacity: 0.6 }}></span>
                                                <span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-muted-foreground)', opacity: 0.6 }}></span>
                                             </div>
                                        </div>
                                    </ChatBubble>
                                )}

                            </ChatMessageList>
                        </div>

                        {/* Message Input Area */}
                        <div
                            className="border-t p-3 relative" // Removed flex-shrink-0
                            style={{
                                borderColor: 'var(--color-border)',
                                backgroundColor: 'var(--color-muted)', // Use muted for input area bg
                            }}
                        >
                            {showEmojiPicker && (
                                <div
                                    className="absolute bottom-full right-2 mb-2 z-10 border rounded-lg shadow-lg"
                                    style={{
                                        backgroundColor: 'var(--color-background)', // Use background for picker popover
                                        borderColor: 'var(--color-border)',
                                    }}
                                >
                                    <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.DARK} /> {/* Use DARK theme for picker on dark background */}
                                </div>
                            )}
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    title="Toggle Emoji Picker"
                                    className="text-muted-foreground hover:text-foreground" // Keep hover
                                >
                                    <FaSmile className="h-5 w-5" />
                                </Button>
                                <ChatInput
                                    value={newMessage}
                                    onChange={(e) => {
                                        setNewMessage(e.target.value);
                                        if (showEmojiPicker) setShowEmojiPicker(false);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    placeholder="Type your message here..."
                                    className="rounded-md flex-grow border placeholder:text-muted-foreground" // Keep placeholder class
                                    style={{
                                        backgroundColor: 'var(--color-background)', // Use background for input itself
                                        borderColor: 'var(--color-border)',
                                        color: 'var(--color-foreground)',
                                    }}
                                    disabled={!selectedChat} // Input is disabled if selectedChat is null or undefined
                                />
                            </div>
                        </div>
                    </>
                ) : (
                     <div className="flex-grow flex items-center justify-center">
                         <p style={{ color: 'var(--color-muted-foreground)' }}>Select a chat to start messaging</p>
                     </div>
                )}
            </div>

            {/* Create Group Modal */}
            <CreateGroupModal
                isOpen={isCreateGroupModalOpen}
                onClose={handleCloseCreateGroupModal}
                onCreateGroup={handleCreateGroup}
                onStartDirectChat={handleStartDirectChatFromModal}
                personnel={ciuPersonnel}
                currentUserCid={currentUser?.cid}
            />
        </div>
    );
};

