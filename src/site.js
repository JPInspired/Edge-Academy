// The real surroundings of the Edge Academy: PaRK International School Alfragide (Amadora, Lisbon).
// Built from src/site-data.js (OpenStreetMap data turned into the model's coordinates by
// tools/site/build-site.mjs): the campus courtyard, PaRK's main building (white vertical fins over a dark,
// glazed ground floor on slanted pillars), the north building, the sports hall and pitch, the motorway
// (Estrada dos Cabos de Ávila) down the slope on the west, and the houses, flats and offices around.
// Heights and the slope are estimates from photographs; positions and outlines come from the map.
import * as THREE from 'three';
import { SITE } from './site-data.js';
import * as T from './textures.js';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { crookedTrunk } from './furniture.js';

const G = -0.06; // the courtyard level: flush with the ground floor (just below the floor finish)
const DROP = 5; // how far the motorway lies below the courtyard (estimate from street photographs)

// ── materials (tiled textures are sized in metres through userData.uv: [u size, v size]) ──
function mats() {
  const std = (color, o = {}) => {
    const { uv, ...rest } = o;
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...rest });
    if (uv) m.userData.uv = uv;
    return m;
  };
  return {
    grass: std(0xa9c47f, { map: T.grass(), uv: [6, 6], roughness: 1 }),
    ground: std(0xffffff, { map: T.speckle(), uv: [3, 3], roughness: 1, vertexColors: true }),
    slope: std(0x9fb06e, { map: T.grass(), uv: [5, 5], roughness: 1 }),
    paving: std(0xffffff, { map: T.plazaConcrete(), uv: [8, 8], roughness: 0.9 }),
    wallWin: std(0xffffff, { map: T.narrowWindows(), uv: [3, 3.5], roughness: 0.7, emissive: 0xffffff, emissiveMap: T.narrowWindowsGlow(), emissiveIntensity: 0 }),
    finWhite: std(0xf6f5f1, { roughness: 0.55 }),
    podium: std(0xf3f2ee, { roughness: 0.8 }),
    asphalt: std(0x8a8b8c, { map: T.asphalt(), uv: [5, 5], roughness: 1 }),
    footpath: std(0xd6d0c4, { map: T.paving(), uv: [1.2, 1.2], roughness: 0.95 }),
    pitch: std(0x4d8a45, { roughness: 0.9 }),
    water: std(0x5d8aa8, { roughness: 0.15, metalness: 0.1 }),
    lines: std(0xf3f3ef, { roughness: 0.7 }),
    fins: std(0xffffff, { map: T.fins(), uv: [2.4, 3.6], roughness: 0.6 }),
    darkGlass: std(0xffffff, { map: T.curtainWall(), uv: [1.5, 3.6], roughness: 0.15, metalness: 0.3, emissive: 0xffffff, emissiveMap: T.curtainWall(true), emissiveIntensity: 0 }),
    pillar: std(0x646a71, { roughness: 0.45, metalness: 0.35 }),
    roof: std(0xd4d2cc, { roughness: 0.95 }),
    tiles: std(0xc0623a, { map: T.tiles(), uv: [2, 2], roughness: 0.9 }),
    hall: std(0xffffff, { map: T.cladding('#eceeec'), uv: [4, 10], roughness: 0.7 }),
    hallRoof: std(0xf3f3f0, { roughness: 0.6 }),
    turf: std(0x3f9b3e, { map: T.turf(), uv: [10, 10], roughness: 0.95 }),
    net: new THREE.MeshStandardMaterial({ color: 0x1f2a24, transparent: true, opacity: 0.28, roughness: 1, side: THREE.DoubleSide, depthWrite: false }),
    pitchWall: std(0xf1f1ee, { roughness: 0.85 }),
    parkSign: new THREE.MeshStandardMaterial({ map: T.sign('PaRK', { color: '#8a8f94', w: 1024, h: 256, font: '600 190px "Segoe UI", Arial, sans-serif' }), transparent: true, roughness: 0.7 }),
    school: std(0xffffff, { map: T.bands('#f2f1ed', '#55697a'), uv: [6, 3.6], roughness: 0.75 }),
    office: std(0xffffff, { map: T.bands('#c9ccd0', '#3e5466'), uv: [6, 3.6], roughness: 0.5 }),
    flats: ['#f1ece2', '#efe2c4', '#f0d9cf', '#e9e9e4', '#e7dcc0'].map((c) => std(0xffffff, { map: T.punched(c), uv: [3.2, 3], roughness: 0.85 })),
    house: ['#f6f3ec', '#f3e8cf', '#efe9e1'].map((c) => std(0xffffff, { map: T.punched(c, true), uv: [3.2, 3], roughness: 0.85 })),
    fence: std(0x46524a, { roughness: 0.6, metalness: 0.4 }),
    railGrey: std(0xa9adb0, { roughness: 0.45, metalness: 0.5 }),
    stairGrey: std(0x8e9296, { roughness: 0.6, metalness: 0.3 }),
    stairDark: std(0x3a3e43, { roughness: 0.6, metalness: 0.3 }),
    precast: std(0xffffff, { map: T.precast(), uv: [2.5, 2.5], roughness: 0.95 }),
    rail: std(0xa7abae, { roughness: 0.35, metalness: 0.8 }),
    barrier: std(0xc9c7c0, { roughness: 0.9 }),
    stake: std(0x8a6b4a, { roughness: 1 }),
    wall: std(0xd9d6cf, { roughness: 0.95 }),
    trunkPine: std(0x6b4f3a, { roughness: 1 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff4dc }),
    bench: std(0xb08455, { roughness: 0.7 }),
    smoothConcrete: std(0xcfcfca, { roughness: 0.75 }),
    frameGrey: std(0x41464b, { roughness: 0.45, metalness: 0.5 }),
    timber: std(0xffffff, { map: T.slats(), uv: [1, 1], roughness: 0.85 }),
    slat: std(0xa58560, { roughness: 0.8 }),
    cabinWall: std(0xffffff, { map: T.cabin(), uv: [1.2, 2.9], roughness: 0.6 }),
    hallGlass: std(0x86aeb0, { roughness: 0.08, metalness: 0.55 }),
    soil: std(0x5a4636, { roughness: 1 }),
  };
}

// ── the ground: the courtyard level everywhere, falling to the motorway along it ──
const trunkSegs = [];
for (const r of SITE.roads) {
  if (r.k !== 'trunk' || r.w < 6) continue; // (the main carriageways, not the slip roads)
  for (let i = 0; i + 3 < r.p.length; i += 2) trunkSegs.push([r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3]]);
}
/** Distance to the nearest motorway carriageway, and whether the point is on the school's side of it. */
function nearTrunk(x, z) {
  let best = 1e9, near = true;
  for (const [ax, az, bx, bz] of trunkSegs) {
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(x - ax - t * dx, z - az - t * dz);
    if (d < best) {
      best = d;
      const side = dx * (z - az) - dz * (x - ax), schoolSide = dx * (10.5 - az) - dz * (4 - ax);
      near = Math.sign(side) === Math.sign(schoolSide);
    }
  }
  return { d: best, near };
}
const distTrunk = (x, z) => nearTrunk(x, z).d;
// where the slope meets the courtyard: just short of the Edge block's motorway-side wall
const EDGE_GAP = Math.min(distTrunk(-0.3, 0), distTrunk(-0.3, 10.5), distTrunk(-0.3, 21));
const FLAT_FROM = EDGE_GAP - 2.5;
const ROAD_HALF = 10.5;
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Ground height at (x, z), metres (the courtyard is G). */
export function groundHeight(x, z) {
  const { d, near } = nearTrunk(x, z);
  if (!near) return G - DROP; // across the motorway the land is level with the road
  return G - DROP * (1 - smooth(ROAD_HALF, FLAT_FROM, d));
}

