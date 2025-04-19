import React, { useState, useEffect, useMemo, useCallback, JSX, useRef } from "react";
import Layout from "./Layout";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  Timestamp,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
  setDoc,
  onSnapshot,
  deleteDoc,
  deleteField,
  FieldPath,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { RosterUser } from "../types/User";
import { isOlderThanDays, formatDateForDisplay, formatTimestampDateTime } from "../utils/timeHelpers";
import { getRandomBackgroundImage } from "../utils/backgroundImage";
import { toast } from "react-toastify";
import { FaEdit, FaTrash, FaSave, FaTimes, FaSearch, FaFilter, FaEyeSlash, FaEye } from "react-icons/fa";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

const adminVoterRanks = [
  "Sergeant",
  "Staff Sergeant",
  "Lieutenant",
  "Captain",
  "Commander",
  "Assistant Commissioner",
  "Deputy Commissioner",
  "Commissioner",
].map(rank => rank.toLowerCase());

const commandPlusRanks = [
  "Lieutenant",
  "Captain",
  "Commander",
  "Assistant Commissioner",
  "Deputy Commissioner",
  "Commissioner",
].map(rank => rank.toLowerCase());

const highCommandRanks = [
  "assistant commissioner",
  "deputy commissioner",
  "commissioner",
];

type PromotionVote = 'promote' | 'deny' | 'needs_time';

interface PromotionVoteData {
  votes: { [voterEmail: string]: PromotionVote };
  hideUntil?: Timestamp | null;
  isManuallyHidden?: boolean;
}

interface PromotionComment {
  id: string;
  commenterEmail: string;
  commenterName: string;
  comment: string;
  createdAt: Timestamp;
}

interface EligibleUserPromotionData extends RosterUser {
  voteData: PromotionVoteData | null;
  comments: PromotionComment[];
}

