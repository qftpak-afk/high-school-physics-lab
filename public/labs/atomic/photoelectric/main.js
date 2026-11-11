/* ปรากฏการณ์โฟโตอิเล็กทริก: สถานะ ขั้นตอน ฉากอุปกรณ์ และตาราง
   ส่วนกลาง (renderer กล้อง ป้าย แผงขั้นตอน) อยู่ใน shared/lab-core.js */
import {$, clamp, fmt, reduce, createScene, createPanel} from "../../../shared/lab-core.js";
import {SOURCES, SOURCE, HG, APERTURES, E_CHARGE, stopV, current, display, zeroV, freq, photonEV, analyze, isat, lightLevel} from "./physics.js";

const THREE = window.THREE;

/* ---------- สถานะ ---------- */
const START = () => ({step: 1, pred: {}, wires: [], pick: null, lamp: false, src: "546", ap: 4, vOut: 0, vFine: 0, zeroed: false, lit: false, iv: [], apRows: {}, vs: {}, led: false, fit: null, cam: "free", sheet: false});
let S = START();

/* แรงดันเก็บเป็นหน่วย 0.01 V เพื่อไม่ให้ทศนิยมคลาด */
const V = () => clamp(S.vOut + S.vFine, -300, 1000) / 100;
const liveSrc = () => S.lamp ? SOURCE[S.src] : SOURCE.off;
const wireKey = (a, b) => [a, b].sort().join("-");
const REQUIRED = [["sp", "a"], ["k", "pi"], ["po", "sn"]].map(([a, b]) => wireKey(a, b));
const wireKeys = () => S.wires.map(([a, b]) => wireKey(a, b));
const circuitOK = () => REQUIRED.every(k => wireKeys().includes(k)) && S.wires.length === 3;
const trueI = () => circuitOK() ? current(V(), liveSrc(), S.ap) : 0;
let zNoise = 0;
const reading = () => display(trueI(), zNoise);
const sgn = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(2);

const ivOK = () => S.iv.length >= 8 && S.iv.some(p => p.i === 0) && S.iv.some(p => p.v >= 5);
const ok = {
  1: () => PRED.every(q => S.pred[q.k]),
  2: () => circuitOK(),
  3: () => S.zeroed,
  4: () => S.lit,
  5: () => ivOK(),
  6: () => APERTURES.every(a => S.apRows[a] && S.apRows[a].i != null && S.apRows[a].vs != null),
  7: () => HG.every(s => S.vs[s.k] != null) && S.led,
  8: () => !!S.fit,
  9: () => S.step === 9
};
/* ขั้น 3 และ 4 จำว่าเคยผ่านแล้ว เพราะขั้นถัดไปต้องเปลี่ยนปุ่มเหล่านี้ */
function latch() {
  if (S.step === 3 && circuitOK() && S.lamp && S.src === "off" && reading() === 0) S.zeroed = true;
  if (S.step === 4 && S.lamp && S.src === "436" && S.ap === 4 && V() === 5 && reading() > 0) S.lit = true;
}
function changed(full) { latch(); if (full) panel.render(); else panel.live(); }

/* ---------- ฉาก ---------- */
const core = createScene({isFree: () => S.cam === "free", camPos: [4, 62, 128], look: [2, 18, 2]});
const {scene, camera, hemi, key, tw, std, box, cyl, canvasTex, aspectFit, addLabel} = core;

const tableMat = std(0xa9ada8, {roughness: .9}), wallMat = std(0xd3d6d1, {roughness: 1});
box(300, 3, 190, tableMat, 0, -1.5, 30);
box(1600, 700, 2, wallMat, 0, 300, -62);

const silver = std(0xb9bec2, {metalness: .55, roughness: .42}), black = std(0x17191c, {metalness: .3, roughness: .5});
const metal = std(0x8d959c, {metalness: .8, roughness: .3}), brass = std(0xb98a3c, {metalness: .85, roughness: .32}), knobMat = std(0x34383d, {metalness: .3, roughness: .45});

/* แผ่นหน้าปัด: วาดด้วยหน่วย cm */
function plate(w, h, draw, x, y, z, parent = scene, px = 24, bg = "#c6cacd") {
  const tex = canvasTex(Math.round(w * px), Math.round(h * px), g => { g.scale(px, px); g.fillStyle = bg; g.fillRect(0, 0, w, h); g.textBaseline = "middle"; draw(g, w, h); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({map: tex, roughness: .55})); m.position.set(x, y, z); parent.add(m); return m;
}
const text = (g, t, x, y, size, opts = {}) => { g.font = `${opts.w || 600} ${size}px Arial`; g.fillStyle = opts.c || "#15181c"; g.textAlign = opts.a || "left"; g.fillText(t, x, y); };

/* จอเลข 7 ส่วน */
const SEG = {0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc", 5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg", 9: "abcfgd", "-": "g", " ": ""};
function makeDisplay(w, h, x, y, z, cells, parent = scene) {
  const tex = canvasTex(cells * 90, 150, () => {});
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map: tex, toneMapped: false})); m.position.set(x, y, z); parent.add(m);
  let last = null;
  return function set(str) {
    if (str === last) return; last = str;
    const g = tex.image.getContext("2d"), cw = 90, H = 150; g.fillStyle = "#140507"; g.fillRect(0, 0, cw * cells, H);
    const parsed = []; for (const c of str) { if (c === ".") parsed[parsed.length - 1].dot = true; else parsed.push({c, dot: false}); }
    while (parsed.length < cells) parsed.unshift({c: " ", dot: false});
    parsed.forEach((p, i) => {
      const x0 = i * cw + 14, y0 = 20, a = 54, b = 50, t = 10;
      const rect = {a: [x0 + t, y0, a - 2 * t, t], d: [x0 + t, y0 + 2 * b, a - 2 * t, t], g: [x0 + t, y0 + b, a - 2 * t, t], f: [x0, y0 + t, t, b - t], b: [x0 + a - t, y0 + t, t, b - t], e: [x0, y0 + b + t, t, b - t], c: [x0 + a - t, y0 + b + t, t, b - t]};
      for (const s in rect) { g.fillStyle = SEG[p.c].includes(s) ? "#ff2a1c" : "#3a0d10"; g.fillRect(...rect[s]); }
      g.fillStyle = p.dot ? "#ff2a1c" : "#3a0d10"; g.fillRect(x0 + a + 8, y0 + 2 * b, t, t);
    });
    tex.needsUpdate = true;
  };
}

/* ราง */
[-6, 6].forEach(z => { const r = cyl(.7, 112, metal, -4, 3, z); r.rotation.z = Math.PI / 2; });

