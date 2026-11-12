/* The site's one script, with no dependencies and no network calls.
 * It adds, in order: the star field, the particle title, the film's cover and theatre, the music box, and the
 * small live details (clock, copy buttons, arrivals on scroll). Every part is an enhancement: with scripts off
 * the page still reads in full and the film plays with the browser's own controls.
 * Every number below is set by judgement, unmeasured, unless its comment gives a derivation. */
(() => {
  'use strict';
  const doc = document, root = doc.documentElement;
  const $ = (s, el = doc) => el.querySelector(s);
  const $$ = (s, el = doc) => Array.from(el.querySelectorAll(s));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;
  const state = { theatre: false, filmPlaying: false };
  const listeners = [];
  const onChange = (fn) => listeners.push(fn);
  const changed = () => listeners.forEach((fn) => fn());
  // a seeded generator, so the sky and the title's grain are the same on every visit
  function prng(seed) { let s = seed | 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const gauss = (r) => { let u = 0; for (let i = 0; i < 4; i++) u += r(); return (u - 2) / 0.58; }; // about a unit normal

  // ====================================================================================================
  // The sky: a few hundred stars in three depths that drift, twinkle and slide past as the page scrolls.
  // ====================================================================================================
  function Sky(canvas) {
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    const TINTS = ['223,230,255', '223,230,255', '223,230,255', '223,230,255', '223,230,255', '159,212,255', '201,176,255', '255,220,170'];
    let w = 0, h = 0, dpr = 1, stars = [], links = [], linkA = 0.16, raf = 0, visible = true;
    function build() {
      const r = prng(20261111);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      // one star to about every 4,300 square pixels: 300 on a 1440 x 900 laptop, 90 at least on a phone
      const n = clamp(Math.round((w * h) / 4300), 90, 420);
      stars = [];
      for (let i = 0; i < n; i++) {
        const z = 0.12 + Math.pow(r(), 2.2) * 0.88;
        stars.push({ x: r() * w, y: r() * h, z, r: 0.4 + z * 0.95, a: 0.22 + z * 0.7 * (0.5 + r() * 0.5), ph: r() * TAU, tw: 0.3 + r() * 1.5, tint: TINTS[(r() * TINTS.length) | 0] });
      }
      // a few small constellations, each a handful of points joined to their nearest neighbours: the film's
      // knowledge graph, kept to the sides on a wide screen so that it never sits behind the words
      links = [];
      const wide = w > 900, groups = wide ? clamp(Math.round(w / 300), 3, 5) : 2;
      linkA = wide ? 0.13 : 0.08;
      for (let g = 0; g < groups; g++) {
        const side = g % 2 === 0, cx = wide ? (side ? 40 + r() * 0.14 * w : w - 40 - r() * 0.14 * w) : r() * w, cy = 120 + (g + 0.1 + r() * 0.8) * ((h - 150) / groups);
        const z = 0.5 + r() * 0.3, m = 7 + ((r() * 5) | 0), rad = 24 + r() * 30, tint = side ? '159,212,255' : '201,176,255', nodes = [];
        for (let k = 0; k < m; k++) {
          const ang = r() * TAU, q = Math.pow(r(), 0.7) * rad, hub = k === 0;
          const s = { x: cx + Math.cos(ang) * q * 1.35, y: cy + Math.sin(ang) * q, z, r: hub ? 2 : 0.85 + r() * 0.7, hub, a: hub ? 0.95 : 0.5 + r() * 0.4, ph: r() * TAU, tw: 0.3 + r() * 1.2, tint };
          stars.push(s); nodes.push(s);
        }
        for (let i = 1; i < m; i++) {
          const by = nodes.map((nd, j) => [j, Math.hypot(nd.x - nodes[i].x, nd.y - nodes[i].y)]).filter((e) => e[0] !== i).sort((a, b) => a[1] - b[1]);
          links.push([nodes[i], nodes[by[0][0]]]);
          if (r() < 0.3) links.push([nodes[i], nodes[0]]); // some reach the hub
        }
      }
    }
    function draw(now) {
      const t = now / 1000, sy = window.scrollY || 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const pos = (s) => {
        const x = (((s.x + t * s.z * 1.1) % (w + 20)) + (w + 20)) % (w + 20) - 10;
        const y = (((s.y - sy * s.z * 0.16) % (h + 20)) + (h + 20)) % (h + 20) - 10;
        return [x, y];
      };
      ctx.lineWidth = 0.6;
      for (const [a, b] of links) {
        const [ax, ay] = pos(a), [bx, by] = pos(b), dx = ax - bx, dy = ay - by, d2 = dx * dx + dy * dy;
        if (d2 > 170 * 170) continue; // one of the pair has wrapped round the screen
        ctx.strokeStyle = `rgba(${a.tint},${linkA * (1 - d2 / (170 * 170))})`;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
      for (const s of stars) {
        const [x, y] = pos(s), a = s.a * (0.72 + 0.28 * Math.sin(t * s.tw + s.ph));
        ctx.fillStyle = `rgba(${s.tint},${a})`;
        if (s.r < 0.8) ctx.fillRect(x, y, s.r * 1.6, s.r * 1.6);
        else { ctx.beginPath(); ctx.arc(x, y, s.r, 0, TAU); ctx.fill(); }
        if (s.hub) { ctx.fillStyle = `rgba(${s.tint},${a * 0.13})`; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); }
      }
    }
    // the stars drift slowly, so every other frame is enough; a scroll redraws at once so they keep pace with the page
    let odd = false;
    function loop(now) { raf = 0; if (!visible || state.theatre) return; odd = !odd; if (odd) draw(now); raf = requestAnimationFrame(loop); }
    window.addEventListener('scroll', () => { if (visible && !state.theatre && !reduced.matches) draw(performance.now()); }, { passive: true });
    function wake() { if (reduced.matches) { draw(0); return; } if (!raf && visible && !state.theatre) raf = requestAnimationFrame(loop); }
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(window.innerWidth - w) > 1 || Math.abs(window.innerHeight - h) > 120) { build(); wake(); } }, 160); });
    doc.addEventListener('visibilitychange', () => { visible = !doc.hidden; wake(); });
    reduced.addEventListener?.('change', wake);
    onChange(wake);
    build(); wake();
  }

  // ====================================================================================================
  // The music box: off until asked for. Moving across the title plucks a D flat pentatonic scale.
  // ====================================================================================================
  const Sound = (() => {
    // D flat major pentatonic from D flat 4 to D flat 6, equal temperament from A4 = 440 Hz
    const SCALE = [277.18, 311.13, 349.23, 415.30, 466.16, 554.37, 622.25, 698.46, 830.61, 932.33, 1108.73];
    let ac = null, input = null, on = false, lastAt = 0, lastIdx = -1;
    // the chain every note passes through: a soft low-pass, one quiet echo, a limiter as a safety
    function graph(ctx) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; lp.Q.value = 0.3;
      const out = ctx.createGain(); out.gain.value = 0.9;
      const delay = ctx.createDelay(1); delay.delayTime.value = 0.31;
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 1800;
      const fb = ctx.createGain(); fb.gain.value = 0.34;
      const wet = ctx.createGain(); wet.gain.value = 0.26;
      const limit = ctx.createDynamicsCompressor(); limit.threshold.value = -14; limit.ratio.value = 8;
      lp.connect(out); lp.connect(delay); delay.connect(tone); tone.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(out);
      out.connect(limit); limit.connect(ctx.destination);
      return lp;
    }
    // one note: a sine with a quiet octave above it and a brief chime on the attack, dying away over about 2 s
    function pluck(ctx, into, freq, when, vel) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.11 * vel, when + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 1.9);
      const o1 = ctx.createOscillator(); o1.frequency.value = freq;
      const o2 = ctx.createOscillator(); o2.frequency.value = freq * 2.003; const g2 = ctx.createGain(); g2.gain.value = 0.22;
      const o3 = ctx.createOscillator(); o3.frequency.value = freq * 4.01; const g3 = ctx.createGain();
      g3.gain.setValueAtTime(0.09, when); g3.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);
      o1.connect(g); o2.connect(g2); g2.connect(g); o3.connect(g3); g3.connect(g); g.connect(into);
      for (const o of [o1, o2, o3]) { o.start(when); o.stop(when + 2); }
    }
    function set(v) {
      on = v;
      if (on) {
        try {
          if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; ac = new AC(); input = graph(ac); }
          if (ac.state === 'suspended') ac.resume();
          const t = ac.currentTime + 0.03; // three rising notes say that it is on
          pluck(ac, input, SCALE[2], t, 0.7); pluck(ac, input, SCALE[4], t + 0.13, 0.7); pluck(ac, input, SCALE[7], t + 0.26, 0.8);
        } catch (e) { on = false; }
      } else if (ac && ac.state === 'running') { ac.suspend(); }
      return on;
    }
    // u: where along the title the pointer is, 0 at its left edge to 1 at its right
    function touch(u, vel) {
      if (!on || !ac || state.filmPlaying) return;
      const now = performance.now(); if (now - lastAt < 95) return;
      let idx = clamp(Math.round(u * (SCALE.length - 1)), 0, SCALE.length - 1);
      if (idx === lastIdx && now - lastAt < 420) return;
      lastAt = now; lastIdx = idx;
      pluck(ac, input, SCALE[idx], ac.currentTime + 0.005, clamp(vel, 0.35, 1));
    }
    return { SCALE, graph, pluck, set, touch, get on() { return on; }, quiet() { if (ac && ac.state === 'running' && on) ac.suspend(); }, wake() { if (ac && on && ac.state === 'suspended') ac.resume(); } };
  })();

  // ====================================================================================================
  // The particle title: the word drawn as a few thousand points of light, blue on the left where the
  // knowledge is and violet on the right where the mind is. The points gather on arrival, give way to
  // the pointer and settle back.
  // ====================================================================================================
  function Dust(canvas, titleEl, hero, slot) {
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx || !titleEl) return;
    // a point is drawn as a small disc 3.6 times its radius across (solid to the radius, then a soft edge), and the
    // few brighter "nodes" get a wide soft light on top
    const SPR = 3.6;
    const STOPS = [[136, 205, 255], [214, 227, 255], [197, 160, 255]]; // blue, pale periwinkle, violet
    const PAL = 24, sprites = [], lights = [];
    for (let i = 0; i < PAL; i++) {
      const t = i / (PAL - 1), a = t < 0.46 ? STOPS[0] : STOPS[1], b = t < 0.46 ? STOPS[1] : STOPS[2], k = t < 0.46 ? t / 0.46 : (t - 0.46) / 0.54;
      const rgb = [0, 1, 2].map((c) => Math.round(lerp(a[c], b[c], k))).join(',');
      const disc = (stops) => {
        const sc = doc.createElement('canvas'); sc.width = sc.height = 32;
        const g = sc.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        for (const [at, al] of stops) gr.addColorStop(at, `rgba(${rgb},${al})`);
        g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return sc;
      };
      sprites.push(disc([[0, 1], [0.5, 1], [0.72, 0.4], [1, 0]]));
      lights.push(disc([[0, 0.55], [0.3, 0.2], [1, 0]]));
    }
    let W = 0, H = 0, dpr = 1, dots = [], P = {}, raf = 0, t0 = 0, last = 0, inView = true, built = false, key = '', box = { x: 0, w: 1 }, calm = false, skip = false;
    const pointer = { x: -999, y: -999, vx: 0, vy: 0, at: -9999, px: 0, py: 0, pt: 0 };
    const stats = state.dust = { frames: 0, ms: 0, points: 0 }; // what drawing the title costs, for the checks

    function build(intro) {
      const r = prng(7);
      const cs = getComputedStyle(titleEl), fontPx = parseFloat(cs.fontSize), text = titleEl.textContent.trim();
      const font = `${cs.fontWeight} ${fontPx}px ${cs.fontFamily}`;
      const hr = hero.getBoundingClientRect(), tr = titleEl.getBoundingClientRect(), sr = slot.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hr.width; H = Math.max(40, sr.top - hr.top - 2); // the band above the film: no point is ever drawn over it
      canvas.style.height = H + 'px';
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      // the word, drawn off screen at twice its size and read back as a map of where its ink is
      const S = 2, oc = doc.createElement('canvas'), o = oc.getContext('2d', { willReadFrequently: true });
      const setFont = () => { o.font = font; try { o.letterSpacing = cs.letterSpacing; } catch (e) { /* older browsers: natural spacing */ } };
      setFont();
      const m = o.measureText(text), asc = Math.ceil(m.actualBoundingBoxAscent), desc = Math.ceil(m.actualBoundingBoxDescent), left = Math.ceil(m.actualBoundingBoxLeft || 0);
      const tw = Math.ceil(m.width + left) + 6, th = asc + desc + 6;
      oc.width = tw * S; oc.height = th * S; o.scale(S, S); setFont();
      o.fillStyle = '#fff'; o.textBaseline = 'alphabetic'; o.fillText(text, left + 3, asc + 3);
      const img = o.getImageData(0, 0, oc.width, oc.height).data;
      const ink = (x, y) => { const xi = Math.round(x * S), yi = Math.round(y * S); return xi < 0 || yi < 0 || xi >= oc.width || yi >= oc.height ? 0 : img[(yi * oc.width + xi) * 4 + 3]; };
      const ox = tr.left - hr.left + (tr.width - tw) / 2, oy = tr.top - hr.top + (tr.height - th) / 2 + fontPx * 0.02;
      box = { x: ox, w: tw };
      // one point to every `step` pixels on a jittered triangular grid, plus the dust round the edges:
      // 2,998 points at a 135 px title (counted at 1440 x 900), about 1.7 ms of script a frame there
      const step = clamp(fontPx / 46, 2, 3.2), rowH = step * 0.866;
      P = { R: clamp(fontPx * 0.56, 42, 84), push: 1500 * clamp(fontPx / 110, 0.7, 1.25), drag: 3.2 };
      dots = [];
      const add = (x, y, halo) => {
        const u = clamp(x / tw, 0, 1), node = !halo && r() < 0.04;
        const hx = ox + x, hy = oy + y, ang = r() * TAU, far = (0.25 + r() * 0.75) * Math.max(W * 0.3, 160);
        dots.push({
          hx, hy, x: hx, y: hy, vx: 0, vy: 0, u, node,
          r: step * (halo ? 0.13 + r() * 0.07 : node ? 0.33 + r() * 0.08 : 0.2 + r() * 0.1),
          a: halo ? 0.22 + r() * 0.3 : node ? 1 : 0.62 + r() * 0.38,
          ci: clamp(Math.round((u + (r() - 0.5) * 0.12) * (PAL - 1)), 0, PAL - 1),
          ph: r() * TAU, tw: 0.5 + r() * 1.7, k: halo ? 20 : 46, c: halo ? 5.5 : 9.5,
          // arrival: from a loose cloud, left of the word first, each along a slightly curved path
          mode: intro ? 0 : 1, sx: hx + Math.cos(ang) * far * 1.2, sy: clamp(hy + Math.sin(ang) * far * 0.5, -20, H + 20),
          cx: (r() - 0.5) * 120, cy: (r() - 0.5) * 80, delay: 0.05 + u * 0.45 + r() * 0.3, dur: 0.95 + r() * 0.45,
        });
      };
      let row = 0;
      for (let y = 0; y < th; y += rowH, row++) {
        for (let x = row & 1 ? step / 2 : 0; x < tw; x += step) {
          const jx = x + (r() - 0.5) * step * 0.72, jy = y + (r() - 0.5) * step * 0.72;
          if (ink(jx, jy) > 100) { add(jx, jy, false); if (r() < 0.12) add(jx + gauss(r) * fontPx * 0.04, jy + gauss(r) * fontPx * 0.04, true); }
        }
      }
      dots.sort((a, b) => a.ci - b.ci);
      t0 = performance.now() / 1000; built = true; calm = false;
      key = [Math.round(W), Math.round(H), Math.round(fontPx), Math.round(tr.left), cs.fontFamily].join('|');
      root.classList.add('dust-on');
    }

    function frame(now) {
      raf = 0;
      if (!built) return;
      // at rest (no arrival, no pointer, nothing still settling) the title only twinkles: every other frame is enough
      if (calm && (skip = !skip)) { wake(); return; }
      const began = performance.now();
      const t = now / 1000, dt = clamp(t - last, 0.001, calm ? 0.05 : 0.034), tt = t - t0; last = t;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const still = reduced.matches;
      const pa = !still && now - pointer.at < 900, R = P.R, R2 = R * R, px = pointer.x, py = pointer.y;
      pointer.vx *= 0.86; pointer.vy *= 0.86;
      const pvx = clamp(pointer.vx, -1400, 1400), pvy = clamp(pointer.vy, -1400, 1400);
      // every 7.5 s a soft light crosses the word from the knowledge side to the mind side in 1.7 s
      const wp = still ? -1 : (((tt - 2.6) % 7.5) + 7.5) % 7.5 / 1.7, front = tt > 2.6 && wp <= 1 ? lerp(-0.2, 1.2, wp) : -9;
      let touched = 0, moving = false, fastest = 0;
      for (let i = 0, n = dots.length; i < n; i++) {
        const d = dots[i];
        let a = d.a, size = d.r;
        if (d.mode === 0) {
          const p = (tt - d.delay) / d.dur;
          if (p <= 0) { moving = true; continue; }
          if (p >= 1) { d.mode = 1; d.x = d.hx; d.y = d.hy; }
          else {
            const e = 1 - Math.pow(1 - p, 3.2), k = 1 - e, bend = Math.sin(Math.PI * p) * k;
            d.x = d.hx + (d.sx - d.hx) * k + d.cx * bend; d.y = d.hy + (d.sy - d.hy) * k + d.cy * bend;
            a *= Math.min(1, p * 2.4); moving = true;
          }
        } else if (!still) {
          let ax = (d.hx - d.x) * d.k - d.vx * d.c, ay = (d.hy - d.y) * d.k - d.vy * d.c;
          if (pa) {
            const dx = d.x - px, dy = d.y - py, q = dx * dx + dy * dy;
            if (q < R2) { const dist = Math.sqrt(q) || 0.001, f = 1 - dist / R, f2 = f * f; ax += (dx / dist) * P.push * f2 + pvx * P.drag * f2; ay += (dy / dist) * P.push * f2 + pvy * P.drag * f2; touched++; }
          }
          d.vx += ax * dt; d.vy += ay * dt; d.x += d.vx * dt; d.y += d.vy * dt;
          const sp = d.vx * d.vx + d.vy * d.vy; if (sp > fastest) fastest = sp;
        }
        let b = still ? 0.92 : 0.8 + 0.2 * Math.sin(t * d.tw + d.ph);
        if (front > -1) { const q = (d.u - front) / 0.1, wv = Math.exp(-q * q); b += wv * 0.32; size *= 1 + wv * 0.16; }
        const s = size * SPR;
        ctx.globalAlpha = Math.min(1, a * b);
        ctx.drawImage(sprites[d.ci], d.x - s / 2, d.y - s / 2, s, s);
        if (d.node) { const s2 = s * 4.2; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, 0.5 * b); ctx.drawImage(lights[d.ci], d.x - s2 / 2, d.y - s2 / 2, s2, s2); ctx.globalCompositeOperation = 'source-over'; }
      }
      ctx.globalAlpha = 1;
      calm = !moving && !pa && fastest < 9; // nothing arriving, no pointer near, no point faster than 3 px a second
      stats.frames++; stats.ms += performance.now() - began; stats.points = dots.length;
      if (touched > 4) Sound.touch((px - box.x) / box.w, 0.45 + Math.hypot(pvx, pvy) / 1600);
      if (still && !moving) return; // one still picture is enough
      wake();
    }
    function wake() { if (!raf && built && inView && !doc.hidden && !state.theatre) raf = requestAnimationFrame(frame); }

    // the pointer, in the canvas's own coordinates
    function at(e) {
      const cr = canvas.getBoundingClientRect(), x = e.clientX - cr.left, y = e.clientY - cr.top, now = performance.now(), dt = Math.max(8, now - pointer.pt) / 1000;
      if (now - pointer.pt < 250) { pointer.vx = lerp(pointer.vx, (x - pointer.px) / dt, 0.5); pointer.vy = lerp(pointer.vy, (y - pointer.py) / dt, 0.5); }
      pointer.px = pointer.x = x; pointer.py = pointer.y = y; pointer.pt = now;
      if (y > -P.R && y < H + P.R) { pointer.at = now; calm = false; }
    }
    window.addEventListener('pointermove', at, { passive: true });
    window.addEventListener('pointerdown', (e) => {
      at(e);
      if (!built || reduced.matches || pointer.y < -10 || pointer.y > H + 10) return;
      // a tap sends one ripple out through the points near it
      const R = P.R * 1.7; let hit = 0;
      for (const d of dots) { if (d.mode !== 1) continue; const dx = d.x - pointer.x, dy = d.y - pointer.y, q = Math.hypot(dx, dy); if (q < R) { const f = (1 - q / R) * 230; d.vx += (dx / (q || 1)) * f; d.vy += (dy / (q || 1)) * f; hit++; } }
      calm = false;
      if (hit > 4) Sound.touch((pointer.x - box.x) / box.w, 0.9);
    }, { passive: true });

    new IntersectionObserver((en) => { inView = en[0].isIntersecting; wake(); }).observe(canvas);
    doc.addEventListener('visibilitychange', wake);
    onChange(wake);
    reduced.addEventListener?.('change', () => { build(false); wake(); });
    let rt = 0;
    const refit = () => {
      const cs = getComputedStyle(titleEl), hr = hero.getBoundingClientRect(), tr = titleEl.getBoundingClientRect(), sr = slot.getBoundingClientRect();
      const k = [Math.round(hr.width), Math.round(Math.max(40, sr.top - hr.top - 2)), Math.round(parseFloat(cs.fontSize)), Math.round(tr.left), cs.fontFamily].join('|');
      if (k !== key && !state.theatre) { build(false); wake(); }
    };
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(refit, 140); });
    onChange(() => { if (built && !state.theatre) refit(); }); // the window may have changed size while the film had the screen
    // draw the word in its own typeface: wait for it, but not for long
    const start = () => { if (built) return; try { build(!reduced.matches); wake(); } catch (e) { root.classList.remove('dust-on'); } };
    const face = `700 ${Math.round(parseFloat(getComputedStyle(titleEl).fontSize))}px Inter`;
    if (doc.fonts && doc.fonts.load) {
      doc.fonts.load(face, titleEl.textContent).then(start, start);
      setTimeout(start, 1400);
      doc.fonts.ready.then(() => { if (built) refit(); });
    } else start();
  }

  // ====================================================================================================
  // The film: one press plays it. On a laptop the lights go down and it takes the screen; on a phone it
  // opens full screen. The six moments further down play it from their own points.
  // ====================================================================================================
  function Film() {
    const film = $('#film'), video = $('#video');
    if (!film || !video) return;
    const cover = $('#film-cover'), end = $('#film-end'), closeBtn = $('#film-close'), veil = $('#veil'), glow = $('#film-glow'), slot = film.parentElement;
    const theatreMQ = matchMedia('(min-width: 900px) and (min-height: 540px) and (hover: hover) and (pointer: fine)');
    const phoneMQ = matchMedia('(pointer: coarse) and (max-width: 760px), (pointer: coarse) and (max-height: 520px)');
    let opener = null, glowTimer = 0;
    video.controls = false; // the cover is the way in; the browser's controls return once it plays

    // the light behind the frame: the poster's colours at rest, the film's own while it plays
    // It is softened by drawing the picture 8 pixels wide and letting the browser stretch it, which costs
    // nothing; a large blur filter cost a third of the frames in one browser (60 fell to 42 a second, measured headless).
    const gctx = glow && glow.getContext && glow.getContext('2d'), tiny = doc.createElement('canvas'); tiny.width = 8; tiny.height = 5;
    const tctx = tiny.getContext('2d');
    const paint = (src) => { if (!gctx || !tctx) return; try { tctx.drawImage(src, 0, 0, tiny.width, tiny.height); gctx.clearRect(0, 0, glow.width, glow.height); gctx.drawImage(tiny, 0, 0, glow.width, glow.height); } catch (e) { /* not ready */ } };
    const paintGlow = () => { if (video.readyState >= 2 && !video.ended) paint(video); };
    if (gctx && video.poster) { const im = new Image(); im.onload = () => { if (!film.classList.contains('is-started')) paint(im); }; im.src = video.poster; }

    function fly(first, last, entering) {
      if (reduced.matches || !film.animate) return;
      const dx = first.left + first.width / 2 - (last.left + last.width / 2), dy = first.top + first.height / 2 - (last.top + last.height / 2), s = first.width / last.width;
      const base = entering ? 'translate(-50%, -50%) ' : '';
      const far = Math.abs(dy) > window.innerHeight; // its place in the page is off screen: fade instead of flying across
      const from = far ? { transform: `${base}scale(${entering ? 0.96 : 1})`, opacity: 0 } : { transform: `${base}translate(${dx}px, ${dy}px) scale(${s})` };
      film.animate([from, { transform: entering ? 'translate(-50%, -50%)' : 'none', opacity: 1 }], { duration: far ? 380 : 640, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    }
    const dim = (v) => $$('[data-dim]').forEach((el) => { el.inert = v; });
    function enterTheatre() {
      if (state.theatre) return;
      const first = film.getBoundingClientRect();
      state.theatre = true; root.classList.add('theatre'); closeBtn.hidden = false; dim(true);
      fly(first, film.getBoundingClientRect(), true);
      changed();
      video.focus({ preventScroll: true });
    }
    function exitTheatre(keepPlaying) {
      if (!state.theatre) return;
      const first = film.getBoundingClientRect();
      state.theatre = false; root.classList.remove('theatre'); closeBtn.hidden = true; dim(false);
      fly(first, film.getBoundingClientRect(), false);
      if (!keepPlaying && !video.paused) video.pause();
      changed();
      if (opener && opener.focus && doc.contains(opener)) opener.focus({ preventScroll: true });
    }
    function play(t, from) {
      opener = from || doc.activeElement;
      end.hidden = true;
      film.classList.add('is-started');
      video.controls = true;
      if (t != null) { if (video.readyState >= 1) { try { video.currentTime = t; } catch (e) { /* plays from the start */ } } else video.addEventListener('loadedmetadata', () => { try { video.currentTime = t; } catch (e) { /* plays from the start */ } }, { once: true }); }
      const p = video.play(); if (p && p.catch) p.catch(() => {}); // refused: the browser's own play button is showing
      if (theatreMQ.matches) enterTheatre();
      else {
        if (from !== cover) slot.scrollIntoView({ block: 'center', behavior: reduced.matches ? 'auto' : 'smooth' });
        // an iPhone opens its own full-screen player on play; other phones are asked for one
        if (phoneMQ.matches && video.requestFullscreen) video.requestFullscreen({ navigationUI: 'hide' }).then(() => { const so = screen.orientation; if (so && so.lock) so.lock('landscape').catch(() => {}); }).catch(() => {});
      }
    }

    cover.addEventListener('click', () => play(null, cover));
    cover.addEventListener('pointerenter', () => { video.preload = 'auto'; }, { once: true });
    $('#film-replay').addEventListener('click', () => play(0, cover));
    closeBtn.addEventListener('click', () => exitTheatre(false));
    veil.addEventListener('click', () => exitTheatre(false));
    doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.theatre && !doc.fullscreenElement) { e.preventDefault(); exitTheatre(false); } });
    $$('[data-leave-theatre]').forEach((a) => a.addEventListener('click', () => exitTheatre(false)));
    theatreMQ.addEventListener?.('change', () => { if (!theatreMQ.matches) exitTheatre(true); });
    $$('.moment[data-t]').forEach((a) => a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return; // a new tab still opens the film file at that point
      e.preventDefault(); play(parseFloat(a.dataset.t), a);
    }));

    video.addEventListener('play', () => { state.filmPlaying = true; film.classList.add('is-started'); video.controls = true; end.hidden = true; Sound.quiet(); clearInterval(glowTimer); glowTimer = setInterval(paintGlow, 200); changed(); });
    video.addEventListener('pause', () => { state.filmPlaying = false; clearInterval(glowTimer); Sound.wake(); changed(); });
    video.addEventListener('ended', () => {
      state.filmPlaying = false; clearInterval(glowTimer);
      if (doc.fullscreenElement && doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
      else if (video.webkitDisplayingFullscreen && video.webkitExitFullscreen) video.webkitExitFullscreen();
      const within = film.contains(doc.activeElement);
      video.controls = false; end.hidden = false;
      exitTheatre(true); Sound.wake(); changed();
      if (within) $('#film-replay').focus({ preventScroll: true }); // keep a keyboard user's place
    });
    if ('mediaSession' in navigator && window.MediaMetadata) {
      try { navigator.mediaSession.metadata = new MediaMetadata({ title: 'aiMyth: build your second self', artist: 'Mingjun (Jerry) Zhang', artwork: [{ src: video.poster, sizes: '1536x864', type: 'image/jpeg' }] }); } catch (e) { /* optional */ }
    }
  }

  // ====================================================================================================
  // The small things.
  // ====================================================================================================
  function Chrome() {
    // the masthead gains a ground once the page has moved
    const mast = $('#mast');
    const onScroll = () => mast && mast.classList.toggle('scrolled', (window.scrollY || 0) > 24);
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    // arrivals: each block rises in as it enters the screen, neighbours a beat apart
    const items = $$('[data-reveal]');
    if ('IntersectionObserver' in window && !reduced.matches) {
      const io = new IntersectionObserver((entries) => {
        entries.filter((en) => en.isIntersecting).forEach((en, i) => { en.target.style.setProperty('--d', Math.min(i, 5) * 80 + 'ms'); en.target.classList.add('in'); io.unobserve(en.target); });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      items.forEach((el) => io.observe(el));
    } else items.forEach((el) => el.classList.add('in'));

    // Oxford's time, from the visitor's own clock
    const clocks = [$('#clock'), $('#clock-2')].filter(Boolean);
    if (clocks.length) {
      let fmt = null;
      try { fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London', timeZoneName: 'short' }); } catch (e) { /* no time zone data */ }
      const tick = () => {
        if (!fmt) return;
        const p = {}; for (const part of fmt.formatToParts(new Date())) p[part.type] = part.value;
        // Oxford keeps two times, and browsers name them differently ("GMT+1", "BST", "UTC+1"): say GMT or BST
        const zone = p.timeZoneName ? (/BST|\+0?1/.test(p.timeZoneName) ? 'BST' : 'GMT') : '';
        const text = `${p.hour}:${p.minute}${zone ? ' ' + zone : ''}`;
        clocks.forEach((el) => { if (el.textContent !== text) el.textContent = text; });
      };
      tick(); setInterval(tick, 10000);
    }

    // copy buttons
    $$('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
      const text = btn.dataset.copy, label = btn.textContent;
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
        const ta = doc.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        doc.body.appendChild(ta); ta.select(); try { ok = doc.execCommand('copy'); } catch (e2) { ok = false; } ta.remove();
      }
      btn.textContent = ok ? 'Copied' : 'Press Ctrl C'; btn.classList.toggle('done', ok);
      setTimeout(() => { btn.textContent = label; btn.classList.remove('done'); }, 1800);
    }));

    // the sound switch
    const sw = $('#sound');
    if (sw) sw.addEventListener('click', () => {
      const v = Sound.set(sw.getAttribute('aria-pressed') !== 'true');
      sw.setAttribute('aria-pressed', String(v)); $('.v', sw).textContent = v ? 'on' : 'off';
    });

    // a light that follows the pointer across each card
    if (matchMedia('(hover: hover)').matches) {
      doc.addEventListener('pointermove', (e) => {
        const card = e.target.closest && e.target.closest('.card'); if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', e.clientX - r.left + 'px'); card.style.setProperty('--my', e.clientY - r.top + 'px');
      }, { passive: true });
    }
  }

  const boot = () => {
    const safe = (fn) => { try { fn(); } catch (e) { if (window.console) console.error(e); } };
    safe(Chrome);
    safe(Film);
    safe(() => Sky($('#sky')));
    safe(() => Dust($('#dust'), $('#title'), $('#hero'), $('.film-slot')));
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
  window.__site = { state, Sound }; // a handle for the checks in tools/, unused by the page
})();
