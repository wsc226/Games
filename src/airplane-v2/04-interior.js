/* ═══ INTERIOR: flight deck + economy cabin (player's plane only) ═══ */
const EYE_COCKPIT = new THREE.Vector3(29.85, 3.8, -.55);   // captain's eye (model space)
const EYE_PILOT = new THREE.Vector3(30.95, 3.86, -.5);   // leaning forward (Sky Challenge)
const EYE_CABIN = new THREE.Vector3(-21.0, .72, 1.2);       // standing in right aisle
const EYE_WINDOW = new THREE.Vector3(-6.2, .9, 3.3);       // just outside a right-side window

function shellWithHoles(x0, x1, holes, color, shrink) {
  const W = 1024, H = 1024, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, W, H);
  // subtle panel lines
  g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2;
  for (let i = 0; i < 24; i++) { const x = i / 24 * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  g.globalCompositeOperation = 'destination-out';
  const px = x => (x - x0) / (x1 - x0) * W, py = th => (1 - th / (Math.PI * 2)) * H;
  holes.forEach(hh => { g.beginPath();
    const X0 = px(hh.x0), X1 = px(hh.x1), Y0 = py(hh.t1), Y1 = py(hh.t0);
    if (g.roundRect) g.roundRect(Math.min(X0, X1), Math.min(Y0, Y1), Math.abs(X1 - X0), Math.abs(Y1 - Y0), hh.r || 0); else g.rect(Math.min(X0, X1), Math.min(Y0, Y1), Math.abs(X1 - X0), Math.abs(Y1 - Y0));
    g.fill(); });
  g.globalCompositeOperation = 'source-over';
  const tex = canvasTex(c);
  const u0 = (x0 - XT) / (XN - XT), R = (XN - XT) / (x1 - x0);
  tex.repeat.set(R, 1); tex.offset.set(-u0 * R, 0);
  const geo = fuselageGeom(x0, x1, Math.ceil((x1 - x0) * 4), 64, shrink);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.BackSide, alphaTest: .5, roughness: .8, metalness: 0, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: .45 }));
  return m;
}
function box(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent && parent.add(m); return m; }
function screenPlane(tex, w, h, x, y, z, parent, rotY = -Math.PI / 2) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.position.set(x, y, z); m.rotation.y = rotY; parent.add(m); return m;
}

