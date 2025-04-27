import React, { useState } from 'react';
import { User } from '../../types/User';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { toast } from 'react-toastify';
import { formatUserName, getAvatarFallback } from '../Chat/utils'; // Assuming utils file exists or move functions here

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    personnel: User[];
    currentUserEmail: string | null | undefined; // Pass current user's email
    onCreate: (name: string, members: string[]) => Promise<void>;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
    isOpen,
    onClose,
    personnel,
    currentUserEmail,
    onCreate
}) => {
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [isCreating, setIsCreating] = useState(false);

    if (!isOpen) return null;

    const handleMemberToggle = (email: string) => {
        setSelectedMembers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(email)) {
                newSet.delete(email);
            } else {
                newSet.add(email);
            }
            return newSet;
        });
    };

    const handleCreateClick = async () => {
        if (!groupName.trim()) {
            toast.warn("Please enter a group name.");
            return;
        }
        if (selectedMembers.size === 0) {
            toast.warn("Please select at least one member.");
            return;
        }

        setIsCreating(true);
        const memberList = Array.from(selectedMembers);
        // Ensure the current user is always included
        if (currentUserEmail && !memberList.includes(currentUserEmail)) {
            memberList.push(currentUserEmail);
        }

        try {
            await onCreate(groupName.trim(), memberList);
            // Reset state on success before closing
            setGroupName('');
            setSelectedMembers(new Set());
            onClose(); // Close is handled by onCreate in the parent now
        } catch (error) {
            // Error is handled by onCreate in the parent
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card p-6 rounded-lg shadow-xl w-full max-w-md border border-border flex flex-col max-h-[80vh]">
                <h2 className="text-xl font-semibold mb-4 shrink-0">Create Group Chat</h2>

                <div className="space-y-4 mb-4 shrink-0">
                    <Label htmlFor="groupName">Group Name</Label>
                    <Input
                        id="groupName"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Enter group name..."
                        disabled={isCreating}
                    />
                </div>

                <Label className="mb-2 shrink-0">Select Members ({selectedMembers.size})</Label>
                <ScrollArea className="flex-grow border border-border rounded-md p-2 mb-4">
                    {personnel.length === 0 ? (
                        <p className="text-muted-foreground italic text-sm">No personnel available to add.</p>
                    ) : (
                        personnel.map(user => (
                            <div key={user.id} className="flex items-center space-x-3 p-2 hover:bg-muted rounded">
                                <Checkbox
                                    id={`member-${user.id}`}
                                    checked={selectedMembers.has(user.email || '')}
                                    onCheckedChange={() => user.email && handleMemberToggle(user.email)}
                                    disabled={isCreating || !user.email}
                                />
                                <Label htmlFor={`member-${user.id}`} className="flex items-center cursor-pointer flex-grow">
                                    <Avatar className="h-6 w-6 mr-2">
                                        <AvatarImage src={user.photoURL || undefined} alt={formatUserName(user)} />
                                        <AvatarFallback>{getAvatarFallback(user)}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm">{formatUserName(user)}</span>
                                </Label>
                            </div>
                        ))
                    )}
                </ScrollArea>

                <div className="flex justify-end space-x-2 mt-auto shrink-0">
                    <Button variant="outline" onClick={onClose} disabled={isCreating}>Cancel</Button>
                    <Button onClick={handleCreateClick} disabled={isCreating || personnel.length === 0}>
                        {isCreating ? 'Creating...' : 'Create Group'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CreateGroupModal;
