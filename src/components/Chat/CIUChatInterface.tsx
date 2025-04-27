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
    Timestamp, // Import Timestamp
} from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types/User';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ChatMessageList } from '../ui/chat/chat-message-list';
import { ChatBubble, ChatBubbleAvatar, ChatBubbleMessage, ChatBubbleTimestamp } from '../ui/chat/chat-bubble';
import { ChatInput } from '../ui/chat/chat-input';
import { toast } from 'react-toastify';
import { hasCIUPermission } from '../../utils/ciuUtils';
import { cn } from '../../lib/utils'; // Import cn utility

const formatUserName = (user: User | null): string => {
    if (!user) return 'Unknown User';

    if (user.name) {
        const nameParts = user.name.trim().split(' ').filter(part => part.length > 0);
        if (nameParts.length >= 2) {
            const firstNameInitial = nameParts[0].charAt(0).toUpperCase();
            const lastName = nameParts[nameParts.length - 1];
            return `${firstNameInitial}. ${lastName}`;
        }
        // Handle single name part
        if (nameParts.length === 1) {
            return nameParts[0];
        }
    }
    // Fallback logic: Use callsign, then email, then id
    return user.callsign || user.email || user.id || 'Unknown User';
};

/**
 * Gets the character for the Avatar fallback.
 */
const getAvatarFallback = (user: User | null): string => {
    if (!user) return '?';
    if (user.name) {
        const nameParts = user.name.trim().split(' ').filter(part => part.length > 0);
        if (nameParts.length >= 1 && nameParts[0]) {
            return nameParts[0].charAt(0).toUpperCase();
        }
    }
    // Fallback to callsign initial, then email, then ID
    if (user.callsign) {
        return user.callsign.charAt(0).toUpperCase();
    }
    const fallbackChar = user.email?.charAt(0) || user.id?.charAt(0);
    return fallbackChar ? fallbackChar.toUpperCase() : '?';
};


interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    text: string;
    timestamp: Timestamp | null; // Use Firestore Timestamp
    senderName?: string; // Optional: To display sender's name
}

