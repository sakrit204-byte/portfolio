import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { HOLES } from '../data/cv';
import { LAYOUT, createCourse, groundHeight } from '../three/course';
import s from './course.module.css';

/* Scene colours, kept in step with the page tokens in index.css. */
const THEME = {
  horizon: 0xf4efe6,
  zenith: 0xa9c7d8,
  deep: 0x1d6c73,
  shallow: 0x5db4b0,
  flag: '#e2572b',
};

const PAR_TOTAL = LAYOUT.reduce((n, h) => n + h.par, 0);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function scoreName(strokes, par) {
  if (strokes === 1) return 'Hole in one';
  const d = strokes - par;
  return { '-3': 'Albatross', '-2': 'Eagle', '-1': 'Birdie', 0: 'Par', 1: 'Bogey', 2: 'Double bogey' }[d] ?? `${d > 0 ? '+' : ''}${d}`;
}

const relative = (n) => (n === 0 ? 'E' : n > 0 ? `+${n}` : String(n));

export default function Course({ playing, onExit }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const powerRef = useRef(null);
  const labelRef = useRef(null);
  const worldRef = useRef(null);

  const [failed, setFailed] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [hole, setHole] = useState(0);
  const [strokes, setStrokes] = useState(() => LAYOUT.map(() => 0));
  const [phase, setPhase] = useState('aim'); // aim | rolling | holed | done
  const [toast, setToast] = useState(null);
  const [overview, setOverview] = useState(false);

  const sim = useRef({
    playing: false,
    phase: 'aim',
    aimYaw: 0,
    power: 0,
    charging: false,
    chargeDir: 1,
    keys: new Set(),
    drag: null,
    overview: false,
    visible: true,
    hole: 0,
  });

  useEffect(() => {
    sim.current.playing = playing;
    if (!playing) {
      sim.current.power = 0;
      sim.current.drag = null;
    }
  }, [playing]);
  useEffect(() => {
    sim.current.phase = phase;
  }, [phase]);
  useEffect(() => {
    sim.current.overview = overview;
  }, [overview]);

  const flash = useCallback((text) => {
    const key = Date.now();
    setToast({ key, text });
    setTimeout(() => setToast((t) => (t?.key === key ? null : t)), 3200);
  }, []);

  const shoot = useCallback(() => {
    const S = sim.current;
    const world = worldRef.current;
    if (!world || S.phase !== 'aim' || S.power < 0.03) {
      S.power = 0;
      return;
    }
    if (world.shoot(S.aimYaw, S.power)) {
      setStrokes((st) => st.map((n, i) => (i === S.hole ? n + 1 : n)));
      setPhase('rolling');
      setOverview(false);
    }
    S.power = 0;
  }, []);

  const nextHole = useCallback(() => {
    const S = sim.current;
    const world = worldRef.current;
    if (S.hole >= LAYOUT.length - 1) {
      setPhase('done');
      return;
    }
    S.hole += 1;
    setHole(S.hole);
    world.teeUp(S.hole);
    S.aimYaw = world.aimAtCup();
    setPhase('aim');
  }, []);

  const restart = useCallback(() => {
    const S = sim.current;
    const world = worldRef.current;
    S.hole = 0;
    setHole(0);
    setStrokes(LAYOUT.map(() => 0));
    world.teeUp(0);
    S.aimYaw = world.aimAtCup();
    setPhase('aim');
  }, []);

  /* ---------- scene + loop ---------- */
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const S = sim.current;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    setCoarse(isCoarse);

    const queue = [];
    let world;
    try {
      world = createCourse(canvas, { theme: THEME, calm, onEvent: (ev) => queue.push(ev) });
    } catch (err) {
      console.error('WebGL unavailable:', err);
      setFailed(true);
      return undefined;
    }
    worldRef.current = world;
    if (import.meta.env.DEV) window.__course = { world, sim: S };
    const { renderer, scene, camera, ball } = world;
    S.aimYaw = world.aimAtCup();

    let width = 1;
    let height = 1;
    const resize = () => {
      const r = stage.getBoundingClientRect();
      width = Math.max(1, r.width);
      height = Math.max(1, r.height);
      world.resize(width, height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    const io = new IntersectionObserver((es) => (S.visible = es[0].isIntersecting), { threshold: 0.01 });
    io.observe(stage);

    /* ---------- input ---------- */
    const canAim = () => S.playing && S.phase === 'aim';

    const onPointerDown = (e) => {
      if (!canAim() || e.button > 0 || e.target.closest?.('button, a, [role=dialog]')) return;
      S.drag = { x: e.clientX, y: e.clientY, yaw: S.aimYaw };
      stage.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (!S.drag) return;
      S.aimYaw = S.drag.yaw - (e.clientX - S.drag.x) * 0.005;
      S.power = clamp((e.clientY - S.drag.y) / (height * 0.34), 0, 1);
    };
    const onPointerUp = (e) => {
      if (!S.drag) return;
      S.drag = null;
      stage.releasePointerCapture?.(e.pointerId);
      shoot();
    };
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);

    const onKeyDown = (e) => {
      if (!S.playing || !S.visible) return;
      if (e.target instanceof HTMLElement && /input|textarea|select/i.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) {
        S.keys.add(k);
        e.preventDefault();
      } else if ((k === ' ' || k === 'enter') && canAim() && !e.target.closest?.('button, a')) {
        e.preventDefault();
        if (!S.charging) {
          S.charging = true;
          S.chargeDir = 1;
          S.power = 0;
        }
      } else if (k === 'v') {
        setOverview((v) => !v);
      } else if (k === 'escape') {
        onExit?.();
      }
    };
    const onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      S.keys.delete(k);
      if ((k === ' ' || k === 'enter') && S.charging) {
        S.charging = false;
        shoot();
      }
    };
    const onBlur = () => {
      S.keys.clear();
      S.charging = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    /* ---------- loop ---------- */
    const camPos = new THREE.Vector3(0, 60, 110);
    const camLook = new THREE.Vector3();
    const wantPos = new THREE.Vector3();
    const wantLook = new THREE.Vector3();
    const proj = new THREE.Vector3();
    let shift = 1; // ambient framing pushes the island right of the copy
    let raf = 0;
    let last = performance.now();
    let clock = 0;

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = clamp((now - last) / 1000, 0, 0.06);
      last = now;
      if (!S.visible) return;
      clock += dt;

      /* aim from the keyboard */
      if (canAim()) {
        let turn = 0;
        if (S.keys.has('arrowleft') || S.keys.has('a')) turn += 1;
        if (S.keys.has('arrowright') || S.keys.has('d')) turn -= 1;
        S.aimYaw += turn * dt * 1.3;
        if (S.charging) {
          S.power += S.chargeDir * dt * 0.85;
          if (S.power >= 1) {
            S.power = 1;
            S.chargeDir = -1;
          } else if (S.power <= 0) {
            S.power = 0;
            S.chargeDir = 1;
          }
        }
      }

      world.update(dt, clock);

      while (queue.length) {
        const ev = queue.shift();
        if (ev.type === 'rest' || ev.type === 'dropped') {
          S.aimYaw = world.aimAtCup();
          setPhase('aim');
          if (ev.type === 'rest' && ev.surface === 'bunker') flash('In the bunker. A firm swing gets you out.');
        } else if (ev.type === 'water') {
          setStrokes((st) => st.map((n, i) => (i === S.hole ? n + 1 : n)));
          flash('Water hazard. One stroke penalty, replay from where you hit.');
        } else if (ev.type === 'holed') {
          setTimeout(() => setPhase('holed'), 650);
        } else if (ev.type === 'bag') {
          flash(ev.down === ev.total ? 'Every golf bag on the course is down.' : `Golf bag down. ${ev.down} of ${ev.total}.`);
        }
      }

      world.drawAim(S.aimYaw, S.power, S.playing && S.phase === 'aim');

      /* camera */
      if (!S.playing) {
        const a = calm ? 0.7 : 0.7 + clock * 0.03;
        const r = width < height ? 150 : 104;
        wantPos.set(Math.sin(a) * r, width < height ? 96 : 54, Math.cos(a) * r);
        wantLook.set(0, 0, 2);
      } else {
        const [cx, cz] = LAYOUT[S.hole].cup;
        const yaw = S.aimYaw;
        if (S.overview && S.phase === 'aim') {
          const mx = (ball.x + cx) / 2;
          const mz = (ball.z + cz) / 2;
          const span = Math.hypot(cx - ball.x, cz - ball.z);
          wantPos.set(mx - Math.sin(yaw) * span * 0.55, 22 + span * 0.9, mz - Math.cos(yaw) * span * 0.55);
          wantLook.set(mx, 0, mz);
        } else {
          const back = 12 + S.power * 2.5;
          wantPos.set(ball.x - Math.sin(yaw) * back, 0, ball.z - Math.cos(yaw) * back);
          wantPos.y = Math.max(groundHeight(wantPos.x, wantPos.z), groundHeight(ball.x, ball.z)) + 5.8;
          wantLook.set(ball.x + Math.sin(yaw) * 7, groundHeight(ball.x, ball.z) + 0.6, ball.z + Math.cos(yaw) * 7);
        }
      }
      const k = calm ? 1 : 1 - Math.pow(S.playing ? 0.02 : 0.2, dt);
      camPos.lerp(wantPos, k);
      camLook.lerp(wantLook, k);
      camera.position.copy(camPos);
      camera.lookAt(camLook);

      // wide screens: island to the right of the copy; tall screens: below it
      const wide = width > height * 1.15;
      const wantShift = S.playing ? 0 : 1;
      shift += (wantShift - shift) * (calm ? 1 : Math.min(1, dt * 2.5));
      if (shift > 0.001) {
        const ox = wide ? -width * 0.2 : 0;
        const oy = wide ? 0 : -height * 0.3;
        camera.setViewOffset(width, height, ox * shift, oy * shift, width, height);
      } else camera.clearViewOffset();

      /* flag label over the current hole */
      const label = labelRef.current;
      if (label) {
        const [cx, cz] = LAYOUT[S.hole].cup;
        proj.set(cx, groundHeight(cx, cz) + 5.4, cz).project(camera);
        const show = S.playing && proj.z < 1 && S.phase !== 'holed' && S.phase !== 'done';
        label.style.opacity = show ? '1' : '0';
        if (show) {
          const x = clamp((proj.x * 0.5 + 0.5) * width, 60, width - 60);
          const y = clamp((-proj.y * 0.5 + 0.5) * height, 70, height - 40);
          label.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
          label.querySelector('b').textContent = `${Math.round(world.distanceToCup())} yd`;
        }
      }
      if (powerRef.current) powerRef.current.style.transform = `scaleX(${S.power})`;

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      world.dispose();
      worldRef.current = null;
    };
  }, [flash, onExit, shoot]);

  const par = LAYOUT[hole].par;
  const played = strokes.slice(0, phase === 'done' ? LAYOUT.length : hole + (phase === 'holed' ? 1 : 0));
  const totalVsPar = played.reduce((n, st, i) => n + st - LAYOUT[i].par, 0);
  const totalStrokes = strokes.reduce((a, b) => a + b, 0);
  const info = HOLES[hole];

  const leaveTo = (href) => {
    onExit?.();
    requestAnimationFrame(() => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' }));
  };

  return (
    <div className={s.stage} ref={stageRef} data-playing={playing || undefined} data-coarse={coarse || undefined}>
      <canvas ref={canvasRef} className={s.canvas} aria-hidden="true" />
      {failed && <div className={s.fallback} />}

      <div className={s.flagLabel} ref={labelRef} aria-hidden="true">
        <span>Hole {hole + 1}</span>
        <b>0 yd</b>
      </div>

      {playing && (
        <div className={s.hud}>
          <div className={s.card}>
            <span className={s.eyebrow}>
              Hole {hole + 1} of {LAYOUT.length}
            </span>
            <strong className={s.holeTitle}>{info.title}</strong>
            <span className={s.meta}>
              Par {par} <i aria-hidden="true">/</i> Stroke {strokes[hole]} <i aria-hidden="true">/</i> Total{' '}
              {relative(totalVsPar)}
            </span>
          </div>

          <div className={s.tools}>
            <button className={s.tool} onClick={() => setOverview((v) => !v)} aria-pressed={overview}>
              {overview ? 'Behind the ball' : 'View the hole'}
              {!coarse && <kbd>V</kbd>}
            </button>
            <button className={s.tool} onClick={onExit}>
              Leave the course
              {!coarse && <kbd>Esc</kbd>}
            </button>
          </div>

          {phase === 'aim' && (
            <div className={s.aimBar}>
              <span className={s.power} aria-hidden="true">
                <i ref={powerRef} />
              </span>
              <p className={s.hint}>
                {coarse ? (
                  <>Drag sideways to aim, pull down for power, let go to swing.</>
                ) : (
                  <>
                    Drag sideways to aim and down for power, or use <kbd>←</kbd>
                    <kbd>→</kbd> and hold <kbd>Space</kbd>.
                  </>
                )}
              </p>
            </div>
          )}

          {toast && (
            <p className={s.toast} key={toast.key} role="status">
              {toast.text}
            </p>
          )}

          {phase === 'holed' && (
            <div className={s.result} role="dialog" aria-label="Hole complete">
              <span className={s.eyebrow}>
                Hole {hole + 1} in {strokes[hole]}
              </span>
              <strong className={s.resultTitle}>{scoreName(strokes[hole], par)}</strong>
              <p>{info.text}</p>
              <div className={s.resultActions}>
                <button className={s.primary} onClick={nextHole} autoFocus>
                  {hole === LAYOUT.length - 1 ? 'See the scorecard' : `On to hole ${hole + 2}`}
                </button>
                <button className={s.secondary} onClick={() => leaveTo(info.link.href)}>
                  {info.link.label}
                </button>
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div className={s.result} role="dialog" aria-label="Scorecard">
              <span className={s.eyebrow}>Scorecard</span>
              <strong className={s.resultTitle}>
                {totalStrokes} strokes, {relative(totalStrokes - PAR_TOTAL)}
              </strong>
              <table className={s.scorecard}>
                <thead>
                  <tr>
                    <th scope="row">Hole</th>
                    {LAYOUT.map((_, i) => (
                      <th key={i}>{i + 1}</th>
                    ))}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Par</th>
                    {LAYOUT.map((h, i) => (
                      <td key={i}>{h.par}</td>
                    ))}
                    <td>{PAR_TOTAL}</td>
                  </tr>
                  <tr>
                    <th scope="row">You</th>
                    {strokes.map((n, i) => (
                      <td key={i} data-under={n < LAYOUT[i].par || undefined}>
                        {n}
                      </td>
                    ))}
                    <td>{totalStrokes}</td>
                  </tr>
                </tbody>
              </table>
              <div className={s.resultActions}>
                <button className={s.primary} onClick={() => leaveTo('#contact')}>
                  Get in touch
                </button>
                <button className={s.secondary} onClick={restart}>
                  Play again
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
