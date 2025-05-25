import React, { useMemo, useState, useEffect, useCallback } from "react";
import Layout from "./Layout";
import localLinksDataFromFile from "../data/links"; // Renamed to avoid conflict
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "./ui/dialog";
import { Label } from "./ui/label";
import ConfirmationModal from "./ConfirmationModal";
import { ChevronUp, ChevronDown, Pencil } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase"; // Import db
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where, 
  writeBatch,
  QuerySnapshot,
  DocumentData
} from "firebase/firestore";

interface LinkItem {
  id: string; // Firestore document ID - now mandatory
  Label: string;
  Url: string;
  Category: string;
  orderInCategory: number;
}

// Type for data to be added to Firestore (ID is auto-generated)
type NewLinkData = Omit<LinkItem, 'id'>;

// Helper to prepare localLinksData for initial Firestore seeding
const prepareInitialDataForFirestore = (links: Omit<LinkItem, 'id' | 'orderInCategory'>[]): NewLinkData[] => {
  const categorized = links.reduce((acc, link) => {
    const cat = link.Category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(link);
    return acc;
  }, {} as Record<string, Omit<LinkItem, 'id' | 'orderInCategory'>[]>);

  const processedLinks: NewLinkData[] = [];
  Object.values(categorized).forEach(categoryLinks => {
    categoryLinks.forEach((link, index) => {
      processedLinks.push({
        Label: link.Label,
        Url: link.Url,
        Category: link.Category,
        orderInCategory: index + 1,
      });
    });
  });
  return processedLinks;
};

const linksCollectionRef = collection(db, "sasp-links");

