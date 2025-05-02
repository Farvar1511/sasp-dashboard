import React, { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, serverTimestamp, Timestamp, FieldValue } from 'firebase/firestore';
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
import { FaTrash, FaPlus, FaTimes, FaSave, FaFileWord, FaFilePdf, FaSync, FaSearch, FaEdit, FaCheck, FaBan } from 'react-icons/fa';
import { formatTimestampForDisplay } from '../../utils/timeHelpers';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType, ImageRun, AlignmentType, BorderStyle, VerticalAlign, UnderlineType } from 'docx';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import penalCodesData from './penal_codes.ts';
import { computeIsAdmin } from '../../utils/isadmin';
import ConfirmationModal from '../ConfirmationModal';

interface PenalCode {
    pc: string;
    offense_class: string;
    title: string;
    description: string;
    fine: number;
    prison_time_months: number;
}

interface EvidenceItem {
    id: number;
    type: 'Blood' | 'Casing' | 'Weapon' | 'Document' | 'Digital' | 'Other';
    description: string;
    location: string;
    notes?: string;
    photoLink?: string;
}

interface NameOfInterest { id: number; name: string; role: string; affiliation: string; cid?: string; phoneNumber?: string; }
interface CaseUpdate {
    id: string | number;
    timestamp: Timestamp | Date;
    userId: string;
    userName: string;
    note: string;
    edited?: boolean;
    editedByUserId?: string;
    editedByUserName?: string;
}

