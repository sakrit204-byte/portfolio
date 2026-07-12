import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { COURSE_FACTS, COURSE_FLAGS, COURSE_LINKS, GALLERY, ROUTE_HOLOS } from '../data/cv';
import { CART_R, DISCOVER, HOME_R, ISLAND, LEFT_HOME, MAX_E, NEAR, SHORE_E, createScene, groundHeight } from '../three/scene';
import Gallery from './Gallery';
import s from './world.module.css';

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const TOTAL_FACTS = Object.keys(COURSE_FACTS).length;

const START = new THREE.Vector3(0, 0, 22);

export default function World({ onOpen, paused = false }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const arrowRefs = useRef({});
  const playerDotRef = useRef(null);

  const [activeId, setActiveId] = useState(null);
  const [discovered, setDiscovered] = useState(() => new Set());
  const [touched, setTouched] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState('ball');
  const [nearCart, setNearCart] = useState(false);
  const [holosOpen, setHolosOpen] = useState(0);
  const [facts, setFacts] = useState(() => new Set());
  const [toasts, setToasts] = useState([]);
  const [respawn, setRespawn] = useState(null); // null | 3 | 2 | 1

  const sim = useRef({
    keys: new Set(),
    vel: new THREE.Vector3(),
    yaw: 0,
    yawTarget: 0,
    activeId: null,
    discovered: new Set(),
    facts: new Set(),
    drag: null,
    dragMoved: false,
    visible: true,
    calm: false,
    paused: false,
    leftHome: false,
    galleryDone: false,
    hoverId: null,
    mode: 'ball',
    nearCart: false,
    respawnT: 0, // >0 while drowning/counting down
    airY: 0, // ball altitude above ground (golfer shots)
    airVy: 0,
  });

  const worldRef = useRef(null);

  useEffect(() => {
    sim.current.paused = paused || gallery;
    if (paused || gallery) sim.current.keys.clear();
  }, [paused, gallery]);

  const openNode = useCallback(
    (id) => {
      const node = COURSE_FLAGS.find((n) => n.id === id);
      if (!node) return;
      const S = sim.current;
      if (!S.discovered.has(id)) {
        S.discovered.add(id);
        setDiscovered(new Set(S.discovered));
      }
      onOpen(node);
    },
    [onOpen],
  );

  const pushToast = useCallback((toast) => {
    setToasts((t) => [...t.slice(-2), toast]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.key !== toast.key)), 6500);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const S = sim.current;
    S.calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    setCoarse(isCoarse);

    let world;
    try {
      world = createScene(canvas, {
        flags: COURSE_FLAGS,
        links: COURSE_LINKS,
        holos: ROUTE_HOLOS,
        gallery: GALLERY,
        calm: S.calm,
        coarse: isCoarse,
      });
    } catch (err) {
      console.error('WebGL unavailable:', err);
      setFailed(true);
      return;
    }
    worldRef.current = world;
    setReady(true);

    const { renderer, scene, camera, nodeObjs, byId, player, cart, cartState, raycaster } = world;
    const homeObj = byId.profile;

    player.position.copy(START);
    const camPos = new THREE.Vector3();
    const camLook = new THREE.Vector3();

    /* ---------- sizing ---------- */
    const resize = () => {
      const r = stage.getBoundingClientRect();
      world.resize(r.width, r.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);

    const io = new IntersectionObserver((es) => (S.visible = es[0].isIntersecting), { threshold: 0.02 });
    io.observe(stage);

    /* ---------- vehicle helpers ---------- */
    const vehiclePos = () => (S.mode === 'cart' ? cart.group.position : player.position);

    const enterCart = () => {
      S.mode = 'cart';
      setMode('cart');
      player.visible = false;
      cartState.speed = 0;
      S.vel.set(0, 0, 0);
      S.yawTarget = cartState.heading;
    };

    const exitCart = () => {
      S.mode = 'ball';
      setMode('ball');
      const h = cartState.heading;
      player.position.set(
        cart.group.position.x + Math.cos(h) * 2.2,
        0,
        cart.group.position.z - Math.sin(h) * 2.2,
      );
      player.visible = true;
      S.vel.set(0, 0, 0);
      cartState.speed = 0;
    };

    /* ---------- input ---------- */
    const onKeyDown = (e) => {
      if (!S.visible || S.paused) return;
      if (e.target instanceof HTMLElement && /input|textarea/i.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (MOVE_KEYS.has(k)) {
        S.keys.add(k);
        setTouched(true);
        e.preventDefault();
      } else if (k === 'e' && S.activeId) {
        openNode(S.activeId);
      } else if (k === 'i') {
        if (S.mode === 'cart') exitCart();
        else if (S.nearCart) enterCart();
      } else if (k === 'c') {
        world.closeHolos();
      }
    };
    const onKeyUp = (e) => S.keys.delete(e.key.toLowerCase());
    const onBlur = () => S.keys.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    /* ---------- pointer ---------- */
    const pointer = new THREE.Vector2();
    let hasPointer = false;

    const onPointerDown = (e) => {
      S.drag = { x: e.clientX };
      S.dragMoved = false;
      stage.setPointerCapture?.(e.pointerId);
      stage.dataset.grabbing = '';
    };

    const onPointerMove = (e) => {
      const r = stage.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      hasPointer = true;

      if (!S.drag) return;
      const dx = e.clientX - S.drag.x;
      if (Math.abs(dx) > 3) {
        S.dragMoved = true;
        setTouched(true);
      }
      S.yawTarget -= dx * 0.005;
      S.drag = { x: e.clientX };
    };

    const endDrag = (e) => {
      S.drag = null;
      stage.releasePointerCapture?.(e?.pointerId);
      delete stage.dataset.grabbing;
    };

    const onClick = () => {
      if (S.dragMoved) return;
      if (isCoarse) {
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(world.pickMeshes, false)[0];
        const id = hit?.object.userData.nodeId;
        if (id) openNode(id);
        return;
      }
      if (S.hoverId) openNode(S.hoverId);
    };

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('pointerleave', () => (hasPointer = false));
    stage.addEventListener('click', onClick);

    /* ---------- loop ---------- */
    let raf = 0;
    let last = performance.now();
    let clock = 0;
    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    const projected = new THREE.Vector3();

    // You CAN drive into the sea now — the hard wall is far out, and crossing
    // the shoreline triggers the splash + respawn sequence instead.
    const clampIsland = (pos, vel) => {
      const e = Math.hypot(pos.x / ISLAND.rx, pos.z / ISLAND.rz);
      if (e > MAX_E) {
        const k = MAX_E / e;
        pos.x *= k;
        pos.z *= k;
        vel.multiplyScalar(0.1);
      }
      return e;
    };

    const beginRespawn = (pos) => {
      S.respawnT = 3.4; // a beat of splash, then 3-2-1
      setRespawn(3);
      world.splash(pos.x, pos.z);
      S.keys.clear();
      S.vel.multiplyScalar(0.15);
    };

    const finishRespawn = () => {
      const home = world.cartHome;
      if (S.mode === 'cart') {
        S.mode = 'ball';
        setMode('ball');
        player.visible = true;
      }
      cart.group.position.set(home.x, 0, home.z);
      cart.group.rotation.y = home.heading;
      cartState.heading = home.heading;
      cartState.speed = 0;
      player.position.copy(START);
      player.position.y = 0;
      S.vel.set(0, 0, 0);
      S.airY = 0;
      S.airVy = 0;
      S.yawTarget = 0;
      S.respawnT = 0;
      setRespawn(null);
    };

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const real = (now - last) / 1000;
      const dt = clamp(real, 0, 0.08);
      last = now;
      if (!S.visible) return;
      clock += dt;

      let ix = 0;
      let iz = 0;
      if (!S.paused && S.respawnT <= 0) {
        if (S.keys.has('a') || S.keys.has('arrowleft')) ix -= 1;
        if (S.keys.has('d') || S.keys.has('arrowright')) ix += 1;
        if (S.keys.has('w') || S.keys.has('arrowup')) iz -= 1;
        if (S.keys.has('s') || S.keys.has('arrowdown')) iz += 1;
      }

      let shoreE = 0;
      if (S.mode === 'ball') {
        S.yaw += (S.yawTarget - S.yaw) * (1 - Math.pow(0.001, dt));
        fwd.set(Math.sin(S.yaw), 0, Math.cos(S.yaw));
        right.set(Math.cos(S.yaw), 0, -Math.sin(S.yaw));

        const accel = new THREE.Vector3().addScaledVector(right, ix).addScaledVector(fwd, iz);
        if (accel.lengthSq() > 0) accel.normalize().multiplyScalar(92 * dt);

        /* golfer-shot flight: ballistic vertical, low drag while airborne */
        if (S.airY > 0 || S.airVy !== 0) {
          S.airVy -= 30 * dt;
          S.airY += S.airVy * dt;
          if (S.airY <= 0) {
            S.airY = 0;
            S.airVy = 0;
          }
        }
        const drag = S.airY > 0 ? 0.35 : 0.0016;
        S.vel.add(accel).multiplyScalar(Math.pow(drag, dt));
        player.position.addScaledVector(S.vel, dt);
        shoreE = clampIsland(player.position, S.vel);
        if (S.respawnT <= 0) {
          player.position.y = groundHeight(player.position.x, player.position.z) + S.airY;
        }
      } else {
        /* cart: throttle + steering */
        cartState.speed += -iz * 34 * dt;
        cartState.speed *= Math.pow(0.18, dt);
        cartState.speed = clamp(cartState.speed, -9, 26);
        const steerAuthority = clamp(Math.abs(cartState.speed) / 10, 0, 1);
        cartState.heading -= ix * dt * 1.9 * steerAuthority * Math.sign(cartState.speed || 1);

        const dirX = -Math.sin(cartState.heading);
        const dirZ = -Math.cos(cartState.heading);
        S.vel.set(dirX * cartState.speed, 0, dirZ * cartState.speed);
        cart.group.position.x += S.vel.x * dt;
        cart.group.position.z += S.vel.z * dt;
        shoreE = clampIsland(cart.group.position, S.vel);
        if (S.respawnT <= 0) {
          cart.group.position.y = groundHeight(cart.group.position.x, cart.group.position.z);
        }
        cartState.speed = Math.hypot(S.vel.x, S.vel.z) * Math.sign(cartState.speed || 1);
        cart.group.rotation.y = cartState.heading;
        S.yawTarget = cartState.heading;
        S.yaw += (S.yawTarget - S.yaw) * (1 - Math.pow(0.004, dt));
      }

      const pos = vehiclePos();

      /* into the drink: splash, count down, respawn at the tee */
      if (S.respawnT <= 0 && shoreE > SHORE_E && !S.paused) {
        beginRespawn(pos);
      }
      if (S.respawnT > 0) {
        // wall-clock, not sim time — the countdown must not stretch on slow GPUs
        S.respawnT -= Math.min(real, 0.6);
        const vehicle = S.mode === 'cart' ? cart.group : player;
        vehicle.position.y = Math.max(-1.7, vehicle.position.y - dt * 1.1);
        const count = clamp(Math.ceil(S.respawnT), 1, 3);
        setRespawn((v) => (v === count ? v : count));
        if (S.respawnT <= 0) finishRespawn();
      }

      /* camera chase */
      const dist = S.mode === 'cart' ? 19 : 16.5;
      camPos.set(pos.x + Math.sin(S.yaw) * dist, S.mode === 'cart' ? 13 : 12, pos.z + Math.cos(S.yaw) * dist);
      camera.position.lerp(camPos, S.calm ? 1 : 1 - Math.pow(0.0009, dt));
      camLook.copy(pos).setY(2);
      camera.lookAt(camLook);

      /* proximity + discovery */
      let near = null;
      let bestD = Infinity;
      let changed = false;
      for (const o of nodeObjs) {
        const d = o.base.distanceTo(pos);
        if (d < bestD) {
          bestD = d;
          near = o;
        }
        if (d < DISCOVER && !S.discovered.has(o.id)) {
          S.discovered.add(o.id);
          changed = true;
        }
      }
      if (changed) setDiscovered(new Set(S.discovered));

      const nextActive = bestD < NEAR ? near.id : null;
      if (nextActive !== S.activeId) {
        S.activeId = nextActive;
        setActiveId(nextActive);
      }

      /* near the parked cart? */
      if (S.mode === 'ball') {
        const dCart = cart.group.position.distanceTo(player.position);
        const nc = dCart < CART_R;
        if (nc !== S.nearCart) {
          S.nearCart = nc;
          setNearCart(nc);
        }
      } else if (S.nearCart) {
        S.nearCart = false;
        setNearCart(false);
      }

      /* clubhouse gallery — only greets a player who arrives and slows down,
         never one passing through at speed or driving the cart */
      const dHome = homeObj.base.distanceTo(pos);
      if (dHome > LEFT_HOME) S.leftHome = true;
      if (
        S.leftHome &&
        dHome < HOME_R &&
        !S.galleryDone &&
        !S.paused &&
        S.mode === 'ball' &&
        S.vel.length() < 3.5
      ) {
        S.galleryDone = true;
        setGallery(true);
      }

      /* hover picking */
      if (hasPointer && !S.drag && !isCoarse) {
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(world.pickMeshes, false)[0];
        const id = hit?.object.userData.nodeId ?? null;
        if (id !== S.hoverId) {
          S.hoverId = id;
          if (id) stage.dataset.pick = '';
          else delete stage.dataset.pick;
        }
      }

      world.update(dt, clock, {
        pos,
        vel: S.vel,
        mode: S.mode,
        air: S.airY,
        active: S.activeId,
        hover: S.hoverId,
        discovered: S.discovered,
      });

      /* drain scene events into toasts/facts */
      while (world.events.length) {
        const ev = world.events.shift();
        if (ev.type === 'fact' && !S.facts.has(ev.id)) {
          S.facts.add(ev.id);
          setFacts(new Set(S.facts));
          const f = COURSE_FACTS[ev.id];
          if (f) pushToast({ key: `${ev.id}-${Math.round(clock * 1000)}`, title: f.title, text: f.text });
        } else if (ev.type === 'pins') {
          pushToast({
            key: `pins-${ev.downed}`,
            title: `Pins down — ${ev.downed}/${ev.total}`,
            text: 'Knock them all for a secret.',
          });
        } else if (ev.type === 'cones') {
          pushToast({
            key: `cones-${ev.downed}`,
            title: `Slalom — ${ev.downed}/${ev.total} cones`,
            text: 'Flatten every cone with the cart.',
          });
        } else if (ev.type === 'shot' && S.mode === 'ball') {
          S.vel.set(ev.dx * ev.power, 0, ev.dz * ev.power);
          S.airVy = ev.vy;
          S.airY = 0.05;
          pushToast({
            key: `fore-${Math.round(clock * 1000)}`,
            title: 'FORE!',
            text: 'A member teed you off toward Sakrit Kafle.',
          });
        } else if (ev.type === 'npc') {
          pushToast({
            key: 'npc',
            title: 'Member down!',
            text: 'Don’t worry — they always get back up.',
          });
        }
      }

      renderer.render(scene, camera);
      paintDom(pos);
    };

    const paintDom = (pos) => {
      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;
      const pad = 42;

      for (const o of nodeObjs) {
        const arrow = arrowRefs.current[o.id];
        if (!arrow) continue;
        projected.copy(o.base).setY(3.6).project(camera);
        const behind = projected.z > 1;
        const sx = (projected.x * 0.5 + 0.5) * w;
        const sy = (-projected.y * 0.5 + 0.5) * h;
        const onScreen = !behind && sx > pad && sx < w - pad && sy > pad && sy < h - pad;
        arrow.style.opacity = onScreen ? '0' : '1';
        if (!onScreen) {
          const dx = (behind ? -projected.x : projected.x) * (w / 2);
          const dy = (behind ? projected.y : -projected.y) * (h / 2);
          const ang = Math.atan2(dy, dx);
          arrow.style.transform = `translate3d(${clamp(w / 2 + dx, pad, w - pad)}px, ${clamp(h / 2 + dy, pad, h - pad)}px, 0) rotate(${ang}rad)`;
        }
      }

      if (playerDotRef.current) {
        const mx = ((pos.x + ISLAND.rx) / (ISLAND.rx * 2)) * 100;
        const my = ((pos.z + ISLAND.rz) / (ISLAND.rz * 2)) * 100;
        playerDotRef.current.style.left = `${mx}%`;
        playerDotRef.current.style.top = `${my}%`;
      }

      const openCount = world.openHoloCount();
      setHolosOpen((v) => (v === openCount ? v : openCount));
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
      stage.removeEventListener('click', onClick);
      world.dispose();
    };
  }, [openNode, pushToast]);

  const recentre = () => {
    const S = sim.current;
    S.vel.set(0, 0, 0);
    S.yawTarget = 0;
  };

  const found = discovered.size;
  const total = COURSE_FLAGS.length;
  const activeNode = activeId ? COURSE_FLAGS.find((n) => n.id === activeId) : null;

  return (
    <div className={s.stage} ref={stageRef} data-mode={mode}>
      <canvas ref={canvasRef} className={s.canvas} />

      {failed && (
        <div className={s.fallback}>
          <p>Your browser blocked WebGL, so the course can’t render.</p>
          <a href="#work">Browse the work as cards →</a>
        </div>
      )}

      <nav aria-label="Course flags">
        {COURSE_FLAGS.map((n) => (
          <button key={n.id} className="srOnly" onClick={() => openNode(n.id)}>
            {n.label} — {n.kicker}. Open this CV section.
          </button>
        ))}
      </nav>

      <div className={s.arrows} aria-hidden="true">
        {COURSE_FLAGS.map((n) => (
          <span
            key={n.id}
            className={s.arrow}
            data-kind={n.kind}
            ref={(el) => {
              arrowRefs.current[n.id] = el;
            }}
          >
            <svg viewBox="0 0 24 24" width="12" height="12">
              <path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </span>
        ))}
      </div>

      {/* prompt stack: inspect / cart, each its own clean pill */}
      <div className={s.prompts}>
        {activeNode && (
          <button className={s.prompt} onClick={() => openNode(activeNode.id)}>
            {coarse ? (
              <span className={s.promptText}>
                Tap to inspect — <b>{activeNode.label}</b>
              </span>
            ) : (
              <>
                <kbd className={s.promptKey}>E</kbd>
                <span className={s.promptText}>
                  inspect <b>{activeNode.label}</b>
                </span>
              </>
            )}
          </button>
        )}
        {!coarse && nearCart && mode === 'ball' && (
          <span className={s.prompt} data-tone="cart">
            <kbd className={s.promptKey}>I</kbd>
            <span className={s.promptText}>
              drive the <b>golf cart</b>
            </span>
          </span>
        )}
        {!coarse && mode === 'cart' && (
          <span className={s.prompt} data-tone="cart">
            <kbd className={s.promptKey}>I</kbd>
            <span className={s.promptText}>hop out</span>
          </span>
        )}
      </div>

      {respawn !== null && (
        <div className={s.respawn} role="status">
          <span className={s.respawnSplash}>SPLASH!</span>
          <span className={s.respawnText}>
            respawning in <b>{respawn}</b>
          </span>
        </div>
      )}

      {holosOpen > 0 && !coarse && (
        <button className={s.closeChip} onClick={() => worldRef.current?.closeHolos()}>
          <kbd>C</kbd> close holograms ({holosOpen})
        </button>
      )}

      {/* fact toasts */}
      <div className={s.toasts} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.key} className={s.toast}>
            <strong>{t.title}</strong>
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* HUD */}
      <div className={s.hudTop}>
        <div className={s.counter}>
          <span className={s.counterNum}>
            {String(found).padStart(2, '0')}
            <i>/</i>
            {String(total).padStart(2, '0')}
          </span>
          <span className={s.counterLabel}>cv sections</span>
          <span className={s.meter} aria-hidden="true">
            <i style={{ transform: `scaleX(${found / total})` }} />
          </span>
        </div>
        <div className={s.counter}>
          <span className={s.counterNum}>
            {String(facts.size).padStart(2, '0')}
            <i>/</i>
            {String(TOTAL_FACTS).padStart(2, '0')}
          </span>
          <span className={s.counterLabel}>secrets</span>
          <span className={s.meter} aria-hidden="true">
            <i style={{ transform: `scaleX(${facts.size / TOTAL_FACTS})` }} />
          </span>
        </div>
        {found === total && <span className={s.complete}>// cv fully explored</span>}
      </div>

      <div className={s.hudBottom}>
        <p className={s.controls} data-dim={touched || undefined}>
          {coarse ? (
            <>
              <b>Drag</b> to orbit · <b>Tap</b> a flag
            </>
          ) : (
            <>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> move · <kbd>I</kbd> cart · <kbd>C</kbd> close · <b>drag</b> orbits
            </>
          )}
        </p>
        <button className={s.btn} onClick={recentre}>
          Reset view
        </button>
        <button className={s.btn} onClick={() => setGallery(true)}>
          Screenshots
        </button>
      </div>

      <div className={s.minimap} aria-hidden="true">
        {COURSE_FLAGS.map((n) => (
          <span
            key={n.id}
            className={s.mmNode}
            data-kind={n.kind}
            data-found={discovered.has(n.id) || undefined}
            style={{
              left: `${((n.x + ISLAND.rx) / (ISLAND.rx * 2)) * 100}%`,
              top: `${((n.z + ISLAND.rz) / (ISLAND.rz * 2)) * 100}%`,
            }}
          />
        ))}
        <span className={s.mmPlayer} ref={playerDotRef} />
      </div>

      {!ready && !failed && <div className={s.boot}>preparing the course…</div>}

      <Gallery open={gallery} onClose={() => setGallery(false)} />
    </div>
  );
}
