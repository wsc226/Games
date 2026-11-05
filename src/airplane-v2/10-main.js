/* ═══ MAIN: menus, bindings, start ═══ */
RT.others = [];
let bound = false;
function setLvl(l) { level = l; $('m-easy').classList.toggle('on', l === 'easy'); $('m-norm').classList.toggle('on', l === 'normal');
  if (GAME === 'takeoff') updBtns(); else { SKY.autoLevel = l === 'easy'; $('sb-level').classList.toggle('on', SKY.autoLevel); } }
function bindAll() {
  hold($('k-push'), hPushS, hPushE); hold($('k-thrust'), hThrS, hThrE);
  tap($('k-flaps'), hFlaps); tap($('k-gear'), hGear); tap($('k-belt'), hBelt); tap($('k-ann'), hAnn);
  tap($('a-doors'), hADoors); tap($('a-welcome'), hAWel); tap($('a-takeoff'), hATO); tap($('a-cruise'), hACruise);
  tap($('ad-close'), () => closeDrawer()); tap($('rotate-b'), hRotate);
  tap($('b-fly'), () => startGame(GAME)); tap($('b-sky'), () => startGame('sky')); tap($('b-new'), backToMenu);
  tap($('nav-sim'), backToMenu); tap($('sound-sim'), () => { initA(); setMuted(!muted); });
  tap($('m-easy'), () => setLvl('easy')); tap($('m-norm'), () => setLvl('normal'));
  $$('.vb').forEach(b => tap(b, () => { initA(); setView(b.dataset.v); }));
  bindSkyInput();
  new ResizeObserver(resize).observe($('scene'));
}
function stopAll() {
  clearTimers(); cancelVoice(); tkReset(); turbulenceSound(false);
  if (GAME === 'sky' || document.body.classList.contains('sky')) skyTeardown();
  $('end-ov').classList.remove('show'); $('whiteout').style.opacity = 0; RT.autoOrbit = 0; RT.pitchBias = 0; RT.shake = 0;
  $('stick-hint').classList.remove('show');
}
function startGame(mode) {
  stopAll(); GAME = mode;
  $('badge').innerHTML = `<img src="${LOGOS[AL.id]}" alt="">`;
  if (!RT.plane || RT.plane.al !== AL) {
    if (RT.plane) W.scene.remove(RT.plane.root);
    RT.plane = buildPlane(AL, { interior: true }); RT.plane.al = AL; W.scene.add(RT.plane.root);
  }
  if (mode === 'takeoff') tkStart(); else skyStart();
  resize(); startLoop();
}
function backToMenu() { stopAll(); stopLoop(); $('scr-sim').classList.add('gone'); $('scr-air').classList.remove('gone'); }
function pick(al) {
  AL = al; initA();
  $('loading').classList.add('show');
  setTimeout(() => {   // let the loading screen paint before the heavy build
    try {
      initWorld(); if (!RT.controls) setupControls();
      $('scr-air').classList.add('gone'); $('scr-sim').classList.remove('gone');
      if (!bound) { bindAll(); bound = true; }
      startGame(GAME);
    } catch (err) { console.error(err); $('loading-msg').textContent = 'Error: ' + err.message; return; }
    $('loading').classList.remove('show');
  }, 30);
}
function grid() {
  const g = $('a-grid'); g.innerHTML = '';
  AIRLINES.forEach(al => { const t = document.createElement('button'); t.className = 'at';
    t.innerHTML = `<img src="${LOGOS[al.id]}" alt=""><div class="at-n">${al.name}</div>`; tap(t, () => pick(al)); g.appendChild(t); });
}
function setGameTab(m) { GAME = m; $('gm-takeoff').classList.toggle('on', m === 'takeoff'); $('gm-sky').classList.toggle('on', m === 'sky'); }
tap($('gm-takeoff'), () => setGameTab('takeoff')); tap($('gm-sky'), () => setGameTab('sky'));
$('nav-air').addEventListener('click', () => location.href = 'index.html');
setMuted(muted);
if (/[?&]mode=sky/.test(location.search)) setGameTab('sky');
grid();
// debug hook for testing
window.__air = { RT, W, SKY, TK, get ST() { return ST; }, pick: id => pick(AIRLINES.find(a => a.id === id)), setGameTab, say, nextCh: k => nextChallenge(k), step: (n = 20, dt = .05) => { for (let i = 0; i < n; i++) advance(dt); } };
