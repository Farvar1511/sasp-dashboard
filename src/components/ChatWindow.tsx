import React, { useEffect, useState, useMemo } from 'react';
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
import { ChatInput } from './ui/chat/chat-input'; // Restore ChatInput import


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
  inputRef?: React.RefObject<HTMLTextAreaElement>; // Change ref type back to HTMLTextAreaElement
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
  inputRef,
}: ChatWindowProps) {
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


  // useEffect to focus input when newMessage is cleared AND sending is complete
  useEffect(() => {
    // Only focus if message is empty, sending is false, and ref exists
    if (newMessage === '' && !isSending && inputRef?.current) {
      // Defer focus to the next microtask
      setTimeout(() => {
        // Check if the input is not already focused to avoid unnecessary focus calls
        if (document.activeElement !== inputRef.current) {
           inputRef.current?.focus(); // Use optional chaining inside timeout
        }
      }, 0);
    }
    // Add isSending to the dependency array
  }, [newMessage, isSending, inputRef]);

  // Keydown handler for the input area div
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement | HTMLTextAreaElement>) => { // Update type back
    // Check if the event target is the input/textarea or if the key is Enter
    // Only send if Enter is pressed WITHOUT Shift
    if (e.key === 'Enter' && !e.shiftKey) {
      // Check if the event originated from the ChatInput or allow Enter anywhere in the div
      // For simplicity, let's assume Enter in the div should trigger send if message is valid
      e.preventDefault(); // Keep preventing default to avoid newline
      if (!isSending && newMessage.trim()) { // Keep check for sending state and empty message
        onSendMessage();
      }
    }
    // If Shift+Enter is pressed, the default behavior (inserting a newline in textarea) will occur
  };

  // Handler for emoji click
  const onEmojiClick = (emojiData: EmojiClickData, event: MouseEvent) => {
    onNewMessageChange(newMessage + emojiData.emoji);
    setShowEmojiPicker(false);
  };


  return (
    <TooltipProvider delayDuration={100}>
      {/* Outermost container */}
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

        {/* Messages Container */}
        <div className="flex-grow overflow-hidden">
          <ChatMessageList className="p-4 md:px-6 h-full">
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
                        'font-inter whitespace-pre-wrap break-words',
                     )}
                  >
                    {/* Conditional rendering for image vs text */}
                    {msg.type === 'image' && msg.content ? (
                       <img src={msg.content} alt="Sent image" className="max-w-xs max-h-60 rounded-md object-contain my-1 cursor-pointer" onClick={() => window.open(msg.content, '_blank')} />
                    ) : (
                       msg.content // Render text content
                    )}
                     {/* Timestamp (optional, place inside or outside message content) */}
                     {/* --- THIS IS WHERE THE TIMESTAMP IS RENDERED --- */}
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

        {/* Input Area */}
         <div className="p-3 border-t border-border flex-shrink-0">
          {/* Add onKeyDown back to this div */}
          <div onKeyDown={handleKeyDown} className="flex items-center gap-2">
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
                {/* ... PopoverContent ... */}
                <PopoverContent
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

            {/* Replace Input with ChatInput */}
            <ChatInput
              ref={inputRef}
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => onNewMessageChange(e.target.value)}
              // Remove onKeyDown from ChatInput
              disabled={isSending || isLoading}
              // Apply the new class and remove h-10
              className="chat-input flex-grow bg-input border border-border text-foreground placeholder:text-muted-foreground rounded-md font-inter resize-none min-h-[24px] max-h-[140px] overflow-auto"
                // Remove autoComplete if it was added
            />
            <Button
              size="icon"
              type="button" // <-- Change type to "button"
              onClick={onSendMessage} // <-- Add onClick handler
              onMouseDown={(e) => e.preventDefault()}  // Keep this line
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
