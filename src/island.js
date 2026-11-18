/* SPDX-License-Identifier: MIT */
(function(){
  'use strict';
  const BN=window.BN=window.BN||{};
  const COASTLINE=Object.freeze([
    [-255,-265],[-72,-296],[115,-286],[270,-270],[294,-170],[292,-114],
    [280,-110],[255,-72],[265,-28],[292,8],[294,150],[250,260],[82,292],
    [-88,296],[-250,265],[-292,155],[-300,12],[-282,-150]
  ].map(([x,z])=>Object.freeze({x,z})));
  const PLAYABLE=Object.freeze(COASTLINE.map(point=>Object.freeze({x:point.x*.965,z:point.z*.965})));
  const LANDMASS=Object.freeze(COASTLINE.map(point=>Object.freeze({x:point.x*.995,z:point.z*.995})));
  const BEACH_SEGMENTS=Object.freeze([2,3,4,7,8,9,10]);
  const BEACH_POLYGONS=Object.freeze(BEACH_SEGMENTS.map(segment=>{
    const a=COASTLINE[segment],b=COASTLINE[(segment+1)%COASTLINE.length];
    return Object.freeze([{x:a.x*.965,z:a.z*.965},{x:b.x*.965,z:b.z*.965},{x:b.x*1.015,z:b.z*1.015},{x:a.x*1.015,z:a.z*1.015}].map(Object.freeze));
  }));
  function containsPoint(x,z,points=COASTLINE){
    let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[i],b=points[j],cross=(a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/((b.z-a.z)||1e-9)+a.x;if(cross)inside=!inside;
    }return inside;
  }
  function distanceToEdge(x,z,points=COASTLINE){
    let best=Infinity;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1))),px=a.x+dx*t,pz=a.z+dz*t;best=Math.min(best,Math.hypot(x-px,z-pz));}return best;
  }
  function containsCircleIn(x,z,r,points){return containsPoint(x,z,points)&&distanceToEdge(x,z,points)>=r;}
  function containsCircle(x,z,r=0){return containsCircleIn(x,z,r,PLAYABLE);}
  function containsBeachCircle(x,z,r=0){return BEACH_POLYGONS.some(points=>containsCircleIn(x,z,r,points));}
  function coastPoint(segment,t=.5,scale=1){const a=COASTLINE[segment],b=COASTLINE[(segment+1)%COASTLINE.length],x=(a.x+(b.x-a.x)*t)*scale,z=(a.z+(b.z-a.z)*t)*scale;return {x,z,angle:Math.atan2(b.x-a.x,b.z-a.z),segment,t,scale};}
  function clampPoint(x,z,margin=2){let px=x,pz=z;for(let i=0;i<40&&!containsCircle(px,pz,margin);i++){px*=.94;pz*=.94;}return {x:px,z:pz};}
  function scaled(points,scale){return points.map(p=>({x:p.x*scale,z:p.z*scale}));}
  function shapeGeometry(T,points){const shape=new T.Shape();points.forEach((p,i)=>i?shape.lineTo(p.x,p.z):shape.moveTo(p.x,p.z));shape.closePath();const geometry=new T.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);return geometry;}
  BN.createIsland=function(T,scene,materials){
    const waterMat=materials.water,landMat=materials.land,sandMat=materials.sand,roadMat=materials.road,cream=materials.cream;
    const waterGeo=new T.PlaneGeometry(2400,2400,36,36);waterGeo.rotateX(-Math.PI/2);const water=new T.Mesh(waterGeo,waterMat);water.position.y=-.55;scene.add(water);
    const sand=new T.Group();BEACH_POLYGONS.forEach(points=>{const patch=new T.Mesh(shapeGeometry(T,points),sandMat);patch.position.y=.025;patch.receiveShadow=true;sand.add(patch);});scene.add(sand);
    const land=new T.Mesh(shapeGeometry(T,LANDMASS),landMat);land.position.y=.015;land.receiveShadow=true;scene.add(land);
    const coastRoad=[],roadPoints=scaled(COASTLINE,.92),skip=new Set([2,5,6,13,14]);
    for(let i=0;i<roadPoints.length;i++){
      if(skip.has(i))continue;const a=roadPoints[i],b=roadPoints[(i+1)%roadPoints.length],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),mesh=new T.Mesh(new T.BoxGeometry(1,1,1),roadMat);mesh.position.set((a.x+b.x)/2,.18,(a.z+b.z)/2);mesh.scale.set(10,.08,length+1);mesh.rotation.y=Math.atan2(dx,dz);mesh.receiveShadow=true;scene.add(mesh);coastRoad.push({a,b,mesh});
      for(let k=8;k<length-7;k+=13){const t=k/length,x=a.x+dx*t,z=a.z+dz*t,mark=new T.Mesh(new T.BoxGeometry(.18,.03,4),cream);mark.position.set(x,.24,z);mark.rotation.y=Math.atan2(dx,dz);scene.add(mark);}
    }
    const distanceToCoastRoad=(x,z)=>{let best=Infinity;for(const segment of coastRoad){const {a,b}=segment,dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1))),px=a.x+dx*t,pz=a.z+dz*t;best=Math.min(best,Math.hypot(x-px,z-pz));}return best;};
    // Scenic closures turn selected street ends into destinations instead of abrupt water exits.
    const closures=[{x:-240,z:-247,kind:'mirante'},{x:-160,z:264,kind:'praca'},{x:80,z:264,kind:'hotel'},{x:246,z:160,kind:'marina'},{x:-258,z:80,kind:'parque'}];
    closures.forEach((point,i)=>{const pad=new T.Mesh(new T.CylinderGeometry(8,8,.24,20),i%2?landMat:sandMat);pad.position.set(point.x,.2,point.z);scene.add(pad);for(let a=0;a<6;a++){const rail=new T.Mesh(new T.BoxGeometry(2.3,.55,.18),cream);const angle=a*Math.PI/5-Math.PI/2;rail.position.set(point.x+Math.cos(angle)*7,.65,point.z+Math.sin(angle)*7);rail.rotation.y=-angle;scene.add(rail);}});
    const islandMat=new T.MeshStandardMaterial({color:0x426d59,roughness:.95}),islandLight=new T.MeshStandardMaterial({color:0xffcf83,emissive:0xffaa55,emissiveIntensity:1.6}),dark=new T.MeshStandardMaterial({color:0x172b34,roughness:.65,metalness:.25});
    const distant=new T.Group();distant.position.set(-130,0,-650);scene.add(distant);
    const mound=(x,y,z,sx,sy,sz,color=islandMat)=>{const mesh=new T.Mesh(new T.IcosahedronGeometry(1,2),color);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);distant.add(mesh);return mesh;};
    mound(0,5,0,88,8,32);mound(-35,13,-3,48,17,25);mound(42,9,5,55,12,27);
    for(let i=0;i<24;i++){const x=-70+(i%12)*12,z=-12+Math.sin(i*1.7)*10,light=new T.Mesh(new T.SphereGeometry(.8,7,5),islandLight);light.position.set(x,7+(i%4)*2,z);distant.add(light);}
    const lighthouse=new T.Group();lighthouse.position.set(35,7,-5);distant.add(lighthouse);const tower=new T.Mesh(new T.CylinderGeometry(2,3,22,10),cream);tower.position.y=11;lighthouse.add(tower);const cap=new T.Mesh(new T.CylinderGeometry(2.8,2.8,2,10),materials.coral);cap.position.y=22;lighthouse.add(cap);const beacon=new T.PointLight(0xffc46b,80,180);beacon.position.y=24;lighthouse.add(beacon);
    const ship=new T.Group();ship.position.set(80,1,-560);scene.add(ship);const hull=new T.Mesh(new T.BoxGeometry(86,10,20),dark);hull.position.y=5;ship.add(hull);const cabin=new T.Mesh(new T.BoxGeometry(18,13,17),cream);cabin.position.set(-27,15,0);ship.add(cabin);const containerColors=[0xd2614f,0xe0ae52,0x4f8f8b,0x596f94];for(let row=0;row<3;row++)for(let i=0;i<9;i++){const c=new T.Mesh(new T.BoxGeometry(7.5,3.6,16),new T.MeshStandardMaterial({color:containerColors[(i+row)%4],roughness:.8}));c.position.set(-10+i*8.2,11+row*3.8,0);ship.add(c);}
    const storm=new T.Group();storm.position.set(205,105,-610);scene.add(storm);for(let i=0;i<20;i++){const cloud=new T.Mesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:i%3?0x33445a:0x26364d,roughness:1}));const a=i*.9;cloud.position.set(Math.cos(a)*(25+i%4*8),(i%5)*7,Math.sin(a)*14);cloud.scale.set(25+i%3*7,17+i%4*4,19);storm.add(cloud);}const lightning=new T.PointLight(0xcbdcff,0,520);lightning.position.set(0,-20,0);storm.add(lightning);
    const buoys=[];for(let i=0;i<12;i++){const buoy=new T.Mesh(new T.CylinderGeometry(.7,1,2.5,8),i%2?materials.coral:cream);const angle=i*.95,radius=355+i%3*25;buoy.position.set(Math.cos(angle)*radius,.6,Math.sin(angle)*radius);scene.add(buoy);buoys.push(buoy);}
    function update(time,night,rain){ship.position.x=80+Math.sin(time*.035)*120;ship.rotation.y=.03;distant.visible=true;storm.visible=rain>.2||night>.72;storm.position.y=105+Math.sin(time*.08)*4;lightning.intensity=storm.visible&&Math.sin(time*1.7)>.992?850:0;beacon.intensity=35+night*120;lighthouse.rotation.y=time*.11;buoys.forEach((b,i)=>b.position.y=.6+Math.sin(time*1.2+i)*.25);}
    return {water,land,sand,coastline:COASTLINE,coastRoad,distanceToCoastRoad,closures,beachSegments:BEACH_SEGMENTS,containsPoint,containsCircle,containsBeachCircle,distanceToEdge,clampPoint,coastPoint,update,scenery:{distant,ship,storm,buoys}};
  };
  BN.ISLAND=Object.freeze({COASTLINE,PLAYABLE,LANDMASS,BEACH_SEGMENTS,BEACH_POLYGONS,containsPoint,distanceToEdge,containsCircle,containsBeachCircle,clampPoint,coastPoint});
})();
