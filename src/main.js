import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildEdge } from './building.js';
import { NORTH } from './site.js';

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // the building is static: render the sun shadows once
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 400);
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);
const EYE = 1.6;
camera.position.y = EYE;

const world = buildEdge(scene, renderer);
const { W: BW, L: BL } = world.size;
scene.fog = new THREE.Fog(0xdde7ee, 80, 320);

const hemi = new THREE.HemisphereLight(0xeaf2ff, 0xb59a7c, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffeccc, 5.0);
// Where the sun is: azimuth (degrees from north, clockwise) and elevation, using src/site.js's north.
//   day:  a Saturday morning in November in Lisbon, low in the east-south-east (120°, 28° up), lighting the
//         courtyard side and the Hub end
//   dusk: setting in the west-south-west (245°, 4° up), as in the photographs of PaRK at sunset
function sunDirection(azDeg, elDeg) {
  const [nx, nz] = NORTH; // north in the model
  const ex = -nz, ez = nx; // east (north turned clockwise seen from above)
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  const dx = nx * Math.cos(az) + ex * Math.sin(az), dz = nz * Math.cos(az) + ez * Math.sin(az);
  return new THREE.Vector3(dx * Math.cos(el), Math.sin(el), dz * Math.cos(el));
}
const LOOKS = {
  day: { sun: sunDirection(120, 28), sunColor: 0xffeccc, sunPower: 5.0, sky: 0xeaf2ff, ground: 0xb59a7c, hemi: 0.32, fog: 0xdde7ee, inside: 11, insideColor: 0xfff6ea, exposure: 0.9 }, // (brighter inside, as in the concept renders)
  dusk: { sun: sunDirection(245, 4), sunColor: 0xffa060, sunPower: 2.6, sky: 0x9c9ccc, ground: 0x6e5a52, hemi: 0.26, fog: 0xc7b3bf, inside: 13, insideColor: 0xffdcae, exposure: 0.95 },
};
sun.position.copy(LOOKS.day.sun).multiplyScalar(50).add(new THREE.Vector3(BW / 2, 0, BL / 2));
sun.target.position.set(BW / 2, 0, BL / 2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 }); // the Edge block and the courtyard around it
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.025;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
// soft daylight from the windows inside the rooms (no shadows: cheap)
const insideLights = [];
for (const [x, y, z] of [[BW * 0.6, 2.2, BL * 0.2], [BW * 0.6, 2.2, BL * 0.7], [BW * 0.5, 6.2, BL * 0.25], [BW * 0.5, 6.2, BL * 0.75]]) {
  const p = new THREE.PointLight(0xfff3e2, 7, 14, 1.6);
  p.position.set(x, y, z);
  scene.add(p);
  insideLights.push(p);
}

// Image-based lighting: once photo textures, models and the sky have loaded, capture the finished
// building from inside and use it as the environment (real bounce light and reflections).
function captureEnvironment() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const root = scene.getObjectByName('edge-academy');
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera); // bake sun shadows first so the capture includes them
  root.position.set(-BW * 0.55, -1.7, -BL * 0.55);
  root.updateMatrixWorld(true);
  scene.environment = pmrem.fromScene(scene, 0.04, 0.1, 400).texture;
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  pmrem.dispose();
  renderer.shadowMap.needsUpdate = true;
}
captureEnvironment();
world.ready.then(() => {
  setLook(false, true); // always the November morning (this also captures the finished sky for reflections)
  document.getElementById('loading')?.remove();
});

// ---------------------------------------------------------------- the light
// The walkthrough is always lit as the November morning. (The dusk look stays in LOOKS for edge.setLook(true) from
// the console, but visitors are not offered it.)
let dusk = false;
function setLook(toDusk, quiet = false) {
  dusk = toDusk;
  const L = LOOKS[dusk ? 'dusk' : 'day'];
  sun.position.copy(L.sun).multiplyScalar(50).add(new THREE.Vector3(BW / 2, 0, BL / 2));
  sun.color.set(L.sunColor);
  sun.intensity = L.sunPower;
  hemi.color.set(L.sky);
  hemi.groundColor.set(L.ground);
  hemi.intensity = L.hemi;
  scene.fog.color.set(L.fog);
  renderer.toneMappingExposure = L.exposure;
  for (const p of insideLights) {
    p.intensity = L.inside;
    p.color.set(L.insideColor);
  }
  world.setDusk(dusk, L.sun);
  captureEnvironment(); // reflections and bounce light from the new sky (also re-bakes the sun shadows)
  if (!quiet) showToast(dusk ? 'Sunset' : 'Morning');
}

