import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { CaseFile, CaseStatus } from '../../utils/ciuUtils';
import { User } from '../../types/User';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { toast } from 'react-toastify';
import { FaTrash, FaPlus, FaTimes, FaSave } from 'react-icons/fa';
import { formatTimestampForDisplay } from '../../utils/timeHelpers'; // Assuming this helper exists and handles Timestamp

// Define structure for dynamic lists if not already imported/defined
interface EvidenceItem { id: number; description: string; location: string; }
interface NameOfInterest { id: number; name: string; role: string; affiliation: string; }
interface CaseUpdate { timestamp: Timestamp; userId: string; userName: string; note: string; } // Structure for notes/updates

interface EditCaseModalProps {
  onClose: () => void;
  onSaveSuccess: () => void; // Callback after successful save
  caseData: CaseFile; // Use the specific CaseFile type
  eligibleAssignees: User[]; // Users who can be assigned
}

// Rename component
const EditCaseModal: React.FC<EditCaseModalProps> = ({ onClose, onSaveSuccess, caseData, eligibleAssignees }) => {
    const { user: currentUser } = useAuth();

    // --- State for Editable Fields ---
    const [title, setTitle] = useState(caseData.title);
    const [incidentReport, setIncidentReport] = useState('');
    const [summary, setSummary] = useState(caseData.description || ''); // Use description field
    const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
    const [photos, setPhotos] = useState<string[]>(caseData.imageLinks || ['']);
    const [location, setLocation] = useState('');
    const [namesOfInterest, setNamesOfInterest] = useState<NameOfInterest[]>([]);
    const [gangInfo, setGangInfo] = useState('');
    const [status, setStatus] = useState<CaseStatus>(caseData.status);
    const [assignedToId, setAssignedToId] = useState<string | null>(caseData.assignedToId ?? null); // Ensure null if undefined
    const [updates, setUpdates] = useState<CaseUpdate[]>([]); // State for existing updates
    const [newNote, setNewNote] = useState(''); // State for adding a new note
    const [isSaving, setIsSaving] = useState(false);

    // --- Initialize State from caseData.details ---
    useEffect(() => {
        if (caseData.details) {
            try {
                const details = JSON.parse(caseData.details);
                setIncidentReport(details.incidentReport || '');
                // Ensure default empty item if array is empty/missing
                setEvidence(details.evidence?.length ? details.evidence : [{ id: Date.now(), description: '', location: '' }]);
                setNamesOfInterest(details.namesOfInterest?.length ? details.namesOfInterest : [{ id: Date.now(), name: '', role: '', affiliation: '' }]);
                setLocation(details.location || '');
                setGangInfo(details.gangInfo || '');
                setUpdates(details.updates || []); // Load existing updates/notes
            } catch (e) {
                console.error("Failed to parse case details JSON:", e);
                toast.error("Error loading case details.");
                // Initialize with defaults if parsing fails
                setEvidence([{ id: Date.now(), description: '', location: '' }]);
                setNamesOfInterest([{ id: Date.now(), name: '', role: '', affiliation: '' }]);
            }
        } else {
             // Initialize with defaults if details are missing
             setEvidence([{ id: Date.now(), description: '', location: '' }]);
             setNamesOfInterest([{ id: Date.now(), name: '', role: '', affiliation: '' }]);
        }
        // Ensure photos has at least one empty string if empty
        // Use caseData.imageLinks directly for initialization
        setPhotos(caseData.imageLinks?.length ? caseData.imageLinks : ['']);
        // Ensure assignedToId state is correctly initialized or updated if caseData changes
        setAssignedToId(caseData.assignedToId ?? null);
    }, [caseData]); // Rerun if caseData changes

    // --- Dynamic List Handlers (Implementations) ---
    const addEvidenceRow = () => setEvidence([...evidence, { id: Date.now(), description: '', location: '' }]);
    const updateEvidence = (index: number, field: keyof EvidenceItem, value: string) => {
        const updated = [...evidence];
        updated[index] = { ...updated[index], [field]: value };
        setEvidence(updated);
    };
    const removeEvidenceRow = (index: number) => setEvidence(evidence.filter((_, i) => i !== index));

    const addPhotoLink = () => setPhotos([...photos, '']);
    const updatePhotoLink = (index: number, value: string) => {
        const updated = [...photos];
        updated[index] = value;
        setPhotos(updated);
    };
    const removePhotoLink = (index: number) => setPhotos(photos.filter((_, i) => i !== index));

    const addNameRow = () => setNamesOfInterest([...namesOfInterest, { id: Date.now(), name: '', role: '', affiliation: '' }]);
    const updateName = (index: number, field: keyof NameOfInterest, value: string) => {
        const updated = [...namesOfInterest];
        updated[index] = { ...updated[index], [field]: value };
        setNamesOfInterest(updated);
    };
    const removeNameRow = (index: number) => setNamesOfInterest(namesOfInterest.filter((_, i) => i !== index));
    // --- End Dynamic List Handlers ---

    // --- Status/Assignment Handlers (Implementations) ---
    const handleAssigneeChange = (value: string) => {
        const newAssigneeId = value === "unassigned" ? null : value;
        setAssignedToId(newAssigneeId);
        // Automatically update status if assigning/unassigning
        if (newAssigneeId && status === 'Open - Unassigned') {
            setStatus('Open - Assigned');
        } else if (!newAssigneeId && status === 'Open - Assigned') {
            setStatus('Open - Unassigned');
        }
    };

    const handleStatusChange = (value: CaseStatus) => {
        setStatus(value);
        // If changing status away from assigned, unassign
        if (value === 'Open - Unassigned' && assignedToId) {
            setAssignedToId(null);
        }
        // If changing status to assigned but no one is selected, revert to unassigned
        // (or keep assigned and prompt user - current logic reverts)
        if (value === 'Open - Assigned' && !assignedToId) {
            setStatus('Open - Unassigned');
            toast.info("Select an assignee to set status to 'Open - Assigned'.");
        }
        // Add logic for other statuses if needed (e.g., closing)
    };
    // --- End Status/Assignment Handlers ---

    // --- Handle Saving Changes ---
    const handleSave = async () => {
        if (!currentUser || !caseData.id) {
            toast.error("Cannot save changes. User or Case ID missing.");
            return;
        }
        if (!title) {
            toast.error("Case Title is required.");
            return;
        }
        setIsSaving(true);

        const assignedUser = eligibleAssignees.find(u => u.id === assignedToId);

        // Prepare updated details object (start with existing updates)
        const updatedDetailsObject = {
            incidentReport,
            // Filter out empty items before saving
            evidence: evidence.filter(e => e.description.trim() || e.location.trim()),
            // Filter out empty photo links
            photos: photos.filter(p => p.trim()),
            location,
            // Filter out empty names
            namesOfInterest: namesOfInterest.filter(n => n.name.trim() || n.role.trim() || n.affiliation.trim()),
            gangInfo,
            updates: [...updates] // Start with a copy of existing updates
        };

        // Add new note if provided
        let newUpdateEntryForFirestore: CaseUpdate | null = null;
        if (newNote.trim()) {
             newUpdateEntryForFirestore = {
                // Use serverTimestamp for Firestore
                timestamp: serverTimestamp() as Timestamp,
                userId: currentUser?.id || 'Unknown',
                userName: currentUser?.name || 'Unknown',
                note: newNote.trim(),
            };
            // Add the new note (with serverTimestamp) to the details object that will be saved
            updatedDetailsObject.updates.push(newUpdateEntryForFirestore);

            // --- Add temporary note for immediate UI update ---
            const temporaryUpdateEntryForUI: CaseUpdate = {
                ...newUpdateEntryForFirestore,
                // Use client-side date for immediate display, cast needed
                timestamp: new Date() as any,
            };
            setUpdates(prev => [...prev, temporaryUpdateEntryForUI]); // Update local state for UI
            setNewNote(''); // Clear the input field
            // --- End temporary UI update ---
        }

        // Prepare data for Firestore update, including the potentially updated updates array
        const updateData: Partial<CaseFile> & { details: string; lastUpdatedAt: Timestamp } = {
            title,
            description: summary,
            status,
            assignedToId: assignedToId,
            assignedToName: assignedUser?.name || null,
            // Use the filtered photos from updatedDetailsObject
            imageLinks: updatedDetailsObject.photos,
            // Stringify the details object including the new note (with serverTimestamp)
            details: JSON.stringify(updatedDetailsObject),
            lastUpdatedAt: serverTimestamp() as Timestamp,
        };


        try {
            const caseRef = doc(dbFirestore, 'caseFiles', caseData.id);
            // Single updateDoc call with the complete data
            await updateDoc(caseRef, updateData);

            toast.success(`Case "${title}" updated successfully.`);
            onSaveSuccess(); // Trigger refresh/callback in parent
            onClose(); // Close modal
        } catch (error) {
            console.error("Error updating case file:", error);
            // If save fails, consider removing the temporary note from local state
            if (newUpdateEntryForFirestore) {
                // Ensure comparison works correctly, maybe use a unique ID if available
                setUpdates(prev => prev.filter(u => !(u.note === newUpdateEntryForFirestore!.note && u.userId === newUpdateEntryForFirestore!.userId)));
            }
            toast.error("Failed to update case file.");
        } finally {
            setIsSaving(false);
        }
    };


    // --- Warrant Template Generation (Implementation needed if used) ---
    const generateWarrantText = () => {
        const primarySuspect = namesOfInterest.find(n => n.role?.toLowerCase().includes('suspect'))?.name || '[Suspect Name]';
        const evidenceSummary = evidence.map((e, i) => `Exhibit ${String.fromCharCode(65 + i)}: ${e.description}`).join('\n');
        const witnessSummary = namesOfInterest.filter(n => n.role?.toLowerCase().includes('witness')).map((w, i) => `Witness ${String.fromCharCode(65 + i)}: ${w.name}`).join('\n');
        // Basic template - copy from CreateCaseModal or refine
        let template = `

WARRANT TEMPLATE FOR ${primarySuspect}

Evidence:
${evidenceSummary}

Witnesses:
${witnessSummary}
        `;
         return template.trim();
     };

    // --- End Warrant Template Generation ---


    // Apply styling similar to CreateCaseModal
    return (
        // Use black background with opacity
        <div className="w-[85vw] max-w-none mx-auto p-6 md:p-8 bg-black/95 text-foreground rounded-lg shadow-2xl transition-all duration-300 ease-in-out border-[#f3c700] border-2 flex flex-col max-h-[90vh] relative">
            {/* Close button */}
            <Button variant="ghost" size="icon" className="absolute top-3 right-3 text-muted-foreground hover:text-foreground z-10" onClick={onClose}>
                <FaTimes className="h-5 w-5" />
                <span className="sr-only">Close</span>
            </Button>

            {/* Header: Use accent border */}
            <div className="pb-4 mb-4 border-b-2 border-[#f3c700]">
                <h2 className="text-xl md:text-2xl font-semibold">Edit Case File: {caseData.title}</h2>
            </div>

            <Tabs defaultValue="details" className="w-full flex-grow flex flex-col overflow-hidden">
                {/* Tabs List: Style active trigger with accent */}
                <TabsList className="mb-4 shrink-0 bg-transparent p-0 border-b border-border">
                    <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-[#f3c700] data-[state=active]:text-[#f3c700] data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Details</TabsTrigger>
                    <TabsTrigger value="updates" className="data-[state=active]:border-b-2 data-[state=active]:border-[#f3c700] data-[state=active]:text-[#f3c700] data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Updates</TabsTrigger>
                    <TabsTrigger value="warrant" className="data-[state=active]:border-b-2 data-[state=active]:border-[#f3c700] data-[state=active]:text-[#f3c700] data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Warrant</TabsTrigger>
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details" className="flex-grow space-y-5 overflow-y-auto pr-2 pl-1 pb-2">
                    {/* Basic Info Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-accent">Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Inputs should use bg-input, border-border from theme */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="caseTitle">Case Title *</Label>
                                    <Input id="caseTitle" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Bank Robbery at Fleeca" className="bg-input border-border" disabled={isSaving} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="incidentReport">Incident Report (Link or #)</Label>
                                    <Input id="incidentReport" value={incidentReport} onChange={(e) => setIncidentReport(e.target.value)} placeholder="e.g., #12345 or URL" className="bg-input border-border" disabled={isSaving} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="location">Location of Incident</Label>
                                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Pacific Standard Bank, Vinewood Blvd" className="bg-input border-border" disabled={isSaving} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="summary">Summary</Label>
                                <Textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Briefly summarize the investigation..." rows={4} className="bg-input border-border" disabled={isSaving} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Names of Interest Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-accent">Names of Interest</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {namesOfInterest.map((item, index) => (
                                <div key={item.id} className="grid grid-cols-1 md:grid-cols-7 gap-2 items-center">
                                    <div className="md:col-span-2 space-y-1">
                                        {index === 0 && <Label className="text-xs text-muted-foreground">Name</Label>}
                                        <Input value={item.name} onChange={(e) => updateName(index, 'name', e.target.value)} placeholder="Name" className="bg-input border-border" disabled={isSaving} />
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        {index === 0 && <Label className="text-xs text-muted-foreground">Role (Suspect, Witness...)</Label>}
                                        <Input value={item.role} onChange={(e) => updateName(index, 'role', e.target.value)} placeholder="Role" className="bg-input border-border" disabled={isSaving} />
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        {index === 0 && <Label className="text-xs text-muted-foreground">Gang Affiliation</Label>}
                                        <Input value={item.affiliation} onChange={(e) => updateName(index, 'affiliation', e.target.value)} placeholder="Affiliation" className="bg-input border-border" disabled={isSaving} />
                                    </div>
                                    <div className="flex items-end h-full">
                                        {namesOfInterest.length > 1 && (
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeNameRow(index)} className="text-destructive hover:text-destructive/80 h-9 w-9" disabled={isSaving}>
                                                <FaTrash className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addNameRow} className="mt-2 border-accent text-accent hover:bg-accent/10" disabled={isSaving}>
                                <FaPlus className="mr-2 h-3 w-3" /> Add Name
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Evidence Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-accent">Evidence</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {evidence.map((item, index) => (
                                <div key={item.id} className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                                    <Input value={item.description} onChange={(e) => updateEvidence(index, 'description', e.target.value)} placeholder="Description" className="flex-grow bg-input border-border" disabled={isSaving} />
                                    <Input value={item.location} onChange={(e) => updateEvidence(index, 'location', e.target.value)} placeholder="Location Collected" className="flex-grow bg-input border-border" disabled={isSaving} />
                                    {evidence.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEvidenceRow(index)} className="text-destructive hover:text-destructive/80 h-9 w-9" disabled={isSaving}>
                                            <FaTrash className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addEvidenceRow} className="mt-2 border-accent text-accent hover:bg-accent/10" disabled={isSaving}>
                                <FaPlus className="mr-2 h-3 w-3" /> Add Evidence
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Photos Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-accent">Photos (Links)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {photos.map((link, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input value={link} onChange={(e) => updatePhotoLink(index, e.target.value)} placeholder="https://example.com/image.png" className="flex-grow bg-input border-border" disabled={isSaving} />
                                    {photos.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removePhotoLink(index)} className="text-destructive hover:text-destructive/80 h-9 w-9" disabled={isSaving}>
                                            <FaTrash className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addPhotoLink} className="mt-2 border-accent text-accent hover:bg-accent/10" disabled={isSaving}>
                                <FaPlus className="mr-2 h-3 w-3" /> Add Photo Link
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Gang Info Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                         <CardHeader>
                            <CardTitle className="text-lg text-accent">Gang Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea id="gangInfo" value={gangInfo} onChange={(e) => setGangInfo(e.target.value)} placeholder="Details about gang involvement, if any..." rows={4} className="bg-input border-border" disabled={isSaving} />
                        </CardContent>
                    </Card>

                    {/* Status and Assignment Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-accent">Status & Assignment</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={status} onValueChange={(value: CaseStatus) => handleStatusChange(value)} disabled={isSaving}>
                                    <SelectTrigger className="bg-input border-border">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    {/* Ensure SelectContent uses theme styles */}
                                    <SelectContent className="bg-black/95 text-popover-foreground border-border shadow-md z-50">
                                        <SelectItem value="Open - Unassigned">Open - Unassigned</SelectItem>
                                        <SelectItem value="Open - Assigned">Open - Assigned</SelectItem>
                                        <SelectItem value="Under Review">Under Review</SelectItem>
                                        <SelectItem value="Closed - Solved">Closed - Solved</SelectItem>
                                        <SelectItem value="Closed - Unsolved">Closed - Unsolved</SelectItem>
                                        <SelectItem value="Archived">Archived</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Assign Detective</Label>
                                <Select value={assignedToId || "unassigned"} onValueChange={handleAssigneeChange} disabled={isSaving}>
                                    <SelectTrigger className="bg-input border-border">
                                        <SelectValue placeholder="Select detective" />
                                    </SelectTrigger>
                                    {/* Ensure SelectContent uses theme styles */}
                                    <SelectContent className="bg-black/95 text-popover-foreground border-border shadow-md z-50">
                                        <SelectItem value="unassigned">-- Unassigned --</SelectItem>
                                        {eligibleAssignees.map(user => (
                                            <SelectItem key={user.id} value={user.id || 'unknown'}>
                                                {user.name} ({user.callsign})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Updates Tab */}
                <TabsContent value="updates" className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2 pl-1 pb-2">
                    {/* Existing Updates List */}
                    <div className="space-y-3 flex-grow overflow-y-auto pr-1 custom-scrollbar">
                        {updates.length === 0 && !newNote ? (
                            <p className="text-muted-foreground italic text-sm">No updates recorded yet.</p>
                        ) : (
                            updates.map((update, index) => (
                                <div key={index} className="p-3 border rounded-md bg-black/95 border-border text-sm">
                                    <p className="whitespace-pre-wrap">{update.note}</p>
                                    <p className="text-xs text-muted-foreground text-right mt-1">
                                        {/* Use imported helper function */}
                                        - {update.userName} on {formatTimestampForDisplay(update.timestamp)}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                    {/* Add New Note */}
                    <div className="shrink-0 space-y-2 pt-4 border-t border-border">
                        <Label htmlFor="newNote">Add New Update/Note</Label>
                        <Textarea
                            id="newNote"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Record any updates or notes..."
                            rows={3}
                            className="bg-input border-border"
                            disabled={isSaving}
                        />
                    </div>
                </TabsContent>

                {/* Warrant Template Tab */}
                <TabsContent value="warrant" className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2 pl-1 pb-2">
                     {/* ...existing code... */}
                </TabsContent>
            </Tabs>

            {/* Footer: Use accent border */}
            <div className="pt-4 mt-4 border-t-2 border-[#f3c700] shrink-0 flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
                {/* Use accent color for save button */}
                <Button type="button" onClick={handleSave} disabled={isSaving} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <FaSave className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </div>
    );
};

export default EditCaseModal;
