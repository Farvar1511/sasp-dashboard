import React from "react";

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ onClose, children }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center px-4">
      <div className="relative w-full">
        <button
          onClick={onClose}
          className="absolute top-4 right-6 text-white text-lg font-bold z-10"
        >
          ✖
        </button>
        {children}
      </div>
    </div>
  );
};

export default Modal;
