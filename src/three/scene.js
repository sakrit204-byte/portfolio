import * as THREE from 'three';

/**
 * A golf-course island that IS the CV: each flag is a CV section, large
 * holograms line the routes with the fine print, and the course games
 * unlock facts. Plain three.js, driven imperatively; React owns the HUD.
 *
 * World axes: X right, Z toward the viewer, Y up.
 */

export const NEAR = 4.6; // world units — flag becomes inspectable
export const DISCOVER = 5.6;
export const HOME_R = 4.2;
export const LEFT_HOME = HOME_R + 4;
export const HOLO_R = 9; // route holograms open inside this radius
export const CART_R = 4; // "press I" radius around the cart
export const ISLAND = { rx: 72, rz: 56 }; // playable shore ellipse

export const KIND_COLOR = {
  home: 0x4ade80,
  studio: 0xa78bfa,
  gov: 0x34d399,
  product: 0xf472b6,
  client: 0x38bdf8,
  beacon: 0xfbbf24,
};

const cssColor = (hex) => `#${hex.toString(16).padStart(6, '0')}`;
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
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

/* the island profile: flat playing field, grassy lip, then under the sea */
const ellipseNorm = (x, z) => Math.hypot(x / (ISLAND.rx + 8), z / (ISLAND.rz + 8));
const groundHeight = (x, z) => {
  const e = ellipseNorm(x, z);
  const lip = smoothstep(0.72, 0.95, e) * (noise2(x * 0.05, z * 0.05) * 2.2 + 0.4);
  const drop = smoothstep(1.0, 1.22, e) * -6.5;
  return lip + drop;
};

/* ------------------------------------------------------------------ */
/* environment                                                         */
/* ------------------------------------------------------------------ */

function makeSky() {
  const geo = new THREE.SphereGeometry(420, 24, 16);
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

function makeTerrain() {
  const SIZE = 420;
  const SEG = 150;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const fairA = new THREE.Color(0x7ab55a);
  const fairB = new THREE.Color(0x6ca94e);
  const rough = new THREE.Color(0x4d8a3c);
  const sand = new THREE.Color(0xdcc493);
  const seabed = new THREE.Color(0x3d6e57);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundHeight(x, z));

    const e = ellipseNorm(x, z);
    const stripe = Math.floor((x + 1000) / 5) % 2 === 0 ? fairA : fairB;
    tmp.copy(stripe).lerp(rough, smoothstep(0.55, 0.8, e));
    tmp.lerp(sand, smoothstep(0.93, 1.0, e)); // beach ring
    tmp.lerp(seabed, smoothstep(1.04, 1.2, e)); // under the water
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

function makeWater() {
  const geo = new THREE.PlaneGeometry(900, 900, 1, 1);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x11667e) },
      uShallow: { value: new THREE.Color(0x3fb6c9) },
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
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      void main() {
        float w1 = sin(vPos.x * 0.14 + uTime * 0.9) * sin(vPos.y * 0.11 - uTime * 0.7);
        float w2 = sin((vPos.x + vPos.y) * 0.05 + uTime * 0.5);
        float w = w1 * 0.5 + w2 * 0.5;
        vec3 col = mix(uDeep, uShallow, 0.5 + 0.5 * w);
        float sparkle = smoothstep(0.86, 1.0, w1) * 0.5;
        gl_FragColor = vec4(col + sparkle, 0.93);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.55;
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
  g.scale.setScalar(0.85 + hash2(seed, 11) * 0.9);
  return g;
}

