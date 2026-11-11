/* การสลายตัวของกัมมันตภาพรังสี: สถานะ ขั้นตอน ฉากอุปกรณ์ และตาราง
   ส่วนกลาง (renderer กล้อง ป้าย แผงขั้นตอน) อยู่ใน shared/lab-core.js */
import {$, clamp, fmt, createScene, createPanel} from "../../../shared/lab-core.js";
import {SAMPLES, SAMPLE, GATES, GATE_OF, GATE, N_READ, meanCounts, poisson, netRows, analyze} from "./physics.js";

const THREE = window.THREE;
const SPEED = 10;        // ช่วงนับแสดงผลเร็วกว่าจริง 10 เท่า
const SKIP_SEC = 2;      // เวลาบนหน้าจอของการเร่งเวลาระหว่างรอบ

/* ---------- สถานะ ---------- */
const START = () => ({step: 1, pred: {}, wired: false, d: 12, sample: "ba", placed: false, gate: "1", n: 0, run: "idle", left: 0, gateUsed: null, clean: true, t: 0, skip: null, bgN: null, reads: [], fit: null, cam: "free", sheet: false});
let S = START();

const smp = () => SAMPLE[S.sample];
const bg10 = () => S.bgN == null ? null : S.bgN / 100 * GATE;
const fullReads = () => S.reads.length >= N_READ;
const tText = t => { const s = smp(), v = t / s.sec; return `${Number(v.toFixed(s.sec === 1 ? 0 : 1)).toLocaleString()} ${s.unit}`; };

const ok = {
  1: () => PRED.every(q => S.pred[q.k]),
  2: () => S.wired && Math.abs(S.d - 5) <= .5,
  3: () => S.bgN != null,
  4: () => S.placed,
  5: () => fullReads(),
  6: () => fullReads() && S.bgN != null,
  7: () => !!S.fit,
  8: () => S.step === 8
};
function changed(full) { if (full) panel.render(); else panel.live(); }
const say = (msg, bad) => { panel.notice = (bad ? "bad:" : "") + msg; panel.live(); };

/* ---------- ฉาก ---------- */
const core = createScene({isFree: () => S.cam === "free", camPos: [18, 54, 112], look: [16, 8, 8]});
const {scene, std, box, cyl, canvasTex, aspectFit, addLabel} = core;

box(300, 3, 190, std(0xa9ada8, {roughness: .9}), 10, -1.5, 30);
box(1600, 700, 2, std(0xd3d6d1, {roughness: 1}), 0, 300, -62);

const navy = std(0x1d2a44, {metalness: .2, roughness: .5}), dark = std(0x17191c, {metalness: .3, roughness: .5});
const metal = std(0x9aa1a7, {metalness: .8, roughness: .3}), teal = std(0x63b8c8, {roughness: .45}), knobMat = std(0x7c8187, {metalness: .4, roughness: .4});

function plate(w, h, draw, x, y, z, px = 24, bg = "#eef0ec") {
  const tex = canvasTex(Math.round(w * px), Math.round(h * px), g => { g.scale(px, px); g.fillStyle = bg; g.fillRect(0, 0, w, h); g.textBaseline = "middle"; draw(g, w, h); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({map: tex, roughness: .55})); m.position.set(x, y, z); scene.add(m); return m;
}
const text = (g, t, x, y, size, o = {}) => { g.font = `${o.w || 600} ${size}px Arial`; g.fillStyle = o.c || "#15181c"; g.textAlign = o.a || "left"; g.fillText(t, x, y); };

/* จอเลข 7 ส่วน */
const SEG = {0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc", 5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg", 9: "abcfgd"};
function makeDisplay(w, h, x, y, z, cells) {
  const tex = canvasTex(cells * 90, 150, () => {});
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map: tex, toneMapped: false})); mesh.position.set(x, y, z); scene.add(mesh);
  let last = null;
  return str => {
    if (str === last) return; last = str;
    const g = tex.image.getContext("2d"); g.fillStyle = "#140507"; g.fillRect(0, 0, cells * 90, 150);
    [...str].forEach((c, i) => {
      const x0 = i * 90 + 18, y0 = 20, a = 54, b = 50, t = 10;
      const rect = {a: [x0 + t, y0, a - 2 * t, t], d: [x0 + t, y0 + 2 * b, a - 2 * t, t], g: [x0 + t, y0 + b, a - 2 * t, t], f: [x0, y0 + t, t, b - t], b: [x0 + a - t, y0 + t, t, b - t], e: [x0, y0 + b + t, t, b - t], c: [x0 + a - t, y0 + b + t, t, b - t]};
      for (const s in rect) { g.fillStyle = SEG[c].includes(s) ? "#ff2a1c" : "#3a0d10"; g.fillRect(...rect[s]); }
    });
    tex.needsUpdate = true;
  };
}

