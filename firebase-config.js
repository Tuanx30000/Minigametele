/* ==================== FIREBASE CONFIG ==================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp, 
  enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBZDSYBa9GSGBvkuhOqKNynNiFmOLmIiWQ",
  authDomain: "vuakhoangsan-a7689.firebaseapp.com",
  projectId: "vuakhoangsan-a7689",
  storageBucket: "vuakhoangsan-a7689.firebasestorage.app",
  messagingSenderId: "92770855297",
  appId: "1:92770855297:web:16c48a0923a84125512080"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.warn('[TUANX3000] Firebase persistence failed: multiple tabs open');
  } else if (err.code == 'unimplemented') {
    console.warn('[TUANX3000] Firebase persistence not supported by browser');
  }
});

export { 
  db, 
  auth, 
  signInAnonymously, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp 
};
