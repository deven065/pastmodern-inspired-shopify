# Conversion Setup

These theme changes are live in code, but a few Shopify admin settings still need to be configured so the new UX can show the right data.

## Global Theme Settings

Open `Online Store -> Themes -> Customize -> Theme settings -> Conversion` and set:

- `Free shipping threshold`
- `Cart cross-sell collection`
- `Welcome capture` copy
- `Proof strip` labels and text
- `Shipping`, `Returns`, `Size help`, and `Support` URLs

## Product Metafields

Create these product metafields in `Settings -> Custom data -> Products`, namespace `custom`:

- `fit_summary`
  Suggested type: `Single line text` or `Multi-line text`
- `fit_signal`
  Suggested type: `Single line text`
  Example values: `True to size`, `Runs small`, `Relaxed fit`
- `model_info`
  Suggested type: `Single line text` or `Multi-line text`
- `dispatch_eta`
  Suggested type: `Single line text`
  Example: `in 3–5 business days`
- `size_guide_content`
  Suggested type: `Rich text`
- `size_guide_link`
  Suggested type: `URL`
- `ugc_quote`
  Suggested type: `Multi-line text`
- `badge_text`
  Suggested type: `Single line text`

Already supported if present:

- `custom.hover_image`
- `custom.short_description`
- `custom.delivery_timeline`
- `custom.shipping_note`
- `custom.return_note`

## Reviews

The product cards and PDP now read native review metafields:

- `product.metafields.reviews.rating`
- `product.metafields.reviews.rating_count`

Make sure your review app syncs to Shopify-compatible review metafields so cards and PDPs use the same source of truth.

## Collection Filters

In `Shopify Search & Discovery`, enable the storefront filters you want first-time shoppers to use:

- Availability
- Price
- Size
- Product type or category
- Any occasion-oriented attribute you use for merchandising

Suggested high-intent collections to maintain:

- Best Sellers
- New Arrivals
- Wedding Guest
- Bridal Events
- Occasionwear / After Dark
- Entry price edit such as `Under $200`

## Content Checklist

For the best result from the theme changes, make sure best-selling products include:

- A complete size guide
- A fit summary
- Model measurements
- Dispatch timing
- A short UGC quote or review snippet
- Review data
- A strong secondary image for collection hover states

## Notes

- The theme can read metafields and storefront filters, but it cannot create metafield definitions or Search & Discovery filter rules for you.
- Footer, cart, drawer, and PDP trust links stay hidden until their URLs are configured in theme settings.
