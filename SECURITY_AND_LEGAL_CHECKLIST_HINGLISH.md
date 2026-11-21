# MotoTrip V4.3.1 — Owner, Security & Legal Readiness

**Owner/developer (user-provided): Satish Kumar Gupta**
Website: https://mototrip.github.io/Trip-Planner/
Prepared: 21 November 2026

## Is version me add kiya
- App me proper Owner copyright footer, Terms of Use, Privacy Policy, Ownership/Intellectual Property pages.
- Legal files aur brand/owner mention app se accessible; offline PWA cache me legal pages.
- Content Security Policy (CSP) **HTML meta tag**: scripts self-origin only, network connection to Nominatim, images from OSM tile domain and self, embedded objects blocked. Note: CSP meta tag limited hai; domain/server ke real HTTP response headers jaisa secure nahi hota. Route map dynamic style ke liye inline CSS allowed hai.
- Browser Referrer Policy: strict-origin-when-cross-origin.
- Imported JSON backup ke liye 5 MiB max size + essential trip/expense/route format validation; local data structure/key `mototrip-v1` unchanged.
- App ke original code ownership notice: third-party rights excluded.
- All existing original icon files unchanged; no redesign.

## Publish karne SE PEHLE owner ko ye kaam karna hai
1. **Support & privacy email added** — satish9648291@gmail.com ko `privacy.html`, `terms.html`, `ownership.html` aur app footer mein add kar diya. Ye address publicly visible hoga. Play Console mein bhi same verified email use karo aur inbox regularly check karo. Owner jab chahe address replace kar sakta hai.
2. **Ownership ka proof rakho** — development history, dates, source backups, repository commits, original logo artwork/source. Agar collaborators ne content banaya hai to rights/license verify karo. AI-generated image par exclusive ownership automatic assume mat karo.
3. **Trademark search**: `MotoTrip` name ka prior mark check karo (https://ipindia.gov.in/). Registration certificate hone tak ® na lagao. Relevant classes and logo rights ke liye IP lawyer se review karwao.
4. **Source code copy-proof nahi**: GitHub repo public aur website JavaScript downloadable hai. `LICENSE.txt` unlicensed copying ko discourage karta hai, lekin source hide nahi karta. Real protection: private development repo + separate published build; minification limited deterrent hai, technical guarantee nahi. Existing public commits/history visible reh sakte hain even after making repo private.
5. **Map provider capacity**: Public Nominatim / OpenStreetMap free public servers have usage limitations, caching / attribution requirements. Larger user counts ke liye commercial/geocoding provider ya self-hosted option choose karo. Public Nominatim API par heavy usage nahi.
6. **Data safety claims**: Offline-only data browser mein rehta hai; optional Shared Ride mein group expenses, rider names, anonymous member ID aur settlement status Firebase ko bheje jate hain. GitHub, map services and SDK data flows bhi accurately disclose karo. Play Console Data Safety **final signed Android app** ke according fill karna.
7. **Shared Ride (V4.9)**: Firebase anonymous authentication + Firestore provided as an optional setup-required module. Publish FIREBASE_RULES.txt, verify authorized invite-only membership, update privacy/consent/data deletion process, implement owner revoke/delete administration before a wide public launch, and security test on real devices.
8. **Geo and safety**: route straight-line preview ko actual road map na batao; road distance user enter kare. Travel disclaimer maintain karo.
9. **Legal review**: India DPDP Act/Rules phased commencement, copyright ownership, consumer protections and platform policies ka lawyer/professional review karwana chahiye. Ye draft legal certification nahi hai.
10. **Backup**: before GitHub replacement: My Trips > Export Backup. Verify restored data on test device.

## Upload
ZIP extract karke root folder ke app files, including `privacy.html`, `terms.html`, `ownership.html`, `LICENSE.txt`, `sw.js`, and all original code/icon files GitHub project repo me upload/replace karo. README/checklist optional reference docs hain.

## Real protection techniques
- **Copyright:** original creative expression and source code may be copyright-protected automatically; keep dated evidence.
- **Trademark:** separate brand protection after availability search/registration.
- **Private repo:** future source work ka access kam karne ke liye; public GitHub Pages output still viewable.
- **Server-side features:** agar proprietary recommendation algorithms business secret hain, future me backend par shift karo, client side me nahi.
- **Monitoring/reporting:** obvious unauthorized copies ko GitHub/host/app store complaints ke through, ownership evidence ke saath report kar sakte ho.

Relevant sources:
- https://www.ipindia.gov.in/pages/copyright/learn/basics-of-copyright
- https://ipindia.gov.in/page-content/basics-of-trademarks
- https://support.google.com/googleplay/android-developer/answer/10144311
- https://support.google.com/googleplay/android-developer/answer/10787469
- https://operations.osmfoundation.org/policies/nominatim/
- https://operations.osmfoundation.org/policies/tiles/
- https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190655
