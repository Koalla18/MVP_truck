#!/usr/bin/env bash
set -euo pipefail

PY=""
if [[ -x "./../.venv/bin/python" ]]; then
  PY="./../.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PY="python3"
elif command -v python >/dev/null 2>&1; then
  PY="python"
else
  echo "Python interpreter not found (need python3 or venv)" >&2
  exit 127
fi

BASE="http://localhost:8000/api/v1"
TS="$(date +%s)"
EMAIL="owner+${TS}@example.com"
PASS="Passw0rd!${TS}"
SLUG="co-${TS}"

json_get() {
  "$PY" -c 'import sys, json; print(json.load(sys.stdin)[sys.argv[1]])' "$1"
}

echo "== Register =="
curl -sS -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"company_name\":\"Test Co $TS\",\"company_slug\":\"$SLUG\"}" \
  | "$PY" -m json.tool | head

echo "== Login =="
TOKEN=$(curl -sS -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | json_get access_token)

echo "Token len: ${#TOKEN}"

echo "== /me =="
curl -sS "$BASE/auth/me" -H "Authorization: Bearer $TOKEN" | "$PY" -m json.tool | head

echo "== Create vehicle =="
PLATE="A${TS}"
VIN="VIN${TS}"
VEHICLE_ID=$(curl -sS -X POST "$BASE/vehicles" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Truck $TS\",\"plate\":\"$PLATE\",\"vin\":\"$VIN\"}" | json_get id)

echo "Vehicle: $VEHICLE_ID"

echo "== Create geozone (circle) =="
GEOZONE_ID=$(curl -sS -X POST "$BASE/geozones" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Z1","zone_type":"circle","center_lat":55.751244,"center_lon":37.618423,"radius_m":200}' \
  | json_get id)

echo "Geozone: $GEOZONE_ID"

echo "== Create telemetry API key =="
API_KEY=$(curl -sS -X POST "$BASE/telemetry/api-keys" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"ingest","rate_limit_per_min":120}' \
  | json_get api_key)

echo "API key len: ${#API_KEY}"

echo "== Telemetry ingest outside zone =="
curl -sS -X POST "$BASE/telemetry/ingest" \
  -H 'Content-Type: application/json' -H "X-API-Key: $API_KEY" \
  -d "{\"updates\":[{\"vehicle_id\":\"$VEHICLE_ID\",\"lat\":55.7600,\"lon\":37.6500,\"speed_kph\":10}]}" | "$PY" -m json.tool

echo "== Telemetry ingest inside zone =="
curl -sS -X POST "$BASE/telemetry/ingest" \
  -H 'Content-Type: application/json' -H "X-API-Key: $API_KEY" \
  -d "{\"updates\":[{\"vehicle_id\":\"$VEHICLE_ID\",\"lat\":55.751244,\"lon\":37.618423,\"speed_kph\":12}]}" | "$PY" -m json.tool

echo "== List geozone events =="
curl -sS "$BASE/geozones/events?limit=10" -H "Authorization: Bearer $TOKEN" | "$PY" -m json.tool

echo "== Audit verify =="
curl -sS "$BASE/audit/verify" -H "Authorization: Bearer $TOKEN" | "$PY" -m json.tool

echo "SMOKE_OK"