// ── geometry helpers ──
function geom(pos, uv) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
/** Make every triangle face up (want = 1) or down (want = -1). */
function orient(g, want = 1) {
  const p = g.attributes.position.array, uv = g.attributes.uv.array;
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i + 3] - p[i], az = p[i + 5] - p[i + 2], bx = p[i + 6] - p[i], bz = p[i + 8] - p[i + 2];
    const ny = az * bx - ax * bz; // y of (B-A) x (C-A)
    if (Math.sign(ny) !== want && ny !== 0) {
      for (let c = 0; c < 3; c++) [p[i + 3 + c], p[i + 6 + c]] = [p[i + 6 + c], p[i + 3 + c]];
      const j = (i / 9) * 6;
      for (let c = 0; c < 2; c++) [uv[j + 2 + c], uv[j + 4 + c]] = [uv[j + 4 + c], uv[j + 2 + c]];
    }
  }
  g.computeVertexNormals();
  return g;
}
const ring = (p) => {
  const pts = [];
  for (let i = 0; i < p.length; i += 2) pts.push(new THREE.Vector2(p[i], p[i + 1]));
  if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
  return pts;
};
/** A flat-ish area: the outline triangulated, each point at the ground's height plus `lift`. */
function area(pts, mat, lift, yAt = groundHeight) {
  const tris = THREE.ShapeUtils.triangulateShape(pts, []);
  const [su, sv] = mat.userData.uv ?? [1, 1];
  const pos = [], uv = [];
  for (const t of tris) {
    for (const i of [t[0], t[2], t[1]]) {
      const p = pts[i];
      pos.push(p.x, yAt(p.x, p.y) + lift, p.y);
      uv.push(p.x / su, p.y / sv);
    }
  }
  return orient(geom(pos, uv), 1);
}
/** A ribbon along a polyline (roads, paths), following the ground. */
function ribbon(p, w, mat, lift) {
  const [su, sv] = mat.userData.uv ?? [1, 1];
  const pos = [], uv = [];
  let run = 0;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 0.01) continue;
    const nx = (-(bz - az) / L) * (w / 2), nz = ((bx - ax) / L) * (w / 2);
    const q = [[ax + nx, az + nz], [ax - nx, az - nz], [bx + nx, bz + nz], [bx - nx, bz - nz]];
    const y = q.map(([x, z]) => groundHeight(x, z) + lift);
    const u0 = run / sv, u1 = (run + L) / sv;
    for (const k of [0, 2, 1, 1, 2, 3]) {
      pos.push(q[k][0], y[k], q[k][1]);
      uv.push((k % 2 ? w : 0) / su, k < 2 ? u0 : u1);
    }
    run += L;
  }
  return pos.length ? orient(geom(pos, uv), 1) : null;
}
/** Walls of a footprint from y0 to y1, textured in metres (u along the wall, v up). */
function walls(pts, y0, y1, mat, vOffset = 0) {
  const [su, sv] = mat.userData.uv ?? [1, 1];
  let a2 = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; a2 += a.x * b.y - b.x * a.y; }
  const outwardKeep = a2 < 0; // (the face normal of A0,B0,B1 is (-dz, dx): outward when the area is negative)
  const pos = [], uv = [];
  let run = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const L = a.distanceTo(b);
    const u0 = run / su, u1 = (run + L) / su;
    const v0 = vOffset / sv, v1 = (vOffset + y1 - y0) / sv;
    const A0 = [a.x, y0, a.y], B0 = [b.x, y0, b.y], B1 = [b.x, y1, b.y], A1 = [a.x, y1, a.y];
    const tA0 = [u0, v0], tB0 = [u1, v0], tB1 = [u1, v1], tA1 = [u0, v1];
    const tri = outwardKeep ? [[A0, tA0], [B0, tB0], [B1, tB1], [A0, tA0], [B1, tB1], [A1, tA1]] : [[A0, tA0], [B1, tB1], [B0, tB0], [A0, tA0], [A1, tA1], [B1, tB1]];
    for (const [q, t] of tri) { pos.push(...q); uv.push(...t); }
    run += L;
  }
  return geom(pos, uv);
}
const flatRoof = (pts, y, mat, want = 1) => orient(area(pts, mat, 0, () => y), want);
function hipRoof(pts, y, h, mat) {
  // a simple hipped roof: every edge rises to the middle (good for the small, nearly square houses)
  const c = pts.reduce((a, p) => a.add(p.clone().divideScalar(pts.length)), new THREE.Vector2());
  const [su, sv] = mat.userData.uv ?? [1, 1];
  const pos = [], uv = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    pos.push(a.x, y, a.y, c.x, y + h, c.y, b.x, y, b.y);
    uv.push(a.x / su, a.y / sv, c.x / su, c.y / sv, b.x / su, b.y / sv);
  }
  return orient(geom(pos, uv), 1);
}
const footprintBase = (pts) => Math.min(...pts.map((p) => groundHeight(p.x, p.y)));
const hash = (pts) => Math.abs(Math.round(pts[0].x * 7 + pts[0].y * 13)) >>> 0;

