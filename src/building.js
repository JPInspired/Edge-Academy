// Edge Academy, PaRK International School Alfragide: blockout built from the ZPZ Partners spatial concept (rev. 6).
// Room layout is written in "plan units" read off the drawings (8 x 21 grid, 1 unit = 1 m: the drawing
// is to scale), placed in the real campus by src/site.js.
//
// Axes: x = across the building (0 = west wall with the stair, facing the motorway (south-west on site);
//       8 = east facade with the entrance, onto the courtyard (north-east on site)),
//       z = along the building (0 = north end: Reception / Project Lab, south = Hub / Studio),
//       y = up (ground floor 0, first floor F1). Units: metres.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as T from './textures.js';
import { buildSite, makeTraffic, siteDusk } from './site.js';
import * as F from './furniture.js';
import { DETAIL } from './furniture.js';

const PW = 8; // plan width (plan units)
const PL = 21; // plan length
export const SX = 1.0; // plan -> metres across: the plan is drawn to scale (the Lab is 82.2 m², the Studio 74.6 m², the Hub 80.6 m² on the drawing), so 1 plan unit = 1 m (building 8 m wide inside)
export const SZ = 1.0; // plan -> metres along (21 m inside)
// lighter assets on standalone headsets and phones
export const LOW = typeof navigator !== 'undefined' && /OculusBrowser|Quest|Pico|Mobile|Android/i.test(navigator.userAgent);
export const F1 = 4.0; // first floor level (23 risers x 17.4 cm)
const CEIL = 3.1; // clear ceiling height
const W = PW;
const L = PL;
const STAIR = { x0: 0, x1: 1.5, z0: 3.4, z1: 10.2 };

// ---------------------------------------------------------------- builder
// Top-level calls take plan units (scaled to metres). Inside push()/pop() everything is local metres.
class Builder {
  constructor() {
    this.layers = new Map(); // layer name -> (material -> geometries); "" = the fixed building
    this.layer = "";
    this.colliders = [];
    this.prims = [];
    this.item = 0;
    this.label = 'misc';
    this.m = new THREE.Matrix4();
    this.stack = [];
  }
  get top() {
    return this.stack.length === 0;
  }
  push(x = 0, y = 0, z = 0, ry = 0) {
    if (this.top) {
      x *= SX;
      z *= SZ;
      this.item++;
    }
    this.stack.push(this.m.clone());
    this.m = this.m.clone().multiply(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z));
  }
  // enter a group whose coordinates are already metres
  pushRaw() {
    this.item++;
    this.stack.push(this.m.clone());
  }
  pop() {
    this.m = this.stack.pop();
  }
  add(geo, mat, local) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', ...(mat.vertexColors ? ['color'] : [])].includes(k)) g.deleteAttribute(k);
    const mm = this.m.clone();
    if (local) mm.multiply(local);
    g.applyMatrix4(mm);
    if (!mat.userData.decal) {
      g.computeBoundingBox();
      this.prims.push({ box: g.boundingBox.clone(), item: this.top ? ++this.item : this.item, label: this.label });
    }
    const layer = this.layer || "";
    if (!this.layers.has(layer)) this.layers.set(layer, new Map());
    const buckets = this.layers.get(layer);
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat).push(g);
  }
  _box(w, h, d, x, y, z, mat, ry = 0, rx = 0, rz = 0, round = 0) {
    const r = Math.min(round, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    const g = r > 0.002 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
    worldUV(g, w, h, d, mat);
    const l = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y + h / 2, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    );
    this.add(g, mat, l);
  }
  // w x h x d box; (x, z) centre, y = bottom
  box(w, h, d, x, y, z, mat, ry = 0, rx = 0, rz = 0) {
    if (this.top) [x, z] = [x * SX, z * SZ];
    this._box(w, h, d, x, y, z, mat, ry, rx, rz, 0);
  }
  // rounded box (softer, more real-looking edges)
  rbox(w, h, d, x, y, z, mat, round = 0.02, ry = 0, rx = 0) {
    if (this.top) [x, z] = [x * SX, z * SZ];
    this._box(w, h, d, x, y, z, mat, ry, rx, 0, round);
  }
  // box from min/max corners (at top level the extents are plan units)
  bx(x0, x1, y0, y1, z0, z1, mat) {
    if (this.top) [x0, x1, z0, z1] = [x0 * SX, x1 * SX, z0 * SZ, z1 * SZ];
    this._box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2, mat);
  }
  cyl(rTop, rBot, h, x, y, z, mat, seg = 16, rx = 0, rz = 0, extra = {}) {
    if (this.top) [x, z] = [x * SX, z * SZ];
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, extra.open || false, extra.t0 || 0, extra.tl || Math.PI * 2);
    const l = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y + (rx || rz ? 0 : h / 2), z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, extra.ry || 0, rz, 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    );
    this.add(g, mat, l);
  }
  sphere(r, x, y, z, mat, sy = 1, seg = 10) {
    if (this.top) [x, z] = [x * SX, z * SZ];
    this.add(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), mat, new THREE.Matrix4().makeScale(1, sy, 1).setPosition(x, y, z));
  }
  ico(r, x, y, z, mat, sx = 1, sy = 1, sz = 1, detail = 1) {
    if (this.top) [x, z] = [x * SX, z * SZ];
    this.add(new THREE.IcosahedronGeometry(r, detail), mat, new THREE.Matrix4().makeScale(sx, sy, sz).setPosition(x, y, z));
  }
  geo(g, mat, x, y, z, ry = 0) {
    if (this.top) [x, z] = [x * SX, z * SZ];
    this.add(g, mat, new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z));
  }
  // soft contact shadow on the floor (w x d metres)
  blob(w, d, x, y, z, ry = 0) {
    if (this.top) [x, z] = [x * SX, z * SZ];
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    this.add(g, this.M.blob, new THREE.Matrix4().makeRotationY(ry).setPosition(x, y + 0.004, z));
  }
  // walkable-space blocker, plan units, level 0 / 1 / undefined (= both)
  solid(x0, z0, x1, z1, level) {
    this.solidM(x0 * SX, z0 * SZ, x1 * SX, z1 * SZ, level);
  }
  // same, in metres
  solidM(x0, z0, x1, z1, level) {
    this.colliders.push({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1), level });
  }
  // returns { layerName: Group } for every named layer (e.g. toggleable furniture)
  finish(parent) {
    const groups = {};
    for (const [layer, buckets] of this.layers) {
      const target = layer ? (groups[layer] = new THREE.Group()) : parent;
      if (layer) {
        target.name = layer;
        parent.add(target);
      }
      for (const [mat, geos] of buckets) {
      const g = mergeGeometries(geos, false);
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = !mat.transparent && !mat.userData.noShadow;
      mesh.receiveShadow = !mat.userData.unlit;
      if (mat.userData.decal) mesh.renderOrder = -1;
      mesh.matrixAutoUpdate = false;
      target.add(mesh);
      }
    }
    return groups;
  }
}

// Scale box UVs to metres so tiled textures keep a real-world size.
function worldUV(g, w, h, d, mat) {
  const s = mat.userData.uv;
  if (!s) return;
  const uv = g.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const per = uv.count / 6;
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < per; i++) {
      const k = f * per + i;
      uv.setXY(k, (uv.getX(k) * faces[f][0]) / s[0], (uv.getY(k) * faces[f][1]) / s[1]);
    }
  }
}

// Report places where two different objects intersect by more than `tol` metres on every axis.
export function findOverlaps(prims, tol = 0.02) {
  const list = prims.filter((p) => p.box.max.x - p.box.min.x < 60).sort((a, b) => a.box.min.x - b.box.min.x);
  const hits = new Map();
  for (let i = 0; i < list.length; i++) {
    const A = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const B = list[j];
      if (B.box.min.x > A.box.max.x - tol) break;
      if (A.item === B.item) continue;
      if (A.label === 'arch' && B.label === 'arch') continue;
      const ox = Math.min(A.box.max.x, B.box.max.x) - Math.max(A.box.min.x, B.box.min.x);
      const oy = Math.min(A.box.max.y, B.box.max.y) - Math.max(A.box.min.y, B.box.min.y);
      const oz = Math.min(A.box.max.z, B.box.max.z) - Math.max(A.box.min.z, B.box.min.z);
      if (ox > tol && oy > tol && oz > tol) {
        const key = Math.min(A.item, B.item) + ':' + Math.max(A.item, B.item);
        const depth = Math.min(ox, oy, oz);
        const prev = hits.get(key);
        if (!prev || prev.depth < depth) {
          const c = new THREE.Vector3();
          A.box.clone().intersect(B.box).getCenter(c);
          hits.set(key, { a: A.label, b: B.label, depth: +depth.toFixed(3), at: c.toArray().map((v) => +v.toFixed(2)) });
        }
      }
    }
  }
  return [...hits.values()].sort((p, q) => q.depth - p.depth);
}

// ---------------------------------------------------------------- materials
function std(color, extra = {}) {
  const { uv, noShadow, ...opts } = extra;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...opts });
  if (uv) m.userData.uv = uv;
  if (noShadow) m.userData.noShadow = true;
  return m;
}
function unlit(map, extra = {}) {
  const m = new THREE.MeshBasicMaterial({ map, ...extra });
  m.userData.unlit = true;
  m.userData.noShadow = true;
  return m;
}

