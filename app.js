/* LIBA v2.0 core logic (BM penuh, tiada bunyi) */
let mediaRecorder;
let recordedChunks = [];
let recordingUrl = null;
let recognition = null;
let recognizing = false;
let transcriptText = "";
let timerInterval = null;
let secondsElapsed = 0;

// Util
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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

// SpeechRecognition (Web Speech API) – gunakan webkitSpeechRecognition untuk Edge/Chrome
function initSpeechRecognition(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    $('#srStatus').textContent = "Peranti tidak menyokong SpeechRecognition.";
    return null;
  }
  const rec = new SR();
  rec.lang = 'ms-MY'; // cuba BM; fallback akan guna en-US jika tidak disokong
  rec.interimResults = true;
  rec.continuous = true;
  rec.onstart = () => { $('#srStatus').textContent = "Sedang transkripsi…"; recognizing = true; };
  rec.onerror = (e) => { $('#srStatus').textContent = "Ralat SR: " + e.error; };
  rec.onend = () => { $('#srStatus').textContent = "Selesai transkripsi"; recognizing = false; };
  rec.onresult = (e) => {
    let finalText = "";
    for(let i=e.resultIndex; i<e.results.length; i++){
      const res = e.results[i];
      finalText += res[0].transcript + (res.isFinal ? " " : " ");
    }
    transcriptText += finalText;
    $('#transcriptBox').textContent = transcriptText.trim();
  };
  return rec;
}

// Rakaman Suara (MediaRecorder)
async function startRecording(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if(e.data.size > 0) recordedChunks.push(e.data);
    };
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
    $('#recStatus').textContent = "Rakaman disimpan.";
  }
}

