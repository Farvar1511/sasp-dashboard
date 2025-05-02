import React, { useState } from "react";
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import { toast } from "react-toastify";
import { defaultCertifications } from "../data/defaultData";
import { getRankCategory, rankCategories } from "./AdminMenu"; // Assuming these are correctly exported
import { format } from 'date-fns'; // Import date-fns for formatting

interface AddUserModalProps {
  onClose: () => void;
  onSave: () => void; // Callback to refresh user list
}

// Helper to get today's date in YYYY-MM-DD format
const getTodayDateString = () => {
    return format(new Date(), 'yyyy-MM-dd');
};

const AddUserModal: React.FC<AddUserModalProps> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    email: "", // New: Email for Doc ID
    name: "", // User's full name
    rank: "Trooper",
    badge: "",
    callsign: "",
    discordId: "",
    cid: "", // Now required
    joinDate: getTodayDateString(), // Pre-fill with today's date
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveNewUser = async () => {
    // --- Validation ---
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email.trim())) {
      toast.error("A valid Email is required.");
      return;
    }
    if (!formData.name.trim()) {
      toast.error("User Name is required.");
      return;
    }
     if (!formData.cid.trim()) {
      toast.error("CID is required.");
      return;
    }
    if (!formData.joinDate) {
        toast.error("Join Date is required.");
        return;
    }
    // --- End Validation ---

    setIsSaving(true);
    const userDocId = formData.email.trim().toLowerCase(); // Use email as the document ID (lowercase)
    const userRank = formData.rank.trim() || "Trooper";
    const rankCategoryKey = getRankCategory(userRank);
    const category = rankCategoryKey ? rankCategories[rankCategoryKey] : null;
    const joinDateString = formData.joinDate; // Use the date string directly

    try {
      const userRef = doc(dbFirestore, "users", userDocId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        toast.error(`User with email "${userDocId}" already exists.`);
        setIsSaving(false);
        return;
      }

      // Prepare the data for the new user based on the provided structure
      const newUser = {
        // Core Info
        id: userDocId, // Explicitly save email as id field too
        email: userDocId,
        name: formData.name.trim(),
        displayName: formData.name.trim(),
        rank: userRank,
        category: category,
        badge: formData.badge.trim() || "N/A",
        callsign: formData.callsign.trim() || "",
        cid: formData.cid.trim(),
        discordId: formData.discordId.trim() || "",

        // Status & Permissions
        isActive: true,
        isAdmin: false,
        "isadmin?": false, // Keep for consistency if needed
        isPlaceholder: false,
        role: "", // Default empty string, can be updated later

        // Dates
        joinDate: joinDateString,
        lastPromotionDate: joinDateString, // Set last promotion date to join date initially
        loaStartDate: "", // Default empty
        loaEndDate: "", // Default empty
        lastSignInTime: null, // Will be set on first login

        // Config/Other
        assignedVehicleId: null, // Default null
        certifications: defaultCertifications, // Use the imported default map
        promotionStatus: { votes: {} }, // Default empty map
        photoURL: "", // Default empty
        chatSettings: {}, // Default empty map

        // Fields from example not typically set on creation (can be added later if needed)
        // newTaskDesc: "",
        // newTaskGoal: 0,
        // newTaskType: "normal",
        // showAddDiscipline: false,
        // showAddNote: false,
        // showAssignTask: false,
        // statusMessage: null,
        // hiddenChats_department: [],
      };

      await setDoc(userRef, newUser);

      toast.success(`User "${formData.name.trim()}" added successfully!`);
      onSave(); // Trigger refresh in AdminMenu
      onClose(); // Close the modal
    } catch (error) {
      console.error("Error adding new user:", error);
      toast.error(`Failed to add user: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex justify-center items-center z-50 p-4" // Removed bg-black bg-opacity-60
      onClick={onClose}
    >
      <div
        className="bg-black p-6 rounded-lg shadow-xl w-full max-w-md border border-yellow-600"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-yellow-400 mb-6">Add New Trooper</h2>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email (Used as Login/ID) <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="input w-full bg-gray-700 border-gray-600 text-white"
              required
              placeholder="trooper@example.com"
            />
          </div>
          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="input w-full bg-gray-700 border-gray-600 text-white"
              required
              placeholder="John Doe"
            />
          </div>
          {/* CID Input */}
           <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              CID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="cid"
              value={formData.cid}
              onChange={handleInputChange}
              className="input w-full bg-gray-700 border-gray-600 text-white"
              required
              placeholder="e.g., ABC12345"
            />
          </div>
          {/* Rank Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Rank
            </label>
            <input // Or use a select if you have a predefined list
              type="text"
              name="rank"
              value={formData.rank}
              onChange={handleInputChange}
              className="input w-full bg-gray-700 border-gray-600 text-white"
              placeholder="Default: Trooper"
            />
          </div>
          {/* Badge Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Badge
            </label>
            <input
              type="text"
              name="badge"
              value={formData.badge}
              onChange={handleInputChange}
              className="input w-full bg-gray-700 border-gray-600 text-white"
              placeholder="e.g., 123"
            />
          </div>
          {/* Callsign Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Callsign
            </label>
            <input
              type="text"
              name="callsign"
              value={formData.callsign}
              onChange={handleInputChange}
              className="input w-full bg-gray-700 border-gray-600 text-white"
              placeholder="e.g., 1A-1"
            />
          </div>
          {/* Discord ID Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Discord ID
            </label>
            <input
              type="text"
              name="discordId"
              value={formData.discordId}
              onChange={handleInputChange}
              className="input w-full bg-gray-700 border-gray-600 text-white"
              placeholder="Optional"
            />
          </div>
          {/* Join Date Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Join Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="joinDate"
              value={formData.joinDate}
              onChange={handleInputChange}
              className="input w-full bg-gray-700 border-gray-600 text-white"
              required
            />
             <p className="text-xs text-gray-400 mt-1">This will also be set as the Last Promotion Date initially.</p>
          </div>
        </div>
        <div className="mt-8 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="button-secondary px-4 py-2"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveNewUser}
            className="button-primary px-4 py-2"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Add Trooper"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddUserModal;
