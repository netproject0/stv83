/* ============================================================
   STV 83 — main.js
   Vanilla JS — no frameworks, no dependencies
   ============================================================ */

'use strict';

/* ── 1. STICKY NAV SHADOW ──────────────────────────────────── */
(function initStickyNav() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ── 2. HAMBURGER MENU ─────────────────────────────────────── */
(function initHamburger() {
  const btn     = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');
  if (!btn || !mobileNav) return;

  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    mobileNav.classList.toggle('open', !expanded);
  });

  // Close on link click
  mobileNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      btn.setAttribute('aria-expanded', 'false');
      mobileNav.classList.remove('open');
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !mobileNav.contains(e.target)) {
      btn.setAttribute('aria-expanded', 'false');
      mobileNav.classList.remove('open');
    }
  });
})();

/* ── 3. ACCORDION (Tout savoir) ────────────────────────────── */
(function initAccordion() {
  const triggers = document.querySelectorAll('.accordion-trigger');
  if (!triggers.length) return;

  triggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      const bodyId   = trigger.getAttribute('aria-controls');
      const body     = document.getElementById(bodyId);

      // Close all
      triggers.forEach(t => {
        t.setAttribute('aria-expanded', 'false');
        const id = t.getAttribute('aria-controls');
        const b  = document.getElementById(id);
        if (b) b.classList.remove('open');
      });

      // Open this one (unless it was already open)
      if (!expanded && body) {
        trigger.setAttribute('aria-expanded', 'true');
        body.classList.add('open');
      }
    });
  });

  // Open first by default
  if (triggers[0]) {
    triggers[0].click();
  }
})();

/* ── 4. GALLERY FILTER ─────────────────────────────────────── */
(function initGalleryFilter() {
  const filterBtns = document.querySelectorAll('[data-filter]');
  const items      = document.querySelectorAll('.gallery-item');
  if (!filterBtns.length || !items.length) return;

  // Set initial aria-pressed state
  filterBtns.forEach((btn, i) => {
    btn.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
  });

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      filterBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');

      let shown = 0;
      items.forEach(item => {
        const cat = item.dataset.category;
        if (filter === 'all' || cat === filter) {
          item.classList.remove('hidden');
          shown++;
        } else {
          item.classList.add('hidden');
        }
      });

      const status = document.getElementById('filter-status');
      if (status) {
        status.textContent = `${shown} réalisation${shown > 1 ? 's' : ''} affichée${shown > 1 ? 's' : ''} — filtre ${btn.textContent.trim()}`;
      }
    });
  });
})();

