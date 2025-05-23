// components/Modal.tsx
import React, { ReactNode } from "react";
import { cn } from "../lib/utils"; // Import cn utility

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string; // Optional prop for max-width
  className?: string; // Add optional className prop
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = "max-w-4xl", // Default max-width
  className, // Destructure className
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center p-2 sm:p-4 backdrop-blur-sm" // Added responsive padding
      onClick={onClose} // Click on backdrop to close
    >
      <div
        className={cn( // Use cn to merge classes
          // Use w-[95vw] for small screens, apply maxWidth on larger screens
          `bg-black border border-[#f3c700] rounded-lg shadow-xl w-[95vw] ${maxWidth} max-h-[90vh] overflow-y-auto custom-scrollbar p-4 sm:p-6 m-0`, // Adjusted padding and margin
          className // Apply the passed className
        )}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal content
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
