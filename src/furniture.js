// Detailed furniture, modelled on the ZPZ Partners concept renders of the Edge Academy:
//   one-piece moulded shells (stacking chairs on chrome wire sleds, shell chairs on splayed oak legs), stools on
//   five-star bases with castors and foot rings, height-adjustable benches, nesting desks on castors, carts with
//   frosted drawers and big wheels, barrel poufs with piped cushions, a curved bookcase filled with single books,
//   soft modular lounge seating, a laptop table on a pole, 3D printers and an office task chair.
// Every piece is made of simple parts that the Builder merges by material, so a room still draws in a handful of
// calls. Local metres; a seat faces local -z (its back is at +z).
// Switch: add ?simple to the address for the earlier, plainer furniture.
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const DETAIL = !(typeof location !== 'undefined' && /[?&]simple\b/.test(location.search));

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const circ = (t) => Math.sqrt(1 - (1 - Math.min(1, Math.max(0, t))) ** 2); // a quarter circle, 0..1

// ---------------------------------------------------------------- extra materials (made once, kept on M)
function X(M) {
  if (M.fx) return M.fx;
  const BR = brushedMaps();
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
  const fx = {
    frost: std(0xf3f5f6, { roughness: 0.3, transparent: true, opacity: 0.55, depthWrite: false }),
    books: std(0xffffff, { vertexColors: true, roughness: 0.75 }),
    peach: std(0xe6b791, { roughness: 0.85 }),
    sage: std(0xa9b79a, { roughness: 0.85 }),
    mist: std(0xcfd7df, { roughness: 0.85 }),
    tyre: std(0x26272a, { roughness: 0.75 }),
    smoke: std(0x2a3036, { roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.82 }),
    filament: std(0xe0743c, { roughness: 0.5 }),
    pcb: std(0x1f5e86, { roughness: 0.5 }),
    knife: std(0xf0c419, { roughness: 0.4 }),
    mesh: std(0xd9dcdf, { roughness: 0.9 }),
    print: std(0xeeeeea, { roughness: 0.55 }),
    body: std(0x2b2d31, { roughness: 0.45, metalness: 0.2 }),
    tally: new THREE.MeshBasicMaterial({ color: 0xff3030 }),
    felt: std(0x9aa0a6, { roughness: 1 }),
    alu: std(0xe0e3e7, { roughness: 0.46, metalness: 0.62, roughnessMap: BR.rough, normalMap: BR.normal, normalScale: new THREE.Vector2(0.12, 0.12) }),
    pad: std(0xc2c5c9, { roughness: 0.25, metalness: 0.6 }),
    tape: std(0xe4d9b9, { roughness: 0.85 }),
    keys: new THREE.MeshStandardMaterial({ map: keyboard(), roughness: 0.6 }),
    steel: std(0xc6cacf, { roughness: 0.32, metalness: 0.85 }),
    beige: M.sofaGreen.clone(),
    taupe: M.sofaGreen.clone(),
    dark: new Map(),
  };
  fx.beige.color.set(0xd9cdb8);
  fx.taupe.color.set(0x8f8a76);
  fx.beige.sheenColor?.set(0xf2ece2);
  fx.taupe.sheenColor?.set(0xc2bdaa);
  fx.frost.userData.noShadow = true;
  fx.smoke.userData.noShadow = true;
  Object.assign(fx.tally.userData, { unlit: true, noShadow: true });
  M.fx = fx;
  return fx;
}
/** Brushed-metal maps: fine streaks (roughness and relief), tiling. */
function brushedMaps() {
  const w = 128;
  const h = 128;
  let s = 21;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const hgt = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const base = r();
    let v = base;
    for (let x = 0; x < w; x++) {
      v += (r() - 0.5) * 0.06 + (base - v) * 0.05;
      hgt[y * w + x] = v;
    }
  }
  const canvas = (fill) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.data.set(fill(x, y), (y * w + x) * 4);
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    t.anisotropy = 8;
    return t;
  };
  const H = (x, y) => hgt[((y + h) % h) * w + ((x + w) % w)];
  const rough = canvas((x, y) => {
    const v = (0.72 + (H(x, y) - 0.5) * 0.5) * 255;
    return [v, v, v, 255];
  });
  const normal = canvas((x, y) => {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 0.8;
    const dy = (H(x, y + 1) - H(x, y - 1)) * 0.8;
    const l = Math.hypot(dx, dy, 1);
    return [((-dx / l) * 0.5 + 0.5) * 255, ((dy / l) * 0.5 + 0.5) * 255, ((1 / l) * 0.5 + 0.5) * 255, 255];
  });
  return { rough, normal };
}

/** A darker shade of a material (the piping on the poufs). */
function darker(M, mat, k = 0.72) {
  const d = X(M).dark;
  if (!d.has(mat)) {
    const m = mat.clone();
    m.color.multiplyScalar(k);
    d.set(mat, m);
  }
  return d.get(mat);
}

// ---------------------------------------------------------------- geometry helpers
const cache = new Map();
/** Build a geometry once and hand out copies (the Builder transforms what it is given). */
function once(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key).clone();
}

/** Corner points joined by straight runs, each corner rounded off with radius r. */
function roundPath(pts, r, closed = false, steps = 4) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (!closed && (i === 0 || i === n - 1)) {
      out.push(p.clone());
      continue;
    }
    const a = pts[(i - 1 + n) % n];
    const c = pts[(i + 1) % n];
    const da = a.clone().sub(p);
    const dc = c.clone().sub(p);
    const rr = Math.min(r, da.length() * 0.45, dc.length() * 0.45);
    const p0 = p.clone().add(da.normalize().multiplyScalar(rr));
    const p1 = p.clone().add(dc.normalize().multiplyScalar(rr));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      out.push(p0.clone().multiplyScalar((1 - t) ** 2).add(p.clone().multiplyScalar(2 * (1 - t) * t)).add(p1.clone().multiplyScalar(t * t)));
    }
  }
  return out;
}

/** A round bar of radius r swept through the points (no resampling, so the corners stay where they are). */
function sweep(pts, r, radial = 6, closed = false) {
  const n = pts.length;
  const T = pts.map((p, i) => {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const c = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    return c.clone().sub(a).normalize();
  });
  let N = Math.abs(T[0].y) > 0.9 ? v3(1, 0, 0) : v3(0, 1, 0);
  const pos = [];
  const nor = [];
  const uv = [];
  for (let i = 0; i < n; i++) {
    const t = T[i];
    N = N.clone().sub(t.clone().multiplyScalar(N.dot(t))).normalize(); // carried along (parallel transport)
    const B = t.clone().cross(N);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const d = N.clone().multiplyScalar(Math.cos(a)).add(B.clone().multiplyScalar(Math.sin(a)));
      pos.push(pts[i].x + d.x * r, pts[i].y + d.y * r, pts[i].z + d.z * r);
      nor.push(d.x, d.y, d.z);
      uv.push(i / Math.max(1, n - 1), j / radial);
    }
  }
  const idx = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b2 = i * radial + ((j + 1) % radial);
      const c = ((i + 1) % n) * radial + j;
      const d = ((i + 1) % n) * radial + ((j + 1) % radial);
      idx.push(a, b2, c, b2, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A list of triangles with smooth normals; a triangle is turned round if its winding disagrees with them. */
function soup() {
  const P = [];
  const N = [];
  const U = [];
  return {
    tri(p1, p2, p3, n1, n2, n3, u1 = [0, 0], u2 = [0, 0], u3 = [0, 0]) {
      const g = p2.clone().sub(p1).cross(p3.clone().sub(p1));
      if (g.dot(n1.clone().add(n2).add(n3)) < 0) {
        [p2, p3] = [p3, p2];
        [n2, n3] = [n3, n2];
        [u2, u3] = [u3, u2];
      }
      for (const [p, n, u] of [[p1, n1, u1], [p2, n2, u2], [p3, n3, u3]]) {
        P.push(p.x, p.y, p.z);
        N.push(n.x, n.y, n.z);
        U.push(u[0], u[1]);
      }
    },
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      return g;
    },
  };
}

/** A moulded shell of thickness t: fn(u, v) is its mid-surface (u -1..1 across, v 0..1 along). nv: the number of
 *  rows, or the list of v values to put the rows at (closer together where the shell curves most). */
