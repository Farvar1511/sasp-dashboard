import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, serverTimestamp as fbServerTimestamp } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { CaseFile, CaseStatus } from '../../utils/ciuUtils';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Skeleton } from '../ui/skeleton';
import { toast } from 'react-toastify';
import ConfirmationModal from '../ConfirmationModal';
import { FaTrash, FaPlusCircle, FaEdit, FaSave, FaEye, FaExchangeAlt, FaArchive, FaBan } from 'react-icons/fa';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { formatTimestampForDisplay } from '../../utils/timeHelpers';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '../ui/badge';
interface CaseFilesTabProps {
    openCreateModal: () => void;
    openEditModal: (caseFile: CaseFile) => void;
    loadingAssignees: boolean; // To disable "Create Case" button if assignees are still loading
}

interface ConfirmationModalState {
    show: boolean;
    message: string;
    onConfirm: () => void;
}

const getStorageKey = (userId: string) => `casefiles_categories_${userId}`;
const getActiveTabStorageKey = (userId: string) => `casefiles_active_tab_${userId}`;

// Fix: Only use currentUser.id if it is defined, otherwise fallback to 'myCases'
const CaseFilesTab: React.FC<CaseFilesTabProps> = ({ openCreateModal, openEditModal, loadingAssignees }) => {
  const { user: currentUser } = useAuth();
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState | null>(null);

  // Only use currentUser.id if it is a string, otherwise default to 'myCases'
  const initialActiveTab =
    currentUser && typeof currentUser.id === 'string'
      ? localStorage.getItem(getActiveTabStorageKey(currentUser.id)) || 'myCases'
      : 'myCases';
  const [activeTab, setActiveTab] = useState(initialActiveTab);

  const [updatingStatusCaseId, setUpdatingStatusCaseId] = useState<string | null>(null);

  // DND and Categories state (assuming these are for cases)
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string; caseIds: string[] }[]>([]);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const isLeadOrSuper = useMemo(() => {
    if (!currentUser || !currentUser.certifications || !currentUser.certifications['CIU']) return false;
    const ciuLevel = currentUser.certifications['CIU'];
    return ['LEAD', 'SUPER'].includes(ciuLevel);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && typeof currentUser.id === 'string') {
        localStorage.setItem(getActiveTabStorageKey(currentUser.id), activeTab);
    }
  }, [activeTab, currentUser]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const storedCategories = localStorage.getItem(getStorageKey(currentUser.id as string));
    if (storedCategories) {
      setCustomCategories(JSON.parse(storedCategories));
    }
    // TODO: Consider fetching/syncing categories with Firestore if needed across devices/sessions
  }, [currentUser?.id]);

  useEffect(() => {
    setLoadingCases(true);
    const qCases = query(collection(dbFirestore, 'caseFiles'), orderBy('updatedAt', 'desc'));
    const unsubscribeCases = onSnapshot(qCases, (snapshot) => {
      const casesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CaseFile[];
      setCases(casesData);
      setLoadingCases(false);
    }, (err) => {
      console.error("Error fetching cases:", err);
      setError("Failed to load case files.");
      toast.error("Failed to load case files.");
      setLoadingCases(false);
    });

    return () => {
        unsubscribeCases();
    };
  }, []);

  const handleStatusUpdate = async (caseId: string, newStatus: CaseStatus) => {
    setUpdatingStatusCaseId(caseId);
    try {
      const caseRef = doc(dbFirestore, 'caseFiles', caseId);
      await updateDoc(caseRef, { status: newStatus, updatedAt: fbServerTimestamp() });
      toast.success(`Case status updated to "${newStatus}".`);
    } catch (err) {
      console.error("Error updating case status:", err);
      toast.error("Failed to update case status.");
    } finally {
      setUpdatingStatusCaseId(null);
    }
  };

  const requestDeleteCase = (caseFile: CaseFile) => {
    setConfirmationModal({
      show: true,
      message: `Are you sure you want to delete the case "${caseFile.title}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(dbFirestore, 'caseFiles', caseFile.id));
          toast.success(`Case "${caseFile.title}" deleted successfully.`);
          // No need to filter cases here, onSnapshot will update the list
        } catch (error) {
          console.error("Error deleting case:", error);
          toast.error("Failed to delete case.");
        }
        setConfirmationModal(null);
      },
    });
  };

  // Filter cases based on current user and active tab
  const myCases = useMemo(() => cases.filter(c => c.assignedToId === currentUser?.id && c.status !== 'Archived' && c.status !== 'Closed - Solved' && c.status !== 'Closed - Unsolved'), [cases, currentUser?.id]);
  const unassignedCases = useMemo(() => cases.filter(c => c.status === 'Open - Unassigned'), [cases]);
  const allActiveCases = useMemo(() => cases.filter(c => c.status !== 'Archived' && c.status !== 'Closed - Solved' && c.status !== 'Closed - Unsolved'), [cases]);
  const archivedCases = useMemo(() => cases.filter(c => c.status === 'Archived'), [cases]);
  const closedCases = useMemo(() => cases.filter(c => c.status === 'Closed - Solved' || c.status === 'Closed - Unsolved'), [cases]);

  // DND handlers for cases
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id && over?.id) {
      if (activeTab === 'myCases') {
        setCases((items) => {
          const oldIndex = items.findIndex(item => item.id === active.id);
          const newIndex = items.findIndex(item => item.id === over.id);
          return arrayMove(items, oldIndex, newIndex);
        });
        // Note: This DND reordering is client-side only. 
        // For persistence, you'd need to save order to Firestore or use custom categories more extensively.
      }
    }
  };

  const renderCaseList = (caseList: CaseFile[], listTitle: string, showDnd: boolean = false) => (
    <div className="space-y-3">
      <h3 className="text-lg font-medium text-foreground">{listTitle} ({caseList.length})</h3>
      {loadingCases ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full bg-muted border border-border" />
          <Skeleton className="h-20 w-full bg-muted border border-border" />
        </div>
      ) : caseList.length === 0 ? (
        <p className="text-muted-foreground italic text-sm">No cases in this category.</p>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">Title</TableHead>
                <TableHead className="px-4 py-2 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Assigned To</TableHead>
                <TableHead className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">Status</TableHead>
                <TableHead className="px-4 py-2 text-left text-sm font-medium text-muted-foreground hidden sm:table-cell">Last Updated</TableHead>
                <TableHead className="px-4 py-2 text-right text-sm font-medium text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            {showDnd ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={caseList.map(c => c.id)} strategy={verticalListSortingStrategy}>
                  <TableBody>
                    {/* Fallback rendering if SortableCaseItem is not used/available */}
                    {caseList.map(caseFile => (
                      <TableRow key={caseFile.id} className="border-b border-border hover:bg-muted/50 group">
                        <TableCell className="px-4 py-3 font-medium cursor-pointer hover:underline text-foreground text-sm" onClick={() => openEditModal(caseFile)}>
                            {caseFile.title}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                          {activeTab === 'unassigned' ? (
                            <>
                              <span className="text-xs block text-muted-foreground/70">Submitted by:</span>
                              {caseFile.createdByName || 'Unknown Submitter'}
                            </>
                          ) : (
                            caseFile.assignedToName || 'Unassigned'
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm">
                          <Badge
                            variant={
                              caseFile.status.startsWith('Open')
                                ? "default"
                                : caseFile.status.startsWith('Closed')
                                ? "secondary"
                                : "outline"
                            }
                            className={`${
                              caseFile.status === 'Open - Unassigned'
                                ? 'bg-orange-500'
                                : caseFile.status === 'Open - Assigned'
                                  ? (activeTab === "myCases" || activeTab === "allActive"
                                      ? 'bg-green-500'
                                      : 'bg-blue-500')
                                  : caseFile.status === 'Under Review'
                                  ? 'bg-yellow-500 text-black'
                                  : caseFile.status.startsWith('Closed')
                                  ? 'bg-red-500'
                                  : caseFile.status === 'Archived'
                                  ? 'bg-orange-500'
                                  : ''
                            } text-xs`}>
                            {caseFile.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                          {
                            caseFile.updatedAt && typeof caseFile.updatedAt === 'object' &&
                            ('toDate' in caseFile.updatedAt)
                              ? formatTimestampForDisplay(caseFile.updatedAt)
                              : 'Pending...'
                          }
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => openEditModal(caseFile)} className="text-muted-foreground hover:text-foreground h-7 w-7" title="Edit Case"><FaEdit className="h-3.5 w-3.5" /></Button>
                                {(isLeadOrSuper || caseFile.createdBy === currentUser?.id) && (
                                    <Button size="icon" variant="ghost" onClick={() => requestDeleteCase(caseFile)} className="text-destructive hover:text-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7" title="Delete Case"><FaTrash className="h-3.5 w-3.5" /></Button>
                                )}
                            </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </SortableContext>
              </DndContext>
            ) : (
              <TableBody>
                {caseList.map(caseFile => (
                   <TableRow key={caseFile.id} className="border-b border-border hover:bg-muted/50 group">
                    <TableCell className="px-4 py-3 font-medium cursor-pointer hover:underline text-foreground text-sm" onClick={() => openEditModal(caseFile)}>
                        {caseFile.title}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                      {activeTab === 'unassigned' ? (
                        <>
                          <span className="text-xs block text-muted-foreground/70">Submitted by:</span>
                          {caseFile.createdByName || 'Unknown Submitter'}
                        </>
                      ) : (
                        caseFile.assignedToName || 'Unassigned'
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                        <Badge
                          variant={
                            caseFile.status.startsWith('Open')
                              ? "default"
                              : caseFile.status.startsWith('Closed')
                              ? "secondary"
                              : "outline"
                          }
                          className={`${
                            caseFile.status === 'Open - Unassigned'
                              ? 'bg-orange-500'
                              : caseFile.status === 'Open - Assigned'
                              ? (activeTab === "myCases" || activeTab === "allActive"
                                  ? 'bg-green-500'
                                  : 'bg-blue-500')
                              : caseFile.status === 'Under Review'
                              ? 'bg-yellow-500 text-black'
                              : caseFile.status.startsWith('Closed')
                              ? 'bg-red-500'
                              : caseFile.status === 'Archived'
                              ? 'bg-orange-500'
                              : ''
                          } text-xs`}>
                          {caseFile.status}
                        </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                      {
                        caseFile.updatedAt && typeof caseFile.updatedAt === 'object' &&
                        ('toDate' in caseFile.updatedAt)
                          ? formatTimestampForDisplay(caseFile.updatedAt)
                          : 'Pending...'
                      }
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEditModal(caseFile)} className="text-muted-foreground hover:text-foreground h-7 w-7" title="Edit Case"><FaEdit className="h-3.5 w-3.5" /></Button>
                            {(isLeadOrSuper || caseFile.createdBy === currentUser?.id) && (
                                <Button size="icon" variant="ghost" onClick={() => requestDeleteCase(caseFile)} className="text-destructive hover:text-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7" title="Delete Case"><FaTrash className="h-3.5 w-3.5" /></Button>
                            )}
                        </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </Table>
        </div>
      )}
    </div>
  );

  return (
    <div className={`w-full max-w-full mx-auto px-8 py-10 space-y-6 bg-background rounded-lg border border-border shadow-lg`}>
      <div className="flex justify-between items-center pb-4 border-b border-border">
        <h2 className="text-2xl font-semibold text-brand">Case Management</h2>
        <Button onClick={() => openCreateModal()} className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={loadingAssignees}>
          <FaPlusCircle className="mr-2 h-4 w-4" /> Create New Case
        </Button>
      </div>

      {error && <p className="text-destructive p-4 bg-destructive/10 border border-destructive rounded-md">{error}</p>}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-transparent p-0 border-b border-border gap-1 sm:gap-2 flex flex-wrap justify-start">
          <TabsTrigger 
            value="myCases" 
            className="bg-transparent text-muted-foreground px-3 sm:px-4 py-2.5 text-sm sm:text-base font-medium data-[state=active]:bg-[#f3c700] data-[state=active]:text-black rounded-t-md transition hover:bg-muted/20">
            My Active Cases
          </TabsTrigger>
          {isLeadOrSuper && (
            <TabsTrigger 
              value="unassigned" 
              className="bg-transparent text-muted-foreground px-3 sm:px-4 py-2.5 text-sm sm:text-base font-medium data-[state=active]:bg-[#f3c700] data-[state=active]:text-black rounded-t-md transition hover:bg-muted/20">
              Unassigned Cases
            </TabsTrigger>
          )}
          <TabsTrigger 
            value="allActive" 
            className="bg-transparent text-muted-foreground px-3 sm:px-4 py-2.5 text-sm sm:text-base font-medium data-[state=active]:bg-[#f3c700] data-[state=active]:text-black rounded-t-md transition hover:bg-muted/20">
            All Active Cases
          </TabsTrigger>
          <TabsTrigger 
            value="closed" 
            className="bg-transparent text-muted-foreground px-3 sm:px-4 py-2.5 text-sm sm:text-base font-medium data-[state=active]:bg-[#f3c700] data-[state=active]:text-black rounded-t-md transition hover:bg-muted/20">
            Closed Cases
          </TabsTrigger>
          <TabsTrigger 
            value="archived" 
            className="bg-transparent text-muted-foreground px-3 sm:px-4 py-2.5 text-sm sm:text-base font-medium data-[state=active]:bg-[#f3c700] data-[state=active]:text-black rounded-t-md transition hover:bg-muted/20">
            Archived Cases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="myCases" className="bg-card p-4 md:p-6 rounded-b-lg border border-t-0 border-border mt-[-1px]">
          {renderCaseList(myCases, "My Active Cases", true)}
        </TabsContent>
        {isLeadOrSuper && (
          <TabsContent value="unassigned" className="bg-card p-4 md:p-6 rounded-b-lg border border-t-0 border-border mt-[-1px]">
            {renderCaseList(unassignedCases, "Open Unassigned Cases")}
          </TabsContent>
        )}
        <TabsContent value="allActive" className="bg-card p-4 md:p-6 rounded-b-lg border border-t-0 border-border mt-[-1px]">
          {renderCaseList(allActiveCases, "All Active Cases")}
        </TabsContent>
        <TabsContent value="closed" className="bg-card p-4 md:p-6 rounded-b-lg border border-t-0 border-border mt-[-1px]">
          {renderCaseList(closedCases, "Closed Cases")}
        </TabsContent>
        <TabsContent value="archived" className="bg-card p-4 md:p-6 rounded-b-lg border border-t-0 border-border mt-[-1px]">
          {renderCaseList(archivedCases, "Archived Cases")}
        </TabsContent>
      </Tabs>

      {confirmationModal?.show && (
        <ConfirmationModal
          isOpen={confirmationModal.show}
          title="Confirm Action"
          message={confirmationModal.message}
          onConfirm={confirmationModal.onConfirm}
          onCancel={() => setConfirmationModal(null)}
          onClose={() => setConfirmationModal(null)}
        />
      )}
    </div>
  );
};

export default CaseFilesTab;
