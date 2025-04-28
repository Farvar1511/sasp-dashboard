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
import { ChatBubble, ChatBubbleAvatar, ChatBubbleMessage, ChatBubbleTimestamp } from '../ui/chat/chat-bubble';
import { ChatInput } from '../ui/chat/chat-input';
import { toast } from 'react-toastify';
import { hasCIUPermission } from '../../utils/ciuUtils';
import { cn } from '../../lib/utils';
import { FaUsers, FaUser, FaPlus, FaSmile, FaTimes, FaEyeSlash, FaUserPlus } from 'react-icons/fa';
import CreateGroupModal from './CreateGroupModal';
import { formatUserName, getAvatarFallback } from './utils';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';

const getDirectChatId = (cid1: string, cid2: string): string => {
    if (!cid1 || !cid2) {
        console.error("Cannot generate direct chat ID with invalid CIDs:", cid1, cid2);
        return '';
    }
    const sanitize = (cid: string) => cid.replace(/[^a-zA-Z0-9_-]/g, '_');
    return [sanitize(cid1), sanitize(cid2)].sort().join('--');
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
    id: string;
    type: 'group' | 'direct';
    target: ChatGroup | User;
    lastMessageTimestamp: Timestamp | null;
    isUnread: boolean;
}

interface CIUChatInterfaceProps {
    onUnreadCountChange: (count: number) => void;
}

const TYPING_TIMEOUT_MS = 3000;

