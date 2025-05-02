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
import { db as dbFirestore } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import Bulletins from "../components/Bulletins";
import {
  RosterUser,
  FleetVehicle as Vehicle,
  UserTask,
  DisciplineEntry,
  NoteEntry,
  BulletinEntry,
} from "../types/User";
import { CertStatus } from "../types/User";
import { formatIssuedAt, convertFirestoreDate } from "../utils/timeHelpers";
import { toast } from "react-toastify";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

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

// Helper function for time-based greeting
const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Good morning";
  } else if (hour < 17) {
    return "Good afternoon";
  } else {
    return "Good evening";
  }
};

// Helper function to format name as "F. Last"
const formatName = (fullName: string): string => {
  if (!fullName) return "";
  const parts = fullName.trim().split(" ");
  if (parts.length >= 2) {
    const firstNameInitial = parts[0].charAt(0).toUpperCase();
    const lastName = parts[parts.length - 1];
    return `${firstNameInitial}. ${lastName}`;
  }
  return fullName; // Fallback to full name if format is unexpected
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
  const [bulletins, setBulletins] = useState<BulletinEntry[]>([]);
  const [selectedBulletin, setSelectedBulletin] =
    useState<BulletinEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayDivisionKeys = ["K9", "SWAT", "CIU", "FTO"];
  const displayCertificationKeys = ["HEAT", "MBU", "ACU"];

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

  const handleToggleCompleteTask = async (
    taskId: string,
    currentCompletedStatus: boolean | undefined
  ) => {
    if (!authUser?.email) {
      console.error("User email is missing.");
      toast.error("User email is missing.");
      return;
    }
    try {
      console.debug(`Attempting to update task with ID: ${taskId}`);

      const taskDocRef = doc(
        dbFirestore,
        "users",
        authUser.email,
        "tasks",
        taskId
      );
      const taskDocSnap = await getDoc(taskDocRef);

      if (!taskDocSnap.exists()) {
        console.warn(`Task with ID ${taskId} does not exist.`);

        toast.error("Task not found. It might have been deleted.");
        setTasks((prevTasks) => prevTasks.filter((t) => t.id !== taskId));
        return;
      }

      const newCompletedStatus = !(currentCompletedStatus ?? false);
      console.debug(
        `Updating task ${taskDocRef.id} completed status to: ${newCompletedStatus}`
      );

      await updateDoc(taskDocRef, { completed: newCompletedStatus });

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
      console.debug(`Attempting to adjust progress for task with ID: ${taskId}`);

      const taskDocRef = doc(
        dbFirestore,
        "users",
        authUser.email,
        "tasks",
        taskId
      );
      const taskDocSnap = await getDoc(taskDocRef);

      if (!taskDocSnap.exists()) {
        console.warn(`Task with ID ${taskId} does not exist.`);
        toast.error("Task not found. It might have been deleted.");
        setTasks((prevTasks) => prevTasks.filter((t) => t.id !== taskId));
        return;
      }

      const taskData = taskDocSnap.data() as UserTask;

      if (taskData.type !== "goal" || taskData.goal == null) {
        console.warn(`Cannot adjust progress for task ID: ${taskId}`);
        toast.error("Cannot adjust progress for this task type.");
        return;
      }

      const currentProgress = taskData.progress || 0;
      const newProgress = Math.min(
        taskData.goal,
        Math.max(0, currentProgress + adjustment)
      );
      console.debug(
        `Adjusting progress for task ${taskDocRef.id}: ${currentProgress} -> ${newProgress}`
      );
      await updateDoc(taskDocRef, { progress: newProgress });

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
      const createdAt = now.toISOString();

      await addDoc(collection(dbFirestore, "bulletins"), {
        title: title.trim(),
        content: content.trim(),
        postedByName: authUser.name,
        postedByRank: authUser.rank,
        createdAt,
      });

      toast.success("Bulletin added successfully!");
    } catch (error) {
      console.error("Error adding bulletin:", error);
      toast.error(
        `Failed to add bulletin: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

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
                data.archived !== true
              ) {
                return {
                  id: doc.id,
                  task: data.task,
                  type: data.type,
                  issuedby: data.issuedby,
                  issueddate: data.issueddate,
                  issuedtime: data.issuedtime,
                  completed:
                    typeof data.completed === "boolean" ? data.completed : false,
                  progress:
                    data.type === "goal"
                      ? typeof data.progress === "number"
                        ? data.progress
                        : 0
                      : undefined,
                  goal:
                    data.type === "goal"
                      ? typeof data.goal === "number"
                        ? data.goal
                        : undefined
                      : undefined,
                  archived: data.archived ?? false,
                } as UserTask;
              }
              console.warn("Skipping invalid or archived task data:", doc.id, data);
              return null;
            })
            .filter((task): task is UserTask => task !== null)
        );

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

        const bulletinsCollectionRef = collection(dbFirestore, "bulletins");
        const bulletinsQuery = query(
          bulletinsCollectionRef,
          orderBy("createdAt", "desc"),
          limit(2)
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
              createdAt: data.createdAt,
            };
          }) as BulletinEntry[]
        );

        const vehicleSnap = await getDocs(collection(dbFirestore, "fleet"));
        const allVehicles = vehicleSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Vehicle[];

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

        const rankValue = rankOrder[parsedUser.rank] ?? rankOrder.Unknown;
        const userCerts = parsedUser.certifications || {};
        const hasCertAccess = (requiredCertKey: string | null): boolean => {
          if (!requiredCertKey) return true;
          const status = userCerts[requiredCertKey.toUpperCase()];
          return ["CERT", "SUPER", "LEAD", "TRAIN"].includes(
            (status || "").toUpperCase()
          );
        };

        let allowed: Vehicle[] = [];
        if (parsedUser.rank !== "Cadet") {
          allowed = allVehicles.filter((v) => {
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

            let division = (v.division || "").toUpperCase();
            if (division === "MOTO") {
              division = "MBU";
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
        }
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
          <p className="text-yellow-400 text-xl bg-black/50 p-4 rounded">
            Loading dashboard...
          </p>
        </div>
      </Layout>
    );

  if (error)
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <p className="text-red-400 text-center text-xl bg-black/50 p-4 rounded">
            {error}
          </p>
        </div>
      </Layout>
    );

  if (!userData)
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <p className="text-red-400 text-center text-xl bg-black/50 p-4 rounded">
            User data could not be loaded.
          </p>
        </div>
      </Layout>
    );

  return (
    <Layout>
      <div className="relative z-10 space-y-6 sm:space-y-8 px-2 sm:px-4 py-6 sm:py-8 mx-auto max-w-7xl">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6 bg-black bg-opacity-85 p-4 rounded-lg shadow-lg">
          <img
            src="/SASPLOGO2.png"
            alt="SASP"
            className="w-12 h-12 sm:w-16 sm:h-16"
          />
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-[#f3c700] tracking-tight">
              My Dashboard
            </h1>
            <p className="text-lg text-white">
              {getGreeting()}, {userData.rank} {formatName(userData.name)}!
            </p>
          </div>
        </div>

        {/* === TOP ROW: TROOPER INFO + BULLETINS (equal height) === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 auto-rows-fr">
          <Card className="border border-[#f3c700] shadow-lg w-full text-white h-full flex flex-col">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xl sm:text-2xl font-extrabold text-[#f3c700] border-b border-white pb-2">
                Trooper Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-4 flex-grow">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-black bg-opacity-90 border border-[#f3c700] rounded-lg">
                  <span className="text-base font-bold text-[#f3c700]">
                    Name:
                  </span>
                  <span className="ml-2 text-sm text-white font-semibold">
                    {userData.name}
                  </span>
                </div>
                <div className="p-3 bg-black bg-opacity-90 border border-[#f3c700] rounded-lg">
                  <span className="text-base font-bold text-[#f3c700]">
                    Callsign:
                  </span>
                  <span className="ml-2 text-sm text-white font-semibold">
                    {userData.callsign || "N/A"}
                  </span>
                </div>
                <div className="p-3 bg-black bg-opacity-90 border border-[#f3c700] rounded-lg">
                  <span className="text-base font-bold text-[#f3c700]">
                    Badge:
                  </span>
                  <span className="ml-2 text-sm text-white font-semibold">
                    {userData.badge || "N/A"}
                  </span>
                </div>
                <div className="p-3 bg-black bg-opacity-90 border border-[#f3c700] rounded-lg">
                  <span className="text-base font-bold text-[#f3c700]">
                    Status:
                  </span>
                  <Badge
                    variant={userData.isActive ? "default" : "destructive"}
                    className={`ml-2 text-xs font-bold ${
                      userData.isActive
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-red-600 hover:bg-red-700"
                    } text-white border-none`}
                  >
                    {userData.isActive ? "Active" : "Inactive / LOA"}
                  </Badge>
                </div>
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
            </CardContent>
          </Card>

          <Card className="border border-[#f3c700] rounded-xl shadow-lg w-full text-white h-full flex flex-col">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xl sm:text-2xl font-extrabold text-[#f3c700] border-b border-white pb-2">
                Recent Bulletins
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-4 flex flex-col flex-grow">
              <div className="flex-grow">
                {bulletins.length === 0 ? (
                  <p className="text-white italic flex items-center justify-center h-full">
                    No bulletins found.
                  </p>
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
              </div>
              <div className="mt-4 text-center">
                <Button
                  asChild
                  variant="default"
                  className="bg-[#f3c700] text-black hover:bg-yellow-300"
                >
                  <a href="/bulletins">View All Bulletins</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* === SECOND ROW: SPECIALIZATIONS & ASSIGNED TASKS (equal height) === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 auto-rows-fr">
          <Card className="border border-[#f3c700] shadow-lg w-full text-white h-full flex flex-col">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xl sm:text-2xl font-extrabold text-[#f3c700] border-b border-white pb-2">
                Certifications and Divisions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-4 flex flex-col flex-grow space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-3 bg-black bg-opacity-90 border border-[#f3c700] rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2 border-b border-white pb-2">
                    Certifications
                  </h3>
                  {displayCertificationKeys.map((key) => {
                    const status =
                      userData.certifications?.[key.toUpperCase()] ?? null;
                    const { badgeClass } = getCertBadgeStyle(status);
                    return (
                      <div
                        key={key}
                        className="flex justify-between items-center py-1"
                      >
                        <span className="text-[#f3c700]">{key}:</span>
                        <Badge
                          variant="secondary"
                          className={`text-xs font-bold text-white border-none ${badgeClass}`}
                        >
                          {status || "None"}
                        </Badge>
                      </div>
                    );
                  })}
                  {displayCertificationKeys.length === 0 && (
                    <p className="text-white italic text-sm">
                      No certifications held.
                    </p>
                  )}
                </div>

                <div className="p-3 bg-black bg-opacity-90 border border-[#f3c700] rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2 border-b border-white pb-2">
                    Divisions
                  </h3>
                  {displayDivisionKeys.map((key) => {
                    const status =
                      userData.certifications?.[key.toUpperCase()] ?? null;
                    const { badgeClass } = getCertBadgeStyle(status);
                    return (
                      <div
                        key={key}
                        className="flex justify-between items-center py-1"
                      >
                        <span className="text-[#f3c700]">{key}:</span>
                        <Badge
                          variant="secondary"
                          className={`text-xs font-bold text-white border-none ${badgeClass}`}
                        >
                          {status || "None"}
                        </Badge>
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

              <div className="pt-4 border-t border-white flex flex-col flex-grow">
                <h3 className="text-lg font-semibold text-[#f3c700] mb-2 border-b border-white pb-2 flex-shrink-0">
                  Discipline
                </h3>
                <div className="overflow-y-auto custom-scrollbar space-y-3 pr-2 w-full flex-grow">
                  {disciplineEntries.length > 0 ? (
                    disciplineEntries.map((entry) => {
                      const noteColorClass = getNoteTypeColorClass(entry.type);
                      return (
                        <div
                          key={entry.id}
                          className="text-xs text-white bg-black bg-opacity-90 border border-[#f3c700] px-3 py-2 rounded text-left"
                        >
                          <Badge
                            variant="outline"
                            className={`font-semibold uppercase text-[10px] mb-1 border-none ${noteColorClass}`}
                          >
                            {entry.type}
                          </Badge>
                          <p className="text-[11px] text-white mt-1">
                            {entry.disciplinenotes}
                          </p>
                          <small className="text-[10px] text-yellow-400 block mt-1">
                            By: {entry.issuedby} on{" "}
                            {formatIssuedAt(entry.issueddate, entry.issuedtime)}
                          </small>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-white italic text-xs">
                      No discipline entries on file.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[#f3c700] rounded-lg shadow-lg flex flex-col items-center text-center text-white h-full flex flex-col">
            <CardHeader className="w-full pb-2 pt-4">
              <CardTitle className="section-header text-xl font-bold text-[#f3c700] border-b-2 border-white pb-2">
                Assigned Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 w-full flex flex-col flex-grow">
              {tasks.length > 0 ? (
                <div className="flex-grow overflow-y-auto custom-scrollbar space-y-3 w-full max-h-72">
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
                            {formatIssuedAt(task.issueddate, task.issuedtime)}{" "}
                            by {task.issuedby}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
                          {task.type === "goal" && !task.completed && (
                            <>
                              <Button
                                onClick={() =>
                                  handleAdjustProgress(task.id, -1)
                                }
                                variant="default"
                                size="icon"
                                className="h-5 w-5 bg-[#f3c700] text-black hover:bg-yellow-300 text-xs font-bold"
                                title="Decrease Progress"
                                disabled={(task.progress ?? 0) <= 0}
                              >
                                -
                              </Button>
                              <Button
                                onClick={() =>
                                  handleAdjustProgress(task.id, 1)
                                }
                                variant="default"
                                size="icon"
                                className="h-5 w-5 bg-[#f3c700] text-black hover:bg-yellow-300 text-xs font-bold"
                                title="Increase Progress"
                              >
                                +
                              </Button>
                            </>
                          )}
                          <Button
                            onClick={() =>
                              handleToggleCompleteTask(task.id, task.completed)
                            }
                            variant={task.completed ? "destructive" : "default"}
                            size="sm"
                            className={`px-2.5 py-1 text-xs font-semibold ${
                              task.completed
                                ? "bg-red-600 hover:bg-red-500"
                                : "bg-green-600 hover:bg-green-500"
                            } text-white`}
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
                          </Button>
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
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <Card className="border border-[#f3c700] rounded-lg shadow-lg flex flex-col items-center text-center text-white">
            <CardHeader className="w-full pb-2 pt-4">
              <CardTitle className="section-header text-2xl font-bold text-[#f3c700] border-b-2 border-white pb-2">
                Assigned Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 w-full">
              {assignedVehicle ? (
                <p className="text-white">
                  {assignedVehicle.vehicle} ({assignedVehicle.plate})
                </p>
              ) : (
                <p className="text-white italic">No vehicle assigned.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-[#f3c700] rounded-lg shadow-lg flex flex-col items-center text-center text-white">
            <CardHeader className="w-full pb-2 pt-4">
              <CardTitle className="section-header text-2xl font-bold text-[#f3c700] border-b-2 border-white pb-2">
                Allowed Vehicles
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 w-full">
              {allowedVehicles.length > 0 ? (
                <div className="overflow-x-auto custom-scrollbar max-h-80 w-full">
                  <Table className="min-w-full text-sm text-center">
                    <TableHeader className="sticky top-0 z-10 bg-black bg-opacity-90">
                      <TableRow className="border-gray-700 hover:bg-black hover:bg-opacity-90">
                        <TableHead className="px-4 py-2 text-[#f3c700] uppercase text-center">
                          Vehicle
                        </TableHead>
                        <TableHead className="px-4 py-2 text-[#f3c700] uppercase text-center">
                          Plate
                        </TableHead>
                        <TableHead className="px-4 py-2 text-[#f3c700] uppercase text-center">
                          Division
                        </TableHead>
                        <TableHead className="px-4 py-2 text-[#f3c700] uppercase text-center">
                          Restrictions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-white">
                      {allowedVehicles.map((v) => (
                        <TableRow
                          key={v.id}
                          className="border-b border-gray-700 hover:bg-black hover:bg-opacity-90 transition-colors duration-150"
                        >
                          <TableCell className="px-4 py-2 text-white font-medium">
                            {v.vehicle}
                          </TableCell>
                          <TableCell className="px-4 py-2 font-mono">
                            {v.plate || "-"}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {v.division || "-"}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {v.restrictions || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-white italic">
                  No specific vehicles allowed based on rank/certifications.
                  Standard patrol vehicles may be available.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {selectedBulletin && (
          <Modal
            isOpen={!!selectedBulletin}
            onClose={() => setSelectedBulletin(null)}
          >
            <div className="p-6 bg-black bg-opacity-90 rounded-lg shadow-lg max-w-7xl w-full max-h-[80vh] overflow-y-auto mx-auto">
              {selectedBulletin ? (
                <Bulletins
                  selectedBulletin={
                    selectedBulletin
                      ? {
                          ...selectedBulletin,
                          createdAt: selectedBulletin.createdAt.toDate(),
                        }
                      : undefined
                  }
                />
              ) : (
                <p className="text-white text-center">Loading bulletin...</p>
              )}
            </div>
          </Modal>
        )}
      </div>
    </Layout>
  );
};

const getNoteTypeColorClass = (type: string | undefined): string => {
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
      return "text-gray-400";
  }
};

const getCertBadgeStyle = (status: CertStatus | null): { badgeClass: string } => {
  switch (status) {
    case "LEAD":
      return { badgeClass: "bg-blue-600 hover:bg-blue-700" };
    case "SUPER":
      return { badgeClass: "bg-orange-500 hover:bg-orange-600" };
    case "CERT":
      return { badgeClass: "bg-green-600 hover:bg-green-700" };
    case "TRAIN":
      return { badgeClass: "bg-orange-600 hover:bg-orange-700" };
    default:
      return { badgeClass: "bg-gray-800 hover:bg-gray-700" };
  }
};

export default MyDashboard;