const CIUChatInterface: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [ciuPersonnel, setCiuPersonnel] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch CIU Personnel
    useEffect(() => {
        // Use email for the check now
        if (!currentUser?.email) {
             console.log("CIUChat: Current user or email not available yet.");
             setLoadingUsers(false);
             setCiuPersonnel([]);
             return;
        }
        // Log email instead of UID
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

                        // Map the document data, ensuring email is present
                        // We don't need to extract a separate UID field anymore for filtering
                        return { id: doc.id, ...data } as User; // Assuming 'email' is in 'data'
                    })
                     // Filter using email comparison
                    .filter(u => {
                        // Check if the user object has an email and it's not the current user's email
                        const isCurrentUser = u.email === currentUser.email;
                        const hasPermission = hasCIUPermission(u);
                        console.log(`CIUChat: Filtering user ${u.id} (Email: ${u.email}). Is current user? ${isCurrentUser}. Has CIU permission? ${hasPermission}. Keep? ${!isCurrentUser && hasPermission}`);
                        return u.email !== currentUser.email && hasPermission;
                    });

                // Sort users alphabetically by formatted name
                usersData.sort((a, b) => formatUserName(a).localeCompare(formatUserName(b)));

                setCiuPersonnel(usersData);
                setError(null);
            } catch (err) {
                console.error("Error fetching CIU personnel:", err);
                setError("Failed to load users.");
                toast.error("Failed to load CIU personnel for chat.");
            } finally {
                setLoadingUsers(false);
            }
        };

        fetchPersonnel();
        // Depend on currentUser.email
    }, [currentUser?.email]);

    // Generate a consistent chat ID between two users (using Emails)
    // NOTE: Using emails for chat IDs might have privacy implications or issues if emails change. UIDs are preferred.
    const getChatId = (email1: string, email2: string): string => {
        if (!email1 || !email2) {
            console.error("Cannot generate chat ID with invalid emails:", email1, email2);
            return '';
        }
        // Replace characters invalid for Firestore path segments (like '.')
        const sanitize = (email: string) => email.replace(/[^a-zA-Z0-9]/g, '_');
        return [sanitize(email1), sanitize(email2)].sort().join('-'); // Use '-' as separator
    };

    // Fetch Messages when selectedUser changes
    useEffect(() => {
        // Use email for checks
        if (!currentUser?.email || !selectedUser?.email) {
            setMessages([]);
            return;
        }

        setLoadingMessages(true);
        // Use emails for generating chatId
        const chatId = getChatId(currentUser.email, selectedUser.email);
        if (!chatId) {
             setLoadingMessages(false);
             setError("Could not determine chat ID.");
             return;
        }

        const messagesRef = collection(dbFirestore, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const fetchedMessages: Message[] = [];
            snapshot.forEach(doc => {
                 const data = doc.data();
                 const timestamp = data.timestamp instanceof Timestamp ? data.timestamp : null;
                 fetchedMessages.push({
                     id: doc.id,
                     senderId: data.senderId, // Assuming this stores email now
                     receiverId: data.receiverId, // Assuming this stores email now
                     text: data.text,
                     timestamp: timestamp,
                 });
            });
             fetchedMessages.sort((a, b) => (a.timestamp?.toMillis() ?? 0) - (b.timestamp?.toMillis() ?? 0));
             setMessages(fetchedMessages);
             setLoadingMessages(false);
             setError(null);
        }, (err) => {
            console.error("Error fetching messages:", err);
            setError("Failed to load messages.");
            toast.error(`Failed to load messages with ${formatUserName(selectedUser)}.`);
            setLoadingMessages(false);
        });

        return () => unsubscribe();
        // Depend on emails for re-fetching
    }, [currentUser?.email, selectedUser?.email]);

    const handleSendMessage = async () => {
        // Use email for checks
        if (!newMessage.trim() || !currentUser?.email || !selectedUser?.email) return;

        // Use emails for generating chatId
        const chatId = getChatId(currentUser.email, selectedUser.email);
         if (!chatId) {
             toast.error("Could not determine chat ID to send message.");
             return;
         }

        const messagesRef = collection(dbFirestore, 'chats', chatId, 'messages');

        try {
            await addDoc(messagesRef, {
                senderId: currentUser.email, // Use email
                receiverId: selectedUser.email, // Use selected user's email
                text: newMessage.trim(),
                timestamp: serverTimestamp(),
                senderName: formatUserName(currentUser),
            });
            setNewMessage('');
        } catch (err) {
            console.error("Error sending message:", err);
            toast.error("Failed to send message.");
        }
    };

    const handleUserSelect = (user: User) => {
        // Use email for check
        if (user.email !== currentUser?.email) {
            setSelectedUser(user);
            setMessages([]);
            setError(null);
        } else {
            console.warn("Attempted to select self for chat.");
        }
    };

    return (
        // Use card background, standard text, adjust height
        <div className="flex h-[calc(100vh-200px)] border border-border rounded-lg bg-card text-card-foreground overflow-hidden">
            {/* User List Sidebar */}
            {/* Use card background, standard border */}
            <div className="w-1/4 border-r border-border p-2 flex flex-col">
                {/* Standard header text */}
                <h3 className="text-lg font-semibold mb-2 px-2 text-foreground">Chats</h3>
                {loadingUsers ? (
                    <p className="text-muted-foreground px-2">Loading users...</p>
                ) : error ? (
                     <p className="text-destructive px-2">{error}</p> // Use destructive color for errors
                ) : ciuPersonnel.length === 0 ? (
                     <p className="text-muted-foreground px-2">No other CIU personnel found.</p>
                ): (
                    <ScrollArea className="h-full">
                        {ciuPersonnel.map(user => (
                            // Use muted hover and primary/muted selected states
                            <div
                                key={user.id} // Keep using doc.id for the React key
                                className={cn(
                                    "w-full flex items-center p-2 rounded cursor-pointer transition-colors duration-150 hover:bg-muted", // Standard muted hover
                                    // Use email for comparison for selected state if needed, or keep using id
                                    selectedUser?.email === user.email ? "bg-muted font-semibold" : "" // Standard selected state
                                )}
                                onClick={() => handleUserSelect(user)}
                            >
                                <Avatar className="h-8 w-8 mr-3 flex-shrink-0">
                                    <AvatarImage src={user.photoURL || undefined} alt={formatUserName(user)} />
                                    {/* Standard fallback */}
                                    <AvatarFallback>{getAvatarFallback(user)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-grow overflow-hidden">
                                    {/* Standard text */}
                                    <span className="truncate font-medium text-sm text-foreground">{formatUserName(user)}</span>
                                    {/* <p className="text-xs text-muted-foreground truncate">Last message preview...</p> */}
                                </div>
                                {/* <div className="text-xs text-muted-foreground ml-2">10m</div> */}
                            </div>
                        ))}
                    </ScrollArea>
                )}
            </div>

            {/* Chat Area */}
            <div className="w-3/4 flex flex-col bg-background"> {/* Use background for chat area */}
                {selectedUser ? (
                    <>
                        {/* Chat Header - Use card background */}
                        <div className="border-b border-border p-3 flex items-center bg-card">
                             <Avatar className="h-8 w-8 mr-2">
                                <AvatarImage src={selectedUser.photoURL || undefined} alt={formatUserName(selectedUser)} />
                                <AvatarFallback>{getAvatarFallback(selectedUser)}</AvatarFallback>
                            </Avatar>
                            <h3 className="text-lg font-semibold text-foreground">{formatUserName(selectedUser)}</h3>
                            {/* <span className="ml-2 text-xs text-green-500">Online</span> */}
                        </div>

                        {/* Message List */}
                        <ChatMessageList
                            className="flex-grow p-4 overflow-y-auto space-y-3" // Add vertical spacing
                        >
                            {messages.map(msg => {
                                // Use email for comparison
                                const isSent = msg.senderId === currentUser?.email;
                                // Find sender based on email if needed for display name/avatar
                                const senderUser = isSent
                                    ? currentUser
                                    : ciuPersonnel.find(p => p.email === msg.senderId) || null;
                                const timestamp = msg.timestamp?.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) ?? '';
                                const senderName = formatUserName(senderUser);
                                const senderAvatarSrc = senderUser?.photoURL || undefined;
                                const senderAvatarFallback = getAvatarFallback(senderUser);

                                return (
                                    <ChatBubble
                                        key={msg.id} // Keep using message doc id for key
                                        variant={isSent ? 'sent' : 'received'}
                                        // Use primary for sent, muted for received
                                        className={cn(
                                            "px-3 py-2 rounded-lg shadow-sm max-w-[75%]",
                                            isSent
                                                ? 'bg-primary text-primary-foreground self-end' // Sent bubble: primary background
                                                : 'bg-muted text-muted-foreground self-start' // Received bubble: muted background
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
                                            {!isSent && (
                                                // Use standard muted foreground for sender name
                                                <p className="text-xs text-muted-foreground/80 mb-0.5 font-medium">{senderName}</p>
                                            )}
                                            {/* Adjust message text color based on bubble background */}
                                            <ChatBubbleMessage className={cn(
                                                "text-sm leading-snug",
                                                isSent ? 'text-primary-foreground' : 'text-foreground' // Use foreground for received text
                                            )}>
                                                {msg.text}
                                            </ChatBubbleMessage>
                                            {timestamp && (
                                                <ChatBubbleTimestamp
                                                    timestamp={timestamp}
                                                    // Adjust timestamp text color based on bubble background
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
                                // Style loading bubble similar to received
                                <ChatBubble variant="received" className="self-start bg-muted px-3 py-2 rounded-lg shadow-sm">
                                     <ChatBubbleAvatar fallback="?" className="h-6 w-6 mr-2" />
                                     <ChatBubbleMessage isLoading={true} className="text-sm text-foreground">&nbsp;</ChatBubbleMessage>
                                </ChatBubble>
                            )}
                        </ChatMessageList>

                        {/* Message Input - Use card background */}
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
                                // Use standard input styling
                                placeholder={`Message ${formatUserName(selectedUser)}...`}
                                className="rounded-md" // Remove custom background/border/text/placeholder colors
                            />
                            {/* Add icons here later if needed */}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>Select a user to start chatting.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CIUChatInterface;

