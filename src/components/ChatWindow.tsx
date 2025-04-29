"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react'; // Import useRef
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area'; // Import ScrollArea from the correct path
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
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
  // State to track component mount status
  const [isMounted, setIsMounted] = useState(false);
  // Ref for the scrollable message container
  const messageContainerRef = useRef<HTMLDivElement>(null); // <-- Add this ref

  // --- Add Log 1 ---
  console.log(`[ChatWindow] Rendering. Message count: ${messages.length}. Last message ID: ${messages[messages.length - 1]?.id}`);
  // console.log('[ChatWindow] Received messages prop:', messages); // Optional: Log full array

  // Effect to set isMounted to true after the component mounts
  useEffect(() => {
    setIsMounted(true);
    // Optional: Scroll to bottom on initial mount after loading is false
    if (!isLoading) {
        requestAnimationFrame(() => {
            // Add a minimal timeout to ensure layout is fully computed
            setTimeout(scrollToBottom, 0);
        });
    }
  }, [isLoading]); // Run only when isLoading changes (specifically on initial load completion)


  // Function to scroll the message container to the bottom
  const scrollToBottom = () => {
    if (messageContainerRef.current) {
      // --- Add Log ---
      console.log(`[ChatWindow] scrollToBottom: Setting scrollTop to ${messageContainerRef.current.scrollHeight}`);
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    } else {
      console.log('[ChatWindow] scrollToBottom: messageContainerRef.current is null');
    }
  };

  // Effect to scroll to bottom when messages change (AFTER initial mount)
  useEffect(() => {
    // Only scroll if the component is mounted
    if (isMounted) {
        // --- Add Log 2 ---
        console.log('[ChatWindow] Scroll effect triggered (messages changed).');
        // Use requestAnimationFrame to ensure scrolling happens after render
        requestAnimationFrame(() => {
            // --- Add Log 3 ---
            console.log('[ChatWindow] Calling scrollToBottom inside requestAnimationFrame (messages changed).');
            // Add a minimal timeout to ensure layout is fully computed after message render
            setTimeout(scrollToBottom, 0);
        });
    }
    // Only trigger this effect when the messages array itself changes identity
  }, [messages, isMounted]);


  // Determine chat name, avatar, fallback, and participants based on chatTarget
  const { chatName, chatAvatarUrl, chatAvatarFallback, groupParticipants } = useMemo(() => {
    if ('groupName' in chatTarget) { // It's a ChatGroup
      return {
        chatName: chatTarget.groupName,
        chatAvatarUrl: undefined, // Groups might not have avatars
        chatAvatarFallback: <Users className="h-5 w-5" />, // Use Users icon for groups
        groupParticipants: chatTarget.participants || [], // Extract participants for groups
      };
    } else { // It's a User
      return {
        chatName: formatUserName(chatTarget),
        chatAvatarUrl: chatTarget.photoURL ?? undefined,
        chatAvatarFallback: getAvatarFallback(chatTarget),
        groupParticipants: [], // No participants for individual users
      };
    }
  }, [chatTarget]);


  // useEffect to focus input when newMessage is cleared AND sending is complete, after mount
  useEffect(() => {
    // Only focus if mounted, message is empty, sending is false, and ref exists
    // NOTE: The 'isMounted' check was removed in a previous step, let's keep it removed for now
    // if (isMounted && newMessage === '' && !isSending && inputRef?.current) {
    if (newMessage === '' && !isSending && inputRef?.current) { // Keep the simplified condition
      // Use requestAnimationFrame to ensure focus happens after browser paint
      requestAnimationFrame(() => {
        const inputElement = inputRef.current;
        // Check if the input exists and is not already the active element
        if (inputElement && document.activeElement !== inputElement) {
          inputElement.focus();
        }
      });
    }
    // Correct dependency array for this effect
  }, [newMessage, isSending, inputRef]); // Keep this dependency array


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
        <div ref={messageContainerRef} className="flex-grow overflow-y-auto"> {/* <-- Attach ref here */}
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
