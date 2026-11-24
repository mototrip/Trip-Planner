# MotoTrip: Safe Android TWA migration (24 November 2026)

## What is built
The Android project now builds a browser-managed Trusted Web Activity preview using Android Browser Helper 2.7.4.\nThe preview now targets Android API 36 to match the Google Play submission requirement.\nThe CI also validates an unsigned release AAB for packaging only; it is NOT Play-uploadable.
There is **no app-owned WebView** and no `setJavaScriptEnabled(true)` call.
The preview package is `com.mototrip.app.twa`, NOT `com.mototrip.app`.
It installs next to the original Android WebView app; it does not update, uninstall,
overwrite, or read the original app's browser storage.

The existing web application is still served from:
https://mototrip.github.io/Trip-Planner/

## Data migration: do not uninstall the old app
The existing Android WebView has a different cookie/localStorage/IndexedDB
partition from the installed Chrome/browser TWA. The preview CANNOT automatically
read or decrypt private WebView data or carry over a Firebase login session.

1. Keep the original MotoTrip app installed on the device.
2. In the **original app**, open Trip Reports and export a MotoTrip JSON backup
   (or an **All Trips** XLSX backup). Verify that the file really appeared in
   Downloads/Files AND that it is not empty before proceeding.
   **Important:** Android WebView may fail to save JavaScript-generated blob
   downloads. If no file is created, DO NOT uninstall or clear the original
   app and DO NOT assume that opening MotoTrip in Chrome exposes its old data.
3. Install the TEST TWA preview as a second app.
4. Choose Guest or sign in to Firebase again (browser sessions are separate).
5. From the new app, use Restore / Import to choose the saved MotoTrip JSON
   or XLSX backup. The import replaces the new app's local trip data and only
   happens after the on-screen confirmation.
6. Check trips, Bill Split balances, selected members, and custom gear before
   considering migration. Cloud group memberships should be checked after login.
7. Optional emergency contact, blood group and gender are stored in the old
   WebView's non-exportable device-key vault; these are NOT in trip backups.
   Re-enter optional private fields in the new app and verify consents.
8. Do not remove the original app until the data is verified in the new app.
   For legacy users whose blob export cannot be completed, retain the old app
   and do not ship a same-package automatic TWA replacement.

## Required before TWA is a real fullscreen release
**Digital Asset Links is not set up yet.** Browser helper will use a Custom Tab
with URL toolbar unless the browser verifies the exact signed Android
application against `https://mototrip.github.io/.well-known/assetlinks.json`.

- A fingerprint of the actual **release/Play app-signing certificate** is
  needed. Do not use a random GitHub Actions debug keystore fingerprint.
- The link file MUST be served at the **root of mototrip.github.io**,
  NOT at `/Trip-Planner/.well-known/assetlinks.json`.
  This project GitHub Pages repository does not control the origin root.
  The `mototrip.github.io` user-site repository / hosting needs setup.
- A sample JSON is in `docs/twa-assetlinks.example.json`. Replace the
  placeholder with the real colon-separated SHA-256 fingerprint for
  package `com.mototrip.app.twa`, then publish at the root origin.
  Verify using Digital Asset Links before claiming fullscreen TWA.
- Test on real Android devices: Chrome TWA fullscreen, fallback browser,
  Firebase email sign-in, anonymous shared ride, #join invite links,
  offline caching, camera/QR scanning, geolocation, file chooser and
  JSON/XLSX exports. Browser permission prompts differ from WebView.
- Test a stable signed release; the GitHub Actions build only publishes a
  throwaway debug APK for testing. Do not upload it as a Play Store release.

## Google Play/signing
The original app's package is `com.mototrip.app`. The preview's package
is deliberately distinct for data safety; it is not an in-place upgrade.
Do not rename it to `com.mototrip.app` without a proven export/import
migration on real devices, compatibility with the existing signing key,
and a deliberate distribution/rollback plan.

## Play Store preparation status — 24 November 2026

- [x] Target API 36 for Android 16 requirements; compileSdk 36.
- [x] Build debug APK and verify release AAB contents in GitHub Actions.
- [x] Privacy page explicitly describes the browser-managed TWA preview.
- [ ] Test the API 36 experience on Android 16 phones (edge-to-edge/insets, back navigation, permissions, file picker and orientation).
- [ ] Establish a stable Android signing keystore and configure secure signing (do not commit passwords or keystore files).
- [ ] Confirm production package name. The safe preview uses `com.mototrip.app.twa` and cannot silently replace the legacy `com.mototrip.app` app.
- [ ] Publish HTTPS Digital Asset Links at `https://mototrip.github.io/.well-known/assetlinks.json` with SHA-256 from the actual release/Play app-signing certificate.
- [ ] Verify TWA launches full-screen without browser toolbar on a physical device.
- [ ] Final Google Play Data Safety form, store listing screenshots, content rating, contact info and closed testing after Play Console registration.

Note: A green CodeQL security scan and a successful unsigned AAB build are NOT Google Play approval.

## Signed AAB delivery (prepared 25 November 2026)

A new, separate **MotoTrip upload key** was generated for package `com.mototrip.app.twa`.
The key is **NOT stored in this GitHub repository**, and the same user-owned
key must be securely backed up to sign future updates. Do not regenerate an
unrelated key when releasing an update. Google Play may issue a distinct
**app-signing certificate**; Digital Asset Links for Play installs must include
that **Play app-signing certificate SHA-256** (not merely our upload key).

This repo has a manual GitHub Actions workflow `MotoTrip Signed Play Candidate`.
It requires these four **Repository Secrets** under Settings → Secrets and
variables → Actions:

- `MOTOTRIP_UPLOAD_KEYSTORE_BASE64` — Base64 of the private JKS upload key
- `MOTOTRIP_UPLOAD_STORE_PASSWORD` — keystore password
- `MOTOTRIP_UPLOAD_KEY_ALIAS` — alias
- `MOTOTRIP_UPLOAD_KEY_PASSWORD` — key password

These are deliberately **not checked into Git**. The build aborts when a
required secret is missing. The signed release bundle appears only as a
workflow artifact when all secrets are correctly configured.

An independently signed candidate AAB was also created for the current code,
but it still uses preview package/name settings and is NOT equivalent to an
approved Play Store release.

### Full-screen verification blocker

The GitHub user-site repository `mototrip/mototrip.github.io` was not
accessible at the time this code was prepared. Publishing
`Trip-Planner/.well-known/assetlinks.json` **does not work**: Digital Asset
Links requires `https://mototrip.github.io/.well-known/assetlinks.json` at
root. A root-site starter is included under
`docs/root-site-template/.well-known/assetlinks.json`; this file must be
published from a real root-site repository/host that controls the origin.
Its current certificate fingerprint is for **upload-key sideload tests only**.
After enrolling in Play App Signing, add the Play Console app-signing SHA-256
before distributing the Play-installed app. Do not claim full-screen until
it is verified on a real Android browser and device.
