// ==========================================
// FIREBASE INITIALIZATION (EduGame)
// Pakai CDN import (bukan npm) — konsisten dengan cara app.js yang sudah ada.
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Config project "edugame-sekolah" — ini AMAN untuk publik, bukan rahasia.
// Keamanan sebenarnya diatur lewat Firestore Security Rules, bukan disembunyikannya config ini.
const firebaseConfig = {
  apiKey: "AIzaSyBws6VXEksyZPz6JT1ARhRmRqQf__KZlCM",
  authDomain: "edugame-sekolah.firebaseapp.com",
  projectId: "edugame-sekolah",
  storageBucket: "edugame-sekolah.firebasestorage.app",
  messagingSenderId: "628006382619",
  appId: "1:628006382619:web:984ca833e085057bfddcbe"
};

const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);