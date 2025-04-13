import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { User as AuthUser } from "../types/User";

// --- Interface Definitions ---
interface UserInfo {
  id: string;
  name: string;
  rank?: string;
}

interface DisciplineEntry {
  id: string;
  type: "commendation" | "verbal" | "written" | "suspension" | "termination";
  note: string;
  issuedBy: string;
  issuedAt: Timestamp;
}

interface GeneralNoteEntry {
  id: string;
  note: string;
  issuedBy: string;
  issuedAt: Timestamp;
}

// State for overview data
interface OverviewUserData {
  latestDiscipline?: DisciplineEntry;
  latestNote?: GeneralNoteEntry;
}

// State for editing
interface EditingDisciplineState
  extends Omit<DisciplineEntry, "issuedBy" | "issuedAt"> {}
interface EditingNoteState
  extends Omit<GeneralNoteEntry, "issuedBy" | "issuedAt"> {}

export default function DisciplineNotes({ user }: { user: AuthUser }) {
  // User selection state
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(""); // "" indicates overview mode
  const [usersLoading, setUsersLoading] = useState<boolean>(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Overview Data State
  const [overviewData, setOverviewData] = useState<
    Map<string, OverviewUserData>
  >(new Map());
  const [overviewLoading, setOverviewLoading] = useState<boolean>(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Focused Data state for selected user
  const [disciplineEntries, setDisciplineEntries] = useState<DisciplineEntry[]>(
    []
  );
  const [generalNotes, setGeneralNotes] = useState<GeneralNoteEntry[]>([]);
  const [focusedDataLoading, setFocusedDataLoading] = useState<boolean>(false);
  const [focusedDataError, setFocusedDataError] = useState<string | null>(null);

  // Form state
  const [showAddDiscipline, setShowAddDiscipline] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [newDisciplineType, setNewDisciplineType] =
    useState<DisciplineEntry["type"]>("verbal");
  const [newDisciplineNote, setNewDisciplineNote] = useState("");
  const [newGeneralNote, setNewGeneralNote] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Editing state
  const [editingDiscipline, setEditingDiscipline] =
    useState<EditingDisciplineState | null>(null);
  const [editingNote, setEditingNote] = useState<EditingNoteState | null>(null);

  // Fetch users for dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true);
      setUsersError(null);
      try {
        const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
        const users = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "Unknown",
          rank: doc.data().rank || "N/A",
        })) as UserInfo[];
        setAllUsers(users.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Error fetching users:", error);
        setUsersError("Failed to load users.");
      } finally {
        setUsersLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Fetch OVERVIEW data (latest entries for all users)
  useEffect(() => {
    if (usersLoading || allUsers.length === 0) return;

    const fetchOverview = async () => {
      setOverviewLoading(true);
      setOverviewError(null);
      const overviewMap = new Map<string, OverviewUserData>();

      try {
        for (const u of allUsers) {
          const userData: OverviewUserData = {};
          const disciplineColRef = collection(
            dbFirestore,
            "users",
            u.id,
            "discipline"
          );
          const latestDisciplineQuery = query(
            disciplineColRef,
            orderBy("issuedAt", "desc"),
            limit(1)
          );
          const disciplineSnapshot = await getDocs(latestDisciplineQuery);
          if (!disciplineSnapshot.empty) {
            userData.latestDiscipline = {
              id: disciplineSnapshot.docs[0].id,
              ...disciplineSnapshot.docs[0].data(),
            } as DisciplineEntry;
          }

          const notesColRef = collection(dbFirestore, "users", u.id, "notes");
          const latestNoteQuery = query(
            notesColRef,
            orderBy("issuedAt", "desc"),
            limit(1)
          );
          const noteSnapshot = await getDocs(latestNoteQuery);
          if (!noteSnapshot.empty) {
            userData.latestNote = {
              id: noteSnapshot.docs[0].id,
              ...noteSnapshot.docs[0].data(),
            } as GeneralNoteEntry;
          }
          overviewMap.set(u.id, userData);
        }
        setOverviewData(overviewMap);
      } catch (error) {
        console.error("Error fetching overview data:", error);
        setOverviewError("Failed to load overview data.");
      } finally {
        setOverviewLoading(false);
      }
    };

    fetchOverview();
  }, [allUsers, usersLoading]);

  // Fetch FOCUSED data (all entries for the selected user)
  const fetchFocusedUserData = useCallback(async () => {
    if (!selectedUserId) {
      setDisciplineEntries([]);
      setGeneralNotes([]);
      return;
    }

    setFocusedDataLoading(true);
    setFocusedDataError(null);
    try {
      const disciplineColRef = collection(
        dbFirestore,
        "users",
        selectedUserId,
        "discipline"
      );
      const disciplineQuery = query(
        disciplineColRef,
        orderBy("issuedAt", "desc")
      );
      const disciplineSnapshot = await getDocs(disciplineQuery);
      setDisciplineEntries(
        disciplineSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as DisciplineEntry[]
      );

      const notesColRef = collection(
        dbFirestore,
        "users",
        selectedUserId,
        "notes"
      );
      const notesQuery = query(notesColRef, orderBy("issuedAt", "desc"));
      const notesSnapshot = await getDocs(notesQuery);
      setGeneralNotes(
        notesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as GeneralNoteEntry[]
      );
    } catch (error) {
      console.error("Error fetching focused user data:", error);
      setFocusedDataError("Failed to load records for the selected user.");
    } finally {
      setFocusedDataLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (selectedUserId) {
      fetchFocusedUserData();
    } else {
      setDisciplineEntries([]);
      setGeneralNotes([]);
    }
    setShowAddDiscipline(false);
    setShowAddNote(false);
    setEditingDiscipline(null);
    setEditingNote(null);
    setNewDisciplineNote("");
    setNewGeneralNote("");
    setSubmitError(null);
  }, [selectedUserId, fetchFocusedUserData]);

  const handleAddDisciplineEntry = async () => {
    if (!selectedUserId || !newDisciplineNote.trim()) {
      setSubmitError(
        "Please ensure a user is selected and discipline details are entered."
      );
      return;
    }
    setSubmitError(null);
    try {
      const disciplineColRef = collection(
        dbFirestore,
        "users",
        selectedUserId,
        "discipline"
      );
      await addDoc(disciplineColRef, {
        type: newDisciplineType,
        note: newDisciplineNote.trim(),
        issuedBy: user.name,
        issuedAt: serverTimestamp(),
      });
      setNewDisciplineNote("");
      setNewDisciplineType("verbal");
      setShowAddDiscipline(false);
      if (selectedUserId) await fetchFocusedUserData();
      alert("Discipline entry added successfully!");
    } catch (error) {
      console.error("Error adding discipline entry:", error);
      setSubmitError("Failed to add discipline entry.");
    }
  };

  const handleAddGeneralNote = async () => {
    if (!selectedUserId || !newGeneralNote.trim()) {
      setSubmitError("Please ensure a user is selected and a note is entered.");
      return;
    }
    setSubmitError(null);
    try {
      const notesColRef = collection(
        dbFirestore,
        "users",
        selectedUserId,
        "notes"
      );
      await addDoc(notesColRef, {
        note: newGeneralNote.trim(),
        issuedBy: user.name,
        issuedAt: serverTimestamp(),
      });
      setNewGeneralNote("");
      setShowAddNote(false);
      if (selectedUserId) await fetchFocusedUserData();
      alert("General note added successfully!");
    } catch (error) {
      console.error("Error adding general note:", error);
      setSubmitError("Failed to add general note.");
    }
  };

  const handleDeleteDiscipline = async (entryId: string) => {
    if (
      !selectedUserId ||
      !window.confirm("Are you sure you want to delete this discipline entry?")
    )
      return;
    try {
      const entryDocRef = doc(
        dbFirestore,
        "users",
        selectedUserId,
        "discipline",
        entryId
      );
      await deleteDoc(entryDocRef);
      if (selectedUserId) await fetchFocusedUserData();
      alert("Discipline entry deleted.");
    } catch (error) {
      console.error("Error deleting discipline entry:", error);
      alert("Failed to delete discipline entry.");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (
      !selectedUserId ||
      !window.confirm("Are you sure you want to delete this general note?")
    )
      return;
    try {
      const noteDocRef = doc(
        dbFirestore,
        "users",
        selectedUserId,
        "notes",
        noteId
      );
      await deleteDoc(noteDocRef);
      if (selectedUserId) await fetchFocusedUserData();
      alert("General note deleted.");
    } catch (error) {
      console.error("Error deleting general note:", error);
      alert("Failed to delete general note.");
    }
  };

  const handleSaveDisciplineEdit = async () => {
    if (!editingDiscipline || !selectedUserId) return;
    const { id, note, type } = editingDiscipline;
    if (!note.trim()) {
      alert("Discipline details cannot be empty.");
      return;
    }
    try {
      const entryDocRef = doc(
        dbFirestore,
        "users",
        selectedUserId,
        "discipline",
        id
      );
      await updateDoc(entryDocRef, { note: note.trim(), type: type });
      setEditingDiscipline(null);
      if (selectedUserId) await fetchFocusedUserData();
      alert("Discipline entry updated.");
    } catch (error) {
      console.error("Error updating discipline entry:", error);
      alert("Failed to update discipline entry.");
    }
  };

  const handleSaveNoteEdit = async () => {
    if (!editingNote || !selectedUserId) return;
    const { id, note } = editingNote;
    if (!note.trim()) {
      alert("Note cannot be empty.");
      return;
    }
    try {
      const noteDocRef = doc(dbFirestore, "users", selectedUserId, "notes", id);
      await updateDoc(noteDocRef, { note: note.trim() });
      setEditingNote(null);
      if (selectedUserId) await fetchFocusedUserData();
      alert("General note updated.");
    } catch (error) {
      console.error("Error updating general note:", error);
      alert("Failed to update general note.");
    }
  };

  const handleStartEditDiscipline = (entry: DisciplineEntry) => {
    setEditingDiscipline({ id: entry.id, type: entry.type, note: entry.note });
    setEditingNote(null);
  };

  const handleStartEditNote = (entry: GeneralNoteEntry) => {
    setEditingNote({ id: entry.id, note: entry.note });
    setEditingDiscipline(null);
  };

  const handleCancelEdit = () => {
    setEditingDiscipline(null);
    setEditingNote(null);
  };

  const formatTimestamp = (ts: Timestamp | null | undefined): string => {
    if (!ts) return "N/A";
    return ts
      .toDate()
      .toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  };

  const getNoteTypeColor = (type: DisciplineEntry["type"]) => {
    switch (type) {
      case "commendation":
        return "text-green-400";
      case "verbal":
        return "text-yellow-400";
      case "written":
        return "text-orange-400";
      case "suspension":
        return "text-red-500";
      case "termination":
        return "text-red-700 font-bold";
      default:
        return "text-gray-400";
    }
  };

  const selectedUserName =
    allUsers.find((u) => u.id === selectedUserId)?.name || "Selected User";

  return (
    <Layout user={user}>
      <div
        className="page-content space-y-6"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <h1 className="text-3xl font-bold text-[#f3c700]">
          Discipline & Notes Records
        </h1>

        {/* User Selection - Always Visible */}
        <div className="admin-section p-4">
          <h2 className="section-header text-xl mb-3">Select View</h2>
          {usersLoading && (
            <p className="text-yellow-400 italic">Loading users...</p>
          )}
          {usersError && <p className="text-red-500">{usersError}</p>}
          {!usersLoading && !usersError && (
            <select
              id="userSelect"
              className="input text-sm w-full md:w-1/2"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">-- Overview (All Users) --</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.rank})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Conditional Rendering: Overview or Focused View */}
        {selectedUserId === "" ? (
          <div className="admin-section p-4">
            <h2 className="section-header text-xl mb-3">
              Overview - Latest Entries
            </h2>
            {overviewLoading && (
              <p className="text-yellow-400 italic">Loading overview...</p>
            )}
            {overviewError && <p className="text-red-500">{overviewError}</p>}
            {!overviewLoading && !overviewError && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allUsers.map((u) => {
                  const data = overviewData.get(u.id);
                  const latestDiscipline = data?.latestDiscipline;
                  const latestNote = data?.latestNote;
                  return (
                    <div
                      key={u.id}
                      className="user-card p-3 border border-gray-700 rounded-lg bg-gray-900/50"
                    >
                      <h3 className="text-lg font-semibold text-yellow-400 truncate mb-2">
                        {u.name}{" "}
                        <span className="text-sm text-gray-400">
                          ({u.rank})
                        </span>
                      </h3>
                      <div className="space-y-2 text-xs">
                        <div className="border-t border-gray-600 pt-1">
                          <p className="font-medium text-gray-400 mb-0.5">
                            Latest Discipline:
                          </p>
                          {latestDiscipline ? (
                            <div className="bg-gray-800/50 p-1.5 rounded">
                              <p
                                className={`font-semibold ${getNoteTypeColor(
                                  latestDiscipline.type
                                )} uppercase text-[10px]`}
                              >
                                {latestDiscipline.type}
                              </p>
                              <p className="text-gray-300 truncate text-[11px]">
                                {latestDiscipline.note}
                              </p>
                              <small className="text-gray-500 block mt-0.5 text-[10px]">
                                On: {formatTimestamp(latestDiscipline.issuedAt)}
                              </small>
                            </div>
                          ) : (
                            <p className="italic text-gray-500">None</p>
                          )}
                        </div>
                        <div className="border-t border-gray-600 pt-1">
                          <p className="font-medium text-gray-400 mb-0.5">
                            Latest General Note:
                          </p>
                          {latestNote ? (
                            <div className="bg-gray-800/50 p-1.5 rounded">
                              <p className="text-gray-300 truncate text-[11px]">
                                {latestNote.note}
                              </p>
                              <small className="text-gray-500 block mt-0.5 text-[10px]">
                                On: {formatTimestamp(latestNote.issuedAt)}
                              </small>
                            </div>
                          ) : (
                            <p className="italic text-gray-500">None</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap gap-4 mb-4">
              <button
                className="button-primary px-3 py-1.5 text-sm"
                onClick={() => {
                  setShowAddDiscipline(!showAddDiscipline);
                  setShowAddNote(false);
                  setEditingDiscipline(null);
                  setEditingNote(null);
                }}
              >
                {showAddDiscipline
                  ? "Cancel Add Discipline"
                  : "Add Discipline Entry"}
              </button>
              <button
                className="button-primary px-3 py-1.5 text-sm"
                onClick={() => {
                  setShowAddNote(!showAddNote);
                  setShowAddDiscipline(false);
                  setEditingDiscipline(null);
                  setEditingNote(null);
                }}
              >
                {showAddNote ? "Cancel Add Note" : "Add General Note"}
              </button>
            </div>

            {showAddDiscipline && (
              <div className="admin-section p-4 mb-6 border border-yellow-500/50">
                <h2 className="section-header text-xl mb-3">
                  Add Discipline Entry for {selectedUserName}
                </h2>
                <div className="mb-3">
                  <label
                    htmlFor="newDisciplineType"
                    className="block text-sm font-medium text-gray-400 mb-1"
                  >
                    Type
                  </label>
                  <select
                    id="newDisciplineType"
                    className="input text-sm"
                    value={newDisciplineType}
                    onChange={(e) =>
                      setNewDisciplineType(
                        e.target.value as DisciplineEntry["type"]
                      )
                    }
                  >
                    <option value="commendation">Commendation</option>
                    <option value="verbal">Verbal Warning</option>
                    <option value="written">Written Warning</option>
                    <option value="suspension">Suspension</option>
                    <option value="termination">Termination</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label
                    htmlFor="newDisciplineNote"
                    className="block text-sm font-medium text-gray-400 mb-1"
                  >
                    Details
                  </label>
                  <textarea
                    id="newDisciplineNote"
                    className="input text-sm"
                    rows={3}
                    value={newDisciplineNote}
                    onChange={(e) => setNewDisciplineNote(e.target.value)}
                    placeholder="Enter discipline details..."
                  />
                </div>
                {submitError && (
                  <p className="text-red-500 mb-3 text-sm">{submitError}</p>
                )}
                <button
                  className="button-primary text-sm px-4 py-2"
                  onClick={handleAddDisciplineEntry}
                >
                  Submit Discipline Entry
                </button>
              </div>
            )}

            {showAddNote && (
              <div className="admin-section p-4 mb-6 border border-yellow-500/50">
                <h2 className="section-header text-xl mb-3">
                  Add General Note for {selectedUserName}
                </h2>
                <div className="mb-3">
                  <label
                    htmlFor="newGeneralNote"
                    className="block text-sm font-medium text-gray-400 mb-1"
                  >
                    Note
                  </label>
                  <textarea
                    id="newGeneralNote"
                    className="input text-sm"
                    rows={3}
                    value={newGeneralNote}
                    onChange={(e) => setNewGeneralNote(e.target.value)}
                    placeholder="Enter general note..."
                  />
                </div>
                {submitError && (
                  <p className="text-red-500 mb-3 text-sm">{submitError}</p>
                )}
                <button
                  className="button-primary text-sm px-4 py-2"
                  onClick={handleAddGeneralNote}
                >
                  Submit General Note
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="admin-section p-4">
                <h2 className="section-header text-xl mb-3">
                  Discipline Records for {selectedUserName}
                </h2>
                {focusedDataLoading && (
                  <p className="text-yellow-400 italic">Loading records...</p>
                )}
                {focusedDataError && (
                  <p className="text-red-500">{focusedDataError}</p>
                )}
                {!focusedDataLoading && !focusedDataError && (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                    {disciplineEntries.length > 0 ? (
                      disciplineEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="note-card bg-gray-800/70 p-3 rounded border border-gray-600 relative group text-sm"
                        >
                          {editingDiscipline?.id === entry.id ? (
                            <div className="space-y-2">
                              <select
                                className="input text-sm w-full"
                                value={editingDiscipline.type}
                                onChange={(e) =>
                                  setEditingDiscipline({
                                    ...editingDiscipline,
                                    type: e.target
                                      .value as DisciplineEntry["type"],
                                  })
                                }
                              >
                                <option value="commendation">
                                  Commendation
                                </option>
                                <option value="verbal">Verbal Warning</option>
                                <option value="written">Written Warning</option>
                                <option value="suspension">Suspension</option>
                                <option value="termination">Termination</option>
                              </select>
                              <textarea
                                className="input text-sm w-full"
                                value={editingDiscipline.note}
                                onChange={(e) =>
                                  setEditingDiscipline({
                                    ...editingDiscipline,
                                    note: e.target.value,
                                  })
                                }
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <button
                                  className="button-primary text-xs px-2 py-1"
                                  onClick={handleSaveDisciplineEdit}
                                >
                                  Save
                                </button>
                                <button
                                  className="button-secondary text-xs px-2 py-1"
                                  onClick={handleCancelEdit}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p
                                className={`font-semibold ${getNoteTypeColor(
                                  entry.type
                                )} uppercase text-xs mb-1`}
                              >
                                {entry.type}
                              </p>
                              <p className="text-gray-300 whitespace-pre-wrap">
                                {entry.note}
                              </p>
                              <small className="text-gray-500 block mt-2 text-xs">
                                Issued by: {entry.issuedBy} on{" "}
                                {formatTimestamp(entry.issuedAt)}
                              </small>
                              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  title="Edit Entry"
                                  className="bg-blue-600 hover:bg-blue-500 text-white p-1 rounded text-xs"
                                  onClick={() =>
                                    handleStartEditDiscipline(entry)
                                  }
                                >
                                  ✏️
                                </button>
                                <button
                                  title="Delete Entry"
                                  className="bg-red-600 hover:bg-red-500 text-white p-1 rounded text-xs"
                                  onClick={() =>
                                    handleDeleteDiscipline(entry.id)
                                  }
                                >
                                  🗑️
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 italic text-sm">
                        No discipline records found.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="admin-section p-4">
                <h2 className="section-header text-xl mb-3">
                  General Notes for {selectedUserName}
                </h2>
                {focusedDataLoading && (
                  <p className="text-yellow-400 italic">Loading notes...</p>
                )}
                {focusedDataError && (
                  <p className="text-red-500">{focusedDataError}</p>
                )}
                {!focusedDataLoading && !focusedDataError && (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                    {generalNotes.length > 0 ? (
                      generalNotes.map((note) => (
                        <div
                          key={note.id}
                          className="note-card bg-gray-800/70 p-3 rounded border border-gray-600 relative group text-sm"
                        >
                          {editingNote?.id === note.id ? (
                            <div className="space-y-2">
                              <textarea
                                className="input text-sm w-full"
                                value={editingNote.note}
                                onChange={(e) =>
                                  setEditingNote({
                                    ...editingNote,
                                    note: e.target.value,
                                  })
                                }
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <button
                                  className="button-primary text-xs px-2 py-1"
                                  onClick={handleSaveNoteEdit}
                                >
                                  Save
                                </button>
                                <button
                                  className="button-secondary text-xs px-2 py-1"
                                  onClick={handleCancelEdit}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-gray-300 whitespace-pre-wrap">
                                {note.note}
                              </p>
                              <small className="text-gray-500 block mt-2 text-xs">
                                Issued by: {note.issuedBy} on{" "}
                                {formatTimestamp(note.issuedAt)}
                              </small>
                              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  title="Edit Note"
                                  className="bg-blue-600 hover:bg-blue-500 text-white p-1 rounded text-xs"
                                  onClick={() => handleStartEditNote(note)}
                                >
                                  ✏️
                                </button>
                                <button
                                  title="Delete Note"
                                  className="bg-red-600 hover:bg-red-500 text-white p-1 rounded text-xs"
                                  onClick={() => handleDeleteNote(note.id)}
                                >
                                  🗑️
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 italic text-sm">
                        No general notes found.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
