import React, { useState, useEffect } from 'react';
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
// Import FaSave and FaSync
import { FaTimes, FaPlus, FaTrash, FaSearch, FaSave, FaSync, FaFileWord, FaFilePdf } from 'react-icons/fa';
import penalCodesData from './penal_codes.ts';
// Import formatTimestampForDisplay if needed for updates (though likely not used in create)
// import { formatTimestampForDisplay } from '../../utils/timeHelpers';

interface PenalCode {
    pc: string;
    offense_class: string;
    title: string;
    description: string;
    fine: number;
    prison_time_months: number;
}

interface CreateCaseModalProps {
    onClose: () => void;
    onSuccess: () => void;
    eligibleAssignees: User[];
}

interface EvidenceItem { id: number; description: string; location: string; }
interface NameOfInterest { id: number; name: string; role: string; affiliation: string; cid?: string; phoneNumber?: string; }

const CreateCaseModal: React.FC<CreateCaseModalProps> = ({ onClose, onSuccess, eligibleAssignees }) => {
    const { user: currentUser } = useAuth();

    const [title, setTitle] = useState<string>('');
    const [incidentReport, setIncidentReport] = useState<string>('');
    const [location, setLocation] = useState<string>('');
    const [summary, setSummary] = useState<string>('');
    const [namesOfInterest, setNamesOfInterest] = useState<NameOfInterest[]>([{ id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]);
    const [evidence, setEvidence] = useState<EvidenceItem[]>([{ id: Date.now(), description: '', location: '' }]);
    const [photos, setPhotos] = useState<string[]>(['']);
    const [gangInfo, setGangInfo] = useState<string>('');
    const [videoNotes, setVideoNotes] = useState<string>('');
    const [status, setStatus] = useState<CaseStatus>('Open - Unassigned');
    const [assignedToId, setAssignedToId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const [penalCodes, setPenalCodes] = useState<PenalCode[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [searchResults, setSearchResults] = useState<PenalCode[]>([]);
    const [selectedCharges, setSelectedCharges] = useState<PenalCode[]>([]);

    // Add state for warrant preview text
    const [warrantText, setWarrantText] = useState<string>('');
    // Add state for DOCX generation (might be disabled in create mode)
    const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);


    useEffect(() => {
        setPenalCodes(penalCodesData as PenalCode[]);
    }, []);

    useEffect(() => {
        if (searchTerm.trim() === '') {
            setSearchResults([]);
            return;
        }
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const filtered = penalCodes.filter(code =>
            code.pc.toLowerCase().includes(lowerCaseSearchTerm) ||
            code.title.toLowerCase().includes(lowerCaseSearchTerm) ||
            code.description.toLowerCase().includes(lowerCaseSearchTerm)
        );
        setSearchResults(filtered.slice(0, 10));
    }, [searchTerm, penalCodes]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const addCharge = (charge: PenalCode) => {
        if (!selectedCharges.some(c => c.pc === charge.pc)) {
            setSelectedCharges([...selectedCharges, charge]);
        }
        setSearchTerm('');
        setSearchResults([]);
    };

    const removeCharge = (pcCode: string) => {
        setSelectedCharges(selectedCharges.filter(charge => charge.pc !== pcCode));
    };

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

    const addNameRow = () => setNamesOfInterest([...namesOfInterest, { id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]);
    const updateName = (index: number, field: keyof NameOfInterest, value: string) => {
        const updated = [...namesOfInterest];
        updated[index] = { ...updated[index], [field]: value };
        setNamesOfInterest(updated);
    };
    const removeNameRow = (index: number) => setNamesOfInterest(namesOfInterest.filter((_, i) => i !== index));

    const handleAssigneeChange = (value: string) => {
        const newAssigneeId = value === "unassigned" ? null : value;
        setAssignedToId(newAssigneeId);
        if (newAssigneeId && status === 'Open - Unassigned') {
            setStatus('Open - Assigned');
        } else if (!newAssigneeId && status === 'Open - Assigned') {
            setStatus('Open - Unassigned');
        }
    };

    const handleStatusChange = (value: CaseStatus) => {
        setStatus(value);
        if (value === 'Open - Unassigned' && assignedToId) {
            setAssignedToId(null);
        }
        if (value === 'Open - Assigned' && !assignedToId) {
            setStatus('Open - Unassigned');
            toast.info("Select an assignee to set status to 'Open - Assigned'.");
        }
    };

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

        const detailsObject = {
            incidentReport,
            evidence: evidence.filter(e => e.description.trim() || e.location.trim()),
            photos: photos.filter(p => p.trim()),
            location,
            namesOfInterest: namesOfInterest.filter(n => n.name.trim() || n.role.trim() || n.affiliation.trim() || n.cid?.trim() || n.phoneNumber?.trim()),
            gangInfo,
            videoNotes,
            charges: selectedCharges,
            updates: [],
        };

        const newCaseData: Omit<CaseFile, 'id'> = {
            title: title.trim(),
            description: summary.trim(),
            status,
            assignedToId: assignedToId,
            assignedToName: assignedUser?.name || null,
            createdBy: currentUser.id || 'Unknown',
            createdByName: currentUser.name || 'Unknown',
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
            imageLinks: detailsObject.photos,
            details: JSON.stringify(detailsObject),
        };

        try {
            await addDoc(collection(dbFirestore, 'caseFiles'), newCaseData);
            toast.success(`Case "${title.trim()}" created successfully.`);
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error creating case file:", error);
            toast.error("Failed to create case file.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Update generateWarrantText to match CaseDetailsModal preview logic
    const generateWarrantTextPreview = (): string => {
        const primarySuspect = namesOfInterest.find(n => n.role?.toLowerCase().includes('suspect'))?.name || '[Suspect Name]';
        const otherSuspects = namesOfInterest.filter(n => n.role?.toLowerCase().includes('suspect') && n.name !== primarySuspect).map(n => n.name).join(', ') || 'None';
        const witnesses = namesOfInterest
            .filter(n => n.role?.toLowerCase().includes('witness'))
            .map(w => `${w.name}${w.cid ? ` (CID: ${w.cid})` : ''}${w.phoneNumber ? ` (Phone: ${w.phoneNumber})` : ''}`)
            .join(', ') || 'None';
        const victims = namesOfInterest.filter(n => n.role?.toLowerCase().includes('victim')).map(v => v.name).join(', ') || 'None';
        const evidenceSummary = evidence.filter(e => e.description.trim()).map((e, i) => `  - Exhibit ${String.fromCharCode(65 + i)}: ${e.description} (Collected at: ${e.location || 'N/A'})`).join('\n') || '  - No specific evidence listed.';
        const photoSummary = photos.filter(p => p.trim()).map((p, i) => `  - Photo ${i + 1}: ${p}`).join('\n') || '  - No photo links provided.';
        const chargesSummary = selectedCharges.length > 0
            ? selectedCharges.map(c => `  - ${c.pc}: ${c.title}`).join('\n')
            : '  - No charges listed.';

        const template = `
**ARREST WARRANT APPLICATION PREVIEW**

**Case Title:** ${title || '[Case Title]'}
**Case ID:** [Will be generated on save]
**Incident Report #:** ${incidentReport || 'N/A'}
**Date Prepared:** ${new Date().toLocaleDateString()}
**Prepared By:** ${currentUser?.name || '[Officer Name]'} (${currentUser?.callsign || '[Callsign]'})

**SUBJECT(S):** ${primarySuspect}${otherSuspects !== 'None' ? `, ${otherSuspects}` : ''}
**LOCATION:** ${location || '[Location]'}
**SUMMARY:** ${summary || '[Summary]'}
**VICTIM(S):** ${victims}
**WITNESS(ES):** ${witnesses}
**CHARGES:**
${chargesSummary}
**EVIDENCE:**
${evidenceSummary}
**PHOTOS:**
${photoSummary}
**VIDEO EVIDENCE NOTES:**
${videoNotes || 'N/A'}
**GANG INFO:** ${gangInfo || 'N/A'}

*(This is a simplified preview. The exported DOCX will follow the official template structure.)*
        `;
        return template.trim();
    };

    // Regenerate warrant preview whenever relevant data changes
    useEffect(() => {
        setWarrantText(generateWarrantTextPreview());
    }, [title, incidentReport, location, summary, namesOfInterest, evidence, photos, gangInfo, videoNotes, selectedCharges, currentUser]);

    // Handler to regenerate preview manually
    const handleRegenerateWarrantPreview = () => {
        setWarrantText(generateWarrantTextPreview());
        toast.info("Warrant preview regenerated.");
    };

    // Placeholder for DOCX export (likely disabled/hidden in create mode)
    const exportAsDocx = () => {
        toast.info("DOCX export is available after the case is created.");
    };
    // Placeholder for PDF export (likely disabled/hidden in create mode)
    const exportAsPdf = () => {
        toast.info("PDF export is available after the case is created.");
    };

    // Determine if case is active (always true for create, but keep for consistency)
    const isActive = ['Open - Unassigned', 'Open - Assigned', 'Under Review'].includes(status);


    return (
        // Main container styling remains the same
        <div className="w-[85vw] max-w-none mx-auto p-6 md:p-8 bg-black/95 text-foreground rounded-lg shadow-2xl transition-all duration-300 ease-in-out border-[#f3c700] border-2 flex flex-col max-h-[90vh] relative">
            {/* Close button remains the same */}
            <Button variant="ghost" size="icon" className="absolute top-3 right-3 text-muted-foreground hover:text-foreground z-10" onClick={onClose}>
                <FaTimes className="h-5 w-5" />
                <span className="sr-only">Close</span>
            </Button>
            {/* Header remains the same */}
            <div className="pb-4 mb-4 border-b-2 border-[#f3c700]">
                <h2 className="text-xl md:text-2xl font-semibold">Create New Case File</h2>
            </div>
            {/* Tabs structure */}
            <Tabs defaultValue="details" className="w-full flex-grow flex flex-col overflow-hidden">
                {/* Tabs List: Add Updates tab */}
                <TabsList className="mb-4 shrink-0 bg-transparent p-0 border-b border-border">
                    <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-[#f3c700] data-[state=active]:text-[#f3c700] data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Details</TabsTrigger>
                    <TabsTrigger value="updates" className="data-[state=active]:border-b-2 data-[state=active]:border-[#f3c700] data-[state=active]:text-[#f3c700] data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Updates</TabsTrigger>
                    <TabsTrigger value="warrant" className="data-[state=active]:border-b-2 data-[state=active]:border-[#f3c700] data-[state=active]:text-[#f3c700] data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Warrant</TabsTrigger>
                </TabsList>

                {/* Details Tab Content (Copied from CaseDetailsModal) */}
                <TabsContent value="details" className="flex-grow space-y-5 overflow-y-auto pr-2 pl-1 pb-2 custom-scrollbar">
                    {/* Basic Info Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="caseTitleCreate">Case Title *</Label>
                                    <Input id="caseTitleCreate" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Bank Robbery at Fleeca" className="bg-input border-border" disabled={isSubmitting} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="incidentReportCreate">Incident Report (Link or #)</Label>
                                    <Input id="incidentReportCreate" value={incidentReport} onChange={(e) => setIncidentReport(e.target.value)} placeholder="e.g., #12345 or URL" className="bg-input border-border" disabled={isSubmitting} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="locationCreate">Location of Incident</Label>
                                <Input id="locationCreate" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Pacific Standard Bank, Vinewood Blvd" className="bg-input border-border" disabled={isSubmitting} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="summaryCreate">Summary</Label>
                                <Textarea id="summaryCreate" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Briefly summarize the investigation..." rows={4} className="bg-input border-border" disabled={isSubmitting} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Charges Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Charges</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <Label htmlFor="chargeSearchCreate">Search Penal Codes</Label>
                                <div className="flex items-center">
                                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 mt-3" />
                                    <Input
                                        id="chargeSearchCreate"
                                        type="text"
                                        placeholder="Search by PC, Title, or Description..."
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        className="bg-input border-border pl-10"
                                        disabled={isSubmitting}
                                    />
                                </div>
                                {searchResults.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                        {searchResults.map(code => (
                                            <div
                                                key={code.pc}
                                                className="px-4 py-2 hover:bg-muted cursor-pointer text-sm"
                                                onClick={() => addCharge(code)}
                                            >
                                                <p className="font-semibold">{code.pc} - {code.title}</p>
                                                <p className="text-xs text-muted-foreground truncate">{code.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Selected Charges</Label>
                                {selectedCharges.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic">No charges added yet.</p>
                                ) : (
                                    <div className="border rounded-md border-border overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Code</th>
                                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Title</th>
                                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Fine</th>
                                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time (Months)</th>
                                                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedCharges.map((charge, index) => (
                                                    <tr key={charge.pc} className={`${index > 0 ? 'border-t border-border' : ''}`}>
                                                        <td className="px-3 py-2 font-medium">{charge.pc}</td>
                                                        <td className="px-3 py-2">{charge.title}</td>
                                                        <td className="px-3 py-2">${charge.fine}</td>
                                                        <td className="px-3 py-2">{charge.prison_time_months}</td>
                                                        <td className="px-3 py-2 text-right">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => removeCharge(charge.pc)}
                                                                className="text-destructive hover:text-destructive/80 h-7 w-7"
                                                                disabled={isSubmitting}
                                                                title="Remove Charge"
                                                            >
                                                                <FaTrash className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Names of Interest Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Names of Interest</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {namesOfInterest.map((item, index) => (
                                <div key={item.id} className="p-3 border border-border/50 rounded-md space-y-3 relative">
                                    {namesOfInterest.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeNameRow(index)} className="absolute top-1 right-1 text-destructive hover:text-destructive/80 h-7 w-7" disabled={isSubmitting} title="Remove Person">
                                            <FaTrash className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Name</Label>
                                            <Input value={item.name} onChange={(e) => updateName(index, 'name', e.target.value)} placeholder="Full Name" className="bg-input border-border" disabled={isSubmitting}/>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">CID#</Label>
                                            <Input value={item.cid || ''} onChange={(e) => updateName(index, 'cid', e.target.value)} placeholder="Citizen ID (Optional)" className="bg-input border-border" disabled={isSubmitting}/>
                                        </div>
                                         <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Phone Number</Label>
                                            <Input value={item.phoneNumber || ''} onChange={(e) => updateName(index, 'phoneNumber', e.target.value)} placeholder="Phone # (Optional)" className="bg-input border-border" disabled={isSubmitting}/>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Role</Label>
                                            <Input value={item.role} onChange={(e) => updateName(index, 'role', e.target.value)} placeholder="Suspect, Witness, Victim..." className="bg-input border-border" disabled={isSubmitting}/>
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <Label className="text-xs text-muted-foreground">Gang Affiliation / Notes</Label>
                                            <Input value={item.affiliation} onChange={(e) => updateName(index, 'affiliation', e.target.value)} placeholder="Gang Name or relevant notes" className="bg-input border-border" disabled={isSubmitting}/>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addNameRow} className="mt-2 bg-[#f3c700] text-white hover:bg-[#f3c700]/90 border-0" disabled={isSubmitting}>
                                <FaPlus className="mr-2 h-3 w-3" /> Add Person
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Evidence Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Evidence</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {evidence.map((item, index) => (
                                <div key={item.id} className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                                    <Input value={item.description} onChange={(e) => updateEvidence(index, 'description', e.target.value)} placeholder="Description" className="flex-grow bg-input border-border" disabled={isSubmitting} />
                                    <Input value={item.location} onChange={(e) => updateEvidence(index, 'location', e.target.value)} placeholder="Location Collected" className="flex-grow bg-input border-border" disabled={isSubmitting} />
                                    {evidence.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEvidenceRow(index)} className="text-destructive hover:text-destructive/80 h-9 w-9" disabled={isSubmitting}>
                                            <FaTrash className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addEvidenceRow} className="mt-2 bg-[#f3c700] text-white hover:bg-[#f3c700]/90 border-0" disabled={isSubmitting}>
                                <FaPlus className="mr-2 h-3 w-3" /> Add Evidence
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Photos Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Photos (Links)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {photos.map((link, index) => (
                                <div key={index}>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={link}
                                            onChange={(e) => updatePhotoLink(index, e.target.value)}
                                            placeholder="https://example.com/image.png"
                                            className="flex-grow bg-input border-border"
                                            disabled={isSubmitting}
                                        />
                                        {photos.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removePhotoLink(index)}
                                                className="text-destructive hover:text-destructive/80 h-9 w-9"
                                                disabled={isSubmitting}
                                            >
                                                <FaTrash className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {link && (
                                        <img
                                            src={link}
                                            alt={`Photo ${index + 1}`}
                                            className="mt-2 max-w-full h-auto max-h-48 rounded border border-border object-contain"
                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                            onLoad={(e) => (e.currentTarget.style.display = 'block')}
                                        />
                                    )}
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addPhotoLink} className="mt-2 bg-[#f3c700] text-white hover:bg-[#f3c700]/90 border-0" disabled={isSubmitting}>
                                <FaPlus className="mr-2 h-3 w-3" /> Add Photo Link
                            </Button>
                        </CardContent>
                    </Card>

                     {/* Video Evidence Notes Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Bodycam/Dashcam/Video Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                id="videoNotesCreate"
                                value={videoNotes}
                                onChange={(e) => setVideoNotes(e.target.value)}
                                placeholder="Add links to bodycam/dashcam footage, YouTube videos, or general notes about video evidence..."
                                rows={4}
                                className="bg-input border-border"
                                disabled={isSubmitting}
                            />
                        </CardContent>
                    </Card>

                    {/* Gang Info Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                         <CardHeader>
                            <CardTitle className="text-lg text-white">Gang Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea id="gangInfoCreate" value={gangInfo} onChange={(e) => setGangInfo(e.target.value)} placeholder="Details about gang involvement, if any..." rows={4} className="bg-input border-border" disabled={isSubmitting} />
                        </CardContent>
                    </Card>

                    {/* Status and Assignment Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Status & Assignment</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <div className="flex items-center space-x-2">
                                    {isActive && <span className="h-2.5 w-2.5 bg-green-500 rounded-full inline-block" title="Active Case"></span>}
                                    <Select value={status} onValueChange={(value: CaseStatus) => handleStatusChange(value)} disabled={isSubmitting}>
                                        <SelectTrigger className="bg-input border-border flex-1">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
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
                            </div>
                            <div className="space-y-2">
                                <Label>Assign Detective</Label>
                                <Select value={assignedToId || "unassigned"} onValueChange={handleAssigneeChange} disabled={isSubmitting}>
                                    <SelectTrigger className="bg-input border-border">
                                        <SelectValue placeholder="Select detective" />
                                    </SelectTrigger>
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

                {/* Updates Tab Content (Placeholder for Create) */}
                <TabsContent value="updates" className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2 pl-1 pb-2 custom-scrollbar">
                    <div className="space-y-3 flex-grow overflow-y-auto pr-1 custom-scrollbar">
                        <p className="text-muted-foreground italic text-sm">Updates can be added after the case is created.</p>
                    </div>
                    {/* No "Add New Update" section in create mode */}
                </TabsContent>

                {/* Warrant Tab Content (Copied from CaseDetailsModal) */}
                <TabsContent value="warrant" className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2 pl-1 pb-2 custom-scrollbar">
                     <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-white">Arrest Warrant Preview</h3>
                        <div className="space-x-2">
                             <Button variant="outline" size="sm" onClick={handleRegenerateWarrantPreview} title="Regenerate text preview" className="bg-blue-600 hover:bg-blue-700 text-white border-blue-700" disabled={isSubmitting || isGeneratingDocx}>
                                <FaSync className="mr-2 h-3 w-3" /> Regenerate Preview
                            </Button>
                            {/* Disable export buttons in create mode */}
                            <Button variant="outline" size="sm" onClick={exportAsDocx} title="Export as DOCX (Available after creation)" className="bg-sky-600 hover:bg-sky-700 text-white border-sky-700" disabled={true}>
                                <FaFileWord className="mr-2 h-3 w-3" /> Export DOCX
                            </Button>
                            <Button variant="outline" size="sm" onClick={exportAsPdf} title="Export Preview as PDF (Available after creation)" className="bg-red-600 hover:bg-red-700 text-white border-red-700" disabled={true}>
                                <FaFilePdf className="mr-2 h-3 w-3" /> Export PDF Preview
                            </Button>
                        </div>
                    </div>
                    <Textarea
                        readOnly
                        value={warrantText}
                        className="flex-grow w-full bg-input border-border font-mono text-xs h-[calc(100%-60px)] resize-none"
                        rows={25}
                        placeholder="Warrant text preview will be generated here based on case details..."
                    />
                     <p className="text-xs text-muted-foreground italic mt-1">
                        This is a simplified preview. Use 'Export DOCX' (after creation) to generate the official warrant document.
                    </p>
                </TabsContent>
            </Tabs>

            {/* Footer (Copied from CaseDetailsModal, adapted for Create) */}
            <div className="pt-4 mt-4 border-t-2 border-[#f3c700] shrink-0 flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <FaSave className="mr-2 h-4 w-4" />
                    {isSubmitting ? 'Creating...' : 'Create Case'}
                </Button>
            </div>
        </div>
    );
};

export default CreateCaseModal;