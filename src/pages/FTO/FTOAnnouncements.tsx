import React, { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import { RosterUser, FTOAnnouncement } from '../../types/User';
import TipTapEditor from '../../components/TipTapEditor';
import { formatTimestampForDisplay } from '../../utils/timeHelpers';

interface FTOAnnouncementsProps {
  authUser: RosterUser | null;
  announcements: FTOAnnouncement[];
  canManageAnnouncements: boolean;
  loadingAnnouncements: boolean;
  errorAnnouncements: string | null;
  onAddAnnouncement: (title: string, content: string) => Promise<void>;
  onDeleteAnnouncement: (announcementId: string) => void;
  onSaveEditAnnouncement: (announcement: FTOAnnouncement) => Promise<void>;
}

const FTOAnnouncements: React.FC<FTOAnnouncementsProps> = ({
  authUser,
  announcements,
  canManageAnnouncements,
  loadingAnnouncements,
  errorAnnouncements,
  onAddAnnouncement,
  onDeleteAnnouncement,
  onSaveEditAnnouncement,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEditing, setCurrentEditing] = useState<FTOAnnouncement | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const handleStartAdd = () => {
    setIsAdding(true);
    setIsEditing(false);
    setCurrentEditing(null);
    setNewTitle("");
    setNewContent("");
  };

  const handleStartEdit = (ann: FTOAnnouncement) => {
    setIsEditing(true);
    setIsAdding(false);
    setCurrentEditing({ ...ann }); // Create a copy to edit
    setNewTitle(ann.title); // Pre-fill for TipTapEditor if needed, though TipTap uses content prop
    setNewContent(ann.content);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setIsEditing(false);
    setCurrentEditing(null);
    setNewTitle("");
    setNewContent("");
  };

  const handleSaveAdd = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error("Title and content cannot be empty.");
      return;
    }
    await onAddAnnouncement(newTitle, newContent);
    handleCancel(); // Reset form on success (parent handles toast)
  };

  const handleSaveEdit = async () => {
    if (!currentEditing || !currentEditing.id) return;
    if (!currentEditing.title.trim() || !currentEditing.content.trim()) {
      toast.error("Title and content cannot be empty.");
      return;
    }
    await onSaveEditAnnouncement(currentEditing);
    handleCancel(); // Reset form on success (parent handles toast)
  };

  const handleContentChange = (content: string) => {
    if (isAdding) {
      setNewContent(content);
    } else if (isEditing && currentEditing) {
      setCurrentEditing(prev => prev ? { ...prev, content: content } : null);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (isAdding) {
      setNewTitle(e.target.value);
    } else if (isEditing && currentEditing) {
      setCurrentEditing(prev => prev ? { ...prev, title: e.target.value } : null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-white/20 pb-2">
        <h2 className="text-xl font-semibold text-[#f3c700]">FTO Announcements</h2>
        {canManageAnnouncements && !isAdding && !isEditing && (
          <button onClick={handleStartAdd} className="button-secondary text-sm">Add Announcement</button>
        )}
      </div>

      {(isAdding || isEditing) && canManageAnnouncements && (
        <div className={`p-4 bg-black/60 rounded-lg border ${isEditing ? 'border-[#f3c700]' : 'border-white/20'} space-y-4`}>
          <h3 className="text-lg font-semibold text-[#f3c700]">{isEditing ? 'Edit Announcement' : 'New Announcement'}</h3>
          <input
            type="text"
            placeholder="Announcement Title"
            value={isEditing ? currentEditing?.title : newTitle}
            onChange={handleTitleChange}
            className="input w-full bg-black/40 border-white/20 text-white"
          />
          <TipTapEditor
            content={isEditing ? currentEditing?.content || '' : newContent}
            onChange={handleContentChange}
            editorClassName="bg-black/40 border border-white/20 rounded p-2 text-white min-h-[150px]"
          />
          <div className="flex justify-end gap-3 mt-3">
            <button onClick={handleCancel} className="button-secondary">Cancel</button>
            <button onClick={isEditing ? handleSaveEdit : handleSaveAdd} className="button-primary">
              {isEditing ? 'Save Changes' : 'Post Announcement'}
            </button>
          </div>
        </div>
      )}

      {loadingAnnouncements && <p className="text-[#f3c700]">Loading announcements...</p>}
      {errorAnnouncements && <p className="text-red-500">{errorAnnouncements}</p>}
      {!loadingAnnouncements && announcements.length === 0 && !isAdding && !isEditing && (
        <p className="text-white/60 italic">No announcements posted yet.</p>
      )}
      {!loadingAnnouncements && announcements.length > 0 && (
        <div className="space-y-4">
          {announcements.map((ann) => (
            (isEditing && currentEditing?.id === ann.id) ? null : ( // Hide original while editing
              <div key={ann.id} className="p-4 bg-black/60 rounded-lg border border-white/20 relative group">
                {canManageAnnouncements && !isAdding && !isEditing && (
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                    <button onClick={() => handleStartEdit(ann)} className="text-xs text-yellow-400 hover:text-yellow-300 p-1 bg-black/50 rounded" title="Edit Announcement"><FaPencilAlt /></button>
                    <button onClick={() => onDeleteAnnouncement(ann.id)} className="text-xs text-red-500 hover:text-red-400 p-1 bg-black/50 rounded" title="Delete Announcement"><FaTrash /></button>
                  </div>
                )}
                <h3 className="text-lg font-bold text-[#f3c700] pr-16 mb-2">{ann.title}</h3>
                <div className="prose prose-sm prose-invert max-w-none text-white/80" dangerouslySetInnerHTML={{ __html: ann.content }} />
                <p className="text-xs text-white/60 mt-3 pt-2 border-t border-white/10">
                  Posted by {ann.authorRank} {ann.authorName} on {formatTimestampForDisplay(ann.createdAt)}
                </p>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
};

export default FTOAnnouncements;
