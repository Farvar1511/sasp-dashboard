import React, { useState, useEffect } from 'react'; // Import React
import { doc, onSnapshot, Timestamp, serverTimestamp, updateDoc, FieldValue } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import GangRoster from './GangRoster';
import { Skeleton } from '../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { formatTimestampForDisplay } from '../../utils/timeHelpers'; // Import formatting function
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { toast } from 'react-toastify'; // Import toast for notifications
import { FaEdit, FaSave, FaTimes } from 'react-icons/fa'; // Add icons for notes edit
import { cn } from '../../lib/utils'; // Import cn utility

// Define Gang type inline if not imported
interface Gang {
    id: string;
    name: string;
    description?: string | null; // Added
    color?: string;
    clothingInfo?: string;
    locationInfo?: string;
    vehiclesInfo?: string;
    notes?: string;
    photoUrl?: string;
    level?: number | null; // Changed to number
    createdAt?: Timestamp;
    createdByName?: string;
    updatedAt?: Timestamp | FieldValue;
    updatedByName?: string;
}

// Helper function for Threat Level styling
const getThreatLevelStyle = (level: number | null | undefined): { bgColor: string; textColor: string; label: string } => {
    switch (level) {
        case 1: return { bgColor: 'bg-green-600', textColor: 'text-white', label: 'Level 1 - Low' };
        case 2: return { bgColor: 'bg-yellow-500', textColor: 'text-black', label: 'Level 2 - Moderate' };
        case 3: return { bgColor: 'bg-orange-500', textColor: 'text-white', label: 'Level 3 - Elevated' };
        case 4: return { bgColor: 'bg-red-600', textColor: 'text-white', label: 'Level 4 - High' };
        case 5: return { bgColor: 'bg-red-800', textColor: 'text-white', label: 'Level 5 - Severe' };
        default: return { bgColor: 'bg-gray-500', textColor: 'text-white', label: 'Level Unknown' };
    }
};

interface GangDetailsProps {
  gangId: string;
}

