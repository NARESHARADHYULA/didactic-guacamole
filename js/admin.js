/* =========================================================
   HemeOnc Questions – Admin Page JavaScript
   ========================================================= */

(function () {
  'use strict';

  var ADMIN_PASSWORD = 'admin2026';
  var STORAGE_KEY    = 'hemeonc_admin_books';
  var SESSION_KEY    = 'hemeonc_admin_auth';

  /* ── DOM refs ──────────────────────────────────────────── */
  var loginScreen   = document.getElementById('admin-login');
  var dashboard     = document.getElementById('admin-dashboard');
  var loginForm     = document.getElementById('login-form');
  var loginError    = document.getElementById('login-error');
  var passwordInput = document.getElementById('admin-password');
  var logoutBtn     = document.getElementById('admin-logout');
  var addBookForm   = document.getElementById('add-book-form');
  var addBookError  = document.getElementById('add-book-error');
  var booksList     = document.getElementById('admin-books-list');
  var emptyMsg      = document.getElementById('admin-empty');
  var statCustom    = document.getElementById('stat-custom');
  var countBadge    = document.getElementById('books-count-badge');
  var coverPreview  = document.getElementById('cover-preview');
  var coverPreviewIcon = document.getElementById('cover-preview-icon');

  /* ── Cover style gradients (mirrors CSS) ───────────────── */
  var COVER_STYLES   = ['1','2','3','4','5','6','7','8'];
  var COVER_GRADIENTS = {
    '1': 'linear-gradient(135deg,#dbeafe 0%,#bfdbfe 100%)',
    '2': 'linear-gradient(135deg,#fee2e2 0%,#fecaca 100%)',
    '3': 'linear-gradient(135deg,#dcfce7 0%,#bbf7d0 100%)',
    '4': 'linear-gradient(135deg,#fef9c3 0%,#fde68a 100%)',
    '5': 'linear-gradient(135deg,#ede9fe 0%,#ddd6fe 100%)',
    '6': 'linear-gradient(135deg,#ccfbf1 0%,#99f6e4 100%)',
    '7': 'linear-gradient(135deg,#ffedd5 0%,#fed7aa 100%)',
    '8': 'linear-gradient(135deg,#fce7f3 0%,#fbcfe8 100%)',
  };

  function safeGradient (style) {
    return COVER_STYLES.indexOf(style) !== -1
      ? COVER_GRADIENTS[style]
      : COVER_GRADIENTS['1'];
  }

  function safeCoverStyle (style) {
    return COVER_STYLES.indexOf(style) !== -1 ? style : '1';
  }

  /* ── Auth ──────────────────────────────────────────────── */
  function isAuthed () {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  }

  function showDashboard () {
    if (loginScreen) loginScreen.hidden = true;
    if (dashboard)   dashboard.hidden   = false;
    if (logoutBtn)   logoutBtn.hidden   = false;
    renderBooksList();
  }

  function showLogin () {
    if (loginScreen) loginScreen.hidden = false;
    if (dashboard)   dashboard.hidden   = true;
    if (logoutBtn)   logoutBtn.hidden   = true;
  }

  if (isAuthed()) {
    showDashboard();
  }

  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var pwd = passwordInput ? passwordInput.value : '';
      if (pwd === ADMIN_PASSWORD) {
        sessionStorage.setItem(SESSION_KEY, '1');
        if (loginError) loginError.hidden = true;
        showDashboard();
      } else {
        if (loginError) loginError.hidden = false;
        if (passwordInput) { passwordInput.value = ''; passwordInput.focus(); }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      sessionStorage.removeItem(SESSION_KEY);
      showLogin();
    });
  }

  /* ── Book storage helpers ──────────────────────────────── */
  function getBooks () {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveBooks (books) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  }

  /* ── Cover preview ─────────────────────────────────────── */
  function updateCoverPreview () {
    var style = document.getElementById('book-cover-style');
    var icon  = document.getElementById('book-cover-icon');
    if (!style || !icon || !coverPreview) return;
    coverPreview.style.background = safeGradient(style.value);
    if (coverPreviewIcon) coverPreviewIcon.textContent = icon.value;
  }

  var styleSelect = document.getElementById('book-cover-style');
  var iconSelect  = document.getElementById('book-cover-icon');
  if (styleSelect) styleSelect.addEventListener('change', updateCoverPreview);
  if (iconSelect)  iconSelect.addEventListener('change', updateCoverPreview);
  updateCoverPreview();

  /* ── Render books list in admin panel ──────────────────── */
  function renderBooksList () {
    var books = getBooks();
    var count = books.length;

    if (statCustom) statCustom.textContent = String(count);
    if (countBadge) countBadge.textContent = String(count);
    if (emptyMsg)   emptyMsg.hidden = count > 0;
    if (!booksList) return;

    booksList.innerHTML = '';

    books.forEach(function (book) {
      var row = document.createElement('div');
      row.className = 'admin-book-row';
      var grad = safeGradient(book.coverStyle);
      row.innerHTML =
        '<div class="admin-book-cover-thumb" style="background:' + grad + '">' +
          '<span>' + escapeHtml(book.coverIcon || '📘') + '</span>' +
        '</div>' +
        '<div class="admin-book-info">' +
          '<span class="book-tag">' + escapeHtml(book.category) + '</span>' +
          '<strong class="admin-book-title">' + escapeHtml(book.title) + '</strong>' +
          '<span class="admin-book-meta">' + escapeHtml(book.price) +
            (book.pages ? ' · ' + escapeHtml(book.pages) : '') +
          '</span>' +
        '</div>' +
        '<button class="btn btn-delete admin-book-delete"' +
          ' data-id="' + escapeHtml(book.id) + '"' +
          ' aria-label="Delete ' + escapeHtml(book.title) + '">Delete</button>';
      booksList.appendChild(row);
    });

    booksList.querySelectorAll('.admin-book-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteBook(btn.getAttribute('data-id'));
      });
    });
  }

  /* ── Add book ──────────────────────────────────────────── */
  if (addBookForm) {
    addBookForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (addBookError) addBookError.hidden = true;

      var title       = document.getElementById('book-title').value.trim();
      var category    = document.getElementById('book-category').value;
      var description = document.getElementById('book-description').value.trim();
      var price       = document.getElementById('book-price').value.trim();
      var pages       = document.getElementById('book-pages').value.trim();
      var coverStyle  = safeCoverStyle(document.getElementById('book-cover-style').value);
      var coverIcon   = document.getElementById('book-cover-icon').value;

      if (!title || !category || !description || !price) {
        showFormError('Please fill in all required fields (marked with *).');
        return;
      }
      if (!price.match(/^£?\d+(\.\d{1,2})?$/)) {
        showFormError('Price must be a valid amount (e.g. £29.99 or 29.99).');
        return;
      }
      if (!price.startsWith('£')) {
        price = '£' + price;
      }

      var book = {
        id:          Date.now().toString(),
        title:       title,
        category:    category,
        description: description,
        price:       price,
        pages:       pages,
        coverStyle:  coverStyle,
        coverIcon:   coverIcon,
        addedAt:     new Date().toISOString(),
      };

      var books = getBooks();
      books.push(book);
      saveBooks(books);
      addBookForm.reset();
      updateCoverPreview();
      renderBooksList();

      // Show brief success feedback on the button
      var submitBtn = addBookForm.querySelector('[type="submit"]');
      if (submitBtn) {
        var orig = submitBtn.textContent;
        submitBtn.textContent = '✓ Book Added!';
        submitBtn.disabled = true;
        setTimeout(function () {
          submitBtn.textContent = orig;
          submitBtn.disabled = false;
        }, 2000);
      }
    });
  }

  function showFormError (msg) {
    if (!addBookError) return;
    addBookError.textContent = msg;
    addBookError.hidden = false;
    addBookError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ── Delete book ───────────────────────────────────────── */
  function deleteBook (id) {
    if (!confirm('Delete this book? It will no longer appear on the public website.')) return;
    var books = getBooks().filter(function (b) { return b.id !== id; });
    saveBooks(books);
    renderBooksList();
  }

  /* ── Utility ───────────────────────────────────────────── */
  function escapeHtml (str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
