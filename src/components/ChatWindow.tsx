import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area'; // Import ScrollArea from the correct path
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
// Import ArrowLeft icon
import { SendIcon, Loader2, Smile, XIcon, ArrowLeft, Users } from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { ChatMessage } from '../types/chat';
import { User } from '../types/User';
import { ChatGroup } from '../types/ChatGroup';
import { formatUserName, getAvatarFallback } from './Chat/utils';
import { cn } from '../lib/utils';
import { ChatMessageList } from './ui/chat/chat-message-list';
import { ChatBubble } from "./ui/chat/chat-bubble";
import { ChatBubbleAvatar } from "./ui/chat/chat-bubble";
import { ChatBubbleMessage } from "./ui/chat/chat-bubble";

// Update interface to include fontSizePercent
interface ChatWindowProps {
  chatTarget: User | ChatGroup;
  messages: ChatMessage[]; // Expecting the raw messages array
  newMessage: string;
  onNewMessageChange: (value: string) => void;
  onSendMessage: () => void;
  onClose: () => void;
  isLoading: boolean;
  isSending: boolean;
  currentUser: User;
  context: 'ciu' | 'department';
  allUsers: User[];
  fontSizePercent: number;
}


// Original component function
function ChatWindowComponent({
  chatTarget,
  messages, // Receive raw messages
  newMessage,
  onNewMessageChange,
  onSendMessage,
  onClose, // Used for back/close buttons
  isLoading, // Keep isLoading for the loading bubble
  isSending,
  currentUser,
  allUsers, // Keep allUsers for group participant tooltips if needed
  fontSizePercent,
  context, // Keep context if needed for logic
}: ChatWindowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const prevIsSendingRef = React.useRef<boolean>();

  // State for emoji picker visibility
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Determine chat name, avatar, and fallback based on chatTarget
  const { chatName, chatAvatarUrl, chatAvatarFallback } = useMemo(() => {
    if ('groupName' in chatTarget) { // It's a ChatGroup
      return {
        chatName: chatTarget.groupName,
        chatAvatarUrl: undefined, // Groups might not have avatars
        chatAvatarFallback: <Users className="h-5 w-5" />, // Use Users icon for groups
      };
    } else { // It's a User
      return {
        chatName: formatUserName(chatTarget),
        chatAvatarUrl: chatTarget.photoURL ?? undefined,
        chatAvatarFallback: getAvatarFallback(chatTarget),
      };
    }
  }, [chatTarget]);

  // Memoize group participants for tooltip display (optional, but good practice)
  const groupParticipants = useMemo(() => {
    if ('groupName' in chatTarget && allUsers && currentUser) {
      const participantUsers = chatTarget.members
        .map(cid => allUsers.find(u => u.cid === cid) || (currentUser.cid === cid ? currentUser : null))
        .filter((u): u is User => u !== null); // Type guard to filter out nulls
      return participantUsers;
    }
    return [];
  }, [chatTarget, allUsers, currentUser]);


  // Effect to refocus input after sending is complete
  useEffect(() => {
    // Get the previous value
    const prevIsSending = prevIsSendingRef.current;

    // Check if isSending transitioned from true to false
    if (prevIsSending === true && isSending === false) {
        // Refocus the input field
        inputRef.current?.focus();
    }

    // Update the ref *after* the check for the *next* render cycle
    prevIsSendingRef.current = isSending;

  }, [isSending]); // Dependency array includes isSending


  // Effect for closing emoji picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [emojiPickerRef]);


  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && newMessage.trim()) {
          onSendMessage();
          // Focus should remain after onSendMessage triggers state update in parent
      }
    }
  };

  // Handler for emoji click
   const onEmojiClick = (emojiData: EmojiClickData, event: MouseEvent) => {
    onNewMessageChange(newMessage + emojiData.emoji);
    inputRef.current?.focus(); // Keep focus after emoji click
    setShowEmojiPicker(false);
  };


  return (
    <TooltipProvider delayDuration={100}>
      {/* Outermost container: flex-col, h-full, overflow-hidden */}
      <div className="flex flex-col h-full bg-card text-foreground rounded-lg overflow-hidden shadow border border-border relative p-0">

        {/* Header Section */}
        <div className="p-3 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Back Button */}
            <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Button>
            {/* Avatar */}
            <Avatar className="h-9 w-9">
              <AvatarImage src={chatAvatarUrl} alt={chatName} />
              <AvatarFallback>{chatAvatarFallback}</AvatarFallback>
            </Avatar>
            {/* Name and potentially participant tooltip for groups */}
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-foreground truncate">{chatName}</span>
              {/* Optional: Show participant count/tooltip for groups */}
              {'groupName' in chatTarget && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground cursor-default">
                      {groupParticipants.length} participant{groupParticipants.length !== 1 ? 's' : ''}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start">
                    <ScrollArea className="max-h-40 w-48">
                      <div className="p-2 space-y-1">
                        {groupParticipants.map(p => (
                          <div key={p.cid} className="text-xs">{formatUserName(p)}</div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          {/* Close Button */}
          <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XIcon className="h-5 w-5" />
            <span className="sr-only">Close chat</span>
          </Button>
        </div>

        {/* Messages Container: flex-grow AND overflow-hidden */}
        <div className="flex-grow overflow-hidden"> {/* Add overflow-hidden here */}
          {/* ChatMessageList handles its own internal scrolling */}
          <ChatMessageList className="p-4 md:px-6 h-full"> {/* Ensure ChatMessageList fills this container */}
            {messages.map((msg) => {
              const isMe = msg.sender === 'me';
              // Ensure fallbackUser has necessary fields for getAvatarFallback
              const fallbackUser: User = {
                  id: msg.uid || msg.id || 'unknown',
                  name: msg.name || '?',
                  email: '', // Add dummy email if needed by fallback
                  cid: msg.uid || '', // Add dummy cid if needed
                  uid: msg.uid || 'unknown'
              };
              return (
                <ChatBubble
                  key={msg.id}
                  variant={isMe ? "sent" : "received"}
                >
                  {/* Tooltip wrapping Avatar */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* Use ChatBubbleAvatar */}
                      <ChatBubbleAvatar
                        src={msg.avatarUrl ?? undefined}
                        fallback={getAvatarFallback(fallbackUser)}
                        className="h-7 w-7 cursor-default" // Apply size and cursor
                      />
                    </TooltipTrigger>
                    {!isMe && (
                      <TooltipContent>
                        <p>{msg.name}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>

                  {/* Use ChatBubbleMessage */}
                  <ChatBubbleMessage
                     style={{ fontSize: `${fontSizePercent}%` }}
                     className={cn(
                        'font-inter whitespace-pre-wrap break-words', // Keep font and wrap styles
                        // Background/text colors are handled by ChatBubble variant
                     )}
                  >
                    {/* Conditional rendering for image vs text */}
                    {msg.type === 'image' && msg.content ? (
                       <img src={msg.content} alt="Sent image" className="max-w-xs max-h-60 rounded-md object-contain my-1 cursor-pointer" onClick={() => window.open(msg.content, '_blank')} />
                    ) : (
                       msg.content // Render text content
                    )}
                     {/* Timestamp (optional, place inside or outside message content) */}
                     <div className="text-xs text-muted-foreground text-right mt-1">
                       {msg.time}
                     </div>
                  </ChatBubbleMessage>
                </ChatBubble>
              );
            })}
            {/* Loading Indicator */}
            {isLoading && (
              <ChatBubble variant="received">
                <ChatBubbleAvatar fallback="?" className="h-7 w-7" />
                <ChatBubbleMessage isLoading />
              </ChatBubble>
            )}
          </ChatMessageList>
        </div>

        {/* Input Area (flex-shrink-0) */}
         <div className="p-3 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Emoji Picker Popover */}
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                {/* ... PopoverTrigger ... */}
                 <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Open emoji picker"
                    >
                        <Smile className="h-5 w-5" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    ref={emojiPickerRef}
                    className="w-auto p-0 border-none shadow-none bg-transparent"
                    side="top"
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <EmojiPicker
                        onEmojiClick={onEmojiClick}
                        autoFocusSearch={false}
                        theme={Theme.AUTO}
                        lazyLoadEmojis={true}
                        height={350}
                        width={300}
                        searchDisabled
                        previewConfig={{ showPreview: false }}
                    />
                </PopoverContent>
            </Popover>

            <Input
              ref={inputRef} // Keep ref attached
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => onNewMessageChange(e.target.value)}
              onKeyDown={handleKeyDown}
              // Use isLoading from props for disabling input during message fetch
              disabled={isSending || isLoading}
              className="flex-grow bg-input border border-border text-foreground placeholder:text-muted-foreground rounded-md font-inter h-10"
            />
            <Button
              size="icon"
              onClick={() => { if (!isSending && newMessage.trim()) onSendMessage(); }}
              // Use isLoading from props for disabling send button
              disabled={!newMessage.trim() || isSending || isLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md flex-shrink-0"
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <SendIcon className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

      </div>
    </TooltipProvider>
  );
}

export const ChatWindow = React.memo(ChatWindowComponent);
