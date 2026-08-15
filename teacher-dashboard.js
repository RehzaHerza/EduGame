import { db, auth } from "./firebase-init.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection, addDoc, getDocs, query, where, limit, serverTimestamp,
  doc, updateDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const teacherEmailLabel = document.getElementById('teacher-email-label');
const btnLogout = document.getElementById('btn-logout');

const viewSetup = document.getElementById('view-setup');
const viewCode = document.getElementById('view-code');

const selectSubject = document.getElementById('select-subject');
const inputNewSubject = document.getElementById('input-new-subject');
const btnAddSubject = document.getElementById('btn-add-subject');

const btnCreateGame = document.getElementById('btn-create-game');
const btnCreateLabel = document.getElementById('btn-create-label');
const setupError = document.getElementById('setup-error');

const questionCountLabel = document.getElementById('question-count');
const btnToggleAddQuestion = document.getElementById('btn-toggle-add-question');
const formAddQuestion = document.getElementById('form-add-question');

const codeDisplay = document.getElementById('code-display');
const codeSubjectLabel = document.getElementById('code-subject-label');
const codeModeLabel = document.getElementById('code-mode-label');
const btnCopyCode = document.getElementById('btn-copy-code');
const btnBackToSetup = document.getElementById('btn-back-to-setup');

let currentUser = null;
let subjectsCache = [];

// ==========================================
// AUTH GUARD — kalau belum login (atau login-nya anonim/siswa), lempar balik ke halaman login
// ==========================================
onAuthStateChanged(auth, (user) => {
  if (!user || user.isAnonymous) {
    window.location.href = 'teacher-login.html';
    return;
  }
  currentUser = user;
  teacherEmailLabel.textContent = user.email;
  loadSubjects();
});

btnLogout.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'teacher-login.html';
});

// ==========================================
// MATA PELAJARAN — muat daftar, atau buat baru
// ==========================================
async function loadSubjects() {
  const snapshot = await getDocs(collection(db, 'subjects'));
  subjectsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  selectSubject.innerHTML = '';
  if (subjectsCache.length === 0) {
    selectSubject.innerHTML = '<option value="">Belum ada mapel — tambahkan dulu di bawah</option>';
    updateQuestionCount();
    return;
  }
  subjectsCache.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    selectSubject.appendChild(opt);
  });
  updateQuestionCount();
}

function updateQuestionCount() {
  const subject = subjectsCache.find(s => s.id === selectSubject.value);
  const count = subject && Array.isArray(subject.questions) ? subject.questions.length : 0;
  questionCountLabel.textContent = count;
}

selectSubject.addEventListener('change', updateQuestionCount);

btnToggleAddQuestion.addEventListener('click', () => {
  formAddQuestion.classList.toggle('hidden');
});

formAddQuestion.addEventListener('submit', async (e) => {
  e.preventDefault();

  const subjectId = selectSubject.value;
  if (!subjectId) {
    setupError.textContent = 'Pilih mata pelajaran dulu sebelum menambah soal.';
    return;
  }

  const newQuestion = {
    type: 'pilgan',
    question: document.getElementById('q-text').value.trim(),
    options: [
      document.getElementById('q-opt-0').value.trim(),
      document.getElementById('q-opt-1').value.trim(),
      document.getElementById('q-opt-2').value.trim(),
      document.getElementById('q-opt-3').value.trim()
    ],
    answer: parseInt(document.getElementById('q-correct').value, 10)
  };

  try {
    await updateDoc(doc(db, 'subjects', subjectId), {
      questions: arrayUnion(newQuestion)
    });
    formAddQuestion.reset();
    formAddQuestion.classList.add('hidden');
    await loadSubjects();
    selectSubject.value = subjectId;
    updateQuestionCount();
  } catch (err) {
    console.error(err);
    setupError.textContent = 'Gagal menyimpan soal. Coba lagi.';
  }
});

btnAddSubject.addEventListener('click', async () => {
  const name = inputNewSubject.value.trim();
  if (!name) return;

  btnAddSubject.disabled = true;
  btnAddSubject.textContent = 'Menyimpan...';

  try {
    const docRef = await addDoc(collection(db, 'subjects'), {
      name: name,
      ownerUid: currentUser.uid,
      createdAt: serverTimestamp()
    });
    inputNewSubject.value = '';
    await loadSubjects();
    selectSubject.value = docRef.id;
  } catch (err) {
    console.error(err);
    setupError.textContent = 'Gagal menambah mapel. Coba lagi.';
  } finally {
    btnAddSubject.disabled = false;
    btnAddSubject.textContent = '➕ Tambah';
  }
});

// ==========================================
// GENERATE KODE GAME UNIK
// ==========================================
function generateRandomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa I/O/0/1 biar tidak ketuker
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function generateUniqueCode() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateRandomCode();
    const q = query(collection(db, 'game_sessions'), where('code', '==', candidate), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return candidate;
  }
  throw new Error('Gagal membuat kode unik, coba lagi.');
}

// ==========================================
// BUAT SESI GAME
// ==========================================
btnCreateGame.addEventListener('click', async () => {
  setupError.textContent = '';

  const subjectId = selectSubject.value;
  if (!subjectId) {
    setupError.textContent = 'Pilih atau tambahkan mata pelajaran dulu.';
    return;
  }

  const mode = document.querySelector('input[name="game-mode"]:checked').value;
  const subject = subjectsCache.find(s => s.id === subjectId);

  const questionCount = subject && Array.isArray(subject.questions) ? subject.questions.length : 0;
  if (questionCount === 0) {
    setupError.textContent = 'Tambahkan minimal 1 soal dulu sebelum membuat kode game.';
    return;
  }

  btnCreateGame.disabled = true;
  btnCreateLabel.textContent = 'Membuat kode...';

  try {
    const code = await generateUniqueCode();

    await addDoc(collection(db, 'game_sessions'), {
      code: code,
      mode: mode,
      subjectId: subjectId,
      subjectName: subject.name,
      hostUid: currentUser.uid,
      status: 'waiting',
      activeQuestionIndex: 0,
      createdAt: serverTimestamp()
    });

    codeDisplay.textContent = code;
    codeSubjectLabel.textContent = `📚 ${subject.name}`;
    codeModeLabel.textContent = mode === 'live' ? '🟢 Live Bareng' : '🚀 Mandiri';

    viewSetup.classList.add('hidden');
    viewCode.classList.remove('hidden');

  } catch (err) {
    console.error(err);
    setupError.textContent = 'Gagal membuat game. Cek koneksi internet, coba lagi.';
  } finally {
    btnCreateGame.disabled = false;
    btnCreateLabel.textContent = '🎲 Buat Kode Game';
  }
});

btnCopyCode.addEventListener('click', () => {
  navigator.clipboard.writeText(codeDisplay.textContent).then(() => {
    btnCopyCode.textContent = '✅ Tersalin!';
    setTimeout(() => { btnCopyCode.textContent = '📋 Salin Kode'; }, 1500);
  });
});

btnBackToSetup.addEventListener('click', () => {
  viewCode.classList.add('hidden');
  viewSetup.classList.remove('hidden');
});