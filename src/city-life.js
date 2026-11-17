/* SPDX-License-Identifier: MIT */
(function(){
  'use strict';
  const BN=window.BN=window.BN||{};
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  BN.createCityLife=function(T,scene,world,onMessage){
    const actors=[],cyclists=[],planes=[],companions=[],materials={
      dark:new T.MeshStandardMaterial({color:0x172b34,roughness:.85}),
      metal:new T.MeshStandardMaterial({color:0x829095,roughness:.35,metalness:.55}),
      coral:new T.MeshStandardMaterial({color:0xff805b,roughness:.7}),
      cream:new T.MeshStandardMaterial({color:0xfff1cf,roughness:.8}),
      mint:new T.MeshStandardMaterial({color:0x72cdbd,roughness:.7}),
      smoke:new T.PointsMaterial({color:0xdce4df,size:.18,transparent:true,opacity:.45,depthWrite:false})
    };
    const add=(geo,mat,parent,x,y,z)=>{const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
    function human(role,x,z,shirt,scale=.82){
      const mesh=BN.createHuman(T,shirt,[0x68483b,0xb88460,0xe6bd96,0x905e47][actors.length%4]);mesh.position.set(x,0,z);mesh.scale.setScalar(scale);scene.add(mesh);
      const actor={role,x,z,mesh,phase:actors.length*1.7,home:{x,z},state:'idle'};actors.push(actor);return actor;
    }
    function bicycle(x,z,index){
      const group=new T.Group(),wheelGeo=new T.TorusGeometry(.43,.055,7,16);
      for(const zz of [-.72,.72]){const wheel=add(wheelGeo,materials.dark,group,0,.54,zz);wheel.rotation.y=Math.PI/2;}
      const frame=add(new T.BoxGeometry(.08,.08,1.18),index%2?materials.coral:materials.mint,group,0,.75,0);frame.rotation.x=.55;
      add(new T.BoxGeometry(.65,.07,.07),materials.dark,group,0,1.03,-.52);
      const rider=BN.createHuman(T,index%2?0x6fa4c7:0xe6b56f,[0x68483b,0xb88460,0xe6bd96][index%3]);rider.scale.setScalar(.72);rider.position.y=.88;rider.rotation.y=Math.PI/2;group.add(rider);
      scene.add(group);const vertical=index%2===0,road=world.roads[(index*2+1)%world.roads.length],line=road+(index%3===0?2.7:-2.7);
      const cyclist={group,rider,x:vertical?line:-250,z:vertical?-250:line,vertical,dir:1,speed:4.3+index*.25};group.position.set(cyclist.x,0,cyclist.z);cyclists.push(cyclist);
    }
    for(let i=0;i<8;i++)bicycle(0,0,i);
    // Park parcels contain distinct activities rather than generic walkers only.
    world.parks.forEach((park,pi)=>{
      const offsets=[[-8,-6],[7,-5],[-6,7],[8,6]];
      offsets.forEach((offset,i)=>{const role=i<2?'player':i===2?'reader':'walker',actor=human(role,park.x+offset[0],park.z+offset[1],[0x72b8a0,0xe6b56f,0xd78b9c,0x85a4c1][(pi+i)%4],.78);actor.park=park;});
      const ball=add(new T.SphereGeometry(.28,10,7),pi%2?materials.coral:materials.cream,scene,park.x,1.2,park.z);ball.userData={park,phase:pi*1.3};
    });
    // A reserved parcel hosts a construction crew and visible scaffolding.
    const construction={x:-184,z:138};
    add(new T.BoxGeometry(18,.6,15),materials.dark,scene,construction.x,.3,construction.z);
    for(let x=-191;x<=-177;x+=3.5)for(const z of [132,144])add(new T.CylinderGeometry(.055,.055,6,7),materials.metal,scene,x,3,z);
    for(let y=1.2;y<=5.5;y+=2.1)add(new T.BoxGeometry(16,.12,.6),materials.coral,scene,construction.x,y,132);
    for(let i=0;i<7;i++){const worker=human('worker',construction.x-6+(i%4)*4,construction.z-4+Math.floor(i/4)*7,0xf0c35f,.82);worker.work=i%3;}
    // Street roles are deliberately placed on sidewalk lines, never in parcels.
    const smokers=[];[[-229,-118],[91,118],[171,38],[-149,-38]].forEach((p,i)=>{const actor=human('smoker',p[0],p[1],0x7f91b7,.8);actor.smoke=i*.8;smokers.push(actor);});
    [[-229,175],[-149,95]].forEach((p,i)=>{const actor=human('resting',p[0],p[1],0x81766e,.78);actor.mesh.rotation.z=.08;});
    const smokeCount=24,smokeData=new Float32Array(smokeCount*3),smokeGeo=new T.BufferGeometry();smokeGeo.setAttribute('position',new T.BufferAttribute(smokeData,3));const smokeCloud=new T.Points(smokeGeo,materials.smoke);scene.add(smokeCloud);
    [[-229,-205],[91,-125],[171,115],[251,-45]].forEach((p,i)=>{const actor=human('companion',p[0],p[1],[0xd85b7d,0x8e68b0,0xe28b62,0x5fa7a0][i],.84);actor.adult=true;companions.push(actor);});
    const streetDetails=[];
    for(let i=0;i<18;i++){
      const vertical=i%2===0,road=world.roads[(i*3)%world.roads.length],along=-210+(i%6)*72,x=vertical?road+11:along,z=vertical?along:road+11,g=new T.Group();g.position.set(x,0,z);scene.add(g);
      if(i%3===0){add(new T.CylinderGeometry(.34,.40,.82,8),materials.dark,g,0,.41,0);add(new T.CylinderGeometry(.37,.37,.08,8),materials.metal,g,0,.85,0);}
      else{const bag=add(new T.SphereGeometry(.38,8,6),i%2?materials.dark:materials.coral,g,0,.28,0);bag.scale.set(1,.75,.9);add(new T.SphereGeometry(.08,7,5),materials.dark,g,0,.62,0);}
      streetDetails.push({group:g,x,z});
    }
    for(let i=0;i<2;i++){
      const group=new T.Group();add(new T.SphereGeometry(1,10,7),materials.cream,group,0,0,0).scale.set(.35,.30,2.2);add(new T.BoxGeometry(4,.08,.55),materials.cream,group,0,0,0);add(new T.BoxGeometry(1.2,.08,.5),materials.coral,group,0,.12,-1.7);group.position.set(-310-i*80,80+i*11,-210+i*90);scene.add(group);planes.push({group,speed:12+i*2});
    }
    const incidentActors=[human('incident-victim',-229,35,0x72b8a0,.8),human('incident-offender',-229,38,0xb76855,.8)];incidentActors.forEach(a=>a.mesh.visible=false);
    const ambientCruiser=BN.createCar(T,0xe7eee7,true);ambientCruiser.visible=false;scene.add(ambientCruiser);
    const incident={timer:55,active:0,route:[],waypoint:0,x:0,z:0,count:0};
    function startIncident(focus){
      const road=world.roads[(incident.count*3+1)%world.roads.length],vertical=incident.count%2===0;
      incident.x=vertical?road+10:-160;incident.z=vertical?-160:road+10;incident.active=18;incident.count++;
      const [victim,offender]=incidentActors;Object.assign(victim,{x:incident.x,z:incident.z,state:'cower'});Object.assign(offender,{x:incident.x+2,z:incident.z+2,state:'flee'});victim.mesh.visible=offender.mesh.visible=true;
      victim.mesh.position.set(victim.x,0,victim.z);offender.mesh.position.set(offender.x,0,offender.z);
      incident.route=BN.roadRoute(world.roads,{x:-240,z:-240},{x:incident.x,z:incident.z});incident.waypoint=0;ambientCruiser.visible=true;ambientCruiser.position.set(-240,0,-240);
      if(focus&&dist(focus,incident)<100)onMessage('Ocorrência na vizinhança · uma viatura está a caminho');
    }
    function animateHuman(actor,time,amount){const data=actor.mesh.userData;(data.legs||[]).forEach((leg,i)=>leg.rotation.x=Math.sin(time+i*Math.PI)*amount);(data.arms||[]).forEach((arm,i)=>arm.rotation.x=-Math.sin(time+i*Math.PI)*amount*.75);}
    function update(dt,state){
      const time=state.time||0,focus=state.focus||{x:0,z:0},night=state.night||0,rain=state.rain||0;
      cyclists.forEach((cyclist,i)=>{const axis=cyclist.vertical?'z':'x';cyclist[axis]+=cyclist.dir*cyclist.speed*dt;if(cyclist[axis]>260||cyclist[axis]<-260){cyclist.dir*=-1;cyclist[axis]=Math.max(-260,Math.min(260,cyclist[axis]));}cyclist.group.position.set(cyclist.x,0,cyclist.z);cyclist.group.rotation.y=cyclist.vertical?(cyclist.dir>0?0:Math.PI):(cyclist.dir>0?Math.PI/2:-Math.PI/2);animateHuman({mesh:cyclist.rider},time*7+i,.38);cyclist.group.visible=dist(cyclist,focus)<180;});
      actors.forEach((actor,i)=>{let amount=.04;if(actor.role==='player'){amount=.28;actor.mesh.userData.arms[0].rotation.z=Math.sin(time*2+actor.phase)*.8;}else if(actor.role==='worker'){amount=.18;actor.mesh.userData.arms[actor.work%2].rotation.x=-1.2+Math.sin(time*3+actor.phase)*.65;}else if(actor.role==='smoker'){amount=.03;actor.mesh.userData.arms[0].rotation.x=-2.25;}else if(actor.role==='resting'){actor.mesh.scale.y=.64;}else if(actor.role==='companion'){amount=.08;actor.mesh.rotation.y=Math.sin(time*.7+actor.phase)*.25;}else if(actor.state==='flee'){amount=.65;actor.x+=Math.sin(actor.phase)*dt*3.8;actor.z+=Math.cos(actor.phase)*dt*3.8;actor.mesh.position.set(actor.x,0,actor.z);}else if(actor.state==='cower'){actor.mesh.scale.y=.62;actor.mesh.userData.arms.forEach(a=>a.rotation.x=-2.5);}actor.mesh.position.y=world.getElevation(actor.x,actor.z);animateHuman(actor,time*(actor.role==='worker'?5:3)+actor.phase,amount);actor.mesh.visible=actor.state!=='riding'&&(actor.role!=='companion'||night>.45)&&(!(actor.role||'').startsWith('incident-')||incident.active>0)&&dist(actor,focus)<145;});
      scene.children.forEach(object=>{if(object.userData&&object.userData.park){const park=object.userData.park,phase=object.userData.phase;object.position.set(park.x+Math.sin(time*.8+phase)*5,world.getElevation(park.x+Math.sin(time*.8+phase)*5,park.z+Math.cos(time*.8+phase)*4)+1+Math.abs(Math.sin(time*1.6+phase))*2.4,park.z+Math.cos(time*.8+phase)*4);}});
      for(let i=0;i<smokeCount;i++){const smoker=smokers[i%smokers.length],age=(time*.24+i*.173)%1;smokeData[i*3]=smoker.x+Math.sin(time+i)*age*.22;smokeData[i*3+1]=1.65+age*1.8;smokeData[i*3+2]=smoker.z+Math.cos(time*.7+i)*age*.22;}smokeGeo.attributes.position.needsUpdate=true;smokeCloud.visible=rain<.45;
      streetDetails.forEach(detail=>detail.group.visible=dist(detail,focus)<135);
      planes.forEach((plane,i)=>{plane.group.position.x+=plane.speed*dt;if(plane.group.position.x>340)plane.group.position.x=-340;plane.group.visible=rain<.75;});
      incident.timer-=dt;if(incident.active<=0&&incident.timer<=0){startIncident(focus);incident.timer=85+incident.count%3*24;}
      if(incident.active>0){incident.active-=dt;const goal=incident.route[Math.min(incident.waypoint,incident.route.length-1)];if(goal){const dx=goal.x-ambientCruiser.position.x,dz=goal.z-ambientCruiser.position.z,d=Math.hypot(dx,dz);if(d<1.5)incident.waypoint++;else{ambientCruiser.position.x+=dx/d*13*dt;ambientCruiser.position.z+=dz/d*13*dt;ambientCruiser.rotation.y=Math.atan2(dx,dz);}}if(incident.active<=0){ambientCruiser.visible=false;incidentActors.forEach(a=>{a.mesh.visible=false;a.state='idle';a.mesh.scale.y=.8;});}}
    }
    function nearestCompanion(point,max=13){return companions.filter(a=>a.mesh.visible&&dist(a,point)<max).sort((a,b)=>dist(a,point)-dist(b,point))[0]||null;}
    function boardCompanion(actor){actor.mesh.visible=false;actor.state='riding';}
    function releaseCompanion(actor){actor.state='idle';actor.x=actor.home.x;actor.z=actor.home.z;actor.mesh.position.set(actor.x,0,actor.z);actor.mesh.visible=true;}
    return {update,actors,cyclists,planes,companions,incident,nearestCompanion,boardCompanion,releaseCompanion,counts:{cyclists:cyclists.length,workers:actors.filter(a=>a.role==='worker').length,parkActivities:actors.filter(a=>a.park).length,companions:companions.length,planes:planes.length,streetDetails:streetDetails.length}};
  };
})();
