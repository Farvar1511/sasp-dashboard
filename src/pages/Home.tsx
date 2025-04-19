import React, { useState, useEffect } from "react";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  updateDoc,
  orderBy,
  addDoc,
  limit,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase"; // Removed Timestamp
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import Modal from "../components/Modal"; // Import a modal component
import Bulletins from "../components/Bulletins"; // Import Bulletins component
import {
  RosterUser,
  FleetVehicle as Vehicle,
  UserTask,
  DisciplineEntry,
  NoteEntry,
  BulletinEntry, // Import BulletinEntry type
} from "../types/User";
import { CertStatus } from "../types/User";
import { formatIssuedAt, convertFirestoreDate } from "../utils/timeHelpers";
import { toast } from "react-toastify"; // Add toast import
import { QueryConstraint, where as firestoreWhere, WhereFilterOp } from "firebase/firestore";

// Define rank ordering
const rankOrder: { [key: string]: number } = {
  Commissioner: 1,
  "Assistant Deputy Commissioner": 2,
  "Deputy Commissioner": 3,
  "Assistant Commissioner": 4,
  Commander: 5,
  Captain: 6,
  Lieutenant: 7,
  "Staff Sergeant": 8,
  Sergeant: 9,
  Corporal: 10,
  "Trooper First Class": 11,
  Trooper: 12,
  Cadet: 13,
  Unknown: 99,
};

const stripHtmlTags = (html: string): string => {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
};

