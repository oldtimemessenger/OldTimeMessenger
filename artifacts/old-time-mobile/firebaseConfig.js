import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAKboA9COjUhwRhDQkMdC0NuIX5HoriOBw",
  authDomain: "oldtime-a23af.firebaseapp.com",
  projectId: "oldtime-a23af",
  storageBucket: "oldtime-a23af.firebasestorage.app",
  messagingSenderId: "226926464189",
  appId: "1:226926464189:web:72281a60b2abc791e4fbd4",
  measurementId: "G-Z3EW66LP34"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);