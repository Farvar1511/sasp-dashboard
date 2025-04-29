import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../../lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../avatar"; // Assuming avatar path is correct
import { Button } from "../button"; // Assuming button path is correct
import { Loader2 } from "lucide-react";

// ChatBubble
const chatBubbleVariants = cva(
  "flex gap-2 max-w-[60%] items-end relative group",
  {
    variants: {
      variant: {
        received: "self-start",
        sent: "self-end flex-row-reverse",
      },
      layout: {
        default: "",
        ai: "max-w-full w-full items-center",
      },
    },
    defaultVariants: {
      variant: "received",
      layout: "default",
    },
  },
);

interface ChatBubbleProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chatBubbleVariants> {}

const ChatBubble = React.forwardRef<HTMLDivElement, ChatBubbleProps>(
  ({ className, variant, layout, children, ...props }, ref) => (
    <div
      className={cn(
        chatBubbleVariants({ variant, layout, className }),
        "relative group",
      )}
      ref={ref}
      {...props}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child) && typeof child.type !== "string"
          ? React.cloneElement(child, {
              variant,
              layout,
            } as React.ComponentProps<typeof child.type>)
          : child,
      )}
    </div>
  ),
);
ChatBubble.displayName = "ChatBubble";

// ChatBubbleAvatar
interface ChatBubbleAvatarProps
  extends React.ComponentPropsWithoutRef<typeof Avatar> {
  src?: string;
  fallback?: React.ReactNode;
}

// Wrap with React.forwardRef
const ChatBubbleAvatar = React.forwardRef<
  React.ElementRef<typeof Avatar>, // Ref type is for the Avatar element
  ChatBubbleAvatarProps
>(({ src, fallback, className, ...props }, ref) => (
  // Pass the ref to the Avatar component
  <Avatar ref={ref} className={cn("size-8", className)} {...props}>
    <AvatarImage src={src} />
    <AvatarFallback>{fallback}</AvatarFallback>
  </Avatar>
));
ChatBubbleAvatar.displayName = "ChatBubbleAvatar"; // Add display name

// ChatBubbleMessage
const chatBubbleMessageVariants = cva("p-4", {
  variants: {
    variant: {
      received:
        "bg-secondary text-secondary-foreground rounded-r-lg rounded-tl-lg",
      sent: "bg-primary text-primary-foreground rounded-l-lg rounded-tr-lg",
    },
    layout: {
      default: "",
      ai: "border-t w-full rounded-none bg-transparent",
    },
  },
  defaultVariants: {
    variant: "received",
    layout: "default",
  },
});

interface ChatBubbleMessageProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chatBubbleMessageVariants> {
  isLoading?: boolean;
}

const ChatBubbleMessage = React.forwardRef<
  HTMLDivElement,
  ChatBubbleMessageProps
>(
  (
    { className, variant, layout, isLoading = false, children, ...props },
    ref,
  ) => (
    <div
      className={cn(
        chatBubbleMessageVariants({ variant, layout, className }),
        "break-words max-w-full whitespace-pre-wrap",
      )}
      ref={ref}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center space-x-2">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        children
      )}
    </div>
  ),
);
ChatBubbleMessage.displayName = "ChatBubbleMessage";

// ChatBubbleAction
type ChatBubbleActionProps = React.ComponentProps<typeof Button> & {
  icon: React.ReactNode;
};

const ChatBubbleAction: React.FC<ChatBubbleActionProps> = ({
  icon,
  onClick,
  className,
  variant = "ghost",
  size = "icon",
  ...props
}) => (
  <Button
    variant={variant}
    size={size}
    className={className}
    onClick={onClick}
    {...props}
  >
    {icon}
  </Button>
);

export {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
  ChatBubbleAction,
  chatBubbleVariants,
};