function shellGeo(fn, nu, rows, t) {
  const vs = Array.isArray(rows) ? rows : Array.from({ length: rows + 1 }, (_, j) => j / rows);
  const nv = vs.length - 1;
  const S = soup();
  const P = [];
  const N = [];
  const e = 1e-3;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = -1 + (2 * i) / nu;
      const v = vs[j];
      const du = fn(Math.min(1, u + e), v).sub(fn(Math.max(-1, u - e), v));
      const dv = fn(u, Math.min(1, v + e)).sub(fn(u, Math.max(0, v - e)));
      P.push(fn(u, v));
      N.push(du.cross(dv).normalize());
    }
  }
  const at = (i, j) => j * (nu + 1) + i;
  const off = (k, s) => P[k].clone().addScaledVector(N[k], (s * t) / 2);
  const nrm = (k, s) => N[k].clone().multiplyScalar(s);
  const uvOf = (k) => [(k % (nu + 1)) / nu, vs[Math.floor(k / (nu + 1))]];
  for (const s of [1, -1]) {
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = at(i, j);
        const b2 = at(i + 1, j);
        const c = at(i, j + 1);
        const d = at(i + 1, j + 1);
        S.tri(off(a, s), off(b2, s), off(c, s), nrm(a, s), nrm(b2, s), nrm(c, s), uvOf(a), uvOf(b2), uvOf(c));
        S.tri(off(b2, s), off(d, s), off(c, s), nrm(b2, s), nrm(d, s), nrm(c, s), uvOf(b2), uvOf(d), uvOf(c));
      }
    }
  }
  // the rim all round (going round the edge counter-clockwise in u, v, so edge x normal points outwards)
  const ring = [];
  for (let i = 0; i < nu; i++) ring.push(at(i, 0));
  for (let j = 0; j < nv; j++) ring.push(at(nu, j));
  for (let i = nu; i > 0; i--) ring.push(at(i, nv));
  for (let j = nv; j > 0; j--) ring.push(at(0, j));
  for (let k = 0; k < ring.length; k++) {
    const k0 = ring[k];
    const k1 = ring[(k + 1) % ring.length];
    const o = P[k1].clone().sub(P[k0]).cross(N[k0].clone().add(N[k1])).normalize();
    const A = off(k0, 1);
    const B = off(k1, 1);
    const C = off(k1, -1);
    const D = off(k0, -1);
    S.tri(A, B, C, o, o, o);
    S.tri(A, C, D, o, o, o);
  }
  return S.geometry();
}

/** A side profile (pairs of [z, y]) as a smooth curve in the x = 0 plane. */
function profile(zy) {
  return new THREE.CatmullRomCurve3(zy.map(([z, y]) => v3(0, y, z)), false, 'centripetal');
}

/**
 * A chair shell: the side profile swept across the seat, the back wrapping round the sitter (wrap), the seat
 * edges turned up a touch (lip), and the corners rounded off.
 */
function chairShell(o) {
  const curve = profile(o.profile);
  const total = curve.getLength();
  const seatY = o.profile[2][1];
  const rc = o.corner;
  const R = o.wrapR;
  const fn = (u, v) => {
    const p = curve.getPointAt(v);
    const back = smooth(seatY + 0.02, seatY + 0.14, p.y); // 0 on the seat, 1 up the back
    const hw0 = (o.seatW + (o.backW - o.seatW) * back) / 2;
    // rounded corners, as on a rounded rectangle: only the last rc metres at each end curve in (the edges stay
    // straight)
    const s = Math.min(v, 1 - v) * total;
    const hw = hw0 - (s < rc ? rc - Math.sqrt(Math.max(0, rc * rc - (rc - s) ** 2)) : 0);
    const x = u * hw;
    const wrap = back * (R - Math.sqrt(Math.max(0, R * R - x * x))); // the back curves round the sitter in an arc
    const dish = (1 - back) * o.lip * (x / hw0) ** 2; // the seat's sides rise a touch
    return v3(x, p.y + dish, p.z - wrap);
  };
  // the rows: evenly spaced, closer at both ends (the rounded corners) and round the bend from seat to back
  const vs = new Set();
  const add = (v) => vs.add(Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4);
  for (let s = 0; s <= total; s += 0.07) add(s / total);
  for (const s of [0, 0.012, 0.03, 0.055]) {
    add(s / total);
    add(1 - s / total);
  }
  let vb0 = 0.4;
  let vb1 = 0.7;
  for (let i = 60; i <= 200; i++) {
    const y = curve.getPointAt(i / 200).y;
    if (vb0 === 0.4 && y > seatY + 0.015) vb0 = i / 200;
    if (y > seatY + 0.15) {
      vb1 = i / 200;
      break;
    }
  }
  for (let v = vb0 - 0.03; v <= vb1 + 0.03; v += 0.02) add(v);
  return { fn, vs: [...vs].sort((a, b) => a - b) };
}
const shellOf = (o, t) => {
  const { fn, vs } = chairShell(o);
  return shellGeo(fn, 10, vs, t);
};
const STACK_SHELL = {
  profile: [[-0.24, 0.425], [-0.215, 0.452], [-0.12, 0.46], [0.03, 0.452], [0.15, 0.445], [0.205, 0.47], [0.225, 0.56], [0.245, 0.69], [0.262, 0.83]],
  seatW: 0.47, backW: 0.45, wrapR: 0.55, lip: 0.012, corner: 0.06,
};
const OAK_SHELL = {
  profile: [[-0.225, 0.43], [-0.205, 0.452], [-0.1, 0.46], [0.05, 0.456], [0.15, 0.457], [0.205, 0.485], [0.228, 0.57], [0.242, 0.69], [0.25, 0.8]],
  seatW: 0.48, backW: 0.49, wrapR: 0.42, lip: 0.014, corner: 0.07,
};

/** A flat shape stood up and extruded to height h with soft (bevelled) edges: shape x = x, shape y = -z. */
function extrudeUp(shape, h, bevel, curveSegments = 10) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, h - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return toCreasedNormals(g, 0.7); // (smooth across the curve and the rounded edges; real corners stay sharp)
}
function roundedRect(w, d, r) {
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -d / 2;
  const y1 = d / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
/** A curved band in plan: radii r0..r1 round (0, cz), plan angles a0..a1 (0 = +x, pi/2 = +z). */
function bandShape(r0, r1, a0, a1, cz = 0) {
  const s = new THREE.Shape();
  const pt = (r, a) => [Math.cos(a) * r, -(cz + Math.sin(a) * r)];
  const n = 48;
  s.moveTo(...pt(r1, a0));
  for (let i = 1; i <= n; i++) s.lineTo(...pt(r1, a0 + ((a1 - a0) * i) / n));
  for (let i = n; i >= 0; i--) s.lineTo(...pt(r0, a0 + ((a1 - a0) * i) / n));
  return s;
}
/** A box with one colour baked into its vertices (books). */
function colourBox(w, h, d, colour) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = colour.r;
    c[i * 3 + 1] = colour.g;
    c[i * 3 + 2] = colour.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
const place = (x, y, z, ry = 0, rz = 0) => new THREE.Matrix4().compose(v3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz, 'YXZ')), v3(1, 1, 1));

// ---------------------------------------------------------------- small parts
function castor(b, M, x, z, r = 0.024) {
  b._box(0.024, 0.03, 0.028, x, r * 1.4, z, M.black);
  b.cyl(r, r, 0.02, x, r, z + 0.01, X(M).tyre, 8, 0, Math.PI / 2);
}
/** Five-star base with castors (stools, the task chair). */
function starBase(b, M, R = 0.3, mat = M.white) {
  b.cyl(0.045, 0.055, 0.06, 0, 0.05, 0, mat, 12);
  for (let i = 0; i < 5; i++) {
    b.push(0, 0, 0, (i * Math.PI * 2) / 5 + 0.3);
    b._box(0.042, 0.03, R, 0, 0.05, -R / 2, mat, 0, -0.08);
    castor(b, M, 0, -R + 0.02);
    b.pop();
  }
}