function makePollen() {
  const N = 260;
  const pos = new Float32Array(N * 3);
  const off = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 170;
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
/* canvas textures                                                     */
/* ------------------------------------------------------------------ */

function flagTexture(node, accentCss) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 288;
  const g = c.getContext('2d');
  g.fillStyle = accentCss;
  g.fillRect(0, 0, 512, 288);
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
  g.font = '700 56px Inter, Arial, sans-serif';
  const words = node.label.split(' ');
  if (g.measureText(node.label).width > 440 && words.length > 1) {
    const mid = Math.ceil(words.length / 2);
    g.fillText(words.slice(0, mid).join(' '), 34, 150);
    g.fillText(words.slice(mid).join(' '), 34, 216);
  } else {
    g.fillText(node.label, 34, 172);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function flagHoloTexture(node, galleryEntry) {
  const c = document.createElement('canvas');
  c.width = 880;
  c.height = 578;
  const g = c.getContext('2d');

  const draw = (img) => {
    g.clearRect(0, 0, 880, 578);
    g.fillStyle = 'rgba(6, 18, 34, 0.93)';
    g.beginPath();
    g.roundRect(5, 5, 870, 568, 24);
    g.fill();
    g.strokeStyle = 'rgba(34, 211, 238, 0.9)';
    g.lineWidth = 3.5;
    g.stroke();

    g.fillStyle = '#8df4ff';
    g.font = '600 23px "JetBrains Mono", monospace';
    g.fillText('◈ CV SECTION', 42, 58);

    g.fillStyle = '#ffffff';
    g.font = '700 48px Inter, Arial, sans-serif';
    g.fillText(node.study?.title ?? node.label, 42, 118);
    g.fillStyle = 'rgba(200, 220, 240, 0.78)';
    g.font = '400 24px Inter, Arial, sans-serif';
    g.fillText(node.study?.role ?? node.kicker, 42, 155);

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
      g.fillStyle = 'rgba(141, 244, 255, 0.75)';
      g.font = '600 23px "JetBrains Mono", monospace';
      g.textAlign = 'center';
      g.fillText('[ SCREENSHOT AWAITING UPLOAD ]', 440, sy + sh / 2 + 8);
      g.textAlign = 'left';
    }

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

/** Route hologram panel — pure text, wider than the flag panels. */
function routeHoloTexture(holo, accentCss) {
  const c = document.createElement('canvas');
  c.width = 1000;
  c.height = 460;
  const g = c.getContext('2d');

  g.fillStyle = 'rgba(6, 18, 34, 0.93)';
  g.beginPath();
  g.roundRect(5, 5, 990, 450, 26);
  g.fill();
  g.strokeStyle = accentCss;
  g.lineWidth = 4;
  g.stroke();

  g.fillStyle = accentCss;
  g.font = '600 24px "JetBrains Mono", monospace';
  g.fillText(`◈ ${holo.kicker}`, 46, 66);

  g.fillStyle = '#ffffff';
  g.font = '700 62px Inter, Arial, sans-serif';
  g.fillText(holo.title, 46, 148);

  g.font = '400 30px Inter, Arial, sans-serif';
  holo.lines.forEach((line, i) => {
    g.fillStyle = 'rgba(210, 228, 244, 0.88)';
    g.fillText('› ' + line, 46, 216 + i * 54);
  });

  g.fillStyle = 'rgba(141, 244, 255, 0.55)';
  g.font = '600 20px "JetBrains Mono", monospace';
  g.fillText('[ C ]  CLOSE', 46, 418);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ */
/* props                                                               */
/* ------------------------------------------------------------------ */

function makeFlagNode(node, gallery) {
  const accent = KIND_COLOR[node.kind] ?? KIND_COLOR.home;
  const accentCss = cssColor(accent);
  const g = new THREE.Group();
  g.position.set(node.x, 0, node.z);

  const cup = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), new THREE.MeshBasicMaterial({ color: 0x101510 }));
  cup.rotation.x = -Math.PI / 2;
  cup.position.y = 0.035;
  g.add(cup);
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 24), new THREE.MeshBasicMaterial({ color: 0xf2f5f0 }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.04;
  g.add(rim);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 1.62, 48),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.15, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, 4.6, 8),
    new THREE.MeshStandardMaterial({ color: 0xf5f7f4, roughness: 0.4, metalness: 0.3 }),
  );
  pole.position.y = 2.3;
  pole.castShadow = true;
  pole.userData.nodeId = node.id;
  g.add(pole);

  const flagGeo = new THREE.PlaneGeometry(2.2, 1.25, 14, 5);
  flagGeo.translate(1.1, 0, 0);
  const flag = new THREE.Mesh(
    flagGeo,
    new THREE.MeshStandardMaterial({ map: flagTexture(node, accentCss), side: THREE.DoubleSide, roughness: 0.85 }),
  );
  flag.position.y = 3.9;
  flag.castShadow = true;
  flag.userData.nodeId = node.id;
  g.add(flag);

  const holo = new THREE.Group();
  holo.position.y = 7.3;
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
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 3.42),
    new THREE.MeshBasicMaterial({
      map: flagHoloTexture(node, galleryEntry),
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  panel.userData.nodeId = node.id;
  holo.add(panel);
  g.add(holo);

  return {
    id: node.id,
    kind: node.kind,
    base: new THREE.Vector3(node.x, 0, node.z),
    group: g,
    flag,
    flagBase: Float32Array.from(flagGeo.attributes.position.array),
    ring,
    holo,
    beam,
    panel,
    holoT: 0,
    phase: hash2(node.x, node.z) * Math.PI * 2,
    pickMeshes: [pole, flag, panel],
  };
}

function makeRouteHolo(h) {
  const accent = KIND_COLOR[h.kind] ?? KIND_COLOR.home;
  const g = new THREE.Group();
  g.position.set(h.x, 0, h.z);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.65, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.5, metalness: 0.5 }),
  );
  pedestal.position.y = 0.25;
  pedestal.castShadow = true;
  g.add(pedestal);

  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12),
    new THREE.MeshBasicMaterial({ color: accent }),
  );
  lens.position.y = 0.55;
  g.add(lens);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 1.3, 4.2, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.y = 2.6;
  g.add(beam);

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 3.22),
    new THREE.MeshBasicMaterial({
      map: routeHoloTexture(h, cssColor(accent)),
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  panel.position.y = 5.2;
  g.add(panel);

  return { ...h, group: g, beam, panel, base: new THREE.Vector3(h.x, 0, h.z), open: false, muted: false, t: 0 };
}

function makeBench(x, z, yaw) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a6b42, roughness: 0.9 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x30383f, roughness: 0.6, metalness: 0.4 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.7), wood);
  seat.position.y = 0.55;
  seat.castShadow = true;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.1), wood);
  back.position.set(0, 1, -0.3);
  back.rotation.x = -0.15;
  back.castShadow = true;
  g.add(back);
  for (const sx of [-0.9, 0.9]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.6), iron);
    leg.position.set(sx, 0.27, 0);
    g.add(leg);
  }
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  return g;
}

