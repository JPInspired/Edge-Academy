// Procedural canvas textures. Everything is drawn in code, so the project ships no image files.
import * as THREE from 'three';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function make(w, h, draw, { repeat = true, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

// Light oak planks. One texture tile = 2 m x 2 m; planks run along v.
export function woodFloor() {
  return make(1024, 1024, (g, w, h) => {
    const r = rng(7);
    const cols = 10;
    const pw = w / cols;
    for (let c = 0; c < cols; c++) {
      let y = -r() * 400;
      while (y < h) {
        const len = 280 + r() * 420;
        const base = ['#d8b98d', '#cfae80', '#dcc097', '#c9a676', '#d4b487'][Math.floor(r() * 5)];
        g.fillStyle = base;
        g.fillRect(c * pw, y, pw, len);
        g.globalAlpha = 0.18;
        for (let i = 0; i < 14; i++) {
          g.strokeStyle = r() > 0.5 ? shade(base.replace('rgb', ''), 0.8) : '#b8935f';
          g.lineWidth = 1 + r() * 2;
          const x = c * pw + r() * pw;
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + (r() - 0.5) * 12, y + len / 3, x + (r() - 0.5) * 12, y + (2 * len) / 3, x + (r() - 0.5) * 8, y + len);
          g.stroke();
        }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(90,60,30,0.35)';
        g.fillRect(c * pw, y, pw, 2);
        y += len;
      }
      g.fillStyle = 'rgba(90,60,30,0.3)';
      g.fillRect(c * pw, 0, 2, h);
    }
  });
}

// Wood-wool acoustic ceiling panels. One tile = 1.2 m x 1.2 m.
export function woodWool() {
  return make(512, 512, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = '#cdb28c';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const x = r() * w;
      const y = r() * h;
      const a = r() * Math.PI;
      const l = 3 + r() * 9;
      g.strokeStyle = r() > 0.5 ? 'rgba(160,125,85,0.55)' : 'rgba(235,215,180,0.55)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    g.fillStyle = 'rgba(110,85,55,0.45)';
    g.fillRect(0, 0, w, 3);
    g.fillRect(0, h / 2, w, 3);
    g.fillRect(0, 0, 3, h);
  });
}

function scribble(g, r, x, y, w, color) {
  g.strokeStyle = color;
  g.lineWidth = 2.2;
  g.beginPath();
  let cx = x;
  g.moveTo(cx, y);
  while (cx < x + w) {
    const step = 4 + r() * 7;
    g.lineTo(cx + step / 2, y - 4 - r() * 8);
    g.lineTo(cx + step, y + r() * 3);
    cx += step;
    if (r() < 0.12) {
      cx += 8 + r() * 10;
      g.moveTo(cx, y);
    }
  }
  g.stroke();
}

