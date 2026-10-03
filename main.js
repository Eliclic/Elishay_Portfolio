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