const GangDetails: React.FC<GangDetailsProps> = ({ gangId }) => {
  const [gang, setGang] = useState<Gang | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editState, setEditState] = useState<Partial<Gang>>({});
  const [editNotesMode, setEditNotesMode] = useState(false); // State for notes edit mode
  const [editedNotes, setEditedNotes] = useState<string>(''); // State for edited notes

  useEffect(() => {
    setLoading(true);
    setError(null);
    setGang(null); // Reset gang state when gangId changes
    console.log(`[GangDetails useEffect] Subscribing to gangId: ${gangId}`);
    const gangRef = doc(dbFirestore, 'gangs', gangId);
    const unsubscribe = onSnapshot(gangRef, (docSnap) => {
      if (docSnap.exists()) {
        console.log("[GangDetails onSnapshot] Gang data received:", docSnap.data());
        setGang({ id: docSnap.id, ...docSnap.data() } as Gang);
      } else {
        console.log("[GangDetails onSnapshot] Gang not found.");
        setError("Gang not found.");
        setGang(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("[GangDetails onSnapshot] Error fetching gang details:", err);
      setError("Failed to load gang details.");
      setLoading(false);
    });

    // Cleanup function
    return () => {
        console.log(`[GangDetails useEffect Cleanup] Unsubscribing from gangId: ${gangId}`);
        unsubscribe();
    };
  }, [gangId]);

  const formatTimestamp = (timestamp: Timestamp | undefined): string => {
    if (!timestamp) return 'N/A';
    return formatTimestampForDisplay(timestamp); // Use consistent helper
  };

  if (loading) {
    return (
        // Use theme secondary background for card and skeleton
        <div className="p-4 bg-card border border-border rounded-lg shadow space-y-4"> {/* Changed to bg-card */}
            <Skeleton className="h-8 w-3/4 bg-muted border border-border" />
            <Skeleton className="h-4 w-1/2 bg-muted border border-border" />
            <Skeleton className="h-4 w-1/4 bg-muted border border-border" />
            <Skeleton className="h-10 w-full md:w-1/2 bg-muted border border-border" />
            <Skeleton className="h-60 w-full bg-muted border border-border mt-4" />
        </div>
    );
  }

  if (error) {
    // Use theme destructive style
    return <p className="text-destructive p-4 border border-destructive/50 rounded-md bg-destructive/10">{error}</p>;
  }

  if (!gang) {
    // Use theme muted text color
    return <p className="text-muted-foreground p-4">Gang data not available.</p>;
  }

  // Helper to render text content safely
  const renderTextContent = (content: string | undefined | null, placeholder: string) => {
    // Use theme text styles
    return content ? <p className="text-sm text-foreground whitespace-pre-wrap">{content}</p> : <p className="text-sm italic text-muted-foreground">{placeholder}</p>;
  };

  // Save handler for edit mode
  const handleSave = async () => {
    if (!gang) return;
    try {
      const gangRef = doc(dbFirestore, 'gangs', gang.id);
      // Prepare update data, ensuring null/empty strings are handled
      const updateData: Partial<Gang> & { updatedAt: Timestamp | FieldValue } = {
        ...(editMode && {
            name: editState.name?.trim() || gang.name, // Ensure name is not empty
            description: editState.description?.trim() || undefined, // Convert null to undefined
            level: editState.level ?? undefined, // Convert null to undefined
            clothingInfo: editState.clothingInfo?.trim() || undefined, // Convert null to undefined
            locationInfo: editState.locationInfo?.trim() || undefined, // Convert null to undefined
            vehiclesInfo: editState.vehiclesInfo?.trim() || undefined, // Convert null to undefined
            photoUrl: editState.photoUrl?.trim() || '', // Save empty string if cleared
        }),
        ...(editNotesMode && {
            notes: editedNotes.trim() || undefined, // Convert null to undefined
        }),
        updatedAt: serverTimestamp(), // Add timestamp
      };

      if (editMode && !updateData.name) {
          toast.error("Gang name cannot be empty.");
          return;
      }

      if (!editMode && !editNotesMode) {
          toast.info("No changes to save.");
          return;
      }

      await updateDoc(gangRef, updateData);

      if (editMode) {
          setEditMode(false);
          setEditState({});
      }
      if (editNotesMode) {
          setEditNotesMode(false);
          setEditedNotes('');
      }

      toast.success("Gang info updated.");
    } catch (err) {
      toast.error("Failed to update gang info.");
      console.error("Error updating gang info:", err);
    }
  };

  // Helper to extract only editable fields
  const getEditableFields = (gang: Gang) => ({
    name: gang.name ?? '',
    description: gang.description ?? '',
    level: gang.level ?? null,
    clothingInfo: gang.clothingInfo ?? '',
    locationInfo: gang.locationInfo ?? '',
    vehiclesInfo: gang.vehiclesInfo ?? '',
    photoUrl: gang.photoUrl ?? '',
    notes: gang.notes ?? '',
  });

  return (
    <Tabs defaultValue="information" className="w-full">
      {/* Use direct yellow color for active tab */}
      <TabsList className="flex space-x-1 border-b border-border mb-6 bg-transparent p-0">
        {(["information", "roster", "notes"] as const).map(tab => (
             <TabsTrigger
                key={tab}
                value={tab}
                className={`px-4 py-2 text-sm font-medium rounded-t-md focus:outline-none transition-colors data-[state=active]:bg-[#f3c700] data-[state=active]:text-black data-[state=active]:font-semibold bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-[#f3c700] data-[state=inactive]:border-b-0 data-[state=inactive]:rounded-b-none`} // Use direct color
            >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
        ))}
      </TabsList>

      {/* Information Tab Content */}
      <TabsContent value="information" className="p-0 rounded-b-md"> {/* Removed padding */}
         <Card className="bg-card border border-border shadow-none"> {/* Removed shadow */}
            <CardHeader className="border-b border-border pb-2"> {/* Removed CardTitle wrapping */}
                <div className="flex justify-between items-center"> {/* Flex container for title and badge */}
                    {/* Use direct yellow color for title */}
                    <CardTitle className="text-xl font-semibold text-[#f3c700]">Gang Information</CardTitle>
                    {/* Styled Threat Level Badge - Moved to Header */}
                    {!editMode && ( // Only show badge in display mode
                        gang.level !== null && gang.level !== undefined ? (
                            (() => {
                                const { bgColor, textColor, label } = getThreatLevelStyle(gang.level);
                                return (
                                    <span title={`Threat Level: ${label}`} className={cn(
                                        'px-4 py-1.5 rounded-full text-sm font-bold shadow', // Increased padding and font size
                                        bgColor,
                                        textColor
                                    )}>
                                        Level {gang.level}
                                    </span>
                                );
                            })()
                        ) : (
                            <span title="Threat Level Unknown" className={cn(
                                'px-4 py-1.5 rounded-full text-sm font-bold shadow', // Increased padding and font size
                                getThreatLevelStyle(null).bgColor,
                                getThreatLevelStyle(null).textColor
                            )}>
                                Unknown
                            </span>
                        )
                    )}
                </div>
                <CardDescription className="text-muted-foreground pt-2">
                    {gang.description || `General details about ${gang.name}.`}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
                {!editMode ? (
                  <>
                    {/* Display Mode */}
                    {gang.photoUrl && (
                      <div className="mb-4">
                        {/* Use direct yellow color for heading */}
                        <h4 className="text-md font-semibold mb-2 text-[#f3c700]">Gang Photo/Symbol</h4>
                        <img
                          src={gang.photoUrl}
                          alt={`${gang.name} Photo/Symbol`}
                          className="max-w-xs md:max-w-sm rounded-md border border-border object-contain"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      </div>
                    )}
                    <div>
                      {/* Use direct yellow color for heading */}
                      <h4 className="text-md font-semibold mb-1 text-[#f3c700]">Name</h4>
                      <p className="text-lg text-foreground font-medium">{gang.name}</p>
                    </div>
                    <div>
                      {/* Use direct yellow color for heading */}
                      <h4 className="text-md font-semibold mb-1 text-[#f3c700]">Description</h4>
                      {renderTextContent(gang.description, 'No description.')}
                    </div>
                    <div>
                      {/* Use direct yellow color for heading */}
                      <h4 className="text-md font-semibold mb-1 text-[#f3c700]">Clothing / Colors</h4>
                      {renderTextContent(gang.clothingInfo, 'No clothing information available.')}
                    </div>
                    <div>
                      {/* Use direct yellow color for heading */}
                      <h4 className="text-md font-semibold mb-1 text-[#f3c700]">Known Locations / Territory</h4>
                      {renderTextContent(gang.locationInfo, 'No location information available.')}
                    </div>
                    <div>
                      {/* Use direct yellow color for heading */}
                      <h4 className="text-md font-semibold mb-1 text-[#f3c700]">Known Vehicles</h4>
                      {renderTextContent(gang.vehiclesInfo, 'No vehicle information available.')}
                    </div>
                    <div className="pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        Profile created by {gang.createdByName || 'Unknown'} on {formatTimestamp(gang.createdAt)}
                      </p>
                      {gang.updatedAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last updated on {gang.updatedAt instanceof Timestamp ? formatTimestamp(gang.updatedAt) : 'N/A'}
                          {gang.updatedByName && ` by ${gang.updatedByName}`}
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end pt-2">
                      {/* Use direct yellow color for Edit button */}
                      <Button
                        onClick={() => {
                          setEditState(getEditableFields(gang));
                          setEditMode(true);
                        }}
                        className="bg-[#f3c700] hover:bg-[#f3c700]/90 text-black" // Use direct color, black text
                      >
                        Edit
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Edit Mode */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        {/* Use theme label/input styles */}
                        <Label className="block text-foreground/80 mb-1 text-xs font-medium">Name *</Label> {/* Adjusted label style */}
                        <Input
                          value={editState.name ?? ''}
                          onChange={e => setEditState(s => ({ ...s, name: e.target.value }))}
                          className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-[#f3c700]" // Added focus ring
                        />
                      </div>
                      <div>
                        <Label className="block text-foreground/80 mb-1 text-xs font-medium">Threat Level</Label> {/* Adjusted label style */}
                        <Input
                          type="number"
                          min="1"
                          max="5"
                          value={editState.level ?? ''}
                          onChange={e => setEditState(s => ({ ...s, level: e.target.value === '' ? null : Number(e.target.value) }))}
                          className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-[#f3c700]" // Added focus ring
                          placeholder="1-5 (Optional)"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="block text-foreground/80 mb-1 text-xs font-medium">Description</Label> {/* Adjusted label style */}
                      <Textarea
                        value={editState.description ?? ''}
                        onChange={e => setEditState(s => ({ ...s, description: e.target.value }))}
                        rows={2}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-[#f3c700]" // Added focus ring
                      />
                    </div>
                    <div>
                      <Label className="block text-foreground/80 mb-1 text-xs font-medium">Photo URL</Label> {/* Adjusted label style */}
                      <Input
                        value={editState.photoUrl ?? ''}
                        onChange={e => setEditState(s => ({ ...s, photoUrl: e.target.value }))}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-[#f3c700]" // Added focus ring
                      />
                    </div>
                    <div>
                      <Label className="block text-foreground/80 mb-1 text-xs font-medium">Clothing / Colors</Label> {/* Adjusted label style */}
                      <Textarea
                        value={editState.clothingInfo ?? ''}
                        onChange={e => setEditState(s => ({ ...s, clothingInfo: e.target.value }))}
                        rows={2}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-[#f3c700]" // Added focus ring
                      />
                    </div>
                    <div>
                      <Label className="block text-foreground/80 mb-1 text-xs font-medium">Known Locations / Territory</Label> {/* Adjusted label style */}
                      <Textarea
                        value={editState.locationInfo ?? ''}
                        onChange={e => setEditState(s => ({ ...s, locationInfo: e.target.value }))}
                        rows={2}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-[#f3c700]" // Added focus ring
                      />
                    </div>
                    <div>
                      <Label className="block text-foreground/80 mb-1 text-xs font-medium">Known Vehicles</Label> {/* Adjusted label style */}
                      <Textarea
                        value={editState.vehiclesInfo ?? ''}
                        onChange={e => setEditState(s => ({ ...s, vehiclesInfo: e.target.value }))}
                        rows={2}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-[#f3c700]" // Added focus ring
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => { setEditMode(false); setEditState({}); }} className="border-border text-muted-foreground hover:bg-muted/50">Cancel</Button>
                      {/* Use direct yellow color for Save button */}
                      <Button onClick={handleSave} className="bg-[#f3c700] hover:bg-[#f3c700]/90 text-black">Save</Button>
                    </div>
                  </>
                )}
            </CardContent>
         </Card>
      </TabsContent>

      {/* Roster Tab Content */}
      <TabsContent value="roster" className="p-0 rounded-b-md"> {/* Removed padding */}
        <Card className="bg-card border border-border shadow-none"> {/* Removed shadow */}
            <CardHeader>
                {/* Use direct yellow color for title */}
                <CardTitle className="text-xl font-semibold text-[#f3c700] border-b border-border pb-2">{gang.name} Roster</CardTitle>
                <CardDescription className="text-muted-foreground pt-2">Manage and view gang members.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0"> {/* Removed padding top */}
                {/* GangRoster now has its own padding */}
                <GangRoster gangId={gang.id} />
            </CardContent>
        </Card>
      </TabsContent>

      {/* Notes Tab Content */}
      <TabsContent value="notes" className="p-0 rounded-b-md"> {/* Removed padding */}
        <Card className="bg-card border border-border shadow-none"> {/* Removed shadow */}
            <CardHeader>
                {/* Use direct yellow color for title */}
                <CardTitle className="text-xl font-semibold text-[#f3c700] border-b border-border pb-2">General Notes</CardTitle>
                <CardDescription className="text-muted-foreground pt-2">General observations and intelligence about {gang.name}.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                {!editNotesMode ? (
                    <>
                        {renderTextContent(gang.notes, 'No general notes recorded for this gang.')}
                        <div className="flex justify-end pt-2">
                            {/* Edit Button for Notes */}
                            <Button
                                onClick={() => {
                                    setEditedNotes(gang.notes || '');
                                    setEditNotesMode(true);
                                    setEditMode(false); // Ensure info edit mode is off
                                    setEditState({});
                                }}
                                className="bg-[#f3c700] hover:bg-[#f3c700]/90 text-black"
                            >
                                <FaEdit className="mr-2 h-4 w-4" /> Edit Notes
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Edit Mode for Notes */}
                        <div>
                            <Label className="block text-foreground/80 mb-1 text-xs font-medium">Notes</Label>
                            <Textarea
                                value={editedNotes}
                                onChange={e => setEditedNotes(e.target.value)}
                                rows={8}
                                className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-[#f3c700]"
                                placeholder="Enter general notes..."
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => { setEditNotesMode(false); setEditedNotes(''); }} className="border-border text-muted-foreground hover:bg-muted/50">
                                <FaTimes className="mr-2 h-4 w-4" /> Cancel
                            </Button>
                            <Button onClick={handleSave} className="bg-[#f3c700] hover:bg-[#f3c700]/90 text-black">
                                <FaSave className="mr-2 h-4 w-4" /> Save Notes
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default GangDetails;