// Perbandingan teks mudah untuk peratus ketepatan
function tokenise(s){
  return s.toLowerCase()
    .replace(/[^a-z\u00C0-\u024f\u1e00-\u1eff0-9\s']/gi,' ')
    .split(/\s+/).filter(Boolean);
}

function computeAccuracy(reference, spoken){
  const ref = tokenise(reference);
  const spk = tokenise(spoken);
  if(ref.length === 0 || spk.length === 0) return 0;
  // Kira padanan mudah: kira berapa perkataan rujukan muncul dalam transkrip (bag of words, minimum)
  const refCount = new Map();
  for(const w of ref){ refCount.set(w, (refCount.get(w)||0)+1); }
  let match = 0;
  for(const w of spk){
    if(refCount.has(w) && refCount.get(w) > 0){
      match++; refCount.set(w, refCount.get(w)-1);
    }
  }
  return Math.round((match / ref.length) * 100);
}

// TP mapping (rujuk warna dalam CSS)
function tpFromPercent(p){
  if(p >= 90) return {tp:6, label:'TP6 – Cemerlang', color:'var(--tp6)'};
  if(p >= 80) return {tp:5, label:'TP5 – Sangat Baik', color:'var(--tp5)'};
  if(p >= 70) return {tp:4, label:'TP4 – Baik', color:'var(--tp4)'};
  if(p >= 60) return {tp:3, label:'TP3 – Memuaskan', color:'var(--tp3)'};
  if(p >= 40) return {tp:2, label:'TP2 – Asas', color:'var(--tp2)'};
  return {tp:1, label:'TP1 – Permulaan', color:'var(--tp1)'};
}

// Penentu "Menguasai" untuk Pemulihan (ambang lalai 60%)
const PEMULIHAN_THRESHOLD = 60;

function isPemulihan(selected){
  return selected.toLowerCase().includes('pemulihan');
}

function renderResult(){
  const cls = $('#classSelect').value;
  const p = computeAccuracy($('#referenceText').value, transcriptText);
  if(isPemulihan(cls)){
    const status = p >= PEMULIHAN_THRESHOLD ? 'Menguasai' : 'Tidak Menguasai';
    const color = p >= PEMULIHAN_THRESHOLD ? 'var(--tp4)' : 'var(--tp1)';
    $('#resultArea').innerHTML = `
      <div class="tp-chip" style="border-color:${color}">
        <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block"></span>
        <strong>Keputusan (Pemulihan): ${status}</strong>
      </div>
    `;
  }else{
    const map = tpFromPercent(p);
    $('#resultArea').innerHTML = `
      <div class="tp-chip" style="border-color:${map.color}">
        <span style="width:10px;height:10px;border-radius:50%;background:${map.color};display:inline-block"></span>
        <strong>${p}% (${map.tp} – ${map.label})</strong>
      </div>
    `;
  }
}

// Simpan data baris & Eksport CSV
const rows = [];
function saveCurrentRecord(){
  const row = {
    tarikh: new Date().toISOString(),
    nama: $('#studentName').value || '',
    kelas: $('#classSelect').value,
    masa_saat: secondsElapsed,
    peratus: computeAccuracy($('#referenceText').value, transcriptText),
    tp: tpFromPercent(computeAccuracy($('#referenceText').value, transcriptText)).tp,
    keputusan_pemulihan: isPemulihan($('#classSelect').value) ?
      (computeAccuracy($('#referenceText').value, transcriptText) >= PEMULIHAN_THRESHOLD ? 'Menguasai' : 'Tidak Menguasai')
      : '',
    pautan_rakaman: recordingUrl || ''
  };
  rows.push(row);
}

function exportCSV(){
  const headers = ["tarikh","nama","kelas","masa_saat","peratus","tp","keputusan_pemulihan","pautan_rakaman"];
  const lines = [headers.join(",")];
  for(const r of rows){
    lines.push(headers.map(h => `"${(r[h]??"").toString().replace(/"/g,'""')}"`).join(","));
  }
  const blob = new Blob([lines.join("\n")], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'LIBA_data.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// Kuiz: jana soalan MCQ + drag-drop dari transkrip (atau referenceText jika transkrip kosong)
function pickSourceText(){
  const tx = transcriptText.trim();
  if(tx.length >= 20) return tx;
  const ref = $('#referenceText').value.trim();
  return ref;
}

function randomChoice(arr){ return arr[Math.floor(Math.random()*arr.length)] }

function generateMCQ(sentence){
  // Pilih 1 kata > 3 huruf untuk dijadikan jawapan
  const tokens = sentence.split(/\s+/).filter(w => w.length>3);
  if(tokens.length < 1) return null;
  const answer = randomChoice(tokens);
  const stem = sentence.replace(new RegExp(`\\b${answer}\\b`,'i'), '____');

  // Distraktor mudah: ubah satu huruf, tambah imbuhan, atau ambil kata lain rawak
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
  const options = [...distractors, answer];
  options.sort(()=>Math.random()-0.5);

  return {type:'mcq', stem, options, answer};
}

function generateDragDrop(sentence){
  // Ambil sehingga 3 kata untuk kosongkan
  const tokens = sentence.split(/\s+/);
  const indices = [];
  for(let i=0;i<tokens.length;i++){
    if(tokens[i].length>3) indices.push(i);
  }
  if(indices.length<3) return null;
  indices.sort(()=>Math.random()-0.5);
  const blanksIdx = indices.slice(0,3).sort((a,b)=>a-b);
  const answers = blanksIdx.map(i => tokens[i]);
  for(const i of blanksIdx){ tokens[i] = '____'; }
  const stem = tokens.join(' ');
  return {type:'drag', stem, answers};
}

function splitSentences(text){
  return text.replace(/\n+/g,' ').split(/(?<=[\.\!\?])\s+/).filter(s => s.trim().length>0);
}

function buildQuiz(){
  const container = $('#quizContainer');
  container.innerHTML = "";
  const src = pickSourceText();
  if(!src){
    container.innerHTML = "<em>Transkrip atau petikan rujukan diperlukan untuk jana kuiz.</em>";
    return;
  }
  const sents = splitSentences(src);
  let made = 0;
  for(const s of sents){
    if(made >= 4) break; // 2 MCQ + 2 DragDrop (sasaran)
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
    if(made >= 4) break;
    const dd = generateDragDrop(s);
    if(dd){
      made++;
      const options = dd.answers.slice().sort(()=>Math.random()-0.5);
      const card = document.createElement('div');
      card.className = 'card';
      const blanks = dd.answers.map((a,i)=>`<span class="blank" data-idx="${i}" contenteditable="true" style="display:inline-block;min-width:80px;border-bottom:2px dashed var(--border);padding:2px 4px;margin:0 4px"></span>`).join(' ');
      card.innerHTML = `<p><strong>Isi Tempat Kosong (Drag/Type):</strong> ${dd.stem}</p>
        <div><small>Petunjuk jawapan:</small> ${options.map(o=>`<span class="tp-chip" style="margin-right:6px">${o}</span>`).join('')}</div>
        <div><small>Isi jawapan di ruang bergaris.</small></div>`;
      card.dataset.answers = JSON.stringify(dd.answers);
      container.appendChild(card);
    }
  }
  if(container.children.length === 0){
    container.innerHTML = "<em>Teks terlalu pendek untuk jana kuiz. Tambah petikan lebih panjang.</em>";
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
    }else if(card.dataset.answers){
      total++;
      const ans = JSON.parse(card.dataset.answers);
      const blanks = card.querySelectorAll('.blank');
      let ok = true;
      blanks.forEach((b,i)=>{
        if((b.textContent||'').trim().toLowerCase() !== ans[i].trim().toLowerCase()) ok = false;
      });
      if(ok) correct++;
    }
  });
  $('#quizScore').textContent = `Skor Kuiz: ${correct} / ${total}`;
}

// Event wiring
window.addEventListener('DOMContentLoaded', () => {
  $('#btnStart').addEventListener('click', async () => {
    // Reset state
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
