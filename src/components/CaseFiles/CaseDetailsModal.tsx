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
import { FaTrash, FaPlus, FaTimes, FaSave, FaFileWord, FaFilePdf, FaSync, FaSearch } from 'react-icons/fa'; // Import FaSearch
import { formatTimestampForDisplay } from '../../utils/timeHelpers'; // Assuming this helper exists and handles Timestamp
// Import necessary components from docx
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType, ImageRun, AlignmentType, BorderStyle, VerticalAlign, UnderlineType } from 'docx';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import penalCodesData from './penal_codes.ts'; // Import penal codes data

// Define Penal Code structure
interface PenalCode {
    pc: string;
    offense_class: string;
    title: string;
    description: string;
    fine: number;
    prison_time_months: number;
}

// Define structure for dynamic lists if not already imported/defined
interface EvidenceItem { id: number; description: string; location: string; }
// Updated NameOfInterest to include optional cid and phoneNumber
interface NameOfInterest { id: number; name: string; role: string; affiliation: string; cid?: string; phoneNumber?: string; }
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
    const [videoNotes, setVideoNotes] = useState<string>(''); // State for video notes
    const [status, setStatus] = useState<CaseStatus>(caseData.status);
    const [assignedToId, setAssignedToId] = useState<string | null>(caseData.assignedToId ?? null); // Ensure null if undefined
    const [updates, setUpdates] = useState<CaseUpdate[]>([]); // State for existing updates
    const [newNote, setNewNote] = useState(''); // State for adding a new note
    const [isSaving, setIsSaving] = useState(false);
    const [warrantText, setWarrantText] = useState(''); // State for generated warrant text preview
    const [isGeneratingDocx, setIsGeneratingDocx] = useState(false); // State for DOCX generation loading

    // --- Penal Code Search State ---
    const [penalCodes, setPenalCodes] = useState<PenalCode[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [searchResults, setSearchResults] = useState<PenalCode[]>([]);
    const [selectedCharges, setSelectedCharges] = useState<PenalCode[]>([]);

    // Load penal codes on mount
    useEffect(() => {
        setPenalCodes(penalCodesData as PenalCode[]);
    }, []);

    // Handle search term change and filter results
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
        setSearchResults(filtered.slice(0, 10)); // Limit results
    }, [searchTerm, penalCodes]);

    // --- Penal Code Handlers ---
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
    // --- End Penal Code Handlers ---

    // --- Initialize State from caseData.details ---
    useEffect(() => {
        if (caseData.details) {
            try {
                const details = JSON.parse(caseData.details);
                setIncidentReport(details.incidentReport || '');
                // Ensure default empty item if array is empty/missing
                setEvidence(details.evidence?.length ? details.evidence : [{ id: Date.now(), description: '', location: '' }]);
                // Initialize names with new fields, providing defaults
                setNamesOfInterest(details.namesOfInterest?.length
                    ? details.namesOfInterest.map((n: any) => ({ ...n, id: n.id || Date.now(), cid: n.cid || '', phoneNumber: n.phoneNumber || '' }))
                    : [{ id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]
                );
                setLocation(details.location || '');
                setGangInfo(details.gangInfo || '');
                setVideoNotes(details.videoNotes || ''); // Load video notes
                setUpdates(details.updates || []); // Load existing updates/notes
                setSelectedCharges(details.charges || []); // Load existing charges
            } catch (e) {
                console.error("Failed to parse case details JSON:", e);
                toast.error("Error loading case details.");
                // Initialize with defaults if parsing fails
                setEvidence([{ id: Date.now(), description: '', location: '' }]);
                setNamesOfInterest([{ id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]);
                setSelectedCharges([]); // Initialize charges as empty array
                setVideoNotes('');
            }
        } else {
             // Initialize with defaults if details are missing
             setEvidence([{ id: Date.now(), description: '', location: '' }]);
             setNamesOfInterest([{ id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]);
             setSelectedCharges([]); // Initialize charges as empty array
             setVideoNotes('');
        }
        // Ensure photos has at least one empty string if empty
        // Use caseData.imageLinks directly for initialization
        setPhotos(caseData.imageLinks?.length ? caseData.imageLinks : ['']);
        // Ensure assignedToId state is correctly initialized or updated if caseData changes
        setAssignedToId(caseData.assignedToId ?? null);
        // Generate initial warrant text (will be updated later if charges change)
        // setWarrantText(generateWarrantTextPreview()); // Moved generation to after state update
    }, [caseData]); // Rerun if caseData changes

    // Regenerate warrant preview whenever relevant data changes
    useEffect(() => {
        setWarrantText(generateWarrantTextPreview());
    }, [title, incidentReport, location, summary, namesOfInterest, evidence, photos, gangInfo, videoNotes, selectedCharges, currentUser, caseData.id]);


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

    const addNameRow = () => setNamesOfInterest([...namesOfInterest, { id: Date.now(), name: '', role: '', affiliation: '', cid: '', phoneNumber: '' }]); // Add with new fields
    // Updated updateName handler
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
            // Filter names, keeping new fields
            namesOfInterest: namesOfInterest.filter(n => n.name.trim() || n.role.trim() || n.affiliation.trim() || n.cid?.trim() || n.phoneNumber?.trim()),
            gangInfo,
            videoNotes, // Include video notes
            charges: selectedCharges, // Include updated charges
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
            // Ensure updates array exists before pushing
            if (!updatedDetailsObject.updates) {
                updatedDetailsObject.updates = [];
            }
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
            lastUpdatedAt: serverTimestamp() as Timestamp, // Use lastUpdatedAt for consistency if needed, or updatedAt
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


    // --- Warrant Template Generation ---
    // Generates a *plain text preview* for the textarea
    // Updated to potentially include CID/Phone for witnesses and video notes
    const generateWarrantTextPreview = (): string => {
        const primarySuspect = namesOfInterest.find(n => n.role?.toLowerCase().includes('suspect'))?.name || '[Suspect Name]';
        const otherSuspects = namesOfInterest.filter(n => n.role?.toLowerCase().includes('suspect') && n.name !== primarySuspect).map(n => n.name).join(', ') || 'None';
        // Include CID and Phone in witness summary if available
        const witnesses = namesOfInterest
            .filter(n => n.role?.toLowerCase().includes('witness'))
            .map(w => `${w.name}${w.cid ? ` (CID: ${w.cid})` : ''}${w.phoneNumber ? ` (Phone: ${w.phoneNumber})` : ''}`)
            .join(', ') || 'None';
        const victims = namesOfInterest.filter(n => n.role?.toLowerCase().includes('victim')).map(v => v.name).join(', ') || 'None';
        const evidenceSummary = evidence.filter(e => e.description.trim()).map((e, i) => `  - Exhibit ${String.fromCharCode(65 + i)}: ${e.description} (Collected at: ${e.location || 'N/A'})`).join('\n') || '  - No specific evidence listed.';
        const photoSummary = photos.filter(p => p.trim()).map((p, i) => `  - Photo ${i + 1}: ${p}`).join('\n') || '  - No photo links provided.';
        // Use selectedCharges for the preview
        const chargesSummary = selectedCharges.length > 0
            ? selectedCharges.map(c => `  - ${c.pc}: ${c.title}`).join('\n')
            : '  - No charges listed.';

        // Simplified text template for preview
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
**VIDEO EVIDENCE NOTES:**
${videoNotes || 'N/A'}
**GANG INFO:** ${gangInfo || 'N/A'}

*(This is a simplified preview. The exported DOCX will follow the official template structure.)*
        `;
        return template.trim();
    };

     // Function to regenerate warrant text preview
     const handleRegenerateWarrantPreview = () => {
        setWarrantText(generateWarrantTextPreview());
        toast.info("Warrant preview regenerated.");
    };
    // --- End Warrant Template Generation ---

    // --- Export Functions ---

    // Helper function to fetch image as ArrayBuffer
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

        // 1. Fetch the image (assuming it's in the public folder)
        const imageUrl = '/images/image1.png'; // Path relative to the public folder
        const imageBuffer = await fetchImage(imageUrl);

        // 2. Prepare Data
        const primarySuspect = namesOfInterest.find(n => n.role?.toLowerCase().includes('suspect'));
        const suspectName = primarySuspect?.name || '[Suspect Name]';
        // Use CID from Names of Interest if available
        const suspectCID = primarySuspect?.cid || '[CID#]';
        const officerName = currentUser?.name || '[Officer Name]';
        // Use selectedCharges from state
        const criminalCodes = selectedCharges.map(charge => ({
            code: charge.pc,
            title: charge.title
        }));
        // Add placeholders if no charges selected, to maintain table structure
        if (criminalCodes.length === 0) {
            criminalCodes.push({ code: '[No Charges]', title: '[No Charges Listed]' });
        }

        const evidenceList = evidence.filter(e => e.description.trim());
        // Include CID and Phone in witness list for DOCX
        const witnessList = namesOfInterest
            .filter(n => n.role?.toLowerCase().includes('witness'))
            .map(w => ({
                name: w.name,
                cid: w.cid || 'N/A',
                phone: w.phoneNumber || 'N/A'
            }));


        // Construct Probable Cause Statement (example, needs refinement based on actual needs)
        const probableCause = `Based on the evidence collected and witness testimonies obtained during the investigation of case #${caseData.id || '[Case ID]'}, there is substantial reason to believe that ${suspectName} (CID: ${suspectCID}) committed the offenses listed. Evidence includes ${evidenceList.map((e, i) => `Exhibit ${String.fromCharCode(65 + i)} (${e.description})`).join(', ')}. Witness statements corroborate these findings. Therefore, an arrest warrant is requested.`;


        try {
            // 3. Build DOCX Document using docx library
            const docChildren: (Paragraph | Table | undefined)[] = [];

            // Add Image if fetched successfully
            if (imageBuffer) {
                docChildren.push(
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: imageBuffer,
                                transformation: {
                                    width: 310, // Approximate size from HTML
                                    height: 308,
                                },
                                type: "png", // Specify the image type (e.g., "png", "jpeg")
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                    })
                );
            }

            // Add Title
            docChildren.push(
                new Paragraph({
                    text: "THE SUPERIOR COURT OF THE STATE",
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 100 },
                })
            );

            // Add State vs Defendant Table
            docChildren.push(
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    columnWidths: [5000, 4500], // Adjust as needed
                    borders: { // No borders for this layout table
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
                                        new Paragraph(" "), // Spacer
                                        new Paragraph("        vs."),
                                        new Paragraph(" "), // Spacer
                                        new Paragraph({ // Suspect Name (Placeholder styling)
                                            children: [new TextRun({ text: suspectName, underline: { type: UnderlineType.SINGLE } })]
                                        }),
                                        new Paragraph("        DEFENDANT"),
                                    ],
                                    verticalAlign: VerticalAlign.TOP,
                                }),
                                new TableCell({
                                    children: [
                                        new Paragraph({ text: "ARREST WARRANT FOR", alignment: AlignmentType.CENTER, style: "Strong" }),
                                        new Paragraph({ // Name + CID (Placeholder styling)
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

            // Add Introductory Paragraph
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

            // Add Violations Table Header
             docChildren.push(
                new Paragraph({
                    text: "Violations of Criminal Codes Committed",
                    alignment: AlignmentType.CENTER,
                    style: "Strong",
                    spacing: { before: 200, after: 100 },
                })
            );

            // Add Violations Table (using actual criminalCodes from state)
            const violationRows = [
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ text: "Criminal Code", style: "Strong" })], verticalAlign: VerticalAlign.CENTER }),
                        new TableCell({ children: [new Paragraph({ text: "Criminal Code Title", style: "Strong" })], verticalAlign: VerticalAlign.CENTER }),
                    ],
                    tableHeader: true,
                }),
                // Map actual criminal codes here
                ...criminalCodes.map(cc => new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ text: cc.code, alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
                        new TableCell({ children: [new Paragraph(cc.title)], verticalAlign: VerticalAlign.CENTER }),
                    ]
                })),
                 // Add empty rows if needed to match template structure (ensure at least 5 rows total)
                 ...Array(Math.max(0, 5 - criminalCodes.length)).fill(0).map(() => new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph(" ")] }), // Empty cell
                        new TableCell({ children: [new Paragraph(" ")] }), // Empty cell
                    ]
                }))
            ];
            docChildren.push(
                new Table({
                    rows: violationRows,
                    width: { size: 90, type: WidthType.PERCENTAGE }, // Adjust width
                    columnWidths: [2000, 7500], // Adjust column widths
                    alignment: AlignmentType.CENTER,
                     borders: { // Standard borders
                        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    },
                })
            );

             // Add Evidence Table Header
             docChildren.push(
                new Paragraph({
                    text: "Evidence Supporting Arrest Warrant",
                    alignment: AlignmentType.CENTER,
                    style: "Strong",
                    spacing: { before: 400, after: 100 }, // Add more space before
                })
            );

            // Add Evidence Table (Including Witnesses)
            const evidenceRows = [
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ text: "Evidence / Witness", style: "Strong" })], verticalAlign: VerticalAlign.CENTER }),
                        new TableCell({ children: [new Paragraph({ text: "Description / Details", style: "Strong" })], verticalAlign: VerticalAlign.CENTER }),
                    ],
                    tableHeader: true,
                }),
                // Map actual evidence
                ...evidenceList.map((item, index) => new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph(`Exhibit ${String.fromCharCode(65 + index)}`)], verticalAlign: VerticalAlign.CENTER }),
                        new TableCell({ children: [new Paragraph(item.description)], verticalAlign: VerticalAlign.CENTER }), // Display description
                    ]
                })),
                 // Map actual witnesses with details
                 ...witnessList.map((item, index) => new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph(`Witness ${String.fromCharCode(65 + index)}`)], verticalAlign: VerticalAlign.CENTER }),
                        new TableCell({ children: [new Paragraph(`${item.name} (CID: ${item.cid}, Phone: ${item.phone})`)], verticalAlign: VerticalAlign.CENTER }), // Display witness details
                    ]
                })),
                 // Add empty rows if needed (ensure at least 10 rows total)
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
                     borders: { // Standard borders
                        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    },
                })
            );

            // Add Officer's Admissions Header
            docChildren.push(
                new Paragraph({
                    text: "Officer’s Admissions",
                    alignment: AlignmentType.CENTER,
                    style: "Strong",
                    spacing: { before: 400, after: 100 },
                })
            );

            // Add Probable Cause Table
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
                                new TableCell({ children: [new Paragraph(new Date().toLocaleDateString())], verticalAlign: VerticalAlign.TOP }), // Date cell
                                new TableCell({ children: [new Paragraph(probableCause)], verticalAlign: VerticalAlign.TOP }), // Probable cause text
                            ],
                        }),
                    ],
                    width: { size: 90, type: WidthType.PERCENTAGE },
                    columnWidths: [2000, 7500],
                    alignment: AlignmentType.CENTER,
                     borders: { // Standard borders
                        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    },
                })
            );


            // Add Signature Block
            docChildren.push(
                new Paragraph({ text: " ", spacing: { before: 400 } }), // Spacer
                new Paragraph({ text: "_________________________ ", alignment: AlignmentType.RIGHT }),
                new Paragraph({ text: "Signature", alignment: AlignmentType.RIGHT }),
                new Paragraph({ text: officerName, alignment: AlignmentType.RIGHT }),
                new Paragraph({ text: "District Attorney’s Office", alignment: AlignmentType.RIGHT }), // Or Officer's Department
                new Paragraph({ text: `Callsign: ${currentUser?.callsign || '[Callsign]'}`, alignment: AlignmentType.RIGHT }), // Add Callsign or Bar Number
                new Paragraph({ text: new Date().toLocaleDateString(), alignment: AlignmentType.RIGHT }),
                new Paragraph({ text: "Date Filed", alignment: AlignmentType.RIGHT })
            );


            // 4. Create Document and Packer
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
                    children: docChildren.filter((c): c is Paragraph | Table => !!c), // Filter out undefined
                }],
            });

            // 5. Generate Blob and Save
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
        if (!warrantText) return; // Use the preview text for PDF for now
        const doc = new jsPDF();
        // Basic text export, might need refinement for better formatting
        doc.text(warrantText, 10, 10);
        doc.save(`WarrantPreview_${caseData.title.replace(/ /g, '_') || 'Case'}.pdf`);
        toast.success("Warrant preview exported as PDF.");
    };
    // --- End Export Functions ---

    // Determine if case is active
    const isActive = ['Open - Unassigned', 'Open - Assigned', 'Under Review'].includes(status);


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
                <TabsContent value="details" className="flex-grow space-y-5 overflow-y-auto pr-2 pl-1 pb-2 custom-scrollbar">
                    {/* Basic Info Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            {/* Change text color */}
                            <CardTitle className="text-lg text-white">Basic Information</CardTitle>
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

                    {/* Charges Card - NEW */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Charges</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Search Input */}
                            <div className="relative">
                                <Label htmlFor="chargeSearchEdit">Search Penal Codes</Label>
                                <div className="flex items-center">
                                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 mt-3" />
                                    <Input
                                        id="chargeSearchEdit"
                                        type="text"
                                        placeholder="Search by PC, Title, or Description..."
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        className="bg-input border-border pl-10" // Add padding for icon
                                        disabled={isSaving || isGeneratingDocx}
                                    />
                                </div>
                                {/* Search Results Dropdown */}
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

                            {/* Selected Charges Table */}
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

                    {/* Names of Interest Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            {/* Change text color */}
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
                                            <Input value={item.name} onChange={(e) => updateName(index, 'name', e.target.value)} placeholder="Full Name" className="bg-input border-border" disabled={isSaving}/>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">CID#</Label>
                                            <Input value={item.cid || ''} onChange={(e) => updateName(index, 'cid', e.target.value)} placeholder="Citizen ID (Optional)" className="bg-input border-border" disabled={isSaving}/>
                                        </div>
                                         <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Phone Number</Label>
                                            <Input value={item.phoneNumber || ''} onChange={(e) => updateName(index, 'phoneNumber', e.target.value)} placeholder="Phone # (Optional)" className="bg-input border-border" disabled={isSaving}/>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Role</Label>
                                            <Input value={item.role} onChange={(e) => updateName(index, 'role', e.target.value)} placeholder="Suspect, Witness, Victim..." className="bg-input border-border" disabled={isSaving}/>
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <Label className="text-xs text-muted-foreground">Gang Affiliation / Notes</Label>
                                            <Input value={item.affiliation} onChange={(e) => updateName(index, 'affiliation', e.target.value)} placeholder="Gang Name or relevant notes" className="bg-input border-border" disabled={isSaving}/>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {/* Change button style */}
                            <Button type="button" variant="outline" size="sm" onClick={addNameRow} className="mt-2 bg-[#f3c700] text-white hover:bg-[#f3c700]/90 border-0" disabled={isSaving}>
                                <FaPlus className="mr-2 h-3 w-3" /> Add Person
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Evidence Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            {/* Change text color */}
                            <CardTitle className="text-lg text-white">Evidence</CardTitle>
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
                            {/* Change button style */}
                            <Button type="button" variant="outline" size="sm" onClick={addEvidenceRow} className="mt-2 bg-[#f3c700] text-white hover:bg-[#f3c700]/90 border-0" disabled={isSaving}>
                                <FaPlus className="mr-2 h-3 w-3" /> Add Evidence
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Photos Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            {/* Change text color */}
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
                                            disabled={isSaving}
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
                                    {/* Conditionally display the image */}
                                    {link && (
                                        <img
                                            src={link}
                                            alt={`Photo ${index + 1}`}
                                            className="mt-2 max-w-full h-auto max-h-48 rounded border border-border object-contain" // Added styling
                                            // Optional: Hide broken image links
                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                            onLoad={(e) => (e.currentTarget.style.display = 'block')} // Ensure it shows on load
                                        />
                                    )}
                                </div>
                            ))}
                            {/* Change button style */}
                            <Button type="button" variant="outline" size="sm" onClick={addPhotoLink} className="mt-2 bg-[#f3c700] text-white hover:bg-[#f3c700]/90 border-0" disabled={isSaving}>
                                <FaPlus className="mr-2 h-3 w-3" /> Add Photo Link
                            </Button>
                        </CardContent>
                    </Card>

                     {/* Video Evidence Notes Card - NEW */}
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
                                disabled={isSaving}
                            />
                        </CardContent>
                    </Card>

                    {/* Gang Info Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                         <CardHeader>
                            {/* Change text color */}
                            <CardTitle className="text-lg text-white">Gang Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea id="gangInfo" value={gangInfo} onChange={(e) => setGangInfo(e.target.value)} placeholder="Details about gang involvement, if any..." rows={4} className="bg-input border-border" disabled={isSaving} />
                        </CardContent>
                    </Card>

                    {/* Status and Assignment Card */}
                    <Card className="bg-black/95 border-border shadow-sm">
                        <CardHeader>
                            {/* Change text color */}
                            <CardTitle className="text-lg text-white">Status & Assignment</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <div className="flex items-center space-x-2">
                                     {/* Green dot for active status */}
                                    {isActive && <span className="h-2.5 w-2.5 bg-green-500 rounded-full inline-block" title="Active Case"></span>}
                                    <Select value={status} onValueChange={(value: CaseStatus) => handleStatusChange(value)} disabled={isSaving}>
                                        <SelectTrigger className="bg-input border-border flex-1"> {/* Use flex-1 to allow dot */}
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
                <TabsContent value="updates" className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2 pl-1 pb-2 custom-scrollbar">
                    {/* Existing Updates List */}
                    <div className="space-y-3 flex-grow overflow-y-auto pr-1 custom-scrollbar">
                        {updates.length === 0 && !newNote ? (
                            <p className="text-muted-foreground italic text-sm">No updates recorded yet.</p>
                        ) : (
                            // Sort updates newest first for display
                            [...updates].sort((a, b) => (b.timestamp?.toDate?.()?.getTime() || 0) - (a.timestamp?.toDate?.()?.getTime() || 0)).map((update, index) => (
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
                <TabsContent value="warrant" className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2 pl-1 pb-2 custom-scrollbar">
                     <div className="flex justify-between items-center mb-2">
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
                        value={warrantText} // Display the preview text
                        className="flex-grow w-full bg-input border-border font-mono text-xs h-[calc(100%-60px)] resize-none" // Adjust height as needed
                        rows={25} // Give it a decent default size
                        placeholder="Warrant text preview will be generated here based on case details..."
                    />
                     <p className="text-xs text-muted-foreground italic mt-1">
                        Use 'Export DOCX' to generate the official warrant document using the template structure. The text area shows a simplified preview. Review the exported DOCX thoroughly.
                    </p>
                </TabsContent>
            </Tabs>

            {/* Footer: Use accent border */}
            <div className="pt-4 mt-4 border-t-2 border-[#f3c700] shrink-0 flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving || isGeneratingDocx}>Cancel</Button>
                {/* Use accent color for save button */}
                <Button type="button" onClick={handleSave} disabled={isSaving || isGeneratingDocx} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <FaSave className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </div>
    );
};

export default EditCaseModal;
