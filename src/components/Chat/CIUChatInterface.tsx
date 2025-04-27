import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    collection, // Firestore
    query, // Firestore
    where, // Firestore
    orderBy, // Firestore
    onSnapshot, // Firestore (real-time listener)
    addDoc, // Firestore (write)
    serverTimestamp, // Firestore (write)
    getDocs, // Firestore (read)
    limit, // Firestore
    doc, // Firestore
    getDoc, // Firestore (read)
    updateDoc, // Firestore (write)
    arrayUnion, // Firestore (write)
    arrayRemove, // Firestore (write)
    Timestamp, // Firestore
    QuerySnapshot, // Firestore
    DocumentData, // Firestore
} from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase'; // Firestore database instance
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types/User';
import { ChatGroup } from '../../types/ChatGroup';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ChatMessageList } from '../ui/chat/chat-message-list';
import { ChatBubble, ChatBubbleAvatar, ChatBubbleMessage, ChatBubbleTimestamp } from '../ui/chat/chat-bubble';
import { ChatInput } from '../ui/chat/chat-input';
import { toast } from 'react-toastify';
import { hasCIUPermission } from '../../utils/ciuUtils';
import { cn } from '../../lib/utils';
import { FaUsers, FaUser, FaPlus, FaSmile } from 'react-icons/fa'; // Add FaSmile
import CreateGroupModal from './CreateGroupModal';
import { formatUserName, getAvatarFallback } from './utils';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react'; // Import picker

interface Message {
    id: string;
    senderId: string; // Sender's email
    receiverId?: string; // Receiver's email (for 1-on-1) or Group ID (optional)
    text: string;
    timestamp: Timestamp | null;
    senderName?: string;
}

const TYPING_TIMEOUT_MS = 2000; // 2 seconds

