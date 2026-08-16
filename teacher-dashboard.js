import { db, auth } from "./firebase-init.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection, addDoc, getDocs, query, where, limit, serverTimestamp,
  doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, orderBy, deleteDoc
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
const questionList = document.getElementById('question-list');
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
  restoreActiveGameIfAny();
});

function restoreActiveGameIfAny() {
  const savedSessionId = sessionStorage.getItem('edugame_active_session_id');
  const savedCode = sessionStorage.getItem('edugame_active_code');
  const savedSubjectName = sessionStorage.getItem('edugame_active_subject_name');
  const savedMode = sessionStorage.getItem('edugame_active_mode');

  if (!savedSessionId) return;

  codeDisplay.textContent = savedCode || '------';
  codeSubjectLabel.textContent = savedSubjectName ? `📚 ${savedSubjectName}` : '';
  codeModeLabel.textContent = savedMode === 'live' ? '🟢 Live Bareng' : '🚀 Mandiri';

  viewSetup.classList.add('hidden');
  viewCode.classList.remove('hidden');

  listenToParticipants(savedSessionId);
}

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

  // Ingat mapel terakhir yang dipilih guru, jangan selalu balik ke yang pertama
  const lastSubjectId = localStorage.getItem('edugame_last_subject_id');
  const stillExists = subjectsCache.some(s => s.id === lastSubjectId);
  if (lastSubjectId && stillExists) {
    selectSubject.value = lastSubjectId;
  }

  updateQuestionCount();
}

selectSubject.addEventListener('change', () => {
  localStorage.setItem('edugame_last_subject_id', selectSubject.value);
});

const btnDeleteSubject = document.getElementById('btn-delete-subject');

btnDeleteSubject.addEventListener('click', async () => {
  const subjectId = selectSubject.value;
  const subject = subjectsCache.find(s => s.id === subjectId);
  if (!subject) return;

  const questionCount = Array.isArray(subject.questions) ? subject.questions.length : 0;
  const confirmMsg = `Yakin hapus mapel "${subject.name}"? Ini akan menghapus mapel beserta ${questionCount} soal di dalamnya. Tindakan ini tidak bisa dibatalkan.`;
  if (!confirm(confirmMsg)) return;

  try {
    await deleteDoc(doc(db, 'subjects', subjectId));
    if (localStorage.getItem('edugame_last_subject_id') === subjectId) {
      localStorage.removeItem('edugame_last_subject_id');
    }
    await loadSubjects();
  } catch (err) {
    console.error(err);
    setupError.textContent = 'Gagal menghapus mapel. Coba lagi.';
  }
});

function updateQuestionCount() {
  const subject = subjectsCache.find(s => s.id === selectSubject.value);
  const questions = subject && Array.isArray(subject.questions) ? subject.questions : [];
  questionCountLabel.textContent = questions.length;
  renderQuestionList(subject ? subject.id : null, questions);
}

