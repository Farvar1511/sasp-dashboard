import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { User as AuthUser } from "../types/User";

// Define a specific type for this page, including the fields we need
interface UserRecord {
  id: string;
  name: string;
  rank?: string;
  callsign?: string;
  badge?: string;
  discipline?: string;
  disciplineIssuedAt?: Timestamp;
  notes?: string;
  notesIssuedAt?: Timestamp;
}

export default function DisciplineNotesPage({ user }: { user: AuthUser }) {
  const [notes, setNotes] = useState<string>("");
  const [discipline, setDiscipline] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showDisciplineForm, setShowDisciplineForm] = useState(false);
  const [showNotesForm, setShowNotesForm] = useState(false);

  // Fetch users for the dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
        const usersData = usersSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "Unknown",
            rank: data.rank,
            callsign: data.callsign,
            badge: data.badge,
            discipline: data.discipline || "",
            disciplineIssuedAt: data.disciplineIssuedAt || null,
            notes: data.notes || "",
            notesIssuedAt: data.notesIssuedAt || null,
          } as UserRecord;
        });
        setUsers(
          usersData.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        );
      } catch (error) {
        console.error("Error fetching users:", error);
        // Handle error display if needed
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Update text areas and hide forms when selectedUser changes
  useEffect(() => {
    if (selectedUser) {
      setDiscipline(selectedUser.discipline || "");
      setNotes(selectedUser.notes || "");
      setShowDisciplineForm(false); // Start with forms hidden
      setShowNotesForm(false);
    } else {
      setDiscipline("");
      setNotes("");
      setShowDisciplineForm(false);
      setShowNotesForm(false);
    }
  }, [selectedUser]);

  // Saves ONLY discipline and its timestamp
  const handleSaveDiscipline = async () => {
    if (!selectedUser) return;
    try {
      const userRef = doc(dbFirestore, "users", selectedUser.id);
      const updatedTimestamp = serverTimestamp();
      const updateData = {
        discipline: discipline,
        disciplineIssuedAt: updatedTimestamp,
      };
      await updateDoc(userRef, updateData);

      const updatedUserData = {
        ...selectedUser,
        discipline: discipline,
        disciplineIssuedAt: Timestamp.now(),
      };
      setSelectedUser(updatedUserData); // Update selected user state
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === selectedUser.id ? updatedUserData : u))
      ); // Update list state
      // Keep form open: setShowDisciplineForm(false);
      alert("Discipline updated successfully!");
    } catch (error) {
      console.error("Error updating discipline:", error);
      alert("Failed to update discipline. Please try again.");
    }
  };

  // Saves ONLY notes and its timestamp
  const handleSaveNotes = async () => {
    if (!selectedUser) return;
    try {
      const userRef = doc(dbFirestore, "users", selectedUser.id);
      const updatedTimestamp = serverTimestamp();
      const updateData = {
        notes: notes,
        notesIssuedAt: updatedTimestamp,
      };
      await updateDoc(userRef, updateData);

      const updatedUserData = {
        ...selectedUser,
        notes: notes,
        notesIssuedAt: Timestamp.now(),
      };
      setSelectedUser(updatedUserData); // Update selected user state
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === selectedUser.id ? updatedUserData : u))
      ); // Update list state
      // Keep form open: setShowNotesForm(false);
      alert("Notes updated successfully!");
    } catch (error) {
      console.error("Error updating notes:", error);
      alert("Failed to update notes. Please try again.");
    }
  };

  // Helper to format Timestamp for display
  const formatTimestamp = (ts: Timestamp | null | undefined): string => {
    if (!ts) return "N/A";
    return ts.toDate().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <Layout user={user}>
      <div
        className="admin-menu-container p-6 bg-gray-800 rounded-lg shadow-lg max-w-4xl mx-auto space-y-6"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <h2 className="text-2xl font-bold text-yellow-400 mb-4">
          User Records: Discipline & Notes
        </h2>

        {/* User Selection Dropdown */}
        <div className="mb-6">
          <label
            htmlFor="user-select"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Select User
          </label>
          <select
            id="user-select"
            className="input w-full bg-gray-700 border-gray-600 text-white"
            value={selectedUser?.id || ""}
            onChange={(e) => {
              const userId = e.target.value;
              setSelectedUser(users.find((u) => u.id === userId) || null);
            }}
            disabled={loadingUsers}
          >
            <option value="">
              {loadingUsers ? "Loading users..." : "-- Select a User --"}
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.callsign || u.badge || u.id})
              </option>
            ))}
          </select>
        </div>

        {/* Discipline Section */}
        <div className="mb-6 border-t border-gray-700 pt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-yellow-400">
              Discipline Record
            </h3>
            <button
              className={`button-secondary text-sm px-3 py-1 ${
                !selectedUser ? "opacity-50 cursor-not-allowed" : ""
              }`}
              onClick={() => {
                if (selectedUser) {
                  setShowDisciplineForm(!showDisciplineForm);
                  setShowNotesForm(false); // Hide other form
                }
              }}
              disabled={!selectedUser}
            >
              {showDisciplineForm ? "Hide Form" : "Add/Edit Discipline"}
            </button>
          </div>
          {showDisciplineForm && selectedUser && (
            <div className="space-y-4 p-4 bg-gray-700 rounded-md mt-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-300">
                  Editing Discipline for: {selectedUser.name}
                </span>
                <span className="text-xs text-gray-400">
                  Last Updated:{" "}
                  {formatTimestamp(selectedUser.disciplineIssuedAt)}
                </span>
              </div>
              <textarea
                className="input w-full bg-gray-600 border-gray-500 text-white"
                placeholder="Enter discipline details..."
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                rows={4}
              />
              <div className="flex gap-4">
                <button
                  className="button-primary"
                  onClick={handleSaveDiscipline}
                >
                  Save Discipline Entry
                </button>
                <button
                  className="button-secondary"
                  onClick={() => setShowDisciplineForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {/* Display current discipline when form is hidden */}
          {!showDisciplineForm && selectedUser && (
            <div className="mt-2 p-3 bg-gray-700/50 rounded text-sm text-gray-300 whitespace-pre-wrap">
              <p className="font-medium mb-1">Current Discipline Record:</p>
              {selectedUser.discipline || (
                <span className="italic text-gray-400">
                  No discipline record on file.
                </span>
              )}
              {selectedUser.discipline && (
                <p className="text-xs text-gray-400 mt-1">
                  Last Updated:{" "}
                  {formatTimestamp(selectedUser.disciplineIssuedAt)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Notes Section */}
        <div className="mb-6 border-t border-gray-700 pt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-yellow-400">
              General Notes
            </h3>
            <button
              className={`button-secondary text-sm px-3 py-1 ${
                !selectedUser ? "opacity-50 cursor-not-allowed" : ""
              }`}
              onClick={() => {
                if (selectedUser) {
                  setShowNotesForm(!showNotesForm);
                  setShowDisciplineForm(false); // Hide other form
                }
              }}
              disabled={!selectedUser}
            >
              {showNotesForm ? "Hide Form" : "Add/Edit Note"}
            </button>
          </div>
          {showNotesForm && selectedUser && (
            <div className="space-y-4 p-4 bg-gray-700 rounded-md mt-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-300">
                  Editing Notes for: {selectedUser.name}
                </span>
                <span className="text-xs text-gray-400">
                  Last Updated: {formatTimestamp(selectedUser.notesIssuedAt)}
                </span>
              </div>
              <textarea
                className="input w-full bg-gray-600 border-gray-500 text-white"
                placeholder="Add general note..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
              <div className="flex gap-4">
                <button className="button-primary" onClick={handleSaveNotes}>
                  Save General Note
                </button>
                <button
                  className="button-secondary"
                  onClick={() => setShowNotesForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {/* Display current notes when form is hidden */}
          {!showNotesForm && selectedUser && (
            <div className="mt-2 p-3 bg-gray-700/50 rounded text-sm text-gray-300 whitespace-pre-wrap">
              <p className="font-medium mb-1">Current General Notes:</p>
              {selectedUser.notes || (
                <span className="italic text-gray-400">
                  No general notes on file.
                </span>
              )}
              {selectedUser.notes && (
                <p className="text-xs text-gray-400 mt-1">
                  Last Updated: {formatTimestamp(selectedUser.notesIssuedAt)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
