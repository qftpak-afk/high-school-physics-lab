/* กิจกรรม 1 การศึกษาสเปกตรัมของแก๊สร้อน: สถานะ ขั้นตอน ฉากอุปกรณ์ และตาราง
   ส่วนกลาง (renderer กล้อง ป้าย แผงขั้นตอน) อยู่ใน shared/lab-core.js */
import {$, clamp, fmt, reduce, createScene, createPanel} from "../../../shared/lab-core.js";
import {GAS, TUBES, dCm, lineX, solve, wlAt, trueReading, wl2rgb, cssWl} from "./physics.js";

const THREE = window.THREE;

/* ---------- สถานะ ---------- */
const START = () => ({step: 1, gas: null, err: -13, tilt: 5, D: 45, lpi: 13400, on: false, phi: 32, naked: false, focus: null, R: {}, seen: [], calc: null, cam: "free", sheet: false});
let S = START();

const ok = {
  1: () => !!S.gas,
  2: () => Math.abs(S.err) <= .5 && Math.abs(S.tilt) <= .5,
  3: () => S.D >= 95 && S.D <= 105,
  4: () => S.on && Math.abs(S.phi) <= 1.5,
  5: () => TUBES.some(g => fullRows(g) === 3),
  6: () => TUBES.some(g => fullRows(g) > 0),
  7: () => S.seen.length >= 2
};
function fullRows(g) { const r = S.R[g]; if (!r) return 0; return GAS[g].read.filter((_, i) => r[i] && r[i].L != null && r[i].R != null).length; }
const reading = (g, i, side) => trueReading(GAS[g].read[i].nm, side, S);
function rowCalc(g, i) {
  const r = (S.R[g] || {})[i]; if (!r || r.L == null || r.R == null) return null;
  const xL = Math.abs(r.L - 50), xR = Math.abs(r.R - 50), xbar = (xL + xR) / 2;
  return {xL, xR, xbar, ...solve(xbar, S.D, S.lpi)};
}
function clearReadings() { if (Object.keys(S.R).length) { S.R = {}; S.calc = null; return true; } return false; }

/* ---------- ฉาก ---------- */
const core = createScene({isFree: () => S.cam === "free"});
const {scene, camera, hemi, key, tw, std, box, cyl, canvasTex, aspectFit, addLabel} = core;

const tubeLight = new THREE.PointLight(0xffffff, 0, 140, 1.6); tubeLight.position.set(0, 25, -3); scene.add(tubeLight);

/* โต๊ะและผนัง */
const tableMat = std(0xa9ada8, {roughness: .9}), wallMat = std(0xd3d6d1, {roughness: 1}), floorMat = std(0xb4b7b3);
box(300, 3, 190, tableMat, 18, -1.5, 55);
box(1600, 700, 2, wallMat, 0, 300, -42);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = -80; scene.add(floor);

/* ชุดจ่ายไฟ */
const psu = new THREE.Group(); psu.position.set(0, 0, -6); scene.add(psu);
box(18, 9, 12, std(0x39424c, {roughness: .55, metalness: .2}), 0, 4.5, 0, psu);
const plate = new THREE.Mesh(new THREE.PlaneGeometry(11, 3.2), new THREE.MeshStandardMaterial({map: canvasTex(352, 102, (g, w, h) => {
  g.fillStyle = "#1a1f25"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#e9ebe6"; g.font = "600 26px Arial"; g.fillText("SPECTRUM TUBE", 14, 38);
  g.fillStyle = "#d9a93f"; g.font = "600 22px Arial"; g.fillText("HIGH VOLTAGE", 14, 76);
}), roughness: .6}));
plate.position.set(2.6, 5, 6.02); psu.add(plate);
const switchBase = box(3, 3, .3, std(0x15181c), -6, 5, 6.1, psu);
const toggle = box(1, 2.2, 1, std(0xc9412d, {roughness: .4}), -6, 5, 6.6, psu);
const led = new THREE.Mesh(new THREE.SphereGeometry(.42, 16, 12), new THREE.MeshStandardMaterial({color: 0x3a1512, emissive: 0xff2a14, emissiveIntensity: 0}));
led.position.set(-6, 8, 6); psu.add(led);
const metal = std(0x8d959c, {metalness: .8, roughness: .35});
box(1.6, 44, 1.6, std(0x2c3238, {metalness: .4, roughness: .5}), 0, 29, -4.6, psu);
box(1.6, 1.6, 5.4, std(0x2c3238, {metalness: .4, roughness: .5}), 0, 41.3, -2, psu);
cyl(1.15, 2, metal, 0, 40.2, 0, psu); cyl(1.15, 2, metal, 0, 9.8, 0, psu);

/* ชั้นวางหลอด: อยู่นอกมุมมองผ่านเกรตติง */
const rackWood = std(0x6d4c2b, {roughness: .8});
box(38, 1.4, 7, rackWood, 92, .7, -8); box(38, 1.2, 7, rackWood, 92, 20, -8);
box(1.2, 20, 1.2, rackWood, 74, 10, -8); box(1.2, 20, 1.2, rackWood, 110, 10, -8);
const RACK = {H: [78, 16, -8], He: [86, 16, -8], Ne: [94, 16, -8], Hg: [102, 16, -8], lamp: [122, 8, -8]};
box(12, 1.4, 10, rackWood, 122, .7, -8);

const HOLDER = new THREE.Vector3(0, 25, -6);
const LIFT = 16;   // ความสูงที่ยกหลอดขึ้นระหว่างทางจากชั้นวางไปที่เสียบ (cm)
const glowTex = canvasTex(128, 128, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.25, "rgba(255,255,255,.42)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
const glass = new THREE.MeshPhysicalMaterial({color: 0x9dbcc6, transparent: true, opacity: .4, roughness: .08, metalness: 0, depthWrite: false, side: THREE.DoubleSide});
function tagTex(t) {
  return canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = "#efe9d8"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#161616"; g.font = "700 40px Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, w / 2, h / 2 + 2);
  });
}
function makeTube(k) {
  const G = GAS[k], o = new THREE.Group(); o.userData.key = k;
  const prof = [[.02, -13.6], [1, -13.4], [1.35, -12], [1.35, -10], [.9, -9], [.46, -8.2], [.46, 8.2], [.9, 9], [1.35, 10], [1.35, 12], [1, 13.4], [.02, 13.6]].map(p => new THREE.Vector2(p[0], p[1]));
  const shell = new THREE.Mesh(new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(60), 32), glass); shell.renderOrder = 2; o.add(shell);
  cyl(.75, 1.6, metal, 0, 14.2, 0, o); cyl(.75, 1.6, metal, 0, -14.2, 0, o);
  const coreMat = new THREE.MeshStandardMaterial({color: 0x777777, emissive: G.glow, emissiveIntensity: 0, transparent: true, opacity: .65});
  const core = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, 16.4, 14), coreMat); o.add(core);
  const b1 = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), coreMat); b1.scale.set(1.05, 1.9, 1.05); b1.position.y = 10.9; o.add(b1);
  const b2 = b1.clone(); b2.position.y = -10.9; o.add(b2);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex, color: G.glow, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0})); sp.scale.set(5, 27, 1); o.add(sp);
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), new THREE.MeshBasicMaterial({map: tagTex(G.sym)})); tag.position.set(0, -11, 1.5); o.add(tag);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 30, 8), new THREE.MeshBasicMaterial({visible: false})); o.add(hit);
  Object.assign(o.userData, {coreMat, sp, hit}); return o;
}
function makeLamp() {
  const G = GAS.lamp, o = new THREE.Group(); o.userData.key = "lamp";
  const shell = new THREE.Mesh(new THREE.SphereGeometry(3.4, 32, 24), glass); shell.renderOrder = 2; o.add(shell);
  cyl(1.4, 4, metal, 0, -4.4, 0, o, 1.4); cyl(1, 10, metal, 0, -11, 0, o);
  const coreMat = new THREE.MeshStandardMaterial({color: 0x666666, emissive: G.glow, emissiveIntensity: 0});
  const fil = new THREE.Mesh(new THREE.TorusGeometry(.8, .09, 8, 28, Math.PI), coreMat); o.add(fil);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex, color: G.glow, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0})); sp.scale.set(15, 15, 1); o.add(sp);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 18, 8), new THREE.MeshBasicMaterial({visible: false})); hit.position.y = -4; o.add(hit);
  Object.assign(o.userData, {coreMat, sp, hit}); return o;
}
const items = {};
[...TUBES, "lamp"].forEach(k => {
  const t = k === "lamp" ? makeLamp() : makeTube(k);
  t.position.set(...RACK[k]); t.userData.rack = new THREE.Vector3(...RACK[k]); t.userData.p = 0;   // p: 0 = ชั้นวาง, 1 = ที่เสียบ
  scene.add(t); items[k] = t;
});

