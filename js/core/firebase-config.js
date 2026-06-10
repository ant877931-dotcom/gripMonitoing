import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCAmyi5TyVleJstofDk1uDTk5__s4UzJNw",
  authDomain: "gripmonitoring.firebaseapp.com",
  databaseURL: "https://gripmonitoring-default-rtdb.firebaseio.com",
  projectId: "gripmonitoring",
  storageBucket: "gripmonitoring.firebasestorage.app",
  messagingSenderId: "890324773419",
  appId: "1:890324773419:web:6cd7989c4cefddff21186e"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
