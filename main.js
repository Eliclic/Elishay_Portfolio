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

// Aberration chromatique permanente : filtre SVG qui décale les canaux rouge et bleu.
(function () {
  var ns = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  // #chroma : décalage des canaux, toujours visible.
  function filter(id, dx, animated) {
    function off(src, sign) {
      var anim = animated ? '<animate attributeName="dx" values="' +
        [dx, dx + 2, dx - 1, dx + 1, dx].map(function (v) { return v * sign; }).join(';') +
        '" dur=".7s" repeatCount="indefinite"/>' : '';
      return '<feOffset in="' + src + '" dx="' + dx * sign + '" dy="0" result="' + src + '2">' + anim + '</feOffset>';
    }
    return '<filter id="' + id + '" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">' +
      '<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>' + off('r', -1) +
      '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>' +
      '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>' + off('b', 1) +
      '<feBlend in="r2" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b2" mode="screen"/></filter>';
  }
  svg.innerHTML = filter('chroma', 3.5, false);
  document.body.appendChild(svg);
})();
