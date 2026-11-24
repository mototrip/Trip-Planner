# MotoTrip root-domain Digital Asset Links template

This directory is a **template**, NOT published on the actual website.
MotoTrip currently loads from https://mototrip.github.io/Trip-Planner/.
TWA verification requires this file at:
https://mototrip.github.io/.well-known/assetlinks.json

To host it on GitHub Pages, the account controlling **mototrip** must create a
new PUBLIC user/organization site repo exactly named `mototrip.github.io`.
Place the contents of this template at its root, enable Pages from its main
branch root, and verify the exact HTTPS URL above returns 200 and valid JSON.

The fingerprint in the template is PUBLIC and is for the **upload-key** that
signed the local candidate bundle only. It is not proof of live hosting,
a Chrome verification, or Google Play certification.

After Play Console account setup, get the **App signing certificate** SHA-256
from Play Console → App integrity → App signing. Add it to the fingerprint
array (keeping the upload fingerprint if sideloaded releases will still
be supported). Chrome validates the installed APK's certificate fingerprint.

Until the exact root-domain file is live with a matching fingerprint,
Chrome shows a URL bar / Custom Tab instead of a verified fullscreen TWA.
