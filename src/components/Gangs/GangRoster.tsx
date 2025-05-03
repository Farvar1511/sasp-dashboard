import React, { useState, useEffect, useRef, useCallback } from 'react'; // Import React
import { collection, query, where, getDocs, orderBy, Timestamp, serverTimestamp, addDoc, deleteDoc, doc, writeBatch, updateDoc, limit } from 'firebase/firestore'; // Added limit
import { db as dbFirestore } from '../../firebase';
import { GangMember as ImportedGangMember } from '../../utils/ciuUtils'; // Import the updated type
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import AddGangMemberForm from './AddGangMemberModal'; // Import the refactored form component
import { formatTimestampDateTime } from '../../utils/timeHelpers';
import { Pencil, Trash2, Plus, Upload, GripVertical, FileText } from 'lucide-react'; // Import Lucide icons
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from '../ui/button';
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

// Modify DraggableMemberRow to use native elements and forwardRef
const DraggableMemberRow: React.FC<DraggableMemberRowProps> = ({
    member,
    index,
    moveRow,
    isImporting,
    openEditModal,
    handleDeleteMember,
    triggerFirestoreUpdate,
}) => {
  const rowRef = useRef<HTMLTableRowElement>(null); // Ref for the TR element
  const handleRef = useRef<HTMLTableCellElement>(null); // Ref for the drag handle cell

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
      if (!rowRef.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = rowRef.current?.getBoundingClientRect();
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
        // Trigger the Firestore update when the drop occurs
        triggerFirestoreUpdate();
    }
  });

  const [{ isDragging }, drag, preview] = useDrag({
    type: ItemTypes.ROW,
    item: () => ({ id: member.id, index }),
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
    // Optional: end drag logic if needed, but drop() handles the update trigger
    // end: (item, monitor) => { ... }
  });

  // Attach refs to the native elements
  drag(handleRef); // Attach drag source ref to the handle cell
  drop(rowRef);   // Attach drop target ref to the row itself
  preview(rowRef); // Attach drag preview ref to the row itself

  const opacity = isDragging ? 0.4 : 1;

  // Render using native tr and td, applying refs and shadcn classes for styling
  return (
    <tr
      ref={rowRef} // Apply drop and preview ref here
      style={{ opacity }}
      className={cn(
          `border-b border-border hover:bg-muted/50 ${isDragging ? 'bg-muted cursor-grabbing' : 'bg-card'}` // Row styling
      )
      }
      data-handler-id={handlerId}
    >
      {/* Drag Handle Cell */}
      <td ref={handleRef} className="touch-none px-2 py-2 cursor-grab align-middle"> {/* Apply drag ref here */}
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </td>
      {/* Data Cells - Apply shadcn TableCell classes */}
      <td className="font-medium text-foreground px-4 py-2 align-middle">{member.name}</td>
      <td className="text-foreground px-4 py-2 align-middle">{member.rankInGang || '-'}</td>
      <td className="text-foreground px-4 py-2 align-middle">{member.phoneNumber || '-'}</td>
      <td className="truncate max-w-[200px] text-foreground px-4 py-2 align-middle" title={member.notes || undefined}>{member.notes || '-'}</td>
      <td className="text-xs text-muted-foreground px-4 py-2 align-middle">
        {formatTimestampDateTime(member.addedAt)}
      </td>
      <td className="text-center px-4 py-2 align-middle">
        {/* Buttons */}
        <Button
            variant="ghost" size="icon"
            onClick={() => openEditModal(member)}
            className="text-[#f3c700] hover:text-[#f3c700]/80 h-7 w-7 mr-1"
            title="Edit Member"
            disabled={isImporting || isDragging}
        >
            <Pencil className="h-4 w-4" />
        </Button>
        <Button
            variant="ghost" size="icon"
            onClick={() => handleDeleteMember(member.id ?? undefined)}
            className="text-destructive hover:text-destructive/80 h-7 w-7"
            title="Delete Member"
            disabled={isImporting || isDragging}
        >
            <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
};

