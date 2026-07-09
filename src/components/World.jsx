import { useCallback, useEffect, useRef, useState } from 'react';
import { LINKS, NODES } from '../data/cv';
import Gallery from './Gallery';
import s from './world.module.css';

/* ------------------------------------------------------------------ */
/* World constants (world-space px)                                     */
/* ------------------------------------------------------------------ */

const BOUNDS = { minX: -1060, maxX: 1060, minY: -480, maxY: 620 };
const START_CAM_Y = 55;
// Offset up-and-right of base camp so the player never sits on its label.
const START_PLAYER_X = 110;
const START_PLAYER_Y = 40;
const GRID = 46;
const NEAR = 155; // distance at which a node becomes "active" (inspectable)
const DISCOVER = 190; // distance at which a node is marked discovered
const HOME_R = 130; // walk back inside this radius to trigger the gallery
const TILT_X = 12; // resting pitch of the map plane, degrees
const TRAIL_MAX = 34;
const MOVE_KEYS = new Set([
  'w', 'a', 's', 'd',
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
]);

const COFFEE_RINGS = [
  { x: -820, y: 380, r: 74 },
  { x: 830, y: -370, r: 52 },
  { x: 300, y: 520, r: 96 },
];

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

/** Canvas can't read CSS custom properties — mirror the per-kind accents here. */
const KIND_RGB = {
  home: '221,132,18',
  studio: '180,83,10',
  gov: '63,107,83',
  product: '124,63,94',
  client: '45,90,120',
  beacon: '221,132,18',
};

