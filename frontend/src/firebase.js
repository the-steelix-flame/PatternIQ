import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// --- ▼▼▼ PASTE YOUR FIREBASE CONFIG OBJECT FROM THE WEBSITE HERE ▼▼▼ ---
const firebaseConfig = {
  apiKey: "AIzaSyB-y7jvu4IVXD-9y1f80za7LoIFdQKjJ8w",
  authDomain: "patterniq-e7fc3.firebaseapp.com",
  projectId: "patterniq-e7fc3",
  storageBucket: "patterniq-e7fc3.firebasestorage.app",
  messagingSenderId: "1083915166146",
  appId: "1:1083915166146:web:6d7c592a33847716d8b65b",
  measurementId: "G-RLMDMD14NY"
};
// --- ▲▲▲ PASTE YOUR FIREBASE CONFIG OBJECT FROM THE WEBSITE HERE ▲▲▲ ---

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export firestore instance to be used in other files
export const db = getFirestore(app);
