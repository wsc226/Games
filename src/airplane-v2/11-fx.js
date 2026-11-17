/* ═══ FX: fire, smoke, sparks, water spray, fire trucks (landing mode + MAYDAY) ═══ */
const FX = { group: null, live: [], pool: {}, emitters: [], trucks: [] };
const FX_KIND = {
  fire:  { tex: () => TEX.glow,  add: true,  cols: ['#ffcf4a', '#ff8a1e', '#ff4a10'], size: [5, 9],   grow: 1.7, life: [.7, 1.3], up: [5, 10],  spread: 2.2, grav: 0,   op: 1 },
  smoke: { tex: () => TEX.cloud, add: false, cols: ['#262626', '#333333', '#474747'], size: [8, 13],  grow: 3.4, life: [3.5, 6], up: [9, 14],  spread: 2.5, grav: 0,   op: .55, wind: 2 },
  steam: { tex: () => TEX.cloud, add: false, cols: ['#d8dde2', '#c4c9cf', '#eef1f4'], size: [8, 12],  grow: 4,   life: [3, 5],   up: [5, 9],   spread: 3,   grav: 0,   op: .55, wind: 3 },
  spark: { tex: () => TEX.glow,  add: true,  cols: ['#ffe08a', '#ffb347', '#fff2c0'], size: [1, 2],   grow: .4,  life: [.35, .8], up: [3, 9],  spread: 10,  grav: -22, op: 1 },
  dirt:  { tex: () => TEX.cloud, add: false, cols: ['#6b5a3e', '#7d6a48', '#55472f'], size: [5, 9],   grow: 2.5, life: [1.2, 2.2], up: [2, 6],  spread: 5,   grav: -2,  op: .8 },
  water: { tex: () => TEX.glow,  add: false, cols: ['#e8f6ff', '#cfe9ff', '#ffffff'], size: [1.6, 2.6], grow: 1.8, life: [1.1, 1.6], up: [0, 0], spread: 1.2, grav: -9.8, op: .85 },
  flash: { tex: () => TEX.glow,  add: true,  cols: ['#fff3c8'],                       size: [30, 30], grow: 5,   life: [.55, .55], up: [0, 0], spread: 0,   grav: 0,   op: 1 },
};
function fxInit() { fxClear(); FX.group = new THREE.Group(); W.scene.add(FX.group); }
function fxClear() {
  if (FX.group) W.scene.remove(FX.group);
  FX.group = null; FX.live = []; FX.pool = {}; FX.emitters = [];
  FX.trucks.forEach(t => t.root.parent && t.root.parent.remove(t.root)); FX.trucks = [];
}
function fxSprite(kind) {
  const k = FX_KIND[kind], pool = FX.pool[kind] || (FX.pool[kind] = []);
  let s = pool.pop();
  if (!s) { const m = new THREE.SpriteMaterial({ map: k.tex(), transparent: true, depthWrite: false, fog: true,
      blending: k.add ? THREE.AdditiveBlending : THREE.NormalBlending });
    s = new THREE.Sprite(m); s.userData.kind = kind; }
  FX.group.add(s); return s;
}
/* emit n particles of a kind at pos; vel = optional base velocity */
function fxEmit(kind, pos, n = 1, vel = null, scale = 1) {
  if (!FX.group || FX.live.length > 900) return;
  const k = FX_KIND[kind];
  for (let i = 0; i < n; i++) {
    const s = fxSprite(kind), sz = rnd(k.size[0], k.size[1]) * scale;
    s.position.set(pos.x + rnd(-k.spread, k.spread) * .3 * scale, pos.y + rnd(-.5, .5), pos.z + rnd(-k.spread, k.spread) * .3 * scale);
    s.material.color.set(k.cols[(Math.random() * k.cols.length) | 0]); s.material.opacity = k.op; s.material.rotation = rnd(0, 6.28);
    s.scale.set(sz, sz, 1);
    const v = new THREE.Vector3(rnd(-k.spread, k.spread), rnd(k.up[0], k.up[1]), rnd(-k.spread, k.spread));
    if (vel) v.add(vel);
    FX.live.push({ s, v, age: 0, life: rnd(k.life[0], k.life[1]), sz, k });
  }
}
/* an emitter keeps spawning while it lives: pos is a Vector3 or a function returning one */
function fxEmitter(kind, pos, rate, opts = {}) { const e = { kind, pos, rate, acc: 0, k: opts.k ?? 1, scale: opts.scale || 1, vel: opts.vel || null, on: true }; FX.emitters.push(e); return e; }
const _fp = new THREE.Vector3();
function fxTick(dt) {
  if (!FX.group) return;
  for (const e of FX.emitters) { if (!e.on || e.k <= .01) continue;
    e.acc += e.rate * e.k * dt; const n = Math.floor(e.acc); if (!n) continue; e.acc -= n;
    const p = typeof e.pos === 'function' ? e.pos(_fp) : e.pos; if (!p) continue;
    fxEmit(e.kind, p, n, typeof e.vel === 'function' ? e.vel() : e.vel, e.scale * (.6 + .4 * e.k)); }
  for (let i = FX.live.length - 1; i >= 0; i--) {
    const p = FX.live[i]; p.age += dt; const u = p.age / p.life;
    if (u >= 1) { FX.group.remove(p.s); FX.pool[p.s.userData.kind].push(p.s); FX.live.splice(i, 1); continue; }
    p.v.y += p.k.grav * dt; if (p.k.wind) p.v.x += p.k.wind * dt * .3;
    p.s.position.addScaledVector(p.v, dt);
    if (p.k.grav < -5 && p.s.position.y < .2) { p.s.position.y = .2; p.v.multiplyScalar(.3); }
    const sc = p.sz * (1 + (p.k.grow - 1) * u); p.s.scale.set(sc, sc, 1);
    p.s.material.opacity = p.k.op * (u < .1 ? u * 10 : 1) * (1 - u) ** (p.k.add ? 1.2 : .8);
  }
  FX.trucks.forEach(t => t.tick(dt));
}

