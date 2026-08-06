# ❄️ TPTUP EduGame - Game Edukasi Teknik Refrigrasi & Tata Udara

Aplikasi web edukasi interaktif berbasis Single Page Application (SPA) utuh untuk mata pelajaran **SMK TPTUP (Teknik Pemanasan, Tata Udara, dan Pendinginan)**. 

Aplikasi ini mengusung desain visual **bright & fresh edutainment** (gaya modern seperti Duolingo & Kahoot), 100% responsif mobile-first, dilengkapi generator soal otomatis dengan AI Google Gemini, dan panel admin terlindungi password.

---

## 🚀 Fitur Utama

1. **Desain UI/UX Bright & Fresh**:
   - Skema warna latar cerah (`#f4f7fa`) dengan kartu kuis putih bersih (`border-radius: 24px` & bayangan lembut).
   - Tombol pilihan ganda berukuran besar (touch-friendly 56px+) dengan efek push 3D.
   - Umpan balik visual langsung ketika diklik: **Hijau cerah** jika benar, **Merah cerah** jika salah.
   - Efek suara interaktif (*Web Audio API*) & perayaan *Canvas Confetti* saat kuis selesai.

2. **Panel Admin & Keamanan**:
   - Menu admin tersembunyi di balik **Ikon Roda Gigi (Settings ⚙️)** di pojok kanan atas.
   - Dilindungi password rahasia wajib: `TPTUP10`.
   - Tombol "Kembali ke Game" untuk mengunci kembali halaman kuis.

3. **Auto-Generate Soal via AI Google Gemini**:
   - Guru dapat menempelkan paragraf materi pelajaran TPTUP murni (contoh: Kompresor, Kondensor, Katup Ekspansi, Evaporator, Refrigeran R-134a/R-32).
   - Menggunakan model `gemini-3.5-flash` untuk menghasilkan 5 soal pilihan ganda pilihan secara otomatis dalam format JSON murni.
   - Kunci API disimpan aman di `localStorage` browser.
   - Tombol "Gunakan Materi Default TPTUP" berisi 6 soal dasar yang siap dimainkan tanpa butuh API Key.

---

## 🛠️ Cara Menjalankan Secara Lokal

Karena proyek ini dibuat dengan HTML, CSS, dan JavaScript murni tanpa dependency eksternal/build tool, Anda dapat menjalankannya dengan sangat mudah:

### Opsi 1: Buka Langsung File
Buka file `index.html` langsung di browser web favorit Anda (Chrome, Edge, Firefox, Safari).

### Opsi 2: Menggunakan Live Server / Python HTTP Server
```bash
# Menggunakan Python:
cd scratch/tptup-edu-game
python -m http.server 8000

# Buka http://localhost:8000 di browser.
```

---

## 🌐 Cara Deploy (Vercel & GitHub Pages)

### Deploy ke GitHub Pages:
1. Push seluruh isi folder ini (`index.html`, `style.css`, `app.js`) ke repository GitHub Anda.
2. Masuk ke **Settings** repository > **Pages**.
3. Pilih branch `main` / `master` dan folder `/ (root)`, lalu simpan.

### Deploy ke Vercel:
1. Impor repository GitHub Anda di dashboard Vercel.
2. Vercel akan secara otomatis mendeteksi proyek HTML statis ini dan langsung melakukan deployment.

---

## 🔑 Akses Password Admin
- **Password Default Admin**: `TPTUP10`
