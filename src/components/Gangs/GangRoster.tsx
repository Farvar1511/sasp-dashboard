import React, { useState, useEffect, useRef, useCallback } from 'react'; // Import React
import { collection, query, where, getDocs, orderBy, Timestamp, serverTimestamp, addDoc, deleteDoc, doc, writeBatch, updateDoc, limit } from 'firebase/firestore'; // Added limit
import { db as dbFirestore } from '../../firebase';
import { GangMember as ImportedGangMember } from '../../utils/ciuUtils'; // Import the updated type
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import AddGangMemberForm from './AddGangMemberModal'; // Import the refactored form component
import { formatTimestampDateTime } from '../../utils/timeHelpers';
import { FaEdit, FaTrash, FaPlus, FaUpload } from 'react-icons/fa';
import { FaGripVertical } from 'react-icons/fa6';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import Papa from 'papaparse';
import { Skeleton } from '../ui/skeleton';
import { DndProvider, useDrag, useDrop, XYCoord } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Identifier } from 'dnd-core';
import { cn } from '../../lib/utils'; // Ensure cn is imported

// Use the imported type
type GangMember = ImportedGangMember;

// Simplify props: Only need gangId
interface GangRosterProps {
  gangId: string; // Required: For displaying members of a specific gang
}

const ItemTypes = {
  ROW: 'row',
};

interface DraggableMemberRowProps {
    member: GangMember;
    index: number;
    moveRow: (dragIndex: number, hoverIndex: number) => void;
    isImporting: boolean;
    openEditModal: (member: GangMember) => void;
    handleDeleteMember: (memberId: string) => void;
    triggerFirestoreUpdate: () => void;
}