// Handwritten-looking marker board.
export function board(seed = 1, { bg = '#f7f7f4', ink = '#262a33', frame = true, title = '', blank = false } = {}) {
  return make(1024, 512, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    if (frame) {
      g.strokeStyle = '#b9bcc0';
      g.lineWidth = 10;
      g.strokeRect(5, 5, w - 10, h - 10);
    }
    if (blank) {
      // a clean board: only a soft diagonal sheen across the surface
      const sheen = g.createLinearGradient(0, 0, w, h);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.45, 'rgba(255,255,255,0.28)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sheen;
      g.fillRect(0, 0, w, h);
      return;
    }
    if (title) {
      g.fillStyle = ink;
      g.font = 'bold 44px "Segoe Print", "Comic Sans MS", cursive';
      g.fillText(title, 60, 80);
    }
    for (let blk = 0; blk < 5; blk++) {
      const bx = 50 + r() * (w - 380);
      const by = (title ? 140 : 70) + r() * (h - 220);
      const kind = r();
      g.strokeStyle = ink;
      g.lineWidth = 2.5;
      if (kind < 0.35) {
        for (let i = 0; i < 4; i++) scribble(g, r, bx, by + i * 30, 120 + r() * 160, ink);
      } else if (kind < 0.6) {
        for (let i = 0; i < 3; i++) {
          g.strokeRect(bx + i * 95, by + (i % 2) * 40, 70, 40);
          if (i < 2) {
            g.beginPath();
            g.moveTo(bx + i * 95 + 70, by + 20 + (i % 2) * 40);
            g.lineTo(bx + i * 95 + 95, by + 20 + ((i + 1) % 2) * 40);
            g.stroke();
          }
        }
      } else if (kind < 0.8) {
        g.beginPath();
        g.arc(bx + 60, by + 50, 45, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.arc(bx + 120, by + 50, 45, 0, Math.PI * 2);
        g.stroke();
        scribble(g, r, bx + 20, by + 130, 140, ink);
      } else {
        g.beginPath();
        g.moveTo(bx, by + 90);
        g.lineTo(bx + 200, by + 90);
        g.moveTo(bx, by + 90);
        g.lineTo(bx, by - 10);
        g.stroke();
        g.beginPath();
        for (let i = 0; i <= 40; i++) {
          const px = bx + i * 5;
          const py = by + 60 - Math.sin(i / 5) * 30 - i * 0.6;
          i ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.stroke();
      }
    }
  }, { repeat: false });
}

export function books(seed = 3) {
  return make(512, 256, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = '#3a3128';
    g.fillRect(0, 0, w, h);
    const cols = ['#24324a', '#7b2d26', '#d9c9a3', '#2f5d50', '#c8a13a', '#5a3d5c', '#e4e0d6', '#1d1d1d', '#a6542e', '#476b8a', '#8c8f3a'];
    let x = 0;
    while (x < w) {
      const bw = 8 + r() * 16;
      const bh = h * (0.68 + r() * 0.3);
      const c = cols[Math.floor(r() * cols.length)];
      g.fillStyle = c;
      g.fillRect(x, h - bh, bw - 1, bh);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x + 2, h - bh + 12, bw - 5, 3);
      g.fillRect(x + 2, h - 22, bw - 5, 2);
      x += bw;
      if (r() < 0.06) x += 20;
    }
  }, { repeat: false });
}

export function screen(kind = 'tech') {
  return make(1024, 576, (g, w, h) => {
    const r = rng(kind.length * 13);
    if (kind === 'desktop') {
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#1b4f9c');
      gr.addColorStop(0.5, '#3d8fd8');
      gr.addColorStop(1, '#0e2c66');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(w * 0.25, h - 50, w * 0.5, 38);
      for (let i = 0; i < 12; i++) {
        g.fillStyle = `hsl(${i * 30},60%,60%)`;
        g.fillRect(w * 0.26 + i * 40, h - 45, 28, 28);
      }
      return;
    }
    const robot = kind === 'robot';
    const gr = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.7);
    gr.addColorStop(0, robot ? '#7a4fb8' : '#2a6fd0');
    gr.addColorStop(1, robot ? '#1a1240' : '#050d2a');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const pts = [];
    for (let i = 0; i < 70; i++) pts.push([r() * w, r() * h]);
    g.strokeStyle = robot ? 'rgba(120,230,255,0.35)' : 'rgba(110,190,255,0.35)';
    g.lineWidth = 1.5;
    for (const [x, y] of pts) {
      for (const [x2, y2] of pts) {
        if (Math.hypot(x - x2, y - y2) < 110) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x2, y2);
          g.stroke();
        }
      }
    }
    for (const [x, y] of pts) {
      g.fillStyle = 'rgba(190,240,255,0.9)';
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fill();
    }
    // stylised figure
    g.fillStyle = robot ? 'rgba(230,220,255,0.85)' : 'rgba(170,220,255,0.55)';
    g.beginPath();
    g.ellipse(w / 2, h * 0.3, 55, 70, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(w / 2 - 80, h * 0.43, 160, h * 0.5);
    if (robot) {
      g.fillStyle = '#4ff0ff';
      g.fillRect(w / 2 - 25, h * 0.55, 50, 50);
    }
    const glow = g.createRadialGradient(w * 0.6, h * 0.4, 2, w * 0.6, h * 0.4, 90);
    glow.addColorStop(0, 'rgba(255,255,255,0.95)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
  }, { repeat: false });
}

