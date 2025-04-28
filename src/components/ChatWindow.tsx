import React, { useRef, useEffect, useState, useMemo } from 'react'; // Import useMemo
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
// Import XIcon instead of ArrowLeftIcon
import { SendIcon, Loader2, Smile, XIcon } from 'lucide-react'; // Keep XIcon import
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
// Import Popover components
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
// Import Tooltip components (ensure they are imported)
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

// ... (interface ChatWindowProps remains the same) ...
interface ChatWindowProps {
  chatTarget: User | ChatGroup;
  messages: ChatMessage[];
  newMessage: string;
  onNewMessageChange: (value: string) => void;
  onSendMessage: () => void;
  onClose: () => void; // Ensure onClose is correctly typed
  isLoading: boolean;
  isSending: boolean;
  currentUser: User;
  context: 'ciu' | 'department';
  allUsers: User[]; // Add prop for all users list
}


// Original component function
function ChatWindowComponent({ // Rename original function slightly
  chatTarget,
  messages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  onClose, // Destructure onClose (still needed for Sheet logic)
  isLoading,
  isSending,
  currentUser,
  allUsers,
}: ChatWindowProps) {
  const messageListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null); // Add ref for the input
  const emojiPickerRef = useRef<HTMLDivElement>(null); // Ref for the picker container

  // State for emoji picker visibility
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Determine chat name, avatar, and fallback based on chatTarget type
  const isGroup = 'groupName' in chatTarget; // Use groupName to check type
  const chatName = isGroup ? chatTarget.groupName : formatUserName(chatTarget);
  const chatAvatarUrl = isGroup ? (chatTarget as ChatGroup).iconUrl : (chatTarget as User).photoURL;
  const chatAvatarFallback = isGroup
    ? chatTarget.groupName?.substring(0, 2).toUpperCase() || 'GP'
    : getAvatarFallback(chatTarget as User);

  // Get participant details for group header
  const groupParticipants = useMemo(() => {
    if (!isGroup || !allUsers) return [];
    const memberCids = (chatTarget as ChatGroup).members || [];
    return memberCids
      .filter(cid => cid !== currentUser.cid) // Exclude current user
      .map(cid => allUsers.find(u => u.cid === cid))
      .filter((user): user is User => !!user); // Filter out undefined results and type guard
  }, [isGroup, chatTarget, allUsers, currentUser.cid]);


  // Effect to scroll message list to bottom
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
    // Only scroll when messages change, not just typing indicator
  }, [messages]);

  // Effect to close emoji picker on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    // Bind the event listener
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [emojiPickerRef]); // Re-run if ref changes (shouldn't but good practice)


  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSending) onSendMessage();
    }
  };

  // Handler for emoji selection
  const onEmojiClick = (emojiData: EmojiClickData, event: MouseEvent) => {
    onNewMessageChange(newMessage + emojiData.emoji);
    // Optionally focus input after selection
    inputRef.current?.focus();
  };

  return (
    // Wrap the main content area with a single TooltipProvider
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-col h-full bg-card text-foreground rounded-lg overflow-hidden shadow border border-border relative p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border flex-shrink-0">
          {/* Left side: Avatar and Name/Participants */}
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Tooltip for Avatar */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-9 w-9 flex-shrink-0 cursor-default">
                  <AvatarImage src={chatAvatarUrl ?? undefined} alt={chatName} />
                  <AvatarFallback>{chatAvatarFallback}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p>{chatName}</p>
              </TooltipContent>
            </Tooltip>

            {/* Name and Participants */}
            <div className="flex flex-col overflow-hidden">
               <span className="font-semibold text-base truncate">{chatName}</span>
               {isGroup && groupParticipants.length > 0 && (
                  <div className="flex items-center space-x-1 mt-0.5">
                      {/* Participant avatars rendering logic */}
                      {groupParticipants.slice(0, 5).map(p => (
                          <Tooltip key={p.cid}>
                              <TooltipTrigger asChild>
                                  <Avatar className="h-6 w-6 border-2 border-background group-hover:border-foreground cursor-default">
                                      <AvatarImage src={p.photoURL ?? undefined} alt={p.name} />
                                      <AvatarFallback className="text-[10px]">
                                          {getAvatarFallback(p)}
                                      </AvatarFallback>
                                  </Avatar>
                              </TooltipTrigger>
                              <TooltipContent>
                                  <p>{formatUserName(p)}</p>
                              </TooltipContent>
                          </Tooltip>
                      ))}
                      {/* "+N" Popover logic */}
                      {groupParticipants.length > 5 && (
                          <Popover>
                              <PopoverTrigger asChild>
                                  <span
                                      className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground text-[10px] border-2 border-background cursor-pointer hover:bg-muted/80"
                                  >
                                      +{groupParticipants.length - 5}
                                  </span>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-2 bg-popover text-popover-foreground border shadow-md rounded-md">
                                  <div className="text-xs font-medium mb-1 border-b pb-1">Other Participants</div>
                                  <ul className="space-y-1 max-h-40 overflow-y-auto text-sm">
                                      {groupParticipants.slice(5).map(p => (
                                          <li key={p.cid} className="truncate">{formatUserName(p)}</li>
                                      ))}
                                  </ul>
                              </PopoverContent>
                          </Popover>
                      )}
                  </div>
               )}
            </div>
          </div>

          {/* Right side: Close Button - UNCOMMENTED */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose} // Call onClose when clicked
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
            aria-label="Close chat"
          >
            <XIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-grow p-4 overflow-y-auto no-scrollbar">
          {/* Remove individual TooltipProvider */}
          <div ref={messageListRef} className="flex flex-col gap-4 px-8 md:px-10">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm">
                No messages yet.
              </div>
            ) : (
              messages.length > 0 && messages.map((msg) => {
                const isMe = msg.sender === 'me';
                const fallbackUser: User = { id: msg.uid || msg.id || 'unknown', name: msg.name || '?', email: '', cid: msg.uid || '', uid: msg.uid || 'unknown' };
                return (
                  <div
                    key={msg.id}
                    className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
                  >
                    {/* Adjust max-width for message bubbles */}
                    <div className={cn('flex items-end gap-2 max-w-[60%]', isMe ? 'flex-row-reverse' : 'flex-row')}> {/* Reduced max-w to 60% */}
                      {/* Wrap Avatar with Tooltip */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Avatar className="h-8 w-8 cursor-default"> {/* Added cursor-default */}
                            <AvatarImage src={msg.avatarUrl ?? undefined} alt={msg.name} />
                            <AvatarFallback>{getAvatarFallback(fallbackUser)}</AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        {/* Don't show tooltip for own messages */}
                        {!isMe && (
                          <TooltipContent>
                            <p>{msg.name}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>

                      <div className="flex flex-col space-y-1">
                        <div
                          className={cn(
                            'px-4 py-2 rounded-2xl font-inter whitespace-pre-wrap break-words shadow-md',
                            // Decrease text size back
                            'text-base md:text-lg', // Kept from previous step
                            isMe
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-secondary-foreground'
                          )}
                        >
                          {msg.content && /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.content) && /^https?:\/\//i.test(msg.content) ? (
                             <img src={msg.content} alt="Sent image" className="max-w-xs max-h-60 rounded-md object-contain my-1 cursor-pointer" onClick={() => window.open(msg.content, '_blank')} />
                          ) : (
                             msg.content // Render text content (including emojis)
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          {msg.time}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {/* Removed TooltipProvider */}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-3 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Open emoji picker"
            >
              <Smile className="h-5 w-5" />
            </Button>
            <Input
              ref={inputRef}
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => onNewMessageChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending || isLoading}
              className="flex-grow bg-input border border-border text-foreground placeholder:text-muted-foreground rounded-md font-inter"
            />
            <Button
              size="icon"
              onClick={onSendMessage}
              disabled={!newMessage.trim() || isSending || isLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md"
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <SendIcon className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-[65px] left-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              autoFocusSearch={false}
              theme={Theme.AUTO}
              lazyLoadEmojis={true}
              height={350}
              width={300}
            />
          </div>
        )}
      </div>
    </TooltipProvider> // Close the main TooltipProvider
  );
}

// Wrap the component with React.memo for performance optimization
export const ChatWindow = React.memo(ChatWindowComponent);
