import React, { useState } from "react";
import { doc, setDoc, collection, getDoc, Timestamp } from "firebase/firestore"; 
import { db as dbFirestore } from "../firebase";
import { toast } from "react-toastify";
import { CertStatus } from "../types/User";
import { defaultCertifications } from "../data/defaultData"; 
import { getRankCategory, rankCategories } from "./AdminMenu";

interface AddUserModalProps {
  onClose: () => void;
  onSave: () => void; // Callback to refresh user list
}

const AddUserModal: React.FC<AddUserModalProps> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: "",
    rank: "Trooper",
    badge: "",
    callsign: "",
    discordId: "",
    cid: "", // Added CID field
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveNewUser = async () => {
    if (!formData.name.trim()) {
      toast.error("User Name cannot be empty.");
      return;
    }

    setIsSaving(true);
    const userNameId = formData.name.trim(); // Use name as the document ID
    const userRank = formData.rank.trim() || "Trooper";
    const rankCategoryKey = getRankCategory(userRank);
    const category = rankCategoryKey ? rankCategories[rankCategoryKey] : null; // Calculate category

    try {
      const userRef = doc(dbFirestore, "users", userNameId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        toast.error(`User with name "${userNameId}" already exists.`);
        setIsSaving(false);
        return;
      }

      // Prepare the data for the new user based on the provided structure
      const newUser = {
        assignedVehicleId: "", // Default to empty string
        badge: formData.badge.trim() || "N/A",
        callsign: formData.callsign.trim() || "",
        category: category, // Use calculated category
        certifications: defaultCertifications, // Use the imported default map with null values
        cid: formData.cid.trim() || "", // Use entered CID or empty string
        discordId: formData.discordId.trim() || "",
        displayName: userNameId, // Use name as displayName
        email: "", // Explicitly set email to empty as name is the ID
        // id: userNameId, // ID is handled by setDoc
        isActive: true,
        isAdmin: false, // Default to false
        isPlaceholder: false,
        "isadmin?": false, // Keep for consistency if needed
        joinDate: "", // Default to empty string
        lastPromotionDate: "", // Default to empty string
        lastSignInTime: null, // Keep null for timestamp field
        loaEndDate: "", // Default to empty string
        loaStartDate: "", // Default to empty string
        name: userNameId,
        promotionStatus: { votes: {} }, // Default empty map
        rank: userRank,
        role: "", // Default empty string
        // Subcollections (tasks, discipline, notes) will be created when needed
      };

      await setDoc(userRef, newUser); // Use setDoc to specify the document ID

      toast.success(`User "${userNameId}" added successfully!`);
      onSave(); // Trigger refresh in AdminMenu
      onClose(); // Close the modal
    } catch (error) {
      console.error("Error adding new user:", error);
      toast.error("Failed to add user. Please check console for details.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex justify-center items-center z-50 p-4 bg-black bg-opacity-60"
      onClick={onClose}
    >
      <div
        className="bg-black p-6 rounded-lg shadow-xl w-full max-w-md border border-yellow-600"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-yellow-400 mb-6">Add New User</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name (Used as ID) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="input w-full bg-gray-700 border-gray-600 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Rank
            </label>
            <input
              type="text"
              name="rank"
              value={formData.rank}
              onChange={handleInputChange}
              className="input w-full bg-gray-700 border-gray-600 text-white"
            />
          </div>
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
            />
          </div>
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
            />
          </div>
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
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              CID
            </label>
            <input
              type="text"
              name="cid"
              value={formData.cid}
              onChange={handleInputChange}
              className="input w-full bg-gray-700 border-gray-600 text-white"
              placeholder="Optional"
            />
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
            {isSaving ? "Saving..." : "Add User"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddUserModal;
