/* ฟิสิกส์ของกิจกรรมสเปกตรัม: ฟังก์ชันล้วน ไม่แตะ DOM และไม่ใช้ three.js
   หน่วย: ระยะเป็น cm, ความยาวคลื่นเป็น nm, เกรตติงเป็นเส้นต่อนิ้ว (lpi) */

/* ข้อมูลเส้นสเปกตรัม [nm, ความสว่างโดยประมาณเพื่อการแสดงผล] และเส้นที่ให้นักเรียนอ่าน */
export const GAS = {
  H: {name: "ไฮโดรเจน", sym: "H₂", glow: 0xff4fa0,
    lines: [[656.28, 1], [486.13, .6], [434.05, .42], [410.17, .16]],
    read: [{nm: 656.28, c: "แดง"}, {nm: 486.13, c: "ฟ้าอมเขียว"}, {nm: 434.05, c: "ม่วงคราม"}]},
  He: {name: "ฮีเลียม", sym: "He", glow: 0xffa98f,
    lines: [[706.52, .2], [667.82, .5], [587.56, 1], [501.57, .5], [492.19, .14], [471.31, .22], [447.15, .6]],
    read: [{nm: 667.82, c: "แดง"}, {nm: 587.56, c: "เหลือง"}, {nm: 447.15, c: "น้ำเงิน"}]},
  Ne: {name: "นีออน", sym: "Ne", glow: 0xff5414,
    lines: [[540.06, .14], [585.25, .95], [588.19, .5], [594.48, .5], [603.00, .22], [607.43, .4], [609.62, .5], [614.31, .75], [616.36, .3], [621.73, .35], [626.65, .5], [630.48, .3], [633.44, .55], [638.30, .6], [640.22, 1], [650.65, .6], [659.90, .35], [667.83, .35], [671.70, .25], [692.95, .2], [703.24, .2]],
    read: [{nm: 585.25, c: "เหลือง"}, {nm: 614.31, c: "ส้ม"}, {nm: 640.22, c: "แดง"}]},
  Hg: {name: "ไอปรอท", sym: "Hg", glow: 0x9dc2ff,
    lines: [[404.66, .5], [435.83, 1], [491.60, .1], [546.07, .95], [576.96, .7], [579.07, .7]],
    read: [{nm: 579.07, c: "เหลือง"}, {nm: 546.07, c: "เขียว"}, {nm: 435.83, c: "น้ำเงิน"}]},
  lamp: {name: "หลอดไฟฟ้าทั่วไป", sym: "หลอดไฟ", glow: 0xffd59a, continuous: true, lines: [], read: []}
};
export const TUBES = ["H", "He", "Ne", "Hg"];

/* เกรตติงที่เลือกได้ และระยะ D ที่เหมาะสม: เส้นยิ่งถี่ แสงยิ่งเบนมาก จึงต้องลด D ให้เส้นยังอยู่บนไม้เมตร */
export const GRATINGS = [{lpi: 13400, D: 100}, {lpi: 25400, D: 50}];
export const targetD = lpi => GRATINGS.find(g => g.lpi === lpi).D;
/* ระยะ D ผ่านเมื่อคลาดจากค่าที่เหมาะสมไม่เกิน 5% */
export const distanceOK = (D, lpi) => Math.abs(D - targetD(lpi)) / targetD(lpi) <= .05;

/* d = 2.54 / เส้นต่อนิ้ว (cm) */
export const dCm = lpi => 2.54 / lpi;

/* ระยะ x ของเส้นอันดับ m บนไม้เมตร: sinθ = mλ/d, x = D tanθ */
export function lineX(nm, D, lpi, m = 1) {
  const s = m * nm * 1e-7 / dCm(lpi);
  return s >= 1 ? Infinity : D * Math.tan(Math.asin(s));
}

/* จาก x̄ และ D หา λ = d x̄ / √(D² + x̄²) */
export function solve(xbar, D, lpi) {
  const hyp = Math.hypot(D, xbar), sin = xbar / hyp, lam = dCm(lpi) * sin;
  return {hyp, sin, lam, nm: lam * 1e7};
}

/* ความยาวคลื่นที่มองเห็นที่ระยะ X บนไม้เมตร (ใช้กับแถบต่อเนื่อง) */
export const wlAt = (X, D, lpi) => dCm(lpi) * X / Math.hypot(D, X) * 1e7;

/* ตำแหน่งบนไม้เมตรที่ถูกต้อง: 50 + err ∓ x */
export function trueReading(nm, side, {D, lpi, err}) {
  const x = lineX(nm, D, lpi);
  return 50 + err + (side === "L" ? -x : x);
}

/* สีของแสงตามความยาวคลื่น คืน [r,g,b] ช่วง 0–1 */
export function wl2rgb(w) {
  let r = 0, g = 0, b = 0;
  if (w >= 380 && w < 440) { r = -(w - 440) / 60; b = 1; }
  else if (w >= 440 && w < 490) { g = (w - 440) / 50; b = 1; }
  else if (w >= 490 && w < 510) { g = 1; b = -(w - 510) / 20; }
  else if (w >= 510 && w < 580) { r = (w - 510) / 70; g = 1; }
  else if (w >= 580 && w < 645) { r = 1; g = -(w - 645) / 65; }
  else if (w >= 645 && w <= 780) { r = 1; }
  const f = w < 380 || w > 780 ? 0 : w < 420 ? .3 + .7 * (w - 380) / 40 : w > 700 ? .3 + .7 * (780 - w) / 80 : 1;
  return [r, g, b].map(c => Math.pow(c * f, .8));
}
export const cssWl = w => { const [r, g, b] = wl2rgb(w); return `rgb(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0})`; };