/* ไม้เมตร */
const STICK = {top: 23, bot: 19.8};
const stickTex = canvasTex(4096, 132, (g, w, h) => {
  g.fillStyle = "#d4ad5b"; g.fillRect(0, 0, w, h);
  const px = w / 100;
  g.fillStyle = "#141108";
  for (let mm = 0; mm <= 1000; mm++) {
    const x = mm / 10 * px, cm = mm % 10 === 0, hf = mm % 50 === 0;
    g.fillRect(Math.round(x) - (cm ? 1 : 0), 0, cm ? 2 : 1, cm ? (mm % 100 === 0 ? 64 : 40) : hf ? 28 : 16);
  }
  g.textAlign = "center"; g.textBaseline = "alphabetic";
  for (let c = 0; c <= 100; c++) {
    const big = c % 10 === 0; g.font = (big ? "700 44px" : "500 20px") + " Arial";
    const tx = clamp(c * px, big ? 34 : 12, w - (big ? 44 : 12));
    g.fillStyle = c === 50 ? "#a51f12" : "#141108"; g.fillText(String(c), tx, big ? 118 : 66);
  }
  g.fillStyle = "#a51f12"; g.fillRect(50 * px - 2, 0, 4, 70);
});
stickTex.wrapS = THREE.ClampToEdgeWrapping;
const stick = new THREE.Group(); stick.position.y = (STICK.top + STICK.bot) / 2; scene.add(stick);
const woodMat = std(0xb08a43), faceMat = new THREE.MeshStandardMaterial({map: stickTex, emissiveMap: stickTex, emissive: 0xffffff, emissiveIntensity: 0, roughness: .72});
const stickBar = new THREE.Mesh(new THREE.BoxGeometry(100, STICK.top - STICK.bot, 2.4), [woodMat, woodMat, faceMat, woodMat, faceMat, woodMat]); stickBar.castShadow = true; stick.add(stickBar);
const stickStand = std(0x2c3238, {metalness: .4, roughness: .5});
[-42, 42].forEach(x => {
  const c = cyl(.45, 19.8, stickStand, x, -(STICK.top - STICK.bot) / 2 - 9.9, -1.9, stick); c.castShadow = true;
  box(9, 1, 7, stickStand, x, -(STICK.top - STICK.bot) / 2 - 19.3, -1.9, stick);
  box(1.2, 2.8, 1.2, stickStand, x, 0, -1.6, stick);
});

/* เกรตติง */
const grating = new THREE.Group(); scene.add(grating);
const gratMat = std(0x4a3c29);
box(7, 1, 5, gratMat, 0, .5, 0, grating); cyl(.4, 20, stickStand, 0, 10.5, 0, grating);
const gHead = new THREE.Group(); gHead.position.y = 26; grating.add(gHead);
box(7, 5.2, .25, std(0xe8e0cf), 0, 0, -.05, gHead);
const rulTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#7fb0d8"; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(10,30,60,.55)"; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 3, h); });
const gFilm = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6), new THREE.MeshStandardMaterial({map: rulTex, transparent: true, opacity: .86, roughness: .25, metalness: .3, side: THREE.DoubleSide}));
gFilm.position.z = .09; gHead.add(gFilm);
const gHit = new THREE.Mesh(new THREE.BoxGeometry(12, 30, 10), new THREE.MeshBasicMaterial({visible: false})); gHit.position.y = 14; grating.add(gHit);

/* ตลับเมตร */
const tapeTex = canvasTex(64, 512, (g, w, h) => {
  g.fillStyle = "#efc637"; g.fillRect(0, 0, w, h); g.fillStyle = "#111";
  for (let i = 0; i < 10; i++) { const y = i * h / 10; g.fillRect(0, y, i === 0 ? w : w * .45, i === 0 ? 5 : 3); }
  g.font = "700 30px Arial"; g.save(); g.translate(50, 18); g.rotate(Math.PI / 2); g.fillText("10", 0, 0); g.restore();
});
tapeTex.wrapT = THREE.RepeatWrapping;
const tape = new THREE.Mesh(new THREE.PlaneGeometry(3, 1), new THREE.MeshStandardMaterial({map: tapeTex, roughness: .5}));
tape.rotation.x = -Math.PI / 2; tape.position.set(-9, .06, 0); scene.add(tape);

/* เส้นนำสายตาที่แกนหลอด ขั้นที่ 2 */
const guide = new THREE.Mesh(new THREE.PlaneGeometry(.18, 20), new THREE.MeshBasicMaterial({color: 0xfff0b0, transparent: true, opacity: .85, depthTest: false}));
guide.position.set(0, 24, 1.4); guide.renderOrder = 6; scene.add(guide);

/* ---------- เส้นสเปกตรัม ---------- */
const lineTex = canvasTex(128, 4, (g, w, h) => {
  const d = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x - w / 2 + .5) / (w / 2), a = Math.exp(-Math.pow(u / .17, 2)) + .1 * Math.exp(-Math.pow(u / .55, 2)), i = (y * w + x) * 4;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = Math.min(255, a * 255);
  }
  g.putImageData(d, 0, 0);
});
const lineGroup = new THREE.Group(); scene.add(lineGroup);
const unitPlane = new THREE.PlaneGeometry(1, 1);
/* ส่วนที่ทับไม้เมตรหรี่ลง เพื่อให้ยังอ่านขีดได้ */
const BANDS = [[-Infinity, STICK.bot, 1], [STICK.bot, STICK.top, .42], [STICK.top, Infinity, 1]];
const lineMat = (map, color, opacity) => new THREE.MeshBasicMaterial({map, color, blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, opacity, side: THREE.DoubleSide});
function stripSeg(xc, y0, y1, w, color, opacity) {
  if (y1 <= y0) return;
  const m = new THREE.Mesh(unitPlane, lineMat(lineTex, color, opacity));
  m.scale.set(w, y1 - y0, 1); m.position.set(xc, (y0 + y1) / 2, 1.5); m.renderOrder = 5; lineGroup.add(m);
}
function addStrip(xc, yc0, yc1, w, color, op) {
  BANDS.forEach(([a, b, f]) => stripSeg(xc, Math.max(yc0, a), Math.min(yc1, b), w, color, op * f));
}

