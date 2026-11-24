package com.mototrip.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/** MotoTrip Android wrapper. The LIVE website remains the application source of truth. */
public final class MainActivity extends Activity {
    private static final String APP_URL = "https://mototrip.github.io/Trip-Planner/";
    private static final String TRUSTED_ORIGIN = "https://mototrip.github.io";
    private static final int REQ_LOCATION = 4301;
    private static final int REQ_CAMERA = 4302;
    private static final int REQ_FILE = 4303;

    private WebView webView;
    private GeolocationPermissions.Callback pendingGeolocation;
    private String pendingGeolocationOrigin;
    private PermissionRequest pendingCamera;
    private ValueCallback<Uri[]> pendingFileChoice;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(17, 24, 47));
        getWindow().setNavigationBarColor(Color.rgb(17, 24, 47));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(234, 244, 255));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // Web content never needs access to local file:// documents or cross-file origins.
        settings.setAllowFileAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        // Do not allow a web page to load arbitrary content:// providers.
        // User-selected uploads are handled by the explicit Android file chooser,
        // not by allowing content:// navigation inside the WebView.
        // No JavaScript-to-native bridge is registered.
        settings.setAllowContentAccess(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                // shouldOverrideUrlLoading is not invoked for every redirect/POST.
                // Enforce a trusted origin before an unexpected top-level page runs.
                if (url != null && !"about:blank".equalsIgnoreCase(url) &&
                    !isMotoTrip(Uri.parse(url))) {
                    view.stopLoading();
                    view.loadUrl(APP_URL);
                }
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (isMotoTrip(url)) return false;
                if ("about:blank".equalsIgnoreCase(url.toString())) return false;
                // Frames may contain third-party resources; only main-frame links
                // may be opened outside the trusted MotoTrip WebView.
                if (request.isForMainFrame()) openExternal(url);
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(
                    String origin, GeolocationPermissions.Callback callback) {
                if (!TRUSTED_ORIGIN.equals(origin)) {
                    callback.invoke(origin, false, false);
                    return;
                }
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false);
                } else {
                    pendingGeolocation = callback;
                    pendingGeolocationOrigin = origin;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
                    } else {
                        denyPendingLocation();
                    }
                }
            }

            @Override public void onGeolocationPermissionsHidePrompt() {
                // Android can hide the permission prompt during navigation.
            }

            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (!TRUSTED_ORIGIN.equals(request.getOrigin().toString()) ||
                        !containsVideoRequest(request)) {
                        request.deny();
                        return;
                    }
                    if (hasCameraPermission()) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        pendingCamera = request;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
                        } else {
                            denyPendingCamera();
                        }
                    }
                });
            }

            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingCamera == request) pendingCamera = null;
            }

            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (pendingFileChoice != null) pendingFileChoice.onReceiveValue(null);
                pendingFileChoice = callback;
                try {
                    Intent intent = params.createIntent();
                    startActivityForResult(intent, REQ_FILE);
                    return true;
                } catch (ActivityNotFoundException error) {
                    pendingFileChoice = null;
                    callback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, "No file picker available", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        webView.setDownloadListener((url, userAgent, disposition, mime, length) -> {
            // HTTP URLs go to the Android browser/download handler. Blob exports need
            // additional native integration; do not pretend they were saved.
            if (url != null && (url.startsWith("https://") || url.startsWith("http://"))) {
                openExternal(Uri.parse(url));
            } else {
                Toast.makeText(this, "For backup/export downloads, open MotoTrip in Chrome",
                        Toast.LENGTH_LONG).show();
            }
        });

        // Always load the fixed HTTPS application origin, never an externally
        // supplied arbitrary WebView URL. Preserve the 32-hex Shared Ride invite
        // fragment so links keep working in the Android wrapper.
        Uri deeplink = getIntent() == null ? null : getIntent().getData();
        String launchUrl = APP_URL;
        if (isMotoTrip(deeplink)) {
            String fragment = deeplink.getFragment();
            if (fragment != null && fragment.matches("(?i)join=[0-9a-f]{32}")) {
                launchUrl = APP_URL + "#" + fragment;
            }
        }
        webView.loadUrl(launchUrl);
    }

    private boolean isMotoTrip(Uri uri) {
        return uri != null && "https".equalsIgnoreCase(uri.getScheme())
                && "mototrip.github.io".equalsIgnoreCase(uri.getHost())
                && uri.getPort() == -1
                && uri.getPath() != null && uri.getPath().startsWith("/Trip-Planner/");
    }

    private void openExternal(Uri uri) {
        if (uri == null) return;
        String scheme = uri.getScheme();
        if (scheme == null ||
            !("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)
              || "tel".equalsIgnoreCase(scheme) || "sms".equalsIgnoreCase(scheme)
              || "mailto".equalsIgnoreCase(scheme) || "geo".equalsIgnoreCase(scheme)
              || "market".equalsIgnoreCase(scheme))) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception e) {
            Toast.makeText(this, "No app available to open this link", Toast.LENGTH_SHORT).show();
        }
    }

    private boolean hasLocationPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
                checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasCameraPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
                checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean containsVideoRequest(PermissionRequest req) {
        for (String res : req.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) return true;
        }
        return false;
    }

    private void denyPendingLocation() {
        if (pendingGeolocation != null) {
            pendingGeolocation.invoke(pendingGeolocationOrigin, false, false);
            pendingGeolocation = null;
            pendingGeolocationOrigin = null;
        }
    }

    private void denyPendingCamera() {
        if (pendingCamera != null) {
            pendingCamera.deny();
            pendingCamera = null;
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions,
            int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_LOCATION && pendingGeolocation != null) {
            boolean granted = hasLocationPermission();
            pendingGeolocation.invoke(pendingGeolocationOrigin, granted, false);
            pendingGeolocation = null;
            pendingGeolocationOrigin = null;
        }
        if (requestCode == REQ_CAMERA && pendingCamera != null) {
            PermissionRequest request = pendingCamera;
            pendingCamera = null;
            if (hasCameraPermission()) request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            else request.deny();
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE && pendingFileChoice != null) {
            ValueCallback<Uri[]> callback = pendingFileChoice;
            pendingFileChoice = null;
            callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
        }
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
        CookieManager.getInstance().flush();
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override protected void onDestroy() {
        denyPendingLocation();
        denyPendingCamera();
        if (pendingFileChoice != null) {
            pendingFileChoice.onReceiveValue(null);
            pendingFileChoice = null;
        }
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
