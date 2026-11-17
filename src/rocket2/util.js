// Shared geometry + texture helpers for rocket2.html
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const WEDGE = Math.PI / 2;          // cutaway removes phi in [0, WEDGE]  (+x,+z quadrant)
export const DEG = Math.PI / 180;

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const ease = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/**
 * Surface of revolution around +Y from a profile of [r, y] points.
 * A point at angle phi sits at (r sin phi, y, r cos phi).
 * Outward normal of a segment is (dy, -dr): walk an outer wall upward, or a closed polygon counter-clockwise.
 * opts: segs (per full turn), phi0/phi1, closed, caps (flat end faces, needs closed),
 *       smooth (deg), mat(i) -> material index per segment, capMat, v0/v1 (y range mapped to v 0..1)
 */
export function revolve(pts, o = {}) {
  const { segs = 48, phi0 = 0, phi1 = TAU, closed = false, caps = false, smooth: sm = 40 } = o;
  const matOf = o.mat || (() => 0);
  const n = pts.length, nSeg = closed ? n : n - 1;
  const sn = [];
  for (let i = 0; i < nSeg; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy);
    sn.push(l < 1e-6 ? null : [dy / l, -dr / l]);
  }
  const cosT = Math.cos(sm * DEG);
  const vn = (i, j) => {
    const a = sn[i];
    if (closed) j = (j + nSeg) % nSeg;
    const b = (j >= 0 && j < nSeg) ? sn[j] : null;
    if (b && a[0] * b[0] + a[1] * b[1] > cosT) {
      const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1;
      return [x / l, y / l];
    }
    return a;
  };
  let ymin = Infinity, ymax = -Infinity;
  for (const p of pts) { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); }
  const va = o.v0 ?? ymin, vs = ((o.v1 ?? ymax) - va) || 1;
  const N = Math.max(2, Math.round(segs * (phi1 - phi0) / TAU));
  const pos = [], nor = [], uv = [];
  const buckets = new Map();            // material index -> index array
  const bucket = m => { if (!buckets.has(m)) buckets.set(m, []); return buckets.get(m); };

  for (let i = 0; i < nSeg; i++) {
    if (!sn[i]) continue;
    const a = pts[i], b = pts[(i + 1) % n];
    if (a[0] < 1e-6 && b[0] < 1e-6) continue;       // lies on the axis
    const n0 = vn(i, i - 1), n1 = vn(i, i + 1);
    const base = pos.length / 3, idx = bucket(matOf(i));
    for (let k = 0; k <= N; k++) {
      const phi = phi0 + (phi1 - phi0) * k / N, s = Math.sin(phi), c = Math.cos(phi), u = phi / TAU;
      pos.push(a[0] * s, a[1], a[0] * c, b[0] * s, b[1], b[0] * c);
      nor.push(n0[0] * s, n0[1], n0[0] * c, n1[0] * s, n1[1], n1[0] * c);
      uv.push(u, (a[1] - va) / vs, u, (b[1] - va) / vs);
    }
    for (let k = 0; k < N; k++) {
      const a0 = base + 2 * k, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3;
      idx.push(a0, a1, b1, a0, b1, b0);
    }
  }
  if (caps && closed) {
    const contour = pts.map(p => new THREE.Vector2(p[0], p[1]));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const capIdx = bucket(o.capMat ?? 1);
    for (const [phi, flip] of [[phi0, false], [phi1, true]]) {
      const s = Math.sin(phi), c = Math.cos(phi), base = pos.length / 3;
      const sg = flip ? 1 : -1;                       // outward normal = -/+ tangent
      for (const p of pts) {
        pos.push(p[0] * s, p[1], p[0] * c);
        nor.push(sg * c, 0, -sg * s);
        uv.push(p[0] / 8, (p[1] - va) / vs);
      }
      for (const t of tris) {
        const A = pts[t[0]], B = pts[t[1]], C = pts[t[2]];
        const area = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
        let ccw = area > 0;                            // CCW in (r,y) faces -tangent
        if (flip) ccw = !ccw;
        if (ccw) capIdx.push(base + t[0], base + t[1], base + t[2]);
        else capIdx.push(base + t[0], base + t[2], base + t[1]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const all = [];
  for (const m of [...buckets.keys()].sort((x, y) => x - y)) {
    const arr = buckets.get(m);
    g.addGroup(all.length, arr.length, m);
    for (const v of arr) all.push(v);
  }
  g.setIndex(all);
  return g;
}

/** quarter-ellipse dome profile. up=true: from (r,y) rising to (0,y+h). up=false: from (0,y-h) rising to (r,y). */
export function dome(r, y, h, up = true, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI / 2;
    if (up) out.push([r * Math.cos(a), y + h * Math.sin(a)]);
    else out.push([r * Math.sin(a), y - h * Math.cos(a)]);
  }
  return out;
}

/** closed polygon for a wall of thickness t along an ascending outer profile (outer up, inner down). */
export function shellPoly(outer, t) {
  const n = outer.length, inner = [];
  for (let i = 0; i < n; i++) {
    const p = outer[Math.max(0, i - 1)], q = outer[Math.min(n - 1, i + 1)];
    let dr = q[0] - p[0], dy = q[1] - p[1];
    const l = Math.hypot(dr, dy) || 1;
    const nx = dy / l, ny = -dr / l;
    inner.push([Math.max(0, outer[i][0] - nx * t), outer[i][1] - ny * t]);
  }
  return outer.concat(inner.reverse());
}

/** instanced boxes / cylinders: beams between two points, or plain boxes */
export class Batch {
  constructor(kind = 'box') { this.kind = kind; this.m = []; }
  beam(a, b, w, d = w) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const dir = B.clone().sub(A), len = dir.length();
    if (len < 1e-6) return this;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    this.m.push(new THREE.Matrix4().compose(A.add(B).multiplyScalar(.5), q, new THREE.Vector3(w, len, d)));
    return this;
  }
  box(x, y, z, sx, sy, sz, ry = 0) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    this.m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)));
    return this;
  }
  build(mat, shadow = true) {
    const geo = this.kind === 'box' ? new THREE.BoxGeometry(1, 1, 1) : new THREE.CylinderGeometry(.5, .5, 1, 10);
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, this.m.length));
    this.m.forEach((m, i) => im.setMatrixAt(i, m));
    im.count = this.m.length;
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = shadow; im.receiveShadow = shadow;
    im.computeBoundingSphere();
    return im;
  }
}

