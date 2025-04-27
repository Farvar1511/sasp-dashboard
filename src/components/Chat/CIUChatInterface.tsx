import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    Timestamp,
    QuerySnapshot,
    DocumentData,
} from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
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
import { FaUsers, FaUser, FaPlus } from 'react-icons/fa';
import CreateGroupModal from './CreateGroupModal'; // Import the new modal
import { formatUserName, getAvatarFallback } from './utils'; // Import utils

interface Message {
    id: string;
    senderId: string; // Sender's email
    receiverId?: string; // Receiver's email (for 1-on-1) or Group ID (optional)
    text: string;
    timestamp: Timestamp | null;
    senderName?: string;
}

const CIUChatInterface: React.FC = () => {
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
    const messageContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable message container

    // Function to scroll to the bottom of the message list container
    const scrollToBottom = () => {
        if (messageContainerRef.current) {
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

    // Fetch Messages when selectedChat changes
    useEffect(() => {
        // Reset messages if no chat is selected or user is missing
        if (!currentUser?.email || !selectedChat) {
            setMessages([]);
            return;
        }

        setLoadingMessages(true);
        let chatId = '';
        if ('groupName' in selectedChat) { // Check if it's a ChatGroup
            chatId = selectedChat.id; // Use group document ID
        } else if (selectedChat.email) { // Check if it's a User
            chatId = getDirectChatId(currentUser.email, selectedChat.email);
        }

        if (!chatId) {
             setLoadingMessages(false);
             setError("Could not determine chat ID.");
             toast.error("Could not load messages for the selected chat.");
             return;
        }

        const messagesRef = collection(dbFirestore, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

        const unsubscribe = onSnapshot(q, (snapshot) => {
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
             // Scroll to bottom after messages are updated
             // Use setTimeout to ensure DOM update before scrolling
             setTimeout(scrollToBottom, 50); // Small delay might help
        }, (err) => {
            console.error("Error fetching messages:", err);
            setError("Failed to load messages.");
            const chatName = 'groupName' in selectedChat ? selectedChat.groupName : formatUserName(selectedChat);
            toast.error(`Failed to load messages for ${chatName}.`);
            setLoadingMessages(false);
        });

        return () => unsubscribe();
    }, [currentUser?.email, selectedChat]);


    // Scroll to bottom when selectedChat changes and messages load initially
    useEffect(() => {
        // Only scroll if messages are loaded and a chat is selected
        if (!loadingMessages && selectedChat && messageContainerRef.current) {
             // Scroll immediately on chat change/initial load
             messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
             // Optionally add a small delay if needed for complex rendering
             // setTimeout(scrollToBottom, 100);
        }
    }, [loadingMessages, selectedChat, messages]); // Add messages dependency


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
            await addDoc(messagesRef, messageData);
            setNewMessage('');
            // Scroll to bottom after sending a message
            // Use setTimeout to ensure the new message is rendered before scrolling
            setTimeout(scrollToBottom, 50);
            // TODO: Optionally update group's lastMessageTimestamp in the 'chats/{chatId}' doc
        } catch (err) {
            console.error("Error sending message:", err);
            toast.error("Failed to send message.");
        }
    };

    const handleChatSelect = (chatItem: User | ChatGroup) => {
        // Prevent selecting self if it's a User object
        if (!('groupName' in chatItem) && chatItem.email === currentUser?.email) {
             console.warn("Attempted to select self for chat.");
             return;
        }
        setSelectedChat(chatItem);
        setMessages([]); // Clear previous messages
        setError(null); // Clear errors
    };

    // Handler to open the create group modal
    const handleOpenCreateGroupModal = () => {
        setIsCreateGroupModalOpen(true);
    };

    // Handler to close the create group modal
    const handleCloseCreateGroupModal = () => {
        setIsCreateGroupModalOpen(false);
    };


    // Implement group creation logic
    const handleCreateGroup = async (name: string, members: string[]) => {
        if (!currentUser?.email) {
            toast.error("Authentication error. Cannot create group.");
            throw new Error("User not authenticated"); // Throw error to signal failure to modal
        }
        if (!name || members.length === 0) {
             toast.error("Group name and members are required.");
             throw new Error("Invalid group data");
        }

        // Ensure current user is included
        const finalMembers = Array.from(new Set([...members, currentUser.email]));

        try {
            const groupData: Omit<ChatGroup, 'id'> = {
                type: 'group',
                groupName: name,
                members: finalMembers,
                createdAt: serverTimestamp() as Timestamp,
                // lastMessage: '', // Initialize if needed
                // lastMessageTimestamp: serverTimestamp() as Timestamp, // Initialize if needed
            };
            const docRef = await addDoc(collection(dbFirestore, 'chats'), groupData);
            toast.success(`Group "${name}" created successfully.`);
            handleCloseCreateGroupModal(); // Close modal on success

            // Optionally, select the newly created group
            // Need to fetch the created group data or construct it to select it
            // For now, just close the modal. User can select from the list.

        } catch (err) {
            console.error("Error creating group:", err);
            toast.error("Failed to create group.");
            throw err; // Re-throw error to signal failure to modal
        }
    };

    const isLoading = loadingUsers || loadingGroups; // Combined loading state

    // Determine selected chat identifier for comparison
    const selectedChatId = selectedChat ? ('groupName' in selectedChat ? selectedChat.id : selectedChat.email) : null;


    return (
        <div className="flex h-[calc(100vh-200px)] border border-border rounded-lg bg-card text-card-foreground overflow-hidden">
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
                                                <AvatarFallback className="text-xs">{getAvatarFallback(member)}</AvatarFallback>
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
                        <div ref={messageContainerRef} className="flex-grow p-4 overflow-y-auto space-y-3">
                            <ChatMessageList
                                className="space-y-3" // Keep spacing if needed
                            >
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
                                {loadingMessages && (
                                    <ChatBubble variant="received" className="self-start bg-muted px-3 py-2 rounded-lg shadow-sm">
                                         <ChatBubbleAvatar fallback="?" className="h-6 w-6 mr-2" />
                                         <ChatBubbleMessage isLoading={true} className="text-sm text-foreground">&nbsp;</ChatBubbleMessage>
                                    </ChatBubble>
                                )}
                            </ChatMessageList>
                        </div>

                        {/* Message Input */}
                        <div className="border-t border-border p-3 bg-card">
                            <ChatInput
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                placeholder={`Message ${'groupName' in selectedChat ? selectedChat.groupName : formatUserName(selectedChat)}...`}
                                className="rounded-md"
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>Select a user or group to start chatting.</p>
                    </div>
                )}
            </div>

             {/* Create Group Modal */}
             <CreateGroupModal
                isOpen={isCreateGroupModalOpen}
                onClose={handleCloseCreateGroupModal}
                personnel={ciuPersonnel} // Pass personnel list for member selection
                currentUserEmail={currentUser?.email} // Pass current user's email
                onCreate={handleCreateGroup}
             />
        </div>
    );
};

export default CIUChatInterface;

