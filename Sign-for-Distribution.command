#!/bin/bash
set -euo pipefail
quant_project_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$quant_project_dir"
if [ "$(/usr/bin/uname -s)" != Darwin ]; then
  echo 'Distribution signing requires macOS and your installed Apple signing identity.' >&2; exit 1
fi
: "${QUANT_SIGNING_IDENTITY:?Set QUANT_SIGNING_IDENTITY to your full installed Developer ID Application identity.}"
: "${QUANT_NOTARY_PROFILE:?Set QUANT_NOTARY_PROFILE to your existing notarytool Keychain profile.}"
case "$QUANT_SIGNING_IDENTITY" in
  'Developer ID Application: Joe Smith ('*')'|'Developer ID Application: Fiduci Group ('*')') ;;
  *) echo 'Use an actual Developer ID Application certificate issued to Joe Smith or Fiduci Group. Attribution text is not a signing identity.' >&2; exit 1 ;;
esac
/bin/bash "$quant_project_dir/Build-on-Mac.command"
quant_dist_dir="$quant_project_dir/Build/Distribution/$(/bin/date -u +%Y%m%dT%H%M%SZ)-$$"
/bin/mkdir -p "$quant_dist_dir"
quant_signed_app="$quant_dist_dir/Quant.app"
/usr/bin/ditto "$quant_project_dir/Build/Build/Products/Release/Quant.app" "$quant_signed_app"
/usr/bin/codesign --force --sign "$QUANT_SIGNING_IDENTITY" --timestamp --options runtime --entitlements Quant.entitlements "$quant_signed_app"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$quant_signed_app"
/usr/bin/codesign -dv --verbose=4 "$quant_signed_app" 2> "$quant_dist_dir/SIGNATURE.txt"
/usr/bin/grep -Fx "Authority=$QUANT_SIGNING_IDENTITY" "$quant_dist_dir/SIGNATURE.txt" >/dev/null
"$quant_signed_app/Contents/MacOS/Quant" --self-test
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$quant_signed_app" "$quant_dist_dir/Quant-for-notary.zip"
/usr/bin/xcrun notarytool submit "$quant_dist_dir/Quant-for-notary.zip" --keychain-profile "$QUANT_NOTARY_PROFILE" --wait --output-format plist > "$quant_dist_dir/NOTARY-RESULT.plist"
test "$(/usr/libexec/PlistBuddy -c 'Print :status' "$quant_dist_dir/NOTARY-RESULT.plist")" = Accepted
/usr/bin/xcrun stapler staple "$quant_signed_app"
/usr/bin/xcrun stapler validate "$quant_signed_app"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$quant_signed_app"
/usr/sbin/spctl --assess --type execute --verbose=2 "$quant_signed_app"
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$quant_signed_app" "$quant_dist_dir/Quant-macOS.zip"
/usr/bin/shasum -a 256 "$quant_dist_dir/Quant-macOS.zip" > "$quant_dist_dir/SHA256.txt"
printf '%s\n' 'Developer ID verification and notarization passed for:' "$quant_dist_dir/Quant-macOS.zip"
