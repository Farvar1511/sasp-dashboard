import React, { useState, useEffect } from 'react';
// Added limit to imports
import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, Timestamp, CollectionReference, DocumentData, query, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext'; // Ensure useAuth is imported
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"; // Ensure Tabs are imported
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'; // Ensure Card components are imported
import { Button } from '../ui/button'; // Ensure Button is imported
import { Input } from '../ui/input'; // Ensure Input is imported
import { Textarea } from '../ui/textarea'; // Ensure Textarea is imported
import { Label } from '../ui/label'; // Ensure Label is imported
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"; // Ensure Select components are imported
import { FaTrash } from 'react-icons/fa';
import { FaPlus } from 'react-icons/fa6'; // Use the correct submodule if needed
import { toast } from 'react-toastify'; // Ensure toast is imported
import { Skeleton } from '../ui/skeleton'; // Ensure Skeleton is imported
import ConfirmationModal from '../ConfirmationModal'; // Ensure ConfirmationModal is imported
import { Gang, GangVehicle, GangNote } from '../../utils/ciuUtils'; // Import types from ciuUtils
import GangRoster from './GangRoster'; // Import the GangRoster component

// --- Firestore Collection Constants ---
const GANGS_COLLECTION = "gangs";
const VEHICLES_COLLECTION = "vehicles"; // Ensure this matches your Firestore subcollection name
const NOTES_COLLECTION = "notes"; // Ensure this matches your Firestore subcollection name for individual notes