function materials(manager) {
  // photo-scanned PBR sets: colour (sRGB), OpenGL normal map, roughness
  const tl = new THREE.TextureLoader(manager);
  const photo = (id) => {
    const load = (n, srgb) => {
      const t = tl.load(`assets/textures/${id}/${n}.jpg`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    return { map: load('diff', true), normalMap: load('nor'), roughnessMap: load('rough') };
  };
  const P = {
    floor: photo('laminate_floor_02'),
    oak: photo('oak_veneer_01'),
    wool: photo('poly_wool_herringbone'),
    plaster: photo('plaster_grey_04'),
    pavers: photo('concrete_pavers_02'),
    grass: photo('leafy_grass'),
    asphalt: photo('asphalt_02'),
    concrete: photo('painted_concrete'),
  };
  P.wool.normalMap.repeat.set(3, 3);
  P.wool.roughnessMap.repeat.set(3, 3);
  const tex = {
    floor: T.woodFloor(),
    ceil: T.woodWool(),
    paving: T.paving(),
    fabric: T.fabric(),
    plaster: T.plaster(),
    grass: T.grass(),
    asphalt: T.asphalt(),
    leaves: T.leaves(),
  };
  tex.fabric.repeat.set(2, 2);
  const wv = T.weave();
  const gr = T.grain();
  for (const t of [wv.map, wv.normal]) t.repeat.set(7, 7);
  for (const t of [gr.normal, gr.rough]) t.repeat.set(5, 5);
  // fabric: light procedural weave for colour, real wool normal/roughness for the relief
  // upholstery: woven, with the soft sheen real fabric has at grazing angles (it is what keeps it from looking like clay)
  const fab = (color) => new THREE.MeshPhysicalMaterial({ color, map: wv.map, roughness: 1, normalMap: wv.normal, normalScale: new THREE.Vector2(0.9, 0.9), sheen: 1, sheenRoughness: 0.7, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.3) });
  // moulded plastic and laminate: a fine grain breaks up the light (no more plasticine)
  const plastic = (color, rough = 0.32) => std(color, { roughness: rough, roughnessMap: gr.rough, normalMap: gr.normal, normalScale: new THREE.Vector2(0.12, 0.12), envMapIntensity: 1.25 });
  const laminate = (color, rough = 0.32, extra = {}) => std(color, { roughness: rough, roughnessMap: gr.rough, normalMap: gr.normal, normalScale: new THREE.Vector2(0.05, 0.05), envMapIntensity: 1.15, ...extra });
  const paint = (color, uvs = [2.5, 2.5], rough = 0.95) => std(color, { map: tex.plaster, uv: uvs, roughness: rough, normalMap: P.plaster.normalMap, normalScale: new THREE.Vector2(0.35, 0.35) });
  const wood = (color, rough = 0.85) => std(color, { map: P.oak.map, normalMap: P.oak.normalMap, roughnessMap: P.oak.roughnessMap, roughness: rough, uv: [1, 1] });
  const M = {
    floor: std(0xffffff, { ...P.floor, uv: [1.6, 1.6], roughness: 1, normalScale: new THREE.Vector2(0.6, 0.6) }), // (tinted lighter below: the renders' blond oak)
    ceil: std(0xffffff, { map: tex.ceil, uv: [1.2, 1.2], roughness: 1, bumpMap: tex.ceil, bumpScale: 1.5 }),
    wall: paint(0xedebe6),
    ext: paint(0xf1efea, [3, 3], 0.9),
    slab: std(0xe4e2dc, { roughness: 0.9 }),
    skirting: std(0xf3f2ee, { roughness: 0.6 }),
    sage: paint(0xa0ae92),
    terracotta: paint(0xb05843, [2.5, 2.5], 0.8),
    rose: paint(0xc9938a, [2.5, 2.5], 0.85),
    grey: std(0xcfd1d0, { roughness: 0.8 }),
    oak: wood(0xffffff),
    oakDark: wood(0xb08a60),
    white: laminate(0xf1efe9),
    offWhite: laminate(0xe7e3da, 0.6),
    black: std(0x1d1e21, { roughness: 0.5 }),
    frame: std(0x3e4348, { roughness: 0.45, metalness: 0.5 }), // (anthracite grey, as in the photographs)
    frameGreen: std(0x3d4939, { roughness: 0.45, metalness: 0.5 }),
    chrome: std(0xd6d9dd, { roughness: 0.22, metalness: 1 }),
    steelGrey: std(0x8d929a, { roughness: 0.35, metalness: 0.7 }),
    labGrey: laminate(0xa9b3bf, 0.55),
    labTop: laminate(0x8e939e, 0.5),
    stair: std(0xd5d1c8, { roughness: 0.8 }),
    olive: fab(0x7a8253),
    sofaGreen: fab(0x727d55),
    paleGreen: fab(0xc4d2ad),
    plasticMint: plastic(0xa8c3b3),
    plasticBlue: plastic(0x8fa3bd),
    plasticPink: plastic(0xc3a0a9),
    plasticGrey: plastic(0xb8c2bc),
    plasticYellow: plastic(0xe0bd40),
    plasticBeige: plastic(0xb19a83),
    dustyBlue: std(0x8fa2bc, { roughness: 0.6 }),
    pouf1: fab(0xe0c886),
    pouf2: fab(0x98a189),
    pouf3: fab(0xb27f74),
    pouf4: fab(0xb7bbc1),
    rug: fab(0xbd7c5d),
    kraft: std(0xc8ab80, { roughness: 0.95 }),
    bin: std(0xa7adb3, { roughness: 0.35, transparent: true, opacity: 0.85 }),
    plant: std(0xffffff, { map: tex.leaves, roughness: 0.75 }),
    pot: std(0xd6d1c8, { roughness: 0.7 }),
    podBlue: fab(0x7f91a7), // (made two-sided below: the pods are lined with it)
    podWhite: laminate(0xefede8, 0.42, { side: THREE.DoubleSide }),
    greenScreen: fab(0x3ea847),
    curtain: fab(0x1b1b1d),
    toilet: std(0xffffff, { roughness: 0.15 }),
    door: wood(0xd8cdbc, 0.55),
    sticky: std(0xf3e36a),
    stickyPink: std(0xf2a3b5),
    cutMat: std(0xffffff, { map: T.cuttingMat(), roughness: 0.75 }),
    lobbyWall: paint(0xe9dec3),
    hallCeil: std(0x46484b, { roughness: 0.9 }),
    doorWhite: laminate(0xf3f2ee),
    fireRed: std(0xc4262c, { roughness: 0.4 }),
    exitGreen: std(0x16a05a, { roughness: 0.5, emissive: 0x0b6b36, emissiveIntensity: 0.6 }),
    plasticCharcoal: plastic(0x3e4146),
    screenBlack: std(0x101113, { roughness: 0.25, metalness: 0.3 }),
    grass: std(0xb4d08c, { ...P.grass, uv: [3, 3], roughness: 1 }),
    asphalt: std(0xffffff, { ...P.asphalt, uv: [3, 3], roughness: 1 }),
    paving: std(0xffffff, { ...P.pavers, uv: [1.1, 1.1], roughness: 1 }),
    curb: std(0xd8d5cd, { ...P.concrete, uv: [1, 1], roughness: 1 }),
    lines: std(0xf1f1ee, { roughness: 0.8 }),
    neighbour: std(0xeeece6, { map: tex.plaster, uv: [4, 4], roughness: 0.85 }),
    darkGlass: std(0x3b4a56, { roughness: 0.08, metalness: 0.5 }),
    trunk: std(0x5f4b3a, { roughness: 1 }),
    leaf1: std(0xffffff, { map: tex.leaves, roughness: 0.9 }),
    leaf2: std(0xc9d6a4, { map: tex.leaves, roughness: 0.9 }),
    leaf3: std(0x9bb27c, { map: tex.leaves, roughness: 0.9 }),
    led: unlit(null, { color: 0xffffff, toneMapped: false }),
    glass: new THREE.MeshStandardMaterial({ color: 0xdfeaee, transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 2 }),
    blob: new THREE.MeshBasicMaterial({ map: T.blob(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    edge: new THREE.MeshBasicMaterial({ map: T.edgeShade(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  };
  M.glass.userData.noShadow = true;
  for (const k of ['blob', 'edge']) Object.assign(M[k].userData, { decal: true, unlit: true, noShadow: true });
  const tm = (t, extra = {}) => std(0xffffff, { map: t, roughness: 0.35, ...extra });
  M.ceil.color.setRGB(1.35, 1.3, 1.22); // the pale wood-wool ceiling of the renders
  M.podBlue.side = THREE.DoubleSide; // (the felt lining is seen from inside the pods)
  M.floor.color.setRGB(1.45, 1.32, 1.12); // a light, blond oak, as in the concept renders (the photo texture is darker)
  // whiteboards: all clean (one shared material); the terracotta writable wall in the Hub too
  const cleanBoard = tm(T.board(1, { blank: true }), { roughness: 0.25 });
  M.boards = [cleanBoard, cleanBoard, cleanBoard, cleanBoard, cleanBoard, cleanBoard];
  M.boardRobotica = cleanBoard;
  M.boardStrategy = cleanBoard;
  M.terraBoard = tm(T.board(21, { bg: '#b05843', frame: false, blank: true }), { roughness: 0.6 });
  M.books = [3, 4, 5, 6].map((s) => tm(T.books(s), { roughness: 0.8 }));
  M.posters = [0, 1, 2, 3, 4, 5].map((s) => tm(T.poster(s), { roughness: 0.9 }));
  M.screenTech = unlit(T.screen('tech'));
  M.screenRobot = unlit(T.screen('robot'));
  M.screenDesk = unlit(T.screen('desktop'));
  M.logo = new THREE.MeshStandardMaterial({ map: T.logo(), transparent: true, roughness: 0.5 });
  M.logoLight = new THREE.MeshStandardMaterial({ map: T.logo({ lisbon: false, dark: '#f4ede4' }), transparent: true, roughness: 0.5 });
  M.logoPlain = new THREE.MeshStandardMaterial({ map: T.logo({ lisbon: false }), transparent: true, roughness: 0.5 }); // (as on the Studio wall in the renders)
  M.lockers = tm(T.lockers(6, 3), { roughness: 0.55 });
  M.drawers = tm(T.lockers(3, 3, '#aab4c0'), { roughness: 0.55 });
  M.drawersOak = tm(T.lockers(4, 2, '#d9c09a'), { roughness: 0.55 });
  for (const k of ['logo', 'logoLight', 'logoPlain']) M[k].userData.noShadow = true;
  M.sign = (text, opts) => {
    const m = new THREE.MeshStandardMaterial({ map: T.sign(text, opts), transparent: true, roughness: 0.6 });
    m.userData.noShadow = true;
    return m;
  };
  return M;
}

// ---------------------------------------------------------------- walls
// axis 'z': wall runs along z at x = at;  axis 'x': wall runs along x at z = at.  (plan units)
// openings: { a, b, bottom, top, kind: 'window' | 'door' (closed glass door) | 'opening' (walkable gap) }
// inside: +1 / -1 = which side faces the room (exterior walls); omitted = both sides are rooms.
function wall(b, M, o) {
  const prev = b.label;
  b.label = 'arch';
  const t = o.t ?? 0.15;
  const mat = o.mat ?? M.wall;
  const sides = o.inside ? [o.inside] : [-1, 1];
  const unit = o.axis === 'z' ? SX : SZ; // metres per plan unit across the wall
  const piece = (a, c, ya, yb) => {
    if (c - a < 0.001 || yb - ya < 0.001) return;
    slab(b, o.axis, o.at, a, c, ya, yb, t, mat);
    if (ya === o.y0 && yb - ya > 0.3 && o.floor !== false) {
      for (const s of sides) {
        slab(b, o.axis, o.at + (s * (t / 2 + 0.006)) / unit, a, c, ya, ya + 0.08, 0.014, M.skirting);
        floorEdge(b, o.axis, o.at + (s * t) / 2 / unit, s, a, c, ya);
      }
    }
  };
  const ops = [...(o.openings || [])].sort((p, q) => p.a - q.a);
  let c = o.from;
  for (const op of ops) {
    piece(c, op.a, o.y0, o.y1);
    piece(op.a, op.b, o.y0, op.bottom);
    piece(op.a, op.b, op.top, o.y1);
    if (op.kind !== 'opening') glazing(b, M, o.axis, o.at, op.a, op.b, op.bottom, op.top, op.open ? 'open' : op.kind === 'door');
    c = op.b;
  }
  piece(c, o.to, o.y0, o.y1);
  if (o.collide !== false) {
    let s = o.from;
    for (const op of ops) {
      if (op.kind === 'opening' || op.open) {
        seg(b, o.axis, o.at, t, s, op.a, o.level);
        s = op.b;
      }
    }
    seg(b, o.axis, o.at, t, s, o.to, o.level);
  }
  b.label = prev;
}
// darkened floor strip where a wall meets the floor (plan units in, metres out)
function floorEdge(b, axis, face, side, a, c, y) {
  const w = 0.32;
  const g = new THREE.PlaneGeometry(1, 1);
  g.translate(0, 0.5, 0);
  g.rotateX(-Math.PI / 2); // plane now extends toward -z, v = 0 at the wall
  const len = axis === 'x' ? (c - a) * SX : (c - a) * SZ;
  const m = new THREE.Matrix4();
  if (axis === 'x') {
    m.makeRotationY(side > 0 ? Math.PI : 0).setPosition(((a + c) / 2) * SX, y + 0.003, face * SZ);
  } else {
    m.makeRotationY(side > 0 ? -Math.PI / 2 : Math.PI / 2).setPosition(face * SX, y + 0.003, ((a + c) / 2) * SZ);
  }
  m.multiply(new THREE.Matrix4().makeScale(len, 1, w));
  b.add(g, b.M.edge, m);
}
function seg(b, axis, at, t, a, c, level) {
  if (c - a < 0.01) return;
  const h = (t / 2 + 0.02) / (axis === 'z' ? SX : SZ);
  if (axis === 'z') b.solid(at - h, a, at + h, c, level);
  else b.solid(a, at - h, c, at + h, level);
}
function slab(b, axis, at, a, c, ya, yb, thick, mat) {
  // thickness is kept in real metres; position/extent along the wall are plan units
  if (axis === 'z') b.bx(at - thick / SX / 2, at + thick / SX / 2, ya, yb, a, c, mat);
  else b.bx(a, c, ya, yb, at - thick / SZ / 2, at + thick / SZ / 2, mat);
}
function glazing(b, M, axis, at, a, c, y0, y1, door = false, frame = M.frame) {
  const prev = b.label;
  b.label = 'arch';
  if (door === 'open') {
    // an automatic sliding door standing open: the frame, and the two glass leaves slid aside, just inside
    const u = axis === 'x' ? SX : SZ;
    const w = (c - a) / 2;
    const inside = -0.12 / (axis === 'x' ? SZ : SX); // (towards the room for the east facade)
    slab(b, axis, at, a, c, y1 - 0.12, y1, 0.14, frame);
    for (const [p0, p1] of [[a - w * 0.92, a - 0.02 / u], [c + 0.02 / u, c + w * 0.92]]) {
      slab(b, axis, at + inside, p0, p1, y0 + 0.02, y1 - 0.12, 0.02, M.glass);
      slab(b, axis, at + inside, p0, p1, y0 + 0.02, y0 + 0.07, 0.05, frame);
      slab(b, axis, at + inside, p0, p1, y1 - 0.17, y1 - 0.12, 0.05, frame);
    }
    for (const p of [a, c]) slab(b, axis, at, p - 0.03 / u, p + 0.03 / u, y0, y1, 0.14, frame);
    b.label = prev;
    return;
  }
  slab(b, axis, at, a, c, y0, y1, 0.02, M.glass);
  const span = (c - a) * (axis === 'x' ? SX : SZ);
  const n = Math.max(1, Math.round(span / 1.6));
  const step = (c - a) / n;
  const half = 0.03 / (axis === 'x' ? SX : SZ);
  for (let i = 0; i <= n; i++) {
    const p = a + i * step;
    slab(b, axis, at, Math.max(a, p - half), Math.min(c, p + half), y0, y1, 0.09, frame);
  }
  slab(b, axis, at, a, c, y0, y0 + 0.05, 0.09, frame);
  slab(b, axis, at, a, c, y1 - 0.05, y1, 0.09, frame);
  if (door) {
    const mid = (a + c) / 2;
    slab(b, axis, at, mid - half, mid + half, y0, y1, 0.09, frame);
    slab(b, axis, at, mid - 0.27, mid - 0.25, y0 + 0.9, y0 + 1.5, 0.16, M.chrome);
    slab(b, axis, at, mid + 0.25, mid + 0.27, y0 + 0.9, y0 + 1.5, 0.16, M.chrome);
  }
  b.label = prev;
}
// Interior glass partition with slim frames; openings are walkable door gaps (door leaf shown open).
function glassWall(b, M, o) {
  const prev = b.label;
  b.label = 'arch';
  const frame = o.frame ?? M.frame;
  const y0 = o.y0;
  const y1 = o.y1;
  const doorTop = y0 + 2.3;
  const unit = o.axis === 'x' ? SX : SZ;
  const half = 0.025 / unit;
  const ops = [...(o.openings || [])].sort((p, q) => p.a - q.a);
  const spans = [];
  let c = o.from;
  for (const op of ops) {
    spans.push([c, op.a]);
    c = op.b;
  }
  spans.push([c, o.to]);
  for (const [a, e] of spans) {
    if (e - a < 0.01) continue;
    slab(b, o.axis, o.at, a, e, y0, y1, 0.02, M.glass);
    const n = Math.max(1, Math.round(((e - a) * unit) / 1.25));
    for (let i = 0; i <= n; i++) {
      const p = a + ((e - a) * i) / n;
      slab(b, o.axis, o.at, Math.max(a, p - half), Math.min(e, p + half), y0, y1, 0.07, frame);
    }
    slab(b, o.axis, o.at, a, e, y0, y0 + 0.06, 0.07, frame);
    seg(b, o.axis, o.at, 0.08, a, e, o.level);
  }
  b.label = prev;
  for (const op of ops) {
    b.label = 'arch';
    slab(b, o.axis, o.at, op.a, op.b, doorTop, doorTop + 0.05, 0.07, frame);
    slab(b, o.axis, o.at, op.a, op.b, doorTop + 0.05, y1, 0.02, M.glass);
    slab(b, o.axis, o.at, op.a, op.a + half * 2, y0, doorTop, 0.07, frame);
    slab(b, o.axis, o.at, op.b - half * 2, op.b, y0, doorTop, 0.07, frame);
    b.label = 'door leaf';
    // open leaf, swung 90° against the partition on side leafSide
    const side = o.leafSide ?? 1;
    const leafW = Math.min(0.9, (op.b - op.a) * unit - 0.1);
    b.pushRaw();
    if (o.axis === 'x') {
      const hx = op.a * SX + 0.06;
      const z = o.at * SZ + side * (0.06 + leafW / 2);
      b._box(0.04, 2.24, leafW, hx, y0 + 0.01, z, M.glass);
      b._box(0.05, 2.24, 0.04, hx, y0 + 0.01, z + side * (leafW / 2 - 0.02), frame);
    } else {
      const hz = op.a * SZ + 0.06;
      const x = o.at * SX + side * (0.06 + leafW / 2);
      b._box(leafW, 2.24, 0.04, x, y0 + 0.01, hz, M.glass);
      b._box(0.04, 2.24, 0.05, x + side * (leafW / 2 - 0.02), y0 + 0.01, hz, frame);
    }
    b.pop();
  }
  b.label = 'arch';
  slab(b, o.axis, o.at, o.from, o.to, y1 - 0.05, y1, 0.07, frame);
  b.label = prev;
}

// ---------------------------------------------------------------- furniture kit (local metres inside push)
function shellChair(b, M, x, y, z, ry, mat) {
  if (DETAIL) return F.stackChair(b, M, x, y, z, ry, mat);
  b.label = 'shell chair';
  b.push(x, y, z, ry);
  b.rbox(0.46, 0.05, 0.44, 0, 0.43, 0, mat, 0.02, 0, -0.04);
  b.rbox(0.46, 0.4, 0.035, 0, 0.5, 0.215, mat, 0.015, 0, -0.14);
  for (const sx of [-0.2, 0.2]) {
    b.cyl(0.008, 0.008, 0.43, sx, 0, -0.18, M.chrome, 6);
    b.cyl(0.008, 0.008, 0.43, sx, 0, 0.18, M.chrome, 6);
    b.box(0.016, 0.016, 0.38, sx, 0, 0, M.chrome);
  }
  b.blob(0.6, 0.6, 0, 0, 0);
  b.pop();
}
function woodChair(b, M, x, y, z, ry, mat) {
  if (DETAIL) return F.oakChair(b, M, x, y, z, ry, mat);
  b.label = 'wood chair';
  b.push(x, y, z, ry);
  // a moulded shell chair on splayed oak legs, as in the concept renders
  mat.side = THREE.DoubleSide; // (the shell is seen from both sides)
  b.rbox(0.46, 0.05, 0.43, 0, 0.43, -0.01, mat, 0.022);
  b.cyl(0.25, 0.21, 0.36, 0, 0.47, -0.02, mat, 14, 0, 0, { open: true, t0: -1.05, tl: 2.1 }); // the curved back, wrapping round
  for (const [lx, lz] of [[-0.17, -0.15], [0.17, -0.15], [-0.17, 0.15], [0.17, 0.15]]) b.cyl(0.016, 0.011, 0.45, lx, 0.215, lz, M.oak, 8, lz * 0.8, -lx * 0.8);
  b.blob(0.6, 0.6, 0, 0, 0);
  b.pop();
}
function stool(b, M, x, y, z, seat = M.olive, h = 0.66, back = false, ry = 0) {
  if (DETAIL) return F.stool(b, M, x, y, z, seat, h, back, ry);
  b.label = 'stool';
  b.push(x, y, z, 0);
  b.cyl(0.18, 0.17, 0.07, 0, h - 0.07, 0, seat, 18);
  b.cyl(0.022, 0.022, h - 0.07, 0, 0, 0, M.white, 8);
  b.cyl(0.19, 0.19, 0.015, 0, 0.3, 0, M.white, 16);
  b.cyl(0.26, 0.27, 0.025, 0, 0, 0, M.white, 14);
  b.blob(0.6, 0.6, 0, 0, 0);
  b.pop();
}
function pouf(b, x, y, z, mat, r = 0.24, h = 0.42) {
  if (DETAIL) return F.pouf(b, x, y, z, mat, r, h);
  b.label = 'pouf';
  b.push(x, y, z, 0);
  b.cyl(r, r * 1.04, h - 0.03, 0, 0, 0, mat, 22);
  b.cyl(r * 0.96, r, 0.03, 0, h - 0.03, 0, mat, 22);
  b.blob(r * 2.6, r * 2.6, 0, 0, 0);
  b.pop();
}
function table(b, M, x, y, z, w, d, h, top = M.white, leg = M.white, ry = 0) {
  b.label = 'table';
  b.push(x, y, z, ry);
  b.rbox(w, 0.03, d, 0, h - 0.03, 0, top, 0.008);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.018, 0.018, h - 0.03, sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06), leg, 8);
  b.blob(w + 0.25, d + 0.25, 0, 0, 0);
  b.pop();
}
function roundTable(b, M, x, y, z, r, h = 0.74, top = M.white) {
  if (DETAIL) return F.roundTable(b, M, x, y, z, r, h, top);
  b.label = 'round table';
  b.push(x, y, z, 0);
  b.cyl(r, r, 0.03, 0, h - 0.03, 0, top, 36);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.cyl(0.02, 0.02, h - 0.03, Math.cos(a) * r * 0.45, 0, Math.sin(a) * r * 0.45, M.oak, 8);
  }
  b.blob(r * 2.4, r * 2.4, 0, 0, 0);
  b.pop();
}
function laptop(b, M, x, y, z, ry, screenMat = M.screenDesk) {
  if (DETAIL) return F.laptop(b, M, x, y, z, ry, screenMat);
  b.label = 'laptop';
  b.push(x, y, z, ry);
  b.rbox(0.32, 0.014, 0.22, 0, 0, 0, M.steelGrey, 0.004);
  b.push(0, 0.014, 0.105, 0);
  b.rbox(0.32, 0.21, 0.008, 0, 0, 0, M.steelGrey, 0.003, 0, -0.28);
  b.box(0.29, 0.18, 0.002, 0, 0.016, -0.0035, screenMat, 0, -0.28);
  b.pop();
  b.pop();
}
// TV: front faces local -z
function tv(b, M, x, y, z, ry, w = 1.4, mat = M.screenTech) {
  b.label = 'tv';
  b.push(x, y, z, ry);
  b.rbox(w, w * 0.58, 0.04, 0, 0, 0, M.screenBlack, 0.006);
  b.box(w - 0.04, w * 0.58 - 0.04, 0.002, 0, 0.02, -0.021, mat);
  b.pop();
}
function tvStand(b, M, x, y, z, ry, mat = M.screenTech) {
  b.label = 'tv stand';
  b.push(x, y, z, ry);
  b.rbox(0.7, 0.04, 0.5, 0, 0.06, 0, M.steelGrey, 0.01);
  for (const [wx, wz] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) b.cyl(0.03, 0.03, 0.06, wx, 0, wz, M.black, 10);
  b.box(0.08, 1.0, 0.06, 0, 0.1, 0.06, M.steelGrey);
  b.rbox(1.3, 0.754, 0.04, 0, 1.0, 0, M.screenBlack, 0.006);
  b.box(1.26, 0.714, 0.002, 0, 1.02, -0.021, mat);
  b.blob(0.95, 0.75, 0, 0, 0);
  b.pop();
}
// Real plant models (Poly Haven, CC0) are placed here once loaded; this records the spot and its contact shadow.
function plant(b, M, x, y, z, s = 1) {
  b.label = 'plant';
  b.push(x, y, z, 0);
  const p = new THREE.Vector3().setFromMatrixPosition(b.m);
  const kind = s >= 1.35 ? 'tall' : s >= 1 ? 'medium' : 'small';
  let lift = 0;
  if (kind === 'tall') {
    // the pachira scan has no pot: give it a ceramic planter
    b.cyl(0.25, 0.19, 0.42, 0, 0, 0, M.pot, 28);
    b.cyl(0.235, 0.235, 0.01, 0, 0.39, 0, M.trunk, 28);
    lift = 0.38;
  }
  b.models.push({ kind, x: p.x, y: p.y + lift, z: p.z, ry: (p.x * 7 + p.z * 3) % 6.28 });
  b.blob(0.5 * s, 0.5 * s, 0, 0, 0);
  b.pop();
}
// open shelving unit; front faces local -z
function cubbies(b, M, x, y, z, ry, cols, rows, cw = 0.4, ch = 0.38, depth = 0.4, frame = M.oak, seed = 1) {
  b.label = 'shelving';
  const w = cols * cw;
  const h = rows * ch;
  b.push(x, y, z, ry);
  b.box(w, h, 0.02, 0, 0, depth / 2 - 0.01, frame);
  for (let r = 0; r <= rows; r++) b.box(w, 0.022, depth, 0, Math.min(r * ch, h - 0.022), 0, frame);
  for (let c = 0; c <= cols; c++) b.box(0.022, h, depth, -w / 2 + 0.011 + (c * (w - 0.022)) / cols, 0, 0, frame);
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = rnd();
      const cx = -w / 2 + (c + 0.5) * cw;
      const cy = r * ch + 0.022;
      const inner = ch - 0.05;
      if (k < 0.35) b.rbox(cw * 0.72, inner * 0.7, depth * 0.75, cx, cy, 0.01, M.kraft, 0.006);
      else if (k < 0.6) b.rbox(cw * 0.74, inner * 0.5, depth * 0.75, cx, cy, 0.01, M.bin, 0.01);
      else if (k < 0.85) b.box(cw * 0.86, inner * 0.82, depth * 0.55, cx, cy, 0.06, M.books[Math.floor(rnd() * 4)]);
    }
  }
  b.blob(w + 0.2, depth + 0.3, 0, 0, 0);
  b.pop();
}
// curved run of boxes around a local centre (call inside push): radius r, angles a0..a1 (0 = +x, π/2 = +z)
function arc(b, cy, r, a0, a1, segs, depth, h, mat, round = 0) {
  const len = ((r * Math.abs(a1 - a0)) / segs) * 1.02;
  for (let i = 0; i < segs; i++) {
    const a = a0 + ((i + 0.5) * (a1 - a0)) / segs;
    if (round) b.rbox(len, h, depth, Math.cos(a) * r, cy, Math.sin(a) * r, mat, round, -a - Math.PI / 2);
    else b.box(len, h, depth, Math.cos(a) * r, cy, Math.sin(a) * r, mat, -a - Math.PI / 2);
  }
}
function curvedBookshelf(b, M, cx, cy, cz, r, a0, a1) {
  if (DETAIL) return F.bookcase(b, M, cx, cy, cz, r, a0, a1);
  b.label = 'curved bookshelf';
  b.push(cx, cy, cz, 0);
  const segs = 8;
  for (let s = 0; s <= 4; s++) arc(b, s * 0.44, r, a0, a1, segs * 2, 0.36, 0.025, M.dustyBlue);
  arc(b, 0, r + 0.17, a0, a1, segs * 2, 0.02, 1.78, M.dustyBlue);
  for (let i = 0; i <= segs; i++) {
    const a = a0 + (i * (a1 - a0)) / segs;
    b.box(0.025, 1.78, 0.34, Math.cos(a) * r, 0, Math.sin(a) * r, i % 2 ? M.pouf2 : M.oak, -a);
  }
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < segs; i++) {
      const sa = a0 + (i * (a1 - a0)) / segs + 0.03;
      const sb = a0 + ((i + 1) * (a1 - a0)) / segs - 0.03;
      arc(b, s * 0.44 + 0.025, r + 0.03, sa, sb, 2, 0.22, 0.34, M.books[(s + i) % 4]);
    }
  }
  for (let i = 0; i < 6; i++) {
    const a = a0 + ((i + 0.5) * (a1 - a0)) / 6;
    b.blob(0.8, 0.7, Math.cos(a) * r, 0, Math.sin(a) * r, -a);
  }
  b.pop();
}
function lockerBlock(b, M, x, y, z, ry, w, h = 1.9, d = 0.5) {
  b.label = 'lockers';
  b.push(x, y, z, ry);
  b.box(w, 0.08, d - 0.04, 0, 0, -0.02, M.black);
  b.rbox(w, h - 0.08, d, 0, 0.08, 0, M.lockers, 0.01);
  b.blob(w + 0.3, d + 0.35, 0, 0, 0);
  b.pop();
}