const GangRoster: React.FC<GangRosterProps> = ({ gangId }) => {
  // State for member roster
  const [members, setMembers] = useState<GangMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<GangMember | null>(null);
  const { user: currentUser } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for the hidden native input

  // --- Member Roster Logic ---
  const fetchMembers = useCallback(async () => {
    if (!gangId) {
        console.log("[fetchMembers] No gangId provided, clearing members.");
        setMembers([]);
        setLoading(false);
        setError("No Gang ID provided.");
        return;
    };
    console.log(`[fetchMembers] Fetching members for gangId: ${gangId}`);
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
      const membersWithSortOrder = membersData.map((member, index) => ({
          ...member,
          sortOrder: member.sortOrder ?? index,
      }));
      setMembers(membersWithSortOrder);
    } catch (err: any) {
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
  }, [gangId, fetchMembers]);

  const handleAddMemberSuccess = () => {
    fetchMembers();
    setIsAddMemberModalOpen(false);
  };

  const handleEditMemberSuccess = () => {
    fetchMembers();
    setEditingMember(null);
    setIsAddMemberModalOpen(false);
  };

  const openEditModal = (member: GangMember) => {
    setEditingMember(member);
    setIsAddMemberModalOpen(true);
  };

   const handleDeleteMember = async (memberId: string | undefined) => {
    if (!memberId) {
        toast.error("Member ID is missing.");
        return;
    }
    if (!window.confirm("Are you sure you want to remove this member from the roster?")) {
        return;
    }
    try {
        await deleteDoc(doc(dbFirestore, 'gangMembers', memberId));
        toast.success("Member removed successfully.");
        fetchMembers();
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
    // Reads from the native input event
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  // Function to trigger the hidden file input click
  const handleChooseFileClick = () => {
    fileInputRef.current?.click();
  };

  const deleteAllExistingMembers = async (currentGangId: string): Promise<boolean> => {
      if (!currentGangId) return false;
      setLoading(true);
      console.log(`[deleteAllExistingMembers] Attempting delete for gangId: ${currentGangId}`);
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
    if (!currentUser || newMembers.length === 0 || !gangId) return;
    console.log(`[addMembersToFirestore] Attempting to add ${newMembers.length} members for gangId: ${gangId}`);
    const batch = writeBatch(dbFirestore);
    const timestamp = serverTimestamp();
    const membersColRef = collection(dbFirestore, 'gangMembers');
    newMembers.forEach((memberData, index) => {
      const memberRef = doc(membersColRef);
      batch.set(memberRef, {
        ...memberData,
        gangId: gangId,
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
      fetchMembers();
    } catch (error) {
      console.error("[addMembersToFirestore] Error batch importing members:", error);
      toast.error("An error occurred during import. Some members may not have been added.");
    }
  };

   const handleImportCSV = () => {
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
          const job = row.Job?.trim();
          const notesFromCSV = row.Notes?.trim();
          if (name && currentUser && gangId) {
            membersToImport.push({
              name: name,
              phoneNumber: phoneNumber || null,
              rankInGang: job || null,
              notes: notesFromCSV || '',
              gangId: gangId,
              addedBy: currentUser.id || 'Unknown',
              addedById: currentUser.id || 'Unknown',
              addedByName: currentUser.name || 'Unknown',
              sortOrder: rowIndex
            });
          } else if (Object.keys(row).length > 0 && Object.values(row).some(val => (val as string)?.trim())) {
            console.warn(`[handleImportCSV - complete] Skipping row ${rowIndex + 1}: Missing 'Name' field or context. Data:`, row);
          }
        });
        console.log("[handleImportCSV - complete] Members identified for import:", membersToImport);
        if (membersToImport.length > 0) {
          const deleteSuccess = await deleteAllExistingMembers(gangId);
          if (deleteSuccess) {
            await addMembersToFirestore(membersToImport);
          }
        } else {
          toast.warn("No valid member data found in the CSV to import.");
        }
        setIsImporting(false);
        setSelectedFile(null); // Reset state
        if (fileInputRef.current) fileInputRef.current.value = ""; // Clear native input value
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
      return newMembers;
    });
  }, []);

  const triggerFirestoreUpdate = useCallback(async () => {
    setMembers(currentMembers => {
        console.log("Triggering Firestore update for new member order...");
        const batch = writeBatch(dbFirestore);
        currentMembers.forEach((member, index) => {
            const memberRef = doc(dbFirestore, 'gangMembers', member.id);
            console.log(`Updating ${member.name} (${member.id}) to sortOrder: ${index}`);
            batch.update(memberRef, { sortOrder: index });
        });
        batch.commit().then(() => {
            console.log("Firestore member sort order updated successfully.");
        }).catch(err => {
            console.error("Error updating member sort order in Firestore:", err);
            toast.error("Failed to save new member order.");
            fetchMembers();
        });
        return currentMembers;
    });
  }, [fetchMembers]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6 bg-card p-4 rounded-lg border border-border">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => { setEditingMember(null); setIsAddMemberModalOpen(true); }}
                disabled={isImporting || loading}
                className="bg-[#f3c700] hover:bg-[#f3c700]/90 text-black"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Member
              </Button>
          </div>
          <div className="flex items-center gap-2">
               {/* Hidden Native File Input */}
               <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden" // Hide the native input
                  disabled={isImporting || loading}
              />
              {/* Button to Trigger File Selection */}
              <Button
                  size="sm"
                  variant="outline"
                  onClick={handleChooseFileClick}
                  disabled={isImporting || loading}
                  className="border-input text-muted-foreground hover:bg-muted/50" // More standard outline button style
              >
                  <FileText className="mr-2 h-4 w-4" /> Choose File
              </Button>
              {/* Display Selected File Name (Optional) */}
              <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                  {selectedFile ? selectedFile.name : "No file chosen"}
              </span>
              <Button
                  size="sm"
                  variant="outline"
                  onClick={handleImportCSV}
                  disabled={!selectedFile || isImporting || loading}
                  className="border-[#f3c700] text-[#f3c700] hover:bg-[#f3c700]/10 hover:text-[#f3c700]"
              >
                  <Upload className="mr-2 h-4 w-4" /> {isImporting ? 'Importing...' : 'Import CSV'}
              </Button>
          </div>
        </div>

        {loading && (
            <div className="space-y-2">
                <Skeleton className="h-10 w-full bg-muted border border-border" />
                <Skeleton className="h-10 w-full bg-muted border border-border" />
                <Skeleton className="h-10 w-full bg-muted border border-border" />
            </div>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}

        {!loading && !error && (
          <>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">No members recorded for this gang.</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden shadow-sm bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-border hover:bg-transparent">
                    <TableHead className="w-[40px] px-2 py-3 text-xs text-muted-foreground uppercase bg-secondary"></TableHead>
                    <TableHead className="px-4 py-3 text-xs text-muted-foreground uppercase bg-secondary">Name</TableHead>
                    <TableHead className="px-4 py-3 text-xs text-muted-foreground uppercase bg-secondary">Job</TableHead>
                    <TableHead className="px-4 py-3 text-xs text-muted-foreground uppercase bg-secondary">Phone</TableHead>
                    <TableHead className="px-4 py-3 text-xs text-muted-foreground uppercase bg-secondary">Notes</TableHead>
                    <TableHead className="px-4 py-3 text-xs text-muted-foreground uppercase bg-secondary">Added</TableHead>
                    <TableHead className="text-center px-4 py-3 text-xs text-muted-foreground uppercase bg-secondary">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member, index) => (
                    <DraggableMemberRow
                        key={member.id ?? `temp-${index}`}
                        index={index}
                        member={member}
                        moveRow={moveRow}
                        isImporting={isImporting}
                        openEditModal={openEditModal}
                        handleDeleteMember={(id) => handleDeleteMember(id ?? undefined)}
                        triggerFirestoreUpdate={triggerFirestoreUpdate}
                    />
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </>
        )}

        {isAddMemberModalOpen && currentUser && gangId && (
            <AddGangMemberForm
            isOpen={isAddMemberModalOpen}
            onClose={closeModal}
            onSuccess={editingMember ? handleEditMemberSuccess : handleAddMemberSuccess}
            gangId={gangId}
            currentUser={currentUser}
            memberToEdit={editingMember}
            />
          )}
      </div>
    </DndProvider>
  );
};

export default GangRoster;
