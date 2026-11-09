/* lab-core.js — ส่วนกลางของทุกการทดลอง
   - createScene: renderer, scene, แสง, กล้อง tween, OrbitControls, ป้าย, การคลิก/ลากในฉาก และลูปเรนเดอร์
   - createPanel: แผงขั้นตอน (stepper, ย้อนกลับ, "ทำขั้นนี้ให้", ถัดไป, goTo)
   แต่ละการทดลองส่ง STEPS, ok, AUTO และฉากอุปกรณ์ของตัวเองเข้ามา
   หลัก: ปุ่มเปลี่ยนค่าในสถานะ S แล้วให้ frame() ขยับฉากตาม ไม่สั่งย้ายวัตถุตรง ๆ
   ต้องโหลด three.js 0.147.0 และ OrbitControls แบบ <script> ก่อน (ใช้ window.THREE) */

import {VERSION} from "./version.js";

const THREE = window.THREE;

export const $ = id => document.getElementById(id);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const fmt = (v, n = 1) => Number.isFinite(v) ? v.toFixed(n) : "–";
export const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- ฉาก ---------- */
export function createScene({
  stage = $("stage"),
  background = 0xe6e8e4,
  camPos = [55, 52, 80],
  look: look0 = [0, 20, 20],
  isFree = () => true          // true เมื่อผู้ใช้หมุนกล้องเองได้
} = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({antialias: true}); }
  catch (e) {
    $("labels").innerHTML = '<div id="fail">อุปกรณ์นี้เปิด WebGL ไม่ได้ จึงแสดงฉาก 3 มิติไม่ได้ ลองเปิดด้วย Chrome หรือ Edge บนคอมพิวเตอร์</div>';
    throw e;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene(); scene.background = new THREE.Color(background);
  const camera = new THREE.PerspectiveCamera(40, 1, .3, 1500);
  camera.position.set(...camPos);

  const hemi = new THREE.HemisphereLight(0xdfe7ee, 0x2a2620, 1); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff3e0, 1); key.position.set(60, 130, 70); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {left: -130, right: 130, top: 130, bottom: -130, far: 360});
  scene.add(key);

  /* ตัวช่วยสร้างวัตถุ */
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({color: c, roughness: .75, metalness: 0, ...o});
  function box(w, h, d, mat, x = 0, y = 0, z = 0, parent = scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  }
  function cyl(r, h, mat, x = 0, y = 0, z = 0, parent = scene, r2 = r) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, 24), mat);
    m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
  }
  function canvasTex(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  }

  /* กล้อง: tween ไปยัง tw.pos / tw.look / tw.fov */
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.maxPolarAngle = Math.PI * .49;
  controls.minDistance = 12; controls.maxDistance = 420;
  const look = new THREE.Vector3(...look0);
  const tw = {pos: camera.position.clone(), look: look.clone(), fov: 40, active: true};
  let W = 1, H = 1;
  /* จอแคบ (เช่นมือถือแนวตั้ง) ถอยกล้องออกให้เห็นอุปกรณ์ครบ */
  const aspectFit = off => { const a = W / H; return a < 1.35 ? off.multiplyScalar(Math.pow(1.35 / a, .95)) : off; };
  function tween(pos, at, fov = 40) { tw.pos = pos; tw.look = at; tw.fov = fov; tw.active = true; }

  /* ป้ายกำกับ HTML ที่ตามตำแหน่ง 3 มิติ */
  const labels = [];
  function addLabel(text, posFn, visFn, cls = "") {
    const el = document.createElement("div"); el.className = "lb " + cls; el.innerHTML = text; el.hidden = true;
    $("labels").appendChild(el);
    const o = {el, posFn, visFn}; labels.push(o); return o;
  }

  /* การคลิกและลากวัตถุในฉาก */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const dom = renderer.domElement;
  function pick(ev) {
    const r = dom.getBoundingClientRect();
    ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  let drag = null, hooks = {hitTest: () => null, onDown: () => null, onDrag: () => {}};
  /* hitTest() → เป้าหมายหรือ null, onDown(hit) → ข้อมูลการลาก (หรือ null ถ้าเป็นการคลิก), onDrag(drag) */
  const interact = h => { hooks = {...hooks, ...h}; };
  dom.addEventListener("pointerdown", ev => {
    pick(ev); const h = hooks.hitTest(); if (!h) return;
    controls.enabled = false;
    const d = hooks.onDown(h, ev);
    if (d) { drag = d; dom.setPointerCapture(ev.pointerId); }
  });
  dom.addEventListener("pointermove", ev => {
    pick(ev);
    if (!drag) { dom.style.cursor = hooks.hitTest() ? "pointer" : (isFree() ? "grab" : "default"); return; }
    hooks.onDrag(drag, ev);
  });
  const endDrag = () => { drag = null; controls.enabled = isFree() && !tw.active; };
  dom.addEventListener("pointerup", endDrag); dom.addEventListener("pointercancel", endDrag);

  /* ขนาดจอ */
  const core = {};
  function resize() {
    W = stage.clientWidth || 1; H = stage.clientHeight || 1;
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    core.onResize && core.onResize();
  }
  new ResizeObserver(resize).observe(stage);

  /* ลูปเรนเดอร์: กล้อง → frame ของกิจกรรม → เรนเดอร์ → ป้าย
     frame(dt, k, kFast): k และ kFast คือสัดส่วนการเข้าหาค่าเป้าหมายในเฟรมนี้ */
  let last = performance.now(), frameFn = () => {};
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(.12, (now - last) / 1000); last = now;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 4.2), kFast = reduce ? 1 : 1 - Math.exp(-dt * 7);
    if (tw.active) {
      camera.position.lerp(tw.pos, k); look.lerp(tw.look, k);
      camera.fov += (tw.fov - camera.fov) * k; camera.updateProjectionMatrix(); camera.lookAt(look);
      controls.enabled = false;
      if (camera.position.distanceTo(tw.pos) < .05 && look.distanceTo(tw.look) < .05 && Math.abs(camera.fov - tw.fov) < .03) {
        camera.position.copy(tw.pos); look.copy(tw.look); camera.fov = tw.fov; camera.updateProjectionMatrix(); camera.lookAt(look);
        tw.active = false;
        if (isFree()) { controls.target.copy(look); controls.enabled = true; controls.update(); }
      }
    } else if (isFree()) { controls.update(); }
    frameFn(dt, k, kFast);
    renderer.render(scene, camera);
    for (const l of labels) {
      if (!l.visFn()) { if (!l.el.hidden) l.el.hidden = true; continue; }
      const p = l.posFn().project(camera);
      if (p.z > 1) { l.el.hidden = true; continue; }
      l.el.hidden = false;
      const x = (p.x + 1) / 2 * W, y = (1 - p.y) / 2 * H, bw = l.el.offsetWidth, bh = l.el.offsetHeight;
      l.el.style.transform = `translate(${clamp(x - bw / 2, 4, Math.max(4, W - bw - 4))}px,${clamp(y - bh / 2, 4, Math.max(4, H - bh - 4))}px)`;
    }
  }
  function start(frame) { frameFn = frame; resize(); requestAnimationFrame(tick); }

  return Object.assign(core, {
    THREE, renderer, scene, camera, controls, hemi, key, look, tw, dom, ray,
    get W() { return W; }, get H() { return H; },
    std, box, cyl, canvasTex, aspectFit, tween, addLabel, labels, pick, interact, resize, start,
    onResize: null
  });
}

