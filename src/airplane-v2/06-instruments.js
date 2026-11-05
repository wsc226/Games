/* ═══ GLASS COCKPIT DISPLAYS (PFD, ND, EICAS, MCP) ═══
   Drawn on 2D canvases. Used as CanvasTextures in the 3D flight deck and
   blitted large into the Sky Challenge panel. */
const INST = (() => {
  const c = { pfd: makeCanvas(512, 512), nd: makeCanvas(512, 512), eicas: makeCanvas(512, 300), mcp: makeCanvas(1024, 64) };
  const tex = {}; Object.keys(c).forEach(k => { tex[k] = new THREE.CanvasTexture(c[k]); tex[k].colorSpace = THREE.SRGBColorSpace; });
  return { c, tex };
})();
const COL = { sky: '#1b84cf', gnd: '#8a5a2c', white: '#ffffff', mag: '#ff4cf0', green: '#3cf06e', amber: '#ffb000', cyan: '#3fd8ff', gray: '#4b4f55', red: '#ff3030' };
function txt(g, s, x, y, size, color = '#fff', align = 'center', weight = 'bold') {
  g.font = `${weight} ${size}px 'Helvetica Neue', Arial, sans-serif`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y);
}
function rrect(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }

/* d = { pitch, roll (deg, right wing down +), ias, mach, alt (ft), vs (fpm), hdg, selAlt, selSpd, selHdg, fd:{pitch,roll}|null, fma:[a,b,c], ra:'CLIMB'|'DESCEND'|null } */
function drawPFD(g, d) {
  const S = 512; g.save(); g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  const cx = 236, cy = 250, ppd = 7.2;
  // ── ADI ──
  g.save(); rrect(g, 128, 118, 216, 264, 18); g.clip();
  g.translate(cx, cy); g.rotate(-d.roll * DEG); g.translate(0, d.pitch * ppd);
  g.fillStyle = COL.sky; g.fillRect(-600, -1200, 1200, 1200); g.fillStyle = COL.gnd; g.fillRect(-600, 0, 1200, 1200);
  g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-600, 0); g.lineTo(600, 0); g.stroke();
  g.lineWidth = 2;
  for (let p = -40; p <= 40; p += 2.5) { if (!p) continue; const y = -p * ppd; if (Math.abs(p - d.pitch) > 14) continue;
    const big = p % 10 === 0, mid = p % 5 === 0, w = big ? 44 : mid ? 24 : 11;
    g.beginPath(); g.moveTo(-w, y); g.lineTo(w, y); g.stroke();
    if (big) { txt(g, String(Math.abs(p)), -w - 16, y, 15); txt(g, String(Math.abs(p)), w + 16, y, 15); } }
  g.restore();
  // bank scale
  g.save(); g.translate(cx, cy); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 2; const R = 112;
  [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60].forEach(a => { const r = a * DEG, l = Math.abs(a) % 30 === 0 ? 14 : 8;
    g.beginPath(); g.moveTo(Math.sin(r) * R, -Math.cos(r) * R); g.lineTo(Math.sin(r) * (R + l), -Math.cos(r) * (R + l)); g.stroke(); });
  g.beginPath(); g.moveTo(0, -R - 1); g.lineTo(-7, -R - 13); g.lineTo(7, -R - 13); g.closePath(); g.fill();
  g.rotate(-d.roll * DEG); g.beginPath(); g.moveTo(0, -R + 2); g.lineTo(-8, -R + 15); g.lineTo(8, -R + 15); g.closePath();
  g.fillStyle = Math.abs(d.roll) > 35 ? COL.amber : '#fff'; g.fill(); g.restore();
  // flight director
  if (d.fd) { g.save(); g.strokeStyle = COL.mag; g.lineWidth = 4;
    const fx = clamp(d.fd.roll, -1, 1) * 70, fy = clamp(-d.fd.pitch, -1, 1) * 70;
    g.beginPath(); g.moveTo(cx + fx, cy - 70); g.lineTo(cx + fx, cy + 70); g.moveTo(cx - 70, cy + fy); g.lineTo(cx + 70, cy + fy); g.stroke(); g.restore(); }
  // aircraft symbol
  g.save(); g.fillStyle = '#000'; g.strokeStyle = '#fff'; g.lineWidth = 2.5;
  [[-1], [1]].forEach(([s]) => { g.beginPath(); g.moveTo(cx + s * 26, cy - 4); g.lineTo(cx + s * 78, cy - 4); g.lineTo(cx + s * 78, cy + 4); g.lineTo(cx + s * 34, cy + 4); g.lineTo(cx + s * 34, cy + 18); g.lineTo(cx + s * 26, cy + 18); g.closePath(); g.fill(); g.stroke(); });
  g.fillRect(cx - 5, cy - 5, 10, 10); g.strokeRect(cx - 5, cy - 5, 10, 10); g.restore();
  // TCAS RA red zone hint
  if (d.ra) { txt(g, d.ra === 'CLIMB' ? '▲ CLIMB' : '▼ DESCEND', cx, d.ra === 'CLIMB' ? 140 : 360, 22, COL.red); }

  // ── speed tape ──
  g.save(); g.fillStyle = COL.gray; g.fillRect(28, 118, 76, 264); g.beginPath(); g.rect(28, 118, 76, 264); g.clip();
  const kpp = 3.4; g.strokeStyle = '#fff'; g.lineWidth = 2;
  for (let v = Math.floor((d.ias - 45) / 10) * 10; v <= d.ias + 45; v += 10) { if (v < 0) continue; const y = cy - (v - d.ias) * kpp;
    g.beginPath(); g.moveTo(92, y); g.lineTo(104, y); g.stroke(); if (v % 20 === 0) txt(g, String(v), 82, y, 17, '#fff', 'right'); }
  if (d.selSpd) { const y = clamp(cy - (d.selSpd - d.ias) * kpp, 122, 378); g.strokeStyle = COL.mag; g.lineWidth = 3; g.beginPath(); g.moveTo(104, y - 9); g.lineTo(96, y - 9); g.lineTo(96, y + 9); g.lineTo(104, y + 9); g.stroke(); }
  g.restore();
  g.fillStyle = '#000'; g.strokeStyle = '#fff'; g.lineWidth = 2; rrect(g, 24, cy - 18, 78, 36, 4); g.fill(); g.stroke();
  txt(g, String(Math.round(d.ias)), 94, cy + 1, 26, '#fff', 'right');
  txt(g, d.selSpd ? String(d.selSpd) : '', 66, 100, 20, COL.mag);
  txt(g, 'M ' + (d.mach || 0).toFixed(3).slice(1), 66, 400, 18, '#fff');
  txt(g, 'SPEED', 66, 422, 11, '#8a9099');

  // ── altitude tape ──
  const ax = 366, aw = 84; g.save(); g.fillStyle = COL.gray; g.fillRect(ax, 118, aw, 264); g.beginPath(); g.rect(ax, 118, aw, 264); g.clip();
  const fpp = .33; g.strokeStyle = '#fff'; g.lineWidth = 2;
  for (let a = Math.floor((d.alt - 450) / 100) * 100; a <= d.alt + 450; a += 100) { const y = cy - (a - d.alt) * fpp;
    g.beginPath(); g.moveTo(ax, y); g.lineTo(ax + 12, y); g.stroke();
    if (a % 200 === 0) txt(g, String(a), ax + 78, y, 15, '#fff', 'right'); }
  if (d.selAlt != null) { const y = clamp(cy - (d.selAlt - d.alt) * fpp, 122, 378); g.strokeStyle = COL.mag; g.lineWidth = 3;
    g.beginPath(); g.moveTo(ax, y - 12); g.lineTo(ax + 8, y - 12); g.lineTo(ax + 8, y + 12); g.lineTo(ax, y + 12); g.stroke(); }
  g.restore();
  g.fillStyle = '#000'; g.strokeStyle = '#fff'; g.lineWidth = 2; rrect(g, ax + 4, cy - 20, aw + 6, 40, 4); g.fill(); g.stroke();
  const altR = Math.round(d.alt / 20) * 20, th = Math.floor(altR / 1000), hu = String(altR % 1000).padStart(3, '0');
  txt(g, String(th), ax + 46, cy + 1, 27, '#fff', 'right'); txt(g, hu, ax + 48, cy + 3, 19, '#fff', 'left');
  if (d.selAlt != null) { const near = Math.abs(d.selAlt - d.alt) < 900 && Math.abs(d.selAlt - d.alt) > 150;
    if (near) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(ax + 2, 86, aw, 28); }
    txt(g, String(d.selAlt), ax + aw / 2 + 2, 100, 20, COL.mag); }
  txt(g, 'ALTITUDE', ax + aw / 2, 400, 11, '#8a9099');
  // ── VSI ──
  const vx = 462, vMap = v => { const a = Math.abs(v), s = Math.sign(v); const y = a <= 1000 ? a / 1000 * 70 : a <= 2000 ? 70 + (a - 1000) / 1000 * 30 : 100 + Math.min(a - 2000, 4000) / 4000 * 26; return -s * y; };
  g.fillStyle = '#3a3d42'; rrect(g, vx, cy - 135, 34, 270, 8); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 2;
  [[1000, '1'], [2000, '2'], [6000, '6']].forEach(([v, l]) => [1, -1].forEach(s => { const y = cy + vMap(v * s); g.beginPath(); g.moveTo(vx, y); g.lineTo(vx + 8, y); g.stroke(); txt(g, l, vx + 18, y, 13); }));
  g.beginPath(); g.moveTo(vx, cy); g.lineTo(vx + 12, cy); g.stroke();
  g.strokeStyle = COL.white; g.lineWidth = 3; g.beginPath(); g.moveTo(vx + 40, cy); g.lineTo(vx + 4, cy + vMap(d.vs)); g.stroke();
  if (Math.abs(d.vs) > 400) txt(g, String(Math.round(d.vs / 50) * 50), vx + 16, d.vs > 0 ? cy - 150 : cy + 150, 14, '#fff');
  // ── heading ──
  g.save(); g.beginPath(); g.rect(110, 410, 260, 102); g.clip();
  const hx = cx, hy = 560, hr = 132; g.fillStyle = COL.gray; g.beginPath(); g.arc(hx, hy, hr, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 2;
  for (let a = 0; a < 360; a += 5) { const r = (a - d.hdg) * DEG; if (Math.abs(angDiff(d.hdg, a)) > 60) continue; const l = a % 10 === 0 ? 12 : 6;
    g.beginPath(); g.moveTo(hx + Math.sin(r) * hr, hy - Math.cos(r) * hr); g.lineTo(hx + Math.sin(r) * (hr - l), hy - Math.cos(r) * (hr - l)); g.stroke();
    if (a % 30 === 0) { g.save(); g.translate(hx + Math.sin(r) * (hr - 26), hy - Math.cos(r) * (hr - 26)); g.rotate(r); txt(g, String(a / 10), 0, 0, 16); g.restore(); } }
  if (d.selHdg != null) { const r = angDiff(d.hdg, d.selHdg) * DEG; g.save(); g.translate(hx, hy); g.rotate(r); g.strokeStyle = COL.mag; g.lineWidth = 3; g.strokeRect(-8, -hr - 2, 16, 10); g.restore(); }
  g.restore();
  g.fillStyle = '#000'; g.strokeStyle = '#fff'; g.lineWidth = 2; rrect(g, hx - 30, 404, 60, 26, 3); g.fill(); g.stroke();
  txt(g, String(Math.round(wrapDeg(d.hdg)) % 360).padStart(3, '0'), hx, 418, 19);
  // FMA
  (d.fma || ['SPD', 'HDG SEL', 'ALT']).forEach((s, i) => { g.strokeStyle = '#666'; g.lineWidth = 1; g.strokeRect(118 + i * 80, 30, 78, 28); txt(g, s, 157 + i * 80, 44, 15, COL.green); });
  txt(g, 'A/P', 412, 44, 15, COL.green);
  g.restore();
}

