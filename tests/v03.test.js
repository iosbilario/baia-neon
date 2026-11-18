/* SPDX-License-Identifier: MIT */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const scope = {window: null, console, Date}; scope.window = scope; vm.createContext(scope);
for (const file of ['config', 'save', 'navigation', 'campaign']) vm.runInContext(fs.readFileSync(path.join(root, 'src', file + '.js'), 'utf8'), scope, {filename:file+'.js'});
const {Save, Navigation, Campaign, CONFIG} = scope.BN;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('OK ' + name); }
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),values};
}
const catalogues = {vehicles:['compact','sedan','sport'], upgrades:['brakes','tires','cargo'], campaignIds:CONFIG.campaign.map(item=>item.id)};
test('legacy save migrates once, keeps its backup and preserves progress', () => {
  const legacy = JSON.stringify({balance:875, completed:9, upgrades:{brakes:true}, owned:['compact','sedan'], car:'sedan', ammo:4});
  const store = storage({[Save.LEGACY_KEY]:legacy});
  const result = Save.load(store, catalogues);
  assert.equal(result.migrated, true); assert.equal(result.data.schemaVersion, 2); assert.equal(result.data.balance, 875);
  assert.equal(result.data.completed, 9); assert.equal(result.data.upgrades.brakes, true); assert.equal(result.data.car, 'sedan');
  assert.equal(store.getItem(Save.BACKUP_KEY), legacy); assert.ok(store.getItem(Save.KEY)); assert.equal(store.getItem(Save.LEGACY_KEY), legacy);
});
test('new save is isolated from v1 and cannot duplicate unsupported values', () => {
  const store = storage({[Save.LEGACY_KEY]:JSON.stringify({balance:10})});
  const first = Save.load(store, catalogues); first.data.balance = 120; Save.persist(store, first.data);
  const second = Save.load(store, catalogues); assert.equal(second.migrated, false); assert.equal(second.data.balance, 120);
  assert.equal(JSON.parse(store.getItem(Save.LEGACY_KEY)).balance, 10);
});
test('export and import validate the progress format', () => {
  const data = Save.normalize({balance:420, campaign:{completed:['voz-atrasada']}}, catalogues);
  const text = Save.exportProgress(data, {version:'0.3.0',tag:'v0.3.0-rc.1',sha:'abc'});
  assert.equal(Save.importProgress(text, catalogues).balance, 420);
  assert.throws(()=>Save.importProgress('{"progress":{}}', catalogues), /não é um progresso/);
});
test('campaign checkpoints failures and one-time rewards are explicit', () => {
  const state = Save.normalize({}, catalogues).campaign, campaign = new Campaign(CONFIG.campaign, state);
  let event = campaign.arrive('presenter', {hasCar:true,balance:0}); assert.equal(event.type, 'step'); assert.equal(state.checkpoint, 1);
  event = campaign.fail('teste'); assert.equal(event.type, 'failed'); assert.equal(campaign.retry().type, 'retry'); assert.equal(state.step, 1);
  event = campaign.arrive('radio', {hasCar:true,balance:0});
  assert.equal(event.type, 'mission-complete'); assert.ok(event.reward > 0); assert.equal(state.active, 'carro-radio');
  const rewarded = state.rewarded.length; assert.equal(new Set(state.rewarded).size, rewarded);
});
test('campaign accepts both collection orders and advances once', () => {
  const state = Save.normalize({campaign:{active:'acervo-ambulante'}}, catalogues).campaign, campaign = new Campaign(CONFIG.campaign, state);
  assert.equal(campaign.arrive('archive-beach',{hasCar:true,balance:0}).type,'progress');
  assert.equal(campaign.arrive('archive-north',{hasCar:true,balance:0}).type,'step');
  assert.equal(state.step,1); assert.deepEqual(Array.from(state.collected),[]);
});
test('campaign records rewards once and expires timed objectives', () => {
  const state = Save.normalize({campaign:{active:'ultima-frequencia',rewarded:['ultima-frequencia']}}, catalogues).campaign, campaign = new Campaign(CONFIG.campaign, state);
  campaign.arrive('radio',{hasCar:true,balance:0}); campaign.arrive('market',{hasCar:true,balance:0});
  const repeat = campaign.arrive('pier',{hasCar:true,balance:0}); assert.equal(repeat.reward,0); assert.equal(repeat.firstCompletion,false); assert.equal(state.status,'active'); assert.equal(state.active,'portas-abertas');
  const timedState = Save.normalize({campaign:{active:'sinal-por-um-fio',step:1}}, catalogues).campaign, timed = new Campaign(CONFIG.campaign,timedState);
  const failed = timed.tick(96,{roughness:0,damage:0}); assert.equal(failed.type,'failed'); assert.equal(timedState.status,'failed');
});
test('navigation produces only street-aligned segments and crosses by intersections', () => {
  const path = Navigation.route({x:25,z:31},{x:247,z:-193},[-240,-160,-80,0,80,160,240]);
  assert.ok(path.length>=3);
  for(let i=1;i<path.length;i++)assert.ok(path[i].x===path[i-1].x||path[i].z===path[i-1].z,'diagonal segment');
  assert.ok(path.some(point=>point.x===80||point.x===160),'route reaches canal-side roads');
});
console.log(passed + ' v0.3 checks passed.');
