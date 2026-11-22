# MotoTrip V9.1 — Hosting & Assets Setup

## Kya fix hua
- `assets/trip-himalayas.webp` local trip photo.
- `assets/traveling-obsession-banner.svg` local Traveling Obsession channel promo.
- `index.html` references both using relative paths, not external hotlinks.
- `sw.js` now pre-caches both images for offline use after the site loads.
- Current CSP already includes `img-src 'self'`; no permissive external domain needed.
- Promo is labelled **CHANNEL PROMO**, not a sponsored/paid advertisement.

## GitHub Pages par publish
1. ZIP **extract** karo. Folder ke **andar ki files aur `assets/` folder** ko GitHub repo ke root me upload karo (ZIP itself nahi).
2. Confirm repository me `index.html` aur `assets/traveling-obsession-banner.svg` dono sahi path par dikh rahe hain. Filename case-sensitive hai.
3. GitHub repository → **Settings → Pages → Build and deployment → Deploy from a branch**.
4. Branch: `main`, folder: `/(root)` select kar ke Save karo. Public site URL GitHub Pages par generate hoga.
5. Site ko HTTPS par iPhone me open karo. Updated app ke liye existing MotoTrip Update prompt me **Update now** select karo. Cache stale lage to reload karo.
6. Browser DevTools Network me image request 200 status hona chahiye, na ki 404.

## Notes
- Ad image files hosting ke bina locally bhi load ho sakti hain jab app served over HTTP(S) ho; server-side database required nahi.
- GitHub Pages static files serve karta hai, Firebase account/group sync separately chalta hai.
- Existing localStorage site origin se tied hai. Domain change hone par old local trip data automatic migrate nahi hota; pehle export backup lo.
- New actual paid ads ke liye separate provider integration, creative approvals, disclosures aur CSP rules ki zaroorat hogi.
- App copy original V9.0 se li gayi hai; existing logic/storage keys intentionally unchanged.
