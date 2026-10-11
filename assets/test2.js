// Page test 2 : le parcours d'une vidéo, décortiqué au scroll.
// Rush brut → timeline DaVinci (cut, zoom, remplacement) → After Effects (roto, motion design) → page Color de DaVinci.
// Tout est dessiné en code : l'image est peinte dans des canvas (un par calque) et affichée en 3D avec three.js.
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
cam.position.set(0, 0.2, 13);

const GOLD = 0xd4b98c;
const root = new THREE.Group();
scene.add(root);

// ---------- Outils ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);
const ramp = (p, a, b) => ease(clamp((p - a) / (b - a)));
const lerp = (a, b, t) => a + (b - a) * t;
const mobile = () => window.innerWidth < 760;

function edgeMat(color = 0xe9edf7, opacity = 0.6) {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
}
function boxMesh(w, h, d, color, opacity, edge = 0xe9edf7, eo = 0.5) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat(edge, eo)));
  return m;
}
// Opacité d'un groupe entier : chaque matériau garde son opacité d'origine dans userData.
function fade(obj, a) {
  obj.visible = a > 0.005;
  obj.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (m.userData.o === undefined) m.userData.o = m.uniforms ? m.uniforms.uOpacity.value : m.opacity;
      if (m.uniforms) m.uniforms.uOpacity.value = m.userData.o * a;
      else m.opacity = m.userData.o * a;
    }
  });
}
function textTex(lines, w = 512, h = 128, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = opts.color || '#f3f4f8';
  x.textBaseline = 'middle';
  lines.forEach(([txt, font, y, color, align]) => {
    x.font = font; x.fillStyle = color || x.fillStyle; x.textAlign = align || 'left';
    x.fillText(txt, align === 'center' ? w / 2 : 10, y);
  });
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  return t;
}
function textPlane(lines, w, h, pw, ph) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: textTex(lines, pw, ph), transparent: true, depthWrite: false }));
}

// ---------- L'image (trois calques peints dans des canvas) ----------
const CW = 640, CH = 360, FW = 4, FH = 2.25;
function layerCanvas() {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { c, x: c.getContext('2d'), t };
}
const L = { bg: layerCanvas(), person: layerCanvas(), title: layerCanvas() };

// Matériau d'un calque : zoom (recadrage), étalonnage (teal & orange) et volet avant / après.
function layerMat(tex, zoomable) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { map: { value: tex }, uZoom: { value: 1 }, uGrade: { value: 0 }, uWipe: { value: 1 }, uOpacity: { value: 1 }, uZoomable: { value: zoomable ? 1 : 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `
      uniform sampler2D map;uniform float uZoom,uGrade,uWipe,uOpacity,uZoomable;varying vec2 vUv;
      void main(){
        vec2 uv=mix(vUv,(vUv-.5)/uZoom+.5,uZoomable);
        vec4 c=texture2D(map,uv);
        vec3 o=c.rgb;
        float l=dot(o,vec3(.299,.587,.114));
        vec3 g=(o-.5)*1.32+.5;
        g=mix(vec3(l),g,1.55);
        g+=vec3(-.05,.025,.07)*(1.-l)*1.2+vec3(.1,.035,-.06)*l;
        float k=uGrade*step(vUv.x,uWipe);
        gl_FragColor=vec4(clamp(mix(o,g,k),0.,1.),c.a*uOpacity);
      }`
  });
}