/* ---------- Hg Lamp (Filter) ---------- */
const LX = -42;
box(26, 16, 18, silver, LX, 8, 0);
const SRC_ROWS = SOURCES.filter(s => s.k !== "off");
plate(26, 16, (g, w) => {
  text(g, "Hg Lamp (Filter)", w / 2, 1.5, 1.5, {a: "center"});
  SRC_ROWS.forEach((s, i) => text(g, s.k === "led" ? "LED 650 nm" : s.label, 14.8, 3.3 + i * 1.95, 1.05, {w: 500}));
  text(g, "ปิดแสง", 6, 3.4, .95, {a: "center", w: 500});
}, LX, 8, 9.02);
const ledMeshes = {};
SRC_ROWS.forEach((s, i) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, .95, .3), new THREE.MeshStandardMaterial({color: 0x241a1a, emissive: s.color, emissiveIntensity: 0})); m.position.set(LX - 13 + 13.2, 16 - 3.3 - i * 1.95, 9.12); scene.add(m); ledMeshes[s.k] = m;
});
const dial = new THREE.Group(); dial.position.set(LX - 7, 8.6, 9.1); scene.add(dial);
const dialK = cyl(2.5, 2, knobMat, 0, 0, 1); dial.add(dialK); dialK.rotation.x = Math.PI / 2;
box(.5, 2, .5, std(0xe8e0cf), 0, 1.3, 2.05, dial);
const switchBase = box(3, 3, .3, std(0x14171b), LX - 9.5, 2.9, 9.15);
const lampSwitch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, .7), new THREE.MeshStandardMaterial({color: 0x1d7a3a, emissive: 0x2bff6a, emissiveIntensity: 0, roughness: .35})); lampSwitch.position.set(LX - 9.5, 2.9, 9.5); scene.add(lampSwitch);
const swHit = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 2), new THREE.MeshBasicMaterial({visible: false})); swHit.position.copy(lampSwitch.position); scene.add(swHit);
cyl(5, 3, black, LX, 17.5, 0);
box(16, 14, 14, black, LX, 26, 0);
box(4.6, 11.6, 11.6, std(0x222428), LX + 8.5, 26, 0);
/* ท่อนำแสง: ช่องว่างตรงกลางให้เห็นลำแสง */
box(3.6, 9, 9, black, -31.2, 26, 0);
box(11, 9, 9, black, -21.4, 26, 0);
const glowTex = canvasTex(128, 128, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.3, "rgba(255,255,255,.4)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0})); lampGlow.scale.set(13, 13, 1); lampGlow.position.set(-29, 26, 0); scene.add(lampGlow);
const beamMat = new THREE.MeshBasicMaterial({transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false});
const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 37, 16), beamMat); beam.rotation.z = Math.PI / 2; beam.position.set(-15, 26, 0); scene.add(beam);

/* ---------- กล่อง Photoelectric Effect ---------- */
const BOX = {x0: -15, x1: 15, y0: 14, y1: 40, z0: -7, z1: 7};
const WIN = {x0: -12, x1: 12, y0: 19, y1: 34};
const bw = 30, bd = 14;
cyl(2.2, 14, black, 0, 7, 0); box(12, 1.2, 9, black, 0, .6, 0);
box(bw, 1, bd, black, 0, BOX.y0 + .5, 0); box(bw, 1, bd, black, 0, BOX.y1 - .5, 0);
box(1, 26, bd, black, BOX.x0 + .5, 27, 0); box(1, 26, bd, black, BOX.x1 - .5, 27, 0);
box(bw, 26, 1, std(0x24262a), 0, 27, BOX.z0 + .5);
box(bw, WIN.y0 - BOX.y0, 1, black, 0, (BOX.y0 + WIN.y0) / 2, 6.5);
box(bw, BOX.y1 - WIN.y1, 1, black, 0, (BOX.y1 + WIN.y1) / 2, 6.5);
box(WIN.x0 - BOX.x0, WIN.y1 - WIN.y0, 1, black, (BOX.x0 + WIN.x0) / 2, (WIN.y0 + WIN.y1) / 2, 6.5);
box(BOX.x1 - WIN.x1, WIN.y1 - WIN.y0, 1, black, (BOX.x1 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, 6.5);
const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), new THREE.MeshPhysicalMaterial({color: 0xffc98a, transparent: true, opacity: .12, roughness: .05, depthWrite: false})); winGlass.position.set(0, (WIN.y0 + WIN.y1) / 2, 7.02); winGlass.renderOrder = 3; scene.add(winGlass);
plate(22, 3.4, (g, w, h) => text(g, "Photoelectric Effect", w / 2, h / 2 + .1, 2, {a: "center", c: "#f1f2ef"}), 0, 37, 7.02, scene, 24, "#17191c");

const apGroup = new THREE.Group(); apGroup.position.set(0, BOX.y1 + 1.4, 0); scene.add(apGroup);
const apKnob = cyl(4.2, 2.8, knobMat, 0, 0, 0, apGroup);
box(.6, .3, 3.4, std(0xe8e0cf), 0, 1.5, 2, apGroup);

/* หลอดโฟโตเซลล์: แสงผ่านแอโนดรูปวงแหวนไปตกที่แคโทดด้านขวา */
const TY = 26, XA = -5.5, XC = 3;
const glass = new THREE.MeshPhysicalMaterial({color: 0xcfd9dd, transparent: true, opacity: .26, roughness: .08, depthWrite: false, side: THREE.DoubleSide});
const lens = cyl(4.2, .9, std(0xd7c28a, {metalness: .5, roughness: .25, emissive: 0xffa040, emissiveIntensity: 0}), -11, TY, 0); lens.rotation.z = Math.PI / 2;
const shell = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 13, 32, 1, true), glass); shell.rotation.z = Math.PI / 2; shell.position.set(-1.5, TY, 0); shell.renderOrder = 2; scene.add(shell);
const anode = new THREE.Mesh(new THREE.TorusGeometry(3, .22, 12, 40), brass); anode.rotation.y = Math.PI / 2; anode.position.set(XA, TY, 0); scene.add(anode);
const cathodeMat = std(0xc99a4d, {metalness: .7, roughness: .3, emissive: 0xffffff, emissiveIntensity: 0});
const cathode = cyl(3.6, .5, cathodeMat, XC, TY, 0); cathode.rotation.z = Math.PI / 2;
const ring = cyl(4.9, 2.2, brass, 6, TY, 0); ring.rotation.z = Math.PI / 2;
const elbow = new THREE.Mesh(new THREE.TorusGeometry(3.4, 1.9, 16, 28, Math.PI / 2), metal); elbow.rotation.z = -Math.PI / 2; elbow.position.set(7, TY - 3.4, 0); scene.add(elbow);
cyl(1.9, 2.6, metal, 10.4, TY - 4.6, 0); cyl(3, 1.2, metal, 10.4, 15.6, 0);
const boxLight = new THREE.PointLight(0xffffff, 0, 34, 1.6); boxLight.position.set(-2, TY, 3); scene.add(boxLight);

/* ---------- Picoammeter ---------- */
const PX = -6, PZ = 16;
box(26, 11, 10, silver, PX, 5.5, PZ);
plate(26, 11, (g, w) => { g.fillStyle = "#17191c"; g.fillRect(1.2, 1.1, w - 2.4, 8.8); text(g, "Picoammeter", 2.4, 2.6, 1.5, {c: "#f1f2ef"}); text(g, "nA", w - 2.6, 6.4, 1.5, {c: "#f1f2ef", a: "right", w: 500}); }, PX, 5.5, PZ + 5.02);
const setPico = makeDisplay(15, 5, PX - 2.2, 4.3, PZ + 5.08, 5);

/* ---------- High Voltage Supply ---------- */
const SX = 44, SW = 28;
box(SW, 28, 18, silver, SX, 14, 2);
plate(SW, 28, (g, w) => {
  text(g, "High Voltage Supply", w / 2, 2.2, 1.7, {a: "center"});
  g.fillStyle = "#17191c"; g.fillRect(2.4, 4.2, w - 4.8, 8);
  text(g, "V", w - 4.2, 8.2, 2.2, {c: "#f1f2ef", a: "center"});
  text(g, "Output", 8, 14.6, 1.25, {a: "center", w: 500}); text(g, "Fine", 20, 14.6, 1.25, {a: "center", w: 500});
}, SX, 14, 11.02);
const setVolt = makeDisplay(17, 5.4, SX - 2.6, 19.8, 11.08, 5);
function knob(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  const k = cyl(2, 1.8, knobMat, 0, 0, .9); k.rotation.x = Math.PI / 2; g.add(k);
  box(.45, 1.7, .4, std(0xe8e0cf), 0, 1.05, 1.9, g);
  return {g, k};
}
const outK = knob(SX - 6, 10.6, 11.1), fineK = knob(SX + 6, 10.6, 11.1);
box(6, .9, 1.2, metal, SX - 9, 29, 2); box(6, .9, 1.2, metal, SX + 9, 29, 2);
box(.9, 5, 1.2, metal, SX - 11.5, 31, 2); box(.9, 5, 1.2, metal, SX + 11.5, 31, 2);
box(24, 1.1, 1.8, metal, SX, 33.5, 2);

