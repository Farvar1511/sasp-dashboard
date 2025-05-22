import React, { useState, useMemo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group"; // Import RadioGroup
import { FaPlus, FaTrash, FaEdit, FaSave, FaTimes, FaCopy, FaCog } from "react-icons/fa"; // Added FaCog
import { useAuth } from "../context/AuthContext";
import Layout from "./Layout";
import { toast } from "react-toastify";
import { db } from "../firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc, // Added updateDoc
  writeBatch,
  query,
  orderBy,
} from "firebase/firestore";

// --- Division/Outfit Data Structure ---
type OutfitCategory = {
  id: string;
  name: string;
  maleOutfitVariations?: { type: string; code: string; imageUrl?: string }[];
  maleDescription?: string;
  femaleOutfitVariations?: { type: string; code: string; imageUrl?: string }[];
  femaleDescription?: string;
};

type OutfitGroupType = "division" | "auxiliary"; // New type for group category

type DivisionOutfit = {
  division: string; // Document ID, also the name
  categories: OutfitCategory[];
  order?: number;
  outfitType: OutfitGroupType; // Added outfitType
};

// Initial data for seeding
const initialOutfitsSeed: Omit<DivisionOutfit, 'division' | 'outfitType'>[] = [
  {
    order: 1,
    categories: [
      { 
        id: "swat_variants", 
        name: "SWAT Variants", 
        maleOutfitVariations: [
          { type: "Light", code: "4gL6ZQCexj44", imageUrl: "https://i.imgur.com/placeholder_swat_light_m.png" },
          { type: "Heavy", code: "Qluqf-FBKFI8", imageUrl: "https://i.imgur.com/placeholder_swat_heavy_m.png" },
          { type: "S.T.R.A.T.", code: "8sFkhgZThlAD" }
        ],
        maleDescription: "Various SWAT operational outfits (Male).",
        femaleOutfitVariations: [
          { type: "Light", code: "FEM_CODE_1", imageUrl: "https://i.imgur.com/placeholder_swat_light_f.png" },
          { type: "Heavy", code: "FEM_CODE_2" },
          { type: "S.T.R.A.T.", code: "FEM_CODE_3" }
        ],
        femaleDescription: "Various SWAT operational outfits (Female)." 
      },
    ],
  },
  {
    order: 2,
    categories: [
        { 
          id: "heat_std", 
          name: "Standard HEAT", 
          maleOutfitVariations: [{ type: "Standard", code: "HEAT_M_CODE", imageUrl: "https://i.imgur.com/heat_m.png" }],
          maleDescription: "High Enforcement Action Team uniform (Male).", 
          femaleOutfitVariations: [{ type: "Standard", code: "HEAT_F_CODE" }],
          femaleDescription: "High Enforcement Action Team uniform (Female)." 
        }
    ],
  },
  {
    order: 3,
    categories: [
        { id: "moto_std", name: "Motor Unit", maleOutfitVariations: [{type: "Standard", code: "MOTO_M_CODE"}], maleDescription: "Motorcycle Unit officer uniform (Male).", femaleOutfitVariations: [{type: "Standard", code: "MOTO_F_CODE"}], femaleDescription: "Motorcycle Unit officer uniform (Female)." }
    ],
  },
  {
    order: 4,
    categories: [
      { id: "acu_variants", name: "ACU Variants", maleOutfitVariations: [{type: "Pilot", code: "ACU_PILOT_M"}, {type: "Coastal", code: "ACU_COAST_M", imageUrl: "https://i.imgur.com/placeholder_acu_multi.png"}], maleDescription: "Aviation and Coastal unit outfits (Male).", femaleOutfitVariations: [{type: "Pilot", code: "ACU_PILOT_F"}, {type: "Coastal", code: "ACU_COAST_F"}], femaleDescription: "Aviation and Coastal unit outfits (Female)." },
    ],
  },
  {
    order: 5,
    categories: [
        { id: "k9_handler", name: "K9 Handler", maleOutfitVariations: [{type: "Handler", code: "K9_M_CODE"}], maleDescription: "K9 Unit handler uniform (Male).", femaleOutfitVariations: [{type: "Handler", code: "K9_F_CODE"}], femaleDescription: "K9 Unit handler uniform (Female)." }
    ],
  },
  {
    order: 6,
    categories: [
        { id: "ciu_detective", name: "CIU Detective", maleOutfitVariations: [{type: "Detective", code: "CIU_M_CODE"}], maleDescription: "Criminal Investigations Unit plainclothes (Male).", femaleOutfitVariations: [{type: "Detective", code: "CIU_F_CODE"}], femaleDescription: "Criminal Investigations Unit plainclothes (Female)." }
    ],
  },
];
// Map initial seed data to include division names, which will be document IDs
const initialOutfitsData: DivisionOutfit[] = [
    { division: "SWAT", ...initialOutfitsSeed[0], outfitType: "division" },
    { division: "HEAT", ...initialOutfitsSeed[1], outfitType: "division" },
    { division: "MOTO", categories: initialOutfitsSeed.find(s => s.categories[0].id === "moto_std")?.categories || [], order: 3, outfitType: "division" },
    { division: "ACU", categories: initialOutfitsSeed.find(s => s.categories[0].id === "acu_variants")?.categories || [], order: 4, outfitType: "division" },
    { division: "K9", categories: initialOutfitsSeed.find(s => s.categories[0].id === "k9_handler")?.categories || [], order: 5, outfitType: "division" },
    { division: "CIU", categories: initialOutfitsSeed.find(s => s.categories[0].id === "ciu_detective")?.categories || [], order: 6, outfitType: "division" },
];

// --- Helper: Check if user is Command or High Command ---
const commandAndHighCommandRanks = [
  "lieutenant",
  "captain",
  "commander",
  "assistant commissioner",
  "deputy commissioner",
  "commissioner",
];

function isCommandOrHighCommand(user: any): boolean {
  if (!user) return false;
  const rank = user.rank?.toLowerCase() || "";
  return commandAndHighCommandRanks.includes(rank) || user.isAdmin;
}

const OUTFITS_COLLECTION = "outfitDivisions";