// ---------------------------------------------------------------- desktop post-processing
// Ambient occlusion (contact darkening in corners and under furniture) and a soft glow on
// lights and bright windows. Desktop only: VR renders directly to keep the frame rate up.
// The composer renders off-screen, which bypasses the canvas anti-aliasing, so give it its own
// 4x multisampled target (VR renders straight to the headset with the renderer's own MSAA).
const pr = renderer.getPixelRatio();
const msaaTarget = new THREE.WebGLRenderTarget(window.innerWidth * pr, window.innerHeight * pr, { samples: 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, msaaTarget);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.2 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
gtao.blendIntensity = 0.9;
{
  // glass, decals and the sky must not occlude
  const base = gtao.overrideVisibility.bind(gtao);
  gtao.overrideVisibility = () => {
    base();
    scene.traverse((o) => {
      if (o.isMesh && (o.material.transparent || o.material.userData?.unlit)) o.visible = false;
    });
  };
}
composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.6, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// On by default; a computer that cannot keep up (under 40 frames a second over the first few seconds after
// loading) switches them off by itself, and says so. P turns them on or off at any time.
let postFX = true;
let fxChosen = false; // (once someone presses P, leave it to them)
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyP') return;
  postFX = !postFX;
  fxChosen = true;
  showToast(postFX ? 'Effects on' : 'Effects off');
});
const fxCheck = { frames: 0, skipped: 0, start: 0, done: false };
function checkFxSpeed() {
  if (fxCheck.done || fxChosen || !postFX || renderer.xr.isPresenting || document.getElementById('loading')) return;
  const now = performance.now();
  if (++fxCheck.skipped <= 3) return void (fxCheck.start = now); // (the first frames include setting up)
  fxCheck.frames++;
  const seconds = (now - fxCheck.start) / 1000;
  if (seconds < 4) return;
  fxCheck.done = true;
  if (fxCheck.frames / seconds < 40) {
    postFX = false;
    showToast('Effects off so it runs smoothly here (P turns them on)');
  }
}

// ---------------------------------------------------------------- movement + collision
const RADIUS = 0.22;
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const level = () => (rig.position.y > world.size.F1 / 2 ? 1 : 0);

function resolve(x, z) {
  const lv = level();
  for (let pass = 0; pass < 3; pass++) {
    for (const c of world.colliders) {
      if (c.level !== undefined && c.level !== lv) continue;
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= RADIUS * RADIUS) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * RADIUS;
        z = cz + (dz / d) * RADIUS;
      } else {
        // centre inside the box: push out along the shallowest side
        const pen = [x - c.minX + RADIUS, c.maxX - x + RADIUS, z - c.minZ + RADIUS, c.maxZ - z + RADIUS];
        const i = pen.indexOf(Math.min(...pen));
        if (i === 0) x = c.minX - RADIUS;
        else if (i === 1) x = c.maxX + RADIUS;
        else if (i === 2) z = c.minZ - RADIUS;
        else z = c.maxZ + RADIUS;
      }
    }
  }
  return [x, z];
}

function headXZ() {
  camera.getWorldPosition(tmpV);
  return tmpV;
}

function moveBy(dx, dz) {
  const h = headXZ();
  const [nx, nz] = resolve(h.x + dx, h.z + dz);
  rig.position.x += nx - h.x;
  rig.position.z += nz - h.z;
}

function updateHeight(dt) {
  const h = headXZ();
  const g = world.groundAt(h.x, h.z, rig.position.y);
  const k = Math.min(1, dt * 14);
  rig.position.y += (g - rig.position.y) * k;
}

function headYaw() {
  camera.getWorldDirection(tmpV2);
  return Math.atan2(-tmpV2.x, -tmpV2.z);
}

function rotateAroundHead(angle) {
  const before = headXZ().clone();
  rig.rotation.y += angle;
  rig.updateMatrixWorld(true);
  const after = headXZ();
  rig.position.x += before.x - after.x;
  rig.position.z += before.z - after.z;
}

