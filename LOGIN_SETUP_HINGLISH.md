# MotoTrip V5.7 — Login + Rider Profile setup

## Step 1 — GitHub
1. `MotoTrip_V5.7_Login_Profile_Quick_Update.zip` extract karo.
2. `https://github.com/mototrip/Trip-Planner` par jao → **Add file** → **Upload files**.
3. ZIP ki app files upload/replace karo (including NEW `account.js`). **Commit changes** karo.
4. Naya app screen check karo: https://mototrip.github.io/Trip-Planner/

## Step 2 — Firebase mein Email/Password ENABLE karo (required for actual login)
1. `https://console.firebase.google.com/project/mototrip-13b38/authentication/providers` kholo.
2. **Authentication → Sign-in method** me **Add new provider** select karo.
3. **Email/Password** choose karo, pehla **Email/Password** switch Enable karo; **Email link (passwordless)** ko abhi enable mat karo.
4. **Save** dabao. Anonymous provider enabled rehne do: Shared Ride guest support ke liye.
5. MotoTrip kholo → **Create free account** → email + password enter karo.

## New user flow
- First launch: **Create free account**, **Log in** ya **Continue as Guest**.
- Sign up ke baad private Rider Profile automatically khulega (name required; emergency number, blood group, gender, vehicle optional).
- Existing users: header me **👤 Profile** click karke apna profile create ya change kar sakte hain.
- **Forgot password** registered email par reset link send karta hai.
- Sign Out / Delete Account rider profile ke andar hai. Shared Ride active ho to pehle Leave Ride karna hoga.

## Important safety/privacy
- Profile ka emergency phone/blood group PRIVATE local browser storage me hai; cloud Firestore me nahi jaata, doosre riders ko share nahi hota, aur app-level encryption nahi hai.
- Firebase account ka email/password Firebase Authentication se process hota hai. Password ko app localStorage me store nahi kiya jata.
- Guest aur registered accounts ke trips/Bill Split ke **separate local storage** hain. Existing V5.6 data Guest space me safe rehta hai. New sign up par Guest data copy karne ka optional prompt aayega. Login on another phone DOES NOT automatically sync private trips or medical profile.
- Private trip data dusre phone par chahiye toh Trips → Export backup (Excel/JSON) → other phone me Restore backup.
- Cloud Shared Ride data alag hai; Google Firestore security rules unchanged.
- Profile account deletion may require recent login, and shared ride cloud data is not automatically erased.
- User ka emergency blood group self-reported hai; professional testing se verify zaroor karein.

Owner: Satish Kumar Gupta | Support: satish9648291@gmail.com
