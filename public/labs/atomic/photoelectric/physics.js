/* ฟิสิกส์ของกิจกรรมโฟโตอิเล็กทริก: ฟังก์ชันล้วน ไม่แตะ DOM และไม่ใช้ three.js
   หน่วย: ความยาวคลื่น nm, พลังงาน eV, แรงดัน V (บวกเมื่อแอโนดเป็นบวก), กระแส nA */

const HC = 1239.841984;          // eV·nm
const C = 2.99792458e17;         // nm/s
export const E_CHARGE = 1.602176634e-19;  // C
export const H_TRUE = 6.62607015e-34;     // J·s

export const PHI = 2.00;         // ฟังก์ชันงานของแคโทด (ค่าสมมติ)
const V0 = 1.5;                  // ความกว้างช่วงที่กระแสเข้าสู่ค่าอิ่มตัว
const NOISE = .003;              // สัญญาณรบกวนแปรตามกระแส

/* แสงที่เลือกได้จากปุ่มหมุน isat4 = กระแสอิ่มตัวที่ช่องรับแสง 4 mm (ค่าสมมติ)
   color เป็นสีที่ใช้แสดงผล ส่วน 365 nm เป็นรังสี UV มองไม่เห็นจริง */
export const SOURCES = [
  {k: "off", label: "ปิดแสง", nm: null, isat4: 0, color: null},
  {k: "365", label: "365 nm", nm: 365.02, isat4: 6, color: 0x7f3dff, hg: true},
  {k: "405", label: "405 nm", nm: 404.66, isat4: 5, color: 0x9a2bff, hg: true},
  {k: "436", label: "436 nm", nm: 435.83, isat4: 8, color: 0x2f62ff, hg: true},
  {k: "546", label: "546 nm", nm: 546.07, isat4: 10, color: 0x7dff2a, hg: true},
  {k: "579", label: "579 nm", nm: 579.07, isat4: 4, color: 0xffd21f, hg: true},
  {k: "led", label: "LED 650 nm", nm: 650, isat4: 10, color: 0xff2a14}
];
export const SOURCE = Object.fromEntries(SOURCES.map(s => [s.k, s]));
export const HG = SOURCES.filter(s => s.hg);
export const APERTURES = [2, 4, 8];

export const photonEV = nm => HC / nm;
export const freq = nm => C / nm;
export const apFactor = ap => (ap / 4) ** 2;

/* ศักย์หยุดยั้ง V_s = (hf − φ)/e ไม่ขึ้นกับความเข้ม คืน 0 เมื่อพลังงานโฟตอนไม่ถึง φ */
export const stopV = src => src.nm && photonEV(src.nm) > PHI ? photonEV(src.nm) - PHI : 0;

/* ปริมาณแสงที่เข้ากล่อง เทียบเป็นกระแสถ้าทุกโฟตอนทำให้อิเล็กตรอนหลุดได้ */
export const lightLevel = (src, ap) => src.isat4 * apFactor(ap);
export const isat = (src, ap) => stopV(src) > 0 ? lightLevel(src, ap) : 0;

/* กระแสจริงในวงจร */
export function current(V, src, ap) {
  const Vs = stopV(src), u = V + Vs;
  if (Vs <= 0 || u <= 0) return 0;
  return isat(src, ap) * (1 - Math.exp(-((u / V0) ** 2)));
}

/* ค่าที่จอ Picoammeter แสดง ละเอียด 0.001 nA z คือเลขสุ่มแจกแจงปกติ ถ้ากระแสเป็นศูนย์จออ่าน 0.000 นิ่ง */
export const display = (I, z = 0) => I <= 0 ? 0 : Math.round(I * (1 + NOISE * z) * 1000) / 1000;

/* แรงดัน (ปรับทีละ 0.01 V จาก 0 ลงไป) ที่จอเพิ่งอ่านเป็นศูนย์ */
export function zeroV(src, ap) {
  for (let k = 0; k <= 400; k++) if (display(current(-k / 100, src, ap)) === 0) return -k / 100;
  return NaN;
}

/* กำลังสองน้อยสุด y = m x + c */
export function fit(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
  const m = sxy / sxx;
  return {m, c: my - m * mx, mx, my, sxy, sxx};
}

/* จากข้อมูล [{nm, vs}] หา h/e จากความชัน φ จากจุดตัดแกน และความถี่ขีดเริ่ม */
export function analyze(points) {
  const r = fit(points.map(p => freq(p.nm)), points.map(p => p.vs));
  const h = r.m * E_CHARGE, phi = -r.c;
  return {...r, slope: r.m, h, phi, f0: phi / r.m, errPct: (h - H_TRUE) / H_TRUE * 100};
}