// ---------------------------------------------------------------- tour stops
let stopIndex = 0;
function goTo(i) {
  stopIndex = (i + world.stops.length) % world.stops.length;
  const s = world.stops[stopIndex];
  rig.updateMatrixWorld(true);
  // keep the user's physical offset inside their play space (matters in VR)
  const localYaw = renderer.xr.isPresenting ? new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y : 0;
  rig.rotation.y = s.yaw - localYaw;
  pitch = 0;
  if (!renderer.xr.isPresenting) camera.rotation.set(0, 0, 0);
  rig.updateMatrixWorld(true);
  const off = new THREE.Vector3(camera.position.x, 0, camera.position.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), rig.rotation.y);
  rig.position.set(s.x - off.x, s.y, s.z - off.z);
  showToast(s.name);
  document.querySelectorAll('#stops button').forEach((b, k) => b.classList.toggle('on', k === stopIndex));
}

// ---------------------------------------------------------------- desktop input
const keys = new Set();
let pitch = 0;
let dragging = false;
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  keys.add(e.code);
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= world.stops.length) goTo(n - 1);
  if (e.code === 'KeyH') document.body.classList.toggle('hide-ui');
  if (e.code === 'KeyM') document.body.classList.toggle('hide-map');
  if (e.code === 'KeyC') toggleChairs();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const canvas = renderer.domElement;
canvas.addEventListener('mousedown', () => {
  dragging = true;
  if (canvas.requestPointerLock) {
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch { /* pointer lock unavailable (embedded view): drag to look */ }
  }
});
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => {
  if (renderer.xr.isPresenting) return;
  if (document.pointerLockElement !== canvas && !dragging) return;
  look(e.movementX, e.movementY);
});
function look(mx, my) {
  rig.rotation.y -= mx * 0.0023;
  pitch = Math.max(-1.35, Math.min(1.35, pitch - my * 0.0023));
  camera.rotation.x = pitch;
}
// touch: one finger looks, two fingers walk forward
let lastTouch = null;
canvas.addEventListener('touchstart', (e) => (lastTouch = e.touches[0]), { passive: true });
canvas.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (lastTouch && e.touches.length === 1) look((t.clientX - lastTouch.clientX) * 2, (t.clientY - lastTouch.clientY) * 2);
  lastTouch = t;
  touchWalk = e.touches.length >= 2;
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
  touchWalk = e.touches.length >= 2;
  if (!e.touches.length) lastTouch = null;
}, { passive: true });
let touchWalk = false;

function desktopUpdate(dt) {
  let f = 0;
  let s = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
  if (keys.has('KeyD')) s += 1;
  if (keys.has('KeyA')) s -= 1;
  if (keys.has('ArrowLeft') || keys.has('KeyQ')) rig.rotation.y += 1.8 * dt;
  if (keys.has('ArrowRight') || keys.has('KeyE')) rig.rotation.y -= 1.8 * dt;
  if (touchWalk) f = 1;
  if (!f && !s) return;
  const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3.0 : 1.5) * dt;
  const len = Math.hypot(f, s);
  const yaw = rig.rotation.y;
  const dx = ((-Math.sin(yaw) * f + Math.cos(yaw) * s) / len) * speed;
  const dz = ((-Math.cos(yaw) * f - Math.sin(yaw) * s) / len) * speed;
  moveBy(dx, dz);
}

