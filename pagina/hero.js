// dally.md — hero em camadas com textura de células (pontos, ASCII ou pixels), em WebGL2.
//
// Cada camada tem a própria grade de células, e a grade anda junto com ela
// no paralaxe: as células não ficam trocando enquanto as camadas deslizam.
// A tromba e a água se mexem na amostragem de cada célula, então o movimento
// acontece nas próprias células, que continuam alinhadas.
//
// A cena troca de quadro no máximo STEP_HZ vezes por segundo, por construção:
// o relógio do shader anda em degraus, e os ajustes do laboratório respeitam
// o mesmo intervalo. Nenhuma célula muda mais de 4 vezes por segundo, então
// nada pisca mais de 2 vezes por segundo (SC 2.3.1 e 2.3.2), em qualquer tela.
//
// Sem JavaScript ou sem WebGL, fica a imagem parada (poster.webp).
// Com prefers-reduced-motion, a cena começa parada; o botão do hero liga ou
// desliga todo o movimento (tromba, água e paralaxe), e a escolha fica salva
// enquanto a preferência do sistema não mudar.

// padrão de reserva; o padrão de verdade é hero/look.json, o bloco que o Felipe copia do laboratório
const FALLBACK = Object.freeze({ cell: 4, mode: 1, contrast: 1.1, gamma: 0.9, parallax: 0.4, hparallax: 1, trunk: 0.6, water: 0.6, reflect: 1, twinkle: 0.4, logo: { light: 0.6, angle: 60, base: 1, halo: 1, reflection: 0.5 } });
const STEP_HZ = 4;
const MIN_GAP_MS = 1000 / STEP_HZ;
const STORAGE_KEY = 'dally-motion';
const PARAMS = new URLSearchParams(location.search);
const POSTER = PARAMS.has('poster');
// ?poster&scale=0.95 renderiza a imagem parada noutra escala (ex.: a imagem do topo do repositório)
const POSTER_SCALE = Number(PARAMS.get('scale')) || 1.5;
// escala da arte num desktop de 1440 px: a célula do poster mantém essa proporção
const REF_SCALE = 1440 / 2103;
// reflexo na água, por tipo de camada espelhada: força e comprimento (em unidades de arte)
const REFLECT = { elephant: [0.9, 240], plain: [0.5, 60], logo: [0.6, 170] };
// borda de baixo do lago, em unidades de arte (medida): fica presa ao pé do hero
// quando a água achata no paralaxe. drip.js usa o mesmo número (EDGE_ART).
const FLAT_EDGE = 870;
// tela estreita: o logotipo cresce até 15% e sobe 65% do papel que sobra
// acima da arte, para ficar no meio do céu
const LOGO_GROW = 0.15;
const LOGO_LIFT = 0.65;
// paralaxe horizontal: deslocamento máximo da camada da frente (depth 1), em unidades de arte
const HSHIFT_ART = 24;
// frase do topo (texto de verdade, 1,25rem, não é texto grande): a luz nunca
// tira mais de 10% da tinta de uma célula, e a base não desce de 90%.
// Pior caso medido: 7,59:1 (Shield 7:1)
const TEXT_FLOOR = 0.9;
const TEXT_MIN_BASE = 0.9;
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const VERT = `#version 300 es
in vec2 aPos;
uniform vec4 uQuad;
uniform vec2 uRes;
void main() {
  vec2 px = uQuad.xy + aPos * uQuad.zw;
  vec2 clip = px / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

uniform sampler2D uTex;
uniform sampler2D uGlyphs;
uniform sampler2D uRef0;
uniform sampler2D uRef1;
uniform sampler2D uRef2;
uniform sampler2D uRef3;

uniform vec2 uRes;
uniform float uScale;      // px do canvas por unidade de arte
uniform vec2 uOrigin;      // px do canvas onde fica a arte (0,0)
uniform vec2 uOffset;      // deslocamento do paralaxe desta camada, em px
uniform vec4 uRect;        // retângulo da camada, em unidades de arte
uniform float uTexelsPerArt;
uniform vec2 uCell;        // célula em px do canvas (largura, altura)
uniform int uMode;         // 0 ASCII · 1 pontos · 2 pixels · 3 original (sem textura)
uniform int uKind;         // 0 comum · 1 água · 2 elefante · 3 logotipo · 4 céu
uniform float uTime;       // relógio em degraus de 1/STEP_HZ s
uniform float uInk;        // força da tinta da camada
uniform float uOcclude;    // 1: o papel da camada cobre o fundo · 0: só a tinta cobre
uniform float uContrast;
uniform float uGamma;
uniform vec3 uPaper;
uniform vec3 uInkColor;
uniform float uPaperL;
uniform float uGlyphCount;

uniform vec4 uTrunk;       // base.xy, ponta.xy
uniform vec2 uTrunkBand;   // faixa vertical da tromba
uniform float uTrunkAmp;
uniform float uTrunkPhase;

uniform float uRawAlpha;   // opacidade de camada sem textura (papel em volta do logotipo)
uniform float uLogoBase;   // opacidade da tinta do PNG do logotipo, 0–1
uniform float uLight;      // luz sobre o logotipo, 0–1
uniform vec2 uLightFrom;   // de onde a luz vem, vetor unitário (y para baixo)
uniform float uWater;
uniform float uWaterTop;
uniform vec4 uRefRect0;
uniform vec4 uRefRect1;
uniform vec4 uRefRect2;
uniform vec4 uRefRect3;
uniform vec4 uFlat;        // água achatada: topo e borda (px do canvas), topo e borda (unidades de arte); z = w desliga
uniform vec4 uRefAxis;     // eixo do espelho na camada refletida (y)
uniform vec4 uRefStart;    // onde o reflexo começa na água (y)
uniform vec4 uRefSquash;   // 1 = espelho fiel; < 1 = reflexo achatado
uniform vec4 uRefTpa;
uniform vec4 uRefStrength;
uniform vec4 uRefFade;     // comprimento de cada reflexo
uniform vec4 uRefShiftX;   // deslocamento horizontal da amostra (reflexo que não acompanha a água)
uniform float uSpillTop;   // fim da arte (y), onde a água começa a invadir a página
uniform float uSpill;      // altura da faixa de invasão, em unidades de arte
uniform float uSpillPx;    // a mesma faixa, em px do canvas
uniform float uTwinkle;    // cintilar das estrelas, 0–1

out vec4 outColor;

const int BAYER[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
// no logotipo, nenhuma célula tem menos de 60% de tinta: a luz dá textura, não apaga a letra
const float LOGO_FLOOR = 0.6;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

vec4 sampleLayer(sampler2D tex, vec4 rect, vec2 c, float lod) {
  vec2 uv = (c - rect.xy) / rect.zw;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
  return textureLod(tex, uv, lod);
}

// escuridão da camada pousada sobre o papel, a partir da amostra pré-multiplicada
float darknessOf(vec4 s) {
  float tone = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722)) + uPaperL * (1.0 - s.a);
  return clamp((uPaperL - tone) / uPaperL, 0.0, 1.0);
}

float reflectFrom(sampler2D tex, vec4 rect, float axisY, float startY, float squash, float tpa, float strength, float len, float shiftX, vec2 c, float cellArt, float k) {
  if (strength <= 0.0 || c.y <= startY) return 0.0;
  // k: quanto a água está achatada; a distância vale o que se vê na tela
  float d = (c.y - startY) * k;
  float fade = 1.0 - smoothstep(0.0, len, d);
  float lod = log2(max(1.0, cellArt * tpa / squash));
  return darknessOf(sampleLayer(tex, rect, vec2(c.x + shiftX, axisY - d / squash), lod)) * fade * strength;
}

// quanto da célula vira tinta, para um tom Dt (0 papel, 1 tinta), no modo da cena
float coverage(float Dt, vec2 f, vec2 cell) {
  if (uMode == 0) {
    // um caractere sozinho cobre no máximo ~45% da célula. Da metade do tom
    // para cima, a célula vira negativo: fundo de tinta, caractere vazado.
    bool inv = Dt > 0.5;
    float level = inv ? (1.0 - Dt) * 2.0 : Dt * 2.0;
    float idx = floor(level * (uGlyphCount - 1.0) + 0.5);
    vec2 texel = floor(f * uCell) + 0.5;
    float glyph = texture(uGlyphs, vec2((idx * uCell.x + texel.x) / (uGlyphCount * uCell.x), texel.y / uCell.y)).r;
    return inv ? 1.0 - glyph : glyph;
  }
  if (uMode == 1) {
    float r = sqrt(Dt) * 0.6;
    float aa = 1.0 / uCell.x;
    return Dt > 0.0 ? 1.0 - smoothstep(r - aa, r + aa, length(f - 0.5)) : 0.0;
  }
  ivec2 b = ivec2(mod(cell, 4.0));
  float th = (float(BAYER[b.x + b.y * 4]) + 0.5) / 16.0;
  vec2 q = abs(f - 0.5);
  return (Dt > th && max(q.x, q.y) < 0.42) ? 1.0 : 0.0;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);

  if (uMode == 3) {
    vec2 c = (p - uOrigin - uOffset) / uScale;
    float lod0 = log2(max(1.0, uTexelsPerArt / uScale));
    outColor = sampleLayer(uTex, uRect, c, lod0) * uRawAlpha;
    return;
  }

  // a grade começa num pixel inteiro: a célula anda de pixel em pixel, sempre nítida
  vec2 layerPx = floor(uOrigin + uOffset + uRect.xy * uScale + 0.5);
  vec2 g = (p - layerPx) / uCell;
  vec2 cell = floor(g);
  vec2 f = fract(g);
  vec2 c = (layerPx + (cell + 0.5) * uCell - uOrigin - uOffset) / uScale;
  float cellArt = sqrt(uCell.x * uCell.y) / uScale;
  float lod = log2(max(1.0, cellArt * uTexelsPerArt));

  // água achatada pelo paralaxe: o topo acompanha a margem (a terra), a borda
  // de baixo do lago fica presa ao pé do hero, e entre os dois cada linha de
  // células continua mostrando a mesma faixa de água, só que mais baixa. Os
  // caracteres achatam junto, sem arrastar pela grade.
  float flatK = 1.0;
  if (uKind == 1 && uFlat.w > uFlat.z) {
    float topPx = floor(uFlat.x + 0.5), edgePx = floor(uFlat.y + 0.5);
    flatK = (edgePx - topPx) / ((uFlat.w - uFlat.z) * uScale);
    if (p.y >= topPx) {
      bool mid = p.y < edgePx;
      float gy = mid ? (p.y - topPx) / (uCell.y * flatK) : (p.y - edgePx) / uCell.y;
      cell.y = floor(gy);
      f.y = fract(gy);
      c.y = (mid ? uFlat.z : uFlat.w) + (cell.y + 0.5) * uCell.y / uScale;
    }
  }

  // logotipo: o contorno vem do PNG no pixel, nítido, sem passar pela grade.
  // A luz entra em células só por dentro da letra: do lado de onde ela vem,
  // caracteres vazados em papel; do outro, tinta cheia.
  if (uKind == 3) {
    vec2 cp = (p - uOrigin - uOffset) / uScale;
    float A = sampleLayer(uTex, uRect, cp, log2(max(1.0, uTexelsPerArt / uScale))).a;
    if (A <= 0.003) { outColor = vec4(0.0); return; }
    vec2 q = (c - (uRect.xy + uRect.zw * 0.5)) / uRect.z;
    float lit = clamp(0.5 + dot(q, uLightFrom) * 1.6, 0.0, 1.0);
    float Dl = 1.0 - lit * lit * uLight * (1.0 - LOGO_FLOOR);
    // a luz é o que a célula perde de tinta em relação à letra sem luz (assim,
    // em pontos e pixels, o vão natural entre células não conta como luz)
    float lightK = max(0.0, coverage(1.0, f, cell) - coverage(Dl, f, cell));
    // a base (a tinta do PNG) tem opacidade ajustável; a luz em caracteres segue opaca
    float inkA = (1.0 - lightK) * uLogoBase;
    outColor = vec4((uInkColor * inkA + uPaper * lightK) * A, (inkA + lightK) * A);
    return;
  }

  // tromba: cada célula amostra a tromba girada em torno da base;
  // mais perto da ponta, mais giro. A curva acontece nas células.
  if (uKind == 2) {
    float span = uTrunk.z - uTrunk.x;
    float t = clamp((c.x - uTrunk.x) / span, 0.0, 1.0);
    float band = smoothstep(uTrunkBand.x - 14.0, uTrunkBand.x, c.y)
               * (1.0 - smoothstep(uTrunkBand.y, uTrunkBand.y + 14.0, c.y));
    float w = t * t * (3.0 - 2.0 * t) * band;
    float ang = uTrunkAmp * w * sign(span)
              * (0.10 * sin(uTime * 1.05 + uTrunkPhase) + 0.035 * sin(uTime * 1.9 + uTrunkPhase * 1.7));
    vec2 d = c - uTrunk.xy;
    float ca = cos(ang), sa = sin(ang);
    c = uTrunk.xy + vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y);
  }

  // água: a linha de células desliza devagar na horizontal e o tom respira
  float waterW = 0.0;
  if (uKind == 1) {
    waterW = smoothstep(uWaterTop, uWaterTop + 20.0, c.y);
    c.x += uWater * waterW * 14.0 * (vnoise(vec2(c.y * 0.09, uTime * 0.35)) - 0.5);
  }

  vec4 s = sampleLayer(uTex, uRect, c, lod);
  float D = darknessOf(s);

  if (uKind == 1 && waterW > 0.0) {
    D = clamp(D * (1.0 + uWater * waterW * 0.6 * (vnoise(vec2(c.x * 0.015 - uTime * 0.12, c.y * 0.22 + uTime * 0.05)) - 0.5)), 0.0, 1.0);
    // reflexos: elefantes pela linha dos pés, templo e ciprestes pela linha d'água
    float R = reflectFrom(uRef0, uRefRect0, uRefAxis.x, uRefStart.x, uRefSquash.x, uRefTpa.x, uRefStrength.x, uRefFade.x, uRefShiftX.x, c, cellArt, flatK);
    R = max(R, reflectFrom(uRef1, uRefRect1, uRefAxis.y, uRefStart.y, uRefSquash.y, uRefTpa.y, uRefStrength.y, uRefFade.y, uRefShiftX.y, c, cellArt, flatK));
    R = max(R, reflectFrom(uRef2, uRefRect2, uRefAxis.z, uRefStart.z, uRefSquash.z, uRefTpa.z, uRefStrength.z, uRefFade.z, uRefShiftX.z, c, cellArt, flatK));
    R = max(R, reflectFrom(uRef3, uRefRect3, uRefAxis.w, uRefStart.w, uRefSquash.w, uRefTpa.w, uRefStrength.w, uRefFade.w, uRefShiftX.w, c, cellArt, flatK));
    D = 1.0 - (1.0 - D) * (1.0 - clamp(R, 0.0, 1.0));
  }

  // a água invade a página: abaixo da arte, ela se desfaz em células cada vez
  // mais raras, com borda irregular (parada, sem relógio). Perto do pé do
  // canvas tudo já sumiu, para o paralaxe nunca mostrar um corte seco.
  if (uKind == 1) {
    float edge = uSpillTop + uSpill * (0.55 + 0.4 * vnoise(vec2(c.x * 0.011, 3.7)));
    D *= 1.0 - smoothstep(uSpillTop - 30.0, edge, c.y);
    D *= 1.0 - smoothstep(uRes.y - uSpillPx * 0.3, uRes.y - 2.0, p.y);
  }

  // estrelas: cada uma pulsa devagar (3 a 7 s por ciclo), com fase própria,
  // e só perde parte da tinta. O planeta e as massas grandes ficam de fora.
  if (uKind == 4 && uTwinkle > 0.0) {
    float coarse = darknessOf(sampleLayer(uTex, uRect, c, lod + 4.0));
    float small = 1.0 - smoothstep(0.15, 0.35, coarse);
    vec2 id = floor(c / 18.0);
    float tw = 0.5 + 0.5 * sin(uTime * (0.9 + 1.2 * hash(id + 7.1)) + 6.2832 * hash(id));
    D *= 1.0 - uTwinkle * 0.6 * small * tw;
  }

  D *= uInk;
  float Dt = D < 0.035 ? 0.0 : pow(clamp(D * uContrast, 0.0, 1.0), uGamma);

  float cov = coverage(Dt, f, cell);

  // a célula é da camada ou não é: o papel cobre o que está atrás por
  // inteiro, para duas grades desencontradas não sobreporem meia célula.
  // Em figuras (elefantes, logo), só o miolo escuro cobre o fundo; na borda
  // entra só a tinta, para o contorno não virar caixa de papel.
  // A tinta entra inteira, para o desenho ficar nítido.
  float pa = step(0.18, s.a) * max(uOcclude, step(0.45, D));
  outColor = vec4(uInkColor * cov + uPaper * pa * (1.0 - cov), cov + pa * (1.0 - cov));
}`;

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`não carregou ${src}`));
    img.src = src;
  });
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

