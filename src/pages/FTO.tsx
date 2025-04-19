import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  limit,
  where,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import { toast } from "react-toastify";
import { RosterUser, FTOAnnouncement, FTOCadetNote } from "../types/User";
import TipTapEditor from "../components/TipTapEditor";
import { computeIsAdmin } from "../utils/isadmin";

interface CadetLog {
  id?: string;
  cadetName: string;
  date: string;
  timeStarted: string;
  timeEnded: string;
  sessionHours: number;
  cumulativeHours: number;
  ftoName: string;
  summary: string;
  additionalNotes: string;
  createdAt?: Timestamp;
  type?: "session" | "progress_update";
  progressSnapshot?: { [key in ProgressItemKey]: boolean };
}

const progressItems = {
  hoursComplete: "Complete 20 hours of direct training",
  bcBankPrimary: "Primary one Blaine County Bank",
  pacificBankPrimary: "Primary one Pacific Standard Bank",
  heistPrimary: "Primary one of these heists (Bobcat, LSIA, Fleeca)",
  tenEightyPrimary: "Primary in 10-80 with callouts",
  blsComplete: "Complete BLS Training and perform BLS",
};
type ProgressItemKey = keyof typeof progressItems;
const totalProgressItems = Object.keys(progressItems).length;
const initialProgressState: { [key in ProgressItemKey]: boolean } = Object.keys(progressItems).reduce(
  (acc, key) => {
    acc[key as ProgressItemKey] = false;
    return acc;
  },
  {} as { [key in ProgressItemKey]: boolean }
);

type FtoTabKey = "home" | "announcements" | "add" | "logs" | "progress" | "personnel";
type CadetTabKey = "home" | "progress" | "personnel";

const FTOPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = useMemo(() => computeIsAdmin(user), [user]);
  const isCadet = useMemo(() => user?.rank === "Cadet", [user]);

  const [allUsers, setAllUsers] = useState<RosterUser[]>([]);
  const [logs, setLogs] = useState<CadetLog[]>([]);
  const [ftoAnnouncements, setFtoAnnouncements] = useState<FTOAnnouncement[]>([]);
  const [ftoNotes, setFtoNotes] = useState<FTOCadetNote[]>([]);
  const [allFtoCadetNotes, setAllFtoCadetNotes] = useState<FTOCadetNote[]>([]);
  const [newLog, setNewLog] = useState<CadetLog>({
    cadetName: "",
    date: "",
    timeStarted: "",
    timeEnded: "",
    sessionHours: 0,
    cumulativeHours: 0,
    ftoName: user?.name || "",
    summary: "",
    additionalNotes: "",
    type: "session",
  });
  const [activeTab, setActiveTab] = useState<FtoTabKey | CadetTabKey>("home");
  const [selectedCadetForLogs, setSelectedCadetForLogs] = useState<RosterUser | null>(null);
  const [newNoteForSelectedCadet, setNewNoteForSelectedCadet] = useState("");
  const [selectedFtoForDetails, setSelectedFtoForDetails] = useState<RosterUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [errorAnnouncements, setErrorAnnouncements] = useState<string | null>(null);
  const [isAddingAnnouncement, setIsAddingAnnouncement] = useState(false);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState("");
  const [newAnnouncementContent, setNewAnnouncementContent] = useState("");

  const cadets = useMemo(() => allUsers.filter((u) => u.rank === "Cadet"), [allUsers]);
  const ftoPersonnel = useMemo(() => {
    const ftoUsers = allUsers.filter((u) => {
      const ftoCert = u.certifications?.FTO;
      return ftoCert === "CERT" || ftoCert === "LEAD" || ftoCert === "SUPER";
    });

    const certOrder: { [key: string]: number } = { LEAD: 1, SUPER: 2, CERT: 3 };

    ftoUsers.sort((a, b) => {
      const certA = a.certifications?.FTO || "";
      const certB = b.certifications?.FTO || "";
      const orderA = certOrder[certA] || 99;
      const orderB = certOrder[certB] || 99;

      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });

    return ftoUsers;
  }, [allUsers]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setLoadingAnnouncements(true);
      setError(null);
      setErrorAnnouncements(null);
      try {
        const usersQuery = query(collection(dbFirestore, "users"), orderBy("name"));
        const usersSnapshot = await getDocs(usersQuery);
        const usersData = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as RosterUser[];
        setAllUsers(usersData);

        const logsQuery = query(collection(dbFirestore, "cadetLogs"), orderBy("createdAt", "desc"));
        const logsSnapshot = await getDocs(logsQuery);
        const logsData = logsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as CadetLog[];
        setLogs(logsData);

        const announcementsQuery = query(
          collection(dbFirestore, "ftoAnnouncements"),
          orderBy("createdAt", "desc")
        );
        const announcementsSnapshot = await getDocs(announcementsQuery);
        const announcementsData = announcementsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as FTOAnnouncement[];
        setFtoAnnouncements(announcementsData);

        const allNotesQuery = query(
          collection(dbFirestore, "ftoCadetNotes"),
          orderBy("createdAt", "desc")
        );
        const allNotesSnapshot = await getDocs(allNotesQuery);
        const allNotesData = allNotesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt instanceof Timestamp
            ? doc.data().createdAt
            : Timestamp.now()
        })) as FTOCadetNote[];
        setAllFtoCadetNotes(allNotesData);
      } catch (err) {
        console.error("Error fetching FTO data:", err);
        setError("Failed to load FTO data.");
        setErrorAnnouncements("Failed to load announcements.");
        toast.error("Failed to load FTO data.");
      } finally {
        setLoading(false);
        setLoadingAnnouncements(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (newLog.date && newLog.timeStarted && newLog.timeEnded) {
      try {
        const startDateTime = new Date(`${newLog.date}T${newLog.timeStarted}`);
        const endDateTime = new Date(`${newLog.date}T${newLog.timeEnded}`);

        if (endDateTime > startDateTime) {
          const diffMilliseconds = endDateTime.getTime() - startDateTime.getTime();
          const diffHours = diffMilliseconds / (1000 * 60 * 60);
          setNewLog((prev) => ({ ...prev, sessionHours: diffHours }));
        } else {
          setNewLog((prev) => ({ ...prev, sessionHours: 0 }));
          if (newLog.timeEnded) {
            toast.warn("End time must be after start time.");
          }
        }
      } catch (e) {
        console.error("Error calculating time difference:", e);
        setNewLog((prev) => ({ ...prev, sessionHours: 0 }));
      }
    } else {
      setNewLog((prev) => ({ ...prev, sessionHours: 0 }));
    }
  }, [newLog.date, newLog.timeStarted, newLog.timeEnded]);

  useEffect(() => {
    if (isCadet && !["home", "progress", "personnel"].includes(activeTab)) {
      setActiveTab("home");
    }
  }, [isCadet, activeTab]);

  useEffect(() => {
    if (isCadet && user?.id) {
      const fetchCadetNotes = async () => {
        setLoading(true);
        try {
          const userId = user.id;
          if (!userId) {
            throw new Error("User ID is undefined, cannot fetch notes.");
          }
          const notesQuery = query(
            collection(dbFirestore, "ftoCadetNotes"),
            where("cadetId", "==", userId),
            orderBy("createdAt", "desc")
          );
          const notesSnapshot = await getDocs(notesQuery);
          setFtoNotes(
            notesSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt instanceof Timestamp
                ? doc.data().createdAt
                : Timestamp.now()
            })) as FTOCadetNote[]
          );
        } catch (err) {
          console.error("Error fetching FTO cadet notes:", err);
          if (err instanceof Error && err.message.includes("User ID is undefined")) {
            setError("Could not fetch notes: User ID missing.");
          } else {
            setError("Failed to load your FTO notes.");
          }
        } finally {
          setLoading(false);
        }
      };
      fetchCadetNotes();
    } else {
      setFtoNotes([]);
    }
  }, [isCadet, user?.id]);

  const handleAddLog = async () => {
    if (
      !newLog.cadetName ||
      !newLog.date ||
      !newLog.timeStarted ||
      !newLog.timeEnded ||
      newLog.sessionHours <= 0
    ) {
      toast.error(
        "Please select cadet, enter date, valid start/end times (resulting in positive hours)."
      );
      return;
    }

    try {
      const cadetSessionLogs = logs
        .filter((log) => log.cadetName === newLog.cadetName && (!log.type || log.type === "session"))
        .sort((a, b) =>
          b.createdAt && a.createdAt
            ? b.createdAt.toMillis() - a.createdAt.toMillis()
            : 0
        );

      const lastSessionLog = cadetSessionLogs[0];
      const cumulativeHours = (lastSessionLog?.cumulativeHours || 0) + newLog.sessionHours;

      const logData: Omit<CadetLog, "id"> = {
        ...newLog,
        cumulativeHours,
        ftoName: user?.name || "Unknown FTO",
        createdAt: Timestamp.now(),
        type: "session",
        progressSnapshot: undefined,
      };

      const docRef = await addDoc(collection(dbFirestore, "cadetLogs"), logData);

      setLogs((prevLogs) => [{ ...logData, id: docRef.id }, ...prevLogs]);

      setNewLog({
        cadetName: "",
        date: "",
        timeStarted: "",
        timeEnded: "",
        sessionHours: 0,
        cumulativeHours: 0,
        ftoName: user?.name || "",
        summary: "",
        additionalNotes: "",
        type: "session",
      });
      toast.success("Log added successfully!");
    } catch (error) {
      console.error("Error adding log:", error);
      toast.error("Failed to add log.");
    }
  };

  const handleAddNoteForSelectedCadet = async () => {
    if (!selectedCadetForLogs) {
      toast.error("No cadet selected.");
      return;
    }
    if (!newNoteForSelectedCadet.trim()) {
      toast.error("Note cannot be empty.");
      return;
    }
    if (!user?.id || !user?.name || !user?.rank) {
      toast.error("Your user information is missing or incomplete.");
      return;
    }

    try {
      const noteData: Omit<FTOCadetNote, "id"> = {
        cadetId: selectedCadetForLogs.id,
        cadetName: selectedCadetForLogs.name,
        ftoId: user.id,
        ftoName: user.name,
        ftoRank: user.rank,
        note: newNoteForSelectedCadet.trim(),
        createdAt: Timestamp.now(),
      };
      const notesColRef = collection(dbFirestore, "ftoCadetNotes");
      await addDoc(notesColRef, noteData);

      setNewNoteForSelectedCadet("");
      toast.success(`Note added for ${selectedCadetForLogs.name}.`);
    } catch (err) {
      console.error("Error adding FTO cadet note:", err);
      toast.error("Failed to add note.");
    }
  };

  const getCurrentProgressState = (cadetName: string): { [key in ProgressItemKey]: boolean } => {
    const progressLogs = logs
      .filter(
        (log) =>
          log.cadetName === cadetName &&
          log.type === "progress_update" &&
          log.progressSnapshot
      )
      .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));

    if (progressLogs.length > 0) {
      const latestSnapshot = progressLogs[0].progressSnapshot!;
      const completeState = { ...initialProgressState };
      for (const key in progressItems) {
        if (latestSnapshot.hasOwnProperty(key)) {
          completeState[key as ProgressItemKey] = latestSnapshot[key as ProgressItemKey];
        }
      }
      return completeState;
    }
    return { ...initialProgressState };
  };

  const handleProgressChange = async (
    cadetName: string,
    itemKey: ProgressItemKey,
    isChecked: boolean
  ) => {
    if (!user?.name) {
      toast.error("Cannot update progress: FTO name not found.");
      return;
    }

    const currentProgress = getCurrentProgressState(cadetName);
    const newProgressState = {
      ...currentProgress,
      [itemKey]: isChecked,
    };

    const progressLogEntry: Omit<CadetLog, "id"> = {
      cadetName: cadetName,
      ftoName: user.name,
      createdAt: Timestamp.now(),
      type: "progress_update",
      progressSnapshot: newProgressState,
      date: new Date().toISOString().split("T")[0],
      timeStarted: "",
      timeEnded: "",
      sessionHours: 0,
      cumulativeHours: 0,
      summary: `Progress updated for item: ${itemKey} to ${isChecked}`,
      additionalNotes: "",
    };

    try {
      const docRef = await addDoc(collection(dbFirestore, "cadetLogs"), progressLogEntry);
      setLogs((prevLogs) => [{ ...progressLogEntry, id: docRef.id }, ...prevLogs]);
      toast.success(`Progress for ${cadetName} updated.`);
    } catch (error) {
      console.error("Error saving progress update:", error);
      toast.error("Failed to save progress update.");
    }
  };

  const getCadetTotalHours = (cadetName: string): number => {
    const cadetSessionLogs = logs.filter(
      (log) => log.cadetName === cadetName && (!log.type || log.type === "session")
    );
    if (cadetSessionLogs.length === 0) return 0;
    return Math.max(...cadetSessionLogs.map((log) => log.cumulativeHours || 0));
  };

  const getCadetLastLog = (cadetName: string): CadetLog | null => {
    const cadetSessionLogs = logs
      .filter((log) => log.cadetName === cadetName && (!log.type || log.type === "session"))
      .sort((a, b) =>
        b.createdAt && a.createdAt
          ? b.createdAt.toMillis() - a.createdAt.toMillis()
          : 0
      );
    return cadetSessionLogs[0] || null;
  };

  const getFTOHoursLast30Days = (ftoName: string): number => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);

    return logs
      .filter(
        (log) =>
          log.ftoName === ftoName &&
          (!log.type || log.type === "session") &&
          log.createdAt &&
          log.createdAt >= thirtyDaysAgoTimestamp
      )
      .reduce((sum, log) => sum + log.sessionHours, 0);
  };

  const getFTOLastLog = (ftoName: string): CadetLog | null => {
    const ftoSessionLogs = logs
      .filter((log) => log.ftoName === ftoName && (!log.type || log.type === "session"))
      .sort((a, b) =>
        b.createdAt && a.createdAt
          ? b.createdAt.toMillis() - a.createdAt.toMillis()
          : 0
      );
    return ftoSessionLogs[0] || null;
  };

  const getLogsForFTO = (ftoName: string): CadetLog[] => {
    return logs
      .filter((log) => log.ftoName === ftoName && (!log.type || log.type === "session"))
      .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
  };

  const getNotesByFTO = (ftoId: string): FTOCadetNote[] => {
    return allFtoCadetNotes
      .filter((note) => note.ftoId === ftoId)
      .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
  };

  const renderCadetOwnOverview = (cadet: RosterUser | undefined) => {
    if (!cadet) {
      return <p className="text-white/60 italic">Could not find your cadet data.</p>;
    }
    const totalHours = getCadetTotalHours(cadet.name);
    const lastLog = getCadetLastLog(cadet.name);
    const currentProgress = getCurrentProgressState(cadet.name);
    const completedCount = Object.values(currentProgress).filter(Boolean).length;
    const progressPercent =
      totalProgressItems > 0 ? (completedCount / totalProgressItems) * 100 : 0;

    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-[#f3c700] border-b border-white/20 pb-2">
          My Overview
        </h2>
        <div
          key={cadet.id}
          className="bg-black/60 p-4 rounded-lg shadow border border-white/20 space-y-3 max-w-md"
        >
          <h3 className="text-lg font-bold text-[#f3c700]">
            {cadet.name} | {cadet.badge || "N/A"}
          </h3>
          <p className="text-sm text-white/80">
            <span className="font-semibold">Total Hours:</span>{" "}
            {totalHours.toFixed(1)}
          </p>
          <div>
            <p className="text-sm font-semibold text-white/80 mb-1">
              Progress ({completedCount}/{totalProgressItems})
            </p>
            <div className="w-full bg-black/40 rounded-full h-2.5">
              <div
                className="bg-[#f3c700] h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
          {lastLog ? (
            <div className="text-xs text-white/60 border-t border-white/20 pt-2 mt-2">
              <p>
                <span className="font-semibold">Last Session:</span>{" "}
                {lastLog.date}
              </p>
              <p>
                <span className="font-semibold">Hours:</span>{" "}
                {lastLog.sessionHours.toFixed(1)}
              </p>
              <p>
                <span className="font-semibold">FTO:</span> {lastLog.ftoName}
              </p>
            </div>
          ) : (
            <p className="text-xs text-white/50 italic border-t border-white/20 pt-2 mt-2">
              No sessions logged yet.
            </p>
          )}
        </div>
        <div className="p-4 bg-black bg-opacity-70 border border-gray-700 rounded-lg">
          <h2 className="text-xl font-semibold text-yellow-400 mb-3">
            My FTO Notes
          </h2>
          <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
            {loading && <p className="text-yellow-400 italic">Loading notes...</p>}
            {error && <p className="text-red-500 italic">{error}</p>}
            {!loading && !error && ftoNotes.length > 0 ? (
              ftoNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 bg-gray-800 rounded border border-gray-600 text-sm"
                >
                  <p className="text-gray-200">{note.note}</p>
                  <p className="text-xs text-yellow-500 mt-1">
                    - {note.ftoName} ({note.ftoRank}) on{" "}
                    {(note.createdAt ?? Timestamp.now()).toDate().toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : !loading && !error ? (
              <p className="text-gray-400 italic">
                No FTO notes available.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderFTOHome = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[#f3c700] border-b border-white/20 pb-2">
        Cadet Overview
      </h2>
      {cadets.length === 0 ? (
        <p className="text-white/60 italic">No cadets found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cadets.map((cadet) => {
            const totalHours = getCadetTotalHours(cadet.name);
            const lastLog = getCadetLastLog(cadet.name);
            const currentProgress = getCurrentProgressState(cadet.name);
            const completedCount = Object.values(currentProgress).filter(Boolean).length;
            const progressPercent =
              totalProgressItems > 0 ? (completedCount / totalProgressItems) * 100 : 0;

            const latestNote = allFtoCadetNotes
              .filter(note => note.cadetId === cadet.id)
              ?.[0];

            return (
              <div
                key={cadet.id}
                className="bg-black/60 p-4 rounded-lg shadow border border-white/20 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-lg font-bold text-[#f3c700]">
                    {cadet.name} | {cadet.badge || "N/A"}
                  </h3>
                  <p className="text-sm text-white/80">
                    <span className="font-semibold">Total Hours:</span>{" "}
                    {totalHours.toFixed(1)}
                  </p>
                  <div>
                    <p className="text-sm font-semibold text-white/80 mb-1">
                      Progress ({completedCount}/{totalProgressItems})
                    </p>
                    <div className="w-full bg-black/40 rounded-full h-2.5">
                      <div
                        className="bg-[#f3c700] h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                {lastLog ? (
                  <div className="text-xs text-white/60 border-t border-white/20 pt-2 mt-2">
                    <p><span className="font-semibold">Last Session:</span> {lastLog.date} ({lastLog.sessionHours.toFixed(1)} hrs)</p>
                    <p><span className="font-semibold">FTO:</span> {lastLog.ftoName}</p>
                  </div>
                ) : (
                  <p className="text-xs text-white/50 italic border-t border-white/20 pt-2 mt-2">
                    No sessions logged yet.
                  </p>
                )}
                <div className="text-xs text-white/70 border-t border-white/20 pt-2 mt-2">
                  <p className="font-semibold text-[#f3c700] mb-0.5">Latest FTO Note:</p>
                  {latestNote ? (
                    <>
                      <p className="italic truncate" title={latestNote.note}>"{latestNote.note}"</p>
                      <p className="text-white/50">
                        - {latestNote.ftoName} on {latestNote.createdAt.toDate().toLocaleDateString()}
                      </p>
                    </>
                  ) : (
                    <p className="italic text-white/50">No notes added yet.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderAddLogForm = () => (
    <div className="bg-black/60 p-4 rounded-lg shadow-lg space-y-4 border border-white/20">
      <h2 className="text-xl font-semibold text-[#f3c700]">Add Cadet Training Log</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/80">Cadet Name</label>
          <select
            value={newLog.cadetName}
            onChange={(e) =>
              setNewLog((prev) => ({ ...prev, cadetName: e.target.value }))
            }
            className="input w-full bg-black/40 border-white/20 text-white"
          >
            <option value="">Select Cadet</option>
            {cadets.map((cadet) => (
              <option key={cadet.id} value={cadet.name}>
                {cadet.name} ({cadet.badge || "No Badge"})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80">Date</label>
          <input
            type="date"
            value={newLog.date}
            onChange={(e) =>
              setNewLog((prev) => ({ ...prev, date: e.target.value }))
            }
            className="input w-full bg-black/40 border-white/20 text-white"
            style={{ colorScheme: "dark" }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80">Time Started</label>
          <input
            type="time"
            value={newLog.timeStarted}
            onChange={(e) =>
              setNewLog((prev) => ({
                ...prev,
                timeStarted: e.target.value,
              }))
            }
            className="input w-full bg-black/40 border-white/20 text-white"
            style={{ colorScheme: "dark" }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80">Time Ended</label>
          <input
            type="time"
            value={newLog.timeEnded}
            onChange={(e) =>
              setNewLog((prev) => ({
                ...prev,
                timeEnded: e.target.value,
              }))
            }
            className="input w-full bg-black/40 border-white/20 text-white"
            style={{ colorScheme: "dark" }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80">
            Session Hours (Calculated)
          </label>
          <input
            type="text"
            value={newLog.sessionHours > 0 ? newLog.sessionHours.toFixed(2) : "0.00"}
            readOnly
            className="input w-full bg-black/20 border-white/10 text-white/60"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80">FTO</label>
          <input
            type="text"
            value={newLog.ftoName}
            readOnly
            className="input w-full bg-black/20 border-white/10 text-white/60"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-white/80">
          Summary of Training Session
        </label>
        <textarea
          value={newLog.summary}
          onChange={(e) =>
            setNewLog((prev) => ({ ...prev, summary: e.target.value }))
          }
          className="input w-full bg-black/40 border-white/20 text-white"
          rows={3}
          placeholder="Describe activities, performance, and keywords for progress..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-white/80">
          Additional Notes / Areas for Improvement
        </label>
        <textarea
          value={newLog.additionalNotes}
          onChange={(e) =>
            setNewLog((prev) => ({
              ...prev,
              additionalNotes: e.target.value,
            }))
          }
          className="input w-full bg-black/40 border-white/20 text-white"
          rows={3}
          placeholder="Any other comments, feedback, or goals..."
        />
      </div>
      <button onClick={handleAddLog} className="button-primary w-full mt-4">
        Add Log
      </button>
    </div>
  );

  const renderCadetLogs = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-[#f3c700] border-b border-white/20 pb-2">
        View Cadet Logs
      </h2>
      <div className="space-y-2">
        <p className="text-white/60 text-sm">Select a cadet to view/hide their logs:</p>
        {cadets.map((cadet) => (
          <button
            key={cadet.id}
            onClick={() =>
              setSelectedCadetForLogs((prev) =>
                prev?.id === cadet.id ? null : cadet
              )
            }
            className={`block w-full text-left p-2 rounded transition-colors ${
              selectedCadetForLogs?.id === cadet.id
                ? "bg-[#f3c700] text-black font-semibold"
                : "bg-black/60 hover:bg-white/10 text-white"
            }`}
          >
            {cadet.name} | {cadet.badge || "N/A"}
          </button>
        ))}
      </div>

      {selectedCadetForLogs && (
        <div className="mt-6 border-t border-white/20 pt-4 bg-black/60 p-4 rounded-lg">
          <h3 className="text-lg font-bold text-[#f3c700] mb-3">
            Logs for {selectedCadetForLogs.name}
          </h3>
          <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar pr-2">
            {logs.filter((log) => log.cadetName === selectedCadetForLogs.name).length === 0 ? (
              <p className="text-white/60 italic">No logs found for this cadet.</p>
            ) : (
              logs
                .filter((log) => log.cadetName === selectedCadetForLogs.name)
                .map((log) => {
                  if (log.type === "progress_update") {
                    return (
                      <div
                        key={log.id}
                        className="p-2 bg-black/40 rounded shadow border border-white/10 text-xs"
                      >
                        <p className="text-white/80">
                          <span className="font-semibold text-[#f3c700]">Progress Update</span>{" "}
                          by {log.ftoName} on {log.createdAt?.toDate().toLocaleDateString()}
                        </p>
                        <p className="text-white/60 italic mt-1">{log.summary}</p>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={log.id}
                      className="p-3 bg-black/50 rounded shadow border border-white/20"
                    >
                      <p className="text-sm text-white">
                        <span className="font-semibold">Date:</span> {log.date} |{" "}
                        <span className="font-semibold">Time:</span>{" "}
                        {log.timeStarted} - {log.timeEnded}
                      </p>
                      <p className="text-sm text-white">
                        <span className="font-semibold">Session Hours:</span>{" "}
                        {log.sessionHours.toFixed(1)} |{" "}
                        <span className="font-semibold">Cumulative Hours:</span>{" "}
                        {log.cumulativeHours.toFixed(1)}
                      </p>
                      <p className="text-sm text-white">
                        <span className="font-semibold">FTO:</span> {log.ftoName}
                      </p>
                      <p className="text-sm text-white mt-2 whitespace-pre-wrap">
                        <strong className="text-[#f3c700]">Summary:</strong>{" "}
                        {log.summary || (
                          <span className="italic text-white/60">None</span>
                        )}
                      </p>
                      <p className="text-sm text-white mt-2 whitespace-pre-wrap">
                        <strong className="text-[#f3c700]">Notes:</strong>{" "}
                        {log.additionalNotes || (
                          <span className="italic text-white/60">None</span>
                        )}
                      </p>
                      <p className="text-xs text-white/60 mt-1">
                        Logged:{" "}
                        {log.createdAt
                          ? log.createdAt.toDate().toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                  );
                })
            )}
          </div>
          <div className="mt-4 p-4 bg-black/60 rounded-lg border border-white/20">
            <h3 className="text-lg font-semibold text-[#f3c700] mb-3">
              Add Note for {selectedCadetForLogs.name}
            </h3>
            <textarea
              value={newNoteForSelectedCadet}
              onChange={(e) => setNewNoteForSelectedCadet(e.target.value)}
              className="input w-full bg-black/40 border-white/20 text-white mb-2"
              rows={3}
              placeholder={`Enter note for ${selectedCadetForLogs.name}... (Visible to cadet)`}
            />
            <button
              onClick={handleAddNoteForSelectedCadet}
              className="button-primary"
            >
              Add Note
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderCadetOwnProgress = (cadet: RosterUser | undefined) => {
    if (!cadet) {
      return <p className="text-white/60 italic">Could not find your cadet data.</p>;
    }
    const currentProgress = getCurrentProgressState(cadet.name);

    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-[#f3c700] border-b border-white/20 pb-2">
          My Progress Checklist
        </h2>
        <div
          key={cadet.id}
          className="p-4 bg-black/60 rounded-lg shadow border border-white/20 max-w-md"
        >
          <h3 className="text-lg font-bold text-[#f3c700] mb-3">
            {cadet.name} | {cadet.badge || "N/A"}
          </h3>
          <div className="space-y-2">
            {Object.entries(progressItems).map(([key, label]) => {
              const itemKey = key as ProgressItemKey;
              const isChecked = currentProgress[itemKey];
              return (
                <div key={key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`${cadet.id}-${itemKey}`}
                    checked={isChecked}
                    disabled
                    className="form-checkbox h-4 w-4 text-[#f3c700] bg-black/40 border-white/30 rounded focus:ring-[#f3c700] focus:ring-offset-black disabled:opacity-50"
                  />
                  <label
                    htmlFor={`${cadet.id}-${itemKey}`}
                    className={`text-sm ${
                      isChecked ? "text-[#f3c700] line-through" : "text-white/80"
                    } ${isChecked ? 'opacity-70' : ''}`}
                  >
                    {label}
                  </label>
                </div>
              );
            })}
            <p className="text-xs text-white/50 italic mt-3">
              Progress is updated by FTOs during training sessions or manually via the checklist.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderCadetProgress = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[#f3c700] border-b border-white/20 pb-2">
        Cadet Progress Checklist (Manual Update)
      </h2>
      {cadets.length === 0 ? (
        <p className="text-white/60 italic">No cadets found.</p>
      ) : (
        cadets.map((cadet) => {
          const currentProgress = getCurrentProgressState(cadet.name);
          return (
            <div
              key={cadet.id}
              className="p-4 bg-black/60 rounded-lg shadow border border-white/20"
            >
              <h3 className="text-lg font-bold text-[#f3c700] mb-3">
                {cadet.name} | {cadet.badge || "N/A"}
              </h3>
              <div className="space-y-2">
                {Object.entries(progressItems).map(([key, label]) => {
                  const itemKey = key as ProgressItemKey;
                  const isChecked = currentProgress[itemKey];
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`${cadet.id}-${itemKey}`}
                        checked={isChecked}
                        onChange={(e) =>
                          handleProgressChange(cadet.name, itemKey, e.target.checked)
                        }
                        className="form-checkbox h-4 w-4 text-[#f3c700] bg-black/40 border-white/30 rounded focus:ring-[#f3c700] focus:ring-offset-black"
                      />
                      <label
                        htmlFor={`${cadet.id}-${itemKey}`}
                        className={`text-sm ${
                          isChecked ? "text-[#f3c700] line-through" : "text-white/80"
                        }`}
                      >
                        {label}
                      </label>
                    </div>
                  );
                })}
                <p className="text-xs text-white/50 italic mt-3">
                  Changes are saved automatically when checkboxes are clicked.
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const renderFtoDetails = (fto: RosterUser) => {
    const ftoLogs = getLogsForFTO(fto.name);
    const ftoNotesWritten = getNotesByFTO(fto.id);
    const totalHours = ftoLogs.reduce((sum, log) => sum + log.sessionHours, 0);
    const hoursLast30 = getFTOHoursLast30Days(fto.name);
    const certification = fto.certifications?.FTO || "N/A";

    return (
      <div className="space-y-6 p-4 bg-black/50 rounded-lg border border-white/20">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-[#f3c700]">
              {fto.name} | {fto.badge || "N/A"}
            </h3>
            <p className="text-sm text-white/80">Rank: {fto.rank}</p>
            <p className="text-sm text-white/80">FTO Certification: {certification}</p>
          </div>
          <button
            onClick={() => setSelectedFtoForDetails(null)}
            className="button-secondary text-sm"
          >
            &times; Close
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-black/40 p-3 rounded border border-white/10">
            <p className="font-semibold text-[#f3c700]">Total Sessions</p>
            <p className="text-lg font-bold">{ftoLogs.length}</p>
          </div>
          <div className="bg-black/40 p-3 rounded border border-white/10">
            <p className="font-semibold text-[#f3c700]">Total Hours Logged</p>
            <p className="text-lg font-bold">{totalHours.toFixed(1)}</p>
          </div>
          <div className="bg-black/40 p-3 rounded border border-white/10">
            <p className="font-semibold text-[#f3c700]">Hours (Last 30d)</p>
            <p className="text-lg font-bold">{hoursLast30.toFixed(1)}</p>
          </div>
        </div>

        {/* Training Sessions Logged */}
        <div>
          <h4 className="text-lg font-semibold text-[#f3c700] mb-2 border-b border-white/10 pb-1">Training Sessions Logged</h4>
          <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
            {ftoLogs.length > 0 ? (
              ftoLogs.map(log => (
                <div key={log.id} className="p-2 bg-black/30 rounded border border-white/10 text-xs">
                  <p><span className="font-semibold">Cadet:</span> {log.cadetName}</p>
                  <p><span className="font-semibold">Date:</span> {log.date} | <span className="font-semibold">Hours:</span> {log.sessionHours.toFixed(1)}</p>
                  <p className="mt-1 italic truncate" title={log.summary}>Summary: {log.summary || "N/A"}</p>
                </div>
              ))
            ) : (
              <p className="text-white/60 italic text-sm">No training sessions logged by this FTO.</p>
            )}
          </div>
        </div>

        {/* Notes Written to Cadets */}
        <div>
          <h4 className="text-lg font-semibold text-[#f3c700] mb-2 border-b border-white/10 pb-1">Notes Written to Cadets</h4>
           <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
            {ftoNotesWritten.length > 0 ? (
              ftoNotesWritten.map(note => (
                <div key={note.id} className="p-2 bg-black/30 rounded border border-white/10 text-xs">
                   <p><span className="font-semibold">To Cadet:</span> {note.cadetName}</p>
                   <p><span className="font-semibold">Date:</span> {note.createdAt.toDate().toLocaleDateString()}</p>
                   <p className="mt-1 italic truncate" title={note.note}>Note: {note.note}</p>
                </div>
              ))
            ) : (
               <p className="text-white/60 italic text-sm">No notes written to cadets by this FTO.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFTOPersonnel = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[#f3c700] border-b border-white/20 pb-2">
        FTO Personnel Activity
      </h2>

      {/* Conditionally render details or table */}
      {selectedFtoForDetails ? (
        renderFtoDetails(selectedFtoForDetails)
      ) : (
        <>
          {ftoPersonnel.length === 0 ? (
            <p className="text-white/60 italic">No FTO personnel found.</p>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="min-w-full text-sm text-left">
                <thead className="text-xs text-[#f3c700] uppercase bg-black/60">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Badge</th>
                    <th className="px-4 py-2">Certification</th>
                    <th className="px-4 py-2">Hours (Last 30d)</th>
                    <th className="px-4 py-2">Last Session Date</th>
                    <th className="px-4 py-2">Last Cadet Trained</th>
                  </tr>
                </thead>
                <tbody className="text-white/80">
                  {ftoPersonnel.map((fto) => {
                    const hoursLast30 = getFTOHoursLast30Days(fto.name);
                    const lastLog = getFTOLastLog(fto.name);
                    const certification = fto.certifications?.FTO || "N/A";
                    return (
                      <tr
                        key={fto.id}
                        className="border-b border-white/20 hover:bg-white/10 cursor-pointer" // Add cursor-pointer
                        onClick={() => setSelectedFtoForDetails(fto)} // Set selected FTO on click
                      >
                        {/* Make name clickable */}
                        <td className="px-4 py-2 font-medium text-white hover:text-[#f3c700]">
                           {fto.name}
                        </td>
                        <td className="px-4 py-2">{fto.badge || "N/A"}</td>
                        <td className="px-4 py-2">{certification}</td>
                        <td className="px-4 py-2">{hoursLast30.toFixed(1)}</td>
                        <td className="px-4 py-2">
                          {lastLog?.date || (
                            <span className="italic text-white/50">None</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {lastLog?.cadetName || (
                            <span className="italic text-white/50">None</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );

  const handleAddAnnouncement = async () => {
    if (!newAnnouncementTitle.trim() || !newAnnouncementContent.trim()) {
      toast.error("Title and content cannot be empty.");
      return;
    }
    if (!user) {
      toast.error("User not found.");
      return;
    }

    try {
      const announcementData: Omit<FTOAnnouncement, "id"> = {
        title: newAnnouncementTitle.trim(),
        content: newAnnouncementContent,
        authorName: user.name || "Unknown",
        authorRank: user.rank || "Unknown",
        createdAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(dbFirestore, "ftoAnnouncements"), announcementData);
      setFtoAnnouncements((prev) => [
        { ...announcementData, id: docRef.id },
        ...prev,
      ]);
      setNewAnnouncementTitle("");
      setNewAnnouncementContent("");
      setIsAddingAnnouncement(false);
      toast.success("Announcement added.");
    } catch (error) {
      console.error("Error adding announcement:", error);
      toast.error("Failed to add announcement.");
    }
  };

  const renderAnnouncements = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-white/20 pb-2">
        <h2 className="text-xl font-semibold text-[#f3c700]">FTO Announcements</h2>
        {isAdmin && !isAddingAnnouncement && (
          <button
            onClick={() => setIsAddingAnnouncement(true)}
            className="button-secondary text-sm"
          >
            Add Announcement
          </button>
        )}
      </div>

      {isAdmin && isAddingAnnouncement && (
        <div className="p-4 bg-black/60 rounded-lg border border-white/20 space-y-4">
          <h3 className="text-lg font-semibold text-[#f3c700]">New Announcement</h3>
          <input
            type="text"
            placeholder="Announcement Title"
            value={newAnnouncementTitle}
            onChange={(e) => setNewAnnouncementTitle(e.target.value)}
            className="input w-full bg-black/40 border-white/20 text-white"
          />
          <TipTapEditor
            content={newAnnouncementContent}
            onChange={setNewAnnouncementContent}
            editorClassName="bg-black/40 border border-white/20 rounded p-2 text-white min-h-[150px]"
          />
          <div className="flex justify-end gap-3 mt-3">
            <button
              onClick={() => setIsAddingAnnouncement(false)}
              className="button-secondary"
            >
              Cancel
            </button>
            <button onClick={handleAddAnnouncement} className="button-primary">
              Post Announcement
            </button>
          </div>
        </div>
      )}

      {loadingAnnouncements && (
        <p className="text-[#f3c700]">Loading announcements...</p>
      )}
      {errorAnnouncements && <p className="text-red-500">{errorAnnouncements}</p>}
      {!loadingAnnouncements && ftoAnnouncements.length === 0 && (
        <p className="text-white/60 italic">No announcements posted yet.</p>
      )}
      {!loadingAnnouncements && ftoAnnouncements.length > 0 && (
        <div className="space-y-4">
          {ftoAnnouncements.map((ann) => (
            <div
              key={ann.id}
              className="p-4 bg-black/60 rounded-lg border border-white/20"
            >
              <h3 className="text-lg font-bold text-[#f3c700]">{ann.title}</h3>
              <p className="text-xs text-white/60 mb-2">
                Posted by {ann.authorRank} {ann.authorName} on{" "}
                {ann.createdAt.toDate().toLocaleDateString()}
              </p>
              <div
                className="prose prose-sm prose-invert max-w-none text-white/80"
                dangerouslySetInnerHTML={{ __html: ann.content }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const ftoTabs: { key: FtoTabKey; label: string }[] = [
    { key: "home", label: "Home" },
    { key: "announcements", label: "Announcements" },
    { key: "add", label: "Add Log" },
    { key: "logs", label: "Cadet Logs" },
    { key: "progress", label: "Cadet Progress" },
    { key: "personnel", label: "Personnel" },
  ];

  const cadetTabs: { key: CadetTabKey; label: string }[] = [
    { key: "home", label: "My Overview" },
    { key: "progress", label: "My Progress" },
    { key: "personnel", label: "FTO Personnel" },
  ];

  const tabsToRender = isCadet ? cadetTabs : ftoTabs;

  return (
    <Layout>
      <div className="p-6 space-y-6 text-white">
        <h1 className="text-3xl font-bold text-[#f3c700]">FTO Management</h1>

        <div className="flex space-x-1 border-b border-white/20 mb-6">
          {tabsToRender.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md focus:outline-none transition-colors ${
                activeTab === tab.key
                  ? "bg-[#f3c700] text-black font-semibold"
                  : "bg-black/80 text-[#f3c700] hover:bg-black/60 hover:text-[#f3c700]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-black/70 p-4 md:p-6 rounded-lg shadow-lg border border-white/10">
          {loading && (
            <p className="text-center text-[#f3c700]">Loading FTO Data...</p>
          )}
          {error && <p className="text-center text-red-500">{error}</p>}

          {!loading && !error && (
            <>
              {isCadet ? (
                <>
                  {activeTab === "home" && renderCadetOwnOverview(allUsers.find(u => u.id === user?.id))}
                  {activeTab === "progress" && renderCadetOwnProgress(allUsers.find(u => u.id === user?.id))}
                  {activeTab === "personnel" && renderFTOPersonnel()}
                </>
              ) : (
                <>
                  {activeTab === "home" && renderFTOHome()}
                  {activeTab === "announcements" && renderAnnouncements()}
                  {activeTab === "add" && renderAddLogForm()}
                  {activeTab === "logs" && renderCadetLogs()}
                  {activeTab === "progress" && renderCadetProgress()}
                  {activeTab === "personnel" && renderFTOPersonnel()}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default FTOPage;
