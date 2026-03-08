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

  /* ───────────────────────────────────────────────────────────────────────────
     ProductForm
     Intercepts the add-to-cart form submit, POSTs via fetch, then opens cart.
  ─────────────────────────────────────────────────────────────────────────── */

  class ProductForm {
    constructor(el) {
      this.form   = el;
      this.btn    = el.querySelector('[data-atc]');
      this.errEl  = el.querySelector('[data-form-error]');

      if (!this.btn) return;
      el.addEventListener('submit', (e) => this._onSubmit(e));
    }

    async _onSubmit(e) {
      e.preventDefault();
      if (this.btn.disabled) return;

      const labelAdd = this.btn.dataset.labelAdd || 'Add to bag';

      // Loading state
      this.btn.disabled = true;
      this.btn.setAttribute('aria-busy', 'true');
      this.btn.textContent = '…';
      if (this.errEl) this.errEl.hidden = true;

      try {
        const res = await fetch('/cart/add.js', {
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

      } catch (err) {
        // Surface error to user
        if (this.errEl) {
          this.errEl.textContent = err.message;
          this.errEl.hidden = false;
        }
      } finally {
        this.btn.disabled = false;
        this.btn.removeAttribute('aria-busy');
        this.btn.textContent = labelAdd;
      }
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
     Initialise all product-page components
  ─────────────────────────────────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-product-form]').forEach(
      (el) => new ProductForm(el)
    );

    document.querySelectorAll('[data-qty-wrap]').forEach(
      (el) => new QuantityStepper(el)
    );

    new ProductMediaUpdater();

    document.querySelectorAll('[data-product-gallery]').forEach(
      (el) => new GalleryKeyboard(el)
    );
  });

})();