// Le décor : plan A (ville au crépuscule) puis plan B (bord de mer), tons « log » plats et désaturés.
function drawBg(t, mixB) {
  const { x } = L.bg;
  const sky = (a, b) => { const g = x.createLinearGradient(0, 0, 0, CH); g.addColorStop(0, a); g.addColorStop(0.62, b); return g; };
  x.globalAlpha = 1;
  // Plan A
  x.fillStyle = sky('#6f7280', '#b5a796'); x.fillRect(0, 0, CW, CH);
  x.fillStyle = 'rgba(232,214,188,.7)'; x.beginPath(); x.arc(470, 150, 34, 0, 7); x.fill();
  x.fillStyle = '#5e5f66';
  for (let i = 0; i < 14; i++) { const bw = 30 + (i * 37) % 40, bh = 50 + (i * 53) % 90; x.fillRect(i * 48 - 10, 250 - bh, bw, bh + 10); }
  x.fillStyle = '#4c4d53'; x.fillRect(0, 252, CW, CH - 252);
  x.fillStyle = 'rgba(255,240,210,.25)';
  for (let i = 0; i < 40; i++) x.fillRect((i * 97) % CW, 200 + (i * 31) % 50, 3, 4);
  // Plan B, fondu par-dessus
  if (mixB > 0) {
    x.globalAlpha = mixB;
    x.fillStyle = sky('#7d8291', '#c9ab8c'); x.fillRect(0, 0, CW, CH);
    x.fillStyle = 'rgba(240,215,175,.8)'; x.beginPath(); x.arc(200, 205, 40, 0, 7); x.fill();
    x.fillStyle = '#6d7480'; x.fillRect(0, 210, CW, 60);
    x.strokeStyle = 'rgba(235,215,185,.35)'; x.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const yy = 216 + i * 6; x.beginPath(); x.moveTo(140 - i * 6 + Math.sin(t * 2 + i) * 6, yy); x.lineTo(260 + i * 6 + Math.sin(t * 2 + i) * 6, yy); x.stroke(); }
    x.fillStyle = '#8f8678'; x.fillRect(0, 262, CW, CH - 262);
    x.globalAlpha = 1;
  }
  // Grain
  x.fillStyle = 'rgba(255,255,255,.035)';
  for (let i = 0; i < 160; i++) x.fillRect(Math.random() * CW, Math.random() * CH, 1.5, 1.5);
  L.bg.t.needsUpdate = true;
}

// Le personnage qui marche, sur son propre calque transparent. Renvoie le contour pour la roto.
function drawPerson(t) {
  const { x } = L.person;
  x.clearRect(0, 0, CW, CH);
  const px = 120 + ((t * 26) % 420), gy = 300, s = Math.sin(t * 4.2);
  const hip = [px, gy - 52], sh = [px, gy - 96];
  const footR = [px + s * 18, gy], footL = [px - s * 18, gy];
  const handR = [px + 4 - s * 14, gy - 58], handL = [px - 4 + s * 14, gy - 58];
  x.strokeStyle = x.fillStyle = '#16161c'; x.lineCap = 'round'; x.lineJoin = 'round';
  x.lineWidth = 11;
  [[hip, footR], [hip, footL], [sh, handR], [sh, handL]].forEach(([a, b]) => { x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.stroke(); });
  x.lineWidth = 24; x.beginPath(); x.moveTo(...sh); x.lineTo(...hip); x.stroke();
  x.beginPath(); x.arc(px, gy - 114, 11, 0, 7); x.fill();
  L.person.t.needsUpdate = true;
  // Contour de roto (points de la spline), en coordonnées canvas
  return [[px, gy - 127], [px + 11, gy - 114], [px + 13, gy - 98], [handR[0] + 6, handR[1]], [px + 12, gy - 60],
    [footR[0] + 6, gy + 2], [px + 2, gy - 44], [footL[0] - 6, gy + 2], [px - 12, gy - 60], [handL[0] - 6, handL[1]],
    [px - 13, gy - 98], [px - 11, gy - 114]];
}

// Le titre animé (motion design), sur son calque.
function drawTitle(t, m) {
  const { x } = L.title;
  x.clearRect(0, 0, CW, CH);
  if (m <= 0) { L.title.t.needsUpdate = true; return; }
  const slide = (1 - m) * -160;
  x.save(); x.translate(slide, 0);
  x.fillStyle = 'rgba(212,185,140,.95)'; x.fillRect(40, 70, 6 + m * 120, 3);
  x.font = '600 34px Inter, system-ui, sans-serif'; x.fillStyle = `rgba(245,245,247,${m})`; x.fillText('ELISHAY UNGLIK', 40, 112);
  x.font = '500 13px "IBM Plex Mono", monospace'; x.fillStyle = `rgba(212,185,140,${m})`; x.fillText('MONTEUR VIDÉO · VFX', 42, 136);
  x.restore();
  // Formes graphiques qui tournent
  x.strokeStyle = `rgba(245,245,247,${0.6 * m})`; x.lineWidth = 2;
  x.beginPath(); x.arc(560, 80, 26 + Math.sin(t * 2) * 4, t, t + 4.4); x.stroke();
  x.strokeStyle = `rgba(212,185,140,${0.8 * m})`;
  x.beginPath(); x.arc(560, 80, 14, -t * 1.5, -t * 1.5 + 3.5); x.stroke();
  L.title.t.needsUpdate = true;
}

