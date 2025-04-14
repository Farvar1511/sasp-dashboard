import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { User as AuthUser } from "../types/User";

type CertStatus = "LEAD" | "SUPER" | "CERT" | null;

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

interface RosterUser {
  id: string;
  name: string;
  rank: string;
  badge?: string;
  callsign?: string;
  certifications?: { [key: string]: CertStatus | undefined };
  loaStartDate?: string | Timestamp;
  loaEndDate?: string | Timestamp;
  isActive?: boolean;
  discordId?: string;
  assignedVehicleId?: string;
  email?: string;
}

interface Vehicle {
  id: string;
  vehicle: string;
  plate?: string;
  division?: string;
  restrictions?: string;
  assignee?: string;
  inService?: boolean;
  lastCheckedOutBy?: string;
  lastCheckedOutAt?: Timestamp;
  notes?: string;
}

const determineAllowedVehicles = (
  user: RosterUser | null,
  allVehicles: Vehicle[]
): Vehicle[] => {
  if (!user || !user.rank || !user.certifications) return [];

  const userRankOrder = rankOrder[user.rank] ?? rankOrder.Unknown;
  const userCerts = user.certifications || {};

  const hasCertAccess = (certKey: string | null): boolean => {
    if (!certKey) return true;
    const lookupKey = (certKey === "MOTO" ? "MBU" : certKey).toUpperCase();
    const status = userCerts[lookupKey];
    return ["CERT", "SUPER", "LEAD"].includes((status || "").toUpperCase());
  };

  return allVehicles.filter((vehicle) => {
    const division = (vehicle.division || "").trim().toUpperCase();
    const restriction = (vehicle.restrictions || "").trim().toLowerCase();
    const assignee = (vehicle.assignee || "").trim().toUpperCase();

    const isCommunal = !assignee || assignee === "COMMUNAL";
    if (!isCommunal) return false;

    let meetsRankRequirement = true;
    let requiredRankLevel = Infinity;
    if (restriction.includes("high command"))
      requiredRankLevel = rankOrder.Commander;
    else if (restriction.includes("command"))
      requiredRankLevel = rankOrder.Lieutenant;
    else if (restriction.includes("supervisor"))
      requiredRankLevel = rankOrder.Sergeant;
    else if (restriction.includes("trooper first class"))
      requiredRankLevel = rankOrder["Trooper First Class"];

    if (userRankOrder > requiredRankLevel) {
      meetsRankRequirement = false;
    }
    if (!meetsRankRequirement) return false;

    let requiredCertKey: string | null = null;
    if (division.includes("HEAT")) requiredCertKey = "HEAT";
    else if (division.includes("MOTO")) requiredCertKey = "MOTO";
    else if (division.includes("ACU")) requiredCertKey = "ACU";
    else if (division.includes("SWAT")) requiredCertKey = "SWAT";
    else if (division.includes("K9")) requiredCertKey = "K9";
    else if (division.includes("CIU")) requiredCertKey = "CIU";

    if (!requiredCertKey) {
      if (restriction.includes("heat")) requiredCertKey = "HEAT";
      else if (restriction.includes("moto")) requiredCertKey = "MOTO";
      else if (restriction.includes("acu")) requiredCertKey = "ACU";
      else if (restriction.includes("swat")) requiredCertKey = "SWAT";
      else if (restriction.includes("k9")) requiredCertKey = "K9";
      else if (restriction.includes("ciu")) requiredCertKey = "CIU";
    }

    const certOK = hasCertAccess(requiredCertKey);
    if (!certOK) return false;

    return true;
  });
};

