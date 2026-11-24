/* MotoTrip V9.23 — startup readiness for mobile PWA. */
(() => {
 'use strict';
 const root=document.documentElement;
 const cover=document.getElementById('mt923-boot-cover');
 const retry=document.getElementById('mt923-boot-retry');
 if(retry)retry.addEventListener('click',()=>location.reload());
 let released=false;
 function finish(){
  if(released)return;
  const essentials=typeof window.renderSplit==='function' && typeof window.refreshRoute==='function' &&
    typeof window.MotoTripUI==='object' &&
    document.querySelector('#main-nav button[data-tab="plan"]') &&
    document.querySelector('#mt80-distance') &&
    document.querySelector('#mt80-price');
  // The account gate can remain locked by design until login/profile verification,
  // but its actual dialog must be visible. Never unlock it from this helper.
  const gate=document.getElementById('mt-account-overlay');
  const gateReady=!root.classList.contains('mt-entry-locked') || (gate && !gate.hidden);
  if(!essentials || !gateReady){
   root.classList.add('mt923-boot-error');
   const label=document.getElementById('mt923-boot-label');
   if(label)label.textContent='App could not finish loading. Tap Reload MotoTrip.';
   return;
  }
  released=true;
  root.classList.remove('mt923-boot-error','mt923-booting');
  if(cover)cover.setAttribute('aria-hidden','true');
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',finish,{once:true});
 else finish();
 window.addEventListener('pageshow',()=>{
  if(!released)finish();
  // WebKit restores tabs from memory without firing DOMContentLoaded/input.
  // Refresh read-only summaries without deleting drafts or user data.
  if(released){
   try { if(typeof window.renderSplit==='function')window.renderSplit(); }catch(error){console.error('MotoTrip resume: split',error);}
  }
 });
})();
