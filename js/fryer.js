// AirFryerClear's 3D parts: a basket air fryer that comes apart, the hot air that
// loops round inside it, and a basket of chips.
//
// Scale: 1 scene unit = 10 cm. The fryer is a typical 4 litre basket model: about 30 cm
// across and 33 cm tall, with a 20 cm basket. Its origin is the middle of its base,
// the drawer handle points to +Z, and the exhaust vent is at the back (−Z).
import { THREE, M, box, tube, swarm, canvasTexture, clamp } from './kit.js';
import { brownHex } from './cook.js';

const TAU = Math.PI * 2;

// Lathe round the vertical (Y) axis from [r, y] pairs. phi = 0 faces +Z.
export function vLathe(profile, mat, { seg = 72, phiStart = 0, phiLength = TAU } = {}) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), seg, phiStart, phiLength);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
  return m;
}
export function vCyl(r, y0, y1, mat, seg = 40) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, seg), mat);
  m.position.y = (y0 + y1) / 2; m.castShadow = true; m.receiveShadow = true;
  return m;
}

// Key heights and radii (scene units).
export const FR = {
  R: 1.55, H: 3.35,            // body
  panR: 1.28, panY0: 0.2, panY1: 1.7,
  basR: 1.05, basY0: 0.52, basY1: 1.62,
  heatY: 1.92, fanY: 2.2, guideY: 2.47, motorY: [2.56, 2.96], coolY: 3.1,
};

// A perforated disc texture: dark metal with round holes (alpha 0), for the basket's mesh floor.
function meshTexture() {
  const { tex } = canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#50545e'; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, TAU); g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let y = 10; y < h; y += 17) for (let x = 10 + ((y / 17) % 2) * 8.5; x < w; x += 17) {
      if (Math.hypot(x - w / 2, y - h / 2) < w / 2 - 12) { g.beginPath(); g.arc(x, y, 5.6, 0, TAU); g.fill(); }
    }
    g.globalCompositeOperation = 'source-over';
  });
  return tex;
}

// The star-shaped baffle in the bottom of the pan (Philips calls theirs a "starfish"): raised
// ridges that turn the air coming down the sides into a swirl that rises through the basket.
function starBaffle(mat) {
  const s = new THREE.Shape(), n = 6, R0 = 0.35, R1 = 1.0;
  for (let i = 0; i <= n * 16; i++) {
    const a = (i / (n * 16)) * TAU, k = 0.5 + 0.5 * Math.cos(a * n);
    const r = R0 + (R1 - R0) * Math.pow(k, 1.6);
    const b = a + 0.25 * Math.sin(a * n);                     // a slight twist, so the arms curve
    i ? s.lineTo(r * Math.cos(b), r * Math.sin(b)) : s.moveTo(r * Math.cos(b), r * Math.sin(b));
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 24), mat); cone.position.y = 0.2;
  const grp = new THREE.Group(); grp.add(m, cone);
  return grp;
}

// A flat spiral heating element (a sheathed coil) with its two leads going up.
function heaterCoil() {
  const pts = [], turns = 3.3, r0 = 0.22, r1 = 1.0, y = FR.heatY;
  for (let i = 0; i <= 260; i++) { const t = i / 260, a = t * turns * TAU, r = r0 + (r1 - r0) * t; pts.push([r * Math.cos(a), y, r * Math.sin(a)]); }
  const mat = M.metal(0x8f8a86, { roughness: 0.45, emissive: 0xff4a12, emissiveIntensity: 0 });
  const g = new THREE.Group();
  g.add(tube(pts, 0.035, mat, false, 520));
  const end = pts[pts.length - 1];
  g.add(tube([end, [end[0] * 1.08, y + 0.1, end[2] * 1.08], [end[0] * 1.1, FR.guideY + 0.05, end[2] * 1.1]], 0.03, mat, false, 24));
  g.add(tube([pts[0], [pts[0][0], y + 0.15, pts[0][2]], [0.3, FR.guideY + 0.05, 0.22]], 0.03, mat, false, 24));
  // Mounting bars under the coil.
  const bar = M.metal(0x6c7079);
  for (const a of [0.4, 0.4 + TAU / 3, 0.4 + (2 * TAU) / 3]) { const b = box(0.9, 0.03, 0.05, bar); b.position.set(0.6 * Math.cos(a), y - 0.05, 0.6 * Math.sin(a)); b.rotation.y = -a; g.add(b); }
  g.mat = mat;
  g.setHeat = (k) => { mat.emissiveIntensity = 2.2 * k; mat.color.setRGB(0.56 + 0.44 * k, 0.54 - 0.1 * k, 0.52 - 0.3 * k); };
  return g;
}

