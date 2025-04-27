import React, { useState, useEffect, useMemo } from 'react'; // Import React
// Import correct types from firestore
import { collection, getDocs, query, where, orderBy, DocumentData, Query, QuerySnapshot, onSnapshot, FirestoreError } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { User, CertStatus } from '../../types/User';
import { CaseFile } from '../../utils/ciuUtils';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'react-toastify';
import CIUPersonnelDetailsModal from './CIUPersonnelDetailsModal'; // Corrected import path
import { getCertStyle } from '../../data/rosterConfig'; // Assuming this helper exists and is styled
import { formatTimestampForDisplay } from '../../utils/timeHelpers'; // Import formatting function
import { Timestamp } from 'firebase/firestore'; // Ensure Timestamp is imported if not already

// Helper function to safely convert string or Timestamp to Date (can be shared or redefined)
const safeConvertToDate = (time: string | Timestamp | undefined | null): Date | null => {
    if (!time) return null;
    if (typeof time === 'object' && 'toDate' in time && typeof time.toDate === 'function') {
        // Firestore Timestamp
        return time.toDate();
    }
    if (typeof time === 'string') {
        // Attempt to parse string
        const date = new Date(time);
        return isNaN(date.getTime()) ? null : date; // Return null if parsing failed
    }
     if (time instanceof Date) {
        return time; // Already a Date object
    }
    return null; // Unsupported type
};

const CIUPersonnelTab: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [ciuPersonnel, setCiuPersonnel] = useState<User[]>([]);
    const [cases, setCases] = useState<CaseFile[]>([]);
    const [loadingPersonnel, setLoadingPersonnel] = useState(true);
    const [loadingCases, setLoadingCases] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPersonnel, setSelectedPersonnel] = useState<User | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    // Check if current user has elevated permissions for viewing sensitive data
    const canViewSensitiveData = useMemo(() => {
        const userRole = currentUser?.role?.toLowerCase();
        const userCiuCert = currentUser?.certifications?.CIU?.toUpperCase();
        return currentUser?.isAdmin || userRole === 'admin' || userRole === 'superadmin' || userCiuCert === 'LEAD' || userCiuCert === 'SUPER';
    }, [currentUser]);

    // Fetch CIU Personnel
    useEffect(() => {
        setLoadingPersonnel(true);
        const fetchPersonnel = async () => {
            try {
                const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
                const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
                const filteredPersonnel = usersData.filter(u => {
                    const cert = u.certifications?.CIU?.toUpperCase();
                    return ["TRAIN", "CERT", "LEAD", "SUPER"].includes(cert || "");
                }).sort((a, b) => (a.name || '').localeCompare(b.name || '')); // Sort alphabetically
                setCiuPersonnel(filteredPersonnel);
            } catch (err) {
                console.error("Error fetching CIU personnel:", err);
                setError("Failed to load CIU personnel.");
                toast.error("Failed to load CIU personnel.");
            } finally {
                setLoadingPersonnel(false);
            }
        };
        fetchPersonnel();
    }, []);

    // Fetch All Cases (needed for filtering assigned cases per user)
    useEffect(() => {
        setLoadingCases(true);
        const q = query(collection(dbFirestore, 'caseFiles'), orderBy('createdAt', 'desc'));
        // Use the imported onSnapshot and types
        const unsubscribe = onSnapshot(
            q,
            (snapshot: QuerySnapshot<DocumentData>) => {
                const casesData: CaseFile[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CaseFile[];
                setCases(casesData);
                setLoadingCases(false);
            },
            (err: FirestoreError) => { // Use FirestoreError type
                console.error("Error fetching cases:", err);
                setError("Failed to load case files for personnel view.");
                toast.error("Failed to load case files.");
                setLoadingCases(false);
            }
        );
        return () => unsubscribe();
    }, []);

    const handleOpenDetailsModal = (personnel: User) => {
        setSelectedPersonnel(personnel);
        setIsDetailsModalOpen(true);
    };

    const handleCloseDetailsModal = () => {
        setIsDetailsModalOpen(false);
        setSelectedPersonnel(null);
    };

    const getAssignedCasesForPersonnel = (personnelId: string): CaseFile[] => {
        return cases.filter(c => c.assignedToId === personnelId && !c.status.startsWith('Closed') && c.status !== 'Archived');
    };

    const renderPersonnelList = () => {
        if (loadingPersonnel) {
            return (
                // Use theme skeleton style
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 w-full bg-black/95 border border-border" />)}
                </div>
            );
        }
        if (ciuPersonnel.length === 0) {
            // Use theme muted text color
            return <p className="text-muted-foreground italic">No personnel found with CIU certifications.</p>;
        }
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ciuPersonnel.map(person => {
                    const ciuCert = person.certifications?.CIU ?? null;
                    const certStyle = getCertStyle(ciuCert);
                    const assignedCasesCount = person.id ? getAssignedCasesForPersonnel(person.id).length : 0;

                    // Use black background with opacity, adjust hover
                    return (
                        <div
                            key={person.id || person.name}
                            className="p-4 border border-border rounded-lg bg-black/95 hover:bg-gray-800/95 cursor-pointer transition-colors shadow-sm"
                            onClick={() => handleOpenDetailsModal(person)}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    {/* Use theme text colors */}
                                    <p className="font-semibold text-base text-foreground">{person.name}</p>
                                    <p className="text-xs text-muted-foreground">{person.rank} ({person.callsign})</p>
                                </div>
                                {/* Badge style is okay */}
                                <span className={`px-2 py-0.5 rounded text-xs font-bold`} style={{ backgroundColor: certStyle.bgColor, color: certStyle.textColor }}>
                                    CIU: {ciuCert || 'None'}
                                </span>
                            </div>
                            {/* Use theme border color */}
                            <div className="mt-2 pt-2 border-t border-border">
                                {/* Use theme text colors */}
                                <p className="text-sm text-foreground/80">Active Cases: {loadingCases ? '...' : assignedCasesCount}</p>
                                {canViewSensitiveData && person.lastSignInTime && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Last Login: {formatTimestampForDisplay(safeConvertToDate(person.lastSignInTime))}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        // Use black background with opacity for main container
        <div className="space-y-6 bg-black/95 p-4 rounded-lg border border-border">
            {/* Use theme section header style */}
            <h2 className="text-xl font-semibold text-accent border-b border-border pb-2">CIU Personnel Roster</h2>
            {error && <p className="text-destructive">{error}</p>}
            {renderPersonnelList()}

            {isDetailsModalOpen && selectedPersonnel && (
                <CIUPersonnelDetailsModal
                    isOpen={isDetailsModalOpen}
                    onClose={handleCloseDetailsModal}
                    personnel={selectedPersonnel}
                    assignedCases={selectedPersonnel.id ? getAssignedCasesForPersonnel(selectedPersonnel.id) : []}
                    canViewSensitiveData={canViewSensitiveData}
                    // Modal itself needs internal styling updates
                />
            )}
        </div>
    );
};

export default CIUPersonnelTab;

