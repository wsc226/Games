/* ═══ CANVAS TEXTURES ═══ */
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  return t;
}
function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function speckle(g, w, h, n, colors, size = [1, 3]) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    const s = size[0] + Math.random() * (size[1] - size[0]);
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}

/* ── 205 series livery (Utsunomiya Line, 600 番台) ──
   Side canvas maps car x ∈ [-10, 10] m  →  0..2048 px
                    car y ∈ [1.00, 3.45] m →  256..0 px          */
const C205 = {
  len: 20, half: 10, width: 2.8, sideY0: 1.0, sideY1: 3.45, roofTop: 3.72, floor: 1.15,
  doors: [-7.25, -2.42, 2.42, 7.25], doorW: 1.3,
  orange: '#f08a24', green: '#1f9a48', stain: '#c9ccd0',
};
const SX = x => (x + 10) * 102.4;
const SY = y => (3.45 - y) * (256 / 2.45);
function sideTex205(kind, mirror = false) {
  // kind: 'cabF' (cab at +x end), 'cabR' (cab at -x end) or 'mid'
  // mirror: the left side - same layout flipped end to end, but the writing still reads normally
  return canvasTex(2048, 256, (g, W, H) => {
    if (mirror) { g.translate(W, 0); g.scale(-1, 1); }
    const txt = (t, x, y) => { if (!mirror) { g.fillText(t, x, y); return; } g.save(); g.translate(x, 0); g.scale(-1, 1); g.fillText(t, 0, y); g.restore(); };
    // brushed stainless base
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#d7dade'); gr.addColorStop(.5, '#c4c8cd'); gr.addColorStop(1, '#b3b8be');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalAlpha = .05; for (let x = 0; x < W; x += 2) { g.fillStyle = Math.random() < .5 ? '#fff' : '#000'; g.fillRect(x, 0, 1, H); } g.globalAlpha = 1;
    // horizontal beads on the lower body
    for (let y = 1.08; y < 1.78; y += .11) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, SY(y), W, 2); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, SY(y) + 2, W, 2); }
    // panel seams
    g.fillStyle = 'rgba(0,0,0,.12)';
    for (let x = -10; x <= 10; x += 2.5) g.fillRect(SX(x), 0, 1.5, H);
    // stripes (stickers stop at the doors)
    const stripe = (y0, y1, col) => { g.fillStyle = col; g.fillRect(0, SY(y1), W, SY(y0) - SY(y1)); };
    stripe(3.25, 3.34, C205.green);
    stripe(1.80, 1.93, C205.green);
    stripe(1.93, 2.03, C205.orange);
    const cab = kind === 'cabF' ? 1 : kind === 'cabR' ? -1 : 0;
    // windows (alpha holes) — big 2-pane windows between doors, small ones at the ends
    const hole = (x0, x1, y0, y1, r = 10) => {
      g.save(); rrect(g, SX(x0), SY(y1), SX(x1) - SX(x0), SY(y0) - SY(y1), r);
      g.lineWidth = 7; g.strokeStyle = '#3a3d42'; g.stroke(); g.globalCompositeOperation = 'destination-out'; g.fill(); g.restore();
    };
    const win2 = (cx, w) => { hole(cx - w / 2, cx - .04, 2.12, 3.06); hole(cx + .04, cx + w / 2, 2.12, 3.06); };
    win2(-4.84, 2.3); win2(0, 2.3); win2(4.84, 2.3);
    if (cab !== -1) win2(-9.0, 1.2); // rear end (non cab) windows
    if (cab !== 1) win2(9.0, 1.2);
    // door openings (alpha holes) - the real sliding door leaves sit just inside the wall
    for (const dx of C205.doors) {
      const x0 = SX(dx - C205.doorW / 2), x1 = SX(dx + C205.doorW / 2), yT = SY(3.07), yB = SY(1.12);
      g.fillStyle = '#5b5f64'; g.fillRect(x0 - 5, yT - 5, x1 - x0 + 10, yB - yT + 5);
      g.save(); g.globalCompositeOperation = 'destination-out'; g.fillRect(x0, yT, x1 - x0, H); g.restore();
    }
    // cab end: crew door + cab side window
    if (cab) {
      const cx = cab * 9.15;
      g.fillStyle = '#bfc3c8'; g.fillRect(SX(cx - .33), SY(3.1), SX(cx + .33) - SX(cx - .33), SY(1.0) - SY(3.1));
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(SX(cx - .33), SY(3.1), 3, SY(1.0) - SY(3.1)); g.fillRect(SX(cx + .33) - 3, SY(3.1), 3, SY(1.0) - SY(3.1));
      hole(cx - .25, cx + .25, 2.3, 3.0, 10);
      // JR logo (on the cab car only)
      g.fillStyle = '#2f9a4a'; g.font = 'bold italic 46px Arial'; g.textAlign = 'center';
      txt('JR', SX(cab * 6.0), SY(2.42));
    }
    // destination sign (green, white text) near one end
    const dsx = cab === 1 ? -8.9 : 8.0;
    g.fillStyle = '#1b1d1f'; g.fillRect(SX(dsx - .55), SY(3.22), SX(.55) - SX(-.55), SY(3.08) - SY(3.22) + 18);
    g.fillStyle = '#1f7a3f'; rrect(g, SX(dsx - .5), SY(3.21), SX(.5) - SX(-.5), 26, 4); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 20px "Hiragino Sans",sans-serif'; g.textAlign = 'center'; txt('宇都宮', SX(dsx), SY(3.21) + 21);
    // car number plate next to the first door
    g.fillStyle = '#fff'; g.fillRect(SX(-6.3), SY(3.04), 22, 22);
    g.fillStyle = '#111'; g.font = 'bold 18px Arial'; txt(kind === 'cabF' ? '1' : kind === 'mid' ? '2' : '3', SX(-6.3) + 11, SY(3.04) + 18);
    // small door-lamp (orange)
    g.fillStyle = '#ffae2e'; for (const dx of C205.doors) g.fillRect(SX(dx + .78), SY(3.2), 6, 8);
  });
}
function roofTex205() {
  return canvasTex(512, 128, (g, W, H) => {
    g.fillStyle = '#8c9096'; g.fillRect(0, 0, W, H);
    speckle(g, W, H, 2500, ['#7d8186', '#9a9ea3', '#868a8f'], [1, 2]);
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let x = 0; x < W; x += 32) g.fillRect(x, 0, 2, H);
  }, { repeat: [1, 1] });
}
/* Front (cab face) canvas maps x ∈ [-1.4, 1.4] → 0..512, y ∈ [1.0, 3.72] → 512..0 */
const FX = x => (x + 1.4) / 2.8 * 512;
const FY = y => (3.72 - y) / 2.72 * 512;
function frontTex205() {
  return canvasTex(512, 512, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, '#b8bcc1'); gr.addColorStop(.5, '#d4d7db'); gr.addColorStop(1, '#b8bcc1');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // black upper mask
    g.fillStyle = '#16181b'; rrect(g, FX(-1.36), FY(3.62), FX(1.36) - FX(-1.36), FY(2.08) - FY(3.62), 12); g.fill();
    // stainless frame around the mask
    g.lineWidth = 6; g.strokeStyle = '#9da2a8'; g.stroke();
    // LED destination + run number (inside the glass, top)
    g.fillStyle = '#050505'; g.fillRect(FX(.12), FY(3.52), FX(1.2) - FX(.12), 30);
    g.fillStyle = '#ff7a2a'; g.font = 'bold 22px "Hiragino Sans",sans-serif'; g.textAlign = 'center';
    g.fillText('宇都宮線', FX(.66), FY(3.52) + 23);
    g.fillStyle = '#050505'; g.fillRect(FX(-1.2), FY(3.52), FX(-.62) - FX(-1.2), 30);
    g.fillStyle = '#ff5a20'; g.font = 'bold 20px Menlo,monospace'; g.fillText('205M', FX(-.91), FY(3.52) + 22);
    // windows (alpha holes): driver (left) + right
    const hole = (x0, x1, y0, y1) => {
      g.save(); rrect(g, FX(x0), FY(y1), FX(x1) - FX(x0), FY(y0) - FY(y1), 8);
      g.globalCompositeOperation = 'destination-out'; g.fill(); g.restore();
    };
    hole(-1.24, -.12, 2.36, 3.3); hole(.12, 1.24, 2.36, 3.3);
    // JR logo
    g.fillStyle = '#fff'; g.font = 'bold italic 44px Arial'; g.textAlign = 'center'; g.fillText('JR', FX(.95), FY(2.14));
    // livery band: orange over green
    g.fillStyle = C205.orange; g.fillRect(0, FY(2.03), W, FY(1.95) - FY(2.03));
    g.fillStyle = C205.green; g.fillRect(0, FY(1.95), W, FY(1.66) - FY(1.95));
    // lamp recesses
    g.fillStyle = '#2a2c2f';
    for (const s of [-1, 1]) {
      g.beginPath(); g.arc(FX(s * 1.0), FY(1.81), 20, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(FX(s * 1.0), FY(1.42), 13, 0, Math.PI * 2); g.fill();
    }
    // lower body beads
    for (let y = 1.08; y < 1.6; y += .1) { g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(0, FY(y), W, 2); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, FY(y) + 2, W, 2); }
    // cut the top corners to the roof arch
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0);
    for (let i = 0; i <= 24; i++) { const z = 1.4 - 2.8 * i / 24; g.lineTo(FX(z), FY(ROOF_Y(z))); }
    g.closePath(); g.fill(); g.globalCompositeOperation = 'source-over';
  });
}
function endTex205() { // non-cab car end (gangway side)
  return canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#bcc0c5'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2b2d30'; g.fillRect(W * .32, H * .12, W * .36, H * .88);
  });
}

