import React, { useMemo, useState, useEffect, useCallback } from "react";
import Layout from "./Layout";
import localLinksData from "../data/links"; // Renamed to avoid conflict
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
import { ChevronUp, ChevronDown, Pencil } from "lucide-react"; // Import Pencil icon
import { useAuth } from "../context/AuthContext"; // Import useAuth

interface LinkItem {
  id?: string;
  Label: string;
  Url: string;
  Category: string;
  orderInCategory: number; // Added for ordering
}

// Helper to ensure links have orderInCategory
const ensureOrderInCategory = (links: Omit<LinkItem, 'orderInCategory' | 'id'>[]): LinkItem[] => {
  const categorized = links.reduce((acc, link) => {
    const cat = link.Category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(link);
    return acc;
  }, {} as Record<string, Omit<LinkItem, 'orderInCategory' | 'id'>[]>);

  const processedLinks: LinkItem[] = [];
  Object.values(categorized).forEach(categoryLinks => {
    categoryLinks.forEach((link, index) => {
      processedLinks.push({
        ...link,
        id: `local-init-${Math.random().toString(36).substr(2, 9)}`, // ensure id
        orderInCategory: index + 1,
      });
    });
  });
  return processedLinks;
};


// Mock Firebase functions - replace with actual Firebase SDK calls
const mockFirebase = {
  fetchLinks: async (): Promise<LinkItem[]> => {
    console.log("Mock Firebase: Fetching links...");
    await new Promise(resolve => setTimeout(resolve, 500));
    const storedLinks = localStorage.getItem("firebaseLinks");
    if (storedLinks) {
      // Ensure orderInCategory exists when fetching
      const parsedLinks = JSON.parse(storedLinks) as Partial<LinkItem>[];
      const linksWithOrder = parsedLinks.map((link, index) => ({
        ...link,
        id: link.id || `fb-load-${index}`,
        Label: link.Label || "Untitled",
        Url: link.Url || "#",
        Category: link.Category || "Uncategorized",
        orderInCategory: typeof link.orderInCategory === 'number' ? link.orderInCategory : index + 1, // Default if missing
      })) as LinkItem[];
      
      // Ensure order is sequential per category if loading from potentially inconsistent data
      const linksByCategory: Record<string, LinkItem[]> = {};
      linksWithOrder.forEach(link => {
        if (!linksByCategory[link.Category]) linksByCategory[link.Category] = [];
        linksByCategory[link.Category].push(link);
      });

      const finalLinks: LinkItem[] = [];
      Object.values(linksByCategory).forEach(catLinks => {
        catLinks.sort((a, b) => (a.orderInCategory || 0) - (b.orderInCategory || 0));
        catLinks.forEach((link, idx) => {
          finalLinks.push({ ...link, orderInCategory: idx + 1 });
        });
      });
      return finalLinks;
    }
    console.log("Mock Firebase: No links found, will use local data as base.");
    return []; // Will be populated by localLinksData if empty on first load
  },
  addLink: async (link: Omit<LinkItem, 'id' | 'orderInCategory'>, allLinks: LinkItem[]): Promise<LinkItem> => {
    console.log("Mock Firebase: Adding link...", link);
    const linksInSameCategory = allLinks.filter(l => l.Category === link.Category);
    const newLink: LinkItem = {
      ...link,
      id: Date.now().toString(),
      orderInCategory: linksInSameCategory.length + 1,
    };
    const updatedLinks = [...allLinks, newLink];
    localStorage.setItem("firebaseLinks", JSON.stringify(updatedLinks));
    return newLink;
  },
  updateLink: async (linkId: string, linkData: Partial<LinkItem>, allLinks: LinkItem[]): Promise<LinkItem> => {
    console.log("Mock Firebase: Updating link...", linkId, linkData);
    let updatedLink: LinkItem | undefined;
    const updatedLinks = allLinks.map(l => {
      if (l.id === linkId) {
        updatedLink = { ...l, ...linkData };
        return updatedLink;
      }
      return l;
    });
    if (!updatedLink) throw new Error("Link not found for update");
    localStorage.setItem("firebaseLinks", JSON.stringify(updatedLinks));
    return updatedLink;
  },
  deleteLink: async (linkId: string, allLinks: LinkItem[]): Promise<LinkItem[]> => {
    console.log("Mock Firebase: Deleting link...", linkId);
    let remainingLinks = allLinks.filter(l => l.id !== linkId);
    
    // Re-order links in the affected category
    const deletedLink = allLinks.find(l => l.id === linkId);
    if (deletedLink) {
        const linksInSameCategory = remainingLinks
            .filter(l => l.Category === deletedLink.Category)
            .sort((a, b) => a.orderInCategory - b.orderInCategory);

        linksInSameCategory.forEach((l, index) => {
            l.orderInCategory = index + 1;
        });
        
        remainingLinks = remainingLinks.map(rl => {
            const updatedLinkInCategory = linksInSameCategory.find(u => u.id === rl.id);
            return updatedLinkInCategory || rl;
        });
    }
    localStorage.setItem("firebaseLinks", JSON.stringify(remainingLinks));
    return remainingLinks;
  },
  updateCategoryName: async (oldCategoryName: string, newCategoryName: string, allLinks: LinkItem[]): Promise<LinkItem[]> => {
    console.log(`Mock Firebase: Updating category name from "${oldCategoryName}" to "${newCategoryName}"`);
    const updatedLinks = allLinks.map(link => {
      if (link.Category === oldCategoryName) {
        return { ...link, Category: newCategoryName };
      }
      return link;
    });
    localStorage.setItem("firebaseLinks", JSON.stringify(updatedLinks));
    return updatedLinks;
  },
  saveAllLinks: async (links: LinkItem[]): Promise<void> => {
    console.log("Mock Firebase: Saving all links...");
    localStorage.setItem("firebaseLinks", JSON.stringify(links));
  }
};

