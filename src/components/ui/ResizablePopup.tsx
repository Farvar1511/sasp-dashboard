import React, { useState, useCallback } from 'react';
import { ResizableBox, ResizeCallbackData } from 'react-resizable';
import { cn } from '../../lib/utils';
import 'react-resizable/css/styles.css'; // Import default styles
import { Button } from './button';
import { FaTimes } from 'react-icons/fa';

interface ResizablePopupProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
}

export const ResizablePopup: React.FC<ResizablePopupProps> = ({
  isOpen,
  onClose,
  children,
  title = 'Chat',
  initialWidth = 800, // Default width
  initialHeight = 600, // Default height
  minWidth = 400,
  minHeight = 300,
  maxWidth = typeof window !== 'undefined' ? window.innerWidth * 0.9 : 1600, // Max 90% viewport width
  maxHeight = typeof window !== 'undefined' ? window.innerHeight * 0.9 : 1000, // Max 90% viewport height
  className,
}) => {
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);

  const onResize = useCallback((event: React.SyntheticEvent, data: ResizeCallbackData) => {
    setWidth(data.size.width);
    setHeight(data.size.height);
  }, []);

  if (!isOpen) {
    return null;
  }

  // Basic centering style - adjust as needed
  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 100, // Ensure it's above other elements like the sidebar
  };

  return (
    <div style={popupStyle}>
      <ResizableBox
        width={width}
        height={height}
        onResize={onResize}
        minConstraints={[minWidth, minHeight]}
        maxConstraints={[maxWidth, maxHeight]}
        className={cn(
          "bg-card border border-border rounded-lg shadow-xl overflow-hidden flex flex-col",
          className
        )}
        // Add handles (e.g., 'se' for south-east corner)
        // You might need custom handle components for better styling
        handle={<span className="react-resizable-handle react-resizable-handle-se" />}
        handleSize={[10, 10]} // Adjust handle size
        resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n']} // Enable all handles
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-muted flex-shrink-0">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            title="Close"
            className="text-muted-foreground hover:text-destructive"
          >
            <FaTimes className="h-4 w-4" />
          </Button>
        </div>

        {/* Content Area */}
        <div className="flex-grow overflow-auto h-full">
          {children}
        </div>
      </ResizableBox>
    </div>
  );
};
