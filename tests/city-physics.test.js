/* SPDX-License-Identifier: MIT */
// Run with node tests/city-physics.test.js. Pure logic of the v1.0 "Cidade Física" phase, no WebGL.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = {Math, console};
context.window = context;
vm.createContext(context);
for (const file of ['config.js', 'navigation.js', 'city-systems.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), context, {filename: file});
const BN = context.BN;
const roads = [-240, -160, -80, 0, 80, 160, 240];
let count = 0;
function test(name, fn) { fn(); count++; console.log('OK ' + name); }
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, a + ' vs ' + b);

// ---- gamepad ----
function fakePad(overrides = {}) {
  const buttons = Array.from({length: 17}, () => ({pressed: false, value: 0}));
  return Object.assign({index: 0, id: 'Test Pad', connected: true, axes: [0, 0, 0, 0], buttons}, overrides);
}
test('radial dead zone ignores drift, keeps direction and never exceeds 1', () => {
  same(BN.radialDeadzone(.1, .1, .18), {x: 0, y: 0});
  const out = BN.radialDeadzone(.5, 0, .2);
  near(out.x, .3 / .8); near(out.y, 0);
  const diagonal = BN.radialDeadzone(1, 1, .18);
  assert.ok(Math.hypot(diagonal.x, diagonal.y) <= 1 + 1e-9);
  near(diagonal.x, diagonal.y);
  near(BN.axisDeadzone(.05, .1), 0); near(BN.axisDeadzone(-1, .1), -1);
});
test('gamepad polling reads sticks, triggers, edges and honours configurable dead zones', () => {
  const pad = fakePad(), events = [];
  const input = new BN.GamepadInput({getGamepads: () => [pad], onChange: (kind, id) => events.push(kind + ':' + id)});
  let s = input.poll();
  assert.equal(s.connected, true); same(events, ['connected:Test Pad']); assert.equal(s.active, false);
  pad.axes = [.12, -.1, 0, 0]; s = input.poll();
  same(s.move, {x: 0, y: 0}, 'drift inside the default dead zone');
  input.configure({stickDead: .05}); s = input.poll();
  assert.ok(s.move.x > 0 && s.move.y < 0);
  pad.axes = [0, 0, 1, 0]; pad.buttons[7] = {pressed: true, value: .8}; pad.buttons[0] = {pressed: true, value: 1}; s = input.poll();
  assert.ok(s.look.x > .9); assert.ok(s.throttle > .7); assert.equal(s.pressed.interact, true); assert.equal(s.active, true);
  s = input.poll(); assert.equal(s.pressed.interact, undefined, 'a held button is not a new press'); assert.equal(s.down.interact, true);
  pad.buttons[0] = {pressed: false, value: 0}; s = input.poll(); assert.equal(s.released.interact, true);
  assert.ok(input.configure({lookSpeed: 99}).lookSpeed <= 6);
});
test('gamepad hot-plug connects, disconnects and switches to another pad without events', () => {
  let list = [], events = [];
  const input = new BN.GamepadInput({getGamepads: () => list, onChange: (kind, id) => events.push(kind + ':' + id)});
  assert.equal(input.poll().connected, false); same(events, []);
  const a = fakePad({index: 1, id: 'A'}); list = [null, a]; input.poll();
  list = [null, Object.assign(a, {connected: false})]; assert.equal(input.poll().connected, false);
  const b = fakePad({index: 0, id: 'B'}); list = [b]; assert.equal(input.poll().id, 'B');
  same(events, ['connected:A', 'disconnected:A', 'connected:B']);
  list = () => { throw new Error('blocked'); }; const failing = new BN.GamepadInput({getGamepads: list}); assert.equal(failing.poll().connected, false);
});
test('vibration uses playEffect, falls back to haptics and fails silently', () => {
  const played = [];
  const pad = fakePad({vibrationActuator: {type: 'dual-rumble', playEffect: (type, params) => { played.push(params); return Promise.resolve(); }}});
  const input = new BN.GamepadInput({getGamepads: () => [pad]}); input.poll();
  assert.equal(input.rumble(2, .5, 5000, 1000), true);
  assert.equal(played[0].duration, 600); assert.equal(played[0].strongMagnitude, 1);
  assert.equal(input.rumble(1, 1, 100, 1010), false, 'rate limited');
  const pulses = []; const old = fakePad({hapticActuators: [{pulse: (v, ms) => { pulses.push([v, ms]); return Promise.resolve(); }}]});
  const legacy = new BN.GamepadInput({getGamepads: () => [old]}); legacy.poll(); assert.equal(legacy.rumble(.6, .2, 90, 5000), true); same(pulses[0], [.6, 90]);
  const bare = new BN.GamepadInput({getGamepads: () => [fakePad()]}); bare.poll(); assert.equal(bare.rumble(1, 1, 100, 5000), false);
  const broken = new BN.GamepadInput({getGamepads: () => [fakePad({vibrationActuator: {playEffect() { throw new Error('revoked'); }}})]}); broken.poll(); assert.equal(broken.rumble(1, 1, 100, 5000), false);
  input.configure({vibration: false}); assert.equal(input.rumble(1, 1, 100, 9000), false);
});
test('prompts adapt to the last input device', () => {
  const changes = [], mode = new BN.InputMode(m => changes.push(m));
  assert.equal(mode.note('keyboard'), false); assert.equal(mode.note('gamepad'), true); assert.equal(mode.note('gamepad'), false); mode.note('touch'); mode.note('bogus');
  same(changes, ['gamepad', 'touch']);
  assert.ok(BN.Prompts.hintsHtml('keyboard').includes('<kbd>E</kbd>'));
  assert.ok(BN.Prompts.hintsHtml('gamepad').includes('<kbd>RT</kbd>') && !BN.Prompts.hintsHtml('gamepad').includes('<kbd>WASD</kbd>'));
  assert.ok(BN.Prompts.hintsHtml('touch').includes('INTERAGIR'));
  assert.equal(BN.Prompts.localize('E para entrar no carro', 'keyboard'), 'E para entrar no carro');
  assert.equal(BN.Prompts.localize('E para entrar no carro', 'gamepad'), 'A para entrar no carro');
  assert.equal(BN.Prompts.localize('E para entrar no carro', 'touch'), 'Toque INTERAGIR para entrar no carro');
  assert.equal(BN.Prompts.localize('ENTER para abrir a oficina', 'gamepad'), 'A para abrir a oficina');
});

// ---- one-way streets ----
const streets = new BN.Streets(roads, BN.CONFIG.oneWay);
test('one-way graph is directed, keeps two-way avenues and stays strongly connected', () => {
  assert.equal(streets.stronglyConnected(), true);
  const i = roads.indexOf(-160), j = roads.indexOf(0);
  assert.equal(streets.allowed(streets.node(i, j), streets.node(i, j + 1)), true, 'x=-160 runs towards +z');
  assert.equal(streets.allowed(streets.node(i, j + 1), streets.node(i, j)), false, 'and not back');
  const k = roads.indexOf(0);
  assert.equal(streets.allowed(streets.node(k, j), streets.node(k, j + 1)) && streets.allowed(streets.node(k, j + 1), streets.node(k, j)), true, 'x=0 is two-way');
  const flat = new BN.Streets(roads, {}); assert.equal(flat.neighbours(3, 3).length, 4);
  assert.ok(streets.neighbours(i, j).length < 4);
});
test('traffic navigation only ever takes legal moves and prefers the right lane', () => {
  const rng = lcg(7);
  for (let car = 0; car < 14; car++) {
    const nav = streets.spawnNav(car, rng);
    for (let step = 0; step < 400; step++) {
      assert.ok(streets.allowed(nav.prev, nav.cur), 'illegal move ' + JSON.stringify([nav.prev, nav.cur]));
      assert.ok(streets.allowed(nav.cur, nav.next));
      const w = nav.waypoint; assert.ok(Number.isFinite(w.x) && Number.isFinite(w.z));
      assert.ok(Math.abs(w.x - nav.cur.x) <= 2.61 && Math.abs(w.z - nav.cur.z) <= 2.61);
      streets.advance(nav, rng);
    }
  }
  const east = streets.waypoint({x: -80, z: 0}, {x: 0, z: 0}, {x: 80, z: 0}); near(east.z, 2.6); near(east.x, 0);
  const southThenEast = streets.waypoint({x: 0, z: -80}, {x: 0, z: 0}, {x: 80, z: 0}); near(southThenEast.x, -2.6); near(southThenEast.z, 2.6);
});
test('directed routes obey one-way streets for 300 random pairs and match the old route when two-way', () => {
  const rng = lcg(99), bounds = () => -250 + rng() * 500;
  for (let n = 0; n < 300; n++) {
    const a = {x: bounds(), z: bounds()}, b = {x: bounds(), z: bounds()};
    const points = streets.route(a, b);
    assert.ok(points.length >= 2, 'no route for ' + JSON.stringify([a, b]));
    assert.ok(streets.routeIsLegal(points), 'illegal route ' + JSON.stringify(points));
  }
  const flat = new BN.Streets(roads, {}), p = flat.route({x: 25, z: 31}, {x: 247, z: -193});
  assert.ok(flat.routeIsLegal(p)); assert.ok(p.length >= 3);
  const nav = BN.Navigation.route({x: 25, z: 31}, {x: 247, z: -193}, roads, streets); assert.ok(streets.routeIsLegal(nav));
  // Destination one block against a one-way street needs a detour, never a reverse leg.
  const against = streets.route({x: -160, z: 40}, {x: -160, z: -40}); assert.ok(streets.routeIsLegal(against)); assert.ok(against.length > 2);
  const along = streets.route({x: -160, z: -40}, {x: -160, z: 40}); assert.ok(along.every(p => p.x === -160), 'goes straight along the one-way street');
});
test('wrong-way detection only fires mid-block against a one-way street', () => {
  assert.equal(streets.isWrongWay(-160, 40, Math.PI), true, 'heading -z on a +z street');
  assert.equal(streets.isWrongWay(-160, 40, 0), false);
  assert.equal(streets.isWrongWay(0, 40, Math.PI), false, 'two-way avenue');
  assert.equal(streets.isWrongWay(-160, 80, Math.PI), false, 'crossing');
  assert.equal(streets.isWrongWay(40, -160, -Math.PI / 2), true, 'heading -x on a +x street');
});

// ---- fixtures ----
test('lamp posts and signals are solid at low speed, fall when hit fast and stop blocking', () => {
  const reg = new BN.FixtureRegistry({restoreAfter: 10, fallTime: .5});
  const lamp = reg.add(10.5, 11, 'lamp'), signal = reg.add(-9.8, 9.5, 'signal');
  assert.equal(reg.blocked(10.5, 11, .5), true); assert.equal(reg.blocked(14, 11, .5), false);
  same(reg.impact(10, 11, 1.2, 3, 1, 0), [], 'slow contact keeps the post standing');
  assert.equal(lamp.state, 'up');
  const hit = reg.impact(9.4, 11, 1.2, 12, 1, 0);
  assert.equal(hit.length, 1); assert.equal(lamp.state, 'falling'); near(lamp.dirX, 1);
  assert.equal(reg.blocked(10.5, 11, .5), false, 'a falling post no longer blocks');
  assert.equal(reg.blocked(-9.8, 9.5, .5), true);
  reg.update(.25); assert.ok(reg.angle(lamp) > 0 && reg.angle(lamp) < 1.52);
  reg.update(.5); assert.equal(lamp.state, 'down'); near(reg.angle(lamp), 1.52);
  assert.equal(reg.impact(10.5, 11, 1.2, 20, 1, 0).length, 0, 'fallen posts cannot fall twice');
  reg.update(11, {x: 10.5, z: 11}); assert.equal(lamp.state, 'down', 'not restored while the player stands next to it');
  reg.update(1, {x: 200, z: 200}); assert.equal(lamp.state, 'up'); assert.equal(reg.blocked(10.5, 11, .5), true);
  assert.equal(reg.count('up'), 2);
  assert.ok(signal.breakSpeed > 0 && signal.damage > 0);
});

// ---- soft crowd contact ----
test('pedestrians are shoved aside and the walker is never pinned', () => {
  const player = {x: 0, z: 0}, peds = Array.from({length: 24}, (_, i) => ({id: i, x: 1.5 + (i % 6) * .45, z: -1 + Math.floor(i / 6) * .5, dead: false, down: 0}));
  const open = () => true;
  let progress = 0;
  for (let step = 0; step < 120; step++) {
    const before = player.x; player.x += .12; BN.softPush(player, peds, {canMove: open});
    progress += player.x - before;
  }
  assert.ok(progress > 120 * .12 * .7, 'walker kept at least 70% of its speed: ' + progress);
  assert.ok(peds.some(p => p.shoved > 0));
  assert.ok(peds.every(p => Math.hypot(p.x - player.x, p.z - player.z) > .5 || p.x < player.x + .1), 'pedestrians ended outside the body');
});
test('soft contact slides pedestrians along walls and ignores the dead', () => {
  const player = {x: 0, z: 0}, wall = (x, z) => x > .65, ped = {id: 1, x: .6, z: 0, dead: false, down: 0}, corpse = {id: 2, x: .2, z: 0, dead: true, down: 0};
  const touched = BN.softPush(player, [ped, corpse], {canMove: (x, z) => !wall(x, z)});
  assert.equal(touched, 1); assert.ok(ped.x <= .65, 'never pushed into the wall'); assert.ok(Math.abs(ped.z) > 0, 'slid sideways'); assert.equal(corpse.x, .2);
  const pinned = {x: 0, z: 0}, boxed = {id: 3, x: .3, z: 0, dead: false, down: 0};
  BN.softPush(pinned, [boxed], {canMove: () => false}); assert.equal(pinned.x, 0);
  const same = {x: 5, z: 5}, twin = {id: 4, x: 5, z: 5, dead: false, down: 0}; BN.softPush(same, [twin], {canMove: () => true}); assert.ok(twin.x !== 5 || twin.z !== 5);
});

// ---- roadblocks ----
function blockWorld(buildings = [], freeze = false) {
  const solids = [];
  return {roads, dynamicSolids: solids, buildings, isBlocked(x, z, r) {
    if (Math.abs(x) > 290 || Math.abs(z) > 290) return true;
    if (buildings.some(b => x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ)) return true;
    return solids.some(q => (x - q.x) ** 2 + (z - q.z) ** 2 < (r + q.r) ** 2);
  }};
}
function passable(world, plan, radius) {
  // A car of the given radius can pass through the gap between the two cruisers.
  const offsets = []; for (let o = -plan.gap; o <= plan.gap; o += .1) offsets.push(o);
  return offsets.some(o => !world.isBlocked(plan.vertical ? plan.x + o : plan.x, plan.vertical ? plan.z : plan.z + o, radius));
}
test('roadblock is planned on open asphalt ahead, mid-block, clear of buildings and passable', () => {
  const world = blockWorld([{minX: -150, maxX: -90, minZ: 100, maxZ: 140}]);
  const plan = BN.planRoadblock(world, {x: 0, z: 0}, {x: 0, z: 1});
  assert.ok(plan, 'a plan exists'); assert.equal(plan.vertical, true); assert.equal(plan.x, 0); assert.ok(plan.z >= 80 && plan.z <= 170);
  assert.ok(roads.every(r => Math.abs(plan.z - r) >= 18), 'not at a crossing');
  for (const car of plan.cars) assert.ok(Math.abs(car.x - plan.x) <= 7, 'inside the roadway width');
  for (const q of plan.cars) assert.equal(world.isBlocked(q.x, q.z, 1.0), false);
  assert.ok(passable(world, plan, 1.6), 'the larger car fits through the gap');
  const horizontal = BN.planRoadblock(world, {x: 20, z: 80}, {x: -1, z: 0}); assert.equal(horizontal.vertical, false); assert.equal(horizontal.z, 80); assert.ok(horizontal.x < 20);
  // A building on the road forces another position or rejects the segment.
  const crowded = blockWorld([{minX: -10, maxX: 10, minZ: 60, maxZ: 190}]); const alt = BN.planRoadblock(crowded, {x: 0, z: 0}, {x: 0, z: 1});
  assert.ok(!alt || alt.z < 0 || alt.z > 190 || alt.z < 60, 'never inside a building');
  if (alt) for (const q of alt.cars) assert.equal(crowded.isBlocked(q.x, q.z, 1.0), false);
});
test('roadblock manager builds in a hot chase, adds solids and dismantles at the end', () => {
  const world = blockWorld(), events = [];
  const manager = new BN.RoadblockManager(world, {build: b => events.push('build' + b.id), remove: (b, why) => events.push('remove' + b.id + ':' + why)});
  const info = {level: 3, state: 'chase', driving: true, target: {x: 0, z: 0}, dir: {x: 0, z: 1}};
  manager.update(.1, Object.assign({}, info, {level: 2})); assert.equal(manager.blocks.length, 0, 'below the star threshold');
  manager.update(.1, Object.assign({}, info, {driving: false})); assert.equal(manager.blocks.length, 0, 'not driving');
  manager.update(.1, info); assert.equal(manager.blocks.length, 1); assert.equal(world.dynamicSolids.length, 4);
  assert.ok(world.isBlocked(manager.blocks[0].cars[0].x, manager.blocks[0].cars[0].z, .5), 'cruisers are solid');
  manager.update(.1, info); assert.equal(manager.blocks.length, 1, 'cooldown');
  manager.update(31, info); assert.ok(manager.blocks.length <= 2);
  // The chase moves on: a block far behind is removed.
  manager.update(.1, Object.assign({}, info, {target: {x: 0, z: 230}}));
  manager.update(.1, Object.assign({}, info, {state: 'search'})); assert.ok(manager.blocks.length <= 2, 'search keeps existing blocks');
  manager.update(31, info); assert.ok(manager.blocks.length >= 1, 'a fresh block exists before the chase ends');
  manager.update(.1, Object.assign({}, info, {level: 0, state: 'patrol'}));
  assert.equal(manager.blocks.length, 0); assert.equal(world.dynamicSolids.length, 0); assert.equal(world.isBlocked(0, 0, 50), false, 'solids are gone from the array the world reads');
  assert.ok(events.some(e => e.startsWith('build')) && events.some(e => e.endsWith(':ended')));
});

// ---- adaptive quality ----
test('quality degrades gradually, keeps the 28 FPS emergency fallback and recovers with hysteresis', () => {
  const q = new BN.AdaptiveQuality();
  assert.equal(q.current.id, 'normal');
  assert.equal(q.evaluate(60), null);
  assert.equal(q.evaluate(40), 1); assert.equal(q.current.id, 'medio');
  assert.equal(q.evaluate(40), null, 'one step per cool-down');
  assert.equal(q.evaluate(40), 2); assert.equal(q.current.id, 'leve'); assert.equal(q.current.shadows, false); assert.equal(q.current.pixelRatio, 1);
  const emergency = new BN.AdaptiveQuality(); assert.equal(emergency.evaluate(20), 2, 'below 28 FPS jumps straight to leve');
  const tiers = BN.QUALITY_TIERS; assert.ok(tiers[0].carCull > tiers[1].carCull && tiers[1].carCull > tiers[2].carCull);
  assert.ok(tiers[0].far > tiers[1].far && tiers[1].far > tiers[2].far);
  const rec = new BN.AdaptiveQuality(); rec.evaluate(40); rec.evaluate(60);
  let changed = null; for (let i = 0; i < 6 && changed === null; i++) changed = rec.evaluate(60);
  assert.equal(changed, 0, 'sustained good frames climb back'); assert.equal(rec.current.id, 'normal');
  const flip = new BN.AdaptiveQuality(); flip.evaluate(40); for (let i = 0; i < 4; i++) flip.evaluate(60); assert.equal(flip.tier, 0);
  const needed = flip.upNeeded; flip.evaluate(40); flip.evaluate(40); assert.ok(flip.upNeeded > needed, 'a bounce makes recovery slower');
});

console.log('city-physics tests passed: ' + count);
