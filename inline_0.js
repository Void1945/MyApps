
const categories = [
 {id:'online',name:'Online Orders',sub:'Shopping & deliveries',icon:'🛍️',color:'#83a9e8',fields:[{id:'item',label:'WHAT DID YOU ORDER?',placeholder:'e.g. Phone case',type:'text'},{id:'store',label:'STORE / PLATFORM',placeholder:'e.g. Amazon, Flipkart',type:'text'}]},
 {id:'petrol',name:'Petrol',sub:'Fuel & refuelling',icon:'⛽',color:'#f0b65f',fields:[{id:'litres',label:'LITRES (OPTIONAL)',placeholder:'e.g. 8.5',type:'number'},{id:'odometer',label:'ODOMETER (OPTIONAL)',placeholder:'e.g. 12450 km',type:'text'}]},
 {id:'bike',name:'Bike Expense',sub:'Service & accessories',icon:'🏍️',color:'#79d0ad',fields:[{id:'bikeType',label:'EXPENSE TYPE',type:'select',options:['Service','Maintenance','Accessories','Repairs','Other']},{id:'item',label:'DETAILS',placeholder:'e.g. Engine oil change',type:'text'}]},
 {id:'food',name:'Food',sub:'Meals, snacks & drinks',icon:'🍜',color:'#e58f9b',fields:[{id:'meal',label:'MEAL TYPE',type:'select',options:['Breakfast','Lunch','Dinner','Snacks','Drinks','Other']},{id:'place',label:'PLACE (OPTIONAL)',placeholder:'Restaurant or shop',type:'text'}]},
 {id:'other',name:'Other Expense',sub:'Everything else',icon:'💳',color:'#b6a0e8',fields:[{id:'item',label:'WHAT WAS IT FOR?',placeholder:'e.g. Electricity bill',type:'text'},{id:'payment',label:'PAYMENT METHOD',type:'select',options:['UPI','Cash','Card','Bank transfer','Other']}]}
];
let expenses = [];
let selectedCategory = 'online';
let editingExpenseId = null;
let spendSnapDB = null;
const DB_NAME = 'SpendSnapDB';
const DB_VERSION = 1;
const EXPENSE_STORE = 'expenses';
const META_STORE = 'meta';

function openSpendSnapDB(){
 return new Promise((resolve,reject)=>{
   const request=indexedDB.open(DB_NAME,DB_VERSION);
   request.onupgradeneeded=()=>{
     const db=request.result;
     if(!db.objectStoreNames.contains(EXPENSE_STORE)) db.createObjectStore(EXPENSE_STORE,{keyPath:'id'});
     if(!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE,{keyPath:'key'});
   };
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error||new Error('Could not open the local expense database.'));
 });
}
function dbTransaction(storeNames,mode,work){
 return new Promise((resolve,reject)=>{
   const tx=spendSnapDB.transaction(storeNames,mode);
   let result;
   try{result=work(tx);}catch(err){reject(err);return;}
   tx.oncomplete=()=>resolve(result);
   tx.onerror=()=>reject(tx.error||new Error('Database operation failed.'));
   tx.onabort=()=>reject(tx.error||new Error('Database operation was cancelled.'));
 });
}
function dbGetAll(){
 return new Promise((resolve,reject)=>{
   const req=spendSnapDB.transaction(EXPENSE_STORE,'readonly').objectStore(EXPENSE_STORE).getAll();
   req.onsuccess=()=>resolve(req.result||[]);
   req.onerror=()=>reject(req.error);
 });
}
async function dbPut(expense){
 await dbTransaction([EXPENSE_STORE],'readwrite',tx=>tx.objectStore(EXPENSE_STORE).put(expense));
}
async function dbDelete(id){
 await dbTransaction([EXPENSE_STORE],'readwrite',tx=>tx.objectStore(EXPENSE_STORE).delete(id));
}
async function migrateLegacyExpenses(){
 return new Promise((resolve,reject)=>{
   const tx=spendSnapDB.transaction([EXPENSE_STORE,META_STORE],'readwrite');
   const meta=tx.objectStore(META_STORE);
   const marker=meta.get('legacyLocalStorageMigrated');
   marker.onsuccess=()=>{
     if(marker.result?.value===true) return;
     let old=[];
     try{old=JSON.parse(localStorage.getItem('spendsnap_expenses')||'[]');}catch(e){old=[];}
     if(Array.isArray(old)){
       const store=tx.objectStore(EXPENSE_STORE);
       old.forEach(item=>{
         if(item && item.id!==undefined && Number(item.amount)>0 && item.category && item.date){
           store.put({...item,amount:Number(item.amount)});
         }
       });
     }
     meta.put({key:'legacyLocalStorageMigrated',value:true,completedAt:new Date().toISOString()});
   };
   tx.oncomplete=resolve;
   tx.onerror=()=>reject(tx.error||new Error('Could not migrate existing expenses.'));
   tx.onabort=()=>reject(tx.error||new Error('Migration was cancelled.'));
 });
}
async function initialiseStorage(){
 try{
   if(!('indexedDB' in window)) throw new Error('IndexedDB is unavailable in this browser.');
   spendSnapDB=await openSpendSnapDB();
   await migrateLegacyExpenses();
   expenses=await dbGetAll();
   expenses.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.time||'').localeCompare(String(a.time||''))||Number(b.id)-Number(a.id));
   const status=document.getElementById('storageStatus');
   if(status) status.textContent='Expense database: stored locally on this device (IndexedDB).';
 }catch(err){
   console.error('SpendSnap storage initialisation failed:',err);
   const status=document.getElementById('storageStatus');
   if(status) status.textContent='Local database could not be opened: '+(err.message||'unknown error');
   toast('Could not open expense storage. Your previous data has not been deleted.');
 }
}