// The convection fan: a centrifugal impeller that sucks air up into its middle and throws it outwards.
function impeller(R = 0.9, n = 10) {
  const g = new THREE.Group(), mat = M.metal(0xb8bec8, { roughness: 0.35 });
  const plate = vCyl(R, 0.07, 0.1, mat, 48); g.add(plate);
  for (let i = 0; i < n; i++) {
    const b = box(R * 0.58, 0.16, 0.022, mat);
    const a = (i / n) * TAU, r = R * 0.64;
    b.position.set(r * Math.cos(a), 0, r * Math.sin(a)); b.rotation.y = -a + 0.35;   // swept back
    g.add(b);
  }
  g.add(vCyl(0.12, -0.05, 0.1, M.metal(0x8a909a)));
  return g;
}

// A small axial fan (the cooling fan on top of the motor).
function smallFan(R = 0.42, n = 5) {
  const g = new THREE.Group(), mat = M.plastic(0x3a3f4a, { side: THREE.DoubleSide });
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(new THREE.CircleGeometry(R, 12, 0, TAU / (n * 1.5)), mat);
    b.rotation.x = -Math.PI / 2; b.rotation.y = 0.35;
    const h = new THREE.Group(); h.rotation.y = (i / n) * TAU; h.add(b); g.add(h);
  }
  g.add(vCyl(0.09, -0.04, 0.05, M.plastic(0x23262f)));
  return g;
}

