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
    // Miniature maison (data-poster) à la place de celle de YouTube.
    var poster = card.getAttribute('data-poster');
    if (poster) { img.src = poster; card.insertBefore(img, card.firstChild); return; }
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
        t = Math.min(1, Math.max(0, (document.documentElement.classList.contains('has-liquid') ? 2.2 : 1.3) * (stick + h - next.getBoundingClientRect().top) / Math.min(h, vh)));
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

// Fond « métal liquide » animé (WebGL), d'après la texture After Effects d'Elishay :
// bruit fractal tourbillonnant, teinte métallique gris argent, veines sombres et léger glow doré.
(function () {
  var c = document.createElement('canvas');
  c.className = 'liquid-bg';
  c.setAttribute('aria-hidden', 'true');
  var gl = c.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return;
  document.body.insertBefore(c, document.body.firstChild);
  document.documentElement.classList.add('has-liquid');

  var vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var fs = [
    'precision mediump float;',
    'uniform vec2 R;uniform float T;',
    'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);',
    ' for(int i=0;i<4;i++){v+=a*n(p);p=m*p;a*=.5;}return v;}',
    // Hauteur du « liquide » : bruit déformé deux fois sur lui-même (effet Swirly).
    'float H(vec2 p){vec2 q=vec2(fbm(p*.9+vec2(0.,T*.16)),fbm(p*.9+vec2(5.2,1.3)-T*.13));',
    ' return fbm(p+1.7*q+vec2(T*.05,-T*.04));}',
    'void main(){vec2 uv=gl_FragCoord.xy/R.y;vec2 p=uv*8.;',
    ' float e=.035;float h=H(p);float hx=H(p+vec2(e,0.));float hy=H(p+vec2(0.,e));',
    ' vec3 N=normalize(vec3((h-hx)/e,(h-hy)/e,2.2));',
    ' vec3 L=normalize(vec3(-.4,.6,.7));',
    ' float dif=max(dot(N,L),0.);float spe=pow(max(dot(reflect(-L,N),vec3(0,0,1)),0.),18.);',
    // Contraste fort comme le rendu AE : blancs argentés, veines presque noires.
    ' float m=smoothstep(.04,.42,abs(h-.5)*2.)*(.45+.75*smoothstep(.3,.75,h));',
    ' vec3 col=vec3(.86,.87,.9)*m*(.35+.65*dif)+vec3(1.)*spe*.55*m;',
        // Léger glow doré champagne sur les reflets.
    ' vec3 gold=vec3(.83,.72,.55);col+=gold*(m*.07+pow(m,3.)*.2+spe*.14);',
    ' vec2 v=gl_FragCoord.xy/R-.5;col*=1.-dot(v,v)*.9;',
    ' gl_FragColor=vec4(col*.5,1.);}'
  ].join('\n');

  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }
  var pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { c.remove(); document.documentElement.classList.remove('has-liquid'); return; }
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var a = gl.getAttribLocation(pr, 'a');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  var uR = gl.getUniformLocation(pr, 'R'), uT = gl.getUniformLocation(pr, 'T');

  // Rendu en demi-résolution (texture douce, économe en batterie), 30 images/s.
  function size() {
    var k = Math.min(0.5, 900 / Math.max(window.innerWidth, window.innerHeight));
    c.width = Math.round(window.innerWidth * k);
    c.height = Math.round(window.innerHeight * k);
    gl.viewport(0, 0, c.width, c.height);
    gl.uniform2f(uR, c.width, c.height);
  }
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var t0 = performance.now(), last = 0;
  function draw(now) {
    gl.uniform1f(uT, (now - t0) / 1000 + 20);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function loop(now) {
    if (!document.hidden && now - last > 33) { last = now; draw(now); }
    if (!still) requestAnimationFrame(loop);
  }
  window.addEventListener('resize', function () { size(); if (still) draw(performance.now()); });
  size();
  requestAnimationFrame(loop);
})();

