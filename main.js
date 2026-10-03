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
