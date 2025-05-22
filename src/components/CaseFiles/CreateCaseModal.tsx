import React, { useState, useEffect, useMemo } from 'react';
import {
    Save,
    X,
    Plus,
    Trash2,
    Search,
    RefreshCw,
    FileText, // Using FileText for both Word and PDF for simplicity, or specific ones if preferred
    UserPlus,
    Tag,
    FileUp // For export/upload related actions if needed, using RefreshCw for sync
} from 'lucide-react'; // Import Lucide icons
import { Timestamp, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types/User'; // Ensure User type is imported
import { toast } from 'react-toastify';
import penalCodesData from './penal_codes.ts'; // Assuming this is correctly typed
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog'; // Assuming these are used or will be
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

import { CaseFile, CaseStatus } from '../../utils/ciuUtils'; // Removed TipConversionData as it is not exported

interface PenalCode {
    pc: string;
    offense_class: string;
    title: string;
    description: string;
    fine: number;
    prison_time_months: number;
}

// Define specific evidence type interfaces
interface BaseEvidenceItem {
    id: number;
    location: string;
    photoLink?: string;
}
export interface EvidenceBlood extends BaseEvidenceItem { type: 'Blood'; name?: string; dnaCode?: string; }
export interface EvidenceCasing extends BaseEvidenceItem { type: 'Casing'; casingDetails?: string; registeredTo?: string; }
export interface EvidenceWeapon extends BaseEvidenceItem { type: 'Weapon'; weaponDetails?: string; registeredTo?: string; sourceOfCollection?: string; }
export interface EvidenceVehicle extends BaseEvidenceItem { type: 'Vehicle'; owner?: string; plate?: string; model?: string; }
export interface EvidenceFingerprint extends BaseEvidenceItem { type: 'Fingerprint'; name?: string; fingerprintId?: string; }
export interface EvidenceOther extends BaseEvidenceItem { type: 'Other'; description: string; }
export type EvidenceItem = EvidenceBlood | EvidenceCasing | EvidenceWeapon | EvidenceVehicle | EvidenceFingerprint | EvidenceOther;

export const isEvidenceItemPopulated = (item: EvidenceItem): boolean => {
    if (item.location?.trim() || item.photoLink?.trim()) {
        return true;
    }
    switch (item.type) {
        case 'Blood':
            return !!(item.name?.trim() || item.dnaCode?.trim());
        case 'Vehicle':
            return !!(item.owner?.trim() || item.plate?.trim() || item.model?.trim());
        case 'Fingerprint':
            return !!(item.name?.trim() || item.fingerprintId?.trim());
        case 'Casing':
            return !!(item.casingDetails?.trim() || item.registeredTo?.trim());
        case 'Weapon':
            return !!(item.weaponDetails?.trim() || item.registeredTo?.trim() || item.sourceOfCollection?.trim());
        case 'Other':
            return !!item.description?.trim();
    }
    return false;
};

interface NameOfInterest { id: number; name: string; role: string; affiliation: string; cid?: string; phoneNumber?: string; }

interface CreateCaseModalProps {
    onClose: () => void;
    onSuccess: (newCaseId?: string) => void;
    eligibleAssignees: User[]; // Kept for prop consistency, though not used directly for assignment here
    initialDataForCase?: { 
        title?: string; 
        originalTipId?: string; 
        incidentReport?: string; 
        location?: string; 
        summary?: string; 
        namesOfInterest?: NameOfInterest[]; 
        evidence?: EvidenceItem[]; 
        photos?: string[]; 
        photoSectionDescription?: string; 
        gangInfo?: string; 
        videoNotes?: string; 
        charges?: PenalCode[]; 
    } | null;
}

const CreateCaseModal: React.FC<CreateCaseModalProps> = ({ onClose, onSuccess, eligibleAssignees, initialDataForCase }) => {
    const { user: currentUser } = useAuth();

    const [title, setTitle] = useState<string>('');
    const [incidentReport, setIncidentReport] = useState<string>('');
    const [location, setLocation] = useState<string>('');
    const [summary, setSummary] = useState<string>('');
    const [namesOfInterest, setNamesOfInterest] = useState<NameOfInterest[]>([{ id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]);
    const [evidence, setEvidence] = useState<EvidenceItem[]>([{ id: Date.now(), type: 'Other', description: '', location: '', photoLink: '' }]);
    const [photos, setPhotos] = useState<string[]>(['']);
    const [photoSectionDescription, setPhotoSectionDescription] = useState<string>('');
    const [gangInfo, setGangInfo] = useState<string>('');
    const [videoNotes, setVideoNotes] = useState<string>('');
    const [selectedCharges, setSelectedCharges] = useState<PenalCode[]>([]);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [penalCodes, setPenalCodes] = useState<PenalCode[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [searchResults, setSearchResults] = useState<PenalCode[]>([]);
    const [warrantText, setWarrantText] = useState<string>('');
    const [isGeneratingDocx, setIsGeneratingDocx] = useState(false); // Though DOCX generation is disabled, state is kept for consistency

    // New state for status and assignee
    const [status, setStatus] = useState<CaseStatus>('Open - Unassigned');
    const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);


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

    const addEvidenceRow = () => setEvidence([...evidence, { id: Date.now(), type: 'Other', description: '', location: '', photoLink: '' }]);
    
    const updateEvidence = (index: number, field: string, value: any) => {
        const updated = [...evidence];
        const currentItem = updated[index];

        if (field === 'type') {
            const newType = value as EvidenceItem['type'];
            const baseProperties: Pick<BaseEvidenceItem, 'id' | 'location' | 'photoLink'> = {
                id: currentItem.id,
                location: (currentItem as any).location || '',
                photoLink: (currentItem as any).photoLink || '',
            };

            switch (newType) {
                case 'Blood':
                    updated[index] = { ...baseProperties, type: 'Blood', name: (currentItem as EvidenceBlood).name || '', dnaCode: (currentItem as EvidenceBlood).dnaCode || '' };
                    break;
                case 'Vehicle':
                    updated[index] = { ...baseProperties, type: 'Vehicle', owner: (currentItem as EvidenceVehicle).owner || '', plate: (currentItem as EvidenceVehicle).plate || '', model: (currentItem as EvidenceVehicle).model || '' };
                    break;
                case 'Fingerprint':
                    updated[index] = { ...baseProperties, type: 'Fingerprint', name: (currentItem as EvidenceFingerprint).name || '', fingerprintId: (currentItem as EvidenceFingerprint).fingerprintId || '' };
                    break;
                case 'Casing':
                    updated[index] = { ...baseProperties, type: 'Casing', casingDetails: (currentItem as EvidenceCasing).casingDetails || '', registeredTo: (currentItem as EvidenceCasing).registeredTo || '' };
                    break;
                case 'Weapon':
                    updated[index] = { ...baseProperties, type: 'Weapon', weaponDetails: (currentItem as EvidenceWeapon).weaponDetails || '', registeredTo: (currentItem as EvidenceWeapon).registeredTo || '', sourceOfCollection: (currentItem as EvidenceWeapon).sourceOfCollection || '' };
                    break;
                case 'Other':
                default:
                    updated[index] = { ...baseProperties, type: 'Other', description: (currentItem as EvidenceOther).description || '' };
                    break;
            }
        } else {
            (updated[index] as any)[field] = value;
        }
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
    
    useEffect(() => {
        if (initialDataForCase) {
            setTitle(initialDataForCase.title || `Case from Tip: ${initialDataForCase.originalTipId?.substring(0,6)}`);
            setIncidentReport(initialDataForCase.incidentReport || '');
            setLocation(initialDataForCase.location || '');
            setSummary(initialDataForCase.summary || '');
            setNamesOfInterest(initialDataForCase.namesOfInterest?.length 
                ? initialDataForCase.namesOfInterest.map((noi: NameOfInterest) => ({...noi, id: noi.id || Date.now()})) 
                : [{ id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]);
            setEvidence(initialDataForCase.evidence?.length ? initialDataForCase.evidence.map((ev: EvidenceItem) => ({...ev, id: ev.id || Date.now()})) : [{ id: Date.now(), type: 'Other', description: '', location: '', photoLink: '' }]);
            setPhotos(initialDataForCase.photos?.length ? initialDataForCase.photos : ['']);
            setPhotoSectionDescription(initialDataForCase.photoSectionDescription || '');
            setGangInfo(initialDataForCase.gangInfo || '');
            setVideoNotes(initialDataForCase.videoNotes || '');
            setSelectedCharges(initialDataForCase.charges || []);
            // Reset status and assignee for new case from tip, unless tip data includes this
            setStatus('Open - Unassigned');
            setSelectedAssigneeId(null);
        } else {
            // Reset to default if no initial data
            setTitle('');
            setIncidentReport('');
            setLocation('');
            setSummary('');
            setNamesOfInterest([{ id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]);
            setEvidence([{ id: Date.now(), type: 'Other', description: '', location: '', photoLink: '' }]);
            setPhotos(['']);
            setPhotoSectionDescription('');
            setGangInfo('');
            setVideoNotes('');
            setSelectedCharges([]);
            setStatus('Open - Unassigned');
            setSelectedAssigneeId(null);
        }
    }, [initialDataForCase]);

    // Handler for status change
    const handleStatusChange = (newStatus: CaseStatus) => {
        setStatus(newStatus);
        if (newStatus === 'Open - Unassigned') {
            setSelectedAssigneeId(null); // Clear assignee if status is unassigned
        } else if (newStatus === 'Open - Assigned' && !selectedAssigneeId) {
            // If changing to 'Open - Assigned' without an assignee, prompt or handle
            toast.info("Please select a detective to assign this case to.");
            // Optionally revert status or leave as is for user to correct
            // setStatus('Open - Unassigned'); 
        }
    };

    // Handler for assignee change
    const handleAssigneeChange = (newAssigneeIdValue: string) => {
        const newAssigneeId = newAssigneeIdValue === "unassigned" ? null : newAssigneeIdValue;
        setSelectedAssigneeId(newAssigneeId);
        if (newAssigneeId && status === 'Open - Unassigned') {
            setStatus('Open - Assigned'); // Auto-change status if assigning to an unassigned case
        } else if (!newAssigneeId && status === 'Open - Assigned') {
            setStatus('Open - Unassigned'); // Revert to unassigned if detective is removed
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
        if (status === 'Open - Assigned' && !selectedAssigneeId) {
            toast.error("Please select a detective for 'Open - Assigned' status, or set status to 'Open - Unassigned'.");
            return;
        }
        setIsSubmitting(true);

        const assignedUser = eligibleAssignees.find(u => u.id === selectedAssigneeId);

        const detailsObject = {
            incidentReport,
            evidence: evidence.filter(isEvidenceItemPopulated),
            photos: photos.filter(p => p.trim()),
            photoSectionDescription,
            location,
            namesOfInterest: namesOfInterest.filter(n => n.name.trim() || n.role.trim() || n.affiliation.trim() || n.cid?.trim() || n.phoneNumber?.trim()),
            gangInfo,
            videoNotes,
            charges: selectedCharges,
            updates: [], // No updates on creation
            originalTipId: initialDataForCase?.originalTipId || undefined,
        };

        const newCaseData: Omit<CaseFile, 'id'> = {
            title: title.trim(),
            description: summary.trim(),
            status: status, 
            assignedToId: selectedAssigneeId, 
            assignedToName: assignedUser?.name || null,
            createdBy: currentUser.id || 'Unknown',
            createdByName: currentUser.name || 'Unknown',
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
            imageLinks: detailsObject.photos,
            details: JSON.stringify(detailsObject),
        };

        try {
            const docRef = await addDoc(collection(dbFirestore, 'caseFiles'), newCaseData);
            toast.success(`Case "${title.trim()}" created successfully.`);
            onSuccess(docRef.id);
            onClose();
        } catch (error) {
            console.error("Error creating case file:", error);
            toast.error("Failed to create case file.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const generateWarrantTextPreview = (): string => {
        const primarySuspect = namesOfInterest.find(n => n.role?.toLowerCase().includes('suspect'))?.name || '[Suspect Name]';
        const otherSuspects = namesOfInterest.filter(n => n.role?.toLowerCase().includes('suspect') && n.name !== primarySuspect).map(n => n.name).join(', ') || 'None';
        const witnesses = namesOfInterest
            .filter(n => n.role?.toLowerCase().includes('witness'))
            .map(w => `${w.name}${w.cid ? ` (CID: ${w.cid})` : ''}${w.phoneNumber ? ` (Phone: ${w.phoneNumber})` : ''}`)
            .join(', ') || 'None';
        const victims = namesOfInterest.filter(n => n.role?.toLowerCase().includes('victim')).map(v => v.name).join(', ') || 'None';
        
        const evidenceSummary = evidence
            .filter(isEvidenceItemPopulated)
            .map((item, i) => {
                let details = `[${item.type}] `;
                switch (item.type) {
                    case 'Blood':
                        details += `Name: ${item.name || 'N/A'}, DNA: ${item.dnaCode || 'N/A'}`;
                        break;
                    case 'Vehicle':
                        details += `Owner: ${item.owner || 'N/A'}, Plate: ${item.plate || 'N/A'}, Model: ${item.model || 'N/A'}`;
                        break;
                    case 'Fingerprint':
                        details += `Name: ${item.name || 'N/A'}, ID: ${item.fingerprintId || 'N/A'}`;
                        break;
                    case 'Casing':
                        details += `Details: ${item.casingDetails || 'N/A'}, Registered: ${item.registeredTo || 'N/A'}`;
                        break;
                    case 'Weapon':
                        details += `Details: ${item.weaponDetails || 'N/A'}, Registered: ${item.registeredTo || 'N/A'}, Source: ${item.sourceOfCollection || 'N/A'}`;
                        break;
                    case 'Other':
                         if (item.type === 'Other') { // Explicit check for EvidenceOther
                            details += `Desc: ${item.description || 'N/A'}`;
                        }
                        break;
                }
                details += ` (Loc: ${item.location || 'N/A'})`;
                if (item.photoLink) details += ` (Photo: ${item.photoLink})`;
                return `  - Exhibit ${String.fromCharCode(65 + i)}: ${details}`;
            }).join('\n') || '  - No specific evidence listed.';

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
**PHOTO DESCRIPTION:** ${photoSectionDescription || 'N/A'}
**VIDEO EVIDENCE NOTES:**
${videoNotes || 'N/A'}
**GANG INFO:** ${gangInfo || 'N/A'}

*(This is a simplified preview. The exported DOCX will follow the official template structure.)*
        `;
        return template.trim();
    };
    
    useEffect(() => {
        setWarrantText(generateWarrantTextPreview());
    }, [title, incidentReport, location, summary, namesOfInterest, evidence, photos, photoSectionDescription, gangInfo, videoNotes, selectedCharges, currentUser]);

    const handleRegenerateWarrantPreview = () => {
        setWarrantText(generateWarrantTextPreview());
        toast.info("Warrant preview regenerated.");
    };

    const exportAsDocx = () => {
        toast.info("DOCX export is available after the case is created (via Edit).");
    };

    const exportAsPdf = () => {
        toast.info("PDF export is available after the case is created (via Edit).");
    };

    const isLeadOrSuper = useMemo(() => {
        if (!currentUser || !currentUser.certifications || !currentUser.certifications['CIU']) return false;
        const ciuLevel = currentUser.certifications['CIU'];
        return ['LEAD', 'SUPER'].includes(ciuLevel);
    }, [currentUser]);

    return (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] sm:max-w-none max-h-[95vh] overflow-hidden bg-card text-foreground rounded-lg shadow-2xl border-brand border-2 flex flex-col p-6 sm:p-8 md:p-12">
            <Button variant="ghost" size="icon" className="absolute top-4 right-4 sm:top-6 sm:right-6 text-muted-foreground hover:text-foreground z-10" onClick={onClose}>
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
            </Button>
            <div className="pb-6 mb-6 border-b-2 border-brand shrink-0">
                <h2 className="text-2xl md:text-3xl font-semibold">
                  {initialDataForCase ? "Convert Tip to Case File" : "Create New Case File"}
                </h2>
            </div>
            {/* NEW: Move Status & Assignment Card to the top */}
            <Card className="bg-card-foreground/5 border-border shadow-sm mb-6">
                <CardHeader className="pt-6">
                    <CardTitle className="text-lg text-foreground">Status & Assignment</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="caseStatusCreate">Case Status</Label>
                        <div className="flex items-center space-x-2">
                            {['Open - Unassigned', 'Open - Assigned', 'Under Review'].includes(status)
                              ? <span className="h-2.5 w-2.5 bg-green-500 rounded-full inline-block" title="Active Case"></span>
                              : <span className="h-2.5 w-2.5 bg-red-500 rounded-full inline-block" title="Closed Case"></span>}
                            <Select value={status} onValueChange={(value: CaseStatus) => handleStatusChange(value)}>
                              <SelectTrigger id="caseStatusCreate" className="bg-input border-border flex-1">
                                  <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent className="bg-popover text-popover-foreground border-border shadow-md z-50">
                                  <SelectItem value="Open - Unassigned">Open - Unassigned</SelectItem>
                                  <SelectItem value="Open - Assigned">Open - Assigned</SelectItem>
                                  <SelectItem value="Under Review">Under Review</SelectItem>
                                  <SelectItem value="Closed - Solved">Closed - Solved</SelectItem>
                                  <SelectItem value="Closed - Unsolved">Closed - Unsolved</SelectItem>
                              </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {isLeadOrSuper && (
                    <div className="space-y-2">
                        <Label htmlFor="assignDetectiveCreate">Assign Detective</Label>
                        <Select value={selectedAssigneeId || "unassigned"} onValueChange={handleAssigneeChange}>
                            <SelectTrigger id="assignDetectiveCreate" className="bg-input border-border">
                                <SelectValue placeholder="Select detective" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover text-popover-foreground border-border shadow-md z-50">
                                <SelectItem value="unassigned">-- Unassigned --</SelectItem>
                                {eligibleAssignees.map(user => (
                                    user.id && (
                                        <SelectItem key={user.id} value={user.id}>
                                          {user.name} ({user.callsign || 'N/A'}) - CIU: {user.certifications?.CIU || 'N/A'}
                                        </SelectItem>
                                    )
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    )}
                </CardContent>
            </Card>
            <Tabs defaultValue="details" className="w-full flex-grow flex flex-col overflow-hidden">
                <TabsList className="mb-6 shrink-0 bg-transparent p-0 border-b border-border gap-4">
                    <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-brand data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Details</TabsTrigger>
                    <TabsTrigger value="warrant" className="data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-brand data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Warrant Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="flex-grow space-y-8 pb-4 overflow-y-auto custom-scrollbar pr-4 pl-1">
                    {/* Core Information Card */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="caseTitleCreate">Case Title *</Label>
                                    <Textarea id="caseTitleCreate" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Bank Robbery at Fleeca" className="bg-input border-border py-2 px-3" rows={1} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="incidentReportCreate">Incident Report (Link or #)</Label>
                                    <Textarea id="incidentReportCreate" value={incidentReport} onChange={(e) => setIncidentReport(e.target.value)} placeholder="e.g., #12345 or URL" className="bg-input border-border py-2 px-3" rows={1} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="locationCreate">Location of Incident</Label>
                                <Textarea id="locationCreate" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Pacific Standard Bank, Vinewood Blvd" className="bg-input border-border py-2 px-3" rows={1} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="summaryCreate">Summary</Label>
                                <Textarea id="summaryCreate" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Briefly summarize the investigation..." className="bg-input border-border whitespace-pre-line break-words py-2 px-3" rows={4} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Charges Card */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Charges</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="relative space-y-2">
                                <Label htmlFor="chargeSearchCreate">Search Penal Codes</Label>
                                <div className="flex items-center">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 mt-3.5" />
                                    <Input
                                        id="chargeSearchCreate"
                                        type="text"
                                        placeholder="Search by PC, Title, or Description..."
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        className="bg-input border-border pl-10 h-10"
                                    />
                                </div>
                                {searchResults.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto penal-code-search-results">
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
                                    <div className="border rounded-md border-border overflow-x-auto">
                                        <table className="w-full text-sm min-w-[600px]">
                                            <thead className="bg-muted/50">
                                                <tr>
                                                    <th className="p-2 text-left font-medium">PC</th>
                                                    <th className="p-2 text-left font-medium">Title</th>
                                                    <th className="p-2 text-left font-medium">Class</th>
                                                    <th className="p-2 text-right font-medium">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedCharges.map(charge => (
                                                    <tr key={charge.pc} className="border-b border-border/50 last:border-b-0 hover:bg-muted/30">
                                                        <td className="p-2">{charge.pc}</td>
                                                        <td className="p-2">{charge.title}</td>
                                                        <td className="p-2">{charge.offense_class}</td>
                                                        <td className="p-2 text-right">
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeCharge(charge.pc)} className="text-destructive hover:text-destructive/80 h-7 w-7" title="Remove Charge">
                                                                <Trash2 className="h-3.5 w-3.5" />
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
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Names of Interest</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             {namesOfInterest.map((item, index) => (
                                <div key={item.id} className="p-4 border border-border/60 rounded-md space-y-4 relative bg-input/30">
                                     {namesOfInterest.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeNameRow(index)} className="absolute top-1 right-1 text-destructive hover:text-destructive/80 h-7 w-7" title="Remove Person">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <Label htmlFor={`name-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Name</Label>
                                            <Textarea id={`name-create-${item.id}-${index}`} value={item.name} onChange={(e) => updateName(index, 'name', e.target.value)} placeholder="Full Name" className="bg-input border-border py-1.5 px-3 text-sm" rows={1} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`cid-create-${item.id}-${index}`} className="text-xs text-muted-foreground">CID#</Label>
                                            <Textarea id={`cid-create-${item.id}-${index}`} value={item.cid || ''} onChange={(e) => updateName(index, 'cid', e.target.value)} placeholder="Citizen ID (Optional)" className="bg-input border-border py-1.5 px-3 text-sm" rows={1} />
                                        </div>
                                         <div className="space-y-1">
                                            <Label htmlFor={`phone-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Phone Number</Label>
                                            <Textarea id={`phone-create-${item.id}-${index}`} value={item.phoneNumber || ''} onChange={(e) => updateName(index, 'phoneNumber', e.target.value)} placeholder="Phone # (Optional)" className="bg-input border-border py-1.5 px-3 text-sm" rows={1} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`role-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Role</Label>
                                            <Textarea id={`role-create-${item.id}-${index}`} value={item.role} onChange={(e) => updateName(index, 'role', e.target.value)} placeholder="Suspect, Witness, Victim..." className="bg-input border-border py-1.5 px-3 text-sm" rows={1} />
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <Label htmlFor={`affiliation-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Gang Affiliation / Notes</Label>
                                            <Textarea id={`affiliation-create-${item.id}-${index}`} value={item.affiliation} onChange={(e) => updateName(index, 'affiliation', e.target.value)} placeholder="Gang Name or relevant notes" className="bg-input border-border py-1.5 px-3 text-sm" rows={1} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addNameRow} className="mt-2 bg-brand text-brand-foreground hover:bg-brand/90 border-0">
                                <Plus className="mr-2 h-3 w-3" /> Add Person
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Evidence Card */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Evidence</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {evidence.map((item, index) => (
                                <div key={item.id} className="p-4 border border-border/60 rounded-md space-y-4 relative bg-input/30">
                                     {evidence.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEvidenceRow(index)} className="absolute top-1 right-1 text-destructive hover:text-destructive/80 h-7 w-7" title="Remove Evidence">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                   <div className="space-y-1 mb-4">
                                        <Label htmlFor={`evidence-type-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Type</Label>
                                        <Select
                                            value={item.type}
                                            onValueChange={(value: EvidenceItem['type']) => updateEvidence(index, 'type', value)}
                                        >
                                            <SelectTrigger id={`evidence-type-create-${item.id}-${index}`} className="bg-input border-border h-9 text-sm w-full">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-popover text-popover-foreground border-border shadow-md z-50">
                                                <SelectItem value="Blood">Blood</SelectItem>
                                                <SelectItem value="Casing">Casing</SelectItem>
                                                <SelectItem value="Weapon">Weapon</SelectItem>
                                                <SelectItem value="Vehicle">Vehicle</SelectItem>
                                                <SelectItem value="Fingerprint">Fingerprint</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                                        {item.type === 'Blood' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-blood-name-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Name (Person)</Label>
                                                    <Textarea id={`evidence-blood-name-create-${item.id}-${index}`} value={(item as EvidenceBlood).name || ''} onChange={e => updateEvidence(index, 'name', e.target.value)} placeholder="Name (Person)" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-blood-dna-create-${item.id}-${index}`} className="text-xs text-muted-foreground">DNA Code</Label>
                                                    <Textarea id={`evidence-blood-dna-create-${item.id}-${index}`} value={(item as EvidenceBlood).dnaCode || ''} onChange={e => updateEvidence(index, 'dnaCode', e.target.value)} placeholder="DNA Code" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Weapon' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-weapon-details-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Weapon Details (Type, Model, SN)</Label>
                                                    <Textarea id={`evidence-weapon-details-create-${item.id}-${index}`} value={(item as EvidenceWeapon).weaponDetails || ''} onChange={e => updateEvidence(index, 'weaponDetails', e.target.value)} placeholder="Weapon Details (Type, Model, SN)" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-weapon-reg-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Registered To</Label>
                                                    <Textarea id={`evidence-weapon-reg-create-${item.id}-${index}`} value={(item as EvidenceWeapon).registeredTo || ''} onChange={e => updateEvidence(index, 'registeredTo', e.target.value)} placeholder="Registered To" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-weapon-source-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Source of Collection</Label>
                                                    <Textarea id={`evidence-weapon-source-create-${item.id}-${index}`} value={(item as EvidenceWeapon).sourceOfCollection || ''} onChange={e => updateEvidence(index, 'sourceOfCollection', e.target.value)} placeholder="Source of Collection" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Casing' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-casing-details-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Casing Details (Caliber, Markings)</Label>
                                                    <Textarea id={`evidence-casing-details-create-${item.id}-${index}`} value={(item as EvidenceCasing).casingDetails || ''} onChange={e => updateEvidence(index, 'casingDetails', e.target.value)} placeholder="Casing Details (Caliber, Markings)" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-casing-reg-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Registered To (Weapon, if known)</Label>
                                                    <Textarea id={`evidence-casing-reg-create-${item.id}-${index}`} value={(item as EvidenceCasing).registeredTo || ''} onChange={e => updateEvidence(index, 'registeredTo', e.target.value)} placeholder="Registered To (Weapon, if known)" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Vehicle' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-vehicle-owner-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Owner</Label>
                                                    <Textarea id={`evidence-vehicle-owner-create-${item.id}-${index}`} value={(item as EvidenceVehicle).owner || ''} onChange={e => updateEvidence(index, 'owner', e.target.value)} placeholder="Owner" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-vehicle-plate-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Plate</Label>
                                                    <Textarea id={`evidence-vehicle-plate-create-${item.id}-${index}`} value={(item as EvidenceVehicle).plate || ''} onChange={e => updateEvidence(index, 'plate', e.target.value)} placeholder="Plate" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-vehicle-model-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Model</Label>
                                                    <Textarea id={`evidence-vehicle-model-create-${item.id}-${index}`} value={(item as EvidenceVehicle).model || ''} onChange={e => updateEvidence(index, 'model', e.target.value)} placeholder="Model" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Fingerprint' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-fingerprint-name-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Name (Person)</Label>
                                                    <Textarea id={`evidence-fingerprint-name-create-${item.id}-${index}`} value={(item as EvidenceFingerprint).name || ''} onChange={e => updateEvidence(index, 'name', e.target.value)} placeholder="Name (Person)" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-fingerprint-id-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Fingerprint ID</Label>
                                                    <Textarea id={`evidence-fingerprint-id-create-${item.id}-${index}`} value={(item as EvidenceFingerprint).fingerprintId || ''} onChange={e => updateEvidence(index, 'fingerprintId', e.target.value)} placeholder="Fingerprint ID" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                            </>
                                        )}
                                        {(item.type === 'Other') && (
                                            <div className="space-y-1 sm:col-span-2">
                                                <Label htmlFor={`evidence-other-desc-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Evidence Details</Label>
                                                <Textarea id={`evidence-other-desc-create-${item.id}-${index}`} value={(item as EvidenceOther).description} onChange={e => updateEvidence(index, 'description', e.target.value)} placeholder="Description of evidence" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                            </div>
                                        )}
                                        <div className="space-y-1 sm:col-span-2">
                                            <Label htmlFor={`evidence-location-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Location Collected/Found</Label>
                                            <Textarea id={`evidence-location-create-${item.id}-${index}`} value={item.location} onChange={(e) => updateEvidence(index, 'location', e.target.value)} placeholder="Location details" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                        </div>
                                        <div className="space-y-1 sm:col-span-2">
                                            <Label htmlFor={`evidence-photolink-create-${item.id}-${index}`} className="text-xs text-muted-foreground">Photo/Bodycam Link (Optional)</Label>
                                            <Textarea
                                                id={`evidence-photolink-create-${item.id}-${index}`}
                                                value={item.photoLink || ''}
                                                onChange={(e) => updateEvidence(index, 'photoLink', e.target.value)}
                                                placeholder="https://example.com/evidence_photo.png"
                                                className="bg-input border-border text-sm py-1.5 px-3"
                                                rows={1}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addEvidenceRow} className="mt-2 bg-brand text-brand-foreground hover:bg-brand/90 border-0">
                                <Plus className="mr-2 h-3 w-3" /> Add Evidence
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Photos Card */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Photos (Links)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="photoSectionDescriptionCreate">Photo Section Description</Label>
                                <Textarea
                                    id="photoSectionDescriptionCreate"
                                    value={photoSectionDescription}
                                    onChange={(e) => setPhotoSectionDescription(e.target.value)}
                                    placeholder="Optional: Describe the photos linked below (e.g., crime scene photos, suspect identification photos)."
                                    className="bg-input border-border py-1.5 px-3"
                                    rows={1}
                                />
                            </div>
                            {photos.map((link, index) => (
                                <div key={index}>
                                    <div className="flex items-center gap-2">
                                        <Textarea
                                            value={link}
                                            onChange={(e) => updatePhotoLink(index, e.target.value)}
                                            placeholder="https://example.com/image.png"
                                            className="flex-grow bg-input border-border py-1.5 px-3"
                                            rows={1}
                                        />
                                        {photos.length > 1 && (
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removePhotoLink(index)} className="text-destructive hover:text-destructive/80 h-8 w-8" title="Remove Photo Link">
                                                <Trash2 className="h-4 w-4" />
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
                            <Button type="button" variant="outline" size="sm" onClick={addPhotoLink} className="mt-2 bg-brand text-brand-foreground hover:bg-brand/90 border-0">
                                <Plus className="mr-2 h-3 w-3" /> Add Photo Link
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Video Notes Card */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Bodycam/Dashcam/Video Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea id="videoNotesCreate" value={videoNotes} onChange={(e) => setVideoNotes(e.target.value)} placeholder="Add links to bodycam/dashcam footage, YouTube videos, or general notes about video evidence..." className="bg-input border-border py-1.5 px-3" rows={3} />
                        </CardContent>
                    </Card>

                    {/* Gang Info Card */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                         <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Gang Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea id="gangInfoCreate" value={gangInfo} onChange={(e) => setGangInfo(e.target.value)} placeholder="Details about gang involvement, if any..." className="bg-input border-border py-1.5 px-3" rows={3} />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="warrant" className="flex-grow flex flex-col space-y-6 pb-4 overflow-y-auto custom-scrollbar pr-4 pl-1">
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <h3 className="text-lg font-semibold text-white">Arrest Warrant Preview</h3>
                         <Button variant="outline" size="sm" onClick={handleRegenerateWarrantPreview} title="Regenerate text preview" className="bg-blue-600 hover:bg-blue-700 text-white border-blue-700">
                            <RefreshCw className="mr-2 h-3 w-3" /> Regenerate Preview
                        </Button>
                    </div>
                    <Textarea
                        readOnly
                        value={warrantText}
                        className="flex-grow w-full bg-input border-border font-mono text-xs whitespace-pre-line break-words py-1.5 px-3"
                        placeholder="Warrant text preview will be generated here based on case details..."
                        style={{ minHeight: '300px' }}
                    />
                    <p className="text-xs text-muted-foreground italic mt-1 shrink-0">
                        This is a simplified preview. DOCX/PDF export options will be available after the case is created (via Edit Case).
                    </p>
                </TabsContent>
            </Tabs>
            <div className="pt-6 mt-6 border-t-2 border-brand shrink-0 flex justify-end space-x-4">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting || isGeneratingDocx}>Cancel</Button>
                <Button type="button" onClick={handleSubmit} disabled={isSubmitting || isGeneratingDocx || !title.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <Save className="mr-2 h-4 w-4" />
                    {isSubmitting ? 'Creating Case...' : (initialDataForCase ? 'Convert Tip & Create Case' : 'Create Case')}
                </Button>
            </div>
        </div>
    );
};

export default CreateCaseModal;