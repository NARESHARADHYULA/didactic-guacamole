/* =========================================================
   HemeOnc Questions – Main JavaScript
   ========================================================= */

(function () {
  'use strict';

  /* ── Mobile Navigation ─────────────────────────────────── */
  const hamburger = document.getElementById('hamburger');
  const mainNav   = document.getElementById('main-nav');

  if (hamburger && mainNav) {
    hamburger.addEventListener('click', function () {
      const isOpen = mainNav.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
    });

    // Close nav when a link is clicked
    mainNav.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        mainNav.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ── Active nav link on scroll ─────────────────────────── */
  const sections  = document.querySelectorAll('section[id], div[id]');
  const navLinks  = document.querySelectorAll('.nav-link');

  function updateActiveLink () {
    let current = '';
    sections.forEach(function (section) {
      const sTop = section.offsetTop - 80;
      if (window.scrollY >= sTop) {
        current = section.getAttribute('id');
      }
    });
    navLinks.forEach(function (link) {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', updateActiveLink, { passive: true });
  updateActiveLink();

  /* ── Sticky header shadow ──────────────────────────────── */
  const siteHeader = document.getElementById('site-header');
  window.addEventListener('scroll', function () {
    if (siteHeader) {
      siteHeader.style.boxShadow = window.scrollY > 10
        ? '0 2px 12px rgba(0,0,0,.12)'
        : '0 1px 4px rgba(0,0,0,.08)';
    }
  }, { passive: true });

  /* ── Utility: HTML escaping ────────────────────────────── */
  function escapeHtml (str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ── Books – Order Modal ───────────────────────────────── */
  var orderModal    = document.getElementById('order-modal');
  var modalClose    = document.getElementById('modal-close');
  var modalBookName = document.getElementById('modal-book-name');
  var orderForm     = document.getElementById('order-form');
  var orderSummary  = document.getElementById('order-summary');
  var orderSuccess  = document.getElementById('order-success');
  var orderSuccessMsg = document.getElementById('order-success-msg');
  var orderDoneBtn  = document.getElementById('order-done-btn');
  var currentBookTitle = '';
  var currentBookPrice = '';

  function openModal (title, price) {
    currentBookTitle = title;
    currentBookPrice = price;
    if (modalBookName) modalBookName.textContent = title + ' — ' + price + ' per copy';
    if (orderForm)    orderForm.hidden    = false;
    if (orderSuccess) orderSuccess.hidden = true;
    if (orderSummary) { orderSummary.textContent = ''; orderSummary.classList.remove('visible'); }
    if (orderForm)    orderForm.reset();
    var countryField = document.getElementById('order-country');
    if (countryField) countryField.value = 'United Kingdom';
    if (orderModal) {
      orderModal.hidden = false;
      document.body.style.overflow = 'hidden';
      var firstInput = orderModal.querySelector('input:not([readonly])');
      if (firstInput) setTimeout(function () { firstInput.focus(); }, 50);
    }
  }

  function closeModal () {
    if (orderModal) {
      orderModal.hidden = true;
      document.body.style.overflow = '';
    }
  }

  // Open modal when any "Buy Now" button is clicked
  document.querySelectorAll('.book-buy-btn').forEach(function (btn) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      openModal(
        btn.getAttribute('data-title'),
        btn.getAttribute('data-price')
      );
    });
  });

  if (modalClose)   modalClose.addEventListener('click', closeModal);
  if (orderDoneBtn) orderDoneBtn.addEventListener('click', closeModal);

  // Close modal on overlay click
  if (orderModal) {
    orderModal.addEventListener('click', function (e) {
      if (e.target === orderModal) closeModal();
    });
  }

  // Close modal on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && orderModal && !orderModal.hidden) closeModal();
  });

  // Show order summary and handle form submit
  if (orderForm) {
    orderForm.addEventListener('input', updateSummary);
    orderForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateForm()) return;
      var qty      = document.getElementById('order-qty').value;
      var name     = document.getElementById('order-name').value.trim();
      var addr1    = document.getElementById('order-addr1').value.trim();
      var addr2    = document.getElementById('order-addr2').value.trim();
      var city     = document.getElementById('order-city').value.trim();
      var county   = document.getElementById('order-county').value.trim();
      var postcode = document.getElementById('order-postcode').value.trim().toUpperCase();
      var country  = document.getElementById('order-country').value;

      var addressLines = [addr1];
      if (addr2)   addressLines.push(addr2);
      addressLines.push(city);
      if (county)  addressLines.push(county);
      addressLines.push(postcode);
      addressLines.push(country);

      var totalPrice = (parseFloat(currentBookPrice.replace(/[^0-9.]/g, '')) * parseInt(qty, 10)).toFixed(2);

      if (orderSuccessMsg) {
        orderSuccessMsg.textContent =
          'Thank you, ' + name + '! Your order of ' + qty + ' × "' + currentBookTitle +
          '" (Total: £' + totalPrice + ') will be dispatched to:\n' +
          addressLines.join(', ') + '.';
      }
      if (orderForm)    orderForm.hidden    = true;
      if (orderSuccess) orderSuccess.hidden = false;
    });
  }

  function validateForm () {
    var valid = true;
    var required = ['order-name', 'order-addr1', 'order-city', 'order-postcode', 'order-qty'];
    required.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('input-error');
      if (!el.value.trim()) {
        el.classList.add('input-error');
        valid = false;
      }
    });
    var postcodeEl = document.getElementById('order-postcode');
    if (postcodeEl && postcodeEl.value.trim()) {
      var ukPostcode = /^[A-Za-z]{1,2}[0-9][0-9A-Za-z]?\s?[0-9][A-Za-z]{2}$/;
      if (!ukPostcode.test(postcodeEl.value.trim())) {
        postcodeEl.classList.add('input-error');
        valid = false;
      }
    }
    if (!valid) {
      var firstError = orderForm.querySelector('.input-error');
      if (firstError) firstError.focus();
    }
    return valid;
  }

  function updateSummary () {
    if (!orderSummary) return;
    var qty      = document.getElementById('order-qty') ? document.getElementById('order-qty').value : '';
    var name     = document.getElementById('order-name') ? document.getElementById('order-name').value.trim() : '';
    var postcode = document.getElementById('order-postcode') ? document.getElementById('order-postcode').value.trim() : '';
    if (!qty || !currentBookPrice) return;
    var unitPrice = parseFloat(currentBookPrice.replace(/[^0-9.]/g, ''));
    var total = (unitPrice * parseInt(qty, 10)).toFixed(2);
    var summary = '<strong>' + escapeHtml(currentBookTitle) + '</strong>' +
      ' &times; ' + escapeHtml(qty) + ' = <strong>£' + escapeHtml(total) + '</strong>';
    if (name)     summary += ' &nbsp;·&nbsp; ' + escapeHtml(name);
    if (postcode) summary += ' &nbsp;·&nbsp; ' + escapeHtml(postcode.toUpperCase());
    orderSummary.innerHTML = summary;
    orderSummary.classList.add('visible');
  }

  /* ── Admin books – dynamic rendering ──────────────────── */
  (function loadAdminBooks () {
    var STORAGE_KEY   = 'hemeonc_admin_books';
    var VALID_STYLES  = ['1','2','3','4','5','6','7','8'];
    var booksGrid     = document.querySelector('.books-grid');
    if (!booksGrid) return;

    var adminBooks;
    try {
      adminBooks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      adminBooks = [];
    }
    if (!adminBooks.length) return;

    adminBooks.forEach(function (book) {
      var coverStyle = VALID_STYLES.indexOf(String(book.coverStyle)) !== -1
        ? String(book.coverStyle) : '1';
      var card = document.createElement('div');
      card.className = 'book-card';
      card.innerHTML =
        '<div class="book-cover book-cover-' + coverStyle + '">' +
          '<span class="book-cover-icon">' + escapeHtml(book.coverIcon || '📘') + '</span>' +
        '</div>' +
        '<div class="book-info">' +
          '<span class="book-tag">' + escapeHtml(book.category) + '</span>' +
          '<h3 class="book-title">' + escapeHtml(book.title) + '</h3>' +
          '<p class="book-description">' + escapeHtml(book.description) + '</p>' +
          '<div class="book-meta">' +
            '<span class="book-price">' + escapeHtml(book.price) + '</span>' +
            (book.pages
              ? '<span class="book-pages">' + escapeHtml(book.pages) + '</span>'
              : '') +
          '</div>' +
          '<button class="btn btn-primary btn-block book-buy-btn"' +
            ' data-title="' + escapeHtml(book.title) + '"' +
            ' data-price="' + escapeHtml(book.price) + '">Buy Now</button>' +
        '</div>';
      booksGrid.appendChild(card);
    });

    // Attach buy-button listeners to the newly added cards
    booksGrid.querySelectorAll('.book-buy-btn').forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        openModal(btn.getAttribute('data-title'), btn.getAttribute('data-price'));
      });
    });
  })();

})();

