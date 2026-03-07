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

  /* ── Sample Quiz ───────────────────────────────────────── */
  var questions = [
    {
      category:    'Benign Hematology',
      categoryColor: '#dbeafe',
      categoryTextColor: '#1e40af',
      question:    'A 32-year-old woman with sickle cell disease presents with severe chest pain, fever to 38.8 °C, a new pulmonary infiltrate on chest X-ray, and oxygen saturation of 91% on room air. Which of the following is the most appropriate initial management?',
      choices: [
        'Observation with supplemental oxygen only',
        'Simple transfusion to Hgb 10 g/dL and broad-spectrum antibiotics',
        'Exchange transfusion, broad-spectrum antibiotics, and bronchodilators',
        'Hydroxyurea initiation and incentive spirometry',
      ],
      correct: 2,
      explanation: 'This patient has acute chest syndrome (ACS), the leading cause of death in sickle cell disease. Severe ACS (O₂ sat < 95%, multi-lobar disease, rapid progression) requires exchange transfusion to rapidly reduce HbS% to < 30%, along with antibiotics covering atypical organisms (macrolide + cephalosporin) and bronchodilators. Simple transfusion risks hyperviscosity. Hydroxyurea is a preventive measure, not acute therapy.',
    },
    {
      category:    'Malignant Hematology',
      categoryColor: '#fee2e2',
      categoryTextColor: '#9b1c1c',
      question:    'A 65-year-old man with newly diagnosed multiple myeloma has del(17p) and t(4;14) by FISH, β₂-microglobulin 6 mg/L, and serum albumin 2.8 g/dL. He is transplant-eligible. Which ISS stage and risk category best describes this patient?',
      choices: [
        'ISS Stage I, standard risk',
        'ISS Stage II, high risk',
        'ISS Stage III, high risk',
        'ISS Stage II, standard risk',
      ],
      correct: 2,
      explanation: 'R-ISS Stage III requires: ISS III (β₂-microglobulin > 5.5 + albumin < 3.5) AND high-risk cytogenetics [del(17p), t(4;14), or t(14;16)]. This patient meets both criteria. The presence of del(17p) alone confers high-risk biology regardless of ISS stage. High-risk patients require bortezomib-containing induction and should be evaluated for early consolidation and maintenance strategies.',
    },
    {
      category:    'Solid Tumors',
      categoryColor: '#dcfce7',
      categoryTextColor: '#14532d',
      question:    'A 55-year-old never-smoker woman is diagnosed with stage IV lung adenocarcinoma. Molecular profiling reveals an EGFR exon 19 deletion. After initial response to osimertinib, she develops progressive disease. Re-biopsy shows the original EGFR del19 plus a new C797S mutation in trans configuration. Which therapeutic approach is most appropriate?',
      choices: [
        'Continue osimertinib at increased dose',
        'Switch to afatinib monotherapy',
        'Combination of a first-generation EGFR TKI (erlotinib) plus a third-generation TKI (osimertinib)',
        'Platinum-based chemotherapy with pembrolizumab',
      ],
      correct: 2,
      explanation: 'C797S in trans with the original activating EGFR mutation can be overcome with a combination of a 1st-generation TKI (binds the wild-type allele at C797) and osimertinib (binds the T790M allele). C797S in cis is refractory to this approach. If C797S is in cis, platinum-based chemotherapy is preferred. PDL-1 expression is typically low in EGFR-mutant NSCLC, making immunotherapy combinations less effective.',
    },
  ];

  var currentQ   = 0;
  var answered   = [false, false, false];
  var quizCard   = document.getElementById('quiz-card');
  var prevBtn    = document.getElementById('prev-btn');
  var nextBtn    = document.getElementById('next-btn');
  var quizCounter = document.getElementById('quiz-counter');

  function renderQuestion (index) {
    var q = questions[index];
    if (!q || !quizCard) return;

    var choicesHTML = q.choices.map(function (choice, i) {
      return '<button class="quiz-choice" data-index="' + i + '">' + escapeHtml(choice) + '</button>';
    }).join('');

    quizCard.innerHTML =
      '<span class="quiz-category" style="background:' + q.categoryColor + ';color:' + q.categoryTextColor + '">'
        + escapeHtml(q.category) +
      '</span>' +
      '<p class="quiz-question">' + escapeHtml(q.question) + '</p>' +
      '<div class="quiz-choices">' + choicesHTML + '</div>' +
      '<div class="quiz-explanation" id="quiz-explanation">' +
        '<strong>Explanation:</strong> ' + escapeHtml(q.explanation) +
      '</div>';

    // Reattach choice listeners
    quizCard.querySelectorAll('.quiz-choice').forEach(function (btn) {
      btn.addEventListener('click', handleChoice);
    });

    // Restore answered state if already visited
    if (answered[index]) {
      markAnswered(index, answered[index] - 1); // stored as 1-based
    }

    updateNav();
  }

  function handleChoice (event) {
    var btn   = event.currentTarget;
    var chosen = parseInt(btn.getAttribute('data-index'), 10);
    if (answered[currentQ]) return; // already answered

    answered[currentQ] = chosen + 1; // 1-based storage
    markAnswered(currentQ, chosen);
  }

  function markAnswered (qIndex, chosen) {
    var q = questions[qIndex];
    quizCard.querySelectorAll('.quiz-choice').forEach(function (b, i) {
      b.disabled = true;
      if (i === q.correct) {
        b.classList.add('correct-ans');
      } else if (i === chosen && chosen !== q.correct) {
        b.classList.add('wrong-ans');
      }
    });
    var exp = document.getElementById('quiz-explanation');
    if (exp) exp.classList.add('visible');
  }

  function updateNav () {
    if (!prevBtn || !nextBtn || !quizCounter) return;
    prevBtn.disabled = currentQ === 0;
    nextBtn.textContent = currentQ === questions.length - 1 ? 'Finish' : 'Next →';
    quizCounter.textContent = 'Question ' + (currentQ + 1) + ' / ' + questions.length;
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      if (currentQ > 0) {
        currentQ--;
        renderQuestion(currentQ);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      if (currentQ < questions.length - 1) {
        currentQ++;
        renderQuestion(currentQ);
      } else {
        // All done — scroll to pricing
        var pricing = document.getElementById('pricing');
        if (pricing) pricing.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Initial render
  renderQuestion(0);

  /* ── Utility: HTML escaping ────────────────────────────── */
  function escapeHtml (str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
