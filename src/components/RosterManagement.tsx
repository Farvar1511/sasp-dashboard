import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
  setDoc,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { User as AuthUser } from "../types/User";
import fullRosterTemplate, {
  normalizeTemplateCertKeys,
} from "../data/FullRosterData";

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

const rankCategories: { [key: string]: string[] } = {
  "High Command": [
    "Commissioner",
    "Assistant Deputy Commissioner",
    "Deputy Commissioner",
    "Assistant Commissioner",
    "Commander",
  ],
  Command: ["Captain", "Lieutenant"],
  Supervisors: ["Staff Sergeant", "Sergeant"],
  "State Troopers": ["Corporal", "Trooper First Class", "Trooper"],
  Cadets: ["Cadet"],
};

const categoryOrder = [
  "High Command",
  "Command",
  "Supervisors",
  "State Troopers",
  "Cadets",
];

type CertStatus = "LEAD" | "SUPER" | "CERT" | null;

const certOptions: {
  value: CertStatus;
  label: string;
  bgColor: string;
  textColor: string;
}[] = [
  {
    value: null,
    label: "None",
    bgColor: "bg-gray-700",
    textColor: "text-gray-300",
  },
  {
    value: "CERT",
    label: "CERT",
    bgColor: "bg-green-600",
    textColor: "text-white",
  },
  {
    value: "LEAD",
    label: "LEAD",
    bgColor: "bg-blue-600",
    textColor: "text-white",
  },
  {
    value: "SUPER",
    label: "SUPER",
    bgColor: "bg-orange-600",
    textColor: "text-white",
  },
];

const certKeys: string[] = [
  "ACU",
  "CIU",
  "K9",
  "HEAT",
  "MOTO",
  "FTO",
  "SWAT",
  "OVERWATCH",
];

const certificationKeys = ["HEAT", "MOTO", "ACU"];
const divisionKeys = ["SWAT", "CIU", "K9", "FTO"];
const additionalInfoKeys = [
  "loaStartDate",
  "loaEndDate",
  "isActive",
  "discordId",
];
const allCertAndDivisionKeys = [
  ...certificationKeys,
  ...divisionKeys,
  "OVERWATCH",
];

interface RosterUser {
  id: string;
  name: string;
  rank: string;
  badge?: string;
  callsign?: string;
  certifications?: {
    [key: string]: CertStatus;
  };
  loaStartDate?: string | Timestamp;
  loaEndDate?: string | Timestamp;
  isActive?: boolean;
  discordId?: string;
  email?: string;
  isPlaceholder?: boolean;
}

const processRosterData = (
  usersData: RosterUser[]
): {
  sortedRoster: RosterUser[];
  groupedRoster: { [category: string]: RosterUser[] };
} => {
  const categorizedUsers = usersData
    .map((user) => {
      let category = null;
      for (const cat of categoryOrder) {
        if (rankCategories[cat]?.includes(user.rank)) {
          category = cat;
          break;
        }
      }
      if (
        !category &&
        user.rank &&
        user.rank !== "Unknown" &&
        user.rank !== ""
      ) {
        console.warn(
          `User ${user.name} (${user.callsign}) has rank "${user.rank}" which doesn't fit into defined categories.`
        );
      }
      return { ...user, category };
    })
    .filter((user) => user.category !== null);

  const sortedRoster = categorizedUsers.sort((a, b) => {
    const categoryIndexA = categoryOrder.indexOf(a.category!);
    const categoryIndexB = categoryOrder.indexOf(b.category!);
    if (categoryIndexA !== categoryIndexB) {
      return categoryIndexA - categoryIndexB;
    }

    const rankA = rankOrder[a.rank] ?? rankOrder.Unknown;
    const rankB = rankOrder[b.rank] ?? rankOrder.Unknown;
    if (rankA !== rankB) {
      return rankA - rankB;
    }

    const callsignA = a.callsign || "";
    const callsignB = b.callsign || "";
    return callsignA.localeCompare(callsignB);
  });

  const grouped: { [category: string]: RosterUser[] } = {};
  categoryOrder.forEach((cat) => {
    grouped[cat] = [];
  });

  sortedRoster.forEach((u) => {
    grouped[u.category!].push(u);
  });

  return { sortedRoster, groupedRoster: grouped };
};