// ---------------------------------------------------------------- building shell
// interior partition lines (plan units) LED strips must not cross
const PARTITIONS = [
  { level: 0, x: 1.5, z0: 3.4, z1: 10.2 },
  { level: 0, x: 3.0, z0: 10.2, z1: 14 },
  { level: 0, x: 4.6, z0: 6.0, z1: 10.2 },
  { level: 0, z: 6.0, x0: 1.5, x1: 4.6 },
  { level: 0, z: 10.2, x0: 0, x1: 4.6 },
  { level: 0, z: 14.0, x0: 0, x1: 3.0 },
  { level: 0, z: 11.6, x0: 3.0, x1: 8 },
  { level: 1, z: 11.6, x0: 0, x1: 8 },
  { level: 1, x: 6.0, z0: 8.4, z1: 11.6 },
  { level: 1, x: 1.46, z0: 3.365, z1: 10.2 }, // the glass screen along the stair opening (Lab)
  { level: 1, z: 3.365, x0: 0, x1: 1.46 }, // and along its north side
];
function shell(b, M) {
  b.label = 'arch';
  // floors
  b.bx(-0.25, W + 0.25, -0.4, -0.02, -0.25, L + 0.25, M.slab);
  b.bx(0, W, -0.02, 0, 0, L, M.floor);
  // first-floor slab with the stair void cut out
  const slabParts = [
    [STAIR.x1, W, 0, L],
    [0, STAIR.x1, 0, STAIR.z0],
    [0, STAIR.x1, STAIR.z1, L],
  ];
  for (const [x0, x1, z0, z1] of slabParts) {
    b.bx(x0, x1, CEIL, CEIL + 0.04, z0, z1, M.ceil);
    b.bx(x0, x1, CEIL + 0.04, F1 - 0.02, z0, z1, M.slab);
    b.bx(x0, x1, F1 - 0.02, F1, z0, z1, M.floor);
  }
  // first-floor ceiling + roof with parapet
  b.bx(0, W, F1 + CEIL, F1 + CEIL + 0.04, 0, L, M.ceil);
  b.bx(-0.25, W + 0.25, F1 + CEIL + 0.04, 7.7, -0.25, L + 0.25, M.ext);
  b.bx(-0.25, W + 0.25, 7.7, 8.1, -0.25, -0.05, M.ext);
  b.bx(-0.25, W + 0.25, 7.7, 8.1, L + 0.05, L + 0.25, M.ext);
  b.bx(-0.25, -0.05, 7.7, 8.1, -0.05, L + 0.05, M.ext);
  b.bx(W + 0.05, W + 0.25, 7.7, 8.1, -0.05, L + 0.05, M.ext);

  const t = 0.3;
  const tp = t / SX; // wall thickness in plan units across x
  const tz = t / SZ;
  const gWin = (a, c) => ({ a, b: c, bottom: 0.0, top: 3.05, kind: 'window' });
  const fWin = (a, c, sill = 0.0) => ({ a, b: c, bottom: F1 + sill, top: F1 + 3.05, kind: 'window' });
  // As built (photos of PaRK Alfragide): the courtyard side (east, north-east on site) is glazed along the
  // whole ground floor and solid above; the motorway side (west, south-west on site) is solid below and has
  // one long window band along the first floor (the Lab and the Studio).
  // east facade (entrance side, onto the courtyard)
  wall(b, M, { axis: 'z', at: W + tp / 2, t, from: -tz, to: L + tz, y0: 0, y1: F1, mat: M.ext, inside: -1, openings: [
    gWin(0.35, 2.3), { a: 2.5, b: 4.3, bottom: 0.0, top: 2.6, kind: 'door' }, gWin(4.5, 20.75)] });
  wall(b, M, { axis: 'z', at: W + tp / 2, t, from: -tz, to: L + tz, y0: F1, y1: 7.7, mat: M.ext, inside: -1, level: 1 }); // (blocks the first floor only: the entrance is below)
  // square cream columns just inside the courtyard glazing, between its bays (as in the photographs)
  for (const z of [0.9, 5.9, 10.9, 15.95]) {
    b.bx(W - 0.4 / SX, W, 0, CEIL, z - 0.2, z + 0.2, M.lobbyWall);
    b.bx(W - 0.41 / SX, W, 0, 0.08, z - 0.21, z + 0.21, M.skirting);
    b.solid(W - 0.45, z - 0.25, W, z + 0.25, 0);
  }
  // west wall (solid on the ground floor; the window band above)
  wall(b, M, { axis: 'z', at: -tp / 2, t, from: -tz, to: L + tz, y0: 0, y1: F1, mat: M.ext, inside: 1 });
  wall(b, M, { axis: 'z', at: -tp / 2, t, from: -tz, to: L + tz, y0: F1, y1: 7.7, mat: M.ext, inside: 1, openings: [{ a: 0.35, b: 20.75, bottom: F1 + 0.95, top: F1 + 2.65, kind: 'window' }] }); // (a band, as in the photos)
  // north wall
  wall(b, M, { axis: 'x', at: -tz / 2, t, from: 0, to: W, y0: 0, y1: F1, mat: M.ext, inside: 1, openings: [
    { a: 3.1, b: 4.9, bottom: 0.0, top: 2.3, kind: 'opening' }] }); // (the double doors to the school, centred on the wall)
  wall(b, M, { axis: 'x', at: -tz / 2, t, from: 0, to: W, y0: F1, y1: 7.7, mat: M.ext, inside: 1 });
  // south wall
  wall(b, M, { axis: 'x', at: L + tz / 2, t, from: 0, to: W, y0: 0, y1: F1, mat: M.ext, inside: -1 });
  wall(b, M, { axis: 'x', at: L + tz / 2, t, from: 0, to: W, y0: F1, y1: 7.7, mat: M.ext, inside: -1 }); // (blank, as in the photographs)

  // LED strips (skip any that would cross a partition or sit over the stair void)
  for (const [level, base] of [[0, 0], [1, F1]]) {
    for (let z = 1.3; z < L; z += 2.4) {
      for (let x = 1.0; x < W; x += 2.0) {
        const half = 0.7 / SX;
        if (level === 0 && x - half < STAIR.x1 + 0.1 && z > STAIR.z0 - 0.1 && z < STAIR.z1 + 0.1) continue;
        if (level === 1 && x + half > 5.9 && z > 8.3 && z < 11.7) continue; // (the filming corner has its own dark ceiling)
        const hit = PARTITIONS.some((p) => p.level === level && (p.x !== undefined
          ? Math.abs(x - p.x) < half + 0.05 && z > p.z0 - 0.1 && z < p.z1 + 0.1
          : Math.abs(z - p.z) < 0.15 && x + half > p.x0 && x - half < p.x1));
        if (hit) continue;
        const zz = level === 1 && z > L - 0.7 ? L - 0.7 : z; // (upstairs, clear of the Studio's wall unit)
        b.bx(x - half, x + half, base + CEIL - 0.012, base + CEIL, zz - 0.03, zz + 0.03, M.led);
        b.bx(x - half - 0.02, x + half + 0.02, base + CEIL - 0.005, base + CEIL, zz - 0.05, zz + 0.05, M.white);
      }
    }
  }
  // two strips along the stair opening, under the first-floor ceiling, so the stair is lit
  for (const z of [5.0, 8.4]) {
    b.bx(0.70, 0.76, F1 + CEIL - 0.012, F1 + CEIL, z - 0.7, z + 0.7, M.led);
    b.bx(0.68, 0.78, F1 + CEIL - 0.005, F1 + CEIL, z - 0.72, z + 0.72, M.white);
  }
}

