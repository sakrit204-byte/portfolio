import * as THREE from 'three';

/**
 * A daylight golf course, built with plain three.js and driven imperatively.
 * React owns the HUD; this module owns everything on the GPU.
 *
 * World axes: X right, Z toward the viewer, Y up. The CV's 2D map coords map
 * to (x, z) scaled down by UNIT. Each project is a flagged hole; the player
 * is a golf ball. Walking up to a flag opens a hologram panel above the pole.
 */

export const UNIT = 26; // CV map px per world unit
export const NEAR = 3.9; // world units — flag becomes inspectable
export const DISCOVER = 4.6;
export const HOME_R = 3.2;
export const LEFT_HOME = HOME_R + 2.5; // must get this far out before returning
export const BOUNDS = { x: 44, zMin: -20, zMax: 26 };

export const KIND_COLOR = {
  home: 0x22d3ee,
  studio: 0xa78bfa,
  gov: 0x34d399,
  product: 0xf472b6,
  client: 0x38bdf8,
  beacon: 0xfbbf24,
};

const toWorld = (n) => new THREE.Vector3(n.x / UNIT, 0, n.y / UNIT);
const cssColor = (hex) => `#${hex.toString(16).padStart(6, '0')}`;
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Deterministic value noise — keeps the terrain stable across reloads. */
const hash2 = (i, j) => {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const noise2 = (x, z) => {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fx = x - i;
  const fz = z - j;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j);
  const b = hash2(i + 1, j);
  const c = hash2(i, j + 1);
  const d = hash2(i + 1, j + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
};

/* ------------------------------------------------------------------ */
/* environment                                                         */
/* ------------------------------------------------------------------ */

function makeSky() {
  const geo = new THREE.SphereGeometry(300, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new THREE.Color(0x4a8fd4) },
      uHorizon: { value: new THREE.Color(0xd7e8f4) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.62, 0.35).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uSunDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
        float sun = pow(max(dot(vDir, uSunDir), 0.0), 220.0);
        float halo = pow(max(dot(vDir, uSunDir), 0.0), 8.0);
        col += vec3(1.0, 0.93, 0.78) * sun * 1.2 + vec3(1.0, 0.96, 0.85) * halo * 0.16;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

/** Rolling grass with mown fairway stripes. Flat inside the play area. */
function makeTerrain() {
  const SIZE = 400;
  const SEG = 140;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const fairA = new THREE.Color(0x7ab55a);
  const fairB = new THREE.Color(0x6ca94e);
  const rough = new THREE.Color(0x4d8a3c);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);

    // hills only beyond the play area, so the ball always rolls on y = 0
    const f = smoothstep(46, 115, r);
    const y = f * (noise2(x * 0.035, z * 0.035) * 7 + noise2(x * 0.14, z * 0.14) * 0.9);
    pos.setY(i, y);

    const stripe = Math.floor((x + 1000) / 5) % 2 === 0 ? fairA : fairB;
    const toRough = smoothstep(30, 44, r);
    tmp.copy(stripe).lerp(rough, toRough);
    const mottle = 0.92 + noise2(x * 0.6, z * 0.6) * 0.16;
    colors[i * 3] = tmp.r * mottle;
    colors[i * 3 + 1] = tmp.g * mottle;
    colors[i * 3 + 2] = tmp.b * mottle;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

function makeTree(seed) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 1 }),
  );
  trunk.position.y = 0.8;
  trunk.castShadow = true;
  g.add(trunk);

  const leaf = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x3e7a33).offsetHSL(0, 0, (hash2(seed, 7) - 0.5) * 0.08),
    roughness: 1,
  });
  for (let k = 0; k < 3; k++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95 - k * 0.18, 1), leaf);
    blob.position.set((hash2(seed, k) - 0.5) * 0.8, 1.7 + k * 0.62, (hash2(seed, k + 3) - 0.5) * 0.8);
    blob.castShadow = true;
    g.add(blob);
  }
  const s = 0.8 + hash2(seed, 11) * 0.8;
  g.scale.setScalar(s);
  return g;
}

function makeBunker(x, z, r) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 28),
    new THREE.MeshStandardMaterial({ color: 0xdcc493, roughness: 1 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.03, z);
  m.scale.y = 0.75; // slightly elliptical
  m.receiveShadow = true;
  return m;
}