export const CIUChatInterface: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [ciuPersonnel, setCiuPersonnel] = useState<User[]>([]);
    const [chatGroups, setChatGroups] = useState<ChatGroup[]>([]);
    const [selectedChat, setSelectedChat] = useState<User | ChatGroup | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false); // State for emoji picker visibility
    const messageContainerRef = useRef<HTMLDivElement>(null);
    const [typingIndicatorUsers, setTypingIndicatorUsers] = useState<string[]>([]); // State for typing users' emails
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for debounce timer
    const currentChatIdRef = useRef<string | null>(null); // Ref to store current chat ID for cleanup

    // Function to scroll to the bottom of the message list container
    const scrollToBottom = () => {
        if (messageContainerRef.current) {
            // Use 'auto' behavior for immediate scroll after receiving/sending messages
            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
        }
    };

    // Fetch CIU Personnel (Direct Chats)
    useEffect(() => {
        // Use email for the check now
        if (!currentUser?.email) {
             console.log("CIUChat: Current user or email not available yet.");
             setLoadingUsers(false);
             setCiuPersonnel([]);
             return;
        }
        console.log("CIUChat: Current User Email:", currentUser.email);

        setLoadingUsers(true);
        const fetchPersonnel = async () => {
            try {
                const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
                console.log(`CIUChat: Fetched ${usersSnapshot.docs.length} total user documents.`);

                const usersData = usersSnapshot.docs
                    .map(doc => {
                        const data = doc.data();
                        console.log(`CIUChat: Processing doc ID: ${doc.id}, Data:`, data);
                        // Ensure email is present for filtering and selection
                        return { id: doc.id, email: data.email, ...data } as User;
                    })
                    .filter(u => {
                        const isCurrentUser = u.email === currentUser.email;
                        const hasPermission = hasCIUPermission(u);
                        // Ensure user has an email to be included
                        if (!u.email) {
                            console.warn(`CIUChat: User doc ${u.id} missing email, excluding.`);
                            return false;
                        }
                        console.log(`CIUChat: Filtering user ${u.id} (Email: ${u.email}). Is current user? ${isCurrentUser}. Has CIU permission? ${hasPermission}. Keep? ${!isCurrentUser && hasPermission}`);
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
    }, [currentUser?.email]);

    // Fetch Chat Groups
    useEffect(() => {
        if (!currentUser?.email) {
            setLoadingGroups(false);
            setChatGroups([]);
            return;
        }
        setLoadingGroups(true);
        const groupsQuery = query(
            collection(dbFirestore, 'chats'),
            where('type', '==', 'group'), // Ensure it's a group chat
            where('members', 'array-contains', currentUser.email) // Ensure current user is a member
            // orderBy('lastMessageTimestamp', 'desc') // Optional: Order by recent activity
        );

        const unsubscribe = onSnapshot(groupsQuery, (snapshot: QuerySnapshot<DocumentData>) => {
            const groupsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ChatGroup));
            // Sort groups, e.g., by name or last message time
            groupsData.sort((a, b) => a.groupName.localeCompare(b.groupName));
            setChatGroups(groupsData);
            setLoadingGroups(false);
        }, (err) => {
            console.error("Error fetching chat groups:", err);
            setError("Failed to load groups."); // Consider more specific error handling
            toast.error("Failed to load chat groups.");
            setLoadingGroups(false);
        });

        return () => unsubscribe();
    }, [currentUser?.email]);


    // Generate a consistent chat ID for 1-on-1 chats (using Emails)
    const getDirectChatId = (email1: string, email2: string): string => {
        if (!email1 || !email2) {
            console.error("Cannot generate direct chat ID with invalid emails:", email1, email2);
            return '';
        }
        const sanitize = (email: string) => email.replace(/[^a-zA-Z0-9]/g, '_');
        return [sanitize(email1), sanitize(email2)].sort().join('-');
    };

    // --- Typing Indicator Logic ---

    const getChatDocRef = useCallback((chatId: string | null) => {
        if (!chatId) return null;
        return doc(dbFirestore, 'chats', chatId);
    }, []);

    // Function to signal that the current user IS typing
    const signalTyping = useCallback(async () => {
        const chatId = currentChatIdRef.current;
        const userEmail = currentUser?.email;
        if (!chatId || !userEmail) return;

        const chatDocRef = getChatDocRef(chatId);
        if (!chatDocRef) return;

        try {
            // Check if doc exists before updating? Maybe not necessary for arrayUnion
            await updateDoc(chatDocRef, {
                typingUsers: arrayUnion(userEmail)
            });
        } catch (err) {
            console.error("Error signaling typing:", err);
            // Handle potential errors (e.g., doc doesn't exist yet - might need creation)
        }
    }, [currentUser?.email, getChatDocRef]);

    // Function to signal that the current user has STOPPED typing
    const signalStoppedTyping = useCallback(async () => {
        const chatId = currentChatIdRef.current;
        const userEmail = currentUser?.email;
        if (!chatId || !userEmail) return;

        const chatDocRef = getChatDocRef(chatId);
        if (!chatDocRef) return;

        try {
            await updateDoc(chatDocRef, {
                typingUsers: arrayRemove(userEmail)
            });
        } catch (err) {
            console.error("Error signaling stopped typing:", err);
        }
    }, [currentUser?.email, getChatDocRef]);

    // Effect to handle user input changes for typing indicator
    useEffect(() => {
        if (!selectedChat || !currentUser?.email) return; // Only run if a chat is selected and user exists

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
    }, [newMessage, selectedChat, currentUser?.email, signalTyping, signalStoppedTyping]);


    // Fetch Messages and Listen for Typing Indicators
    useEffect(() => {
        // Reset messages and typing indicators if no chat is selected or user is missing
        if (!currentUser?.email || !selectedChat) {
            setMessages([]);
            setTypingIndicatorUsers([]);
            currentChatIdRef.current = null; // Clear current chat ID ref
            return;
        }

        setLoadingMessages(true);
        let chatId = '';
        if ('groupName' in selectedChat) {
            chatId = selectedChat.id;
        } else if (selectedChat.email) {
            chatId = getDirectChatId(currentUser.email, selectedChat.email);
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
                     senderId: data.senderId, // Sender's email
                     receiverId: data.receiverId,
                     text: data.text,
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
                    const typingEmails = (data?.typingUsers || []) as string[];
                    // Filter out the current user and update state
                    setTypingIndicatorUsers(typingEmails.filter(email => email !== currentUser.email));
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
            unsubscribeMessages();
            if (unsubscribeChatDoc) {
                unsubscribeChatDoc();
            }
            // Signal stopped typing for the current user in this chat when switching or unmounting
            if (currentChatIdRef.current && currentUser?.email) {
                 const cleanupChatRef = getChatDocRef(currentChatIdRef.current);
                 if (cleanupChatRef) {
                     updateDoc(cleanupChatRef, {
                         typingUsers: arrayRemove(currentUser.email)
                     }).catch(err => console.error("Error cleaning up typing status:", err));
                 }
            }
            // Clear timeout ref on cleanup
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        };
    }, [currentUser?.email, selectedChat, getChatDocRef]); // Add getChatDocRef dependency


    // Scroll to bottom when selectedChat changes and messages load initially
    useEffect(() => {
        // Only scroll if messages are loaded and a chat is selected
        if (!loadingMessages && selectedChat && messageContainerRef.current) {
             messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
        }
    }, [loadingMessages, selectedChat, messages]);


    const handleSendMessage = async () => {
        if (!newMessage.trim() || !currentUser?.email || !selectedChat) return;

        let chatId = '';
        let messageData: Omit<Message, 'id' | 'timestamp'> & { timestamp: any } = { // Use serverTimestamp type
             senderId: currentUser.email,
             text: newMessage.trim(),
             timestamp: serverTimestamp(),
             senderName: formatUserName(currentUser),
        };

        if ('groupName' in selectedChat) { // Sending to a group
            chatId = selectedChat.id;
            // receiverId is omitted for group messages
        } else if (selectedChat.email) { // Sending to a user (1-on-1)
            chatId = getDirectChatId(currentUser.email, selectedChat.email);
            messageData.receiverId = selectedChat.email; // Set receiverId for direct messages
        }

         if (!chatId) {
             toast.error("Could not determine chat ID to send message.");
             return;
         }

        const messagesRef = collection(dbFirestore, 'chats', chatId, 'messages');

        try {
            // Clear timeout and signal stopped typing *before* sending message
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
            await signalStoppedTyping(); // Ensure typing indicator is removed

            // Add the message to the 'messages' subcollection of the chat
            await addDoc(messagesRef, messageData);

            // Update the last message timestamp on the main chat document (optional but good for sorting)
            const chatDocRef = getChatDocRef(chatId);
            if (chatDocRef) {
                await updateDoc(chatDocRef, {
                    lastMessageTimestamp: serverTimestamp(), // Update timestamp
                    // Optionally update last message text snippet
                    // lastMessageText: messageData.text.substring(0, 50) // Example snippet
                }).catch(err => console.warn("Could not update chat metadata:", err)); // Non-critical error
            }

            setNewMessage(''); // Clear the input field
            // No need to manually add message to state, Firestore listener will do it
            // setTimeout(scrollToBottom, 50); // Scroll after state updates from listener

        } catch (err) {
            console.error("Error sending message:", err);
            toast.error("Failed to send message.");
            // Don't re-throw here unless needed upstream
        }
    };


    // --- Group Creation Logic ---
    const handleCreateGroup = async (name: string, selectedMemberEmails: string[]) => {
        if (!currentUser?.email) {
            toast.error("Cannot create group without logged-in user.");
            return;
        }
        if (!name.trim()) {
            toast.warn("Group name cannot be empty.");
            return;
        }
        if (selectedMemberEmails.length === 0) {
            toast.warn("Please select at least one member for the group.");
            return;
        }

        // Include the current user in the members list
        const allMemberEmails = Array.from(new Set([currentUser.email, ...selectedMemberEmails]));

        const groupData: Omit<ChatGroup, 'id'> = {
            groupName: name.trim(),
            type: 'group',
            members: allMemberEmails, // Store member emails
            createdBy: currentUser.email,
            createdAt: serverTimestamp(),
            lastMessageTimestamp: serverTimestamp(), // Initialize timestamp
            typingUsers: [], // Initialize typing users
        };

        try {
            // Creating a new group document in the 'chats' collection
            const docRef = await addDoc(collection(dbFirestore, 'chats'), groupData);
            toast.success(`Group "${name}" created successfully.`);
            handleCloseCreateGroupModal(); // Close modal on success

            // Optionally, select the newly created group
            // Need to construct the group object to select it, approximating timestamps for immediate UI update
            const newGroup: ChatGroup = {
                // Spread the data sent to Firestore, but override timestamps for local state
                ...groupData,
                id: docRef.id,
                // Use client-side timestamps for immediate state update as serverTimestamp() is a sentinel
                createdAt: Timestamp.now(), // Use client-side timestamp for local state
                lastMessageTimestamp: Timestamp.now() // Use client-side timestamp for local state
            };
            setSelectedChat(newGroup); // Select the new group

        } catch (err) {
            console.error("Error creating group:", err);
            toast.error("Failed to create group.");
            throw err; // Re-throw error to signal failure to modal
        }
    };


    // Helper to get names of typing users
    const getTypingUserNames = () => {
        return typingIndicatorUsers
            .map(email => {
                const user = ciuPersonnel.find(p => p.email === email);
                return user ? formatUserName(user) : 'Someone';
            })
            .join(', ');
    };

    const isLoading = loadingUsers || loadingGroups; // Combined loading state

    // Determine selected chat identifier for comparison
    const selectedChatId = selectedChat ? ('groupName' in selectedChat ? selectedChat.id : selectedChat.email) : null;


    // --- Emoji Picker Handler ---
    const onEmojiClick = (emojiData: EmojiClickData, event: MouseEvent) => {
        setNewMessage(prevMessage => prevMessage + emojiData.emoji);
        // Optionally close picker after selection, or keep it open
        // setShowEmojiPicker(false);
    };

    // --- Modal and Chat Selection Handlers ---
    const handleCloseCreateGroupModal = () => {
        setIsCreateGroupModalOpen(false);
    };

    const handleOpenCreateGroupModal = () => {
        setIsCreateGroupModalOpen(true);
    };

    const handleChatSelect = useCallback((chatTarget: User | ChatGroup) => {
        // Clear previous typing indicator when switching chats
        if (currentChatIdRef.current && currentUser?.email) {
            const cleanupChatRef = getChatDocRef(currentChatIdRef.current);
            if (cleanupChatRef) {
                updateDoc(cleanupChatRef, {
                    typingUsers: arrayRemove(currentUser.email)
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
        // The useEffect hook for fetching messages will trigger automatically
    }, [currentUser?.email, getChatDocRef]); // Add dependencies

    return (
        // Adjust overall height, e.g., subtract less from 100vh
        <div className="flex h-[calc(100vh-180px)] border border-border rounded-lg bg-card text-card-foreground overflow-hidden">
            {/* User List Sidebar */}
            <div className="w-1/4 border-r border-border p-2 flex flex-col">
                {/* Sidebar Header with Create Group Button */}
                <div className="flex justify-between items-center mb-2 px-2">
                    <h3 className="text-lg font-semibold text-foreground">Chats</h3>
                    <Button variant="ghost" size="icon" onClick={handleOpenCreateGroupModal} title="Create Group Chat">
                        <FaPlus className="h-4 w-4" />
                    </Button>
                </div>

                {isLoading ? (
                    <p className="text-muted-foreground px-2">Loading chats...</p>
                ) : error ? (
                     <p className="text-destructive px-2">{error}</p>
                ) : ciuPersonnel.length === 0 && chatGroups.length === 0 ? (
                     <p className="text-muted-foreground px-2">No chats available.</p>
                ): (
                    <ScrollArea className="h-full">
                        {/* Render Groups */}
                        {chatGroups.length > 0 && (
                            <div className="mb-3">
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground px-2 mb-1">Groups</h4>
                                {chatGroups.map(group => (
                                    <div
                                        key={group.id}
                                        className={cn(
                                            "w-full flex items-center p-2 rounded cursor-pointer transition-colors duration-150 hover:bg-muted",
                                            selectedChatId === group.id ? "bg-muted font-semibold" : ""
                                        )}
                                        onClick={() => handleChatSelect(group)}
                                    >
                                        <Avatar className="h-8 w-8 mr-3 flex-shrink-0">
                                            <AvatarFallback><FaUsers /></AvatarFallback>
                                        </Avatar>
                                        <div className="flex-grow overflow-hidden">
                                            <span className="truncate font-medium text-sm text-foreground">{group.groupName}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Render Direct Messages (Personnel) */}
                         {ciuPersonnel.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground px-2 mb-1">Direct Messages</h4>
                                {ciuPersonnel.map(user => (
                                    <div
                                        key={user.id}
                                        className={cn(
                                            "w-full flex items-center p-2 rounded cursor-pointer transition-colors duration-150 hover:bg-muted",
                                            selectedChatId === user.email ? "bg-muted font-semibold" : ""
                                        )}
                                        onClick={() => handleChatSelect(user)}
                                    >
                                        <Avatar className="h-8 w-8 mr-3 flex-shrink-0">
                                            <AvatarImage src={user.photoURL || undefined} alt={formatUserName(user)} />
                                            <AvatarFallback>{getAvatarFallback(user)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-grow overflow-hidden">
                                            <span className="truncate font-medium text-sm text-foreground">{formatUserName(user)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                         )}
                    </ScrollArea>
                )}
            </div>

            {/* Chat Area */}
            <div className="w-3/4 flex flex-col bg-background">
                {selectedChat ? (
                    <>
                        {/* Chat Header */}
                        {/* Reduce padding slightly if needed, e.g., p-2 */}
                        <div className="border-b border-border p-3 flex items-center bg-card space-x-2">
                             {/* Main Avatar (Group or User) */}
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
                            {/* Chat Name */}
                            <h3 className="text-lg font-semibold text-foreground truncate">
                                {'groupName' in selectedChat ? selectedChat.groupName : formatUserName(selectedChat)}
                            </h3>
                            {/* Member Avatars for Groups */}
                            {'groupName' in selectedChat && (
                                <div className="flex items-center space-x-1 overflow-hidden ml-auto pl-2">
                                    {selectedChat.members
                                        // Find member details in the personnel list
                                        .map(email => ciuPersonnel.find(p => p.email === email))
                                        // Filter out members not found or the current user (optional)
                                        .filter(member => member && member.email !== currentUser?.email)
                                        // Limit the number of avatars shown (e.g., first 4)
                                        .slice(0, 4)
                                        .map(member => member && ( // Add null check for member
                                            <Avatar key={member.id} className="h-6 w-6 border-2 border-card" title={formatUserName(member)}>
                                                <AvatarImage src={member.photoURL || undefined} alt={formatUserName(member)} />
                                                <AvatarFallback className="text-xs">{getAvatarFallback(member || null)}</AvatarFallback>
                                            </Avatar>
                                        ))
                                    }
                                    {/* Optional: Show "+X more" if members exceed the limit */}
                                    {selectedChat.members.filter(email => ciuPersonnel.find(p => p.email === email && p.email !== currentUser?.email)).length > 4 && (
                                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs border-2 border-card">
                                            +{selectedChat.members.filter(email => ciuPersonnel.find(p => p.email === email && p.email !== currentUser?.email)).length - 4}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Scrollable Message Container */}
                        {/* Reduce padding slightly if needed, e.g., p-3 */}
                        <div ref={messageContainerRef} className="flex-grow p-4 overflow-y-auto space-y-3 relative"> {/* Add relative positioning if needed for picker */}
                            <ChatMessageList className="space-y-3">
                                {messages.map(msg => {
                                    const isSent = msg.senderId === currentUser?.email;
                                    const senderUser = isSent
                                        ? currentUser
                                        : ciuPersonnel.find(p => p.email === msg.senderId) || null;
                                    const timestamp = msg.timestamp?.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) ?? '';
                                    const senderName = msg.senderName || formatUserName(senderUser);
                                    const senderAvatarSrc = senderUser?.photoURL || undefined;
                                    const senderAvatarFallback = getAvatarFallback(senderUser);
                                    const showSenderName = !isSent && 'groupName' in selectedChat;

                                    return (
                                        <ChatBubble
                                            key={msg.id}
                                            variant={isSent ? 'sent' : 'received'}
                                            className={cn(
                                                "px-3 py-2 rounded-lg shadow-sm max-w-[75%]",
                                                isSent
                                                    ? 'bg-primary text-primary-foreground self-end'
                                                    : 'bg-muted text-muted-foreground self-start'
                                            )}
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
                                                    <p className="text-xs text-muted-foreground/80 mb-0.5 font-medium">{senderName}</p>
                                                )}
                                                <ChatBubbleMessage className={cn(
                                                    "text-sm leading-snug",
                                                    isSent ? 'text-primary-foreground' : 'text-foreground'
                                                )}>
                                                    {msg.text}
                                                </ChatBubbleMessage>
                                                {timestamp && (
                                                    <ChatBubbleTimestamp
                                                        timestamp={timestamp}
                                                        className={cn(
                                                            "text-xs mt-1 opacity-70",
                                                            isSent ? "text-primary-foreground/80" : "text-muted-foreground/80"
                                                        )}
                                                    />
                                                )}
                                            </div>
                                        </ChatBubble>
                                    );
                                })}

                                {/* Loading Indicator */}
                                {loadingMessages && (
                                    <ChatBubble variant="received" className="self-start bg-muted px-3 py-2 rounded-lg shadow-sm">
                                         <ChatBubbleAvatar fallback="?" className="h-6 w-6 mr-2" />
                                         <ChatBubbleMessage isLoading={true} className="text-sm text-foreground">&nbsp;</ChatBubbleMessage>
                                    </ChatBubble>
                                )}

                                {/* Typing Indicator */}
                                {typingIndicatorUsers.length > 0 && (
                                    <ChatBubble variant="received" className="self-start bg-muted px-3 py-2 rounded-lg shadow-sm max-w-[75%]">
                                        {/* Find avatar for the first typing user */}
                                        {(() => {
                                            const firstTyper = ciuPersonnel.find(p => p.email === typingIndicatorUsers[0]);
                                            return (
                                                <ChatBubbleAvatar
                                                    src={firstTyper?.photoURL || undefined}
                                                    fallback={getAvatarFallback(firstTyper || null)}
                                                    className="h-6 w-6 mr-2"
                                                />
                                            );
                                        })()}
                                        <div className="flex flex-col">
                                             <p className="text-xs text-muted-foreground/80 mb-0.5 font-medium">
                                                {getTypingUserNames()} {typingIndicatorUsers.length === 1 ? 'is' : 'are'} typing...
                                             </p>
                                             {/* Optional: Add animated dots */}
                                             <div className="flex space-x-1 items-center h-4">
                                                <span className="h-1.5 w-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                <span className="h-1.5 w-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                <span className="h-1.5 w-1.5 bg-muted-foreground/60 rounded-full animate-bounce"></span>
                                             </div>
                                        </div>
                                    </ChatBubble>
                                )}
                            </ChatMessageList>
                        </div>

                        {/* Message Input Area */}
                        {/* Reduce padding slightly if needed, e.g., p-2 */}
                        <div className="border-t border-border p-3 bg-card relative"> {/* Add relative positioning */}
                            {/* Emoji Picker Popover */}
                            {showEmojiPicker && (
                                <div className="absolute bottom-full right-2 mb-2 z-10"> {/* Position picker above input */}
                                    <EmojiPicker
                                        onEmojiClick={onEmojiClick}
                                        // Optional: Add theme, size, etc.
                                        // theme={Theme.DARK} // Example if using themes
                                        // height={350}
                                        // width="100%"
                                    />
                                </div>
                            )}
                            <div className="flex items-center space-x-2">
                                {/* Add Emoji Button Here */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    title="Toggle Emoji Picker"
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <FaSmile className="h-5 w-5" />
                                </Button>
                                <ChatInput
                                    value={newMessage}
                                    onChange={(e) => {
                                        setNewMessage(e.target.value);
                                        // Close emoji picker when user starts typing manually
                                        if (showEmojiPicker) {
                                            setShowEmojiPicker(false);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    placeholder={`Message ${'groupName' in selectedChat ? selectedChat.groupName : formatUserName(selectedChat)}...`}
                                    className="rounded-md flex-grow" // Make input grow
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-grow flex items-center justify-center">
                        <p className="text-muted-foreground">Select a chat to start messaging</p>
                    </div>
                )}
            </div>

            {/* Create Group Modal */}
            <CreateGroupModal
                isOpen={isCreateGroupModalOpen}
                onClose={handleCloseCreateGroupModal}
                onCreateGroup={handleCreateGroup}
                personnel={ciuPersonnel}
                currentUserEmail={currentUser?.email} // Pass the current user's email
            />
        </div>
    );
};

