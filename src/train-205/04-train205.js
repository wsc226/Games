/* ═══ 205 SERIES (4 cars: クハ205 + モハ205 + モハ204 + クハ204) ═══
   Car local space: +x = forward along the car, y up from rail top, +z = right side.
   Car body 20 m, 2.8 m wide. Bogie centres at ±6.95 m. */
const ROOF_Y = z => C205.sideY1 + .27 * Math.sqrt(Math.max(0, 1 - (z / 1.4) ** 2));
const M205 = {};
function mats205() {
  if (M205.done) return M205;
  M205.done = true;
  const mk = k => {
    const t = sideTex205(k), tm = sideTex205(k, true);   // left side: own picture so its text isn't backwards
    return [new THREE.MeshStandardMaterial({ map: t, metalness: .55, roughness: .38, alphaTest: .5 }),
            new THREE.MeshStandardMaterial({ map: tm, metalness: .55, roughness: .38, alphaTest: .5 })];
  };
  M205.side = { cabF: mk('cabF'), mid: mk('mid'), mid2: mk('mid2'), cabR: mk('cabR') };
  M205.roof = new THREE.MeshStandardMaterial({ map: roofTex205(), color: 0xb0b4b8, metalness: .4, roughness: .6 });
  M205.front = new THREE.MeshStandardMaterial({ map: frontTex205(), metalness: .45, roughness: .35, alphaTest: .5 });
  M205.end = new THREE.MeshStandardMaterial({ map: endTex205(), metalness: .5, roughness: .4 });
  M205.door = new THREE.MeshStandardMaterial({ map: doorLeafTex(), metalness: .55, roughness: .35, alphaTest: .5, side: THREE.DoubleSide });
  M205.glass = new THREE.MeshStandardMaterial({ color: 0x1c2a33, metalness: .2, roughness: .05, transparent: true, opacity: .38, depthWrite: false });
  M205.under = new THREE.MeshStandardMaterial({ color: 0x3a3d41, emissive: 0x15171a, roughness: .85, metalness: .2 });
  M205.equip = new THREE.MeshStandardMaterial({ color: 0x4a4e53, emissive: 0x1a1c1f, roughness: .8, metalness: .25 });
  M205.bogie = new THREE.MeshStandardMaterial({ color: 0x2c2f33, emissive: 0x16181b, roughness: .7, metalness: .35 });
  M205.wheel = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: .4, metalness: .8 });
  M205.wheelRim = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: .5, metalness: .2 });
  M205.skirt = new THREE.MeshStandardMaterial({ color: 0xd2d5d9, roughness: .45, metalness: .5 });
  M205.black = new THREE.MeshStandardMaterial({ color: 0x141517, roughness: .6 });
  M205.bellows = new THREE.MeshStandardMaterial({ color: 0x232426, roughness: .95 });
  M205.ac = new THREE.MeshStandardMaterial({ color: 0xc4c7cb, roughness: .55, metalness: .4 });
  M205.wall = new THREE.MeshStandardMaterial({ color: 0xeeece4, roughness: .8, side: THREE.BackSide });
  M205.floor = new THREE.MeshStandardMaterial({ color: 0x8f8d88, roughness: .9 });
  M205.seat = new THREE.MeshStandardMaterial({ color: 0x2f9b47, roughness: .9 });
  M205.seatEnd = new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: .6 });
  M205.ceilLight = new THREE.MeshBasicMaterial({ color: 0xfafcff });
  M205.wiper = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .5, metalness: .4 });
  M205.lensOff = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: .15, metalness: .6 });
  return M205;
}
function glowSprite(color) {
  const t = canvasTex(128, 128, (g, W, H) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.2, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  });
  const m = new THREE.SpriteMaterial({ map: t, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  return new THREE.Sprite(m);
}


/* merge a group's direct static mesh children into one mesh per material (fewer draw calls) */
function mergeStatic(group) {
  const byMat = new Map(), drop = [];
  group.updateMatrix();
  for (const c of group.children) {
    if (!c.isMesh || c.userData.dyn || c.isInstancedMesh) continue;
    c.updateMatrix();
    const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(c.matrix);
    if (!byMat.has(c.material)) byMat.set(c.material, { geos: [], shadow: false });
    const e = byMat.get(c.material); e.geos.push(g); e.shadow = e.shadow || c.castShadow; drop.push(c);
  }
  drop.forEach(c => group.remove(c));
  for (const [mat, e] of byMat) { const m = new THREE.Mesh(mergeGeometries(e.geos), mat); m.castShadow = e.shadow; group.add(m); }
}
/* Fuse every static mesh under root (any depth) into one mesh per material.
   Skips subtrees flagged userData.dyn, instanced meshes, multi-material meshes,
   sprites, lines and anything hidden. Big draw-call saver for chunks + stations. */
const _mdInv = new THREE.Matrix4(), _mdM = new THREE.Matrix4();
function mergeDeep(root) {
  root.updateMatrixWorld(true);
  _mdInv.copy(root.matrixWorld).invert();
  const byKey = new Map(), drop = [];
  const walk = o => {
    for (const c of o.children) {
      if (c.userData.dyn || !c.visible || c.isInstancedMesh || c.isSprite || c.isLine || c.isPoints) continue;
      if (c.isMesh) {
        if (Array.isArray(c.material) || c.children.length || c.renderOrder) continue;
        const mat = c.material, key = mat.uuid + (c.castShadow ? 'S' : '') + (c.receiveShadow ? 'R' : '');
        if (!byKey.has(key)) byKey.set(key, { mat, cast: c.castShadow, recv: c.receiveShadow, geos: [] });
        byKey.get(key).geos.push([c.geometry, _mdM.multiplyMatrices(_mdInv, c.matrixWorld).clone()]);
        drop.push(c);
      } else walk(c);
    }
  };
  walk(root);
  for (const [, e] of byKey) {
    if (e.geos.length < 2) { e.skip = true; continue; }
    const vc = !!e.mat.vertexColors;
    const geos = e.geos.map(([src, m]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', src.attributes.position.clone());
      const n = g.attributes.position.count;
      g.setAttribute('normal', src.attributes.normal ? src.attributes.normal.clone() : null);
      if (!src.attributes.normal) { g.deleteAttribute('normal'); g.computeVertexNormals(); }
      g.setAttribute('uv', src.attributes.uv ? src.attributes.uv.clone() : new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      if (vc) g.setAttribute('color', src.attributes.color ? src.attributes.color.clone() : new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
      if (src.index) g.setIndex(src.index.clone()); else { const ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
      // keep the group range of a geometry that draws only part of its index
      if (src.drawRange.count !== Infinity && src.drawRange.count < g.index.count) g.setIndex(new THREE.BufferAttribute(g.index.array.slice(src.drawRange.start, src.drawRange.start + src.drawRange.count), 1));
      g.applyMatrix4(m);
      if (m.determinant() < 0) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } }
      return g;
    });
    const merged = mergeGeometries(geos);
    if (!merged) { e.skip = true; continue; }
    const m = new THREE.Mesh(merged, e.mat); m.castShadow = e.cast; m.receiveShadow = e.recv; m.userData.merged = true;
    e.mesh = m;
  }
  for (const c of drop) {
    const e = byKey.get(c.material.uuid + (c.castShadow ? 'S' : '') + (c.receiveShadow ? 'R' : ''));
    if (e.skip) continue;
    c.parent.remove(c);
  }
  for (const [, e] of byKey) if (e.mesh) root.add(e.mesh);
  // drop groups that are now empty
  const prune = o => { for (const c of o.children.slice()) { prune(c); if (!c.isMesh && !c.isLine && !c.isSprite && !c.isLight && !c.children.length && !c.userData.dyn && c.type === 'Group') o.remove(c); } };
  prune(root);
}
function buildBogie(M) {
  const b = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.9, .34, 1.9), M.bogie); frame.position.y = .62; b.add(frame);
  const side = new THREE.BoxGeometry(2.7, .42, .14);
  for (const z of [-.98, .98]) { const sm = new THREE.Mesh(side, M.bogie); sm.position.set(0, .55, z); b.add(sm); }
  // axle boxes + springs
  const ab = new THREE.BoxGeometry(.34, .3, .22), spr = new THREE.CylinderGeometry(.09, .09, .26, 8);
  for (const x of [-1.05, 1.05]) for (const z of [-1.0, 1.0]) {
    const a = new THREE.Mesh(ab, M.equip); a.position.set(x, .45, z); b.add(a);
    const s = new THREE.Mesh(spr, M.wheel); s.position.set(x, .74, z); b.add(s);
  }
  b.wheels = [];
  const wg = new THREE.CylinderGeometry(.43, .43, .12, 22).rotateX(Math.PI / 2);
  const rg = new THREE.TorusGeometry(.33, .025, 6, 22);
  const axg = new THREE.CylinderGeometry(.07, .07, 1.2, 8).rotateX(Math.PI / 2);
  for (const x of [-1.05, 1.05]) {
    const axle = new THREE.Group(); axle.position.set(x, .43, 0);
    for (const z of [-TRACK.gauge / 2 - .03, TRACK.gauge / 2 + .03]) {
      const w = new THREE.Mesh(wg, M.wheel); w.position.z = z; axle.add(w);
      const r = new THREE.Mesh(rg, M.wheelRim); r.position.z = z + Math.sign(z) * .065; axle.add(r);
    }
    axle.add(new THREE.Mesh(axg, M.wheel));
    mergeStatic(axle);
    b.add(axle); b.wheels.push(axle);
  }
  // brake cylinders / traction motor hint
  const mot = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .7, 10).rotateX(Math.PI / 2), M.equip); mot.position.set(0, .45, 0); b.add(mot);
  b.traverse(o => { if (o.isMesh) o.castShadow = true; });
  mergeStatic(b);
  // far LOD: the whole bogie as one dark mesh (wheels only turn when you can see them)
  const near = new THREE.Group(); while (b.children.length) near.add(b.children[0]); b.add(near); b.near = near;
  b.updateMatrixWorld(true);
  const geos = [];
  near.traverse(o => { if (!o.isMesh) return; const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(o.matrixWorld); geos.push(g); });
  b.far = new THREE.Mesh(mergeGeometries(geos), M.bogie); b.far.visible = false; b.far.castShadow = true; b.add(b.far);
  return b;
}

