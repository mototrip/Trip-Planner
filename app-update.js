/* MotoTrip V6.4 — optional PWA updates.
 * A waiting update is shown to users; never force reload or clear saved data.
 * © 2026 Satish Kumar Gupta.
 */
(() => {
  'use strict';
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

  const banner = document.getElementById('mt-update-prompt');
  const updateNow = document.getElementById('mt-update-now');
  const later = document.getElementById('mt-update-later');
  const manualCheck = document.getElementById('mt-check-updates');
  let registration = null;
  let checking = false;
  let applying = false;
  let reloaded = false;
  // 'Later' means avoid disturbing the user on this tab for 12 hours.
  const SNOOZE_KEY = 'mototrip-update-later-until';
  const snoozed = () => {
    try { return Number(sessionStorage.getItem(SNOOZE_KEY) || '0') > Date.now(); }
    catch (_) { return false; }
  };
  const setStatus = message => {
    if (manualCheck) manualCheck.textContent = message;
  };

  function showAvailable(force = false) {
    if (!registration?.waiting || !navigator.serviceWorker.controller) return false;
    if (!force && snoozed()) return false;
    if (banner) banner.hidden = false;
    setStatus('↻ Check for updates');
    return true;
  }

  function trackInstallation(worker) {
    if (!worker) return;
    if (worker.state === 'installed') showAvailable();
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') showAvailable();
    });
  }

  async function checkForUpdate(manual = false) {
    if (!registration || checking) return;
    if (!navigator.onLine) {
      if (manual) setStatus('Offline — try again online');
      return;
    }
    checking = true;
    if (manual) {
      try { sessionStorage.removeItem(SNOOZE_KEY); } catch (_) {}
      setStatus('Checking for updates…');
    }
    try {
      await registration.update();
      if (registration.waiting) {
        showAvailable(manual);
      } else if (manual) {
        // Installation of a discovered SW may be asynchronous.
        setTimeout(() => {
          if (registration?.waiting) showAvailable(true);
          else setStatus('✓ App is up to date');
        }, 1200);
      }
    } catch (_) {
      if (manual) setStatus('Could not check — try again');
    } finally {
      checking = false;
    }
  }

  if (later) later.addEventListener('click', () => {
    if (banner) banner.hidden = true;
    try { sessionStorage.setItem(SNOOZE_KEY, String(Date.now() + 12 * 60 * 60 * 1000)); } catch (_) {}
  });

  if (updateNow) updateNow.addEventListener('click', () => {
    if (!registration?.waiting) {
      if (banner) banner.hidden = true;
      checkForUpdate(true);
      return;
    }
    applying = true;
    updateNow.disabled = true;
    updateNow.textContent = 'Updating…';
    // Only the user's explicit click can activate the waiting service worker.
    registration.waiting.postMessage({type: 'SKIP_WAITING'});
    // Handle a stuck activation without deleting user information.
    setTimeout(() => {
      if (applying && !reloaded && banner && !banner.hidden) {
        updateNow.disabled = false;
        updateNow.textContent = 'Try update again';
      }
    }, 15000);
  });

  if (manualCheck) manualCheck.addEventListener('click', () => checkForUpdate(true));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The browser may activate on its own when all tabs are closed; never
    // reload the currently active tab unless Update now was explicitly tapped.
    if (!applying || reloaded) return;
    reloaded = true;
    location.reload();
  });

  navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'})
    .then(reg => {
      registration = reg;
      reg.addEventListener('updatefound', () => trackInstallation(reg.installing));
      if (reg.installing) trackInstallation(reg.installing);
      if (reg.waiting) showAvailable();
      checkForUpdate();
    })
    .catch(() => setStatus('Offline update check unavailable'));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('focus', () => checkForUpdate());
  window.addEventListener('online', () => checkForUpdate());
  setInterval(() => checkForUpdate(), 15 * 60 * 1000);
})();
