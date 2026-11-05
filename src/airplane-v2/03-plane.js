/* ═══ PROCEDURAL BOEING 747 ═══
   Model space (metres): +X = nose, +Y = up, +Z = right wing.
   Fuselage centre-line at y=0; ground (gear down) at y = GEAR_GROUND.
   plane.root sits on the ground at the main-gear contact point. */
const XN = 35.3, XT = -35.5, GEAR_GROUND = -6.0, ROOT_X = -5.0;

/* ── fuselage profile ── */
function prof(x) {
  let w, top, bot;
  if (x > 26) { const t = clamp((XN - x) / 9.3, 0, 1); const e = Math.sqrt(1 - (1 - t) * (1 - t)); w = 3.25 * e; bot = -0.8 - 2.4 * e; }
  else if (x < -18) { const s = clamp((-18 - x) / 17.5, 0, 1); w = 3.25 * (1 - .95 * Math.pow(s, 2.2)); bot = -3.2 + 4.8 * Math.pow(s, 1.6); }
  else { w = 3.25; bot = -3.2; }
  if (x > 24) { const t = clamp((XN - x) / 11.3, 0, 1); const e = Math.sqrt(1 - Math.pow(1 - t, 3)); top = -0.8 + 6.4 * e; }
  else if (x > 10) top = 5.6;
  else if (x > 0) top = 3.3 + 2.3 * (.5 - .5 * Math.cos(Math.PI * x / 10));
  else if (x > -20) top = 3.3;
  else { const s = clamp((-20 - x) / 15.5, 0, 1); top = 3.3 - .9 * s * s; }
  const yc = (bot + Math.min(top, 3.3)) / 2;
  return { w, top, bot, yc, ht: top - yc, hb: yc - bot };
}
const SE = 2 / 2.2; // superellipse exponent
const spow = v => Math.sign(v) * Math.pow(Math.abs(v), SE);
function fusePt(x, th, shrink = 1, P = null) {
  const p = P || prof(x), c = Math.cos(th), s = Math.sin(th);
  const y = p.yc + (c >= 0 ? p.ht : p.hb) * spow(c) * shrink;
  const z = p.w * spow(s) * shrink;
  return new THREE.Vector3(x, y, z);
}
// θ (0=top, π/2=right, π=bottom, 3π/2=left) where the surface reaches height y
function thetaForY(x, y, side) {
  let a = 0, b = Math.PI; const p = prof(x);
  for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (fusePt(x, m, 1, p).y > y) a = m; else b = m; }
  const t = (a + b) / 2; return side === 'L' ? Math.PI * 2 - t : t;
}
function fuselageGeom(x0, x1, nx, nt, shrink = 1) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nx; i++) {
    const x = lerp(x0, x1, i / nx), P = prof(x);
    for (let j = 0; j <= nt; j++) {
      const th = j / nt * Math.PI * 2, p = fusePt(x, th, shrink, P);
      pos.push(p.x, p.y, p.z); uv.push((x - XT) / (XN - XT), th / (Math.PI * 2));
    }
  }
  const W = nt + 1;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nt; j++) {
    const a = i * W + j, b = (i + 1) * W + j, c = i * W + j + 1, d = (i + 1) * W + j + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
// Window / door layout shared by livery, glow map and cabin shell
const DOORS_X = [26.2, 18.4, 6.2, -8.2, -20.4];
const WINDOWS = (() => {
  const out = [];
  for (let x = -27.5; x <= 27.6; x += .51) { if (DOORS_X.some(d => Math.abs(d - x) < .95)) continue; out.push({ x, y: .75, w: .26, h: .38 }); }
  for (let x = 12.4; x <= 24.6; x += .56) out.push({ x, y: 4.35, w: .24, h: .34 });
  return out;
})();
// cockpit panes in (x0,x1,θ0,θ1) for the right side; mirrored for left
const PANES = [[32.15, 33.0, .045, .62], [31.25, 32.05, .7, 1.15], [30.3, 31.15, .78, 1.22]];

/* ── livery painting ── */
const LW = 4096, LH = 1024;
const toPx = (x, th) => [(x - XT) / (XN - XT) * LW, (1 - th / (Math.PI * 2)) * LH];
function liveryColors(al) {
  const p = al.p, s = al.s, pw = isWhite(p) || p.toLowerCase() === '#d8d8d8';
  return { body: '#f4f4f1', belly: pw && p.toLowerCase() === '#d8d8d8' ? '#c9ccd0' : '#d9dce0',
    line: pw ? s : p, line2: pw ? s : s, tail: pw ? s : p, tailText: '#fff', title: pw ? s : p };
}
function paintBand(g, side, x0, x1, y0, y1, color) {
  g.fillStyle = color; g.beginPath();
  const pts = [];
  for (let x = x0; x <= x1 + 1e-6; x += .5) pts.push(toPx(x, thetaForY(x, y0, side)));
  for (let x = x1; x >= x0 - 1e-6; x -= .5) pts.push(toPx(x, thetaForY(x, y1, side)));
  pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
}
function paintRect(g, side, x, y, w, h, fill, radius = 0, stroke = null) {
  const a = toPx(x - w / 2, thetaForY(x, y + h / 2, side)), b = toPx(x + w / 2, thetaForY(x, y - h / 2, side));
  const X = Math.min(a[0], b[0]), Y = Math.min(a[1], b[1]), W = Math.abs(b[0] - a[0]), H = Math.abs(b[1] - a[1]);
  g.beginPath();
  if (g.roundRect && radius) g.roundRect(X, Y, W, H, Math.min(radius, W / 2, H / 2)); else g.rect(X, Y, W, H);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); }
}
function paintPanes(g, color) {
  g.fillStyle = color;
  PANES.forEach(([x0, x1, t0, t1]) => {
    [[t0, t1], [Math.PI * 2 - t1, Math.PI * 2 - t0]].forEach(([a, b]) => {
      const p0 = toPx(x0, a), p1 = toPx(x1, b);
      g.fillRect(Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.abs(p1[0] - p0[0]), Math.abs(p1[1] - p0[1]));
    });
  });
}
function paintTitle(g, side, text, x0, x1, y0, y1, color) {
  const a = toPx(x0, thetaForY(x0, y1, side)), b = toPx(x1, thetaForY(x1, y0, side));
  const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, W = Math.abs(b[0] - a[0]), H = Math.abs(b[1] - a[1]);
  g.save(); g.translate(cx, cy); g.scale(side === 'L' ? -1 : 1, side === 'R' ? -1 : 1);
  let fs = H * .95; g.font = `900 ${fs}px Helvetica, Arial, sans-serif`;
  const tw = g.measureText(text).width; if (tw > W) { fs *= W / tw; g.font = `900 ${fs}px Helvetica, Arial, sans-serif`; }
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 0); g.restore();
}
function liveryTextures(al) {
  const C = liveryColors(al);
  const c = makeCanvas(LW, LH), g = c.getContext('2d');
  g.fillStyle = C.body; g.fillRect(0, 0, LW, LH);
  // belly
  const b0 = (1 - (Math.PI + 1.0) / (Math.PI * 2)) * LH, b1 = (1 - (Math.PI - 1.0) / (Math.PI * 2)) * LH;
  const gr = g.createLinearGradient(0, b0, 0, b1); gr.addColorStop(0, C.body); gr.addColorStop(.2, C.belly); gr.addColorStop(.8, C.belly); gr.addColorStop(1, C.body);
  g.fillStyle = gr; g.fillRect(0, b0, LW, b1 - b0);
  ['L', 'R'].forEach(side => {
    paintBand(g, side, -31, 33.2, -.15, -.85, C.line);
    paintBand(g, side, -29, 32.6, -1.0, -1.18, C.line2);
    WINDOWS.forEach(w => paintRect(g, side, w.x, w.y, w.w, w.h, '#27323f', 9));
    DOORS_X.forEach(x => paintRect(g, side, x, .05, 1.07, 1.95, null, 14, 'rgba(90,95,105,.55)'));
    paintTitle(g, side, al.name.toUpperCase(), -17, -1, 1.7, 2.75, C.title);
  });
  paintPanes(g, '#1a2430');
  // nose radome slightly darker
  const nx = toPx(34.6, 0)[0]; g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(nx, 0, LW - nx, LH);
  // emissive (cabin lights at night)
  const e = makeCanvas(LW / 2, LH / 2), eg = e.getContext('2d'); eg.fillStyle = '#000'; eg.fillRect(0, 0, LW / 2, LH / 2);
  eg.scale(.5, .5);
  ['L', 'R'].forEach(side => WINDOWS.forEach(w => paintRect(eg, side, w.x, w.y, w.w * .8, w.h * .8, '#ffd9a0', 8)));
  paintPanes(eg, '#203040');
  return { map: canvasTex(c), emissive: canvasTex(e), colors: C };
}

