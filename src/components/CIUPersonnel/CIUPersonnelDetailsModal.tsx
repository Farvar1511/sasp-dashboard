import React from 'react'; // Import React
import { User, CertStatus } from '../../types/User';
import { CaseFile } from '../../utils/ciuUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../ui/dialog";
import { Button } from '../ui/button';
import { Badge } from '../ui/badge'; // Use Badge for styling certs/status
import { getCertStyle } from '../../data/rosterConfig'; // Assuming this helper exists
import { formatTimestampForDisplay } from '../../utils/timeHelpers'; // Import formatting function

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
        // Use black background for DialogContent
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-xl bg-black/95 border border-border rounded-lg text-foreground shadow-lg">
                <DialogHeader>
                    {/* Use theme accent for title, border */}
                    <DialogTitle className="text-xl font-semibold text-accent mb-5 border-b border-border pb-2">Personnel Details: {personnel.name}</DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {/* Basic Info */}
                    <div className="flex justify-between items-center">
                        <div>
                            {/* Use theme text styles */}
                            <p><strong className="text-muted-foreground">Rank:</strong> {personnel.rank}</p>
                            <p><strong className="text-muted-foreground">Callsign:</strong> {personnel.callsign}</p>
                        </div>
                        {/* Badge style is okay */}
                        <Badge style={{ backgroundColor: certStyle.bgColor, color: certStyle.textColor }} className="text-xs font-bold">
                            CIU: {ciuCert || 'None'}
                        </Badge>
                    </div>

                    {/* Sensitive Info */}
                    {canViewSensitiveData && personnel.lastSignInTime && (
                        <p className="text-sm text-foreground">
                            <strong className="text-muted-foreground">Last Login:</strong>
                            {' '}{formatTimestampForDisplay(personnel.lastSignInTime ? new Date(typeof personnel.lastSignInTime === 'object' && 'toDate' in personnel.lastSignInTime ? personnel.lastSignInTime.toDate() : personnel.lastSignInTime) : null)}
                        </p>
                    )}

                    {/* Assigned Cases */}
                    <div>
                        {/* Use theme accent for sub-header, border */}
                        <h4 className="font-medium mb-2 text-accent border-b border-border pb-1">Active Assigned Cases ({assignedCases.length})</h4>
                        {assignedCases.length > 0 ? (
                            // Style list with theme text colors
                            <ul className="list-disc list-inside space-y-1 text-sm max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {assignedCases.map(c => (
                                    <li key={c.id} className="text-foreground/80">
                                        {c.title} <span className="text-xs text-muted-foreground">({c.status})</span>
                                        {/* TODO: Make case title clickable */}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No active cases assigned.</p>
                        )}
                    </div>
                </div>

                {/* Use theme border for footer */}
                <DialogFooter className="mt-6 border-t border-border pt-4">
                    <DialogClose asChild>
                        {/* Use theme secondary button style */}
                        <Button type="button" variant="outline">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CIUPersonnelDetailsModal;
