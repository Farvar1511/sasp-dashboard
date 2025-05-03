import React from 'react'; // Import React
import { User, CertStatus } from '../../types/User';
import { CaseFile } from '../../utils/ciuUtils';
// Use Shadcn Dialog components
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "../ui/dialog";
import { Button } from '../ui/button';
import { Badge } from '../ui/badge'; // Use Badge for styling certs/status
import { getCertStyle } from '../../data/rosterConfig'; // Assuming this helper exists
import { formatTimestampForDisplay } from '../../utils/timeHelpers'; // Import formatting function
import { ScrollArea } from '../ui/scroll-area'; // Import ScrollArea

interface CIUPersonnelDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    personnel: User;
    assignedCases: CaseFile[];
    canViewSensitiveData: boolean; // To control visibility of sensitive info like last login
}

const CIUPersonnelDetailsModal: React.FC<CIUPersonnelDetailsModalProps> = ({
    isOpen,
    onClose,
    personnel,
    assignedCases,
    canViewSensitiveData,
}) => {
    const ciuCert = personnel.certifications?.CIU ?? null;
    const certStyle = getCertStyle(ciuCert);

    return (
        // Use theme card background for DialogContent
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-xl bg-card border border-border rounded-lg text-foreground shadow-lg">
                <DialogHeader>
                    {/* Use theme accent for title, border */}
                    <DialogTitle className="text-xl font-semibold text-[#f3c700] mb-2 border-b border-border pb-2">Personnel Details</DialogTitle>
                    <DialogDescription className="text-muted-foreground -mt-1">{personnel.name}</DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {/* Basic Info */}
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md border border-border">
                        <div>
                            {/* Use theme text styles */}
                            <p><strong className="text-muted-foreground font-medium">Rank:</strong> {personnel.rank}</p>
                            <p><strong className="text-muted-foreground font-medium">Callsign:</strong> {personnel.callsign}</p>
                        </div>
                        {/* Use Shadcn Badge */}
                        <Badge variant="outline" className={`text-xs font-bold border-none`} style={{ backgroundColor: certStyle.bgColor, color: certStyle.textColor }}>
                            CIU: {ciuCert || 'None'}
                        </Badge>
                    </div>

                    {/* Sensitive Info */}
                    {canViewSensitiveData && personnel.lastSignInTime && (
                        <p className="text-sm text-foreground px-1">
                            <strong className="text-muted-foreground font-medium">Last Login:</strong>
                            {' '}{formatTimestampForDisplay(personnel.lastSignInTime ? new Date(typeof personnel.lastSignInTime === 'object' && 'toDate' in personnel.lastSignInTime ? personnel.lastSignInTime.toDate() : personnel.lastSignInTime) : null)}
                        </p>
                    )}

                    {/* Assigned Cases */}
                    <div>
                        {/* Use theme accent for sub-header, border */}
                        <h4 className="font-medium mb-2 text-[#f3c700] border-b border-border pb-1 px-1">Active Assigned Cases ({assignedCases.length})</h4>
                        {assignedCases.length > 0 ? (
                            // Style list with theme text colors, use ScrollArea
                            <ScrollArea className="h-48 border border-border rounded-md p-3 bg-muted/30">
                                <ul className="space-y-1 text-sm">
                                    {assignedCases.map(c => (
                                        <li key={c.id} className="text-foreground/90">
                                            {c.title} <span className="text-xs text-muted-foreground">({c.status})</span>
                                            {/* TODO: Make case title clickable */}
                                        </li>
                                    ))}
                                </ul>
                            </ScrollArea>
                        ) : (
                            <p className="text-sm text-muted-foreground italic px-1">No active cases assigned.</p>
                        )}
                    </div>
                </div>

                {/* Use theme border for footer */}
                <DialogFooter className="mt-4 border-t border-border pt-4">
                    <DialogClose asChild>
                        {/* Use theme secondary button style */}
                        <Button type="button" variant="outline" className="border-border text-muted-foreground hover:bg-muted/50">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CIUPersonnelDetailsModal;
