/* MotoTrip V6.5 | Optional Firebase email login + PRIVATE device-only rider profile with optional opt-in Group Safety sharing.
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
 const savedProfileKey = () => profilePrefix + scope;
 const accountProfileKey = uid => profilePrefix + 'uid-' + uid;
 const afterLoginKey = 'mototrip-show-profile-after-login-v65';
 const declinedRestoreKey = uid => 'mototrip-declined-profile-restore-v65-' + uid;
 const privateTripKey = uid => 'mototrip-v1-uid-' + uid;
 const groupIsActive = () => Boolean(window.motoTripSharedRide?.active);
 const panels = ['welcome', 'signup', 'login', 'profile'];
 const setMessage = (text = '', bad = false) => { const box = $('mt-account-message'); box.textContent = text; box.dataset.bad = bad ? 'true' : 'false'; };
 function readProfile() {
   try { const val = JSON.parse(localStorage.getItem(savedProfileKey()) || 'null'); return val && typeof val === 'object' ? val : {}; }
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
   el.hidden = true;
   document.documentElement.classList.remove('mt-account-open');
   setMessage();
   try { focusBefore?.focus({preventScroll: true}); } catch (_) {}
 }
 function show(which) {
   if (!panels.includes(which)) which = 'welcome';
   for (const p of panels) $('mt-' + p + '-panel').hidden = p !== which;
   const titles = { welcome: 'Welcome to MotoTrip', signup: 'Create your account', login: 'Welcome back', profile: 'My Rider Profile' };
   $('mt-account-title').textContent = titles[which];
   $('mt-account-intro').textContent = which === 'profile' ? 'Your ride essentials, all in one private place.' : 'Plan together. Ride further. Split smarter.';
   setMessage();
   if (which === 'profile') renderProfile();
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
   try { sessionStorage.setItem(afterLoginKey, 'yes'); } catch (_) {}
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
 function saveProfile(event) {
   event.preventDefault();
   const p = {
     name: $('mt-profile-name').value.trim().slice(0, 80),
     vehicle: $('mt-profile-vehicle').value,
     gender: $('mt-profile-gender').value,
     iceName: $('mt-emergency-name').value.trim().slice(0, 80),
     icePhone: $('mt-emergency-phone').value.trim().slice(0, 22),
     blood: $('mt-profile-blood').value
   };
   if (!p.name) { setMessage('Please enter a rider name.', true); return; }
   if (p.icePhone && !/^[+0-9() .-]{7,22}$/.test(p.icePhone)) { setMessage('Check the emergency contact number.', true); return; }
   try { localStorage.setItem(savedProfileKey(), JSON.stringify(p)); }
   catch (_) { setMessage('Cannot save profile on this device. Browser storage may be blocked.', true); return; }
   if (typeof window.motoTripRefreshRiderName === 'function') window.motoTripRefreshRiderName();
   updateHeaderProfile(p.name);
   updateEmergencyCall(p.icePhone);
   window.dispatchEvent(new Event('mototrip-profile-updated'));
   markSeen();
   setMessage('✓ Profile saved privately on this device.');
   window.setTimeout(closeDialog, 450);
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
     try { localStorage.removeItem(savedProfileKey()); localStorage.removeItem(privateTripKey(u.uid)); } catch (_) {}
     setScope(null);
     markSeen();
     location.reload();
   });
 }
 function restoreProfileFromDevice() {
   if (!scope.startsWith('uid-')) return;
   if (!restorePreviousProfile(scope.slice(4))) {
     setMessage('No previous device profile was restored. Your account profile was not changed.');
     return;
   }
   renderProfile();
   fillLabel();
   if (typeof window.motoTripRefreshRiderName === 'function') window.motoTripRefreshRiderName();
   window.dispatchEvent(new Event('mototrip-profile-updated'));
   setMessage('✓ Your previous device profile has been restored.');
 }
 function clearProfile() {
   if (!confirm('Remove your rider name, emergency contact and blood group saved on this browser? Your trips and expenses will NOT be deleted.')) return;
   try { localStorage.removeItem(savedProfileKey()); } catch (_) {}
   renderProfile();
   fillLabel();
   window.dispatchEvent(new Event('mototrip-profile-updated'));
   setMessage('✓ Local rider profile deleted.');
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
 $('mt-welcome-guest').addEventListener('click', () => { markSeen(); closeDialog(); });
 for (const b of el.querySelectorAll('[data-mt-go]')) b.addEventListener('click', () => show(b.dataset.mtGo));
 $('mt-signup-panel').addEventListener('submit', signup);
 $('mt-login-panel').addEventListener('submit', login);
 $('mt-profile-form').addEventListener('submit', saveProfile);
 $('mt-profile-back').addEventListener('click', closeDialog);
 $('mt-profile-login').addEventListener('click', () => show('signup'));
 $('mt-profile-logout').addEventListener('click', logout);
 $('mt-profile-delete-account').addEventListener('click', deleteAccount);
 $('mt-profile-clear').addEventListener('click', clearProfile);
 $('mt-profile-restore')?.addEventListener('click', restoreProfileFromDevice);
 $('mt-reset-password').addEventListener('click', resetPassword);
 $('mt-emergency-phone').addEventListener('input', e => updateEmergencyCall(e.target.value));
 fillLabel();
 let welcomed = false;
 try { welcomed = Boolean(localStorage.getItem(welcomeKey)); } catch (_) {}
 let finishProfile = false;
 try {
   finishProfile = sessionStorage.getItem(afterLoginKey) === 'yes' || sessionStorage.getItem('mototrip-finish-rider-profile') === 'yes';
   sessionStorage.removeItem(afterLoginKey);
   sessionStorage.removeItem('mototrip-finish-rider-profile');
 } catch (_) {}
 if (finishProfile) {
   openDialog('profile');
   setMessage(readProfile().name ? '✓ Your saved Rider Profile is ready.' : 'Add your name to finish your private Rider Profile.');
 } else if (!welcomed) openDialog('welcome');
})();