/** rectangular lattice tower into batch b */
export function truss(b, { cx, cz, w, d, y0, y1, bay, col = .6, brace = .3, faces = 'nsew' }) {
  const hx = w / 2, hz = d / 2;
  const c = [[cx - hx, cz - hz], [cx + hx, cz - hz], [cx + hx, cz + hz], [cx - hx, cz + hz]];
  for (const [x, z] of c) b.beam([x, y0, z], [x, y1, z], col);
  const nb = Math.round((y1 - y0) / bay), h = (y1 - y0) / nb;
  const fmap = { n: [0, 1], e: [1, 2], s: [2, 3], w: [3, 0] };
  for (let i = 0; i <= nb; i++) {
    const y = y0 + i * h;
    for (let k = 0; k < 4; k++) { const p = c[k], q = c[(k + 1) % 4]; b.beam([p[0], y, p[1]], [q[0], y, q[1]], brace * 1.2); }
    if (i === nb) break;
    for (const f of faces) {
      const [i0, i1] = fmap[f], p = c[i0], q = c[i1];
      if (i % 2 === 0) b.beam([p[0], y, p[1]], [q[0], y + h, q[1]], brace);
      else b.beam([q[0], y, q[1]], [p[0], y + h, p[1]], brace);
    }
  }
}

export function ctex(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  t.anisotropy = o.aniso ?? 4;
  return t;
}

/** speckle noise onto a 2d context */
export function speckle(g, w, h, n, r, colors, amin = .03, amax = .1, smin = 1, smax = 5) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = amin + r() * (amax - amin);
    g.fillStyle = colors[(r() * colors.length) | 0];
    const s = smin + r() * (smax - smin);
    g.fillRect(r() * w, r() * h, s * (0.6 + r()), s * (0.6 + r()));
  }
  g.globalAlpha = 1;
}

/** cylinder mesh between two points */
export function rod(a, b, r, mat, seg = 10) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.copy(A).add(B).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

export function pipe(points, r, mat, seg = 40, rs = 10) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.25);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, rs, false), mat);
}

export function disposeTree(root) {
  root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
}

/** merge meshes (their local transforms applied) into one geometry */
export function merged(meshes) {
  const pos = [], nor = [], uv = [];
  for (const m of meshes) {
    m.updateMatrix();
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrix);
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    if (g.attributes.uv) uv.push(...g.attributes.uv.array);
    else for (let i = 0; i < g.attributes.position.count; i++) uv.push(0, 0);
    g.dispose(); m.geometry.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

/** quick positioned mesh */
export function at(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  return m;
}
