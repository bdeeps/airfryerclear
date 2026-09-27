// AirFryerClear's physics, kept free of three.js so it can be tested on its own:
// convective heat transfer, heating and drying of a potato piece, browning, oil
// uptake, airflow through a loaded basket, and a thermostat-controlled appliance.
//
// Units are SI unless a name says otherwise (°C for temperatures, minutes where marked).

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const SIGMA = 5.670e-8;                       // Stefan–Boltzmann constant, W/m²K⁴

// ---------------------------------------------------------------- hot air
// Dry air near 1 atm (Incropera & DeWitt, Fundamentals of Heat and Mass Transfer, table A.4):
// at 300 K k = 0.0263 W/mK, ν = 15.9e-6 m²/s; at 450 K k = 0.0373, ν = 32.4e-6. Pr ≈ 0.69–0.71.
// We interpolate linearly in temperature between 300 and 500 K.
export function airProps(Tc) {
  const T = Tc + 273.15, k = (T - 300) / 150;
  return { k: 0.0263 + (0.0373 - 0.0263) * k, nu: 15.9e-6 + (32.4e-6 - 15.9e-6) * k, Pr: 0.69, beta: 1 / T };
}

// Heat-transfer coefficient h (W/m²K) for a small piece of food of size D (m) in air at Tair,
// surface at Ts, with the air moving at v (m/s).
//  - forced: Whitaker's sphere correlation, Nu = 2 + (0.4 Re^½ + 0.06 Re^⅔) Pr^0.4 (Incropera eq. 7.56);
//  - natural: Churchill's sphere correlation, Nu = 2 + 0.589 Ra^¼ / [1 + (0.469/Pr)^(9/16)]^(4/9) (Incropera eq. 9.35);
//  - mixed: Nu³ = Nu_forced³ + Nu_natural³ (Churchill's blending rule).
//  - radiation from walls at the air temperature, emissivity 0.9: h_rad = εσ(Ts² + Tw²)(Ts + Tw).
// For a 2 cm potato cube in 180 °C air this gives h ≈ 13 W/m²K in still air (textbook natural
// convection: 5–25) and ≈ 60 W/m²K at 5 m/s (forced convection in gases: 25–250).
export function hCoeff({ v, Tair, Ts = 20, D = 0.02 }) {
  const film = (Tair + Ts) / 2, a = airProps(film);
  const Re = Math.max(0, v) * D / a.nu;
  const nuF = 2 + (0.4 * Math.sqrt(Re) + 0.06 * Math.pow(Re, 2 / 3)) * Math.pow(a.Pr, 0.4);
  const alpha = a.nu / a.Pr;
  const Ra = (9.81 * a.beta * Math.abs(Tair - Ts) * D ** 3) / (a.nu * alpha);
  const nuN = 2 + (0.589 * Math.pow(Ra, 0.25)) / Math.pow(1 + Math.pow(0.469 / a.Pr, 9 / 16), 4 / 9);
  const nu = Math.cbrt(nuF ** 3 + nuN ** 3);
  const conv = (nu * a.k) / D;
  const Tw = Tair + 273.15, Tk = Ts + 273.15;
  const rad = 0.9 * SIGMA * (Tk * Tk + Tw * Tw) * (Tk + Tw);
  return { conv, rad, h: conv + rad, Re, natural: (nuN * a.k) / D, forced: (nuF * a.k) / D };
}

// ---------------------------------------------------------------- potato
// Raw potato (Singh & Heldman, Introduction to Food Engineering; USDA FoodData Central #170026):
// about 79% water, density ≈ 1,080 kg/m³, specific heat ≈ 3.6 kJ/kgK wet and ≈ 1.5 kJ/kgK for the
// dry solids, conductivity ≈ 0.55 W/mK wet and ≈ 0.15 W/mK once dried to a crust.
export const POTATO = { rho: 1080, water: 0.79, kWet: 0.55, kDry: 0.15, cpSolid: 1500, cpWater: 4180 };
export const LATENT = 2.257e6;               // J/kg, water at 100 °C (IAPWS steam tables)
const W0 = POTATO.rho * POTATO.water;         // water per m³ of raw potato, ≈ 853 kg
const S0 = POTATO.rho * (1 - POTATO.water);   // dry solids per m³, ≈ 227 kg

