import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { RosterUser } from '../../types/User';
import { CadetLog, ProgressItemKey } from './ftoTypes'; // Corrected import path
import { Button } from "../../components/ui/button"; // Import shadcn Button

interface AddCadetLogProps {
  authUser: RosterUser | null;
  cadets: RosterUser[];
  logs: CadetLog[];
  onLogAdded: (newLog: CadetLog) => void; // Callback to update parent state
  saveProgressUpdate: (
    cadetName: string,
    updatedProgressState: { [key in ProgressItemKey]: boolean },
    summaryMessage: string
  ) => Promise<CadetLog | null>;
  getCurrentProgressState: (cadetName: string) => { [key in ProgressItemKey]: boolean };
}

const AddCadetLog: React.FC<AddCadetLogProps> = ({
  authUser,
  cadets,
  logs,
  onLogAdded,
  saveProgressUpdate,
  getCurrentProgressState,
}) => {
  const [newLog, setNewLog] = useState<Omit<CadetLog, 'id' | 'createdAt' | 'cumulativeHours'>>({
    cadetName: '',
    date: '',
    timeStarted: '',
    timeEnded: '',
    sessionHours: 0,
    ftoName: authUser?.name || '',
    summary: '',
    additionalNotes: '',
    type: 'session',
  });

  useEffect(() => {
    // Reset session hours if inputs are incomplete
    if (!newLog.date || !newLog.timeStarted || !newLog.timeEnded) {
      setNewLog((prev) => ({ ...prev, sessionHours: 0 }));
      return;
    }
    try {
      const startDateTime = new Date(`${newLog.date}T${newLog.timeStarted}`);
      let endDateTime = new Date(`${newLog.date}T${newLog.timeEnded}`);
      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        setNewLog((prev) => ({ ...prev, sessionHours: 0 })); return;
      }
      if (endDateTime <= startDateTime) endDateTime.setDate(endDateTime.getDate() + 1);
      const diffMilliseconds = endDateTime.getTime() - startDateTime.getTime();
      const diffHours = Math.max(0, diffMilliseconds / (1000 * 60 * 60));
      setNewLog((prev) => ({ ...prev, sessionHours: parseFloat(diffHours.toFixed(1)) }));
    } catch (e) {
      console.error("Error calculating time difference:", e);
      setNewLog((prev) => ({ ...prev, sessionHours: 0 }));
    }
  }, [newLog.date, newLog.timeStarted, newLog.timeEnded]);

  const handleAddLogInternal = async () => {
    const calculatedSessionHours = newLog.sessionHours > 0 ? newLog.sessionHours : 0;
    if (!newLog.cadetName || !newLog.date || !newLog.timeStarted || !newLog.timeEnded || calculatedSessionHours <= 0) {
      toast.error("Please select cadet, enter date, valid start/end times (resulting in positive hours).");
      return;
    }
    if (!authUser?.name) {
        toast.error("Cannot add log: FTO name not found.");
        return;
    }

    try {
      const cadetSessionLogs = logs
        .filter((log) => log.cadetName === newLog.cadetName && (!log.type || log.type === "session"))
        .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      const lastSessionLog = cadetSessionLogs[0];
      const cumulativeHours = parseFloat(((lastSessionLog?.cumulativeHours || 0) + calculatedSessionHours).toFixed(1));

      const currentProgress = getCurrentProgressState(newLog.cadetName);
      if (cumulativeHours >= 20 && !currentProgress.hoursComplete) {
        const newProgressState = { ...currentProgress, hoursComplete: true };
        const progressLog = await saveProgressUpdate(
          newLog.cadetName, newProgressState, "Automatically marked 20 hours complete."
        );
        if (progressLog) toast.info(`${newLog.cadetName} has reached 20 hours! Progress updated.`);
      }

      const logData: Omit<CadetLog, "id"> = {
        ...newLog,
        sessionHours: calculatedSessionHours,
        cumulativeHours,
        ftoName: authUser.name,
        createdAt: Timestamp.now(),
        type: "session",
      };

      // Instead of adding directly, call the callback provided by the parent
      onLogAdded(logData as CadetLog); // Assume parent handles adding ID and updating state

      setNewLog({
        cadetName: '', date: '', timeStarted: '', timeEnded: '', sessionHours: 0,
        ftoName: authUser.name, summary: '', additionalNotes: '', type: 'session',
      });
      // Parent component should show the success toast after successful Firestore add
    } catch (error) {
      console.error("Error preparing log data:", error);
      toast.error("Failed to prepare log data."); // Parent handles Firestore errors
    }
  };

  return (
    <div>
      <div className="bg-black/60 p-4 rounded-lg shadow-lg space-y-4 border border-white/20">
        <h2 className="text-xl font-semibold text-[#f3c700]">Add Cadet Training Log</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/80">Cadet Name</label>
            <select
              value={newLog.cadetName}
              onChange={(e) => setNewLog((prev) => ({ ...prev, cadetName: e.target.value }))}
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
              onChange={(e) => setNewLog((prev) => ({ ...prev, date: e.target.value }))}
              className="input w-full bg-black/40 border-white/20 text-white"
              style={{ colorScheme: "dark" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80">Time Started</label>
            <input
              type="time"
              value={newLog.timeStarted}
              onChange={(e) => setNewLog((prev) => ({ ...prev, timeStarted: e.target.value }))}
              className="input w-full bg-black/40 border-white/20 text-white"
              style={{ colorScheme: "dark" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80">Time Ended</label>
            <input
              type="time"
              value={newLog.timeEnded}
              onChange={(e) => setNewLog((prev) => ({ ...prev, timeEnded: e.target.value }))}
              className="input w-full bg-black/40 border-white/20 text-white"
              style={{ colorScheme: "dark" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80">Session Hours (Calculated)</label>
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
          <label className="block text-sm font-medium text-white/80">Summary of Training Session</label>
          <textarea
            value={newLog.summary}
            onChange={(e) => setNewLog((prev) => ({ ...prev, summary: e.target.value }))}
            className="input w-full bg-black/40 border-white/20 text-white"
            rows={3}
            placeholder="Describe activities, performance, and keywords for progress..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80">Additional Notes / Areas for Improvement</label>
          <textarea
            value={newLog.additionalNotes}
            onChange={(e) => setNewLog((prev) => ({ ...prev, additionalNotes: e.target.value }))}
            className="input w-full bg-black/40 border-white/20 text-white"
            rows={3}
            placeholder="Any other comments, feedback, or goals..."
          />
          <p className="text-xs text-red-500 font-bold mt-1">NOT VISIBLE TO CADET!</p>
        </div>
        <Button onClick={handleAddLogInternal} className="w-full mt-4">
          Add Log
        </Button>
      </div>
    </div>
  );
};

export default AddCadetLog;