function buildInterior(P, al, C) {
  const ck = new THREE.Group(), cab = new THREE.Group(); P.model.add(ck, cab);
  ck.visible = cab.visible = false; P.cockpit = ck; P.cabin = cab;
  const ie = c => ({ emissive: c, emissiveIntensity: .55 });
  const panelGray = stdMat('#4a4f56', .75, .2, ie('#4a4f56')), darker = stdMat('#33373c', .8, .2, ie('#33373c'));

  /* ── FLIGHT DECK ── */
  const paneHoles = [];
  PANES.forEach(([x0, x1, t0, t1]) => { paneHoles.push({ x0, x1, t0, t1, r: 10 }, { x0, x1, t0: Math.PI * 2 - t1, t1: Math.PI * 2 - t0, r: 10 }); });
  ck.add(shellWithHoles(28.3, 35.25, paneHoles, '#4a4e55', .975));
  box(4.2, .05, 2.6, darker, 30.2, 2.5, 0, ck);                                  // floor
  const panel = box(.2, .7, 2.5, panelGray, 31.45, 2.82, 0, ck); panel.rotation.z = .12;
  box(1.6, 1.2, 2.6, darker, 32.2, 2.6, 0, ck);                                  // structure under the windshield
  box(.7, .07, 2.6, stdMat('#141518', .9, 0), 31.45, 3.17, 0, ck);              // glareshield
  const pfdT = INST.tex.pfd, ndT = INST.tex.nd, eiT = INST.tex.eicas;
  const tilt = m => { m.rotation.order = 'YXZ'; m.rotation.x = -.12; return m; };
  tilt(screenPlane(pfdT, .27, .27, 31.33, 2.88, -.98, ck)); tilt(screenPlane(ndT, .27, .27, 31.33, 2.88, -.66, ck));
  tilt(screenPlane(eiT, .3, .19, 31.33, 2.93, -.17, ck)); tilt(screenPlane(eiT, .3, .19, 31.33, 2.93, .17, ck));
  tilt(screenPlane(ndT, .27, .27, 31.33, 2.88, .66, ck)); tilt(screenPlane(pfdT, .27, .27, 31.33, 2.88, .98, ck));
  box(.06, .11, 1.4, stdMat('#2b2e33', .6, .3), 31.1, 3.1, 0, ck);
  screenPlane(INST.tex.mcp, 1.3, .085, 31.065, 3.1, 0, ck);
  // pedestal with thrust levers
  const ped = box(.95, .5, .48, panelGray, 30.55, 2.75, 0, ck); ped.rotation.z = -.08;
  P.levers = [];
  [-.15, -.05, .05, .15].forEach(z => { const lp = new THREE.Group(); lp.position.set(30.75, 3.0, z);
    box(.03, .22, .03, MAT.chrome, 0, .11, 0, lp); box(.06, .05, .07, stdMat('#111', .5, 0), 0, .22, 0, lp); ck.add(lp); P.levers.push(lp); });
  const flapLever = new THREE.Group(); flapLever.position.set(30.6, 3.0, .2); box(.025, .18, .025, MAT.chrome, 0, .09, 0, flapLever); box(.08, .04, .06, stdMat('#eee', .5, 0), 0, .18, 0, flapLever); ck.add(flapLever); P.flapLever = flapLever;
  const gearLever = new THREE.Group(); gearLever.position.set(31.2, 2.75, .35); box(.02, .14, .02, MAT.chrome, 0, .07, 0, gearLever);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .04, 12), stdMat('#ddd', .5, 0)); knob.rotation.x = Math.PI / 2; knob.position.y = .14; gearLever.add(knob); ck.add(gearLever); P.gearLever = gearLever;
  // yokes
  P.yokes = [];
  [-.55, .55].forEach(z => { const col = new THREE.Group(); col.position.set(30.85, 2.5, z);
    box(.07, .5, .07, darker, 0, .25, 0, col);
    const wheelG = new THREE.Group(); wheelG.position.set(-.08, .52, 0); col.add(wheelG);
    const hub = box(.05, .08, .12, darker, 0, 0, 0, wheelG);
    [-1, 1].forEach(sd => { const horn = box(.04, .16, .04, darker, 0, .02, sd * .16, wheelG); horn.rotation.x = sd * .3;
      box(.05, .05, .1, darker, 0, -.04, sd * .09, wheelG); });
    ck.add(col); P.yokes.push({ col, wheel: wheelG }); void hub; });
  // overhead
  const oh = box(1.1, .06, 1.0, panelGray, 30.4, 4.2, 0, ck); oh.rotation.z = .25;
  const ohT = (() => { const c = makeCanvas(256, 256), g = c.getContext('2d'); g.fillStyle = '#3b3f45'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) { g.fillStyle = Math.random() < .2 ? '#e8e2c8' : '#1d1f22'; g.fillRect(10 + (i % 10) * 24, 12 + Math.floor(i / 10) * 34, 14, 14); }
    return canvasTex(c); })();
  const ohs = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .9), new THREE.MeshStandardMaterial({ map: ohT, roughness: .8 }));
  ohs.position.set(30.4, 4.16, 0); ohs.rotation.set(-Math.PI / 2, 0, 0); ohs.rotateX(0); ohs.rotation.order = 'YXZ'; ohs.rotation.set(Math.PI / 2 - .25, Math.PI / 2, 0, 'YXZ'); ck.add(ohs);
  P.beltSignCk = new THREE.Mesh(new THREE.PlaneGeometry(.08, .04), new THREE.MeshBasicMaterial({ color: '#ffb340', toneMapped: false }));
  P.beltSignCk.position.set(30.95, 4.04, 0); P.beltSignCk.rotation.y = -Math.PI / 2; P.beltSignCk.rotation.x = 0; ck.add(P.beltSignCk);
  // side consoles + FO seat
  box(1.2, .55, .3, darker, 30.0, 2.78, -1.25, ck); box(1.2, .55, .3, darker, 30.0, 2.78, 1.25, ck);
  const seat = new THREE.Group(); seat.position.set(29.9, 2.5, .55);
  box(.55, .12, .55, stdMat('#2d2a27', .9, 0), 0, .45, 0, seat); const bk = box(.12, .8, .55, stdMat('#2d2a27', .9, 0), -.3, .85, 0, seat); bk.rotation.z = .15; ck.add(seat);
  P.cockpitLight = new THREE.PointLight('#fff2dc', 0, 0, 1.2); P.cockpitLight.position.set(30.4, 3.9, 0); ck.add(P.cockpitLight);

  /* ── ECONOMY CABIN ── */
  const cx0 = -24.6, cx1 = 1.4;
  const holes = WINDOWS.filter(w => w.y < 2 && w.x > cx0 && w.x < cx1).flatMap(w => {
    const t0 = thetaForY(w.x, w.y + w.h / 2, 'R'), t1 = thetaForY(w.x, w.y - w.h / 2, 'R');
    return [{ x0: w.x - w.w / 2, x1: w.x + w.w / 2, t0, t1, r: 14 }, { x0: w.x - w.w / 2, x1: w.x + w.w / 2, t0: Math.PI * 2 - t1, t1: Math.PI * 2 - t0, r: 14 }];
  });
  cab.add(shellWithHoles(cx0, cx1, holes, '#ecebe6', .955));
  const carpet = (() => { const c = makeCanvas(128, 128), g = c.getContext('2d'); g.fillStyle = new THREE.Color(C.line).multiplyScalar(.45).getStyle(); g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .06})`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } return canvasTex(c, { repeat: [20, 4] }); })();
  box(cx1 - cx0, .04, 5.9, stdMat('#ffffff', .95, 0, { map: carpet }), (cx0 + cx1) / 2, -1.02, 0, cab);
  const binMat = stdMat('#f4f3ef', .55, 0, { emissive: '#f4f3ef', emissiveIntensity: .25 }), stripMat = new THREE.MeshBasicMaterial({ color: '#dfe8ff', toneMapped: false });
  P.moodMat = stripMat;
  [-1, 1].forEach(sd => { box(cx1 - cx0, .62, .95, binMat, (cx0 + cx1) / 2, 1.45, sd * 2.38, cab); box(cx1 - cx0, .03, .06, stripMat, (cx0 + cx1) / 2, 1.13, sd * 1.88, cab); });
  box(cx1 - cx0, .58, 1.9, binMat, (cx0 + cx1) / 2, 1.6, 0, cab);
  box(cx1 - cx0, .03, 1.2, stripMat, (cx0 + cx1) / 2, 2.12, 0, cab);
  box(cx1 - cx0, .05, 1.0, stdMat('#e9e8e3', .6, 0), (cx0 + cx1) / 2, 2.15, -1.4, cab); box(cx1 - cx0, .05, 1.0, stdMat('#e9e8e3', .6, 0), (cx0 + cx1) / 2, 2.15, 1.4, cab);
  // seats (instanced)
  const seatCols = [-2.55, -2.09, -1.63, -.69, -.23, .23, .69, 1.63, 2.09, 2.55];
  const rows = []; for (let x = -22.2; x <= -.4; x += .81) rows.push(x);
  const n = rows.length * seatCols.length;
  const sFab = stdMat(new THREE.Color(C.line).lerp(new THREE.Color('#334'), .35).getStyle(), .95, 0);
  const cushionG = mergeGeometries([new THREE.BoxGeometry(.46, .12, .44).translate(0, -.5, 0), new THREE.BoxGeometry(.1, .72, .44).rotateZ(.14).translate(-.24, -.08, 0)]);
  const headG = new THREE.BoxGeometry(.11, .18, .38).rotateZ(.14).translate(-.19, .2, 0);
  const screenG = new THREE.PlaneGeometry(.2, .13).rotateY(-Math.PI / 2).translate(-.305, .05, 0);
  const legG = new THREE.BoxGeometry(.06, .4, .4).translate(0, -.8, 0);
  const iC = new THREE.InstancedMesh(cushionG, sFab, n), iH = new THREE.InstancedMesh(headG, stdMat('#f2f2ee', .9, 0), n);
  const scrTex = (() => { const c = makeCanvas(128, 80), g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 80); gr.addColorStop(0, '#0b2a5a'); gr.addColorStop(1, '#1d5fa8');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 80); g.fillStyle = '#fff'; g.font = 'bold 14px Helvetica'; g.textAlign = 'center'; g.fillText('✈ ' + al.name, 64, 44); return canvasTex(c); })();
  const iS = new THREE.InstancedMesh(screenG, new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false }), n), iL = new THREE.InstancedMesh(legG, MAT.strut, n);
  const people = []; const m4 = new THREE.Matrix4(); let k = 0;
  rows.forEach(x => seatCols.forEach(z => { m4.makeTranslation(x, 0, z); iC.setMatrixAt(k, m4); iH.setMatrixAt(k, m4); iS.setMatrixAt(k, m4); iL.setMatrixAt(k, m4); k++;
    if (Math.random() < .62 && x < -1.5) people.push([x, z]); }));
  cab.add(iC, iH, iS, iL);
  const torsoG = new THREE.CapsuleGeometry(.17, .32, 4, 8).translate(-.05, -.12, 0), headPG = new THREE.SphereGeometry(.11, 12, 10).translate(-.04, .3, 0);
  const iT = new THREE.InstancedMesh(torsoG, stdMat('#ffffff', .9, 0), people.length), iP = new THREE.InstancedMesh(headPG, stdMat('#ffffff', .8, 0), people.length);
  const shirt = ['#3b5b8c', '#b04646', '#4f7d4a', '#d9a441', '#6b4f8a', '#2f2f2f', '#c7c2b8', '#3f8f9a'], skin = ['#f1c9a5', '#d7a477', '#a8754f', '#6e4a32', '#f5d7bd'], hair = ['#2a1c12', '#4b3220', '#111', '#8a6a3a', '#d7b56d'];
  const col = new THREE.Color();
  people.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); iT.setMatrixAt(i, m4); iP.setMatrixAt(i, m4);
    iT.setColorAt(i, col.set(shirt[i % shirt.length])); iP.setColorAt(i, col.set(Math.random() < .5 ? skin[i % skin.length] : hair[i % hair.length])); });
  cab.add(iT, iP);
  // bulkhead with screen, seatbelt sign and exit sign
  box(.1, 3.2, 5.8, stdMat('#e6e3dc', .7, 0), cx1 - .2, .5, 0, cab);
  const bh = makeCanvas(512, 256), bg = bh.getContext('2d');
  const bulkTex = canvasTex(bh); P.bulkhead = { c: bh, g: bg, tex: bulkTex };
  screenPlane(bulkTex, 1.6, .8, cx1 - .27, .9, 0, cab, -Math.PI / 2);
  const signC = makeCanvas(256, 128), sg2 = signC.getContext('2d'); P.beltSign = { c: signC, g: sg2, tex: canvasTex(signC), mats: [] };
  for (let x = -20; x < 0; x += 3.2) [-1, 1].forEach(sd => { const m = screenPlane(P.beltSign.tex, .34, .17, x, 1.08, sd * 1.65, cab, -Math.PI / 2); m.rotation.x = 0; });
  screenPlane(P.beltSign.tex, .7, .35, cx1 - .27, 1.6, -1.6, cab, -Math.PI / 2);
  screenPlane(P.beltSign.tex, .7, .35, cx1 - .27, 1.6, 1.6, cab, -Math.PI / 2);
  const exitC = textCanvas('EXIT', { w: 256, h: 96, font: 'bold 64px Helvetica', color: '#fff', bg: '#118a3a' });
  screenPlane(canvasTex(exitC), .4, .15, cx1 - .27, 1.95, 0, cab, -Math.PI / 2);
  P.cabinLight = new THREE.PointLight('#fff4e6', 0, 0, 1); P.cabinLight.position.set(-11, 1.7, 0); cab.add(P.cabinLight);
  P.cabinLight2 = new THREE.PointLight('#fff4e6', 0, 0, 1); P.cabinLight2.position.set(-2, 1.7, 0); cab.add(P.cabinLight2);
  P.setBelt = on => drawBeltSign(P, on);
  drawBeltSign(P, true);
  P.drawBulkhead = (alt, phase) => {
    const g = bg; const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#0a1f45'); gr.addColorStop(1, '#13427e');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#fff'; g.font = 'bold 30px Helvetica'; g.textAlign = 'center'; g.fillText(al.name, 256, 50);
    g.font = '22px Helvetica'; g.fillStyle = '#9fd0ff'; g.fillText(phase, 256, 92);
    g.strokeStyle = '#6fb6ff'; g.lineWidth = 3; g.beginPath(); g.moveTo(60, 190); g.quadraticCurveTo(256, 120, 452, 190); g.stroke();
    const t = clamp(alt / 35000, 0, 1); const px = lerp(60, 452, t * .4), py = 190 - Math.sin(t * .4 * Math.PI) * 52;
    g.font = '30px sans-serif'; g.fillText('✈', px, py + 10);
    g.fillStyle = '#fff'; g.font = 'bold 22px Helvetica'; g.fillText(`ALTITUDE ${Math.round(alt).toLocaleString()} ft`, 256, 238);
    bulkTex.needsUpdate = true;
  };
  P.drawBulkhead(0, 'Welcome aboard');
}
function drawBeltSign(P, on) {
  const g = P.beltSign.g; g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, 256, 128);
  const c = on ? '#ffbf3c' : '#3a3a3a';
  g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 7;
  // no-smoking roundel
  g.beginPath(); g.arc(52, 64, 34, 0, Math.PI * 2); g.stroke(); g.fillRect(30, 58, 40, 12);
  g.beginPath(); g.moveTo(28, 40); g.lineTo(76, 88); g.stroke();
  g.fillRect(100, 12, 4, 104);
  g.font = 'bold 30px Helvetica'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('FASTEN', 180, 46); g.fillText('SEATBELT', 180, 86);
  P.beltSign.tex.needsUpdate = true;
  if (P.beltSignCk) P.beltSignCk.material.color.set(on ? '#ffb340' : '#2a2a2a');
}