function renderQuestionList(subjectId, questions) {
  questionList.innerHTML = '';

  if (questions.length === 0) {
    questionList.innerHTML = '<p class="question-list-empty">Belum ada soal untuk mapel ini.</p>';
    return;
  }

  questions.forEach((q, idx) => {
    const item = document.createElement('div');
    item.className = 'question-list-item';
    item.innerHTML = `
      <span class="q-num">${idx + 1}.</span>
      <span class="q-text">${escapeHtml(q.question)}</span>
      <button type="button" class="btn-delete-q" title="Hapus soal ini">🗑️</button>
    `;
    item.querySelector('.btn-delete-q').addEventListener('click', () => deleteQuestion(subjectId, q));
    questionList.appendChild(item);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function deleteQuestion(subjectId, questionObj) {
  if (!confirm('Hapus soal ini?')) return;
  try {
    await updateDoc(doc(db, 'subjects', subjectId), {
      questions: arrayRemove(questionObj)
    });
    await loadSubjects();
    selectSubject.value = subjectId;
    updateQuestionCount();
  } catch (err) {
    console.error(err);
    setupError.textContent = 'Gagal menghapus soal. Coba lagi.';
  }
}

selectSubject.addEventListener('change', updateQuestionCount);

btnToggleAddQuestion.addEventListener('click', () => {
  formAddQuestion.classList.toggle('hidden');
});

// ==========================================
// GENERATE SOAL AI (Gemini) — migrasi dari versi statis
// ==========================================
const btnToggleAiGenerate = document.getElementById('btn-toggle-ai-generate');
const aiGeneratePanel = document.getElementById('ai-generate-panel');
const inputApiKey = document.getElementById('input-api-key');
const inputFileMaterial = document.getElementById('input-file-material');
const inputMaterialText = document.getElementById('input-material-text');
const inputAiCount = document.getElementById('input-ai-count');
const btnGenerateAi = document.getElementById('btn-generate-ai');
const btnGenerateAiLabel = document.getElementById('btn-generate-ai-label');
const aiStatus = document.getElementById('ai-status');

// API key disimpan di localStorage browser guru, sama seperti versi lama
inputApiKey.value = localStorage.getItem('edugame_gemini_api_key') || '';
inputApiKey.addEventListener('change', () => {
  localStorage.setItem('edugame_gemini_api_key', inputApiKey.value.trim());
});

btnToggleAiGenerate.addEventListener('click', () => {
  aiGeneratePanel.classList.toggle('hidden');
});

function showAiStatus(message, type) {
  aiStatus.textContent = message;
  aiStatus.style.color = type === 'success' ? '#15803d' : '#dc2626';
}

// --- Baca isi file (PDF, DOCX, XLSX, TXT) ---
async function extractTextFromFile(file) {
  const fileName = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  if (fileName.endsWith('.pdf')) {
    if (!window.pdfjsLib) throw new Error('Library PDF.js belum siap.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    return text;
  }

  if (fileName.endsWith('.docx')) {
    if (!window.mammoth) throw new Error('Library Mammoth.js belum siap.');
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    if (!window.XLSX) throw new Error('Library SheetJS belum siap.');
    const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
    let text = '';
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      text += window.XLSX.utils.sheet_to_csv(worksheet) + '\n';
    });
    return text;
  }

  const textDecoder = new TextDecoder('utf-8');
  return textDecoder.decode(arrayBuffer);
}

// --- Generate soal via Gemini ---
btnGenerateAi.addEventListener('click', async () => {
  const apiKey = inputApiKey.value.trim();
  const manualText = inputMaterialText.value.trim();
  const qCount = parseInt(inputAiCount.value, 10) || 5;
  const subjectId = selectSubject.value;

  showAiStatus('', null);

  if (!subjectId) {
    showAiStatus('Pilih mata pelajaran dulu.', 'error');
    return;
  }
  if (!apiKey) {
    showAiStatus('Masukkan Gemini API Key dulu.', 'error');
    inputApiKey.focus();
    return;
  }

  btnGenerateAi.disabled = true;
  btnGenerateAiLabel.textContent = 'Memproses materi...';

  let fullMaterialText = manualText;
  const file = inputFileMaterial.files[0];

  if (file) {
    try {
      showAiStatus(`Membaca dokumen ${file.name}...`, null);
      const docText = await extractTextFromFile(file);
      fullMaterialText = `DOKUMEN TERUNGGAH (${file.name}):\n${docText}\n\n${manualText}`;
    } catch (err) {
      btnGenerateAi.disabled = false;
      btnGenerateAiLabel.textContent = '✨ Generate Soal AI';
      showAiStatus(`Gagal membaca file: ${err.message}`, 'error');
      return;
    }
  }

  if (!fullMaterialText || fullMaterialText.trim().length < 15) {
    btnGenerateAi.disabled = false;
    btnGenerateAiLabel.textContent = '✨ Generate Soal AI';
    showAiStatus('Unggah dokumen atau tulis teks materi dulu.', 'error');
    return;
  }

  showAiStatus(`Mengirim ke Gemini (menyusun ${qCount} soal pilgan)...`, null);
  btnGenerateAiLabel.textContent = 'Generate sedang berjalan...';

  const promptText = `
Anda adalah seorang instruktur ahli yang menyusun soal ujian berkualitas tinggi.
Berdasarkan materi berikut (apapun topik/bidang studinya), buatlah ${qCount} soal pilihan ganda yang relevan dengan isi materi tersebut.

TEKS MATERI:
"""
${fullMaterialText.substring(0, 15000)}
"""

PETUNJUK FORMAT OUTPUT WAJIB:
- Kembalikan HANYA JSON array murni tanpa pembungkus markdown seperti \`\`\`json.
- Format setiap soal:
  { "question": "...", "options": ["Opsi A","Opsi B","Opsi C","Opsi D"], "answer": 0, "explanation": "..." }
- "answer" adalah indeks angka 0, 1, 2, atau 3.
- Buat tepat ${qCount} soal, berkualitas tinggi dan akurat sesuai materi.
  `.trim();

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP Error ${response.status}`);
    }

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) throw new Error('Respon Gemini kosong.');

    let cleanedJson = aiText.trim();
    if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
    }

    const generatedQuestions = JSON.parse(cleanedJson);
    if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
      throw new Error('Format respon AI bukan array soal.');
    }

    const sanitized = generatedQuestions.map((q, idx) => ({
      type: 'pilgan',
      question: q.question || `Soal ${idx + 1}`,
      options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'],
      answer: typeof q.answer === 'number' ? q.answer : 0,
      explanation: q.explanation || ''
    }));

    // Simpan semua soal baru sekaligus ke Firestore
    for (const q of sanitized) {
      await updateDoc(doc(db, 'subjects', subjectId), { questions: arrayUnion(q) });
    }

    await loadSubjects();
    selectSubject.value = subjectId;
    updateQuestionCount();

    showAiStatus(`✅ Berhasil! ${sanitized.length} soal sudah OTOMATIS tersimpan ke Bank Soal. Tidak perlu isi form manual lagi — cek daftar soal di atas.`, 'success');
    inputFileMaterial.value = '';
    questionList.scrollIntoView({ behavior: 'smooth', block: 'center' });

  } catch (err) {
    console.error('Gemini API Error:', err);
    showAiStatus(`Gagal membuat soal: ${err.message}`, 'error');
  } finally {
    btnGenerateAi.disabled = false;
    btnGenerateAiLabel.textContent = '✨ Generate Soal AI';
  }
});

function showSavedToast() {
  const btn = document.getElementById('btn-save-question');
  const original = btn.textContent;
  btn.textContent = '✅ Tersimpan! Lanjut ketik soal berikutnya...';
  setTimeout(() => { btn.textContent = original; }, 1600);
}

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
    await loadSubjects();
    selectSubject.value = subjectId;
    updateQuestionCount();

    setupError.textContent = '';
    document.getElementById('q-text').focus();
    showSavedToast();
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

  const selectedModeInput = document.querySelector('input[name="game-mode"]:checked');
  if (!selectedModeInput) {
    setupError.textContent = 'Pilih dulu mode permainannya (Live Bareng atau Mandiri).';
    return;
  }
  const mode = selectedModeInput.value;
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

    const sessionRef = await addDoc(collection(db, 'game_sessions'), {
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

    sessionStorage.setItem('edugame_active_session_id', sessionRef.id);
    sessionStorage.setItem('edugame_active_code', code);
    sessionStorage.setItem('edugame_active_subject_name', subject.name);
    sessionStorage.setItem('edugame_active_mode', mode);

    viewSetup.classList.add('hidden');
    viewCode.classList.remove('hidden');

    listenToParticipants(sessionRef.id);

  } catch (err) {
    console.error(err);
    setupError.textContent = 'Gagal membuat game. Cek koneksi internet, coba lagi.';
  } finally {
    btnCreateGame.disabled = false;
    btnCreateLabel.textContent = '🎲 Buat Kode Game';
  }
});

// ==========================================
// PANTAU PESERTA REAL-TIME
// ==========================================
const participantsCountBadge = document.getElementById('participants-count');
const participantsListEl = document.getElementById('participants-list');
let unsubscribeParticipants = null;

function listenToParticipants(sessionId) {
  if (unsubscribeParticipants) unsubscribeParticipants(); // hentikan listener sesi sebelumnya (kalau ada)

  const participantsRef = collection(db, 'game_sessions', sessionId, 'participants');
  const q = query(participantsRef, orderBy('score', 'desc'));

  unsubscribeParticipants = onSnapshot(q, (snapshot) => {
    participantsCountBadge.textContent = snapshot.size;
    participantsListEl.innerHTML = '';

    if (snapshot.empty) {
      participantsListEl.innerHTML = '<p class="participants-empty">Menunggu siswa join...</p>';
      return;
    }

    snapshot.forEach((docSnap) => {
      const p = docSnap.data();
      const isFinished = p.status === 'finished';
      const progress = p.totalQuestions ? `${p.currentIndex || 0}/${p.totalQuestions} soal` : '';

      const row = document.createElement('div');
      row.className = 'participant-row';
      row.innerHTML = `
        <span class="p-name">${escapeHtml(p.name || 'Anonim')}</span>
        <span class="p-progress">${progress}</span>
        <span class="p-score">${p.score || 0}</span>
        <span class="p-status-badge ${isFinished ? 'finished' : 'playing'}">${isFinished ? '✅ Selesai' : '⏳ Main'}</span>
      `;
      participantsListEl.appendChild(row);
    });
  });
}

btnCopyCode.addEventListener('click', () => {
  navigator.clipboard.writeText(codeDisplay.textContent).then(() => {
    btnCopyCode.textContent = '✅ Tersalin!';
    setTimeout(() => { btnCopyCode.textContent = '📋 Salin Kode'; }, 1500);
  });
});

btnBackToSetup.addEventListener('click', () => {
  if (unsubscribeParticipants) {
    unsubscribeParticipants();
    unsubscribeParticipants = null;
  }
  sessionStorage.removeItem('edugame_active_session_id');
  sessionStorage.removeItem('edugame_active_code');
  sessionStorage.removeItem('edugame_active_subject_name');
  sessionStorage.removeItem('edugame_active_mode');
  viewCode.classList.add('hidden');
  viewSetup.classList.remove('hidden');
});