function buildCab(car, dir, M, detail) {
  // dir = +1: cab faces +x ; -1: faces -x
  const X = dir * (C205.half + .01);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.72), M.front);
  front.position.set(X, (1.0 + 3.72) / 2, 0); front.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; car.add(front);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), M.glass);
  glass.position.set(X - dir * .03, 2.83, 0); glass.rotation.y = front.rotation.y; car.add(glass);
  let inside = null;
  if (detail) inside = buildCabInterior(car, dir);
  {
    // simple dark cab so the window is not see-through to the sky (far LOD of the detailed cab)
    const far = new THREE.Group(); car.add(far); if (inside) { inside.far = far; far.visible = false; }
    const cabBox = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 2.7), new THREE.MeshStandardMaterial({ color: 0x3a4a44, roughness: .9, side: THREE.BackSide }));
    cabBox.position.set(dir * (C205.half - .82), 2.3, 0); far.add(cabBox);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(.6, .9, 2.5), new THREE.MeshStandardMaterial({ color: 0x4f7366, roughness: .7 }));
    desk.position.set(dir * (C205.half - .35), 1.75, 0); far.add(desk);
  }
  // skirt (snow plough) + coupler
  const sk = new THREE.Shape(); sk.moveTo(-1.35, 0); sk.lineTo(1.35, 0); sk.lineTo(1.05, -.55); sk.lineTo(-1.05, -.55); sk.closePath();
  const skg = new THREE.ExtrudeGeometry(sk, { depth: .5, bevelEnabled: false });
  const skirt = new THREE.Mesh(skg, M.skirt); skirt.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  skirt.position.set(dir * (C205.half - .52), .98, 0); skirt.castShadow = true; car.add(skirt);
  const coup = new THREE.Mesh(new THREE.BoxGeometry(.7, .25, .3), M.black); coup.position.set(dir * (C205.half + .05), .85, 0); car.add(coup);
  const cbox = new THREE.Mesh(new THREE.BoxGeometry(.25, .35, .9), M.equip); cbox.position.set(dir * (C205.half - .15), .82, -.55); car.add(cbox);
  // lamps: big round headlights in the green band, small ones below
  const lamps = { head: [], tail: [], glowHead: [], glowTail: [], dir };
  const hg = new THREE.CylinderGeometry(.105, .105, .08, 20).rotateZ(Math.PI / 2);
  const tg = new THREE.CylinderGeometry(.065, .065, .06, 16).rotateZ(Math.PI / 2);
  for (const z of [-1.0, 1.0]) {
    const h = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ color: 0xbfc4c9, emissive: 0x000000, roughness: .1, metalness: .3 }));
    h.position.set(X + dir * .02, 1.81, z); h.userData.dyn = true; car.add(h); lamps.head.push(h);
    const t = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: 0x5a1a16, emissive: 0x000000, roughness: .2 }));
    t.position.set(X + dir * .02, 1.42, z); t.userData.dyn = true; car.add(t); lamps.tail.push(t);
    const gh = glowSprite(0xffffff); gh.scale.set(1.4, 1.4, 1); gh.position.set(X + dir * .12, 1.81, z); gh.visible = false; car.add(gh); lamps.glowHead.push(gh);
    const gt = glowSprite(0xff2a1a); gt.scale.set(.8, .8, 1); gt.position.set(X + dir * .1, 1.42, z); gt.visible = false; car.add(gt); lamps.glowTail.push(gt);
  }
  // wipers (one per window), pivot at the bottom of each window
  const wipers = [];
  const wgeo = new THREE.BoxGeometry(.02, .78, .035).translate(0, .39, 0);
  for (const z of [-.68, .68]) {
    const piv = new THREE.Group(); piv.position.set(X + dir * .025, 2.4, z);
    const arm = new THREE.Mesh(wgeo, M.wiper); piv.add(arm);
    piv.rotation.x = dir > 0 ? 1.35 : -1.35; piv.userData.rest = piv.rotation.x; piv.userData.sweep = dir > 0 ? -1 : 1;
    car.add(piv); wipers.push(piv);
  }
  return { lamps, wipers, inside };
}