// ---------- Le cadre vidéo ----------
const frame = new THREE.Group();
root.add(frame);
const layers = {};
['bg', 'person', 'title'].forEach((k) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), layerMat(L[k].t, k !== 'title'));
  m.renderOrder = { bg: 1, person: 2, title: 3 }[k];
  frame.add(m);
  layers[k] = m;
});
// Contour argenté de chaque calque (visible quand on décortique)
const layerEdges = {};
for (const k in layers) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(FW, FH)), edgeMat(0xe9edf7, 0.55));
  layers[k].add(e);
  layerEdges[k] = e;
}
// Étiquettes de calque (« Plan », « Roto », « Motion »)
const layerTags = {};
[['bg', 'PLAN · V1'], ['person', 'ROTO · ALPHA'], ['title', 'MOTION · TITRE']].forEach(([k, s]) => {
  const p = textPlane([[s, '500 30px "IBM Plex Mono", monospace', 32, 'rgba(212,185,140,.95)']], 1.6, 0.2, 512, 64);
  p.position.set({ bg: -1.2, person: 0, title: 1.2 }[k], FH / 2 + 0.16, 0);
  layers[k].add(p); layerTags[k] = p;
});

// Recadrage (zoom) : rectangle de cadre qui se resserre
const cropBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(FW, FH)), edgeMat(GOLD, 0.9));
cropBox.position.z = 0.02; frame.add(cropBox);

// Spline de roto : contour + points
const rotoGeo = new THREE.BufferGeometry();
rotoGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(13 * 3), 3));
const roto = new THREE.Group();
const rotoLine = new THREE.Line(rotoGeo, edgeMat(GOLD, 0.95));
const rotoPts = new THREE.Points(rotoGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 1 }));
roto.add(rotoLine, rotoPts);
roto.position.z = 0.01;
layers.person.add(roto);

// Point de tracking accroché à la tête
const tracker = new THREE.Group();
const tq = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.26, 0.26)), edgeMat(0x9fe6ff, 0.9));
const tc1 = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.2, 0, 0), new THREE.Vector3(0.2, 0, 0), new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, 0.2, 0)]), edgeMat(0x9fe6ff, 0.6));
tracker.add(tq, tc1);
tracker.position.z = 0.02;
layers.title.add(tracker);
// Trajectoire pointillée du mouvement
const pathPts = [];
for (let i = 0; i <= 80; i++) pathPts.push(new THREE.Vector3(-1.6 + i * 0.04, -0.62 + Math.sin(i * 0.15) * 0.04, 0.02));
const motionPath = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pathPts), new THREE.LineDashedMaterial({ color: 0x9fe6ff, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.7 }));
motionPath.computeLineDistances();
layers.title.add(motionPath);