/** Drifting pollen — barely-there daylight atmosphere. */
function makePollen() {
  const N = 260;
  const pos = new Float32Array(N * 3);
  const off = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 150;
    pos[i * 3 + 1] = Math.random() * 10 + 0.5;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 150;
    off[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aOff', new THREE.BufferAttribute(off, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aOff;
      uniform float uTime;
      varying float vA;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.2 + aOff) * 1.6;
        p.y += sin(uTime * 0.33 + aOff * 2.0) * 0.7;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 1.8 * (46.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
        vA = 0.08 + 0.08 * sin(uTime * 0.6 + aOff);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(1.0, 1.0, 0.96, vA * smoothstep(0.5, 0.0, d));
      }
    `,
  });
  return new THREE.Points(geo, mat);
}

/* ------------------------------------------------------------------ */
/* flags + holograms                                                   */
/* ------------------------------------------------------------------ */

function flagTexture(node, accentCss) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 288;
  const g = c.getContext('2d');
  g.fillStyle = accentCss;
  g.fillRect(0, 0, 512, 288);
  // darker hem at the fly end
  const grad = g.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.24)');
  grad.addColorStop(0.25, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.14)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 288);

  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = '600 26px Inter, Arial, sans-serif';
  g.fillText(node.kicker, 34, 66);

  g.fillStyle = '#ffffff';
  g.font = '700 52px Inter, Arial, sans-serif';
  const words = node.label.split(' ');
  if (g.measureText(node.label).width > 440 && words.length > 1) {
    const mid = Math.ceil(words.length / 2);
    g.fillText(words.slice(0, mid).join(' '), 34, 148);
    g.fillText(words.slice(mid).join(' '), 34, 214);
  } else {
    g.fillText(node.label, 34, 168);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function holoTexture(node, galleryEntry) {
  const c = document.createElement('canvas');
  c.width = 880;
  c.height = 578;
  const g = c.getContext('2d');

  const draw = (img) => {
    g.clearRect(0, 0, 880, 578);
    // glass panel
    g.fillStyle = 'rgba(6, 18, 34, 0.93)';
    g.beginPath();
    g.roundRect(5, 5, 870, 568, 24);
    g.fill();
    g.strokeStyle = 'rgba(34, 211, 238, 0.9)';
    g.lineWidth = 3.5;
    g.stroke();

    g.fillStyle = '#8df4ff';
    g.font = '600 23px "JetBrains Mono", monospace';
    g.fillText('◈ PROJECT DATA', 42, 58);

    g.fillStyle = '#ffffff';
    g.font = '700 48px Inter, Arial, sans-serif';
    g.fillText(node.study?.title ?? node.label, 42, 118);
    g.fillStyle = 'rgba(200, 220, 240, 0.78)';
    g.font = '400 24px Inter, Arial, sans-serif';
    g.fillText(node.study?.role ?? node.kicker, 42, 155);

    // screenshot slot
    const sx = 42;
    const sy = 182;
    const sw = 796;
    const sh = 296;
    if (img) {
      g.save();
      g.beginPath();
      g.roundRect(sx, sy, sw, sh, 14);
      g.clip();
      const scale = Math.max(sw / img.width, sh / img.height);
      g.drawImage(img, sx + (sw - img.width * scale) / 2, sy + (sh - img.height * scale) / 2, img.width * scale, img.height * scale);
      g.restore();
    } else {
      g.strokeStyle = 'rgba(141, 244, 255, 0.4)';
      g.setLineDash([11, 9]);
      g.lineWidth = 2;
      g.strokeRect(sx, sy, sw, sh);
      g.setLineDash([]);
      for (let x = sx; x < sx + sw; x += 30) {
        g.strokeStyle = 'rgba(141, 244, 255, 0.06)';
        g.beginPath();
        g.moveTo(x, sy);
        g.lineTo(x + sh, sy + sh);
        g.stroke();
      }
      g.fillStyle = 'rgba(141, 244, 255, 0.75)';
      g.font = '600 23px "JetBrains Mono", monospace';
      g.textAlign = 'center';
      g.fillText('[ SCREENSHOT AWAITING UPLOAD ]', 440, sy + sh / 2 + 8);
      g.textAlign = 'left';
    }

    // metric chips
    const metrics = node.study?.metrics ?? [];
    let mx = 42;
    g.font = '600 21px "JetBrains Mono", monospace';
    for (const m of metrics.slice(0, 3)) {
      const label = `${m.value} ${m.label}`;
      const w = g.measureText(label).width + 34;
      g.fillStyle = 'rgba(34, 211, 238, 0.12)';
      g.beginPath();
      g.roundRect(mx, 502, w, 44, 10);
      g.fill();
      g.strokeStyle = 'rgba(34, 211, 238, 0.45)';
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = '#a9f4ff';
      g.fillText(label, mx + 17, 531);
      mx += w + 13;
    }
  };

  draw(null);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;

  if (galleryEntry?.src) {
    const img = new Image();
    img.onload = () => {
      draw(img);
      t.needsUpdate = true;
    };
    img.src = galleryEntry.src;
  }
  return t;
}

function makeFlagNode(node, gallery) {
  const accent = KIND_COLOR[node.kind] ?? KIND_COLOR.home;
  const accentCss = cssColor(accent);
  const g = new THREE.Group();
  g.position.copy(toWorld(node));

  // cup + rim
  const cup = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 24),
    new THREE.MeshBasicMaterial({ color: 0x101510 }),
  );
  cup.rotation.x = -Math.PI / 2;
  cup.position.y = 0.035;
  g.add(cup);
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.42, 24),
    new THREE.MeshBasicMaterial({ color: 0xf2f5f0 }),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.04;
  g.add(rim);

  // discovery ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 1.62, 48),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.15, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);

  // pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xf5f7f4, roughness: 0.4, metalness: 0.3 }),
  );
  pole.position.y = 2;
  pole.castShadow = true;
  pole.userData.nodeId = node.id;
  g.add(pole);

  // waving flag — geometry anchored at the pole edge so the wave pivots there
  const flagGeo = new THREE.PlaneGeometry(1.9, 1.05, 14, 5);
  flagGeo.translate(0.95, 0, 0);
  const flag = new THREE.Mesh(
    flagGeo,
    new THREE.MeshStandardMaterial({
      map: flagTexture(node, accentCss),
      side: THREE.DoubleSide,
      roughness: 0.85,
    }),
  );
  flag.position.y = 3.42;
  flag.castShadow = true;
  flag.userData.nodeId = node.id;
  g.add(flag);

  /* hologram: beam + billboard panel, closed until the player is near */
  const holo = new THREE.Group();
  holo.position.y = 6.7;
  holo.visible = false;

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.85, 2.6, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.y = -2.5;
  holo.add(beam);

  const galleryEntry = gallery.find(
    (e) =>
      e.project.toLowerCase() === node.label.toLowerCase() ||
      e.project.toLowerCase() === node.kicker.toLowerCase(),
  );
  const panelMat = new THREE.MeshBasicMaterial({
    map: holoTexture(node, galleryEntry),
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.42), panelMat);
  panel.userData.nodeId = node.id;
  holo.add(panel);
  g.add(holo);

  return {
    id: node.id,
    kind: node.kind,
    base: toWorld(node),
    group: g,
    flag,
    flagGeo,
    ring,
    holo,
    beam,
    panel,
    holoT: 0, // 0 closed → 1 open
    phase: hash2(node.x, node.y) * Math.PI * 2,
    pickMeshes: [pole, flag, panel],
  };
}

/* ------------------------------------------------------------------ */

export function createScene(canvas, { nodes, links, gallery, calm, coarse }) {
  // Touch screens are small and held at arm's length — supersize the holograms.
  const holoBoost = coarse ? 1.3 : 1;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xd7e8f4, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd7e8f4, 70, 190);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);

  scene.add(new THREE.HemisphereLight(0xbfd8f0, 0x5b8a44, 0.95));
  const sun = new THREE.DirectionalLight(0xfff2df, 1.55);
  sun.position.set(42, 58, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  scene.add(makeSky());
  scene.add(makeTerrain());
  const pollen = makePollen();
  scene.add(pollen);

  // scenery: trees around the course, a few bunkers inside it
  for (let i = 0; i < 26; i++) {
    const ang = hash2(i, 1) * Math.PI * 2;
    const rad = 48 + hash2(i, 2) * 45;
    const tree = makeTree(i);
    tree.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad * 0.7);
    scene.add(tree);
  }
  scene.add(makeBunker(18, -11, 4));
  scene.add(makeBunker(-25, 9, 5));
  scene.add(makeBunker(7, 19, 3.2));

  /* ---------------- flags ---------------- */
  const nodeObjs = nodes.map((n) => makeFlagNode(n, gallery));
  nodeObjs.forEach((o) => scene.add(o.group));
  const byId = Object.fromEntries(nodeObjs.map((o) => [o.id, o]));
  const pickMeshes = nodeObjs.flatMap((o) => o.pickMeshes);

  /* ---------------- cart paths between holes ---------------- */
  const linkObjs = links
    .map(([a, b], i) => {
      const A = byId[a];
      const B = byId[b];
      if (!A || !B) return null;
      const from = A.base.clone().setY(0.06);
      const to = B.base.clone().setY(0.06);
      const mid = from.clone().lerp(to, 0.5);
      const dir = to.clone().sub(from);
      const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      mid.addScaledVector(perp, (hash2(i, 5) - 0.5) * dir.length() * 0.3);

      const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(50)),
        new THREE.LineDashedMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.2,
          dashSize: 0.55,
          gapSize: 0.45,
        }),
      );
      line.computeLineDistances();
      scene.add(line);

      const runner = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
      );
      scene.add(runner);

      return { a, b, curve, line, runner, seed: (i * 0.37) % 1 };
    })
    .filter(Boolean);

  /* ---------------- the golf ball ---------------- */
  const player = new THREE.Group();

  // dimples via a generated bump map
  const bumpC = document.createElement('canvas');
  bumpC.width = bumpC.height = 256;
  const bg = bumpC.getContext('2d');
  bg.fillStyle = '#808080';
  bg.fillRect(0, 0, 256, 256);
  bg.fillStyle = '#5a5a5a';
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 12; col++) {
      const ox = row % 2 === 0 ? 0 : 10;
      bg.beginPath();
      bg.arc(col * 21 + ox + 8, row * 21 + 8, 4.6, 0, Math.PI * 2);
      bg.fill();
    }
  }
  const bumpTex = new THREE.CanvasTexture(bumpC);
  bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping;

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 40, 28),
    new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.42, metalness: 0, bumpMap: bumpTex, bumpScale: 0.35 }),
  );
  ball.position.y = 0.5;
  ball.castShadow = true;
  player.add(ball);
  scene.add(player);

  const raycaster = new THREE.Raycaster();
  const up = new THREE.Vector3(0, 1, 0);
  const rollAxis = new THREE.Vector3();
  const rollQ = new THREE.Quaternion();
  const flagBase = flagPositionsSnapshot(nodeObjs);

  function flagPositionsSnapshot(objs) {
    const m = {};
    for (const o of objs) {
      const p = o.flagGeo.attributes.position;
      m[o.id] = Float32Array.from(p.array);
    }
    return m;
  }

  /** All per-frame scene animation. `st` = {active, hover, discovered, vel}. */
  function update(dt, clock, st) {
    pollen.material.uniforms.uTime.value = clock;

    // ball rolls in the direction of travel
    const speed = st.vel.length();
    if (speed > 0.02) {
      rollAxis.copy(up).cross(st.vel).normalize();
      rollQ.setFromAxisAngle(rollAxis, (speed * dt) / 0.5);
      ball.quaternion.premultiply(rollQ);
    }

    for (const o of nodeObjs) {
      const found = st.discovered.has(o.id);
      const hot = st.active === o.id || st.hover === o.id;

      // flag wave
      if (!calm) {
        const p = o.flag.geometry.attributes.position;
        const base = flagBase[o.id];
        for (let i = 0; i < p.count; i++) {
          const x = base[i * 3];
          const k = x / 1.9;
          p.setZ(i, Math.sin(x * 3.2 - clock * 5 + o.phase) * 0.1 * k);
        }
        p.needsUpdate = true;
        o.flag.geometry.computeVertexNormals();
      }

      o.ring.material.opacity += ((found ? 0.55 : 0.15) - o.ring.material.opacity) * 0.1;
      if (!calm) o.ring.scale.setScalar(1 + Math.sin(clock * 1.8 + o.phase) * 0.04);

      // hologram opens when the player is at the flag (or hovering it)
      const target = hot ? 1 : 0;
      o.holoT += (target - o.holoT) * (calm ? 1 : Math.min(1, dt * 7));
      const t = o.holoT;
      o.holo.visible = t > 0.02;
      if (o.holo.visible) {
        const ease = 1 - Math.pow(1 - t, 3);
        o.holo.scale.setScalar((0.05 + 0.95 * ease) * holoBoost);
        o.panel.material.opacity = 0.96 * ease;
        o.beam.material.opacity = 0.2 * ease;
        if (!calm) o.holo.position.y = 6.7 + Math.sin(clock * 1.6) * 0.07;
        // billboard the panel toward the camera (yaw only)
        const dx = camera.position.x - o.group.position.x;
        const dz = camera.position.z - o.group.position.z;
        o.holo.rotation.y = Math.atan2(dx, dz);
      }
    }

    for (const l of linkObjs) {
      const lit = st.discovered.has(l.a) && st.discovered.has(l.b);
      l.line.material.opacity += ((lit ? 0.5 : 0.18) - l.line.material.opacity) * 0.08;
      if (lit && !calm) {
        const t = (clock * 0.16 + l.seed) % 1;
        l.curve.getPoint(t, l.runner.position);
        l.runner.position.y = 0.14;
        l.runner.material.opacity = Math.sin(t * Math.PI) * 0.85;
      } else {
        l.runner.material.opacity = 0;
      }
    }
  }

  return {
    renderer,
    scene,
    camera,
    nodeObjs,
    byId,
    player,
    pickMeshes,
    raycaster,
    update,

    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Portrait phones see a thin vertical slice at 50° — widen the view so
      // the course (and an open hologram) still fits the frame.
      camera.fov = camera.aspect < 0.9 ? 66 : camera.aspect < 1.4 ? 58 : 50;
      camera.updateProjectionMatrix();
    },

    dispose() {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (m.map) m.map.dispose();
            if (m.bumpMap) m.bumpMap.dispose();
            m.dispose();
          });
        }
      });
      renderer.dispose();
    },
  };
}
