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
  const el={id,width:512,height:128,style:{},textContent:'',innerHTML:'',classList:{toggle(c,force){if(force)classes.add(c);else classes.delete(c);},add(c){classes.add(c);},remove(c){classes.delete(c);},contains(c){return classes.has(c);}},getContext:()=>context2d,addEventListener(name,fn){listeners[id+':'+name]=fn;},setPointerCapture(){},requestPointerLock(){scope.document.pointerLockElement=this;const fn=listeners['document:pointerlockchange'];if(fn)fn();},getBoundingClientRect(){return {left:0,top:0,width:this.width,height:this.height};}};
  elements.set(id,el);return el;
}
let scheduled, now=0, fatalError=null;
const store=new Map();
const scope={console:{log:console.log,warn(){},error(e){fatalError=e;}},document:{getElementById:element,createElement:type=>element('generated-'+Math.random()),addEventListener:(n,f)=>listeners['document:'+n]=f,hidden:false,pointerLockElement:null,exitPointerLock(){this.pointerLockElement=null;const fn=listeners['document:pointerlockchange'];if(fn)fn();}},innerWidth:1280,innerHeight:800,devicePixelRatio:1,location:{search:'?test=1'},URLSearchParams,performance:{now:()=>now},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},requestAnimationFrame:fn=>scheduled=fn,addEventListener:(n,f)=>listeners[n]=f};
scope.window=scope;vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(root,'vendor/three.min.js'),'utf8'),scope);
scope.THREE.WebGLRenderer=class{constructor(){this.shadowMap={};this.info={render:{calls:0,triangles:0}};}setPixelRatio(){}setSize(){}render(scene,camera){assert.ok(Number.isFinite(camera.position.x));scene.updateMatrixWorld();}};
for(const file of ['config','build-info','save','navigation','city-systems','arsenal','interiors','campaign','island','world','audio','police','city-life','main'])vm.runInContext(fs.readFileSync(path.join(root,'src',file+'.js'),'utf8'),scope,{filename:file+'.js'});
assert.equal(fatalError,null,'initialization error');
assert.ok(scope.BN.debug,'test helpers available');
const d=scope.BN.debug;
function step(seconds){const n=Math.ceil(seconds*60);for(let i=0;i<n;i++){now+=1000/60;scheduled(now);if(fatalError)throw fatalError;}}
function down(code){listeners.keydown({code,repeat:false,preventDefault(){}});}
function up(code){listeners.keyup({code});}
function tap(code){down(code);up(code);}
let passed=0;function test(name,fn){fn();passed++;console.log('OK '+name);}
test('initial cinematic reaches the menu before play',()=>{assert.equal(d.getState().mode,'intro');step(18.2);assert.equal(d.getState().mode,'menu');});
test('play starts with a dense skyline and locks the desktop pointer',()=>{element('play').onclick();step(.05);assert.equal(d.getState().mode,'play');assert.equal(scope.document.pointerLockElement,element('game'));assert.ok(!d.world.isBlocked(d.player.x,d.player.z,.45));assert.ok(d.getState().counts.buildings>=160,'buildings: '+d.getState().counts.buildings);assert.ok(d.getState().counts.skyscrapers>=8,'skyscrapers: '+d.getState().counts.skyscrapers);});
test('desktop mouse rotates camera around a fixed central aim',()=>{const before=d.getControls();listeners['game:pointermove']({movementX:40,movementY:10});const after=d.getControls();assert.notEqual(after.orbitYaw,before.orbitYaw);assert.equal(after.aimPointer.x,640);assert.equal(after.aimPointer.y,336);listeners['game:pointerdown']({button:2});assert.equal(d.getControls().aiming,true);listeners['game:pointerup']({button:2});assert.equal(d.getControls().aiming,false);});
test('island keeps the road graph on land and adds a coastal avenue',()=>{const island=d.world.island;assert.ok(island.coastRoad.length>=12);assert.ok(!d.world.isBlocked(0,0,.5));assert.ok(d.world.isBlocked(310,0,.5));for(const x of d.world.roads)for(const z of d.world.roads)assert.ok(island.containsCircle(x,z,1),'road node outside island: '+x+','+z);for(const closure of island.closures)assert.ok(island.containsPoint(closure.x,closure.z),'closure outside island');for(const segment of island.coastRoad){const length=Math.hypot(segment.b.x-segment.a.x,segment.b.z-segment.a.z);for(let step=0;step<=length;step+=8){const t=step/(length||1),x=segment.a.x+(segment.b.x-segment.a.x)*t,z=segment.a.z+(segment.b.z-segment.a.z)*t;assert.ok(!d.world.buildings.some(b=>x+5>b.minX&&x-5<b.maxX&&z+5>b.minZ&&z-5<b.maxZ),'building blocks coastal avenue');}}});
test('beach and shoreline props stay on their intended surface',()=>{const island=d.world.island,roads=d.world.roads;assert.ok(island.land.geometry.attributes.normal.getY(0)>.9,'land faces away from the camera');for(const patch of island.sand.children)assert.ok(patch.geometry.attributes.normal.getY(0)>.9,'sand faces away from the camera');assert.ok(d.world.beachProps.length>=10);assert.equal([...new Set(d.world.beachProps.map(p=>p.segment))].join(','),Array.from(island.beachSegments).join(','));for(const p of d.world.beachProps){assert.ok(island.containsBeachCircle(p.x,p.z,p.r),p.kind+' left the sand at '+p.x+','+p.z);assert.ok(island.distanceToCoastRoad(p.x,p.z)>=p.r+6,p.kind+' overlaps coastal asphalt');}for(const p of d.world.shoreProps){assert.ok(island.containsCircle(p.x,p.z,p.r),p.kind+' left dry land');assert.ok(island.distanceToCoastRoad(p.x,p.z)>=p.r+5,p.kind+' overlaps coastal asphalt');assert.ok(roads.every(road=>Math.abs(p.x-road)>=p.r+7&&Math.abs(p.z-road)>=p.r+7),p.kind+' overlaps a city street');}for(const p of d.world.solidProps.filter(item=>island.distanceToEdge(item.x,item.z)<45)){assert.ok(island.containsCircle(p.x,p.z,p.r),p.kind+' crosses the shoreline');assert.ok(island.distanceToCoastRoad(p.x,p.z)>=p.r+5,p.kind+' overlaps coastal asphalt');}});
test('city life adds cyclists workers park activities companions and planes',()=>{const counts=d.getState().counts;assert.equal(counts.cyclists,8);assert.equal(counts.workers,7);assert.ok(counts.parkActivities>=16);assert.equal(counts.companions,4);assert.equal(counts.planes,2);assert.equal(counts.streetDetails,18);for(const actor of d.cityLife.actors)if(!actor.park)assert.ok(!d.world.isBlocked(actor.x,actor.z,.35),'city-life actor blocked: '+actor.role+' '+actor.x+','+actor.z);});
test('cyclists sit, steer and pedal instead of using the walking pose',()=>{const cyclist=d.cityLife.cyclists[0],before=cyclist.z;d.cityLife.update(.25,{time:2,focus:cyclist,night:0,rain:0});assert.notEqual(cyclist.z,before);assert.notEqual(cyclist.rider.userData.legs[0].rotation.x,cyclist.rider.userData.legs[1].rotation.x);assert.ok(cyclist.rider.userData.arms.every(arm=>arm.rotation.x<-1));});
test('cyclists and park visitors respond to contextual interaction',()=>{const cyclist=d.cityLife.cyclists[0];cyclist.x=d.player.x+1;cyclist.z=d.player.z;cyclist.group.visible=true;d.contextAction();assert.ok(cyclist.pause>0);cyclist.x=-200;cyclist.z=-200;const actor=d.cityLife.actors.find(a=>a.park);actor.x=d.player.x+1;actor.z=d.player.z;actor.mesh.visible=true;actor.state='idle';d.contextAction();actor.x=actor.home.x;actor.z=actor.home.z;});
test('touch analogue moves on foot without keyboard events',()=>{const before={x:d.player.x,z:d.player.z};d.touch.y=-1;step(.45);d.touch.y=0;assert.ok(Math.hypot(d.player.x-before.x,d.player.z-before.z)>1);});
test('movement follows the camera and the starter car can be entered',()=>{const x=d.player.x;down('KeyD');step(.75);up('KeyD');assert.ok(d.player.x<x-2);tap('KeyE');assert.equal(d.getState().player.driving,true);assert.equal(d.getState().police.level,0);});
test('touch controls steer and accelerate the current car',()=>{const c=d.player.car;c.speed=0;d.touch.primary=true;d.touch.x=.65;step(.6);d.touch.primary=false;d.touch.x=0;assert.ok(c.speed>2);assert.ok(Math.abs(c.heading)>.01);});
test('cars can hit cyclists and park visitors through the shared interaction model',()=>{const car=d.player.car,cyclist=d.cityLife.cyclists[1];cyclist.x=car.x;cyclist.z=car.z;cyclist.down=0;cyclist.hitCooldown=0;assert.equal(d.cityLife.checkVehicleHit(car,12).kind,'cyclist');assert.ok(cyclist.down>0);const actor=d.cityLife.actors.find(a=>a.park);actor.x=car.x;actor.z=car.z;actor.state='idle';assert.equal(d.cityLife.checkVehicleHit(car,12).kind,'park');assert.equal(actor.state,'down');actor.x=actor.home.x;actor.z=actor.home.z;actor.state='idle';actor.down=0;actor.mesh.rotation.z=0;});
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
test('player and camera follow the real hill surface',()=>{
  const hill=d.world.hills[0],startX=hill.x+hill.rx*.92,z=hill.z,beforeY=d.world.getElevation(startX,z);d.teleport(startX,z);d.setYaw(Math.PI/2);down('KeyW');step(.6);up('KeyW');
  const ground=d.world.getElevation(d.player.x,d.player.z),expected=hill.height*Math.sqrt(1-Math.pow((d.player.x-hill.x)/hill.rx,2));assert.ok(d.player.x<startX-2,'player climbs toward hill center');assert.ok(ground>beforeY+.5,'hill elevation increases while climbing');assert.ok(Math.abs(ground-expected)<.001,'elevation matches the rendered sphere');assert.ok(Math.abs(d.human.position.y-ground)<.001,'character stands on the hill surface');assert.ok(d.camera.position.y>=d.world.getElevation(d.camera.position.x,d.camera.position.z)+.64,'camera stays above terrain');
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
  for(const tree of w.solidProps.filter(q=>q.kind==='tree')){assert.ok(w.roads.every(road=>Math.abs(tree.x-road)>=8&&Math.abs(tree.z-road)>=8),'tree overlaps road: '+tree.x+','+tree.z);}
  assert.ok(!w.isBlocked(scope.BN.CONFIG.garage.x,scope.BN.CONFIG.garage.z,1.6));assert.ok(!w.isBlocked(w.spawn.x,w.spawn.z,.5));
});
test('losing desktop pointer lock pauses and resume captures it again',()=>{scope.document.pointerLockElement=null;listeners['document:pointerlockchange']();assert.equal(d.getState().mode,'pause');element('resume').onclick();assert.equal(d.getState().mode,'play');assert.equal(scope.document.pointerLockElement,element('game'));});
test('focus loss pauses motion and resume restores input',()=>{down('KeyW');listeners.blur();const state=d.getState();step(.5);assert.equal(d.getState().mode,'pause');assert.equal(d.player.x,state.player.x);assert.equal(d.player.z,state.player.z);element('resume').onclick();assert.equal(d.getState().mode,'play');});
test('world coordinates remain finite after integrated updates',()=>{d.scene.traverse(o=>{for(const v of [...o.position.toArray(),...o.scale.toArray()])assert.ok(Number.isFinite(v));});assert.equal(fatalError,null);});
test('traffic follows the one-way graph and every street sign of the island exists',()=>{
  const streets=d.world.streets;assert.ok(streets.stronglyConnected());d.clearPolice();step(25);
  const traffic=d.cars.filter(c=>c.traffic&&c.nav);assert.ok(traffic.length>=10,'traffic cars on the graph: '+traffic.length);
  for(const c of traffic){assert.ok(streets.allowed(c.nav.prev,c.nav.cur),'illegal move '+JSON.stringify([c.nav.prev,c.nav.cur]));assert.ok(Number.isFinite(c.x)&&Number.isFinite(c.z));assert.ok(!d.world.isBlocked(c.x,c.z,.5)||c.speed<1,'traffic car inside a building');}
});
test('lamp posts and traffic lights are solid, break at speed and the car pays for it',()=>{
  const w=d.world;assert.ok(w.fixtures.items.length>=60,'fixtures: '+w.fixtures.items.length);
  const lamp=w.fixtures.items.find(f=>f.kind==='lamp'&&f.state==='up'&&Math.abs(f.x)<150&&Math.abs(f.z)<150);assert.ok(lamp);
  assert.ok(w.isBlocked(lamp.x,lamp.z,.4),'an upright post blocks');
  if(!d.player.car){d.teleport(d.cars[0].x,d.cars[0].z+3);tap('KeyE');}
  const car=d.player.car;assert.ok(car);const before=car.damage;
  d.teleport(lamp.x-5,lamp.z);car.heading=Math.PI/2;car.lat=0;car.speed=16;down('KeyW');step(.55);up('KeyW');
  assert.notEqual(lamp.state,'up','the post fell');assert.ok(car.damage>before,'minor damage');assert.ok(!w.isBlocked(lamp.x,lamp.z,.4),'a fallen post no longer blocks');
  step(1);assert.equal(lamp.state,'down');
});
test('pedestrians give way without pinning the player on foot',()=>{
  if(d.player.car){d.player.car.speed=0;tap('KeyE');}assert.ok(!d.player.car);d.clearPolice();
  d.teleport(-9.4,-60);d.setYaw(0);const start={x:d.player.x,z:d.player.z};
  const crowd=d.peds.slice(0,6);crowd.forEach((p,i)=>{p.dead=false;p.down=0;p.frozen=true;p.speed=0;p.x=start.x+(i%3-1)*.6;p.z=start.z-1.2-Math.floor(i/3)*.5;});
  d.touch.y=-1;step(1.4);d.touch.y=0;
  assert.ok(Math.hypot(d.player.x-start.x,d.player.z-start.z)>3,'moved through the crowd: '+Math.hypot(d.player.x-start.x,d.player.z-start.z));
  assert.ok(crowd.some(p=>p.shoved>0));crowd.forEach(p=>{p.frozen=false;p.shoved=0;});
});
test('police roadblocks are built on free asphalt, stay passable and are dismantled',()=>{
  const info={level:3,state:'chase',driving:true,target:{x:0,z:-100},dir:{x:0,z:1}};
  d.roadblocks.update(.1,info);const w=d.world;assert.equal(d.roadblocks.blocks.length,1);const block=d.roadblocks.blocks[0];
  assert.equal(w.dynamicSolids.length,4);assert.ok(w.isBlocked(block.cars[0].x,block.cars[0].z,.4));
  assert.ok(!w.isBlocked(block.x,block.z,1.5),'the gap lets a car through');assert.ok(!w.buildings.some(b=>block.x>b.minX-2&&block.x<b.maxX+2&&block.z>b.minZ-2&&block.z<b.maxZ+2));
  d.roadblocks.update(.1,Object.assign({},info,{level:0,state:'patrol'}));assert.equal(d.roadblocks.blocks.length,0);assert.equal(w.dynamicSolids.length,0);assert.ok(!w.isBlocked(block.cars[0].x,block.cars[0].z,.4));
});
test('adaptive quality steps down gradually and keeps the 28 FPS fallback',()=>{
  const q=d.qualityCtl,cam=d.camera;assert.equal(d.getState().quality,'normal');
  assert.equal(q.evaluate(40),1);d.applyQuality();assert.equal(d.getState().quality,'medio');assert.equal(d.renderer.shadowMap.enabled,true);assert.ok(cam.far<1350&&cam.far>650);
  q.tier=0;q.cooldown=0;assert.equal(q.evaluate(20),2);d.applyQuality();assert.equal(d.getState().quality,'leve');assert.equal(d.renderer.shadowMap.enabled,false);assert.equal(cam.far,650);
  step(.3);q.tier=0;d.applyQuality();assert.equal(d.getState().quality,'normal');assert.equal(cam.far,1350);assert.equal(d.renderer.shadowMap.enabled,true);
});
test('gamepad moves the player, adapts prompts and pauses when unplugged',()=>{
  const buttons=Array.from({length:17},()=>({pressed:false,value:0})),pad={index:0,id:'Test Pad (Vendor: 0000)',connected:true,axes:[0,0,0,0],buttons};
  scope.navigator={getGamepads:()=>pad.connected?[pad]:[]};
  d.touch.y=0;if(d.player.car){d.player.car.speed=0;tap('KeyE');}assert.ok(!d.player.car);d.teleport(-9.4,-60);d.clearPolice();
  assert.equal(d.inputMode.mode,'keyboard');pad.axes=[0,-1,0,0];const start={x:d.player.x,z:d.player.z};step(.6);
  assert.equal(d.inputMode.mode,'gamepad');assert.ok(Math.hypot(d.player.x-start.x,d.player.z-start.z)>1.5,'stick walks');assert.ok(element('keyHints').innerHTML.includes('RT'));
  const yaw=d.getControls().orbitYaw;pad.axes=[0,0,1,0];step(.3);assert.notEqual(d.getControls().orbitYaw,yaw,'right stick turns the camera');pad.axes=[0,0,0,0];
  pad.axes=[.1,.1,0,0];const rest={x:d.player.x,z:d.player.z};step(.3);assert.ok(Math.hypot(d.player.x-rest.x,d.player.z-rest.z)<.2,'drift inside the dead zone is ignored');pad.axes=[0,0,0,0];
  buttons[9]={pressed:true,value:1};step(.05);buttons[9]={pressed:false,value:0};assert.equal(d.getState().mode,'pause','START pauses');step(.05);buttons[9]={pressed:true,value:1};step(.05);buttons[9]={pressed:false,value:0};step(.05);assert.equal(d.getState().mode,'play','START resumes');
  tap('KeyA');assert.equal(d.inputMode.mode,'keyboard');pad.axes=[0,-1,0,0];step(.05);assert.equal(d.inputMode.mode,'gamepad');pad.axes=[0,0,0,0];
  pad.connected=false;step(.05);assert.equal(d.getState().mode,'pause','unplugging pauses a gamepad session');element('resume').onclick();step(.05);
  assert.equal(d.getState().mode,'play');scope.navigator=undefined;
});
test('arsenal: three weapons switch by key, wheel, gamepad bumpers and touch, and persist in the save',()=>{
  if(d.player.car){d.player.car.speed=0;tap('KeyE');}assert.ok(!d.player.car);d.teleport(-9.4,-60);d.clearPolice();
  assert.equal(d.getState().player.weapon,'pistol');tap('KeyQ');assert.equal(d.getState().player.weapon,'pistol','nothing to switch to yet');
  d.loadout.unlock('smg');d.loadout.unlock('shotgun');
  tap('KeyQ');assert.equal(d.getState().player.weapon,'smg');step(.4);listeners.wheel({deltaY:100});assert.equal(d.getState().player.weapon,'shotgun');step(.4);
  listeners.wheel({deltaY:-100});assert.equal(d.getState().player.weapon,'smg');step(.4);tap('Digit4');assert.equal(d.getState().player.weapon,'pistol');step(.4);
  const buttons=Array.from({length:17},()=>({pressed:false,value:0})),pad={index:0,id:'Arsenal Pad',connected:true,axes:[0,0,0,0],buttons};scope.navigator={getGamepads:()=>[pad]};
  buttons[5]={pressed:true,value:1};step(.05);buttons[5]={pressed:false,value:0};step(.3);assert.equal(d.getState().player.weapon,'smg','RB next');
  buttons[4]={pressed:true,value:1};step(.05);buttons[4]={pressed:false,value:0};step(.3);assert.equal(d.getState().player.weapon,'pistol','LB previous');
  scope.navigator=undefined;step(.05);if(d.getState().mode==='pause'){element('resume').onclick();step(.05);}assert.equal(d.getState().mode,'play');
  listeners['touchWeapon:pointerdown']({preventDefault(){}});assert.equal(d.getState().player.weapon,'smg','touch button');step(.4);
  assert.ok(element('touchWeapon').textContent.includes('SUBME'));assert.ok(element('arsenal').textContent.includes('SUBMETRALHADORA'));
  const saved=d.progressData();assert.equal(JSON.stringify(saved.arsenal.owned),'["pistol","smg","shotgun"]');assert.equal(saved.arsenal.current,'smg');assert.equal(saved.schemaVersion,2);assert.equal(typeof saved.ammo,'number');
});
test('arsenal: the smg sprays while the button is held, the shotgun fires several tracers per shot',()=>{
  d.teleport(-9.4,-60);d.loadout.select('smg');step(.4);const before=d.player.ammo;
  listeners['game:pointerdown']({button:0});step(.5);listeners['game:pointerup']({button:0});const used=before-d.player.ammo;assert.ok(used>=4&&used<=7,'held smg uses several rounds in half a second: '+used);
  const after=d.player.ammo;step(.5);assert.equal(d.player.ammo,after,'releasing the button stops the spray');
  d.loadout.select('shotgun');step(.4);const sg=d.player.ammo;listeners['game:pointerdown']({button:0});listeners['game:pointerup']({button:0});step(.05);assert.equal(d.player.ammo,sg-1,'one shell per pull');
  const visible=d.scene.children.filter(o=>o.isLine&&o.material&&o.material.opacity>0).length;assert.ok(visible>=5,'pellet tracers: '+visible);
  d.loadout.select('pistol');step(.4);d.player.ammo=0;tap('KeyR');assert.ok(d.player.reload>0,'empty magazine reloads');step(1.5);assert.equal(d.player.ammo,12);
});
test('arsenal: shooting from inside the car follows the reticle and damages the target zone',()=>{
  d.loadout.select('pistol');step(.4);const car=d.cars.find(o=>o.owned&&!o.wreck);d.teleport(car.x+1.5,car.z);tap('KeyE');assert.ok(d.player.car,'inside the car');
  const c=d.player.car;d.teleport(0,-230);c.heading=0;c.speed=0;c.lat=0;d.clearPolice();d.resetZones(c);
  const target=d.cars.find(o=>o!==c&&!o.wreck);target.traffic=false;target.speed=0;target.x=c.x;target.z=c.z+14;target.heading=Math.PI/2;target.mesh.position.set(target.x,0,target.z);target.mesh.rotation.y=target.heading;target.damage=0;target.zones=scope.BN.newZones();target.mesh.visible=true;
  d.setYaw(Math.PI);step(.8);d.teleport(0,-230);c.speed=0;target.x=c.x;target.z=c.z+14;target.mesh.position.set(target.x,0,target.z);
  let aimed=null;for(let pitch=.1;pitch<=1.1&&!aimed;pitch+=.05){d.setPitch(pitch);step(.3);d.teleport(0,-230);c.speed=0;target.x=c.x;target.z=c.z+14;target.mesh.position.set(target.x,0,target.z);const probe=d.resolveAim();if(probe.best&&probe.best.o===target)aimed=pitch;}
  assert.ok(aimed!==null,'the player can put the reticle on the car ahead');
  const ammo=d.player.ammo;d.fire();assert.equal(d.player.ammo,ammo-1,'the pistol works from the car');assert.ok(d.player.aimTime>0);
  assert.ok(target.damage>0,'the car ahead is hit: '+target.damage);const hit=Object.values(target.zones).reduce((a,b)=>a+b,0);assert.ok(hit>0,'a zone records the hit');assert.equal(target.zones.rear+target.zones.front,0,'shot from the side of a crossing car');
  step(.1);assert.ok(element('arsenal').textContent.includes('CARRO'));assert.ok(element('arsenal').textContent.includes('PISTOLA'));
  target.damage=0;target.x=-200;target.z=-200;target.mesh.position.set(-200,0,-200);
});
test('arsenal: localized damage dents the car and changes its handling',()=>{
  const c=d.player.car;assert.ok(c);d.teleport(0,-230);c.heading=0;c.lat=0;d.resetZones(c);c.damage=0;const kids=c.mesh.children.length;
  const topSpeed=()=>{d.teleport(0,-230);c.heading=0;c.lat=0;c.speed=60;down('KeyW');step(.05);up('KeyW');const v=c.speed;c.speed=0;return v;};
  const top=topSpeed();d.resetZones(c);d.damageZone(c,'front',70);assert.equal(c.mesh.children.length,kids+1,'a dent mesh appears');assert.equal(d.getState().player.zones.front,70);
  d.damageZone(c,'front',10);assert.equal(c.mesh.children.length,kids+1,'same level, same mesh');d.damageZone(c,'right',30);assert.equal(c.mesh.children.length,kids+2);
  const damaged=topSpeed();assert.ok(damaged<top*.8,'front damage lowers top speed: '+damaged+' vs '+top);
  d.resetZones(c);assert.equal(c.mesh.children.length,kids);assert.equal(d.getState().player.zones.front,0);c.speed=0;c.lat=0;
});
test('arsenal: the car rolls over on a sustained slide, locks the controls and recovers',()=>{
  const c=d.player.car;d.teleport(0,-230);c.heading=0;c.speed=0;c.lat=0;c.roll.reset();c.damage=0;
  d.resetZones(c);let rolled=false;for(let i=0;i<60&&!rolled;i++){c.speed=26;c.lat=18;step(1/60);rolled=c.roll.active;}
  assert.ok(rolled,'slide over the limit starts a rollover');assert.equal(d.getState().player.roll,'rolling');
  const before=c.speed;down('KeyW');step(.3);up('KeyW');assert.ok(c.speed<=before,'throttle is ignored while rolling');assert.ok(Math.abs(c.mesh.rotation.z)>.1,'the body is tilted');
  const zones=d.getState().player.zones;assert.ok(zones.left+zones.right>=18,'side takes the damage');assert.ok(c.damage>0);
  tap('KeyE');assert.ok(d.player.car,'cannot leave the car while it is overturned');
  step(4);assert.equal(c.roll.active,false);assert.equal(c.mesh.rotation.z,0);assert.equal(c.mesh.position.y,0);
  down('KeyW');c.speed=0;step(1);up('KeyW');assert.ok(c.speed>3,'driving again after recovery');c.speed=0;c.lat=0;
  d.resetZones(c);c.damage=0;
});
test('arsenal: garage sells weapons and ammo for the weapon in hand, and old saves load',()=>{
  const c=d.player.car;if(c){c.speed=0;d.teleport(12,14);tap('KeyE');}
  const fresh=scope.BN.Save.normalize({balance:50,ammo:7,reserve:20},{vehicles:['compact','sedan','sport'],upgrades:['brakes','tires','cargo'],campaignIds:[],weapons:['pistol','smg','shotgun']});
  assert.equal(fresh.schemaVersion,2);assert.equal(JSON.stringify(fresh.arsenal.owned),'["pistol"]');
  d.loadout.select('smg');d.setBalance(5000);d.teleport(scope.BN.CONFIG.garage.x,scope.BN.CONFIG.garage.z);step(.2);d.openGarage();assert.equal(d.getState().mode,'garage');
  const labels=d.garageItems().map(i=>i.label);assert.ok(labels.some(l=>l.startsWith('Munição · SUBMETRALHADORA')),labels.join('|'));assert.ok(!labels.some(l=>l.startsWith('Comprar ESPINGARDA')),'owned weapons are not for sale');
  element('closeGarage').onclick();step(.1);
});
test('interiors: doors open on free ground outside and every exit spawn is walkable',()=>{
  const I=scope.BN.Interiors;for(const id of I.ORDER){const def=I.DEFS[id];assert.ok(!d.world.isBlocked(def.outside.x,def.outside.z,.42),id+' exit spawn blocked');assert.ok(!d.world.isBlocked(def.door.x,def.door.z,.42),id+' door blocked');}
});
test('interiors: E at the door enters on foot, collides inside, and E at the exit goes back',()=>{
  const I=scope.BN.Interiors,def=I.DEFS.radio;d.teleport(def.door.x,def.door.z);step(.1);assert.ok(d.getState().player.driving===false);
  tap('KeyE');step(.7);const s=d.getState();assert.equal(s.interior,'radio');assert.ok(d.interiorRooms.radio&&d.interiorRooms.radio.visible);
  const local=I.toLocal(def,d.player);assert.ok(Math.abs(local.x)<def.hx&&Math.abs(local.z)<def.hz);
  down('KeyW');step(4);up('KeyW');const after=I.toLocal(def,d.player);assert.ok(Math.abs(after.x)<=def.hx-.4&&Math.abs(after.z)<=def.hz-.4,'walls hold');assert.ok(!I.blocked(def,d.player.x,d.player.z,.4));
  assert.ok(Number.isFinite(d.camera?d.camera.position.x:0));
  const ex=I.exitDoor(def),at=I.toWorld(def,{x:ex.x,z:ex.z-.6});d.teleport(at.x,at.z);step(.1);tap('KeyE');step(.7);
  assert.equal(d.getState().interior,null);assert.ok(Math.hypot(d.player.x-def.outside.x,d.player.z-def.outside.z)<.5);assert.ok(!d.interiorRooms.radio.visible);
});
test('interiors: a task inside pays, advances the campaign and persists in the save',()=>{
  const I=scope.BN.Interiors,def=I.DEFS.radio;d.campaign.state.active='portas-abertas';d.campaign.state.step=0;d.campaign.state.status='active';
  d.teleport(def.door.x,def.door.z);step(.1);tap('KeyE');step(.7);assert.equal(d.campaign.state.step,1,'entering completes the first step');
  const before=d.getState().balance,at=I.toWorld(def,I.find(def,'mic'));d.teleport(at.x,at.z);step(.1);tap('KeyE');step(6.6);
  assert.ok(d.getState().balance>=before+90,'task paid');assert.ok(d.campaign.state.completed.includes('portas-abertas'));
  const saved=d.progressData();assert.equal(saved.schemaVersion,2);assert.ok(saved.interiors.visited.includes('radio'));assert.equal(saved.interiors.done['radio:mic'],1);
  const out=I.toWorld(def,{x:I.exitDoor(def).x,z:I.exitDoor(def).z-.6});d.teleport(out.x,out.z);step(.1);tap('KeyE');step(.7);assert.equal(d.getState().interior,null);
});
test('interiors: the market sells a medical kit only when needed and weapons are holstered inside',()=>{
  const I=scope.BN.Interiors,def=I.DEFS.market;d.teleport(def.door.x,def.door.z);step(.1);tap('KeyE');step(.7);assert.equal(d.getState().interior,'market');
  const before=d.player.ammo;d.fire();assert.equal(d.player.ammo,before,'no shooting indoors');
  d.setBalance(500);d.player.health=100;const at=I.toWorld(def,I.find(def,'shop-kit'));d.teleport(at.x,at.z);step(.1);tap('KeyE');step(.1);assert.equal(d.getState().balance,500,'full health: no charge');
  d.player.health=40;tap('KeyE');step(.1);assert.equal(d.getState().balance,440);assert.equal(d.player.health,100);
  d.leaveInterior();step(.1);
});
console.log(passed+' integration checks passed with a stub renderer. No visual or FPS claim.');
