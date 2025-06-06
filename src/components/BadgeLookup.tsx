import React, { useState } from "react"; // Import useMemo
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
export const saspStar = "/SASPLOGO2.png"; // Corrected path to logo

// --- Types ---
type CertStatus = "LEAD" | "SUPER" | "CERT" | "TRAIN" | "ASSIST";

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
    return ["TRAIN", "CERT", "SUPER", "LEAD"].includes((status || "").toUpperCase());
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
    let requiredCertKey: string | null = null; // The key needed for the vehicle (e.g., MOTO, HEAT)
    // Prioritize division for determining required cert
    if (division.includes("HEAT")) requiredCertKey = "HEAT";
    else if (division.includes("MOTO"))
      requiredCertKey = "MOTO"; // Vehicle requires MOTO
    else if (division.includes("ACU")) requiredCertKey = "ACU";
    else if (division.includes("SWAT")) requiredCertKey = "SWAT";
    else if (division.includes("K9")) requiredCertKey = "K9";
    else if (division.includes("CIU")) requiredCertKey = "CIU";

    // If division didn't set it, check restrictions (lowercase already)
    if (!requiredCertKey) {
      if (restriction.includes("heat")) requiredCertKey = "HEAT";
      else if (restriction.includes("moto"))
        requiredCertKey = "MOTO"; // Vehicle requires MOTO
      else if (restriction.includes("acu")) requiredCertKey = "ACU";
      else if (restriction.includes("swat")) requiredCertKey = "SWAT";
      else if (restriction.includes("k9")) requiredCertKey = "K9";
      else if (restriction.includes("ciu")) requiredCertKey = "CIU";
    }

    // Determine the key to check in the user's certifications
    // If the vehicle requires "MOTO", check if the user has "MBU"
    const userCertLookupKey =
      requiredCertKey === "MOTO" ? "MBU" : requiredCertKey;

    const certOK = hasCertAccess(userCertLookupKey); // Check using the potentially mapped key
    console.log(` - Cert Required by Vehicle: ${requiredCertKey || "None"}`);
    console.log(` - Checking User Cert Key: ${userCertLookupKey || "None"}`);
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

      // Normalize cert keys AND values to uppercase, handling boolean values
      const normalizedCerts = userData.certifications
        ? Object.entries(userData.certifications).reduce(
            (acc, [key, value]) => {
              let normalizedValue: CertStatus | undefined = undefined; // Default to undefined
              const currentKeyUpper = key.toUpperCase(); // Uppercase key once

              if (typeof value === "string") {
                const upperValue = value.toUpperCase();
                if (
                  upperValue === "TRAIN" ||
                  upperValue === "CERT" ||
                  upperValue === "SUPER" ||
                  upperValue === "ASSIST" ||
                  upperValue === "LEAD"
                ) {
                  normalizedValue = upperValue as CertStatus;
                }
              } else if (typeof value === "boolean" && value === true) {
                // Treat boolean true as 'CERT'
                normalizedValue = "CERT";
              }
              // Any other type (false, number, null, undefined etc.) or invalid string remains undefined

              acc[currentKeyUpper] = normalizedValue; // Store with uppercase key
              return acc;
            },
            {} as { [key: string]: CertStatus | undefined }
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

  const getCertStyle = (status: CertStatus | null) => {
    if (status === "LEAD")
      return { bgColor: "bg-blue-600", textColor: "text-white" };
    if (status === "SUPER")
      return { bgColor: "bg-yellow-600", textColor: "text-white" };
    if (status === "CERT")
      return { bgColor: "bg-green-600", textColor: "text-white" };
    if (status === "TRAIN")
      return { bgColor: "bg-orange-600", textColor: "text-white" };
    return { bgColor: "bg-gray-600", textColor: "text-gray-300" };
  };

  const certificationKeys = ["HEAT", "ACU", "MBU"]; // Removed "MOTO"
  const divisionKeys = ["K9", "FTO", "SWAT", "CIU"];

  return (
    <Layout>
      <h1 className="text-3xl font-bold text-yellow-400 mb-6">Badge Lookup</h1>
      <div className="max-w-md mx-auto flex items-center gap-3 p-4 bg-black bg-opacity-60 rounded-lg shadow-lg">
        <input
          type="text"
          value={badgeInput}
          onChange={(e) => setBadgeInput(e.target.value)}
          placeholder="Enter Badge Number"
          className="input flex-grow bg-gray-700 text-white border-gray-600 placeholder-gray-400 focus:ring-[#f3c700] focus:border-[#f3c700]"
          onKeyDown={(e) => e.key === "Enter" && handleLookup()}
        />
        <button
          onClick={handleLookup}
          className="button-primary bg-[#f3c700] text-black font-semibold py-2 px-4 rounded-lg hover:bg-[#d4a900] transition duration-150 ease-in-out disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Searching..." : "Lookup"}
        </button>
      </div>
      {error && (
        <p className="text-red-400 text-center font-medium bg-red-900 bg-opacity-50 py-2 px-4 rounded-md max-w-md mx-auto">
          {error}
        </p>
      )}
      {foundUser && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="admin-section p-5 bg-black bg-opacity-75 rounded-lg shadow-xl">
            <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700] border-b-2 border-yellow-600 pb-2">
              Trooper Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-base">
              {[
                { label: "Name", value: foundUser.name },
                { label: "Rank", value: foundUser.rank },
                { label: "Badge", value: foundUser.badge },
                { label: "Callsign", value: foundUser.callsign || "-" },
                { label: "Discord ID", value: foundUser.discordId || "-" },
                {
                  label: "Status",
                  value: foundUser.isActive ? "Active" : "Inactive",
                  color: foundUser.isActive ? "bg-green-600" : "bg-red-600",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex justify-between items-center py-1"
                >
                  <strong className="text-yellow-500 font-medium">
                    {item.label}:
                  </strong>
                  <span
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      item.color
                        ? `${item.color} text-white`
                        : "bg-gray-700 text-gray-200"
                    }`}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="admin-section p-5 bg-black bg-opacity-75 rounded-lg shadow-xl">
            <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700] border-b-2 border-yellow-600 pb-2">
              Certifications & Divisions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div>
                <h3 className="text-xl font-semibold text-yellow-500 mb-3">
                  Divisions
                </h3>
                <div className="space-y-2.5">
                  {divisionKeys.map((divKey) => {
                    const lookupKey = divKey.toUpperCase();
                    const displayName = divKey;
                    const status =
                      foundUser.certifications?.[lookupKey] ?? null;
                    const style = getCertStyle(status);

                    return (
                      <div
                        key={divKey}
                        className={`flex items-center justify-between text-sm`}
                      >
                        <span className="text-gray-300 font-medium w-16">
                          {displayName}:
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded text-xs font-semibold ${style.bgColor} ${style.textColor}`}
                        >
                          {status || "None"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-yellow-500 mb-3">
                  Certifications
                </h3>
                <div className="space-y-2.5">
                  {certificationKeys.map((certKey) => {
                    const lookupKey = certKey.toUpperCase();
                    const displayName = certKey;
                    const status =
                      foundUser.certifications?.[lookupKey] ?? null;
                    const style = getCertStyle(status);

                    return (
                      <div
                        key={certKey}
                        className={`flex items-center justify-between text-sm`}
                      >
                        <span className="text-gray-300 font-medium w-16">
                          {displayName}:
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded text-xs font-semibold ${style.bgColor} ${style.textColor}`}
                        >
                          {status || "None"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="admin-section p-5 bg-black bg-opacity-75 rounded-lg shadow-xl">
            <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700] border-b-2 border-yellow-600 pb-2">
              Assigned Vehicle
            </h2>
            {assignedVehicle ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-base">
                {[
                  { label: "Vehicle", value: assignedVehicle.vehicle },
                  { label: "Plate", value: assignedVehicle.plate || "-" },
                  {
                    label: "Division",
                    value: assignedVehicle.division || "-",
                  },
                  {
                    label: "Restrictions",
                    value: assignedVehicle.restrictions || "-",
                  },
                  {
                    label: "In Service",
                    value: assignedVehicle.inService ? "Yes" : "No",
                    color: assignedVehicle.inService
                      ? "bg-green-600"
                      : "bg-red-600",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex justify-between items-center py-1"
                  >
                    <strong className="text-yellow-500 font-medium">
                      {item.label}:
                    </strong>
                    <span
                      className={`px-3 py-1 rounded-md text-sm font-medium ${
                        item.color
                          ? `${item.color} text-white`
                          : "bg-gray-700 text-gray-200"
                      }`}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 italic">
                No specific vehicle assigned to this trooper.
              </p>
            )}
          </div>
          <div className="admin-section p-5 bg-black bg-opacity-75 rounded-lg shadow-xl">
            <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700] border-b-2 border-yellow-600 pb-2">
              Allowed Vehicles
            </h2>
            {allowedVehicles.length > 0 ? (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="min-w-full text-sm text-left">
                  <thead className="text-xs text-yellow-300 uppercase bg-gray-700 bg-opacity-60">
                    <tr>
                      <th scope="col" className="px-5 py-3">
                        Vehicle
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Plate
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Division
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Assignee
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Restrictions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allowedVehicles.map((vehicle, index) => (
                      <tr
                        key={vehicle.id || index}
                        className="border-b border-gray-700 hover:bg-gray-800/60 transition duration-150 ease-in-out"
                      >
                        <td className="px-5 py-3 font-medium text-white whitespace-nowrap">
                          {vehicle.vehicle}
                        </td>
                        <td className="px-5 py-3 text-gray-300">
                          {vehicle.plate || "-"}
                        </td>
                        <td className="px-5 py-3 text-gray-300">
                          {vehicle.division || "-"}
                        </td>
                        <td className="px-5 py-3 text-gray-300">
                          {vehicle.assignee || "Communal"}
                        </td>
                        <td className="px-5 py-3 text-gray-300">
                          {vehicle.restrictions || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400 italic">
                No specific vehicles allowed or assigned based on rank and
                certifications. Standard patrol vehicles may be available.
              </p>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default BadgeLookup;
