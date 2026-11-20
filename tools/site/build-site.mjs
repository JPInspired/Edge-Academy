// Builds src/site-data.js (the real surroundings of the Edge Academy at PaRK International School Alfragide)
// from OpenStreetMap data, in the model's own coordinates (metres; x across the building, z along it).
//
//   1. Get the map data (about 350 KB) with this Overpass query, e.g. at https://overpass-turbo.eu
//      [out:json];(way(around:350,38.7354,-9.2256)[building];way(around:350,38.7354,-9.2256)[highway];
//      way(around:350,38.7354,-9.2256)[leisure];way(around:350,38.7354,-9.2256)[landuse];
//      way(around:350,38.7354,-9.2256)[amenity];way(around:350,38.7354,-9.2256)[natural];
//      way(around:350,38.7354,-9.2256)[barrier];);out geom tags;
//   2. node tools/site/build-site.mjs osm.json
//
// Map data © OpenStreetMap contributors, available under the Open Database Licence (see CREDITS.md).
// Heights are estimates (building levels where the map has them, otherwise typical heights by kind).
import fs from 'fs';

const [, , input = 'osm.json'] = process.argv;
const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const LAT0 = 38.7354, LON0 = -9.2256;
const R = 6378137, K = Math.PI / 180;
const en = (p) => [(p.lon - LON0) * K * R * Math.cos(LAT0 * K), -(p.lat - LAT0) * K * R]; // east, south (m)

const EDGE_ID = 1205032349; // the Edge Academy block (modelled in detail, so not repeated here)
const MAIN_ID = 815707077; // PaRK main building (Saraiva + Associados)
const byId = new Map(data.elements.map((e) => [e.id, e]));

// ── the model's frame: Edge's centre, its long axis (north-west end → south-east end) and across it ──
const edge = byId.get(EDGE_ID).geometry.map(en).slice(0, -1);
const C = edge.reduce((a, p) => [a[0] + p[0] / edge.length, a[1] + p[1] / edge.length], [0, 0]);
let long = null;
for (let i = 0; i < edge.length; i++) {
  const a = edge[i], b = edge[(i + 1) % edge.length];
  const d = [b[0] - a[0], b[1] - a[1]];
  const L = Math.hypot(...d);
  if (!long || L > long.L) long = { L, d: [d[0] / L, d[1] / L] };
}
const main = byId.get(MAIN_ID).geometry.map(en);
const mainC = main.reduce((a, p) => [a[0] + p[0] / main.length, a[1] + p[1] / main.length], [0, 0]);
let u = long.d; // along: from the end next to the main building (z = 0, Reception) to the far end
if ((mainC[0] - C[0]) * u[0] + (mainC[1] - C[1]) * u[1] > 0) u = [-u[0], -u[1]];
let v = [-u[1], u[0]]; // across: from the motorway side (x = 0) to the courtyard side (x = 8)
const trunk = data.elements.find((e) => e.tags?.highway === 'trunk' && e.geometry);
const tp = en(trunk.geometry[0]);
if ((tp[0] - C[0]) * v[0] + (tp[1] - C[1]) * v[1] > 0) v = [-v[0], -v[1]];
const MID = [4, 10.5]; // the building's centre in the model (8 m x 21 m inside)
const toModel = (p) => {
  const d = [p[0] - C[0], p[1] - C[1]];
  return [MID[0] + d[0] * v[0] + d[1] * v[1], MID[1] + d[0] * u[0] + d[1] * u[1]];
};
const r1 = (n) => Math.round(n * 10) / 10;
const flat = (pts) => pts.flatMap(([x, z]) => [r1(x), r1(z)]);
const RANGE = 330;
const near = (pts) => pts.some(([x, z]) => Math.hypot(x - MID[0], z - MID[1]) < RANGE);