function makePin(x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.16, 0.5, 4, 10),
    new THREE.MeshStandardMaterial({ color: 0xf7f4ec, roughness: 0.5 }),
  );
  body.position.y = 0.45;
  body.castShadow = true;
  g.add(body);
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.165, 0.165, 0.1, 10),
    new THREE.MeshStandardMaterial({ color: 0xc93b3b, roughness: 0.5 }),
  );
  stripe.position.y = 0.62;
  g.add(stripe);
  g.position.set(x, 0, z);
  return g;
}

function makeGate(x, z, yaw, accent) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf5f7f4, roughness: 0.5, metalness: 0.2 });
  for (const sx of [-1.7, 1.7]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.6, 8), mat);
    post.position.set(sx, 1.3, 0);
    post.castShadow = true;
    g.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.5, 8), mat);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 2.55;
  g.add(bar);
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.5),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
  );
  banner.position.y = 2.1;
  g.add(banner);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  return g;
}

function makeCart() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.5, 2.6),
    new THREE.MeshStandardMaterial({ color: 0xf2f5f0, roughness: 0.4, metalness: 0.2 }),
  );
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);

  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.4, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x2f4858, roughness: 0.8 }),
  );
  seat.position.set(0, 1.05, 0.35);
  g.add(seat);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.08, 2.2),
    new THREE.MeshStandardMaterial({ color: 0xf2f5f0, roughness: 0.4 }),
  );
  roof.position.y = 2.1;
  roof.castShadow = true;
  g.add(roof);

  const postMat = new THREE.MeshStandardMaterial({ color: 0xb9c2c6, roughness: 0.4, metalness: 0.5 });
  for (const [px, pz] of [[-0.7, -0.95], [0.7, -0.95], [-0.7, 0.95], [0.7, 0.95]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.4, 6), postMat);
    post.position.set(px, 1.42, pz);
    g.add(post);
  }

  const shield = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 0.75),
    new THREE.MeshStandardMaterial({ color: 0xbfe0ea, transparent: true, opacity: 0.4, roughness: 0.1 }),
  );
  shield.position.set(0, 1.55, -1);
  shield.rotation.x = -0.16;
  g.add(shield);

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1d2126, roughness: 0.9 });
  const wheels = [];
  for (const [px, pz] of [[-0.72, -0.85], [0.72, -0.85], [-0.72, 0.85], [0.72, 0.85]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(px, 0.32, pz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }

  // little accent stripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.52, 0.1, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.5 }),
  );
  stripe.position.set(0, 0.62, -1.06);
  g.add(stripe);

  return { group: g, wheels };
}