// ---------------------------------------------------------------- seating
/** Hub: a stacking chair, one moulded shell on a chrome wire sled. */
export function stackChair(b, M, x, y, z, ry, mat) {
  b.label = 'shell chair';
  b.push(x, y, z, ry);
  b.geo(once('stack-shell', () => shellOf(STACK_SHELL, 0.008)), mat, 0, 0, 0);
  b.geo(once('stack-sled', () => {
    const parts = [];
    for (const sx of [-1, 1]) {
      const xx = sx * 0.2;
      parts.push(sweep(roundPath([v3(xx, 0.008, -0.215), v3(xx, 0.008, 0.215), v3(xx, 0.427, 0.17), v3(xx, 0.437, -0.185)], 0.035, true, 3), 0.0055, 5, true));
    }
    for (const zz of [-0.15, 0.14]) parts.push(sweep([v3(-0.2, 0.432, zz), v3(0.2, 0.432, zz)], 0.005, 6));
    return mergeNonIndexed(parts);
  }), M.chrome, 0, 0, 0);
  b.blob(0.62, 0.62, 0, 0, 0);
  b.pop();
}
/** Studio, Reception, Hub table: a moulded shell chair on splayed oak legs. */
export function oakChair(b, M, x, y, z, ry, mat) {
  b.label = 'wood chair';
  b.push(x, y, z, ry);
  b.geo(once('oak-shell', () => shellOf(OAK_SHELL, 0.011)), mat, 0, 0, 0);
  b._box(0.3, 0.012, 0.28, 0, 0.432, 0, M.steelGrey); // the fixing plate under the seat
  for (const [lx, lz] of [[-0.17, -0.15], [0.17, -0.15], [-0.17, 0.15], [0.17, 0.15]]) b.cyl(0.018, 0.012, 0.45, lx, 0.215, lz, M.oak, 10, -lz * 0.8, lx * 0.8); // (tops in, feet out)
  for (const sz of [-1, 1]) b._box(0.27, 0.03, 0.022, 0, 0.405, sz * 0.124, M.oak); // the oak frame under the seat, joining the legs
  for (const sx of [-1, 1]) b._box(0.022, 0.03, 0.25, sx * 0.14, 0.405, 0, M.oak);
  b.blob(0.6, 0.6, 0, 0, 0);
  b.pop();
}
/** A stool on a five-star base with castors and a foot ring; back = a curved backrest (the Lab's counter stools). */
export function stool(b, M, x, y, z, seat, h = 0.66, back = false, ry = 0) {
  b.label = 'stool';
  b.push(x, y, z, ry);
  b.geo(once('stool-seat', () => new THREE.LatheGeometry([[0, 0], [0.14, 0], [0.168, 0.008], [0.18, 0.03], [0.178, 0.055], [0.165, 0.072], [0.13, 0.08], [0, 0.082]].map(([r, yy]) => new THREE.Vector2(r, yy)), 18)), seat, 0, h - 0.082, 0);
  b.cyl(0.11, 0.09, 0.03, 0, h - 0.11, 0, M.black, 14); // the seat pan
  b.cyl(0.018, 0.018, 0.32, 0, h - 0.42, 0, M.chrome, 10); // the gas lift
  b.cyl(0.03, 0.034, h - 0.5, 0, 0.08, 0, M.white, 12); // its sleeve
  const ry0 = h * 0.44;
  b.geo(once('stool-ring', () => new THREE.TorusGeometry(0.2, 0.011, 5, 20).rotateX(Math.PI / 2)), M.white, 0, ry0, 0);
  for (let i = 0; i < 3; i++) {
    b.push(0, 0, 0, (i * Math.PI * 2) / 3);
    b._box(0.012, 0.012, 0.17, 0, ry0 - 0.006, -0.115, M.white);
    b.pop();
  }
  starBase(b, M, 0.29, M.white);
  if (back) {
    b.geo(sweep(roundPath([v3(0, h - 0.1, 0.06), v3(0, h - 0.1, 0.2), v3(0, h + 0.2, 0.22)], 0.05), 0.012, 6), M.white, 0, 0, 0);
    b.geo(once('stool-back', () => shellGeo((u, v) => {
      const a = u * 0.7;
      return v3(Math.sin(a) * 0.21, v * 0.15, Math.cos(a) * 0.21);
    }, 8, 3, 0.045)), seat, 0, h + 0.1, 0.02);
  }
  b.blob(0.65, 0.65, 0, 0, 0);
  b.pop();
}
/** Studio: an upholstered barrel pouf with a piped cushion on top (as in the render). */
export function pouf(b, x, y, z, mat, r = 0.24, h = 0.42) {
  const M = b.M;
  b.label = 'pouf';
  b.push(x, y, z, 0);
  const pts = [[0, 0], [r * 0.9, 0], [r * 0.97, 0.012], [r * 1.0, h * 0.25], [r * 1.025, h * 0.5], [r * 0.995, h * 0.74], [r * 0.95, h * 0.85], [r * 0.985, h * 0.89], [r * 0.975, h * 0.97], [r * 0.9, h], [0, h + 0.006]];
  b.geo(new THREE.LatheGeometry(pts.map(([a, c]) => new THREE.Vector2(a, c)), 20), mat, 0, 0, 0);
  b.geo(new THREE.TorusGeometry(r * 0.955, 0.011, 5, 20).rotateX(Math.PI / 2), darker(M, mat), 0, h * 0.855, 0);
  b.blob(r * 2.6, r * 2.6, 0, 0, 0);
  b.pop();
}
/** Hub: one module of the soft green lounge seating (a deep cushion and a curved, rounded back). */
export function loungeModule(b, M, x, z, ry, mat) {
  b.label = 'lounge sofa';
  b.push(x, 0, z, ry);
  b.geo(once('lounge-seat', () => extrudeUp(roundedRect(0.7, 0.62, 0.16), 0.42, 0.06)), mat, 0, 0, -0.04);
  b.geo(once('lounge-back', () => extrudeUp(bandShape(0.86, 1.0, Math.PI / 2 - 0.42, Math.PI / 2 + 0.42, -0.62), 0.84, 0.065, 4)), mat, 0, 0, 0);
  b.blob(1.1, 1.0, 0, 0, 0);
  b.pop();
}
/** Office: a task chair with a mesh back and armrests on a five-star base. */
export function taskChair(b, M, x, y, z, ry) {
  const F = X(M);
  b.label = 'task chair';
  b.push(x, y, z, ry);
  starBase(b, M, 0.31, M.white);
  b.cyl(0.02, 0.02, 0.22, 0, 0.24, 0, M.chrome, 10);
  b.cyl(0.032, 0.035, 0.17, 0, 0.08, 0, M.white, 12);
  b.rbox(0.42, 0.04, 0.4, 0, 0.41, 0, M.white, 0.012);
  b.rbox(0.48, 0.07, 0.47, 0, 0.44, -0.02, F.mesh, 0.03);
  b.geo(sweep(roundPath([v3(-0.22, 0.6, 0.25), v3(0.22, 0.6, 0.25), v3(0.21, 1.08, 0.31), v3(-0.21, 1.08, 0.31)], 0.08, true), 0.014, 6, true), M.white, 0, 0, 0);
  b._box(0.42, 0.47, 0.008, 0, 0.605, 0.28, F.mesh, 0, 0.12);
  b.geo(sweep(roundPath([v3(0, 0.46, 0.12), v3(0, 0.5, 0.26), v3(0, 0.66, 0.27)], 0.05), 0.022, 8), M.white, 0, 0, 0);
  for (const s of [-1, 1]) {
    b.geo(sweep(roundPath([v3(s * 0.25, 0.46, 0.06), v3(s * 0.25, 0.64, 0.05), v3(s * 0.25, 0.645, -0.14)], 0.04), 0.014, 6), M.white, 0, 0, 0);
    b.rbox(0.06, 0.025, 0.24, s * 0.25, 0.64, -0.05, M.black, 0.01);
  }
  b.blob(0.7, 0.7, 0, 0, 0);
  b.pop();
}

