import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { LINKS, NODES } from '../data/cv';
import { BOUNDS, DISCOVER, HOME_R, LEFT_HOME, NEAR, UNIT, createScene } from '../three/scene';
import Gallery from './Gallery';
import s from './world.module.css';

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const START = new THREE.Vector3(0, 0, 5.4);

export default function World({ onOpen, paused = false }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const labelRefs = useRef({});
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
      world = createScene(canvas, { nodes: NODES, links: LINKS, calm: S.calm });
    } catch (err) {
      console.error('WebGL unavailable:', err);
      setFailed(true);
      return;
    }
    setReady(true);

    const { renderer, scene, camera, nodeObjs, byId, linkObjs, player, raycaster } = world;
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

    /* ---------- pointer: drag orbits the camera, click picks a node ---------- */
    const pointer = new THREE.Vector2();
    let hasPointer = false;

    const onPointerDown = (e) => {
      if (e.target.closest('[data-label]')) return;
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

      const accel = new THREE.Vector3()
        .addScaledVector(right, ix)
        .addScaledVector(fwd, iz);
      if (accel.lengthSq() > 0) accel.normalize().multiplyScalar(74 * dt);

      S.vel.add(accel).multiplyScalar(Math.pow(0.0016, dt));
      player.position.addScaledVector(S.vel, dt);
      player.position.x = clamp(player.position.x, -BOUNDS.x, BOUNDS.x);
      player.position.z = clamp(player.position.z, BOUNDS.zMin, BOUNDS.zMax);

      // bob + spin
      if (!S.calm) {
        player.children[0].position.y = 0.85 + Math.sin(clock * 2.4) * 0.08;
        player.children[0].rotation.y += dt * 0.9;
      }

      /* trail */
      if (!S.calm) {
        if (!world.trailPts.length || world.trailPts[0].distanceTo(player.position) > 0.35) {
          world.trailPts.unshift(player.position.clone().setY(0.5));
          if (world.trailPts.length > 60) world.trailPts.pop();
        }
        for (let i = 0; i < 60; i++) {
          const p = world.trailPts[Math.min(i, world.trailPts.length - 1)] ?? player.position;
          world.trailPos[i * 3] = p.x;
          world.trailPos[i * 3 + 1] = p.y;
          world.trailPos[i * 3 + 2] = p.z;
        }
        world.trail.geometry.attributes.position.needsUpdate = true;
      }

      /* camera: chase from behind-and-above, orbiting with yaw.
         +z offset so the camera looks down -z, the direction W travels. */
      camPos.set(
        player.position.x + Math.sin(S.yaw) * 19,
        17,
        player.position.z + Math.cos(S.yaw) * 19,
      );
      camera.position.lerp(camPos, S.calm ? 1 : 1 - Math.pow(0.0009, dt));
      camLook.copy(player.position).setY(1.6);
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

      /* base camp -> gallery, once the player has actually left it */
      const dHome = homeObj.base.distanceTo(player.position);
      if (dHome > LEFT_HOME) S.leftHome = true;
      if (S.leftHome && dHome < HOME_R && !S.galleryDone && !S.paused) {
        S.galleryDone = true;
        setGallery(true);
      }

      /* hover picking */
      if (hasPointer && !S.drag && !isCoarse) {
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(world.coreMeshes, false)[0];
        const id = hit?.object.userData.nodeId ?? null;
        if (id !== S.hoverId) {
          S.hoverId = id;
          if (id) stage.dataset.pick = '';
          else delete stage.dataset.pick;
        }
      }

      /* node animation */
      for (const o of nodeObjs) {
        const found = S.discovered.has(o.id);
        const hot = S.activeId === o.id || S.hoverId === o.id;
        const t = clock + o.base.x;

        if (!S.calm) {
          o.shell.rotation.y += dt * (hot ? 0.9 : 0.32);
          o.shell.rotation.x += dt * 0.12;
          o.core.rotation.y -= dt * 0.5;
          o.group.position.y = Math.sin(t * 0.8) * 0.14;
          o.ring.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04);
        }

        // Undiscovered nodes must still read clearly against the dark floor —
        // they are the thing the visitor is meant to walk toward.
        const targetEmissive = found ? (hot ? 2.6 : 1.35) : 0.7;
        o.core.material.emissiveIntensity += (targetEmissive - o.core.material.emissiveIntensity) * 0.12;

        const targetGlow = found ? (hot ? 1 : 0.62) : 0.34;
        o.glow.material.opacity += (targetGlow - o.glow.material.opacity) * 0.12;

        const targetShell = hot ? 0.8 : found ? 0.48 : 0.3;
        o.shell.material.opacity += (targetShell - o.shell.material.opacity) * 0.12;

        o.ring.material.opacity = found ? 0.55 : 0.3;
        o.beam.material.opacity = found ? 0.34 : 0.2;
      }

      /* link packets flow between discovered nodes */
      for (const l of linkObjs) {
        const lit = S.discovered.has(l.a) && S.discovered.has(l.b);
        l.line.material.opacity += ((lit ? 0.62 : 0.16) - l.line.material.opacity) * 0.1;
        l.line.material.color.lerp(new THREE.Color(lit ? 0x22d3ee : 0x334155), 0.06);

        if (lit && !S.calm) {
          const t = (clock * 0.22 + l.seed) % 1;
          l.curve.getPoint(t, l.packet.position);
          l.packet.material.opacity = Math.sin(t * Math.PI) * 0.9;
        } else {
          l.packet.material.opacity = 0;
        }
      }

      world.grid.material.uniforms.uTime.value = clock;
      world.particles.material.uniforms.uTime.value = clock;
      world.pGlow.material.opacity = 0.6 + Math.sin(clock * 3) * 0.12;

      renderer.render(scene, camera);
      paintLabels();
    };

    /* Project each node into screen space and place its HTML label there. */
    const paintLabels = () => {
      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;
      const pad = 42;

      for (const o of nodeObjs) {
        const el = labelRefs.current[o.id];
        const arrow = arrowRefs.current[o.id];
        projected.copy(o.base).setY(4.1).project(camera);

        const behind = projected.z > 1;
        const sx = (projected.x * 0.5 + 0.5) * w;
        const sy = (-projected.y * 0.5 + 0.5) * h;
        const onScreen = !behind && sx > pad && sx < w - pad && sy > pad && sy < h - pad;

        if (el) {
          el.style.opacity = onScreen ? '1' : '0';
          el.style.pointerEvents = onScreen ? 'auto' : 'none';
          // sit the label above the node rather than on top of it
          if (onScreen) el.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -100%)`;
        }

        if (arrow) {
          arrow.style.opacity = onScreen ? '0' : '1';
          if (!onScreen) {
            // flip the vector when the node is behind the camera
            const dx = (behind ? -projected.x : projected.x) * (w / 2);
            const dy = (behind ? projected.y : -projected.y) * (h / 2);
            const ang = Math.atan2(dy, dx);
            const ex = clamp(w / 2 + dx, pad, w - pad);
            const ey = clamp(h / 2 + dy, pad, h - pad);
            arrow.style.transform = `translate3d(${ex}px, ${ey}px, 0) rotate(${ang}rad)`;
          }
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

  return (
    <div className={s.stage} ref={stageRef}>
      <canvas ref={canvasRef} className={s.canvas} />

      {failed && (
        <div className={s.fallback}>
          <p>Your browser blocked WebGL, so the 3D map can’t render.</p>
          <a href="#work">Browse the work as cards →</a>
        </div>
      )}

      {/* Labels are real buttons projected onto the 3D nodes: the map stays
          keyboard- and screen-reader navigable. */}
      <div className={s.labels}>
        {NODES.map((n) => (
          <button
            key={n.id}
            data-label
            data-kind={n.kind}
            data-active={activeId === n.id || undefined}
            data-found={discovered.has(n.id) || undefined}
            className={s.label}
            ref={(el) => {
              labelRefs.current[n.id] = el;
            }}
            onClick={() => !sim.current.dragMoved && openNode(n.id)}
            aria-label={`${n.label} — ${n.kicker}. Open case study.`}
          >
            <span className={s.labelKicker}>{n.kicker}</span>
            <span className={s.labelName}>{n.label}</span>
            {activeId === n.id && !coarse && (
              <span className={s.hint}>
                <kbd>E</kbd> inspect
              </span>
            )}
          </button>
        ))}
      </div>

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

      {/* HUD */}
      <div className={s.hudTop}>
        <div className={s.counter} role="status" aria-live="polite">
          <span className="srOnly">
            {found} of {total} nodes discovered
          </span>
          <span className={s.counterNum} aria-hidden="true">
            {String(found).padStart(2, '0')}
            <i>/</i>
            {String(total).padStart(2, '0')}
          </span>
          <span className={s.counterLabel} aria-hidden="true">
            nodes mapped
          </span>
          <span className={s.meter} aria-hidden="true">
            <i style={{ transform: `scaleX(${found / total})` }} />
          </span>
        </div>
        {found === total && <span className={s.complete}>// graph complete</span>}
      </div>

      <div className={s.hudBottom}>
        <p className={s.controls} data-dim={touched || undefined}>
          {coarse ? (
            <>
              <b>Drag</b> to orbit · <b>Tap</b> a node
            </>
          ) : (
            <>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> move · <b>drag</b> to orbit · <kbd>E</kbd> inspect
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

      {!ready && !failed && <div className={s.boot}>initialising scene…</div>}

      <Gallery open={gallery} onClose={() => setGallery(false)} />
    </div>
  );
}