// The whole fryer. Returns the parts so chapters can explode, X-ray and animate them.
export function makeAirFryer({ body = 0xf0ede6, trim = 0x2b2f38 } = {}) {
  const group = new THREE.Group();
  const shellMat = M.plastic(body, { transparent: true, opacity: 1, roughness: 0.32, side: THREE.DoubleSide });
  const trimMat = M.plastic(trim, { transparent: true, opacity: 1, roughness: 0.4, side: THREE.DoubleSide });

  // Body: the upper housing is a full round; the lower one leaves a gap at the front for the drawer.
  const top = new THREE.Group();
  const upper = vLathe([[0, FR.H], [1.12, FR.H], [1.4, FR.H - 0.12], [1.53, FR.H - 0.45], [FR.R, 2.6], [FR.R, 1.72]], shellMat);
  top.add(upper);
  // Display and buttons on top, facing up and a little forward.
  const disp = canvasTexture(320, 160, (g, w, h, txt = ['200°', '15:00']) => {
    g.fillStyle = '#0b0d12'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffb547'; g.font = 'bold 64px sans-serif'; g.fillText(txt[0], 18, 78);
    g.fillStyle = '#8ef0ff'; g.font = 'bold 44px sans-serif'; g.fillText(txt[1], 188, 74);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '22px sans-serif'; g.fillText('TEMP', 22, 130); g.fillText('TIME', 200, 130);
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: disp.tex, toneMapped: false, transparent: true }));
  screen.rotation.x = -Math.PI / 2; screen.position.set(0, FR.H + 0.012, 0.55); top.add(screen);
  // Exhaust vent at the back and air intake slots on top.
  const ventMat = M.plastic(0x1b1e25);
  for (let i = 0; i < 5; i++) { const v = box(0.9, 0.05, 0.12, ventMat); v.position.set(0, 2.35 + i * 0.12, -FR.R + 0.02); top.add(v); }
  for (let i = 0; i < 4; i++) { const v = box(0.08, 0.02, 0.55, ventMat); v.position.set(-0.3 + i * 0.2, FR.H + 0.005, -0.55); top.add(v); }
  group.add(top);

  const lower = vLathe([[FR.R, 1.72], [FR.R, 0.2], [1.5, 0.1], [1.3, 0.08]], shellMat, { phiStart: 0.9, phiLength: TAU - 1.8 });
  const floor = vCyl(1.45, 0.06, 0.1, M.plastic(0x2a2d35)); group.add(lower, floor);
  for (const a of [0.8, 2.35, 3.9, 5.5]) { const f = vCyl(0.12, 0, 0.08, M.plastic(0x1b1e25), 16); f.position.x = 1.1 * Math.sin(a); f.position.z = 1.1 * Math.cos(a); group.add(f); }

  // The drawer: front panel, handle, the pan, the star baffle and the basket.
  const drawer = new THREE.Group();
  const front = vLathe([[FR.R + 0.02, 1.71], [FR.R + 0.02, 0.12]], trimMat, { phiStart: -0.9, phiLength: 1.8, seg: 24 });
  const handle = new THREE.Group();
  handle.add(box(0.42, 0.14, 0.7, trimMat)); handle.children[0].position.set(0, 1.35, FR.R + 0.35);
  handle.add(box(0.42, 0.9, 0.14, trimMat)); handle.children[1].position.set(0, 0.95, FR.R + 0.66);
  handle.add(box(0.42, 0.14, 0.4, trimMat)); handle.children[2].position.set(0, 0.55, FR.R + 0.5);
  const panMat = M.metal(0x3b3f48, { roughness: 0.55, metalness: 0.4, side: THREE.DoubleSide, transparent: true, opacity: 1 });
  const pan = vLathe([[0, FR.panY0], [FR.panR - 0.08, FR.panY0], [FR.panR, FR.panY0 + 0.08], [FR.panR, FR.panY1], [FR.panR + 0.05, FR.panY1]], panMat);
  const star = starBaffle(M.metal(0x4a4e57, { roughness: 0.5, metalness: 0.4 }));
  star.position.y = FR.panY0 + 0.01;
  drawer.add(front, handle, pan, star);

  const basket = new THREE.Group();
  const basMat = M.metal(0x4a4e57, { roughness: 0.45, metalness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 1 });
  const wall = vLathe([[FR.basR - 0.03, FR.basY0], [FR.basR, FR.basY0 + 0.05], [FR.basR, FR.basY1], [FR.basR + 0.06, FR.basY1]], basMat);
  const floorMesh = new THREE.Mesh(new THREE.CircleGeometry(FR.basR - 0.02, 48), new THREE.MeshStandardMaterial({ map: meshTexture(), alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.5 }));
  floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.y = FR.basY0 + 0.01; floorMesh.receiveShadow = true;
  // The basket's handle arm runs out through the drawer front.
  const arm = box(0.3, 0.1, 0.55, basMat); arm.position.set(0, 1.35, FR.basR + 0.25);
  basket.add(wall, floorMesh, arm);
  drawer.add(basket);
  group.add(drawer);

  // The hot parts in the lid: element, fan, air guide, sensor, motor, cooling fan, control board.
  const heater = heaterCoil();
  const fan = impeller(); fan.position.y = FR.fanY;
  const guideMat = M.metal(0xc4c9d2, { roughness: 0.3, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const guide = vLathe([[0.26, FR.guideY], [1.16, FR.guideY], [1.23, FR.guideY - 0.06], [1.23, 1.8]], guideMat);
  const sensor = new THREE.Group();
  sensor.add(vCyl(0.03, 1.98, FR.guideY, M.metal(0xd8dde5)));
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10), M.plastic(0x1b1e25)); bead.position.y = 1.97; sensor.add(bead);
  sensor.position.set(0.72, 0, -0.62);
  const motor = new THREE.Group();
  motor.add(vCyl(0.38, FR.motorY[0], FR.motorY[1], M.metal(0x6d737e, { roughness: 0.4 })));
  motor.add(vCyl(0.3, FR.motorY[1], FR.motorY[1] + 0.05, M.metal(0xd07a45, { roughness: 0.3 })));
  motor.add(vCyl(0.04, FR.fanY - 0.05, FR.coolY + 0.05, M.metal(0xd8dde5)));
  const coolFan = smallFan(); coolFan.position.y = FR.coolY;
  const board = new THREE.Group();
  const pcb = box(1.0, 0.04, 0.5, M.plastic(0x1f6b45, { roughness: 0.6 })); board.add(pcb);
  const chips = [[-0.3, 0.1, 0x1b1e25, 0.22], [0.05, -0.08, 0x1b1e25, 0.14], [0.32, 0.1, 0x2d5fb0, 0.16]];   // chip, chip, relay (blue box)
  chips.forEach(([x, z, c, s]) => { const k = box(s, 0.08, s * 0.8, M.plastic(c)); k.position.set(x, 0.06, z); board.add(k); });
  board.position.set(0, 3.15, 0.62); board.rotation.x = 0.12;
  group.add(heater, fan, guide, sensor, motor, coolFan, board);

  const see = [shellMat, trimMat];
  return {
    group, top, upper, lower, floor, drawer, front, handle, pan, panMat, star, basket, basMat, heater, fan, guide, sensor, motor, coolFan, board, screen, disp,
    // on: see-through casing; inner: also make the pan and basket see-through, to watch the air inside.
    setXray(on, inner = on) {
      see.forEach((m) => { m.opacity = on ? 0.12 : 1; m.depthWrite = !on; }); upper.castShadow = lower.castShadow = !on;
      panMat.opacity = inner ? 0.3 : 1; panMat.depthWrite = !inner; basMat.opacity = inner ? 0.42 : 1; basMat.depthWrite = !inner;
    },
    setScreen(a, b) { disp.redraw([a, b]); },
  };
}

