#!/bin/sh
# Self-test for render-plan.sh: the harness renders an authenticated plan with the session cookie rather than
# relying on ZAP variable expansion. Fixtures are assembled at run time. Exits 0 only when every assertion holds.
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d "$here/.selftest-render-XXXXXX")" || exit 1
trap 'rm -rf "$work"' EXIT INT TERM
failures=0
check() { # check <label> <0|1>
  if [ "$2" = 0 ]; then echo "$1 ok"; else echo "$1 FAIL"; failures=$((failures + 1)); fi
}
token='${SV_SESSION_COOKIE}'
printf 'rules:\n  - replacementString: "%s"\n    other: "%s"\n' "$token" "$token" >"$work/in.yaml"

cookie='authjs.session-token=aaa.bbb-ccc_ddd'
SV_SESSION_COOKIE="$cookie" sh "$here/render-plan.sh" "$work/in.yaml" "$work/out.yaml"
check 'valid cookie renders with exit 0' $?
grep -qF "replacementString: \"$cookie\"" "$work/out.yaml"; check 'rendered file holds the cookie' $?
! grep -qF "$token" "$work/out.yaml"; check 'rendered file no longer holds the token' $?
[ "$(grep -cF "$cookie" "$work/out.yaml")" = 2 ]; check 'every occurrence is replaced' $?

for case in 'empty:' 'pipe:a|b' 'amp:a&b' 'backslash:a\b' 'newline:a
b'; do
  label="${case%%:*}"; value="${case#*:}"
  rm -f "$work/bad.yaml"
  SV_SESSION_COOKIE="$value" sh "$here/render-plan.sh" "$work/in.yaml" "$work/bad.yaml" 2>/dev/null
  [ $? -ne 0 ]; check "$label value is refused" $?
  [ ! -e "$work/bad.yaml" ]; check "$label value leaves no rendered file" $?
done

rm -f "$work/bad.yaml"
env -u SV_SESSION_COOKIE sh "$here/render-plan.sh" "$work/in.yaml" "$work/bad.yaml" 2>/dev/null
[ $? -ne 0 ]; check 'unset value is refused' $?

printf 'rules: []\n' >"$work/plain.yaml"
SV_SESSION_COOKIE="$cookie" sh "$here/render-plan.sh" "$work/plain.yaml" "$work/plain-out.yaml" 2>/dev/null
[ $? -ne 0 ]; check 'a plan with no token is refused' $?

if [ "$failures" -gt 0 ]; then echo "selftest-render: $failures failed" >&2; exit 1; fi
echo 'selftest-render: all checks passed'
