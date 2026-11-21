/* MotoTrip V5.4 auto-update checker — runs in iOS Safari and Android Chrome.
 * Reloads are performed by the newly activated service worker, no user action needed.
 */
(() => {
  'use strict';
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  let registration = null;
  let checking = false;
  const update = async () => {
    if (!registration || checking || !navigator.onLine) return;
    checking = true;
    try { await registration.update(); }
    catch (error) { console.info('MotoTrip will check again when online.', error); }
    finally { checking = false; }
  };
  navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'})
    .then(reg => {
      registration = reg;
      // If an older installation left an update waiting, activate it now.
      if (reg.waiting && navigator.serviceWorker.controller) reg.waiting.postMessage({type: 'SKIP_WAITING'});
      update();
    }).catch(error => console.info('MotoTrip offline setup unavailable:', error));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') update();
  });
  window.addEventListener('focus', update);
  window.addEventListener('online', update);
  // Periodically check when the app is kept open all day, not only on new visits.
  setInterval(update, 15 * 60 * 1000);
})();
