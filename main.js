if(/Android/i.test(navigator.userAgent))document.documentElement.classList.add("is-android");
// Timecode qui défile (25 images/s), comme sur un moniteur de montage.
(function () {
  var els = document.querySelectorAll('[data-tc]');
  var t0 = Date.now();
  function p(n) { return String(n).padStart(2, '0'); }
  function tick() {
    var f = Math.floor((Date.now() - t0) / 40);
    var tc = p(Math.floor(f / 90000) % 24) + ':' + p(Math.floor(f / 1500) % 60) + ':' + p(Math.floor(f / 25) % 60) + ':' + p(f % 25);
    els.forEach(function (el) { el.textContent = tc; });
  }
  tick();
  setInterval(tick, 40);
})();

// Miniatures YouTube des projets : HD si elle existe, sinon la version moyenne.
(function () {
  document.querySelectorAll('[data-yt]').forEach(function (card) {
    var id = card.getAttribute('data-yt');
    var img = document.createElement('img');
    img.className = 'thumb';
    img.alt = '';
    img.loading = 'lazy';
    img.src = 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg';
    img.onload = function () {
      // YouTube renvoie une image grise de 120 px quand la version HD n'existe pas.
      if (img.naturalWidth <= 120) img.src = 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg';
    };
    img.onerror = function () {
      img.onerror = null;
      img.src = 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg';
    };
    card.insertBefore(img, card.firstChild);
  });
})();

// Lecteur intégré : un clic sur une vidéo l'ouvre en plein écran sur le site,
// au lieu de partir sur YouTube. Échap ou clic hors de la vidéo pour fermer.
(function () {
  function videoId(link) {
    if (link.hasAttribute('data-yt')) return link.getAttribute('data-yt');
    var inner = link.querySelector('[data-yt]');
    return inner ? inner.getAttribute('data-yt') : null;
  }

  var modal = document.createElement('div');
  modal.className = 'player';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Lecteur vidéo');
  modal.innerHTML =
    '<div class="player-bar mono"><span>● LECTURE</span>' +
    '<button type="button" class="player-close" aria-label="Fermer la vidéo">Fermer ✕</button></div>' +
    '<div class="player-frame"></div>';
  document.body.appendChild(modal);
  var frame = modal.querySelector('.player-frame');
  var closeBtn = modal.querySelector('.player-close');
  var lastFocus = null;

  function open(id, linkedin) {
    lastFocus = document.activeElement;
    // Post LinkedIn : on affiche le post intégré (avec sa vidéo), dans un cadre au format du post.
    frame.classList.toggle('is-post', !!linkedin);
    frame.innerHTML = linkedin
      ? '<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:activity:' + encodeURIComponent(linkedin) +
        '" title="Post LinkedIn" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>'
      : '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
        '?autoplay=1&rel=0&modestbranding=1" title="Vidéo" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    modal.hidden = false;
    document.documentElement.classList.add('player-open');
    closeBtn.focus();
  }
  function close() {
    modal.hidden = true;
    frame.innerHTML = '';
    document.documentElement.classList.remove('player-open');
    if (lastFocus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var linkedin = link.getAttribute('data-li');
    var id = videoId(link);
    if (!(id || linkedin) || link.closest('.explore, .no-player')) return;
    e.preventDefault();
    open(id, linkedin);
  });
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });
})();

// Logos des logiciels : la liste est répétée pour remplir la largeur,
// puis doublée pour que le défilement boucle sans saut.
(function () {
  document.querySelectorAll('.icons.marquee').forEach(function (box) {
    // Chaque logo reçoit une étiquette avec le nom du logiciel, visible au survol.
    var logos = Array.prototype.slice.call(box.children).map(function (img) {
      var item = document.createElement('span');
      item.className = 'logo-item';
      var name = document.createElement('span');
      name.className = 'logo-name mono';
      name.textContent = img.getAttribute('title') || img.alt;
      name.setAttribute('aria-hidden', 'true');
      img.removeAttribute('title');
      box.replaceChild(item, img);
      item.appendChild(img);
      item.appendChild(name);
      return item;
    });
    var track = document.createElement('div');
    track.className = 'marquee-track';
    var set = document.createElement('div');
    set.className = 'marquee-set';
    logos.forEach(function (el) { set.appendChild(el); });
    track.appendChild(set);
    box.appendChild(track);
    // Répète les logos tant qu'une série est plus étroite que le bloc.
    var guard = 0;
    while (set.scrollWidth < box.clientWidth && guard++ < 10) {
      logos.forEach(function (el) {
        var c = el.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        c.querySelector('img').alt = '';
        set.appendChild(c);
      });
    }
    var copy = set.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    track.appendChild(copy);
    // Vitesse constante (environ 40 px par seconde), quelle que soit la longueur.
    track.style.setProperty('--marquee-dur', Math.max(20, set.scrollWidth / 40) + 's');
  });
})();

