# MotoTrip V3.9 — Play Store Preparation (Hinglish)

This ZIP is an updated **website/PWA package**, not an Android APK or AAB. It is not a claim of Google Play approval.

## What's changed
- Privacy Policy page and accessible link inside the app.
- Visible Support link.
- Local data deletion button in **My trips** (with confirmation).
- Service worker caches the privacy page for offline use; cache version updated.
- App manifest includes a stable ID and app description.
- All existing planner / expense split / payments / mileage calculator / gear / backups remain.
- **Existing browser data is preserved** because `localStorage` key remains `mototrip-v1`.

## Step 1: Existing GitHub repo update
1. First open https://mototrip.github.io/Trip-Planner/ on the same device and export a backup from **My trips** (recommended).
2. Open https://github.com/mototrip/Trip-Planner and choose **Add file → Upload files** (or edit in repo).
3. Upload only these files from this ZIP into the **root of Trip-Planner repository**:
   `index.html`, `app.js`, `split.js`, `route.js`, `style.css`, `sw.js`, `manifest.json`, `privacy.html`, `icon-192.png`, `icon-512.png`.
   Do **not** upload the ZIP as a single file and do not upload the instructions/readme as mandatory app files.
4. Commit changes; check app and https://mototrip.github.io/Trip-Planner/privacy.html.
5. Test with a browser and check that backup, restore, bike profile, calculator, expense splits and settlements all work.

## Step 2: Android app (AAB) creation
1. Visit https://www.pwabuilder.com/ and analyze your live HTTPS URL: https://mototrip.github.io/Trip-Planner/
2. Generate an Android package (Trusted Web Activity / Bubblewrap-based if offered), and build a **release AAB** with an Android toolchain and signing key.
3. Verify Android **target SDK API 36 or later** in the generated project (not set by this website ZIP).
4. Ensure app launches and all functions work on Android in both online and offline mode.
5. Review permissions, Android privacy claims, package ID and Google Play policies.

## Important: Domain verification (TWA fullscreen)
- To verify a Trusted Web Activity, Android Digital Asset Links must be available at `https://mototrip.github.io/.well-known/assetlinks.json` (DOMAIN ROOT, not under `/Trip-Planner/`).
- This is a limitation of a GitHub **project** Pages repo. A file under `Trip-Planner/.well-known/` will NOT satisfy the domain-root requirement.
- The simplest GitHub Pages solution is a separate repository named `mototrip.github.io` for the user/organization site that publishes the required `/.well-known/assetlinks.json`, provided you control that account. Or use a custom domain you control.
- The `assetlinks.json` content needs the **final Android application ID** and **SHA-256 signing certificate fingerprint**. For Play App Signing, follow the Play Console app-signing certificate details; don't invent or reuse a placeholder fingerprint.
- Re-check association with Android tools after deploying, and ensure the correct HTTPS content type / status.
- See: https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2

## Step 3: Play Console
- Register a Google Play developer account at https://play.google.com/console/ (one-time US$25 fee, subject to tax/FX).
- Supply a public privacy policy link: https://mototrip.github.io/Trip-Planner/privacy.html (only after it's really live).
- Upload signed AAB, app screenshots, feature graphic, app description, content rating, app access and Data safety answers.
- If the account is a new *personal* developer account created after 13 Nov 2023, check required closed testing (currently minimum 12 testers opted in continuously for 14 days) and request production access.
- Check current policy again before submitting. No approval is guaranteed.

## Notes on data safety declarations
- This **website/PWA code** stores entered trip/rider/budget information in browser local storage; it does not have app-owned analytics/backend requests.
- The Route Map loads map tiles from OpenStreetMap. Place lookup or map click may send user-entered search terms or selected coordinates to Nominatim; clicking **Google Maps directions** opens Google Maps with the entered starting point and up to 3 intermediate waypoints in each mobile route leg. GitHub Pages delivers static assets.
- Android packaging or third-party SDKs may create other data flows; review the **final AAB**, not just this ZIP, to answer Play Console Data safety questions accurately.
- Replace/add a direct developer support email if required by your Play developer contact settings; no email was assumed in the code.

## Testing focus
- At 320–430px mobile widths, verify navigation, table horizontal scroll, text wrapping, light/dark mode.
- Create 2 riders, add 3 expenses with different beneficiaries, record a settlement, refresh and check local persistence.
- Export backup, delete local data, then re-import and check restoration.
- In app, confirm `Privacy Policy` opens, including offline after service-worker installation.
- Verify the URL when accessed without cache. Test a physical Android device and Google Play internal test prior to release.

## V3.9 route map additions
- **Route Map**: add/edit/reorder up to 40 destinations and select coordinates on the map.
- The map uses **OpenStreetMap**, not embedded Google Maps. Pin selection works in browser without a Google API key; Google Maps driving directions open separately.
- Existing **Planner > Destination > Edit Stops** expands all selected destinations for quick editing.
- **Bike & Mileage Check** is the new text for the existing bike editor button.
- The previously approved colorful MotoTrip icon has been updated in `icon-192.png` and `icon-512.png`.
- Google Maps mobile supports up to 3 intermediate waypoints in browser URLs; the app divides longer trips into multiple linked legs.
- Road-km is **not automatically calculated**: use Google Maps to inspect road distance and enter it in **One-way km** for fuel/budget estimates.
- The live map and place-name lookup need internet. Map tiles use OpenStreetMap; place search and reverse lookup use Nominatim. Confirm service provider terms, volume limits, attribution, and privacy obligations before large-scale use.
