import React, { useState, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { RosterUser, FTOCadetNote, CertStatus } from '../../types/User';
import { CadetLog } from './ftoTypes';
import { formatDateToMMDDYY, formatTimestampForDisplay } from '../../utils/timeHelpers';
import { getCertStyle } from '../../types/RosterConfig';
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Button } from "../../components/ui/button";

interface AugmentedFTO extends RosterUser {
  hoursLast30: number;
  lastLogDate: Date | null;
  lastCadetName: string | null;
  certificationSortOrder: number;
}

interface FTOPersonnelProps {
  allUsers: RosterUser[];
  logs: CadetLog[];
  allFtoCadetNotes: FTOCadetNote[];
  isCadet: boolean;
  getFTOHoursLast30Days: (ftoName: string) => number;
  getFTOLastLog: (ftoName: string) => CadetLog | null;
  getLogsForFTO: (ftoName: string) => CadetLog[];
  getNotesByFTO: (ftoId: string) => FTOCadetNote[];
}

const FTOPersonnel: React.FC<FTOPersonnelProps> = ({
  allUsers,
  logs,
  allFtoCadetNotes,
  isCadet,
  getFTOHoursLast30Days,
  getFTOLastLog,
  getLogsForFTO,
  getNotesByFTO,
}) => {
  const [selectedFtoForDetails, setSelectedFtoForDetails] = useState<RosterUser | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof AugmentedFTO | 'hoursLast30' | 'lastLogDate' | 'lastCadetName' | 'certification'; direction: 'asc' | 'desc' } | null>(null);

  const baseFtoPersonnel = useMemo(() => {
    const ftoUsers = allUsers.filter((u) => {
      const ftoCert = u.certifications?.FTO?.toUpperCase();
      return ["CERT", "LEAD", "SUPER", "TRAIN"].includes(ftoCert || "");
    });
    const certOrder: { [key: string]: number } = { LEAD: 1, SUPER: 2, CERT: 3, TRAIN: 4 };
    ftoUsers.sort((a, b) => {
      const certA = a.certifications?.FTO?.toUpperCase() || "";
      const certB = b.certifications?.FTO?.toUpperCase() || "";
      const orderA = certOrder[certA] || 99;
      const orderB = certOrder[certB] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
    return ftoUsers;
  }, [allUsers]);

  const sortedFtoPersonnel = useMemo(() => {
    const certOrder: { [key: string]: number } = { LEAD: 1, SUPER: 2, CERT: 3, TRAIN: 4 };
    let sortableItems: AugmentedFTO[] = baseFtoPersonnel.map(fto => {
      const lastLog = getFTOLastLog(fto.name);
      const cert = fto.certifications?.FTO?.toUpperCase() || "";
      return {
        ...fto,
        hoursLast30: getFTOHoursLast30Days(fto.name),
        lastLogDate: lastLog?.date ? new Date(lastLog.date) : null,
        lastCadetName: lastLog?.cadetName || null,
        certificationSortOrder: certOrder[cert] || 99,
      };
    });

    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any, bValue: any;
        if (sortConfig.key === 'certification') { aValue = a.certificationSortOrder; bValue = b.certificationSortOrder; }
        else if (sortConfig.key === 'hoursLast30') { aValue = a.hoursLast30; bValue = b.hoursLast30; }
        else if (sortConfig.key === 'lastLogDate') { aValue = a.lastLogDate?.getTime() ?? 0; bValue = b.lastLogDate?.getTime() ?? 0; }
        else if (sortConfig.key === 'lastCadetName') { aValue = a.lastCadetName || ""; bValue = b.lastCadetName || ""; }
        else { aValue = a[sortConfig.key as keyof RosterUser] ?? ""; bValue = b[sortConfig.key as keyof RosterUser] ?? ""; }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
    }
    return sortableItems;
  }, [baseFtoPersonnel, sortConfig, getFTOLastLog, getFTOHoursLast30Days]);

  const handleSort = (key: keyof AugmentedFTO | 'hoursLast30' | 'lastLogDate' | 'lastCadetName' | 'certification') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (columnKey: keyof AugmentedFTO | 'hoursLast30' | 'lastLogDate' | 'lastCadetName' | 'certification') => {
    if (!sortConfig || sortConfig.key !== columnKey) return <FaSort className="inline ml-1 text-gray-400" />;
    return sortConfig.direction === 'asc' ? <FaSortUp className="inline ml-1" /> : <FaSortDown className="inline ml-1" />;
  };

  const renderFtoDetails = (fto: RosterUser) => {
    const logsForFTO = getLogsForFTO(fto.name);
    const notesByFTO = getNotesByFTO(fto.id);
    const certStatus = (fto.certifications?.FTO || null) as CertStatus | null;
    const { bgColor, textColor } = getCertStyle(certStatus);

    return (
      <div className="space-y-6 p-4">
        <Button variant="link" className="mb-2 text-[#f3c700] hover:underline text-sm p-0 h-auto" onClick={() => setSelectedFtoForDetails(null)}>← Back to FTO List</Button>
        <Card className="bg-card border-border">
          <CardHeader className="pt-4">
            <CardTitle className="text-lg text-[#f3c700]">{fto.name} | {fto.badge || "N/A"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 pb-4">
            <p className="text-foreground flex items-center gap-2">
              <span className="font-semibold text-muted-foreground w-28">Certification:</span>
              {certStatus ? (
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${bgColor} ${textColor}`}>
                  {certStatus}
                </span>
              ) : (
                <span className="text-muted-foreground">N/A</span>
              )}
            </p>
            <p className="text-foreground"><span className="font-semibold text-muted-foreground w-28 inline-block">Total Sessions:</span> {logsForFTO.length}</p>
            <p className="text-foreground"><span className="font-semibold text-muted-foreground w-28 inline-block">Hours (30d):</span> {getFTOHoursLast30Days(fto.name).toFixed(1)}</p>
            <p className="text-foreground"><span className="font-semibold text-muted-foreground w-28 inline-block">Last Session:</span> {logsForFTO.length > 0 ? `${formatDateToMMDDYY(logsForFTO[0].date)} (${logsForFTO[0].sessionHours.toFixed(1)} hrs) with ${logsForFTO[0].cadetName}` : <span className="italic text-muted-foreground">None</span>}</p>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader className="pt-4">
              <CardTitle className="text-md text-[#f3c700]">Recent Training Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-72 w-full pr-4">
                <div className="space-y-3">
                  {logsForFTO.length === 0 ? <p className="text-muted-foreground italic">No logs found.</p> : logsForFTO.slice(0, 10).map((log) => (
                    <div key={log.id} className="p-2 bg-muted/50 rounded border border-border/50 text-xs">
                      <p className="text-foreground"><span className="font-semibold">Date:</span> {formatDateToMMDDYY(log.date)} | <span className="font-semibold">Cadet:</span> {log.cadetName}</p>
                      <p className="text-foreground"><span className="font-semibold">Hours:</span> {log.sessionHours.toFixed(1)}</p>
                      <p className="text-foreground"><span className="font-semibold">Summary:</span> {log.summary ? log.summary : <span className="italic text-muted-foreground">None</span>}</p>
                      <p className="text-muted-foreground/80">Logged: {formatTimestampForDisplay(log.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="pt-4">
              <CardTitle className="text-md text-[#f3c700]">Recent Cadet Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-72 w-full pr-4">
                <div className="space-y-3">
                  {notesByFTO.length === 0 ? <p className="text-muted-foreground italic">No notes found.</p> : notesByFTO.slice(0, 10).map((note) => (
                    <div key={note.id} className="p-2 bg-muted/50 rounded border border-border/50 text-xs">
                      <p className="text-foreground"><span className="font-semibold">Cadet:</span> {note.cadetName}</p>
                      <p className="text-foreground"><span className="font-semibold">Note:</span> {note.note}</p>
                      <p className="text-muted-foreground/80">{formatTimestampForDisplay(note.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-card border-border h-full flex flex-col">
      <CardHeader className="pt-4">
        <CardTitle className="text-xl text-[#f3c700]">
          {isCadet ? "FTO Personnel" : "FTO Personnel Activity"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        {selectedFtoForDetails && !isCadet ? (
          <div className="p-4">{renderFtoDetails(selectedFtoForDetails)}</div>
        ) : (
          <>
            {sortedFtoPersonnel.length === 0 ? <p className="text-muted-foreground italic p-4">No FTO personnel found.</p> : (
              <ScrollArea className="h-full">
                <Table className="min-w-full text-sm">
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="px-4 py-2 cursor-pointer hover:bg-muted/50 text-[#f3c700]" onClick={() => handleSort('name')}>Name {renderSortIcon('name')}</TableHead>
                      <TableHead className="px-4 py-2 cursor-pointer hover:bg-muted/50 text-[#f3c700]" onClick={() => handleSort('badge')}>Badge {renderSortIcon('badge')}</TableHead>
                      <TableHead className="px-4 py-2 cursor-pointer hover:bg-muted/50 text-[#f3c700]" onClick={() => handleSort('certification')}>Cert {renderSortIcon('certification')}</TableHead>
                      {!isCadet && <TableHead className="px-4 py-2 cursor-pointer hover:bg-muted/50 text-[#f3c700]" onClick={() => handleSort('hoursLast30')}>Hrs (30d) {renderSortIcon('hoursLast30')}</TableHead>}
                      {!isCadet && <TableHead className="px-4 py-2 cursor-pointer hover:bg-muted/50 text-[#f3c700]" onClick={() => handleSort('lastLogDate')}>Last Session {renderSortIcon('lastLogDate')}</TableHead>}
                      {!isCadet && <TableHead className="px-4 py-2 cursor-pointer hover:bg-muted/50 text-[#f3c700]" onClick={() => handleSort('lastCadetName')}>Last Cadet {renderSortIcon('lastCadetName')}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-foreground">
                    {sortedFtoPersonnel.map((fto) => {
                      const certStatus = (fto.certifications?.FTO || null) as CertStatus | null;
                      const { bgColor, textColor } = getCertStyle(certStatus);
                      const isClickable = !isCadet;

                      return (
                        <TableRow key={fto.id} className={`border-b border-border ${isClickable ? 'hover:bg-muted/50 cursor-pointer' : ''}`} onClick={isClickable ? () => setSelectedFtoForDetails(fto) : undefined}>
                          <TableCell className={`px-4 py-2 font-medium ${isClickable ? 'hover:text-[#f3c700]' : ''}`}>{fto.name}</TableCell>
                          <TableCell className="px-4 py-2">{fto.badge || "N/A"}</TableCell>
                          <TableCell className="px-4 py-2">
                            {certStatus ? (
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${bgColor} ${textColor}`}>
                                {certStatus}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          {!isCadet && <TableCell className="px-4 py-2">{fto.hoursLast30.toFixed(1)}</TableCell>}
                          {!isCadet && <TableCell className="px-4 py-2">{formatDateToMMDDYY(fto.lastLogDate) || <span className="italic text-muted-foreground">None</span>}</TableCell>}
                          {!isCadet && <TableCell className="px-4 py-2">{fto.lastCadetName || <span className="italic text-muted-foreground">None</span>}</TableCell>}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default FTOPersonnel;