/* แถบต่อเนื่องของหลอดไฟฟ้าทั่วไป: texture เดียว สร้างใหม่เมื่อ D หรือเกรตติงเปลี่ยนเท่านั้น
   แต่ละข้างเป็นแผ่นเดียว ตัดเป็นช่วงตามไม้เมตรได้ไม่เกิน 3 ชิ้น */
const CONT_X = 70;
let contTex = null, contKey = "";
function contTexture() {
  const k = S.D + "|" + S.lpi; if (k === contKey) return contTex;
  if (contTex) contTex.dispose();
  contKey = k;
  contTex = canvasTex(768, 2, (ctx, w, h) => {
    for (let x = 0; x < w; x++) {
      const lam = wlAt((x + .5) / w * CONT_X, S.D, S.lpi);
      ctx.fillStyle = lam >= 390 && lam <= 740 ? cssWl(lam) : "#000"; ctx.fillRect(x, 0, 1, h);
    }
  });
  contTex.wrapS = THREE.ClampToEdgeWrapping;
  return contTex;
}
/* ตัดรูปหลายเหลี่ยมด้วยเส้นแนวนอน y = lim (keepAbove = เก็บส่วนที่ y ≥ lim) */
function clipY(poly, lim, keepAbove) {
  const inside = p => keepAbove ? p[1] >= lim : p[1] <= lim, out = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length], pin = inside(p), qin = inside(q);
    if (pin) out.push(p);
    if (pin !== qin) { const t = (lim - p[1]) / (q[1] - p[1]); out.push([p[0] + t * (q[0] - p[0]), lim]); }
  });
  return out;
}
function contSide(sign, tex) {
  /* แถบเลื่อนไปตามทิศ (cosφ, sinφ) เท่ากับระยะ X บนไม้เมตร เหมือนเส้นแยก */
  const c = Math.cos(S.phi * Math.PI / 180), s = Math.sin(S.phi * Math.PI / 180), ex = sign * CONT_X * c, ey = sign * CONT_X * s;
  const band = [[0, 20], [ex, 20 + ey], [ex, 30 + ey], [0, 30]];
  BANDS.forEach(([a, b, f]) => {
    let poly = band;
    if (Number.isFinite(a)) poly = clipY(poly, a, true);
    if (Number.isFinite(b) && poly.length) poly = clipY(poly, b, false);
    if (poly.length < 3) return;
    const geo = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y))));
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, Math.abs(pos.getX(i)) / (CONT_X * c), .5);
    const m = new THREE.Mesh(geo, lineMat(tex, 0xffffff, .72 * f)); m.position.z = 1.5; m.renderOrder = 5; lineGroup.add(m);
  });
}
function buildLines() {
  while (lineGroup.children.length) {
    const c = lineGroup.children.pop();
    if (c.geometry !== unitPlane) c.geometry.dispose();
    c.material.dispose();
  }
  const g = GAS[S.gas]; if (!g) return;
  if (g.continuous) { const t = contTexture(); contSide(1, t); contSide(-1, t); return; }
  const d = dCm(S.lpi), cp = Math.cos(S.phi * Math.PI / 180), sp = Math.sin(S.phi * Math.PI / 180), D = S.D;
  /* หมุนเกรตติงเป็นมุม φ: direction cosines (sinθ cosφ, sinθ sinφ) แล้วฉายลงระนาบไม้เมตร */
  const place = (s, sign) => { const a = sign * s * cp, b = sign * s * sp, c = Math.sqrt(Math.max(0, 1 - s * s)); return [D * a / c, D * b / c]; };
  const col = new THREE.Color();
  g.lines.forEach(([nm, I]) => {
    const [r, gg, b] = wl2rgb(nm); col.setRGB(r, gg, b).convertSRGBToLinear();
    for (let m = 1; m <= 4; m++) {
      const s = m * nm * 1e-7 / d; if (s >= .85) break;
      const fall = 1 / (m * m);   // อันดับสูงหรี่ลงตาม 1/m²
      [1, -1].forEach(sign => {
        const [px, py] = place(s, sign); if (Math.abs(px) > 95) return;
        addStrip(px, 17 + py, 33 + py, 1.4, col.clone(), Math.min(1, Math.pow(I, .62) * fall));
      });
    }
  });
}

/* สามเหลี่ยมในมุมบน ขั้นที่ 6 */
const triGroup = new THREE.Group(); scene.add(triGroup);
function seg(a, b, color, w = .55) {
  const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.BoxGeometry(w, .1, d.length()), new THREE.MeshBasicMaterial({color, depthTest: false}));
  m.position.copy(a).addScaledVector(d, .5); m.lookAt(b); m.renderOrder = 8; triGroup.add(m);
}
function buildTri() {
  while (triGroup.children.length) { const c = triGroup.children.pop(); c.geometry.dispose(); c.material.dispose(); }
  const c = S.calc && rowCalc(S.calc.g, S.calc.i); if (!c) return;
  const y = 23.6, col = new THREE.Color(cssWl(GAS[S.calc.g].read[S.calc.i].nm)), G = new THREE.Vector3(0, y, S.D), C = new THREE.Vector3(0, y, 1.3);
  const Lp = new THREE.Vector3(-c.xbar, y, 1.3), Rp = new THREE.Vector3(c.xbar, y, 1.3), grey = 0x1b2026;
  seg(G, C, grey); seg(G, Lp, col); seg(G, Rp, col); seg(Lp, C, 0x80590a, .7); seg(C, Rp, 0x80590a, .7);
}

/* ---------- ป้ายกำกับ ---------- */
const free = () => S.cam === "free";
addLabel("หลอดบรรจุแก๊ส", () => new THREE.Vector3(0, 43, -6), () => free() && S.gas && S.step <= 4);
addLabel("ชุดจ่ายไฟ", () => new THREE.Vector3(-12, 6, 0), () => free() && S.step === 1);
addLabel("ไม้เมตร", () => new THREE.Vector3(-S.err - 44, STICK.top + 2, 0), () => free() && S.step >= 2 && S.step <= 4);
addLabel("เกรตติง", () => new THREE.Vector3(5, 32, S.D), () => free() && S.step === 3);
addLabel("เลือกหลอดจากชั้นวาง", () => new THREE.Vector3(90, 35, -8), () => free() && S.step === 1 && !S.gas, "hint");
addLabel("ลากไม้เมตรให้ขีด 50 ตรงหลอด", () => new THREE.Vector3(-S.err, STICK.bot - 4, 1), () => free() && S.step === 2 && !ok[2](), "hint");
addLabel("ลากเกรตติงตามแนวตลับเมตร", () => new THREE.Vector3(0, 8, S.D + 6), () => free() && S.step === 3 && !ok[3](), "hint");
addLabel("กดเปิดสวิตช์ตรงนี้", () => new THREE.Vector3(-13, 1.5, 3), () => free() && S.step === 4 && !S.on, "hint");
const dLabel = addLabel("", () => new THREE.Vector3(-13, .4, S.D / 2), () => free() && S.step === 3, "math");
addLabel("อ่านตำแหน่งเส้นนี้", () => {
  const f = S.focus; if (!f) return new THREE.Vector3();
  const x = lineX(GAS[S.gas].read[f.i].nm, S.D, S.lpi); return new THREE.Vector3(f.side === "L" ? -x : x, STICK.top + 2.1, 0);
}, () => S.cam === "zoom" && S.focus && !S.naked, "hint");
const topVis = () => S.cam === "top" && S.calc;
const calcNow = () => rowCalc(S.calc.g, S.calc.i);
const triLab = {
  D: addLabel("", () => new THREE.Vector3(0, 23.6, S.D * .55), topVis, "math"),
  X: addLabel("", () => new THREE.Vector3(calcNow().xbar / 2, 23.6, 6), topVis, "math"),
  H: addLabel("", () => new THREE.Vector3(calcNow().xbar * .66, 23.6, S.D * .42), topVis, "math")
};
[1, -1].forEach(sign => addLabel("θ", () => new THREE.Vector3(sign * calcNow().xbar * .075, 23.6, S.D * .8), topVis, "math").el.style.fontSize = "16px");

