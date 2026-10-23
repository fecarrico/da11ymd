// dally.md — o retrato do Dalí em ASCII, com o bigode que se mexe como a tromba dos elefantes
// e os olhos que seguem o mouse.
//
// A fonte é a foto em cinza, espelhada para ele entrar pela direita (img/dali-fonte.png).
// Cada célula vira um caractere da rampa do site (../glyphs.json), pela tinta.
// Os dois fios do bigode se mexem na amostragem, como a tromba no hero.js: cada célula
// perto do fio busca a foto girada em torno da raiz dele, e quanto mais perto da ponta,
// mais giro. O fio curto passa perto da sobrancelha, então gira menos.
//
// Os olhos também se mexem na amostragem: dentro da abertura de cada olho (o espaço entre as
// duas pálpebras, dois arcos que passam pelos cantos), a íris é buscada na foto deslocada para
// o lado do mouse, e a pálpebra a cobre quando ela chega à borda. Onde a íris saiu, entra o
// branco do olho. Só com mouse, em dispositivo com hover, como o paralaxe do hero.
//
// O bigode balança sem parar, e por isso o retrato tem o botão de pausa do hero (SC 2.2.2,
// nível A). O relógio anda em degraus de 250 ms, como no hero, e os olhos só mudam no degrau,
// então nenhuma célula muda mais de 4 vezes por segundo (SC 2.3.1): eles andam aos saltos,
// como olhos de verdade. Com prefers-reduced-motion, ou com o movimento pausado (aqui ou na
// home, a mesma chave do hero), nada se mexe, nem os olhos (House Rule SC 2.3.3). Sem
// JavaScript, fica a imagem parada (img/dali-ascii.png).

