// Page test : appareil photo 3D en vue éclatée, piloté par le scroll (inspiré du template « Camera » de Scrolltide).
// Le boîtier est construit en géométrie simple (pas de modèle à charger) avec un rendu « rayons X » :
// surfaces de verre très transparentes et arêtes argentées, capteur en or champagne.
import * as THREE from './vendor/three.module.min.js';

const canvas = document.getElementById('cam3d');
const labelsBox = document.getElementById('cam-labels');
const lines = document.getElementById('cam-lines');
const panels = Array.from(document.querySelectorAll('.cam-panel'));
const bar = document.querySelector('.cam-progress span');
const hint = document.querySelector('.cam-hint');
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
cam.position.set(0, 0.4, 13);

scene.add(new THREE.AmbientLight(0x9aa3c0, 1.2));
const key = new THREE.DirectionalLight(0xdfe6ff, 2.2); key.position.set(-4, 6, 8); scene.add(key);
const rim = new THREE.PointLight(0xd4b98c, 30, 20); rim.position.set(4, -1, 3); scene.add(rim);

const GOLD = 0xd4b98c;
const model = new THREE.Group();
scene.add(model);

// ---------- Matériaux ----------
function shellMat(color = 0xc9cdd8, opacity = 0.13) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.25, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
}
function edgeMat(color = 0xe9edf7, opacity = 0.6) {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
}

// ---------- Géométries ----------
function roundBox(w, h, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -d / 2);
  return g;
}
function tube(r1, r2, len, seg = 28) {
  const g = new THREE.CylinderGeometry(r1, r2, len, seg, 1, true);
  g.rotateX(Math.PI / 2);
  return g;
}
function disc(r, len, seg = 48) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  return g;
}
function lensGlass(r, thick) {
  const g = new THREE.SphereGeometry(r, 40, 12);
  g.scale(1, 1, thick / r);
  return g;
}

// ---------- Pièces ----------
// Chaque pièce a une position assemblée et des décalages pour chaque mode d'éclatement :
// ex = démontage général, lens = groupe optique, core = capteur et électronique, top = châssis et commandes.
const parts = {};
function part(name, geo, pos, group, off, opts = {}) {
  const g = new THREE.Group();
  const mat = opts.mat || shellMat(opts.color, opts.opacity);
  const mesh = new THREE.Mesh(geo, mat);
  g.add(mesh);
  const em = edgeMat(opts.edge || 0xe9edf7, opts.edgeOpacity ?? 0.6);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, opts.angle ?? 25), em));
  if (opts.rot) g.rotation.set(...opts.rot);
  g.position.set(...pos);
  model.add(g);
  parts[name] = { obj: g, base: new THREE.Vector3(...pos), group, off, mats: [mat, em], o: [mat.opacity, em.opacity] };
  return g;
}
const V = (x = 0, y = 0, z = 0) => [x, y, z];

// Boîtier
part('front', roundBox(3.2, 2.0, 0.16, 0.22), V(0, 0, 0.47), 'body', { ex: V(0, 0, 1.3), core: V(-0.4, 2.3, 0.6), lens: V(0, 0, 0.3) });
part('rear', roundBox(3.2, 2.0, 0.16, 0.22), V(0, 0, -0.47), 'body', { ex: V(0, 0, -1.3), core: V(0, 0, -1.6) });
part('screen', new THREE.BoxGeometry(2.0, 1.3, 0.04), V(0.2, 0, -0.58), 'body', { ex: V(0, 0, -2.0), core: V(0, 0, -2.3) }, { color: 0x6f7ea8, opacity: 0.25 });
part('topPlate', new THREE.BoxGeometry(3.0, 0.1, 0.9), V(0, 0.98, 0), 'top', { ex: V(0, 1.2, 0), top: V(0, 0.9, 0) });
part('bottomPlate', new THREE.BoxGeometry(3.0, 0.1, 0.9), V(0, -0.98, 0), 'top', { ex: V(0, -1.2, 0), top: V(0, -0.9, 0) });
part('chassis', new THREE.BoxGeometry(2.9, 1.8, 0.78), V(0, 0, 0), 'top', { ex: V(0, 0, 0), core: V(0, 0, -0.6) }, { opacity: 0.05, edgeOpacity: 0.45 });
part('grip', roundBox(0.7, 1.95, 0.5, 0.25), V(-1.3, 0, 0.72), 'body', { ex: V(-1.7, 0, 0.7), core: V(-1.2, 0, 1.2) });

