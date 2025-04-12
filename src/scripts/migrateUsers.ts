import { initializeApp } from 'firebase/app';
import { getFirestore, setDoc, doc } from 'firebase/firestore';
const { users } = require('../data/users');
import * as dotenv from 'dotenv';

dotenv.config(); // Load your .env variables

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

(async () => {
  for (const user of users) {
    const docId = user.email || `badge-${user.badge}`;
    const userData = {
      name: user.name,
      rank: user.rank,
      tasks: user.tasks || {} // Include tasks if available
    };
    await setDoc(doc(db, 'users', docId), userData);
    console.log(`✅ Uploaded: ${user.name} (${docId})`);
  }
  console.log('🎉 All users uploaded!');
})();