const Outfits: React.FC = () => {
  const { user: currentUser } = useAuth();
  const canEdit = useMemo(() => isCommandOrHighCommand(currentUser), [currentUser]);

  const [outfits, setOutfits] = useState<DivisionOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingDivision, setEditingDivision] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [addingToDivision, setAddingToDivision] = useState<string | null>(null);
  const [isAddingNewDivision, setIsAddingNewDivision] = useState(false);
  const [newDivisionNameInput, setNewDivisionNameInput] = useState("");
  const [newOutfitType, setNewOutfitType] = useState<OutfitGroupType>("division"); // For new group type

  // State for editing an existing outfit group's type
  const [editingTypeForDivisionId, setEditingTypeForDivisionId] = useState<string | null>(null);
  const [currentEditOutfitType, setCurrentEditOutfitType] = useState<OutfitGroupType>("division");
  
  const [newCategoryName, setNewCategoryName] = useState("");
  // Update outfit entries to include imageUrl
  const [newMaleOutfitEntries, setNewMaleOutfitEntries] = useState<{ type: string; code: string; imageUrl?: string }[]>([{ type: "", code: "", imageUrl: "" }]);
  const [newFemaleOutfitEntries, setNewFemaleOutfitEntries] = useState<{ type: string; code: string; imageUrl?: string }[]>([{ type: "", code: "", imageUrl: "" }]);
  // Remove standalone newMaleImageUrl, newFemaleImageUrl
  const [newMaleDescription, setNewMaleDescription] = useState<string>("");
  const [newFemaleDescription, setNewFemaleDescription] = useState<string>("");

  const [editCategoryName, setEditCategoryName] = useState("");
  // Update outfit entries to include imageUrl
  const [editMaleOutfitEntries, setEditMaleOutfitEntries] = useState<{ type: string; code: string; imageUrl?: string }[]>([{ type: "", code: "", imageUrl: "" }]);
  const [editFemaleOutfitEntries, setEditFemaleOutfitEntries] = useState<{ type: string; code: string; imageUrl?: string }[]>([{ type: "", code: "", imageUrl: "" }]);
  // Remove standalone editMaleImageUrl, editFemaleImageUrl
  const [editMaleDescription, setEditMaleDescription] = useState("");
  const [editFemaleDescription, setEditFemaleDescription] = useState("");

  // State for image modal
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [currentModalImageUrl, setCurrentModalImageUrl] = useState<string | null>(null);

  // State for gender filters
  const [showMaleOutfits, setShowMaleOutfits] = useState(true);
  const [showFemaleOutfits, setShowFemaleOutfits] = useState(true);

  useEffect(() => {
    const fetchOutfits = async () => {
      setIsLoading(true);
      setError(null);
      const outfitsQuery = query(collection(db, OUTFITS_COLLECTION), orderBy("order", "asc"));
      try {
        const querySnapshot = await getDocs(outfitsQuery);
        if (querySnapshot.empty) {
          // Seed initial data if collection is empty
          toast.info("No outfits found. Seeding initial data...");
          const batch = writeBatch(db);
          initialOutfitsData.forEach((divOutfit) => {
            const docRef = doc(db, OUTFITS_COLLECTION, divOutfit.division);
            // Firestore document will store 'categories' and 'order'
            batch.set(docRef, { 
              categories: divOutfit.categories, 
              order: divOutfit.order, 
              outfitType: divOutfit.outfitType // Ensure outfitType is seeded
            });
          });
          await batch.commit();
          setOutfits(initialOutfitsData.sort((a, b) => (a.order || 0) - (b.order || 0)));
          toast.success("Initial outfit data seeded.");
        } else {
          const fetchedOutfits = querySnapshot.docs.map((docSnapshot) => {
            const data = docSnapshot.data();
            return {
              division: docSnapshot.id,
              categories: data.categories as OutfitCategory[],
              order: data.order as number | undefined,
              outfitType: (data.outfitType as OutfitGroupType) || "division", // Default to 'division' if not present
            };
          });
          setOutfits(fetchedOutfits.sort((a, b) => (a.order || 0) - (b.order || 0)));
        }
      } catch (err) {
        console.error("Error fetching outfits:", err);
        setError("Failed to fetch outfits.");
        toast.error("Failed to load outfits.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOutfits();
  }, []);

  const saveDivisionOutfitsToFirestore = async (divisionName: string, updatedCategories: OutfitCategory[]) => {
    try {
      const divisionToUpdate = outfits.find(o => o.division === divisionName);
      if (!divisionToUpdate) {
        toast.error(`Outfit group ${divisionName} not found.`);
        return;
      }
      const docRef = doc(db, OUTFITS_COLLECTION, divisionName);
      // Save only categories and order to Firestore document
      await setDoc(docRef, { 
        categories: updatedCategories, 
        order: divisionToUpdate.order,
        outfitType: divisionToUpdate.outfitType // Preserve outfitType
      }, { merge: true }); 
    } catch (err) {
      console.error("Error saving to Firestore:", err);
      toast.error(`Failed to save changes for ${divisionName}.`);
    }
  };
  
  const handleUpdateOutfitGroupType = async (divisionId: string, newType: OutfitGroupType) => {
    try {
      const docRef = doc(db, OUTFITS_COLLECTION, divisionId);
      await updateDoc(docRef, { outfitType: newType });
      setOutfits(prevOutfits => 
        prevOutfits.map(o => o.division === divisionId ? { ...o, outfitType: newType } : o)
      );
      toast.success(`Outfit group type updated for ${divisionId}.`);
      setEditingTypeForDivisionId(null);
    } catch (err) {
      console.error("Error updating outfit group type:", err);
      toast.error(`Failed to update type for ${divisionId}.`);
    }
  };

  // Generic handler to update outfit entries in state (add imageUrl field)
  const handleOutfitEntryChange = (
    entries: { type: string; code: string; imageUrl?: string }[],
    setEntries: React.Dispatch<React.SetStateAction<{ type: string; code: string; imageUrl?: string }[]>>,
    index: number,
    field: 'type' | 'code' | 'imageUrl',
    value: string
  ) => {
    const updatedEntries = [...entries];
    updatedEntries[index] = { ...updatedEntries[index], [field]: value };
    setEntries(updatedEntries);
  };

  const addOutfitEntry = (
    entries: { type: string; code: string; imageUrl?: string }[],
    setEntries: React.Dispatch<React.SetStateAction<{ type: string; code: string; imageUrl?: string }[]>>
  ) => {
    setEntries([...entries, { type: "", code: "", imageUrl: "" }]);
  };

  const removeOutfitEntry = (
    entries: { type: string; code: string; imageUrl?: string }[],
    setEntries: React.Dispatch<React.SetStateAction<{ type: string; code: string; imageUrl?: string }[]>>,
    index: number
  ) => {
    if (entries.length > 1) {
      const updatedEntries = entries.filter((_, i) => i !== index);
      setEntries(updatedEntries);
    } else {
      // If it's the last entry, clear it instead of removing the row
      setEntries([{ type: "", code: "", imageUrl: "" }]);
    }
  };

  const filterEmptyVariations = (variations: { type: string; code: string; imageUrl?: string }[]) => {
    return variations.filter(v => v.type.trim() !== "" || v.code.trim() !== "" || (v.imageUrl && v.imageUrl.trim() !== ""));
  };

  const handleAddCategory = async (divisionName: string) => {
    if (!newCategoryName.trim()) {
      toast.error("Category name is required.");
      return;
    }
    
    const finalMaleVariations = filterEmptyVariations(newMaleOutfitEntries);
    const finalFemaleVariations = filterEmptyVariations(newFemaleOutfitEntries);
    const tempMaleDescriptionValue = newMaleDescription.trim(); 
    const tempFemaleDescription = newFemaleDescription.trim();

    if (finalMaleVariations.length === 0 && finalFemaleVariations.length === 0 && !tempMaleDescriptionValue && !tempFemaleDescription) {
        toast.error("At least one outfit variation (with type, code, or image) or a description for Male or Female is required.");
        return;
    }

    const newCategory: OutfitCategory = {
      id: Date.now().toString(),
      name: newCategoryName.trim(),
    };

    if (finalMaleVariations.length > 0) newCategory.maleOutfitVariations = finalMaleVariations;
    if (tempMaleDescriptionValue) newCategory.maleDescription = tempMaleDescriptionValue; 
    if (finalFemaleVariations.length > 0) newCategory.femaleOutfitVariations = finalFemaleVariations;
    if (tempFemaleDescription) newCategory.femaleDescription = tempFemaleDescription;


    const updatedOutfits = outfits.map((d) =>
      d.division === divisionName
        ? { ...d, categories: [...d.categories, newCategory] }
        : d
    );
    setOutfits(updatedOutfits);

    // Persist to Firestore
    const divisionToUpdate = updatedOutfits.find(d => d.division === divisionName);
    if (divisionToUpdate) {
      await saveDivisionOutfitsToFirestore(divisionName, divisionToUpdate.categories);
    }

    setNewCategoryName("");
    setNewMaleOutfitEntries([{ type: "", code: "", imageUrl: "" }]);
    setNewMaleDescription("");
    setNewFemaleOutfitEntries([{ type: "", code: "", imageUrl: "" }]);
    setNewFemaleDescription("");
    setAddingToDivision(null); // Hide form after adding
    toast.success(`Category "${newCategory.name}" added to ${divisionName}.`);
  };

  const handleSaveNewDivision = async () => {
    const divisionName = newDivisionNameInput.trim();
    if (!divisionName) {
      toast.error("New Outfit Group name is required.");
      return;
    }
    if (outfits.some(o => o.division.toLowerCase() === divisionName.toLowerCase())) {
      toast.error(`An outfit group named "${divisionName}" already exists.`);
      return;
    }
    if (!newCategoryName.trim()) {
      toast.error("The first category's name is required for the new group.");
      return;
    }

    const finalMaleVariations = filterEmptyVariations(newMaleOutfitEntries);
    const finalFemaleVariations = filterEmptyVariations(newFemaleOutfitEntries);
    const tempMaleDescriptionValue = newMaleDescription.trim();
    const tempFemaleDescription = newFemaleDescription.trim();

    if (finalMaleVariations.length === 0 && finalFemaleVariations.length === 0 && !tempMaleDescriptionValue && !tempFemaleDescription) {
        toast.error("At least one outfit variation (with type, code, or image) or a description for the first category is required.");
        return;
    }

    const firstCategory: OutfitCategory = {
      id: Date.now().toString(),
      name: newCategoryName.trim(),
    };
    if (finalMaleVariations.length > 0) firstCategory.maleOutfitVariations = finalMaleVariations;
    if (tempMaleDescriptionValue) firstCategory.maleDescription = tempMaleDescriptionValue;
    if (finalFemaleVariations.length > 0) firstCategory.femaleOutfitVariations = finalFemaleVariations;
    if (tempFemaleDescription) firstCategory.femaleDescription = tempFemaleDescription;

    const newOrder = outfits.length > 0 ? Math.max(...outfits.map(o => o.order || 0)) + 1 : 1;

    const newDivision: DivisionOutfit = {
      division: divisionName,
      categories: [firstCategory],
      order: newOrder,
      outfitType: newOutfitType, // Save the selected type
    };

    // Update local state
    setOutfits(prevOutfits => [...prevOutfits, newDivision].sort((a, b) => (a.order || 0) - (b.order || 0)));

    // Persist to Firestore
    try {
      const docRef = doc(db, OUTFITS_COLLECTION, divisionName);
      await setDoc(docRef, { 
        categories: newDivision.categories, 
        order: newDivision.order,
        outfitType: newDivision.outfitType // Save outfitType to Firestore
      });
      toast.success(`New ${newDivision.outfitType} group "${divisionName}" added.`);
    } catch (err) {
      console.error("Error saving new group to Firestore:", err);
      toast.error(`Failed to save new group "${divisionName}".`);
      setOutfits(prevOutfits => prevOutfits.filter(o => o.division !== divisionName));
      return;
    }

    setIsAddingNewDivision(false);
    setNewDivisionNameInput("");
    setNewCategoryName("");
    setNewMaleOutfitEntries([{ type: "", code: "", imageUrl: "" }]);
    setNewMaleDescription("");
    setNewFemaleOutfitEntries([{ type: "", code: "", imageUrl: "" }]);
    setNewFemaleDescription("");
    setNewOutfitType("division"); // Reset type
  };

  const handleCancelAddNewDivision = () => {
    setIsAddingNewDivision(false);
    setNewDivisionNameInput("");
    setNewCategoryName("");
    setNewMaleOutfitEntries([{ type: "", code: "", imageUrl: "" }]);
    setNewMaleDescription("");
    setNewFemaleOutfitEntries([{ type: "", code: "", imageUrl: "" }]);
    setNewFemaleDescription("");
    setNewOutfitType("division"); // Reset type
  };

  const handleDeleteCategory = async (divisionName: string, categoryId: string) => {
    let categoryName = "Category";
    const updatedOutfits = outfits.map((d) => {
      if (d.division === divisionName) {
        const catToDelete = d.categories.find(c => c.id === categoryId);
        if (catToDelete) categoryName = catToDelete.name;
        return { ...d, categories: d.categories.filter((c) => c.id !== categoryId) };
      }
      return d;
    });
    setOutfits(updatedOutfits);

    // Persist to Firestore
    const divisionToUpdate = updatedOutfits.find(d => d.division === divisionName);
    if (divisionToUpdate) {
      await saveDivisionOutfitsToFirestore(divisionName, divisionToUpdate.categories);
    }
    toast.success(`Category "${categoryName}" deleted from ${divisionName}.`);
  };

  const handleStartEditCategory = (
    division: string,
    category: OutfitCategory
  ) => {
    setEditingDivision(division);
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name);
    setEditMaleOutfitEntries(category.maleOutfitVariations && category.maleOutfitVariations.length > 0 ? category.maleOutfitVariations : [{ type: "", code: "", imageUrl: "" }]);
    setEditMaleDescription(category.maleDescription || "");
    setEditFemaleOutfitEntries(category.femaleOutfitVariations && category.femaleOutfitVariations.length > 0 ? category.femaleOutfitVariations : [{ type: "", code: "", imageUrl: "" }]);
    setEditFemaleDescription(category.femaleDescription || "");
    setAddingToDivision(null); // Ensure add form is hidden when edit starts
    setIsAddingNewDivision(false); // Ensure new division form is hidden
  };

  const handleSaveEditCategory = async (divisionName: string, categoryId: string) => {
    if (!editCategoryName.trim()) {
      toast.error("Category name is required.");
      return;
    }

    const finalEditMaleVariations = filterEmptyVariations(editMaleOutfitEntries);
    const finalEditFemaleVariations = filterEmptyVariations(editFemaleOutfitEntries);
    const tempEditMaleDescription = editMaleDescription.trim();
    const tempEditFemaleDescription = editFemaleDescription.trim();
    
     if (finalEditMaleVariations.length === 0 && finalEditFemaleVariations.length === 0 && !tempEditMaleDescription && !tempEditFemaleDescription) {
        toast.error("At least one outfit variation (with type, code, or image) or a description for Male or Female is required for the category.");
        return;
    }

    const updatedOutfits = outfits.map((d) =>
      d.division === divisionName
        ? {
            ...d,
            categories: d.categories.map((c) => {
              if (c.id === categoryId) {
                const updatedCategory: OutfitCategory = {
                  ...c, // Preserve other properties like id
                  name: editCategoryName.trim(),
                };
                // Update with new variation structure
                updatedCategory.maleOutfitVariations = finalEditMaleVariations.length > 0 ? finalEditMaleVariations : undefined;
                updatedCategory.maleDescription = tempEditMaleDescription ? tempEditMaleDescription : undefined;
                updatedCategory.femaleOutfitVariations = finalEditFemaleVariations.length > 0 ? finalEditFemaleVariations : undefined;
                updatedCategory.femaleDescription = tempEditFemaleDescription ? tempEditFemaleDescription : undefined;
                
                // Clean up undefined properties
                if (!updatedCategory.maleOutfitVariations) delete updatedCategory.maleOutfitVariations;
                if (!updatedCategory.maleDescription) delete updatedCategory.maleDescription;
                if (!updatedCategory.femaleOutfitVariations) delete updatedCategory.femaleOutfitVariations;
                if (!updatedCategory.femaleDescription) delete updatedCategory.femaleDescription;

                return updatedCategory;
              }
              return c;
            }),
          }
        : d
    );
    setOutfits(updatedOutfits);

    // Persist to Firestore
    const divisionToUpdate = updatedOutfits.find(d => d.division === divisionName);
    if (divisionToUpdate) {
      await saveDivisionOutfitsToFirestore(divisionName, divisionToUpdate.categories);
    }

    setEditingDivision(null);
    setEditingCategoryId(null);
    setEditCategoryName("");
    setEditMaleOutfitEntries([{ type: "", code: "", imageUrl: "" }]);
    setEditMaleDescription("");
    setEditFemaleOutfitEntries([{ type: "", code: "", imageUrl: "" }]);
    setEditFemaleDescription("");
    toast.success(`Category "${editCategoryName.trim()}" in ${divisionName} updated.`);
  };

  const handleCancelEdit = () => {
    setEditingDivision(null);
    setEditingCategoryId(null);
    setEditCategoryName("");
    setEditMaleOutfitEntries([{ type: "", code: "", imageUrl: "" }]);
    setEditMaleDescription("");
    setEditFemaleOutfitEntries([{ type: "", code: "", imageUrl: "" }]);
    setEditFemaleDescription("");
  };

  const handleCancelAdd = () => {
    setAddingToDivision(null);
    setNewCategoryName("");
    setNewMaleOutfitEntries([{ type: "", code: "", imageUrl: "" }]);
    setNewMaleDescription("");
    setNewFemaleOutfitEntries([{ type: "", code: "", imageUrl: "" }]);
    setNewFemaleDescription("");
  };

  const handleCopyCode = (code: string | undefined) => {
    if (code && code.trim()) { // Check if code is not undefined and not just whitespace
      navigator.clipboard.writeText(code.trim())
        .then(() => toast.success("Outfit code copied!"))
        .catch(() => toast.error("Failed to copy code."));
    } else {
      toast.warn("No code to copy.");
    }
  };

  // --- Image Modal Handlers ---
  const openImageModal = (imageUrl: string) => {
    setCurrentModalImageUrl(imageUrl);
    setIsImageModalOpen(true);
  };

  const closeImageModal = () => {
    setIsImageModalOpen(false);
    setCurrentModalImageUrl(null);
  };

  // Filter outfits by type
  const divisionTypeOutfits = useMemo(() => outfits.filter(o => o.outfitType === 'division'), [outfits]);
  const auxiliaryTypeOutfits = useMemo(() => outfits.filter(o => o.outfitType === 'auxiliary'), [outfits]);


  // --- Render ---
  if (isLoading) {
    return (
      <Layout>
        <div className="page-content p-4 sm:p-6 min-h-screen text-white/90 flex justify-center items-center">
          <p className="text-xl text-[#f3c700]">Loading outfits...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="page-content p-4 sm:p-6 min-h-screen text-white/90 flex flex-col justify-center items-center">
          <p className="text-xl text-red-500">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4 bg-[#f3c700] text-black">
            Retry
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-content p-4 sm:p-6 min-h-screen text-white/90">
        {/* New Header Container */}
        <div className="p-4 mb-6 rounded-lg bg-neutral-900/[.99] shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h1 className="text-3xl sm:text-4xl font-bold text-[#f3c700] text-center sm:text-left">
              Division Outfits & Codes
            </h1>
            {canEdit && !isAddingNewDivision && !editingDivision && !addingToDivision && (
              <Button
                onClick={() => {
                  setIsAddingNewDivision(true);
                  setAddingToDivision(null);
                  setEditingDivision(null);
                  setEditingTypeForDivisionId(null); // Close type editing form
                }}
                className="bg-[#f3c700] hover:bg-yellow-400 text-black"
              >
                <FaPlus className="mr-2" /> Create New Outfit Group
              </Button>
            )}
          </div>
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-x-6 gap-y-3">
            <Label className="text-gray-300 font-semibold">Filters:</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showMale"
                checked={showMaleOutfits}
                onCheckedChange={(checked) => setShowMaleOutfits(Boolean(checked))}
                className="border-gray-600 data-[state=checked]:bg-[#f3c700] data-[state=checked]:text-black data-[state=checked]:border-[#f3c700]"
              />
              <Label htmlFor="showMale" className="text-sm font-medium text-gray-300">
                Show Male Outfits
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showFemale"
                checked={showFemaleOutfits}
                onCheckedChange={(checked) => setShowFemaleOutfits(Boolean(checked))}
                className="border-gray-600 data-[state=checked]:bg-[#f3c700] data-[state=checked]:text-black data-[state=checked]:border-[#f3c700]"
              />
              <Label htmlFor="showFemale" className="text-sm font-medium text-gray-300">
                Show Female Outfits
              </Label>
            </div>
          </div>
        </div>
        
        {isAddingNewDivision && canEdit && (
          <Card className="mb-6 bg-card border border-[#f3c700]/50 rounded-xl shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl text-[#f3c700]">Create New Outfit Group</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveNewDivision();
                }}
              >
                <Input
                  value={newDivisionNameInput}
                  onChange={(e) => setNewDivisionNameInput(e.target.value)}
                  placeholder="Outfit Group Name (e.g., SWAT, ASU, Event Uniforms)"
                  className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500"
                />

                <div>
                  <Label className="text-sm text-[#f3c700] block mb-2">Outfit Group Type</Label>
                  <RadioGroup
                    defaultValue="division"
                    value={newOutfitType}
                    onValueChange={(value: string) => setNewOutfitType(value as OutfitGroupType)}
                    className="flex space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="division" id="type-division" className="border-gray-600 text-[#f3c700] focus:ring-[#f3c700]" />
                      <Label htmlFor="type-division" className="text-white/90">Division</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="auxiliary" id="type-auxiliary" className="border-gray-600 text-[#f3c700] focus:ring-[#f3c700]" />
                      <Label htmlFor="type-auxiliary" className="text-white/90">Auxiliary Outfit</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <Label className="text-sm text-[#f3c700] block pt-2 mb-1">First Outfit Category Details</Label>
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="First Category Name (e.g., Standard Uniform)"
                  className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500"
                />
                {/* Male Fields for first category */}
                <Label className="text-xs text-[#f3c700]/80 block pt-2">Male Version Details - Outfit Variations</Label>
                {newMaleOutfitEntries.map((entry, index) => (
                  <div key={`new-male-${index}`} className="space-y-1 p-2 border border-dashed border-gray-600 rounded mb-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={entry.type}
                        onChange={(e) => handleOutfitEntryChange(newMaleOutfitEntries, setNewMaleOutfitEntries, index, 'type', e.target.value)}
                        placeholder="Type (e.g., Light)"
                        className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs"
                      />
                      <Input
                        value={entry.code}
                        onChange={(e) => handleOutfitEntryChange(newMaleOutfitEntries, setNewMaleOutfitEntries, index, 'code', e.target.value)}
                        placeholder="Code"
                        className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 font-mono text-xs flex-grow"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeOutfitEntry(newMaleOutfitEntries, setNewMaleOutfitEntries, index)}
                        className="text-red-400 hover:text-red-300 h-7 w-7"
                        title="Remove Variation"
                      >
                        <FaTrash size={12} />
                      </Button>
                    </div>
                    <Input
                        type="url"
                        value={entry.imageUrl || ""}
                        onChange={(e) => handleOutfitEntryChange(newMaleOutfitEntries, setNewMaleOutfitEntries, index, 'imageUrl', e.target.value)}
                        placeholder="Image URL (optional)"
                        className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs mt-1"
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addOutfitEntry(newMaleOutfitEntries, setNewMaleOutfitEntries)}
                  className="mt-1 text-xs border-[#f3c700]/50 text-[#f3c700]/80 hover:bg-[#f3c700]/10"
                >
                  <FaPlus className="mr-1.5" size={10} /> Add Male Variation
                </Button>
                <Textarea
                  value={newMaleDescription}
                  onChange={(e) => setNewMaleDescription(e.target.value)}
                  placeholder="Male Description (optional)"
                  className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500"
                  rows={2}
                />
                {/* Female Fields for first category */}
                <Label className="text-xs text-[#f3c700]/80 block pt-2">Female Version Details - Outfit Variations</Label>
                {newFemaleOutfitEntries.map((entry, index) => (
                  <div key={`new-female-${index}`} className="space-y-1 p-2 border border-dashed border-gray-600 rounded mb-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={entry.type}
                        onChange={(e) => handleOutfitEntryChange(newFemaleOutfitEntries, setNewFemaleOutfitEntries, index, 'type', e.target.value)}
                        placeholder="Type (e.g., Light)"
                        className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs"
                      />
                      <Input
                        value={entry.code}
                        onChange={(e) => handleOutfitEntryChange(newFemaleOutfitEntries, setNewFemaleOutfitEntries, index, 'code', e.target.value)}
                        placeholder="Code"
                        className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 font-mono text-xs flex-grow"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeOutfitEntry(newFemaleOutfitEntries, setNewFemaleOutfitEntries, index)}
                        className="text-red-400 hover:text-red-300 h-7 w-7"
                        title="Remove Variation"
                      >
                        <FaTrash size={12} />
                      </Button>
                    </div>
                    <Input
                        type="url"
                        value={entry.imageUrl || ""}
                        onChange={(e) => handleOutfitEntryChange(newFemaleOutfitEntries, setNewFemaleOutfitEntries, index, 'imageUrl', e.target.value)}
                        placeholder="Image URL (optional)"
                        className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs mt-1"
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addOutfitEntry(newFemaleOutfitEntries, setNewFemaleOutfitEntries)}
                  className="mt-1 text-xs border-[#f3c700]/50 text-[#f3c700]/80 hover:bg-[#f3c700]/10"
                >
                  <FaPlus className="mr-1.5" size={10} /> Add Female Variation
                </Button>
                <Textarea
                  value={newFemaleDescription}
                  onChange={(e) => setNewFemaleDescription(e.target.value)}
                  placeholder="Female Description (optional)"
                  className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500"
                  rows={2}
                />
                <div className="flex gap-2 mt-3 justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-[#f3c700] text-black hover:bg-yellow-400"
                  >
                    <FaSave className="mr-1.5" /> Save Outfit Group
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelAddNewDivision}
                    className="border-gray-500 text-gray-300 hover:bg-gray-700/30"
                  >
                    <FaTimes className="mr-1.5" /> Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Render Division Outfits */}
        {divisionTypeOutfits.length > 0 && (
          <h2 className="text-2xl font-semibold text-[#f3c700]/90 mb-3 mt-6">Divisions</h2>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {divisionTypeOutfits.map((division) => (
            <Card
              key={division.division}
              className="bg-card border border-[#f3c700]/50 rounded-xl shadow-xl flex flex-col overflow-hidden"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-[#f3c700]/30">
                <CardTitle className="text-2xl text-[#f3c700]">
                  {division.division}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-sky-400 hover:text-sky-300 h-7 w-7"
                      onClick={() => {
                        setEditingTypeForDivisionId(division.division);
                        setCurrentEditOutfitType(division.outfitType);
                        // Close other forms
                        setIsAddingNewDivision(false);
                        setAddingToDivision(null);
                        setEditingDivision(null);
                      }}
                      title="Edit Group Type"
                    >
                      <FaCog size={14} />
                    </Button>
                  )}
                  {canEdit && (
                    <Badge variant="outline" className="border-[#f3c700] text-[#f3c700] text-xs">
                      Admin
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 py-4 px-4 space-y-4">
                {/* Edit Outfit Group Type Form */}
                {editingTypeForDivisionId === division.division && canEdit && (
                  <div className="p-3 my-2 bg-black/[.5] border border-[#f3c700]/30 rounded-md space-y-3">
                    <Label className="text-sm text-[#f3c700] block">Change Outfit Group Type</Label>
                    <RadioGroup
                      value={currentEditOutfitType}
                      onValueChange={(value) => setCurrentEditOutfitType(value as OutfitGroupType)}
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="division" id={`edit-type-division-${division.division}`} className="border-gray-600 text-[#f3c700] focus:ring-[#f3c700]" />
                        <Label htmlFor={`edit-type-division-${division.division}`} className="text-white/90 text-xs">Division</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="auxiliary" id={`edit-type-auxiliary-${division.division}`} className="border-gray-600 text-[#f3c700] focus:ring-[#f3c700]" />
                        <Label htmlFor={`edit-type-auxiliary-${division.division}`} className="text-white/90 text-xs">Auxiliary</Label>
                      </div>
                    </RadioGroup>
                    <div className="flex gap-2 justify-end mt-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs" onClick={() => handleUpdateOutfitGroupType(division.division, currentEditOutfitType)}>
                        <FaSave className="mr-1" /> Save Type
                      </Button>
                      <Button size="sm" variant="outline" className="text-gray-300 border-gray-500 hover:bg-gray-700/30 text-xs" onClick={() => setEditingTypeForDivisionId(null)}>
                        <FaTimes className="mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {division.categories.length === 0 && ! (editingTypeForDivisionId === division.division) && (
                  <p className="text-gray-400 italic text-sm">No outfit categories defined yet.</p>
                )}
                {division.categories.map((cat) =>
                  editingDivision === division.division &&
                  editingCategoryId === cat.id ? (
                    // --- EDITING FORM ---
                    <div key={cat.id} className="p-4 bg-black/[.4] rounded-lg border border-[#f3c700]/30 space-y-3">
                      <Input
                        value={editCategoryName}
                        onChange={(e) => setEditCategoryName(e.target.value)}
                        placeholder="Category Name"
                        className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500"
                      />
                      {/* Male Fields */}
                      <Label className="text-xs text-[#f3c700] block pt-2">Male Version Outfit Variations</Label>
                      {editMaleOutfitEntries.map((entry, index) => (
                        <div key={`edit-male-var-${index}`} className="space-y-1 p-2 border border-dashed border-gray-600 rounded mb-2">
                          <div className="flex items-center gap-2">
                            <Input
                              value={entry.type}
                              onChange={(e) => handleOutfitEntryChange(editMaleOutfitEntries, setEditMaleOutfitEntries, index, 'type', e.target.value)}
                              placeholder="Type (e.g., Light)"
                              className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs"
                            />
                            <Input
                              value={entry.code}
                              onChange={(e) => handleOutfitEntryChange(editMaleOutfitEntries, setEditMaleOutfitEntries, index, 'code', e.target.value)}
                              placeholder="Code"
                              className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 font-mono text-xs flex-grow"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => removeOutfitEntry(editMaleOutfitEntries, setEditMaleOutfitEntries, index)}
                              className="text-red-400 hover:text-red-300 h-7 w-7"
                              title="Remove Variation"
                            >
                              <FaTrash size={12} />
                            </Button>
                          </div>
                          <Input
                            type="url"
                            value={entry.imageUrl || ""}
                            onChange={(e) => handleOutfitEntryChange(editMaleOutfitEntries, setEditMaleOutfitEntries, index, 'imageUrl', e.target.value)}
                            placeholder="Image URL (optional)"
                            className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs mt-1"
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addOutfitEntry(editMaleOutfitEntries, setEditMaleOutfitEntries)}
                        className="mt-1 text-xs border-[#f3c700]/50 text-[#f3c700]/80 hover:bg-[#f3c700]/10"
                      >
                        <FaPlus className="mr-1.5" size={10} /> Add Male Variation
                      </Button>
                       <Textarea
                        value={editMaleDescription}
                        onChange={(e) => setEditMaleDescription(e.target.value)}
                        placeholder="Male Description (optional)"
                        className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500"
                        rows={2}
                      />
                      {/* Female Fields */}
                      <Label className="text-xs text-[#f3c700] block pt-2">Female Version Outfit Variations</Label>
                      {editFemaleOutfitEntries.map((entry, index) => (
                        <div key={`edit-female-var-${index}`} className="space-y-1 p-2 border border-dashed border-gray-600 rounded mb-2">
                          <div className="flex items-center gap-2">
                            <Input
                              value={entry.type}
                              onChange={(e) => handleOutfitEntryChange(editFemaleOutfitEntries, setEditFemaleOutfitEntries, index, 'type', e.target.value)}
                              placeholder="Type (e.g., Light)"
                              className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs"
                            />
                            <Input
                              value={entry.code}
                              onChange={(e) => handleOutfitEntryChange(editFemaleOutfitEntries, setEditFemaleOutfitEntries, index, 'code', e.target.value)}
                              placeholder="Code"
                              className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 font-mono text-xs flex-grow"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => removeOutfitEntry(editFemaleOutfitEntries, setEditFemaleOutfitEntries, index)}
                              className="text-red-400 hover:text-red-300 h-7 w-7"
                              title="Remove Variation"
                            >
                              <FaTrash size={12} />
                            </Button>
                          </div>
                          <Input
                            type="url"
                            value={entry.imageUrl || ""}
                            onChange={(e) => handleOutfitEntryChange(editFemaleOutfitEntries, setEditFemaleOutfitEntries, index, 'imageUrl', e.target.value)}
                            placeholder="Image URL (optional)"
                            className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs mt-1"
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addOutfitEntry(editFemaleOutfitEntries, setEditFemaleOutfitEntries)}
                        className="mt-1 text-xs border-[#f3c700]/50 text-[#f3c700]/80 hover:bg-[#f3c700]/10"
                      >
                        <FaPlus className="mr-1.5" size={10} /> Add Female Variation
                      </Button>
                       <Textarea
                        value={editFemaleDescription}
                        onChange={(e) => setEditFemaleDescription(e.target.value)}
                        placeholder="Female Description (optional)"
                        className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500"
                        rows={2}
                      />
                      <div className="flex gap-2 mt-2 justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEditCategory(division.division, cat.id)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <FaSave className="mr-1.5" /> Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                          className="border-[#f3c700] text-[#f3c700] hover:bg-[#f3c700]/10"
                        >
                          <FaTimes className="mr-1.5" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // --- DISPLAY CATEGORY ---
                    <div
                      key={cat.id}
                      className="p-3 bg-black/[.3] rounded-lg border border-[#f3c700]/20 relative group space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-semibold text-lg text-[#f3c700]">{cat.name}</span>
                        {canEdit && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-blue-400 hover:text-blue-300 h-7 w-7"
                              onClick={() => handleStartEditCategory(division.division, cat)}
                              title="Edit"
                            >
                              <FaEdit size={14} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300 h-7 w-7"
                              onClick={() => handleDeleteCategory(division.division, cat.id)}
                              title="Delete"
                            >
                              <FaTrash size={14} />
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      {/* Apply filters to Male and Female Version display */}
                      {(() => {
                        const maleContentExists = !!(cat.maleOutfitVariations && cat.maleOutfitVariations.some(v => v.type || v.code || v.imageUrl)) || !!cat.maleDescription;
                        const femaleContentExists = !!(cat.femaleOutfitVariations && cat.femaleOutfitVariations.some(v => v.type || v.code || v.imageUrl)) || !!cat.femaleDescription;
                        
                        const shouldShowMale = showMaleOutfits && maleContentExists;
                        const shouldShowFemale = showFemaleOutfits && femaleContentExists;

                        return (
                          <>
                            {shouldShowMale && (
                              <div className="mt-2 pt-2 border-t border-gray-700/50">
                                <h4 className="text-sm font-semibold text-gray-300 mb-1">Male Version</h4>
                                {cat.maleOutfitVariations && cat.maleOutfitVariations.map((variation, index) => (
                                  <div key={`male-var-${cat.id}-${index}`} className="mb-2 p-2 border border-gray-700/30 rounded">
                                    {variation.imageUrl && (
                                      <img 
                                        src={variation.imageUrl} 
                                        alt={`${cat.name} - Male - ${variation.type || 'Image'}`}
                                        className="w-full h-auto rounded-md my-1 max-h-32 sm:max-h-40 object-contain border border-gray-700 bg-black/[.2] cursor-pointer hover:opacity-80 transition-opacity" 
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                        onClick={() => openImageModal(variation.imageUrl!)}
                                      />
                                    )}
                                    {(variation.type || variation.code) && (
                                      <div className="space-y-0.5 mt-1">
                                        {variation.type && <Label className="text-xs text-gray-400">{variation.type}</Label>}
                                        {variation.code && (
                                          <div className="flex items-center gap-2 p-1.5 bg-black/[.5] rounded font-mono text-xs text-yellow-300 break-all">
                                            <span className="flex-grow">{variation.code}</span>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => handleCopyCode(variation.code)}
                                              title={`Copy ${variation.type || ''} Male Code`}
                                              className="text-gray-300 hover:text-yellow-300 h-6 w-6 p-0"
                                            >
                                              <FaCopy size={12} />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                     {!variation.imageUrl && !variation.type && !variation.code && <p className="text-xs text-gray-500 italic">Empty variation details.</p>}
                                  </div>
                                ))}
                                {cat.maleDescription && (
                                  <p className="text-xs text-gray-300 pt-1 mt-1 border-t border-gray-700/20">{cat.maleDescription}</p>
                                )}
                              </div>
                            )}

                            {shouldShowFemale && (
                              <div className="mt-2 pt-2 border-t border-gray-700/50">
                                <h4 className="text-sm font-semibold text-gray-300 mb-1">Female Version</h4>
                                {cat.femaleOutfitVariations && cat.femaleOutfitVariations.map((variation, index) => (
                                  <div key={`female-var-${cat.id}-${index}`} className="mb-2 p-2 border border-gray-700/30 rounded">
                                    {variation.imageUrl && (
                                      <img 
                                        src={variation.imageUrl} 
                                        alt={`${cat.name} - Female - ${variation.type || 'Image'}`}
                                        className="w-full h-auto rounded-md my-1 max-h-32 sm:max-h-40 object-contain border border-gray-700 bg-black/[.2] cursor-pointer hover:opacity-80 transition-opacity" 
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                        onClick={() => openImageModal(variation.imageUrl!)}
                                      />
                                    )}
                                    {(variation.type || variation.code) && (
                                      <div className="space-y-0.5 mt-1">
                                        {variation.type && <Label className="text-xs text-gray-400">{variation.type}</Label>}
                                        {variation.code && (
                                          <div className="flex items-center gap-2 p-1.5 bg-black/[.5] rounded font-mono text-xs text-pink-300 break-all">
                                            <span className="flex-grow">{variation.code}</span>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => handleCopyCode(variation.code)}
                                              title={`Copy ${variation.type || ''} Female Code`}
                                              className="text-gray-300 hover:text-pink-300 h-6 w-6 p-0"
                                            >
                                              <FaCopy size={12} />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {!variation.imageUrl && !variation.type && !variation.code && <p className="text-xs text-gray-500 italic">Empty variation details.</p>}
                                  </div>
                                ))}
                                {cat.femaleDescription && (
                                  <p className="text-xs text-gray-300 pt-1 mt-1 border-t border-gray-700/20">{cat.femaleDescription}</p>
                                )}
                              </div>
                            )}
                            
                            {!shouldShowMale && !shouldShowFemale && (
                              maleContentExists || femaleContentExists ? (
                                <p className="text-xs text-gray-500 italic pt-2">Outfit details for this category are hidden by active filters.</p>
                              ) : (
                                <p className="text-xs text-gray-500 italic pt-2">No specific outfit details provided for this category.</p>
                              )
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )
                )}
                {/* Add New Category to Division Button and Form */}
                {canEdit && editingDivision !== division.division && addingToDivision !== division.division && !(editingTypeForDivisionId === division.division) && (
                  <div className="mt-4 pt-4 border-t border-[#f3c700]/20">
                    <Button
                      onClick={() => {
                        setAddingToDivision(division.division);
                        setEditingDivision(null); // Ensure edit mode is off
                        setEditingCategoryId(null);
                        setIsAddingNewDivision(false); // Ensure new division form is hidden
                        setEditingTypeForDivisionId(null);
                      }}
                      className="w-full bg-[#f3c700] text-black hover:bg-yellow-400"
                      size="sm"
                    >
                      <FaPlus className="mr-1.5" /> Add New Category to {division.division}
                    </Button>
                  </div>
                )}
                {canEdit && addingToDivision === division.division && (
                  // --- ADD NEW CATEGORY FORM ---
                  <form
                    className="mt-4 pt-4 border-t border-[#f3c700]/20 space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddCategory(division.division);
                    }}
                  >
                    <Label className="text-sm text-[#f3c700] block mb-1">Add New Outfit Category</Label>
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Category Name"
                      className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500"
                    />
                    {/* Male Fields */}
                    <Label className="text-xs text-[#f3c700]/80 block pt-2">Male Version Details - Outfit Variations</Label>
                    {newMaleOutfitEntries.map((entry, index) => (
                      <div key={`add-male-var-${index}`} className="space-y-1 p-2 border border-dashed border-gray-600 rounded mb-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={entry.type}
                            onChange={(e) => handleOutfitEntryChange(newMaleOutfitEntries, setNewMaleOutfitEntries, index, 'type', e.target.value)}
                            placeholder="Type (e.g., Light)"
                            className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs"
                          />
                          <Input
                            value={entry.code}
                            onChange={(e) => handleOutfitEntryChange(newMaleOutfitEntries, setNewMaleOutfitEntries, index, 'code', e.target.value)}
                            placeholder="Code"
                            className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 font-mono text-xs flex-grow"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeOutfitEntry(newMaleOutfitEntries, setNewMaleOutfitEntries, index)}
                            className="text-red-400 hover:text-red-300 h-7 w-7"
                            title="Remove Variation"
                          >
                            <FaTrash size={12} />
                          </Button>
                        </div>
                        <Input
                            type="url"
                            value={entry.imageUrl || ""}
                            onChange={(e) => handleOutfitEntryChange(newMaleOutfitEntries, setNewMaleOutfitEntries, index, 'imageUrl', e.target.value)}
                            placeholder="Image URL (optional)"
                            className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs mt-1"
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addOutfitEntry(newMaleOutfitEntries, setNewMaleOutfitEntries)}
                      className="mt-1 text-xs border-[#f3c700]/50 text-[#f3c700]/80 hover:bg-[#f3c700]/10"
                    >
                      <FaPlus className="mr-1.5" size={10} /> Add Male Variation
                    </Button>
                    <Textarea
                      value={newMaleDescription}
                      onChange={(e) => setNewMaleDescription(e.target.value)}
                      placeholder="Male Description (optional)"
                      className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500"
                      rows={2}
                    />
                    {/* Female Fields */}
                    <Label className="text-xs text-[#f3c700]/80 block pt-2">Female Version Details - Outfit Variations</Label>
                     {newFemaleOutfitEntries.map((entry, index) => (
                      <div key={`add-female-var-${index}`} className="space-y-1 p-2 border border-dashed border-gray-600 rounded mb-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={entry.type}
                            onChange={(e) => handleOutfitEntryChange(newFemaleOutfitEntries, setNewFemaleOutfitEntries, index, 'type', e.target.value)}
                            placeholder="Type (e.g., Light)"
                            className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs"
                          />
                          <Input
                            value={entry.code}
                            onChange={(e) => handleOutfitEntryChange(newFemaleOutfitEntries, setNewFemaleOutfitEntries, index, 'code', e.target.value)}
                            placeholder="Code"
                            className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 font-mono text-xs flex-grow"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeOutfitEntry(newFemaleOutfitEntries, setNewFemaleOutfitEntries, index)}
                            className="text-red-400 hover:text-red-300 h-7 w-7"
                            title="Remove Variation"
                          >
                            <FaTrash size={12} />
                          </Button>
                        </div>
                        <Input
                            type="url"
                            value={entry.imageUrl || ""}
                            onChange={(e) => handleOutfitEntryChange(newFemaleOutfitEntries, setNewFemaleOutfitEntries, index, 'imageUrl', e.target.value)}
                            placeholder="Image URL (optional)"
                            className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs mt-1"
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addOutfitEntry(newFemaleOutfitEntries, setNewFemaleOutfitEntries)}
                      className="mt-1 text-xs border-[#f3c700]/50 text-[#f3c700]/80 hover:bg-[#f3c700]/10"
                    >
                      <FaPlus className="mr-1.5" size={10} /> Add Female Variation
                    </Button>
                    <Textarea
                      value={newFemaleDescription}
                      onChange={(e) => setNewFemaleDescription(e.target.value)}
                      placeholder="Female Description (optional)"
                      className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500"
                      rows={2}
                    />
                    <div className="flex gap-2 mt-2 justify-end">
                        <Button
                          type="submit"
                          size="sm"
                          className="bg-[#f3c700] text-black hover:bg-yellow-400"
                        >
                          <FaPlus className="mr-1.5" /> Add Category
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelAdd}
                            className="border-gray-500 text-gray-300 hover:bg-gray-700/30"
                        >
                            <FaTimes className="mr-1.5" /> Cancel
                        </Button>
                    </div>
                  </form>
                )}
              </CardContent>
              <CardFooter className="py-2 px-4 border-t border-[#f3c700]/20">
                <span className="text-xs text-gray-500">
                  {division.categories.length} {division.categories.length === 1 ? "category" : "categories"}
                </span>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Divider and Auxiliary Outfits */}
        {auxiliaryTypeOutfits.length > 0 && (
          <>
            <div className="my-8 border-b-4 border-[#f3c700]"></div>
            <h2 className="text-2xl font-semibold text-[#f3c700]/90 mb-3">Auxiliary Outfits</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {auxiliaryTypeOutfits.map((division) => (
                <Card
                  key={division.division}
                  className="bg-card border border-[#f3c700]/50 rounded-xl shadow-xl flex flex-col overflow-hidden"
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-[#f3c700]/30">
                    <CardTitle className="text-2xl text-[#f3c700]">
                      {division.division}
                    </CardTitle>
                     <div className="flex items-center gap-2">
                        {canEdit && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-sky-400 hover:text-sky-300 h-7 w-7"
                            onClick={() => {
                              setEditingTypeForDivisionId(division.division);
                              setCurrentEditOutfitType(division.outfitType);
                               // Close other forms
                              setIsAddingNewDivision(false);
                              setAddingToDivision(null);
                              setEditingDivision(null);
                            }}
                            title="Edit Group Type"
                          >
                            <FaCog size={14} />
                          </Button>
                        )}
                        {canEdit && (
                          <Badge variant="outline" className="border-[#f3c700] text-[#f3c700] text-xs">
                            Admin
                          </Badge>
                        )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 py-4 px-4 space-y-4">
                    {/* Edit Outfit Group Type Form (for Auxiliary) */}
                    {editingTypeForDivisionId === division.division && canEdit && (
                      <div className="p-3 my-2 bg-black/[.5] border border-[#f3c700]/30 rounded-md space-y-3">
                        <Label className="text-sm text-[#f3c700] block">Change Outfit Group Type</Label>
                        <RadioGroup
                          value={currentEditOutfitType}
                          onValueChange={(value) => setCurrentEditOutfitType(value as OutfitGroupType)}
                          className="flex space-x-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="division" id={`edit-type-division-aux-${division.division}`} className="border-gray-600 text-[#f3c700] focus:ring-[#f3c700]" />
                            <Label htmlFor={`edit-type-division-aux-${division.division}`} className="text-white/90 text-xs">Division</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="auxiliary" id={`edit-type-auxiliary-aux-${division.division}`} className="border-gray-600 text-[#f3c700] focus:ring-[#f3c700]" />
                            <Label htmlFor={`edit-type-auxiliary-aux-${division.division}`} className="text-white/90 text-xs">Auxiliary</Label>
                          </div>
                        </RadioGroup>
                        <div className="flex gap-2 justify-end mt-2">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs" onClick={() => handleUpdateOutfitGroupType(division.division, currentEditOutfitType)}>
                            <FaSave className="mr-1" /> Save Type
                          </Button>
                          <Button size="sm" variant="outline" className="text-gray-300 border-gray-500 hover:bg-gray-700/30 text-xs" onClick={() => setEditingTypeForDivisionId(null)}>
                            <FaTimes className="mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {division.categories.length === 0 && !(editingTypeForDivisionId === division.division) && (
                      <p className="text-gray-400 italic text-sm">No outfit categories defined yet.</p>
                    )}
                    {division.categories.map((cat) =>
                      editingDivision === division.division &&
                      editingCategoryId === cat.id ? (
                        // --- EDITING FORM ---
                        <div key={cat.id} className="p-4 bg-black/[.4] rounded-lg border border-[#f3c700]/30 space-y-3">
                          <Input
                            value={editCategoryName}
                            onChange={(e) => setEditCategoryName(e.target.value)}
                            placeholder="Category Name"
                            className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500"
                          />
                          {/* Male Fields */}
                          <Label className="text-xs text-[#f3c700] block pt-2">Male Version Outfit Variations</Label>
                          {editMaleOutfitEntries.map((entry, index) => (
                            <div key={`edit-male-var-${index}`} className="space-y-1 p-2 border border-dashed border-gray-600 rounded mb-2">
                              <div className="flex items-center gap-2">
                                <Input
                                  value={entry.type}
                                  onChange={(e) => handleOutfitEntryChange(editMaleOutfitEntries, setEditMaleOutfitEntries, index, 'type', e.target.value)}
                                  placeholder="Type (e.g., Light)"
                                  className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs"
                                />
                                <Input
                                  value={entry.code}
                                  onChange={(e) => handleOutfitEntryChange(editMaleOutfitEntries, setEditMaleOutfitEntries, index, 'code', e.target.value)}
                                  placeholder="Code"
                                  className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 font-mono text-xs flex-grow"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeOutfitEntry(editMaleOutfitEntries, setEditMaleOutfitEntries, index)}
                                  className="text-red-400 hover:text-red-300 h-7 w-7"
                                  title="Remove Variation"
                                >
                                  <FaTrash size={12} />
                                </Button>
                              </div>
                              <Input
                                type="url"
                                value={entry.imageUrl || ""}
                                onChange={(e) => handleOutfitEntryChange(editMaleOutfitEntries, setEditMaleOutfitEntries, index, 'imageUrl', e.target.value)}
                                placeholder="Image URL (optional)"
                                className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs mt-1"
                              />
                            </div>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => addOutfitEntry(editMaleOutfitEntries, setEditMaleOutfitEntries)}
                            className="mt-1 text-xs border-[#f3c700]/50 text-[#f3c700]/80 hover:bg-[#f3c700]/10"
                          >
                            <FaPlus className="mr-1.5" size={10} /> Add Male Variation
                          </Button>
                          <Textarea
                            value={editMaleDescription}
                            onChange={(e) => setEditMaleDescription(e.target.value)}
                            placeholder="Male Description (optional)"
                            className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500"
                            rows={2}
                          />
                          {/* Female Fields */}
                          <Label className="text-xs text-[#f3c700] block pt-2">Female Version Outfit Variations</Label>
                          {editFemaleOutfitEntries.map((entry, index) => (
                            <div key={`edit-female-var-${index}`} className="space-y-1 p-2 border border-dashed border-gray-600 rounded mb-2">
                              <div className="flex items-center gap-2">
                                <Input
                                  value={entry.type}
                                  onChange={(e) => handleOutfitEntryChange(editFemaleOutfitEntries, setEditFemaleOutfitEntries, index, 'type', e.target.value)}
                                  placeholder="Type (e.g., Light)"
                                  className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs"
                                />
                                <Input
                                  value={entry.code}
                                  onChange={(e) => handleOutfitEntryChange(editFemaleOutfitEntries, setEditFemaleOutfitEntries, index, 'code', e.target.value)}
                                  placeholder="Code"
                                  className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 font-mono text-xs flex-grow"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeOutfitEntry(editFemaleOutfitEntries, setEditFemaleOutfitEntries, index)}
                                  className="text-red-400 hover:text-red-300 h-7 w-7"
                                  title="Remove Variation"
                                >
                                  <FaTrash size={12} />
                                </Button>
                              </div>
                              <Input
                                type="url"
                                value={entry.imageUrl || ""}
                                onChange={(e) => handleOutfitEntryChange(editFemaleOutfitEntries, setEditFemaleOutfitEntries, index, 'imageUrl', e.target.value)}
                                placeholder="Image URL (optional)"
                                className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs mt-1"
                              />
                            </div>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => addOutfitEntry(editFemaleOutfitEntries, setEditFemaleOutfitEntries)}
                            className="mt-1 text-xs border-[#f3c700]/50 text-[#f3c700]/80 hover:bg-[#f3c700]/10"
                          >
                            <FaPlus className="mr-1.5" size={10} /> Add Female Variation
                          </Button>
                          <div className="flex gap-2 mt-2 justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleSaveEditCategory(division.division, cat.id)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <FaSave className="mr-1.5" /> Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                              className="border-[#f3c700] text-[#f3c700] hover:bg-[#f3c700]/10"
                            >
                              <FaTimes className="mr-1.5" /> Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // --- DISPLAY CATEGORY ---
                        <div
                          key={cat.id}
                          className="p-3 bg-black/[.3] rounded-lg border border-[#f3c700]/20 relative group space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <span className="font-semibold text-lg text-[#f3c700]">{cat.name}</span>
                            {canEdit && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-blue-400 hover:text-blue-300 h-7 w-7"
                                  onClick={() => handleStartEditCategory(division.division, cat)}
                                  title="Edit"
                                >
                                  <FaEdit size={14} />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-red-400 hover:text-red-300 h-7 w-7"
                                  onClick={() => handleDeleteCategory(division.division, cat.id)}
                                  title="Delete"
                                >
                                  <FaTrash size={14} />
                                </Button>
                              </div>
                            )}
                          </div>
                          
                          {/* Apply filters to Male and Female Version display */}
                          {(() => {
                            const maleContentExists = !!(cat.maleOutfitVariations && cat.maleOutfitVariations.some(v => v.type || v.code || v.imageUrl)) || !!cat.maleDescription;
                            const femaleContentExists = !!(cat.femaleOutfitVariations && cat.femaleOutfitVariations.some(v => v.type || v.code || v.imageUrl)) || !!cat.femaleDescription;
                            
                            const shouldShowMale = showMaleOutfits && maleContentExists;
                            const shouldShowFemale = showFemaleOutfits && femaleContentExists;

                            return (
                              <>
                                {shouldShowMale && (
                                  <div className="mt-2 pt-2 border-t border-gray-700/50">
                                    <h4 className="text-sm font-semibold text-gray-300 mb-1">Male Version</h4>
                                    {cat.maleOutfitVariations && cat.maleOutfitVariations.map((variation, index) => (
                                      <div key={`male-var-${cat.id}-${index}`} className="mb-2 p-2 border border-gray-700/30 rounded">
                                        {variation.imageUrl && (
                                          <img 
                                            src={variation.imageUrl} 
                                            alt={`${cat.name} - Male - ${variation.type || 'Image'}`}
                                            className="w-full h-auto rounded-md my-1 max-h-32 sm:max-h-40 object-contain border border-gray-700 bg-black/[.2] cursor-pointer hover:opacity-80 transition-opacity" 
                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                            onClick={() => openImageModal(variation.imageUrl!)}
                                          />
                                        )}
                                        {(variation.type || variation.code) && (
                                          <div className="space-y-0.5 mt-1">
                                            {variation.type && <Label className="text-xs text-gray-400">{variation.type}</Label>}
                                            {variation.code && (
                                              <div className="flex items-center gap-2 p-1.5 bg-black/[.5] rounded font-mono text-xs text-yellow-300 break-all">
                                                <span className="flex-grow">{variation.code}</span>
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  onClick={() => handleCopyCode(variation.code)}
                                                  title={`Copy ${variation.type || ''} Male Code`}
                                                  className="text-gray-300 hover:text-yellow-300 h-6 w-6 p-0"
                                                >
                                                  <FaCopy size={12} />
                                                </Button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {!variation.imageUrl && !variation.type && !variation.code && <p className="text-xs text-gray-500 italic">Empty variation details.</p>}
                                      </div>
                                    ))}
                                    {cat.maleDescription && (
                                      <p className="text-xs text-gray-300 pt-1 mt-1 border-t border-gray-700/20">{cat.maleDescription}</p>
                                    )}
                                  </div>
                                )}

                                {shouldShowFemale && (
                                  <div className="mt-2 pt-2 border-t border-gray-700/50">
                                    <h4 className="text-sm font-semibold text-gray-300 mb-1">Female Version</h4>
                                    {cat.femaleOutfitVariations && cat.femaleOutfitVariations.map((variation, index) => (
                                      <div key={`female-var-${cat.id}-${index}`} className="mb-2 p-2 border border-gray-700/30 rounded">
                                        {variation.imageUrl && (
                                          <img 
                                            src={variation.imageUrl} 
                                            alt={`${cat.name} - Female - ${variation.type || 'Image'}`}
                                            className="w-full h-auto rounded-md my-1 max-h-32 sm:max-h-40 object-contain border border-gray-700 bg-black/[.2] cursor-pointer hover:opacity-80 transition-opacity" 
                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                            onClick={() => openImageModal(variation.imageUrl!)}
                                          />
                                        )}
                                        {(variation.type || variation.code) && (
                                          <div className="space-y-0.5 mt-1">
                                            {variation.type && <Label className="text-xs text-gray-400">{variation.type}</Label>}
                                            {variation.code && (
                                              <div className="flex items-center gap-2 p-1.5 bg-black/[.5] rounded font-mono text-xs text-pink-300 break-all">
                                                <span className="flex-grow">{variation.code}</span>
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  onClick={() => handleCopyCode(variation.code)}
                                                  title={`Copy ${variation.type || ''} Female Code`}
                                                  className="text-gray-300 hover:text-pink-300 h-6 w-6 p-0"
                                                >
                                                  <FaCopy size={12} />
                                                </Button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {!variation.imageUrl && !variation.type && !variation.code && <p className="text-xs text-gray-500 italic">Empty variation details.</p>}
                                      </div>
                                    ))}
                                    {cat.femaleDescription && (
                                      <p className="text-xs text-gray-300 pt-1 mt-1 border-t border-gray-700/20">{cat.femaleDescription}</p>
                                    )}
                                  </div>
                                )}
                                
                                {!shouldShowMale && !shouldShowFemale && (
                                  maleContentExists || femaleContentExists ? (
                                    <p className="text-xs text-gray-500 italic pt-2">Outfit details for this category are hidden by active filters.</p>
                                  ) : (
                                    <p className="text-xs text-gray-500 italic pt-2">No specific outfit details provided for this category.</p>
                                  )
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )
                    )}
                    {/* Add New Category to Auxiliary Group Button and Form (similar to divisions) */}
                    {canEdit && editingDivision !== division.division && addingToDivision !== division.division && !(editingTypeForDivisionId === division.division) && (
                      <div className="mt-4 pt-4 border-t border-[#f3c700]/20">
                        <Button
                          onClick={() => {
                            setAddingToDivision(division.division);
                            setEditingDivision(null); 
                            setEditingCategoryId(null);
                            setIsAddingNewDivision(false);
                            setEditingTypeForDivisionId(null);
                          }}
                          className="w-full bg-[#f3c700] text-black hover:bg-yellow-400"
                          size="sm"
                        >
                          <FaPlus className="mr-1.5" /> Add New Category to {division.division}
                        </Button>
                      </div>
                    )}
                    {canEdit && addingToDivision === division.division && (
                      // --- ADD NEW CATEGORY FORM (same as for divisions) ---
                      <form
                        className="mt-4 pt-4 border-t border-[#f3c700]/20 space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAddCategory(division.division);
                        }}
                      >
                        <Label className="text-sm text-[#f3c700] block mb-1">Add New Outfit Category</Label>
                        <Input
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Category Name"
                          className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500"
                        />
                        {/* Male Fields */}
                        <Label className="text-xs text-[#f3c700]/80 block pt-2">Male Version Details - Outfit Variations</Label>
                        {newMaleOutfitEntries.map((entry, index) => (
                          <div key={`add-male-var-${index}`} className="space-y-1 p-2 border border-dashed border-gray-600 rounded mb-2">
                            <div className="flex items-center gap-2">
                              <Input
                                value={entry.type}
                                onChange={(e) => handleOutfitEntryChange(newMaleOutfitEntries, setNewMaleOutfitEntries, index, 'type', e.target.value)}
                                placeholder="Type (e.g., Light)"
                                className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs"
                              />
                              <Input
                                value={entry.code}
                                onChange={(e) => handleOutfitEntryChange(newMaleOutfitEntries, setNewMaleOutfitEntries, index, 'code', e.target.value)}
                                placeholder="Code"
                                className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 font-mono text-xs flex-grow"
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => removeOutfitEntry(newMaleOutfitEntries, setNewMaleOutfitEntries, index)}
                                className="text-red-400 hover:text-red-300 h-7 w-7"
                                title="Remove Variation"
                              >
                                <FaTrash size={12} />
                              </Button>
                            </div>
                            <Input
                                type="url"
                                value={entry.imageUrl || ""}
                                onChange={(e) => handleOutfitEntryChange(newMaleOutfitEntries, setNewMaleOutfitEntries, index, 'imageUrl', e.target.value)}
                                placeholder="Image URL (optional)"
                                className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs mt-1"
                            />
                          </div>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addOutfitEntry(newMaleOutfitEntries, setNewMaleOutfitEntries)}
                          className="mt-1 text-xs border-[#f3c700]/50 text-[#f3c700]/80 hover:bg-[#f3c700]/10"
                        >
                          <FaPlus className="mr-1.5" size={10} /> Add Male Variation
                        </Button>
                        <Textarea
                          value={newMaleDescription}
                          onChange={(e) => setNewMaleDescription(e.target.value)}
                          placeholder="Male Description (optional)"
                          className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500"
                          rows={2}
                        />
                        {/* Female Fields */}
                        <Label className="text-xs text-[#f3c700]/80 block pt-2">Female Version Details - Outfit Variations</Label>
                         {newFemaleOutfitEntries.map((entry, index) => (
                          <div key={`add-female-var-${index}`} className="space-y-1 p-2 border border-dashed border-gray-600 rounded mb-2">
                            <div className="flex items-center gap-2">
                              <Input
                                value={entry.type}
                                onChange={(e) => handleOutfitEntryChange(newFemaleOutfitEntries, setNewFemaleOutfitEntries, index, 'type', e.target.value)}
                                placeholder="Type (e.g., Light)"
                                className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs"
                              />
                              <Input
                                value={entry.code}
                                onChange={(e) => handleOutfitEntryChange(newFemaleOutfitEntries, setNewFemaleOutfitEntries, index, 'code', e.target.value)}
                                placeholder="Code"
                                className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 font-mono text-xs flex-grow"
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => removeOutfitEntry(newFemaleOutfitEntries, setNewFemaleOutfitEntries, index)}
                                className="text-red-400 hover:text-red-300 h-7 w-7"
                                title="Remove Variation"
                              >
                                <FaTrash size={12} />
                              </Button>
                            </div>
                            <Input
                                type="url"
                                value={entry.imageUrl || ""}
                                onChange={(e) => handleOutfitEntryChange(newFemaleOutfitEntries, setNewFemaleOutfitEntries, index, 'imageUrl', e.target.value)}
                                placeholder="Image URL (optional)"
                                className="bg-input border-[#f3c700]/40 text-white placeholder:text-gray-500 text-xs mt-1"
                            />
                          </div>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addOutfitEntry(newFemaleOutfitEntries, setNewFemaleOutfitEntries)}
                          className="mt-1 text-xs border-[#f3c700]/50 text-[#f3c700]/80 hover:bg-[#f3c700]/10"
                        >
                          <FaPlus className="mr-1.5" size={10} /> Add Female Variation
                        </Button>
                        <div className="flex gap-2 mt-2 justify-end">
                            <Button
                              type="submit"
                              size="sm"
                              className="bg-[#f3c700] text-black hover:bg-yellow-400"
                            >
                              <FaPlus className="mr-1.5" /> Add Category
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelAdd}
                                className="border-gray-500 text-gray-300 hover:bg-gray-700/30"
                            >
                                <FaTimes className="mr-1.5" /> Cancel
                            </Button>
                        </div>
                      </form>
                    )}
                  </CardContent>
                  <CardFooter className="py-2 px-4 border-t border-[#f3c700]/20">
                    <span className="text-xs text-gray-500">
                      {division.categories.length} {division.categories.length === 1 ? "category" : "categories"}
                    </span>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </>
        )}
        
        {divisionTypeOutfits.length === 0 && auxiliaryTypeOutfits.length === 0 && !isAddingNewDivision && (
             <p className="text-center text-gray-400 mt-10">No outfit groups defined yet. Click "Create New Outfit Group" to add one.</p>
        )}

        {canEdit && (
          <div className="mt-10 text-center text-xs text-gray-500">
            <span>
              Command/High Command can manage outfit categories.
            </span>
          </div>
        )}

        {/* Image Modal */}
        {isImageModalOpen && currentModalImageUrl && (
          <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={closeImageModal} // Close on backdrop click
          >
            <div 
              className="bg-card p-4 rounded-lg shadow-xl max-w-3xl max-h-[90vh] overflow-auto relative"
              onClick={(e) => e.stopPropagation()} // Prevent modal close when clicking inside modal content
            >
              <img 
                src={currentModalImageUrl} 
                alt="Enlarged outfit variation" 
                className="max-w-full max-h-[80vh] object-contain rounded"
              />
              <Button 
                onClick={closeImageModal}
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-white hover:text-gray-300 bg-black/50 hover:bg-black/70 rounded-full h-8 w-8"
                title="Close"
              >
                <FaTimes size={18} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Outfits;
