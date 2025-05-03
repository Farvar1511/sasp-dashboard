import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Gang } from '../../utils/ciuUtils'; // Corrected import path
import GangDetails from './GangDetails'; // Import GangDetails
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import { Skeleton } from '../ui/skeleton';
import ConfirmationModal from '../ConfirmationModal';
import { computeIsAdmin } from '../../utils/isadmin'; // Corrected import path

const GANGS_COLLECTION = "gangs";

const GangManagementTab: React.FC = () => {
    const { user: currentUser } = useAuth();
    const isAdmin = useMemo(() => computeIsAdmin(currentUser), [currentUser]);

    const [gangs, setGangs] = useState<Gang[]>([]);
    const [selectedGangId, setSelectedGangId] = useState<string | null>(null);
    const [loadingGangs, setLoadingGangs] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [showAddGangForm, setShowAddGangForm] = useState(false);
    const [newGangName, setNewGangName] = useState('');
    const [newGangDescription, setNewGangDescription] = useState('');
    const [newGangNotes, setNewGangNotes] = useState('');
    const [isAddingGang, setIsAddingGang] = useState(false);

    const [confirmationModal, setConfirmationModal] = useState<{ show: boolean; message: string; onConfirm: () => void } | null>(null);

    useEffect(() => {
        fetchGangs();
    }, []);

    const fetchGangs = async () => {
        setLoadingGangs(true);
        try {
            const gangsSnapshot = await getDocs(query(collection(dbFirestore, GANGS_COLLECTION), orderBy("name")));
            const gangsData = gangsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Gang[];
            setGangs(gangsData);
        } catch (error) {
            console.error("Error fetching gangs:", error);
            toast.error("Failed to fetch gangs.");
        } finally {
            setLoadingGangs(false);
        }
    };

    const requestDeleteGang = () => {
        if (!selectedGangId) return;
        const gangToDelete = gangs.find(g => g.id === selectedGangId);
        setConfirmationModal({
            show: true,
            message: `Are you sure you want to delete the gang "${gangToDelete?.name || 'Unknown'}"? This action cannot be undone.`,
            onConfirm: async () => {
                if (!selectedGangId) return; // Ensure selectedGangId is defined
                setConfirmationModal(null);
                setIsSubmitting(true);
                try {
                    await deleteDoc(doc(dbFirestore, GANGS_COLLECTION, selectedGangId));
                    toast.success(`Gang "${gangToDelete?.name || 'Unknown'}" deleted successfully.`);
                    setSelectedGangId(null);
                    fetchGangs();
                } catch (error) {
                    console.error("Error deleting gang:", error);
                    toast.error("Failed to delete gang.");
                } finally {
                    setIsSubmitting(false);
                }
            },
        });
    };

    const handleAddNewGang = async () => {
        if (!newGangName.trim()) {
            toast.error("Gang Name is required.");
            return;
        }
        if (!currentUser) {
            toast.error("Authentication error.");
            return;
        }

        setIsAddingGang(true);
        try {
            const gangData: Omit<Gang, 'id'> = {
                name: newGangName.trim(),
                description: newGangDescription.trim() || null,
                notes: newGangNotes.trim() || undefined,
                createdAt: serverTimestamp() as Timestamp,
                createdBy: currentUser.id || 'Unknown',
                createdByName: currentUser.name || 'Unknown',
                level: null,
                photoUrl: undefined,
                clothingInfo: undefined,
                locationInfo: undefined,
                vehiclesInfo: undefined,
                updatedAt: undefined,
                updatedBy: undefined,
                updatedByName: undefined,
            };
            const newDocRef = await addDoc(collection(dbFirestore, GANGS_COLLECTION), gangData);
            toast.success(`Gang "${newGangName.trim()}" added successfully.`);
            setNewGangName('');
            setNewGangDescription('');
            setNewGangNotes('');
            setShowAddGangForm(false);
            await fetchGangs();
            setSelectedGangId(newDocRef.id);
        } catch (error) {
            console.error("Error adding new gang:", error);
            toast.error("Failed to add new gang.");
        } finally {
            setIsAddingGang(false);
        }
    };

    return (
        <div className="space-y-6 bg-card p-4 rounded-lg border border-border relative">
            {isAdmin && (
                <div className="absolute top-3 right-3 flex gap-2">
                    {selectedGangId && (
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={requestDeleteGang}
                            disabled={isSubmitting}
                            className="h-8 px-2"
                            title="Delete Selected Gang"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                    <Button
                        size="sm"
                        onClick={() => setShowAddGangForm(!showAddGangForm)}
                        disabled={isSubmitting || loadingGangs}
                        className="bg-[#f3c700] hover:bg-[#f3c700]/90 text-black h-8 px-2"
                        title="Add New Gang"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            )}

            <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-grow max-w-sm">
                    <Label htmlFor="gangSelect" className="text-foreground/80 text-xs font-medium mb-1 block">Select Gang</Label>
                    <Select
                        value={selectedGangId || "__placeholder__"}
                        onValueChange={(value) => {
                            const newSelectedId = value === "__placeholder__" ? null : value;
                            setSelectedGangId(newSelectedId);
                        }}
                        disabled={loadingGangs || isSubmitting}
                    >
                        <SelectTrigger className="w-full bg-input border-border text-foreground focus:ring-[#f3c700]">
                            <SelectValue placeholder="Select a gang..." />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border text-popover-foreground">
                            <SelectItem value="__placeholder__" disabled>Select a gang...</SelectItem>
                            {gangs.map(gang => (
                                <SelectItem key={gang.id ?? ''} value={gang.id ?? ''}> {/* Ensure id is defined */}
                                    {gang.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {isAdmin && showAddGangForm && (
                <Card className="bg-muted/30 border-border mt-4">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-[#f3c700]">Add New Gang</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <Label htmlFor="newGangName" className="text-foreground/80 text-xs font-medium">Gang Name *</Label>
                            <Input
                                id="newGangName"
                                value={newGangName}
                                onChange={(e) => setNewGangName(e.target.value)}
                                required
                                className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-[#f3c700]"
                                placeholder="Enter the official gang name"
                                disabled={isAddingGang}
                            />
                        </div>
                        <div>
                            <Label htmlFor="newGangDescription" className="text-foreground/80 text-xs font-medium">Description</Label>
                            <Input
                                id="newGangDescription"
                                value={newGangDescription}
                                onChange={(e) => setNewGangDescription(e.target.value)}
                                className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-[#f3c700]"
                                placeholder="Short description (e.g., MC in Paleto)"
                                disabled={isAddingGang}
                            />
                        </div>
                        <div>
                            <Label htmlFor="newGangNotes" className="text-foreground/80 text-xs font-medium">General Notes</Label>
                            <Textarea
                                id="newGangNotes"
                                value={newGangNotes}
                                onChange={(e) => setNewGangNotes(e.target.value)}
                                rows={3}
                                className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-[#f3c700]"
                                placeholder="General notes about the gang (Optional)"
                                disabled={isAddingGang}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowAddGangForm(false)} disabled={isAddingGang}>Cancel</Button>
                        <Button onClick={handleAddNewGang} disabled={isAddingGang || !newGangName.trim()} className="bg-[#f3c700] hover:bg-[#f3c700]/90 text-black">
                            {isAddingGang ? 'Adding...' : 'Add Gang'}
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {selectedGangId && !showAddGangForm && (
                <div className="mt-6">
                    <GangDetails gangId={selectedGangId} />
                </div>
            )}

            {!selectedGangId && !showAddGangForm && !loadingGangs && (
                <div className="text-center py-10 text-muted-foreground italic">
                    Select a gang from the dropdown or add a new one.
                </div>
            )}

            {confirmationModal?.show && (
                <ConfirmationModal
                    isOpen={confirmationModal.show}
                    title="Confirm Action"
                    message={confirmationModal.message}
                    onConfirm={confirmationModal.onConfirm}
                    onCancel={() => setConfirmationModal(null)}
                    onClose={() => setConfirmationModal(null)}
                    confirmText="Confirm"
                    cancelText="Cancel"
                />
            )}
        </div>
    );
};

export default GangManagementTab;
