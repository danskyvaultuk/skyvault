#!/bin/sh
# render-plan.sh <in> <out>: write <out> as <in> with every literal ${SV_SESSION_COOKIE} replaced by the value of
# the SV_SESSION_COOKIE environment variable. ZAP 2.17.0 does not expand that variable in a replacer rule, so the
# harness renders the plan itself, inside the ZAP container, and the cookie never reaches the host's disk.
# POSIX sh and sed only: it runs on any host and inside the ZAP image. Refuses (non-zero, no <out>) an empty value,
# a value holding a sed replacement special (| & \ or a newline), and a rendered file that still holds the token.
set -eu
[ "$#" -eq 2 ] || { echo "usage: render-plan.sh <in> <out>" >&2; exit 2; }
in="$1"
out="$2"
value="${SV_SESSION_COOKIE-}"
nl='
'
[ -n "$value" ] || { echo "render-plan: SV_SESSION_COOKIE is empty or unset" >&2; exit 1; }
case "$value" in
  *'|'* | *'&'* | *'\'* | *"$nl"*) echo "render-plan: SV_SESSION_COOKIE holds a character sed would read as special" >&2; exit 1 ;;
esac
sed "s|\${SV_SESSION_COOKIE}|$value|g" "$in" >"$out.part"
if grep -qF '${SV_SESSION_COOKIE}' "$out.part"; then
  rm -f "$out.part"
  echo "render-plan: the rendered plan still holds the literal token" >&2
  exit 1
fi
if ! grep -qF "$value" "$out.part"; then
  rm -f "$out.part"
  echo "render-plan: the plan held no token to replace" >&2
  exit 1
fi
mv "$out.part" "$out"