// ── the umbrella pines (Pinus pinea, as beside the Edge block) and other trees ──
function pine(b, M, x, z, h = 13, seed = 1) {
  const y = groundHeight(x, z);
  b.pushRaw();
  const lean = ((seed * 37) % 10) / 100 - 0.05;
  b.cyl(0.22, 0.38, h - 1.5, x, y - 0.3, z, M.site.trunkPine, 10, lean, -lean * 0.6);
  // a few branches holding the flat crown
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + seed;
    b.cyl(0.07, 0.12, 2.6, x + Math.cos(a) * 0.9 + lean * h, y + h - 2.6, z + Math.sin(a) * 0.9, M.site.trunkPine, 6, Math.sin(a) * 0.7, -Math.cos(a) * 0.7);
  }
  b.pop();
  // the crown: a wide, flat canopy of leaf clumps
  let k = seed * 97;
  const r = () => ((k = (k * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const d = i === 0 ? 0 : 1.4 + r() * 2.4;
    b.models.push({ kind: 'canopy', x: x + lean * h + Math.cos(a) * d, y: y + h - 1.6 + r() * 0.9, z: z + Math.sin(a) * d, ry: r() * 6.28, h: 2.6 + r() * 0.8 });
  }
}

/** A tall maritime pine (Pinus pinaster): a straight trunk, the crown high up (as on the slope in front of the Edge block). */
function tallPine(b, M, x, z, h = 16, seed = 1) {
  const y = groundHeight(x, z);
  let k = seed * 131;
  const r = () => ((k = (k * 16807) % 2147483647) / 2147483647);
  b.pushRaw();
  const trunk = crookedTrunk(b, M.site.trunkPine, x, y - 0.3, z, h - 2, 0.3, 0.16, 3, 0.04 + r() * 0.1, r() * Math.PI * 2, r);
  b.pop();
  for (let i = 0; i < 9; i++) {
    const t = i / 8; // from the lowest branches up to the top
    const a = r() * Math.PI * 2;
    const d = (1 - t) * (1.2 + r() * 1.4) + 0.3;
    const yy = y + h * (0.45 + 0.5 * t) - 1;
    const c = trunk.at(yy);
    b.models.push({ kind: 'canopy', x: c.x + Math.cos(a) * d, y: yy, z: c.z + Math.sin(a) * d, ry: r() * 6.28, h: 2.0 + (1 - t) * 1.4 + r() * 0.5, w: 0.85 + r() * 0.4, tilt: [(r() - 0.5) * 0.3, (r() - 0.5) * 0.3] });
  }
}

export function buildSite(b, M, tree) {
  const S = (M.site = mats());
  b.label = 'site';
  b.pushRaw();
  // the ground, falling to the motorway: one smooth grid, finer near the building
  {
    const N = 160, half = 330;
    const [su, sv] = S.ground.userData.uv;
    const at = (i) => Math.sign(i - N / 2) * half * ((Math.abs(i - N / 2) / (N / 2)) ** 1.7);
    const pos = [], uv = [], index = [];
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const x = 4 + at(i), z = 10.5 + at(j);
        pos.push(x, groundHeight(x, z) - 0.02, z);
        uv.push(x / su, z / sv);
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i, b2 = a + 1, c = a + N + 1, d = c + 1;
        index.push(a, c, b2, b2, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(index);
    g.computeVertexNormals();
    if (g.attributes.normal.array[1] < 0) { // (make sure it faces up)
      for (let k = 0; k < index.length; k += 3) [index[k + 1], index[k + 2]] = [index[k + 2], index[k + 1]];
      g.setIndex(index);
      g.computeVertexNormals();
    }
    // the slope down to the motorway is mostly bare earth with patches of grass (as in the aerial photo)
    const nrm = g.attributes.normal.array, col = [];
    for (let k = 0; k < pos.length; k += 3) {
      const steep = 1 - nrm[k + 1]; // 0 flat … larger on the slope
      const x = pos[k], z = pos[k + 2];
      const patch = 0.5 + 0.5 * Math.sin(x * 0.37 + Math.sin(z * 0.23) * 2.1) * Math.cos(z * 0.29 - x * 0.11);
      const earth = Math.min(1, Math.max(0, steep * 9 - 0.15)) * (0.55 + 0.45 * patch);
      const gr = [0.2, 0.3, 0.09], ea = [0.5, 0.37, 0.24]; // grass, earth (linear colour)
      col.push(...gr.map((g, c) => g + (ea[c] - g) * earth));
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    b.add(g, S.ground);
  }
  // areas: the campus is paved; parks, verges and the pitch
  const order = { campus: 0, parking: 1, grass: 2, wood: 2, water: 3, pitch: 4 };
  for (const a of [...SITE.areas].sort((p, q) => order[p.k] - order[q.k])) {
    const pts = ring(a.p);
    if (pts.length < 3) continue;
    const mat = { campus: S.paving, parking: S.asphalt, grass: S.grass, wood: S.grass, water: S.water, pitch: S.pitch }[a.k];
    const lift = 0.01 + order[a.k] * 0.008;
    // the campus courtyard stays level (only the slope down to the motorway falls)
    b.add(area(pts, mat, lift), mat);
    if (a.k === 'pitch' && pitchNear(pts)) {
      for (const p of pts) p.x += 20; // (with the gym, 20 m further back)
      footballPitch(b, S, pts, lift);
      continue;
    }
    if (a.k === 'pitch') {
      // white lines round the pitch
      const g = ribbon([...a.p, a.p[0], a.p[1]], 0.12, S.lines, lift + 0.01);
      if (g) b.add(g, S.lines);
    }
  }
  // roads (asphalt), paths (paving); lane lines on the motorway
  for (const r of SITE.roads) {
    const mat = r.k === 'foot' ? S.footpath : S.asphalt;
    const g = ribbon(r.p, r.w, mat, r.k === 'foot' ? 0.05 : 0.04);
    if (g) b.add(g, mat);
    if (r.k === 'trunk' && r.oneway) {
      const lanes = Math.max(2, Math.round((r.w - 1) / 3.5));
      for (let l = 1; l < lanes; l++) {
        const off = -r.w / 2 + 0.5 + l * 3.5;
        // dashed lane lines: short ribbons offset from the centre line
        for (let i = 0; i + 3 < r.p.length; i += 2) {
          const ax = r.p[i], az = r.p[i + 1], bx = r.p[i + 2], bz = r.p[i + 3];
          const L = Math.hypot(bx - ax, bz - az);
          if (L < 1) continue;
          const tx = (bx - ax) / L, tz = (bz - az) / L, nx = -tz, nz = tx;
          for (let s = 0; s + 3 < L; s += 12) {
            const x0 = ax + tx * s + nx * off, z0 = az + tz * s + nz * off;
            const g2 = ribbon([x0, z0, x0 + tx * 4, z0 + tz * 4], 0.15, S.lines, 0.06);
            if (g2) b.add(g2, S.lines);
          }
        }
      }
    }
  }
  // fences along the top of the slope, walls
  for (const l of SITE.lines) {
    for (let i = 0; i + 3 < l.p.length; i += 2) {
      const ax = l.p[i], az = l.p[i + 1], bx = l.p[i + 2], bz = l.p[i + 3];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.05) continue;
      const y = Math.min(groundHeight(ax, az), groundHeight(bx, bz));
      const h = l.k === 'fence' ? 1.8 : l.k === 'hedge' ? 1.4 : 1.2;
      const mat = l.k === 'fence' ? S.fence : l.k === 'hedge' ? S.slope : S.wall;
      b._box(L, h, l.k === 'fence' ? 0.04 : 0.25, (ax + bx) / 2, y, (az + bz) / 2, mat, -Math.atan2(bz - az, bx - ax));
    }
  }
  // the motorway: crash barriers along both edges and tall curved lamp posts (the stretch in front of the school)
  for (const r of SITE.roads) {
    if (r.k !== 'trunk' || r.w < 6) continue;
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const ax = r.p[i], az = r.p[i + 1], bx = r.p[i + 2], bz = r.p[i + 3];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.5 || Math.hypot((ax + bx) / 2 - 4, (az + bz) / 2 - 10.5) > 170) continue;
      const tx = (bx - ax) / L, tz = (bz - az) / L, nx = -tz, nz = tx, ry = -Math.atan2(tz, tx);
      for (const side of [-1, 1]) {
        const o = side * (r.w / 2 + 0.4);
        const mx = (ax + bx) / 2 + nx * o, mz = (az + bz) / 2 + nz * o;
        const y = groundHeight(mx, mz);
        b._box(L, 0.32, 0.06, mx, y + 0.45, mz, S.rail, ry);
        for (let s2 = 0; s2 < L; s2 += 4) b._box(0.1, 0.75, 0.1, ax + tx * s2 + nx * o, y, az + tz * s2 + nz * o, S.rail);
      }
      // lamp posts every 40 m on the outer edge of each carriageway, arm over the road
      const outer = nearTrunk(ax + nx * 25, az + nz * 25).near ? 1 : -1; // which side faces the school
      for (let s2 = (i * 13) % 40; s2 < L; s2 += 40) {
        const o = outer * (r.w / 2 + 1.2);
        const px = ax + tx * s2 + nx * o, pz = az + tz * s2 + nz * o, py = groundHeight(px, pz);
        const ix = -nx * outer, iz = -nz * outer; // towards the road
        b.cyl(0.08, 0.12, 10, px, py, pz, S.rail, 8);
        b._box(2.2, 0.1, 0.1, px + ix * 1.0, py + 10, pz + iz * 1.0, S.rail, -Math.atan2(iz, ix));
        b._box(0.6, 0.15, 0.3, px + ix * 2.0, py + 9.92, pz + iz * 2.0, S.rail, -Math.atan2(iz, ix));
      }
    }
  }
  // the concrete barrier between the two carriageways, where they run side by side
  for (let z = -180; z < 200; z += 3) {
    const xs = [];
    for (const [ax, az, bx, bz] of trunkSegs) {
      if (Math.abs(bz - az) < 1e-3) continue;
      const t = (z - az) / (bz - az);
      if (t >= 0 && t <= 1) xs.push(ax + (bx - ax) * t);
    }
    xs.sort((p, q) => p - q);
    if (xs.length < 2 || xs.at(-1) - xs[0] > 30) continue;
    const mx = (xs[0] + xs.at(-1)) / 2;
    b._box(0.5, 0.8, 3.02, mx, groundHeight(mx, z), z, S.barrier);
  }
  // the campus boundary wall along the top of the slope: precast concrete panels about 2.5 m high
  for (const a of SITE.areas) {
    if (a.k !== 'campus') continue;
    const pts = ring(a.p);
    let a2 = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a2 += p.x * q.y - q.x * p.y; }
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const L = p.distanceTo(q);
      if (L < 0.5) continue;
      const tx = (q.x - p.x) / L, tz = (q.y - p.y) / L;
      const nx = a2 > 0 ? tz : -tz, nz = a2 > 0 ? -tx : tx; // outwards
      const mx = (p.x + q.x) / 2, mz = (p.y + q.y) / 2;
      const tr = nearTrunk(mx, mz);
      if (!tr.near || tr.d > 45) continue; // only the side facing the motorway
      const foot = Math.min(groundHeight(p.x + nx * 1.5, p.y + nz * 1.5), groundHeight(q.x + nx * 1.5, q.y + nz * 1.5), groundHeight(mx, mz));
      b._box(L + 0.3, G + 2.5 - foot + 0.3, 0.3, mx, foot - 0.3, mz, S.precast, -Math.atan2(tz, tx));
    }
  }
  // the slope: short wooden stakes and young trees on support stakes (newly planted)
  {
    let k = 5;
    const r = () => ((k = (k * 16807) % 2147483647) / 2147483647);
    for (let z = -40; z < 70; z += 2.6) {
      for (let x = -24; x < -2; x += 2.2) {
        const tr = nearTrunk(x, z);
        if (!tr.near || tr.d < ROAD_HALF + 1.5 || tr.d > FLAT_FROM - 1) continue;
        if (r() < 0.55) continue;
        const y = groundHeight(x, z);
        if (r() < 0.75) b._box(0.07, 0.9, 0.07, x + r() * 0.6, y - 0.1, z + r() * 0.6, S.stake);
        else {
          b._box(0.05, 1.8, 0.05, x - 0.2, y - 0.1, z, S.stake);
          b.models.push({ kind: 'canopy', x, y: y + 1.2 + r() * 0.5, z, ry: r() * 6.28, h: 0.9 + r() * 0.5 });
        }
      }
    }
  }
  // buildings
  for (const bl of SITE.buildings) {
    const pts = ring(bl.p);
    if (bl.k === 'hall') for (const p of pts) p.x += 20; // (the gym 20 m further back than the map: the courtyard at its real size)
    if (pts.length < 3) continue;
    const y0 = footprintBase(pts) - 0.3;
    const top = Math.max(G, y0) + bl.h;
    const pick = (list) => list[hash(pts) % list.length];
    if (bl.k === 'main') {
      // (the map outline is accurate to a metre or two: keep it clear of the Edge block, as in reality)
      for (const p of pts) if (p.y > -15 && p.y < 30 && p.x < 10.3) p.x = 10.3;
      mainBuilding(b, S, pts, y0);
      annexLink(b, S);
      platform(b, S, tree);
      continue;
    }
    if (bl.k === 'house') {
      const wallMat = pick(S.house);
      b.add(walls(pts, y0, top, wallMat), wallMat);
      if (pts.length <= 8) b.add(hipRoof(pts, top, 2.2, S.tiles), S.tiles);
      else b.add(flatRoof(pts, top, S.tiles), S.tiles);
      continue;
    }
    if (bl.k === 'roof') {
      // canopies (e.g. the petrol station): a thin roof on posts
      b.add(walls(pts, top - 0.6, top, S.roof), S.roof);
      b.add(flatRoof(pts, top, S.roof), S.roof);
      b.add(flatRoof(pts, top - 0.6, S.roof, -1), S.roof);
      for (const p of pts) b._box(0.3, top - 0.6 - y0, 0.3, p.x, y0, p.y, S.pillar);
      continue;
    }
    const mat = bl.k === 'hall' ? S.hall : bl.k === 'school' ? S.school : bl.k === 'flats' ? pick(S.flats) : S.office;
    b.add(walls(pts, y0, top, mat, -(Math.max(G, y0) - y0)), mat);
    const roofMat = bl.k === 'hall' ? S.hallRoof : S.roof;
    b.add(flatRoof(pts, top, roofMat), roofMat);
    if (bl.k === 'hall') {
      b.add(walls(pts, top, top + 0.6, S.hallRoof), S.hallRoof); // (a white parapet round the roof)
      // the long glazed band below the white top (as in the photographs), set just proud of the wall
      const c = pts.reduce((s2, p) => s2.add(p.clone().divideScalar(pts.length)), new THREE.Vector2());
      const out = pts.map((p) => c.clone().add(p.clone().sub(c).multiplyScalar(1 + 0.06 / Math.max(1, p.distanceTo(c)))));
      b.add(walls(out, top - 3.6, top - 1.3, S.hallGlass), S.hallGlass);
      // (the courtyard face: from the corner by the tiers to the far corner, whichever order the map lists them in)
      const near = (x, z) => pts.reduce((m, p2) => (p2.distanceTo(new THREE.Vector2(x, z)) < m.distanceTo(new THREE.Vector2(x, z)) ? p2 : m));
      gymRamp(b, S, near(66, 13.5), near(38.6, 51.8));
    }
  }
  // the courtyard: tall slim lamp posts, concrete benches with oak seats, and planters with small trees
  // (placed by eye from photographs; the entrance (x 8, z 2.5 to 4.3) stays clear)
  for (const [x, z] of [[13.5, 2], [13.5, 14], [13.5, 26], [22, 20], [24, 34], [16, 40]]) {
    if (insideAny(x, z)) continue;
    b.cyl(0.05, 0.07, 6.5, x, G, z, S.pillar, 10);
    b.solidM(x - 0.12, z - 0.12, x + 0.12, z + 0.12, 0);
    b._box(0.16, 0.5, 0.16, x, G + 6.3, z, S.pillar);
    b._box(0.12, 0.04, 0.12, x, G + 6.28, z, S.lamp);
  }
  for (const [x, z, r] of [[11.5, 9, 0], [11.5, 19.5, 0], [19, 27, 0.6], [15, 33, 1.2]]) {
    if (insideAny(x, z)) continue;
    b.solidM(x - 1.1, z - 0.6, x + 1.1, z + 0.6, 0);
    b._box(2.2, 0.42, 0.55, x, G, z, S.wall, r);
    b._box(2.2, 0.05, 0.5, x, G + 0.42, z, S.bench, r);
  }
  // round planter benches with a young tree, and concrete picnic tables (as in the photographs)
  // the planter by Edge: a concrete seat ring, timber cladding above, full of shrubs (as in the photographs)
  {
    const [x, z] = [17.5, 12];
    b.cyl(1.75, 1.75, 0.42, x, G, z, S.smoothConcrete, 36);
    b.cyl(1.4, 1.4, 0.55, x, G + 0.42, z, S.timber, 32);
    b.cyl(1.32, 1.32, 0.56, x, G + 0.42, z, S.soil, 24);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      b.models.push({ kind: 'shrub', x: x + Math.cos(a) * 0.55, y: G + 0.9, z: z + Math.sin(a) * 0.55, ry: a, h: 0.85, w: 1.5 });
    }
    b.solidM(x - 1.7, z - 1.7, x + 1.7, z + 1.7, 0);
  }
  // the other planter: concrete, with a young tree
  {
    const [x, z] = [18.5, 28];
    b.cyl(1.5, 1.5, 0.45, x, G, z, S.smoothConcrete, 32);
    b.solidM(x - 1.4, z - 1.4, x + 1.4, z + 1.4, 0);
    b.cyl(1.25, 1.25, 0.47, x, G, z, S.soil, 24);
  }
  // concrete picnic sets: a table and two benches, each a smooth inverted U (as in the photographs)
  const picnic = (x, z, r) => {
    const P = (dx, dz) => [x + dx * Math.cos(r) + dz * Math.sin(r), z - dx * Math.sin(r) + dz * Math.cos(r)];
    const C = S.smoothConcrete;
    b._box(1.9, 0.07, 0.72, x, G + 0.68, z, C, r, 0, 0, 0.03);
    for (const s2 of [-1, 1]) {
      const [lx, lz] = P(s2 * 0.91, 0);
      b._box(0.08, 0.7, 0.72, lx, G, lz, C, r, 0, 0, 0.03);
      const [bx2, bz2] = P(0, s2 * 0.64);
      b._box(1.9, 0.06, 0.36, bx2, G + 0.4, bz2, C, r, 0, 0, 0.025);
      for (const s3 of [-1, 1]) {
        const [qx, qz] = P(s3 * 0.91, s2 * 0.64);
        b._box(0.07, 0.42, 0.36, qx, G, qz, C, r, 0, 0, 0.025);
      }
    }
    b.solidM(x - 1.2, z - 1.2, x + 1.2, z + 1.2, 0);
  };
  for (const [x, z, r] of [[11.4, 6.9, 0], [11.4, 9.7, 0], [11.4, 12.5, 0], [19.5, 1.6, 0.1], [31, 24, -0.2], [36, 27, 0.9]]) if (!insideAny(x, z)) picnic(x, z, r);
  // the pergola outside Edge's glazing: anthracite steel posts and beams, timber slats running along the facade
  {
    const x0 = 8.9, x1 = 15.4, z0 = 5.3, z1 = 13.8, h = 3.0;
    for (const x of [x0 + 0.1, (x0 + x1) / 2, x1 - 0.1]) {
      for (const z of [z0 + 0.1, (z0 + z1) / 2, z1 - 0.1]) {
        b._box(0.1, h, 0.1, x, G, z, S.frameGrey);
        b.solidM(x - 0.1, z - 0.1, x + 0.1, z + 0.1, 0);
      }
      b._box(0.1, 0.16, z1 - z0, x, G + h - 0.16, (z0 + z1) / 2, S.frameGrey);
    }
    for (const z of [z0 + 0.1, z1 - 0.1]) b._box(x1 - x0, 0.12, 0.08, (x0 + x1) / 2, G + h - 0.28, z, S.frameGrey);
    for (let x = x0 + 0.05; x < x1; x += 0.15) b._box(0.09, 0.045, z1 - z0 + 0.2, x, G + h, (z0 + z1) / 2, S.slat);
  }
  // where visitors can walk outside: the courtyard in front of the entrance (invisible limits), clear of the
  // main building's glazing and the sports hall
  for (const [x0, z0, x1, z1] of [[8.3, -3.5, 30, -3], [29.5, -3.5, 30, 36], [8.3, 35.5, 30, 36], [15, -60, 40, 0], [-2, 21.35, 8.6, 36], [-2, -6, 8.3, -0.32]]) b.solidM(x0, z0, x1, z1, 0);
  b.pop();
  for (const [x, z] of [[17.5, 12], [18.5, 28]]) if (!insideAny(x, z)) tree(b, M, x, z, 0.8, Math.round(x * z), G + 0.6);
  // trees: the big umbrella pine beside the Edge block's north-west end, pines down the slope, and trees
  // in the parks and woods around
  pine(b, M, 1.5, -7.5, 14, 3); // (the umbrella pine at the north-west end, by the main building)
  // tall maritime pines on the slope in front of the Edge block (as seen from the motorway)
  for (const [x, z, h, sd] of [[-7, 2, 17, 4], [-8.5, 8.5, 15, 6], [-7.5, 13, 18, 8], [-8.5, 18.5, 16, 9], [-8, 27, 14, 12], [-9, -6, 15, 13]]) tallPine(b, M, x, z, h, sd);
  let seed = 11;
  for (const a of SITE.areas) {
    if (a.k !== 'wood' && a.k !== 'grass') continue;
    const pts = ring(a.p);
    const box = new THREE.Box2().setFromPoints(pts);
    const size = box.getSize(new THREE.Vector2());
    const close = Math.hypot(box.getCenter(new THREE.Vector2()).x - 4, box.getCenter(new THREE.Vector2()).y - 10.5) < 220;
    const want = Math.min(a.k === 'wood' ? (close ? 40 : 10) : close ? 8 : 3, Math.floor((size.x * size.y) / (a.k === 'wood' ? (close ? 120 : 250) : 600)));
    for (let i = 0, tries = 0; i < want && tries < 40; tries++) {
      const x = box.min.x + ((seed * 0.6180339) % 1) * size.x;
      const z = box.min.y + ((seed * 0.4142135) % 1) * size.y;
      seed++;
      if (!insidePoly(pts, x, z) || Math.hypot(x - 4, z - 10.5) < 25) continue;
      i++;
      if ((seed % 3) === 0) pine(b, M, x, z, 10 + (seed % 5), seed);
      else tree(b, M, x, z, 1.2, seed, groundHeight(x, z) + 0.4);
    }
  }
}

