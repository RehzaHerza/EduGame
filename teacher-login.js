import { auth } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const form = document.getElementById('login-form');
const emailInput = document.getElementById('input-email');
const passwordInput = document.getElementById('input-password');
const errorEl = document.getElementById('login-error');
const btnLogin = document.getElementById('btn-login');
const btnLabel = document.getElementById('btn-login-label');

function setLoading(isLoading, text) {
  btnLogin.disabled = isLoading;
  btnLabel.textContent = text || 'Masuk';
}

function showError(message) {
  errorEl.textContent = message;
}

// Kalau guru sudah login sebelumnya (sesi masih aktif), langsung lempar ke dashboard
onAuthStateChanged(auth, (user) => {
  if (user && !user.isAnonymous) {
    window.location.href = 'teacher-dashboard.html';
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  setLoading(true, 'Memeriksa...');

  try {
    await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    // Berhasil login -> onAuthStateChanged di atas akan otomatis redirect ke dashboard
  } catch (err) {
    setLoading(false);
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
      showError('Email atau password salah. Coba lagi.');
    } else if (err.code === 'auth/invalid-email') {
      showError('Format email tidak valid.');
    } else if (err.code === 'auth/too-many-requests') {
      showError('Terlalu banyak percobaan gagal. Coba lagi beberapa menit lagi.');
    } else {
      showError('Gagal login. Cek koneksi internet kamu, lalu coba lagi.');
    }
  }
});