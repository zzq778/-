#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
APP="dist/JiZhengZhiXing.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" dist
cp desktop/macos/Info.plist "$APP/Contents/Info.plist"
cp desktop/macos/bridge.js "$APP/Contents/Resources/bridge.js"
python3 desktop/macos/bundle.py "$APP/Contents/Resources/index.html"
work="$(mktemp -d)";trap 'rm -rf "$work"' EXIT
for arch in arm64 x86_64; do
  xcrun swiftc -swift-version 5 -O -target "$arch-apple-macos12.0" desktop/macos/main.swift -framework AppKit -framework WebKit -framework UniformTypeIdentifiers -o "$work/$arch"
done
lipo -create "$work/arm64" "$work/x86_64" -output "$APP/Contents/MacOS/JiZhengZhiXing"
mkdir "$work/AppIcon.iconset"
for n in 16 32 128 256; do
 sips -z "$n" "$n" public/assets/icon-512.png --out "$work/AppIcon.iconset/icon_${n}x${n}.png" >/dev/null
 sips -z "$((n*2))" "$((n*2))" public/assets/icon-512.png --out "$work/AppIcon.iconset/icon_${n}x${n}@2x.png" >/dev/null
done
sips -z 512 512 public/assets/icon-512.png --out "$work/AppIcon.iconset/icon_512x512.png" >/dev/null
sips -z 1024 1024 public/assets/icon-512.png --out "$work/AppIcon.iconset/icon_512x512@2x.png" >/dev/null
iconutil -c icns "$work/AppIcon.iconset" -o "$APP/Contents/Resources/AppIcon.icns"
codesign --force --sign - "$APP"
codesign --verify --deep --strict "$APP"
lipo -archs "$APP/Contents/MacOS/JiZhengZhiXing"
ditto -c -k --sequesterRsrc --keepParent "$APP" dist/JiZhengZhiXing-macOS-universal.zip