/* ── 5. LIGHTBOX ───────────────────────────────────────────── */
(function initLightbox() {
  const lightbox    = document.getElementById('lightbox');
  const lbImg       = document.getElementById('lightbox-img');
  const lbCaption   = document.getElementById('lightbox-caption');
  const lbClose     = document.getElementById('lightbox-close');
  const lbPrev      = document.getElementById('lightbox-prev');
  const lbNext      = document.getElementById('lightbox-next');
  if (!lightbox || !lbImg) return;

  let lastFocused   = null; // track element that opened lightbox
  let currentIndex  = -1;
  let visibleItems  = []; // gallery items currently visible (respects filter)

  // Collect focusable elements within lightbox for focus trap
  function getFocusable() {
    return Array.from(lightbox.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.disabled && el.offsetParent !== null);
  }

  function getVisibleItems() {
    return Array.from(document.querySelectorAll('.gallery-item:not(.hidden)'));
  }

  function updateNavButtons() {
    const disablePrev = currentIndex <= 0;
    const disableNext = currentIndex >= visibleItems.length - 1;
    // Deplacer le focus avant de desactiver le bouton qui le porte,
    // sinon le focus tombe sur <body> et sort du dialog modal
    if (lbPrev && disablePrev && document.activeElement === lbPrev && lbClose) lbClose.focus();
    if (lbNext && disableNext && document.activeElement === lbNext && lbClose) lbClose.focus();
    if (lbPrev) lbPrev.disabled = disablePrev;
    if (lbNext) lbNext.disabled = disableNext;
  }

  const showItem = (index) => {
    if (index < 0 || index >= visibleItems.length) return;
    currentIndex = index;
    const item = visibleItems[currentIndex];
    const img = item.querySelector('img');
    if (img) {
      // currentSrc respecte le choix webp/jpg du navigateur ; on retire le
      // suffixe -600 des vignettes srcset pour afficher la pleine taille
      lbImg.src = (img.currentSrc || img.src).replace('-600.', '.');
      lbImg.alt = img.alt;
      if (lbCaption) lbCaption.textContent = img.alt;
    }
    updateNavButtons();
  };

  const openLightbox = (itemEl) => {
    visibleItems = getVisibleItems();
    currentIndex = visibleItems.indexOf(itemEl);
    lastFocused = itemEl || document.activeElement;
    showItem(currentIndex);
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (lbClose) lbClose.focus();
  };

  const closeLightbox = () => {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    lbImg.src = '';
    // Return focus to the element that opened the lightbox
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
    lastFocused = null;
    currentIndex = -1;
    visibleItems = [];
  };

  const showPrev = () => {
    if (currentIndex > 0) showItem(currentIndex - 1);
  };

  const showNext = () => {
    if (currentIndex < visibleItems.length - 1) showItem(currentIndex + 1);
  };

  // Focus trap: keep Tab/Shift+Tab inside lightbox when open
  lightbox.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });

  // Gallery items are native <button> elements — click, focus, and
  // Enter/Space keyboard activation are handled natively by the browser.
  document.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      openLightbox(item);
    });
  });

  if (lbClose) {
    lbClose.addEventListener('click', closeLightbox);
  }

  if (lbPrev) {
    lbPrev.addEventListener('click', showPrev);
  }

  if (lbNext) {
    lbNext.addEventListener('click', showNext);
  }

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') {
      closeLightbox();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      showPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      showNext();
    }
  });
})();