// ---------- Timeline DaVinci (page Edit) ----------
const tl = new THREE.Group();
root.add(tl);
const TW = 8.4;
const tlBase = boxMesh(TW, 2.3, 0.06, 0x14151c, 0.85, 0x9aa3c0, 0.35);
tl.add(tlBase);
const tracks = {};
[['V2', 0.62], ['V1', 0.05], ['A1', -0.6]].forEach(([n, y], i) => {
  const g = new THREE.Group(); g.position.set(0, y, 0.06 + (2 - i) * 0.02); tl.add(g); tracks[n] = g;
  const lane = boxMesh(TW - 1.0, 0.46, 0.02, 0x1e2030, 0.6, 0x9aa3c0, 0.18); lane.position.x = 0.4; g.add(lane);
  const tag = textPlane([[n, '600 40px Inter, sans-serif', 32, 'rgba(230,233,245,.75)']], 0.5, 0.2, 128, 64);
  tag.position.set(-TW / 2 + 0.38, 0, 0.02); g.add(tag);
});
// Graduations et timecode
const ruler = new THREE.Group(); ruler.position.set(0.4, 1.0, 0.08); tl.add(ruler);
for (let i = 0; i <= 28; i++) {
  const tick = boxMesh(0.012, i % 4 ? 0.06 : 0.14, 0.01, 0xcfd6ee, 0.6, 0xcfd6ee, 0); tick.position.x = -3.7 + i * (7.4 / 28); ruler.add(tick);
}
// Clips vidéo : le clip principal est en deux morceaux collés, séparés par le cut.
const CLIP = 0x3d63c9, CLIP_B = 0xb4458f, AUD = 0x2f9a78;
function clip(w, color, name) {
  const g = new THREE.Group();
  const b = boxMesh(w, 0.4, 0.12, color, 0.75, 0xffffff, 0.5); g.add(b);
  const t = textPlane([[name, '500 34px Inter, sans-serif', 32, 'rgba(255,255,255,.95)']], Math.min(w, 1.6), 0.2, 320, 64);
  t.position.set(-w / 2 + Math.min(w, 1.6) / 2 + 0.06, 0.06, 0.07); g.add(t);
  return g;
}
const clipA = clip(2.6, CLIP, 'RUSH_A.mov'); tracks.V1.add(clipA);
const clipMid = clip(1.6, CLIP, 'RUSH_A.mov'); tracks.V1.add(clipMid);
const clipC = clip(2.4, CLIP, 'RUSH_A.mov'); tracks.V1.add(clipC);
const clipB = clip(1.6, CLIP_B, 'PLAN_B.mov'); tracks.V1.add(clipB);
const audio = new THREE.Group(); tracks.A1.add(audio);
for (let i = 0; i < 90; i++) {
  const hgt = 0.06 + Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)) * 0.3;
  const w = boxMesh(0.04, hgt, 0.04, AUD, 0.9, AUD, 0); w.position.x = -3.1 + i * 0.075; audio.add(w);
}
const blade = boxMesh(0.02, 1.9, 0.02, 0xff5a6a, 1, 0xff5a6a, 0.9); blade.position.z = 0.2; tl.add(blade);
const playhead = boxMesh(0.025, 2.1, 0.02, 0xf2f2f2, 1, 0xffffff, 0.6); playhead.position.z = 0.22; tl.add(playhead);
const tlTitle = textPlane([['DaVinci Resolve · Edit', '500 30px "IBM Plex Mono", monospace', 32, 'rgba(212,185,140,.95)']], 2.6, 0.2, 640, 64);
tlTitle.position.set(-TW / 2 + 1.5, 1.32, 0.05); tl.add(tlTitle);

// ---------- Page Color de DaVinci ----------
const color = new THREE.Group();
root.add(color);
function wheelTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createConicGradient(0, 128, 128);
  ['#ff4d4d', '#ffd24d', '#7dff4d', '#4dffd2', '#4d7dff', '#d24dff', '#ff4d4d'].forEach((col, i) => g.addColorStop(i / 6, col));
  x.fillStyle = g; x.beginPath(); x.arc(128, 128, 124, 0, 7); x.fill();
  const r = x.createRadialGradient(128, 128, 0, 128, 128, 124); r.addColorStop(0, 'rgba(30,30,36,1)'); r.addColorStop(1, 'rgba(30,30,36,.15)');
  x.fillStyle = r; x.beginPath(); x.arc(128, 128, 124, 0, 7); x.fill();
  return new THREE.CanvasTexture(c);
}
const wt = wheelTex();
const wheels = [];
[['Lift', -1.05], ['Gamma', 0], ['Gain', 1.05]].forEach(([n, x], i) => {
  const g = new THREE.Group(); g.position.set(x, 0, 0);
  const d = new THREE.Mesh(new THREE.CircleGeometry(0.42, 64), new THREE.MeshBasicMaterial({ map: wt, transparent: true, opacity: 0.95, depthWrite: false }));
  g.add(d);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.47, 64), new THREE.MeshBasicMaterial({ color: 0xcfd6ee, transparent: true, opacity: 0.7, depthWrite: false }));
  g.add(ring);
  const puck = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false }));
  puck.position.z = 0.01; g.add(puck);
  const t = textPlane([[n, '500 34px Inter, sans-serif', 32, 'rgba(230,233,245,.85)', 'center']], 0.8, 0.2, 256, 64);
  t.position.y = -0.62; g.add(t);
  color.add(g); wheels.push({ g, puck, dir: [[-0.6, 0.5], [0.15, 0.1], [0.55, 0.35]][i] });
});
// Nœuds de correction
const nodes = new THREE.Group(); nodes.position.set(0, -1.45, 0); color.add(nodes);
['01 Base', '02 Look', '03 Peau'].forEach((n, i) => {
  const b = boxMesh(0.82, 0.42, 0.08, 0x1f2130, 0.85, i === 1 ? GOLD : 0xcfd6ee, 0.7);
  b.position.x = -1.1 + i * 1.1;
  const t = textPlane([[n, '500 30px Inter, sans-serif', 32, 'rgba(240,240,245,.9)', 'center']], 0.78, 0.2, 256, 64); t.position.z = 0.05; b.add(t);
  nodes.add(b);
});
const nodeLink = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.69, 0, 0.04), new THREE.Vector3(-0.41, 0, 0.04), new THREE.Vector3(0.41, 0, 0.04), new THREE.Vector3(0.69, 0, 0.04)]), edgeMat(GOLD, 0.9));
nodes.add(nodeLink);
const colorTitle = textPlane([['DaVinci Resolve · Color', '500 30px "IBM Plex Mono", monospace', 32, 'rgba(212,185,140,.95)']], 2.6, 0.2, 640, 64);
colorTitle.position.set(0, 0.95, 0); color.add(colorTitle);

