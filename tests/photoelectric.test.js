import {test} from "node:test";
import assert from "node:assert/strict";
import {APERTURES, HG, SOURCE, analyze, current, display, freq, isat, photonEV, stopV, zeroV} from "../public/labs/atomic/photoelectric/physics.js";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ได้ ${a} คาด ${b} ±${tol}`);
const TABLE = [["365", 8.213, 3.397, 1.397], ["405", 7.409, 3.064, 1.064], ["436", 6.879, 2.845, .845], ["546", 5.490, 2.270, .270], ["579", 5.177, 2.141, .141]];

test("เกณฑ์ผ่านระยะ 2: f, E และ V_s ตรงตารางใน plan.md", () => {
  for (const [k, f, E, Vs] of TABLE) {
    const s = SOURCE[k];
    near(freq(s.nm) / 1e14, f, .001, `f ${k}`);
    near(photonEV(s.nm), E, .001, `E ${k}`);
    near(stopV(s), Vs, .001, `V_s ${k}`);
  }
});

test("ความเข้มเปลี่ยนกระแสอิ่มตัวแต่ไม่เปลี่ยนจุดที่กระแสเริ่มเป็นศูนย์จริง", () => {
  for (const s of HG) {
    assert.equal(isat(s, 8) / isat(s, 2), 16);
    for (const ap of APERTURES) {
      assert.equal(current(-stopV(s) - .001, s, ap), 0);
      assert.ok(current(-stopV(s) + .05, s, ap) > 0, `${s.k} ${ap}`);
    }
  }
});

test("V_s ที่อ่านจากจอระหว่างช่อง 2 กับ 8 mm ต่างกันไม่เกิน 0.03 V", () => {
  for (const s of HG) assert.ok(Math.abs(zeroV(s, 8) - zeroV(s, 2)) <= .03 + 1e-9, s.k);
});

test("V_s ที่อ่านจากจอคลาดจากค่าจริงไม่เกินเกณฑ์ตรวจ ±0.03 V ที่ช่อง 4 mm และขั้นเปลี่ยนความเข้ม", () => {
  for (const s of HG) near(-zeroV(s, 4), stopV(s), .03, `4 mm ${s.k}`);
  for (const ap of APERTURES) near(-zeroV(SOURCE["436"], ap), stopV(SOURCE["436"]), .03, `436 ${ap} mm`);
});

test("LED 650 nm ไม่เกิดกระแสแม้แรงดันสูงและช่องรับแสงกว้าง และปิดแสงได้กระแสศูนย์", () => {
  assert.equal(current(10, SOURCE.led, 8), 0);
  assert.equal(current(10, SOURCE.off, 8), 0);
  assert.equal(stopV(SOURCE.led), 0);
});

test("แรงดันบวกมากพอ กระแสเข้าสู่ค่าอิ่มตัว", () => {
  near(current(5, SOURCE["436"], 4), 8, .001);
});

test("จอละเอียด 0.001 nA และเมื่อกระแสเป็นศูนย์จออ่านศูนย์นิ่งแม้มีสัญญาณรบกวน", () => {
  assert.equal(display(.32749), .327);
  assert.equal(display(0, 3), 0);
  near(display(10, 1), 10.03, 1e-9);
});

test("least squares คืน h/e = 4.136×10⁻¹⁵ V·s และ φ = 2.00 eV จากข้อมูลไร้สัญญาณรบกวน", () => {
  const r = analyze(HG.map(s => ({nm: s.nm, vs: stopV(s)})));
  near(r.slope / 1e-15, 4.136, .001);
  near(r.phi, 2, 1e-6);
  near(r.f0 / 1e14, 4.836, .001);
  near(r.errPct, 0, .01);
});

test("ข้อมูลตามขั้นตอนจริงที่ช่อง 4 mm ได้ h คลาดไม่เกิน 5%", () => {
  const r = analyze(HG.map(s => ({nm: s.nm, vs: -zeroV(s, 4)})));
  assert.ok(Math.abs(r.errPct) <= 5, `${r.errPct}%`);
});
