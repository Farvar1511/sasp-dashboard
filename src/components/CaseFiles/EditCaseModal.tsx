import React, { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, serverTimestamp, Timestamp, FieldValue } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { CaseFile, CaseStatus } from '../../utils/ciuUtils';
import { formatTimestampForDisplay } from '../../utils/timeHelpers';
import { computeIsAdmin } from '../../utils/isadmin.ts';
import { User } from '../../types/User';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { toast } from 'react-toastify';
import { FaTrash, FaPlus, FaTimes, FaSave, FaFileWord, FaFilePdf, FaSync, FaSearch, FaEdit, FaCheck, FaBan } from 'react-icons/fa';
import penalCodesData from './penal_codes.ts';
import jsPDF from 'jspdf';
import { Packer, Document, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, HeadingLevel, WidthType, BorderStyle, VerticalAlign, ImageRun, UnderlineType } from 'docx';
import { saveAs } from 'file-saver';


interface PenalCode {
    pc: string;
    offense_class: string;
    title: string;
    description: string;
    fine: number;
    prison_time_months: number;
}

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
interface CaseUpdate { id: string | number; timestamp: Timestamp | Date; userId: string; userName: string; note: string; edited?: boolean; }

interface EditCaseModalProps {
  isOpen: boolean; // This prop might not be needed if modal visibility is handled by parent through conditional rendering
  // currentUser: User | null; // This can be obtained from useAuth
  // allUsers: User[]; // This might be better fetched within or passed if static
  onClose: () => void;
  onSaveSuccess: () => void;
  caseData: CaseFile;
  eligibleAssignees: User[];
}