// --- Component ---
const GangManagementTab: React.FC = () => {
    const { user: currentUser } = useAuth(); // Ensure currentUser is obtained
    const [gangs, setGangs] = useState<Gang[]>([]);
    const [selectedGangId, setSelectedGangId] = useState<string | null>(null);
    const [loadingGangs, setLoadingGangs] = useState(true); // Start true
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); // For disabling buttons during operations

    // State for selected gang details (subcollections)
    const [vehicles, setVehicles] = useState<GangVehicle[]>([]); // Use imported type
    const [notes, setNotes] = useState<GangNote[]>([]); // Use imported type
    // State for top-level editable fields
    const [gangName, setGangName] = useState('');
    const [description, setDescription] = useState('');
    const [clothingInfo, setClothingInfo] = useState('');
    const [locationInfo, setLocationInfo] = useState('');
    const [vehiclesInfo, setVehiclesInfo] = useState(''); // General vehicles info
    const [generalNotes, setGeneralNotes] = useState(''); // Main notes field
    const [photoUrl, setPhotoUrl] = useState('');
    const [level, setLevel] = useState<number | null>(null);

    // State for adding new items
    const [newVehiclePlate, setNewVehiclePlate] = useState('');
    const [newVehicleModel, setNewVehicleModel] = useState('');
    const [newVehicleMember, setNewVehicleMember] = useState('');
    const [newVehicleActivity, setNewVehicleActivity] = useState('');
    const [newNoteText, setNewNoteText] = useState('');


    // State for adding a new gang
    const [showAddGangForm, setShowAddGangForm] = useState(false);
    const [newGangName, setNewGangName] = useState('');
    const [newGangDescription, setNewGangDescription] = useState('');

    // Confirmation Modal State
    const [confirmationModal, setConfirmationModal] = useState<{
        show: boolean;
        message: string;
        onConfirm: () => void;
    } | null>(null);

    // Edit mode and state for each tab
    const [infoEditMode, setInfoEditMode] = useState(false);
    const [infoEditState, setInfoEditState] = useState<{
        gangName: string;
        description: string;
        level: number | null;
        photoUrl: string;
        vehiclesInfo: string; // Ensure this matches the field name
    } | null>(null);

    const [clothingEditMode, setClothingEditMode] = useState(false);
    const [clothingEditState, setClothingEditState] = useState<string>('');

    const [locationEditMode, setLocationEditMode] = useState(false);
    const [locationEditState, setLocationEditState] = useState<string>('');

    // Edit mode/state for the GENERAL vehicles info field
    const [generalVehiclesInfoEditMode, setGeneralVehiclesInfoEditMode] = useState(false);
    const [generalVehiclesInfoEditState, setGeneralVehiclesInfoEditState] = useState<string>('');

    // Edit mode/state for the MAIN notes field
    const [mainNotesEditMode, setMainNotesEditMode] = useState(false);
    const [mainNotesEditState, setMainNotesEditState] = useState<string>('');

    // --- useEffect Hooks ---
    useEffect(() => {
        console.log("GangManagementTab: Mounting, fetching gangs...");
        fetchGangs(); // Fetch the list of gangs when the component mounts
    }, []); // Empty dependency array is correct here

    useEffect(() => {
        console.log("GangManagementTab: selectedGangId changed to:", selectedGangId);
        // Fetch details or reset when the selected gang changes
        if (selectedGangId) {
            fetchGangDetails(selectedGangId);
        } else {
            resetGangDetails(); // Clear details if no gang is selected
        }
        // Reset edit modes whenever the selected gang changes
        setInfoEditMode(false);
        setInfoEditState(null);
        setClothingEditMode(false);
        setClothingEditState('');
        setLocationEditMode(false);
        setLocationEditState('');
        // Reset edit mode for the *general* vehicles info field
        setGeneralVehiclesInfoEditMode(false);
        setGeneralVehiclesInfoEditState('');
        // Reset edit mode for the *main* notes field
        setMainNotesEditMode(false);
        setMainNotesEditState('');
    }, [selectedGangId]); // Dependency array ensures this runs when selectedGangId changes

    // --- Data Fetching ---
    const fetchGangs = async () => {
        console.log("fetchGangs: Starting...");
        setLoadingGangs(true); // Set loading true at the start
        try {
            const gangsSnapshot = await getDocs(query(collection(dbFirestore, GANGS_COLLECTION), orderBy("name")));
            const gangsData = gangsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Gang[];
            console.log("fetchGangs: Fetched data:", gangsData);
            setGangs(gangsData);
            if (gangsData.length === 0) {
                console.log("fetchGangs: No gangs found in the database.");
                // toast.info("No gangs found in the database."); // Optional: Can be noisy
            }
        } catch (error) {
            console.error("Error fetching gangs:", error);
            toast.error("Failed to fetch gangs.");
        } finally {
            console.log("fetchGangs: Finished.");
            setLoadingGangs(false); // Set loading false at the end (success or error)
        }
    };

    const fetchGangDetails = async (gangId: string) => {
        if (!gangId) {
            console.error("fetchGangDetails: No gang ID provided.");
            return;
        }
        console.log(`fetchGangDetails: Fetching details for gangId: ${gangId}`);
        setLoadingDetails(true);
        try {
            const gangDocRef = doc(dbFirestore, GANGS_COLLECTION, gangId);
            const gangDocSnap = await getDoc(gangDocRef);
            if (gangDocSnap.exists()) {
                const gangData = gangDocSnap.data() as Gang;
                console.log("fetchGangDetails: Gang data:", gangData);
                // Set state based on fetched data
                setGangName(gangData.name || '');
                setDescription(gangData.description || '');
                setClothingInfo(gangData.clothingInfo || '');
                setLocationInfo(gangData.locationInfo || '');
                setVehiclesInfo(gangData.vehiclesInfo || ''); // General vehicles info
                setGeneralNotes(gangData.notes || ''); // Main notes field
                setPhotoUrl(gangData.photoUrl || '');
                setLevel(gangData.level ?? null);

                // Fetch vehicles subcollection
                const vehiclesColRef = collection(dbFirestore, GANGS_COLLECTION, gangId, VEHICLES_COLLECTION);
                const vehiclesSnap = await getDocs(query(vehiclesColRef, orderBy('timestamp', 'desc'))); // Optional: order vehicles
                const vehiclesList = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GangVehicle[];
                setVehicles(vehiclesList);
                console.log("fetchGangDetails: Fetched vehicles:", vehiclesList);

                // Fetch notes subcollection
                const notesColRef = collection(dbFirestore, GANGS_COLLECTION, gangId, NOTES_COLLECTION);
                const notesSnap = await getDocs(query(notesColRef, orderBy('timestamp', 'desc'))); // Optional: order notes
                const notesList = notesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GangNote[];
                setNotes(notesList);
                console.log("fetchGangDetails: Fetched notes:", notesList);

            } else {
                console.warn(`fetchGangDetails: Gang with ID ${gangId} not found.`);
                toast.warn(`Gang with ID ${gangId} not found.`);
                resetGangDetails(); // Reset if gang doesn't exist
            }
        } catch (error) {
            console.error("Error fetching gang details:", error);
            toast.error("Failed to fetch gang details.");
        } finally {
            console.log(`fetchGangDetails: Finished fetching for gangId: ${gangId}`);
            setLoadingDetails(false); // Set loading false at the end
        }
    };

    const resetGangDetails = () => {
        console.log("resetGangDetails: Clearing gang details.");
        setGangName('');
        setDescription('');
        setClothingInfo('');
        setLocationInfo('');
        setVehiclesInfo(''); // General vehicles info
        setGeneralNotes(''); // Main notes field
        setPhotoUrl('');
        setLevel(null);
        setVehicles([]);
        setNotes([]);
        // Also reset edit modes and temporary edit states
        setInfoEditMode(false);
        setInfoEditState(null);
        setClothingEditMode(false);
        setClothingEditState('');
        setLocationEditMode(false);
        setLocationEditState('');
        setGeneralVehiclesInfoEditMode(false); // General vehicles info edit mode
        setGeneralVehiclesInfoEditState(''); // General vehicles info edit state
        setMainNotesEditMode(false); // Main notes field edit mode
        setMainNotesEditState(''); // Main notes field edit state
    };

    // --- Handlers for Adding/Editing/Deleting ---

    // Note Deletion Handler
    const requestDeleteNote = (noteId: string) => {
        if (!selectedGangId) return;
        setConfirmationModal({
            show: true,
            message: 'Are you sure you want to delete this note? This action cannot be undone.',
            onConfirm: async () => {
                setConfirmationModal(null);
                setIsSubmitting(true);
                try {
                    await deleteDoc(doc(dbFirestore, GANGS_COLLECTION, selectedGangId, NOTES_COLLECTION, noteId));
                    toast.success('Note deleted successfully.');
                    await fetchGangDetails(selectedGangId); // Refresh
                } catch (error) {
                    console.error('Error deleting note:', error);
                    toast.error('Failed to delete note.');
                } finally {
                    setIsSubmitting(false);
                }
            },
        });
    };

    // Vehicle Deletion Handler
    const requestDeleteVehicle = (vehicleId: string, vehiclePlate: string) => {
        if (!selectedGangId) return;
        setConfirmationModal({
            show: true,
            message: `Are you sure you want to remove vehicle "${vehiclePlate}"? This action cannot be undone.`,
            onConfirm: async () => {
                setConfirmationModal(null);
                setIsSubmitting(true);
                try {
                    await deleteDoc(doc(dbFirestore, GANGS_COLLECTION, selectedGangId, VEHICLES_COLLECTION, vehicleId));
                    toast.success(`Vehicle "${vehiclePlate}" removed successfully.`);
                    await fetchGangDetails(selectedGangId); // Refresh
                } catch (error) {
                    console.error("Error deleting vehicle:", error);
                    toast.error("Failed to remove vehicle.");
                } finally {
                    setIsSubmitting(false);
                }
            },
        });
    };

    // --- Edit Mode Handlers ---

    // Info Tab handlers
    const enterInfoEditMode = () => {
        setInfoEditState({
            gangName,
            description,
            level,
            photoUrl,
            vehiclesInfo, // Use the correct state variable name
        });
        setInfoEditMode(true);
    };
    const cancelInfoEditMode = () => {
        setInfoEditMode(false);
        setInfoEditState(null);
    };
    const saveInfoEdit = async () => {
        if (!infoEditState || !selectedGangId || !currentUser) return;
        setIsSubmitting(true);
        try {
            const gangDocRef = doc(dbFirestore, GANGS_COLLECTION, selectedGangId);
            // Save empty strings instead of null for photoUrl and vehiclesInfo
            const updatedData: Partial<Gang> = {
                name: infoEditState.gangName,
                description: infoEditState.description || null, // Keep null for description if empty
                level: infoEditState.level,
                photoUrl: infoEditState.photoUrl ?? '', // Use ?? '' to save empty string if null/undefined
                vehiclesInfo: infoEditState.vehiclesInfo ?? '', // Use ?? '' to save empty string if null/undefined
                updatedAt: serverTimestamp() as Timestamp, // Cast to Timestamp
                updatedByName: currentUser.name || currentUser.displayName || "Unknown",
            };
            await updateDoc(gangDocRef, updatedData);
            // Update local state immediately for responsiveness
            setGangName(infoEditState.gangName);
            setDescription(infoEditState.description);
            setLevel(infoEditState.level);
            // Ensure local state reflects the saved value (empty string if it was empty)
            setPhotoUrl(infoEditState.photoUrl ?? '');
            setVehiclesInfo(infoEditState.vehiclesInfo ?? '');
            toast.success("Gang information updated.");
            await fetchGangs(); // Refetch list in case name changed
        } catch (error) {
            console.error("Error saving gang info:", error);
            toast.error("Failed to save gang info.");
        } finally {
            setInfoEditMode(false);
            setInfoEditState(null);
            setIsSubmitting(false);
        }
    };

    // Clothing Tab handlers
    const enterClothingEditMode = () => {
        setClothingEditState(clothingInfo);
        setClothingEditMode(true);
    };
    const cancelClothingEditMode = () => {
        setClothingEditMode(false);
        setClothingEditState('');
    };
    const saveClothingEdit = async () => {
        if (!selectedGangId || !currentUser) return;
        setIsSubmitting(true);
        try {
            const gangDocRef = doc(dbFirestore, GANGS_COLLECTION, selectedGangId);
            await updateDoc(gangDocRef, {
                clothingInfo: clothingEditState || null,
                updatedAt: serverTimestamp() as Timestamp, // Cast to Timestamp
                updatedByName: currentUser.name || currentUser.displayName || "Unknown",
            });
            setClothingInfo(clothingEditState); // Update local state
            toast.success("Clothing info updated.");
        } catch (error) {
            console.error("Error saving clothing info:", error);
            toast.error("Failed to save clothing info.");
        } finally {
            setClothingEditMode(false);
            setClothingEditState('');
            setIsSubmitting(false);
        }
    };

    // Location Tab handlers
    const enterLocationEditMode = () => {
        setLocationEditState(locationInfo);
        setLocationEditMode(true);
    };
    const cancelLocationEditMode = () => {
        setLocationEditMode(false);
        setLocationEditState('');
    };
    const saveLocationEdit = async () => {
         if (!selectedGangId || !currentUser) return;
        setIsSubmitting(true);
        try {
            const gangDocRef = doc(dbFirestore, GANGS_COLLECTION, selectedGangId);
            await updateDoc(gangDocRef, {
                locationInfo: locationEditState || null,
                updatedAt: serverTimestamp() as Timestamp, // Cast to Timestamp
                updatedByName: currentUser.name || currentUser.displayName || "Unknown",
            });
            setLocationInfo(locationEditState); // Update local state
            toast.success("Location info updated.");
        } catch (error) {
            console.error("Error saving location info:", error);
            toast.error("Failed to save location info.");
        } finally {
            setLocationEditMode(false);
            setLocationEditState('');
            setIsSubmitting(false);
        }
    };

    // Edit mode/state for the GENERAL vehicles info field
    const enterGeneralVehiclesInfoEditMode = () => {
        setGeneralVehiclesInfoEditState(vehiclesInfo); // Use correct state
        setGeneralVehiclesInfoEditMode(true); // Use correct state
    };
    const cancelGeneralVehiclesInfoEditMode = () => {
        setGeneralVehiclesInfoEditMode(false); // Use correct state
        setGeneralVehiclesInfoEditState(''); // Use correct state
    };
    const saveGeneralVehiclesInfoEdit = async () => {
        if (!selectedGangId || !currentUser) return;
        setIsSubmitting(true);
        try {
            const gangDocRef = doc(dbFirestore, GANGS_COLLECTION, selectedGangId);
            await updateDoc(gangDocRef, {
                vehiclesInfo: generalVehiclesInfoEditState || null, // Use correct state
                updatedAt: serverTimestamp() as Timestamp, // Cast to Timestamp
                updatedByName: currentUser.name || currentUser.displayName || "Unknown",
            });
            setVehiclesInfo(generalVehiclesInfoEditState); // Update local state
            toast.success("General vehicles info updated.");
        } catch (error) {
            console.error("Error saving general vehicles info:", error);
            toast.error("Failed to save general vehicles info.");
        } finally {
            setGeneralVehiclesInfoEditMode(false); // Use correct state
            setGeneralVehiclesInfoEditState(''); // Use correct state
            setIsSubmitting(false);
        }
    };

    // Edit mode/state for the MAIN notes field
    const enterMainNotesEditMode = () => {
        setMainNotesEditState(generalNotes); // Use correct state
        setMainNotesEditMode(true); // Use correct state
    };
    const cancelMainNotesEditMode = () => {
        setMainNotesEditMode(false); // Use correct state
        setMainNotesEditState(''); // Use correct state
    };
    const saveMainNotesEdit = async () => {
        if (!selectedGangId || !currentUser) return;
        setIsSubmitting(true);
        try {
            const gangDocRef = doc(dbFirestore, GANGS_COLLECTION, selectedGangId);
            await updateDoc(gangDocRef, {
                notes: mainNotesEditState || null, // Use correct state and field name 'notes'
                updatedAt: serverTimestamp() as Timestamp, // Cast to Timestamp
                updatedByName: currentUser.name || currentUser.displayName || "Unknown",
            });
            setGeneralNotes(mainNotesEditState); // Update local state
            toast.success("Main notes updated.");
        } catch (error) {
            console.error("Error saving main notes:", error);
            toast.error("Failed to save main notes.");
        } finally {
            setMainNotesEditMode(false); // Use correct state
            setMainNotesEditState(''); // Use correct state
            setIsSubmitting(false);
        }
    };

    // --- Gang Level Operations ---

    // Gang Deletion Handler
    const requestDeleteGang = (id: string) => {
        // selectedGangId should already be set if the button is visible
        if (!selectedGangId) {
            toast.error("No gang selected to delete.");
            return;
        }
        const gangToDelete = gangs.find(g => g.id === selectedGangId);
        setConfirmationModal({
            show: true,
            message: `Are you sure you want to delete the gang "${gangToDelete?.name || 'Unknown'}"? This will also delete all associated members, vehicles, and notes. This action cannot be undone.`,
            onConfirm: async () => {
                setConfirmationModal(null);
                setIsSubmitting(true);
                console.log(`Attempting to delete gang: ${selectedGangId}`);
                try {
                    // TODO: Implement deletion of subcollections if necessary before deleting the main doc
                    // This requires careful handling, potentially using batched writes or cloud functions for atomicity.
                    // For now, just deleting the main doc:
                    await deleteDoc(doc(dbFirestore, GANGS_COLLECTION, selectedGangId));
                    toast.success(`Gang "${gangToDelete?.name || 'Unknown'}" deleted successfully.`);
                    setSelectedGangId(null); // Reset selection
                    await fetchGangs(); // Refresh the list
                } catch (error) {
                    console.error("Error deleting gang:", error);
                    toast.error("Failed to delete gang.");
                } finally {
                    setIsSubmitting(false);
                }
            },
        });
    };

    // Add New Gang Handler
    const handleAddNewGang = async () => {
        if (!newGangName.trim()) {
            toast.error("Gang name is required.");
            return;
        }
        if (!currentUser) {
             toast.error("User not authenticated.");
             return;
        }
        setIsSubmitting(true);
        try {
            const gangsColRef = collection(dbFirestore, GANGS_COLLECTION);
            const newGangData: Omit<Gang, 'id'> = { // Use Omit<Gang, 'id'> for type safety
                name: newGangName.trim(),
                description: newGangDescription.trim() || null,
                level: null, // Default level
                createdAt: serverTimestamp() as Timestamp, // Cast needed for Omit type
                createdByName: currentUser.name || "Unknown",
                // Initialize other fields as empty/null
                clothingInfo: '',
                locationInfo: '',
                vehiclesInfo: '',
                notes: '',
                photoUrl: '',
                updatedAt: serverTimestamp() as Timestamp, // Also set updatedAt on creation (Cast needed)
                updatedByName: currentUser.name || "Unknown",
            };
            const newDocRef = await addDoc(gangsColRef, newGangData);
            toast.success(`Gang "${newGangName.trim()}" added.`);
            setNewGangName('');
            setNewGangDescription('');
            setShowAddGangForm(false);
            await fetchGangs(); // Refresh list
            setSelectedGangId(newDocRef.id); // Optionally select the newly added gang
        } catch (error) {
            console.error("Error adding new gang:", error);
            toast.error("Failed to add new gang.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Subcollection Item Add Handlers ---

    // Add Vehicle Handler
    const handleAddVehicle = async () => {
        if (!newVehiclePlate.trim() || !newVehicleActivity.trim()) {
            toast.error("Vehicle plate and activity notes are required.");
            return;
        }
        if (!selectedGangId || !currentUser) {
            toast.error("No gang selected or user not authenticated.");
            return;
        }
        setIsSubmitting(true);
        try {
            const vehiclesColRef = collection(dbFirestore, GANGS_COLLECTION, selectedGangId, VEHICLES_COLLECTION);
            const newVehicleData: Omit<GangVehicle, 'id'> = { // Use Omit for type safety
                plate: newVehiclePlate.trim(),
                model: newVehicleModel.trim() || undefined, // Use undefined if optional and empty
                memberName: newVehicleMember.trim() || undefined, // Use undefined if optional and empty
                activityNotes: newVehicleActivity.trim(),
                timestamp: serverTimestamp() as Timestamp, // Cast needed
                addedByName: currentUser.name || currentUser.displayName || "Unknown",
            };
            await addDoc(vehiclesColRef, newVehicleData);
            toast.success("Vehicle added.");
            setNewVehiclePlate('');
            setNewVehicleModel('');
            setNewVehicleMember('');
            setNewVehicleActivity('');
            await fetchGangDetails(selectedGangId); // Refresh details
        } catch (error) {
            console.error("Error adding vehicle:", error);
            toast.error("Failed to add vehicle.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Add Note Handler
    const handleAddNote = async () => { // Removed event param as it's not used
        if (!newNoteText.trim()) {
            toast.error("Note text is required.");
            return;
        }
        if (!selectedGangId || !currentUser) {
            toast.error("No gang selected or user not authenticated.");
            return;
        }
        setIsSubmitting(true);
        try {
            const notesColRef = collection(dbFirestore, GANGS_COLLECTION, selectedGangId, NOTES_COLLECTION);
             const newNoteData: Omit<GangNote, 'id'> = { // Use Omit for type safety
                note: newNoteText.trim(),
                author: currentUser.name || currentUser.displayName || "Unknown",
                timestamp: serverTimestamp() as Timestamp, // Cast needed
            };
            await addDoc(notesColRef, newNoteData);
            toast.success("Note added.");
            setNewNoteText('');
            await fetchGangDetails(selectedGangId); // Refresh details
        } catch (error) {
            console.error("Error adding note:", error);
            toast.error("Failed to add note.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Render ---
    return (
        <div className="space-y-6 bg-black/95 p-4 rounded-lg border border-border">
            {/* Gang Selection & Add/Delete Buttons */}
            <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-grow max-w-sm">
                    <Label htmlFor="gangSelect" className="text-foreground/80">Select Gang</Label>
                    {/* Add console log to check gangs state before mapping */}
                    {/* {console.log("Rendering Select, gangs state:", gangs)} */}
                    <Select
                        value={selectedGangId || "__placeholder__"}
                        onValueChange={(value) => {
                            console.log("Select onValueChange:", value);
                            const newSelectedId = value === "__placeholder__" ? null : value;
                            setSelectedGangId(newSelectedId);
                        }}
                        // Disable while loading the list of gangs OR details OR submitting
                        disabled={loadingGangs || loadingDetails || isSubmitting}
                    >
                        <SelectTrigger id="gangSelect" className="bg-input border-border text-foreground">
                            {/* Improved Placeholder Logic */}
                            <SelectValue placeholder={loadingGangs ? "Loading gangs..." : (gangs.length === 0 ? "No gangs found" : "Select a gang")} />
                        </SelectTrigger>
                        <SelectContent className="bg-black/95 text-popover-foreground border-border shadow-md z-50">
                            {/* Placeholder Item - Make it clear it's not selectable */}
                            <SelectItem value="__placeholder__" disabled>-- Select a Gang --</SelectItem>
                            {/* Map over the fetched gangs */}
                            {gangs.length > 0 ? (
                                gangs.map(gang => (
                                    <SelectItem key={gang.id} value={gang.id}>
                                        {gang.name}
                                    </SelectItem>
                                ))
                            ) : (
                                // Show message only if not loading and list is empty
                                !loadingGangs && <div className="px-4 py-2 text-sm text-muted-foreground italic">No gangs available</div>
                            )}
                        </SelectContent>
                    </Select>
                </div>
                <Button
                    onClick={() => setShowAddGangForm(true)}
                    disabled={isSubmitting || loadingGangs} // Also disable if loading list
                    variant="outline"
                    className="text-accent border-accent hover:bg-accent/10"
                >
                    <FaPlus className="mr-2 h-4 w-4" /> Add New Gang
                </Button>
                {selectedGangId && (
                    <Button
                        onClick={() => requestDeleteGang(selectedGangId)}
                        disabled={isSubmitting || loadingDetails || loadingGangs} // Also disable if loading list/details
                        variant="destructive"
                    >
                        <FaTrash className="mr-2 h-4 w-4" /> Delete Selected Gang
                    </Button>
                )}
            </div>

            {/* Add New Gang Form */}
            {showAddGangForm && (
                <Card className="bg-black/95 border-border mt-4">
                    <CardHeader>
                        <CardTitle className="text-accent">Add New Gang</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <Label htmlFor="newGangName" className="text-foreground/80">Gang Name *</Label>
                            <Input
                                id="newGangName"
                                value={newGangName}
                                onChange={e => setNewGangName(e.target.value)}
                                placeholder="Enter name for the new gang"
                                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <Label htmlFor="newGangDescription" className="text-foreground/80">Description</Label>
                            <Input
                                id="newGangDescription"
                                value={newGangDescription}
                                onChange={e => setNewGangDescription(e.target.value)}
                                placeholder="Short description (e.g., MC in Paleto)"
                                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowAddGangForm(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddNewGang}
                                disabled={isSubmitting || !newGangName.trim()}
                                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                            >
                                {isSubmitting ? 'Adding...' : 'Add Gang'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Details Section (Tabs) */}
            {selectedGangId && (
                <Tabs defaultValue="info" className="w-full">
                    <TabsList className="mb-4 grid w-full grid-cols-6 bg-transparent p-0 border-b border-border">
                        {/* Info Tab Trigger */}
                        <TabsTrigger
                            value="info"
                            className="data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-foreground data-[state=active]:bg-transparent text-muted-foreground px-1 py-2 text-sm" // Changed text-accent to text-foreground
                        >
                            Info
                        </TabsTrigger>
                        {/* Roster Tab Trigger */}
                        <TabsTrigger
                            value="roster"
                            className="data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-foreground data-[state=active]:bg-transparent text-muted-foreground px-1 py-2 text-sm" // Changed text-accent to text-foreground
                        >
                            Roster {/* Removed count */}
                        </TabsTrigger>
                        {/* Clothing Tab Trigger */}
                        <TabsTrigger
                            value="clothing"
                            className="data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-foreground data-[state=active]:bg-transparent text-muted-foreground px-1 py-2 text-sm" // Changed text-accent to text-foreground
                        >
                            Clothing
                        </TabsTrigger>
                        {/* Location Tab Trigger */}
                        <TabsTrigger
                            value="location"
                            className="data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-foreground data-[state=active]:bg-transparent text-muted-foreground px-1 py-2 text-sm" // Changed text-accent to text-foreground
                        >
                            Location
                        </TabsTrigger>
                        {/* Vehicles Tab Trigger */}
                        <TabsTrigger
                            value="vehicles"
                            className="data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-foreground data-[state=active]:bg-transparent text-muted-foreground px-1 py-2 text-sm" // Changed text-accent to text-foreground
                        >
                            Vehicles ({vehicles.length}) {/* Show count */}
                        </TabsTrigger>
                        {/* Notes Tab Trigger */}
                        <TabsTrigger
                            value="notes"
                            className="data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-foreground data-[state=active]:bg-transparent text-muted-foreground px-1 py-2 text-sm" // Changed text-accent to text-foreground
                        >
                            Notes ({notes.length}) {/* Show count */}
                        </TabsTrigger>
                    </TabsList>

                    {/* Loading state for details */}
                    {loadingDetails ? (
                        <Skeleton className="h-64 w-full bg-gray-800/95 border border-border mt-4" />
                    ) : (
                        <>
                            {/* Info Tab */}
                            <TabsContent value="info" className="bg-black/95 p-4 rounded-b-md border border-t-0 border-border">
                                <Card className="bg-black/95 border-border">
                                    <CardHeader>
                                        <CardTitle className="text-accent">Gang Information</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {!infoEditMode ? (
                                            <>
                                                {photoUrl && (
                                                    <div>
                                                        <Label className="text-foreground/80">Photo</Label>
                                                        <img src={photoUrl} alt="Gang Preview" className="mt-2 max-h-48 rounded border border-border object-contain"/>
                                                    </div>
                                                )}
                                                <div>
                                                    <Label className="text-foreground/80">Gang Name</Label>
                                                    <div className="text-lg text-foreground font-semibold">{gangName}</div>
                                                </div>
                                                <div>
                                                    <Label className="text-foreground/80">Description</Label>
                                                    <div className="text-foreground">{description || <span className="italic text-muted-foreground">No description.</span>}</div>
                                                </div>
                                                <div>
                                                    <Label className="text-foreground/80">Threat Level</Label>
                                                    <div className="text-foreground">{level ?? <span className="italic text-muted-foreground">Not specified</span>}</div>
                                                </div>
                                                {/* Removed general vehicles info from here, moved to Vehicles tab */}
                                                <div className="flex justify-end">
                                                    <Button onClick={enterInfoEditMode} className="bg-accent text-accent-foreground">Edit Info</Button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <Label htmlFor="gangNameEdit" className="text-foreground/80">Gang Name *</Label>
                                                    <Input
                                                        id="gangNameEdit"
                                                        value={infoEditState?.gangName ?? ''}
                                                        onChange={e => setInfoEditState(s => s ? { ...s, gangName: e.target.value } : s)}
                                                        className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                                                        disabled={isSubmitting}
                                                    />
                                                </div>
                                                <div>
                                                    <Label htmlFor="level" className="text-foreground/80">Threat Level (Number)</Label>
                                                    <Input
                                                        id="level"
                                                        type="number"
                                                        value={infoEditState?.level === null || infoEditState?.level === undefined ? '' : String(infoEditState.level)}
                                                        onChange={e => setInfoEditState(s => s ? { ...s, level: e.target.value === '' ? null : parseInt(e.target.value, 10) } : s)}
                                                        placeholder="e.g., 1, 2, 3"
                                                        className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                                                        disabled={isSubmitting}
                                                        min="0"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <Label htmlFor="description" className="text-foreground/80">Description</Label>
                                                <Input
                                                    id="description"
                                                    value={infoEditState?.description ?? ''}
                                                    onChange={e => setInfoEditState(s => s ? { ...s, description: e.target.value } : s)}
                                                    placeholder="Short description (e.g., MC in Paleto)"
                                                    className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                                                    disabled={isSubmitting}
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="photoUrl" className="text-foreground/80">Photo URL</Label>
                                                <Input
                                                    id="photoUrl"
                                                    value={infoEditState?.photoUrl ?? ''}
                                                    onChange={e => setInfoEditState(s => s ? { ...s, photoUrl: e.target.value } : s)}
                                                    placeholder="Link to gang symbol/photo (Optional)"
                                                    className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                                                    disabled={isSubmitting}
                                                />
                                                {infoEditState?.photoUrl && <img src={infoEditState.photoUrl} alt="Gang Preview" className="mt-2 max-h-48 rounded border border-border object-contain"/>}
                                            </div>
                                            {/* Removed general vehicles info edit from here */}
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" onClick={cancelInfoEditMode} disabled={isSubmitting}>Cancel</Button>
                                                <Button onClick={saveInfoEdit} disabled={isSubmitting || !infoEditState?.gangName?.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">Save Info</Button>
                                            </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Roster Tab */}
                            <TabsContent value="roster" className="space-y-4 bg-black/95 p-4 rounded-b-md border border-t-0 border-border">
                                {/* Render the GangRoster component */}
                                <GangRoster gangId={selectedGangId} />
                            </TabsContent>

                            {/* Clothing Tab */}
                            <TabsContent value="clothing" className="bg-black/95 p-4 rounded-b-md border border-t-0 border-border">
                                <Card className="bg-black/95 border-border">
                                    <CardHeader><CardTitle className="text-accent">Clothing / Colors</CardTitle></CardHeader>
                                    <CardContent className="space-y-3">
                                        {!clothingEditMode ? (
                                            <>
                                                <div className="whitespace-pre-wrap text-foreground min-h-[50px]">{clothingInfo || <span className="italic text-muted-foreground">No clothing information available.</span>}</div>
                                                <div className="flex justify-end">
                                                    <Button onClick={enterClothingEditMode} className="bg-accent text-accent-foreground">Edit Clothing</Button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <Textarea
                                                    value={clothingEditState}
                                                    onChange={e => setClothingEditState(e.target.value)}
                                                    placeholder="Describe gang colors, attire, identifiers..."
                                                    rows={6}
                                                    className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                                                    disabled={isSubmitting}
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" onClick={cancelClothingEditMode} disabled={isSubmitting}>Cancel</Button>
                                                    <Button onClick={saveClothingEdit} disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">Save Clothing</Button>
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Location Tab */}
                            <TabsContent value="location" className="bg-black/95 p-4 rounded-b-md border border-t-0 border-border">
                                <Card className="bg-black/95 border-border">
                                    <CardHeader><CardTitle className="text-accent">Known Locations / Territory</CardTitle></CardHeader>
                                    <CardContent className="space-y-3">
                                        {!locationEditMode ? (
                                            <>
                                                <div className="whitespace-pre-wrap text-foreground min-h-[50px]">{locationInfo || <span className="italic text-muted-foreground">No location information available.</span>}</div>
                                                <div className="flex justify-end">
                                                    <Button onClick={enterLocationEditMode} className="bg-accent text-accent-foreground">Edit Location</Button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <Textarea
                                                    value={locationEditState}
                                                    onChange={e => setLocationEditState(e.target.value)}
                                                    placeholder="Describe known hangouts, territory boundaries, points of interest..."
                                                    rows={6}
                                                    className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                                                    disabled={isSubmitting}
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" onClick={cancelLocationEditMode} disabled={isSubmitting}>Cancel</Button>
                                                    <Button onClick={saveLocationEdit} disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">Save Location</Button>
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Vehicles Tab */}
                            <TabsContent value="vehicles" className="space-y-4 bg-black/95 p-4 rounded-b-md border border-t-0 border-border">
                                {/* General Vehicles Info Section */}
                                <Card className="bg-black/95 border-border">
                                    <CardHeader><CardTitle className="text-accent">Known Vehicles (General Info)</CardTitle></CardHeader>
                                    <CardContent className="space-y-3">
                                        {!generalVehiclesInfoEditMode ? (
                                            <>
                                                <div className="whitespace-pre-wrap text-foreground min-h-[50px]">{vehiclesInfo || <span className="italic text-muted-foreground">No general vehicle information available.</span>}</div>
                                                <div className="flex justify-end">
                                                    <Button onClick={enterGeneralVehiclesInfoEditMode} className="bg-accent text-accent-foreground">Edit General Info</Button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <Textarea
                                                    value={generalVehiclesInfoEditState}
                                                    onChange={e => setGeneralVehiclesInfoEditState(e.target.value)}
                                                    placeholder="General description of common vehicles used (Optional)"
                                                    rows={3}
                                                    className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                                                    disabled={isSubmitting}
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" onClick={cancelGeneralVehiclesInfoEditMode} disabled={isSubmitting}>Cancel</Button>
                                                    <Button onClick={saveGeneralVehiclesInfoEdit} disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">Save General Info</Button>
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                                {/* Specific Vehicles Section */}
                                <Card className="bg-black/95 border-border">
                                    <CardHeader>
                                        <CardTitle className="text-accent">Specific Vehicles ({vehicles.length})</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {/* Add Vehicle Form */}
                                        <div className="p-2 border border-border rounded bg-muted/30 space-y-2">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                <Input value={newVehiclePlate} onChange={e => setNewVehiclePlate(e.target.value)} placeholder="Plate *" className="bg-input border-border text-foreground placeholder:text-muted-foreground" disabled={isSubmitting}/>
                                                <Input value={newVehicleModel} onChange={e => setNewVehicleModel(e.target.value)} placeholder="Model (Optional)" className="bg-input border-border text-foreground placeholder:text-muted-foreground" disabled={isSubmitting}/>
                                                <Input value={newVehicleMember} onChange={e => setNewVehicleMember(e.target.value)} placeholder="Member Seen (Optional)" className="bg-input border-border text-foreground placeholder:text-muted-foreground" disabled={isSubmitting}/>
                                            </div>
                                            <div className="flex gap-2 items-end">
                                                <Textarea value={newVehicleActivity} onChange={e => setNewVehicleActivity(e.target.value)} placeholder="Activity / Crime Notes *" rows={2} className="bg-input border-border text-foreground placeholder:text-muted-foreground flex-grow" disabled={isSubmitting}/>
                                                <Button size="sm" onClick={handleAddVehicle} disabled={isSubmitting || !newVehiclePlate.trim() || !newVehicleActivity.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground"><FaPlus /></Button>
                                            </div>
                                        </div>
                                        {/* Vehicle List */}
                                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                                            {vehicles.length > 0 ? vehicles.map(vehicle => (
                                                <div key={vehicle.id} className="p-2 border border-border rounded bg-muted/50 text-sm group relative">
                                                    <div className="flex justify-between items-start">
                                                        <p><strong className="text-foreground">{vehicle.plate}</strong> {vehicle.model ? `(${vehicle.model})` : ''}</p>
                                                        <Button variant="ghost" size="icon" className="text-destructive h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => requestDeleteVehicle(vehicle.id, vehicle.plate)} disabled={isSubmitting}><FaTrash className="h-3 w-3" /></Button>
                                                    </div>
                                                    {vehicle.memberName && <p className="text-xs text-muted-foreground">Member: {vehicle.memberName}</p>}
                                                    <p className="mt-1 whitespace-pre-wrap text-foreground/90">{vehicle.activityNotes}</p>
                                                    <p className="text-xs text-muted-foreground text-right mt-1">
                                                        {vehicle.timestamp?.toDate().toLocaleString()} {vehicle.addedByName && `(Added by: ${vehicle.addedByName})`}
                                                    </p>
                                                </div>
                                            )) : <p className="italic text-muted-foreground text-sm">No specific vehicles recorded.</p>}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Notes Tab */}
                            <TabsContent value="notes" className="space-y-4 bg-black/95 p-4 rounded-b-md border border-t-0 border-border">
                                {/* Main Notes Field Section */}
                                <Card className="bg-black/95 border-border">
                                    <CardHeader><CardTitle className="text-accent">Main Gang Notes</CardTitle></CardHeader>
                                    <CardContent className="space-y-3">
                                        {!mainNotesEditMode ? (
                                            <>
                                                <div className="whitespace-pre-wrap text-foreground min-h-[50px]">{generalNotes || <span className="italic text-muted-foreground">No main notes recorded.</span>}</div>
                                                <div className="flex justify-end">
                                                    <Button onClick={enterMainNotesEditMode} className="bg-accent text-accent-foreground mt-2">Edit Main Notes</Button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <Textarea
                                                    id="gangGeneralNotes"
                                                    value={mainNotesEditState}
                                                    onChange={e => setMainNotesEditState(e.target.value)}
                                                    placeholder="Overall notes about the gang..."
                                                    rows={4}
                                                    className="bg-input border-border text-foreground placeholder:text-muted-foreground mt-1"
                                                    disabled={isSubmitting}
                                                />
                                                <div className="flex justify-end gap-2 mt-2">
                                                    <Button variant="outline" onClick={cancelMainNotesEditMode} disabled={isSubmitting}>Cancel</Button>
                                                    <Button onClick={saveMainNotesEdit} disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">Save Main Notes</Button>
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                                {/* Individual Notes Section */}
                                <Card className="bg-black/95 border-border">
                                    <CardHeader>
                                        <CardTitle className="text-accent">Individual Notes / Updates ({notes.length})</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {/* Add Note Form */}
                                        <div className="flex gap-2 items-end p-2 border border-border rounded bg-muted/30">
                                            <Textarea value={newNoteText} onChange={e => setNewNoteText(e.target.value)} placeholder="Add an individual note or update..." rows={2} className="bg-input border-border text-foreground placeholder:text-muted-foreground flex-grow" disabled={isSubmitting}/>
                                            <Button size="sm" onClick={handleAddNote} disabled={isSubmitting || !newNoteText.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground"><FaPlus /></Button>
                                        </div>
                                        {/* Note List */}
                                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                                            {notes.length > 0 ? notes.map(note => (
                                                <div key={note.id} className="p-2 border border-border rounded bg-muted/50 text-sm group relative">
                                                    <p className="whitespace-pre-wrap text-foreground/90">{note.note}</p>
                                                    <p className="text-xs text-muted-foreground text-right mt-1">- {note.author} on {note.timestamp?.toDate().toLocaleString()}</p>
                                                    <Button variant="ghost" size="icon" className="absolute top-1 right-1 text-destructive h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => requestDeleteNote(note.id)} disabled={isSubmitting}><FaTrash className="h-3 w-3" /></Button>
                                                </div>
                                            )) : <p className="italic text-muted-foreground text-sm">No individual notes recorded.</p>}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </>
                    )}
                </Tabs>
            )}

            {/* Confirmation Modal */}
            {confirmationModal?.show && (
                <ConfirmationModal
                    isOpen={confirmationModal.show}
                    title="Confirm Action"
                    message={confirmationModal.message}
                    onConfirm={confirmationModal.onConfirm}
                    onCancel={() => setConfirmationModal(null)}
                    onClose={() => setConfirmationModal(null)} // Ensure onClose is handled
                    confirmText="Confirm"
                    cancelText="Cancel"
                />
            )}
        </div>
    );
};

export default GangManagementTab;