const POSTER_TITLES = ['ROBOTIX 3.0', 'AI NAVIGATION', 'SQUARE BOT', 'ROVER MK2', 'DRONE KIT', 'GEAR TRAIN'];
export function poster(seed = 1) {
  return make(384, 512, (g, w, h) => {
    const r = rng(seed * 31);
    g.fillStyle = '#f4f2ec';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#222';
    g.font = 'bold 30px Arial, sans-serif';
    g.fillText(POSTER_TITLES[seed % POSTER_TITLES.length], 22, 48);
    g.strokeStyle = '#333';
    g.lineWidth = 2;
    const cx = w / 2;
    const cy = h * 0.5;
    if (seed % 3 === 0) {
      // gears
      for (const [gx, gy, gr] of [[cx - 50, cy, 60], [cx + 60, cy + 40, 40], [cx + 30, cy - 80, 30]]) {
        g.beginPath();
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          const rr = gr + (i % 4 < 2 ? 8 : 0);
          g.lineTo(gx + Math.cos(a) * rr, gy + Math.sin(a) * rr);
        }
        g.stroke();
        g.beginPath();
        g.arc(gx, gy, gr * 0.3, 0, Math.PI * 2);
        g.stroke();
      }
    } else if (seed % 3 === 1) {
      // robot arm
      g.lineWidth = 3;
      g.strokeRect(cx - 50, h - 140, 100, 30);
      g.beginPath();
      g.moveTo(cx, h - 140);
      g.lineTo(cx - 30, cy);
      g.lineTo(cx + 70, cy - 90);
      g.lineTo(cx + 100, cy - 60);
      g.stroke();
      for (const [x, y] of [[cx, h - 140], [cx - 30, cy], [cx + 70, cy - 90]]) {
        g.beginPath();
        g.arc(x, y, 14, 0, Math.PI * 2);
        g.stroke();
      }
    } else {
      // rover / robot body
      g.strokeRect(cx - 80, cy - 40, 160, 80);
      g.strokeRect(cx - 40, cy - 100, 80, 60);
      for (const x of [-60, 0, 60]) {
        g.beginPath();
        g.arc(cx + x, cy + 65, 24, 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      const y = h - 90 + i * 12;
      g.moveTo(22, y);
      g.lineTo(22 + 120 + r() * 200, y);
      g.stroke();
    }
  }, { repeat: false });
}

export function logo({ lisbon = true, dark = '#2c3a63' } = {}) {
  return make(1024, 512, (g, w, h) => {
    const cx = 210;
    const cy = 256;
    const R = 130;
    g.lineWidth = 46;
    const arcs = [['#c2336e', -1.2, 0.9], ['#3e8fd0', 0.9, 3.0], ['#efe0b8', 3.0, 5.1]];
    for (const [c, a0, a1] of arcs) {
      g.strokeStyle = c;
      g.beginPath();
      g.arc(cx, cy, R, a0, a1);
      g.stroke();
    }
    g.fillStyle = dark;
    g.fillRect(380, 120, 6, 280);
    g.fillStyle = '#3d74b8';
    g.font = 'bold 120px Georgia, "Times New Roman", serif';
    g.fillText('inspired', 410, 230);
    g.fillStyle = dark;
    g.font = '600 48px "Segoe UI", Arial, sans-serif';
    g.fillText('E D G E   A C A D E M Y', 412, 310);
    if (lisbon) {
      g.font = '600 40px "Segoe UI", Arial, sans-serif';
      g.fillText('L I S B O N', 560, 375);
    }
  }, { repeat: false });
}

// Etched ring decals across glass partitions. One tile = 1.2 m wide x 3 m tall.
export function glassDecal() {
  return make(256, 640, (g, w, h) => {
    const r = rng(5);
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(205,225,230,0.14)';
    g.fillRect(0, 0, w, h);
    const band0 = h * (1 - 1.65 / 3);
    const band1 = h * (1 - 1.05 / 3);
    for (let i = 0; i < 9; i++) {
      const x = r() * w;
      const y = band0 + r() * (band1 - band0);
      const rr = 6 + r() * 12;
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 3 + r() * 3;
      g.beginPath();
      g.arc(x, y, rr, 0.4, Math.PI * 2 - 0.2);
      g.stroke();
    }
  });
}

export function sign(text, { color = '#2c3a63', bg = null, w = 1024, h = 192, font = '600 96px "Segoe UI", Arial, sans-serif' } = {}) {
  return make(w, h, (g) => {
    if (bg) {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
    } else g.clearRect(0, 0, w, h);
    g.fillStyle = color;
    g.font = font;
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillText(text, w / 2, h / 2 + 4);
  }, { repeat: false });
}

export function lockers(cols = 6, rows = 3, base = '#e6dccb') {
  return make(512, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,60,40,0.55)';
    g.lineWidth = 4;
    for (let c = 0; c <= cols; c++) {
      g.beginPath();
      g.moveTo((c * w) / cols, 0);
      g.lineTo((c * w) / cols, h);
      g.stroke();
    }
    for (let rr = 0; rr <= rows; rr++) {
      g.beginPath();
      g.moveTo(0, (rr * h) / rows);
      g.lineTo(w, (rr * h) / rows);
      g.stroke();
    }
    g.fillStyle = '#7b7b7b';
    for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) g.fillRect(((c + 0.8) * w) / cols - 3, ((rr + 0.5) * h) / rows - 14, 6, 28);
  }, { repeat: false });
}