// ---------------------------------------------------------------- VR input
const SNAP = Math.PI / 6;
let snapReady = true;
const pressed = new Map();
function vrUpdate(dt) {
  const session = renderer.xr.getSession();
  if (!session) return;
  for (const src of session.inputSources) {
    const gp = src.gamepad;
    if (!gp) continue;
    const ax = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0] || 0;
    const ay = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1] || 0;
    if (src.handedness === 'left') {
      const dead = 0.15;
      const mx = Math.abs(ax) > dead ? ax : 0;
      const my = Math.abs(ay) > dead ? ay : 0;
      if (mx || my) {
        const yaw = headYaw();
        const sp = (gp.buttons[0]?.pressed ? 3.0 : 1.6) * dt; // hold trigger to go faster
        moveBy((-Math.sin(yaw) * -my + Math.cos(yaw) * mx) * sp, (-Math.cos(yaw) * -my - Math.sin(yaw) * mx) * sp);
      }
    } else if (src.handedness === 'right') {
      if (Math.abs(ax) > 0.6 && snapReady) {
        rotateAroundHead(ax > 0 ? -SNAP : SNAP);
        snapReady = false;
      } else if (Math.abs(ax) < 0.3) snapReady = true;
    }
    // A / X = next stop, B / Y = previous stop
    // left thumbstick click = show / hide the hub chairs
    if (src.handedness === 'left') {
      const now = !!gp.buttons[3]?.pressed;
      if (now && !pressed.get('chairs')) toggleChairs();
      pressed.set('chairs', now);
    }
    for (const [idx, dir] of [[4, 1], [5, -1]]) {
      const key = src.handedness + idx;
      const now = !!gp.buttons[idx]?.pressed;
      if (now && !pressed.get(key)) goTo(stopIndex + dir);
      pressed.set(key, now);
    }
  }
}

// ---------------------------------------------------------------- in-world toast (works in VR too)
const toastCanvas = document.createElement('canvas');
toastCanvas.width = 1024;
toastCanvas.height = 160;
const toastTex = new THREE.CanvasTexture(toastCanvas);
toastTex.colorSpace = THREE.SRGBColorSpace;
const toast = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.156), new THREE.MeshBasicMaterial({ map: toastTex, transparent: true, depthTest: false }));
toast.renderOrder = 999;
toast.visible = false;
scene.add(toast);
let toastUntil = 0;
function showToast(text) {
  const g = toastCanvas.getContext('2d');
  g.clearRect(0, 0, 1024, 160);
  g.fillStyle = 'rgba(28,36,60,0.82)';
  g.beginPath();
  g.roundRect(8, 8, 1008, 144, 40);
  g.fill();
  g.fillStyle = '#fff';
  g.font = '600 72px "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 512, 84);
  toastTex.needsUpdate = true;
  toastUntil = performance.now() + 2600;
  toast.visible = renderer.xr.isPresenting;
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => el.classList.remove('show'), 2200);
}
function updateToast() {
  if (!toast.visible) return;
  if (performance.now() > toastUntil) {
    toast.visible = false;
    return;
  }
  camera.getWorldPosition(tmpV);
  camera.getWorldDirection(tmpV2);
  tmpV2.y = 0;
  tmpV2.normalize();
  toast.position.copy(tmpV).addScaledVector(tmpV2, 1.4);
  toast.position.y -= 0.35;
  toast.lookAt(tmpV.x, toast.position.y, tmpV.z);
}

// ---------------------------------------------------------------- minimap
const map = document.getElementById('map');
const mg = map.getContext('2d');
function drawMap() {
  if (document.body.classList.contains('hide-map') || renderer.xr.isPresenting) return;
  const { W, L } = world.size;
  const s = Math.min((map.width - 16) / L, (map.height - 16) / W);
  const ox = 8;
  const oy = 8;
  // building drawn lying on its side: plan z -> screen x, plan x -> screen y (north at left)
  const P = (x, z) => [ox + z * s, oy + (W - x) * s];
  mg.clearRect(0, 0, map.width, map.height);
  mg.fillStyle = 'rgba(250,248,243,0.92)';
  mg.fillRect(ox, oy, L * s, W * s);
  const lv = level();
  mg.fillStyle = '#5b6170';
  for (const c of world.colliders) {
    if (c.level !== undefined && c.level !== lv) continue;
    if (c.maxX < 0 || c.minX > W || c.maxZ < 0 || c.minZ > L) continue;
    const [x0, y1] = P(c.minX, c.minZ);
    const [x1, y0] = P(c.maxX, c.maxZ);
    mg.fillRect(x0, y0, Math.max(1.5, x1 - x0), Math.max(1.5, y1 - y0));
  }
  mg.fillStyle = 'rgba(44,58,99,0.75)';
  mg.font = '600 11px "Segoe UI", Arial';
  mg.textAlign = 'center';
  for (const r of world.rooms) {
    if (r.level !== lv) continue;
    const [px, py] = P(r.x, r.z);
    mg.fillText(r.name, px, py);
  }
  const h = headXZ();
  const [px, py] = P(h.x, h.z);
  const yaw = headYaw();
  const dirx = -Math.sin(yaw);
  const dirz = -Math.cos(yaw);
  mg.fillStyle = '#c2336e';
  mg.beginPath();
  mg.arc(px, py, 5, 0, Math.PI * 2);
  mg.fill();
  mg.strokeStyle = '#c2336e';
  mg.lineWidth = 2.5;
  mg.beginPath();
  mg.moveTo(px, py);
  mg.lineTo(px + dirz * 16, py - dirx * 16);
  mg.stroke();
  document.getElementById('floor').textContent = lv ? 'First floor' : 'Ground floor';
}