/* ---------- GM Counter ---------- */
const CX = -14, CY = 9.5, CW = 30, CH = 18, FRONT = 10;
const px = v => CX - CW / 2 + v, py = v => CY + CH / 2 - v;   // แปลงตำแหน่งบนแผ่นหน้าปัดเป็นตำแหน่งในฉาก
box(CW + 1, CH + 1, 16, navy, CX, CY, 2);
const KNOB = {x: 19, y: 13.8};
const gateAngle = i => (-75 + i * 30) * Math.PI / 180;
plate(CW, CH, g => {
  text(g, "GM Counter", 3, 1.6, 1.4);
  g.fillStyle = "#17191c"; g.fillRect(3.2, 2.9, 20.6, 6.2);
  text(g, "Start/Stop", 5, 11.5, .75, {a: "center", w: 500}); text(g, "Reset", 11, 11.5, .75, {a: "center", w: 500});
  GATES.forEach((o, i) => { const a = gateAngle(i), s = o.k === "auto" ? "Auto" : o.label; text(g, s, KNOB.x + 3.3 * Math.sin(a), KNOB.y - 3.3 * Math.cos(a), .62, {a: "center", w: 500}); });
  text(g, "Input", 26, 11.5, .75, {a: "center", w: 500});
}, CX, CY, FRONT + .02);
const setCount = makeDisplay(19.6, 5.4, px(13.5), py(6), FRONT + .08, 4);
const btnMat = std(0xd9dde0, {roughness: .4});
const makeBtn = x => { const b = cyl(1.3, .8, btnMat, px(x), py(13.8), FRONT + .4); b.rotation.x = Math.PI / 2; return b; };
const startBtn = makeBtn(5), resetBtn = makeBtn(11);
const gateG = new THREE.Group(); gateG.position.set(px(KNOB.x), py(KNOB.y), FRONT + .1); scene.add(gateG);
const gateK = cyl(1.5, 1, knobMat, 0, 0, .5); gateK.rotation.x = Math.PI / 2; gateG.add(gateK);
box(.3, 1.2, .3, std(0x1b1f24), 0, .8, 1.05, gateG);
const led = new THREE.Mesh(new THREE.SphereGeometry(.42, 12, 10), new THREE.MeshStandardMaterial({color: 0x3a1512, emissive: 0xff2a14, emissiveIntensity: 0})); led.position.set(px(26), py(6), FRONT + .15); scene.add(led);
const JACK = [px(26), py(13.8), FRONT + .4];
const jack = new THREE.Mesh(new THREE.SphereGeometry(.65, 12, 10), new THREE.MeshStandardMaterial({color: 0xdcae1e, roughness: .35, emissive: 0xd9a93f, emissiveIntensity: 0})); jack.position.set(...JACK); scene.add(jack);

/* ---------- แผ่นฐาน ---------- */
const XW = 30, ZL = 10, BX0 = 9, BW = 53, BZ0 = -8, BD = 36, TOP = 1;   // XW = หน้าหลอด GM, ZL = แนวสเกล
box(BW, TOP, BD, std(0x7fa8c6, {roughness: .7}), BX0 + BW / 2, TOP / 2, BZ0 + BD / 2);
const boardTop = plate(BW, BD, g => {
  const cx = XW - BX0, cy = ZL - BZ0;
  g.strokeStyle = g.fillStyle = "#1c3a55"; g.lineWidth = .05;
  g.beginPath(); g.moveTo(1, cy); g.lineTo(BW - 1, cy); g.stroke();
  for (let d = 1; d <= 15; d++) { const x = cx - d, long = d % 5 === 0; g.beginPath(); g.moveTo(x, cy - (long ? 1.1 : .6)); g.lineTo(x, cy + (long ? 1.1 : .6)); g.stroke(); text(g, String(d), x, cy + 2, .85, {a: "center", c: "#1c3a55", w: 500}); }
  text(g, "cm", cx - 17, cy + 2, .85, {a: "center", c: "#1c3a55", w: 500});
  for (let r = 4; r <= 20; r += 4) { g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2); g.stroke(); }
  for (let a = -80; a <= 80; a += 10) { const t = a * Math.PI / 180; g.beginPath(); g.moveTo(cx + 4 * Math.cos(t), cy + 4 * Math.sin(t)); g.lineTo(cx + 20 * Math.cos(t), cy + 20 * Math.sin(t)); g.stroke(); }
}, BX0 + BW / 2, TOP + .01, BZ0 + BD / 2, 22, "#7fa8c6");
boardTop.rotation.x = -Math.PI / 2;

/* หลอด GM บนที่จับ */
box(8, 2, 7, dark, XW + 6, TOP + 1, ZL);
const gmStand = box(1, 8, 1.2, teal, XW + 6, TOP + 6, ZL); gmStand.castShadow = true;
const gmBody = cyl(1.6, 13, metal, XW + 6.5, 11, ZL); gmBody.rotation.z = Math.PI / 2;
const gmFace = cyl(1.5, .25, std(0x2b1f18, {roughness: .4}), XW, 11, ZL); gmFace.rotation.z = Math.PI / 2;
const GM_END = [XW + 13, 11, ZL];
const gmEnd = new THREE.Mesh(new THREE.SphereGeometry(.65, 12, 10), new THREE.MeshStandardMaterial({color: 0x2b3238, roughness: .4, emissive: 0xd9a93f, emissiveIntensity: 0})); gmEnd.position.set(...GM_END); scene.add(gmEnd);
const hitSphere = (p, r) => { const h = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({visible: false})); h.position.set(...p); scene.add(h); return h; };
const jackHit = hitSphere(JACK, 2.2), gmHit = hitSphere(GM_END, 2.6);

/* สายสัญญาณ */
const curve = new THREE.CatmullRomCurve3([v3(...GM_END), v3(XW + 17, 8, ZL + 1), v3(XW + 10, 2.2, ZL + 15), v3(8, 2.2, ZL + 15), v3(JACK[0] + 1, 2.2, FRONT + 8), v3(JACK[0], JACK[1] - 1, FRONT + 3), v3(...JACK)]);
const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 90, .22, 8, false), std(0x15181c, {roughness: .55})); cable.castShadow = true; cable.visible = false; scene.add(cable);