export function sky() {
  const t = make(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#3f78c2');
    gr.addColorStop(0.3, '#7fb0e3');
    gr.addColorStop(0.47, '#cfe1ef');
    gr.addColorStop(0.5, '#e8eef1');
    gr.addColorStop(0.51, '#a7a79c');
    gr.addColorStop(1, '#6e6d66');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }, { repeat: false });
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

export function paving() {
  return make(256, 256, (g, w, h) => {
    const r = rng(9);
    g.fillStyle = '#c9c5bc';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)';
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo((i * w) / 4, 0);
      g.lineTo((i * w) / 4, h);
      g.moveTo(0, (i * h) / 4);
      g.lineTo(w, (i * h) / 4);
      g.stroke();
    }
  });
}

export function facadeWindows() {
  return make(256, 256, (g, w, h) => {
    g.fillStyle = '#f1f0ec';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#5d7488';
    g.fillRect(16, 60, w - 32, 140);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(16, 60, w - 32, 30);
  });
}

// ---- realism helpers ----------------------------------------------------------------

// Woven fabric: light grey so it can be tinted by the material colour.
export function fabric() {
  return make(256, 256, (g, w, h) => {
    const r = rng(17);
    g.fillStyle = '#e6e6e6';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`;
      g.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 2) {
      g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`;
      g.fillRect(x, 0, 1, h);
    }
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1);
    }
  });
}

// Very subtle plaster / paint variation.
export function plaster() {
  return make(256, 256, (g, w, h) => {
    const r = rng(23);
    g.fillStyle = '#f2f2f2';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = r() * w;
      const y = r() * h;
      const gr = g.createRadialGradient(x, y, 0, x, y, 10 + r() * 30);
      const a = 0.025 * r();
      gr.addColorStop(0, r() > 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 2})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
  });
}

export function grass() {
  return make(512, 512, (g, w, h) => {
    const r = rng(29);
    g.fillStyle = '#6f8a48';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) {
      const c = ['#5f7a3c', '#7d9952', '#8aa45a', '#566f35', '#93a866'][Math.floor(r() * 5)];
      g.fillStyle = c;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 2 + r() * 3);
    }
  });
}

export function asphalt() {
  return make(256, 256, (g, w, h) => {
    const r = rng(31);
    g.fillStyle = '#5a5b5d';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = 60 + r() * 70;
      g.fillStyle = `rgb(${v},${v},${v + 3})`;
      g.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
  });
}

