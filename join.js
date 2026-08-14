import { db, auth } from "./firebase-init.js";
import {
  collection, query, where, limit, getDocs
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const form = document.getElementById('join-form');
const input = document.getElementById('input-game-code');
const errorEl = document.getElementById('join-error');
const btnJoin = document.getElementById('btn-join');
const btnLabel = document.getElementById('btn-join-label');
const btnArrow = document.getElementById('btn-join-arrow');

function setLoading(isLoading, text) {
  btnJoin.disabled = isLoading;
  btnLabel.textContent = text || 'Masuk Game';
  btnArrow.style.display = isLoading ? 'none' : 'inline';
}

function showError(message) {
  errorEl.textContent = message;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');

  const code = input.value.trim().toUpperCase();
  if (!code) {
    showError('Masukkan kode game terlebih dahulu.');
    return;
  }

  setLoading(true, 'Mencari game...');

  try {
    // Cari sesi game dengan kode ini di Firestore
    const sessionsRef = collection(db, 'game_sessions');
    const q = query(sessionsRef, where('code', '==', code), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      setLoading(false);
      showError('Kode game tidak ditemukan. Cek lagi kode dari gurumu.');
      input.focus();
      return;
    }

    const sessionDoc = snapshot.docs[0];
    const sessionData = sessionDoc.data();

    if (sessionData.status === 'finished') {
      setLoading(false);
      showError('Game ini sudah selesai. Minta gurumu buat kode baru.');
      return;
    }

    setLoading(true, 'Masuk...');

    // Login anonim (tanpa perlu akun) supaya identitas siswa tetap aman & terlacak
    await signInAnonymously(auth);

    // Simpan info sesi untuk halaman berikutnya (halaman "isi nama" / permainan)
    sessionStorage.setItem('edugame_session_id', sessionDoc.id);
    sessionStorage.setItem('edugame_session_code', code);

    window.location.href = `play.html?session=${sessionDoc.id}`;

  } catch (err) {
    console.error(err);
    setLoading(false);
    showError('Gagal terhubung ke server. Cek koneksi internet kamu, lalu coba lagi.');
  }
});

input.addEventListener('input', () => {
  input.value = input.value.toUpperCase();
});