/* ---------- มุมกล้อง ---------- */
const FREE = {
  1: {p: [60, 58, 150], l: [60, 14, -6]},
  2: {p: [0, 50, 135], l: [0, 20, 0]},
  3: {p: [130, 84, 110], l: [0, 10, 48]},
  4: {p: [-26, 26, 48], l: [-1, 15, -4]}
};
function setFree(k) {
  const f = FREE[k]; S.cam = "free";
  const l = new THREE.Vector3(...f.l);
  core.tween(l.clone().add(aspectFit(new THREE.Vector3(...f.p).sub(l))), l, 40);
}
/* มองผ่านเกรตติง: มุมรับภาพพอดีไม้เมตร */
function eyeFov() { return THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(.2, (57 / S.D) / (core.W / core.H)))); }
function setEye() { S.cam = "eye"; S.focus = null; core.tween(new THREE.Vector3(0, 26, S.D), new THREE.Vector3(0, 25, 0), eyeFov()); }
function setZoom() {
  if (!S.focus) return setEye();
  S.cam = "zoom";
  const x = lineX(GAS[S.gas].read[S.focus.i].nm, S.D, S.lpi), sx = S.focus.side === "L" ? -x : x, dist = Math.hypot(S.D, x);
  core.tween(new THREE.Vector3(0, 26, S.D), new THREE.Vector3(sx, 22.6, 0), THREE.MathUtils.radToDeg(2 * Math.atan((5.5 / dist) / Math.min(core.W / core.H, 1.8))));
}
function setTop() {
  S.cam = "top"; S.focus = null;
  const a = core.W / core.H, f = 38, t = Math.tan(THREE.MathUtils.degToRad(f / 2)), h = Math.max((S.D + 34) / (2 * t), 122 / (2 * t * a));
  core.tween(new THREE.Vector3(0, h + 24, S.D / 2 + .5), new THREE.Vector3(0, 0, S.D / 2), f);
}
function camForStep() {
  const n = S.step;
  if (n <= 3) setFree(n); else if (n === 4) { S.on ? setEye() : setFree(4); } else if (n === 6) setTop(); else setEye();
}
core.onResize = () => { if (S.cam === "eye") setEye(); else if (S.cam === "zoom") setZoom(); else if (S.cam === "top") setTop(); };

/* ---------- การลากและคลิกในฉาก ---------- */
const hitPt = new THREE.Vector3();
const planeStick = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), planeTable = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ray = core.ray;
function hitTarget() {
  if (S.cam !== "free") return null;
  if (S.step === 1 || S.step === 7) {
    const hs = Object.values(items).filter(o => o.position.x > 30 && (S.step === 7 || o.userData.key !== "lamp")).map(o => o.userData.hit);
    const h = ray.intersectObjects(hs)[0]; if (h) return {t: "tube", k: h.object.parent.userData.key};
  }
  if (S.step >= 4 && ray.intersectObjects([switchBase, toggle])[0]) return {t: "switch"};
  if (S.step === 2 && ray.intersectObject(stickBar)[0]) return {t: "stick"};
  if (S.step === 3 && ray.intersectObject(gHit)[0]) return {t: "grat"};
  return null;
}
core.interact({
  hitTest: hitTarget,
  onDown(h) {
    if (h.t === "tube") insertTube(h.k);
    else if (h.t === "switch") setPower(!S.on);
    else if (h.t === "stick") { ray.ray.intersectPlane(planeStick, hitPt); return {t: "stick", x0: hitPt.x, err0: S.err}; }
    else if (h.t === "grat") { ray.ray.intersectPlane(planeTable, hitPt); return {t: "grat", z0: hitPt.z, D0: S.D}; }
    return null;
  },
  onDrag(d) {
    if (d.t === "stick" && ray.ray.intersectPlane(planeStick, hitPt)) setErr(clamp(Math.round((d.err0 - (hitPt.x - d.x0)) * 10) / 10, -20, 20));
    if (d.t === "grat" && ray.ray.intersectPlane(planeTable, hitPt)) setD(clamp(Math.round(d.D0 + hitPt.z - d.z0), 25, 130));
  }
});

/* ---------- การกระทำ ---------- */
let onTimer = null;
function setErr(v) { if (v === S.err) return; S.err = v; if (clearReadings()) panel.notice = "ไม้เมตรขยับ จึงล้างค่าที่อ่านไว้"; panel.live(); }
function setD(v) { if (v === S.D) return; S.D = v; if (clearReadings()) panel.notice = "ระยะ D เปลี่ยน จึงล้างค่าที่อ่านไว้"; buildLines(); panel.live(); }
function setPower(v) {
  if (v && !S.gas) { panel.notice = "ยังไม่มีหลอดในที่เสียบ"; panel.live(); return; }
  S.on = v; if (v && !S.seen.includes(S.gas)) S.seen.push(S.gas);
  if (S.step === 4) { v ? setEye() : setFree(4); panel.render(); } else { buildLines(); panel.live(); }
}
function insertTube(k) {
  clearTimeout(onTimer);
  S.gas = k; S.focus = null; S.on = false; buildLines();
  if (S.step === 7) { setEye(); syncTools(); onTimer = setTimeout(() => { setPower(true); panel.render(); drawPic(); }, reduce ? 0 : 1100); }
  panel.render();
}
function fillGas(g) {
  if (!GAS[g].read.length) return;
  S.R[g] = S.R[g] || {};
  GAS[g].read.forEach((_, i) => {
    S.R[g][i] = S.R[g][i] || {L: null, R: null};
    ["L", "R"].forEach(sd => { if (S.R[g][i][sd] == null) S.R[g][i][sd] = Math.round(reading(g, i, sd) * 10) / 10; });
  });
}
const AUTO = {
  1() { if (!S.gas) insertTube("H"); },
  2() { S.err = 0; S.tilt = 0; clearReadings(); },
  3() { S.D = 100; clearReadings(); buildLines(); },
  4() { if (!S.gas) S.gas = "H"; S.on = true; S.phi = 0; if (!S.seen.includes(S.gas)) S.seen.push(S.gas); buildLines(); },
  5() { if (S.gas === "lamp") S.gas = "H"; fillGas(S.gas); buildLines(); },
  6() { if (!S.calc) pickCalc(); },
  7() { const g = TUBES.find(k => !S.seen.includes(k) || fullRows(k) < 3); S.gas = g || "Ne"; S.on = true; if (!S.seen.includes(S.gas)) S.seen.push(S.gas); fillGas(S.gas); buildLines(); }
};
function pickCalc() { for (const g of [S.gas, ...TUBES]) { if (!g || g === "lamp") continue; for (let i = 0; i < 3; i++) if (rowCalc(g, i)) { S.calc = {g, i}; return; } } }