// Radial soft shadow used under furniture (fake ambient occlusion).
export function blob() {
  return make(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.5)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0.28)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }, { repeat: false, srgb: false });
}

// Linear soft shadow used where walls meet the floor (v = 0 at the wall).
export function edgeShade() {
  return make(4, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.32)');
    gr.addColorStop(0.35, 'rgba(0,0,0,0.12)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }, { repeat: false, srgb: false });
}

// Varied leaf colour for foliage.
export function leaves() {
  return make(256, 256, (g, w, h) => {
    const r = rng(37);
    g.fillStyle = '#4f6e35';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = ['#3e5a29', '#5f8240', '#6d9148', '#2f4720', '#7a9c52'][Math.floor(r() * 5)];
      g.beginPath();
      g.ellipse(r() * w, r() * h, 2 + r() * 3, 1 + r() * 2, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
}

// ---- the real site (PaRK International School Alfragide) -------------------------------------

// PaRK's main building: closely spaced white vertical fins over dark glass. One tile = 2.4 m x one floor (3.6 m).
export function fins() {
  return make(256, 384, (g, w, h) => {
    const r = rng(41);
    g.fillStyle = '#3b4955';
    g.fillRect(0, 0, w, h);
    // windows behind the fins, a few lit
    for (let i = 0; i < 3; i++) {
      g.fillStyle = r() > 0.75 ? 'rgba(255,236,190,0.35)' : 'rgba(150,175,195,0.25)';
      g.fillRect(i * (w / 3) + 4, 40, w / 3 - 8, h - 120);
    }
    // the floor slab band
    g.fillStyle = '#f4f3ef';
    g.fillRect(0, h - 64, w, 64);
    // fins: 8 per tile (every 30 cm), with a shaded side
    for (let i = 0; i < 8; i++) {
      const x = (i * w) / 8;
      g.fillStyle = '#f7f6f2';
      g.fillRect(x, 0, 14, h);
      g.fillStyle = '#cfcdc6';
      g.fillRect(x + 14, 0, 5, h);
    }
  });
}

// Terracotta roof tiles (Portuguese houses). One tile = 2 m.
export function tiles() {
  return make(256, 256, (g, w, h) => {
    const r = rng(17);
    g.fillStyle = '#c4673f';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      for (let x = (y / 16) % 2 ? -12 : 0; x < w; x += 24) {
        g.fillStyle = `rgba(${r() > 0.5 ? '255,220,190' : '90,30,10'},${0.06 + r() * 0.1})`;
        g.fillRect(x, y, 22, 14);
        g.fillStyle = 'rgba(60,20,5,0.25)';
        g.fillRect(x, y + 13, 22, 3);
      }
    }
  });
}

// Sports hall: light grey ribbed metal cladding with a high band of windows. One tile = 4 m x 10 m.
export function cladding(base = '#d5d7d8') {
  return make(256, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = 'rgba(0,0,0,0.07)';
      g.fillRect(x, 0, 3, h);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x + 3, 0, 2, h);
    }
    g.fillStyle = '#4c5f6e';
    g.fillRect(0, 60, w, 70);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(0, 60, w, 14);
    for (let x = 0; x < w; x += 64) {
      g.fillStyle = '#c9cbcc';
      g.fillRect(x, 60, 6, 70);
    }
  });
}

// Long horizontal window bands, one per floor (school and office blocks). One tile = 6 m x 3.6 m.
export function bands(wall = '#f2f1ed', glass = '#55697a') {
  return make(256, 192, (g, w, h) => {
    g.fillStyle = wall;
    g.fillRect(0, 0, w, h);
    g.fillStyle = glass;
    g.fillRect(0, 50, w, 92);
    g.fillStyle = 'rgba(255,255,255,0.2)';
    g.fillRect(0, 50, w, 18);
    g.fillStyle = shade(wall, 0.85);
    for (let x = 0; x < w; x += 64) g.fillRect(x, 50, 5, 92);
  });
}

