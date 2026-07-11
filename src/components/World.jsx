import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GALLERY, LINKS, NODES } from '../data/cv';
import { BOUNDS, DISCOVER, HOME_R, LEFT_HOME, NEAR, UNIT, createScene } from '../three/scene';
import Gallery from './Gallery';
import s from './world.module.css';

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const START = new THREE.Vector3(0, 0, 5.4);

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

  const sim = useRef({
    keys: new Set(),
    vel: new THREE.Vector3(),
    yaw: 0,
    yawTarget: 0,
    activeId: null,
    discovered: new Set(),
    drag: null,
    dragMoved: false,
    visible: true,
    calm: false,
    paused: false,
    leftHome: false,
    galleryDone: false,
    hoverId: null,
  });

  useEffect(() => {
    sim.current.paused = paused || gallery;
    if (paused || gallery) sim.current.keys.clear();
  }, [paused, gallery]);

  const openNode = useCallback(
    (id) => {
      const node = NODES.find((n) => n.id === id);
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
      world = createScene(canvas, { nodes: NODES, links: LINKS, gallery: GALLERY, calm: S.calm });
    } catch (err) {
      console.error('WebGL unavailable:', err);
      setFailed(true);
      return;
    }
    setReady(true);

    const { renderer, scene, camera, nodeObjs, byId, player, raycaster } = world;
    const homeObj = byId.home;

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
      }
    };
    const onKeyUp = (e) => S.keys.delete(e.key.toLowerCase());
    const onBlur = () => S.keys.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    /* ---------- pointer: drag orbits, click picks a flag ---------- */
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
      // touch devices have no hover state — resolve the tap through the raycaster
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

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      if (!S.visible) return;
      clock += dt;

      /* movement, relative to where the camera is looking */
      let ix = 0;
      let iz = 0;
      if (!S.paused) {
        if (S.keys.has('a') || S.keys.has('arrowleft')) ix -= 1;
        if (S.keys.has('d') || S.keys.has('arrowright')) ix += 1;
        if (S.keys.has('w') || S.keys.has('arrowup')) iz -= 1;
        if (S.keys.has('s') || S.keys.has('arrowdown')) iz += 1;
      }

      S.yaw += (S.yawTarget - S.yaw) * (1 - Math.pow(0.001, dt));

      fwd.set(Math.sin(S.yaw), 0, Math.cos(S.yaw));
      right.set(Math.cos(S.yaw), 0, -Math.sin(S.yaw));

      const accel = new THREE.Vector3().addScaledVector(right, ix).addScaledVector(fwd, iz);
      if (accel.lengthSq() > 0) accel.normalize().multiplyScalar(74 * dt);

      S.vel.add(accel).multiplyScalar(Math.pow(0.0016, dt));
      player.position.addScaledVector(S.vel, dt);
      player.position.x = clamp(player.position.x, -BOUNDS.x, BOUNDS.x);
      player.position.z = clamp(player.position.z, BOUNDS.zMin, BOUNDS.zMax);

      /* camera: chase from behind-and-above, orbiting with yaw */
      camPos.set(
        player.position.x + Math.sin(S.yaw) * 16.5,
        12,
        player.position.z + Math.cos(S.yaw) * 16.5,
      );
      camera.position.lerp(camPos, S.calm ? 1 : 1 - Math.pow(0.0009, dt));
      camLook.copy(player.position).setY(2);
      camera.lookAt(camLook);

      /* proximity + discovery */
      let near = null;
      let bestD = Infinity;
      let changed = false;
      for (const o of nodeObjs) {
        const d = o.base.distanceTo(player.position);
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

      /* clubhouse -> gallery, once the player has actually left it */
      const dHome = homeObj.base.distanceTo(player.position);
      if (dHome > LEFT_HOME) S.leftHome = true;
      if (S.leftHome && dHome < HOME_R && !S.galleryDone && !S.paused) {
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
        active: S.activeId,
        hover: S.hoverId,
        discovered: S.discovered,
        vel: S.vel,
      });

      renderer.render(scene, camera);
      paintDom();
    };

    /* Off-screen flag arrows + minimap player dot. */
    const paintDom = () => {
      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;
      const pad = 42;

      for (const o of nodeObjs) {
        const arrow = arrowRefs.current[o.id];
        if (!arrow) continue;
        projected.copy(o.base).setY(3.4).project(camera);

        const behind = projected.z > 1;
        const sx = (projected.x * 0.5 + 0.5) * w;
        const sy = (-projected.y * 0.5 + 0.5) * h;
        const onScreen = !behind && sx > pad && sx < w - pad && sy > pad && sy < h - pad;

        arrow.style.opacity = onScreen ? '0' : '1';
        if (!onScreen) {
          const dx = (behind ? -projected.x : projected.x) * (w / 2);
          const dy = (behind ? projected.y : -projected.y) * (h / 2);
          const ang = Math.atan2(dy, dx);
          const ex = clamp(w / 2 + dx, pad, w - pad);
          const ey = clamp(h / 2 + dy, pad, h - pad);
          arrow.style.transform = `translate3d(${ex}px, ${ey}px, 0) rotate(${ang}rad)`;
        }
      }

      if (playerDotRef.current) {
        const mx = ((player.position.x + BOUNDS.x) / (BOUNDS.x * 2)) * 100;
        const my = ((player.position.z - BOUNDS.zMin) / (BOUNDS.zMax - BOUNDS.zMin)) * 100;
        playerDotRef.current.style.left = `${mx}%`;
        playerDotRef.current.style.top = `${my}%`;
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
      stage.removeEventListener('click', onClick);
      world.dispose();
    };
  }, [openNode]);

  const recentre = () => {
    const S = sim.current;
    S.vel.set(0, 0, 0);
    S.yawTarget = 0;
  };

  const found = discovered.size;
  const total = NODES.length;
  const activeNode = activeId ? NODES.find((n) => n.id === activeId) : null;

  return (
    <div className={s.stage} ref={stageRef}>
      <canvas ref={canvasRef} className={s.canvas} />

      {failed && (
        <div className={s.fallback}>
          <p>Your browser blocked WebGL, so the course can’t render.</p>
          <a href="#work">Browse the work as cards →</a>
        </div>
      )}

      {/* Keyboard / screen-reader access to every flag, independent of the 3D picking. */}
      <nav aria-label="Course flags">
        {NODES.map((n) => (
          <button key={n.id} className="srOnly" onClick={() => openNode(n.id)}>
            {n.label} — {n.kicker}. Open case study.
          </button>
        ))}
      </nav>

      <div className={s.arrows} aria-hidden="true">
        {NODES.map((n) => (
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

      {/* The inspect prompt: its own clean element, nothing else attached. */}
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

      {/* HUD */}
      <div className={s.hudTop}>
        <div className={s.counter} role="status" aria-live="polite">
          <span className="srOnly">
            {found} of {total} flags reached
          </span>
          <span className={s.counterNum} aria-hidden="true">
            {String(found).padStart(2, '0')}
            <i>/</i>
            {String(total).padStart(2, '0')}
          </span>
          <span className={s.counterLabel} aria-hidden="true">
            flags reached
          </span>
          <span className={s.meter} aria-hidden="true">
            <i style={{ transform: `scaleX(${found / total})` }} />
          </span>
        </div>
        {found === total && <span className={s.complete}>// course complete</span>}
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
              <kbd>D</kbd> roll the ball · <b>drag</b> to orbit
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
        {NODES.map((n) => (
          <span
            key={n.id}
            className={s.mmNode}
            data-kind={n.kind}
            data-found={discovered.has(n.id) || undefined}
            style={{
              left: `${((n.x / UNIT + BOUNDS.x) / (BOUNDS.x * 2)) * 100}%`,
              top: `${((n.y / UNIT - BOUNDS.zMin) / (BOUNDS.zMax - BOUNDS.zMin)) * 100}%`,
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