// ---------------------------------------------------------------- tables
/** Lab: a height-adjustable bench (T-legs on castors, a cross rail under the top). */
export function bench(b, M, x, y, z, w, d, h, top = M.labTop, frame = M.steelGrey, ry = 0) {
  b.label = 'table';
  b.push(x, y, z, ry);
  b.rbox(w, 0.025, d, 0, h - 0.025, 0, top, 0.006);
  for (const s of [-1, 1]) {
    const lx = s * (w / 2 - 0.16);
    b._box(0.06, 0.03, d - 0.1, lx, h - 0.055, 0, frame);
    b._box(0.085, h - 0.48, 0.065, lx, 0.06, 0, frame);
    b._box(0.07, 0.42, 0.05, lx, h - 0.47, 0, frame);
    b.rbox(0.07, 0.045, d - 0.06, lx, 0.03, 0, frame, 0.012);
    for (const sz of [-1, 1]) castor(b, M, lx, sz * (d / 2 - 0.07), 0.028);
  }
  b._box(w - 0.32, 0.05, 0.03, 0, h - 0.11, 0, frame);
  b._box(0.12, 0.015, 0.05, w / 2 - 0.35, h - 0.04, -d / 2 + 0.06, M.black); // the height switch
  b.blob(w + 0.25, d + 0.25, 0, 0, 0);
  b.pop();
}
/** Lab: the things on a bench (call inside a push at the bench top). */
export function benchBits(b, M, k = 1) {
  const F = X(M);
  b.label = 'bench items';
  // a microcontroller board: chip, pin headers, a USB socket
  b.push(0.58, 0, -0.16 + k * 0.03, 0.3);
  b.box(0.069, 0.0016, 0.054, 0, 0, 0, F.pcb);
  b.box(0.034, 0.003, 0.01, -0.004, 0.0016, -0.004, M.black);
  b.box(0.011, 0.002, 0.011, 0.02, 0.0016, 0.012, M.black);
  for (const s of [-1, 1]) b.box(0.05, 0.008, 0.0025, 0.004, 0.0016, s * 0.024, M.black);
  b.box(0.012, 0.007, 0.014, -0.033, 0.0016, 0.012, M.chrome);
  b.pop();
  // a utility knife on the mat: yellow handle, black slider, the blade out
  b.push(-0.22, 0.003, 0.12, 0.5 + k);
  b.rbox(0.13, 0.016, 0.026, 0, 0, 0, F.knife, 0.006);
  b.box(0.03, 0.004, 0.008, -0.01, 0.016, 0, M.black);
  b.box(0.028, 0.002, 0.013, 0.078, 0.007, 0, M.chrome);
  b.pop();
  // a steel rule on the mat
  b.box(0.3, 0.0012, 0.025, -0.35, 0.003, -0.18, F.steel, 0.08);
  // a sharpened pencil
  b.cyl(0.0045, 0.0045, 0.16, 0.6, 0.0045, 0.21, F.knife, 6, 0, Math.PI / 2);
  b.cyl(0.0004, 0.0045, 0.018, 0.689, 0.0045, 0.21, M.oak, 6, 0, -Math.PI / 2);
  // a roll of masking tape, lying flat
  b.geo(once('tape', () => new THREE.LatheGeometry([[0.022, 0], [0.04, 0], [0.04, 0.019], [0.022, 0.019], [0.022, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 20)), F.tape, 0.66, 0, 0.08);
  // a spool of wire
  b.cyl(0.032, 0.032, 0.004, 0.68, 0, -0.03, M.black, 16);
  b.cyl(0.026, 0.026, 0.022, 0.68, 0.004, -0.03, F.filament, 16);
  b.cyl(0.032, 0.032, 0.004, 0.68, 0.026, -0.03, M.black, 16);
}
/** Studio: a nesting desk, white, on slanted legs with castors. */
export function desk(b, M, x, y, z, w, d, h, top = M.white, leg = M.white, ry = 0) {
  b.label = 'table';
  b.push(x, y, z, ry);
  b.rbox(w, 0.025, d, 0, h - 0.025, 0, top, 0.006);
  b._box(w - 0.16, 0.04, 0.022, 0, h - 0.07, d / 2 - 0.08, leg);
  for (const s of [-1, 1]) {
    const lx = s * (w / 2 - 0.07);
    b._box(0.05, 0.03, d - 0.08, lx, h - 0.055, 0, leg);
    b.geo(sweep([v3(lx, h - 0.06, 0.05), v3(lx, 0.05, -0.05)], 0.016, 8), leg, 0, 0, 0);
    b.geo(sweep([v3(lx, 0.045, -d / 2 + 0.06), v3(lx, 0.045, d / 2 - 0.06)], 0.016, 8), leg, 0, 0, 0);
    for (const sz of [-1, 1]) castor(b, M, lx, sz * (d / 2 - 0.06), 0.022);
  }
  b.blob(w + 0.25, d + 0.25, 0, 0, 0);
  b.pop();
}
/** Hub: a round white table on four splayed oak legs with an oak ring. */
export function roundTable(b, M, x, y, z, r, h = 0.74, top = M.white) {
  b.label = 'round table';
  b.push(x, y, z, 0);
  b.cyl(r, r, 0.025, 0, h - 0.025, 0, top, 40);
  b.cyl(r * 0.5, r * 0.5, 0.035, 0, h - 0.06, 0, M.oak, 28);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const r0 = r * 0.42;
    const r1 = r * 0.62;
    const t = Math.atan2(r1 - r0, h - 0.06);
    const len = Math.hypot(r1 - r0, h - 0.06);
    const rm = (r0 + r1) / 2;
    b.cyl(0.024, 0.017, len, Math.cos(a) * rm, (h - 0.06) / 2, Math.sin(a) * rm, M.oak, 8, -t * Math.sin(a), t * Math.cos(a));
  }
  b.blob(r * 2.4, r * 2.4, 0, 0, 0);
  b.pop();
}
/** A laptop table: a tilted white tray on a pole with an L-shaped foot that slides under a seat. */
export function laptopTable(b, M, x, y, z, ry) {
  b.label = 'laptop table';
  b.push(x, y, z, ry);
  b.geo(sweep(roundPath([v3(0.22, 0.018, 0.2), v3(-0.2, 0.018, 0.2), v3(-0.2, 0.018, -0.24)], 0.06), 0.016, 8), M.white, 0, 0, 0);
  b.cyl(0.02, 0.02, 0.46, -0.2, 0.02, 0.2, M.white, 10);
  b.cyl(0.013, 0.013, 0.32, -0.2, 0.46, 0.2, M.chrome, 10);
  b.cyl(0.012, 0.012, 0.05, -0.17, 0.44, 0.2, M.black, 8, 0, Math.PI / 2);
  b.push(-0.02, 0.78, 0.08, 0);
  b.rbox(0.56, 0.018, 0.4, 0, 0, 0, M.white, 0.006, 0, -0.22);
  b._box(0.56, 0.028, 0.012, 0, -0.03, -0.2, M.white, 0, -0.22);
  b.pop();
  b.blob(0.6, 0.6, 0, 0, 0);
  b.pop();
}

// ---------------------------------------------------------------- storage and equipment
/** Lab: a mobile cart with frosted drawers, big wheels and a whiteboard on top. */
export function cart(b, M, x, y, z, ry) {
  const F = X(M);
  b.label = 'cart';
  b.push(x, y, z, ry);
  const y0 = 0.17;
  const y1 = 0.97;
  const hw = 0.3;
  const hd = 0.45;
  for (const s of [-1, 1]) b.rbox(0.6, y1 - y0, 0.025, 0, y0, s * (hd - 0.0125), F.alu, 0.008);
  b.box(0.6, y1 - y0, 0.02, 0, y0, 0, F.alu);
  b.rbox(0.62, 0.03, 0.92, 0, y1, 0, F.alu, 0.01);
  b.box(0.6, 0.025, 0.88, 0, y0, 0, F.alu);
  let k = 3;
  const rnd = () => ((k = (k * 9301 + 49297) % 233280) / 233280);
  for (const side of [-1, 1]) {
    const zc = (side * hd) / 2;
    const len = hd - 0.04;
    b.box(0.012, y1 - y0, len + 0.02, -side * (hw - 0.006), y0, zc, F.alu);
    for (let i = 0; i < 4; i++) {
      const dy = y0 + 0.03 + i * 0.195;
      const dh = 0.17;
      b.box(0.56, 0.008, len, 0, dy, zc, F.mesh);
      b.box(0.012, dh, len, side * (hw - 0.006), dy, zc, F.frost);
      b.rbox(0.016, 0.016, 0.2, side * (hw + 0.006), dy + dh - 0.04, zc, M.chrome, 0.006);
      for (let n = 0; n < 3; n++) {
        const px = -0.2 + rnd() * 0.4;
        const pz = zc - len / 2 + 0.06 + rnd() * (len - 0.12);
        const q = rnd();
        if (q < 0.4) b.cyl(0.025 + rnd() * 0.03, 0.025 + rnd() * 0.03, 0.04 + rnd() * 0.07, px, dy + 0.008, pz, F.print, 14);
        else if (q < 0.8) b.box(0.05 + rnd() * 0.06, 0.03 + rnd() * 0.06, 0.04 + rnd() * 0.06, px, dy + 0.008, pz, q < 0.65 ? F.print : M.oak, rnd() * 3);
        else b.box(0.14, 0.02, 0.022, px, dy + 0.008, pz, F.knife, rnd() * 3);
      }
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wx = sx * (hw + 0.035);
      const wz = sz * (hd - 0.1);
      b.cyl(0.072, 0.072, 0.03, wx, 0.088, wz, M.white, 20, 0, Math.PI / 2);
      b.geo(once('cart-tyre', () => new THREE.TorusGeometry(0.075, 0.012, 5, 20).rotateY(Math.PI / 2)), F.tyre, wx, 0.088, wz);
      b.cyl(0.03, 0.03, 0.034, wx, 0.088, wz, M.steelGrey, 14, 0, Math.PI / 2); // the hub
      b.cyl(0.011, 0.011, 0.07, sx * (hw + 0.02), 0.088, wz, M.steelGrey, 10, 0, Math.PI / 2); // the axle
      b._box(0.01, 0.1, 0.07, sx * (hw + 0.005), 0.075, wz, F.alu); // the bracket, down from the side to the axle
    }
  }
  // the whiteboard stands on the long side above the closed half, flush with it: it carries that white panel up
  const bx = hw - 0.005;
  b.rbox(0.03, 0.7, hd + 0.01, bx, y1 + 0.03, -hd / 2, F.alu, 0.01);
  for (const s of [-1, 1]) b.box(0.003, 0.62, hd - 0.05, bx + s * 0.0165, y1 + 0.07, -hd / 2, M.boardStrategy);
  b.blob(0.9, 1.2, 0, 0, 0);
  b.pop();
}
/**
 * Lab: an open-frame desktop 3D printer (as in the 360 tour): a white frame with a clear front, the glass build
 * plate with a print on it, the gantry and print head, a small screen on the base, the filament spool on the back.
 * Its front faces local -z; k picks the filament colour.
 */
export function printer(b, M, x, y, z, ry, k = 0) {
  const F = X(M);
  const fil = [F.filament, F.print, F.pcb][k % 3];
  b.label = '3d printer';
  b.push(x, y, z, ry);
  const w = 0.38;
  const h = 0.52;
  const d = 0.42;
  b.rbox(w, 0.09, d, 0, 0, 0, M.white, 0.012);
  b.box(w, 0.05, d, 0, h - 0.05, 0, M.white);
  for (const s of [-1, 1]) b.box(0.02, h - 0.09, d, s * (w / 2 - 0.01), 0.09, 0, M.white);
  b.box(w - 0.04, h - 0.14, 0.015, 0, 0.09, d / 2 - 0.0075, M.white);
  b.box(w - 0.04, h - 0.14, 0.004, 0, 0.09, -d / 2 + 0.01, M.glass);
  b.box(0.26, 0.008, 0.26, 0, 0.16, 0, M.screenBlack);
  b.cyl(0.035, 0.035, 0.06, 0.03, 0.168, 0.02, fil, 16);
  b.box(w - 0.04, 0.01, 0.01, 0, h - 0.11, -0.02, M.steelGrey);
  for (const s of [-1, 1]) b.box(0.01, 0.01, d - 0.06, s * 0.15, h - 0.1, 0, M.steelGrey);
  b.box(0.05, 0.06, 0.05, 0.03, h - 0.16, -0.02, M.black);
  b.box(0.08, 0.035, 0.004, -0.08, 0.03, -d / 2 - 0.002, M.screenDesk);
  b.cyl(0.012, 0.012, 0.01, 0.06, 0.045, -d / 2 - 0.004, M.steelGrey, 10, Math.PI / 2, 0);
  b.cyl(0.095, 0.095, 0.055, 0, 0.3, d / 2 + 0.035, fil, 20, Math.PI / 2, 0);
  b.cyl(0.035, 0.035, 0.06, 0, 0.3, d / 2 + 0.035, M.white, 12, Math.PI / 2, 0);
  b.pop();
}

/**
 * Lab: a stainless steel sink set into the worktop (the worktop leaves an opening x0..x1, z0..z1 at height top):
 * the basin with its rim and drain, a gooseneck mixer tap with a lever behind it. Metres; the room is towards -x.
 */
export function sink(b, M, x0, x1, top, z0, z1) {
  const F = X(M);
  b.label = 'sink';
  b.push(0, 0, 0, 0);
  const D = 0.19;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;
  b._box(w, 0.01, d, cx, top - D, cz, F.steel);
  b._box(0.01, D, d, x0 + 0.005, top - D, cz, F.steel);
  b._box(0.01, D, d, x1 - 0.005, top - D, cz, F.steel);
  b._box(w, D, 0.01, cx, top - D, z0 + 0.005, F.steel);
  b._box(w, D, 0.01, cx, top - D, z1 - 0.005, F.steel);
  b._box(w + 0.05, 0.004, 0.025, cx, top, z0 - 0.0125, F.steel);
  b._box(w + 0.05, 0.004, 0.025, cx, top, z1 + 0.0125, F.steel);
  b._box(0.025, 0.004, d, x0 - 0.0125, top, cz, F.steel);
  b._box(0.025, 0.004, d, x1 + 0.0125, top, cz, F.steel);
  b.cyl(0.036, 0.036, 0.004, cx, top - D + 0.01, cz, M.chrome, 18);
  b.cyl(0.026, 0.026, 0.005, cx, top - D + 0.011, cz, M.black, 16);
  // the tap: a round base, a gooseneck spout reaching over the basin, a lever on the side
  const fx = x1 + 0.06;
  b.cyl(0.028, 0.032, 0.05, fx, top, cz, M.chrome, 16);
  b.geo(sweep(roundPath([v3(fx, top + 0.04, cz), v3(fx, top + 0.32, cz), v3(fx - 0.2, top + 0.32, cz), v3(fx - 0.2, top + 0.22, cz)], 0.09, false, 6), 0.012, 10), M.chrome, 0, 0, 0);
  b.cyl(0.015, 0.015, 0.02, fx - 0.2, top + 0.2, cz, M.chrome, 12);
  b.geo(sweep([v3(fx, top + 0.1, cz + 0.02), v3(fx + 0.03, top + 0.15, cz + 0.1)], 0.007, 6), M.chrome, 0, 0, 0);
  b.pop();
}

/** A laptop; whoever uses it sits at local -z. */
export function laptop(b, M, x, y, z, ry, screenMat) {
  const F = X(M);
  b.label = 'laptop';
  b.push(x, y, z, ry);
  const W = 0.31;
  const D = 0.215;
  const T = 0.012;
  b.rbox(W, T, D, 0, 0, 0, F.alu, 0.004);
  b.box(0.272, 0.0015, 0.095, 0, T - 0.0005, 0.005, F.keys);
  b.box(0.1, 0.0015, 0.055, 0, T - 0.0005, -0.076, F.pad);
  b.cyl(0.0055, 0.0055, W - 0.05, 0, T, D / 2 - 0.004, M.black, 10, 0, Math.PI / 2);
  const th = 0.26; // the lid tilted back (radians)
  const H = 0.205;
  const up = v3(0, Math.cos(th), Math.sin(th));
  const front = v3(0, Math.sin(th), -Math.cos(th));
  const c = v3(0, T, D / 2 - 0.004).addScaledVector(up, H / 2);
  b.rbox(W, H, 0.006, 0, c.y - H / 2, c.z, F.alu, 0.003, 0, th);
  const bz = c.clone().addScaledVector(front, 0.0032);
  b.box(W - 0.006, H - 0.006, 0.0008, 0, bz.y - (H - 0.006) / 2, bz.z, M.screenBlack, 0, th);
  const sc = c.clone().addScaledVector(front, 0.0038).addScaledVector(up, 0.004);
  b.box(W - 0.028, H - 0.034, 0.0006, 0, sc.y - (H - 0.034) / 2, sc.z, screenMat, 0, th);
  b.pop();
}

/** A laptop keyboard: dark keys on a darker deck. */
function keyboard() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 100;
  const g = c.getContext('2d');
  g.fillStyle = '#15161a';
  g.fillRect(0, 0, 256, 100);
  g.fillStyle = '#2b2d33';
  const rows = [14, 14, 13, 12, 11];
  rows.forEach((n, j) => {
    const kw = 240 / 14;
    for (let i = 0; i < n; i++) g.fillRect(8 + i * kw + (14 - n) * kw * 0.5, 6 + j * 17, kw - 3, 14);
  });
  g.fillRect(8 + 3.5 * (240 / 14), 6 + 5 * 17 - 2, 6 * (240 / 14), 10); // the space bar
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Hub: a beige curved sofa, its back to the glass and its seat facing the room (as in the 360 tour).
 *  (cx, cz): the centre of its curve; R: the outer radius; the sofa runs +-span (radians) round the direction dir
 *  (0 = its back towards +x, -pi/4 = its back into the corner towards +x, -z). */
export function curvedSofa(b, M, cx, cz, R, span, dir = 0) {
  const F = X(M);
  b.label = 'lounge sofa';
  b.push(cx, 0, cz, 0);
  b.geo(extrudeUp(bandShape(R - 0.62, R - 0.14, dir - span, dir + span), 0.42, 0.05), F.beige, 0, 0, 0);
  b.geo(extrudeUp(bandShape(R - 0.2, R, dir - span - 0.03, dir + span + 0.03), 0.8, 0.06), F.beige, 0, 0, 0);
  for (let i = 0; i < 3; i++) {
    const a = dir - span + (i + 0.5) * ((2 * span) / 3);
    b.blob(0.9, 0.9, Math.cos(a) * (R - 0.35), 0, Math.sin(a) * (R - 0.35), -a);
  }
  b.pop();
}
/** Hub: the taupe armchair beside the sofa (one lounge module); faces local -z. */
export function armchair(b, M, x, z, ry) {
  loungeModule(b, M, x, z, ry, X(M).taupe);
}

/** Studio: a column of headphones on hooks (two across, six high) on a felt panel; the wall is at x = wx, the
 *  room towards -x; zc: the middle of the column. */
export function headphoneWall(b, M, wx, y, zc) {
  const F = X(M);
  b.label = 'headphones';
  b.push(wx, y, zc, -Math.PI / 2); // local x runs along the wall, local +z comes out of it
  b._box(0.56, 1.9, 0.02, 0, 0.62, 0.01, F.felt);
  for (let r = 0; r < 6; r++) {
    for (const c of [-0.13, 0.13]) {
      const hy = 0.86 + r * 0.29;
      const cy = hy - 0.058;
      b.cyl(0.005, 0.005, 0.05, c, hy, 0.045, F.body, 6, Math.PI / 2, 0); // (the hook, ending under the band)
      b.geo(once('hp-band', () => new THREE.TorusGeometry(0.075, 0.006, 6, 18, Math.PI)), M.steelGrey, c, cy, 0.07);
      b.geo(once('hp-pad', () => new THREE.TorusGeometry(0.069, 0.011, 6, 12, Math.PI * 0.6).rotateZ(Math.PI * 0.2)), M.black, c, cy, 0.07);
      for (const s of [-1, 1]) {
        b.geo(sweep([v3(c + s * 0.075, cy, 0.07), v3(c + s * 0.079, cy - 0.022, 0.07), v3(c + s * 0.079, cy - 0.04, 0.07)], 0.004, 5), M.steelGrey, 0, 0, 0);
        b.geo(once(s < 0 ? 'hp-cupL' : 'hp-cupR', () => new THREE.LatheGeometry([[0, 0], [0.036, 0], [0.043, 0.005], [0.045, 0.016], [0.043, 0.027], [0.035, 0.033], [0, 0.034]].map(([r, y]) => new THREE.Vector2(r, y)), 14).rotateZ(-s * Math.PI / 2)), M.black, c + s * 0.066, cy - 0.045, 0.07);
        b.geo(once('hp-cushion', () => new THREE.TorusGeometry(0.029, 0.011, 6, 14).rotateY(Math.PI / 2)), F.body, c + s * 0.064, cy - 0.045, 0.07);
      }
    }
  }
  b.pop();
}

/**
 * Studio: the oak wall unit across the south wall (as in the 360 tour and the render): low cubbies along the floor
 * holding stacks of floor cushions and kraft boxes; above them, from the windows inwards, sticky notes, the screen
 * and two whiteboards on a white panel, then a tall open bookcase; oak cupboards up to the ceiling. Runs x0..x1
 * against the wall at zWall (the room is towards -z). Metres.
 */
export function studioWallUnit(b, M, x0, x1, y, zWall, ceil) {
  const F = X(M);
  b.label = 'wall unit';
  b.push(0, 0, 0, 0);
  const D = 0.42;
  const zc = zWall - D / 2;
  const base = 0.46;
  const top = 2.55;
  const mid = (x0 + x1) / 2;
  b._box(0.025, ceil, D, x0 + 0.0125, y, zc, M.oak);
  b._box(0.025, ceil, D, x1 - 0.0125, y, zc, M.oak);
  b._box(x1 - x0, 0.02, D, mid, y, zc, M.oak);
  b._box(x1 - x0, 0.025, D, mid, y + base, zc, M.oak);
  b._box(x1 - x0, 0.015, D, mid, y + top - 0.015, zc, M.oak);
  b._box(x1 - x0, ceil - top, D, mid, y + top, zc, M.drawersOak);
  b._box(x1 - x0, base, 0.015, mid, y, zWall - 0.0075, M.oak);
  // low cubbies: floor cushions in stacks, every fourth a kraft box
  const n = Math.round((x1 - x0) / 0.42);
  const cw = (x1 - x0) / n;
  const cols = [M.pouf1, M.pouf2, M.pouf3, M.pouf4];
  for (let i = 1; i < n; i++) b._box(0.022, base, D, x0 + i * cw, y, zc, M.oak);
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i + 0.5) * cw;
    if (i % 4 === 3) {
      b.rbox(cw * 0.74, base * 0.6, D * 0.8, cx, y + 0.02, zc, M.kraft, 0.006);
      continue;
    }
    for (let k = 0; k < 4; k++) b.cyl(0.165, 0.165, 0.07, cx, y + 0.02 + k * 0.077, zc, cols[(i + k) % 4], 18);
  }
  // the white panel: sticky notes, the screen, two whiteboards
  const bk = x1 - 0.82;
  b._box(bk - x0, top - base, 0.02, (x0 + bk) / 2, y + base, zWall - 0.01, M.white);
  for (let i = 0; i < 12; i++) b._box(0.075, 0.075, 0.003, x0 + 0.25 + (i % 3) * 0.13, y + 1.25 + Math.floor(i / 3) * 0.16, zWall - 0.022, i % 4 === 1 ? M.stickyPink : M.sticky);
  const tvx = x0 + 1.7;
  b.rbox(1.6, 0.92, 0.04, tvx, y + 1.08, zWall - 0.04, M.screenBlack, 0.006);
  b._box(1.56, 0.88, 0.002, tvx, y + 1.1, zWall - 0.061, M.screenTech);
  for (let k = 0; k < 2; k++) b.geo(new THREE.PlaneGeometry(0.58, 1.75), M.boards[k * 2 + 1], tvx + 1.12 + k * 0.62, y + 1.5, zWall - 0.022, Math.PI);
  // the bookcase: four shelves of books
  let s = 13;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const palette = ['#2f3e5c', '#7a2e33', '#2f5a45', '#c99a3a', '#e8e0cc', '#1f1f22', '#3f7f86', '#c86a3c', '#d9c7a8', '#4f6f9a'].map((h) => new THREE.Color(h));
  for (let k = 1; k < 5; k++) b._box(x1 - bk, 0.022, D, (bk + x1) / 2, y + base + k * 0.42, zc, M.oak);
  b._box(0.022, top - base, D, bk, y + base, zc, M.oak);
  for (let k = 0; k < 5; k++) {
    let x = bk + 0.03;
    const yy = y + base + 0.025 + k * 0.42;
    while (x < x1 - 0.06) {
      const t = 0.02 + rnd() * 0.03;
      if (rnd() < 0.08) {
        x += 0.08;
        continue;
      }
      const hh = 0.2 + rnd() * 0.15;
      const dd = 0.17 + rnd() * 0.06;
      b.add(colourBox(t, hh, dd, palette[Math.floor(rnd() * palette.length)]), F.books, place(x + t / 2, yy, zWall - 0.02 - dd / 2));
      x += t + 0.002;
    }
  }
  b.solidM(x0, zWall - D - 0.05, x1, zWall, y > 2 ? 1 : 0);
  b.pop();
}
/**
 * Hub: the curved bookcase, pale blue-grey, with coloured backs in the compartments and single books of every
 * height and colour, the odd stack lying flat and a few small plants. (cx, cz: the centre of the curve.)
 */
