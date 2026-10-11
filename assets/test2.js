// Page test 2 : le parcours d'une vidéo, décortiqué au scroll.
// Rush brut → timeline DaVinci (cut, zoom, remplacement) → After Effects (roto, motion design) → page Color de DaVinci.
// Les images viennent du court métrage « Ration sous contrôle » : vidéos LOG et FINAL synchronisées, vignettes des plans et image détourée.
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


// ---------- Les sources : vidéos LOG / FINAL et images fixes ----------
const FW = 4, FH = 2.25;
const BASE = 'assets/ration/';
// MP4 (H.264) partout où c'est lu, sinon WebM (VP9).
const EXT = document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"') ? '.mp4' : '.webm';
function video(name) {
  const v = document.createElement('video');
  v.src = BASE + name + EXT; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.preload = 'auto';
  v.play().catch(() => {});
  const t = new THREE.VideoTexture(v);
  return { v, t };
}
const vLog = video('log');
const vFinal = video('final');
// Sur iPhone, la lecture peut attendre un premier toucher.
const kick = () => { vLog.v.play().catch(() => {}); vFinal.v.play().catch(() => {}); };
window.addEventListener('touchstart', kick, { once: true, passive: true });
window.addEventListener('click', kick, { once: true });

const loader = new THREE.TextureLoader();
const img = (n, srgb) => { const t = loader.load(BASE + n); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
const tex = {
  bLog: img('mechant-log.jpg'), bFinal: img('mechant-final.jpg'),
  rLog: img('roto-log.jpg'), rFinal: img('roto-final.jpg')
};

// Calque principal : mélange vidéo / plan B / image de roto, et volet LOG → FINAL.
const bgMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: {
    tLog: { value: vLog.t }, tFinal: { value: vFinal.t }, tBLog: { value: tex.bLog }, tBFinal: { value: tex.bFinal },
    tRLog: { value: tex.rLog }, tRFinal: { value: tex.rFinal },
    uB: { value: 0 }, uR: { value: 0 }, uDim: { value: 1 }, uWipe: { value: 0 }, uZoom: { value: 1 }, uOpacity: { value: 1 }
  },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `
    uniform sampler2D tLog,tFinal,tBLog,tBFinal,tRLog,tRFinal;uniform float uB,uR,uWipe,uZoom,uOpacity,uDim;varying vec2 vUv;
    void main(){
      vec2 uv=(vUv-.5)/uZoom+.5;
      vec3 lg=mix(mix(texture2D(tLog,uv).rgb,texture2D(tBLog,uv).rgb,uB),texture2D(tRLog,uv).rgb,uR);
      vec3 fn=mix(mix(texture2D(tFinal,uv).rgb,texture2D(tBFinal,uv).rgb,uB),texture2D(tRFinal,uv).rgb,uR);
      vec2 q=abs((vUv-.5)*vec2(4.,2.25))-vec2(2.,1.125)+.1;float dd=length(max(q,0.))+min(max(q.x,q.y),0.)-.1;
      gl_FragColor=vec4(mix(lg,fn,step(vUv.x,uWipe))*uDim,uOpacity*(1.-smoothstep(-.006,.006,dd)));
    }`
});
// Calques transparents (personnage détouré, titre) : texture simple avec zoom.
function layerMat(t, zoomable) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { map: { value: t }, uZoom: { value: 1 }, uOpacity: { value: 1 }, uZoomable: { value: zoomable ? 1 : 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform sampler2D map;uniform float uZoom,uOpacity,uZoomable;varying vec2 vUv;void main(){vec2 uv=mix(vUv,(vUv-.5)/uZoom+.5,uZoomable);vec4 c=texture2D(map,uv);gl_FragColor=vec4(c.rgb,c.a*uOpacity);}'
  });
}

// Contour de roto tracé à la main sur l'image (coordonnées sur 960 × 540).
const ROTO = [[480, 90], [530, 100], [565, 135], [585, 200], [595, 280], [615, 330], [680, 360], [750, 390], [785, 440], [800, 540],
  [270, 540], [268, 475], [295, 440], [285, 380], [298, 326], [330, 345], [350, 372], [372, 330], [378, 250], [385, 170], [410, 118], [445, 96]];
