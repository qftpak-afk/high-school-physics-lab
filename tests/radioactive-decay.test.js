import {test} from "node:test";
import assert from "node:assert/strict";
import {B_RATE, GATE, N_READ, SAMPLE, SAMPLES, analyze, distFactor, lambda, makeRng, meanCounts, netRows, poisson} from "../public/labs/nuclear/radioactive-decay/physics.js";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ได้ ${a} คาด ${b} ±${tol}`);

test("ค่าเฉลี่ยจำนวนนับของ Ba-137m ตรงตารางใน plan.md", () => {
  for (const [t, n] of [[0, 592], [30, 517], [150, 302], [300, 156], [450, 81]]) near(meanCounts(SAMPLE.ba, t, GATE), n, .5, `t=${t}`);
});

test("I-131 และ Cs-137 รอบแรกและรอบสุดท้ายตรงตาราง", () => {
  for (const [k, first, last] of [["i", 605, 50], ["cs", 605, 81]]) {
    const s = SAMPLE[k];
    near(meanCounts(s, 0, GATE), first, .5, `${k} แรก`);
    near(meanCounts(s, (N_READ - 1) * s.step, GATE), last, .5, `${k} สุดท้าย`);
  }
});

test("ไม่มีตัวอย่างได้เฉพาะพื้นหลัง", () => {
  assert.equal(meanCounts(null, 0, 100), B_RATE * 100);
});

test("อัตรานับแปรผกผันกับกำลังสองของระยะ แต่ครึ่งชีวิตไม่เปลี่ยน", () => {
  near(distFactor(10), .25, 1e-12);
  const s = SAMPLE.ba, reads = [...Array(N_READ).keys()].map(i => ({t: i * s.step, n: meanCounts(s, i * s.step, GATE, 10)}));
  near(analyze(s, reads, B_RATE * GATE).half, 153, .01);
});

test("ครึ่งชีวิตจากข้อมูลไร้สุ่มกลับมาเท่าค่าจริงทุกสาร", () => {
  for (const s of SAMPLES) {
    const reads = [...Array(N_READ).keys()].map(i => ({t: i * s.step, n: meanCounts(s, i * s.step, GATE)}));
    const r = analyze(s, reads, B_RATE * GATE);
    near(r.errPct, 0, .01, s.k);
    near(r.lam, lambda(s) * s.sec, 1e-6 * r.lam, s.k);
  }
});

test("การสุ่ม Poisson มีค่าเฉลี่ยและความแปรปรวนตรงค่าเฉลี่ยที่ตั้งไว้", () => {
  for (const m of [.3, 5, 39, 41, 300]) {
    const rng = makeRng(42 + Math.round(m)), n = 40000, a = Array.from({length: n}, () => poisson(m, rng));
    const avg = a.reduce((p, q) => p + q, 0) / n, v = a.reduce((p, q) => p + (q - avg) ** 2, 0) / n;
    near(avg / m, 1, m < 1 ? .05 : .02, `เฉลี่ย ${m}`);
    near(v / m, 1, .08, `แปรปรวน ${m}`);
  }
});

test("เกณฑ์: เดินครบ 16 รอบแล้ว T½ คลาดไม่เกิน 10% เกือบทุกครั้ง ทุกสาร", () => {
  for (const s of SAMPLES) {
    const rng = makeRng(7), R = 3000; let good = 0;
    for (let i = 0; i < R; i++) {
      const bg = poisson(B_RATE * 100, rng) / 100 * GATE;
      const reads = [...Array(N_READ).keys()].map(j => ({t: j * s.step, n: poisson(meanCounts(s, j * s.step, GATE), rng)}));
      if (Math.abs(analyze(s, reads, bg).errPct) <= 10) good++;
    }
    assert.ok(good / R > .98, `${s.k} ${good / R}`);
  }
});

test("แถวที่ N − B ไม่เป็นบวกไม่นำไปคิด ln", () => {
  const rows = netRows([{t: 0, n: 100}, {t: 30, n: 3}], 5);
  assert.equal(rows[0].net, 95);
  assert.equal(rows[1].ln, null);
  const r = analyze(SAMPLE.ba, [{t: 0, n: 105}, {t: 30, n: 57.5}, {t: 60, n: 4}], 5);
  assert.equal(r.used, 2);
});
