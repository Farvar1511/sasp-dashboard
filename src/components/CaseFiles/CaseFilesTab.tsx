import React, { useState, useEffect } from 'react'; // Import React
import { collection, query, orderBy, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { CaseFile, CaseStatus } from '../../utils/ciuUtils'; // Import types
import { User } from '../../types/User'; // Import User type
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Skeleton } from '../ui/skeleton';
import { toast } from 'react-toastify';
// Removed Modal imports as they are handled by the parent (CIUManagement)
// import CreateCaseModal from './CreateCaseModal';
// import EditCaseModal from './CaseDetailsModal';

// Add props to receive modal control functions and assignee loading state from parent
interface CaseFilesTabProps {
    openCreateModal: () => void;
    openEditModal: (caseFile: CaseFile) => void;
    loadingAssignees: boolean; // Receive loading state for assignees
}


const CaseFilesTab: React.FC<CaseFilesTabProps> = ({ openCreateModal, openEditModal, loadingAssignees }) => {
  const { user: currentUser } = useAuth();
  const [cases, setCases] = useState<CaseFile[]>([]);
  // Removed users state as assignees are passed via props or fetched in parent
  const [loadingCases, setLoadingCases] = useState(true);
  // Removed loadingUsers state
  const [error, setError] = useState<string | null>(null);

  // Removed Modal State as it's handled by parent
  // const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false); // Keep for later
  const [selectedCase, setSelectedCase] = useState<CaseFile | null>(null); // Use this for Assign Modal

  // Fetch Cases (Keep this logic)
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

  // Removed Fetch Users effect as assignees come from parent

  // --- Modal Handlers ---
  // Use handlers passed from props
  const handleOpenCreateModal = () => openCreateModal();
  // Removed handleCloseCreateModal and handleCreateSuccess

  // Update handlers for Edit Modal - use prop function
  const handleOpenEditModal = (caseFile: CaseFile) => {
    // No need to set local state for edit modal, just call parent's handler
    openEditModal(caseFile);
  };
  // Removed handleCloseEditModal and handleEditSaveSuccess


  // Placeholder handlers for assign modal (keep for now)
  const handleOpenAssignModal = (caseFile: CaseFile) => {
    setSelectedCase(caseFile);
    setIsAssignModalOpen(true);
  };
  const handleCloseAssignModal = () => {
    setIsAssignModalOpen(false);
    setSelectedCase(null); // Clear selected case when closing assign modal
  };
  // --- End Modal Handlers ---


  // Filter cases by status/assignment (Keep this logic)
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
          <Skeleton className="h-12 w-full bg-black/95 border border-border" />
          <Skeleton className="h-12 w-full bg-black/95 border border-border" />
        </div>
      ) : caseList.length === 0 ? (
        <p className="text-muted-foreground italic text-sm">No cases in this category.</p>
      ) : (
        caseList.map(caseFile => (
          // Use black background with opacity, adjust hover
          <div key={caseFile.id} className="p-3 border border-border rounded-md bg-black/95 flex justify-between items-center hover:bg-gray-800/95 transition-colors">
            <div>
              {/* Use theme text color */}
              <p className="font-medium cursor-pointer hover:underline text-foreground" onClick={() => handleOpenEditModal(caseFile)}>
                {caseFile.title}
              </p>
              <p className="text-xs text-muted-foreground">
                Status: {caseFile.status} {caseFile.assignedToName ? `(Assigned: ${caseFile.assignedToName})` : ''}
              </p>
            </div>
            {canAssign && caseFile.status === 'Open - Unassigned' && (
              // Use theme outline button style with accent
              <Button size="sm" variant="outline" onClick={() => handleOpenAssignModal(caseFile)} disabled={loadingAssignees} className="border-accent text-accent hover:bg-accent/10">
                Assign
              </Button>
            )}
          </div>
        ))
      )}
    </div>
  );


  return (
    // Use black background with opacity for main container
    <div className="space-y-6 bg-black/95 p-4 rounded-lg border border-border">
      <div className="flex justify-between items-center">
        {/* Use theme text color */}
        <h2 className="text-xl font-semibold text-foreground">Case Files Dashboard</h2>
        {/* Use theme primary button style */}
        <Button onClick={handleOpenCreateModal} disabled={loadingAssignees} className="bg-accent hover:bg-accent/90 text-accent-foreground">Create New Case</Button>
      </div>

      {error && <p className="text-destructive">{error}</p>}

      <Tabs defaultValue="unassigned" className="w-full">
        {/* Use theme tab styles */}
        <TabsList className="bg-transparent p-0 border-b border-border">
          <TabsTrigger value="unassigned" className="data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-accent data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Unassigned</TabsTrigger>
          <TabsTrigger value="assigned" className="data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-accent data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Assigned</TabsTrigger>
          <TabsTrigger value="myCases" className="data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-accent data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">My Cases</TabsTrigger>
          <TabsTrigger value="closed" className="data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-accent data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Closed/Archived</TabsTrigger>
        </TabsList>
        {/* Use black background with opacity for TabsContent */}
        <TabsContent value="unassigned" className="bg-black/95 p-4 rounded-b-md border border-t-0 border-border">
          {renderCaseList(unassignedCases, "Open Unassigned Cases")}
        </TabsContent>
        <TabsContent value="assigned" className="bg-black/95 p-4 rounded-b-md border border-t-0 border-border">
          {renderCaseList(assignedCases, "Open Assigned Cases")}
        </TabsContent>
        <TabsContent value="myCases" className="bg-black/95 p-4 rounded-b-md border border-t-0 border-border">
          {renderCaseList(myCases, "My Assigned Cases")}
        </TabsContent>
        <TabsContent value="closed" className="bg-black/95 p-4 rounded-b-md border border-t-0 border-border">
          {renderCaseList(closedCases, "Closed & Archived Cases")}
        </TabsContent>
      </Tabs>

      {/* ... (Assign Modal placeholder) ... */}
       {isAssignModalOpen && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><div className="bg-black/95 p-6 rounded border border-border text-foreground">Assign Modal for {selectedCase?.title} <Button onClick={handleCloseAssignModal}>Close</Button></div></div>}

    </div>
  );
};

export default CaseFilesTab;
