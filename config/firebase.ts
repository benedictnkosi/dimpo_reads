console.log('[ENTRY] config/firebase.ts loaded');
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyA19oZVV-JIleL-XlEbDK8k-KPNk1vod8E",
  authDomain: "exam-quiz-b615e.firebaseapp.com",
  projectId: "exam-quiz-b615e",
  storageBucket: "exam-quiz-b615e.firebasestorage.app",
  messagingSenderId: "619089624841",
  appId: "1:619089624841:web:8cdb542ea7c8eb22681dd8",
  measurementId: "G-MR80CKN8H9"
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
console.log("Firebase App initialized:", app.name);

// Initialize Auth with React Native persistence
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);
export const storage = getStorage(app);

export { app, auth, db, firebaseConfig }; 