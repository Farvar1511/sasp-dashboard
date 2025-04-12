// importFleet.ts
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fleetData from "../data/fleet";
import dotenv from "dotenv";

dotenv.config(); // Load .env for Firebase config

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function importFleet() {
  for (const vehicle of fleetData) {
    try {
      const ref = doc(db, "fleet", vehicle.plate); // plate as document ID
      await setDoc(ref, vehicle);
      console.log(`✅ Uploaded: ${vehicle.plate}`);
    } catch (err) {
      console.error(`❌ Failed to upload ${vehicle.plate}`, err);
    }
  }
  console.log("🎉 All vehicles processed!");
}

importFleet();
