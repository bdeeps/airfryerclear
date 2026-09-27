// Chapter 2: forced convection. q = h·A·ΔT, and a fan makes h several times bigger.
// Two 2 cm potato cubes heat side by side: one in the air fryer's fast air, one in a slower oven.
// h comes from textbook sphere correlations plus radiation (see cook.js: hCoeff); the heating
// inside each cube is a 1D finite-difference model of an equal-surface-per-volume sphere (makeLump).
import { THREE, M, box, arrow, swarm, canvasTexture, clamp } from '../kit.js';
import { hCoeff, makeLump } from '../cook.js';
import { tempHex, tempColor } from '../fryer.js';

const L_CUBE = 0.02;               // 2 cm potato cube
const S = 1.2;                     // drawn size of a cube (scene units)
const SIM_PER_S = 20;              // one real second is 20 s of cooking
const WINDOW = 20 * 60;            // chart: 20 minutes
const DONE = 90;                   // a potato is soft right through at about 90 °C
const A_POS = [-1.7, 1.0, 0], B_POS = [1.5, 1.0, 0];

const OVENS = { still: { v: 0, name: 'Oven, no fan' }, fan: { v: 1, name: 'Fan oven' } };

function makeRun(s) {
  const a = makeLump({ L: L_CUBE }), b = makeLump({ L: L_CUBE });
  return { a, b, histA: [20], histB: [20], doneA: null, doneB: null };
}