// ---------------------------------------------------------------- stair
function stair(b, M) {
  b.label = 'arch';
  const n = 23;
  const rise = F1 / n;
  const run = (STAIR.z1 - STAIR.z0) / n;
  const xi = 0.12 / SX; // keep clear of the walls either side
  for (let i = 0; i < n; i++) {
    const top = (i + 1) * rise;
    const z0 = STAIR.z0 + i * run;
    b.bx(0.02, STAIR.x1 - xi, 0, top - 0.03, z0, z0 + run, M.stair);
    b.bx(0.02, STAIR.x1 - xi, top - 0.03, top, z0, z0 + run, M.oak);
  }
  // ground-floor enclosure wall (reception feature wall on its east face)
  wall(b, M, { axis: 'z', at: STAIR.x1, t: 0.15, from: STAIR.z0, to: STAIR.z1, y0: 0, y1: F1 + 0.9, floor: false }); // (up through the floor to the worktop: one flush face on the stair side)
  b.solid(0, STAIR.z1 - 0.05, STAIR.x1, STAIR.z1 + 0.1, 0); // under the top of the stair
  // first floor: the Lab's worktop and its glass screen run round the opening (see lab())
  b.solid(0, STAIR.z0 - 0.08, STAIR.x1, STAIR.z0 + 0.12, 1);
  // handrail on the west wall (metres)
  const zA = STAIR.z0 * SZ;
  const zB = STAIR.z1 * SZ;
  const len = Math.hypot(zB - zA, F1);
  b.pushRaw();
  b._box(0.045, 0.045, len, 0.07, F1 / 2 + 0.9 - 0.022, (zA + zB) / 2, M.oak, 0, -Math.atan2(F1, zB - zA));
  for (let i = 1; i < 6; i++) {
    const zz = zA + ((zB - zA) * i) / 6;
    b._box(0.015, 0.08, 0.015, 0.035, (F1 * i) / 6 + 0.9 - 0.1, zz, M.chrome);
  }
  b.pop();
}

