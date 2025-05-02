import React, { useMemo, useEffect, useRef, useState } from 'react'; // Import useState
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
import { Timestamp, FieldValue } from 'firebase/firestore';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { formatDateSeparator, formatTimestampDateOnly, formatTimestampTimeOnly } from '../utils/timeHelpers';

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
  onClose?: () => void;
  fontSizePercent?: number;
  isEmbedded?: boolean;
  className?: string;
  allUsers?: User[];
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
  onClose,
  fontSizePercent = 100,
  isEmbedded = false,
  className,
  allUsers = [],
}) => {
  const { scrollRef, scrollToBottom, autoScrollEnabled, isAtBottom, scrollToBottomAndEnableAutoScroll } =
    useAutoScroll({
      content: messages.length,
      smooth: true,
      offset: 50,
    });

  const prevMessagesLengthRef = useRef(messages.length);
  const initialScrollDoneRef = useRef(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) {
      initialScrollDoneRef.current = false;
      prevMessagesLengthRef.current = 0;
      return;
    }
    if (messages.length > 0) {
      const isInitialLoad = !initialScrollDoneRef.current || prevMessagesLengthRef.current === 0;
      const shouldScroll = autoScrollEnabled || isInitialLoad;
      if (shouldScroll) {
        const t = setTimeout(() => {
          scrollToBottom();
          if (isInitialLoad) initialScrollDoneRef.current = true;
        }, 50);
        prevMessagesLengthRef.current = messages.length;
        return () => clearTimeout(t);
      } else {
        prevMessagesLengthRef.current = messages.length;
      }
    } else {
      initialScrollDoneRef.current = false;
      prevMessagesLengthRef.current = 0;
    }
  }, [messages.length, isLoading, scrollToBottom, autoScrollEnabled]);

  const prevIsSendingRef = useRef(isSending);
  useEffect(() => {
    if (prevIsSendingRef.current && !isSending && newMessage === '') {
      requestAnimationFrame(() => inputRef?.current?.focus());
    }
    prevIsSendingRef.current = isSending;
  }, [isSending, newMessage, inputRef]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && newMessage.trim()) onSendMessage();
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

  const getParticipantName = (cid: string): string => {
    const user = allUsers.find(u => u.cid === cid);
    if (user) {
      const parts = (user.name ?? '').split(' ');
      const initial = parts[0]?.[0] ?? '';
      const last = parts.length > 1 ? parts.pop()! : '';
      return initial && last ? `${initial}. ${last}` : user.name ?? 'Unknown';
    }
    return `Unknown (${cid.slice(0,4)}...)`;
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Card className={cn(
        "relative w-full h-full flex flex-col overflow-hidden",
        isEmbedded ? "shadow-none border-none bg-transparent h-full" : "shadow-lg border border-border rounded-lg bg-card",
        className
      )}>
        {/* Header */}
        <CardHeader className={cn(
          "flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50 flex-shrink-0",
          isEmbedded && "bg-black/80"
        )}>
          <div className="flex items-center gap-3">
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground -ml-2">
                <ArrowLeft className="h-5 w-5"/><span className="sr-only">Back</span>
              </Button>
            )}
            <Avatar className="h-9 w-9 border border-border">
              {headerInfo.avatarUrl
                ? <AvatarImage src={headerInfo.avatarUrl} alt={headerInfo.name}/>
                : <AvatarFallback>{headerInfo.avatarFallback}</AvatarFallback>
              }
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold text-base text-foreground truncate">{headerInfo.name}</span>
              {headerInfo.groupParticipants.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground cursor-default">
                      {headerInfo.groupParticipants.length} participant{headerInfo.groupParticipants.length !== 1 && 's'}
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
          {onClose && !isEmbedded && (
            <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground -mr-2">
              <X className="h-5 w-5"/><span className="sr-only">Close chat</span>
            </Button>
          )}
        </CardHeader>

        {/* Messages Area */}
        <CardContent className="relative flex-1 p-0">
          {/* SCROLLABLE LAYER */}
          <div ref={scrollRef} className="absolute inset-0 overflow-y-auto custom-scrollbar">
            {/* ALIGN LAYER */}
            <div className="flex flex-col p-4 min-h-full justify-end">
              {isLoading ? (
                <div className="flex justify-center items-center flex-grow">
                  <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex justify-center items-center flex-grow">
                  <p className="text-muted-foreground italic">No messages yet.</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isSent = message.sender === "me";
                  const senderName = message.name || 'Unknown User';
                  const showSenderName = !isSent && chatTarget && 'groupName' in chatTarget;
                  const messageTimestamp = message.timestamp instanceof Timestamp ? message.timestamp : null;
                  const fallbackUser: User = {
                    id: message.uid || message.id || 'unknown',
                    name: senderName,
                    email: '',
                    cid: message.uid || '',
                    uid: message.uid || 'unknown',
                  };

                  // Date separator
                  let dateSeparatorElement: React.ReactNode = null;
                  const curDate = messageTimestamp?.toDate();
                  const prevTs = index > 0 ? messages[index - 1].timestamp : null;
                  const prevDate = prevTs instanceof Timestamp ? prevTs.toDate() : null;
                  if (curDate) {
                    const cd = new Date(curDate.getFullYear(), curDate.getMonth(), curDate.getDate()).getTime();
                    const pd = prevDate && new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate()).getTime();
                    if (index === 0 || pd !== undefined && cd !== pd) {
                      const label = formatDateSeparator(curDate);
                      if (label) {
                        dateSeparatorElement = (
                          <div className="flex items-center justify-center my-4" aria-hidden="true">
                            <span className="px-3 py-1 bg-muted/80 text-muted-foreground text-xs font-medium rounded-full shadow-sm backdrop-blur-sm">
                              {label}
                            </span>
                          </div>
                        );
                      }
                    }
                  }

                  return (
                    <React.Fragment key={message.id}>
                      {dateSeparatorElement}
                      <div className={cn("flex items-end gap-2 mt-2", isSent ? "justify-end" : "justify-start")}>
                        {!isSent && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Avatar className="h-7 w-7 border border-border flex-shrink-0 cursor-default">
                                <AvatarImage src={message.avatarUrl}/>
                                <AvatarFallback>{getAvatarFallback(fallbackUser)}</AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent><p>{senderName}</p></TooltipContent>
                          </Tooltip>
                        )}
                        <div
                          className={cn(
                            "rounded-lg px-3 py-2 shadow-sm break-words cursor-pointer",
                            "max-w-[85%] sm:max-w-[75%]",
                            isSent ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          )}
                          onClick={() => setSelectedMessageId(id => id === message.id ? null : message.id)}
                        >
                          {showSenderName && <div className="text-xs font-semibold mb-1 opacity-80">{senderName}</div>}
                          {message.type === 'image' ? (
                            <img
                              src={message.content}
                              alt="Sent image"
                              className="rounded-md max-w-xs max-h-60 object-contain my-1 cursor-pointer"
                              onClick={() => window.open(message.content, '_blank')}
                            />
                          ) : (
                            <div className="text-sm whitespace-pre-wrap" style={{ fontSize: `${fontSizePercent}%` }}>
                              {message.content}
                            </div>
                          )}
                          <div className="text-xs opacity-70 text-right mt-1">
                            {selectedMessageId === message.id && messageTimestamp && (
                              <span className="mr-1">{formatTimestampDateOnly(messageTimestamp)},</span>
                            )}
                            <span>{messageTimestamp ? formatTimestampTimeOnly(messageTimestamp) : 'Sending...'}</span>
                          </div>
                        </div>
                        {isSent && currentUser && (
                          <Avatar className="h-7 w-7 border border-border flex-shrink-0">
                            <AvatarImage src={currentUser.photoURL ?? undefined}/>
                            <AvatarFallback>{getAvatarFallback(currentUser)}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>

        {/* Scroll-to-bottom */}
        {!isAtBottom && (
          <Button
            onClick={scrollToBottomAndEnableAutoScroll}
            size="icon"
            variant="outline"
            className="absolute bottom-20 left-1/2 transform -translate-x-1/2 inline-flex rounded-full shadow-md bg-background/80 backdrop-blur-sm hover:bg-muted/80 z-10"
            aria-label="Scroll to bottom"
          >
            <ArrowDown className="h-4 w-4"/>
          </Button>
        )}

        {/* Input */}
        <CardFooter className={cn(
          "flex items-end gap-3 border-t border-border p-3 flex-shrink-0",
          isEmbedded ? "bg-black/80" : "bg-muted/50"
        )}>
          <form
            onSubmit={e => { e.preventDefault(); if (!isSending && newMessage.trim()) onSendMessage(); }}
            className="flex w-full items-end gap-2"
          >
            <Textarea
              ref={inputRef}
              value={newMessage}
              onChange={e => onNewMessageChange(e.target.value)}
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
              {isSending ? <Loader2 className="h-4 w-4 animate-spin"/> : <SendHorizontal className="h-4 w-4"/>}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
};
