import React, { useState, useEffect, useMemo, useCallback, JSX } from "react";
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
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { RosterUser } from "../types/User";
import { isOlderThanDays, formatDateForDisplay, formatTimestampDateTime } from "../utils/timeHelpers";
import { getRandomBackgroundImage } from "../utils/backgroundImage";
import { toast } from "react-toastify";
import { FaEdit, FaTrash, FaSave, FaTimes } from "react-icons/fa";

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
  const { user: currentUser, isAdmin } = useAuth();
  const [allUsers, setAllUsers] = useState<RosterUser[]>([]);
  const [promotionData, setPromotionData] = useState<{ [userId: string]: EligibleUserPromotionData }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [newComments, setNewComments] = useState<{ [userId: string]: string }>({});
  const [editingComment, setEditingComment] = useState<{ userId: string; commentId: string; text: string } | null>(null);

  useEffect(() => {
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
    if (!eligibleUsers.length || !currentUser) {
      setLoading(false);
      return;
    }

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
          console.log(`Created initial promotion document for ${eligibleUser.id}`);
        }
      } catch (err) {
        console.error(`Error checking/creating promotion document for ${eligibleUser.id}:`, err);
      }

      const unsubVotes = onSnapshot(promotionDocRef, (docSnap) => {
        setPromotionData(prev => ({
          ...prev,
          [eligibleUser.id]: {
            ...(prev[eligibleUser.id] || initialData[eligibleUser.id]),
            voteData: docSnap.exists() ? (docSnap.data() as PromotionVoteData) : { votes: {} },
          },
        }));
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
      setPromotionData(initialData);
      setLoading(false);
    }).catch(err => {
      console.error("Error setting up promotion listeners:", err);
      setError("An error occurred while initializing promotion data.");
      setLoading(false);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };

  }, [eligibleUsers, currentUser]);

  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]);

  const handleVote = async (userId: string, vote: PromotionVote) => {
    if (!currentUser?.email || !userId) {
      toast.error("Cannot vote. User not identified.");
      return;
    }

    const promotionDocId = "activePromotion";
    const promotionDocRef = doc(dbFirestore, "users", userId, "promotions", promotionDocId);

    try {
      const currentVoteData = promotionData[userId]?.voteData?.votes[currentUser.email];
      const isChangingVote = !!currentVoteData;

      await setDoc(promotionDocRef, {
        votes: {
          [currentUser.email]: vote
        }
      }, { merge: true });

      toast.success(isChangingVote ? `Vote changed for ${promotionData[userId]?.name || 'user'}.` : `Vote recorded for ${promotionData[userId]?.name || 'user'}.`);
    } catch (err) {
      console.error("Error recording vote:", err);
      toast.error("Failed to record vote.");
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

  return (
    <Layout>
      <div
        className="page-content space-y-6 p-6 text-white/80 min-h-screen bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})`, fontFamily: "'Inter', sans-serif" }}
      >
        <div className="bg-black/75 text-[#f3c700] font-sans p-4 rounded-lg shadow-lg mb-6">
          <h1 className="text-2xl font-bold text-center">Promotion Review</h1>
        </div>

        {loading && <p className="italic text-white/60">Loading promotion candidates...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.values(promotionData).length === 0 && <p className="text-white/60 italic col-span-full text-center">No users currently eligible for promotion review.</p>}

            {Object.values(promotionData).map((userPromoData) => {
              const userId = userPromoData.id;
              const votes = userPromoData.voteData?.votes || {};
              const allVotes = Object.values(votes);
              const promoteVotes = allVotes.filter(v => v === 'promote').length;
              const denyVotes = allVotes.filter(v => v === 'deny').length;
              const needsTimeVotes = allVotes.filter(v => v === 'needs_time').length;
              const totalVotesCast = promoteVotes + denyVotes + needsTimeVotes;
              const currentUserVote = currentUser?.email ? votes[currentUser.email] : undefined;
              const comments = userPromoData.comments || [];
              const voteDisplay = getVoteDisplay(currentUserVote);

              return (
                <div key={userId} className={`${cardBase} space-y-4`}>
                  <div>
                    <h3 className={`text-xl font-bold ${textAccent}`}>{userPromoData.name}</h3>
                    <p className={`text-sm ${textSecondary}`}>{userPromoData.rank} - Badge: {userPromoData.badge}</p>
                    <p className={`text-xs ${textSecondary}`}>Last Promotion: {formatDateForDisplay(userPromoData.lastPromotionDate)}</p>
                  </div>

                  <div className="border-t border-white/20 pt-4">
                    <h4 className="text-lg font-semibold mb-2 text-white">Poll ({totalVotesCast} / {totalVoters} Voted)</h4>
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
