import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    doc,
    updateDoc,
    deleteDoc,
    Timestamp,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy
} from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types/User';
import { CaseFile, CaseStatus } from '../../utils/ciuUtils';
import { canUserManageCiuCaseAssignments, canUserEditAnyCiuCaseUpdate } from '../../utils/permissionUtils';
import { toast } from 'react-toastify';
import penalCodesDataFromFile from './penal_codes';
import jsPDF from 'jspdf';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';

import { 
    Save, X, Plus, Trash2, Search, RefreshCw, FileText, Download, Edit, AlertTriangle,
    Paperclip, Video, Users, Shield, MapPin, FilePlus, FileArchive, UserCheck, UserX, Eye, MessageSquarePlus
} from 'lucide-react';

// Define UpdateCaseFile type, can be Partial<CaseFile> or more specific
// Corrected: Omit 'updatedAt' before Partial to avoid intersection type issue


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
interface CaseUpdate { 
    id: string | number;
    timestamp: Timestamp | Date | null; 
    userId: string; 
    userName: string; 
    note: string; 
    edited?: boolean; 
}

interface EditCaseModalProps {
  isOpen: boolean; // This prop might not be needed if modal visibility is handled by parent through conditional rendering
  // currentUser: User | null; // This can be obtained from useAuth
  // allUsers: User[]; // This might be better fetched within or passed if static
  onClose: () => void;
  onSaveSuccess: () => void;
  caseData: CaseFile;
  eligibleAssignees: User[];
}

interface CaseNote {
    id: string;
    caseId: string;
    userId: string;
    userName: string;
    note: string;
    timestamp: Timestamp;
    edited?: boolean;
}