/* ── ground ── */
function grassTex() {
  return canvasTex(512, 512, (g, W, H) => {
    g.fillStyle = '#6f9a4a'; g.fillRect(0, 0, W, H);
    speckle(g, W, H, 9000, ['#5f8a3e', '#7ba653', '#66923f', '#86b05c', '#58803a'], [1, 4]);
    g.globalAlpha = .25; for (let i = 0; i < 40; i++) { g.fillStyle = Math.random() < .5 ? '#4f7a33' : '#8dbb63'; g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 20 + Math.random() * 50, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  }, { repeat: [400, 400] });
}
function ballastTex() {
  return canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#7b736b'; g.fillRect(0, 0, W, H);
    speckle(g, W, H, 7000, ['#5f5953', '#8f877e', '#6d665f', '#857c72', '#4f4a45', '#9c9389', '#6b5a4a'], [2, 5]);
  }, { repeat: [1, 1] });
}
function concreteTex() {
  return canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#b7b4ae'; g.fillRect(0, 0, W, H);
    speckle(g, W, H, 3000, ['#a9a6a0', '#c4c1bb', '#9f9c96'], [1, 3]);
  });
}
function platformTopTex() {
  // u = across the platform (0 = track edge), v = along the platform
  return canvasTex(256, 64, (g, W, H) => {
    g.fillStyle = '#c9c6c0'; g.fillRect(0, 0, W, H);
    speckle(g, W, H, 900, ['#bdbab4', '#d3d0ca'], [1, 3]);
    g.fillStyle = '#efede7'; g.fillRect(0, 0, 10, H);
    g.fillStyle = '#f2c522'; g.fillRect(26, 0, 18, H);
    g.fillStyle = '#d8ad10'; for (let y = 2; y < H; y += 8) g.fillRect(28, y, 14, 3);
  });
}
function facadeTex() {
  // one storey (3.5 m) x one bay (4 m) of an office/apartment block, tiled
  return canvasTex(128, 128, (g, W, H) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#7f95a8'; g.fillRect(14, 30, 100, 62);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(14, 30, 100, 10);
    g.fillStyle = '#d9d9d9'; g.fillRect(0, 100, W, 10);
    g.fillStyle = '#9aa'; g.fillRect(62, 30, 4, 62);
  }, { repeat: [1, 1] });
}