const RW = 960, RH = 540;
// Le personnage détouré : l'image coupée par le contour, sur un calque transparent.
const cut = document.createElement('canvas'); cut.width = RW; cut.height = RH;
const cutTex = new THREE.CanvasTexture(cut);
const rotoImg = new Image();
rotoImg.onload = () => {
  const x = cut.getContext('2d');
  x.beginPath(); ROTO.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath();
  x.save(); x.clip(); x.drawImage(rotoImg, 0, 0, RW, RH); x.restore();
  cutTex.needsUpdate = true;
};
rotoImg.src = BASE + 'roto-log.jpg';

// Titre animé (motion design)
const tc = document.createElement('canvas'); tc.width = 960; tc.height = 540;
const tctx = tc.getContext('2d');
const titleTex = new THREE.CanvasTexture(tc);
function drawTitle(t, m) {
  tctx.clearRect(0, 0, 960, 540);
  if (m > 0) {
    const slide = (1 - m) * -220;
    tctx.save(); tctx.translate(slide, 0);
    tctx.fillStyle = 'rgba(212,185,140,.95)'; tctx.fillRect(60, 380, 8 + m * 200, 4);
    tctx.font = '700 54px Inter, system-ui, sans-serif'; tctx.fillStyle = `rgba(245,245,247,${m})`; tctx.fillText('RATION SOUS', 60, 440);
    tctx.fillText('CONTRÔLE', 60, 496);
    tctx.font = '500 18px "IBM Plex Mono", monospace'; tctx.fillStyle = `rgba(212,185,140,${m})`; tctx.fillText('COURT MÉTRAGE · EICAR 2026', 64, 366);
    tctx.restore();
    tctx.strokeStyle = `rgba(245,245,247,${0.6 * m})`; tctx.lineWidth = 3;
    tctx.beginPath(); tctx.arc(860, 90, 36 + Math.sin(t * 2) * 5, t, t + 4.4); tctx.stroke();
    tctx.strokeStyle = `rgba(212,185,140,${0.85 * m})`;
    tctx.beginPath(); tctx.arc(860, 90, 20, -t * 1.5, -t * 1.5 + 3.5); tctx.stroke();
  }
  titleTex.needsUpdate = true;
}

// Contour à coins arrondis (rayon 0,1), comme le masque de l'image.
function roundEdge(color, opacity) {
  const r = 0.1, w = FW / 2, h = FH / 2, sh = new THREE.Shape();
  sh.moveTo(-w + r, -h); sh.lineTo(w - r, -h); sh.quadraticCurveTo(w, -h, w, -h + r); sh.lineTo(w, h - r); sh.quadraticCurveTo(w, h, w - r, h);
  sh.lineTo(-w + r, h); sh.quadraticCurveTo(-w, h, -w, h - r); sh.lineTo(-w, -h + r); sh.quadraticCurveTo(-w, -h, -w + r, -h);
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(sh.getPoints(8)), edgeMat(color, opacity));
}

// ---------- Le cadre vidéo ----------
const frame = new THREE.Group();
root.add(frame);
const layers = {
  bg: new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), bgMat),
  person: new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), layerMat(cutTex, true)),
  title: new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), layerMat(titleTex, false))
};
['bg', 'person', 'title'].forEach((k, i) => { layers[k].renderOrder = i + 1; frame.add(layers[k]); });
const layerEdges = {};
for (const k in layers) {
  const e = roundEdge(0xe9edf7, 0.55);
  layers[k].add(e);
  layerEdges[k] = e;
}
const layerTags = {};
[['bg', 'PLAN · V1'], ['person', 'ROTO · ALPHA'], ['title', 'MOTION · TITRE']].forEach(([k, s]) => {
  const p = textPlane([[s, '500 30px "IBM Plex Mono", monospace', 32, 'rgba(212,185,140,.95)']], 1.6, 0.2, 512, 64);
  p.position.set({ bg: -1.2, person: 0, title: 1.2 }[k], FH / 2 + 0.16, 0);
  layers[k].add(p); layerTags[k] = p;
});

// Recadrage (zoom)
const cropBox = roundEdge(GOLD, 0.9);
cropBox.position.z = 0.02; frame.add(cropBox);

// Spline de roto : contour + points (fixes, tracés sur l'image)
const rotoPts3 = ROTO.concat([ROTO[0]]).map(([a, b]) => new THREE.Vector3((a / RW - 0.5) * FW, (0.5 - b / RH) * FH, 0));
const rotoGeo = new THREE.BufferGeometry().setFromPoints(rotoPts3);
const roto = new THREE.Group();
roto.add(new THREE.Line(rotoGeo, edgeMat(GOLD, 0.95)));
roto.add(new THREE.Points(rotoGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 1 })));
roto.position.z = 0.01;
layers.person.add(roto);

