/* MotoTrip Shared Ride v4.9 (optional Firebase sync)
 * Original application © 2026 Satish Kumar Gupta. Not enabled until Firebase
 * project config and Firestore rules have been configured by the app owner.
 */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const sessionKey = 'mototrip-shared-ride-v1';
 const backupKey = 'mototrip-shared-local-split-backup-v1';
 // Reuse the same private ride ID if an earlier attempt timed out, avoiding duplicate rides.
 const pendingCreateKey = 'mototrip-pending-create-v1';
 const CREATE_STEP_TIMEOUT_MS = 12000;
 function withTimeout(promise, label, ms = CREATE_STEP_TIMEOUT_MS) {
  let timer;
  const deadline = new Promise((_, reject) => {
   timer = setTimeout(() => reject(new Error(label + ' timed out. Check your internet, Firestore Database and Security Rules.')), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
 }
 const config = window.MOTOTRIP_FIREBASE_CONFIG || {};
 const configured = ['apiKey','authDomain','projectId','appId'].every(k =>
  typeof config[k] === 'string' && !!config[k].trim() && !/YOUR_|<|>/.test(config[k]));
 let auth=null, db=null, sdk=null, me=null, current=null, lastRemote=null, lastLocal=null;
 let subscription=null, busy=0, queue=Promise.resolve(), leaving=false;
 let lastError='';
 const clone = o => JSON.parse(JSON.stringify(o));
 const uuid = () => crypto.randomUUID();
 const token = () => [...crypto.getRandomValues(new Uint8Array(16))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const message = (s,warning=false) => {lastError=warning?s:''; $('shared-message').textContent=s; $('shared-message').style.color=warning?'#ffe1ba':'';};
 const badge = s => $('shared-mode').textContent=s;
 const inputName = () => $('shared-name').value.trim().slice(0,80);
 const format = s => String(s||'').trim().slice(0,100);
 const enabled = () => Boolean(current);
 const dataOnly = g => ({name:format(g.name),members:Array.isArray(g.members)?g.members.slice(0,100):[],
  expenses:Array.isArray(g.expenses)?g.expenses.map(x=>({...x,id:x.id||uuid()})):[],
  transfers:Array.isArray(g.transfers)?g.transfers.map(x=>({...x,id:x.id||uuid()})):[]});
 const joinToken = str => {
  const m=String(str||'').match(/(?:join=|^)([a-f0-9]{32})(?=$|[^a-f0-9])/i);
  return m?m[1].toLowerCase():'';
 };
 const inviteURL = id => location.origin+location.pathname+'#join='+id;
 const saveSession = () => {
  if(current)localStorage.setItem(sessionKey,JSON.stringify({rideId:current.rideId,inviteId:current.inviteId}));
 };
 const preserveLocal = () => {
  if(!localStorage.getItem(backupKey)) localStorage.setItem(backupKey,JSON.stringify(dataOnly(window.state?.split||state.split||{name:'',members:[],expenses:[],transfers:[]})));
 };
 function updateUI(active) {
  $('shared-ride-setup').hidden=active;
  $('shared-ride-active').hidden=!active;
  badge(active?'Syncing':configured?'Ready to connect':'Setup needed');
  const hint=$('group-sync-help');
  if(hint)hint.textContent=active?'✓ Group name is shared with your ride. Your Planner remains personal.':'✓ Automatically synced with Trip name in Planner. To rename it, edit Trip name there.';
  if(active){ $('shared-current').textContent='Shared: '+(current?.name||'Group Ride')+' · Your friends can view and add expenses'; }
 }
 async function loadSDK(){
  if(sdk)return;
  if(!configured)throw Error('Owner setup required: Add your Firebase web config to firebase-config.js and publish FIREBASE_RULES.txt in Firestore. Offline Bill Split is still available.');
  const version='13.4.0';
  const [appM,authM,dbM]=await Promise.all([
   import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
   import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
   import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)]);
  const app=appM.initializeApp(config);
  auth=authM.getAuth(app);db=dbM.getFirestore(app);
  sdk={authM,dbM};
 }
 async function signIn(){
  await loadSDK();
  if(auth.currentUser){me=auth.currentUser;return me;}
  const u=await sdk.authM.signInAnonymously(auth);me=u.user;return me;
 }
 const rideRef = rideId => sdk.dbM.doc(db,'sharedRides',rideId);
 const memberRef = (rideId,uid) => sdk.dbM.doc(db,'sharedRides',rideId,'members',uid);
 const inviteRef = code => sdk.dbM.doc(db,'sharedRideInvites',code);
 function normalizeGroup(d){
  const g=dataOnly(d||{});return {...g,autoTripName:g.name};
 }
 function display(d){
  if(!current)return;
  current.name=String(d.name||'Shared Ride');
  state.split=normalizeGroup(d);persist();
  lastLocal=clone(state.split);
  if(window.renderSplit)window.renderSplit();
  $('shared-current').textContent='Shared: '+current.name+' · '+state.split.members.length+' riders';
  badge('Live sync');
 }
 function listen(){
  if(subscription)subscription();
  const rid=current.rideId;
  subscription=sdk.dbM.onSnapshot(rideRef(rid),snap=>{
   if(!current||current.rideId!==rid)return;
   if(!snap.exists()) {message('This ride is no longer available.',true);return;}
   lastRemote=snap.data();
   if(!busy)display(lastRemote);
   if(!lastError)message('✓ Connected. Changes appear on all joined phones.');
  },e=>{badge('Disconnected');message('Cloud sync error: '+e.message+'. Check Firebase settings and permissions.',true);});
 }
 async function activate(rideId,inviteId){
  leaving=false;
  current={rideId,inviteId,name:'Shared Ride'};
  saveSession();updateUI(true);showQRCode(false);lastRemote=null;lastLocal=null;
  // Block edits until first authoritative cloud snapshot is received.
  state.split={name:'Connecting to shared ride…',members:[],expenses:[],transfers:[]};
  persist();if(window.renderSplit)window.renderSplit();
  listen();
 }
 async function createRide(){
  if(enabled())return;
  const name=inputName();if(!name){message('Apna rider name likho.',true);$('shared-name').focus();return;}
  if(!configured){message('Firebase setup needed: See SHARED_RIDE_SETUP_HINGLISH.md in the ZIP.',true);return;}
  const local=dataOnly(group());
  if((local.expenses.length||local.transfers.length||local.members.length)&&
    !confirm('Your current riders, expenses and payments will be shared with anyone you invite. Continue?'))return;
  try{
   $('shared-create').disabled=true;
   message('Connecting to Firebase…');
   if(!navigator.onLine)throw Error('You are offline. Connect to the internet to create a Shared Ride.');
   const user=await withTimeout(signIn(), 'Firebase sign-in');
   let pending=null;
   try{pending=JSON.parse(localStorage.getItem(pendingCreateKey)||'null');}catch(_){/* Ignore corrupt pending record. */}
   const validId=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
   const rideId=validId(pending?.rideId)?pending.rideId:token();
   const inviteId=validId(pending?.inviteId)?pending.inviteId:token();
   // A retry uses the same IDs, even if the prior write eventually reached Firebase.
   localStorage.setItem(pendingCreateKey,JSON.stringify({rideId,inviteId}));
   const r=rideRef(rideId),invite=inviteRef(inviteId);
   if(!local.members.some(n=>n.toLowerCase()===name.toLowerCase()))local.members.push(name);
   const now=new Date().toISOString();
   message('Saving your ride…');
   await withTimeout(sdk.dbM.setDoc(r,{ownerUid:user.uid,createdAt:now,updatedAt:now,...local}), 'Saving the ride');
   message('Adding you as a rider…');
   await withTimeout(sdk.dbM.setDoc(memberRef(rideId,user.uid),{name,inviteId:'',joinedAt:now}), 'Adding rider');
   message('Preparing invite link…');
   await withTimeout(sdk.dbM.setDoc(invite,{rideId,ownerUid:user.uid,createdAt:now}), 'Creating invite');
   preserveLocal();await activate(rideId,inviteId);
   showQRCode(false);
   localStorage.removeItem(pendingCreateKey);
   message('✓ Shared Ride created. Tap Send Invite to invite friends.');
  }catch(e){
   const code=typeof e?.code==='string'?e.code:'';
   const hint=code==='permission-denied'?'Firestore rules have not allowed this request.':code==='not-found'?'Firestore Database might not be created.':String(e?.message||'Connection failed');
   message('Could not create Shared Ride: '+hint+' Your offline bills are safe. Check Firebase setup and try again.',true);
  }
  finally{$('shared-create').disabled=false;}
 }
 async function joinRide(){
  if(enabled())return;
  const name=inputName(),code=joinToken($('shared-code').value);
  if(!name){message('Your rider name is required.',true);return;}
  if(!code){message('Paste a valid Shared Ride invitation link or code.',true);return;}
  if(!configured){message('Owner needs to set up Firebase first. See setup guide in ZIP.',true);return;}
  try{
   $('shared-join').disabled=true;message('Joining your friends…');
   const user=await signIn();
   const inviteSnap=await sdk.dbM.getDoc(inviteRef(code));
   if(!inviteSnap.exists())throw Error('Invalid or expired invite. Ask your friend for a fresh link.');
   const rideId=inviteSnap.data().rideId;
   if(typeof rideId!=='string'||!/^[a-f0-9]{32}$/.test(rideId))throw Error('Invalid shared ride.');
   const myRef=memberRef(rideId,user.uid),memberSnap=await sdk.dbM.getDoc(myRef);
   if(!memberSnap.exists())await sdk.dbM.setDoc(myRef,{name,inviteId:code,joinedAt:new Date().toISOString()});
   // Add the participant's chosen rider name to the shared expenses table.
   const r=rideRef(rideId);
   await sdk.dbM.runTransaction(db,async tx=>{
    const snap=await tx.get(r);
    if(!snap.exists())throw Error('Shared ride has been removed.');
    const old=snap.data();const members=old.members||[];
    if(!members.some(x=>x.toLowerCase()===name.toLowerCase())){
     if(members.length>=100)throw Error('Ride has reached rider limit.');
     tx.update(r,{members:[...members,name],updatedAt:new Date().toISOString()});
    }
   });
   preserveLocal();await activate(rideId,code);
   // Hide invitation after successful join so users won't accidentally share it on screenshots.
   if(location.hash.includes('join='))history.replaceState(null,'',location.pathname+location.search);
  }catch(e){message('Join failed: '+e.message,true);}
  finally{$('shared-join').disabled=false;}
 }
 function patch(before,after){
  const b=normalizeGroup(before),a=normalizeGroup(after);
  const diff={adds:[],removes:[],expenseAdds:[],expenseRemoves:[],expenseUpdates:[],paymentAdds:[],paymentRemoves:[],paymentUpdates:[],name:null};
  diff.adds=a.members.filter(n=>!b.members.some(x=>x.toLowerCase()===n.toLowerCase()));
  diff.removes=b.members.filter(n=>!a.members.includes(n));
  if(a.name!==b.name)diff.name=a.name;
  for(const [key,adds,removes,updates] of [['expenses','expenseAdds','expenseRemoves','expenseUpdates'],['transfers','paymentAdds','paymentRemoves','paymentUpdates']]){
   const prev=new Map(b[key].map(x=>[x.id,x])),now=new Map(a[key].map(x=>[x.id,x]));
   for(const [id,item] of now){if(!prev.has(id))diff[adds].push(item);else if(JSON.stringify(item)!==JSON.stringify(prev.get(id)))diff[updates].push(item);}
   for(const [id] of prev){if(!now.has(id))diff[removes].push(id);}
  }
  return diff;
 }
 function applyPatch(original,diff){
  const g=normalizeGroup(original);
  if(diff.name!==null)g.name=diff.name;
  for(const n of diff.adds)if(!g.members.some(x=>x.toLowerCase()===n.toLowerCase()))g.members.push(n);
  for(const n of diff.removes){
   if(g.expenses.some(e=>e.payer===n||e.people?.includes(n))||g.transfers.some(e=>e.from===n||e.to===n))continue;
   g.members=g.members.filter(x=>x!==n);
  }
  for(const [key,adds,removes,updates] of [['expenses',diff.expenseAdds,diff.expenseRemoves,diff.expenseUpdates],['transfers',diff.paymentAdds,diff.paymentRemoves,diff.paymentUpdates]]){
   const rm=new Set(removes),up=new Map(updates.map(x=>[x.id,x]));
   g[key]=g[key].filter(x=>!rm.has(x.id)).map(x=>up.has(x.id)?up.get(x.id):x);
   for(const item of adds)if(!g[key].some(x=>x.id===item.id))g[key].push(item);
  }
  if(g.members.length>100||g.expenses.length>3000||g.transfers.length>3000)throw Error('Shared Ride limit reached.');
  return {name:g.name,members:g.members,expenses:g.expenses,transfers:g.transfers};
 }
 function capture(){
  if(!current||leaving)return;
  if(!lastLocal){message('Connecting to shared group. Try again when it says Live sync.',true);return;}
  const before=clone(lastLocal||state.split),after=clone(state.split);
  const changes=patch(before,after);
  lastLocal=after;busy++;
  const rid=current.rideId;
  badge('Saving…');message('Syncing your change to friends…');
  queue=queue.catch(()=>{}).then(async()=>{
   if(!current||current.rideId!==rid)return;
   await sdk.dbM.runTransaction(db,async tx=>{
    const ref=rideRef(rid),snap=await tx.get(ref);
    if(!snap.exists())throw Error('Shared ride was deleted.');
    const merged=applyPatch(snap.data(),changes);
    tx.update(ref,{...merged,updatedAt:new Date().toISOString()});
   });
  }).catch(e=>{message('Could not sync: '+e.message+'. Check internet and try again.',true);})
   .finally(()=>{busy=Math.max(0,busy-1);if(!busy&&current?.rideId===rid&&lastRemote){display(lastRemote);if(!lastError)message('✓ Saved on all connected phones.');}});
 }
 function showQRCode(show) {
  const panel=$('shared-qr-panel'),button=$('shared-qr-toggle'),container=$('shared-qr-image');
  if(!panel||!button||!container)return;
  if(!show||!current){panel.hidden=true;button.textContent='▦ Show QR (optional)';button.setAttribute('aria-expanded','false');container.replaceChildren();return;}
  const invite=inviteURL(current.inviteId);
  try{
   if(!window.MotoTripQR)throw Error('QR generator unavailable; reload the app.');
   // Each invitation QR is generated on-device. No QR service receives the invite token.
   container.replaceChildren(window.MotoTripQR.create(invite));
   panel.hidden=false;button.textContent='▦ Hide QR';button.setAttribute('aria-expanded','true');
  }catch(e){message('QR code could not be shown: '+e.message+'. Use Copy Invite Link instead.',true);}
 }
 const inviteMessage = () => 'Join my MotoTrip Shared Ride to plan and split expenses together!\n' + inviteURL(current.inviteId);
 function closeShareSheet(){
  const sheet=$('invite-share-sheet');
  if(!sheet||sheet.hidden)return;
  sheet.hidden=true;
  document.documentElement.classList.remove('invite-sheet-open');
  $('shared-native-share').setAttribute('aria-expanded','false');
  $('shared-native-share').focus({preventScroll:true});
 }
 function openShareSheet(){
  if(!current)return;
  const sheet=$('invite-share-sheet');
  sheet.hidden=false;
  document.documentElement.classList.add('invite-sheet-open');
  $('shared-native-share').setAttribute('aria-expanded','true');
  $('shared-whatsapp').focus({preventScroll:true});
 }
 async function shareRide(){
  if(!current)return;
  const url=inviteURL(current.inviteId);
  if(typeof navigator.share!=='function'){
   closeShareSheet();
   await copy();
   message('This browser has no system share menu. Invite link copied — paste it into any app.');
   return;
  }
  // Called directly from the user's More apps tap so the OS share sheet is allowed to open.
  closeShareSheet();
  try{
   await navigator.share({title:'Join my MotoTrip Shared Ride',text:'Join my ride on MotoTrip — plan together and split bills.',url});
   message('Invite shared.');
  }catch(e){
   if(e?.name!=='AbortError')message('System share menu unavailable. Use Send Invite → WhatsApp, Messages or Copy link.',true);
  }
 }
 function shareWhatsApp(){
  if(!current)return;
  closeShareSheet();
  const url='https://wa.me/?text='+encodeURIComponent(inviteMessage());
  // Synchronous navigation inside a genuine tap avoids mobile popup blockers.
  const newTab=window.open(url,'_blank');
  if(newTab){try{newTab.opener=null;}catch(_){/* Browser may restrict opener access. */}}
  else location.assign(url);
 }
 function shareSMS(){
  if(!current)return;
  closeShareSheet();
  const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);
  // iOS supports sms:&body= ; Android generally supports sms:?body=.
  const url='sms:'+(ios?'&':'?')+'body='+encodeURIComponent(inviteMessage());
  location.href=url;
 }
 async function copy(){
  if(!current)return;
  closeShareSheet();
  const url=inviteURL(current.inviteId);
  try{await navigator.clipboard.writeText(url);message('Invite link copied! Share privately with your friends.');}
  catch(e){prompt('Copy this invite link:',url);}
 }
 function leave(){
  if(!current)return;
  if(!confirm('Leave Shared Ride on this phone? Remote group will remain for your friends. Your old offline Bill Split will be restored.'))return;
  leaving=true;
  if(subscription){subscription();subscription=null;}
  localStorage.removeItem(sessionKey);current=null;lastRemote=null;lastLocal=null;busy=0;
  const backup=localStorage.getItem(backupKey);
  if(backup){try{state.split=JSON.parse(backup);persist();}catch(e){}localStorage.removeItem(backupKey);}
  if(window.renderSplit)window.renderSplit();
  updateUI(false);showQRCode(false);closeShareSheet();message('You are back to your offline Bill Split.');
  if(location.hash.includes('join='))history.replaceState(null,'',location.pathname+location.search);
 }
 async function restore(){
  let session=null;
  try{session=JSON.parse(localStorage.getItem(sessionKey)||'null');}catch(e){}
  if(!session?.rideId||!session?.inviteId||!configured)return;
  try{
   message('Reconnecting to Shared Ride…');await signIn();
   const member=await sdk.dbM.getDoc(memberRef(session.rideId,me.uid));
   if(!member.exists())throw Error('This phone is no longer a member; rejoin using your invitation.');
   preserveLocal();await activate(session.rideId,session.inviteId);
  }catch(e){message('Reconnect failed: '+e.message+'. Try again online.',true);}
 }
 window.motoTripSharedRide={get active(){return enabled();},capture};
 $('shared-create').addEventListener('click',createRide);
 $('shared-join').addEventListener('click',joinRide);
 $('shared-copy').addEventListener('click',copy);
 $('shared-native-share').addEventListener('click',openShareSheet);
 $('shared-more').addEventListener('click',shareRide);
 $('shared-whatsapp').addEventListener('click',shareWhatsApp);
 $('invite-share-close').addEventListener('click',closeShareSheet);
 $('invite-share-backdrop').addEventListener('click',closeShareSheet);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('invite-share-sheet').hidden)closeShareSheet();});
 $('shared-sms').addEventListener('click',shareSMS);
 $('shared-qr-toggle').addEventListener('click',()=>showQRCode($('shared-qr-panel').hidden));
 $('shared-leave').addEventListener('click',leave);
 const code=joinToken(location.hash);
 if(code){$('shared-code').value=code;if($('join-ride-panel'))$('join-ride-panel').open=true;message('Invite detected! Enter your name and tap Join Shared Ride.');}
 else if(!configured)message('Offline Bill Split works as usual. To turn on live sharing, MotoTrip owner must configure Firebase.');
 updateUI(false);restore();
})();
