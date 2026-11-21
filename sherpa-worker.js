/* SpendSnap offline ASR worker. Sherpa-ONNX + English Zipformer, pinned model revision. */
const REV = '909bffc2f4de5447907a9fd25161dd1170324f1d';
const BASE = `https://huggingface.co/wundr-ai/zipformer-small-librispeech-en-wasm/resolve/${REV}`;
const FILES = [
  'sherpa-onnx-asr.js',
  'sherpa-onnx-wasm-main-asr-small.js',
  'sherpa-onnx-wasm-main-asr-small.wasm',
  'sherpa-onnx-wasm-main-asr-small.data'
];
const CACHE_NAME = 'spendsnap-sherpa-assets-v1';
let recognizer = null, initializing = false, ready = false;
let wasmUrl = '', dataUrl = '', moduleRef = null;
function post(type, extra={}) { self.postMessage({type, ...extra}); }
async function assetBlobUrl(file, index, total) {
  const url = `${BASE}/${file}`;
  const cache = await caches.open(CACHE_NAME);
  let response = await cache.match(url);
  if (!response) {
    post('progress', {message:`Downloading offline voice engine (${index+1}/${total}): ${file}…`});
    const network = await fetch(url, {mode:'cors', credentials:'omit'});
    if (!network.ok) throw new Error(`Could not download ${file} (HTTP ${network.status}). Check your internet connection and retry.`);
    const reader = network.body && network.body.getReader ? network.body.getReader() : null;
    let blob;
    if (reader) {
      const chunks=[]; let loaded=0;
      const length=Number(network.headers.get('content-length'))||0;
      while(true){
        const part=await reader.read(); if(part.done)break;
        chunks.push(part.value); loaded+=part.value.byteLength;
        if(length) post('progress',{message:`Downloading voice engine: ${file} (${Math.round(loaded/length*100)}%)`});
      }
      blob=new Blob(chunks,{type:network.headers.get('content-type')||'application/octet-stream'});
    } else blob=await network.blob();
    response=new Response(blob,{headers:{'Content-Type':blob.type||'application/octet-stream'}});
    await cache.put(url,response.clone());
  }
  const blob=await response.blob();
  return URL.createObjectURL(blob);
}
async function init(){
  if(ready){post('ready');return;}
  if(initializing)return;
  initializing=true;
  try{
    const urls={};
    for(let i=0;i<FILES.length;i++) urls[FILES[i]]=await assetBlobUrl(FILES[i],i,FILES.length);
    post('progress',{message:'Voice files are cached. Starting the local recognition engine…'});
    // The API wrapper must be present before the Emscripten module is initialized.
    importScripts(urls['sherpa-onnx-asr.js']);
    moduleRef={
      locateFile:(path)=>{
        if(path.endsWith('.wasm')) return urls['sherpa-onnx-wasm-main-asr-small.wasm'];
        if(path.endsWith('.data')) return urls['sherpa-onnx-wasm-main-asr-small.data'];
        return path;
      },
      onRuntimeInitialized:()=>{
        try{
          // The pinned WASM package preloads these exact files at the virtual FS root.
          // The previous build used encoder.onnx/decoder.onnx/joiner.onnx, which
          // do not exist in this package and caused the recognizer to fail at decode time.
          const requiredFiles = [
            '/transducer-encoder.onnx',
            '/transducer-decoder.onnx',
            '/transducer-joiner.onnx',
            '/tokens.txt'
          ];
          const exists = (path) => {
            const n = moduleRef.lengthBytesUTF8(path) + 1;
            const p = moduleRef._malloc(n);
            try {
              moduleRef.stringToUTF8(path, p, n);
              return moduleRef._SherpaOnnxFileExists(p) === 1;
            } finally {
              moduleRef._free(p);
            }
          };
          const missing = requiredFiles.filter(path => !exists(path));
          if (missing.length) {
            throw new Error('The downloaded model package is missing: ' + missing.join(', ') + '. Clear the old voice cache and retry.');
          }
          if (typeof moduleRef._SherpaOnnxCreateOfflineRecognizer !== 'function') {
            throw new Error('Sherpa WebAssembly API did not initialise correctly. Reload the app and retry.');
          }
          const config={
            featConfig:{sampleRate:16000,featureDim:80},
            modelConfig:{
              transducer:{
                encoder:'/transducer-encoder.onnx',
                decoder:'/transducer-decoder.onnx',
                joiner:'/transducer-joiner.onnx'
              },
              modelType:'transducer',
              tokens:'/tokens.txt',
              numThreads:2,
              provider:'cpu',
              debug:0
            },
            decodingMethod:'greedy_search',
            maxActivePaths:4
          };
          recognizer=new OfflineRecognizer(config,moduleRef);
          if (!recognizer || !recognizer.handle) {
            throw new Error('Sherpa could not create the English recognizer. Please clear the cached voice files and retry.');
          }
          ready=true;initializing=false;post('ready');
        }catch(err){initializing=false;post('error',{message:`Could not initialise the English model: ${err.message||err}`});}
      },
      onAbort:(reason)=>{initializing=false;post('error',{message:`Sherpa runtime stopped: ${reason||'unknown error'}`});}
    };
    self.Module=moduleRef;
    importScripts(urls['sherpa-onnx-wasm-main-asr-small.js']);
    // Some Emscripten builds finish initialization on the next task; onRuntimeInitialized handles it.
  }catch(err){initializing=false;post('error',{message:err.message||'Could not load the offline voice engine.'});}
}
self.onmessage=async(event)=>{
  const msg=event.data||{};
  if(msg.type==='init'){await init();return;}
  if(msg.type==='transcribe'){
    if(!ready||!recognizer){post('error',{message:'Voice engine is not ready yet. Please wait and try again.'});return;}
    try{
      post('progress',{message:'Recognising speech locally…'});
      const samples=msg.samples instanceof Float32Array?msg.samples:new Float32Array(msg.samples);
      if (!samples.length) throw new Error('The recording was empty. Please record again.');
      const stream=recognizer.createStream();
      if (!stream || !stream.handle) throw new Error('Sherpa could not create an audio stream. Reload SpendSnap and retry.');
      try {
        stream.acceptWaveform(16000,samples);
        recognizer.decode(stream);
        const result=recognizer.getResult(stream);
        post('result',{text:(result && result.text)||''});
      } finally {
        stream.free();
      }
    }catch(err){post('error',{message:`Speech recognition failed: ${err.message||err}`});}
  }
};
