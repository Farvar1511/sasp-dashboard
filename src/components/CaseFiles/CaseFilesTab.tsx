import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { CaseFile, CaseStatus } from '../../utils/ciuUtils';
import { User } from '../../types/User';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Skeleton } from '../ui/skeleton';
import { toast } from 'react-toastify';
import ConfirmationModal from '../ConfirmationModal';
import { FaTrash } from 'react-icons/fa';


interface CaseFilesTabProps {
    openCreateModal: () => void;
    openEditModal: (caseFile: CaseFile) => void;
    loadingAssignees: boolean;
}

interface ConfirmationModalState {
    show: boolean;
    message: string;
    onConfirm: () => void;
}

const CaseFilesTab: React.FC<CaseFilesTabProps> = ({ openCreateModal, openEditModal, loadingAssignees }) => {
  const { user: currentUser } = useAuth();
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseFile | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState | null>(null);

  useEffect(() => {
    setLoadingCases(true);
    const q = query(collection(dbFirestore, 'caseFiles'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const casesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CaseFile[];
      setCases(casesData);
      setLoadingCases(false);
    }, (err) => {
      console.error("Error fetching cases:", err);
      setError("Failed to load case files.");
      toast.error("Failed to load case files.");
      setLoadingCases(false);
    });
    return () => unsubscribe();
  }, []);


  const handleOpenCreateModal = () => openCreateModal();

  const handleOpenEditModal = (caseFile: CaseFile) => {
    openEditModal(caseFile);
  };


  const handleOpenAssignModal = (caseFile: CaseFile) => {
    setSelectedCase(caseFile);
    setIsAssignModalOpen(true);
  };
  const handleCloseAssignModal = () => {
    setIsAssignModalOpen(false);
    setSelectedCase(null);
  };

  const requestDeleteCase = (caseFile: CaseFile) => {
    if (!caseFile || !caseFile.id) {
        toast.error("Invalid case selected for deletion.");
        return;
    }
    setConfirmationModal({
        show: true,
        message: `Are you sure you want to delete the case "${caseFile.title}"? This action cannot be undone.`,
        onConfirm: () => confirmDeleteCase(caseFile.id!), // Added non-null assertion as ID is checked above
    });
  };

  const confirmDeleteCase = async (caseId: string) => {
    setConfirmationModal(null);
    try {
        const caseRef = doc(dbFirestore, 'caseFiles', caseId);
        await deleteDoc(caseRef);
        toast.success("Case file deleted successfully.");
    } catch (err) {
        console.error("Error deleting case file:", err);
        toast.error("Failed to delete case file.");
    }
  };


  const unassignedCases = cases.filter(c => c.status === 'Open - Unassigned');
  const assignedCases = cases.filter(c => c.status === 'Open - Assigned' || c.status === 'Under Review');
  const myCases = cases.filter(c => c.assignedToId === currentUser?.id);
  const closedCases = cases.filter(c => c.status.startsWith('Closed') || c.status === 'Archived');
  const canAssign = ["LEAD", "SUPER"].includes(currentUser?.certifications?.CIU?.toUpperCase() || "");


  const renderCaseList = (caseList: CaseFile[], listTitle: string) => (
    <div className="space-y-3">
      {/* Use theme text color */}
      <h3 className="text-lg font-medium text-foreground">{listTitle} ({caseList.length})</h3>
      {loadingCases ? (
        <div className="space-y-2">
          {/* Use theme skeleton style */}
          <Skeleton className="h-12 w-full bg-secondary border border-border" />
          <Skeleton className="h-12 w-full bg-secondary border border-border" />
        </div>
      ) : caseList.length === 0 ? (
        <p className="text-muted-foreground italic text-sm">No cases in this category.</p>
      ) : (
        caseList.map(caseFile => (
          // Use secondary background, adjust hover
          <div key={caseFile.id} className="p-3 border border-border rounded-md bg-secondary flex justify-between items-center hover:bg-muted/50 transition-colors group">
            <div>
              {/* Use theme text color */}
              <p className="font-medium cursor-pointer hover:underline text-foreground" onClick={() => handleOpenEditModal(caseFile)}>
                {caseFile.title}
              </p>
              <p className="text-xs text-muted-foreground">
                Status: {caseFile.status} {caseFile.assignedToName ? `(Assigned: ${caseFile.assignedToName})` : ''}
              </p>
            </div>
            <div className="flex items-center space-x-2">
                {canAssign && caseFile.status === 'Open - Unassigned' && (
                <Button size="sm" variant="outline" onClick={() => handleOpenAssignModal(caseFile)} disabled={loadingAssignees} className="border-accent text-accent hover:bg-accent/10">
                    Assign
                </Button>
                )}
                {canAssign && (
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => requestDeleteCase(caseFile)}
                        className="text-destructive hover:text-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                        title="Delete Case"
                    >
                        <FaTrash className="h-4 w-4" />
                    </Button>
                )}
            </div>
          </div>
        ))
      )}
    </div>
  );


  return (
    // Use bg-card for the main container
    <div className="space-y-6 bg-card p-4 rounded-lg border border-border">
      <div className="flex justify-between items-center">
        {/* Use theme text color */}
        <h2 className="text-xl font-semibold text-foreground">Case Files Dashboard</h2>
        {/* Use theme primary button style */}
        <Button onClick={handleOpenCreateModal} disabled={loadingAssignees} className="bg-brand hover:bg-brand-dark text-black font-semibold">Create New Case</Button>
      </div>

      {error && <p className="text-destructive">{error}</p>}

      <Tabs defaultValue="unassigned" className="w-full">
        {/* Use theme tab styles */}
        <TabsList className="bg-transparent p-0 border-b border-border">
          {/* Update active and hover states: yellow background, black text */}
          <TabsTrigger value="unassigned" className="bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black">Unassigned</TabsTrigger>
          <TabsTrigger value="assigned" className="bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black">Assigned</TabsTrigger>
          <TabsTrigger value="myCases" className="bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black">My Cases</TabsTrigger>
          <TabsTrigger value="closed" className="bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black">Closed/Archived</TabsTrigger>
        </TabsList>
        {/* Use secondary background for TabsContent */}
        <TabsContent value="unassigned" className="bg-secondary p-4 rounded-b-md border border-t-0 border-border">
          {renderCaseList(unassignedCases, "Open Unassigned Cases")}
        </TabsContent>
        <TabsContent value="assigned" className="bg-secondary p-4 rounded-b-md border border-t-0 border-border">
          {renderCaseList(assignedCases, "Open Assigned Cases")}
        </TabsContent>
        <TabsContent value="myCases" className="bg-secondary p-4 rounded-b-md border border-t-0 border-border">
          {renderCaseList(myCases, "My Assigned Cases")}
        </TabsContent>
        <TabsContent value="closed" className="bg-secondary p-4 rounded-b-md border border-t-0 border-border">
          {renderCaseList(closedCases, "Closed & Archived Cases")}
        </TabsContent>
      </Tabs>

      {/* ... (Assign Modal placeholder) ... */}
      {isAssignModalOpen && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><div className="bg-black/95 p-6 rounded border border-border text-foreground">Assign Modal for {selectedCase?.title} <Button onClick={handleCloseAssignModal}>Close</Button></div></div>}

       {confirmationModal?.show && (
            <ConfirmationModal
                isOpen={confirmationModal.show}
                title="Confirm Deletion"
                message={confirmationModal.message}
                onConfirm={confirmationModal.onConfirm}
                onCancel={() => setConfirmationModal(null)}
                onClose={() => setConfirmationModal(null)}
                confirmText="Delete"
                cancelText="Cancel"
            />
        )}
    </div>
  );
};

export default CaseFilesTab;
