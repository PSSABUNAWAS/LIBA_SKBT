/* LIBA v2.0 (dikemas kini — tanpa drag & drop) */
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

function wordCount(s){
  return (s.trim().match(/\b[\p{L}\p{N}’']+\b/gu) || []).length;
}
function computeWPM(text, seconds){
  if(seconds <= 0) return 0;
  const wc = wordCount(text);
  return Math.round((wc / seconds) * 60);
}
function percentFromWPM(wpm){
  const pct = Math.round(Math.min(100, (wpm / 100) * 100));
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

// SpeechRecognition
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

// Rakaman
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

// TP mapping
function tpFromPercent(p){
  if(p >= 90) return {tp:6, label:'TP6 – Cemerlang', color:'var(--tp6)'};
  if(p >= 80) return {tp:5, label:'TP5 – Sangat Baik', color:'var(--tp5)'};
  if(p >= 70) return {tp:4, label:'TP4 – Baik', color:'var(--tp4)'};
  if(p >= 60) return {tp:3, label:'TP3 – Memuaskan', color:'var(--tp3)'};
  if(p >= 40) return {tp:2, label:'TP2 – Asas', color:'var(--tp2)'};
  return {tp:1, label:'TP1 – Permulaan', color:'var(--tp1)'};
}

function isPemulihan(selected){
  return /^(1|2|3|4|5|6)\s+(AR-RAZI|AL-KHAWARIZMI)$/i.test(selected);
}

function renderResult(){
  const cls = $('#classSelect').value;
  const wpm = computeWPM(transcriptText, secondsElapsed);
  if(isPemulihan(cls)){
    const status = wpm >= 40 ? 'Menguasai' : 'Tidak Menguasai';
    const color = wpm >= 40 ? 'var(--tp4)' : 'var(--tp1)';
    $('#resultArea').innerHTML = `
      <div class="tp-chip" style="border-color:${color}">
        <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block"></span>
        <strong>Keputusan (Pemulihan): ${status}</strong>
        <span>•</span><span>WPM: ${wpm}</span>
      </div>
    `;
  }else{
    const p = percentFromWPM(wpm);
    const map = tpFromPercent(p);
    $('#resultArea').innerHTML = `
      <div class="tp-chip" style="border-color:${map.color}">
        <span style="width:10px;height:10px;border-radius:50%;background:${map.color};display:inline-block"></span>
        <strong>${p}% (${map.tp} – ${map.label})</strong>
        <span>•</span><span>WPM: ${wpm}</span>
      </div>
    `;
  }
}

// Rekod + CSV
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
                  <td>${r.peratus!==''? r.peratus : '-'}</td>
                  <td>${r.tp!==''? r.tp : '-'}</td>
                  <td>${r.pautan_rakaman ? `<a href="${r.pautan_rakaman}" target="_blank">Rakaman</a>` : '-'}</td>`;
  tb.prepend(tr);
}
function saveCurrentRecord(){
  const now = new Date();
  const wpm = computeWPM(transcriptText, secondsElapsed);
  const cls = $('#classSelect').value;
  const isPem = isPemulihan(cls);
  const percent = isPem ? '' : percentFromWPM(wpm);
  const tp = isPem ? '' : tpFromPercent(percent).tp;

  const row = {
    tarikh: now.toLocaleDateString(),
    masa: now.toLocaleTimeString(),
    nama: $('#studentName').value || '',
    kelas: cls,
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
      "Peratus": r.peratus === '' ? '-' : r.peratus,
      "TP": r.tp === '' ? '-' : r.tp,
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

// ===== Kuiz: MCQ sahaja (drag & drop dibuang) =====
function randomChoice(arr){ return arr[Math.floor(Math.random()*arr.length)] }
function splitSentences(text){
  return text.replace(/\n+/g,' ').split(/(?<=[\.\!\?])\s+/).filter(s => s.trim().length>0);
}
function generateMCQ(sentence){
  const tokens = sentence.split(/\s+/).filter(w => w.length>3);
  if(tokens.length < 1) return null;
  const answer = randomChoice(tokens);
  const stem = sentence.replace(new RegExp(`\\b${answer}\\b`,'i'), '____');
  const distractors = new Set();
  function mutate(w){
    if(w.length<4) return w;
    const i = Math.max(1, Math.min(w.length-2, Math.floor(w.length/2)));
    return w.slice(0,i) + w[i].toUpperCase() + w.slice(i+1);
  }
  while(distractors.size<3){
    const pick = randomChoice(tokens);
    if(pick.toLowerCase() !== answer.toLowerCase()){
      distractors.add(mutate(pick));
    }
  }
  const options = [...distractors, answer].sort(()=>Math.random()-0.5);
  return {type:'mcq', stem, options, answer};
}
function buildQuiz(){
  const container = $('#quizContainer');
  container.innerHTML = "";
  const src = transcriptText.trim();
  if(!src){
    container.innerHTML = "<em>Transkrip diperlukan untuk jana kuiz. Tekan Mula/Selesai Bacaan.</em>";
    return;
  }
  const sents = splitSentences(src);
  let made = 0;
  for(const s of sents){
    if(made >= 4) break; // maksimum 4 soalan MCQ
    const mcq = generateMCQ(s);
    if(mcq){
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
  }
  if(container.children.length === 0){
    container.innerHTML = "<em>Teks terlalu pendek untuk jana kuiz. Tambah bacaan lebih panjang.</em>";
  }
}
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

// Events
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
