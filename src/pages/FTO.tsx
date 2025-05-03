import React, { useState, useEffect, useMemo } from "react";
import {
  collection, addDoc, getDocs, query, orderBy, Timestamp, limit, where, doc, updateDoc, deleteDoc,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import { toast } from "react-toastify";
import { RosterUser, FTOAnnouncement, FTOCadetNote } from "../types/User";
import { computeIsAdmin } from "../utils/isadmin";
import Modal from "../components/Modal";
import ConfirmationModal from "../components/ConfirmationModal";
import { formatDateToMMDDYY, formatTimestampForDisplay, formatTime12hr } from "../utils/timeHelpers";
import { CadetLog, ProgressItemKey, progressItems, initialProgressState, totalProgressItems, FtoTabKey, CadetTabKey } from './FTO/ftoTypes';

import AddCadetLog from './FTO/AddCadetLog';
import CadetLogs from './FTO/CadetLogs';
import CadetProgress from './FTO/CadetProgress';
import FTOAnnouncements from './FTO/FTOAnnouncements';
import FTOPersonnel from './FTO/FTOPersonnel';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Checkbox } from "../components/ui/checkbox";
import { ScrollArea } from "../components/ui/scroll-area";

const FTOPage: React.FC = () => {
  const { user: authUser, loading: authLoading } = useAuth();

  const isAdmin = useMemo(() => computeIsAdmin(authUser), [authUser]);
  const isCadet = useMemo(() => authUser?.rank === "Cadet", [authUser]);

  const hasFtoPermission = useMemo(() => {
    if (authLoading || !authUser || !authUser.certifications) return false;
    const ftoStatus = authUser.certifications.FTO?.toUpperCase();
    return ["LEAD", "SUPER", "TRAIN", "CERT"].includes(ftoStatus || "");
  }, [authUser, authLoading]);

  const canManageAnnouncements = useMemo(() => {
    if (authLoading || !authUser || !authUser.certifications) return false;
    const ftoStatus = authUser.certifications.FTO?.toUpperCase();
    const isHighCommand = authUser.rank === "High Command";
    return isAdmin || isHighCommand || ["LEAD", "SUPER"].includes(ftoStatus || "");
  }, [authUser, authLoading, isAdmin]);

  const [allUsers, setAllUsers] = useState<RosterUser[]>([]);
  const [logs, setLogs] = useState<CadetLog[]>([]);
  const [ftoAnnouncements, setFtoAnnouncements] = useState<FTOAnnouncement[]>([]);
  const [allFtoCadetNotes, setAllFtoCadetNotes] = useState<FTOCadetNote[]>([]);
  const [activeTab, setActiveTab] = useState<FtoTabKey | CadetTabKey>("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [errorAnnouncements, setErrorAnnouncements] = useState<string | null>(null);

  const [editingLog, setEditingLog] = useState<CadetLog | null>(null);
  const [isEditLogModalOpen, setIsEditLogModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'log' | 'note' | 'announcement' } | null>(null);

  const cadets = useMemo(() => allUsers.filter((u) => u.rank === "Cadet"), [allUsers]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true); setLoadingAnnouncements(true); setError(null); setErrorAnnouncements(null);
      try {
        const usersQuery = query(collection(dbFirestore, "users"), orderBy("name"));
        const usersSnapshot = await getDocs(usersQuery);
        setAllUsers(usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as RosterUser[]);

        const logsQuery = query(collection(dbFirestore, "cadetLogs"), orderBy("createdAt", "desc"));
        const logsSnapshot = await getDocs(logsQuery);
        setLogs(logsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as CadetLog[]);

        const announcementsQuery = query(collection(dbFirestore, "ftoAnnouncements"), orderBy("createdAt", "desc"));
        const announcementsSnapshot = await getDocs(announcementsQuery);
        setFtoAnnouncements(announcementsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as FTOAnnouncement[]);

        const allNotesQuery = query(collection(dbFirestore, "ftoCadetNotes"), orderBy("createdAt", "desc"));
        const allNotesSnapshot = await getDocs(allNotesQuery);
        setAllFtoCadetNotes(allNotesSnapshot.docs.map((doc) => ({
          id: doc.id, ...doc.data(),
          createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt : Timestamp.now()
        })) as FTOCadetNote[]);

      } catch (err) {
        console.error("Error fetching FTO data:", err);
        setError("Failed to load FTO data."); setErrorAnnouncements("Failed to load announcements.");
        toast.error("Failed to load FTO data.");
      } finally {
        setLoading(false); setLoadingAnnouncements(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (isCadet && activeTab !== "home") setActiveTab("home");
  }, [isCadet, activeTab]);

  const getCurrentProgressState = (cadetName: string): { [key in ProgressItemKey]: boolean } => {
    const progressLogs = logs
      .filter(log => log.cadetName === cadetName && log.type === "progress_update" && log.progressSnapshot)
      .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
    if (progressLogs.length > 0) {
      const latestSnapshot = progressLogs[0].progressSnapshot!;
      const completeState = { ...initialProgressState };
      for (const key in progressItems) {
        if (latestSnapshot.hasOwnProperty(key)) completeState[key as ProgressItemKey] = latestSnapshot[key as ProgressItemKey];
      }
      return completeState;
    }
    return { ...initialProgressState };
  };

  const getCadetTotalHours = (cadetName: string): number => {
    const cadetSessionLogs = logs.filter(log => log.cadetName === cadetName && (!log.type || log.type === "session"));
    if (cadetSessionLogs.length === 0) return 0;
    return Math.max(...cadetSessionLogs.map(log => log.cumulativeHours || 0));
  };

  const getCadetLastLog = (cadetName: string): CadetLog | null => {
    const cadetSessionLogs = logs
      .filter(log => log.cadetName === cadetName && (!log.type || log.type === "session"))
      .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
    return cadetSessionLogs[0] || null;
  };

  const getFTOHoursLast30Days = (ftoName: string): number => {
    const thirtyDaysAgo = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const totalHours = logs
      .filter(log => log.ftoName === ftoName && (!log.type || log.type === "session") && log.createdAt && log.createdAt >= thirtyDaysAgo)
      .reduce((sum, log) => sum + (Number(log.sessionHours) || 0), 0);
    return parseFloat(totalHours.toFixed(1));
  };

  const getFTOLastLog = (ftoName: string): CadetLog | null => {
    const ftoSessionLogs = logs
      .filter(log => log.ftoName === ftoName && (!log.type || log.type === "session"))
      .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
    return ftoSessionLogs[0] || null;
  };

  const getLogsForFTO = (ftoName: string): CadetLog[] => {
    return logs.filter(log => log.ftoName === ftoName && (!log.type || log.type === "session"))
               .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
  };

  const getNotesByFTO = (ftoId: string): FTOCadetNote[] => {
    return allFtoCadetNotes.filter(note => note.ftoId === ftoId)
                           .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
  };

  const saveProgressUpdate = async (cadetName: string, updatedProgressState: { [key in ProgressItemKey]: boolean }, summaryMessage: string): Promise<CadetLog | null> => {
    if (!authUser?.name) { toast.error("Cannot update progress: FTO name not found."); return null; }
    const progressLogEntry: Omit<CadetLog, "id"> = {
      cadetName, ftoName: authUser.name, createdAt: Timestamp.now(), type: "progress_update",
      progressSnapshot: updatedProgressState, date: new Date().toISOString().split("T")[0],
      timeStarted: "", timeEnded: "", sessionHours: 0, cumulativeHours: 0,
      summary: summaryMessage, additionalNotes: `Updated by ${authUser.name}`,
    };
    try {
      const docRef = await addDoc(collection(dbFirestore, "cadetLogs"), progressLogEntry);
      const addedLog = { ...progressLogEntry, id: docRef.id };
      setLogs(prevLogs => [addedLog, ...prevLogs].sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)));
      return addedLog;
    } catch (error) { console.error("Error saving progress update:", error); toast.error("Failed to save progress update."); return null; }
  };

  const handleAddLog = async (logDataWithoutId: Omit<CadetLog, "id">) => {
    try {
      const docRef = await addDoc(collection(dbFirestore, "cadetLogs"), logDataWithoutId);
      const addedLog = { ...logDataWithoutId, id: docRef.id };
      setLogs(prevLogs => [addedLog, ...prevLogs].sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)));
      toast.success("Log added successfully!");
    } catch (error) {
      console.error("Error adding log to Firestore:", error);
      toast.error("Failed to add log.");
    }
  };

  const handleEditLogClick = (log: CadetLog) => {
    const logToEdit = { ...log, createdAt: log.createdAt instanceof Timestamp ? log.createdAt : Timestamp.now() };
    setEditingLog(logToEdit);
    setIsEditLogModalOpen(true);
  };

  const handleUpdateLog = async () => {
    if (!editingLog || !editingLog.id || !editingLog.createdAt) { toast.error("Log data missing for update."); return; }
    let calculatedSessionHours = editingLog.sessionHours;
    try {
      const startDateTime = new Date(`${editingLog.date}T${editingLog.timeStarted}`);
      let endDateTime = new Date(`${editingLog.date}T${editingLog.timeEnded}`);
      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) throw new Error("Invalid date/time");
      if (endDateTime <= startDateTime) endDateTime.setDate(endDateTime.getDate() + 1);
      calculatedSessionHours = parseFloat(Math.max(0, (endDateTime.getTime() - startDateTime.getTime()) / 3600000).toFixed(1));
    } catch (e) { calculatedSessionHours = editingLog.sessionHours > 0 ? editingLog.sessionHours : 0; }

    let recalculatedCumulativeHours = calculatedSessionHours;
    try {
      const previousLogsQuery = query(
        collection(dbFirestore, "cadetLogs"), where("cadetName", "==", editingLog.cadetName),
        where("type", "==", "session"), where("createdAt", "<", editingLog.createdAt),
        orderBy("createdAt", "desc"), limit(1)
      );
      const previousLogsSnapshot = await getDocs(previousLogsQuery);
      if (!previousLogsSnapshot.empty) {
        const previousLog = previousLogsSnapshot.docs[0].data() as CadetLog;
        recalculatedCumulativeHours = parseFloat(((previousLog.cumulativeHours || 0) + calculatedSessionHours).toFixed(1));
      }

      const currentProgress = getCurrentProgressState(editingLog.cadetName);
      if (recalculatedCumulativeHours >= 20 && !currentProgress.hoursComplete) {
        const newProgressState = { ...currentProgress, hoursComplete: true };
        await saveProgressUpdate(editingLog.cadetName, newProgressState, "Auto 20 hours complete (log edit).");
        toast.info(`${editingLog.cadetName} reached 20 hours!`);
      }

      const logRef = doc(dbFirestore, "cadetLogs", editingLog.id);
      const { id, createdAt, ...updateData } = editingLog;
      const finalUpdateData: Partial<CadetLog> = { ...updateData, sessionHours: calculatedSessionHours, cumulativeHours: recalculatedCumulativeHours };
      if (editingLog.type === 'progress_update' && editingLog.progressSnapshot) finalUpdateData.progressSnapshot = editingLog.progressSnapshot;
      await updateDoc(logRef, finalUpdateData);

      setLogs(prevLogs => prevLogs.map(log => log.id === editingLog.id ? { ...editingLog, sessionHours: calculatedSessionHours, cumulativeHours: recalculatedCumulativeHours, progressSnapshot: finalUpdateData.progressSnapshot } : log)
                                  .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)));
      toast.success("Log updated successfully!");
      setIsEditLogModalOpen(false); setEditingLog(null);
    } catch (error) { console.error("Error updating log:", error); toast.error("Failed to update log."); }
  };

  const requestDelete = (id: string | undefined, type: 'log' | 'note' | 'announcement') => {
    if (!id) { toast.error(`Invalid ${type} ID.`); return; }
    setItemToDelete({ id, type });
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const { id, type } = itemToDelete;
    const collectionName = type === 'log' ? 'cadetLogs' : type === 'note' ? 'ftoCadetNotes' : 'ftoAnnouncements';
    const ref = doc(dbFirestore, collectionName, id);
    try {
      await deleteDoc(ref);
      if (type === 'log') setLogs((prev) => prev.filter((item) => item.id !== id));
      else if (type === 'note') setAllFtoCadetNotes((prev) => prev.filter((item) => item.id !== id));
      else if (type === 'announcement') setFtoAnnouncements((prev) => prev.filter((item) => item.id !== id));
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`);
    } catch (error) { console.error(`Error deleting ${type}:`, error); toast.error(`Failed to delete ${type}.`); }
    finally { setIsConfirmModalOpen(false); setItemToDelete(null); }
  };

  const handleProgressChange = async (cadetName: string, itemKey: ProgressItemKey, isChecked: boolean) => {
    const currentProgress = getCurrentProgressState(cadetName);
    const newProgressState = { ...currentProgress, [itemKey]: isChecked };
    if (itemKey === 'hoursComplete' && !isChecked) {
      const totalHours = getCadetTotalHours(cadetName);
      if (totalHours >= 20) { toast.warn(`Cannot uncheck 20 hours: cadet has ${totalHours.toFixed(1)} hours.`); return; }
    }
    const summary = `Manually updated: ${progressItems[itemKey]} to ${isChecked ? 'Complete' : 'Incomplete'}`;
    const successLog = await saveProgressUpdate(cadetName, newProgressState, summary);
    if (successLog) toast.success(`Progress for ${cadetName} updated.`);
  };

  const handleAddAnnouncement = async (title: string, content: string) => {
    if (!authUser) { toast.error("User not found."); return; }
    try {
      const announcementData: Omit<FTOAnnouncement, "id"> = {
        title: title.trim(), content, authorName: authUser.name || "Unknown",
        authorRank: authUser.rank || "Unknown", createdAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(dbFirestore, "ftoAnnouncements"), announcementData);
      setFtoAnnouncements(prev => [{ ...announcementData, id: docRef.id }, ...prev].sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)));
      toast.success("Announcement added.");
    } catch (error) { console.error("Error adding announcement:", error); toast.error("Failed to add announcement."); }
  };

  const handleSaveEditAnnouncement = async (announcement: FTOAnnouncement) => {
    if (!announcement.id) { toast.error("Announcement ID missing."); return; }
    const announcementRef = doc(dbFirestore, "ftoAnnouncements", announcement.id);
    try {
      const { id, createdAt, ...updateData } = announcement;
      await updateDoc(announcementRef, updateData);
      setFtoAnnouncements(prev => prev.map(ann => ann.id === announcement.id ? announcement : ann)
                                      .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)));
      toast.success("Announcement updated successfully!");
    } catch (error) { console.error("Error updating announcement:", error); toast.error("Failed to update announcement."); }
  };

  const renderFTOHome = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[#f3c700] border-b border-border pb-2">Cadet Overview</h2>
      {cadets.length === 0 ? <p className="text-muted-foreground italic">No cadets found.</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cadets.map((cadet) => {
            const totalHours = getCadetTotalHours(cadet.name);
            const lastLog = getCadetLastLog(cadet.name);
            const currentProgress = getCurrentProgressState(cadet.name);
            const completedCount = Object.values(currentProgress).filter(Boolean).length;
            const progressPercent = totalProgressItems > 0 ? Math.round((completedCount / totalProgressItems) * 100) : 0;
            const latestNote = allFtoCadetNotes.filter(note => note.cadetId === cadet.id)?.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))[0];

            return (
              <Card key={cadet.id} className="flex flex-col justify-between border-border bg-card">
                <CardHeader className="pt-4">
                  <CardTitle className="text-lg text-[#f3c700]">{cadet.name} | {cadet.badge || "N/A"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-foreground"><span className="font-semibold text-muted-foreground">Total Hours:</span> {totalHours.toFixed(1)}</p>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Progress ({completedCount}/{totalProgressItems})</p>
                    <Progress value={progressPercent} className="h-2 [&>div]:bg-[#f3c700]" />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col items-start space-y-3 text-xs pt-4 border-t border-border">
                  {lastLog ? (
                    <div className="w-full">
                      <p className="font-semibold text-muted-foreground mb-0.5">Last Session:</p>
                      <p className="text-foreground"><span className="font-medium">Date:</span> {formatDateToMMDDYY(lastLog.date)}</p>
                      <p className="text-foreground"><span className="font-medium">Hours:</span> {lastLog.sessionHours.toFixed(1)}</p>
                      <p className="text-foreground"><span className="font-medium">FTO:</span> {lastLog.ftoName}</p>
                    </div>
                  ) : <p className="text-muted-foreground italic w-full">No sessions logged.</p>}
                  <div className="w-full pt-3 border-t border-border/50">
                    <p className="font-semibold text-muted-foreground mb-0.5">Latest FTO Note:</p>
                    {latestNote ? (
                      <>
                        <p className="italic text-foreground truncate" title={latestNote.note}>"{latestNote.note}"</p>
                        <p className="text-muted-foreground/80">- {latestNote.ftoName} on {formatTimestampForDisplay(latestNote.createdAt)}</p>
                      </>
                    ) : <p className="italic text-muted-foreground/80">No notes added.</p>}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderCadetHome = () => {
    const self = allUsers.find(u => u.id === authUser?.id);
    const selfNotes = allFtoCadetNotes
      .filter(note => note.cadetId === authUser?.id)
      .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));

    const renderCadetOwnOverviewCard = (cadet: RosterUser | undefined) => {
        if (!cadet) return <Card className="bg-card border-border"><CardContent><p className="text-muted-foreground italic p-4">Could not find your data.</p></CardContent></Card>;
        const totalHours = getCadetTotalHours(cadet.name);
        const lastLog = getCadetLastLog(cadet.name);
        const currentProgress = getCurrentProgressState(cadet.name);
        const completedCount = Object.values(currentProgress).filter(Boolean).length;
        const progressPercent = totalProgressItems > 0 ? Math.round((completedCount / totalProgressItems) * 100) : 0;

        return (
          <Card className="bg-card border-border h-full">
            <CardHeader className="pt-4">
              <CardTitle className="text-lg text-[#f3c700]">{cadet.name} | {cadet.badge || "N/A"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-foreground"><span className="font-semibold text-muted-foreground">Total Hours:</span> {totalHours.toFixed(1)}</p>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Progress ({completedCount}/{totalProgressItems})</p>
                <Progress value={progressPercent} className="h-2 transition-all duration-500 [&>div]:bg-[#f3c700]" />
              </div>
            </CardContent>
            {lastLog && (
              <CardFooter className="text-xs pt-4 border-t border-border">
                <div className="w-full">
                  <p className="font-semibold text-muted-foreground mb-0.5">Last Session:</p>
                  <p className="text-foreground"><span className="font-medium">Date:</span> {formatDateToMMDDYY(lastLog.date)}</p>
                  <p className="text-foreground"><span className="font-medium">Hours:</span> {lastLog.sessionHours.toFixed(1)}</p>
                  <p className="text-foreground"><span className="font-medium">FTO:</span> {lastLog.ftoName}</p>
                </div>
              </CardFooter>
            )}
            {!lastLog && (
                <CardFooter className="text-xs pt-4 border-t border-border">
                    <p className="text-muted-foreground italic w-full">No sessions logged yet.</p>
                </CardFooter>
            )}
          </Card>
        );
    };

    const renderCadetOwnNotes = () => (
      <Card className="bg-card border-border">
        <CardHeader className="pt-4">
          <CardTitle className="text-xl text-[#f3c700]">My FTO Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-72 w-full pr-4">
            <div className="space-y-4">
              {loading && <p className="text-[#f3c700] italic">Loading notes…</p>}
              {error && <p className="text-destructive italic">{error}</p>}
              {!loading && !error && selfNotes.length > 0 ? (
                selfNotes.map(note => (
                  <div key={note.id} className="p-3 bg-muted/50 border border-border/50 rounded-lg text-sm">
                    <p className="text-foreground">{note.note}</p>
                    <p className="text-xs text-[#f3c700] mt-2">— {note.ftoName} <span className="text-muted-foreground">({note.ftoRank})</span> on <span className="text-muted-foreground">{formatTimestampForDisplay(note.createdAt)}</span></p>
                  </div>
                ))
              ) : !loading && !error ? <p className="text-muted-foreground italic">No FTO notes available.</p> : null}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );

    const renderCadetOwnProgress = (cadet: RosterUser | undefined) => {
        if (!cadet) return <Card className="bg-card border-border"><CardContent><p className="text-muted-foreground italic p-4">Could not find your data.</p></CardContent></Card>;
        const currentProgress = getCurrentProgressState(cadet.name);
        return (
          <Card key={cadet.id} className="bg-card border-border h-full flex flex-col">
            <CardHeader className="pt-4">
              <CardTitle className="text-xl text-[#f3c700]">My Training Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 flex-grow">
              {Object.entries(progressItems).map(([key, label]) => {
                const itemKey = key as ProgressItemKey;
                const isChecked = currentProgress[itemKey];
                return (
                  <div key={key} className="flex items-center gap-3">
                    <Checkbox id={`${cadet.id}-${itemKey}`} checked={isChecked} disabled className="data-[state=checked]:bg-[#f3c700] data-[state=checked]:text-black border-border" />
                    <label htmlFor={`${cadet.id}-${itemKey}`} className={`text-sm ${isChecked ? "text-[#f3c700] line-through" : "text-foreground"} ${isChecked ? 'opacity-70' : ''}`}>{label}</label>
                  </div>
                );
              })}
            </CardContent>
            <CardFooter className="text-xs pt-3 border-t border-border">
                <p className="text-muted-foreground italic">Progress is updated by FTOs.</p>
            </CardFooter>
          </Card>
        );
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 auto-rows-fr">
        {renderCadetOwnOverviewCard(self)}
        {renderCadetOwnProgress(self)}
        <FTOPersonnel
          allUsers={allUsers}
          logs={logs}
          allFtoCadetNotes={allFtoCadetNotes}
          isCadet={true}
          getFTOHoursLast30Days={getFTOHoursLast30Days}
          getFTOLastLog={getFTOLastLog}
          getLogsForFTO={getLogsForFTO}
          getNotesByFTO={getNotesByFTO}
        />
        <div className="col-span-full">{renderCadetOwnNotes()}</div>
      </div>
    );
  };

  if (authLoading || loading) {
    return <Layout><div className="text-center text-[#f3c700] p-8">Loading FTO Data...</div></Layout>;
  }

  if (!hasFtoPermission && !isCadet) {
    return <Layout><div className="text-center text-red-500 p-8">You do not have permission to access FTO Management.</div></Layout>;
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 text-foreground">
        <div className="bg-card border border-border rounded-lg p-4 shadow-md mb-6">
          <h1 className="text-3xl font-bold text-[#f3c700] text-center">
            {isCadet ? "Cadet Overview" : "FTO Management"}
          </h1>
        </div>

        {!isCadet && (
          <div className="flex space-x-1 border-b border-border mb-6">
            {(["home", "announcements", "add", "logs", "progress", "personnel"] as FtoTabKey[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-md focus:outline-none transition-colors ${
                  activeTab === tab
                    ? "bg-[#f3c700] text-black font-semibold border-b-2 border-transparent"
                    : "bg-card/50 text-[#f3c700] hover:bg-card/80 border-b-2 border-transparent hover:border-muted-foreground/50"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        )}

        <div className="bg-card p-4 md:p-6 rounded-lg shadow-lg border border-border">
          {loading && <p className="text-center text-[#f3c700]">Loading FTO Data...</p>}
          {error && <p className="text-center text-red-500">{error}</p>}

          {!loading && !error && (
            <>
              {isCadet ? (
                renderCadetHome()
              ) : (
                <>
                  {activeTab === "home" && renderFTOHome()}
                  {activeTab === "announcements" && (
                    <FTOAnnouncements
                      authUser={authUser && authUser.rank ? authUser as RosterUser : null}
                      announcements={ftoAnnouncements}
                      canManageAnnouncements={canManageAnnouncements}
                      loadingAnnouncements={loadingAnnouncements}
                      errorAnnouncements={errorAnnouncements}
                      onAddAnnouncement={handleAddAnnouncement}
                      onDeleteAnnouncement={(id) => requestDelete(id, 'announcement')}
                      onSaveEditAnnouncement={handleSaveEditAnnouncement}
                    />
                  )}
                  {activeTab === "add" && (
                    <AddCadetLog
                      authUser={authUser && authUser.id ? authUser as RosterUser : null}
                      cadets={cadets}
                      logs={logs}
                      onLogAdded={handleAddLog}
                      saveProgressUpdate={saveProgressUpdate}
                      getCurrentProgressState={getCurrentProgressState}
                    />
                  )}
                  {activeTab === "logs" && (
                    <CadetLogs
                      authUser={authUser && authUser.id ? authUser as RosterUser : null}
                      cadets={cadets}
                      logs={logs}
                      onEditLog={handleEditLogClick}
                      onDeleteLog={(id) => requestDelete(id, 'log')}
                      onDeleteNote={(id) => requestDelete(id, 'note')}
                    />
                  )}
                  {activeTab === "progress" && (
                    <CadetProgress
                      cadets={cadets}
                      getCurrentProgressState={getCurrentProgressState}
                      onProgressChange={handleProgressChange}
                    />
                  )}
                  {activeTab === "personnel" && (
                    <FTOPersonnel
                      allUsers={allUsers}
                      logs={logs}
                      allFtoCadetNotes={allFtoCadetNotes}
                      isCadet={false}
                      getFTOHoursLast30Days={getFTOHoursLast30Days}
                      getFTOLastLog={getFTOLastLog}
                      getLogsForFTO={getLogsForFTO}
                      getNotesByFTO={getNotesByFTO}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {isEditLogModalOpen && editingLog && (
        <Modal isOpen={isEditLogModalOpen} onClose={() => { setIsEditLogModalOpen(false); setEditingLog(null); }}>
          <div className="p-6 bg-black/80 border border-white/20 rounded-lg text-white max-w-4xl w-full mx-auto shadow-lg">
            <h2 className="text-xl font-semibold text-[#f3c700] mb-5 border-b border-white/10 pb-2">Edit Training Log</h2>
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-white/80">Cadet</label>
                <input type="text" value={editingLog.cadetName} readOnly className="input w-full bg-black/20 border-white/10 text-white/60" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80">Date</label>
                <input
                  type="date"
                  value={editingLog.date}
                  onChange={(e) => setEditingLog(prev => prev ? { ...prev, date: e.target.value } : null)}
                  className="input w-full bg-black/40 border-white/20 text-white" style={{ colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80">Time Started</label>
                <input
                  type="time"
                  value={editingLog.timeStarted}
                  onChange={(e) => setEditingLog(prev => prev ? { ...prev, timeStarted: e.target.value } : null)}
                  className="input w-full bg-black/40 border-white/20 text-white" style={{ colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80">Time Ended</label>
                <input
                  type="time"
                  value={editingLog.timeEnded}
                  onChange={(e) => setEditingLog(prev => prev ? { ...prev, timeEnded: e.target.value } : null)}
                  className="input w-full bg-black/40 border-white/20 text-white" style={{ colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80">Summary</label>
                <textarea
                  value={editingLog.summary}
                  onChange={(e) => setEditingLog(prev => prev ? { ...prev, summary: e.target.value } : null)}
                  className="input w-full bg-black/40 border-white/20 text-white" rows={3}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80">Additional Notes</label>
                <textarea
                  value={editingLog.additionalNotes}
                  onChange={(e) => setEditingLog(prev => prev ? { ...prev, additionalNotes: e.target.value } : null)}
                  className="input w-full bg-black/40 border-white/20 text-white" rows={3}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3 border-t border-white/10 pt-4">
              <button
                onClick={() => { setIsEditLogModalOpen(false); setEditingLog(null); }}
                className="button-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateLog}
                className="button-primary"
              >
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onCancel={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title={`Confirm Deletion`}
        message={`Are you sure you want to delete this ${itemToDelete?.type}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </Layout>
  );
};

export default FTOPage;