// Remove local rankHierarchy and useUserPermissions, as AuthContext will provide this.

const Documents: React.FC = () => {
  const [modalLink, setModalLink] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [firebaseLinks, setFirebaseLinks] = useState<LinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isEditMode, setIsEditMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [currentLinkData, setCurrentLinkData] = useState<Omit<LinkItem, 'id' | 'orderInCategory'>>({ Label: "", Url: "", Category: "" });
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [editingCategoryName, setEditingCategoryName] = useState<string>("");
  const [newCategoryNameInput, setNewCategoryNameInput] = useState<string>("");

  // State for delete confirmation modal
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [linkIdToDelete, setLinkIdToDelete] = useState<string | null>(null);

  const { user, isAdmin } = useAuth(); // Use isAdmin from AuthContext

  // canEditContent will now correctly reflect the isAdmin logic from AuthContext.
  const canEditContent = isAdmin;


  const loadLinks = useCallback(async () => {
    setIsLoading(true);
    try {
      let links = await mockFirebase.fetchLinks();
      if (links.length === 0 && localLinksData.length > 0) {
        console.log("Firebase empty, initializing with local data and ensuring order.");
        // Ensure localLinksData has orderInCategory and id before saving
        const initialLinks = ensureOrderInCategory(localLinksData);
        await mockFirebase.saveAllLinks(initialLinks); // Save to mock Firebase
        links = initialLinks;
      } else if (links.length === 0 && JSON.parse(localStorage.getItem("firebaseLinks") || "[]").length === 0 && localLinksData.length > 0) {
        // This case handles if localStorage was explicitly emptied but we still have local data
        const initialLinks = ensureOrderInCategory(localLinksData);
        await mockFirebase.saveAllLinks(initialLinks);
        links = initialLinks;
      }
      setFirebaseLinks(links);
    } catch (err) {
      console.error("Failed to load links:", err);
      if (firebaseLinks.length === 0) { // Fallback if everything fails
        setFirebaseLinks(ensureOrderInCategory(localLinksData));
      }
    } finally {
      setIsLoading(false);
    }
  }, [firebaseLinks.length]);


  useEffect(() => {
    loadLinks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!canEditContent) return; // Guard clause
    setModalMode("edit");
    setCurrentLinkData({ Label: link.Label, Url: link.Url, Category: link.Category }); // orderInCategory not edited here directly
    setEditingLinkId(link.id!);
    setIsModalOpen(true);
  };

  const handleSaveLink = async () => {
    if (!canEditContent) return; // Guard clause
    if (!currentLinkData.Label || !currentLinkData.Url || !currentLinkData.Category) {
      alert("Please fill in all fields.");
      return;
    }
    setIsLoading(true);
    try {
      if (modalMode === "add") {
        await mockFirebase.addLink(currentLinkData, firebaseLinks);
      } else if (editingLinkId) {
        // Fetch the original link to preserve its orderInCategory if category doesn't change
        const originalLink = firebaseLinks.find(l => l.id === editingLinkId);
        let orderUpdate = {};
        if (originalLink && originalLink.Category !== currentLinkData.Category) {
            // Category changed, assign new order in new category
            const linksInNewCategory = firebaseLinks.filter(l => l.Category === currentLinkData.Category && l.id !== editingLinkId);
            orderUpdate = { orderInCategory: linksInNewCategory.length + 1 };
        }
        await mockFirebase.updateLink(editingLinkId, {...currentLinkData, ...orderUpdate}, firebaseLinks);
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
    if (!canEditContent || !linkIdToDelete) return; // Guard clause
    setIsLoading(true);
    try {
      const updatedLinks = await mockFirebase.deleteLink(linkIdToDelete, firebaseLinks);
      setFirebaseLinks(updatedLinks); // Directly set state to avoid re-fetch if mockFirebase returns the new list
                                     // Or call loadLinks() if mockFirebase doesn't return the list
      // await loadLinks(); // Use this if deleteLink doesn't return the updated list
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
    if (!canEditContent) return; // Guard clause
    if (!newCategoryNameInput.trim() || newCategoryNameInput.trim() === editingCategoryName) {
      alert("New category name cannot be empty or the same as the old name.");
      return;
    }
    setIsLoading(true);
    try {
      const updatedLinks = await mockFirebase.updateCategoryName(editingCategoryName, newCategoryNameInput.trim(), firebaseLinks);
      setFirebaseLinks(updatedLinks); // Directly set state
      // Update expanded state
      if (expanded[editingCategoryName] !== undefined) {
        setExpanded(prev => {
          const newExpandedState = { ...prev };
          newExpandedState[newCategoryNameInput.trim()] = newExpandedState[editingCategoryName];
          delete newExpandedState[editingCategoryName];
          return newExpandedState;
        });
      }
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
      let linksInCategory = firebaseLinks
        .filter(l => l.Category === linkToMove.Category)
        .sort((a, b) => a.orderInCategory - b.orderInCategory);

      const currentIndex = linksInCategory.findIndex(l => l.id === linkToMove.id);

      if (direction === 'up' && currentIndex > 0) {
        // Swap with the item above
        const temp = linksInCategory[currentIndex];
        linksInCategory[currentIndex] = linksInCategory[currentIndex - 1];
        linksInCategory[currentIndex - 1] = temp;
      } else if (direction === 'down' && currentIndex < linksInCategory.length - 1) {
        // Swap with the item below
        const temp = linksInCategory[currentIndex];
        linksInCategory[currentIndex] = linksInCategory[currentIndex + 1];
        linksInCategory[currentIndex + 1] = temp;
      } else {
        // No change possible or invalid direction for current position
        setIsLoading(false);
        return;
      }

      // Re-assign sequential orderInCategory values
      linksInCategory.forEach((link, index) => {
        link.orderInCategory = index + 1;
      });

      // Create the new full list of links
      const otherLinks = firebaseLinks.filter(l => l.Category !== linkToMove.Category);
      const updatedFirebaseLinks = [...otherLinks, ...linksInCategory].sort((a,b) => {
        // Optional: maintain overall sort if needed, though category grouping handles display
        if (a.Category < b.Category) return -1;
        if (a.Category > b.Category) return 1;
        return a.orderInCategory - b.orderInCategory;
      });
      
      await mockFirebase.saveAllLinks(updatedFirebaseLinks);
      setFirebaseLinks(updatedFirebaseLinks);
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
