// dally.md — o retrato do Dalí em ASCII, com o bigode que se mexe como a tromba dos elefantes.
//
// A fonte é a foto em cinza, espelhada para ele entrar pela direita (img/dali-fonte.png).
// Cada célula vira um caractere da rampa do site (../glyphs.json), pela tinta.
// Os dois fios do bigode se mexem na amostragem, como a tromba no hero.js: cada célula
// perto do fio busca a foto girada em torno da raiz dele, e quanto mais perto da ponta,
// mais giro. O fio curto passa perto da sobrancelha, então gira menos.
//
// O bigode balança uma vez, ao abrir a página, por 4,5 s: o giro cresce e volta a zero, e o
// retrato para na posição natural. Por durar menos de 5 s, não precisa de botão de pausa
// (SC 2.2.2): o botão de pausa fica só no hero da home (pedido do Felipe, 23/10). O relógio
// anda em degraus de 250 ms, como no hero, então nenhuma célula muda mais de 4 vezes por
// segundo (SC 2.3.1). Com prefers-reduced-motion, ou com o movimento pausado na home (a mesma
// chave do hero), o bigode não se mexe. Sem JavaScript, fica a imagem parada (img/dali-ascii.png).

(function () {
  "use strict";
  const root = document.querySelector("[data-dali]");
  if (!root) return;
  const canvas = root.querySelector("canvas");
  const ctx = canvas.getContext("2d");

  const GLYPHS = [..." `.,^+\\isoe&80$@"]; // a rampa do site, medida pela tinta de cada caractere
  const INK = "#141414";
  const STEP_MS = 250;
  const PLAY_STEPS = 18;   // 18 degraus de 250 ms: 4,5 s, abaixo dos 5 s do SC 2.2.2
  const STORAGE_KEY = "dally-motion";
  const CELL = 5;          // largura da célula, em px de CSS
  const ASPECT = 0.6;      // largura sobre altura do caractere da Fira Code
  const LOOK = { black: 0.14, white: 0.78, gamma: 0.8, contrast: 1.12, sway: 0.6 };
  // fios do bigode, em pixels da fonte (323 x 400), da raiz à ponta
  const WHISKERS = [
    { amp: 1.0, phase: 0, dIn: 6, dOut: 14, pts: [[122.8, 239.5], [107.8, 239.2], [97.8, 235.8], [87.8, 230.8], [77.8, 225.8], [67.8, 217.0], [57.8, 208.8], [47.8, 200.0], [37.8, 194.2], [29.0, 191.2]] },
    { amp: 0.55, phase: 1.3, dIn: 3.5, dOut: 8, pts: [[150.2, 226.2], [160.2, 215.0], [164.0, 210.0], [167.5, 205.0], [170.8, 200.0], [174.0, 195.0], [177.0, 190.0], [179.0, 185.0], [180.8, 180.0], [182.2, 175.0], [183.8, 170.0], [184.8, 165.0], [185.5, 160.0], [186.2, 155.0], [186.2, 145.0], [185.2, 135.0], [182.8, 130.0], [179.0, 125.0], [176.5, 122.0]] },
  ];

  let src = null, SW = 0, SH = 0;   // a foto em cinza, 0 a 1
  let grid = null, base = null, moving = [];
  let step = 0, last = 0, raf = 0;

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
    grid = { cw, ch };
    const font = Math.round(ch * 0.9) + 'px "Fira Code", "DejaVu Sans Mono", ui-monospace, monospace';
    ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    moving = [];
    const inMoving = new Uint8Array(cols * rows);
    WHISKERS.forEach((w, wi) => {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = offX + (c + 0.5) * cw * scale, y = (r + 0.5) * ch * scale;
        const n = nearest(w, x, y);
        if (n.d >= w.dOut) continue;
        const weight = smooth(n.s) * (1 - smoothstep(w.dIn, w.dOut, n.d));
        if (weight < 0.002) continue;
        moving.push({ c, r, x, y, w: weight, wi });
        inMoving[r * cols + c] = 1;
      }
    });
    // o retrato parado, sem as células que se mexem
    base = document.createElement("canvas");
    base.width = canvas.width; base.height = canvas.height;
    const b = base.getContext("2d");
    b.font = font; b.textAlign = "center"; b.textBaseline = "middle"; b.fillStyle = INK;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (inMoving[r * cols + c]) continue;
      const i = glyphIndex(sample(offX + (c + 0.5) * cw * scale, (r + 0.5) * ch * scale));
      if (i > 0) b.fillText(GLYPHS[i], c * cw + cw / 2, r * ch + ch / 2 + ch * 0.04);
    }
    return true;
  }

  // envelope: o giro cresce e volta a zero ao longo dos 4,5 s; fora disso, o bigode fica parado
  const envelope = (s) => (s > 0 && s < PLAY_STEPS ? Math.sin(Math.PI * s / PLAY_STEPS) : 0);

  function draw(s) {
    if (!grid) return;
    const { cw, ch } = grid;
    const t = s * STEP_MS / 1000, e = envelope(s);
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
  }

  function tick(now) {
    raf = 0;
    if (now - last >= STEP_MS) { last = now; step++; draw(step); }
    if (step < PLAY_STEPS) raf = requestAnimationFrame(tick);
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  function pausedOnHome() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return !!(saved && saved.reduce === reduce.matches && saved.choice === "off");
    } catch (e) { return false; }
  }

  // desenha um instante qualquer, para a imagem parada e para conferir
  window.__dali = { drawAt: (s) => { draw(s); return canvas.toDataURL("image/png"); } };

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
      if (!reduce.matches && !pausedOnHome()) raf = requestAnimationFrame(tick);
      if ("ResizeObserver" in window) {
        let pending = 0;
        new ResizeObserver(() => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => { if (layout()) { draw(step); root.classList.add("is-drawn"); } }); }).observe(canvas);
      }
    });
  };
  img.src = root.dataset.dali;
})();
