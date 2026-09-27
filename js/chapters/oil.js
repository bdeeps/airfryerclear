// Chapter 4: oil versus air. Deep frying uses hot oil as the heat carrier (h ≈ 250–500 W/m²K);
// an air fryer uses hot air (h ≈ 50–100) and only the oil you toss the chips in. Fat and calories
// come from cook.js: fatModel (sources there: USDA FoodData Central, Zaghi et al. 2019,
// Teruel et al. 2015, Andrés et al. 2013).
import { THREE, M, swarm, torus, canvasTexture } from '../kit.js';
import { fatModel, hCoeff, H_OIL, RAW_G, COOKED_G, brownHex } from '../cook.js';
import { vLathe, vCyl, makeChips, FR } from '../fryer.js';

const POT = [-2.1, 0, 0], BASKET = [2.1, 0, 0];

export default {
  id: 'oil',
  short: 'Oil versus air',
  title: 'Frying in oil, frying in air',
  subtitle: 'Oil carries heat brilliantly, and some of it stays in the chips.',
  view: { pos: [0.6, 4.4, 9.4], target: [0.5, 2.0, 0] },
  learn: `<p>In a <b>deep fryer</b> the chips sink into oil at about <b>180 °C</b>. Oil is a liquid, so it touches every bit of the surface and carries heat far better than air: <b>h</b> is about <b>250 to 500 W/m²K</b>, and even more while the chips fizz with steam. That's why deep frying is quick.</p>
    <p>The catch: as water leaves the chip, oil creeps into the tiny gaps it leaves behind, most of it as the chips come out and cool. Deep-fried chips usually end up about <b>10 to 15% fat</b>.</p>
    <p>An <b>air fryer</b> uses hot air instead, and the only fat is the spoonful of oil you toss the chips in. Studies find air-fried chips have <b>a few percent fat</b>, up to about 70 to 80% less than deep-fried ones. The air is a weaker heat carrier, so it takes longer, and the crust is a little drier.</p>
    <p>Both ways can make <b>acrylamide</b> if chips are cooked too dark. Some studies found less of it in air-fried chips, but the advice is the same: cook to <b>golden</b>.</p>
    <p class="tip"><b>Try it:</b> change how much oil you toss the chips in, and compare the fat and the calories.</p>`,
  terms: [
    { t: 'Deep frying', d: 'Cooking food fully under hot oil, usually 160 to 190 °C.' },
    { t: 'Oil uptake', d: 'Oil that soaks into food as it fries, mostly into pores left by escaping steam.' },
    { t: 'Calorie', d: 'A unit of food energy. Fat has about 9 kcal per gram; potato starch about 4.' },
    { t: 'Heat carrier', d: 'The stuff that brings heat to the food: oil, water, steam or air.' },
  ],
  defaults: { oil: 5 },
  controls: [
    { key: 'oil', type: 'range', label: 'Oil tossed on the chips (air fryer)', min: 0, max: 15, step: 1, ends: ['none', '1 tablespoon'], fmt: (v) => (v ? `${Math.round(v)} ml (${(v / 5).toFixed(v % 5 ? 1 : 0)} tsp)` : 'none') },
  ],
  quiz: [
    { q: 'Why does deep frying cook chips faster than an air fryer?', options: ['The oil is much hotter than 200 °C', 'Liquid oil touches the whole surface and hands over heat far better than air', 'Oil contains more calories', 'The pot is bigger'], answer: 1, why: 'Oil’s heat-transfer coefficient is several times that of air, even though its temperature is similar.' },
    { q: 'Roughly how much fat do deep-fried chips contain?', options: ['Less than 1%', 'About 10 to 15%', 'About 50%', 'None, the oil all drips off'], answer: 1, why: 'Oil fills the pores left by escaping water, so deep-fried chips are usually about 10 to 15% fat.' },
    { q: 'Where does the fat in air-fried chips come from?', options: ['The air', 'The oil you toss them in, if any', 'The basket coating', 'Potatoes are naturally fatty'], answer: 1, why: 'Potato has almost no fat. In an air fryer the fat is just the spoonful of oil you add.' },
  ],
  reel: [
    { ms: 5800, caption: 'Deep-fried chips soak up oil to about 13% fat. Air-fried chips get just a teaspoon’s worth.', anim: { oil: [15, 5] }, view: { pos: [0.2, 4.0, 8.6], target: [0, 2.1, 0] }, spin: 0.15 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);

    // Deep fryer: a steel pot of golden oil with chips under the surface and steam bubbles rising.
    const pot = new THREE.Group(); pot.position.set(...POT); root.add(pot);
    pot.add(vLathe([[1.25, 1.55], [1.25, 0.12], [1.18, 0.05], [0, 0.05]], M.metal(0xb9bec8, { side: THREE.DoubleSide, transparent: true, opacity: 0.35, depthWrite: false })));
    const rim = torus(1.26, 0.04, M.metal(0xc4c9d2)); rim.rotation.x = Math.PI / 2; rim.position.y = 1.55; pot.add(rim);
    const oilMat = new THREE.MeshStandardMaterial({ color: 0xe0a53a, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false });
    const oil = vCyl(1.2, 0.08, 1.15, oilMat, 48); oil.castShadow = false; pot.add(oil);
    const potChips = swarm(10, new THREE.BoxGeometry(0.75, 0.12, 0.12), M.matte(brownHex(1.1)));
    for (let i = 0; i < 10; i++) potChips.place(i, [-0.5 + (i % 4) * 0.33, 0.35 + Math.floor(i / 4) * 0.22, -0.4 + ((i * 0.37) % 1) * 0.8], [0, i * 0.9, 0.2 * Math.sin(i)]);
    potChips.done(); pot.add(potChips);
    const BN = 70, bub = swarm(BN, new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff4d6, toneMapped: false, transparent: true, opacity: 0.8 }));
    bub.castShadow = false; pot.add(bub);
    const bu = Float32Array.from({ length: BN }, (_, i) => (i * 0.618) % 1);

    // Air fryer basket: chips in one layer, hot air rising through, a few oil drops on them.
    const bas = new THREE.Group(); bas.position.set(...BASKET); root.add(bas);
    bas.add(vLathe([[1.0, 0.1], [1.05, 0.15], [1.05, 1.3], [1.12, 1.3]], M.metal(0x4a4e57, { side: THREE.DoubleSide, transparent: true, opacity: 0.4, depthWrite: false })));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.02, 40), M.metal(0x50545e, { wireframe: true })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.11; bas.add(floor);
    const airChips = makeChips(1); airChips.setLayers(1); airChips.position.y = 0.12 - FR.basY0;
    for (let i = 0; i < airChips.count; i++) airChips.colour(i, 1.0);
    airChips.flush(); bas.add(airChips);
    const DN = 40, drops = swarm(DN, new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffd36a, roughness: 0.05, metalness: 0.1, emissive: 0x6a4a10 }));
    for (let i = 0; i < DN; i++) drops.place(i, [-0.8 + ((i * 0.618) % 1) * 1.6, 0.27 + ((i * 0.31) % 1) * 0.12, -0.7 + ((i * 0.7548) % 1) * 1.4]);
    drops.done(); bas.add(drops);
    const AN = 90, air = swarm(AN, new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff8a3d, toneMapped: false }));
    air.castShadow = false; bas.add(air);
    const au = Float32Array.from({ length: AN }, (_, i) => (i * 0.618) % 1);

    const hAir = hCoeff({ v: 4, Tair: 200, Ts: 100, D: 0.01 }).h;
    stage.label(`Deep fryer · oil at 180 °C · <b>h ≈ ${H_OIL}</b>`, [0, 2.1, 0], pot, 'hot');
    stage.label(`Air fryer · air at 200 °C · <b>h ≈ ${Math.round(hAir)}</b>`, [0, 2.1, 0], bas, 'hot');
    const oilLbl = stage.label('', [0, -0.35, 1.3], bas);
    stage.label('2.5 litres of oil', [0, -0.35, 1.3], pot);

    // Board: calories in one portion (200 g of raw potato → about 120 g of chips), potato + fat.
    let cur = { oil: 5 };
    const chart = canvasTexture(700, 300, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.88)'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8eef8'; g.font = 'bold 26px sans-serif'; g.fillText(`Chips from ${RAW_G} g of potato`, 18, 36);
      const deep = fatModel('deep'), airF = fatModel('air', cur.oil);
      const x0 = 110, max = 330, W = (kcal) => (kcal / max) * (w - x0 - 120);
      const bar = (y, m, name) => {
        g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '24px sans-serif'; g.fillText(name, 18, y + 34);
        const p = m.kcal - m.fatKcal;
        g.fillStyle = '#e6d9a8'; g.fillRect(x0, y, W(p), 50);
        g.fillStyle = '#ffb547'; g.fillRect(x0 + W(p), y, Math.max(2, W(m.fatKcal)), 50);
        g.fillStyle = '#e8eef8'; g.font = 'bold 24px sans-serif'; g.fillText(`${Math.round(m.kcal)} kcal`, x0 + W(m.kcal) + 10, y + 34);
        g.fillStyle = '#1a1d24'; g.font = 'bold 21px sans-serif'; g.fillText(`${m.fat.toFixed(1)} g fat`, x0 + 10, y + 33);
      };
      bar(62, deep, 'Deep'); bar(132, airF, 'Air');
      g.font = '21px sans-serif'; g.fillStyle = '#e6d9a8'; g.fillRect(18, h - 76, 18, 18); g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText('potato: 77 kcal per 100 g raw', 44, h - 60);
      g.fillStyle = '#ffb547'; g.fillRect(18, h - 42, 18, 18); g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText('fat: 9 kcal per gram', 44, h - 26);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.89), new THREE.MeshBasicMaterial({ map: chart.tex, transparent: true, toneMapped: false }));
    board.position.set(2.2, 3.85, -1.0); root.add(board);

    let shown = -1;
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        if (s.oil !== shown) { shown = s.oil; cur.oil = s.oil; chart.redraw(); }
        const nDrops = Math.round((s.oil / 15) * DN);
        drops.count = nDrops;
        oilLbl.element.innerHTML = s.oil ? `${Math.round(s.oil)} ml of oil tossed on` : 'no oil at all';
        for (let i = 0; i < BN; i++) {
          bu[i] = (bu[i] + dt * 0.9) % 1;
          const a = ((i * 0.7548) % 1) * Math.PI * 2, r = 0.2 + ((i * 0.37) % 1) * 0.8;
          bub.place(i, [r * Math.cos(a) + Math.sin(bu[i] * 9 + i) * 0.04, 0.3 + bu[i] * 0.85, r * Math.sin(a)], null, 0.6 + bu[i]);
        }
        bub.done();
        for (let i = 0; i < AN; i++) {
          au[i] = (au[i] + dt * 0.7) % 1;
          const a = ((i * 0.7548) % 1) * Math.PI * 2, r = 0.1 + ((i * 0.37) % 1) * 0.85;
          air.place(i, [r * Math.cos(a + au[i]), 0.1 + au[i] * 1.6, r * Math.sin(a + au[i])]);
        }
        air.done();
      },
      readout: (s) => {
        const d = fatModel('deep'), a = fatModel('air', s.oil);
        const less = Math.round((1 - a.fat / d.fat) * 100);
        return `<div class="big">${less}% less fat</div>
          <div class="row"><span>Fat: deep / air</span><b>${d.pct.toFixed(0)}% / ${a.pct.toFixed(1)}%</b></div>
          <div class="row"><span>Calories: deep / air</span><b>${Math.round(d.kcal)} / ${Math.round(a.kcal)} kcal</b></div>
          <div class="row"><span>Heat carrier h: oil / air</span><b>${H_OIL} / ${Math.round(hAir)} W/m²K</b></div>
          <small>${RAW_G} g raw potato makes about ${COOKED_G} g of chips.</small>`;
      },
    };
  },
};
