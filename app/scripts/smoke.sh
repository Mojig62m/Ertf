#!/usr/bin/env bash
# =============================================================
#  آزمون دودی مسیر طلایی ارتِف
#  قابل استفاده در CI، پیش‌تولید و محلی (نیازمند: curl، jq)
#  استفاده: BASE_URL=http://localhost:4321 ./scripts/smoke.sh
# =============================================================
set -euo pipefail

BASE="${BASE_URL:-http://localhost:4321}"
V="$(mktemp)"
PASS=0
FAIL=0

check() {
  local label="$1"; shift
  if "$@"; then
    echo "PASS: $label" | tee -a "$V"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $label" | tee -a "$V"
    FAIL=$((FAIL + 1))
  fi
}

echo "آزمون دودی مسیر طلایی — $BASE"

# ۱) زنده‌بودن
check "سلامت (liveness)" bash -c "curl -sf '$BASE/api/health' | jq -e '.ok == true' > /dev/null"
# ۲) آمادگی (readiness + دیتابیس)
check "آمادگی (readiness/DB)" bash -c "curl -sf '$BASE/api/health/ready' | jq -e '.status == \"ready\"' > /dev/null"
# ۳) پنج دسته
check "پنج دسته" bash -c "curl -sf '$BASE/api/categories' | jq -e '.items | length == 5' > /dev/null"
# ۴) پنجاه محصول
check "پنجاه محصول" bash -c "curl -sf '$BASE/api/products?page_size=48' | jq -e '.total == 50' > /dev/null"
# ۵) فیلتر چندوجهی دسته + ویژگی
check "فیلتر چندوجهی" bash -c "curl -sf '$BASE/api/products?category=digital-gear&a_color=black' | jq -e '(.items | length > 0) and (.items | all(.categorySlug == \"digital-gear\"))' > /dev/null"

D="$(curl -sf "$BASE/api/products/antivirus-license")"
check "محصول دیجیتال با موجودی" bash -c "echo '$D' | jq -e '.product.isDigital == true and .availableQuantity > 0' > /dev/null"
DID="$(echo "$D" | jq '.product.id')"
P="$(curl -sf "$BASE/api/products/usb-c-cable")"
PID="$(echo "$P" | jq '.product.id')"
KEY="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)"

printf '{"idempotencyKey":"%s","customer":{"name":"آزمون ارتِف","phone":"09120000000","city":"تهران","address":"خیابان نمونه، پلاک ۱","postalCode":"1234567890"},"items":[{"productId":%s,"quantity":1},{"productId":%s,"quantity":2}]}' \
  "$KEY" "$DID" "$PID" > /tmp/ertf-order.json

O1="$(curl -sf -X POST -H 'Content-Type: application/json' --data @/tmp/ertf-order.json "$BASE/api/orders")"
check "ثبت سفارش (تسویه شبیه‌سازی‌شده)" bash -c "echo '$O1' | jq -e '.order.status == \"paid_simulated\"' > /dev/null"
OID="$(echo "$O1" | jq '.order.id')"
check "صدور لایسنس دیجیتال" bash -c "echo '$O1' | jq -e '.items[0].licenseKey != null and (.items[0].licenseKey | startswith(\"ERF-\"))' > /dev/null"
check "اقلام فیزیکی بدون لایسنس" bash -c "echo '$O1' | jq -e '.items[1].licenseKey == null' > /dev/null"

O2="$(curl -sf -X POST -H 'Content-Type: application/json' --data @/tmp/ertf-order.json "$BASE/api/orders")"
check "تکرارناپذیری سفارش (idempotency)" bash -c "echo '$O2' | jq -e --argjson id '$OID' '.replay == true and .order.id == \$id' > /dev/null"
check "بازیابی سفارش و اقلام" bash -c "curl -sf '$BASE/api/orders/$OID' | jq -e --argjson id '$OID' '.order.id == \$id and (.items | length == 2)' > /dev/null"

echo "----------------------------------------"
echo "نتیجه: $PASS موفق، $FAIL ناموفق"
[ "$FAIL" -eq 0 ]
