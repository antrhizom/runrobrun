import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase Config - ERSETZE mit deinen Werten von Schritt 3!
const firebaseConfig = {
  apiKey: "AIzaSyCiTVk0sYAX_yz8MBbA3sxbC-Bl2Ra-dZ8",
  authDomain: "runrobrun-7edff.firebaseapp.com",
  projectId: "runrobrun-7edff",
  storageBucket: "runrobrun-7edff.firebasestorage.app",
  messagingSenderId: "252639334199",
  appId: "1:252639334199:web:22b9eb1098d19a64fa94b2"
};

// Firebase initialisieren
const app = initializeApp(firebaseConfig);

// Firestore exportieren
export const db = getFirestore(app);