/* SPDX-License-Identifier: MIT */
// Run with node tests/police.test.js. No package installation is needed.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context={Math,console};
context.window=context;
vm.createContext(context);
for(const file of ['config.js','police.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),context,{filename:file});
}
const BN=context.BN;
const roads=[-240,-160,-80,0,80,160,240];
let count=0;
function test(name,fn) {
  fn();count++;console.log('OK '+name);
}
function fixture(options={}) {
  const messages=[];
  let caught=0;
  const world={roads,buildings:options.buildings||[],isBlocked:()=>!!options.freeze};
  const create=()=>({position:{set(){}},rotation:{y:0},userData:{lights:[]}});
  const police=new BN.Police(world,create,()=>caught++,m=>messages.push(m));
  return {police,world,messages,caught:()=>caught};
}
function tick(police,seconds,target,speed=10) {
  for(let t=0;t<seconds-0.00001;t+=0.1)police.update(0.1,target,speed);
}
function place(police,points) {
  police.units.forEach((unit,i)=>Object.assign(unit,points[i]||{x:-240,z:-240}));
}

test('crime records its position and dispatches bounded reinforcements',()=>{
  const {police,messages}=fixture({freeze:true});
  const target={x:0,z:0};
  police.report('Atropelamento',4,target);
  assert.equal(police.state,'dispatch');
  assert.equal(police.level,2);
  assert.equal(police.units.length,2);
  assert.equal(police.lastSeen.x,target.x);
  assert.equal(police.lastSeen.z,target.z);
  assert.equal(messages.length,1);
  assert.ok(police.units.length<=BN.CONFIG.maxPolice);
});

test('a building blocks sight while a clear parallel street does not',()=>{
  const buildings=[{minX:8,maxX:12,minZ:-3,maxZ:3}];
  assert.equal(BN.hasLineOfSight({x:0,z:0},{x:20,z:0},buildings),false);
  assert.equal(BN.hasLineOfSight({x:0,z:8},{x:20,z:8},buildings),true);
});

test('alert never clears while the player remains visible',()=>{
  const {police}=fixture({freeze:true});
  const target={x:0,z:0};
  police.report('Crime',2,target);
  place(police,[{x:35,z:0},{x:-240,z:-240}]);
  tick(police,BN.CONFIG.policeSearchTime+10,target);
  assert.equal(police.state,'chase');
  assert.ok(police.level>0);
  assert.equal(police.search,0);
});

test('search waits for lost sight and the player must leave the last seen area',()=>{
  const {police}=fixture({freeze:true});
  police.report('Crime',2,{x:0,z:0});
  place(police,[{x:-240,z:-240},{x:-240,z:240}]);
  tick(police,2,{x:0,z:0});
  assert.notEqual(police.state,'search');
  tick(police,BN.CONFIG.policeSearchTime+8,{x:0,z:0});
  assert.equal(police.state,'search');
  assert.equal(police.search,0);
  assert.ok(police.level>0);
  tick(police,BN.CONFIG.policeSearchTime-1,{x:150,z:150});
  assert.ok(police.level>0);
  tick(police,2,{x:150,z:150});
  assert.equal(police.level,0);
  assert.equal(police.state,'patrol');
});

test('returning to the search area or being seen resets escape progress',()=>{
  const {police}=fixture({freeze:true});
  police.report('Crime',2,{x:0,z:0});
  place(police,[{x:-240,z:-240},{x:-240,z:240}]);
  tick(police,14,{x:150,z:150});
  assert.ok(police.search>0);
  police.update(0.1,{x:10,z:10},10);
  assert.equal(police.search,0);
  tick(police,5,{x:150,z:150});
  assert.ok(police.search>0);
  place(police,[{x:140,z:150},{x:-240,z:240}]);
  police.update(0.1,{x:150,z:150},10);
  assert.equal(police.state,'chase');
  assert.equal(police.search,0);
  assert.equal(police.lastSeen.x,150);
});

test('capture uses a nearby visible unit and clears pursuit state',()=>{
  const {police,caught}=fixture({freeze:true});
  police.report('Crime',2,{x:0,z:0});
  place(police,[{x:4,z:0},{x:-240,z:240}]);
  tick(police,3.4,{x:0,z:0},0);
  assert.equal(caught(),1);
  assert.equal(police.level,0);
  assert.equal(police.capture,0);
  assert.equal(police.visible,false);
  assert.equal(police.state,'patrol');
});

test('an occluded nearby unit cannot capture for a distant observer',()=>{
  const buildings=[{minX:1,maxX:3,minZ:-1,maxZ:1}];
  const {police,caught}=fixture({freeze:true,buildings});
  police.report('Crime',2,{x:0,z:0});
  place(police,[{x:4,z:0},{x:0,z:40}]);
  tick(police,4,{x:0,z:0},0);
  assert.equal(police.visible,true);
  assert.equal(caught(),0);
  assert.equal(police.capture,0);
});

test('road routes stay axis aligned and cross the canal only on bridges',()=>{
  const samples=[[-123,0],[0,37],[80,205],[240,-189],[-199,-160],[160,219]];
  for(const from of samples)for(const to of samples) {
    let prev={x:from[0],z:from[1]};
    const route=BN.roadRoute(roads,prev,{x:to[0],z:to[1]});
    for(const next of route) {
      assert.ok(Math.abs(next.x-prev.x)<0.00001||Math.abs(next.z-prev.z)<0.00001);
      if(Math.min(prev.x,next.x)<132&&Math.max(prev.x,next.x)>106) {
        assert.ok(roads.includes(prev.z)&&prev.z===next.z);
      }
      prev=next;
    }
  }
});

test('refreshing a chase route keeps moving toward a same-street target',()=>{
  const {police}=fixture();
  const target={x:80,z:0};
  police.report('Crime',2,target);
  place(police,[{x:-123,z:0},{x:-240,z:240}]);
  const unit=police.units[0];
  for(let i=0;i<25;i++) {
    const before=unit.x;
    unit.routeTimer=0;
    police.update(0.1,target,15);
    assert.ok(unit.x>before,'route refresh reversed the pursuing car');
    assert.equal(unit.z,0);
  }
});

test('a patrol finishes its existing route instead of changing it on a timer',()=>{
  const {police}=fixture();
  const unit=police.units[0];
  unit.path=[{x:240,z:0}];
  unit.routeTimer=0;
  const before=unit.patrolStep;
  police.update(0.1,{x:0,z:200},0);
  assert.equal(unit.patrolStep,before);
  assert.equal(unit.path[0].x,240);
  assert.ok(unit.x>-160);
});

test('repeated reports do not hold back reinforcements',()=>{
  const {police}=fixture({freeze:true});
  for(let t=0;t<40;t+=2){police.report('Crime',4,{x:0,z:0});tick(police,2,{x:150,z:150});}
  assert.equal(police.level,5);
  assert.equal(police.units.length,BN.CONFIG.maxPolice);
});

test('an officer on foot cannot arrest through a wall',()=>{
  const buildings=[{minX:1,maxX:1.6,minZ:-6,maxZ:6}];
  const {police,caught}=fixture({freeze:true,buildings});
  police.report('Crime',2,{x:0,z:0});
  place(police,[{x:60,z:0},{x:-240,z:240}]);
  Object.assign(police.units[0],{foot:true,back:false,backTime:0,fx:2.2,fz:0,fh:0,fspeed:0});
  tick(police,6,{x:0,z:0},0);
  assert.equal(caught(),0);
});

test('a searching officer on foot only reacts inside the vision cone',()=>{
  const {police}=fixture({freeze:true});
  police.report('Crime',2,{x:0,z:0});
  place(police,[{x:200,z:200},{x:-240,z:240}]);
  police.state='search';police.unseen=99;police.lastSeen={x:0,z:50};
  const u=police.units[0];Object.assign(u,{foot:true,back:false,backTime:0,fx:0,fz:0,fh:0,fspeed:0});
  assert.equal(police.sees(u,{x:0,z:30}),true);
  assert.equal(police.sees(u,{x:0,z:-30}),false);
  police.walk(u,0.1,{x:0,z:-30},0,true);
  assert.equal(u.fh,0);
});

test('an unseen vehicle swap shortens recognition range and the search',()=>{
  const {police}=fixture({freeze:true});
  police.report('Crime',2,{x:0,z:0});
  place(police,[{x:40,z:0},{x:-240,z:240}]);
  police.disguise=true;
  assert.equal(police.sees(police.units[0],{x:0,z:0}),false);
  police.disguise=false;
  assert.equal(police.sees(police.units[0],{x:0,z:0}),true);
});

console.log(count+' police checks passed');