// Commandes du dessus
part('prism', new THREE.CylinderGeometry(0.42, 0.72, 0.55, 4), V(0.15, 1.3, -0.05), 'top', { ex: V(0, 2.1, 0), top: V(0, 1.7, 0) }, { rot: V(0, Math.PI / 4, 0) });
part('eyepiece', roundBox(0.6, 0.38, 0.28, 0.1), V(0.15, 1.32, -0.6), 'top', { ex: V(0, 2.0, -1.3), top: V(0, 1.6, -1.1) });
part('shutterDial', new THREE.CylinderGeometry(0.27, 0.27, 0.14, 32), V(1.05, 1.11, 0.05), 'top', { ex: V(0.7, 2.4, 0), top: V(0.6, 2.0, 0) });
part('modeDial', new THREE.CylinderGeometry(0.22, 0.22, 0.14, 32), V(-0.9, 1.11, 0.05), 'top', { ex: V(-0.7, 2.3, 0), top: V(-0.6, 1.9, 0) });
part('button', new THREE.CylinderGeometry(0.09, 0.09, 0.1, 20), V(1.05, 1.24, 0.05), 'top', { ex: V(0.9, 3.0, 0), top: V(0.8, 2.6, 0) });

// Groupe optique (axe z)
const LX = 0.2, LY = -0.05;
part('mount', new THREE.TorusGeometry(0.62, 0.05, 12, 64), V(LX, LY, 0.6), 'lens', { ex: V(0, 0, 1.6), lens: V(0, 0, 0.9), core: V(-3.0, -2.2, -1.8) }, { edgeOpacity: 0.35 });
part('barrelRear', tube(0.62, 0.62, 0.5), V(LX, LY, 0.86), 'lens', { ex: V(0, 0, 2.1), lens: V(0, 0, 1.7), core: V(-3.0, -2.2, -1.8) }, { edgeOpacity: 0.7, angle: 1 });
part('focusRing', disc(0.69, 0.3, 36), V(LX, LY, 1.2), 'lens', { ex: V(0, 0, 2.7), lens: V(0, 0, 2.7), core: V(-3.0, -2.2, -1.8) }, { opacity: 0.18, angle: 1 });
part('barrelFront', tube(0.66, 0.72, 0.5), V(LX, LY, 1.55), 'lens', { ex: V(0, 0, 3.2), lens: V(0, 0, 3.7), core: V(-3.0, -2.2, -1.8) }, { edgeOpacity: 0.7, angle: 1 });
const glass = { color: 0xb9c8ff, opacity: 0.22, edge: 0xdbe4ff, edgeOpacity: 0.0, angle: 89 };
for (let i = 0; i < 5; i++) {
  const r = 0.42 + i * 0.03;
  part('glass' + i, lensGlass(r, 0.08 + (i % 2) * 0.05), V(LX, LY, 0.72 + i * 0.22), 'lens',
    { ex: V(0, (i - 2) * 0.08, 1.9 + i * 0.45), lens: V(0, (i % 2 ? 0.12 : -0.12), 1.2 + i * 0.85), core: V(-3.0, -2.2, -1.8) }, glass);
}
part('frontGlass', lensGlass(0.6, 0.16), V(LX, LY, 1.82), 'lens', { ex: V(0, 0, 3.6), lens: V(0, 0, 5.4), core: V(-3.0, -2.2, -1.8) }, { ...glass, opacity: 0.26 });

