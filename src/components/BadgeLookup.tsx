import React, { useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { useAuth } from "../context/AuthContext";

// --- Types ---
type CertStatus = "LEAD" | "SUPER" | "CERT" | null;

// Use rankOrder for comparisons
const rankOrder: { [key: string]: number } = {
  Commissioner: 1,
  "Assistant Deputy Commissioner": 2,
  "Deputy Commissioner": 3,
  "Assistant Commissioner": 4,
  Commander: 5,
  Captain: 6,
  Lieutenant: 7, // Command starts here
  "Staff Sergeant": 8,
  Sergeant: 9, // Supervisors start here
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
  email?: string; // Keep email if it's the ID
}

// Updated Vehicle interface based on prompt
interface Vehicle {
  id: string;
  vehicle: string; // Model name
  plate?: string;
  division?: string; // e.g., Patrol, HEAT, MOTO, ACU, SWAT
  restrictions?: string; // e.g., "", "Supervisors", "Command", "HEAT"
  assignee?: string; // Name or ID of assignee
  inService?: boolean;
  // Add other fields like 'type' if they exist and are needed
}

// --- Helper Function: Determine allowed vehicles ---
const determineAllowedVehicles = (
  user: RosterUser,
  allVehicles: Vehicle[]
): Vehicle[] => {
  if (!user || !user.rank) return []; // Need user and rank

  const userRankOrder = rankOrder[user.rank] ?? rankOrder.Unknown;
  const userCerts = user.certifications || {};
  console.log(
    `Determining vehicles for ${user.name} (Rank: ${user.rank}, RankOrder: ${userRankOrder})`,
    userCerts
  ); // Log user context

  // Helper to check if user has a valid certification (CERT, SUPER, or LEAD), case-insensitive value check
  const hasCertAccess = (certKey: string | null): boolean => {
    if (!certKey) return true; // If no specific cert is required by the check, pass the check
    const status = userCerts[certKey.toUpperCase()]; // Get status using uppercase key
    // Check if the status (converted to uppercase) is one of the valid access levels
    return ["CERT", "SUPER", "LEAD"].includes((status || "").toUpperCase());
  };

  return allVehicles.filter((vehicle) => {
    const division = (vehicle.division || "").trim().toUpperCase();
    const restriction = (vehicle.restrictions || "").trim().toLowerCase(); // Keep restriction check lowercase
    const assignee = (vehicle.assignee || "").trim().toUpperCase();

    console.log(`\n🚗 ${vehicle.vehicle} (ID: ${vehicle.id})`); // Use newline for better separation
    console.log(
      ` - Division Raw: '${vehicle.division}', Normalized: '${division}'`
    );
    console.log(
      ` - Restrictions Raw: '${vehicle.restrictions}', Normalized: '${restriction}'`
    );
    console.log(
      ` - Assignee Raw: '${vehicle.assignee}', Normalized: '${assignee}'`
    );

    // Assignee check
    const isCommunal = !assignee || assignee === "COMMUNAL";
    console.log(` - Communal Check: ${isCommunal}`);
    if (!isCommunal) {
      console.log(" ❌ Rejected: Not communal");
      return false;
    }

    // Rank check
    let meetsRankRequirement = true;
    let requiredRankLevel = Infinity; // Use Infinity to represent no restriction initially
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
    // Log the comparison clearly
    const rankCheckMsg =
      requiredRankLevel === Infinity
        ? "No rank restriction"
        : `userRank ${userRankOrder} <= ${requiredRankLevel}`;
    console.log(` - Rank Check: ${rankCheckMsg} => ${meetsRankRequirement}`);
    if (!meetsRankRequirement) {
      console.log(" ❌ Rejected: Rank too low");
      return false;
    }

    // Cert check
    let requiredCert: string | null = null;
    // Prioritize division for determining required cert
    if (division.includes("HEAT")) requiredCert = "HEAT";
    // Use includes for flexibility e.g., "Patrol [HEAT]"
    else if (division.includes("MOTO")) requiredCert = "MOTO";
    else if (division.includes("ACU")) requiredCert = "ACU";
    else if (division.includes("SWAT")) requiredCert = "SWAT";
    else if (division.includes("K9")) requiredCert = "K9";
    else if (division.includes("CIU")) requiredCert = "CIU";

    // If division didn't set it, check restrictions (lowercase already)
    if (!requiredCert) {
      if (restriction.includes("heat")) requiredCert = "HEAT";
      else if (restriction.includes("moto")) requiredCert = "MOTO";
      else if (restriction.includes("acu")) requiredCert = "ACU";
      else if (restriction.includes("swat")) requiredCert = "SWAT";
      else if (restriction.includes("k9")) requiredCert = "K9";
      else if (restriction.includes("ciu")) requiredCert = "CIU";
    }

    const certOK = hasCertAccess(requiredCert);
    console.log(` - Cert Required: ${requiredCert || "None"}`);
    console.log(` - Has Cert Access? ${certOK}`);

    if (!certOK) {
      console.log(" ❌ Rejected: Missing cert");
      return false;
    }

    console.log(" ✅ ALLOWED!");
    return true;
  });
};

// --- Component ---
const BadgeLookup: React.FC = () => {
  const { user: authUser } = useAuth();
  const [badgeInput, setBadgeInput] = useState<string>("");
  const [foundUser, setFoundUser] = useState<RosterUser | null>(null);
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);
  const [allowedVehicles, setAllowedVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!badgeInput.trim()) {
      setError("Please enter a badge number.");
      setFoundUser(null);
      setAssignedVehicle(null);
      setAllowedVehicles([]);
      return;
    }

    setLoading(true);
    setError(null);
    setFoundUser(null);
    setAssignedVehicle(null);
    setAllowedVehicles([]);

    try {
      const usersRef = collection(dbFirestore, "users");
      const q = query(usersRef, where("badge", "==", badgeInput.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError(`No user found with badge number ${badgeInput}.`);
        setLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data() as Omit<RosterUser, "id">;

      // Normalize cert keys AND values to uppercase
      const normalizedCerts = userData.certifications
        ? Object.entries(userData.certifications).reduce(
            (acc, [key, value]) => {
              const upperValue = (
                value as string | null | undefined
              )?.toUpperCase();
              if (
                upperValue === "CERT" ||
                upperValue === "SUPER" ||
                upperValue === "LEAD"
              ) {
                acc[key.toUpperCase()] = upperValue as CertStatus;
              } else {
                acc[key.toUpperCase()] = null;
              }
              return acc;
            },
            {} as { [key: string]: CertStatus | null }
          )
        : {};

      console.log("Normalized Certs for User:", normalizedCerts); // Log normalized certifications

      const userResult: RosterUser = {
        id: userDoc.id,
        ...userData,
        certifications: normalizedCerts,
      };
      setFoundUser(userResult);

      // Fetch vehicles from the correct 'fleet' collection
      const vehiclesSnapshot = await getDocs(
        collection(dbFirestore, "fleet") // <-- Changed "vehicles" to "fleet"
      );
      const allVehicles: Vehicle[] = vehiclesSnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          } as Vehicle)
      );

      console.log(`Fetched ${allVehicles.length} total vehicles.`); // Log total vehicles fetched

      const allowed = determineAllowedVehicles(userResult, allVehicles);
      console.log(`Determined ${allowed.length} allowed vehicles.`, allowed); // Log allowed vehicles
      setAllowedVehicles(allowed);

      // --- Find Assigned Vehicle ---
      let foundAssignedVehicle: Vehicle | null = null;

      // 1. Try matching by assignee name (full name or Initial. LastName)
      const userNameUpper = userResult.name.toUpperCase();
      const nameParts = userResult.name.split(" ").filter((part) => part); // Split name and remove empty parts
      let initialLastNameFormat = "";
      if (nameParts.length >= 2) {
        const firstNameInitial = nameParts[0].charAt(0).toUpperCase();
        const lastName = nameParts[nameParts.length - 1]; // Get the last part as last name
        initialLastNameFormat =
          `${firstNameInitial}. ${lastName}`.toUpperCase(); // Format as "F. Lastname" and uppercase
      }

      console.log(
        `Looking for assigned vehicle for user: ${userResult.name} (Formats: '${userNameUpper}', '${initialLastNameFormat}')`
      );

      for (const vehicle of allVehicles) {
        const assigneeName = vehicle.assignee?.trim();
        if (!assigneeName) continue; // Skip if assignee is empty

        const assigneeNameUpper = assigneeName.toUpperCase();

        // Check for exact full name match
        if (assigneeNameUpper === userNameUpper) {
          foundAssignedVehicle = vehicle;
          console.log(
            `Found assigned vehicle by FULL name match: ${vehicle.vehicle} (Assignee: ${vehicle.assignee})`
          );
          break;
        }

        // Check for "Initial. LastName" match (if applicable)
        if (
          initialLastNameFormat &&
          assigneeNameUpper === initialLastNameFormat
        ) {
          foundAssignedVehicle = vehicle;
          console.log(
            `Found assigned vehicle by INITIAL.LASTNAME match: ${vehicle.vehicle} (Assignee: ${vehicle.assignee})`
          );
          break;
        }
      }

      // 2. Fallback to assignedVehicleId if no name match found
      if (!foundAssignedVehicle && userResult.assignedVehicleId) {
        console.log(
          `No name match, trying assignedVehicleId: ${userResult.assignedVehicleId}`
        );
        const vehicleDocRef = doc(
          dbFirestore,
          "fleet", // Changed from "vehicles"
          userResult.assignedVehicleId
        );
        const vehicleDocSnap = await getDoc(vehicleDocRef);
        if (vehicleDocSnap.exists()) {
          foundAssignedVehicle = {
            id: vehicleDocSnap.id,
            ...vehicleDocSnap.data(),
          } as Vehicle;
          console.log(
            `Found assigned vehicle by ID: ${foundAssignedVehicle.vehicle}`
          );
        } else {
          console.warn(
            `Assigned vehicle with ID ${userResult.assignedVehicleId} not found in 'fleet' collection.`
          );
        }
      }

      // Set the state
      setAssignedVehicle(foundAssignedVehicle);
    } catch (err) {
      console.error("Error looking up badge:", err);
      setError("An error occurred during lookup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderCertifications = (certs: RosterUser["certifications"]) => {
    if (!certs) return <span className="text-gray-400">None</span>;
    const activeCerts = Object.entries(certs)
      .filter(([key, value]) => value !== null)
      .map(([key, value]) => `${key}: ${value}`);
    return activeCerts.length > 0 ? (
      activeCerts.join(", ")
    ) : (
      <span className="text-gray-400">None</span>
    );
  };

  return (
    <Layout user={authUser!}>
      <div className="page-content space-y-6">
        <h1 className="text-3xl font-bold text-[#f3c700]">Badge Lookup</h1>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={badgeInput}
            onChange={(e) => setBadgeInput(e.target.value)}
            placeholder="Enter Badge Number"
            className="input"
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          />
          <button
            onClick={handleLookup}
            className="button-primary"
            disabled={loading}
          >
            {loading ? "Looking up..." : "Lookup"}
          </button>
        </div>

        {error && <p className="text-red-500">{error}</p>}

        {foundUser && (
          <div className="space-y-6">
            <div className="admin-section p-4">
              <h2 className="section-header text-xl mb-3">
                Trooper Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <p>
                  <strong className="text-yellow-400">Name:</strong>{" "}
                  {foundUser.name}
                </p>
                <p>
                  <strong className="text-yellow-400">Rank:</strong>{" "}
                  {foundUser.rank}
                </p>
                <p>
                  <strong className="text-yellow-400">Badge:</strong>{" "}
                  {foundUser.badge}
                </p>
                <p>
                  <strong className="text-yellow-400">Callsign:</strong>{" "}
                  {foundUser.callsign || "-"}
                </p>
                <p>
                  <strong className="text-yellow-400">Status:</strong>{" "}
                  {foundUser.isActive ? (
                    <span className="text-green-400">Active</span>
                  ) : (
                    <span className="text-red-400">Inactive</span>
                  )}
                </p>
                <p>
                  <strong className="text-yellow-400">Discord ID:</strong>{" "}
                  {foundUser.discordId || "-"}
                </p>
                <p className="md:col-span-2">
                  <strong className="text-yellow-400">Certifications:</strong>{" "}
                  {renderCertifications(foundUser.certifications)}
                </p>
              </div>
            </div>

            <div className="admin-section p-4">
              <h2 className="section-header text-xl mb-3">Assigned Vehicle</h2>
              {assignedVehicle ? (
                <p className="text-sm">
                  <strong className="text-yellow-400">Vehicle:</strong>{" "}
                  {assignedVehicle.vehicle} |{" "}
                  <strong className="text-yellow-400"> Plate:</strong>{" "}
                  {assignedVehicle.plate || "N/A"} |{" "}
                  <strong className="text-yellow-400"> Division:</strong>{" "}
                  {assignedVehicle.division || "N/A"} |{" "}
                  <strong className="text-yellow-400"> Restrictions:</strong>{" "}
                  {assignedVehicle.restrictions || "None"}
                </p>
              ) : (
                <p className="text-gray-400 italic text-sm">
                  No vehicle assigned.
                </p>
              )}
            </div>

            <div className="admin-section p-4">
              <h2 className="section-header text-xl mb-3">
                Allowed Vehicles (Based on Rank/Certs)
              </h2>
              {allowedVehicles.length > 0 ? (
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {allowedVehicles.map((vehicle) => (
                    <li key={vehicle.id}>
                      {vehicle.vehicle} ({vehicle.plate || "No Plate"})
                      {vehicle.division && (
                        <span className="text-xs text-gray-400 ml-2">
                          [{vehicle.division}]
                        </span>
                      )}
                      {vehicle.restrictions && (
                        <span className="text-xs text-orange-400 ml-2">
                          ({vehicle.restrictions})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 italic text-sm">
                  No vehicles found matching user's rank and certifications, or
                  only standard vehicles allowed.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BadgeLookup;
