import React, { useState, useMemo } from "react"; // Import useMemo
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
import { images } from "../data/images"; // Import images array
export const saspStar = "/SASPLOGO2.png"; // Corrected path to logo

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

  // Use useMemo to ensure the background image is only selected once
  const randomBackgroundImage = useMemo(
    () => images[Math.floor(Math.random() * images.length)],
    []
  );

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
              let normalizedValue: CertStatus = null; // Default to null
              const currentKeyUpper = key.toUpperCase(); // Uppercase key once

              if (typeof value === "string") {
                const upperValue = value.toUpperCase();
                if (
                  upperValue === "CERT" ||
                  upperValue === "SUPER" ||
                  upperValue === "LEAD"
                ) {
                  normalizedValue = upperValue as CertStatus;
                }
              } else if (typeof value === "boolean" && value === true) {
                // Treat boolean true as 'CERT'
                normalizedValue = "CERT";
              }
              // Any other type (false, number, null, undefined etc.) or invalid string remains null

              acc[currentKeyUpper] = normalizedValue; // Store with uppercase key
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

  const getCertStyle = (status: CertStatus | null) => {
    if (status === "LEAD")
      return { bgColor: "bg-blue-600", textColor: "text-white" };
    if (status === "SUPER")
      return { bgColor: "bg-orange-600", textColor: "text-white" };
    if (status === "CERT")
      return { bgColor: "bg-green-600", textColor: "text-white" };
    return { bgColor: "bg-gray-600", textColor: "text-gray-300" };
  };

  const certificationKeys = ["HEAT", "ACU", "MBU"]; // Removed "MOTO"
  const divisionKeys = ["K9", "FTO", "SWAT", "CIU"];

  return (
    <Layout user={authUser!}>
      <div
        className="page-content space-y-8 bg-cover bg-center min-h-screen p-4 md:p-6 lg:p-8" // Added padding
        style={{ backgroundImage: `url(${randomBackgroundImage})` }} // Use memoized background image
      >
        {/* Header Section */}
        <div className="flex flex-col items-center space-y-3 mb-6">
          <img src={saspStar} alt="SASP Star" className="w-20 h-20" />{" "}
          {/* Increased size */}
          <h1 className="text-4xl font-extrabold text-[#f3c700] text-center tracking-tight">
            {" "}
            {/* Adjusted size/tracking */}
            Badge Lookup
          </h1>
        </div>

        {/* Lookup Input Section */}
        <div className="max-w-md mx-auto flex items-center gap-3 p-4 bg-black bg-opacity-60 rounded-lg shadow-lg">
          {" "}
          {/* Centered and styled container */}
          <input
            type="text"
            value={badgeInput}
            onChange={(e) => setBadgeInput(e.target.value)}
            placeholder="Enter Badge Number"
            className="input flex-grow bg-gray-700 text-white border-gray-600 placeholder-gray-400 focus:ring-[#f3c700] focus:border-[#f3c700]" // Improved input styling
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          />
          <button
            onClick={handleLookup}
            className="button-primary bg-[#f3c700] text-black font-semibold py-2 px-4 rounded-lg hover:bg-[#d4a900] transition duration-150 ease-in-out disabled:opacity-50" // Adjusted padding/styling
            disabled={loading}
          >
            {loading ? "Searching..." : "Lookup"}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-red-400 text-center font-medium bg-red-900 bg-opacity-50 py-2 px-4 rounded-md max-w-md mx-auto">
            {error}
          </p> // Improved error styling
        )}

        {/* Results Section */}
        {foundUser && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {" "}
            {/* Centered results container */}
            {/* Trooper Info Section */}
            <div className="admin-section p-5 bg-black bg-opacity-75 rounded-lg shadow-xl">
              {" "}
              {/* Increased padding/opacity/shadow */}
              <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700] border-b-2 border-yellow-600 pb-2">
                {" "}
                {/* Adjusted size/border */}
                Trooper Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-base">
                {" "}
                {/* Adjusted gap/text size */}
                {/* Info Item Helper */}
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
            {/* Certifications & Divisions Section */}
            <div className="admin-section p-5 bg-black bg-opacity-75 rounded-lg shadow-xl">
              <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700] border-b-2 border-yellow-600 pb-2">
                Certifications & Divisions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {" "}
                {/* Increased gap */}
                {/* Divisions */}
                <div>
                  <h3 className="text-xl font-semibold text-yellow-500 mb-3">
                    {" "}
                    {/* Adjusted size/margin */}
                    Divisions
                  </h3>
                  <div className="space-y-2.5">
                    {" "}
                    {/* Increased spacing */}
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
                          </span>{" "}
                          {/* Adjusted width */}
                          <span
                            className={`px-2.5 py-1 rounded text-xs font-semibold ${style.bgColor} ${style.textColor}`}
                          >
                            {" "}
                            {/* Adjusted padding */}
                            {status || "None"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Certifications */}
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
            {/* Allowed Vehicles Section */}
            <div className="admin-section p-5 bg-black bg-opacity-75 rounded-lg shadow-xl">
              <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700] border-b-2 border-yellow-600 pb-2">
                Allowed Vehicles
              </h2>
              {allowedVehicles.length > 0 ? (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="min-w-full text-sm text-left">
                    <thead className="text-xs text-yellow-300 uppercase bg-gray-700 bg-opacity-60">
                      {" "}
                      {/* Adjusted colors */}
                      <tr>
                        <th scope="col" className="px-5 py-3">
                          {" "}
                          {/* Increased padding */}
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
                          className="border-b border-gray-700 hover:bg-gray-800/60 transition duration-150 ease-in-out" // Added transition
                        >
                          <td className="px-5 py-3 font-medium text-white whitespace-nowrap">
                            {" "}
                            {/* Increased padding */}
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
      </div>
    </Layout>
  );
};

export default BadgeLookup;
