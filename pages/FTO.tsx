import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp, // Import Timestamp
  limit,
  where,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp, // Import serverTimestamp
  writeBatch, // Import writeBatch
  getDoc, // Import getDoc
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import { toast } from "react-toastify";
import { RosterUser, FTOAnnouncement, FTOCadetNote } from "../types/User";
import TipTapEditor from "../components/TipTapEditor";
import { computeIsAdmin } from "../utils/isadmin";
import Modal from "../components/Modal";
import ConfirmationModal from "../components/ConfirmationModal";
// Import the necessary time helpers
import { formatDateToMMDDYY, formatTimestampForDisplay, formatTime12hr, convertToTimestampOrNull } from "../utils/timeHelpers";
import { FaPencilAlt, FaTrash } from "react-icons/fa";

// ... existing interfaces (CadetLog, ProgressItemKey, etc.) ...

const FTOPage: React.FC = () => {
  // ... existing state ...
  const [newLog, setNewLog] = useState<Omit<CadetLog, "id" | "createdAt" | "cumulativeHours">>({
    cadetName: "",
    date: "",
    timeStarted: "",
    timeEnded: "",
    sessionHours: 0,
    ftoName: "",
    summary: "",
    additionalNotes: "",
    type: "session", // Default to session
    progressKeywords: [],
  });
  const [editingLog, setEditingLog] = useState<(CadetLog & { originalCreatedAt?: Timestamp }) | null>(null); // Store original timestamp if needed for ordering updates

  // ... existing useEffects ...

  const handleAddLog = async () => {
    if (
      !newLog.cadetName ||
      !newLog.date ||
      !newLog.timeStarted ||
      !newLog.timeEnded ||
      !newLog.ftoName
    ) {
      toast.error("Please fill in all required fields (Cadet, Date, Times, FTO).");
      return;
    }
    if (newLog.sessionHours <= 0) {
      toast.error("Calculated session hours must be greater than zero.");
      return;
    }

    setLoading(true);
    try {
      // Calculate cumulative hours before adding the new log
      const previousLogsQuery = query(
        collection(dbFirestore, "cadetLogs"),
        where("cadetName", "==", newLog.cadetName),
        where("type", "==", "session"), // Only count session hours
        orderBy("createdAt", "desc"), // Get the latest log first
        limit(1)
      );
      const previousLogsSnapshot = await getDocs(previousLogsQuery);
      const lastLog = previousLogsSnapshot.docs[0]?.data() as CadetLog | undefined;
      const previousCumulativeHours = lastLog?.cumulativeHours || 0;
      const newCumulativeHours = previousCumulativeHours + newLog.sessionHours;

      const logData: Omit<CadetLog, "id"> = {
        ...newLog,
        cumulativeHours: newCumulativeHours,
        createdAt: serverTimestamp() as Timestamp, // Use server timestamp for creation
      };

      const docRef = await addDoc(collection(dbFirestore, "cadetLogs"), logData);

      // Update local state optimistically or refetch
      setLogs((prevLogs) => [
        { ...logData, id: docRef.id, createdAt: Timestamp.now() /* Approximate */ }, // Add locally with approximation
        ...prevLogs,
      ].sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))); // Keep sorted

      toast.success("Training log added successfully!");
      // Reset form
      setNewLog({
        cadetName: "", date: "", timeStarted: "", timeEnded: "", sessionHours: 0,
        ftoName: authUser?.name || "", summary: "", additionalNotes: "", type: "session", progressKeywords: []
      });
    } catch (error) {
      console.error("Error adding log:", error);
      toast.error("Failed to add training log.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditLogClick = (log: CadetLog) => {
    setEditingLog({
        ...log,
        // Convert Timestamp back to string for date/time inputs
        date: log.date instanceof Timestamp ? log.date.toDate().toISOString().split('T')[0] : log.date,
        // Assuming timeStarted/timeEnded are stored as strings HH:mm
        timeStarted: log.timeStarted,
        timeEnded: log.timeEnded,
        originalCreatedAt: log.createdAt // Store original timestamp if needed later
    });
    setIsEditLogModalOpen(true);
  };


  const handleUpdateLog = async () => {
    if (!editingLog || !editingLog.id || !editingLog.createdAt) {
      toast.error("No log selected for editing or missing creation date.");
      return;
    }

    let calculatedSessionHours = editingLog.sessionHours;
    let logDateTimestamp: Timestamp | null = convertToTimestampOrNull(editingLog.date); // Convert edited date string

    // Recalculate session hours based on potentially edited date/time
    if (editingLog.date && editingLog.timeStarted && editingLog.timeEnded) {
      try {
        // Use the already converted logDateTimestamp if available, otherwise parse again
        const baseDateStr = logDateTimestamp ? logDateTimestamp.toDate().toISOString().split('T')[0] : editingLog.date;
        const startDateTime = new Date(`${baseDateStr}T${editingLog.timeStarted}`);
        let endDateTime = new Date(`${baseDateStr}T${editingLog.timeEnded}`);

        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
          throw new Error("Invalid date or time input during update.");
        }
        if (endDateTime <= startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        }
        const diffMilliseconds = endDateTime.getTime() - startDateTime.getTime();
        calculatedSessionHours = parseFloat(Math.max(0, diffMilliseconds / (1000 * 60 * 60)).toFixed(1));
      } catch (e) {
        console.error("Error recalculating time difference during update:", e);
        toast.warn("Could not recalculate session hours due to invalid date/time format. Original hours kept if possible.");
        // Keep existing calculatedSessionHours if calculation fails
      }
    } else {
      calculatedSessionHours = 0; // Or handle as error?
    }

    // --- Recalculate Cumulative Hours for this log and subsequent logs ---
    setLoading(true); // Indicate processing
    const batch = writeBatch(dbFirestore);
    const logRef = doc(dbFirestore, "cadetLogs", editingLog.id);

    try {
        // Find the log immediately preceding the one being edited (based on original createdAt)
        const previousLogsQuery = query(
            collection(dbFirestore, "cadetLogs"),
            where("cadetName", "==", editingLog.cadetName),
            where("type", "==", "session"),
            where("createdAt", "<", editingLog.createdAt), // Use original timestamp
            orderBy("createdAt", "desc"),
            limit(1)
        );
        const previousLogsSnapshot = await getDocs(previousLogsQuery);
        const lastLogBeforeEdit = previousLogsSnapshot.docs[0]?.data() as CadetLog | undefined;
        const previousCumulativeHours = lastLogBeforeEdit?.cumulativeHours || 0;
        const updatedCumulativeHoursForThisLog = previousCumulativeHours + calculatedSessionHours;

        // Prepare the update for the edited log
        const updatedLogData: Partial<CadetLog> = {
            ...editingLog,
            date: logDateTimestamp || editingLog.date, // Save as Timestamp if conversion worked
            sessionHours: calculatedSessionHours,
            cumulativeHours: updatedCumulativeHoursForThisLog,
            // Ensure createdAt is not accidentally overwritten if not intended
            // createdAt: editingLog.createdAt // Keep original createdAt
        };
        // Remove originalCreatedAt if it was added temporarily
        delete (updatedLogData as any).originalCreatedAt;

        batch.update(logRef, updatedLogData);

        // Find all subsequent logs for this cadet that need cumulative hours updated
        const subsequentLogsQuery = query(
            collection(dbFirestore, "cadetLogs"),
            where("cadetName", "==", editingLog.cadetName),
            where("type", "==", "session"),
            where("createdAt", ">", editingLog.createdAt), // Use original timestamp
            orderBy("createdAt", "asc") // Process in chronological order
        );
        const subsequentLogsSnapshot = await getDocs(subsequentLogsQuery);

        let currentCumulative = updatedCumulativeHoursForThisLog;
        subsequentLogsSnapshot.docs.forEach((logDoc) => {
            const logData = logDoc.data() as CadetLog;
            currentCumulative += logData.sessionHours;
            const subLogRef = doc(dbFirestore, "cadetLogs", logDoc.id);
            batch.update(subLogRef, { cumulativeHours: currentCumulative });
        });

        // Commit all updates
        await batch.commit();

        toast.success("Log updated successfully!");
        setIsEditLogModalOpen(false);
        setEditingLog(null);
        fetchData(); // Refetch all data to ensure consistency
    } catch (error) {
        console.error("Error updating log and subsequent cumulative hours:", error);
        toast.error("Failed to update log.");
        setLoading(false); // Ensure loading is turned off on error
    }
    // No finally block needed here as fetchData() handles setLoading(false)
  };


  const handleAddAnnouncement = async () => {
    if (!newAnnouncementTitle.trim() || !newAnnouncementContent.trim()) {
      toast.error("Title and content cannot be empty.");
      return;
    }
    if (!authUser) {
      toast.error("User not found.");
      return;
    }

    try {
      // Use serverTimestamp for createdAt
      const announcementData: Omit<FTOAnnouncement, "id"> = {
        title: newAnnouncementTitle.trim(),
        content: newAnnouncementContent,
        authorName: authUser.name || "Unknown",
        authorRank: authUser.rank || "Unknown",
        createdAt: serverTimestamp() as Timestamp, // Use server timestamp
      };
      const docRef = await addDoc(collection(dbFirestore, "ftoAnnouncements"), announcementData);
      // Optimistic update or refetch
      setFtoAnnouncements((prev) => [
        { ...announcementData, id: docRef.id, createdAt: Timestamp.now() /* Approx */ },
        ...prev,
      ].sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))); // Keep sorted
      setNewAnnouncementTitle("");
      setNewAnnouncementContent("");
      setIsAddingAnnouncement(false);
      toast.success("Announcement added.");
    } catch (error) {
      console.error("Error adding announcement:", error);
      toast.error("Failed to add announcement.");
    }
  };

  const handleSaveEditAnnouncement = async () => {
    if (!editingAnnouncement || !editingAnnouncement.id) {
      toast.error("No announcement selected for editing.");
      return;
    }

    const announcementRef = doc(dbFirestore, "ftoAnnouncements", editingAnnouncement.id);
    try {
      // Prepare update data, excluding id and potentially createdAt if not meant to be changed
      const { id, createdAt, ...updateData } = editingAnnouncement;
      // If you want to track edits, you could add an 'updatedAt: serverTimestamp()' field
      await updateDoc(announcementRef, {
          ...updateData,
          // updatedAt: serverTimestamp() // Example: Add if tracking updates
      });

      // Update local state or refetch
      setFtoAnnouncements((prevAnnouncements) =>
        prevAnnouncements.map((ann) =>
          ann.id === editingAnnouncement.id ? { ...ann, ...updateData } : ann // Update locally
        ).sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)) // Keep sorted
      );

      toast.success("Announcement updated successfully!");
      setEditingAnnouncement(null);
      setIsEditingAnnouncement(false);
    } catch (error) {
      console.error("Error updating announcement:", error);
      toast.error("Failed to update announcement.");
    }
  };


  // ... rest of the component ...
};

export default FTOPage;
