// pages/MyDashboard.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { images } from "../data/images";

const saspStar = "/SASPLOGO2.png";

// ----- Type Definitions -----
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
  assignedVehicleId?: string;
  isActive?: boolean;
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
}

interface UserTask {
  id: string;
  description: string;
  assignedAt?: Date;
  completed?: boolean;
  goal?: number | null;
  progress?: number;
  type?: "goal" | "normal";
}

interface DisciplineRecord {
  note: string;
  issuedAt?: Date;
}

const certificationKeys = ["HEAT", "ACU", "MBU"];
const divisionKeys = ["K9", "FTO", "SWAT", "CIU"];

const MyDashboard: React.FC = () => {
  const { user: authUser } = useAuth();
  const [userData, setUserData] = useState<RosterUser | null>(null);
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);
  const [allowedVehicles, setAllowedVehicles] = useState<Vehicle[]>([]);
  const [discipline, setDiscipline] = useState<DisciplineRecord | null>(null);
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bgImage = useMemo(
    () => images[Math.floor(Math.random() * images.length)],
    []
  );

  useEffect(() => {
    const fetchEverything = async () => {
      if (!authUser?.email) {
        setError("No user email found.");
        return;
      }

      setLoading(true);
      try {
        const userRef = doc(dbFirestore, "users", authUser.email);
        const userSnap = await getDoc(userRef);
        const data = userSnap.data();

        if (!userSnap.exists() || !data) throw new Error("User not found");

        const normalizedCerts = data.certifications
          ? Object.entries(data.certifications).reduce((acc, [key, val]) => {
              let status: CertStatus = null;
              if (typeof val === "string") {
                const upperVal = val.toUpperCase();
                if (["CERT", "SUPER", "LEAD"].includes(upperVal))
                  status = upperVal as CertStatus;
              } else if (val === true) {
                status = "CERT";
              }
              acc[key.toUpperCase()] = status;
              return acc;
            }, {} as { [key: string]: CertStatus | null })
          : {};

        const parsedUser: RosterUser = {
          id: userSnap.id,
          name: data.name,
          rank: data.rank,
          badge: data.badge,
          callsign: data.callsign,
          certifications: normalizedCerts,
          assignedVehicleId: data.assignedVehicleId,
          isActive: data.isActive ?? true,
          email: authUser.email,
        };

        setUserData(parsedUser);

        // Discipline
        const discRef = doc(
          dbFirestore,
          "users",
          authUser.email,
          "discipline",
          "record"
        );
        const discSnap = await getDoc(discRef);
        if (discSnap.exists()) {
          const discData = discSnap.data();
          setDiscipline({
            note: discData.note,
            issuedAt: discData.issuedAt?.toDate(),
          });
        }

        // Tasks
        const tasksRef = collection(
          dbFirestore,
          "users",
          authUser.email,
          "tasks"
        );
        const taskQuery = query(tasksRef, orderBy("assignedAt", "desc"));
        const taskSnap = await getDocs(taskQuery);
        setTasks(
          taskSnap.docs.map((doc) => {
            const t = doc.data();
            return {
              id: doc.id,
              description: t.description,
              completed: t.completed ?? false,
              goal: t.goal,
              progress: t.progress,
              assignedAt:
                t.assignedAt instanceof Timestamp
                  ? t.assignedAt.toDate()
                  : typeof t.assignedAt === "string"
                  ? new Date(t.assignedAt)
                  : undefined,
              type: t.type === "goal-oriented" ? "goal" : "normal",
            };
          })
        );

        // Vehicles
        const vehicleSnap = await getDocs(collection(dbFirestore, "fleet"));
        const allVehicles = vehicleSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Vehicle[];

        // Assigned vehicle
        const userNameUpper = parsedUser.name.toUpperCase();
        const initialLast = parsedUser.name
          .split(" ")
          .map((x, i, arr) =>
            i === 0 ? x.charAt(0).toUpperCase() + "." : arr[arr.length - 1]
          )
          .join(" ")
          .toUpperCase();

        let assigned = allVehicles.find(
          (v) =>
            v.assignee?.toUpperCase() === userNameUpper ||
            v.assignee?.toUpperCase() === initialLast
        );

        if (!assigned && parsedUser.assignedVehicleId) {
          const fallback = doc(
            dbFirestore,
            "fleet",
            parsedUser.assignedVehicleId
          );
          const fallbackSnap = await getDoc(fallback);
          if (fallbackSnap.exists()) {
            assigned = {
              id: fallbackSnap.id,
              ...fallbackSnap.data(),
            } as Vehicle;
          }
        }

        setAssignedVehicle(assigned || null);

        // Allowed Vehicles
        const rankValue = rankOrder[parsedUser.rank] ?? rankOrder.Unknown;
        const hasCertAccess = (key: string | null): boolean => {
          if (!key) return true;
          const val = parsedUser.certifications?.[key.toUpperCase()];
          return ["CERT", "SUPER", "LEAD"].includes(val ?? "");
        };

        const allowed = allVehicles.filter((v) => {
          if (v.assignee && v.assignee !== "COMMUNAL") return false;

          let requiredRank = Infinity;
          const r = (v.restrictions || "").toLowerCase();
          if (r.includes("high command")) requiredRank = rankOrder.Commander;
          else if (r.includes("command")) requiredRank = rankOrder.Lieutenant;
          else if (r.includes("supervisor")) requiredRank = rankOrder.Sergeant;

          if (rankValue > requiredRank) return false;

          let certKey = null;
          const d = (v.division || "").toUpperCase();
          if (d.includes("HEAT")) certKey = "HEAT";
          else if (d.includes("MOTO")) certKey = "MBU";
          else if (d.includes("ACU")) certKey = "ACU";

          return hasCertAccess(certKey);
        });

        setAllowedVehicles(allowed);
      } catch (err) {
        console.error(err);
        setError("Error loading dashboard.");
      } finally {
        setLoading(false);
      }
    };

    fetchEverything();
  }, [authUser?.email]);

  const getCertStyle = (status: CertStatus | null) => {
    if (status === "LEAD") return "bg-blue-600 text-white";
    if (status === "SUPER") return "bg-orange-600 text-white";
    if (status === "CERT") return "bg-green-600 text-white";
    return "bg-gray-600 text-gray-300";
  };

  if (loading)
    return (
      <Layout>
        <p className="text-yellow-400 text-center mt-20">
          Loading dashboard...
        </p>
      </Layout>
    );
  if (error || !userData)
    return (
      <Layout>
        <p className="text-red-400 text-center mt-20">
          {error || "User not found."}
        </p>
      </Layout>
    );

  return (
    <Layout>
      <div className="space-y-10 px-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3">
          <img src={saspStar} alt="SASP" className="w-20 h-20" />
          <h1 className="text-4xl font-extrabold text-[#f3c700] tracking-tight">
            My Dashboard
          </h1>
          <p className="text-xl text-gray-200">
            Welcome back, {userData.rank} {userData.name}!
          </p>
        </div>

        {/* Trooper Info */}
        <div className="admin-section p-5 bg-black bg-opacity-75 rounded-lg shadow-xl">
          <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700] border-b-2 border-yellow-600 pb-2">
            Trooper Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-base">
            {[
              { label: "Name", value: userData.name },
              { label: "Rank", value: userData.rank },
              { label: "Badge", value: userData.badge },
              { label: "Callsign", value: userData.callsign || "-" },
              {
                label: "Status",
                value: userData.isActive ? "Active" : "Inactive",
                color: userData.isActive ? "bg-green-600" : "bg-red-600",
              },
            ].map((item) => (
              <div key={item.label} className="flex justify-between">
                <strong className="text-yellow-500">{item.label}:</strong>
                <span
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    item.color || "bg-gray-700 text-gray-200"
                  }`}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks & Discipline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tasks */}
          <div className="admin-section p-5 bg-black bg-opacity-75 rounded-lg shadow-xl">
            <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700] border-b-2 border-yellow-600 pb-2">
              Assigned Tasks
            </h2>
            {tasks.length > 0 ? (
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li
                    key={t.id}
                    className="text-sm text-gray-300 bg-gray-800/50 px-3 py-1.5 rounded"
                  >
                    <p
                      className={`${
                        t.completed ? "line-through text-gray-500" : ""
                      }`}
                    >
                      {t.description}
                    </p>
                    <small className="text-[10px] text-gray-400 block mt-1">
                      {t.type === "goal" &&
                        `Goal: ${t.goal}, Progress: ${t.progress} | `}
                      Status:{" "}
                      {t.completed ? (
                        <span className="text-green-500">Completed</span>
                      ) : (
                        <span className="text-yellow-500">In Progress</span>
                      )}
                      {t.assignedAt && (
                        <span className="ml-2">
                          | Assigned: {t.assignedAt.toLocaleString()}
                        </span>
                      )}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 italic">No assigned tasks.</p>
            )}
          </div>

          {/* Discipline */}
          <div className="admin-section p-5 bg-black bg-opacity-75 rounded-lg shadow-xl">
            <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700] border-b-2 border-yellow-600 pb-2">
              Discipline Record
            </h2>
            {discipline ? (
              <div className="text-sm text-gray-300 bg-gray-800/50 px-3 py-1.5 rounded">
                <p className="whitespace-pre-wrap">{discipline.note}</p>
                {discipline.issuedAt && (
                  <small className="text-[10px] text-gray-400 block mt-1">
                    Issued At: {discipline.issuedAt.toLocaleString()}
                  </small>
                )}
              </div>
            ) : (
              <p className="text-gray-400 italic">
                No discipline record on file.
              </p>
            )}
          </div>
        </div>

        {/* Certifications & Assigned Vehicle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Certifications */}
          <div className="admin-section p-5 bg-black bg-opacity-75 rounded-lg shadow-xl">
            <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700] border-b-2 border-yellow-600 pb-2">
              Certifications & Divisions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {[divisionKeys, certificationKeys].map((keys, i) => (
                <div key={i}>
                  <h3 className="text-xl font-semibold text-yellow-500 mb-3">
                    {i === 0 ? "Divisions" : "Certifications"}
                  </h3>
                  <div className="space-y-2.5">
                    {keys.map((k) => {
                      const s =
                        userData.certifications?.[k.toUpperCase()] ?? null;
                      const style =
                        s === "LEAD"
                          ? "bg-blue-600 text-white"
                          : s === "SUPER"
                          ? "bg-orange-600 text-white"
                          : s === "CERT"
                          ? "bg-green-600 text-white"
                          : "bg-gray-600 text-gray-300";
                      return (
                        <div key={k} className="flex justify-between">
                          <span className="text-gray-300 font-medium">
                            {k}:
                          </span>
                          <span
                            className={`px-3 py-1 rounded text-xs font-semibold ${style}`}
                          >
                            {s || "None"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Vehicle */}
          <div className="admin-section p-5 bg-black bg-opacity-75 rounded-lg shadow-xl">
            <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700] border-b-2 border-yellow-600 pb-2">
              Assigned Vehicle
            </h2>
            {assignedVehicle ? (
              <div className="grid grid-cols-1 gap-4 text-base">
                {[
                  { label: "Vehicle", value: assignedVehicle.vehicle },
                  { label: "Plate", value: assignedVehicle.plate || "-" },
                  { label: "Division", value: assignedVehicle.division || "-" },
                  {
                    label: "Restrictions",
                    value: assignedVehicle.restrictions || "-",
                  },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between">
                    <strong className="text-yellow-500">{item.label}:</strong>
                    <span className="bg-gray-700 text-gray-200 px-3 py-1 rounded-md text-sm">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 italic">No assigned vehicle found.</p>
            )}
          </div>
        </div>

        {/* Allowed Vehicles */}
        <div className="admin-section p-5 bg-black bg-opacity-75 rounded-lg shadow-xl">
          <h2 className="section-header text-2xl font-bold mb-4 text-[#f3c700] border-b-2 border-yellow-600 pb-2">
            Allowed Vehicles
          </h2>
          {allowedVehicles.length > 0 ? (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="min-w-full text-sm text-left">
                <thead className="text-xs text-yellow-300 uppercase bg-gray-700 bg-opacity-60">
                  <tr>
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Plate</th>
                    <th className="px-5 py-3">Division</th>
                    <th className="px-5 py-3">Restrictions</th>
                  </tr>
                </thead>
                <tbody>
                  {allowedVehicles.map((v) => (
                    <tr
                      key={v.id}
                      className="border-b border-gray-700 hover:bg-gray-800/60"
                    >
                      <td className="px-5 py-3 text-white font-medium">
                        {v.vehicle}
                      </td>
                      <td className="px-5 py-3 text-gray-300">
                        {v.plate || "-"}
                      </td>
                      <td className="px-5 py-3 text-gray-300">
                        {v.division || "-"}
                      </td>
                      <td className="px-5 py-3 text-gray-300">
                        {v.restrictions || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 italic">
              No allowed vehicles found based on your certifications or rank.
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MyDashboard;
