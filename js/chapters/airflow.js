// Chapter 5: airflow through the basket, crowding and shaking.
// The fan meets more resistance as the pile of chips gets deeper (cook.js: basketFlow), and chips
// buried in the middle of a pile see less of the moving air (cook.js: exposure). Each chip browns at
// a rate ∝ exposure × (airflow)^0.6, since h grows roughly with air speed^0.5–0.6 in forced convection.
// This is a simple relative model: a single layer at full airflow is golden in about 15 minutes at 200 °C.
import { THREE, clamp, approach } from '../kit.js';
import { makeAirFryer, makeHotAir, makeChips } from '../fryer.js';
import { basketFlow, exposure, brownName, GRAMS_PER_CHIP } from '../cook.js';

const SIM_PER_S = 40;              // one real second is 40 s of cooking
const RATE = 1 / 900;              // browning per second for a fully exposed chip at full airflow
const END = 30 * 60;
const MAX_LAYERS = 6;

export default {
  id: 'airflow',
  short: 'Airflow and crowding',
  title: 'Don’t crowd the basket',
  subtitle: 'Hot air has to reach every chip. Pile them deep and the middle ones stay pale.',
  view: { pos: [4.6, 3.0, 4.6], target: [-0.5, 1.35, 0.7] },
  learn: `<p>Follow the air: the fan throws it outwards, the <b>air guide</b> sends it down the sides of the pan, and the <b>star baffle</b> on the bottom turns it into a swirl that rises up through the <b>mesh floor</b>, between the chips, and back to the fan. It makes this loop many times a minute.</p>
    <p>One layer of chips has air on every side. Pile them up and two things go wrong. The pile <b>resists</b> the air, like a thick filter, so the fan moves less of it. And chips in the middle are <b>shielded</b> by their neighbours, so they get less of the hot air that is left. They cook slowly and stay soft and pale, while the top layer browns.</p>
    <p>That is why recipes say <b>don't overfill</b> the basket and <b>shake it halfway</b>. Shaking swaps the chips around, so each one spends some time on the outside of the pile.</p>
    <p class="tip"><b>Try it:</b> fill the basket to the top and cook. Watch how uneven it gets, then start again and shake halfway.</p>`,
  terms: [
    { t: 'Airflow', d: 'How much air the fan moves round the fryer each second.' },
    { t: 'Resistance', d: 'How hard it is to push air through something. A deep pile of chips resists more, like a thick filter.' },
    { t: 'Exposure', d: 'How much of a chip’s surface meets the moving hot air, rather than touching other chips.' },
    { t: 'Even cooking', d: 'Every piece reaching the same colour and softness at the same time.' },
  ],
  defaults: { load: 300 },
  controls: [
    { key: 'load', type: 'range', label: 'Chips in the basket', min: 150, max: 950, step: 50, ends: ['a few', 'piled to the top'], fmt: (v) => Math.round(v) + ' g' },
    { key: 'go', type: 'buttons', label: 'Cooking at 200 °C', items: [{ label: 'Start again', act: (s, inst) => inst.restart() }, { label: 'Shake the basket', act: (s, inst) => inst.shake() }, { label: 'Skip 5 minutes', act: (s, inst) => inst.skip(300) }] },
  ],
  quiz: [
    { q: 'Where does the hot air go after the fan throws it outwards?', options: ['Straight out of the vent', 'Down the sides of the pan, then up through the basket floor', 'Into the motor', 'Only across the top of the food'], answer: 1, why: 'The air guide sends it down the sides; the star baffle turns it up through the mesh and the food.' },
    { q: 'Why do chips in the middle of a deep pile cook slowly?', options: ['They are further from the plug', 'The pile slows the airflow and their neighbours shield them from the hot air', 'The middle of the basket is cooler metal', 'They have more water'], answer: 1, why: 'Less air gets through a deep pile, and the buried chips see only a little of it.' },
    { q: 'What does shaking the basket halfway do?', options: ['Cools the chips down', 'Swaps the chips around so each gets time in the hot air', 'Drains extra oil', 'Resets the timer'], answer: 1, why: 'Chips from the pale middle move to the outside and catch up, so the batch cooks more evenly.' },
  ],
  reel: [
    { ms: 6000, caption: 'Pile the basket too high and the air can’t reach the middle. Shake it halfway so every chip gets its turn.', set: { load: 800 }, act: (s, inst) => { inst.restart(600, s); inst.shake(); }, view: { pos: [4.0, 3.1, 3.8], target: [0, 1.3, 0.4] }, spin: 0.25 },
  ],

  build({ stage }) {
    const f = makeAirFryer();
    stage.root.add(f.group);
    f.setXray(true, true);
    f.panMat.opacity = 0.14; f.basMat.opacity = 0.2;           // see the whole pile
    const chips = makeChips(MAX_LAYERS); f.basket.add(chips);
    const spots = chips.spots, perLayer = chips.perLayer, gLayer = perLayer * GRAMS_PER_CHIP;
    const air = makeHotAir(300); f.group.add(air);
    const lbl = stage.label('', [1.2, 0.2, 1.9], f.group);

    // chipAt[slot] = which chip sits in that slot; B[chip] = its browning.
    const n = spots.length;
    let chipAt = Int16Array.from({ length: n }, (_, i) => i), B = new Float32Array(n), t = 0, shakes = 0, toss = 0, seed = 1;
    const layersFor = (g) => clamp(Math.round(g / gLayer), 1, MAX_LAYERS);
    let layers = 0, flow = 1;
    const setLoad = (g) => { const L = layersFor(g); if (L !== layers) { layers = L; chips.setLayers(L); } flow = basketFlow(layers); };
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const step = () => {
      for (let sl = 0; sl < chips.count; sl++) {
        const e = exposure(spots[sl].layer, layers);
        B[chipAt[sl]] += RATE * e * Math.pow(flow, 0.6);
      }
      t++;
    };
    const stats = () => {
      let lo = Infinity, hi = -Infinity, sum = 0;
      for (let sl = 0; sl < chips.count; sl++) { const b = B[chipAt[sl]]; lo = Math.min(lo, b); hi = Math.max(hi, b); sum += b; }
      return { lo, hi, avg: sum / Math.max(1, chips.count) };
    };
    const api = {
      restart(sec = 0, s) { if (s) setLoad(s.load); B = new Float32Array(n); chipAt = Int16Array.from({ length: n }, (_, i) => i); t = 0; shakes = 0; for (let i = 0; i < sec; i++) step(); },
      skip(sec) { for (let i = 0; i < sec && t < END; i++) step(); },
      shake() {
        const m = chips.count;
        for (let i = m - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const a = chipAt[i]; chipAt[i] = chipAt[j]; chipAt[j] = a; }
        shakes++; toss = 1;
      },
    };
    let acc = 0, shown = 0;
    const o = [0, 0, 0], r = [0, 0, 0];
    return {
      ...api,
      update(dt, s) {
        dt = Math.max(0, dt);
        setLoad(s.load);
        if (t < END) { acc += dt * SIM_PER_S; let k = 0; while (acc >= 1 && k < 400) { step(); acc -= 1; k++; } }
        shown = approach(shown, flow, 3, dt);
        air.step(dt, 0.35 + 0.65 * shown);
        // Toss animation after a shake.
        toss = Math.max(0, toss - dt * 1.6);
        for (let sl = 0; sl < chips.count; sl++) {
          const sp = spots[sl], k = Math.sin(toss * Math.PI) * (0.35 + 0.25 * ((sl * 0.37) % 1));
          o[0] = sp.pos[0]; o[1] = sp.pos[1] + k; o[2] = sp.pos[2];
          r[0] = sp.rot[0] + toss * 3 * ((sl % 3) - 1); r[1] = sp.rot[1]; r[2] = sp.rot[2] + toss * 2;
          chips.place(sl, o, r);
          chips.colour(sl, B[chipAt[sl]]);
        }
        chips.done(); chips.flush();
        lbl.element.innerHTML = `Airflow <b>${Math.round(flow * 100)}%</b> of an empty basket`;
      },
      readout: (s) => {
        const st = stats(), g = chips.count * GRAMS_PER_CHIP;
        let minE = 1; for (let l = 0; l < layers; l++) minE = Math.min(minE, exposure(l, layers));
        const worst = 1 / (RATE * minE * Math.pow(flow, 0.6)) / 60;
        return `<div class="big">${Math.floor(t / 60)} min · ${layers} layer${layers > 1 ? 's' : ''}</div>
          <div class="row"><span>Chips</span><b>${chips.count} (${g} g)</b></div>
          <div class="row"><span>Airflow through the basket</span><b>${Math.round(flow * 100)}%</b></div>
          <div class="row"><span>Palest / darkest chip</span><b>${brownName(st.lo)} / ${brownName(st.hi)}</b></div>
          <div class="row"><span>Unshaken, slowest chips golden at</span><b>${Math.round(worst)} min</b></div>
          <div class="row"><span>Shakes</span><b>${shakes}</b></div>`;
      },
    };
  },
};