// Contour lumineux de chaque lentille (à la place du maillage complet, trop chargé)
for (const k of ['glass0', 'glass1', 'glass2', 'glass3', 'glass4', 'frontGlass']) {
  const r = parts[k].obj.children[0].geometry.parameters.radius;
  const pts = [];
  for (let a = 0; a <= 64; a++) pts.push(new THREE.Vector3(Math.cos(a / 64 * Math.PI * 2) * r, Math.sin(a / 64 * Math.PI * 2) * r, 0));
  const m = edgeMat(0xe6ecff, 0.9);
  const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m);
  const inner = ring.clone(); inner.scale.setScalar(0.55); inner.material = edgeMat(0xe6ecff, 0.25);
  parts[k].obj.add(ring, inner);
  parts[k].mats.push(m); parts[k].o.push(0.9);
}

// Capteur et électronique
const sensorMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.85 });
part('sensor', new THREE.BoxGeometry(1.0, 0.72, 0.04), V(LX, LY, 0.22), 'core', { ex: V(0, 0, 0.5), core: V(1.5, 0.35, 1.0) }, { mat: sensorMat, edge: 0xffe9c2, edgeOpacity: 0.9 });
part('shutter', new THREE.BoxGeometry(1.2, 0.9, 0.03), V(LX, LY, 0.34), 'core', { ex: V(0, 0, 0.95), core: V(0.6, 1.4, 1.6) }, { opacity: 0.1 });
part('board', new THREE.BoxGeometry(2.2, 1.4, 0.05), V(0, 0, -0.22), 'core', { ex: V(0, 0, -0.55), core: V(-1.5, -0.1, 0.4) }, { color: 0x8f9bc4, opacity: 0.18 });
[[-0.6, 0.3], [0.3, -0.3], [0.65, 0.35], [-0.3, -0.35]].forEach(([x, y], i) => {
  const chip = new THREE.Mesh(new THREE.BoxGeometry(i ? 0.3 : 0.45, i ? 0.3 : 0.45, 0.06), shellMat(0xd8dcf0, 0.35));
  chip.position.set(x, y, 0.05);
  chip.add(new THREE.LineSegments(new THREE.EdgesGeometry(chip.geometry), edgeMat(0xffffff, 0.7)));
  parts.board.obj.add(chip);
});
part('cell', roundBox(0.48, 1.4, 0.34, 0.12), V(-1.15, -0.05, 0.02), 'core', { ex: V(-1.4, -0.6, -0.6), core: V(-1.3, -1.3, 0.9) });
part('gear', new THREE.TorusGeometry(0.17, 0.05, 8, 24), V(1.3, 0.55, 0.05), 'core', { ex: V(2.2, 1.0, 0.9), core: V(1.2, 1.1, 1.4) }, { edge: GOLD, edgeOpacity: 0.7 });

// Vis éparpillées
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2;
  const p = V(Math.cos(a) * 1.45, Math.sin(a) * 0.9, (i % 2 ? 0.45 : -0.45));
  part('screw' + i, new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), p, 'body',
    { ex: V(Math.cos(a) * 2.2, Math.sin(a) * 1.8, (i % 2 ? 1.6 : -1.6)), core: V(Math.cos(a) * 0.8, Math.sin(a) * 0.6, 0) }, { opacity: 0.4, rot: V(Math.PI / 2, 0, 0) });
}

// Halo doré derrière le capteur et halo froid derrière l'objectif
function glowTex(rgb) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},0.9)`); g.addColorStop(0.35, `rgba(${rgb},0.25)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const sensorGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('212,185,140'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
sensorGlow.scale.set(2.6, 2.6, 1);
parts.sensor.obj.add(sensorGlow);
const lensGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('170,185,255'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.18 }));
lensGlow.scale.set(3, 3, 1);
parts.frontGlass.obj.add(lensGlow);

// Poussière lumineuse
const dust = new THREE.BufferGeometry();
const dp = new Float32Array(240 * 3);
for (let i = 0; i < dp.length; i++) dp[i] = (Math.random() - 0.5) * (i % 3 === 2 ? 8 : 14);
dust.setAttribute('position', new THREE.BufferAttribute(dp, 3));
const dustPts = new THREE.Points(dust, new THREE.PointsMaterial({ color: 0xcfd6ee, size: 0.025, transparent: true, opacity: 0.5 }));
scene.add(dustPts);