/* d = { hdg, range(nm), storms:[{brg,dist,r,lvl}], traffic:[{brg,dist,rel,trend,level}], course, selHdg, gs, tas, wp } */
function drawND(g, d) {
  const S = 512, ox = 256, oy = 440, R = 360, px = R / d.range;
  g.save(); g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  const pt = (brg, dist) => { const r = angDiff(d.hdg, brg) * DEG; return [ox + Math.sin(r) * dist * px, oy - Math.cos(r) * dist * px]; };
  // weather radar
  g.save(); g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, R, -Math.PI / 2 - 1.05, -Math.PI / 2 + 1.05); g.closePath(); g.clip();
  (d.storms || []).forEach(s => { const [x, y] = pt(s.brg, s.dist); const r = s.r * px * 1.25;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, s.lvl > 2 ? '#ff1ad9' : '#ff2222'); gr.addColorStop(.32, '#ff2222'); gr.addColorStop(.55, '#ffd400'); gr.addColorStop(.8, '#1fbf3a'); gr.addColorStop(1, 'rgba(31,191,58,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * .85, (s.rot || 0), 0, Math.PI * 2); g.fill(); });
  g.restore();
  // compass arc
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(ox, oy, R, -Math.PI / 2 - 1.05, -Math.PI / 2 + 1.05); g.stroke();
  for (let a = 0; a < 360; a += 5) { const dd = angDiff(d.hdg, a); if (Math.abs(dd) > 60) continue; const r = dd * DEG, l = a % 10 === 0 ? 14 : 7;
    g.beginPath(); g.moveTo(ox + Math.sin(r) * R, oy - Math.cos(r) * R); g.lineTo(ox + Math.sin(r) * (R - l), oy - Math.cos(r) * (R - l)); g.stroke();
    if (a % 30 === 0) { g.save(); g.translate(ox + Math.sin(r) * (R - 30), oy - Math.cos(r) * (R - 30)); g.rotate(r); txt(g, String(a / 10).padStart(2, '0'), 0, 0, 17); g.restore(); } }
  // half-range ring
  g.setLineDash([6, 8]); g.beginPath(); g.arc(ox, oy, R / 2, -Math.PI / 2 - 1.05, -Math.PI / 2 + 1.05); g.stroke(); g.setLineDash([]);
  txt(g, String(d.range / 2), ox - R / 2 * Math.sin(1.05) - 14, oy - R / 2 * Math.cos(1.05), 14, '#fff');
  // course line + waypoint
  if (d.course != null) { const [x, y] = pt(d.course, d.range * .8); g.strokeStyle = COL.mag; g.lineWidth = 3; g.beginPath(); g.moveTo(ox, oy); g.lineTo(x, y); g.stroke();
    g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.strokeRect(-7, -7, 14, 14); g.restore(); txt(g, d.wp || 'ASHER', x + 34, y, 14, COL.mag); }
  // selected heading
  if (d.selHdg != null) { const dd = angDiff(d.hdg, d.selHdg); if (Math.abs(dd) < 60) { const r = dd * DEG; g.strokeStyle = COL.mag; g.setLineDash([8, 6]); g.lineWidth = 2;
    g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.sin(r) * R, oy - Math.cos(r) * R); g.stroke(); g.setLineDash([]); } }
  // traffic
  (d.traffic || []).forEach(t => { if (t.dist > d.range * 1.05) return; const [x, y] = pt(t.brg, t.dist);
    const col = t.level === 'RA' ? COL.red : t.level === 'TA' ? COL.amber : COL.cyan; g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2.5;
    if (t.level === 'RA') g.fillRect(x - 9, y - 9, 18, 18);
    else if (t.level === 'TA') { g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); }
    else { g.beginPath(); g.moveTo(x, y - 11); g.lineTo(x + 9, y); g.lineTo(x, y + 11); g.lineTo(x - 9, y); g.closePath(); g.stroke(); }
    const rel = Math.round(t.rel / 100); const lab = (rel >= 0 ? '+' : '-') + String(Math.abs(rel)).padStart(2, '0');
    txt(g, lab, x, rel >= 0 ? y - 22 : y + 22, 15, col);
    if (t.trend) txt(g, t.trend > 0 ? '↑' : '↓', x + 18, y, 18, col); });
  // own ship
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(ox, oy - 18); g.lineTo(ox - 12, oy + 14); g.moveTo(ox, oy - 18); g.lineTo(ox + 12, oy + 14); g.moveTo(ox - 12, oy + 4); g.lineTo(ox + 12, oy + 4); g.stroke();
  // header
  g.fillStyle = '#000'; g.fillRect(206, 4, 100, 36); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(220, 8, 72, 28);
  txt(g, String(Math.round(wrapDeg(d.hdg)) % 360).padStart(3, '0'), 256, 23, 21); txt(g, 'HDG', 196, 23, 14, COL.green); txt(g, 'MAG', 318, 23, 14, COL.green);
  txt(g, `GS ${Math.round(d.gs || 0)}  TAS ${Math.round(d.tas || 0)}`, 10, 22, 15, '#fff', 'left');
  txt(g, 'WXR', 10, 470, 15, COL.cyan, 'left'); txt(g, 'TFC', 10, 492, 15, COL.cyan, 'left');
  txt(g, `RANGE ${d.range}`, 502, 492, 13, '#8a9099', 'right');
  g.restore();
}

