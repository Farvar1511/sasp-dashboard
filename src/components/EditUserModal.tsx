import React, { useState, useEffect } from "react";
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  Timestamp, // Import Timestamp from firebase/firestore
  deleteField, // Import deleteField
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase"; // Keep db import as is
import { FaEdit, FaTrash, FaPlus, FaArchive, FaUndo, FaSave, FaTimes } from "react-icons/fa"; // Add FaSave, FaTimes
import { useAuth } from "../context/AuthContext";
import { formatIssuedAt, formatDateToMMDDYY } from "../utils/timeHelpers";
import { toast } from "react-toastify";
import { UserTask, DisciplineEntry, NoteEntry } from "../types/User";

// Define the possible certification statuses
type CertStatus = "TRAIN" | "CERT" | "LEAD" | "SUPER";

interface EditUserModalProps {
  user: {
    id: string;
    name: string;
    rank: string;
    badge: string;
    callsign: string;
    category: string;
    certifications: { [key: string]: CertStatus | null }; // Use CertStatus
    cid: string;
    discordId: string;
    email: string;
    isActive: boolean;
    isPlaceholder: boolean;
    isadmin?: boolean;
    joinDate: string;
    lastPromotionDate: string;
    loaEndDate: string;
    loaStartDate: string;
    role: string;
    assignedVehicleId?: string;
    tasks: UserTask[];
    disciplineEntries: DisciplineEntry[];
    generalNotes: NoteEntry[];
    promotionStatus?: {
      votes?: { [voterId: string]: "Approve" | "Deny" | "Needs Time" };
      hideUntil?: Timestamp | null; // Timestamp type is now correctly imported
      lastVoteTimestamp?: Timestamp; // Timestamp type is now correctly imported
    };
  };
  onClose: () => void;
  onSave: () => void;
}

const restrictedCertKeys = ["MBU", "HEAT", "ACU"];

// Define all possible certification keys
const ALL_CERTIFICATION_KEYS = [
  "MBU", "HEAT", "ACU", // Restricted
  "K9", "FTO", "SWAT", "CIU" // Add all relevant keys here
].sort(); // Sort alphabetically for consistent display order

// Helper function to parse MM/DD/YY input and return YYYY-MM-DD or null
const parseMMDDYYToYYYYMMDD = (dateString: string | null | undefined): string | null => {
  if (!dateString || !dateString.trim()) return null; // Return null for empty/whitespace strings
  const cleanedString = dateString.trim();
  // Regex allows M/D/YY, MM/DD/YY, M/D/YYYY, MM/DD/YYYY
  const parts = cleanedString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!parts) return null; // Invalid format

  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  let year = parseInt(parts[3], 10);

  // Handle YY -> YYYY conversion (assuming 20xx)
  if (year < 100) {
    year += 2000;
  }

  // Basic validation
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  // Format to YYYY-MM-DD
  const yyyy = year.toString();
  const mm = month.toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');

  // Final check if the constructed date is valid (e.g., handles Feb 30)
  // Use UTC to avoid timezone issues during validation
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  if (isNaN(dateObj.getTime()) || dateObj.getUTCFullYear() !== year || dateObj.getUTCMonth() + 1 !== month || dateObj.getUTCDate() !== day) {
      console.warn(`Invalid date constructed: ${yyyy}-${mm}-${dd} from input ${dateString}`);
      return null; // Invalid date like Feb 30
  }

  return `${yyyy}-${mm}-${dd}`;
};