// Liquid glass d'Elishay derrière les titres de page (d'après son effet After Effects :
// Fractal Noise très contrasté, flou, enroulé sur une sphère VR qui tourne, teinte noir → rouge).
(function () {
  var titles = document.querySelectorAll('h1[data-blob]');
  if (!titles.length) return;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var fs = [
    'precision mediump float;',
    'uniform vec2 R;uniform float T;uniform float RR;',
    'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);',
    ' for(int i=0;i<4;i++){v+=a*n(p);p=m*p;a*=.5;}return v;}',
    'void main(){',
    ' vec2 p=gl_FragCoord.xy/R*2.-1.;',
    // Forme : exactement le cadre en verre du titre (rectangle aux coins arrondis, rayon RR en px).
    ' vec2 hp=R*.5;vec2 pp=p*hp;vec2 qq=abs(pp)-(hp-RR);',
    ' float d=length(max(qq,0.))+min(max(qq.x,qq.y),0.)-RR;',
    ' float r=clamp(1.+d/min(hp.x,hp.y),0.,1.);',
    ' float mask=clamp(-d,0.,1.);',
    ' if(mask<=0.){gl_FragColor=vec4(0.);return;}',
    ' float z=sqrt(max(1.-r*r*.985,0.));',
    ' vec2 s=p/(z+.1);',
    // VR Rotate Sphere : la sphère tourne lentement (pan), la texture défile dessus.
    ' vec2 uv=s*vec2(R.x/R.y,1.)*vec2(.75,.42)+vec2(T*.09,sin(T*.13)*.25);',
    // Evolution : bruit déformé sur lui-même, contraste fort puis adouci.
    ' vec2 q=vec2(fbm(uv*1.4+vec2(0.,T*.1)),fbm(uv*1.4+vec2(4.1,1.7)-T*.08));',
    ' float v=fbm(uv*2.+1.3*q);',
    ' float c=smoothstep(.3,.72,v);c=c*c*(3.-2.*c);',
    ' float rim=smoothstep(.5,.9,r);',
    ' float lum=clamp(c*(.65+.6*rim),0.,1.);',
    // Bord lumineux toujours visible, strié par le bruit, pour garder la silhouette du verre.
    ' float edge=smoothstep(.68,.9,r)*(1.-smoothstep(.93,1.,r));',
    ' lum=max(lum,edge*(.3+.5*smoothstep(.35,.65,fbm(uv*3.+T*.05))));',
    ' lum*=1.-smoothstep(.93,1.,r)*.6;',
    ' vec3 col=vec3(.95,0.,0.)*lum+vec3(1.,.25,.2)*pow(lum,5.)*.3;',
    ' float al=mask*(.7+.3*lum);',
    ' gl_FragColor=vec4(col*mask,al);}'
  ].join('\n');

  titles.forEach(function (h) {
    // Le canvas vit dans le titre : il suit son cadre, ses coins et son flottement.
    var c = document.createElement('canvas');
    c.className = 'title-liquid';
    c.setAttribute('aria-hidden', 'true');
    h.insertBefore(c, h.firstChild);
    var gl = c.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' });
    if (!gl) { c.remove(); return; }
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { c.remove(); return; }
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(pr, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    var uR = gl.getUniformLocation(pr, 'R'), uT = gl.getUniformLocation(pr, 'T'), uRR = gl.getUniformLocation(pr, 'RR');

    function size() {
      var k = Math.min(1, (window.devicePixelRatio || 1) * 0.6);
      c.width = Math.max(2, Math.round(c.clientWidth * k));
      c.height = Math.max(2, Math.round(c.clientHeight * k));
      gl.viewport(0, 0, c.width, c.height);
      gl.uniform2f(uR, c.width, c.height);
      gl.uniform1f(uRR, (parseFloat(getComputedStyle(h).borderTopLeftRadius) || 0) * c.width / Math.max(1, c.clientWidth));
    }
    var t0 = performance.now(), last = 0, visible = true;
    function draw(now) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uT, (now - t0) / 1000 + 8);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function loop(now) {
      if (visible && !document.hidden && now - last > 33) { last = now; draw(now); }
      if (!still) requestAnimationFrame(loop);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(c);
    }
    window.addEventListener('resize', function () { size(); draw(performance.now()); });
    size();
    draw(performance.now());
    requestAnimationFrame(loop);
  });
})();
