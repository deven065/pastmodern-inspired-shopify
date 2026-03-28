#!/usr/bin/env bash
set -euo pipefail

: "${SHOP:?Set SHOP first}"
: "${SHOPIFY_ACCESS_TOKEN:?Set SHOPIFY_ACCESS_TOKEN first}"

PRICE_FILE="${PRICE_FILE:-product_pricing.json}"

if [[ ! -f "${PRICE_FILE}" ]]; then
  echo "Pricing file not found: ${PRICE_FILE}" >&2
  exit 1
fi

graphql() {
  local payload="$1"

  curl -sS -X POST "https://${SHOP}/admin/api/2026-01/graphql.json" \
    -H "Content-Type: application/json" \
    -H "X-Shopify-Access-Token: ${SHOPIFY_ACCESS_TOKEN}" \
    -d "${payload}"
}

python3 - "${PRICE_FILE}" <<'PY' | while IFS=$'\t' read -r title handle price; do
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)

for product in data["products"]:
    print(f'{product["title"]}\t{product["handle"]}\t{product["price"]}')
PY
  echo "Applying ${price} ${title} (${handle})"

  lookup_payload="$(python3 - "${handle}" <<'PY'
import json
import sys

handle = sys.argv[1]
payload = {
    "query": """
      query ProductByHandle($identifier: ProductIdentifierInput!) {
        product: productByIdentifier(identifier: $identifier) {
          id
          title
          handle
          variants(first: 100) {
            nodes {
              id
            }
          }
        }
      }
    """,
    "variables": {
        "identifier": {
            "handle": handle
        }
    }
}
print(json.dumps(payload))
PY
)"

  lookup_response="$(graphql "${lookup_payload}")"

  variants_json="$(python3 - "${lookup_response}" "${handle}" <<'PY'
import json
import sys

response = json.loads(sys.argv[1])
handle = sys.argv[2]

product = response.get("data", {}).get("product")
errors = response.get("errors") or []

if errors:
    raise SystemExit("GraphQL lookup failed: " + json.dumps(errors))

if not product:
    raise SystemExit(f"Product not found for handle: {handle}")

variant_ids = [node["id"] for node in product["variants"]["nodes"]]

if not variant_ids:
    raise SystemExit(f"No variants found for handle: {handle}")

print(json.dumps({
    "product_id": product["id"],
    "variant_ids": variant_ids
}))
PY
)"

  update_payload="$(python3 - "${variants_json}" "${price}" <<'PY'
import json
import sys

variant_data = json.loads(sys.argv[1])
price = sys.argv[2]

variants = [
    {
        "id": variant_id,
        "price": price
    }
    for variant_id in variant_data["variant_ids"]
]

payload = {
    "query": """
      mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants {
            id
            price
            compareAtPrice
          }
          userErrors {
            field
            message
          }
        }
      }
    """,
    "variables": {
        "productId": variant_data["product_id"],
        "variants": variants
    }
}

print(json.dumps(payload))
PY
)"

  update_response="$(graphql "${update_payload}")"

  python3 - "${update_response}" "${title}" <<'PY'
import json
import sys

response = json.loads(sys.argv[1])
title = sys.argv[2]

errors = response.get("errors") or []
user_errors = response.get("data", {}).get("productVariantsBulkUpdate", {}).get("userErrors") or []
variants = response.get("data", {}).get("productVariantsBulkUpdate", {}).get("productVariants") or []

if errors:
    raise SystemExit("GraphQL update failed for " + title + ": " + json.dumps(errors))

if user_errors:
    raise SystemExit("Variant update failed for " + title + ": " + json.dumps(user_errors))

prices = ", ".join([variant["price"] for variant in variants]) or "no variants returned"
print(f"Updated {title}: {prices}")
PY
done
