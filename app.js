/**
 * TPTUP EduGame - Core Application Logic
 * Single Page Application for SMK TPTUP (Teknik Pemanasan, Tata Udara, dan Pendinginan)
 * Powered by Google Gemini 3.5 Flash & Multimodal Document Extractor
 */

(function () {
  'use strict';

  // Set worker for PDF.js CDN
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // ==========================================
  // 1. QUESTION BANK (dimulai kosong — isi via Generate AI atau Tambah Soal Manual)
  // ==========================================
  // ==========================================
  // 2. AUDIO SYNTHESIZER
  // ==========================================
  class SoundEngine {
    constructor() {
      this.enabled = true;
      this.audioCtx = null;
    }

    initCtx() {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.audioCtx = new AudioContext();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    }

    playPop() {
      if (!this.enabled) return;
      this.initCtx();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.08);
    }

    playCorrect() {
      if (!this.enabled) return;
      this.initCtx();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];

      notes.forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0.2, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.25);
      });
    }

    playWrong() {
      if (!this.enabled) return;
      this.initCtx();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.3);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    }

    playVictory() {
      if (!this.enabled) return;
      this.initCtx();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const melody = [
        { note: 523.25, dur: 0.15 },
        { note: 659.25, dur: 0.15 },
        { note: 783.99, dur: 0.15 },
        { note: 1046.50, dur: 0.4 }
      ];

      let delay = 0;
      melody.forEach(item => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.value = item.note;

        gain.gain.setValueAtTime(0.3, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + item.dur);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + item.dur);

        delay += item.dur;
      });
    }
  }

  const sound = new SoundEngine();

  // ==========================================
  // 3. APPLICATION STATE
  // ==========================================
  const state = {
    questions: [],
    currentQuestionIndex: 0,
    score: 0,
    combo: 0,
    userAnswers: [],
    answeredCurrent: false,
    apiKey: localStorage.getItem('tptup_gemini_api_key') || '',
    isAdminAuthenticated: false,
    uploadedFile: null,
    extractedDocumentText: '',
    quizStartTime: 0,
    lastElapsedMs: 0,
    lastMainView: 'quiz'
  };

  // ==========================================
  // 4. DOM ELEMENTS REFERENCE
  // ==========================================
  const DOM = {
    // Views
    quizView: document.getElementById('quiz-view'),
    resultView: document.getElementById('result-view'),
    adminView: document.getElementById('admin-view'),
    leaderboardView: document.getElementById('leaderboard-view'),

    // Header & Stats
    headerScore: document.getElementById('header-score'),
    headerCombo: document.getElementById('header-combo'),
    comboContainer: document.getElementById('combo-container'),
    btnSoundToggle: document.getElementById('btn-sound-toggle'),
    soundIcon: document.getElementById('sound-icon'),
    btnAdminGear: document.getElementById('btn-admin-gear'),
    btnLeaderboard: document.getElementById('btn-leaderboard'),

    // Quiz Elements
    questionBadge: document.getElementById('question-badge'),
    qTypeBadge: document.getElementById('q-type-badge'),
    topicBadge: document.getElementById('topic-badge'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    questionText: document.getElementById('question-text'),
    optionsGrid: document.getElementById('options-grid'),
    essayContainer: document.getElementById('essay-container'),
    essayInput: document.getElementById('essay-input'),
    btnSubmitEssay: document.getElementById('btn-submit-essay'),
    explanationBox: document.getElementById('explanation-box'),
    explanationText: document.getElementById('explanation-text'),
    btnNextQuestion: document.getElementById('btn-next-question'),

    // Result Elements
    finalScore: document.getElementById('final-score'),
    finalAccuracy: document.getElementById('final-accuracy'),
    finalCount: document.getElementById('final-count'),
    finalRank: document.getElementById('final-rank'),
    finalTime: document.getElementById('final-time'),
    inputPlayerName: document.getElementById('input-player-name'),
    btnSaveLeaderboard: document.getElementById('btn-save-leaderboard'),
    leaderboardSaveStatus: document.getElementById('leaderboard-save-status'),
    btnViewLeaderboardFromResult: document.getElementById('btn-view-leaderboard-from-result'),
    resultTitle: document.getElementById('result-title'),
    resultSubtitle: document.getElementById('result-subtitle'),
    resultIcon: document.getElementById('result-icon'),
    btnRestartQuiz: document.getElementById('btn-restart-quiz'),

    // Leaderboard Elements
    leaderboardList: document.getElementById('leaderboard-list'),
    btnBackFromLeaderboard: document.getElementById('btn-back-from-leaderboard'),
    btnClearLeaderboard: document.getElementById('btn-clear-leaderboard'),
    btnReviewAnswers: document.getElementById('btn-review-answers'),
    reviewPanel: document.getElementById('review-panel'),
    reviewList: document.getElementById('review-list'),
    confettiCanvas: document.getElementById('confetti-canvas'),

    // Admin Elements
    btnBackToGame: document.getElementById('btn-back-to-game'),
    inputApiKey: document.getElementById('input-api-key'),
    btnToggleKeyVisibility: document.getElementById('btn-toggle-key-visibility'),
    btnSaveApiKey: document.getElementById('btn-save-api-key'),
    apiKeyStatus: document.getElementById('api-key-status'),
    
    // Configs
    inputQCount: document.getElementById('input-q-count'),
    inputFileMaterial: document.getElementById('input-file-material'),
    btnTriggerFileUpload: document.getElementById('btn-trigger-file-upload'),
    fileInfoBadge: document.getElementById('file-info-badge'),
    fileNameText: document.getElementById('file-name-text'),
    fileSizeText: document.getElementById('file-size-text'),
    btnRemoveFile: document.getElementById('btn-remove-file'),
    inputMaterialText: document.getElementById('input-material-text'),
    
    btnGenerateAi: document.getElementById('btn-generate-ai'),
    generateBtnText: document.getElementById('generate-btn-text'),
    generateBtnSpinner: document.getElementById('generate-btn-spinner'),
    aiStatusMsg: document.getElementById('ai-status-msg'),
    qCountSingleWrap: document.getElementById('q-count-single-wrap'),
    qCountMixedWrap: document.getElementById('q-count-mixed-wrap'),
    inputQCountPilgan: document.getElementById('input-q-count-pilgan'),
    inputQCountEssay: document.getElementById('input-q-count-essay'),
    btnAddManualQ: document.getElementById('btn-add-manual-q'),
    btnExportQuestions: document.getElementById('btn-export-questions'),
    btnImportQuestions: document.getElementById('btn-import-questions'),
    inputImportQuestions: document.getElementById('input-import-questions'),
    activeQuestionsCount: document.getElementById('active-questions-count'),
    adminQuestionsList: document.getElementById('admin-questions-list'),


    // Modals
    modalPassword: document.getElementById('modal-password'),
    formPassword: document.getElementById('form-password'),
    inputAdminPass: document.getElementById('input-admin-pass'),
    passErrorMsg: document.getElementById('pass-error-msg'),
    btnCancelPass: document.getElementById('btn-cancel-pass'),

    modalGenericNotice: document.getElementById('modal-generic-notice'),
    genericNoticeIcon: document.getElementById('generic-notice-icon'),
    genericNoticeTitle: document.getElementById('generic-notice-title'),
    genericNoticeMessage: document.getElementById('generic-notice-message'),
    btnGenericNoticeOk: document.getElementById('btn-generic-notice-ok'),
    btnGenericNoticeCancel: document.getElementById('btn-generic-notice-cancel'),

    modalAddQuestion: document.getElementById('modal-add-question'),
    formManualQuestion: document.getElementById('form-manual-question'),
    qManualType: document.getElementById('q-manual-type'),
    manualPilganGroup: document.getElementById('manual-pilgan-group'),
    manualEssayGroup: document.getElementById('manual-essay-group'),
    qEssayAnswer: document.getElementById('q-essay-answer'),
    btnCloseQModal: document.getElementById('btn-close-q-modal'),
    btnCancelAddQ: document.getElementById('btn-cancel-add-q')
  };

  // ==========================================
  // 5. FILE PARSER ENGINE (PDF, DOCX, XLSX, TXT)
  // ==========================================
  async function extractTextFromFile(file) {
    const fileName = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();

    // PDF Extraction
    if (fileName.endsWith('.pdf')) {
      if (!window.pdfjsLib) throw new Error('Library PDF.js belum siap.');
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
      }
      return text;
    }

    // DOCX Extraction (Mammoth.js)
    if (fileName.endsWith('.docx')) {
      if (!window.mammoth) throw new Error('Library Mammoth.js belum siap.');
      const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      return result.value;
    }

    // XLSX / Spreadsheet Extraction (SheetJS)
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      if (!window.XLSX) throw new Error('Library SheetJS belum siap.');
      const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
      let text = '';
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        text += window.XLSX.utils.sheet_to_csv(worksheet) + '\n';
      });
      return text;
    }

    // Plain Text / CSV / Markdown
    const textDecoder = new TextDecoder('utf-8');
    return textDecoder.decode(arrayBuffer);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    state.uploadedFile = file;
    DOM.fileNameText.textContent = file.name;

    const sizeInKB = Math.round(file.size / 1024);
    const sizeText = sizeInKB > 1024 ? `${(sizeInKB / 1024).toFixed(2)} MB` : `${sizeInKB} KB`;
    DOM.fileSizeText.textContent = `(${sizeText})`;

    DOM.fileInfoBadge.classList.remove('hidden');
    sound.playPop();
  }

  function removeSelectedFile() {
    state.uploadedFile = null;
    state.extractedDocumentText = '';
    DOM.inputFileMaterial.value = '';
    DOM.fileInfoBadge.classList.add('hidden');
    sound.playPop();
  }

  // ==========================================
  // 5B. CUSTOM NOTICE / CONFIRM MODAL (pengganti alert() & confirm())
  // ==========================================
  let noticeResolver = null;
  let noticeBackdropValue = false;

  function closeGenericNotice(result) {
    DOM.modalGenericNotice.classList.add('hidden');
    if (noticeResolver) {
      const resolve = noticeResolver;
      noticeResolver = null;
      resolve(result);
    }
  }

  function showNotice(message, options = {}) {
    const { title = 'Pemberitahuan', icon = 'ℹ️', type = 'info' } = options;
    sound.playPop();

    DOM.genericNoticeIcon.textContent = icon;
    DOM.genericNoticeTitle.textContent = title;
    DOM.genericNoticeMessage.textContent = message;
    DOM.btnGenericNoticeCancel.classList.add('hidden');
    DOM.btnGenericNoticeOk.textContent = 'OK';
    DOM.btnGenericNoticeOk.className = `btn ${type === 'error' ? 'btn-primary' : 'btn-primary'}`;
    noticeBackdropValue = true;

    DOM.modalGenericNotice.classList.remove('hidden');
    if (type === 'error') sound.playWrong();

    return new Promise((resolve) => {
      noticeResolver = resolve;
    });
  }

  function showConfirm(message, options = {}) {
    const { title = 'Konfirmasi', icon = '❓', okLabel = 'OK', cancelLabel = 'Batal', backdropResolvesTo = false } = options;
    sound.playPop();

    DOM.genericNoticeIcon.textContent = icon;
    DOM.genericNoticeTitle.textContent = title;
    DOM.genericNoticeMessage.textContent = message;
    DOM.btnGenericNoticeCancel.classList.remove('hidden');
    DOM.btnGenericNoticeOk.textContent = okLabel;
    DOM.btnGenericNoticeCancel.textContent = cancelLabel;
    noticeBackdropValue = backdropResolvesTo;

    DOM.modalGenericNotice.classList.remove('hidden');

    return new Promise((resolve) => {
      noticeResolver = resolve;
    });
  }

  // ==========================================
  // 6. NAVIGATION & SECURITY MODULE
  // ==========================================
  function showView(viewElement) {
    DOM.quizView.classList.add('hidden');
    DOM.resultView.classList.add('hidden');
    DOM.adminView.classList.add('hidden');
    DOM.leaderboardView.classList.add('hidden');

    viewElement.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function promptAdminAuth() {
    sound.playPop();
    DOM.inputAdminPass.value = '';
    DOM.passErrorMsg.classList.add('hidden');
    DOM.modalPassword.classList.remove('hidden');
    setTimeout(() => DOM.inputAdminPass.focus(), 100);
  }

  function handleAdminPassSubmit(e) {
    if (e) e.preventDefault();
    const pass = DOM.inputAdminPass.value.trim();

    if (pass === 'TPTUP10') {
      state.isAdminAuthenticated = true;
      DOM.modalPassword.classList.add('hidden');
      renderAdminView();
      showView(DOM.adminView);
    } else {
      sound.playWrong();
      DOM.passErrorMsg.classList.remove('hidden');
      DOM.modalPassword.classList.add('hidden');
      showNotice('Password tidak sesuai. Silakan coba lagi.', { title: 'Akses Ditolak', icon: '🔒', type: 'error' });
    }
  }

  function closeAdminView() {
    sound.playPop();
    state.isAdminAuthenticated = false;
    startQuiz(); // Reload kuis dari state.questions terbaru (termasuk soal manual/AI yang baru ditambahkan)
  }

  // ==========================================
  // 7. QUIZ LOGIC & RENDERING (PILGAN & ESSAY)
  // ==========================================
  function startQuiz() {
    state.currentQuestionIndex = 0;
    state.score = 0;
    state.combo = 0;
    state.userAnswers = [];
    state.answeredCurrent = false;
    state.quizStartTime = Date.now();
    state.lastMainView = 'quiz';

    updateHeaderStats();
    renderCurrentQuestion();
    showView(DOM.quizView);
  }

  function updateHeaderStats() {
    DOM.headerScore.textContent = state.score;
    DOM.headerCombo.textContent = `x${state.combo}`;

    if (state.combo > 1) {
      DOM.comboContainer.style.display = 'flex';
    } else {
      DOM.comboContainer.style.display = 'none';
    }
  }

  function renderCurrentQuestion() {
    const totalQ = state.questions.length;

    if (totalQ === 0) {
      showEmptyState();
      return;
    }

    const currentQ = state.questions[state.currentQuestionIndex];

    if (!currentQ) {
      showResults();
      return;
    }

    state.answeredCurrent = false;

    // Badges & Progress
    DOM.questionBadge.textContent = `Soal ${state.currentQuestionIndex + 1} dari ${totalQ}`;
    
    const isEssay = (currentQ.type === 'essay' || !currentQ.options);
    DOM.qTypeBadge.textContent = isEssay ? '📝 Essay / Isian' : '📌 Pilihan Ganda';
    DOM.topicBadge.textContent = currentQ.topic || '⚙️ TPTUP';

    const progressPercent = Math.round(((state.currentQuestionIndex + 1) / totalQ) * 100);
    DOM.progressBarFill.style.width = `${progressPercent}%`;

    // Question Text
    DOM.questionText.textContent = currentQ.question;

    // Reset Elements
    DOM.explanationBox.classList.add('hidden');
    DOM.btnNextQuestion.classList.add('hidden');

    if (isEssay) {
      // Show Essay View
      DOM.optionsGrid.classList.add('hidden');
      DOM.essayContainer.classList.remove('hidden');
      DOM.essayInput.value = '';
      DOM.essayInput.disabled = false;
      DOM.btnSubmitEssay.disabled = false;
    } else {
      // Show Pilgan Options Grid
      DOM.essayContainer.classList.add('hidden');
      DOM.optionsGrid.classList.remove('hidden');
      DOM.optionsGrid.innerHTML = '';

      const optionLetters = ['A', 'B', 'C', 'D'];
      currentQ.options.forEach((optText, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.setAttribute('data-index', idx);

        const letterBadge = document.createElement('span');
        letterBadge.className = 'option-letter';
        letterBadge.textContent = optionLetters[idx];

        const labelSpan = document.createElement('span');
        labelSpan.className = 'option-label';
        labelSpan.textContent = optText;

        btn.appendChild(letterBadge);
        btn.appendChild(labelSpan);

        btn.addEventListener('click', () => handleOptionClick(idx));
        DOM.optionsGrid.appendChild(btn);
      });
    }
  }

  function showEmptyState() {
    DOM.questionBadge.textContent = 'Belum ada soal';
    DOM.qTypeBadge.textContent = '📭 Bank Soal Kosong';
    DOM.topicBadge.textContent = '';
    DOM.progressBarFill.style.width = '0%';

    DOM.questionText.textContent = 'Belum ada soal di Bank Soal. Silakan buka Panel Admin untuk generate soal AI atau tambah soal manual terlebih dahulu.';

    DOM.optionsGrid.classList.add('hidden');
    DOM.optionsGrid.innerHTML = '';
    DOM.essayContainer.classList.add('hidden');
    DOM.explanationBox.classList.add('hidden');
    DOM.btnNextQuestion.classList.add('hidden');
  }

  // ==========================================
  // 6B. ESSAY AUTO-GRADING (Keyword Matching)
  // ==========================================
  const STOPWORDS_ID = new Set([
    'yang','dan','di','ke','dari','untuk','pada','dengan','adalah','ini','itu','atau',
    'dapat','akan','dalam','sebagai','karena','juga','oleh','tersebut','secara','yaitu',
    'tidak','bisa','telah','harus','tetapi','namun','agar','sehingga','seperti','bagi',
    'para','suatu','yakni','maupun','serta','hingga','sampai','tanpa','antara','terhadap',
    'sesuai','berdasarkan','melalui','sebuah','beberapa','semua','setiap','masing','merupakan',
    'berupa','jelaskan','sebutkan','apa','bagaimana','mengapa','contoh','yaitu','saja',
    'lain','lainnya','disebut','sebutkanlah','jelaskanlah','kamu','anda','kita','mereka'
  ]);

  function normalizeEssayText(str) {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractEssayKeywords(referenceText) {
    const normalized = normalizeEssayText(referenceText);
    if (!normalized) return [];
    const seen = new Set();
    const keywords = [];
    normalized.split(' ').forEach((w) => {
      if (w.length < 4) return;
      if (STOPWORDS_ID.has(w)) return;
      if (/^\d+$/.test(w)) return;
      if (seen.has(w)) return;
      seen.add(w);
      keywords.push(w);
    });
    return keywords.slice(0, 25);
  }

  function fuzzyKeywordMatch(userTokens, joinedUserText, keyword) {
    // Exact match dulu (paling akurat, termasuk untuk kata majemuk/frasa)
    if (joinedUserText.includes(keyword)) return true;

    // Fuzzy prefix match: toleran terhadap imbuhan Bahasa Indonesia
    // (mis. "kompetensi" vs "kompeten", "mendirikan" vs "mendiri")
    const prefixLen = Math.min(6, keyword.length);
    if (prefixLen < 4) return false;
    const kwPrefix = keyword.slice(0, prefixLen);
    return userTokens.some(tok => tok.length >= 4 && tok.slice(0, prefixLen) === kwPrefix);
  }

  function gradeEssayAnswer(userText, referenceText) {
    const normalizedUser = normalizeEssayText(userText);
    const meaningfulChars = normalizedUser.replace(/[^a-z0-9]/g, '').length;
    const keywords = extractEssayKeywords(referenceText);

    // Jawaban terlalu pendek/kosong-makna (contoh: "-", ".", "asdf") langsung dianggap salah
    if (meaningfulChars < 3 || keywords.length === 0) {
      return { isCorrect: false, matchedKeywords: [], totalKeywords: keywords.length };
    }

    const userTokens = normalizedUser.split(' ').filter(Boolean);
    const matchedKeywords = keywords.filter(kw => fuzzyKeywordMatch(userTokens, normalizedUser, kw));
    const minMatches = Math.max(1, Math.ceil(keywords.length * 0.15));
    const isCorrect = matchedKeywords.length >= minMatches;

    return { isCorrect, matchedKeywords, totalKeywords: keywords.length };
  }

  function handleOptionClick(selectedIndex) {
    if (state.answeredCurrent) return;
    state.answeredCurrent = true;

    const currentQ = state.questions[state.currentQuestionIndex];
    const isCorrect = (selectedIndex === currentQ.answer);
    const optionBtns = DOM.optionsGrid.querySelectorAll('.option-btn');

    optionBtns.forEach(btn => btn.disabled = true);

    if (isCorrect) {
      sound.playCorrect();
      optionBtns[selectedIndex].classList.add('correct');
      state.combo += 1;
      state.score += 100 * state.combo;
    } else {
      sound.playWrong();
      optionBtns[selectedIndex].classList.add('wrong');
      if (optionBtns[currentQ.answer]) {
        optionBtns[currentQ.answer].classList.add('correct');
      }
      state.combo = 0;
    }

    updateHeaderStats();

    state.userAnswers.push({
      questionIndex: state.currentQuestionIndex,
      type: 'pilgan',
      selected: selectedIndex,
      correct: currentQ.answer,
      isCorrect: isCorrect
    });

    DOM.explanationText.innerHTML = `<strong>Kunci:</strong> Opsi ${['A','B','C','D'][currentQ.answer]}<br>${currentQ.explanation || ''}`;
    DOM.explanationBox.classList.remove('hidden');

    revealNextButton();
  }

  function handleEssaySubmit() {
    if (state.answeredCurrent) return;
    const userText = DOM.essayInput.value.trim();

    if (!userText) {
      showNotice('Silakan tuliskan jawaban essay Kamu terlebih dahulu!', { title: 'Jawaban Kosong', icon: '✍️', type: 'error' })
        .then(() => DOM.essayInput.focus());
      return;
    }

    state.answeredCurrent = true;
    DOM.essayInput.disabled = true;
    DOM.btnSubmitEssay.disabled = true;

    const currentQ = state.questions[state.currentQuestionIndex];
    const refAnswer = currentQ.answerKey || currentQ.explanation || 'Kunci jawaban telah tercantum.';

    const grading = gradeEssayAnswer(userText, refAnswer);

    if (grading.isCorrect) {
      sound.playCorrect();
      state.combo += 1;
      state.score += 100 * state.combo;
    } else {
      sound.playWrong();
      state.combo = 0;
    }
    updateHeaderStats();

    state.userAnswers.push({
      questionIndex: state.currentQuestionIndex,
      type: 'essay',
      userText: userText,
      refAnswer: refAnswer,
      isCorrect: grading.isCorrect
    });

    const badgeHtml = grading.isCorrect
      ? `<span style="color:#15803d; font-weight:800;">✅ Jawaban Dinilai BENAR</span>`
      : `<span style="color:#b91c1c; font-weight:800;">❌ Jawaban Dinilai KURANG TEPAT</span>`;

    DOM.explanationText.innerHTML = `${badgeHtml}<br><br><strong>Jawaban Kamu:</strong> ${userText}<br><br><strong>🔑 Kunci Jawaban Referensi:</strong> ${refAnswer}`;
    DOM.explanationBox.classList.remove('hidden');

    revealNextButton();
  }

  function revealNextButton() {
    const isLastQ = (state.currentQuestionIndex === state.questions.length - 1);
    DOM.btnNextQuestion.querySelector('span:first-child').textContent = isLastQ ? 'Lihat Hasil Kuis 🏆' : 'Soal Selanjutnya';
    DOM.btnNextQuestion.classList.remove('hidden');
  }

  function handleNextQuestion() {
    sound.playPop();
    if (state.currentQuestionIndex < state.questions.length - 1) {
      state.currentQuestionIndex += 1;
      renderCurrentQuestion();
    } else {
      showResults();
    }
  }

  // ==========================================
  // 8. RESULT VIEW & CONFETTI ENGINE
  // ==========================================
  function showResults() {
    sound.playVictory();
    state.lastMainView = 'result';
    showView(DOM.resultView);

    state.lastElapsedMs = state.quizStartTime ? (Date.now() - state.quizStartTime) : 0;
    DOM.finalTime.textContent = formatDuration(state.lastElapsedMs);

    const totalQ = state.questions.length;
    const correctCount = state.userAnswers.filter(a => a.isCorrect).length;
    const accuracyPercent = Math.round((correctCount / totalQ) * 100);

    DOM.finalScore.textContent = state.score;
    DOM.finalAccuracy.textContent = `${accuracyPercent}%`;
    DOM.finalCount.textContent = `${correctCount} / ${totalQ}`;

    let rankTitle = "Teknisi Pemula";
    let icon = "🔧";
    if (accuracyPercent === 100) {
      rankTitle = "Ahli Pendingin Utama ⭐⭐⭐";
      icon = "🏆";
    } else if (accuracyPercent >= 80) {
      rankTitle = "Teknisi Terampil ⭐⭐";
      icon = "🥇";
    } else if (accuracyPercent >= 60) {
      rankTitle = "Teknisi Muda ⭐";
      icon = "🥈";
    }

    DOM.finalRank.textContent = rankTitle;
    DOM.resultIcon.textContent = icon;

    DOM.reviewPanel.classList.add('hidden');
    DOM.inputPlayerName.value = '';
    DOM.leaderboardSaveStatus.classList.add('hidden');
    DOM.btnSaveLeaderboard.disabled = false;
    triggerConfetti();
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function triggerConfetti() {
    const canvas = DOM.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

    const particles = [];
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vy: Math.random() * 3 + 2,
        vx: Math.random() * 2 - 1,
        rotation: Math.random() * 360,
        rSpeed: Math.random() * 6 - 3
      });
    }

    let animId;
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let activeCount = 0;

      particles.forEach(p => {
        p.y += p.vy;
        p.x += p.vx;
        p.rotation += p.rSpeed;

        if (p.y < canvas.height) activeCount++;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      if (activeCount > 0) animId = requestAnimationFrame(render);
      else cancelAnimationFrame(animId);
    }

    render();
  }

  function renderReviewPanel() {
    DOM.reviewList.innerHTML = '';
    DOM.reviewPanel.classList.toggle('hidden');

    if (DOM.reviewPanel.classList.contains('hidden')) return;

    state.userAnswers.forEach((ans, idx) => {
      const q = state.questions[ans.questionIndex];
      const item = document.createElement('div');
      item.className = `review-item ${ans.isCorrect ? 'is-correct' : 'is-wrong'}`;

      if (ans.type === 'essay') {
        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>Soal ${idx + 1}: ${q.topic} (Essay)</strong>
            <span class="badge ${ans.isCorrect ? 'badge-primary' : 'badge-topic'}">${ans.isCorrect ? 'BENAR' : 'KURANG TEPAT'}</span>
          </div>
          <p style="font-weight:600; margin-top:4px;">${q.question}</p>
          <p style="font-size:0.875rem; color:#475569;">Jawaban Kamu: <strong>${ans.userText}</strong></p>
          <p style="font-size:0.825rem; color:#166534; background:#f0fdf4; padding:6px 10px; border-radius:6px; margin-top:4px;">
            🔑 <strong>Kunci Referensi:</strong> ${ans.refAnswer}
          </p>
        `;
      } else {
        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>Soal ${idx + 1}: ${q.topic} (Pilgan)</strong>
            <span class="badge ${ans.isCorrect ? 'badge-primary' : 'badge-topic'}">${ans.isCorrect ? 'BENAR' : 'SALAH'}</span>
          </div>
          <p style="font-weight:600; margin-top:4px;">${q.question}</p>
          <p style="font-size:0.875rem; color:#475569;">
            Jawaban Kamu: <strong>${q.options[ans.selected]}</strong><br>
            Jawaban Benar: <strong>${q.options[ans.correct]}</strong>
          </p>
          <p style="font-size:0.825rem; color:#166534; background:#f0fdf4; padding:6px 10px; border-radius:6px; margin-top:4px;">
            💡 ${q.explanation}
          </p>
        `;
      }

      DOM.reviewList.appendChild(item);
    });
  }

  // ==========================================
  // 8B. LEADERBOARD MODULE
  // ==========================================
  const LEADERBOARD_STORAGE_KEY = 'tptup_leaderboard';

  function getLeaderboardEntries() {
    try {
      const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function saveLeaderboardEntries(entries) {
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(entries));
  }

  function handleSaveLeaderboard() {
    const name = DOM.inputPlayerName.value.trim();
    if (!name) {
      DOM.leaderboardSaveStatus.textContent = 'Isi nama kamu dulu ya sebelum simpan skor!';
      DOM.leaderboardSaveStatus.className = 'status-msg error';
      DOM.leaderboardSaveStatus.classList.remove('hidden');
      DOM.inputPlayerName.focus();
      return;
    }

    const totalQ = state.questions.length;
    const correctCount = state.userAnswers.filter(a => a.isCorrect).length;
    const accuracyPercent = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;

    const entries = getLeaderboardEntries();
    entries.push({
      name: name.substring(0, 30),
      score: state.score,
      accuracy: accuracyPercent,
      elapsedMs: state.lastElapsedMs,
      totalQ: totalQ,
      date: Date.now()
    });

    saveLeaderboardEntries(entries);
    sound.playCorrect();

    DOM.leaderboardSaveStatus.textContent = '✅ Skor berhasil disimpan ke Leaderboard!';
    DOM.leaderboardSaveStatus.className = 'status-msg success';
    DOM.leaderboardSaveStatus.classList.remove('hidden');
    DOM.btnSaveLeaderboard.disabled = true;
  }

  function renderLeaderboard() {
    const entries = getLeaderboardEntries();

    // Ranking: skor tertinggi dulu, kalau skor sama, waktu tercepat menang
    entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.elapsedMs || 0) - (b.elapsedMs || 0);
    });

    DOM.leaderboardList.innerHTML = '';

    if (entries.length === 0) {
      DOM.leaderboardList.innerHTML = '<p class="leaderboard-empty">Belum ada skor yang tersimpan. Selesaikan kuis dan simpan skor kamu untuk muncul di sini!</p>';
      return;
    }

    const medalIcons = ['🥇', '🥈', '🥉'];

    entries.slice(0, 50).forEach((entry, idx) => {
      const rank = idx + 1;
      const row = document.createElement('div');
      row.className = `leaderboard-row ${rank <= 3 ? `rank-${rank}` : ''}`;

      const dateLabel = entry.date ? new Date(entry.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

      row.innerHTML = `
        <div class="leaderboard-rank">${medalIcons[idx] || `#${rank}`}</div>
        <div class="leaderboard-info">
          <span class="leaderboard-name">${escapeHtml(entry.name)}</span>
          <span class="leaderboard-meta">${entry.totalQ || 0} soal • ${dateLabel}</span>
        </div>
        <div class="leaderboard-stats">
          <div class="leaderboard-stat-item">
            <span class="leaderboard-stat-value">${entry.score}</span>
            <span class="leaderboard-stat-label">Skor</span>
          </div>
          <div class="leaderboard-stat-item">
            <span class="leaderboard-stat-value">${entry.accuracy}%</span>
            <span class="leaderboard-stat-label">Akurasi</span>
          </div>
          <div class="leaderboard-stat-item">
            <span class="leaderboard-stat-value">${formatDuration(entry.elapsedMs || 0)}</span>
            <span class="leaderboard-stat-label">Waktu</span>
          </div>
        </div>
      `;
      DOM.leaderboardList.appendChild(row);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function handleClearLeaderboard() {
    const confirmed = await showConfirm('Yakin ingin mengosongkan seluruh data Leaderboard? Tindakan ini tidak bisa dibatalkan.', {
      title: 'Kosongkan Leaderboard?',
      icon: '🗑️',
      okLabel: 'Ya, Kosongkan',
      cancelLabel: 'Batal'
    });
    if (confirmed) {
      saveLeaderboardEntries([]);
      renderLeaderboard();
      sound.playPop();
    }
  }

  function openLeaderboardView() {
    sound.playPop();
    renderLeaderboard();
    showView(DOM.leaderboardView);
  }

  function closeLeaderboardView() {
    sound.playPop();
    showView(state.lastMainView === 'result' ? DOM.resultView : DOM.quizView);
  }

  // ==========================================
  // 9. MULTIMODAL GEMINI 3.5 FLASH AI GENERATOR
  // ==========================================
  async function generateQuestionsWithGemini() {
    const apiKey = DOM.inputApiKey.value.trim() || state.apiKey;
    const manualText = DOM.inputMaterialText.value.trim();

    const selectedTypeRadio = document.querySelector('input[name="ai-q-type"]:checked');
    const qType = selectedTypeRadio ? selectedTypeRadio.value : 'pilgan';
    const isMixed = qType === 'campuran';

    const pilganCount = isMixed ? (parseInt(DOM.inputQCountPilgan.value, 10) || 0) : (qType === 'pilgan' ? (parseInt(DOM.inputQCount.value, 10) || 5) : 0);
    const essayCount = isMixed ? (parseInt(DOM.inputQCountEssay.value, 10) || 0) : (qType === 'essay' ? (parseInt(DOM.inputQCount.value, 10) || 5) : 0);
    const qCount = pilganCount + essayCount;

    if (isMixed && qCount === 0) {
      showAiStatus('Isi jumlah soal Pilgan dan/atau Essay terlebih dahulu (minimal salah satu lebih dari 0)!', 'error');
      return;
    }

    if (!apiKey) {
      showAiStatus('Silakan masukkan Gemini API Key terlebih dahulu di atas!', 'error');
      DOM.inputApiKey.focus();
      return;
    }

    sound.playPop();
    setAiLoading(true, 'Mengekstrak file & mengolah dokumen...');

    let fullMaterialText = manualText;

    // Process File if uploaded
    if (state.uploadedFile) {
      try {
        showAiStatus(`Membaca dokumen ${state.uploadedFile.name}...`, 'info');
        const docText = await extractTextFromFile(state.uploadedFile);
        fullMaterialText = `DOKUMEN TERUNGGAH (${state.uploadedFile.name}):\n${docText}\n\n${manualText}`;
      } catch (err) {
        setAiLoading(false);
        showAiStatus(`Gagal membaca file: ${err.message}`, 'error');
        sound.playWrong();
        return;
      }
    }

    if (!fullMaterialText || fullMaterialText.trim().length < 15) {
      setAiLoading(false);
      showAiStatus('Silakan unggah dokumen materi atau tulis teks materi terlebih dahulu!', 'error');
      return;
    }

    const qTypeLabel = isMixed ? `campuran (${pilganCount} Pilgan + ${essayCount} Essay)` : qType.toUpperCase();
    showAiStatus(`Mengirim ke Gemini 3.5 Flash (Menyusun ${qCount} Soal ${qTypeLabel})...`, 'info');

    const formatInstructions = isMixed
      ? `
Buat CAMPURAN dua jenis soal dalam SATU array JSON:
- ${pilganCount} soal berjenis "pilgan" (Pilihan Ganda), format:
  { "topic": "...", "type": "pilgan", "question": "...", "options": ["Opsi A","Opsi B","Opsi C","Opsi D"], "answer": 0, "explanation": "..." }
  ("answer" harus indeks angka 0, 1, 2, atau 3)
- ${essayCount} soal berjenis "essay" (Isian), format:
  { "topic": "...", "type": "essay", "question": "...", "answerKey": "Kunci jawaban referensi lengkap...", "explanation": "..." }
Urutan boleh diacak/diselang-seling antara pilgan dan essay dalam array yang sama. Total harus tepat ${qCount} soal (${pilganCount} pilgan + ${essayCount} essay), jangan kurang atau lebih.`
      : (qType === 'pilgan' ? `
Format untuk Pilihan Ganda (Pilgan):
[
  {
    "topic": "Sistem Refrigerasi",
    "type": "pilgan",
    "question": "Pertanyaan?",
    "options": ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],
    "answer": 0,
    "explanation": "Penjelasan mengapa opsi ini benar."
  }
]
- "answer" harus berupa indeks angka 0, 1, 2, atau 3.
- Buat tepat ${qCount} soal.` : `
Format untuk Essay / Isian:
[
  {
    "topic": "Troubleshooting AC",
    "type": "essay",
    "question": "Pertanyaan essay?",
    "answerKey": "Kunci jawaban referensi yang lengkap dan tepat...",
    "explanation": "Penjelasan tambahan singkat."
  }
]
- Buat tepat ${qCount} soal.`);

    const promptText = `
Anda adalah seorang instruktur ahli yang menyusun soal ujian berkualitas tinggi.
Berdasarkan materi berikut (apapun topik/bidang studinya), buatlah soal ujian yang relevan dengan isi materi tersebut.

TEKS MATERI:
"""
${fullMaterialText.substring(0, 15000)}
"""

PETUNJUK FORMAT OUTPUT WAJIB:
- Kembalikan HANYA JSON array murni tanpa pembungkus markdown seperti \`\`\`json.
${formatInstructions}
- Pastikan soal berkualitas tinggi dan akurat secara teknis/keilmuan sesuai materi.
    `.trim();

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP Error ${response.status}`);
      }

      const data = await response.json();
      const aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!aiResponseText) throw new Error('Respon Gemini AI kosong.');

      let cleanedJson = aiResponseText.trim();
      if (cleanedJson.startsWith('```')) {
        cleanedJson = cleanedJson.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
      }

      const generatedQuestions = JSON.parse(cleanedJson);
      if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
        throw new Error('Format respon AI bukan array soal.');
      }

      const sanitized = generatedQuestions.map((q, idx) => ({
        topic: q.topic || '⚙️ Materi AI',
        type: q.type || (isMixed ? (q.options ? 'pilgan' : 'essay') : qType),
        question: q.question || `Soal ${idx + 1}`,
        options: (q.type === 'pilgan' || q.options) ? (Array.isArray(q.options) && q.options.length === 4 ? q.options : ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D']) : null,
        answer: typeof q.answer === 'number' ? q.answer : 0,
        answerKey: q.answerKey || q.explanation || 'Kunci jawaban referensi.',
        explanation: q.explanation || 'Penjelasan soal.'
      }));

      state.questions = [...state.questions, ...sanitized];
      renderAdminQuestionsList();
      showAiStatus(`Berhasil! ${sanitized.length} Soal ${qTypeLabel} baru ditambahkan ke Bank Soal oleh Gemini 3.5 Flash.`, 'success');
      sound.playCorrect();

    } catch (err) {
      console.error('Gemini API Error:', err);
      showAiStatus(`Gagal membuat soal: ${err.message}`, 'error');
      sound.playWrong();
    } finally {
      setAiLoading(false);
    }
  }

  function setAiLoading(isLoading, customText) {
    if (isLoading) {
      DOM.generateBtnText.textContent = customText || 'Memproses Dokumen & AI...';
      DOM.generateBtnSpinner.classList.remove('hidden');
      DOM.btnGenerateAi.disabled = true;
    } else {
      DOM.generateBtnText.textContent = '✨ Generate Soal AI (Gemini 3.5 Flash)';
      DOM.generateBtnSpinner.classList.add('hidden');
      DOM.btnGenerateAi.disabled = false;
    }
  }

  function showAiStatus(msg, type) {
    DOM.aiStatusMsg.textContent = msg;
    DOM.aiStatusMsg.className = `status-msg ${type}`;
    DOM.aiStatusMsg.classList.remove('hidden');
  }

  // ==========================================
  // 10. ADMIN PANEL MANAGERS
  // ==========================================
  function renderAdminView() {
    DOM.inputApiKey.value = state.apiKey;
    renderAdminQuestionsList();
  }

  function saveApiKey() {
    const key = DOM.inputApiKey.value.trim();
    state.apiKey = key;
    localStorage.setItem('tptup_gemini_api_key', key);

    DOM.apiKeyStatus.textContent = '✅ API Key berhasil disimpan di browser!';
    DOM.apiKeyStatus.className = 'status-msg success';
    DOM.apiKeyStatus.classList.remove('hidden');
    sound.playPop();

    setTimeout(() => DOM.apiKeyStatus.classList.add('hidden'), 3000);
  }

  function renderAdminQuestionsList() {
    DOM.activeQuestionsCount.textContent = state.questions.length;
    DOM.adminQuestionsList.innerHTML = '';

    state.questions.forEach((q, idx) => {
      const card = document.createElement('div');
      card.className = 'q-item-card';

      const isEssay = (q.type === 'essay' || !q.options);

      card.innerHTML = `
        <div class="q-item-info">
          <span class="q-item-title">${idx + 1}. ${q.question}</span>
          <span class="q-item-meta">${q.topic} • ${isEssay ? '📝 Essay' : '📌 Pilgan (Opsi ' + ['A','B','C','D'][q.answer] + ')'}</span>
        </div>
        <div class="q-item-actions">
          <button class="btn btn-icon-only btn-delete-q" data-index="${idx}" title="Hapus Soal">🗑️</button>
        </div>
      `;

      card.querySelector('.btn-delete-q').addEventListener('click', () => {
        state.questions.splice(idx, 1);
        renderAdminQuestionsList();
        sound.playPop();
      });

      DOM.adminQuestionsList.appendChild(card);
    });
  }

  function handleManualQuestionSubmit(e) {
    e.preventDefault();

    const qType = DOM.qManualType.value;
    const topic = document.getElementById('q-topic').value.trim();
    const question = document.getElementById('q-text').value.trim();
    const explanation = document.getElementById('q-explanation').value.trim();

    if (qType === 'essay') {
      const essayKey = DOM.qEssayAnswer.value.trim();
      state.questions.push({
        topic: topic || '⚙️ TPTUP',
        type: 'essay',
        question: question,
        answerKey: essayKey || explanation,
        explanation: explanation || 'Kunci jawaban essay.'
      });
    } else {
      const opt0 = document.getElementById('opt-0').value.trim();
      const opt1 = document.getElementById('opt-1').value.trim();
      const opt2 = document.getElementById('opt-2').value.trim();
      const opt3 = document.getElementById('opt-3').value.trim();

      const correctRadio = DOM.formManualQuestion.querySelector('input[name="correct-opt"]:checked');
      const answerIndex = parseInt(correctRadio.value, 10);

      state.questions.push({
        topic: topic || '⚙️ TPTUP',
        type: 'pilgan',
        question: question,
        options: [opt0, opt1, opt2, opt3],
        answer: answerIndex,
        explanation: explanation || 'Penjelasan kuis.'
      });
    }

    renderAdminQuestionsList();
    DOM.modalAddQuestion.classList.add('hidden');
    DOM.formManualQuestion.reset();
    sound.playCorrect();
  }

  function sanitizeQuestionList(rawList) {
    if (!Array.isArray(rawList)) return null;
    return rawList.map((q, idx) => {
      const isEssay = q.type === 'essay' || !q.options;
      if (isEssay) {
        return {
          topic: q.topic || '⚙️ Materi',
          type: 'essay',
          question: q.question || `Soal ${idx + 1}`,
          answerKey: q.answerKey || q.explanation || 'Kunci jawaban referensi.',
          explanation: q.explanation || ''
        };
      }
      return {
        topic: q.topic || '⚙️ Materi',
        type: 'pilgan',
        question: q.question || `Soal ${idx + 1}`,
        options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'],
        answer: typeof q.answer === 'number' ? q.answer : 0,
        explanation: q.explanation || ''
      };
    });
  }

  function exportQuestionsToJson() {
    if (state.questions.length === 0) {
      showNotice('Bank soal masih kosong, belum ada yang bisa di-export.', { title: 'Bank Soal Kosong', icon: '📭', type: 'error' });
      return;
    }
    sound.playPop();
    const blob = new Blob([JSON.stringify(state.questions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'questions.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleImportQuestionsFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const sanitized = sanitizeQuestionList(parsed);
        if (!sanitized || sanitized.length === 0) throw new Error('Format JSON tidak valid.');

        let appendMode = false;
        if (state.questions.length > 0) {
          appendMode = await showConfirm(
            `Bank soal saat ini sudah berisi ${state.questions.length} soal.\n\nPilih "Tambahkan" untuk MENAMBAHKAN ${sanitized.length} soal dari file ini, atau "Ganti Semua" untuk MENGGANTI seluruh bank soal dengan isi file ini.`,
            { title: 'Mode Import', icon: '📥', okLabel: 'Tambahkan', cancelLabel: 'Ganti Semua', backdropResolvesTo: true }
          );
        }

        state.questions = appendMode ? [...state.questions, ...sanitized] : sanitized;

        renderAdminQuestionsList();
        sound.playCorrect();
        showNotice(`${sanitized.length} soal berhasil diimpor dari ${file.name}.`, { title: 'Import Berhasil', icon: '✅' });
      } catch (err) {
        sound.playWrong();
        showNotice(`Gagal membaca file JSON: ${err.message}`, { title: 'Import Gagal', icon: '⚠️', type: 'error' });
      } finally {
        DOM.inputImportQuestions.value = '';
      }
    };
    reader.readAsText(file);
  }

  async function loadDefaultQuestionsFile() {
    try {
      const res = await fetch('questions.json', { cache: 'no-store' });
      if (!res.ok) return;
      const parsed = await res.json();
      const sanitized = sanitizeQuestionList(parsed);
      if (sanitized && sanitized.length > 0) {
        state.questions = sanitized;
      }
    } catch (err) {
      // Tidak ada questions.json (atau tidak valid) — bank soal tetap kosong, tidak masalah.
    }
  }

  // ==========================================
  // 11. EVENT LISTENERS SETUP
  // ==========================================
  function setupEventListeners() {
    // Admin Gear
    DOM.btnAdminGear.addEventListener('click', () => {
      if (state.isAdminAuthenticated) {
        renderAdminView();
        showView(DOM.adminView);
      } else {
        promptAdminAuth();
      }
    });

    // Leaderboard
    DOM.btnLeaderboard.addEventListener('click', openLeaderboardView);
    DOM.btnBackFromLeaderboard.addEventListener('click', closeLeaderboardView);
    DOM.btnClearLeaderboard.addEventListener('click', handleClearLeaderboard);
    DOM.btnViewLeaderboardFromResult.addEventListener('click', openLeaderboardView);
    DOM.btnSaveLeaderboard.addEventListener('click', handleSaveLeaderboard);

    // Generic Notice / Confirm Modal
    DOM.btnGenericNoticeOk.addEventListener('click', () => {
      sound.playPop();
      closeGenericNotice(true);
    });
    DOM.btnGenericNoticeCancel.addEventListener('click', () => {
      sound.playPop();
      closeGenericNotice(false);
    });
    DOM.modalGenericNotice.addEventListener('click', (e) => {
      if (e.target === DOM.modalGenericNotice) closeGenericNotice(noticeBackdropValue);
    });

    // Password Modal
    DOM.formPassword.addEventListener('submit', handleAdminPassSubmit);
    DOM.btnCancelPass.addEventListener('click', () => {
      sound.playPop();
      DOM.modalPassword.classList.add('hidden');
    });

    // Back to Game
    DOM.btnBackToGame.addEventListener('click', closeAdminView);

    // Sound Toggle
    DOM.btnSoundToggle.addEventListener('click', () => {
      sound.enabled = !sound.enabled;
      DOM.soundIcon.textContent = sound.enabled ? '🔊' : '🔇';
      if (sound.enabled) sound.playPop();
    });

    // Quiz Actions
    DOM.btnSubmitEssay.addEventListener('click', handleEssaySubmit);
    DOM.btnNextQuestion.addEventListener('click', handleNextQuestion);
    DOM.btnRestartQuiz.addEventListener('click', () => {
      sound.playPop();
      startQuiz();
    });
    DOM.btnReviewAnswers.addEventListener('click', () => {
      sound.playPop();
      renderReviewPanel();
    });

    // Admin API Key
    DOM.btnSaveApiKey.addEventListener('click', saveApiKey);
    DOM.btnToggleKeyVisibility.addEventListener('click', () => {
      DOM.inputApiKey.type = DOM.inputApiKey.type === 'password' ? 'text' : 'password';
    });

    // File Upload Actions
    DOM.btnTriggerFileUpload.addEventListener('click', () => DOM.inputFileMaterial.click());
    DOM.inputFileMaterial.addEventListener('change', handleFileSelect);
    DOM.btnRemoveFile.addEventListener('click', removeSelectedFile);

    // AI Generate Button
    DOM.btnGenerateAi.addEventListener('click', generateQuestionsWithGemini);

    // Toggle Jumlah Soal: single vs campuran (Pilgan + Essay)
    document.querySelectorAll('input[name="ai-q-type"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'campuran') {
          DOM.qCountSingleWrap.classList.add('hidden');
          DOM.qCountMixedWrap.classList.remove('hidden');
        } else {
          DOM.qCountSingleWrap.classList.remove('hidden');
          DOM.qCountMixedWrap.classList.add('hidden');
        }
      });
    });

    // Admin Question List Actions
    DOM.btnAddManualQ.addEventListener('click', () => {
      sound.playPop();
      DOM.modalAddQuestion.classList.remove('hidden');
    });

    // Export / Import Bank Soal
    DOM.btnExportQuestions.addEventListener('click', exportQuestionsToJson);
    DOM.btnImportQuestions.addEventListener('click', () => DOM.inputImportQuestions.click());
    DOM.inputImportQuestions.addEventListener('change', handleImportQuestionsFile);

    // Manual Q Modal Type Toggle
    DOM.qManualType.addEventListener('change', (e) => {
      if (e.target.value === 'essay') {
        DOM.manualPilganGroup.classList.add('hidden');
        DOM.manualEssayGroup.classList.remove('hidden');
      } else {
        DOM.manualPilganGroup.classList.remove('hidden');
        DOM.manualEssayGroup.classList.add('hidden');
      }
    });

    DOM.btnCloseQModal.addEventListener('click', () => DOM.modalAddQuestion.classList.add('hidden'));
    DOM.btnCancelAddQ.addEventListener('click', () => DOM.modalAddQuestion.classList.add('hidden'));
    DOM.formManualQuestion.addEventListener('submit', handleManualQuestionSubmit);
  }

  // ==========================================
  // 12. INITIALIZATION
  // ==========================================
  async function init() {
    setupEventListeners();
    await loadDefaultQuestionsFile();
    startQuiz();
  }

  document.addEventListener('DOMContentLoaded', init);

})();