// ── buildings ──
const levelsOf = (t) => (t['building:levels'] ? parseFloat(t['building:levels']) : null);
function heightOf(e) {
  const t = e.tags;
  if (e.id === MAIN_ID) return 15.5;
  const lv = levelsOf(t);
  if (lv) return lv * 3.1 + 0.8;
  return { house: 6.5, semidetached_house: 6.5, apartments: 16, office: 14, retail: 6, garage: 4, roof: 4, service: 3.5, school: 11, historic: 6 }[t.building] ?? 9;
}
function kindOf(e) {
  const t = e.tags;
  if (e.id === MAIN_ID) return 'main';
  if (t.building === 'school') return 'school';
  if (t.man_made === 'windmill') return 'windmill';
  if (['house', 'semidetached_house'].includes(t.building)) return 'house';
  if (t.building === 'roof') return 'roof';
  if (t.building === 'apartments') return 'flats';
  return 'block';
}
const buildings = [];
for (const e of data.elements) {
  if (!e.tags?.building || !e.geometry || e.id === EDGE_ID) continue;
  const pts = e.geometry.map(en).map(toModel);
  if (!near(pts)) continue;
  if (pts.length > 2 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop();
  buildings.push({ p: flat(pts), h: r1(heightOf(e)), k: kindOf(e), id: e.id });
}
// the sports hall (unlabelled on the map): the big block east of the courtyard
const sports = buildings.find((b) => b.id === 815707078);
if (sports) Object.assign(sports, { k: 'hall', h: 10 });

// ── roads and paths (centre lines, with widths) ──
const roadW = (t) => {
  const lanes = parseFloat(t.lanes || 0);
  if (t.highway === 'trunk') return (lanes || 3) * 3.5 + 1;
  return { trunk_link: 5, primary: 9, secondary: 8, tertiary: 7.5, residential: 6, unclassified: 6, road: 6, service: 4.5, pedestrian: 5, footway: 2, path: 1.6, steps: 2 }[t.highway] ?? 0;
};
const roads = [];
for (const e of data.elements) {
  const t = e.tags || {};
  if (!t.highway || !e.geometry || e.geometry.length < 2) continue;
  const w = roadW(t);
  if (!w || t.area === 'yes') continue;
  const pts = e.geometry.map(en).map(toModel);
  if (!near(pts)) continue;
  roads.push({ p: flat(pts), w, k: /trunk/.test(t.highway) ? 'trunk' : ['footway', 'path', 'steps', 'pedestrian'].includes(t.highway) ? 'foot' : 'road', oneway: t.oneway === 'yes' });
}

// ── areas ──
const areaKind = (t) => {
  if (t.leisure === 'pitch') return 'pitch';
  if (t.amenity === 'parking') return 'parking';
  if (t.amenity === 'school') return 'campus';
  if (t.leisure === 'park' || t.landuse === 'grass' || t.landuse === 'meadow' || t.natural === 'grassland' || t.leisure === 'dog_park' || t.leisure === 'playground') return 'grass';
  if (t.natural === 'wood' || t.natural === 'scrub') return 'wood';
  if (t.natural === 'water' || t.leisure === 'swimming_pool') return 'water';
  return null;
};
const areas = [];
for (const e of data.elements) {
  const t = e.tags || {};
  if (!e.geometry || t.building || t.highway) continue;
  const k = areaKind(t);
  if (!k) continue;
  const pts = e.geometry.map(en).map(toModel);
  if (pts.length < 4 || !near(pts)) continue;
  pts.pop();
  areas.push({ p: flat(pts), k });
}

// ── fences and walls ──
const lines = [];
for (const e of data.elements) {
  const t = e.tags || {};
  if (!t.barrier || !e.geometry || !['fence', 'wall', 'retaining_wall', 'hedge'].includes(t.barrier)) continue;
  const pts = e.geometry.map(en).map(toModel);
  if (!near(pts)) continue;
  lines.push({ p: flat(pts), k: t.barrier });
}

// which way is north in the model (for the mini-map)
const north = toModel([C[0], C[1] - 1]).map((n, i) => r1((n - MID[i]) * 1000) / 1000);

const out = `// Generated by tools/site/build-site.mjs from OpenStreetMap data. Do not edit by hand: change the script.
// Map data © OpenStreetMap contributors (Open Database Licence). Coordinates in the model's metres:
// x across the Edge block (0 = motorway side, 8 = courtyard side), z along it (0 = north-west end).
// Buildings: p = footprint [x, z, x, z, …], h = height (m, estimated), k = kind.
export const SITE = ${JSON.stringify({ north, buildings: buildings.map(({ id, ...b }) => b), roads, areas, lines })};
`;
fs.writeFileSync(new URL('../../src/site-data.js', import.meta.url), out);
console.log(`site-data.js: ${buildings.length} buildings, ${roads.length} roads, ${areas.length} areas, ${lines.length} fences; north = ${north}; ${(out.length / 1024).toFixed(0)} KB`);
// a few checks for the console
const edgeM = edge.map(toModel).map((p) => p.map(r1));
console.log('Edge outline in model coordinates:', JSON.stringify(edgeM));
const mainM = main.map(toModel);
console.log('main building nearest point:', JSON.stringify(mainM.reduce((a, p) => (Math.hypot(p[0] - 4, p[1] - 10.5) < Math.hypot(a[0] - 4, a[1] - 10.5) ? p : a)).map(r1)));