const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n)||0);
const today = new Date();
const isoDate = d => {const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)};
document.getElementById('todayLabel').textContent = today.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
document.getElementById('date').value = isoDate(today);
document.getElementById('time').value = today.toTimeString().slice(0,5);

function renderCategories(){
 document.getElementById('categoryGrid').innerHTML = categories.map(c=>`<button class="category" style="--tile:${c.color}12;--accent:${c.color}" onclick="openEntry('${c.id}')"><span class="cat-arrow">↗</span><span class="cat-icon">${c.icon}</span><div class="cat-title">${c.name}</div><div class="cat-sub">${c.sub}</div></button>`).join('');
}
function showScreen(id){
 document.body.classList.toggle('home-active',id==='homeScreen');
 document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id));
 document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));
 if(id==='historyScreen') renderHistory();
 if(id==='summaryScreen') renderSummary();
 window.scrollTo({top:0,behavior:'smooth'});
}
function openEntry(id){
 editingExpenseId=null;
 selectedCategory=id; const c=categories.find(x=>x.id===id);
 document.getElementById('entryTitle').textContent=c.name;
 document.getElementById('entrySubtitle').textContent='Add the details of your '+c.name.toLowerCase();
 document.getElementById('specificFields').innerHTML=c.fields.map(f=>{
   let input=f.type==='select'?`<select class="control" id="extra_${f.id}">${f.options.map(o=>`<option>${o}</option>`).join('')}</select>`:`<input class="control" id="extra_${f.id}" type="${f.type}" ${f.type==='number'?'inputmode="decimal" min="0" step="any"':''} placeholder="${f.placeholder||''}">`;
   return `<div class="field"><label for="extra_${f.id}">${f.label}</label>${input}</div>`;
 }).join('');
 document.getElementById('expenseForm').reset();
 document.querySelector('#expenseForm .primary').textContent='Save expense';
 document.getElementById('entryTitle').textContent=c.name;
 document.getElementById('date').value=isoDate(new Date());document.getElementById('time').value=new Date().toTimeString().slice(0,5);
 showScreen('entryScreen');setTimeout(()=>document.getElementById('amount').focus(),250);
}
document.getElementById('expenseForm').addEventListener('submit',async e=>{
 e.preventDefault();
 if(!spendSnapDB){toast('Expense database is not ready yet');return;}
 const c=categories.find(x=>x.id===selectedCategory);
 const amount=Number(document.getElementById('amount').value);
 if(!amount||amount<=0)return;
 const extra={};c.fields.forEach(f=>{const el=document.getElementById('extra_'+f.id);if(el&&el.value)extra[f.id]=el.value});
 const record={
   id:editingExpenseId!==null?editingExpenseId:Date.now(),
   category:selectedCategory,
   amount,
   date:document.getElementById('date').value,
   time:document.getElementById('time').value,
   note:document.getElementById('note').value.trim(),
   extra
 };
 try{
   await dbPut(record);
   if(editingExpenseId!==null){
     expenses=expenses.map(x=>x.id===editingExpenseId?record:x);
     toast('Expense updated successfully');
   }else{
     expenses.unshift(record);
     toast('Expense saved successfully');
   }
   editingExpenseId=null;
   expenses.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.time||'').localeCompare(String(a.time||''))||Number(b.id)-Number(a.id));
   renderHome();showScreen('homeScreen');
 }catch(err){console.error(err);toast('Could not save expense. Please try again.');}
});
function categoryOf(id){return categories.find(c=>c.id===id)||categories[4]}
function fmtDate(s){if(!s)return '';return new Date(s+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
function txHTML(e){
 const c=categoryOf(e.category);const detail=e.note||Object.values(e.extra||{}).filter(Boolean).join(' · ')||c.name;
 return `<div class="transaction"><div class="tx-icon">${c.icon}</div><div class="tx-main"><div class="tx-title">${escapeHTML(detail)}</div><div class="tx-meta">${c.name} · ${fmtDate(e.date)}${e.time?' · '+e.time:''}</div></div><div class="tx-amount">${money(e.amount)}</div></div>`;
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function renderHome(){
 const now=isoDate(new Date()),month=now.slice(0,7);const todaySum=expenses.filter(e=>e.date===now).reduce((a,e)=>a+e.amount,0);const monthItems=expenses.filter(e=>e.date?.startsWith(month));const monthSum=monthItems.reduce((a,e)=>a+e.amount,0);
 document.getElementById('monthTotal').textContent=money(monthSum);document.getElementById('todayTotal').textContent=money(todaySum);document.getElementById('monthCount').textContent=monthItems.length+' expenses';
}
function renderHistory(){
 const q=(document.getElementById('searchInput').value||'').toLowerCase(),m=document.getElementById('monthFilter').value;
 const list=expenses.filter(e=>(!m||e.date?.startsWith(m))&&(!q||[e.note,e.category,...Object.values(e.extra||{})].join(' ').toLowerCase().includes(q)));
 document.getElementById('historyList').innerHTML=list.length?list.map(e=>`<div class="history-entry">${txHTML(e)}<div class="history-actions"><button class="secondary" style="width:auto;margin:0" onclick='editExpense(${JSON.stringify(e.id)})'>✎ Edit</button><button class="danger" onclick='deleteExpense(${JSON.stringify(e.id)})'>Delete</button></div></div>`).join(''):'<div class="empty"><b>No expenses found</b>Change the search or month filter to see other entries.</div>';
}
function editExpense(id){
 const e=expenses.find(x=>String(x.id)===String(id));if(!e)return;
 openEntry(e.category||'other');
 editingExpenseId=e.id;
 document.getElementById('amount').value=e.amount??'';
 document.getElementById('date').value=e.date||isoDate(new Date());
 document.getElementById('time').value=e.time||'';
 document.getElementById('note').value=e.note||'';
 const c=categoryOf(e.category);
 c.fields.forEach(f=>{const el=document.getElementById('extra_'+f.id);if(el)el.value=(e.extra||{})[f.id]??'';});
 document.getElementById('entryTitle').textContent='Edit '+c.name;
 document.getElementById('entrySubtitle').textContent='Update this previous expense';
 document.querySelector('#expenseForm .primary').textContent='Save changes';
 showScreen('entryScreen');
}
async function deleteExpense(id){
 if(!confirm('Delete this expense?'))return;
 try{await dbDelete(id);expenses=expenses.filter(e=>String(e.id)!==String(id));renderHome();renderHistory();toast('Expense deleted');}
 catch(err){console.error(err);toast('Could not delete expense. Please try again.');}
}
function renderSummary(){
 const total=expenses.reduce((a,e)=>a+e.amount,0);document.getElementById('allTotal').textContent=money(total);document.getElementById('allCount').textContent=expenses.length+' expenses';
 document.getElementById('summaryList').innerHTML=categories.map(c=>{const items=expenses.filter(e=>e.category===c.id);const sum=items.reduce((a,e)=>a+e.amount,0);return `<div class="transaction"><div class="tx-icon">${c.icon}</div><div class="tx-main"><div class="tx-title">${c.name}</div><div class="tx-meta">${items.length} ${items.length===1?'expense':'expenses'} recorded</div></div><div class="tx-amount">${money(sum)}</div></div>`}).join('');
}
function downloadBlob(blob,filename){
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function exportCSV(){
 const rows=[['Date','Time','Category','Amount (INR)','Details','Note']];
 expenses.forEach(e=>{const c=categoryOf(e.category);rows.push([e.date,e.time,c.name,e.amount,Object.values(e.extra||{}).join(' | '),e.note||''])});
 const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');downloadBlob(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),'spendsnap-expenses.csv');
}
function exportJSON(){
 const backup={app:'SpendSnap',formatVersion:1,exportedAt:new Date().toISOString(),expenses};
 downloadBlob(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),'SpendSnap-backup-'+isoDate(new Date())+'.json');
 toast('Backup file prepared');
}
document.getElementById('jsonImport').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{
   const parsed=JSON.parse(await file.text());
   const incoming=Array.isArray(parsed)?parsed:parsed.expenses;
   if(!Array.isArray(incoming))throw new Error('This does not look like a SpendSnap backup.');
   const valid=incoming.filter(e=>e&&e.id!==undefined&&Number(e.amount)>0&&categories.some(c=>c.id===e.category)&&/^\d{4}-\d{2}-\d{2}$/.test(e.date||''));
   if(valid.length!==incoming.length)throw new Error('Some records are invalid. No data was changed.');
   if(!confirm('Restore '+valid.length+' expenses? This will replace the current SpendSnap expense list on this device.'))return;
   await new Promise((resolve,reject)=>{
     const tx=spendSnapDB.transaction(EXPENSE_STORE,'readwrite');
     const store=tx.objectStore(EXPENSE_STORE);store.clear();valid.forEach(e=>store.put(e));
     tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
   });
   expenses=await dbGetAll();
   expenses.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.time||'').localeCompare(String(a.time||''))||Number(b.id)-Number(a.id));
   renderHome();renderSummary();renderHistory();toast('Backup restored successfully');
 }catch(err){alert('Could not restore backup: '+(err.message||'Invalid file'));}
 finally{event.target.value='';}
});
document.getElementById('searchInput').addEventListener('input',renderHistory);document.getElementById('monthFilter').addEventListener('change',renderHistory);
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1900)}
renderCategories();
initialiseStorage().then(()=>{renderHome();renderSummary();renderHistory();});