const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, onSave }) => {
  const { user: currentUser } = useAuth(); // Get current user for issuer name

  // Initialize certifications ensuring all keys are present
  const initialCertifications = ALL_CERTIFICATION_KEYS.reduce((acc, key) => {
    acc[key] = user.certifications?.[key] || null; // Use user's value or default to null
    return acc;
  }, {} as { [key: string]: CertStatus | null }); // Use CertStatus

  const [formData, setFormData] = useState<{
    newTaskDesc: string;
    newTaskType: "normal" | "goal";
    newTaskGoal: number;
    showAssignTask: boolean;
    showAddDiscipline: boolean;
    showAddNote: boolean;
    statusMessage: { type: string; message: string } | null;
    id: string;
    name: string;
    rank: string;
    badge: string;
    callsign: string;
    category: string;
    certifications: { [key: string]: CertStatus | null }; // Use CertStatus
    cid: string;
    discordId: string;
    email: string;
    isActive: boolean;
    isPlaceholder: boolean;
    isadmin?: boolean;
    joinDate: string; 
    lastPromotionDate: string; // Will hold MM/DD/YY for display
    loaEndDate: string; // Will hold MM/DD/YY for display
    loaStartDate: string; // Will hold MM/DD/YY for display
    role: string;
    assignedVehicleId?: string;
    tasks: UserTask[];
    disciplineEntries: DisciplineEntry[];
    generalNotes: NoteEntry[];
    promotionStatus?: {
      votes?: { [voterId: string]: "Approve" | "Deny" | "Needs Time" };
      hideUntil?: Timestamp | null; // Timestamp type is now correctly imported
      lastVoteTimestamp?: Timestamp; // Timestamp type is now correctly imported
    };
  }>({
    ...user,
    // Format dates from user prop (likely YYYY-MM-DD or other) to MM/DD/YY for display
    joinDate: formatDateToMMDDYY(user.joinDate),
    lastPromotionDate: formatDateToMMDDYY(user.lastPromotionDate),
    loaStartDate: formatDateToMMDDYY(user.loaStartDate),
    loaEndDate: formatDateToMMDDYY(user.loaEndDate),
    // Initialize certifications with all keys
    certifications: initialCertifications,
    // Initialize other state parts
    newTaskDesc: "",
    newTaskType: "normal",
    newTaskGoal: 0,
    showAssignTask: false,
    showAddDiscipline: false,
    showAddNote: false,
    statusMessage: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "roster" | "tasks" | "vehicle" | "certifications"
  >("roster");
  const [tasks, setTasks] = useState<UserTask[]>(user.tasks || []);
  const [discipline, setDiscipline] = useState<DisciplineEntry[]>(
    user.disciplineEntries || []
  );
  const [notes, setNotes] = useState<NoteEntry[]>(user.generalNotes || []);
  const [confirmationModal, setConfirmationModal] = useState<{
    show: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [newNote, setNewNote] = useState("");
  const [disciplineType, setDisciplineType] = useState("");
  const [disciplineNotes, setDisciplineNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fleetPlates, setFleetPlates] = useState<string[]>([]);
  const [originalRank, setOriginalRank] = useState(user.rank); // Store original rank

  // --- State for inline editing ---
  const [editingTaskEntry, setEditingTaskEntry] = useState<UserTask | null>(null);
  const [editedTaskDesc, setEditedTaskDesc] = useState("");
  const [editingDisciplineEntry, setEditingDisciplineEntry] = useState<DisciplineEntry | null>(null);
  const [editedDisciplineNotes, setEditedDisciplineNotes] = useState("");
  const [editingNoteEntry, setEditingNoteEntry] = useState<NoteEntry | null>(null);
  const [editedNoteText, setEditedNoteText] = useState("");
  // --- End State for inline editing ---


  useEffect(() => {
    setTasks(user.tasks || []);
    setDiscipline(user.disciplineEntries || []);
    setNotes(user.generalNotes || []);
  }, [user]);

  useEffect(() => {
    const fetchFleetPlates = async () => {
      try {
        const fleetSnapshot = await getDocs(collection(dbFirestore, "fleet"));
        const plates = fleetSnapshot.docs
          .map((doc) => doc.data().plate)
          .filter((plate) => typeof plate === "string");
        setFleetPlates(plates);
      } catch (error) {
        console.error("Error fetching fleet plates:", error);
      }
    };
    fetchFleetPlates();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCertificationChange = (certKey: string, value: string | null) => {
    // Validate the incoming value against CertStatus or null
    const potentialValue = value as CertStatus | null;
    let finalValue: CertStatus | null = null;

    if (potentialValue && ["TRAIN", "CERT", "LEAD", "SUPER"].includes(potentialValue)) {
        finalValue = potentialValue;
    }

    // Apply restriction rules
    const isRestricted = restrictedCertKeys.includes(certKey.toUpperCase());

    if (isRestricted) {
        // Restricted keys can only be CERT or null
        if (finalValue && finalValue !== "CERT") {
            console.warn(`Only 'CERT' or 'None' allowed for restricted certification: ${certKey}`);
            finalValue = null; // Default to null if invalid value is attempted
        }
    }
    // No specific rule needed for non-restricted keys, as finalValue is already validated against CertStatus or null

    setFormData((prev) => ({
      ...prev,
      certifications: { ...prev.certifications, [certKey]: finalValue },
    }));
  };


  const handleSaveRosterInfo = async () => {
    setIsSaving(true);
    try {
      const userRef = doc(dbFirestore, "users", user.email); // Use email as the document ID
      const { tasks, disciplineEntries, generalNotes, ...rosterData } =
        formData;

      // Parse MM/DD/YY input from form to YYYY-MM-DD (or null) for Firestore storage
      const updateData = {
        ...rosterData,
        assignedVehicleId: rosterData.assignedVehicleId || null, // Ensure no undefined values
        // Use the parser here
        loaStartDate: parseMMDDYYToYYYYMMDD(rosterData.loaStartDate),
        loaEndDate: parseMMDDYYToYYYYMMDD(rosterData.loaEndDate),
        joinDate: parseMMDDYYToYYYYMMDD(rosterData.joinDate),
        lastPromotionDate: parseMMDDYYToYYYYMMDD(rosterData.lastPromotionDate),
      };

      // Check if rank has changed
      if (rosterData.rank !== originalRank) {
        const currentDate = new Date().toISOString().split("T")[0]; // Get current date in YYYY-MM-DD format
        updateData.lastPromotionDate = currentDate;
        toast.info(`Rank changed. Last promotion date updated to ${currentDate}.`);
      }

      // Firestore updateDoc handles null values by default (doesn't delete field unless specified)
      await updateDoc(userRef, updateData); // Update Firestore document
      toast.success("Roster changes saved successfully!");
      onSave(); // Trigger the onSave callback
    } catch (error) {
      console.error("Error saving user roster info:", error);
      toast.error("Failed to save roster changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCertifications = async () => {
    setIsSaving(true);
    try {
      const userRef = doc(dbFirestore, "users", user.id);
      // Filter out null values before saving
      const certsToSave = Object.entries(formData.certifications)
        .filter(([key, value]) => value !== null)
        .reduce((acc, [key, value]) => {
          // value here is guaranteed to be CertStatus, not null
          acc[key] = value as CertStatus;
          return acc;
        }, {} as { [key: string]: CertStatus }); // Use CertStatus

      const updateData = {
        certifications: certsToSave,
      };
      await updateDoc(userRef, updateData);
      toast.success("Certifications saved successfully!");
      onSave();
    } catch (error) {
      console.error("Error saving certifications:", error);
      toast.error("Failed to save certifications.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignNewTask = async () => {
    console.log("Assigning Task to User ID:", user.id);
    console.log("Task Description:", formData.newTaskDesc);

    if (!formData.newTaskDesc.trim()) {
      toast.error("Task description cannot be empty.");
      return;
    }

    if (formData.newTaskType === "goal" && formData.newTaskGoal <= 0) {
      toast.error("Goal must be greater than 0 for goal tasks.");
      return;
    }

    try {
      const { date: issueddate, time: issuedtime } = getCurrentDateTimeStrings();

      // Ensure ID is unique enough for immediate state update, Firestore generates its own
      const tempId = `temp_${Date.now()}`;
      const newTaskData: UserTask = {
        id: tempId, // Temporary ID for local state
        task: formData.newTaskDesc.trim(),
        type: formData.newTaskType,
        issuedby: currentUser?.name || "System",
        issueddate,
        issuedtime,
        completed: false,
        archived: false, // Initialize archived as false
        progress: 0,
        ...(formData.newTaskType === "goal" ? { goal: formData.newTaskGoal } : {}),
      };

      console.log("New Task Data (local):", newTaskData);

      // Create data object for Firestore, excluding the 'id' field
      const dataToSave = { ...newTaskData };
      delete (dataToSave as Partial<UserTask>).id; // Remove the id field

      console.log("Data to save in Firestore:", dataToSave);

      // Update Firestore
      const tasksColRef = collection(dbFirestore, "users", user.id, "tasks");
      // Add to Firestore, let it generate the ID
      const docRef = await addDoc(tasksColRef, dataToSave); // Use the object without the id field

      // Update local state with Firestore ID
      setTasks((prev) => [...prev, { ...newTaskData, id: docRef.id }]); // Use Firestore ID locally
      setFormData((prev) => ({
        ...prev,
        newTaskDesc: "",
        newTaskType: "normal",
        newTaskGoal: 0,
        showAssignTask: false,
      }));

      toast.success("Task assigned successfully!");
    } catch (error) {
      console.error("Error assigning task:", error);
      toast.error("Failed to assign task.");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setConfirmationModal({
      show: true,
      message: "Are you sure you want to delete this task?",
      onConfirm: async () => {
        try {
          const taskRef = doc(dbFirestore, "users", user.id, "tasks", taskId);
          await deleteDoc(taskRef);
          setTasks((prev) => prev.filter((t) => t.id !== taskId)); // Update local state
          toast.success("Task deleted successfully!");
        } catch (error) {
          console.error("Error deleting task:", error);
          toast.error("Failed to delete task.");
        } finally {
          setConfirmationModal(null);
        }
      },
    });
  };

  // --- Start Task Edit Handlers ---
  const handleStartTaskEdit = (task: UserTask) => {
    setEditingTaskEntry(task);
    setEditedTaskDesc(task.task);
    // Close other edit forms if open
    setEditingDisciplineEntry(null);
    setEditingNoteEntry(null);
  };

  const handleCancelTaskEdit = () => {
    setEditingTaskEntry(null);
    setEditedTaskDesc("");
  };

  const handleSaveTaskEdit = async () => {
    if (!editingTaskEntry || !editedTaskDesc.trim()) {
      toast.error("Task description cannot be empty.");
      return;
    }
    setIsSubmitting(true); // Indicate saving process
    try {
      const taskRef = doc(dbFirestore, "users", user.id, "tasks", editingTaskEntry.id);
      const updateData: Partial<UserTask> & { goal?: any; progress?: any } = {
        task: editedTaskDesc.trim(),
      };

      // IMPORTANT: Handle goal/progress removal if type is not 'goal'
      // Note: This assumes task type cannot be changed here. If it can, add logic.
      if (editingTaskEntry.type !== 'goal') {
        updateData.goal = deleteField();
        updateData.progress = deleteField();
      }

      await updateDoc(taskRef, updateData);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTaskEntry.id ? { ...t, task: editedTaskDesc.trim() } : t
        )
      );
      toast.success("Task updated successfully!");
      handleCancelTaskEdit(); // Close edit form
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error(`Failed to update task: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false); // End saving process
    }
  };
  // --- End Task Edit Handlers ---


  // No changes needed for handleEditTask, EditTaskModal handles archive now

  // Add handler for archiving within the modal
  const handleArchiveTask = async (taskId: string, currentArchivedStatus: boolean) => {
      const taskRef = doc(dbFirestore, "users", user.id, "tasks", taskId);
      const newArchivedStatus = !currentArchivedStatus;
      try {
          await updateDoc(taskRef, { archived: newArchivedStatus });
          setTasks(prev => prev.map(t => t.id === taskId ? { ...t, archived: newArchivedStatus } : t));
          toast.success(`Task ${newArchivedStatus ? 'archived' : 'unarchived'}.`);
      } catch (error) {
          console.error("Error archiving/unarchiving task:", error);
          toast.error("Failed to update task archive status.");
      }
  };

  // --- Start Discipline Edit Handlers ---
  const handleStartDisciplineEdit = (entry: DisciplineEntry) => {
    setEditingDisciplineEntry(entry);
    setEditedDisciplineNotes(entry.disciplinenotes);
    // Close other edit forms
    setEditingTaskEntry(null);
    setEditingNoteEntry(null);
  };

  const handleCancelDisciplineEdit = () => {
    setEditingDisciplineEntry(null);
    setEditedDisciplineNotes("");
  };

  const handleSaveDisciplineEdit = async () => {
    if (!editingDisciplineEntry || !editedDisciplineNotes.trim()) {
      toast.error("Discipline notes cannot be empty.");
      return;
    }
    setIsSubmitting(true);
    try {
      const disciplineRef = doc(dbFirestore, "users", user.id, "discipline", editingDisciplineEntry.id);
      // Assuming only notes are editable here. If type is editable, add it to updateData.
      const updateData = { disciplinenotes: editedDisciplineNotes.trim() };

      await updateDoc(disciplineRef, updateData);
      setDiscipline((prev) =>
        prev.map((d) =>
          d.id === editingDisciplineEntry.id ? { ...d, disciplinenotes: editedDisciplineNotes.trim() } : d
        )
      );
      toast.success("Discipline entry updated successfully!");
      handleCancelDisciplineEdit(); // Close edit form
    } catch (error) {
      console.error("Error updating discipline entry:", error);
      toast.error("Failed to update discipline entry.");
    } finally {
      setIsSubmitting(false);
    }
  };
  // --- End Discipline Edit Handlers ---

  const handleAddDiscipline = async () => {
    if (!disciplineType.trim() || !disciplineNotes.trim()) {
      setFormData((prev) => ({
        ...prev,
        statusMessage: {
          type: "error",
          message: "Discipline type and notes cannot be empty.",
        },
      }));
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const issuedDate = now.toLocaleDateString("en-US");
      const issuedTime = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      const disciplineRef = await addDoc(
        collection(dbFirestore, "users", user.id, "discipline"),
        {
          type: disciplineType.trim(),
          disciplinenotes: disciplineNotes.trim(),
          issuedby: currentUser?.name || currentUser?.email || "Unknown",
          issueddate: issuedDate,
          issuedtime: issuedTime,
        }
      );

      setDiscipline((prev) => [
        ...prev,
        {
          id: disciplineRef.id,
          type: disciplineType.trim() as
            | "strike"
            | "written warning"
            | "verbal warning"
            | "suspension",
          disciplinenotes: disciplineNotes.trim(),
          issuedby: currentUser?.name || currentUser?.email || "Unknown",
          issueddate: issuedDate,
          issuedtime: issuedTime,
        },
      ]);

      setFormData((prev) => ({
        ...prev,
        showAddDiscipline: false, // Collapse the discipline input box
        statusMessage: {
          type: "success",
          message: "Discipline entry added successfully!",
        },
      }));
      setDisciplineType("");
      setDisciplineNotes("");
      toast.success("Discipline entry added successfully!");
    } catch (error) {
      console.error("Error adding discipline entry:", error);
      setFormData((prev) => ({
        ...prev,
        statusMessage: {
          type: "error",
          message: "Failed to add discipline entry.",
        },
      }));
      toast.error("Failed to add discipline entry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    setConfirmationModal({
      show: true,
      message: "Are you sure you want to delete this note?",
      onConfirm: async () => {
        try {
          const noteRef = doc(dbFirestore, "users", user.id, "notes", noteId);
          await deleteDoc(noteRef);
          setNotes((prev) => prev.filter((note) => note.id !== noteId));
          toast.success("Note deleted successfully!");
        } catch (error) {
          console.error("Error deleting note:", error);
          toast.error("Failed to delete note.");
        } finally {
          setConfirmationModal(null);
        }
      },
    });
  };

  const handleDeleteDiscipline = (disciplineId: string) => {
    setConfirmationModal({
      show: true,
      message: "Are you sure you want to delete this discipline entry?",
      onConfirm: async () => {
        try {
          const disciplineRef = doc(
            dbFirestore,
            "users",
            user.id,
            "discipline",
            disciplineId
          );
          await deleteDoc(disciplineRef);
          setDiscipline((prev) =>
            prev.filter((discipline) => discipline.id !== disciplineId)
          );
          toast.success("Discipline entry deleted successfully!");
        } catch (error) {
          console.error("Error deleting discipline entry:", error);
          toast.error("Failed to delete discipline entry.");
        } finally {
          setConfirmationModal(null);
        }
      },
    });
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      setFormData((prev) => ({
        ...prev,
        statusMessage: { type: "error", message: "Note cannot be empty." },
      }));
      toast.error("Note cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const issuedDate = now.toLocaleDateString("en-US");
      const issuedTime = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      const issuedBy = currentUser?.name || currentUser?.email || "Unknown";

      const noteRef = await addDoc(
        collection(dbFirestore, "users", user.id, "notes"),
        {
          note: newNote.trim(),
          issuedby: issuedBy,
          issueddate: issuedDate,
          issuedtime: issuedTime,
        }
      );

      setNotes((prev) => [
        ...prev,
        {
          id: noteRef.id,
          note: newNote.trim(),
          issuedby: issuedBy,
          issueddate: issuedDate,
          issuedtime: issuedTime,
        },
      ]);

      setFormData((prev) => ({
        ...prev,
        showAddNote: false, // Collapse the note input box
        statusMessage: { type: "success", message: "Note added successfully!" },
      }));
      setNewNote("");
      toast.success("Note added successfully!");
    } catch (error) {
      console.error("Error adding note:", error);
      setFormData((prev) => ({
        ...prev,
        statusMessage: { type: "error", message: "Failed to add note." },
      }));
      toast.error("Failed to add note.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Start Note Edit Handlers ---
  const handleStartNoteEdit = (note: NoteEntry) => {
    setEditingNoteEntry(note);
    setEditedNoteText(note.note);
    // Close other edit forms
    setEditingTaskEntry(null);
    setEditingDisciplineEntry(null);
  };

  const handleCancelNoteEdit = () => {
    setEditingNoteEntry(null);
    setEditedNoteText("");
  };

  const handleSaveNoteEdit = async () => {
    if (!editingNoteEntry || !editedNoteText.trim()) {
      toast.error("Note cannot be empty.");
      return;
    }
    setIsSubmitting(true);
    try {
      const noteRef = doc(dbFirestore, "users", user.id, "notes", editingNoteEntry.id);
      const updateData = { note: editedNoteText.trim() };

      await updateDoc(noteRef, updateData);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === editingNoteEntry.id ? { ...n, note: editedNoteText.trim() } : n
        )
      );
      toast.success("Note updated successfully!");
      handleCancelNoteEdit(); // Close edit form
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error("Failed to update note.");
    } finally {
      setIsSubmitting(false);
    }
  };
  // --- End Note Edit Handlers ---

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
      {/* Modal container */}
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl border border-[#f3c700]/50 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-[#f3c700]">{user.name} - Management</h2>
          {/* Tabs List */}
          <div className="flex space-x-4 border-b border-yellow-600 mb-6">
            <button
              onClick={() => setActiveTab("roster")}
              className={`px-4 py-2 ${
                activeTab === "roster"
                  ? "text-yellow-400 border-b-2 border-yellow-600"
                  : "text-gray-400"
              }`}
            >
              Roster
            </button>
            <button
              onClick={() => setActiveTab("tasks")}
              className={`px-4 py-2 ${
                activeTab === "tasks"
                  ? "text-yellow-400 border-b-2 border-yellow-600"
                  : "text-gray-400"
              }`}
            >
              Tasks/Discipline/Notes
            </button>
            <button
              onClick={() => setActiveTab("vehicle")}
              className={`px-4 py-2 ${
                activeTab === "vehicle"
                  ? "text-yellow-400 border-b-2 border-yellow-600"
                  : "text-gray-400"
              }`}
            >
              Assigned Vehicle
            </button>
            <button
              onClick={() => setActiveTab("certifications")}
              className={`px-4 py-2 ${
                activeTab === "certifications"
                  ? "text-yellow-400 border-b-2 border-yellow-600"
                  : "text-gray-400"
              }`}
            >
              Certifications & Divisions
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-grow custom-scrollbar">
          {/* Roster Tab */}
          {activeTab === "roster" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="input w-full bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Rank
                </label>
                <input
                  type="text"
                  name="rank"
                  value={formData.rank}
                  onChange={handleInputChange}
                  className="input w-full bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Badge
                </label>
                <input
                  type="text"
                  name="badge"
                  value={formData.badge}
                  onChange={handleInputChange}
                  className="input w-full bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Callsign
                </label>
                <input
                  type="text"
                  name="callsign"
                  value={formData.callsign}
                  onChange={handleInputChange}
                  className="input w-full bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Discord ID
                </label>
                <input
                  type="text"
                  name="discordId"
                  value={formData.discordId}
                  onChange={handleInputChange}
                  className="input w-full bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Join Date (MM/DD/YY)
                </label>
                <input
                  type="text"
                  name="joinDate"
                  value={formData.joinDate || ""} // Display the formatted MM/DD/YY
                  onChange={handleInputChange}
                  placeholder="MM/DD/YY"
                  className="input w-full bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Last Promotion Date (MM/DD/YY)
                </label>
                <input
                  type="text"
                  name="lastPromotionDate"
                  value={formData.lastPromotionDate || ""} // Display the formatted MM/DD/YY
                  onChange={handleInputChange}
                  placeholder="MM/DD/YY"
                  className="input w-full bg-gray-700 border-gray-600 text-white"
                  // Disable if rank has changed, as it will be auto-set
                  disabled={formData.rank !== originalRank}
                  title={formData.rank !== originalRank ? "Auto-updated on rank change" : ""}
                />
                {formData.rank !== originalRank && (
                  <p className="text-xs text-yellow-400 italic mt-1">Will be auto-updated to today's date upon saving.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  LOA Start Date (MM/DD/YY)
                </label>
                <input
                  type="text"
                  name="loaStartDate"
                  value={formData.loaStartDate || ""} // Display the formatted MM/DD/YY
                  onChange={handleInputChange}
                  placeholder="MM/DD/YY"
                  className="input w-full bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  LOA End Date (MM/DD/YY)
                </label>
                <input
                  type="text"
                  name="loaEndDate"
                  value={formData.loaEndDate || ""} // Display the formatted MM/DD/YY
                  onChange={handleInputChange}
                  placeholder="MM/DD/YY"
                  className="input w-full bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-300">
                  Is Active Member
                </label>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isActive: e.target.checked,
                    }))
                  }
                  className="form-checkbox h-4 w-4 text-yellow-500 bg-gray-700 border-gray-600 rounded"
                />
              </div>
              <button
                className="button-primary w-full mt-4"
                onClick={handleSaveRosterInfo}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Roster Changes"}
              </button>
            </div>
          )}

          {/* Tasks/Discipline/Notes Tab */}
          {activeTab === "tasks" && (
            <div className="space-y-4">
              {/* Tasks Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-semibold text-yellow-400 border-b border-yellow-600 pb-1 flex-grow">
                    Tasks ({tasks.length})
                  </h3>
                  <button
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        showAssignTask: !prev.showAssignTask,
                      }))
                    }
                    className="button-secondary text-xs ml-4 px-2 py-1 flex items-center gap-1"
                  >
                    <FaPlus /> Add Task
                  </button>
                </div>
                {formData.showAssignTask && (
                  <div className="p-3 border border-yellow-600 rounded bg-black mb-4 space-y-2">
                    <textarea
                      placeholder="Task description..."
                      value={formData.newTaskDesc}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          newTaskDesc: e.target.value,
                        }))
                      }
                      className="input w-full bg-black border border-yellow-600 text-white text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2 items-center">
                      <select
                        value={formData.newTaskType}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            newTaskType: e.target.value as "normal" | "goal",
                          }))
                        }
                        className="input bg-black border border-yellow-600 text-white text-xs"
                      >
                        <option value="normal">Normal</option>
                        <option value="goal">Goal</option>
                      </select>
                      {formData.newTaskType === "goal" && (
                        <input
                          type="number"
                          placeholder="Goal"
                          value={formData.newTaskGoal}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              newTaskGoal: Number(e.target.value),
                            }))
                          }
                          className="input bg-black border border-yellow-600 text-white text-xs w-20"
                        />
                      )}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            showAssignTask: false,
                          }))
                        }
                        className="button-secondary text-xs px-2 py-1"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAssignNewTask}
                        className="button-primary text-xs px-2 py-1"
                      >
                        Add Task
                      </button>
                    </div>
                  </div>
                )}
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {tasks.length > 0 ? (
                    tasks
                      .sort((a, b) => { // Sort by archived, then completed, then date
                          if (a.archived !== b.archived) return a.archived ? 1 : -1;
                          if (a.completed !== b.completed) return a.completed ? 1 : -1;
                          // Add date sorting if needed
                          return 0;
                      })
                      .map((task) => (
                        // --- Task Item ---
                        editingTaskEntry?.id === task.id ? (
                          // --- Task Edit Form ---
                          <div key={task.id} className="p-2 border border-yellow-500 rounded bg-gray-700 space-y-1">
                            <textarea
                              value={editedTaskDesc}
                              onChange={(e) => setEditedTaskDesc(e.target.value)}
                              className="input w-full bg-gray-600 border-gray-500 text-white text-sm"
                              rows={2}
                            />
                            <div className="flex justify-end gap-2">
                              <button onClick={handleCancelTaskEdit} className="text-gray-400 hover:text-white p-0.5" title="Cancel Edit">
                                <FaTimes size="0.8rem" />
                              </button>
                              <button onClick={handleSaveTaskEdit} disabled={isSubmitting} className="text-green-500 hover:text-green-400 p-0.5" title="Save Edit">
                                <FaSave size="0.8rem" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          // --- Task Display ---
                          <div
                            key={task.id}
                            className={`p-2 border rounded text-sm relative group ${task.archived ? 'border-gray-700 bg-gray-800/60 opacity-60' : 'border-gray-600 bg-gray-700/50'}`}
                          >
                            <p
                              className={`text-gray-300 ${
                                task.completed ? "line-through text-gray-500" : ""
                              }`}
                            >
                              {task.task} {task.archived ? '(Archived)' : ''}
                            </p>
                            <small className="text-gray-400 text-xs block">
                              {task.type === "goal"
                                ? `Goal: ${task.progress ?? 0}/${task.goal ?? "N/A"} | `
                                : ''}
                              Issued: {formatIssuedAt(task.issueddate, task.issuedtime)} | By: {task.issuedby}
                            </small>
                            {/* Action buttons */}
                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!task.archived && !editingTaskEntry && !editingDisciplineEntry && !editingNoteEntry && ( // Only show edit if not archived and no other item is being edited
                                <button
                                  onClick={() => handleStartTaskEdit(task)} // Use new handler
                                  className="text-yellow-400 hover:text-yellow-300 p-0.5"
                                  title="Edit Task"
                                >
                                  <FaEdit size="0.75rem" />
                                </button>
                              )}
                              {/* Archive/Unarchive Button */}
                              <button
                                  onClick={() => handleArchiveTask(task.id, task.archived ?? false)}
                                  className="text-blue-500 hover:text-blue-400 p-0.5"
                                  title={task.archived ? "Unarchive Task" : "Archive Task"}
                              >
                                  {task.archived ? <FaUndo size="0.75rem" /> : <FaArchive size="0.75rem" />}
                              </button>
                              {/* Delete Button */}
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="text-red-500 hover:text-red-400 p-0.5"
                                title="Delete Task"
                              >
                                <FaTrash size="0.75rem" />
                              </button>
                            </div>
                          </div>
                        )
                      )
                    )
                  ) : (
                    <p className="text-gray-500 italic text-sm">No tasks.</p>
                  )}
                </div>
              </div>

              {/* Discipline Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-semibold text-yellow-400 border-b border-yellow-600 pb-1 flex-grow">
                    Discipline ({discipline.length})
                  </h3>
                  <button
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        showAddDiscipline: !prev.showAddDiscipline,
                      }))
                    }
                    className="button-secondary text-xs ml-4 px-2 py-1 flex items-center gap-1"
                  >
                    <FaPlus /> Add Discipline
                  </button>
                </div>
                {formData.showAddDiscipline && (
                  <div className="p-3 border border-yellow-600 rounded bg-black mb-4 space-y-2">
                    <select
                      value={disciplineType}
                      onChange={(e) => setDisciplineType(e.target.value)}
                      className="input w-full bg-black border border-yellow-600 text-white"
                    >
                      <option value="">Select Discipline Type</option>
                      <option value="written warning">Written Warning</option>
                      <option value="verbal warning">Verbal Warning</option>
                      <option value="strike">Strike</option>
                      <option value="suspension">Suspension</option>
                    </select>
                    <textarea
                      value={disciplineNotes}
                      onChange={(e) => setDisciplineNotes(e.target.value)}
                      placeholder="Enter discipline notes..."
                      className="input w-full bg-black border border-yellow-600 text-white"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            showAddDiscipline: false,
                          }))
                        }
                        className="button-secondary text-xs px-2 py-1"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddDiscipline}
                        className="button-primary text-xs px-2 py-1"
                      >
                        Add Discipline
                      </button>
                    </div>
                  </div>
                )}
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {discipline.length > 0 ? (
                    discipline.map((entry) => (
                      // --- Discipline Item ---
                      editingDisciplineEntry?.id === entry.id ? (
                        // --- Discipline Edit Form ---
                        <div key={entry.id} className="p-2 border border-yellow-500 rounded bg-gray-700 space-y-1">
                           <p className="text-gray-300 font-semibold uppercase text-sm">{entry.type}</p>
                           <textarea
                              value={editedDisciplineNotes}
                              onChange={(e) => setEditedDisciplineNotes(e.target.value)}
                              className="input w-full bg-gray-600 border-gray-500 text-white text-sm"
                              rows={2}
                           />
                           <div className="flex justify-end gap-2">
                              <button onClick={handleCancelDisciplineEdit} className="text-gray-400 hover:text-white p-0.5" title="Cancel Edit">
                                <FaTimes size="0.8rem" />
                              </button>
                              <button onClick={handleSaveDisciplineEdit} disabled={isSubmitting} className="text-green-500 hover:text-green-400 p-0.5" title="Save Edit">
                                <FaSave size="0.8rem" />
                              </button>
                           </div>
                        </div>
                      ) : (
                        // --- Discipline Display ---
                        <div
                          key={entry.id}
                          className="p-2 border border-gray-600 rounded bg-gray-700/50 text-sm relative group"
                        >
                          <p className="text-gray-300 font-semibold uppercase">
                            {entry.type}
                          </p>
                          <p className="text-gray-300 truncate">
                            {entry.disciplinenotes}
                          </p>
                          <small className="text-gray-400 text-xs block">
                            By: {entry.issuedby} on{" "}
                            {formatIssuedAt(entry.issueddate, entry.issuedtime)}
                          </small>
                          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!editingTaskEntry && !editingDisciplineEntry && !editingNoteEntry && ( // Only show if no other item is being edited
                              <button
                                onClick={() => handleStartDisciplineEdit(entry)} // Use new handler
                                className="text-yellow-400 hover:text-yellow-300 p-0.5"
                                title="Edit Entry"
                              >
                                <FaEdit size="0.75rem" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteDiscipline(entry.id)}
                              className="text-red-500 hover:text-red-400 p-0.5"
                              title="Delete Entry"
                            >
                              <FaTrash size="0.75rem" />
                            </button>
                          </div>
                        </div>
                      )
                    ))
                  ) : (
                    <p className="text-gray-500 italic text-sm">
                      No discipline entries.
                    </p>
                  )}
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-semibold text-yellow-400 border-b border-yellow-600 pb-1 flex-grow">
                    General Notes ({notes.length})
                  </h3>
                  <button
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        showAddNote: !prev.showAddNote,
                      }))
                    }
                    className="button-secondary text-xs ml-4 px-2 py-1 flex items-center gap-1"
                  >
                    <FaPlus /> Add Note
                  </button>
                </div>
                {formData.showAddNote && (
                  <div className="p-3 border border-yellow-600 rounded bg-black mb-4 space-y-2">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Enter note..."
                      className="input w-full bg-black border border-yellow-600 text-white"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            showAddNote: false,
                          }))
                        }
                        className="button-secondary text-xs px-2 py-1"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddNote}
                        className="button-primary text-xs px-2 py-1"
                      >
                        Add Note
                      </button>
                    </div>
                  </div>
                )}
                <div className="space-y-2 max-h-[calc(60vh)] overflow-y-auto custom-scrollbar pr-1">
                  {notes.length > 0 ? (
                    notes.map((note) => (
                      // --- Note Item ---
                      editingNoteEntry?.id === note.id ? (
                        // --- Note Edit Form ---
                        <div key={note.id} className="p-2 border border-yellow-500 rounded bg-gray-700 space-y-1">
                           <textarea
                              value={editedNoteText}
                              onChange={(e) => setEditedNoteText(e.target.value)}
                              className="input w-full bg-gray-600 border-gray-500 text-white text-sm"
                              rows={3}
                           />
                           <div className="flex justify-end gap-2">
                              <button onClick={handleCancelNoteEdit} className="text-gray-400 hover:text-white p-0.5" title="Cancel Edit">
                                <FaTimes size="0.8rem" />
                              </button>
                              <button onClick={handleSaveNoteEdit} disabled={isSubmitting} className="text-green-500 hover:text-green-400 p-0.5" title="Save Edit">
                                <FaSave size="0.8rem" />
                              </button>
                           </div>
                        </div>
                      ) : (
                        // --- Note Display ---
                        <div
                          key={note.id}
                          className="p-2 border border-gray-600 rounded bg-gray-700/50 text-sm relative group"
                        >
                          <p className="text-gray-300 whitespace-pre-wrap">{note.note}</p> {/* Use whitespace-pre-wrap */}
                          <small className="text-gray-400 text-xs block">
                            By: {note.issuedby} on{" "}
                            {formatIssuedAt(note.issueddate, note.issuedtime)}
                          </small>
                          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!editingTaskEntry && !editingDisciplineEntry && !editingNoteEntry && ( // Only show if no other item is being edited
                              <button
                                onClick={() => handleStartNoteEdit(note)} // Use new handler
                                className="text-yellow-400 hover:text-yellow-300 p-0.5"
                                title="Edit Note"
                              >
                                <FaEdit size="0.75rem" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="text-red-500 hover:text-red-400 p-0.5"
                              title="Delete Note"
                            >
                              <FaTrash size="0.75rem" />
                            </button>
                          </div>
                        </div>
                      )
                    ))
                  ) : (
                    <p className="text-gray-500 italic text-sm">No notes.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Assigned Vehicle Tab */}
          {activeTab === "vehicle" && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-yellow-400 mb-3">
                Assigned Vehicle
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Assigned Vehicle Plate
                </label>
                <select
                  name="assignedVehicleId"
                  value={formData.assignedVehicleId || ""}
                  onChange={handleInputChange}
                  className="input w-full bg-gray-700 border-gray-600 text-white"
                >
                  <option value="">-- Select a Plate --</option>
                  {fleetPlates.map((plate) => (
                    <option key={plate} value={plate}>
                      {plate}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="button-primary w-full mt-4"
                onClick={handleSaveRosterInfo} // Changed this to save roster info which includes vehicle
                disabled={isSaving}
              >
                {/* Changed button text for clarity */}
                {isSaving ? "Saving..." : "Save Vehicle Assignment"}
              </button>
            </div>
          )}

          {/* Certifications & Divisions Tab */}
          {activeTab === "certifications" && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-yellow-400 mb-3">
                Certifications & Divisions
              </h3>
              {/* Iterate over ALL_CERTIFICATION_KEYS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                {ALL_CERTIFICATION_KEYS.map((certKey) => {
                  const isRestricted = restrictedCertKeys.includes(certKey.toUpperCase());
                  return (
                    <div key={certKey} className="flex items-center gap-2">
                      <label className="text-sm text-gray-300 w-20 shrink-0 truncate" title={certKey}>
                        {certKey}
                      </label>
                      <select
                        value={formData.certifications[certKey] || ""}
                        onChange={(e) =>
                          handleCertificationChange(certKey, e.target.value || null)
                        }
                        className="input bg-gray-700 border-gray-600 text-white text-xs flex-grow"
                      >
                        <option value="">None</option>
                        {/* Conditional options based on restriction */}
                        {isRestricted ? (
                          <option value="CERT">CERT</option>
                        ) : (
                          <>
                            <option value="LEAD">LEAD</option>
                            <option value="SUPER">SUPER</option>
                            <option value="CERT">CERT</option>
                            <option value="TRAIN">TRAIN</option>
                          </>
                        )}
                      </select>
                    </div>
                  );
                })}
              </div>
              <button
                className="button-primary w-full mt-4"
                onClick={handleSaveCertifications}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Certifications"}
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer (Close Button) */}
        <div className="mt-8 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="button-secondary px-4 py-2"
            disabled={isSaving}
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmationModal?.show && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[60]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gray-800 text-white p-6 rounded shadow-lg space-y-4">
            <p className="text-lg">{confirmationModal.message}</p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setConfirmationModal(null)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
              >
                Cancel
              </button>
              <button
                onClick={confirmationModal.onConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditUserModal;

function getCurrentDateTimeStrings(): { date: string; time: string } {
  const now = new Date();
  const date = now.toLocaleDateString("en-US"); // Format: MM/DD/YYYY
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true, // 12-hour format with AM/PM
  });
  return { date, time };
}

