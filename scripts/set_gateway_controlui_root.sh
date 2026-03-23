#!/usr/bin/env bash
set -euo pipefail

CFG_PATH="/var/lib/docker/volumes/openclaw-paywall_openclaw_config/_data/openclaw.json"
ROOT_PATH="${1:-}"

if [[ -z "$ROOT_PATH" ]]; then
  echo "usage: $0 <absolute_control_ui_root_path>" >&2
  exit 1
fi

python3 - "$CFG_PATH" "$ROOT_PATH" <<'PY'
import json
import pathlib
import sys

cfg_path = pathlib.Path(sys.argv[1])
root_path = sys.argv[2]
cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
cfg.setdefault("gateway", {})
cfg["gateway"].setdefault("controlUi", {})
cfg["gateway"]["controlUi"]["root"] = root_path
cfg_path.write_text(json.dumps(cfg, indent=2) + "\n", encoding="utf-8")
print(f"Set gateway.controlUi.root={root_path}")
PY

docker restart openclaw-paywall-gateway-1 >/dev/null
echo "Gateway container restarted."