function makeProgram(gl) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

function makeTexture(gl, img) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

// a escolha do botão vale enquanto a preferência do sistema for a mesma de
// quando ela foi feita; se a pessoa mudar a preferência, a preferência vence
function readStoredMotion(reduceNow) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.reduce === reduceNow && (saved.choice === 'on' || saved.choice === 'off')) return saved.choice;
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* sem armazenamento ou valor antigo: segue a preferência */ }
  return null;
}

function storeMotion(choice, reduceNow) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, reduce: reduceNow })); } catch { /* vale só nesta visita */ }
}

function forgetMotion() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* nada a esquecer */ }
}

async function boot() {
  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const canvas = hero.querySelector('.hero__canvas');
  const toggle = hero.querySelector('.hero__motion');
  const toggleLabel = toggle.querySelector('.hero__motion-label');
  if (POSTER) root.classList.add('poster-mode');

  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: POSTER });
  if (!gl) return; // fica o poster

  const [layout, glyphMeta] = await Promise.all([
    fetch('layers.json').then((r) => r.json()),
    fetch('glyphs.json').then((r) => r.json()),
  ]);
  const look = await fetch('look.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const layerImgs = await Promise.all(layout.layers.map((l) => loadImage(l.file)));

  const prog = makeProgram(gl);
  gl.useProgram(prog);
  const locs = new Map();
  const U = (name) => {
    if (!locs.has(name)) locs.set(name, gl.getUniformLocation(prog, name));
    return locs.get(name);
  };

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const layers = layout.layers.map((l, i) => ({ ...l, tex: makeTexture(gl, layerImgs[i]) }));
  const reflected = layers.filter((l) => l.mirrorY !== undefined || l.reflect).slice(0, 4);
  // a água se prende à margem: a camada espelhada pela linha d'água (o horizonte)
  const lakeLayer = layers.find((l) => l.kind === 'lake');
  const shore = lakeLayer && layers.find((l) => l.mirrorY === lakeLayer.waterTop);
  const SHORE_DEPTH = shore ? shore.depth : 0.3;
  // quem está de pé na água (elefantes, rochas) anda com a água no pé, e não
  // com a própria profundidade: senão descola dela quando a água achata
  const STANDS = new Set(lakeLayer ? layers.filter((l) => l !== lakeLayer
    && !['logo', 'logo-halo', 'lines', 'sky'].includes(l.kind)
    && l.rect[1] < lakeLayer.waterTop && l.rect[1] + l.rect[3] > lakeLayer.waterTop) : []);
  const [artW, artH] = layout.art;
  const overscan = layout.overscan || 0;
  const spill = layout.spill || 0;
  const narrow = layout.narrow;
  const artBox = hero.querySelector('.hero__art-box');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const paper = hexToRgb(layout.paper);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.uniform1i(U('uTex'), 0);
  gl.uniform1i(U('uGlyphs'), 1);
  ['uRef0', 'uRef1', 'uRef2', 'uRef3'].forEach((name, i) => gl.uniform1i(U(name), 2 + i));
  gl.uniform3fv(U('uPaper'), paper);
  gl.uniform3fv(U('uInkColor'), hexToRgb('#141414'));
  gl.uniform1f(U('uPaperL'), luminance(paper));
  gl.uniform1f(U('uGlyphCount'), [...glyphMeta.chars].length);

  // ajustes: os da cena inteira e, por cima, os de cada camada
  // ajustes: os da cena inteira, os do logotipo e, por cima, os de cada camada
  // camada com "look" usa os ajustes de outra (as nuvens da direita, o céu alto)
  const tunable = layers.filter((l) => !l.raw && l.kind !== 'logo' && !l.look);
  const defaults = {
    ...FALLBACK,
    ...look,
    logo: { ...FALLBACK.logo, ...(look.logo || {}) },
    layers: Object.fromEntries(tunable.map((l) => [l.name, { ink: l.ink, contrast: 1, gamma: 1, ...(look.layers?.[l.name] || {}) }])),
  };
  const settings = structuredClone(defaults);

  // atlas dos caracteres desenhado no tamanho exato da célula, em pixels
  // inteiros: o caractere sai nítido, sem virar cinza ao encolher.
  // A ordem da rampa (glyphs.json) foi medida pela tinta de cada caractere.
  const atlases = new Map();
  function atlasFor(cw, ch) {
    const key = `${cw}x${ch}`;
    if (atlases.has(key)) return atlases.get(key);
    const chars = [...glyphMeta.chars];
    const atlas = document.createElement('canvas');
    atlas.width = cw * chars.length;
    atlas.height = ch;
    const ctx = atlas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, atlas.width, atlas.height);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(ch * 0.9)}px "Fira Code", "DejaVu Sans Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chars.forEach((c, i) => ctx.fillText(c, i * cw + cw / 2, ch / 2 + ch * 0.04));
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    atlases.set(key, tex);
    return tex;
  }

  function cellFor(base, l, mode) {
    const w = Math.max(3, Math.round(base * (l.cellScale || 1)));
    return mode === 0 ? [w, Math.round(w / 0.6)] : [w, w];
  }

  let dpr = 1;
  let motionTime = 0;
  let running = false;
  let visible = true;
  let frame = 0;
  let last = 0;
  // o que está na tela: relógio e ajustes só mudam juntos, e no máximo
  // uma vez a cada MIN_GAP_MS. A rolagem só desloca camadas e não espera.
  let shownTime = 0;
  let shown = structuredClone(settings);
  let lastContentDraw = -Infinity;
  let lastScroll = -1;
  let lastPx = 0;
  // paralaxe horizontal: posição do mouse no hero, de -1 a 1, suavizada
  let px = 0;
  let pxTarget = 0;
  let dirty = false;
  let pending = 0;

  function framing(W) {
    if (POSTER) return { W, scale: POSTER_SCALE, ox: 0, oy: 0, n: 0 };
    // a arte ocupa a largura toda, menos a sobra de cada lado (paralaxe
    // horizontal); em telas estreitas, ao menos 60% da altura da área da arte,
    // mas sem passar de narrow.width unidades visíveis (no celular em pé).
    // Ancorada no fim da área da arte; abaixo dela fica a faixa da água que
    // invade a página. O que sobra em cima é o céu alto. Mesma conta do CSS.
    const Ha = artBox.clientHeight * dpr;
    const fit = narrow ? Math.min((Ha * 0.6) / artH, W / narrow.width) : (Ha * 0.6) / artH;
    const scale = Math.max(W / (artW - 2 * overscan), fit);
    // n: quanto a tela é estreita (0 a 1); as camadas das laterais vêm para o centro
    const n = narrow ? Math.min(1, Math.max(0, (narrow.from - W / scale) / (narrow.from - narrow.width))) : 0;
    return { W, scale, ox: (W - artW * scale) / 2, oy: Ha - artH * scale, n };
  }

  // logotipo, respiro e linhas: em tela estreita mudam de tamanho em torno do
  // centro do logo (no máximo 88% da largura visível); com papel sobrando
  // acima da arte, sobem junto
  function fitAroundLogo(rect, f) {
    const logo = layers.find((l) => l.kind === 'logo');
    if (!logo) return rect;
    const k = Math.min(1 + LOGO_GROW * f.n, (0.88 * (f.W / f.scale)) / logo.rect[2]);
    const lift = f.oy > 0 ? (LOGO_LIFT * f.oy) / f.scale : 0;
    if (k === 1 && lift === 0) return rect;
    const cx = logo.rect[0] + logo.rect[2] / 2, cy = logo.rect[1] + logo.rect[3] / 2;
    return [cx + (rect[0] - cx) * k, cy + (rect[1] - cy) * k - lift, rect[2] * k, rect[3] * k];
  }

  // onde a camada fica neste quadro, em unidades de arte
  function place(l, f) {
    if (['logo', 'logo-halo', 'lines'].includes(l.kind)) return fitAroundLogo(l.rect, f);
    if (!l.narrow || !f.n) return l.rect;
    return [l.rect[0] + l.narrow[0] * f.n, l.rect[1] + l.narrow[1] * f.n, l.rect[2], l.rect[3]];
  }

  function scrollPx() {
    if (!running || POSTER) return 0;
    const top = hero.getBoundingClientRect().top;
    return Math.min(Math.max(-top, 0), hero.clientHeight) * dpr;
  }

  function resize() {
    if (POSTER) {
      dpr = 1;
      canvas.width = Math.round(artW * POSTER_SCALE);
      canvas.height = Math.round((artH + spill) * POSTER_SCALE);
      canvas.style.width = `${canvas.width}px`;
      canvas.style.height = `${canvas.height}px`;
      return;
    }
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(hero.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(hero.clientHeight * dpr));
  }

  function draw() {
    const W = canvas.width, H = canvas.height;
    gl.viewport(0, 0, W, H);
    gl.clearColor(paper[0], paper[1], paper[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const f = framing(W);
    const cfg = shown;
    const cellBase = POSTER ? cfg.cell * (POSTER_SCALE / REF_SCALE) : cfg.cell * dpr;
    const scroll = scrollPx();
    // o logotipo (com o respiro e as linhas) fica fora do paralaxe horizontal
    const offsetOf = (l) => scroll * cfg.parallax * (1 - l.depth);
    const offsetX = (l) => (running && !POSTER && !l.fixedX ? -px * cfg.hparallax * HSHIFT_ART * l.depth * f.scale : 0);
    lastScroll = scroll;
    lastPx = px;

    gl.uniform2f(U('uRes'), W, H);
    gl.uniform1f(U('uScale'), f.scale);
    gl.uniform2f(U('uOrigin'), f.ox, f.oy);
    gl.uniform1f(U('uTime'), shownTime);
    gl.uniform1f(U('uSpillTop'), artH);
    gl.uniform1f(U('uSpill'), spill);
    gl.uniform1f(U('uSpillPx'), spill * f.scale);
    gl.uniform1f(U('uTwinkle'), cfg.twinkle);

    // água: o topo anda com a margem; a borda de baixo do lago (FLAT_EDGE) fica
    // presa ao pé do hero; o que está entre os dois achata
    const offLand = scroll * cfg.parallax * (1 - SHORE_DEPTH);
    const flatTop = lakeLayer ? f.oy + offLand + lakeLayer.waterTop * f.scale : 0;
    const flatEdge = f.oy + FLAT_EDGE * f.scale;
    const flatK = lakeLayer ? (Math.floor(flatEdge + 0.5) - Math.floor(flatTop + 0.5)) / ((FLAT_EDGE - lakeLayer.waterTop) * f.scale) : 1;
    // y na tela → y na água achatada (unidades de arte), para o reflexo seguir o pé de quem se reflete
    const toWater = (y) => (y < flatTop
      ? (y - f.oy - offLand) / f.scale
      : lakeLayer.waterTop + (y - Math.floor(flatTop + 0.5)) / (f.scale * flatK));
    // y da água achatada (unidades de arte) → y na tela
    const waterAt = (y) => (y <= lakeLayer.waterTop
      ? f.oy + offLand + y * f.scale
      : Math.floor(flatTop + 0.5) + (y - lakeLayer.waterTop) * f.scale * flatK);
    // deslocamento de cada camada: a água anda com a margem; quem está de pé
    // nela, com a água na linha do pé; o resto, com a própria profundidade
    const layerOff = (l) => {
      if (l.kind === 'lake') return offLand;
      if (!STANDS.has(l)) return offsetOf(l);
      const foot = l.mirrorY ?? lakeLayer.waterTop;
      return waterAt(foot) - (f.oy + foot * f.scale);
    };

    for (const l of layers) {
      const rect = place(l, f);
      const lake = l.kind === 'lake';
      const off = layerOff(l);
      const offX = offsetX(l);
      const margin = l.kind === 'elephant' ? 40 : 2;
      const quadTop = f.oy + off + (rect[1] - margin) * f.scale;
      const quadBottom = lake ? f.oy + (rect[1] + rect[3] + margin) * f.scale : quadTop + (rect[3] + margin * 2) * f.scale;
      gl.uniform4f(U('uQuad'),
        f.ox + offX + (rect[0] - margin) * f.scale,
        quadTop,
        (rect[2] + margin * 2) * f.scale,
        quadBottom - quadTop);
      gl.uniform4f(U('uFlat'), flatTop, flatEdge, lake ? l.waterTop : 0, lake ? FLAT_EDGE : 0);
      gl.uniform4fv(U('uRect'), rect);
      gl.uniform2f(U('uOffset'), offX, off);
      gl.uniform1f(U('uTexelsPerArt'), l.texelsPerArt * (rect[2] === l.rect[2] ? 1 : l.rect[2] / rect[2]));
      gl.uniform1i(U('uMode'), l.raw ? 3 : cfg.mode);
      // o papel em volta das letras do logotipo tem opacidade ajustável
      gl.uniform1f(U('uRawAlpha'), l.kind === 'logo-halo' ? cfg.logo.halo : 1);
      gl.uniform1i(U('uKind'), { lake: 1, elephant: 2, logo: 3, sky: 4 }[l.kind] ?? 0);

      if (l.kind === 'logo') {
        const a = (cfg.logo.angle * Math.PI) / 180;
        gl.uniform1f(U('uLight'), cfg.logo.light);
        gl.uniform1f(U('uLogoBase'), cfg.logo.base);
        gl.uniform2f(U('uLightFrom'), Math.cos(a), -Math.sin(a));
      }
      let layerCell = null;
      if (!l.raw) {
        const own = cfg.layers[l.look || l.name] || { ink: l.ink, contrast: 1, gamma: 1 };
        gl.uniform1f(U('uInk'), own.ink);
        gl.uniform1f(U('uOcclude'), l.occlude === false ? 0 : 1);
        gl.uniform1f(U('uContrast'), cfg.contrast * own.contrast);
        gl.uniform1f(U('uGamma'), cfg.gamma * own.gamma);
        const cell = cellFor(cellBase, l, cfg.mode);
        layerCell = cell;
        gl.uniform2fv(U('uCell'), cell);
        if (cfg.mode === 0) {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, atlasFor(cell[0], cell[1]));
        }
      }
      if (l.kind === 'elephant') {
        const t = l.trunk, dx = rect[0] - l.rect[0];
        gl.uniform4f(U('uTrunk'), t.base[0] + dx, t.base[1], t.tip[0] + dx, t.tip[1]);
        gl.uniform2fv(U('uTrunkBand'), t.band);
        gl.uniform1f(U('uTrunkAmp'), cfg.trunk);
        gl.uniform1f(U('uTrunkPhase'), t.phase);
      }
      if (l.kind === 'lake') {
        gl.uniform1f(U('uWater'), cfg.water);
        gl.uniform1f(U('uWaterTop'), l.waterTop);
        // o reflexo começa no pé de quem se reflete, onde quer que a camada
        // esteja no paralaxe, e achata junto com a água
        const axis = [0, 0, 0, 0], start = [0, 0, 0, 0], squash = [1, 1, 1, 1];
        const tpa = [1, 1, 1, 1], strength = [0, 0, 0, 0], fade = [1, 1, 1, 1], shiftX = [0, 0, 0, 0];
        // o reflexo do logotipo não acompanha a água no paralaxe horizontal:
        // a amostra volta o que a água andou, em células inteiras (o reflexo
        // se desloca como imagem, sem trocar caractere a cada quadro)
        const backX = layerCell ? (Math.round(offX / layerCell[0]) * layerCell[0]) / f.scale : 0;
        reflected.forEach((r, i) => {
          const [force, len] = REFLECT[r.kind] ?? REFLECT.plain;
          const rRect = place(r, f);
          gl.uniform4fv(U(`uRefRect${i}`), rRect);
          // reflexo fiel: espelha pela linha da camada. Logotipo: começa logo
          // abaixo do horizonte, a partir da base das letras, achatado
          axis[i] = r.reflect ? rRect[1] + rRect[3] : r.mirrorY;
          start[i] = toWater(f.oy + layerOff(r) + (r.reflect ? r.reflect.start : r.mirrorY) * f.scale);
          squash[i] = r.reflect ? r.reflect.squash : 1;
          tpa[i] = r.texelsPerArt * (rRect[2] === r.rect[2] ? 1 : r.rect[2] / rRect[2]);
          strength[i] = r.kind === 'logo'
            ? force * cfg.reflect * cfg.logo.reflection * cfg.logo.base
            : force * cfg.reflect * Math.min(1, cfg.layers[r.name].ink);
          fade[i] = len;
          shiftX[i] = r.fixedX ? backX : 0;
          gl.activeTexture(gl.TEXTURE2 + i);
          gl.bindTexture(gl.TEXTURE_2D, r.tex);
        });
        gl.uniform4fv(U('uRefAxis'), axis);
        gl.uniform4fv(U('uRefStart'), start);
        gl.uniform4fv(U('uRefSquash'), squash);
        gl.uniform4fv(U('uRefTpa'), tpa);
        gl.uniform4fv(U('uRefStrength'), strength);
        gl.uniform4fv(U('uRefFade'), fade);
        gl.uniform4fv(U('uRefShiftX'), shiftX);
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, l.tex);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  // frase do topo: a luz do logotipo, refeita em canvas 2D como fundo
  // recortado pelas letras (background-clip: text). O "F" da Figma recebe a
  // mesma textura, alinhada. Só refaz quando o tamanho ou a luz mudam.
  const tagline = hero.querySelector('.hero__tagline');
  const tagText = tagline?.querySelector('.tagline__text');
  const tagF = tagText?.querySelector('.tagline__f');
  const moreContrast = window.matchMedia('(prefers-contrast: more)');
  const chars = [...glyphMeta.chars];
  let taglineKey = '';
  const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

  function paintTagline(cfg) {
    if (!tagText || POSTER) return;
    if (moreContrast.matches) { tagline.classList.remove('is-textured'); taglineKey = ''; return; }
    const box = tagText.getBoundingClientRect();
    if (!box.width) return;
    const k = Math.min(window.devicePixelRatio || 1, 2);
    const key = [box.width, box.height, k, cfg.cell, cfg.mode, cfg.logo.light, cfg.logo.angle, cfg.logo.base].join('|');
    if (key === taglineKey) return;
    taglineKey = key;

    const W = Math.ceil(box.width * k), H = Math.ceil(box.height * k);
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    const ink = hexToRgb('#141414');
    const base = Math.max(cfg.logo.base, TEXT_MIN_BASE);
    ctx.fillStyle = rgb(ink.map((v, i) => v * base + paper[i] * (1 - base)));
    ctx.fillRect(0, 0, W, H);

    const mode = cfg.mode === 3 ? 1 : cfg.mode;
    const cw = Math.max(3, Math.round(cfg.cell * k * 0.75));
    const ch = mode === 0 ? Math.round(cw / 0.6) : cw;
    const a = (cfg.logo.angle * Math.PI) / 180, fx = Math.cos(a), fy = -Math.sin(a);
    ctx.fillStyle = rgb(paper);
    ctx.font = `${Math.round(ch * 0.9)}px "Fira Code", "DejaVu Sans Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let y = 0, row = 0; y < H; y += ch, row++) {
      for (let x = 0, col = 0; x < W; x += cw, col++) {
        const qx = (x + cw / 2 - W / 2) / W, qy = (y + ch / 2 - H / 2) / W;
        const lit = Math.min(1, Math.max(0, 0.5 + (qx * fx + qy * fy) * 1.6));
        const Dl = 1 - lit * lit * cfg.logo.light * (1 - TEXT_FLOOR);
        if (Dl >= 0.999) continue;
        if (mode === 0) {
          // negativo: caractere em papel sobre a tinta
          const idx = Math.round((1 - Dl) * 2 * (chars.length - 1));
          if (idx > 0) ctx.fillText(chars[idx], x + cw / 2, y + ch / 2 + ch * 0.04);
        } else if (mode === 1) {
          // pontos: o anel entre o ponto cheio e o ponto da luz vira papel
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, cw, ch);
          ctx.clip();
          ctx.beginPath();
          ctx.arc(x + cw / 2, y + ch / 2, 0.6 * cw, 0, Math.PI * 2);
          ctx.arc(x + cw / 2, y + ch / 2, Math.sqrt(Dl) * 0.6 * cw, 0, Math.PI * 2, true);
          ctx.fill('evenodd');
          ctx.restore();
        } else {
          const th = (BAYER4[(col % 4) + (row % 4) * 4] + 0.5) / 16;
          if (Dl <= th) ctx.fillRect(x + cw * 0.08, y + ch * 0.08, cw * 0.84, ch * 0.84);
        }
      }
    }
    const url = `url(${cv.toDataURL()})`;
    const size = `${box.width}px ${box.height}px`;
    tagText.style.backgroundImage = url;
    tagText.style.backgroundSize = size;
    if (tagF) {
      const fb = tagF.getBoundingClientRect();
      tagF.style.backgroundImage = url;
      tagF.style.backgroundSize = size;
      tagF.style.backgroundPosition = `${box.left - fb.left}px ${box.top - fb.top}px`;
    }
    tagline.classList.add('is-textured');
  }

  // troca de conteúdo (relógio em degraus ou ajuste): só depois de MIN_GAP_MS
  // desde a última, estrito. Em qualquer janela de 1 s cabem no máximo 4.
  function commitContent(now) {
    shownTime = Math.floor(motionTime * STEP_HZ) / STEP_HZ;
    shown = structuredClone(settings);
    dirty = false;
    lastContentDraw = now;
    draw();
    paintTagline(shown);
  }

  function tick(now) {
    frame = 0;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    motionTime += dt;
    const changed = dirty || Math.floor(motionTime * STEP_HZ) / STEP_HZ !== shownTime;
    // o paralaxe horizontal persegue o mouse com suavidade
    px += (pxTarget - px) * (1 - Math.exp(-dt * 5));
    if (Math.abs(pxTarget - px) < 0.0005) px = pxTarget;
    if (changed && now - lastContentDraw >= MIN_GAP_MS) commitContent(now);
    else if (scrollPx() !== lastScroll || px !== lastPx) draw();
    schedule();
  }

  function schedule() {
    if (frame || !running || !visible || document.hidden) {
      if (!running) last = 0;
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  // ajuste do laboratório: no máximo um redesenho a cada 1/STEP_HZ s,
  // para segurar uma tecla num controle não trocar a cena inteira em rajada
  function requestRedraw() {
    dirty = true;
    if (running && visible && !document.hidden) return schedule();
    if (pending) return;
    const wait = Math.max(0, lastContentDraw + MIN_GAP_MS - performance.now() + 1);
    pending = setTimeout(() => {
      pending = 0;
      requestAnimationFrame((now) => {
        if (now - lastContentDraw >= MIN_GAP_MS) commitContent(now);
        else requestRedraw();
      });
    }, wait);
  }

  // o rótulo segue o idioma da página (window.dallyText, do script de idioma); sem ele, como no laboratório, em português
  const motionLabel = (on) => (window.dallyText
    ? window.dallyText(on ? 'motion-pause' : 'motion-resume')
    : (on ? 'Pausar animação' : 'Retomar animação'));

  function setRunning(next) {
    running = next;
    toggle.dataset.state = running ? 'running' : 'paused';
    toggleLabel.textContent = motionLabel(running);
    // o resto da página (as gotas da seção seguinte) segue o mesmo botão
    root.dataset.motion = running ? 'on' : 'off';
    document.dispatchEvent(new CustomEvent('dally:motion', { detail: { running } }));
    last = 0;
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    if (running) schedule();
    else requestAnimationFrame(draw);
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduce.addEventListener('change', (e) => { forgetMotion(); setRunning(!e.matches); });
  toggle.addEventListener('click', () => {
    storeMotion(running ? 'off' : 'on', reduce.matches);
    setRunning(!running);
  });

  // paralaxe horizontal: só com mouse (em tela de toque não há ponteiro parado
  // sobre a cena, e o paralaxe da rolagem basta). Desliga com o botão de pausa.
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !finePointer.matches) return;
    const r = hero.getBoundingClientRect();
    pxTarget = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    schedule();
  });
  hero.addEventListener('pointerleave', () => { pxTarget = 0; schedule(); });

  // mudar o tamanho do canvas apaga o quadro: redesenha no mesmo instante
  new ResizeObserver(() => { resize(); draw(); }).observe(hero);
  if (tagText) new ResizeObserver(() => paintTagline(shown)).observe(tagText);
  document.fonts?.ready.then(() => { taglineKey = ''; paintTagline(shown); });
  moreContrast.addEventListener('change', () => { taglineKey = ''; paintTagline(shown); });
  // troca de idioma: a frase muda de largura e o "F" de lugar, então a textura é refeita
  document.addEventListener('dally:lang', () => {
    toggleLabel.textContent = motionLabel(running);
    taglineKey = '';
    paintTagline(shown);
  });
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }).observe(hero);
  document.addEventListener('visibilitychange', () => { last = 0; schedule(); });

  resize();
  if (POSTER) {
    draw();
    canvas.dataset.ready = 'true';
    return;
  }

  toggle.hidden = false;
  const stored = readStoredMotion(reduce.matches);
  setRunning(stored ? stored === 'on' : !reduce.matches);
  draw();
  paintTagline(shown);
  root.classList.add('hero-live');

  bindLab(settings, tunable, defaults, requestRedraw);
}

function bindLab(settings, layers, defaults, rerender) {
  const lab = document.querySelector('#lab');
  if (!lab) return;
  const json = document.querySelector('#lab-json');
  const status = document.querySelector('#lab-status');
  const layerSelect = document.querySelector('#lab-layer');
  const num = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (v) => `${Math.round(v * 100)}%`;
  const FROM = ['da direita', 'de cima à direita', 'de cima', 'de cima à esquerda', 'da esquerda', 'de baixo à esquerda', 'de baixo', 'de baixo à direita'];
  // texto visível e texto lido: "6 px" na tela, "6 pixels" para o leitor de tela
  const fmt = {
    cell: (v) => [`${v} px`, `${v} pixels`],
    contrast: (v) => [num(v), num(v)],
    gamma: (v) => [num(v), num(v)],
    parallax: (v) => [pct(v), pct(v)],
    trunk: (v) => [pct(v), pct(v)],
    hparallax: (v) => [pct(v), pct(v)],
    reflect: (v) => [pct(v), pct(v)],
    twinkle: (v) => [pct(v), pct(v)],
    water: (v) => [pct(v), pct(v)],
    ink: (v) => [pct(v), pct(v)],
    light: (v) => [pct(v), pct(v)],
    base: (v) => [pct(v), `${Math.round(v * 100)}% opaca`],
    halo: (v) => [pct(v), `${Math.round(v * 100)}% opaco`],
    reflection: (v) => [pct(v), pct(v)],
    angle: (v) => [`${v}°`, `${v} graus, luz vinda ${FROM[Math.round(v / 45) % 8]}`],
  };

  layers.forEach((l) => layerSelect.add(new Option(l.label, l.name)));

  const show = () => { json.textContent = JSON.stringify(settings, null, 2); };
  const announce = (text) => {
    status.textContent = '';
    setTimeout(() => { status.textContent = text; }, 120);
  };
  const paint = (input, value) => {
    const [visibleText, spoken] = fmt[input.dataset.key](value);
    input.setAttribute('aria-valuetext', spoken);
    lab.querySelector(`output[for="${input.id}"]`).textContent = visibleText;
  };

  // cada controle sabe onde mora o seu valor: na cena, no logotipo ou na camada escolhida
  const home = (input) => ({ scene: settings, logo: settings.logo, layer: settings.layers[layerSelect.value] })[input.dataset.scope];
  const inputs = [...lab.querySelectorAll('[data-scope]')];
  const pull = (input) => {
    const value = home(input)[input.dataset.key];
    input.value = String(value);
    if (input.type === 'range') paint(input, value);
  };

  inputs.forEach((input) => {
    input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => {
      home(input)[input.dataset.key] = Number(input.value);
      if (input.type === 'range') paint(input, Number(input.value));
      show();
      rerender();
    });
  });
  layerSelect.addEventListener('change', () => lab.querySelectorAll('[data-scope="layer"]').forEach(pull));
  inputs.forEach(pull);
  show();

  document.querySelector('#lab-reset').addEventListener('click', () => {
    const fresh = structuredClone(defaults);
    Object.keys(settings).forEach((k) => delete settings[k]);
    Object.assign(settings, fresh);
    inputs.forEach(pull);
    show();
    rerender();
    announce('Ajustes de volta ao padrão.');
  });

  document.querySelector('#lab-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(json.textContent);
      announce('Ajustes copiados.');
    } catch {
      window.getSelection().selectAllChildren(json);
      announce('Não deu para copiar sozinho. O texto do bloco está selecionado: use Ctrl+C.');
    }
  });

  // o laboratório só liga quando a cena funciona; antes disso fica desligado e explicado
  lab.querySelectorAll('fieldset, .lab__actions button').forEach((el) => { el.disabled = false; });
  document.querySelector('#lab-off').hidden = true;
}

boot().catch((err) => {
  // a cena é decorativa: se o WebGL falhar, o poster continua no lugar
  console.error('[dally.md hero]', err);
});
