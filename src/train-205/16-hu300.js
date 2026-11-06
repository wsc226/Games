/* ═══ HU300 (Utsunomiya Light Line LRT): 3-section articulated tram ═══
   Section local space: +x = forward, y up from rail top, +z = right.            */
const HU = { La: 10.0, Lb: 7.6, gap: .6, W: 2.45, top: 3.5, bot: .25 };
const HM = {};
function huMaterials() {
  if (HM.done) return HM; HM.done = true;
  HM.yellow = new THREE.MeshStandardMaterial({ color: 0xffbe12, roughness: .3, metalness: .2 });
  HM.black = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: .35, metalness: .4 });
  HM.glass = new THREE.MeshStandardMaterial({ color: 0x0b1018, roughness: .05, metalness: .7 });
  HM.grey = new THREE.MeshStandardMaterial({ color: 0x5b6068, roughness: .6, metalness: .4 });
  HM.bellows = new THREE.MeshStandardMaterial({ map: canvasTex(64, 128, (g, W, H) => {
    g.fillStyle = '#9ea4aa'; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 8) { g.fillStyle = '#d6dade'; g.fillRect(x, 0, 4, H); g.fillStyle = '#6d7379'; g.fillRect(x + 5, 0, 2, H); }
  }), roughness: .5, metalness: .4 });
  HM.lampW = new THREE.MeshBasicMaterial({ color: 0xffffff });
  HM.lampR = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  return HM;
}
function huSideTex(end) {
  // canvas covers x ∈ [-L/2-.2, L/2+.2] (L = section length) and y ∈ [0, 3.6]
  const L = end ? HU.La : HU.Lb, span = L + .4, Wpx = 1024, Hpx = 256;
  const X = x => (x + L / 2 + .2) / span * Wpx, Y = y => (3.6 - y) / 3.6 * Hpx;
  const t = canvasTex(Wpx, Hpx, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, Hpx); gr.addColorStop(0, '#232a36'); gr.addColorStop(1, '#0e1218');
    g.fillStyle = gr; g.fillRect(0, 0, Wpx, Hpx);
    g.fillStyle = '#ffbe12'; g.fillRect(0, Y(.78), Wpx, Y(.2) - Y(.78));                       // yellow skirt
    // windows (tinted, with seat headrests showing through)
    const win = (a, b) => {
      g.fillStyle = '#2c3a4a'; g.fillRect(X(a), Y(2.95), X(b) - X(a), Y(1.1) - Y(2.95));
      const sh = g.createLinearGradient(X(a), Y(2.95), X(b), Y(1.1)); sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,.08)');
      g.fillStyle = sh; g.fillRect(X(a), Y(2.95), X(b) - X(a), Y(1.1) - Y(2.95));
      g.fillStyle = '#f2b30c'; for (let x = a + .35; x < b - .2; x += .9) g.fillRect(X(x), Y(1.75), X(x + .35) - X(x), 7);
    };
    const door = (c) => {
      g.fillStyle = '#1b2029'; g.fillRect(X(c - .7), Y(3.0), X(c + .7) - X(c - .7), Y(.25) - Y(3.0));
      g.fillStyle = '#2c3a4a'; g.fillRect(X(c - .62), Y(2.9), X(c - .05) - X(c - .62), Y(.9) - Y(2.9)); g.fillRect(X(c + .05), Y(2.9), X(c + .62) - X(c + .05), Y(.9) - Y(2.9));
      g.fillStyle = '#ffbe12'; g.fillRect(X(c - .03), Y(2.9), 5, Y(.3) - Y(2.9)); g.fillRect(X(c - .72), Y(3.0), 4, Y(.25) - Y(3.0)); g.fillRect(X(c + .7), Y(3.0), 4, Y(.25) - Y(3.0));
    };
    if (end) {
      win(-L / 2 + .3, -L / 2 + 3.0); door(-L / 2 + 3.9); win(-L / 2 + 4.8, L / 2 - 2.6);
      // yellow nose wrap + cab side window
      g.fillStyle = '#ffbe12'; g.beginPath(); g.moveTo(X(L / 2 - 1.2), Y(3.55)); g.quadraticCurveTo(X(L / 2 - 2.0), Y(2.0), X(L / 2 - 3.1), Y(.78));
      g.lineTo(X(L / 2 + .3), Y(.78)); g.lineTo(X(L / 2 + .3), Y(3.55)); g.closePath(); g.fill();
      g.fillStyle = '#121822'; g.beginPath(); g.moveTo(X(L / 2 - 1.55), Y(3.05)); g.quadraticCurveTo(X(L / 2 - 2.0), Y(2.1), X(L / 2 - 2.35), Y(1.55));
      g.lineTo(X(L / 2 - .7), Y(1.55)); g.lineTo(X(L / 2 - .5), Y(2.6)); g.closePath(); g.fill();
    } else {
      win(-L / 2 + .25, -.85); door(0); win(.85, L / 2 - .25);
    }
  });
  t.repeat.set(1 / span, 1 / 3.6); t.offset.set((L / 2 + .2) / span, 0); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
