import React, { useState, useEffect, useMemo, useCallback, JSX } from "react";
import { NavLink } from "react-router-dom";
import Layout from "./Layout";
import {
  collection,
  getDocs,
  writeBatch,
  query,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
  Timestamp,
  deleteField,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import { formatIssuedAt, isOlderThanDays, formatTimestampDateTime } from "../utils/timeHelpers";
import { getRandomBackgroundImage } from "../utils/backgroundImage";
import { FaEdit, FaTrash, FaArrowUp, FaEye, FaEyeSlash } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { RosterUser, DisciplineEntry, NoteEntry } from "../types/User";
import EditUserModal from "./EditUserModal";
import { UserTask } from "../types/User";
import { toast } from "react-toastify";
import ConfirmationModal from "./ConfirmationModal";
import { where as firestoreWhere, QueryConstraint } from "firebase/firestore";
import { limit as firestoreLimit } from "firebase/firestore";

const rankCategories = {
  CADET: "Cadets",
  TROOPER: "State Troopers",
  SUPERVISOR: "Supervisors",
  COMMAND: "Command",
  HIGH_COMMAND: "High Command",
};

const commandPlusRanks = [
  "Lieutenant",
  "Captain",
  "Commander",
  "Assistant Commissioner",
  "Deputy Commissioner",
  "Commissioner",
].map(rank => rank.toLowerCase());

const highCommandRanks = [
  "Assistant Commissioner",
  "Deputy Commissioner",
  "Commissioner",
].map(rank => rank.toLowerCase());

const needsHighCommandVoteRanks = [
  "Corporal",
  "Sergeant",
  "Staff Sergeant",
  "Lieutenant",
].map(rank => rank.toLowerCase());

const eligibleVoterRanks = [
  "Sergeant",
  "Staff Sergeant",
  "Lieutenant",
  "Captain",
  "Commander",
  "Assistant Commissioner",
  "Deputy Commissioner",
  "Commissioner",
].map(rank => rank.toLowerCase());

const getRankCategory = (rank: string): keyof typeof rankCategories | null => {
  const lowerRank = rank.toLowerCase();
  if (lowerRank === "cadet") return "CADET";
  if (["trooper", "trooper first class", "corporal"].includes(lowerRank))
    return "TROOPER";
  if (["sergeant", "staff sergeant"].includes(lowerRank)) return "SUPERVISOR";
  if (["lieutenant", "captain", "commander"].includes(lowerRank)) return "COMMAND";
  if (
    ["assistant commissioner", "deputy commissioner", "commissioner"].includes(
      lowerRank
    )
  )
    return "HIGH_COMMAND";
  return null;
};

const convertToString = (
  value: string | Timestamp | Date | null | undefined
): string => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString().split("T")[0];
  } else if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  return value || "";
};

interface FirestoreUserWithDetails extends RosterUser {
  tasks: UserTask[];
  disciplineEntries: DisciplineEntry[];
  generalNotes: NoteEntry[];
  lastSignInTime?: Timestamp | string | null;
  promotionStatus?: {
    votes?: { [voterId: string]: 'Approve' | 'Deny' | 'Needs Time' };
    hideUntil?: Timestamp | null;
    lastVoteTimestamp?: Timestamp;
  };
}

const availableRanks = [
  "Cadet",
  "Trooper",
  "Trooper First Class",
  "Corporal",
  "Sergeant",
  "Staff Sergeant",
  "Lieutenant",
  "Captain",
  "Commander",
  "Assistant Commissioner",
  "Deputy Commissioner",
  "Commissioner",
];

const filterOptions = {
  ALL: "All Ranks",
  ...rankCategories,
  ...Object.fromEntries(availableRanks.map((rank) => [rank, rank])),
};

const assignTaskFilterOptions = {
  SELECT: "-- Select by Rank/Category --",
  ALL: "All Users",
  ...rankCategories,
  ...Object.fromEntries(availableRanks.map((rank) => [rank, rank])),
};

const getCurrentDateTimeStrings = () => {
  const now = new Date();
  const date = now.toLocaleDateString();
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date, time };
};