/* d = { n1:[4], egt:[4], gear: 0..1, flaps, fuel, msgs:[{t,c}] } */
function drawEICAS(g, d) {
  const Wd = 512, H = 300; g.save(); g.fillStyle = '#000'; g.fillRect(0, 0, Wd, H);
  d.n1.forEach((n, i) => { const x = 70 + i * 124, y = 92, r = 44, a0 = Math.PI * .8, a1 = Math.PI * 2.2;
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, a0, a1 - .4); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x, y); g.arc(x, y, r, a0, a0 + (a1 - .4 - a0) * clamp(n / 110, 0, 1)); g.closePath(); g.fill();
    const an = a0 + (a1 - .4 - a0) * clamp(n / 110, 0, 1); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); g.stroke();
    g.strokeStyle = '#888'; g.lineWidth = 1.5; g.strokeRect(x - 2, y - 58, 52, 22); txt(g, n.toFixed(1), x + 24, y - 47, 16, '#fff');
    txt(g, 'N1', x, y + 52, 12, '#8a9099'); });
  // gear + flaps
  const gd = d.gear;
  const gtxt = gd < .02 ? 'DOWN' : gd > .98 ? 'UP' : '';
  g.strokeStyle = gd < .02 ? COL.green : gd > .98 ? '#fff' : COL.amber; g.lineWidth = 2; g.strokeRect(24, 196, 120, 40);
  if (gtxt) txt(g, gtxt, 84, 216, 22, gd < .02 ? COL.green : '#fff'); else { g.setLineDash([5, 4]); g.strokeRect(30, 202, 108, 28); g.setLineDash([]); }
  txt(g, 'GEAR', 84, 250, 12, '#8a9099');
  txt(g, 'FLAPS', 210, 250, 12, '#8a9099');
  g.strokeStyle = '#fff'; g.strokeRect(200, 190, 20, 48); g.fillStyle = '#fff'; g.fillRect(200, 190, 20, 48 * clamp(d.flaps / 30, 0, 1));
  txt(g, d.flaps ? String(Math.round(d.flaps)) : 'UP', 246, 214, 18, d.flaps ? COL.green : '#fff');
  txt(g, 'FUEL ' + (d.fuel || 152.4).toFixed(1), 380, 200, 16, '#fff');
  (d.msgs || []).slice(0, 3).forEach((m, i) => txt(g, m.t, 380, 226 + i * 22, 16, m.c || COL.amber));
  g.restore();
}
function drawMCP(g, d) {
  g.save(); g.fillStyle = '#2b2e33'; g.fillRect(0, 0, 1024, 64);
  [['IAS/MACH', d.spd], ['HEADING', String(Math.round(wrapDeg(d.hdg)) % 360).padStart(3, '0')], ['V/S', d.vs], ['ALTITUDE', d.alt]].forEach(([l, v], i) => {
    const x = 120 + i * 260; txt(g, l, x, 14, 12, '#cfd3d8'); g.fillStyle = '#000'; g.fillRect(x - 60, 24, 120, 34); txt(g, String(v), x, 42, 24, '#ffb347'); });
  g.restore();
}
function refreshInstruments(d, { tex = true, dom = false } = {}) {
  drawPFD(INST.c.pfd.getContext('2d'), d.pfd); drawND(INST.c.nd.getContext('2d'), d.nd);
  drawEICAS(INST.c.eicas.getContext('2d'), d.eicas); drawMCP(INST.c.mcp.getContext('2d'), d.mcp);
  if (tex) Object.values(INST.tex).forEach(t => t.needsUpdate = true);
  if (dom) {
    $('pfd-c').getContext('2d').drawImage(INST.c.pfd, 0, 0);
    $('nd-c').getContext('2d').drawImage(INST.c.nd, 0, 0);
    $('eicas-c').getContext('2d').drawImage(INST.c.eicas, 0, 0);
  }
}