/* ---------- เนื้อหาขั้นตอน ---------- */
const Math_x = '<i class="m">x</i>', Xbar = '<i class="m bar">x</i>', Dm = '<i class="m">D</i>', dm = '<i class="m">d</i>';
const gasChips = list => `<div class="chips">${list.map(k => `<button type="button" class="chip gaspick ${S.gas === k ? "on" : ""}" data-g="${k}" id="gas-${k}">${GAS[k].name}</button>`).join("")}</div>`;
function lamCm(v) { const e = Math.floor(Math.log10(v)); return `${(v / Math.pow(10, e)).toFixed(3)}×10<sup>${String(e).replace("-", "−")}</sup>`; }
function bindGas() { $("body").querySelectorAll(".gaspick").forEach(b => b.onclick = () => insertTube(b.dataset.g)); }
function readTable() {
  const g = S.gas; if (!g) return ""; const G = GAS[g];
  if (G.continuous) return `<p class="warn">หลอดไฟฟ้าทั่วไปให้แถบสีต่อเนื่อง จึงไม่มีเส้นแยกให้อ่านตำแหน่ง ให้ดูแถบสีแล้วเทียบกับหลอดแก๊ส</p>`;
  const rows = G.read.map((r, i) => {
    const v = (S.R[g] || {})[i] || {}, c = rowCalc(g, i);
    const xc = sd => v[sd] != null ? fmt(Math.abs(v[sd] - 50)) : "–";
    const inp = sd => `<input id="r-${g}-${i}-${sd}" data-i="${i}" data-s="${sd}" inputmode="decimal" autocomplete="off" aria-label="${r.c} ตำแหน่ง${sd === "L" ? "ซ้าย" : "ขวา"}" class="${v[sd] != null ? "good" : ""}" value="${v[sd] != null ? fmt(v[sd]) : ""}">`;
    return `<tr><td class="c"><span class="sw" style="background:${cssWl(r.nm)}"></span>${r.c}</td><td>${inp("L")}</td><td>${xc("L")}</td><td>${inp("R")}</td><td>${xc("R")}</td><td>${c ? fmt(c.xbar, 2) : "–"}</td></tr>`;
  }).join("");
  return `<div style="overflow-x:auto"><table class="read"><thead><tr><th>สีเส้น</th><th>ซ้าย<br>ตำแหน่ง</th><th>${Math_x}</th><th>ขวา<br>ตำแหน่ง</th><th>${Math_x}</th><th>${Xbar}</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="chips"><button type="button" class="chip" id="fillOne">อ่านค่าให้ทั้งหมด</button></div>`;
}
function bindRead() {
  $("body").querySelectorAll("table.read input").forEach(inp => {
    inp.addEventListener("focus", () => { S.focus = {i: +inp.dataset.i, side: inp.dataset.s}; S.naked = false; setZoom(); syncTools(); });
    const commit = () => {
      const raw = inp.value.trim(); if (raw === "") return;
      const v = parseFloat(raw.replace(",", ".")), i = +inp.dataset.i, sd = inp.dataset.s, g = S.gas;
      if (!Number.isFinite(v) || Math.abs(v - reading(g, i, sd)) > .3) {
        inp.classList.add("err"); inp.classList.remove("good");
        panel.notice = "bad:ยังไม่ตรงกับเส้นที่ชี้อยู่ 1 ช่องเล็กคือ 0.1 cm ลองอ่านใหม่จากขีดที่เส้นสีทับ"; panel.live(); return;
      }
      S.R[g] = S.R[g] || {}; S.R[g][i] = S.R[g][i] || {L: null, R: null}; S.R[g][i][sd] = v; panel.notice = "";
      panel.render();
      const nx = [...$("body").querySelectorAll("table.read input")].find(e => !e.value);
      if (nx) nx.focus(); else { setEye(); syncTools(); }
    };
    inp.addEventListener("change", commit);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } });
  });
  const f = $("fillOne"); if (f) f.onclick = () => { fillGas(S.gas); setEye(); panel.notice = ""; panel.render(); };
}
const STEPS = {
  1: {t: "เสียบหลอดบรรจุแก๊ส", doc: "เสียบหลอดบรรจุแก๊สเข้าที่เสียบของชุดสเปกตรัม",
    html: () => `<p class="task">เลือกหลอดจากชั้นวาง หรือกดชื่อแก๊สด้านล่าง</p>${gasChips(TUBES)}
      <p class="warn">ปิดสวิตช์ทุกครั้งก่อนเปลี่ยนหลอด ชุดนี้ใช้ไฟฟ้าแรงดันสูง และหลอดร้อนหลังเปิดใช้งาน ควรรอให้เย็นก่อนจับ</p>`,
    bind() { bindGas(); },
    live() { return S.gas ? ["yes", `เสียบหลอด${GAS[S.gas].name}แล้ว`] : ["no", "ยังไม่มีหลอดในที่เสียบ"]; }},
  2: {t: "วางไม้เมตรหน้าหลอด", doc: "วางไม้เมตรไว้ข้างหน้าหลอดบรรจุแก๊ส โดยจัดให้ไม้เมตรอยู่ในแนวระดับและขีดกึ่งกลางไม้เมตรอยู่ตรงกับหลอดบรรจุแก๊ส",
    html: () => `<p class="task">ลากไม้เมตรในฉากหรือใช้แถบเลื่อน แล้วปรับให้ได้ระดับ</p>
      <div class="field"><label for="errS">ขีดที่ตรงกับหลอด <output id="errO"></output></label><input id="errS" type="range" min="30" max="70" step="0.1"></div>
      <div class="field"><label for="tiltS">ความเอียงของไม้เมตร <output id="tiltO"></output></label><input id="tiltS" type="range" min="-8" max="8" step="0.5"><div class="lvl" aria-hidden="true"><i id="bub"></i></div></div>`,
    bind() { $("errS").oninput = e => setErr(Math.round((+e.target.value - 50) * 10) / 10); $("tiltS").oninput = e => { S.tilt = +e.target.value; panel.live(); }; },
    live() {
      const a = Math.abs(S.err) <= .5, b = Math.abs(S.tilt) <= .5;
      return a && b ? ["yes", "ขีด 50 cm ตรงหลอดและไม้เมตรได้ระดับแล้ว"] : ["no", !a ? "ขีด 50 cm ยังไม่ตรงหลอด" : "ไม้เมตรยังเอียงอยู่ ให้ฟองระดับอยู่กลางขีด"];
    }},
  3: {t: "วัดระยะ D ประมาณ 1 เมตร", doc: `วัดระยะตั้งฉาก ${Dm} จากไม้เมตรให้ห่างออกมาประมาณ 1 เมตร ซึ่งเป็นตำแหน่งที่ใช้มองผ่านเกรตติง`,
    html: () => `<p class="task">ลากเกรตติงตามแนวตลับเมตร ให้แนวมองตั้งฉากกับไม้เมตรที่ขีด 50 cm</p>
      <div class="field"><label for="dS"><span>ระยะ ${Dm}</span> <output id="dO"></output></label><input id="dS" type="range" min="25" max="130" step="1"></div>
      <div class="field"><label for="lpiI">เกรตติงที่ใช้ (เส้นต่อนิ้ว)</label><input class="txt" id="lpiI" inputmode="numeric" autocomplete="off"><span class="note" id="dInfo"></span></div>
      <p class="note">ดูจำนวนเส้นจากกรอบเกรตติงจริงในห้องแล้วแก้ค่านี้ได้ ทุกตำแหน่งในฉากจะคำนวณตามค่านี้</p>`,
    bind() {
      $("dS").oninput = e => setD(+e.target.value);
      $("lpiI").onchange = e => {
        const v = parseInt(String(e.target.value).replace(/[, ]/g, ""), 10);
        if (!Number.isFinite(v) || v < 2500 || v > 15000) { panel.notice = "bad:ใส่จำนวนเส้นระหว่าง 2,500 ถึง 15,000 เส้นต่อนิ้ว เกินกว่านี้เส้นสีแดงจะตกนอกไม้เมตร"; e.target.value = S.lpi; panel.live(); return; }
        S.lpi = v; if (clearReadings()) panel.notice = "เปลี่ยนเกรตติง จึงล้างค่าที่อ่านไว้"; buildLines(); panel.live();
      };
    },
    live() { return ok[3]() ? ["yes", `D = ${S.D} cm ใช้ได้`] : ["no", `ตอนนี้ D = ${S.D} cm ต้องอยู่ราว 100 cm`]; }},
  4: {t: "เปิดสวิตช์แล้วมองผ่านเกรตติง", doc: "เปิดสวิตซ์ชุดสเปกตรัมแล้วมองผ่านเกรตติง จัดระนาบของสเปกตรัมให้เห็นเส้นสเปกตรัมปรากฏชัดที่ทั้งสองข้างของไม้เมตร",
    html: () => `<button type="button" class="big ${S.on ? "on" : ""}" id="pw">${S.on ? "ปิดสวิตช์" : "เปิดสวิตช์ชุดสเปกตรัม"}</button>
      ${S.on ? `<p class="task">หมุนเกรตติงจนเส้นสเปกตรัมเรียงอยู่ตามแนวไม้เมตรทั้งสองข้าง</p>
      <div class="field"><label for="phiS">มุมหมุนเกรตติง <output id="phiO"></output></label><input id="phiS" type="range" min="-45" max="45" step="1"></div>
      <p class="note">ลองกด "เอาเกรตติงออก" เส้นสีจะหายไป เพราะเส้นเหล่านี้เป็นภาพที่เห็นผ่านเกรตติง ไม่ได้ตกอยู่บนไม้เมตรจริง</p>` : `<p class="note">ทำในห้องที่หรี่ไฟ เพื่อให้เห็นเส้นสเปกตรัมชัด</p>`}`,
    bind() {
      $("pw").onclick = () => setPower(!S.on);
      const p = $("phiS"); if (p) p.oninput = e => { S.phi = +e.target.value; if (Math.abs(S.phi) <= 1) S.phi = 0; buildLines(); panel.live(); };
    },
    live() {
      if (!S.on) return ["no", "ชุดสเปกตรัมยังไม่ทำงาน"];
      return Math.abs(S.phi) <= 1.5 ? ["yes", "เส้นสเปกตรัมอยู่ตามแนวไม้เมตรทั้งสองข้างแล้ว"] : ["no", `แถวเส้นสเปกตรัมยังเอียงจากไม้เมตร ${Math.abs(S.phi)}°`];
    }},
  5: {t: "บันทึกสีและตำแหน่งเส้นสเปกตรัม", doc: `บันทึกสีและตำแหน่งต่างๆ ของเส้นสเปกตรัมที่ปรากฏบนไม้เมตรแต่ละข้างเป็นระยะ ${Math_x} แล้วหาค่าเฉลี่ย ${Xbar} สำหรับสเปกตรัมสีเดียวกัน จากนั้นคำนวณหา √(${Dm}² + ${Xbar}²)`,
    html: () => `<p class="task">กดช่องตำแหน่ง ภาพจะซูมไปที่เส้นนั้น อ่านค่าจากไม้เมตรเป็น cm แล้วกด Enter</p>${readTable()}
      <p class="note">อ่านชุดเส้นที่อยู่ใกล้ขีด 50 cm ที่สุดในแต่ละสี ระยะ ${Math_x} = |ตำแหน่ง − 50| ถ้าขีด 50 ไม่ตรงหลอดพอดี ${Math_x} สองข้างจะต่างกันเล็กน้อย ค่าเฉลี่ย ${Xbar} จึงช่วยลดความคลาดเคลื่อนนี้</p>`,
    bind() { bindRead(); },
    live() { const n = fullRows(S.gas || ""); return n === 3 ? ["yes", "บันทึกครบ 3 สีแล้ว"] : ["no", `บันทึกครบแล้ว ${n} จาก 3 สี`]; }},
  6: {t: "คำนวณความยาวคลื่น", doc: `คำนวณหาความยาวคลื่นของสเปกตรัม จากสมการ <i class="m">λ</i> = ${dm} sin<i class="m">θ</i> เมื่อ ${dm} คือ ระยะระหว่างเส้นของเกรตติง`,
    html: () => {
      const list = []; TUBES.forEach(g => GAS[g].read.forEach((r, i) => { if (rowCalc(g, i)) list.push({g, i, r}); }));
      if (!list.length) return `<p class="warn">ยังไม่มีค่าที่บันทึก กลับไปขั้นที่ 5 ก่อน</p>`;
      const c = S.calc && rowCalc(S.calc.g, S.calc.i), r = GAS[S.calc.g].read[S.calc.i], lc = S.lpi / 2.54, d = dCm(S.lpi);
      const sci = lamCm(c.lam), er = (c.nm - r.nm) / r.nm * 100;
      return `<div class="chips">${list.map(o => `<button type="button" class="chip calcpick ${S.calc.g === o.g && S.calc.i === o.i ? "on" : ""}" data-g="${o.g}" data-i="${o.i}"><span class="sw" style="background:${cssWl(o.r.nm)}"></span>${GAS[o.g].sym} ${o.r.c}</button>`).join("")}</div>
      <div class="calc">
       <div><span>${S.lpi.toLocaleString()} เส้นต่อนิ้ว</span><span class="v">÷ 2.54 = ${lc.toLocaleString(undefined, {maximumFractionDigits: 0})} เส้น/cm</span></div>
       <div><span>${dm} = 1 ÷ ${lc.toLocaleString(undefined, {maximumFractionDigits: 0})}</span><span class="v">${lamCm(d)} cm</span></div>
       <div><span>${Dm}, ${Xbar}</span><span class="v">${S.D} cm, ${fmt(c.xbar, 2)} cm</span></div>
       <div><span>√(${Dm}² + ${Xbar}²)</span><span class="v">√(${S.D}² + ${fmt(c.xbar, 2)}²) = ${fmt(c.hyp, 2)} cm</span></div>
       <div><span>sin<i class="m">θ</i> = ${Xbar} ÷ √(${Dm}² + ${Xbar}²)</span><span class="v">${fmt(c.xbar, 2)} ÷ ${fmt(c.hyp, 2)} = ${fmt(c.sin, 4)}</span></div>
       <div class="res"><span><i class="m">λ</i> = ${dm} sin<i class="m">θ</i></span><span class="v">${sci} cm = ${fmt(c.nm, 0)} nm</span></div>
      </div>
      <p class="note">ค่าอ้างอิงของเส้นนี้ ${fmt(r.nm, 1)} nm ต่างจากที่วัดได้ ${fmt(Math.abs(er), 1)}%</p>
      <p class="note">ภาพในฉากคือมุมมองจากด้านบน ตรงกับแผนภาพในใบกิจกรรม เส้นสีเป็นด้านตรงข้ามมุมฉาก ส่วน ${Dm} และ ${Xbar} เป็นด้านประกอบมุมฉาก</p>`;
    },
    bind() { $("body").querySelectorAll(".calcpick").forEach(b => b.onclick = () => { S.calc = {g: b.dataset.g, i: +b.dataset.i}; buildTri(); panel.render(); }); },
    live() { return ok[6]() ? ["yes", "ดูค่าทุกคอลัมน์ได้ใน \"ตารางบันทึกผล\""] : ["no", "ต้องมีค่าจากขั้นที่ 5 ก่อน"]; }},
  7: {t: "เปลี่ยนหลอดแล้วเปรียบเทียบ", doc: "ทำการทดลองซ้ำโดยเปลี่ยนหลอดบรรจุแก๊สชนิดอื่น สังเกตลักษณะสีและตำแหน่งของสเปกตรัมต่างๆ เปรียบเทียบกับสเปกตรัมก่อนหน้านี้",
    html: () => `<p class="task">เลือกหลอดใหม่ ระบบจะปิดสวิตช์ เปลี่ยนหลอด แล้วเปิดให้</p>${gasChips([...TUBES, "lamp"])}
      <div class="field"><label>ภาพสเปกตรัมที่ดูแล้ว (ตำแหน่งบนไม้เมตร, cm)</label><canvas id="pic" height="120"></canvas></div>
      ${readTable()}
      <p class="task">คำถามท้ายการทดลอง</p>
      <ol class="qs"><li>สเปกตรัมจากหลอดบรรจุแก๊สมีลักษณะเหมือนกับสเปกตรัมจากหลอดไฟฟ้าทั่วไปหรือไม่ อย่างไร</li><li>สเปกตรัมจากหลอดบรรจุแก๊สแต่ละชนิดมีลักษณะเหมือนและต่างกันอย่างไร</li></ol>`,
    bind() { bindGas(); bindRead(); drawPic(); },
    live() { return S.seen.length >= 2 ? ["yes", `ดูแล้ว ${S.seen.length} แหล่งกำเนิดแสง`] : ["no", "เปลี่ยนเป็นหลอดชนิดอื่นอย่างน้อย 1 หลอด"]; }}
};

