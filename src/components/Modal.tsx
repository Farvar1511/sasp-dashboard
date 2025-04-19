// components/Modal.tsx
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="
          bg-black/90 border border-white/20 rounded-lg shadow-xl 
          overflow-y-auto max-h-[90vh]
          w-full max-w-4xl      /* ← add this */
        "
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