/** The footprint moved inwards by d metres (each corner along its bisector; fine for these right-angled outlines). */
function inset(pts, d) {
  let a2 = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; a2 += a.x * b.y - b.x * a.y; }
  const s = a2 > 0 ? 1 : -1; // which side is inside
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], c = pts[(i + 1) % n];
    const e1 = p.clone().sub(a).normalize(), e2 = c.clone().sub(p).normalize();
    const n1 = new THREE.Vector2(-e1.y, e1.x).multiplyScalar(s), n2 = new THREE.Vector2(-e2.y, e2.x).multiplyScalar(s);
    const m = n1.clone().add(n2);
    const k = m.lengthSq() < 1e-6 ? 0 : d / Math.max(0.35, m.normalize().dot(n1));
    return p.clone().addScaledVector(m.lengthSq() < 1e-6 ? n1 : m, k || d);
  });
}

/**
 * PaRK's main building, as in the photographs: a glazed ground floor with a white band above it, set back
 * under the building; the upper floors float above on clusters of slanted grey pillars, with white walls,
 * narrow paired windows, deep white fins every 75 cm and a ledge at every floor.
 */
/**
 * The Edge block is an annex of the main building: a one-storey glazed link joins its Reception end to the
 * main building's ground floor (glass on the courtyard side, the same white band on top, lit at dusk).
 */