(function () {
  "use strict";
  const root = document.querySelector("[data-dali]");
  if (!root) return;
  const canvas = root.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const toggle = root.querySelector(".hero__motion");
  const toggleLabel = toggle && toggle.querySelector(".hero__motion-label");

  const GLYPHS = [..." `.,^+\\isoe&80$@"]; // a rampa do site, medida pela tinta de cada caractere
  const INK = "#141414";
  const STEP_MS = 250;
  const FADE_STEPS = 8;    // o giro cresce em 2 s, para o bigode sair da posição natural sem salto
  const STORAGE_KEY = "dally-motion";
  const CELL = 5;          // largura da célula, em px de CSS
  const ASPECT = 0.6;      // largura sobre altura do caractere da Fira Code
  const LOOK = { black: 0.14, white: 0.78, gamma: 0.8, contrast: 1.12, sway: 0.6 };
  // fios do bigode, em pixels da fonte (323 x 400), da raiz à ponta
  const WHISKERS = [
    { amp: 1.0, phase: 0, dIn: 6, dOut: 14, pts: [[122.8, 239.5], [107.8, 239.2], [97.8, 235.8], [87.8, 230.8], [77.8, 225.8], [67.8, 217.0], [57.8, 208.8], [47.8, 200.0], [37.8, 194.2], [29.0, 191.2]] },
    { amp: 0.55, phase: 1.3, dIn: 3.5, dOut: 8, pts: [[150.2, 226.2], [160.2, 215.0], [164.0, 210.0], [167.5, 205.0], [170.8, 200.0], [174.0, 195.0], [177.0, 190.0], [179.0, 185.0], [180.8, 180.0], [182.2, 175.0], [183.8, 170.0], [184.8, 165.0], [185.5, 160.0], [186.2, 155.0], [186.2, 145.0], [185.2, 135.0], [182.8, 130.0], [179.0, 125.0], [176.5, 122.0]] },
  ];
  // olhos, em pixels da fonte: os cantos, a altura de cada pálpebra sobre a linha dos cantos
  // e a íris (centro e raio). Medidos na foto ampliada
  const EYES = [
    { L: [84, 168], R: [106, 163], up: 9, down: 6.5, iris: [96, 165, 6.5] },
    { L: [139, 150], R: [167, 146], up: 12, down: 5, iris: [156, 144.5, 8] },
  ];
  // quanto a íris anda para cada lado, em pixels da fonte. A cabeça está virada, então ela tem
  // mais espaço para a esquerda. reach: a distância do mouse, em larguras do retrato, em que o
  // olhar chega a 70% do caminho
  const GAZE = { left: 8, right: 4, up: 4, down: 3, reach: 0.5 };
  const SCLERA = 0.86;     // o branco do olho, medido na foto

  let src = null, SW = 0, SH = 0;   // a foto em cinza, 0 a 1
  let grid = null, base = null, moving = [], eyeCells = [];
  let step = 0, last = 0, raf = 0, running = false, visible = true;
  let pointer = null;               // o mouse, em px de CSS da janela; null quando sai dela

  const smooth = (t) => t * t * (3 - 2 * t);
  const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function sample(x, y) {
    // bilinear na foto; fora dela é papel
    if (x < 0 || y < 0 || x > SW - 1 || y > SH - 1) return 1;
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, SW - 1), y1 = Math.min(y0 + 1, SH - 1);
    const fx = x - x0, fy = y - y0;
    const a = src[y0 * SW + x0], b = src[y0 * SW + x1], c = src[y1 * SW + x0], d = src[y1 * SW + x1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  function glyphIndex(lum) {
    const v = Math.min(1, Math.max(0, (lum - LOOK.black) / (LOOK.white - LOOK.black)));
    const D = Math.min(1, Math.pow(1 - v, LOOK.gamma) * LOOK.contrast);
    return Math.round(D * (GLYPHS.length - 1));
  }
  function nearest(w, x, y) {
    // o ponto do fio mais perto da célula: posição ao longo dele (0 na raiz, 1 na ponta) e distância
    let best = Infinity, at = 0, acc = 0;
    const p = w.pts;
    for (let i = 0; i < p.length - 1; i++) {
      const ax = p[i][0], ay = p[i][1], bx = p[i + 1][0], by = p[i + 1][1];
      const vx = bx - ax, vy = by - ay, len = Math.hypot(vx, vy);
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (len * len)));
      const d = Math.hypot(x - (ax + vx * t), y - (ay + vy * t));
      if (d < best) { best = d; at = acc + t * len; }
      acc += len;
    }
    return { s: at / acc, d: best };
  }

  // as pálpebras: dois arcos de círculo que passam pelos dois cantos, um para cima e um para baixo
  EYES.forEach((e) => {
    const [lx, ly] = e.L, [rx, ry] = e.R;
    const c = Math.hypot(rx - lx, ry - ly), mx = (lx + rx) / 2, my = (ly + ry) / 2;
    const nx = (ry - ly) / c, ny = -(rx - lx) / c; // a normal da linha dos cantos, para cima
    const arc = (h, side) => { const r = (c * c / 4 + h * h) / (2 * h); return { x: mx - side * nx * (r - h), y: my - side * ny * (r - h), r }; };
    e.lids = [arc(e.up, 1), arc(e.down, -1)];
  });
  // quanto a célula está para dentro da abertura do olho, em pixels da fonte (negativo: fora dela)
  const inside = (e, x, y) => Math.min(...e.lids.map((a) => a.r - Math.hypot(x - a.x, y - a.y)));

  function eyeLum(e, x, y, gx, gy) {
    const [ix, iy, ir] = e.iris;
    // a íris, deslocada pelo olhar
    if (Math.hypot(x - gx - ix, y - gy - iy) < ir) return sample(x - gx, y - gy);
    // fora da íris da foto, a própria foto; onde ela estava, o branco do olho, na sombra rente à pálpebra
    if (Math.hypot(x - ix, y - iy) >= ir) return sample(x, y);
    return SCLERA - 0.3 * (1 - smoothstep(0, 3, inside(e, x, y)));
  }

  function layout() {
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) { grid = null; return false; }
    const k = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(3, Math.round(CELL * k));
    const ch = Math.round(cw / ASPECT);
    canvas.width = Math.round(box.width * k);
    canvas.height = Math.round(box.height * k);
    const cols = Math.floor(canvas.width / cw), rows = Math.floor(canvas.height / ch);
    // a foto cobre o quadro pela altura e encosta na borda direita, de onde ele entra
    const scale = SH / (rows * ch);
    const offX = SW - cols * cw * scale;
    grid = { cw, ch, k, scale, offX };
    const font = Math.round(ch * 0.9) + 'px "Fira Code", "DejaVu Sans Mono", ui-monospace, monospace';
    ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    moving = []; eyeCells = [];
    const taken = new Uint8Array(cols * rows);
    EYES.forEach((e, ei) => {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = offX + (c + 0.5) * cw * scale, y = (r + 0.5) * ch * scale;
        if (taken[r * cols + c] || inside(e, x, y) <= 0) continue;
        eyeCells.push({ c, r, x, y, ei });
        taken[r * cols + c] = 1;
      }
    });
    WHISKERS.forEach((w, wi) => {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (taken[r * cols + c]) continue;
        const x = offX + (c + 0.5) * cw * scale, y = (r + 0.5) * ch * scale;
        const n = nearest(w, x, y);
        if (n.d >= w.dOut) continue;
        const weight = smooth(n.s) * (1 - smoothstep(w.dIn, w.dOut, n.d));
        if (weight < 0.002) continue;
        moving.push({ c, r, x, y, w: weight, wi });
        taken[r * cols + c] = 1;
      }
    });
    // o retrato parado, sem as células que se mexem
    base = document.createElement("canvas");
    base.width = canvas.width; base.height = canvas.height;
    const b = base.getContext("2d");
    b.font = font; b.textAlign = "center"; b.textBaseline = "middle"; b.fillStyle = INK;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (taken[r * cols + c]) continue;
      const i = glyphIndex(sample(offX + (c + 0.5) * cw * scale, (r + 0.5) * ch * scale));
      if (i > 0) b.fillText(GLYPHS[i], c * cw + cw / 2, r * ch + ch / 2 + ch * 0.04);
    }
    return true;
  }

  // o olhar: a direção do mouse a partir do meio dos olhos, que chega perto do máximo quando ele
  // se afasta. Arredondado em pixels da fonte, para um mouse quase parado não tremer a íris
  let gaze = [0, 0];
  function aim() {
    if (!pointer || !grid) return [0, 0];
    const box = canvas.getBoundingClientRect();
    const { k, scale, offX } = grid;
    const toCss = (sx, sy) => [box.left + (sx - offX) / scale / k, box.top + sy / scale / k];
    const mid = toCss((EYES[0].iris[0] + EYES[1].iris[0]) / 2, (EYES[0].iris[1] + EYES[1].iris[1]) / 2);
    const vx = pointer[0] - mid[0], vy = pointer[1] - mid[1];
    const f = 1 / Math.hypot(vx, vy, GAZE.reach * box.width);
    const ux = vx * f, uy = vy * f;
    return [Math.round(ux * (ux < 0 ? GAZE.left : GAZE.right)), Math.round(uy * (uy < 0 ? GAZE.up : GAZE.down))];
  }

  function draw(s) {
    if (!grid) return;
    const { cw, ch } = grid;
    const t = s * STEP_MS / 1000, e = smoothstep(0, FADE_STEPS, s);
    const angles = WHISKERS.map((w) => e * LOOK.sway * w.amp * (0.10 * Math.sin(1.05 * t + w.phase) + 0.035 * Math.sin(1.9 * t + w.phase * 1.7)));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    ctx.fillStyle = INK;
    for (const m of moving) {
      const o = WHISKERS[m.wi].pts[0];
      const a = angles[m.wi] * m.w, ca = Math.cos(a), sa = Math.sin(a);
      const dx = m.x - o[0], dy = m.y - o[1];
      const i = glyphIndex(sample(o[0] + ca * dx - sa * dy, o[1] + sa * dx + ca * dy));
      if (i > 0) ctx.fillText(GLYPHS[i], m.c * cw + cw / 2, m.r * ch + ch / 2 + ch * 0.04);
    }
    for (const m of eyeCells) {
      const i = glyphIndex(eyeLum(EYES[m.ei], m.x, m.y, gaze[0], gaze[1]));
      if (i > 0) ctx.fillText(GLYPHS[i], m.c * cw + cw / 2, m.r * ch + ch / 2 + ch * 0.04);
    }
  }

  function tick(now) {
    raf = 0;
    if (!running || !visible) return;
    if (now - last >= STEP_MS) { last = now; step++; gaze = aim(); draw(step); }
    raf = requestAnimationFrame(tick);
  }

  // o botão de pausa é o do hero da home, com a mesma chave: a escolha vale enquanto a preferência
  // do sistema for a mesma de quando ela foi feita; se a pessoa mudar a preferência, a preferência vence
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  function readStored() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && saved.reduce === reduce.matches && (saved.choice === "on" || saved.choice === "off")) return saved.choice;
    } catch (e) { /* sem armazenamento, vale o sistema */ }
    return null;
  }
  function store(choice) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, reduce: reduce.matches })); } catch (e) { /* vale só nesta visita */ } }
  const motionLabel = (on) => (window.dallyText
    ? window.dallyText(on ? "motion-pause" : "motion-resume")
    : (on ? "Pausar animação" : "Retomar animação"));
  function showState() {
    if (!toggle) return;
    toggle.dataset.state = running ? "running" : "paused";
    toggleLabel.textContent = motionLabel(running);
  }
  function setRunning(on) {
    running = on;
    document.documentElement.dataset.motion = on ? "on" : "off";
    showState();
    last = 0;
    if (on && !raf) raf = requestAnimationFrame(tick);
  }

  // desenha um instante qualquer, para a imagem parada e para conferir (olhar em pixels da fonte)
  window.__dali = { drawAt: (s, g) => { gaze = g || [0, 0]; draw(s); return canvas.toDataURL("image/png"); } };

  const img = new Image();
  img.onload = function () {
    const c = document.createElement("canvas");
    SW = c.width = img.naturalWidth; SH = c.height = img.naturalHeight;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, SW, SH).data;
    src = new Float32Array(SW * SH);
    for (let i = 0; i < SW * SH; i++) src[i] = px[i * 4] / 255;
    const fontReady = document.fonts && document.fonts.load ? document.fonts.load('16px "Fira Code"').catch(() => null) : Promise.resolve();
    fontReady.then(() => {
      if (layout()) { draw(step); root.classList.add("is-drawn"); }
      const stored = readStored();
      if (toggle) {
        toggle.hidden = false;
        toggle.addEventListener("click", () => { store(running ? "off" : "on"); setRunning(!running); });
      }
      document.addEventListener("dally:lang", showState);
      reduce.addEventListener("change", (e) => { try { localStorage.removeItem(STORAGE_KEY); } catch (err) { /* nada a esquecer */ } setRunning(!e.matches); });
      // o olhar: só com mouse (em tela de toque não há ponteiro parado sobre a página)
      document.addEventListener("pointermove", (e) => { pointer = e.pointerType === "mouse" && finePointer.matches ? [e.clientX, e.clientY] : null; });
      document.addEventListener("mouseout", (e) => { if (!e.relatedTarget) pointer = null; });
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible && running && !raf) raf = requestAnimationFrame(tick); }).observe(root);
      }
      if ("ResizeObserver" in window) {
        let pending = 0;
        new ResizeObserver(() => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => { if (layout()) { draw(step); root.classList.add("is-drawn"); } }); }).observe(canvas);
      }
      setRunning(stored ? stored === "on" : !reduce.matches);
    });
  };
  img.src = root.dataset.dali;
})();