/* ---------- แผงขั้นตอน ----------
   steps[n] = {t, doc?, html(), bind?(), live() → ["yes"|"no", ข้อความ]}
   ok[n]() → ผ่านขั้นนี้หรือยัง, auto[n]() → ทำขั้นนี้ให้ (ต้องแก้แค่สถานะ)
   notice: ข้อความแจ้งชั่วคราว ขึ้นต้นด้วย "bad:" เมื่อเป็นข้อผิดพลาด */
export function createPanel({
  steps, ok, auto, getStep, setStep,
  docLabel = "ใบกิจกรรม",       // ถ้าไม่มีใบกิจกรรมจริงให้ใช้ "วิธีทดลอง"
  finishLabel = "ดูผล",
  onFinish = () => {},          // กดปุ่มถัดไปที่ขั้นสุดท้าย
  beforeGoTo, onEnter, afterAuto, afterRender, afterLive
}) {
  const N = Object.keys(steps).length;
  const P = {notice: "", N, render, live, goTo};
  $("stepper").style.setProperty("--steps", N);
  document.querySelector("#head .home")?.insertAdjacentHTML("afterend", `<span class="ver">v${VERSION}</span>`);
  const docBlock = t => t ? `<p class="doc"><b>${docLabel}</b>${t}</p>` : "";

  function render() {
    const n = getStep(), st = steps[n];
    $("body").innerHTML = `<h2>${n}. ${st.t}</h2>${docBlock(st.doc)}${st.html()}<p id="ok" role="status"></p>`;
    st.bind && st.bind();
    $("stepper").innerHTML = Object.keys(steps).map(i =>
      `<button type="button" data-n="${i}" aria-label="ขั้นที่ ${i} ${steps[i].t}" title="${steps[i].t}" class="${+i === n ? "on" : ""} ${ok[i]() ? "done" : ""}">${i}</button>`).join("");
    $("stepper").querySelectorAll("button").forEach(b => b.onclick = () => goTo(+b.dataset.n));
    live();
    afterRender && afterRender();
  }
  function live() {
    const n = getStep(), [cls, msg] = steps[n].live(), o = $("ok"), notice = P.notice;
    if (o) {
      if (notice.startsWith("bad:")) { o.className = "bad"; o.textContent = notice.slice(4); }
      else if (notice) { o.className = "no"; o.textContent = notice; }
      else { o.className = cls; o.textContent = (cls === "yes" ? "✓ " : "") + msg; }
    }
    $("next").disabled = n < N ? !ok[n]() : false;
    $("next").textContent = n === N ? finishLabel : "ขั้นถัดไป";
    $("back").disabled = n === 1;
    $("stepper").querySelectorAll("button").forEach(b => b.classList.toggle("done", ok[+b.dataset.n]()));
    if (ok[n]() && !P.notice.startsWith("bad:")) P.notice = "";
    afterLive && afterLive();
  }
  /* กระโดดไปขั้น n: ทำขั้นก่อนหน้าที่ยังไม่ผ่านให้อัตโนมัติ */
  function goTo(n) {
    beforeGoTo && beforeGoTo(n);
    for (let i = 1; i < n; i++) if (!ok[i]()) auto[i]();
    setStep(n);
    onEnter && onEnter(n);
    render();
  }
  $("back").onclick = () => { const n = getStep(); if (n > 1) goTo(n - 1); };
  $("next").onclick = () => { const n = getStep(); if (n < N) goTo(n + 1); else onFinish(); };
  $("auto").onclick = () => { const n = getStep(); P.notice = ""; auto[n](); afterAuto && afterAuto(n); render(); };
  return P;
}
