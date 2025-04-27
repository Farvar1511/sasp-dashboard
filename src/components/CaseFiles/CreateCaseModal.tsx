import React, { useState } from 'react'; // Ensure React is imported
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { CaseFile, CaseStatus } from '../../utils/ciuUtils';
import { User } from '../../types/User';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { toast } from 'react-toastify';
// Ensure react-icons are imported
import { FaTimes, FaPlus, FaTrash } from 'react-icons/fa';

// If you are seeing TS2786 errors ("Type 'ReactNode' is not a valid JSX element"),
// it's likely due to a mismatch between @types/react and your React version.
// Consider updating @types/react (e.g., `npm install --save-dev @types/react@latest` or `yarn add --dev @types/react@latest`)
// or ensuring your `tsconfig.json` is configured correctly for your React version.

interface CreateCaseModalProps {
    // isOpen prop might not be needed if parent controls rendering directly
    onClose: () => void;
    onSuccess: () => void; // Callback after successful creation
    eligibleAssignees: User[]; // Users who can be assigned
}

// Simple structure for evidence/names for now
interface EvidenceItem { id: number; description: string; location: string; }
interface NameOfInterest { id: number; name: string; role: string; affiliation: string; }

const CreateCaseModal: React.FC<CreateCaseModalProps> = ({ onClose, onSuccess, eligibleAssignees }) => {
    const { user: currentUser } = useAuth();

    // --- State Variables ---
    const [title, setTitle] = useState<string>('');
    const [incidentReport, setIncidentReport] = useState<string>('');
    const [location, setLocation] = useState<string>('');
    const [summary, setSummary] = useState<string>('');
    const [namesOfInterest, setNamesOfInterest] = useState<NameOfInterest[]>([{ id: Date.now(), name: '', role: '', affiliation: '' }]);
    const [evidence, setEvidence] = useState<EvidenceItem[]>([{ id: Date.now(), description: '', location: '' }]);
    const [photos, setPhotos] = useState<string[]>(['']); // Correct state declaration
    const [gangInfo, setGangInfo] = useState<string>('');
    const [status, setStatus] = useState<CaseStatus>('Open - Unassigned');
    const [assignedToId, setAssignedToId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // --- Dynamic List Handlers ---
    const addEvidenceRow = () => setEvidence([...evidence, { id: Date.now(), description: '', location: '' }]);
    const updateEvidence = (index: number, field: keyof EvidenceItem, value: string) => {
        const updated = [...evidence];
        updated[index] = { ...updated[index], [field]: value };
        setEvidence(updated);
    };
    const removeEvidenceRow = (index: number) => setEvidence(evidence.filter((_, i) => i !== index));

    const addPhotoLink = () => setPhotos([...photos, '']);
    // Correct updatePhotoLink function
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

    // --- Status/Assignment Handlers ---
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
        if (value === 'Open - Assigned' && !assignedToId) {
            setStatus('Open - Unassigned');
            toast.info("Select an assignee to set status to 'Open - Assigned'.");
        }
    };
    // --- End Status/Assignment Handlers ---

    // --- Handle Submit ---
    const handleSubmit = async () => {
        if (!currentUser) {
            toast.error("Authentication error. Cannot create case.");
            return;
        }
        if (!title.trim()) {
            toast.error("Case Title is required.");
            return;
        }
        setIsSubmitting(true);

        const assignedUser = eligibleAssignees.find(u => u.id === assignedToId);

        // Prepare details object
        const detailsObject = {
            incidentReport,
            evidence: evidence.filter(e => e.description.trim() || e.location.trim()),
            photos: photos.filter(p => p.trim()), // Filter empty links
            location,
            namesOfInterest: namesOfInterest.filter(n => n.name.trim() || n.role.trim() || n.affiliation.trim()),
            gangInfo,
            updates: [], // Initialize updates array for new cases
        };

        const newCaseData: Omit<CaseFile, 'id'> = {
            title: title.trim(),
            description: summary.trim(),
            status,
            assignedToId: assignedToId,
            assignedToName: assignedUser?.name || null,
            createdBy: currentUser.id || 'Unknown', // Ensure currentUser.id is used if available
            createdByName: currentUser.name || 'Unknown', // Ensure currentUser.name is used if available
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp, // Renamed from lastUpdatedAt
            imageLinks: detailsObject.photos, // Use filtered photos
            details: JSON.stringify(detailsObject),
        };

        try {
            await addDoc(collection(dbFirestore, 'caseFiles'), newCaseData);
            toast.success(`Case "${title.trim()}" created successfully.`);
            onSuccess(); // Trigger refresh/callback in parent
            onClose(); // Close modal
        } catch (error) {
            console.error("Error creating case file:", error);
            toast.error("Failed to create case file.");
        } finally {
            setIsSubmitting(false);
        }
    };
    // --- End Handle Submit ---

    // --- Warrant Template Generation ---
    const generateWarrantText = () => {
        const primarySuspect = namesOfInterest.find(n => n.role?.toLowerCase().includes('suspect'))?.name || '[Suspect Name]';
        const evidenceSummary = evidence.map((e, i) => `Exhibit ${String.fromCharCode(65 + i)}: ${e.description}`).join('\n');
        const witnessSummary = namesOfInterest.filter(n => n.role?.toLowerCase().includes('witness')).map((w, i) => `Witness ${String.fromCharCode(65 + i)}: ${w.name}`).join('\n');
        // Basic template
        let template = `

WARRANT TEMPLATE FOR ${primarySuspect}

Case Title: ${title || '[Case Title]'}
Incident Report #: ${incidentReport || '[Incident Report #]'}
Location: ${location || '[Location]'}

Summary:
${summary || '[Summary of Incident]'}

Names of Interest:
${namesOfInterest.map(n => `- ${n.name} (${n.role || 'N/A'})${n.affiliation ? ` [Affiliation: ${n.affiliation}]` : ''}`).join('\n')}

Evidence:
${evidenceSummary || 'No specific evidence listed.'}

Witnesses:
${witnessSummary || 'No specific witnesses listed.'}

Gang Information:
${gangInfo || 'No specific gang information provided.'}
        `;
         return template.trim();
     };
    // --- End Warrant Template Generation ---

    return (
        // Use black background with opacity
        <div className="w-[85vw] max-w-none mx-auto p-6 md:p-8 bg-black/95 text-foreground rounded-lg shadow-2xl transition-all duration-300 ease-in-out border-[#f3c700] border-2 flex flex-col max-h-[90vh] relative">
            {/* Close button */}
            <Button variant="ghost" size="icon" className="absolute top-3 right-3 text-muted-foreground hover:text-foreground z-10" onClick={onClose}>
                <FaTimes className="h-5 w-5" /> {/* Usage seems correct */}
                <span className="sr-only">Close</span>
            </Button>

            {/* Header: Use accent border */}
            <div className="pb-4 mb-4 border-b-2 border-[#f3c700]">
                <h2 className="text-xl md:text-2xl font-semibold">Create New Case File</h2>
            </div>

            <Tabs defaultValue="details" className="w-full flex-grow flex flex-col overflow-hidden">
                {/* Tabs List: Style active trigger with accent */}
                <TabsList className="mb-4 shrink-0 bg-transparent p-0 border-b border-border">
                    <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-accent data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Case Details</TabsTrigger>
                    <TabsTrigger value="warrant" className="data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-accent data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Warrant Template</TabsTrigger>
                </TabsList>

                {/* Case Details Tab: Adjust padding/spacing */}
                <TabsContent value="details" className="flex-grow space-y-5 overflow-y-auto pr-2 pl-1 pb-2">
                    {/* Basic Info Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-accent">Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Inputs use bg-input, border-border */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="caseTitle">Case Title *</Label>
                                    <Input id="caseTitle" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Bank Robbery at Fleeca" className="bg-input border-border" disabled={isSubmitting}/>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="incidentReport">Incident Report (Link or #)</Label>
                                    <Input id="incidentReport" value={incidentReport} onChange={(e) => setIncidentReport(e.target.value)} placeholder="e.g., #12345 or URL" className="bg-input border-border" disabled={isSubmitting}/>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="location">Location of Incident</Label>
                                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Pacific Standard Bank, Vinewood Blvd" className="bg-input border-border" disabled={isSubmitting}/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="summary">Summary</Label>
                                <Textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Briefly summarize the investigation..." rows={4} className="bg-input border-border" disabled={isSubmitting}/>
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
                                        <Input value={item.name} onChange={(e) => updateName(index, 'name', e.target.value)} placeholder="Name" className="bg-input border-border" disabled={isSubmitting}/>
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        {index === 0 && <Label className="text-xs text-muted-foreground">Role (Suspect, Witness...)</Label>}
                                        <Input value={item.role} onChange={(e) => updateName(index, 'role', e.target.value)} placeholder="Role" className="bg-input border-border" disabled={isSubmitting}/>
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        {index === 0 && <Label className="text-xs text-muted-foreground">Gang Affiliation</Label>}
                                        <Input value={item.affiliation} onChange={(e) => updateName(index, 'affiliation', e.target.value)} placeholder="Affiliation" className="bg-input border-border" disabled={isSubmitting}/>
                                    </div>
                                    <div className="flex items-end h-full">
                                        {namesOfInterest.length > 1 && (
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeNameRow(index)} className="text-destructive hover:text-destructive/80 h-9 w-9" disabled={isSubmitting}>
                                                <FaTrash className="h-4 w-4" /> {/* Usage seems correct */}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addNameRow} className="mt-2 border-accent text-accent hover:bg-accent/10" disabled={isSubmitting}>
                                <FaPlus className="mr-2 h-3 w-3" /> {/* Usage seems correct */}
                                Add Name
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
                                    <Input value={item.description} onChange={(e) => updateEvidence(index, 'description', e.target.value)} placeholder="Description" className="flex-grow bg-input border-border" disabled={isSubmitting}/>
                                    <Input value={item.location} onChange={(e) => updateEvidence(index, 'location', e.target.value)} placeholder="Location Collected" className="flex-grow bg-input border-border" disabled={isSubmitting}/>
                                    {evidence.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEvidenceRow(index)} className="text-destructive hover:text-destructive/80 h-9 w-9" disabled={isSubmitting}>
                                            <FaTrash className="h-4 w-4" /> {/* Usage seems correct */}
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addEvidenceRow} className="mt-2 border-accent text-accent hover:bg-accent/10" disabled={isSubmitting}>
                                <FaPlus className="mr-2 h-3 w-3" /> {/* Usage seems correct */}
                                Add Evidence
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
                                    <Input value={link} onChange={(e) => updatePhotoLink(index, e.target.value)} placeholder="https://example.com/image.png" className="flex-grow bg-input border-border" disabled={isSubmitting}/>
                                    {photos.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removePhotoLink(index)} className="text-destructive hover:text-destructive/80 h-9 w-9" disabled={isSubmitting}>
                                            <FaTrash className="h-4 w-4" /> {/* Usage seems correct */}
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addPhotoLink} className="mt-2 border-accent text-accent hover:bg-accent/10" disabled={isSubmitting}>
                                <FaPlus className="mr-2 h-3 w-3" /> {/* Usage seems correct */}
                                Add Photo Link
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Gang Info Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                         <CardHeader>
                            <CardTitle className="text-lg text-accent">Gang Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea id="gangInfo" value={gangInfo} onChange={(e) => setGangInfo(e.target.value)} placeholder="Details about gang involvement, if any..." rows={4} className="bg-input border-border" disabled={isSubmitting}/>
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
                                <Select value={status} onValueChange={(value: CaseStatus) => handleStatusChange(value)} disabled={isSubmitting}>
                                    <SelectTrigger className="bg-input border-border">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    {/* Ensure SelectContent uses black background */}
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
                                <Select value={assignedToId || "unassigned"} onValueChange={handleAssigneeChange} disabled={isSubmitting}>
                                    <SelectTrigger className="bg-input border-border">
                                        <SelectValue placeholder="Select detective" />
                                    </SelectTrigger>
                                    {/* Ensure SelectContent uses black background */}
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

                {/* Warrant Template Tab */}
                <TabsContent value="warrant" className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2 pl-1 pb-2">
                     <Label>Warrant Template (Auto-Generated Preview)</Label>
                     <Textarea
                        readOnly
                        value={generateWarrantText()}
                        className="font-mono text-xs bg-muted border-border flex-grow min-h-[300px]" // Use flex-grow
                     />
                     {/* Style Copy button with accent */}
                     <Button type="button" size="sm" onClick={() => navigator.clipboard.writeText(generateWarrantText()).then(() => toast.info("Warrant text copied!"))} className="shrink-0 bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting}>
                        Copy Warrant Text
                     </Button>
                </TabsContent>
            </Tabs>

            {/* Footer: Use accent border */}
            <div className="pt-4 mt-4 border-t-2 border-[#f3c700] shrink-0 flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                {/* Use accent color for create button */}
                <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    {isSubmitting ? 'Creating...' : 'Create Case'}
                </Button>
            </div>
        </div>
    );
};

export default CreateCaseModal;

