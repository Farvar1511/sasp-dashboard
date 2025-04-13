import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase"; // Firestore DB
import Layout from "./Layout";
import { User as AuthUser } from "../types/User"; // Import types, rename User to AuthUser to avoid conflict
import { useNavigate } from "react-router-dom"; // Import useNavigate

// Interface for user data fetched from Firestore
interface FirestoreUser {
  id: string; // Document ID
  name: string;
  rank: string;
  badge: string;
  callsign: string;
  certifications: { [key: string]: string | null };
  discordId: string;
  isActive: boolean;
  loaStartDate: string | null;
  loaEndDate: string | null;
}

// Define CertStatus type
type CertStatus = "LEAD" | "SUPER" | "CERT" | null;

export default function AdminMenu({ user }: { user: AuthUser }) {
  const [allUsersData, setAllUsersData] = useState<FirestoreUser[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<FirestoreUser | null>(null);
  const [editedName, setEditedName] = useState<string>("");
  const [editedRank, setEditedRank] = useState<string>("");
  const [editedBadge, setEditedBadge] = useState<string>("");
  const [editedCallsign, setEditedCallsign] = useState<string>("");
  const [editedDiscordId, setEditedDiscordId] = useState<string>("");
  const [editedIsActive, setEditedIsActive] = useState<boolean>(false);
  const [editedLoaStart, setEditedLoaStart] = useState<string | null>(null);
  const [editedLoaEnd, setEditedLoaEnd] = useState<string | null>(null);
  const [editedCerts, setEditedCerts] = useState<{ [key: string]: CertStatus }>(
    {}
  );

  // State for collapsible sections
  const [showAddBulletin, setShowAddBulletin] = useState(false);
  const [showAssignTask, setShowAssignTask] = useState(false);

  const [bulletinTitle, setBulletinTitle] = useState("");
  const [bulletinBody, setBulletinBody] = useState("");
  const [bulletinError, setBulletinError] = useState<string | null>(null);

  const navigate = useNavigate();

  // Fetch users from Firestore
  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true);
      setUsersError(null);
      try {
        const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
        const usersData = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as FirestoreUser[];
        setAllUsersData(usersData);
      } catch (error) {
        console.error("Error fetching users:", error);
        setUsersError("Failed to load user data.");
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleSelectUser = (user: FirestoreUser) => {
    setSelectedUser(user);
    setEditedName(user.name);
    setEditedRank(user.rank);
    setEditedBadge(user.badge);
    setEditedCallsign(user.callsign);
    setEditedDiscordId(user.discordId);
    setEditedIsActive(user.isActive);
    setEditedLoaStart(user.loaStartDate);
    setEditedLoaEnd(user.loaEndDate);
    setEditedCerts(
      Object.fromEntries(
        Object.entries(user.certifications).map(([key, value]) => [
          key,
          value === "LEAD" || value === "SUPER" || value === "CERT"
            ? value
            : null,
        ])
      )
    );
  };

  const handleCertChange = (certKey: string, value: CertStatus) => {
    setEditedCerts((prev) => ({
      ...prev,
      [certKey]: value,
    }));
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) {
      console.error("No user selected for update");
      alert("No user selected for update.");
      return;
    }

    try {
      const userRef = doc(dbFirestore, "users", selectedUser.id);

      // Construct the update data object
      const updateData: Partial<FirestoreUser> = {
        name: editedName.trim(),
        rank: editedRank.trim(),
        badge: editedBadge.trim(),
        callsign: editedCallsign.trim(),
        discordId: editedDiscordId.trim(),
        isActive: editedIsActive,
        loaStartDate: editedLoaStart || null,
        loaEndDate: editedLoaEnd || null,
        certifications: editedCerts,
      };

      // Log the data being sent to Firestore for debugging
      console.log("Updating user with data:", updateData);

      // Write the updated data to Firestore
      await updateDoc(userRef, updateData);

      // Update the local state to reflect the changes
      setAllUsersData((prevUsers) =>
        prevUsers.map((u) =>
          u.id === selectedUser.id ? { ...u, ...updateData } : u
        )
      );

      // Clear the selected user and close the modal
      setSelectedUser(null);

      console.log(`User ${selectedUser.id} updated successfully.`);
      alert("Roster data saved successfully!");
    } catch (error) {
      console.error("Error updating user:", error);
      alert(
        `Failed to save roster data. Error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  const addBulletin = async () => {
    if (!bulletinTitle || !bulletinBody) {
      setBulletinError("Bulletin title and body are required.");
      return;
    }
    setBulletinError(null);
    try {
      await addDoc(collection(dbFirestore, "bulletins"), {
        title: bulletinTitle,
        body: bulletinBody,
        createdAt: serverTimestamp(),
      });
      setBulletinTitle("");
      setBulletinBody("");
      setShowAddBulletin(false);
      alert("Bulletin added successfully!");
    } catch (err) {
      console.error("Error adding bulletin:", err);
      setBulletinError("Failed to add bulletin.");
    }
  };

  return (
    <Layout user={user}>
      <div className="page-content space-y-6">
        <h1 className="text-3xl font-bold text-[#f3c700]">Admin Menu</h1>

        {/* Admin Menu Buttons */}
        <div className="flex flex-wrap gap-4 mb-4">
          <button
            className="button-primary px-3 py-1.5 text-sm"
            onClick={() => {
              setShowAddBulletin(!showAddBulletin);
              setShowAssignTask(false);
            }}
          >
            {showAddBulletin ? "Hide" : "Show"} Add Bulletin
          </button>
          <button
            className="button-primary px-3 py-1.5 text-sm"
            onClick={() => {
              setShowAssignTask(!showAssignTask);
              setShowAddBulletin(false);
            }}
          >
            {showAssignTask ? "Hide" : "Show"} Assign Task
          </button>
          <button
            className="button-secondary px-3 py-1.5 text-sm"
            onClick={() => navigate("/admin/discipline")}
          >
            Discipline & Notes
          </button>
          <button
            className="button-secondary px-3 py-1.5 text-sm"
            onClick={() => navigate("/admin/roster")}
          >
            Roster Management
          </button>
          <button
            className="button-secondary px-3 py-1.5 text-sm"
            onClick={() => navigate("/admin/fleet")}
          >
            Fleet Management
          </button>
        </div>

        {/* Add Bulletin Section */}
        {showAddBulletin && (
          <div className="admin-section p-4 mb-6">
            <h2 className="section-header text-xl mb-3">Add Bulletin</h2>
            {bulletinError && (
              <p className="text-red-500 mb-3 text-sm">{bulletinError}</p>
            )}
            <input
              type="text"
              className="input mb-2 text-sm"
              placeholder="Bulletin Title"
              value={bulletinTitle}
              onChange={(e) => setBulletinTitle(e.target.value)}
            />
            <textarea
              className="input mb-3 text-sm"
              placeholder="Bulletin Body"
              rows={3}
              value={bulletinBody}
              onChange={(e) => setBulletinBody(e.target.value)}
            />
            <button
              className="button-primary text-sm px-3 py-1.5"
              onClick={addBulletin}
            >
              Add Bulletin
            </button>
          </div>
        )}

        {/* Users Section */}
        <div className="admin-section p-4">
          <h2 className="section-header text-xl mb-3">Users</h2>
          {usersLoading && (
            <p className="text-yellow-400 italic text-sm">Loading users...</p>
          )}
          {usersError && (
            <p className="text-red-500 mb-4 text-sm">{usersError}</p>
          )}
          {!usersLoading && !usersError && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allUsersData.map((userData) => (
                <div
                  key={userData.id}
                  className="user-card p-3 border border-gray-700 rounded-lg bg-gray-900/50"
                >
                  <h3 className="text-lg font-semibold text-yellow-400 truncate">
                    {userData.name}{" "}
                    <span className="text-xs text-gray-400">
                      ({userData.rank})
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 truncate mb-2">
                    Badge: {userData.badge}
                  </p>
                  <p className="text-xs text-gray-500 truncate mb-2">
                    Callsign: {userData.callsign}
                  </p>
                  <button
                    className="button-primary text-xs px-2 py-1 mt-2"
                    onClick={() => handleSelectUser(userData)}
                  >
                    Edit Roster Data
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit Roster Data Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black/90 z-50 flex justify-center items-center p-4">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-lg relative max-h-[90vh] overflow-y-auto custom-scrollbar">
              <button
                className="absolute top-2 right-3 text-red-500 hover:text-red-400 text-3xl font-bold leading-none"
                onClick={() => setSelectedUser(null)}
              >
                &times;
              </button>
              <h2 className="section-header text-xl mb-4">
                Edit Roster Data for {selectedUser.name} ({selectedUser.rank})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    className="input text-sm"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Rank
                  </label>
                  <input
                    type="text"
                    className="input text-sm"
                    value={editedRank}
                    onChange={(e) => setEditedRank(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Badge
                  </label>
                  <input
                    type="text"
                    className="input text-sm"
                    value={editedBadge}
                    onChange={(e) => setEditedBadge(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Callsign
                  </label>
                  <input
                    type="text"
                    className="input text-sm"
                    value={editedCallsign}
                    onChange={(e) => setEditedCallsign(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Discord ID
                  </label>
                  <input
                    type="text"
                    className="input text-sm"
                    value={editedDiscordId}
                    onChange={(e) => setEditedDiscordId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    LOA Start Date
                  </label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={editedLoaStart || ""}
                    onChange={(e) => setEditedLoaStart(e.target.value || null)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    LOA End Date
                  </label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={editedLoaEnd || ""}
                    onChange={(e) => setEditedLoaEnd(e.target.value || null)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="isActiveCheckbox"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                    checked={editedIsActive}
                    onChange={(e) => setEditedIsActive(e.target.checked)}
                  />
                  <label
                    htmlFor="isActiveCheckbox"
                    className="text-sm font-medium text-gray-300"
                  >
                    Is Active
                  </label>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-yellow-400 mb-2 border-t border-gray-700 pt-3">
                Certifications
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {["ACU", "CIU", "FTO", "HEAT", "K9", "MOTO", "SWAT"].map(
                  (certKey) => (
                    <div key={certKey} className="flex items-center gap-2">
                      <label className="text-sm w-20 flex-shrink-0">
                        {certKey}:
                      </label>
                      <select
                        className="input text-sm flex-grow"
                        value={editedCerts[certKey] || ""}
                        onChange={(e) =>
                          handleCertChange(
                            certKey,
                            e.target.value as CertStatus
                          )
                        }
                      >
                        <option value="">None</option>
                        <option value="CERT">CERT</option>
                        <option value="LEAD">LEAD</option>
                        <option value="SUPER">SUPER</option>
                      </select>
                    </div>
                  )
                )}
              </div>
              <button
                className="button-primary text-sm px-4 py-2 mt-6 w-full"
                onClick={handleUpdateUser}
              >
                Save Roster Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
