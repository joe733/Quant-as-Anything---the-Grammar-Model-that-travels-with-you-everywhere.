#!/bin/bash
set -euo pipefail
# Package the supplied mark as a macOS icon; the source PNG is never changed.
quant_icon_root="${DERIVED_FILE_DIR:?}/Quant.iconset"
mkdir -p "$quant_icon_root"
quant_square="${DERIVED_FILE_DIR}/Quant-square.png"
/usr/bin/sips --padToHeightWidth 940 940 --padColor EEE8DC "${SRCROOT}/Resources/Room/assets/quant-art-04.png" --out "$quant_square" >/dev/null
for quant_size in 16 32 128 256 512; do
  /usr/bin/sips -z "$quant_size" "$quant_size" "$quant_square" --out "$quant_icon_root/icon_${quant_size}x${quant_size}.png" >/dev/null
  quant_double=$((quant_size * 2))
  /usr/bin/sips -z "$quant_double" "$quant_double" "$quant_square" --out "$quant_icon_root/icon_${quant_size}x${quant_size}@2x.png" >/dev/null
done
mkdir -p "${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
/usr/bin/iconutil -c icns "$quant_icon_root" -o "${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/Quant.icns"