// Browning: an Arrhenius rate that only runs where the food has dried out (below ~20% of its water;
// Maillard browning is fastest at low-to-intermediate water activity). Ea = 100 kJ/mol sits in the
// 50–150 kJ/mol range reported for potato browning. The rate is scaled so a fry cooked at 200 °C
// is golden (B = 1) after about 14 minutes at 200 °C and 22 at 180 °C, in line with air fryer cooking charts.
// B: 0 pale, 1 golden, 1.8 brown, 2.6+ dark (too dark: the FSA's "Go for Gold" advice).
const EA = 100e3, RGAS = 8.314, TREF = 160 + 273.15, K_REF = 1 / 725;   // per second at 160 °C
export function brownRate(Tc, wFrac) {
  if (Tc < 100) return 0;
  const dry = clamp((0.2 - wFrac) / 0.2, 0, 1);
  return K_REF * dry * Math.exp((-EA / RGAS) * (1 / (Tc + 273.15) - 1 / TREF));
}
export function brownName(B) { return B < 0.35 ? 'pale' : B < 0.8 ? 'light gold' : B < 1.35 ? 'golden' : B < 2.1 ? 'brown' : B < 2.8 ? 'dark brown' : 'burnt'; }
// Colour of potato from raw (B=0) through golden (1) to dark (3), as sRGB hex.
const BROWN = [[0, [226, 212, 150]], [0.5, [232, 186, 76]], [1, [208, 140, 36]], [1.8, [150, 84, 24]], [2.6, [88, 48, 18]], [3.4, [42, 26, 14]]];
export function brownRGB(B) {
  const b = clamp(B, 0, 3.4);
  for (let i = 1; i < BROWN.length; i++) if (b <= BROWN[i][0]) {
    const [x0, c0] = BROWN[i - 1], [x1, c1] = BROWN[i], k = (b - x0) / (x1 - x0);
    return c0.map((c, j) => Math.round(c + (c1[j] - c) * k));
  }
  return BROWN[BROWN.length - 1][1];
}
export const brownHex = (B) => { const [r, g, b] = brownRGB(B); return (r << 16) | (g << 8) | b; };
export const brownCss = (B) => `rgb(${brownRGB(B).join(',')})`;

