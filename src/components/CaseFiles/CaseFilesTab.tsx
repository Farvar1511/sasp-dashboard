import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { CaseFile, CaseStatus } from '../../utils/ciuUtils';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Skeleton } from '../ui/skeleton';
import { toast } from 'react-toastify';
import ConfirmationModal from '../ConfirmationModal';
import { FaTrash, FaPlusCircle, FaEdit, FaSave } from 'react-icons/fa';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { formatTimestampForDisplay } from '../../utils/timeHelpers';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Input as ShadcnInput } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { collection as fbCollection, doc as fbDoc, setDoc } from 'firebase/firestore';

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

const getStorageKey = (userId: string) => `casefiles_categories_${userId}`;

const CaseFilesTab: React.FC<CaseFilesTabProps> = ({ openCreateModal, openEditModal, loadingAssignees }) => {
  const { user: currentUser } = useAuth();
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState | null>(null);
  const [activeTab, setActiveTab] = useState('myCases');
  const [updatingStatusCaseId, setUpdatingStatusCaseId] = useState<string | null>(null);

  const [customCategories, setCustomCategories] = useState<{ id: string; name: string; caseIds: string[] }[]>([]);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const sensors = useSensors(useSensor(PointerSensor));

  const isLeadOrSuper = useMemo(() => {
    const ciuCert = currentUser?.certifications?.['CIU'];
    return ciuCert === 'LEAD' || ciuCert === 'SUPER';
  }, [currentUser]);

  useEffect(() => {
    const fetchCategoriesFromFirestore = async () => {
      if (!currentUser?.id) return;
      try {
        const userDoc = fbDoc(dbFirestore, "users", currentUser.id);
        const categoriesDoc = fbDoc(fbCollection(userDoc, "ciucasecategories"), "categories");
        const snap = await getDoc(categoriesDoc);
        if (snap.exists()) {
          const data = snap.data();
          if (data && Array.isArray(data.categories)) {
            setCustomCategories(data.categories);
            localStorage.setItem(getStorageKey(currentUser.id), JSON.stringify(data.categories));
            return;
          }
        }
        const raw = localStorage.getItem(getStorageKey(currentUser.id));
        if (raw) {
          setCustomCategories(JSON.parse(raw));
        }
      } catch (err) {
        const raw = localStorage.getItem(getStorageKey(currentUser.id));
        if (raw) {
          setCustomCategories(JSON.parse(raw));
        }
      }
    };
    fetchCategoriesFromFirestore();
  }, [currentUser?.id]);

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
        setCustomCategories(prev => prev.map(cat => ({
            ...cat,
            caseIds: cat.caseIds.filter(cid => cid !== caseId)
        })));
    } catch (err) {
        console.error("Error deleting case file:", err);
        toast.error("Failed to delete case file.");
    }
  };

  const handleStatusUpdate = async (caseId: string, newStatus: CaseStatus) => {
    if (!caseId) return;
    setUpdatingStatusCaseId(caseId);
    try {
      const caseRef = doc(dbFirestore, 'caseFiles', caseId);
      await updateDoc(caseRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Case status updated to "${newStatus}".`);
    } catch (err) {
      console.error("Error updating case status:", err);
      toast.error("Failed to update case status.");
    } finally {
      setUpdatingStatusCaseId(null);
    }
  };

  const unassignedCases = cases.filter(c => c.status === 'Open - Unassigned');
  const assignedCases = cases.filter(c => c.status === 'Open - Assigned' || c.status === 'Under Review');
  const myCases = cases.filter(c => c.assignedToId === currentUser?.id && (c.status === 'Open - Assigned' || c.status === 'Under Review'));
  const closedCases = cases.filter(c => c.status.startsWith('Closed') || c.status === 'Archived');
  const canManageCases = isLeadOrSuper;

  const uncategorizedCaseIds = myCases
    .map(c => c.id)
    .filter(id => !customCategories.some(cat => cat.caseIds.includes(id)));

  const getCaseById = (id: string) => myCases.find(c => c.id === id);

  function handleCaseDragEnd(event: any, categoryId: string | null) {
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
        return prev;
      }
    });
  }

  function handleCategoryDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCustomCategories(prev => {
      const oldIdx = prev.findIndex(cat => cat.id === active.id);
      const newIdx = prev.findIndex(cat => cat.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

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
    const updatedName = prompt("Enter new category name:", newName);
    if (updatedName && updatedName.trim()) {
        setCustomCategories(prev =>
            prev.map(cat => (cat.id === catId ? { ...cat, name: updatedName.trim() } : cat))
        );
    }
  }

  function handleDeleteCategory(catId: string) {
     if (window.confirm("Are you sure you want to delete this category? Cases within it will become uncategorized.")) {
        setCustomCategories(prev =>
            prev.filter(cat => cat.id !== catId)
        );
     }
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

  const handleSaveCategoriesToFirestore = async () => {
    if (!currentUser?.id) return;
    try {
      const userDoc = fbDoc(dbFirestore, "users", currentUser.id);
      const categoriesCol = fbCollection(userDoc, "ciucasecategories");
      await setDoc(fbDoc(categoriesCol, "categories"), { categories: customCategories });
      toast.success("Categories saved to cloud!");
    } catch (err) {
      toast.error("Failed to save categories to cloud.");
      console.error(err);
    }
  };

  function SortableCaseRow({ caseFile, onEdit, onMove, categories, onStatusChange, isUpdating }: {
    caseFile: CaseFile;
    onEdit: (c: CaseFile) => void;
    onMove: (caseId: string, catId: string | null) => void;
    categories: { id: string; name: string }[];
    onStatusChange: (caseId: string, newStatus: CaseStatus) => void;
    isUpdating: boolean;
  }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: caseFile.id });
    const canEditStatus = isLeadOrSuper || currentUser?.id === caseFile.assignedToId;
    const activeStatuses: CaseStatus[] = ['Open - Assigned', 'Under Review'];

    return (
      <TableRow
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          background: isDragging ? "hsl(var(--muted))" : "hsl(var(--background))",
          boxShadow: isDragging ? "0 0 0 2px hsl(var(--primary)), 0 2px 12px #0008" : undefined,
        }}
        className={`border-b border-border group hover:bg-muted transition-colors ${isDragging ? "ring-2 ring-primary" : ""}`}
      >
        <TableCell
          className="px-4 py-3 font-medium cursor-pointer hover:underline text-foreground text-sm"
          onClick={() => onEdit(caseFile)}
        >
          {caseFile.title}
        </TableCell>
        <TableCell className="px-4 py-3 text-sm text-muted-foreground w-48">
          {canEditStatus ? (
            <Select
              value={caseFile.status}
              onValueChange={(newStatus: CaseStatus) => onStatusChange(caseFile.id, newStatus)}
              disabled={isUpdating}
            >
              <SelectTrigger className="h-8 text-xs bg-input border-border data-[state=open]:ring-primary">
                <SelectValue placeholder="Set Status" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                {activeStatuses.map(stat => (
                  <SelectItem key={stat} value={stat} className="text-xs">{stat}</SelectItem>
                ))}
                <SelectItem value="Closed - Solved" className="text-xs">Closed - Solved</SelectItem>
                <SelectItem value="Closed - Unsolved" className="text-xs">Closed - Unsolved</SelectItem>
                <SelectItem value="Archived" className="text-xs">Archived</SelectItem>
              </SelectContent>
            </Select>
          ) : (
             <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                caseFile.status.startsWith('Open') || caseFile.status === 'Under Review' ? 'bg-green-800 text-green-100' :
                caseFile.status.startsWith('Closed') ? 'bg-red-800 text-red-100' :
                'bg-gray-700 text-gray-200'
            }`}>
                {caseFile.status}
            </span>
          )}
           {isUpdating && <FaSave className="animate-spin h-3 w-3 ml-2 inline-block text-primary" />}
        </TableCell>
        <TableCell className="px-4 py-3 text-sm text-muted-foreground">{caseFile.assignedToName || <span className="italic">Unassigned</span>}</TableCell>
        <TableCell className="px-4 py-3 text-sm text-muted-foreground">
          {caseFile.updatedAt && typeof caseFile.updatedAt === "object" && "toDate" in caseFile.updatedAt
            ? formatTimestampForDisplay(caseFile.updatedAt)
            : ""}
        </TableCell>
        <TableCell className="px-4 py-3 text-right">
          <div className="flex gap-2 justify-end items-center">
            <span
              {...attributes}
              {...listeners}
              className="cursor-grab text-muted-foreground hover:text-foreground transition select-none px-1"
              title="Drag to reorder"
              aria-label="Drag to reorder"
              tabIndex={-1}
              style={{ fontSize: 18, userSelect: "none" }}
            >
              &#9776;
            </span>
            <Button size="icon" variant="ghost" onClick={() => onEdit(caseFile)} title="Edit Details" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <FaEdit className="h-3.5 w-3.5" />
            </Button>
            <div className="relative">
              <Select onValueChange={catId => onMove(caseFile.id, catId === "uncat" ? null : catId)}>
                <SelectTrigger className="w-24 h-7 text-xs bg-input border-border">
                  <SelectValue placeholder="Move" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
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

  function SortableCategory({ cat, children }: { cat: { id: string; name: string; caseIds: string[] }, children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
    return (
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          background: isDragging ? "hsl(var(--muted))" : "hsl(var(--background))",
          boxShadow: isDragging ? "0 0 0 2px hsl(var(--primary)), 0 2px 12px #0008" : undefined,
        }}
        className={`mb-8 border border-border rounded-xl shadow-lg bg-background ${isDragging ? "ring-2 ring-primary" : ""}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted rounded-t-xl">
          <div className="flex items-center gap-2">
            <span
              {...attributes}
              {...listeners}
              className="cursor-grab text-muted-foreground hover:text-foreground transition select-none px-1"
              title="Drag to reorder category"
              aria-label="Drag to reorder category"
              tabIndex={-1}
              style={{ fontSize: 20, userSelect: "none" }}
            >
              &#9776;
            </span>
            <span
                className="font-semibold text-lg text-foreground cursor-pointer hover:text-primary"
                onClick={() => handleRenameCategory(cat.id, cat.name)}
                title="Click to rename category"
            >
                {cat.name}
            </span>
            <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat.id)} title="Delete Category" className="text-destructive h-6 w-6">
              <FaTrash className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {children}
      </div>
    );
  }

  function renderMyCasesWithDnD() {
     if (loadingCases) {
        return <Skeleton className="h-40 w-full bg-muted border border-border" />;
    }
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-foreground">My Active Assigned Cases ({myCases.length})</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveCategoriesToFirestore} className="border-border text-foreground hover:bg-muted font-semibold">
              Save Categories
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCategoryDialog(true)} className="border-border text-foreground hover:bg-muted font-semibold">
              <FaPlusCircle className="mr-2" /> Add Category
            </Button>
          </div>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleCategoryDragEnd}
        >
          <SortableContext items={customCategories.map(cat => cat.id)} strategy={verticalListSortingStrategy}>
            {customCategories.map(cat => (
              <SortableCategory key={cat.id} cat={cat}>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={e => handleCaseDragEnd(e, cat.id)}
                >
                  <SortableContext items={cat.caseIds} strategy={verticalListSortingStrategy}>
                    <Table className="bg-background">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-muted-foreground text-sm font-medium">Title</TableHead>
                          <TableHead className="text-muted-foreground text-sm font-medium w-48">Status</TableHead>
                          <TableHead className="text-muted-foreground text-sm font-medium">Assigned To</TableHead>
                          <TableHead className="text-muted-foreground text-sm font-medium">Last Updated</TableHead>
                          <TableHead className="text-muted-foreground text-sm font-medium text-right">Actions</TableHead>
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
                              onStatusChange={handleStatusUpdate}
                              isUpdating={updatingStatusCaseId === cid}
                            />
                          );
                        })}
                        {cat.caseIds.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground italic py-4">Drag cases here or use the 'Move' dropdown</TableCell>
                            </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </SortableContext>
                </DndContext>
              </SortableCategory>
            ))}
          </SortableContext>
        </DndContext>
        <div className="border border-border rounded-xl bg-background shadow-lg">
          <div className="px-4 py-3 border-b border-border font-semibold text-lg text-foreground bg-muted rounded-t-xl">Uncategorized</div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={e => handleCaseDragEnd(e, null)}
          >
            <SortableContext items={uncategorizedCaseIds} strategy={verticalListSortingStrategy}>
              <Table className="bg-background">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-muted-foreground text-sm font-medium">Title</TableHead>
                    <TableHead className="text-muted-foreground text-sm font-medium w-48">Status</TableHead>
                    <TableHead className="text-muted-foreground text-sm font-medium">Assigned To</TableHead>
                    <TableHead className="text-muted-foreground text-sm font-medium">Last Updated</TableHead>
                    <TableHead className="text-muted-foreground text-sm font-medium text-right">Actions</TableHead>
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
                        onStatusChange={handleStatusUpdate}
                        isUpdating={updatingStatusCaseId === cid}
                      />
                    );
                  })}
                   {uncategorizedCaseIds.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground italic py-4">No uncategorized cases</TableCell>
                        </TableRow>
                    )}
                </TableBody>
              </Table>
            </SortableContext>
          </DndContext>
        </div>
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent className="bg-background border-border">
            <DialogHeader>
              <DialogTitle>Add Category</DialogTitle>
            </DialogHeader>
            <ShadcnInput
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              className="mb-4 bg-input border-border"
            />
            <DialogFooter>
              <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90">Add</Button>
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
                <TableHeader className="bg-muted">
                    <TableRow>
                        <TableHead className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">Title</TableHead>
                        <TableHead className="px-4 py-2 text-left text-sm font-medium text-muted-foreground w-48">Status</TableHead>
                        <TableHead className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">Assigned To</TableHead>
                        <TableHead className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">Last Updated</TableHead>
                        <TableHead className="px-4 py-2 text-right text-sm font-medium text-muted-foreground">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {caseList.map(caseFile => {
                        const canEditThisListStatus = isLeadOrSuper;
                        return (
                            <TableRow key={caseFile.id} className="border-b border-border hover:bg-muted group">
                                <TableCell className="px-4 py-3 font-medium cursor-pointer hover:underline text-foreground text-sm" onClick={() => handleOpenEditModal(caseFile)}>
                                    {caseFile.title}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-sm text-muted-foreground w-48">
                                  {canEditThisListStatus ? (
                                    <Select
                                      value={caseFile.status}
                                      onValueChange={(newStatus: CaseStatus) => handleStatusUpdate(caseFile.id, newStatus)}
                                      disabled={updatingStatusCaseId === caseFile.id}
                                    >
                                      <SelectTrigger className="h-8 text-xs bg-input border-border data-[state=open]:ring-primary">
                                        <SelectValue placeholder="Set Status" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-background border-border">
                                        {(['Open - Unassigned', 'Open - Assigned', 'Under Review', 'Closed - Solved', 'Closed - Unsolved', 'Archived'] as CaseStatus[]).map(stat => (
                                          <SelectItem key={stat} value={stat} className="text-xs">{stat}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        caseFile.status.startsWith('Open') || caseFile.status === 'Under Review' ? 'bg-green-800 text-green-100' :
                                        caseFile.status.startsWith('Closed') ? 'bg-red-800 text-red-100' :
                                        'bg-gray-700 text-gray-200'
                                    }`}>
                                        {caseFile.status}
                                    </span>
                                  )}
                                  {updatingStatusCaseId === caseFile.id && <FaSave className="animate-spin h-3 w-3 ml-2 inline-block text-primary" />}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-sm text-muted-foreground">{caseFile.assignedToName || <span className="italic">Unassigned</span>}</TableCell>
                                <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                                    {caseFile.updatedAt && typeof caseFile.updatedAt === "object" && "toDate" in caseFile.updatedAt
                                      ? formatTimestampForDisplay(caseFile.updatedAt)
                                      : ""}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleOpenEditModal(caseFile)}
                                            className="text-muted-foreground hover:text-foreground h-7 w-7"
                                            title="Edit Details"
                                        >
                                            <FaEdit className="h-3.5 w-3.5" />
                                        </Button>
                                        {isLeadOrSuper && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => requestDeleteCase(caseFile)}
                                                className="text-destructive hover:text-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                                                title="Delete Case"
                                            >
                                                <FaTrash className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
      )}
    </div>
  );

  return (
    <div className={`space-y-8 bg-background p-6 md:p-8 rounded-2xl border border-border shadow-xl max-w-[90rem] mx-auto text-foreground`}>
      <div className="flex justify-between items-center pb-4 border-b border-border">
        <h2 className="text-3xl font-bold text-foreground tracking-tight">Case Files Dashboard</h2>
        <Button
          onClick={handleOpenCreateModal}
          disabled={loadingAssignees}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-2 rounded-lg shadow transition"
        >
          Create New Case
        </Button>
      </div>

      {error && <p className="text-destructive">{error}</p>}

      <Tabs defaultValue="myCases" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="bg-transparent p-0 border-b border-border gap-2">
          <TabsTrigger
            value="myCases"
            className="bg-transparent text-white px-6 py-3 text-lg font-semibold data-[state=active]:text-black data-[state=active]:bg-[#f3c700] rounded-t-lg transition"
          >
            My Active Cases
          </TabsTrigger>
          <TabsTrigger
            value="unassigned"
            className="bg-transparent text-white px-6 py-3 text-lg font-semibold data-[state=active]:text-black data-[state=active]:bg-[#f3c700] rounded-t-lg transition"
          >
            Unassigned
          </TabsTrigger>
          <TabsTrigger
            value="assigned"
            className="bg-transparent text-white px-6 py-3 text-lg font-semibold data-[state=active]:text-black data-[state=active]:bg-[#f3c700] rounded-t-lg transition"
          >
            All Assigned
          </TabsTrigger>
          <TabsTrigger
            value="closed"
            className="bg-transparent text-white px-6 py-3 text-lg font-semibold data-[state=active]:text-black data-[state=active]:bg-[#f3c700] rounded-t-lg transition"
          >
            Closed/Archived
          </TabsTrigger>
        </TabsList>
        <TabsContent value="myCases" className="bg-background p-6 rounded-b-2xl border-t-0">
          {renderMyCasesWithDnD()}
        </TabsContent>
        <TabsContent value="unassigned" className="bg-background p-6 rounded-b-2xl border-t-0">
          {renderCaseList(unassignedCases, "Open Unassigned Cases")}
        </TabsContent>
        <TabsContent value="assigned" className="bg-background p-6 rounded-b-2xl border-t-0">
          {renderCaseList(assignedCases, "All Open Assigned Cases")}
        </TabsContent>
        <TabsContent value="closed" className="bg-background p-6 rounded-b-2xl border-t-0">
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
