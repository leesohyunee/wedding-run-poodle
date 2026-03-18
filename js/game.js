/* ===== GAME ENGINE – 375 x ~500 portrait canvas ===== */

const Game = (() => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const charEl = document.getElementById('game-char-img');

  const FRAME_W = 375;
  const LANE_COUNT = 3;
  const CHAR_DRAW_H = 80;

  let W, H, LANE_H, LANE_Y, CHAR_X;
  let laneBandTop = 0;
  let laneBandH = 0;
  let charDrawW = CHAR_DRAW_H;

  const assets = {};
  const state = {};

  /* ===== INIT ===== */

  function init() {
    loadAssets();
    setupCharOverlay();
    bindControls();
    resize();
    window.addEventListener('resize', resize);
  }

  function loadAssets() {
    const map = {
      heartPink: 'assets/heart-pink.png',
      heartRainbow: 'assets/heart-rainbow.png',
      star: 'assets/star.png',
    };
    for (const [k, src] of Object.entries(map)) {
      const img = new Image();
      img.src = src;
      img.onload = () => { assets[k] = img; };
    }
  }

  function setupCharOverlay() {
    if (charEl && charEl.naturalWidth) {
      const ratio = charEl.naturalWidth / charEl.naturalHeight;
      charDrawW = CHAR_DRAW_H * ratio;
    }
    charEl.addEventListener('load', () => {
      const ratio = charEl.naturalWidth / charEl.naturalHeight;
      charDrawW = CHAR_DRAW_H * ratio;
    });
  }

  function resize() {
    const wrap = canvas.parentElement;
    const maxW = 375;
    W = Math.min(maxW, Math.max(280, wrap.clientWidth || maxW));
    H = wrap.clientHeight || 480;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const laneZoneHeight = H * 0.35;
    const laneZoneTop = H * 0.42;
    laneBandTop = laneZoneTop;
    laneBandH = laneZoneHeight / LANE_COUNT;
    LANE_H = laneBandH;
    LANE_Y = [
      laneZoneTop + LANE_H * 0.5,
      laneZoneTop + LANE_H * 1.5,
      laneZoneTop + LANE_H * 2.5,
    ];
    CHAR_X = W * 0.18;

    charEl.style.width = charDrawW + 'px';
    charEl.style.height = CHAR_DRAW_H + 'px';
  }

  function resetState() {
    Object.assign(state, {
      score: 0, lane: 1, charY: LANE_Y ? LANE_Y[1] : 0,
      objects: [], particles: [], popups: [],
      speed: 2.6, spawnTimer: 0, spawnInterval: 1.5,
      active: false, elapsed: 0, lastTime: 0, shake: 0, bob: 0,
    });
  }

  /* ===== CONTROLS ===== */

  function bindControls() {
    document.addEventListener('keydown', e => {
      if (!state.active) return;
      if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); move(-1); }
      if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); move(1); }
    });
    const bind = (id, dir) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', e => { e.preventDefault(); move(dir); }, { passive: false });
      el.addEventListener('mousedown', e => { e.preventDefault(); move(dir); });
    };
    bind('ctrl-up', -1);
    bind('ctrl-down', 1);

    canvas.addEventListener('touchstart', e => {
      if (!state.active) return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      move((e.touches[0].clientY - r.top) < r.height / 2 ? -1 : 1);
    }, { passive: false });
  }

  function move(d) { const n = state.lane + d; if (n >= 0 && n < LANE_COUNT) state.lane = n; }

  /* ===== LOOP ===== */

  function start() {
    resize();
    resetState();
    state.charY = LANE_Y[1];
    state.active = true;
    state.lastTime = performance.now();
    document.getElementById('hud-score').textContent = '0';
    charEl.style.display = 'block';
    requestAnimationFrame(loop);
  }

  function stop() {
    state.active = false;
    charEl.style.display = 'none';
  }

  function loop(now) {
    if (!state.active) return;
    const dt = Math.min(now - state.lastTime, 50) / 1000;
    state.lastTime = now;
    state.elapsed += dt;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  /* ===== UPDATE ===== */

  function update(dt) {
    state.bob += dt * 5.5;
    state.charY += (LANE_Y[state.lane] - state.charY) * Math.min(dt * 12, 1);

    state.spawnTimer += dt;
    if (state.spawnTimer >= state.spawnInterval) { spawn(); state.spawnTimer = 0; }

    const px = state.speed * W * 0.14 * dt;
    for (const o of state.objects) { o.x -= px; o.age += dt; }
    state.objects = state.objects.filter(o => o.x > -60);

    collisions();

    for (const p of state.particles) {
      p.x += p.vx * dt * 60; p.y += p.vy * dt * 60;
      p.vy += 1.2 * dt; p.life -= dt * 2.2;
    }
    state.particles = state.particles.filter(p => p.life > 0);

    for (const p of state.popups) { p.y -= 45 * dt; p.life -= dt * 1.8; }
    state.popups = state.popups.filter(p => p.life > 0);

    if (state.elapsed > 5) {
      const t = state.elapsed - 5;
      state.speed = Math.min(2.6 + t * 0.08, 8.5);
      state.spawnInterval = Math.max(1.5 - t * 0.02, 0.5);
    }
    if (state.shake > 0) { state.shake *= Math.pow(0.04, dt); if (state.shake < 0.3) state.shake = 0; }
  }

  function spawn() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    if (state.objects.some(o => o.lane === lane && o.x > W * 0.72)) return;

    const pitC = Math.min(0.20 + state.elapsed * 0.003, 0.33);
    const r = Math.random();
    const type = r < pitC ? 'pit' : r < pitC + 0.14 ? 'rainbow' : 'pink';

    const sz = 38;
    state.objects.push({ type, lane, x: W + 30, y: LANE_Y[lane], size: sz, age: 0, hit: false });
  }

  function collisions() {
    const cr = 30;
    const cx = CHAR_X, cy = state.charY;
    for (let i = state.objects.length - 1; i >= 0; i--) {
      const o = state.objects[i];
      if (o.hit) continue;
      const dx = cx - o.x, dy = cy - o.y;
      if (Math.sqrt(dx * dx + dy * dy) < cr + o.size * 0.42) {
        o.hit = true;
        if (o.type === 'pit') { gameOver(); return; }
        const pts = o.type === 'rainbow' ? 5 : 1;
        state.score += pts;
        document.getElementById('hud-score').textContent = state.score;
        burst(o.x, o.y, o.type === 'rainbow' ? 10 : 5, o.type);
        state.popups.push({ text: '+' + pts, x: o.x, y: o.y - 12, life: 1,
          color: o.type === 'rainbow' ? '#9B59B6' : '#E74C3C' });
      }
    }
    state.objects = state.objects.filter(o => !o.hit);
  }

  function burst(x, y, n, type) {
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 2 / n * i + Math.random() * 0.4;
      const sp = 1 + Math.random() * 2;
      const c = type === 'rainbow' ? `hsl(${Math.random() * 360},75%,62%)` : `hsl(${350 + Math.random() * 20},75%,62%)`;
      state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2 + Math.random() * 2, life: 1, color: c });
    }
  }

  function gameOver() {
    state.active = false;
    state.shake = 12;
    let f = 0;
    const anim = () => {
      f++; state.shake *= 0.84; render();
      if (f < 20) requestAnimationFrame(anim);
      else {
        charEl.style.display = 'none';
        setTimeout(() => App.showGameOver(state.score), 250);
      }
    };
    requestAnimationFrame(anim);
  }

  /* ===== RENDER ===== */

  function render() {
    ctx.save();
    if (state.shake > 0) ctx.translate((Math.random() - .5) * state.shake, (Math.random() - .5) * state.shake);

    ctx.clearRect(0, 0, W, H);

    /* 3 horizontal lane bands (white 30% opacity) with gaps between */
    const LANE_GAP = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < LANE_COUNT; i++) {
      const bandY = laneBandTop + i * laneBandH + LANE_GAP * 0.5;
      const bandHeight = laneBandH - LANE_GAP;
      ctx.fillRect(0, bandY, W, bandHeight);
    }

    for (const o of state.objects) drawObj(o);
    positionChar();
    for (const p of state.particles) drawPart(p);
    for (const p of state.popups) drawPop(p);
    ctx.restore();
  }

  /* -- Character (HTML overlay for GIF animation) -- */
  function positionChar() {
    const bob = Math.sin(state.bob) * 3;
    const cy = state.charY + bob;
    charEl.style.left = (CHAR_X - charDrawW / 2) + 'px';
    charEl.style.top = (cy - CHAR_DRAW_H / 2) + 'px';
  }

  /* -- Objects -- */
  function drawObj(o) {
    const bob = Math.sin(o.age * 3) * 3;
    const x = o.x, y = o.y + bob, s = o.size;
    if (o.type === 'pink') {
      if (assets.heartPink) ctx.drawImage(assets.heartPink, x - s / 2, y - s / 2, s, s);
      else drawHeart(x, y, s * 0.45, '#E74C3C', '#C0392B');
    } else if (o.type === 'rainbow') {
      if (assets.heartRainbow) ctx.drawImage(assets.heartRainbow, x - s / 2, y - s / 2, s, s);
      else drawRainbow(x, y, s * 0.45, o.age);
    } else {
      if (assets.star) ctx.drawImage(assets.star, x - s / 2, y - s / 2, s, s);
      else drawStar(x, y, s * 0.45);
    }
  }

  function heartPath(s) {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.55);
    ctx.bezierCurveTo(-s * .1, s * .3, -s, s * .05, -s, -s * .35);
    ctx.bezierCurveTo(-s, -s * .8, -s * .5, -s, 0, -s * .55);
    ctx.bezierCurveTo(s * .5, -s, s, -s * .8, s, -s * .35);
    ctx.bezierCurveTo(s, s * .05, s * .1, s * .3, 0, s * .55);
    ctx.closePath();
  }

  function drawHeart(cx, cy, r, fill, stroke) {
    ctx.save(); ctx.translate(cx, cy);
    heartPath(r);
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  function drawRainbow(cx, cy, r, age) {
    ctx.save(); ctx.translate(cx, cy);
    const h = (age * 100) % 360;
    const g = ctx.createLinearGradient(-r, -r, r, r);
    for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${(h + i * 55) % 360},75%,65%)`);
    heartPath(r);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  function drawStar(cx, cy, r) {
    ctx.save(); ctx.translate(cx, cy);
    const pts = 4, outer = r, inner = r * 0.38;
    const rot = state.elapsed * 1.2;
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const rad = i % 2 === 0 ? outer : inner;
      const a = Math.PI / pts * i - Math.PI / 2 + rot;
      const fn = i === 0 ? 'moveTo' : 'lineTo';
      ctx[fn](Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fillStyle = '#3E2723'; ctx.fill();
    ctx.restore();
  }

  /* -- FX -- */
  function drawPart(p) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawPop(p) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.font = 'bold 20px "Hakgyoansim", "Jua", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
  }

  return { init, start, stop };
})();

document.addEventListener('DOMContentLoaded', () => Game.init());
