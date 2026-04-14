import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB-y7jvu4IVXD-9y1f80za7LoIFdQKjJ8w",
  authDomain: "patterniq-e7fc3.firebaseapp.com",
  projectId: "patterniq-e7fc3",
  storageBucket: "patterniq-e7fc3.firebasestorage.app",
  messagingSenderId: "1083915166146",
  appId: "1:1083915166146:web:6d7c592a33847716d8b65b",
  measurementId: "G-RLMDMD14NY"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app); // NEW: Export the auth module