/* ขั้วต่อสาย */
const TERM = {
  sp: {p: [SX + 6, 4.6, 11.4], c: 0xc8281e, name: "แหล่งจ่าย ขั้วแดง (+)", short: "+"},
  sn: {p: [SX, 4.6, 11.4], c: 0x15181c, name: "แหล่งจ่าย ขั้วดำ (−)", short: "−"},
  g: {p: [SX - 6, 4.6, 11.4], c: 0xdcae1e, name: "แหล่งจ่าย ขั้วเหลือง (ดิน)", short: "ดิน"},
  a: {p: [5, 16.6, 7.4], c: 0xc8281e, name: "ขั้ว A (แอโนด)", short: "A"},
  k: {p: [10.5, 16.6, 7.4], c: 0x15181c, name: "ขั้ว K (แคโทด)", short: "K"},
  pi: {p: [PX - 11.4, 2.4, PZ + 5.4], c: 0x15181c, name: "Picoammeter ขั้วเข้า", short: "เข้า"},
  po: {p: [PX + 11.4, 2.4, PZ + 5.4], c: 0xc8281e, name: "Picoammeter ขั้วออก", short: "ออก"}
};
const termHits = [];
for (const key in TERM) {
  const t = TERM[key], m = new THREE.Mesh(new THREE.SphereGeometry(.7, 16, 12), new THREE.MeshStandardMaterial({color: t.c, roughness: .35, emissive: 0xd9a93f, emissiveIntensity: 0}));
  m.position.set(...t.p); scene.add(m); t.mesh = m;
  const hit = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), new THREE.MeshBasicMaterial({visible: false})); hit.position.copy(m.position); hit.userData.term = key; scene.add(hit); termHits.push(hit);
}
const wireGroup = new THREE.Group(); scene.add(wireGroup);
let wireSig = null;
function syncWires() {
  const sig = wireKeys().join("|"); if (sig === wireSig) return; wireSig = sig;
  while (wireGroup.children.length) { const c = wireGroup.children.pop(); c.geometry.dispose(); c.material.dispose(); }
  S.wires.forEach(([a, b]) => {
    const A = new THREE.Vector3(...TERM[a].p), B = new THREE.Vector3(...TERM[b].p), zm = Math.max(A.z, B.z) + 9;
    const mid = new THREE.Vector3((A.x + B.x) / 2, Math.max(.6, Math.min(A.y, B.y) - 2), zm);
    const curve = new THREE.CatmullRomCurve3([A, A.clone().add(new THREE.Vector3(0, -.5, 3)), mid, B.clone().add(new THREE.Vector3(0, -.5, 3)), B]);
    const red = a === "sp" || b === "sp" || a === "po" && b === "pi";
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, .24, 8, false), std(red ? 0xc8281e : 0x15181c, {roughness: .5})); m.castShadow = true; wireGroup.add(m);
  });
}

/* อนุภาคในหลอด แสดงเฉพาะมุมมองภายในหลอด */
const MAX_E = 240, MAX_P = 90, sphere = new THREE.SphereGeometry(.17, 8, 6);
const eMesh = new THREE.InstancedMesh(sphere, new THREE.MeshBasicMaterial({color: 0x8fdcff, toneMapped: false}), MAX_E);
const pMat = new THREE.MeshBasicMaterial({color: 0xffffff, toneMapped: false});
const pMesh = new THREE.InstancedMesh(sphere, pMat, MAX_P);
eMesh.frustumCulled = pMesh.frustumCulled = false; eMesh.visible = pMesh.visible = false; scene.add(eMesh, pMesh);
const electrons = [], photons = [];
const mtx = new THREE.Matrix4();
let eAcc = 0, pAcc = 0;
function stepParticles(dt) {
  const src = liveSrc(), Vnow = V(), level = lightLevel(src, S.ap), ks = stopV(src);
  pAcc += level * 4 * dt; while (pAcc >= 1 && photons.length < MAX_P) { pAcc -= 1; const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 2.2; photons.push({x: -11, y: r * Math.cos(a), z: r * Math.sin(a)}); }
  if (pAcc >= 1) pAcc = 0;
  for (let i = photons.length - 1; i >= 0; i--) { photons[i].x += 26 * dt; if (photons[i].x >= XC) photons.splice(i, 1); }
  /* อิเล็กตรอนหลุดตามปริมาณแสง ความเร็วเริ่มต้นแปรตาม √(hf − φ) */
  eAcc += isat(src, S.ap) * 6 * dt; while (eAcc >= 1 && electrons.length < MAX_E) { eAcc -= 1; const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 2.8; electrons.push({s: 0, dir: 1, ke: ks * (.35 + .65 * Math.random()), y: r * Math.cos(a), z: r * Math.sin(a)}); }
  if (eAcc >= 1) eAcc = 0;
  for (let i = electrons.length - 1; i >= 0; i--) {
    const e = electrons[i], E = e.ke + Vnow * e.s;
    if (e.dir > 0 && E <= 0) e.dir = -1;
    e.s += e.dir * .8 * Math.sqrt(Math.max(E, .02)) * dt;
    if (e.s >= 1 || e.s <= 0) electrons.splice(i, 1);
  }
  electrons.forEach((e, i) => eMesh.setMatrixAt(i, mtx.makeTranslation(XC + (XA - XC) * e.s, TY + e.y, e.z)));
  eMesh.count = electrons.length; eMesh.instanceMatrix.needsUpdate = true;
  photons.forEach((p, i) => pMesh.setMatrixAt(i, mtx.makeTranslation(p.x, TY + p.y, p.z)));
  pMesh.count = photons.length; pMesh.instanceMatrix.needsUpdate = true;
}

/* ---------- ป้ายกำกับ ---------- */
const free = () => S.cam === "free", v3 = (...a) => new THREE.Vector3(...a);
for (const key in TERM) addLabel(TERM[key].short, () => { const [x, y, z] = TERM[key].p; return v3(x, y + 2, z); }, () => free() && S.step === 2, "math");
addLabel("ภาพจำลอง: โฟตอนและอิเล็กตรอนมองไม่เห็นจริง", () => v3(-2, 33, 2), () => S.cam === "inside", "hint");
addLabel("แอโนด", () => v3(XA, TY - 4.4, 3), () => S.cam === "inside");
addLabel("แคโทด", () => v3(XC, TY - 4.4, 3), () => S.cam === "inside");
const apLabel = addLabel("", () => v3(0, BOX.y1 + 5, 0), () => free() && S.step >= 4 && S.step <= 7, "math");
addLabel("คลิกต่อทีละขั้วในฉาก หรือกดในแผง", () => v3(16, 25, 11), () => free() && S.step === 2 && !circuitOK(), "hint");
addLabel("หมุนปุ่มนี้ไปที่ปิดแสง", () => v3(LX - 19, 8.6, 11), () => free() && S.step === 3 && S.src !== "off", "hint");
addLabel("กดเปิดเครื่อง", () => v3(LX - 17, 2.9, 11), () => free() && S.step === 3 && !S.lamp, "hint");

