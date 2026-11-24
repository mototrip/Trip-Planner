/* MotoTrip V7.5 | Persistent verified login + two-step mandatory entry + protected sign-out; required entry choice (Login / Sign up / Guest) + Firebase email login + PRIVATE device-only rider profile with optional opt-in Group Safety sharing.
   © 2026 Satish Kumar Gupta. Profile details go to Firestore only after separate Group Safety consent. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const el = $('mt-account-overlay');
 if (!el) return;
 const scopeKey = 'mototrip-account-scope';
 const welcomeKey = 'mototrip-welcome-v57';
 const cfg = window.MOTOTRIP_FIREBASE_CONFIG || {};
 const readyConfig = ['apiKey', 'authDomain', 'projectId', 'appId'].every(k => typeof cfg[k] === 'string' && cfg[k].trim() && !cfg[k].includes('YOUR_'));
 const legacyKey = 'mototrip-v1';
 let scope = 'guest', auth, modules, loadPromise, busy = false, focusBefore = null;
 try { scope = localStorage.getItem(scopeKey) || 'guest'; } catch (_) { /* Storage may be disabled */ }
 const profilePrefix = 'mototrip-rider-profile-v1-';
 const vault = window.MotoTripProfileVault;
 let privateProfile = {};
 let hydratedScope = null;
 let privateLoad = null;
 let savingProfile = false;
 // Only the rider display name and vehicle stay in localStorage in readable form.
 // Optional emergency/medical fields are encrypted using a non-extractable device key.
 function privateForCurrentScope(){return hydratedScope===scope?{...privateProfile}:{};}
 function hydrateProfile(){
   if(hydratedScope===scope)return Promise.resolve(privateProfile);
   if(privateLoad?.scope===scope)return privateLoad.promise;
   const selectedScope=scope;
   const promise=(vault?vault.load(selectedScope):Promise.resolve({})).then(p=>{
     if(scope!==selectedScope)return {};
     privateProfile=p||{};hydratedScope=scope;
     if(!savingProfile && !el.hidden && !$('mt-profile-panel').hidden)renderProfile();
     window.dispatchEvent(new Event('mototrip-private-profile-ready'));
     return privateProfile;
   }).catch(e=>{
     if(scope===selectedScope) setMessage('Private emergency details could not be unlocked: '+String(e.message||e).slice(0,160),true);
     throw e;
   }).finally(()=>{if(privateLoad?.scope===selectedScope)privateLoad=null;});
   privateLoad={scope:selectedScope,promise};return promise;
 }
 window.motoTripSensitiveProfile=privateForCurrentScope;
 window.motoTripProfileReady=hydrateProfile;
 const savedProfileKey = () => profilePrefix + scope;
 const accountProfileKey = uid => profilePrefix + 'uid-' + uid;
 const afterLoginKey = 'mototrip-show-profile-after-login-v65';
 const entryKey = 'mototrip-entry-choice-v71';
 // Two-stage access: a conscious Login/Sign up/Guest choice, THEN explicit
 // saving of the Rider Profile. Existing, valid profiles are prefilled but the
 // rider must confirm Save & Continue for each new entry session.
 const profileApprovedKey = 'mototrip-profile-approved-v73';
 // Persistent approval is an ACCESS PREFERENCE, never an authentication token.
 // A saved email account is always checked against the restored Firebase UID.
 const rememberedEntryKey = 'mototrip-remembered-entry-v75';
 function rememberedChoice(){
   try { const v=localStorage.getItem(rememberedEntryKey)||'';return v==='guest'||/^uid-[a-zA-Z0-9_-]+$/.test(v)?v:''; }
   catch(_){return '';}
 }
 function rememberChoice(choice){try{localStorage.setItem(rememberedEntryKey,choice);}catch(_){}}
 function forgetChoice(){try{localStorage.removeItem(rememberedEntryKey);}catch(_){}}
 let entryRequired = true, gateStep = 'welcome', acceptedChoice = '';
 const main = document.querySelector('main');
 if (main) main.inert = true;
 document.documentElement.classList.add('mt-entry-locked');
 function entryChoice(){try{return sessionStorage.getItem(entryKey)||'';}catch(_){return '';}}
 function approvedChoice(){try{return sessionStorage.getItem(profileApprovedKey)||'';}catch(_){return '';}}
 function storedProfileIsValid(){return Boolean(readProfile().name?.trim());}
 function updateEntryUI(){
   const locked = entryRequired;
   const profileGate = locked && gateStep === 'profile';
   $('mt-account-x').hidden = locked;
   $('mt-profile-back').hidden = profileGate;
   $('mt-profile-gate-note').hidden = !profileGate;
   $('mt-profile-exit-guest').hidden = scope !== 'guest';
   const actions = $('mt-profile-actions');
   if (actions) actions.classList.toggle('mt-onboarding-actions', profileGate);
   const saveBtn = $('mt-profile-save');
   if (saveBtn) saveBtn.textContent = profileGate ? 'Save & Continue' : 'Save my profile';
 }
 function lockApp(step='welcome'){
   entryRequired = true; gateStep = step;
   document.documentElement.classList.add('mt-entry-locked');
   if(main)main.inert = true;
   updateEntryUI();
 }
 function openProfileGate(choice){
   if (!['guest'].includes(choice) && !/^uid-[a-zA-Z0-9_-]+$/.test(choice)) return;
   acceptedChoice=choice;
   try { sessionStorage.setItem(entryKey,choice); sessionStorage.removeItem(profileApprovedKey); } catch(_) {}
   lockApp('profile');
   openDialog('profile');
   setMessage('Review your Rider Profile and tap Save & Continue to enter MotoTrip.');
 }
 function finishEntry(choice){
   if (!choice || choice!==scope || !storedProfileIsValid()) return false;
   acceptedChoice=choice;
   try { sessionStorage.setItem(entryKey,choice); sessionStorage.setItem(profileApprovedKey,choice); } catch(_) {}
   rememberChoice(choice); // Survives app close and PWA update until explicit logout/exit.
   entryRequired=false; gateStep='';
   document.documentElement.classList.remove('mt-entry-locked');
   if(main)main.inert=false;
   updateEntryUI();
   closeDialog();
   return true;
 }
 function resetEntry(){
   forgetChoice();
   try { sessionStorage.removeItem(entryKey); sessionStorage.removeItem(profileApprovedKey); } catch(_) {}
   acceptedChoice='';lockApp('welcome');
 }
 const declinedRestoreKey = uid => 'mototrip-declined-profile-restore-v65-' + uid;
 const privateTripKey = uid => 'mototrip-v1-uid-' + uid;
 const groupIsActive = () => Boolean(window.motoTripSharedRide?.active);
 const panels = ['welcome', 'signup', 'login', 'profile'];
 const setMessage = (text = '', bad = false) => { const box = $('mt-account-message'); box.textContent = text; box.dataset.bad = bad ? 'true' : 'false'; };
 function readProfile() {
   try { const val = JSON.parse(localStorage.getItem(savedProfileKey()) || 'null'); return val && typeof val === 'object' ? {...val,...privateForCurrentScope()} : {}; }
   catch (_) { return {}; }
 }
 // Keep each signed-in rider's private profile under their stable Firebase UID.
 // Older Guest/anonymous-account profiles remain on the device; never overwrite
 // an existing account profile and never send medical/emergency data to a server.
 function parseStoredProfile(key) {
   try {
     const p = JSON.parse(localStorage.getItem(key) || 'null');
     return p && typeof p === 'object' && !Array.isArray(p) && typeof p.name === 'string' && p.name.trim() ? p : null;
   } catch (_) { return null; }
 }
 function restoreCandidate(uid) {
   try {
     if (!uid || localStorage.getItem(accountProfileKey(uid)) !== null) return null;
     const guestKey = profilePrefix + 'guest';
     if (parseStoredProfile(guestKey)) return guestKey;
     // Older builds could have saved under a previous anonymous UID. Only offer
     // automatic discovery when exactly one such profile exists on this device.
     const found = [];
     for (let i = 0; i < localStorage.length; i++) {
       const key = localStorage.key(i);
       if (key?.startsWith(profilePrefix + 'uid-') && key !== accountProfileKey(uid) && parseStoredProfile(key)) found.push(key);
     }
     return found.length === 1 ? found[0] : null;
   } catch (_) { return null; }
 }
 function restorePreviousProfile(uid, ask = true) {
   const key = restoreCandidate(uid);
   if (!key) return false;
   if (ask && !confirm('A previous Rider Profile was found on this device. Copy it into this account? Choose OK only if it belongs to you. Your original data will stay saved.')) return false;
   try {
     // Recheck immediately before writing, so nothing previously saved is lost.
     if (localStorage.getItem(accountProfileKey(uid)) !== null) return false;
     const source = localStorage.getItem(key);
     if (!source) return false;
     localStorage.setItem(accountProfileKey(uid), source);
     // A migrated profile has a separate encrypted component. Copy the encrypted
     // ciphertext to the destination scope without exporting the device key.
     vault?.copy(key.slice(profilePrefix.length), 'uid-'+uid);
     return true;
   } catch (_) { return false; }
 }
 function openDialog(which = 'welcome') {
   focusBefore = document.activeElement;
   el.hidden = false;
   document.documentElement.classList.add('mt-account-open');
   show(which);
   $('mt-account-dialog');
   $('mt-account-x').focus({preventScroll: true});
 }
 function closeDialog() {
   if (entryRequired) return;
   el.hidden = true;
   document.documentElement.classList.remove('mt-account-open');
   setMessage();
   try { focusBefore?.focus({preventScroll: true}); } catch (_) {}
 }
 function show(which) {
   if (!panels.includes(which)) which = 'welcome';
   if (entryRequired && which === 'profile' && gateStep !== 'profile') which = 'welcome';
   for (const p of panels) $('mt-' + p + '-panel').hidden = p !== which;
   const titles = { welcome: 'Welcome to MotoTrip', signup: 'Create your account', login: 'Welcome back', profile: 'My Rider Profile' };
   $('mt-account-title').textContent = titles[which];
   $('mt-account-intro').textContent = which === 'profile' ? 'Your ride essentials, all in one private place.' : 'Plan together. Ride further. Split smarter.';
   setMessage();
   if (which === 'profile') renderProfile();
   updateEntryUI();
 }
 function setScope(uid) {
   const next = uid ? 'uid-' + uid : 'guest';
   try { localStorage.setItem(scopeKey, next); } catch (e) { throw Error('Browser storage unavailable. Try normal Safari or Chrome.'); }
   scope = next;
 }
 async function loadAuth() {
   if (loadPromise) return loadPromise;
   if (!readyConfig) throw Error('Firebase is not configured. Continue as Guest or ask the MotoTrip owner to configure Firebase.');
   loadPromise = (async () => {
     const base = 'https://www.gstatic.com/firebasejs/13.4.0/';
     const [appM, authM] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js')]);
     const app = appM.getApps().length ? appM.getApp() : appM.initializeApp(cfg);
     auth = authM.getAuth(app);
     if (typeof auth.authStateReady === 'function') await auth.authStateReady();
     // Explicit LOCAL persistence, not SESSION/NONE. Firebase stores credentials
     // securely in browser-managed storage; passwords are never stored by MotoTrip.
     if (typeof authM.setPersistence === 'function' && authM.browserLocalPersistence) {
       await authM.setPersistence(auth, authM.browserLocalPersistence);
     }
     modules = authM;
     return auth;
   })().catch(e => { loadPromise = null; throw e; });
   return loadPromise;
 }
 const humanError = err => {
   const code = String(err?.code || '');
   if (code === 'auth/operation-not-allowed') return 'Email/Password login is not enabled yet. Firebase Console → Authentication → Sign-in method → Email/Password → Enable → Save.';
   if (code === 'auth/email-already-in-use') return 'This email already has an account. Choose Log in instead.';
   if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
   if (code === 'auth/weak-password') return 'Choose a stronger password.';
   if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code)) return 'Email or password is incorrect. Try again or use Forgot password.';
   if (code === 'auth/network-request-failed') return 'Internet connection failed. Check the network and try again.';
   if (code === 'auth/requires-recent-login') return 'For safety, log in again before deleting your account.';
   return String(err?.message || 'Something went wrong. Please try again.').slice(0, 240);
 };
 async function guarded(task) {
   if (busy) return;
   busy = true;
   const buttons = el.querySelectorAll('button');
   buttons.forEach(b => b.disabled = true);
   setMessage('Connecting securely…');
   try { await task(); }
   catch (e) { setMessage(humanError(e), true); }
   finally { busy = false; buttons.forEach(b => b.disabled = false); }
 }
 function markSeen() { try { localStorage.setItem(welcomeKey, 'yes'); } catch (_) {} }
 function copyGuestDataIfRequested(uid) {
   try {
     const prior = localStorage.getItem(legacyKey);
     if (prior && !localStorage.getItem(privateTripKey(uid))) {
       if (confirm('Your existing Guest trips and bills are still on this phone. Copy them into your new account space? The original Guest backup will remain unchanged.')) {
         localStorage.setItem(privateTripKey(uid), prior);
       }
     }
   } catch (e) { throw Error('Storage full/unavailable. Export a JSON backup before creating your account.'); }
 }
 function switchAndReload(uid, isNew = false) {
   // Re-login requires one profile confirmation, but not on every app reopen.
   forgetChoice();
   // Saved offline trips MUST remain scoped to the original rider, not mixed with another login.
   if (isNew) copyGuestDataIfRequested(uid);
   // If the account already has a profile, leave it untouched. A former Guest
   // or old anonymous profile can be copied after explicit user confirmation.
   if (localStorage.getItem(accountProfileKey(uid)) === null) {
     if (isNew && parseStoredProfile(profilePrefix + 'guest')) restorePreviousProfile(uid, false);
     else {
       let declined = false;
       try { declined = sessionStorage.getItem(declinedRestoreKey(uid)) === 'yes'; } catch (_) {}
       if (!declined && restoreCandidate(uid) && !restorePreviousProfile(uid, true)) {
         try { sessionStorage.setItem(declinedRestoreKey(uid), 'yes'); } catch (_) {}
       }
     }
   }
   setScope(uid);
   markSeen();
   // An existing account should re-open the profile too, not land in Planner
   // with its private fields hidden and appearing to have vanished.
   try { sessionStorage.setItem(afterLoginKey, 'yes'); sessionStorage.setItem(entryKey, 'uid-'+uid); sessionStorage.removeItem(profileApprovedKey); } catch (_) {}
   location.reload();
 }
 async function signup(event) {
   event.preventDefault();
   const email = $('mt-signup-email').value.trim();
   const pass = $('mt-signup-password').value;
   if (pass !== $('mt-signup-confirm').value) { setMessage('Both passwords must match.', true); return; }
   await guarded(async () => {
     await loadAuth();
     let credential;
     // Link a Shared Ride's anonymous identity when possible, preserving its membership.
     if (auth.currentUser?.isAnonymous) {
       credential = await modules.linkWithCredential(auth.currentUser, modules.EmailAuthProvider.credential(email, pass));
     } else {
       credential = await modules.createUserWithEmailAndPassword(auth, email, pass);
     }
     switchAndReload(credential.user.uid, true);
   });
 }
 async function login(event) {
   event.preventDefault();
   if (groupIsActive() && !confirm('Signing in to a different account will pause this ride on this device. You can reconnect when you sign back in, or use the original invite link. Continue?')) return;
   await guarded(async () => {
     await loadAuth();
     const user = (await modules.signInWithEmailAndPassword(auth, $('mt-login-email').value.trim(), $('mt-login-password').value)).user;
     switchAndReload(user.uid);
   });
 }
 function renderProfile() {
   // Populate public fields immediately, then load optional encrypted fields.
   if(hydratedScope!==scope)void hydrateProfile().catch(()=>{});
   const p = readProfile();
   const vals = { 'mt-profile-name': 'name', 'mt-profile-vehicle': 'vehicle', 'mt-profile-gender': 'gender', 'mt-emergency-name': 'iceName', 'mt-emergency-phone': 'icePhone', 'mt-profile-blood': 'blood' };
   for (const [id, key] of Object.entries(vals)) $(id).value = typeof p[key] === 'string' ? p[key] : '';
   const registered = scope !== 'guest';
   $('mt-account-status').textContent = registered ? '🔒 Account signed in · private local rider profile' : '👤 Guest profile · this device only';
   $('mt-profile-login').hidden = registered;
   $('mt-profile-logout').hidden = !registered;
   $('mt-profile-delete-account').hidden = !registered;
   const restoreButton = $('mt-profile-restore');
   if (restoreButton) restoreButton.hidden = !registered || !!p.name || !restoreCandidate(scope.slice(4));
   updateEmergencyCall(p.icePhone || '');
   updateEntryUI();
 }
 function updateEmergencyCall(raw) {
   const phone = String(raw || '').replace(/[^+0-9]/g, '');
   const good = /^[+]?[0-9]{7,15}$/.test(phone);
   const link = $('mt-emergency-call');
   link.hidden = !good;
   if (good) link.href = 'tel:' + phone; else link.removeAttribute('href');
 }
 function updateHeaderProfile(name) {
   const button = $('mt-account-open');
   if (!button) return;
   const first = String(name || '').trim().split(/\s+/)[0].slice(0, 13);
   const avatar = document.createElement('span'); avatar.className='mt-profile-avatar';
   avatar.textContent = first ? first.charAt(0).toUpperCase() : '👤'; avatar.setAttribute('aria-hidden','true');
   const caption = document.createElement('span'); caption.className='mt-profile-caption';
   caption.textContent = first || 'Profile';
   button.replaceChildren(avatar,caption);
   button.setAttribute('aria-label','Open rider profile'+(first?' for '+first:''));
 }
 async function saveProfile(event) {
   event.preventDefault();
   if(savingProfile)return;
   savingProfile=true;
   try{await hydrateProfile();}catch(_){savingProfile=false;setMessage('Secure profile storage unavailable. Existing profile was not changed.',true);return;}
   const p = {
     name: $('mt-profile-name').value.trim().slice(0, 80),
     vehicle: $('mt-profile-vehicle').value,
     gender: $('mt-profile-gender').value,
     iceName: $('mt-emergency-name').value.trim().slice(0, 80),
     icePhone: $('mt-emergency-phone').value.trim().slice(0, 22),
     blood: $('mt-profile-blood').value
   };
   if (!p.name) { savingProfile=false;setMessage('Please enter a rider name.', true); return; }
   if (p.icePhone && !/^[+0-9() .-]{7,22}$/.test(p.icePhone)) { savingProfile=false;setMessage('Check the emergency contact number.', true); return; }
   try {
     if(!vault)throw Error('Encrypted profile storage is unavailable.');
     privateProfile=await vault.save(scope,p);hydratedScope=scope;
   } catch (error) { savingProfile=false;setMessage('Cannot securely save Rider Profile: '+String(error.message||error).slice(0,140), true); return; }
   savingProfile=false;
   if (typeof window.motoTripRefreshRiderName === 'function') window.motoTripRefreshRiderName();
   updateHeaderProfile(p.name);
   updateEmergencyCall(p.icePhone);
   window.dispatchEvent(new Event('mototrip-profile-updated'));
   markSeen();
   if (entryRequired && gateStep === 'profile') {
     // Save is the ONLY route from mandatory onboarding to the main app.
     if (!finishEntry(acceptedChoice)) setMessage('Could not finish setup. Please try saving your profile again.',true);
     return;
   }
   setMessage('✓ Profile saved privately on this device.');
   window.setTimeout(closeDialog, 400);
 }
 function fillLabel() {
   const p = readProfile();
   updateHeaderProfile(p.name);
   if (typeof window.motoTripRefreshRiderName === 'function') window.motoTripRefreshRiderName();
 }
 async function logout() {
   if (!confirm('Sign out? You will temporarily disconnect from Shared Ride, but REMAIN a member. Log back in with this same account to reconnect.')) return;
   await guarded(async () => {
     await loadAuth();
     if (auth.currentUser) await modules.signOut(auth);
     setScope(null);
     markSeen();
     resetEntry();
     location.reload();
   });
 }
 async function deleteAccount() {
   if (scope === 'guest') return;
   if (groupIsActive()) { setMessage('Leave Shared Ride before account deletion. Shared ride records require separate deletion.', true); return; }
   if (!confirm('Delete your Firebase login account? This cannot be undone. Local account trips and profile on this browser will also be deleted. Shared Ride cloud data are NOT automatically removed.')) return;
   await guarded(async () => {
     await loadAuth();
     const u = auth.currentUser;
     if (!u || u.isAnonymous) throw Error('Log in again to delete your account.');
     await modules.deleteUser(u);
     try { vault?.remove(scope);localStorage.removeItem(privateTripKey(u.uid)); } catch (_) {}
     setScope(null);
     markSeen();
     resetEntry();
     location.reload();
   });
 }
 function restoreProfileFromDevice() {
   if (!scope.startsWith('uid-')) return;
   if (!restorePreviousProfile(scope.slice(4))) {
     setMessage('No previous device profile was restored. Your account profile was not changed.');
     return;
   }
   privateProfile={};hydratedScope=null;
   void hydrateProfile().then(()=>renderProfile()).catch(()=>{});
   fillLabel();
   if (typeof window.motoTripRefreshRiderName === 'function') window.motoTripRefreshRiderName();
   window.dispatchEvent(new Event('mototrip-profile-updated'));
   setMessage('✓ Your previous device profile has been restored.');
 }
 function clearProfile() {
   if (!confirm('Remove your rider name, emergency contact and blood group saved on this browser? Your trips and expenses will NOT be deleted.')) return;
   try { vault?.remove(scope); } catch (_) {}
   privateProfile={};hydratedScope=null;
   renderProfile();
   fillLabel();
   window.dispatchEvent(new Event('mototrip-profile-updated'));
   // Never leave the full application accessible with a missing required name.
   const chosen = entryChoice();
   if (chosen === 'guest' || chosen === scope) openProfileGate(chosen);
   else { resetEntry(); openDialog('welcome'); }
   setMessage('Profile deleted from this device. Save a new name before continuing.',true);
 }
 async function resetPassword() {
   const email = $('mt-login-email').value.trim();
   if (!email) { setMessage('Enter your email address first.', true); return; }
   await guarded(async () => {
     await loadAuth();
     await modules.sendPasswordResetEmail(auth, email);
     setMessage('If this email belongs to a registered account, a reset email may arrive shortly.');
   });
 }

 // Share only the profile rider NAME with Shared Ride. Emergency fields remain private.
 window.motoTripRiderProfileName = () => {
   const p = readProfile();
   return typeof p.name === 'string' ? p.name.trim().slice(0, 80) : '';
 };
 $('mt-account-open').addEventListener('click', () => openDialog('profile'));
 $('mt-account-x').addEventListener('click', closeDialog);
 el.querySelector('[data-mt-close]').addEventListener('click', closeDialog);
 document.addEventListener('keydown', e => { if (e.key === 'Escape' && !el.hidden) closeDialog(); });
 $('mt-welcome-signup').addEventListener('click', () => show('signup'));
 $('mt-welcome-login').addEventListener('click', () => show('login'));
 $('mt-welcome-guest').addEventListener('click', () => {
   void guarded(async () => {
     // A real Guest should never inherit someone else's saved signed-in Firebase
     // session (and therefore their protected Shared Ride membership).
     if(readyConfig){
       await loadAuth();
       if(auth.currentUser && !auth.currentUser.isAnonymous) await modules.signOut(auth);
     }
     markSeen();
     forgetChoice(); // Explicitly choosing Guest cancels the former login preference.
     if(scope !== 'guest'){
       setScope(null);
       try{sessionStorage.setItem(entryKey,'guest');sessionStorage.removeItem(profileApprovedKey);}catch(_){}
       location.reload();return; // rebuild account-scoped trips with guest storage
     }
     openProfileGate('guest');
   });
 });
 for (const b of el.querySelectorAll('[data-mt-go]')) b.addEventListener('click', () => show(b.dataset.mtGo));
 $('mt-signup-panel').addEventListener('submit', signup);
 $('mt-login-panel').addEventListener('submit', login);
 $('mt-profile-form').addEventListener('submit', saveProfile);
 $('mt-profile-back').addEventListener('click', () => { if (entryRequired) {setMessage('Save your profile before entering MotoTrip.',true);return;} closeDialog(); });
 $('mt-profile-login').addEventListener('click', () => show('signup'));
 $('mt-profile-logout').addEventListener('click', logout);
 $('mt-profile-exit-guest').addEventListener('click', () => {
   if(scope !== 'guest')return;
   resetEntry();
   location.reload(); // return to Welcome; do not erase Guest trips/profile
 });
 $('mt-profile-delete-account').addEventListener('click', deleteAccount);
 $('mt-profile-clear').addEventListener('click', clearProfile);
 $('mt-profile-restore')?.addEventListener('click', restoreProfileFromDevice);
 $('mt-reset-password').addEventListener('click', resetPassword);
 $('mt-emergency-phone').addEventListener('input', e => updateEmergencyCall(e.target.value));
 fillLabel();
 // Start the safe legacy migration early, without blocking app navigation.
 void hydrateProfile().catch(()=>{});
 // V7.5: closing a PWA window does not mean the user signed out.
 // The previous version only checked sessionStorage, which iOS can discard
 // when the app is closed. Keep an approval marker across restarts, and ALWAYS
 // verify signed-in accounts with Firebase before unlocking account data.
 const initialChoice = entryChoice();
 const remembered = rememberedChoice();
 const isApproved = choice => approvedChoice() === choice && storedProfileIsValid();
 if (scope === 'guest' && (initialChoice === 'guest' || remembered === 'guest')) {
   // Guest also remains active until Exit Guest Mode (no Firebase identity).
   if ((isApproved('guest') || remembered === 'guest') && storedProfileIsValid()) finishEntry('guest');
   else openProfileGate('guest');
 } else if (scope.startsWith('uid-')) {
   openDialog('welcome');
   setMessage('Restoring your saved login…');
   let restoring = false;
   async function restoreAccount() {
     if (restoring || !entryRequired || !scope.startsWith('uid-')) return;
     restoring = true;
     try {
       await loadAuth();
       const user = auth?.currentUser;
       if (!user || user.isAnonymous || ('uid-' + user.uid) !== scope) {
         // Firebase reports that this browser is NOT signed in to this account.
         // Never grant access from the local marker alone or expose its trips.
         forgetChoice();
         resetEntry();
         setScope(null);
         location.reload();
         return;
       }
       // Existing V7.4 users are upgraded: if the verified UID has a saved
       // rider profile, it is enough to keep them signed in after an app close.
       if (storedProfileIsValid()) finishEntry(scope);
       else openProfileGate(scope); // A new/unfilled profile still requires Save.
     } catch (error) {
       // A transient offline/CDN error is NOT logout. Keep saved identity and
       // try again on connectivity recovery, without deleting account data.
       show('welcome');
       setMessage('Saved login could not be verified yet. Connect to the internet and reopen MotoTrip, or tap Log in. Your profile and trips are still saved.', true);
     } finally { restoring = false; }
   }
   window.addEventListener('online', () => { if (entryRequired) void restoreAccount(); });
   document.addEventListener('visibilitychange', () => {
     if (document.visibilityState === 'visible' && entryRequired) void restoreAccount();
   });
   void restoreAccount();
 } else {
   // First-ever visit or explicit sign-out: choose Login, Sign up, or Guest.
   resetEntry();
   openDialog('welcome');
   setMessage('Choose Create account, Log in, or Guest to continue.');
 }

})();
