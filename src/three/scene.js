import * as THREE from 'three';

/**
 * The 3D world, built with plain three.js and driven imperatively.
 * React owns the HUD and labels; this module owns everything on the GPU.
 *
 * World axes: X right, Z toward the viewer, Y up. The CV's 2D map coords map
 * to (x, z) scaled down by UNIT.
 */

export const UNIT = 26; // CV map px per world unit
export const NEAR = 3.9; // world units — marker becomes inspectable
export const DISCOVER = 4.6;
export const HOME_R = 3.2;
export const LEFT_HOME = HOME_R + 2.5; // must get this far out before returning
export const BOUNDS = { x: 44, zMin: -20, zMax: 26 };

const KIND_COLOR = {
  home: 0x22d3ee,
  studio: 0xa78bfa,
  gov: 0x34d399,
  product: 0xf472b6,
  client: 0x38bdf8,
  beacon: 0xfbbf24,
};

const toWorld = (n) => new THREE.Vector3(n.x / UNIT, 0, n.y / UNIT);

/** Soft radial sprite used for node glows and the player halo. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Infinite-feeling grid floor that fades with distance. */
function makeGrid() {
  const geo = new THREE.PlaneGeometry(400, 400, 1, 1);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(0x22d3ee) },
      uColor2: { value: new THREE.Color(0x1e293b) },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vPos;
      uniform vec3 uColor;
      uniform vec3 uColor2;
      uniform float uTime;

      // Anti-aliased grid line via screen-space derivatives.
      float gridLine(vec2 p, float scale, float thickness) {
        vec2 g = abs(fract(p / scale - 0.5) - 0.5) / fwidth(p / scale);
        float l = min(g.x, g.y);
        return 1.0 - min(l * thickness, 1.0);
      }

      void main() {
        float minor = gridLine(vPos, 2.0, 1.0);
        float major = gridLine(vPos, 10.0, 1.2);

        float d = length(vPos);
        float fade = smoothstep(150.0, 25.0, d);

        // a slow pulse rolling outward, like a radar sweep
        float pulse = 0.5 + 0.5 * sin(d * 0.12 - uTime * 0.9);

        vec3 col = mix(uColor2, uColor, major * 0.85 + pulse * 0.12);
        float a = (minor * 0.16 + major * 0.5) * fade;
        if (a < 0.002) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.02;
  return mesh;
}

/** Drifting particle field — reads as latent space / data points. */
function makeParticles() {
  const N = 900;
  const pos = new Float32Array(N * 3);
  const off = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 190;
    pos[i * 3 + 1] = Math.random() * 42 + 0.6;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 190;
    off[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aOff', new THREE.BufferAttribute(off, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x67e8f9) } },
    vertexShader: /* glsl */ `
      attribute float aOff;
      uniform float uTime;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.28 + aOff) * 1.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 2.2 * (60.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
        vA = 0.28 + 0.32 * sin(uTime * 0.7 + aOff);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(uColor, vA * smoothstep(0.5, 0.0, d));
      }
    `,
  });
  return new THREE.Points(geo, mat);
}

export function createScene(canvas, { nodes, links, calm }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x05070c, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x05070c, 46, 128);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);

  scene.add(new THREE.AmbientLight(0x94a3b8, 0.5));
  const key = new THREE.DirectionalLight(0xbfdbfe, 0.7);
  key.position.set(14, 26, 12);
  scene.add(key);

  const grid = makeGrid();
  scene.add(grid);

  const particles = makeParticles();
  scene.add(particles);

  const tex = glowTexture();

  /* ---------------- nodes ---------------- */
  const nodeGroup = new THREE.Group();
  scene.add(nodeGroup);

  const nodeObjs = nodes.map((n) => {
    const color = new THREE.Color(KIND_COLOR[n.kind] ?? KIND_COLOR.home);
    const base = toWorld(n);
    const g = new THREE.Group();
    g.position.copy(base);

    // wireframe shell
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.75, 1),
      new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.32 }),
    );
    shell.position.y = 1.9;
    g.add(shell);

    // solid core
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.8, 2),
      new THREE.MeshStandardMaterial({
        color: 0x121a29,
        emissive: color,
        emissiveIntensity: 0.7,
        roughness: 0.3,
        metalness: 0.15,
      }),
    );
    core.position.y = 1.9;
    core.userData.nodeId = n.id; // raycast target
    g.add(core);

    // glow sprite
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.scale.setScalar(6);
    glow.position.y = 1.9;
    g.add(glow);

    // ground ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.85, 2.0, 64),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.34, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);

    // beam from ground to core
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 1.9, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22 }),
    );
    beam.position.y = 0.95;
    g.add(beam);

    nodeGroup.add(g);
    return { id: n.id, kind: n.kind, group: g, shell, core, glow, ring, beam, color, base };
  });

  const coreMeshes = nodeObjs.map((o) => o.core);
  const byId = Object.fromEntries(nodeObjs.map((o) => [o.id, o]));

  /* ---------------- links ---------------- */
  const linkObjs = links
    .map(([a, b], i) => {
      const A = byId[a];
      const B = byId[b];
      if (!A || !B) return null;
      const from = A.base.clone().setY(1.9);
      const to = B.base.clone().setY(1.9);
      const mid = from.clone().lerp(to, 0.5);
      mid.y += 3.4 + (i % 3) * 0.8; // arc the cable upward

      const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)),
        new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.5 }),
      );
      scene.add(line);

      // packet that travels the cable once both ends are discovered
      const packet = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, color: 0x22d3ee, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      packet.scale.setScalar(1.5);
      scene.add(packet);

      return { a, b, curve, line, packet, seed: (i * 0.37) % 1 };
    })
    .filter(Boolean);

  /* ---------------- player ---------------- */
  const player = new THREE.Group();
  const pCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.45, 3),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x22d3ee, emissiveIntensity: 1.4, roughness: 0.2 }),
  );
  pCore.position.y = 0.85;
  player.add(pCore);

  const pGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, color: 0x22d3ee, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  pGlow.scale.setScalar(5.5);
  pGlow.position.y = 0.85;
  player.add(pGlow);

  const pLight = new THREE.PointLight(0x22d3ee, 26, 26, 2);
  pLight.position.y = 1.4;
  player.add(pLight);

  // shadow puck on the floor
  const pShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 32),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.18 }),
  );
  pShadow.rotation.x = -Math.PI / 2;
  pShadow.position.y = 0.015;
  player.add(pShadow);
  scene.add(player);

  /* ---------------- trail ---------------- */
  const TRAIL = 60;
  const trailPos = new Float32Array(TRAIL * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  const trail = new THREE.Line(
    trailGeo,
    new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.4 }),
  );
  trail.frustumCulled = false;
  if (!calm) scene.add(trail);
  const trailPts = [];

  const raycaster = new THREE.Raycaster();

  return {
    renderer,
    scene,
    camera,
    nodeObjs,
    byId,
    linkObjs,
    player,
    pLight,
    pGlow,
    grid,
    particles,
    coreMeshes,
    raycaster,
    trail,
    trailPts,
    trailPos,

    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },

    dispose() {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
      tex.dispose();
      renderer.dispose();
    },
  };
}

export { KIND_COLOR, toWorld };
