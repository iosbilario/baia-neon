/* SPDX-License-Identifier: MIT */
// Logic integration with the real Three.js geometry classes and a stub renderer.
// This is not a WebGL rendering, browser compatibility or performance test.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const listeners = {}, elements = new Map();
const context2d = new Proxy({}, {get(target,key) { if(key==='measureText')return text=>({width:String(text).length*12});if(key==='createLinearGradient')return ()=>({addColorStop(){}});return target[key]||(()=>{});},set(target,key,value){target[key]=value;return true;}});
function element(id='') {
  if(elements.has(id))return elements.get(id);
  const classes = new Set();
  const el={id,width:512,height:128,style:{},textContent:'',innerHTML:'',classList:{toggle(c,force){if(force)classes.add(c);else classes.delete(c);},add(c){classes.add(c);},remove(c){classes.delete(c);},contains(c){return classes.has(c);}},getContext:()=>context2d,addEventListener(name,fn){listeners[id+':'+name]=fn;},setPointerCapture(){}};
  elements.set(id,el);return el;
}
let scheduled, now=0, fatalError=null;
const store=new Map();
const scope={console:{log:console.log,warn(){},error(e){fatalError=e;}},document:{getElementById:element,createElement:type=>element('generated-'+Math.random()),addEventListener:(n,f)=>listeners['document:'+n]=f,hidden:false},innerWidth:1280,innerHeight:800,devicePixelRatio:1,location:{search:'?test=1'},URLSearchParams,performance:{now:()=>now},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},requestAnimationFrame:fn=>scheduled=fn,addEventListener:(n,f)=>listeners[n]=f};
scope.window=scope;vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(root,'vendor/three.min.js'),'utf8'),scope);
scope.THREE.WebGLRenderer=class{constructor(){this.shadowMap={};this.info={render:{calls:0,triangles:0}};}setPixelRatio(){}setSize(){}render(scene,camera){assert.ok(Number.isFinite(camera.position.x));scene.updateMatrixWorld();}};
for(const file of ['config','build-info','save','navigation','campaign','world','audio','police','city-life','main'])vm.runInContext(fs.readFileSync(path.join(root,'src',file+'.js'),'utf8'),scope,{filename:file+'.js'});
assert.equal(fatalError,null,'initialization error');
assert.ok(scope.BN.debug,'test helpers available');
const d=scope.BN.debug;
function step(seconds){const n=Math.ceil(seconds*60);for(let i=0;i<n;i++){now+=1000/60;scheduled(now);if(fatalError)throw fatalError;}}
function down(code){listeners.keydown({code,repeat:false,preventDefault(){}});}
function up(code){listeners.keyup({code});}
function tap(code){down(code);up(code);}
let passed=0;function test(name,fn){fn();passed++;console.log('OK '+name);}
test('initial cinematic reaches the menu before play',()=>{assert.equal(d.getState().mode,'intro');step(18.2);assert.equal(d.getState().mode,'menu');});
test('play starts with a dense skyline and a walkable spawn',()=>{element('play').onclick();step(.05);assert.equal(d.getState().mode,'play');assert.ok(!d.world.isBlocked(d.player.x,d.player.z,.45));assert.equal(d.getState().counts.buildings,249);assert.equal(d.getState().counts.skyscrapers,12);});
test('mouse position controls the world-space shot ray',()=>{d.setAimPointer(180,240);const left=d.resolveAim();d.setAimPointer(1100,560);const right=d.resolveAim();assert.ok(Math.hypot(left.ex-right.ex,left.ez-right.ez)>8,'aim endpoints must diverge');});
test('city life adds cyclists workers park activities companions and planes',()=>{const counts=d.getState().counts;assert.equal(counts.cyclists,8);assert.equal(counts.workers,7);assert.ok(counts.parkActivities>=16);assert.equal(counts.companions,4);assert.equal(counts.planes,2);assert.equal(counts.streetDetails,18);for(const actor of d.cityLife.actors)if(!actor.park)assert.ok(!d.world.isBlocked(actor.x,actor.z,.35),'city-life actor blocked: '+actor.role+' '+actor.x+','+actor.z);});
test('movement follows the camera and the starter car can be entered',()=>{const x=d.player.x;down('KeyD');step(.75);up('KeyD');assert.ok(d.player.x<x-2);tap('KeyE');assert.equal(d.getState().player.driving,true);assert.equal(d.getState().police.level,0);});
test('adult companion ride charges once and ends privately without explicit content',()=>{const companion=d.cityLife.companions[0];d.setBalance(500);d.teleport(companion.x,companion.z);d.player.speed=0;d.cityLife.update(.1,{time:1,focus:d.player,night:1,rain:0});assert.ok(d.tryCompanionRide());assert.equal(d.getState().balance,380);const lot=d.world.lots[0];d.teleport(lot.x,lot.z);d.player.speed=0;for(let i=0;i<80;i++)d.updateCompanionRide(.1);assert.equal(d.getCompanionRide(),null);});
test('an autonomous neighborhood incident starts without player input',()=>{const before=d.cityLife.incident.count;d.cityLife.update(60,{time:61,focus:d.player,night:0,rain:0});assert.equal(d.cityLife.incident.count,before+1);assert.ok(d.cityLife.incident.route.length>0);});
test('driving advances, stops and allows a safe exit',()=>{const z=d.player.z;down('KeyW');step(1.4);up('KeyW');assert.ok(d.player.z>z+4);down('Space');step(1.2);up('Space');tap('KeyE');assert.equal(d.getState().player.driving,false);assert.ok(!d.world.isBlocked(d.player.x,d.player.z,.45));});
test('a parked foreign car reports theft',()=>{d.teleport(-9,88);const before=d.getState().crimes;tap('KeyE');assert.equal(d.getState().player.driving,true);assert.equal(d.getState().crimes,before+1);tap('KeyE');d.clearPolice();});
test('a pedestrian collision reports an actual offense',()=>{d.teleport(4,14);const c=d.cars[0];c.x=4;c.z=14;c.heading=0;c.speed=0;c.mesh.position.set(4,0,14);tap('KeyE');assert.ok(d.player.car);d.putPedestrianAhead();const crimes=d.getState().crimes;down('KeyW');step(1.8);up('KeyW');assert.ok(d.getState().crimes>crimes);assert.ok(d.peds[0].down>0||d.peds[0].dead);d.player.car.speed=0;tap('KeyE');d.clearPolice();});
test('night lights and rain state update without a network service',()=>{d.setHour(22);d.setRain(1);step(.1);assert.ok(d.getState().night>.95);assert.ok(d.world.materials.windowLit.emissiveIntensity>1);assert.ok(d.world.materials.asphalt.roughness<.5);assert.equal(d.getState().rainTarget,1);});
test('contracts need a pickup, pay by cargo condition and save progress',()=>{
  d.clearPolice();d.setRain(0);const c=d.cars[0];if(!d.player.car){d.teleport(c.x,c.z+3);tap('KeyE');}assert.ok(d.player.car);
  const start=d.getState().balance,list=scope.BN.CONFIG.deliveries.slice(0,3);
  list.forEach((m,i)=>{
    tap('Digit'+(i+1));assert.equal(d.getState().job.stage,'pickup');
    d.teleport(m.x,m.z);step(2);assert.equal(d.getState().job.stage,'pickup','no delivery without the cargo');
    d.teleport(m.px,m.pz);step(2);assert.equal(d.getState().job.stage,'deliver');
    d.teleport(m.x,m.z);step(4);assert.equal(d.getState().job,null);
  });
  assert.equal(d.getState().completed,3);
  const earned=d.getState().balance-start,max=list.reduce((a,m)=>a+m.reward,0);
  assert.ok(earned>max*.6&&earned<=max,'pay follows the cargo: '+earned);
  assert.ok(/garantido/.test(d.getResult()));
  assert.ok(JSON.parse(store.get(scope.BN.Save.KEY)).completed>=3);
});
test('a fragile cargo loses pay in a crash and a wrecked cargo ends the contract',()=>{
  d.setReputation(0);tap('Digit2');const m=scope.BN.CONFIG.deliveries[1];d.teleport(m.px,m.pz);step(2);assert.equal(d.getState().job.stage,'deliver');
  d.teleport(0,-40);d.player.car.heading=Math.PI/2;d.player.car.speed=22;down('KeyW');step(3);up('KeyW');
  assert.ok(d.getState().job===null||d.getState().job.cargo<100,'crash damaged the cargo');
  if(d.getState().job){d.getJob().cargo=0;step(.2);}
  assert.equal(d.getState().job,null);assert.ok(/perdido/.test(d.getResult()));d.player.car.damage=0;d.player.car.speed=0;
});
test('the garage sells an upgrade once and money buys a different car',()=>{
  d.clearPolice();const g=scope.BN.CONFIG.garage;d.teleport(g.x,g.z);step(.3);d.setBalance(2000);tap('Enter');assert.equal(d.getState().mode,'garage');
  const find=t=>d.garageItems().findIndex(it=>it.label.includes(t));
  assert.ok(d.garageBuy(find('Freios')));assert.equal(d.upgrades.brakes,true);assert.equal(d.getState().balance,1700);
  assert.equal(d.garageBuy(find('Freios')),false);
  assert.ok(d.garageBuy(find('ESPORTIVO')));assert.equal(d.cars[0].type,'sport');
  assert.ok(JSON.parse(store.get(scope.BN.Save.KEY)).owned.includes('sport'));
  element('closeGarage').onclick();assert.equal(d.getState().mode,'play');
});
test('time trials require ordered checkpoints and save a record per vehicle',()=>{
  assert.ok(d.player.car);d.startRace();const race=scope.BN.CONFIG.races[0];
  d.teleport(race.points[1][0],race.points[1][1]);d.updateRace(.1);assert.equal(d.getState().race.checkpoint,0,'later checkpoint cannot be skipped');
  race.points.forEach(point=>{d.teleport(point[0],point[1]);d.updateRace(.25);});
  assert.equal(d.getState().race,null);assert.ok(d.progressData().raceRecords['volta-centro:'+d.player.car.type]>0);
});
test('cars slide sideways in a hard turn and the handbrake lets the rear go',()=>{
  const c=d.player.car;d.teleport(0,-230);c.heading=0;c.lat=0;c.speed=24;down('KeyW');down('KeyD');step(.5);const grip=Math.abs(c.lat);up('KeyD');up('KeyW');
  d.teleport(0,-230);c.heading=0;c.lat=0;c.speed=24;down('KeyW');down('KeyD');down('Space');step(.5);const slide=Math.abs(c.lat);up('KeyD');up('Space');up('KeyW');
  assert.ok(grip>.5,'some lateral speed in a turn: '+grip);assert.ok(slide>grip*1.5,'handbrake slides more: '+slide+' vs '+grip);c.speed=0;c.lat=0;
});
test('taking a moving car throws the driver out',()=>{
  if(d.player.car){d.player.car.speed=0;d.teleport(12,14);tap('KeyE');}assert.equal(d.player.car,null);
  const t=d.cars.find(c=>c.traffic&&!c.wreck);t.speed=0;d.player.x=t.x+Math.cos(t.heading)*3;d.player.z=t.z-Math.sin(t.heading)*3;
  const crimes=d.getState().crimes;tap('KeyE');assert.equal(d.player.car,t);assert.equal(d.getState().crimes,crimes+1);
  assert.ok(d.peds.some(p=>p.panic>8&&Math.hypot(p.x-t.x,p.z-t.z)<4),'driver is on the street');
  d.player.car.speed=0;tap('KeyE');d.clearPolice();
});
test('alleys take only the narrow car, parks take only people, props are solid',()=>{
  const w=d.world,V=d.VEHICLES;assert.ok(w.alleys.length>=2,'alleys: '+w.alleys.length);assert.ok(w.lots.length>=3,'lots: '+w.lots.length);assert.ok(w.parks.length>=3);
  for(const a of w.alleys)for(let z=a.z-a.half-6;z<=a.z+a.half+6;z+=1){
    assert.ok(!w.isBlocked(a.x,z,V.compact.radius),'compact fits the alley at '+z);
    assert.ok(!w.isBlocked(a.x,z,.5),'people fit the alley');
  }
  const a=w.alleys[0];assert.ok(w.isBlocked(a.x,a.z,V.sedan.radius));assert.ok(w.isBlocked(a.x,a.z,V.sport.radius));assert.ok(w.isBlocked(a.x,a.z,1.55),'cruisers do not fit');
  const p=w.parks[0];assert.ok(w.isBlocked(p.x+Math.min(12,p.halfX-2),p.z+Math.min(12,p.halfZ-2),V.compact.radius),'no cars in the park');assert.ok(!w.isBlocked(p.x+Math.min(12,p.halfX-2),p.z+Math.min(12,p.halfZ-2),.5),'people walk in the park');
  const tunnel=w.tunnels[0];assert.ok(!w.isBlocked(40,tunnel.z,1.6),'cars cross the tunnel');assert.ok(w.isBlocked(40,tunnel.minZ+.6,1.1),'tunnel wall is solid');assert.ok(!w.isBlocked(0,tunnel.minZ+.6,1.6),'tunnel cannot block the crossing at x=0');assert.ok(!w.isBlocked(80,tunnel.maxZ-.6,1.6),'tunnel cannot block the crossing at x=80');
  const hill=w.hills[0];assert.ok(w.getElevation(hill.x,hill.z)>5.5,'hill has elevation');assert.equal(w.getElevation(hill.x+hill.rx+2,hill.z),0);
  assert.ok(w.isBlocked(p.x,p.z,.5),'the fountain is solid');
  for(const c of d.cars)assert.ok(!w.isBlocked(c.x,c.z,1),'no car starts inside something');
  for(const q of d.peds)if(!q.dead)assert.ok(!w.isBlocked(q.x,q.z,.5),'no pedestrian starts inside something');
  for(const m of scope.BN.CONFIG.deliveries){assert.ok(!w.isBlocked(m.x,m.z,1.6),'destination blocked: '+m.id);assert.ok(!w.isBlocked(m.px,m.pz,1.6),'pickup blocked: '+m.id);}
  for(const landmark of Object.values(scope.BN.CONFIG.landmarks))assert.ok(!w.isBlocked(landmark.x,landmark.z,1.1),'landmark blocked: '+landmark.id);
  const garageBuilding=w.buildings.find(b=>b.landmark==='garage');assert.ok(garageBuilding,'garage building registered');assert.ok(w.roads.every(road=>garageBuilding.maxX<road-7||garageBuilding.minX>road+7),'garage cannot occupy a vertical road');assert.ok(w.roads.every(road=>garageBuilding.maxZ<road-7||garageBuilding.minZ>road+7),'garage cannot occupy a horizontal road');
  for(let i=0;i<w.buildings.length;i++)for(let j=i+1;j<w.buildings.length;j++){
    const a=w.buildings[i],b=w.buildings[j],overlapX=Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX),overlapZ=Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ);
    assert.ok(overlapX<=0||overlapZ<=0,'buildings overlap: '+i+' and '+j);
  }
  for(const p of w.parks)for(const b of w.buildings)assert.ok(b.maxX<=p.x-p.halfX||b.minX>=p.x+p.halfX||b.maxZ<=p.z-p.halfZ||b.minZ>=p.z+p.halfZ,'building overlaps park');
  for(const q of w.solidProps)for(const b of w.buildings){const nx=Math.max(b.minX,Math.min(q.x,b.maxX)),nz=Math.max(b.minZ,Math.min(q.z,b.maxZ));assert.ok(Math.hypot(q.x-nx,q.z-nz)>=q.r,'street prop overlaps building');}
  assert.ok(!w.isBlocked(scope.BN.CONFIG.garage.x,scope.BN.CONFIG.garage.z,1.6));assert.ok(!w.isBlocked(w.spawn.x,w.spawn.z,.5));
});
test('focus loss pauses motion and resume restores input',()=>{down('KeyW');listeners.blur();const state=d.getState();step(.5);assert.equal(d.getState().mode,'pause');assert.equal(d.player.x,state.player.x);assert.equal(d.player.z,state.player.z);element('resume').onclick();assert.equal(d.getState().mode,'play');});
test('world coordinates remain finite after integrated updates',()=>{d.scene.traverse(o=>{for(const v of [...o.position.toArray(),...o.scale.toArray()])assert.ok(Number.isFinite(v));});assert.equal(fatalError,null);});
console.log(passed+' integration checks passed with a stub renderer. No visual or FPS claim.');
