/* SPDX-License-Identifier: MIT */
// v1.0 "Arsenal sobre Rodas": pure logic with no WebGL dependency, so every mechanism can be tested in Node.
// Weapons and loadout, drive-by muzzle, localized vehicle damage and the arcade rollover.
(function () {
  'use strict';
  const BN = window.BN = window.BN || {};
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- Weapons
  // dmg is per projectile: ped (people and officers on foot), car (vehicles), cop (patrol cars).
  const WEAPONS = Object.freeze({
    pistol: Object.freeze({id: 'pistol', name: 'PISTOLA', mag: 12, reserveMax: 240, cooldown: .26, reload: 1.3, pellets: 1, spread: 0, heat: 0, range: 64, auto: false,
      dmg: Object.freeze({ped: 55, car: 13, cop: 9}), noise: 45, shake: .05, rumble: [.3, .5, 70], sfx: [[170, .07, 'square', .32], [85, .14, 'sawtooth', .3]], price: 0, pack: 12, packPrice: 30}),
    smg: Object.freeze({id: 'smg', name: 'SUBMETRALHADORA', mag: 30, reserveMax: 300, cooldown: .085, reload: 1.9, pellets: 1, spread: .035, heat: .22, range: 52, auto: true,
      dmg: Object.freeze({ped: 20, car: 6, cop: 4}), noise: 60, shake: .09, rumble: [.2, .7, 40], sfx: [[230, .04, 'square', .26], [120, .06, 'sawtooth', .2]], price: 450, pack: 30, packPrice: 60}),
    shotgun: Object.freeze({id: 'shotgun', name: 'ESPINGARDA', mag: 6, reserveMax: 48, cooldown: .85, reload: 2.3, pellets: 7, spread: .09, heat: 0, range: 30, auto: false,
      dmg: Object.freeze({ped: 16, car: 4, cop: 3}), noise: 75, shake: .28, rumble: [.9, .6, 140], sfx: [[110, .16, 'sawtooth', .4], [60, .22, 'square', .34]], price: 650, pack: 8, packPrice: 70})
  });
  const WEAPON_ORDER = Object.freeze(['pistol', 'smg', 'shotgun']);

  // Inventory, magazines and timers. Cooldown, reload and spread heat live here so they can be tested without the game loop.
  class Loadout {
    constructor(saved = {}, legacy = {}) {
      const src = saved && typeof saved === 'object' ? saved : {};
      this.owned = WEAPON_ORDER.filter(id => id === 'pistol' || (Array.isArray(src.owned) && src.owned.includes(id)));
      this.mags = {};
      for (const id of WEAPON_ORDER) {
        const def = WEAPONS[id], m = (src.mags && src.mags[id]) || (id === 'pistol' ? legacy : {}) || {};
        const ammo = Number(m.ammo), reserve = Number(m.reserve);
        this.mags[id] = {
          ammo: Number.isFinite(ammo) ? clamp(Math.floor(ammo), 0, def.mag) : def.mag,
          reserve: Number.isFinite(reserve) ? clamp(Math.floor(reserve), 0, def.reserveMax) : (id === 'pistol' ? 36 : 0)
        };
      }
      this.current = this.owned.includes(src.current) ? src.current : 'pistol';
      this.cooldown = 0; this.reloadT = 0; this.heat = 0;
    }
    def() { return WEAPONS[this.current]; }
    mag() { return this.mags[this.current]; }
    has(id) { return this.owned.includes(id); }
    unlock(id) {
      if (!WEAPONS[id] || this.has(id)) return false;
      this.owned = WEAPON_ORDER.filter(w => this.has(w) || w === id);
      this.mags[id].ammo = WEAPONS[id].mag; this.mags[id].reserve = Math.max(this.mags[id].reserve, WEAPONS[id].pack);
      return true;
    }
    select(id) {
      if (!this.has(id) || id === this.current) return false;
      this.current = id; this.cooldown = Math.max(this.cooldown, .25); this.reloadT = 0; this.heat = 0; return true;
    }
    // dir = +1 next, -1 previous. Returns the new weapon id, or null when there is nothing to switch to.
    cycle(dir) {
      if (this.owned.length < 2) return null;
      const i = this.owned.indexOf(this.current), n = this.owned.length;
      const id = this.owned[(i + (dir < 0 ? -1 : 1) + n) % n];
      return this.select(id) ? id : null;
    }
    selectSlot(slot) { const id = this.owned[slot]; return id ? this.select(id) : false; }
    canShoot() { return this.cooldown <= 0 && this.reloadT <= 0 && this.mag().ammo > 0; }
    // Consumes one round and starts the cooldown. Returns false when the weapon cannot fire.
    shoot() {
      if (!this.canShoot()) return false;
      const def = this.def();
      this.mag().ammo--; this.cooldown = def.cooldown; this.heat = clamp(this.heat + def.heat, 0, 1.5);
      return true;
    }
    // Spread in radians, widening while an automatic weapon keeps firing.
    spread() { return this.def().spread * (1 + this.heat * 1.6); }
    // 'ok' starts a reload; any other value tells the caller why it did not.
    startReload() {
      const m = this.mag(), def = this.def();
      if (this.reloadT > 0) return 'busy';
      if (m.ammo >= def.mag) return 'full';
      if (m.reserve <= 0) return 'empty';
      this.reloadT = def.reload; return 'ok';
    }
    // Returns 'reloaded' on the tick that a reload completes.
    update(dt) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.heat = Math.max(0, this.heat - dt * .9);
      if (this.reloadT > 0) {
        this.reloadT -= dt;
        if (this.reloadT <= 0) {
          const m = this.mag(), n = Math.min(this.def().mag - m.ammo, m.reserve);
          m.ammo += n; m.reserve -= n; this.reloadT = 0; return 'reloaded';
        }
      }
      return null;
    }
    addReserve(id, rounds) {
      if (!this.has(id)) return 0;
      const m = this.mags[id], before = m.reserve; m.reserve = Math.min(WEAPONS[id].reserveMax, m.reserve + rounds); return m.reserve - before;
    }
    stripReserves() { for (const id of WEAPON_ORDER) this.mags[id].reserve = 0; }
    serialize() {
      const mags = {}; for (const id of WEAPON_ORDER) mags[id] = {ammo: this.mags[id].ammo, reserve: this.mags[id].reserve};
      return {owned: [...this.owned], current: this.current, mags};
    }
  }

  // Unit vectors for every projectile of one trigger pull. dir must be normalized; rnd returns [0,1).
  function fireDirections(def, dir, spread, rnd) {
    const out = [];
    // Any vector not parallel to dir builds a perpendicular basis for the cone.
    const up = Math.abs(dir.y) > .95 ? {x: 1, y: 0, z: 0} : {x: 0, y: 1, z: 0};
    let ux = dir.y * up.z - dir.z * up.y, uy = dir.z * up.x - dir.x * up.z, uz = dir.x * up.y - dir.y * up.x;
    const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const vx = dir.y * uz - dir.z * uy, vy = dir.z * ux - dir.x * uz, vz = dir.x * uy - dir.y * ux;
    for (let i = 0; i < def.pellets; i++) {
      // The first pellet of a multi-pellet load stays on the aim point, the others fill the cone.
      const centered = def.pellets > 1 && i === 0;
      const a = rnd() * TAU, r = centered || spread <= 0 ? 0 : Math.sqrt(rnd()) * spread;
      const sx = Math.cos(a) * r, sy = Math.sin(a) * r;
      let x = dir.x + ux * sx + vx * sy, y = dir.y + uy * sx + vy * sy, z = dir.z + uz * sx + vz * sy;
      const l = Math.hypot(x, y, z) || 1; out.push({x: x / l, y: y / l, z: z / l});
    }
    return out;
  }

  // Closest candidate along a ray. candidates: {o:{x,z}, kind, size, y}. visible(o) is the line-of-sight check.
  function rayPick(origin, dir, candidates, maxDist, visible) {
    let best = null, bestD = maxDist;
    for (const c of candidates) {
      const dx = c.o.x - origin.x, dy = c.y - origin.y, dz = c.o.z - origin.z;
      const along = dx * dir.x + dy * dir.y + dz * dir.z;
      if (along < 1 || along >= bestD) continue;
      const px = dx - dir.x * along, py = dy - dir.y * along, pz = dz - dir.z * along;
      if (px * px + py * py + pz * pz > c.size * c.size) continue;
      if (visible && !visible(c.o)) continue;
      best = c; bestD = along;
    }
    return best ? {hit: best, distance: bestD} : null;
  }

  // Drive-by muzzle: leaves from the window on the side the aim point is on, at the height of a door.
  // Heading follows the game convention: forward = (sin h, cos h), right = (cos h, -sin h).
  function carMuzzle(car, aim) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading), rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
    const ax = aim.x - car.x, az = aim.z - car.z;
    const side = ax * rx + az * rz >= 0 ? 1 : -1;
    const x = car.x + rx * side * .95 + fx * .35, z = car.z + rz * side * .95 + fz * .35, y = 1.15;
    const dx = aim.x - x, dy = (aim.y === undefined ? 1.3 : aim.y) - y, dz = aim.z - z, l = Math.hypot(dx, dy, dz) || 1;
    return {x, y, z, side, dir: {x: dx / l, y: dy / l, z: dz / l}};
  }

  // ---------------------------------------------------------------- Localized vehicle damage
  const ZONES = Object.freeze(['front', 'rear', 'left', 'right']);
  const newZones = () => ({front: 0, rear: 0, left: 0, right: 0});
  // Which zone a point (shooter, obstacle) strikes. A car is about 4.2 long and 2 wide.
  function zoneFromPoint(car, p) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading), rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
    const dx = p.x - car.x, dz = p.z - car.z, along = dx * fx + dz * fz, across = dx * rx + dz * rz;
    if (Math.abs(along) / 2.1 >= Math.abs(across)) return along >= 0 ? 'front' : 'rear';
    return across >= 0 ? 'right' : 'left';
  }
  // Which zone takes a crash from the car's own velocity (speed forward, lat to the right).
  function zoneFromVelocity(speed, lat) {
    if (Math.abs(lat) > Math.abs(speed) * .7) return lat >= 0 ? 'right' : 'left';
    return speed >= 0 ? 'front' : 'rear';
  }
  function applyZoneDamage(zones, zone, amount) {
    if (!(zone in zones) || !(amount > 0)) return zones[zone] || 0;
    zones[zone] = clamp(zones[zone] + amount, 0, 100); return zones[zone];
  }
  // Functional cost: front hurts top speed, rear hurts traction (acceleration), sides pull the car and cost grip.
  function zoneEffects(zones) {
    const z = zones || newZones();
    return {
      topMul: 1 - .35 * z.front / 100,
      accelMul: 1 - .3 * z.rear / 100,
      gripMul: 1 - .2 * (z.left + z.right) / 200,
      pull: (z.right - z.left) / 100 * 1.6
    };
  }
  // Visual dent level of a zone: 0 clean, 1 dented, 2 crumpled.
  const dentLevel = value => value >= 60 ? 2 : value >= 25 ? 1 : 0;

  // ---------------------------------------------------------------- Arcade rollover
  // Sustained sideways slide, or a hard side impact, flips the car. No physics engine: a scripted angle.
  const ROLL_DEFAULT = Object.freeze({lat: 13, impact: 16});
  class Rollover {
    constructor() { this.reset(); }
    reset() { this.state = 'idle'; this.angle = 0; this.t = 0; this.dir = 1; this.peak = 0; this.dur = 1; this.risk = 0; this.cooldown = 0; this.power = 0; }
    get active() { return this.state !== 'idle'; }
    // Controls stay locked until the car is mostly upright again.
    get locked() { return this.state === 'rolling' || this.state === 'settled' || (this.state === 'recover' && this.t < .7); }
    // Returns true on the tick the rollover begins. stats = [lateral speed, side impact] thresholds.
    assess(dt, s, stats = ROLL_DEFAULT) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      if (this.state !== 'idle' || this.cooldown > 0) { this.risk = 0; return false; }
      const lat = stats.lat !== undefined ? stats.lat : stats[0], impactLimit = stats.impact !== undefined ? stats.impact : stats[1];
      const speed = Math.abs(s.speed), slide = Math.abs(s.lat), slip = Math.atan2(slide, speed + .001);
      // Slide: fast enough, sideways enough (slip angle) and kept up for a moment.
      if (speed >= 14 && slide >= lat && slip >= .5) this.risk += dt; else this.risk = Math.max(0, this.risk - dt * 2);
      const hardHit = s.impactSide && s.impact >= impactLimit && speed + slide >= 10;
      if (this.risk >= .3 || hardHit) {
        const power = Math.max(slide / lat, (s.impact || 0) / impactLimit);
        this.begin(s.lat !== 0 ? Math.sign(s.lat) : 1, power); return true;
      }
      return false;
    }
    begin(dir, power) {
      this.state = 'rolling'; this.t = 0; this.dir = dir < 0 ? -1 : 1; this.power = power; this.risk = 0;
      // Strong events turn the car all the way over and land it on its wheels, mild ones leave it on its side.
      this.full = power >= 1.6; this.peak = this.full ? TAU : Math.PI / 2; this.dur = this.full ? 1 : .6;
    }
    // Advances the animation. angle is signed by direction, lift raises the body while it turns.
    update(dt) {
      let finished = false;
      if (this.state === 'rolling') {
        this.t += dt; const k = clamp(this.t / this.dur, 0, 1), eased = 1 - (1 - k) * (1 - k);
        this.angle = this.dir * this.peak * eased;
        if (k >= 1) { this.state = 'settled'; this.t = 0; if (this.full) this.angle = 0; }
      } else if (this.state === 'settled') {
        this.t += dt;
        if (this.t >= (this.full ? .35 : .8)) { this.state = 'recover'; this.t = 0; }
      } else if (this.state === 'recover') {
        this.t += dt; const k = clamp(this.t / .9, 0, 1);
        if (!this.full) this.angle = this.dir * this.peak * (1 - k * k * (3 - 2 * k));
        if (k >= 1) { this.angle = 0; this.state = 'idle'; this.cooldown = 2.5; finished = true; }
      }
      return {angle: this.angle, lift: Math.abs(Math.sin(this.angle)) * .55, locked: this.locked, finished};
    }
  }

  Object.assign(BN, {WEAPONS, WEAPON_ORDER, Loadout, fireDirections, rayPick, carMuzzle, ZONES, newZones, zoneFromPoint, zoneFromVelocity, applyZoneDamage, zoneEffects, dentLevel, Rollover, ROLL_DEFAULT});
})();
