/* SPDX-License-Identifier: MIT */
// Run with node tests/arsenal.test.js. Pure logic of the v1.0 "Arsenal sobre Rodas" phase, no WebGL.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = {Math, console};
context.window = context;
vm.createContext(context);
for (const file of ['config.js', 'save.js', 'arsenal.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), context, {filename: file});
const BN = context.BN;
let count = 0;
function test(name, fn) { fn(); count++; console.log('OK ' + name); }
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, a + ' vs ' + b);
const W = BN.WEAPONS;

test('three weapons differ in cadence, damage, range, spread, magazine and reload', () => {
  same([...BN.WEAPON_ORDER], ['pistol', 'smg', 'shotgun']);
  const keys = ['cooldown', 'range', 'spread', 'mag', 'reload'];
  for (const key of keys) assert.equal(new Set(BN.WEAPON_ORDER.map(id => W[id][key])).size, 3, key + ' must be distinct');
  assert.equal(new Set(BN.WEAPON_ORDER.map(id => W[id].dmg.ped)).size, 3);
  assert.ok(W.smg.cooldown < W.pistol.cooldown && W.pistol.cooldown < W.shotgun.cooldown);
  assert.ok(W.smg.auto && !W.pistol.auto && !W.shotgun.auto);
  assert.ok(W.shotgun.pellets > 1 && W.shotgun.range < W.pistol.range && W.pistol.range > W.smg.range);
  assert.ok(W.pistol.dmg.ped * W.pistol.pellets >= 55, 'the pistol keeps its v0.6 damage');
});

test('a new loadout owns only the pistol and honours the legacy ammo', () => {
  const l = new BN.Loadout({}, {ammo: 4, reserve: 20});
  same(l.owned, ['pistol']); assert.equal(l.current, 'pistol');
  assert.equal(l.mag().ammo, 4); assert.equal(l.mag().reserve, 20);
  assert.equal(l.cycle(1), null, 'nothing to switch to');
  assert.equal(l.select('smg'), false, 'cannot select an unowned weapon');
});

test('unlocking, cycling and slot selection walk the owned weapons in order', () => {
  const l = new BN.Loadout({}, {});
  assert.equal(l.unlock('shotgun'), true); assert.equal(l.unlock('shotgun'), false); assert.equal(l.unlock('railgun'), false);
  same(l.owned, ['pistol', 'shotgun']);
  assert.equal(l.cycle(1), 'shotgun'); assert.equal(l.cycle(1), 'pistol'); assert.equal(l.cycle(-1), 'shotgun');
  l.unlock('smg'); same(l.owned, ['pistol', 'smg', 'shotgun']);
  assert.equal(l.selectSlot(1), true); assert.equal(l.current, 'smg'); assert.equal(l.selectSlot(7), false);
  assert.equal(l.mags.smg.ammo, W.smg.mag); assert.ok(l.mags.smg.reserve >= W.smg.pack);
});

test('switching blocks the trigger briefly and cancels a reload', () => {
  const l = new BN.Loadout({}, {ammo: 3, reserve: 30}); l.unlock('smg');
  assert.equal(l.startReload(), 'ok'); l.select('smg'); assert.equal(l.reloadT, 0);
  assert.equal(l.canShoot(), false, 'draw time'); l.update(.3); assert.equal(l.canShoot(), true);
});

test('cadence: the smg fires several rounds in the time the shotgun fires one', () => {
  const count = id => { const l = new BN.Loadout({owned: ['pistol', 'smg', 'shotgun'], current: id, mags: {[id]: {ammo: W[id].mag, reserve: 0}}}); let n = 0; for (let t = 0; t < 2; t += 1 / 60) { l.update(1 / 60); if (l.shoot()) n++; } return n; };
  const smg = count('smg'), pistol = count('pistol'), shotgun = count('shotgun');
  assert.ok(smg > pistol && pistol > shotgun, smg + ' ' + pistol + ' ' + shotgun);
  assert.ok(shotgun >= 2 && shotgun <= 3);
});

test('shooting consumes rounds, empties the magazine and reload refills from the reserve', () => {
  const l = new BN.Loadout({}, {ammo: 2, reserve: 5});
  assert.equal(l.shoot(), true); assert.equal(l.shoot(), false, 'cooldown'); l.update(.3); assert.equal(l.shoot(), true);
  l.update(.3); assert.equal(l.mag().ammo, 0); assert.equal(l.canShoot(), false); assert.equal(l.shoot(), false);
  assert.equal(l.startReload(), 'ok'); assert.equal(l.startReload(), 'busy');
  assert.equal(l.update(.5), null); assert.equal(l.update(1), 'reloaded');
  assert.equal(l.mag().ammo, 5); assert.equal(l.mag().reserve, 0);
  assert.equal(l.startReload(), 'empty', 'no reserve left');
  const full = new BN.Loadout({}, {ammo: 12, reserve: 10}); assert.equal(full.startReload(), 'full');
});

test('reload times are per weapon and never over-fill the magazine', () => {
  const l = new BN.Loadout({owned: ['pistol', 'shotgun'], current: 'shotgun', mags: {shotgun: {ammo: 5, reserve: 40}}});
  assert.equal(l.startReload(), 'ok'); assert.equal(l.reloadT, W.shotgun.reload);
  l.update(W.shotgun.reload + .01); assert.equal(l.mag().ammo, 6); assert.equal(l.mag().reserve, 39);
});

test('automatic fire widens the spread and recovers when released', () => {
  const l = new BN.Loadout({owned: ['pistol', 'smg'], current: 'smg', mags: {smg: {ammo: 30, reserve: 90}}});
  const start = l.spread(); for (let i = 0; i < 12; i++) { l.update(.09); l.shoot(); }
  assert.ok(l.spread() > start * 1.4, 'spray opens up'); l.update(2); near(l.spread(), start);
  const pistol = new BN.Loadout({}, {}); pistol.shoot(); assert.equal(pistol.spread(), 0);
});

test('pellets are deterministic, unit length and stay inside the cone', () => {
  const dir = {x: 0, y: 0, z: -1}, spread = W.shotgun.spread;
  const a = BN.fireDirections(W.shotgun, dir, spread, lcg(7)), b = BN.fireDirections(W.shotgun, dir, spread, lcg(7));
  assert.equal(a.length, 7); assert.equal(JSON.stringify(a), JSON.stringify(b));
  near(a[0].z, -1, 1e-9);
  for (const p of a) { near(Math.hypot(p.x, p.y, p.z), 1, 1e-9); assert.ok(Math.acos(Math.min(1, -p.z)) <= spread * 1.01); }
  assert.ok(new Set(a.map(p => p.x.toFixed(4))).size > 3, 'pellets do not collapse');
  const single = BN.fireDirections(W.pistol, dir, 0, lcg(1)); assert.equal(single.length, 1); near(single[0].z, -1, 1e-9);
  const up = BN.fireDirections(W.shotgun, {x: 0, y: 1, z: 0}, spread, lcg(3)); up.forEach(p => near(Math.hypot(p.x, p.y, p.z), 1, 1e-9));
});

test('rayPick returns the nearest visible target inside range', () => {
  const origin = {x: 0, y: 1.3, z: 0}, dir = {x: 0, y: 0, z: -1};
  const list = [{o: {x: 0, z: -30}, kind: 'car', size: 1.4, y: 1}, {o: {x: .3, z: -12}, kind: 'ped', size: .7, y: 1.2}, {o: {x: 5, z: -8}, kind: 'ped', size: .7, y: 1.2}];
  const hit = BN.rayPick(origin, dir, list, 64, () => true);
  assert.equal(hit.hit.kind, 'ped'); near(hit.distance, 12, .1);
  assert.equal(BN.rayPick(origin, dir, list, 10, () => true), null, 'out of range');
  assert.equal(BN.rayPick(origin, dir, list, 64, o => o.z < -20).hit.kind, 'car', 'a wall in front of the ped lets the ray reach the car');
  assert.equal(BN.rayPick(origin, dir, list, 64, () => false), null);
});

test('drive-by muzzle leaves the window on the aimed side and points at the aim point', () => {
  const car = {x: 10, z: 20, heading: 0};
  const right = BN.carMuzzle(car, {x: 40, y: 1.2, z: 22}), left = BN.carMuzzle(car, {x: -20, y: 1.2, z: 22});
  assert.equal(right.side, 1); assert.equal(left.side, -1);
  assert.ok(right.x > car.x && left.x < car.x, 'window side');
  near(Math.hypot(right.x - car.x, right.z - car.z), Math.hypot(.95, .35), 1e-9);
  near(Math.hypot(right.dir.x, right.dir.y, right.dir.z), 1, 1e-9);
  const toward = {x: 40 - right.x, z: 22 - right.z}; near(right.dir.x, toward.x / Math.hypot(toward.x, toward.z, 1.2 - right.y), 1e-9);
  // Rotated 90 degrees: forward becomes +x, right becomes -z.
  const turned = BN.carMuzzle({x: 0, z: 0, heading: Math.PI / 2}, {x: 0, y: 1, z: -30});
  assert.equal(turned.side, 1); assert.ok(turned.z < 0 && turned.x > 0, 'origin follows the heading');
  assert.equal(right.y, 1.15);
});

test('damage zones follow the side that is hit', () => {
  const car = {x: 0, z: 0, heading: 0};
  assert.equal(BN.zoneFromPoint(car, {x: 0, z: 30}), 'front'); assert.equal(BN.zoneFromPoint(car, {x: 0, z: -30}), 'rear');
  assert.equal(BN.zoneFromPoint(car, {x: 30, z: 0}), 'right'); assert.equal(BN.zoneFromPoint(car, {x: -30, z: 1}), 'left');
  const turned = {x: 0, z: 0, heading: Math.PI / 2};
  assert.equal(BN.zoneFromPoint(turned, {x: 30, z: 0}), 'front'); assert.equal(BN.zoneFromPoint(turned, {x: 0, z: 30}), 'left');
  assert.equal(BN.zoneFromVelocity(20, 1), 'front'); assert.equal(BN.zoneFromVelocity(-8, 0), 'rear');
  assert.equal(BN.zoneFromVelocity(5, 12), 'right'); assert.equal(BN.zoneFromVelocity(5, -12), 'left');
});

test('zone damage accumulates, clamps and drives visuals and handling', () => {
  const z = BN.newZones(); same(z, {front: 0, rear: 0, left: 0, right: 0});
  BN.applyZoneDamage(z, 'front', 30); BN.applyZoneDamage(z, 'front', 90); assert.equal(z.front, 100);
  BN.applyZoneDamage(z, 'nonsense', 10); BN.applyZoneDamage(z, 'rear', -5); assert.equal(z.rear, 0);
  same([0, 24, 25, 59, 60, 100].map(BN.dentLevel), [0, 0, 1, 1, 2, 2]);
  const clean = BN.zoneEffects(BN.newZones()); near(clean.topMul, 1); near(clean.accelMul, 1); near(clean.gripMul, 1); near(clean.pull, 0);
  const front = BN.zoneEffects({front: 100, rear: 0, left: 0, right: 0}); near(front.topMul, .65); near(front.accelMul, 1);
  const rear = BN.zoneEffects({front: 0, rear: 100, left: 0, right: 0}); near(rear.accelMul, .7); near(rear.topMul, 1);
  const right = BN.zoneEffects({front: 0, rear: 0, left: 0, right: 80}), left = BN.zoneEffects({front: 0, rear: 0, left: 80, right: 0});
  assert.ok(right.pull > 0 && left.pull < 0 && right.gripMul < 1); near(right.pull, -left.pull);
});

const rollStats = {lat: 13, impact: 16};
test('a brief drift does not roll the car, a sustained fast slide does', () => {
  const brief = new BN.Rollover(); let started = false;
  for (let i = 0; i < 12; i++) started = brief.assess(1 / 60, {speed: 25, lat: 14, impact: 0, impactSide: false}, rollStats) || started;
  assert.equal(started, false); assert.equal(brief.active, false);
  for (let i = 0; i < 30; i++) brief.assess(1 / 60, {speed: 25, lat: 3, impact: 0, impactSide: false}, rollStats);
  const held = new BN.Rollover(); started = false;
  for (let i = 0; i < 40 && !started; i++) started = held.assess(1 / 60, {speed: 25, lat: 14, impact: 0, impactSide: false}, rollStats);
  assert.equal(started, true); assert.equal(held.state, 'rolling'); assert.equal(held.dir, 1);
});

test('slow, low-slip and cooling-down cars never roll', () => {
  const r = new BN.Rollover();
  for (let i = 0; i < 120; i++) assert.equal(r.assess(1 / 60, {speed: 8, lat: 16, impact: 0, impactSide: false}, rollStats), false, 'too slow');
  for (let i = 0; i < 120; i++) assert.equal(r.assess(1 / 60, {speed: 35, lat: 13.5, impact: 0, impactSide: false}, rollStats), false, 'small slip angle');
  assert.equal(r.assess(1 / 60, {speed: 20, lat: 2, impact: 20, impactSide: false}, rollStats), false, 'front and rear impacts do not roll');
});

test('a hard side impact rolls the car toward the push, and strength picks the flip', () => {
  const mild = new BN.Rollover(); assert.equal(mild.assess(1 / 60, {speed: 6, lat: -9, impact: 17, impactSide: true}, rollStats), true);
  assert.equal(mild.dir, -1); assert.equal(mild.full, false);
  const soft = new BN.Rollover(); assert.equal(soft.assess(1 / 60, {speed: 6, lat: -4, impact: 12, impactSide: true}, rollStats), false, 'below the impact threshold');
  const hard = new BN.Rollover(); assert.equal(hard.assess(1 / 60, {speed: 20, lat: 14, impact: 30, impactSide: true}, rollStats), true); assert.equal(hard.full, true);
});

test('a half roll tilts, holds, recovers and unlocks the controls', () => {
  const r = new BN.Rollover(); r.begin(1, 1.1); const seen = {locked: 0, free: 0}; let max = 0, finished = false, lift = 0, t = 0;
  while (t < 4 && !finished) { const s = r.update(1 / 60); max = Math.max(max, Math.abs(s.angle)); lift = Math.max(lift, s.lift); if (s.locked) seen.locked++; else seen.free++; finished = s.finished; t += 1 / 60; }
  near(max, Math.PI / 2, 1e-6); assert.ok(lift > .4); assert.equal(finished, true); assert.equal(r.angle, 0); assert.equal(r.active, false);
  assert.ok(seen.locked > 100, 'controls stay locked while the car is down'); assert.ok(t > 1.9 && t < 3, 'total time ' + t);
  assert.equal(r.assess(1 / 60, {speed: 30, lat: 20, impact: 0, impactSide: false}, rollStats), false, 'cooldown after the recovery');
});

test('a full flip turns through 360 degrees and lands on the wheels', () => {
  const r = new BN.Rollover(); r.begin(-1, 2); let min = 0, finished = false, t = 0, mid = 0;
  while (t < 4 && !finished) { const s = r.update(1 / 60); min = Math.min(min, s.angle); if (Math.abs(t - .5) < .01) mid = s.angle; finished = s.finished; t += 1 / 60; }
  assert.ok(min < -Math.PI * 1.5, 'min ' + min); assert.ok(mid < -1, 'mid-air angle'); assert.equal(finished, true); assert.equal(r.angle, 0);
});

test('rollover is repeatable after the cooldown and resets cleanly', () => {
  const r = new BN.Rollover(); r.begin(1, 1.2); for (let i = 0; i < 300; i++) r.update(1 / 60);
  assert.equal(r.active, false); for (let i = 0; i < 200; i++) r.assess(1 / 60, {speed: 0, lat: 0, impact: 0}, rollStats);
  assert.equal(r.assess(1 / 60, {speed: 6, lat: 9, impact: 20, impactSide: true}, rollStats), true);
  r.reset(); assert.equal(r.active, false); assert.equal(r.angle, 0); assert.equal(r.locked, false);
});

test('save keeps schema 2, migrates old saves additively and sanitizes the arsenal', () => {
  const cat = {vehicles: ['compact', 'sedan', 'sport'], upgrades: ['brakes', 'tires', 'cargo'], campaignIds: [], weapons: ['pistol', 'smg', 'shotgun']};
  const old = BN.Save.normalize({ammo: 5, reserve: 77, balance: 10}, cat);
  assert.equal(old.schemaVersion, 2); same(old.arsenal.owned, ['pistol']); assert.equal(old.arsenal.mags.pistol.ammo, 5); assert.equal(old.arsenal.mags.pistol.reserve, 77);
  assert.equal(new BN.Loadout(old.arsenal, {ammo: old.ammo, reserve: old.reserve}).mag().reserve, 77);
  const dirty = BN.Save.normalize({arsenal: {owned: ['smg', 'laser'], current: 'laser', mags: {smg: {ammo: 'x', reserve: 9999}}}}, cat);
  same(dirty.arsenal.owned, ['pistol', 'smg']); assert.equal(dirty.arsenal.current, 'pistol'); assert.equal(dirty.arsenal.mags.smg.reserve, 300);
  const l = new BN.Loadout(dirty.arsenal); assert.equal(l.mags.smg.ammo, 0); assert.equal(l.mags.shotgun.ammo, 0); l.unlock('shotgun'); assert.equal(l.mags.shotgun.ammo, W.shotgun.mag, 'purchase hands over a full magazine');
  const l2 = new BN.Loadout({owned: ['pistol', 'smg'], current: 'smg', mags: {smg: {ammo: 11, reserve: 40}}}), back = new BN.Loadout(l2.serialize());
  same(back.serialize(), l2.serialize());
  assert.equal(JSON.parse(BN.Save.exportProgress(old, {})).progress.arsenal.owned[0], 'pistol');
});

console.log(count + ' arsenal checks passed.');