/* ── lofted lifting surfaces ── */
function naca(s, tc) { s = clamp(s, 0, 1); return 5 * tc * (.2969 * Math.sqrt(s) - .126 * s - .3516 * s * s + .2843 * s ** 3 - .1036 * s ** 4); }
function camberLine(s, m) { const p = .4; return s < p ? m * (2 * p * s - s * s) / (p * p) : m * ((1 - 2 * p) + 2 * p * s - s * s) / ((1 - p) ** 2); }
function surfPt(sec, s, sign, o) {
  const t = naca(s, sec.tc) * sign + camberLine(s, sec.camber || 0);
  return sec.le.clone().addScaledVector(o.chordDir, s * sec.chord).addScaledVector(o.thickDir, t * sec.chord);
}
function loft(sections, f0, f1, o) {
  const nC = o.nC || 14, S = [];
  for (let k = 0; k <= nC; k++) S.push(f0 + (f1 - f0) * (1 - Math.cos(Math.PI * k / nC)) / 2);
  const loop = []; // [s, sign]
  for (let k = nC; k >= 0; k--) loop.push([S[k], 1]);
  for (let k = f0 === 0 ? 1 : 0; k <= nC; k++) loop.push([S[k], -1]);
  const M = loop.length, pos = [], uv = [], idx = [];
  sections.forEach((sec, i) => loop.forEach(([s, sg], j) => {
    const p = surfPt(sec, s, sg, o); pos.push(p.x, p.y, p.z); uv.push(i / (sections.length - 1), j / (M - 1));
  }));
  for (let i = 0; i < sections.length - 1; i++) for (let j = 0; j < M; j++) {
    const j2 = (j + 1) % M; if (j2 === 0 && f1 === 1) continue;
    const a = i * M + j, b = (i + 1) * M + j, c = i * M + j2, d = (i + 1) * M + j2;
    idx.push(a, b, c, c, b, d);
  }
  const capSec = (i) => { const base = pos.length / 3, ctr = new THREE.Vector3();
    loop.forEach(([s, sg]) => { const p = surfPt(sections[i], s, sg, o); ctr.add(p); pos.push(p.x, p.y, p.z); uv.push(0, 0); });
    ctr.divideScalar(M); const ci = pos.length / 3; pos.push(ctr.x, ctr.y, ctr.z); uv.push(0, 0);
    for (let j = 0; j < M; j++) idx.push(ci, base + j, base + (j + 1) % M); };
  if (o.capStart !== false) capSec(0);
  if (o.capEnd !== false) capSec(sections.length - 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function plateOn(sections, f0, f1, o, lift = .02, thick = .05) {
  const n = 6, pos = [], idx = [];
  sections.forEach(sec => { for (let k = 0; k <= n; k++) {
    const s = lerp(f0, f1, k / n); const p = surfPt(sec, s, 1, o);
    const a = p.clone().addScaledVector(o.thickDir, lift), b = p.clone().addScaledVector(o.thickDir, lift - thick);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z); } });
  const R = (n + 1) * 2;
  for (let i = 0; i < sections.length - 1; i++) for (let k = 0; k < n; k++) {
    const t0 = i * R + k * 2, t1 = (i + 1) * R + k * 2; // top
    idx.push(t0, t1, t0 + 2, t0 + 2, t1, t1 + 2, t0 + 1, t0 + 3, t1 + 1, t0 + 3, t1 + 3, t1 + 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// Control surface on a hinge line
function hinged(geom, A, B, mat, chordDir) {
  geom.translate(-A.x, -A.y, -A.z);
  const mesh = new THREE.Mesh(geom, mat); mesh.castShadow = true;
  const pivot = new THREE.Group(); pivot.position.copy(A); pivot.add(mesh);
  const axis = B.clone().sub(A).normalize(); const home = A.clone();
  const q = new THREE.Quaternion();
  return { pivot, mesh, set(angle, extend = 0, drop = 0) {
    q.setFromAxisAngle(axis, angle); pivot.quaternion.copy(q);
    pivot.position.copy(home).addScaledVector(chordDir, extend); pivot.position.y -= drop;
  } };
}
function piecewise(z, zs, vs) {
  if (z <= zs[0]) return vs[0] + (vs[1] - vs[0]) * (z - zs[0]) / (zs[1] - zs[0]);
  for (let i = 0; i < zs.length - 1; i++) if (z <= zs[i + 1]) return lerp(vs[i], vs[i + 1], (z - zs[i]) / (zs[i + 1] - zs[i]));
  const n = zs.length - 1; return vs[n];
}
const WING = {
  zs: [2.0, 12.0, 32.2], le: [6.36, -2.2, -17.6], ch: [15.4, 9.2, 3.9], tc: [.13, .10, .08],
  y: z => -2.1 + (z - 2) * .115,
};
const wingSec = z => ({ le: new THREE.Vector3(piecewise(z, WING.zs, WING.le), WING.y(z), z), chord: piecewise(z, WING.zs, WING.ch), tc: piecewise(z, WING.zs, WING.tc), camber: .02 });
function secRange(fn, a, b, step = 1.2, knots = []) {
  const zs = [a]; const n = Math.max(1, Math.ceil((b - a) / step));
  for (let i = 1; i < n; i++) zs.push(lerp(a, b, i / n));
  knots.forEach(k => { if (k > a && k < b) zs.push(k); }); zs.push(b);
  return [...new Set(zs)].sort((p, q) => p - q).map(fn);
}
const WING_O = { chordDir: new THREE.Vector3(-1, 0, 0), thickDir: new THREE.Vector3(0, 1, 0), nC: 12 };
const HS = { zs: [1.0, 11.1], le: [-25.0, -33.2], ch: [8.6, 3.0], tc: [.10, .08], y: z => 1.4 + (z - 1) * .12 };
const hsSec = z => ({ le: new THREE.Vector3(piecewise(z, HS.zs, HS.le), HS.y(z), z), chord: piecewise(z, HS.zs, HS.ch), tc: piecewise(z, HS.zs, HS.tc), camber: 0 });
const VS = { ys: [2.6, 13.4], le: [-21.5, -32.5], ch: [12.0, 4.0] };
const vsSec = y => ({ le: new THREE.Vector3(piecewise(y, VS.ys, VS.le), y, 0), chord: piecewise(y, VS.ys, VS.ch), tc: .1, camber: 0 });
const VS_O = { chordDir: new THREE.Vector3(-1, 0, 0), thickDir: new THREE.Vector3(0, 0, 1), nC: 12 };

/* ── shared materials (per plane where livery-dependent) ── */
function stdMat(color, rough = .5, metal = .1, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }); }
const MAT = {};
function baseMats() {
  if (MAT.ready) return; MAT.ready = true;
  MAT.wing = stdMat('#c6cbd2', .45, .2, { side: THREE.DoubleSide });
  MAT.wingDark = stdMat('#9aa1aa', .5, .35, { side: THREE.DoubleSide });
  MAT.tire = stdMat('#1b1b1d', .9, 0);
  MAT.hub = stdMat('#9a9ea4', .35, .8);
  MAT.strut = stdMat('#c9ccd0', .3, .85);
  MAT.dark = stdMat('#202327', .7, .2);
  MAT.fan = stdMat('#5d636b', .35, .85, { side: THREE.DoubleSide });
  MAT.chrome = stdMat('#e8ebee', .18, 1);
  MAT.inner = stdMat('#3a3d42', .6, .3, { side: THREE.DoubleSide });
  MAT.black = stdMat('#0b0c0e', .8, 0);
}
function glowSprite(color, size) {
  const m = new THREE.SpriteMaterial({ map: TEX.glow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
}

/* ── engine ── */
function buildEngine(nacMat) {
  const g = new THREE.Group();
  const P = [[1.02, 2.5], [1.1, 3.35], [1.2, 3.66], [1.3, 3.78], [1.43, 3.7], [1.52, 3.3], [1.54, 2.0], [1.47, 0], [1.28, -1.2],
    [.98, -1.3], [.92, -2.5], [.66, -3.5]].map(([r, y]) => new THREE.Vector2(r, y));
  const nac = new THREE.Mesh(new THREE.LatheGeometry(P, 40), nacMat); nac.rotation.z = -Math.PI / 2; nac.castShadow = true; g.add(nac);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.3, .08, 10, 40), MAT.chrome); lip.rotation.y = Math.PI / 2; lip.position.x = 3.74; g.add(lip);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(1.03, 1.03, 1.2, 36, 1, true), MAT.inner); inner.rotation.z = Math.PI / 2; inner.position.x = 2.9; g.add(inner);
  const fan = new THREE.Group(); fan.position.x = 2.55; g.add(fan);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.03, 32), MAT.dark); disc.rotation.y = Math.PI / 2; disc.position.x = -.12; fan.add(disc);
  const bladeG = new THREE.BoxGeometry(.05, .62, .2); bladeG.translate(0, .62, 0);
  for (let i = 0; i < 22; i++) { const b = new THREE.Mesh(bladeG, MAT.fan); b.rotation.x = i / 22 * Math.PI * 2; b.rotateY(.55); fan.add(b); }
  const spin = new THREE.Mesh(new THREE.ConeGeometry(.36, .85, 24), MAT.chrome); spin.rotation.z = -Math.PI / 2; spin.position.x = .4; fan.add(spin);
  // spiral on the spinner so you can SEE it turn
  const sp = new THREE.Mesh(new THREE.BoxGeometry(.02, .5, .05), MAT.black); sp.position.set(.42, .12, 0); sp.rotation.z = -.4; fan.add(sp);
  const plug = new THREE.Mesh(new THREE.ConeGeometry(.42, 1.3, 24), MAT.dark); plug.rotation.z = Math.PI / 2; plug.position.x = -4.0; g.add(plug);
  return { group: g, fan };
}
function pylonGeom(wingLeX, wingY, ex, ey) {
  const s = new THREE.Shape();
  s.moveTo(ex + 1.6, ey + 1.35); s.lineTo(ex - 3.3, ey + 1.2);
  s.lineTo(wingLeX - 5.5, wingY - .2); s.lineTo(wingLeX + .3, wingY - .1); s.lineTo(ex + 2.8, ey + 1.0);
  const g = new THREE.ExtrudeGeometry(s, { depth: .55, bevelEnabled: false }); g.translate(0, 0, -.275); return g;
}