/* ---------- มุมกล้อง ---------- */
const VIEW = {
  wide: {p: [4, 62, 128], l: [2, 18, 2]},
  wires: {p: [14, 44, 100], l: [14, 12, 9]},
  zero: {p: [-26, 38, 80], l: [-26, 12, 8]},
  meters: {p: [18, 34, 88], l: [16, 12, 10]}
};
const STEP_VIEW = {2: "wires", 3: "zero", 5: "meters"};
function setFree(name) {
  const f = VIEW[name]; S.cam = "free";
  const l = v3(...f.l);
  core.tween(l.clone().add(aspectFit(v3(...f.p).sub(l))), l, 40);
}
function setInside() { S.cam = "inside"; core.tween(v3(-1.5, TY + 1, 30), v3(-1.5, TY, 0), 30); }
const camForStep = () => setFree(STEP_VIEW[S.step] || "wide");

/* ---------- การคลิกและลากในฉาก ---------- */
const CTRL = {3: {lamp: 1, src: 1}, 4: {lamp: 1, src: 1, ap: 1, supply: 1}, 5: {supply: 1}, 6: {ap: 1, supply: 1}, 7: {src: 1, supply: 1}};
const ray = core.ray;
function hitTarget() {
  if (S.cam !== "free") return null;
  if (S.step === 2) { const h = ray.intersectObjects(termHits)[0]; return h ? {t: "term", k: h.object.userData.term} : null; }
  const c = CTRL[S.step]; if (!c) return null;
  if (c.lamp && ray.intersectObject(swHit)[0]) return {t: "lamp"};
  if (c.src && ray.intersectObject(dialK)[0]) return {t: "dial"};
  if (c.ap && ray.intersectObject(apKnob)[0]) return {t: "ap"};
  if (c.supply && ray.intersectObject(outK.k)[0]) return {t: "out"};
  if (c.supply && ray.intersectObject(fineK.k)[0]) return {t: "fine"};
  return null;
}
core.interact({
  hitTest: hitTarget,
  onDown(h, ev) {
    if (h.t === "term") connect(h.k);
    else if (h.t === "lamp") setLamp(!S.lamp);
    else if (h.t === "dial") setSrc(SOURCES[(SOURCES.findIndex(s => s.k === S.src) + 1) % SOURCES.length].k);
    else if (h.t === "ap") setAp(APERTURES[(APERTURES.indexOf(S.ap) + 1) % APERTURES.length]);
    else if (h.t === "out") return {t: "out", x0: ev.clientX, v0: S.vOut};
    else if (h.t === "fine") return {t: "fine", x0: ev.clientX, v0: S.vFine};
    return null;
  },
  onDrag(d, ev) {
    const dx = ev.clientX - d.x0;
    if (d.t === "out") { S.vOut = clamp(d.v0 + Math.round(dx / 7) * 10, -300, 1000); changed(); }
    if (d.t === "fine") { S.vFine = clamp(d.v0 + Math.round(dx / 10), -10, 10); changed(); }
  }
});

/* ---------- การกระทำ ---------- */
function connect(t) {
  if (!S.pick) S.pick = t;
  else if (S.pick === t) S.pick = null;
  else { S.wires = S.wires.filter(w => !w.includes(t) && !w.includes(S.pick)); S.wires.push([S.pick, t]); S.pick = null; }
  panel.notice = ""; changed(true);
}
function setLamp(v) { S.lamp = v; panel.notice = ""; changed(true); }
function setSrc(k) { S.src = k; panel.notice = ""; changed(true); }
function setAp(a) { S.ap = a; panel.notice = ""; changed(true); }
const say = (msg, bad) => { panel.notice = (bad ? "bad:" : "") + msg; panel.live(); };
/* ตรวจว่าแรงดันตอนนี้เป็นศักย์หยุดยั้งที่ใช้บันทึกได้ คืนข้อความเมื่อยังไม่ได้ */
function stopProblem(src) {
  if (reading() > 0) return "กระแสยังไม่เป็นศูนย์ ค่อย ๆ ลดแรงดันด้วยปุ่ม Fine จนจออ่าน 0.000";
  if (-V() - stopV(src) > .03) return "แรงดันลบเกินจุดที่กระแสเพิ่งเป็นศูนย์ ค่อย ๆ เพิ่มแรงดันกลับจนจอเกือบจะไม่เป็น 0.000";
  if (V() >= 0) return "ต้องตั้งแรงดันเป็นค่าลบก่อน";
  return null;
}
function recordIV() {
  const v = V(), i = reading();
  S.iv = S.iv.filter(p => p.v !== v).concat({v, i}).sort((a, b) => a.v - b.v);
  panel.notice = ""; changed(true);
}
function recordApI() {
  if (V() !== 5) return say("ตั้งแรงดันเป็น +5.00 V ก่อนบันทึกกระแส", true);
  S.apRows[S.ap] = {...S.apRows[S.ap], i: reading()}; panel.notice = ""; changed(true);
}
function recordApV() {
  const err = stopProblem(SOURCE["436"]); if (err) return say(err, true);
  S.apRows[S.ap] = {...S.apRows[S.ap], vs: -V()}; panel.notice = ""; changed(true);
}
function recordStop() {
  const src = SOURCE[S.src];
  if (src.k === "led") {
    if (V() !== 5) return say("ตั้งแรงดันเป็น +5.00 V แล้วดูว่ากระแสเป็นเท่าไร", true);
    S.led = true; panel.notice = ""; return changed(true);
  }
  if (!src.hg) return say("เลือกแสงก่อน", true);
  const err = stopProblem(src); if (err) return say(err, true);
  S.vs[src.k] = -V(); panel.notice = ""; changed(true);
}
const fitPoints = () => HG.filter(s => S.vs[s.k] != null).map(s => ({nm: s.nm, vs: S.vs[s.k], k: s.k}));
function ensureOutput(v) { S.vOut = v; S.vFine = 0; }
const AUTO = {
  1() { PRED.forEach(q => { if (!S.pred[q.k]) S.pred[q.k] = "skip"; }); },
  2() { S.wires = [["sp", "a"], ["k", "pi"], ["po", "sn"]]; S.pick = null; },
  3() { S.lamp = true; S.src = "off"; S.zeroed = true; },
  4() { S.lamp = true; S.src = "436"; S.ap = 4; ensureOutput(500); S.lit = true; },
  5() {
    S.lamp = true; S.src = "436"; S.ap = 4;
    const s = SOURCE["436"], have = new Set(S.iv.map(p => p.v));
    [-1.5, -1, -.8, -.5, 0, .5, 1, 2, 3, 5].forEach(v => { if (!have.has(v)) S.iv.push({v, i: display(current(v, s, 4))}); });
    S.iv.sort((a, b) => a.v - b.v);
  },
  6() {
    const s = SOURCE["436"];
    APERTURES.forEach(a => { S.apRows[a] = {i: display(current(5, s, a)), vs: -zeroV(s, a), ...S.apRows[a]}; });
  },
  7() { S.ap = 4; HG.forEach(s => { if (S.vs[s.k] == null) S.vs[s.k] = -zeroV(s, 4); }); S.led = true; },
  8() { const p = fitPoints(); if (p.length === HG.length) S.fit = analyze(p); },
  9() {}
};

