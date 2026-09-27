// Chapter 6: the thermostat and the electricity bill. A lumped thermal model of the fryer
// (cook.js: makeAppliance) with its 1,500 W element switched on and off by a thermostat, and the
// same batch of chips cooked in a fan oven and a deep fryer for comparison (cook.js: batchEnergy).
import { THREE, canvasTexture, clamp } from '../kit.js';
import { makeAppliance, batchEnergy, APPLIANCES, TARIFF } from '../cook.js';
import { makeAirFryer, makeHotAir } from '../fryer.js';

const SIM_PER_S = 30;              // one real second is 30 s
const WINDOW = 24 * 60;            // chart: 24 minutes
const BANDS = { bimetal: 6, ntc: 2 };
const FOOD = { empty: 0, half: 0.5, full: 1 };

export default {
  id: 'energy',
  short: 'Thermostat and energy',
  title: 'Click on, click off',
  subtitle: 'A 1,500 W heater, a thermostat, and why a small box saves energy.',
  view: { pos: [0.2, 3.2, 10.2], target: [0.1, 2.2, 0] },
  learn: `<p>The heating element is either fully <b>on</b>, at about <b>1,400 to 1,700 W</b>, or <b>off</b>. To hold 180 °C, a <b>thermostat</b> switches it on when the air falls a little below the set point and off when it rises a little above. Listen closely and you can hear the <b>relay</b> click.</p>
    <p>Simple fryers use a <b>bimetal</b> strip or disc: two metals that expand differently, so it bends and flicks a contact when it gets hot. It lets the temperature swing several degrees. Digital fryers use an <b>NTC thermistor</b>, whose resistance falls as it heats, read by a tiny computer that drives the relay. It holds the temperature more tightly.</p>
    <p>An air fryer heats only about <b>4 litres</b> of space and a little metal, so it <b>preheats in about 3 minutes</b>. A big oven must heat 60 to 70 litres and a heavy steel box first. For a small batch the air fryer uses roughly <b>half the electricity</b> of an oven. For a big family meal, an oven that cooks everything at once can win.</p>
    <p class="tip"><b>Try it:</b> watch the heater click on and off in the chart. Swap the thermostat, then empty the basket and see the duty cycle drop.</p>`,
  terms: [
    { t: 'Thermostat', d: 'A switch that turns the heater on and off to keep the temperature near a set point.' },
    { t: 'Bimetal strip', d: 'Two metals bonded together that expand by different amounts, so the strip bends as it heats and can open a contact.' },
    { t: 'Relay', d: 'An electrically worked switch. A small current from the control board switches the heater’s big current.' },
    { t: 'Duty cycle', d: 'The share of time the heater is on. At steady temperature, it just balances the heat lost and the heat going into the food.' },
    { t: 'kWh', d: 'A kilowatt-hour, one "unit" on an electricity bill: 1,000 watts for one hour.' },
  ],
  defaults: { set: 180, stat: 'bimetal', food: 'full' },
  controls: [
    { key: 'set', type: 'range', label: 'Set temperature', min: 80, max: 200, step: 5, ends: ['80 °C', '200 °C'], fmt: (v) => Math.round(v) + ' °C' },
    { key: 'stat', type: 'seg', label: 'Thermostat', options: [{ v: 'bimetal', label: 'Bimetal' }, { v: 'ntc', label: 'NTC + relay' }], fmt: (v) => `±${BANDS[v]} °C` },
    { key: 'food', type: 'seg', label: 'Basket', options: [{ v: 'empty', label: 'Empty' }, { v: 'half', label: '250 g' }, { v: 'full', label: '500 g chips' }] },
    { key: 'go', type: 'buttons', label: 'Run', items: [{ label: 'Start again', act: (s, inst) => inst.restart(0, s) }, { label: 'Skip 5 minutes', act: (s, inst) => inst.skip(300) }] },
  ],
  quiz: [
    { q: 'How does the fryer hold 180 °C with a 1,500 W heater?', options: ['It turns the heater down to exactly the right power', 'A thermostat switches the heater fully on and off around the set point', 'The fan speeds up and slows down', 'It doesn’t: it keeps getting hotter'], answer: 1, why: 'The element is on or off. The thermostat clicks it on below the set point and off above it.' },
    { q: 'Why does an air fryer preheat faster than an oven?', options: ['Its heater is much more powerful', 'It has only a few litres of space and a little metal to heat', 'It uses gas', 'Ovens don’t need preheating'], answer: 1, why: 'Less air and less steel to warm up means the same heat raises the temperature far faster.' },
    { q: 'At ₹7 per kWh, what does 0.4 kWh cost?', options: ['₹0.28', '₹2.80', '₹28', '₹280'], answer: 1, why: '0.4 × ₹7 = ₹2.80. One unit on the bill is one kWh.' },
  ],
  reel: [
    { ms: 5800, caption: 'A 1,500 W heater clicks on and off to hold the temperature: that’s the thermostat at work.', set: { set: 180, stat: 'bimetal', food: 'full' }, act: (s, inst) => inst.restart(270, s), view: { pos: [0.2, 3.0, 9.0], target: [0, 2.3, 0] }, spin: 0.1 },
    { ms: 5400, caption: 'A small box heats fast: a batch of chips uses about half the electricity of a big oven.', set: { set: 180, stat: 'ntc', food: 'full' }, act: (s, inst) => inst.restart(720, s), view: { pos: [-1.4, 2.6, 8.2], target: [-0.6, 1.6, 0] }, spin: 0.1 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const f = makeAirFryer(); f.group.position.set(2.5, 0, 0.6); f.group.scale.setScalar(0.78); f.group.rotation.y = -0.5; root.add(f.group);
    f.setXray(true, false);
    const air = makeHotAir(160); f.group.add(air);
    const hLbl = stage.label('', [0, -0.55, 2.0], f.group, 'hot');

    let sim, hist, key = '';
    const restart = (sec, s) => {
      sim = makeAppliance('fryer', { set: s.set, band: BANDS[s.stat], food: FOOD[s.food] });
      hist = { T: [sim.T], on: [0] }; key = `${s.set}|${s.stat}|${s.food}`;
      for (let i = 0; i < sec; i++) tick();
      chart.redraw(); bars.redraw(s);
    };
    const tick = () => {
      sim.step();
      if (sim.t % 5 === 0 && sim.t <= WINDOW) { hist.T.push(sim.T); hist.on.push(sim.on ? 1 : 0); }
    };

    // Chart: air temperature and heater state over time.
    let setT = 180;
    const chart = canvasTexture(900, 380, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.88)'; g.fillRect(0, 0, w, h);
      if (!sim) return;
      const x0 = 68, x1 = w - 20, y0 = h - 110, y1 = 56;
      const X = (t) => x0 + (t / WINDOW) * (x1 - x0), Y = (T) => y0 - (clamp(T, 0, 220) / 220) * (y0 - y1);
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '22px sans-serif'; g.lineWidth = 1;
      for (let T = 0; T <= 200; T += 50) { g.beginPath(); g.moveTo(x0, Y(T)); g.lineTo(x1, Y(T)); g.stroke(); g.fillText(T + '°', 12, Y(T) + 7); }
      for (let m = 0; m <= 24; m += 4) g.fillText(m + ' min', X(m * 60) - 26, h - 10);
      g.setLineDash([8, 8]); g.strokeStyle = 'rgba(92,225,169,.7)'; g.beginPath(); g.moveTo(x0, Y(setT)); g.lineTo(x1, Y(setT)); g.stroke(); g.setLineDash([]);
      g.strokeStyle = '#ff7a3d'; g.lineWidth = 3; g.beginPath(); hist.T.forEach((T, i) => (i ? g.lineTo(X(i * 5), Y(T)) : g.moveTo(X(0), Y(T)))); g.stroke();
      // Heater strip.
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x0, y0 + 22, x1 - x0, 30);
      g.fillStyle = '#ffb547';
      hist.on.forEach((o, i) => { if (o) g.fillRect(X(i * 5), y0 + 22, X(5) - X(0) + 0.6, 30); });
      g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '19px sans-serif'; g.fillText('heater on', x0 + 6, y0 + 16);
      g.fillStyle = '#e8eef8'; g.font = 'bold 26px sans-serif'; g.fillText('Air temperature and heater', 20, 34);
      g.font = 'bold 21px sans-serif'; g.fillStyle = '#5ce1a9'; g.fillText(`set ${setT} °C`, w - 150, 34);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.11), new THREE.MeshBasicMaterial({ map: chart.tex, transparent: true, toneMapped: false }));
    board.position.set(1.8, 4.05, -0.4); root.add(board);

    // Bars: energy and cost for one batch of 500 g chips, three ways.
    const bars = canvasTexture(720, 330, (g, w, h, s) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.88)'; g.fillRect(0, 0, w, h);
      if (!s) return;
      g.fillStyle = '#e8eef8'; g.font = 'bold 26px sans-serif'; g.fillText(`500 g of chips at ${s.set} °C`, 18, 36);
      const rows = ['fryer', 'deep', 'oven'].map((k) => ({ k, ...batchEnergy(k, { set: s.set, band: BANDS[s.stat] }) }));
      const max = Math.max(...rows.map((r) => r.kWh)), x0 = 150, bw = w - x0 - 200;
      rows.forEach((r, i) => {
        const y = 58 + i * 88, L = (r.kWh / max) * bw;
        g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '24px sans-serif'; g.fillText(APPLIANCES[r.k].name, 18, y + 34);
        g.fillStyle = r.k === 'fryer' ? '#8ef0ff' : '#7a8394'; g.fillRect(x0, y + 6, L, 44);
        g.fillStyle = '#e8eef8'; g.font = 'bold 24px sans-serif'; g.fillText(`${r.kWh.toFixed(2)} kWh`, x0 + L + 10, y + 26);
        g.fillStyle = '#ffb547'; g.fillText(`₹${r.cost.toFixed(2)}`, x0 + L + 10, y + 54);
        g.fillStyle = 'rgba(255,255,255,.65)'; g.font = '20px sans-serif'; g.fillText(`${Math.round(r.minutes)} min, ${Math.round(r.preheat)} heating up`, x0, y + 76);
      });
    });
    const bboard = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.06), new THREE.MeshBasicMaterial({ map: bars.tex, transparent: true, toneMapped: false }));
    bboard.position.set(-2.4, 0.95, 0.4); root.add(bboard);

    const inst = {
      restart, skip(sec) { for (let i = 0; i < sec; i++) tick(); chart.redraw(); },
    };
    restart(0, { set: 180, stat: 'bimetal', food: 'full' });
    let acc = 0, glow = 0, spin = 0;
    return {
      ...inst,
      update(dt, s) {
        dt = Math.max(0, dt);
        setT = Math.round(s.set);
        const k = `${s.set}|${s.stat}|${s.food}`;
        if (k !== key) { restart(0, s); }
        if (sim.phase !== 'done') { acc += dt * SIM_PER_S; let n = 0; while (acc >= 1 && n < 400) { tick(); acc -= 1; n++; } if (n) chart.redraw(); }
        glow = sim.on ? Math.min(1, glow + dt * 6) : Math.max(0, glow - dt * 2.5);
        f.heater.setHeat(glow);
        const running = sim.phase !== 'done';
        spin += dt * (running ? 9 : 0); f.fan.rotation.y = -spin; f.coolFan.rotation.y = -spin * 1.3;
        air.visible = running; if (running) air.step(dt, 1);
        const mm = Math.floor(sim.t / 60), ss = String(sim.t % 60).padStart(2, '0');
        f.setScreen(`${Math.round(sim.T)}°`, `${mm}:${ss}`);
        hLbl.element.innerHTML = sim.on ? 'Heater <b>ON · 1,500 W</b>' : 'Heater off · <b>0 W</b>';
      },
      readout: (s) => {
        const on = hist.on.slice(-24), duty = on.length ? on.reduce((a, b) => a + b, 0) / on.length : 0;
        const phase = { preheat: 'Heating up', cook: 'Cooking', done: 'Done' }[sim.phase];
        return `<div class="big">${phase}: ${Math.round(sim.T)} °C</div>
          <div class="row"><span>Heater on, last 2 min</span><b>${Math.round(duty * 100)}% of the time</b></div>
          <div class="row"><span>Average power</span><b>${Math.round(duty * APPLIANCES.fryer.P)} W</b></div>
          <div class="row"><span>Used so far</span><b>${sim.kWh().toFixed(2)} kWh · ₹${(sim.kWh() * TARIFF).toFixed(2)}</b></div>
          <div class="row"><span>Heater switched on</span><b>${sim.switches} times</b></div>
          <small>At ₹${TARIFF} per kWh (unit), a typical Indian home tariff.</small>`;
      },
    };
  },
};