/* ── landing gear ── */
function wheel(r = .62, w = .38) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 22), MAT.tire); t.rotation.x = Math.PI / 2; t.castShadow = true; g.add(t);
  const h = new THREE.Mesh(new THREE.CylinderGeometry(r * .55, r * .55, w + .02, 16), MAT.hub); h.rotation.x = Math.PI / 2; g.add(h);
  return g;
}
function gearLeg(top, len, bogie, axis, sign) {
  const pivot = new THREE.Group(); pivot.position.copy(top);
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, len, 12), MAT.strut); strut.position.y = -len / 2; strut.castShadow = true; pivot.add(strut);
  const axY = -len;
  if (bogie) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.0, .2, .2), MAT.strut); beam.position.y = axY; pivot.add(beam);
    [-.78, .78].forEach(dx => [-.55, .55].forEach(dz => { const w = wheel(); w.position.set(dx, axY, dz); pivot.add(w); }));
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, len * .8, .05), stdMat('#e9e9e6', .5, .1)); door.position.set(0, -len * .45, .32 * sign); pivot.add(door);
  } else {
    [-.36, .36].forEach(dz => { const w = wheel(.55, .32); w.position.set(0, axY, dz); pivot.add(w); });
    const link = new THREE.Mesh(new THREE.BoxGeometry(.5, .1, .1), MAT.strut); link.position.set(.25, -len * .55, 0); link.rotation.z = .5; pivot.add(link);
    const lamp = glowSprite('#fff7e0', 1.2); lamp.position.set(.3, -len * .3, 0); lamp.visible = false; pivot.add(lamp); pivot.userData.lamp = lamp;
  }
  return { pivot, axis, sign };
}