function buildCar205(kind, detail = false) {
  const M = mats205();
  const car = new THREE.Group(); car.name = '205-' + kind;
  const H = C205.sideY1 - C205.sideY0, yc = (C205.sideY0 + C205.sideY1) / 2;
  const [mR, mL] = M.side[kind];
  const sideR = new THREE.Mesh(new THREE.PlaneGeometry(20, H), mR); sideR.position.set(0, yc, 1.4); car.add(sideR);
  const sideL = new THREE.Mesh(new THREE.PlaneGeometry(20, H), mL); sideL.position.set(0, yc, -1.4); sideL.rotation.y = Math.PI; car.add(sideL);
  sideR.castShadow = sideL.castShadow = true;
  // window glass + simple interior (seats visible through windows)
  const cabSign = kind === 'cabF' ? 1 : kind === 'cabR' ? -1 : 0;
  const wins = [[-4.84, 2.3], [0, 2.3], [4.84, 2.3]];
  if (cabSign !== -1) wins.push([-9.0, 1.2]); if (cabSign !== 1) wins.push([9.0, 1.2]);
  if (cabSign) wins.push([cabSign * 9.15, .5]);
  const gGeo = [];
  for (const [cx, w] of wins) for (const z of [-1.392, 1.392]) gGeo.push(new THREE.PlaneGeometry(w, .96).rotateY(z < 0 ? Math.PI : 0).translate(cx, 2.6, z));
  car.add(new THREE.Mesh(mergeGeometries(gGeo), M.glass));
  // sliding door leaves (instanced: 4 doors x 2 leaves x 2 sides)
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(.65, 1.95), M.door, 16);
  leaves.userData.dyn = true; leaves.castShadow = false;
  car.doorList = [];
  for (const z of [-1.385, 1.385]) for (const dx of C205.doors) for (const sg of [-1, 1]) car.doorList.push({ x: dx + sg * .325, z, sg });
  car.doorLeaves = leaves; car.add(leaves);
  setCarDoors(car, 0);
  if (detail) buildInterior(car, kind);
  {
    // cheap saloon: the far LOD of the detailed one (and all an oncoming train needs)
    const far = new THREE.Group(); car.add(far); car.inFar = far;
    if (car.peopleGeo) far.add(new THREE.Mesh(car.peopleGeo, car.peopleMat));
    const inner = new THREE.Mesh(new THREE.BoxGeometry(19.8, 2.3, 2.7), M.wall); inner.position.set(0, 1.15 + 1.15, 0); far.add(inner);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(19.8, 2.7).rotateX(-Math.PI / 2), M.floor); fl.position.y = 1.16; far.add(fl);
    const seatG = mergeGeometries([new THREE.BoxGeometry(1, .14, .5).translate(0, .45, 0), new THREE.BoxGeometry(1, .45, .12).translate(0, .7, -.22)]);
    for (const cx of [-4.84, 0, 4.84]) for (const zs of [-1, 1]) {
      const seat = new THREE.Mesh(seatG, M.seat); seat.scale.x = 3.4; seat.position.set(cx, 1.16, zs * 1.06); if (zs > 0) seat.rotation.y = Math.PI; far.add(seat);
    }
    mergeStatic(far);
  }
  for (const zs of [-.6, .6]) { const lt = new THREE.Mesh(new THREE.BoxGeometry(19, .04, .14), M.ceilLight); lt.position.set(0, 3.355, zs); car.add(lt); }
  // roof (arched)
  const sh = new THREE.Shape(); sh.moveTo(-1.42, C205.sideY1 - .05);
  for (let i = 0; i <= 20; i++) { const z = -1.42 + 2.84 * i / 20; sh.lineTo(z, ROOF_Y(clamp(z, -1.4, 1.4)) + (Math.abs(z) > 1.4 ? -.02 : 0)); }
  sh.lineTo(1.42, C205.sideY1 - .05); sh.closePath();
  const rg = new THREE.ExtrudeGeometry(sh, { depth: 20, bevelEnabled: false, curveSegments: 4 }); rg.rotateY(Math.PI / 2); rg.translate(-10, 0, 0);
  const roof = new THREE.Mesh(rg, M.roof); roof.castShadow = true; car.add(roof);
  // gutter line
  for (const z of [-1.42, 1.42]) { const gu = new THREE.Mesh(new THREE.BoxGeometry(20, .05, .05), M.skirt); gu.position.set(0, C205.sideY1, z); car.add(gu); }
  // roof AC unit (AU75)
  const ac = new THREE.Mesh(new THREE.BoxGeometry(3.6, .38, 2.0), M.ac); ac.position.set(kind === 'mid' ? -5 : 0, ROOF_Y(0) + .12, 0); ac.castShadow = true; car.add(ac);
  for (let i = -1; i <= 1; i++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .06, 18), M.black); f.position.set(ac.position.x + i * 1.1, ac.position.y + .2, 0); car.add(f); }
  // vents along roof
  for (let x = -8; x <= 8; x += 4) { if (Math.abs(x - ac.position.x) < 2.5) continue; const v = new THREE.Mesh(new THREE.BoxGeometry(.8, .12, .9), M.ac); v.position.set(x, ROOF_Y(0) + .02, 0); car.add(v); }
  // underframe + equipment
  const uf = new THREE.Mesh(new THREE.BoxGeometry(19.6, .3, 2.5), M.under); uf.position.y = .88; car.add(uf);
  const eq = [[-3.4, 2.2, .55, .9], [-.4, 1.6, .5, .7], [2.6, 2.4, .6, .85], [4.4, 1.0, .45, .6]];
  for (const [x, l, h, d] of eq) for (const zs of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(l, h, d), M.equip); e.position.set(x * zs, .9 - h / 2, zs * (1.25 - d / 2)); e.castShadow = true; car.add(e);
  }
  // bogies
  car.bogies = [];
  for (const bx of [6.95, -6.95]) { const b = buildBogie(M); b.position.x = bx; car.add(b); car.bogies.push(b); }
  // ends
  car.cab = null;
  for (const dir of [1, -1]) {
    const isCab = (kind === 'cabF' && dir > 0) || (kind === 'cabR' && dir < 0);
    if (isCab) { car.cab = buildCab(car, dir, M, detail); continue; }
    const e = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.45), M.end); e.position.set(dir * 10, 2.225, 0); e.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; car.add(e);
    const bel = new THREE.Mesh(new THREE.BoxGeometry(.3, 2.1, 1.15), M.bellows); bel.position.set(dir * 10.15, 2.2, 0); car.add(bel);
    const cp = new THREE.Mesh(new THREE.BoxGeometry(.4, .2, .25), M.black); cp.position.set(dir * 10.15, .85, 0); car.add(cp);
  }
  // pantograph on the motor car (single-arm)
  if (kind === 'mid') {
    const pg = new THREE.Group(); pg.position.set(4.5, ROOF_Y(0), 0);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, .12, 1.2), M.equip); base.position.y = .1; pg.add(base);
    for (const z of [-.5, .5]) { const i = new THREE.Mesh(INS_GEO, M.ac); i.position.set(z * 1.2, .2, z); pg.add(i); }
    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.5, .06, .06).translate(.75, 0, 0), M.steel); lower.position.set(-.6, .25, 0); lower.rotation.z = .75; pg.add(lower);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(1.7, .05, .05).translate(-.85, 0, 0), M.steel); upper.position.set(-.6 + 1.5 * Math.cos(.75), .25 + 1.5 * Math.sin(.75), 0); upper.rotation.z = -.62; pg.add(upper);
    const headY = upper.position.y + 1.7 * Math.sin(.62);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.25, .06, 1.6), M.steel); head.position.set(upper.position.x - 1.7 * Math.cos(.62), headY, 0); pg.add(head);
    pg.traverse(o => { if (o.isMesh) o.castShadow = true; });
    // make the shoe touch the 5.2 m contact wire
    pg.scale.y = (5.2 - ROOF_Y(0)) / (headY + .03);
    mergeStatic(pg);
    car.add(pg);
  }
  // side walls cast shadows; glass is transparent and must stay separate from opaque parts (it has its own material anyway)
  mergeStatic(car);
  return car;
}