// Plaster walls with punched windows and shutters (flats and houses). One tile = 3.2 m x 3 m.
export function punched(wall = '#f1ece2', house = false) {
  return make(256, 256, (g, w, h) => {
    const r = rng(wall.length * 13 + (house ? 7 : 0));
    g.fillStyle = wall;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.06)';
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    const x0 = 72, ww = 112, y0 = 64, wh = 128;
    g.fillStyle = shade(wall, 0.8);
    g.fillRect(x0 - 6, y0 - 6, ww + 12, wh + 14);
    g.fillStyle = '#4d5e6c';
    g.fillRect(x0, y0, ww, wh);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(x0, y0, ww, 26);
    g.fillStyle = shade(wall, 0.7);
    g.fillRect(x0 + ww / 2 - 3, y0, 6, wh);
    if (!house) {
      // a small balcony rail on the flats
      g.fillStyle = 'rgba(40,45,50,0.8)';
      g.fillRect(x0 - 12, y0 + wh - 46, ww + 24, 5);
      for (let x = x0 - 12; x < x0 + ww + 12; x += 12) g.fillRect(x, y0 + wh - 46, 3, 46);
    }
  });
}

// Neutral speckle for the ground: the colour comes from the vertices (grass on the level, earth on the slope).
export function speckle() {
  return make(512, 512, (g, w, h) => {
    const r = rng(53);
    g.fillStyle = '#d0d0d0';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30000; i++) {
      const v = 150 + Math.floor(r() * 105);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 2 + r() * 3);
    }
  });
}

// Smooth light grey concrete (the courtyard), with faint joints every 4 m. One tile = 8 m.
export function plazaConcrete() {
  return make(512, 512, (g, w, h) => {
    const r = rng(61);
    g.fillStyle = '#cfcbc3';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.05)';
      g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3);
    }
    g.strokeStyle = 'rgba(0,0,0,0.13)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2);
    g.moveTo(0, 1); g.lineTo(w, 1); g.moveTo(1, 0); g.lineTo(1, h);
    g.stroke();
  });
}

// PaRK main building behind its fins: white wall with tall narrow windows in pairs. One tile = 3 m x 3.5 m.
export function narrowWindows() {
  return make(256, 300, (g, w, h) => {
    g.fillStyle = '#efeee9';
    g.fillRect(0, 0, w, h);
    for (const x of [40, 84, 168, 212]) {
      g.fillStyle = '#2f3d49';
      g.fillRect(x, 50, 26, 200);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(x, 50, 26, 40);
      g.fillStyle = '#d8d6cf';
      g.fillRect(x - 3, 250, 32, 6);
    }
  });
}

// Precast concrete wall panels (the campus boundary along the motorway): upright panels 1.25 m wide. One tile = 2.5 m x 2.5 m.
export function precast() {
  return make(256, 256, (g, w, h) => {
    const r = rng(71);
    g.fillStyle = '#b4b5b0';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    // weathering streaks and the joints
    for (let i = 0; i < 18; i++) {
      g.fillStyle = 'rgba(70,70,65,0.06)';
      g.fillRect(r() * w, 0, 3 + r() * 8, h * (0.3 + r() * 0.7));
    }
    g.fillStyle = 'rgba(40,40,38,0.35)';
    g.fillRect(0, 0, 3, h);
    g.fillRect(w / 2, 0, 3, h);
  });
}

