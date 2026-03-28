#!/usr/bin/env bash
set -euo pipefail

: "${SHOP:?Set SHOP first}"
: "${SHOPIFY_ACCESS_TOKEN:?Set SHOPIFY_ACCESS_TOKEN first}"

create_product() {
  local title="$1"
  local description="$2"
  local vendor="$3"
  local product_type="$4"
  local tags_json="$5"

  python3 - "$title" "$description" "$vendor" "$product_type" "$tags_json" <<'PY' | \
  curl -sS -X POST "https://${SHOP}/admin/api/2026-01/graphql.json" \
    -H "Content-Type: application/json" \
    -H "X-Shopify-Access-Token: ${SHOPIFY_ACCESS_TOKEN}" \
    -d @-
import json, sys

title, description, vendor, product_type, tags_json = sys.argv[1:6]

payload = {
    "query": "mutation productCreate($product: ProductCreateInput!) { productCreate(product: $product) { product { id title handle status } userErrors { field message } } }",
    "variables": {
        "product": {
            "title": title,
            "descriptionHtml": description,
            "vendor": vendor,
            "productType": product_type,
            "tags": json.loads(tags_json),
            "status": "ACTIVE"
        }
    }
}
print(json.dumps(payload))
PY
  echo
  echo "----------------------------------------"
}

create_product \
  "Satin Wrap Top" \
  "<p>A softly draped satin wrap top with a fluid silhouette, waist tie, and refined sheen. Designed for elevated daywear and evening styling.</p>" \
  "Atelier Rikka" \
  "Tops" \
  '["new-arrivals","tops","couture"]'

create_product \
  "Ruched Mini Dress" \
  "<p>A fitted mini dress with sculpted ruching, a clean neckline, and a flattering body-skimming shape for cocktail evenings and celebrations.</p>" \
  "Atelier Rikka" \
  "Dresses" \
  '["new-arrivals","dresses","occasionwear"]'

create_product \
  "Bridal Corset Blouse" \
  "<p>A structured bridal corset blouse with contour seaming, soft boning, and a romantic neckline. Made to pair with tailored skirts and occasion separates.</p>" \
  "Atelier Rikka" \
  "Bridal" \
  '["bridal","tops","couture"]'

create_product \
  "Bias Cut Satin Maxi Dress" \
  "<p>An elegant satin maxi dress cut on the bias for a fluid fall, minimal neckline, and elongated silhouette. Ideal for receptions and formal evenings.</p>" \
  "Atelier Rikka" \
  "Dresses" \
  '["bridal","dresses","couture"]'

create_product \
  "Structured Column Skirt" \
  "<p>A high-waisted column skirt with clean tailoring, subtle structure, and a refined line. Designed to pair with corset blouses and satin tops.</p>" \
  "Atelier Rikka" \
  "Skirts" \
  '["new-arrivals","skirts","couture"]'

echo
echo "Products created. Run ./price_products.sh to apply the market pricing in product_pricing.json."
