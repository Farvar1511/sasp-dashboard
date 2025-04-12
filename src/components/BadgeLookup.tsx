import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";

// Define the data structure for a trooper from the Roster sheet
interface RosterData {
  Badge: string; // e.g. "204"
  Name: string; // e.g. "John Smith"
  Rank: string; // e.g. "Corporal"
  Callsign: string; // e.g. "1K-100"
  SWAT?: string; // Optional SWAT info
  AssignedVehicles?: string; // Optional comma-separated list of assigned vehicles
}

// Define the structure for fleet entries from the Fleet sheet
interface FleetData {
  Vehicle: string; // e.g. "Nagasaki Outlaw (Offroad)"
  Ranks: string; // Comma-separated list e.g. "Trooper, Corporal, Sergeant"
  Type: string; // "Communal" or "Assigned"
}

export default function BadgeLookup() {
  const navigate = useNavigate();

  // Input state for badge lookup
  const [badgeInput, setBadgeInput] = useState("");
  const [rosterError, setRosterError] = useState(""); // Separate error for roster
  const [fleetError, setFleetError] = useState(""); // Separate error for fleet

  // Data states for roster and fleet
  const [roster, setRoster] = useState<RosterData[]>([]);
  const [fleet, setFleet] = useState<FleetData[]>([]);

  // The selected trooper that matches the entered badge
  const [selectedTrooper, setSelectedTrooper] = useState<RosterData | null>(
    null
  );

  // Fetch both Roster and Fleet data on mount
  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/roster`, {
        headers: { "x-api-key": import.meta.env.VITE_API_KEY },
      })
      .then((res) => setRoster(res.data))
      .catch((err) => {
        console.error("Error fetching roster data:", err);
        setRosterError("Failed to load roster data.");
      });

    axios
      .get(`${import.meta.env.VITE_API_URL}/api/fleet`, {
        headers: { "x-api-key": import.meta.env.VITE_API_KEY },
      })
      .then((res) => setFleet(res.data))
      .catch((err) => {
        console.error("Error fetching fleet data:", err);
        setFleetError("Failed to load fleet data.");
      });
  }, []);

  // Lookup function for badge number
  const handleLookup = () => {
    console.log("Badge input:", badgeInput); // Debugging
    if (!badgeInput.trim()) {
      setRosterError("Please enter a badge number.");
      setSelectedTrooper(null);
      return;
    }

    // Find the trooper matching the badge number (case-insensitive)
    const foundTrooper = roster.find((trooper) => {
      console.log("Checking trooper:", trooper); // Debugging
      return (
        trooper.Badge.trim().toLowerCase() === badgeInput.trim().toLowerCase()
      );
    });

    if (!foundTrooper) {
      console.warn(`No trooper found for badge #${badgeInput}`); // Debugging
      setSelectedTrooper(null);
      setRosterError(`No trooper found for badge #${badgeInput}.`);
    } else {
      console.log("Trooper found:", foundTrooper); // Debugging
      setSelectedTrooper(foundTrooper);
      setRosterError("");
    }
  };

  // Generate list of communal vehicles allowed for this trooper's rank.
  const getAuthorizedVehicles = (trooperRank: string): string[] => {
    return fleet
      .filter((entry) => {
        // Only interested in communal vehicles.
        if (entry.Type.trim().toLowerCase() !== "communal") return false;
        // Check if the trooper's rank (or a substring) is included
        return entry.Ranks.toLowerCase().includes(trooperRank.toLowerCase());
      })
      .map((entry) => entry.Vehicle);
  };

  return (
    <Layout
      user={
        {
          /* Add appropriate user data here */
        }
      }
    >
      <div className="page-content">
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: "2rem",
          }}
        >
          <div
            style={{
              background: "#222",
              padding: "2rem",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "900px",
            }}
          >
            <h2 style={{ textAlign: "center", color: "#fff" }}>
              <img
                src="https://i.gyazo.com/6e5fafdef23c369d0151409fb79b44ca.png"
                style={{ width: 30, verticalAlign: "middle", marginRight: 10 }}
                alt="SASP Badge"
              />
              SASP Trooper Reference Page
            </h2>

            {/* Badge Lookup Input */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                margin: "1rem 0",
              }}
            >
              <label style={{ color: "#fff", marginRight: 10 }}>
                Badge Number:
              </label>
              <input
                type="text"
                value={badgeInput}
                onChange={(e) => setBadgeInput(e.target.value)}
                style={{ padding: "5px", fontSize: "1rem", width: 150 }}
              />
              <button
                className="button-primary"
                style={{ marginLeft: 10 }}
                onClick={handleLookup}
              >
                Lookup
              </button>
            </div>

            {/* Display Errors */}
            {rosterError && (
              <p style={{ color: "red", textAlign: "center" }}>{rosterError}</p>
            )}
            {fleetError && (
              <p style={{ color: "red", textAlign: "center" }}>{fleetError}</p>
            )}

            {/* Display Trooper Info if Available */}
            {selectedTrooper && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  marginTop: "1rem",
                }}
              >
                {/* Trooper Information */}
                <div>
                  <h3 style={{ color: "orange" }}>Trooper Information</h3>
                  <div className="info-box">Name: {selectedTrooper.Name}</div>
                  <div className="info-box">Rank: {selectedTrooper.Rank}</div>
                  <div className="info-box">Badge: {selectedTrooper.Badge}</div>
                  <div className="info-box">
                    Callsign: {selectedTrooper.Callsign}
                  </div>
                </div>

                {/* Assigned Vehicles */}
                <div>
                  <h3 style={{ color: "orange" }}>Assigned Vehicles</h3>
                  <div className="info-box">
                    {selectedTrooper.AssignedVehicles
                      ? selectedTrooper.AssignedVehicles
                      : "None listed."}
                  </div>
                </div>

                {/* SWAT Information */}
                <div>
                  <h3 style={{ color: "orange" }}>SWAT Information</h3>
                  <div className="info-box">
                    {selectedTrooper.SWAT
                      ? selectedTrooper.SWAT
                      : "No SWAT info available"}
                  </div>
                </div>

                {/* Authorized Communal Vehicles */}
                <div>
                  <h3 style={{ color: "orange" }}>
                    Authorized Communal Vehicles
                  </h3>
                  <div className="info-box">
                    {getAuthorizedVehicles(selectedTrooper.Rank).join(", ") ||
                      "None available for this rank."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
