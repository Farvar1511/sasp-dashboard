import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { X as LucideTimes, Info } from 'lucide-react';
import { TipDetails } from './SubmitCIUTipModal'; // Assuming TipDetails is the correct type
import { formatTimestampForDisplay } from '../../utils/timeHelpers'; // Assuming you have this helper

interface CIUTipDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    tipData: TipDetails & { id: string; submittedAt?: any; submittedBy?: string; status?: string; assignedToName?: string | null; notes?: string }; // Extend with fields a CIUTip might have
}

const CIUTipDetailsModal: React.FC<CIUTipDetailsModalProps> = ({ isOpen, onClose, tipData }) => {
    if (!isOpen || !tipData) {
        return null;
    }

    const submittedAtDisplay = tipData.submittedAt
        ? formatTimestampForDisplay(tipData.submittedAt)
        : 'N/A';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="w-[95vw] max-w-3xl mx-auto p-6 sm:p-8 bg-card text-foreground rounded-lg shadow-2xl border-border border flex flex-col max-h-[90vh] relative overflow-hidden">
                <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-muted-foreground hover:text-foreground z-10" onClick={onClose}>
                    <LucideTimes className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                </Button>
                
                <DialogHeader className="pb-4 mb-4 border-b border-border shrink-0">
                    <DialogTitle className="text-2xl font-semibold text-brand flex items-center">
                        <Info className="mr-2 h-6 w-6" /> CIU Tip Details - {tipData.title || `Tip ID: ${tipData.id.substring(0,8)}`}
                    </DialogTitle>
                    <DialogDescription>
                        Submitted by: {tipData.submittedBy || 'Anonymous'} on {submittedAtDisplay}
                        {tipData.status && <span className="ml-2 px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">{tipData.status}</span>}
                        {tipData.assignedToName && <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs">Assigned to: {tipData.assignedToName}</span>}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-grow space-y-6 overflow-y-auto custom-scrollbar pr-2">
                    <Card className="bg-card-foreground/5 border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Tip Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="whitespace-pre-line break-words text-sm">{tipData.summary || 'No summary provided.'}</p>
                        </CardContent>
                    </Card>

                    {tipData.incidentReport && (
                        <Card className="bg-card-foreground/5 border-border shadow-sm">
                            <CardHeader><CardTitle className="text-lg">Incident Report</CardTitle></CardHeader>
                            <CardContent><p className="text-sm">{tipData.incidentReport}</p></CardContent>
                        </Card>
                    )}

                    {tipData.location && (
                        <Card className="bg-card-foreground/5 border-border shadow-sm">
                            <CardHeader><CardTitle className="text-lg">Location</CardTitle></CardHeader>
                            <CardContent><p className="text-sm">{tipData.location}</p></CardContent>
                        </Card>
                    )}
                    
                    {tipData.notes && (
                         <Card className="bg-card-foreground/5 border-border shadow-sm">
                            <CardHeader><CardTitle className="text-lg">Internal Notes</CardTitle></CardHeader>
                            <CardContent>
                                <Textarea value={tipData.notes} readOnly className="bg-input border-border text-sm" rows={3}/>
                            </CardContent>
                        </Card>
                    )}

                    {tipData.namesOfInterest && tipData.namesOfInterest.length > 0 && (
                        <Card className="bg-card-foreground/5 border-border shadow-sm">
                            <CardHeader><CardTitle className="text-lg">Names of Interest</CardTitle></CardHeader>
                            <CardContent className="space-y-2">
                                {tipData.namesOfInterest.map(noi => (
                                    <div key={noi.id} className="p-2 border border-border/30 rounded bg-input/30 text-sm">
                                        <p><strong>Name:</strong> {noi.name || 'N/A'}</p>
                                        {noi.cid && <p><strong>CID:</strong> {noi.cid}</p>}
                                        {noi.phoneNumber && <p><strong>Phone:</strong> {noi.phoneNumber}</p>}
                                        {noi.role && <p><strong>Role:</strong> {noi.role}</p>}
                                        {noi.affiliation && <p><strong>Affiliation/Notes:</strong> {noi.affiliation}</p>}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {tipData.evidence && tipData.evidence.length > 0 && (
                        <Card className="bg-card-foreground/5 border-border shadow-sm">
                            <CardHeader><CardTitle className="text-lg">Evidence</CardTitle></CardHeader>
                            <CardContent className="space-y-2">
                                {tipData.evidence.map(ev => (
                                    <div key={ev.id} className="p-2 border border-border/30 rounded bg-input/30 text-sm">
                                        <p><strong>Type:</strong> {ev.type}</p>
                                        {/* Add more evidence details based on type */}
                                        <p><strong>Location:</strong> {ev.location || 'N/A'}</p>
                                        {ev.photoLink && <p><strong>Photo:</strong> <a href={ev.photoLink} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{ev.photoLink}</a></p>}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                     {tipData.photos && tipData.photos.length > 0 && (
                        <Card className="bg-card-foreground/5 border-border shadow-sm">
                            <CardHeader><CardTitle className="text-lg">Photo Links</CardTitle></CardHeader>
                            <CardContent className="space-y-1">
                                {tipData.photoSectionDescription && <p className="text-sm italic text-muted-foreground mb-2">{tipData.photoSectionDescription}</p>}
                                {tipData.photos.map((photo, index) => (
                                    <p key={index} className="text-sm">
                                        <a href={photo} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{photo}</a>
                                    </p>
                                ))}
                            </CardContent>
                        </Card>
                    )}


                    {/* Add more sections for other tipData fields as needed (gangInfo, videoNotes, charges) */}

                </div>

                <DialogFooter className="pt-4 mt-4 border-t border-border shrink-0">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CIUTipDetailsModal;