export function bookcase(b, M, cx, cy, cz, r, a0, a1) {
  const F = X(M);
  b.label = 'curved bookshelf';
  b.push(cx, cy, cz, 0);
  const segs = 8;
  const H = 0.44;
  const rows = 4;
  const back = r + 0.17;
  const frame = M.dustyBlue;
  for (let s = 0; s <= rows; s++) b.geo(extrudeUp(bandShape(r - 0.18, r + 0.16, a0, a1), 0.025, 0, 32), frame, 0, s * H - (s === rows ? 0.025 : 0), 0); // (stopping at the back panel, not through it)
  b.geo(extrudeUp(bandShape(back - 0.01, back + 0.01, a0, a1), rows * H, 0, 32), frame, 0, 0, 0);
  const da = (a1 - a0) / segs;
  for (let i = 0; i <= segs; i++) {
    const a = a0 + i * da;
    b._box(0.025, rows * H - 0.025, 0.34, Math.cos(a) * (r - 0.01), 0, Math.sin(a) * (r - 0.01), frame, Math.PI / 2 - a);
  }
  const palette = ['#2f3e5c', '#7a2e33', '#2f5a45', '#c99a3a', '#e8e0cc', '#1f1f22', '#3f7f86', '#8a8f96', '#c86a3c', '#5b4a7a', '#d9c7a8', '#9b3f2f', '#4f6f9a', '#efe9dd'].map((h) => new THREE.Color(h));
  const backs = [F.sage, F.peach, F.mist, null, F.peach, F.sage, null, F.mist];
  let k = 7;
  const rnd = () => ((k = (k * 9301 + 49297) % 233280) / 233280);
  const book = (w, h, d, a, rr, y, tilt = 0) => {
    b.add(colourBox(w, h, d, palette[Math.floor(rnd() * palette.length)]), F.books, place(Math.cos(a) * rr, y, Math.sin(a) * rr, -a - Math.PI / 2, tilt));
  };
  for (let s = 0; s < rows; s++) {
    for (let i = 0; i < segs; i++) {
      const y = s * H + 0.025;
      const sa = a0 + i * da + 0.022 / r;
      const sb = a0 + (i + 1) * da - 0.022 / r;
      const bk = backs[(i + s * 3) % backs.length];
      if (bk) b.geo(extrudeUp(bandShape(back - 0.022, back - 0.012, sa - 0.01 / r, sb + 0.01 / r), H - 0.025, 0, 6), bk, 0, y, 0);
      const kind = rnd();
      let a = sa;
      let end = sb;
      if (kind < 0.18) {
        // a small plant and a few books
        const am = a0 + (i + 0.3) * da;
        const p = v3(Math.cos(am) * r, y, Math.sin(am) * r).applyMatrix4(b.m);
        b.models.push({ kind: 'small', x: p.x, y: p.y, z: p.z, ry: rnd() * 6.28, h: 0.27 });
        a = a0 + (i + 0.58) * da;
      } else if (kind < 0.32) {
        // a stack lying flat, then books standing
        const am = a0 + (i + 0.25) * da;
        let yy = y;
        for (let n = 0; n < 3 + Math.floor(rnd() * 3); n++) {
          const t = 0.025 + rnd() * 0.02;
          const dd = 0.2 + rnd() * 0.04;
          const rr = back - 0.04 - dd / 2; // (its back edge, corners included, stays inside the back panel)
          b.add(colourBox(0.17 + rnd() * 0.04, t, dd, palette[Math.floor(rnd() * palette.length)]), F.books, place(Math.cos(am) * rr, yy, Math.sin(am) * rr, -am - Math.PI / 2 + (rnd() - 0.5) * 0.1));
          yy += t;
        }
        a = a0 + (i + 0.52) * da;
      }
      // books standing side by side, the last one leaning if there is room
      while (a < end) {
        const t = 0.018 + rnd() * 0.028;
        const h = Math.min(H - 0.06, 0.2 + rnd() * 0.13);
        const d = 0.15 + rnd() * 0.07;
        const step = t / r;
        if (a + step > end) break;
        if (rnd() < 0.05 && end - a > 0.12 / r) {
          a += 0.05 / r; // a gap
          continue;
        }
        book(t, h, d, a + step / 2, back - 0.026 - d / 2, y);
        a += step + 0.0015 / r;
      }
      if (end - a > 0.07 / r && kind >= 0.18) book(0.03, 0.24, 0.17, end - 0.05 / r, back - 0.12, y, 0.3);
    }
  }
  for (let i = 0; i < 6; i++) {
    const a = a0 + ((i + 0.5) * (a1 - a0)) / 6;
    b.blob(0.8, 0.7, Math.cos(a) * r, 0, Math.sin(a) * r, -a);
  }
  b.pop();
}

