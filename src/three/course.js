import * as THREE from 'three';

/**
 * A five-hole golf course on a small island. Plain three.js driven
 * imperatively; React owns the HUD and the rules of the round.
 *
 * World axes: X right, Z toward the viewer, Y up.
 */

export const ISLAND = { rx: 72, rz: 56 };
export const MAX_E = 1.3;
export const WATER_Y = -0.55;
export const BALL_R = 0.5;
export const CUP_R = 0.62;
const GREEN_R = 5.6;

/** Tee and cup positions. The content of each hole lives in data/cv.js. */
export const LAYOUT = [
  { par: 3, tee: [6, 38], cup: [-20, 22] },
  { par: 3, tee: [-28, 14], cup: [-45, -14] },
  { par: 3, tee: [-36, -27], cup: [-5, -36] },
  { par: 4, tee: [4, -38], cup: [42, -19] },
  { par: 4, tee: [47, -8], cup: [24, 27] },
];

/** The water hazard guarding hole four. */
const POND = { x: 23, z: -27, r: 6.5 };

const BUNKERS = [
  [-16, 27, 2.6, 1.6],
  [-48, -6, 2.8, 1.8],
  [-1, -31, 3, 1.7],
  [46, -24, 2.6, 1.6],
  [30, 21, 3.2, 1.8],
  [38, 6, 2.4, 1.5],
];

/* ------------------------------------------------------------------ */
/* math                                                                */
/* ------------------------------------------------------------------ */

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

/** Distance from p to segment ab, and how far along it (0..1). */
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return { d: Math.hypot(px - (ax + dx * t), pz - (az + dz * t)), t, len: Math.sqrt(len2) };
}

const ellipseNorm = (x, z) => Math.hypot(x / (ISLAND.rx + 8), z / (ISLAND.rz + 8));

/** 0 on a green or tee box, 1 out in the open: keeps putting surfaces flat. */
function flatness(x, z) {
  let f = 1;
  for (const h of LAYOUT) {
    f = Math.min(f, smoothstep(GREEN_R - 1, GREEN_R + 4, Math.hypot(x - h.cup[0], z - h.cup[1])));
    f = Math.min(f, smoothstep(3, 7, Math.hypot(x - h.tee[0], z - h.tee[1])));
  }
  return f;
}

export const groundHeight = (x, z) => {
  const e = ellipseNorm(x, z);
  const lip = smoothstep(0.72, 0.95, e) * (noise2(x * 0.05, z * 0.05) * 2.2 + 0.4);
  const drop = smoothstep(1.0, 1.22, e) * -6.5;
  // rolling fairways; greens and tees keep a gentle tilt so putts still break
  const roll =
    (noise2(x * 0.04 + 3.1, z * 0.04 + 7.3) - 0.25) * 1.5 * (1 - smoothstep(0.62, 0.9, e)) * (0.25 + 0.75 * flatness(x, z));
  const pd = Math.hypot(x - POND.x, z - POND.z) / POND.r;
  const pond = -2.6 * (1 - smoothstep(0.5, 1.2, pd));
  return lip + drop + roll + pond;
};

/** How far below the sea surface the ground is at (x, z). Positive means wet. */
export const waterDepth = (x, z) => WATER_Y - groundHeight(x, z);

function inBunker(x, z) {
  for (const [bx, bz, rx, rz] of BUNKERS) {
    if (Math.hypot((x - bx) / rx, (z - bz) / rz) < 1) return true;
  }
  return false;
}

function fairwayDist(x, z) {
  let best = Infinity;
  for (const h of LAYOUT) best = Math.min(best, segDist(x, z, h.tee[0], h.tee[1], h.cup[0], h.cup[1]).d);
  return best;
}

/** Rolling resistance by surface: constant deceleration + speed-proportional drag. */
function surfaceAt(x, z) {
  if (inBunker(x, z)) return { name: 'bunker', roll: 22, lin: 2.6 };
  for (const h of LAYOUT) {
    if (Math.hypot(x - h.cup[0], z - h.cup[1]) < GREEN_R) return { name: 'green', roll: 2.3, lin: 0.32 };
  }
  if (fairwayDist(x, z) < 5) return { name: 'fairway', roll: 3.4, lin: 0.4 };
  return { name: 'rough', roll: 6.5, lin: 0.9 };
}

/* ------------------------------------------------------------------ */
/* textures                                                            */
/* ------------------------------------------------------------------ */

function detailTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#a6a6a2';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2100; i++) {
    const x = hash2(i, 1) * 256;
    const y = hash2(i, 2) * 256;
    const lum = 128 + Math.floor((hash2(i, 3) - 0.5) * 70);
    g.strokeStyle = `rgb(${lum - 6},${lum},${lum - 10})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (hash2(i, 4) - 0.5) * 2.4, y - 2 - hash2(i, 5) * 3.4);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(70, 70);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function sandTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e6d3a8';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) {
    g.fillStyle = hash2(i, 1) > 0.5 ? '#d8c290' : '#f1e4c2';
    g.fillRect(hash2(i, 2) * 128, hash2(i, 3) * 128, 1.3, 1.3);
  }
  g.strokeStyle = 'rgba(160, 132, 84, 0.3)';
  g.lineWidth = 1.4;
  for (let i = 0; i < 7; i++) {
    g.beginPath();
    g.arc(64, 64, 12 + i * 9, hash2(i, 4) * 2, hash2(i, 4) * 2 + 2.4);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.6, 1.6);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function flagTexture(n, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 0, 18, 160);
  g.fillStyle = '#ffffff';
  g.font = '700 112px "PT Sans", Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(String(n), 132, 120);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ------------------------------------------------------------------ */
/* environment                                                         */
/* ------------------------------------------------------------------ */

function makeSky(theme) {
  const geo = new THREE.SphereGeometry(420, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new THREE.Color(theme.zenith) },
      uHorizon: { value: new THREE.Color(theme.horizon) },
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
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.7));
        float halo = pow(max(dot(vDir, uSunDir), 0.0), 10.0);
        col += vec3(1.0, 0.95, 0.86) * halo * 0.12;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

function makeTerrain(detail) {
  const SIZE = 300;
  const SEG = 230;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const fairA = new THREE.Color(0x98c86f);
  const fairB = new THREE.Color(0x8cc066);
  const rough = new THREE.Color(0x77a954);
  const sand = new THREE.Color(0xe2cd9c);
  const seabed = new THREE.Color(0x4f8a78);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = groundHeight(x, z);
    pos.setY(i, y);

    // mown fairway stripes run down each hole, everything else is rough
    let best = { d: Infinity, t: 0, len: 1 };
    for (const h of LAYOUT) {
      const s = segDist(x, z, h.tee[0], h.tee[1], h.cup[0], h.cup[1]);
      if (s.d < best.d) best = s;
    }
    const stripe = Math.floor((best.t * best.len) / 3.2) % 2 === 0 ? fairA : fairB;
    tmp.copy(rough).lerp(stripe, smoothstep(6.2, 4.6, best.d));

    const e = ellipseNorm(x, z);
    tmp.lerp(rough, smoothstep(0.86, 0.93, e));
    tmp.lerp(sand, smoothstep(0.95, 1.04, e));
    tmp.lerp(sand, smoothstep(-0.1, -0.5, y) * (Math.hypot(x - POND.x, z - POND.z) < POND.r * 1.4 ? 1 : 0));
    tmp.lerp(seabed, smoothstep(-0.8, -2.2, y));
    const mottle = 0.95 + noise2(x * 0.6, z * 0.6) * 0.1;
    colors[i * 3] = tmp.r * mottle;
    colors[i * 3 + 1] = tmp.g * mottle;
    colors[i * 3 + 2] = tmp.b * mottle;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, bumpMap: detail, bumpScale: 0.3, roughness: 0.95 }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

/** A flat patch that hugs the terrain (greens, tee boxes, bunkers). */
function makeDecal(geo, material, lift) {
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.userData.lift = lift;
  return mesh;
}

function drapeOnGround(mesh) {
  mesh.updateMatrixWorld();
  const p = mesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
    p.setY(i, groundHeight(v.x, v.z) - mesh.position.y + mesh.userData.lift);
  }
  p.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

function makeWater(theme) {
  const geo = new THREE.PlaneGeometry(900, 900, 1, 1);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(theme.deep) },
      uShallow: { value: new THREE.Color(theme.shallow) },
      uFar: { value: new THREE.Color(theme.horizon) },
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
      uniform vec3 uFar;
      void main() {
        float w1 = sin(vPos.x * 0.14 + uTime * 0.9) * sin(vPos.y * 0.11 - uTime * 0.7);
        float w2 = sin((vPos.x + vPos.y) * 0.05 + uTime * 0.5);
        float w = w1 * 0.5 + w2 * 0.5;
        vec3 col = mix(uDeep, uShallow, 0.55 + 0.35 * w);
        col += smoothstep(0.9, 1.0, w1) * 0.25;
        // the open sea dissolves into the page colour
        float far = smoothstep(110.0, 240.0, length(vPos));
        gl_FragColor = vec4(mix(col, uFar, far), 0.92);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = WATER_Y;
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
    color: new THREE.Color(0x3f7434).offsetHSL(0, 0, (hash2(seed, 7) - 0.5) * 0.08),
    roughness: 1,
    flatShading: true,
  });
  for (let k = 0; k < 3; k++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95 - k * 0.18, 1), leaf);
    blob.position.set((hash2(seed, k) - 0.5) * 0.8, 1.7 + k * 0.62, (hash2(seed, k + 3) - 0.5) * 0.8);
    blob.castShadow = true;
    g.add(blob);
  }
  g.scale.setScalar(0.9 + hash2(seed, 11) * 0.8);
  return g;
}

function makeGolfer(seed) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const shirt = mat([0xf1efe9, 0x2f5d8a, 0x0b2a33, 0xb65a23][seed % 4]);
  const pants = mat(0x2b3a42);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), pants);
  legL.position.set(-0.11, 0.28, 0);
  const legR = legL.clone();
  legR.position.x = 0.11;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.6, 0.26), shirt);
  torso.position.y = 0.86;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.11), shirt);
  armL.position.set(-0.29, 0.9, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mat(0xc98f5e));
  head.position.y = 1.34;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.09, 12), mat(0xf5f5f0));
  cap.position.y = 1.47;
  for (const part of [legL, legR, torso, armL, head, cap]) {
    part.castShadow = true;
    g.add(part);
  }
  const swing = new THREE.Group();
  swing.position.set(0.29, 1.12, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.11), shirt);
  armR.position.set(0, -0.22, 0);
  swing.add(armR);
  const club = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1.15, 6),
    new THREE.MeshStandardMaterial({ color: 0xb9c2c6, roughness: 0.35, metalness: 0.6 }),
  );
  club.position.set(0, -0.9, 0.1);
  club.rotation.x = 0.22;
  swing.add(club);
  swing.rotation.x = -0.45;
  g.add(swing);
  return { group: g, swing };
}

/** A golf bag with clubs poking out. Clubs fly loose when it is knocked over. */
function makeGolfBag(seed) {
  const g = new THREE.Group();
  const color = [0xb23a2f, 0x2f5d8a, 0x30383f, 0x946037, 0x0b5e5c][seed % 5];
  const tilt = new THREE.Group(); // topples around its base
  g.add(tilt);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.31, 1.05, 14),
    new THREE.MeshStandardMaterial({ color, roughness: 0.75 }),
  );
  body.position.y = 0.55;
  body.castShadow = true;
  tilt.add(body);
  const trim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.29, 0.08, 14),
    new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.6 }),
  );
  trim.position.y = 1.02;
  tilt.add(trim);
  const pocket = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.34, 0.12),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, -0.08), roughness: 0.85 }),
  );
  pocket.position.set(0, 0.45, 0.3);
  tilt.add(pocket);

  const clubs = [];
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0xc4ccd0, roughness: 0.3, metalness: 0.65 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x2c333a, roughness: 0.4, metalness: 0.5 });
  for (let i = 0; i < 3; i++) {
    const club = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), shaftMat);
    shaft.position.y = 0.5;
    club.add(shaft);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.16), headMat);
    head.position.set(0, 1.02, 0.05);
    club.add(head);
    club.position.set((hash2(seed, i) - 0.5) * 0.22, 0.62, (hash2(seed, i + 4) - 0.5) * 0.2);
    club.rotation.z = (hash2(seed, i + 8) - 0.5) * 0.35;
    club.rotation.x = (hash2(seed, i + 12) - 0.5) * 0.3;
    tilt.add(club);
    clubs.push(club);
  }
  return { group: g, tilt, clubs };
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
  g.position.set(x, groundHeight(x, z), z);
  g.rotation.y = yaw;
  return g;
}

/** A two-seat golf cart. `body` tilts with the ground, the group yaws. */
function makeCart() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const mat = (color, roughness = 0.5, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const white = mat(0xf4f2ec, 0.4);
  const add = (geo, m, x, y, z, shadow = true) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    body.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(1.5, 0.45, 2.6), white, 0, 0.64, 0);
  add(new THREE.BoxGeometry(1.53, 0.12, 2.63), mat(0x007876), 0, 0.5, 0, false);
  add(new THREE.BoxGeometry(1.3, 0.36, 0.78), mat(0x0b2a33, 0.8), 0, 1.04, -0.35);
  add(new THREE.BoxGeometry(1.3, 0.62, 0.14), mat(0x0b2a33, 0.8), 0, 1.42, -0.74);
  add(new THREE.BoxGeometry(1.62, 0.08, 2.3), white, 0, 2.2, -0.08);
  const postMat = mat(0xb9c2c6, 0.35, { metalness: 0.5 });
  for (const [px, pz] of [[-0.72, -0.98], [0.72, -0.98], [-0.72, 0.9], [0.72, 0.9]]) {
    add(new THREE.CylinderGeometry(0.045, 0.045, 1.4, 6), postMat, px, 1.48, pz, false);
  }
  const shield = add(
    new THREE.PlaneGeometry(1.36, 0.72),
    mat(0xcfe6ec, 0.1, { transparent: true, opacity: 0.38, side: THREE.DoubleSide }),
    0,
    1.66,
    0.94,
    false,
  );
  shield.rotation.x = 0.16;
  add(
    new THREE.BoxGeometry(0.5, 0.12, 0.06),
    mat(0xf5b93b, 0.4, { emissive: 0xf5b93b, emissiveIntensity: 0.3 }),
    0,
    0.72,
    1.31,
    false,
  );
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16).rotateZ(Math.PI / 2);
  const wheelMat = mat(0x1d2328, 0.9);
  const wheels = [];
  for (const [px, pz] of [[-0.74, -0.86], [0.74, -0.86], [-0.74, 0.86], [0.74, 0.86]]) {
    wheels.push(add(wheelGeo, wheelMat, px, 0.32, pz));
  }
  return { group: g, body, wheels };
}

/** Draw a hole's image and caption onto a board face; the image streams in. */
function boardTexture(board, n, accent) {
  const W = 1024;
  const H = 700;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const IMG_H = 560;
  const draw = (img) => {
    g.fillStyle = '#f4efe6';
    g.fillRect(0, 0, W, H);
    if (img) {
      // cover the top area, anchored to the top of the image (headers matter)
      const scale = Math.max(W / img.width, IMG_H / img.height);
      const dw = img.width * scale;
      g.drawImage(img, (W - dw) / 2, 0, dw, img.height * scale);
    } else {
      g.fillStyle = '#e4dccd';
      g.fillRect(0, 0, W, IMG_H);
    }
    g.fillStyle = '#0b2a33';
    g.fillRect(0, IMG_H, W, H - IMG_H);
    g.fillStyle = accent;
    g.fillRect(0, IMG_H, 14, H - IMG_H);
    g.fillStyle = '#9fb7ba';
    g.font = '700 30px "Plus Jakarta Sans", Arial, sans-serif';
    g.fillText(`HOLE ${n}  ·  ${board.title.toUpperCase()}`, 48, IMG_H + 52);
    g.fillStyle = '#f4efe6';
    g.font = '700 46px "PT Sans", Arial, sans-serif';
    g.fillText(board.caption, 48, IMG_H + 108);
  };
  draw(null);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (board.image) {
    const img = new Image();
    img.onload = () => {
      draw(img);
      t.needsUpdate = true;
    };
    img.src = board.image;
  }
  return t;
}

/** A framed display on two posts, the way courses show a hole's layout. */
function makeBoard(board, n, accent) {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a2a30, roughness: 0.55, metalness: 0.2 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 0.9 });
  const BW = 6.4;
  const BH = 4.375;
  for (const sx of [-BW / 2 + 0.35, BW / 2 - 0.35]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6, 0.22), postMat);
    post.position.set(sx, 1.3, -0.12);
    post.castShadow = true;
    g.add(post);
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.3, BH + 0.3, 0.2), frameMat);
  frame.position.set(0, 1.9 + BH / 2, -0.12);
  frame.castShadow = true;
  g.add(frame);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(BW, BH),
    new THREE.MeshStandardMaterial({ map: boardTexture(board, n, accent), roughness: 0.7 }),
  );
  face.position.set(0, 1.9 + BH / 2, 0);
  g.add(face);
  // the same picture on the back, so it reads from either side
  const back = new THREE.Mesh(face.geometry, face.material);
  back.position.set(0, 1.9 + BH / 2, -0.24);
  back.rotation.y = Math.PI;
  g.add(back);
  return g;
}

function makeBall() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#5a5a5a';
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 12; col++) {
      g.beginPath();
      g.arc(col * 21 + (row % 2 === 0 ? 8 : 18), row * 21 + 8, 4.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  const bump = new THREE.CanvasTexture(c);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 40, 28),
    new THREE.MeshStandardMaterial({ color: 0xfbfbf8, roughness: 0.4, bumpMap: bump, bumpScale: 0.3 }),
  );
  mesh.castShadow = true;
  return mesh;
}

/* ------------------------------------------------------------------ */

export function createCourse(canvas, { theme, calm, onEvent, boards = [] }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(theme.horizon, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(theme.horizon, 120, 300);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 700);

  scene.add(new THREE.HemisphereLight(0xe8f0f4, 0x7d9a5c, 1.15));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.45);
  sun.position.set(52, 70, 38);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, far: 230 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  scene.add(makeSky(theme));
  scene.add(makeTerrain(detailTexture()));
  const water = makeWater(theme);
  scene.add(water);

  /* ---------- greens, tees, cups, flags ---------- */
  const greenMat = new THREE.MeshStandardMaterial({ color: 0xa9d880, roughness: 0.85 });
  const teeMat = new THREE.MeshStandardMaterial({ color: 0xa2d278, roughness: 0.9 });
  const holes = LAYOUT.map((h, i) => {
    const [cx, cz] = h.cup;
    // a ring with a pinhole: unlike CircleGeometry it has inner rings to drape
    const green = makeDecal(new THREE.RingGeometry(0.001, GREEN_R, 48, 10), greenMat, 0.03);
    green.position.set(cx, 0, cz);
    scene.add(green);
    drapeOnGround(green);

    const [tx, tz] = h.tee;
    const tee = makeDecal(new THREE.PlaneGeometry(4.4, 3.2, 8, 6), teeMat, 0.035);
    tee.position.set(tx, 0, tz);
    tee.rotation.y = Math.atan2(cx - tx, cz - tz);
    scene.add(tee);
    drapeOnGround(tee);

    const gy = groundHeight(cx, cz);
    const cup = new THREE.Mesh(new THREE.CircleGeometry(CUP_R * 0.8, 28), new THREE.MeshBasicMaterial({ color: 0x0d1410 }));
    cup.rotation.x = -Math.PI / 2;
    cup.position.set(cx, gy + 0.06, cz);
    scene.add(cup);
    const rim = new THREE.Mesh(new THREE.RingGeometry(CUP_R * 0.8, CUP_R, 28), new THREE.MeshBasicMaterial({ color: 0xf4f2ec }));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(cx, gy + 0.065, cz);
    scene.add(rim);

    const flagGroup = new THREE.Group();
    flagGroup.position.set(cx, gy, cz);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 4.6, 8),
      new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.4, metalness: 0.2 }),
    );
    pole.position.y = 2.3;
    pole.castShadow = true;
    flagGroup.add(pole);
    const flagGeo = new THREE.PlaneGeometry(1.9, 1.2, 12, 4);
    flagGeo.translate(0.95, 0, 0);
    const flag = new THREE.Mesh(
      flagGeo,
      new THREE.MeshStandardMaterial({ map: flagTexture(i + 1, theme.flag), side: THREE.DoubleSide, roughness: 0.85 }),
    );
    flag.position.y = 3.95;
    flag.castShadow = true;
    flagGroup.add(flag);
    scene.add(flagGroup);

    // tee markers
    const markMat = new THREE.MeshStandardMaterial({ color: theme.flag, roughness: 0.5 });
    const yaw = tee.rotation.y;
    for (const side of [-1, 1]) {
      const mx = tx + Math.cos(yaw) * 1.7 * side;
      const mz = tz - Math.sin(yaw) * 1.7 * side;
      const mark = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), markMat);
      mark.position.set(mx, groundHeight(mx, mz) + 0.18, mz);
      mark.castShadow = true;
      scene.add(mark);
    }

    return {
      ...h,
      flagGroup,
      flag,
      flagBase: Float32Array.from(flagGeo.attributes.position.array),
      phase: i * 1.3,
    };
  });

  /* ---------- bunkers ---------- */
  const sandMat = new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 });
  for (const [bx, bz, rx, rz] of BUNKERS) {
    const b = makeDecal(new THREE.RingGeometry(0.001, 1, 36, 6), sandMat, 0.045);
    b.position.set(bx, 0, bz);
    b.scale.set(rx, 1, rz);
    scene.add(b);
    drapeOnGround(b);
  }

  /* ---------- statics: trees, benches, golfers ---------- */
  const statics = [];
  const addStatic = (x, z, r) => statics.push({ x, z, r });

  for (let i = 0; i < 90; i++) {
    const ang = hash2(i, 1) * Math.PI * 2;
    const e = 0.45 + hash2(i, 2) * 0.42;
    const x = Math.cos(ang) * e * ISLAND.rx;
    const z = Math.sin(ang) * e * ISLAND.rz;
    if (fairwayDist(x, z) < 8.5) continue;
    if (LAYOUT.some((h) => Math.hypot(h.cup[0] - x, h.cup[1] - z) < 10 || Math.hypot(h.tee[0] - x, h.tee[1] - z) < 7)) continue;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 3 || inBunker(x, z)) continue;
    const tree = makeTree(i);
    tree.position.set(x, groundHeight(x, z), z);
    scene.add(tree);
    addStatic(x, z, 0.9 * tree.scale.x);
  }

  for (const [bx, bz, yaw] of [
    [15, 31, -1.1],
    [-33, 18, 0.9],
    [52, -11, 1.2],
  ]) {
    scene.add(makeBench(bx, bz, yaw));
    addStatic(bx, bz, 1.1);
  }

  // a display board beside each green, turned to face the tee
  LAYOUT.forEach((h, i) => {
    const board = boards[i];
    if (!board) return;
    const [cx, cz] = h.cup;
    const dx = cx - h.tee[0];
    const dz = cz - h.tee[1];
    const len = Math.hypot(dx, dz);
    // beside the green, on the side away from the island centre
    let px = -dz / len;
    let pz = dx / len;
    if (px * cx + pz * cz < 0) {
      px = -px;
      pz = -pz;
    }
    const bx = cx + px * (GREEN_R + 3.2) - (dx / len) * 1.5;
    const bz = cz + pz * (GREEN_R + 3.2) - (dz / len) * 1.5;
    const b = makeBoard(board, i + 1, theme.flag);
    b.position.set(bx, groundHeight(bx, bz), bz);
    b.rotation.y = Math.atan2(h.tee[0] - bx, h.tee[1] - bz);
    scene.add(b);
    const rx = Math.cos(b.rotation.y);
    const rz = -Math.sin(b.rotation.y);
    for (const k of [-1, 0, 1]) addStatic(bx + rx * 2.6 * k, bz + rz * 2.6 * k, 0.45);
  });

  const golfers = [
    [10, 36, 1.7],
    [-31, -30, 0.9],
    [50, -5, -1.4],
  ].map(([gx, gz, yaw], i) => {
    const gf = makeGolfer(i);
    gf.group.position.set(gx, groundHeight(gx, gz), gz);
    gf.group.rotation.y = yaw;
    scene.add(gf.group);
    addStatic(gx, gz, 0.45);
    return { ...gf, t: hash2(i, 3) * 10 };
  });

  /* ---------- golf bags: the things you can knock over ---------- */
  const bags = [];
  const debris = [];
  for (const [bx, bz] of [
    [9, 33.6],
    [-13, 25.5],
    [-36, 2],
    [-24, -32],
    [13, -33],
    [33, -12],
    [44, 4],
    [36, 15],
  ].concat(LAYOUT.map((h) => [h.tee[0] - 2.6, h.tee[1] + 1.4]))) {
    const b = makeGolfBag(bags.length);
    b.group.position.set(bx, groundHeight(bx, bz), bz);
    b.group.rotation.y = hash2(bx, bz) * Math.PI * 2;
    scene.add(b.group);
    bags.push({ ...b, x: bx, z: bz, vx: 0, vz: 0, r: 0.42, fall: 0, fallDir: 0, down: false, spin: 0 });
  }

  function ejectClubs(bag, dirX, dirZ) {
    for (const club of bag.clubs.splice(0, 3)) {
      club.updateWorldMatrix(true, false);
      const wp = new THREE.Vector3().setFromMatrixPosition(club.matrixWorld);
      const wq = new THREE.Quaternion().setFromRotationMatrix(club.matrixWorld);
      club.removeFromParent();
      club.position.copy(wp);
      club.quaternion.copy(wq);
      scene.add(club);
      const spread = (Math.random() - 0.5) * 1.6;
      const ang = Math.atan2(dirZ, dirX) + spread;
      const power = 2.5 + Math.random() * 4;
      debris.push({
        mesh: club,
        vel: new THREE.Vector3(Math.cos(ang) * power, 3 + Math.random() * 4, Math.sin(ang) * power),
        ang: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12),
        resting: false,
        life: 0,
      });
    }
  }

  /* ---------- the ball ---------- */
  const ballMesh = makeBall();
  scene.add(ballMesh);
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  scene.add(shadowDisc);

  const ball = {
    x: 0,
    z: 0,
    air: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    state: 'rest', // roam | parked | rest | moving | holed | water
    wasRoam: false,
    lastDryX: 0,
    lastDryZ: 0,
    inX: 0, // roam input: desired direction * strength, world space
    shot: false, // the current roam motion came from a swing, not from rolling
    cupHole: 0,
    inZ: 0,
    restX: 0,
    restZ: 0,
    timer: 0,
    hole: 0,
    still: 0,
  };
  const rollAxis = new THREE.Vector3();
  const rollQ = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  /* ---------- aim guide: dots along the shot line ---------- */
  const DOTS = 26;
  const dotMesh = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.16, 12).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }),
    DOTS,
  );
  dotMesh.count = 0;
  scene.add(dotMesh);
  const dotM = new THREE.Matrix4();

  function drawAim(yaw, power, visible) {
    if (!visible || (ball.state !== 'rest' && !(ball.state === 'roam' && ball.air <= 0))) {
      dotMesh.count = 0;
      return;
    }
    const reach = 3 + power * 26;
    const n = Math.max(4, Math.round((reach / 29) * DOTS));
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    for (let i = 0; i < n; i++) {
      const d = 1.1 + (i / DOTS) * 29;
      const x = ball.x + dx * d;
      const z = ball.z + dz * d;
      const s = 1 - (i / n) * 0.55;
      dotM.makeScale(s, 1, s).setPosition(x, Math.max(groundHeight(x, z), WATER_Y) + 0.08, z);
      dotMesh.setMatrixAt(i, dotM);
    }
    dotMesh.count = n;
    dotMesh.instanceMatrix.needsUpdate = true;
  }

  /* ---------- particles: splashes and turf puffs ---------- */
  const bursts = [];
  function burst(x, y, z, { count, color, size, up: upV, out }) {
    const pos = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      pos.set([x, y, z], i * 3);
      const a = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * out;
      vels.push(new THREE.Vector3(Math.cos(a) * r, upV * (0.5 + Math.random()), Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, depthWrite: false }));
    scene.add(pts);
    bursts.push({ pts, vels, life: 0 });
  }
  const splash = (x, z) => burst(x, WATER_Y + 0.1, z, { count: 70, color: 0xe6f6fa, size: 0.22, up: 6.5, out: 3.5 });
  const puff = (x, z, color = 0xa9c98c) => burst(x, groundHeight(x, z) + 0.15, z, { count: 18, color, size: 0.14, up: 2.6, out: 1.8 });

  /* ---------- physics ---------- */
  const G = 26;
  const SLOPE = 11;

  function placeBall(x, z) {
    Object.assign(ball, { x, z, air: 0, vx: 0, vz: 0, vy: 0, state: 'rest', restX: x, restZ: z, still: 0 });
    if (waterDepth(x, z) < -0.6) Object.assign(ball, { lastDryX: x, lastDryZ: z });
  }

  function teeUp(i) {
    ball.hole = i;
    const [tx, tz] = LAYOUT[i].tee;
    placeBall(tx, tz);
  }

  function launch(yaw, power) {
    const p = Math.max(0, Math.min(1, power));
    const speed = 4 + 40 * Math.pow(p, 1.3);
    ball.vx = Math.sin(yaw) * speed;
    ball.vz = Math.cos(yaw) * speed;
    ball.vy = p > 0.38 ? (p - 0.38) * 22 : 0;
    ball.air = ball.vy > 0 ? 0.02 : 0;
  }

  /** A free shot while exploring: no strokes, but it can find a cup. */
  function roamShot(yaw, power) {
    if (ball.state !== 'roam' || ball.air > 0) return false;
    launch(yaw, power);
    ball.shot = true;
    return true;
  }

  function shoot(yaw, power) {
    if (ball.state !== 'rest') return false;
    launch(yaw, power);
    ball.restX = ball.x;
    ball.restZ = ball.z;
    ball.state = 'moving';
    ball.still = 0;
    return true;
  }

  function hitBag(bag, nx, nz, impact) {
    // nx/nz point from the ball to the bag
    bag.vx += nx * (impact * 0.55 + 0.6);
    bag.vz += nz * (impact * 0.55 + 0.6);
    bag.spin += (Math.random() - 0.5) * impact * 0.8;
    if (!bag.down && impact > 3.2) {
      bag.down = true;
      bag.fallDir = Math.atan2(nx, nz);
      ejectClubs(bag, nx, nz);
      puff(bag.x, bag.z, 0xd8d2c0);
      onEvent?.({ type: 'bag', down: bags.filter((b) => b.down).length, total: bags.length });
    }
  }

  function collideBall() {
    for (const c of statics) {
      const dx = ball.x - c.x;
      const dz = ball.z - c.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const min = BALL_R + c.r;
      if (d < min) {
        const nx = dx / d;
        const nz = dz / d;
        ball.x = c.x + nx * min;
        ball.z = c.z + nz * min;
        const vn = ball.vx * nx + ball.vz * nz;
        if (vn < 0) {
          ball.vx -= 1.6 * vn * nx;
          ball.vz -= 1.6 * vn * nz;
        }
      }
    }
    for (const b of bags) {
      const dx = ball.x - b.x;
      const dz = ball.z - b.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const min = BALL_R + b.r;
      if (d < min) {
        const nx = dx / d;
        const nz = dz / d;
        const vn = ball.vx * nx + ball.vz * nz;
        ball.x = b.x + nx * min;
        ball.z = b.z + nz * min;
        if (vn < 0) {
          // a bag is heavier than a ball: the ball bounces, the bag shoves
          ball.vx -= 1.45 * vn * nx;
          ball.vz -= 1.45 * vn * nz;
          ball.vx *= 0.8;
          ball.vz *= 0.8;
          hitBag(b, -nx, -nz, -vn);
        }
      }
    }
  }

  function stepBags(dt) {
    for (const b of bags) {
      // bag vs bag and bag vs statics: simple positional pushes
      for (const o of bags) {
        if (o === b) continue;
        const dx = b.x - o.x;
        const dz = b.z - o.z;
        const d = Math.hypot(dx, dz) || 0.001;
        const min = b.r + o.r;
        if (d < min) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          b.x += nx * push;
          b.z += nz * push;
          o.x -= nx * push;
          o.z -= nz * push;
          const rel = (b.vx - o.vx) * nx + (b.vz - o.vz) * nz;
          if (rel < 0) {
            b.vx -= rel * nx * 0.9;
            b.vz -= rel * nz * 0.9;
            o.vx += rel * nx * 0.9;
            o.vz += rel * nz * 0.9;
            if (-rel > 2.2) hitBag(o, -nx, -nz, -rel * 1.4);
          }
        }
      }
      for (const c of statics) {
        const dx = b.x - c.x;
        const dz = b.z - c.z;
        const d = Math.hypot(dx, dz) || 0.001;
        const min = b.r + c.r;
        if (d < min) {
          const nx = dx / d;
          const nz = dz / d;
          b.x = c.x + nx * min;
          b.z = c.z + nz * min;
          const vn = b.vx * nx + b.vz * nz;
          if (vn < 0) {
            b.vx -= 1.4 * vn * nx;
            b.vz -= 1.4 * vn * nz;
          }
        }
      }

      const damp = Math.exp(-(b.down ? 3.4 : 2.6) * dt);
      b.vx *= damp;
      b.vz *= damp;
      b.spin *= damp;
      const nx = b.x + b.vx * dt;
      const nz = b.z + b.vz * dt;
      if (waterDepth(nx, nz) < -0.1) {
        b.x = nx;
        b.z = nz;
      } else {
        b.vx *= -0.3;
        b.vz *= -0.3;
      }
      if (b.down && b.fall < 1) b.fall = Math.min(1, b.fall + dt * 3.2);
      b.group.position.set(b.x, groundHeight(b.x, b.z), b.z);
      b.group.rotation.y += b.spin * dt;
      // topple in the direction it was hit, relative to its own spin
      const rel = b.fallDir - b.group.rotation.y;
      const ease = 1 - Math.pow(1 - b.fall, 3);
      b.tilt.rotation.set(Math.cos(rel) * ease * 1.42, 0, -Math.sin(rel) * ease * 1.42);
      b.tilt.position.y = ease * 0.28;
    }

    for (const f of debris) {
      if (f.resting) continue;
      f.life += dt;
      f.vel.y -= 22 * dt;
      f.mesh.position.addScaledVector(f.vel, dt);
      const gy = Math.max(groundHeight(f.mesh.position.x, f.mesh.position.z), WATER_Y - 0.4) + 0.05;
      if (f.mesh.position.y < gy) {
        f.mesh.position.y = gy;
        f.vel.y *= -0.3;
        f.vel.x *= 0.62;
        f.vel.z *= 0.62;
        f.ang.multiplyScalar(0.6);
      }
      f.mesh.rotation.x += f.ang.x * dt;
      f.mesh.rotation.y += f.ang.y * dt;
      f.mesh.rotation.z += f.ang.z * dt;
      if (f.life > 1.2 && f.vel.lengthSq() < 0.1) {
        f.mesh.rotation.set(Math.PI / 2, f.mesh.rotation.y, 0);
        f.resting = true;
      }
    }
  }

  /* ---------- the golf cart ---------- */
  const CART_R = 1.45;
  const cartModel = makeCart();
  scene.add(cartModel.group);
  const cart = { x: 13.5, z: 41.5, heading: -2.2, speed: 0, occupied: false, ix: 0, iz: 0 };

  function poseCart() {
    const fx = Math.sin(cart.heading);
    const fz = Math.cos(cart.heading);
    const rx = Math.cos(cart.heading);
    const rz = -Math.sin(cart.heading);
    const hF = groundHeight(cart.x + fx * 1.1, cart.z + fz * 1.1);
    const hB = groundHeight(cart.x - fx * 1.1, cart.z - fz * 1.1);
    const hR = groundHeight(cart.x + rx * 0.75, cart.z + rz * 0.75);
    const hL = groundHeight(cart.x - rx * 0.75, cart.z - rz * 0.75);
    cartModel.group.position.set(cart.x, (hF + hB + hR + hL) / 4, cart.z);
    cartModel.group.rotation.y = cart.heading;
    cartModel.body.rotation.x = -Math.atan2(hF - hB, 2.2);
    cartModel.body.rotation.z = Math.atan2(hR - hL, 1.5);
  }
  poseCart();

  function stepCart(dt) {
    if (cart.occupied) cart.speed += -cart.iz * 21 * dt;
    cart.speed *= Math.pow(cart.occupied && cart.iz ? 0.55 : 0.2, dt);
    cart.speed = Math.max(-7, Math.min(18, cart.speed));
    if (Math.abs(cart.speed) < 0.02) cart.speed = 0;
    const steer = Math.min(1, Math.abs(cart.speed) / 6);
    cart.heading -= cart.ix * 1.9 * dt * steer * Math.sign(cart.speed || 1);

    const fx = Math.sin(cart.heading);
    const fz = Math.cos(cart.heading);
    // hills slow you down going up and push going down
    const slope = (groundHeight(cart.x + fx, cart.z + fz) - groundHeight(cart.x - fx, cart.z - fz)) / 2;
    cart.speed -= slope * 9 * dt;

    const nx = cart.x + fx * cart.speed * dt;
    const nz = cart.z + fz * cart.speed * dt;
    const probe = Math.sign(cart.speed || 1) * 1.7;
    // the cart never drives into the sea: the shoreline is a wall for it
    if (waterDepth(nx + fx * probe, nz + fz * probe) > -0.2) {
      if (Math.abs(cart.speed) > 3) puff(nx + fx * probe, nz + fz * probe, 0xe6d3a8);
      cart.speed *= -0.25;
    } else {
      cart.x = nx;
      cart.z = nz;
    }

    for (const c of statics) {
      const dx = cart.x - c.x;
      const dz = cart.z - c.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const min = CART_R + c.r;
      if (d < min) {
        cart.x = c.x + (dx / d) * min;
        cart.z = c.z + (dz / d) * min;
        if (Math.abs(cart.speed) > 4) puff(c.x, c.z, 0x8a9a6a);
        cart.speed *= 0.45;
      }
    }

    for (const b of bags) {
      const dx = b.x - cart.x;
      const dz = b.z - cart.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const min = CART_R + b.r;
      if (d < min) {
        const nxB = dx / d;
        const nzB = dz / d;
        b.x = cart.x + nxB * min;
        b.z = cart.z + nzB * min;
        const impact = Math.abs(cart.speed) * Math.max(0.3, Math.abs(nxB * fx + nzB * fz));
        hitBag(b, nxB, nzB, impact * 1.3 + 0.5);
        cart.speed *= 0.9;
      }
    }

    // a ball in the way gets shoved
    if (ball.state !== 'parked' && Math.abs(cart.speed) > 0.5) {
      const dx = ball.x - cart.x;
      const dz = ball.z - cart.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const min = CART_R + BALL_R;
      if (d < min && (ball.state === 'roam' || ball.state === 'rest' || ball.state === 'moving')) {
        ball.x = cart.x + (dx / d) * min;
        ball.z = cart.z + (dz / d) * min;
        const push = Math.abs(cart.speed) * 1.3 + 1;
        ball.vx = (dx / d) * push;
        ball.vz = (dz / d) * push;
        if (Math.abs(cart.speed) > 8) {
          ball.vy = 4;
          ball.air = 0.02;
        }
        if (ball.state === 'rest') ball.state = 'moving';
      }
    }

    cartModel.wheels.forEach((w) => (w.rotation.x += (cart.speed * dt) / 0.32));
    poseCart();
  }

  function stepBall(h) {
    const hole = LAYOUT[ball.hole];
    const [cx, cz] = hole.cup;
    const roaming = ball.state === 'roam';

    if (ball.air > 0 || ball.vy > 0) {
      ball.vy -= G * h;
      ball.air += ball.vy * h;
      ball.x += ball.vx * h;
      ball.z += ball.vz * h;
      if (ball.air <= 0) {
        ball.air = 0;
        const s = surfaceAt(ball.x, ball.z);
        if (ball.vy < -3.5 && waterDepth(ball.x, ball.z) < 0) {
          ball.vy = -ball.vy * (s.name === 'bunker' ? 0.05 : 0.3);
          const k = s.name === 'bunker' ? 0.15 : s.name === 'rough' ? 0.55 : 0.75;
          ball.vx *= k;
          ball.vz *= k;
          puff(ball.x, ball.z, s.name === 'bunker' ? 0xe6d3a8 : 0xa9c98c);
        } else {
          ball.vy = 0;
        }
      }
    } else {
      const s = surfaceAt(ball.x, ball.z);
      const gx = (groundHeight(ball.x + 0.3, ball.z) - groundHeight(ball.x - 0.3, ball.z)) / 0.6;
      const gz = (groundHeight(ball.x, ball.z + 0.3) - groundHeight(ball.x, ball.z - 0.3)) / 0.6;
      ball.vx -= SLOPE * gx * h;
      ball.vz -= SLOPE * gz * h;

      if (roaming) {
        // push in the input direction, easing off near top speed
        const along = ball.vx * ball.inX + ball.vz * ball.inZ;
        const room = Math.max(0, 1 - along / 16);
        ball.vx += ball.inX * 30 * room * h;
        ball.vz += ball.inZ * 30 * room * h;
        if (ball.inX || ball.inZ) ball.shot = false;
        if (Math.hypot(ball.vx, ball.vz) < 0.3) ball.shot = false;
        if (waterDepth(ball.x, ball.z) < -0.6) {
          ball.lastDryX = ball.x;
          ball.lastDryZ = ball.z;
        }
      }

      // the cup pulls in a slow putt that is close enough
      const dcx = cx - ball.x;
      const dcz = cz - ball.z;
      const dCup = Math.hypot(dcx, dcz);
      let sp = Math.hypot(ball.vx, ball.vz);
      if (!roaming && dCup < 1.3 && sp < 4.5) {
        ball.vx += (dcx / dCup) * 5 * h;
        ball.vz += (dcz / dCup) * 5 * h;
      }

      sp = Math.hypot(ball.vx, ball.vz);
      const dec = (s.roll + s.lin * sp) * h;
      if (sp <= dec) {
        ball.vx = 0;
        ball.vz = 0;
      } else {
        ball.vx *= (sp - dec) / sp;
        ball.vz *= (sp - dec) / sp;
      }
      ball.x += ball.vx * h;
      ball.z += ball.vz * h;

      // come to rest when friction beats what the slope can do
      const slopeA = SLOPE * Math.hypot(gx, gz);
      if (Math.hypot(ball.vx, ball.vz) < 0.22 && slopeA < s.roll * 0.9) {
        ball.still += h;
      } else {
        ball.still = 0;
      }
    }

    if (ball.air < 0.9) collideBall();

    // the parked cart is solid
    if (!cart.occupied && ball.air < 1.6) {
      const dx = ball.x - cart.x;
      const dz = ball.z - cart.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const min = CART_R + BALL_R;
      if (d < min) {
        const nx = dx / d;
        const nz = dz / d;
        ball.x = cart.x + nx * min;
        ball.z = cart.z + nz * min;
        const vn = ball.vx * nx + ball.vz * nz;
        if (vn < 0) {
          ball.vx -= 1.5 * vn * nx;
          ball.vz -= 1.5 * vn * nz;
        }
      }
    }

    // a free shot that finds any cup drops in for a trick shot
    if (roaming && ball.shot && ball.air < 0.2) {
      for (let i = 0; i < LAYOUT.length; i++) {
        const [hx, hz] = LAYOUT[i].cup;
        if (Math.hypot(ball.x - hx, ball.z - hz) < CUP_R && Math.hypot(ball.vx, ball.vz) < 9) {
          ball.state = 'cupped';
          ball.cupHole = i;
          ball.timer = 0;
          ball.shot = false;
          onEvent?.({ type: 'trick', hole: i });
          return;
        }
      }
    }

    // the cup
    const dCup = Math.hypot(ball.x - cx, ball.z - cz);
    if (!roaming && dCup < CUP_R && ball.air < 0.2) {
      const sp = Math.hypot(ball.vx, ball.vz);
      if (sp < 8.5) {
        ball.state = 'holed';
        ball.timer = 0;
        ball.vx = (cx - ball.x) * 4;
        ball.vz = (cz - ball.z) * 4;
        onEvent?.({ type: 'holed', hole: ball.hole });
        return;
      }
      // too hot: it lips out
      const turn = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.4);
      const c = Math.cos(turn);
      const sn = Math.sin(turn);
      const vx = ball.vx * c - ball.vz * sn;
      ball.vz = (ball.vx * sn + ball.vz * c) * 0.7;
      ball.vx = vx * 0.7;
      ball.x += ball.vx * h * 2;
      ball.z += ball.vz * h * 2;
    }

    // the water
    if (ball.air <= 0.05 && waterDepth(ball.x, ball.z) > 0.12) {
      ball.wasRoam = roaming;
      ball.state = 'water';
      ball.timer = 0;
      splash(ball.x, ball.z);
      onEvent?.({ type: 'water', roaming });
      return;
    }

    // hard edge far out at sea (only reachable airborne)
    const e = Math.hypot(ball.x / ISLAND.rx, ball.z / ISLAND.rz);
    if (e > MAX_E) {
      ball.x /= e / MAX_E;
      ball.z /= e / MAX_E;
      ball.vx *= -0.2;
      ball.vz *= -0.2;
    }

    if (!roaming && ball.still > 0.25) {
      ball.vx = 0;
      ball.vz = 0;
      ball.state = 'rest';
      ball.restX = ball.x;
      ball.restZ = ball.z;
      onEvent?.({ type: 'rest', surface: surfaceAt(ball.x, ball.z).name });
    }
  }

  function updateBall(dt) {
    const prevX = ball.x;
    const prevZ = ball.z;
    if (ball.state === 'moving' || ball.state === 'roam') {
      const st = ball.state;
      const steps = Math.ceil(dt / (1 / 120));
      for (let i = 0; i < steps && ball.state === st; i++) stepBall(dt / steps);
    } else if (ball.state === 'holed' || ball.state === 'cupped') {
      ball.timer += dt;
      const [cx, cz] = LAYOUT[ball.state === 'holed' ? ball.hole : ball.cupHole].cup;
      ball.x += (cx - ball.x) * Math.min(1, dt * 10);
      ball.z += (cz - ball.z) * Math.min(1, dt * 10);
      ball.air = -Math.min(1.1, ball.timer * 3);
      if (ball.state === 'cupped' && ball.timer > 1.2) {
        // pop back out beside the cup and carry on exploring
        placeBall(cx + 1.4, cz + 1.4);
        ball.state = 'roam';
      }
    } else if (ball.state === 'water') {
      ball.timer += dt;
      ball.air = Math.max(-1.6, ball.air - dt * 1.4);
      if (ball.timer > 1.3) {
        if (ball.wasRoam) {
          // exploring: wash back up where you were last on dry land
          placeBall(ball.lastDryX, ball.lastDryZ);
          ball.state = 'roam';
          onEvent?.({ type: 'dropped', roaming: true });
        } else {
          // golf: penalty drop where the shot was played from
          placeBall(ball.restX, ball.restZ);
          onEvent?.({ type: 'dropped' });
        }
      }
    }

    const gy = ball.state === 'water' ? WATER_Y : groundHeight(ball.x, ball.z);
    ballMesh.position.set(ball.x, gy + BALL_R + ball.air, ball.z);
    ballMesh.visible =
      ball.state !== 'parked' && !((ball.state === 'holed' || ball.state === 'cupped') && ball.timer > 0.4);
    shadowDisc.position.set(ball.x, groundHeight(ball.x, ball.z) + 0.05, ball.z);
    shadowDisc.visible = ball.air > 0.3 && ball.state === 'moving';
    shadowDisc.material.opacity = Math.max(0.06, 0.24 - ball.air * 0.02);

    const mx = ball.x - prevX;
    const mz = ball.z - prevZ;
    const moved = Math.hypot(mx, mz);
    if (moved > 0.0005) {
      rollAxis.set(mz, 0, -mx).normalize();
      rollQ.setFromAxisAngle(rollAxis, moved / BALL_R);
      ballMesh.quaternion.premultiply(rollQ);
    }
  }

  /* ---------- per frame ---------- */
  function update(dt, clock) {
    water.material.uniforms.uTime.value = clock;

    updateBall(dt);
    stepCart(dt);
    stepBags(dt);

    for (const h of holes) {
      if (calm) continue;
      const p = h.flag.geometry.attributes.position;
      const base = h.flagBase;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3];
        p.setZ(i, Math.sin(x * 3.2 - clock * 4.5 + h.phase) * 0.09 * (x / 1.9));
      }
      p.needsUpdate = true;
      h.flag.geometry.computeVertexNormals();
    }

    for (const g of golfers) {
      if (calm) continue;
      g.t += dt;
      const t = g.t % 5.5;
      // lazy practice swing every few seconds
      if (t < 0.8) g.swing.rotation.x = -0.45 - (t / 0.8) * 2;
      else if (t < 1.0) g.swing.rotation.x = -2.45 + ((t - 0.8) / 0.2) * 3.2;
      else if (t < 2.2) g.swing.rotation.x = 0.75 - ((t - 1.0) / 1.2) * 1.2;
      else g.swing.rotation.x = -0.45;
    }

    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life += dt;
      const arr = b.pts.geometry.attributes.position.array;
      b.vels.forEach((v, j) => {
        v.y -= 16 * dt;
        arr[j * 3] += v.x * dt;
        arr[j * 3 + 1] += v.y * dt;
        arr[j * 3 + 2] += v.z * dt;
      });
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.pts.material.opacity = Math.max(0, 1 - b.life * 0.9);
      if (b.life > 1.2) {
        scene.remove(b.pts);
        b.pts.geometry.dispose();
        b.pts.material.dispose();
        bursts.splice(i, 1);
      }
    }
  }

  teeUp(0);

  return {
    renderer,
    scene,
    camera,
    ball,
    holes,
    update,
    shoot,
    roamShot,
    teeUp,
    drawAim,
    cart,
    /** Free roam from wherever the ball is, or from a given spot. */
    roam(x = ball.x, z = ball.z) {
      if (ball.state === 'water') return;
      placeBall(x, z);
      ball.state = 'roam';
    },
    setRoamInput(x, z) {
      ball.inX = x;
      ball.inZ = z;
    },
    hop() {
      if (ball.state === 'roam' && ball.air <= 0 && ball.vy === 0) {
        ball.vy = 7.5;
        ball.air = 0.02;
      }
    },
    setCartInput(ix, iz) {
      cart.ix = ix;
      cart.iz = iz;
    },
    cartDistance() {
      return Math.hypot(cart.x - ball.x, cart.z - ball.z);
    },
    enterCart() {
      if (cart.occupied || ball.state !== 'roam') return false;
      cart.occupied = true;
      ball.state = 'parked';
      return true;
    },
    exitCart() {
      if (!cart.occupied) return false;
      const fx = Math.sin(cart.heading);
      const fz = Math.cos(cart.heading);
      const rx = Math.cos(cart.heading);
      const rz = -Math.sin(cart.heading);
      // step out to the left, the right, or behind, whichever is dry
      const spots = [
        [cart.x - rx * 2.3, cart.z - rz * 2.3],
        [cart.x + rx * 2.3, cart.z + rz * 2.3],
        [cart.x - fx * 2.8, cart.z - fz * 2.8],
      ];
      const [x, z] = spots.find(([sx, sz]) => waterDepth(sx, sz) < -0.4) ?? spots[2];
      placeBall(x, z);
      ball.state = 'roam';
      cart.occupied = false;
      cart.ix = 0;
      cart.iz = 0;
      return true;
    },
    aimAtCup() {
      const [cx, cz] = LAYOUT[ball.hole].cup;
      return Math.atan2(cx - ball.x, cz - ball.z);
    },
    distanceToCup() {
      const [cx, cz] = LAYOUT[ball.hole].cup;
      return Math.hypot(cx - ball.x, cz - ball.z);
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = camera.aspect < 0.8 ? 60 : camera.aspect < 1.3 ? 50 : 42;
      camera.updateProjectionMatrix();
    },
    dispose() {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            m.map?.dispose();
            m.bumpMap?.dispose();
            m.dispose();
          });
        }
      });
      renderer.dispose();
    },
  };
}
