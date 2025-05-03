import React, { useState, useEffect } from 'react'; // Import React, useState, useEffect
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { doc, setDoc, updateDoc, serverTimestamp, collection, addDoc, getDocs, query, orderBy, limit, where } from 'firebase/firestore'; // Added where, limit to imports
import { db as dbFirestore } from '../../firebase';
import type { GangMember as ImportedGangMember } from '../../utils/ciuUtils'; // Correct import path for GangMember
import { User } from "../../types/User";
import { toast } from 'react-toastify';

// Use the imported type
type GangMember = ImportedGangMember;

// Update the props type definition to be more flexible
// Make props optional to accommodate different use cases (add/edit member vs. add gang)
type AddGangMemberModalProps = {
  currentUser: User;
  isOpen?: boolean; // Optional: Used for member modal visibility
  onClose?: () => void; // Optional: Used for member modal close
  onSuccess?: () => void; // Optional: Callback after member add/edit succeeds
  gangId?: string; // Optional: ID of the gang to add/edit member for
  memberToEdit?: GangMember | null; // Optional: Member data if editing
  onGangAdded?: (newGangId: string) => void; // Optional: Callback after adding a NEW GANG
};

// This component represents the form content within the modal
const AddGangMemberForm: React.FC<AddGangMemberModalProps> = (props) => {
  // Destructure currentUser first for null check
  const { currentUser } = props;

  if (!currentUser) {
    return <p className="text-center text-destructive">User not authenticated.</p>;
  }

  // Destructure the rest of the props - use defaults or handle undefined where necessary
  const {
    isOpen = false, // Default isOpen if not provided
    onClose = () => {}, // Default onClose if not provided
    onSuccess = () => {}, // Default onSuccess if not provided
    gangId, // Will be undefined when adding a gang
    memberToEdit, // Will be null/undefined when adding a gang or member
    onGangAdded, // Will be defined when adding a gang
  } = props;

  // Determine mode based on props (simplistic check)
  const isAddingGangMode = !!onGangAdded && !gangId && !memberToEdit;

  // State for form fields - adjust based on mode if necessary
  const [name, setName] = useState(''); // Used for Member Name or Gang Name
  const [rank, setRank] = useState(''); // Used for Member Job
  const [phoneNumber, setPhoneNumber] = useState(''); // Used for Member Phone
  const [notes, setNotes] = useState(''); // Used for Member Notes or Gang Notes
  const [description, setDescription] = useState(''); // Added state for Gang Description (only used in Add Gang mode)
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Logic to populate form based on mode
    if (!isAddingGangMode && memberToEdit) {
      // Populate form for editing a member
      setName(memberToEdit.name);
      setRank(memberToEdit.rankInGang || ''); // Handle potential undefined
      setPhoneNumber(memberToEdit.phoneNumber || '');
      setNotes(memberToEdit.notes || '');
      setDescription(''); // Not used in edit member mode
    } else {
      // Reset form for adding a new member or a new gang
      setName('');
      setRank('');
      setPhoneNumber('');
      setNotes('');
      setDescription(''); // Reset description as well
    }
    // Adjust dependencies if needed, ensure isOpen reset works if applicable
  }, [memberToEdit, isOpen, isAddingGangMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isAddingGangMode) {
        // --- Logic to add a NEW GANG ---
        if (!name.trim()) {
            toast.error("Gang Name is required.");
            setLoading(false);
            return;
        }
        try {
            const gangsColRef = collection(dbFirestore, 'gangs');
            const newGangDoc = await addDoc(gangsColRef, {
                name: name.trim(),
                description: description.trim(), // Add description
                notes: notes.trim(), // Use 'notes' state for the 'notes' field
                level: 1, // Default level
                createdAt: serverTimestamp(),
                createdBy: currentUser.id || 'Unknown',
                createdByName: currentUser.name || 'Unknown',
                // Initialize other fields if necessary
                clothingInfo: '',
                locationInfo: '',
                vehiclesInfo: '',
                photoUrl: '',
            });
            toast.success(`Gang "${name.trim()}" added successfully.`);
            if (onGangAdded) {
                onGangAdded(newGangDoc.id); // Call the callback with the new gang ID
            }
            // onClose(); // Close might be handled differently for this mode
        } catch (error) {
            console.error("Error adding new gang:", error);
            toast.error("Failed to add new gang.");
        }

    } else if (gangId) {
        // --- Logic to add/edit a MEMBER (existing logic) ---
        if (!name.trim()) { // Changed: Only name is required
          toast.error("Name is required.");
          setLoading(false);
          return;
        }
        try {
          // Prepare base member data
          const memberData: Partial<GangMember> = {
            gangId,
            name: name.trim(),
            rankInGang: rank.trim() || null, // Store as null if empty string
            phoneNumber: phoneNumber.trim() || null,
            notes: notes.trim() || '',
          };

          if (memberToEdit) {
            // Update existing member
            const memberRef = doc(dbFirestore, 'gangMembers', memberToEdit.id);
            await updateDoc(memberRef, memberData); // Only update the fields in memberData
            toast.success("Member updated successfully.");
          } else {
            // Add new member
            const membersColRef = collection(dbFirestore, 'gangMembers');
            // Get the current highest sortOrder for this gang - ensure 'where' and 'limit' are imported
            const q = query(membersColRef, where('gangId', '==', gangId), orderBy("sortOrder", "desc"), limit(1));
            const lastMemberSnap = await getDocs(q);
            const nextSortOrder = lastMemberSnap.empty ? 0 : (lastMemberSnap.docs[0].data().sortOrder ?? -1) + 1; // Use -1 default if sortOrder is missing

            const memberRef = doc(membersColRef); // Auto-generate ID
            await setDoc(memberRef, {
              ...memberData, // Spread the base data
              addedAt: serverTimestamp(),
              addedBy: currentUser.id || 'Unknown', // Use ID or email
              addedById: currentUser.id || 'Unknown', // Use ID or email
              addedByName: currentUser.name || 'Unknown',
              sortOrder: nextSortOrder, // Assign the next sort order
            });
            toast.success("Member added successfully.");
          }
          onSuccess(); // Call member success callback
          // onClose(); // Closing handled by Dialog's onOpenChange
        } catch (error) {
          console.error("Error saving member:", error);
          toast.error(`Failed to ${memberToEdit ? 'update' : 'add'} member.`);
        }
    } else {
        // Handle unexpected state
        toast.error("Configuration error: Cannot determine action.");
        console.error("AddGangMemberForm: Cannot determine mode (add gang vs add/edit member). Props:", props);
    }

    setLoading(false);
  };

  // Render the Dialog conditionally if used as a modal, or just the form if used directly
  if (!isAddingGangMode) {
    // Render MEMBER add/edit form inside the Dialog
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px] bg-card border border-border rounded-lg text-foreground shadow-lg">
          <DialogHeader>
            {/* Use direct yellow color for title */}
            <DialogTitle className="text-xl font-semibold text-[#f3c700] mb-5 border-b border-border pb-2">{memberToEdit ? 'Edit Member' : 'Add New Member'}</DialogTitle>
            <DialogDescription className="text-muted-foreground -mt-4">
              {memberToEdit ? 'Update the details for this member.' : 'Enter the details for the new member.'}
            </DialogDescription>
          </DialogHeader>
          {/* Form for MEMBER */}
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name Input */}
                  <div className="space-y-2">
                      {/* Use theme label style */}
                      <Label htmlFor="name" className="block text-xs font-medium text-foreground/80">Name *</Label>
                      {/* Use theme input style */}
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="bg-input border-border text-foreground placeholder:text-muted-foreground" placeholder="Enter member's full name"/>
                  </div>
                  {/* Job Input */}
                  <div className="space-y-2">
                      <Label htmlFor="job" className="block text-xs font-medium text-foreground/80">Job</Label> {/* Changed label, removed asterisk */}
                      <Input id="job" value={rank} onChange={(e) => setRank(e.target.value)} className="bg-input border-border text-foreground placeholder:text-muted-foreground" placeholder="Enter job title (Optional)"/> {/* Removed required */}
                  </div>
                  {/* Phone Number Input */}
                  <div className="space-y-2">
                      <Label htmlFor="phoneNumber" className="block text-xs font-medium text-foreground/80">Phone Number</Label>
                      <Input id="phoneNumber" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="bg-input border-border text-foreground placeholder:text-muted-foreground" placeholder="e.g., 123-456-7890 (Optional)"/>
                  </div>
                  {/* Notes Textarea */}
                  <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="notes" className="block text-xs font-medium text-foreground/80">Notes</Label>
                      <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="bg-input border-border text-foreground placeholder:text-muted-foreground" placeholder="Any relevant notes about the member (Optional)"/>
                  </div>
             </div>
            <DialogFooter className="mt-6 border-t border-border pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={loading} className="border-border text-muted-foreground hover:bg-muted/50">Cancel</Button>
              </DialogClose>
              {/* Use direct yellow color for primary button */}
              <Button type="submit" disabled={loading} className="bg-[#f3c700] hover:bg-[#f3c700]/90 text-black">
                {loading ? (memberToEdit ? 'Updating...' : 'Adding...') : (memberToEdit ? 'Save Changes' : 'Add Member')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  } else {
     // Render GANG add form directly (not in a Dialog)
     return (
        <div className="p-6 border border-border rounded-lg bg-card text-foreground">
            {/* Use direct yellow color for title */}
            <h2 className="text-xl font-semibold text-[#f3c700] border-b border-border pb-2 mb-4">Add New Gang</h2>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                {/* Gang Name Input */}
                <div className="space-y-2">
                    <Label htmlFor="gangName" className="block text-xs font-medium text-foreground/80">Gang Name *</Label>
                    <Input
                        id="gangName"
                        value={name} // Reusing 'name' state for Gang Name
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-[#f3c700]" // Theme input style + focus ring
                        placeholder="Enter the official gang name"
                    />
                </div>
                {/* Gang Description Input */}
                <div className="space-y-2">
                    <Label htmlFor="gangDescription" className="block text-xs font-medium text-foreground/80">Description</Label>
                    <Input
                        id="gangDescription"
                        value={description} // Use 'description' state
                        onChange={(e) => setDescription(e.target.value)}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-[#f3c700]" // Theme input style + focus ring
                        placeholder="Short description (e.g., MC in Paleto)"
                    />
                </div>
                {/* Gang Notes Input */}
                <div className="space-y-2">
                    <Label htmlFor="gangNotes" className="block text-xs font-medium text-foreground/80">General Notes</Label>
                    <Textarea
                        id="gangNotes"
                        value={notes} // Use 'notes' state for Gang Notes
                        onChange={(e) => setNotes(e.target.value)}
                        rows={4}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-[#f3c700]" // Theme input style + focus ring
                        placeholder="General notes about the gang (Optional)"
                    />
                </div>
                <div className="flex justify-end gap-4 mt-4">
                    {/* Use direct yellow color for primary button */}
                    <Button type="submit" disabled={loading} className="bg-[#f3c700] hover:bg-[#f3c700]/90 text-black">
                        {loading ? 'Adding Gang...' : 'Add Gang'}
                    </Button>
                </div>
            </form>
        </div>
     );
  }
};

export default AddGangMemberForm;

