import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { 
    Plus as LucidePlus, 
    Trash2 as LucideTrash, 
    AlertTriangle as LucideExclamationTriangle, 
    X as LucideTimes, 
    Send as LucidePaperPlane, 
    Search as LucideSearch 
} from 'lucide-react';
import { FaLightbulb } from 'react-icons/fa';
import { toast } from 'react-toastify';
import penalCodesData from './penal_codes.ts';
import { User } from '../../types/User';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext'; // Import useAuth
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'; // Add this import

// PenalCode interface (ensure it matches the structure in penal_codes.ts)
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
    // notes?: string; // Removed as per previous context
}
export interface EvidenceBlood extends BaseEvidenceItem { type: 'Blood'; name?: string; dnaCode?: string; }
export interface EvidenceCasing extends BaseEvidenceItem { type: 'Casing'; casingDetails?: string; registeredTo?: string; }
export interface EvidenceWeapon extends BaseEvidenceItem { type: 'Weapon'; weaponDetails?: string; registeredTo?: string; sourceOfCollection?: string; }
export interface EvidenceVehicle extends BaseEvidenceItem { type: 'Vehicle'; owner?: string; plate?: string; model?: string; }
export interface EvidenceFingerprint extends BaseEvidenceItem { type: 'Fingerprint'; name?: string; fingerprintId?: string; }
export interface EvidenceOther extends BaseEvidenceItem { type: 'Other'; description: string; }
export type EvidenceItem = EvidenceBlood | EvidenceCasing | EvidenceWeapon | EvidenceVehicle | EvidenceFingerprint | EvidenceOther;

// Helper function to check if an evidence item has any data
export const isEvidenceItemPopulated = (item: EvidenceItem): boolean => {
    if (item.location?.trim() || item.photoLink?.trim()) {
        return true;
    }
    switch (item.type) {
        case 'Blood': return !!(item.name?.trim() || item.dnaCode?.trim());
        case 'Vehicle': return !!(item.owner?.trim() || item.plate?.trim() || item.model?.trim());
        case 'Fingerprint': return !!(item.name?.trim() || item.fingerprintId?.trim());
        case 'Casing': return !!(item.casingDetails?.trim() || item.registeredTo?.trim());
        case 'Weapon': return !!(item.weaponDetails?.trim() || item.registeredTo?.trim() || item.sourceOfCollection?.trim());
        case 'Other': return !!item.description?.trim();
    }
    return false;
};


interface NameOfInterest { id: number; name: string; role: string; affiliation: string; cid?: string; phoneNumber?: string; }

export interface TipDetails {
    title: string;
    summary: string;
    incidentReport?: string;
    location?: string;
    namesOfInterest: NameOfInterest[];
    evidence: EvidenceItem[];
    photos: string[];
    photoSectionDescription?: string;
    gangInfo?: string;
    videoNotes?: string;
    charges: PenalCode[];
}

interface EligibleAssignee extends User {
    // No custom fields needed, User type is sufficient
}

interface SubmitCIUTipModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { tipDetails: TipDetails; assignee: EligibleAssignee | null; detectiveWorkedWith?: string }) => void;
    hideDetectiveAssignment?: boolean; // Add this prop
    detectiveWorkedWith?: string; // Add this prop for controlled input
    setDetectiveWorkedWith?: (val: string) => void; // Callback for controlled input
}

