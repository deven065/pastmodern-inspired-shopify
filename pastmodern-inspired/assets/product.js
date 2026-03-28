/**
 * product.js — Product page interactions
 *
 * Handles:
 *  - AJAX add-to-cart (ProductForm)
 *  - Quantity stepper (QuantityStepper)
 *  - Gallery/URL sync on variant change (ProductMediaUpdater)
 *  - Gallery keyboard navigation (GalleryKeyboard)
 *
 * Dependencies: theme.js must already be loaded (ProductGallery, VariantPicker).
 */

(function () {
  'use strict';

  const shopifyRoot = () => window.Shopify?.routes?.root || '/';

  const cartApiUrl = (path) => `${shopifyRoot()}${path}`;

  /* ───────────────────────────────────────────────────────────────────────────
     ProductForm
     Intercepts the add-to-cart form submit, POSTs via fetch, then opens cart.
  ─────────────────────────────────────────────────────────────────────────── */

  class ProductForm {
    constructor(el) {
      this.form      = el;
      this.btn       = el.querySelector('[data-atc]');
      this.errEl     = el.querySelector('[data-form-error]');
      this.feedbackEl = el.querySelector('[data-atc-feedback]');

      if (!this.btn) return;
      el.addEventListener('submit', (e) => this._onSubmit(e));
    }

    async _onSubmit(e) {
      const submitter = e.submitter;

      if (submitter && !submitter.hasAttribute('data-atc')) {
        return;
      }

      e.preventDefault();
      if (this.btn.disabled) return;

      const labelAdd = this.btn.dataset.labelAdd || 'Add to bag';

      // Loading state
      this.btn.disabled = true;
      this.btn.setAttribute('aria-busy', 'true');
      if (this.errEl)     this.errEl.hidden = true;

      try {
        const res = await fetch(cartApiUrl('cart/add.js'), {
          method:  'POST',
          headers: { Accept: 'application/json' },
          body:    new FormData(this.form),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.description || 'Unable to add item to cart.');
        }

        // Notify other components (cart drawer, header count)
        document.dispatchEvent(new CustomEvent('cart:updated'));
        document.dispatchEvent(new CustomEvent('cart:open'));
        this._showFeedback('Added to bag');

      } catch (err) {
        // Surface error to user
        if (this.errEl) {
          this.errEl.textContent = err.message;
          this.errEl.hidden = false;
        }
        this._showFeedback(err.message.length < 80 ? err.message : 'Could not add to bag.');
      } finally {
        this.btn.disabled = false;
        this.btn.removeAttribute('aria-busy');
        this.btn.textContent = labelAdd;
      }
    }

    _showFeedback(msg) {
      if (!this.feedbackEl) return;
      this.feedbackEl.textContent = msg;
      this.feedbackEl.classList.add('is-visible');
      clearTimeout(this._feedbackTimer);
      this._feedbackTimer = setTimeout(
        () => this.feedbackEl.classList.remove('is-visible'),
        3200
      );
    }
  }

  /* ───────────────────────────────────────────────────────────────────────────
     QuantityStepper
     Wires [data-qty-dec] / [data-qty-inc] to [data-qty-input].
  ─────────────────────────────────────────────────────────────────────────── */

  class QuantityStepper {
    constructor(el) {
      const dec   = el.querySelector('[data-qty-dec]');
      const inc   = el.querySelector('[data-qty-inc]');
      this.input  = el.querySelector('[data-qty-input]');

      if (!dec || !inc || !this.input) return;

      dec.addEventListener('click', () => this._step(-1));
      inc.addEventListener('click', () => this._step(1));
    }

    _step(delta) {
      const min   = parseInt(this.input.min,   10) || 1;
      const max   = parseInt(this.input.max,   10) || Infinity;
      const current = parseInt(this.input.value, 10) || 1;
      const next  = Math.min(max, Math.max(min, current + delta));

      if (next !== current) {
        this.input.value = next;
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  /* ───────────────────────────────────────────────────────────────────────────
     ProductMediaUpdater
     Listens for the `variant:change` event dispatched by theme.js VariantPicker.
     Clicks the thumbnail whose data-media-id matches the variant's featured
     media, then updates the browser URL with the new ?variant= query param.
  ─────────────────────────────────────────────────────────────────────────── */

  class ProductMediaUpdater {
    constructor() {
      this.gallery = document.querySelector('[data-product-gallery]');
      if (!this.gallery) return;

      document.addEventListener('variant:change', (e) => {
        this._onVariantChange(e.detail);
      });
    }

    _onVariantChange(variant) {
      if (!variant) return;

      // Update URL without page reload
      const url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({ variantId: variant.id }, '', url.toString());

      // Activate the thumbnail matching the variant's featured media
      if (!variant.featured_media) return;
      const targetId = String(variant.featured_media.id);
      const thumbs   = this.gallery.querySelectorAll('[data-thumb]');

      const match = [...thumbs].find(
        (t) => t.dataset.mediaId === targetId
      );

      if (match && !match.classList.contains('is-active')) {
        match.click();
      }
    }
  }

  /* ───────────────────────────────────────────────────────────────────────────
     GalleryKeyboard
     Arrow-key navigation for the thumbnail strip when a thumb has keyboard focus.
     Up / Left → previous thumb
     Down / Right → next thumb
  ─────────────────────────────────────────────────────────────────────────── */

  class GalleryKeyboard {
    constructor(el) {
      this.thumbs = [...el.querySelectorAll('[data-thumb]')];
      if (this.thumbs.length < 2) return;

      el.addEventListener('keydown', (e) => this._onKeyDown(e));
    }

    _onKeyDown(e) {
      const active = document.activeElement;
      if (!active || !active.hasAttribute('data-thumb')) return;

      const idx = this.thumbs.indexOf(active);
      if (idx === -1) return;

      let next = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        next = this.thumbs[(idx + 1) % this.thumbs.length];
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        next = this.thumbs[(idx - 1 + this.thumbs.length) % this.thumbs.length];
      }

      if (next) {
        e.preventDefault();
        next.focus();
        next.click();
      }
    }
  }

  /* ───────────────────────────────────────────────────────────────────────────
     StickyATC
     Shows a fixed bottom bar on mobile when the main ATC button is off-screen.
     Proxies clicks to the main ATC button; syncs availability on variant change.
  ─────────────────────────────────────────────────────────────────────────── */

  class StickyATC {
    constructor(bar, mainBtn) {
      this.bar     = bar;
      this.mainBtn = mainBtn;

      // Proxy click
      bar.querySelector('[data-sticky-atc-btn]')
        ?.addEventListener('click', () => mainBtn.click());

      // Toggle visibility based on main ATC intersection
      const io = new IntersectionObserver(
        ([entry]) => {
          const visible = !entry.isIntersecting;
          bar.classList.toggle('is-visible', visible);
          bar.setAttribute('aria-hidden', String(!visible));
        },
        { rootMargin: '0px 0px -20px 0px', threshold: 0 }
      );
      io.observe(mainBtn);

      // Sync state on variant change
      document.addEventListener('variant:change', (e) => this._sync(e.detail));
    }

    _sync(variant) {
      if (!variant) return;
      const stickyBtn = this.bar.querySelector('[data-sticky-atc-btn]');
      if (stickyBtn) {
        stickyBtn.disabled    = !variant.available;
        stickyBtn.textContent = variant.available ? 'Add to bag' : 'Sold out';
      }
      const priceEl = this.bar.querySelector('[data-sticky-price]');
      if (priceEl && variant.price != null) {
        priceEl.textContent = this._money(variant.price);
      }
    }

    _money(cents) {
      return (cents / 100).toLocaleString(document.documentElement.lang || 'en', {
        style: 'currency',
        currency: window.Shopify?.currency?.active || 'USD',
        minimumFractionDigits: 2,
      });
    }
  }

  /* ───────────────────────────────────────────────────────────────────────────
     VariantLabelUpdater
     Keeps the "currently selected" text next to each option label in sync
     when the VariantPicker dispatches a variant:change event.
  ─────────────────────────────────────────────────────────────────────────── */

  class VariantLabelUpdater {
    constructor() {
      document.addEventListener('variant:change', (e) => {
        const variant = e.detail;
        if (!variant) return;
        document.querySelectorAll('[data-option-selected]').forEach((el) => {
          const idx = parseInt(el.dataset.optionSelected, 10);
          if (!isNaN(idx) && variant.options[idx] != null) {
            el.textContent = variant.options[idx];
          }
        });
      });
    }
  }

  /* ───────────────────────────────────────────────────────────────────────────
     GalleryFade
     Watches for src changes on [data-gallery-main] (triggered by ProductGallery
     in theme.js) and adds an "is-swapping" class to fade between images.
  ─────────────────────────────────────────────────────────────────────────── */

  class GalleryFade {
    constructor(img) {
      let lastSrc = img.src;
      new MutationObserver(() => {
        if (img.src === lastSrc) return;
        lastSrc = img.src;
        img.classList.add('is-swapping');
        const remove = () => {
          img.classList.remove('is-swapping');
          img.removeEventListener('load', remove);
        };
        img.addEventListener('load', remove);
      }).observe(img, { attributes: true, attributeFilter: ['src'] });
    }
  }

  /* ───────────────────────────────────────────────────────────────────────────
     ProductRecommendations
     Custom element — fetches the section HTML from the recommendations API
     and injects it, then registers newly added .reveal elements.
  ─────────────────────────────────────────────────────────────────────────── */

  class ProductRecommendations extends HTMLElement {
    connectedCallback() {
      const url = this.dataset.url;
      if (!url) return;

      fetch(url)
        .then((r) => r.text())
        .then((text) => {
          const doc  = new DOMParser().parseFromString(text, 'text/html');
          const body = doc.querySelector('.related-products');
          if (!body) return;
          this.innerHTML = body.outerHTML;

          // Register newly injected .reveal items
          if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver(
              (entries) =>
                entries.forEach((entry) => {
                  if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    io.unobserve(entry.target);
                  }
                }),
              { threshold: 0.1, rootMargin: '0px 0px -5% 0px' }
            );
            this.querySelectorAll('.reveal').forEach((el) => io.observe(el));
          } else {
            this.querySelectorAll('.reveal').forEach((el) =>
              el.classList.add('is-revealed')
            );
          }
        })
        .catch((err) => console.error('[ProductRecommendations]', err));
    }
  }

  /* ───────────────────────────────────────────────────────────────────────────
     Initialise all product-page components
  ─────────────────────────────────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    // Core form / stepper — uses [data-product-form]
    document.querySelectorAll('[data-product-form]').forEach(
      (el) => new ProductForm(el)
    );

    document.querySelectorAll('[data-qty-wrap]').forEach(
      (el) => new QuantityStepper(el)
    );

    // Gallery
    const gallery = document.querySelector('[data-product-gallery]');
    if (gallery) {
      new GalleryKeyboard(gallery);
      const mainImg = gallery.querySelector('[data-gallery-main]');
      if (mainImg) new GalleryFade(mainImg);
    }

    // Variant sync
    new ProductMediaUpdater();
    new VariantLabelUpdater();

    // Sticky ATC bar (mobile)
    const stickyBar = document.querySelector('[data-sticky-atc]');
    const mainAtc   = document.querySelector('[data-atc]');
    if (stickyBar && mainAtc) new StickyATC(stickyBar, mainAtc);

    // Product recommendations custom element
    if (!customElements.get('product-recommendations')) {
      customElements.define('product-recommendations', ProductRecommendations);
    }
  });

})();