/* ── 6. RAL NUANCIER (lazy-rendered via IntersectionObserver) ── */
(function initNuancier() {
  const nuancierSection = document.getElementById('nuancier');
  if (!nuancierSection) return;

  let rendered = false;

  function renderNuancier() {
    if (rendered) return;
    rendered = true;

  const ralColors = [
    { code: 'RAL 1000', name: 'Beige vert', hex: '#BEBD7F', cat: 'Jaune' },
    { code: 'RAL 1001', name: 'Beige', hex: '#C2B078', cat: 'Jaune' },
    { code: 'RAL 1002', name: 'Jaune sable', hex: '#C6A664', cat: 'Jaune' },
    { code: 'RAL 1003', name: 'Jaune signalisation', hex: '#E5BE01', cat: 'Jaune' },
    { code: 'RAL 1004', name: 'Jaune or', hex: '#CDA434', cat: 'Jaune' },
    { code: 'RAL 1005', name: 'Jaune miel', hex: '#A98307', cat: 'Jaune' },
    { code: 'RAL 1006', name: 'Jaune maïs', hex: '#E4A010', cat: 'Jaune' },
    { code: 'RAL 1007', name: 'Jaune narcisse', hex: '#DC9D00', cat: 'Jaune' },
    { code: 'RAL 1011', name: 'Beige brun', hex: '#8A6642', cat: 'Jaune' },
    { code: 'RAL 1012', name: 'Jaune citron', hex: '#C7B446', cat: 'Jaune' },
    { code: 'RAL 1013', name: 'Blanc perle', hex: '#EAE6CA', cat: 'Jaune' },
    { code: 'RAL 1014', name: 'Ivoire', hex: '#E1CC4F', cat: 'Jaune' },
    { code: 'RAL 1015', name: 'Ivoire clair', hex: '#E6D690', cat: 'Jaune' },
    { code: 'RAL 1016', name: 'Jaune soufre', hex: '#EDFF21', cat: 'Jaune' },
    { code: 'RAL 1017', name: 'Jaune safran', hex: '#F5D033', cat: 'Jaune' },
    { code: 'RAL 1018', name: 'Jaune zinc', hex: '#F8F32B', cat: 'Jaune' },
    { code: 'RAL 1019', name: 'Beige gris', hex: '#9E9764', cat: 'Jaune' },
    { code: 'RAL 1020', name: 'Jaune olive', hex: '#999950', cat: 'Jaune' },
    { code: 'RAL 1021', name: 'Jaune colza', hex: '#F3DA0B', cat: 'Jaune' },
    { code: 'RAL 1023', name: 'Jaune signalisation', hex: '#FAD201', cat: 'Jaune' },
    { code: 'RAL 1024', name: 'Jaune ocre', hex: '#AEA04B', cat: 'Jaune' },
    { code: 'RAL 1027', name: 'Jaune curry', hex: '#9D9101', cat: 'Jaune' },
    { code: 'RAL 1028', name: 'Jaune melon', hex: '#F4A900', cat: 'Jaune' },
    { code: 'RAL 2000', name: 'Orange jaune', hex: '#ED760E', cat: 'Orange' },
    { code: 'RAL 2001', name: 'Orange rouge', hex: '#C93C20', cat: 'Orange' },
    { code: 'RAL 2002', name: 'Orange sang', hex: '#CB2821', cat: 'Orange' },
    { code: 'RAL 2003', name: 'Orange pastel', hex: '#FF7514', cat: 'Orange' },
    { code: 'RAL 2004', name: 'Orange pur', hex: '#F44611', cat: 'Orange' },
    { code: 'RAL 2008', name: 'Orange clair', hex: '#F75E25', cat: 'Orange' },
    { code: 'RAL 2009', name: 'Orange signalisation', hex: '#F54021', cat: 'Orange' },
    { code: 'RAL 2010', name: 'Orange signalisation', hex: '#D84B20', cat: 'Orange' },
    { code: 'RAL 2011', name: 'Orange foncé', hex: '#EC7C26', cat: 'Orange' },
    { code: 'RAL 2012', name: 'Orange saumon', hex: '#E55137', cat: 'Orange' },
    { code: 'RAL 3000', name: 'Rouge feu', hex: '#AF2B1E', cat: 'Rouge' },
    { code: 'RAL 3001', name: 'Rouge signalisation', hex: '#A52019', cat: 'Rouge' },
    { code: 'RAL 3002', name: 'Rouge carmin', hex: '#A2231D', cat: 'Rouge' },
    { code: 'RAL 3003', name: 'Rouge rubis', hex: '#9B111E', cat: 'Rouge' },
    { code: 'RAL 3004', name: 'Rouge pourpre', hex: '#75151E', cat: 'Rouge' },
    { code: 'RAL 3005', name: 'Rouge vin', hex: '#5E2129', cat: 'Rouge' },
    { code: 'RAL 3007', name: 'Rouge noir', hex: '#412227', cat: 'Rouge' },
    { code: 'RAL 3009', name: 'Rouge oxyde', hex: '#642424', cat: 'Rouge' },
    { code: 'RAL 3011', name: 'Rouge brun', hex: '#781F19', cat: 'Rouge' },
    { code: 'RAL 3012', name: 'Rouge beige', hex: '#C1876B', cat: 'Rouge' },
    { code: 'RAL 3013', name: 'Rouge tomate', hex: '#A12312', cat: 'Rouge' },
    { code: 'RAL 3014', name: 'Vieux rose', hex: '#D36E70', cat: 'Rouge' },
    { code: 'RAL 3015', name: 'Rose clair', hex: '#EA899A', cat: 'Rouge' },
    { code: 'RAL 3016', name: 'Rouge corail', hex: '#B32821', cat: 'Rouge' },
    { code: 'RAL 3017', name: 'Rosé', hex: '#E63244', cat: 'Rouge' },
    { code: 'RAL 3018', name: 'Rouge fraise', hex: '#D53032', cat: 'Rouge' },
    { code: 'RAL 3020', name: 'Rouge signalisation', hex: '#CC0605', cat: 'Rouge' },
    { code: 'RAL 3022', name: 'Rouge saumon', hex: '#D95030', cat: 'Rouge' },
    { code: 'RAL 3027', name: 'Rouge framboise', hex: '#C51D34', cat: 'Rouge' },
    { code: 'RAL 3031', name: 'Rouge oriental', hex: '#B32428', cat: 'Rouge' },
    { code: 'RAL 4001', name: 'Lilas rouge', hex: '#6D3F5B', cat: 'Violet' },
    { code: 'RAL 4002', name: 'Violet rouge', hex: '#922B3E', cat: 'Violet' },
    { code: 'RAL 4003', name: 'Violet bruyère', hex: '#DE4C8A', cat: 'Violet' },
    { code: 'RAL 4004', name: 'Violet bordeaux', hex: '#641C34', cat: 'Violet' },
    { code: 'RAL 4005', name: 'Lilas bleu', hex: '#6C4675', cat: 'Violet' },
    { code: 'RAL 4006', name: 'Pourpre signalisation', hex: '#A03472', cat: 'Violet' },
    { code: 'RAL 4007', name: 'Violet pourpre', hex: '#4A192C', cat: 'Violet' },
    { code: 'RAL 4008', name: 'Violet de sécurité', hex: '#924E7D', cat: 'Violet' },
    { code: 'RAL 4009', name: 'Violet pastel', hex: '#A18594', cat: 'Violet' },
    { code: 'RAL 5000', name: 'Bleu violet', hex: '#354D73', cat: 'Bleu' },
    { code: 'RAL 5001', name: 'Bleu vert', hex: '#1F3438', cat: 'Bleu' },
    { code: 'RAL 5002', name: 'Bleu outremer', hex: '#20214F', cat: 'Bleu' },
    { code: 'RAL 5003', name: 'Bleu saphir', hex: '#1D1E33', cat: 'Bleu' },
    { code: 'RAL 5004', name: 'Bleu noir', hex: '#18171C', cat: 'Bleu' },
    { code: 'RAL 5005', name: 'Bleu signalisation', hex: '#1E2460', cat: 'Bleu' },
    { code: 'RAL 5007', name: 'Bleu brillant', hex: '#3E5F8A', cat: 'Bleu' },
    { code: 'RAL 5008', name: 'Bleu gris', hex: '#26252D', cat: 'Bleu' },
    { code: 'RAL 5009', name: 'Bleu azur', hex: '#025669', cat: 'Bleu' },
    { code: 'RAL 5010', name: 'Bleu gentiane', hex: '#0E294B', cat: 'Bleu' },
    { code: 'RAL 5011', name: 'Bleu acier', hex: '#231A24', cat: 'Bleu' },
    { code: 'RAL 5012', name: 'Bleu clair', hex: '#3B83BD', cat: 'Bleu' },
    { code: 'RAL 5013', name: 'Bleu cobalt', hex: '#1E213D', cat: 'Bleu' },
    { code: 'RAL 5014', name: 'Bleu pigeon', hex: '#606E8C', cat: 'Bleu' },
    { code: 'RAL 5015', name: 'Bleu ciel', hex: '#2271B3', cat: 'Bleu' },
    { code: 'RAL 5017', name: 'Bleu signalisation', hex: '#063971', cat: 'Bleu' },
    { code: 'RAL 5018', name: 'Bleu turquoise', hex: '#3F888F', cat: 'Bleu' },
    { code: 'RAL 5019', name: 'Bleu capri', hex: '#1B5583', cat: 'Bleu' },
    { code: 'RAL 5020', name: 'Bleu océan', hex: '#1D334A', cat: 'Bleu' },
    { code: 'RAL 5021', name: "Bleu d'eau", hex: '#256D7B', cat: 'Bleu' },
    { code: 'RAL 5022', name: 'Bleu nocturne', hex: '#252850', cat: 'Bleu' },
    { code: 'RAL 5023', name: 'Bleu distant', hex: '#49678D', cat: 'Bleu' },
    { code: 'RAL 5024', name: 'Bleu pastel', hex: '#5D9B9B', cat: 'Bleu' },
    { code: 'RAL 6000', name: 'Vert patine', hex: '#316650', cat: 'Vert' },
    { code: 'RAL 6001', name: 'Vert émeraude', hex: '#287233', cat: 'Vert' },
    { code: 'RAL 6002', name: 'Vert feuillage', hex: '#2D572C', cat: 'Vert' },
    { code: 'RAL 6003', name: 'Vert olive', hex: '#424632', cat: 'Vert' },
    { code: 'RAL 6004', name: 'Vert bleu', hex: '#1F3A3D', cat: 'Vert' },
    { code: 'RAL 6005', name: 'Vert mousse', hex: '#2F4538', cat: 'Vert' },
    { code: 'RAL 6006', name: 'Vert olive gris', hex: '#3E3B32', cat: 'Vert' },
    { code: 'RAL 6007', name: 'Vert bouteille', hex: '#343B29', cat: 'Vert' },
    { code: 'RAL 6008', name: 'Vert brun', hex: '#39352A', cat: 'Vert' },
    { code: 'RAL 6009', name: 'Vert sapin', hex: '#31372B', cat: 'Vert' },
    { code: 'RAL 6010', name: 'Vert herbe', hex: '#35682D', cat: 'Vert' },
    { code: 'RAL 6011', name: 'Vert réséda', hex: '#587246', cat: 'Vert' },
    { code: 'RAL 6012', name: 'Vert noir', hex: '#343E40', cat: 'Vert' },
    { code: 'RAL 6013', name: 'Vert jonc', hex: '#6C7156', cat: 'Vert' },
    { code: 'RAL 6014', name: 'Olive jaune', hex: '#47402E', cat: 'Vert' },
    { code: 'RAL 6015', name: 'Olive noir', hex: '#3B3C36', cat: 'Vert' },
    { code: 'RAL 6016', name: 'Vert turquoise', hex: '#1E5945', cat: 'Vert' },
    { code: 'RAL 6017', name: 'Vert mai', hex: '#4C9141', cat: 'Vert' },
    { code: 'RAL 6018', name: 'Vert jaune', hex: '#57A639', cat: 'Vert' },
    { code: 'RAL 6019', name: 'Vert blanc', hex: '#BDECB6', cat: 'Vert' },
    { code: 'RAL 6020', name: 'Vert chrome', hex: '#2E3A23', cat: 'Vert' },
    { code: 'RAL 6021', name: 'Vert pâle', hex: '#89AC76', cat: 'Vert' },
    { code: 'RAL 6022', name: 'Olive brun', hex: '#25221B', cat: 'Vert' },
    { code: 'RAL 6024', name: 'Vert signalisation', hex: '#308446', cat: 'Vert' },
    { code: 'RAL 6025', name: 'Vert fougère', hex: '#3D642D', cat: 'Vert' },
    { code: 'RAL 6026', name: 'Vert opale', hex: '#015D52', cat: 'Vert' },
    { code: 'RAL 6027', name: 'Vert clair', hex: '#84C3BE', cat: 'Vert' },
    { code: 'RAL 6028', name: 'Vert pin', hex: '#2C5545', cat: 'Vert' },
    { code: 'RAL 6029', name: 'Vert menthe', hex: '#20603D', cat: 'Vert' },
    { code: 'RAL 6032', name: 'Vert signalisation', hex: '#317F43', cat: 'Vert' },
    { code: 'RAL 6033', name: 'Turquoise menthe', hex: '#497E76', cat: 'Vert' },
    { code: 'RAL 6034', name: 'Turquoise pastel', hex: '#7FB5B5', cat: 'Vert' },
    { code: 'RAL 7000', name: 'Gris petit-gris', hex: '#78858B', cat: 'Gris' },
    { code: 'RAL 7001', name: 'Gris argent', hex: '#8A9597', cat: 'Gris' },
    { code: 'RAL 7002', name: 'Gris olive', hex: '#7E7B52', cat: 'Gris' },
    { code: 'RAL 7003', name: 'Gris mousse', hex: '#6C7059', cat: 'Gris' },
    { code: 'RAL 7004', name: 'Gris de sécurité', hex: '#969992', cat: 'Gris' },
    { code: 'RAL 7005', name: 'Gris souris', hex: '#646B63', cat: 'Gris' },
    { code: 'RAL 7006', name: 'Gris beige', hex: '#6D6552', cat: 'Gris' },
    { code: 'RAL 7008', name: 'Gris kaki', hex: '#6A5F31', cat: 'Gris' },
    { code: 'RAL 7009', name: 'Gris vert', hex: '#4D5645', cat: 'Gris' },
    { code: 'RAL 7010', name: 'Gris tente', hex: '#4C514A', cat: 'Gris' },
    { code: 'RAL 7011', name: 'Gris fer', hex: '#434B4D', cat: 'Gris' },
    { code: 'RAL 7012', name: 'Gris basalte', hex: '#4E5754', cat: 'Gris' },
    { code: 'RAL 7013', name: 'Gris brun', hex: '#464531', cat: 'Gris' },
    { code: 'RAL 7015', name: 'Gris ardoise', hex: '#434750', cat: 'Gris' },
    { code: 'RAL 7016', name: 'Gris anthracite', hex: '#293133', cat: 'Gris' },
    { code: 'RAL 7021', name: 'Gris noir', hex: '#23282B', cat: 'Gris' },
    { code: 'RAL 7022', name: "Gris terre d'ombre", hex: '#332F2C', cat: 'Gris' },
    { code: 'RAL 7023', name: 'Gris béton', hex: '#686C5E', cat: 'Gris' },
    { code: 'RAL 7024', name: 'Gris graphite', hex: '#474A51', cat: 'Gris' },
    { code: 'RAL 7026', name: 'Gris granit', hex: '#2F353B', cat: 'Gris' },
    { code: 'RAL 7030', name: 'Gris pierre', hex: '#8B8C7A', cat: 'Gris' },
    { code: 'RAL 7031', name: 'Gris bleu', hex: '#474B4E', cat: 'Gris' },
    { code: 'RAL 7032', name: 'Gris silex', hex: '#B8B799', cat: 'Gris' },
    { code: 'RAL 7033', name: 'Gris ciment', hex: '#7D8471', cat: 'Gris' },
    { code: 'RAL 7034', name: 'Gris jaune', hex: '#8F8B66', cat: 'Gris' },
    { code: 'RAL 7035', name: 'Gris clair', hex: '#D7D7D7', cat: 'Gris' },
    { code: 'RAL 7036', name: 'Gris platine', hex: '#7F7679', cat: 'Gris' },
    { code: 'RAL 7037', name: 'Gris poussière', hex: '#7D7F7D', cat: 'Gris' },
    { code: 'RAL 7038', name: 'Gris agate', hex: '#B5B8B1', cat: 'Gris' },
    { code: 'RAL 7039', name: 'Gris quartz', hex: '#6C6960', cat: 'Gris' },
    { code: 'RAL 7040', name: 'Gris fenêtre', hex: '#9DA1AA', cat: 'Gris' },
    { code: 'RAL 7042', name: 'Gris signalisation A', hex: '#8D948D', cat: 'Gris' },
    { code: 'RAL 7043', name: 'Gris signalisation B', hex: '#4E5452', cat: 'Gris' },
    { code: 'RAL 7044', name: 'Gris soie', hex: '#CAC4B0', cat: 'Gris' },
    { code: 'RAL 7045', name: 'Telegris 1', hex: '#909090', cat: 'Gris' },
    { code: 'RAL 7046', name: 'Telegris 2', hex: '#82898F', cat: 'Gris' },
    { code: 'RAL 7047', name: 'Telegris 4', hex: '#D0D0D0', cat: 'Gris' },
    { code: 'RAL 8000', name: 'Brun vert', hex: '#826C34', cat: 'Brun' },
    { code: 'RAL 8001', name: 'Brun terre de Sienne', hex: '#955F20', cat: 'Brun' },
    { code: 'RAL 8002', name: 'Brun de sécurité', hex: '#6C3B2A', cat: 'Brun' },
    { code: 'RAL 8003', name: 'Brun argile', hex: '#734222', cat: 'Brun' },
    { code: 'RAL 8004', name: 'Brun cuivré', hex: '#8E402A', cat: 'Brun' },
    { code: 'RAL 8007', name: 'Brun fauve', hex: '#59351F', cat: 'Brun' },
    { code: 'RAL 8008', name: 'Brun olive', hex: '#6F4F28', cat: 'Brun' },
    { code: 'RAL 8011', name: 'Brun noisette', hex: '#5B3A29', cat: 'Brun' },
    { code: 'RAL 8012', name: 'Brun rouge', hex: '#592321', cat: 'Brun' },
    { code: 'RAL 8014', name: 'Brun sépia', hex: '#382C1E', cat: 'Brun' },
    { code: 'RAL 8015', name: 'Marron', hex: '#633A34', cat: 'Brun' },
    { code: 'RAL 8016', name: 'Brun acajou', hex: '#4C2F27', cat: 'Brun' },
    { code: 'RAL 8017', name: 'Brun chocolat', hex: '#45322E', cat: 'Brun' },
    { code: 'RAL 8019', name: 'Brun gris', hex: '#403A3A', cat: 'Brun' },
    { code: 'RAL 8022', name: 'Brun noir', hex: '#212121', cat: 'Brun' },
    { code: 'RAL 8023', name: 'Brun orangé', hex: '#A65E2E', cat: 'Brun' },
    { code: 'RAL 8024', name: 'Brun beige', hex: '#79553D', cat: 'Brun' },
    { code: 'RAL 8025', name: 'Brun pâle', hex: '#755C48', cat: 'Brun' },
    { code: 'RAL 8028', name: 'Brun terre', hex: '#4E3B31', cat: 'Brun' },
    { code: 'RAL 9001', name: 'Blanc crème', hex: '#FDF4E3', cat: 'Blanc/Noir' },
    { code: 'RAL 9002', name: 'Blanc gris', hex: '#E7EBDA', cat: 'Blanc/Noir' },
    { code: 'RAL 9003', name: 'Blanc de sécurité', hex: '#F4F4F4', cat: 'Blanc/Noir' },
    { code: 'RAL 9004', name: 'Noir de sécurité', hex: '#282828', cat: 'Blanc/Noir' },
    { code: 'RAL 9005', name: 'Noir foncé', hex: '#0A0A0A', cat: 'Blanc/Noir' },
    { code: 'RAL 9006', name: 'Aluminium blanc', hex: '#A5A5A5', cat: 'Blanc/Noir' },
    { code: 'RAL 9007', name: 'Aluminium gris', hex: '#8F8F8F', cat: 'Blanc/Noir' },
    { code: 'RAL 9010', name: 'Blanc pur', hex: '#FFFFFF', cat: 'Blanc/Noir' },
    { code: 'RAL 9011', name: 'Noir graphite', hex: '#1C1C1C', cat: 'Blanc/Noir' },
    { code: 'RAL 9016', name: 'Blanc signalisation', hex: '#F6F6F6', cat: 'Blanc/Noir' },
    { code: 'RAL 9017', name: 'Noir signalisation', hex: '#1E1E1E', cat: 'Blanc/Noir' },
    { code: 'RAL 9018', name: 'Blanc papyrus', hex: '#D7D7D7', cat: 'Blanc/Noir' },
    { code: 'RAL 9022', name: 'Gris clair nacré', hex: '#9C9C9C', cat: 'Blanc/Noir' },
    { code: 'RAL 9023', name: 'Gris foncé nacré', hex: '#828282', cat: 'Blanc/Noir' }
  ];

  const grid       = document.getElementById('ral-grid');
  const catBtns    = document.querySelectorAll('[data-ral-cat]');
  const searchInput = document.getElementById('ral-search');
  const emptyMsg   = document.getElementById('ral-empty');
  if (!grid) return;

  let activeCategory = 'all';
  let searchTerm     = '';

  // Build swatches
  ralColors.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'ral-swatch';
    swatch.dataset.cat = color.cat;
    swatch.dataset.code = color.code.toLowerCase();
    swatch.dataset.name = color.name.toLowerCase();
    swatch.setAttribute('tabindex', '0');
    swatch.setAttribute('role', 'img');
    swatch.setAttribute('aria-label', `${color.code} — ${color.name}`);

    swatch.innerHTML = `
      <div class="ral-color" style="background-color:${color.hex};"></div>
      <span class="ral-code">${color.code}</span>
      <div class="ral-tooltip">${color.code}<br>${color.name}</div>
    `;
    grid.appendChild(swatch);
  });

  const swatches = grid.querySelectorAll('.ral-swatch');

  function filterSwatches() {
    let visibleCount = 0;
    swatches.forEach(sw => {
      const catMatch    = activeCategory === 'all' || sw.dataset.cat === activeCategory;
      const searchMatch = !searchTerm
        || sw.dataset.code.includes(searchTerm)
        || sw.dataset.name.includes(searchTerm);

      if (catMatch && searchMatch) {
        sw.classList.remove('hidden');
        visibleCount++;
      } else {
        sw.classList.add('hidden');
      }
    });

    if (emptyMsg) {
      emptyMsg.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  }

  // Set initial aria-pressed on RAL category buttons
  catBtns.forEach((btn, i) => {
    btn.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
  });

  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      activeCategory = btn.dataset.ralCat;
      filterSwatches();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchTerm = searchInput.value.toLowerCase().trim();
      filterSwatches();
    });
  }
  } // end renderNuancier

  // Trigger render when #nuancier is within 200px of viewport
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          renderNuancier();
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '200px' });
    observer.observe(nuancierSection);
  } else {
    // Fallback: render immediately if IntersectionObserver not supported
    renderNuancier();
  }
})();