// A square cross-section of a chip (a long fry), size a (m), heated from all four sides.
// Explicit finite differences on an N×N grid. Each cell keeps its temperature and water. When a
// wet cell would pass 100 °C the extra heat boils water off instead (the vapour is assumed to escape),
// so a dry crust grows inwards from the surface: the classic "moving boundary" frying model
// (Farkas, Singh & Rumsey, J. Food Eng. 1996). Water migration by diffusion is ignored.
export function makeFry({ a = 0.01, N = 16, T0 = 20 } = {}) {
  const dx = a / N, n = N * N;
  const T = new Float64Array(n).fill(T0), W = new Float64Array(n).fill(W0), B = new Float64Array(n);
  const q = new Float64Array(n);
  let t = 0, lost = 0;
  const kOf = (i) => POTATO.kDry + (POTATO.kWet - POTATO.kDry) * (W[i] / W0);
  const cOf = (i) => S0 * POTATO.cpSolid + W[i] * POTATO.cpWater;
  // Stable step for the driest (lowest heat capacity) cell.
  const dtMax = 0.2 * dx * dx * (S0 * POTATO.cpSolid) / POTATO.kWet;
  function step(dt, Tair, h) {
    const sub = Math.max(1, Math.ceil(dt / dtMax)), d = dt / sub;
    for (let s = 0; s < sub; s++) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x; let Q = 0;
        const nb = (j) => { const k = 2 / (1 / kOf(i) + 1 / kOf(j)); Q += k * (T[j] - T[i]); };
        if (x > 0) nb(i - 1); else Q += h * dx * (Tair - T[i]);
        if (x < N - 1) nb(i + 1); else Q += h * dx * (Tair - T[i]);
        if (y > 0) nb(i - N); else Q += h * dx * (Tair - T[i]);
        if (y < N - 1) nb(i + N); else Q += h * dx * (Tair - T[i]);
        q[i] = Q;                                            // W per metre of fry length
      }
      for (let i = 0; i < n; i++) {
        let T1 = T[i] + (q[i] * d) / (cOf(i) * dx * dx);
        if (T1 > 100 && W[i] > 0) {
          const E = (T1 - 100) * cOf(i) * dx * dx, m = Math.min(W[i] * dx * dx, E / LATENT);
          W[i] -= m / (dx * dx); lost += m;
          T1 = 100 + (E - m * LATENT) / (cOf(i) * dx * dx);
        }
        T[i] = T1;
        B[i] += brownRate(T[i], W[i] / W0) * d;
      }
      t += d;
    }
  }
  const at = (x, y) => y * N + x;
  return {
    N, a, T, W, B, W0, step,
    get t() { return t; },
    // Surface = mean of the edge cells; core = mean of the middle four.
    surfaceT() { let s = 0, c = 0; for (let k = 0; k < N; k++) { s += T[at(k, 0)] + T[at(k, N - 1)] + T[at(0, k)] + T[at(N - 1, k)]; c += 4; } return s / c; },
    coreT() { const m = N / 2; return (T[at(m - 1, m - 1)] + T[at(m, m - 1)] + T[at(m - 1, m)] + T[at(m, m)]) / 4; },
    surfaceB() { let s = 0; for (let k = 1; k < N - 1; k++) s += B[at(k, 0)] + B[at(k, N - 1)] + B[at(0, k)] + B[at(N - 1, k)]; return s / (4 * (N - 2)); },
    surfaceW() { let s = 0; for (let k = 1; k < N - 1; k++) s += W[at(k, 0)] + W[at(k, N - 1)] + W[at(0, k)] + W[at(N - 1, k)]; return s / (4 * (N - 2)) / W0; },
    // Fraction of the fry's starting water that has boiled off.
    waterLost() { return lost / (W0 * a * a); },
    // Depth (m) of the dry crust along the middle of one side.
    crust() { const m = N / 2; let d = 0; for (let x = 0; x < m; x++) { if (W[at(x, m)] < 0.5 * W0) d = x + 1; else break; } return d * dx; },
  };
}

// A potato piece as a sphere with the same surface-to-volume ratio as a cube of side L
// (R = L/2), used to compare heating in different ovens. 1D radial finite differences with the
// same drying rule as above. Returns the core temperature over time.
export function makeLump({ L = 0.02, N = 20, T0 = 20 } = {}) {
  const R = L / 2, dr = R / N;
  const T = new Float64Array(N).fill(T0), W = new Float64Array(N).fill(W0);
  const vol = [], area = [];
  for (let i = 0; i < N; i++) { const r0 = i * dr, r1 = (i + 1) * dr; vol.push((4 / 3) * Math.PI * (r1 ** 3 - r0 ** 3)); area.push(4 * Math.PI * r1 * r1); }
  const Q = new Float64Array(N);
  let t = 0, lastFlux = 0;
  const dtMax = 0.2 * dr * dr * (S0 * POTATO.cpSolid) / POTATO.kWet;
  function step(dt, Tair, hOf) {
    const sub = Math.max(1, Math.ceil(dt / dtMax)), d = dt / sub;
    for (let s = 0; s < sub; s++) {
      const h = hOf(T[N - 1]);
      Q.fill(0);
      for (let i = 0; i < N - 1; i++) {
        const k = POTATO.kDry + (POTATO.kWet - POTATO.kDry) * ((W[i] + W[i + 1]) / (2 * W0));
        const f = (k * area[i] * (T[i + 1] - T[i])) / dr;
        Q[i] += f; Q[i + 1] -= f;
      }
      lastFlux = h * area[N - 1] * (Tair - T[N - 1]);
      Q[N - 1] += lastFlux;
      for (let i = 0; i < N; i++) {
        const C = (S0 * POTATO.cpSolid + W[i] * POTATO.cpWater) * vol[i];
        let T1 = T[i] + (Q[i] * d) / C;
        if (T1 > 100 && W[i] > 0) { const E = (T1 - 100) * C, m = Math.min(W[i] * vol[i], E / LATENT); W[i] -= m / vol[i]; T1 = 100 + (E - m * LATENT) / C; }
        T[i] = T1;
      }
      t += d;
    }
  }
  return { T, step, get t() { return t; }, core: () => T[0], surface: () => T[N - 1], flux: () => lastFlux, area: 6 * L * L };
}