export default function AdminMenu(): JSX.Element {
  const { user: currentUser } = useAuth();
  const [usersData, setUsersData] = useState<FirestoreUserWithDetails[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkTaskType, setBulkTaskType] = useState<"goal" | "normal">("normal");
  const [bulkTaskGoal, setBulkTaskGoal] = useState<number>(0);
  const [isAssigning, setIsAssigning] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [editingUser, setEditingUser] = useState<FirestoreUserWithDetails | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<{
    show: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [isAssignTaskOpen, setIsAssignTaskOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"rank" | "name">("rank");
  const [selectedAssignFilter, setSelectedAssignFilter] = useState<string>("SELECT");
  const [showHiddenCards, setShowHiddenCards] = useState<boolean>(false);

  useEffect(() => {
    setBackgroundImage(getRandomBackgroundImage());
  }, []);

  const fetchAdminData = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
      const usersPromises = usersSnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data() as Partial<RosterUser & { lastSignInTime?: Timestamp | string | null, promotionStatus?: any }>;
        const userEmail = userDoc.id;
        const name = typeof userData.name === "string" ? userData.name : "Unknown";

        const tasksSnapshot = await getDocs(
          query(
            collection(dbFirestore, "users", userEmail, "tasks"),
            orderBy("issueddate", "desc")
          )
        );
        const tasks = tasksSnapshot.docs.map((taskDoc) => {
          const data = taskDoc.data();
          if (
            typeof data.task === "string" &&
            (data.type === "goal" || data.type === "normal") &&
            typeof data.issuedby === "string" &&
            typeof data.issueddate === "string" &&
            typeof data.issuedtime === "string" &&
            typeof data.completed === "boolean" &&
            (data.type === "goal" ? typeof data.progress === "number" : true)
          ) {
            return {
              id: taskDoc.id,
              task: data.task,
              type: data.type,
              issuedby: data.issuedby,
              issueddate: data.issueddate,
              issuedtime: data.issuedtime,
              progress: data.progress,
              completed: data.completed,
              goal: data.goal,
            } as UserTask;
          }
          return null;
        }).filter((task): task is UserTask => task !== null);

        const disciplineSnapshot = await getDocs(
          query(
            collection(dbFirestore, "users", userEmail, "discipline"),
            orderBy("issueddate", "desc")
          )
        );
        const disciplineEntries = disciplineSnapshot.docs.map((entryDoc) => {
          const data = entryDoc.data();
          if (
            typeof data.type === "string" &&
            typeof data.disciplinenotes === "string" &&
            typeof data.issuedby === "string" &&
            typeof data.issueddate === "string" &&
            typeof data.issuedtime === "string"
          ) {
            return {
              id: entryDoc.id,
              type: data.type,
              disciplinenotes: data.disciplinenotes,
              issuedby: data.issuedby,
              issueddate: data.issueddate,
              issuedtime: data.issuedtime,
            } as DisciplineEntry;
          }
          return null;
        }).filter((entry): entry is DisciplineEntry => entry !== null);

        const notesSnapshot = await getDocs(
          query(
            collection(dbFirestore, "users", userEmail, "notes"),
            orderBy("issueddate", "desc")
          )
        );
        const generalNotes = notesSnapshot.docs.map((noteDoc) => {
          const data = noteDoc.data();
          if (
            typeof data.note === "string" &&
            typeof data.issuedby === "string" &&
            typeof data.issueddate === "string" &&
            typeof data.issuedtime === "string"
          ) {
            return {
              id: noteDoc.id,
              note: data.note,
              issuedby: data.issuedby,
              issueddate: data.issueddate,
              issuedtime: data.issuedtime,
            } as NoteEntry;
          }
          return null;
        }).filter((note): note is NoteEntry => note !== null);

        return {
          id: userEmail,
          email: userEmail,
          name: name,
          rank: userData.rank || "Unranked",
          badge: userData.badge || "N/A",
          callsign: userData.callsign || "",
          isActive: userData.isActive ?? true,
          discordId: userData.discordId || "-",
          cid: userData.cid,
          joinDate: userData.joinDate || null,
          lastPromotionDate: userData.lastPromotionDate || null,
          loaStartDate: userData.loaStartDate || null,
          loaEndDate: userData.loaEndDate || null,
          certifications: userData.certifications || {},
          role: userData.role,
          isPlaceholder: userData.isPlaceholder ?? false,
          category: userData.category,
          assignedVehicleId: userData.assignedVehicleId,
          tasks: tasks,
          disciplineEntries: disciplineEntries,
          generalNotes: generalNotes,
          lastSignInTime: userData.lastSignInTime || null,
          promotionStatus: userData.promotionStatus || { votes: {} },
          isAdmin:
            userData.role?.toLowerCase() === "admin" ||
            highCommandRanks.includes(userData.rank?.toLowerCase() || ""),
          displayName: name,
        } as FirestoreUserWithDetails;
      });

      const resolvedUsersData = await Promise.all(usersPromises);
      setUsersData(
        resolvedUsersData.filter(
          (user) => user !== null && !user.isPlaceholder
        ) as FirestoreUserWithDetails[]
      );
    } catch (error) {
      setUsersError("Failed to load user, task, or discipline data.");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const filteredUsersData = useMemo(() => {
    let filtered = [...usersData].sort((a, b) => {
      if (sortBy === "rank") {
        const rankOrder: { [key: string]: number } = {
          Commissioner: 1,
          "Deputy Commissioner": 2,
          "Assistant Commissioner": 3,
          Commander: 4,
          Captain: 5,
          Lieutenant: 6,
          "Staff Sergeant": 7,
          Sergeant: 8,
          Corporal: 9,
          "Trooper First Class": 10,
          Trooper: 11,
          Cadet: 12,
        };
        const aOrder = rankOrder[a.rank] || Infinity;
        const bOrder = rankOrder[b.rank] || Infinity;
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
      }
      return a.name.localeCompare(b.name);
    });

    if (selectedCategory !== "ALL") {
      if (Object.keys(rankCategories).includes(selectedCategory)) {
        filtered = filtered.filter(
          (user) => getRankCategory(user.rank) === selectedCategory
        );
      } else {
        filtered = filtered.filter((user) => user.rank === selectedCategory);
      }
    }

    if (searchTerm) {
      filtered = filtered.filter((user) =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (!showHiddenCards) {
      const now = Timestamp.now();
      filtered = filtered.filter(user => {
        const hideUntil = user.promotionStatus?.hideUntil;
        return !hideUntil || hideUntil.toMillis() <= now.toMillis();
      });
    }

    return filtered;
  }, [usersData, sortBy, selectedCategory, searchTerm, showHiddenCards]);

  const buttonPrimary =
    "px-4 py-2 bg-[#f3c700] text-black font-bold rounded hover:bg-yellow-300 transition-colors duration-200";
  const buttonSecondary =
    "px-3 py-1 border border-[#f3c700] text-[#f3c700] rounded hover:bg-[#f3c700]/10 transition-colors duration-200 text-xs";
  const buttonDanger =
    "px-4 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-500 transition-colors duration-200";
  const inputStyle =
    "w-full p-2 bg-black/80 text-white rounded border border-[#f3c700] text-sm focus:ring-[#f3c700] focus:border-[#f3c700]";
  const cardBase =
    "p-4 bg-black/80 rounded-lg shadow-lg border border-[#f3c700]/50";
  const textPrimary = "text-white";
  const textSecondary = "text-white/70";
  const textAccent = "text-[#f3c700]";
  const borderAccent = "border-[#f3c700]";

  return (
    <Layout>
      <div className="fixed inset-0 z-[-1] bg-cover bg-center bg-no-repeat bg-fixed" style={{ backgroundImage: `url(${backgroundImage})` }}></div>
      <div
        className="page-content relative space-y-6 p-6 text-white/80 min-h-screen"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <div className="bg-black/75 text-[#f3c700] font-sans p-4 rounded-lg shadow-lg mb-6">
          <div className="flex space-x-6 border-b border-[#f3c700]">
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "text-[#f3c700] border-b-2 border-[#f3c700]"
                    : "text-white/60 hover:text-[#f3c700]"
                }`
              }
            >
              Admin Menu
            </NavLink>
            <NavLink
              to="/promotions"
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "text-[#f3c700] border-b-2 border-[#f3c700]"
                    : "text-white/60 hover:text-[#f3c700]"
                }`
              }
            >
              Promotions
            </NavLink>
            <NavLink
              to="/bulletins"
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "text-[#f3c700] border-b-2 border-[#f3c700]"
                    : "text-white/60 hover:text-[#f3c700]"
                }`
              }
            >
              Bulletins
            </NavLink>
          </div>
        </div>
        <button
          className={`${buttonPrimary} mb-4`}
          onClick={() => setIsAssignTaskOpen((prev) => !prev)}
        >
          {isAssignTaskOpen ? "Close Assign Task" : "Assign Task"}
        </button>
        {isAssignTaskOpen && (
          <div className={`${cardBase} space-y-4 mb-6`}>
            <h2 className={`text-xl font-bold ${textAccent}`}>Assign Task</h2>
            <textarea
              className={inputStyle}
              placeholder="Enter task description..."
              value={bulkTaskType}
              onChange={(e) => {
                setBulkTaskType(e.target.value as "goal" | "normal");
              }}
            />
            <div>
              <label className={`block text-sm font-medium ${textAccent} mb-2`}>
                Task Type:
              </label>
              <select
                className={inputStyle}
                value={bulkTaskType}
                onChange={(e) =>
                  setBulkTaskType(e.target.value as "goal" | "normal")
                }
              >
                <option value="normal">Normal Task</option>
                <option value="goal">Goal Task</option>
              </select>
            </div>
            {bulkTaskType === "goal" && (
              <div>
                <label
                  className={`block text-sm font-medium ${textAccent} mb-2`}
                >
                  Goal Value:
                </label>
                <input
                  type="number"
                  className={inputStyle}
                  placeholder="Enter goal value"
                  value={bulkTaskGoal}
                  onChange={(e) => setBulkTaskGoal(Number(e.target.value))}
                />
              </div>
            )}
            <div>
              <label className={`block text-sm font-medium ${textAccent} mb-2`}>
                Select Users by Rank/Category:
              </label>
              <select
                className={inputStyle}
                value={selectedAssignFilter}
                onChange={(e) => setSelectedAssignFilter(e.target.value)}
              >
                {Object.entries(assignTaskFilterOptions).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-white mt-4">
                Selected Users ({selectedUsers.length}):
              </h3>
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 bg-black/80 p-3 rounded ${borderAccent} max-h-60 overflow-y-auto custom-scrollbar`}
              >
                {[...usersData]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((user) => (
                    <label
                      key={user.id}
                      className={`flex items-center space-x-2 p-2 rounded border cursor-pointer transition-colors duration-200 ${
                        selectedUsers.includes(user.id)
                          ? "bg-[#f3c700] text-black border-[#f3c700]"
                          : `bg-black/90 text-white border-white/20 hover:border-[#f3c700]/50`
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => setSelectedUsers((prev) =>
                          prev.includes(user.id)
                            ? prev.filter((id) => id !== user.id)
                            : [...prev, user.id]
                        )}
                        className="h-4 w-4 text-[#f3c700] border-white/30 rounded focus:ring-[#f3c700] bg-black/50 flex-shrink-0"
                      />
                      <span className="text-xs leading-tight">
                        {user.name} <br />
                        <span className="text-[10px] opacity-80">
                          {user.rank} - {user.badge || 'N/A'}
                        </span>
                      </span>
                    </label>
                  ))}
              </div>
            </div>
            <div className="flex justify-between items-center pt-4">
              <button className={buttonDanger} onClick={() => setSelectedUsers([])}>
                Clear Selections
              </button>
              <button
                className={buttonPrimary}
                onClick={() => setIsAssigning(true)}
                disabled={isAssigning}
              >
                {isAssigning ? "Assigning..." : "Assign Task"}
              </button>
            </div>
          </div>
        )}
        <div className={`${cardBase}`}>
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4 flex-wrap">
            <h2 className={`section-header text-2xl font-bold ${textAccent} border-none pb-0`}>
              Users Overview
            </h2>
            <div className="flex gap-4 flex-wrap sm:flex-nowrap justify-end items-center w-full sm:w-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "rank" | "name")}
                className={`${inputStyle} max-w-xs sm:max-w-[120px]`}
              >
                <option value="rank">Sort: Rank</option>
                <option value="name">Sort: Name</option>
              </select>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`${inputStyle} max-w-xs sm:max-w-[180px]`}
              >
                {Object.entries(filterOptions).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${inputStyle} max-w-xs sm:max-w-[200px]`}
              />
              <label className="flex items-center gap-2 cursor-pointer text-xs text-white/80 hover:text-white">
                <input
                  type="checkbox"
                  checked={showHiddenCards}
                  onChange={(e) => setShowHiddenCards(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#f3c700] focus:ring-[#f3c700] bg-black/50"
                />
                {showHiddenCards ? <FaEye size="0.9em"/> : <FaEyeSlash size="0.9em"/>}
                Show Hidden
              </label>
            </div>
          </div>
          {usersLoading && (
            <p className="italic text-white/60">Loading users...</p>
          )}
          {usersError && <p className="text-red-500">{usersError}</p>}
          {!usersLoading && !usersError && (
            <>
              {filteredUsersData.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUsersData.map((userData) => {
                    const isCommandPlus = commandPlusRanks.includes(userData.rank.toLowerCase());
                    const eligibleForPromotion = !isCommandPlus && isOlderThanDays(userData.lastPromotionDate, 14);
                    const needsHCVote = needsHighCommandVoteRanks.includes(userData.rank.toLowerCase());

                    const now = Timestamp.now();
                    const isHiddenByRule = userData.promotionStatus?.hideUntil && userData.promotionStatus.hideUntil.toMillis() > now.toMillis();

                    function formatDateForDisplay(dateString: string | Timestamp | null | undefined): string {
                      if (!dateString) return "N/A";
                      let date: Date;
                      if (dateString instanceof Timestamp) {
                        date = dateString.toDate();
                      } else {
                        date = new Date(dateString);
                      }
                      if (isNaN(date.getTime())) {
                        return "Invalid Date";
                      }
                      return date.toLocaleDateString(undefined, {
                        year: "numeric", month: "short", day: "numeric",
                      });
                    }

                    return (
                      <div
                        key={userData.id}
                        className={`user-card p-3 border ${borderAccent}/50 rounded-lg flex flex-col bg-black/90 text-white shadow-md ${isHiddenByRule && showHiddenCards ? 'opacity-70 border-dashed border-orange-500' : ''}`}
                        title={isHiddenByRule && showHiddenCards ? `Normally hidden until ${formatTimestampDateTime(userData.promotionStatus?.hideUntil)}` : ''}
                      >
                        <div className="flex-grow">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className={`font-semibold ${textAccent}`}>
                              {userData.name}
                            </h4>
                            <div className="flex flex-col items-end gap-1">
                              {isHiddenByRule && showHiddenCards && (
                                <span className="text-xs text-orange-400 bg-orange-900/60 px-1.5 py-0.5 rounded border border-orange-600 flex items-center gap-1">
                                  <FaEyeSlash size="0.65rem"/> Hidden
                                </span>
                              )}
                              {eligibleForPromotion && !(isHiddenByRule && showHiddenCards) && (
                                <div className="flex items-center gap-1 text-xs text-green-400 bg-green-900/50 px-1.5 py-0.5 rounded border border-green-600" title={`Eligible for Promotion (Last: ${formatDateForDisplay(userData.lastPromotionDate)})`}>
                                  <FaArrowUp size="0.65rem" />
                                  <span>Eligible</span>
                                </div>
                              )}
                              {eligibleForPromotion && needsHCVote && !(isHiddenByRule && showHiddenCards) && (
                                <div className="text-xs text-yellow-400/80 italic px-1.5 py-0.5 rounded bg-yellow-900/50 border border-yellow-600/50" title="Promotion to this rank requires High Command review">
                                  Requires HC Approval
                                </div>
                              )}
                            </div>
                          </div>
                          <p className={`text-sm ${textSecondary}`}>
                            {userData.rank} - {userData.callsign || "N/A"}
                          </p>
                          <p className={`text-sm ${textSecondary} mb-2`}>
                            Badge: {userData.badge}
                          </p>
                          <h5 className={`text-sm font-medium ${textSecondary} italic mb-1 mt-3 border-t border-[#f3c700]/50 pt-2`}>
                            Tasks ({userData.tasks?.length || 0}):
                          </h5>
                          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1 shadow-inner border border-white/10 rounded p-2 mb-3">
                            {userData.tasks && userData.tasks.length > 0 ? userData.tasks.map((task) => (
                              <div
                                key={task.id}
                                className="p-1.5 rounded border border-[#f3c700]/40 bg-black/50 relative group"
                              >
                                <div className="absolute top-1 right-1 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                  <FaEdit className="text-[#f3c700] hover:text-yellow-300 cursor-pointer h-3.5 w-3.5 transition-colors duration-150" title="Edit Task" />
                                  <FaTrash className="text-red-500 hover:text-red-400 cursor-pointer h-3.5 w-3.5 transition-colors duration-150" title="Delete Task" />
                                </div>
                                <p className={`inline text-xs pr-10 ${task.completed ? "line-through text-white/50" : "text-white/90"}`}>
                                  {task.task}
                                </p>
                                <small className="text-white/60 block mt-1 text-[10px]">
                                  Type: {task.type}
                                  {task.type === "goal" && ` | Progress: ${task.progress ?? 0}/${task.goal ?? "N/A"}`}
                                  | Status: {task.completed ? <span className="text-green-400">Completed</span> : <span className={textAccent}>In Progress</span>}
                                  | Assigned: {formatIssuedAt(task.issueddate, task.issuedtime)} | By: {task.issuedby || "Unknown"}
                                </small>
                              </div>
                            )) : (
                              <p className="text-white/50 italic text-xs">No tasks assigned.</p>
                            )}
                          </div>
                          <h5 className={`text-sm font-medium ${textSecondary} italic mb-1 mt-3 border-t border-[#f3c700]/50 pt-2`}>
                            Discipline ({userData.disciplineEntries?.length || 0}):
                          </h5>
                          <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar pr-1 shadow-inner border border-white/10 rounded p-2 text-xs mb-3">
                            {userData.disciplineEntries && userData.disciplineEntries.length > 0 ? (
                              userData.disciplineEntries.map((entry) => (
                                <div key={entry.id} className="p-1.5 rounded border border-[#f3c700]/40 bg-black/50">
                                  <p className="text-white/90 font-medium uppercase text-[10px]">{entry.type}</p>
                                  <p className="text-white/80 truncate">{entry.disciplinenotes}</p>
                                  <small className="text-white/60 block mt-0.5 text-[10px]">
                                    By: {entry.issuedby} on {formatIssuedAt(entry.issueddate, entry.issuedtime)}
                                  </small>
                                </div>
                              ))
                            ) : (
                              <p className="text-white/50 italic">No discipline.</p>
                            )}
                          </div>
                          <h5 className={`text-sm font-medium ${textSecondary} italic mb-1 mt-3 border-t border-[#f3c700]/50 pt-2`}>
                            Notes ({userData.generalNotes?.length || 0}):
                          </h5>
                          <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar pr-1 shadow-inner border border-white/10 rounded p-2 text-xs">
                            {userData.generalNotes && userData.generalNotes.length > 0 ? (
                              userData.generalNotes.map((note) => (
                                <div key={note.id} className="p-1.5 rounded border border-[#f3c700]/40 bg-black/50">
                                  <p className="text-white/90 font-medium text-[10px]">{note.note}</p>
                                  <small className="text-white/60 block mt-0.5 text-[10px]">
                                    By: {note.issuedby} on {formatIssuedAt(note.issueddate, note.issuedtime)}
                                  </small>
                                </div>
                              ))
                            ) : (
                              <p className="text-white/50 italic">No notes.</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
                          <span className="text-xs text-white/50 italic">
                            Last Signed In: {formatTimestampDateTime(userData.lastSignInTime)}
                          </span>
                          <button
                            className={`${buttonSecondary}`}
                            onClick={() => setEditingUser(userData)}
                          >
                            Manage User
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-white/60 italic text-center py-4">
                  No users found matching the current filters or eligible for display.
                </p>
              )}
            </>
          )}
        </div>
        {editingUser && (
          <EditUserModal
            user={{
              ...editingUser,
              badge: editingUser.badge || "N/A",
              callsign: editingUser.callsign || "-",
              discordId: editingUser.discordId || "-",
              certifications: editingUser.certifications || {},
              assignedVehicleId: editingUser.assignedVehicleId || undefined,
              loaStartDate: convertToString(editingUser.loaStartDate),
              loaEndDate: convertToString(editingUser.loaEndDate),
              joinDate: convertToString(editingUser.joinDate),
              lastPromotionDate: convertToString(editingUser.lastPromotionDate),
              isActive: editingUser.isActive ?? true,
              name: editingUser.name || "Unknown",
              rank: editingUser.rank || "Unranked",
              id: editingUser.id || "",
              category: editingUser.category || "Uncategorized",
              cid: editingUser.cid || "Unknown",
              email: editingUser.email || "Unknown",
              role: editingUser.role || "Unknown",
              isPlaceholder: editingUser.isPlaceholder ?? false,
              tasks: editingUser.tasks || [],
              disciplineEntries: editingUser.disciplineEntries || [],
              generalNotes: editingUser.generalNotes || [],
              promotionStatus: editingUser.promotionStatus,
            }}
            onClose={() => setEditingUser(null)}
            onSave={() => {
              fetchAdminData();
              setEditingUser(null);
            }}
          />
        )}
      </div>
    </Layout>
  );
}
/**
 * Wrapper for Firestore's where function to match the expected type.
 */
function where(fieldPath: string, opStr: string, value: any): QueryConstraint {
  return firestoreWhere(fieldPath, opStr as any, value);
}
function limit(count: number): QueryConstraint {
  return firestoreLimit(count);
}