/* ------------------------------------------------------------------ */

export function createScene(canvas, { flags, links, holos, gallery, calm, coarse }) {
  const holoBoost = coarse ? 1.3 : 1;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xd7e8f4, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd7e8f4, 85, 260);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 700);

  scene.add(new THREE.HemisphereLight(0xbfd8f0, 0x5b8a44, 0.95));
  const sun = new THREE.DirectionalLight(0xfff2df, 1.55);
  sun.position.set(52, 70, 38);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -95;
  sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95;
  sun.shadow.camera.bottom = -95;
  sun.shadow.camera.far = 230;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  scene.add(makeSky());
  scene.add(makeTerrain());
  const water = makeWater();
  scene.add(water);
  const pollen = makePollen();
  scene.add(pollen);

  /* physics registries */
  const statics = []; // {x, z, r}
  const dynamics = []; // {group, vel, r, spin, kind, factId?, woken}
  const events = []; // drained by World each frame

  const addStatic = (x, z, r) => statics.push({ x, z, r });

  /* trees — scattered on the rough, kept away from flags and holograms */
  const keepOut = [...flags, ...holos];
  for (let i = 0; i < 46; i++) {
    const ang = hash2(i, 1) * Math.PI * 2;
    const e = 0.55 + hash2(i, 2) * 0.34;
    const x = Math.cos(ang) * e * ISLAND.rx;
    const z = Math.sin(ang) * e * ISLAND.rz;
    if (keepOut.some((k) => Math.hypot(k.x - x, k.z - z) < 8)) continue;
    const tree = makeTree(i);
    tree.position.set(x, groundHeight(x, z), z);
    scene.add(tree);
    addStatic(x, z, 1.1 * tree.scale.x);
  }

  /* bunkers */
  for (const [bx, bz, br] of [[20, -12, 4], [-28, 10, 5], [9, 22, 3.2], [-14, 40, 4], [36, 34, 3.6]]) {
    const b = new THREE.Mesh(
      new THREE.CircleGeometry(br, 28),
      new THREE.MeshStandardMaterial({ color: 0xdcc493, roughness: 1 }),
    );
    b.rotation.x = -Math.PI / 2;
    b.position.set(bx, 0.03, bz);
    b.scale.y = 0.75;
    b.receiveShadow = true;
    scene.add(b);
  }

  /* the park — benches you can crash, a lamp, flower dots */
  const PARK = { x: 32, z: 44 };
  for (const [bx, bz, yaw] of [
    [PARK.x - 3, PARK.z, 0.5],
    [PARK.x + 3, PARK.z - 2, -0.7],
    [PARK.x, PARK.z + 3.4, 2.4],
  ]) {
    const b = makeBench(bx, bz, yaw);
    scene.add(b);
    dynamics.push({ group: b, vel: new THREE.Vector2(), r: 1.15, spin: 0, kind: 'bench', factId: 'home', woken: false });
  }

  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.1, 3.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x30383f, roughness: 0.6, metalness: 0.4 }),
  );
  lamp.position.set(PARK.x, 1.7, PARK.z - 4);
  lamp.castShadow = true;
  scene.add(lamp);
  const lampHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffe9a0, emissiveIntensity: 0.5 }),
  );
  lampHead.position.set(PARK.x, 3.5, PARK.z - 4);
  scene.add(lampHead);
  addStatic(PARK.x, PARK.z - 4, 0.35);

  for (let i = 0; i < 26; i++) {
    const fx = PARK.x + (hash2(i, 21) - 0.5) * 16;
    const fz = PARK.z + (hash2(i, 22) - 0.5) * 12;
    const f = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 6, 6),
      new THREE.MeshBasicMaterial({ color: [0xf472b6, 0xfbbf24, 0xffffff][i % 3] }),
    );
    f.position.set(fx, 0.1, fz);
    scene.add(f);
  }

  /* bowling pins — knock all six to unlock the toolbelt fact */
  const PINS = { x: 44, z: 40 };
  const pinRows = [[0, 0], [-0.5, 0.9], [0.5, 0.9], [-1, 1.8], [0, 1.8], [1, 1.8]];
  const pins = pinRows.map(([ox, oz]) => {
    const p = makePin(PINS.x + ox, PINS.z + oz);
    scene.add(p);
    const body = { group: p, vel: new THREE.Vector2(), r: 0.26, spin: 0, kind: 'pin', woken: false };
    dynamics.push(body);
    return body;
  });
  let pinsDone = false;

  /* gates — roll through to unlock a fact */
  const gates = [
    { x: 22, z: 44, yaw: 0.9, factId: 'devops', accent: 0x38bdf8 },
    { x: -36, z: 42, yaw: -0.6, factId: 'db', accent: 0xa78bfa },
    { x: 58, z: -8, yaw: 1.4, factId: 'langs', accent: 0xf472b6 },
  ].map((spec) => {
    const g = makeGate(spec.x, spec.z, spec.yaw, spec.accent);
    scene.add(g);
    // posts as colliders, offset by yaw
    const c = Math.cos(spec.yaw);
    const s = Math.sin(spec.yaw);
    addStatic(spec.x - 1.7 * c, spec.z + 1.7 * s, 0.3);
    addStatic(spec.x + 1.7 * c, spec.z - 1.7 * s, 0.3);
    return { ...spec, passed: false };
  });

  /* flags */
  const nodeObjs = flags.map((n) => makeFlagNode(n, gallery));
  nodeObjs.forEach((o) => {
    scene.add(o.group);
    addStatic(o.base.x, o.base.z, 0.32);
  });
  const byId = Object.fromEntries(nodeObjs.map((o) => [o.id, o]));
  const pickMeshes = nodeObjs.flatMap((o) => o.pickMeshes);

  /* route holograms */
  const holoObjs = holos.map((h) => {
    const obj = makeRouteHolo(h);
    scene.add(obj.group);
    addStatic(h.x, h.z, 0.75);
    return obj;
  });

  /* cart paths */
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
      mid.addScaledVector(perp, (hash2(i, 5) - 0.5) * dir.length() * 0.25);

      const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(60)),
        new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, dashSize: 0.55, gapSize: 0.45 }),
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

  /* the golf ball */
  const player = new THREE.Group();
  const bumpC = document.createElement('canvas');
  bumpC.width = bumpC.height = 256;
  const bg = bumpC.getContext('2d');
  bg.fillStyle = '#808080';
  bg.fillRect(0, 0, 256, 256);
  bg.fillStyle = '#5a5a5a';
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 12; col++) {
      bg.beginPath();
      bg.arc(col * 21 + (row % 2 === 0 ? 8 : 18), row * 21 + 8, 4.6, 0, Math.PI * 2);
      bg.fill();
    }
  }
  const bumpTex = new THREE.CanvasTexture(bumpC);
  bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping;

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 40, 28),
    new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.42, bumpMap: bumpTex, bumpScale: 0.35 }),
  );
  ball.position.y = 0.5;
  ball.castShadow = true;
  player.add(ball);
  scene.add(player);

  /* the golf cart */
  const cart = makeCart();
  cart.group.position.set(9, 0, 20);
  cart.group.rotation.y = 0.8;
  scene.add(cart.group);
  const cartState = { heading: 0.8, speed: 0 };

  const raycaster = new THREE.Raycaster();
  const up = new THREE.Vector3(0, 1, 0);
  const rollAxis = new THREE.Vector3();
  const rollQ = new THREE.Quaternion();

  /* ---------------- physics ---------------- */

  /** Push a moving circle (the vehicle) out of statics and kick dynamics. */
  function collide(pos, vel, r) {
    for (const c of statics) {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const min = r + c.r;
      if (d < min) {
        const nx = dx / d;
        const nz = dz / d;
        pos.x = c.x + nx * min;
        pos.z = c.z + nz * min;
        const vn = vel.x * nx + vel.z * nz;
        if (vn < 0) {
          vel.x -= 1.55 * vn * nx;
          vel.z -= 1.55 * vn * nz;
        }
      }
    }
    for (const b of dynamics) {
      const bp = b.group.position;
      const dx = pos.x - bp.x;
      const dz = pos.z - bp.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const min = r + b.r;
      if (d < min) {
        const nx = dx / d;
        const nz = dz / d;
        const vn = vel.x * nx + vel.z * nz;
        const impact = Math.max(0, -vn);
        pos.x = bp.x + nx * min;
        pos.z = bp.z + nz * min;
        // kick the body away, slow the vehicle a touch
        b.vel.x -= nx * (impact * 0.9 + 1.2);
        b.vel.y -= nz * (impact * 0.9 + 1.2);
        b.spin = (hash2(bp.x, bp.z) - 0.5) * impact * 2;
        vel.x *= 0.72;
        vel.z *= 0.72;
        if (!b.woken && impact > 1.6) {
          b.woken = true;
          if (b.kind === 'bench' && b.factId) events.push({ type: 'fact', id: b.factId });
          if (b.kind === 'pin') {
            const downed = pins.filter((p) => p.woken).length;
            if (downed >= pins.length && !pinsDone) {
              pinsDone = true;
              events.push({ type: 'fact', id: 'tools' });
            } else {
              events.push({ type: 'pins', downed, total: pins.length });
            }
          }
        }
      }
    }
  }

  function stepDynamics(dt) {
    for (const b of dynamics) {
      const sp = Math.hypot(b.vel.x, b.vel.y);
      if (sp < 0.01) continue;
      b.group.position.x += b.vel.x * dt;
      b.group.position.z += b.vel.y * dt;
      b.group.rotation.y += b.spin * dt;
      if (b.kind === 'pin' && sp > 2) b.group.rotation.z = Math.min(Math.PI / 2.2, b.group.rotation.z + sp * dt * 0.9);
      const damp = Math.exp(-2.6 * dt);
      b.vel.x *= damp;
      b.vel.y *= damp;
      b.spin *= damp;
      // keep bodies on the island
      const e = Math.hypot(b.group.position.x / ISLAND.rx, b.group.position.z / ISLAND.rz);
      if (e > 1) {
        b.group.position.x /= e;
        b.group.position.z /= e;
        b.vel.x *= -0.4;
        b.vel.y *= -0.4;
      }
    }
  }

  /* ---------------- per-frame ---------------- */

  function update(dt, clock, st) {
    pollen.material.uniforms.uTime.value = clock;
    water.material.uniforms.uTime.value = clock;

    // roll the ball when it's the vehicle
    if (st.mode === 'ball') {
      const speed = st.vel.length();
      if (speed > 0.02) {
        rollAxis.copy(up).cross(st.vel).normalize();
        rollQ.setFromAxisAngle(rollAxis, (speed * dt) / 0.5);
        ball.quaternion.premultiply(rollQ);
      }
    } else {
      cart.wheels.forEach((w) => (w.rotation.x += cartState.speed * dt * 2.6));
    }

    collide(st.pos, st.vel, st.mode === 'cart' ? 1.5 : 0.5);
    stepDynamics(dt);

    for (const o of nodeObjs) {
      const found = st.discovered.has(o.id);
      const hot = st.active === o.id || st.hover === o.id;

      if (!calm) {
        const p = o.flag.geometry.attributes.position;
        const base = o.flagBase;
        for (let i = 0; i < p.count; i++) {
          const x = base[i * 3];
          p.setZ(i, Math.sin(x * 3.2 - clock * 5 + o.phase) * 0.1 * (x / 2.2));
        }
        p.needsUpdate = true;
        o.flag.geometry.computeVertexNormals();
      }

      o.ring.material.opacity += ((found ? 0.55 : 0.15) - o.ring.material.opacity) * 0.1;
      if (!calm) o.ring.scale.setScalar(1 + Math.sin(clock * 1.8 + o.phase) * 0.04);

      const target = hot ? 1 : 0;
      o.holoT += (target - o.holoT) * (calm ? 1 : Math.min(1, dt * 7));
      const t = o.holoT;
      o.holo.visible = t > 0.02;
      if (o.holo.visible) {
        const ease = 1 - Math.pow(1 - t, 3);
        o.holo.scale.setScalar((0.05 + 0.95 * ease) * holoBoost);
        o.panel.material.opacity = 0.96 * ease;
        o.beam.material.opacity = 0.2 * ease;
        if (!calm) o.holo.position.y = 7.3 + Math.sin(clock * 1.6) * 0.07;
        const dx = camera.position.x - o.group.position.x;
        const dz = camera.position.z - o.group.position.z;
        o.holo.rotation.y = Math.atan2(dx, dz);
      }
    }

    /* route holograms: open on approach, stay until C, re-arm on leaving */
    for (const h of holoObjs) {
      const d = h.base.distanceTo(st.pos);
      if (d > HOLO_R + 3) h.muted = false;
      if (d < HOLO_R && !h.muted) h.open = true;
      h.t += ((h.open ? 1 : 0) - h.t) * (calm ? 1 : Math.min(1, dt * 5));
      const vis = h.t > 0.02;
      h.panel.visible = vis;
      h.beam.visible = vis;
      if (vis) {
        const ease = 1 - Math.pow(1 - h.t, 3);
        h.panel.material.opacity = 0.95 * ease;
        h.beam.material.opacity = 0.14 * ease;
        h.panel.scale.setScalar((0.1 + 0.9 * ease) * holoBoost);
        if (!calm) h.panel.position.y = 5.2 + Math.sin(clock * 1.3 + h.base.x) * 0.09;
        const dx = camera.position.x - h.base.x;
        const dz = camera.position.z - h.base.z;
        h.panel.rotation.y = Math.atan2(dx, dz);
        h.beam.rotation.y = h.panel.rotation.y;
      }
    }

    /* gates */
    for (const g of gates) {
      if (g.passed) continue;
      if (Math.hypot(g.x - st.pos.x, g.z - st.pos.z) < 2.1) {
        g.passed = true;
        events.push({ type: 'fact', id: g.factId });
      }
    }

    for (const l of linkObjs) {
      const lit = st.discovered.has(l.a) && st.discovered.has(l.b);
      l.line.material.opacity += ((lit ? 0.5 : 0.18) - l.line.material.opacity) * 0.08;
      if (lit && !calm) {
        const t = (clock * 0.1 + l.seed) % 1;
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
    cart,
    cartState,
    pickMeshes,
    raycaster,
    update,
    events,

    closeHolos() {
      for (const h of holoObjs) {
        if (h.open) {
          h.open = false;
          h.muted = true;
        }
      }
    },

    openHoloCount() {
      return holoObjs.filter((h) => h.open).length;
    },

    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
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