const voicePanel = document.getElementById('voicePanel');
const voiceStatus = document.getElementById('voiceStatus');
const recordBtn = document.getElementById('recordBtn');
const recordLabel = document.getElementById('recordLabel');
const voiceTranscript = document.getElementById('voiceTranscript');
const parseVoiceBtn = document.getElementById('parseVoiceBtn');
let mediaRecorder = null, recordedChunks = [], activeStream = null, asrReady = false, asrLoading = false;
const asrWorker = new Worker('./sherpa-worker.js');
asrWorker.onmessage = (event) => {
 const msg = event.data || {};
 if (msg.type === 'progress') {
   voiceStatus.textContent = msg.message || 'Preparing offline voice recognition…';
 } else if (msg.type === 'ready') {
   asrReady = true; asrLoading = false; recordBtn.disabled = false;
   recordLabel.textContent = 'TAP TO RECORD';
   voiceStatus.textContent = 'Ready. Speak clearly in English. Your audio stays on this device.';
 } else if (msg.type === 'error') {
   asrLoading = false; recordBtn.disabled = !asrReady; recordLabel.textContent = asrReady ? 'TAP TO RECORD AGAIN' : 'VOICE ENGINE ERROR';
   voiceStatus.textContent = msg.message || 'Could not load the offline voice engine. Connect to the internet and try again.';
 } else if (msg.type === 'result') {
   voiceTranscript.value = (msg.text || '').trim();
   voiceStatus.textContent = voiceTranscript.value ? 'Transcription complete. Correct anything needed, then review the expense.' : 'I could not recognise that recording. Try speaking a little closer to the phone.';
   parseVoiceBtn.disabled = !voiceTranscript.value;
   recordBtn.disabled = false; recordLabel.textContent = 'TAP TO RECORD AGAIN';
 }
};
asrWorker.onerror = () => {
 asrLoading = false; recordBtn.disabled = true;
 voiceStatus.textContent = 'The offline speech engine could not start. Reload SpendSnap and try again.';
};
function initializeASR(){
 if(asrReady || asrLoading) return;
 asrLoading = true; recordBtn.disabled = true;
 voiceStatus.textContent = 'Preparing Sherpa-ONNX. First setup downloads about 40 MB; it will be cached for offline use.';
 recordLabel.textContent = 'DOWNLOADING / LOADING';
 asrWorker.postMessage({type:'init'});
}
document.getElementById('openVoiceBtn').addEventListener('click',()=>{
 voicePanel.classList.add('open'); initializeASR();
});
document.getElementById('closeVoiceBtn').addEventListener('click',closeVoice);
voicePanel.addEventListener('click',e=>{if(e.target===voicePanel)closeVoice()});
function closeVoice(){
 if(mediaRecorder && mediaRecorder.state==='recording') mediaRecorder.stop();
 if(activeStream) activeStream.getTracks().forEach(t=>t.stop());
 activeStream=null; voicePanel.classList.remove('open');
}
async function decodeAndResample(blob){
 const AudioCtx=window.AudioContext||window.webkitAudioContext;
 if(!AudioCtx) throw new Error('Audio decoding is not supported in this browser.');
 const ctx=new AudioCtx();
 try{
   const audio=await ctx.decodeAudioData(await blob.arrayBuffer());
   const mono=new Float32Array(audio.length);
   for(let ch=0;ch<audio.numberOfChannels;ch++){
     const data=audio.getChannelData(ch);
     for(let i=0;i<data.length;i++) mono[i]+=data[i]/audio.numberOfChannels;
   }
   if(audio.sampleRate===16000) return mono;
   const ratio=audio.sampleRate/16000, out=new Float32Array(Math.floor(mono.length/ratio));
   for(let i=0;i<out.length;i++){
     const a=Math.floor(i*ratio), b=Math.min(mono.length,Math.max(a+1,Math.floor((i+1)*ratio)));
     let sum=0; for(let j=a;j<b;j++) sum+=mono[j]; out[i]=sum/(b-a);
   }
   return out;
 } finally { await ctx.close(); }
}
recordBtn.addEventListener('click',async()=>{
 if(!asrReady){initializeASR();return;}
 if(mediaRecorder && mediaRecorder.state==='recording'){mediaRecorder.stop();return;}
 if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){
   voiceStatus.textContent='Microphone recording is not supported here. Open SpendSnap in Chrome over HTTPS.';return;
 }
 try{
   activeStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1, echoCancellation:true, noiseSuppression:true, autoGainControl:true}});
   recordedChunks=[];
   const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':(MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'');
   mediaRecorder=new MediaRecorder(activeStream,mime?{mimeType:mime}:undefined);
   mediaRecorder.ondataavailable=e=>{if(e.data && e.data.size)recordedChunks.push(e.data)};
   mediaRecorder.onstop=async()=>{
     if(activeStream) activeStream.getTracks().forEach(t=>t.stop()); activeStream=null;
     recordBtn.classList.remove('recording');recordBtn.textContent='🎙';recordBtn.disabled=true;
     recordLabel.textContent='TRANSCRIBING LOCALLY';
     voiceStatus.textContent='Processing your recording on this device…';
     try{
       const blob=new Blob(recordedChunks,{type:mediaRecorder.mimeType||'audio/webm'}); recordedChunks=[];
       const samples=await decodeAndResample(blob);
       if(!samples.length) throw new Error('No audio was captured. Please try again.');
       asrWorker.postMessage({type:'transcribe',samples},[samples.buffer]);
     }catch(err){recordBtn.disabled=false;recordLabel.textContent='TAP TO RECORD AGAIN';voiceStatus.textContent=err.message||'Could not process this recording. Try again.';}
   };
   mediaRecorder.start();recordBtn.classList.add('recording');recordBtn.textContent='■';recordLabel.textContent='TAP TO STOP';
   voiceStatus.textContent='Listening… Speak your expense in English, then tap stop.';
 }catch(err){voiceStatus.textContent='Microphone permission was not granted, or the microphone is unavailable. Check Chrome site permissions.';}
});
function setExtra(id,value){const el=document.getElementById('extra_'+id);if(el && value!==undefined && value!==null) el.value=value;}
function parseVoiceExpense(){
 const spoken=voiceTranscript.value.trim();
 if(!spoken){voiceStatus.textContent='No speech was recognised. Record again or enter the words above.';return;}
 const amountPattern=/(?:₹|\b(?:rs\.?|inr|rupees?)\s*)(\d[\d,]*(?:\.\d{1,2})?)/i;
 let amountMatch=spoken.match(amountPattern);
 if(!amountMatch) amountMatch=spoken.match(/\b(\d[\d,]*(?:\.\d{1,2})?)\b/);
 if(!amountMatch){voiceStatus.textContent='I could not find the amount. Please say an amount, for example “850 rupees”.';return;}
 let category='other'; const lower=spoken.toLowerCase();
 if(/petrol|fuel|diesel|gas station|litre|liter/.test(lower)) category='petrol';
 else if(/bike|motorcycle|service|engine oil|repair|tyre|tire|chain lube/.test(lower)) category='bike';
 else if(/food|lunch|dinner|breakfast|snack|coffee|tea|restaurant|meal|biriyani|biryani/.test(lower)) category='food';
 else if(/amazon|flipkart|online order|ordered|shopping|purchase|bought/.test(lower)) category='online';
 const amount=Number(amountMatch[1].replace(/,/g,''));
 if(!Number.isFinite(amount)||amount<=0){voiceStatus.textContent='The amount does not look valid. Please correct the sentence.';return;}
 const clean=spoken.replace(amountMatch[0],'').replace(/\s+/g,' ').trim();
 openEntry(category);
 document.getElementById('amount').value=amount.toFixed(2).replace(/\.00$/,'');
 document.getElementById('note').value=clean.slice(0,100);
 if(category==='online'){
   const item=spoken.match(/(?:ordered|bought|purchased)\s+(.+?)\s+(?:from|on)\s+/i);
   const store=spoken.match(/\b(?:from|on)\s+(amazon|flipkart|myntra|meesho|ajio|tatacliq)\b/i);
   setExtra('item',item?item[1]:clean.slice(0,70));setExtra('store',store?store[1]:undefined);
 }else if(category==='petrol'){
   const litres=spoken.match(/(\d+(?:\.\d+)?)\s*(?:litres?|liters?|l\b)/i);
   const odo=spoken.match(/(?:odometer\s*(?:is|at)?\s*|\b)(\d[\d,]{2,})\s*(?:km|kilomet(?:er|re)s?)/i);
   setExtra('litres',litres?litres[1]:undefined);setExtra('odometer',odo?odo[1].replace(/,/g,''):undefined);
 }else if(category==='bike'){
   let type='Other'; if(/service/.test(lower))type='Service';else if(/repair|puncture/.test(lower))type='Repairs';else if(/accessor|helmet|glove|bag/.test(lower))type='Accessories';else if(/maintenance|oil|chain|brake|tyre|tire/.test(lower))type='Maintenance';
   setExtra('bikeType',type);setExtra('item',clean.slice(0,90));
 }else if(category==='food'){
   let meal='Other'; if(/breakfast|morning/.test(lower))meal='Breakfast';else if(/lunch/.test(lower))meal='Lunch';else if(/dinner|supper/.test(lower))meal='Dinner';else if(/snack/.test(lower))meal='Snacks';else if(/coffee|tea|juice|drink/.test(lower))meal='Drinks';
   setExtra('meal',meal);
   const place=spoken.match(/\b(?:at|from)\s+([A-Z][\w&' -]{2,})/);setExtra('place',place?place[1].slice(0,45):undefined);
 }else{setExtra('item',clean.slice(0,90));}
 voicePanel.classList.remove('open');toast('Review the details, then save');
}
parseVoiceBtn.addEventListener('click',parseVoiceExpense);
parseVoiceBtn.disabled=true;
voiceTranscript.addEventListener('input',()=>{parseVoiceBtn.disabled=!voiceTranscript.value.trim();});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
 navigator.serviceWorker.register('./service-worker.js').catch(err=>console.warn('Service worker registration failed:',err));
}