const DraggableMemberRow: React.FC<DraggableMemberRowProps> = ({
    member,
    index,
    moveRow,
    isImporting,
    openEditModal,
    handleDeleteMember,
    triggerFirestoreUpdate,
}) => {
  const ref = useRef<HTMLTableRowElement>(null);

  const [{ handlerId }, drop] = useDrop<
    { id: string; index: number },
    void,
    { handlerId: Identifier | null }
  >({
    accept: ItemTypes.ROW,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: { id: string; index: number }, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      moveRow(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    drop() {
        triggerFirestoreUpdate();
    }
  });

  const [{ isDragging }, drag, preview] = useDrag({
    type: ItemTypes.ROW,
    item: () => {
      return { id: member.id, index };
    },
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  const opacity = isDragging ? 0.4 : 1;

  return (
    <TableRow
      ref={preview(ref) as React.Ref<HTMLTableRowElement>}
      style={{ opacity }}
      key={member.id}
      className={cn(
          // Use black background, adjust hover and dragging styles
          `border-b border-border hover:bg-gray-800/95 ${isDragging ? 'bg-gray-700/95 cursor-grabbing' : 'bg-black/95 cursor-grab'}`
      )}
      data-handler-id={handlerId}
    >
      <TableCell className="touch-none px-2 py-2">
        {/* Use theme muted text color */}
        <FaGripVertical className="h-5 w-5 text-muted-foreground" />
      </TableCell>
      {/* Use theme table cell styling: px-4 py-2 */}
      <TableCell className="font-medium text-foreground px-4 py-2">{member.name}</TableCell>
      <TableCell className="text-foreground/80 px-4 py-2">{member.rankInGang || '-'}</TableCell>
      <TableCell className="text-foreground/80 px-4 py-2">{member.phoneNumber || '-'}</TableCell>
      <TableCell className="truncate max-w-[200px] text-foreground/80 px-4 py-2" title={member.notes || undefined}>{member.notes || '-'}</TableCell>
      <TableCell className="text-xs text-muted-foreground px-4 py-2">
        {formatTimestampDateTime(member.addedAt)} {/* Display addedAt */}
      </TableCell>
      <TableCell className="text-center px-4 py-2">
        {/* Use theme-style icon buttons */}
        <Button
            variant="ghost" size="icon"
            onClick={() => openEditModal(member)}
            className="text-accent hover:text-accent/80 h-7 w-7 mr-1" // Theme edit color
            title="Edit Member"
            disabled={isImporting || isDragging}
        >
            <FaEdit className="h-4 w-4" />
        </Button>
        <Button
            variant="ghost" size="icon"
            onClick={() => handleDeleteMember(member.id)}
            className="text-destructive hover:text-destructive/80 h-7 w-7" // Theme delete color
            title="Delete Member"
            disabled={isImporting || isDragging}
        >
            <FaTrash className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};


const GangRoster: React.FC<GangRosterProps> = ({ gangId }) => {
  // Remove state/props related to gang list mode
  // const { gangId, gangs, onSelectGang, selectedGangId } = props;

  // State for member roster
  const [members, setMembers] = useState<GangMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<GangMember | null>(null);
  const { user: currentUser } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Member Roster Logic ---
  const fetchMembers = useCallback(async () => {
    // Simplified: Always fetch if gangId is present
    if (!gangId) {
        console.log("[fetchMembers] No gangId provided, clearing members.");
        setMembers([]);
        setLoading(false);
        setError("No Gang ID provided.");
        return;
    };
    console.log(`[fetchMembers] Fetching members for gangId: ${gangId}`); // Log the gangId being used
    setLoading(true);
    setError(null);
    try {
      const membersQuery = query(
        collection(dbFirestore, 'gangMembers'),
        where('gangId', '==', gangId),
        orderBy('sortOrder', 'asc'),
        orderBy('name', 'asc')
      );
      const snapshot = await getDocs(membersQuery);
      const membersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GangMember[];
      setMembers(membersData);
    } catch (err: any) {
      // Add this block to help debug missing index
      if (err.code === 9 && err.message && err.message.includes('indexes?create_composite')) {
        setError('Firestore composite index required. See console for link.');
        console.error('Firestore index error:', err.message);
      } else {
        setError('Failed to load gang roster. Check console for details.');
      }
      toast.error('Failed to load gang roster. Check console for details.');
    } finally {
      setLoading(false);
    }
  }, [gangId]);

  useEffect(() => {
    console.log(`[GangRoster useEffect] Fetching members for gangId: ${gangId}`);
    fetchMembers();
  }, [gangId, fetchMembers]); // Simplified dependencies

  // ... (handleAddMemberSuccess, handleEditMemberSuccess, openEditModal, handleDeleteMember, closeModal, handleFileChange, deleteAllExistingMembers, addMembersToFirestore, handleImportCSV, moveRow, triggerFirestoreUpdate - all remain the same) ...
  const handleAddMemberSuccess = () => {
    fetchMembers();
    setIsAddMemberModalOpen(false);
  };

  const handleEditMemberSuccess = () => {
    fetchMembers();
    setEditingMember(null); // Also close modal implicitly via state change if needed
    setIsAddMemberModalOpen(false);
  };

  const openEditModal = (member: GangMember) => {
    setEditingMember(member);
    setIsAddMemberModalOpen(true);
  };

   const handleDeleteMember = async (memberId: string) => {
    if (!window.confirm("Are you sure you want to remove this member from the roster?")) {
        return;
    }
    // No need to check gangId here as we are deleting directly by memberId
    try {
        // *** REVERT: Use the top-level collection path ***
        await deleteDoc(doc(dbFirestore, 'gangMembers', memberId));
        toast.success("Member removed successfully.");
        fetchMembers(); // Refetch members for the current gang
    } catch (err) {
        console.error("Error deleting member:", err);
        toast.error("Failed to remove member.");
    }
  };

   const closeModal = () => {
    setIsAddMemberModalOpen(false);
    setEditingMember(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const deleteAllExistingMembers = async (currentGangId: string): Promise<boolean> => {
      // Ensure currentGangId is valid before proceeding
      if (!currentGangId) return false;
      setLoading(true);
      console.log(`[deleteAllExistingMembers] Attempting delete for gangId: ${currentGangId}`);
      // *** REVERT: Query the top-level collection path with where clause ***
      const membersQuery = query(
          collection(dbFirestore, 'gangMembers'),
          where('gangId', '==', currentGangId)
      );
      try {
          const snapshot = await getDocs(membersQuery);
          if (snapshot.empty) {
              console.log("[deleteAllExistingMembers] No existing members found to delete.");
              return true;
          }
          const batch = writeBatch(dbFirestore);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          console.log(`[deleteAllExistingMembers] Committing batch delete for ${snapshot.size} members.`);
          await batch.commit();
          console.log("[deleteAllExistingMembers] Successfully deleted existing members.");
          toast.info(`Removed ${snapshot.size} existing members.`);
          return true;
      } catch (error) {
          console.error("[deleteAllExistingMembers] Error deleting existing members:", error);
          toast.error("Failed to remove existing members before import. Aborting import.");
          setError("Failed to clear roster before import.");
          return false;
      } finally {
          setLoading(false);
      }
  };

  const addMembersToFirestore = async (newMembers: Omit<GangMember, 'id' | 'addedAt'>[]) => {
    // Ensure gangId is valid before proceeding
    if (!currentUser || newMembers.length === 0 || !gangId) return;
    console.log(`[addMembersToFirestore] Attempting to add ${newMembers.length} members for gangId: ${gangId}`);
    const batch = writeBatch(dbFirestore);
    const timestamp = serverTimestamp();
    // *** REVERT: Get reference to the top-level collection ***
    const membersColRef = collection(dbFirestore, 'gangMembers');
    newMembers.forEach((memberData, index) => {
      // *** REVERT: Create doc reference within the top-level collection ***
      const memberRef = doc(membersColRef);
      batch.set(memberRef, {
        ...memberData,
        gangId: gangId, // Ensure gangId is set correctly
        sortOrder: memberData.sortOrder ?? index,
        addedAt: timestamp,
        addedBy: currentUser.id || 'Unknown',
        addedById: currentUser.id || 'Unknown',
        addedByName: currentUser.name || 'Unknown',
      });
    });
    try {
      await batch.commit();
      toast.success(`Successfully imported ${newMembers.length} members.`);
      fetchMembers(); // Refetch members for the current gang
    } catch (error) {
      console.error("[addMembersToFirestore] Error batch importing members:", error);
      toast.error("An error occurred during import. Some members may not have been added.");
    }
  };

   const handleImportCSV = () => {
    // Ensure gangId is valid before proceeding
    if (!selectedFile || !currentUser || !gangId) {
      toast.warn("Please select a file, ensure you are logged in, and a gang is selected.");
      return;
    }
    console.log(`[handleImportCSV] Import initiated for gangId: ${gangId}`);
    setIsImporting(true);
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const membersToImport: Omit<GangMember, 'id' | 'addedAt'>[] = [];
        console.log("[handleImportCSV - complete] Parsed CSV Data:", results.data);
        results.data.forEach((row: any, rowIndex) => {
          const name = row.Name?.trim();
          const phoneNumber = row.PhoneNumber?.trim();
          const job = row.Job?.trim(); // Corresponds to rankInGang
          const notesFromCSV = row.Notes?.trim();
          if (name && currentUser && gangId) { // Check gangId again
            membersToImport.push({
              name: name,
              phoneNumber: phoneNumber || null,
              rankInGang: job || null, // Use job as rank, null if empty
              notes: notesFromCSV || '',
              gangId: gangId, // Assign the current gangId
              addedBy: currentUser.id || 'Unknown', // Use ID or email
              addedById: currentUser.id || 'Unknown', // Use ID or email
              addedByName: currentUser.name || 'Unknown',
              sortOrder: rowIndex // Assign sort order based on CSV row index
            });
          } else if (Object.keys(row).length > 0 && Object.values(row).some(val => (val as string)?.trim())) {
            console.warn(`[handleImportCSV - complete] Skipping row ${rowIndex + 1}: Missing 'Name' field or context. Data:`, row);
          }
        });
        console.log("[handleImportCSV - complete] Members identified for import:", membersToImport);
        if (membersToImport.length > 0) {
          const deleteSuccess = await deleteAllExistingMembers(gangId); // Pass gangId
          if (deleteSuccess) {
            await addMembersToFirestore(membersToImport); // Pass members
          }
        } else {
          toast.warn("No valid member data found in the CSV to import.");
        }
        setIsImporting(false);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      error: (error: any) => {
        console.error("[handleImportCSV] Error parsing CSV:", error);
        toast.error(`Error parsing CSV file: ${error.message}`);
        setIsImporting(false);
      },
    });
  };

  const moveRow = useCallback((dragIndex: number, hoverIndex: number) => {
    setMembers((prevMembers) => {
        const newMembers = [...prevMembers];
        const [draggedItem] = newMembers.splice(dragIndex, 1);
        newMembers.splice(hoverIndex, 0, draggedItem);
        // Update sortOrder immediately in local state for visual feedback
        return newMembers.map((member, index) => ({ ...member, sortOrder: index }));
    });
  }, []);

  const triggerFirestoreUpdate = useCallback(async () => {
    // No need to check gangId here as we update by member.id
    console.log("Triggering Firestore update for new member order...");
    const batch = writeBatch(dbFirestore);
    members.forEach((member, index) => {
        const currentSortOrder = member.sortOrder ?? -1;
        if (currentSortOrder !== index) {
            // *** REVERT: Use the top-level collection path ***
            const memberRef = doc(dbFirestore, 'gangMembers', member.id);
            console.log(`Updating ${member.name} (${member.id}) to sortOrder: ${index}`);
            batch.update(memberRef, { sortOrder: index });
        }
    });
    try {
        await batch.commit();
        console.log("Firestore member sort order updated successfully.");
    } catch (err) {
        console.error("Error updating member sort order in Firestore:", err);
        toast.error("Failed to save new member order.");
        fetchMembers();
    }
  }, [members, fetchMembers]); // Removed gangId dependency


  // --- Rendering ---
  // Remove the conditional rendering for list mode

  // Always render the roster display
  return (
    <DndProvider backend={HTML5Backend}>
      {/* Use black background for main container */}
      <div className="space-y-6 bg-black/95 p-4 rounded-lg border border-border">
        {/* Header for adding members/importing */}
        {/* ... existing JSX ... */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex gap-2">
              {/* Use theme primary button style */}
              <Button
                size="sm"
                onClick={() => { setEditingMember(null); setIsAddMemberModalOpen(true); }}
                disabled={isImporting || loading}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <FaPlus className="mr-2 h-4 w-4" /> Add Member
              </Button>
          </div>
          <div className="flex items-center gap-2">
               {/* Use theme input style */}
               <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  // Theme input style + file button style
                  className="text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-accent-foreground hover:file:bg-accent/90 w-auto max-w-[200px] h-9 cursor-pointer bg-input border-border text-foreground"
                  disabled={isImporting || loading}
              />
              {/* Use theme secondary button style (outline) */}
              <Button
                  size="sm"
                  variant="outline"
                  onClick={handleImportCSV}
                  disabled={!selectedFile || isImporting || loading}
                  // Theme outline button with accent
                  className="border-accent text-accent hover:bg-accent/10 hover:text-accent"
              >
                  <FaUpload className="mr-2 h-4 w-4" /> {isImporting ? 'Importing...' : 'Import CSV'}
              </Button>
          </div>
        </div>


        {/* Loading/Error state for members */}
        {/* ... existing JSX ... */}
        {loading && (
            <div className="space-y-2">
                {/* Use black background for skeleton */}
                <Skeleton className="h-10 w-full bg-gray-800/95 border border-border" />
                <Skeleton className="h-10 w-full bg-gray-800/95 border border-border" />
                <Skeleton className="h-10 w-full bg-gray-800/95 border border-border" />
            </div>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}


        {/* Member Table */}
        {!loading && !error && (
          <>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">No members recorded for this gang.</p>
            ) : (
              // Use black background for table container
              <div className="rounded-lg border border-border overflow-hidden shadow-lg bg-black/95">
                <Table>
                  {/* Use black background for table header */}
                  <TableHeader>
                    <TableRow className="border-b-border hover:bg-black/95"> {/* Prevent hover on header row */}
                      {/* Use black background for header cells */}
                      <TableHead className="w-[40px] px-2 py-2 text-xs text-accent uppercase bg-black/95"></TableHead>
                      <TableHead className="px-4 py-2 text-xs text-accent uppercase bg-black/95">Name</TableHead>
                      <TableHead className="px-4 py-2 text-xs text-accent uppercase bg-black/95">Rank/Job</TableHead>
                      <TableHead className="px-4 py-2 text-xs text-accent uppercase bg-black/95">Phone</TableHead>
                      <TableHead className="px-4 py-2 text-xs text-accent uppercase bg-black/95">Notes</TableHead>
                      <TableHead className="px-4 py-2 text-xs text-accent uppercase bg-black/95">Added</TableHead>
                      <TableHead className="text-center px-4 py-2 text-xs text-accent uppercase bg-black/95">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member, index) => (
                      <DraggableMemberRow
                          key={member.id}
                          index={index}
                          member={member}
                          moveRow={moveRow}
                          isImporting={isImporting}
                          openEditModal={openEditModal}
                          handleDeleteMember={handleDeleteMember}
                          triggerFirestoreUpdate={triggerFirestoreUpdate}
                          // DraggableMemberRow internal styling updated above
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        {/* Add/Edit Member Modal - Ensure AddGangMemberForm uses bg-black/95 */}
        {/* Ensure AddGangMemberForm also writes to the correct top-level 'gangMembers' collection */}
        {isAddMemberModalOpen && currentUser && gangId && ( // Ensure gangId is passed
            <AddGangMemberForm
            isOpen={isAddMemberModalOpen}
            onClose={closeModal}
            onSuccess={editingMember ? handleEditMemberSuccess : handleAddMemberSuccess}
            gangId={gangId} // Pass the current gangId
            currentUser={currentUser}
            memberToEdit={editingMember}
            />
        )}
      </div>
    </DndProvider>
  );
};

export default GangRoster;
