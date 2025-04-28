import React, { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription, // Import DialogDescription
    DialogFooter,
} from '../ui/dialog'; // Ensure DialogTitle and DialogDescription are imported
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'; // Import VisuallyHidden
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { XIcon, SearchIcon, Users, UserPlus, Loader2, MessageSquarePlus } from 'lucide-react'; // XIcon import can be removed if not used elsewhere
import { User } from '../../types/User';
import { formatUserName, getAvatarFallback } from './utils';
import { toast } from 'react-toastify';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'; // Import Tabs components

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateGroup: (name: string, memberCids: string[]) => Promise<void>;
    onStartDirectChat: (memberCid: string) => void; // Add prop for starting direct chat
    personnel: User[];
    currentUserCid?: string;
}


const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
    isOpen,
    onClose,
    onCreateGroup,
    onStartDirectChat, // Destructure new prop
    personnel,
    currentUserCid,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [isCreating, setIsCreating] = useState(false);
    const [activeTab, setActiveTab] = useState<'group' | 'direct'>('direct'); // Default to direct

    // Filter out the current user from the selection list if currentUserCid is provided
    const availablePersonnel = useMemo(() => {
        const lowerSearchTerm = searchTerm.toLowerCase();
        return personnel
            .filter(user => user.cid !== currentUserCid) // Exclude current user
            .filter(user => formatUserName(user).toLowerCase().includes(lowerSearchTerm))
            .sort((a, b) => formatUserName(a).localeCompare(formatUserName(b)));
    }, [personnel, currentUserCid, searchTerm]);


    const handleMemberToggle = (cid: string) => {
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


    const handleCreate = async () => {
        if (!groupName.trim()) {
            toast.warn("Group name cannot be empty.");
            return;
        }
        if (selectedMembers.size === 0) {
            toast.warn("Please select at least one member.");
            return;
        }

        setIsCreating(true);
        try {
            await onCreateGroup(groupName, Array.from(selectedMembers));
            // Reset state on successful creation (optional, as modal closes)
            setGroupName('');
            setSelectedMembers(new Set());
            setSearchTerm('');
            // onClose(); // onClose is called by the parent component on success
        } catch (error) {
            // Error is handled by the parent, toast is shown there
            console.error("CreateGroupModal: Failed to create group", error);
        } finally {
            setIsCreating(false);
        }
    };

    // Handler for starting a direct chat
    const handleDirectChat = (memberCid: string) => {
        onStartDirectChat(memberCid);
        // Optionally reset search and close modal if desired,
        // but typically handled by parent logic after chat selection
        setSearchTerm('');
        // onClose(); // Let parent handle closing
    };


    // Reset state when modal opens or closes
    React.useEffect(() => {
        if (!isOpen) {
            setGroupName('');
            setSelectedMembers(new Set());
            setSearchTerm('');
            setIsCreating(false);
            setActiveTab('direct'); // Reset tab
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                className={
                    "sm:max-w-[500px] bg-card border-border text-foreground p-0 " +
                    // Update class to hide the default Dialog close button using data-slot
                    "[&_[data-slot=dialog-close]]:hidden" // More specific selector
                }
            >
                <DialogHeader className="p-6 pb-4 border-b border-border">
                    <DialogTitle className="text-lg font-semibold">
                        {activeTab === 'group' ? 'Create New Group Chat' : 'Start New Chat'}
                    </DialogTitle>
                    <DialogDescription>
                        {activeTab === 'group' ? 'Select members and name your group.' : 'Select a user to start a direct message.'}
                    </DialogDescription>

                    {/* REMOVED Close Button */}
                    {/*
                    <DialogClose asChild>
                        <Button variant="ghost" size="icon" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
                            <XIcon className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                        </Button>
                    </DialogClose>
                    */}
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'group' | 'direct')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="direct">
                            <UserPlus className="mr-2 h-4 w-4" /> Direct Message
                        </TabsTrigger>
                        <TabsTrigger value="group">
                            <MessageSquarePlus className="mr-2 h-4 w-4" /> New Group
                        </TabsTrigger>
                    </TabsList>

                    {/* Search Input - Common for both tabs */}
                    <div className="relative mb-4">
                        <span className="absolute inset-y-0 left-3 flex items-center">
                            <SearchIcon className="h-4 w-4 text-muted-foreground" />
                        </span>
                        <Input
                            placeholder="Search personnel..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-primary h-9 rounded-md"
                            disabled={isCreating}
                        />
                    </div>

                    <TabsContent value="direct">
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-lg font-semibold">Start Direct Message</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-[300px] border border-border rounded-md p-2 mb-4">
                            {availablePersonnel.length === 0 ? (
                                <p className="text-muted-foreground italic text-sm text-center py-4">No personnel found.</p>
                            ) : (
                                availablePersonnel.map(user => (
                                    user.cid ? (
                                        <Button
                                            key={user.id}
                                            variant="ghost"
                                            className="w-full flex items-center justify-start space-x-3 p-2 hover:bg-muted rounded h-auto"
                                            onClick={() => handleDirectChat(user.cid!)}
                                            disabled={isCreating}
                                        >
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={user.photoURL || undefined} alt={formatUserName(user)} />
                                                <AvatarFallback>{getAvatarFallback(user)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm text-foreground truncate">{formatUserName(user)}</span>
                                        </Button>
                                    ) : null // Skip rendering if user.cid is missing
                                ))
                            )}
                        </ScrollArea>
                        {/* No footer needed for direct message tab */}
                    </TabsContent>

                    <TabsContent value="group">
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-lg font-semibold">Create New Group</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="groupName">Group Name</Label>
                                <Input
                                    id="groupName"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="Enter group name..."
                                    disabled={isCreating}
                                    className="bg-input border-border"
                                />
                            </div>

                            <Label className="mb-2 shrink-0">Select Members ({selectedMembers.size})</Label>
                            <ScrollArea className="h-[250px] border border-border rounded-md p-2 mb-4">
                                {availablePersonnel.length === 0 ? (
                                    <p className="text-muted-foreground italic text-sm text-center py-4">No personnel available to add.</p>
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
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={user.photoURL || undefined} alt={formatUserName(user)} />
                                                    <AvatarFallback>{getAvatarFallback(user)}</AvatarFallback>
                                                </Avatar>
                                                <Label htmlFor={`member-${user.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate">
                                                    {formatUserName(user)}
                                                </Label>
                                            </div>
                                        ) : null // Skip rendering if user.cid is missing
                                    ))
                                )}
                            </ScrollArea>
                        </div>
                        <DialogFooter className="mt-4">
                            <Button variant="outline" onClick={onClose} disabled={isCreating}>Cancel</Button>
                            <Button
                                onClick={handleCreate}
                                disabled={isCreating || !groupName.trim() || selectedMembers.size === 0}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                            >
                                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Create Group
                            </Button>
                        </DialogFooter>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default CreateGroupModal;