// ---------------------------------------------------------------- oil versus air
// Heat-transfer coefficients: frying oil at 160–190 °C gives h ≈ 250–500 W/m²K, more while the
// food is bubbling hard (Farinu & Baik, Food Eng. Rev. 2007; Hubbard & Farkas, J. Food Process Eng. 2000).
export const H_OIL = 350;
// Fat in the finished chips.
//  - Deep-fried: USDA FoodData Central lists restaurant french fries at about 14–15 g fat per 100 g;
//    reviews give 10–15% for chips fried from raw (Zaghi et al., Food Res. Int. 2019).
//  - Air-fried: the fat is only the oil you add. Studies of air-fried potato find a few percent fat,
//    up to about 70–80% less than deep-fried (Teruel et al., Innov. Food Sci. Emerg. Tech. 2015;
//    Andrés et al., Food Bioprocess Technol. 2013).
// Model: 200 g of raw potato loses about 40% of its weight as steam, leaving 120 g of potato.
// Deep frying leaves chips 13% fat. In the air fryer about 80% of the oil you toss them in stays on.
export const RAW_G = 200, COOKED_G = 120, KCAL_RAW = 0.77;   // 77 kcal per 100 g raw potato (USDA #170026)
export function fatModel(mode, oilMl) {
  const potatoKcal = RAW_G * KCAL_RAW;
  let fat;
  if (mode === 'deep') fat = (0.13 * COOKED_G) / (1 - 0.13);
  else fat = oilMl * 0.92 * 0.8;             // oil density 0.92 g/ml
  const total = COOKED_G + fat;
  return { fat, pct: (fat / total) * 100, kcal: potatoKcal + fat * 9, fatKcal: fat * 9, total };
}

// ---------------------------------------------------------------- airflow through the basket
// The fan's pressure falls as it moves more air: Δp = p0 (1 − (Q/Qmax)²), a typical fan curve.
// The air path resists with Δp = K Q². Each layer of chips adds resistance, like a packed bed
// (Ergun: pressure drop grows in step with bed depth). Written in terms of a = K Qmax²/p0.
export const A_EMPTY = 1.0, A_LAYER = 0.55;
export function basketFlow(layers) {
  const q = (a) => Math.sqrt(1 / (1 + a));
  return q(A_EMPTY + A_LAYER * Math.max(0, layers)) / q(A_EMPTY);   // flow as a fraction of an empty basket
}
// How much of a chip's surface meets the moving air, by layer (0 = bottom), in a pile n layers deep.
// Chips on the bottom sit on the mesh; chips on top face the fan; the middle ones touch their
// neighbours on all sides, and in a deep pile the air has mostly cooled and slowed there.
export function exposure(layer, n) {
  if (n <= 1) return 1;
  if (layer === n - 1) return 0.85;
  if (layer === 0) return 0.7;
  return clamp(0.55 - 0.06 * (n - 3), 0.25, 0.55);
}
export const GRAMS_PER_CHIP = 8;             // a 1 × 1 × 7.5 cm chip of potato (1.08 g/cm³)