export default function PromotionsTab(): JSX.Element {
  console.log("PromotionsTab component mounted/rendered.");
  const { user: currentUser, isAdmin } = useAuth();
  const [allUsers, setAllUsers] = useState<RosterUser[]>([]);
  const [promotionData, setPromotionData] = useState<{ [userId: string]: EligibleUserPromotionData }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [newComments, setNewComments] = useState<{ [userId: string]: string }>({});
  const [editingComment, setEditingComment] = useState<{ userId: string; commentId: string; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showHiddenByVotes, setShowHiddenByVotes] = useState<boolean>(false);
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);
  const [forceShowUserId, setForceShowUserId] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const userCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    console.log("PromotionsTab: Background effect running.");
    setBackgroundImage(getRandomBackgroundImage());
  }, []);

  const fetchAllUsers = useCallback(async () => {
    try {
      const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as RosterUser[];
      setAllUsers(usersList);
    } catch (err) {
      console.error("Error fetching all users:", err);
      setError("Failed to load user roster.");
      toast.error("Failed to load user roster.");
    }
  }, []);

  const { eligibleUsers, adminVoters } = useMemo(() => {
    const eligible: RosterUser[] = [];
    const voters: RosterUser[] = [];
    allUsers.forEach(u => {
      const rankLower = u.rank?.toLowerCase() || "";
      const isEligible = !commandPlusRanks.includes(rankLower) && isOlderThanDays(u.lastPromotionDate, 14);
      if (isEligible) {
        eligible.push(u);
      }
      if (adminVoterRanks.includes(rankLower)) {
        voters.push(u);
      }
    });
    const filteredEligible = eligible.filter(u => u.id !== currentUser?.id);
    return { eligibleUsers: filteredEligible, adminVoters: voters };
  }, [allUsers, currentUser?.id]);

  const isHCAdmin = useMemo(() => {
    if (!currentUser) return false;
    return isAdmin || highCommandRanks.includes(currentUser.rank?.toLowerCase() || "");
  }, [currentUser, isAdmin]);

  useEffect(() => {
    console.log("PromotionsTab: Main data listener effect running.");
    if (!eligibleUsers.length || !currentUser) {
      console.log("PromotionsTab: Skipping listeners - no eligible users or current user.");
      setLoading(false);
      return;
    }

    console.log(`PromotionsTab: Setting up listeners for ${eligibleUsers.length} eligible users.`);
    setLoading(true);
    const unsubscribes: (() => void)[] = [];
    const initialData: { [userId: string]: EligibleUserPromotionData } = {};
    const promotionDocId = "activePromotion";

    const setupListenersForUser = async (eligibleUser: RosterUser) => {
      if (!eligibleUser.id) return;

      initialData[eligibleUser.id] = {
        ...eligibleUser,
        voteData: { votes: {} },
        comments: [],
      };

      const promotionDocRef = doc(dbFirestore, "users", eligibleUser.id, "promotions", promotionDocId);
      const commentsColRef = collection(promotionDocRef, "comments");

      try {
        const docSnap = await getDoc(promotionDocRef);
        if (!docSnap.exists()) {
          await setDoc(promotionDocRef, { votes: {} });
        }
      } catch (err) {
        console.error(`Error checking/creating promotion document for ${eligibleUser.id}:`, err);
      }

      const unsubVotes = onSnapshot(promotionDocRef, (docSnap) => {
        console.log(`Snapshot received for user ${eligibleUser.id}:`, docSnap.exists() ? docSnap.data() : 'No data');
        const rawVoteData = docSnap.exists() ? (docSnap.data() as PromotionVoteData) : { votes: {} };
        const votesObj = rawVoteData.votes ? { ...rawVoteData.votes } : {};
        Object.keys(votesObj).forEach(k => {
          if (votesObj[k] == null) delete votesObj[k];
        });
        const safeVoteData: PromotionVoteData = {
          ...rawVoteData,
          votes: votesObj,
          isManuallyHidden: rawVoteData.isManuallyHidden ?? false,
        };
        setPromotionData(prev => {
          const newState = {
            ...prev,
            [eligibleUser.id]: {
              ...(prev[eligibleUser.id] || initialData[eligibleUser.id]),
              voteData: { ...safeVoteData, votes: { ...safeVoteData.votes } },
              comments: prev[eligibleUser.id]?.comments ? [...prev[eligibleUser.id].comments] : []
            }
          };
          console.log(`State updated for ${eligibleUser.id}`, newState[eligibleUser.id]?.voteData);
          return newState;
        });
      }, (err) => {
        console.error(`Error fetching votes for ${eligibleUser.id}:`, err);
        setError(prev => `${prev ? prev + '; ' : ''}Failed to load vote data for ${eligibleUser.name}`);
      });
      unsubscribes.push(unsubVotes);

      const commentsQuery = query(commentsColRef, orderBy("createdAt", "asc"));
      const unsubComments = onSnapshot(commentsQuery, (querySnapshot) => {
        const comments = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as PromotionComment[];
        setPromotionData(prev => ({
          ...prev,
          [eligibleUser.id]: {
            ...(prev[eligibleUser.id] || initialData[eligibleUser.id]),
            comments: comments,
          },
        }));
      }, (err) => {
        console.error(`Error fetching comments for ${eligibleUser.id}:`, err);
        setError(prev => `${prev ? prev + '; ' : ''}Failed to load comments for ${eligibleUser.name}`);
      });
      unsubscribes.push(unsubComments);
    };

    Promise.all(eligibleUsers.map(setupListenersForUser)).then(() => {
      console.log("PromotionsTab: All listeners set up, setting initial data.");
      setPromotionData(initialData);
      setLoading(false);
    }).catch(err => {
      console.error("Error setting up promotion listeners:", err);
      setError("An error occurred while initializing promotion data.");
      setLoading(false);
    });

    return () => {
      console.log("PromotionsTab: Cleaning up listeners.");
      unsubscribes.forEach(unsub => unsub());
    };

  }, [eligibleUsers, currentUser, adminVoters]);

  useEffect(() => {
    console.log("PromotionsTab: Fetching all users effect running.");
    fetchAllUsers();
  }, [fetchAllUsers]);

  useEffect(() => {
    console.log("PromotionsTab: Focus user effect running. Search:", location.search);
    setForceShowUserId(null);
  }, [location.search, navigate, promotionData]);

  const filteredPromotionData = useMemo(() => {
    let data = Object.values(promotionData);

    if (searchTerm) {
      data = data.filter(userPromoData =>
        userPromoData.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (!showHiddenByVotes) {
      data = data.filter(userPromoData => !userPromoData.voteData?.isManuallyHidden);
    }

    data.sort((a, b) => a.name.localeCompare(b.name));

    return data;
  }, [promotionData, searchTerm, showHiddenByVotes]);

  const handleVote = async (userId: string, vote: PromotionVote) => {
    if (!currentUser?.email || !userId) {
      toast.error("Cannot vote. User not identified.");
      return;
    }

    const promotionDocId = "activePromotion";
    const promotionDocRef = doc(dbFirestore, "users", userId, "promotions", promotionDocId);
    const voterEmail = currentUser.email;
    const votePath = new FieldPath('votes', voterEmail);

    try {
      const currentDocSnap = await getDoc(promotionDocRef);
      const currentVotesData = currentDocSnap.exists()
        ? (currentDocSnap.data() as PromotionVoteData)
        : { votes: {} };

      const currentVoteInDb = currentVotesData?.votes?.[voterEmail];

      if (currentVoteInDb === vote) {
        console.log(`Attempting to remove vote for ${userId} at path:`, votePath);
        await updateDoc(promotionDocRef, votePath, deleteField());
        console.log(`Firestore vote removal successful for ${userId}.`);
        toast.success(`Vote removed for ${promotionData[userId]?.name || userId}.`);
      } else {
        console.log(`Attempting to set vote for ${userId} to '${vote}' at path:`, votePath);
        await updateDoc(promotionDocRef, votePath, vote);
        console.log(`Firestore vote update successful for ${userId}.`);
        toast.success(
          currentVoteInDb
            ? `Vote changed for ${promotionData[userId]?.name || userId}.`
            : `Vote recorded for ${promotionData[userId]?.name || userId}.`
        );
      }

    } catch (err: any) {
      console.error("Error updating vote:", err);
      if (err.message && err.message.includes('[object Object]')) {
          console.error("FieldPath approach still resulted in [object Object] error. VoterEmail:", voterEmail);
      }
      toast.error(`Failed to update vote: ${err.message || 'Unknown error'}`);
    }
  };

  const handleToggleManualHide = async (userId: string) => {
    const userPromoData = promotionData[userId];
    if (!userPromoData) return;

    const promotionDocId = "activePromotion";
    const promotionDocRef = doc(dbFirestore, "users", userId, "promotions", promotionDocId);
    const currentHiddenState = userPromoData.voteData?.isManuallyHidden ?? false;
    const newHiddenState = !currentHiddenState;

    try {
      await updateDoc(promotionDocRef, {
        isManuallyHidden: newHiddenState
      });
      toast.success(`${userPromoData.name} ${newHiddenState ? 'hidden' : 'shown'}.`);
    } catch (err: any) {
      console.error("Error toggling manual hide state:", err);
      toast.error(`Failed to ${newHiddenState ? 'hide' : 'show'} user: ${err.message || 'Unknown error'}`);
    }
  };

  const handleAddComment = async (userId: string) => {
    const commentText = newComments[userId]?.trim();
    if (!currentUser?.email || !currentUser.name || !userId || !commentText) {
      toast.error("Cannot add comment. Missing user info or comment text.");
      return;
    }

    const promotionDocId = "activePromotion";
    const commentsColRef = collection(dbFirestore, "users", userId, "promotions", promotionDocId, "comments");

    try {
      await addDoc(commentsColRef, {
        commenterEmail: currentUser.email,
        commenterName: currentUser.name,
        comment: commentText,
        createdAt: serverTimestamp(),
      });

      setNewComments(prev => ({ ...prev, [userId]: "" }));
      toast.success(`Comment added for ${promotionData[userId]?.name || 'user'}.`);
    } catch (err) {
      console.error("Error adding comment:", err);
      toast.error("Failed to add comment.");
    }
  };

  const handleEditComment = (userId: string, comment: PromotionComment) => {
    setEditingComment({ userId, commentId: comment.id, text: comment.comment });
  };

  const handleCancelEdit = () => {
    setEditingComment(null);
  };

  const handleSaveEdit = async () => {
    if (!editingComment) return;

    const { userId, commentId, text } = editingComment;
    const trimmedText = text.trim();

    if (!trimmedText) {
      toast.warn("Comment cannot be empty.");
      return;
    }

    const promotionDocId = "activePromotion";
    const commentDocRef = doc(dbFirestore, "users", userId, "promotions", promotionDocId, "comments", commentId);

    try {
      await updateDoc(commentDocRef, {
        comment: trimmedText,
      });
      toast.success("Comment updated successfully.");
      setEditingComment(null);
    } catch (err) {
      console.error("Error updating comment:", err);
      toast.error("Failed to update comment.");
    }
  };

  const handleDeleteComment = async (userId: string, commentId: string) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    const promotionDocId = "activePromotion";
    const commentDocRef = doc(dbFirestore, "users", userId, "promotions", promotionDocId, "comments", commentId);

    try {
      await deleteDoc(commentDocRef);
      toast.success("Comment deleted successfully.");
    } catch (err) {
      console.error("Error deleting comment:", err);
      toast.error("Failed to delete comment.");
    }
  };

  const buttonPrimary = "px-4 py-2 bg-[#f3c700] text-black font-bold rounded hover:bg-yellow-300 transition-colors duration-200";
  const buttonSecondary = "px-3 py-1 border border-[#f3c700] text-[#f3c700] rounded hover:bg-[#f3c700]/10 transition-colors duration-200 text-xs";
  const buttonWarning = "px-3 py-1 rounded text-xs bg-orange-500 hover:bg-orange-400 text-white";
  const iconButton = "text-white/60 hover:text-[#f3c700] cursor-pointer transition-colors duration-150";
  const iconButtonSave = "text-green-400 hover:text-green-300 cursor-pointer transition-colors duration-150";
  const iconButtonCancel = "text-red-500 hover:text-red-400 cursor-pointer transition-colors duration-150";
  const iconButtonDelete = "text-red-500 hover:text-red-400 cursor-pointer transition-colors duration-150";
  const inputStyle = "w-full p-2 bg-black/80 text-white rounded border border-[#f3c700] text-sm focus:ring-[#f3c700] focus:border-[#f3c700]";
  const cardBase = "p-4 bg-black/80 rounded-lg shadow-lg border border-[#f3c700]/50";
  const textPrimary = "text-white";
  const textSecondary = "text-white/70";
  const textAccent = "text-[#f3c700]";
  const borderAccent = "border-[#f3c700]";

  const totalVoters = adminVoters.length;

  const getVoteDisplay = (vote: PromotionVote | undefined) => {
    switch (vote) {
      case 'promote': return { text: 'Promote', className: 'text-green-400' };
      case 'deny': return { text: 'Do Not Promote', className: 'text-red-500' };
      case 'needs_time': return { text: 'Needs More Time', className: 'text-orange-400' };
      default: return { text: 'N/A', className: 'text-white/50' };
    }
  };

  console.log("PromotionsTab rendering JSX. Loading:", loading, "Error:", error);
  return (
    <Layout>
      <div
        className="page-content space-y-6 p-6 text-white/80 min-h-screen bg-cover bg-center bg-no-repeat bg-fixed"
        style={{ backgroundImage: `url(${backgroundImage})`, fontFamily: "'Inter', sans-serif" }}
      >
        <div className="bg-black/75 text-[#f3c700] font-sans p-4 rounded-lg shadow-lg mb-6">
          <h1 className="text-2xl font-bold text-center mb-4">Promotion Review</h1>

          <div className="flex space-x-6 border-b border-[#f3c700] mb-6">
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "text-[#f3c700] border-b-2 border-[#f3c700] pointer-events-none"
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
                    ? "text-[#f3c700] border-b-2 border-[#f3c700] pointer-events-none"
                    : "text-white/60 hover:text-[#f3c700]"
                }`
              }
              aria-current={location.pathname === '/promotions' ? 'page' : undefined}
            >
              Promotions
            </NavLink>
            <NavLink
              to="/bulletins"
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "text-[#f3c700] border-b-2 border-[#f3c700] pointer-events-none"
                    : "text-white/60 hover:text-[#f3c700]"
                }`
              }
              aria-current={location.pathname === '/bulletins' ? 'page' : undefined}
            >
              Bulletins
            </NavLink>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
             <div className="relative w-full sm:w-auto max-w-xs">
               <input
                 type="text"
                 placeholder="Search by name..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className={`${inputStyle} pl-8`}
               />
               <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white/50" size="0.9em"/>
             </div>
             <label className="flex items-center gap-2 cursor-pointer text-xs text-white/80 hover:text-white">
               <input
                 type="checkbox"
                 checked={showHiddenByVotes}
                 onChange={(e) => setShowHiddenByVotes(e.target.checked)}
                 className="h-4 w-4 rounded border-gray-300 text-[#f3c700] focus:ring-[#f3c700] bg-black/50"
               />
               <FaFilter size="0.9em"/>
               Show Manually Hidden
             </label>
          </div>
        </div>

        {loading && <p className="italic text-white/60">Loading promotion candidates...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredPromotionData.length === 0 && (
                <p className="text-white/60 italic col-span-full text-center">
                    {Object.keys(promotionData).length === 0
                        ? "No users currently eligible for promotion review."
                        : "No eligible users match the current filters."}
                </p>
            )}

            {filteredPromotionData.map((userPromoData) => {
              const userId = userPromoData.id;
              const voteData = userPromoData.voteData;
              const isManuallyHidden = voteData?.isManuallyHidden ?? false;

              const allVotes = Object.values(voteData?.votes || {});
              const promoteVotes = allVotes.filter(v => v === 'promote').length;
              const denyVotes = allVotes.filter(v => v === 'deny').length;
              const needsTimeVotes = allVotes.filter(v => v === 'needs_time').length;
              const totalVotesCast = promoteVotes + denyVotes + needsTimeVotes;
              const currentUserVote = currentUser?.email ? voteData?.votes[currentUser.email] : undefined;
              const comments = userPromoData.comments || [];
              const voteDisplay = getVoteDisplay(currentUserVote);

              return (
                <div
                  key={userId}
                  ref={el => { userCardRefs.current[userId] = el; }}
                  className={`${cardBase} space-y-4 ${
                    (isManuallyHidden && showHiddenByVotes ? 'opacity-70 border-dashed border-orange-500' : '')
                  } ${
                    highlightedUserId === userId ? 'ring-2 ring-offset-2 ring-[#f3c700] ring-offset-black/80 scale-102' : ''
                  }`}
                  title={isManuallyHidden && showHiddenByVotes ? 'This user is manually hidden' : ''}
                >
                  <div>
                    <div className="flex justify-between items-start mb-1">
                        <h3 className={`text-xl font-bold ${textAccent}`}>{userPromoData.name}</h3>
                        <button
                            onClick={() => handleToggleManualHide(userId)}
                            className={`text-xs px-1.5 py-0.5 rounded border flex items-center gap-1 transition-colors ${
                                isManuallyHidden
                                ? 'text-green-400 bg-green-900/60 border-green-600 hover:bg-green-800/60'
                                : 'text-orange-400 bg-orange-900/60 border-orange-600 hover:bg-orange-800/60'
                            }`}
                            title={isManuallyHidden ? 'Click to Show' : 'Click to Hide'}
                        >
                            {isManuallyHidden ? <FaEye size="0.65rem"/> : <FaEyeSlash size="0.65rem"/>}
                            {isManuallyHidden ? 'Show' : 'Hide'}
                        </button>
                    </div>
                    <p className={`text-sm ${textSecondary}`}>{userPromoData.rank} - Badge: {userPromoData.badge}</p>
                    <p className={`text-xs ${textSecondary}`}>Last Promotion: {formatDateForDisplay(userPromoData.lastPromotionDate)}</p>
                  </div>

                  <div className="border-t border-white/20 pt-4">
                    <h4 className="text-lg font-semibold mb-2 text-white">Poll ({totalVotesCast} / {adminVoters.length} Voted)</h4>
                    <div className="grid grid-cols-3 gap-2 items-center bg-black/50 p-3 rounded border border-white/10">
                      <div className="text-center">
                        <p className="text-green-400 font-bold text-2xl">{promoteVotes}</p>
                        <button
                          onClick={() => handleVote(userId, 'promote')}
                          className={`mt-1 ${currentUserVote === 'promote' ? 'ring-2 ring-offset-2 ring-offset-black/50 ring-green-400' : ''} bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs transition-all duration-150`}
                        >
                          Promote
                        </button>
                      </div>
                      <div className="text-center">
                        <p className="text-orange-400 font-bold text-2xl">{needsTimeVotes}</p>
                        <button
                          onClick={() => handleVote(userId, 'needs_time')}
                          className={`mt-1 ${currentUserVote === 'needs_time' ? 'ring-2 ring-offset-2 ring-offset-black/50 ring-orange-400' : ''} ${buttonWarning} px-3 py-1 rounded text-xs transition-all duration-150`}
                        >
                          Needs Time
                        </button>
                      </div>
                      <div className="text-center">
                        <p className="text-red-500 font-bold text-2xl">{denyVotes}</p>
                        <button
                          onClick={() => handleVote(userId, 'deny')}
                          className={`mt-1 ${currentUserVote === 'deny' ? 'ring-2 ring-offset-2 ring-offset-black/50 ring-red-500' : ''} bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs transition-all duration-150`}
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                    {currentUserVote && (
                      <p className="text-xs text-center italic text-white/60 mt-2">
                        You voted: <span className={voteDisplay.className}>{voteDisplay.text}</span>
                      </p>
                    )}
                  </div>

                  <div className="border-t border-white/20 pt-4">
                    <h4 className="text-lg font-semibold mb-2 text-white">Discussion</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1 mb-3 border border-white/10 rounded p-2 bg-black/30">
                      {comments.length === 0 && <p className="text-white/50 italic text-xs">No comments yet.</p>}
                      {comments.map(comment => {
                        const isEditingThisComment = editingComment?.userId === userId && editingComment?.commentId === comment.id;
                        const canManage = currentUser?.email === comment.commenterEmail || isHCAdmin;

                        return (
                          <div key={comment.id} className="p-1.5 rounded border border-[#f3c700]/40 bg-black/50 text-xs relative group">
                            {isEditingThisComment ? (
                              <div className="space-y-1">
                                <textarea
                                  value={editingComment.text}
                                  onChange={(e) => setEditingComment({ ...editingComment, text: e.target.value })}
                                  className={`${inputStyle} text-xs p-1 h-16`}
                                  rows={3}
                                />
                                <div className="flex justify-end items-center gap-2">
                                  <FaTimes title="Cancel Edit" className={iconButtonCancel} onClick={handleCancelEdit} />
                                  <FaSave title="Save Changes" className={iconButtonSave} onClick={handleSaveEdit} />
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-white/90 pr-8">{comment.comment}</p>
                                <small className="text-white/60 block mt-0.5 text-[10px]">
                                  By: {comment.commenterName} on {formatTimestampDateTime(comment.createdAt)}
                                </small>
                                {canManage && (
                                  <div className="absolute top-1 right-1 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <FaEdit title="Edit Comment" className={iconButton} onClick={() => handleEditComment(userId, comment)} />
                                    <FaTrash title="Delete Comment" className={iconButtonDelete} onClick={() => handleDeleteComment(userId, comment.id)} />
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add a comment..."
                        value={newComments[userId] || ""}
                        onChange={(e) => setNewComments(prev => ({ ...prev, [userId]: e.target.value }))}
                        className={`${inputStyle} flex-grow`}
                      />
                      <button
                        onClick={() => handleAddComment(userId)}
                        className={buttonSecondary}
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