const EditCaseModal: React.FC<EditCaseModalProps> = ({ onClose, onSaveSuccess, caseData, eligibleAssignees }) => {
    const { user: currentUser } = useAuth();
    const isAdmin = useMemo(() => computeIsAdmin(currentUser), [currentUser]);

    const [title, setTitle] = useState(caseData.title);
    const [incidentReport, setIncidentReport] = useState('');
    const [summary, setSummary] = useState(caseData.description || '');
    const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
    const [photos, setPhotos] = useState<string[]>(caseData.imageLinks || ['']);
    const [photoSectionDescription, setPhotoSectionDescription] = useState<string>('');
    const [location, setLocation] = useState('');
    const [namesOfInterest, setNamesOfInterest] = useState<NameOfInterest[]>([]);
    const [gangInfo, setGangInfo] = useState('');
    const [videoNotes, setVideoNotes] = useState<string>('');
    const [status, setStatus] = useState<CaseStatus>(caseData.status);
    const [assignedToId, setAssignedToId] = useState<string | null>(caseData.assignedToId ?? null);
    const [updates, setUpdates] = useState<CaseUpdate[]>([]);
    const [newNote, setNewNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [warrantText, setWarrantText] = useState('');
    const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);

    const [editingUpdateId, setEditingUpdateId] = useState<string | number | null>(null);
    const [editedUpdateText, setEditedUpdateText] = useState<string>('');

    const [penalCodes, setPenalCodes] = useState<PenalCode[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [searchResults, setSearchResults] = useState<PenalCode[]>([]);
    const [selectedCharges, setSelectedCharges] = useState<PenalCode[]>([]);

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

    useEffect(() => {
        if (caseData.details) {
            try {
                const details = JSON.parse(caseData.details);
                setIncidentReport(details.incidentReport || '');
                setEvidence(details.evidence?.length
                    ? details.evidence.map((e: any): EvidenceItem => {
                        const base: BaseEvidenceItem = { // Explicitly type base
                            id: e.id || Date.now(),
                            location: e.location || '',
                            photoLink: e.photoLink || '',
                        };

                        let currentType = e.type;
                        if (!currentType || !['Blood', 'Casing', 'Weapon', 'Vehicle', 'Fingerprint', 'Other'].includes(currentType)) {
                            currentType = 'Other';
                        }

                        switch (currentType) {
                            case 'Blood': return { ...base, type: 'Blood', name: e.name || '', dnaCode: e.dnaCode || '' };
                            case 'Vehicle': return { ...base, type: 'Vehicle', owner: e.owner || '', plate: e.plate || '', model: e.model || '' };
                            case 'Fingerprint': return { ...base, type: 'Fingerprint', name: e.name || '', fingerprintId: e.fingerprintId || '' };
                            case 'Casing': return { ...base, type: 'Casing', casingDetails: e.casingDetails || e.description || '', registeredTo: e.registeredTo || '' };
                            case 'Weapon': return { ...base, type: 'Weapon', weaponDetails: e.weaponDetails || e.description || '', registeredTo: e.registeredTo || '', sourceOfCollection: e.sourceOfCollection || '' };
                            case 'Other': 
                            default:    
                                return { ...base, type: 'Other', description: e.description || '' };
                        }
                      })
                    : [{ id: Date.now(), type: 'Other', description: '', location: '', photoLink: '' }] as EvidenceItem[]);
                setNamesOfInterest(details.namesOfInterest?.length
                    ? details.namesOfInterest.map((n: any) => ({ ...n, id: n.id || Date.now(), cid: n.cid || '', phoneNumber: n.phoneNumber || '' }))
                    : [{ id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]
                );
                setLocation(details.location || '');
                setGangInfo(details.gangInfo || '');
                setVideoNotes(details.videoNotes || '');
                setUpdates(details.updates?.map((u: any, index: number) => ({
                    ...u,
                    id: u.id || (u.timestamp?.toMillis ? u.timestamp.toMillis() : `initial-${Date.now()}-${index}`), // Ensure ID exists
                    timestamp: u.timestamp?.toDate ? u.timestamp.toDate() : (u.timestamp instanceof Date ? u.timestamp : new Date()),
                })) || []);
                setSelectedCharges(details.charges || []);
                setPhotoSectionDescription(details.photoSectionDescription || '');
            } catch (e) {
                console.error("Failed to parse case details JSON:", e);
                toast.error("Error loading case details. Some information might be missing or corrupted.");
                setEvidence([{ id: Date.now(), type: 'Other', description: '', location: '', photoLink: '' }]);
                setNamesOfInterest([{ id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]);
                setUpdates([]);
                setSelectedCharges([]);
                setVideoNotes('');
                setPhotoSectionDescription('');
            }
        } else {
             setEvidence([{ id: Date.now(), type: 'Other', description: '', location: '', photoLink: '' }]);
             setNamesOfInterest([{ id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]);
             setUpdates([]);
             setSelectedCharges([]);
             setVideoNotes('');
             setPhotoSectionDescription('');
        }
        setPhotos(caseData.imageLinks?.length ? caseData.imageLinks : ['']);
        setAssignedToId(caseData.assignedToId ?? null);
        setTitle(caseData.title); // Ensure title is reset if caseData changes
        setSummary(caseData.description || ''); // Ensure summary is reset
        setStatus(caseData.status); // Ensure status is reset
    }, [caseData]);

    useEffect(() => {
        setWarrantText(generateWarrantTextPreview());
    }, [title, incidentReport, location, summary, namesOfInterest, evidence, photos, photoSectionDescription, gangInfo, videoNotes, selectedCharges, currentUser, caseData.id]);

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

    const handleAssigneeChange = (value: string) => {
        const newAssigneeId = value === "unassigned" ? null : value;
        setAssignedToId(newAssigneeId);
        if (newAssigneeId && status === 'Open - Unassigned') {
            setStatus('Open - Assigned');
        } else if (!newAssigneeId && status === 'Open - Assigned') {
            // If unassigning from 'Open - Assigned', revert to 'Open - Unassigned'
            setStatus('Open - Unassigned');
        } else if (!newAssigneeId && (status === 'Closed - Solved' || status === 'Closed - Unsolved' || status === 'Under Review')) {
            // If unassigning from a closed/review status, it's okay, just remove assignee
        }
    };

    const handleStatusChange = (value: CaseStatus) => {
        setStatus(value);
        if (value === 'Open - Unassigned' && assignedToId) {
            // If changing to 'Open - Unassigned', clear assignee
            setAssignedToId(null);
        }
        if (value === 'Open - Assigned' && !assignedToId) {
            // If changing to 'Open - Assigned' without an assignee, revert to 'Open - Unassigned' and toast
            setStatus('Open - Unassigned');
            toast.info("Select an assignee to set status to 'Open - Assigned'.");
        }
    };

    const canModifyUpdate = (update: CaseUpdate): boolean => {
        if (!currentUser) return false;
        if (isAdmin) return true; // Admin can always modify
        if (update.userId === currentUser.id) return true; // User can modify their own updates
        // Allow CIU Lead/Super to modify any update
        const ciuCert = currentUser.certifications?.['CIU'];
        if (ciuCert === 'LEAD' || ciuCert === 'SUPER') return true;
        return false;
    };

    const handleEditUpdateClick = (update: CaseUpdate) => {
        setEditingUpdateId(update.id);
        setEditedUpdateText(update.note);
    };

    const handleCancelEditUpdate = () => {
        setEditingUpdateId(null);
        setEditedUpdateText('');
    };

    const handleSaveEditUpdate = async () => {
        if (editingUpdateId === null || !currentUser) return;

        const originalUpdates = [...updates]; // Keep a copy in case save fails
        const updatedUpdates = updates.map(u =>
            u.id === editingUpdateId
                ? { ...u, note: editedUpdateText, edited: true, timestamp: new Date() } // Mark as edited and update timestamp
                : u
        );
        setUpdates(updatedUpdates); // Optimistically update UI
        setEditingUpdateId(null);
        setEditedUpdateText('');

        // Attempt to save the entire case with the updated 'updates' array
        const success = await handleSave(false, updatedUpdates); // Pass false to not close modal, pass updated array

        if (!success) {
            setUpdates(originalUpdates); // Revert UI on failure
            toast.error("Failed to save update edit.");
        } else {
            toast.success("Update edited successfully.");
        }
    };
    
    const handleDeleteUpdateClick = async (updateId: string | number) => {
        if (!currentUser) return;
        if (!window.confirm("Are you sure you want to delete this update? This cannot be undone.")) {
            return;
        }

        const originalUpdates = [...updates];
        const updatedUpdates = updates.filter(u => u.id !== updateId);
        setUpdates(updatedUpdates); // Optimistically update UI

        const success = await handleSave(false, updatedUpdates); // Save with the modified updates array

        if (!success) {
            setUpdates(originalUpdates); // Revert UI on failure
            toast.error("Failed to delete update.");
        } else {
            toast.success("Update deleted successfully.");
        }
    };


    const handleSave = async (closeOnSuccess: boolean = true, updatesToSave?: CaseUpdate[]): Promise<boolean> => {
        if (!currentUser || !caseData.id) {
            toast.error("Cannot save changes. User or Case ID missing.");
            return false;
        }
        if (!title.trim()) {
            toast.error("Case Title is required.");
            return false;
        }
        setIsSaving(true);

        const assignedUser = eligibleAssignees.find(u => u.id === assignedToId);

        let finalUpdatesForUI = updatesToSave ? [...updatesToSave] : [...updates];
        let newUpdateEntryForFirestore: any = null;
        let temporaryIdForNewNote: string | null = null;

        // If not saving a specific set of updates (e.g., from edit/delete) AND newNote has content
        if (!updatesToSave && newNote.trim()) {
             temporaryIdForNewNote = `temp-${Date.now()}`; // Create a temporary ID for UI
             newUpdateEntryForFirestore = { // This is the object that will be structured for Firestore
                userId: currentUser?.id || 'Unknown',
                userName: currentUser?.name || 'Unknown',
                note: newNote.trim(),
                // timestamp will be serverTimestamp()
                edited: false, // New notes are not edited
            };
            // Add to UI optimistically with a client-side timestamp
            finalUpdatesForUI.push({
                ...newUpdateEntryForFirestore,
                id: temporaryIdForNewNote, // Use temporary ID for UI key
                timestamp: new Date() // Client-side timestamp for immediate display
            });

            // If we are not closing on success (i.e., just adding a note), update UI state
            if (!closeOnSuccess) {
                setUpdates(finalUpdatesForUI);
                setNewNote(''); // Clear input after adding
            }
        }
        
        // Prepare updates for Firestore: use serverTimestamp for new/edited notes
        const updatesForFirestore = finalUpdatesForUI.map(u => {
            const { id, ...rest } = u; // Exclude client-side 'id' from Firestore object if it's temporary
            let timestampValue: Timestamp | FieldValue;

            // If it's the new note we just added, or an update being edited now
            if (id.toString().startsWith('temp-') || (editingUpdateId === id && updatesToSave)) {
                timestampValue = serverTimestamp();
            } else if (u.timestamp instanceof Date) { // Existing notes with Date objects
                timestampValue = Timestamp.fromDate(u.timestamp);
            } else { // Already a Firestore Timestamp
                timestampValue = u.timestamp;
            }
            
            return {
                ...rest, // Spread the rest of the update properties (userId, userName, note, edited)
                timestamp: timestampValue,
                // Ensure 'edited' flag is correctly set if this update was just edited
                edited: (editingUpdateId === id && updatesToSave) ? true : (u.edited || false)
            };
        });


        const updatedDetailsObject = {
            incidentReport,
            evidence: evidence.filter(isEvidenceItemPopulated),
            photos: photos.filter(p => p.trim()),
            photoSectionDescription,
            location,
            namesOfInterest: namesOfInterest.filter(n => n.name.trim() || n.role.trim() || n.affiliation.trim() || n.cid?.trim() || n.phoneNumber?.trim()),
            gangInfo,
            videoNotes,
            charges: selectedCharges,
            updates: updatesForFirestore // Use the processed updates for Firestore
        };

        const updateData: Partial<CaseFile> & { details: string; updatedAt: FieldValue } = {
            title: title.trim(),
            description: summary.trim(),
            status,
            assignedToId: assignedToId,
            assignedToName: assignedUser?.name || null,
            imageLinks: updatedDetailsObject.photos, // Ensure this is just an array of strings
            details: JSON.stringify(updatedDetailsObject),
            updatedAt: serverTimestamp(),
        };

        try {
            const caseRef = doc(dbFirestore, 'caseFiles', caseData.id);
            await updateDoc(caseRef, updateData as any); // Use 'as any' if type conflicts persist with FieldValue

            if (closeOnSuccess) {
                toast.success(`Case "${title.trim()}" updated successfully.`);
                onSaveSuccess(); // Callback to refresh data in parent
                onClose(); // Close modal
            } else {
                 // If not closing, and a new note was added, clear the input
                 if (newUpdateEntryForFirestore) { // Check if a new note was part of this save
                    setNewNote('');
                 }
                 // Refresh parent data even if not closing (e.g., after adding a note)
                 onSaveSuccess(); 
            }
            return true; // Indicate success

        } catch (error) {
            console.error("Error updating case file:", error);
            toast.error("Failed to update case file.");
            // If save failed and we optimistically added a new note to UI, remove it
            if (temporaryIdForNewNote && !closeOnSuccess) {
                 setUpdates(prev => prev.filter(u => u.id !== temporaryIdForNewNote));
            }
            return false; // Indicate failure
        } finally {
            setIsSaving(false);
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
**Case ID:** ${caseData.id || '[Case ID]'}
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

    const handleRegenerateWarrantPreview = () => {
        setWarrantText(generateWarrantTextPreview());
        toast.info("Warrant preview regenerated.");
    };

    const fetchImage = async (url: string): Promise<ArrayBuffer | null> => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.arrayBuffer();
        } catch (error) {
            console.error("Error fetching image:", error);
            toast.error(`Failed to load image for warrant: ${url}`);
            return null;
        }
    };

    const exportAsDocx = async () => {
        setIsGeneratingDocx(true);
        toast.info("Generating DOCX warrant...");

        const imageUrl = '/images/image1.png';
        const imageBuffer = await fetchImage(imageUrl);

        const primarySuspect = namesOfInterest.find(n => n.role?.toLowerCase().includes('suspect'));
        const suspectName = primarySuspect?.name || '[Suspect Name]';
        const suspectCID = primarySuspect?.cid || '[CID#]';
        const officerName = currentUser?.name || '[Officer Name]';
        const criminalCodes = selectedCharges.map(charge => ({
            code: charge.pc,
            title: charge.title
        }));
        if (criminalCodes.length === 0) {
            criminalCodes.push({ code: '[No Charges]', title: '[No Charges Listed]' });
        }

        const evidenceList = evidence
            .filter(isEvidenceItemPopulated)
            .map(item => {
                let descriptionForDocx = '';
                switch (item.type) {
                    case 'Blood':
                        descriptionForDocx = `Name: ${item.name || 'N/A'}, DNA: ${item.dnaCode || 'N/A'}.`;
                        break;
                    case 'Weapon':
                        descriptionForDocx = `Details: ${item.weaponDetails || 'N/A'}. Registered To: ${item.registeredTo || 'N/A'}. Source: ${item.sourceOfCollection || 'N/A'}.`;
                        break;
                    case 'Vehicle':
                        descriptionForDocx = `Owner: ${item.owner || 'N/A'}, Plate: ${item.plate || 'N/A'}, Model: ${item.model || 'N/A'}.`;
                        break;
                    case 'Fingerprint':
                        descriptionForDocx = `Name: ${item.name || 'N/A'}, ID: ${item.fingerprintId || 'N/A'}.`;
                        break;
                    case 'Casing':
                        descriptionForDocx = `Details: ${item.casingDetails || 'N/A'}. Registered To (Weapon): ${item.registeredTo || 'N/A'}.`;
                        break;
                    case 'Other':
                        descriptionForDocx = item.description || 'N/A';
                        break;
                }
                return {
                    type: item.type,
                    description: descriptionForDocx,
                    location: item.location || 'N/A',
                    // notes: item.notes || '', // Removed
                    photoLink: item.photoLink || '',
                };
            });
        const witnessList = namesOfInterest
            .filter(n => n.role?.toLowerCase().includes('witness'))
            .map(w => ({
                name: w.name,
                cid: w.cid || 'N/A',
                phone: w.phoneNumber || 'N/A'
            }));

        const probableCause = `Based on the evidence collected (${evidenceList.length} item(s)) and witness testimonies obtained during the investigation of case #${caseData.id || '[Case ID]'}, there is substantial reason to believe that ${suspectName} (CID: ${suspectCID}) committed the offenses listed. Evidence includes ${evidenceList.map((e, i) => `Exhibit ${String.fromCharCode(65 + i)} (${e.type}: ${e.description})`).join(', ')}. Witness statements corroborate these findings. Therefore, an arrest warrant is requested.`;

        try {
            const docChildren: (Paragraph | Table | undefined)[] = [];

            if (imageBuffer) {
                docChildren.push(
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: imageBuffer,
                                transformation: {
                                    width: 310,
                                    height: 308,
                                },
                                type: "png", // Specify the MIME type of the image
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                    })
                );
            }

            docChildren.push(
                new Paragraph({
                    text: "THE SUPERIOR COURT OF THE STATE",
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 100 },
                })
            );

            docChildren.push(
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    columnWidths: [5000, 4500],
                    borders: {
                        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [
                                        new Paragraph("THE STATE,"),
                                        new Paragraph(" "),
                                        new Paragraph("        vs."),
                                        new Paragraph(" "),
                                        new Paragraph({
                                            children: [new TextRun({ text: suspectName, underline: { type: UnderlineType.SINGLE } })]
                                        }),
                                        new Paragraph("        DEFENDANT"),
                                    ],
                                    verticalAlign: VerticalAlign.TOP,
                                }),
                                new TableCell({
                                    children: [
                                        new Paragraph({ text: "ARREST WARRANT FOR", alignment: AlignmentType.CENTER, style: "Strong" }),
                                        new Paragraph({
                                            children: [new TextRun({ text: `${suspectName} ${suspectCID}`, underline: { type: UnderlineType.SINGLE } })],
                                            alignment: AlignmentType.CENTER,
                                        }),
                                    ],
                                    verticalAlign: VerticalAlign.CENTER,
                                }),
                            ],
                        }),
                    ],
                })
            );

            docChildren.push(
                new Paragraph({
                    children: [
                        new TextRun("The District Attorney's Office brings the following Arrest Warrant Application for Judicial review in the matter of The State Vs "),
                        new TextRun({ text: suspectName, underline: { type: UnderlineType.SINGLE } }),
                        new TextRun(". The named agent of the District Attorney’s Office accepts under the declaration of perjury that all information submitted within this document is accurate and true."),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 200, after: 200 },
                })
            );

            docChildren.push(
                new Paragraph({
                    text: "Violations of Criminal Codes Committed",
                    alignment: AlignmentType.CENTER,
                    style: "Strong",
                    spacing: { before: 200, after: 100 },
                })
            );

            const violationRows = [
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ text: "Criminal Code", style: "Strong" })], verticalAlign: VerticalAlign.CENTER }),
                        new TableCell({ children: [new Paragraph({ text: "Criminal Code Title", style: "Strong" })], verticalAlign: VerticalAlign.CENTER }),
                    ],
                    tableHeader: true,
                }),
                ...criminalCodes.map(cc => new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ text: cc.code, alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
                        new TableCell({ children: [new Paragraph(cc.title)], verticalAlign: VerticalAlign.CENTER }),
                    ]
                })),
                ...Array(Math.max(0, 5 - criminalCodes.length)).fill(0).map(() => new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph(" ")] }),
                        new TableCell({ children: [new Paragraph(" ")] }),
                    ]
                }))
            ];
            docChildren.push(
                new Table({
                    rows: violationRows,
                    width: { size: 90, type: WidthType.PERCENTAGE },
                    columnWidths: [2000, 7500],
                    alignment: AlignmentType.CENTER,
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    },
                })
            );

            docChildren.push(
                new Paragraph({
                    text: "Evidence Supporting Arrest Warrant",
                    alignment: AlignmentType.CENTER,
                    style: "Strong",
                    spacing: { before: 400, after: 100 },
                })
            );

            const evidenceRows = [
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ text: "Evidence / Witness", style: "Strong" })], verticalAlign: VerticalAlign.CENTER }),
                        new TableCell({ children: [new Paragraph({ text: "Description / Details", style: "Strong" })], verticalAlign: VerticalAlign.CENTER }),
                    ],
                    tableHeader: true,
                }),
                ...evidenceList.map((item, index) => new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph(`Exhibit ${String.fromCharCode(65 + index)}`)], verticalAlign: VerticalAlign.CENTER }),
                        new TableCell({ children: [new Paragraph(`[${item.type}] ${item.description} (Loc: ${item.location})${/*item.notes ? ` Notes: ${item.notes}` : ''*/''}${item.photoLink ? ` Photo: ${item.photoLink}` : ''}`)], verticalAlign: VerticalAlign.CENTER }),
                    ]
                })),
                ...witnessList.map((item, index) => new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph(`Witness ${String.fromCharCode(65 + index)}`)], verticalAlign: VerticalAlign.CENTER }),
                        new TableCell({ children: [new Paragraph(`${item.name} (CID: ${item.cid}, Phone: ${item.phone})`)], verticalAlign: VerticalAlign.CENTER }),
                    ]
                })),
                ...Array(Math.max(0, 10 - evidenceList.length - witnessList.length)).fill(0).map(() => new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph(" ")] }),
                        new TableCell({ children: [new Paragraph(" ")] }),
                    ]
                }))
            ];
            docChildren.push(
                new Table({
                    rows: evidenceRows,
                    width: { size: 90, type: WidthType.PERCENTAGE },
                    columnWidths: [2000, 7500],
                    alignment: AlignmentType.CENTER,
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    },
                })
            );

            if (photoSectionDescription) {
                docChildren.push(
                    new Paragraph({
                        text: "Photo Evidence Description",
                        alignment: AlignmentType.CENTER,
                        style: "Strong",
                        spacing: { before: 400, after: 100 },
                    })
                );
                docChildren.push(
                    new Paragraph({
                        text: photoSectionDescription,
                        alignment: AlignmentType.JUSTIFIED,
                        spacing: { after: 200 },
                    })
                );
            }

            docChildren.push(
                new Paragraph({
                    text: "Officer’s Admissions",
                    alignment: AlignmentType.CENTER,
                    style: "Strong",
                    spacing: { before: 400, after: 100 },
                })
            );

            docChildren.push(
                new Table({
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ text: "Date", style: "Strong" })], verticalAlign: VerticalAlign.CENTER }),
                                new TableCell({ children: [new Paragraph({ text: "Officer’s Probable Cause", style: "Strong" })], verticalAlign: VerticalAlign.CENTER }),
                            ],
                            tableHeader: true,
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph(new Date().toLocaleDateString())], verticalAlign: VerticalAlign.TOP }),
                                new TableCell({ children: [new Paragraph(probableCause)], verticalAlign: VerticalAlign.TOP }),
                            ],
                        }),
                    ],
                    width: { size: 90, type: WidthType.PERCENTAGE },
                    columnWidths: [2000, 7500],
                    alignment: AlignmentType.CENTER,
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    },
                })
            );

            docChildren.push(
                new Paragraph({ text: " ", spacing: { before: 400 } }),
                new Paragraph({ text: "_________________________ ", alignment: AlignmentType.RIGHT }),
                new Paragraph({ text: "Signature", alignment: AlignmentType.RIGHT }),
                new Paragraph({ text: officerName, alignment: AlignmentType.RIGHT }),
                new Paragraph({ text: "District Attorney’s Office", alignment: AlignmentType.RIGHT }),
                new Paragraph({ text: `Callsign: ${currentUser?.callsign || '[Callsign]'}`, alignment: AlignmentType.RIGHT }),
                new Paragraph({ text: new Date().toLocaleDateString(), alignment: AlignmentType.RIGHT }),
                new Paragraph({ text: "Date Filed", alignment: AlignmentType.RIGHT })
            );

            const doc = new Document({
                styles: {
                    paragraphStyles: [
                        {
                            id: "Strong",
                            name: "Strong",
                            basedOn: "Normal",
                            next: "Normal",
                            run: {
                                bold: true,
                            },
                        },
                    ],
                },
                sections: [{
                    properties: {},
                    children: docChildren.filter((c): c is Paragraph | Table => !!c),
                }],
            });

            Packer.toBlob(doc).then(blob => {
                saveAs(blob, `ArrestWarrant_${suspectName.replace(/ /g, '_')}_${caseData.id}.docx`);
                toast.success("Warrant exported as DOCX.");
            }).catch(err => {
                console.error("Error packing DOCX:", err);
                toast.error("Failed to generate DOCX file.");
            });

        } catch (error) {
            console.error("Error creating DOCX:", error);
            toast.error("An unexpected error occurred during DOCX generation.");
        } finally {
            setIsGeneratingDocx(false);
        }
    };

    const exportAsPdf = () => {
        if (!warrantText) return;
        const doc = new jsPDF();
        doc.text(warrantText, 10, 10);
        doc.save(`WarrantPreview_${caseData.title.replace(/ /g, '_') || 'Case'}.pdf`);
        toast.success("Warrant preview exported as PDF.");
    };

    const isActive = ['Open - Unassigned', 'Open - Assigned', 'Under Review'].includes(status);

    const handleAddNoteClick = () => {
        if (newNote.trim()) {
            handleSave(false); // Pass false to not close the modal
        } else {
            toast.info("Please enter a note to add.");
        }
    };

    return (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] sm:max-w-none max-h-[95vh] overflow-hidden bg-card text-foreground rounded-lg shadow-2xl border-brand border-2 flex flex-col p-6 sm:p-8 md:p-12">
            <Button variant="ghost" size="icon" className="absolute top-4 right-4 sm:top-6 sm:right-6 text-muted-foreground hover:text-foreground z-10" onClick={onClose}>
                <FaTimes className="h-5 w-5" />
                <span className="sr-only">Close</span>
            </Button>

            <div className="pb-6 mb-6 border-b-2 border-brand shrink-0">
                <h2 className="text-2xl md:text-3xl font-semibold">Edit Case File: {caseData.title}</h2>
            </div>

            {/* NEW: Add Status & Assignment Card at the top */}
            <Card className="bg-card-foreground/5 border-border shadow-sm mb-6">
                <CardHeader className="pt-6">
                    <CardTitle className="text-lg text-foreground">Status & Assignment</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    <div className="space-y-2">
                        <Label>Status</Label>
                        <div className="flex items-center space-x-2">
                            {['Open - Unassigned', 'Open - Assigned', 'Under Review'].includes(status) && <span className="h-2.5 w-2.5 bg-green-500 rounded-full inline-block" title="Active Case"></span>}
                            {!['Open - Unassigned', 'Open - Assigned', 'Under Review'].includes(status) && <span className="h-2.5 w-2.5 bg-red-500 rounded-full inline-block" title="Closed Case"></span>}
                            <Select value={status} onValueChange={(value: CaseStatus) => handleStatusChange(value)} disabled={isSaving}>
                                <SelectTrigger className="bg-input border-border flex-1">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover text-popover-foreground border-border shadow-md z-50">
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
                        <Select value={assignedToId || "unassigned"} onValueChange={handleAssigneeChange} disabled={isSaving}>
                            <SelectTrigger className="bg-input border-border">
                                <SelectValue placeholder="Select detective" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover text-popover-foreground border-border shadow-md z-50">
                                <SelectItem value="unassigned">-- Unassigned --</SelectItem>
                                {eligibleAssignees.map(user => (
                                    user.id && (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.name} ({user.callsign || 'N/A'})
                                        </SelectItem>
                                    )
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="details" className="w-full flex-grow flex flex-col overflow-hidden">
                <TabsList className="mb-6 shrink-0 bg-transparent p-0 border-b border-border gap-4">
                    <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-brand data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Details</TabsTrigger>
                    <TabsTrigger value="updates" className="data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-brand data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Updates</TabsTrigger>
                    <TabsTrigger value="warrant" className="data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-brand data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Warrant</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="flex-grow space-y-8 pb-4 overflow-y-auto custom-scrollbar pr-4 pl-1">
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="caseTitleEdit">Case Title *</Label>
                                    <Textarea id="caseTitleEdit" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Bank Robbery at Fleeca" className="bg-input border-border py-2 px-3" rows={1} readOnly={isSaving} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="incidentReportEdit">Incident Report (Link or #)</Label>
                                    <Textarea id="incidentReportEdit" value={incidentReport} onChange={(e) => setIncidentReport(e.target.value)} placeholder="e.g., #12345 or URL" className="bg-input border-border py-2 px-3" rows={1} readOnly={isSaving} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="locationEdit">Location of Incident</Label>
                                <Textarea id="locationEdit" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Pacific Standard Bank, Vinewood Blvd" className="bg-input border-border py-2 px-3" rows={1} readOnly={isSaving} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="summaryEdit">Summary</Label>
                                <Textarea id="summaryEdit" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Briefly summarize the investigation..." className="bg-input border-border whitespace-pre-line break-words py-2 px-3" rows={4} readOnly={isSaving} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Charges</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="relative space-y-2">
                                <Label htmlFor="chargeSearchEdit">Search Penal Codes</Label>
                                <div className="flex items-center">
                                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 mt-3.5" />
                                    <Input
                                        id="chargeSearchEdit"
                                        type="text"
                                        placeholder="Search by PC, Title, or Description..."
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        className="bg-input border-border pl-10 h-10"
                                        disabled={isSaving || isGeneratingDocx}
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
                                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Code</th>
                                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Title</th>
                                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Fine</th>
                                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Time (Months)</th>
                                                    <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">Action</th>
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
                                                                disabled={isSaving || isGeneratingDocx}
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

                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Names of Interest</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             {namesOfInterest.map((item, index) => (
                                <div key={item.id} className="p-4 border border-border/60 rounded-md space-y-4 relative bg-input/30">
                                     {namesOfInterest.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeNameRow(index)} className="absolute top-1 right-1 text-destructive hover:text-destructive/80 h-7 w-7" disabled={isSaving} title="Remove Person">
                                            <FaTrash className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <Label htmlFor={`name-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Name</Label>
                                            <Textarea id={`name-edit-${item.id}-${index}`} value={item.name} onChange={(e) => updateName(index, 'name', e.target.value)} placeholder="Full Name" className="bg-input border-border py-1.5 px-3 text-sm" rows={1} readOnly={isSaving} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`cid-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">CID#</Label>
                                            <Textarea id={`cid-edit-${item.id}-${index}`} value={item.cid || ''} onChange={(e) => updateName(index, 'cid', e.target.value)} placeholder="Citizen ID (Optional)" className="bg-input border-border py-1.5 px-3 text-sm" rows={1} readOnly={isSaving} />
                                        </div>
                                         <div className="space-y-1">
                                            <Label htmlFor={`phone-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Phone Number</Label>
                                            <Textarea id={`phone-edit-${item.id}-${index}`} value={item.phoneNumber || ''} onChange={(e) => updateName(index, 'phoneNumber', e.target.value)} placeholder="Phone # (Optional)" className="bg-input border-border py-1.5 px-3 text-sm" rows={1} readOnly={isSaving} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`role-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Role</Label>
                                            <Textarea id={`role-edit-${item.id}-${index}`} value={item.role} onChange={(e) => updateName(index, 'role', e.target.value)} placeholder="Suspect, Witness, Victim..." className="bg-input border-border py-1.5 px-3 text-sm" rows={1} readOnly={isSaving} />
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <Label htmlFor={`affiliation-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Gang Affiliation / Notes</Label>
                                            <Textarea id={`affiliation-edit-${item.id}-${index}`} value={item.affiliation} onChange={(e) => updateName(index, 'affiliation', e.target.value)} placeholder="Gang Name or relevant notes" className="bg-input border-border py-1.5 px-3 text-sm" rows={1} readOnly={isSaving} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addNameRow} className="mt-2 bg-brand text-brand-foreground hover:bg-brand/90 border-0" disabled={isSaving}>
                                <FaPlus className="mr-2 h-3 w-3" /> Add Person
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Evidence</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {evidence.map((item, index) => (
                                <div key={item.id} className="p-4 border border-border/60 rounded-md space-y-4 relative bg-input/30">
                                     {evidence.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEvidenceRow(index)} className="absolute top-1 right-1 text-destructive hover:text-destructive/80 h-7 w-7" disabled={isSaving} title="Remove Evidence">
                                            <FaTrash className="h-4 w-4" />
                                        </Button>
                                    )}
                                   <div className="space-y-1 mb-4">
                                        <Label htmlFor={`evidence-type-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Type</Label>
                                        <Select
                                            value={item.type}
                                            onValueChange={(value: EvidenceItem['type']) => updateEvidence(index, 'type', value)}
                                            disabled={isSaving}
                                        >
                                            <SelectTrigger id={`evidence-type-edit-${item.id}-${index}`} className="bg-input border-border h-9 text-sm w-full">
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
                                                    <Label htmlFor={`evidence-blood-name-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Name (Person)</Label>
                                                    <Textarea id={`evidence-blood-name-edit-${item.id}-${index}`} value={(item as EvidenceBlood).name || ''} onChange={(e) => updateEvidence(index, 'name', e.target.value)} placeholder="Name of individual" className="bg-input border-border text-sm py-1.5 px-3" rows={1} readOnly={isSaving} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-blood-dna-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">DNA Code</Label>
                                                    <Textarea id={`evidence-blood-dna-edit-${item.id}-${index}`} value={(item as EvidenceBlood).dnaCode || ''} onChange={(e) => updateEvidence(index, 'dnaCode', e.target.value)} placeholder="DNA Code" className="bg-input border-border text-sm py-1.5 px-3" rows={1} readOnly={isSaving} />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Weapon' && (
                                            <>
                                                <div className="space-y-1 sm:col-span-2">
                                                    <Label htmlFor={`evidence-weapon-details-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Weapon Details (Type, Model, SN)</Label>
                                                    <Textarea id={`evidence-weapon-details-edit-${item.id}-${index}`} value={(item as EvidenceWeapon).weaponDetails || ''} onChange={(e) => updateEvidence(index, 'weaponDetails', e.target.value)} placeholder="e.g., Pistol, Glock 19, SN: XYZ123" className="bg-input border-border text-sm py-1.5 px-3" rows={1} readOnly={isSaving} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-weapon-registered-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Registered To</Label>
                                                    <Textarea id={`evidence-weapon-registered-edit-${item.id}-${index}`} value={(item as EvidenceWeapon).registeredTo || ''} onChange={(e) => updateEvidence(index, 'registeredTo', e.target.value)} placeholder="Registered To" className="bg-input border-border text-sm py-1.5 px-3" rows={1} readOnly={isSaving} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-weapon-source-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Source of Collection</Label>
                                                    <Textarea id={`evidence-weapon-source-edit-${item.id}-${index}`} value={(item as EvidenceWeapon).sourceOfCollection || ''} onChange={(e) => updateEvidence(index, 'sourceOfCollection', e.target.value)} placeholder="e.g., Collected from John Doe" className="bg-input border-border text-sm py-1.5 px-3" rows={1} readOnly={isSaving} />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Casing' && (
                                            <>
                                                <div className="space-y-1 sm:col-span-2">
                                                    <Label htmlFor={`evidence-casing-details-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Casing Details (Caliber, Markings)</Label>
                                                    <Textarea id={`evidence-casing-details-edit-${item.id}-${index}`} value={(item as EvidenceCasing).casingDetails || ''} onChange={(e) => updateEvidence(index, 'casingDetails', e.target.value)} placeholder="e.g., 9mm, FC headstamp" className="bg-input border-border text-sm py-1.5 px-3" rows={1} readOnly={isSaving} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-casing-registered-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Registered To (Weapon, if known)</Label>
                                                    <Textarea id={`evidence-casing-registered-edit-${item.id}-${index}`} value={(item as EvidenceCasing).registeredTo || ''} onChange={(e) => updateEvidence(index, 'registeredTo', e.target.value)} placeholder="Registered To (related weapon)" className="bg-input border-border text-sm py-1.5 px-3" rows={1} readOnly={isSaving} />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Vehicle' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-vehicle-owner-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Owner</Label>
                                                    <Textarea id={`evidence-vehicle-owner-edit-${item.id}-${index}`} value={(item as EvidenceVehicle).owner || ''} onChange={(e) => updateEvidence(index, 'owner', e.target.value)} placeholder="Vehicle Owner" className="bg-input border-border text-sm py-1.5 px-3" rows={1} readOnly={isSaving} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-vehicle-plate-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Plate</Label>
                                                    <Textarea id={`evidence-vehicle-plate-edit-${item.id}-${index}`} value={(item as EvidenceVehicle).plate || ''} onChange={(e) => updateEvidence(index, 'plate', e.target.value)} placeholder="License Plate" className="bg-input border-border text-sm py-1.5 px-3" rows={1} readOnly={isSaving} />
                                                </div>
                                                <div className="space-y-1 sm:col-span-2">
                                                    <Label htmlFor={`evidence-vehicle-model-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Model</Label>
                                                    <Textarea id={`evidence-vehicle-model-edit-${item.id}-${index}`} value={(item as EvidenceVehicle).model || ''} onChange={(e) => updateEvidence(index, 'model', e.target.value)} placeholder="Vehicle Model" className="bg-input border-border text-sm py-1.5 px-3" rows={1} readOnly={isSaving} />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Fingerprint' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-fingerprint-name-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Name (Person)</Label>
                                                    <Textarea id={`evidence-fingerprint-name-edit-${item.id}-${index}`} value={(item as EvidenceFingerprint).name || ''} onChange={(e) => updateEvidence(index, 'name', e.target.value)} placeholder="Name of individual" className="bg-input border-border text-sm py-1.5 px-3" rows={1} readOnly={isSaving} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-fingerprint-id-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Fingerprint ID</Label>
                                                    <Textarea id={`evidence-fingerprint-id-edit-${item.id}-${index}`} value={(item as EvidenceFingerprint).fingerprintId || ''} onChange={(e) => updateEvidence(index, 'fingerprintId', e.target.value)} placeholder="Fingerprint ID" className="bg-input border-border text-sm py-1.5 px-3" rows={1} readOnly={isSaving} />
                                                </div>
                                            </>
                                        )}
                                        {(item.type === 'Other') && (
                                            <div className="space-y-1 sm:col-span-2">
                                                <Label htmlFor={`evidence-desc-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Evidence Details</Label>
                                                <Textarea id={`evidence-desc-edit-${item.id}-${index}`} value={(item as EvidenceOther).description} onChange={(e) => updateEvidence(index, 'description', e.target.value)} placeholder="Description of evidence" className="bg-input border-border text-sm py-1.5 px-3" rows={1} readOnly={isSaving} />
                                            </div>
                                        )}
                                        <div className="space-y-1 sm:col-span-2">
                                            <Label htmlFor={`evidence-location-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">
                                                {item.type === 'Blood' ? 'Location Blood was Found' :
                                                 item.type === 'Casing' ? 'Location Casing was Found' :
                                                 item.type === 'Weapon' ? 'Location Weapon was Found/Collected' :
                                                 item.type === 'Vehicle' ? 'Location Vehicle was Seen/Found' :
                                                 item.type === 'Fingerprint' ? 'Location Fingerprint was Collected' :
                                                 'Location Collected/Found'}
                                            </Label>
                                            <Textarea id={`evidence-location-edit-${item.id}-${index}`} value={item.location} onChange={(e) => updateEvidence(index, 'location', e.target.value)} placeholder="Location details" className="bg-input border-border text-sm py-1.5 px-3" rows={1} readOnly={isSaving} />
                                        </div>
                                        <div className="space-y-1 sm:col-span-2">
                                            <Label htmlFor={`evidence-photolink-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Photo/Bodycam Link (Optional)</Label>
                                            <Textarea
                                                id={`evidence-photolink-edit-${item.id}-${index}`}
                                                value={item.photoLink || ''}
                                                onChange={(e) => updateEvidence(index, 'photoLink', e.target.value)}
                                                placeholder="https://example.com/evidence_photo.png"
                                                className="bg-input border-border text-sm py-1.5 px-3"
                                                rows={1}
                                                readOnly={isSaving}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addEvidenceRow} className="mt-2 bg-brand text-brand-foreground hover:bg-brand/90 border-0" disabled={isSaving}>
                                <FaPlus className="mr-2 h-3 w-3" /> Add Evidence
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Photos (Links)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="photoSectionDescriptionEdit">Photo Section Description</Label>
                                <Textarea
                                    id="photoSectionDescriptionEdit"
                                    value={photoSectionDescription}
                                    onChange={(e) => setPhotoSectionDescription(e.target.value)}
                                    placeholder="Optional: Describe the photos linked below (e.g., crime scene photos, suspect identification photos)."
                                    className="bg-input border-border py-1.5 px-3"
                                    rows={1}
                                    readOnly={isSaving || isGeneratingDocx}
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
                                            readOnly={isSaving}
                                        />
                                        {photos.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removePhotoLink(index)}
                                                className="text-destructive hover:text-destructive/80 h-9 w-9"
                                                disabled={isSaving}
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
                            <Button type="button" variant="outline" size="sm" onClick={addPhotoLink} className="mt-2 bg-brand text-brand-foreground hover:bg-brand/90 border-0" disabled={isSaving}>
                                <FaPlus className="mr-2 h-3 w-3" /> Add Photo Link
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Bodycam/Dashcam/Video Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea id="videoNotesEdit" value={videoNotes} onChange={(e) => setVideoNotes(e.target.value)} placeholder="Add links to bodycam/dashcam footage, YouTube videos, or general notes about video evidence..." className="bg-input border-border py-1.5 px-3" rows={3} readOnly={isSaving} />
                        </CardContent>
                    </Card>

                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                         <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Gang Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea id="gangInfoEdit" value={gangInfo} onChange={(e) => setGangInfo(e.target.value)} placeholder="Details about gang involvement, if any..." className="bg-input border-border py-1.5 px-3" rows={3} readOnly={isSaving} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="updates" className="flex-grow flex flex-col space-y-6 pb-4 overflow-y-auto custom-scrollbar pr-4 pl-1">
                    <div className="space-y-4 flex-grow">
                        {updates.length === 0 ? (
                            <p className="text-muted-foreground italic text-sm">No updates recorded yet.</p>
                        ) : (
                            [...updates].sort((a, b) => {
                                const timeA = a.timestamp instanceof Timestamp ? a.timestamp.toDate().getTime() : (a.timestamp instanceof Date ? a.timestamp.getTime() : 0);
                                const timeB = b.timestamp instanceof Timestamp ? b.timestamp.toDate().getTime() : (b.timestamp instanceof Date ? b.timestamp.getTime() : 0);
                                return timeB - timeA; // Sort descending
                            }).map((update) => (
                                <div key={update.id} className="p-4 border rounded-md bg-black/95 border-border text-sm relative group">
                                    {editingUpdateId === update.id ? (
                                        <div className="space-y-2">
                                            <Textarea
                                                value={editedUpdateText}
                                                onChange={(e) => setEditedUpdateText(e.target.value)}
                                                className="bg-input border-border py-1.5 px-3"
                                                rows={3}
                                                readOnly={isSaving}
                                            />
                                            <div className="flex justify-end space-x-2">
                                                <Button variant="ghost" size="sm" onClick={handleCancelEditUpdate} disabled={isSaving}>
                                                    <FaBan className="mr-1 h-3 w-3" /> Cancel
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={handleSaveEditUpdate} disabled={isSaving || !editedUpdateText.trim()} className="bg-green-600 hover:bg-green-700 text-white border-green-700">
                                                    <FaCheck className="mr-1 h-3 w-3" /> Save Edit
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="whitespace-pre-line break-words">{update.note}</p>
                                            <p className="text-xs text-muted-foreground text-right mt-1">
                                                - {update.userName} on {formatTimestampForDisplay(update.timestamp)} {update.edited ? '(edited)' : ''}
                                            </p>
                                            {canModifyUpdate(update) && !isSaving && (
                                                <div className="absolute top-1 right-1 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-400 hover:text-blue-300" onClick={() => handleEditUpdateClick(update)} title="Edit Update">
                                                        <FaEdit className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-400" onClick={() => handleDeleteUpdateClick(update.id)} title="Delete Update">
                                                        <FaTrash className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    <div className="shrink-0 space-y-2 pt-4 border-t border-border">
                        <Label htmlFor="newNoteEdit">Add New Update/Note</Label>
                        <Textarea
                            id="newNoteEdit"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Record any updates or notes..."
                            className="bg-input border-border py-1.5 px-3"
                            rows={3}
                            readOnly={isSaving || editingUpdateId !== null}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddNoteClick}
                            disabled={isSaving || !newNote.trim() || editingUpdateId !== null}
                            className="bg-brand text-brand-foreground hover:bg-brand/90 border-0"
                        >
                            Add Note
                        </Button>
                    </div>
                </TabsContent>

                <TabsContent value="warrant" className="flex-grow flex flex-col space-y-6 pb-4 overflow-y-auto custom-scrollbar pr-4 pl-1">
                     <div className="flex justify-between items-center mb-2 shrink-0">
                        <h3 className="text-lg font-semibold text-white">Arrest Warrant Generation</h3>
                        <div className="space-x-2">
                             <Button variant="outline" size="sm" onClick={handleRegenerateWarrantPreview} title="Regenerate text preview" className="bg-blue-600 hover:bg-blue-700 text-white border-blue-700" disabled={isGeneratingDocx || isSaving}>
                                <FaSync className="mr-2 h-3 w-3" /> Regenerate Preview
                            </Button>
                            <Button variant="outline" size="sm" onClick={exportAsDocx} title="Export as DOCX (Official Template)" className="bg-sky-600 hover:bg-sky-700 text-white border-sky-700" disabled={isGeneratingDocx || isSaving}>
                                {isGeneratingDocx ? <FaSync className="animate-spin mr-2 h-3 w-3" /> : <FaFileWord className="mr-2 h-3 w-3" />}
                                {isGeneratingDocx ? 'Generating...' : 'Export DOCX'}
                            </Button>
                            <Button variant="outline" size="sm" onClick={exportAsPdf} title="Export Preview as PDF" className="bg-red-600 hover:bg-red-700 text-white border-red-700" disabled={isGeneratingDocx || isSaving || !warrantText}>
                                <FaFilePdf className="mr-2 h-3 w-3" /> Export PDF Preview
                            </Button>
                        </div>
                    </div>
                    <Textarea
                        readOnly
                        value={warrantText}
                        className="flex-grow w-full bg-input border-border font-mono text-xs whitespace-pre-line break-words py-1.5 px-3"
                        placeholder="Warrant text preview will be generated here based on case details..."
                        style={{ minHeight: '300px' }}
                    />
                     <p className="text-xs text-muted-foreground italic mt-1 shrink-0">
                        Use 'Export DOCX' to generate the official warrant document using the template structure. The text area shows a simplified preview. Review the exported DOCX thoroughly.
                    </p>
                </TabsContent>
            </Tabs>

            <div className="pt-6 mt-6 border-t-2 border-brand shrink-0 flex justify-end space-x-4">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving || isGeneratingDocx}>Cancel</Button>
                <Button type="button" onClick={() => handleSave()} disabled={isSaving || isGeneratingDocx || editingUpdateId !== null} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <FaSave className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </div>
    );
};

export default EditCaseModal;