// Point de tracking sur le visage
const tracker = new THREE.Group();
tracker.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.3, 0.3)), edgeMat(0x9fe6ff, 0.9)));
tracker.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.22, 0, 0), new THREE.Vector3(0.22, 0, 0), new THREE.Vector3(0, -0.22, 0), new THREE.Vector3(0, 0.22, 0)]), edgeMat(0x9fe6ff, 0.6)));
tracker.position.set((480 / RW - 0.5) * FW, (0.5 - 235 / RH) * FH, 0.02);
layers.title.add(tracker);
const pathPts = [];
for (let i = 0; i <= 60; i++) pathPts.push(new THREE.Vector3(-1.75 + i * 0.03, -0.55 + Math.sin(i * 0.2) * 0.04, 0.02));
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
const ruler = new THREE.Group(); ruler.position.set(0.4, 1.0, 0.08); tl.add(ruler);
for (let i = 0; i <= 28; i++) {
  const tick = boxMesh(0.012, i % 4 ? 0.06 : 0.14, 0.01, 0xcfd6ee, 0.6, 0xcfd6ee, 0); tick.position.x = -3.7 + i * (7.4 / 28); ruler.add(tick);
}
// Les vrais plans du film, à leur durée réelle (en secondes), avec leur vignette répétée comme dans DaVinci.
const DUR = 37.3, TL0 = -3.3, TLW = 7.4;
const SHOTS = [[0, 1.88, 'thumb0.jpg', 'FRAISES'], [1.88, 4.12, 'thumb1.jpg', 'HOMME'], [4.12, 6.16, 'thumb2.jpg', 'COULOIR'],
  [6.16, 19.24, 'thumb3.jpg', 'FILLE'], [19.24, 21.8, 'thumb4.jpg', 'PORTE'], [21.8, 23.16, 'thumb5.jpg', 'GLITCH'], [23.16, 37.3, 'thumb6.jpg', 'ÉCRANS']];
const tX = (s) => TL0 + (s / DUR) * TLW;
const CLIP = 0x3d63c9, CLIP_B = 0xb4458f, AUD = 0x2f9a78;
function clip(s0, s1, thumb, name, color = CLIP) {
  const w = tX(s1) - tX(s0) - 0.02;
  const g = new THREE.Group();
  g.add(boxMesh(w, 0.4, 0.1, color, 0.85, 0xffffff, 0.45));
  const t = img(thumb, true); t.wrapS = THREE.RepeatWrapping; t.repeat.x = Math.max(1, w / 0.5);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, 0.26), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.95, depthWrite: false }));
  strip.position.set(0, -0.04, 0.06); g.add(strip);
  if (w > 0.45) {
    const lbl = textPlane([[name, '600 30px Inter, sans-serif', 32, 'rgba(255,255,255,.95)']], 0.9, 0.12, 320, 64);
    lbl.position.set(-w / 2 + 0.5, 0.135, 0.06); g.add(lbl);
  }
  g.userData.x = (tX(s0) + tX(s1)) / 2;
  g.position.x = g.userData.x;
  return g;
}
// Le long plan « FILLE » est coupé en trois : le milieu sera remplacé par le plan B.
const clips = [];
SHOTS.forEach(([a, b, th, n], i) => {
  if (i === 3) {
    clips.push({ c: clip(a, 10.5, th, n), side: -1 });
    clips.push({ c: clip(10.5, 14.5, th, n), mid: true });
    clips.push({ c: clip(14.5, b, th, n), side: 1 });
  } else clips.push({ c: clip(a, b, th, n), side: i < 3 ? -1 : 1 });
});
clips.forEach((k) => tracks.V1.add(k.c));
const clipMid = clips.find((k) => k.mid).c;
const clipB = clip(10.5, 14.5, 'mechant-log.jpg', 'PLAN B', CLIP_B);
tracks.V1.add(clipB);
const audio = new THREE.Group(); tracks.A1.add(audio);
for (let i = 0; i < 90; i++) {
  const hgt = 0.06 + Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)) * 0.3;
  const w = boxMesh(0.04, hgt, 0.04, AUD, 0.9, AUD, 0); w.position.x = -3.25 + i * 0.082; audio.add(w);
}
const blade = boxMesh(0.02, 1.9, 0.02, 0xff5a6a, 1, 0xff5a6a, 0.9); blade.position.set(tX(10.5), 0, 0.3); tl.add(blade);
const playhead = boxMesh(0.025, 2.1, 0.02, 0xf2f2f2, 1, 0xffffff, 0.6); playhead.position.z = 0.22; tl.add(playhead);
const tlTitle = textPlane([['DaVinci Resolve · Edit · Ration sous contrôle', '500 30px "IBM Plex Mono", monospace', 32, 'rgba(212,185,140,.95)']], 4.4, 0.2, 1100, 64);
tlTitle.position.set(-TW / 2 + 2.4, 1.32, 0.05); tl.add(tlTitle);

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
const tagLog = textPlane([['LOG', '600 34px "IBM Plex Mono", monospace', 32, 'rgba(255,255,255,.85)', 'center']], 0.5, 0.15, 128, 64);
const tagFin = textPlane([['FINAL', '600 34px "IBM Plex Mono", monospace', 32, 'rgba(212,185,140,.95)', 'center']], 0.6, 0.15, 160, 64);
tagLog.position.set(0.3, FH / 2 - 0.14, 0.01); tagFin.position.set(-0.36, FH / 2 - 0.14, 0.01);
wipeLine.add(tagLog, tagFin);