/* ---------- แผงขั้นตอน ---------- */
const panel = createPanel({
  steps: STEPS, ok, auto: AUTO,
  getStep: () => S.step, setStep: n => { S.step = n; },
  finishLabel: "ดูตารางบันทึกผล",
  onFinish: () => toggleSheet(true),
  beforeGoTo() { clearTimeout(onTimer); S.focus = null; },
  onEnter(n) { S.naked = false; if (n === 6 && !S.calc) pickCalc(); camForStep(); buildLines(); buildTri(); },
  afterAuto(n) { if (n === 4 || n === 7) setEye(); buildLines(); },
  afterRender() { syncTools(); if (S.sheet) renderSheet(); },
  afterLive() {
    syncInputs();
    const bub = $("bub"); if (bub) bub.style.transform = `translateX(${clamp(S.tilt * 14, -90, 90)}px)`;
    const hud = []; if (S.gas) hud.push(GAS[S.gas].name); hud.push(S.on ? "สวิตช์เปิด" : "สวิตช์ปิด"); if (S.step >= 3) hud.push("D = " + S.D + " cm");
    $("hud").innerHTML = hud.map(h => `<span>${h}</span>`).join("");
    dLabel.el.textContent = `D = ${S.D} cm`;
    const c = S.calc && rowCalc(S.calc.g, S.calc.i);
    if (c) { triLab.D.el.textContent = `D = ${S.D} cm`; triLab.X.el.innerHTML = `x̄ = ${fmt(c.xbar, 2)} cm`; triLab.H.el.textContent = `√(D²+x̄²) = ${fmt(c.hyp, 2)} cm`; }
    if (S.cam === "eye") setEye();   // ซูมตาม D ที่เปลี่ยน
  }
});