const LINK = { x0: 8.45, x1: 15.2, z0: -5, z1: 0 }; // (its front on the same line as the main building's glazed ground floor: no step) // (behind Reception: Edge's entrance hall, src/building.js)
function annexLink(b, S) {
  const pts = [[LINK.x0, LINK.z0], [LINK.x1, LINK.z0], [LINK.x1, LINK.z1], [LINK.x0, LINK.z1]].map(([x, z]) => new THREE.Vector2(x, z));
  b.add(walls(pts, G, G + 3.6, S.darkGlass), S.darkGlass);
  b.add(walls(pts, G + 3.6, G + 4.8, S.podium), S.podium);
  b.add(flatRoof(pts, G + 4.8, S.roof), S.roof);
  b.add(flatRoof(pts, G + 3.6, S.podium, -1), S.podium); // its ceiling, seen through the glass
  b._box(LINK.x1 - LINK.x0, 0.06, LINK.z1 - LINK.z0, (LINK.x0 + LINK.x1) / 2, G, (LINK.z0 + LINK.z1) / 2, S.paving);
  b.solidM(LINK.x0, LINK.z0, LINK.x1, LINK.z1, 0);
  // the terrace on top of the white band (the "upper level" under the floating floors): a dark metal railing
  // along its courtyard edge, from the Edge block's wall along the front of the main building
  const y = G + 4.8, z = LINK.z1 - 0.15, x0 = 8.4, x1 = 27;
  b._box(x1 - x0, 0.05, 0.06, (x0 + x1) / 2, y + 1.05, z, S.railGrey);
  b._box(x1 - x0, 0.04, 0.05, (x0 + x1) / 2, y + 0.08, z, S.railGrey);
  for (let x = x0; x <= x1 + 0.01; x += 0.14) b._box(0.025, 1.0, 0.025, x, y + 0.08, z, S.railGrey); // upright bars
  for (let x = x0; x <= x1 + 0.01; x += 1.6) b._box(0.06, 1.1, 0.06, x, y, z, S.railGrey);
  // the grey zigzag outdoor stair beside the floating floors, on the terrace (as in the photographs)
  {
    const sx0 = 30.5, sx1 = 35.5, sz0 = -11, sz1 = -5, base = y, top = G + 18;
    b._box(0.3, top - base, sz1 - sz0, sx1, base, (sz0 + sz1) / 2, S.stairGrey); // the wall it climbs
    const flights = Math.round((top - base) / 3.5);
    for (let k = 0; k < flights; k++) {
      const y0 = base + k * 3.5;
      const up = k % 2 ? -1 : 1; // zigzag
      // landing slab with its solid grey parapet
      b._box(sx1 - sx0, 0.25, 1.6, (sx0 + sx1) / 2, y0 + 3.25, up > 0 ? sz1 - 0.8 : sz0 + 0.8, S.stairGrey);
      b._box(sx1 - sx0, 1.1, 0.12, (sx0 + sx1) / 2, y0 + 3.5, up > 0 ? sz1 : sz0, S.stairGrey);
      // the sloping flight (a tilted slab with its side panel)
      const L = Math.hypot(sz1 - sz0 - 1.6, 3.5);
      const tilt = Math.atan2(3.5, sz1 - sz0 - 1.6) * up;
      b._box(1.4, 0.2, L, sx0 + 0.9, y0 + 1.6, (sz0 + sz1) / 2, S.stairDark, 0, tilt);
      b._box(0.08, 1.0, L, sx0 + 0.2, y0 + 2.0, (sz0 + sz1) / 2, S.stairGrey, 0, tilt);
    }
  }
}

/**
 * The raised platform between the end of the main building and the gym (aerial photograph and site plan): at the
 * terrace's height, white retaining walls, paved on top with a railing along its courtyard edge, and a wide flight
 * of steps along it from the courtyard (by the gym's corner) up to the platform and the back of the gym and pitch.
 * Positions by eye from the photograph and plan.
 */
function platform(b, S, tree) {
  const top = G + 4.8;
  // The tiers climb alongside the gym's left (north-west) end wall, starting level with its front corner, a plain
  // stair against the wall and the seating tiers beside it; the platform's edge follows their top and north side.
  const V2 = THREE.Vector2;
  const gc = new V2(66, 13.5), gfar = new V2(95.3, 34.4); // the gym's front corner and the far end of that wall
  const u = gfar.clone().sub(gc).normalize(); // climbing, along the gym's end wall
  const v = new V2(u.y, -u.x); // across, away from the gym
  const tiers = 8, tierD = 0.9, run = tiers * tierD, W1 = 1.6, W2 = 8.4; // (the stair 0.1-1.6 m from the wall)
  const P = (t, o) => gc.clone().addScaledVector(u, t).addScaledVector(v, o);
  const T1 = P(run, 0), T2 = P(run, W2), B2 = P(0, W2);
  const F = B2.clone().addScaledVector(u, -B2.y / u.y); // where the tiers' north side, carried forward, meets z = 0
  const outline = [new V2(28.6, -15), new V2(82, -15), new V2(102, 12), gfar.clone(), T1, T2, B2, F, new V2(28.6, 0)];
  b.add(walls(outline, G - 0.5, top, S.podium), S.podium);
  b.add(flatRoof(outline, top, S.paving), S.paving);
  // the courtyard edge: the long glazed front (straight, then turning to meet the tiers), the terrace railing on top
  const front = (p, q) => {
    const L = p.distanceTo(q), dv = q.clone().sub(p).normalize();
    let n = new V2(-dv.y, dv.x);
    if (n.dot(new V2(30, 15).sub(p)) < 0) n.negate();
    const ry = -Math.atan2(dv.y, dv.x);
    const at = (t, o) => p.clone().addScaledVector(dv, t).addScaledVector(n, o);
    let c = at(L / 2, 0.04);
    b._box(L, 3.0, 0.04, c.x, G, c.y, S.darkGlass, ry);
    const m = Math.max(1, Math.round(L / 1.2));
    for (let k = 0; k <= m; k++) {
      c = at((L * k) / m, 0.06);
      b._box(0.07, 3.0, 0.08, c.x, G, c.y, S.frameGrey, ry);
    }
    c = at(L / 2, 0.06);
    for (const y of [2.4, 2.93]) b._box(L, 0.07, 0.08, c.x, G + y, c.y, S.frameGrey, ry);
    c = at(L / 2, 0.07);
    b._box(L, 0.14, 0.01, c.x, G + 1.05, c.y, S.podium, ry);
    for (let k = 3; k < m; k += 4) {
      c = at((L * (k + 0.5)) / m, 0.12);
      b._box(0.03, 0.03, 0.18, c.x, G + 1.0, c.y, S.rail, ry);
    }
    c = at(L / 2, 0);
    b._box(L, 0.05, 0.06, c.x, top + 1.05, c.y, S.railGrey, ry);
    for (let t = 0; t <= L + 0.001; t += 0.14) {
      c = at(t, 0);
      b._box(0.025, 1.0, 0.025, c.x, top + 0.05, c.y, S.railGrey);
    }
  };
  front(outline[8], F);
  front(F, B2);
  // the tiers and the stair
  const ryT = -Math.atan2(u.y, u.x);
  const block = (o0, o1, n, d) => {
    for (let i = 0; i < n; i++) {
      const depth = (n - i) * d;
      const c = P(run - depth / 2, (o0 + o1) / 2);
      b._box(depth, ((top - G) / n) * (i + 1), o1 - o0, c.x, G, c.y, S.wall, ryT);
    }
  };
  block(W1, W2, tiers, tierD);
  block(0.1, W1, 16, run / 16);
  // a couple of trees on the platform
  b.pop();
  tree(b, b.M, 52, -2, 1.1, 41, top);
  tree(b, b.M, 74, 2, 1.0, 43, top);
  b.pushRaw();
}