// Poussière lumineuse
const dust = new THREE.BufferGeometry();
const dp = new Float32Array(220 * 3);
for (let i = 0; i < dp.length; i++) dp[i] = (Math.random() - 0.5) * (i % 3 === 2 ? 8 : 16);
dust.setAttribute('position', new THREE.BufferAttribute(dp, 3));
const dustPts = new THREE.Points(dust, new THREE.PointsMaterial({ color: 0xcfd6ee, size: 0.025, transparent: true, opacity: 0.45 }));
scene.add(dustPts);

// ---------- Étiquettes ----------
const anchors = { blade, crop: cropBox, replace: clipB, roto, title: tracker, wheels: wheels[1].g, nodes };
const labelDefs = {
  blade: ['Cut', 'LAME · B'], crop: ['Zoom', 'RECADRAGE 125 %'], replace: ['Remplacement', 'PLAN B'],
  roto: ['Rotoscopie', `SPLINE · ${ROTO.length} POINTS`], title: ['Tracking', 'POINT SUR LE VISAGE'],
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
const N = panels.length;
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

  const land = ramp(p, 0.2, 1.0);
  const cutF = ramp(p, 1.2, 1.9);
  const zoom = ramp(p, 1.5, 2.0);
  const rep = ramp(p, 2.2, 3.0);
  const vfx = ramp(p, 3.2, 4.0);
  const mot = ramp(p, 4.2, 5.0);
  const col = ramp(p, 5.2, 6.0);
  const fin = ramp(p, 6.2, 7.0);

  // Les deux vidéos restent calées l'une sur l'autre : petite correction de vitesse, saut seulement si l'écart est grand.
  if (vLog.v.readyState >= 2 && vFinal.v.readyState >= 2 && !vFinal.v.seeking) {
    const d = vLog.v.currentTime - vFinal.v.currentTime;
    if (Math.abs(d) > 1) vFinal.v.currentTime = vLog.v.currentTime;
    else vFinal.v.playbackRate = clamp(1 + d * 0.8, 0.8, 1.2);
  }
  // Pour l'étalonnage, on reste sur les plans de la fille (6 s à 21 s), les plus parlants en LOG / FINAL.
  if (col > 0.01 && vLog.v.readyState >= 2 && !vLog.v.seeking && (vLog.v.currentTime < 6.2 || vLog.v.currentTime > 21.5)) {
    vLog.v.currentTime = 6.3; vFinal.v.currentTime = 6.3;
  }
  if (t - lastPaint > 0.033 || still) { lastPaint = t; drawTitle(t, mot); }

  const si = Math.min(N - 2, Math.floor(p)), sf = ease(clamp(p - si));
  root.position.x = lerp(sideX(sides[si]), sideX(sides[si + 1]), sf);
  root.position.y = mobile() ? 1.25 : 0;
  root.scale.setScalar(mobile() ? 0.72 : 1);
  root.rotation.y = sx * 0.18 + (still ? 0 : Math.sin(t * 0.3) * 0.03);
  root.rotation.x = sy * 0.1;

  const inEdit = land * (1 - vfx);
  const colOn = col * (1 - fin);
  if (mobile()) {
    // Sur téléphone, l'image occupe presque toute la largeur de l'écran
    frame.position.y = 0.8 + lerp(0, 1.2, inEdit) + colOn * 0.9;
    frame.position.x = 0;
    frame.scale.setScalar(1.82 * lerp(1, 0.85, colOn) * lerp(1, 0.85, vfx * (1 - col)));
  } else {
    frame.position.y = lerp(0, 1.35, inEdit) + lerp(0, 0.35, colOn) + fin * 1.3;
    frame.position.x = lerp(0, -1.2, colOn);
    frame.scale.setScalar(1.1 * lerp(1.4, 0.9, inEdit) * lerp(1, 0.66, colOn) * lerp(1, 0.78, fin));
  }
  frame.rotation.y = lerp(-0.25, 0, land) + lerp(0, 0.75, vfx * (1 - col)) + lerp(0, 0.12, col * (1 - fin));
  frame.rotation.x = lerp(0.08, 0, land) + lerp(0, 0.12, vfx * (1 - col));
  const spread = vfx * (1 - col);
  layers.bg.position.z = -spread * 0.9;
  layers.person.position.z = spread * 0.25;
  layers.title.position.z = spread * 1.2;
  for (const k in layerEdges) layerEdges[k].material.opacity = 0.2 + spread * 0.5;
  for (const k in layerTags) fade(layerTags[k], spread * (k === 'title' ? mot : 1));
  fade(layers.person, vfx * (1 - col));
  fade(layers.title, mot * (1 - col));

  // Ce que montre l'image : vidéo, puis plan B pendant le remplacement, puis l'image détourée pour les VFX
  const showB = rep * (1 - ramp(p, 3.0, 3.4));
  bgMat.uniforms.uB.value = showB;
  bgMat.uniforms.uR.value = vfx * (1 - col);
  bgMat.uniforms.uDim.value = 1 - 0.55 * vfx * (1 - col);
  const z = 1 + zoom * 0.25 * (1 - vfx);
  bgMat.uniforms.uZoom.value = z;
  layers.person.material.uniforms.uZoom.value = 1;
  cropBox.scale.setScalar(lerp(1, 0.8, ramp(p, 1.45, 1.75)) * (1 + ramp(p, 1.75, 2.0) * 0.25));
  fade(cropBox, ramp(p, 1.4, 1.6) * (1 - ramp(p, 2.0, 2.3)));
  fade(roto, vfx * (1 - col));
  fade(tracker, mot * (1 - col));
  fade(motionPath, mot * (1 - col));

  // Étalonnage : le volet passe du LOG au FINAL
  const w = ramp(p, 5.4, 6.4);
  bgMat.uniforms.uWipe.value = w;
  wipeLine.position.x = (w - 0.5) * FW;
  fade(wipeLine, col * (1 - ramp(p, 6.3, 6.6)));

  // Timeline
  fade(tl, land * (1 - vfx));
  tl.scale.setScalar(0.8);
  tl.position.y = lerp(-3.4, -1.05, land) - vfx * 1.2;
  tl.rotation.x = lerp(-0.5, -0.32, land);
  tracks.V2.position.z = 0.1 + land * 0.5;
  tracks.V1.position.z = 0.08 + land * 0.28;
  const drop = (1 - land) * 2.4;
  const gap = cutF * 0.16;
  clips.forEach((k) => {
    if (k.mid) return;
    k.c.position.set(k.c.userData.x + (k.side || 0) * gap, drop, 0);
  });
  clipMid.position.set(clipMid.userData.x, drop + rep * 1.2, rep * 0.6);
  fade(clipMid, land * (1 - rep));
  clipB.position.set(clipB.userData.x, lerp(1.25, 0, rep), lerp(0.6, 0, rep));
  fade(clipB, rep * land * (1 - vfx));
  fade(blade, ramp(p, 1.1, 1.3) * (1 - ramp(p, 2.0, 2.3)) * (1 - vfx));
  // La tête de lecture suit vraiment la vidéo
  playhead.position.x = tX(vLog.v.currentTime || 0);

  // Page Color
  fade(color, col * (1 - fin));
  if (mobile()) color.position.set(lerp(3.2, 0, col), -1.6, 0);
  else color.position.set(lerp(3.2, 2.05, col), -0.05, 0);
  color.rotation.y = lerp(-0.6, -0.15, col);
  wheels.forEach((wh) => wh.puck.position.set(wh.dir[0] * 0.3 * col, wh.dir[1] * 0.3 * col, 0.01));

  dustPts.rotation.y = t * 0.01;
  renderer.render(scene, cam);

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
