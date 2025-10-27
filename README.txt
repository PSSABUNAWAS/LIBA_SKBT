LIBA v2.0 PWA (Bahasa Melayu)

Ciri Utama:
- Rakaman suara (MediaRecorder API), transkripsi automatik (Web Speech API).
- Kira peratus bacaan & TP (TP1–TP6) secara automatik.
- Khas Pemulihan: paparkan "Menguasai / Tidak Menguasai" sahaja.
- Stopwatch masa bacaan.
- Jana kuiz automatik (MCQ A–D + isi tempat kosong/drag-typing).
- Eksport CSV (data + pautan rakaman).
- PWA: offline, Add to Home Screen.

Cara Guna (Edge/Chrome di komputer atau telefon):
1) Buka index.html melalui pelayan (contoh: Live Server VSCode) atau hoskan di GitHub Pages / Firebase Hosting.
2) Benarkan akses mikrofon apabila diminta.
3) Tampal "Petikan Teks" rujukan.
4) Pilih kelas:
   - Jika "Pemulihan …": output = Menguasai / Tidak Menguasai (ambang 60%).
   - Jika "Tahun 1–6": output = Peratus 0–100% & TP 1–6.
5) Tekan "Mula Baca" → Murid membaca → Tekan "Selesai Baca".
6) Tekan "Jana Kuiz" untuk bina soalan automatik daripada transkrip/teks.
7) Tekan "Eksport Data" untuk muat turun CSV.

Nota:
- Web Speech API Bahasa Melayu mungkin bergantung pada peranti/versi pelayar. Jika tidak aktif, aplikasi masih berfungsi (rakaman + manual tampal teks).
- Ambang Pemulihan lalai = 60%. Ubah di app.js (PEMULIHAN_THRESHOLD).
