import { db, auth } from "./firebase-init.js";
import { onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp, collection, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const sessionId = params.get('session');

const subjectLabel = document.getElementById('subject-label');
const scoreBadge = document.getElementById('score-badge');

const viewName = document.getElementById('view-name');
const viewLoading = document.getElementById('view-loading');
const viewEmpty = document.getElementById('view-empty');
const viewPlay = document.getElementById('view-play');
const viewResult = document.getElementById('view-result');

const formName = document.getElementById('form-name');
const inputPlayerName = document.getElementById('input-player-name');
const nameError = document.getElementById('name-error');

const playProgressLabel = document.getElementById('play-progress-label');
const progressFill = document.getElementById('progress-fill');
const playQuestion = document.getElementById('play-question');
const playOptions = document.getElementById('play-options');
const playExplanation = document.getElementById('play-explanation');
const btnNextQuestion = document.getElementById('btn-next-question');

const finalScore = document.getElementById('final-score');
const finalDetail = document.getElementById('final-detail');
const resultIcon = document.getElementById('result-icon');
const leaderboardList = document.getElementById('leaderboard-list');

let sessionData = null;
let questions = [];
let currentIndex = 0;
let score = 0;
let correctCount = 0;
let playerName = '';
let answeredCurrent = false;

function showView(view) {
  [viewName, viewLoading, viewEmpty, viewPlay, viewResult].forEach(v => v.classList.add('hidden'));
  view.classList.remove('hidden');
}

if (!sessionId) {
  subjectLabel.textContent = 'Sesi tidak valid';
  showView(viewEmpty);
} else {
  showView(viewName);
}

let myUid = null; // UID final yang dipakai konsisten di seluruh sesi main ini

// Tunggu Firebase Auth selesai memulihkan sesi login (dari join.html) sebelum
// memutuskan apakah perlu bikin identitas anonim baru atau tidak.
function waitForAuthReady() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// ==========================================
// STEP 1: ISI NAMA
// ==========================================
formName.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = inputPlayerName.value.trim();
  if (!name) return;

  playerName = name;
  nameError.textContent = '';
  showView(viewLoading);

  try {
    let user = await waitForAuthReady();
    if (!user) {
      const cred = await signInAnonymously(auth);
      user = cred.user;
    }
    myUid = user.uid;
    await loadSessionAndQuestions();
  } catch (err) {
    console.error(err);
    nameError.textContent = 'Gagal memuat game. Coba lagi.';
    showView(viewName);
  }
});

// ==========================================
// MUAT SESI + SOAL
// ==========================================
async function loadSessionAndQuestions() {
  const sessionSnap = await getDoc(doc(db, 'game_sessions', sessionId));
  if (!sessionSnap.exists()) {
    subjectLabel.textContent = 'Sesi tidak ditemukan';
    showView(viewEmpty);
    return;
  }
  sessionData = sessionSnap.data();
  subjectLabel.textContent = sessionData.subjectName || 'EduGame';

  const subjectSnap = await getDoc(doc(db, 'subjects', sessionData.subjectId));
  const subjectData = subjectSnap.exists() ? subjectSnap.data() : {};
  questions = Array.isArray(subjectData.questions) ? subjectData.questions : [];

  if (questions.length === 0) {
    showView(viewEmpty);
    return;
  }

  // Catat peserta ke Firestore (biar guru & leaderboard nanti bisa lihat)
  await setDoc(doc(db, 'game_sessions', sessionId, 'participants', myUid), {
    name: playerName,
    score: 0,
    correctCount: 0,
    totalQuestions: questions.length,
    status: 'playing',
    joinedAt: serverTimestamp()
  });

  currentIndex = 0;
  score = 0;
  correctCount = 0;
  renderQuestion();
  showView(viewPlay);
}