/* หลอดตัวอย่างบนที่จับ */
function v3(...a) { return new THREE.Vector3(...a); }
const sampleG = new THREE.Group(); sampleG.position.set(XW - S.d, 0, ZL); scene.add(sampleG);
box(7, 2, 7, dark, -.8, TOP + 1, 0, sampleG);
box(.5, 16, 6, navy, -2.6, TOP + 9.5, 0, sampleG);
box(2.4, .9, 1.2, teal, -1.2, 15.5, 0, sampleG);
const clampRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, .25, 10, 24), std(0xc2486b, {roughness: .4})); clampRing.rotation.x = Math.PI / 2; clampRing.position.y = 15.5; sampleG.add(clampRing);
const glass = new THREE.MeshPhysicalMaterial({color: 0xcfe0e6, transparent: true, opacity: .32, roughness: .06, depthWrite: false, side: THREE.DoubleSide});
const tube = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 15, 24, 1, true), glass); tube.position.y = 11.5; tube.renderOrder = 2; sampleG.add(tube);
const bottom = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), glass); bottom.position.y = 4; bottom.renderOrder = 2; sampleG.add(bottom);
const liquid = cyl(.86, 6, new THREE.MeshStandardMaterial({color: 0xd8a2b6, transparent: true, opacity: .78, roughness: .2}), 0, 7, 0, sampleG); liquid.castShadow = false;
const capsule = cyl(.7, 1.6, metal, 0, 4.2, 0, sampleG); capsule.visible = liquid.visible = false;
const sampleHit = new THREE.Mesh(new THREE.BoxGeometry(9, 20, 8), new THREE.MeshBasicMaterial({visible: false})); sampleHit.position.set(-.8, 10, 0); sampleG.add(sampleHit);

/* ---------- ป้ายกำกับ ---------- */
const free = () => S.cam === "free";
addLabel("Input", () => v3(JACK[0], JACK[1] + 2.4, JACK[2]), () => free() && S.step === 2, "math");
addLabel("หลอด GM", () => v3(XW + 7, 15, ZL), () => free() && S.step === 2);
addLabel("กดเพื่อต่อสาย", () => v3(JACK[0] + 2, JACK[1] - 3, JACK[2] + 4), () => free() && S.step === 2 && !S.wired, "hint");
addLabel("ลากที่จับให้ห่างหลอด GM 5 cm", () => v3(XW - S.d - 2, 22, ZL), () => free() && S.step === 2 && Math.abs(S.d - 5) > .5, "hint");
const dLabel = addLabel("", () => v3(XW - S.d / 2, TOP + 1, ZL + 5), () => free() && (S.step === 2 || S.step === 4), "math");
addLabel("กด Start", () => v3(px(5), py(13.8) - 3, FRONT + 2), () => free() && (S.step === 3 || S.step === 5) && S.run === "idle" && !ok[S.step](), "hint");
addLabel("ใส่ตัวอย่างที่หลอดนี้", () => v3(XW - S.d, 21, ZL), () => free() && S.step === 4 && !S.placed, "hint");

/* ---------- มุมกล้อง ---------- */
const VIEW = {wide: {p: [18, 54, 112], l: [16, 8, 8]}, board: {p: [26, 42, 64], l: [24, 6, 12]}, counter: {p: [-14, 26, 62], l: [-13, 10, 6]}};
const STEP_VIEW = {2: "board", 3: "counter", 4: "board"};
function setFree(name) { const f = VIEW[name]; S.cam = "free"; const l = v3(...f.l); core.tween(l.clone().add(aspectFit(v3(...f.p).sub(l))), l, 40); }
const camForStep = () => setFree(STEP_VIEW[S.step] || "wide");

/* ---------- การคลิกและลากในฉาก ---------- */
const hitPt = new THREE.Vector3(), planeTable = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), ray = core.ray;
function hitTarget() {
  if (S.cam !== "free") return null;
  if (S.step === 2) {
    if (ray.intersectObjects([jackHit, gmHit])[0]) return {t: "wire"};
    if (ray.intersectObject(sampleHit)[0]) return {t: "drag"};
  }
  if (S.step === 4 && ray.intersectObject(sampleHit)[0]) return {t: "place"};
  if (S.step === 3 || S.step === 5) {
    if (ray.intersectObject(startBtn)[0]) return {t: "start"};
    if (ray.intersectObject(resetBtn)[0]) return {t: "reset"};
    if (ray.intersectObject(gateK)[0]) return {t: "gate"};
  }
  return null;
}
core.interact({
  hitTest: hitTarget,
  onDown(h) {
    if (h.t === "wire") setWired(!S.wired);
    else if (h.t === "place") setPlaced(!S.placed);
    else if (h.t === "start") startStop();
    else if (h.t === "reset") resetCounter();
    else if (h.t === "gate") setGate(GATES[(GATES.findIndex(g => g.k === S.gate) + 1) % GATES.length].k);
    else if (h.t === "drag") { ray.ray.intersectPlane(planeTable, hitPt); return {x0: hitPt.x, d0: S.d}; }
    return null;
  },
  onDrag(d) { if (ray.ray.intersectPlane(planeTable, hitPt)) setD(clamp(Math.round((d.d0 - (hitPt.x - d.x0)) * 10) / 10, 2, 15)); }
});