function syncInputs() {
  const e = $("errS"); if (e) { e.value = 50 + S.err; $("errO").textContent = fmt(50 + S.err) + " cm"; }
  const t = $("tiltS"); if (t) { t.value = S.tilt; $("tiltO").textContent = fmt(S.tilt) + "°"; }
  const d = $("dS"); if (d) { d.value = S.D; $("dO").textContent = S.D + " cm"; }
  const l = $("lpiI"); if (l) { if (document.activeElement !== l) l.value = S.lpi; $("dInfo").innerHTML = `= ${(S.lpi / 2.54).toLocaleString(undefined, {maximumFractionDigits: 0})} เส้นต่อ cm · ${dm} = ${lamCm(dCm(S.lpi))} cm`; }
  const p = $("phiS"); if (p) { p.value = S.phi; $("phiO").textContent = S.phi + "°"; }
}
function syncTools() {
  const inEye = S.cam === "eye" || S.cam === "zoom";
  $("wide").hidden = S.cam !== "zoom";
  $("naked").hidden = !(inEye && S.on && S.step === 4);
  $("naked").textContent = S.naked ? "ใส่เกรตติงกลับ" : "เอาเกรตติงออก";
  $("frame").hidden = !inEye || S.naked;
}
function drawPic() {
  const c = $("pic"); if (!c) return;
  const dpr = Math.min(devicePixelRatio, 2), w = c.clientWidth || 340, list = S.seen, h = 26 * Math.max(1, list.length) + 24;
  c.width = w * dpr; c.height = h * dpr; c.style.height = h + "px";
  const g = c.getContext("2d"); g.scale(dpr, dpr);
  const left = 58, right = w - 8, X = v => left + (right - left) * v / 100;
  g.font = "12px 'IBM Plex Sans Thai',sans-serif"; g.textBaseline = "middle";
  list.forEach((k, row) => {
    const y = 4 + row * 26, G = GAS[k];
    g.fillStyle = "#0a0d10"; g.fillRect(left, y, right - left, 22); g.fillStyle = "#1b2026"; g.fillText(G.sym, 2, y + 11);
    if (G.continuous) {
      const px = right - left;
      for (let i = 0; i < px; i++) { const lam = wlAt(Math.abs(i / px * 100 - 50), S.D, S.lpi); if (lam >= 390 && lam <= 740) { g.fillStyle = cssWl(lam); g.fillRect(left + i, y, 1, 22); } }
    } else G.lines.forEach(([nm, I]) => {
      const x = lineX(nm, S.D, S.lpi);
      [50 - x, 50 + x].forEach(v => { if (v < 0 || v > 100) return; g.globalAlpha = Math.min(1, Math.pow(I, .6)); g.fillStyle = cssWl(nm); g.fillRect(X(v) - 1, y, 2, 22); g.globalAlpha = 1; });
    });
    g.fillStyle = "#fff"; g.globalAlpha = .75; g.fillRect(X(50) - .5, y, 1, 22); g.globalAlpha = 1;
  });
  const yb = 4 + list.length * 26; g.fillStyle = "#56606a";
  [0, 25, 50, 75, 100].forEach(v => { g.textAlign = v === 0 ? "left" : v === 100 ? "right" : "center"; g.fillText(v, X(v), yb + 8); });
  g.textAlign = "left";
}
function renderSheet() {
  $("sheetMeta").innerHTML = `<span>ระยะจากหลอดถึงเกรตติง (D) = <b>${S.D}</b> cm</span><span>เกรตติง <b>${S.lpi.toLocaleString()}</b> เส้นต่อนิ้ว หรือ <b>${(S.lpi / 2.54).toLocaleString(undefined, {maximumFractionDigits: 0})}</b> เส้นต่อเซนติเมตร</span><span>d = <b>${lamCm(dCm(S.lpi))}</b> cm</span>`;
  let rows = "";
  TUBES.filter(g => S.R[g] && Object.keys(S.R[g]).length).forEach(g => {
    GAS[g].read.forEach((r, i) => {
      const v = S.R[g][i] || {}, c = rowCalc(g, i), f = (a, n = 1) => a != null ? fmt(a, n) : "";
      rows += `<tr>${i === 0 ? `<td class="s" rowspan="3">${GAS[g].name}</td>` : ""}<td class="s"><span class="sw" style="background:${cssWl(r.nm)}"></span>${r.c}</td><td>${f(v.L)}</td><td>${v.L != null ? fmt(Math.abs(v.L - 50)) : ""}</td><td>${f(v.R)}</td><td>${v.R != null ? fmt(Math.abs(v.R - 50)) : ""}</td><td>${c ? fmt(c.xbar, 2) : ""}</td><td>${c ? fmt(c.hyp, 2) : ""}</td><td>${c ? fmt(c.sin, 4) : ""}</td><td>${c ? lamCm(c.lam) : ""}</td></tr>`;
    });
  });
  if (!rows) rows = `<tr><td class="s" colspan="10">ยังไม่มีค่าที่บันทึก เริ่มอ่านตำแหน่งได้ในขั้นที่ 5</td></tr>`;
  $("sheetWrap").innerHTML = `<table class="full"><thead><tr><th rowspan="2">แหล่งกำเนิด</th><th rowspan="2">สีของเส้น<br>สเปกตรัม</th><th colspan="2">เส้นสเปกตรัมทางซ้าย</th><th colspan="2">เส้นสเปกตรัมทางขวา</th><th rowspan="2">ระยะเฉลี่ย<br>x̄ (cm)</th><th rowspan="2">√(D²+x̄²)<br>(cm)</th><th rowspan="2">sinθ</th><th rowspan="2">λ = d sinθ<br>(cm)</th></tr><tr><th>ตำแหน่ง (cm)</th><th>ระยะ x (cm)</th><th>ตำแหน่ง (cm)</th><th>ระยะ x (cm)</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function toggleSheet(v) { S.sheet = v; $("sheet").hidden = !v; if (v) renderSheet(); }

/* ปุ่มในฉาก */
$("wide").onclick = () => { setEye(); syncTools(); };
$("naked").onclick = () => { S.naked = !S.naked; syncTools(); };
$("openSheet").onclick = () => toggleSheet(!S.sheet);
$("closeSheet").onclick = () => toggleSheet(false);
$("reset").onclick = () => { clearTimeout(onTimer); S = START(); setFree(1); buildLines(); buildTri(); panel.render(); toggleSheet(false); };
addEventListener("resize", () => drawPic());

/* ---------- ทุกเฟรม: ขยับฉากตามสถานะ S ---------- */
const C = h => new THREE.Color(h), ROOM = {bgL: C(0xe6e8e4), bgD: C(0x0b0e12), tL: C(0xa9ada8), tD: C(0x1e2227), wL: C(0xd3d6d1), wD: C(0x14181d), fL: C(0xb4b7b3), fD: C(0x0c0f12)};
let dimmer = 1;
function frame(dt, k, kFast) {
  stick.position.x += (-S.err - stick.position.x) * kFast;
  stick.rotation.z += (S.tilt * Math.PI / 180 - stick.rotation.z) * kFast;
  grating.position.z += (S.D - grating.position.z) * kFast;
  gHead.rotation.z += (-S.phi * Math.PI / 180 - gHead.rotation.z) * kFast;
  grating.visible = S.step >= 3 && S.cam !== "eye" && S.cam !== "zoom"; stick.visible = S.step >= 2;
  toggle.rotation.x += ((S.on ? -.5 : .5) - toggle.rotation.x) * kFast;
  led.material.emissiveIntensity = S.on ? 2.4 : 0;
  tape.visible = S.step === 3 && S.cam === "free"; tape.scale.y = Math.max(1, grating.position.z); tape.position.z = grating.position.z / 2; tapeTex.repeat.y = grating.position.z / 10;
  guide.visible = S.step === 2;
  /* หลอด: เดินตามแนวโค้ง ยกขึ้นจากชั้นวางแล้วลงที่เสียบ */
  let arrived = false;
  for (const k2 in items) {
    const o = items[k2], u = o.userData, isIn = S.gas === k2, tgt = isIn ? 1 : 0;
    u.p += (tgt - u.p) * k; if (Math.abs(tgt - u.p) < 1e-4) u.p = tgt;
    o.position.lerpVectors(u.rack, HOLDER, u.p); o.position.y += LIFT * Math.sin(Math.PI * u.p);
    const here = o.position.distanceTo(HOLDER) < .6, lit = isIn && here && S.on; if (isIn && here) arrived = true;
    u.coreMat.emissiveIntensity += ((lit ? 3 : 0) - u.coreMat.emissiveIntensity) * kFast;
    u.sp.material.opacity += ((lit ? .8 : 0) - u.sp.material.opacity) * kFast;
  }
  /* แสงในห้อง: หรี่ลงเฉพาะตอนมองผ่านเกรตติง */
  const eyeNow = S.cam === "eye" || S.cam === "zoom";
  dimmer += ((S.on ? (eyeNow ? .13 : .85) : 1) - dimmer) * kFast;
  hemi.intensity = .62 * dimmer + .04; key.intensity = .72 * dimmer;
  const dk = clamp((1 - dimmer) / .87, 0, 1);
  scene.background.copy(ROOM.bgL).lerp(ROOM.bgD, dk); tableMat.color.copy(ROOM.tL).lerp(ROOM.tD, dk);
  wallMat.color.copy(ROOM.wL).lerp(ROOM.wD, dk); floorMat.color.copy(ROOM.fL).lerp(ROOM.fD, dk);
  const lit = S.on && arrived;
  tubeLight.color.setHex(S.gas ? GAS[S.gas].glow : 0xffffff);
  tubeLight.intensity += ((lit ? (eyeNow ? 1.3 : .3) : 0) - tubeLight.intensity) * kFast;
  faceMat.emissiveIntensity = eyeNow && S.on ? .5 : .12;
  lineGroup.visible = eyeNow && lit && !S.naked;
  triGroup.visible = S.cam === "top";
}

core.resize(); setFree(1); panel.render(); core.start(frame);

/* จุดเข้าถึงสำหรับทดสอบอัตโนมัติ ลบได้ก่อนใช้จริงถ้าไม่ต้องการ */
window.__lab = {get S() { return S; }, lineX, solve, dCm, goTo: panel.goTo, AUTO, GAS, reading, rowCalc, camera, tw, items, lineGroup};
