#!/usr/bin/env bash
# Hosted Ubuntu runner only. Keep distro signature/hash validation and font checks.
set -euo pipefail

verify_fonts() {
  local fonts font index
  fonts="$(fc-list :lang=ko)" || return 1
  [[ -n "$fonts" ]] || return 1
  font="$(fc-match --format '%{file}' 'sans-serif:lang=ko')" || return 1
  [[ -n "$font" && -f "$font" ]] || return 1
  index="$(fc-match --format '%{index}' 'sans-serif:lang=ko')" || return 1
  [[ "$index" =~ ^[0-9]+$ ]] || return 1
  # Fontconfig's selected font must contain every modern Hangul syllable.
  # A fallback family name or a successful package install is not sufficient.
  fc-query --index "$index" --format '%{charset}\n' "$font" | python3 -c '
import sys
covered = set()
for token in sys.stdin.read().split():
    ends = token.split("-")
    if len(ends) not in (1, 2):
        raise SystemExit("invalid font charset")
    start, end = int(ends[0], 16), int(ends[-1], 16)
    if not 0 <= start <= end <= 0x10ffff:
        raise SystemExit("invalid font charset range")
    covered.update(range(max(start, 0xac00), min(end, 0xd7a3) + 1))
if len(covered) != 11172:
    raise SystemExit("selected font lacks complete modern Hangul syllables")
'
}

if verify_fonts; then
  echo 'Existing Korean font verified; no package download required.'
  exit 0
fi

# Use only the runner's configured authenticated distro package repositories.
# No custom mirror, unsigned download, restored executable cache or trust override.
apt_options=(-o Acquire::Retries=1 -o Acquire::http::Timeout=20
             -o Acquire::https::Timeout=20 -o DPkg::Lock::Timeout=20)
sudo timeout --kill-after=10s 90s apt-get "${apt_options[@]}" update -qq
sudo timeout --kill-after=10s 300s apt-get "${apt_options[@]}" install -y --no-install-recommends fonts-noto-cjk
verify_fonts