function mainBuilding(b, S, pts, y0) {
  const gf = G + 3.6, band = G + 4.8, under = G + 7.4, floors = 3, fh = 3.5, top = under + floors * fh;
  const inner = inset(pts, 2.4);
  // at the courtyard end the ground floor stands well back: the space under the floating floors is an open,
  // covered walkway among the pillars (as in the photographs)
  for (const p of inner) if (p.y > -20) { p.y = Math.min(p.y, 0); p.x = Math.max(p.x, 15); }
  b.add(walls(inner, y0, gf, S.darkGlass), S.darkGlass);
  b.add(walls(inner, gf, band, S.podium), S.podium);
  b.add(flatRoof(inner, band, S.roof), S.roof);
  // Above the ground floor the building has two parts (photographs): near the courtyard the finned floors float on
  // pillars over the open walkway; the long part beyond (from SPLIT on) sits on the terrace: a recessed glazed storey
  // at terrace level, then three white floors with slimmer fins (the grey outdoor stair stands along it).
  const front = clipZ(pts, SPLIT, 1), back = clipZ(pts, SPLIT, -1);
  if (back.length >= 3) longPart(b, S, back, band);
  pts = front;
  if (pts.length < 3) return;
  b.add(walls(pts, under, top, S.wallWin), S.wallWin);
  b.add(flatRoof(pts, top + 0.5, S.roof), S.roof);
  b.add(walls(pts, top, top + 0.5, S.podium), S.podium); // the parapet
  b.add(flatRoof(pts, under, S.podium, -1), S.podium); // the underside, seen from the courtyard
  let a2 = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a2 += p.x * q.y - q.x * p.y; }
  let seed = 7;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const L = p.distanceTo(q);
    if (L < 0.5 || (Math.abs(p.y - SPLIT) < 0.01 && Math.abs(q.y - SPLIT) < 0.01)) continue; // (not along the seam)
    const tx = (q.x - p.x) / L, tz = (q.y - p.y) / L;
    const nx = a2 > 0 ? tz : -tz, nz = a2 > 0 ? -tx : tx; // outwards
    const ry = -Math.atan2(tz, tx);
    const mx = (p.x + q.x) / 2, mz = (p.y + q.y) / 2;
    // a ledge at every floor and along the top
    for (let f = 0; f <= floors; f++) b._box(L + 0.5, 0.26, 0.55, mx + nx * 0.25, under + f * fh - (f ? 0.13 : 0), mz + nz * 0.25, S.finWhite, ry);
    // the fins
    const n = Math.max(1, Math.round(L / 0.75));
    for (let f = 0; f < floors; f++) {
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const drop = f === 0 ? 0.45 : 0; // (the lowest fins hang below the slab: a toothed edge)
        b._box(0.13, fh - 0.26 + drop, 0.5, p.x + (q.x - p.x) * t + nx * 0.25, under + f * fh + 0.13 - drop, p.y + (q.y - p.y) * t + nz * 0.25, S.finWhite, ry);
      }
    }
    // clusters of slanted pillars under the overhang (outside the set-back glazing)
    const m = Math.floor(L / 8.5);
    for (let k = 0; k <= m; k++) {
      const t = m ? 0.08 + (0.84 * k) / m : 0.5;
      const cx = p.x + (q.x - p.x) * t - nx * 1.3, cz = p.y + (q.y - p.y) * t - nz * 1.3;
      if (cx < 12.5 && cz > -4 && cz < 25) continue; // (none squeezed against the Edge block)
      if (cx > LINK.x0 - 1 && cx < LINK.x1 + 1 && cz > LINK.z0 - 1 && cz < LINK.z1 + 1) continue; // (nor in the link)
      b.solidM(cx - 1.0, cz - 1.0, cx + 1.0, cz + 1.0, 0); // (walk round the cluster)
      for (let j = 0; j < 3; j++) {
        const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const ax = (r() - 0.5) * 0.38, az = (r() - 0.5) * 0.38; // the slant
        const h = (under - y0) / Math.cos(Math.hypot(ax, az));
        b.cyl(0.13, 0.15, h, cx + (r() - 0.5) * 1.6, (y0 + under) / 2, cz + (r() - 0.5) * 1.6, S.pillar, 8, ax, az);
      }
    }
  }
}

const SPLIT = -15; // where the floating part meets the long part (z, model metres)

/** The part of a footprint on one side of z = at (side 1: z >= at, -1: z <= at). */
function clipZ(pts, at, side) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const pin = (p.y - at) * side >= 0, qin = (q.y - at) * side >= 0;
    if (pin) out.push(p.clone());
    if (pin !== qin) {
      const t = (at - p.y) / (q.y - p.y);
      out.push(new THREE.Vector2(p.x + (q.x - p.x) * t, at));
    }
  }
  return out;
}

/** The long part of the main building, on the terrace (see mainBuilding). */
function longPart(b, S, pts, band) {
  const glassTop = band + 3.4, floors = 3, fh = 3.5, top = glassTop + floors * fh;
  const inner = inset(pts, 1.6);
  b.add(walls(inner, band, glassTop, S.darkGlass), S.darkGlass); // the recessed glazed storey at terrace level
  b.add(flatRoof(pts, glassTop, S.podium, -1), S.podium);
  b.add(walls(pts, glassTop, top, S.wallWin), S.wallWin);
  b.add(walls(pts, top, top + 0.5, S.podium), S.podium);
  b.add(flatRoof(pts, top + 0.5, S.roof), S.roof);
  let a2 = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a2 += p.x * q.y - q.x * p.y; }
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const L = p.distanceTo(q);
    if (L < 0.5 || (Math.abs(p.y - SPLIT) < 0.01 && Math.abs(q.y - SPLIT) < 0.01)) continue;
    const tx = (q.x - p.x) / L, tz = (q.y - p.y) / L;
    const nx = a2 > 0 ? tz : -tz, nz = a2 > 0 ? -tx : tx;
    const ry = -Math.atan2(tz, tx);
    const mx = (p.x + q.x) / 2, mz = (p.y + q.y) / 2;
    for (let f = 0; f <= floors; f++) b._box(L + 0.3, 0.22, 0.35, mx + nx * 0.17, glassTop + f * fh - (f ? 0.11 : 0), mz + nz * 0.17, S.finWhite, ry);
    // slimmer fins, every 1.5 m
    const n = Math.max(1, Math.round(L / 1.5));
    for (let f = 0; f < floors; f++) {
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        b._box(0.1, fh - 0.22, 0.3, p.x + (q.x - p.x) * t + nx * 0.15, glassTop + f * fh + 0.11, p.y + (q.y - p.y) * t + nz * 0.15, S.finWhite, ry);
      }
    }
    // slim grey pillars on the terrace under the edge of the floors above
    const m = Math.floor(L / 6);
    for (let k = 1; k < m; k++) {
      const t = k / m;
      b.cyl(0.11, 0.12, glassTop - band, p.x + (q.x - p.x) * t - nx * 0.8, band, p.y + (q.y - p.y) * t - nz * 0.8, S.pillar, 8);
    }
  }
}

/**
 * Along the gym's courtyard face (photographs): a white concrete walkway at first-floor height on square white piers
 * with a galvanised railing, and from its end a concrete ramp coming down to the courtyard behind the classroom,
 * with railings on both sides. (p, q): the ends of that face, p at the courtyard's corner.
 */