const _do = new THREE.Object3D();
function setCarDoors(car, k) {
  // k: 0 closed .. 1 open (left / platform side = local -z only)
  car.doorList.forEach((d, i) => {
    const open = d.z < 0 ? k : 0;
    _do.position.set(d.x + d.sg * .63 * open, 2.095, d.z); _do.rotation.set(0, d.z < 0 ? Math.PI : 0, 0); _do.updateMatrix();
    car.doorLeaves.setMatrixAt(i, _do.matrix);
  });
  car.doorLeaves.instanceMatrix.needsUpdate = true;
}
/* ── Train: C205.cars cars placed on the track by their bogie positions ── */
const _lodV = new THREE.Vector3();
class Train205 {
  constructor(scene, opts = {}) {
    const detail = opts.detail ?? true;
    const kinds = ['cabF', 'mid', 'mid2', 'mid', 'mid2'].slice(0, C205.cars - 1).concat('cabR');
    this.cars = kinds.map(k => buildCar205(k, detail));
    this.root = new THREE.Group(); this.cars.forEach(c => this.root.add(c)); scene.add(this.root);
    this.dir = opts.dir || 1;
    this.s = 0; this.v = 0; this.off = opts.off ?? TRACK.PLAYER; this.wheelRot = 0;
    this.lights = { on: true, color: 'white' };
    this.doorK = 0;
    this.wiper = { front: 0, back: 0, tf: 0, tb: 0 };
    // headlight beam
    if (opts.spot !== false) {
      this.spot = new THREE.SpotLight(0xfff6e0, 0, 160, .4, .6, 1.0);
      this.spot.position.set(10.3, 1.8, 0); this.spot.target.position.set(40, 0, 0);
      this.cars[0].add(this.spot, this.spot.target);
    }
    this.applyLights();
    this.place();
  }
  carPitch() { return 20.5; }
  // level of detail: full saloon / cab only when the camera is close or inside
  lod(camPos, view) {
    const lookIn = view === 'cab' || view === 'inside';
    this.cars.forEach((car, i) => {
      const d = car.getWorldPosition(_lodV).distanceTo(camPos);
      if (car.inNear) {
        const near = view === 'cab' || view === 'top' || view === 'bottom' ? false : view === 'inside' ? i === 1 : d < (view === 'platform' ? 40 : 32);
        car.inNear.visible = near;
        // the cheap saloon is one big box: never draw it around the driver's eye
        car.inFar.visible = !near && !(view === 'cab' && i === 0);
      }
      const bn = !lookIn && d < 30;
      for (const b of car.bogies) if (b.near) { b.near.visible = bn; b.far.visible = !bn; }
      const ins = car.cab && car.cab.inside;
      if (ins) {
        const dir = i === 0 ? 1 : -1; _lodV.set(dir * 9, 2.3, 0); car.localToWorld(_lodV);
        const near = view === 'cab' ? i === 0 : view !== 'inside' && _lodV.distanceTo(camPos) < 16;
        ins.group.visible = near; ins.far.visible = !near;
      }
    });
  }
  place() {
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    this.cars.forEach((car, i) => {
      const sc = this.s - this.dir * (10 + i * this.carPitch());
      posAt(sc + this.dir * 6.95, this.off, 0, a); posAt(sc - this.dir * 6.95, this.off, 0, b);
      car.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      const yaw = Math.atan2(-(a.z - b.z), a.x - b.x);
      car.rotation.set(0, yaw, 0);
      car.userData.s = sc;
      const flip = this.dir > 0 ? 0 : Math.PI;
      car.bogies[0].rotation.y = yawAt(sc + this.dir * 6.95) + flip - yaw;
      car.bogies[1].rotation.y = yawAt(sc - this.dir * 6.95) + flip - yaw;
      for (const bg of car.bogies) for (const w of bg.wheels) w.rotation.z = -this.wheelRot;
    });
  }
  update(dt) {
    this.wheelRot += this.v * dt / .43;
    this.place();
    // wipers: each side sweeps while switched on
    for (const [key, carI] of [['front', 0], ['back', 2]]) {
      const on = this.wiper[key];
      const tk = key === 'front' ? 'tf' : 'tb';
      if (on || Math.abs(Math.sin(this.wiper[tk])) > .02) this.wiper[tk] += dt * 3.2; else this.wiper[tk] = 0;
      const k = Math.abs(Math.sin(this.wiper[tk]));
      const cab = this.cars[carI].cab;
      cab && cab.wipers.forEach(p => { p.rotation.x = p.userData.rest + p.userData.sweep * k * 1.45; });
    }
  }
  setDoors(k) { if (k === this.doorK) return; this.doorK = k; this.cars.forEach(c => setCarDoors(c, k)); }
  // world position of every left-side (platform) doorway, for passengers
  doorways() {
    const out = [];
    this.cars.forEach(c => C205.doors.forEach(dx => out.push(c.localToWorld(new THREE.Vector3(dx, 1.16, -1.2)))));
    return out;
  }
  applyLights() {
    const on = this.lights.on, red = this.lights.color === 'red';
    const set = (lampMesh, glow, col, lit) => {
      const isRed = new THREE.Color(col).g < .5;
      lampMesh.material.color.set(lit && isRed ? 0x400806 : 0xbfc4c9);
      lampMesh.material.emissive.set(lit ? col : 0x000000); lampMesh.material.emissiveIntensity = lit ? (isRed ? 1.4 : 2.2) : 0;
      glow.visible = lit; glow.material.color.set(col);
    };
    // front cab: big lamps show the chosen colour; rear cab: red tail lamps (like the real train)
    const F = this.cars[0].cab.lamps, B = this.cars[this.cars.length - 1].cab.lamps;
    F.head.forEach((m, i) => set(m, F.glowHead[i], red ? 0xff2a1a : 0xfff8e8, on));
    F.tail.forEach((m, i) => set(m, F.glowTail[i], 0xff2a1a, on && red));
    B.head.forEach((m, i) => set(m, B.glowHead[i], 0xff2a1a, false));
    B.tail.forEach((m, i) => set(m, B.glowTail[i], 0xff2a1a, on));
    if (this.spot) this.spot.intensity = on && !red ? 90 : 0;
  }
}
