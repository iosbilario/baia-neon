/* SPDX-License-Identifier: MIT */
// Run with node tests/interiors.test.js. Pure logic of the v1.0 "Portas Abertas" phase, no WebGL.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = {Math, console, Date};
context.window = context;
vm.createContext(context);
for (const file of ['config.js', 'save.js', 'interiors.js', 'campaign.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), context, {filename: file});
const {Interiors: I, Save, Campaign, CONFIG} = context.BN;
let count = 0;
function test(name, fn) { fn(); count++; console.log('OK ' + name); }
const catalogues = {vehicles: ['compact', 'sedan', 'sport'], upgrades: ['brakes', 'tires', 'cargo'], weapons: ['pistol', 'smg', 'shotgun'], campaignIds: CONFIG.campaign.map(c => c.id), interiorIds: I.ORDER.slice()};
const player = (x = 0, z = 0) => ({x, z});
function run(session, p, seconds) { const events = []; for (let t = 0; t < seconds; t += 1 / 60) events.push(...session.update(1 / 60, p)); return events; }
function enter(session, id, p) {
  const d = I.DEFS[id]; p.x = d.door.x; p.z = d.door.z;
  assert.equal(session.interact(p, {wanted: 0}).type, 'enter-start');
  const ev = run(session, p, .6).find(e => e.type === 'entered'); p.x = ev.spawn.x; p.z = ev.spawn.z; return ev;
}
function reachable(def) {
  const step = .25, start = I.toLocal(def, I.entrySpawn(def)), key = (x, z) => Math.round(x / step) + ',' + Math.round(z / step), seen = new Set([key(start.x, start.z)]), queue = [start];
  while (queue.length) { const c = queue.pop(); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = c.x + dx * step, z = c.z + dz * step, k = key(x, z); if (!seen.has(k) && !I.blocked(def, def.origin.x + x, def.origin.z + z, .42)) { seen.add(k); queue.push({x, z}); } } }
  return (x, z) => seen.has(key(x, z));
}

test('four interiors exist, with the Píer Farol as the fourth and distinct pockets far from the island', () => {
  assert.deepEqual(Array.from(I.ORDER), ['radio', 'garage', 'market', 'pier']);
  assert.equal(new Set(I.ORDER.map(id => I.DEFS[id].origin.x)).size, 4);
  for (const id of I.ORDER) { const d = I.DEFS[id]; assert.ok(d.origin.x > 1000 && d.origin.z > 1000, id + ' pocket must sit beyond the camera far plane'); assert.ok(d.stations.length >= 2, id); }
});
test('every station, the exit door and the entry spawn are reachable and never inside furniture', () => {
  for (const id of I.ORDER) {
    const d = I.DEFS[id], ok = reachable(d), spawn = I.toLocal(d, I.entrySpawn(d)), exit = I.exitDoor(d);
    assert.ok(!I.blocked(d, I.entrySpawn(d).x, I.entrySpawn(d).z, .42), id + ' spawn');
    assert.ok(Math.hypot(spawn.x - exit.x, spawn.z - exit.z) < exit.r, id + ' spawn is near the exit so a double tap leaves');
    for (const s of d.stations) { const near = [[0, 0], [s.r * .7, 0], [-s.r * .7, 0], [0, s.r * .7], [0, -s.r * .7]].some(([dx, dz]) => ok(s.x + dx, s.z + dz)); assert.ok(near, id + ':' + s.id + ' unreachable'); }
    assert.ok(ok(exit.x, exit.z - .5), id + ' exit unreachable');
  }
});
test('interior collision: walls clamp, furniture blocks and walking slides along it', () => {
  const d = I.DEFS.radio, p = I.toWorld(d, {x: 0, z: 0});
  assert.equal(I.blocked(d, p.x, p.z, .42), false);
  assert.equal(I.blocked(d, d.origin.x + d.hx, p.z, .42), true, 'east wall');
  assert.equal(I.blocked(d, p.x, d.origin.z - d.hz, .42), true, 'north wall');
  const desk = d.solids[0]; assert.equal(I.blocked(d, d.origin.x + desk.x, d.origin.z + desk.z, .42), true, 'desk');
  const a = {x: d.origin.x - 2, z: d.origin.z + desk.z + desk.hz + .7}; const hit = I.walk(d, a, a.x + 3, a.z - 3, .42);
  assert.equal(hit, true); assert.ok(a.x > d.origin.x - 2 + 1.5, 'slid sideways along the desk'); assert.ok(!I.blocked(d, a.x, a.z, .42));
  const b = {x: d.origin.x, z: d.origin.z}; I.walk(d, b, b.x + 500, b.z, .42); assert.ok(b.x < d.origin.x + d.hx - .4, 'never escapes through a wall');
});
test('entering and leaving go through a fade, move the player and block interaction meanwhile', () => {
  const s = new I.Session(), p = player(); assert.equal(s.interact(p, {}), null, 'no door nearby');
  const d = I.DEFS.market; p.x = d.door.x + .5; p.z = d.door.z;
  assert.equal(s.prompt(p).startsWith('E para entrar'), true);
  assert.equal(s.interact(p, {wanted: 2}).type, 'blocked', 'police outside keeps the door locked'); assert.equal(s.active, false);
  assert.equal(s.interact(p, {wanted: 0}).type, 'enter-start'); assert.equal(s.interact(p, {}).type, 'busy');
  let maxFade = 0, entered = null; for (let i = 0; i < 60; i++) { for (const e of s.update(1 / 60, p)) if (e.type === 'entered') entered = e; maxFade = Math.max(maxFade, s.fade); }
  assert.ok(maxFade > .9 && s.fade === 0, 'fades to black and back'); assert.ok(entered && s.current === 'market' && s.visited.has('market'));
  assert.ok(!I.blocked(d, entered.spawn.x, entered.spawn.z, .42)); p.x = entered.spawn.x; p.z = entered.spawn.z;
  assert.equal(s.interact(p, {}).type, 'exit-start');
  const exited = run(s, p, .6).find(e => e.type === 'exited'); assert.ok(exited); assert.equal(s.active, false);
  assert.deepEqual({x: exited.spawn.x, z: exited.spawn.z}, {x: d.outside.x, z: d.outside.z});
});
test('forceExit (death) leaves immediately and drops any running task', () => {
  const s = new I.Session(), p = player(); enter(s, 'radio', p);
  const d = I.DEFS.radio, st = d.stations[0], at = I.toWorld(d, st); p.x = at.x; p.z = at.z; s.interact(p, {}); assert.ok(s.task);
  const out = s.forceExit(); assert.equal(s.active, false); assert.equal(s.task, null); assert.deepEqual({x: out.x, z: out.z}, {x: d.outside.x, z: d.outside.z});
});
test('tasks need presence, pay once, then wait for the cooldown', () => {
  const s = new I.Session(), p = player(); enter(s, 'radio', p);
  const d = I.DEFS.radio, st = I.find(d, 'mic'), at = I.toWorld(d, st); p.x = at.x; p.z = at.z;
  assert.equal(s.interact(p, {}).type, 'task-start'); assert.equal(s.interact(p, {}).type, 'busy');
  let events = run(s, p, st.time - 1); assert.equal(events.length, 0, 'not done yet');
  p.x += 5; events = run(s, p, .1); assert.equal(events[0].type, 'task-cancel'); p.x = at.x;
  assert.equal(s.interact(p, {}).type, 'task-start'); events = run(s, p, st.time + .2);
  const done = events.find(e => e.type === 'task-done'); assert.equal(done.reward, 90); assert.equal(done.interior, 'radio'); assert.equal(s.done['radio:mic'], 1);
  assert.equal(s.interact(p, {}).type, 'cooldown'); assert.ok(s.prompt(p).includes('volte em'));
  run(s, p, st.cooldown + 1); assert.equal(s.interact(p, {}).type, 'task-start');
});
test('market shelves charge only when the effect applies and count purchases', () => {
  const s = new I.Session(), p = player(); enter(s, 'market', p);
  const d = I.DEFS.market, st = I.find(d, 'shop-kit'), at = I.toWorld(d, st); p.x = at.x; p.z = at.z;
  const poor = s.interact(p, {balance: 10}); assert.equal(poor.type, 'blocked'); assert.ok(poor.message.includes('R$ 50'));
  const buy = s.interact(p, {balance: 500}); assert.equal(buy.type, 'purchase'); assert.equal(buy.item.price, 60); assert.equal(s.done['market:kit'], undefined, 'nothing recorded before the game applies it');
  s.confirmPurchase(buy.interior, buy.item); assert.equal(s.done['market:kit'], 1);
});
test('garage counter and pier chart delegate to the existing garage, contract and race systems', () => {
  const kinds = {}; for (const id of I.ORDER) for (const st of I.DEFS[id].stations) kinds[st.kind] = (kinds[st.kind] || 0) + 1;
  for (const kind of ['garage', 'contract', 'race', 'task', 'shop']) assert.ok(kinds[kind] > 0, kind);
  const s = new I.Session(), p = player(); enter(s, 'pier', p); const d = I.DEFS.pier, at = I.toWorld(d, I.find(d, 'chart')); p.x = at.x; p.z = at.z;
  const ev = s.interact(p, {}); assert.equal(ev.type, 'hook'); assert.equal(ev.hook, 'race');
});
test('interior camera stays inside the walls and under the ceiling for every position and angle', () => {
  for (const id of I.ORDER) { const d = I.DEFS[id];
    for (let x = -d.hx + .5; x <= d.hx - .5; x += 1.5) for (let z = -d.hz + .5; z <= d.hz - .5; z += 1.5) for (const yaw of [0, 1.6, 3.14, 4.7]) {
      const shot = I.cameraFor(d, I.toWorld(d, {x, z}), yaw), l = I.toLocal(d, shot.position);
      assert.ok(Math.abs(l.x) < d.hx && Math.abs(l.z) < d.hz, id + ' camera outside'); assert.ok(shot.position.y > 1 && shot.position.y < I.WALL, id + ' camera height');
    } }
});
test('builder is lazy-friendly: one shared geometry, few meshes, hidden until entered', () => {
  const made = {meshes: 0, geos: 0};
  class V { set(x, y, z) { this.x = x; this.y = y; this.z = z; } }
  const T = {Group: class { constructor() { this.children = []; this.position = new V(); this.visible = true; } add(m) { this.children.push(m); } }, BoxGeometry: class { constructor() { made.geos++; } },
    Mesh: class { constructor() { made.meshes++; this.position = new V(); this.scale = new V(); } }, MeshStandardMaterial: class { constructor(o) { Object.assign(this, o); } }};
  for (const id of I.ORDER) { const g = I.build(T, I.DEFS[id]); assert.equal(g.visible, false); assert.equal(g.position.x, I.DEFS[id].origin.x); }
  assert.equal(made.geos, 4, 'one geometry per room'); assert.ok(made.meshes / 4 < 45, 'light rooms: ' + made.meshes / 4 + ' meshes each');
});
test('campaign: the three new chapters run on foot through interior targets and reward once', () => {
  const state = Save.normalize({campaign: {active: 'portas-abertas'}}, catalogues).campaign, c = new Campaign(CONFIG.campaign, state);
  assert.equal(CONFIG.campaign.length, 8); assert.equal(I.isInteriorTarget('in-radio'), true); assert.equal(I.isInteriorTarget('radio'), false); assert.equal(I.isInteriorTarget('in-hotel'), false);
  assert.equal(c.arrive('do-radio', {hasCar: false}), null, 'cannot skip the first step');
  assert.equal(c.arrive('in-radio', {hasCar: false}).type, 'step'); assert.equal(state.checkpoint, 1);
  const done = c.arrive('do-radio', {hasCar: false}); assert.equal(done.type, 'mission-complete'); assert.ok(done.reward > 0); assert.equal(state.active, 'peca-do-canal');
  for (const id of ['in-garage', 'do-garage', 'in-market']) assert.equal(c.arrive(id, {hasCar: false}).type, 'step', id);
  assert.equal(c.arrive('do-market', {hasCar: false}).type, 'mission-complete');
  assert.equal(c.arrive('in-pier', {hasCar: false}).type, 'step'); const end = c.arrive('do-pier', {hasCar: false});
  assert.equal(end.type, 'campaign-complete'); assert.equal(state.status, 'finished'); assert.equal(state.rewarded.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(I.targetPoint('in-pier'))), {id: 'in-pier', name: 'Píer Farol', x: I.DEFS.pier.door.x, z: I.DEFS.pier.door.z});
});
test('save: a finished v0.6 campaign continues into the new chapters without losing rewards', () => {
  const ids = CONFIG.campaign.slice(0, 5).map(c => c.id);
  const old = {balance: 900, campaign: {active: 'ultima-frequencia', status: 'finished', completed: ids, rewarded: ids}};
  const data = Save.normalize(old, catalogues); assert.equal(data.schemaVersion, 2); assert.deepEqual(JSON.parse(JSON.stringify(data.interiors)), {visited: [], done: {}});
  new Campaign(CONFIG.campaign, data.campaign); assert.equal(data.campaign.active, 'portas-abertas'); assert.equal(data.campaign.status, 'active'); assert.equal(data.campaign.rewarded.length, 5);
  assert.equal(new Campaign(CONFIG.campaign, Save.normalize({campaign: {active: 'luz-do-farol', status: 'finished'}}, catalogues).campaign).state.status, 'finished', 'a truly finished campaign stays finished');
});
test('save: interiors survive a persist/load round trip, junk is dropped, export keeps the new ids', () => {
  const s = new I.Session({visited: ['radio', 'ghost'], done: {'radio:mic': 3, 'ghost:x': 4, 'bad key': 1}}); assert.deepEqual(JSON.parse(JSON.stringify(s.serialize())), {visited: ['radio'], done: {'radio:mic': 3}});
  const data = Save.normalize({interiors: {visited: ['pier', 'nope'], done: {'pier:lamp': 2, 'nope:a': 1, 'pier:lamp2': 'x'}}, campaign: {active: 'luz-do-farol', completed: ['portas-abertas']}}, catalogues);
  assert.deepEqual(Array.from(data.interiors.visited), ['pier']); assert.equal(data.interiors.done['pier:lamp'], 2); assert.equal(data.interiors.done['nope:a'], undefined);
  const store = new Map(), storage = {getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v))};
  Save.persist(storage, data); const back = Save.load(storage, catalogues).data; assert.deepEqual(JSON.parse(JSON.stringify(back.interiors)), JSON.parse(JSON.stringify(data.interiors))); assert.equal(back.campaign.active, 'luz-do-farol');
  const imported = Save.importProgress(Save.exportProgress(data, {version: 'x'}), catalogues); assert.equal(imported.campaign.active, 'luz-do-farol'); assert.deepEqual(Array.from(imported.interiors.visited), ['pier']); assert.equal(imported.schemaVersion, 2);
  assert.equal(Save.normalize({}, {...catalogues, interiorIds: undefined}).interiors.visited.length, 0);
});
console.log(count + ' interiors checks passed.');
