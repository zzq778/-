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
python3 "$ROOT/mobile/android/bundle_site.py" "$ROOT/mobile/site" "$WORK/assets/index.html"
"$BT/aapt2" compile --dir "$ROOT/mobile/android/res" -o "$WORK/resources.zip"
"$BT/aapt2" link -I "$PLATFORM" --manifest "$ROOT/mobile/android/AndroidManifest.xml" -A "$WORK/assets" -o "$WORK/base.apk" "$WORK/resources.zip"
javac --release 8 -classpath "$PLATFORM" -d "$WORK/classes" "$ROOT/mobile/android/MainActivity.java"
"$BT/d8" --min-api 24 --lib "$PLATFORM" --output "$WORK/dex" $(find "$WORK/classes" -name '*.class')
(cd "$WORK/dex" && zip -q -j "$WORK/base.apk" classes.dex)
"$BT/zipalign" -f 4 "$WORK/base.apk" "$WORK/aligned.apk"
# If a stable, authorized preview key is supplied, reuse it; otherwise use an ephemeral test signature.
KEYSTORE="$WORK/debug.jks"
ALIAS="${ANDROID_PREVIEW_ALIAS:-preview}"
STOREPASS="${ANDROID_PREVIEW_STOREPASS:-android}"
KEYPASS="${ANDROID_PREVIEW_KEYPASS:-$STOREPASS}"
if [ -n "${ANDROID_PREVIEW_KEYSTORE_B64:-}" ]; then
  printf '%s' "$ANDROID_PREVIEW_KEYSTORE_B64" | base64 -d > "$KEYSTORE"
  chmod 600 "$KEYSTORE"
else
  echo "Using ephemeral preview signature; not an in-place update"
  keytool -genkeypair -keyalg RSA -keysize 2048 -validity 3650 -keystore "$WORK/debug.jks" -storepass android -keypass android -alias preview -dname "CN=JiZheng Online Preview" -noprompt
  ALIAS=preview; STOREPASS=android; KEYPASS=android
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias "$ALIAS" --ks-pass "pass:$STOREPASS" --key-pass "pass:$KEYPASS" --out "$ROOT/dist/JiZhengZhiXing-v1.0.5-chat-voice-preview.apk" "$WORK/aligned.apk"
"$BT/apksigner" verify --verbose --print-certs "$ROOT/dist/JiZhengZhiXing-v1.0.5-chat-voice-preview.apk"
"$BT/aapt" dump badging "$ROOT/dist/JiZhengZhiXing-v1.0.5-chat-voice-preview.apk" | head -15 || true