// ---------------------------------------------------------------- ground floor
function reception(b, M) {
  b.label = 'reception wall';
  // sage feature wall with oak slats and logo on the stair enclosure
  const fx = STAIR.x1 + 0.075 / SX;
  b.bx(fx, fx + 0.012 / SX, 0, CEIL, STAIR.z0, STAIR.z1, M.sage);
  for (let i = 0; i < 8; i++) {
    const z = STAIR.z0 + 0.1 + i * 0.12;
    b.bx(fx + 0.012 / SX, fx + 0.05 / SX, 0.9, CEIL, z, z + 0.05, M.oak);
  }
  b.geo(new THREE.PlaneGeometry(1.5, 0.75), M.logo, fx + 0.02 / SX, 1.95, 5.2, Math.PI / 2);
  // north wall: sage paint + lockers
  b.bx(0, 3.03, 0, CEIL, 0.0, 0.01, M.sage);
  b.bx(4.97, W, 0, CEIL, 0.0, 0.01, M.sage);
  b.bx(3.03, 4.97, 2.38, CEIL, 0.0, 0.01, M.sage); // (the sage all round the double doors to the school)
  // curved white reception desk with oak top section
  b.label = 'reception desk';
  b.push(2.9, 0, 4.0, 0);
  b.rbox(0.6, 0.72, 2.6, 0, 0, 0, M.white, 0.02);
  b.cyl(0.3, 0.3, 0.72, 0, 0, 1.3, M.white, 24);
  b.rbox(0.64, 0.04, 2.62, 0, 0.72, 0, M.oak, 0.01);
  b.cyl(0.32, 0.32, 0.04, 0, 0.72, 1.3, M.oak, 24);
  b.blob(1.0, 3.4, 0, 0, 0.2);
  b.pop();
  laptop(b, M, 2.8, 0.76, 3.8, Math.PI / 2);
  b.solid(2.6, 2.75, 3.2, 5.45, 0);
  woodChair(b, M, 2.15, 0, 4.0, -Math.PI / 2, M.plasticBeige);
  // lounge: tulip armchairs + coffee table, against the glazing facing the courtyard (the walkway stays clear)
  for (const [x, z, ry] of [[7.3, 6.9, Math.PI / 2], [7.3, 8.9, Math.PI / 2]]) {
    b.label = 'armchair';
    b.push(x, 0, z, ry);
    b.cyl(0.36, 0.3, 0.12, 0, 0.36, 0, M.paleGreen, 24);
    b.rbox(0.72, 0.5, 0.12, 0, 0.43, 0.3, M.paleGreen, 0.05, 0, -0.35);
    b.cyl(0.025, 0.025, 0.36, 0, 0, 0, M.chrome, 8);
    b.rbox(0.7, 0.02, 0.05, 0, 0, 0, M.white, 0.008);
    b.rbox(0.05, 0.02, 0.7, 0, 0, 0, M.white, 0.008);
    b.blob(0.9, 0.9, 0, 0, 0);
    b.pop();
  }
  b.label = 'coffee table';
  b.push(7.35, 0, 7.9, 0);
  b.cyl(0.32, 0.32, 0.025, 0, 0.36, 0, M.white, 28);
  b.cyl(0.3, 0.3, 0.01, 0, 0.0, 0, M.white, 28);
  for (let i = 0; i < 3; i++) b.cyl(0.008, 0.008, 0.36, Math.cos(i * 2.1) * 0.27, 0, Math.sin(i * 2.1) * 0.27, M.white, 6);
  b.blob(0.8, 0.8, 0, 0, 0);
  b.pop();
  // high table under a white frame canopy (near the window): the top is fixed to the four posts, a foot rail
  // runs along both long sides, oak slats and a linear light in the canopy, bar stools along both long sides
  b.label = 'high table';
  b.push(5.9, 0, 1.6, 0);
  const hx = 0.8;
  const hz = 0.45;
  for (const sx of [-hx, hx]) for (const sz of [-hz, hz]) b.box(0.05, 2.1, 0.05, sx, 0, sz, M.white);
  b.rbox(1.66, 0.04, 0.96, 0, 1.02, 0, M.oak, 0.01);
  for (const sz of [-hz, hz]) b.box(1.6, 0.06, 0.035, 0, 0.96, sz, M.white);
  for (const sx of [-hx, hx]) b.box(0.035, 0.06, 0.9, sx, 0.96, 0, M.white);
  for (const sz of [-hz, hz]) b.box(1.6, 0.03, 0.03, 0, 0.3, sz, M.white);
  for (const sz of [-hz, hz]) b.box(1.66, 0.06, 0.05, 0, 2.06, sz, M.white);
  for (const sx of [-hx, hx]) b.box(0.05, 0.06, 0.96, sx, 2.06, 0, M.white);
  for (let i = 0; i < 9; i++) b.box(0.07, 0.025, 0.86, -0.72 + i * 0.18, 2.09, 0, M.oak);
  for (const sx of [-0.36, 0.36]) b.cyl(0.003, 0.003, 0.21, sx, 1.88, 0, M.black, 4); // (hung from two of the slats)
  b.box(1.1, 0.04, 0.06, 0, 1.84, 0, M.black);
  b.box(1.06, 0.004, 0.04, 0, 1.836, 0, M.led);
  b.blob(2.0, 1.4, 0, 0, 0);
  b.pop();
  for (const [x, z] of [[5.5, 0.82], [6.3, 0.82], [5.5, 2.38], [6.3, 2.38]]) stool(b, M, x, 0, z, M.olive, 0.75);
  b.solid(5.05, 1.1, 6.75, 2.1, 0);
  plant(b, M, 7.3, 0, 0.4, 1.6);
  plant(b, M, 2.0, 0, 0.6, 1.2); // (beside the doors to the school, not in front of them)
}

// ---------------------------------------------------------------- the way into the school (from the photographs)
// Reception's north wall opens through white double doors with steel hinges, one leaf open, straight onto the
// school's hall: a wood-strip floor, a dark ceiling, a cream wall with the exit sign, a fire extinguisher, the
// hose-reel cabinet and Auditorium B's door. Visitors see into it from Reception; the doorway is closed to walking.
function schoolHall(b, M) {
  b.label = 'school doors';
  const x0 = 0.0;
  const x1 = 8.3;
  const zs = -0.3; // Edge's north wall, its hall side (its Reception side is z 0)
  const zb = -5.0; // the back of the block (where the main building's front is)
  const zh = zb + 0.12; // the far wall of the school's hall (about 4.6 m from the doors)
  const H = 3.05;
  const da = 3.1;
  const db = 4.9;
  const mid = (da + db) / 2;
  // the white frame: jambs and head wrapping the wall's thickness, standing proud of both faces
  b.bx(da - 0.07, da + 0.02, 0, 2.38, zs - 0.015, 0.015, M.doorWhite);
  b.bx(db - 0.02, db + 0.07, 0, 2.38, zs - 0.015, 0.015, M.doorWhite);
  b.bx(da - 0.07, db + 0.07, 2.28, 2.38, zs - 0.015, 0.015, M.doorWhite);
  // the left leaf shut, flush with the hall side, its hinges and lever handle towards Reception
  const lf = zs + 0.045; // (the leaf's Reception face)
  b.bx(da + 0.02, mid - 0.005, 0.01, 2.27, zs + 0.005, lf, M.doorWhite);
  for (const y of [0.25, 1.05, 1.95]) b.bx(da + 0.02, da + 0.045, y, y + 0.1, lf, lf + 0.02, M.chrome);
  b.bx(mid - 0.06, mid - 0.04, 0.98, 1.06, lf, lf + 0.035, M.chrome);
  b.bx(mid - 0.16, mid - 0.04, 1.02, 1.04, lf + 0.015, lf + 0.035, M.chrome);
  // the right leaf open into the hall, at right angles to the wall
  b.bx(db - 0.06, db - 0.02, 0.01, 2.27, zs - (mid - da - 0.02), zs - 0.015, M.doorWhite);
  for (const y of [0.25, 1.05, 1.95]) b.bx(db - 0.025, db - 0.005, y, y + 0.1, zs - 0.045, zs - 0.015, M.chrome);
  b.bx(db - 0.085, db - 0.06, 0.98, 1.06, zs - 0.8, zs - 0.78, M.chrome);
  b.bx(db - 0.095, db - 0.06, 1.02, 1.04, zs - 0.8, zs - 0.68, M.chrome);
  b.bx(da + 0.02, db - 0.02, -0.02, 0, zs - 0.015, 0.015, M.floor); // (the floor carried through the doorway)
  b.solid(da - 0.1, zs - 0.1, db + 0.1, 0.05, 0); // (seen, not entered)
  // the school's hall
  b.label = 'school hall';
  b.bx(x0, x1, -0.02, 0, zh, zs, M.floor);
  b.bx(x0 - 0.12, x1 + 0.12, H, H + 0.05, zb, zs, M.hallCeil);
  for (const [a, c] of [[x0 - 0.12, x0], [x1, x1 + 0.12]]) b.bx(a, c, 0, H + 0.05, zb, zs, M.lobbyWall);
  b.bx(x0 - 0.12, x1 + 0.12, 0, H + 0.05, zh - 0.12, zh, M.lobbyWall);
  b.bx(x0, x1, 0, 0.07, zh, zh + 0.012, M.skirting);
  // Edge's wall, painted cream on the hall side round the doorway, with its skirting
  for (const [a, c] of [[x0, da - 0.07], [db + 0.07, x1]]) {
    b.bx(a, c, 0, H, zs - 0.004, zs, M.lobbyWall);
    b.bx(a, c, 0, 0.07, zs - 0.012, zs - 0.004, M.skirting);
  }
  b.bx(da - 0.07, db + 0.07, 2.38, H, zs - 0.004, zs, M.lobbyWall);
  for (const z of [zs - 1.3, zh + 1.3]) for (const x of [2.4, 5.6]) b.bx(x - 0.6, x + 0.6, H - 0.015, H, z - 0.05, z + 0.05, M.led);
  // on its far wall, laid out to be seen through the open leaf from across Reception: Auditorium B's door with its
  // closer, sign and the exit sign over it, the extinguisher with its sign, the hose-reel cabinet
  b.bx(2.20, 3.10, 0, 2.2, zh, zh + 0.05, M.doorWhite);
  b.bx(2.15, 3.15, 2.2, 2.26, zh, zh + 0.06, M.doorWhite);
  b.bx(2.70, 3.05, 2.08, 2.13, zh + 0.05, zh + 0.09, M.steelGrey);
  b.bx(2.98, 3.08, 1.0, 1.02, zh + 0.05, zh + 0.09, M.chrome);
  b.bx(2.45, 2.85, 2.36, 2.52, zh, zh + 0.03, M.exitGreen);
  b.geo(new THREE.PlaneGeometry(0.34, 0.12), M.sign('EXIT', { color: '#ffffff' }), 2.65, 2.44, zh + 0.032, 0);
  b.bx(3.3, 3.67, 1.45, 1.8, zh, zh + 0.012, M.black);
  b.geo(new THREE.PlaneGeometry(0.34, 0.06), M.sign('AUDITORIUM B', { color: '#f2f2f2' }), 3.485, 1.5, zh + 0.014, 0);
  b.cyl(0.075, 0.075, 0.42, 3.95, 0.62, zh + 0.1, M.fireRed, 16);
  b.cyl(0.03, 0.04, 0.08, 3.95, 1.04, zh + 0.1, M.black, 10);
  b.bx(3.85, 4.05, 1.4, 1.62, zh, zh + 0.012, M.fireRed);
  b.bx(4.25, 4.9, 0.85, 1.45, zh, zh + 0.12, M.fireRed);
  b.bx(4.3, 4.85, 0.9, 1.4, zh + 0.12, zh + 0.125, M.glass);
  b.bx(4.4, 4.7, 2.5, 2.72, zh, zh + 0.012, M.fireRed);
}

function office(b, M) {
  const fr = M.frameGreen;
  glassWall(b, M, { axis: 'x', at: 6.0, from: STAIR.x1 + 0.1, to: 4.6, y0: 0, y1: CEIL, frame: fr, level: 0 });
  glassWall(b, M, { axis: 'z', at: 4.6, from: 6.0, to: STAIR.z1, y0: 0, y1: CEIL, frame: fr, level: 0, openings: [{ a: 6.3, b: 7.3 }], leafSide: 1 });
  // two desks pushed together face to face in the middle of the office, a chair and a laptop at each, with room
  // to walk round both sides (between the stair wall and the glass)
  const cx = 3.1, cz = 8.35;
  for (const s of [-1, 1]) {
    const z = cz + s * 0.375; // (s -1: the north desk, its chair to the north facing south; s 1: the reverse)
    table(b, M, cx, 0, z, 1.6, 0.75, 0.74, M.white, M.oak, 0);
    laptop(b, M, cx, 0.74, z + s * 0.1 / SZ, s < 0 ? 0 : Math.PI);
    const ry = s < 0 ? Math.PI : 0;
    if (DETAIL) F.taskChair(b, M, cx, 0, z + s * 0.6 / SZ, ry);
    else woodChair(b, M, cx, 0, z + s * 0.6 / SZ, ry, M.plasticGrey);
  }
  tv(b, M, 3.0, 1.0, STAIR.z1 - 0.12, 0, 1.2, M.screenDesk);
  cubbies(b, M, 3.4, 0, 6.3, Math.PI, 4, 4, 0.36, 0.42, 0.34, M.white, 4);
  for (let i = 0; i < 4; i++) plant(b, M, 2.95 + i * 0.27, 1.68, 6.3, 0.55);
  b.solid(cx - 0.8, cz - 1.3, cx + 0.8, cz + 1.3, 0);
  b.solid(2.6, 6.0, 4.2, 6.5, 0);
  b.label = 'sign';
  b.geo(new THREE.PlaneGeometry(1.2, 0.22), M.sign('OFFICE'), 4.6 + 0.05 / SX, 2.55, 8.0, Math.PI / 2);
}