/* ── airport fire truck (ARFF): red body, light bar, roof water cannon ── */
function buildFireTruck() {
  const root = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: .45, metalness: .2 });
  const dark = new THREE.MeshStandardMaterial({ color: '#141414', roughness: .8 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1d2a38', roughness: .1, metalness: .6 });
  const white = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: .6 });
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; root.add(b); return b; };
  box(9.5, 2.6, 3, red, -.6, 2.2, 0);            // body
  box(2.6, 2.3, 2.9, red, 4.7, 2.05, 0);         // cab
  box(.12, 1.1, 2.6, glass, 6.02, 2.55, 0);      // windscreen
  box(9.6, .28, 3.05, white, -.6, 1.5, 0);       // stripe
  box(10.8, .5, 2.6, dark, .2, .8, 0);           // chassis
  for (const x of [-3.6, -1.2, 4.4]) for (const z of [-1.35, 1.35]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, .55, 18), dark); w.rotation.x = Math.PI / 2; w.position.set(x, .75, z); root.add(w); }
  const turret = new THREE.Group(); turret.position.set(3.2, 3.55, 0); root.add(turret);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.35, .45, .5, 12), white); turret.add(base);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, 2.2, 10), new THREE.MeshStandardMaterial({ color: '#c9c9c9', metalness: .8, roughness: .3 }));
  barrel.rotation.z = -Math.PI / 2 + .35; barrel.position.set(1, .55, 0); turret.add(barrel);
  const nozzle = new THREE.Object3D(); nozzle.position.set(2.05, .95, 0); turret.add(nozzle);
  const lr = glowSprite('#ff2020', 2.6), lb = glowSprite('#2a6bff', 2.6); lr.position.set(4.7, 3.45, -.8); lb.position.set(4.7, 3.45, .8); root.add(lr, lb);
  box(.5, .25, 2.2, dark, 4.7, 3.3, 0);
  const T = { root, turret, nozzle, lights: [lr, lb], t: Math.random() * 2, on: true, spray: null, target: null, path: null };
  T.tick = dt => {
    T.t += dt; const ph = (T.t * 2.4) % 2;
    lr.visible = T.on && ph < 1 && (ph % .5) < .3; lb.visible = T.on && ph >= 1 && (ph % .5) < .3;
    if (T.path) { T.path.t = Math.min(1, T.path.t + dt / T.path.dur); const u = smooth(T.path.t);
      const p = T.path.curve.getPointAt(u); root.position.set(p.x, 0, p.z);
      const tg = T.path.curve.getTangentAt(Math.min(.999, Math.max(.001, u))); root.rotation.y = Math.atan2(-tg.z, tg.x);
      if (T.path.t >= 1) { const cb = T.path.cb; T.path = null; cb && cb(); } }
    if (T.target) { const tp = typeof T.target === 'function' ? T.target(new THREE.Vector3()) : T.target;
      const lp = root.worldToLocal(tp.clone()); turret.rotation.y = Math.atan2(-(lp.z), lp.x - turret.position.x); }
  };
  return T;
}
/* drive a truck along waypoints [[x,z],...] over dur seconds */
function truckDrive(T, pts, dur, cb) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  T.path = { curve, dur, t: 0, cb };
}
/* point the truck's water cannon at a target (Vector3 or function) and spray */
function truckSpray(T, target) {
  T.target = target;
  if (T.spray) T.spray.on = false;
  const nozzleW = out => T.nozzle.getWorldPosition(out);
  T.spray = fxEmitter('water', nozzleW, 70, { vel: () => {
    const from = T.nozzle.getWorldPosition(new THREE.Vector3()), to = typeof target === 'function' ? target(new THREE.Vector3()) : target.clone();
    const d = to.sub(from), flat = Math.hypot(d.x, d.z), tFly = clamp(flat / 26, .6, 2.2);
    return new THREE.Vector3(d.x / tFly, (d.y + .5 * 9.8 * tFly * tFly) / tFly, d.z / tFly);
  } });
}
