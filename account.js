/* MotoTrip V5.7 | Optional Firebase email login + PRIVATE device-only rider profile with optional opt-in Group Safety sharing.
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
 const savedProfileKey = () => 'mototrip-rider-profile-v1-' + scope;
 const privateTripKey = uid => 'mototrip-v1-uid-' + uid;
 const groupIsActive = () => Boolean(window.motoTripSharedRide?.active);
 const panels = ['welcome', 'signup', 'login', 'profile'];
 const setMessage = (text = '', bad = false) => { const box = $('mt-account-message'); box.textContent = text; box.dataset.bad = bad ? 'true' : 'false'; };
 function readProfile() {
   try { const val = JSON.parse(localStorage.getItem(savedProfileKey()) || 'null'); return val && typeof val === 'object' ? val : {}; }
   catch (_) { return {}; }
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
     const oldProfile = localStorage.getItem('mototrip-rider-profile-v1-guest');
     const target = 'mototrip-rider-profile-v1-uid-' + uid;
     if (oldProfile && !localStorage.getItem(target)) localStorage.setItem(target, oldProfile);
   } catch (e) { throw Error('Storage full/unavailable. Export a JSON backup before creating your account.'); }
 }
 function switchAndReload(uid, isNew = false) {
   // Saved offline trips MUST remain scoped to the original rider, not mixed with another login.
   if (isNew) copyGuestDataIfRequested(uid);
   setScope(uid);
   markSeen();
   if (isNew) { try { sessionStorage.setItem('mototrip-finish-rider-profile', 'yes'); } catch (_) {} }
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
   if (groupIsActive()) { setMessage('Leave the current Shared Ride first before switching to another login, so its membership is not lost.', true); return; }
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
   updateEmergencyCall(p.icePhone || '');
 }
 function updateEmergencyCall(raw) {
   const phone = String(raw || '').replace(/[^+0-9]/g, '');
   const good = /^[+]?[0-9]{7,15}$/.test(phone);
   const link = $('mt-emergency-call');
   link.hidden = !good;
   if (good) link.href = 'tel:' + phone; else link.removeAttribute('href');
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
   if ($('shared-name') && !$('shared-name').value.trim()) $('shared-name').value = p.name;
   $('mt-account-open').textContent = '👤 ' + p.name.split(' ')[0].slice(0, 13);
   updateEmergencyCall(p.icePhone);
   window.dispatchEvent(new Event('mototrip-profile-updated'));
   markSeen();
   setMessage('✓ Profile saved privately on this device.');
   window.setTimeout(closeDialog, 450);
 }
 function fillLabel() {
   const p = readProfile();
   $('mt-account-open').textContent = '👤 ' + (p.name ? p.name.split(' ')[0].slice(0, 13) : 'Profile');
   if ($('shared-name') && !$('shared-name').value.trim() && p.name) $('shared-name').value = p.name;
 }
 async function logout() {
   if (groupIsActive()) { setMessage('Leave Shared Ride before signing out. This keeps your ride membership safe.', true); return; }
   if (!confirm('Sign out of this account? Its local trips and emergency profile stay on this device. Guest data will be shown.')) return;
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
 $('mt-reset-password').addEventListener('click', resetPassword);
 $('mt-emergency-phone').addEventListener('input', e => updateEmergencyCall(e.target.value));
 fillLabel();
 let welcomed = false;
 try { welcomed = Boolean(localStorage.getItem(welcomeKey)); } catch (_) {}
 let finishProfile = false;
 try { finishProfile = sessionStorage.getItem('mototrip-finish-rider-profile') === 'yes'; sessionStorage.removeItem('mototrip-finish-rider-profile'); } catch (_) {}
 if (finishProfile) openDialog('profile');
 else if (!welcomed) openDialog('welcome');
})();