/* ---------- การกระทำ ---------- */
function setWired(v) { S.wired = v; panel.notice = ""; changed(true); }
function setD(v) { if (v === S.d) return; S.d = v; panel.live(); }
function clearRun() { S.reads = []; S.fit = null; S.t = 0; S.run = "idle"; S.skip = null; S.n = 0; }
function setPlaced(v) {
  if (v === S.placed) return;
  S.placed = v; if (!v && S.reads.length) { clearRun(); panel.notice = "เอาตัวอย่างออก จึงล้างข้อมูลการนับ"; } else panel.notice = "";
  if (v) S.t = 0;
  changed(true);
}
function setSample(k) {
  if (k === S.sample) return;
  const had = S.reads.length > 0; S.sample = k; clearRun(); panel.notice = had ? "เปลี่ยนสาร จึงล้างข้อมูลการนับ" : ""; changed(true);
}
function setGate(k) { if (S.run === "count") S.run = "idle"; S.gate = k; panel.notice = ""; changed(true); }
function resetCounter() {
  if (S.run === "hold" || S.run === "skip") return say("กดบันทึกจำนวนนับรอบนี้ก่อน", true);
  S.n = 0; S.run = "idle"; S.clean = true; panel.notice = ""; changed(true);
}
function beginRound() { S.t = S.reads.length * smp().step; S.n = 0; S.left = GATE; S.run = "count"; S.clean = true; }
function startStop() {
  if (!S.wired) return say("ยังไม่ได้ต่อหลอด GM เข้า Input", true);
  if (S.run === "count") { if (S.step === 5) S.n = 0; S.run = "idle"; panel.notice = ""; return changed(true); }
  if (S.run === "hold" || S.run === "skip") return;
  if (S.step === 5) {
    if (S.gate !== "auto") return say("ตั้ง Gate เป็น Auto 10 s", true);
    if (fullReads()) return say("บันทึกครบ 16 รอบแล้ว", false);
    panel.notice = ""; beginRound(); return changed(true);
  }
  S.clean = S.n === 0; S.gateUsed = S.gate; S.left = GATE_OF[S.gate].s; S.run = "count"; panel.notice = ""; changed(true);
}
function recordBg() {
  if (S.placed) return say("ต้องเอาตัวอย่างออกก่อนวัดพื้นหลัง", true);
  if (S.run !== "done" || S.gateUsed !== "100") return say("ตั้ง Gate 100 s แล้วนับให้จบก่อน", true);
  if (!S.clean) return say("กด Reset ก่อน Start เพื่อให้เริ่มนับจาก 0", true);
  S.bgN = S.n; S.fit = null; panel.notice = ""; changed(true);
}
function recordRead() {
  if (S.run !== "hold") return;
  S.reads.push({t: S.reads.length * smp().step, n: S.n});
  S.fit = null; panel.notice = "";
  if (fullReads()) { S.run = "done"; return changed(true); }
  const to = S.reads.length * smp().step;
  S.skip = {from: S.t, to, age: 0}; S.run = "skip"; changed(true);
}
function finishCount() {
  S.left = 0;
  if (S.step === 5 && S.gate === "auto") S.run = "hold"; else S.run = "done";
  changed(true);
}

const AUTO = {
  1() { PRED.forEach(q => { if (!S.pred[q.k]) S.pred[q.k] = "skip"; }); },
  2() { S.wired = true; S.d = 5; },
  3() { S.placed = false; S.gate = "100"; S.gateUsed = "100"; S.bgN = poisson(meanCounts(null, 0, 100)); S.n = S.bgN; S.run = "done"; S.clean = true; },
  4() { S.placed = true; S.t = 0; },
  5() {
    S.gate = "auto"; S.skip = null;
    while (!fullReads()) { const t = S.reads.length * smp().step; S.reads.push({t, n: poisson(meanCounts(smp(), t, GATE, S.d))}); }
    S.t = S.reads[N_READ - 1].t; S.n = S.reads[N_READ - 1].n; S.run = "done"; S.fit = null;
  },
  6() {},
  7() { if (fullReads() && S.bgN != null) S.fit = analyze(smp(), S.reads, bg10()); },
  8() {}
};

/* ---------- ส่วนควบคุมในแผง ---------- */
const stateText = () => ({idle: "พร้อมนับ", count: "กำลังนับ", hold: "นับครบรอบ รอบันทึก", skip: "กำลังเร่งเวลา", done: "นับเสร็จ"})[S.run];
const counterHTML = () => `<div class="field"><label>Gate</label><div class="chips">${GATES.map(g => `<button type="button" class="chip gatepick ${S.gate === g.k ? "on" : ""}" data-k="${g.k}">${g.label}</button>`).join("")}</div></div>
  <div class="rows"><button type="button" id="cStart">${S.run === "count" ? "Stop" : "Start"}</button><button type="button" id="cReset">Reset</button></div>
  <div class="calc"><div><span>จำนวนนับ</span><span class="v" id="rdN"></span></div><div><span>สถานะ</span><span class="v" id="rdS"></span></div></div>`;
function bindCounter() {
  $("body").querySelectorAll(".gatepick").forEach(b => b.onclick = () => setGate(b.dataset.k));
  $("cStart").onclick = startStop; $("cReset").onclick = resetCounter;
}