// Dusk sky (as in the photographs of PaRK at sunset): lavender above, peach and orange along the horizon, the
// sun's glow at u (0..1 around the panorama, the same mapping three.js uses for equirectangular skies).
export function duskSky(u = 0.25) {
  const t = make(2048, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#2f3b6b');
    gr.addColorStop(0.25, '#5d6599');
    gr.addColorStop(0.4, '#9a9cc4');
    gr.addColorStop(0.47, '#d9b3b5');
    gr.addColorStop(0.5, '#f0b98c');
    gr.addColorStop(0.505, '#5b5258');
    gr.addColorStop(1, '#3a3438');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    // the sun's glow along the horizon (drawn twice so it wraps round the seam)
    for (const x of [u * w, u * w - w, u * w + w]) {
      const glow = g.createRadialGradient(x, h * 0.5, 0, x, h * 0.5, w * 0.28);
      glow.addColorStop(0, 'rgba(255,214,150,0.95)');
      glow.addColorStop(0.15, 'rgba(255,170,110,0.6)');
      glow.addColorStop(0.5, 'rgba(240,140,120,0.18)');
      glow.addColorStop(1, 'rgba(240,140,120,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h * 0.505);
      g.fillStyle = 'rgba(255,236,200,1)';
      g.beginPath();
      g.arc(x, h * 0.488, 9, 0, Math.PI * 2);
      g.fill();
    }
    // a few long, thin clouds lit from below
    const r = rng(83);
    for (let i = 0; i < 26; i++) {
      const y = h * (0.3 + r() * 0.16);
      g.fillStyle = `rgba(${r() > 0.5 ? '255,190,170' : '200,170,200'},${0.12 + r() * 0.18})`;
      g.beginPath();
      g.ellipse(r() * w, y, 60 + r() * 220, 3 + r() * 6, 0, 0, Math.PI * 2);
      g.fill();
    }
  }, { repeat: false });
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

// PaRK's main building at dusk: only the lit windows (used as a glow over narrowWindows()).
export function narrowWindowsGlow() {
  return make(256, 300, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    const r = rng(97);
    for (const x of [40, 84, 168, 212]) {
      if (r() < 0.3) continue; // some rooms dark
      g.fillStyle = r() > 0.5 ? '#ffd9a0' : '#ffe9c4';
      g.fillRect(x, 50, 26, 200);
    }
  });
}

// Curtain-wall glazing (PaRK's glazed ground floor): glass panes 1.5 m wide between light frames, a transom
// at door height. One tile = 1.5 m x 3.6 m. glow = true draws only the panes (lit from inside at dusk).
export function curtainWall(glow = false) {
  return make(128, 307, (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#cfd3d6';
    g.fillRect(0, 0, w, h);
    const pane = (y0, y1, a) => {
      if (glow) {
        g.fillStyle = `rgba(255,214,160,${a})`;
        g.fillRect(6, y0, w - 12, y1 - y0);
        return;
      }
      const gr = g.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, '#5b6e7c');
      gr.addColorStop(1, '#2c3a44');
      g.fillStyle = gr;
      g.fillRect(6, y0, w - 12, y1 - y0);
    };
    pane(6, 70, 0.75); // above the transom
    pane(78, h - 8, 1); // the main pane
  });
}

// Artificial turf: mown stripes. One tile = 10 m.
export function turf() {
  return make(256, 256, (g, w, h) => {
    const r = rng(101);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? '#d8d8d8' : '#f2f2f2';
      g.fillRect((i * w) / 4, 0, w / 4, h);
    }
    for (let i = 0; i < 6000; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
      g.fillRect(r() * w, r() * h, 1, 3);
    }
  });
}

// A height field (0..1, w x h, tiling) turned into a tangent-space normal map (linear, not sRGB).
function normalFrom(height, w, h, strength) {
  return make(w, h, (g) => {
    const img = g.createImageData(w, h);
    const H = (x, y) => height[((y + h) % h) * w + ((x + w) % w)];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
        const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
        const l = Math.hypot(dx, dy, 1);
        const i = (y * w + x) * 4;
        img.data[i] = ((-dx / l) * 0.5 + 0.5) * 255;
        img.data[i + 1] = ((dy / l) * 0.5 + 0.5) * 255;
        img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
}

// Upholstery: a plain weave of slightly uneven, heathered threads. Returns { map, normal } (one tile, tiling).
export function weave(seed = 5) {
  const w = 256, h = 256, T = 4; // 64 threads each way
  const r = rng(seed);
  const tone = (n) => Array.from({ length: n }, () => 0.95 + r() * 0.05); // (a gentle heather: more and it reads as tartan)
  const warp = tone(w / T), weft = tone(h / T);
  const height = new Float32Array(w * h);
  const col = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = Math.floor(x / T), j = Math.floor(y / T);
      const over = (i + j) % 2 === 0; // which thread is on top here
      const fx = ((x % T) + 0.5) / T, fy = ((y % T) + 0.5) / T;
      const round = over ? Math.sin(fx * Math.PI) : Math.sin(fy * Math.PI); // each thread is round in section
      height[y * w + x] = 0.35 + 0.65 * round + (r() - 0.5) * 0.12;
      col[y * w + x] = (over ? warp[i] : weft[j]) * (0.9 + 0.1 * round) + (r() - 0.5) * 0.05;
    }
  }
  const map = make(w, h, (g) => {
    const img = g.createImageData(w, h);
    for (let k = 0; k < w * h; k++) {
      const v = Math.max(0, Math.min(255, col[k] * 255));
      img.data.set([v, v, v * 0.985, 255], k * 4);
    }
    g.putImageData(img, 0, 0);
  });
  return { map, normal: normalFrom(height, w, h, 1.6) };
}

