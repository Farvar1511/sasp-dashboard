import React, { useState, useEffect } from 'react';
import { Timestamp, collection, addDoc, query, where, orderBy, getDocs } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import { RosterUser, FTOCadetNote } from '../../types/User';
import { CadetLog } from './ftoTypes'; // Corrected import path
import { formatDateToMMDDYY, formatTimestampForDisplay, formatTime12hr } from '../../utils/timeHelpers';
import { db as dbFirestore } from '../../firebase'; // Import Firestore instance

interface CadetLogsProps {
  authUser: RosterUser | null;
  cadets: RosterUser[];
  logs: CadetLog[];
  onEditLog: (log: CadetLog) => void;
  onDeleteLog: (logId: string | undefined) => void;
  onDeleteNote: (noteId: string) => void;
}

const CadetLogs: React.FC<CadetLogsProps> = ({
  authUser,
  cadets,
  logs,
  onEditLog,
  onDeleteLog,
  onDeleteNote,
}) => {
  const [selectedCadetForLogs, setSelectedCadetForLogs] = useState<RosterUser | null>(null);
  const [newNoteForSelectedCadet, setNewNoteForSelectedCadet] = useState("");
  const [notesForSelectedCadet, setNotesForSelectedCadet] = useState<FTOCadetNote[]>([]);
  const [loadingSelectedCadetNotes, setLoadingSelectedCadetNotes] = useState(false);

  useEffect(() => {
    if (selectedCadetForLogs?.id) {
      const fetchNotes = async () => {
        setLoadingSelectedCadetNotes(true);
        try {
          const notesQuery = query(
            collection(dbFirestore, "ftoCadetNotes"),
            where("cadetId", "==", selectedCadetForLogs.id),
            orderBy("createdAt", "desc")
          );
          const notesSnapshot = await getDocs(notesQuery);
          setNotesForSelectedCadet(
            notesSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt : Timestamp.now()
            })) as FTOCadetNote[]
          );
        } catch (err) {
          console.error("Error fetching notes for selected cadet:", err);
          toast.error("Failed to load notes for the selected cadet.");
        } finally {
          setLoadingSelectedCadetNotes(false);
        }
      };
      fetchNotes();
    } else {
      setNotesForSelectedCadet([]);
    }
  }, [selectedCadetForLogs]);

  const handleAddNoteForSelectedCadet = async () => {
    if (!selectedCadetForLogs) { toast.error("No cadet selected."); return; }
    if (!newNoteForSelectedCadet.trim()) { toast.error("Note cannot be empty."); return; }
    if (!authUser?.id || !authUser?.name || !authUser?.rank) { toast.error("Your user information is missing."); return; }

    try {
      const noteData: Omit<FTOCadetNote, "id"> = {
        cadetId: selectedCadetForLogs.id, cadetName: selectedCadetForLogs.name,
        ftoId: authUser.id, ftoName: authUser.name, ftoRank: authUser.rank,
        note: newNoteForSelectedCadet.trim(), createdAt: Timestamp.now(),
      };
      const notesColRef = collection(dbFirestore, "ftoCadetNotes");
      const docRef = await addDoc(notesColRef, noteData);

      // Add new note locally
      setNotesForSelectedCadet(prev => [{ ...noteData, id: docRef.id }, ...prev]);
      setNewNoteForSelectedCadet("");
      toast.success(`Note added for ${selectedCadetForLogs.name}.`);
    } catch (err) {
      console.error("Error adding FTO cadet note:", err);
      toast.error("Failed to add note.");
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-[#f3c700] border-b border-white/20 pb-2">
        View Cadet Logs & Notes
      </h2>
      <div className="space-y-2">
        <p className="text-white/60 text-sm">Select a cadet to view/hide their logs & notes:</p>
        {cadets.map((cadet) => (
          <button
            key={cadet.id}
            onClick={() => setSelectedCadetForLogs((prev) => (prev?.id === cadet.id ? null : cadet))}
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
        <div className="mt-6 border-t border-white/20 pt-4 bg-black/60 p-4 rounded-lg space-y-6">
          <div>
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
                        <div key={log.id} className="p-2 bg-black/40 rounded shadow border border-white/10 text-xs flex justify-between items-center">
                          <div>
                            <p className="text-white/80"><span className="font-semibold text-[#f3c700]">Progress Update</span> by {log.ftoName} on {formatTimestampForDisplay(log.createdAt)}</p>
                            <p className="text-white/60 italic mt-1">{log.summary}</p>
                          </div>
                          <button onClick={() => onDeleteLog(log.id)} className="ml-2 text-red-500 hover:text-red-400 text-xs p-1" title="Delete Progress Update"><FaTrash /></button>
                        </div>
                      );
                    }
                    return (
                      <div key={log.id} className="p-3 bg-black/50 rounded shadow border border-white/20">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm text-white"><span className="font-semibold">Date:</span> {formatDateToMMDDYY(log.date)} | <span className="font-semibold">Time:</span> {formatTime12hr(log.timeStarted)} - {formatTime12hr(log.timeEnded)}</p>
                            <p className="text-sm text-white"><span className="font-semibold">Session Hours:</span> {log.sessionHours.toFixed(1)} | <span className="font-semibold">Cumulative Hours:</span> {log.cumulativeHours.toFixed(1)}</p>
                            <p className="text-sm text-white"><span className="font-semibold">FTO:</span> {log.ftoName}</p>
                          </div>
                          <div className="flex space-x-2 flex-shrink-0">
                            <button onClick={() => onEditLog(log)} className="text-xs text-yellow-400 hover:text-yellow-300 p-1" title="Edit Log"><FaPencilAlt /></button>
                            <button onClick={() => onDeleteLog(log.id)} className="text-xs text-red-500 hover:text-red-400 p-1" title="Delete Log"><FaTrash /></button>
                          </div>
                        </div>
                        <p className="text-sm text-white mt-2 whitespace-pre-wrap"><strong className="text-[#f3c700]">Summary:</strong> {log.summary || <span className="italic text-white/60">None</span>}</p>
                        <p className="text-sm text-white mt-2 whitespace-pre-wrap"><strong className="text-[#f3c700]">Notes:</strong> {log.additionalNotes || <span className="italic text-white/60">None</span>}</p>
                        <p className="text-xs text-white/60 mt-1">Logged: {formatTimestampForDisplay(log.createdAt)}</p>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <h3 className="text-lg font-bold text-[#f3c700] mb-3">
              Notes for {selectedCadetForLogs.name}
            </h3>
            <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
              {loadingSelectedCadetNotes ? (
                <p className="text-yellow-400 italic">Loading notes...</p>
              ) : notesForSelectedCadet.length > 0 ? (
                notesForSelectedCadet.map((note) => (
                  <div key={note.id} className="p-3 bg-black/50 rounded border border-white/10 text-sm flex justify-between items-start">
                    <div>
                      <p className="text-white/80">{note.note}</p>
                      <p className="text-xs text-[#f3c700] mt-1">- {note.ftoName} ({note.ftoRank}) on {formatTimestampForDisplay(note.createdAt)}</p>
                    </div>
                    <button onClick={() => onDeleteNote(note.id)} className="ml-2 text-red-500 hover:text-red-400 text-xs p-1 flex-shrink-0" title="Delete Note"><FaTrash /></button>
                  </div>
                ))
              ) : (
                <p className="text-white/50 italic">No FTO notes found for this cadet.</p>
              )}
            </div>
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
              placeholder={`Enter note for ${selectedCadetForLogs.name}...`}
            />
            <p className="text-xs text-red-500 font-bold mb-2">NOTE IS VISIBLE TO CADET!</p>
            <button onClick={handleAddNoteForSelectedCadet} className="button-primary">Add Note</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CadetLogs;
