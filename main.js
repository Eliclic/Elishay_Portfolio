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

  function open(id) {
    lastFocus = document.activeElement;
    frame.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
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
    var id = videoId(link);
    if (!id || link.closest('.explore, .no-player')) return;
    e.preventDefault();
    open(id);
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

// Photos (polaroïds) en décor de fond. Chaque photo n'apparaît que sur une seule page ;
// pour en ajouter, il suffit d'une ligne [fichier, page] dans cette liste.
(function () {
  var PHOTOS = [
    ['palmiers', 'index'],
    ['joggeur', 'index'],
    ['concert-1', 'projets'],
    ['coucher-soleil', 'etalonnage'],
    ['charpente', 'vfx'],
    ['sentier', 'freelance'],
    ['nids', 'oulpan-lavi'],
    ['concert-2', 'alexandre-triche']
  ];
  var page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
  if (page === 'accueil' || page === '') page = 'index';
  var mine = PHOTOS.filter(function (p) { return p[1] === page; });
  if (!mine.length) return;

  var fixed = !!document.querySelector('.explore'); // accueil : les photos restent fixes derrière les panneaux
  var layer = document.createElement('div');
  layer.className = 'photo-layer' + (fixed ? ' is-fixed' : '');
  layer.setAttribute('aria-hidden', 'true');
  mine.forEach(function (p, k) {
    var fig = document.createElement('figure');
    fig.className = 'polaroid ' + (k % 2 ? 'right' : 'left');
    // Inclinaison et hauteur légèrement variées pour un rendu « posé à la main ».
    fig.style.setProperty('--r', (k % 2 ? 1 : -1) * (4 + (k * 3) % 5) + 'deg');
    fig.style.setProperty('--y', ((k + 1) / (mine.length + 1) * 100 - 10 + (k % 2) * 12) + '%');
    var img = document.createElement('img');
    img.src = 'assets/photos/' + p[0] + '.jpg';
    img.alt = '';
    img.loading = 'lazy';
    fig.appendChild(img);
    layer.appendChild(fig);
  });
  document.body.insertBefore(layer, document.body.firstChild);
  function size() { if (!fixed) layer.style.height = document.documentElement.scrollHeight + 'px'; }
  window.addEventListener('load', size);
  window.addEventListener('resize', size);
  size();
})();
