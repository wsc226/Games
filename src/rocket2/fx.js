// Sky, stars, Earth, exhaust flames, smoke particles, re-entry glow
import * as THREE from 'three';
import { TAU, rng, revolve, ctex, speckle, clamp, lerp, smooth } from './util.js';
import { LAND, SEA } from './site.js';

export const R_EARTH = 6371000;

// ---------------- sky dome ----------------
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
    uniforms: { uSpace: { value: 0 }, uDip: { value: 0 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uUp: { value: new THREE.Vector3(0, 1, 0) } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; }`,
    fragmentShader: `
      varying vec3 vDir; uniform float uSpace; uniform float uDip; uniform vec3 uSun; uniform vec3 uUp;
      void main(){
        vec3 d = normalize(vDir);
        float h = max(dot(d, uUp) - uDip, 0.0);
        vec3 zen = mix(vec3(0.16,0.38,0.80), vec3(0.0,0.0,0.012), uSpace);
        vec3 hor = mix(vec3(0.74,0.86,0.96), vec3(0.30,0.58,1.0), uSpace);
        float k = mix(3.2, 34.0, uSpace);
        vec3 col = mix(zen, hor, exp(-h*k));
        float s = max(dot(d, normalize(uSun)), 0.0);
        col += vec3(1.0,0.93,0.8) * (pow(s, 900.0)*3.0 + pow(s, 40.0)*0.18*(1.0-uSpace*0.6));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mat);
  mesh.scale.setScalar(900); mesh.renderOrder = -30; mesh.frustumCulled = false;
  return {
    mesh,
    update(cam, alt, sunDir, up) {
      if (up) mat.uniforms.uUp.value.copy(up);
      mesh.position.copy(cam.position);
      const a = Math.max(alt, 0);
      mat.uniforms.uSpace.value = smooth(9000, 85000, a);
      mat.uniforms.uDip.value = -Math.sqrt(2 * R_EARTH * a + a * a) / (R_EARTH + a);
      mat.uniforms.uSun.value.copy(sunDir);
    },
    horizonColor(space) { return new THREE.Color().setRGB(lerp(.74, .3, space), lerp(.86, .58, space), lerp(.96, 1, space), THREE.SRGBColorSpace); },
  };
}

export function makeStars() {
  const r = rng(99), N = 2200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - u * u), b = .35 + Math.pow(r(), 3) * .65;
    pos.set([s * Math.cos(a) * 800, u * 800, s * Math.sin(a) * 800], i * 3);
    col.set([b, b, b * (.85 + r() * .3)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false, transparent: false });
  const pts = new THREE.Points(g, mat); pts.renderOrder = -25; pts.frustumCulled = false;
  return { mesh: pts, update(cam, space) { pts.position.copy(cam.position); pts.visible = space > .05; mat.color.setScalar(space * space); } };
}