interface EditCaseModalProps {
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

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [updateToDeleteId, setUpdateToDeleteId] = useState<string | number | null>(null);

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
                    ? details.evidence.map((e: any) => ({
                        id: e.id || Date.now(),
                        type: e.type || 'Other',
                        description: e.description || '',
                        location: e.location || '',
                        notes: e.notes || '',
                        photoLink: e.photoLink || '',
                      }))
                    : [{ id: Date.now(), type: 'Other', description: '', location: '', notes: '', photoLink: '' }]);
                setNamesOfInterest(details.namesOfInterest?.length
                    ? details.namesOfInterest.map((n: any) => ({ ...n, id: n.id || Date.now(), cid: n.cid || '', phoneNumber: n.phoneNumber || '' }))
                    : [{ id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]
                );
                setLocation(details.location || '');
                setGangInfo(details.gangInfo || '');
                setVideoNotes(details.videoNotes || '');
                setUpdates(details.updates?.map((u: any, index: number) => ({
                    ...u,
                    id: u.id || (u.timestamp?.toMillis ? u.timestamp.toMillis() : `initial-${Date.now()}-${index}`),
                    timestamp: u.timestamp?.toDate ? u.timestamp.toDate() : (u.timestamp instanceof Date ? u.timestamp : new Date()),
                    edited: u.edited || false,
                    editedByUserId: u.editedByUserId || undefined,
                    editedByUserName: u.editedByUserName || undefined,
                })) || []);
                setSelectedCharges(details.charges || []);
                setPhotoSectionDescription(details.photoSectionDescription || '');
            } catch (e) {
                console.error("Failed to parse case details JSON:", e);
                toast.error("Error loading case details.");
                setEvidence([{ id: Date.now(), type: 'Other', description: '', location: '', notes: '', photoLink: '' }]);
                setNamesOfInterest([{ id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]);
                setUpdates([]);
                setSelectedCharges([]);
                setVideoNotes('');
                setPhotoSectionDescription('');
            }
        } else {
             setEvidence([{ id: Date.now(), type: 'Other', description: '', location: '', notes: '', photoLink: '' }]);
             setNamesOfInterest([{ id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]);
             setUpdates([]);
             setSelectedCharges([]);
             setVideoNotes('');
             setPhotoSectionDescription('');
        }
        setPhotos(caseData.imageLinks?.length ? caseData.imageLinks : ['']);
        setAssignedToId(caseData.assignedToId ?? null);
    }, [caseData]);

    useEffect(() => {
        setWarrantText(generateWarrantTextPreview());
    }, [title, incidentReport, location, summary, namesOfInterest, evidence, photos, photoSectionDescription, gangInfo, videoNotes, selectedCharges, currentUser, caseData.id]);

    const addEvidenceRow = () => setEvidence([...evidence, { id: Date.now(), type: 'Other', description: '', location: '', notes: '', photoLink: '' }]);
    const updateEvidence = (index: number, field: keyof EvidenceItem, value: string | EvidenceItem['type']) => {
        const updated = [...evidence];
        updated[index] = { ...updated[index], [field]: value as any };
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

    const canModifyUpdate = (update: CaseUpdate): boolean => {
        if (!currentUser) return false;
        if (isAdmin) return true;
        if (update.userId === currentUser.id) return true;
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

        const originalUpdates = [...updates];
        const updatedUpdates = updates.map(u =>
            u.id === editingUpdateId
                ? {
                    ...u,
                    note: editedUpdateText,
                    edited: true,
                    timestamp: new Date(),
                    editedByUserId: currentUser.id,
                    editedByUserName: currentUser.name
                  }
                : u
        );
        setUpdates(updatedUpdates);
        setEditingUpdateId(null);
        setEditedUpdateText('');

        const success = await handleSave(false, updatedUpdates);

        if (!success) {
            setUpdates(originalUpdates);
            toast.error("Failed to save update edit.");
        } else {
            toast.success("Update edited successfully.");
        }
    };

    const handleDeleteUpdateClick = (updateId: string | number) => {
        setUpdateToDeleteId(updateId);
        setIsConfirmModalOpen(true);
    };

    const confirmDeleteUpdate = async () => {
        if (updateToDeleteId === null) return;

        const originalUpdates = [...updates];
        const updatedUpdates = updates.filter(u => u.id !== updateToDeleteId);
        setUpdates(updatedUpdates);

        setIsConfirmModalOpen(false);
        setUpdateToDeleteId(null);

        const success = await handleSave(false, updatedUpdates);

        if (!success) {
            setUpdates(originalUpdates);
            toast.error("Failed to delete update.");
        } else {
            toast.success("Update deleted successfully.");
        }
    };

    const cancelDeleteUpdate = () => {
        setIsConfirmModalOpen(false);
        setUpdateToDeleteId(null);
    };

    const handleSave = async (closeOnSuccess: boolean = true, updatesToSave?: CaseUpdate[]): Promise<boolean> => {
        if (!currentUser || !caseData.id) {
            toast.error("Cannot save changes. User or Case ID missing.");
            return false;
        }
        if (!title) {
            toast.error("Case Title is required.");
            return false;
        }
        setIsSaving(true);

        const assignedUser = eligibleAssignees.find(u => u.id === assignedToId);

        let finalUpdates = updatesToSave ? [...updatesToSave] : [...updates];
        let newUpdateEntryForFirestore: any = null;

        if (!updatesToSave && newNote.trim()) {
             const temporaryId = `temp-${Date.now()}`;
             newUpdateEntryForFirestore = {
                timestamp: serverTimestamp(),
                userId: currentUser?.id || 'Unknown',
                userName: currentUser?.name || 'Unknown',
                note: newNote.trim(),
                edited: false,
             };
            finalUpdates.push({
                ...newUpdateEntryForFirestore,
                id: temporaryId,
                timestamp: new Date(),
            });

            if (!closeOnSuccess) {
                setUpdates(finalUpdates);
                setNewNote('');
            }
        }

        const updatesForFirestore = finalUpdates.map(u => {
            const { id, ...rest } = u;
            let timestampForFirestore: Timestamp | FieldValue = serverTimestamp();

            if (u.timestamp instanceof Timestamp) {
                timestampForFirestore = u.timestamp;
            } else if (u.timestamp instanceof Date) {
                if (u.editedByUserId || !id?.toString().startsWith('temp-')) {
                     timestampForFirestore = Timestamp.fromDate(u.timestamp);
                }
            }
            const editedFields = u.edited ? { editedByUserId: u.editedByUserId, editedByUserName: u.editedByUserName } : {};

            return {
                ...rest,
                timestamp: timestampForFirestore,
                ...editedFields
            };
        });

        const updatedDetailsObject = {
            incidentReport,
            evidence: evidence.filter(e => e.description.trim() || e.location.trim() || e.notes?.trim() || e.photoLink?.trim()),
            photos: photos.filter(p => p.trim()),
            photoSectionDescription,
            location,
            namesOfInterest: namesOfInterest.filter(n => n.name.trim() || n.role.trim() || n.affiliation.trim() || n.cid?.trim() || n.phoneNumber?.trim()),
            gangInfo,
            videoNotes,
            charges: selectedCharges,
            updates: updatesForFirestore
        };

        const updateData: Partial<CaseFile> & { details: string; lastUpdatedAt: Timestamp } = {
            title,
            description: summary,
            status,
            assignedToId: assignedToId,
            assignedToName: assignedUser?.name || null,
            imageLinks: updatedDetailsObject.photos,
            details: JSON.stringify(updatedDetailsObject),
            lastUpdatedAt: serverTimestamp() as Timestamp,
        };

        try {
            const caseRef = doc(dbFirestore, 'caseFiles', caseData.id);
            await updateDoc(caseRef, updateData as any);

            if (closeOnSuccess) {
                toast.success(`Case "${title}" updated successfully.`);
                onSaveSuccess();
                onClose();
            } else if (newUpdateEntryForFirestore && !closeOnSuccess) {
                 setNewNote('');
            }
            return true;

        } catch (error) {
            console.error("Error updating case file:", error);
            if (newUpdateEntryForFirestore && !closeOnSuccess) {
                 setUpdates(prev => prev.filter(upd => upd.id !== newUpdateEntryForFirestore.tempId));
            }
            toast.error("Failed to update case file.");
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
        const evidenceSummary = evidence.filter(e => e.description.trim() || e.location.trim() || e.notes?.trim() || e.photoLink?.trim()).map((e, i) =>
            `  - Exhibit ${String.fromCharCode(65 + i)}: [${e.type}] ${e.description}${e.notes ? ` (Notes: ${e.notes})` : ''} (Collected at: ${e.location || 'N/A'})${e.photoLink ? ` (Photo: ${e.photoLink})` : ''}`
        ).join('\n') || '  - No specific evidence listed.';
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

        const evidenceList = evidence.filter(e => e.description.trim() || e.location.trim() || e.notes?.trim() || e.photoLink?.trim()).map(e => ({
            type: e.type,
            description: e.description,
            location: e.location || 'N/A',
            notes: e.notes || '',
            photoLink: e.photoLink || '',
        }));
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
                                type: "png",
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
                        new TableCell({ children: [new Paragraph(`[${item.type}] ${item.description} (Loc: ${item.location})${item.notes ? ` Notes: ${item.notes}` : ''}${item.photoLink ? ` Photo: ${item.photoLink}` : ''}`)], verticalAlign: VerticalAlign.CENTER }),
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
            handleSave(false);
        } else {
            toast.info("Please enter a note to add.");
        }
    };

    const formatEditorName = (name: string | undefined): string => {
        if (!name) return '';
        const parts = name.split(' ');
        if (parts.length < 2) return name;
        const firstNameInitial = parts[0].charAt(0).toUpperCase();
        const lastName = parts[parts.length - 1];
        return `${firstNameInitial}. ${lastName}`;
    };

    return (
        <div className="case-details-modal-root w-[95vw] max-w-5xl mx-auto p-4 sm:p-6 md:p-8 bg-black/95 text-foreground rounded-lg shadow-2xl transition-all duration-300 ease-in-out border-[#f3c700] border-2 flex flex-col max-h-[90vh] relative">
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 sm:top-3 sm:right-3 text-muted-foreground hover:text-foreground z-10" onClick={onClose}>
                <FaTimes className="h-5 w-5" />
                <span className="sr-only">Close</span>
            </Button>

            <div className="pb-4 mb-4 border-b-2 border-[#f3c700]">
                <h2 className="text-xl md:text-2xl font-semibold">Edit Case File: {caseData.title}</h2>
            </div>

            <Tabs defaultValue="details" className="w-full flex-grow flex flex-col overflow-hidden">
                <TabsList className="mb-4 shrink-0 bg-transparent p-0 border-b border-border">
                    <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-[#f3c700] data-[state=active]:text-[#f3c700] data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Details</TabsTrigger>
                    <TabsTrigger value="updates" className="data-[state=active]:border-b-2 data-[state=active]:border-[#f3c700] data-[state=active]:text-[#f3c700] data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Updates</TabsTrigger>
                    <TabsTrigger value="warrant" className="data-[state=active]:border-b-2 data-[state=active]:border-[#f3c700] data-[state=active]:text-[#f3c700] data-[state=active]:bg-transparent text-muted-foreground px-4 py-2">Warrant</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="flex-grow space-y-5 overflow-y-auto pr-2 pl-1 pb-2 custom-scrollbar">
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="caseTitle">Case Title *</Label>
                                    <Textarea id="caseTitle" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Bank Robbery at Fleeca" rows={1} className="bg-input border-border min-h-0 h-auto resize-none py-1.5 px-3" readOnly={isSaving} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="incidentReport">Incident Report (Link or #)</Label>
                                    <Textarea id="incidentReport" value={incidentReport} onChange={(e) => setIncidentReport(e.target.value)} placeholder="e.g., #12345 or URL" rows={1} className="bg-input border-border min-h-0 h-auto resize-none py-1.5 px-3" readOnly={isSaving} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="location">Location of Incident</Label>
                                <Textarea id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Pacific Standard Bank, Vinewood Blvd" rows={1} className="bg-input border-border min-h-0 h-auto resize-none py-1.5 px-3" readOnly={isSaving} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="summary">Summary</Label>
                                <Textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Briefly summarize the investigation..." rows={4} className="bg-input border-border" readOnly={isSaving} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Charges</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <Label htmlFor="chargeSearchEdit">Search Penal Codes</Label>
                                <div className="flex items-center">
                                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                    <Input
                                        id="chargeSearchEdit"
                                        type="text"
                                        placeholder="Search by PC, Title, or Description..."
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        className="bg-input border-border pl-10 h-9"
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
                                    <div className="border rounded-md border-border overflow-hidden overflow-x-auto">
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

                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Names of Interest</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             {namesOfInterest.map((item, index) => (
                                <div key={item.id} className="p-3 border border-border/50 rounded-md space-y-3 relative">
                                     {namesOfInterest.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeNameRow(index)} className="absolute top-1 right-1 text-destructive hover:text-destructive/80 h-7 w-7" disabled={isSaving} title="Remove Person">
                                            <FaTrash className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Name</Label>
                                            <Textarea value={item.name} onChange={(e) => updateName(index, 'name', e.target.value)} placeholder="Full Name" rows={1} className="bg-input border-border min-h-0 h-auto resize-none py-1.5 px-3 text-sm" readOnly={isSaving} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">CID#</Label>
                                            <Textarea value={item.cid || ''} onChange={(e) => updateName(index, 'cid', e.target.value)} placeholder="Citizen ID (Optional)" rows={1} className="bg-input border-border min-h-0 h-auto resize-none py-1.5 px-3 text-sm" readOnly={isSaving} />
                                        </div>
                                         <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Phone Number</Label>
                                            <Textarea value={item.phoneNumber || ''} onChange={(e) => updateName(index, 'phoneNumber', e.target.value)} placeholder="Phone # (Optional)" rows={1} className="bg-input border-border min-h-0 h-auto resize-none py-1.5 px-3 text-sm" readOnly={isSaving} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Role</Label>
                                            <Textarea value={item.role} onChange={(e) => updateName(index, 'role', e.target.value)} placeholder="Suspect, Witness, Victim..." rows={1} className="bg-input border-border min-h-0 h-auto resize-none py-1.5 px-3 text-sm" readOnly={isSaving} />
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <Label className="text-xs text-muted-foreground">Gang Affiliation / Notes</Label>
                                            <Textarea value={item.affiliation} onChange={(e) => updateName(index, 'affiliation', e.target.value)} placeholder="Gang Name or relevant notes" rows={1} className="bg-input border-border min-h-0 h-auto resize-none py-1.5 px-3 text-sm" readOnly={isSaving} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addNameRow} className="mt-2 bg-[#f3c700] text-white hover:bg-[#f3c700]/90 border-0" disabled={isSaving}>
                                <FaPlus className="mr-2 h-3 w-3" /> Add Person
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Evidence</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {evidence.map((item, index) => (
                                <div key={item.id} className="p-3 border border-border/50 rounded-md space-y-3 relative">
                                     {evidence.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEvidenceRow(index)} className="absolute top-1 right-1 text-destructive hover:text-destructive/80 h-7 w-7" disabled={isSaving} title="Remove Evidence">
                                            <FaTrash className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Type</Label>
                                            <Select
                                                value={item.type}
                                                onValueChange={(value: EvidenceItem['type']) => updateEvidence(index, 'type', value)}
                                                disabled={isSaving}
                                            >
                                                <SelectTrigger className="bg-input border-border h-9 text-sm">
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-black/95 text-popover-foreground border-border shadow-md z-50">
                                                    <SelectItem value="Blood">Blood</SelectItem>
                                                    <SelectItem value="Casing">Casing</SelectItem>
                                                    <SelectItem value="Weapon">Weapon</SelectItem>
                                                    <SelectItem value="Document">Document</SelectItem>
                                                    <SelectItem value="Digital">Digital</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Location Collected</Label>
                                            <Textarea
                                                value={item.location}
                                                onChange={(e) => updateEvidence(index, 'location', e.target.value)}
                                                placeholder="Location"
                                                rows={1}
                                                className="bg-input border-border text-sm min-h-0 h-auto resize-none py-1.5 px-3"
                                                readOnly={isSaving}
                                            />
                                        </div>
                                        <div className="space-y-1 sm:col-span-3">
                                            <Label className="text-xs text-muted-foreground">Description</Label>
                                            <Textarea
                                                value={item.description}
                                                onChange={(e) => updateEvidence(index, 'description', e.target.value)}
                                                placeholder="Description of evidence"
                                                rows={1}
                                                className="bg-input border-border text-sm min-h-0 h-auto resize-none py-1.5 px-3"
                                                readOnly={isSaving}
                                            />
                                        </div>
                                        <div className="space-y-1 col-span-1 sm:col-span-3">
                                            <Label className="text-xs text-muted-foreground">Notes (Optional)</Label>
                                            <Textarea
                                                value={item.notes || ''}
                                                onChange={(e) => updateEvidence(index, 'notes', e.target.value)}
                                                placeholder="Additional notes (e.g., DNA code, serial #, file hash)"
                                                className="bg-input border-border text-sm"
                                                rows={2}
                                                readOnly={isSaving}
                                            />
                                        </div>
                                        <div className="space-y-1 col-span-1 sm:col-span-3">
                                            <Label className="text-xs text-muted-foreground">Photo Link (Optional)</Label>
                                            <Textarea
                                                value={item.photoLink || ''}
                                                onChange={(e) => updateEvidence(index, 'photoLink', e.target.value)}
                                                placeholder="https://example.com/evidence_photo.png"
                                                rows={1}
                                                className="bg-input border-border text-sm min-h-0 h-auto resize-none py-1.5 px-3"
                                                readOnly={isSaving}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addEvidenceRow} className="mt-2 bg-[#f3c700] text-white hover:bg-[#f3c700]/90 border-0" disabled={isSaving}>
                                <FaPlus className="mr-2 h-3 w-3" /> Add Evidence
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Photos (Links)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                             <div className="space-y-2">
                                <Label htmlFor="photoSectionDescriptionEdit">Photo Section Description</Label>
                                <Textarea
                                    id="photoSectionDescriptionEdit"
                                    value={photoSectionDescription}
                                    onChange={(e) => setPhotoSectionDescription(e.target.value)}
                                    placeholder="Optional: Describe the photos linked below (e.g., crime scene photos, suspect identification photos)."
                                    rows={3}
                                    className="bg-input border-border"
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
                                            rows={1}
                                            className="flex-grow bg-input border-border min-h-0 h-auto resize-none py-1.5 px-3"
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
                            <Button type="button" variant="outline" size="sm" onClick={addPhotoLink} className="mt-2 bg-[#f3c700] text-white hover:bg-[#f3c700]/90 border-0" disabled={isSaving}>
                                <FaPlus className="mr-2 h-3 w-3" /> Add Photo Link
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Bodycam/Dashcam/Video Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                id="videoNotes"
                                value={videoNotes}
                                onChange={(e) => setVideoNotes(e.target.value)}
                                placeholder="Add links to bodycam/dashcam footage, YouTube videos, or general notes about video evidence..."
                                rows={4}
                                className="bg-input border-border"
                                readOnly={isSaving}
                            />
                        </CardContent>
                    </Card>

                    <Card className="bg-black/95 border-border shadow-sm">
                         <CardHeader>
                            <CardTitle className="text-lg text-white">Gang Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea id="gangInfo" value={gangInfo} onChange={(e) => setGangInfo(e.target.value)} placeholder="Details about gang involvement, if any..." rows={4} className="bg-input border-border" readOnly={isSaving} />
                        </CardContent>
                    </Card>

                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Status & Assignment</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <div className="flex items-center space-x-2">
                                    {isActive && <span className="h-2.5 w-2.5 bg-green-500 rounded-full inline-block" title="Active Case"></span>}
                                    <Select value={status} onValueChange={(value: CaseStatus) => handleStatusChange(value)} disabled={isSaving}>
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
                                <Select value={assignedToId || "unassigned"} onValueChange={handleAssigneeChange} disabled={isSaving}>
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

                <TabsContent value="updates" className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2 pl-1 pb-2 custom-scrollbar">
                    <div className="space-y-3 flex-grow overflow-y-auto pr-1 custom-scrollbar">
                        {updates.length === 0 ? (
                            <p className="text-muted-foreground italic text-sm">No updates recorded yet.</p>
                        ) : (
                            [...updates].sort((a, b) => {
                                const timeA = a.timestamp instanceof Timestamp ? a.timestamp.toDate().getTime() : (a.timestamp instanceof Date ? a.timestamp.getTime() : 0);
                                const timeB = b.timestamp instanceof Timestamp ? b.timestamp.toDate().getTime() : (b.timestamp instanceof Date ? b.timestamp.getTime() : 0);
                                return timeB - timeA;
                            }).map((update) => (
                                <div key={update.id} className="p-3 border rounded-md bg-black/95 border-border text-sm relative group">
                                    {editingUpdateId === update.id ? (
                                        <div className="space-y-2">
                                            <Textarea
                                                value={editedUpdateText}
                                                onChange={(e) => setEditedUpdateText(e.target.value)}
                                                rows={3}
                                                className="bg-input border-border"
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
                                            <p className="whitespace-pre-wrap">{update.note}</p>
                                            <p className="text-xs text-muted-foreground text-right mt-1">
                                                - {update.userName} on {formatTimestampForDisplay(update.timestamp)}
                                                {update.edited && update.editedByUserName && (
                                                    <span className="italic"> (edited by {formatEditorName(update.editedByUserName)})</span>
                                                )}
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
                        <Label htmlFor="newNote">Add New Update/Note</Label>
                        <Textarea
                            id="newNote"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Record any updates or notes..."
                            rows={3}
                            className="bg-input border-border"
                            readOnly={isSaving || editingUpdateId !== null}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddNoteClick}
                            disabled={isSaving || !newNote.trim() || editingUpdateId !== null}
                            className="bg-[#f3c700] text-black hover:bg-[#f3c700]/90 border-0"
                        >
                            Add Note
                        </Button>
                    </div>
                </TabsContent>

                <TabsContent value="warrant" className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2 pl-1 pb-2 custom-scrollbar">
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
                            <Button variant="outline" size="sm" onClick={exportAsPdf} title="Export Preview as PDF" className="bg-red-600 hover:bg-red-700 text-white border-red-700" disabled={isGeneratingDocx || isSaving}>
                                <FaFilePdf className="mr-2 h-3 w-3" /> Export PDF Preview
                            </Button>
                        </div>
                    </div>
                    <Textarea
                        readOnly
                        value={warrantText}
                        className="flex-grow w-full bg-input border-border font-mono text-xs resize-none"
                        rows={25}
                        placeholder="Warrant text preview will be generated here based on case details..."
                    />
                     <p className="text-xs text-muted-foreground italic mt-1 shrink-0">
                        Use 'Export DOCX' to generate the official warrant document using the template structure. The text area shows a simplified preview. Review the exported DOCX thoroughly.
                    </p>
                </TabsContent>
            </Tabs>

            <div className="pt-4 mt-4 border-t-2 border-[#f3c700] shrink-0 flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving || isGeneratingDocx}>Cancel</Button>
                <Button type="button" onClick={() => handleSave()} disabled={isSaving || isGeneratingDocx || editingUpdateId !== null} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <FaSave className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={cancelDeleteUpdate}
                onCancel={cancelDeleteUpdate}
                onConfirm={confirmDeleteUpdate}
                title="Confirm Deletion"
                message="Are you sure you want to delete this update? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
            />
        </div>
    );
};

export default EditCaseModal;
