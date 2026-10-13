// Ondulação na água do hero. Um clique na água abre ondas a partir do ponto;
// segurar parado não faz nada; arrastar com o botão apertado é passar a mão
// na água: pequenas ondas vão nascendo pelo caminho e se somam num rastro.
//
// Perspectiva: perto do horizonte a onda é pequena e achatada; perto do pé do
// hero, maior e mais aberta. A posição de cada onda é guardada na água (de 0,
// o horizonte, a 1, a borda de baixo do lago), então ela acompanha a água
// quando a página rola e a água achata (a mesma conta de hero.js).
//
// Desenho: a onda muda a água em vez de somar mais água. É um anel só, em
// traço nítido como a gota, que inverte o que está embaixo (mix-blend-mode:
// difference no CSS): escuro sobre a água clara, claro sobre as listras
// escuras. Caracteres do próprio conjunto da cena se perdiam na textura do
// lago, e um anel claro sumia na água clara.
//
// Acessibilidade: é enfeite, sem função, então não é controle nem recebe
// foco (A11Y.md: o que precisa funcionar sem mouse é funcionalidade). É
// movimento disparado por interação (SC 2.3.3, regra da casa): só existe com
// a animação ligada, e o botão de pausa e prefers-reduced-motion desligam.
// No toque, um toque abre a onda, mas arrastar continua rolando a página.
// Clarões: cada anel passa uma vez por cada ponto (um clarão), uma onda de
// clique no máximo a cada CLICK_GAP_MS, e as do rastro são finas e claras; medido em blocos de 6 × 10 px.

const EDGE_ART = 870;        // borda de baixo do lago (FLAT_EDGE em hero.js)
const LIFE = 1.7;            // s
const CLICK_GAP_MS = 600;    // intervalo mínimo entre duas ondas de clique
const TRAIL_GAP_MS = 45;     // e entre duas ondas do rastro
const MAX_WAVES = 48;

const smooth = (t) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };

async function bootRipples() {
  const hero = document.querySelector('.hero');
  const artBox = hero?.querySelector('.hero__art-box');
  if (!hero || !artBox) return;

  const [look, scene] = await Promise.all([
    fetch('look.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    fetch('layers.json').then((r) => r.json()),
  ]);
  const [artW, artH] = scene.art;
  const overscan = scene.overscan || 0;
  const lake = scene.layers.find((l) => l.kind === 'lake');
  if (!lake) return;
  const shore = scene.layers.find((l) => l.mirrorY === lake.waterTop);
  const shoreDepth = shore ? shore.depth : 0.3;
  const parallax = typeof look.parallax === 'number' ? look.parallax : 0.4;

  const canvas = document.createElement('canvas');
  canvas.className = 'hero__ripples';
  canvas.setAttribute('aria-hidden', 'true');
  hero.querySelector('.hero__canvas').after(canvas);
  const ctx = canvas.getContext('2d');

  let dpr = 1, W = 0, H = 0;
  let scale = 1, oy = 0;
  let waves = [];
  let down = null;
  let lastClick = -1e9;
  let running = document.documentElement.dataset.motion === 'on';
  let frame = 0;

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = hero.clientWidth;
    H = hero.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const Ha = artBox.clientHeight;
    const fit = scene.narrow ? Math.min((Ha * 0.6) / artH, W / scene.narrow.width) : (Ha * 0.6) / artH;
    scale = Math.max(W / (artW - 2 * overscan), fit);
    oy = Ha - artH * scale;
  }

  // a faixa da água na tela (px CSS dentro do hero): o topo anda com a margem
  // no paralaxe, a borda de baixo fica presa ao pé do hero
  function band() {
    const top = hero.getBoundingClientRect().top;
    const scroll = running ? Math.min(Math.max(-top, 0), H) : 0;
    const off = scroll * parallax * (1 - shoreDepth);
    return [oy + off + lake.waterTop * scale, oy + EDGE_ART * scale];
  }

  function local(e) {
    const r = hero.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // posição na água: 0 no horizonte, 1 na borda de baixo; fora dela, null
  function depthAt(y) {
    const [t, b] = band();
    if (y < t + 2 || y > b + 6) return null;
    return Math.min(1, (y - t) / (b - t));
  }

  function add(x, p, strength, now) {
    if (waves.length >= MAX_WAVES) waves.shift();
    waves.push({ x, p, strength, at: now });
    schedule();
  }

  function draw(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const [t, b] = band();
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.beginPath();
    ctx.rect(0, t - 1, W, b - t + 8);
    ctx.clip();
    for (const w of waves) {
      const k = (now - w.at) / 1000 / LIFE;
      if (k < 0 || k >= 1) continue;
      const y = t + w.p * (b - t);
      // perto do horizonte, pequena, achatada e fina; perto do pé, maior e aberta
      const maxR = (18 + 110 * Math.pow(w.p, 1.2)) * w.strength;
      const flat = 0.07 + 0.23 * w.p;
      const th = (1 + 2.2 * w.p) * (w.strength >= 1 ? 1 : 0.6);
      const rx = 3 + maxR * (1 - (1 - k) * (1 - k));
      const ry = Math.max(1.2, rx * flat);
      ctx.globalAlpha = Math.pow(1 - k, 1.4) * (w.strength >= 1 ? 1 : 0.5);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = th;
      ctx.beginPath();
      ctx.ellipse(w.x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function tick(now) {
    frame = 0;
    waves = waves.filter((w) => (now - w.at) / 1000 < LIFE + 0.3);
    draw(now);
    schedule();
  }

  function schedule() {
    if (frame || !running || !waves.length || document.hidden) {
      if (!waves.length || !running) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  hero.addEventListener('pointerdown', (e) => {
    if (!running || e.button !== 0 || e.target.closest('button, a')) return;
    const { x, y } = local(e);
    const p = depthAt(y);
    if (p === null) return;
    // no mouse, segurar não seleciona o texto da frase do topo
    if (e.pointerType === 'mouse') e.preventDefault();
    const now = performance.now();
    if (now - lastClick >= CLICK_GAP_MS) { add(x, p, 1, now); lastClick = now; }
    down = { id: e.pointerId, touch: e.pointerType === 'touch', x, y, at: now };
  });
  hero.addEventListener('pointermove', (e) => {
    if (!down || e.pointerId !== down.id || down.touch || !running) return;
    const { x, y } = local(e);
    const p = depthAt(y);
    if (p === null) return;
    // a mão na água: ondas pequenas pelo caminho, mais juntas perto do horizonte
    const now = performance.now();
    const gap = 4 + 8 * p;
    if (Math.hypot(x - down.x, y - down.y) >= gap && now - down.at >= TRAIL_GAP_MS) {
      add(x, p, 0.45, now);
      down.x = x; down.y = y; down.at = now;
    }
  });
  const release = (e) => { if (down && e.pointerId === down.id) down = null; };
  hero.addEventListener('pointerup', release);
  hero.addEventListener('pointercancel', release);
  hero.addEventListener('pointerleave', release);

  document.addEventListener('dally:motion', (e) => {
    running = e.detail.running;
    if (!running) { waves = []; down = null; if (frame) { cancelAnimationFrame(frame); frame = 0; } }
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
  new ResizeObserver(() => { layout(); if (waves.length) draw(performance.now()); }).observe(hero);
  layout();
}

bootRipples().catch((err) => console.error('[dally.md ondas]', err));
