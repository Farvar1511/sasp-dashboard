import React, { useMemo, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Loader2, SendHorizontal, X, Users, ArrowLeft, ArrowDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { ChatMessage } from '../types/chat';
import { User } from '../types/User';
import { ChatGroup } from '../types/ChatGroup';
import { formatUserName, getAvatarFallback } from './Chat/utils';
import { useAutoScroll } from './ui/chat/hooks/useAutoScroll';
import { Card, CardHeader, CardContent, CardFooter } from './ui/card';
import { Timestamp } from 'firebase/firestore';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

export interface ChatWindowProps {
  chatTarget: User | ChatGroup | null;
  messages: ChatMessage[];
  newMessage: string;
  onNewMessageChange: (value: string) => void;
  onSendMessage: () => void;
  isLoading: boolean;
  isSending: boolean;
  currentUser: User | null;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  onClose?: () => void; // Make onClose optional
  fontSizePercent?: number;
  isEmbedded?: boolean; // Add isEmbedded prop
  className?: string; // Add className prop
  allUsers?: User[]; // Add allUsers prop
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  chatTarget,
  messages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  isLoading,
  isSending,
  currentUser,
  inputRef,
  onClose, // Destructure onClose
  fontSizePercent = 100,
  isEmbedded = false,
  className,
  allUsers = [], // Destructure allUsers with default
}) => {
  // Get isAtBottom and scrollToBottomAndEnableAutoScroll
  const { scrollRef, scrollToBottom, autoScrollEnabled, isAtBottom, scrollToBottomAndEnableAutoScroll } = useAutoScroll({
    content: messages.length,
    smooth: true,
    offset: 50,
  });

  const prevMessagesLengthRef = useRef(messages.length);
  const initialScrollDoneRef = useRef(false);

  useEffect(() => {
    if (isLoading) {
      initialScrollDoneRef.current = false;
      prevMessagesLengthRef.current = 0;
      return;
    }

    if (messages.length > 0) {
      const isInitialLoad = !initialScrollDoneRef.current || prevMessagesLengthRef.current === 0;
      const shouldScroll = autoScrollEnabled || isInitialLoad; // Scroll if auto-scroll is enabled OR it's the initial load

      if (shouldScroll) { // Check if scrolling should happen
        const timer = setTimeout(() => {
          scrollToBottom();
          if (isInitialLoad) {
            initialScrollDoneRef.current = true;
          }
        }, 50); // Keep delay for rendering

        prevMessagesLengthRef.current = messages.length; // Update ref only if scrolled

        return () => clearTimeout(timer);
      } else {
        // If not scrolling automatically, still update the ref to prevent future initial load scrolls
        prevMessagesLengthRef.current = messages.length;
      }

    } else {
      initialScrollDoneRef.current = false;
      prevMessagesLengthRef.current = 0;
    }
    // Add autoScrollEnabled to dependency array
  }, [messages.length, isLoading, scrollToBottom, autoScrollEnabled]);


  // --- Refocus Logic ---
  const prevIsSendingRef = useRef(isSending);

  useEffect(() => {
    if (prevIsSendingRef.current && !isSending && newMessage === '') {
      requestAnimationFrame(() => {
        inputRef?.current?.focus();
      });
    }
    prevIsSendingRef.current = isSending;
  }, [isSending, newMessage, inputRef]);
  // --- End Refocus Logic ---


  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && newMessage.trim()) {
        onSendMessage();
      }
    }
  };

  const headerInfo = useMemo(() => {
    if (!chatTarget) return { name: 'Chat', avatarUrl: undefined, avatarFallback: '?', groupParticipants: [] };
    if ('groupName' in chatTarget) {
      return {
        name: chatTarget.groupName,
        avatarUrl: undefined,
        avatarFallback: <Users className="h-5 w-5" />,
        groupParticipants: chatTarget.members || [],
      };
    } else {
      return {
        name: formatUserName(chatTarget),
        avatarUrl: chatTarget.photoURL ?? undefined,
        avatarFallback: getAvatarFallback(chatTarget),
        groupParticipants: [],
      };
    }
  }, [chatTarget]);

  const formatTime = (timestamp: Timestamp | any): string => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return '...'; // Indicate loading or invalid time
  };

  const getParticipantName = (cid: string): string => {
      const user = allUsers.find(u => u.cid === cid);
      if (user) {
          const nameParts = (user.name ?? '').split(' ');
          const firstNameInitial = nameParts[0]?.[0] ?? '';
          const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
          if (firstNameInitial && lastName) {
              return `${firstNameInitial}. ${lastName}`;
          }
          return user.name ?? 'Unknown'; // Fallback to full name or 'Unknown' if undefined
      }
      return `Unknown (${cid.substring(0, 4)}...)`; // Fallback if user not found
  };


  return (
    <TooltipProvider delayDuration={100}>
      <Card className={cn(
          "relative w-full h-full flex flex-col overflow-hidden", // Added relative
          // If embedded, ensure height is controlled by parent
          isEmbedded ? "shadow-none border-none bg-transparent h-full" : "shadow-lg border border-border rounded-lg bg-card",
          className
      )}>
        {/* Header */}
        <CardHeader className={cn(
            "flex flex-row items-center justify-between px-4 py-3 border-b border-border bg-muted/50 flex-shrink-0",
            isEmbedded && "bg-black/80" // Match parent header style if embedded
        )}>
          <div className="flex items-center gap-3">
            {/* Back button uses onClose - CRITICAL for mobile navigation */}
            {onClose && (
               <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground -ml-2">
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Back</span>
               </Button>
            )}
            <Avatar className="h-9 w-9 border border-border">
              {headerInfo.avatarUrl ? (
                <AvatarImage src={headerInfo.avatarUrl} alt={headerInfo.name} />
              ) : (
                <AvatarFallback>{headerInfo.avatarFallback}</AvatarFallback>
              )}
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold text-base text-foreground truncate">{headerInfo.name}</span>
               {/* Participant Tooltip for Groups */}
               {headerInfo.groupParticipants.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground cursor-default">
                        {headerInfo.groupParticipants.length} participant{headerInfo.groupParticipants.length !== 1 ? 's' : ''}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start">
                      <ScrollArea className="max-h-40 w-48">
                        <div className="p-2 space-y-1">
                          {headerInfo.groupParticipants.map(cid => (
                            <div key={cid} className="text-xs">{getParticipantName(cid)}</div>
                          ))}
                        </div>
                      </ScrollArea>
                    </TooltipContent>
                  </Tooltip>
               )}
            </div>
          </div>
          {/* Close button uses onClose - Only show if NOT embedded (or handled by parent) */}
          {onClose && !isEmbedded && ( // Hide if embedded (parent handles close)
            <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground -mr-2">
              <X className="h-5 w-5" />
              <span className="sr-only">Close chat</span>
            </Button>
          )}
        </CardHeader>

        {/* Messages Area */}
        <CardContent
          ref={scrollRef}
          className={cn(
              "flex flex-col flex-1 p-4 gap-4 min-h-0 chat-scroll-area custom-scrollbar overflow-y-auto",
              isEmbedded ? "bg-transparent" : "bg-background" // Adjust background if embedded
          )}
        >
          <div className="p-4 flex flex-col gap-4">
            {isLoading ? (
              // Center loading spinner (keep flex-grow here)
              <div className="flex justify-center items-center flex-grow">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
                 // Center "No messages" text (keep flex-grow here)
                 <div className="flex justify-center items-center flex-grow">
                    <p className="text-muted-foreground italic">No messages yet.</p>
                 </div>
            ) : (
              <>
                {/* Keep Spacer div BEFORE messages */}
                <div className="flex-grow" />
                {/* Messages mapping */}
                {messages.map((message) => {
                  const isSent = message.sender === "me";
                  const senderName = message.name || 'Unknown User';
                  const showSenderName = !isSent && chatTarget && 'groupName' in chatTarget;
                  const fallbackUser: User = {
                      id: message.uid || message.id || 'unknown',
                      name: senderName,
                      email: '', // Dummy
                      cid: message.uid || '', // Dummy
                      uid: message.uid || 'unknown'
                  };

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex items-end gap-2",
                        isSent ? "justify-end" : "justify-start"
                      )}
                    >
                      {/* Avatar for received messages */}
                      {!isSent && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                             <Avatar className="h-7 w-7 border border-border flex-shrink-0 cursor-default">
                               <AvatarImage src={message.avatarUrl} />
                               <AvatarFallback>{getAvatarFallback(fallbackUser)}</AvatarFallback>
                             </Avatar>
                          </TooltipTrigger>
                          <TooltipContent>
                             <p>{senderName}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {/* Message Bubble */}
                      <div
                        className={cn(
                          "rounded-lg px-3 py-2 shadow-sm break-words",
                          // Responsive max-width
                          "max-w-[85%] sm:max-w-[75%]",
                          isSent
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {showSenderName && (
                          <div className="text-xs font-semibold mb-1 opacity-80">{senderName}</div>
                        )}
                        {message.type === 'image' ? (
                          <img
                             src={message.content}
                             alt="Sent image"
                             className="rounded-md max-w-xs max-h-60 object-contain my-1 cursor-pointer"
                             onClick={() => window.open(message.content, '_blank')}
                          />
                        ) : (
                          <div
                            className="text-sm whitespace-pre-wrap"
                            style={{ fontSize: `${fontSizePercent}%` }}
                          >
                            {message.content}
                          </div>
                        )}
                        <div className="text-xs opacity-70 text-right mt-1">{formatTime(message.timestamp)}</div>
                      </div>
                      {/* Avatar for sent messages */}
                      {isSent && currentUser && (
                        <Avatar className="h-7 w-7 border border-border flex-shrink-0">
                          <AvatarImage src={currentUser.photoURL ?? undefined} />
                          <AvatarFallback>{getAvatarFallback(currentUser)}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </CardContent>

        {/* Scroll to Bottom Button */}
        {!isAtBottom && (
          <Button
            onClick={scrollToBottomAndEnableAutoScroll}
            size="icon"
            variant="outline"
            // Adjust positioning: Place it above the footer
            // Use bottom-16 or bottom-20 depending on footer height
            className="absolute bottom-20 left-1/2 transform -translate-x-1/2 inline-flex rounded-full shadow-md bg-background/80 backdrop-blur-sm hover:bg-muted/80 z-10"
            aria-label="Scroll to bottom"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}

        {/* Input Area */}
        <CardFooter className={cn(
            "flex items-end gap-3 border-t border-border p-3 flex-shrink-0",
            isEmbedded ? "bg-black/80" : "bg-muted/50" // Match parent style if embedded
        )}>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!isSending && newMessage.trim()) {
              onSendMessage();
            }
          }} className="flex w-full items-end gap-2">
            <Textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => onNewMessageChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-grow resize-none bg-background border border-input rounded-lg min-h-[40px] max-h-[120px] overflow-auto custom-scrollbar shadow-inner px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              disabled={isSending || isLoading || !chatTarget}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isSending || !newMessage.trim() || isLoading || !chatTarget}
              className="flex-shrink-0 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-10"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="h-4 w-4" />
              )}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
};
