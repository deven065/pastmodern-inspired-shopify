/**
 * cart.js — Cart drawer for Pastmodern theme.
 *
 * Responsibilities:
 *   - Open / close drawer with accessible focus management and focus trap
 *   - AJAX quantity updates and item removal via /cart/change.js
 *   - Re-render drawer content using Shopify Section Rendering API
 *   - Keep header cart-count badge in sync
 */
(function () {
  'use strict';

  class CartDrawer {
    constructor(el) {
      this.el         = el;
      this.overlay    = document.querySelector('[data-cart-overlay]');
      this.items      = el.querySelector('[data-cart-items]');
      this.subtotal   = el.querySelector('[data-cart-subtotal]');
      this.footer     = el.querySelector('[data-cart-footer]');
      this.countEls   = document.querySelectorAll('[data-cart-count]');
      this._busy      = false;
      this._lastFocus = null;

      // ── Custom events from other modules ──────────────────
      document.addEventListener('cart:open',    () => this.open());
      document.addEventListener('cart:close',   () => this.close());
      document.addEventListener('cart:updated', () => this._syncCount());

      // ── Header cart icon(s) ────────────────────────────────
      document.querySelectorAll('[data-open-cart]').forEach((btn) => {
        btn.addEventListener('click', (e) => { e.preventDefault(); this.open(); });
      });

      // ── Close triggers ─────────────────────────────────────
      el.querySelector('[data-cart-close]')?.addEventListener('click', () => this.close());
      this.overlay?.addEventListener('click', () => this.close());
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this._isOpen()) this.close();
      });

      // ── Delegated qty + remove ─────────────────────────────
      el.addEventListener('click', (e) => {
        if (this._busy) return;
        const dec = e.target.closest('[data-qty-decrease]');
        const inc = e.target.closest('[data-qty-increase]');
        const rem = e.target.closest('[data-remove-item]');
        if (dec) this._changeQty(dec.dataset.lineKey, -1);
        if (inc) this._changeQty(inc.dataset.lineKey, +1);
        if (rem) this._setQty(rem.dataset.lineKey, 0);
      });

      // Focus-trap handler (attached/detached on open/close)
      this._focusTrapHandler = (e) => this._trapFocus(e);
    }

    /* ── State ──────────────────────────────────────────────── */

    _isOpen() {
      return this.el.hasAttribute('open');
    }

    /* ── Open / close ───────────────────────────────────────── */

    open() {
      if (this._isOpen()) return;
      this._lastFocus = document.activeElement;

      this.el.setAttribute('open', '');
      this.el.removeAttribute('aria-hidden');
      this.el.removeAttribute('inert');
      document.body.classList.add('cart-open');
      this.el.addEventListener('keydown', this._focusTrapHandler);

      // Refresh content then move focus to close button
      this._refresh().then(() => {
        this.el.querySelector('[data-cart-close]')?.focus();
      });
    }

    close() {
      if (!this._isOpen()) return;
      this.el.removeAttribute('open');
      this.el.setAttribute('aria-hidden', 'true');
      this.el.setAttribute('inert', '');
      document.body.classList.remove('cart-open');
      this.el.removeEventListener('keydown', this._focusTrapHandler);

      // Return focus to element that triggered the drawer
      (this._lastFocus instanceof HTMLElement ? this._lastFocus : document.body).focus();
    }

    /* ── Quantity helpers ───────────────────────────────────── */

    async _changeQty(key, delta) {
      const itemEl  = this.items?.querySelector(`[data-key="${CSS.escape(key)}"]`);
      const current = parseInt(itemEl?.querySelector('[data-qty-num]')?.textContent || '1', 10);
      await this._setQty(key, Math.max(0, current + delta));
    }

    async _setQty(key, qty) {
      if (this._busy) return;
      this._busy = true;
      this.items?.setAttribute('aria-busy', 'true');

      try {
        const res = await fetch('/cart/change.js', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ id: key, quantity: qty }),
        });
        if (!res.ok) throw new Error(`/cart/change.js responded ${res.status}`);
        const cart = await res.json();
        await this._refreshSection(cart);
      } catch (err) {
        console.error('[CartDrawer]', err);
      } finally {
        this._busy = false;
        this.items?.removeAttribute('aria-busy');
      }
    }

    /* ── Refresh ─────────────────────────────────────────────── */

    // Called on open — reads current cart state then re-renders section
    async _refresh() {
      try {
        const res  = await fetch('/cart.js');
        if (!res.ok) throw new Error(`/cart.js responded ${res.status}`);
        const cart = await res.json();
        await this._refreshSection(cart);
      } catch (err) {
        console.error('[CartDrawer] _refresh', err);
      }
    }

    // Re-renders drawer HTML via Shopify Section Rendering API, then updates count badge
    async _refreshSection(cart) {
      try {
        const root     = window.Shopify?.routes?.root ?? '/';
        const endpoint = `${root}?sections=cart-drawer`;
        const res      = await fetch(endpoint);
        if (!res.ok) throw new Error(`sections API responded ${res.status}`);

        const data = await res.json();
        const html = data['cart-drawer'];
        if (!html) return;

        // Parse the section HTML returned by the API
        const tmp = new DOMParser().parseFromString(html, 'text/html');

        // Swap [data-cart-items]
        const newItems = tmp.querySelector('[data-cart-items]');
        if (newItems && this.items) {
          this.items.innerHTML = newItems.innerHTML;
        }

        // Update subtotal text
        const newSubtotal = tmp.querySelector('[data-cart-subtotal]');
        if (newSubtotal && this.subtotal) {
          this.subtotal.textContent = newSubtotal.textContent.trim();
        }

        // Show/hide footer
        const newFooter = tmp.querySelector('[data-cart-footer]');
        if (newFooter && this.footer) {
          this.footer.hidden = newFooter.hasAttribute('hidden');
        }
      } catch (err) {
        // Section API unavailable — count badge still updates below
        console.error('[CartDrawer] section render error', err);
      }

      this._updateCount(cart.item_count);
    }

    // Lightweight count-only refresh (e.g. after QuickAdd from listing page)
    async _syncCount() {
      try {
        const res  = await fetch('/cart.js');
        const cart = await res.json();
        this._updateCount(cart.item_count);
      } catch (_) {}
    }

    _updateCount(count) {
      this.countEls.forEach((el) => {
        el.textContent = count;
        el.hidden = count === 0;
      });
    }

    /* ── Focus trap ─────────────────────────────────────────── */

    _trapFocus(e) {
      if (e.key !== 'Tab') return;

      const focusable = [
        ...this.el.querySelectorAll(
          'a[href]:not([disabled]), button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((el) => !el.closest('[hidden]') && el.offsetParent !== null);

      if (focusable.length === 0) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /* ── Init ────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.querySelector('[data-cart-drawer]');
    if (el) new CartDrawer(el);
  });
})();
