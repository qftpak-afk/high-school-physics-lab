/* ฟิสิกส์ของกิจกรรมการสลายตัว: ฟังก์ชันล้วน ไม่แตะ DOM และไม่ใช้ three.js
   หน่วย: เวลา s (แสดงผลในหน่วยของสาร), ระยะ cm, อัตรานับเป็นนับต่อวินาที */

export const DAY = 86400;
export const YEAR = 365.25 * DAY;

export const R0 = 60;            // อัตรานับเริ่มต้นที่ระยะอ้างอิง (ค่าสมมติ)
export const B_RATE = .5;        // อัตรานับพื้นหลัง (ค่าสมมติ)
export const D_REF = 5;          // ระยะอ้างอิง (cm)
export const GATE = 10;          // เวลานับแต่ละรอบ (s)
export const N_READ = 16;        // จำนวนรอบที่ต้องบันทึก

/* step = เวลาระหว่างจุดเริ่มนับของแต่ละรอบ */
export const SAMPLES = [
  {k: "ba", name: "Ba-137m", T: 153, half: "2.55 นาที", step: 30, unit: "s", sec: 1},
  {k: "i", name: "I-131", T: 8.02 * DAY, half: "8.02 วัน", step: 2 * DAY, unit: "วัน", sec: DAY},
  {k: "cs", name: "Cs-137", T: 30.1 * YEAR, half: "30.1 ปี", step: 6 * YEAR, unit: "ปี", sec: YEAR}
];
export const SAMPLE = Object.fromEntries(SAMPLES.map(s => [s.k, s]));

export const GATES = [
  {k: "1", label: "1 s", s: 1},
  {k: "10", label: "10 s", s: 10},
  {k: "60", label: "60 s", s: 60},
  {k: "100", label: "100 s", s: 100},
  {k: "inf", label: "∞", s: Infinity},
  {k: "auto", label: "Auto 10 s", s: GATE}
];
export const GATE_OF = Object.fromEntries(GATES.map(g => [g.k, g]));

export const lambda = s => Math.LN2 / s.T;
export const distFactor = d => (D_REF / d) ** 2;

/* อัตรานับจากตัวอย่างที่เวลา t */
export const rate = (s, t, d = D_REF) => R0 * Math.exp(-lambda(s) * t) * distFactor(d);

/* ค่าเฉลี่ยจำนวนนับใน Gate g ที่เริ่มนับเวลา t รวมพื้นหลัง s = null คือไม่มีตัวอย่าง */
export function meanCounts(s, t, g, d = D_REF) {
  if (!s) return B_RATE * g;
  const L = lambda(s);
  return R0 * distFactor(d) * Math.exp(-L * t) * -Math.expm1(-L * g) / L + B_RATE * g;
}

/* สุ่มแบบ Poisson rng คืนเลขสุ่ม 0–1 */
export function poisson(mean, rng = Math.random) {
  if (mean <= 0) return 0;
  if (mean < 40) {
    const L = Math.exp(-mean); let k = 0, p = 1;
    do { k++; p *= rng(); } while (p > L);
    return k - 1;
  }
  const z = Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());
  return Math.max(0, Math.round(mean + Math.sqrt(mean) * z));
}

/* ตัวสร้างเลขสุ่มแบบกำหนด seed สำหรับทดสอบ */
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* กำลังสองน้อยสุด y = m x + c */
export function fit(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
  const m = sxy / sxx;
  return {m, c: my - m * mx, mx, my};
}

/* แถวข้อมูลหลังหักพื้นหลัง: reads = [{t (s), n}], bg = พื้นหลังต่อ Gate */
export const netRows = (reads, bg) => reads.map(r => ({...r, net: r.n - bg, ln: r.n - bg > 0 ? Math.log(r.n - bg) : null}));

/* ความชันของ ln(N − B) กับ t ในหน่วยเวลาของสาร ให้ λ และครึ่งชีวิต */
export function analyze(s, reads, bg) {
  const rows = netRows(reads, bg).filter(r => r.ln != null);
  const r = fit(rows.map(p => p.t / s.sec), rows.map(p => p.ln));
  const lam = -r.m, half = Math.LN2 / lam, trueHalf = s.T / s.sec;
  return {...r, lam, half, trueHalf, errPct: (half - trueHalf) / trueHalf * 100, used: rows.length};
}
