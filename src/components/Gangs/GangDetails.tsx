import React, { useState, useEffect } from 'react'; // Import React
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
// Update Gang type inline or import from a shared types file
// import { Gang } from '../../utils/ciuUtils'; // Correct import path for Gang
import GangRoster from './GangRoster';
import { Skeleton } from '../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { formatTimestampForDisplay } from '../../utils/timeHelpers'; // Import formatting function
import { Input } from '../ui/input';
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
        // Use black background for card and skeleton
        <div className="p-4 bg-black/95 rounded-lg shadow border border-border space-y-4">
            <Skeleton className="h-8 w-3/4 bg-gray-800/95 border border-border" />
            <Skeleton className="h-4 w-1/2 bg-gray-800/95 border border-border" />
            <Skeleton className="h-4 w-1/4 bg-gray-800/95 border border-border" />
            <Skeleton className="h-10 w-full md:w-1/2 bg-gray-800/95 border border-border" />
            <Skeleton className="h-60 w-full bg-gray-800/95 border border-border mt-4" />
        </div>
    );
  }

  if (error) {
    // Use FTO error style
    return <p className="text-red-500 p-4 border border-red-500/50 rounded-md bg-red-900/20">{error}</p>;
  }

  if (!gang) {
    return <p className="text-white/60 p-4">Gang data not available.</p>;
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
      await updateDoc(gangRef, {
        name: editState.name ?? gang.name,
        description: editState.description ?? gang.description ?? '',
        level: editState.level ?? gang.level ?? null,
        clothingInfo: editState.clothingInfo ?? gang.clothingInfo ?? '',
        locationInfo: editState.locationInfo ?? gang.locationInfo ?? '',
        vehiclesInfo: editState.vehiclesInfo ?? gang.vehiclesInfo ?? '',
        photoUrl: editState.photoUrl ?? gang.photoUrl ?? '',
        notes: editState.notes ?? gang.notes ?? '',
      });
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
      {/* Use theme TabsList styling */}
      <TabsList className="flex space-x-1 border-b border-border mb-6 bg-transparent p-0">
        {(["roster", "information", "notes"] as const).map(tab => (
             <TabsTrigger
                key={tab}
                value={tab}
                // Use theme active tab styles
                className={`px-4 py-2 text-sm font-medium rounded-t-md focus:outline-none transition-colors data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:font-semibold bg-card text-accent hover:bg-muted/50 hover:text-accent data-[state=inactive]:border-b-0 data-[state=inactive]:rounded-b-none`}
            >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
        ))}
      </TabsList>

      {/* Roster Tab Content */}
      <TabsContent value="roster" className="bg-black/95 p-4 rounded-b-md border border-t-0 border-border">
        {/* Use black background */}
        <Card className="bg-black/95 border border-border">
            <CardHeader>
                {/* Use theme section header style */}
                <CardTitle className="text-xl font-semibold text-accent border-b border-border pb-2">{gang.name} Roster</CardTitle>
                <CardDescription className="text-muted-foreground pt-2">Manage and view gang members.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                {/* GangRoster component needs internal styling updates */}
                <GangRoster gangId={gang.id} />
            </CardContent>
        </Card>
      </TabsContent>

      {/* Information Tab Content */}
      <TabsContent value="information" className="bg-black/95 p-4 rounded-b-md border border-t-0 border-border">
         <Card className="bg-black/95 border border-border">
            <CardHeader>
                <CardTitle className="text-xl font-semibold text-accent border-b border-border pb-2">Gang Information</CardTitle>
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
                        <h4 className="text-md font-semibold mb-2 text-accent">Gang Photo/Symbol</h4>
                        <img
                          src={gang.photoUrl}
                          alt={`${gang.name} Photo/Symbol`}
                          className="max-w-xs md:max-w-sm rounded-md border border-border object-contain"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      </div>
                    )}
                    <div>
                      <h4 className="text-md font-semibold mb-1 text-accent">Name</h4>
                      <p className="text-lg text-foreground">{gang.name}</p>
                    </div>
                    <div>
                      <h4 className="text-md font-semibold mb-1 text-accent">Description</h4>
                      {renderTextContent(gang.description, 'No description.')}
                    </div>
                    <div>
                      <h4 className="text-md font-semibold mb-1 text-accent">Threat Level</h4>
                      <p className="text-sm text-foreground">{gang.level ?? <span className="italic text-muted-foreground">Not specified</span>}</p>
                    </div>
                    <div>
                      <h4 className="text-md font-semibold mb-1 text-accent">Clothing / Colors</h4>
                      {renderTextContent(gang.clothingInfo, 'No clothing information available.')}
                    </div>
                    <div>
                      <h4 className="text-md font-semibold mb-1 text-accent">Known Locations / Territory</h4>
                      {renderTextContent(gang.locationInfo, 'No location information available.')}
                    </div>
                    <div>
                      <h4 className="text-md font-semibold mb-1 text-accent">Known Vehicles</h4>
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
                      <Button
                        onClick={() => {
                          setEditState(getEditableFields(gang));
                          setEditMode(true);
                        }}
                        className="bg-accent text-accent-foreground"
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
                        <label className="block text-foreground/80 mb-1">Name</label>
                        <Input
                          value={editState.name ?? ''}
                          onChange={e => setEditState(s => ({ ...s, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-foreground/80 mb-1">Threat Level</label>
                        <Input
                          type="number"
                          value={editState.level ?? ''}
                          onChange={e => setEditState(s => ({ ...s, level: e.target.value === '' ? null : Number(e.target.value) }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-foreground/80 mb-1">Description</label>
                      <Textarea
                        value={editState.description ?? ''}
                        onChange={e => setEditState(s => ({ ...s, description: e.target.value }))}
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-foreground/80 mb-1">Photo URL</label>
                      <Input
                        value={editState.photoUrl ?? ''}
                        onChange={e => setEditState(s => ({ ...s, photoUrl: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-foreground/80 mb-1">Clothing / Colors</label>
                      <Textarea
                        value={editState.clothingInfo ?? ''}
                        onChange={e => setEditState(s => ({ ...s, clothingInfo: e.target.value }))}
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-foreground/80 mb-1">Known Locations / Territory</label>
                      <Textarea
                        value={editState.locationInfo ?? ''}
                        onChange={e => setEditState(s => ({ ...s, locationInfo: e.target.value }))}
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-foreground/80 mb-1">Known Vehicles</label>
                      <Textarea
                        value={editState.vehiclesInfo ?? ''}
                        onChange={e => setEditState(s => ({ ...s, vehiclesInfo: e.target.value }))}
                        rows={2}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => { setEditMode(false); setEditState({}); }}>Cancel</Button>
                      <Button onClick={handleSave} className="bg-accent text-accent-foreground">Save</Button>
                    </div>
                  </>
                )}
            </CardContent>
         </Card>
      </TabsContent>

      {/* Notes Tab Content */}
      <TabsContent value="notes" className="bg-black/95 p-4 rounded-b-md border border-t-0 border-border">
        {/* Use black background */}
        <Card className="bg-black/95 border border-border">
            <CardHeader>
                <CardTitle className="text-xl font-semibold text-accent border-b border-border pb-2">General Notes</CardTitle>
                <CardDescription className="text-muted-foreground pt-2">General observations and intelligence about {gang.name}.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                {renderTextContent(gang.notes, 'No general notes recorded for this gang.')}
            </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default GangDetails;
