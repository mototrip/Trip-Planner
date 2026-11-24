package com.mototrip.app;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * MotoTrip Trusted Web Activity preview.
 *
 * This class delegates rendering to an installed browser. The app does not
 * create a WebView or enable JavaScript in an embedded WebView.
 *
 * The legacy WebView app uses package com.mototrip.app; this preview uses
 * com.mototrip.app.twa so existing on-device WebView data remains untouched.
 *
 * © 2026 Satish Kumar Gupta.
 */
public final class MainActivity extends LauncherActivity {
}
