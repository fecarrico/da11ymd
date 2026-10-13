// A gota da primeira seção, como as gotas se formam de verdade.
//
// Perto do botão de pausa, a borda do lago do hero começa a ceder: uma barriga
// rasa de água que cresce devagar no mesmo lugar. Do meio dela nasce a gota,
// que incha sem degraus: primeiro uma lente, depois meia esfera, depois uma
// pera, com o bojo pesando embaixo. Quando pesa demais, um pescoço se forma e
// fecha de repente, e ela se solta. A barriga se recolhe, a borda ondula para
// os dois lados e fica seca, e o ciclo recomeça do zero. A gota cai redonda, e
// a poça na base da seção cresce a cada gota, devagar, até ocupar a parte de
// baixo da seção.
//
// Desenho por código (a referência do Felipe está em source/referencia-gotas.png).
// Água é transparente: um contorno fino e nítido, como o logotipo do hero, e
// por dentro caracteres claros como os do lago, um pouco mais escuros junto da
// borda de baixo (a refração) e vazios no brilho. Barriga e gota têm um
// contorno só. A poça e a ondulação dela são só caracteres, como o lago.
//
// A borda é a borda de baixo do lago (EDGE_ART, a mesma FLAT_EDGE de hero.js),
// que fica presa ao pé do hero quando a água achata no paralaxe.
//
// Clarões: a ondulação da borda e a gota em queda só se deslocam, com a grade
// dos caracteres presa a elas. A barriga e a gota mudam sempre no mesmo
// sentido enquanto crescem; o pescoço e a queda acontecem uma vez por ciclo.
// A poça só muda quando uma gota cai, no máximo a cada 250 ms.
//
// Movimento: segue o botão "Pausar animação" do hero (evento dally:motion) e,
// por ele, prefers-reduced-motion. A gota cai numa faixa sem texto: a coluna
// da direita a partir de 60em, ou uma margem reservada à direita do texto
// entre 40em e 60em. No celular, nada aparece.

const INK = '#141414';
const OUTLINE = 'rgba(20,20,20,0.85)';
const TOP_PAD = 90;          // o canvas começa esse tanto acima do pé do hero, em px
const EDGE_ART = 870;        // borda de baixo do lago, em unidades de arte (FLAT_EDGE em hero.js)
const ATTACH_DOWN = 3;       // a água pendura esse tanto abaixo da borda do lago, px
const X_FROM_RIGHT = 294;    // a gota se forma esse tanto antes da borda direita, px: onde ficava,
                             // 90 px antes do botão de pausa, quando ele morava no pé do hero (até 13/10)
const GRAVITY = 1400;        // px/s²
const R_MAX = 9;             // raio do bojo quando a gota se solta, px
const REST_MS = 1200;        // a borda fica seca isso depois que a gota cai
const BULGE_MS = 2800;       // a barriga leva isso para se formar
const GROW_S = 4.2;          // e a gota, isso para encher
const NECK_MS = 160;         // o pescoço fecha nesse tempo
const RECOIL_MS = 250;       // a barriga se recolhe nesse tempo
const WAVE_V = 110;          // velocidade da ondulação na borda, px/s
const WAVE_LIFE = 0.7;       // s, constante de queda da ondulação
const PUDDLE_START = 2;      // a poça começa como se duas gotas já tivessem caído
const RIPPLE_LIFE = 1.4;     // s
const MIN_GAP_MS = 250;      // intervalo mínimo entre duas trocas da poça

const rand = (a, b) => a + Math.random() * (b - a);
const smooth = (t) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };
const FILL = 'rgba(255,255,255,0.9)';