function gymRamp(b, S, p, q) {
  const V2 = THREE.Vector2;
  const d = q.clone().sub(p).normalize();
  let n = new V2(-d.y, d.x);
  if (n.dot(new V2(30, 10).sub(p)) < 0) n.negate(); // (out, towards the courtyard)
  const ryW = -Math.atan2(d.y, d.x);
  const at = (t, o) => p.clone().addScaledVector(d, t).addScaledVector(n, o);
  const H = 2.6, t0 = 0.5, W = 2.0, R = 1.5;
  b.pushRaw();
  // a railing between two points, sloping from height ya to yb
  const railLine = (P0, P1, ya, yb) => {
    const L = P0.distanceTo(P1), dir = P1.clone().sub(P0).normalize();
    const ry = -Math.atan2(dir.y, dir.x), rz = Math.atan2(yb - ya, L);
    const m = P0.clone().lerp(P1, 0.5);
    for (const h of [1.05, 0.5]) b._box(Math.hypot(L, yb - ya), 0.045, 0.045, m.x, G + (ya + yb) / 2 + h - 0.02, m.y, S.rail, ry, 0, rz);
    for (let k = 0; k <= L + 0.001; k += 0.15) {
      const w = P0.clone().lerp(P1, k / L);
      b._box(0.02, 1.05, 0.02, w.x, G + ya + (k / L) * (yb - ya), w.y, S.rail, ry);
    }
  };
  // In plan, out from the face: the walkway (lane 0-2 m) along the face from the corner by the tiers, the ramp
  // (lane 2.1-3.6 m) beside it, rising from its foot towards the far end where a landing joins the two (the
  // switchback), and the classroom outside the ramp, parallel to it (as in the photographs)
  const tE = 18, RL = 14, tF = tE - RL, o1 = 2.1, o2 = o1 + R;
  let c = at((t0 + tE) / 2, W / 2);
  b._box(tE - t0, 0.25, W, c.x, G + H - 0.25, c.y, S.podium, ryW);
  c = at(tE + 0.8, o2 / 2);
  b._box(1.6, 0.25, o2, c.x, G + H - 0.25, c.y, S.podium, ryW); // the landing at the far end
  for (let t = t0 + 1; t < tE + 1.5; t += 4) {
    c = at(t, W - 0.25);
    b._box(0.35, H - 0.25, 0.35, c.x, G, c.y, S.podium, ryW);
    b.solidM(c.x - 0.3, c.y - 0.3, c.x + 0.3, c.y + 0.3, 0);
  }
  // the ramp, rising from its foot (tF) to the landing (tE), on posts
  c = at((tF + tE) / 2, (o1 + o2) / 2);
  b._box(Math.hypot(RL, H), 0.2, R, c.x, G + H / 2 - 0.1, c.y, S.smoothConcrete, ryW, 0, Math.atan2(H, RL));
  for (let t = tF + 3; t < tE; t += 3) {
    c = at(t, (o1 + o2) / 2);
    b._box(0.3, (H * (t - tF)) / RL - 0.15, 0.3, c.x, G, c.y, S.podium, ryW);
  }
  // railings: along the walkway's outer edge (between it and the ramp), both sides of the ramp, round the landing,
  // across the walkway's start
  railLine(at(t0, W - 0.05), at(tE, W - 0.05), H, H);
  railLine(at(tF, o1 + 0.05), at(tE, o1 + 0.05), 0, H);
  railLine(at(tF, o2 - 0.05), at(tE, o2 - 0.05), 0, H);
  railLine(at(tE, o2 - 0.05), at(tE + 1.6, o2 - 0.05), H, H);
  railLine(at(tE + 1.55, 0.05), at(tE + 1.55, o2 - 0.05), H, H);
  railLine(at(t0 + 0.05, 0.05), at(t0 + 0.05, W - 0.05), H, H);
  // the grey prefab classroom outside the ramp, parallel to it, its door at the end by the ramp's foot
  {
    const L = 12, D = 4, oc = o2 + 0.6 + D / 2, c2 = at(tF - 1 + L / 2, oc);
    b._box(L, 0.3, D, c2.x, G, c2.y, S.frameGrey, ryW);
    b._box(L, 2.9, D, c2.x, G + 0.3, c2.y, S.cabinWall, ryW);
    b._box(L + 0.3, 0.4, D + 0.3, c2.x, G + 3.2, c2.y, S.frameGrey, ryW);
    b._box(L, 0.02, D, c2.x, G + 3.6, c2.y, S.roof, ryW); // (its pale roof membrane, inside the grey fascia)
    for (let k = 0; k <= 6; k++) {
      const w = at(tF - 1 + (k / 6) * L, oc);
      b.solidM(w.x - 2, w.y - 2, w.x + 2, w.y + 2, 0);
    }
  }
  b.pop();
}

/** The school's own pitch (beside the gym), rather than the far-away ones. */
const pitchNear = (pts) => pts.some((p) => Math.hypot(p.x - 4, p.y - 10.5) < 140);

/**
 * PaRK's football pitch (as in the aerial photograph): bright artificial turf with white markings, a low white wall
 * with PaRK on the side facing the car park, tall posts with dark netting all round, and the car park in front.
 */
function footballPitch(b, S, pts, lift) {
  // its frame: the long side and the short side
  const e = [0, 1, 2, 3].map((i) => pts[(i + 1) % 4].clone().sub(pts[i]));
  const iLong = e[0].length() > e[1].length() ? 0 : 1;
  const c = pts.reduce((s, p) => s.add(p.clone().divideScalar(pts.length)), new THREE.Vector2());
  const u = e[iLong].clone().normalize(), v = new THREE.Vector2(-u.y, u.x);
  const L = e[iLong].length(), Wd = e[iLong + 1].length();
  const y = groundHeight(c.x, c.y) + lift;
  const P = (s, t) => new THREE.Vector2(c.x + u.x * s + v.x * t, c.y + u.y * s + v.y * t);
  b.add(area(pts, S.turf, lift), S.turf);
  // markings: the touchlines, the halfway line, the centre circle and the penalty areas
  const line = (a, d) => { const g = ribbon([a.x, a.y, d.x, d.y], 0.12, S.lines, lift + 0.012); if (g) b.add(g, S.lines); };
  const hl = L / 2 - 2, hw = Wd / 2 - 2;
  [[P(-hl, -hw), P(hl, -hw)], [P(hl, -hw), P(hl, hw)], [P(hl, hw), P(-hl, hw)], [P(-hl, hw), P(-hl, -hw)], [P(0, -hw), P(0, hw)]].forEach(([a, d]) => line(a, d));
  for (let k = 0; k < 24; k++) line(P(Math.cos((k / 24) * 6.283) * 6, Math.sin((k / 24) * 6.283) * 6), P(Math.cos(((k + 1) / 24) * 6.283) * 6, Math.sin(((k + 1) / 24) * 6.283) * 6));
  for (const sgn of [-1, 1]) {
    const x0 = sgn * hl, x1 = sgn * (hl - 11);
    [[P(x0, -12), P(x1, -12)], [P(x1, -12), P(x1, 12)], [P(x1, 12), P(x0, 12)]].forEach(([a, d]) => line(a, d));
  }
  // the low white wall, the posts and the netting all round
  const ry = -Math.atan2(u.y, u.x);
  const sides = [[0, -Wd / 2, L, 0], [0, Wd / 2, L, 0], [-L / 2, 0, Wd, Math.PI / 2], [L / 2, 0, Wd, Math.PI / 2]];
  for (const [s, t, len, turn] of sides) {
    const m = P(s, t);
    b._box(len, 1.4, 0.25, m.x, y - 0.05, m.y, S.pitchWall, ry - turn);
    b._box(len, 4.6, 0.02, m.x, y + 1.4, m.y, S.net, ry - turn);
    const n = Math.round(len / 4);
    for (let k = 0; k <= n; k++) {
      const q = turn ? P(s, -len / 2 + (k * len) / n) : P(-len / 2 + (k * len) / n, t);
      b._box(0.12, 6, 0.12, q.x, y, q.y, S.pillar);
    }
  }
  // PaRK on the wall facing the car park: the long side next to the access road (as in the site plan)
  const roadDist = (q) => {
    let best = 1e9;
    for (const r of SITE.roads) {
      if (r.k !== 'road') continue;
      for (let i = 0; i < r.p.length; i += 2) best = Math.min(best, Math.hypot(r.p[i] - q.x, r.p[i + 1] - q.y));
    }
    return best;
  };
  const far = roadDist(P(0, -Wd / 2)) < roadDist(P(0, Wd / 2)) ? -1 : 1;
  const sm = P(0, far * (Wd / 2 + 0.14));
  const sign = new THREE.PlaneGeometry(6, 1.5);
  b.add(sign.applyMatrix4(new THREE.Matrix4().makeRotationY(ry + (far < 0 ? Math.PI : 0)).setPosition(sm.x, y + 0.75, sm.y)), S.parkSign);
  // the car park along that side, with parked cars
  const depth = 16;
  const lot = [P(-L / 2, far * (Wd / 2 + 2)), P(L / 2, far * (Wd / 2 + 2)), P(L / 2, far * (Wd / 2 + 2 + depth)), P(-L / 2, far * (Wd / 2 + 2 + depth))];
  b.add(area(lot, S.asphalt, 0.03), S.asphalt);
  parkedCars.push(...[0, 1].flatMap((row) => {
    const out = [];
    for (let s = -L / 2 + 2; s < L / 2 - 2; s += 2.6) {
      if (((s * 7 + row * 3) | 0) % 5 === 0) continue; // a few empty bays
      const q = P(s, far * (Wd / 2 + 2 + 3 + row * 9));
      out.push({ x: q.x, z: q.y, ry: ry + Math.PI / 2 + (row ? Math.PI : 0) });
    }
    return out;
  }));
}
/** Cars parked in the school's car park (filled by footballPitch, drawn by makeTraffic). */
const parkedCars = [];

