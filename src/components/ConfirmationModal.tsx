import React from "react";
import Modal from "./Modal"; // Import the generic Modal

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      {/* Content now goes directly inside the generic Modal */}
      <h2 className="text-xl font-semibold text-[#f3c700] mb-4">{title}</h2>
      <p className="text-gray-300 mb-6">{message}</p>
      <div className="flex justify-end space-x-4">
        <button
          onClick={onClose}
          className="button-secondary px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="button-primary px-4 py-2 bg-red-600 hover:bg-red-500 text-white"
        >
          Confirm
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