// ---------------------------------------------------------------- UI wiring
const stopsEl = document.getElementById('stops');
world.stops.forEach((s, i) => {
  const btn = document.createElement('button');
  btn.textContent = `${i + 1}  ${s.name}`;
  btn.addEventListener('click', () => goTo(i));
  stopsEl.appendChild(btn);
});

const vrBtn = document.getElementById('vr');
async function setupVR() {
  if (!navigator.xr) {
    vrBtn.textContent = window.isSecureContext ? 'VR not available in this browser' : 'VR needs https or localhost';
    return;
  }
  const ok = await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!ok) {
    vrBtn.textContent = 'No VR headset found';
    return;
  }
  vrBtn.disabled = false;
  vrBtn.textContent = 'Enter VR';
  vrBtn.addEventListener('click', async () => {
    if (renderer.xr.isPresenting) {
      renderer.xr.getSession().end();
      return;
    }
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    session.addEventListener('end', () => {
      vrBtn.textContent = 'Enter VR';
      camera.position.set(0, EYE, 0);
      camera.rotation.set(pitch, 0, 0);
      document.body.classList.remove('in-vr');
    });
    await renderer.xr.setSession(session);
    vrBtn.textContent = 'Exit VR';
    document.body.classList.add('in-vr');
    setTimeout(() => goTo(stopIndex), 50);
  });
}
setupVR();

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let mapTimer = 0;
function tick(dt) {
  if (renderer.xr.isPresenting) vrUpdate(dt);
  else desktopUpdate(dt);
  world.update?.(dt); // traffic
  rig.updateMatrixWorld(true);
  updateHeight(dt);
  updateToast();
  mapTimer += dt;
  if (mapTimer > 0.1) {
    mapTimer = 0;
    drawMap();
  }
}
renderer.setAnimationLoop(() => {
  const raw = clock.getDelta();
  checkFxSpeed();
  tick(Math.min(raw, 0.05));
  if (postFX && !renderer.xr.isPresenting) composer.render();
  else renderer.render(scene, camera);
});

// debug / automation hook: edge.simulate(seconds, ['KeyW']) walks without waiting for frames
window.edge = {
  goTo, rig, camera, renderer, world, look, scene,
  get postFX() { return postFX; },
  setLook,
  get dusk() { return dusk; },
  fxCheck,
  overlaps: (tol) => world.overlaps(tol),
  simulate(seconds, codes = []) {
    codes.forEach((c) => keys.add(c));
    for (let t = 0; t < seconds; t += 1 / 60) tick(1 / 60);
    codes.forEach((c) => keys.delete(c));
    const p = rig.position;
    return [p.x, p.y, p.z].map((v) => +v.toFixed(2));
  },
};

goTo(0);
setTimeout(() => document.getElementById('loading')?.remove(), 8000); // never block on a slow asset

// ---------------------------------------------------------------- hub chairs toggle
const chairBtn = document.getElementById('chairs');
function toggleChairs(show) {
  const g = world.layers['hub-chairs'];
  if (!g) return;
  g.visible = show ?? !g.visible;
  renderer.shadowMap.needsUpdate = true; // shadows are baked once, so refresh them
  chairBtn.textContent = g.visible ? 'Hide hub chairs' : 'Show hub chairs';
  chairBtn.classList.toggle('on', !g.visible);
  showToast(g.visible ? 'Hub chairs shown' : 'Hub chairs hidden');
}
chairBtn.addEventListener('click', () => toggleChairs());
window.edge.toggleChairs = toggleChairs;