// ---------- Chapitres ----------
// side = côté du texte (le modèle se décale de l'autre côté), focus = groupe mis en avant.
const chapters = [
  { rx: 0.18, ry: -0.55, zoom: 1.0, side: 'left', w: { ex: 0, lens: 0, core: 0, top: 0 }, focus: null, labels: [] },
  { rx: 0.25, ry: -0.9, zoom: 0.82, side: 'right', mx: 0.4, w: { ex: 1, lens: 0, core: 0, top: 0 }, focus: null, labels: [] },
  { rx: 0.1, ry: 1.15, zoom: 0.56, side: 'left', x: -1.6, mx: -1.5, y: 0.2, w: { ex: 0.25, lens: 1, core: 0, top: 0 }, focus: 'lens',
    labels: [['frontGlass', 'Lentille frontale', 'VERRE ED'], ['focusRing', 'Bague de mise au point', 'LINÉAIRE · 120°'], ['mount', 'Baïonnette', '12 CONTACTS']] },
  { rx: 0.12, ry: -0.35, zoom: 1.0, side: 'right', w: { ex: 0.1, lens: 0, core: 1, top: 0 }, focus: 'core', mx: 0.5,
    labels: [['sensor', 'Capteur', 'PLEIN FORMAT'], ['board', 'Carte logique', 'TRAITEMENT'], ['cell', 'Batterie', '2 300 IMAGES']] },
  { rx: 0.42, ry: 0.55, zoom: 0.95, side: 'left', w: { ex: 0.15, lens: 0, core: 0, top: 1 }, focus: 'top',
    labels: [['prism', 'Prisme', 'PENTAPRISME'], ['shutterDial', 'Molette', 'VITESSE'], ['chassis', 'Châssis', 'MAGNÉSIUM']] },
  { rx: 0.15, ry: 0.5, zoom: 0.7, side: 'center', y: 1.15, w: { ex: 0, lens: 0, core: 0, top: 0 }, focus: null, labels: [] }
];

const mobile = () => window.innerWidth < 760;
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const sideX = (c) => (mobile() ? (c.mx ?? 0) : (c.x ?? 0) + (c.side === 'left' ? 1.7 : c.side === 'right' ? -1.7 : 0));

// Étiquettes HTML (une par pièce étiquetable)
const labelEls = {};
let labelN = 0;
chapters.forEach((c) => c.labels.forEach(([p, t, s]) => {
  if (labelEls[p]) return;
  const el = document.createElement('div');
  el.className = 'cam-label';
  el.innerHTML = `<span class="cam-label-t">${t}</span><span class="cam-label-s">${s}</span>`;
  labelsBox.appendChild(el);
  const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  lines.appendChild(ln);
  labelEls[p] = { el, ln, up: labelN++ % 2 === 0 };
}));

let progress = 0, smooth = 0, mx = 0, my = 0, sx = 0, sy = 0;
function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress = max > 0 ? (window.scrollY / max) * (chapters.length - 1) : 0;
}
window.addEventListener('scroll', readScroll, { passive: true });
window.addEventListener('mousemove', (e) => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; }, { passive: true });

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  cam.aspect = w / h;
  cam.fov = mobile() ? 44 : 32;
  cam.updateProjectionMatrix();
  lines.setAttribute('viewBox', `0 0 ${w} ${h}`);
  readScroll();
}
window.addEventListener('resize', resize);
resize();