// ---------------------------------------------------------------- the Lab's filming corner
/** A video camera on a tripod; the lens looks along local -z. */
function videoCamera(b, M, x, y, z, ry) {
  const F = X(M);
  b.label = 'camera';
  b.push(x, y, z, ry);
  const top = 1.15;
  const knee = top * 0.48;
  // tripod: three legs in two sections (with leg locks), a spreader near the floor, the centre column
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    b.geo(sweep([v3(c * 0.06, top - 0.02, s * 0.06), v3(c * 0.24, knee, s * 0.24)], 0.016, 6), M.black, 0, 0, 0);
    b.geo(sweep([v3(c * 0.24, knee, s * 0.24), v3(c * 0.44, 0.012, s * 0.44)], 0.01, 6), M.steelGrey, 0, 0, 0);
    b.geo(sweep([v3(c * 0.232, knee + 0.035, s * 0.232), v3(c * 0.252, knee - 0.03, s * 0.252)], 0.021, 6), M.black, 0, 0, 0);
    b.cyl(0.016, 0.02, 0.025, c * 0.44, 0, s * 0.44, M.black, 8);
    b.geo(sweep([v3(c * 0.02, 0.35, s * 0.02), v3(c * 0.315, 0.35, s * 0.315)], 0.006, 5), M.steelGrey, 0, 0, 0);
  }
  b.cyl(0.018, 0.018, top - 0.33, 0, 0.33, 0, M.steelGrey, 10);
  b.cyl(0.07, 0.06, 0.05, 0, top - 0.04, 0, M.black, 14);
  // fluid head with its pan handle
  b.rbox(0.1, 0.09, 0.11, 0, top + 0.01, 0, M.black, 0.015);
  b.box(0.12, 0.015, 0.2, 0, top + 0.1, 0, M.steelGrey);
  b.geo(sweep([v3(0.04, top + 0.06, 0.04), v3(0.11, top + 0.02, 0.34)], 0.011, 6), M.black, 0, 0, 0);
  b.geo(sweep([v3(0.11, top + 0.02, 0.32), v3(0.125, top + 0.012, 0.44)], 0.018, 8), M.black, 0, 0, 0);
  // the camera: body, lens with hood, top handle, microphone, side screen, viewfinder, red tally light
  const cy = top + 0.115;
  b.rbox(0.13, 0.15, 0.28, 0, cy, 0.02, F.body, 0.02);
  b.cyl(0.045, 0.045, 0.14, 0, cy + 0.07, -0.19, M.black, 16, Math.PI / 2, 0);
  b.cyl(0.058, 0.05, 0.05, 0, cy + 0.07, -0.285, M.black, 16, Math.PI / 2, 0);
  b.cyl(0.042, 0.042, 0.004, 0, cy + 0.07, -0.312, F.smoke, 16, Math.PI / 2, 0);
  b.geo(sweep(roundPath([v3(0, cy + 0.15, 0.11), v3(0, cy + 0.21, 0.09), v3(0, cy + 0.21, -0.08), v3(0, cy + 0.15, -0.1)], 0.03), 0.011, 6), M.black, 0, 0, 0);
  b._box(0.024, 0.02, 0.03, 0, cy + 0.22, -0.05, M.black); // (the microphone's clip on the handle)
  b.cyl(0.012, 0.012, 0.15, 0, cy + 0.252, -0.08, M.black, 8, Math.PI / 2, 0);
  b.box(0.008, 0.075, 0.11, -0.069, cy + 0.06, -0.06, M.black);
  b.box(0.002, 0.062, 0.095, -0.0735, cy + 0.066, -0.06, M.greenScreen);
  b.cyl(0.02, 0.026, 0.07, 0, cy + 0.11, 0.18, M.black, 10, Math.PI / 2, 0);
  b.box(0.022, 0.012, 0.012, 0, cy + 0.15, -0.13, F.tally);
  b.blob(1.0, 1.0, 0, 0, 0);
  b.pop();
}
/** A photographic light on a stand with a white umbrella; the umbrella opens towards local -z (the subject). */
function umbrellaLight(b, M, x, y, z, ry, h = 1.85) {
  b.label = 'umbrella light';
  b.push(x, y, z, ry);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    b.geo(sweep([v3(Math.cos(a) * 0.03, 0.4, Math.sin(a) * 0.03), v3(Math.cos(a) * 0.36, 0.012, Math.sin(a) * 0.36)], 0.009, 6), M.black, 0, 0, 0);
  }
  b.cyl(0.016, 0.016, 0.85, 0, 0.3, 0, M.black, 8);
  b.cyl(0.011, 0.011, h - 1.12, 0, 1.12, 0, M.steelGrey, 8);
  b.cyl(0.022, 0.022, 0.06, 0, 1.1, 0, M.black, 8);
  b.push(0, h, 0, 0);
  b.rbox(0.09, 0.1, 0.16, 0, -0.05, 0, M.black, 0.02); // the flash head, pointing back into the umbrella
  b.cyl(0.005, 0.005, 0.5, 0, 0, 0.1, M.steelGrey, 6, Math.PI / 2, 0); // the umbrella shaft
  const R = 0.48;
  const depth = 0.2;
  const prof = [];
  for (let i = 0; i <= 6; i++) prof.push(new THREE.Vector2((R * i) / 6, depth * (i / 6) ** 2));
  b.geo(once('umbrella', () => new THREE.LatheGeometry(prof, 16).rotateX(-Math.PI / 2)), M.podWhite, 0, 0, 0.34);
  for (let k = 0; k < 8; k++) {
    const p = (k / 8) * Math.PI * 2;
    const rib = [];
    for (let i = 1; i <= 6; i++) {
      const r = (R * i) / 6;
      rib.push(v3(Math.cos(p) * r, Math.sin(p) * r, 0.345 - depth * (i / 6) ** 2));
    }
    b.geo(sweep(rib, 0.004, 4), M.black, 0, 0, 0);
  }
  b.pop();
  b.blob(0.8, 0.8, 0, 0, 0);
  b.pop();
}
/**
 * Lab: the filming corner (as in the render). A green-screen set: two green walls and a green floor with curved
 * coves where they meet, a dark ceiling over it, a black curtain on a curved ceiling track (drawn back to both
 * sides), a video camera on a tripod outside the set filming in, two umbrella lights and a stool for the
 * presenter. The green walls are at x1 and z1; y: floor level; ceil: clear height. (Metres.)
 */
