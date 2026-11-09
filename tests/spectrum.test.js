import {test} from "node:test";
import assert from "node:assert/strict";
import {GAS, TUBES, dCm, lineX, solve, trueReading, wlAt} from "../public/labs/atomic/spectrum/physics.js";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ได้ ${a} คาด ${b} ±${tol}`);

test("เกณฑ์ผ่านระยะ 1: H แดงที่ D = 100 cm ได้ x = 36.91 cm", () => {
  near(lineX(656.28, 100, 13400), 36.91, .005);
});

test("d = 2.54 / เส้นต่อนิ้ว", () => {
  near(dCm(13400), 1.8955e-4, 1e-8);
});

test("solve ย้อนกลับ lineX ได้ความยาวคลื่นเดิมทุกเส้นที่ให้อ่าน", () => {
  for (const g of TUBES) for (const r of GAS[g].read) {
    const x = lineX(r.nm, 100, 13400);
    near(solve(x, 100, 13400).nm, r.nm, 1e-6, `${g} ${r.c}`);
  }
});

test("อันดับที่ sinθ ≥ 1 ไม่มีภาพ", () => {
  assert.equal(lineX(656.28, 100, 13400, 3), Infinity);
});

test("ขีด 50 ไม่ตรงหลอดทำให้ x สองข้างต่างกัน แต่ค่าเฉลี่ยยังให้ λ ใกล้ค่าจริง", () => {
  const st = {D: 100, lpi: 13400, err: 1.5}, nm = 656.28;
  const L = trueReading(nm, "L", st), R = trueReading(nm, "R", st);
  const xL = Math.abs(L - 50), xR = Math.abs(R - 50);
  assert.notEqual(xL.toFixed(2), xR.toFixed(2));
  near(solve((xL + xR) / 2, 100, 13400).nm, nm, 1e-6);
});

test("แถบต่อเนื่อง: ความยาวคลื่นที่ X = x ของเส้นตรงกับเส้นนั้น", () => {
  const x = lineX(546.07, 100, 13400);
  near(wlAt(x, 100, 13400), 546.07, 1e-6);
});

test("เส้นที่ให้อ่านทุกเส้นอยู่บนไม้เมตร (0–100 cm) ที่ D = 100 cm", () => {
  for (const g of TUBES) for (const r of GAS[g].read) for (const sd of ["L", "R"]) {
    const v = trueReading(r.nm, sd, {D: 100, lpi: 13400, err: 0});
    assert.ok(v > 0 && v < 100, `${g} ${r.c} ${sd} = ${v}`);
  }
});