function latticeTex() {
  // one bay of X-braced lattice steel (alpha-tested)
  return canvasTex(64, 64, (g, W, H) => {
    g.clearRect(0, 0, W, H); g.strokeStyle = '#fff'; g.lineWidth = 6;
    g.strokeRect(3, 0, W - 6, H); g.lineWidth = 4;
    g.beginPath(); g.moveTo(3, 0); g.lineTo(W - 3, H); g.moveTo(W - 3, 0); g.lineTo(3, H); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(0, 2); g.lineTo(W, 2); g.stroke();
  }, { repeat: [1, 1] });
}
function waterTex() {
  return canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#4a86b0'; g.fillRect(0, 0, W, H);
    g.globalAlpha = .25;
    for (let i = 0; i < 160; i++) { g.fillStyle = Math.random() < .5 ? '#9cc8e6' : '#2f6890'; g.fillRect(Math.random() * W, Math.random() * H, 8 + Math.random() * 30, 2); }
    g.globalAlpha = 1;
  }, { repeat: [1, 1] });
}
function mountainTex() {
  // distant mountain silhouettes around the horizon (alpha)
  return canvasTex(2048, 256, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const layer = (col, base, amp, seed) => {
      // periodic (seamless) ridge line made of sines with integer frequencies
      const r = mulberry(seed), waves = [];
      for (let i = 0; i < 7; i++) waves.push([1 + Math.floor(r() * 14), r() * 6.28, (1 - i / 9) * r()]);
      const norm = waves.reduce((a, w) => a + w[2], 0);
      g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) {
        let y = 0; for (const [f, ph, a] of waves) y += Math.sin(x / W * Math.PI * 2 * f + ph) * a;
        g.lineTo(x, base - amp * y / norm);
      }
      g.lineTo(W, H); g.closePath(); g.fill();
    };
    layer('#a9bdd0', 150, 70, 11); layer('#93abc0', 185, 45, 12); layer('#86a08e', 220, 18, 13);
  });
}
function roadTex() {
  return canvasTex(64, 256, (g, W, H) => {
    g.fillStyle = '#55585b'; g.fillRect(0, 0, W, H);
    speckle(g, W, H, 900, ['#4c4f52', '#5e6164'], [1, 2]);
    g.fillStyle = '#f2f2f2'; g.fillRect(1, 0, 3, H); g.fillRect(W - 4, 0, 3, H);
    g.fillStyle = '#f2f2f2'; for (let y = 0; y < H; y += 64) g.fillRect(W / 2 - 1.5, y, 3, 32);
  }, { repeat: [1, 1] });
}
function stripeTex(c1, c2, n = 8) {
  return canvasTex(256, 32, (g, W, H) => {
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(i * W / n, 0, W / n, H); }
  });
}
function textBoard(lines, opts = {}) {
  const w = opts.w || 128, h = opts.h || 128;
  return canvasTex(w, h, (g, W, H) => {
    g.fillStyle = opts.bg || '#fff'; g.fillRect(0, 0, W, H);
    if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = opts.bw || 8; g.strokeRect(4, 4, W - 8, H - 8); }
    g.fillStyle = opts.fg || '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(([t, size, y]) => { g.font = `900 ${size}px "Hiragino Sans","Helvetica Neue",Arial,sans-serif`; g.fillText(t, W / 2, y * H); });
  });
}