/* ── build ── */
function buildPlane(al, opts = {}) {
  buildBaseTextures(); baseMats();
  const L = liveryTextures(al), C = L.colors;
  const root = new THREE.Group(); root.rotation.order = 'YZX';
  const model = new THREE.Group(); model.position.set(-ROOT_X, -GEAR_GROUND, 0); root.add(model);
  const fuseMat = stdMat('#ffffff', .38, .15, { map: L.map, emissiveMap: L.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 });
  const tailMat = stdMat(C.tail, .4, .15, { side: THREE.DoubleSide });
  const nacMat = stdMat('#eceeed', .35, .25, { side: THREE.DoubleSide });
  const fus = new THREE.Mesh(fuselageGeom(XT, XN, opts.lite ? 70 : 150, opts.lite ? 28 : 56), fuseMat); fus.castShadow = true; fus.receiveShadow = true; model.add(fus);
  // belly fairing
  const fair = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), stdMat(C.belly, .45, .15)); fair.scale.set(15, 1.9, 3.3); fair.position.set(-2, -2.4, 0); fair.castShadow = true; model.add(fair);

  const P = { root, model, fuseMat, flaps: [], le: [], spoilers: [], ailerons: { L: [], R: [] }, elevators: [], rudders: [], fans: [], gear: [], lights: {}, doors: [] };

  // wings, engines, wing gear (built per side; left = mirrored in z)
  ['R', 'L'].forEach(side => {
    const sg = side === 'R' ? 1 : -1;
    const W = new THREE.Group(); W.scale.z = sg; model.add(W);
    const mainG = loft(secRange(wingSec, 2.0, 32.2, 1.4, [12]), .10, .74, WING_O);
    const main = new THREE.Mesh(mainG, MAT.wing); main.castShadow = true; main.receiveShadow = true; W.add(main);
    [[2.0, 3.4], [11.8, 13.0], [28.6, 32.2]].forEach(([a, b]) => { const m = new THREE.Mesh(loft(secRange(wingSec, a, b, 1), .74, 1, WING_O), MAT.wing); m.castShadow = true; W.add(m); });
    const ctl = (a, b, f0, f1, mat) => { const secs = secRange(wingSec, a, b, 1.2, [12]); const g = loft(secs, f0, f1, WING_O);
      const A = surfPt(secs[0], f0, 0, WING_O), B = surfPt(secs[secs.length - 1], f0, 0, WING_O);
      const h = hinged(g, A, B, mat, WING_O.chordDir); W.add(h.pivot); return h; };
    P.flaps.push(ctl(3.4, 11.8, .74, 1, MAT.wing), ctl(13.0, 22.4, .74, 1, MAT.wing));
    P.ailerons[side].push(ctl(22.4, 28.6, .74, 1, MAT.wing));
    [[2.0, 11.0], [12.3, 20.4], [21.7, 30.6]].forEach(([a, b]) => P.le.push(ctl(a, b, 0, .10, MAT.wingDark)));
    [[11.0, 12.3], [20.4, 21.7], [30.6, 32.2]].forEach(([a, b]) => W.add(new THREE.Mesh(loft(secRange(wingSec, a, b, 1), 0, .10, WING_O), MAT.wing)));
    [[4.0, 11.4], [13.4, 22.0]].forEach(([a, b]) => {
      const secs = secRange(wingSec, a, b, 1.2, [12]); const g = plateOn(secs, .60, .73, WING_O);
      const A = surfPt(secs[0], .60, 1, WING_O), B = surfPt(secs[secs.length - 1], .60, 1, WING_O);
      const h = hinged(g, A, B, MAT.wingDark, WING_O.chordDir); W.add(h.pivot); P.spoilers.push(h);
    });
    // winglet
    const tipY = WING.y(32.2);
    const wl = loft([{ le: new THREE.Vector3(-17.5, tipY, 32.15), chord: 3.7, tc: .08, camber: 0 }, { le: new THREE.Vector3(-20.3, tipY + 2.0, 33.0), chord: 1.3, tc: .08, camber: 0 }],
      0, 1, { chordDir: new THREE.Vector3(-1, 0, 0), thickDir: new THREE.Vector3(0, -.39, .92), nC: 10 });
    const wlm = new THREE.Mesh(wl, tailMat); wlm.castShadow = true; W.add(wlm);
    // engines
    [11.65, 21.05].forEach(z => {
      const le = piecewise(z, WING.zs, WING.le), wy = WING.y(z);
      const e = buildEngine(nacMat); const ex = le + 1.2, ey = wy - 2.15; e.group.position.set(ex, ey, z); W.add(e.group); P.fans.push(e.fan);
      const py = new THREE.Mesh(pylonGeom(le, wy, ex, ey), nacMat); py.position.z = z; py.castShadow = true; W.add(py);
    });
    // wing landing gear + body gear
    const wg = gearLeg(new THREE.Vector3(-3.6, -2.4, 5.4), 2.98, true, 'x', 1); W.add(wg.pivot); P.gear.push(wg);
    const bg = gearLeg(new THREE.Vector3(-7.0, -3.3, 1.9), 2.08, true, 'z', 1); W.add(bg.pivot); P.gear.push(bg);
    // nav light + strobe on tip
    const nav = glowSprite(side === 'R' ? '#22ff66' : '#ff2a2a', 2.2); nav.position.set(-17.9, tipY + .1, 32.4); W.add(nav);
    const strobe = glowSprite('#ffffff', 5); strobe.position.set(-18.2, tipY + .1, 32.5); strobe.visible = false; W.add(strobe);
    const land = glowSprite('#fffbe8', 2.6); land.position.set(5.2, WING.y(4.2) - .2, 4.2); land.visible = false; W.add(land);
    P.lights['nav' + side] = nav; P.lights['strobe' + side] = strobe; P.lights['land' + side] = land;
    // horizontal stabiliser
    const hsMain = new THREE.Mesh(loft(secRange(hsSec, 1.0, 11.1, 1), 0, .70, WING_O), MAT.wing); hsMain.castShadow = true; W.add(hsMain);
    W.add(new THREE.Mesh(loft(secRange(hsSec, 10.6, 11.1, 1), .70, 1, WING_O), MAT.wing));
    [[1.5, 6.0], [6.0, 10.6]].forEach(([a, b]) => { const secs = secRange(hsSec, a, b, 1); const g = loft(secs, .70, 1, WING_O);
      const h = hinged(g, surfPt(secs[0], .7, 0, WING_O), surfPt(secs[secs.length - 1], .7, 0, WING_O), MAT.wing, WING_O.chordDir); W.add(h.pivot); P.elevators.push(h); });
  });

  // nose gear
  const ng = gearLeg(new THREE.Vector3(26.0, -2.6, 0), 2.78, false, 'z', 1); model.add(ng.pivot); P.gear.push(ng); P.lights.taxi = ng.pivot.userData.lamp;
  // vertical fin with logo texture
  const finTex = makeCanvas(512, 1024), fg = finTex.getContext('2d'); fg.fillStyle = C.tail; fg.fillRect(0, 0, 512, 1024);
  const finMap = canvasTex(finTex);
  const finMat = stdMat('#ffffff', .4, .15, { map: finMap, side: THREE.DoubleSide });
  const fin = new THREE.Mesh(loft(secRange(vsSec, 2.6, 13.4, 1), 0, .68, VS_O), finMat); fin.castShadow = true; model.add(fin);
  model.add(new THREE.Mesh(loft(secRange(vsSec, 2.6, 3.2, 1), .68, 1, VS_O), tailMat));
  model.add(new THREE.Mesh(loft(secRange(vsSec, 13.0, 13.4, 1), .68, 1, VS_O), tailMat));
  [[3.2, 8.2], [8.2, 13.0]].forEach(([a, b]) => { const secs = secRange(vsSec, a, b, 1); const g = loft(secs, .68, 1, VS_O);
    const h = hinged(g, surfPt(secs[0], .68, 0, VS_O), surfPt(secs[secs.length - 1], .68, 0, VS_O), tailMat, VS_O.chordDir); model.add(h.pivot); P.rudders.push(h); });
  whenImg(logoImage(al.id)).then(im => {
    // canvas x = span (root→tip), canvas y = around the airfoil loop (flipY):
    // right side occupies the lower half, left side the upper half; both map the
    // same way once you account for the loop direction, so one transform fits both.
    const span = 512 / 10.8, ch = 512 / 5.4; // px per metre (approx)
    [768, 256].forEach(py => {
      fg.save(); fg.setTransform(0, -ch, -span, 0, 512 * .55, py);
      fg.fillStyle = '#ffffff'; fg.beginPath(); fg.arc(0, 0, 2.15, 0, Math.PI * 2); fg.fill();
      if (im.naturalWidth) fg.drawImage(im, -1.75, -1.75, 3.5, 3.5);
      fg.restore();
    });
    finMap.needsUpdate = true;
  });
  // tail + beacons
  const tailNav = glowSprite('#ffffff', 1.6); tailNav.position.set(-35.6, 2.0, 0); model.add(tailNav);
  const strobeT = glowSprite('#ffffff', 4); strobeT.position.set(-35.7, 2.0, 0); strobeT.visible = false; model.add(strobeT); P.lights.strobeT = strobeT;
  const bTop = glowSprite('#ff2020', 2.4); bTop.position.set(-2, 3.45, 0); model.add(bTop);
  const bBot = glowSprite('#ff2020', 2.4); bBot.position.set(-4, -4.4, 0); model.add(bBot);
  P.lights.beacons = [bTop, bBot];

  // L1 door (left side) – swings outward and forward
  if (!opts.lite) {
    const doorPatch = (off) => { const pos = [], idx = [], nx = 6, ny = 10;
      for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
        const x = lerp(25.67, 26.73, i / nx), y = lerp(-.95, 1.0, j / ny), P2 = prof(x);
        const p = fusePt(x, thetaForY(x, y, 'L'), 1, P2); const d = new THREE.Vector3(0, p.y - P2.yc, p.z).normalize();
        p.addScaledVector(d, off); pos.push(p.x, p.y, p.z); }
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const a = i * (ny + 1) + j, b = a + ny + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
    const hole = new THREE.Mesh(doorPatch(.01), stdMat('#15181d', .9, 0, { side: THREE.DoubleSide })); model.add(hole);
    const hingeX = 26.73, hz = -prof(hingeX).w * .985;
    const dg = doorPatch(.035); dg.translate(-hingeX, 0, -hz);
    const door = new THREE.Mesh(dg, stdMat(C.body, .4, .15, { side: THREE.DoubleSide })); door.castShadow = true;
    const dp = new THREE.Group(); dp.position.set(hingeX, 0, hz); dp.add(door); model.add(dp);
    P.door = { pivot: dp, hole, home: dp.position.clone(), pos: new THREE.Vector3(26.2, 0, -3.25) };
  }

  /* ── state + API ── */
  const S = { flaps: 0, gear: 0, door: 0, n1: 0, ail: 0, elev: 0, rud: 0, spoil: 0, strobes: false, landing: false, beacon: false, nav: true, glow: 0 };
  P.state = S;
  P.setFlaps = deg => { S.flaps = deg; };
  P.setGear = p => { S.gear = clamp(p, 0, 1); };
  P.update = (dt, t) => {
    // flaps (exaggerated a little so kids can see them)
    const f = S.flaps / 10;
    P.flaps.forEach(h => h.set(f * 22 * DEG, f * .9, f * .15));
    P.le.forEach(h => h.set(-f * 28 * DEG, f * .25, 0));
    P.spoilers.forEach(h => h.set(-S.spoil * 45 * DEG));
    P.ailerons.R.forEach(h => h.set(S.ail * 20 * DEG)); P.ailerons.L.forEach(h => h.set(-S.ail * 20 * DEG));
    P.elevators.forEach(h => h.set(-S.elev * 22 * DEG));
    P.rudders.forEach(h => h.set(S.rud * 25 * DEG));
    // gear: retract with a little delay on the doors
    P.gear.forEach(g => {
      const a = smooth(S.gear) * Math.PI / 2;
      if (g.axis === 'z') g.pivot.rotation.z = a; else g.pivot.rotation.x = a;
      g.pivot.visible = S.gear < .97;
    });
    P.fans.forEach(fn => { fn.rotation.x -= (S.n1 * 32 + (S.n1 > .01 ? 2 : 0)) * dt; });
    if (P.door) { const o = smooth(S.door); P.door.pivot.rotation.y = -o * 100 * DEG; P.door.pivot.position.copy(P.door.home); P.door.pivot.position.z -= o * .25; P.door.hole.visible = S.door > .01; }
    const bOn = S.beacon && (t % 1.2) < .14;
    P.lights.beacons.forEach(b => b.visible = bOn);
    const st = S.strobes && ((t % 1.3) < .06 || ((t % 1.3) > .14 && (t % 1.3) < .2));
    P.lights.strobeR.visible = P.lights.strobeL.visible = P.lights.strobeT.visible = st;
    P.lights.landR.visible = P.lights.landL.visible = S.landing;
    if (P.lights.taxi) P.lights.taxi.visible = S.landing || S.taxiLight;
    fuseMat.emissiveIntensity = S.glow;
  };
  if (opts.interior) buildInterior(P, al, C);
  return P;
}
