#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
test -n "$SDK"
BT="$SDK/build-tools/35.0.0"
PLATFORM="$SDK/platforms/android-35/android.jar"
test -x "$BT/aapt2" && test -f "$PLATFORM"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/assets" "$WORK/classes" "$WORK/dex" "$ROOT/dist"
cp "$ROOT/public/mobile-offline.html" "$WORK/assets/index.html"
"$BT/aapt2" compile --dir "$ROOT/mobile/android/res" -o "$WORK/resources.zip"
"$BT/aapt2" link -I "$PLATFORM" --manifest "$ROOT/mobile/android/AndroidManifest.xml" -A "$WORK/assets" -o "$WORK/base.apk" "$WORK/resources.zip"
javac --release 8 -classpath "$PLATFORM" -d "$WORK/classes" "$ROOT/mobile/android/MainActivity.java"
"$BT/d8" --min-api 24 --lib "$PLATFORM" --output "$WORK/dex" $(find "$WORK/classes" -name '*.class')
(cd "$WORK/dex" && zip -q -j "$WORK/base.apk" classes.dex)
"$BT/zipalign" -f 4 "$WORK/base.apk" "$WORK/aligned.apk"
# Local test signature; never publish this ephemeral key or use it for production updates.
keytool -genkeypair -keyalg RSA -keysize 2048 -validity 3650 -keystore "$WORK/debug.jks" -storepass android -keypass android -alias preview -dname "CN=JiZheng Offline Preview" -noprompt
"$BT/apksigner" sign --ks "$WORK/debug.jks" --ks-key-alias preview --ks-pass pass:android --key-pass pass:android --out "$ROOT/dist/JiZhengZhiXing-v0.9.0-preview.apk" "$WORK/aligned.apk"
"$BT/apksigner" verify --verbose --print-certs "$ROOT/dist/JiZhengZhiXing-v0.9.0-preview.apk"
"$BT/aapt" dump badging "$ROOT/dist/JiZhengZhiXing-v0.9.0-preview.apk" | head -15 || true