/* ---------- ส่วนควบคุมในแผง ---------- */
function ctlHTML(n) {
  const c = CTRL[n]; let h = "";
  if (c.lamp) h += `<button type="button" class="big ${S.lamp ? "on" : ""}" id="pw">${S.lamp ? "ปิดเครื่อง Hg Lamp" : "เปิดเครื่อง Hg Lamp"}</button>`;
  if (c.src) h += `<div class="field"><label>ปุ่มเลือกแสง</label><div class="chips">${SOURCES.map(s => `<button type="button" class="chip srcpick ${S.src === s.k ? "on" : ""}" data-k="${s.k}">${s.label}</button>`).join("")}</div></div>`;
  if (c.ap) h += `<div class="field"><label>ช่องรับแสง</label><div class="chips">${APERTURES.map(a => `<button type="button" class="chip appick ${S.ap === a ? "on" : ""}" data-a="${a}">${a} mm</button>`).join("")}</div></div>`;
  if (c.supply) h += `<div class="field"><label for="outS">Output <output id="outO"></output></label><input id="outS" type="range" min="-300" max="1000" step="10"></div>
    <div class="field"><label for="fineS">Fine <output id="fineO"></output></label><input id="fineS" type="range" min="-10" max="10" step="1"></div>`;
  if (n >= 3) h += `<div class="calc"><div><span>แรงดัน</span><span class="v" id="rdV"></span></div><div><span>กระแส</span><span class="v" id="rdI"></span></div></div>`;
  return h;
}
function bindCtl() {
  const pw = $("pw"); if (pw) pw.onclick = () => setLamp(!S.lamp);
  $("body").querySelectorAll(".srcpick").forEach(b => b.onclick = () => setSrc(b.dataset.k));
  $("body").querySelectorAll(".appick").forEach(b => b.onclick = () => setAp(+b.dataset.a));
  const o = $("outS"); if (o) o.oninput = e => { S.vOut = +e.target.value; changed(); };
  const f = $("fineS"); if (f) f.oninput = e => { S.vFine = +e.target.value; changed(); };
}
function syncInputs() {
  const o = $("outS"); if (o) { o.value = S.vOut; $("outO").textContent = (S.vOut / 100).toFixed(2) + " V"; }
  const f = $("fineS"); if (f) { f.value = S.vFine; $("fineO").textContent = (S.vFine >= 0 ? "+" : "−") + Math.abs(S.vFine / 100).toFixed(2) + " V"; }
}