const MyDashboard: React.FC = () => {
  const { user: authUser, loading: authLoading } = useAuth();
  const [userData, setUserData] = useState<RosterUser | null>(null);
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);
  const [allowedVehicles, setAllowedVehicles] = useState<Vehicle[]>([]);
  const [disciplineEntries, setDisciplineEntries] = useState<DisciplineEntry[]>(
    []
  );
  const [generalNotes, setGeneralNotes] = useState<NoteEntry[]>([]);
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [bulletins, setBulletins] = useState<BulletinEntry[]>([]); // Add state for bulletins
  const [selectedBulletin, setSelectedBulletin] =
    useState<BulletinEntry | null>(null); // State for modal
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Define specific keys for rendering based on user request
  const displayDivisionKeys = ["K9", "SWAT", "CIU", "FTO"]; // Divisions
  const displayCertificationKeys = ["HEAT", "MBU", "ACU"]; // Certifications

  const formatCreatedAt = (timestamp: any): string => {
    const date = timestamp.toDate();
    const options: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York",
    };
    const time = date.toLocaleTimeString("en-US", options);
    const formattedDate = `${time} EST ${
      date.getMonth() + 1
    }/${date.getDate()}/${date.getFullYear()}`;
    return formattedDate;
  };

  // Task Handlers
  const handleToggleCompleteTask = async (
    taskId: string,
    currentCompletedStatus: boolean
  ) => {
    if (!authUser?.email) {
      console.error("User email is missing.");
      toast.error("User email is missing.");
      return;
    }
    try {
      console.debug(`Searching for task with ID: ${taskId}`);
      const tasksCollectionRef = collection(dbFirestore, "users", authUser.email, "tasks");
      const taskQuery = query(tasksCollectionRef, where("id", "==", taskId)); // Use Firestore's where function
      const taskSnapshot = await getDocs(taskQuery);

      if (taskSnapshot.empty) {
        console.warn(`Task with ID ${taskId} does not exist.`);
        toast.error("Task does not exist or was already deleted.");
        return;
      }

      const taskDoc = taskSnapshot.docs[0]; // Get the first matching document
      const newCompletedStatus = !currentCompletedStatus;
      console.debug(`Updating task ${taskDoc.id} completed status to: ${newCompletedStatus}`);
      await updateDoc(taskDoc.ref, { completed: newCompletedStatus });

      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId ? { ...t, completed: newCompletedStatus } : t
        )
      );
      toast.success("Task status updated successfully.");
    } catch (error) {
      console.error("Error toggling task completion:", error);
      toast.error(
        `Failed to update task status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleAdjustProgress = async (taskId: string, adjustment: number) => {
    if (!authUser?.email) {
      console.error("User email is missing.");
      toast.error("User email is missing.");
      return;
    }
    try {
      console.debug(`Searching for task with ID: ${taskId}`);
      const tasksCollectionRef = collection(dbFirestore, "users", authUser.email, "tasks");
      const taskQuery = query(tasksCollectionRef, where("id", "==", taskId));
      const taskSnapshot = await getDocs(taskQuery);

      if (taskSnapshot.empty) {
        console.warn(`Task with ID ${taskId} does not exist.`);
        toast.error("Task does not exist or was already deleted.");
        return;
      }

      const taskDoc = taskSnapshot.docs[0]; // Get the first matching document
      const taskData = taskDoc.data() as UserTask;

      if (taskData.type !== "goal" || taskData.goal == null) {
        console.warn(`Cannot adjust progress for task ID: ${taskId}`);
        toast.error("Cannot adjust progress for this task.");
        return;
      }

      const currentProgress = taskData.progress || 0;
      const newProgress = Math.min(
        taskData.goal,
        Math.max(0, currentProgress + adjustment)
      );
      console.debug(`Adjusting progress for task ${taskDoc.id}: ${currentProgress} -> ${newProgress}`);
      await updateDoc(taskDoc.ref, { progress: newProgress });

      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId ? { ...t, progress: newProgress } : t
        )
      );
      toast.success("Task progress updated successfully.");
    } catch (error) {
      console.error("Error adjusting task progress:", error);
      toast.error("Failed to update task progress.");
    }
  };

  const handleAddBulletin = async (title: string, content: string) => {
    if (!authUser || !authUser.name || !authUser.rank) {
      toast.error("Could not identify user. Please log in again.");
      return;
    }

    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required.");
      return;
    }

    try {
      const now = new Date();
      const createdAt = now.toISOString(); // Use ISO string for timestamp

      await addDoc(collection(dbFirestore, "bulletins"), {
        title: title.trim(),
        content: content.trim(),
        postedByName: authUser.name,
        postedByRank: authUser.rank,
        createdAt, // Store the timestamp
      });

      toast.success("Bulletin added successfully!");
      // Optionally, refresh bulletins or reset form state here
    } catch (error) {
      console.error("Error adding bulletin:", error);
      toast.error(
        `Failed to add bulletin: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Fetch Dashboard Data
  useEffect(() => {
    const fetchData = async () => {
      if (!authUser || !authUser.email) {
        setLoading(false);
        setError("Authentication error or user email missing.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // User Data
        const userDocRef = doc(dbFirestore, "users", authUser.email);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
          throw new Error("User data not found in Firestore.");
        }
        const parsedUser = {
          id: userDocSnap.id,
          ...userDocSnap.data(),
        } as RosterUser;
        setUserData(parsedUser);

        // Tasks
        const tasksCollectionRef = collection(
          dbFirestore,
          "users",
          authUser.email,
          "tasks"
        );
        const tasksQuery = query(
          tasksCollectionRef,
          orderBy("issueddate", "desc")
        );
        const tasksSnapshot = await getDocs(tasksQuery);
        setTasks(
          tasksSnapshot.docs
            .map((doc) => {
              const data = doc.data();
              if (
                typeof data.task === "string" &&
                (data.type === "goal" || data.type === "normal") &&
                typeof data.issuedby === "string" &&
                typeof data.issueddate === "string" &&
                typeof data.issuedtime === "string" &&
                typeof data.completed === "boolean" &&
                (data.type === "goal"
                  ? typeof data.progress === "number"
                  : true)
              ) {
                return { id: doc.id, ...data } as UserTask;
              }
              return null;
            })
            .filter((task): task is UserTask => task !== null)
        );

        // Discipline Entries
        const disciplineCollectionRef = collection(
          dbFirestore,
          "users",
          authUser.email,
          "discipline"
        );
        const disciplineQuery = query(
          disciplineCollectionRef,
          orderBy("issueddate", "desc")
        );
        const disciplineSnapshot = await getDocs(disciplineQuery);
        setDisciplineEntries(
          disciplineSnapshot.docs
            .map((doc) => {
              const data = doc.data();
              if (
                typeof data.type === "string" &&
                typeof data.disciplinenotes === "string" &&
                typeof data.issuedby === "string" &&
                typeof data.issueddate === "string" &&
                typeof data.issuedtime === "string"
              ) {
                return {
                  id: doc.id,
                  type: data.type,
                  disciplinenotes: data.disciplinenotes,
                  issuedby: data.issuedby,
                  issueddate: data.issueddate,
                  issuedtime: data.issuedtime,
                } as DisciplineEntry;
              }
              return null;
            })
            .filter((entry): entry is DisciplineEntry => entry !== null)
        );

        // Notes
        const notesQuery = query(
          collection(dbFirestore, "users", authUser.email, "notes"),
          orderBy("issueddate", "desc")
        );
        const notesSnap = await getDocs(notesQuery);
        setGeneralNotes(
          notesSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as NoteEntry[]
        );

        // Fetch Bulletins
        const bulletinsCollectionRef = collection(dbFirestore, "bulletins");
        const bulletinsQuery = query(
          bulletinsCollectionRef,
          orderBy("createdAt", "desc"),
          limit(2) // Fetch only the most recent 2 bulletins
        );
        const bulletinsSnapshot = await getDocs(bulletinsQuery);
        setBulletins(
          bulletinsSnapshot.docs.map((doc) => {
            const data = doc.data();
            const contentLines = (data.content || "").split("\n");
            return {
              id: doc.id,
              title: data.title || "Untitled",
              content: data.content || "No content available.",
              contentPreview: contentLines[0] || "No content available.",
              contentFull: data.content || "No content available.",
              postedByName: data.postedByName || "Unknown",
              postedByRank: data.postedByRank || "Unknown",
              createdAt: data.createdAt, // Firestore timestamp
            };
          }) as BulletinEntry[]
        );

        // Vehicles
        const vehicleSnap = await getDocs(collection(dbFirestore, "fleet"));
        const allVehicles = vehicleSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Vehicle[];

        // Determine Assigned Vehicle
        let assigned: Vehicle | null = null;
        const userNameUpper = parsedUser.name.toUpperCase();
        const nameParts = parsedUser.name.split(" ").filter(Boolean);
        let initialLast = "";
        if (nameParts.length >= 2) {
          initialLast = `${nameParts[0].charAt(0).toUpperCase()}. ${
            nameParts[nameParts.length - 1]
          }`.toUpperCase();
        }
        assigned =
          allVehicles.find(
            (v) => v.assignee?.toUpperCase() === userNameUpper
          ) || null;
        if (!assigned && initialLast) {
          assigned =
            allVehicles.find(
              (v) => v.assignee?.toUpperCase() === initialLast
            ) || null;
        }
        if (!assigned && parsedUser.assignedVehicleId) {
          assigned =
            allVehicles.find((v) => v.id === parsedUser.assignedVehicleId) ||
            null;
        }
        setAssignedVehicle(assigned);

        // Determine allowed communal vehicles
        const rankValue = rankOrder[parsedUser.rank] ?? rankOrder.Unknown;
        const userCerts = parsedUser.certifications || {};
        const hasCertAccess = (requiredCertKey: string | null): boolean => {
          if (!requiredCertKey) return true;
          const status = userCerts[requiredCertKey.toUpperCase()];
          return ["CERT", "SUPER", "LEAD", "TRAIN"].includes(
            (status || "").toUpperCase()
          );
        };
        const allowed = allVehicles.filter((v) => {
          if (
            v.assignee &&
            v.assignee !== "COMMUNAL" &&
            v.id !== assigned?.id
          ) {
            return false;
          }
          if (!v.inService) {
            return false;
          }
          const restrictions = (v.restrictions || "").toLowerCase();
          // Calculate canonical division: treat MOTO as MBU
          let division = (v.division || "").toUpperCase();
          if (division === "MOTO") {
            division = "MBU"; // Connect MOTO division to MBU cert logic
          }
          let requiredRankLevel = Infinity;
          if (restrictions.includes("high command"))
            requiredRankLevel = rankOrder.Commander;
          else if (restrictions.includes("command"))
            requiredRankLevel = rankOrder.Lieutenant;
          else if (restrictions.includes("supervisor"))
            requiredRankLevel = rankOrder.Sergeant;
          if (rankValue > requiredRankLevel) {
            return false;
          }
          let requiredCertKey: string | null = null;
          if (displayDivisionKeys.includes(division)) {
            requiredCertKey = division;
          } else if (displayCertificationKeys.includes(division)) {
            requiredCertKey = division;
          }
          return hasCertAccess(requiredCertKey);
        });
        setAllowedVehicles(allowed);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
        setError(
          `Error loading dashboard: ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        );
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [authUser?.email, authLoading]);

  if (authLoading || loading)
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <p className="text-yellow-400 text-xl">Loading dashboard...</p>
        </div>
      </Layout>
    );

  if (error)
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <p className="text-red-400 text-center text-xl">{error}</p>
        </div>
      </Layout>
    );

  if (!userData)
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <p className="text-red-400 text-center text-xl">
            User data could not be loaded.
          </p>
        </div>
      </Layout>
    );

  return (
    <Layout>
      <div className="relative z-10 space-y-8 px-4 py-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-8 bg-black bg-opacity-85 p-6 rounded-lg shadow-lg">
          <img src="/SASPLOGO2.png" alt="SASP" className="w-24 h-24" />
          <h1 className="text-4xl font-extrabold text-[#f3c700] tracking-tight">
            My Dashboard
          </h1>
          <p className="text-xl text-white">
            Welcome back, {userData.rank} {userData.name}!
          </p>
        </div>

        {/* Trooper Information & Bulletins */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trooper Information */}
          <div className="p-6 bg-black bg-opacity-80 border border-[#f3c700] rounded-xl shadow-lg w-full">
            <h2 className="text-2xl font-extrabold text-[#f3c700] border-b border-white pb-2 mb-4">
              Trooper Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {/* Name */}
              <div className="p-3 bg-black bg-opacity-90 border border-[#f3c700] rounded-lg">
                <span className="text-base font-bold text-[#f3c700]">
                  Name:
                </span>
                <span className="ml-2 text-sm text-white font-semibold">
                  {userData.name}
                </span>
              </div>
              {/* Callsign */}
              <div className="p-3 bg-black bg-opacity-90 border border-[#f3c700] rounded-lg">
                <span className="text-base font-bold text-[#f3c700]">
                  Callsign:
                </span>
                <span className="ml-2 text-sm text-white font-semibold">
                  {userData.callsign || "N/A"}
                </span>
              </div>
              {/* Badge */}
              <div className="p-3 bg-black bg-opacity-90 border border-[#f3c700] rounded-lg">
                <span className="text-base font-bold text-[#f3c700]">
                  Badge:
                </span>
                <span className="ml-2 text-sm text-white font-semibold">
                  {userData.badge || "N/A"}
                </span>
              </div>
              {/* Status */}
              <div className="p-3 bg-black bg-opacity-90 border border-[#f3c700] rounded-lg">
                <span className="text-base font-bold text-[#f3c700]">
                  Status:
                </span>
                <span
                  className={`ml-2 text-xs font-bold px-3 py-1 rounded ${
                    userData.isActive ? "bg-green-600" : "bg-red-600"
                  } text-white`}
                >
                  {userData.isActive ? "Active" : "Inactive / LOA"}
                </span>
              </div>
              {/* Join Date */}
              <div className="p-3 bg-black bg-opacity-90 border border-[#f3c700] rounded-lg">
                <span className="text-base font-bold text-[#f3c700]">
                  Join Date:
                </span>
                <span className="ml-2 text-sm text-white font-semibold">
                  {userData.joinDate
                    ? convertFirestoreDate(String(userData.joinDate))
                    : "N/A"}
                </span>
              </div>
              {/* Last Promotion */}
              <div className="p-3 bg-black bg-opacity-90 border border-[#f3c700] rounded-lg">
                <span className="text-base font-bold text-[#f3c700]">
                  Last Promotion:
                </span>
                <span className="ml-2 text-sm text-white font-semibold">
                  {userData.lastPromotionDate
                    ? convertFirestoreDate(String(userData.lastPromotionDate))
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Bulletins */}
          <div className="p-6 bg-black bg-opacity-80 border border-[#f3c700] rounded-xl shadow-lg w-full">
            <h2 className="text-2xl font-extrabold text-[#f3c700] border-b border-white pb-2 mb-4">
              Recent Bulletins
            </h2>
            {bulletins.length === 0 ? (
              <p className="text-white italic">No bulletins found.</p>
            ) : (
              <div className="space-y-2">
                {bulletins.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBulletin(b)}
                    className="cursor-pointer border border-[#f3c700] rounded-lg p-3 bg-black/90 hover:bg-yellow-600/10 transition"
                  >
                    <h3 className="text-sm font-bold text-[#f3c700] mb-1">
                      {b.title}
                    </h3>
                    <p className="text-xs text-white line-clamp-1">
                      {stripHtmlTags(b.content).slice(0, 100)}...
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Posted by {b.postedByName} ({b.postedByRank}) –{" "}
                      {formatCreatedAt(b.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 text-center">
              <a
                href="/bulletins"
                className="px-4 py-2 bg-[#f3c700] text-black font-bold rounded hover:bg-yellow-300"
              >
                View All Bulletins
              </a>
            </div>
          </div>
        </div>

        {/* Modal for Full Bulletin */}
        {selectedBulletin && (
          <Modal onClose={() => setSelectedBulletin(null)}>
            <div className="p-6 bg-black bg-opacity-90 rounded-lg shadow-lg max-w-7xl w-full max-h-[80vh] overflow-y-auto mx-auto">
              {selectedBulletin ? (
                <Bulletins
                  selectedBulletin={
                    selectedBulletin
                      ? { ...selectedBulletin, createdAt: selectedBulletin.createdAt.toDate() }
                      : undefined
                  }
                />
              ) : (
                <p className="text-white text-center">Loading bulletin...</p>
              )}
            </div>
          </Modal>
        )}

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column Wrapper */}
          <div className="space-y-6">
            {/* Certifications & Divisions */}
            <div className="p-6 bg-black bg-opacity-80 border border-[#f3c700] rounded-xl shadow-lg w-full">
              <h2 className="text-2xl font-extrabold text-[#f3c700] border-b border-white pb-2 mb-4">
                Certifications & Divisions
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Certifications */}
                <div className="p-3 bg-black bg-opacity-90 border border-[#f3c700] rounded-lg">
                  <h3 className="text-lg font-semibold text-[#f3c700] mb-2 border-b border-white pb-2">
                    Certifications
                  </h3>
                  {displayCertificationKeys.map((key) => {
                    const status =
                      userData.certifications?.[key.toUpperCase()] ?? null;
                    return (
                      <div
                        key={key}
                        className="flex justify-between items-center py-1"
                      >
                        <span className="text-[#f3c700]">{key}:</span>
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded ${
                            status === "LEAD"
                              ? "bg-blue-600"
                              : status === "SUPER"
                              ? "bg-orange-500"
                              : status === "CERT"
                              ? "bg-green-600"
                              : status === "TRAIN"
                              ? "bg-orange-600" 
                              : "bg-gray-800 text-gray-400"
                          } text-white`}
                        >
                          {status || "None"}
                        </span>
                      </div>
                    );
                  })}
                  {displayCertificationKeys.length === 0 && (
                    <p className="text-white italic text-sm">
                      No certifications held.
                    </p>
                  )}
                </div>

                {/* Divisions */}
                <div className="p-3 bg-black bg-opacity-90 border border-[#f3c700] rounded-lg">
                  <h3 className="text-lg font-semibold text-[#f3c700] mb-2 border-b border-white pb-2">
                    Divisions
                  </h3>
                  {displayDivisionKeys.map((key) => {
                    const status =
                      userData.certifications?.[key.toUpperCase()] ?? null;
                    return (
                      <div
                        key={key}
                        className="flex justify-between items-center py-1"
                      >
                        <span className="text-[#f3c700]">{key}:</span>
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded ${
                            status === "LEAD"
                              ? "bg-blue-600"
                              : status === "SUPER"
                              ? "bg-orange-500"
                              : status === "CERT"
                              ? "bg-green-600"
                              : status === "TRAIN"
                              ? "bg-orange-600"
                              : "bg-gray-800 text-gray-400"
                          } text-white`}
                        >
                          {status || "None"}
                        </span>
                      </div>
                    );
                  })}
                  {displayDivisionKeys.length === 0 && (
                    <p className="text-white italic text-sm">
                      No divisional assignments.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Discipline */}
            <div className="p-5 bg-black bg-opacity-80 border border-[#f3c700] rounded-lg shadow-lg flex flex-col items-center text-center">
              <h2 className="section-header text-xl font-bold mb-4 text-[#f3c700] border-b-2 border-white pb-2">
                Discipline
              </h2>
              <div className="flex-grow overflow-y-auto custom-scrollbar space-y-4 pr-2 max-h-60 w-full">
                {disciplineEntries.length > 0 ? (
                  disciplineEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="text-xs text-white bg-black bg-opacity-90 border border-[#f3c700] px-3 py-2 rounded"
                    >
                      <p
                        className={`font-semibold uppercase text-[10px] ${getNoteTypeColor(
                          entry.type
                        )}`}
                      >
                        {entry.type}
                      </p>
                      <p className="text-[11px] text-white mt-1">
                        {entry.disciplinenotes}
                      </p>
                      <small className="text-[10px] text-yellow-400 block mt-1">
                        By: {entry.issuedby} on{" "}
                        {formatIssuedAt(entry.issueddate, entry.issuedtime)}
                      </small>
                    </div>
                  ))
                ) : (
                  <p className="text-white italic text-xs">
                    No discipline entries on file.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Assigned Tasks */}
          <div className="p-5 bg-black bg-opacity-80 border border-[#f3c700] rounded-lg shadow-lg flex flex-col items-center text-center">
            <h2 className="section-header text-xl font-bold mb-4 text-[#f3c700] border-b-2 border-white pb-2">
              Assigned Tasks
            </h2>
            {tasks.length > 0 ? (
              <div className="flex-grow overflow-y-auto custom-scrollbar space-y-3 pr-2 max-h-[calc(100vh-300px)] w-full">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 bg-black bg-opacity-90 border border-[#f3c700] rounded-lg shadow-sm text-left"
                  >
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                      <div className="flex-grow">
                        <p
                          className={`text-sm font-medium ${
                            task.completed
                              ? "line-through text-gray-500"
                              : "text-white"
                          }`}
                        >
                          {task.task}
                        </p>
                        {task.type === "goal" && (
                          <p className="text-xs text-white mt-0.5">
                            Progress: {task.progress ?? 0} /{" "}
                            {task.goal ?? "N/A"}
                          </p>
                        )}
                        <p className="text-[10px] text-yellow-400 mt-1">
                          Assigned:{" "}
                          {formatIssuedAt(task.issueddate, task.issuedtime)} by{" "}
                          {task.issuedby}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
                        {task.type === "goal" && !task.completed && (
                          <>
                            <button
                              onClick={() => handleAdjustProgress(task.id, 1)}
                              className="px-1.5 py-0.5 bg-[#f3c700] text-black rounded hover:bg-yellow-300 text-xs font-bold"
                              title="Increase Progress"
                            >
                              +
                            </button>
                            <button
                              onClick={() => handleAdjustProgress(task.id, -1)}
                              className="px-1.5 py-0.5 bg-[#f3c700] text-black rounded hover:bg-yellow-300 text-xs font-bold"
                              title="Decrease Progress"
                              disabled={(task.progress ?? 0) <= 0}
                            >
                              -
                            </button>
                          </>
                        )}
                        <button
                          onClick={() =>
                            handleToggleCompleteTask(task.id, task.completed)
                          }
                          className={`px-2.5 py-1 ${
                            task.completed
                              ? "bg-red-600 hover:bg-red-500"
                              : "bg-green-600 hover:bg-green-500"
                          } text-white rounded text-xs font-semibold`}
                          disabled={
                            task.type === "goal" &&
                            !task.completed &&
                            (task.progress ?? 0) < (task.goal ?? Infinity)
                          }
                          title={
                            task.type === "goal" &&
                            !task.completed &&
                            (task.progress ?? 0) < (task.goal ?? Infinity)
                              ? "Progress must reach goal"
                              : task.completed
                              ? "Mark Incomplete"
                              : "Mark Complete"
                          }
                        >
                          {task.completed ? "Undo" : "Done"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white italic text-sm flex-grow flex items-center justify-center">
                No assigned tasks.
              </p>
            )}
          </div>
        </div>

        {/* Assigned Vehicle */}
        <div className="p-5 bg-black bg-opacity-80 border border-[#f3c700] rounded-lg shadow-lg flex flex-col items-center text-center">
          <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700] border-b-2 border-white pb-2">
            Assigned Vehicle
          </h2>
          {assignedVehicle ? (
            <p className="text-white">
              {assignedVehicle.vehicle} ({assignedVehicle.plate})
            </p>
          ) : (
            <p className="text-white italic">No vehicle assigned.</p>
          )}
        </div>

        {/* Allowed Vehicles */}
        <div className="p-5 bg-black bg-opacity-80 border border-[#f3c700] rounded-lg shadow-lg flex flex-col items-center text-center">
          <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700] border-b-2 border-white pb-2">
            Allowed Vehicles
          </h2>
          {allowedVehicles.length > 0 ? (
            <div className="overflow-x-auto custom-scrollbar max-h-80 w-full">
              <table className="min-w-full text-sm text-center">
                <thead className="text-xs text-[#f3c700] uppercase bg-black bg-opacity-90 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2">Vehicle</th>
                    <th className="px-4 py-2">Plate</th>
                    <th className="px-4 py-2">Division</th>
                    <th className="px-4 py-2">Restrictions</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  {allowedVehicles.map((v) => (
                    <tr
                      key={v.id}
                      className="border-b border-gray-700 hover:bg-black bg-opacity-90 transition-colors duration-150"
                    >
                      <td className="px-4 py-2 text-white font-medium">
                        {v.vehicle}
                      </td>
                      <td className="px-4 py-2 font-mono">{v.plate || "-"}</td>
                      <td className="px-4 py-2">{v.division || "-"}</td>
                      <td className="px-4 py-2">{v.restrictions || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-white italic">
              No specific vehicles allowed based on rank/certifications.
              Standard patrol vehicles may be available.
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
};

// Helper: determine the color for note type text
const getNoteTypeColor = (type: string | undefined): string => {
  switch (type?.toLowerCase()) {
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
      return "text-white";
  }
};

// Helper: get certification style
const getCertStyle = (status: CertStatus | null) => {
  switch (status) {
    case "LEAD":
      return { bgColor: "bg-blue-600", textColor: "text-white" };
    case "SUPER":
      return { bgColor: "bg-orange-500", textColor: "text-white" };
    case "CERT":
      return { bgColor: "bg-green-600", textColor: "text-white" };
    case "TRAIN":
      return { bgCOlor: "bg-orange-600", textColor: "text-white"};
    default:
      return { bgColor: "bg-gray-800", textColor: "text-gray-400" };
  }
};

export default MyDashboard;
function where(fieldPath: string, opStr: WhereFilterOp, value: unknown): QueryConstraint {
  return firestoreWhere(fieldPath, opStr, value);
}