// Accueil : effet « sur place ». Tous les panneaux restent collés à l'écran (CSS sticky) ;
// quand le suivant monte par-dessus, celui de dessous se floute, recule et disparaît en fondu.
(function () {
  if (!document.querySelector('.explore')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var panels = [document.getElementById('top'), document.getElementById('competences'),
    document.querySelector('#explorer .section-head')]
    .concat(Array.prototype.slice.call(document.querySelectorAll('.explore .explore-card')))
    .concat([document.getElementById('contact')])
    .filter(Boolean);
  document.documentElement.classList.add('stacking');
  panels.forEach(function (p) { p.classList.add('stack-panel'); });

  var ticking = false;
  function layout() {
    var vh = window.innerHeight;
    // Un panneau plus haut que l'écran se colle quand son bas atteint le bas de l'écran.
    panels.forEach(function (p) { p.style.setProperty('--stick', Math.min(0, vh - p.offsetHeight) + 'px'); });
    update();
  }
  function update() {
    ticking = false;
    var vh = window.innerHeight;
    panels.forEach(function (p, i) {
      var next = panels[i + 1];
      var t = 0;
      if (next) {
        // Part du panneau recouverte par le suivant : 0 = pas encore touché, 1 = entièrement recouvert.
        var h = p.offsetHeight;
        var stick = Math.min(0, vh - h);
        // Le fondu se termine un peu avant le recouvrement complet, pour ne laisser aucun reste visible.
        t = Math.min(1, Math.max(0, 1.3 * (stick + h - next.getBoundingClientRect().top) / Math.min(h, vh)));
      }
      // Courbe douce (smoothstep) pour que le fondu démarre et finisse sans à-coup.
      var e = t * t * (3 - 2 * t);
      // Bord haut adouci tant que le panneau monte (il redevient net une fois posé).
      var h2 = p.offsetHeight;
      var rise = p.getBoundingClientRect().top - Math.min(0, vh - h2);
      // Seulement quand le panneau recouvre celui d'avant, et seulement pendant le scroll.
      var prev = panels[i - 1];
      var overlapping = prev && rise < prev.offsetHeight;
      var top = overlapping ? Math.round(Math.min(90, Math.max(0, rise) * 0.25) * activity) : 0;
      // Bas du panneau qui part : il se dissout progressivement, pas de ligne de coupure.
      var bottom = e > 0 ? Math.round((20 + e * 60) * activity) : 0;
      if (top || bottom) {
        var mask = 'linear-gradient(to bottom, transparent 0, #000 ' + top + 'px, #000 ' + (100 - bottom) + '%, transparent 100%)';
        p.style.webkitMaskImage = p.style.maskImage = mask;
      } else {
        p.style.webkitMaskImage = p.style.maskImage = '';
      }
      if (t <= 0) {
        p.style.opacity = '';
        p.style.filter = '';
        p.style.transform = '';
      } else {
        p.style.opacity = (1 - e).toFixed(3);
        p.style.filter = 'blur(' + (e * 16).toFixed(1) + 'px)';
        p.style.transform = 'scale(' + (1 - e * 0.05).toFixed(4) + ')';
      }
      p.style.visibility = t >= 1 ? 'hidden' : '';
    });
  }
  // « activity » vaut 1 pendant le scroll, puis redescend en douceur à 0 quand la page s'arrête :
  // les bords fondus n'existent que pendant le mouvement.
  var activity = 0, idleTimer = null, settling = null;
  function settle() {
    var start = performance.now();
    cancelAnimationFrame(settling);
    (function step(now) {
      activity = Math.max(0, 1 - (now - start) / 350);
      update();
      if (activity > 0) settling = requestAnimationFrame(step);
    })(start);
  }
  function onScroll() {
    cancelAnimationFrame(settling);
    activity = 1;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(settle, 140);
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', layout);
  window.addEventListener('load', layout);
  layout();
})();

// Reflets du verre des titres : suivent l'inclinaison du téléphone (ou la souris).
(function () {
  var glass = document.querySelectorAll('.hero h1, .page-hero h1');
  if (!glass.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var tx = 0, ty = 0, x = 0, y = 0, running = false;
  function clamp(v) { return Math.max(-1, Math.min(1, v)); }
  function tick() {
    x += (tx - x) * 0.12; y += (ty - y) * 0.12;
    for (var i = 0; i < glass.length; i++) {
      glass[i].style.setProperty('--gx', x.toFixed(3));
      glass[i].style.setProperty('--gy', y.toFixed(3));
    }
    document.documentElement.style.setProperty('--gx', x.toFixed(3));
    document.documentElement.style.setProperty('--gy', y.toFixed(3));
    if (Math.abs(tx - x) > 0.001 || Math.abs(ty - y) > 0.001) requestAnimationFrame(tick);
    else running = false;
  }
  function set(nx, ny) {
    tx = clamp(nx); ty = clamp(ny);
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  var base = null;
  function onTilt(e) {
    if (e.beta == null || e.gamma == null) return;
    if (base === null) base = e.beta;
    set(e.gamma / 30, (e.beta - base) / 30);
  }
  function listen() { window.addEventListener('deviceorientation', onTilt); }
  var D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') {
    // iPhone : il faut l'accord de l'utilisateur, demandé au premier toucher.
    var ask = function () {
      document.removeEventListener('touchend', ask);
      document.removeEventListener('click', ask);
      D.requestPermission().then(function (s) { if (s === 'granted') listen(); }).catch(function () {});
    };
    document.addEventListener('touchend', ask);
    document.addEventListener('click', ask);
  } else if (D) {
    listen();
  }
  window.addEventListener('mousemove', function (e) {
    set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });
})();

// Accueil : plan d'ouverture en couches. Chaque couche glisse à sa vitesse au scroll (parallaxe).
(function () {
  var scene = document.querySelector('.hero .scene');
  if (!scene || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var ticking = false;
  function update() {
    ticking = false;
    scene.style.setProperty('--sy', Math.min(window.scrollY, window.innerHeight * 1.5).toFixed(1));
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();
