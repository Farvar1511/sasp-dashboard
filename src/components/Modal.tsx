// components/Modal.tsx
import React, { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string; // e.g., 'max-w-md', 'max-w-xl', 'max-w-4xl'
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = "max-w-4xl", // Default max-width
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center p-4 backdrop-blur-sm"
      onClick={onClose} // Click on backdrop to close
    >
      <div
        className={`bg-black border border-[#f3c700] rounded-lg shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto custom-scrollbar p-6 m-4`}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal content
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
