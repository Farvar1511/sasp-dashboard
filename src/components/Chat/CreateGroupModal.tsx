import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { toast } from 'react-toastify';
import { formatUserName, getAvatarFallback } from '../Chat/utils'; // Assuming utils file exists or move functions here
import { User } from '../../types/User';

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateGroup: (name: string, selectedMemberCids: string[]) => Promise<void>;
    onStartDirectChat: (memberCid: string) => void; // Add new prop for direct chat
    personnel: User[];
    currentUserCid?: string;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
    isOpen,
    onClose,
    onCreateGroup,
    onStartDirectChat, // Destructure new prop
    personnel,
    currentUserCid
}) => {
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [isCreating, setIsCreating] = useState(false);

    // Determine if it's a direct chat based on selection
    const isDirectChatMode = selectedMembers.size === 1;

    // Reset state when modal opens or closes
    useEffect(() => {
        if (isOpen) {
            setGroupName('');
            setSelectedMembers(new Set());
            setIsCreating(false);
        }
    }, [isOpen]);


    if (!isOpen) return null;

    const handleMemberToggle = (cid: string) => { // Use CID directly
        setSelectedMembers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(cid)) {
                newSet.delete(cid);
            } else {
                newSet.add(cid);
            }
            return newSet;
        });
    };

    const handleCreateClick = async () => {
        const memberList = Array.from(selectedMembers);

        if (isDirectChatMode) {
            // --- Direct Chat Logic ---
            const targetCid = memberList[0];
            setIsCreating(true);
            try {
                onStartDirectChat(targetCid); // Call the direct chat handler
                // No need to reset state here, useEffect on isOpen handles it
                onClose(); // Close the modal
            } catch (error) {
                console.error("Error starting direct chat:", error);
                // Optionally show toast error
            } finally {
                setIsCreating(false); // Ensure loading state is reset
            }

        } else if (memberList.length > 1) {
            // --- Group Chat Logic ---
            if (!groupName.trim()) {
                toast.warn("Please enter a group name.");
                return;
            }
            setIsCreating(true);
            // Ensure the current user is always included in groups
            if (currentUserCid && !memberList.includes(currentUserCid)) {
                memberList.push(currentUserCid);
            }
            try {
                await onCreateGroup(groupName.trim(), memberList);
                // State reset is handled by useEffect on isOpen change now
                // onClose(); // Parent calls onClose on success
            } catch (error) {
                // Error handled in parent
            } finally {
                setIsCreating(false); // Ensure loading state is reset even on error
            }
        } else {
             // --- No members selected ---
             toast.warn("Please select at least one member.");
             return;
        }
    };

    // Filter out the current user from the selection list if currentUserCid is provided
    const availablePersonnel = currentUserCid
        ? personnel.filter(p => p.cid !== currentUserCid)
        : personnel;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card p-6 rounded-lg shadow-xl w-full max-w-md border border-border flex flex-col max-h-[80vh]">
                {/* Title changes based on mode */}
                <h2 className="text-xl font-semibold mb-4 shrink-0">
                    {isDirectChatMode ? "Start Direct Message" : "Create Group Chat"}
                </h2>

                {/* Conditionally render Group Name input */}
                {!isDirectChatMode && (
                    <div className="space-y-2 mb-4 shrink-0">
                        <Label htmlFor="groupName">Group Name</Label>
                        <Input
                            id="groupName"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Enter group name..."
                            disabled={isCreating}
                        />
                    </div>
                )}

                <Label className="mb-2 shrink-0">Select Members ({selectedMembers.size})</Label>
                <ScrollArea className="flex-grow border border-border rounded-md p-2 mb-4">
                    {availablePersonnel.length === 0 ? (
                        <p className="text-muted-foreground italic text-sm">No personnel available to add.</p>
                    ) : (
                        availablePersonnel.map(user => (
                            // Ensure user.cid exists before rendering
                            user.cid ? (
                                <div key={user.id} className="flex items-center space-x-3 p-2 hover:bg-muted rounded">
                                    <Checkbox
                                        id={`member-${user.id}`}
                                        checked={selectedMembers.has(user.cid)} // Check using CID
                                        onCheckedChange={() => handleMemberToggle(user.cid!)} // Toggle using CID
                                        disabled={isCreating}
                                    />
                                    <Label htmlFor={`member-${user.id}`} className="flex items-center cursor-pointer flex-grow">
                                        <Avatar className="h-6 w-6 mr-2">
                                            <AvatarImage src={user.photoURL || undefined} alt={formatUserName(user)} />
                                            <AvatarFallback>{getAvatarFallback(user)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">{formatUserName(user)}</span>
                                    </Label>
                                </div>
                            ) : null // Don't render if user has no CID
                        ))
                    )}
                </ScrollArea>

                <div className="flex justify-end space-x-2 mt-auto shrink-0">
                    <Button variant="outline" onClick={onClose} disabled={isCreating}>Cancel</Button>
                    {/* Button text and action changes based on mode */}
                    <Button onClick={handleCreateClick} disabled={isCreating || selectedMembers.size === 0}>
                        {isCreating
                            ? (isDirectChatMode ? 'Starting...' : 'Creating...')
                            : (isDirectChatMode ? 'Start Chat' : 'Create Group')
                        }
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CreateGroupModal;
