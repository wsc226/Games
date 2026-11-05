/* ═══ PROCEDURAL TEXTURES (canvas) ═══ */
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(c, { repeat = null, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
}
// cheap value noise
function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, period) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const P = period || 1e9;
  const h = (a, b) => hash2(((a % P) + P) % P, ((b % P) + P) % P);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
function fbm(x, y, oct = 4, period = 0) {
  let a = 0, amp = .5, f = 1;
  for (let i = 0; i < oct; i++) { a += amp * vnoise(x * f, y * f, period ? period * f : 0); amp *= .5; f *= 2; }
  return a;
}
// Tileable noise image painted with a colour ramp
function noiseCanvas(size, scale, ramp, oct = 5) {
  const c = makeCanvas(size, size), g = c.getContext('2d'), img = g.createImageData(size, size);
  const per = scale;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = fbm(x / size * scale, y / size * scale, oct, per);
    const col = ramp(n, x, y); const i = (y * size + x) * 4;
    img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = col[3] ?? 255;
  }
  g.putImageData(img, 0, 0); return c;
}
const TEX = {};
function buildBaseTextures() {
  if (TEX.ready) return; TEX.ready = true;
  TEX.grass = canvasTex(noiseCanvas(256, 8, n => { const k = n * 70; return [70 + k * .5, 105 + k, 52 + k * .3]; }), { repeat: [600, 600] });
  TEX.asphalt = noiseCanvas(256, 32, n => { const k = 48 + n * 40; return [k, k, k + 3]; }, 3);
  TEX.concrete = (() => {
    const c = noiseCanvas(256, 16, n => { const k = 150 + n * 45; return [k, k - 2, k - 6]; }, 3);
    const g = c.getContext('2d'); g.strokeStyle = 'rgba(70,70,70,.45)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256);
    return canvasTex(c, { repeat: [1, 1] });
  })();
  // runway: one tile = 60 m long, 60 m wide. Centre dash 30 m + gap 20 m ≈ use 60 m period.
  TEX.runway = (() => {
    const c = makeCanvas(512, 512), g = c.getContext('2d');
    g.drawImage(TEX.asphalt, 0, 0, 512, 512);
    g.fillStyle = '#e9e9e2';
    g.fillRect(0, 10, 512, 8); g.fillRect(0, 494, 512, 8);        // edge stripes
    g.fillRect(0, 252, 260, 8);                                    // centreline dash (~30 m)
    // tyre rubber
    g.fillStyle = 'rgba(20,20,20,.18)'; g.fillRect(0, 200, 512, 40); g.fillRect(0, 272, 512, 40);
    return canvasTex(c);
  })();
  TEX.taxi = (() => {
    const c = makeCanvas(256, 256), g = c.getContext('2d');
    g.drawImage(TEX.asphalt, 0, 0, 256, 256);
    return canvasTex(c);
  })();
  TEX.cloud = (() => {
    const s = 128, c = makeCanvas(s, s), g = c.getContext('2d'), img = g.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const dx = (x - s / 2) / (s / 2), dy = (y - s / 2) / (s / 2); const r = Math.sqrt(dx * dx + dy * dy);
      const n = fbm(x / 22, y / 22, 4);
      let a = clamp((1 - r) * 1.6 * (.55 + n * .9) - .15, 0, 1);
      const shade = 255 - clamp((dy + .3) * 50, 0, 60);   // darker bottoms
      const i = (y * s + x) * 4; img.data[i] = shade; img.data[i + 1] = shade; img.data[i + 2] = shade + 3; img.data[i + 3] = a * 255;
    }
    g.putImageData(img, 0, 0); return canvasTex(c);
  })();
  TEX.deck = canvasTex(noiseCanvas(512, 6, (n, x, y) => {
    const a = clamp((n - .32) * 3.2, 0, 1); const k = 228 + n * 27; return [k, k, k + 4, a * 255];
  }, 6), { repeat: [1, 1] });
  TEX.glass = (() => {
    const c = makeCanvas(256, 128), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#9fc3dc'); gr.addColorStop(1, '#3d6582');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#d9dde0'; g.lineWidth = 3;
    for (let x = 0; x <= 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
    g.beginPath(); g.moveTo(0, 64); g.lineTo(256, 64); g.stroke();
    return canvasTex(c, { repeat: [12, 1] });
  })();
  TEX.glow = (() => {
    const c = makeCanvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return canvasTex(c);
  })();
}
function textCanvas(text, { w = 512, h = 128, font = 'bold 80px Helvetica', color = '#fff', bg = null } = {}) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.font = font; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2);
  return c;
}
const logoImgs = {};
function logoImage(id) {
  if (!logoImgs[id]) { const im = new Image(); im.src = LOGOS[id]; logoImgs[id] = im; }
  return logoImgs[id];
}
function whenImg(im) { return im.complete && im.naturalWidth ? Promise.resolve(im) : new Promise(r => { im.onload = () => r(im); im.onerror = () => r(im); }); }
