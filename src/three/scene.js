import * as THREE from 'three';

/**
 * A golf-course island that IS the CV: each flag is a CV section, large
 * holograms line the routes with the fine print, and golf-native games
 * unlock facts. Plain three.js, driven imperatively; React owns the HUD.
 *
 * World axes: X right, Z toward the viewer, Y up.
 */

export const NEAR = 4.6;
export const DISCOVER = 5.6;
export const HOME_R = 4.2;
export const LEFT_HOME = HOME_R + 4;
export const HOLO_R = 9;
export const CART_R = 4;
export const ISLAND = { rx: 72, rz: 56 };
export const SHORE_E = 1.045;
export const MAX_E = 1.3;

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

const ellipseNorm = (x, z) => Math.hypot(x / (ISLAND.rx + 8), z / (ISLAND.rz + 8));
export const groundHeight = (x, z) => {
  const e = ellipseNorm(x, z);
  const lip = smoothstep(0.72, 0.95, e) * (noise2(x * 0.05, z * 0.05) * 2.2 + 0.4);
  const drop = smoothstep(1.0, 1.22, e) * -6.5;
  return lip + drop;
};

/* ------------------------------------------------------------------ */
/* procedural textures                                                 */
/* ------------------------------------------------------------------ */

/** Neutral luminance detail (blade strokes) — multiplied by vertex colors,
 *  so the same map reads as grass on the green and grain on the sand. */
function detailTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#a6a6a2';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2100; i++) {
    const x = hash2(i, 1) * 256;
    const y = hash2(i, 2) * 256;
    const lum = 128 + Math.floor((hash2(i, 3) - 0.5) * 88);
    g.strokeStyle = `rgb(${lum - 6},${lum},${lum - 10})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (hash2(i, 4) - 0.5) * 2.4, y - 2 - hash2(i, 5) * 3.4);
    g.stroke();
  }
  for (let i = 0; i < 240; i++) {
    const lum = 96 + Math.floor(hash2(i, 6) * 46);
    g.fillStyle = `rgb(${lum},${lum + 4},${lum - 4})`;
    g.fillRect(hash2(i, 7) * 256, hash2(i, 8) * 256, 1.6, 1.6);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(90, 90);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Raked sand for the bunkers. */
function sandTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#dcc493';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) {
    g.fillStyle = hash2(i, 1) > 0.5 ? '#cdb47f' : '#eadbb0';
    g.fillRect(hash2(i, 2) * 128, hash2(i, 3) * 128, 1.3, 1.3);
  }
  g.strokeStyle = 'rgba(160, 132, 84, 0.35)';
  g.lineWidth = 1.4;
  for (let i = 0; i < 7; i++) {
    g.beginPath();
    g.arc(64, 64, 12 + i * 9, hash2(i, 4) * 2, hash2(i, 4) * 2 + 2.4);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.2, 2.2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Alpha-tested grass-blade sprite for the instanced tufts. */
function bladeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 7; i++) {
    const bx = 6 + i * 8 + (hash2(i, 1) - 0.5) * 5;
    const lean = (hash2(i, 2) - 0.5) * 14;
    const h = 34 + hash2(i, 3) * 26;
    const grad = g.createLinearGradient(0, 64, 0, 64 - h);
    grad.addColorStop(0, '#3f7c30');
    grad.addColorStop(1, '#8fd45f');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(bx - 2.4, 64);
    g.quadraticCurveTo(bx - 1 + lean * 0.4, 64 - h * 0.6, bx + lean, 64 - h);
    g.quadraticCurveTo(bx + 1 + lean * 0.4, 64 - h * 0.6, bx + 2.4, 64);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

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

function makeTerrain(detail) {
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
    tmp.lerp(sand, smoothstep(0.93, 1.0, e));
    tmp.lerp(seabed, smoothstep(1.04, 1.2, e));
    const mottle = 0.94 + noise2(x * 0.6, z * 0.6) * 0.13;
    colors[i * 3] = tmp.r * mottle;
    colors[i * 3 + 1] = tmp.g * mottle;
    colors[i * 3 + 2] = tmp.b * mottle;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: detail,
      bumpMap: detail,
      bumpScale: 0.4,
      roughness: 0.96,
      metalness: 0,
    }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

/** Thousands of swaying grass tufts over the playing field. */
function makeGrassTufts(uTime) {
  // two crossed quads, hand-built
  const positions = [];
  const uvs = [];
  const normals = [];
  const index = [];
  const quad = (rot) => {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const base = positions.length / 3;
    const w = 0.42;
    positions.push(-w * c, 0, -w * s, w * c, 0, w * s, w * c, 0.55, w * s, -w * c, 0.55, -w * s);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    for (let i = 0; i < 4; i++) normals.push(0, 0, 1);
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  quad(0);
  quad(Math.PI / 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(index);

  const mat = new THREE.MeshStandardMaterial({
    map: bladeTexture(),
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 1,
    metalness: 0,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float wx = instanceMatrix[3].x;
       float wz = instanceMatrix[3].z;
       transformed.x += sin(uTime * 1.5 + wx * 0.7 + wz * 0.53) * transformed.y * 0.4;`,
    )}`;
  };

  const COUNT = 2400;
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const sc = new THREE.Vector3();
  const colA = new THREE.Color(0x69aa4b);
  const colB = new THREE.Color(0x92cf62);
  const col = new THREE.Color();
  let placed = 0;
  let i = 0;
  while (placed < COUNT && i < COUNT * 4) {
    i++;
    const x = (hash2(i, 11) - 0.5) * 2 * ISLAND.rx * 0.95;
    const z = (hash2(i, 12) - 0.5) * 2 * ISLAND.rz * 0.95;
    if (ellipseNorm(x, z) > 0.9) continue;
    q.setFromAxisAngle(up, hash2(i, 13) * Math.PI * 2);
    const s = 0.75 + hash2(i, 14) * 0.85;
    sc.set(s, s * (0.8 + hash2(i, 15) * 0.6), s);
    m.compose(new THREE.Vector3(x, groundHeight(x, z), z), q, sc);
    mesh.setMatrixAt(placed, m);
    mesh.setColorAt(placed, col.copy(colA).lerp(colB, hash2(i, 16)));
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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
/* canvas panel textures                                               */
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

function signTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#7c5a38';
  g.fillRect(0, 0, 512, 96);
  g.strokeStyle = '#5d4128';
  g.lineWidth = 8;
  g.strokeRect(4, 4, 504, 88);
  g.fillStyle = '#f7f0df';
  g.font = '700 44px Inter, Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(`${text}  →`, 256, 62);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ */
/* props                                                               */
/* ------------------------------------------------------------------ */

function makePath(curve, half = 1.05, N = 150) {
  const pos = [];
  const cols = [];
  const idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const nx = -tan.z;
    const nz = tan.x;
    const yl = groundHeight(p.x + nx * half, p.z + nz * half) + 0.07;
    const yr = groundHeight(p.x - nx * half, p.z - nz * half) + 0.07;
    pos.push(p.x + nx * half, yl, p.z + nz * half, p.x - nx * half, yr, p.z - nz * half);
    const seam = i % 5 === 0 ? 0.78 : 1;
    const c = 0.72 * seam;
    cols.push(c, c * 0.985, c * 0.93, c, c * 0.985, c * 0.93);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  mesh.receiveShadow = true;
  return mesh;
}

function makeWalker(seed) {
  const g = new THREE.Group();
  const shirtColor = [0xe86f5a, 0x4f8ac9, 0xd9a441, 0x7a5fb8, 0x3f8f6a, 0xc95f8e][seed % 6];
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const skin = mat(0xd9a06b);
  const pants = mat(0x33415c);
  const shirt = mat(shirtColor);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), pants);
  legL.position.set(-0.11, 0.28, 0);
  const legR = legL.clone();
  legR.position.x = 0.11;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.6, 0.26), shirt);
  torso.position.y = 0.86;

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.11), shirt);
  armL.position.set(-0.29, 0.9, 0);
  const armR = armL.clone();
  armR.position.x = 0.29;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
  head.position.y = 1.34;

  for (const part of [legL, legR, torso, armL, armR, head]) {
    part.castShadow = true;
    g.add(part);
  }
  g.scale.setScalar(0.92 + hash2(seed, 3) * 0.14);
  return { group: g, legL, legR, armL, armR };
}

function makeGolfer(seed) {
  const w = makeWalker(seed + 7);
  const g = w.group;

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.09, 12),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.7 }),
  );
  cap.position.y = 1.47;
  g.add(cap);

  const swing = new THREE.Group();
  swing.position.set(0.29, 1.12, 0);
  w.armR.position.set(0, -0.22, 0);
  g.remove(w.armR);
  swing.add(w.armR);

  const club = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1.15, 6),
    new THREE.MeshStandardMaterial({ color: 0xb9c2c6, roughness: 0.35, metalness: 0.6 }),
  );
  club.position.set(0, -0.9, 0.1);
  club.rotation.x = 0.22;
  swing.add(club);
  const clubHead = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.09, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x30383f, roughness: 0.4, metalness: 0.5 }),
  );
  clubHead.position.set(0, -1.46, 0.22);
  swing.add(clubHead);
  g.add(swing);

  // a tee'd practice ball at their feet
  const teeBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.4 }),
  );
  teeBall.position.set(0.42, 0.09, 0.34);
  g.add(teeBall);

  swing.rotation.x = -0.45;
  return { group: g, swing, legL: w.legL, legR: w.legR, armL: w.armL };
}

/** A golf bag with clubs poking out. Clubs can be ejected as loose sticks. */
function makeGolfBag(seed) {
  const g = new THREE.Group();
  const color = [0xc23b3b, 0x2f5d8a, 0x3a3f45, 0x946037, 0x4a7350][seed % 5];
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.3, 1.05, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
  );
  body.position.y = 0.55;
  body.rotation.z = 0.24;
  body.castShadow = true;
  g.add(body);

  const pocket = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.34, 0.12),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, -0.08), roughness: 0.85 }),
  );
  pocket.position.set(0.14, 0.42, 0.24);
  pocket.rotation.z = 0.24;
  g.add(pocket);

  const clubs = [];
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0xb9c2c6, roughness: 0.3, metalness: 0.65 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x2c333a, roughness: 0.4, metalness: 0.5 });
  for (let i = 0; i < 3; i++) {
    const club = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), shaftMat);
    shaft.position.y = 0.5;
    club.add(shaft);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.16), headMat);
    head.position.set(0, 1.02, 0.05);
    club.add(head);
    club.position.set(0.3 + (hash2(seed, i) - 0.5) * 0.16, 0.62, (hash2(seed, i + 4) - 0.5) * 0.2);
    club.rotation.z = 0.32 + (hash2(seed, i + 8) - 0.5) * 0.25;
    club.rotation.x = (hash2(seed, i + 12) - 0.5) * 0.3;
    g.add(club);
    clubs.push(club);
  }
  return { group: g, clubs };
}

function makeTeeGate(x, z, yaw, accent) {
  const g = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xf5f7f4, roughness: 0.5 });
  const markMat = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  for (const sx of [-1.8, 1.8]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.62, 8), postMat);
    post.position.set(sx, 0.31, 0);
    post.castShadow = true;
    g.add(post);
    const ballMark = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), markMat);
    ballMark.position.set(sx, 0.72, 0);
    g.add(ballMark);
  }
  g.position.set(x, groundHeight(x, z), z);
  g.rotation.y = yaw;
  return g;
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

function makeCone(x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.85, 12),
    new THREE.MeshStandardMaterial({ color: 0xf07d2d, roughness: 0.7 }),
  );
  body.position.y = 0.42;
  body.castShadow = true;
  g.add(body);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.14, 12),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.6 }),
  );
  band.position.y = 0.42;
  g.add(band);
  g.position.set(x, groundHeight(x, z), z);
  return g;
}

function makeRouteHolo(h) {
  const accent = KIND_COLOR[h.kind] ?? KIND_COLOR.home;
  const g = new THREE.Group();
  g.position.set(h.x, groundHeight(h.x, h.z), h.z);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.11, 1.15, 8),
    new THREE.MeshStandardMaterial({ color: 0xf5f7f4, roughness: 0.45, metalness: 0.2 }),
  );
  post.position.y = 0.57;
  post.castShadow = true;
  g.add(post);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 12, 10),
    new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.55, roughness: 0.4 }),
  );
  cap.position.y = 1.22;
  g.add(cap);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 1.7, 5.6, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.y = 3.6;
  g.add(beam);

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(9.4, 4.32),
    new THREE.MeshBasicMaterial({
      map: routeHoloTexture(h, cssColor(accent)),
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  panel.position.y = 6.6;
  g.add(panel);

  return { ...h, group: g, beam, panel, base: new THREE.Vector3(h.x, 0, h.z), open: false, muted: false, t: 0 };
}

function makeFlagNode(node, gallery) {
  const accent = KIND_COLOR[node.kind] ?? KIND_COLOR.home;
  const accentCss = cssColor(accent);
  const g = new THREE.Group();
  g.position.set(node.x, groundHeight(node.x, node.z), node.z);

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
  holo.position.y = 8.4;
  holo.visible = false;

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 1, 3.6, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.y = -3.1;
  holo.add(beam);

  const galleryEntry = gallery.find(
    (e) =>
      e.project.toLowerCase() === node.label.toLowerCase() ||
      e.project.toLowerCase() === node.kicker.toLowerCase(),
  );
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(6.8, 4.47),
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

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.52, 0.1, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.5 }),
  );
  stripe.position.set(0, 0.62, -1.06);
  g.add(stripe);

  return { group: g, wheels };
}

/** Direction signpost at the tee, pointing players into the CV. */
function makeSignpost(x, z, arms) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 2.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x7c5a38, roughness: 0.9 }),
  );
  pole.position.y = 1.45;
  pole.castShadow = true;
  g.add(pole);

  arms.forEach((arm, i) => {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.34, 0.06),
      new THREE.MeshStandardMaterial({ map: signTexture(arm.text), roughness: 0.85 }),
    );
    const yaw = Math.atan2(arm.tx - x, arm.tz - z) - Math.PI / 2;
    board.rotation.y = yaw;
    board.position.set(Math.sin(yaw + Math.PI / 2) * 0.8, 2.5 - i * 0.44, Math.cos(yaw + Math.PI / 2) * 0.8);
    board.castShadow = true;
    g.add(board);
  });

  g.position.set(x, groundHeight(x, z), z);
  return g;
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
  scene.add(makeTerrain(detailTexture()));
  const grassTime = { value: 0 };
  if (!calm) scene.add(makeGrassTufts(grassTime));
  const water = makeWater();
  scene.add(water);
  const pollen = makePollen();
  scene.add(pollen);

  /* physics registries */
  const statics = [];
  const dynamics = [];
  const debris = []; // loose clubs, splinters — simple ballistic bodies
  const events = [];
  const addStatic = (x, z, r) => statics.push({ x, z, r });

  /* trees */
  const keepOut = [
    ...flags,
    ...holos,
    { x: 32, z: 44 },
    { x: 26, z: 38 },
    { x: 40, z: 46 },
    { x: 28, z: -16 },
    { x: 44, z: 40 },
    { x: 4, z: 17 },
  ];
  for (let i = 0; i < 46; i++) {
    const ang = hash2(i, 1) * Math.PI * 2;
    const e = 0.52 + hash2(i, 2) * 0.28;
    const x = Math.cos(ang) * e * ISLAND.rx;
    const z = Math.sin(ang) * e * ISLAND.rz;
    if (keepOut.some((k) => Math.hypot(k.x - x, k.z - z) < 8)) continue;
    const tree = makeTree(i);
    tree.position.set(x, groundHeight(x, z), z);
    scene.add(tree);
    addStatic(x, z, 1.1 * tree.scale.x);
  }

  /* bunkers with raked sand */
  const sandTex = sandTexture();
  for (const [bx, bz, br] of [[20, -12, 4], [-28, 10, 5], [9, 22, 3.2], [-14, 40, 4], [36, 34, 3.6]]) {
    const b = new THREE.Mesh(
      new THREE.CircleGeometry(br, 28),
      new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }),
    );
    b.rotation.x = -Math.PI / 2;
    b.position.set(bx, groundHeight(bx, bz) + 0.03, bz);
    b.scale.y = 0.75;
    b.receiveShadow = true;
    scene.add(b);
  }

  /* park + walkway */
  const walkCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(22, 0, 36),
      new THREE.Vector3(31, 0, 32),
      new THREE.Vector3(41, 0, 37),
      new THREE.Vector3(45, 0, 46),
      new THREE.Vector3(36, 0, 53),
      new THREE.Vector3(25, 0, 50),
    ],
    true,
  );
  scene.add(makePath(walkCurve));

  const rimPts = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    rimPts.push(new THREE.Vector3(Math.cos(a) * ISLAND.rx * 0.88, 0, Math.sin(a) * ISLAND.rz * 0.88));
  }
  const rimCurve = new THREE.CatmullRomCurve3(rimPts, true);
  scene.add(makePath(rimCurve, 1.5, 320));

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
  lamp.position.set(PARK.x, groundHeight(PARK.x, PARK.z - 4) + 1.7, PARK.z - 4);
  lamp.castShadow = true;
  scene.add(lamp);
  addStatic(PARK.x, PARK.z - 4, 0.35);

  for (let i = 0; i < 26; i++) {
    const fx = PARK.x + (hash2(i, 21) - 0.5) * 16;
    const fz = PARK.z + (hash2(i, 22) - 0.5) * 12;
    const f = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 6, 6),
      new THREE.MeshBasicMaterial({ color: [0xf472b6, 0xfbbf24, 0xffffff][i % 3] }),
    );
    f.position.set(fx, groundHeight(fx, fz) + 0.1, fz);
    scene.add(f);
  }

  /* NPCs: a few strollers + standing caddies. It's a golf course, not a mall. */
  const makeStroller = (i, curve, count, home) => {
    const w = makeWalker(i);
    scene.add(w.group);
    return {
      ...w,
      curve,
      home,
      t: curve ? i / count + hash2(i, 9) * 0.05 : 0,
      speed: (curve === walkCurve ? 0.0115 : 0.0035) + hash2(i, 4) * 0.003,
      state: curve ? 'walk' : 'stand', // walk | stand | flee | return | rag | rise
      vel: new THREE.Vector2(),
      ragT: 0,
      riseT: 0,
      fallSign: 1,
      phase: hash2(i, 6) * Math.PI * 2,
    };
  };
  const walkers = [
    makeStroller(0, walkCurve, 2),
    makeStroller(1, walkCurve, 2),
    makeStroller(2, rimCurve, 2),
    makeStroller(3, rimCurve, 2),
    makeStroller(4, null, 1, { x: 30, z: -13 }), // caddy at the bag rack
    makeStroller(5, null, 1, { x: 43, z: 42 }), // caddy at the park rack
  ];
  for (const w of walkers) {
    if (!w.curve) w.group.position.set(w.home.x, groundHeight(w.home.x, w.home.z), w.home.z);
  }
  let npcToastDone = false;

  /* golf bag racks — the smashables */
  const bags = [];
  const spawnBagRow = (cx, cz, count, rack, factId) => {
    for (let i = 0; i < count; i++) {
      const b = makeGolfBag(i + (rack === 'A' ? 0 : 3));
      const bx = cx + (i - (count - 1) / 2) * 1.15 + (hash2(i, cz) - 0.5) * 0.3;
      const bz = cz + (hash2(i, cx) - 0.5) * 0.8;
      b.group.position.set(bx, groundHeight(bx, bz), bz);
      b.group.rotation.y = hash2(i, 5) * Math.PI * 2;
      scene.add(b.group);
      const body = {
        group: b.group,
        clubs: b.clubs,
        vel: new THREE.Vector2(),
        r: 0.52,
        spin: 0,
        kind: 'bag',
        rack,
        factId,
        woken: false,
      };
      dynamics.push(body);
      bags.push(body);
    }
  };
  spawnBagRow(28, -16, 5, 'A', 'crates'); // cart-smash rack
  spawnBagRow(44, 40, 3, 'B', 'tools'); // knockable rack near the park
  let rackADone = false;
  let rackBDone = false;

  function ejectClubs(bag, fromX, fromZ) {
    for (const club of bag.clubs.splice(0, 2)) {
      club.updateWorldMatrix(true, false);
      const wp = new THREE.Vector3().setFromMatrixPosition(club.matrixWorld);
      bag.group.remove(club);
      club.position.copy(wp);
      club.rotation.set(hash2(wp.x, 1) * 2, hash2(wp.z, 2) * 6.28, hash2(wp.x, 3) * 2);
      scene.add(club);
      const away = Math.atan2(wp.z - fromZ, wp.x - fromX) + (hash2(wp.x, 4) - 0.5) * 1.2;
      const power = 3 + hash2(wp.z, 5) * 5;
      debris.push({
        mesh: club,
        vel: new THREE.Vector3(Math.cos(away) * power, 3 + hash2(wp.x, 6) * 5, Math.sin(away) * power),
        ang: new THREE.Vector3((hash2(wp.x, 7) - 0.5) * 14, (hash2(wp.z, 8) - 0.5) * 10, (hash2(wp.x, 9) - 0.5) * 14),
        life: 0,
        restY: 0.05,
        persistent: true,
        resting: false,
      });
    }
  }

  /* cone slalom */
  const cones = [
    [16, -4],
    [20, -8],
    [24, -12],
    [32, -20],
    [36, -24],
  ].map(([cx, cz]) => {
    const c = makeCone(cx, cz);
    scene.add(c);
    const body = { group: c, vel: new THREE.Vector2(), r: 0.34, spin: 0, kind: 'cone', woken: false };
    dynamics.push(body);
    return body;
  });
  let conesDone = false;

  /* tee-marker gates (roll between the markers) */
  const gates = [
    { x: 22, z: 44, yaw: 0.9, factId: 'devops', accent: 0x38bdf8 },
    { x: -36, z: 42, yaw: -0.6, factId: 'db', accent: 0xa78bfa },
    { x: 58, z: -8, yaw: 1.4, factId: 'langs', accent: 0xf472b6 },
  ].map((spec) => {
    scene.add(makeTeeGate(spec.x, spec.z, spec.yaw, spec.accent));
    const c = Math.cos(spec.yaw);
    const s = Math.sin(spec.yaw);
    addStatic(spec.x - 1.8 * c, spec.z + 1.8 * s, 0.22);
    addStatic(spec.x + 1.8 * c, spec.z - 1.8 * s, 0.22);
    return { ...spec, passed: false };
  });

  /* water splashes + landing puffs */
  const splashes = [];
  function burst(x, z, opts) {
    const { count, color, size, up, out, y0 } = opts;
    const pos = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = x;
      pos[i * 3 + 1] = y0;
      pos[i * 3 + 2] = z;
      const a = hash2(i, 1) * Math.PI * 2;
      const r = 0.5 + hash2(i, 2) * out;
      vels.push(new THREE.Vector3(Math.cos(a) * r, up * (0.5 + hash2(i, 3)), Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    scene.add(pts);
    return { pts, vels, rings: [], life: 0 };
  }

  function splash(x, z) {
    const sp = burst(x, z, { count: 80, color: 0xd8f2fa, size: 0.24, up: 7, out: 4.5, y0: 0.1 });
    sp.rings = [0, 1, 2].map((i) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 0.72, 40),
        new THREE.MeshBasicMaterial({ color: 0xeafcff, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, -0.4, z);
      ring.scale.setScalar(0.4 + i * 0.28);
      scene.add(ring);
      return ring;
    });
    splashes.push(sp);
  }

  function puff(x, z) {
    splashes.push(burst(x, z, { count: 26, color: 0xa8c98a, size: 0.16, up: 3.4, out: 2.4, y0: groundHeight(x, z) + 0.15 }));
  }

  /* flags */
  const nodeObjs = flags.map((n) => makeFlagNode(n, gallery));
  nodeObjs.forEach((o) => {
    scene.add(o.group);
    addStatic(o.base.x, o.base.z, 0.32);
  });
  const byId = Object.fromEntries(nodeObjs.map((o) => [o.id, o]));
  const pickMeshes = nodeObjs.flatMap((o) => o.pickMeshes);

  /* signpost at the tee, pointing into the CV */
  scene.add(
    makeSignpost(4, 17, [
      { text: 'THE STUDIO', tx: -48, tz: -16 },
      { text: 'CLIENT WORK', tx: 46, tz: -20 },
      { text: 'TECH SKILLS', tx: -46, tz: 24 },
      { text: 'HIRE ME', tx: 6, tz: 44 },
    ]),
  );
  addStatic(4, 17, 0.3);

  /* route holograms */
  const holoObjs = holos.map((h) => {
    const obj = makeRouteHolo(h);
    scene.add(obj.group);
    addStatic(h.x, h.z, 0.35);
    return obj;
  });

  /* golfers */
  const homeBase = byId.profile.base;
  const golfers = [
    [-30, -28],
    [38, 8],
    [-12, 38],
    [-40, 10],
    [20, -30],
    [24, 26],
  ].map(([gx, gz], i) => {
    const g = makeGolfer(i);
    g.group.position.set(gx, groundHeight(gx, gz), gz);
    const homeYaw = hash2(gx, gz) * Math.PI * 2;
    g.group.rotation.y = homeYaw;
    scene.add(g.group);
    return {
      ...g,
      x: gx,
      z: gz,
      homeYaw,
      state: 'idle', // idle | practice | swing | flee | return
      swingT: 0,
      cooldown: 0,
      practiceIn: 3 + hash2(gx, i) * 6,
      fired: false,
      fleeVel: new THREE.Vector2(),
    };
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
      const pts = curve.getPoints(60);
      pts.forEach((p) => (p.y = groundHeight(p.x, p.z) + 0.08));
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
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
  cart.group.position.set(9, groundHeight(9, 20), 20);
  cart.group.rotation.y = 0.8;
  scene.add(cart.group);
  const cartState = { heading: 0.8, speed: 0 };

  const raycaster = new THREE.Raycaster();
  const up = new THREE.Vector3(0, 1, 0);
  const rollAxis = new THREE.Vector3();
  const rollQ = new THREE.Quaternion();

  /* ---------------- physics ---------------- */

  function smashRackA(fromX, fromZ) {
    for (const bag of bags) {
      if (bag.rack !== 'A' || bag.woken) continue;
      bag.woken = true;
      const bp = bag.group.position;
      const away = Math.atan2(bp.z - fromZ, bp.x - fromX) + (hash2(bp.x, 1) - 0.5) * 0.8;
      const power = 5 + hash2(bp.z, 2) * 5;
      bag.vel.set(Math.cos(away) * power, Math.sin(away) * power);
      bag.spin = (hash2(bp.x, 3) - 0.5) * 6;
      ejectClubs(bag, fromX, fromZ);
    }
    if (!rackADone) {
      rackADone = true;
      events.push({ type: 'fact', id: 'crates' });
    }
  }

  function collide(pos, vel, r, mode) {
    /* people */
    for (const w of walkers) {
      if (w.state === 'rag') continue;
      const wp = w.group.position;
      const dx = wp.x - pos.x;
      const dz = wp.z - pos.z;
      const d = Math.hypot(dx, dz) || 0.001;
      if (d < r + 0.5) {
        const impact = Math.max(2.5, Math.hypot(vel.x, vel.z));
        w.state = 'rag';
        w.ragT = 0;
        w.fallSign = hash2(wp.x, wp.z) > 0.5 ? 1 : -1;
        w.vel.set((dx / d) * impact * 0.9, (dz / d) * impact * 0.9);
        vel.x *= 0.8;
        vel.z *= 0.8;
        if (!npcToastDone) {
          npcToastDone = true;
          events.push({ type: 'npc' });
        }
      }
    }

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

        // rack-A bags are heavy: only a fast cart moves them
        if (b.kind === 'bag' && b.rack === 'A' && !b.woken) {
          if (mode === 'cart' && Math.hypot(vel.x, vel.z) > 5) {
            smashRackA(pos.x, pos.z);
            vel.x *= 0.6;
            vel.z *= 0.6;
            continue;
          }
          pos.x = bp.x + nx * min;
          pos.z = bp.z + nz * min;
          if (vn < 0) {
            vel.x -= 1.6 * vn * nx;
            vel.z -= 1.6 * vn * nz;
          }
          continue;
        }

        pos.x = bp.x + nx * min;
        pos.z = bp.z + nz * min;
        b.vel.x -= nx * (impact * 0.9 + 1.2);
        b.vel.y -= nz * (impact * 0.9 + 1.2);
        b.spin = (hash2(bp.x, bp.z) - 0.5) * impact * 2;
        vel.x *= 0.72;
        vel.z *= 0.72;

        if (!b.woken && impact > 1.6) {
          b.woken = true;
          if (b.kind === 'bench' && b.factId) events.push({ type: 'fact', id: b.factId });
          if (b.kind === 'bag' && b.rack === 'B') {
            ejectClubs(b, pos.x, pos.z);
            const downed = bags.filter((x) => x.rack === 'B' && x.woken).length;
            const total = bags.filter((x) => x.rack === 'B').length;
            if (downed >= total && !rackBDone) {
              rackBDone = true;
              events.push({ type: 'fact', id: 'tools' });
            } else {
              events.push({ type: 'bags', downed, total });
            }
          }
          if (b.kind === 'cone') {
            if (mode !== 'cart') {
              b.woken = false;
            } else {
              const downed = cones.filter((p) => p.woken).length;
              if (downed >= cones.length && !conesDone) {
                conesDone = true;
                events.push({ type: 'fact', id: 'cones' });
              } else {
                events.push({ type: 'cones', downed, total: cones.length });
              }
            }
          }
        }
      }
    }

    // the parked cart is solid to the ball
    if (mode === 'ball') {
      const cp = cart.group.position;
      const dx = pos.x - cp.x;
      const dz = pos.z - cp.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const min = r + 1.5;
      if (d < min) {
        const nx = dx / d;
        const nz = dz / d;
        pos.x = cp.x + nx * min;
        pos.z = cp.z + nz * min;
        const vn = vel.x * nx + vel.z * nz;
        if (vn < 0) {
          vel.x -= 1.5 * vn * nx;
          vel.z -= 1.5 * vn * nz;
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
      b.group.position.y = groundHeight(b.group.position.x, b.group.position.z);
      b.group.rotation.y += b.spin * dt;
      if ((b.kind === 'cone' || b.kind === 'bag') && sp > 2)
        b.group.rotation.z = Math.min(Math.PI / 2.15, b.group.rotation.z + sp * dt * 0.9);
      const damp = Math.exp(-2.6 * dt);
      b.vel.x *= damp;
      b.vel.y *= damp;
      b.spin *= damp;
      const e = Math.hypot(b.group.position.x / ISLAND.rx, b.group.position.z / ISLAND.rz);
      if (e > 1) {
        b.group.position.x /= e;
        b.group.position.z /= e;
        b.vel.x *= -0.4;
        b.vel.y *= -0.4;
      }
    }

    for (let i = debris.length - 1; i >= 0; i--) {
      const f = debris[i];
      if (f.resting) continue;
      f.life += dt;
      f.vel.y -= 22 * dt;
      f.mesh.position.addScaledVector(f.vel, dt);
      const gy = groundHeight(f.mesh.position.x, f.mesh.position.z) + f.restY;
      if (f.mesh.position.y < gy) {
        f.mesh.position.y = gy;
        f.vel.y *= -0.32;
        f.vel.x *= 0.66;
        f.vel.z *= 0.66;
      }
      f.mesh.rotation.x += f.ang.x * dt;
      f.mesh.rotation.y += f.ang.y * dt;
      f.mesh.rotation.z += f.ang.z * dt;
      if (f.life > 1 && f.vel.lengthSq() < 0.08 && Math.abs(f.mesh.position.y - gy) < 0.02) {
        // clubs come to rest lying flat and stay there
        f.mesh.rotation.x = Math.PI / 2;
        f.mesh.rotation.z = 0;
        f.resting = true;
      }
      if (!f.persistent && f.life > 3.8) {
        scene.remove(f.mesh);
        debris.splice(i, 1);
      }
    }
  }

  /* NPC brains: stroll / stand, panic when the cart hunts them */
  function updatePeople(dt, clock, st) {
    const threat = st.mode === 'cart' ? st.pos : null;

    for (const w of walkers) {
      const wp = w.group.position;
      const dThreat = threat ? Math.hypot(threat.x - wp.x, threat.z - wp.z) : Infinity;

      if (w.state !== 'rag' && w.state !== 'rise' && dThreat < 8) {
        w.state = 'flee';
      }

      if (w.state === 'walk') {
        if (!calm) w.t = (w.t + w.speed * dt) % 1;
        const p = w.curve.getPointAt(w.t);
        const tan = w.curve.getTangentAt(w.t);
        w.group.position.set(p.x, groundHeight(p.x, p.z), p.z);
        w.group.rotation.set(0, Math.atan2(tan.x, tan.z), 0);
        const swing = calm ? 0 : Math.sin(clock * 7 + w.phase) * 0.65;
        w.legL.rotation.x = swing;
        w.legR.rotation.x = -swing;
        w.armL.rotation.x = -swing * 0.8;
        if (w.armR) w.armR.rotation.x = swing * 0.8;
      } else if (w.state === 'stand') {
        const sway = calm ? 0 : Math.sin(clock * 1.2 + w.phase) * 0.06;
        w.group.rotation.z = sway * 0.4;
        w.legL.rotation.x = 0;
        w.legR.rotation.x = 0;
      } else if (w.state === 'flee') {
        if (!threat || dThreat > 13) {
          w.state = 'return';
        } else {
          const ang = Math.atan2(wp.x - threat.x, wp.z - threat.z);
          wp.x += Math.sin(ang) * 5.6 * dt;
          wp.z += Math.cos(ang) * 5.6 * dt;
          wp.y = groundHeight(wp.x, wp.z);
          const e = Math.hypot(wp.x / ISLAND.rx, wp.z / ISLAND.rz);
          if (e > 0.98) {
            wp.x /= e / 0.98;
            wp.z /= e / 0.98;
          }
          w.group.rotation.set(0, ang, 0);
          const pump = Math.sin(clock * 16 + w.phase) * 1;
          w.legL.rotation.x = pump;
          w.legR.rotation.x = -pump;
          w.armL.rotation.x = -2.6; // arms up, full panic
          if (w.armR) w.armR.rotation.x = -2.6;
        }
      } else if (w.state === 'return') {
        const target = w.curve
          ? w.curve.getPointAt(w.t)
          : new THREE.Vector3(w.home.x, 0, w.home.z);
        const dx = target.x - wp.x;
        const dz = target.z - wp.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.5) {
          w.state = w.curve ? 'walk' : 'stand';
          w.armL.rotation.x = 0;
          if (w.armR) w.armR.rotation.x = 0;
          w.group.rotation.z = 0;
        } else {
          wp.x += (dx / d) * 2.4 * dt;
          wp.z += (dz / d) * 2.4 * dt;
          wp.y = groundHeight(wp.x, wp.z);
          w.group.rotation.set(0, Math.atan2(dx, dz), 0);
          const swing = Math.sin(clock * 8 + w.phase) * 0.6;
          w.legL.rotation.x = swing;
          w.legR.rotation.x = -swing;
          w.armL.rotation.x = 0;
          if (w.armR) w.armR.rotation.x = 0;
        }
      } else if (w.state === 'rag') {
        w.ragT += dt;
        wp.x += w.vel.x * dt;
        wp.z += w.vel.y * dt;
        wp.y = groundHeight(wp.x, wp.z);
        const damp = Math.exp(-2.2 * dt);
        w.vel.x *= damp;
        w.vel.y *= damp;
        const fall = Math.min(1, w.ragT / 0.45);
        w.group.rotation.x = (-Math.PI / 2) * fall * w.fallSign;
        w.group.rotation.y += dt * 2.4 * (1 - fall) * w.fallSign;
        w.legL.rotation.x = 0.9 * fall;
        w.legR.rotation.x = -0.7 * fall;
        w.armL.rotation.x = -1.2 * fall;
        if (w.armR) w.armR.rotation.x = 1.1 * fall;
        if (w.ragT > 3) {
          w.state = 'rise';
          w.riseT = 0;
        }
      } else if (w.state === 'rise') {
        w.riseT += dt;
        const k = Math.min(1, w.riseT / 0.9);
        const ease = 1 - Math.pow(1 - k, 3);
        w.group.rotation.x = (-Math.PI / 2) * w.fallSign * (1 - ease);
        w.legL.rotation.x *= 1 - ease;
        w.legR.rotation.x *= 1 - ease;
        w.armL.rotation.x *= 1 - ease;
        if (w.armR) w.armR.rotation.x *= 1 - ease;
        if (k >= 1) w.state = 'return';
      }
    }

    for (const gf of golfers) {
      gf.cooldown = Math.max(0, gf.cooldown - dt);
      const gp = gf.group.position;
      const d = Math.hypot(gp.x - st.pos.x, gp.z - st.pos.z);
      const dThreat = threat ? Math.hypot(threat.x - gp.x, threat.z - gp.z) : Infinity;

      if (gf.state !== 'flee' && gf.state !== 'return' && dThreat < 8) {
        gf.state = 'flee';
      }

      if (gf.state === 'flee') {
        if (!threat || dThreat > 13) {
          gf.state = 'return';
        } else {
          const ang = Math.atan2(gp.x - threat.x, gp.z - threat.z);
          gp.x += Math.sin(ang) * 5.8 * dt;
          gp.z += Math.cos(ang) * 5.8 * dt;
          gp.y = groundHeight(gp.x, gp.z);
          const e = Math.hypot(gp.x / ISLAND.rx, gp.z / ISLAND.rz);
          if (e > 0.98) {
            gp.x /= e / 0.98;
            gp.z /= e / 0.98;
          }
          gf.group.rotation.y = ang;
          const pump = Math.sin(clock * 16) * 1;
          gf.legL.rotation.x = pump;
          gf.legR.rotation.x = -pump;
          gf.armL.rotation.x = -2.6;
          gf.swing.rotation.x = -2.6;
        }
        continue;
      }

      if (gf.state === 'return') {
        const dx = gf.x - gp.x;
        const dz = gf.z - gp.z;
        const dd = Math.hypot(dx, dz);
        if (dd < 0.4) {
          gf.state = 'idle';
          gf.group.rotation.y = gf.homeYaw;
          gf.legL.rotation.x = 0;
          gf.legR.rotation.x = 0;
          gf.armL.rotation.x = 0;
          gf.swing.rotation.x = -0.45;
        } else {
          gp.x += (dx / dd) * 2.6 * dt;
          gp.z += (dz / dd) * 2.6 * dt;
          gp.y = groundHeight(gp.x, gp.z);
          gf.group.rotation.y = Math.atan2(dx, dz);
          const swing = Math.sin(clock * 8) * 0.6;
          gf.legL.rotation.x = swing;
          gf.legR.rotation.x = -swing;
          gf.armL.rotation.x = 0;
          gf.swing.rotation.x = -0.45;
        }
        continue;
      }

      if (d < 9) gf.group.rotation.y = Math.atan2(st.pos.x - gp.x, st.pos.z - gp.z);

      if (gf.state === 'idle') {
        if (!calm) gf.swing.rotation.x = -0.45 + Math.sin(clock * 1.3 + gf.x) * 0.05;
        gf.practiceIn -= dt;
        if (st.mode === 'ball' && st.air < 0.2 && d < 2.8 && gf.cooldown <= 0) {
          gf.state = 'swing';
          gf.swingT = 0;
          gf.fired = false;
        } else if (gf.practiceIn <= 0 && d > 10 && !calm) {
          gf.state = 'practice';
          gf.swingT = 0;
        }
      } else {
        const isShot = gf.state === 'swing';
        const rate = isShot ? 1 : 0.45; // practice swings are lazy
        gf.swingT += dt * rate;
        const t = gf.swingT;
        if (t < 0.3) {
          gf.swing.rotation.x = -0.45 - (t / 0.3) * 2.1;
        } else if (t < 0.42) {
          gf.swing.rotation.x = -2.55 + ((t - 0.3) / 0.12) * 3.3;
          if (isShot && !gf.fired && t > 0.36) {
            gf.fired = true;
            const dx = homeBase.x - st.pos.x;
            const dz = homeBase.z - st.pos.z;
            const dist = Math.hypot(dx, dz) || 1;
            const vy = 15;
            const flight = (2 * vy) / 30;
            const power = Math.min(46, Math.max(18, (dist / flight) * 1.4));
            events.push({ type: 'shot', dx: dx / dist, dz: dz / dist, power, vy });
          }
        } else if (t < 1.3) {
          gf.swing.rotation.x = 0.75 - ((t - 0.42) / 0.88) * 1.2;
        } else {
          gf.swing.rotation.x = -0.45;
          gf.state = 'idle';
          gf.cooldown = isShot ? 3.5 : 0;
          gf.practiceIn = 4 + hash2(gf.x, clock) * 6;
        }
      }
    }
  }

  /* ---------------- per-frame ---------------- */

  function update(dt, clock, st) {
    pollen.material.uniforms.uTime.value = clock;
    water.material.uniforms.uTime.value = clock;
    grassTime.value = clock;

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

    if (!(st.mode === 'ball' && st.air > 0.8)) {
      collide(st.pos, st.vel, st.mode === 'cart' ? 1.5 : 0.5, st.mode);
    }
    stepDynamics(dt);
    updatePeople(dt, clock, st);

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
        if (!calm) o.holo.position.y = 8.4 + Math.sin(clock * 1.6) * 0.07;
        const dx = camera.position.x - o.group.position.x;
        const dz = camera.position.z - o.group.position.z;
        o.holo.rotation.y = Math.atan2(dx, dz);
      }
    }

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
        if (!calm) h.panel.position.y = 6.6 + Math.sin(clock * 1.3 + h.base.x) * 0.09;
        const dx = camera.position.x - h.base.x;
        const dz = camera.position.z - h.base.z;
        h.panel.rotation.y = Math.atan2(dx, dz);
        h.beam.rotation.y = h.panel.rotation.y;
      }
    }

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
        l.runner.position.y = groundHeight(l.runner.position.x, l.runner.position.z) + 0.14;
        l.runner.material.opacity = Math.sin(t * Math.PI) * 0.85;
      } else {
        l.runner.material.opacity = 0;
      }
    }

    for (let i = splashes.length - 1; i >= 0; i--) {
      const sp = splashes[i];
      sp.life += dt;
      const posAttr = sp.pts.geometry.attributes.position;
      for (let j = 0; j < sp.vels.length; j++) {
        const v = sp.vels[j];
        v.y -= 18 * dt;
        posAttr.array[j * 3] += v.x * dt;
        posAttr.array[j * 3 + 1] += v.y * dt;
        posAttr.array[j * 3 + 2] += v.z * dt;
      }
      posAttr.needsUpdate = true;
      sp.pts.material.opacity = Math.max(0, 0.95 - sp.life * 0.7);
      sp.rings.forEach((ring, ri) => {
        ring.scale.addScalar(dt * (4 + ri * 2.2));
        ring.material.opacity = Math.max(0, 0.75 - sp.life * (0.55 + ri * 0.12));
      });
      if (sp.life > 1.6) {
        scene.remove(sp.pts);
        sp.pts.geometry.dispose();
        sp.pts.material.dispose();
        sp.rings.forEach((ring) => {
          scene.remove(ring);
          ring.geometry.dispose();
          ring.material.dispose();
        });
        splashes.splice(i, 1);
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
    splash,
    puff,
    cartHome: { x: 9, z: 20, heading: 0.8 },

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
