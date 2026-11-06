/* ═══ EXTRAS: high-voltage pylons, oncoming trains, tunnel lighting ═══ */
function pylonGeometry() {
  const body = new THREE.CylinderGeometry(1.1, 4.4, 40, 4, 1, true).rotateY(Math.PI / 4).translate(0, 20, 0);
  const top = new THREE.CylinderGeometry(.35, 1.1, 8, 4, 1, true).rotateY(Math.PI / 4).translate(0, 44, 0);
  const arms = [];
  for (const [y, w] of [[30, 13], [35.5, 15], [41, 12]]) arms.push(UNIT_BOX.clone().scale(1.1, 1.1, w).translate(0, y, 0));
  arms.push(UNIT_BOX.clone().scale(.6, .6, 5).translate(0, 47.6, 0));
  return { body: mergeGeometries([body, top]), arms: mergeGeometries(arms) };
}
const PYLON_ATTACH = [[29, 6.5], [29, -6.5], [34.5, 7.5], [34.5, -7.5], [40, 6], [40, -6]];
function buildPylons() {
  const lt = latticeTex(); lt.repeat.set(4, 14);
  const mBody = new THREE.MeshStandardMaterial({ map: lt, color: 0xb8bec2, metalness: .5, roughness: .5, alphaTest: .5, side: THREE.DoubleSide });
  const { body, arms } = pylonGeometry();
  const towers = []; // {p, yaw}
  // a line running alongside the railway, then one line crossing over it
  for (let s = ST('kuki').s - 600; s < ST('utsunomiya').s - 900; s += 330) {
    const lat = 125 + 30 * Math.sin(s / 900);
    const p = posG(s, lat, GROUND); if (inRiver(p.x, p.z, 0) || inHill(s, lat) || shkBlocked(s, lat, 8)) continue;
    towers.push({ p, yaw: yawAt(s), line: 0, s });
  }
  const cs = ST('koga').s + 450;
  for (let lat = -1350; lat <= 1350; lat += 300) { const p = posG(cs + lat * .15, lat, GROUND); towers.push({ p, yaw: yawAt(cs) + Math.PI / 2 - .15, line: 1 }); }
  const ib = new THREE.InstancedMesh(body, mBody, towers.length), ia = new THREE.InstancedMesh(arms, MAT.latticeB, towers.length);
  const o = new THREE.Object3D();
  towers.forEach((t, i) => { o.position.copy(t.p); o.rotation.set(0, t.yaw, 0); o.updateMatrix(); ib.setMatrixAt(i, o.matrix); ia.setMatrixAt(i, o.matrix); });
  ib.castShadow = true; W.scene.add(ib, ia);
  // insulators + sagging conductors between consecutive towers of the same line
  const pts = [], insG = [];
  const att = (t, k, out) => { const [y, z] = PYLON_ATTACH[k]; out.set(0, y - 2.6, z).applyAxisAngle(_up, t.yaw).add(t.p); return out; };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Vector3(), q2 = new THREE.Vector3();
  towers.forEach(t => { for (let k = 0; k < 6; k++) { att(t, k, a); insG.push(new THREE.CylinderGeometry(.18, .18, 2.6, 6).translate(a.x, a.y + 1.3, a.z)); } });
  for (let i = 0; i < towers.length - 1; i++) {
    const t1 = towers[i], t2 = towers[i + 1]; if (t1.line !== t2.line || t1.p.distanceTo(t2.p) > 700) continue;
    const span = t1.p.distanceTo(t2.p), sagD = span * .035;
    for (let k = 0; k < 7; k++) {
      if (k < 6) { att(t1, k, a); att(t2, k, b); }
      else { a.set(0, 47.8, 2.3).applyAxisAngle(_up, t1.yaw).add(t1.p); b.set(0, 47.8, 2.3).applyAxisAngle(_up, t2.yaw).add(t2.p); }
      for (let j = 0; j < 16; j++) {
        const u0 = j / 16, u1 = (j + 1) / 16;
        q.lerpVectors(a, b, u0); q.y -= sagD * 4 * u0 * (1 - u0);
        q2.lerpVectors(a, b, u1); q2.y -= sagD * 4 * u1 * (1 - u1);
        pts.push(q.x, q.y, q.z, q2.x, q2.y, q2.z);
      }
    }
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  W.scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x3a3c40 })));
  W.scene.add(new THREE.Mesh(mergeGeometries(insG), new THREE.MeshStandardMaterial({ color: 0x9a7a5a, roughness: .5 })));
}
const _up = new THREE.Vector3(0, 1, 0);

/* ── oncoming trains on the other track ── */
const AMB = { train: null, active: false, nextT: 25, passed: false };
function buildAmbient() {
  AMB.train = new Train205(W.scene, { dir: -1, off: TRACK.OPP, spot: false, detail: false });
  AMB.train.root.visible = false;
}
function updateAmbient(dt, player, camPos) {
  const T = AMB.train;
  if (!AMB.active) {
    if (G.t > AMB.nextT && player.s < TRACK.len - 1800) {
      AMB.active = true; T.s = player.s + 1700; T.v = 26; T.root.visible = true; AMB.passed = false;
    }
    return;
  }
  T.s -= T.v * dt; T.update(dt);
  // whoosh as it passes the camera
  if (!AMB.passed && Math.abs(T.cars[1].position.distanceTo(camPos)) < 45) { AMB.passed = true; noisy(1.6, .22, 700, .5); noisy(1.2, .12, 2500, .6, .2); }
  if (T.s < player.s - 900 || T.s < 80) { AMB.active = false; T.root.visible = false; AMB.nextT = G.t + rr(45, 90); }
}

/* ── tunnel: darkness + inside camera ── */
const TUN = { dark: 0 };
function tunnelAt(s) { return FEAT.tunnels.find(t => s > t.a + 12 && s < t.b + 3); }
function updateTunnelLight(dt, train) {
  const inside = !!tunnelAt(train.s) && CAM.view !== 'platform';
  TUN.dark = damp(TUN.dark, inside ? 1 : 0, 5, dt);
  const d = TUN.dark;
  W.hemi.intensity = lerp(1.1, .18, d); W.sun.intensity = lerp(2.6, .0, d);
  W.scene.environmentIntensity = lerp(.55, .08, d);
}

/* driver's cab: live speedometer + moving handles */
let cabT = 0;
function updateCabInstruments(dt, train) {
  const ins = train.cars[0].cab && train.cars[0].cab.inside; if (!ins) return;
  const power = DRV.state === 'go', brake = DRV.state === 'braking' || DRV.state === 'stopped' || DRV.state === 'aligning';
  ins.mc.rotation.z = damp(ins.mc.rotation.z, power ? -.55 : .1, 6, dt);
  ins.bk.rotation.y = damp(ins.bk.rotation.y, brake ? (DRV.state === 'braking' ? -.9 : -.35) : 0, 6, dt);
  if (CAM.view !== 'cab') return;
  cabT -= dt; if (cabT > 0) return; cabT = 1 / 20;
  drawCabSpeedo(ins.speedoTex.image, Math.abs(train.v) * 3.6); ins.speedoTex.needsUpdate = true;
}
