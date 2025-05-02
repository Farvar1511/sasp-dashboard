import React from "react";
import Modal from "./Modal"; // Import the generic Modal

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void; // Renamed from onClose for clarity in this context
    onClose: () => void; // Keep onClose for the underlying Modal component
    confirmText?: string; // Optional prop
    cancelText?: string;  // Optional prop
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose, // This is for the underlying Modal's close mechanism (e.g., clicking outside)
  onConfirm,
  onCancel, // This is for the explicit Cancel button action
  title,
  message,
  confirmText = "Confirm", // Default text
  cancelText = "Cancel",   // Default text
}) => {
  return (
    // Pass onClose to the underlying Modal for background clicks/esc key
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <h2 className="text-xl font-semibold text-[#f3c700] mb-4">{title}</h2>
      <p className="text-gray-300 mb-6">{message}</p>
      <div className="flex justify-end space-x-4">
        {/* Use onCancel for the Cancel button's click handler */}
        <button
          onClick={onCancel}
          className="button-secondary px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded" // Added rounded
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          className="button-primary px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded" // Added rounded
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
