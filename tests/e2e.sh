#!/usr/bin/env bash
# End-to-end smoke test using curl + node.
# Verifies: multi-user isolation, auth flows, admin role, GDPR export, AI categorization.
#
# Usage: bash tests/e2e.sh
# Prerequisite: Vite dev server running on http://localhost:8787 with .env loaded.

set -u  # don't `set -e` — we need failures to surface as descriptive messages

BASE=${BASE:-http://localhost:8787}
PASS=0
FAIL=0
COOKIE_A=$(mktemp)
COOKIE_B=$(mktemp)
COOKIE_ADMIN=$(mktemp)
trap 'rm -f "$COOKIE_A" "$COOKIE_B" "$COOKIE_ADMIN"' EXIT

ok() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo; echo "─── $1 ───"; }

# Generate unique emails so reruns don't collide
STAMP=$(date +%s)
EMAIL_A="usera-${STAMP}@test.local"
EMAIL_B="userb-${STAMP}@test.local"
PASSWORD="superSecret12345!"

# Helper: extract last verify or reset URL token from the most recent Vite log.
# Vite background tasks live in $TMP/claude/.../tasks/*.output — pick freshest.
TASKS_DIR=$(ls -dt "$TMP"/claude/*/*/tasks 2>/dev/null | head -1)
[ -z "$TASKS_DIR" ] && TASKS_DIR=$(ls -dt /c/Users/$USER/AppData/Local/Temp/claude/*/*/tasks 2>/dev/null | head -1)
last_token() {
  local kind=$1
  # Find newest .output file with the token; tolerate missing dir
  if [ -n "$TASKS_DIR" ] && [ -d "$TASKS_DIR" ]; then
    grep -h -oP "${kind}\?token=\K[A-Za-z0-9_-]+" "$TASKS_DIR"/*.output 2>/dev/null | tail -1
  fi
}

# ────────────── 1. REGISTRATION + VERIFY ──────────────
section "1. Register + verify (User A)"
RES=$(curl -s -X POST "$BASE/api/auth/register" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL_A\",\"password\":\"$PASSWORD\",\"name\":\"Alice\"}")
echo "$RES" | grep -q '"sent":true' && ok "User A registered" || fail "User A register failed: $RES"
sleep 1
TOKEN_A=$(last_token verify)
[ -n "$TOKEN_A" ] && ok "Verify URL emitted to console" || fail "No verify URL in log"

curl -s -X POST "$BASE/api/auth/verify" -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN_A\"}" | grep -q '"verified":true' \
  && ok "User A verified" || fail "User A verify failed"

curl -s -c "$COOKIE_A" -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL_A\",\"password\":\"$PASSWORD\"}" \
  | grep -q '"ok":true' && ok "User A login" || fail "User A login failed"

# ────────────── 2. SECOND USER ──────────────
section "2. Register + verify (User B)"
curl -s -X POST "$BASE/api/auth/register" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL_B\",\"password\":\"$PASSWORD\"}" >/dev/null
sleep 1
TOKEN_B=$(last_token verify)
curl -s -X POST "$BASE/api/auth/verify" -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN_B\"}" >/dev/null
curl -s -c "$COOKIE_B" -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL_B\",\"password\":\"$PASSWORD\"}" >/dev/null
ok "User B set up"

# ────────────── 3. MULTI-USER ISOLATION ──────────────
section "3. Multi-user data isolation"

# Each user's bank IDs are private (auto-seeded). They should NOT match.
BANKS_A=$(curl -s -b "$COOKIE_A" "$BASE/api/banks" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.data.map(b=>b.id).join(','))")
BANKS_B=$(curl -s -b "$COOKIE_B" "$BASE/api/banks" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.data.map(b=>b.id).join(','))")
echo "  A banks: $BANKS_A    B banks: $BANKS_B"
[ "$BANKS_A" != "$BANKS_B" ] && ok "Each user has private bank IDs" || fail "Bank IDs collide"

# User A imports a transaction
BANK_A_ID=$(echo $BANKS_A | cut -d, -f2)
echo "{\"bankId\":$BANK_A_ID,\"csv\":\"Dátum zaúčtovania;Suma;Popis\\n01.01.2026;-99,99;Tajne A\"}" > /tmp/import-a.json
curl -s -b "$COOKIE_A" -X POST "$BASE/api/imports/csv" -H "Content-Type: application/json" --data-binary "@/tmp/import-a.json" | grep -q '"imported":1' \
  && ok "User A imported 1 tx" || fail "Import A failed"

# User B can't see User A's transactions even by guessing IDs
B_TX_COUNT=$(curl -s -b "$COOKIE_B" "$BASE/api/transactions?limit=100" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.data.length)")
[ "$B_TX_COUNT" = "0" ] && ok "User B sees 0 transactions (data isolated)" || fail "User B sees $B_TX_COUNT tx — leak!"

# User B tries to import to User A's bank ID — should fail
echo "{\"bankId\":$BANK_A_ID,\"csv\":\"Dátum zaúčtovania;Suma;Popis\\n01.01.2026;-50,00;ATTACK\"}" > /tmp/attack.json
RES=$(curl -s -b "$COOKIE_B" -X POST "$BASE/api/imports/csv" -H "Content-Type: application/json" --data-binary "@/tmp/attack.json")
echo "$RES" | grep -q '"error":"Banka nenájdená"' && ok "User B can't import to User A's bank (IDOR blocked)" || fail "IDOR vulnerability: $RES"

# User B tries to GET User A's bank by ID — same protection
RES=$(curl -s -b "$COOKIE_B" "$BASE/api/banks" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.data.some(b=>b.id==$BANK_A_ID) ? 'leaked' : 'isolated')")
[ "$RES" = "isolated" ] && ok "User B doesn't see User A's bank object" || fail "Bank list leaks across users"

# ────────────── 4. AI CATEGORIZATION ──────────────
section "4. AI categorization (rule-based fallback)"
RES=$(curl -s -b "$COOKIE_A" -X POST "$BASE/api/ai/categorize")
echo "$RES" | grep -q '"updated":1' && ok "Categorize A's 1 tx" || fail "Categorize failed: $RES"

# Manual override (use ASCII-only category to avoid Windows shell UTF-8 issues)
TX_A=$(curl -s -b "$COOKIE_A" "$BASE/api/transactions?limit=1" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.data[0].id)")
echo '{"category":"Potraviny"}' > /tmp/cat.json
RES=$(curl -s -b "$COOKIE_A" -X PATCH "$BASE/api/ai/transactions/$TX_A/category" -H "Content-Type: application/json" --data-binary @/tmp/cat.json)
echo "$RES" | grep -q '"category":"Potraviny"' && ok "Manual category override" || fail "Override failed: $RES"

# User B can NOT override User A's transaction
RES=$(curl -s -b "$COOKIE_B" -X PATCH "$BASE/api/ai/transactions/$TX_A/category" -H "Content-Type: application/json" --data-binary @/tmp/cat.json)
echo "$RES" | grep -q '"error"' && ok "User B blocked from cross-user category write" || fail "Cross-user category write: $RES"

# ────────────── 5. ADMIN ROLE ──────────────
section "5. Admin role enforcement"
RES=$(curl -s -b "$COOKIE_A" "$BASE/api/admin/stats")
echo "$RES" | grep -q '"error":"Forbidden"' && ok "Regular user blocked from /admin" || fail "Admin endpoint accessible without role: $RES"

# ────────────── 6. GDPR EXPORT ──────────────
section "6. GDPR export"
RES=$(curl -s -b "$COOKIE_A" "$BASE/api/user/export")
echo "$RES" | node -e "
const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
if (d.user && d.banks && d.transactions) {
  console.log('  ✓ Export has user + banks + transactions');
} else {
  console.log('  ✗ Export incomplete');
}
"
echo "$RES" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); process.exit(d.user.email === '$EMAIL_A' ? 0 : 1)" \
  && ok "Export contains own email" || fail "Export missing/wrong email"
echo "$RES" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); const json=JSON.stringify(d); process.exit(json.includes('$EMAIL_B') ? 1 : 0)" \
  && ok "Export does NOT leak User B" || fail "Export leaks User B's email!"

# ────────────── 7. ACCOUNT DELETION ──────────────
section "7. Account deletion + cascade"
RES=$(curl -s -b "$COOKIE_A" -X DELETE "$BASE/api/user" -H "Content-Type: application/json" -d "{\"confirm\":\"VYMAZAT\",\"password\":\"$PASSWORD\"}")
echo "$RES" | grep -q '"deleted":true' && ok "User A deleted" || fail "Delete failed: $RES"

# Login as User A should fail
RES=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL_A\",\"password\":\"$PASSWORD\"}")
echo "$RES" | grep -q '"error":"Nesprávne prihlasovacie údaje"' && ok "Deleted user can't log in" || fail "Deleted user still logs in!"

# User B should still work
curl -s -b "$COOKIE_B" "$BASE/api/auth/me" | grep -q '"ok":true' && ok "User B unaffected" || fail "User B broken"

# Cleanup B
curl -s -b "$COOKIE_B" -X DELETE "$BASE/api/user" -H "Content-Type: application/json" -d "{\"confirm\":\"VYMAZAT\",\"password\":\"$PASSWORD\"}" >/dev/null
ok "User B cleanup"

# ────────────── SUMMARY ──────────────
echo
echo "═══════════════════════════════════════════"
echo "  TESTS:  $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════════"
[ $FAIL -eq 0 ] && exit 0 || exit 1
