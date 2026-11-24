#!/usr/bin/env python3
"""Install and open actual MotoTrip Android APK on a Pixel emulator via adb.

This is an Android-OS test (not Chrome DevTools mobile viewport emulation).
It deliberately does NOT sign in to a real account or touch live group data.
"""
import json
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path("android-emulator-results")
OUT.mkdir(exist_ok=True)
APK = Path("android-app/app/build/outputs/apk/debug/app-debug.apk")
PACKAGE = "com.mototrip.app.twa"

def command(*args, check=True, timeout=75):
    cmd = [str(x) for x in args]
    p = subprocess.run(cmd, capture_output=True, timeout=timeout, check=False)
    if check and p.returncode:
        raise RuntimeError(f"{' '.join(cmd)} returned {p.returncode}: {p.stderr.decode(errors='replace')[-1200:]}")
    return p

def adb(*args, **kwargs):
    return command("adb", *args, **kwargs)

def save_text(filename, value):
    (OUT / filename).write_text(str(value), encoding="utf-8")

def screenshot(label):
    result = adb("exec-out", "screencap", "-p", timeout=40)
    if result.returncode or not result.stdout.startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError(f"Could not capture Android screen: {result.stderr[-600:]!r}")
    filename = f"{label}.png"
    (OUT / filename).write_bytes(result.stdout)
    print(f"PHONE_SCREENSHOT={filename} bytes={len(result.stdout)}", flush=True)

def capture_ui(label):
    dump = adb("shell", "uiautomator", "dump", "/sdcard/mototrip-ui.xml",
               check=False, timeout=60)
    raw = adb("exec-out", "cat", "/sdcard/mototrip-ui.xml",
              check=False, timeout=40).stdout
    (OUT / f"{label}.xml").write_bytes(raw)
    if not raw.lstrip().startswith(b"<?xml"):
        return []
    nodes = []
    try:
        for item in ET.fromstring(raw).iter("node"):
            if item.attrib.get("text") or item.attrib.get("content-desc"):
                nodes.append({
                    "text": item.attrib.get("text", ""),
                    "desc": item.attrib.get("content-desc", ""),
                    "bounds": item.attrib.get("bounds", "")
                })
    except ET.ParseError:
        return []
    save_text(f"{label}-visible-text.json", json.dumps(nodes, indent=2, ensure_ascii=False))
    print("VISIBLE_ANDROID_UI="+str([n['text'] or n['desc'] for n in nodes][:30]), flush=True)
    return nodes

