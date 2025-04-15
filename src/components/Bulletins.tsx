import React, { useEffect, useState, useMemo, useRef } from "react";
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

interface Bulletin {
  id: string;
  title: string;
  content: string;
  postedByName: string;
  postedByRank: string;
  createdAt: Date;
}

const Bulletins: React.FC = () => {
  const { user: currentUser } = useAuth();
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
  const editContentRef = useRef<HTMLTextAreaElement>(null);

  const canManageBulletins = useMemo(() => {
    if (!currentUser?.role || !currentUser?.rank) return false;
    const allowedRoles = ["admin"];
    const allowedRanks = ["admin"];
    return (
      allowedRoles.includes(currentUser.role.toLowerCase()) ||
      allowedRanks.includes(currentUser.rank.toLowerCase())
    );
  }, [currentUser]);

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
          createdAt: data.createdAt?.toDate() || new Date(), // Convert Firestore timestamp
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

  const handleDeleteBulletin = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this bulletin? This action cannot be undone."
      )
    )
      return;

    try {
      await deleteDoc(doc(dbFirestore, "bulletins", id));
      showStatus("success", "Bulletin deleted successfully!");
      await fetchBulletins();
    } catch (error) {
      console.error("Error deleting bulletin:", error);
      showStatus(
        "error",
        `Failed to delete bulletin: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const addContentRef = useRef<HTMLTextAreaElement>(null);

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
          <h1 className="text-3xl font-bold mb-4">Bulletins</h1>
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
            <h1 className="text-2xl font-bold text-yellow-400">Bulletins</h1>
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
            <div className="mb-6 p-4 border border-gray-700 rounded bg-gray-800/50">
              <h2 className="text-xl font-semibold text-yellow-300 mb-3">
                Add New Bulletin
              </h2>
              <input
                type="text"
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="input w-full mb-2 bg-gray-700 border-gray-600 text-white"
              />
              <textarea
                ref={addContentRef}
                placeholder="Content (supports basic HTML like <b>, <i>, <br>, <span> with style)"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={5}
                className="input w-full mb-3 bg-gray-700 border-gray-600 text-white"
              />
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
                  className="group bulletin-container p-4 rounded border shadow-md bg-gray-800 border-gray-700 relative"
                >
                  <h2 className="text-lg font-bold text-yellow-300 mb-1">
                    {bulletin.title}
                  </h2>
                  <p className="text-sm text-gray-300">{bulletin.content}</p>
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
                          className="text-blue-500 hover:text-blue-400"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteBulletin(bulletin.id)}
                          className="text-red-500 hover:text-red-400"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>

                  {/* Edit Form */}
                  {editingBulletinId === bulletin.id && (
                    <div className="mt-4 p-4 border border-gray-700 rounded bg-gray-800/50">
                      <h2 className="text-lg font-semibold text-yellow-300 mb-3">
                        Edit Bulletin
                      </h2>
                      <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="input w-full mb-2 bg-gray-700 border-gray-600 text-white"
                        placeholder="Title"
                      />
                      <textarea
                        ref={editContentRef}
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        rows={5}
                        className="input w-full mb-3 bg-gray-700 border-gray-600 text-white"
                        placeholder="Content"
                      />
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
    </Layout>
  );
};

export default Bulletins;
