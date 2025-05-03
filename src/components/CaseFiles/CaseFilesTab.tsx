import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { CaseFile } from '../../utils/ciuUtils';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Skeleton } from '../ui/skeleton';
import { toast } from 'react-toastify';
import ConfirmationModal from '../ConfirmationModal';
import { FaTrash, FaPlusCircle, FaEdit } from 'react-icons/fa';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { formatTimestampForDisplay } from '../../utils/timeHelpers';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Input as ShadcnInput } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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

// Helper for localStorage keys
const getStorageKey = (userId: string) => `casefiles_order_${userId}`;

const CaseFilesTab: React.FC<CaseFilesTabProps> = ({ openCreateModal, openEditModal, loadingAssignees }) => {
  const { user: currentUser } = useAuth();
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState | null>(null);

  // --- Custom Categories and Order State ---
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string; caseIds: string[] }[]>([]);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [activeTab, setActiveTab] = useState('myCases');

  // Load categories/order from localStorage
  useEffect(() => {
    if (!currentUser?.id) return;
    const raw = localStorage.getItem(getStorageKey(currentUser.id));
    if (raw) {
      try {
        setCustomCategories(JSON.parse(raw));
      } catch {
        setCustomCategories([]);
      }
    }
  }, [currentUser?.id]);

  // Save categories/order to localStorage
  useEffect(() => {
    if (!currentUser?.id) return;
    localStorage.setItem(getStorageKey(currentUser.id), JSON.stringify(customCategories));
  }, [customCategories, currentUser?.id]);

  useEffect(() => {
    setLoadingCases(true);
    const q = query(collection(dbFirestore, 'caseFiles'), orderBy('updatedAt', 'desc'));
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

  const requestDeleteCase = (caseFile: CaseFile) => {
    if (!caseFile || !caseFile.id) {
        toast.error("Invalid case selected for deletion.");
        return;
    }
    setConfirmationModal({
        show: true,
        message: `Are you sure you want to delete the case "${caseFile.title}"? This action cannot be undone.`,
        onConfirm: () => confirmDeleteCase(caseFile.id!),
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
  const myCases = cases.filter(c => c.assignedToId === currentUser?.id && (c.status === 'Open - Assigned' || c.status === 'Under Review'));
  const closedCases = cases.filter(c => c.status.startsWith('Closed') || c.status === 'Archived');
  const canManageCases = ["LEAD", "SUPER"].includes(currentUser?.certifications?.CIU?.toUpperCase() || "");

  // Cases not in any custom category
  const uncategorizedCaseIds = myCases
    .map(c => c.id)
    .filter(id => !customCategories.some(cat => cat.caseIds.includes(id)));

  // Helper: get case by id
  const getCaseById = (id: string) => myCases.find(c => c.id === id);

  // --- DnD Setup ---
  const sensors = useSensors(useSensor(PointerSensor));

  // --- DnD Handlers ---
  function handleDragEnd(event: any, categoryId: string | null) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCustomCategories(prev => {
      if (categoryId) {
        return prev.map(cat => {
          if (cat.id !== categoryId) return cat;
          const oldIdx = cat.caseIds.indexOf(active.id);
          const newIdx = cat.caseIds.indexOf(over.id);
          if (oldIdx === -1 || newIdx === -1) return cat;
          return { ...cat, caseIds: arrayMove(cat.caseIds, oldIdx, newIdx) };
        });
      } else {
        const uncategorized = uncategorizedCaseIds;
        const oldIdx = uncategorized.indexOf(active.id);
        const newIdx = uncategorized.indexOf(over.id);
        if (oldIdx === -1 || newIdx === -1) return prev;
        let newCats = prev.map(cat => ({
          ...cat,
          caseIds: cat.caseIds.filter(cid => cid !== active.id),
        }));
        const newUncat = arrayMove(uncategorized, oldIdx, newIdx);
        return newCats;
      }
    });
  }

  // --- Category Management ---
  function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    setCustomCategories(prev => [
      ...prev,
      { id: `cat-${Date.now()}`, name: newCategoryName.trim(), caseIds: [] }
    ]);
    setNewCategoryName('');
    setShowCategoryDialog(false);
  }

  function handleRenameCategory(catId: string, newName: string) {
    setCustomCategories(prev =>
      prev.map(cat => (cat.id === catId ? { ...cat, name: newName } : cat))
    );
  }

  function handleDeleteCategory(catId: string) {
    setCustomCategories(prev =>
      prev.filter(cat => cat.id !== catId)
    );
  }

  function handleMoveCaseToCategory(caseId: string, targetCatId: string | null) {
    setCustomCategories(prev => {
      let newCats = prev.map(cat => ({
        ...cat,
        caseIds: cat.caseIds.filter(cid => cid !== caseId),
      }));
      if (targetCatId) {
        newCats = newCats.map(cat =>
          cat.id === targetCatId
            ? { ...cat, caseIds: [...cat.caseIds, caseId] }
            : cat
        );
      }
      return newCats;
    });
  }

  // --- Sortable Row Component ---
  function SortableCaseRow({ caseFile, onEdit, onMove, categories }: {
    caseFile: CaseFile;
    onEdit: (c: CaseFile) => void;
    onMove: (caseId: string, catId: string | null) => void;
    categories: { id: string; name: string }[];
  }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: caseFile.id });
    return (
      <TableRow
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          background: transform ? "#222" : undefined,
        }}
        className="border-b border-border hover:bg-muted/50 group"
        {...attributes}
        {...listeners}
      >
        <TableCell className="px-4 py-2 font-medium cursor-pointer hover:underline text-foreground" onClick={() => onEdit(caseFile)}>
          {caseFile.title}
        </TableCell>
        <TableCell className="px-4 py-2 text-xs text-muted-foreground">{caseFile.status}</TableCell>
        <TableCell className="px-4 py-2 text-xs text-muted-foreground">{caseFile.assignedToName || <span className="italic">Unassigned</span>}</TableCell>
        <TableCell className="px-4 py-2 text-xs text-muted-foreground">
          {caseFile.updatedAt && typeof caseFile.updatedAt === "object" && "toDate" in caseFile.updatedAt
            ? formatTimestampForDisplay(caseFile.updatedAt)
            : ""}
        </TableCell>
        <TableCell className="px-4 py-2 text-right">
          <div className="flex gap-2 justify-end">
            <Button size="icon" variant="ghost" onClick={() => onEdit(caseFile)} title="Edit" className="h-7 w-7">
              <FaEdit className="h-3.5 w-3.5" />
            </Button>
            <div className="relative">
              <Select onValueChange={catId => onMove(caseFile.id, catId === "uncat" ? null : catId)}>
                <SelectTrigger className="w-24 h-7 text-xs">
                  <SelectValue placeholder="Move" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncat">Uncategorized</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  // --- Render My Cases with Categories and DnD ---
  function renderMyCasesWithDnD() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-foreground">My Active Assigned Cases ({myCases.length})</h3>
          <Button variant="outline" size="sm" onClick={() => setShowCategoryDialog(true)}>
            <FaPlusCircle className="mr-2" /> Add Category
          </Button>
        </div>
        {customCategories.map(cat => (
          <div key={cat.id} className="mb-6 border rounded-md border-border bg-muted/30">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{cat.name}</span>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat.id)} title="Delete Category" className="text-destructive h-6 w-6">
                  <FaTrash className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={e => handleDragEnd(e, cat.id)}
            >
              <SortableContext items={cat.caseIds} strategy={verticalListSortingStrategy}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cat.caseIds.map(cid => {
                      const caseFile = getCaseById(cid);
                      if (!caseFile) return null;
                      return (
                        <SortableCaseRow
                          key={cid}
                          caseFile={caseFile}
                          onEdit={handleOpenEditModal}
                          onMove={handleMoveCaseToCategory}
                          categories={customCategories}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
              </SortableContext>
            </DndContext>
          </div>
        ))}
        <div className="border rounded-md border-border bg-muted/10">
          <div className="px-4 py-2 border-b border-border font-semibold">Uncategorized</div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={e => handleDragEnd(e, null)}
          >
            <SortableContext items={uncategorizedCaseIds} strategy={verticalListSortingStrategy}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uncategorizedCaseIds.map(cid => {
                    const caseFile = getCaseById(cid);
                    if (!caseFile) return null;
                    return (
                      <SortableCaseRow
                        key={cid}
                        caseFile={caseFile}
                        onEdit={handleOpenEditModal}
                        onMove={handleMoveCaseToCategory}
                        categories={customCategories}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </SortableContext>
          </DndContext>
        </div>
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Category</DialogTitle>
            </DialogHeader>
            <ShadcnInput
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              className="mb-4"
            />
            <DialogFooter>
              <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const renderCaseList = (caseList: CaseFile[], listTitle: string) => (
    <div className="space-y-3">
      <h3 className="text-lg font-medium text-foreground">{listTitle} ({caseList.length})</h3>
      {loadingCases ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full bg-muted border border-border" />
          <Skeleton className="h-12 w-full bg-muted border border-border" />
        </div>
      ) : caseList.length === 0 ? (
        <p className="text-muted-foreground italic text-sm">No cases in this category.</p>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="px-4 py-2 text-left font-medium text-muted-foreground">Title</TableHead>
                        <TableHead className="px-4 py-2 text-left font-medium text-muted-foreground">Status</TableHead>
                        <TableHead className="px-4 py-2 text-left font-medium text-muted-foreground">Assigned To</TableHead>
                        <TableHead className="px-4 py-2 text-left font-medium text-muted-foreground">Last Updated</TableHead>
                        {canManageCases && <TableHead className="px-4 py-2 text-right font-medium text-muted-foreground">Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {caseList.map(caseFile => (
                        <TableRow key={caseFile.id} className="border-b border-border hover:bg-muted/50 group">
                            <TableCell className="px-4 py-2 font-medium cursor-pointer hover:underline text-foreground" onClick={() => handleOpenEditModal(caseFile)}>
                                {caseFile.title}
                            </TableCell>
                            <TableCell className="px-4 py-2 text-xs text-muted-foreground">{caseFile.status}</TableCell>
                            <TableCell className="px-4 py-2 text-xs text-muted-foreground">{caseFile.assignedToName || <span className="italic">Unassigned</span>}</TableCell>
                            <TableCell className="px-4 py-2 text-xs text-muted-foreground">
                                {caseFile.updatedAt && typeof caseFile.updatedAt === "object" && "toDate" in caseFile.updatedAt
                                  ? formatTimestampForDisplay(caseFile.updatedAt)
                                  : ""}
                            </TableCell>
                            {canManageCases && (
                                <TableCell className="px-4 py-2 text-right">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => requestDeleteCase(caseFile)}
                                        className="text-destructive hover:text-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                                        title="Delete Case"
                                    >
                                        <FaTrash className="h-3.5 w-3.5" />
                                    </Button>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 bg-card p-4 rounded-lg border border-border">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-foreground">Case Files Dashboard</h2>
        <Button onClick={handleOpenCreateModal} disabled={loadingAssignees} className="bg-brand hover:bg-brand-dark text-black font-semibold">Create New Case</Button>
      </div>

      {error && <p className="text-destructive">{error}</p>}

      <Tabs defaultValue="myCases" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="bg-transparent p-0 border-b border-border">
          <TabsTrigger value="myCases" className="bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black">My Active Cases</TabsTrigger>
          <TabsTrigger value="unassigned" className="bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black">Unassigned</TabsTrigger>
          <TabsTrigger value="assigned" className="bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black">All Assigned</TabsTrigger>
          <TabsTrigger value="closed" className="bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black">Closed/Archived</TabsTrigger>
        </TabsList>
        <TabsContent value="myCases" className="bg-card p-4 rounded-b-md">
          {renderMyCasesWithDnD()}
        </TabsContent>
        <TabsContent value="unassigned" className="bg-card p-4 rounded-b-md">
          {renderCaseList(unassignedCases, "Open Unassigned Cases")}
        </TabsContent>
        <TabsContent value="assigned" className="bg-card p-4 rounded-b-md">
          {renderCaseList(assignedCases, "All Open Assigned Cases")}
        </TabsContent>
        <TabsContent value="closed" className="bg-card p-4 rounded-b-md">
          {renderCaseList(closedCases, "Closed & Archived Cases")}
        </TabsContent>
      </Tabs>

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