function wc(b, M) {
  wall(b, M, { axis: 'x', at: STAIR.z1, from: 0, to: 4.6, y0: 0, y1: CEIL, level: 0 });
  wall(b, M, { axis: 'z', at: 3.0, from: STAIR.z1, to: 14.0, y0: 0, y1: CEIL, level: 0 });
  wall(b, M, { axis: 'x', at: 14.0, from: 0, to: 3.0, y0: 0, y1: CEIL, level: 0 });
  b.label = 'wc door';
  const face = 3.0 + 0.075 / SX;
  b.bx(face, face + 0.04 / SX, 0.0, 2.15, 12.9, 13.8, M.door);
  b.bx(face + 0.04 / SX, face + 0.07 / SX, 1.0, 1.03, 13.0, 13.15, M.chrome);
  b.geo(new THREE.PlaneGeometry(0.5, 0.16), M.sign('WC', { font: '700 120px "Segoe UI", Arial' }), face + 0.05 / SX, 2.35, 13.35, Math.PI / 2);
  b.label = 'wc fixtures';
  b.rbox(0.38, 0.42, 0.6, 0.35, 0, 12.0, M.toilet, 0.08);
  b.rbox(0.5, 0.15, 0.4, 0.3, 0.8, 13.4, M.toilet, 0.04);
  // TV on the WC block, facing the hub
  tv(b, M, 1.5, 1.2, 14.0 + 0.1 / SZ, Math.PI, 1.3, M.screenDesk);
}

function hub(b, M) {
  glassWall(b, M, { axis: 'x', at: 11.6, from: 3.0, to: W, y0: 0, y1: CEIL, level: 0, openings: [{ a: 4.2, b: 5.9 }], leafSide: 1 });
  b.label = 'sign';
  b.geo(new THREE.PlaneGeometry(1.0, 0.22), M.sign('HUB'), 5.05, 2.55, 11.6 - 0.05 / SZ, Math.PI);
  b.geo(new THREE.PlaneGeometry(1.0, 0.22), M.sign('HUB'), 5.05, 2.55, 11.6 + 0.05 / SZ, 0);
  lockerBlock(b, M, 7.1, 0, 11.6 - 0.32 / SZ, Math.PI, 1.5, 1.4, 0.45);
  b.solid(6.3, 11.0, 7.9, 11.6, 0);
  // terracotta writable wall, projector screen, tiered seating with drawers
  b.label = 'presentation wall';
  b.bx(0, W, 0, CEIL, L - 0.01, L, M.terracotta);
  b.geo(new THREE.PlaneGeometry(2.8, 1.4), M.terraBoard, 1.6, 1.95, L - 0.015, Math.PI);
  b.box(3.2, 0.07, 0.08, 4.6, 3.0, L - 0.08 / SZ, M.white);
  b.box(3.0, 1.62, 0.008, 4.6, 1.35, L - 0.07 / SZ, M.screenRobot);
  b.label = 'projector';
  b.rbox(0.4, 0.14, 0.34, 4.6, CEIL - 0.25, 18.6, M.white, 0.02);
  b.box(0.05, 0.11, 0.05, 4.6, CEIL - 0.11, 18.6, M.white);
  b.label = 'tiered seating';
  b.bx(0, W, 0, 0.42, 19.4, L - 0.01, M.oak);
  b.bx(0, W, 0.42, 0.84, 20.2, L - 0.01, M.oak);
  b.bx(0, W, 0.02, 0.4, 19.4 - 0.01 / SZ, 19.4, M.drawersOak);
  b.bx(0, W, 0.44, 0.82, 20.2 - 0.01 / SZ, 20.2, M.drawersOak);
  b.blob(10.5, 0.6, 4.0, 0, 19.4 - 0.15 / SZ);
  b.label = 'cushion';
  for (let i = 0; i < 7; i++) {
    const x = 0.6 + i * 1.12;
    b.rbox(1.0, 0.07, 0.62, x, 0.42, 19.75, M.olive, 0.03);
    b.rbox(1.0, 0.07, 0.62, x, 0.84, 20.55, M.paleGreen, 0.03);
  }
  b.solid(0, 19.4, W, L, 0);
  // presentation rows facing the screen
  const cols = [M.plasticBlue, M.plasticPink, M.plasticMint, M.plasticGrey];
  let k = 0;
  b.layer = "hub-chairs"; // can be hidden from the UI
  for (const z of [16.3, 17.1, 17.9, 18.7]) {
    for (const x of [3.76, 4.24, 4.72, 5.2, 5.96, 6.44, 6.92, 7.4]) shellChair(b, M, x, 0, z, Math.PI, cols[k++ % 4]);
    k++;
  }
  b.layer = "";
  // meeting table with curved bookshelf
  roundTable(b, M, 1.6, 0, 15.6, 0.6);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    woodChair(b, M, 1.6 + (Math.cos(a) * 0.85) / SX, 0, 15.6 + (Math.sin(a) * 0.85) / SZ, Math.PI / 2 - a, i % 2 ? M.plasticYellow : M.plasticBeige);
  }
  const bsR = 1.75;
  curvedBookshelf(b, M, 1.6, 0, 15.6, bsR, 0.08 * Math.PI, 0.72 * Math.PI);
  for (let i = 0; i < 8; i++) {
    const a = 0.08 * Math.PI + (i * 0.64 * Math.PI) / 7;
    const px = 1.6 * SX + Math.cos(a) * bsR;
    const pz = 15.6 * SZ + Math.sin(a) * bsR;
    b.solidM(px - 0.25, pz - 0.25, px + 0.25, pz + 0.25, 0);
  }
  // gallery wall: two oak frames with drawings and model shelves
  b.label = 'gallery';
  const gd = 0.35 / SX;
  for (const [z0, z1] of [[17.15, 18.2], [18.3, 19.3]]) {
    b.bx(0, gd, 0.6, 0.65, z0, z1, M.oak);
    b.bx(0, gd, 2.7, 2.75, z0, z1, M.oak);
    b.bx(0, gd, 0.65, 2.7, z0, z0 + 0.05 / SZ, M.oak);
    b.bx(0, gd, 0.65, 2.7, z1 - 0.05 / SZ, z1, M.oak);
    b.bx(0, gd * 0.85, 1.25, 1.28, z0 + 0.05 / SZ, z1 - 0.05 / SZ, M.oak);
  }
  b.solid(0, 17.15, 0.45, 19.4, 0);
  let p = 0;
  for (const z of [17.42, 17.92, 18.57, 19.05]) b.box(0.01, 0.62, 0.44, 0.015 / SX, 1.55, z, M.posters[p++ % 6]);
  b.label = 'models';
  for (const z of [17.4, 17.8, 18.1, 18.6, 18.9, 19.15]) {
    b.rbox(0.14, 0.1 + ((z * 7) % 0.12), 0.12, 0.17 / SX, 0.65, z, z % 0.6 > 0.3 ? M.steelGrey : M.white, 0.01);
    b.rbox(0.1, 0.08, 0.1, 0.15 / SX, 1.28, z, M.steelGrey, 0.01);
  }
  // lounge (as in the 360 tour): a beige curved sofa set diagonally into the corner between the glass partition and
  // the facade (its curved back to the corner, facing into the Hub), a taupe armchair along the glass beside it
  F.curvedSofa(b, M, 6.14, 13.45, 1.8, 0.45, -Math.PI / 4);
  F.armchair(b, M, 7.35, 14.2, Math.PI / 2);
  b.solid(6.45, 11.65, 7.95, 12.35, 0);
  b.solid(6.75, 12.35, 7.95, 12.75, 0);
  b.solid(7.1, 12.75, 7.95, 13.15, 0);
  b.solid(6.85, 13.75, 7.95, 14.65, 0);
  tvStand(b, M, 7.3, 0, 15.25, Math.PI - 0.9, M.screenTech);
  plant(b, M, 3.3, 0, 14.5, 1.4);
}