/* ── 7. CONTACT FORM VALIDATION ────────────────────────────── */
(function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  // Honeypot: silently abort if bot filled the hidden website field
  const honeypot = form.querySelector('[name="website"]');

  const successMsg = document.getElementById('form-success');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function showError(fieldId, show) {
    const errEl = document.getElementById(fieldId + '-error');
    const input = document.getElementById(fieldId);
    if (errEl) errEl.classList.toggle('visible', show);
    if (input) {
      input.classList.toggle('error', show);
      // WCAG 3.3.1 — set aria-invalid when error state changes
      if (show) {
        input.setAttribute('aria-invalid', 'true');
      } else {
        input.setAttribute('aria-invalid', 'false');
      }
    }
  }

  function validateField(id, condition) {
    const valid = condition;
    showError(id, !valid);
    return valid;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Honeypot check: bots fill hidden fields, humans don't
    if (honeypot && honeypot.value.trim() !== '') {
      // Silently drop — show success to avoid tipping off bots
      form.reset();
      return;
    }

    const name    = document.getElementById('f-nom');
    const email   = document.getElementById('f-email');
    const message = document.getElementById('f-message');

    let valid = true;

    if (!name || !name.value.trim()) {
      showError('f-nom', true);
      valid = false;
    } else {
      showError('f-nom', false);
    }

    if (!email || !emailRegex.test(email.value.trim())) {
      showError('f-email', true);
      valid = false;
    } else {
      showError('f-email', false);
    }

    if (!message || !message.value.trim()) {
      showError('f-message', true);
      valid = false;
    } else {
      showError('f-message', false);
    }

    if (valid) {
      // Mailto fallback
      const nom     = name.value.trim();
      const mail    = email.value.trim();
      const sujet   = document.getElementById('f-sujet')?.value.trim() || 'Demande de devis';
      const msg     = message.value.trim();

      const body    = encodeURIComponent(`Nom: ${nom}\nEmail: ${mail}\n\n${msg}`);
      window.location.href = `mailto:contact.stv83@gmail.com?subject=${encodeURIComponent(sujet)}&body=${body}`;

      form.reset();
      if (successMsg) {
        successMsg.classList.add('visible');
        setTimeout(() => successMsg.classList.remove('visible'), 6000);
      }
    }
  });

  // Live clear errors on input
  ['f-nom', 'f-email', 'f-message'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        showError(id, false);
      });
    }
  });
})();

/* ── 8. EMAIL ANTI-SCRAPING ────────────────────────────────── */
(function initEmailObfuscation() {
  document.querySelectorAll('[data-email]').forEach(el => {
    const parts = el.dataset.email.split('|');
    if (parts.length < 2) return;
    const email = parts[0] + '@' + parts[1];
    if (el.tagName === 'A') {
      el.href = 'mailto:' + email;
    }
    if (el.dataset.text === 'true') {
      el.textContent = email;
    }
  });
})();

/* ── 9. INTERSECTION OBSERVER (fade-in) ────────────────────── */
(function initFadeIn() {
  const targets = document.querySelectorAll('.fade-in');
  if (!targets.length || !('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  targets.forEach(el => observer.observe(el));
})();
