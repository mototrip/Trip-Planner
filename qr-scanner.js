/* MotoTrip V5.4 QR scanner – © 2026 Satish Kumar Gupta.
 * Uses camera only after a user click. jsQR is Apache-2.0 licensed (Cosmo Wolfe).
 * QR frame data stays in the browser; no images are uploaded.
 * Library loaded on demand for browsers without BarcodeDetector (including iOS Safari).
 */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const panel=$('shared-scanner-panel'), toggle=$('shared-scan-toggle');
  const video=$('shared-scan-video'), status=$('shared-scanner-status');
  if(!panel||!toggle||!video||!status)return;
  const CANONICAL_PATH=/^\/Trip-Planner\/(?:index\.html)?$/;
  const idPattern=/^[a-f0-9]{32}$/i;
  let stream=null, scanning=false, frame=0, run=0, lastFrame=0;
  let detector=null, libraryPromise=null, decoderReady=false;
  let canvas=null, ctx=null;
  function setStatus(text){status.textContent=text;}
  function parseInvite(text){
    const value=String(text||'').trim();
    if(idPattern.test(value))return value.toLowerCase();
    let u;
    try{u=new URL(value);}catch(_){return '';}
    if(u.protocol!=='https:'||u.origin!==location.origin||!CANONICAL_PATH.test(u.pathname))return '';
    const match=u.hash.match(/^#join=([a-f0-9]{32})$/i);
    return match?match[1].toLowerCase():'';
  }
  function stop(){
    run++;
    scanning=false;
    if(frame){cancelAnimationFrame(frame);frame=0;}
    if(stream){for(const track of stream.getTracks())track.stop();stream=null;}
    video.pause();video.srcObject=null;
    panel.hidden=true;toggle.querySelector('.qr-scan-copy strong').textContent='Scan QR Code';toggle.setAttribute('aria-expanded','false');
  }
  function success(value){
    const invite=parseInvite(value);
    if(!invite){setStatus('This QR is not a MotoTrip Shared Ride invitation. Try another QR.');return false;}
    $('shared-code').value=invite;
    stop();
    const msg=$('shared-message');
    msg.textContent='✓ QR scanned! Enter your rider name, then tap Join Shared Ride.';
    msg.style.color='';
    $('shared-code').scrollIntoView({behavior:'smooth',block:'nearest'});
    return true;
  }
  async function chooseDetector(){
    if(typeof BarcodeDetector!=='function')return null;
    try{
      if(typeof BarcodeDetector.getSupportedFormats==='function'){
        const supported=await BarcodeDetector.getSupportedFormats();
        if(!supported.includes('qr_code'))return null;
      }
      return new BarcodeDetector({formats:['qr_code']});
    }catch(_){return null;}
  }
  async function loadDecoder(){
    if(typeof window.jsQR==='function'){decoderReady=true;return;}
    if(libraryPromise)return libraryPromise;
    libraryPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      script.async=true;
      script.onload=()=>typeof window.jsQR==='function'?resolve():reject(Error('QR decoder could not load.'));
      script.onerror=()=>reject(Error('QR scanner library unavailable. Check internet and try again.'));
      document.head.append(script);
    });
    try{await libraryPromise;decoderReady=true;}catch(e){libraryPromise=null;throw e;}
  }
  function captureFrame(source,maxSide=700){
    const width=source.videoWidth||source.naturalWidth||source.width;
    const height=source.videoHeight||source.naturalHeight||source.height;
    if(!width||!height)return null;
    const factor=Math.min(1,maxSide/Math.max(width,height));
    const w=Math.max(1,Math.floor(width*factor)),h=Math.max(1,Math.floor(height*factor));
    if(!canvas)canvas=document.createElement('canvas');
    if(canvas.width!==w)canvas.width=w;
    if(canvas.height!==h)canvas.height=h;
    if(!ctx)ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)return null;
    ctx.drawImage(source,0,0,w,h);
    return ctx.getImageData(0,0,w,h);
  }
  function decodePixels(image){
    if(!decoderReady||!image)return null;
    const result=window.jsQR(image.data,image.width,image.height,{inversionAttempts:'attemptBoth'});
    return result?.data||null;
  }
  async function detect(source){
    if(detector){
      try{
        const found=await detector.detect(source);
        if(found?.length)return found[0].rawValue;
      }catch(_){ /* Fallback to local jsQR. */ }
    }
    if(!decoderReady&&detector){
      // Some browsers expose a detector but cannot decode image sources.
      // An online fallback can be loaded once and reused.
      await loadDecoder().catch(()=>{});
    }
    return decodePixels(captureFrame(source, source instanceof HTMLVideoElement ? 700 : 1500));
  }
  async function tick(timestamp,session){
    if(!scanning||session!==run)return;
    frame=requestAnimationFrame(next=>tick(next,session));
    if(timestamp-lastFrame<230||video.readyState<2)return;
    lastFrame=timestamp;
    try{
      const code=await detect(video);
      if(code&&scanning&&session===run)success(code);
    }catch(_){ /* Low-light frames are normal, keep scanning. */ }
  }
  async function start(){
    if(scanning){stop();return;}
    stop();const session=run;
    panel.hidden=false;toggle.setAttribute('aria-expanded','true');toggle.querySelector('.qr-scan-copy strong').textContent='Close Scanner';
    setStatus('Opening your camera… Allow access when prompted.');
    try{
      if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('Camera scanning needs Safari/Chrome on HTTPS and camera permission.');
      detector=await chooseDetector();
      if(!detector){setStatus('Loading scanner…');await loadDecoder();}
      if(session!==run)return;
      const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
      if(session!==run){media.getTracks().forEach(t=>t.stop());return;}
      stream=media;
      video.srcObject=stream;
      await video.play();
      if(session!==run)return;
      scanning=true;lastFrame=0;
      setStatus('Point the rear camera at the MotoTrip invite QR code.');
      frame=requestAnimationFrame(t=>tick(t,session));
    }catch(e){
      if(session!==run)return;
      const reason=e?.name==='NotAllowedError'?'Camera permission denied. Allow camera in browser settings or paste an invite link.':e?.name==='NotFoundError'?'No camera found. Paste an invite link instead.':String(e?.message||'Could not open camera.');
      stop();
      $('shared-message').textContent=reason;
      $('shared-message').style.color='#ffe1ba';
    }
  }
  toggle.addEventListener('click',start);
  $('shared-scan-stop').addEventListener('click',stop);
  document.querySelectorAll('nav button[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    if(btn.dataset.tab!=='split')stop();
  }));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')stop();});
  window.addEventListener('pagehide',stop);
  // Expose only a minimal parser for automated validation; never accept arbitrary QR URLs.
  window.MotoTripInviteScanner={parseInvite,stop};
})();
