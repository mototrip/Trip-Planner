# MotoTrip V5.8 — Group Safety setup

**Important:** This new cloud data needs updated Firestore Rules. App ZIP upload alone is not enough.

1. **Backup:** MotoTrip → Trips → Export Backup (JSON) first.
2. **GitHub:** Upload the app files. The new file `safety.js` must be uploaded along with `index.html`, `shared-ride.js`, `style.css`, `sw.js`, and `privacy.html`.
3. **Firebase:** [MotoTrip Firestore Rules](https://console.firebase.google.com/project/mototrip-13b38/firestore/rules) → copy COMPLETE `FIREBASE_RULES.txt` from this package → replace all existing rules → Publish.
4. **Create or join** a Shared Ride and open **Bill Split → Group Safety**.
5. **Each rider** opens Profile and fills own details. Emergency info is **not** automatically shared. Rider explicitly enables **Share my emergency info**.
6. **Location** requires a separate tap on **Share My Location** and phone permission. Show/map only after they consent. Turn it off after the trip.
7. Test with 2 separate signed-in browsers: one shares emergency info, other sees it; one starts/stops GPS and other sees it appear/disappear. Verify unauthorized account cannot read safety documents.

## Important security and limitations
- Only authenticated ride members should be able to read safety docs; Firestore rules validate access and enforce each writer can change only their own safety data. Do not publish open rules.
- Invitation codes are sensitive. A working invite can be forwarded. Group-owner management/revocation is limited; test and harden before public distribution.
- Access and stale-location handling are not a substitute for emergency services. Web GPS updates require a foreground/visible phone page and an internet connection. A hidden or closed page does not provide guaranteed continuous tracking.
- Location removal from cloud may fail when offline. Other members are shown last-update status; old GPS readings must not be assumed current.
- Blood group is self-reported. Medical staff should verify actual blood type before giving blood.
- App data persists through the existing storage key. Backup before deploying new releases.

Owner: Satish Kumar Gupta
Support: satish9648291@gmail.com
