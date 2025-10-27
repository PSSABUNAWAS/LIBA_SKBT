/* LIBA v2.0 — MCQ tepat dari transkrip (tanpa drag/type) */
let mediaRecorder;
let recordedChunks = [];
let recordingUrl = null;
let recognition = null;
let recognizing = false;
let transcriptText = "";
let timerInterval = null;
let secondsElapsed = 0;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* =========================
   Util Asas (WPM/TP/Timer)
   ========================= */
function wordCount(s){
  return (s.trim().match(/\b[\p{L}\p{N}’']+\b/gu) || []).length;
}
function computeWPM(text, seconds){
  if(seconds <= 0) return 0;
  const wc = wordCount(text);
  return Math.round((wc / seconds) * 60);
}
/* Pemetaan linear WPM→% (cap 100). Contoh: 30 WPM → 30% */
function percentFromWPM(wpm){
  const pct = Math.round(Math.min(100, Math.max(0, (wpm / 100) * 100)));
  return pct;
}
function formatTime(s){
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const ss = (s%60).toString().padStart(2,'0');
  return `${m}:${ss}`;
}
function startTimer(){
  secondsElapsed = 0;
  $('#timer').textContent = formatTime(secondsElapsed);
  timerInterval = setInterval(() => {
    secondsElapsed++;
    $('#timer').textContent = formatTime(secondsElapsed);
  }, 1000);
}
function stopTimer(){
  if(timerInterval){ clearInterval(timerInterval); timerInterval = null; }
}

/* =========================
   SpeechRecognition & Rakaman
   ========================= */
function initSpeechRecognition(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    $('#srStatus').textContent = "Peranti tidak menyokong SpeechRecognition.";
    return null;
  }
  const rec = new SR();
  rec.lang = 'ms-MY';
  rec.interimResults = true;
  rec.continuous = true;
  rec.onstart = () => { $('#srStatus').textContent = "Sedang transkripsi…"; recognizing = true; };
  rec.onerror = (e) => { $('#srStatus').textContent = "Ralat SR: " + e.error; };
  rec.onend = () => { $('#srStatus').textContent = "Selesai transkripsi"; recognizing = false; };
  rec.onresult = (e) => {
    let finalText = "";
    for(let i=e.resultIndex; i<e.results.length; i++){
      const res = e.results[i];
      finalText += res[0].transcript + " ";
    }
    transcriptText += finalText;
    $('#transcriptBox').textContent = transcriptText.trim();
  };
  return rec;
}

async function startRecording(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => { if(e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      recordingUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = recordingUrl;
      a.download = `rakaman_${Date.now()}.webm`;
      a.textContent = 'Muat turun rakaman';
      $('#recordingLinks').appendChild(a);
      $('#recordingLinks').appendChild(document.createElement('br'));
    };
    mediaRecorder.start();
    $('#recStatus').textContent = "Merakam…";
  }catch(err){
    $('#recStatus').textContent = "Ralat mikrofon: " + err.message;
  }
}
function stopRecording(){
  if(mediaRecorder && mediaRecorder.state !== 'inactive'){
    mediaRecorder.stop();
    $('#recStatus').textContent = "Rakaman disimpan. (Boleh muat turun)";
  }
}

/* =========================
   TP & Paparan Keputusan
   ========================= */
function tpFromPercent(p){
  if(p >= 90) return {tp:6, label:'TP6 – Cemerlang', color:'var(--tp6)'};
  if(p >= 80) return {tp:5, label:'TP5 – Sangat Baik', color:'var(--tp5)'};
  if(p >= 70) return {tp:4, label:'TP4 – Baik', color:'var(--tp4)'};
  if(p >= 60) return {tp:3, label:'TP3 – Memuaskan', color:'var(--tp3)'};
  if(p >= 40) return {tp:2, label:'TP2 – Asas', color:'var(--tp2)'};
  return {tp:1, label:'TP1 – Permulaan', color:'var(--tp1)'};
}
function isPemulihan(selected){
  return (selected || '').trim().toUpperCase() === 'PEMULIHAN';
}
function renderResult(){
  const cls = $('#classSelect').value;
  const wpm = computeWPM(transcriptText, secondsElapsed);
  const p = percentFromWPM(wpm);
  const map = tpFromPercent(p);

  if(isPemulihan(cls)){
    const status = wpm >= 40 ? 'Menguasai' : 'Tidak Menguasai';
    const statusColor = wpm >= 40 ? 'var(--tp4)' : 'var(--tp1)';
    $('#resultArea').innerHTML = `
      <div class="tp-chip" style="border-color:${map.color}">
        <span style="width:10px;height:10px;border-radius:50%;background:${statusColor};display:inline-block"></span>
        <strong>PEMULIHAN: ${status}</strong>
        <span>•</span><span>WPM: ${wpm}</span>
        <span>•</span><span>${p}% (${map.tp} – ${map.label})</span>
      </div>
    `;
  }else{
    $('#resultArea').innerHTML = `
      <div class="tp-chip" style="border-color:${map.color}">
        <span style="width:10px;height:10px;border-radius:50%;background:${map.color};display:inline-block"></span>
        <strong>${p}% (${map.tp} – ${map.label})</strong>
        <span>•</span><span>WPM: ${wpm}</span>
      </div>
    `;
  }
}

/* =========================
   Rekod & Eksport CSV
   ========================= */
const rows = [];
function appendRowToTable(r){
  const tb = document.querySelector('#recordTable tbody');
  if(!tb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${r.tarikh}</td>
                  <td>${r.masa}</td>
                  <td>${r.nama}</td>
                  <td>${r.kelas}</td>
                  <td>${r.tempoh_s}</td>
                  <td>${r.wpm}</td>
                  <td>${r.peratus}</td>
                  <td>${r.tp}</td>
                  <td>${r.pautan_rakaman ? `<a href="${r.pautan_rakaman}" target="_blank">Rakaman</a>` : '-'}</td>`;
  tb.prepend(tr);
}
function saveCurrentRecord(){
  const now = new Date();
  const wpm = computeWPM(transcriptText, secondsElapsed);
  const percent = percentFromWPM(wpm);
  const tp = tpFromPercent(percent).tp;

  const row = {
    tarikh: now.toLocaleDateString(),
    masa: now.toLocaleTimeString(),
    nama: $('#studentName').value || '',
    kelas: $('#classSelect').value || '',
    tempoh_s: secondsElapsed,
    wpm: wpm,
    peratus: percent,
    tp: tp,
    pautan_rakaman: recordingUrl || ''
  };
  rows.push(row);
  appendRowToTable(row);
}
function exportCSV(){
  const headers = ["Tarikh","Masa","Nama","Kelas","Tempoh (s)","WPM","Peratus","TP","Rakaman"];
  const lines = [headers.join(",")];
  for(const r of rows){
    const ordered = {
      "Tarikh": r.tarikh,
      "Masa": r.masa,
      "Nama": r.nama,
      "Kelas": r.kelas,
      "Tempoh (s)": r.tempoh_s,
      "WPM": r.wpm,
      "Peratus": r.peratus,
      "TP": r.tp,
      "Rakaman": r.pautan_rakaman || '-'
    };
    lines.push(headers.map(h => `"${(ordered[h]??"").toString().replace(/"/g,'""')}"`).join(","));
  }
  const blob = new Blob([lines.join("\n")], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'LIBA_data.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* =========================
   Kuiz MCQ sahaja — Dijana Tepat dari Transkrip
   ========================= */

/* Senarai kata umum BM untuk ditapis daripada calon jawapan */
const MALAY_STOPWORDS = new Set([
  'yang','dan','atau','serta','atau','atau','itu','ini','itu','ini','di','ke','dari','daripada','kepada','untuk','pada','dengan',
  'bagi','akan','telah','pernah','sedang','belum','sudah','masih','ialah','adalah','merupakan','bukan','tiada','tidak',
  'satu','dua','tiga','empat','lima','enam','tujuh','lapan','sembilan','sepuluh',
  'saya','aku','anda','awak','kamu','dia','mereka','kami','kita',
  'sebuah','seorang','beberapa','para','yang','tersebut','sebab','kerana','agar','supaya','jika','kalau','semasa',
  'pun','lah','kah','tah','kan','sahaja','hanya','juga','lebih','amat','sangat','paling','antara','hingga','sehingga',
  'dalam','luar','atas','bawah','tepi','terhadap','oleh','oleh itu','maka'
]);

/* Util teks */
function normalizeSpaces(t){ return t.replace(/\s+/g,' ').trim(); }
function stripPunct(t){ return t.replace(/[()"'`~^:;,_\-–—/\\|<>[\]{}]/g, ''); }
function toWords(text){
  const cleaned = stripPunct(text).toLowerCase();
  return (cleaned.match(/\b[\p{L}\p{N}’']+\b/gu) || []);
}
function isCandidateWord(w){
  if(!w) return false;
  if(w.length < 4) return false;             // elak kata terlalu pendek
  if(MALAY_STOPWORDS.has(w)) return false;   // tapis kata umum
  if(/^\d+$/.test(w)) return false;          // elak nombor tulen
  return true;
}
function unique(arr){
  const seen = new Set(); const out = [];
  for(const x of arr){ if(!seen.has(x)){ seen.add(x); out.push(x); } }
  return out;
}
function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

/* Pisah ayat lebih kukuh: titik, tanda soal/seru, nokhtah berturutan */
function splitSentences(text){
  const cleaned = normalizeSpaces(text);
  const parts = cleaned.split(/(?<=[\.\!\?])\s+(?=[A-ZĀĂĄĆČĎĐĒĖĘĚĞĠĢĪİĶĻŁŃŅŇŌŒŚŞŠŤŪŮŰŲŴŶŸŽA-ZÀ-ÖØ-ÝĀ-Ŋ])/u);
  // fallback jika tiada huruf besar selepas tanda baca (transkrip SR)
  let sents = [];
  for(const p of parts){
    const chunks = p.split(/[\.\!\?]+/).map(x=>normalizeSpaces(x)).filter(Boolean);
    sents.push(...chunks);
  }
  sents = sents.map(s => s.length && !/[.!?]$/.test(s) ? s + '.' : s);
  // tapis ayat terlalu pendek
  return sents.filter(s => toWords(s).length >= 5);
}

/* Kolam calon global untuk Distraktor: dari keseluruhan transkrip */
function buildGlobalPool(allText){
  const words = toWords(allText).filter(isCandidateWord);
  return unique(words);
}

/* Jana 1 MCQ daripada 1 ayat */
function generateMCQFromSentence(sentence, globalPool){
  const sentWords = toWords(sentence);
  const candidates = unique(sentWords.filter(isCandidateWord));
  if(candidates.length === 0) return null;

  // pilih jawapan yang benar dari ayat
  const answer = candidates[Math.floor(Math.random()*candidates.length)];

  // bina stem: gantikan perkataan asal (case-insensitive, sempadan perkataan)
  const stem = sentence.replace(new RegExp(`\\b${answer}\\b`, 'i'), '____');

  // bina distraktor dari kolam global selain jawapan
  const pool = globalPool.filter(w => w !== answer);
  // utamakan panjang hampir sama supaya munasabah
  const nearLen = pool.filter(w => Math.abs(w.length - answer.length) <= 2);
  const pickBase = nearLen.length >= 10 ? nearLen : pool;

  const distractors = [];
  for(const w of shuffle(pickBase)){
    if(distractors.length >= 3) break;
    if(w.toLowerCase() === answer.toLowerCase()) continue;
    if(distractors.includes(w)) continue;
    // elak kosmetik yang terlalu mirip (ejaan sama)
    distractors.push(w);
  }
  // jika masih belum cukup, tambah apa yang ada
  while(distractors.length < 3 && pool.length){
    const w = pool[Math.floor(Math.random()*pool.length)];
    if(w && !distractors.includes(w) && w.toLowerCase() !== answer.toLowerCase()){
      distractors.push(w);
    }
  }
  if(distractors.length < 3) return null;

  const options = shuffle([...distractors, answer]);
  return { stem, options, answer };
}

/* Bina set MCQ */
function buildQuiz(){
  const container = $('#quizContainer');
  container.innerHTML = "";
  const src = normalizeSpaces(transcriptText.trim());
  if(!src){
    container.innerHTML = "<em>Transkrip diperlukan untuk jana kuiz. Tekan Mula/Selesai Bacaan.</em>";
    return;
  }

  const sents = splitSentences(src);
  const globalPool = buildGlobalPool(src);
  if(globalPool.length < 8){
    container.innerHTML = "<em>Teks terlalu pendek/umum untuk jana pilihan jawapan yang baik. Sila tambah bacaan.</em>";
    return;
  }

  let made = 0;
  const MAX_Q = 4;
  for(const s of sents){
    if(made >= MAX_Q) break;
    const mcq = generateMCQFromSentence(s, globalPool);
    if(!mcq) continue;

    made++;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<p><strong>Soalan (MCQ):</strong> ${mcq.stem}</p>` +
      mcq.options.map((opt,i)=>`<label style="display:block;margin:.25rem 0">
        <input type="radio" name="mcq_${made}" value="${opt}"> ${"ABCD"[i]}. ${opt}
      </label>`).join('');
    card.dataset.answer = mcq.answer;
    container.appendChild(card);
  }

  if(container.children.length === 0){
    container.innerHTML = "<em>Teks tidak sesuai untuk menjana MCQ. Cuba ayat yang lebih panjang/bermakna.</em>";
  }
}

/* Semak MCQ */
function checkQuiz(){
  const container = $('#quizContainer');
  let total = 0, correct = 0;
  [...container.children].forEach(card => {
    if(card.dataset.answer){
      total++;
      const sel = card.querySelector('input[type=radio]:checked');
      if(sel && sel.value.trim().toLowerCase() === card.dataset.answer.trim().toLowerCase()){
        correct++;
      }
    }
  });
  $('#quizScore').textContent = `Skor Kuiz: ${correct} / ${total}`;
}

/* =========================
   Events
   ========================= */
window.addEventListener('DOMContentLoaded', () => {
  $('#btnStart').addEventListener('click', async () => {
    transcriptText = "";
    $('#transcriptBox').textContent = "";
    $('#resultArea').textContent = "";
    $('#quizContainer').innerHTML = "";
    $('#quizScore').textContent = "";
    $('#btnStop').disabled = false;
    $('#btnStart').disabled = true;

    startTimer();
    recognition = initSpeechRecognition();
    if(recognition) recognition.start();
    await startRecording();
  });

  $('#btnStop').addEventListener('click', () => {
    stopTimer();
    if(recognition && recognizing){ recognition.stop(); }
    stopRecording();
    $('#btnStop').disabled = true;
    $('#btnStart').disabled = false;
    renderResult();
    saveCurrentRecord();
  });

  $('#btnAnalyze').addEventListener('click', () => {
    renderResult();
    saveCurrentRecord();
  });

  $('#btnQuiz').addEventListener('click', () => buildQuiz());
  $('#btnExport').addEventListener('click', () => exportCSV());
  $('#btnCheckQuiz').addEventListener('click', () => checkQuiz());
});
