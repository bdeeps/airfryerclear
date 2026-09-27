// Chapter 3: drying, then browning. A 1 × 1 cm chip is heated by the air fryer's air, and
// its square cross-section is simulated cell by cell (cook.js: makeFry): water boils off at
// 100 °C, a dry crust grows inwards, and only the dry surface can climb past 100 °C and brown.
import { THREE, M, box, swarm, canvasTexture, clamp } from '../kit.js';
import { makeFry, hCoeff, brownCss, brownHex, brownName } from '../cook.js';
import { tempHex } from '../fryer.js';

const SIM_PER_S = 30;              // one real second is 30 s of cooking
const WINDOW = 25 * 60;            // chart: 25 minutes
const AIR_V = 4;                   // m/s past the chip
const S = 1.3, LEN = 3.8;          // drawn chip size (scene units)
const FRONT = 0.7;                 // z of the cut face

export default {
  id: 'maillard',
  short: 'Drying and browning',
  title: 'Dry first, then brown',
  subtitle: 'The surface is stuck near 100 °C until its water boils away. Then it can brown.',
  view: { pos: [1.3, 3.1, 8.6], target: [1.2, 1.75, -0.5] },
  learn: `<p>A raw chip is about <b>four-fifths water</b>. While a surface is wet it cannot get much hotter than <b>100 °C</b>: every bit of extra heat goes into turning water into steam, and each kilogram of water swallows <b>2,257 kJ</b> (its <b>latent heat</b>) as it boils away. So at first the chip's surface sits near 100 °C, however hot the air is.</p>
    <p>Once the outer layer has dried into a <b>crust</b>, its temperature is free to climb towards the air temperature. Above about <b>140 °C</b> the <b>Maillard reaction</b> speeds up: sugars and amino acids in the food react and make hundreds of new flavour molecules and brown colours. <b>Caramelisation</b>, sugar breaking down on its own, joins in at higher temperatures.</p>
    <p>That's why dry, fast-moving air gives a crisp crust: it carries steam away and hands heat over quickly. Cook to <b>golden</b>, not dark brown. Very dark, starchy food contains more <b>acrylamide</b>, a chemical that food-safety agencies advise us to keep low.</p>
    <p class="tip"><b>Try it:</b> watch the surface line sit flat at 100 °C, then take off. Switch the cut face to water, then to browning.</p>`,
  terms: [
    { t: 'Latent heat', d: 'Energy that changes a liquid into a gas without warming it. Water needs 2,257 kJ per kilogram to boil away at 100 °C.' },
    { t: 'Maillard reaction', d: 'Reactions between sugars and amino acids that brown food and create flavour. Fast above about 140 °C, named after Louis-Camille Maillard (1912).' },
    { t: 'Caramelisation', d: 'Sugar breaking down in heat into brown, nutty-tasting compounds.' },
    { t: 'Crust', d: 'The dried outer layer of the food, which can get hot enough to brown and turn crisp.' },
    { t: 'Acrylamide', d: 'A chemical that forms when starchy food is cooked very hot and dark. Advice is to aim for golden.' },
  ],
  defaults: { air: 200, view: 'temp' },
  controls: [
    { key: 'air', type: 'range', label: 'Air temperature', min: 140, max: 200, step: 5, ends: ['140 °C', '200 °C'], fmt: (v) => Math.round(v) + ' °C' },
    { key: 'view', type: 'seg', label: 'Cut face shows', options: [{ v: 'temp', label: 'Temperature' }, { v: 'water', label: 'Water' }, { v: 'brown', label: 'Browning' }] },
    { key: 'go', type: 'buttons', label: 'Cooking', items: [{ label: 'Fresh chip', act: (s, inst) => inst.restart(0) }, { label: 'Skip 2 minutes', act: (s, inst) => inst.skip(120) }] },
  ],
  quiz: [
    { q: 'Why does a wet chip’s surface stay near 100 °C at first?', options: ['The air fryer is broken', 'Extra heat goes into boiling off water instead of warming the surface', 'Potatoes can’t get hotter than 100 °C', 'The fan cools it'], answer: 1, why: 'Boiling water soaks up 2,257 kJ per kilogram without getting hotter, so the surface is pinned near 100 °C until it dries.' },
    { q: 'What does the Maillard reaction do?', options: ['Makes food soggy', 'Browns food and creates flavour as sugars and amino acids react', 'Melts the fat', 'Kills all the vitamins'], answer: 1, why: 'Sugars and amino acids react in hot, dry conditions, making brown colours and many flavour molecules.' },
    { q: 'Food-safety advice for chips and toast is to cook them to…', options: ['Pale white', 'Golden', 'Dark brown', 'Black'], answer: 1, why: 'Very dark, starchy food contains more acrylamide, so the advice is to aim for golden yellow.' },
  ],
  reel: [
    { ms: 5800, caption: 'A wet chip’s surface is stuck near 100 °C until its water boils away.', set: { air: 200, view: 'water' }, act: (s, inst) => inst.restart(20, s), view: { pos: [1.3, 2.9, 7.4], target: [1.0, 1.7, -0.5] }, spin: 0.12 },
    { ms: 5600, caption: 'Once it is dry, it climbs past 140 °C and the Maillard reaction browns it.', set: { air: 200, view: 'brown' }, act: (s, inst) => inst.restart(600, s), view: { pos: [1.3, 2.9, 7.4], target: [1.0, 1.7, -0.5] }, spin: 0.12 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); root.position.x = -0.7; stage.root.add(root);
    let fry = makeFry({ a: 0.01, N: 16 }), mode = 'temp';
    const hist = { s: [20], c: [20], b: [0] };

    // The chip: a long bar whose front end is cut open.
    const skinMat = M.matte(brownHex(0), { roughness: 0.8 });
    const chip = box(S, S, LEN, skinMat); chip.position.set(0, S / 2 + 0.15, FRONT - LEN / 2); root.add(chip);
    const cut = canvasTexture(256, 256, (g, w, h) => {
      const N = fry.N, c = w / N;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x;
        g.fillStyle = mode === 'temp' ? tempHex(fry.T[i]) : mode === 'water' ? waterCss(fry.W[i] / fry.W0) : brownCss(fry.B[i]);
        g.fillRect(x * c, y * c, c + 1, c + 1);
      }
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshBasicMaterial({ map: cut.tex, toneMapped: false }));
    face.position.set(0, S / 2 + 0.15, FRONT + 0.004); root.add(face);
    const faceLbl = stage.label('', [-S / 2 - 0.2, S + 0.55, FRONT], root);
    const skinLbl = stage.label('', [0.4, S + 0.45, FRONT - LEN + 0.4], root, 'hot');
    // A little mesh to sit on.
    const grid = new THREE.GridHelper(3, 12, 0x6a707c, 0x4a4e57); grid.position.set(0, 0.14, FRONT - LEN / 2); grid.scale.set(1, 1, 1.7); root.add(grid);

    // Steam leaving the surface while it is drying.
    const SN = 90;
    const steam = swarm(SN, new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe8eef8, toneMapped: false, transparent: true, opacity: 0.75 }));
    steam.castShadow = false; root.add(steam);
    const su = Float32Array.from({ length: SN }, (_, i) => (i * 0.618) % 1);

    // Chart: surface and centre temperature, with the browning colour strip underneath.
    const chart = canvasTexture(900, 420, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.88)'; g.fillRect(0, 0, w, h);
      const x0 = 70, x1 = w - 24, y0 = h - 96, y1 = 56;
      const X = (t) => x0 + (t / WINDOW) * (x1 - x0), Y = (T) => y0 - ((clamp(T, 0, 220)) / 220) * (y0 - y1);
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '22px sans-serif'; g.lineWidth = 1;
      for (let T = 0; T <= 200; T += 50) { g.beginPath(); g.moveTo(x0, Y(T)); g.lineTo(x1, Y(T)); g.stroke(); g.fillText(T + '°', 14, Y(T) + 7); }
      for (let m = 0; m <= 25; m += 5) g.fillText(m + ' min', X(m * 60) - 26, h - 12);
      const band = (T, col, txt) => { g.setLineDash([8, 8]); g.strokeStyle = col; g.beginPath(); g.moveTo(x0, Y(T)); g.lineTo(x1, Y(T)); g.stroke(); g.setLineDash([]); g.fillStyle = col; g.font = '19px sans-serif'; g.fillText(txt, x1 - g.measureText(txt).width - 6, Y(T) - 8); };
      band(100, 'rgba(142,216,255,.8)', 'water boils: 100 °C');
      band(140, 'rgba(255,181,71,.85)', 'Maillard browning speeds up: ~140 °C');
      const line = (arr, color) => { g.strokeStyle = color; g.lineWidth = 4; g.beginPath(); arr.forEach((T, i) => (i ? g.lineTo(X(i * 10), Y(T)) : g.moveTo(X(0), Y(T)))); g.stroke(); };
      line(hist.c, '#7aa2ff'); line(hist.s, '#ff7a3d');
      // Browning strip: the surface colour over time.
      for (let i = 0; i < hist.b.length; i++) { g.fillStyle = brownCss(hist.b[i]); g.fillRect(X(i * 10), y0 + 14, Math.max(2, X(10) - X(0) + 1), 26); }
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.strokeRect(x0, y0 + 14, x1 - x0, 26);
      g.fillStyle = '#e8eef8'; g.font = 'bold 26px sans-serif'; g.fillText('Inside a chip', 20, 36);
      g.font = 'bold 22px sans-serif'; g.fillStyle = '#ff7a3d'; g.fillText('surface', w - 330, 36); g.fillStyle = '#7aa2ff'; g.fillText('centre', w - 225, 36); g.fillStyle = '#e0a040'; g.fillText('colour', w - 130, 36);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.1), new THREE.MeshBasicMaterial({ map: chart.tex, transparent: true, toneMapped: false }));
    board.position.set(3.7, 2.35, -1.1); board.rotation.y = -0.22; root.add(board);

    let acc = 0, air = 200, evap = 0, lastLost = 0;
    const simStep = () => {
      const h = hCoeff({ v: AIR_V, Tair: air, Ts: fry.surfaceT(), D: 0.01 }).h;
      fry.step(1, air, h);
      const t = Math.round(fry.t);
      if (t % 10 === 0 && t <= WINDOW) { hist.s.push(fry.surfaceT()); hist.c.push(fry.coreT()); hist.b.push(fry.surfaceB()); }
    };
    const api = {
      restart(sec = 0, s) {
        fry = makeFry({ a: 0.01, N: 16 }); hist.s = [20]; hist.c = [20]; hist.b = [0]; acc = 0; lastLost = 0;
        if (s) air = s.air;
        for (let i = 0; i < sec; i++) simStep();
        lastLost = fry.waterLost(); chart.redraw(); cut.redraw();
      },
      skip(sec) { for (let i = 0; i < sec && fry.t < WINDOW; i++) simStep(); chart.redraw(); cut.redraw(); },
    };
    return {
      ...api,
      update(dt, s) {
        dt = Math.max(0, dt);
        air = s.air; mode = s.view;
        let n = 0;
        if (fry.t < WINDOW) { acc += dt * SIM_PER_S; while (acc >= 1 && n < 200) { simStep(); acc -= 1; n++; } }
        if (n) {
          const lost = fry.waterLost();
          evap = (lost - lastLost) / Math.max(1, n); lastLost = lost;   // fraction of the water per simulated second
          chart.redraw(); cut.redraw();
        }
        if (cut.mode !== mode) { cut.mode = mode; cut.redraw(); }
        const B = fry.surfaceB();
        skinMat.color.setHex(brownHex(B));
        faceLbl.element.innerHTML = { temp: 'Cut face: <b>temperature</b>', water: 'Cut face: <b>water left</b>', brown: 'Cut face: <b>browning</b>' }[mode];
        const narrow = stage.host.clientWidth < 560;
        skinLbl.visible = faceLbl.visible = !narrow;
        skinLbl.element.innerHTML = `Surface ${Math.round(fry.surfaceT())} °C · <b>${brownName(B)}</b>`;
        // Steam: how many puffs show depends on how fast water is boiling off.
        const show = clamp(evap / 0.0012, 0, 1);
        for (let i = 0; i < SN; i++) {
          su[i] = (su[i] + dt * 0.5) % 1;
          if ((i + 0.5) / SN > show) { steam.place(i, [0, -50, 0], null, 0.001); continue; }
          const a = ((i * 0.7548) % 1), side = i % 3;
          const x = side === 0 ? -S / 2 + a * S : side === 1 ? -S / 2 - 0.05 : S / 2 + 0.05;
          const z = FRONT - 0.2 - ((i * 0.5698) % 1) * (LEN - 0.4);
          steam.place(i, [x + (side ? (side === 1 ? -1 : 1) * su[i] * 0.3 : 0), S + 0.2 + su[i] * 1.6 - (side ? S * 0.5 : 0), z], null, 0.6 + su[i]);
        }
        steam.done();
      },
      readout: (s) => {
        const B = fry.surfaceB();
        return `<div class="big">${Math.floor(fry.t / 60)} min: ${brownName(B)}</div>
          <div class="row"><span>Surface / centre</span><b>${Math.round(fry.surfaceT())} / ${Math.round(fry.coreT())} °C</b></div>
          <div class="row"><span>Water boiled off</span><b>${Math.round(fry.waterLost() * 100)}%</b></div>
          <div class="row"><span>Dry crust</span><b>${(fry.crust() * 1000).toFixed(1)} mm</b></div>
          <small>A 1 × 1 cm chip in ${Math.round(s.air)} °C air at ${AIR_V} m/s.</small>`;
      },
    };
  },
};

// Water left, from full (deep blue) to dry (sand).
function waterCss(k) {
  const a = [220, 190, 130], b = [40, 110, 230], t = clamp(k, 0, 1);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}
