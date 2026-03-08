/**
 * theme.js — Pastmodern theme interactions
 * Vanilla JS only. No external dependencies.
 */
(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
     StickyHeader
     Adds `is-sticky` to [data-header] once the page scrolls past
     a sentinel element (#header-sentinel) placed above the header.
  ───────────────────────────────────────────────────────────── */
  class StickyHeader {
    constructor(el) {
      this.el = el;

      // Insert a 1px sentinel above the header if not already present
      let sentinel = document.getElementById('header-sentinel');
      if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = 'header-sentinel';
        sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:100%;pointer-events:none;';
        document.body.insertAdjacentElement('afterbegin', sentinel);
      }

      new IntersectionObserver(
        ([entry]) => el.classList.toggle('is-sticky', !entry.isIntersecting),
        { rootMargin: '0px' }
      ).observe(sentinel);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     HeaderMenu
     Hamburger button toggles the mobile menu drawer.
     Traps focus while open; closes on Escape or overlay click.
  ───────────────────────────────────────────────────────────── */
  class HeaderMenu {
    constructor(header) {
      this.header  = header;
      this.toggle  = header.querySelector('[data-hamburger]');
      // Drawer and overlay are rendered as siblings of <header data-header>,
      // not as children — use document scope to locate them.
      this.menu    = document.querySelector('[data-mobile-menu]');
      this.overlay = document.querySelector('[data-mobile-overlay]');
      if (!this.toggle || !this.menu) return;

      this.toggle.addEventListener('click', () => this.isOpen() ? this.close() : this.open());
      this.overlay?.addEventListener('click', () => this.close());
      // Close button inside the drawer panel
      this.menu.querySelector('[data-drawer-close]')?.addEventListener('click', () => this.close());
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen()) this.close();
      });
    }

    isOpen() { return this.toggle.getAttribute('aria-expanded') === 'true'; }

    open() {
      this.toggle.setAttribute('aria-expanded', 'true');
      // CSS animates via .is-open class; aria + inert control keyboard/screen-reader access
      this.menu.classList.add('is-open');
      this.menu.removeAttribute('aria-hidden');
      this.menu.removeAttribute('inert');
      document.body.classList.add('menu-open');
      // Move focus into menu — prefer first focusable element after close button
      const firstFocusable = this.menu.querySelector('a[href], button:not([data-drawer-close])');
      (firstFocusable || this.menu.querySelector('[data-drawer-close]'))?.focus();
    }

    close() {
      this.toggle.setAttribute('aria-expanded', 'false');
      this.menu.classList.remove('is-open');
      this.menu.setAttribute('aria-hidden', 'true');
      this.menu.setAttribute('inert', '');
      document.body.classList.remove('menu-open');
      this.toggle.focus();
    }
  }

  /* ─────────────────────────────────────────────────────────────
     Accordion
     [data-accordion-trigger] toggles adjacent [data-accordion-content].
     Uses max-height animation; ARIA expanded state managed.
  ───────────────────────────────────────────────────────────── */
  class Accordion {
    constructor(el) {
      el.querySelectorAll('[data-accordion-trigger]').forEach((trigger) => {
        // Ensure ARIA state is initialised
        if (!trigger.hasAttribute('aria-expanded')) {
          trigger.setAttribute('aria-expanded', 'false');
        }
        trigger.addEventListener('click', () => this._toggle(trigger));
      });
    }

    _toggle(trigger) {
      const content = trigger.nextElementSibling;
      if (!content || !('accordionContent' in content.dataset)) return;
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      trigger.setAttribute('aria-expanded', String(!isOpen));
      if (isOpen) {
        // If expanded state used max-height: none, snap to px first so CSS can animate
        if (content.style.maxHeight === 'none' || content.style.maxHeight === '') {
          content.style.maxHeight = content.scrollHeight + 'px';
          // Force repaint before animating to 0
          content.getBoundingClientRect();
        }
        content.style.maxHeight = '0';
      } else {
        content.style.maxHeight = content.scrollHeight + 'px';
        content.addEventListener(
          'transitionend',
          () => {
            if (trigger.getAttribute('aria-expanded') === 'true') {
              content.style.maxHeight = 'none';
            }
          },
          { once: true }
        );
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────
     ProductGallery
     Clicking a [data-thumb] swaps the src/srcset on [data-gallery-main].
  ───────────────────────────────────────────────────────────── */
  class ProductGallery {
    constructor(el) {
      this.main   = el.querySelector('[data-gallery-main]');
      this.thumbs = el.querySelectorAll('[data-thumb]');
      if (!this.main || !this.thumbs.length) return;

      this.thumbs.forEach((thumb) => {
        thumb.addEventListener('click', () => this._activate(thumb));
      });
    }

    _activate(thumb) {
      this.thumbs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-pressed', 'false');
      });
      thumb.classList.add('is-active');
      thumb.setAttribute('aria-pressed', 'true');

      const img = thumb.querySelector('img');

      // Prefer data-full-src (modern Shopify CDN ?width= URLs)
      if (thumb.dataset.fullSrc) {
        this.main.src    = thumb.dataset.fullSrc;
        this.main.srcset = thumb.dataset.fullSrcset || '';
        if (img) this.main.alt = img.alt;
        return;
      }

      // Legacy fallback: rewrite _NNNx size suffix in URL
      if (!img) return;
      this.main.src    = img.src.replace(/_\d+x\d*(?=[.?])/, '_1200x');
      this.main.srcset = '';
      this.main.alt    = img.alt;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     VariantPicker
     Swatch/pill click → finds matching variant in window.__product →
     updates hidden id input and price display → fires variant:change.
  ───────────────────────────────────────────────────────────── */
  class VariantPicker {
    constructor(el) {
      this.el       = el;
      this.form     = el.closest('form');
      this.idInput  = this.form?.querySelector('input[name="id"]');
      this.product  = window.__product;
      if (!this.product || !this.idInput) return;

      el.querySelectorAll('[data-variant-option]').forEach((btn) => {
        btn.addEventListener('click', () => this._select(btn));
      });
    }

    _select(btn) {
      // Mark selected within this option group
      const group = btn.closest('[data-option-group]');
      group?.querySelectorAll('[data-variant-option]').forEach((b) => {
        b.setAttribute('aria-pressed', 'false');
      });
      btn.setAttribute('aria-pressed', 'true');

      // Collect currently selected option values
      const selected = [];
      this.el.querySelectorAll('[data-option-group]').forEach((g) => {
        const active = g.querySelector('[aria-pressed="true"]');
        selected.push(active ? active.dataset.variantOption : '');
      });

      // Find matching variant
      const variant = this.product.variants.find((v) =>
        v.options.every((opt, i) => opt === selected[i])
      );
      if (!variant) return;

      this.idInput.value = variant.id;
      this.el.dispatchEvent(new CustomEvent('variant:change', { detail: variant, bubbles: true }));
      this._updateUI(variant);
    }

    _updateUI(variant) {
      // Update price
      const priceEl = this.form?.querySelector('[data-price]');
      if (priceEl && variant.price != null) {
        priceEl.textContent = this._formatMoney(variant.price);
      }
      const compareEl = this.form?.querySelector('[data-compare-price]');
      if (compareEl) {
        compareEl.textContent = variant.compare_at_price
          ? this._formatMoney(variant.compare_at_price)
          : '';
        compareEl.hidden = !variant.compare_at_price;
      }

      // Update ATC button availability
      const atcBtn = this.form?.querySelector('[data-atc]');
      if (atcBtn) {
        atcBtn.disabled = !variant.available;
        atcBtn.textContent = variant.available ? atcBtn.dataset.labelAdd : atcBtn.dataset.labelSoldOut;
      }
    }

    _formatMoney(cents) {
      return (cents / 100).toLocaleString(document.documentElement.lang || 'en', {
        style: 'currency',
        currency: window.Shopify?.currency?.active || 'USD',
        minimumFractionDigits: 2,
      });
    }
  }

  /* ─────────────────────────────────────────────────────────────
     QuickAdd
     Delegated click on [data-quick-add] → POST /cart/add.js →
     dispatches cart:open and cart:updated events.
  ───────────────────────────────────────────────────────────── */
  const QuickAdd = {
    init() {
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-quick-add]');
        if (btn) QuickAdd.add(btn);
      });
    },

    async add(btn) {
      const variantId = btn.dataset.variantId;
      if (!variantId) return;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');

      try {
        const res = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(variantId), quantity: 1 }),
        });
        if (!res.ok) throw new Error(`Cart add failed: ${res.status}`);
        document.dispatchEvent(new CustomEvent('cart:updated'));
        document.dispatchEvent(new CustomEvent('cart:open'));
      } catch (err) {
        console.error('[QuickAdd]', err);
      } finally {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    },
  };

  /* ─────────────────────────────────────────────────────────────
     CartDrawer
     Listens for cart:open / cart:close custom events.
     Fetches /cart.js to re-render line items.
     Manages ARIA and focus trap.
  ───────────────────────────────────────────────────────────── */
  class CartDrawer {
    constructor(el) {
      this.el             = el;
      this.overlay        = el.querySelector('[data-cart-overlay]') || document.querySelector('[data-cart-overlay]');
      this.itemsContainer = el.querySelector('[data-cart-items]');
      this.subtotalEl     = el.querySelector('[data-cart-subtotal]');
      this.countEls       = document.querySelectorAll('[data-cart-count]');

      document.addEventListener('cart:open',    () => this.open());
      document.addEventListener('cart:close',   () => this.close());
      document.addEventListener('cart:updated', () => this._refreshCount());

      el.querySelector('[data-cart-close]')?.addEventListener('click', () => this.close());
      this.overlay?.addEventListener('click', () => this.close());

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && el.hasAttribute('open')) this.close();
      });
    }

    open() {
      this._refresh();
      this.el.setAttribute('open', '');
      document.body.classList.add('cart-open');
      this.el.querySelector('[data-cart-close]')?.focus();
    }

    close() {
      this.el.removeAttribute('open');
      document.body.classList.remove('cart-open');
    }

    async _refresh() {
      try {
        const res  = await fetch('/cart.js');
        const cart = await res.json();
        this._render(cart);
        this._updateCountEls(cart.item_count);
      } catch (err) {
        console.error('[CartDrawer]', err);
      }
    }

    async _refreshCount() {
      try {
        const res  = await fetch('/cart.js');
        const cart = await res.json();
        this._updateCountEls(cart.item_count);
      } catch (_) {}
    }

    _updateCountEls(count) {
      this.countEls.forEach((el) => {
        el.textContent = count;
        el.hidden = count === 0;
      });
    }

    _render(cart) {
      if (this.subtotalEl) {
        this.subtotalEl.textContent = this._formatMoney(cart.total_price);
      }
      if (!this.itemsContainer) return;

      if (cart.item_count === 0) {
        this.itemsContainer.innerHTML = '<p class="cart-empty text-muted">Your bag is empty.</p>';
        return;
      }

      this.itemsContainer.innerHTML = cart.items.map((item) => `
        <div class="cart-item" data-key="${item.key}">
          <a href="${item.url}" class="cart-item__image-link">
            <img
              src="${item.image}"
              alt="${this._escape(item.product_title)}"
              width="80" height="80"
              loading="lazy"
            >
          </a>
          <div class="cart-item__details">
            <p class="cart-item__title">${this._escape(item.product_title)}</p>
            ${item.variant_title && item.variant_title !== 'Default Title'
              ? `<p class="cart-item__variant text-muted">${this._escape(item.variant_title)}</p>`
              : ''}
            <p class="cart-item__price">${this._formatMoney(item.final_line_price)}</p>
          </div>
          <button
            class="cart-item__remove btn-ghost"
            data-remove="${item.key}"
            aria-label="Remove ${this._escape(item.product_title)}"
          >&times;</button>
        </div>
      `).join('');

      this.itemsContainer.querySelectorAll('[data-remove]').forEach((btn) => {
        btn.addEventListener('click', () => this._removeItem(btn.dataset.remove));
      });
    }

    async _removeItem(key) {
      try {
        await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: key, quantity: 0 }),
        });
        this._refresh();
      } catch (err) {
        console.error('[CartDrawer] remove error', err);
      }
    }

    _formatMoney(cents) {
      return (cents / 100).toLocaleString(document.documentElement.lang || 'en', {
        style: 'currency',
        currency: window.Shopify?.currency?.active || 'USD',
        minimumFractionDigits: 2,
      });
    }

    // Prevent XSS when injecting server-returned strings into innerHTML
    _escape(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  }

  /* ─────────────────────────────────────────────────────────────     Scroll-reveal
  ───────────────────────────────────────────────────────────────── */
  class ScrollReveal {
    constructor() {
      if (!('IntersectionObserver' in window)) {
        // Fallback: immediately reveal all elements
        document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-revealed'));
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });

      document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }
  }

  /* ─────────────────────────────────────────────────────────────────     Initialise
  ───────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    // Sticky header
    const header = document.querySelector('[data-header]');
    if (header) {
      new StickyHeader(header);
      new HeaderMenu(header);
    }

    // Accordions
    document.querySelectorAll('[data-accordion]').forEach((el) => new Accordion(el));

    // Scroll reveal
    new ScrollReveal();

    // Product gallery
    document.querySelectorAll('[data-product-gallery]').forEach((el) => new ProductGallery(el));

    // Variant picker
    document.querySelectorAll('[data-variant-picker]').forEach((el) => new VariantPicker(el));

    // Cart drawer and cart-icon binding are handled by assets/cart.js

    // Quick add
    QuickAdd.init();
  });
})();