// ---------------------------------------------------------------- appliances and thermostats
// Lumped thermal models: the cooking space and its metal parts have a heat capacity C (J/K),
// lose heat to a 25 °C kitchen through UA (W/K, walls plus vented air), and a heater of power P
// is switched by a thermostat with a band of ±band °C around the set point.
// The food takes the same energy in every appliance: 500 g of chips warmed to ~95 °C and about
// 175 g of water boiled off ≈ 0.5 × 3.6 × 75 + 0.175 × 2257 ≈ 530 kJ, spread over the cooking time.
// Parameters are typical, not from one model:
//  - air fryer: 1,500 W, C ≈ 1.3 kJ/K (basket, pan, element and air guide), UA ≈ 4.5 W/K,
//    so it preheats to 180 °C in about 3 minutes (makers say 3–5) and cooks chips in about 18;
//  - fan oven: 2,200 W element, 65 L steel cavity, C ≈ 8 kJ/K, UA ≈ 5 W/K: preheats in about 12 minutes,
//    chips take about 25;
//  - deep fryer: 2,000 W, 2.5 L of oil (C ≈ 2.3 kg × 2.0 kJ/kgK + pot ≈ 5.6 kJ/K), UA ≈ 3 W/K,
//    about 8 minutes to reach 180 °C and 8 minutes to fry.
export const FOOD_J = 530e3;
export const APPLIANCES = {
  fryer: { name: 'Air fryer', P: 1500, C: 1300, UA: 4.5, cook: 18 * 60 },
  oven: { name: 'Fan oven', P: 2200, C: 8000, UA: 5.0, cook: 25 * 60 },
  deep: { name: 'Deep fryer', P: 2000, C: 5600, UA: 3.0, cook: 8 * 60 },
};
export const TARIFF = 7;                     // ₹ per kWh, a typical Indian household rate

// Simulate one batch: preheat to the set point, then cook with the food load. 1 s steps.
// band: thermostat hysteresis (±°C). A bimetal disc thermostat swings about ±5–10 °C; an NTC
// sensor with a relay and a microcontroller holds about ±2–3 °C.
export function makeAppliance(kind, { set = 180, band = 5, food = 1, Tamb = 25 } = {}) {
  const ap = APPLIANCES[kind];
  const st = { T: Tamb, on: false, t: 0, phase: 'preheat', cookT: 0, E: 0, onTime: 0, switches: 0 };
  const load = (FOOD_J * food) / ap.cook;
  st.step = () => {
    if (st.phase === 'done') return;
    if (st.T < set - band && !st.on) { st.on = true; st.switches++; }
    if (st.T > set + band) st.on = false;
    if (st.phase === 'preheat' && st.T >= set) st.phase = 'cook';
    const P = st.on ? ap.P : 0;
    const foodW = st.phase === 'cook' ? load : 0;
    st.T += (P - ap.UA * (st.T - Tamb) - foodW) / ap.C;
    st.E += P; if (st.on) st.onTime++;
    if (st.phase === 'cook' && ++st.cookT >= ap.cook) st.phase = 'done';
    st.t++;
  };
  st.kWh = () => st.E / 3.6e6;
  return st;
}
// Run a whole batch to the end and report energy, time and cost.
export function batchEnergy(kind, opts) {
  const a = makeAppliance(kind, opts);
  let preheat = 0;
  while (a.phase !== 'done' && a.t < 4 * 3600) { a.step(); if (a.phase === 'preheat') preheat = a.t; }
  return { kWh: a.kWh(), minutes: a.t / 60, preheat: preheat / 60, cost: a.kWh() * TARIFF };
}