// ---------------------------------------------------------------- first floor
function lab(b, M) {
  const y = F1;
  b.label = 'project wall';
  b.bx(0, 2.2, y, y + 2.6, 0.0, 0.45 / SZ, M.drawersOak);
  b.bx(6.0, W, y, y + 2.6, 0.0, 0.45 / SZ, M.drawersOak);
  b.bx(0, W, y + 2.6, y + CEIL, 0.0, 0.45 / SZ, M.oak);
  b.bx(2.2, 6.0, y, y + 2.6, 0.0, 0.015 / SZ, M.white);
  b.geo(new THREE.PlaneGeometry(1.5, 1.1), M.boards[0], 3.1, y + 1.6, 0.02 / SZ, 0);
  tv(b, M, 4.75, y + 1.05, 0.04 / SZ, Math.PI, 1.45, M.screenTech);
  b.label = 'sticky notes';
  for (let i = 0; i < 8; i++) b.box(0.08, 0.08, 0.004, 5.7 + (i % 2) * 0.1, y + 1.3 + Math.floor(i / 2) * 0.12, 0.02 / SZ, i % 3 ? M.sticky : M.stickyPink);
  b.solid(0, 0, W, 0.5, 1);
  b.label = 'sign';
  b.geo(new THREE.PlaneGeometry(1.8, 0.3), M.sign('PROJECT LAB'), 4.1, y + 2.85, 0.46 / SZ, 0);
  // the worktop follows the stair opening round its corner: along its east side, then back along its north side to
  // the windows, with a glass screen on top up to the ceiling (as in the renders). North of the opening, under the
  // windows, is open floor.
  b.label = 'worktop';
  const wx = STAIR.x1 + 0.02 / SX;
  const cz = STAIR.z0 - 0.62 / SZ; // the front of the north run
  b.bx(wx, wx + 0.62 / SX, y, y + 0.9, cz, STAIR.z1 + 0.015 / SZ, M.drawersOak);
  b.bx(STAIR.x1 - 0.075 / SX, wx + 0.66 / SX, y + 0.9, y + 0.94, cz - 0.04 / SZ, STAIR.z1 + 0.015 / SZ, M.oak); // (it caps the stair wall too)
  b.bx(0, wx, y, y + 0.9, cz, STAIR.z0, M.drawersOak);
  b.bx(0, STAIR.x1 - 0.075 / SX, y + 0.9, y + 0.94, cz - 0.04 / SZ, STAIR.z0, M.oak);
  b.blob(1.0, (STAIR.z1 - cz) * SZ + 0.3, wx + 0.31 / SX, y, (STAIR.z1 + cz) / 2);
  b.blob(wx * SX + 0.3, 1.0, wx / 2, y, cz + 0.31 / SZ);
  b.solid(STAIR.x1, cz - 0.04, STAIR.x1 + 0.7, STAIR.z1, 1);
  b.solid(0, cz - 0.04, STAIR.x1, STAIR.z0, 1);
  const gx = STAIR.x1 - 0.04 / SX; // (the screen's frame flush with the stair wall below)
  const gz = STAIR.z0 - 0.035 / SZ;
  glassWall(b, M, { axis: 'z', at: gx, from: gz, to: STAIR.z1, y0: y + 0.94, y1: y + CEIL, level: 1 });
  glassWall(b, M, { axis: 'x', at: gz, from: 0, to: gx, y0: y + 0.94, y1: y + CEIL, level: 1 });
  for (const z of [7.65, 8.3, 8.95, 9.6]) stool(b, M, STAIR.x1 + 1.0, y, z, M.olive, 0.72, true, Math.PI / 2); // four at the counter, close together at its far end (as in the render)
  b.label = '3d printer';
  [3.75, 4.35, 4.95].forEach((z, k) => F.printer(b, M, wx + 0.38 / SX, y + 0.94, z, -Math.PI / 2, k));
  // tool wall + wet end on the east wall
  b.label = 'tool wall';
  const ex = W - 0.63 / SX;
  const sk = { x0: W - 0.54 / SX, x1: W - 0.12 / SX, z0: 6.56, z1: 7.04 }; // the sink opening
  b.bx(ex, W, y, y + 0.9, 0.6, 6.5, M.drawers);
  b.bx(ex, W, y, y + 0.9, 7.1, 7.6, M.drawers);
  b.bx(ex, W, y, y + 0.7, 6.5, 7.1, M.drawers); // the cupboard under the sink
  b.bx(ex, ex + 0.02 / SX, y + 0.7, y + 0.9, 6.5, 7.1, M.drawers);
  const tx = ex - 0.04 / SX;
  b.bx(tx, W, y + 0.9, y + 0.94, 0.6, sk.z0, M.white);
  b.bx(tx, W, y + 0.9, y + 0.94, sk.z1, 7.6, M.white);
  b.bx(tx, sk.x0, y + 0.9, y + 0.94, sk.z0, sk.z1, M.white);
  b.bx(sk.x1, W, y + 0.9, y + 0.94, sk.z0, sk.z1, M.white);
  b.bx(W - 0.012 / SX, W, y + 0.94, y + 2.35, 0.6, 7.6, M.labGrey);
  b.blob(1.0, 8.2, W - 0.4 / SX, y, 4.1);
  b.geo(new THREE.PlaneGeometry(1.8, 0.55), M.boardRobotica, W - 0.015 / SX, y + 1.25, 3.4, -Math.PI / 2);
  if (DETAIL) cubbies(b, M, W - 0.21 / SX, y + 1.55, 4.1, Math.PI / 2, 17, 2, 0.4, 0.38, 0.38, M.labGrey, 7); // one continuous run, as in the render
  else {
    cubbies(b, M, W - 0.21 / SX, y + 1.55, 1.6, Math.PI / 2, 4, 2, 0.4, 0.38, 0.38, M.labGrey, 7);
    cubbies(b, M, W - 0.21 / SX, y + 1.55, 5.5, Math.PI / 2, 5, 2, 0.4, 0.38, 0.38, M.labGrey, 8);
  }
  F.sink(b, M, sk.x0 * SX, sk.x1 * SX, y + 0.94, sk.z0 * SZ, sk.z1 * SZ);
  b.solid(W - 0.75 / SX, 0.5, W, 7.7, 1);
  // team benches in two straight rows (lined up with the room), stools on both long sides
  for (const [x, z] of [[3.75, 2.6], [5.95, 2.6], [3.75, 6.0], [5.95, 6.0]]) {
    (DETAIL ? F.bench : table)(b, M, x, y, z, 1.5, 0.8, 0.95, M.labTop, M.steelGrey, 0); // (1.5 m: 5 cm off each end)
    b.label = 'bench items';
    b.push(x, y + 0.95, z, 0);
    b.box(0.6, 0.003, 0.45, -0.35, 0, 0, M.cutMat);
    if (DETAIL) F.benchBits(b, M, x > 4.5 ? 1 : 0);
    b.pop();
    laptop(b, M, x + 0.25, y + 0.95, z, Math.PI);
    for (const lx of [-0.4, 0.4]) stool(b, M, x + lx, y, z + 0.68, M.olive, 0.68); // two per bench, on the laptop side, facing the project wall
    b.solidM(x * SX - 0.8, z * SZ - 0.45, x * SX + 0.8, z * SZ + 0.45, 1);
  }
  // mobile carts, square to the room on the centre line between the benches
  for (const [x, z] of [[4.85, 4.3], [4.85, 7.75]]) {
    if (DETAIL) {
      F.cart(b, M, x, y, z, 0);
      b.solidM(x * SX - 0.4, z * SZ - 0.52, x * SX + 0.4, z * SZ + 0.52, 1);
      continue;
    }
    b.label = 'cart';
    b.push(x, y, z, 0);
    b.rbox(0.6, 0.85, 0.9, 0, 0.14, 0, M.white, 0.015);
    b.box(0.5, 0.65, 0.005, 0, 0.22, -0.452, M.glass);
    for (const [wx2, wz] of [[-0.25, -0.38], [0.25, -0.38], [-0.25, 0.38], [0.25, 0.38]]) b.cyl(0.07, 0.07, 0.035, wx2, 0.07, wz, M.white, 16, 0, Math.PI / 2);
    b.box(0.03, 0.62, 0.62, 0, 1.0, 0, M.white);
    b.box(0.004, 0.58, 0.58, 0.017, 1.02, 0, M.boardStrategy);
    b.box(0.004, 0.58, 0.58, -0.017, 1.02, 0, M.boardStrategy);
    b.blob(0.9, 1.2, 0, 0, 0);
    b.pop();
    b.solidM(x * SX - 0.4, z * SZ - 0.52, x * SX + 0.4, z * SZ + 0.52, 1);
  }
  b.label = 'build bay';
  b.bx(2.8, 5.6, y, y + 0.002, 8.6, 11.3, M.grey);
  tvStand(b, M, 3.56, y, 11.25, 0, M.screenTech); // (in front of the glass to the Studio, centred on its pane, facing the build bay)
  b.solid(3.2, 11.0, 3.95, 11.55, 1);
  // set corner: the green-screen filming set
  if (DETAIL) {
    F.mediaCorner(b, M, y, 6.0, W, 8.4, 11.6 - 0.04 / SZ, CEIL);
    return;
  }
  b.label = 'set corner';
  b.bx(W - 0.012 / SX, W, y, y + CEIL, 8.4, 11.6 - 0.05 / SZ, M.greenScreen);
  b.bx(6.0, W - 0.012 / SX, y, y + CEIL, 11.6 - 0.05 / SZ, 11.6 - 0.04 / SZ, M.greenScreen);
  b.bx(6.0, W, y, y + 0.006, 8.4, 11.6 - 0.05 / SZ, M.greenScreen);
  b.label = 'curtain';
  for (let z = 8.45; z < 9.9; z += 0.1) b.cyl(0.055, 0.055, CEIL - 0.1, 6.0, y + 0.02, z, M.curtain, 8);
  b.bx(6.0 - 0.02 / SX, 6.0 + 0.02 / SX, y + CEIL - 0.08, y + CEIL - 0.05, 8.4, 11.5, M.steelGrey);
  b.label = 'tripod';
  b.push(6.6, y, 10.7, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.cyl(0.012, 0.012, 1.5, Math.cos(a) * 0.2, 0.72, Math.sin(a) * 0.2, M.black, 6, Math.sin(a) * 0.27, -Math.cos(a) * 0.27);
  }
  b.box(0.15, 0.1, 0.1, 0, 1.45, 0, M.black);
  b.pop();
  b.label = 'umbrella light';
  b.push(7.4, y, 9.0, 0);
  b.cyl(0.012, 0.012, 1.9, 0, 0, 0, M.black, 6);
  b.cyl(0.0, 0.5, 0.32, 0.15, 1.95, 0.1, M.podWhite, 20, 0, -0.9, { open: true });
  b.pop();
  b.solid(6.0, 8.4, 6.12, 9.9, 1);
}

function studio(b, M) {
  const y = F1;
  glassWall(b, M, { axis: 'x', at: 11.6, from: 0, to: W, y0: y, y1: y + CEIL, level: 1, openings: [{ a: 0.2, b: 1.35 }, { a: 4.3, b: 5.3 }], leafSide: -1 });
  b.label = 'sign';
  b.geo(new THREE.PlaneGeometry(1.3, 0.1625), M.sign('LEARNING STUDIO'), 3.5625, y + 2.65, 11.6 - 0.05 / SZ, Math.PI); // (inside one pane)
  b.geo(new THREE.PlaneGeometry(1.3, 0.1625), M.sign('LEARNING STUDIO'), 3.5625, y + 2.65, 11.6 + 0.05 / SZ, 0);
  // two study pods facing the room, big enough to sit in (as in the render): 1.3 m across and 1.95 m tall, a felt
  // lining, a visor over the 1.7 m opening, a light in the felt ceiling, a desk shelf at the back
  const PR = 0.65;
  const PH = 1.95;
  const pz = 12.5;
  for (const x of [5.97, 7.3]) {
    b.label = 'pod';
    b.push(x, y, pz, 0);
    b.cyl(PR, PR, PH, 0, 0, 0, M.podWhite, 36, 0, 0, { open: true, t0: Math.PI * 0.25, tl: Math.PI * 1.5 });
    b.cyl(PR - 0.05, PR - 0.05, PH - 0.04, 0, 0.02, 0, M.podBlue, 36, 0, 0, { open: true, t0: Math.PI * 0.27, tl: Math.PI * 1.46 });
    b.cyl(PR, PR, 0.25, 0, PH - 0.25, 0, M.podWhite, 12, 0, 0, { open: true, t0: -Math.PI * 0.25, tl: Math.PI * 0.5 });
    b.cyl(PR - 0.05, PR - 0.05, 0.23, 0, PH - 0.25, 0, M.podBlue, 12, 0, 0, { open: true, t0: -Math.PI * 0.27, tl: Math.PI * 0.54 });
    b.cyl(PR, PR, 0.04, 0, PH, 0, M.podWhite, 36);
    b.cyl(PR - 0.05, PR - 0.05, 0.02, 0, PH - 0.04, 0, M.podBlue, 36);
    b.cyl(0.14, 0.14, 0.01, 0, PH - 0.05, 0, M.led, 20);
    b.cyl(PR - 0.05, PR - 0.05, 0.02, 0, 0.0, 0, M.podBlue, 36);
    b.rbox(0.56, 0.03, 0.24, 0, 0.74, -0.4, M.white, 0.01);
    b.blob(1.7, 1.7, 0, 0, 0);
    b.pop();
    woodChair(b, M, x, y, pz + 0.1 / SZ, 0, M.plasticBeige);
    b.solidM(x * SX - PR - 0.03, pz * SZ - PR - 0.03, x * SX + PR + 0.03, pz * SZ + 0.3, 1);
  }
  // two large whiteboards and a column of headphones on the east wall (as in the 360 tour)
  b.label = 'writing wall';
  for (const [k, zc] of [[1, 14.05], [3, 15.7]]) {
    b.geo(new THREE.PlaneGeometry(1.6, 2.25), M.boards[k], W - 0.012 / SX, y + 1.5, zc, -Math.PI / 2);
    for (const yy of [0.36, 2.62]) b.bx(W - 0.03 / SX, W, y + yy, y + yy + 0.025, zc - 0.81, zc + 0.81, M.chrome);
    for (const zz of [zc - 0.81, zc + 0.79]) b.bx(W - 0.03 / SX, W, y + 0.36, y + 2.645, zz, zz + 0.02, M.chrome);
  }
  F.headphoneWall(b, M, W, y, 17.0);
  b.label = 'logo wall';
  b.bx(W - 0.01 / SX, W, y, y + CEIL, 18.2, L, M.rose);
  // standing ledge along the west windows
  b.label = 'standing ledge';
  b.bx(0.0, 0.45, y + 1.02, y + 1.06, 12.0, 18.0, M.oak);
  for (const z of [12.0, 15.8, 17.96]) b.bx(0.0, 0.42, y, y + 1.02, z, z + 0.04, M.oak); // (end panels and one in the middle, clear of the stools)
  for (let z = 12.8; z < 18; z += 1.2) stool(b, M, 0.42, y, z, M.olive, 0.75, false, Math.PI / 2); // (tucked under the ledge: the walkway stays clear)
  b.solid(0, 12.0, 0.72, 18.0, 1);
  // nesting desk clusters with laptops
  const chairCols = [M.plasticYellow, M.plasticBeige];
  const cluster = (cx, cz) => {
    let k = 0;
    for (const sx of [-0.6, 0.6]) {
      for (const sz of [-0.3, 0.3]) {
        b.label = 'desk cluster';
        b.push(cx, y, cz, 0);
        (DETAIL ? F.desk : table)(b, M, sx, 0, sz, 1.18, 0.58, 0.74, M.white, M.white);
        const face = sz < 0 ? Math.PI : 0;
        woodChair(b, M, sx, 0, sz * 2.55, face, chairCols[k++ % 2]);
        if (k % 2) laptop(b, M, sx, 0.74, sz * 0.55, face + Math.PI);
        b.pop();
      }
    }
    b.solidM(cx * SX - 1.25, cz * SZ - 0.98, cx * SX + 1.25, cz * SZ + 0.98, 1);
  };
  cluster(2.6, 14.4);
  cluster(5.0, 16.0);
  // (the whiteboard wall is kept clear: no tables along it)
  // gathering circle: rug, poufs, screen on a stand
  b.label = 'gathering';
  b.push(2.4, y, 19.0, 0);
  b.cyl(1.45, 1.45, 0.012, 0, 0, 0, M.rug, 48);
  b.pop();
  const pcols = [M.pouf1, M.pouf2, M.pouf3, M.pouf4];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + 0.65 + (i * (Math.PI * 2 - 1.3)) / 5;
    pouf(b, 2.4 + (Math.cos(a) * 1.05) / SX, y + 0.012, 19.0 + (Math.sin(a) * 1.05) / SZ, pcols[i % 4], 0.24, 0.42 - (i % 2) * 0.18);
  }
  // the south wall (as in the 360 tour): an oak wall unit with the screen, whiteboards, bookcase and cubbies of
  // floor cushions; the dusty pink logo wall above the meeting booth in the corner
  F.studioWallUnit(b, M, 0.55, 5.15, y, L, CEIL);
  b.label = 'logo wall';
  b.bx(5.15, W, y, y + CEIL, L - 0.01, L, M.rose);
  b.geo(new THREE.PlaneGeometry(1.6, 0.8), M.logoPlain, 6.55, y + 2.3, L - 0.015, Math.PI);
  // meeting booth: curved upholstered bench around a round table (south-east corner)
  b.label = 'meeting booth';
  const cx = 6.4;
  const cz = 19.5;
  b.push(cx, y, cz, 0);
  arc(b, 0, 1.05, -0.35 * Math.PI, 0.9 * Math.PI, 14, 0.5, 0.45, M.sofaGreen, 0.04);
  arc(b, 0, 1.32, -0.35 * Math.PI, 0.9 * Math.PI, 16, 0.14, 1.25, M.sofaGreen, 0.05);
  arc(b, 0, 1.43, -0.35 * Math.PI, 0.9 * Math.PI, 16, 0.07, 1.3, M.oak);
  for (let i = 0; i < 8; i++) {
    const a = -0.35 * Math.PI + ((i + 0.5) * 1.25 * Math.PI) / 8;
    b.blob(0.9, 0.9, Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2);
  }
  b.pop();
  roundTable(b, M, cx, y, cz, 0.55);
  b.solidM(cx * SX - 0.6, cz * SZ - 0.6, cx * SX + 0.6, cz * SZ + 0.6, 1);
  for (let i = 0; i < 6; i++) {
    const a = -0.3 * Math.PI + (i * 1.15 * Math.PI) / 5;
    const px = cx * SX + Math.cos(a) * 1.2;
    const pz = cz * SZ + Math.sin(a) * 1.2;
    b.solidM(px - 0.3, pz - 0.3, px + 0.3, pz + 0.3, 1);
  }
}

