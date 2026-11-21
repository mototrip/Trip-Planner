/* MotoTrip V5.8 Group Safety (consent-based, foreground GPS only)
 * © 2026 Satish Kumar Gupta. Emergency & GPS data are never shared by default.
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
 const everyMs = 45000;
 const cloudTimeout = (promise, label) => {
  let timer;
  return Promise.race([promise,new Promise((_, reject) => {
   timer=setTimeout(()=>reject(new Error(label+' did not finish. Confirm internet connection and retry.')),12000);
  })]).finally(()=>clearTimeout(timer));
 };
 const staleAfterMs = 120000;
 let context = null, unsubscribe = null, gpsTimer = null, gpsActive = false;
 let locationBusy = false, detailsBusy = false, mySafety = null;
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
 async function writeSafety(next) {
  if (!validContext()) throw Error('Join a Shared Ride first.');
  const ref=currentRef();
  const old=await cloudTimeout(context.dbM.getDoc(ref),'Reading safety settings');
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
    tag(badges, valid ? (fresh ? '📍 Location shared · '+localClock(d.locationUpdatedAt) : '⚠ Old location · '+localClock(d.locationUpdatedAt)):'Location unavailable');
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
   if(d.locationShared && freshTime(d.locationUpdatedAt) && Number.isFinite(d.latitude)&&Number.isFinite(d.longitude)
      && Math.abs(d.latitude)<=90&&Math.abs(d.longitude)<=180){
    const coords=d.latitude.toFixed(6)+','+d.longitude.toFixed(6);
    const map=el('a','','🧭 Navigate to rider');
    map.href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(coords)+'&travelmode=driving';
    map.target='_blank';map.rel='noopener noreferrer';links.append(map);
   }
   if(links.childNodes.length)card.append(links);
   if(d.locationShared && !freshTime(d.locationUpdatedAt))card.append(el('p','mt-safety-stale','Last location is outdated; ask rider to re-share. It is not a live position.'));
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
 function stopTimer() {
  if(gpsTimer!==null){clearInterval(gpsTimer);gpsTimer=null;}
  gpsActive=false;setLocationButton();
 }
 async function stopLocation(notify = true) {
  stopTimer();
  if (!validContext())return;
  try {
   await writeSafety({locationShared:false,latitude:null,longitude:null,accuracy:null,locationUpdatedAt:''});
   if(notify)say('✓ Your location is no longer shared with this ride.');
  } catch(e){
   if(notify)say('Could not clear cloud location. Connect to the internet and tap Stop again: '+errorText(e),true);
  }
 }
 async function postPosition() {
  if (!gpsActive || locationBusy || document.hidden || !validContext())return;
  locationBusy=true;
  try {
   const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,
    {enableHighAccuracy:true,timeout:12000,maximumAge:15000}));
   if (!gpsActive || document.hidden || !validContext())return;
   const lat=Number(pos.coords.latitude),lon=Number(pos.coords.longitude),acc=Number(pos.coords.accuracy);
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('Invalid GPS position.');
   await writeSafety({name:riderName(),locationShared:true,latitude:lat,longitude:lon,
    accuracy:Number.isFinite(acc)?Math.max(0,Math.min(100000,acc)):0,locationUpdatedAt:new Date().toISOString()});
   say('✓ Location shared with ride members · '+new Date().toLocaleTimeString()+'. Keep MotoTrip open for updates.');
  }catch(e){
   say('Could not update location: '+errorText(e)+'. You can stop sharing any time.',true);
   if(e?.code===1){await stopLocation(false);say('GPS permission denied. Location sharing is OFF.',true);}
  }finally{locationBusy=false;}
 }
 async function startLocation(){
  if(gpsActive){await stopLocation();return;}
  if(!validContext()) {say('Join Shared Ride before sharing location.',true);return;}
  if (!navigator.geolocation){say('Location access is not available in this browser.',true);return;}
  if(!window.isSecureContext){say('Location sharing requires HTTPS.',true);return;}
  if(!confirm('Share your current GPS coordinates with everyone who joined this Shared Ride? They can open them on Maps. Updates happen only while MotoTrip stays open and visible.'))return;
  gpsActive=true;setLocationButton();say('Requesting GPS permission…');
  await postPosition();
  if(gpsActive && gpsTimer===null)gpsTimer=setInterval(postPosition,everyMs);
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
  stopTimer();
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
  if(next){context=next;initRoster();say('Sharing is OFF by default. Choose what to share with joined riders.');}
 }
 // Browser background/locked mode must NOT be represented as continuous live tracking.
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden && gpsActive) {
   // Best effort removal. If offline, other users see a stale-location warning after two minutes.
   void stopLocation(false);
  }
 });
 window.addEventListener('pagehide',()=>{if(gpsActive)void stopLocation(false);});
 shareInfo.addEventListener('change',toggleEmergency);
 btnLocation.addEventListener('click',startLocation);
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
