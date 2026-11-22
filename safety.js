/* MotoTrip V6.6 Group Safety — opt-in GPS watch, best-effort background, last-known location.
 * © 2026 Satish Kumar Gupta. No location is shared before explicit rider consent.
 * Browser/OS may suspend GPS when PWA is hidden. No service-worker background GPS.
 */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const box = $('mt-safety-panel');
 if (!box) return;
 const shareInfo = $('mt-safety-share-info');
 const btnLocation = $('mt-safety-location-btn');
 const status = $('mt-safety-status');
 const roster = $('mt-safety-riders');
 const count = $('mt-safety-count');
 const joinLiveBtn = $('mt66-live-start');
 const joinLivePanel = $('mt66-live-join');
 const everyMs = 30000;
 const cloudTimeout = (promise, label) => {
  let timer;
  return Promise.race([promise,new Promise((_, reject) => {
   timer=setTimeout(()=>reject(new Error(label+' did not finish. Confirm internet connection and retry.')),12000);
  })]).finally(()=>clearTimeout(timer));
 };
 const staleAfterMs = 120000;
 let context = null, unsubscribe = null, gpsTimer = null, gpsWatchId = null, gpsActive = false;
 let locationBusy = false, detailsBusy = false, mySafety = null;
 let locationPending = null, trackingEpoch = 0, lastPublishedAt = 0;
 let refreshTimer = null, generation = 0, lastCards = [];
 const bloodTypes = new Set(['','A+','A-','B+','B-','AB+','AB-','O+','O-']);
 const clean = (x, max = 80) => String(x || '').trim().slice(0, max);
 const errorText = e => String(e?.message || e || 'Unknown error').slice(0, 200);
 function say(s, bad = false) {status.textContent = s;status.style.color = bad ? '#b42640' : '';}
 function profile() {
  let scope = 'guest';
  try {scope=localStorage.getItem('mototrip-account-scope') || 'guest';}catch(_){/* Storage disabled */}
  try {
   const p = JSON.parse(localStorage.getItem('mototrip-rider-profile-v1-' + scope) || '{}');
   return p && typeof p === 'object' ? p : {};
  }catch(_) {return {};}
 }
 function riderName() {
  const p=profile();
  return clean(p.name || $('shared-name')?.value || 'Rider') || 'Rider';
 }
 function blank(uid) {
  return {uid,name:riderName(),emergencyShared:false,blood:'',emergencyName:'',emergencyPhone:'',
   locationShared:false,latitude:null,longitude:null,accuracy:null,locationUpdatedAt:'',updatedAt:new Date().toISOString()};
 }
 const currentRef = () => context?.dbM.doc(context.db,'sharedRides',context.rideId,'safety',context.uid);
 const listRef = () => context?.dbM.collection(context.db,'sharedRides',context.rideId,'safety');
 function validContext() {
  const c=window.motoTripSharedRide?.safetyContext?.();
  return c && context && c.rideId === context.rideId && c.uid === context.uid;
 }
 function sanitizedProfile(p) {
  const phone=clean(p.icePhone,22);
  return {name:riderName(),blood:bloodTypes.has(p.blood) ? p.blood : '',
   emergencyName:clean(p.iceName),emergencyPhone:/^[+0-9() .-]{7,22}$/.test(phone)?phone:''};
 }
 function infoFields(d) {
  if (!d.emergencyShared) return {...d,blood:'',emergencyName:'',emergencyPhone:''};
  return d;
 }
 function locationFields(d) {
  if (!d.locationShared) return {...d,latitude:null,longitude:null,accuracy:null,locationUpdatedAt:''};
  return d;
 }
 async function writeSafety(next, epoch = null) {
  if (!validContext()) throw Error('Join a Shared Ride first.');
  const ref=currentRef();
  const old=await cloudTimeout(context.dbM.getDoc(ref),'Reading safety settings');
  if(!validContext() || (epoch !== null && (epoch !== trackingEpoch || !gpsActive)))return;
  const merged={...(old.exists()?old.data():blank(context.uid)),...next,
   uid:context.uid,updatedAt:new Date().toISOString()};
  const safe=locationFields(infoFields(merged));
  if (!safe.emergencyShared && !safe.locationShared) {
   if (old.exists())await cloudTimeout(context.dbM.deleteDoc(ref),'Clearing shared safety data');
   mySafety=null;
   return;
  }
  await cloudTimeout(context.dbM.setDoc(ref,safe),'Saving shared safety data');
  mySafety=safe;
 }
 function setLocationButton() {
  btnLocation.textContent = gpsActive ? '✕ Stop Sharing Location' : '📍 Share My Location';
  btnLocation.classList.toggle('is-live', gpsActive);
  btnLocation.setAttribute('aria-pressed', String(gpsActive));
  if(joinLivePanel){
   joinLivePanel.hidden=!context;
   joinLivePanel.classList.toggle('is-live',gpsActive);
  }
  if(joinLiveBtn){
   joinLiveBtn.textContent=gpsActive?'✓ Sharing ON · Manage':'📍 Start Live Location';
   joinLiveBtn.setAttribute('aria-pressed',String(gpsActive));
  }
 }
 function localClock(timestamp){
  const d=new Date(timestamp);
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}) : 'Unknown time';
 }
 function freshTime(timestamp) {
  const ms=Date.parse(timestamp);
  return Number.isFinite(ms) && ms <= Date.now()+60000 && Date.now()-ms <= staleAfterMs;
 }
 function el(tag, className, txt) {
  const n=document.createElement(tag);
  if(className)n.className=className;
  if(txt!==undefined)n.textContent=txt;
  return n;
 }
 function tag(parent, text){parent.append(el('span','mt-safety-tag',text));}
 function render(list) {
  roster.replaceChildren();
  const entries=list.filter(d=>d && (d.emergencyShared === true || d.locationShared === true));
  count.textContent=entries.length+' sharing';
  if (!entries.length){roster.append(el('p','mt-safety-empty','No rider has enabled safety sharing yet.'));return;}
  for(const d of entries){
   const card=el('article','mt-safety-rider');
   const head=el('div','mt-safety-rider-head');
   head.append(el('strong','',clean(d.name)||'Rider'),el('span','',d.uid===context?.uid?'You':'Ride member'));
   card.append(head);
   const badges=el('div','mt-safety-tags');
   if(d.emergencyShared){
    tag(badges,'🩸 Blood: '+(bloodTypes.has(d.blood)&&d.blood?d.blood:'Not provided'));
    if(d.emergencyName)tag(badges,'Emergency: '+clean(d.emergencyName));
    if(d.emergencyPhone)tag(badges,'☎ '+clean(d.emergencyPhone,22));
   }
   if(d.locationShared){
    const valid = Number.isFinite(d.latitude)&&Number.isFinite(d.longitude)&&Math.abs(d.latitude)<=90&&Math.abs(d.longitude)<=180;
    const fresh=freshTime(d.locationUpdatedAt);
    tag(badges, valid ? (fresh ? '🟢 Latest GPS · '+localClock(d.locationUpdatedAt) : '🕘 Last location · '+localClock(d.locationUpdatedAt)):'Location unavailable');
    if(valid && Number.isFinite(d.accuracy)) tag(badges,'GPS accuracy ≈ '+Math.round(d.accuracy)+' m');
   }
   card.append(badges);
   const links=el('div','mt-safety-links');
   if(d.emergencyShared && /^[+0-9() .-]{7,22}$/.test(d.emergencyPhone || '')) {
    const phone=d.emergencyPhone.replace(/[^+0-9]/g,'');
    if(/^[+]?[0-9]{7,15}$/.test(phone)) {
     const call=el('a','','📞 Call emergency contact');
     call.href='tel:'+phone;call.setAttribute('aria-label','Call emergency contact for '+clean(d.name));
     links.append(call);
    }
   }
   if(d.locationShared && Number.isFinite(d.latitude)&&Number.isFinite(d.longitude)
      && Math.abs(d.latitude)<=90&&Math.abs(d.longitude)<=180){
    const coords=d.latitude.toFixed(6)+','+d.longitude.toFixed(6);
    const isFresh=freshTime(d.locationUpdatedAt);
    const map=el('a','',isFresh?'🧭 Navigate to rider':'🗺️ View last location');
    map.href=isFresh
     ? 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(coords)+'&travelmode=driving'
     : 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(coords);
    map.target='_blank';map.rel='noopener noreferrer';links.append(map);
   }
   if(links.childNodes.length)card.append(links);
   if(d.locationShared && !freshTime(d.locationUpdatedAt))card.append(el('p','mt-safety-stale','Last known location only — updates may be paused because the app is backgrounded, closed, offline or the phone is off. Not live.'));
   roster.append(card);
  }
 }
 function initRoster() {
  if (unsubscribe){unsubscribe();unsubscribe=null;}
  const g=++generation;
  try {
   unsubscribe=context.dbM.onSnapshot(listRef(),snap=>{
    if(g!==generation)return;
    const items=snap.docs.map(doc=>doc.data());
    lastCards=items;
    mySafety=items.find(d=>d.uid===context.uid)||null;
    shareInfo.checked=Boolean(mySafety?.emergencyShared);
    render(items);
   },e=>{if(g!==generation)return;say('Safety cards unavailable: '+errorText(e)+'. Check updated Firestore Rules.',true);});
  } catch(e){say('Safety setup failed: '+errorText(e),true);}
 }
 // A rider explicitly opts in for this specific account + ride until Stop or Leave.
 // No blanket location sharing for newly joined members.
 function preferenceKey(){return context?'mototrip-live-location-v66-'+context.uid+'-'+context.rideId:'';}
 function pendingStopKey(){return context?'mototrip-location-stop-v66-'+context.uid+'-'+context.rideId:'';}
 function optedIn(){try{return !!preferenceKey() && localStorage.getItem(preferenceKey())==='yes';}catch(_){return false;}}
 function setOptIn(on){try{if(on)localStorage.setItem(preferenceKey(),'yes');else localStorage.removeItem(preferenceKey());}catch(_){/* storage unavailable */}}
 function markPendingStop(on){try{if(on)localStorage.setItem(pendingStopKey(),'yes');else localStorage.removeItem(pendingStopKey());}catch(_){/* storage unavailable */}}
 function needsStop(){try{return !!pendingStopKey() && localStorage.getItem(pendingStopKey())==='yes';}catch(_){return false;}}
 function stopTimer(){
  trackingEpoch++;
  if(gpsTimer!==null){clearInterval(gpsTimer);gpsTimer=null;}
  if(gpsWatchId!==null){try{navigator.geolocation.clearWatch(gpsWatchId);}catch(_){}gpsWatchId=null;}
  gpsActive=false;setLocationButton();
 }
 async function syncPendingStop(){
  if(!validContext() || !needsStop())return;
  try{
   await writeSafety({locationShared:false,latitude:null,longitude:null,accuracy:null,locationUpdatedAt:''});
   markPendingStop(false);
   say('✓ Location sharing stopped and cloud coordinates removed.');
  }catch(e){say('Sharing is OFF on this phone. Cloud removal pending: connect to the internet. '+errorText(e),true);}
 }
 async function stopLocation(notify = true){
  setOptIn(false);
  markPendingStop(true);
  stopTimer();
  if(!validContext())return;
  // Let an in-flight GPS write settle before clearing it, so a late write does not re-share.
  if(locationPending)try{await Promise.race([locationPending.catch(()=>{}),new Promise(r=>setTimeout(r,14000))]);}catch(_){}
  await syncPendingStop();
  if(notify&&!needsStop())say('✓ Location sharing is OFF. Your last GPS location was removed from the group.');
 }
 function gpsError(e){
  if(!gpsActive)return;
  if(e?.code===1){void stopLocation(false);say('GPS permission denied. Sharing is OFF; cloud removal will be retried if necessary.',true);return;}
  say('GPS is temporarily unavailable. Last location remains with its time; updates resume when GPS is available.',true);
 }
 async function postPosition(position = null, force = false){
  if(!gpsActive || locationBusy || !validContext())return;
  if(!force && lastPublishedAt && Date.now()-lastPublishedAt<18000)return;
  const epoch=trackingEpoch;
  locationBusy=true;
  try{
   const pos=position||await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,
    {enableHighAccuracy:true,timeout:17000,maximumAge:8000}));
   if(!gpsActive || epoch!==trackingEpoch || !validContext())return;
   const lat=Number(pos.coords.latitude),lon=Number(pos.coords.longitude),acc=Number(pos.coords.accuracy);
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('Invalid GPS coordinates.');
   const gpsTime=Number(pos.timestamp)||Date.now();
   // Never make cached/stale GPS appear fresh by replacing its actual fix time with now.
   if(gpsTime>Date.now()+60000||Date.now()-gpsTime>90000)throw Error('GPS fix is old; keeping the previous timestamp.');
   locationPending=writeSafety({name:riderName(),locationShared:true,latitude:lat,longitude:lon,
    accuracy:Number.isFinite(acc)?Math.max(0,Math.min(100000,acc)):0,
    locationUpdatedAt:new Date(gpsTime).toISOString()},epoch);
   await locationPending;
   if(!gpsActive||epoch!==trackingEpoch||!validContext())return;
   lastPublishedAt=Date.now();
   say('✓ Live sharing ON · latest GPS '+localClock(new Date(gpsTime).toISOString())+'. Background updates depend on phone/browser permissions.');
  }catch(e){
   gpsError(e);
  }finally{locationPending=null;locationBusy=false;}
 }
 function armWatcher(){
  if(!gpsActive || gpsWatchId!==null || !validContext())return;
  // watchPosition is best-effort in a background browser, NOT a native background service.
  try{
   gpsWatchId=navigator.geolocation.watchPosition(pos=>{void postPosition(pos);},gpsError,
    {enableHighAccuracy:true,timeout:25000,maximumAge:8000});
  }catch(e){say('GPS watcher unavailable: '+errorText(e),true);}
 }
 async function startLocation(resume = false){
  if(gpsActive){if(!resume)await stopLocation();return;}
  if(!validContext()){say('Join Shared Ride before sharing location.',true);return;}
  if(!navigator.geolocation){say('Location access is unavailable in this browser.',true);return;}
  if(!window.isSecureContext){say('Location sharing requires HTTPS.',true);return;}
  if(needsStop()){await syncPendingStop();if(needsStop())return;}
  if(!resume && !confirm('Start sharing your GPS with current and future members of this Shared Ride? MotoTrip will try to update while running (including in background when supported). Phone browsers may pause location when hidden or closed; others will see your LAST location and time. Sharing resumes when you reopen until you tap Stop or leave. Continue?'))return;
  // Save the explicit, ride-scoped choice before requesting permission so accidental
  // app suspension does not reset it. Permission denied will revoke this preference.
  setOptIn(true);
  trackingEpoch++;
  gpsActive=true;lastPublishedAt=0;setLocationButton();
  say(resume?'Resuming your previously approved GPS sharing…':'Requesting GPS permission…');
  armWatcher();
  await postPosition(null,true);
  if(gpsActive && gpsTimer===null)gpsTimer=setInterval(()=>{void postPosition(null,true);},everyMs);
 }
 async function toggleEmergency(){
  if(detailsBusy)return;
  if(!validContext()){shareInfo.checked=false;say('Join a Shared Ride first.',true);return;}
  const checked=shareInfo.checked;
  const fields=sanitizedProfile(profile());
  if(checked && !fields.blood && !fields.emergencyPhone){
   shareInfo.checked=false;
   say('First fill your emergency number and/or blood group in My Profile.',true);
   $('mt-account-open')?.click();return;
  }
  if(checked && !confirm('Share your blood group and emergency contact with all current Shared Ride members? This information is sensitive. You can turn it off later.')){
   shareInfo.checked=false;return;
  }
  detailsBusy=true;shareInfo.disabled=true;
  try {
   await writeSafety({name:fields.name,emergencyShared:checked,
    blood:checked?fields.blood:'',emergencyName:checked?fields.emergencyName:'',
    emergencyPhone:checked?fields.emergencyPhone:''});
   say(checked?'✓ Your emergency info is visible to joined riders.':'✓ Emergency info removed from Shared Ride.');
  }catch(e){shareInfo.checked=!checked;say('Could not update emergency info: '+errorText(e),true);}
  finally{detailsBusy=false;shareInfo.disabled=false;}
 }
 async function removeMySafety(){
  setOptIn(false);markPendingStop(false);stopTimer();
  if(!validContext())return;
  const ref=currentRef();
  const record=await cloudTimeout(context.dbM.getDoc(ref),'Checking shared safety data');
  if(record.exists())await cloudTimeout(context.dbM.deleteDoc(ref),'Removing shared safety data');
 }
 function clearLocal(){
  ++generation;
  if(unsubscribe){unsubscribe();unsubscribe=null;}
  stopTimer();
  context=null;mySafety=null;lastCards=[];
  shareInfo.checked=false;roster.replaceChildren();
  count.textContent='0 sharing';
 }
 function onRideChange(){
  const next=window.motoTripSharedRide?.safetyContext?.();
  if(next && context?.uid===next.uid && context?.rideId===next.rideId)return;
  clearLocal();
  if(next){
   context=next;initRoster();setLocationButton();
   if(needsStop())void syncPendingStop();
   else if(optedIn())void startLocation(true);
   else say('New ride: live location is OFF. Tap Start Live Location to share your GPS.');
  }
 }
 // Never clear a location just because the app goes into the background.
 // iOS and other browsers can suspend JS/GPS regardless of our preferences.
 document.addEventListener('visibilitychange',()=>{
  if(!gpsActive)return;
  if(document.hidden){say('Location sharing is ON. Background GPS may pause on this device; group members can view your last timestamped location.');}
  else {armWatcher();void postPosition(null,true);}
 });
 window.addEventListener('pageshow',()=>{
  if(!gpsActive && validContext() && optedIn())void startLocation(true);
  else if(gpsActive)void postPosition(null,true);
 });
 window.addEventListener('pagehide',()=>{
  // Discard only this page's watcher. Do NOT revoke the cloud safety record.
  // Last position remains visible with a stale label until sharing resumes.
  stopTimer();
 });
 window.addEventListener('online',()=>{
  if(needsStop())void syncPendingStop();
  else if(gpsActive)void postPosition(null,true);
 });
 shareInfo.addEventListener('change',toggleEmergency);
 btnLocation.addEventListener('click',()=>{void startLocation();});
 joinLiveBtn?.addEventListener('click',()=>{
  box.open=true;
  if(gpsActive){box.scrollIntoView({behavior:'smooth',block:'nearest'});return;}
  void startLocation();
 });
 window.addEventListener('mototrip-ride-change',onRideChange);
 window.addEventListener('mototrip-profile-updated',async()=>{
  if(!validContext() || !mySafety?.emergencyShared)return;
  const fields=sanitizedProfile(profile());
  try {
   if(!fields.blood && !fields.emergencyPhone){
    await writeSafety({emergencyShared:false,blood:'',emergencyName:'',emergencyPhone:''});
    say('Your emergency details were cleared from the group because your profile no longer contains them.');
   }else{
    await writeSafety({...fields,emergencyShared:true});
    say('✓ Updated emergency info shared with your ride.');
   }
  }catch(e){say('Profile changed locally, but group safety info could not update: '+errorText(e),true);}
 });
 // Time labels and stale warning need to update while the panel is visible.
 refreshTimer=setInterval(()=>{
  if(!document.hidden && context && box.open)render(lastCards);
 },60000);
 window.motoTripSafety={removeMySafety};
 onRideChange();
})();
