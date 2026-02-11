import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy
} from "firebase/firestore";

/**
 * חובה לעדכן את הפרטים הבאים מה-Firebase Console שלך!
 */
const firebaseConfig = {
  apiKey: "AIzaSyAfatOohOUJXSb1cNfIhhafOTM-6-60lTk",
  authDomain: "control-noc.firebaseapp.com",
  projectId: "control-noc",
  storageBucket: "control-noc.firebasestorage.app",
  messagingSenderId: "484408665691",
  appId: "1:484408665691:web:03a9ae99c566232e09417e",
  measurementId: "G-J79VRKMKE5"
};

const isConfigValid = firebaseConfig.apiKey !== "YOUR_API_KEY";
const app = isConfigValid ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;

export { db };

// פונקציה ליצירת ID יציב למשמרת (למשל: 2025-03-02_בוקר)
export const getShiftId = (dateStr: string, type: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const isoDate = `${year}-${month}-${day}`;
  const shiftKey = type.includes('בוקר') ? 'morning' : type.includes('ערב') ? 'evening' : 'night';
  return `${isoDate}_${shiftKey}`;
};

export const syncFaults = (shiftId: string, callback: (data: any[]) => void) => {
  if (!db) return () => {};
  
  const q = query(
    collection(db, "faults"), 
    where("shiftId", "==", shiftId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  }, (err) => {
    console.error("Firestore sync error:", err);
  });
};

export const syncPlanned = (shiftId: string, callback: (data: any[]) => void) => {
  if (!db) return () => {};
  const q = query(
    collection(db, "planned"), 
    where("shiftId", "==", shiftId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
};

export const dbAddFault = async (shiftId: string, fault: any) => {
  if (!db) return;
  try {
    await addDoc(collection(db, "faults"), { 
      ...fault, 
      shiftId, 
      createdAt: Date.now() 
    });
  } catch (e) {
    console.error("Error adding fault:", e);
  }
};

export const dbUpdateFault = async (id: string, updates: any) => {
  if (!db) return;
  await updateDoc(doc(db, "faults", id), updates);
};

export const dbDeleteFault = async (id: string) => {
  if (!db) return;
  await deleteDoc(doc(db, "faults", id));
};

export const dbAddPlanned = async (shiftId: string, description: string) => {
  if (!db) return;
  await addDoc(collection(db, "planned"), { 
    shiftId, 
    description, 
    createdAt: Date.now() 
  });
};

export const dbDeletePlanned = async (id: string) => {
  if (!db) return;
  await deleteDoc(doc(db, "planned", id));
};