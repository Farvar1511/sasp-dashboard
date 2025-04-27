import React, { useState, useEffect } from 'react'; // Import React
import { doc, onSnapshot, Timestamp, serverTimestamp } from 'firebase/firestore';
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
import { updateDoc } from 'firebase/firestore';
import { toast } from 'react-toastify'; // Import toast for notifications

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
    updatedAt?: Timestamp;
    updatedByName?: string;
}


interface GangDetailsProps {
  gangId: string;
}

const GangDetails: React.FC<GangDetailsProps> = ({ gangId }) => {
  const [gang, setGang] = useState<Gang | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editState, setEditState] = useState<Partial<Gang>>({});

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
        <div className="p-4 bg-secondary rounded-lg shadow border border-border space-y-4">
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
      const updateData = {
        name: editState.name?.trim() || gang.name, // Ensure name is not empty
        description: editState.description?.trim() || null, // Allow null description
        level: editState.level ?? null, // Allow null level
        clothingInfo: editState.clothingInfo?.trim() || null,
        locationInfo: editState.locationInfo?.trim() || null,
        vehiclesInfo: editState.vehiclesInfo?.trim() || null,
        photoUrl: editState.photoUrl?.trim() || '', // Save empty string if cleared
        notes: editState.notes?.trim() || null,
        updatedAt: serverTimestamp(), // Add timestamp
        // Optionally add updatedByName if currentUser is available
      };

      // Validate name before saving
      if (!updateData.name) {
          toast.error("Gang name cannot be empty.");
          return;
      }

      await updateDoc(gangRef, updateData);
      setEditMode(false);
      setEditState({});
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
    <Tabs defaultValue="roster" className="w-full">
      {/* Use direct yellow color for active tab */}
      <TabsList className="flex space-x-1 border-b border-border mb-6 bg-transparent p-0">
        {(["roster", "information", "notes"] as const).map(tab => (
             <TabsTrigger
                key={tab}
                value={tab}
                // Use direct color for active state
                className={`px-4 py-2 text-sm font-medium rounded-t-md focus:outline-none transition-colors data-[state=active]:bg-[#f3c700] data-[state=active]:text-black data-[state=active]:font-semibold bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-[#f3c700] data-[state=inactive]:border-b-0 data-[state=inactive]:rounded-b-none`} // Use direct color
            >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
        ))}
      </TabsList>

      {/* Roster Tab Content */}
      <TabsContent value="roster" className="p-4 rounded-b-md">
        <Card className="bg-card border border-border">
            <CardHeader>
                {/* Use direct yellow color for title */}
                <CardTitle className="text-xl font-semibold text-[#f3c700] border-b border-border pb-2">{gang.name} Roster</CardTitle>
                <CardDescription className="text-muted-foreground pt-2">Manage and view gang members.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                <GangRoster gangId={gang.id} />
            </CardContent>
        </Card>
      </TabsContent>

      {/* Information Tab Content */}
      <TabsContent value="information" className="p-4 rounded-b-md">
         <Card className="bg-card border border-border">
            <CardHeader>
                {/* Use direct yellow color for title */}
                <CardTitle className="text-xl font-semibold text-[#f3c700] border-b border-border pb-2">Gang Information</CardTitle>
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
                      <p className="text-lg text-foreground">{gang.name}</p>
                    </div>
                    <div>
                      {/* Use direct yellow color for heading */}
                      <h4 className="text-md font-semibold mb-1 text-[#f3c700]">Description</h4>
                      {renderTextContent(gang.description, 'No description.')}
                    </div>
                    <div>
                      {/* Use direct yellow color for heading */}
                      <h4 className="text-md font-semibold mb-1 text-[#f3c700]">Threat Level</h4>
                      <p className="text-sm text-foreground">{gang.level ?? <span className="italic text-muted-foreground">Not specified</span>}</p>
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
                          Last updated on {formatTimestamp(gang.updatedAt)}
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
                        <Label className="block text-foreground/80 mb-1">Name</Label>
                        <Input
                          value={editState.name ?? ''}
                          onChange={e => setEditState(s => ({ ...s, name: e.target.value }))}
                          className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                        />
                      </div>
                      <div>
                        <Label className="block text-foreground/80 mb-1">Threat Level</Label>
                        <Input
                          type="number"
                          value={editState.level ?? ''}
                          onChange={e => setEditState(s => ({ ...s, level: e.target.value === '' ? null : Number(e.target.value) }))}
                          className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="block text-foreground/80 mb-1">Description</Label>
                      <Textarea
                        value={editState.description ?? ''}
                        onChange={e => setEditState(s => ({ ...s, description: e.target.value }))}
                        rows={2}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <div>
                      <Label className="block text-foreground/80 mb-1">Photo URL</Label>
                      <Input
                        value={editState.photoUrl ?? ''}
                        onChange={e => setEditState(s => ({ ...s, photoUrl: e.target.value }))}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <div>
                      <Label className="block text-foreground/80 mb-1">Clothing / Colors</Label>
                      <Textarea
                        value={editState.clothingInfo ?? ''}
                        onChange={e => setEditState(s => ({ ...s, clothingInfo: e.target.value }))}
                        rows={2}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <div>
                      <Label className="block text-foreground/80 mb-1">Known Locations / Territory</Label>
                      <Textarea
                        value={editState.locationInfo ?? ''}
                        onChange={e => setEditState(s => ({ ...s, locationInfo: e.target.value }))}
                        rows={2}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <div>
                      <Label className="block text-foreground/80 mb-1">Known Vehicles</Label>
                      <Textarea
                        value={editState.vehiclesInfo ?? ''}
                        onChange={e => setEditState(s => ({ ...s, vehiclesInfo: e.target.value }))}
                        rows={2}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground"
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

      {/* Notes Tab Content */}
      <TabsContent value="notes" className="p-4 rounded-b-md">
        <Card className="bg-card border border-border">
            <CardHeader>
                {/* Use direct yellow color for title */}
                <CardTitle className="text-xl font-semibold text-[#f3c700] border-b border-border pb-2">General Notes</CardTitle>
                <CardDescription className="text-muted-foreground pt-2">General observations and intelligence about {gang.name}.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                {renderTextContent(gang.notes, 'No general notes recorded for this gang.')}
                 {/* TODO: Add Edit/Save for Notes here if needed */}
            </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default GangDetails;
