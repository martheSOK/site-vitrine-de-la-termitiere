/* =========================================================
   LA TERMITIÈRE — script partagé (index.html + service.html)
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Écran d'introduction (logo, une fois par session) ---------- */
  const introOverlay = document.getElementById('intro-overlay');
  if (introOverlay) {
    let alreadyShown = false;
    try { alreadyShown = sessionStorage.getItem('termitiere-intro-shown') === '1'; } catch (e) { /* ignore */ }
    if (alreadyShown) {
      introOverlay.remove();
    } else {
      try { sessionStorage.setItem('termitiere-intro-shown', '1'); } catch (e) { /* ignore */ }
      setTimeout(() => {
        introOverlay.classList.add('intro-hidden');
        setTimeout(() => introOverlay.remove(), 700);
      }, 1900);
    }
  }

  /* ---------- Secteur pré-rempli sur le formulaire de contact ---------- */
  const sectorInput = document.getElementById('f-sector');
  const sectorField = document.getElementById('f-sector-field');
  if (sectorInput && sectorField) {
    const secteur = new URLSearchParams(window.location.search).get('secteur');
    if (secteur) {
      sectorInput.value = secteur;
      sectorField.style.display = '';
      // Le champ ajouté décale la mise en page après le saut d'ancre initial du navigateur :
      // on recale le défilement sur #contact une fois le champ affiché.
      if (window.location.hash === '#contact') {
        requestAnimationFrame(() => {
          document.getElementById('contact').scrollIntoView();
        });
      }
    }
  }

  /* ---------- Thème clair / sombre ---------- */
  const themeToggle = document.getElementById('theme-toggle');
  const root = document.documentElement;
  const applyTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('termitiere-theme', theme); } catch (e) { /* ignore */ }
  };
  let savedTheme = 'light';
  try {
    savedTheme = localStorage.getItem('termitiere-theme')
      || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  } catch (e) { /* ignore */ }
  applyTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  /* ---------- Menu mobile ---------- */
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Lien de nav actif au scroll (page d'accueil) ---------- */
  const sections = document.querySelectorAll('main section[id]');
  const navLinks = document.querySelectorAll('.main-nav a[href^="index.html#"], .main-nav a[href^="#"]');
  const highlightNav = () => {
    let currentId = '';
    sections.forEach(sec => {
      const rect = sec.getBoundingClientRect();
      if (rect.top <= 120 && rect.bottom >= 120) currentId = sec.id;
    });
    navLinks.forEach(link => {
      const href = link.getAttribute('href') || '';
      link.classList.toggle('active', href.endsWith('#' + currentId) && currentId !== '');
    });
  };
  if (sections.length) {
    document.addEventListener('scroll', highlightNav, { passive: true });
    highlightNav();
  }

  /* ---------- Révélation au scroll ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    revealEls.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(18px)';
      el.style.transition = 'opacity .5s ease, transform .5s ease';
      io.observe(el);
    });
  }

  /* ---------- Carrousels photo (hero / vision) ---------- */
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const initCarousel = (containerId, slideClass, intervalMs) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const slides = container.querySelectorAll('.' + slideClass);
    if (slides.length < 2 || prefersReducedMotion) return;
    let current = 0;
    setInterval(() => {
      slides[current].classList.remove('active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('active');
    }, intervalMs);
  };
  initCarousel('hero-bg', 'hero-bg-slide', 5000);
  initCarousel('vision-bg', 'vision-bg-slide', 4200);

  /* ---------- Cartes secteurs (page d'accueil) ---------- */
  const cardsWrap = document.getElementById('sector-cards');
  if (cardsWrap && typeof SECTORS !== 'undefined') {
    const iconArrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>';
    SECTOR_ORDER.forEach(id => {
      const s = SECTORS[id];
      const logoBlock = s.logo
        ? `<img src="${s.logo}" alt="Logo ${s.name}">`
        : `<span class="letter-badge">${s.letter}</span>`;
      const hasPhoto = s.photos && s.photos.length > 0;
      const photoStyle = hasPhoto
        ? `background-image:url('${s.photosDir}${s.photos[0]}');`
        : `background:linear-gradient(135deg, ${s.color}, ${s.colorDark});`;
      const card = document.createElement('a');
      card.href = `service.html?id=${s.id}`;
      card.className = 'sector-card';
      card.style.setProperty('--accent', s.color);
      card.innerHTML = `
        <div class="sector-card-photo" style="${photoStyle}">
          <div class="sector-card-logo-badge">${logoBlock}</div>
        </div>
        <div class="sector-card-body">
          <h3>${s.name}</h3>
          <p>${s.cardText}</p>
          <span class="card-link">Découvrir ${iconArrow}</span>
        </div>`;
      cardsWrap.appendChild(card);
    });
  }

  /* ---------- Accordéon FAQ ---------- */
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(openItem => {
        openItem.classList.remove('open');
        openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---------- Formulaire de contact (Netlify Forms) ---------- */
  const form = document.getElementById('contact-form');
  const formFeedback = document.getElementById('form-feedback');
  if (form) {
    const encode = (data) => Object.keys(data)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
      .join('&');

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const honeypot = form.querySelector('input[name="bot-field"]');
      if (honeypot && honeypot.value) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      const formData = Object.fromEntries(new FormData(form).entries());

      if (!formData.email && !formData.phone) {
        formFeedback.textContent = 'Merci de renseigner au moins un email ou un numéro de téléphone.';
        formFeedback.style.color = '#BD3C2F';
        return;
      }

      submitBtn.disabled = true;
      formFeedback.textContent = 'Envoi en cours…';
      formFeedback.style.color = '';

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode(formData),
      })
        .then((response) => {
          if (!response.ok) throw new Error('Réponse serveur invalide');
          formFeedback.textContent = 'Message envoyé, merci ! Nous revenons vers vous rapidement.';
          formFeedback.style.color = '#2f8f5b';
          form.reset();
        })
        .catch(() => {
          formFeedback.textContent = "L'envoi en direct n'est actif qu'une fois le site déployé sur Netlify. En local, ce message ne part pas encore.";
          formFeedback.style.color = '#BD3C2F';
        })
        .finally(() => { submitBtn.disabled = false; });
    });
  }

  /* ---------- Visionneuse photo / vidéo (lightbox) ---------- */
  const lightbox = document.getElementById('lightbox');
  const lightboxContent = document.getElementById('lightbox-content');
  const lightboxClose = document.getElementById('lightbox-close');

  if (lightbox && lightboxContent && lightboxClose) {
    const openLightbox = (type, src) => {
      lightboxContent.innerHTML = '';
      if (type === 'video') {
        const video = document.createElement('video');
        video.src = src;
        video.controls = true;
        video.controlsList = 'nodownload';
        video.disablePictureInPicture = true;
        video.autoplay = true;
        video.playsInline = true;
        lightboxContent.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.draggable = false;
        lightboxContent.appendChild(img);
      }
      lightbox.classList.add('open');
    };
    const closeLightbox = () => {
      lightbox.classList.remove('open');
      lightboxContent.innerHTML = '';
    };

    document.body.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-lightbox]');
      if (trigger) {
        openLightbox(trigger.getAttribute('data-lightbox'), trigger.getAttribute('data-src'));
      }
    });
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
  }

  /* ---------- Protection basique des médias (dissuasion, pas un blocage absolu) ---------- */
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('img, video')) e.preventDefault();
  });
  document.addEventListener('dragstart', (e) => {
    if (e.target.closest('img, video')) e.preventDefault();
  });

});