export function mediaCorner(b, M, y, x0, x1, z0, z1, ceil) {
  const G = M.greenScreen;
  b.label = 'set corner';
  b.push(0, 0, 0, 0);
  const R = 0.3;
  const wx = x1 - 0.012;
  const wz = z1 - 0.012;
  b._box(0.012, ceil, z1 - z0, x1 - 0.006, y, (z0 + z1) / 2, G);
  b._box(x1 - x0, ceil, 0.012, (x0 + x1) / 2, y, z1 - 0.006, G);
  b._box(x1 - x0, 0.006, z1 - z0, (x0 + x1) / 2, y, (z0 + z1) / 2, G);
  // the coves: a quarter round where the floor meets each wall (no corner line to give the set away)
  b.geo(shellGeo((u, v) => {
    const a = (v * Math.PI) / 2;
    return v3(wx - R + R * Math.sin(a), y + 0.006 + R - R * Math.cos(a), z0 + ((u + 1) / 2) * (wz - z0));
  }, 1, 6, 0.01), G, 0, 0, 0);
  b.geo(shellGeo((u, v) => {
    const a = (v * Math.PI) / 2;
    return v3(x0 + ((u + 1) / 2) * (wx - x0), y + 0.006 + R - R * Math.cos(a), wz - R + R * Math.sin(a));
  }, 1, 6, 0.01), G, 0, 0, 0);
  // the curved curtain track (a quarter ellipse round the corner), the dark ceiling inside it
  const P = (t) => [x1 - (x1 - x0) * Math.sin(t), z1 - (z1 - z0) * Math.cos(t)];
  const ceilShape = new THREE.Shape();
  ceilShape.moveTo(x1, -z1);
  const track = [];
  for (let i = 0; i <= 24; i++) {
    const [px, pz] = P(((i / 24) * Math.PI) / 2);
    ceilShape.lineTo(px, -pz);
    track.push(v3(px, y + ceil - 0.05, pz));
  }
  b.geo(extrudeUp(ceilShape, 0.01, 0, 4), M.black, 0, y + ceil - 0.022, 0);
  b.geo(sweep(track, 0.018, 6), M.steelGrey, 0, 0, 0);
  // the black curtain, gathered in pleats at both ends of the track
  for (const [ta, tb] of [[0, 0.3], [1.32, Math.PI / 2]]) {
    let L = 0;
    for (let i = 0; i < 12; i++) {
      const [ax, az] = P(ta + ((tb - ta) * i) / 12);
      const [bx, bz] = P(ta + ((tb - ta) * (i + 1)) / 12);
      L += Math.hypot(bx - ax, bz - az);
    }
    const nu = Math.max(12, Math.round((L / 0.15) * 6));
    b.geo(shellGeo((u, v) => {
      const s = (u + 1) / 2;
      const t = ta + s * (tb - ta);
      const [px, pz] = P(t);
      const dx = -(x1 - x0) * Math.cos(t);
      const dz = (z1 - z0) * Math.sin(t);
      const n = Math.hypot(dx, dz);
      const pleat = 0.045 * Math.sin(((s * L) / 0.15) * Math.PI * 2);
      return v3(px + (dz / n) * pleat, y + 0.02 + v * (ceil - 0.09), pz - (dx / n) * pleat);
    }, nu, 1, 0.012), M.curtain, 0, 0, 0);
    const [ax, az] = P(ta);
    const [bx, bz] = P(tb);
    b.solidM(Math.min(ax, bx) - 0.08, Math.min(az, bz) - 0.08, Math.max(ax, bx) + 0.08, Math.max(az, bz) + 0.08, y > 2 ? 1 : 0);
  }
  b.pop();
  // the presenter's spot, the camera filming it from outside the set, a light either side
  const sx = x1 - 0.65;
  const sz = z1 - 0.85;
  const aim = (x, z) => Math.atan2(-(sx - x), -(sz - z));
  stool(b, M, sx, y, sz, M.pouf4, 0.68, false, aim(x0 + 0.55, z0 + 0.8) + Math.PI);
  videoCamera(b, M, x0 + 0.55, y, z0 + 0.8, aim(x0 + 0.55, z0 + 0.8));
  umbrellaLight(b, M, x1 - 0.55, y, z0 + 0.65, aim(x1 - 0.55, z0 + 0.65));
  umbrellaLight(b, M, x0 + 0.7, y, z1 - 1.25, aim(x0 + 0.7, z1 - 1.25));
  const lv = y > 2 ? 1 : 0;
  for (const [cx, cz, r] of [[sx, sz, 0.3], [x0 + 0.55, z0 + 0.8, 0.42], [x1 - 0.55, z0 + 0.65, 0.34], [x0 + 0.7, z1 - 1.25, 0.34]]) b.solidM(cx - r, cz - r, cx + r, cz + r, lv);
}

