#!/bin/bash
set -euo pipefail
quant_project_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$quant_project_dir"
if [ "$(/usr/bin/uname -s)" != Darwin ]; then
  echo 'This native app must be compiled on macOS with Xcode. No app was produced.' >&2
  exit 1
fi
if ! /usr/bin/xcrun --find xcodebuild >/dev/null 2>&1; then
  echo 'Xcode is required. This script does not install or download tools.' >&2
  exit 1
fi
case "$(/usr/bin/xcode-select -p)" in
  */Contents/Developer) ;;
  *) echo 'Select a full installed Xcode in Xcode > Settings > Locations first.' >&2; exit 1 ;;
esac
quant_os_major="$(/usr/bin/sw_vers -productVersion | /usr/bin/cut -d. -f1)"
if [ "$quant_os_major" -lt 14 ]; then
  echo 'Quant requires macOS 14 or later.' >&2; exit 1
fi
# Checks accidental source changes. This checksum list is not a publisher signature.
/usr/bin/shasum -a 256 --check --status CURRENT-SHA256.txt
quant_build_dir="$quant_project_dir/Build"
mkdir -p "$quant_build_dir"
quant_report="$quant_build_dir/LOCAL-BUILD-RESULT.json"
printf '%s\n' '{"status":"STARTED_NOT_VERIFIED","developer_id_signed":false,"notarized":false}' > "$quant_report"
/usr/bin/xcodebuild -project Quant.xcodeproj -scheme Quant -configuration Release -derivedDataPath "$quant_build_dir" 'ARCHS=arm64 x86_64' ONLY_ACTIVE_ARCH=NO CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM= build
quant_app_path="$quant_build_dir/Build/Products/Release/Quant.app"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$quant_app_path"
/usr/bin/lipo -verify_arch arm64 x86_64 "$quant_app_path/Contents/MacOS/Quant"
/usr/bin/codesign -dv --verbose=4 "$quant_app_path" 2> "$quant_build_dir/LOCAL-SIGNATURE.txt"
test "$(/usr/libexec/PlistBuddy -c 'Print :QuantCreator' "$quant_app_path/Contents/Info.plist")" = 'Joe Smith'
test "$(/usr/libexec/PlistBuddy -c 'Print :QuantPublisher' "$quant_app_path/Contents/Info.plist")" = 'Fiduci Group'
"$quant_app_path/Contents/MacOS/Quant" --self-test
printf '%s\n' '{"status":"BUILD_AND_NATIVE_CHECKS_PASSED","architectures":["arm64","x86_64"],"signature":"ad-hoc","developer_id_signed":false,"notarized":false,"visual_acceptance":"NOT_RUN"}' > "$quant_report"
printf '%s\n' 'Native build and checks completed.' 'This is a local ad-hoc build, not a notarised release.' "$quant_app_path"
