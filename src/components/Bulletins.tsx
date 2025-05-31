import React, { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { useAuth } from "../context/AuthContext";
import TiptapEditor from "../components/TipTapEditor";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ConfirmationModal from "./ConfirmationModal";
import { NavLink, useLocation } from "react-router-dom";
import BulletinsModal from "./BulletinsModal";

interface Bulletin {
  id: string;
  title: string;
  content: string;
  postedByName: string;
  postedByRank: string;
  createdAt: Date; // Ensure this is a Date object
}

interface BulletinsProps {
  selectedBulletin?: Bulletin; // This prop is still used to trigger modal display
}

const commandAndHighCommandRanks = [
  "lieutenant",
  "captain",
  "commander",
  "assistant commissioner",
  "deputy commissioner",
  "commissioner",
];

const Bulletins: React.FC<BulletinsProps> = ({ selectedBulletin }) => {
  const { user: currentUser, isAdmin: isAdminFromAuth } = useAuth();
  const location = useLocation();
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBulletinId, setEditingBulletinId] = useState<string | null>(
    null
  );
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [bulletinToDeleteId, setBulletinToDeleteId] = useState<string | null>(
    null
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const canViewAdminNav = useMemo(() => {
    if (!currentUser) return false;
    const userRankLower = currentUser.rank?.toLowerCase() || "";
    const isCommandOrHC = commandAndHighCommandRanks.includes(userRankLower);
    return isAdminFromAuth || isCommandOrHC;
  }, [currentUser, isAdminFromAuth]);

  const canManageBulletins = useMemo(() => {
    // Use the isAdmin flag from AuthContext, which already computes admin status based on role, rank, or override.
    return isAdminFromAuth;
  }, [isAdminFromAuth]);

  const showStatus = (
    type: "success" | "error",
    message: string,
    duration = 3000
  ) => {
    setStatusMessage({ type, message });
    setTimeout(() => setStatusMessage(null), duration);
  };

  const fetchBulletins = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(dbFirestore, "bulletins"),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const fetchedBulletins = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || "Untitled",
          content: data.content || "No content available.",
          postedByName: data.postedByName || "Unknown",
          postedByRank: data.postedByRank || "Unknown",
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });
      setBulletins(fetchedBulletins);
    } catch (err) {
      console.error("Error fetching bulletins:", err);
      setError("Failed to load bulletins.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBulletins();
  }, []);

  const handleStartEdit = (bulletin: Bulletin) => {
    setEditingBulletinId(bulletin.id);
    setEditedTitle(bulletin.title);
    setEditedContent(bulletin.content);
    setStatusMessage(null);
  };

  const handleCancelEdit = () => {
    setEditingBulletinId(null);
    setEditedTitle("");
    setEditedContent("");
    setIsSubmitting(false);
  };

  const handleEditBulletin = async () => {
    if (!editingBulletinId || !editedTitle.trim() || !editedContent.trim()) {
      showStatus("error", "Title and content cannot be empty.");
      return;
    }
    setIsSubmitting(true);
    try {
      const bulletinRef = doc(dbFirestore, "bulletins", editingBulletinId);
      await updateDoc(bulletinRef, {
        title: editedTitle.trim(),
        content: editedContent.trim(),
      });
      showStatus("success", "Bulletin updated successfully!");
      handleCancelEdit();
      await fetchBulletins();
    } catch (error) {
      console.error("Error updating bulletin:", error);
      showStatus(
        "error",
        `Failed to update bulletin: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setBulletinToDeleteId(id);
    setIsConfirmModalOpen(true);
  };

  const confirmDelete = () => {
    if (!bulletinToDeleteId) return;

    deleteDoc(doc(dbFirestore, "bulletins", bulletinToDeleteId))
      .then(() => {
        toast.success("Bulletin deleted successfully!");
        fetchBulletins();
        setBulletinToDeleteId(null);
        setIsConfirmModalOpen(false);
      })
      .catch((error) => {
        console.error("Error deleting bulletin:", error);
        toast.error("Failed to delete bulletin.");
        setBulletinToDeleteId(null);
        setIsConfirmModalOpen(false);
      });
  };

  const handleAddBulletin = async () => {
    if (!currentUser || !currentUser.name) {
      showStatus("error", "Could not identify user. Please log in again.");
      return;
    }
    if (!newTitle.trim() || !newContent.trim()) {
      showStatus("error", "Title and content are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      await addDoc(collection(dbFirestore, "bulletins"), {
        title: newTitle.trim(),
        content: newContent.trim(),
        postedByName: currentUser.name,
        postedByRank: currentUser.rank || "Unknown",
        createdAt: now,
      });
      showStatus("success", "Bulletin added successfully!");
      setNewTitle("");
      setNewContent("");
      setShowAddForm(false);
      await fetchBulletins();
    } catch (error) {
      console.error("Error adding bulletin:", error);
      showStatus(
        "error",
        `Failed to add bulletin: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="page-content p-6 text-gray-300 min-h-screen">
        <div className="bg-black/70 text-[#f3c700] font-inter p-6 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold mb-4 text-center">Bulletins</h1>

          {canViewAdminNav && (
            <div className="flex space-x-6 border-b border-[#f3c700] mb-6">
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? "text-[#f3c700] border-b-2 border-[#f3c700] pointer-events-none"
                      : "text-white/60 hover:text-[#f3c700]"
                  }`
                }
              >
                Admin Menu
              </NavLink>
              <NavLink
                to="/promotions"
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? "text-[#f3c700] border-b-2 border-[#f3c700] pointer-events-none"
                      : "text-white/60 hover:text-[#f3c700]"
                  }`
                }
                aria-current={
                  location.pathname === "/promotions" ? "page" : undefined
                }
              >
                Promotions
              </NavLink>
              <NavLink
                to="/bulletins"
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? "text-[#f3c700] border-b-2 border-[#f3c700] pointer-events-none"
                      : "text-white/60 hover:text-[#f3c700]"
                  }`
                }
                aria-current={
                  location.pathname === "/bulletins" ? "page" : undefined
                }
              >
                Bulletins
              </NavLink>
            </div>
          )}

          {statusMessage && (
            <div
              className={`fixed top-20 right-6 px-4 py-2 rounded shadow-lg z-50 text-sm font-medium ${
                statusMessage.type === "success"
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {statusMessage.message}
            </div>
          )}

          <div className="flex justify-between items-center mb-4">
            {canManageBulletins && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="button-primary text-sm"
              >
                {showAddForm ? "Cancel Add" : "Add New Bulletin"}
              </button>
            )}
          </div>

          {canManageBulletins && showAddForm && (
            <div className="mb-6 p-4 border border-[#f3c700]/50 rounded bg-black/95">
              <h2 className="text-xl font-semibold text-yellow-300 mb-3">
                Add New Bulletin
              </h2>
              <input
                type="text"
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="input w-full mb-2 bg-black/95 border-[#f3c700]/50 text-white"
              />
              <div className="min-h-[20rem] mb-2 bg-black/95 rounded">
                <TiptapEditor
                  content={newContent}
                  onChange={setNewContent}
                  editorClassName="bg-black/95 text-white"
                />
              </div>
              <button
                onClick={handleAddBulletin}
                className="button-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Adding..." : "Add Bulletin"}
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-gray-400">Loading bulletins...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : bulletins.length === 0 ? (
            <p className="text-gray-400">No bulletins available.</p>
          ) : (
            <div className="space-y-6">
              {bulletins.map((bulletin) => (
                <div
                  key={bulletin.id}
                  className="group bulletin-container p-4 rounded border border-[#f3c700] shadow-md bg-black/90 relative"
                >
                  <h2 className="text-lg font-bold text-yellow-300 mb-1">
                    {bulletin.title}
                  </h2>
                  <div
                    className="text-sm text-gray-300 prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: bulletin.content }}
                  ></div>
                  <p className="text-xs text-gray-400 mt-2">
                    Posted by {bulletin.postedByName} ({bulletin.postedByRank})
                    on {bulletin.createdAt.toLocaleDateString()} at{" "}
                    {bulletin.createdAt.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canManageBulletins && (
                      <>
                        <button
                          onClick={() => handleStartEdit(bulletin)}
                          className="p-1 rounded text-blue-400 hover:bg-blue-600 hover:text-white transition-colors"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteClick(bulletin.id)}
                          className="p-1 rounded text-red-400 hover:bg-red-600 hover:text-white transition-colors"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>

                  {editingBulletinId === bulletin.id && (
                    <div className="mt-4 p-4 border border-[#f3c700]/50 rounded bg-black/95">
                      <h2 className="text-lg font-semibold text-yellow-300 mb-3">
                        Edit Bulletin
                      </h2>
                      <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="input w-full mb-2 bg-black/95 border-[#f3c700]/50 text-white"
                        placeholder="Title"
                      />
                      <div className="min-h-[20rem] mb-2 bg-black/95 rounded">
                        <TiptapEditor
                          content={editedContent}
                          onChange={setEditedContent}
                          editorClassName="bg-black/95 text-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleEditBulletin}
                          className="button-primary"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="button-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => {
          setIsConfirmModalOpen(false);
          setBulletinToDeleteId(null);
        }}
        onConfirm={confirmDelete}
        onCancel={() => {
          setIsConfirmModalOpen(false);
          setBulletinToDeleteId(null);
        }}
        title="Delete Bulletin"
        message="Are you sure you want to delete this bulletin? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* If selectedBulletin is passed (from Home.tsx), show the modal */}
      <BulletinsModal
        bulletin={selectedBulletin || null}
        isOpen={!!selectedBulletin}
        onClose={() => {
          // This will be handled by the parent component (Home.tsx)
          // that manages the selectedBulletin state
        }}
      />
    </Layout>
  );
};

export default Bulletins;