// A fine, even grain (moulded plastic, laminate): { normal, rough } (rough: a light roughness variation map).
export function grain(seed = 9) {
  const w = 256, h = 256;
  const r = rng(seed);
  // a few octaves of smoothed noise, tiling
  const base = new Float32Array(w * h).map(() => r());
  const blur = (src, k) => {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0, n = 0;
        for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) { s += src[((y + dy + h) % h) * w + ((x + dx + w) % w)]; n++; }
        out[y * w + x] = s / n;
      }
    }
    return out;
  };
  const a = blur(base, 1), b = blur(base, 3);
  const height = a.map((v, i) => v * 0.7 + b[i] * 0.3);
  const rough = make(w, h, (g) => {
    const img = g.createImageData(w, h);
    for (let k = 0; k < w * h; k++) {
      const v = (0.82 + (height[k] - 0.5) * 0.35) * 255;
      img.data.set([v, v, v, 255], k * 4);
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
  return { normal: normalFrom(height, w, h, 2.2), rough };
}

// A self-healing cutting mat: dark green with a fine grid, every fifth line stronger, a ruled border.
export function cuttingMat() {
  return make(512, 384, (g, w, h) => {
    g.fillStyle = '#2c6448';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i <= w; i += 16) {
      g.fillStyle = i % 80 === 0 ? 'rgba(235,240,230,0.55)' : 'rgba(235,240,230,0.22)';
      g.fillRect(i, 0, i % 80 === 0 ? 2 : 1, h);
    }
    for (let j = 0; j <= h; j += 16) {
      g.fillStyle = j % 80 === 0 ? 'rgba(235,240,230,0.55)' : 'rgba(235,240,230,0.22)';
      g.fillRect(0, j, w, j % 80 === 0 ? 2 : 1);
    }
    g.strokeStyle = 'rgba(240,215,90,0.7)';
    g.lineWidth = 3;
    g.strokeRect(12, 12, w - 24, h - 24);
    g.strokeStyle = 'rgba(235,240,230,0.35)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(40, h - 40);
    g.lineTo(w - 40, 40);
    g.stroke();
  });
}

// Vertical timber cladding: weathered planks with dark gaps. One tile = 1 m wide.
export function slats() {
  return make(256, 256, (g, w, h) => {
    const r = rng(77);
    for (let i = 0; i < 8; i++) {
      const t = 0.85 + r() * 0.2;
      g.fillStyle = `rgb(${Math.round(150 * t)},${Math.round(112 * t)},${Math.round(74 * t)})`;
      g.fillRect(i * 32, 0, 32, h);
      g.fillStyle = 'rgba(40,28,18,0.85)';
      g.fillRect(i * 32 + 29, 0, 3, h);
      for (let k = 0; k < 40; k++) {
        g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
        g.fillRect(i * 32 + r() * 28, r() * h, 1, 10 + r() * 40);
      }
    }
  });
}

// A prefab classroom's wall: white panels in grey frames. One tile = 1.2 m wide, 2.9 m tall.
export function cabin() {
  return make(128, 256, (g, w, h) => {
    g.fillStyle = '#4a4f55';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9ecea';
    g.fillRect(9, 30, w - 18, h - 50);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(9, 30, w - 18, 8);
  });
}
