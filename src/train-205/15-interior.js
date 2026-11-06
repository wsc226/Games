/* ═══ INTERIOR: passenger saloon + driver's cab (player train only) ═══
   Car local space: +x forward, y up from rail top, +z right. Floor at y = 1.16. */
const IM = {};
function interiorMaterials() {
  if (IM.done) return IM; IM.done = true;
  const em = (c, e = 0x34322c) => new THREE.MeshStandardMaterial({ color: c, emissive: e, roughness: .7 });
  IM.wallTex = innerSideTex();
  const wm = IM.wallTex.clone(); wm.wrapS = THREE.RepeatWrapping; wm.repeat.x = -1; wm.offset.x = 1; wm.needsUpdate = true;
  IM.wallL = new THREE.MeshStandardMaterial({ map: IM.wallTex, emissive: 0xffffff, emissiveMap: IM.wallTex, emissiveIntensity: .32, roughness: .8, alphaTest: .5 });
  IM.wallR = new THREE.MeshStandardMaterial({ map: wm, emissive: 0xffffff, emissiveMap: wm, emissiveIntensity: .32, roughness: .8, alphaTest: .5 });
  IM.ceiling = em(0xf2f1ec, 0x55544e); IM.ceiling.side = THREE.DoubleSide;
  IM.floor = em(0x8a7f78, 0x2a2622);
  IM.seat = em(0x2f9b47, 0x123d1c);
  IM.priority = em(0xb8325a, 0x3a1020);
  IM.panel = em(0xdfe3e6, 0x3c3e40);
  IM.steel = new THREE.MeshStandardMaterial({ color: 0xd4d8dc, emissive: 0x3a3c3e, metalness: .7, roughness: .25 });
  IM.ring = em(0xffffff, 0x666666);
  IM.strap = em(0xe9e2cf, 0x403c33);
  IM.yellow = em(0xf2c522, 0x4a3a08);
  IM.endDoor = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, emissive: 0x3a3c3e, metalness: .6, roughness: .3 });
  IM.dark = em(0x2a3036, 0x101214);
  IM.ads = ['train', 'fruit', 'zoo', 'sea'].map(k => { const t = adTex(k); return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .45, side: THREE.DoubleSide }); });
  IM.people = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, emissive: 0x2a2620 });
  // cab
  IM.cab = em(0x5f8a7e, 0x1c2a26); IM.cab.side = THREE.DoubleSide;
  IM.cabDesk = em(0x4e7f73, 0x18261f);
  IM.cabFront = new THREE.MeshStandardMaterial({ map: cabFrontTex(), emissive: 0x1c2a26, roughness: .8, alphaTest: .5 });
  IM.black = em(0x111111, 0x050505);
  IM.phone = em(0xa9d4b0, 0x2a3a2c);
  IM.seatCab = em(0x3b3f45, 0x111214);
  IM.pressure = new THREE.MeshStandardMaterial({ map: pressureTex(), emissive: 0xffffff, emissiveMap: pressureTex(), emissiveIntensity: .35 });
  IM.leds = new THREE.MeshStandardMaterial({ map: ledTex(), emissive: 0xffffff, emissiveMap: ledTex(), emissiveIntensity: .8 });
  return IM;
}
const SEAT_SECTIONS = [-4.84, 0, 4.84];
function buildInterior(car, kind) {
  const M = interiorMaterials();
  const cab = kind === 'cabF' ? 1 : kind === 'cabR' ? -1 : 0;
  const G = {};    // material -> [geometries]
  const put = (mat, geo) => { (G[mat.uuid] ||= { mat, geos: [] }).geos.push(geo.index ? geo.toNonIndexed() : geo); };
  const box = (mat, w, h, d, x, y, z) => put(mat, new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  const x0 = cab < 0 ? -8.3 : -9.88, x1 = cab > 0 ? 8.3 : 9.88;       // saloon extent
  // walls (inner faces, with window + door holes)
  put(M.wallL, new THREE.PlaneGeometry(20, 2.09).translate(0, 2.205, -1.37));
  put(M.wallR, new THREE.PlaneGeometry(20, 2.09).rotateY(Math.PI).translate(0, 2.205, 1.37));
  // ceiling: coves + flat centre + AC duct + light strips
  for (const s of [-1, 1]) {
    const cove = new THREE.PlaneGeometry(20, .66).rotateX(Math.PI / 2).rotateX(s * -.2).translate(0, 3.31, s * 1.05);
    put(M.ceiling, cove);
  }
  put(M.ceiling, new THREE.PlaneGeometry(20, 1.46).rotateX(Math.PI / 2).translate(0, 3.37, 0));
  box(M.panel, x1 - x0 - .2, .05, .5, (x0 + x1) / 2, 3.345, 0);
  // floor + yellow strips at the doors
  put(M.floor, new THREE.PlaneGeometry(20, 2.74).rotateX(-Math.PI / 2).translate(0, 1.161, 0));
  for (const dx of C205.doors) for (const z of [-1.18, 1.18]) put(M.yellow, new THREE.PlaneGeometry(1.3, .3).rotateX(-Math.PI / 2).translate(dx, 1.165, z));
  // long bench seats (green) + priority seats (red) at the car ends
  const bench = (cx, len, mat, zs) => {
    box(mat, len, .14, .5, cx, 1.61, zs * 1.06);                  // cushion
    box(mat, len, .46, .12, cx, 1.92, zs * 1.29);                 // backrest
    box(M.panel, len, .45, .04, cx, 1.38, zs * .83);              // seat base front
  };
  for (const cx of SEAT_SECTIONS) for (const zs of [-1, 1]) bench(cx, 3.4, M.seat, zs);
  if (cab !== -1) for (const zs of [-1, 1]) bench(-9.05, 1.4, M.priority, zs);
  if (cab !== 1) for (const zs of [-1, 1]) bench(9.05, 1.4, M.priority, zs);
  // seat-end partitions + grab poles + luggage racks + strap rails
  const ends = []; for (const cx of SEAT_SECTIONS) ends.push(cx - 1.75, cx + 1.75);
  for (const ex of ends) for (const zs of [-1, 1]) {
    box(M.panel, .04, .75, .55, ex, 1.85, zs * 1.06);
    put(M.steel, new THREE.CylinderGeometry(.02, .02, 2.2, 6).translate(ex + Math.sign(ex || 1) * .02, 2.26, zs * .8));
  }
  for (const cx of SEAT_SECTIONS) for (const zs of [-1, 1]) {
    box(M.steel, 3.4, .02, .32, cx, 2.98, zs * 1.18);                 // rack shelf
    put(M.steel, new THREE.CylinderGeometry(.012, .012, 3.4, 5).rotateZ(Math.PI / 2).translate(cx, 2.99, zs * 1.02));
  }
  for (const zs of [-1, 1]) {
    put(M.steel, new THREE.CylinderGeometry(.016, .016, x1 - x0 - .4, 6).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, 3.12, zs * .78));
    for (let x = x0 + .5; x < x1 - .3; x += .34) {
      if (C205.doors.some(d => Math.abs(d - x) < .7)) continue;
      put(M.strap, new THREE.BoxGeometry(.03, .3, .015).translate(x, 2.95, zs * .78));
      put(M.ring, new THREE.TorusGeometry(.065, .012, 5, 14).translate(x, 2.74, zs * .78));
    }
  }
  // hanging advertisements along the centre
  let ai = 0;
  for (let x = x0 + 1.4; x < x1 - 1; x += 2.4) put(M.ads[ai++ % 4], new THREE.PlaneGeometry(.95, .55).translate(x, 3.05, 0).rotateY(0));
  // end walls with gangway door (or the cab back wall)
  for (const dir of [-1, 1]) {
    const ex = dir > 0 ? x1 : x0;
    put(M.panel, new THREE.PlaneGeometry(2.74, 2.33).rotateY(dir > 0 ? -Math.PI / 2 : Math.PI / 2).translate(ex, 2.32, 0));
    put(M.endDoor, new THREE.PlaneGeometry(.8, 1.9).rotateY(dir > 0 ? -Math.PI / 2 : Math.PI / 2).translate(ex - dir * .01, 2.11, 0));
    put(M.dark, new THREE.PlaneGeometry(.45, .55).rotateY(dir > 0 ? -Math.PI / 2 : Math.PI / 2).translate(ex - dir * .02, 2.55, 0));
  }
  // door buttons + posters near doors
  for (const dx of C205.doors) for (const zs of [-1, 1]) box(M.yellow, .08, .16, .03, dx + .85, 2.15, zs * 1.355);
  // passengers: seated on the benches, a few standing holding straps
  const pg = [];
  R = mulberry(car.id * 13 + 5);
  for (const cx of SEAT_SECTIONS) for (const zs of [-1, 1]) {
    const n = 1 + Math.floor(R() * 3);
    const slots = [-1.4, -.95, -.5, -.05, .4, .85, 1.3].sort(() => R() - .5).slice(0, n);
    for (const sx of slots) {
      const g = personGeometry(R() < .12, 'sit');
      g.rotateY(zs < 0 ? 0 : Math.PI); g.translate(cx + sx, 1.68, zs * .98); pg.push(g);
    }
  }
  for (let i = 0; i < 3; i++) {
    const g = personGeometry(false, 'hold'), zs = R() < .5 ? -1 : 1;
    g.rotateY(zs < 0 ? Math.PI : 0); g.translate(rr(-3, 8), 1.16, zs * .55); pg.push(g);
  }
  const near = new THREE.Group(); car.add(near); car.inNear = near;
  if (pg.length) { car.peopleGeo = mergeGeometries(pg); car.peopleMat = M.people; put(M.people, car.peopleGeo); }
  for (const k in G) { const e = G[k]; const m = new THREE.Mesh(mergeGeometries(e.geos.map(g => { for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(a)) g.deleteAttribute(a); return g; })), e.mat); near.add(m); }
}

