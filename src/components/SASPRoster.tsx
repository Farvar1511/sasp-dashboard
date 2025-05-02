import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  getDocs,
  Timestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { useAuth } from "../context/AuthContext";
import { RosterUser, CertStatus } from "../types/User";
import fullRosterTemplate, {
  normalizeTemplateCertKeys,
} from "../data/FullRosterData";
import {
  rankOrder,
  certificationKeys,
  divisionKeys,
  getCertStyle,
} from "../data/rosterConfig";
import { computeIsAdmin } from "../utils/isadmin";
import {
  formatTimestampDateTime,
  formatDateToMMDDYY,
  isOlderThanDays,
} from "../utils/timeHelpers";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";

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

const editPermissionRanks = [
  ...rankCategories["High Command"],
  ...rankCategories["Command"],
];

const processRosterData = (
  usersData: RosterUser[]
): {
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
      return { ...user, category };
    })
    .filter((user) => user.category !== null);

  categorizedUsers.sort((a, b) => {
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
  categorizedUsers.forEach((u) => {
    grouped[u.category!].push(u);
  });

  return { groupedRoster: grouped };
};

const convertToString = (
  value: string | Timestamp | null | undefined
): string => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString().split("T")[0];
  }
  return value || "N/A";
};

const SASPRoster: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isAdmin = computeIsAdmin(currentUser);
  const [groupedRoster, setGroupedRoster] = useState<{
    [category: string]: RosterUser[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideVacant, setHideVacant] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedRank, setSelectedRank] = useState<string>("All");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editedRowData, setEditedRowData] = useState<Partial<RosterUser>>({});
  const [originalRankBeforeEdit, setOriginalRankBeforeEdit] =
    useState<string | null>(null);

  const canEditRoster = useMemo(() => {
    if (isAdmin) return true;
    if (!currentUser || !currentUser.rank) return false;
    return editPermissionRanks.includes(currentUser.rank);
  }, [currentUser, isAdmin]);

  const fetchAndMergeRoster = async () => {
    setLoading(true);
    setError(null);
    try {
      const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
      const liveUsersData = usersSnapshot.docs.map((doc) => {
        const data = doc.data();
        const normalizedCerts = data.certifications
          ? Object.entries(data.certifications).reduce((acc, [key, value]) => {
              const upperValue =
                typeof value === "string" ? value.toUpperCase() : null;
              const validStatus = ["TRAIN", "LEAD", "SUPER", "CERT"].includes(
                upperValue || ""
              )
                ? (upperValue as CertStatus)
                : null;
              acc[key.toUpperCase()] = validStatus;
              return acc;
            }, {} as { [key: string]: CertStatus })
          : {};
        return {
          id: doc.id,
          name: data.name || "Unknown",
          rank: data.rank || "Unknown",
          badge: data.badge || "N/A",
          callsign: data.callsign || "",
          certifications: normalizedCerts,
          loaStartDate:
            typeof data.loaStartDate === "string" ? data.loaStartDate : null,
          loaEndDate:
            typeof data.loaEndDate === "string" ? data.loaEndDate : null,
          isActive: data.isActive !== undefined ? data.isActive : true,
          discordId: data.discordId || "-",
          email: doc.id,
          joinDate: typeof data.joinDate === "string" ? data.joinDate : null,
          lastPromotionDate:
            typeof data.lastPromotionDate === "string"
              ? data.lastPromotionDate
              : null,
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
            if (
              templateEntry.callsign &&
              liveUserMap.has(templateEntry.callsign)
            ) {
              liveUserMap.delete(templateEntry.callsign);
            }
            return {
              ...liveUser,
              callsign: templateEntry.callsign,
              isPlaceholder: false,
            };
          } else {
            const normalizedTemplateEntry =
              normalizeTemplateCertKeys(templateEntry);
            const templateCerts = Object.entries(
              normalizedTemplateEntry.certifications
            ).reduce((acc, [key, value]) => {
              const validStatus = ["TRAIN", "LEAD", "SUPER", "CERT"].includes(
                value?.toUpperCase() || ""
              )
                ? typeof value === "string"
                  ? (value.toUpperCase() as CertStatus)
                  : null
                : null;
              acc[key.toUpperCase()] = validStatus;
              return acc;
            }, {} as { [key: string]: CertStatus });

            const isActive =
              normalizedTemplateEntry.name === "VACANT"
                ? false
                : normalizedTemplateEntry.isActive === true;

            return {
              id: `template-${templateEntry.callsign || Math.random()}`,
              name: normalizedTemplateEntry.name || "VACANT",
              rank: normalizedTemplateEntry.rank || "",
              badge: normalizedTemplateEntry.badge || "N/A",
              callsign: normalizedTemplateEntry.callsign,
              certifications: templateCerts,
              loaStartDate: normalizedTemplateEntry.loaStartDate || null,
              loaEndDate: normalizedTemplateEntry.loaEndDate || null,
              joinDate: normalizedTemplateEntry.joinDate || null,
              lastPromotionDate:
                normalizedTemplateEntry.lastPromotionDate || null,
              isActive: isActive,
              discordId: normalizedTemplateEntry.discordId || "-",
              email: normalizedTemplateEntry.email || "",
              isPlaceholder: true,
            } as RosterUser;
          }
        }
      );

      liveUserMap.forEach((user) => {
        mergedRoster.push(user);
      });

      const lowerSearchTerm = searchTerm.toLowerCase();
      const filteredRoster = mergedRoster.filter((u) => {
        const matchesSearch =
          !lowerSearchTerm ||
          u.name?.toLowerCase().includes(lowerSearchTerm) ||
          u.badge?.toLowerCase().includes(lowerSearchTerm) ||
          u.callsign?.toLowerCase().includes(lowerSearchTerm) ||
          u.rank?.toLowerCase().includes(lowerSearchTerm) ||
          u.discordId?.toLowerCase().includes(lowerSearchTerm);
        const matchesRank = selectedRank === "All" || u.rank === selectedRank;
        const matchesVacant = !hideVacant || u.name !== "VACANT";
        return matchesSearch && matchesRank && matchesVacant;
      });

      const { groupedRoster: processedGroupedRoster } =
        processRosterData(filteredRoster);
      setGroupedRoster(processedGroupedRoster);
    } catch (err) {
      console.error("Error fetching or merging roster:", err);
      setError("Failed to load roster. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndMergeRoster();
  }, [hideVacant, searchTerm, selectedRank, isAdmin]);

  const uniqueRanks = useMemo(() => {
    const ranks = new Set<string>(["All"]);
    Object.values(groupedRoster)
      .flat()
      .forEach((u) => {
        if (u.rank && u.rank.trim()) {
          ranks.add(u.rank.trim());
        }
      });
    return Array.from(ranks).sort((a, b) => {
      if (a === "All") return -1;
      if (b === "All") return 1;
      return (rankOrder[a] ?? 99) - (rankOrder[b] ?? 99);
    });
  }, [groupedRoster]);

  const totalColSpan = 5 + divisionKeys.length + certificationKeys.length + 4;

  const handleEditClick = (user: RosterUser) => {
    if (!canEditRoster) {
      toast.error("You do not have permission to edit the roster.");
      return;
    }
    setEditingRowId(user.id);
    setEditedRowData(user);
    setOriginalRankBeforeEdit(user.rank);
  };

  const handleSaveClick = async () => {
    if (!canEditRoster) {
      toast.error("You do not have permission to save roster edits.");
      return;
    }
    try {
      if (!editedRowData.id || editedRowData.id.trim() === "") {
        console.error("The row does not have a valid Firestore document ID.");
        toast.error("Cannot save rows without a valid Firestore document ID.");
        return;
      }

      if (!editedRowData.name || !editedRowData.callsign) {
        console.error("The row does not have a valid name and callsign.");
        toast.error("Cannot save rows without a valid name and callsign.");
        return;
      }

      console.log("Saving data for row:", editedRowData);

      const userRef = doc(dbFirestore, "users", editedRowData.id);

      const allCertKeys = new Set([
        ...Object.keys(editedRowData.certifications || {}),
        ...certificationKeys,
        "HEAT",
        "MBU",
        "ACU",
      ]);

      const updatedCertifications = Object.fromEntries(
        Array.from(allCertKeys).map((key) => [
          key.toUpperCase(),
          editedRowData.certifications?.[key.toUpperCase()] || "",
        ])
      );

      console.log("Updated certifications:", updatedCertifications);

      let finalLastPromotionDate: string | null = formatDateToMMDDYY(
        editedRowData.lastPromotionDate instanceof Timestamp
          ? editedRowData.lastPromotionDate.toDate()
          : editedRowData.lastPromotionDate
      );

      if (editedRowData.rank && editedRowData.rank !== originalRankBeforeEdit) {
        const currentDate = new Date();
        const formattedCurrentDate = formatDateToMMDDYY(currentDate);
        finalLastPromotionDate = formattedCurrentDate;
        toast.info(
          `Rank changed. Last promotion date updated to ${formattedCurrentDate}.`
        );
      }

      const updatedData = {
        ...editedRowData,
        joinDate: formatDateToMMDDYY(
          editedRowData.joinDate instanceof Timestamp
            ? editedRowData.joinDate.toDate()
            : editedRowData.joinDate
        ),
        lastPromotionDate: finalLastPromotionDate,
        loaStartDate: formatDateToMMDDYY(
          editedRowData.loaStartDate instanceof Timestamp
            ? editedRowData.loaStartDate.toDate()
            : editedRowData.loaStartDate
        ),
        loaEndDate: formatDateToMMDDYY(
          editedRowData.loaEndDate instanceof Timestamp
            ? editedRowData.loaEndDate.toDate()
            : editedRowData.loaEndDate
        ),
        certifications: updatedCertifications,
      };

      console.log("Final data to save:", updatedData);

      await updateDoc(userRef, updatedData);

      console.log("Data successfully saved to Firestore.");

      toast.success(
        `Roster edit saved for ${editedRowData.name || "current row"}`
      );
      setEditingRowId(null);
      setEditedRowData({});
      setOriginalRankBeforeEdit(null);
      fetchAndMergeRoster();
    } catch (error) {
      console.error("Error saving user data:", error);
      toast.error("Failed to save user data. Please try again.");
    }
  };

  const handleCancelClick = () => {
    setEditingRowId(null);
    setEditedRowData({});
    setOriginalRankBeforeEdit(null);
    toast.info("Edit cancelled.");
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setEditedRowData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const getCertificationOptions = (key: string) => {
    const restrictedKeys = ["HEAT", "MBU", "ACU"];
    if (restrictedKeys.includes(key.toUpperCase())) {
      return ["", "CERT"];
    }
    return ["", "LEAD", "SUPER", "CERT", "TRAIN"];
  };

  return (
    <Layout>
      <div className="relative z-10 page-content space-y-6 p-6 text-white min-h-screen">
        <h1 className="text-3xl font-bold text-[#f3c700]">SASP Roster</h1>

        <div className="flex flex-col md:flex-row gap-4 mb-4 items-center">
          <Input
            type="text"
            placeholder="Search Roster (Name, Badge, Callsign, Rank, Discord)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-grow bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-[#f3c700]"
          />
          <Select value={selectedRank} onValueChange={setSelectedRank}>
            <SelectTrigger className="w-full md:w-[180px] bg-input border-border text-foreground focus:ring-[#f3c700]">
              <SelectValue placeholder="Select Rank" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              {uniqueRanks.map((rank) => (
                <SelectItem
                  key={rank}
                  value={rank}
                  className="focus:bg-accent focus:text-accent-foreground"
                >
                  {rank === "All" ? "All Ranks" : rank}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center space-x-2 bg-card p-2 rounded-md border border-border">
            <Checkbox
              id="hideVacantToggle"
              checked={hideVacant}
              onCheckedChange={(checked) => setHideVacant(Boolean(checked))}
              className="border-border data-[state=checked]:bg-[#f3c700] data-[state=checked]:text-black"
            />
            <Label
              htmlFor="hideVacantToggle"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground whitespace-nowrap"
            >
              Hide Vacant
            </Label>
          </div>
        </div>

        {loading && <p className="text-[#f3c700] italic">Loading roster...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="rounded-lg border border-[#f3c700] bg-black bg-opacity-80 overflow-auto max-h-[80vh] shadow-lg">
            <table className="min-w-full border-separate border-spacing-0 text-sm table-fixed">
              <thead className="sticky top-0 z-50 bg-gradient-to-b from-black via-black/90 to-black/70 backdrop-blur-sm text-[#f3c700] shadow-[0_2px_4px_rgba(243,199,0,0.4)] font-semibold border-t border-b border-[#f3c700]">
                <tr>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}></th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    CALLSIGN
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    BADGE #
                  </th>
                  <th
                    className="p-2 border border-[#f3c700] bg-black"
                    rowSpan={2}
                  >
                    RANK
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    NAME
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    DISCORD
                  </th>
                  <th
                    className="p-2 border border-[#f3c700]"
                    colSpan={divisionKeys.length}
                  >
                    Divisions
                  </th>
                  <th
                    className="p-2 border border-[#f3c700]"
                    colSpan={certificationKeys.length}
                  >
                    Certifications
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    JOIN
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    PROMO
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    ACTIVE
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    LOA START
                  </th>
                  <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                    LOA END
                  </th>
                  {canEditRoster && (
                    <th className="p-2 border border-[#f3c700]" rowSpan={2}>
                      EDIT
                    </th>
                  )}
                </tr>
                <tr>
                  {divisionKeys.map((divKey) => (
                    <th key={divKey} className="p-2 border border-[#f3c700]">
                      {divKey.toUpperCase()}
                    </th>
                  ))}
                  {certificationKeys.map((certKey) => (
                    <th key={certKey} className="p-2 border border-[#f3c700]">
                      {certKey.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              {categoryOrder.map((category, categoryIndex) => {
                const usersInCategory = groupedRoster[category] || [];
                return usersInCategory.length > 0 ? (
                  <React.Fragment key={category}>
                    {categoryIndex > 0 && (
                      <tbody>
                        <tr>
                          <td
                            colSpan={totalColSpan + (canEditRoster ? 1 : 0)}
                            className="h-6"
                          ></td>
                        </tr>
                      </tbody>
                    )}
                    <tbody className="bg-black bg-opacity-85 text-white">
                      <tr>
                        <td
                          rowSpan={usersInCategory.length + 1}
                          className="text-center text-md font-bold text-[#f3c700] py-4 uppercase border-r border-[#f3c700] whitespace-pre-line"
                          style={{
                            writingMode: "vertical-rl",
                            textOrientation: "upright",
                          }}
                        >
                          {category}
                        </td>
                      </tr>
                      {usersInCategory.map((u, index) => {
                        const isEditing = editingRowId === u.id;
                        const isVacant = u.name === "VACANT";
                        return (
                          <tr
                            key={u.id}
                            className={`border-t border-[#f3c700] hover:bg-[#f3c700]/10 transition ${
                              isVacant ? "text-white italic opacity-60" : ""
                            } ${!isVacant && !u.isActive ? "opacity-50" : ""}`}
                          >
                            <td className="p-2 border border-[#f3c700] text-center">
                              {isEditing ? (
                                <Input
                                  type="text"
                                  name="callsign"
                                  value={editedRowData.callsign || ""}
                                  onChange={handleInputChange}
                                  className="input-edit"
                                />
                              ) : (
                                u.callsign || "-"
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700] text-center">
                              {isEditing ? (
                                <Input
                                  type="text"
                                  name="badge"
                                  value={editedRowData.badge || ""}
                                  onChange={handleInputChange}
                                  className="input-edit"
                                />
                              ) : (
                                u.badge || "-"
                              )}
                            </td>
                            <td
                              className={`p-2 border border-[#f3c700] text-center ${
                                u.rank && !isEditing
                                  ? "bg-[#f3c700] text-black font-semibold"
                                  : ""
                              }`}
                            >
                              {isEditing ? (
                                <Select
                                  name="rank"
                                  value={editedRowData.rank || ""}
                                  onValueChange={(value) =>
                                    handleInputChange({
                                      target: { name: "rank", value },
                                    } as any)
                                  }
                                >
                                  <SelectTrigger className="input-edit">
                                    <SelectValue placeholder="Select Rank" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-popover border-border text-popover-foreground">
                                    {Object.keys(rankOrder).map((rank) => (
                                      <SelectItem
                                        key={rank}
                                        value={rank}
                                        className="focus:bg-accent focus:text-accent-foreground"
                                      >
                                        {rank}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                u.rank || "-"
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700] text-center">
                              {isEditing ? (
                                <Input
                                  type="text"
                                  name="name"
                                  value={editedRowData.name || ""}
                                  onChange={handleInputChange}
                                  className="input-edit"
                                />
                              ) : (
                                u.name
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700] text-center">
                              {isEditing ? (
                                <Input
                                  type="text"
                                  name="discordId"
                                  value={editedRowData.discordId || ""}
                                  onChange={handleInputChange}
                                  className="input-edit"
                                />
                              ) : (
                                u.discordId || "-"
                              )}
                            </td>
                            {divisionKeys.map((divKey) => {
                              const certStatus =
                                u.certifications?.[divKey.toUpperCase()] ?? null;
                              const styles = getCertStyle(certStatus);

                              return (
                                <td
                                  key={divKey}
                                  className="p-2 border border-[#f3c700] text-center"
                                >
                                  {isEditing ? (
                                    <Select
                                      name={`certifications.${divKey.toUpperCase()}`}
                                      value={
                                        editedRowData.certifications?.[
                                          divKey.toUpperCase()
                                        ] || ""
                                      }
                                      onValueChange={(value) =>
                                        setEditedRowData((prev) => ({
                                          ...prev,
                                          certifications: {
                                            ...prev.certifications,
                                            [divKey.toUpperCase()]:
                                              value as CertStatus,
                                          },
                                        }))
                                      }
                                    >
                                      <SelectTrigger className="input-edit">
                                        <SelectValue placeholder="-" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-popover border-border text-popover-foreground">
                                        {getCertificationOptions(divKey).map(
                                          (option) => (
                                            <SelectItem
                                              key={option}
                                              value={option}
                                              className="focus:bg-accent focus:text-accent-foreground"
                                            >
                                              {option || "-"}
                                            </SelectItem>
                                          )
                                        )}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span
                                      className={`px-2 py-1 rounded text-xs ${styles.bgColor} ${styles.textColor}`}
                                    >
                                      {certStatus || "-"}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                            {certificationKeys.map((certKey) => {
                              const certStatus =
                                u.certifications?.[certKey.toUpperCase()] ?? null;
                              const styles = getCertStyle(certStatus);

                              return (
                                <td
                                  key={certKey}
                                  className="p-2 border border-[#f3c700] text-center"
                                >
                                  {isEditing ? (
                                    <Select
                                      name={`certifications.${certKey.toUpperCase()}`}
                                      value={
                                        editedRowData.certifications?.[
                                          certKey.toUpperCase()
                                        ] || ""
                                      }
                                      onValueChange={(value) =>
                                        setEditedRowData((prev) => ({
                                          ...prev,
                                          certifications: {
                                            ...prev.certifications,
                                            [certKey.toUpperCase()]:
                                              value as CertStatus,
                                          },
                                        }))
                                      }
                                    >
                                      <SelectTrigger className="input-edit">
                                        <SelectValue placeholder="-" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-popover border-border text-popover-foreground">
                                        {getCertificationOptions(certKey).map(
                                          (option) => (
                                            <SelectItem
                                              key={option}
                                              value={option}
                                              className="focus:bg-accent focus:text-accent-foreground"
                                            >
                                              {option || "-"}
                                            </SelectItem>
                                          )
                                        )}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span
                                      className={`px-2 py-1 rounded text-xs ${styles.bgColor} ${styles.textColor}`}
                                    >
                                      {certStatus || "-"}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="p-2 border border-[#f3c700] text-center">
                              {isEditing ? (
                                <Input
                                  type="date"
                                  name="joinDate"
                                  value={
                                    editedRowData.joinDate instanceof Timestamp
                                      ? editedRowData.joinDate
                                          .toDate()
                                          .toISOString()
                                          .split("T")[0]
                                      : editedRowData.joinDate || ""
                                  }
                                  onChange={handleInputChange}
                                  className="input-edit date-input"
                                />
                              ) : (
                                formatDateToMMDDYY(
                                  u.joinDate instanceof Timestamp
                                    ? u.joinDate.toDate()
                                    : u.joinDate
                                ) || "-"
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700] text-center">
                              {isEditing ? (
                                <>
                                  <Input
                                    type="date"
                                    name="lastPromotionDate"
                                    value={
                                      editedRowData.rank &&
                                      editedRowData.rank !==
                                        originalRankBeforeEdit
                                        ? formatDateToMMDDYY(new Date())
                                        : editedRowData.lastPromotionDate instanceof
                                          Timestamp
                                        ? editedRowData.lastPromotionDate
                                            .toDate()
                                            .toISOString()
                                            .split("T")[0]
                                        : editedRowData.lastPromotionDate || ""
                                    }
                                    onChange={handleInputChange}
                                    className="input-edit date-input"
                                    disabled={
                                      editedRowData.rank !==
                                      originalRankBeforeEdit
                                    }
                                    title={
                                      editedRowData.rank !==
                                      originalRankBeforeEdit
                                        ? "Auto-updated on rank change"
                                        : ""
                                    }
                                  />
                                </>
                              ) : (
                                formatDateToMMDDYY(
                                  u.lastPromotionDate instanceof Timestamp
                                    ? u.lastPromotionDate.toDate()
                                    : u.lastPromotionDate
                                ) || "-"
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700] text-center">
                              {isEditing ? (
                                <Select
                                  name="isActive"
                                  value={editedRowData.isActive ? "true" : "false"}
                                  onValueChange={(value) =>
                                    setEditedRowData((prev) => ({
                                      ...prev,
                                      isActive: value === "true",
                                    }))
                                  }
                                >
                                  <SelectTrigger className="input-edit">
                                    <SelectValue placeholder="Status" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-popover border-border text-popover-foreground">
                                    <SelectItem
                                      value="true"
                                      className="focus:bg-accent focus:text-accent-foreground"
                                    >
                                      YES
                                    </SelectItem>
                                    <SelectItem
                                      value="false"
                                      className="focus:bg-accent focus:text-accent-foreground"
                                    >
                                      NO
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span
                                  className={`px-2 py-1 rounded text-xs ${
                                    u.isActive
                                      ? "bg-green-600 text-white"
                                      : "bg-red-600 text-white"
                                  }`}
                                >
                                  {u.isActive ? "YES" : "NO"}
                                </span>
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700] text-center">
                              {isEditing ? (
                                <Input
                                  type="date"
                                  name="loaStartDate"
                                  value={
                                    editedRowData.loaStartDate instanceof
                                    Timestamp
                                      ? editedRowData.loaStartDate
                                          .toDate()
                                          .toISOString()
                                          .split("T")[0]
                                      : editedRowData.loaStartDate || ""
                                  }
                                  onChange={handleInputChange}
                                  className="input-edit date-input"
                                />
                              ) : (
                                formatDateToMMDDYY(
                                  u.loaStartDate instanceof Timestamp
                                    ? u.loaStartDate.toDate()
                                    : u.loaStartDate
                                ) || "-"
                              )}
                            </td>
                            <td className="p-2 border border-[#f3c700] text-center">
                              {isEditing ? (
                                <Input
                                  type="date"
                                  name="loaEndDate"
                                  value={
                                    editedRowData.loaEndDate instanceof Timestamp
                                      ? editedRowData.loaEndDate
                                          .toDate()
                                          .toISOString()
                                          .split("T")[0]
                                      : editedRowData.loaEndDate || ""
                                  }
                                  onChange={handleInputChange}
                                  className="input-edit date-input"
                                />
                              ) : (
                                formatDateToMMDDYY(
                                  u.loaEndDate instanceof Timestamp
                                    ? u.loaEndDate.toDate()
                                    : u.loaEndDate
                                ) || "-"
                              )}
                            </td>
                            {canEditRoster && (
                              <td className="p-2 border border-[#f3c700] text-center">
                                {isEditing ? (
                                  <div className="flex gap-2 justify-center">
                                    <button
                                      onClick={handleSaveClick}
                                      className="bg-green-600 hover:bg-green-500 text-white text-xs py-1 px-2 rounded"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={handleCancelClick}
                                      className="bg-red-600 hover:bg-red-500 text-white text-xs py-1 px-2 rounded"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleEditClick(u)}
                                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs py-1 px-2 rounded"
                                    disabled={u.isPlaceholder}
                                    title={
                                      u.isPlaceholder
                                        ? "Cannot edit placeholder rows"
                                        : "Edit Roster Entry"
                                    }
                                  >
                                    Edit
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </React.Fragment>
                ) : null;
              })}
              {Object.values(groupedRoster).every((arr) => arr.length === 0) &&
                !loading && (
                  <tbody>
                    <tr>
                      <td
                        colSpan={totalColSpan + (canEditRoster ? 1 : 0)}
                        className="text-center p-4 text-white italic"
                      >
                        No users found matching the criteria.
                      </td>
                    </tr>
                  </tbody>
                )}
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SASPRoster;
