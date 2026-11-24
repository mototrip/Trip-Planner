/* MotoTrip V7.4 Group Safety — emergency privacy sync + opt-in GPS, last-known location.
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
 const retryEmergencyButton = $('mt-safety-retry-removal');
 const gpsRetry = $('mt71-gps-retry');
 let startupProbe = null, queuedPosition = null;
 const everyMs = 30000;
 const cloudTimeout = (promise, label) => {
  let timer;
  return Promise.race([promise,new Promise((_, reject) => {
   timer=setTimeout(()=>reject(new Error(label+' did not finish. Confirm internet connection and retry.')),12000);
  })]).finally(()=>clearTimeout(timer));
 };
 const staleAfterMs = 120000;
 const gpsRetireKey=()=>context?'mototrip-gps-retired-v927-'+context.uid+'-'+context.rideId:'';
 let context = null, unsubscribe = null, gpsTimer = null, gpsWatchId = null, gpsActive = false;
 let locationBusy = false, detailsBusy = false, mySafety = null;
 let locationPending = null, trackingEpoch = 0, lastPublishedAt = 0;
 let refreshTimer = null, generation = 0, lastCards = [], rosterReady = false;
 let nextEmergencyRetryAt = 0;
 const bloodTypes = new Set(['','A+','A-','B+','B-','AB+','AB-','O+','O-']);
 const clean = (x, max = 80) => String(x || '').trim().slice(0, max);
 const errorText = e => {
  if(e?.code==='permission-denied')return 'Firestore permission denied. Owner: publish full FIREBASE_RULES.txt in Firebase Console → Firestore → Rules. Verify you joined this ride with the same signed-in account.';
  return String(e?.message || e || 'Unknown error').slice(0, 200);
 };
 function say(s, bad = false) {status.textContent = s;status.style.color = bad ? '#b42640' : '';}
 function profile() {
  let scope = 'guest';
  try {scope=localStorage.getItem('mototrip-account-scope') || 'guest';}catch(_){/* Storage disabled */}
  try {
   const p = JSON.parse(localStorage.getItem('mototrip-rider-profile-v1-' + scope) || '{}');
   return p && typeof p === 'object' ? {...p,...(window.motoTripSensitiveProfile?.()||{})} : {};
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
 // Updating a known safety document does NOT need getDoc(). The old read-before-write
 // could hang on weak mobile connections, leaving emergency info visible after opt-out.
 // A partial update also preserves the independent GPS sharing setting.
 async function writeSafety(next, epoch = null) {
  if (!validContext()) throw Error('Join a Shared Ride first.');
  if(epoch !== null && (epoch !== trackingEpoch || !gpsActive)) return;
  const c=context, ref=currentRef();
  const patch={...next,uid:c.uid,updatedAt:new Date().toISOString()};
  // A pending opt-out always wins over any GPS or profile write in this page.
  if(needsEmergencyRemoval())Object.assign(patch,{
   emergencyShared:false,blood:'',emergencyName:'',emergencyPhone:''
  });
  const createFirstRecord = async () => {
   const fresh=locationFields(infoFields({...blank(c.uid),...patch}));
   // Opting out of a record that does not exist needs no cloud write.
   if(!fresh.emergencyShared && !fresh.locationShared){mySafety=null;return false;}
   await cloudTimeout(c.dbM.setDoc(ref,fresh),'Creating group safety');
   return true;
  };
  if(rosterReady && !mySafety){
   // First-time sharing is a CREATE, not UPDATE. An update to a missing doc
   // can be rejected by Firestore even when authenticated create is allowed.
   if(!(await createFirstRecord()))return;
  }else{
   try{
    await cloudTimeout(c.dbM.updateDoc(ref,patch),'Updating group safety');
   }catch(e){
    if(e?.code==='not-found'){
     if(!(await createFirstRecord()))return;
    }else if(e?.code==='permission-denied' && !rosterReady){
     // The list listener may still be starting. Verify existence once so that
     // first-time sharing can take the create path; do NOT bypass Firebase rules.
     let probe;
     try{probe=await cloudTimeout(c.dbM.getDocFromServer(ref),'Checking safety membership');}
     catch(_){throw e;}
     if(probe.exists())throw e;
     if(!(await createFirstRecord()))return;
    }else{throw e;}
   }
  }
  if(!validContext() || context!==c)return;
  mySafety={...(mySafety||blank(c.uid)),...patch};
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
 function visibleCards(list) {
  // GPS sharing was retired. Never expose previously shared coordinates in the UI.
  const withoutGps=list.map(d=>({...d,locationShared:false,latitude:null,longitude:null,accuracy:null,locationUpdatedAt:''}));
  if(!needsEmergencyRemoval())return withoutGps;
  return withoutGps.map(d=>d?.uid===context?.uid ? {...d,emergencyShared:false,blood:'',emergencyName:'',emergencyPhone:''}:d);
 }
 function render(list) {
  roster.replaceChildren();
  const entries=visibleCards(list).filter(d=>d && (d.emergencyShared === true || d.locationShared === true));
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
  rosterReady=false;
  const g=++generation;
  try {
   unsubscribe=context.dbM.onSnapshot(listRef(),snap=>{
    if(g!==generation)return;
    const items=snap.docs.map(doc=>doc.data());
    rosterReady=true;
    lastCards=items;
    mySafety=items.find(d=>d.uid===context.uid)||null;
    if(!detailsBusy)shareInfo.checked=!needsEmergencyRemoval() && Boolean(mySafety?.emergencyShared);
    render(items);
    if(needsEmergencyRemoval() && !detailsBusy && Date.now()>=nextEmergencyRetryAt)void syncPendingEmergencyRemoval();
   },e=>{if(g!==generation)return;rosterReady=false;say('Safety cards unavailable: '+errorText(e),true);});
  } catch(e){say('Safety setup failed: '+errorText(e),true);}
 }
 // A rider explicitly opts in for this specific account + ride until Stop or Leave.
 // No blanket location sharing for newly joined members.
 // Privacy revocation survives app reloads and is retried on reconnect.
 // It never declares success until Firestore acknowledges the write.
 function emergencyRemovalKey(){return context?'mototrip-emergency-remove-v69-'+context.uid+'-'+context.rideId:'';}
 function needsEmergencyRemoval(){try{return !!emergencyRemovalKey() && localStorage.getItem(emergencyRemovalKey())==='yes';}catch(_){return false;}}
 function markEmergencyRemoval(on){
  try{if(on)localStorage.setItem(emergencyRemovalKey(),'yes');else localStorage.removeItem(emergencyRemovalKey());}catch(_){}
  if(retryEmergencyButton)retryEmergencyButton.hidden=!on;
 }
 async function syncPendingEmergencyRemoval(){
  if(!validContext() || !needsEmergencyRemoval() || detailsBusy)return false;
  detailsBusy=true;
  shareInfo.checked=false;shareInfo.disabled=true;
  if(retryEmergencyButton)retryEmergencyButton.disabled=true;
  nextEmergencyRetryAt=Date.now()+20000;
  say('Removing emergency details from Shared Ride…');
  try{
   await writeSafety({emergencyShared:false,blood:'',emergencyName:'',emergencyPhone:''});
   if(!validContext())return false;
   markEmergencyRemoval(false);
   nextEmergencyRetryAt=0;
   shareInfo.checked=false;
   say('✓ Emergency info removed from the group. Other riders will no longer see your blood group or emergency contact.');
   render(lastCards);
   return true;
  }catch(e){
   say('NOT removed from the group yet. Other riders may still see your old emergency info. Check internet / Firestore rules and tap Retry removal. '+errorText(e),true);
   return false;
  }finally{
   detailsBusy=false;shareInfo.disabled=false;
   if(retryEmergencyButton)retryEmergencyButton.disabled=false;
  }
 }
 function preferenceKey(){return context?'mototrip-live-location-v66-'+context.uid+'-'+context.rideId:'';}
 function pendingStopKey(){return context?'mototrip-location-stop-v66-'+context.uid+'-'+context.rideId:'';}
 function optedIn(){try{return !!preferenceKey() && localStorage.getItem(preferenceKey())==='yes';}catch(_){return false;}}
 function setOptIn(on){try{if(on)localStorage.setItem(preferenceKey(),'yes');else localStorage.removeItem(preferenceKey());}catch(_){/* storage unavailable */}}
 function markPendingStop(on){try{if(on)localStorage.setItem(pendingStopKey(),'yes');else localStorage.removeItem(pendingStopKey());}catch(_){/* storage unavailable */}}
 function needsStop(){try{return !!pendingStopKey() && localStorage.getItem(pendingStopKey())==='yes';}catch(_){return false;}}
 function stopTimer(){
  if(startupProbe!==null){clearTimeout(startupProbe);startupProbe=null;}
  queuedPosition=null;
  if(gpsRetry)gpsRetry.hidden=true;
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
  if(e?.code===1){
   if(gpsRetry)gpsRetry.hidden=true;
   void stopLocation(false);
   say('Location permission denied. In phone Settings allow Location for MotoTrip / browser, then tap Share My Location again.',true);
   return;
  }
  if(gpsRetry)gpsRetry.hidden=false;
  if(!navigator.onLine){say('Phone is offline. Last shared location (if any) remains visible; connect to internet and Retry GPS.',true);return;}
  if(e?.code===3) say('GPS timed out. Check phone Location Services, move outdoors if needed and tap Retry GPS. Last shared location stays visible.',true);
  else say('GPS signal unavailable or paused by the phone. Check Location Services and tap Retry GPS. Last shared location stays visible.',true);
 }
 async function postPosition(position = null, force = false){
  if(!gpsActive || !validContext())return;
  // If a coarse GPS request is pending, retain the latest watcher fix instead of dropping it.
  if(locationBusy){if(position)queuedPosition=position;return;}
  if(!force && lastPublishedAt && Date.now()-lastPublishedAt<18000)return;
  const epoch=trackingEpoch;
  locationBusy=true;
  let stage='gps';
  try{
   const pos=position||await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,
    {enableHighAccuracy:false,timeout:12000,maximumAge:15000}));
   if(!gpsActive || epoch!==trackingEpoch || !validContext())return;
   const lat=Number(pos.coords.latitude),lon=Number(pos.coords.longitude),acc=Number(pos.coords.accuracy);
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('Invalid GPS coordinates.');
   const gpsTime=Number(pos.timestamp)||Date.now();
   if(gpsTime>Date.now()+60000||Date.now()-gpsTime>90000)throw Error('GPS fix is old.');
   stage='cloud';
   locationPending=writeSafety({name:riderName(),locationShared:true,latitude:lat,longitude:lon,
    accuracy:Number.isFinite(acc)?Math.max(0,Math.min(100000,acc)):0,
    locationUpdatedAt:new Date(gpsTime).toISOString()},epoch);
   await locationPending;
   if(!gpsActive||epoch!==trackingEpoch||!validContext())return;
   lastPublishedAt=Date.now();
   if(gpsRetry)gpsRetry.hidden=true;
   say('✓ Location updated '+localClock(new Date(gpsTime).toISOString())+'. Sharing stays ON while your phone permits GPS.');
  }catch(e){
   if(stage==='cloud'){
    if(gpsRetry)gpsRetry.hidden=false;
    say('GPS found, but group sync failed. Check internet / Firebase access and tap Retry GPS: '+errorText(e),true);
   } else gpsError(e);
  }finally{
   locationPending=null;locationBusy=false;
   if(queuedPosition && gpsActive && epoch===trackingEpoch){
    const next=queuedPosition;queuedPosition=null;
    // Don't spam Firebase: send one queued position once any request completes.
    Promise.resolve().then(()=>postPosition(next));
   }
  }
 }
 function armWatcher(){
  if(!gpsActive || gpsWatchId!==null || !validContext())return;
  try{
   gpsWatchId=navigator.geolocation.watchPosition(pos=>{
     if(startupProbe!==null){clearTimeout(startupProbe);startupProbe=null;}
     void postPosition(pos);
   },gpsError,{enableHighAccuracy:true,timeout:25000,maximumAge:12000});
  }catch(e){gpsError(e);}
 }
 function retryGps(){
   if(!gpsActive){void startLocation();return;}
   if(gpsRetry)gpsRetry.hidden=true;
   say('Checking GPS and group connection…');
   // A coarse fix is usually quicker inside cities. The high-accuracy watcher remains enabled.
   void postPosition(null,true);
 }
 async function startLocation(resume = false){
  return; // V9.27: GPS sharing intentionally discontinued.
  if(gpsActive){if(!resume)await stopLocation();return;}
  if(!validContext()){say('Join Shared Ride before sharing location.',true);return;}
  if(!navigator.geolocation){say('GPS is not available in this browser. Try Safari or Chrome with Location Services enabled.',true);return;}
  if(!window.isSecureContext){say('Location sharing requires HTTPS.',true);return;}
  if(needsStop()){await syncPendingStop();if(needsStop())return;}
  if(!resume && !confirm('Share your location with joined ride members? MotoTrip updates while the browser allows GPS; background updates can pause on iPhone. Last known location and time stay visible. Stop Sharing removes the group location. Continue?'))return;
  setOptIn(true);
  trackingEpoch++;
  gpsActive=true;lastPublishedAt=0;setLocationButton();
  say(resume?'Resuming approved GPS sharing…':'Requesting location access…');
  armWatcher();
  // A watcher can take time on iOS. Try a coarse fix only if it hasn't supplied GPS yet.
  startupProbe=setTimeout(()=>{
   startupProbe=null;
   if(gpsActive&&!lastPublishedAt&&!locationBusy)void postPosition(null,true);
  },6000);
  if(gpsTimer===null)gpsTimer=setInterval(()=>{
   if(gpsActive && !locationBusy)void postPosition(null,true);
  },everyMs);
 }
 async function toggleEmergency(){
  if(detailsBusy)return;
  if(!validContext()){shareInfo.checked=false;say('Join a Shared Ride first.',true);return;}
  const checked=shareInfo.checked;
  if(!checked){
   // Never flip the switch back ON when a network write fails. Store a durable
   // revocation intention and retry on reconnect/reopen.
   markEmergencyRemoval(true);
   render(lastCards);
   await syncPendingEmergencyRemoval();
   return;
  }
  if(needsEmergencyRemoval()){
   shareInfo.checked=false;
   say('Finish removing the old emergency info before sharing again. Tap Retry removal.',true);
   return;
  }
  try{await window.motoTripProfileReady?.();}catch(_){shareInfo.checked=false;say('Secure profile details are unavailable on this device.',true);return;}
  const fields=sanitizedProfile(profile());
  if(!fields.blood && !fields.emergencyPhone){
   shareInfo.checked=false;
   say('First fill your emergency number and/or blood group in My Profile.',true);
   $('mt-account-open')?.click();return;
  }
  if(!confirm('Share your blood group and emergency contact with all current Shared Ride members? This information is sensitive. You can turn it off later.')){
   shareInfo.checked=false;return;
  }
  detailsBusy=true;shareInfo.disabled=true;
  try{
   await writeSafety({name:fields.name,emergencyShared:true,
    blood:fields.blood,emergencyName:fields.emergencyName,emergencyPhone:fields.emergencyPhone});
   shareInfo.checked=true;
   say('✓ Emergency details shared with joined riders.');
  }catch(e){shareInfo.checked=false;say('Could not share emergency info. Nothing was confirmed on Firebase: '+errorText(e),true);}
  finally{detailsBusy=false;shareInfo.disabled=false;}
 }
 async function removeMySafety(){
  setOptIn(false);markPendingStop(true);markEmergencyRemoval(true);stopTimer();
  if(!validContext())return;
  // Deleting an absent Firestore document is a safe no-op. Avoid a blocking read.
  await cloudTimeout(context.dbM.deleteDoc(currentRef()),'Removing shared safety data');
  markPendingStop(false);markEmergencyRemoval(false);
  mySafety=null;
 }
 function clearLocal(){
  ++generation;
  if(unsubscribe){unsubscribe();unsubscribe=null;}
  stopTimer();
  context=null;mySafety=null;lastCards=[];rosterReady=false;
  shareInfo.checked=false;
  if(retryEmergencyButton)retryEmergencyButton.hidden=true;
  roster.replaceChildren();
  count.textContent='0 sharing';
 }
 const shouldWatchSafety=()=>!!context && document.visibilityState!=='hidden' &&
   !document.getElementById('split')?.hidden && box.open;
 function pauseSafetyRoster(){
  ++generation;
  if(unsubscribe){unsubscribe();unsubscribe=null;}
  rosterReady=false;
 }
 function syncSafetyRoster(){
  if(!shouldWatchSafety()){pauseSafetyRoster();return;}
  if(!unsubscribe)initRoster();
 }
 async function retireLegacyGPS(){
  if(!validContext()||document.hidden)return;
  // One-time cleanup for people who had GPS enabled in older versions.
  // Never recreate or publish coordinates. Retry on next visit if offline.
  const c=context,key=gpsRetireKey();
  if(!key||localStorage.getItem(key)==='yes')return;
  setOptIn(false);stopTimer();
  try{
   if(needsStop())await syncPendingStop();
   if(needsStop())return;
   const snap=await cloudTimeout(c.dbM.getDocFromServer(currentRef()),'Checking previous location');
   if(!validContext()||context!==c)return;
   if(snap.exists()&&snap.data()?.locationShared){
    markPendingStop(true);
    await syncPendingStop();
    if(needsStop())return;
   }
   localStorage.setItem(key,'yes');
  }catch(e){if(validContext())say('Old location removal will retry when online. '+errorText(e),true);}
 }
 function onRideChange(){
  const next=window.motoTripSharedRide?.safetyContext?.();
  if(next && context?.uid===next.uid && context?.rideId===next.rideId){syncSafetyRoster();return;}
  clearLocal();
  if(next){
   context=next;
   const oldOpted=optedIn();setOptIn(false);
   if(oldOpted)markPendingStop(true);
   if(retryEmergencyButton)retryEmergencyButton.hidden=!needsEmergencyRemoval();
   if(needsEmergencyRemoval())void syncPendingEmergencyRemoval();
   syncSafetyRoster();
   void retireLegacyGPS();
   say('Emergency contacts are optional. Live GPS is disabled.');
  }
 }
 // Stop safety listening as soon as the page is hidden; reconnect only if panel is open.
 document.addEventListener('visibilitychange',()=>{
  stopTimer();syncSafetyRoster();
  if(!document.hidden && context){
   if(needsEmergencyRemoval())void syncPendingEmergencyRemoval();
   void retireLegacyGPS();
  }
 });
 window.addEventListener('mototrip-tab-changed',syncSafetyRoster);
 box.addEventListener('toggle',syncSafetyRoster);
 window.addEventListener('pagehide',()=>{stopTimer();pauseSafetyRoster();});
 window.addEventListener('pageshow',()=>{syncSafetyRoster();if(context)void retireLegacyGPS();});
 window.addEventListener('online',()=>{
  if(!document.hidden){
   if(needsEmergencyRemoval())void syncPendingEmergencyRemoval();
   if(context)void retireLegacyGPS();
  }
 });
 shareInfo.addEventListener('change',toggleEmergency);
 retryEmergencyButton?.addEventListener('click',()=>{void syncPendingEmergencyRemoval();});
 gpsRetry?.addEventListener('click',retryGps);
 // No GPS event handlers in the new version.
 window.addEventListener('mototrip-ride-change',onRideChange);
 window.addEventListener('mototrip-profile-updated',async()=>{
  if(!validContext() || needsEmergencyRemoval() || !mySafety?.emergencyShared)return;
  const fields=sanitizedProfile(profile());
  try {
   if(!fields.blood && !fields.emergencyPhone){
    markEmergencyRemoval(true);
    shareInfo.checked=false;render(lastCards);
    await syncPendingEmergencyRemoval();
   }else{
    await writeSafety({...fields,emergencyShared:true});
    say('✓ Updated emergency info shared with your ride.');
   }
  }catch(e){say('Profile changed locally, but group safety info could not update: '+errorText(e),true);}
 });
 // Time labels and stale warning need to update while the panel is visible.
 // No GPS polling or periodic safety timer in V9.27.
 window.motoTripSafety={removeMySafety};
 onRideChange();
})();
