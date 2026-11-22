# MotoTrip Android APK + iPhone link (V9.15)

**iPhone:** https://mototrip.github.io/Trip-Planner/ — Safari > Share > Add to Home Screen.

**Android:** GitHub Actions se Android APK build hoga. Is bundle mein **Android project source hai, APK nahi**. APK ko Windows PC par compile karne ki jagah GitHub ke Android build runner par compile kar sakte ho.

## Pehla test APK (sabse aasaan)

1. https://github.com/mototrip/Trip-Planner open karo. Repository ki owner/path confirm karna.
2. Is ZIP ko extract karo. **Sirf** `android-app` folder aur `.github/workflows/build-mototrip-android-apk.yml` ko repository ke SAME paths mein upload karo. Path exact same hone chahiye. **Do not** upload your private signing key or its ZIP to your repository.
3. GitHub Actions > **Build MotoTrip Android APK** > **Run workflow**. Workflow tab ki visibility ke liye `main` branch par files honi chahiye. Agar workflow push par auto run ho gaya to uska green run open kar lo.
4. Green check ke baad us run mein neeche **Artifacts > MotoTrip-Android-TEST-APK** download karo.
5. ZIP extract karo. `MotoTrip-Android-TEST.apk` Android phone ko bhejo. Phone par downloaded APK open karo, prompt par **Allow from this source**, phir Install.

NOTE: TEST APK debugging ke liye hai. Build runner ka debug signing key ephemeral ho sakta hai; naye TEST APK ko purane version ke upar install karne mein error aa sakta hai, aur uninstall karne se app ke local saved trips delete honge. Public sharing ke liye signed release workflow use karo.

## Signed release APK — directly shareable URL, same signing key across updates

1. Signing key ko private safe jagah par rakho. Agar alag PRIVATE_SIGNING_KEY zip mila hai, use kholkar `.p12` aur `GITHUB_SECRETS.txt` ko safe jagah rakho. `.p12` ko kabhi GitHub repository mein upload mat karna.
2. GitHub repository > Settings > Secrets and variables > Actions > **New repository secret**. Do secrets banao:
   - `MOTOTRIP_SIGNING_KEYSTORE_BASE64` (GITHUB_SECRETS.txt se base64 value)
   - `MOTOTRIP_SIGNING_PASSWORD` (GITHUB_SECRETS.txt se password)
3. Actions > Build MotoTrip Android APK > **Run workflow**. Isse signed **release** APK compile hoga aur GitHub Releases ke `mototrip-android` tag mein publish hoga (repo mein Actions ke `contents: write` permission allowed honi chahiye).
4. APK public direct-download URL (repo `mototrip/Trip-Planner` hone par):
   https://github.com/mototrip/Trip-Planner/releases/download/mototrip-android/MotoTrip-Android.apk
   **Ye URL tab tak work nahi karega jab tak signed release GitHub par publish nahi hua.**
5. WhatsApp/Drive se APK file direct share karo, ya release URL share karo. Yeh URL iPhone ke liye nahi hai.

## Zaroori baatein

- Android APK current website `https://mototrip.github.io/Trip-Planner/` load karta hai. App ko pehli baar kholne ke liye **internet** chahiye; website mein offline shell PWA caching ke baad ho sakti hai but complete offline parity test nahi hui.
- Website GitHub Pages par V9.15 latest update pehle upload karo, nahi to APK bhi purana website version dikhayega.
- **Android WebView ka localStorage browser/Chrome/iPhone PWA ke localStorage se ALAG hai**. Browser mein saved personal trips automatic APK mein transfer nahi honge. Website mein My Trips > Backup/Restore se manual migration ka option check karo. Kuch blob-based download flows wrapper mein kaam nahi bhi kar sakte—Chrome mein backup export kar lo.
- **Firebase cloud shared rides** authentication and sync ko physical Android device par verify karo. Email login, QR camera, GPS, map external links, file import, export, and sharing test karo. Yeh source code prepared hai, physical Android device par APK run test **nahi** hua.
- `targetSdk 34` abhi direct test sideloading ke liye hai; Play Store publication ke liye current target API requirements check karke update karo. Public release ke liye privacy policy aur Android signing key maintain karna zaroori hai.
- Signing key kho gayi to same Android package ki future updates install nahi hongi (unless uninstall + fresh install). Backup securely rakho.
- Username / screenshots / test data APK mein bundle nahi kiya gaya. Firebase configuration hosted website se hi aata hai.
