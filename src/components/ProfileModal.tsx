import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { getInitials } from '../utils/getInitials';
import { User } from '../types/User';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user }) => {
  const { updateUserProfilePhoto } = useAuth();
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (user?.photoURL) {
      setImageUrl(user.photoURL);
    } else {
      setImageUrl('');
    }
  }, [user, isOpen]);

  const userInitials = user?.name ? getInitials(user.name) : '?';

  const handleSaveLink = async () => {
    if (!imageUrl.trim()) {
      toast.error('Please enter an image URL.');
      return;
    }
    try {
      new URL(imageUrl);
    } catch (_) {
      toast.error('Please enter a valid image URL (e.g., https://example.com/image.png)');
      return;
    }

    setIsSaving(true);
    try {
      await updateUserProfilePhoto(imageUrl);
      toast.success('Profile picture updated successfully!');
      onClose();
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
            <AvatarImage src={imageUrl.trim() || user.photoURL || undefined} alt={user.name ?? 'User'} />
            <AvatarFallback className="text-3xl">{userInitials}</AvatarFallback>
          </Avatar>

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
