import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  Timestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { User as AuthUser, DisciplineNote } from "../types/User";

// Simplified user interface for this page
interface UserForNotes {
  id: string; // email
  name: string;
  rank: string;
  badge?: string;
  notes?: DisciplineNote[]; // Store fetched notes here
}

const DisciplineNotes: React.FC<{ user: AuthUser }> = ({ user }) => {
  const [users, setUsers] = useState<UserForNotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserForNote, setSelectedUserForNote] =
    useState<UserForNotes | null>(null);
  const [noteEntry, setNoteEntry] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
        const usersData = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "Unknown",
          rank: doc.data().rank || "Unknown",
          badge: doc.data().badge || "N/A",
          notes: [], // Initialize notes array
        }));
        usersData.sort((a, b) => a.name.localeCompare(b.name));
        setUsers(usersData);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Failed to load users.");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Fetch notes for the selected user
  useEffect(() => {
    if (!selectedUserForNote) return;

    const fetchNotes = async () => {
      // Indicate loading notes for the specific user maybe?
      const notesCollectionRef = collection(
        dbFirestore,
        "users",
        selectedUserForNote.id,
        "disciplineNotes"
      );
      const q = query(notesCollectionRef, orderBy("timestamp", "desc")); // Order by newest first

      try {
        const notesSnapshot = await getDocs(q);
        const fetchedNotes = notesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as DisciplineNote[];

        // Update the specific user in the state with their notes
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u.id === selectedUserForNote.id ? { ...u, notes: fetchedNotes } : u
          )
        );
      } catch (err) {
        console.error(
          `Error fetching notes for ${selectedUserForNote.id}:`,
          err
        );
        // Handle error display for notes if needed
      }
    };

    fetchNotes();
  }, [selectedUserForNote]); // Re-fetch when selected user changes

  const handleAddNote = async () => {
    if (!selectedUserForNote || !noteEntry.trim()) {
      setNoteError("Please select a user and enter a note.");
      return;
    }
    if (!user || !user.name) {
      setNoteError("Admin user information not found.");
      return;
    }

    setNoteError(null);
    setIsSubmitting(true);

    const notesCollectionRef = collection(
      dbFirestore,
      "users",
      selectedUserForNote.id,
      "disciplineNotes"
    );
    const newNoteData = {
      timestamp: Timestamp.now(), // Use Firestore Timestamp
      entry: noteEntry.trim(),
      adminName: user.name, // Log which admin added the note
    };

    try {
      const docRef = await addDoc(notesCollectionRef, newNoteData);
      const addedNote: DisciplineNote = { ...newNoteData, id: docRef.id };

      // Optimistically update UI
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === selectedUserForNote.id
            ? { ...u, notes: [addedNote, ...(u.notes ?? [])] }
            : u
        )
      );

      setNoteEntry(""); // Clear input
      // Optionally close a modal if using one
    } catch (err) {
      console.error("Error adding note:", err);
      setNoteError("Failed to save note.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout user={user}>
      <div className="page-content space-y-6">
        <h1 className="text-3xl font-bold text-[#f3c700]">
          Discipline & Notes
        </h1>

        {loading && <p className="text-yellow-400 italic">Loading users...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((u) => (
              <div
                key={u.id}
                className="user-card p-3 border border-gray-700 rounded-lg bg-gray-900/50"
              >
                <h3 className="text-lg font-semibold text-yellow-400 truncate">
                  {u.name}{" "}
                  <span className="text-xs text-gray-400">({u.rank})</span>
                </h3>
                <p className="text-xs text-gray-500 truncate mb-2">
                  Badge: {u.badge}
                </p>
                <button
                  className="button-secondary text-xs px-2 py-1 mt-1"
                  onClick={() => setSelectedUserForNote(u)}
                >
                  View/Add Notes ({u.notes?.length ?? 0})
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Simple Modal/Section for Viewing/Adding Notes */}
        {selectedUserForNote && (
          <div
            className="fixed inset-0 bg-black/80 z-40 flex justify-center items-center p-4"
            onClick={() => setSelectedUserForNote(null)}
          >
            <div
              className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-semibold text-yellow-400 mb-4">
                Notes for {selectedUserForNote.name}
              </h2>

              {/* Add Note Form */}
              <div className="mb-4 border-b border-gray-600 pb-4">
                <h3 className="text-lg text-yellow-300 mb-2">Add New Note</h3>
                <textarea
                  className="input text-sm w-full"
                  rows={3}
                  placeholder="Enter note..."
                  value={noteEntry}
                  onChange={(e) => setNoteEntry(e.target.value)}
                />
                {noteError && (
                  <p className="text-red-500 text-xs mt-1">{noteError}</p>
                )}
                <button
                  className="button-primary text-sm px-3 py-1.5 mt-2"
                  onClick={handleAddNote}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save Note"}
                </button>
              </div>

              {/* Display Notes */}
              <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-3">
                <h3 className="text-lg text-yellow-300 mb-2">History</h3>
                {selectedUserForNote.notes &&
                selectedUserForNote.notes.length > 0 ? (
                  selectedUserForNote.notes.map((note) => (
                    <div key={note.id} className="bg-gray-700 p-3 rounded">
                      <p className="text-sm text-white whitespace-pre-wrap">
                        {note.entry}
                      </p>
                      <small className="text-xs text-gray-400 block mt-1">
                        By: {note.adminName} on{" "}
                        {note.timestamp?.toDate().toLocaleString() ??
                          "Unknown date"}
                      </small>
                      {/* Add delete button if needed */}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    No notes found for this user.
                  </p>
                )}
              </div>

              <button
                className="button-secondary text-sm px-3 py-1.5 mt-4 self-start"
                onClick={() => setSelectedUserForNote(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DisciplineNotes;
