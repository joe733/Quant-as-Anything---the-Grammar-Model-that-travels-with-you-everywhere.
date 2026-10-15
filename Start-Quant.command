#!/bin/bash
set -euo pipefail
quant_project_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$quant_project_dir"
/bin/bash "$quant_project_dir/Build-on-Mac.command"
/usr/bin/open "$quant_project_dir/Build/Build/Products/Release/Quant.app"