const Fleet: React.FC<{ user: AuthUser }> = ({ user }) => {
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDivision, setSelectedDivision] = useState<string>("All");
  const [hideOutOfService, setHideOutOfService] = useState(true);
  const [filterMode, setFilterMode] = useState<"all" | "myAllowed">("all");
  const [currentUserProfile, setCurrentUserProfile] =
    useState<RosterUser | null>(null);

  useEffect(() => {
    const fetchFleet = async () => {
      setLoading(true);
      setError(null);
      try {
        const fleetSnapshot = await getDocs(collection(dbFirestore, "fleet"));
        const fleetData = fleetSnapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Vehicle)
        );
        setFleet(fleetData);

        if (user?.email) {
          const userDocRef = doc(dbFirestore, "users", user.email);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const normalizedCerts = userData.certifications
              ? Object.entries(userData.certifications).reduce(
                  (acc, [key, value]) => {
                    let normalizedValue: CertStatus = null;
                    const currentKeyUpper = key.toUpperCase();
                    if (typeof value === "string") {
                      const upperValue = value.toUpperCase();
                      if (["CERT", "SUPER", "LEAD"].includes(upperValue)) {
                        normalizedValue = upperValue as CertStatus;
                      }
                    } else if (typeof value === "boolean" && value === true) {
                      normalizedValue = "CERT";
                    }
                    acc[currentKeyUpper] = normalizedValue;
                    return acc;
                  },
                  {} as { [key: string]: CertStatus | null }
                )
              : {};
            setCurrentUserProfile({
              id: userDocSnap.id,
              ...userData,
              certifications: normalizedCerts,
            } as RosterUser);
          }
        }
      } catch (err) {
        console.error("Error fetching fleet:", err);
        setError("Failed to load fleet data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchFleet();
  }, [user]);

  const uniqueDivisions = useMemo(() => {
    const divisions = new Set<string>(["All"]);
    fleet.forEach((v) => {
      if (v.division && v.division.trim()) {
        divisions.add(v.division.trim());
      }
    });
    return Array.from(divisions).sort();
  }, [fleet]);

  const groupedAndFilteredFleet = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    let baseVehicleList = fleet;
    if (filterMode === "myAllowed" && currentUserProfile) {
      baseVehicleList = determineAllowedVehicles(currentUserProfile, fleet);
    }

    const filteredFleet = baseVehicleList.filter((v) => {
      const matchesSearch =
        !lowerSearchTerm ||
        v.vehicle?.toLowerCase().includes(lowerSearchTerm) ||
        v.plate?.toLowerCase().includes(lowerSearchTerm) ||
        v.division?.toLowerCase().includes(lowerSearchTerm) ||
        v.assignee?.toLowerCase().includes(lowerSearchTerm);

      const matchesDivision =
        selectedDivision === "All" || v.division === selectedDivision;

      const matchesServiceStatus = hideOutOfService ? v.inService : true;

      return matchesSearch && matchesDivision && matchesServiceStatus;
    });

    const groupedFleet = filteredFleet.reduce((acc, v) => {
      const division = v.division || "Unknown";
      if (!acc[division]) {
        acc[division] = [];
      }
      acc[division].push(v);
      return acc;
    }, {} as Record<string, Vehicle[]>);

    return Object.entries(groupedFleet).map(([division, vehicles]) => ({
      division,
      vehicles,
    }));
  }, [
    fleet,
    searchTerm,
    selectedDivision,
    hideOutOfService,
    filterMode,
    currentUserProfile,
  ]);

  return (
    <Layout user={user}>
      <div className="page-content space-y-6">
        <h1 className="text-3xl font-bold text-[#f3c700]">SASP Fleet</h1>

        <div className="flex flex-col md:flex-row gap-4 mb-4 items-center">
          <input
            type="text"
            placeholder="Search Fleet..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input flex-grow"
          />
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="input md:w-auto"
          >
            {uniqueDivisions.map((division) => (
              <option key={division} value={division}>
                {division === "All" ? "All Divisions" : division}
              </option>
            ))}
          </select>
          <select
            value={filterMode}
            onChange={(e) =>
              setFilterMode(e.target.value as "all" | "myAllowed")
            }
            className="input md:w-auto"
            disabled={!currentUserProfile}
          >
            <option value="all">All Vehicles</option>
            <option value="myAllowed">My Allowed Vehicles</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hideOutOfServiceToggleFleet"
              checked={hideOutOfService}
              onChange={(e) => setHideOutOfService(e.target.checked)}
              className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="hideOutOfServiceToggleFleet"
              className="text-sm text-gray-300 whitespace-nowrap"
            >
              Hide Out-of-Service
            </label>
          </div>
        </div>

        {loading && <p className="text-yellow-400 italic">Loading fleet...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-full bg-gray-900/50 border border-gray-700 text-sm">
              <thead className="bg-gray-800 text-yellow-400">
                <tr>
                  <th className="p-2 border-r border-gray-600 w-8"></th>
                  <th className="p-2 border-r border-gray-600">Vehicle</th>
                  <th className="p-2 border-r border-gray-600">Plate</th>
                  <th className="p-2 border-r border-gray-600">Division</th>
                  <th className="p-2 border-r border-gray-600">Restrictions</th>
                  <th className="p-2 border-r border-gray-600">Assignee</th>
                  <th className="p-2">In Service</th>
                </tr>
              </thead>
              {groupedAndFilteredFleet.map(({ division, vehicles }) =>
                vehicles.length > 0 ? (
                  <tbody key={division} className="text-gray-300">
                    {vehicles.map((v, index) => (
                      <tr
                        key={v.id}
                        className={`border-t border-gray-700 hover:bg-gray-800/50 ${
                          !v.inService ? "opacity-60" : ""
                        }`}
                      >
                        {index === 0 && (
                          <td
                            rowSpan={vehicles.length}
                            className="p-2 border-r border-l border-gray-600 align-middle text-center font-semibold text-yellow-300 category-vertical"
                            style={{ writingMode: "vertical-lr" }}
                          >
                            {division}
                          </td>
                        )}
                        <td className="p-2 border-r border-gray-600">
                          {v.vehicle}
                        </td>
                        <td className="p-2 border-r border-gray-600">
                          {v.plate || "-"}
                        </td>
                        <td className="p-2 border-r border-gray-600">
                          {v.division || "-"}
                        </td>
                        <td className="p-2 border-r border-gray-600">
                          {v.restrictions || "-"}
                        </td>
                        <td className="p-2 border-r border-gray-600">
                          {v.assignee || "Communal"}
                        </td>
                        <td className={`p-0 text-center align-middle`}>
                          <span
                            className={`block w-full h-full px-2 py-2 font-semibold ${
                              v.inService
                                ? "bg-green-600 text-white"
                                : "bg-red-600 text-white"
                            }`}
                          >
                            {v.inService ? "YES" : "NO"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ) : null
              )}
              {groupedAndFilteredFleet.length === 0 && !loading && (
                <tbody>
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center p-4 text-gray-400 italic"
                    >
                      No vehicles found matching the criteria.
                    </td>
                  </tr>
                </tbody>
              )}
            </table>
          </div>
        )}
      </div>
      <style>{`
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

export default Fleet;