// ---------------------------------------------------------------- hot air
// Particles that loop round inside the fryer: up through the basket, through the element into the
// middle of the fan, flung outwards, down the gap between basket and pan, and turned inwards and
// upwards by the star baffle. Each one keeps its own radius on the way up and swirls slowly.
const AIR_STOPS = [[0, 0xffc98a], [0.3, 0xffb066], [0.42, 0xff5a2a], [0.62, 0xff6a30], [0.9, 0xff9446], [1, 0xffc98a]];
const cA = new THREE.Color(), cB = new THREE.Color();
function airColor(u, out) {
  for (let i = 1; i < AIR_STOPS.length; i++) if (u <= AIR_STOPS[i][0]) {
    const [u0, a] = AIR_STOPS[i - 1], [u1, b] = AIR_STOPS[i];
    return out.copy(cA.set(a)).lerp(cB.set(b), (u - u0) / (u1 - u0));
  }
  return out.set(AIR_STOPS[0][1]);
}
export function makeHotAir(count = 240, size = 0.045) {
  const mesh = swarm(count, new THREE.SphereGeometry(size, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  mesh.castShadow = false;
  const P = [];
  for (let i = 0; i < count; i++) {
    const f = (i * 0.6180339) % 1, rUp = 0.1 + 0.82 * Math.sqrt(f), rDn = 1.1 + 0.12 * ((i * 0.3719) % 1);
    const pts = [[rUp, 0.42], [rUp, FR.basY1], [0.16 + rUp * 0.5, FR.heatY], [0.14, FR.fanY - 0.02], [0.95, FR.fanY + 0.03], [rDn, 2.0], [rDn, 0.6], [rDn - 0.2, 0.36], [rUp, 0.42]];
    const L = [0]; for (let k = 1; k < pts.length; k++) L.push(L[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    P.push({ pts, L, u: ((i * 0.7548776) % 1), th: (i * 2.39996) % TAU, seg: 0 });
    mesh.setColorAt(i, new THREE.Color(0xffffff));
  }
  const col = new THREE.Color();
  let t = 0;
  // speed: overall circulation (1 = normal); through: fraction of flow getting through the basket (not used for
  // position, only colour cooling); visible fraction of particles shown.
  mesh.step = (dt, speed = 1, show = 1) => {
    dt = Math.max(0, dt); t += dt;
    const n = Math.round(count * clamp(show, 0, 1));
    for (let i = 0; i < count; i++) {
      const p = P[i];
      if (i >= n) { mesh.place(i, [0, -50, 0], null, 0.001); continue; }
      const total = p.L[p.L.length - 1];
      p.u = (p.u + (dt * speed * 1.1) / total) % 1;
      const d = p.u * total;
      let k = 1; while (k < p.L.length - 1 && p.L[k] < d) k++;
      const a = p.pts[k - 1], b = p.pts[k], s = (d - p.L[k - 1]) / Math.max(1e-6, p.L[k] - p.L[k - 1]);
      const r = a[0] + (b[0] - a[0]) * s, y = a[1] + (b[1] - a[1]) * s;
      p.th += dt * speed * (k >= 4 && k <= 6 ? 0.9 : 0.35);            // the fan and baffle make it swirl
      mesh.place(i, [r * Math.sin(p.th), y, r * Math.cos(p.th)]);
      mesh.setColorAt(i, airColor(p.u, col));
    }
    mesh.done(); if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  return mesh;
}

// Steam and warm air leaving through the back vent, and cool room air drawn over the motor.
export function makeVentAir(count = 40) {
  const mesh = swarm(count, new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.8 }));
  mesh.castShadow = false;
  const u = Float32Array.from({ length: count }, (_, i) => (i * 0.618) % 1);
  const cool = new THREE.Color(0x8ed8ff), warm = new THREE.Color(0xe8eef8);
  for (let i = 0; i < count; i++) mesh.setColorAt(i, i % 2 ? cool : warm);
  mesh.step = (dt, speed = 1, on = true) => {
    for (let i = 0; i < count; i++) {
      if (!on) { mesh.place(i, [0, -50, 0], null, 0.001); continue; }
      u[i] = (u[i] + Math.max(0, dt) * speed * 0.35) % 1;
      const k = u[i], j = ((i * 0.37) % 1) - 0.5;
      if (i % 2) {
        // Cooling air: in through the top slots, down over the motor, out of the back vent.
        const p = k < 0.4 ? [j * 0.6, FR.H + 0.5 - k * 1.2, -0.55] : k < 0.7 ? [j * 0.6, 2.95 - (k - 0.4) * 1.0, -0.55 - (k - 0.4) * 2.2] : [j * 0.6, 2.65, -1.2 - (k - 0.7) * 3.2];
        mesh.place(i, p);
      } else {
        // Moist air from the cooking space, leaking out of the vent.
        mesh.place(i, [j * 0.8, 2.45 + k * 0.35 + ((i * 0.13) % 0.2), -1.4 - k * 1.3], null, 0.8 + k);
      }
    }
    mesh.done(); if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  return mesh;
}

// ---------------------------------------------------------------- chips
// Chips (1 × 1 × 7.5 cm) piled in the basket in layers, criss-crossed like a real pile.
// setLayers(n) shows the first n layers; colour(i, B) browns chip i.
export function makeChips(maxLayers = 6) {
  const spots = [];
  for (let L = 0; L < maxLayers; L++) {
    const ang = L * 1.05 + 0.3;
    for (let z = -0.84; z <= 0.84; z += 0.15) {
      const half = Math.sqrt(Math.max(0, 0.93 * 0.93 - z * z));
      const n = Math.floor((2 * half + 0.05) / 0.8);
      for (let k = 0; k < n; k++) {
        const x = -((n - 1) * 0.8) / 2 + k * 0.8;
        const j = Math.sin(L * 12.9898 + z * 78.233 + k * 3.1) * 43758.5453, r = j - Math.floor(j);
        const px = x + (r - 0.5) * 0.08, pz = z + (r - 0.5) * 0.04;
        spots.push({ layer: L, pos: [px * Math.cos(ang) - pz * Math.sin(ang), FR.basY0 + 0.06 + L * 0.1 + r * 0.02, px * Math.sin(ang) + pz * Math.cos(ang)], rot: [0, -ang + (r - 0.5) * 0.25, (r - 0.5) * 0.12] });
      }
    }
  }
  const mesh = swarm(spots.length, new THREE.BoxGeometry(0.75, 0.1, 0.1), M.matte(0xffffff, { roughness: 0.7 }));
  spots.forEach((s, i) => { mesh.place(i, s.pos, s.rot); mesh.setColorAt(i, new THREE.Color(brownHex(0))); });
  mesh.done();
  const perLayer = spots.filter((s) => s.layer === 0).length;
  mesh.spots = spots; mesh.perLayer = perLayer;
  mesh.setLayers = (n) => { mesh.count = spots.filter((s) => s.layer < Math.ceil(n)).length; };
  const c = new THREE.Color();
  mesh.colour = (i, B) => { mesh.setColorAt(i, c.setHex(brownHex(B))); };
  mesh.flush = () => { if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; };
  return mesh;
}

// Temperature to colour for charts and labels (°C): cool blue → white → orange → red.
const TSTOPS = [[20, 0x7aa2ff], [60, 0xb7c6e8], [100, 0xffe39a], [140, 0xffb547], [180, 0xff7a3d], [220, 0xff3b30]];
export function tempHex(T) {
  if (T <= TSTOPS[0][0]) return '#' + cA.set(TSTOPS[0][1]).getHexString();
  for (let i = 1; i < TSTOPS.length; i++) if (T <= TSTOPS[i][0]) return '#' + cA.set(TSTOPS[i - 1][1]).lerp(cB.set(TSTOPS[i][1]), (T - TSTOPS[i - 1][0]) / (TSTOPS[i][0] - TSTOPS[i - 1][0])).getHexString();
  return '#ff3b30';
}
export const tempColor = (T, out = new THREE.Color()) => out.set(tempHex(T));