def click_text(nodes, label):
    pat = re.compile(label, re.IGNORECASE)
    for n in nodes:
        if pat.search(n["text"]+" "+n["desc"]):
            m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",n["bounds"])
            if m:
                x1,y1,x2,y2=map(int,m.groups())
                adb("shell","input","tap",str((x1+x2)//2),str((y1+y2)//2))
                print(f"EMULATOR_TAP={label}", flush=True)
                return True
    return False

def crashlog():
    log=adb("logcat","-d","-v","time",check=False,timeout=40).stdout.decode(errors="replace")
    save_text("android-logcat.txt",log[-200000:])
    # Only count fatal errors from MotoTrip, not unrelated Google services.
    stack_traces=re.findall(r"FATAL EXCEPTION:[\s\S]{0,2500}",log)
    app_crashes=[s for s in stack_traces if PACKAGE in s or "com.mototrip.app.MainActivity" in s]
    save_text("mototrip-crashes.txt","\n---\n".join(app_crashes))
    return app_crashes

def run():
    print("ANDROID_PHONE_EMULATOR=Pixel 7 / Android 15 (API 35)",flush=True)
    assert APK.is_file(),f"Missing APK: {APK}"
    print("ANDROID_DEVICE="+adb("shell","getprop","ro.product.model").stdout.decode().strip())
    print("ANDROID_API="+adb("shell","getprop","ro.build.version.sdk").stdout.decode().strip())
    assert adb("shell","getprop","ro.build.version.sdk").stdout.decode().strip()=="35"
    packages=adb("shell","pm","list","packages").stdout.decode(errors="replace")
    save_text("browser-packages.txt","\n".join(line for line in packages.splitlines()
              if any(word in line for word in ["chrome","browser","webview","mototrip"])))
    print("BROWSER_PACKAGES="+(OUT/"browser-packages.txt").read_text().replace("\n"," | "))
    install=adb("install","-r",str(APK))
    assert b"Success" in install.stdout, "APK installation did not succeed"
    print("APK_INSTALL=PASS",flush=True)
    assert PACKAGE in adb("shell","pm","list","packages",PACKAGE).stdout.decode()
    adb("shell","settings","put","system","accelerometer_rotation","0",check=False)
    adb("shell","settings","put","system","user_rotation","0",check=False)
    adb("logcat","-c",check=False)
    launch=adb("shell","monkey","-p",PACKAGE,"-c","android.intent.category.LAUNCHER","1")
    print("ANDROID_LAUNCH="+launch.stdout.decode(errors="replace")[-600:],flush=True)
    time.sleep(12)
    screenshot("01-android-launch")
    nodes=capture_ui("01-android-launch")
    # Give Chrome's first-run flow a chance to show; never sign into a real user.
    for attempt in range(5):
        joined=" ".join((n["text"]+" "+n["desc"]) for n in nodes).lower()
        if "continue as guest" in joined or "create free account" in joined or "welcome to mototrip" in joined:
            break
        if any(term in joined for term in ["welcome to chrome","make chrome your own","sign in to chrome","choose an account"]):
            if click_text(nodes,r"Use without an account|No thanks|Skip|Not now|Accept.*continue"):
                time.sleep(5)
                nodes=capture_ui(f"chrome-setup-{attempt}")
                continue
        time.sleep(6)
        nodes=capture_ui(f"launch-poll-{attempt}")
    screenshot("02-phone-visible")
    joined=" ".join((n["text"]+" "+n["desc"]) for n in nodes).lower()
    # Fail if a blank browser, first-run blocker, network error or dead app is shown.
    assert any(token in joined for token in
        ["continue as guest","create free account","welcome to mototrip"]), (
        "MotoTrip onboarding not visible on Android emulator. Inspect screenshots "
        "and UI hierarchy: may be Chrome first-run, TWA fallback or network failure. "
        "This is NOT a passing app launch.")
    print("ANDROID_TWA_PAGE_RENDER=PASS",flush=True)
    if click_text(nodes,r"Continue as Guest"):
        time.sleep(4)
        nodes=capture_ui("03-guest-profile")
        screenshot("03-guest-profile")
        text=" ".join(n["text"] for n in nodes).lower()
        assert any(x in text for x in ["your name","rider profile","step 2 of 2","save & continue"]), \
          "Guest tap did not reach Rider Profile onboarding"
        print("ANDROID_GUEST_ONBOARDING=PASS",flush=True)
    adb("shell","input","keyevent","4",check=False)
    time.sleep(2)
    screenshot("04-android-back")
    adb("shell","monkey","-p",PACKAGE,"1",check=False)
    time.sleep(5)
    screenshot("05-relaunch")
    capture_ui("05-relaunch")
    crashes=crashlog()
    assert not crashes, f"Fatal MotoTrip Android crash: {crashes[0][-900:]}"
    print("ANDROID_MOTOTRIP_FATAL_CRASHES=0",flush=True)
    print("ANDROID_EMULATOR_SMOKE_OK",flush=True)

if __name__=="__main__":
    try:
        run()
    except Exception as e:
        print("ANDROID_EMULATOR_SMOKE_FAILED="+str(e),file=sys.stderr,flush=True)
        try:
            screenshot("failure-phone-screen")
            capture_ui("failure-ui")
            crashlog()
        except Exception as x:
            print("Failure diagnostics: "+str(x),file=sys.stderr)
        sys.exit(1)
