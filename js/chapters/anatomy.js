// Chapter 1: take a basket air fryer apart.
import { THREE, exploder, approach } from '../kit.js';
import { makeAirFryer, makeHotAir, makeVentAir, makeChips } from '../fryer.js';

export default {
  id: 'anatomy',
  short: 'Inside an air fryer',
  title: 'Inside an air fryer',
  subtitle: 'A heater, a fan and a basket with holes in it. No oil bath at all.',
  view: { pos: [8.2, 4.5, 3.4], target: [-0.3, 2.1, 1.3] },
  learn: `<p>Here is the surprise: an air fryer doesn't fry. It is a small, very fast <b>convection oven</b>, a box that cooks with hot, moving air.</p>
    <p>In the lid sits a <b>heating element</b>, a spiral of metal tube that glows hot, usually rated about <b>1,400 to 1,700 watts</b>. Just above it a <b>fan</b>, turned by an electric <b>motor</b>, pulls air up through the element and flings it outwards. A metal <b>air guide</b> bends that stream down the sides.</p>
    <p>The food sits in a <b>basket</b> with a mesh or perforated floor, inside a <b>pan</b> that slides out like a drawer. A <b>star-shaped baffle</b> in the pan turns the air back up through the holes and through the food, round and round. A <b>temperature sensor</b> tells the <b>control board</b> when to switch the heater on and off. A second, small <b>cooling fan</b> keeps the motor and electronics safe, and warm, steamy air escapes through a <b>vent</b> at the back.</p>
    <p class="tip"><b>Try it:</b> take the fryer apart, then put it back together with X-ray on and watch the hot air loop.</p>`,
  terms: [
    { t: 'Heating element', d: 'A metal tube with a resistance wire inside that turns electricity into heat, like a toaster’s.' },
    { t: 'Convection', d: 'Heat carried by a moving fluid, here hot air. A fan makes it forced convection.' },
    { t: 'Air guide', d: 'The curved metal shroud around the fan that sends the hot air down the sides of the pan.' },
    { t: 'NTC thermistor', d: 'A tiny sensor whose resistance falls as it gets hotter, so the control board can read the temperature.' },
    { t: 'Baffle', d: 'A shaped plate that steers moving air. The star in the pan turns the air up through the basket.' },
  ],
  defaults: { explode: 0, xray: true, running: true },
  controls: [
    { key: 'explode', type: 'range', label: 'Take it apart', min: 0, max: 1, step: 0.01, ends: ['together', 'exploded'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'xray', type: 'toggle', label: 'X-ray casing' },
    { key: 'running', type: 'toggle', label: 'Switched on (200 °C)' },
  ],
  quiz: [
    { q: 'What really cooks the food in an air fryer?', options: ['A bath of hot oil', 'Microwaves', 'Hot air blown fast around it', 'Steam from a water tank'], answer: 2, why: 'An air fryer is a compact convection oven: a heater and a strong fan circulate very hot air.' },
    { q: 'Why does the basket have a mesh or perforated floor?', options: ['To let oil drain into the food', 'So hot air can flow up through the food from below', 'To make it lighter', 'To cool the food down'], answer: 1, why: 'The air comes down the sides and rises through the floor, so the bottom of the food cooks too.' },
    { q: 'What does the small fan on top of the motor do?', options: ['Blows hot air at the food', 'Cools the motor and electronics', 'Makes the fryer quieter', 'Sucks smoke out of the kitchen'], answer: 1, why: 'The motor and control board sit just above a 200 °C oven, so a second fan keeps them cool.' },
  ],
  reel: [
    { ms: 5600, caption: 'An air fryer is a tiny convection oven: a heater, a fan and a basket with holes in it.', set: { xray: false, running: true }, anim: { explode: [0, 0.95] }, view: { pos: [7.2, 4.6, 4.2], target: [0, 2.6, 1.0] }, spin: 0.5 },
    { ms: 5400, caption: 'The fan pulls air up through the glowing element and blasts it down the sides and back up through the food.', set: { explode: 0, xray: true, running: true }, view: { pos: [3.8, 3.1, 5.2], target: [0, 1.75, 0] }, spin: 0.3 },
  ],

  build({ stage }) {
    const f = makeAirFryer();
    stage.root.add(f.group);
    const chips = makeChips(2); chips.setLayers(2);
    for (let i = 0; i < chips.count; i++) chips.colour(i, 0.9);
    chips.flush(); f.basket.add(chips);
    const air = makeHotAir(260); f.group.add(air);
    const vent = makeVentAir(36); f.group.add(vent);

    // Labels on moving parts ride on anchor groups so they explode with them.
    const tag = (parent, pos) => { const g = new THREE.Group(); g.position.set(...pos); parent.add(g); return g; };
    const fanTag = tag(f.group, [0, 0, 0]), coolTag = tag(f.group, [0, 0, 0]);
    const setExplode = exploder([
      { obj: f.top, off: [0, 1.9, 0] },
      { obj: f.board, off: [0, 1.65, -0.3] },
      { obj: f.coolFan, off: [0, 1.45, 0] }, { obj: coolTag, off: [0, 1.45, 0] },
      { obj: f.motor, off: [0, 1.1, 0] },
      { obj: f.guide, off: [0, 0.75, 0] },
      { obj: f.fan, off: [0, 0.4, 0] }, { obj: fanTag, off: [0, 0.4, 0] },
      { obj: f.heater, off: [0, 0.05, 0] },
      { obj: f.sensor, off: [0.6, 0.3, -0.4] },
      { obj: f.drawer, off: [0, 0, 2.7] },
      { obj: f.basket, off: [0, 1.05, 0.5] },
      { obj: f.star, off: [0, 0.3, 0] },
    ]);
    // Labels sit to the left or right of each part as seen from the starting camera.
    const minor = [];
    const side = (k, y, dz = 0) => [k * 0.35, y, -k * 1.75 + dz];
    const L = (t, obj, p, cls, main) => { const l = stage.label(t, p, obj, cls); if (!main) minor.push(l); return l; };
    L('Heating element', f.heater, side(1, 1.8), 'hot', true);
    L('Convection fan', fanTag, side(1, 2.2), '', true);
    L('Air guide', f.guide, side(-1, 2.45));
    L('Motor', f.motor, side(1, 2.75));
    L('Cooling fan', coolTag, side(-1, 3.1));
    L('Control board', f.board, [0.3, 0.15, -2.2]);
    L('Temperature sensor', f.sensor, [0.3, 1.4, -1.2]);
    L('Basket with mesh floor', f.basket, [-0.2, 1.45, 1.35], '', true);
    L('Pan and drawer', f.pan, side(-1, 0.7, 0.9));
    L('Star baffle', f.star, side(1, 0.3));
    L('Exhaust vent', f.top, [0, 2.4, -2.2]);

    let run = 1, spin = 0, spin2 = 0, heat = 1;
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        setExplode(s.explode);
        minor.forEach((l) => { l.visible = stage.host.clientWidth >= 560 || s.explode > 0.5; });
        f.setXray(s.xray || s.explode > 0.05, s.xray && s.explode < 0.05);
        run = approach(run, s.running ? 1 : 0, 2.5, dt);
        heat = approach(heat, s.running ? 1 : 0, 1.2, dt);
        spin += dt * run * 9; spin2 += dt * run * 12;               // shown far slower than the real few thousand rpm
        f.fan.rotation.y = -spin; f.coolFan.rotation.y = -spin2;
        f.heater.setHeat(heat);
        const inside = s.explode < 0.05 && run > 0.05;
        air.visible = inside; vent.visible = inside;
        if (inside) { air.step(dt, run); vent.step(dt, run, true); }
      },
      readout: (s) => s.running
        ? `<div class="big">A tiny, fierce oven</div>
          <div class="row"><span>Heating element</span><b>about 1,500 W</b></div>
          <div class="row"><span>Hot air</span><b>up to 200 °C</b></div>
          <div class="row"><span>Cooking space</span><b>about 4 L (an oven: 60–70 L)</b></div>
          <div class="row"><span>Oil needed</span><b>0 to 1 spoonful</b></div>`
        : '<div class="big">Switched off</div>The element cools and the fan stops. Nothing moves the heat.',
    };
  },
};