async function bootDrip() {
  const hero = document.querySelector('.hero');
  const button = hero?.querySelector('.hero__motion');
  const artBox = hero?.querySelector('.hero__art-box');
  const intro = document.querySelector('.intro');
  const text = intro?.querySelector('.intro__text');
  if (!hero || !button || !artBox || !intro || !text) return;

  const [look, glyphMeta, scene] = await Promise.all([
    fetch('look.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    fetch('glyphs.json').then((r) => r.json()),
    fetch('layers.json').then((r) => r.json()),
  ]);
  const chars = [...glyphMeta.chars];
  const mode = look.mode === 0 ? 0 : 1;
  const [artW, artH] = scene.art;
  const overscan = scene.overscan || 0;
  const wide = window.matchMedia('(min-width: 60em)');
  const medium = window.matchMedia('(min-width: 40em)');

  const canvas = document.createElement('canvas');
  canvas.className = 'drip';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const field = document.createElement('canvas');
  const fctx = field.getContext('2d', { willReadFrequently: true });
  const group = document.createElement('canvas');   // barriga + gota, para o contorno único
  const gctx = group.getContext('2d');

  let dpr = 1, W = 0, H = 0, cw = 3, ch = 5;
  let x0 = 0, puddleY = 0, edge = 0, enabled = false;
  let atlas = null, atlasInv = null;
  let sprites = new Map();

  // o ciclo: 'rest' (borda seca), 'bulge' (a barriga cresce), 'grow' (a gota
  // incha), 'neck' (o pescoço fecha)
  let phase = 'grow';
  let phaseAt = 0;
  let vol = 0.45;                // 0 a 1; primeiro quadro: meia esfera
  let recoil = null;             // { at, w, d } enquanto a barriga se recolhe
  let waves = [];
  let falling = null;
  let splashes = [];
  let ripples = [];
  let drops = PUDDLE_START;
  let puddleW = 0, puddleAt = -1e9;
  let clock = 0;

  let running = document.documentElement.dataset.motion === 'on';
  let visible = false;
  let frame = 0;
  let last = 0;

  function buildAtlas() {
    // caractere em tinta (tom claro) e o negativo: célula em tinta com o caractere vazado
    const n = chars.length;
    const make = (inverse) => {
      const c = document.createElement('canvas');
      c.width = cw * n;
      c.height = ch;
      const g = c.getContext('2d');
      g.font = `${Math.round(ch * 0.9)}px "Fira Code", "DejaVu Sans Mono", ui-monospace, monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = INK;
      if (inverse) g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = inverse ? 'destination-out' : 'source-over';
      chars.forEach((chr, i) => g.fillText(chr, i * cw + cw / 2, ch / 2 + ch * 0.04));
      return c;
    };
    atlas = make(false);
    atlasInv = make(true);
  }

  // Carimbo para a poça: a densidade (alfa) vira caractere (ou ponto) célula a
  // célula. paint desenha no campo em px CSS, com a origem no canto de cima.
  function stamp(key, wCss, hCss, paint) {
    const hit = sprites.get(key);
    if (hit) return hit;
    const cols = Math.max(1, Math.ceil((wCss * dpr) / cw));
    const rows = Math.max(1, Math.ceil((hCss * dpr) / ch));
    field.width = cols;
    field.height = rows;
    fctx.setTransform(dpr / cw, 0, 0, dpr / ch, 0, 0);
    fctx.fillStyle = FILL;
    paint(fctx);
    const px = fctx.getImageData(0, 0, cols, rows).data;
    const c = document.createElement('canvas');
    c.width = cols * cw;
    c.height = rows * ch;
    const g = c.getContext('2d');
    g.fillStyle = INK;
    const n = chars.length;
    for (let i = 0, y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++, i++) {
        const D = px[i * 4 + 3] / 255;
        if (D < 0.06) continue;
        if (mode === 0) {
          const inv = D > 0.5;
          const idx = Math.round((inv ? (1 - D) * 2 : D * 2) * (n - 1));
          if (!inv && idx === 0) continue;
          g.drawImage(inv ? atlasInv : atlas, idx * cw, 0, cw, ch, x * cw, y * ch, cw, ch);
        } else {
          g.beginPath();
          g.arc(x * cw + cw / 2, y * ch + ch / 2, Math.sqrt(D) * 0.6 * cw, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    sprites.set(key, c);
    return c;
  }

  // ---------- formas, em px CSS da página ----------

  // Perfil da gota presa na borda (y = 0 é a borda), pelo volume v (0 a 1) e
  // pelo pescoço (0 = sem pescoço, 1 = fechado): a meia largura x em cada y.
  // Pequena, é uma lente; com meia carga, meia esfera; cheia, uma pera, com o
  // bojo descendo. O pescoço se forma entre o bojo e a borda.
  function profile(v, neck) {
    const R = R_MAX * Math.cbrt(Math.max(v, 0.005));
    const ry = R * (1 + 0.08 * v);
    const c = R * (-0.6 + 1.85 * smooth(v)) + R * 0.45 * neck;   // centro do bojo
    const a = Math.min(R * 0.95, R_MAX * 0.75);                    // meia largura de contato
    const n = (a + (0.62 * R - a) * smooth((c / R - 0.3) / 0.95)) * (1 - neck);
    const yn = Math.max(0, c - 0.8 * R);                           // altura do pescoço
    const L = c + ry;
    const pts = [];
    for (let y = 0; y <= L; y += 0.5) {
      let x;
      if (c <= 0 || y >= c) x = R * Math.sqrt(Math.max(0, 1 - ((y - c) / ry) ** 2));
      else if (y >= yn) x = n + (R - n) * Math.sin(((y - yn) / (c - yn)) * Math.PI / 2);
      else x = n + (a - n) * (1 - y / yn) ** 2;
      pts.push([x, y]);
    }
    pts.push([0, L]);
    return { pts, R, ry, c, L };
  }

  function dropShape(v, neck, x, ay) {
    const { pts, R, ry, c, L } = profile(v, neck);
    // o contorno (aberto em cima, onde a gota é o próprio lago) e a área
    const trace = (path) => {
      for (let i = 0; i < pts.length; i++) path.lineTo(x - pts[i][0], ay + pts[i][1]);
      for (let i = pts.length - 1; i >= 0; i--) path.lineTo(x + pts[i][0], ay + pts[i][1]);
    };
    const line = new Path2D();
    line.moveTo(x - pts[0][0], ay + pts[0][1]);
    trace(line);
    const area = new Path2D();
    area.moveTo(x - pts[0][0], ay - 2);
    trace(area);
    area.lineTo(x + pts[0][0], ay - 2);
    area.closePath();
    const half = Math.max(...pts.map((q) => q[0]));
    const inBulb = bulbDens(x, ay + Math.max(c, 0), R, ry);
    return {
      line, area, box: [x - half, ay - 2, x + half, ay + L],
      dens: (xx, yy) => (yy < ay + c - R * 0.6 ? 0.2 : inBulb(xx, yy)),
    };
  }

  // barriga da borda: rasa e larga, com o perfil de um sino
  function bellShape(x, ay, w, d) {
    const trace = (path) => {
      path.lineTo(x - w, ay);
      for (let t = -w; t <= w; t += 1.5) path.lineTo(x + t, ay + d * Math.pow(Math.max(0, 1 - (t / w) ** 2), 1.6));
      path.lineTo(x + w, ay);
    };
    const line = new Path2D();
    line.moveTo(x - w, ay);
    trace(line);
    const area = new Path2D();
    area.moveTo(x - w, ay - 2);
    trace(area);
    area.lineTo(x + w, ay - 2);
    area.closePath();
    return { line, area, box: [x - w, ay - 2, x + w, ay + d], dens: (xx, yy) => 0.16 + 0.12 * Math.max(0, (yy - ay) / Math.max(d, 1)) };
  }

  function ballShape(r, stretch, x, yTop) {
    const ry = r * (1 + stretch), cy = yTop + ry;
    const line = new Path2D();
    line.ellipse(x, cy, r, ry, 0, 0, Math.PI * 2);
    return { line, area: line, box: [x - r, cy - ry, x + r, cy + ry], dens: bulbDens(x, cy, r, ry) };
  }

  // densidade dentro de um bojo de centro (cx, cy) e raios (R, ry): clara no
  // meio, mais escura junto da borda de baixo, vazia no brilho de cima
  function bulbDens(cx, cy, R, ry) {
    return (x, y) => {
      const u = (x - cx) / R, v = (y - cy) / ry;
      if (Math.hypot(u + 0.36, v + 0.4) < 0.3) return 0;
      const r = Math.hypot(u, v);
      return 0.14 + 0.3 * smooth((r - 0.45) / 0.55) * (0.55 + 0.45 * Math.max(0, v));
    };
  }

  // Desenha formas que se tocam como uma água só: o contorno de fora, sem as
  // linhas onde uma entra na outra, e por dentro caracteres claros com a grade
  // presa a (ax, ay). A primeira forma que contém a célula dá a densidade.
  function drawWater(shapes, ax, ay) {
    const bx = Math.floor(Math.min(...shapes.map((s) => s.box[0])) - 3);
    const by = Math.floor(Math.min(...shapes.map((s) => s.box[1])) - 3);
    const ex = Math.ceil(Math.max(...shapes.map((s) => s.box[2])) + 3);
    const ey = Math.ceil(Math.max(...shapes.map((s) => s.box[3])) + 3);
    group.width = Math.max(1, Math.ceil((ex - bx) * dpr));
    group.height = Math.max(1, Math.ceil((ey - by) * dpr));
    const g = gctx;
    const toGroup = () => g.setTransform(dpr, 0, 0, dpr, -bx * dpr, -by * dpr);
    // 1. o contorno com o dobro da espessura
    toGroup();
    g.strokeStyle = OUTLINE;
    g.lineWidth = 2.2;
    g.lineJoin = 'round';
    shapes.forEach((s) => g.stroke(s.line));
    // 2. o miolo de todas apaga a metade de dentro e as linhas internas
    g.globalCompositeOperation = 'destination-out';
    shapes.forEach((s) => g.fill(s.area));
    g.globalCompositeOperation = 'source-over';
    // 3. caracteres claros por dentro
    const union = new Path2D();
    shapes.forEach((s) => union.addPath(s.area));
    g.save();
    g.clip(union);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = INK;
    const n = chars.length;
    const ox = Math.round(ax * dpr), oy = Math.round(ay * dpr);
    const gx = Math.round(bx * dpr), gy = Math.round(by * dpr);
    const c0 = Math.floor((bx * dpr - ox) / cw), c1 = Math.ceil((ex * dpr - ox) / cw);
    const r0 = Math.floor((by * dpr - oy) / ch), r1 = Math.ceil((ey * dpr - oy) / ch);
    for (let j = r0; j < r1; j++) {
      for (let i = c0; i < c1; i++) {
        const cx = (ox + (i + 0.5) * cw) / dpr, cy = (oy + (j + 0.5) * ch) / dpr;
        toGroup();
        const s = shapes.find((q) => g.isPointInPath(q.area, (cx - bx) * dpr, (cy - by) * dpr));
        g.setTransform(1, 0, 0, 1, 0, 0);
        if (!s) continue;
        const D = Math.min(0.45, s.dens(cx, cy));
        if (D < 0.06) continue;
        if (mode === 0) {
          const idx = Math.round(D * 2 * (n - 1));
          if (idx > 0) g.drawImage(atlas, idx * cw, 0, cw, ch, ox + i * cw - gx, oy + j * ch - gy, cw, ch);
        } else {
          g.beginPath();
          g.arc(ox + (i + 0.5) * cw - gx, oy + (j + 0.5) * ch - gy, Math.sqrt(D) * 0.6 * cw, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.restore();
    ctx.drawImage(group, gx, gy);
  }

  // A poça: uma lâmina rasa, que se espalha a partir de onde a gota cai e,
  // perto da borda da página, só cresce para a esquerda.
  function puddleSpan(w) {
    const right = Math.min(W - 16 - x0, w / 2);
    const left = Math.min(x0 - 16, w - right);
    return [x0 - left, x0 + right];
  }
  function puddle(w) {
    const h = Math.min(16, 4 + w * 0.035);
    return stamp(`p|${w}`, w, h, (g) => {
      const end = Math.min(w / 2, 40);
      g.beginPath();
      g.moveTo(end, 0);
      g.lineTo(w - end, 0);
      g.ellipse(w - end, h / 2, end, h / 2, 0, -Math.PI / 2, Math.PI / 2);
      g.lineTo(end, h);
      g.ellipse(end, h / 2, end, h / 2, 0, Math.PI / 2, Math.PI * 1.5);
      g.closePath();
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(255,255,255,0.22)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0.3)');
      g.fillStyle = grad;
      g.fill();
    });
  }

  // uma célula só, para os respingos e o anel da ondulação da poça
  function cell(D) {
    const key = `c|${D}`;
    const hit = sprites.get(key);
    if (hit) return hit;
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const g = c.getContext('2d');
    g.fillStyle = INK;
    if (mode === 0) {
      const idx = Math.round(Math.min(D * 2, 1) * (chars.length - 1));
      g.drawImage(atlas, idx * cw, 0, cw, ch, 0, 0, cw, ch);
    } else {
      g.beginPath();
      g.arc(cw / 2, ch / 2, Math.sqrt(D) * 0.6 * cw, 0, Math.PI * 2);
      g.fill();
    }
    sprites.set(key, c);
    return c;
  }

  function put(img, x, y) {
    ctx.drawImage(img, Math.round(x * dpr - img.width / 2), Math.round(y * dpr - img.height / 2));
  }

  function puddleTarget() {
    // devagar: uns 4 a 5 minutos até ocupar a largura da seção
    return Math.round(Math.min(W - 32, 30 + 40 * Math.pow(drops, 0.9)) / 4) * 4;
  }

  // a barriga no ciclo: cresce, depois cede água para a gota, depois se recolhe
  function bulge(now) {
    if (phase === 'bulge') {
      const q = smooth((now - phaseAt) / BULGE_MS);
      return { w: 8 + 22 * q, d: 0.6 + 3.4 * q };
    }
    if (phase === 'grow' || phase === 'neck') return { w: 30 - 9 * vol, d: 4 - 1.4 * vol };
    if (recoil) {
      const k = 1 - (now - recoil.at) / RECOIL_MS;
      if (k > 0) return { w: recoil.w, d: recoil.d * k };
    }
    return null;
  }

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const heroBox = hero.getBoundingClientRect();
    const introBox = intro.getBoundingClientRect();
    const textBox = text.getBoundingClientRect();
    const top = heroBox.bottom + window.scrollY - TOP_PAD;
    W = document.documentElement.clientWidth;
    H = Math.max(1, introBox.bottom + window.scrollY - top);
    canvas.style.top = `${top}px`;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    // a borda de baixo do lago, presa ao pé do hero (a mesma conta de hero.js)
    const Ha = artBox.clientHeight;
    const fit = scene.narrow ? Math.min((Ha * 0.6) / artH, W / scene.narrow.width) : (Ha * 0.6) / artH;
    const scale = Math.max(W / (artW - 2 * overscan), fit);
    edge = TOP_PAD - (hero.clientHeight - (Ha - artH * scale + EDGE_ART * scale)) + ATTACH_DOWN;

    // grade igual à do hero
    const base = Math.max(3, Math.round((look.cell || 3) * dpr));
    cw = base;
    ch = mode === 0 ? Math.round(base / 0.6) : base;
    buildAtlas();
    sprites = new Map();

    puddleY = H - 48;
    // a gota se forma perto da borda direita; entre 40em e 60em, na margem
    // reservada à direita do texto
    if (wide.matches) {
      x0 = W - X_FROM_RIGHT;
      enabled = x0 - R_MAX * 3 > textBox.right + 48;
    } else if (medium.matches) {
      x0 = W - 40;
      enabled = textBox.right < x0 - 30;
    } else {
      x0 = W - 40;
      enabled = false;
    }
    enabled = enabled && !button.hidden;
    canvas.hidden = !enabled;
    canvas.dataset.tip = String(Math.round(x0));
    puddleW = puddleTarget();
  }

  function enter(p, now) { phase = p; phaseAt = now; canvas.dataset.phase = p; }

  function step(dt, now) {
    const t = now - phaseAt;
    if (phase === 'rest' && t >= REST_MS) enter('bulge', now);
    else if (phase === 'bulge' && t >= BULGE_MS) { enter('grow', now); vol = 0.03; }
    else if (phase === 'grow') {
      vol = Math.min(1, vol + dt / GROW_S);
      if (vol >= 1) enter('neck', now);
    } else if (phase === 'neck' && t >= NECK_MS) {
      // solta: a gota cai, a barriga se recolhe e a borda ondula para os lados
      const { c, ry } = profile(1, 1);
      falling = { y: edge + c - ry, v: 40, at: now, r: R_MAX };
      const b = bulge(now);
      recoil = { at: now, w: b.w, d: b.d };
      waves.push({ x: x0, dir: -1, at: now }, { x: x0, dir: 1, at: now });
      vol = 0;
      enter('rest', now);
    }
    if (recoil && now - recoil.at >= RECOIL_MS) recoil = null;

    waves = waves.filter((w) => {
      w.x += w.dir * WAVE_V * dt;
      return Math.exp(-(now - w.at) / 1000 / WAVE_LIFE) * 2.4 > 0.35;
    });

    if (falling) {
      falling.v += GRAVITY * dt;
      falling.y += falling.v * dt;
      if (falling.y + falling.r * 2 >= puddleY) {
        drops++;
        ripples.push({ t: 0 });
        for (let i = 0; i < 3; i++) splashes.push({ x: x0, y: puddleY - 3, vx: rand(-60, 60), vy: rand(-150, -90), t: 0 });
        falling = null;
      }
    }
    if (now - puddleAt >= MIN_GAP_MS) {
      const w = puddleTarget();
      if (w !== puddleW) { puddleW = w; puddleAt = now; }
    }
    splashes = splashes.filter((s) => {
      s.t += dt;
      s.vy += GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      return s.y < puddleY && s.t < 0.8;
    });
    ripples.forEach((r) => { r.t += dt; });
    ripples = ripples.filter((r) => r.t < RIPPLE_LIFE);
  }

  function draw(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!enabled) return;

    // a ondulação que corre pela borda depois da queda
    waves.forEach((w) => {
      const amp = Math.exp(-(now - w.at) / 1000 / WAVE_LIFE) * 2.4;
      drawWater([bellShape(w.x, edge, 12, amp)], w.x, edge);
    });
    // a barriga e a gota, como uma água só
    const shapes = [];
    const b = bulge(now);
    if (b && b.d > 0.3) shapes.push(bellShape(x0, edge, b.w, b.d));
    if ((phase === 'grow' || phase === 'neck') && vol > 0) {
      const neck = phase === 'neck' ? Math.min(1, (now - phaseAt) / NECK_MS) : 0;
      shapes.unshift(dropShape(vol, neck, x0, edge));
    }
    if (shapes.length) drawWater(shapes, x0, edge);

    // a poça e a ondulação dela
    const [pl, pr] = puddleSpan(puddleW);
    const pw = Math.round(pr - pl);
    if (pw > 4) {
      const img = puddle(pw);
      ctx.drawImage(img, Math.round(pl * dpr), Math.round(puddleY * dpr - img.height / 2));
    }
    const ring = cell(0.45);
    ripples.forEach((r) => {
      const k = r.t / RIPPLE_LIFE;
      const e = 1 - (1 - k) * (1 - k);
      const rx = 6 + Math.min(140, Math.max(pw, 60) * 0.5) * e;
      const ry = Math.min(rx * 0.16, 9);
      const count = Math.max(10, Math.round((Math.PI * rx) / 5));
      ctx.globalAlpha = 1 - k;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const x = x0 + Math.cos(a) * rx;
        if (x < pl - 4 || x > pr + 4) continue;
        put(ring, x, puddleY + Math.sin(a) * ry);
      }
      ctx.globalAlpha = 1;
    });

    if (falling) {
      const s = ballShape(falling.r, 0.2 * Math.exp(-(now - falling.at) / 90), x0, falling.y);
      drawWater([s], x0, falling.y + falling.r);
    }
    const spl = cell(0.6);
    splashes.forEach((q) => put(spl, q.x, q.y));
  }

  function tick(now) {
    frame = 0;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    clock += dt * 1000;
    step(dt, clock);
    draw(clock);
    schedule();
  }

  function schedule() {
    if (frame || !running || !visible || !enabled || document.hidden) { last = 0; return; }
    frame = requestAnimationFrame(tick);
  }

  const relayout = () => { layout(); draw(clock); schedule(); };
  // O hero mostra o botão de pausa só quando a cena começa, e isso pode chegar
  // antes ou depois deste arquivo. Sem o botão, a gota não existe (não haveria
  // como pausar); quando ele aparece, ou a animação muda, tudo é recalculado.
  document.addEventListener('dally:motion', (e) => {
    running = e.detail.running;
    if (!running && frame) { cancelAnimationFrame(frame); frame = 0; }
    relayout();
  });
  new MutationObserver(relayout).observe(button, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', schedule);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }, { rootMargin: '120px' }).observe(intro);
  new ResizeObserver(relayout).observe(document.body);
  running = document.documentElement.dataset.motion === 'on';
  relayout();
}

bootDrip().catch((err) => console.error('[dally.md gotas]', err));