// Volet avant / après
const wipeLine = boxMesh(0.015, FH, 0.01, 0xffffff, 0.9, 0xffffff, 0.8); wipeLine.position.z = 0.05; frame.add(wipeLine);

// Poussière lumineuse
const dust = new THREE.BufferGeometry();
const dp = new Float32Array(220 * 3);
for (let i = 0; i < dp.length; i++) dp[i] = (Math.random() - 0.5) * (i % 3 === 2 ? 8 : 16);
dust.setAttribute('position', new THREE.BufferAttribute(dp, 3));
const dustPts = new THREE.Points(dust, new THREE.PointsMaterial({ color: 0xcfd6ee, size: 0.025, transparent: true, opacity: 0.45 }));
scene.add(dustPts);

// ---------- Étiquettes ----------
const anchors = {
  blade: blade, crop: cropBox, replace: clipB, roto: roto, title: tracker, wheels: wheels[1].g, nodes: nodes
};
const labelDefs = {
  blade: ['Cut', 'LAME · B'], crop: ['Zoom', 'RECADRAGE 125 %'], replace: ['Remplacement', 'PLAN B'],
  roto: ['Rotoscopie', 'SPLINE · 12 POINTS'], title: ['Tracking', 'POINT SUR LA TÊTE'],
  wheels: ['Roues colorimétriques', 'LIFT · GAMMA · GAIN'], nodes: ['Nœuds', 'BASE → LOOK → PEAU']
};
const labelEls = {};
let labelN = 0;
for (const k in labelDefs) {
  const el = document.createElement('div');
  el.className = 'cam-label';
  el.innerHTML = `<span class="cam-label-t">${labelDefs[k][0]}</span><span class="cam-label-s">${labelDefs[k][1]}</span>`;
  labelsBox.appendChild(el);
  const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  lines.appendChild(ln);
  labelEls[k] = { el, ln, up: labelN++ % 2 === 0 };
}

// ---------- Scroll ----------
const N = panels.length; // 8 étapes : progress va de 0 à 7
let progress = 0, smooth = 0, mx = 0, my = 0, sx = 0, sy = 0;
function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress = max > 0 ? (window.scrollY / max) * (N - 1) : 0;
}
window.addEventListener('scroll', readScroll, { passive: true });
window.addEventListener('mousemove', (e) => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; }, { passive: true });
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  cam.aspect = w / h;
  cam.fov = mobile() ? 50 : 32;
  cam.updateProjectionMatrix();
  lines.setAttribute('viewBox', `0 0 ${w} ${h}`);
  readScroll();
}
window.addEventListener('resize', resize);
resize();

// Côté du texte pour chaque étape (le décor se décale de l'autre côté sur ordinateur)
const sides = ['left', 'right', 'left', 'right', 'left', 'right', 'left', 'center'];
const sideX = (s) => (mobile() ? 0 : s === 'left' ? 1.9 : s === 'right' ? -1.9 : 0);