/** Is (x, z) inside any building on the map (so street furniture never ends up indoors)? */
function insideAny(x, z) {
  return SITE.buildings.some((bl) => insidePoly(ring(bl.p), x, z));
}

function insidePoly(pts, x, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], c = pts[j];
    if ((a.y > z) !== (c.y > z) && x < ((c.x - a.x) * (z - a.y)) / (c.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Day or dusk: at dusk the main building's windows and its glazed ground floor are lit (as in the photographs). */
export function siteDusk(M, on) {
  const S = M.site;
  if (!S) return;
  S.wallWin.emissiveIntensity = on ? 1.1 : 0;
  S.darkGlass.emissiveIntensity = on ? 0.9 : 0;
  S.lamp.color.set(on ? 0xffe2b0 : 0xfff4dc);
}

/** North in the model (for the mini-map). */
export const NORTH = SITE.north;

// ── traffic on the motorway: simple cars driving the real lanes (two instanced shapes, cheap on a headset) ──
/**
 * One car, in four parts drawn as instances: the painted body (a side profile with wheel arches, bonnet and boot,
 * extruded across the width, with the roof panel), the glass cabin, the wheels (tyres with silver hubs) and the
 * lights (white at the front, red at the back). Front towards +z, wheels on y = 0.
 */
function carGeometries() {
  const W = 1.72; // body width before the rounded edges
  const across = (shape, depth, bevel, segs = 3) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: segs });
    g.translate(0, 0, -depth / 2);
    g.rotateY(-Math.PI / 2); // (the profile's length runs along +z, the extrusion across the car)
    return toCreasedNormals(g, 0.7); // (smooth bodywork; real creases stay sharp)
  };
  const p = new THREE.Shape();
  p.moveTo(-2.18, 0.3);
  p.absarc(-1.35, 0.33, 0.42, Math.PI, 0, true);
  p.absarc(1.35, 0.33, 0.42, Math.PI, 0, true);
  p.lineTo(2.18, 0.3);
  p.quadraticCurveTo(2.27, 0.32, 2.26, 0.55);
  p.quadraticCurveTo(2.25, 0.78, 2.05, 0.84);
  p.lineTo(1.0, 0.96);
  p.lineTo(-1.75, 0.99);
  p.quadraticCurveTo(-2.2, 0.98, -2.24, 0.8);
  p.lineTo(-2.25, 0.5);
  p.quadraticCurveTo(-2.25, 0.3, -2.18, 0.3);
  const shell = across(p, W, 0.05);
  const roof = new THREE.BoxGeometry(1.5, 0.05, 1.2).translate(0, 1.42, -0.42).toNonIndexed();
  const body = mergeGeometries([shell, roof].map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; }), false);
  const gl = new THREE.Shape();
  gl.moveTo(1.02, 0.94);
  gl.lineTo(0.2, 1.4);
  gl.lineTo(-1.05, 1.42);
  gl.lineTo(-1.82, 0.97);
  gl.lineTo(1.02, 0.94);
  const glass = across(gl, 1.5, 0.03, 2);
  const tinted = (g, hex) => {
    const n = g.attributes.position.count;
    const c = new THREE.Color(hex);
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  };
  const parts = [];
  for (const sx of [-0.8, 0.8]) {
    for (const sz of [-1.35, 1.35]) {
      parts.push(tinted(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 9).rotateZ(Math.PI / 2).translate(sx, 0.33, sz).toNonIndexed(), 0x1b1b1d));
      parts.push(tinted(new THREE.CylinderGeometry(0.2, 0.2, 0.23, 7).rotateZ(Math.PI / 2).translate(sx, 0.33, sz).toNonIndexed(), 0xbfc3c7));
    }
  }
  const wheels = mergeGeometries(parts, false);
  const lamps = [];
  for (const sx of [-0.6, 0.6]) {
    lamps.push(tinted(new THREE.BoxGeometry(0.4, 0.09, 0.05).translate(sx, 0.64, 2.29).toNonIndexed(), 0xfff1cf));
    lamps.push(tinted(new THREE.BoxGeometry(0.34, 0.09, 0.05).translate(sx * 1.08, 0.74, -2.29).toNonIndexed(), 0xd0161a));
  }
  const lights = mergeGeometries(lamps, false);
  return { body, glass, wheels, lights };
}

export function makeTraffic(parent) {
  // join the motorway's map pieces into continuous one-way chains (a piece ends where the next starts)
  const ways = SITE.roads.filter((r) => r.k === 'trunk' && r.oneway).map((r) => ({ ...r, next: null, prev: null }));
  const key = (x, z) => `${Math.round(x)}:${Math.round(z)}`;
  const starts = new Map(ways.map((w) => [key(w.p[0], w.p[1]), w]));
  for (const w of ways) {
    const n = starts.get(key(w.p.at(-2), w.p.at(-1)));
    if (n && n !== w && !n.prev) { w.next = n; n.prev = w; }
  }
  const lanes = [];
  for (const w of ways) {
    if (w.prev) continue;
    const p = [];
    for (let c = w, guard = 0; c && guard < 50; c = c.next, guard++) for (let i = p.length ? 2 : 0; i < c.p.length; i += 2) p.push(c.p[i], c.p[i + 1]);
    const n = Math.max(2, Math.round((w.w - 1) / 3.5));
    for (let l = 0; l < n; l++) {
      const off = (l - (n - 1) / 2) * 3.4;
      const pts = [];
      for (let i = 0; i < p.length; i += 2) {
        const j = Math.min(i, p.length - 4);
        const tx = p[j + 2] - p[j], tz = p[j + 3] - p[j + 1];
        const L = Math.hypot(tx, tz) || 1;
        pts.push(new THREE.Vector3(p[i] - (tz / L) * off, 0, p[i + 1] + (tx / L) * off));
      }
      let len = 0;
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push((len += pts[i].distanceTo(pts[i - 1])));
      if (len > 60) lanes.push({ pts, cum, len, speed: 17 + l * 3.5 });
    }
  }
  const per = (lane) => Math.max(1, Math.floor(lane.len / 55));
  const moving = lanes.reduce((n, lane) => n + per(lane), 0);
  const count = moving + parkedCars.length;
  if (!count) return { update() {} };
  const G = carGeometries();
  const body = new THREE.InstancedMesh(G.body, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.55 }), count);
  const cabin = new THREE.InstancedMesh(G.glass, new THREE.MeshStandardMaterial({ color: 0x1d252c, roughness: 0.08, metalness: 0.6 }), count);
  const wheels = new THREE.InstancedMesh(G.wheels, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 }), count);
  const lights = new THREE.InstancedMesh(G.lights, new THREE.MeshBasicMaterial({ vertexColors: true }), count);
  const parts = [body, cabin, wheels, lights];
  const colours = [0xf2f2f0, 0x1c1c1e, 0x9aa1a8, 0x5d6670, 0xb3262e, 0x2b4b7a, 0xd8d8d4, 0x3d3f42];
  const cars = [];
  let i = 0;
  for (const lane of lanes) {
    const n = per(lane);
    for (let k = 0; k < n; k++) {
      cars.push({ lane, s: (lane.len * (k + ((i * 0.37) % 1) * 0.6)) / n, speed: lane.speed * (0.9 + ((i * 0.61) % 1) * 0.2) });
      body.setColorAt(i, new THREE.Color(colours[i % colours.length]));
      i++;
    }
  }
  // the parked cars (they never move)
  {
    const m = new THREE.Matrix4(), q2 = new THREE.Quaternion();
    parkedCars.forEach((c, k) => {
      const idx = moving + k;
      m.compose(new THREE.Vector3(c.x, groundHeight(c.x, c.z) + 0.04, c.z), q2.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.ry), new THREE.Vector3(1, 1, 1));
      for (const p of parts) p.setMatrixAt(idx, m);
      body.setColorAt(idx, new THREE.Color(colours[(idx * 3) % colours.length]));
    });
  }
  body.instanceColor.needsUpdate = true;
  for (const m of parts) {
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = true;
    parent.add(m);
  }
  const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const place = (car, idx) => {
    const { pts, cum, len } = car.lane;
    car.s %= len;
    let j = 1;
    while (j < cum.length - 1 && cum[j] < car.s) j++;
    const a = pts[j - 1], c = pts[j];
    const t = (car.s - cum[j - 1]) / Math.max(0.001, cum[j] - cum[j - 1]);
    pos.lerpVectors(a, c, t);
    pos.y = groundHeight(pos.x, pos.z) + 0.04;
    q.setFromAxisAngle(up, Math.atan2(c.x - a.x, c.z - a.z));
    mat.compose(pos, q, one);
    for (const p of parts) p.setMatrixAt(idx, mat);
  };
  cars.forEach(place);
  return {
    update(dt) {
      cars.forEach((car, idx) => {
        car.s += car.speed * dt;
        place(car, idx);
      });
      for (const p of parts) p.instanceMatrix.needsUpdate = true;
    },
  };
}