// ==========================================
// TAMPILKAN SOAL
// ==========================================
function renderQuestion() {
  answeredCurrent = false;
  const q = questions[currentIndex];

  playProgressLabel.textContent = `Soal ${currentIndex + 1} dari ${questions.length}`;
  progressFill.style.width = `${Math.round(((currentIndex + 1) / questions.length) * 100)}%`;
  playQuestion.textContent = q.question;

  playExplanation.classList.add('hidden');
  btnNextQuestion.classList.add('hidden');

  playOptions.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];
  q.options.forEach((optText, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'play-option-btn';
    btn.textContent = `${letters[idx]}. ${optText}`;
    btn.addEventListener('click', () => handleAnswer(idx));
    playOptions.appendChild(btn);
  });
}

// ==========================================
// JAWAB SOAL
// ==========================================
async function handleAnswer(selectedIndex) {
  if (answeredCurrent) return;
  answeredCurrent = true;

  const q = questions[currentIndex];
  const isCorrect = selectedIndex === q.answer;
  const optionBtns = playOptions.querySelectorAll('.play-option-btn');
  optionBtns.forEach(b => b.disabled = true);

  if (isCorrect) {
    optionBtns[selectedIndex].classList.add('correct');
    score += 100;
    correctCount += 1;
  } else {
    optionBtns[selectedIndex].classList.add('wrong');
    if (optionBtns[q.answer]) optionBtns[q.answer].classList.add('correct');
  }

  scoreBadge.textContent = `⭐ ${score}`;

  if (q.explanation) {
    playExplanation.textContent = q.explanation;
    playExplanation.classList.remove('hidden');
  }

  btnNextQuestion.classList.remove('hidden');

  // Simpan progres ke Firestore setiap jawab (biar leaderboard bisa real-time nanti)
  try {
    await setDoc(doc(db, 'game_sessions', sessionId, 'participants', myUid), {
      score: score,
      correctCount: correctCount,
      currentIndex: currentIndex + 1
    }, { merge: true });
  } catch (err) {
    console.error('Gagal menyimpan progres:', err);
  }
}

btnNextQuestion.addEventListener('click', () => {
  if (currentIndex < questions.length - 1) {
    currentIndex += 1;
    renderQuestion();
  } else {
    finishGame();
  }
});

// ==========================================
// LEADERBOARD REAL-TIME
// ==========================================
function listenToLeaderboard() {
  const participantsRef = collection(db, 'game_sessions', sessionId, 'participants');
  const q = query(participantsRef, orderBy('score', 'desc'));

  onSnapshot(q, (snapshot) => {
    leaderboardList.innerHTML = '';

    if (snapshot.empty) {
      leaderboardList.innerHTML = '<p class="leaderboard-loading">Belum ada peserta.</p>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    let rank = 0;

    snapshot.forEach((docSnap) => {
      rank += 1;
      const data = docSnap.data();
      const isMe = docSnap.id === myUid;

      const row = document.createElement('div');
      row.className = `leaderboard-row-play ${rank <= 3 ? `rank-${rank}` : ''} ${isMe ? 'is-me' : ''}`;
      row.innerHTML = `
        <span class="lb-rank">${medals[rank - 1] || `#${rank}`}</span>
        <span class="lb-name">${escapeHtml(data.name || 'Anonim')}${isMe ? ' (Kamu)' : ''}</span>
        <span class="lb-score">${data.score || 0}</span>
        <span class="lb-status">${data.status === 'finished' ? '✅' : '⏳'}</span>
      `;
      leaderboardList.appendChild(row);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==========================================
// SELESAI
// ==========================================
async function finishGame() {
  const accuracy = Math.round((correctCount / questions.length) * 100);

  finalScore.textContent = score;
  finalDetail.textContent = `${correctCount} dari ${questions.length} benar (${accuracy}%)`;
  resultIcon.textContent = accuracy === 100 ? '🏆' : accuracy >= 60 ? '🥇' : '🔧';

  try {
    await setDoc(doc(db, 'game_sessions', sessionId, 'participants', myUid), {
      status: 'finished',
      finishedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.error('Gagal menyimpan status selesai:', err);
  }

  showView(viewResult);
  listenToLeaderboard();
}