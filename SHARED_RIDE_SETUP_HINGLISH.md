# MotoTrip V4.9 — Shared Ride (3 dost, one Bill Split)

## Pehle yeh zaroor samjho
- Existing offline Bill Split bilkul same chalti rahegi.
- 3 phones ke live sync ke liye Firebase project banana, Web app config copy karna aur **Firestore rules publish** karna zaroori hai.
- Sirf GitHub par ZIP upload karne se cloud sync **activate nahi hota**.
- Firebase ke project credentials ya Admin SDK private keys ChatGPT/GitHub par share nahi karna. Web config app ke liye public hota hai; uski security Firestore rules se aati hai.

## Firebase setup (approximately no cost within Spark plan quota)
1. https://console.firebase.google.com/ open karo. 'Create a project' → MotoTrip.
2. Build > Authentication > Sign-in method mein **Anonymous** ON karo.
3. Build > Firestore Database mein new database banao; production mode choose karo (public test-mode mat use karna).
4. Firestore Database > Rules: is ZIP ki `FIREBASE_RULES.txt` file ka **poora** content paste karo aur Publish karo.
5. Project settings (gear icon) > Your apps > Web (</>) app register karo. Wahan se **apiKey, authDomain, projectId, appId** ko `firebase-config.js` mein fill karo. `storageBucket` etc. yahan required nahi hain.
6. Authentication > Settings > Authorized domains mein `mototrip.github.io` listed/added hona verify karo. Anonymous provider ho tab bhi authorized domains check karna achha hai.
7. Updated ZIP ki files GitHub > Trip-Planner par upload karo aur commit. Route, Bill Split and old features remain.
8. Live URL open karo. Bill Split > Shared Ride > apna naam > **Create Shared Ride**.
9. **Copy Invite Link**, WhatsApp par dost 2 and 3 ko bhejo. Wo same MotoTrip site open karke 'Join Shared Ride' karen, apna naam dalein.
10. Ek dost expense add kare, dusre phones par automatic show hona chahiye. `Mark paid`/`Undo` bhi sync hoga.

## Important behavior
- **Create** current device ki existing riders + expense history ko shared group mein copy karega (confirmation ke baad).
- **Join** current offline group ko backup mein preserve karta hai; joining shared group uski temporary view replace karega.
- **Leave** se phone par purana local group restore hoga. Ye **cloud group delete nahi karta**.
- **Invites** are long random secret tokens. Forward sirf trusted friends ko karo. Invite ka access revoke karne/room deletion ka admin UI abhi nahi hai.
- Anonymous login means cleared browser data may require the invite link again.
- **Current limit**: group document mein 100 riders, 3000 expenses, 3000 payments limit rakhi hai. Yeh large-scale team accounting ke liye nahi.
- Cross-device sync offline mein reliable nahi: **internet required**. Cloud writes fail hone par on-screen warning aayegi; reconnect karke phir se try karna hoga.
- Shared Ride feature ka Firebase integration code ready hai, lekin tumhare Firebase project se live end-to-end test **setup ke baad** hoga.

## Data protection + policies
- Firefox/Safari/Chrome ke normal browser security features aur published Firestore rules rely kiye gaye hain.
- Never switch Firestore rules to `allow read, write: if true`.
- Existing privacy.html and terms.html mein optional Shared Ride disclosures add hue hain.
- Production launch se pehle privacy/legal and cloud security assessment karna recommended hai.