function buildHuSection(end) {
  const M = huMaterials(), L = end ? HU.La : HU.Lb, h = L / 2;
  const sh = new THREE.Shape();
  if (end) {
    sh.moveTo(-h, HU.bot); sh.lineTo(h - .25, HU.bot); sh.quadraticCurveTo(h + .05, HU.bot, h + .05, .7);
    sh.lineTo(h + .05, 1.35); sh.quadraticCurveTo(h - .25, 2.6, h - .95, 3.15); sh.quadraticCurveTo(h - 1.3, HU.top, h - 1.9, HU.top); sh.lineTo(-h, HU.top);
  } else {
    sh.moveTo(-h, HU.bot); sh.lineTo(h, HU.bot); sh.lineTo(h, HU.top); sh.lineTo(-h, HU.top);
  }
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: HU.W - .2, bevelEnabled: true, bevelThickness: .1, bevelSize: .1, bevelSegments: 3, curveSegments: 10 });
  geo.translate(0, 0, -(HU.W - .2) / 2);
  const side = new THREE.MeshStandardMaterial({ map: huSideTex(end), roughness: .3, metalness: .35 });
  const sec = new THREE.Group();
  const body = new THREE.Mesh(geo, [side, end ? M.yellow : M.black]); body.castShadow = true; body.userData.dyn = true; sec.add(body);
  // black roof plate (the walls of the extrusion are yellow on the end sections)
  const roofL = end ? L - 2.2 : L;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(roofL, .06, HU.W - .05), M.black); roof.position.set(-h + roofL / 2, HU.top + .1, 0); sec.add(roof);
  if (end) {
    // big sloped windshield + headlights / taillights
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 1.85), M.glass);
    ws.position.set(h - .3, 2.3, 0); ws.rotation.set(0, Math.PI / 2, 0); ws.rotateX(-.66); ws.translateZ(.2); sec.add(ws);
    // car number on the yellow nose (a separate plane per side so it never reads backwards)
    const numT = textBoard([['HU313', 40, .5]], { w: 160, h: 48, bg: '#ffbe12', fg: '#14171d' });
    for (const zs of [-1, 1]) { const nm = new THREE.Mesh(new THREE.PlaneGeometry(.9, .27), new THREE.MeshStandardMaterial({ map: numT })); nm.position.set(h - 1.6, 1.05, zs * (HU.W / 2 + .005)); nm.rotation.y = zs > 0 ? 0 : Math.PI; sec.add(nm); }
    sec.lamps = [];
    for (const z of [-.95, .95]) {
      const lw = new THREE.Mesh(new THREE.BoxGeometry(.04, .09, .3), M.lampW); lw.position.set(h + .1, .95, z); sec.add(lw);
      const lr = new THREE.Mesh(new THREE.BoxGeometry(.04, .07, .18), M.lampR); lr.position.set(h + .1, 1.12, z * .9); sec.add(lr);
      sec.lamps.push({ w: lw, r: lr });
    }
    // roof equipment
    const ac = new THREE.Mesh(new THREE.BoxGeometry(2.6, .32, 1.8), M.grey); ac.position.set(-h + 2.2, HU.top + .25, 0); sec.add(ac);
  } else {
    // pantograph
    const pg = new THREE.Group(); pg.position.set(0, HU.top + .12, 0);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, .14, 1.0), M.grey); pg.add(base);
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(1.3, .05, .05).translate(.65, 0, 0), M.grey); a1.position.set(-.5, .1, 0); a1.rotation.z = .9; pg.add(a1);
    const ex = -.5 + 1.3 * Math.cos(.9), ey = .1 + 1.3 * Math.sin(.9);
    const a2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, .04, .04).translate(-.6, 0, 0), M.grey); a2.position.set(ex, ey, 0); a2.rotation.z = -.55; pg.add(a2);
    const hy = 5.2 - (HU.top + .12) - .03;
    const head = new THREE.Mesh(new THREE.BoxGeometry(.2, .05, 1.5), M.grey); head.position.set(ex - 1.2 * Math.cos(.55), hy, 0); pg.add(head);
    pg.scale.y = hy / (ey + 1.2 * Math.sin(.55)); head.scale.y = 1 / pg.scale.y;
    sec.add(pg);
    const ac = new THREE.Mesh(new THREE.BoxGeometry(2.0, .3, 1.7), M.grey); ac.position.set(-2.4, HU.top + .24, 0); sec.add(ac);
  }
  // small wheels peeking under the skirt
  const wg = new THREE.CylinderGeometry(.33, .33, .1, 16).rotateX(Math.PI / 2);
  for (const x of end ? [-h + 1.6, h - 2.6] : [0]) for (const z of [-.6, .6]) { const w = new THREE.Mesh(wg, M.grey); w.position.set(x, .33, z); sec.add(w); }
  mergeStatic(sec);
  return sec;
}
class HU300 {
  constructor(scene) {
    this.secs = [buildHuSection(true), buildHuSection(false), buildHuSection(true)];
    this.secs[2].userData.flip = true;
    this.bellows = [0, 1].map(() => { const b = new THREE.Mesh(new THREE.BoxGeometry(HU.gap + .2, 3.0, 2.3), huMaterials().bellows); return b; });
    this.root = new THREE.Group(); [...this.secs, ...this.bellows].forEach(o => this.root.add(o)); scene.add(this.root);
    this.s = 0; this.v = 0;
    this.place();
  }
  centers() {
    const { La, Lb, gap } = HU;
    return [this.s - La / 2, this.s - La - gap - Lb / 2, this.s - La - gap - Lb - gap - La / 2];
  }
  place() {
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    const cs = this.centers();
    this.secs.forEach((sec, i) => {
      const L = i === 1 ? HU.Lb : HU.La, sc = cs[i];
      posAt(sc + L * .38, raceOff(sc + L * .38), 0, a); posAt(sc - L * .38, raceOff(sc - L * .38), 0, b);
      sec.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      sec.rotation.set(0, Math.atan2(-(a.z - b.z), a.x - b.x) + (sec.userData.flip ? Math.PI : 0), 0);
    });
    [0, 1].forEach(i => {
      const s = (cs[i] + cs[i + 1]) / 2 + (i === 0 ? (HU.La - HU.Lb) / 4 : -(HU.La - HU.Lb) / 4);
      const bs = i === 0 ? this.s - HU.La - HU.gap / 2 : this.s - HU.La - HU.gap - HU.Lb - HU.gap / 2;
      posAt(bs, raceOff(bs), 1.85, this.bellows[i].position); this.bellows[i].rotation.y = yawAt(bs) + Math.atan2(raceOff(bs + 1) - raceOff(bs - 1), 2);
    });
  }
  pos(out) { return posAt(this.s - 14, raceOff(this.s - 14), 0, out); }
}