const SubmitCIUTipModal: React.FC<SubmitCIUTipModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    hideDetectiveAssignment,
    detectiveWorkedWith,
    setDetectiveWorkedWith
}) => {
    const { user: currentUser } = useAuth(); // Get current user
    const [title, setTitle] = useState('');
    const [summary, setSummary] = useState('');
    const [incidentReport, setIncidentReport] = useState('');
    const [location, setLocation] = useState('');
    const [namesOfInterest, setNamesOfInterest] = useState<NameOfInterest[]>([{ id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]);
    const [evidence, setEvidence] = useState<EvidenceItem[]>([{ id: Date.now(), type: 'Other', description: '', location: '', photoLink: '' }]);
    const [photos, setPhotos] = useState<string[]>(['']);
    const [photoSectionDescription, setPhotoSectionDescription] = useState('');
    const [gangInfo, setGangInfo] = useState('');
    const [videoNotes, setVideoNotes] = useState('');
    const [selectedCharges, setSelectedCharges] = useState<PenalCode[]>([]);
    const [chargeSearchTerm, setChargeSearchTerm] = useState('');
    const [chargeSearchResults, setChargeSearchResults] = useState<PenalCode[]>([]);
    const [allPenalCodes, setAllPenalCodes] = useState<PenalCode[]>([]);
    const [eligibleAssignees, setEligibleAssignees] = useState<EligibleAssignee[]>([]);
    const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
    const [loadingAssignees, setLoadingAssignees] = useState(true);

    useEffect(() => {
        setAllPenalCodes(penalCodesData as PenalCode[]);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        if (hideDetectiveAssignment) {
            setEligibleAssignees([]);
            setLoadingAssignees(false);
            return;
        }

        const fetchEligibleUsers = async () => {
            setLoadingAssignees(true);
            try {
                const usersRef = collection(dbFirestore, 'users');
                // Fetch users with CIU certification that allows assignment (e.g., CERT, TRAIN, LEAD, SUPER)
                // This might need adjustment based on exact CIU levels allowed to be assigned tips/cases
                const q = query(usersRef, where('isActive', '==', true), orderBy('name'));
                const querySnapshot = await getDocs(q);
                const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];

                const allowedCerts = ['CERT', 'TRAIN', 'SUPER', 'LEAD']; // Define who can be assigned
                const filteredUsers = usersData.filter(user => {
                    const cert = user.certifications?.CIU?.toUpperCase();
                    return cert && allowedCerts.includes(cert);
                });
                setEligibleAssignees(filteredUsers as EligibleAssignee[]);
            } catch (error) {
                console.error("Error fetching eligible assignees for tip:", error);
                toast.error("Failed to load eligible detectives.");
            } finally {
                setLoadingAssignees(false);
            }
        };

        fetchEligibleUsers();
    }, [isOpen, hideDetectiveAssignment]);

    const resetForm = useCallback(() => {
        setTitle('');
        setSummary('');
        setIncidentReport('');
        setLocation('');
        setNamesOfInterest([{ id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]);
        setEvidence([{ id: Date.now(), type: 'Other', description: '', location: '', photoLink: '' }]);
        setPhotos(['']);
        setPhotoSectionDescription('');
        setGangInfo('');
        setVideoNotes('');
        setSelectedCharges([]);
        setChargeSearchTerm('');
        setChargeSearchResults([]);
        setSelectedAssigneeId(null); // Reset selected assignee
    }, []);

    useEffect(() => {
        if (!isOpen) {
             // resetForm(); // Optionally reset form when closed, if not submitted.
        }
    }, [isOpen, resetForm]);


    const handleChargeSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setChargeSearchTerm(term);
        if (term.trim() === '') {
            setChargeSearchResults([]);
            return;
        }
        const lowerCaseSearchTerm = term.toLowerCase();
        const filtered = allPenalCodes.filter(code =>
            code.pc.toLowerCase().includes(lowerCaseSearchTerm) ||
            code.title.toLowerCase().includes(lowerCaseSearchTerm) ||
            code.description.toLowerCase().includes(lowerCaseSearchTerm)
        );
        setChargeSearchResults(filtered.slice(0, 10)); // Show more results
    };

    const addCharge = (charge: PenalCode) => {
        if (!selectedCharges.some(c => c.pc === charge.pc)) {
            setSelectedCharges([...selectedCharges, charge]);
        }
        setChargeSearchTerm('');
        setChargeSearchResults([]);
    };

    const removeCharge = (pcCode: string) => {
        setSelectedCharges(selectedCharges.filter(charge => charge.pc !== pcCode));
    };

    const addNameRow = () => setNamesOfInterest([...namesOfInterest, { id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]);
    const updateName = (index: number, field: keyof NameOfInterest, value: string) => {
        const updated = [...namesOfInterest];
        updated[index] = { ...updated[index], [field]: value };
        setNamesOfInterest(updated);
    };
    const removeNameRow = (index: number) => setNamesOfInterest(namesOfInterest.filter((_, i) => i !== index));

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
                case 'Blood': updated[index] = { ...baseProperties, type: 'Blood', name: '', dnaCode: '' }; break;
                case 'Vehicle': updated[index] = { ...baseProperties, type: 'Vehicle', owner: '', plate: '', model: '' }; break;
                case 'Fingerprint': updated[index] = { ...baseProperties, type: 'Fingerprint', name: '', fingerprintId: '' }; break;
                case 'Casing': updated[index] = { ...baseProperties, type: 'Casing', casingDetails: '', registeredTo: '' }; break;
                case 'Weapon': updated[index] = { ...baseProperties, type: 'Weapon', weaponDetails: '', registeredTo: '', sourceOfCollection: '' }; break;
                case 'Other': default: updated[index] = { ...baseProperties, type: 'Other', description: '' }; break;
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


    const handleSubmit = () => {
        if (!summary.trim()) {
            toast.error("Summary is required to submit a tip.");
            return;
        }
        // Allow submission if public (hideDetectiveAssignment), even if not logged in
        if (!currentUser && !hideDetectiveAssignment) {
            toast.error("Authentication error. Please log in again.");
            return;
        }

        const tipDetails: TipDetails = {
            title: title.trim(), 
            summary: summary.trim(),
            incidentReport: incidentReport.trim(),
            location: location.trim(),
            namesOfInterest: namesOfInterest.filter(n => n.name.trim() || n.role.trim() || n.affiliation.trim() || n.cid?.trim() || n.phoneNumber?.trim()),
            evidence: evidence.filter(isEvidenceItemPopulated),
            photos: photos.filter(p => p.trim()),
            photoSectionDescription: photoSectionDescription.trim(),
            gangInfo: gangInfo.trim(),
            videoNotes: videoNotes.trim(),
            charges: selectedCharges,
        };

        const selectedAssignee = eligibleAssignees.find(a => a.id === selectedAssigneeId) || null;

        onSubmit({
            tipDetails,
            assignee: selectedAssignee,
            detectiveWorkedWith: detectiveWorkedWith // Pass up if present
        }); 
        // resetForm(); // Sidebar will close the modal, which can trigger reset if needed
        // onClose(); // Let Sidebar control closing
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { 
            // Only call onClose if the dialog is being explicitly closed by our buttons.
            // This onOpenChange will still be triggered by Escape/outside click if not prevented below,
            // but we won't act on it unless 'open' is true (which means it's not a close request).
            // If 'open' is false, it means an attempt to close was made.
            // We let the explicit buttons handle calling onClose.
            if (open === false) {
                // If we want to allow Radix to control the state for its internal logic
                // but not propagate our main onClose, we could do nothing here.
                // However, to be safe and ensure our onClose is the sole trigger from our side:
                // We will prevent default on DialogContent for escape and outside click.
            }
        }}>
            <DialogContent
                onEscapeKeyDown={(e) => e.preventDefault()} // Prevent closing on Escape key
                onPointerDownOutside={(e) => e.preventDefault()} // Prevent closing on outside click
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] sm:max-w-none max-h-[95vh] overflow-hidden case-details-modal-root mx-auto p-6 sm:p-8 md:p-12 bg-card text-foreground rounded-lg shadow-2xl border-brand border-2 flex flex-col"
            >
                <Button variant="ghost" size="icon" className="absolute top-4 right-4 sm:top-6 sm:right-6 text-muted-foreground hover:text-foreground z-10" onClick={() => { onClose(); resetForm(); }}>
                    <LucideTimes className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                </Button>
                {/* Accessibility: Always render a DialogTitle and DialogDescription */}
                <VisuallyHidden>
                    <DialogTitle>Submit CIU Tip</DialogTitle>
                    <DialogDescription>
                        Submit a tip to the Criminal Investigations Unit. Required: summary.
                    </DialogDescription>
                </VisuallyHidden>
                <div className="pb-6 mb-6 border-b-2 border-brand shrink-0">
                    <h2 className="text-2xl md:text-3xl font-semibold text-brand flex items-center">
                        <FaLightbulb className="mr-3 text-brand" /> Submit CIU Tip
                    </h2>
                    <p className="text-muted-foreground mt-2">
                        This information will be used to create a new case file. Your name ({currentUser?.name || 'Current User'}) will be recorded as the submitter.
                    </p>
                </div>
                <div className="flex-grow space-y-8 pb-4 overflow-y-auto custom-scrollbar pr-4 pl-1">
                    {/* Core Information */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Core Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="tip-title">Tip Title (Optional)</Label>
                                    <Input id="tip-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Suspicious Activity at Pier" className="bg-input border-border" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tip-incidentReport">Incident Report # (If known)</Label>
                                    <Input id="tip-incidentReport" value={incidentReport} onChange={(e) => setIncidentReport(e.target.value)} placeholder="e.g., 2023-12345" className="bg-input border-border" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tip-location">Location (If applicable)</Label>
                                <Input id="tip-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Vespucci Beach Pier" className="bg-input border-border" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tip-summary">Summary *</Label>
                                <Textarea id="tip-summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Detailed summary of the tip..." rows={4} className="bg-input border-border" required />
                            </div>
                        </CardContent>
                    </Card>
                    {/* Names of Interest */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Names of Interest</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {namesOfInterest.map((item, index) => (
                                <div key={item.id} className="p-4 border border-border/60 rounded-md space-y-4 relative bg-input/30">
                                    {namesOfInterest.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeNameRow(index)} className="absolute top-1 right-1 text-destructive hover:text-destructive/80 h-7 w-7" title="Remove Person">
                                            <LucideTrash className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Name</Label>
                                            <Input value={item.name} onChange={(e) => updateName(index, 'name', e.target.value)} placeholder="Full Name" className="bg-input border-border text-sm" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">CID#</Label>
                                            <Input value={item.cid || ''} onChange={(e) => updateName(index, 'cid', e.target.value)} placeholder="CID (Optional)" className="bg-input border-border text-sm" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Phone Number</Label>
                                            <Input value={item.phoneNumber || ''} onChange={(e) => updateName(index, 'phoneNumber', e.target.value)} placeholder="Phone (Optional)" className="bg-input border-border text-sm" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Role</Label>
                                            <Input value={item.role} onChange={(e) => updateName(index, 'role', e.target.value)} placeholder="Role (Suspect, Witness)" className="bg-input border-border text-sm" />
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <Label className="text-xs text-muted-foreground">Gang Affiliation / Notes</Label>
                                            <Textarea value={item.affiliation} onChange={(e) => updateName(index, 'affiliation', e.target.value)} placeholder="Gang Name or relevant notes" className="bg-input border-border text-sm" rows={1} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addNameRow} className="mt-2 bg-brand text-brand-foreground hover:bg-brand/90 border-0">
                                <LucidePlus className="mr-2 h-3 w-3" /> Add Person
                            </Button>
                        </CardContent>
                    </Card>
                    {/* Evidence */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Evidence</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {evidence.map((item, index) => (
                                <div key={item.id} className="p-4 border border-border/60 rounded-md space-y-4 relative bg-input/30">
                                    {evidence.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEvidenceRow(index)} className="absolute top-1 right-1 text-destructive hover:text-destructive/80 h-7 w-7" title="Remove Evidence">
                                            <LucideTrash className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <div className="space-y-1 mb-4">
                                        <Label htmlFor={`evidence-type-tip-${item.id}-${index}`} className="text-xs text-muted-foreground">Type</Label>
                                        <Select
                                            value={item.type}
                                            onValueChange={(value: EvidenceItem['type']) => updateEvidence(index, 'type', value)}
                                        >
                                            <SelectTrigger id={`evidence-type-tip-${item.id}-${index}`} className="bg-input border-border h-9 text-sm w-full">
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
                                                    <Label className="text-xs text-muted-foreground">Name (Person)</Label>
                                                    <Input value={item.name || ''} onChange={e => updateEvidence(index, 'name', e.target.value)} placeholder="Name (Person)" className="bg-input border-border text-sm" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">DNA Code</Label>
                                                    <Input value={item.dnaCode || ''} onChange={e => updateEvidence(index, 'dnaCode', e.target.value)} placeholder="DNA Code" className="bg-input border-border text-sm" />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Casing' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Casing Details (Caliber, Markings)</Label>
                                                    <Input value={item.casingDetails || ''} onChange={e => updateEvidence(index, 'casingDetails', e.target.value)} placeholder="Casing Details (Caliber, Markings)" className="bg-input border-border text-sm" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Registered To (Weapon, if known)</Label>
                                                    <Input value={item.registeredTo || ''} onChange={e => updateEvidence(index, 'registeredTo', e.target.value)} placeholder="Registered To (Weapon, if known)" className="bg-input border-border text-sm" />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Weapon' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Weapon Details (Type, Model, SN)</Label>
                                                    <Input value={item.weaponDetails || ''} onChange={e => updateEvidence(index, 'weaponDetails', e.target.value)} placeholder="Weapon Details (Type, Model, SN)" className="bg-input border-border text-sm" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Registered To</Label>
                                                    <Input value={item.registeredTo || ''} onChange={e => updateEvidence(index, 'registeredTo', e.target.value)} placeholder="Registered To" className="bg-input border-border text-sm" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Source of Collection</Label>
                                                    <Input value={item.sourceOfCollection || ''} onChange={e => updateEvidence(index, 'sourceOfCollection', e.target.value)} placeholder="Source of Collection" className="bg-input border-border text-sm" />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Vehicle' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Owner</Label>
                                                    <Input value={item.owner || ''} onChange={e => updateEvidence(index, 'owner', e.target.value)} placeholder="Owner" className="bg-input border-border text-sm" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Plate</Label>
                                                    <Input value={item.plate || ''} onChange={e => updateEvidence(index, 'plate', e.target.value)} placeholder="Plate" className="bg-input border-border text-sm" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Model</Label>
                                                    <Input value={item.model || ''} onChange={e => updateEvidence(index, 'model', e.target.value)} placeholder="Model" className="bg-input border-border text-sm" />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Fingerprint' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Name (Person)</Label>
                                                    <Input value={item.name || ''} onChange={e => updateEvidence(index, 'name', e.target.value)} placeholder="Name (Person)" className="bg-input border-border text-sm" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Fingerprint ID</Label>
                                                    <Input value={item.fingerprintId || ''} onChange={e => updateEvidence(index, 'fingerprintId', e.target.value)} placeholder="Fingerprint ID" className="bg-input border-border text-sm" />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Other' && (
                                            <div className="space-y-1 sm:col-span-2">
                                                <Label className="text-xs text-muted-foreground">Evidence Details</Label>
                                                <Input value={item.description} onChange={e => updateEvidence(index, 'description', e.target.value)} placeholder="Description of evidence" className="bg-input border-border text-sm" />
                                            </div>
                                        )}
                                        <div className="space-y-1 sm:col-span-2">
                                            <Label className="text-xs text-muted-foreground">Location Collected/Found</Label>
                                            <Input value={item.location} onChange={e => updateEvidence(index, 'location', e.target.value)} placeholder="Location Collected/Found" className="bg-input border-border text-sm" />
                                        </div>
                                        <div className="space-y-1 sm:col-span-2">
                                            <Label className="text-xs text-muted-foreground">Photo/Bodycam Link (Optional)</Label>
                                            <Input value={item.photoLink || ''} onChange={e => updateEvidence(index, 'photoLink', e.target.value)} placeholder="Photo/Bodycam Link (Optional)" className="bg-input border-border text-sm" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addEvidenceRow} className="mt-2 bg-brand text-brand-foreground hover:bg-brand/90 border-0">
                                <LucidePlus className="mr-2 h-3 w-3" /> Add Evidence
                            </Button>
                        </CardContent>
                    </Card>
                    {/* Photos */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Photos (Links)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="photoSectionDescription">Photo Section Description</Label>
                                <Textarea id="photoSectionDescription" value={photoSectionDescription} onChange={(e) => setPhotoSectionDescription(e.target.value)} placeholder="Optional: Describe the photos linked below" className="bg-input border-border text-sm" rows={1}/>
                            </div>
                            {photos.map((link, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input value={link} onChange={(e) => updatePhotoLink(index, e.target.value)} placeholder="https://example.com/image.png" className="flex-grow bg-input border-border text-sm" />
                                    {photos.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removePhotoLink(index)} className="text-destructive hover:text-destructive/80 h-9 w-9"><LucideTrash className="h-4 w-4" /></Button>
                                    )}
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addPhotoLink} className="mt-2 bg-brand text-brand-foreground hover:bg-brand/90 border-0">
                                <LucidePlus className="mr-2 h-3 w-3" /> Add Photo Link
                            </Button>
                        </CardContent>
                    </Card>
                    {/* Additional Details */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Additional Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="tip-videoNotes" className="text-muted-foreground">Bodycam/Video Notes</Label>
                                <Textarea id="tip-videoNotes" value={videoNotes} onChange={(e) => setVideoNotes(e.target.value)} placeholder="Links to footage, timestamps, descriptions..." className="bg-input border-border" rows={2}/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tip-gangInfo" className="text-muted-foreground">Gang Information</Label>
                                <Textarea id="tip-gangInfo" value={gangInfo} onChange={(e) => setGangInfo(e.target.value)} placeholder="Known gang affiliations, activities, etc." className="bg-input border-border" rows={2}/>
                            </div>
                        </CardContent>
                    </Card>
                    {/* Potential Charges */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Potential Charges (Optional)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <div className="flex items-center">
                                    <LucideSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 mt-px" />
                                    <Input 
                                        type="text" 
                                        placeholder="Search Penal Codes..." 
                                        value={chargeSearchTerm} 
                                        onChange={e => {
                                            const term = e.target.value;
                                            setChargeSearchTerm(term);
                                            if (term.trim() === '') {
                                                setChargeSearchResults([]);
                                                return;
                                            }
                                            const lowerCaseSearchTerm = term.toLowerCase();
                                            const filtered = allPenalCodes.filter(code =>
                                                code.pc.toLowerCase().includes(lowerCaseSearchTerm) ||
                                                code.title.toLowerCase().includes(lowerCaseSearchTerm) ||
                                                code.description.toLowerCase().includes(lowerCaseSearchTerm)
                                            );
                                            setChargeSearchResults(filtered.slice(0, 10));
                                        }}
                                        className="bg-input border-border pl-10" 
                                    />
                                </div>
                                {chargeSearchResults.length > 0 && (
                                    <div className="absolute z-20 w-full mt-1 bg-popover border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                        {chargeSearchResults.map(code => (
                                            <div key={code.pc} className="px-3 py-2 hover:bg-muted cursor-pointer text-sm" onClick={() => {
                                                if (!selectedCharges.some(c => c.pc === code.pc)) {
                                                    setSelectedCharges([...selectedCharges, code]);
                                                }
                                                setChargeSearchTerm('');
                                                setChargeSearchResults([]);
                                            }}>
                                                <p className="font-semibold">{code.pc} - {code.title}</p>
                                                <p className="text-xs text-muted-foreground truncate">{code.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {selectedCharges.length > 0 && (
                                <div className="space-y-1">
                                    {selectedCharges.map(charge => (
                                        <div key={charge.pc} className="flex justify-between items-center p-2 bg-input/50 rounded text-sm">
                                            <span>{charge.pc}: {charge.title}</span>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedCharges(selectedCharges.filter(c => c.pc !== charge.pc))} className="text-destructive hover:text-destructive/80 h-7 w-7"><LucideTrash className="h-3.5 w-3.5" /></Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    {/* Free-type detective worked with (public only) */}
                    {hideDetectiveAssignment && (
                        <Card className="bg-card-foreground/5 border-border shadow-sm">
                            <CardHeader className="pt-6">
                                <CardTitle className="text-lg text-foreground">Detective Worked With (Optional)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Input
                                    type="text"
                                    placeholder="Detective's name or callsign, if any"
                                    value={detectiveWorkedWith || ''}
                                    onChange={e => setDetectiveWorkedWith?.(e.target.value)}
                                    className="bg-input border-border"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    If you worked with a detective, enter their name or callsign here.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                    {/* Assign to Detective */}
                    {!hideDetectiveAssignment && (
                        <Card className="bg-card-foreground/5 border-border shadow-sm">
                            <CardHeader className="pt-6">
                                <CardTitle className="text-lg text-foreground">If you worked with a detective, select them (Optional)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Select 
                                    value={selectedAssigneeId || "none"} 
                                    onValueChange={(value) => setSelectedAssigneeId(value === "none" ? null : value)}
                                    disabled={loadingAssignees}
                                >
                                    <SelectTrigger id="assign-detective" className="bg-input border-border">
                                        <SelectValue placeholder={loadingAssignees ? "Loading detectives..." : "Select a detective or 'None'"} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border text-popover-foreground">
                                        <SelectItem value="none">None (Create as Unassigned Case)</SelectItem>
                                        {eligibleAssignees.map(user => (
                                            user.id && (
                                                <SelectItem key={user.id} value={user.id}>
                                                    {user.name} ({user.callsign || 'N/A'}) - CIU: {user.certifications?.CIU || 'N/A'}
                                                </SelectItem>
                                            )
                                        ))}
                                    </SelectContent>
                                </Select>
                                {loadingAssignees && <p className="text-xs text-muted-foreground italic mt-1">Loading available detectives...</p>}
                            </CardContent>
                        </Card>
                    )}
                </div>
                <DialogFooter className="pt-6 mt-6 border-t-2 border-brand shrink-0 flex justify-end space-x-4">
                    <Button type="button" variant="outline" onClick={() => { onClose(); resetForm(); }}>Cancel</Button>
                    <Button type="button" onClick={handleSubmit} disabled={!summary.trim()} className="bg-brand hover:bg-brand/90 text-brand-foreground">
                        <LucidePaperPlane className="mr-2 h-4 w-4" /> Submit Tip as Case
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SubmitCIUTipModal;