/* ---------- กราฟ ---------- */
function niceStep(range) { const r = range / 5, p = 10 ** Math.floor(Math.log10(r)), m = r / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
function plot(id, {xr, yr, xl, yl, series, height = 170}) {
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
  g.strokeStyle = "#1b2026"; g.beginPath(); g.moveTo(L, h - B); g.lineTo(w - R, h - B); g.moveTo(L, T); g.lineTo(L, h - B); g.stroke();
  g.fillStyle = "#1b2026"; g.textAlign = "center"; g.textBaseline = "bottom"; g.fillText(xl, (L + w - R) / 2, h - 3);
  g.save(); g.translate(11, (T + h - B) / 2); g.rotate(-Math.PI / 2); g.textBaseline = "middle"; g.fillText(yl, 0, 0); g.restore();
  g.save(); g.beginPath(); g.rect(L, T, w - L - R, h - T - B); g.clip();
  series.forEach(s => {
    g.strokeStyle = g.fillStyle = s.color; g.lineWidth = 1.6;
    if (s.line) { g.beginPath(); s.pts.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.stroke(); }
    if (s.dots) s.pts.forEach(([x, y]) => { g.beginPath(); g.arc(X(x), Y(y), 3.2, 0, 6.3); g.fill(); });
  });
  g.restore();
}
const xMax = () => (N_READ - 1) * smp().step / smp().sec * 1.04;
function drawCounts() {
  const s = smp(), pts = S.reads.map(r => [r.t / s.sec, r.n]);
  plot("graph", {xr: [0, xMax()], yr: [0, Math.max(100, ...S.reads.map(r => r.n)) * 1.12], xl: `t (${s.unit})`, yl: "N ต่อ 10 s", series: [{pts, dots: true, color: "#1b2026"}]});
}
function drawLn() {
  const s = smp(), rows = netRows(S.reads, bg10()).filter(r => r.ln != null), pts = rows.map(r => [r.t / s.sec, r.ln]), series = [{pts, dots: true, color: "#1b2026"}];
  if (S.fit) { const e = xMax(); series.unshift({pts: [[0, S.fit.c], [e, S.fit.m * e + S.fit.c]], line: true, color: "#80590a"}); }
  const ys = pts.map(p => p[1]);
  plot("graph2", {xr: [0, xMax()], yr: [Math.floor(Math.min(...ys, 3)), Math.ceil(Math.max(...ys, 7))], xl: `t (${s.unit})`, yl: "ln(N − B)", series});
}
const redraw = () => { const n = S.step; if (n === 5) drawCounts(); else if (n === 7) { drawCounts(); drawLn(); } };

/* ---------- เนื้อหาขั้นตอน ---------- */
const PRED = [
  {k: "h1", q: "ผ่านไป 1 ครึ่งชีวิต จำนวนนับ (หักพื้นหลังแล้ว) จะเหลือ"},
  {k: "h2", q: "ผ่านไป 2 ครึ่งชีวิต จำนวนนับ (หักพื้นหลังแล้ว) จะเหลือ"}
];
const PRED_OPT = {half: "ครึ่งหนึ่ง", quarter: "หนึ่งในสี่", none: "ไม่เหลือเลย"};
const m = t => `<i class="m">${t}</i>`, half = `${m("T")}<sub>½</sub>`;
const STEPS = {
  1: {t: "ทำนายผล", doc: "ก่อนทดลอง ลองทำนายว่าจำนวนนับจะลดลงอย่างไร ไม่คิดคะแนน แล้วกลับมาเทียบในขั้นสุดท้าย",
    html: () => PRED.map(q => `<div class="pred"><span>${q.q}</span><div class="chips">${Object.entries(PRED_OPT).map(([v, t]) => `<button type="button" class="chip prd ${S.pred[q.k] === v ? "on" : ""}" data-q="${q.k}" data-v="${v}">${t}</button>`).join("")}</div></div>`).join(""),
    bind() { $("body").querySelectorAll(".prd").forEach(b => b.onclick = () => { S.pred[b.dataset.q] = b.dataset.v; changed(true); }); },
    live() { const n = PRED.filter(q => S.pred[q.k]).length; return n === PRED.length ? ["yes", "ทำนายครบแล้ว"] : ["no", `ตอบแล้ว ${n} จาก ${PRED.length} ข้อ`]; }},
  2: {t: "จัดอุปกรณ์", doc: "ต่อหลอด GM เข้าขั้ว Input ของเครื่องนับ แล้วตั้งหลอดตัวอย่างให้ห่างหลอด GM 5 cm",
    html: () => `<button type="button" class="big ${S.wired ? "on" : ""}" id="wire">${S.wired ? "ถอดสาย" : "ต่อหลอด GM เข้า Input"}</button>
      <div class="field"><label for="dS">ระยะจากหลอด GM <output id="dO"></output></label><input id="dS" type="range" min="2" max="15" step="0.1"></div>
      <p class="note">ลากที่จับหลอดตัวอย่างในฉาก หรือใช้แถบเลื่อน อ่านระยะจากสเกลบนแผ่นฐาน</p>`,
    bind() { $("wire").onclick = () => setWired(!S.wired); $("dS").oninput = e => setD(+e.target.value); },
    live() { return !S.wired ? ["no", "ยังไม่ได้ต่อหลอด GM เข้า Input"] : ok[2]() ? ["yes", `จัดอุปกรณ์แล้ว ระยะ ${fmt(S.d)} cm`] : ["no", `ตอนนี้ระยะ ${fmt(S.d)} cm ต้องอยู่ราว 5 cm`]; }},
  3: {t: "วัดรังสีพื้นหลัง", doc: "ขณะยังไม่มีตัวอย่าง ตั้ง Gate 100 s กด Reset และ Start เมื่อนับจบให้บันทึกจำนวนนับ",
    html: () => `${counterHTML()}<div class="rows">${S.placed ? `<button type="button" id="takeOut">เอาตัวอย่างออก</button>` : ""}<button type="button" id="recB" class="${S.run === "done" && S.bgN == null ? "main" : ""}">บันทึกค่าพื้นหลัง</button></div>
      ${S.bgN != null ? `<div class="calc"><div><span>พื้นหลังใน 100 s</span><span class="v">${S.bgN}</span></div><div class="res"><span>${m("B")} ต่อ 10 s</span><span class="v">${fmt(bg10())}</span></div></div>` : ""}
      <p class="note">แหล่งรังสีตามธรรมชาติทำให้เครื่องนับได้แม้ไม่มีตัวอย่าง การนับนานขึ้นช่วยให้ค่าพื้นหลังแม่นขึ้น</p>`,
    bind() { bindCounter(); $("recB").onclick = recordBg; const t = $("takeOut"); if (t) t.onclick = () => setPlaced(false); },
    live() { return S.bgN != null ? ["yes", `บันทึกแล้ว B = ${fmt(bg10())} ต่อ 10 s`] : ["no", S.run === "count" ? "กำลังนับ" : "ยังไม่ได้บันทึกค่าพื้นหลัง"]; }},
  4: {t: "เลือกและใส่ตัวอย่าง", doc: "เลือกสารที่จะศึกษา แล้วใส่ตัวอย่างลงบนที่จับ",
    html: () => `<p class="warn">ของจริงต้องใช้ถุงมือ คีมคีบ ถาดรองกันหก และอยู่ภายใต้การดูแลของครู ในเว็บเป็นตัวอย่างจำลอง จึงไม่มีรังสีจริง</p>
      <div class="field"><label>สารตัวอย่าง</label><div class="chips">${SAMPLES.map(s => `<button type="button" class="chip smppick ${S.sample === s.k ? "on" : ""}" data-k="${s.k}">${s.name}</button>`).join("")}</div></div>
      <table class="read"><thead><tr><th>สาร</th><th>ครึ่งชีวิต</th><th>เว้นระยะแต่ละรอบ</th></tr></thead><tbody>${SAMPLES.map(s => `<tr class="${S.sample === s.k ? "cur" : ""}"><td>${s.name}</td><td>${s.half}</td><td>${Number((s.step / s.sec).toFixed(1))} ${s.unit}</td></tr>`).join("")}</tbody></table>
      <button type="button" class="big ${S.placed ? "on" : ""}" id="place">${S.placed ? "เอาตัวอย่างออก" : "ใส่ตัวอย่าง"}</button>
      <p class="note">${S.sample === "ba" ? "Ba-137m เป็นของเหลวในหลอดทดลอง" : "สารครึ่งชีวิตยาวถือเป็นต้นกำเนิดแบบปิดผนึกที่วางตำแหน่งเดียวกัน"} ทุกสารตั้งต้นที่อัตรานับราว 60 นับต่อวินาที</p>`,
    bind() { $("body").querySelectorAll(".smppick").forEach(b => b.onclick = () => setSample(b.dataset.k)); $("place").onclick = () => setPlaced(!S.placed); },
    live() { return S.placed ? ["yes", `ใส่ ${smp().name} แล้ว`] : ["no", "ยังไม่ได้ใส่ตัวอย่าง"]; }},
  5: {t: "นับการสลาย", doc: "ตั้ง Gate เป็น Auto 10 s กด Start แล้วบันทึกจำนวนนับทุกรอบ จนครบ 16 ค่า",
    html: () => `${counterHTML()}<div class="rows"><button type="button" id="recN" class="${S.run === "hold" ? "main" : ""}" ${S.run === "hold" ? "" : "disabled"}>บันทึกจำนวนนับรอบนี้</button></div>
      <div class="calc"><div><span>เวลาหลังใส่ตัวอย่าง</span><span class="v" id="skipT"></span></div><div><span>รอบที่บันทึกแล้ว</span><span class="v">${S.reads.length} / ${N_READ}</span></div></div>
      <canvas id="graph" class="graph"></canvas>
      <p class="note">แต่ละรอบนับ 10 s ตามจริง แสดงผลเร็วขึ้น 10 เท่า ระหว่างรอบเว็บเร่งเวลาข้ามไปรอบถัดไป และหยุดรอให้บันทึก ซึ่งของจริงทำไม่ได้</p>`,
    bind() { bindCounter(); $("recN").onclick = recordRead; drawCounts(); },
    live() { return fullReads() ? ["yes", "บันทึกครบ 16 รอบแล้ว"] : ["no", `บันทึกแล้ว ${S.reads.length} จาก ${N_READ} รอบ`]; }},
  6: {t: "หักรังสีพื้นหลัง", doc: "หักค่าพื้นหลังออกจากจำนวนนับแต่ละรอบ แล้วหาค่า ln(N − B)",
    html: () => { const s = smp(), rows = netRows(S.reads, bg10()); return `<div class="calc"><div><span>${m("B")} ต่อ 10 s</span><span class="v">${fmt(bg10())}</span></div></div>
      <div style="overflow-x:auto"><table class="read"><thead><tr><th>t (${s.unit})</th><th>N</th><th>N − B</th><th>ln(N − B)</th></tr></thead><tbody>${rows.map(r => `<tr><td>${Number((r.t / s.sec).toFixed(1))}</td><td>${r.n}</td><td>${fmt(r.net)}</td><td>${r.ln != null ? r.ln.toFixed(3) : "–"}</td></tr>`).join("")}</tbody></table></div>`; },
    live() { return ok[6]() ? ["yes", "คำนวณครบทุกรอบแล้ว"] : ["no", "ต้องมีค่าจากขั้นที่ 3 และ 5 ก่อน"]; }},
  7: {t: "พล็อตและคำนวณ", doc: "พล็อต N กับ t และ ln(N − B) กับ t ความชันของเส้นตรงคือ −λ แล้วหาครึ่งชีวิตจาก ln 2 / λ",
    html: () => { const r = S.fit, u = smp().unit; return `<canvas id="graph" class="graph"></canvas><canvas id="graph2" class="graph"></canvas>
      <div class="rows"><button type="button" id="doFit">คำนวณความชันจากข้อมูล</button></div>
      ${r ? `<div class="calc">
       <div><span>ความชันของ ln(N − B) กับ t</span><span class="v">${r.m.toPrecision(4)} ต่อ${u === "s" ? "วินาที" : u}</span></div>
       <div><span>λ = −ความชัน</span><span class="v">${r.lam.toPrecision(4)} ต่อ${u === "s" ? "วินาที" : u}</span></div>
       <div class="res"><span>${half} = ln 2 ÷ λ</span><span class="v">${r.half.toFixed(u === "s" ? 1 : 2)} ${u}</span></div>
       <div><span>ค่าอ้างอิง ${half}</span><span class="v">${r.trueHalf.toFixed(u === "s" ? 0 : 2)} ${u}</span></div>
       <div><span>ความคลาดเคลื่อน</span><span class="v">${r.errPct >= 0 ? "+" : "−"}${Math.abs(r.errPct).toFixed(1)}%</span></div>
      </div><p class="note">ผลแกว่งตามธรรมชาติของการสุ่ม ทดลองซ้ำอาจได้ค่าต่างออกไปเล็กน้อย ปกติคลาดไม่เกินราว 10%</p>` : ""}`; },
    bind() { $("doFit").onclick = () => { if (!ok[6]()) return say("ต้องมีข้อมูลครบจากขั้นที่ 3 และ 5", true); S.fit = analyze(smp(), S.reads, bg10()); changed(true); }; redraw(); },
    live() { return S.fit ? ["yes", `ได้ครึ่งชีวิต ${S.fit.half.toFixed(smp().unit === "s" ? 1 : 2)} ${smp().unit}`] : ["no", "กดคำนวณความชัน"]; }},
  8: {t: "สรุป", doc: "เทียบผลที่วัดได้กับคำทำนายในขั้นแรก แล้วตอบคำถามท้ายการทดลอง",
    html: () => {
      const s = smp(), rows = netRows(S.reads, bg10() ?? 0), show = k => ({...PRED_OPT, skip: "ไม่ได้ทำนาย"})[S.pred[k]] || "–";
      const at = h => { const i = Math.round(h * s.T / s.step), r = rows[i], r0 = rows[0]; return r && r0 && r0.net > 0 ? `t = ${tText(r.t)}: เหลือ ${(r.net / r0.net).toFixed(2)} เท่า` : "–"; };
      return `<table class="read"><thead><tr><th>ผ่านไป</th><th>คำทำนาย</th><th>ผลที่วัดได้</th></tr></thead><tbody>
      <tr><td class="c">1 ครึ่งชีวิต</td><td class="c">${show("h1")}</td><td>${at(1)}</td></tr>
      <tr><td class="c">2 ครึ่งชีวิต</td><td class="c">${show("h2")}</td><td>${at(2)}</td></tr></tbody></table>
      <p class="task">คำถามท้ายการทดลอง</p><ol class="qs"><li>ทำไมต้องหักรังสีพื้นหลังก่อนพล็อตกราฟ</li><li>ทำไมจำนวนนับสองรอบที่เวลาใกล้กันจึงไม่ลดลงเรียบเสมอไป</li><li>ถ้าย้ายหลอด GM ให้ไกลขึ้น จำนวนนับและครึ่งชีวิตจะเปลี่ยนหรือไม่ อย่างไร</li><li>หลังผ่านไป 10 ครึ่งชีวิต นิวเคลียสที่ยังไม่สลายเหลือสัดส่วนเท่าไร</li><li>ถ้าใช้สารครึ่งชีวิต 30 ปี และนับจริงแค่ 8 นาที จะหาครึ่งชีวิตจากการทดลองแบบนี้ได้หรือไม่ เพราะอะไร</li></ol>`;
    },
    live() { return ["yes", "จบการทดลอง"]; }}
};

/* ---------- แผงขั้นตอน ---------- */
const panel = createPanel({
  steps: STEPS, ok, auto: AUTO, docLabel: "วิธีทดลอง",
  getStep: () => S.step, setStep: n => { S.step = n; },
  finishLabel: "ดูตารางบันทึกผล",
  onFinish: () => toggleSheet(true),
  beforeGoTo() { panel.notice = ""; if (S.run === "count" || S.run === "hold" || S.run === "skip") { S.run = "idle"; S.skip = null; S.n = 0; } },
  onEnter() { camForStep(); },
  afterRender() { if (S.sheet) renderSheet(); },
  afterLive() { syncInputs(); syncReadout(true); }
});

function syncInputs() { const d = $("dS"); if (d) { d.value = S.d; $("dO").textContent = fmt(S.d) + " cm"; } dLabel.el.textContent = `${fmt(S.d)} cm`; }
let lastHud = "";
function syncReadout(force) {
  const n = String(Math.min(9999, S.n)).padStart(4, "0"); setCount(n);
  const rn = $("rdN"); if (rn) { rn.textContent = n; $("rdS").textContent = stateText(); }
  const st = $("skipT"); if (st) st.textContent = tText(S.t);
  const hud = [];
  if (S.step >= 2) hud.push(`ระยะ ${fmt(S.d)} cm`);
  if (S.step >= 3) hud.push(S.placed ? smp().name : "ไม่มีตัวอย่าง", `N = ${n}`);
  if (S.run === "skip") hud.push(`เร่งเวลา: ${tText(S.t)}`); else if (S.step === 5) hud.push(`t = ${tText(S.t)}`);
  const str = hud.join("|"); if (force || str !== lastHud) { lastHud = str; $("hud").innerHTML = hud.map(h => `<span>${h}</span>`).join(""); }
}
function renderSheet() {
  const s = smp(), rows = netRows(S.reads, bg10() ?? 0), r = S.fit, u = s.unit;
  $("sheetMeta").innerHTML = `<span>สาร <b>${s.name}</b></span><span>ระยะ <b>${fmt(S.d)}</b> cm</span><span>พื้นหลัง B = <b>${S.bgN == null ? "–" : fmt(bg10())}</b> ต่อ 10 s</span>`;
  $("sheetWrap").innerHTML = `<table class="full" style="min-width:420px"><thead><tr><th>t (${u})</th><th>N</th><th>N − B</th><th>ln(N − B)</th></tr></thead><tbody>${rows.map(p => `<tr><td>${Number((p.t / s.sec).toFixed(1))}</td><td>${p.n}</td><td>${fmt(p.net)}</td><td>${p.ln != null ? p.ln.toFixed(3) : "–"}</td></tr>`).join("") || `<tr><td class="s" colspan="4">ยังไม่มีค่าที่บันทึก เริ่มนับได้ในขั้นที่ 5</td></tr>`}</tbody></table>
    ${r ? `<p>λ = ${r.lam.toPrecision(4)} ต่อ${u === "s" ? "วินาที" : u} &nbsp; T½ = ${r.half.toFixed(u === "s" ? 1 : 2)} ${u} &nbsp; ค่าอ้างอิง ${r.trueHalf.toFixed(u === "s" ? 0 : 2)} ${u} &nbsp; คลาดเคลื่อน ${r.errPct.toFixed(1)}%</p>` : ""}`;
}
function toggleSheet(v) { S.sheet = v; $("sheet").hidden = !v; if (v) renderSheet(); }

/* เสียงนับ ปิดเป็นค่าเริ่มต้น */
let audio = null;
function clickSound() {
  const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
  o.frequency.value = 1900; g.gain.setValueAtTime(.1, t); g.gain.exponentialRampToValueAtTime(.001, t + .014);
  o.connect(g).connect(audio.destination); o.start(t); o.stop(t + .016);
}
$("sound").onclick = () => {
  if (audio) { audio.close(); audio = null; } else audio = new (window.AudioContext || window.webkitAudioContext)();
  $("sound").textContent = audio ? "เสียงนับ: เปิด" : "เสียงนับ: ปิด";
};
$("openSheet").onclick = () => toggleSheet(!S.sheet);
$("closeSheet").onclick = () => toggleSheet(false);
$("reset").onclick = () => { S = START(); setFree("wide"); panel.render(); toggleSheet(false); };
addEventListener("resize", redraw);

/* ---------- ทุกเฟรม ---------- */
let flash = 0;
function frame(dt, k, kFast) {
  sampleG.position.x += (XW - S.d - sampleG.position.x) * kFast;
  gateG.rotation.z += (-gateAngle(GATES.findIndex(g => g.k === S.gate)) - gateG.rotation.z) * kFast;
  cable.visible = S.wired;
  jack.material.emissiveIntensity = gmEnd.material.emissiveIntensity = S.step === 2 && !S.wired ? .7 : 0;
  liquid.visible = S.placed && S.sample === "ba"; capsule.visible = S.placed && S.sample !== "ba";
  flash = Math.max(0, flash - dt * 12);
  led.material.emissiveIntensity = (S.run === "count" ? .25 : 0) + flash * 2.2;

  if (S.run === "count") {
    const g = Math.min(S.left, dt * SPEED), elapsed = S.step === 5 ? GATE - S.left : 0;
    const inc = S.wired ? poisson(meanCounts(S.placed ? smp() : null, S.t + elapsed, g, S.d)) : 0;
    S.n = Math.min(9999, S.n + inc); S.left -= g;
    if (inc > 0) { flash = 1; if (audio) clickSound(); }
    if (S.left <= 1e-9) finishCount(); else syncReadout(false);
  } else if (S.run === "skip") {
    const sk = S.skip; sk.age += dt;
    S.t = sk.from + (sk.to - sk.from) * Math.min(1, sk.age / SKIP_SEC);
    if (sk.age >= SKIP_SEC) { S.skip = null; beginRound(); changed(true); } else syncReadout(false);
  }
}

core.resize(); setFree("wide"); panel.render(); core.start(frame);

/* จุดเข้าถึงสำหรับทดสอบอัตโนมัติ */
window.__lab = {get S() { return S; }, goTo: panel.goTo, AUTO, SAMPLE, setSample, setD, setPlaced, setWired, bg10};
