import React, { useState, useEffect } from 'react'; // Removed useRef, added useEffect
import { useAuth } from '../context/AuthContext';
// Removed storage, ref, uploadBytesResumable, getDownloadURL imports
import { toast } from 'react-toastify';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input'; // Keep Input for text input
// Removed Progress import
import { getInitials } from '../utils/getInitials';
import { User } from '../types/User';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User; // Pass the user object
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user }) => {
  const { updateUserProfilePhoto } = useAuth();
  // Removed file-related state
  const [imageUrl, setImageUrl] = useState<string>(''); // State for the image URL input
  const [isSaving, setIsSaving] = useState<boolean>(false); // State for saving process

  // Pre-fill input with current photoURL when modal opens or user changes
  useEffect(() => {
    if (user?.photoURL) {
      setImageUrl(user.photoURL);
    } else {
      setImageUrl(''); // Clear if no current photoURL
    }
  }, [user, isOpen]); // Re-run if user or isOpen changes

  const userInitials = user?.name ? getInitials(user.name) : '?';

  const handleSaveLink = async () => {
    if (!imageUrl.trim()) {
      toast.error('Please enter an image URL.');
      return;
    }
    // Basic URL validation (optional but recommended)
    try {
      new URL(imageUrl); // Check if it's a valid URL structure
    } catch (_) {
      toast.error('Please enter a valid image URL (e.g., https://example.com/image.png)');
      return;
    }

    setIsSaving(true);
    try {
      await updateUserProfilePhoto(imageUrl);
      toast.success('Profile picture updated successfully!');
      onClose(); // Close modal on success
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error(`Failed to update profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card text-card-foreground p-6 rounded-lg shadow-xl w-full max-w-md border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4 text-center">Update Profile Picture</h2>

        <div className="flex flex-col items-center space-y-4">
          <Avatar className="h-24 w-24 mb-4 ring-2 ring-offset-2 ring-offset-card ring-primary">
            {/* Preview the entered URL if it's valid, otherwise show current/fallback */}
            <AvatarImage src={imageUrl.trim() || user.photoURL || undefined} alt={user.name ?? 'User'} />
            <AvatarFallback className="text-3xl">{userInitials}</AvatarFallback>
          </Avatar>

          {/* Add text input for URL */}
          <div className="w-full px-4">
             <label htmlFor="imageUrlInput" className="block text-sm font-medium text-muted-foreground mb-1">
                Image URL
             </label>
             <Input
                id="imageUrlInput"
                type="text"
                placeholder="https://example.com/image.png"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                disabled={isSaving}
                className="w-full"
             />
          </div>


          <div className="flex w-full justify-end space-x-3 pt-4 border-t border-border mt-4">
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            {/* Update Save button logic and state */}
            <Button onClick={handleSaveLink} disabled={!imageUrl.trim() || isSaving}>
              {isSaving ? 'Saving...' : 'Save Picture'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