// ---------------------------------------------------------------- outside: crooked trunks
/**
 * A tree trunk in a few segments, each bending a little more, the whole trunk leaning one way (real trees are
 * never straight). Call inside b.pushRaw() (metres). Returns the top and at(y): the trunk's centre at height y.
 */
export function crookedTrunk(b, mat, x, y0, z, height, rBot, rTop, segs, lean, dir, rnd, radial = 9) {
  const pts = [v3(x, y0, z)];
  const len = height / segs;
  for (let i = 0; i < segs; i++) {
    const tilt = lean * (0.5 + (i / Math.max(1, segs - 1)) * 0.9) + (rnd() - 0.5) * 0.16;
    const a = dir + (rnd() - 0.5) * 1.0;
    const d = v3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));
    const p = pts[i];
    const mid = p.clone().addScaledVector(d, len / 2);
    const ra = rBot + ((rTop - rBot) * i) / segs;
    const rb = rBot + ((rTop - rBot) * (i + 1)) / segs;
    b.cyl(rb, ra, len + 0.05, mid.x, mid.y, mid.z, mat, radial, Math.atan2(d.z, d.y) || 1e-6, -Math.asin(d.x) || 1e-6);
    pts.push(p.clone().addScaledVector(d, len));
  }
  const at = (yy) => {
    for (let i = 0; i < segs; i++) {
      if (yy <= pts[i + 1].y || i === segs - 1) {
        const t = (yy - pts[i].y) / Math.max(0.001, pts[i + 1].y - pts[i].y);
        return pts[i].clone().lerp(pts[i + 1], t);
      }
    }
    return pts[segs].clone();
  };
  return { top: pts[segs], at };
}

/** Merge geometries after making them all non-indexed. */
function mergeNonIndexed(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const n = geos.reduce((s, g) => s + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]]) {
    const arr = new Float32Array(n * size);
    let o = 0;
    for (const g of geos) {
      arr.set(g.attributes[name].array, o);
      o += g.attributes[name].array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
}