/** Deterministic pseudo-random in [0,1) — keeps hand-drawn wobble stable across frames. */
const rand = (i) => {
  const x = Math.sin(i * 127.1 + 11.7) * 43758.5453;
  return x - Math.floor(x);
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Quadratic bezier point + the control point used to draw each ink route. */
const routeControl = (a, b, i) => {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = (rand(i) - 0.5) * 0.34 * len;
  return { x: mx + (-dy / len) * bow, y: my + (dx / len) * bow };
};

const qPoint = (a, c, b, t) => {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
};

/* ------------------------------------------------------------------ */

export default function World({ onOpen, paused = false }) {
  const stageRef = useRef(null);
  const tiltRef = useRef(null);
  const canvasRef = useRef(null);
  const layerRef = useRef(null);
  const playerDotRef = useRef(null);
  const arrowRefs = useRef({});

  const [activeId, setActiveId] = useState(null);
  const [discovered, setDiscovered] = useState(() => new Set());
  const [touched, setTouched] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [gallery, setGallery] = useState(false);

  // Mutable simulation state — deliberately outside React so the rAF loop
  // never triggers a re-render.
  const sim = useRef({
    cam: { x: 0, y: START_CAM_Y },
    player: { x: START_PLAYER_X, y: START_PLAYER_Y },
    vel: { x: 0, y: 0 },
    keys: new Set(),
    trail: [],
    // Start on a composed view of the whole map; the camera only latches onto
    // the player once the visitor actually moves.
    follow: false,
    scale: 1,
    w: 0,
    h: 0,
    vw: 0,
    vh: 0,
    offX: 0,
    offY: 0,
    activeId: null,
    discovered: new Set(),
    drag: null,
    dragMoved: false,
    visible: true,
    calm: false,
    paused: false,
    leftHome: false,
    galleryDone: false,
  });

  // Freeze the simulation's input while any overlay owns the screen.
  useEffect(() => {
    sim.current.paused = paused || gallery;
    if (paused || gallery) sim.current.keys.clear();
  }, [paused, gallery]);

  const openNode = useCallback(
    (node) => {
      if (!node) return;
      const S = sim.current;
      if (!S.discovered.has(node.id)) {
        S.discovered.add(node.id);
        setDiscovered(new Set(S.discovered));
      }
      onOpen(node);
    },
    [onOpen],
  );

  /* ---------------- main loop ---------------- */
  useEffect(() => {
    const stage = stageRef.current;
    const tilt = tiltRef.current;
    const canvas = canvasRef.current;
    if (!stage || !tilt || !canvas) return;
    const ctx = canvas.getContext('2d');
    const S = sim.current;

    S.calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    setCoarse(isCoarse);

    /* ----- sizing ----- */
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // The plane overhangs the stage so pitching it never exposes the corners.
      // Canvas covers the plane; zoom is fitted to the *visible* stage, or the
      // overhang would scale the world up and push edge markers out of frame.
      const pw = tilt.offsetWidth;
      const ph = tilt.offsetHeight;
      const vis = stage.getBoundingClientRect();

      S.w = pw;
      S.h = ph;
      S.offX = (pw - vis.width) / 2;
      S.offY = (ph - vis.height) / 2;
      S.vw = vis.width;
      S.vh = vis.height;

      // Fit to the shorter axis — the map viewport is wide but shallow, so
      // scaling on width alone pushes every node off the top and bottom.
      S.scale = clamp(Math.min(vis.width / 1500, vis.height / 620), 0.46, 0.95);

      canvas.width = Math.round(pw * dpr);
      canvas.height = Math.round(ph * dpr);
      canvas.style.width = `${pw}px`;
      canvas.style.height = `${ph}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(tilt);
    ro.observe(stage);

    /* ----- pause when off-screen ----- */
    const io = new IntersectionObserver((es) => (S.visible = es[0].isIntersecting), { threshold: 0.02 });
    io.observe(stage);

    /* ----- keyboard ----- */
    const onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (!S.visible || S.paused) return;
      const typing = e.target instanceof HTMLElement && /input|textarea/i.test(e.target.tagName);
      if (typing) return;

      if (MOVE_KEYS.has(k)) {
        S.keys.add(k);
        S.follow = true;
        setTouched(true);
        e.preventDefault(); // arrows would otherwise scroll the page away
      } else if (k === 'e' && S.activeId) {
        openNode(byId[S.activeId]);
      }
    };
    const onKeyUp = (e) => S.keys.delete(e.key.toLowerCase());
    const onBlur = () => S.keys.clear();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    /* ----- drag to pan ----- */
    const onPointerDown = (e) => {
      if (e.target.closest('[data-node]')) {
        // Node buttons handle themselves, but the drag flag must be cleared or a
        // stale `true` from an earlier pan would swallow this click.
        S.dragMoved = false;
        return;
      }
      S.drag = { x: e.clientX, y: e.clientY };
      S.dragMoved = false;
      S.follow = false;
      stage.setPointerCapture?.(e.pointerId);
      stage.dataset.grabbing = '';
    };
    // Gentle parallax: the plane leans toward the pointer.
    const onParallax = (e) => {
      if (S.calm || isCoarse || S.drag) return;
      const r = stage.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.setProperty('--rx', `${TILT_X - ny * 5}deg`);
      tilt.style.setProperty('--ry', `${nx * 7}deg`);
    };
    const onLeaveStage = () => {
      tilt.style.setProperty('--rx', `${TILT_X}deg`);
      tilt.style.setProperty('--ry', '0deg');
    };

    const onPointerMove = (e) => {
      onParallax(e);
      if (!S.drag) return;
      const dx = e.clientX - S.drag.x;
      const dy = e.clientY - S.drag.y;
      if (Math.hypot(dx, dy) > 4) {
        S.dragMoved = true;
        setTouched(true);
      }
      S.cam.x -= dx / S.scale;
      S.cam.y -= dy / S.scale;
      S.drag = { x: e.clientX, y: e.clientY };
    };
    const endDrag = (e) => {
      S.drag = null;
      stage.releasePointerCapture?.(e?.pointerId);
      delete stage.dataset.grabbing;
    };

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('pointerleave', onLeaveStage);

    /* ----- render ----- */
    let raf = 0;
    let last = performance.now();
    let clock = 0;

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = clamp((now - last) / 16.667, 0, 3);
      last = now;
      if (!S.visible) return;
      clock += dt;

      step(dt);
      draw(ctx, S, clock);
      paintDom(S);
    };

    const step = (dt) => {
      // input -> acceleration
      let ax = 0;
      let ay = 0;
      if (!S.paused) {
        if (S.keys.has('a') || S.keys.has('arrowleft')) ax -= 1;
        if (S.keys.has('d') || S.keys.has('arrowright')) ax += 1;
        if (S.keys.has('w') || S.keys.has('arrowup')) ay -= 1;
        if (S.keys.has('s') || S.keys.has('arrowdown')) ay += 1;
      }
      const m = Math.hypot(ax, ay) || 1;

      S.vel.x = (S.vel.x + (ax / m) * 1.5 * dt) * 0.87;
      S.vel.y = (S.vel.y + (ay / m) * 1.5 * dt) * 0.87;

      S.player.x = clamp(S.player.x + S.vel.x * dt * 4.2, BOUNDS.minX, BOUNDS.maxX);
      S.player.y = clamp(S.player.y + S.vel.y * dt * 4.2, BOUNDS.minY, BOUNDS.maxY);

      // trail
      if (!S.calm && Math.hypot(S.vel.x, S.vel.y) > 0.12) {
        S.trail.push({ x: S.player.x, y: S.player.y });
        if (S.trail.length > TRAIL_MAX) S.trail.shift();
      } else if (S.trail.length) {
        S.trail.shift();
      }

      // camera
      if (S.follow) {
        const k = S.calm ? 1 : 1 - Math.pow(1 - 0.09, dt);
        S.cam.x += (S.player.x - S.cam.x) * k;
        S.cam.y += (S.player.y - S.cam.y) * k;
      }
      S.cam.x = clamp(S.cam.x, BOUNDS.minX - 200, BOUNDS.maxX + 200);
      S.cam.y = clamp(S.cam.y, BOUNDS.minY - 200, BOUNDS.maxY + 200);

      // proximity: nearest node to the player, and discovery
      let near = null;
      let bestD = Infinity;
      let changed = false;
      for (const n of NODES) {
        const d = Math.hypot(n.x - S.player.x, n.y - S.player.y);
        if (d < bestD) {
          bestD = d;
          near = n;
        }
        if (d < DISCOVER && !S.discovered.has(n.id)) {
          S.discovered.add(n.id);
          changed = true;
        }
      }
      if (changed) setDiscovered(new Set(S.discovered));

      const nextActive = bestD < NEAR ? near.id : null;
      if (nextActive !== S.activeId) {
        S.activeId = nextActive;
        setActiveId(nextActive);
      }

      // Returning to base camp opens the screenshot gallery — but only once the
      // player has actually left it (they spawn within the radius).
      const home = byId.home;
      const dHome = Math.hypot(home.x - S.player.x, home.y - S.player.y);
      if (dHome > HOME_R + 70) S.leftHome = true;
      if (S.leftHome && dHome < HOME_R && !S.galleryDone && !S.paused) {
        S.galleryDone = true;
        setGallery(true);
      }
    };

    /* world -> screen helpers live inside draw via ctx transform */
    const draw = (c, St, clock) => {
      const { w, h, cam, scale } = St;
      c.save();
      c.clearRect(0, 0, w, h);
      c.translate(w / 2, h / 2);
      c.scale(scale, scale);
      c.translate(-cam.x, -cam.y);

      const halfW = w / 2 / scale;
      const halfH = h / 2 / scale;
      const l = cam.x - halfW;
      const r = cam.x + halfW;
      const t = cam.y - halfH;
      const b = cam.y + halfH;

      /* dotted graph paper */
      c.fillStyle = 'rgba(23,19,14,0.13)';
      const x0 = Math.floor(l / GRID) * GRID;
      const y0 = Math.floor(t / GRID) * GRID;
      for (let x = x0; x < r + GRID; x += GRID) {
        for (let y = y0; y < b + GRID; y += GRID) {
          const major = x % (GRID * 5) === 0 && y % (GRID * 5) === 0;
          c.beginPath();
          c.arc(x, y, major ? 1.5 : 0.8, 0, Math.PI * 2);
          c.fill();
        }
      }

      /* coffee rings — scenery */
      c.lineWidth = 2.5;
      for (const ring of COFFEE_RINGS) {
        c.strokeStyle = 'rgba(163,61,18,0.09)';
        c.beginPath();
        c.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        c.stroke();
        c.strokeStyle = 'rgba(163,61,18,0.05)';
        c.beginPath();
        c.arc(ring.x + 3, ring.y - 2, ring.r * 0.86, 0, Math.PI * 2);
        c.stroke();
      }

      /* map edge */
      c.setLineDash([9, 11]);
      c.lineWidth = 1.5;
      c.strokeStyle = 'rgba(23,19,14,0.16)';
      c.strokeRect(BOUNDS.minX, BOUNDS.minY, BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxY - BOUNDS.minY);
      c.setLineDash([]);

      /* ink routes */
      LINKS.forEach(([aId, bId], i) => {
        const a = byId[aId];
        const bN = byId[bId];
        if (!a || !bN) return;
        const ctrl = routeControl(a, bN, i);
        const lit = St.discovered.has(aId) && St.discovered.has(bId);

        c.lineCap = 'round';
        // Two offset passes fake a hand-drawn double stroke.
        for (let pass = 0; pass < 2; pass++) {
          const j = pass === 0 ? 0 : 1.6;
          c.strokeStyle = lit ? `rgba(163,61,18,${pass ? 0.1 : 0.3})` : `rgba(23,19,14,${pass ? 0.05 : 0.14})`;
          c.lineWidth = pass ? 1 : 1.6;
          c.beginPath();
          c.moveTo(a.x + j, a.y + j);
          c.quadraticCurveTo(ctrl.x + j, ctrl.y + j, bN.x + j, bN.y + j);
          c.stroke();
        }

        /* signal packets travel the routes you've unlocked */
        if (lit && !St.calm) {
          for (let k = 0; k < 2; k++) {
            const tt = ((clock * 0.0035 + rand(i * 7 + k)) % 1 + 1) % 1;
            const p = qPoint(a, ctrl, bN, tt);
            const fade = Math.sin(tt * Math.PI);
            c.fillStyle = `rgba(224,137,28,${0.75 * fade})`;
            c.beginPath();
            c.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
            c.fill();
          }
        }
      });

      /* node halos + cast shadows (the crisp node art is DOM, layered above) */
      for (const n of NODES) {
        const on = St.discovered.has(n.id);
        const rgb = KIND_RGB[n.kind] ?? KIND_RGB.home;
        const g = c.createRadialGradient(n.x, n.y, 0, n.x, n.y, 78);
        g.addColorStop(0, on ? `rgba(${rgb},0.2)` : 'rgba(26,20,16,0.06)');
        g.addColorStop(1, 'rgba(26,20,16,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(n.x, n.y, 78, 0, Math.PI * 2);
        c.fill();

        // the marker floats above the plane, so ground it with a soft shadow
        c.fillStyle = 'rgba(26,20,16,0.13)';
        c.beginPath();
        c.ellipse(n.x + 5, n.y + 9, 13, 6, 0, 0, Math.PI * 2);
        c.fill();
      }

      /* proximity ring on the active node */
      if (St.activeId) {
        const n = byId[St.activeId];
        c.save();
        c.translate(n.x, n.y);
        if (!St.calm) c.rotate(clock * 0.008);
        c.setLineDash([5, 7]);
        c.lineWidth = 1.4;
        c.strokeStyle = `rgba(${KIND_RGB[n.kind] ?? KIND_RGB.home},0.7)`;
        c.beginPath();
        c.arc(0, 0, 48, 0, Math.PI * 2);
        c.stroke();
        c.restore();
        c.setLineDash([]);
      }

      /* player trail */
      for (let i = 0; i < St.trail.length; i++) {
        const p = St.trail[i];
        const f = i / St.trail.length;
        c.fillStyle = `rgba(221,132,18,${f * 0.32})`;
        c.beginPath();
        c.arc(p.x, p.y, f * 5.5, 0, Math.PI * 2);
        c.fill();
      }

      /* player */
      const { x: px, y: py } = St.player;
      const glow = c.createRadialGradient(px, py, 0, px, py, 40);
      glow.addColorStop(0, 'rgba(221,132,18,0.36)');
      glow.addColorStop(1, 'rgba(221,132,18,0)');
      c.fillStyle = glow;
      c.beginPath();
      c.arc(px, py, 40, 0, Math.PI * 2);
      c.fill();

      const bob = St.calm ? 0 : Math.sin(clock * 0.05) * 0.9;
      c.fillStyle = '#dd8412';
      c.strokeStyle = '#1a1410';
      c.lineWidth = 1.8;
      c.beginPath();
      c.arc(px, py + bob, 9, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(253,250,243,0.85)';
      c.beginPath();
      c.arc(px - 2.8, py + bob - 3, 2.6, 0, Math.PI * 2);
      c.fill();

      c.restore();
    };

    /* Position the DOM node layer + off-screen arrows + minimap player. */
    const paintDom = (St) => {
      const { w, h, cam, scale } = St;
      if (layerRef.current) {
        layerRef.current.style.transform = `translate3d(${w / 2}px, ${h / 2}px, 0) scale(${scale}) translate3d(${-cam.x}px, ${-cam.y}px, 0)`;
      }
      if (playerDotRef.current) {
        const mx = ((St.player.x - BOUNDS.minX) / (BOUNDS.maxX - BOUNDS.minX)) * 100;
        const my = ((St.player.y - BOUNDS.minY) / (BOUNDS.maxY - BOUNDS.minY)) * 100;
        playerDotRef.current.style.left = `${mx}%`;
        playerDotRef.current.style.top = `${my}%`;
      }

      // Arrows live on the plane, but must hug the edges of the *visible* stage.
      const pad = 46;
      const left = St.offX + pad;
      const right = St.offX + St.vw - pad;
      const top = St.offY + pad;
      const bottom = St.offY + St.vh - pad;

      for (const n of NODES) {
        const el = arrowRefs.current[n.id];
        if (!el) continue;
        const sx = (n.x - cam.x) * scale + w / 2;
        const sy = (n.y - cam.y) * scale + h / 2;
        const off = sx < left || sx > right || sy < top || sy > bottom;
        el.style.opacity = off ? '1' : '0';
        if (!off) continue;
        const ang = Math.atan2(sy - h / 2, sx - w / 2);
        el.style.transform = `translate3d(${clamp(sx, left, right)}px, ${clamp(sy, top, bottom)}px, 0) rotate(${ang}rad)`;
      }
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', endDrag);
      stage.removeEventListener('pointercancel', endDrag);
      stage.removeEventListener('pointerleave', onLeaveStage);
    };
  }, [openNode]);

  const recentre = () => {
    const S = sim.current;
    S.follow = false;
    S.player = { x: START_PLAYER_X, y: START_PLAYER_Y };
    S.cam = { x: 0, y: START_CAM_Y };
    S.vel = { x: 0, y: 0 };
    S.trail = [];
  };

  const found = discovered.size;
  const total = NODES.length;

  return (
    <div className={s.stage} ref={stageRef}>
      {/* The map plane: pitched back in 3D, leaning toward the pointer. */}
      <div className={s.tilt} ref={tiltRef}>
        <canvas ref={canvasRef} className={s.canvas} aria-hidden="true" />

        {/* Node layer — real buttons, so the map is keyboard + screen-reader usable. */}
        <div className={s.layer} ref={layerRef}>
          {NODES.map((n) => (
            <button
              key={n.id}
              data-node
              data-kind={n.kind}
              data-active={activeId === n.id || undefined}
              data-found={discovered.has(n.id) || undefined}
              className={s.node}
              style={{ left: n.x, top: n.y }}
              onClick={() => {
                if (sim.current.dragMoved) return; // a pan shouldn't open a panel
                openNode(n);
              }}
              aria-label={`${n.label} — ${n.kicker}. Open case study.`}
            >
              <span className={s.ring} aria-hidden="true" />
              <span className={s.core} aria-hidden="true" />
              <span className={s.plate}>
                <span className={s.kicker}>{n.kicker}</span>
                <span className={s.label}>{n.label}</span>
                {activeId === n.id && !coarse && (
                  <span className={s.hint}>
                    <kbd>E</kbd> inspect
                  </span>
                )}
              </span>
              <span className={s.note} aria-hidden="true">
                {n.note}
              </span>
            </button>
          ))}
        </div>

        {/* Off-screen node pointers */}
        <div className={s.arrows} aria-hidden="true">
          {NODES.map((n) => (
            <span
              key={n.id}
              className={s.arrow}
              ref={(el) => {
                arrowRefs.current[n.id] = el;
              }}
            >
              <svg viewBox="0 0 24 24" width="13" height="13">
                <path
                  d="M4 12h14M13 6l6 6-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          ))}
        </div>
      </div>

      {/* HUD */}
      <div className={s.hudTop}>
        <div className={s.counter} role="status" aria-live="polite">
          <span className="srOnly">
            {found} of {total} locations discovered
          </span>
          <span className={s.counterNum} aria-hidden="true">
            {String(found).padStart(2, '0')}
            <i>/</i>
            {String(total).padStart(2, '0')}
          </span>
          <span className={s.counterLabel} aria-hidden="true">
            discovered
          </span>
          <span className={s.meter} aria-hidden="true">
            <i style={{ transform: `scaleX(${found / total})` }} />
          </span>
        </div>
        {found === total && <span className={s.complete}>map complete — nice.</span>}
      </div>

      <div className={s.hudBottom}>
        <p className={s.controls} data-dim={touched || undefined}>
          {coarse ? (
            <>
              <b>Drag</b> to explore · <b>Tap</b> a marker
            </>
          ) : (
            <>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> move · <b>drag</b> to pan · <kbd>E</kbd> inspect
            </>
          )}
        </p>
        <button className={s.recentre} onClick={recentre} data-cursor="reset">
          Recentre
        </button>
        <button className={s.recentre} onClick={() => setGallery(true)} data-cursor="view">
          Screenshots
        </button>
      </div>

      {/* Minimap */}
      <div className={s.minimap} aria-hidden="true">
        {NODES.map((n) => (
          <span
            key={n.id}
            className={s.mmNode}
            data-found={discovered.has(n.id) || undefined}
            style={{
              left: `${((n.x - BOUNDS.minX) / (BOUNDS.maxX - BOUNDS.minX)) * 100}%`,
              top: `${((n.y - BOUNDS.minY) / (BOUNDS.maxY - BOUNDS.minY)) * 100}%`,
            }}
          />
        ))}
        <span className={s.mmPlayer} ref={playerDotRef} />
      </div>

      <Gallery open={gallery} onClose={() => setGallery(false)} />
    </div>
  );
}