const Documents: React.FC = () => {
  const [modalLink, setModalLink] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [firebaseLinks, setFirebaseLinks] = useState<LinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isEditMode, setIsEditMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  // currentLinkData for the form, ID and orderInCategory are handled separately
  const [currentLinkData, setCurrentLinkData] = useState<Omit<LinkItem, 'id' | 'orderInCategory'>>({ Label: "", Url: "", Category: "" });
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [editingCategoryName, setEditingCategoryName] = useState<string>("");
  const [newCategoryNameInput, setNewCategoryNameInput] = useState<string>("");

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [linkIdToDelete, setLinkIdToDelete] = useState<string | null>(null);

  const { user, isAdmin } = useAuth();
  const canEditContent = isAdmin;

  const fetchLinksFromFirestore = async (): Promise<LinkItem[]> => {
    const q = query(linksCollectionRef, orderBy("Category"), orderBy("orderInCategory"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as LinkItem));
  };
  
  const reorderLinksInCategory = async (category: string, excludedLinkId?: string) => {
    const batch = writeBatch(db);
    const q = query(linksCollectionRef, where("Category", "==", category), orderBy("orderInCategory"));
    const snapshot = await getDocs(q);
    let order = 1;
    snapshot.docs.forEach(doc => {
      if (doc.id !== excludedLinkId) {
        batch.update(doc.ref, { orderInCategory: order++ });
      }
    });
    await batch.commit();
  };

  const loadLinks = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log("Attempting to fetch links from Firestore...");
      let links = await fetchLinksFromFirestore();
      console.log(`Fetched ${links.length} links from Firestore.`);
      
      // Log status of localLinksDataFromFile for debugging seeding condition
      if (localLinksDataFromFile) {
        console.log(`localLinksDataFromFile imported. Length: ${localLinksDataFromFile.length}`);
      } else {
        console.log("localLinksDataFromFile is undefined or null. Seeding from local file will not occur.");
      }

      if (links.length === 0 && localLinksDataFromFile && localLinksDataFromFile.length > 0) {
        console.log("Firestore 'sasp-links' is empty and local data is available. Seeding Firestore...");
        const initialData = prepareInitialDataForFirestore(localLinksDataFromFile);
        const batch = writeBatch(db);
        initialData.forEach(link => {
          const newLinkRef = doc(linksCollectionRef); // Auto-generate ID
          batch.set(newLinkRef, link);
        });
        await batch.commit();
        console.log("Firestore seeding complete. Re-fetching links from Firestore...");
        links = await fetchLinksFromFirestore(); // Re-fetch after seeding to get Firestore-generated IDs
        console.log(`Fetched ${links.length} links after seeding.`);
      }
      setFirebaseLinks(links);
    } catch (err) {
      console.error("Failed to load or seed links:", err);
      // Consider setting an error state here to display a message in the UI
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const grouped = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filteredLinks = firebaseLinks.filter(
      (l) =>
        l.Label.toLowerCase().includes(term) ||
        l.Category.toLowerCase().includes(term)
    );

    const acc: Record<string, LinkItem[]> = {};
    filteredLinks.forEach(link => {
      const cat = link.Category || "Uncategorized";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(link);
    });

    // Sort links within each category by orderInCategory
    for (const cat in acc) {
      acc[cat].sort((a, b) => a.orderInCategory - b.orderInCategory);
    }
    return acc;
  }, [searchTerm, firebaseLinks]);

  const order = [
    "Standard Operating Procedures",
    "Training",
    "Resources",
    "Department of Justice",
  ];
  const cats = Object.keys(grouped).sort((a, b) => {
    const ia = order.indexOf(a),
      ib = order.indexOf(b);
    if (ia !== -1 || ib !== -1) return ia === -1 ? 1 : ib === -1 ? -1 : ia - ib;
    return a.localeCompare(b);
  });

  const handleOpenAddModal = () => {
    if (!canEditContent) return; // Guard clause
    setModalMode("add");
    setCurrentLinkData({ Label: "", Url: "", Category: "" }); // orderInCategory is handled on save
    setEditingLinkId(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (link: LinkItem) => {
    if (!canEditContent) return;
    setModalMode("edit");
    setCurrentLinkData({ Label: link.Label, Url: link.Url, Category: link.Category });
    setEditingLinkId(link.id);
    setIsModalOpen(true);
  };

  const handleSaveLink = async () => {
    if (!canEditContent) return;
    if (!currentLinkData.Label || !currentLinkData.Url || !currentLinkData.Category) {
      alert("Please fill in all fields.");
      return;
    }
    setIsLoading(true);
    try {
      if (modalMode === "add") {
        const q = query(linksCollectionRef, where("Category", "==", currentLinkData.Category));
        const snapshot = await getDocs(q);
        const newOrderInCategory = snapshot.size + 1;
        
        const newLink: NewLinkData = {
          ...currentLinkData,
          orderInCategory: newOrderInCategory,
        };
        await addDoc(linksCollectionRef, newLink);
      } else if (editingLinkId) {
        const originalLink = firebaseLinks.find(l => l.id === editingLinkId);
        if (!originalLink) throw new Error("Original link not found for editing.");

        const linkRef = doc(db, "sasp-links", editingLinkId);
        const updatedFields: Partial<LinkItem> = { ...currentLinkData };

        if (originalLink.Category !== currentLinkData.Category) {
          // Category changed
          const qNewCat = query(linksCollectionRef, where("Category", "==", currentLinkData.Category));
          const snapshotNewCat = await getDocs(qNewCat);
          updatedFields.orderInCategory = snapshotNewCat.size + 1;
          
          await updateDoc(linkRef, updatedFields);
          await reorderLinksInCategory(originalLink.Category, editingLinkId); // Reorder old category
        } else {
          // Category did not change, only update Label/Url (orderInCategory is handled by handleLinkOrderChange)
          await updateDoc(linkRef, { Label: currentLinkData.Label, Url: currentLinkData.Url, Category: currentLinkData.Category });
        }
      }
      await loadLinks(); 
      setIsModalOpen(false);
    } catch (err) {
      console.error("Failed to save link:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLink = (linkId: string) => {
    if (!canEditContent) return; // Guard clause
    setLinkIdToDelete(linkId);
    setIsDeleteConfirmOpen(true);
  };

  const executeDeleteLink = async () => {
    if (!canEditContent || !linkIdToDelete) return;
    setIsLoading(true);
    try {
      const linkToDelete = firebaseLinks.find(l => l.id === linkIdToDelete);
      if (!linkToDelete) throw new Error("Link to delete not found in state.");

      const linkRef = doc(db, "sasp-links", linkIdToDelete);
      await deleteDoc(linkRef);
      
      // Reorder links in the affected category
      await reorderLinksInCategory(linkToDelete.Category);
      
      await loadLinks(); // Refresh the list
    } catch (err) {
      console.error("Failed to delete link:", err);
    } finally {
      setIsLoading(false);
      setIsDeleteConfirmOpen(false);
      setLinkIdToDelete(null);
    }
  };

  const handleOpenEditCategoryModal = (categoryName: string) => {
    if (!canEditContent) return; // Guard clause
    setEditingCategoryName(categoryName);
    setNewCategoryNameInput(categoryName);
    setIsEditCategoryModalOpen(true);
  };

  const handleSaveCategoryName = async () => {
    if (!canEditContent) return;
    if (!newCategoryNameInput.trim() || newCategoryNameInput.trim() === editingCategoryName) {
      alert("New category name cannot be empty or the same as the old name.");
      return;
    }
    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      const q = query(linksCollectionRef, where("Category", "==", editingCategoryName));
      const snapshot = await getDocs(q);
      snapshot.docs.forEach(document => {
        batch.update(doc(db, "sasp-links", document.id), { Category: newCategoryNameInput.trim() });
      });
      await batch.commit();
      
      // Update expanded state
      if (expanded[editingCategoryName] !== undefined) {
        setExpanded(prev => {
          const newExpandedState = { ...prev };
          newExpandedState[newCategoryNameInput.trim()] = newExpandedState[editingCategoryName];
          delete newExpandedState[editingCategoryName];
          return newExpandedState;
        });
      }
      await loadLinks();
      setIsEditCategoryModalOpen(false);
    } catch (err) {
      console.error("Failed to save category name:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkOrderChange = async (linkToMove: LinkItem, direction: 'up' | 'down') => {
    if (!canEditContent) return; // Guard clause
    setIsLoading(true);
    try {
      const linksInSameCategory = firebaseLinks
        .filter(l => l.Category === linkToMove.Category)
        .sort((a, b) => a.orderInCategory - b.orderInCategory);

      const currentIndex = linksInSameCategory.findIndex(l => l.id === linkToMove.id);
      let targetIndex = -1;

      if (direction === 'up' && currentIndex > 0) {
        targetIndex = currentIndex - 1;
      } else if (direction === 'down' && currentIndex < linksInSameCategory.length - 1) {
        targetIndex = currentIndex + 1;
      }

      if (targetIndex !== -1) {
        const batch = writeBatch(db);
        const linkToSwapWith = linksInSameCategory[targetIndex];

        // Update moved link
        const movedLinkRef = doc(db, "sasp-links", linkToMove.id);
        batch.update(movedLinkRef, { orderInCategory: linkToSwapWith.orderInCategory });

        // Update swapped link
        const swappedLinkRef = doc(db, "sasp-links", linkToSwapWith.id);
        batch.update(swappedLinkRef, { orderInCategory: linkToMove.orderInCategory });
        
        await batch.commit();
        await loadLinks(); // Refresh list
      }
    } catch (error) {
      console.error("Failed to reorder link:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && firebaseLinks.length === 0 && !user) { // Show loading only on initial fetch or if user is not yet loaded
    return (
      <Layout>
        <div className="min-h-screen p-6 lg:p-12 flex justify-center items-center text-white">
          Loading documents...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen p-6 lg:p-12 text-white space-y-8">
        {/* Header Container */}
        <div 
          className="flex justify-between items-center p-4 rounded-lg mb-8"
          style={{ backgroundColor: 'oklch(0% 0 0 / 0.95)' }} // 95% opaque black
        >
          <h1 className="text-3xl lg:text-4xl font-extrabold text-[#f3c700] flex-1 text-center"> {/* Added text-center here */}
            Documents & Resources
          </h1>
          {canEditContent && ( // Condition uses isAdmin from AuthContext
            <Button 
              onClick={() => setIsEditMode(!isEditMode)} 
              variant="outline" 
              className="ml-4 bg-[#f3c700] text-black hover:bg-yellow-500 hover:text-black focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50 flex items-center space-x-2 px-3 py-2"
            >
              <Pencil size={18} />
              <span>{isEditMode ? "Cancel Edit" : "Edit Links"}</span>
            </Button>
          )}
        </div>
        
        {isEditMode && canEditContent && ( // Condition uses isAdmin from AuthContext
          <div className="text-center mb-4">
            <Button onClick={handleOpenAddModal} className="bg-[#f3c700] text-black hover:bg-yellow-400">
              Add New Link
            </Button>
          </div>
        )}

        <div className="w-full max-w-xl mx-auto">
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-card text-foreground"
          />
        </div>

        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 gap-8">
          {cats.length === 0 && !isLoading && (
            <p className="text-center text-white/60">No documents found</p>
          )}

          {cats.map((cat) => (
            <div key={cat} className="bg-black bg-opacity-60 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition">
              <div
                onClick={() => {
                  if (!isEditMode) { 
                    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }));
                  }
                }}
                className={`${!isEditMode || !canEditContent ? 'cursor-pointer' : ''} bg-black bg-opacity-80 border-l-4 border-[#f3c700] px-6 py-4 flex justify-between items-center`}
              >
                <h2 className="text-lg lg:text-xl font-semibold text-white">{cat}</h2>
                <div className="flex items-center space-x-2">
                  {isEditMode && canEditContent && ( 
                    <Button variant="link" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenEditCategoryModal(cat);}} className="text-yellow-400 hover:text-yellow-300 p-1">
                      Edit Name
                    </Button>
                  )}
                  {isEditMode && canEditContent && (  
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setExpanded(prev => ({ ...prev, [cat]: !prev[cat] })); }}>
                      {/* Label removed, consider adding an icon here e.g., ChevronUp/Down */}
                    </Button>
                  )}
                </div>
              </div>
              {(expanded[cat] || (isEditMode && canEditContent)) && ( 
                <Card className="bg-black bg-opacity-60">
                  <CardContent className="py-4 px-6 space-y-3 max-h-[60vh] overflow-y-auto">
                    {grouped[cat].map((link) => (
                      <div key={link.id || link.Label} className="flex items-center justify-between space-x-2">
                        {isEditMode && canEditContent && ( 
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLinkOrderChange(link, 'up')}
                              disabled={isLoading || link.orderInCategory === 1}
                              className="p-1 h-auto disabled:opacity-30"
                            >
                              <ChevronUp size={18} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLinkOrderChange(link, 'down')}
                              disabled={isLoading || link.orderInCategory === grouped[cat].length}
                              className="p-1 h-auto disabled:opacity-30"
                            >
                              <ChevronDown size={18} />
                            </Button>
                          </div>
                        )}
                        <Button
                          onClick={() => !isEditMode && setModalLink(link.Url)}
                          disabled={isEditMode && canEditContent} 
                          className="flex-1 h-10 px-4 border border-[#f3c700] rounded-lg text-sm lg:text-base font-medium uppercase tracking-wider text-white bg-transparent hover:bg-[#f3c700] hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {link.Label}
                        </Button>
                        {isEditMode && canEditContent && ( 
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(link)}>Edit</Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteLink(link.id!)}>Delete</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>

        {modalLink && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col animate-fadeIn">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#f3c700]">
              <h3 className="text-xl font-semibold text-[#f3c700]">
                Document Viewer
              </h3>
              <div className="flex items-center gap-4">
                <Button variant="default" asChild>
                  <a
                    href={modalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#f3c700] text-black font-semibold rounded hover:bg-yellow-400 transition text-sm"
                  >
                    Open in New Tab
                  </a>
                </Button>
                <Button onClick={() => setModalLink(null)}>Close</Button>
              </div>
            </div>
            <iframe
              src={modalLink}
              className="flex-1 w-full border-none"
              title="Document Viewer"
            />
          </div>
        )}

        {/* Add/Edit Link Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="bg-card text-foreground">
            <DialogHeader>
              <DialogTitle>{modalMode === 'add' ? 'Add New Link' : 'Edit Link'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="label" className="text-right">Label</Label>
                <Input 
                  id="label" 
                  value={currentLinkData.Label} 
                  onChange={(e) => setCurrentLinkData(prev => ({...prev, Label: e.target.value}))} 
                  className="col-span-3 bg-input text-foreground selection:bg-yellow-500 selection:text-black"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="url" className="text-right">URL</Label>
                <Input 
                  id="url" 
                  value={currentLinkData.Url} 
                  onChange={(e) => setCurrentLinkData(prev => ({...prev, Url: e.target.value}))} 
                  className="col-span-3 bg-input text-foreground selection:bg-yellow-500 selection:text-black"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">Category</Label>
                <Input 
                  id="category" 
                  value={currentLinkData.Category} 
                  onChange={(e) => setCurrentLinkData(prev => ({...prev, Category: e.target.value}))} 
                  className="col-span-3 bg-input text-foreground selection:bg-yellow-500 selection:text-black"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSaveLink} disabled={isLoading} className="bg-[#f3c700] text-black hover:bg-yellow-400">
                {isLoading ? (modalMode === 'add' ? 'Adding...' : 'Saving...') : (modalMode === 'add' ? 'Add Link' : 'Save Changes')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Category Name Modal */}
        <Dialog open={isEditCategoryModalOpen} onOpenChange={setIsEditCategoryModalOpen}>
          <DialogContent className="bg-card text-foreground">
            <DialogHeader>
              <DialogTitle>Edit Category Name</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="old-category-name" className="text-right">Old Name</Label>
                <Input 
                  id="old-category-name" 
                  value={editingCategoryName} 
                  disabled 
                  className="col-span-3 bg-input-disabled" // Assuming a style for disabled inputs
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-category-name" className="text-right">New Name</Label>
                <Input 
                  id="new-category-name" 
                  value={newCategoryNameInput} 
                  onChange={(e) => setNewCategoryNameInput(e.target.value)} 
                  className="col-span-3 bg-input text-foreground selection:bg-yellow-500 selection:text-black"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" onClick={() => setIsEditCategoryModalOpen(false)}>Cancel</Button>
              </DialogClose>
              <Button onClick={handleSaveCategoryName} disabled={isLoading} className="bg-[#f3c700] text-black hover:bg-yellow-400">
                {isLoading ? 'Saving...' : 'Save Category Name'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={isDeleteConfirmOpen}
          onClose={() => setIsDeleteConfirmOpen(false)}
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={executeDeleteLink}
          title="Confirm Deletion"
          message="Are you sure you want to delete this link? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
        />
      </div>
    </Layout>
  );
};

export default Documents;