const EditCaseModal: React.FC<EditCaseModalProps> = ({ onClose, onSaveSuccess, caseData, eligibleAssignees, isOpen }) => {
    const { user: currentUser } = useAuth();
    const canManageAssignments = useMemo(() => canUserManageCiuCaseAssignments(currentUser), [currentUser]);
    const canEditAnyUpdate = useMemo(() => canUserEditAnyCiuCaseUpdate(currentUser), [currentUser]);

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
    const [updates, setUpdates] = useState<CaseNote[]>([]);
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
        setPenalCodes(penalCodesDataFromFile as PenalCode[]);
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

    // Memoize fetchNotes so it doesn't change on every render
    const fetchNotes = useCallback(async () => {
        console.log('🔍 fetchNotes called with caseData.id:', caseData.id);
        if (!caseData.id) {
            console.log('❌ No caseData.id, returning early');
            return;
        }
        try {
            console.log('📡 Starting Firestore query for caseNotes...');
            const notesRef = collection(dbFirestore, 'caseNotes');
            const q = query(notesRef, where('caseId', '==', caseData.id), orderBy('timestamp', 'desc'));
            const snapshot = await getDocs(q);
            console.log('📄 Query snapshot received, docs count:', snapshot.docs.length);
            
            const notes: CaseNote[] = snapshot.docs.map(docSnap => {
                const data = { id: docSnap.id, ...docSnap.data() };
                console.log('📝 Processing note:', data);
                return data;
            }) as CaseNote[];
            
            console.log('✅ Setting updates state with notes:', notes);
            setUpdates(notes);
        } catch (err) {
            console.error('❌ Error in fetchNotes:', err);
            toast.error('Failed to load case notes.');
        }
    }, [caseData.id]);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

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
                    updated[index] = { ...baseProperties, type: 'Blood', name: '', dnaCode: '' };
                    break;
                case 'Vehicle':
                    updated[index] = { ...baseProperties, type: 'Vehicle', owner: '', plate: '', model: '' };
                    break;
                case 'Fingerprint':
                    updated[index] = { ...baseProperties, type: 'Fingerprint', name: '', fingerprintId: '' };
                    break;
                case 'Casing':
                    updated[index] = { ...baseProperties, type: 'Casing', casingDetails: '', registeredTo: '' };
                    break;
                case 'Weapon':
                    updated[index] = { ...baseProperties, type: 'Weapon', weaponDetails: '', registeredTo: '', sourceOfCollection: '' };
                    break;
                case 'Other':
                default:
                    updated[index] = { ...baseProperties, type: 'Other', description: '' };
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
            setStatus('Open - Unassigned');
        } else if (!newAssigneeId && (status === 'Closed - Solved' || status === 'Closed - Unsolved' || status === 'Under Review')) {
            // If case is closed/review and unassigned, move to Open - Unassigned
            setStatus('Open - Unassigned');
        }
    };

    const handleStatusChange = (value: CaseStatus) => {
        setStatus(value);
        if (value === 'Open - Unassigned' && assignedToId) {
            setAssignedToId(null); // Unassign if status changes to Open - Unassigned
        }
        if (value === 'Open - Assigned' && !assignedToId) {
            // If status is Open - Assigned but no one is assigned, prompt user or auto-set to unassigned
            toast.warn("Case set to 'Open - Assigned' but no detective is selected. Please assign a detective or change status.");
            // setStatus('Open - Unassigned'); // Or revert
        }
    };

    const canModifyUpdate = (update: CaseNote): boolean => {
        if (!currentUser) return false;
        if (canEditAnyUpdate) return true; // User with Lead/Super certs can edit any update
        if (update.userId === currentUser.id) return true; // User can edit their own update
        return false;
    };

    const handleEditUpdateClick = (update: CaseNote) => {
        setEditingUpdateId(update.id);
        setEditedUpdateText(update.note);
    };

    const handleCancelEditUpdate = () => {
        setEditingUpdateId(null);
        setEditedUpdateText('');
    };

    const handleSaveEditUpdate = async () => {
        console.log('✏️ handleSaveEditUpdate called');
        console.log('🆔 editingUpdateId:', editingUpdateId);
        console.log('📝 editedUpdateText:', editedUpdateText);
        console.log('👤 currentUser:', currentUser);
        
        if (!editingUpdateId || !currentUser) {
            console.log('❌ Missing editingUpdateId or currentUser');
            return;
        }
        
        setIsSaving(true);
        console.log('💾 Starting to update note...');
        
        try {
            const noteRef = doc(dbFirestore, 'caseNotes', editingUpdateId as string);
            const updateData = {
                note: editedUpdateText,
                edited: true,
                timestamp: Timestamp.now()
            };
            console.log('📄 Update data:', updateData);
            
            await updateDoc(noteRef, updateData);
            console.log('✅ Note updated successfully');
            
            setEditingUpdateId(null);
            setEditedUpdateText('');
            toast.success("Note updated.");
            
            console.log('🔄 Calling fetchNotes to refresh...');
            await fetchNotes();
            console.log('🔄 fetchNotes completed');
        } catch (err) {
            console.error('❌ Error updating note:', err);
            toast.error("Failed to update note.");
        } finally {
            console.log('🏁 Setting isSaving to false');
            setIsSaving(false);
        }
    };

    const handleDeleteUpdateClick = async (updateId: string | number) => {
        console.log('🗑️ handleDeleteUpdateClick called with updateId:', updateId);
        console.log('👤 currentUser:', currentUser);
        
        if (!currentUser) {
            console.log('❌ No currentUser');
            return;
        }
        if (!window.confirm("Are you sure you want to delete this update? This cannot be undone.")) {
            console.log('❌ User cancelled deletion');
            return;
        }
        
        setIsSaving(true);
        console.log('💾 Starting to delete note...');
        
        try {
            const noteRef = doc(dbFirestore, 'caseNotes', updateId as string);
            console.log('🗑️ Deleting document from Firestore...');
            
            await deleteDoc(noteRef);
            console.log('✅ Note deleted successfully from Firestore');
            
            toast.success("Note deleted.");
            
            console.log('🔄 Calling fetchNotes to refresh...');
            await fetchNotes();
            console.log('🔄 fetchNotes completed');
        } catch (err) {
            console.error('❌ Error deleting note:', err);
            toast.error("Failed to delete note.");
        } finally {
            console.log('🏁 Setting isSaving to false');
            setIsSaving(false);
        }
    };


    const handleSave = async (closeOnSuccess: boolean = true): Promise<boolean> => {
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

        const updatedDetailsObject = {
            incidentReport,
            evidence: evidence.filter(isEvidenceItemPopulated),
            photos: photos.filter(p => p.trim()),
            photoSectionDescription,
            location,
            namesOfInterest: namesOfInterest.filter(n => n.name.trim() || n.role.trim() || n.affiliation.trim() || n.cid?.trim() || n.phoneNumber?.trim()),
            gangInfo,
            videoNotes,
            charges: selectedCharges
        };

        const updateData = {
            title: title.trim(),
            description: summary.trim(),
            status,
            assignedToId: assignedToId,
            assignedToName: assignedUser?.name || null,
            imageLinks: updatedDetailsObject.photos,
            details: JSON.stringify(updatedDetailsObject),
            updatedAt: Timestamp.now()
        };

        try {
            const caseRef = doc(dbFirestore, 'caseFiles', caseData.id);
            await updateDoc(caseRef, updateData as any);
            toast.success(`Case "${title.trim()}" updated successfully.`);
            onSaveSuccess();
            if (closeOnSuccess) {
                onClose();
            }
            return true;
        } catch (error) {
            console.error("Error updating case:", error);
            toast.error("Failed to update case.");
            return false;
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
                        details += `Desc: ${item.description || 'N/A'}`; 
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
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
            return await response.arrayBuffer();
        } catch (error) {
            console.error("Error fetching image:", error);
            toast.error("Could not load image for DOCX export.");
            return null;
        }
    };

    const exportAsDocx = async () => {
        setIsGeneratingDocx(true);
        toast.info("Generating DOCX warrant...");

        const imageUrl = '/images/image1.png'; // Placeholder, ensure this path is correct or configurable
        const imageBuffer = await fetchImage(imageUrl);

        const primarySuspect = namesOfInterest.find(n => n.role?.toLowerCase().includes('suspect'));
        const suspectName = primarySuspect?.name || '[Suspect Name]';
        const suspectCID = primarySuspect?.cid || '[CID#]';
        const officerName = currentUser?.name || '[Officer Name]';
        const criminalCodes = selectedCharges.map(charge => ({
            code: charge.pc,
            title: charge.title
        }));
        // if (criminalCodes.length === 0) { } // No need to push N/A, template handles it

        const evidenceList = evidence
            .filter(isEvidenceItemPopulated)
            .map(item => {
                let description = '';
                switch(item.type) {
                    case 'Blood': description = `Blood sample, Name: ${item.name || 'N/A'}, DNA: ${item.dnaCode || 'N/A'}`; break;
                    case 'Casing': description = `Casing, Details: ${item.casingDetails || 'N/A'}`; break;
                    case 'Weapon': description = `Weapon, Details: ${item.weaponDetails || 'N/A'}`; break;
                    case 'Vehicle': description = `Vehicle, Model: ${item.model || 'N/A'}, Plate: ${item.plate || 'N/A'}`; break;
                    case 'Fingerprint': description = `Fingerprint, Name: ${item.name || 'N/A'}, ID: ${item.fingerprintId || 'N/A'}`; break;
                    case 'Other': description = item.description || 'N/A'; break;
                    default: description = 'Details not specified.';
                }
                return { type: item.type, description, location: item.location || 'N/A' };
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
            // Actual DOCX generation logic using a library like 'docx' would go here.
            // This is a placeholder for the complex DOCX generation.
            // Example: const doc = new Document({ sections: [...] }); Packer.toBlob(doc).then(blob => saveAs(blob, "warrant.docx"));
            console.log("Simulating DOCX export with data:", { officerName, suspectName, suspectCID, criminalCodes, evidenceList, witnessList, probableCause, imageBuffer });
            toast.success("DOCX warrant generated successfully (simulated).");
            // For a real implementation, you'd use FileSaver.js or similar to trigger download.
            // import { saveAs } from 'file-saver';
            // saveAs(blob, `Warrant_${caseData.title.replace(/ /g, '_') || 'Case'}.docx`);
        } catch (error) {
            console.error("Error generating DOCX:", error);
            toast.error("Failed to generate DOCX warrant.");
        } finally {
            setIsGeneratingDocx(false);
        }
    };

    const exportAsPdf = () => {
        if (!warrantText) {
            toast.error("Warrant preview text is not available.");
            return;
        }
        const doc = new jsPDF();
        doc.text(warrantText, 10, 10);
        doc.save(`WarrantPreview_${caseData.title.replace(/ /g, '_') || 'Case'}.pdf`);
        toast.success("Warrant preview exported as PDF.");
    };

    const isActive = ['Open - Unassigned', 'Open - Assigned', 'Under Review'].includes(status);

    const handleAddNoteClick = async () => {
        console.log('➕ handleAddNoteClick called');
        console.log('📝 newNote value:', newNote);
        console.log('👤 currentUser:', currentUser);
        console.log('📁 caseData.id:', caseData.id);
        
        if (!newNote.trim()) {
            console.log('❌ Note is empty');
            toast.error("Note cannot be empty.");
            return;
        }
        if (!currentUser || !caseData.id) {
            console.log('❌ Missing currentUser or caseData.id');
            toast.error("User or Case ID missing.");
            return;
        }
        
        setIsSaving(true);
        console.log('💾 Starting to save note...');
        
        try {
            const noteToAdd: Omit<CaseNote, 'id'> = {
                caseId: caseData.id,
                userId: currentUser.id || 'Unknown',
                userName: currentUser.name || 'Unknown User',
                note: newNote.trim(),
                timestamp: Timestamp.now(),
                edited: false
            };
            console.log('📄 Note object to add:', noteToAdd);
            
            const docRef = await addDoc(collection(dbFirestore, 'caseNotes'), noteToAdd);
            console.log('✅ Note added with ID:', docRef.id);
            
            setNewNote('');
            toast.success("Note added.");
            
            console.log('🔄 Calling fetchNotes to refresh...');
            await fetchNotes();
            console.log('🔄 fetchNotes completed');
        } catch (err) {
            console.error('❌ Error adding note:', err);
            toast.error("Failed to add note.");
        } finally {
            console.log('🏁 Setting isSaving to false');
            setIsSaving(false);
        }
    };

    function formatTimestampForDisplay(timestamp: Date | Timestamp | null): React.ReactNode {
        if (!timestamp) return 'N/A';
        let date: Date;
        if (timestamp instanceof Timestamp) {
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            console.warn("Invalid timestamp type for display:", timestamp);
            return 'Invalid Date';
        }
        return date.toLocaleString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });
    }
    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] sm:max-w-none max-h-[95vh] overflow-hidden bg-card text-foreground rounded-lg shadow-2xl border-brand border-2 flex flex-col p-6 sm:p-8 md:p-12"
            >
                <DialogDescription className="sr-only">
                    Edit case file details, manage updates, and export warrant previews.
                </DialogDescription>
                {/* Header */}
                <div className="pb-6 mb-6 border-b-2 border-brand shrink-0 flex justify-between items-center">
                    <DialogTitle className="text-2xl md:text-3xl font-semibold text-brand">
                        Edit Case File: {caseData.title}
                    </DialogTitle>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-5 w-5" />
                        <span className="sr-only">Close</span>
                    </Button>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="details" className="w-full flex-grow flex flex-col overflow-hidden">
                    <TabsList className="mb-6 shrink-0 bg-transparent p-0 border-b border-border gap-4">
                        <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-brand data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Details</TabsTrigger>
                        <TabsTrigger value="updates" className="data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-brand data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Updates ({updates.length})</TabsTrigger>
                        <TabsTrigger value="warrant" className="data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-brand data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Warrant</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="details" className="flex-grow space-y-8 pb-4 overflow-y-auto custom-scrollbar pr-4 pl-1">
                        {/* Status & Assignment Card */}
                        <Card className="bg-card-foreground/5 border-border shadow-sm">
                            <CardHeader className="pt-6">
                                <CardTitle className="text-lg text-foreground">Status & Assignment</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="caseStatusEdit">Case Status</Label>
                                    <div className="flex items-center space-x-2">
                                        {isActive 
                                          ? <span className="h-2.5 w-2.5 bg-green-500 rounded-full inline-block" title="Active Case"></span>
                                          : <span className="h-2.5 w-2.5 bg-red-500 rounded-full inline-block" title="Closed/Archived Case"></span>}
                                        <Select value={status} onValueChange={(value: CaseStatus) => handleStatusChange(value)}>
                                          <SelectTrigger id="caseStatusEdit" className="bg-input border-border flex-1">
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
                                {canManageAssignments && (
                                    <div className="space-y-2">
                                        <Label htmlFor="assignDetectiveEdit">Assign Detective</Label>
                                        <Select value={assignedToId || "unassigned"} onValueChange={handleAssigneeChange}>
                                            <SelectTrigger id="assignDetectiveEdit" className="bg-input border-border">
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
                    {/* Core Information Card */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                         <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground">Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="caseTitleEdit">Case Title *</Label>
                                    <Textarea id="caseTitleEdit" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Bank Robbery at Fleeca" className="bg-input border-border py-2 px-3" rows={1} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="incidentReportEdit">Incident Report (Link or #)</Label>
                                    <Textarea id="incidentReportEdit" value={incidentReport} onChange={(e) => setIncidentReport(e.target.value)} placeholder="e.g., #12345 or URL" className="bg-input border-border py-2 px-3" rows={1} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="locationEdit">Location of Incident</Label>
                                <Textarea id="locationEdit" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Pacific Standard Bank, Vinewood Blvd" className="bg-input border-border py-2 px-3" rows={1} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="summaryEdit">Summary</Label>
                                <Textarea id="summaryEdit" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Briefly summarize the investigation..." className="bg-input border-border whitespace-pre-line break-words py-2 px-3" rows={4} />
                            </div>
                        </CardContent>
                    </Card>
                    {/* Charges Card */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground flex items-center"><Shield className="mr-2 h-5 w-5 text-brand"/>Charges</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="relative space-y-2">
                                <Label htmlFor="chargeSearchEdit">Search Penal Codes</Label>
                                <div className="flex items-center">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 mt-3.5" />
                                    <Input
                                        id="chargeSearchEdit"
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
                            <CardTitle className="text-lg text-foreground flex items-center"><Users className="mr-2 h-5 w-5 text-brand"/>Names of Interest</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             {namesOfInterest.map((item, index) => (
                                <div key={item.id} className="p-4 border border-border/60 rounded-md space-y-4 relative bg-input/30">
                                     {namesOfInterest.length > 0 && ( // Show remove button if there's at least one item, or adjust logic (e.g. > 1)
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeNameRow(index)} className="absolute top-1 right-1 text-destructive hover:text-destructive/80 h-7 w-7" title="Remove Person">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <Label htmlFor={`name-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Name</Label>
                                            <Textarea id={`name-edit-${item.id}-${index}`} value={item.name} onChange={(e) => updateName(index, 'name', e.target.value)} placeholder="Full Name" className="bg-input border-border py-1.5 px-3 text-sm" rows={1} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`cid-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">CID#</Label>
                                            <Textarea id={`cid-edit-${item.id}-${index}`} value={item.cid || ''} onChange={(e) => updateName(index, 'cid', e.target.value)} placeholder="Citizen ID (Optional)" className="bg-input border-border py-1.5 px-3 text-sm" rows={1} />
                                        </div>
                                         <div className="space-y-1">
                                            <Label htmlFor={`phone-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Phone Number</Label>
                                            <Textarea id={`phone-edit-${item.id}-${index}`} value={item.phoneNumber || ''} onChange={(e) => updateName(index, 'phoneNumber', e.target.value)} placeholder="Phone # (Optional)" className="bg-input border-border py-1.5 px-3 text-sm" rows={1} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`role-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Role</Label>
                                            <Textarea id={`role-edit-${item.id}-${index}`} value={item.role} onChange={(e) => updateName(index, 'role', e.target.value)} placeholder="Suspect, Witness, Victim..." className="bg-input border-border py-1.5 px-3 text-sm" rows={1} />
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <Label htmlFor={`affiliation-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Gang Affiliation / Notes</Label>
                                            <Textarea id={`affiliation-edit-${item.id}-${index}`} value={item.affiliation} onChange={(e) => updateName(index, 'affiliation', e.target.value)} placeholder="Gang Name or relevant notes" className="bg-input border-border py-1.5 px-3 text-sm" rows={1} />
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
                            <CardTitle className="text-lg text-foreground flex items-center"><FileArchive className="mr-2 h-5 w-5 text-brand"/>Evidence</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {evidence.map((item, index) => (
                                <div key={item.id} className="p-4 border border-border/60 rounded-md space-y-4 relative bg-input/30">
                                     {evidence.length > 0 && ( // Show remove button if there's at least one item
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEvidenceRow(index)} className="absolute top-1 right-1 text-destructive hover:text-destructive/80 h-7 w-7" title="Remove Evidence">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                   <div className="space-y-1 mb-4">
                                        <Label htmlFor={`evidence-type-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Type</Label>
                                        <Select
                                            value={item.type}
                                            onValueChange={(value: EvidenceItem['type']) => updateEvidence(index, 'type', value)}
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
                                                    <Textarea id={`evidence-blood-name-edit-${item.id}-${index}`} value={(item as EvidenceBlood).name || ''} onChange={e => updateEvidence(index, 'name', e.target.value)} placeholder="Name (Person)" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-blood-dna-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">DNA Code</Label>
                                                    <Textarea id={`evidence-blood-dna-edit-${item.id}-${index}`} value={(item as EvidenceBlood).dnaCode || ''} onChange={e => updateEvidence(index, 'dnaCode', e.target.value)} placeholder="DNA Code" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Weapon' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-weapon-details-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Weapon Details (Type, Model, SN)</Label>
                                                    <Textarea id={`evidence-weapon-details-edit-${item.id}-${index}`} value={(item as EvidenceWeapon).weaponDetails || ''} onChange={e => updateEvidence(index, 'weaponDetails', e.target.value)} placeholder="Weapon Details (Type, Model, SN)" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-weapon-reg-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Registered To</Label>
                                                    <Textarea id={`evidence-weapon-reg-edit-${item.id}-${index}`} value={(item as EvidenceWeapon).registeredTo || ''} onChange={e => updateEvidence(index, 'registeredTo', e.target.value)} placeholder="Registered To" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-weapon-source-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Source of Collection</Label>
                                                    <Textarea id={`evidence-weapon-source-edit-${item.id}-${index}`} value={(item as EvidenceWeapon).sourceOfCollection || ''} onChange={e => updateEvidence(index, 'sourceOfCollection', e.target.value)} placeholder="Source of Collection" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Casing' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-casing-details-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Casing Details (Caliber, Markings)</Label>
                                                    <Textarea id={`evidence-casing-details-edit-${item.id}-${index}`} value={(item as EvidenceCasing).casingDetails || ''} onChange={e => updateEvidence(index, 'casingDetails', e.target.value)} placeholder="Casing Details (Caliber, Markings)" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-casing-reg-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Registered To (Weapon, if known)</Label>
                                                    <Textarea id={`evidence-casing-reg-edit-${item.id}-${index}`} value={(item as EvidenceCasing).registeredTo || ''} onChange={e => updateEvidence(index, 'registeredTo', e.target.value)} placeholder="Registered To (Weapon, if known)" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Vehicle' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-vehicle-owner-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Owner</Label>
                                                    <Textarea id={`evidence-vehicle-owner-edit-${item.id}-${index}`} value={(item as EvidenceVehicle).owner || ''} onChange={e => updateEvidence(index, 'owner', e.target.value)} placeholder="Owner" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-vehicle-plate-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Plate</Label>
                                                    <Textarea id={`evidence-vehicle-plate-edit-${item.id}-${index}`} value={(item as EvidenceVehicle).plate || ''} onChange={e => updateEvidence(index, 'plate', e.target.value)} placeholder="Plate" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-vehicle-model-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Model</Label>
                                                    <Textarea id={`evidence-vehicle-model-edit-${item.id}-${index}`} value={(item as EvidenceVehicle).model || ''} onChange={e => updateEvidence(index, 'model', e.target.value)} placeholder="Model" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                            </>
                                        )}
                                        {item.type === 'Fingerprint' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-fingerprint-name-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Name (Person)</Label>
                                                    <Textarea id={`evidence-fingerprint-name-edit-${item.id}-${index}`} value={(item as EvidenceFingerprint).name || ''} onChange={e => updateEvidence(index, 'name', e.target.value)} placeholder="Name (Person)" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`evidence-fingerprint-id-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Fingerprint ID</Label>
                                                    <Textarea id={`evidence-fingerprint-id-edit-${item.id}-${index}`} value={(item as EvidenceFingerprint).fingerprintId || ''} onChange={e => updateEvidence(index, 'fingerprintId', e.target.value)} placeholder="Fingerprint ID" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                                </div>
                                            </>
                                        )}
                                        {(item.type === 'Other') && (
                                            <div className="space-y-1 sm:col-span-2">
                                                <Label htmlFor={`evidence-other-desc-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Evidence Details</Label>
                                                <Textarea id={`evidence-other-desc-edit-${item.id}-${index}`} value={(item as EvidenceOther).description} onChange={e => updateEvidence(index, 'description', e.target.value)} placeholder="Description of evidence" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
                                            </div>
                                        )}
                                        <div className="space-y-1 sm:col-span-2">
                                            <Label htmlFor={`evidence-location-edit-${item.id}-${index}`} className="text-xs text-muted-foreground">Location Collected/Found</Label>
                                            <Textarea id={`evidence-location-edit-${item.id}-${index}`} value={item.location} onChange={(e) => updateEvidence(index, 'location', e.target.value)} placeholder="Location details" className="bg-input border-border text-sm py-1.5 px-3" rows={1} />
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
                            <CardTitle className="text-lg text-foreground flex items-center"><Paperclip className="mr-2 h-5 w-5 text-brand"/>Photos (Links)</CardTitle>
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
                                        {photos.length > 0 && ( // Show remove if at least one photo, or > 1 if you want to keep at least one field
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removePhotoLink(index)} className="text-destructive hover:text-destructive/80 h-8 w-8" title="Remove Photo Link">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {link && ( // Display image preview if link is not empty
                                        <img
                                            src={link}
                                            alt={`Photo ${index + 1}`}
                                            className="mt-2 max-w-full h-auto max-h-48 rounded border border-border object-contain"
                                            onError={(e) => (e.currentTarget.style.display = 'none')} // Hide if image fails to load
                                            onLoad={(e) => (e.currentTarget.style.display = 'block')} // Show once loaded
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
                            <CardTitle className="text-lg text-foreground flex items-center"><Video className="mr-2 h-5 w-5 text-brand"/>Bodycam/Dashcam/Video Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea id="videoNotesEdit" value={videoNotes} onChange={(e) => setVideoNotes(e.target.value)} placeholder="Add links to bodycam/dashcam footage, YouTube videos, or general notes about video evidence..." className="bg-input border-border py-1.5 px-3" rows={3} />
                        </CardContent>
                    </Card>
                    {/* Gang Info Card */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                         <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-brand"/>Gang Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea id="gangInfoEdit" value={gangInfo} onChange={(e) => setGangInfo(e.target.value)} placeholder="Details about gang involvement, if any..." className="bg-input border-border py-1.5 px-3" rows={3} />
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="updates" className="flex-grow flex flex-col space-y-6 pb-4 overflow-y-auto custom-scrollbar pr-4 pl-1">
                    {/* Add New Update Section */}
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader className="pt-6">
                            <CardTitle className="text-lg text-foreground flex items-center"><MessageSquarePlus className="mr-2 h-5 w-5 text-brand"/>Add New Update</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Type your update here..."
                                className="bg-input border-border"
                                rows={3}
                            />
                            <Button onClick={handleAddNoteClick} disabled={isSaving || !newNote.trim()} className="bg-brand text-brand-foreground hover:bg-brand/90">
                                <Plus className="mr-2 h-4 w-4" /> Add Update & Save
                            </Button>
                        </CardContent>
                    </Card>
                    {/* Existing Updates List */}
                    <div className="space-y-4">
                        {updates.map(update => (
                            <Card key={update.id} className="bg-input/30 border-border/60 shadow-sm">
                                <CardContent className="p-4 space-y-2">
                                    {editingUpdateId === update.id ? (
                                        <div className="space-y-2">
                                            <Textarea
                                                value={editedUpdateText}
                                                onChange={(e) => setEditedUpdateText(e.target.value)}
                                                className="bg-input border-border"
                                                rows={3}
                                            />
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={handleSaveEditUpdate} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
                                                    <Save className="mr-1 h-3 w-3" /> Save
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={handleCancelEditUpdate}>Cancel</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm whitespace-pre-line break-words">{update.note}</p>
                                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                <span>
                                                    By: {update.userName} on {formatTimestampForDisplay(update.timestamp)}
                                                    {update.edited && <em className="ml-1">(edited)</em>}
                                                </span>
                                                {canModifyUpdate(update) && (
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="icon" onClick={() => handleEditUpdateClick(update)} className="h-6 w-6 text-muted-foreground hover:text-foreground" title="Edit Update">
                                                            <Edit className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteUpdateClick(update.id)} className="h-6 w-6 text-destructive hover:text-destructive/80" title="Delete Update">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                        {updates.length === 0 && <p className="text-muted-foreground italic">No updates for this case yet.</p>}
                    </div>
                </TabsContent>
                
                <TabsContent value="warrant" className="flex-grow flex flex-col space-y-6 pb-4 overflow-y-auto custom-scrollbar pr-4 pl-1">
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <h3 className="text-lg font-semibold text-white flex items-center"><FileText className="mr-2 h-5 w-5 text-brand"/>Arrest Warrant Preview</h3>
                        <div className="flex gap-2">
                             <Button variant="outline" size="sm" onClick={handleRegenerateWarrantPreview} title="Regenerate text preview" className="bg-blue-600 hover:bg-blue-700 text-white border-blue-700">
                                <RefreshCw className="mr-2 h-3 w-3" /> Regenerate
                            </Button>
                            <Button variant="outline" size="sm" onClick={exportAsPdf} disabled={isGeneratingDocx || !warrantText} className="bg-red-600 hover:bg-red-700 text-white border-red-700">
                                <Download className="mr-2 h-3 w-3" /> Export PDF
                            </Button>
                            <Button variant="outline" size="sm" onClick={exportAsDocx} disabled={isGeneratingDocx || !warrantText} className="bg-green-600 hover:bg-green-700 text-white border-green-700">
                                <Download className="mr-2 h-3 w-3" /> Export DOCX
                            </Button>
                        </div>
                    </div>
                    <Textarea
                        readOnly
                        value={warrantText}
                        className="flex-grow w-full bg-input border-border font-mono text-xs whitespace-pre-line break-words py-1.5 px-3"
                        placeholder="Warrant text preview will be generated here based on case details..."
                        style={{ minHeight: '300px' }} // Ensure it has a decent height
                    />
                    <p className="text-xs text-muted-foreground italic mt-1 shrink-0">
                        This is a simplified preview. The exported DOCX will follow the official template structure.
                    </p>
                </TabsContent>
            </Tabs>

            {/* Footer with Save Button */}
            <div className="pt-6 mt-6 border-t-2 border-brand shrink-0 flex justify-end">
                <Button 
                    type="button" 
                    onClick={() => handleSave(true)} 
                    disabled={isSaving || isGeneratingDocx || !title.trim()}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save All Changes'}
                </Button>
            </div>
        </DialogContent>
    </Dialog>
    );
};

export default EditCaseModal;