function doorLeafTex() {
  // one door leaf 0.65 m x 1.95 m, stainless with a rounded window (alpha)
  return canvasTex(128, 384, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#b9bdc2'); gr.addColorStop(.5, '#d6d9dd'); gr.addColorStop(1, '#b4b8bd');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalAlpha = .06; for (let x = 0; x < W; x += 2) { g.fillStyle = Math.random() < .5 ? '#fff' : '#000'; g.fillRect(x, 0, 1, H); } g.globalAlpha = 1;
    g.fillStyle = '#2a2c2e'; g.fillRect(0, 0, 4, H); g.fillRect(W - 4, 0, 4, H);
    const wy0 = H * (1 - 1.86 / 1.95), wy1 = H * (1 - 1.16 / 1.95);
    rrect(g, W * .17, wy0, W * .66, wy1 - wy0, 16); g.lineWidth = 6; g.strokeStyle = '#3a3d42'; g.stroke();
    g.save(); g.globalCompositeOperation = 'destination-out'; g.fill(); g.restore();
    g.fillStyle = '#9da1a6'; g.fillRect(W * .44, H * .62, W * .12, 26);  // handle recess
  });
}
function vendingTex(col) {
  return canvasTex(128, 256, (g, W, H) => {
    g.fillStyle = col; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e9f4ff'; g.fillRect(8, 14, W - 16, 110);
    const cols = ['#e33', '#fc3', '#3a6', '#36c', '#f80', '#999'];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { g.fillStyle = cols[(r * 2 + c) % 6]; g.fillRect(14 + c * 17, 22 + r * 34, 11, 26); }
    g.fillStyle = '#222'; g.fillRect(20, 150, 88, 26); g.fillStyle = '#111'; g.fillRect(24, 200, 80, 40);
  });
}
function clockTex() {
  return canvasTex(128, 128, (g, W, H) => {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.lineWidth = 5; g.strokeStyle = '#222'; g.stroke();
    g.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(64 + Math.sin(a) * 50 - 2, 64 - Math.cos(a) * 50 - 2, 4, 4); }
    const d = new Date(), hA = ((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2, mA = d.getMinutes() / 60 * Math.PI * 2;
    g.lineCap = 'round'; g.lineWidth = 6; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.sin(hA) * 30, 64 - Math.cos(hA) * 30); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.sin(mA) * 46, 64 - Math.cos(mA) * 46); g.stroke();
  });
}
function brickTex() {
  const t = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#9a4a36'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 8) for (let x = (y / 8) % 2 ? -8 : 0; x < W; x += 16) { g.fillStyle = ['#a8523c', '#93432f', '#b05b43'][(x * 7 + y) % 3]; g.fillRect(x + 1, y + 1, 14, 6); }
    // windows
    g.fillStyle = '#e8e0cc'; for (let x = 12; x < W; x += 32) for (let y = 20; y < H; y += 64) { g.fillRect(x - 2, y - 2, 16, 34); g.fillStyle = '#3a4650'; g.fillRect(x, y, 12, 30); g.fillStyle = '#e8e0cc'; }
  }, { repeat: [1, 1] });
  t.repeat.set(12, 2); return t;
}