const tmp = new THREE.Vector3();
const clock = new THREE.Clock();
function frame() {
  const t = clock.getElapsedTime();
  smooth += (progress - smooth) * (still ? 1 : 0.08);
  sx += (mx - sx) * 0.05; sy += (my - sy) * 0.05;

  const i = Math.min(chapters.length - 2, Math.floor(smooth));
  const f = ease(Math.min(1, Math.max(0, smooth - i)));
  const A = chapters[i], B = chapters[i + 1];

  // Rotation, zoom et décalage du modèle
  model.rotation.x = lerp(A.rx, B.rx, f) + sy * 0.15;
  model.rotation.y = lerp(A.ry, B.ry, f) + sx * 0.3 + (still ? 0 : Math.sin(t * 0.3) * 0.05);
  const z = lerp(A.zoom, B.zoom, f) * (mobile() ? 0.5 : 1);
  model.scale.setScalar(z);
  model.position.x = lerp(sideX(A), sideX(B), f);
  model.position.y = (mobile() ? 1.1 : 0) + lerp(A.y ?? 0, B.y ?? 0, f) + (still ? 0 : Math.sin(t * 0.6) * 0.05);

  // Éclatement des pièces et mise en avant d'un groupe
  for (const k in parts) {
    const p = parts[k];
    tmp.copy(p.base);
    for (const m of ['ex', 'lens', 'core', 'top']) {
      const o = p.off[m]; if (!o) continue;
      const wv = lerp(A.w[m], B.w[m], f);
      tmp.x += o[0] * wv; tmp.y += o[1] * wv; tmp.z += o[2] * wv;
    }
    p.obj.position.copy(tmp);
    const dimA = A.focus && A.focus !== p.group ? 1 : 0;
    const dimB = B.focus && B.focus !== p.group ? 1 : 0;
    const dim = 1 - 0.72 * lerp(dimA, dimB, f);
    for (let j = 0; j < p.mats.length; j++) p.mats[j].opacity = p.o[j] * dim;
  }
  parts.sensor.obj.rotation.z = (still ? 0 : Math.sin(t * 0.5) * 0.04);
  parts.gear.obj.rotation.z = t * 0.6;
  dustPts.rotation.y = t * 0.01;

  renderer.render(scene, cam);

  // Étiquettes : visibles dans le chapitre qui les déclare
  const w = window.innerWidth, h = window.innerHeight;
  for (const k in labelEls) {
    const inA = A.labels.some((l) => l[0] === k) ? 1 - f : 0;
    const inB = B.labels.some((l) => l[0] === k) ? f : 0;
    const a = Math.max(0, (Math.max(inA, inB) - 0.35) / 0.65);
    const { el, ln, up } = labelEls[k];
    if (a <= 0.01) { el.style.opacity = 0; ln.style.opacity = 0; continue; }
    parts[k].obj.getWorldPosition(tmp).project(cam);
    const px = (tmp.x * 0.5 + 0.5) * w, py = (-tmp.y * 0.5 + 0.5) * h;
    const right = px > w / 2 + (model.position.x > 0 ? w * 0.18 : model.position.x < 0 ? -w * 0.18 : 0);
    let side = right;
    // Garde l'étiquette dans l'écran : on la retourne si elle déborde.
    const ew = el.offsetWidth || 120;
    if (side && px + 60 + ew > w - 16) side = false;
    else if (!side && px - 60 - ew < 16) side = true;
    const lx = px + (side ? 60 : -60), ly = Math.min(h - 40, Math.max(90, py + (up ? -48 : 48)));
    el.style.opacity = a; ln.style.opacity = a * 0.7;
    el.style.transform = `translate(${side ? lx : lx - el.offsetWidth}px, ${ly - el.offsetHeight / 2}px)`;
    el.classList.toggle('is-left', !side);
    ln.setAttribute('x1', px); ln.setAttribute('y1', py); ln.setAttribute('x2', lx); ln.setAttribute('y2', ly);
  }

  // Textes des chapitres
  panels.forEach((p, k) => {
    const d = smooth - k;
    const a = Math.max(0, 1 - Math.abs(d) * 2.4);
    p.style.opacity = a.toFixed(3);
    p.style.transform = `translateY(${(-d * 40).toFixed(1)}px)`;
    p.style.visibility = a > 0.01 ? 'visible' : 'hidden';
  });
  if (hint) hint.style.opacity = Math.max(0, 1 - smooth * 3).toFixed(2);
  if (bar) bar.style.transform = `scaleX(${(smooth / (chapters.length - 1)).toFixed(4)})`;

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Bouton « Démonter » : descend au chapitre suivant
document.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', (e) => {
  e.preventDefault();
  window.scrollTo({ top: window.innerHeight * 1.2, behavior: still ? 'auto' : 'smooth' });
}));