const tmp = new THREE.Vector3();
const clock = new THREE.Clock();
let lastPaint = -1;
function frameLoop() {
  const t = still ? 2 : clock.getElapsedTime();
  smooth += (progress - smooth) * (still ? 1 : 0.08);
  sx += (mx - sx) * 0.05; sy += (my - sy) * 0.05;
  const p = smooth;

  // Les phases
  const land = ramp(p, 0.2, 1.0);       // le rush descend dans la timeline
  const cut = ramp(p, 1.2, 1.9);        // coup de lame
  const zoom = ramp(p, 1.5, 2.0);       // recadrage
  const rep = ramp(p, 2.2, 3.0);        // remplacement par le plan B
  const vfx = ramp(p, 3.2, 4.0);        // calques décortiqués, roto
  const mot = ramp(p, 4.2, 5.0);        // motion design
  const col = ramp(p, 5.2, 6.0);        // page Color
  const fin = ramp(p, 6.2, 7.0);        // rendu final

  // Peinture des calques (limitée à ~30 images/s)
  if (t - lastPaint > 0.033 || still) {
    lastPaint = t;
    drawBg(t, rep);
    var outline = drawPerson(t);
    drawTitle(t, mot);
  }

  // Placement général (côté du texte)
  const si = Math.min(N - 2, Math.floor(p)), sf = ease(clamp(p - si));
  root.position.x = lerp(sideX(sides[si]), sideX(sides[si + 1]), sf);
  root.position.y = mobile() ? 1.25 : 0;
  root.scale.setScalar(mobile() ? 0.62 : 1);
  root.rotation.y = sx * 0.18 + (still ? 0 : Math.sin(t * 0.3) * 0.03);
  root.rotation.x = sy * 0.1;

  // Le cadre vidéo : grand au début, viewer au-dessus de la timeline, puis décortiqué
  const inEdit = land * (1 - vfx);
  frame.position.y = lerp(0, 1.25, inEdit) + lerp(0, 0.35, col * (1 - fin)) + (mobile() ? 0 : fin * 0.75);
  frame.position.x = lerp(0, -1.35, col * (1 - fin));
  frame.scale.setScalar(lerp(1.15, 0.78, inEdit) * lerp(1, 0.85, col * (1 - fin)) * lerp(1, mobile() ? 1.18 : 1.02, fin));
  frame.rotation.y = lerp(-0.25, 0, land) + lerp(0, 0.75, vfx * (1 - col)) + lerp(0, 0.12, col * (1 - fin));
  frame.rotation.x = lerp(0.08, 0, land) + lerp(0, 0.12, vfx * (1 - col));
  const spread = vfx * (1 - col);
  layers.bg.position.z = -spread * 0.9;
  layers.person.position.z = spread * 0.15;
  layers.title.position.z = spread * 1.2;
  for (const k in layerEdges) layerEdges[k].material.opacity = 0.2 + spread * 0.5;
  for (const k in layerTags) fade(layerTags[k], spread * (k === 'title' ? mot : 1));

  // Zoom (recadrage) appliqué à l'image ; le rectangle doré montre la zone gardée pendant l'opération
  const z = 1 + zoom * 0.25;
  layers.bg.material.uniforms.uZoom.value = z;
  layers.person.material.uniforms.uZoom.value = z;
  cropBox.scale.setScalar(lerp(1, 0.8, ramp(p, 1.45, 1.75)) * (1 + ramp(p, 1.75, 2.0) * 0.25));
  fade(cropBox, ramp(p, 1.4, 1.6) * (1 - ramp(p, 2.0, 2.3)));

  // Roto : spline autour du personnage
  if (outline) {
    const a = rotoGeo.attributes.position;
    outline.concat([outline[0]]).forEach(([cx, cy], i) => {
      a.setXYZ(i, (cx / CW - 0.5) * FW * z, (0.5 - cy / CH) * FH * z, 0);
    });
    a.needsUpdate = true;
    const head = outline[0];
    tracker.position.x = (head[0] / CW - 0.5) * FW * z;
    tracker.position.y = (0.5 - (head[1] + 12) / CH) * FH * z;
  }
  fade(roto, vfx * (1 - col));
  fade(tracker, mot * (1 - col));
  fade(motionPath, mot * (1 - col));

  // Étalonnage : volet de gauche à droite, puis tout l'image étalonnée
  for (const k in layers) {
    layers[k].material.uniforms.uGrade.value = col;
    layers[k].material.uniforms.uWipe.value = lerp(0, 1, ramp(p, 5.4, 6.4));
  }
  wipeLine.position.x = (lerp(0, 1, ramp(p, 5.4, 6.4)) - 0.5) * FW;
  fade(wipeLine, col * (1 - ramp(p, 6.2, 6.5)));

  // Timeline
  fade(tl, land * (1 - vfx));
  tl.scale.setScalar(0.8);
  tl.position.y = lerp(-3.4, -1.05, land) - vfx * 1.2;
  tl.rotation.x = lerp(-0.5, -0.32, land);
  // Les pistes se décollent légèrement en profondeur (vue éclatée)
  tracks.V2.position.z = 0.1 + land * 0.5;
  tracks.V1.position.z = 0.08 + land * 0.28;
  tracks.A1.position.z = 0.06;
  // Le rush tombe dans V1, puis le cut ouvre un trou, puis le plan B le remplace
  const drop = (1 - land) * 2.4;
  const gap = cut * 0.22;
  clipA.position.set(-1.6 - gap, drop, 0);
  clipMid.position.set(0.5, drop + rep * 1.2, rep * 0.6);
  clipC.position.set(2.5 + gap, drop, 0);
  fade(clipMid, land * (1 - rep));
  clipB.position.set(0.5, lerp(1.25, 0, rep), lerp(0.6, 0, rep));
  fade(clipB, rep * land * (1 - vfx));
  blade.position.set(-0.3, 0, 0.3);
  fade(blade, ramp(p, 1.1, 1.3) * (1 - ramp(p, 2.0, 2.3)) * (1 - vfx));
  playhead.position.x = -3.3 + ((t * 0.5) % 7.4);
  audio.position.z = 0;

  // Page Color
  fade(color, col * (1 - fin));
  color.position.set(lerp(3.2, 2.1, col), -0.05, 0);
  color.rotation.y = lerp(-0.6, -0.15, col);
  wheels.forEach((w) => w.puck.position.set(w.dir[0] * 0.3 * col, w.dir[1] * 0.3 * col, 0.01));

  dustPts.rotation.y = t * 0.01;
  renderer.render(scene, cam);

  // Étiquettes visibles par phase
  const W = window.innerWidth, H = window.innerHeight;
  const show = {
    blade: ramp(p, 1.2, 1.5) * (1 - ramp(p, 1.8, 2.1)),
    crop: ramp(p, 1.6, 1.85) * (1 - ramp(p, 2.1, 2.3)),
    replace: ramp(p, 2.6, 2.9) * (1 - ramp(p, 3.2, 3.5)),
    roto: ramp(p, 3.6, 3.9) * (1 - ramp(p, 4.3, 4.6)),
    title: ramp(p, 4.6, 4.9) * (1 - ramp(p, 5.2, 5.5)),
    wheels: ramp(p, 5.6, 5.9) * (1 - ramp(p, 6.2, 6.5)),
    nodes: ramp(p, 5.6, 5.9) * (1 - ramp(p, 6.2, 6.5))
  };
  for (const k in labelEls) {
    const a = show[k];
    const { el, ln, up } = labelEls[k];
    if (a <= 0.01) { el.style.opacity = 0; ln.style.opacity = 0; continue; }
    anchors[k].getWorldPosition(tmp).project(cam);
    const px = (tmp.x * 0.5 + 0.5) * W, py = (-tmp.y * 0.5 + 0.5) * H;
    let side = px > W / 2;
    const ew = el.offsetWidth || 120;
    if (side && px + 60 + ew > W - 16) side = false;
    else if (!side && px - 60 - ew < 16) side = true;
    const lx = px + (side ? 60 : -60), ly = Math.min(H - 40, Math.max(90, py + (up ? -48 : 48)));
    el.style.opacity = a; ln.style.opacity = a * 0.7;
    el.style.transform = `translate(${side ? lx : lx - el.offsetWidth}px, ${ly - el.offsetHeight / 2}px)`;
    el.classList.toggle('is-left', !side);
    ln.setAttribute('x1', px); ln.setAttribute('y1', py); ln.setAttribute('x2', lx); ln.setAttribute('y2', ly);
  }

  // Textes des étapes
  panels.forEach((el, k) => {
    const d = p - k;
    const a = Math.max(0, 1 - Math.abs(d) * 2.4);
    el.style.opacity = a.toFixed(3);
    el.style.transform = `translateY(${(-d * 40).toFixed(1)}px)`;
    el.style.visibility = a > 0.01 ? 'visible' : 'hidden';
  });
  if (hint) hint.style.opacity = Math.max(0, 1 - p * 3).toFixed(2);
  if (bar) bar.style.transform = `scaleX(${(p / (N - 1)).toFixed(4)})`;

  requestAnimationFrame(frameLoop);
}
requestAnimationFrame(frameLoop);

document.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', (e) => {
  e.preventDefault();
  const max = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo({ top: max / (N - 1), behavior: still ? 'auto' : 'smooth' });
}));
