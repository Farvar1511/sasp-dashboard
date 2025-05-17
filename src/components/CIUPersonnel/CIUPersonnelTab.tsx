import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot, orderBy, QuerySnapshot, DocumentData, FirestoreError, CollectionReference, getDocs as firestoreGetDocs, Timestamp } from 'firebase/firestore';
import { db as dbFirestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { User, CertStatus } from '../../types/User';
import { CaseFile, CaseStatus } from '../../utils/ciuUtils'; // Ensure CaseStatus is imported
import CIUPersonnelDetailsModal from './CIUPersonnelDetailsModal';
import { getCertStyle } from '../../data/rosterConfig';
import { formatTimestampForDisplay, formatDateToMMDDYY } from '../../utils/timeHelpers';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { cn } from '../../lib/utils';
import { toast } from 'react-toastify';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";

const safeConvertToDate = (time: string | Timestamp | Date | undefined | null): Date | null => {
    if (!time) return null;
    if (time instanceof Timestamp) {
        return time.toDate();
    }
    if (time instanceof Date) {
        return time;
    }
    if (typeof time === 'string') {
        const date = new Date(time);
        return isNaN(date.getTime()) ? null : date;
    }
    return null;
};

type SortKey = keyof User | 'lastSignInTime' | 'caseCount' | 'closedCaseCount' | 'archivedCaseCount';
type SortDirection = 'asc' | 'desc';

const CIUPersonnelTab: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [personnel, setPersonnel] = useState<User[]>([]);
    const [cases, setCases] = useState<CaseFile[]>([]);
    const [loadingPersonnel, setLoadingPersonnel] = useState(true);
    const [loadingCases, setLoadingCases] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPersonnel, setSelectedPersonnel] = useState<User | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });

    const canViewSensitiveData = useMemo(() => {
        if (!currentUser) return false;
        const ciuLevel = currentUser.certifications?.CIU?.toUpperCase();
        return ciuLevel === 'LEAD' || ciuLevel === 'SUPER';
    }, [currentUser]);

    useEffect(() => {
        setLoadingPersonnel(true);
        const fetchPersonnel = async () => {
            try {
                const usersSnapshot = await firestoreGetDocs(collection(dbFirestore, "users"));
                const usersData = usersSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as User))
                    .filter(u => u.certifications?.CIU && u.isActive);
                setPersonnel(usersData);
            } catch (err) {
                console.error("Error fetching CIU personnel:", err);
                setError("Failed to load personnel.");
                toast.error("Failed to load CIU personnel.");
            } finally {
                setLoadingPersonnel(false);
            }
        };
        fetchPersonnel();
    }, []);

    useEffect(() => {
        setLoadingCases(true);
        const q = query(collection(dbFirestore, 'caseFiles'), where('status', 'in', ['Open - Assigned', 'Under Review']));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const casesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CaseFile[];
            setCases(casesData);
            setLoadingCases(false);
        }, (err) => {
            console.error("Error fetching cases:", err);
            setError(error || "Failed to load cases.");
            toast.error("Failed to load active cases.");
            setLoadingCases(false);
        });
        return () => unsubscribe();
    }, [error]);

    const getActiveCasesForUser = useCallback((userId: string): CaseFile[] => {
        return cases.filter(c => c.assignedToId === userId && (c.status === 'Open - Assigned' || c.status === 'Under Review'));
    }, [cases]);

    const getClosedCasesForUser = useCallback((userId: string): CaseFile[] => {
        return cases.filter(c => c.assignedToId === userId && (c.status === 'Closed - Solved' || c.status === 'Closed - Unsolved'));
    }, [cases]);

    const getArchivedCasesForUser = useCallback((userId: string): CaseFile[] => {
        return cases.filter(c => c.assignedToId === userId && c.status === 'Archived');
    }, [cases]);

    const sortedPersonnel = useMemo(() => {
        let sortableItems = [...personnel];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let aValue: any;
                let bValue: any;

                if (sortConfig.key === 'caseCount') {
                    aValue = getActiveCasesForUser(a.id ?? '').length;
                    bValue = getActiveCasesForUser(b.id ?? '').length;
                } else if (sortConfig.key === 'closedCaseCount') {
                    aValue = getClosedCasesForUser(a.id ?? '').length;
                    bValue = getClosedCasesForUser(b.id ?? '').length;
                } else if (sortConfig.key === 'archivedCaseCount') {
                    aValue = getArchivedCasesForUser(a.id ?? '').length;
                    bValue = getArchivedCasesForUser(b.id ?? '').length;
                } else if (sortConfig.key === 'lastSignInTime') {
                    const dateA = safeConvertToDate(a.lastSignInTime);
                    const dateB = safeConvertToDate(b.lastSignInTime);
                    aValue = dateA ? dateA.getTime() : 0;
                    bValue = dateB ? dateB.getTime() : 0;
                } else {
                    aValue = a[sortConfig.key as keyof User];
                    bValue = b[sortConfig.key as keyof User];
                }

                if (aValue == null && bValue == null) return 0;
                if (aValue == null) return sortConfig.direction === 'asc' ? -1 : 1;
                if (bValue == null) return sortConfig.direction === 'asc' ? 1 : -1;

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return aValue.localeCompare(bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
                } else {
                    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                }
            });
        }
        return sortableItems;
    }, [personnel, sortConfig, getActiveCasesForUser, getClosedCasesForUser, getArchivedCasesForUser]);

    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleRowClick = (p: User) => {
        setSelectedPersonnel(p);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedPersonnel(null);
    };

    const renderSortIcon = (columnKey: SortKey) => {
        if (sortConfig.key !== columnKey) {
            return <FaSort className="inline ml-1 text-gray-400 opacity-50" />;
        }
        return sortConfig.direction === 'asc' ?
            <FaSortUp className="inline ml-1 text-[#f3c700]" /> :
            <FaSortDown className="inline ml-1 text-[#f3c700]" />;
    };

    return (
        <Card className="bg-card border-border h-full flex flex-col">
            <CardHeader className="pt-4">
                <CardTitle className="text-xl text-[#f3c700]">CIU Personnel</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden p-0">
                {loadingPersonnel || loadingCases ? (
                    <div className="p-4 space-y-2">
                        <Skeleton className="h-10 w-full bg-muted border border-border" />
                        <Skeleton className="h-10 w-full bg-muted border border-border" />
                        <Skeleton className="h-10 w-full bg-muted border border-border" />
                    </div>
                ) : error ? (
                    <p className="text-destructive text-center py-4 px-4">{error}</p>
                ) : (
                    <ScrollArea className="h-full">
                        <Table className="min-w-full text-sm">
                            <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow className="border-b-border">
                                    <TableHead className="px-4 py-2 cursor-pointer hover:bg-muted/50 text-[#f3c700]" onClick={() => requestSort('name')}>
                                        <div className="flex items-center">Name {renderSortIcon('name')}</div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2 cursor-pointer hover:bg-muted/50 text-[#f3c700]" onClick={() => requestSort('rank')}>
                                        <div className="flex items-center">Rank {renderSortIcon('rank')}</div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2 cursor-pointer hover:bg-muted/50 text-[#f3c700]" onClick={() => requestSort('callsign')}>
                                        <div className="flex items-center">Callsign {renderSortIcon('callsign')}</div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2 text-[#f3c700]">CIU Cert</TableHead>
                                    <TableHead className="px-4 py-2 cursor-pointer hover:bg-muted/50 text-[#f3c700]" onClick={() => requestSort('caseCount')}>
                                        <div className="flex items-center justify-center">Active Cases {renderSortIcon('caseCount')}</div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2 cursor-pointer hover:bg-muted/50 text-[#f3c700]" onClick={() => requestSort('closedCaseCount')}>
                                        <div className="flex items-center justify-center">Closed Cases {renderSortIcon('closedCaseCount')}</div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2 cursor-pointer hover:bg-muted/50 text-[#f3c700]" onClick={() => requestSort('archivedCaseCount')}>
                                        <div className="flex items-center justify-center">Archived Cases {renderSortIcon('archivedCaseCount')}</div>
                                    </TableHead>
                                    {canViewSensitiveData && (
                                        <TableHead className="px-4 py-2 cursor-pointer hover:bg-muted/50 text-[#f3c700]" onClick={() => requestSort('lastSignInTime')}>
                                            <div className="flex items-center">Last Login {renderSortIcon('lastSignInTime')}</div>
                                        </TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedPersonnel.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={canViewSensitiveData ? 8 : 7} className="text-center text-muted-foreground italic py-4">
                                            No active CIU personnel found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedPersonnel.map((p) => {
                                        const assignedCases = getActiveCasesForUser(p.id ?? '');
                                        const closedCases = getClosedCasesForUser(p.id ?? '');
                                        const archivedCases = getArchivedCasesForUser(p.id ?? '');
                                        const ciuCert = (p.certifications?.CIU || null) as CertStatus | null;
                                        const { bgColor, textColor } = getCertStyle(ciuCert);
                                        const lastLoginDate = safeConvertToDate(p.lastSignInTime);

                                        return (
                                            <TableRow
                                                key={p.id ?? ''}
                                                onClick={() => handleRowClick(p)}
                                                className="cursor-pointer border-b border-border hover:bg-muted/50"
                                            >
                                                <TableCell className="font-medium px-4 py-2 text-foreground hover:text-[#f3c700]">{p.name}</TableCell>
                                                <TableCell className="px-4 py-2 text-foreground">{p.rank}</TableCell>
                                                <TableCell className="px-4 py-2 text-foreground">{p.callsign}</TableCell>
                                                <TableCell className="px-4 py-2">
                                                    {ciuCert ? (
                                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${bgColor} ${textColor}`}>
                                                            {ciuCert}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">None</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-4 py-2 text-center text-foreground">{assignedCases.length}</TableCell>
                                                <TableCell className="px-4 py-2 text-center text-foreground">{closedCases.length}</TableCell>
                                                <TableCell className="px-4 py-2 text-center text-foreground">{archivedCases.length}</TableCell>
                                                {canViewSensitiveData && (
                                                    <TableCell className="px-4 py-2 text-xs text-muted-foreground">
                                                        {lastLoginDate ? formatTimestampForDisplay(lastLoginDate) : <span className="italic">N/A</span>}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                )}
            </CardContent>

            {selectedPersonnel && (
                <CIUPersonnelDetailsModal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    personnel={selectedPersonnel}
                    assignedCases={getActiveCasesForUser(selectedPersonnel.id ?? '')}
                    closedCasesCount={getClosedCasesForUser(selectedPersonnel.id ?? '').length}
                    archivedCasesCount={getArchivedCasesForUser(selectedPersonnel.id ?? '').length}
                    canViewSensitiveData={canViewSensitiveData}
                />
            )}
        </Card>
    );
};

export default CIUPersonnelTab;