// ---------------------------------------------------------------- outside (metres via pushRaw)
function tree(b, M, x, z, s = 1, seed = 1, base = -0.4) {
  b.label = 'tree';
  b.pushRaw();
  let k = seed;
  const rnd = () => ((k = (k * 16807) % 2147483647) / 2147483647);
  const h = (3 + rnd() * 1.5) * s;
  // a crooked trunk, leaning its own way (each tree differs)
  const trunk = F.crookedTrunk(b, M.trunk, x, base, z, h + 0.6, 0.2 * s, 0.11 * s, 4, 0.05 + rnd() * 0.14, rnd() * Math.PI * 2, rnd);
  const top = trunk.top;
  // a few forks so the canopy has something to sit on
  for (let i = 0; i < 3; i++) {
    const a = rnd() * Math.PI * 2;
    const t = 0.35 + rnd() * 0.3;
    b.cyl(0.05 * s, 0.08 * s, 1.6 * s, top.x + Math.cos(a) * 0.35 * s, top.y - 0.7, top.z + Math.sin(a) * 0.35 * s, M.trunk, 6, Math.sin(a) * t, -Math.cos(a) * t);
  }
  b.pop();
  // canopy: clumps of the real leaf mesh (impostor cards), stacked into a crown round the trunk's top, each
  // tilted and stretched a little differently so no two crowns read the same
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2;
    const d = (i === 0 ? 0 : 0.6 + rnd() * 0.6) * s;
    b.models.push({ kind: 'canopy', x: top.x + Math.cos(a) * d, y: top.y - 0.6 - 0.7 * s + rnd() * 1.1 * s, z: top.z + Math.sin(a) * d, ry: rnd() * 6.28, h: (2.1 + rnd() * 1.0) * s, w: 0.8 + rnd() * 0.5, tilt: [(rnd() - 0.5) * 0.35, (rnd() - 0.5) * 0.35] });
  }
}
// ---------------------------------------------------------------- photo assets (Poly Haven, CC0)
// Each entry: which file, which node(s) inside it to use (some Poly Haven files hold several
// variants side by side), and the target height in metres.
const MODEL_FILES = {
  tall: { file: 'pachira_aquatica_01', nodes: /_d$/, h: 1.45 },
  medium: { file: 'potted_plant_02', h: 1.05 },
  small: { file: 'potted_plant_04', h: 0.32 },
  // outdoor foliage: crowns built from the pachira's real leaf mesh, drawn as impostor cards
  canopy: { file: 'pachira_aquatica_01', impostor: true },
  shrub: { file: 'pachira_aquatica_01', impostor: true },
};

// Keep only the nodes we want and normalise them: centred on x/z, standing on y = 0, 1 unit tall.
function pick(src, nodes) {
  src.updateMatrixWorld(true);
  const group = new THREE.Group();
  for (const c of [...src.children]) if (!nodes || nodes.test(c.name)) group.add(c.clone());
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const norm = new THREE.Matrix4().makeScale(1 / size.y, 1 / size.y, 1 / size.y)
    .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z));
  return { group, norm, aspect: Math.max(size.x, size.z) / size.y };
}

// Build a rounded crown from many copies of the real leaf cluster, render it once into a
// texture, and draw every canopy / hedge as three crossed cards with that picture.
function impostorFoliage(src, spotsByKind, renderer) {
  const leaves = src.children.find((c) => /leaves_d$/.test(c.name));
  const crown = new THREE.Group();
  let k = 11;
  const rnd = () => ((k = (k * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const l = leaves.clone();
    const u = rnd() * Math.PI * 2;
    const v = Math.acos(2 * rnd() - 1);
    const r = 0.55 + rnd() * 0.5;
    l.position.set(Math.sin(v) * Math.cos(u) * r * 1.3, Math.cos(v) * r * 0.9, Math.sin(v) * Math.sin(u) * r * 1.3);
    l.rotation.set((rnd() - 0.5) * 0.8, rnd() * 6.28, (rnd() - 0.5) * 0.8);
    l.scale.setScalar(0.75 + rnd() * 0.5);
    crown.add(l);
  }
  crown.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(crown);
  const size = box.getSize(new THREE.Vector3());
  const aspect = Math.max(size.x, size.z) / size.y;
  const res = 1024;
  const rt = new THREE.WebGLRenderTarget(res, Math.round(res / aspect), { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const s2 = new THREE.Scene();
  s2.add(new THREE.HemisphereLight(0xeaf4ff, 0x3a4a2a, 2.2));
  const d = new THREE.DirectionalLight(0xfff2dd, 2.4);
  d.position.set(1, 2, 2);
  s2.add(d);
  const holder = new THREE.Group();
  crown.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  holder.add(crown);
  holder.scale.setScalar(1 / size.y);
  s2.add(holder);
  const half = aspect / 2;
  const cam = new THREE.OrthographicCamera(-half, half, 1, 0, -10, 10);
  cam.position.set(0, 0, 5);
  const prev = { t: renderer.getRenderTarget(), c: renderer.getClearColor(new THREE.Color()), a: renderer.getClearAlpha(), xr: renderer.xr.enabled, tm: renderer.toneMapping };
  renderer.xr.enabled = false;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(s2, cam);
  renderer.setRenderTarget(prev.t);
  renderer.setClearColor(prev.c, prev.a);
  renderer.xr.enabled = prev.xr;
  renderer.toneMapping = prev.tm;

  const mat = new THREE.MeshLambertMaterial({ map: rt.texture, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: rt.texture, emissiveIntensity: 0.5 });
  mat.name = 'foliage impostor';
  const card = new THREE.PlaneGeometry(aspect, 1);
  card.translate(0, 0.5, 0);
  const geo = mergeGeometries([card.clone(), card.clone().rotateY(Math.PI / 3), card.clone().rotateY((2 * Math.PI) / 3)]);
  const spots = spotsByKind.flat();
  const inst = new THREE.InstancedMesh(geo, mat, spots.length);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  spots.forEach((s, i) => {
    const w = s.w ?? 1; // horizontal stretch (hedges are wider than tall)
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(s.tilt?.[0] ?? 0, s.ry, s.tilt?.[1] ?? 0, 'YXZ'));
    m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.h * w, s.h, s.h * w));
    inst.setMatrixAt(i, m);
    const kk = 0.82 + ((i * 37) % 19) / 100;
    inst.setColorAt(i, c.setRGB(kk, kk, kk * 0.95));
  });
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.computeBoundingSphere();
  return inst;
}

// Every copy of a model is one InstancedMesh per part, so plants cost only a few draw calls.
function placeModels(spots, root, manager, renderer) {
  const loader = new GLTFLoader(manager);
  const files = new Map();
  for (const [kind, def] of Object.entries(MODEL_FILES)) {
    const mine = spots.filter((s) => s.kind === kind).map((s) => ({ ...s, h: s.h ?? def.h }));
    if (!mine.length) continue;
    if (!files.has(def.file)) files.set(def.file, []);
    files.get(def.file).push({ def, mine });
  }
  for (const [file, uses] of files) {
    loader.load(`assets/models/${file}/${file}.gltf`, (gltf) => {
      const src = gltf.scene;
      src.updateMatrixWorld(true);
      const imp = uses.filter((u) => u.def.impostor);
      if (imp.length) root.add(impostorFoliage(src, imp.map((u) => u.mine), renderer));
      for (const { def, mine } of uses.filter((u) => !u.def.impostor)) {
        const { group, norm } = pick(src, def.nodes);
        const place = mine.map((s) => new THREE.Matrix4().compose(
          new THREE.Vector3(s.x, s.y, s.z),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.ry),
          new THREE.Vector3(s.h, s.h, s.h),
        ).multiply(norm));
        const m = new THREE.Matrix4();
        group.traverse((o) => {
          if (!o.isMesh) return;
          if (o.material.alphaTest > 0) o.material.alphaToCoverage = true; // smooth leaf edges with MSAA
        const inst = new THREE.InstancedMesh(o.geometry, o.material, place.length);
          place.forEach((p, i) => inst.setMatrixAt(i, m.multiplyMatrices(p, o.matrixWorld)));
          inst.castShadow = true;
          inst.receiveShadow = true;
          inst.computeBoundingSphere();
          inst.name = `${file}:${o.name}`;
          root.add(inst);
        });
      }
    }, undefined, (e) => console.warn('model failed', file, e));
  }
}

// ---------------------------------------------------------------- public API
export function buildEdge(scene, renderer) {
  const manager = new THREE.LoadingManager();
  let resolveReady;
  const ready = new Promise((r) => (resolveReady = r));
  manager.onLoad = () => resolveReady();
  manager.onError = (url) => console.warn('asset failed', url);
  const M = materials(manager);
  const b = new Builder();
  b.M = M;
  b.models = [];
  shell(b, M);
  stair(b, M);
  reception(b, M);
  schoolHall(b, M);
  office(b, M);
  wc(b, M);
  hub(b, M);
  lab(b, M);
  studio(b, M);
  buildSite(b, M, tree); // the real PaRK Alfragide campus and surroundings (src/site.js)
  const root = new THREE.Group();
  root.name = 'edge-academy';
  const layers = b.finish(root);
  scene.add(root);
  const traffic = makeTraffic(root); // cars on the motorway
  let daySky = T.sky();
  let duskSky = null;
  let dusk = false;
  scene.background = daySky;
  placeModels(b.models, root, manager, renderer);
  new RGBELoader(manager).load('assets/hdri/sky_2k.hdr', (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    daySky = hdr;
    if (!dusk) scene.background = hdr;
  });
  /** Day (a November morning) or dusk (the sun setting in the west-south-west). sunDir: towards the sun, in the model. */
  function setDusk(on, sunDir) {
    dusk = on;
    if (on && !duskSky) duskSky = T.duskSky(Math.atan2(sunDir.z, sunDir.x) / (2 * Math.PI) + 0.5);
    scene.background = on ? duskSky : daySky;
    siteDusk(M, on);
  }

  const S = { x0: STAIR.x0 * SX, x1: STAIR.x1 * SX, z0: STAIR.z0 * SZ, z1: STAIR.z1 * SZ };
  // walkable height at (x, z) given the player's current height
  function groundAt(x, z, curY) {
    if (x < S.x1 && z > S.z0 && z < S.z1) return Math.max(0, Math.min(1, (z - S.z0) / (S.z1 - S.z0))) * F1;
    return curY > F1 / 2 ? F1 : 0;
  }

  const P = (x, y, z, yaw, name) => ({ name, x: x * SX, y, z: z * SZ, yaw });
  const stops = [
    P(7.0, 0, 4.6, Math.PI / 2 + 0.25, 'Reception'),
    P(6.9, 0, 9.8, 0.93, 'Office & lounge'),
    P(5.3, 0, 12.3, Math.PI - 0.35, 'Hub'),
    P(5.35, 0, 14.9, Math.PI, 'Hub: presentation'),
    P(0.75, 0, 2.2, Math.PI, 'Staircase'),
    P(4.9, F1, 11.0, 0.12, 'Project Lab'),
    P(4.8, F1, 12.3, Math.PI + 0.3, 'Learning Studio'),
    P(4.6, F1, 17.7, 2.2, 'Studio: gathering'),
  ];
  const R = (level, name, x, z) => ({ level, name, x: x * SX, z: z * SZ });
  const rooms = [
    R(0, 'RECEPTION', 5.3, 4.2), R(0, 'OFFICE', 3.1, 8.1), R(0, 'WC', 1.5, 12.1), R(0, 'HUB', 5.0, 16.2),
    R(1, 'LAB', 4.3, 5.0), R(1, 'STUDIO', 4.3, 16.2),
  ];

  return { ready, update: (dt) => traffic.update(dt), setDusk, layers, colliders: b.colliders, groundAt, stops, rooms, size: { W: W * SX, L: L * SZ, F1 }, overlaps: (tol) => findOverlaps(b.prims, tol) };
}