const formatDateForInput = (
  dateValue: string | Timestamp | undefined | null
): string => {
  if (!dateValue) return "";
  try {
    const date =
      dateValue instanceof Timestamp ? dateValue.toDate() : new Date(dateValue);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
  } catch {
    return "";
  }
};

const RosterManagement: React.FC<{ user: AuthUser }> = ({ user }) => {
  const [roster, setRoster] = useState<RosterUser[]>([]);
  const [groupedRoster, setGroupedRoster] = useState<{
    [category: string]: RosterUser[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<RosterUser | null>(null);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUser, setNewUser] = useState<Partial<RosterUser>>({
    name: "",
    rank: "Cadet",
    badge: "",
    email: "",
    isActive: true,
    certifications: {},
  });
  const [addUserError, setAddUserError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    const fetchAndMergeRoster = async () => {
      setLoading(true);
      setError(null);
      try {
        const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
        const liveUsersData = usersSnapshot.docs.map((doc) => {
          const data = doc.data();
          const normalizedCerts = data.certifications
            ? Object.entries(data.certifications).reduce(
                (acc, [key, value]) => {
                  acc[key.toUpperCase()] = value as CertStatus;
                  return acc;
                },
                {} as { [key: string]: CertStatus }
              )
            : {};
          return {
            id: doc.id,
            name: data.name || "Unknown",
            rank: data.rank || "Unknown",
            badge: data.badge || "N/A",
            callsign: data.callsign || "",
            certifications: normalizedCerts,
            loaStartDate: data.loaStartDate || undefined,
            loaEndDate: data.loaEndDate || undefined,
            isActive: data.isActive !== undefined ? data.isActive : true,
            discordId: data.discordId || "",
            email: doc.id,
            isPlaceholder: false,
          } as RosterUser;
        });

        const liveUserMap = new Map<string, RosterUser>();
        liveUsersData.forEach((user) => {
          if (user.callsign) {
            liveUserMap.set(user.callsign, user);
          }
        });

        const mergedRoster: RosterUser[] = fullRosterTemplate.map(
          (templateEntry) => {
            const liveUser = templateEntry.callsign
              ? liveUserMap.get(templateEntry.callsign)
              : undefined;
            if (liveUser) {
              return {
                ...liveUser,
                callsign: templateEntry.callsign,
                isPlaceholder: false,
              };
            } else {
              return {
                id: `template-${templateEntry.callsign || Math.random()}`,
                name: templateEntry.name,
                rank: templateEntry.rank,
                badge: templateEntry.badge || "N/A",
                callsign: templateEntry.callsign,
                certifications: normalizeTemplateCertKeys(
                  templateEntry.certifications
                ),
                loaStartDate: templateEntry.loaStartDate || undefined,
                loaEndDate: templateEntry.loaEndDate || undefined,
                isActive:
                  typeof templateEntry.isActive === "boolean"
                    ? templateEntry.isActive
                    : false,
                discordId: templateEntry.discordId || "",
                email: templateEntry.email || "",
                isPlaceholder: true,
              } as RosterUser;
            }
          }
        );

        setRoster(mergedRoster);
      } catch (err) {
        console.error("Error fetching or merging roster:", err);
        setError("Failed to load roster. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchAndMergeRoster();
  }, []);

  const processedAndFilteredRoster = useMemo(() => {
    if (!roster || roster.length === 0) {
      return { filtered: [], grouped: {} };
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = lowerSearchTerm
      ? roster.filter(
          (u) =>
            u.name?.toLowerCase().includes(lowerSearchTerm) ||
            u.badge?.toLowerCase().includes(lowerSearchTerm) ||
            u.callsign?.toLowerCase().includes(lowerSearchTerm)
        )
      : roster;

    const grouped: { [category: string]: RosterUser[] } = {};
    categoryOrder.forEach((cat) => {
      grouped[cat] = [];
    });

    const sortedFiltered = [...filtered].sort((a, b) => {
      const rankA = rankOrder[a.rank] ?? rankOrder.Unknown;
      const rankB = rankOrder[b.rank] ?? rankOrder.Unknown;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      const callsignA = a.callsign || "";
      const callsignB = b.callsign || "";
      return callsignA.localeCompare(callsignB);
    });

    sortedFiltered.forEach((u) => {
      let foundCategory = false;
      for (const category of categoryOrder) {
        if (rankCategories[category]?.includes(u.rank)) {
          grouped[category].push(u);
          foundCategory = true;
          break;
        }
      }
    });

    const finalGrouped: { [category: string]: RosterUser[] } = {};
    categoryOrder.forEach((cat) => {
      if (grouped[cat] && grouped[cat].length > 0) {
        finalGrouped[cat] = grouped[cat];
      }
    });

    return { filtered: sortedFiltered, grouped: finalGrouped };
  }, [roster, searchTerm]);

  useEffect(() => {
    setGroupedRoster(processedAndFilteredRoster.grouped);
  }, [processedAndFilteredRoster]);

  const handleEditChange = (field: keyof RosterUser, value: any) => {
    if (!editingUser) return;
    setEditingUser((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const handleCertChange = (certKey: string, value: CertStatus) => {
    if (!editingUser) return;
    setEditingUser((prev) =>
      prev
        ? {
            ...prev,
            certifications: {
              ...(prev.certifications || {}),
              [certKey]: value,
            },
          }
        : null
    );
  };

  const saveUserChanges = async () => {
    if (!editingUser || editingUser.name === "VACANT") {
      console.warn("Attempted to save a vacant roster entry.");
      setEditingUser(null);
      return;
    }

    const userDocRef = doc(dbFirestore, "users", editingUser.id);
    const cleanCertifications = certKeys.reduce((acc, key) => {
      const val = editingUser.certifications?.[key] || null;
      acc[key] = ["LEAD", "SUPER", "CERT"].includes(val as string)
        ? (val as CertStatus)
        : null;
      return acc;
    }, {} as { [key: string]: CertStatus });

    const dataToUpdate: { [key: string]: any } = {
      ...editingUser,
      certifications: cleanCertifications,
      loaStartDate: editingUser.loaStartDate
        ? formatDateForInput(editingUser.loaStartDate)
        : null,
      loaEndDate: editingUser.loaEndDate
        ? formatDateForInput(editingUser.loaEndDate)
        : null,
    };

    delete dataToUpdate.id;
    delete dataToUpdate.email;
    dataToUpdate.loaStartDate = dataToUpdate.loaStartDate || null;
    dataToUpdate.loaEndDate = dataToUpdate.loaEndDate || null;

    try {
      await updateDoc(userDocRef, dataToUpdate);

      const updatedUserForState: RosterUser = {
        ...editingUser,
        certifications: cleanCertifications,
        loaStartDate: dataToUpdate.loaStartDate || undefined,
        loaEndDate: dataToUpdate.loaEndDate || undefined,
      };

      const updatedRosterList = roster.map((u) =>
        u.id === editingUser.id
          ? { ...updatedUserForState, isPlaceholder: false }
          : u
      );

      const { sortedRoster, groupedRoster: updatedGroupedRoster } =
        processRosterData(updatedRosterList);

      setRoster(sortedRoster);
      setGroupedRoster(updatedGroupedRoster);
      setEditingUser(null);
    } catch (err) {
      console.error("Error updating user:", err);
      alert(
        `Failed to save changes. Error: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  const handleNewUserChange = (field: keyof RosterUser, value: any) => {
    setNewUser((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddNewUser = async () => {
    setAddUserError(null);

    if (!newUser.email || !newUser.name || !newUser.badge || !newUser.rank) {
      setAddUserError("Email, Name, Badge, and Rank are required.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(newUser.email)) {
      setAddUserError("Please enter a valid email address.");
      return;
    }

    const userDocRef = doc(dbFirestore, "users", newUser.email);
    const userDataToAdd = {
      name: newUser.name,
      rank: newUser.rank,
      badge: newUser.badge,
      callsign: newUser.callsign || "",
      certifications: {},
      loaStartDate: newUser.loaStartDate || null,
      loaEndDate: newUser.loaEndDate || null,
      isActive: newUser.isActive !== undefined ? newUser.isActive : true,
      discordId: newUser.discordId || "",
    };

    try {
      await setDoc(userDocRef, userDataToAdd);

      const addedUser: RosterUser = {
        id: newUser.email,
        email: newUser.email,
        name: userDataToAdd.name,
        rank: userDataToAdd.rank,
        badge: userDataToAdd.badge,
        callsign: userDataToAdd.callsign,
        certifications: userDataToAdd.certifications,
        loaStartDate: userDataToAdd.loaStartDate || undefined,
        loaEndDate: userDataToAdd.loaEndDate || undefined,
        isActive: userDataToAdd.isActive,
        discordId: userDataToAdd.discordId,
        isPlaceholder: false,
      };

      const updatedRosterList = [
        ...roster.filter((u) => u.callsign !== addedUser.callsign),
        addedUser,
      ];

      const { sortedRoster, groupedRoster: updatedGroupedRoster } =
        processRosterData(updatedRosterList);

      setRoster(sortedRoster);
      setGroupedRoster(updatedGroupedRoster);

      setNewUser({
        name: "",
        rank: "Cadet",
        badge: "",
        email: "",
        isActive: true,
        certifications: {},
      });

      setShowAddUserForm(false);
      alert("Trooper added successfully!");
    } catch (err) {
      console.error("Error adding user:", err);
      setAddUserError("Failed to add trooper. Please try again.");
    }
  };

  const getCertStyle = (
    status: CertStatus
  ): { bgColor: string; textColor: string } => {
    return (
      certOptions.find((opt) => opt.value === status) || {
        bgColor: "bg-gray-700",
        textColor: "text-gray-300",
      }
    );
  };

  return (
    <Layout user={user}>
      <div className="page-content space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-[#f3c700]">
            Roster Management
          </h1>
          <button
            className="button-primary text-sm px-3 py-1.5"
            onClick={() => setShowAddUserForm(!showAddUserForm)}
          >
            {showAddUserForm ? "Cancel Add" : "Add Trooper"}
          </button>
        </div>

        {showAddUserForm && (
          <div className="admin-section p-4 mb-6">
            <h2 className="section-header text-xl mb-3">Add New Trooper</h2>
            {addUserError && (
              <p className="text-red-500 mb-3 text-sm">{addUserError}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="email"
                placeholder="Email (used as ID)"
                value={newUser.email || ""}
                onChange={(e) => handleNewUserChange("email", e.target.value)}
                className="input text-sm"
                required
              />
              <input
                type="text"
                placeholder="Full Name"
                value={newUser.name || ""}
                onChange={(e) => handleNewUserChange("name", e.target.value)}
                className="input text-sm"
                required
              />
              <input
                type="text"
                placeholder="Badge Number"
                value={newUser.badge || ""}
                onChange={(e) => handleNewUserChange("badge", e.target.value)}
                className="input text-sm"
                required
              />
              <select
                value={newUser.rank || "Cadet"}
                onChange={(e) => handleNewUserChange("rank", e.target.value)}
                className="input text-sm"
                required
              >
                {Object.keys(rankOrder)
                  .filter((r) => r !== "Unknown")
                  .sort((a, b) => rankOrder[a] - rankOrder[b])
                  .map((rank) => (
                    <option key={rank} value={rank}>
                      {rank}
                    </option>
                  ))}
              </select>
            </div>
            <button
              className="button-primary text-sm px-3 py-1.5 mt-4"
              onClick={handleAddNewUser}
            >
              Save New Trooper
            </button>
          </div>
        )}

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by Name, Badge, or Callsign..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input w-full md:w-1/2 lg:w-1/3"
          />
        </div>

        {loading && <p className="text-yellow-400 italic">Loading roster...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-full bg-gray-900/50 border border-gray-700 text-sm">
              <thead className="bg-gray-800 text-yellow-400">
                <tr>
                  <th className="p-2 border-r border-gray-600 w-8"></th>
                  <th className="p-2 border-r border-gray-600">Badge</th>
                  <th className="p-2 border-r border-gray-600">Rank</th>
                  <th className="p-2 border-r border-gray-600">Name</th>
                  <th className="p-2 border-r border-gray-600">Callsign</th>
                  {certificationKeys.map((cert) => (
                    <th key={cert} className="p-2 border-r border-gray-600">
                      {cert}
                    </th>
                  ))}
                  {divisionKeys.map((div) => (
                    <th key={div} className="p-2 border-r border-gray-600">
                      {div}
                    </th>
                  ))}
                  <th className="p-2 border-r border-gray-600">LOA Start</th>
                  <th className="p-2 border-r border-gray-600">LOA End</th>
                  <th className="p-2 border-r border-gray-600">Active</th>
                  <th className="p-2 border-r border-gray-600">Discord ID</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              {Object.entries(groupedRoster).map(
                ([category, usersInCategory]) =>
                  usersInCategory.length > 0 ? (
                    <tbody key={category} className="text-gray-300">
                      {usersInCategory.map((u, index) => {
                        const isVacant = u.name === "VACANT";
                        return (
                          <tr
                            key={u.id}
                            className={`border-t border-gray-700 hover:bg-gray-800/50 ${
                              isVacant ? "italic opacity-60" : ""
                            } ${!isVacant && !u.isActive ? "opacity-60" : ""}`}
                          >
                            {index === 0 && (
                              <td
                                rowSpan={usersInCategory.length}
                                className="p-2 border-r border-l border-gray-600 align-middle text-center font-semibold text-yellow-300 category-vertical"
                                style={{ writingMode: "vertical-lr" }}
                              >
                                {category}
                              </td>
                            )}

                            {editingUser?.id === u.id && !isVacant ? (
                              <>
                                <td className="p-1 border-r border-gray-600">
                                  <input
                                    type="text"
                                    value={editingUser.badge || ""}
                                    onChange={(e) =>
                                      handleEditChange("badge", e.target.value)
                                    }
                                    className="input-table"
                                  />
                                </td>
                                <td className="p-1 border-r border-gray-600">
                                  <select
                                    value={editingUser.rank}
                                    onChange={(e) =>
                                      handleEditChange("rank", e.target.value)
                                    }
                                    className="input-table bg-[#f3c700] text-black font-semibold"
                                  >
                                    {Object.keys(rankOrder)
                                      .filter((r) => r !== "Unknown")
                                      .sort(
                                        (a, b) => rankOrder[a] - rankOrder[b]
                                      )
                                      .map((rank) => (
                                        <option
                                          key={rank}
                                          value={rank}
                                          className="text-white bg-gray-700 font-normal"
                                        >
                                          {rank}
                                        </option>
                                      ))}
                                  </select>
                                </td>
                                <td className="p-1 border-r border-gray-600">
                                  {u.name}
                                </td>
                                <td className="p-1 border-r border-gray-600">
                                  <input
                                    type="text"
                                    value={editingUser.callsign || ""}
                                    onChange={(e) =>
                                      handleEditChange(
                                        "callsign",
                                        e.target.value
                                      )
                                    }
                                    className="input-table"
                                  />
                                </td>
                                {certificationKeys.map((certKey) => {
                                  const currentStatus =
                                    editingUser.certifications?.[certKey] ||
                                    null;
                                  const style = getCertStyle(currentStatus);
                                  return (
                                    <td
                                      key={certKey}
                                      className="p-1 border-r border-gray-600"
                                    >
                                      <select
                                        value={currentStatus || ""}
                                        onChange={(e) =>
                                          handleCertChange(
                                            certKey,
                                            e.target.value as CertStatus
                                          )
                                        }
                                        className={`input-table ${style.bgColor} ${style.textColor}`}
                                        style={{ colorScheme: "dark" }}
                                      >
                                        {certOptions.map((opt) => (
                                          <option
                                            key={opt.label}
                                            value={opt.value || ""}
                                            className={`${opt.bgColor} ${opt.textColor}`}
                                          >
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                  );
                                })}
                                {divisionKeys.map((divKey) => {
                                  const currentStatus =
                                    editingUser.certifications?.[divKey] ||
                                    null;
                                  const style = getCertStyle(currentStatus);
                                  return (
                                    <td
                                      key={divKey}
                                      className="p-1 border-r border-gray-600"
                                    >
                                      <select
                                        value={currentStatus || ""}
                                        onChange={(e) =>
                                          handleCertChange(
                                            divKey,
                                            e.target.value as CertStatus
                                          )
                                        }
                                        className={`input-table ${style.bgColor} ${style.textColor}`}
                                        style={{ colorScheme: "dark" }}
                                      >
                                        {certOptions.map((opt) => (
                                          <option
                                            key={opt.label}
                                            value={opt.value || ""}
                                            className={`${opt.bgColor} ${opt.textColor}`}
                                          >
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                  );
                                })}
                                <td className="p-1 border-r border-gray-600">
                                  <input
                                    type="date"
                                    value={formatDateForInput(
                                      editingUser.loaStartDate
                                    )}
                                    onChange={(e) =>
                                      handleEditChange(
                                        "loaStartDate",
                                        e.target.value || null
                                      )
                                    }
                                    className="input-table"
                                  />
                                </td>
                                <td className="p-1 border-r border-gray-600">
                                  <input
                                    type="date"
                                    value={formatDateForInput(
                                      editingUser.loaEndDate
                                    )}
                                    onChange={(e) =>
                                      handleEditChange(
                                        "loaEndDate",
                                        e.target.value || null
                                      )
                                    }
                                    className="input-table"
                                  />
                                </td>
                                <td className="p-1 border-r border-gray-600 text-center">
                                  <input
                                    type="checkbox"
                                    checked={!!editingUser.isActive}
                                    onChange={(e) =>
                                      handleEditChange(
                                        "isActive",
                                        e.target.checked
                                      )
                                    }
                                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                  />
                                </td>
                                <td className="p-1 border-r border-gray-600">
                                  <input
                                    type="text"
                                    value={editingUser.discordId || ""}
                                    onChange={(e) =>
                                      handleEditChange(
                                        "discordId",
                                        e.target.value
                                      )
                                    }
                                    className="input-table"
                                  />
                                </td>
                                <td className="p-1 flex gap-1">
                                  <button
                                    onClick={saveUserChanges}
                                    className="button-primary text-xs px-1 py-0.5"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingUser(null)}
                                    className="button-secondary text-xs px-1 py-0.5"
                                  >
                                    Cancel
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-2 border-r border-gray-600 font-mono">
                                  {u.badge}
                                </td>
                                <td
                                  className={`p-2 border-r border-gray-600 ${
                                    u.rank
                                      ? "bg-[#f3c700] text-black font-semibold"
                                      : ""
                                  }`}
                                >
                                  {u.rank || "-"}
                                </td>
                                <td className="p-2 border-r border-gray-600">
                                  {u.name}
                                </td>
                                <td className="p-2 border-r border-gray-600">
                                  {u.callsign}
                                </td>
                                {certificationKeys.map((certKey) => {
                                  const currentStatus =
                                    u.certifications?.[certKey] || null;
                                  const style = getCertStyle(currentStatus);
                                  return (
                                    <td
                                      key={certKey}
                                      className={`p-0 border-r border-gray-600 text-center align-middle`}
                                    >
                                      <span
                                        className={`block w-full h-full px-2 py-2 font-semibold ${style.bgColor} ${style.textColor}`}
                                      >
                                        {currentStatus || "-"}
                                      </span>
                                    </td>
                                  );
                                })}
                                {divisionKeys.map((divKey) => {
                                  const currentStatus =
                                    u.certifications?.[divKey] || null;
                                  const style = getCertStyle(currentStatus);
                                  return (
                                    <td
                                      key={divKey}
                                      className={`p-0 border-r border-gray-600 text-center align-middle`}
                                    >
                                      <span
                                        className={`block w-full h-full px-2 py-2 font-semibold ${style.bgColor} ${style.textColor}`}
                                      >
                                        {currentStatus || "-"}
                                      </span>
                                    </td>
                                  );
                                })}
                                <td className="p-2 border-r border-gray-600">
                                  {u.loaStartDate
                                    ? formatDateForInput(u.loaStartDate)
                                    : "-"}
                                </td>
                                <td className="p-2 border-r border-gray-600">
                                  {u.loaEndDate
                                    ? formatDateForInput(u.loaEndDate)
                                    : "-"}
                                </td>
                                <td
                                  className={`p-0 border-r border-gray-600 text-center align-middle`}
                                >
                                  {u.name === "VACANT" ? (
                                    <span className="block w-full h-full px-2 py-2 text-gray-500">
                                      -
                                    </span>
                                  ) : (
                                    <span
                                      className={`block w-full h-full px-2 py-2 font-semibold ${
                                        u.isActive
                                          ? "bg-green-600 text-white"
                                          : "bg-red-600 text-white"
                                      }`}
                                    >
                                      {u.isActive ? "YES" : "NO"}
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 border-r border-gray-600">
                                  {u.discordId || "-"}
                                </td>
                                <td className="p-2">
                                  <button
                                    onClick={() =>
                                      u.name !== "VACANT" && setEditingUser(u)
                                    }
                                    className={`button-secondary text-xs px-1 py-0.5 ${
                                      u.name === "VACANT"
                                        ? "opacity-30 cursor-not-allowed"
                                        : ""
                                    }`}
                                    disabled={u.name === "VACANT"}
                                  >
                                    Edit
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  ) : null
              )}
              {Object.keys(groupedRoster).length === 0 &&
                !loading &&
                searchTerm && (
                  <tbody>
                    <tr>
                      <td
                        colSpan={15}
                        className="text-center p-4 text-gray-400 italic"
                      >
                        No troopers found matching "{searchTerm}".
                      </td>
                    </tr>
                  </tbody>
                )}
            </table>
          </div>
        )}
      </div>
      <style>{`
                .input-table {
                    background-color: #374151;
                    color: white;
                    border: 1px solid #4b5563;
                    border-radius: 4px;
                    padding: 2px 4px;
                    width: 100%;
                    min-width: 80px;
                    font-size: 0.875rem;
                }
                .input-table[type="date"] {
                    min-width: 120px;
                    color-scheme: dark;
                }
                .input-table select {
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="%23a0aec0"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 111.414 1.414l-4 4a1 1 01-1.414 0l-4-4a 1 1 010-1.414z" clip-rule="evenodd"/></svg>');
                    background-repeat: no-repeat;
                    background-position: right 0.5rem center;
                    background-size: 1.5em 1.5em;
                    padding-right: 2.5rem;
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    appearance: none;
                }
                .input-table option {
                    background-color: #374151;
                    color: white;
                }
                .input-table option.text-green-400 { color: #34d399; }
                .input-table option.text-blue-400 { color: #60a5fa; }
                .input-table option.text-orange-400 { color: #fb923c; }
                .input-table option.text-gray-500 { color: #6b7280; }
                .form-checkbox {
                    display: inline-block;
                    vertical-align: middle;
                }
                .category-vertical {
                    writing-mode: vertical-lr;
                    text-orientation: mixed;
                    white-space: nowrap;
                    transform: rotate(180deg);
                    padding: 8px 4px;
                }
            `}</style>
    </Layout>
  );
};

export default RosterManagement;