// ---------------- Earth (sphere centred R below the pad) ----------------
export function makeEarth() {
  const r = rng(21);
  const tex = ctex(2048, 1024, (g, w, h) => {
    g.fillStyle = SEA; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1500, r, ['#174a72', '#226a96', '#1a557f'], .08, .2, 10, 60);
    const blob = (cx, cy, rx, ry, col, n = 26) => {
      g.fillStyle = col; g.beginPath();
      for (let i = 0; i <= n; i++) { const a = i / n * TAU, k = .7 + r() * .55; g.lineTo(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k); }
      g.fill();
    };
    const land = (cx, cy, rx, ry) => {
      blob(cx, cy, rx, ry, LAND);
      for (let i = 0; i < 14; i++) blob(cx + (r() - .5) * rx * 1.2, cy + (r() - .5) * ry * 1.2, rx * .25, ry * .25, ['#7d8a5a', '#4d6a43', '#9a8f66', '#6f8457'][i % 4], 12);
    };
    // launch site sits at u=.25, v=.5 with land to the west and ocean to the east
    const sx = .25 * w, sy = .5 * h;
    land(sx - 150, sy - 70, 150, 120); land(sx - 60, sy + 40, 58, 70);
    g.fillStyle = LAND; g.fillRect(sx - 70, sy - 60, 70, 120);
    g.fillStyle = SEA; g.fillRect(sx + .1, sy - 130, 130, 260);
    for (const [u, v, rx, ry] of [[.52, .42, 150, 140], [.5, .62, 90, 110], [.78, .36, 230, 110], [.9, .68, 70, 50], [.08, .68, 80, 130], [.66, .2, 120, 50]]) land(u * w, v * h, rx, ry);
    g.fillStyle = '#f2f5f7'; g.fillRect(0, 0, w, 46); g.fillRect(0, h - 54, w, 54);
    for (let i = 0; i < 60; i++) { blob(r() * w, 30 + r() * 40, 60, 22, '#f2f5f7', 10); blob(r() * w, h - 40 - r() * 40, 70, 24, '#f2f5f7', 10); }
  }, { aniso: 8 });
  tex.wrapS = THREE.RepeatWrapping;
  const cloudT = ctex(1024, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 230; i++) {
      const band = r() < .6, x = r() * w, y = band ? (h * (.2 + .6 * ((i * 37) % 5) / 4) + (r() - .5) * 130 + h) % h : r() * h, s = 10 + r() * (band ? 60 : 34);
      for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, s);
        gr.addColorStop(0, `rgba(255,255,255,${.2 + r() * .4})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x + ox - s, y + oy - s, s * 2, s * 2);
      }
    }
  }, { repeat: [22, 11], aniso: 4 });
  const group = new THREE.Group();
  const bg = { depthTest: false, depthWrite: false, fog: false };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH - 40, 256, 128), new THREE.MeshBasicMaterial({ map: tex, ...bg }));
  earth.rotation.x = -Math.PI / 2; earth.renderOrder = -20; earth.frustumCulled = false;
  const cloudMat = new THREE.MeshBasicMaterial({ map: cloudT, ...bg, transparent: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, opacity: 0 });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH + 9000, 192, 96), cloudMat);
  clouds.rotation.x = -Math.PI / 2; clouds.renderOrder = -19; clouds.frustumCulled = false;
  group.add(earth, clouds);
  return { group, setAlt(a) { cloudMat.opacity = smooth(12000, 40000, a) * .8; clouds.visible = cloudMat.opacity > .01; } };
}

// ---------------- low clouds near the ground ----------------
export function makeLowClouds() {
  const r = rng(3), g = new THREE.Group();
  const t = ctex(256, 128, (c, w, h) => {
    for (let i = 0; i < 40; i++) {
      const x = 30 + r() * (w - 60), y = 40 + r() * 50, s = 18 + r() * 34;
      const gr = c.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(x - s, y - s, s * 2, s * 2);
    }
  });
  const mat = new THREE.SpriteMaterial({ map: t, depthWrite: false, fog: false, opacity: .9 });
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(mat), a = r() * TAU, d = 4000 + r() * 16000;
    s.position.set(Math.cos(a) * d, 2600 + r() * 2200, Math.sin(a) * d); s.scale.set(2600 + r() * 2600, 900 + r() * 700, 1);
    g.add(s);
  }
  return g;
}

// ---------------- smoke / steam particles (instanced camera-facing quads) ----------------
export class Smoke {
  constructor(max = 1400) {
    this.max = max; this.n = 0;
    this.p = []; for (let i = 0; i < max; i++) this.p.push({ life: 0 });
    const r = rng(8);
    const tex = ctex(128, 128, (g, w, h) => {
      for (let i = 0; i < 26; i++) {
        const a = r() * TAU, d = r() * 26, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, s = 20 + r() * 22;
        const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
    }, { linear: true });
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, .5, .5, 0, -.5, .5, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSR = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPos', this.aPos); geo.setAttribute('aCol', this.aCol); geo.setAttribute('aSR', this.aSR);
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { map: { value: tex } },
      vertexShader: `attribute vec3 aPos; attribute vec4 aCol; attribute vec2 aSR; varying vec2 vUv; varying vec4 vCol;
        void main(){ vUv = uv; vCol = aCol; vec4 mv = viewMatrix * vec4(aPos, 1.0);
          float c = cos(aSR.y), s = sin(aSR.y); vec2 q = position.xy * aSR.x;
          mv.xy += vec2(c*q.x - s*q.y, s*q.x + c*q.y); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;
        void main(){ float a = texture2D(map, vUv).a * vCol.a; if (a < 0.004) discard; gl_FragColor = vec4(vCol.rgb, a); }`,
    });
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    this.next = 0;
  }
  /** o: pos(Vector3) vel(Vector3) size grow life col0[r,g,b] col1[r,g,b] alpha drag rise floor */
  emit(o) {
    const q = this.p[this.next]; this.next = (this.next + 1) % this.max;
    q.x = o.pos.x; q.y = o.pos.y; q.z = o.pos.z; q.vx = o.vel.x; q.vy = o.vel.y; q.vz = o.vel.z;
    q.size = o.size; q.grow = o.grow ?? 4; q.life = q.max = o.life ?? 5; q.c0 = o.col0 || [1, 1, 1]; q.c1 = o.col1 || [.85, .85, .85];
    q.alpha = o.alpha ?? .5; q.drag = o.drag ?? .8; q.rise = o.rise ?? 0; q.floor = o.floor ?? -1e9; q.rot = Math.random() * TAU; q.spin = (Math.random() - .5) * .5;
    q.hot = o.hot ?? .12;
  }
  clear() { for (const q of this.p) q.life = 0; }
  update(dt) {
    let n = 0; const P = this.aPos.array, C = this.aCol.array, SR = this.aSR.array;
    for (const q of this.p) {
      if (q.life <= 0) continue;
      q.life -= dt; if (q.life <= 0) continue;
      const k = Math.exp(-q.drag * dt);
      q.vx *= k; q.vz *= k; q.vy = q.vy * k + q.rise * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.y < q.floor) { q.y = q.floor; q.vy = Math.abs(q.vy) * .15; }
      q.size += q.grow * dt; q.rot += q.spin * dt;
      const age = 1 - q.life / q.max, t = clamp(age / q.hot, 0, 1);
      P[n * 3] = q.x; P[n * 3 + 1] = q.y; P[n * 3 + 2] = q.z;
      C[n * 4] = lerp(q.c0[0], q.c1[0], t); C[n * 4 + 1] = lerp(q.c0[1], q.c1[1], t); C[n * 4 + 2] = lerp(q.c0[2], q.c1[2], t);
      C[n * 4 + 3] = q.alpha * Math.min(1, age * 12) * Math.pow(1 - age, 1.4);
      SR[n * 2] = q.size; SR[n * 2 + 1] = q.rot; n++;
    }
    this.mesh.geometry.instanceCount = n;
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSR.needsUpdate = true;
  }
}

// ---------------- exhaust flames ----------------
const flameTex = {};
function flameTexture(kind) {
  if (flameTex[kind]) return flameTex[kind];
  const r = rng(kind.length * 7 + 1);
  const t = ctex(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);          // canvas top = nozzle end
    if (kind === 'srb') { gr.addColorStop(0, 'rgba(255,255,235,1)'); gr.addColorStop(.12, 'rgba(255,236,150,1)'); gr.addColorStop(.4, 'rgba(255,170,60,.85)'); gr.addColorStop(.75, 'rgba(255,110,30,.4)'); gr.addColorStop(1, 'rgba(255,80,20,0)'); }
    else if (kind === 'rs25') { gr.addColorStop(0, 'rgba(210,235,255,.95)'); gr.addColorStop(.2, 'rgba(150,200,255,.6)'); gr.addColorStop(.6, 'rgba(120,170,255,.28)'); gr.addColorStop(1, 'rgba(120,160,255,0)'); }
    else if (kind === 'plasma') { gr.addColorStop(0, 'rgba(255,190,120,.75)'); gr.addColorStop(.2, 'rgba(255,120,60,.5)'); gr.addColorStop(.6, 'rgba(255,70,90,.22)'); gr.addColorStop(1, 'rgba(255,80,160,0)'); }
    else { gr.addColorStop(0, 'rgba(225,235,255,.9)'); gr.addColorStop(.3, 'rgba(160,190,255,.45)'); gr.addColorStop(1, 'rgba(140,170,255,0)'); }
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 40; i++) { g.globalAlpha = .08 + r() * .12; g.fillRect(r() * w, r() * h, 1 + r() * 2, 20 + r() * 70); }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    if (kind === 'rs25') for (let i = 0; i < 5; i++) {        // shock diamonds
      const y = 18 + i * 30, gr2 = g.createRadialGradient(w / 2, y, 0, w / 2, y, 16);
      gr2.addColorStop(0, `rgba(255,255,255,${.75 - i * .12})`); gr2.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr2; g.fillRect(0, y - 16, w, 32);
    }
  });
  return (flameTex[kind] = t);
}
/** flame pointing along -Y from the origin. r0 = nozzle radius, r1 = far radius, len = length */
export function makeFlame(kind, r0, r1, len) {
  const g = new THREE.Group();
  const mk = (ra, rb, l, op) => {
    const pts = []; for (let i = 0; i <= 10; i++) { const s = i / 10; pts.push([lerp(rb, ra, s) * (1 - .55 * Math.pow(1 - s, 6)), -l * (1 - s)]); }
    const m = new THREE.Mesh(revolve(pts, { segs: 20, v0: -l, v1: 0 }), new THREE.MeshBasicMaterial({ map: flameTexture(kind), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: op, fog: false, toneMapped: false }));
    m.renderOrder = 4; g.add(m); return m;
  };
  const outer = mk(r0, r1, len, .9), innerF = mk(r0 * .55, r1 * .4, len * .62, 1);
  g.visible = false;
  let ph = Math.random() * 10;
  g.userData.set = (power, lenK = 1, wideK = 1, dt = 0.016) => {
    g.visible = power > .01; if (!g.visible) return;
    ph += dt * 30;
    const f = 1 + Math.sin(ph) * .04 + Math.sin(ph * 2.7) * .03;
    g.scale.set(wideK * (1 + (f - 1) * .5), lenK * f * (.35 + .65 * power), wideK * (1 + (f - 1) * .5));
    outer.material.opacity = .9 * power; innerF.material.opacity = power;
  };
  return g;
}

/** re-entry plasma sheath; sits at the heat shield, trails along +Y of its parent */
export function makeEntryGlow() {
  const g = new THREE.Group();
  const pts = []; for (let i = 0; i <= 10; i++) { const s = i / 10; pts.push([2.75 + 1.2 * s - 3.2 * s * s, 30 * s]); }
  const m = new THREE.Mesh(revolve(pts.map(([rr, y]) => [Math.max(.3, rr), -y]).reverse(), { segs: 24, v0: -30, v1: 0 }),
    new THREE.MeshBasicMaterial({ map: flameTexture('plasma'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }));
  m.rotation.x = Math.PI; m.renderOrder = 4; g.add(m);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(3.1, 24, 12, 0, TAU, Math.PI * .5, Math.PI * .5), new THREE.MeshBasicMaterial({ color: 0xff9a55, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .5, fog: false, toneMapped: false }));
  cap.scale.y = .35; cap.renderOrder = 4; g.add(cap);
  g.visible = false;
  g.userData.set = p => { g.visible = p > .01; m.material.opacity = .75 * p; cap.material.opacity = .5 * p; g.scale.setScalar(1 + Math.random() * .04); };
  return g;
}
