import React, { useState, useRef, useEffect } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { useAuth } from "../context/AuthContext";
import { formatTimestampForDisplay } from "../utils/timeHelpers";
import { formatDisplayRankName } from "../utils/userHelpers";

interface Bulletin {
  id: string;
  title: string;
  content: string;
  postedByName?: string;
  postedByRank?: string;
  createdAt: Timestamp;
}

const AdminBulletins: React.FC = () => {
  const { user } = useAuth();
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newBulletin, setNewBulletin] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingBulletin, setEditingBulletin] = useState<Bulletin | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [selectedColor, setSelectedColor] = useState("#FFFFFF");
  const [selectedFontSize, setSelectedFontSize] = useState(16);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchBulletins = async () => {
    setLoading(true);
    try {
      const bulletinsQuery = query(
        collection(dbFirestore, "bulletins"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(bulletinsQuery);
      const fetchedBulletins = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Bulletin[];
      setBulletins(fetchedBulletins);
    } catch (error) {
      console.error("Error fetching bulletins:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBulletins();
  }, []);

  useEffect(() => {
    const adjustHeight = (ref: React.RefObject<HTMLTextAreaElement | null>) => {
      if (ref.current) {
        ref.current.style.height = "auto";
        ref.current.style.height = `${Math.max(
          ref.current.scrollHeight,
          100
        )}px`;
      }
    };
    adjustHeight(textareaRef);
  }, [newBulletin]);

  useEffect(() => {
    const adjustHeight = (ref: React.RefObject<HTMLTextAreaElement | null>) => {
      if (ref.current) {
        ref.current.style.height = "auto";
        ref.current.style.height = `${Math.max(
          ref.current.scrollHeight,
          100
        )}px`;
      }
    };
    adjustHeight(editTextareaRef);
  }, [editedContent]);

  const handleAddBulletin = async () => {
    if (
      !newTitle.trim() ||
      !newBulletin.trim() ||
      !user ||
      !user.rank ||
      !user.name
    ) {
      setSubmitError("Title, content, and user rank/name info are required.");
      return;
    }

    try {
      await addDoc(collection(dbFirestore, "bulletins"), {
        title: newTitle.trim(),
        content: newBulletin.trim(),
        postedByName: user.name,
        postedByRank: user.rank,
        createdAt: serverTimestamp(),
      });
      setNewTitle("");
      setNewBulletin("");
      setSubmitError(null);
      alert("Bulletin added successfully!");
      fetchBulletins();
    } catch (error) {
      console.error("Error adding bulletin:", error);
      setSubmitError("Failed to add bulletin. Please try again.");
    }
  };

  const handleDeleteBulletin = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this bulletin?"))
      return;
    try {
      await deleteDoc(doc(dbFirestore, "bulletins", id));
      alert("Bulletin deleted successfully!");
      fetchBulletins();
    } catch (error) {
      console.error("Error deleting bulletin:", error);
      alert("Failed to delete bulletin.");
    }
  };

  const handleStartEdit = (bulletin: Bulletin) => {
    setEditingBulletin(bulletin);
    setEditedTitle(bulletin.title);
    setEditedContent(bulletin.content);
  };

  const handleCancelEdit = () => {
    setEditingBulletin(null);
    setEditedTitle("");
    setEditedContent("");
  };

  const handleSaveEdit = async () => {
    if (!editingBulletin || !editedTitle.trim() || !editedContent.trim()) {
      alert("Title and content cannot be empty.");
      return;
    }
    try {
      const bulletinRef = doc(dbFirestore, "bulletins", editingBulletin.id);
      await updateDoc(bulletinRef, {
        title: editedTitle.trim(),
        content: editedContent.trim(),
      });
      alert("Bulletin updated successfully!");
      handleCancelEdit();
      fetchBulletins();
    } catch (error) {
      console.error("Error updating bulletin:", error);
      alert("Failed to update bulletin.");
    }
  };

  const applyFormatting = (tag: string, value?: string | number) => {
    const textarea = editingBulletin
      ? editTextareaRef.current
      : textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    if (!selectedText) return;

    let formattedText = selectedText;
    switch (tag) {
      case "bold":
        formattedText = `**${selectedText}**`;
        break;
      case "italic":
        formattedText = `*${selectedText}*`;
        break;
      case "underline":
        formattedText = `<u>${selectedText}</u>`;
        break;
      case "color":
        formattedText = `<span style="color: ${value};">${selectedText}</span>`;
        break;
      case "size":
        formattedText = `<span style="font-size: ${value}px;">${selectedText}</span>`;
        break;
      default:
        formattedText = selectedText;
    }

    const newValue =
      textarea.value.substring(0, start) +
      formattedText +
      textarea.value.substring(end);

    if (editingBulletin) {
      setEditedContent(newValue);
    } else {
      setNewBulletin(newValue);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + formattedText.length - selectedText.length,
        start + formattedText.length - selectedText.length
      );
    }, 0);
  };

  const renderContent = (content: string) => {
    return content
      ? content
          .replace(/\n/g, "<br />")
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
          .replace(/<u>(.*?)<\/u>/g, "<u>$1</u>")
          .replace(
            /<span style="color: (.*?);">(.*?)<\/span>/g,
            '<span style="color: $1;">$2</span>'
          )
          .replace(
            /<span style="font-size: (.*?)px;">(.*?)<\/span>/g,
            '<span style="font-size: $1px;">$2</span>'
          )
      : "No content";
  };

  return (
    <Layout>
      <div className="page-content p-6">
        <h1 className="text-2xl font-bold text-yellow-400 mb-6">
          Admin Bulletins
        </h1>

        {!editingBulletin && (
          <div className="mb-8 p-4 border border-gray-700 rounded bg-gray-800/50">
            <h2 className="text-xl font-semibold text-yellow-300 mb-4">
              Add New Bulletin
            </h2>
            <input
              type="text"
              className="w-full p-3 border border-gray-600 rounded bg-gray-700 text-white mb-4"
              placeholder="Enter bulletin title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <div className="flex flex-wrap gap-2 mb-2 items-center">
              <button
                onClick={() => applyFormatting("bold")}
                className="button-secondary text-xs px-2 py-1"
              >
                Bold
              </button>
              <button
                onClick={() => applyFormatting("italic")}
                className="button-secondary text-xs px-2 py-1"
              >
                Italic
              </button>
              <button
                onClick={() => applyFormatting("underline")}
                className="button-secondary text-xs px-2 py-1"
              >
                Underline
              </button>
              <label className="text-xs text-gray-400 ml-2">Color:</label>
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="h-6 w-10 border-none rounded bg-gray-600 cursor-pointer"
              />
              <button
                onClick={() => applyFormatting("color", selectedColor)}
                className="button-secondary text-xs px-2 py-1"
              >
                Apply Color
              </button>
              <label className="text-xs text-gray-400 ml-2">Size (px):</label>
              <input
                type="number"
                min="8"
                max="72"
                value={selectedFontSize}
                onChange={(e) => setSelectedFontSize(Number(e.target.value))}
                className="input input-xs w-16 text-center"
              />
              <button
                onClick={() => applyFormatting("size", selectedFontSize)}
                className="button-secondary text-xs px-2 py-1"
              >
                Apply Size
              </button>
            </div>
            <textarea
              ref={textareaRef}
              className="w-full p-3 border border-gray-600 rounded bg-gray-700 text-white resize-none overflow-hidden min-h-[100px]"
              placeholder="Enter bulletin content... (Markdown and HTML supported)"
              value={newBulletin}
              onChange={(e) => setNewBulletin(e.target.value)}
            />
            {submitError && (
              <p className="text-red-500 text-sm mt-2">{submitError}</p>
            )}
            <button onClick={handleAddBulletin} className="button-primary mt-3">
              Add Bulletin
            </button>
            <div className="mt-6 prose prose-yellow max-w-none bg-gray-900 p-4 rounded border border-gray-700">
              <h3 className="text-lg font-semibold text-yellow-400 mb-2">
                Preview:
              </h3>
              <h4 className="text-md font-bold text-yellow-300">
                {newTitle || "No Title"}
              </h4>
              <div
                dangerouslySetInnerHTML={{ __html: renderContent(newBulletin) }}
              />
            </div>
          </div>
        )}

        {editingBulletin && (
          <div className="mb-8 p-4 border border-yellow-500 rounded bg-gray-800">
            <h2 className="text-xl font-semibold text-yellow-300 mb-4">
              Edit Bulletin
            </h2>
            <input
              type="text"
              className="w-full p-3 border border-gray-600 rounded bg-gray-700 text-white mb-4"
              placeholder="Enter bulletin title..."
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
            />
            <div className="flex flex-wrap gap-2 mb-2 items-center">
              <button
                onClick={() => applyFormatting("bold")}
                className="button-secondary text-xs px-2 py-1"
              >
                Bold
              </button>
              <button
                onClick={() => applyFormatting("italic")}
                className="button-secondary text-xs px-2 py-1"
              >
                Italic
              </button>
              <button
                onClick={() => applyFormatting("underline")}
                className="button-secondary text-xs px-2 py-1"
              >
                Underline
              </button>
              <label className="text-xs text-gray-400 ml-2">Color:</label>
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="h-6 w-10 border-none rounded bg-gray-600 cursor-pointer"
              />
              <button
                onClick={() => applyFormatting("color", selectedColor)}
                className="button-secondary text-xs px-2 py-1"
              >
                Apply Color
              </button>
              <label className="text-xs text-gray-400 ml-2">Size (px):</label>
              <input
                type="number"
                min="8"
                max="72"
                value={selectedFontSize}
                onChange={(e) => setSelectedFontSize(Number(e.target.value))}
                className="input input-xs w-16 text-center"
              />
              <button
                onClick={() => applyFormatting("size", selectedFontSize)}
                className="button-secondary text-xs px-2 py-1"
              >
                Apply Size
              </button>
            </div>
            <textarea
              ref={editTextareaRef}
              className="w-full p-3 border border-gray-600 rounded bg-gray-700 text-white resize-none overflow-hidden min-h-[100px]"
              placeholder="Enter bulletin content..."
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
            />
            <div className="mt-3 flex gap-2">
              <button onClick={handleSaveEdit} className="button-primary">
                Save Changes
              </button>
              <button onClick={handleCancelEdit} className="button-secondary">
                Cancel
              </button>
            </div>
            <div className="mt-6 prose prose-yellow max-w-none bg-gray-900 p-4 rounded border border-gray-700">
              <h3 className="text-lg font-semibold text-yellow-400 mb-2">
                Preview:
              </h3>
              <h4 className="text-md font-bold text-yellow-300">
                {editedTitle || "No Title"}
              </h4>
              <div
                dangerouslySetInnerHTML={{
                  __html: renderContent(editedContent),
                }}
              />
            </div>
          </div>
        )}

        <h2 className="text-xl font-semibold text-yellow-300 mb-4 border-t border-gray-700 pt-4">
          Existing Bulletins
        </h2>
        {loading ? (
          <p className="text-gray-400">Loading bulletins...</p>
        ) : bulletins.length === 0 ? (
          <p className="text-gray-400">No bulletins available.</p>
        ) : (
          <div className="space-y-6">
            {bulletins.map((bulletin) => (
              <div
                key={bulletin.id}
                className="bg-gray-800 p-4 rounded border border-gray-700 relative group"
              >
                <h3 className="text-lg font-bold text-yellow-300 mb-2">
                  {bulletin.title}
                </h3>
                <div
                  className="prose prose-yellow max-w-none mb-3"
                  dangerouslySetInnerHTML={{
                    __html: renderContent(bulletin.content),
                  }}
                />
                <p className="text-xs text-gray-400 mt-2 border-t border-gray-700 pt-2">
                  Posted by{" "}
                  {formatDisplayRankName(
                    bulletin.postedByRank,
                    bulletin.postedByName
                  )}{" "}
                  on {formatTimestampForDisplay(bulletin.createdAt)}
                </p>
                {!editingBulletin && (
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartEdit(bulletin)}
                      className="bg-blue-600 hover:bg-blue-500 text-white p-1 rounded text-xs"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteBulletin(bulletin.id)}
                      className="bg-red-600 hover:bg-red-500 text-white p-1 rounded text-xs"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminBulletins;