/* ── interior textures ── */
const IX = x => (x + 10) * 102.4, IY = y => (3.25 - y) / 2.09 * 256;
function innerSideTex() {
  return canvasTex(2048, 256, (g, W, H) => {
    g.fillStyle = '#efece3'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e1dccf'; g.fillRect(0, IY(2.05), W, H);
    g.fillStyle = 'rgba(0,0,0,.06)'; for (let x = -10; x <= 10; x += 1.2) g.fillRect(IX(x), 0, 2, H);
    const hole = (x0, x1, y0, y1, r = 10) => {
      g.save(); rrect(g, IX(x0), IY(y1), IX(x1) - IX(x0), IY(y0) - IY(y1), r);
      g.lineWidth = 10; g.strokeStyle = '#a7abb0'; g.stroke(); g.globalCompositeOperation = 'destination-out'; g.fill(); g.restore();
    };
    for (const [cx, w] of [[-4.84, 2.3], [0, 2.3], [4.84, 2.3], [-9, 1.2], [9, 1.2]]) { hole(cx - w / 2, cx - .04, 2.12, 3.06); hole(cx + .04, cx + w / 2, 2.12, 3.06); }
    for (const dx of C205.doors) {
      g.fillStyle = '#b9bdc2'; g.fillRect(IX(dx - .75), IY(3.12), IX(dx + .75) - IX(dx - .75), H);
      g.save(); g.globalCompositeOperation = 'destination-out'; g.fillRect(IX(dx - .65), IY(3.07), IX(dx + .65) - IX(dx - .65), H); g.restore();
      // posters beside the door
      for (const [px, col] of [[dx - 1.05, ['#3a78d8', '#e8443a', '#f2c230', '#3aa860'][Math.abs(Math.round(dx)) % 4]], [dx + 1.05, '#fff']]) {
        g.fillStyle = '#c9ccd0'; g.fillRect(IX(px - .27), IY(2.95), IX(.27) - IX(-.27), IY(2.3) - IY(2.95));
        g.fillStyle = col; g.fillRect(IX(px - .24), IY(2.92), IX(.24) - IX(-.24), IY(2.33) - IY(2.92));
        g.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 4; i++) g.fillRect(IX(px - .18), IY(2.82 - i * .1), IX(.36) - IX(0), 3);
      }
    }
  });
}
function adTex(kind) {
  return canvasTex(256, 150, (g, W, H) => {
    const bg = { train: '#dff3ff', fruit: '#fff4d6', zoo: '#e9f8e2', sea: '#d6ecff' }[kind];
    g.fillStyle = bg; g.fillRect(0, 0, W, H); g.lineWidth = 6; g.strokeStyle = '#fff'; g.strokeRect(3, 3, W - 6, H - 6);
    g.textAlign = 'center'; g.fillStyle = '#123'; g.font = '900 26px "Helvetica Neue",Arial';
    if (kind === 'train') {
      g.fillStyle = '#2aa36a'; g.beginPath(); g.moveTo(30, 95); g.quadraticCurveTo(60, 50, 120, 52); g.lineTo(225, 52); g.lineTo(225, 95); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.fillRect(60, 80, 165, 15); g.fillStyle = '#e86aa0'; g.fillRect(60, 76, 165, 4);
      g.fillStyle = '#123'; g.fillText('TRAIN MUSEUM', W / 2, 130); g.font = 'bold 16px Arial'; g.fillText('でんしゃ はくぶつかん', W / 2, 28);
    } else if (kind === 'fruit') {
      for (const [x, c] of [[70, '#e33'], [128, '#f90'], [186, '#9c3']]) { g.fillStyle = c; g.beginPath(); g.arc(x, 72, 26, 0, 7); g.fill(); g.fillStyle = '#4a2'; g.fillRect(x - 2, 40, 4, 10); }
      g.fillStyle = '#123'; g.fillText('FRUIT JUICE', W / 2, 130); g.font = 'bold 16px Arial'; g.fillText('フルーツ ジュース', W / 2, 26);
    } else if (kind === 'zoo') {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 74, 34, 0, 7); g.fill(); g.fillStyle = '#111';
      for (const [x, y, r] of [[102, 46, 12], [154, 46, 12], [115, 70, 8], [141, 70, 8], [128, 86, 5]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      g.fillText('ZOO', W / 2, 136); g.font = 'bold 16px Arial'; g.fillText('どうぶつえん', W / 2, 24);
    } else {
      g.fillStyle = '#f80'; g.beginPath(); g.ellipse(110, 74, 40, 20, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(148, 74); g.lineTo(175, 56); g.lineTo(175, 92); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(90, 70, 5, 0, 7); g.fill();
      g.fillStyle = '#123'; g.fillText('AQUARIUM', W / 2, 132); g.font = 'bold 16px Arial'; g.fillText('すいぞくかん', W / 2, 26);
    }
  });
}
function cabFrontTex() {
  // inner face of the cab front: x ∈ [-1.38,1.38] → 0..512, y ∈ [1.0,3.6] → 512..0
  const X = x => (x + 1.38) / 2.76 * 512, Y = y => (3.6 - y) / 2.6 * 512;
  return canvasTex(512, 512, (g, W, H) => {
    g.fillStyle = '#5f8a7e'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#4f776c'; g.fillRect(0, Y(2.2), W, H);
    for (const [a, b] of [[-1.24, -.12], [.12, 1.24]]) {
      g.save(); rrect(g, X(a), Y(3.3), X(b) - X(a), Y(2.36) - Y(3.3), 8); g.lineWidth = 10; g.strokeStyle = '#2b3a35'; g.stroke();
      g.globalCompositeOperation = 'destination-out'; g.fill(); g.restore();
    }
    g.fillStyle = '#111'; g.fillRect(X(-1.2), Y(3.52), X(1.2) - X(-1.2), 16);
  });
}
function pressureTex() {
  return canvasTex(128, 128, (g, W, H) => {
    g.fillStyle = '#20262a'; g.fillRect(0, 0, W, H); g.fillStyle = '#f7f7f2'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 2; for (let i = 0; i <= 10; i++) { const a = Math.PI * .75 + i / 10 * Math.PI * 1.5; g.beginPath(); g.moveTo(64 + Math.cos(a) * 54, 64 + Math.sin(a) * 54); g.lineTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44); g.stroke(); }
    g.lineWidth = 4; g.strokeStyle = '#e8401c'; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(-.4) * 44, 64 + Math.sin(-.4) * 44); g.stroke();
    g.strokeStyle = '#111'; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(2.6) * 40, 64 + Math.sin(2.6) * 40); g.stroke();
    g.fillStyle = '#111'; g.font = 'bold 12px Arial'; g.textAlign = 'center'; g.fillText('kPa', 64, 96);
  });
}
function ledTex() {
  return canvasTex(64, 128, (g, W, H) => {
    g.fillStyle = '#111'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 10; i++) { g.strokeStyle = i < 3 ? '#ff3020' : '#e0c030'; g.lineWidth = 2; g.strokeRect(8, 8 + i * 11, 20, 8); if (i < 6) { g.fillStyle = i < 3 ? '#ff3020' : '#e0c030'; g.fillRect(9, 9 + i * 11, 18, 6); } }
    g.strokeStyle = '#e0c030'; for (let i = 0; i < 4; i++) g.strokeRect(36, 50 + i * 16, 20, 12);
  });
}
