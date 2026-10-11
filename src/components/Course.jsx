import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { HOLES } from '../data/cv';
import { ISLAND, LAYOUT, createCourse, groundHeight } from '../three/course';
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
const TEE_R = 4.5; // close enough to a tee to play the hole
const FIND_R = 9; // close enough to a green to count it as found
const CART_R = 4.2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const angleLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

function scoreName(strokes, par) {
  if (strokes === 1) return 'Hole in one';
  const d = strokes - par;
  return { '-3': 'Albatross', '-2': 'Eagle', '-1': 'Birdie', 0: 'Par', 1: 'Bogey', 2: 'Double bogey' }[d] ?? `${d > 0 ? '+' : ''}${d}`;
}
const relative = (n) => (n === 0 ? 'E' : n > 0 ? `+${n}` : String(n));

/* minimap projection: the island into a 160 x 124 box */
const MAP_W = 160;
const MAP_H = 124;
const mapX = (x) => MAP_W / 2 + (x / (ISLAND.rx * 1.12)) * (MAP_W / 2);
const mapY = (z) => MAP_H / 2 + (z / (ISLAND.rz * 1.12)) * (MAP_H / 2);

export default function Course({ playing, onExit }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const powerRef = useRef(null);
  const labelRef = useRef(null);
  const meDotRef = useRef(null);
  const cartDotRef = useRef(null);
  const stickRef = useRef(null);
  const worldRef = useRef(null);

  const [failed, setFailed] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [mode, setMode] = useState('roam'); // roam | cart | golf
  const [hole, setHole] = useState(0);
  const [strokes, setStrokes] = useState(() => LAYOUT.map(() => null));
  const [phase, setPhase] = useState('aim'); // golf only: aim | rolling | holed | done
  const [found, setFound] = useState(() => new Set());
  const [nearTee, setNearTee] = useState(null);
  const [nearCart, setNearCart] = useState(false);
  const [toast, setToast] = useState(null);
  const [overview, setOverview] = useState(false);

  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const sim = useRef({
    playing: false,
    mode: 'roam',
    phase: 'aim',
    hole: 0,
    aimYaw: 0,
    camYaw: 0,
    lastOrbit: -10000,
    power: 0,
    charging: false,
    keys: new Set(),
    drag: null,
    stick: null, // touch joystick { id, x, y, dx, dy }
    overview: false,
    visible: true,
    found: new Set(),
    nearTee: null,
    nearCart: false,
    started: false,
    chargeStart: 0,
  });

  useEffect(() => {
    sim.current.phase = phase;
  }, [phase]);
  useEffect(() => {
    sim.current.overview = overview;
  }, [overview]);

  const flash = useCallback((text, ms = 3400, image = null) => {
    const key = Date.now() + Math.random();
    setToast({ key, text, image });
    setTimeout(() => setToast((t) => (t?.key === key ? null : t)), ms);
  }, []);

  const switchMode = useCallback((m) => {
    sim.current.mode = m;
    setMode(m);
  }, []);

  /* ---------- actions ---------- */
  const startHole = useCallback(
    (i) => {
      const S = sim.current;
      const world = worldRef.current;
      if (!world) return;
      if (world.cart.occupied) world.exitCart();
      S.hole = i;
      setHole(i);
      world.teeUp(i);
      S.aimYaw = world.aimAtCup();
      setStrokes((st) => st.map((n, j) => (j === i ? 0 : n)));
      setPhase('aim');
      setOverview(false);
      switchMode('golf');
    },
    [switchMode],
  );

  const backToRoam = useCallback(() => {
    const S = sim.current;
    const world = worldRef.current;
    if (!world) return;
    if (world.ball.state === 'holed') {
      // step off the green's cup so the ball does not sit in the hole
      const [cx, cz] = LAYOUT[S.hole].cup;
      world.roam(cx + 1.6, cz + 1.2);
    } else {
      world.roam();
    }
    S.camYaw = S.aimYaw;
    setPhase('aim');
    setOverview(false);
    switchMode('roam');
  }, [switchMode]);

  const toggleCart = useCallback(() => {
    const S = sim.current;
    const world = worldRef.current;
    if (!world) return;
    if (S.mode === 'cart') {
      world.exitCart();
      switchMode('roam');
    } else if (S.mode === 'roam' && world.cartDistance() < CART_R && world.enterCart()) {
      S.camYaw = world.cart.heading;
      switchMode('cart');
    }
  }, [switchMode]);

  const shoot = useCallback(() => {
    const S = sim.current;
    const world = worldRef.current;
    if (!world || S.mode !== 'golf' || S.phase !== 'aim' || S.power < 0.03) {
      S.power = 0;
      return;
    }
    if (world.shoot(S.aimYaw, S.power)) {
      setStrokes((st) => st.map((n, i) => (i === S.hole ? (n ?? 0) + 1 : n)));
      setPhase('rolling');
      setOverview(false);
    }
    S.power = 0;
  }, []);

  const nextHole = useCallback(() => {
    const S = sim.current;
    // the next hole not played yet, in course order
    const order = LAYOUT.map((_, k) => (S.hole + 1 + k) % LAYOUT.length);
    const next = order.find((k) => strokesRef.current[k] === null);
    if (next === undefined) setPhase('done');
    else startHole(next);
  }, [startHole]);

  const restart = useCallback(() => {
    const fresh = LAYOUT.map(() => null);
    strokesRef.current = fresh;
    setStrokes(fresh);
    startHole(0);
  }, [startHole]);

  /* entering and leaving the course */
  useEffect(() => {
    const S = sim.current;
    S.playing = playing;
    const world = worldRef.current;
    if (!world) return;
    if (playing && !S.started) {
      // first visit: start beside the first tee, cart parked nearby
      S.started = true;
      const [tx, tz] = LAYOUT[0].tee;
      world.roam(tx + 2.5, tz + 3.5);
      S.camYaw = Math.atan2(LAYOUT[0].cup[0] - tx, LAYOUT[0].cup[1] - tz);
      switchMode('roam');
      flash('Roll around and explore. Each green is a chapter of my work.', 4200);
    }
    if (!playing) {
      S.power = 0;
      S.drag = null;
      S.stick = null;
      S.keys.clear();
      world.setRoamInput(0, 0);
      world.setCartInput(0, 0);
    }
  }, [playing, flash, switchMode]);

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
      world = createCourse(canvas, { theme: THEME, calm, onEvent: (ev) => queue.push(ev), boards: HOLES });
    } catch (err) {
      console.error('WebGL unavailable:', err);
      setFailed(true);
      return undefined;
    }
    worldRef.current = world;
    if (import.meta.env.DEV) window.__course = { world, sim: S };
    const { renderer, scene, camera, ball, cart } = world;
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

    /* ---------- pointer ---------- */
    const canAim = () => S.playing && S.mode === 'golf' && S.phase === 'aim';

    const freeShot = () => {
      if (S.mode === 'roam' && S.power >= 0.05 && world.roamShot(S.camYaw, S.power)) {
        S.lastOrbit = performance.now();
      }
      S.power = 0;
    };

    const onPointerDown = (e) => {
      if (!S.playing || e.button > 0 || e.target.closest?.('button, a, [role=dialog]')) return;
      const r = stage.getBoundingClientRect();
      if (canAim()) {
        S.drag = { kind: 'aim', id: e.pointerId, x: e.clientX, y: e.clientY, yaw: S.aimYaw };
      } else if (S.mode !== 'golf') {
        // touch: the left half is a joystick, the right half looks and swings
        if (isCoarse && e.clientX - r.left < r.width * 0.5 && !S.stick) {
          S.stick = { id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top, dx: 0, dy: 0 };
        } else {
          // exploring: sideways looks (and aims), pulling down winds up a free shot
          const kind = S.mode === 'roam' ? 'swing' : 'orbit';
          S.drag = { kind, id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX };
        }
      } else return;
      stage.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (S.stick && e.pointerId === S.stick.id) {
        const r = stage.getBoundingClientRect();
        const dx = e.clientX - r.left - S.stick.x;
        const dy = e.clientY - r.top - S.stick.y;
        const len = Math.hypot(dx, dy);
        const k = len > 46 ? 46 / len : 1;
        S.stick.dx = (dx * k) / 46;
        S.stick.dy = (dy * k) / 46;
        return;
      }
      if (!S.drag || e.pointerId !== S.drag.id) return;
      if (S.drag.kind === 'aim') {
        S.aimYaw = S.drag.yaw - (e.clientX - S.drag.x) * 0.005;
        S.power = clamp((e.clientY - S.drag.y) / (height * 0.34), 0, 1);
      } else {
        S.camYaw -= (e.clientX - S.drag.lastX) * 0.005;
        S.drag.lastX = e.clientX;
        S.lastOrbit = performance.now();
        if (S.drag.kind === 'swing') S.power = clamp((e.clientY - S.drag.y) / (height * 0.34), 0, 1);
      }
    };
    const onPointerUp = (e) => {
      stage.releasePointerCapture?.(e.pointerId);
      if (S.stick && e.pointerId === S.stick.id) {
        S.stick = null;
        return;
      }
      if (!S.drag || e.pointerId !== S.drag.id) return;
      const kind = S.drag.kind;
      S.drag = null;
      if (kind === 'aim') shoot();
      else if (kind === 'swing') freeShot();
    };
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);

    /* ---------- keyboard ---------- */
    // The game owns WASD and Space. Arrow keys and the mouse wheel stay with the page.
    const MOVE = new Set(['w', 'a', 's', 'd']);
    const onKeyDown = (e) => {
      if (!S.playing || !S.visible) return;
      if (e.target instanceof HTMLElement && /input|textarea|select/i.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (MOVE.has(k)) {
        S.keys.add(k);
        e.preventDefault();
        return;
      }
      if (k === ' ') {
        // a focused button on a result card may still take Space; nothing else scrolls the page
        if (e.target.closest?.('[role=dialog] button')) return;
        e.preventDefault();
        if (e.target instanceof HTMLElement && e.target.closest('button, a')) e.target.blur();
        if (e.repeat) return;
      }
      if (S.mode === 'golf') {
        if ((k === ' ' || (k === 'enter' && !e.target.closest?.('button, a'))) && canAim()) {
          e.preventDefault();
          if (!S.charging) {
            S.charging = true;
            S.power = 0;
            S.chargeStart = performance.now();
          }
        } else if (k === 'v') setOverview((v) => !v);
        else if (k === 'escape') backToRoam();
      } else if (k === ' ' && S.mode === 'roam') {
        if (!S.charging) {
          S.charging = true;
          S.power = 0;
          S.chargeStart = performance.now();
        }
      } else if (k === 'e' && S.nearTee !== null) startHole(S.nearTee);
      else if (k === 'f') toggleCart();
      else if (k === 'escape') onExit?.();
    };
    const onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      S.keys.delete(k);
      if (k === ' ' && S.playing && !e.target.closest?.('[role=dialog] button')) e.preventDefault();
      if ((k === ' ' || k === 'enter') && S.charging) {
        S.charging = false;
        if (S.mode === 'golf') shoot();
        else if (performance.now() - S.chargeStart < 180 && S.power < 0.15) {
          S.power = 0;
          world.hop();
        } else freeShot();
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
    let shift = 1;
    let raf = 0;
    let last = performance.now();
    let clock = 0;

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = clamp((now - last) / 1000, 0, 0.06);
      last = now;
      if (!S.visible) return;
      clock += dt;

      /* input axes: keys plus the touch stick */
      let ix = 0;
      let iz = 0;
      if (S.playing) {
        if (S.keys.has('a')) ix -= 1;
        if (S.keys.has('d')) ix += 1;
        if (S.keys.has('w')) iz -= 1;
        if (S.keys.has('s')) iz += 1;
        if (S.stick) {
          ix += S.stick.dx;
          iz += S.stick.dy;
        }
      }

      // the meter swings up and down on wall-clock time, so a slow frame rate never changes it
      const charge = (delay = 0) => {
        const t = (Math.max(0, now - S.chargeStart - delay) / 1000) * 0.85;
        const swing = t % 2;
        S.power = swing < 1 ? swing : 2 - swing;
      };

      if (S.mode === 'roam' && S.charging) {
        // winding up a free shot: A and D turn the aim, the ball stays put
        S.camYaw -= clamp(ix, -1, 1) * dt * 1.3;
        S.lastOrbit = now;
        world.setRoamInput(0, 0);
        charge(180);
      } else if (S.mode === 'roam') {
        // camera relative: forward is where the camera looks
        const fx = Math.sin(S.camYaw);
        const fz = Math.cos(S.camYaw);
        let mx = -iz * fx - ix * fz;
        let mz = -iz * fz + ix * fx;
        const len = Math.hypot(mx, mz);
        if (len > 1) {
          mx /= len;
          mz /= len;
        }
        world.setRoamInput(mx, mz);
      } else if (S.mode === 'cart') {
        world.setCartInput(clamp(ix, -1, 1), clamp(iz, -1, 1));
      } else if (canAim()) {
        S.aimYaw -= clamp(ix, -1, 1) * dt * 1.3;
        if (S.charging) charge();
      }

      world.update(dt, clock);

      /* engine events */
      while (queue.length) {
        const ev = queue.shift();
        if ((ev.type === 'rest' || ev.type === 'dropped') && S.mode === 'golf') {
          S.aimYaw = world.aimAtCup();
          setPhase('aim');
          if (ev.surface === 'bunker') flash('In the bunker. A firm swing gets you out.');
        } else if (ev.type === 'water') {
          if (ev.roaming) flash('Splash. The tide washes you back ashore.');
          else {
            setStrokes((st) => st.map((n, i) => (i === S.hole ? (n ?? 0) + 1 : n)));
            flash('Water hazard. One stroke penalty, replay from where you hit.');
          }
        } else if (ev.type === 'holed') {
          setTimeout(() => setPhase('holed'), 650);
        } else if (ev.type === 'trick') {
          if (!S.found.has(ev.hole)) {
            S.found.add(ev.hole);
            setFound(new Set(S.found));
          }
          flash(`Trick shot. Straight into the cup on hole ${ev.hole + 1}, from out of play.`, 4200, HOLES[ev.hole].image);
        } else if (ev.type === 'bag') {
          flash(ev.down === ev.total ? 'Every golf bag on the course is down. Impressive.' : `Golf bag down. ${ev.down} of ${ev.total}.`);
        }
      }

      /* where am I: tees, greens, the cart */
      const px = S.mode === 'cart' ? cart.x : ball.x;
      const pz = S.mode === 'cart' ? cart.z : ball.z;
      if (S.playing && S.mode !== 'golf') {
        let tee = null;
        LAYOUT.forEach((h, i) => {
          const dTee = Math.hypot(h.tee[0] - px, h.tee[1] - pz);
          const dCup = Math.hypot(h.cup[0] - px, h.cup[1] - pz);
          if (S.mode === 'roam' && dTee < TEE_R) tee = i;
          if ((dCup < FIND_R || dTee < TEE_R + 1) && !S.found.has(i)) {
            S.found.add(i);
            setFound(new Set(S.found));
            flash(`Found hole ${i + 1}: ${HOLES[i].title}. ${HOLES[i].text}`, 5600, HOLES[i].image);
          }
        });
        if (tee !== S.nearTee) {
          S.nearTee = tee;
          setNearTee(tee);
        }
        const nc = S.mode === 'roam' && world.cartDistance() < CART_R;
        if (nc !== S.nearCart) {
          S.nearCart = nc;
          setNearCart(nc);
        }
      } else if (S.nearTee !== null || S.nearCart) {
        S.nearTee = null;
        S.nearCart = false;
        setNearTee(null);
        setNearCart(false);
      }

      if (S.mode === 'roam') world.drawAim(S.camYaw, S.power, S.playing && S.power > 0.02);
      else world.drawAim(S.aimYaw, S.power, S.playing && S.mode === 'golf' && S.phase === 'aim');

      /* camera */
      if (!S.playing) {
        const a = calm ? 0.7 : 0.7 + clock * 0.03;
        const r = width < height ? 150 : 104;
        wantPos.set(Math.sin(a) * r, width < height ? 96 : 54, Math.cos(a) * r);
        wantLook.set(0, 0, 2);
      } else if (S.mode === 'golf') {
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
      } else {
        // chase camera: settles in behind the direction of travel unless you are looking around
        const vx = S.mode === 'cart' ? Math.sin(cart.heading) * cart.speed : ball.vx;
        const vz = S.mode === 'cart' ? Math.cos(cart.heading) * cart.speed : ball.vz;
        const sp = Math.hypot(vx, vz);
        if (now - S.lastOrbit > 1400 && sp > 3 && !calm) {
          const heading = S.mode === 'cart' ? cart.heading : Math.atan2(vx, vz);
          S.camYaw = angleLerp(S.camYaw, heading, Math.min(1, dt * (S.mode === 'cart' ? 2.4 : 1.1)));
        }
        const back = S.mode === 'cart' ? 12 : 13 + S.power * 2.5;
        const up = S.mode === 'cart' ? 6.2 : 6.6;
        const fx = Math.sin(S.camYaw);
        const fz = Math.cos(S.camYaw);
        wantPos.set(px - fx * back, 0, pz - fz * back);
        wantPos.y = Math.max(groundHeight(wantPos.x, wantPos.z), groundHeight(px, pz)) + up;
        wantLook.set(px + fx * 5, groundHeight(px, pz) + 1, pz + fz * 5);
      }
      const k = calm ? 1 : 1 - Math.pow(S.playing ? 0.02 : 0.2, dt);
      camPos.lerp(wantPos, k);
      camLook.lerp(wantLook, k);
      camera.position.copy(camPos);
      camera.lookAt(camLook);

      // wide screens: island to the right of the copy; tall screens: below it
      const wide = width > height * 1.15;
      shift += ((S.playing ? 0 : 1) - shift) * (calm ? 1 : Math.min(1, dt * 2.5));
      if (shift > 0.001) {
        const ox = wide ? -width * 0.2 : 0;
        const oy = wide ? 0 : -height * 0.3;
        camera.setViewOffset(width, height, ox * shift, oy * shift, width, height);
      } else camera.clearViewOffset();

      /* label over a flag: the current hole in golf, the nearest green otherwise */
      const label = labelRef.current;
      if (label) {
        let idx = S.hole;
        if (S.mode !== 'golf') {
          let best = Infinity;
          LAYOUT.forEach((h, i) => {
            const d = Math.hypot(h.cup[0] - px, h.cup[1] - pz);
            if (d < best) {
              best = d;
              idx = i;
            }
          });
        }
        const [cx, cz] = LAYOUT[idx].cup;
        proj.set(cx, groundHeight(cx, cz) + 5.4, cz).project(camera);
        const show = S.playing && proj.z < 1 && S.phase !== 'holed' && S.phase !== 'done';
        label.style.opacity = show ? '1' : '0';
        if (show) {
          const x = clamp((proj.x * 0.5 + 0.5) * width, 60, width - 60);
          const y = clamp((-proj.y * 0.5 + 0.5) * height, isCoarse ? 70 : 120, height - 40);
          label.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
          label.firstChild.textContent = S.mode === 'golf' || S.found.has(idx) ? `Hole ${idx + 1}` : 'Hole ?';
          label.lastChild.textContent = `${Math.round(Math.hypot(cx - px, cz - pz))} yd`;
        }
      }

      meDotRef.current?.setAttribute('transform', `translate(${mapX(px)} ${mapY(pz)})`);
      cartDotRef.current?.setAttribute(
        'transform',
        `translate(${mapX(cart.x)} ${mapY(cart.z)}) rotate(${(-cart.heading * 180) / Math.PI})`,
      );
      if (stickRef.current) {
        const st = S.stick;
        stickRef.current.style.opacity = st ? '1' : '0';
        if (st) {
          stickRef.current.style.transform = `translate3d(${st.x}px, ${st.y}px, 0)`;
          stickRef.current.firstChild.style.transform = `translate(${st.dx * 34}px, ${st.dy * 34}px)`;
        }
      }
      if (powerRef.current) powerRef.current.style.transform = `scaleX(${S.power})`;
      stage.toggleAttribute('data-winding', S.mode === 'roam' && S.power > 0.02);

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
  }, [backToRoam, flash, onExit, shoot, startHole, toggleCart]);

  const playedCount = strokes.filter((n) => n !== null).length;
  const finished = (i) => strokes[i] !== null && (i !== hole || mode !== 'golf' || phase === 'holed' || phase === 'done');
  const totalVsPar = strokes.reduce((n, st, i) => (finished(i) ? n + st - LAYOUT[i].par : n), 0);
  const totalStrokes = strokes.reduce((a, b) => a + (b ?? 0), 0);
  const info = HOLES[hole];
  const par = LAYOUT[hole].par;

  const leaveTo = (href) => {
    onExit?.();
    requestAnimationFrame(() => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' }));
  };

  return (
    <div className={s.stage} ref={stageRef} data-playing={playing || undefined} data-coarse={coarse || undefined} data-mode={mode}>
      <canvas ref={canvasRef} className={s.canvas} aria-hidden="true" />
      {failed && <div className={s.fallback} />}

      <div className={s.flagLabel} ref={labelRef} aria-hidden="true">
        <span>Hole 1</span>
        <b>0 yd</b>
      </div>

      {playing && (
        <div className={s.hud}>
          <div className={s.card}>
            {mode === 'golf' ? (
              <>
                <span className={s.eyebrow}>
                  Hole {hole + 1} of {LAYOUT.length}
                </span>
                <strong className={s.holeTitle}>{info.title}</strong>
                <span className={s.meta}>
                  Par {par} <i aria-hidden="true">/</i> Stroke {strokes[hole] ?? 0} <i aria-hidden="true">/</i> Total{' '}
                  {relative(totalVsPar)}
                </span>
              </>
            ) : (
              <>
                <span className={s.eyebrow}>{mode === 'cart' ? 'Driving the cart' : 'Exploring'}</span>
                <strong className={s.holeTitle}>{mode === 'cart' ? 'Mind the golf bags' : 'Find all five greens'}</strong>
                <span className={s.meta}>
                  Found {found.size} of {LAYOUT.length} <i aria-hidden="true">/</i> Played {playedCount} of{' '}
                  {LAYOUT.length}
                </span>
              </>
            )}
          </div>

          <div className={s.side}>
            <div className={s.tools}>
              {mode === 'golf' ? (
                <>
                  <button className={s.tool} onClick={() => setOverview((v) => !v)} aria-pressed={overview}>
                    {overview ? 'Behind the ball' : 'View the hole'}
                    {!coarse && <kbd>V</kbd>}
                  </button>
                  <button className={s.tool} onClick={backToRoam}>
                    Back to exploring
                    {!coarse && <kbd>Esc</kbd>}
                  </button>
                </>
              ) : (
                <button className={s.tool} onClick={onExit}>
                  Leave the course
                  {!coarse && <kbd>Esc</kbd>}
                </button>
              )}
            </div>

            <svg className={s.map} viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true">
              <ellipse cx={MAP_W / 2} cy={MAP_H / 2} rx={MAP_W / 2 - 2} ry={MAP_H / 2 - 2} className={s.mapSea} />
              <ellipse cx={MAP_W / 2} cy={MAP_H / 2} rx={MAP_W / 2.3} ry={MAP_H / 2.3} className={s.mapLand} />
              {LAYOUT.map((h, i) => (
                <g
                  key={i}
                  className={s.mapHole}
                  data-found={found.has(i) || undefined}
                  data-played={strokes[i] !== null || undefined}
                  data-current={(mode === 'golf' && i === hole) || undefined}
                >
                  <line x1={mapX(h.tee[0])} y1={mapY(h.tee[1])} x2={mapX(h.cup[0])} y2={mapY(h.cup[1])} />
                  <circle cx={mapX(h.cup[0])} cy={mapY(h.cup[1])} r="6.5" />
                  <text x={mapX(h.cup[0])} y={mapY(h.cup[1]) + 3}>
                    {found.has(i) ? i + 1 : '?'}
                  </text>
                </g>
              ))}
              <g ref={cartDotRef} className={s.mapCart}>
                <rect x="-2.5" y="-4" width="5" height="8" rx="1.5" />
              </g>
              <g ref={meDotRef} className={s.mapMe}>
                <circle r="3.6" />
              </g>
            </svg>
          </div>

          {mode === 'golf' && phase === 'aim' && (
            <div className={s.aimBar}>
              <span className={s.power} aria-hidden="true">
                <i ref={powerRef} />
              </span>
              <p className={s.hint}>
                {coarse ? (
                  <>Drag sideways to aim, pull down for power, let go to swing.</>
                ) : (
                  <>
                    Drag sideways to aim and down for power, or aim with <kbd>A</kbd>
                    <kbd>D</kbd> and hold <kbd>Space</kbd>.
                  </>
                )}
              </p>
            </div>
          )}

          {mode !== 'golf' && (
            <div className={s.aimBar}>
              {mode === 'roam' && (
                <span className={s.power} data-soft aria-hidden="true">
                  <i ref={powerRef} />
                </span>
              )}
              <div className={s.prompts}>
                {nearTee !== null && (
                  <button className={s.prompt} onClick={() => startHole(nearTee)}>
                    {!coarse && <kbd>E</kbd>}
                    Play hole {nearTee + 1}: {HOLES[nearTee].title}
                  </button>
                )}
                {(nearCart || mode === 'cart') && (
                  <button className={s.prompt} data-tone="cart" onClick={toggleCart}>
                    {!coarse && <kbd>F</kbd>}
                    {mode === 'cart' ? 'Hop out' : 'Drive the golf cart'}
                  </button>
                )}
              </div>
              <p className={s.hint}>
                {coarse ? (
                  <>
                    {mode === 'cart' ? (
                      <>Left thumb drives, right thumb looks around.</>
                    ) : (
                      <>Left thumb rolls. Right thumb looks around, pull it down to swing. Roll onto a tee to play it.</>
                    )}
                  </>
                ) : mode === 'cart' ? (
                  <>
                    <kbd>W</kbd>
                    <kbd>S</kbd> drive, <kbd>A</kbd>
                    <kbd>D</kbd> steer, drag to look around.
                  </>
                ) : (
                  <>
                    <kbd>W</kbd>
                    <kbd>A</kbd>
                    <kbd>S</kbd>
                    <kbd>D</kbd> roll. Drag to look, pull down to swing. Tap <kbd>Space</kbd> to hop, hold it to swing.
                  </>
                )}
              </p>
            </div>
          )}

          {coarse && mode !== 'golf' && (
            <div className={s.stick} ref={stickRef} aria-hidden="true">
              <i />
            </div>
          )}

          {toast && (
            <p className={s.toast} key={toast.key} role="status" data-image={toast.image ? '' : undefined}>
              {toast.image && <img src={toast.image} alt="" />}
              <span>{toast.text}</span>
            </p>
          )}

          {mode === 'golf' && phase === 'holed' && (
            <div className={s.result} role="dialog" aria-label="Hole complete">
              <img className={s.resultImage} src={info.image} alt={info.caption} />
              <span className={s.eyebrow}>
                Hole {hole + 1} in {strokes[hole]}
              </span>
              <strong className={s.resultTitle}>{scoreName(strokes[hole], par)}</strong>
              <p>{info.text}</p>
              <div className={s.resultActions}>
                <button className={s.primary} onClick={nextHole} autoFocus>
                  {playedCount === LAYOUT.length ? 'See the scorecard' : 'Next hole'}
                </button>
                <button className={s.secondary} onClick={backToRoam}>
                  Keep exploring
                </button>
              </div>
              <button className={s.textBtn} onClick={() => leaveTo(info.link.href)}>
                {info.link.label} <span aria-hidden="true">↓</span>
              </button>
            </div>
          )}

          {mode === 'golf' && phase === 'done' && (
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
                      <td key={i} data-under={(n ?? 99) < LAYOUT[i].par || undefined}>
                        {n ?? '-'}
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
              <button className={s.textBtn} onClick={backToRoam}>
                Keep exploring
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