export const CIUChatInterface: React.FC<CIUChatInterfaceProps> = ({ onUnreadCountChange }) => {
    const { user: currentUser } = useAuth();
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


    const scrollToBottom = () => {
        if (messageContainerRef.current) {
            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        if (!currentUser?.cid) {
             console.log("CIUChat: Current user or CID not available yet.");
             setLoadingUsers(false);
             setCiuPersonnel([]);
             return;
        }
        console.log("CIUChat: Current User CID:", currentUser.cid);

        setLoadingUsers(true);
        // Use CID for the check now
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
                        // Ensure CID is present for filtering and selection
                        return { id: doc.id, cid: data.cid, ...data } as User; // Expect 'cid' field
                    })
                    .filter(u => {
                        const isCurrentUser = u.cid === currentUser.cid;
                        const hasPermission = hasCIUPermission(u);
                        // Ensure user has a CID to be included
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
    }, [currentUser?.cid]); // Depend on CID

    // Fetch ALL User Chats (Groups and Direct) & Handle Unread/Unhide on Receive
    useEffect(() => {
        if (!currentUser?.cid) {
            setLoadingChats(false);
            setAllUserChats([]);
            setUnreadChats(new Set());
            return;
        }
        setLoadingChats(true);

        const allChatsQuery = query(
            collection(dbFirestore, 'chats'),
            where('members', 'array-contains', currentUser.cid)
        );

        const unsubscribe = onSnapshot(allChatsQuery, (snapshot: QuerySnapshot<DocumentData>) => {
            const chatsData: DocumentData[] = [];
            const newUnreadChats = new Set<string>();
            let changedHiddenIds = false; // Flag to check if hiddenChatIds needs update

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const chatId = doc.id;
                chatsData.push({ id: chatId, ...data }); // Store raw data

                // Unread Check Logic (moved here)
                const lastMessageTimestamp = data.lastMessageTimestamp as Timestamp | undefined;
                const userLastReadTimestamp = currentUser?.cid ? data.lastRead?.[currentUser.cid] as Timestamp | undefined : undefined;
                let isUnread = false;

                if (lastMessageTimestamp) {
                    // If user has never read (no timestamp) or last message is newer
                    if (!userLastReadTimestamp || lastMessageTimestamp.toMillis() > userLastReadTimestamp.toMillis()) {
                        // Don't count the currently selected chat as unread immediately
                        // (It will be marked read shortly by handleChatSelect/handleSendMessage)
                        if (chatId !== currentChatIdRef.current) {
                             isUnread = true;
                             newUnreadChats.add(chatId);
                        }
                    }
                }

                // Unhide on Receive Logic
                if (isUnread && hiddenChatIds.has(chatId)) {
                    console.log(`Chat ${chatId} is unread and hidden, unhiding.`);
                    // We need to update the state *after* the loop
                    changedHiddenIds = true;
                    // Temporarily remove from the current check set to avoid repeated logs if multiple updates happen fast
                    hiddenChatIds.delete(chatId);
                }
            });

            setAllUserChats(chatsData);
            setUnreadChats(newUnreadChats);
            setLoadingChats(false);

            // Update hiddenChatIds state if any were removed
            if (changedHiddenIds) {
                setHiddenChatIds(prev => {
                    const newSet = new Set(prev);
                    snapshot.docs.forEach(doc => {
                         const chatId = doc.id;
                         const lastMessageTimestamp = doc.data().lastMessageTimestamp as Timestamp | undefined;
                         const userLastReadTimestamp = currentUser?.cid ? doc.data().lastRead?.[currentUser.cid] as Timestamp | undefined : undefined;
                         let isUnread = false;
                         // If user has never read (no timestamp) or last message is newer
                         if (lastMessageTimestamp && (!userLastReadTimestamp || lastMessageTimestamp.toMillis() > userLastReadTimestamp.toMillis()) && chatId !== currentChatIdRef.current) {
                             isUnread = true;
                         }
                         if (isUnread && newSet.has(chatId)) {
                             newSet.delete(chatId);
                         }
                    });
                    return newSet;
                });
            }

        }, (err) => {
            console.error("Error fetching all user chats:", err);
            setError("Failed to load chats.");
            toast.error("Failed to load chats.");
            setLoadingChats(false);
            setAllUserChats([]);
            setUnreadChats(new Set());
        });

        return () => unsubscribe();
    }, [currentUser?.cid]); // Ensure only currentUser.cid is the dependency

    //
    const getChatDocRef = useCallback((chatId: string | null) => {
        if (!chatId) return null;
        return doc(dbFirestore, 'chats', chatId);
    }, []);

    // --- Update Last Read Timestamp ---
    const updateLastReadTimestamp = useCallback(async (chatId: string) => {
        if (!currentUser?.cid || !chatId) return; // Check for CID
        const chatDocRef = getChatDocRef(chatId);
        if (!chatDocRef) return;

        try {
            // Use dot notation with CID for updating the map field
            await updateDoc(chatDocRef, {
                [`lastRead.${currentUser.cid}`]: serverTimestamp()
            });
            console.log(`Updated lastRead for ${currentUser.cid} in chat ${chatId}`);
        } catch (err) {
            // Check if the error is because the document or field doesn't exist
            if (err instanceof Error && (err.message.includes("No document to update") || err.message.includes("not found"))) {
                // Document might not exist yet (e.g., first message in a 1-on-1)
                // Or the lastRead map might not exist. Try set with merge: true?
                // For simplicity now, we'll just log it. A more robust solution
                // might create the doc/field here if needed.
                console.warn(`Chat doc ${chatId} might not exist yet for updating lastRead.`);
            } else {
                console.error(`Error updating lastRead timestamp for chat ${chatId}:`, err);
                // Optionally notify user
                // toast.error("Failed to mark chat as read.");
            }
        }
    }, [currentUser?.cid, getChatDocRef]); // Depend on CID


    useEffect(() => {
        onUnreadCountChange(unreadChats.size);
    }, [unreadChats, onUnreadCountChange]);


    // --- Typing Indicator Logic ---

    // Function to signal that the current user IS typing
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
            // Handle potential errors (e.g., doc doesn't exist yet - might need creation)
        }
    }, [currentUser?.cid, getChatDocRef]); // Depend on CID

    // Function to signal that the current user has STOPPED typing
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
    }, [currentUser?.cid, getChatDocRef]); // Depend on CID

    // Effect to handle user input changes for typing indicator
    useEffect(() => {
        if (!selectedChat || !currentUser?.cid) return; // Check for CID

        if (newMessage.trim()) {
            // User is typing
            signalTyping(); // Update Firestore immediately

            // Clear existing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Set a new timeout to signal stopped typing
            typingTimeoutRef.current = setTimeout(() => {
                signalStoppedTyping();
            }, TYPING_TIMEOUT_MS);

        } else {
            // Input is empty, ensure stopped typing signal is sent if timeout hasn't fired
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
                signalStoppedTyping(); // Signal stopped immediately if input cleared
            }
        }

        // Cleanup on component unmount or newMessage change
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            // Don't signal stopped typing here on every keystroke cleanup, only on unmount/chat change
        };
    }, [newMessage, selectedChat, currentUser?.cid, signalTyping, signalStoppedTyping]); // Depend on CID


    // Fetch Messages and Listen for Typing Indicators
    useEffect(() => {
        // Reset messages and typing indicators if no chat is selected or user is missing
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
            chatId = selectedChat.id;
        } else {
            // It's a direct chat (User)
            // Ensure both CIDs are defined before generating the ID
            if (currentUser.cid && selectedChat.cid !== undefined) {
                chatId = getDirectChatId(currentUser.cid, selectedChat.cid);
            } else {
                // Handle the case where a CID is missing (should be rare after filtering/selection logic)
                console.error("Cannot fetch messages: Missing CID for direct chat.", { currentUserCid: currentUser.cid, selectedChatCid: selectedChat.cid });
                setError("Could not determine chat ID due to missing user identifier.");
                setLoadingMessages(false);
                currentChatIdRef.current = null;
                return; // Stop execution if CIDs are missing
            }
        }

        currentChatIdRef.current = chatId; // Store current chat ID

        // This check should now only fail if getDirectChatId returned empty string, which it shouldn't if inputs are valid
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
                    // Filter out the current user's CID and update state
                    setTypingIndicatorUsers(typingCids.filter(cid => cid !== currentUser.cid)); // Filter by CID
                } else {
                    // Document might not exist yet for direct chats
                    setTypingIndicatorUsers([]);
                }
            }, (err) => {
                console.error("Error listening to chat document:", err);
                setTypingIndicatorUsers([]);
            });
        }

        // Cleanup function
        return () => {
            // Signal stopped typing for the current user (CID) in this chat
            if (currentChatIdRef.current && currentUser?.cid) { // Check for CID
                 const cleanupChatRef = getChatDocRef(currentChatIdRef.current);
                 if (cleanupChatRef) {
                     updateDoc(cleanupChatRef, {
                         typingUsers: arrayRemove(currentUser.cid) // Remove CID
                     }).catch(err => console.error("Error cleaning up typing status:", err));
                 }
            }
            // Clear timeout ref on cleanup
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        };
    }, [currentUser?.cid, selectedChat, getChatDocRef]);

    // Scroll to bottom when selectedChat changes and messages load initially
    useEffect(() => {
        // Only scroll if messages are loaded and a chat is selected
        if (!loadingMessages && selectedChat && messageContainerRef.current) {
             messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
        }
    }, [loadingMessages, selectedChat, messages]);


    // Simplify handleSendMessage - remove imageUrl parameter and logic
    const handleSendMessage = async () => {
        // Only send if there's non-empty text
        if (!newMessage.trim() || !currentUser?.cid || !selectedChat) return;

        const trimmedMessage = newMessage.trim();
        // Basic check for image URLs (adjust regex as needed for more robustness)
        const isImageUrl = /\.(jpg|jpeg|png|gif|webp)$/i.test(trimmedMessage) && /^https?:\/\//i.test(trimmedMessage);

        let chatId = '';
        let isGroupChat = false;
        let members: string[] = [];

        // Prepare base message data - conditionally set text or imageUrl
        let messageData: Omit<Message, 'id' | 'timestamp'> & { timestamp: any } = {
             senderId: currentUser.cid,
             timestamp: serverTimestamp(),
             senderName: formatUserName(currentUser),
             // Conditionally set text or imageUrl
             ...(isImageUrl ? { imageUrl: trimmedMessage } : { text: trimmedMessage }),
        };


        if ('groupName' in selectedChat) {
            chatId = selectedChat.id;
            isGroupChat = true;
            members = selectedChat.members;
        } else if (selectedChat.cid) {
            chatId = getDirectChatId(currentUser.cid, selectedChat.cid);
            messageData.receiverId = selectedChat.cid;
            members = [currentUser.cid, selectedChat.cid];
        }

         if (!chatId) {
             toast.error("Could not determine chat ID to send message.");
             return;
         }

        // --- Unhide on Send Logic ---
        if (hiddenChatIds.has(chatId)) {
            console.log(`Sending message to hidden chat ${chatId}, unhiding.`);
            setHiddenChatIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(chatId);
                return newSet;
            });
        }
        // --- End Unhide on Send ---


        const messagesRef = collection(dbFirestore, 'chats', chatId, 'messages');
        const chatDocRef = getChatDocRef(chatId);

        try {
            // Clear timeout and signal stopped typing *before* sending message
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
                await signalStoppedTyping(); // Ensure typing indicator is removed
            }

            // Add the message
            const messageDocRef = await addDoc(messagesRef, messageData);
            console.log("Message sent with ID:", messageDocRef.id);

            // Update or Create the main chat document metadata
            if (chatDocRef) {
                const chatDocSnap = await getDoc(chatDocRef);
                const now = serverTimestamp();
                // Determine the preview text based on message type
                const lastMessagePreview = isImageUrl ? "[Image]" : (messageData.text?.substring(0, 50) || '');

                const updateData: { [key: string]: any } = {
                    lastMessageTimestamp: now,
                    [`lastRead.${currentUser.cid}`]: now, // Update sender's (CID) last read time
                    // Update last message preview text
                    lastMessageText: lastMessagePreview // Use the determined preview
                };

                if (chatDocSnap.exists()) {
                    // Chat document exists, just update it
                    await updateDoc(chatDocRef, updateData);
                    console.log("Chat metadata updated for existing chat:", chatId);
                } else if (!isGroupChat) {
                    // Chat document DOES NOT exist and it's a DIRECT chat, create it
                    const initialChatData = {
                        members: members, // CIDs
                        type: 'direct', // Explicitly set type for direct chats
                        createdAt: now, // Set creation timestamp
                        lastMessageTimestamp: now,
                        lastRead: {
                            [currentUser.cid]: now // Initialize sender's (CID) last read
                        },
                        typingUsers: [], // Initialize typing users (CIDs) array
                        // Add last message preview text here too
                        lastMessageText: lastMessagePreview // Use the determined preview
                    };
                    await setDoc(chatDocRef, initialChatData);
                    console.log("Chat document created for new direct chat:", chatId);
                } else {
                    // Chat doc doesn't exist, but it's a group chat - this shouldn't happen if groups are created properly
                    console.error(`Group chat document ${chatId} not found. Cannot update metadata.`);
                    toast.error("Error updating group chat information.");
                }
            }

            // Clear the text input
            setNewMessage('');

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

        // Include the current user's CID in the members list
        const allMemberCids = Array.from(new Set([currentUser.cid, ...selectedMemberCids])); // Use CIDs
        const now = serverTimestamp(); // Use server timestamp

        // Initialize lastRead map with the creator's CID
        const initialLastRead: { [cid: string]: any } = {};
        initialLastRead[currentUser.cid] = now; // Use CID

        const groupData: Omit<ChatGroup, 'id'> = {
            groupName: name.trim(),
            type: 'group',
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
                ...groupData,
                id: docRef.id,
                createdAt: Timestamp.now(),
                lastMessageTimestamp: Timestamp.now(),
                lastRead: { [currentUser.cid]: Timestamp.now() } // Use CID
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
                chatIdToMarkRead = getDirectChatId(currentUser.cid, targetCid);
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

    }, [currentUser?.cid, getChatDocRef, updateLastReadTimestamp]);


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
    }, [ciuPersonnel, handleChatSelect]); // Removed handleCloseCreateGroupModal dependency as it's defined below


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

    // --- Modal Handlers (defined within component scope) ---
    const handleCloseCreateGroupModal = () => {
        setIsCreateGroupModalOpen(false);
    };

    const handleOpenCreateGroupModal = () => {
        setIsCreateGroupModalOpen(true);
    };

    // --- Close Chat Handler ---
    const handleCloseChat = useCallback(() => {
        // Signal stopped typing for the current chat (using CID) before closing
        if (currentChatIdRef.current && currentUser?.cid) {
            signalStoppedTyping(); // This function now uses CID internally
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
        currentChatIdRef.current = null; // Clear chat ID ref
        setError(null); // Clear any chat-specific errors

    }, [currentUser?.cid, signalStoppedTyping]); // Depend on CID

    // --- Hide Chat Handler ---
    const handleHideChat = useCallback((chatId: string) => {
        setHiddenChatIds(prev => new Set(prev).add(chatId));
        // If the chat being hidden is the currently selected one, close it
        const currentSelectedId = selectedChat ? ('groupName' in selectedChat ? selectedChat.id : (selectedChat.cid && currentUser?.cid ? getDirectChatId(currentUser.cid, selectedChat.cid) : null)) : null;
        if (currentSelectedId === chatId) {
            handleCloseChat(); // Use the existing close chat logic
        }
        toast.info("Chat hidden for this session.");
    }, [selectedChat, currentUser?.cid, handleCloseChat]); // Depend on CID


    // --- Derive Sorted Chat Lists for Sidebar ---
    const sortedDisplayChats = useMemo((): DisplayChat[] => {
        if (!currentUser?.cid || !allUserChats || !ciuPersonnel) return [];

        // Use reduce to build the array directly, avoiding nulls
        const processedChats: DisplayChat[] = allUserChats.reduce((acc: DisplayChat[], chatData) => {
            const chatId = chatData.id;
            const lastMsgTimestamp = chatData.lastMessageTimestamp instanceof Timestamp
                ? chatData.lastMessageTimestamp
                : null;
            // Safely handle createdAt timestamp
            const createdAtTimestamp = chatData.createdAt instanceof Timestamp
                ? chatData.createdAt
                : null;
            // Use effective timestamp for sorting, preferring last message time
            const effectiveTimestamp = lastMsgTimestamp || createdAtTimestamp; // Type: Timestamp | null

            if (chatData.type === 'group') {
                const group: ChatGroup = {
                    id: chatId,
                    groupName: chatData.groupName || 'Unknown Group',
                    type: 'group',
                    members: chatData.members || [],
                    createdBy: chatData.createdBy || '',
                    // Ensure createdAt is a Timestamp or fallback safely if needed, though Firestore usually provides it
                    createdAt: createdAtTimestamp || Timestamp.now(), // Fallback to now if createdAt is missing/invalid
                    lastMessageTimestamp: effectiveTimestamp || undefined, // Use the derived effective timestamp or undefined
                    typingUsers: chatData.typingUsers || [],
                    lastRead: chatData.lastRead || {},
                };
                acc.push({
                    id: chatId,
                    type: 'group',
                    target: group,
                    lastMessageTimestamp: effectiveTimestamp, // Use effective timestamp
                    isUnread: unreadChats.has(chatId),
                });
            } else if (chatData.type === 'direct' || !chatData.type) { // Treat missing type as direct
                const members = chatData.members as string[] || [];
                const otherMemberCid = members.find(cid => cid !== currentUser.cid);
                if (otherMemberCid) {
                    const user = ciuPersonnel.find(p => p.cid === otherMemberCid);
                    if (user) {
                        acc.push({
                            id: chatId,
                            type: 'direct',
                            target: user,
                            lastMessageTimestamp: effectiveTimestamp, // Use effective timestamp
                            isUnread: unreadChats.has(chatId),
                        });
                    } else {
                         console.warn(`Direct chat ${chatId}: Could not find user data for CID ${otherMemberCid}`);
                    }
                } else {
                     console.warn(`Direct chat ${chatId}: Could not determine other member CID.`);
                }
            } else {
                 console.warn(`Chat ${chatId}: Unknown or invalid type "${chatData.type}"`);
            }

            return acc; // Return accumulator for the next iteration
        }, []); // Start with an empty DisplayChat[] array

        // Sort by lastMessageTimestamp descending (most recent first)
        processedChats.sort((a, b) => {
            const timeA = a.lastMessageTimestamp?.toMillis() ?? 0;
            const timeB = b.lastMessageTimestamp?.toMillis() ?? 0;
            return timeB - timeA; // Descending order
        });

        return processedChats;

    }, [allUserChats, ciuPersonnel, currentUser?.cid, unreadChats]);


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
                className="w-1/4 border-r p-2 flex flex-col"
                style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-background)', // Or potentially --color-card if desired
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

                {isLoading ? (
                    <p className="px-2" style={{ color: 'var(--color-muted-foreground)' }}>Loading chats...</p>
                ) : error ? (
                     <p className="px-2" style={{ color: 'var(--color-destructive)' }}>{error}</p>
                ) : sortedDisplayChats.length === 0 ? (
                     <p className="px-2" style={{ color: 'var(--color-muted-foreground)' }}>No chats available.</p>
                ): (
                    <ScrollArea className="h-full custom-scrollbar">
                        {/* Render Groups */}
                        {sortedDisplayChats.some(c => c.type === 'group' && !hiddenChatIds.has(c.id)) && (
                            <div className="mb-3">
                                <h4 className="text-xs font-semibold uppercase px-2 mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Groups</h4>
                                {sortedDisplayChats
                                    .filter(chat => chat.type === 'group' && !hiddenChatIds.has(chat.id))
                                    .map(displayChat => {
                                        const group = displayChat.target as ChatGroup;
                                        const isUnread = displayChat.isUnread;
                                        const isSelected = selectedChatId === group.id;
                                        return (
                                            <div
                                                key={group.id}
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
                                                    onClick={(e) => { e.stopPropagation(); handleHideChat(group.id); }}
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
                         {sortedDisplayChats.some(c => c.type === 'direct' && !hiddenChatIds.has(c.id)) && (
                            <div>
                                <h4 className="text-xs font-semibold uppercase px-2 mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Direct Messages</h4>
                                {sortedDisplayChats
                                    .filter(chat => chat.type === 'direct' && !hiddenChatIds.has(chat.id))
                                    .map(displayChat => {
                                        const user = displayChat.target as User;
                                        const directChatId = displayChat.id;
                                        const isUnread = displayChat.isUnread;
                                        const isSelected = selectedChatId === user.cid;
                                        return (
                                            <div
                                                key={user.id}
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
                                                    onClick={(e) => { e.stopPropagation(); handleHideChat(directChatId); }}
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" // Keep hover/group-hover
                                                    title="Hide Chat"
                                                    disabled={!directChatId} // Disable if ID couldn't be generated
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
                className="w-3/4 flex flex-col"
                style={{ backgroundColor: 'var(--color-background)' }} // Keep background
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
                                    // Find member details in the personnel list by CID
                                    .map((cid: string): User | undefined => ciuPersonnel.find((p: User) => p.cid === cid)) // Find by CID
                                    // Filter out members not found or the current user (by CID)
                                    .filter((member: User | undefined): member is User => !!member && member.cid !== currentUser?.cid) // Check CID
                                    // Limit the number of avatars shown (e.g., first 4)
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
                                                {timestamp && (
                                                    <ChatBubbleTimestamp
                                                        timestamp={timestamp}
                                                        className="text-xs mt-1 opacity-70"
                                                        style={{ color: isSent ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)', opacity: 0.8 }}
                                                    />
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
                                        {/* ... avatar logic ... */}
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
                            className="border-t p-3 relative"
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
                                    disabled={!selectedChat}
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
                onClose={handleCloseCreateGroupModal} // Use the correct handler
                onCreateGroup={handleCreateGroup}
                onStartDirectChat={handleStartDirectChatFromModal}
                personnel={ciuPersonnel}
                currentUserCid={currentUser?.cid}
            />
        </div>
    );
};

