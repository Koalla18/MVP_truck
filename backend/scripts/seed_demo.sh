#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:8000/api/v1"
TS="$(date +%s)"

# Prefer python3 for JSON parsing.
PY=""
if command -v python3 >/dev/null 2>&1; then
  PY="python3"
elif command -v python >/dev/null 2>&1; then
  PY="python"
else
  echo "python3 not found" >&2
  exit 127
fi

json_get() {
  "$PY" -c 'import sys, json
data=json.load(sys.stdin)
key=sys.argv[1]
val=""
try:
  val=data.get(key, "") if isinstance(data, dict) else ""
except Exception:
  val=""
print(val)
' "$1"
}

OWNER_EMAIL="owner+${TS}@example.com"
OWNER_EMAIL="owner@example.com"
OWNER_PASS="owner123"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASS="admin123"
DRIVER_EMAIL="driver@example.com"
DRIVER_PASS="driver123"
COMPANY_SLUG="demo"

psql_get() {
  local sql="$1"
  docker compose exec -T postgres psql -U routox -d routox -v ON_ERROR_STOP=1 -tAc "$sql" | tr -d '\r' | tr -d ' '
}

echo "== 1) Register company + owner =="
curl -sS -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$OWNER_PASS\",\"company_name\":\"Demo Company\",\"company_slug\":\"$COMPANY_SLUG\"}" >/dev/null || true

OWNER_TOKEN=$(curl -sS -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$OWNER_PASS\"}" | json_get access_token)

COMPANY_ID=$(curl -sS "$BASE/auth/me" -H "Authorization: Bearer $OWNER_TOKEN" | json_get company_id)

echo "== 2) Create admin + driver users =="
ADMIN_ID=$(curl -sS -X POST "$BASE/users" -H "Authorization: Bearer $OWNER_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\",\"role\":\"admin\"}" 2>/dev/null | json_get id || true)

DRIVER_ID=$(curl -sS -X POST "$BASE/users" -H "Authorization: Bearer $OWNER_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$DRIVER_EMAIL\",\"password\":\"$DRIVER_PASS\",\"role\":\"driver\"}" 2>/dev/null | json_get id || true)

if [[ -z "${ADMIN_ID:-}" ]]; then
  ADMIN_ID=$(psql_get "select id from users where email='${ADMIN_EMAIL}' limit 1;")
fi
if [[ -z "${DRIVER_ID:-}" ]]; then
  DRIVER_ID=$(psql_get "select id from users where email='${DRIVER_EMAIL}' limit 1;")
fi

echo "== 3) Create a vehicle =="
PLATE="DEMO0001"
VIN="VINDEMO0001"
VEHICLE_ID=$(curl -sS -X POST "$BASE/vehicles" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Demo Truck\",\"plate\":\"$PLATE\",\"vin\":\"$VIN\"}" 2>/dev/null | json_get id || true)

if [[ -z "${VEHICLE_ID:-}" ]]; then
  VEHICLE_ID=$(psql_get "select id from vehicles where plate='${PLATE}' limit 1;")
fi

echo "== 4) Create driver_profile in DB and assign vehicle =="
DRIVER_PROFILE_ID=$(psql_get "select id from driver_profiles where user_id='${DRIVER_ID}' limit 1;")
if [[ -z "${DRIVER_PROFILE_ID:-}" ]]; then
  DRIVER_PROFILE_ID=$($PY -c 'import uuid; print(uuid.uuid4())')
  docker compose exec -T postgres psql -U routox -d routox -v ON_ERROR_STOP=1 <<SQL
INSERT INTO driver_profiles (id, company_id, user_id, name, phone, home_base, license_class, rating)
VALUES ('${DRIVER_PROFILE_ID}', '${COMPANY_ID}', '${DRIVER_ID}', 'Demo Driver', '+7 900 000-00-00', 'Demo City', 'CE', '98%');
SQL
else
  docker compose exec -T postgres psql -U routox -d routox -v ON_ERROR_STOP=1 <<SQL
UPDATE driver_profiles
SET name='Demo Driver', phone='+7 900 000-00-00', home_base='Demo City', license_class='CE', rating='98%'
WHERE id='${DRIVER_PROFILE_ID}' AND user_id='${DRIVER_ID}';
SQL
fi

docker compose exec -T postgres psql -U routox -d routox -v ON_ERROR_STOP=1 <<SQL
UPDATE vehicles
SET driver_profile_id = '${DRIVER_PROFILE_ID}'
WHERE id = '${VEHICLE_ID}' AND company_id = '${COMPANY_ID}';
SQL

echo "== 5) Create an alert to show in driver UI =="
curl -sS -X POST "$BASE/alerts/vehicle/$VEHICLE_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"message":"Демо-тревога: отклонение от маршрута","alert_type":"route"}' >/dev/null

echo "== DONE =="
echo "FRONTEND:  http://localhost:5173/login.html"
echo "BACKEND:   http://localhost:8000/docs"
echo ""
echo "OWNER  (role=owner):  $OWNER_EMAIL / $OWNER_PASS  -> owner.html"
echo "ADMIN  (role=admin):  $ADMIN_EMAIL / $ADMIN_PASS  -> index.html"
echo "DRIVER (role=driver): $DRIVER_EMAIL / $DRIVER_PASS -> driver.html"
echo ""
echo "Vehicle: $VEHICLE_ID (plate=$PLATE) assigned to driver_profile=$DRIVER_PROFILE_ID"