export default {
  id: 'convection',
  short: 'Forced convection',
  title: 'Why moving air cooks faster',
  subtitle: 'Heat flow q = h × A × ΔT, and a fan makes h several times bigger.',
  view: { pos: [0.6, 3.0, 8.8], target: [0.1, 2.2, 0] },
  learn: `<p>Put your hand near a 200 °C oven and you feel warmth. Put it in front of a hair dryer at only 60 °C and it soon feels hotter. The difference is <b>moving air</b>.</p>
    <p>Still air next to food forms a thin, lazy <b>boundary layer</b> that heats up and then insulates. A fan scrubs that layer away and keeps fresh hot air touching the surface. Engineers sum this up in one line: heat flow <b>q = h × A × ΔT</b>. Here <b>A</b> is the surface area, <b>ΔT</b> is how much hotter the air is than the food, and <b>h</b>, the <b>heat-transfer coefficient</b>, says how well the air hands over its heat.</p>
    <p>In still air h is only about <b>5 to 25 W/m²K</b>. A strong fan pushes it to <b>25 to 250</b>. An air fryer blows air at a few metres per second across food packed close to the element, so the same 180 °C cooks much faster than in a big, gentle oven.</p>
    <p class="tip"><b>Try it:</b> set the fan to 0 and then to 6 m/s, and watch the heat arrows and the core temperature race.</p>`,
  terms: [
    { t: 'Heat-transfer coefficient (h)', d: 'How many watts flow into each square metre of surface for every degree the air is hotter. Bigger h, faster cooking.' },
    { t: 'Forced convection', d: 'Heat carried by a fluid that a fan or pump pushes along. Natural convection relies on hot air rising by itself.' },
    { t: 'Boundary layer', d: 'The thin skin of slow air right next to a surface. It slows heat flow; fast air thins it.' },
    { t: 'Core temperature', d: 'The temperature at the very centre of the food, the last part to heat up.' },
  ],
  defaults: { v: 5, air: 180, oven: 'still' },
  controls: [
    { key: 'v', type: 'range', label: 'Air fryer fan: air speed', min: 0, max: 8, step: 0.1, ends: ['still', 'strong'], fmt: (v) => v.toFixed(1) + ' m/s' },
    { key: 'air', type: 'range', label: 'Air temperature (both)', min: 80, max: 200, step: 5, ends: ['80 °C', '200 °C'], fmt: (v) => Math.round(v) + ' °C' },
    { key: 'oven', type: 'seg', label: 'Compare with', options: [{ v: 'still', label: 'Oven, no fan' }, { v: 'fan', label: 'Fan oven' }], fmt: (v) => `air at ${OVENS[v].v} m/s` },
    { key: 'go', type: 'buttons', label: 'Cooking', items: [{ label: 'Fresh cubes', act: (s, inst) => inst.restart() }, { label: 'Skip 5 minutes', act: (s, inst) => inst.skip(300) }] },
  ],
  quiz: [
    { q: 'In q = h × A × ΔT, what does a fan change most?', options: ['A, the surface area', 'h, how well the air passes on heat', 'ΔT, the temperature difference', 'Nothing, a fan only makes noise'], answer: 1, why: 'Fast air thins the boundary layer, so h, the heat-transfer coefficient, goes up several times.' },
    { q: 'Roughly what is h for food in still air?', options: ['0.1 W/m²K', '5 to 25 W/m²K', '1,000 W/m²K', '100,000 W/m²K'], answer: 1, why: 'Natural convection in air is weak: about 5 to 25 W/m²K. A fan lifts it to tens or hundreds.' },
    { q: 'Why does the heat flow into a cube slow down as it cooks?', options: ['The fan gets tired', 'The surface warms up, so ΔT between air and food shrinks', 'The cube gets smaller', 'The air runs out of heat'], answer: 1, why: 'Heat flow is proportional to ΔT. As the surface nears the air temperature, less heat flows in.' },
  ],
  reel: [
    { ms: 5800, caption: 'Moving air hands over heat far faster than still air: a fan can triple h in q = h × A × ΔT.', set: { air: 180, oven: 'still' }, anim: { v: [0, 6] }, act: (s, inst) => inst.restart(180), view: { pos: [0.3, 3.0, 8.2], target: [0, 2.2, 0] }, spin: 0.12 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    let run = makeRun();

    // Two cubes. The front face of each is "cut open" to show the temperature inside.
    const cube = (pos, name) => {
      const g = new THREE.Group(); g.position.set(...pos); root.add(g);
      const mat = M.matte(0xece0b0, { roughness: 0.75 });
      const body = box(S, S, S, mat); g.add(body);
      const cut = canvasTexture(128, 128, (c, w, h, T) => {
        if (!T) { c.fillStyle = '#7aa2ff'; c.fillRect(0, 0, w, h); return; }
        const N = T.length;
        for (let i = N - 1; i >= 0; i--) { const r = ((i + 1) / N) * (w / 2); c.fillStyle = tempHex(T[i]); c.fillRect(w / 2 - r, h / 2 - r, 2 * r, 2 * r); }
      });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(S * 0.999, S * 0.999), new THREE.MeshBasicMaterial({ map: cut.tex, toneMapped: false }));
      face.position.z = S / 2 + 0.003; g.add(face);
      // Heat-flow arrows pointing into the top, front, left and right faces.
      const arrows = [[0, 1, 0], [0, 0, 1], [-1, 0, 0], [1, 0, 0]].map((n) => {
        const a = arrow(0xff7a3d, 0.5, 0.18, 0.03); const N = new THREE.Vector3(...n);
        a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), N.clone().negate()); g.add(a); a.userData.n = N; return a;
      });
      const lbl = stage.label(name, [0, -S / 2 - 0.4, 0.7], g);
      return { g, mat, cut, arrows, lbl };
    };
    const A = cube(A_POS, 'Air fryer'), B = cube(B_POS, 'Oven');

    // Air: streams that flow past the air-fryer cube (sideways) and drift up past the oven cube.
    const N = 150;
    const air = swarm(N * 2, new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    air.castShadow = false; root.add(air);
    const lanes = Array.from({ length: N * 2 }, (_, i) => ({ u: (i * 0.618) % 1, a: ((i * 0.7548) % 1) - 0.5, b: ((i * 0.5698) % 1) - 0.5 }));
    const col = new THREE.Color(), hot = new THREE.Color(), p = new THREE.Vector3();

    // Chart: core temperatures over 20 minutes.
    const cur = { oven: 'still' };
    const chart = canvasTexture(900, 340, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.88)'; g.fillRect(0, 0, w, h);
      const X = (t) => 64 + (t / WINDOW) * (w - 90), Y = (T) => h - 42 - ((clamp(T, 0, 220) - 0) / 220) * (h - 92);
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '22px sans-serif'; g.lineWidth = 1;
      for (let T = 0; T <= 200; T += 50) { g.beginPath(); g.moveTo(64, Y(T)); g.lineTo(w - 24, Y(T)); g.stroke(); g.fillText(T + '°', 18, Y(T) + 6); }
      for (let m = 0; m <= 20; m += 5) g.fillText(m + ' min', X(m * 60) - 24, h - 12);
      g.setLineDash([8, 8]); g.strokeStyle = 'rgba(92,225,169,.7)'; g.beginPath(); g.moveTo(64, Y(DONE)); g.lineTo(w - 24, Y(DONE)); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(92,225,169,.9)'; g.fillText('soft right through (90 °C)', w - 300, Y(DONE) - 10);
      g.fillStyle = '#e8eef8'; g.font = 'bold 26px sans-serif'; g.fillText('Centre of each cube', 20, 34);
      const line = (hist, color) => { g.strokeStyle = color; g.lineWidth = 4; g.beginPath(); hist.forEach((T, i) => (i ? g.lineTo(X(i * 10), Y(T)) : g.moveTo(X(0), Y(T)))); g.stroke(); };
      line(run.histB, '#8ea0c0'); line(run.histA, '#ffb547');
      g.font = 'bold 22px sans-serif'; g.fillStyle = '#ffb547'; g.fillText('air fryer', w - 360, 34); g.fillStyle = '#8ea0c0'; g.fillText(OVENS[cur.oven].name.toLowerCase(), w - 240, 34);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.04), new THREE.MeshBasicMaterial({ map: chart.tex, transparent: true, toneMapped: false }));
    board.position.set(1.75, 3.7, -0.7); root.add(board);

    let acc = 0, sv = { v: 5, air: 180, oven: 'still' };
    const hA = (Ts) => hCoeff({ v: sv.v, Tair: sv.air, Ts, D: L_CUBE }).h;
    const hB = (Ts) => hCoeff({ v: OVENS[sv.oven].v, Tair: sv.air, Ts, D: L_CUBE }).h;
    const simStep = () => {
      run.a.step(1, sv.air, hA); run.b.step(1, sv.air, hB);
      const t = Math.round(run.a.t);
      if (run.doneA == null && run.a.core() >= DONE) run.doneA = t;
      if (run.doneB == null && run.b.core() >= DONE) run.doneB = t;
      if (t % 10 === 0 && t <= WINDOW) { run.histA.push(run.a.core()); run.histB.push(run.b.core()); }
    };
    const api = {
      restart(sec = 0) { run = makeRun(); acc = 0; for (let i = 0; i < sec; i++) simStep(); chart.redraw(); },
      skip(sec) { for (let i = 0; i < sec && run.a.t < WINDOW; i++) simStep(); chart.redraw(); },
    };
    const face = (c, lump, Tair, h) => {
      const Ts = lump.surface();
      c.mat.color.copy(tempColor(Ts, col)).lerp(new THREE.Color(0xece0b0), 0.35);
      c.cut.redraw(lump.T);
      const qa = h * (Tair - Ts);                             // W/m² through the surface
      c.arrows.forEach((a) => { const L = clamp(qa / 11000, 0.06, 1.15); a.set(L); a.position.copy(a.userData.n).multiplyScalar(S / 2 + 0.06 + L); });
      return qa;
    };

    return {
      ...api,
      update(dt, s) {
        dt = Math.max(0, dt);
        sv = s; cur.oven = s.oven;
        if (run.a.t < WINDOW) {
          acc += dt * SIM_PER_S; let n = 0;
          while (acc >= 1 && n < 200) { simStep(); acc -= 1; n++; }
          if (n) chart.redraw();
        }
        const ha = hA(run.a.surface()), hb = hB(run.b.surface());
        const qa = face(A, run.a, s.air, ha), qb = face(B, run.b, s.air, hb);
        A.lbl.element.innerHTML = `Air fryer, ${s.v.toFixed(1)} m/s · <b>${(qa * 6 * L_CUBE * L_CUBE).toFixed(1)} W in</b>`;
        B.lbl.element.innerHTML = `${OVENS[s.oven].name}, ${OVENS[s.oven].v} m/s · <b>${(qb * 6 * L_CUBE * L_CUBE).toFixed(1)} W in</b>`;
        // Air particles.
        hot.set(tempHex(s.air));
        const vis = [Math.max(0.12, s.v * 0.4), Math.max(0.12, OVENS[s.oven].v * 0.4)];
        for (let i = 0; i < N * 2; i++) {
          const ln = lanes[i], side = i < N ? 0 : 1, c = side ? B_POS : A_POS, sp = vis[side];
          ln.u = (ln.u + (dt * sp) / 3.4) % 1;
          const along = -1.7 + ln.u * 3.4, lat = ln.a * 1.9, dep = ln.b * 1.9;
          const r = Math.hypot(lat, dep), push = Math.max(0, 0.9 - r) * Math.exp(-((along / 0.75) ** 2));
          const k = r > 1e-3 ? (r + push) / r : 1;
          if (side === 0) p.set(c[0] + along, c[1] + lat * k, c[2] + dep * k);        // sideways stream
          else p.set(c[0] + lat * k, c[1] + along, c[2] + dep * k);                    // rising, lazy plume
          air.place(i, [p.x, p.y, p.z]);
          air.setColorAt(i, col.copy(hot).lerp(new THREE.Color(0xffe0b0), ln.u > 0.55 ? 0.4 : 0));
        }
        air.done(); if (air.instanceColor) air.instanceColor.needsUpdate = true;
      },
      readout: (s) => {
        const ha = hCoeff({ v: s.v, Tair: s.air, Ts: run.a.surface(), D: L_CUBE }), hb = hCoeff({ v: OVENS[s.oven].v, Tair: s.air, Ts: run.b.surface(), D: L_CUBE });
        const t = (x) => (x == null ? '…' : `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`);
        return `<div class="big">h: ${Math.round(ha.h)} vs ${Math.round(hb.h)} W/m²K</div>
          <div class="row"><span>Convection, fan / ${s.oven === 'fan' ? 'oven' : 'no fan'}</span><b>${Math.round(ha.conv)} / ${Math.round(hb.conv)}</b></div>
          <div class="row"><span>Radiation from walls</span><b>${Math.round(ha.rad)} / ${Math.round(hb.rad)}</b></div>
          <div class="row"><span>Centre at ${Math.floor(run.a.t / 60)} min</span><b>${Math.round(run.a.core())} / ${Math.round(run.b.core())} °C</b></div>
          <div class="row"><span>Soft right through</span><b>${t(run.doneA)} / ${t(run.doneB)}</b></div>
          <small>2 cm potato cubes: air fryer / ${OVENS[s.oven].name.toLowerCase()}.</small>`;
      },
    };
  },
};
