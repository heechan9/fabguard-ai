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

# This workflow is pinned to Ubuntu 24.04 amd64. Unknown platforms fail closed.
[[ "$(lsb_release -is)" == Ubuntu && "$(lsb_release -cs)" == noble ]]
[[ "$(dpkg --print-architecture)" == amd64 ]]
keyring=/usr/share/keyrings/ubuntu-archive-keyring.gpg
[[ -r "$keyring" ]]

# Use the existing Ubuntu trust root, but not the hosted runner's regional mirror.
# All APT source/index/archive overrides are confined to this disposable directory.
apt_root="$(mktemp -d)"
trap 'sudo rm -rf -- "$apt_root"' EXIT
chmod 755 "$apt_root"
mkdir -p "$apt_root/sourceparts" "$apt_root/lists/partial" "$apt_root/archives/partial"
cat > "$apt_root/ubuntu.sources" <<SOURCE
Types: deb
URIs: https://archive.ubuntu.com/ubuntu
Suites: noble noble-updates
Components: main
Architectures: amd64
Signed-By: $keyring

Types: deb
URIs: https://security.ubuntu.com/ubuntu
Suites: noble-security
Components: main
Architectures: amd64
Signed-By: $keyring
SOURCE
apt_options=(-o Acquire::Retries=1 -o Acquire::http::Timeout=20
             -o Acquire::https::Timeout=20 -o DPkg::Lock::Timeout=20
             -o APT::Update::Error-Mode=any
             -o "Dir::Etc::sourcelist=$apt_root/ubuntu.sources"
             -o "Dir::Etc::sourceparts=$apt_root/sourceparts"
             -o "Dir::State::lists=$apt_root/lists"
             -o "Dir::Cache::archives=$apt_root/archives")
# Preserve APT signature, hash, expiry and TLS verification. Download first, then
# install once without network; a download failure never reaches dpkg installation.
sudo timeout --kill-after=10s 90s apt-get "${apt_options[@]}" update -qq
sudo timeout --kill-after=10s 240s apt-get "${apt_options[@]}" install --download-only --no-remove -y --no-install-recommends fonts-noto-cjk
sudo timeout --kill-after=10s 60s apt-get "${apt_options[@]}" install --no-download --no-remove -y --no-install-recommends fonts-noto-cjk
verify_fonts