/* ---------- กราฟ ---------- */
function niceStep(range) { const r = range / 5, p = 10 ** Math.floor(Math.log10(r)), m = r / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
function plot(id, {xr, yr, xl, yl, series, height = 190}) {
  const c = $(id); if (!c) return;
  const dpr = Math.min(devicePixelRatio, 2), w = c.clientWidth || 340, h = height;
  c.width = w * dpr; c.height = h * dpr; c.style.height = h + "px";
  const g = c.getContext("2d"); g.scale(dpr, dpr);
  const L = 44, R = 10, T = 12, B = 36, X = v => L + (v - xr[0]) / (xr[1] - xr[0]) * (w - L - R), Y = v => T + (yr[1] - v) / (yr[1] - yr[0]) * (h - T - B);
  g.font = "11px 'IBM Plex Mono',monospace"; g.lineWidth = 1;
  const sx = niceStep(xr[1] - xr[0]), sy = niceStep(yr[1] - yr[0]);
  g.textAlign = "center"; g.textBaseline = "top";
  for (let v = Math.ceil(xr[0] / sx) * sx; v <= xr[1] + 1e-9; v += sx) { g.strokeStyle = "#cdd2d0"; g.beginPath(); g.moveTo(X(v), T); g.lineTo(X(v), h - B); g.stroke(); g.fillStyle = "#56606a"; g.fillText(+v.toFixed(2), X(v), h - B + 4); }
  g.textAlign = "right"; g.textBaseline = "middle";
  for (let v = Math.ceil(yr[0] / sy) * sy; v <= yr[1] + 1e-9; v += sy) { g.strokeStyle = "#cdd2d0"; g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(w - R, Y(v)); g.stroke(); g.fillStyle = "#56606a"; g.fillText(+v.toFixed(2), L - 5, Y(v)); }
  g.strokeStyle = "#1b2026"; g.beginPath(); if (yr[0] <= 0 && yr[1] >= 0) { g.moveTo(L, Y(0)); g.lineTo(w - R, Y(0)); } if (xr[0] <= 0 && xr[1] >= 0) { g.moveTo(X(0), T); g.lineTo(X(0), h - B); } g.stroke();
  g.fillStyle = "#1b2026"; g.textAlign = "center"; g.textBaseline = "bottom"; g.fillText(xl, (L + w - R) / 2, h - 3);
  g.save(); g.translate(11, (T + h - B) / 2); g.rotate(-Math.PI / 2); g.textBaseline = "middle"; g.fillText(yl, 0, 0); g.restore();
  g.save(); g.beginPath(); g.rect(L, T, w - L - R, h - T - B); g.clip();
  series.forEach(s => {
    g.strokeStyle = g.fillStyle = s.color; g.lineWidth = s.w || 1.6;
    if (s.line) { g.beginPath(); s.pts.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.stroke(); }
    if (s.dots) s.pts.forEach(([x, y]) => { g.beginPath(); g.arc(X(x), Y(y), 3.4, 0, 6.3); g.fill(); });
  });
  g.restore();
  g.textBaseline = "top"; g.textAlign = "right"; let ly = T + 2;
  series.filter(s => s.label).forEach(s => { g.fillStyle = s.color; g.fillText(s.label, w - R - 4, ly); ly += 14; });
}
function modelCurve(src, ap, a, b) { const pts = []; for (let i = 0; i <= 160; i++) { const v = a + (b - a) * i / 160; pts.push([v, current(v, src, ap)]); } return pts; }
const COLS = {2: "#a9811f", 4: "#56606a", 8: "#1b2026"};
function drawIV() {
  const vs = S.iv.map(p => p.v), a = Math.min(-2, ...vs), b = Math.max(6, ...vs), max = Math.max(1, ...S.iv.map(p => p.i)) * 1.15;
  plot("graph", {xr: [a, b], yr: [0, max], xl: "V (V)", yl: "I (nA)", series: [{pts: S.iv.map(p => [p.v, p.i]), line: true, dots: true, color: "#80590a"}]});
}
function drawAp() {
  const done = APERTURES.filter(a => S.apRows[a] && S.apRows[a].i != null), src = SOURCE["436"];
  const max = Math.max(1, ...done.map(a => isat(src, a))) * 1.15;
  plot("graph", {xr: [-2, 6], yr: [0, max], xl: "V (V)", yl: "I (nA)", series: done.map(a => ({pts: modelCurve(src, a, -2, 6), line: true, color: COLS[a], label: `${a} mm`}))});
}
function drawFit() {
  const pts = fitPoints().map(p => [freq(p.nm) / 1e14, p.vs]), series = [{pts, dots: true, color: "#1b2026"}];
  if (S.fit) series.unshift({pts: [[S.fit.f0 / 1e14, 0], [8.8, S.fit.slope * 8.8e14 + S.fit.c]], line: true, color: "#80590a"});
  plot("graph", {xr: [4.4, 8.8], yr: [-.2, 1.7], xl: "f (10¹⁴ Hz)", yl: "Vₛ (V)", series});
}
const sci = (v, n = 3) => { const e = Math.floor(Math.log10(Math.abs(v))); return `${(v / 10 ** e).toFixed(n)}×10<sup>${String(e).replace("-", "−")}</sup>`; };

/* ---------- เนื้อหาขั้นตอน ---------- */
const PRED = [
  {k: "aI", q: "เพิ่มความเข้มแสง → กระแส"},
  {k: "aE", q: "เพิ่มความเข้มแสง → พลังงานจลน์สูงสุดของอิเล็กตรอน"},
  {k: "fI", q: "เพิ่มความถี่แสง (ความเข้มเท่าเดิม) → กระแส"},
  {k: "fE", q: "เพิ่มความถี่แสง (ความเข้มเท่าเดิม) → พลังงานจลน์สูงสุดของอิเล็กตรอน"}
];
const PRED_OPT = {up: "เพิ่มขึ้น", same: "เท่าเดิม", down: "ลดลง"};
const m = t => `<i class="m">${t}</i>`, Vs = `${m("V")}<sub>s</sub>`;
const STEPS = {
  1: {t: "ทำนายผล", doc: "ก่อนทดลอง ลองทำนายว่าจะเกิดอะไรขึ้น ไม่คิดคะแนน แล้วกลับมาเทียบในขั้นสุดท้าย",
    html: () => PRED.map(q => `<div class="pred"><span>${q.q}</span><div class="chips">${Object.entries(PRED_OPT).map(([v, t]) => `<button type="button" class="chip prd ${S.pred[q.k] === v ? "on" : ""}" data-q="${q.k}" data-v="${v}">${t}</button>`).join("")}</div></div>`).join(""),
    bind() { $("body").querySelectorAll(".prd").forEach(b => b.onclick = () => { S.pred[b.dataset.q] = b.dataset.v; changed(true); }); },
    live() { const n = PRED.filter(q => S.pred[q.k]).length; return n === PRED.length ? ["yes", "ทำนายครบแล้ว"] : ["no", `ตอบแล้ว ${n} จาก ${PRED.length} ข้อ`]; }},
  2: {t: "ต่อวงจร", doc: "ต่อแหล่งจ่ายเข้าแอโนดของหลอด และต่อ Picoammeter อนุกรมระหว่างแคโทดกับขั้วกลับของแหล่งจ่าย",
    html: () => `<p class="task">กดขั้วแรก แล้วกดขั้วที่สองเพื่อต่อสาย 1 เส้น ทำในฉากหรือในแผงนี้ก็ได้</p>
      <div class="chips">${Object.entries(TERM).map(([k, t]) => `<button type="button" class="chip termpick ${S.pick === k ? "on" : ""}" data-t="${k}">${t.name}</button>`).join("")}</div>
      ${S.wires.length ? `<ol class="wires">${S.wires.map(([a, b]) => `<li class="${REQUIRED.includes(wireKey(a, b)) ? "good" : "bad"}">${TERM[a].name} → ${TERM[b].name}</li>`).join("")}</ol>` : ""}
      <div class="rows"><button type="button" id="clearW">ล้างสายทั้งหมด</button></div>
      <p class="note">ต้องการ 3 เส้น: แหล่งจ่ายขั้วแดง → A, K → Picoammeter ขั้วเข้า และ Picoammeter ขั้วออก → แหล่งจ่ายขั้วดำ ขั้วเหลืองไม่ใช้</p>`,
    bind() { $("body").querySelectorAll(".termpick").forEach(b => b.onclick = () => connect(b.dataset.t)); $("clearW").onclick = () => { S.wires = []; S.pick = null; changed(true); }; },
    live() { const good = wireKeys().filter(k => REQUIRED.includes(k)).length, bad = S.wires.length - good; return circuitOK() ? ["yes", "ต่อวงจรถูกต้องครบ 3 เส้นแล้ว"] : ["no", bad ? `มีสายต่อผิด ${bad} เส้น` : `ต่อถูกแล้ว ${good} จาก 3 เส้น`]; }},
  3: {t: "ตรวจศูนย์", doc: "เปิดเครื่องโดยยังไม่ให้แสงเข้าหลอด แล้วตรวจว่า Picoammeter อ่านศูนย์",
    html: () => `${ctlHTML(3)}<p class="note">ชุดจริงต้องอุ่นหลอดปรอทราว 20 นาทีก่อนใช้ ในเว็บข้ามเวลานี้ให้</p>`,
    bind: bindCtl,
    live() { return S.zeroed ? ["yes", "Picoammeter อ่าน 0.000 nA เมื่อไม่มีแสง"] : !S.lamp ? ["no", "ยังไม่ได้เปิดเครื่อง Hg Lamp"] : ["no", "หมุนปุ่มเลือกแสงไปที่ ปิดแสง"]; }},
  4: {t: "เปิดแสง", doc: "เลือกแสง 436 nm ช่องรับแสง 4 mm ตั้งแรงดัน +5.00 V แล้วดูกระแส",
    html: () => `<p class="warn">หลอดปรอทให้รังสี UV ห้ามมองเข้าหลอดโดยตรงเมื่อใช้ชุดจริง</p>${ctlHTML(4)}<p class="note">กด "ดูภายในหลอด" เพื่อดูโฟตอนและอิเล็กตรอน แล้วลองเปลี่ยนแรงดัน</p>`,
    bind: bindCtl,
    live() { return S.lit ? ["yes", "มีกระแสไหลแล้ว"] : S.src !== "436" ? ["no", "เลือกแสง 436 nm"] : S.ap !== 4 ? ["no", "เลือกช่องรับแสง 4 mm"] : V() !== 5 ? ["no", "ตั้งแรงดันเป็น +5.00 V"] : ["no", "ยังไม่มีกระแส"]; }},
  5: {t: "วัดกราฟ I–V", doc: "ปรับแรงดันจากค่าลบไปค่าบวกที่แสง 436 nm ช่องรับแสง 4 mm แล้วบันทึกกระแสอย่างน้อย 8 จุด",
    html: () => `${ctlHTML(5)}<div class="rows"><button type="button" id="recPt">บันทึกจุดนี้</button><button type="button" id="clrPt">ล้างจุดทั้งหมด</button></div>
      <canvas id="graph" class="graph"></canvas><p class="note">บันทึกแล้ว ${S.iv.length} จุด ต้องมีจุดที่กระแสเป็นศูนย์ และจุดที่ V ≥ +5 V</p>`,
    bind() { bindCtl(); $("recPt").onclick = recordIV; $("clrPt").onclick = () => { S.iv = []; changed(true); }; drawIV(); },
    live() { return ivOK() ? ["yes", "ได้ข้อมูลครบแล้ว"] : S.iv.length < 8 ? ["no", `บันทึกแล้ว ${S.iv.length} จาก 8 จุด`] : !S.iv.some(p => p.i === 0) ? ["no", "ยังไม่มีจุดที่กระแสเป็นศูนย์"] : ["no", "ยังไม่มีจุดที่ V ≥ +5 V"]; }},
  6: {t: "เปลี่ยนความเข้ม", doc: "เปลี่ยนช่องรับแสงที่แสง 436 nm เพื่อเปลี่ยนความเข้ม บันทึกกระแสที่ +5.00 V และศักย์หยุดยั้ง",
    html: () => `${ctlHTML(6)}<div class="rows"><button type="button" id="recI">บันทึก I ที่ +5.00 V</button><button type="button" id="recV">บันทึก ${Vs}</button></div>
      <table class="read"><thead><tr><th>ช่องรับแสง</th><th>I (nA)</th><th>${Vs} (V)</th></tr></thead><tbody>${APERTURES.map(a => { const r = S.apRows[a] || {}; return `<tr class="${a === S.ap ? "cur" : ""}"><td>${a} mm</td><td>${r.i != null ? r.i.toFixed(3) : "–"}</td><td>${r.vs != null ? r.vs.toFixed(2) : "–"}</td></tr>`; }).join("")}</tbody></table>
      <canvas id="graph" class="graph"></canvas><p class="note">เส้นกราฟเป็นแบบจำลองของช่องที่บันทึกแล้ว ใช้เทียบรูปร่างกราฟ</p>`,
    bind() { bindCtl(); $("recI").onclick = recordApI; $("recV").onclick = recordApV; drawAp(); },
    live() { const n = APERTURES.filter(a => S.apRows[a] && S.apRows[a].i != null && S.apRows[a].vs != null).length; return n === 3 ? ["yes", "บันทึกครบ 3 ช่องแล้ว"] : ["no", `บันทึกครบแล้ว ${n} จาก 3 ช่อง`]; }},
  7: {t: "เปลี่ยนความถี่", doc: "เปลี่ยนแสงให้ครบ 5 ค่าที่ช่องรับแสง 4 mm ปรับแรงดันจนกระแสเป็นศูนย์ บันทึกศักย์หยุดยั้ง แล้วทดสอบ LED แดงที่ +5.00 V",
    html: () => { const src = SOURCE[S.src]; return `${ctlHTML(7)}<div class="rows"><button type="button" id="recS">${src.k === "led" ? "บันทึกผล LED ที่ +5.00 V" : `บันทึก ${Vs} ของ ${src.label}`}</button></div>
      <table class="read"><thead><tr><th>แสง</th><th><i class="m">f</i> (10¹⁴ Hz)</th><th>${Vs} (V)</th></tr></thead><tbody>${HG.map(s => `<tr class="${s.k === S.src ? "cur" : ""}"><td>${s.label}</td><td>${(freq(s.nm) / 1e14).toFixed(3)}</td><td>${S.vs[s.k] != null ? S.vs[s.k].toFixed(2) : "–"}</td></tr>`).join("")}<tr class="${S.src === "led" ? "cur" : ""}"><td>LED 650 nm</td><td>${(freq(650) / 1e14).toFixed(3)}</td><td>${S.led ? "ไม่เกิดกระแส" : "–"}</td></tr></tbody></table>
      <p class="note">LED แดงเป็นแหล่งแสงแยกจากหลอดปรอท เพราะหลอดปรอทไม่มีเส้น 650 nm และ 365 nm เป็นรังสี UV ที่มองไม่เห็นจริง ในฉากแสดงเป็นสีม่วง</p>`; },
    bind() { bindCtl(); $("recS").onclick = recordStop; },
    live() { const n = HG.filter(s => S.vs[s.k] != null).length; return n === 5 && S.led ? ["yes", "ได้ข้อมูลครบแล้ว"] : n < 5 ? ["no", `บันทึกแล้ว ${n} จาก 5 แสง`] : ["no", "ยังไม่ได้ทดสอบ LED แดง"]; }},
  8: {t: "พล็อตและคำนวณ", doc: "พล็อต V_s กับความถี่ หาความชันซึ่งเท่ากับ h/e จุดตัดแกนให้ฟังก์ชันงาน และจุดที่ V_s เป็นศูนย์คือความถี่ขีดเริ่ม",
    html: () => { const r = S.fit; return `<canvas id="graph" class="graph"></canvas>
      <div class="rows"><button type="button" id="doFit">คำนวณความชันจากข้อมูล</button></div>
      ${r ? `<div class="calc">
       <div><span>ค่าเฉลี่ย ${m("f")}, ${Vs}</span><span class="v">${sci(r.mx)} Hz, ${r.my.toFixed(3)} V</span></div>
       <div><span>ความชัน = Σ(${m("f")}−f̄)(${Vs}−V̄) ÷ Σ(${m("f")}−f̄)²</span><span class="v">${sci(r.slope)} V·s</span></div>
       <div><span>${m("h")} = ${m("e")} × ความชัน</span><span class="v">${sci(E_CHARGE)} × ${sci(r.slope)}</span></div>
       <div class="res"><span>${m("h")}</span><span class="v">${sci(r.h)} J·s</span></div>
       <div><span>ความคลาดเคลื่อนของ ${m("h")}</span><span class="v">${r.errPct >= 0 ? "+" : "−"}${Math.abs(r.errPct).toFixed(1)}%</span></div>
       <div><span>ฟังก์ชันงาน φ (จุดตัดแกน)</span><span class="v">${r.phi.toFixed(2)} eV</span></div>
       <div><span>ความถี่ขีดเริ่ม ${m("f")}<sub>0</sub></span><span class="v">${sci(r.f0)} Hz</span></div>
      </div>` : ""}`; },
    bind() { $("doFit").onclick = () => { const p = fitPoints(); if (p.length < HG.length) return say("ต้องมีข้อมูลครบ 5 แสงจากขั้นที่ 7", true); S.fit = analyze(p); changed(true); }; drawFit(); },
    live() { return S.fit ? ["yes", `ได้ h = ${(S.fit.h / 1e-34).toFixed(2)}×10⁻³⁴ J·s`] : ["no", "กดคำนวณความชัน"]; }},
  9: {t: "สรุป", doc: "เทียบผลที่วัดได้กับคำทำนายในขั้นแรก แล้วตอบคำถามท้ายการทดลอง",
    html: () => { const a2 = S.apRows[2] || {}, a8 = S.apRows[8] || {}, f = v => v != null ? v.toFixed(2) : "–", show = k => ({up: "เพิ่มขึ้น", same: "เท่าเดิม", down: "ลดลง", skip: "ไม่ได้ทำนาย"})[S.pred[k]] || "–"; return `<table class="read"><thead><tr><th>เมื่อเพิ่ม</th><th>ปริมาณ</th><th>คำทำนาย</th><th>ผลที่วัดได้</th></tr></thead><tbody>
      <tr><td class="c">ความเข้ม<br>2 → 8 mm</td><td class="c">กระแส</td><td class="c">${show("aI")}</td><td>${f(a2.i)} → ${f(a8.i)} nA</td></tr>
      <tr><td class="c">ความเข้ม<br>2 → 8 mm</td><td class="c">${Vs}</td><td class="c">${show("aE")}</td><td>${f(a2.vs)} → ${f(a8.vs)} V</td></tr>
      <tr><td class="c">ความถี่<br>579 → 365 nm</td><td class="c">กระแส</td><td class="c">${show("fI")}</td><td>ขึ้นกับหลอดและแคโทด</td></tr>
      <tr><td class="c">ความถี่<br>579 → 365 nm</td><td class="c">${Vs}</td><td class="c">${show("fE")}</td><td>${f(S.vs["579"])} → ${f(S.vs["365"])} V</td></tr></tbody></table>
      <p class="task">คำถามท้ายการทดลอง</p><ol class="qs"><li>เมื่อเพิ่มความเข้มแสง กระแสและศักย์หยุดยั้งเปลี่ยนอย่างไร</li><li>ทำไม LED สีแดงที่สว่างมากจึงไม่ทำให้เกิดกระแส</li><li>ผลการทดลองนี้ขัดกับการมองแสงเป็นคลื่นอย่างไร</li><li>ความชันของกราฟ ${Vs} กับ ${m("f")} จะเปลี่ยนหรือไม่ ถ้าเปลี่ยนโลหะแคโทด</li></ol>`; },
    live() { return ["yes", "จบการทดลอง"]; }}
};

/* ---------- แผงขั้นตอน ---------- */
const panel = createPanel({
  steps: STEPS, ok, auto: AUTO, docLabel: "วิธีทดลอง",
  getStep: () => S.step, setStep: n => { S.step = n; },
  finishLabel: "ดูตารางบันทึกผล",
  onFinish: () => toggleSheet(true),
  beforeGoTo() { panel.notice = ""; S.pick = null; },
  onEnter(n) {
    if (n >= 5 && n <= 7) S.lamp = true;
    if (n === 5 || n === 6) S.src = "436";
    if (n === 5 || n === 7) S.ap = 4;
    if (n === 7 && !SOURCE[S.src].hg && S.src !== "led") S.src = "436";
    camForStep();
  },
  afterRender() { syncTools(); if (S.sheet) renderSheet(); },
  afterLive() { syncInputs(); syncWires(); syncMeters(true); }
});

function syncTools() { $("inside").textContent = S.cam === "inside" ? "กลับมุมกว้าง" : "ดูภายในหลอด"; }
let lastHud = "";
function syncMeters(force) {
  const v = V(), i = reading();
  setVolt(v.toFixed(2)); setPico(i.toFixed(3));
  const rv = $("rdV"); if (rv) { rv.textContent = sgn(v) + " V"; $("rdI").textContent = i.toFixed(3) + " nA"; }
  const hud = [];
  if (S.step >= 3) { const s = liveSrc(); hud.push(!S.lamp ? "หลอดปิด" : s.label, `ช่อง ${S.ap} mm`, `${sgn(v)} V`, `${i.toFixed(3)} nA`); }
  const str = hud.join("|"); if (force || str !== lastHud) { lastHud = str; $("hud").innerHTML = hud.map(h => `<span>${h}</span>`).join(""); }
  apLabel.el.textContent = `ช่องรับแสง ${S.ap} mm`;
}
function renderSheet() {
  $("sheetMeta").innerHTML = `<span>แคโทดสมมติ φ = <b>2.00</b> eV</span><span>แสงจาก <b>ปุ่มเลือกแสง</b></span>`;
  const iv = S.iv.map(p => `<tr><td class="s">4 mm</td><td>${sgn(p.v)}</td><td>${p.i.toFixed(3)}</td></tr>`).join("");
  const ap = APERTURES.map(a => { const r = S.apRows[a] || {}; return `<tr><td class="s">${a} mm</td><td>+5.00</td><td>${r.i != null ? r.i.toFixed(3) : ""}</td></tr>`; }).join("");
  const vs = HG.map(s => { const v = S.vs[s.k]; return `<tr><td class="s">${s.label}</td><td>${(freq(s.nm) / 1e14).toFixed(3)}</td><td>${v != null ? v.toFixed(2) : ""}</td><td>${v != null ? v.toFixed(2) : ""}</td></tr>`; }).join("");
  const r = S.fit;
  $("sheetWrap").innerHTML = `<table class="full"><thead><tr><th>ฟิลเตอร์ λ</th><th>f (10¹⁴ Hz)</th><th>V_s (V)</th><th>E_k,max = eV_s (eV)</th></tr></thead><tbody>${vs}</tbody></table><br>
    <table class="full"><thead><tr><th>ช่องรับแสง</th><th>V (V)</th><th>I (nA)</th></tr></thead><tbody>${iv}${ap}</tbody></table>
    ${r ? `<p>ความชัน = ${sci(r.slope)} V·s &nbsp; h = ${sci(r.h)} J·s &nbsp; φ = ${r.phi.toFixed(2)} eV &nbsp; f₀ = ${sci(r.f0)} Hz &nbsp; คลาดเคลื่อน ${r.errPct.toFixed(1)}%</p>` : ""}`;
}
function toggleSheet(v) { S.sheet = v; $("sheet").hidden = !v; if (v) renderSheet(); }

$("inside").onclick = () => { if (S.cam === "inside") camForStep(); else setInside(); syncTools(); };
$("openSheet").onclick = () => toggleSheet(!S.sheet);
$("closeSheet").onclick = () => toggleSheet(false);
$("reset").onclick = () => { S = START(); wireSig = null; electrons.length = photons.length = 0; setFree("wide"); panel.render(); toggleSheet(false); syncTools(); };
addEventListener("resize", () => { const n = S.step; if (n === 5) drawIV(); else if (n === 6) drawAp(); else if (n === 8) drawFit(); });

/* ---------- ทุกเฟรม: ขยับฉากตามสถานะ S ---------- */
const col = new THREE.Color(), ROOM = {bgL: new THREE.Color(0xe6e8e4), bgD: new THREE.Color(0x0b0e12)};
let dimmer = 1, noiseT = 0;
const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) * Math.cos(6.2832 * Math.random());
function frame(dt, k, kFast) {
  const src = liveSrc(), on = src.k !== "off";
  /* ปุ่มหมุนและสวิตช์ */
  dial.rotation.z += (-SOURCES.findIndex(s => s.k === S.src) * .78 - dial.rotation.z) * kFast;
  apGroup.rotation.y += (-APERTURES.indexOf(S.ap) * 1.05 - apGroup.rotation.y) * kFast;
  outK.g.rotation.z += (-(S.vOut + 300) / 1300 * 4.7 + 2.35 - outK.g.rotation.z) * kFast;
  fineK.g.rotation.z += (-S.vFine / 10 * 2.2 - fineK.g.rotation.z) * kFast;
  lampSwitch.material.emissiveIntensity = S.lamp ? .9 : 0;
  for (const key in ledMeshes) ledMeshes[key].material.emissiveIntensity = S.lamp && S.src === key ? 1.6 : 0;
  /* ลำแสง */
  const level = on ? .55 + .45 * Math.min(1, S.ap / 8) : 0;
  if (on) { col.setHex(src.color); beamMat.color.copy(col); lampGlow.material.color.copy(col); boxLight.color.copy(col); cathodeMat.emissive.copy(col); lens.material.emissive.copy(col); }
  beamMat.opacity += ((on ? .55 * level : 0) - beamMat.opacity) * kFast;
  lampGlow.material.opacity += ((on ? .8 : 0) - lampGlow.material.opacity) * kFast;
  boxLight.intensity += ((on ? 1.4 * level : 0) - boxLight.intensity) * kFast;
  cathodeMat.emissiveIntensity += ((on ? .5 * level : 0) - cathodeMat.emissiveIntensity) * kFast;
  lens.material.emissiveIntensity += ((on ? .45 * level : 0) - lens.material.emissiveIntensity) * kFast;
  /* ขั้วที่เลือกไว้ */
  for (const key in TERM) TERM[key].mesh.material.emissiveIntensity = S.pick === key ? 1.2 : 0;
  /* ห้องหรี่ลงเฉพาะมุมมองภายในหลอด */
  const inside = S.cam === "inside";
  dimmer += ((inside ? .08 : 1) - dimmer) * kFast;
  hemi.intensity = .62 * dimmer + .05; key.intensity = .72 * dimmer;
  scene.background.copy(ROOM.bgL).lerp(ROOM.bgD, clamp((1 - dimmer) / .92, 0, 1));
  winGlass.visible = !inside;
  eMesh.visible = pMesh.visible = inside;
  if (inside) { if (on) pMat.color.setHex(src.color); stepParticles(dt); }
  /* สัญญาณรบกวนบนจอ */
  noiseT += dt; if (noiseT > .3) { noiseT = 0; zNoise = gauss(); syncMeters(false); }
}

core.resize(); setFree("wide"); panel.render(); core.start(frame);

/* จุดเข้าถึงสำหรับทดสอบอัตโนมัติ */
window.__lab = {get S() { return S; }, goTo: panel.goTo, AUTO, V, reading, circuitOK, SOURCE, zeroV, setLamp, setSrc, setAp, connect, camera, tw};
