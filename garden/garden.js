// Claude Garden — Artistic usage tracker
// One flower blooms every 5,000 tokens. Garden resets weekly, archived forever.

// ─── PALETTE ──────────────────────────────────────────────────────────────────

const PALETTE = [
  '#F35BA8', '#ED1B2F', '#F7B8C5', '#F58FB8', '#E96B7A', // hot
  '#F4881E', '#F04E2A', '#F2B43A',                         // warm
  '#3B3FE4', '#1F7A8C', '#1FB54A', '#3FB54A',              // cool
  '#C68FB0'                                                 // atmospheric
];

const FLOWER_TYPES = ['daisy', 'rose', 'tulip', 'bell', 'wild', 'cornflower'];
const TOKENS_PER_FLOWER = 5000;
const GROUND_RATIO = 0.80;

// ─── SEEDED RANDOM ────────────────────────────────────────────────────────────

function mkRand(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// ─── WEEK UTILITIES ───────────────────────────────────────────────────────────

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameWeek(a, b) {
  return getWeekStart(a).getTime() === getWeekStart(b).getTime();
}

function weekSeed(date) {
  const ws = getWeekStart(date);
  return ws.getFullYear() * 10000 + (ws.getMonth() + 1) * 100 + ws.getDate();
}

function getWeekPalette(seed) {
  const rand = mkRand(seed * 7 + 13);
  const count = Math.floor(rand() * 3) + 6; // 6–8 colours
  return [...PALETTE].sort(() => rand() - 0.5).slice(0, count);
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── SVG HELPERS ──────────────────────────────────────────────────────────────

function svgEl(tag, attrs = {}) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

// Wobble a value by ±amount
function jit(val, rand, amount = 3) {
  return val + (rand() - 0.5) * amount;
}

// Wobbly cubic bezier from (x1,y1) to (x2,y2)
function bez(x1, y1, x2, y2, rand, wob = 10) {
  const dx = x2 - x1, dy = y2 - y1;
  const cx1 = x1 + dx * 0.33 + (rand() - 0.5) * wob;
  const cy1 = y1 + dy * 0.33 + (rand() - 0.5) * wob;
  const cx2 = x1 + dx * 0.67 + (rand() - 0.5) * wob;
  const cy2 = y1 + dy * 0.67 + (rand() - 0.5) * wob;
  return `M ${jit(x1,rand,2)} ${jit(y1,rand,2)} C ${cx1} ${cy1},${cx2} ${cy2},${jit(x2,rand,2)} ${jit(y2,rand,2)}`;
}

function pathEl(d, color, sw, extra = {}) {
  return svgEl('path', { d, stroke: color, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none', ...extra });
}

// ─── STEMS & LEAVES ───────────────────────────────────────────────────────────

function makeStem(g, x, baseY, tipX, tipY, color, sw, rand) {
  g.appendChild(pathEl(bez(x, baseY, tipX, tipY, rand, 14), color, sw));
}

function makeLeaf(g, x, y, color, rand, dir) {
  const lx = x + dir * (14 + rand() * 22);
  const ly = y + 8 + rand() * 14;
  g.appendChild(pathEl(
    `M ${jit(x,rand,3)} ${jit(y,rand,3)} Q ${jit(lx,rand,5)} ${jit(ly-18,rand,6)} ${jit(lx+dir*3,rand,3)} ${jit(ly,rand,3)} Q ${jit(x+dir*7,rand,4)} ${jit(ly-4,rand,4)} ${jit(x,rand,3)} ${jit(y,rand,3)}`,
    color, 1.5 + rand() * 1.5
  ));
}

function addLeaves(g, x, baseY, tipX, tipY, color, rand) {
  const t1 = 0.35 + rand() * 0.2;
  const mx1 = x + (tipX - x) * t1, my1 = baseY + (tipY - baseY) * t1;
  makeLeaf(g, mx1, my1, color, rand, rand() > 0.5 ? 1 : -1);
  if (rand() > 0.45) {
    const t2 = 0.58 + rand() * 0.18;
    makeLeaf(g, x + (tipX-x)*t2, baseY + (tipY-baseY)*t2, color, rand, rand() > 0.5 ? 1 : -1);
  }
}

// ─── FLOWER HEADS ─────────────────────────────────────────────────────────────

function drawDaisy(g, cx, cy, size, color, rand) {
  const n = 7 + Math.floor(rand() * 5);
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.35;
    const r = size * (1.1 + rand() * 0.5);
    const px = cx + Math.cos(angle) * r, py = cy + Math.sin(angle) * r;
    const cpx = cx + Math.cos(angle + (rand()-0.5)*0.7) * r * 0.55;
    const cpy = cy + Math.sin(angle + (rand()-0.5)*0.7) * r * 0.55;
    g.appendChild(pathEl(
      `M ${jit(cx,rand,4)} ${jit(cy,rand,4)} Q ${jit(cpx,rand,5)} ${jit(cpy,rand,5)} ${jit(px,rand,4)} ${jit(py,rand,4)}`,
      color, 1.5 + rand() * 2
    ));
  }
  g.appendChild(svgEl('circle', {
    cx: jit(cx,rand,3), cy: jit(cy,rand,3), r: size * (0.25 + rand() * 0.1),
    stroke: color, 'stroke-width': 1.5 + rand(), fill: 'none'
  }));
  // A few centre dots
  for (let i = 0; i < 4; i++) {
    g.appendChild(svgEl('circle', {
      cx: jit(cx, rand, size * 0.12), cy: jit(cy, rand, size * 0.12), r: 1.2 + rand(),
      fill: color
    }));
  }
}

function drawRose(g, cx, cy, size, color, rand) {
  const layers = 3 + Math.floor(rand() * 2);
  for (let l = 0; l < layers; l++) {
    const r = size * (0.18 + l * 0.28);
    const startAngle = rand() * Math.PI * 2;
    let d = '';
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = startAngle + t * Math.PI * (1.4 + rand() * 0.6);
      const radius = r * (0.08 + t);
      const x = cx + Math.cos(angle) * radius + (rand() - 0.5) * 4;
      const y = cy + Math.sin(angle) * radius + (rand() - 0.5) * 4;
      d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    g.appendChild(pathEl(d, color, 1.8 + rand() * 2.2));
  }
}

function drawTulip(g, cx, cy, size, color, rand) {
  const sw = 2 + rand() * 2;
  const lx = cx - size * (0.55 + rand() * 0.2);
  const rx = cx + size * (0.55 + rand() * 0.2);
  const topY = cy - size * (0.85 + rand() * 0.3);
  const baseY = cy;
  g.appendChild(pathEl(
    `M ${jit(cx,rand,3)} ${jit(baseY,rand,3)} C ${jit(lx-8,rand,6)} ${jit(baseY-size*0.4,rand,7)},${jit(lx,rand,5)} ${jit(topY+size*0.3,rand,5)},${jit(cx-size*0.06,rand,4)} ${jit(topY,rand,4)}`,
    color, sw
  ));
  g.appendChild(pathEl(
    `M ${jit(cx,rand,3)} ${jit(baseY,rand,3)} C ${jit(rx+8,rand,6)} ${jit(baseY-size*0.4,rand,7)},${jit(rx,rand,5)} ${jit(topY+size*0.3,rand,5)},${jit(cx+size*0.06,rand,4)} ${jit(topY,rand,4)}`,
    color, sw
  ));
  g.appendChild(pathEl(
    `M ${jit(cx-size*0.06,rand,3)} ${jit(topY,rand,3)} C ${jit(cx-size*0.4,rand,7)} ${jit(topY-size*0.38,rand,7)},${jit(cx+size*0.4,rand,7)} ${jit(topY-size*0.38,rand,7)},${jit(cx+size*0.06,rand,3)} ${jit(topY,rand,3)}`,
    color, sw
  ));
}

function drawBell(g, cx, cy, size, color, rand) {
  const sw = 2 + rand() * 2;
  const topY = cy - size * 0.35;
  const botY = cy + size * 0.55;
  g.appendChild(pathEl(
    `M ${jit(cx,rand,3)} ${jit(topY,rand,3)} C ${jit(cx-size,rand,7)} ${jit(topY-size*0.08,rand,6)},${jit(cx-size*1.1,rand,7)} ${jit(botY-size*0.25,rand,6)},${jit(cx,rand,4)} ${jit(botY,rand,4)} C ${jit(cx+size*1.1,rand,7)} ${jit(botY-size*0.25,rand,6)},${jit(cx+size,rand,7)} ${jit(topY-size*0.08,rand,6)},${jit(cx,rand,3)} ${jit(topY,rand,3)}`,
    color, sw
  ));
  // Stamen
  g.appendChild(pathEl(
    bez(cx, topY + size * 0.1, jit(cx, rand, 10), botY - size * 0.15, rand, 5),
    color, 1.5
  ));
}

function drawWild(g, cx, cy, size, color, rand) {
  const n = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + rand() * 0.55;
    const pLen = size * (0.65 + rand() * 0.7);
    const px = cx + Math.cos(angle) * pLen, py = cy + Math.sin(angle) * pLen;
    const cpAngle = angle + (rand() - 0.5) * 1.4;
    const cpLen = pLen * (0.35 + rand() * 0.35);
    const cpx = cx + Math.cos(cpAngle) * cpLen, cpy = cy + Math.sin(cpAngle) * cpLen;
    g.appendChild(pathEl(
      `M ${jit(cx,rand,4)} ${jit(cy,rand,4)} Q ${jit(cpx,rand,6)} ${jit(cpy,rand,6)} ${jit(px,rand,5)} ${jit(py,rand,5)}`,
      color, 1.8 + rand() * 3
    ));
  }
  g.appendChild(svgEl('circle', {
    cx: jit(cx,rand,3), cy: jit(cy,rand,3), r: jit(size*0.18,rand,4),
    stroke: color, 'stroke-width': 2, fill: 'none'
  }));
}

function drawCornflower(g, cx, cy, size, color, rand) {
  const count = 14 + Math.floor(rand() * 10);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rand() * 0.25;
    const r = size * (0.45 + rand() * 0.55);
    g.appendChild(pathEl(
      `M ${jit(cx,rand,3)} ${jit(cy,rand,3)} L ${jit(cx+Math.cos(angle)*r,rand,4)} ${jit(cy+Math.sin(angle)*r,rand,4)}`,
      color, 1 + rand() * 1.8
    ));
  }
  g.appendChild(svgEl('circle', {
    cx: jit(cx,rand,2), cy: jit(cy,rand,2), r: size * 0.22,
    stroke: color, 'stroke-width': 2, fill: color, 'fill-opacity': 0.25
  }));
}

const FLOWER_FNS = { daisy: drawDaisy, rose: drawRose, tulip: drawTulip, bell: drawBell, wild: drawWild, cornflower: drawCornflower };

// ─── RENDER A SINGLE FLOWER ───────────────────────────────────────────────────

function renderFlower(data, parent, groundY, isNew = false) {
  const { id, x, type, seed, color, stage } = data;
  const rand = mkRand(seed);
  const g = svgEl('g', { 'data-id': id, ...(isNew ? { class: 'flower-new' } : {}) });

  const size = 16 + rand() * 24;
  const stemH = 50 + rand() * 95;
  const sw = 2 + rand() * 2;
  const tipX = x + (rand() - 0.5) * 22;
  const tipY = groundY - stemH;

  if (stage === 'sprout') {
    const sh = stemH * 0.22;
    g.appendChild(pathEl(bez(x, groundY, jit(x,rand,7), groundY - sh, rand, 5), color, sw));
    g.appendChild(svgEl('ellipse', {
      cx: jit(x,rand,4), cy: jit(groundY-sh,rand,3),
      rx: jit(3,rand,1.2), ry: jit(7,rand,2),
      stroke: color, 'stroke-width': 1.5, fill: 'none'
    }));
  } else if (stage === 'bud') {
    const sh = stemH * 0.52;
    const tx = x + (rand()-0.5)*14, ty = groundY - sh;
    makeStem(g, x, groundY, tx, ty, color, sw, rand);
    makeLeaf(g, tx*0.5+x*0.5, groundY-sh*0.5, color, rand, rand()>0.5?1:-1);
    g.appendChild(svgEl('ellipse', {
      cx: jit(tx,rand,3), cy: jit(ty-size*0.35,rand,3),
      rx: jit(size*0.28,rand,2), ry: jit(size*0.52,rand,2),
      stroke: color, 'stroke-width': sw, fill: 'none'
    }));
    g.appendChild(pathEl(
      `M ${jit(tx-size*0.26,rand,3)} ${jit(ty,rand,3)} C ${jit(tx-size*0.1,rand,4)} ${jit(ty-size*0.28,rand,4)},${jit(tx+size*0.1,rand,4)} ${jit(ty-size*0.28,rand,4)},${jit(tx+size*0.26,rand,3)} ${jit(ty,rand,3)}`,
      color, 1.5
    ));
  } else {
    makeStem(g, x, groundY, tipX, tipY, color, sw, rand);
    addLeaves(g, x, groundY, tipX, tipY, color, rand);
    FLOWER_FNS[type](g, tipX, tipY, size, color, rand);
  }

  parent.appendChild(g);
}

// ─── GROUND STROKES ───────────────────────────────────────────────────────────

function drawGround(svgEl, palette, rand, W, groundY) {
  // Prefer greens/naturals for ground, occasionally accent colours
  const groundPalette = palette.filter(c =>
    ['#1FB54A','#3FB54A','#1F7A8C'].includes(c)
  );
  const usePalette = groundPalette.length >= 2 ? groundPalette : palette;

  const count = Math.floor(W / 16);
  for (let i = 0; i < count; i++) {
    const x1 = rand() * W;
    const len = 12 + rand() * 60;
    const color = usePalette[Math.floor(rand() * usePalette.length)];
    const yOff = rand() * 25;
    svgEl.appendChild(pathEl(
      bez(x1, groundY + yOff, x1 + len, groundY + yOff + (rand()-0.5)*12, rand, 9),
      color, 2 + rand() * 4,
      { opacity: (0.25 + rand() * 0.55).toFixed(2) }
    ));
  }
}

// ─── STATE ────────────────────────────────────────────────────────────────────

const KEY = 'claude-garden-v1';

function defaultState() {
  const now = new Date();
  const seed = weekSeed(now);
  return {
    totalTokens: 0,
    flowers: [],
    weekStart: getWeekStart(now).toISOString(),
    weekPalette: getWeekPalette(seed),
    archives: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return defaultState();
}

function saveState(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function archiveCurrentWeek(s) {
  s.archives.push({
    weekStart: s.weekStart,
    weekEnd: new Date().toISOString(),
    totalTokens: s.totalTokens,
    flowerCount: s.flowers.length,
    flowers: s.flowers,
    palette: s.weekPalette
  });
  const now = new Date();
  const seed = weekSeed(now);
  s.weekStart = getWeekStart(now).toISOString();
  s.weekPalette = getWeekPalette(seed);
  s.totalTokens = 0;
  s.flowers = [];
}

function checkWeekReset(s) {
  if (!isSameWeek(new Date(s.weekStart), new Date())) {
    archiveCurrentWeek(s);
    return true;
  }
  return false;
}

function makeFlower(milestone, palette, W, groundY, rand) {
  return {
    id: Date.now().toString(36) + (rand() * 0xfffff | 0).toString(36),
    x: 45 + rand() * (W - 90),
    type: FLOWER_TYPES[Math.floor(rand() * FLOWER_TYPES.length)],
    seed: (rand() * 999999999) | 0,
    color: palette[Math.floor(rand() * palette.length)],
    stage: 'bloom',
    tokenMilestone: milestone,
    createdAt: new Date().toISOString()
  };
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

let state, gardenSvg, currentGroundY;

function fullRender(newIds = []) {
  const container = document.getElementById('garden-container');
  const W = container.clientWidth || 800;
  const H = container.clientHeight || 600;
  currentGroundY = H * GROUND_RATIO;

  gardenSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  while (gardenSvg.firstChild) gardenSvg.removeChild(gardenSvg.firstChild);

  const gRand = mkRand(weekSeed(new Date(state.weekStart)) + 99);
  drawGround(gardenSvg, state.weekPalette, gRand, W, currentGroundY);

  // Draw tallest stems behind shorter ones
  const sorted = [...state.flowers].sort((a, b) => {
    const ra = mkRand(a.seed), rb = mkRand(b.seed);
    return (rb() * 95 + 50) - (ra() * 95 + 50);
  });

  sorted.forEach(f => renderFlower(f, gardenSvg, currentGroundY, newIds.includes(f.id)));

  // Stagger new flower animations
  newIds.forEach((id, i) => {
    const el = gardenSvg.querySelector(`[data-id="${id}"]`);
    if (el) el.style.animationDelay = `${i * 0.18}s`;
  });
}

function miniRender(arc, svgElement) {
  const W = 576, H = 130;
  const gY = H * 0.78;
  svgElement.setAttribute('viewBox', `0 0 ${W} ${H}`);
  while (svgElement.firstChild) svgElement.removeChild(svgElement.firstChild);

  const gRand = mkRand(weekSeed(new Date(arc.weekStart)) + 99);
  drawGround(svgElement, arc.palette, gRand, W, gY);

  [...arc.flowers]
    .sort((a, b) => mkRand(b.seed)() - mkRand(a.seed)())
    .forEach(f => renderFlower(f, svgElement, gY, false));
}

// ─── UI UPDATES ───────────────────────────────────────────────────────────────

function updateStats() {
  const nextIn = TOKENS_PER_FLOWER - (state.totalTokens % TOKENS_PER_FLOWER);
  document.getElementById('total-tokens').textContent = state.totalTokens.toLocaleString();
  document.getElementById('flower-count').textContent = state.flowers.length;
  document.getElementById('next-flower').textContent = nextIn.toLocaleString();
}

function addTokens(count) {
  const before = Math.floor(state.totalTokens / TOKENS_PER_FLOWER);
  state.totalTokens += count;
  const after = Math.floor(state.totalTokens / TOKENS_PER_FLOWER);

  const newIds = [];
  const W = (document.getElementById('garden-container').clientWidth || 800);

  for (let i = before; i < after; i++) {
    const milestone = (i + 1) * TOKENS_PER_FLOWER;
    const fRand = mkRand(milestone ^ state.totalTokens);
    const f = makeFlower(milestone, state.weekPalette, W, currentGroundY, fRand);
    state.flowers.push(f);
    newIds.push(f.id);
  }

  saveState(state);
  updateStats();
  fullRender(newIds);
}

function renderArchiveList() {
  const list = document.getElementById('archive-list');
  list.innerHTML = '';

  if (!state.archives.length) {
    list.innerHTML = '<p class="archive-empty">No archived weeks yet — your first archive will appear after the weekly reset on Monday.</p>';
    return;
  }

  [...state.archives].reverse().forEach(arc => {
    const wrap = document.createElement('div');
    wrap.className = 'archive-week';

    const header = document.createElement('div');
    header.className = 'archive-week-header';
    header.textContent = `${fmtDate(arc.weekStart)} – ${fmtDate(arc.weekEnd)}  ·  ${arc.flowerCount} flower${arc.flowerCount !== 1 ? 's' : ''}  ·  ${arc.totalTokens.toLocaleString()} tokens`;
    wrap.appendChild(header);

    const arcSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wrap.appendChild(arcSvg);
    list.appendChild(wrap);
    miniRender(arc, arcSvg);
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

function init() {
  gardenSvg = document.getElementById('garden-svg');
  state = loadState();

  if (checkWeekReset(state)) saveState(state);

  fullRender();
  updateStats();

  // Log tokens
  const logModal = document.getElementById('log-modal');
  const tokenInput = document.getElementById('token-input');

  document.getElementById('log-btn').addEventListener('click', () => {
    logModal.classList.remove('hidden');
    tokenInput.focus();
  });

  document.getElementById('log-confirm').addEventListener('click', () => {
    const val = parseInt(tokenInput.value);
    if (val > 0) {
      addTokens(val);
      tokenInput.value = '';
      logModal.classList.add('hidden');
    }
  });

  tokenInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('log-confirm').click();
    if (e.key === 'Escape') document.getElementById('log-cancel').click();
  });

  document.getElementById('log-cancel').addEventListener('click', () => {
    tokenInput.value = '';
    logModal.classList.add('hidden');
  });

  // Archive
  const archiveModal = document.getElementById('archive-modal');

  document.getElementById('archive-btn').addEventListener('click', () => {
    renderArchiveList();
    archiveModal.classList.remove('hidden');
  });

  document.getElementById('archive-close').addEventListener('click', () => {
    archiveModal.classList.add('hidden');
  });

  // Resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => fullRender(), 180);
  });
}

document.addEventListener('DOMContentLoaded', init);