/* ── driver's cab (dir = +1 faces +x) ── */
function buildCabInterior(car, dir) {
  const M = interiorMaterials();
  const g = new THREE.Group(); car.add(g);
  const X = v => dir * v, L = -dir;                 // L: sign of the driver's (left) side in z
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); g.add(m); return m; };
  const rotY = dir > 0 ? -Math.PI / 2 : Math.PI / 2;  // plane facing back into the cab
  // inner front wall with the two windows, back wall, ceiling, side walls
  add(new THREE.PlaneGeometry(2.76, 2.6).rotateY(rotY).translate(X(9.97), 2.3, 0), M.cabFront);
  add(new THREE.PlaneGeometry(2.74, 2.33).rotateY(-rotY).translate(X(8.3), 2.32, 0), M.cab);
  add(new THREE.PlaneGeometry(.55, .6).rotateY(-rotY).translate(X(8.29), 2.6, L * -.55), M.dark);
  add(new THREE.PlaneGeometry(1.7, 2.74).rotateX(Math.PI / 2).translate(X(9.15), 3.4, 0), M.cab);
  // dashboard console (green) + sloped instrument panel
  add(new THREE.BoxGeometry(.75, 1.0, 2.7).translate(X(9.6), 1.66, 0), M.cabDesk);
  const panel = new THREE.BoxGeometry(.06, .5, 2.0).rotateZ(-dir * .3).translate(X(9.62), 2.4, L * .2);
  add(panel, M.cabDesk);
  // gauges (live speedometer, pressure gauge, LED column) on the panel
  const spdTex = canvasTex(256, 256, (c) => drawCabSpeedo(c.canvas || c, 0));
  const spdMat = new THREE.MeshStandardMaterial({ map: spdTex, emissive: 0xffffff, emissiveMap: spdTex, emissiveIntensity: .5 });
  const tilt = new THREE.Group(); tilt.position.set(X(9.6), 2.4, 0); tilt.rotation.z = -dir * .3; g.add(tilt);
  const mk = (w, h, z, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateY(rotY), mat); m.position.set(-dir * .035, 0, z); tilt.add(m); return m; };
  const spd = mk(.3, .3, L * .5, spdMat); spd.userData.dyn = true;
  mk(.3, .3, L * .15, M.pressure); mk(.16, .34, L * .85, M.leds);
  // indicator lamps
  for (let i = 0; i < 8; i++) { const lm = new THREE.Mesh(new THREE.BoxGeometry(.02, .04, .06), new THREE.MeshBasicMaterial({ color: [0xff3020, 0xffc020, 0x30ff70, 0xffffff][i % 4] })); lm.position.set(-dir * .04, .21, L * (-.3 + i * .12)); tilt.add(lm); }
  // master controller (left) + brake handle (right)
  const mcBase = add(new THREE.BoxGeometry(.2, .1, .22).translate(X(9.35), 2.21, L * .95), M.steel);
  const mc = new THREE.Group(); mc.position.set(X(9.35), 2.26, L * .95); g.add(mc);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .22, 8).translate(0, .11, 0), M.steel); mc.add(stick);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 10).translate(0, .23, 0), M.black); mc.add(ball);
  const bkBase = add(new THREE.CylinderGeometry(.07, .08, .08, 12).translate(X(9.3), 2.2, L * -.1), M.steel);
  const bk = new THREE.Group(); bk.position.set(X(9.3), 2.26, L * -.1); g.add(bk);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(.32, .035, .045).translate(-dir * .16, 0, 0), M.steel); bk.add(handle);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .09, 8).translate(-dir * .3, .04, 0), M.steel); bk.add(knob);
  // phone handset on the left wall, driver's seat
  add(new THREE.BoxGeometry(.1, .32, .08).translate(X(9.2), 2.55, L * 1.3), M.phone);
  add(new THREE.BoxGeometry(.5, .1, .5).translate(X(8.75), 1.75, L * .55), M.seatCab);
  add(new THREE.BoxGeometry(.08, .6, .5).translate(X(8.5), 2.1, L * .55), M.seatCab);
  // merge the static bits, keep the moving parts
  mergeStatic(g);
  return { speedo: spd, speedoTex: spdTex, mc, bk, group: g };
}
function drawCabSpeedo(cv, kmh) {
  const g = cv.getContext('2d'), W = cv.width, c = W / 2, r = W / 2 - 8;
  g.fillStyle = '#20262a'; g.fillRect(0, 0, W, W);
  g.fillStyle = '#f7f7f2'; g.beginPath(); g.arc(c, c, r, 0, 7); g.fill();
  const a0 = Math.PI * .75, a1 = Math.PI * 2.25, ang = k => a0 + (a1 - a0) * k / 120;
  g.strokeStyle = '#111'; g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 0; k <= 120; k += 5) {
    const a = ang(k), big = k % 20 === 0; g.lineWidth = big ? 4 : 2;
    g.beginPath(); g.moveTo(c + Math.cos(a) * (r - 6), c + Math.sin(a) * (r - 6)); g.lineTo(c + Math.cos(a) * (r - (big ? 26 : 16)), c + Math.sin(a) * (r - (big ? 26 : 16))); g.stroke();
    if (big) { g.font = 'bold 22px Arial'; g.fillText(k, c + Math.cos(a) * (r - 46), c + Math.sin(a) * (r - 46)); }
  }
  g.font = 'bold 18px Arial'; g.fillText('km/h', c, c + 46);
  const a = ang(clamp(kmh, 0, 120));
  g.strokeStyle = '#e8401c'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(c - Math.cos(a) * 14, c - Math.sin(a) * 14); g.lineTo(c + Math.cos(a) * (r - 22), c + Math.sin(a) * (r - 22)); g.stroke();
  g.fillStyle = '#ccc'; g.beginPath(); g.arc(c, c, 14, 0, 7); g.fill();
}
