/* SPDX-License-Identifier: MIT */
(function () {
  'use strict';
  const BN = window.BN = window.BN || {};
  const cache = new WeakMap();
  function kit(T) {
    if (cache.has(T)) return cache.get(T);
    const k = {
      box: new T.BoxGeometry(1, 1, 1),
      cylinder: new T.CylinderGeometry(1, 1, 1, 7),
      cylinder12: new T.CylinderGeometry(1, 1, 1, 12),
      cone: new T.ConeGeometry(1, 1, 6),
      sphere: new T.IcosahedronGeometry(1, 0),
      round: new T.SphereGeometry(1, 14, 9),
      matte: new T.MeshStandardMaterial({vertexColors:true, roughness:.83, flatShading:true}),
      rubber: new T.MeshStandardMaterial({color:0x19252a, roughness:.95}),
      window: new T.MeshStandardMaterial({color:0x213d4c, metalness:.35, roughness:.25}),
      red: new T.MeshBasicMaterial({color:0xff385f}),
      blue: new T.MeshBasicMaterial({color:0x39bfff}),
      head: new T.MeshStandardMaterial({color:0xc2bb9f,emissive:0xffe5ad,emissiveIntensity:.12,roughness:.25})
    };
    cache.set(T, k);
    return k;
  }
  function part(T, geometry, material, x,y,z, sx,sy,sz, parent) {
    const m = new T.Mesh(geometry,material);
    m.position.set(x,y,z); m.scale.set(sx,sy,sz);
    if(parent) parent.add(m);
    return m;
  }
  function solid(T, items) {
    const k=kit(T), pos=[], nor=[], col=[];
    const c=new T.Color(), v=new T.Vector3(), n=new T.Vector3();
    const mat=new T.Matrix4(), rot=new T.Quaternion(), scale=new T.Vector3();
    for (const o of items) {
      const original=o.geo || k.box;
      const geo=original.index?original.toNonIndexed():original.clone();
      rot.setFromEuler(new T.Euler(o.rx||0,o.ry||0,o.rz||0));
      mat.compose(new T.Vector3(o.x||0,o.y||0,o.z||0),rot,scale.set(o.sx||1,o.sy||1,o.sz||1));
      const nm=new T.Matrix3().getNormalMatrix(mat);
      c.set(o.color===undefined?0xffffff:o.color);
      const p=geo.attributes.position, nn=geo.attributes.normal;
      for(let i=0;i<p.count;i++){
        v.fromBufferAttribute(p,i).applyMatrix4(mat);
        n.fromBufferAttribute(nn,i).applyMatrix3(nm).normalize();
        pos.push(v.x,v.y,v.z); nor.push(n.x,n.y,n.z); col.push(c.r,c.g,c.b);
      }
      geo.dispose();
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
    g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));
    g.setAttribute('color',new T.Float32BufferAttribute(col,3));
    const m=new T.Mesh(g,k.matte); m.castShadow=true; m.receiveShadow=true;
    return m;
  }
  BN.createCar = function(T, color, police) {
    const k=kit(T), g=new T.Group();
    const paint=police?0xf0eee2:(color===undefined?0x32bab5:color),trim=police?0x17465a:paint;
    // Rounded low-poly volumes replace the old stack of boxes while keeping the same collision footprint.
    g.add(solid(T,[
      {geo:k.round,x:0,y:.70,z:0,sx:.96,sy:.34,sz:2.03,color:paint},
      {geo:k.round,x:0,y:.83,z:1.12,sx:.91,sy:.27,sz:1.02,color:paint},
      {geo:k.round,x:0,y:.82,z:-1.35,sx:.91,sy:.25,sz:.66,color:paint},
      {geo:k.round,x:0,y:1.20,z:-.25,sx:.76,sy:.43,sz:1.08,color:0x193d4a},
      {geo:k.round,x:0,y:1.57,z:-.30,sx:.78,sy:.16,sz:1.02,color:paint},
      {x:0,y:.57,z:2.08,sx:1.78,sy:.20,sz:.16,color:0xc1cbd0},
      {x:0,y:.56,z:-2.08,sx:1.76,sy:.18,sz:.16,color:0x263d46},
      {x:0,y:.84,z:2.10,sx:.62,sy:.10,sz:.04,color:0x172c37},
      {x:-.98,y:1.05,z:.18,sx:.16,sy:.16,sz:.28,color:paint},
      {x:.98,y:1.05,z:.18,sx:.16,sy:.16,sz:.28,color:paint},
      {x:-.91,y:.88,z:-.25,sx:.05,sy:.12,sz:1.35,color:trim},
      {x:.91,y:.88,z:-.25,sx:.05,sy:.12,sz:1.35,color:trim},
      {geo:k.round,x:-.78,y:.58,z:-1.25,sx:.34,sy:.28,sz:.48,color:paint},
      {geo:k.round,x:.78,y:.58,z:-1.25,sx:.34,sy:.28,sz:.48,color:paint},
      {geo:k.round,x:-.78,y:.58,z:1.25,sx:.34,sy:.28,sz:.48,color:paint},
      {geo:k.round,x:.78,y:.58,z:1.25,sx:.34,sy:.28,sz:.48,color:paint}
    ]));
    const wheels=[];
    for(const x of [-.96,.96])for(const z of [-1.25,1.25]) {
      const wheel=new T.Group();
      const tire=part(T,k.cylinder,k.rubber,0,0,0,.39,.22,.39,wheel); tire.rotation.z=Math.PI/2;
      const hub=part(T,k.cylinder,new T.MeshStandardMaterial({color:0x829095,metalness:.55,roughness:.35}),0,0,0,.19,.24,.19,wheel);hub.rotation.z=Math.PI/2;
      wheel.position.set(x,.39,z); g.add(wheel); wheels.push(wheel);
    }
    const headlights=[], lights=[];
    for(const x of [-.65,.65]) {
      headlights.push(part(T,k.round,k.head,x,.77,2.02,.20,.11,.065,g));
      part(T,k.round,k.red,x,.70,-2.02,.21,.09,.055,g);
    }
    if(police){
      part(T,k.box,k.rubber,0,1.73,-.25,1.15,.12,.30,g);
      const redBeacon=new T.MeshStandardMaterial({color:0x6b1529,emissive:0xff385f,emissiveIntensity:.05,roughness:.3});
      const blueBeacon=new T.MeshStandardMaterial({color:0x14567a,emissive:0x39bfff,emissiveIntensity:.05,roughness:.3});
      lights.push(part(T,k.box,redBeacon,-.34,1.83,-.25,.48,.15,.28,g));
      lights.push(part(T,k.box,blueBeacon,.34,1.83,-.25,.48,.15,.28,g));
    }
    g.userData={wheels,lights,headlights,length:4.3,width:2.05};
    return g;
  };
  BN.createHuman = function(T, shirtColor, skinColor) {
    const k=kit(T),g=new T.Group();
    const shirt=shirtColor===undefined?0xf87770:shirtColor, skin=skinColor===undefined?0x9e6847:skinColor;
    // Seven-sided cylinders and low-poly spheres keep the style light without looking like stacked cubes.
    g.add(solid(T,[
      {geo:k.cylinder12,y:1.18,sx:.31,sy:.64,sz:.27,color:shirt},
      {geo:k.round,y:1.43,sx:.43,sy:.22,sz:.30,color:shirt},
      {geo:k.round,y:.86,sx:.35,sy:.20,sz:.28,color:0x284451},
      {geo:k.round,y:1.78,sx:.29,sy:.34,sz:.28,color:skin},
      {geo:k.round,y:2.02,z:-.025,sx:.31,sy:.16,sz:.30,color:0x20242d},
      {geo:k.round,x:-.29,y:1.80,z:.02,sx:.055,sy:.10,sz:.07,color:skin},
      {geo:k.round,x:.29,y:1.80,z:.02,sx:.055,sy:.10,sz:.07,color:skin}
    ]));
    const legs=[],arms=[];
    for(const x of [-.16,.16]) {
      const leg=new T.Group(); leg.position.set(x,.78,0);
      leg.add(solid(T,[
        {geo:k.cylinder12,y:-.31,sx:.105,sy:.62,sz:.105,color:0x284451},
        {geo:k.round,y:-.65,z:.075,sx:.13,sy:.09,sz:.23,color:0xeee8ce}
      ]));
      g.add(leg); legs.push(leg);
      const side=Math.sign(x),arm=new T.Group();arm.position.set(side*.37,1.46,0);arm.rotation.z=-side*.08;
      arm.add(solid(T,[
        {geo:k.cylinder12,y:-.17,sx:.095,sy:.34,sz:.095,color:shirt},
        {geo:k.cylinder12,y:-.43,sx:.075,sy:.26,sz:.075,color:skin},
        {geo:k.round,y:-.58,sx:.09,sy:.10,sz:.09,color:skin}
      ]));
      g.add(arm); arms.push(arm);
    }
    g.userData={legs,arms}; return g;
  };
  BN.createAnimal = function(T,type) {
    const k=kit(T), g=new T.Group();
    if(type==='gull' || type==='bird') {
      g.add(solid(T,[{geo:k.round,y:0,sx:.33,sy:.16,sz:.6,color:0xf1eee7},{geo:k.round,y:.15,z:.44,sx:.15,sy:.15,sz:.16,color:0xffffff},{y:.12,z:.64,sx:.08,sy:.08,sz:.22,color:0xeab449}]));
      const wings=[];
      for(const s of [-1,1]){const w=new T.Group();w.position.x=s*.18;w.add(solid(T,[{x:s*.48,sx:1.0,sy:.035,sz:.25,rz:s*.06,color:0xd9e2db}]));g.add(w);wings.push(w);}
      g.userData.wings=wings;
    } else if(type==='butterfly' || type==='insect') {
      g.add(part(T,k.sphere,new T.MeshBasicMaterial({color:0x46352f}),0,0,0,.025,.025,.09));
      const wings=[];
      for(const s of [-1,1]){const w=new T.Group(); w.add(part(T,k.sphere,new T.MeshBasicMaterial({color:s<0?0xffb64e:0xf37b54}),s*.10,0,0,.12,.012,.15));g.add(w);wings.push(w);}
      g.userData.wings=wings;
    } else {
      g.add(solid(T,[
        {y:.45,sx:.37,sy:.35,sz:.77,color:0xc88a4b},
        {y:.68,z:.42,sx:.31,sy:.35,sz:.35,color:0xd8a05d},
        {y:.64,z:.64,sx:.21,sy:.16,sz:.25,color:0xb4773d},
        {y:.69,z:.77,sx:.15,sy:.10,sz:.06,color:0x202b30},
        {x:-.17,y:.80,z:.40,sx:.09,sy:.25,sz:.16,rz:.2,color:0x715438},
        {x:.17,y:.80,z:.40,sx:.09,sy:.25,sz:.16,rz:-.2,color:0x715438},
        {y:.60,z:-.50,sx:.09,sy:.12,sz:.40,rx:.5,color:0xc88a4b}
      ]));
      const legs=[];
      for(const x of [-.14,.14])for(const z of [-.27,.28]) {const l=part(T,k.box,new T.MeshStandardMaterial({color:0x986a42}),x,.18,z,.10,.34,.12,g);legs.push(l);}
      g.userData.legs=legs;
    }
    return g;
  };
  BN.createWorld = function(T, scene) {
    const k=kit(T), roads=[-240,-160,-80,0,80,160,240];
    const buildings=[], batches=new Map(), signs=[], animals=[], parks=[], alleys=[], lots=[], solidProps=[],tunnels=[],hills=[],beachProps=[],shoreProps=[];
    // Small solid objects (trunks, benches, fountains) live in a coarse grid so the check stays cheap.
    const props=new Map();
    function prop(x,z,r,kind='prop'){const item={x,z,r,kind};solidProps.push(item);const key=Math.floor(x/16)*1000+Math.floor(z/16);if(!props.has(key))props.set(key,[]);props.get(key).push(item);}
    let seed=631842;
    function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    const bounds={minX:-300,maxX:300,minZ:-300,maxZ:300};
    const matCache={};
    function material(color,roughness=.88) {const key=color+'_'+roughness;return matCache[key]||(matCache[key]=new T.MeshStandardMaterial({color,roughness,flatShading:true}));}
    function getElevation(x,z){
      let result=0;for(const hill of hills){const nx=(x-hill.x)/hill.rx,nz=(z-hill.z)/hill.rz,r2=nx*nx+nz*nz;if(r2<1)result=Math.max(result,hill.height*(1-r2)*(1-r2));}return result;
    }
    const asphalt=new T.MeshStandardMaterial({color:0x3c5158,roughness:.96});
    const lightMat=new T.MeshStandardMaterial({color:0xe8dab1,emissive:0xffdc83,emissiveIntensity:.1});
    const windowLit=new T.MeshStandardMaterial({color:0x51717d,emissive:0xffd99a,emissiveIntensity:0,roughness:.35,metalness:.2});
    const windowDark=new T.MeshStandardMaterial({color:0x2b515d,roughness:.33,metalness:.3});
    const trafficVertical=new T.MeshStandardMaterial({color:0xff4c40,emissive:0xff4c40,emissiveIntensity:.8});
    const trafficHorizontal=new T.MeshStandardMaterial({color:0x63ef98,emissive:0x63ef98,emissiveIntensity:.8});
    const shadowMat=material(0x457975), cream=material(0xf0dfbf), white=material(0xebede2);
    const palmMat=material(0x377f62), palmLight=material(0x65a771), trunk=material(0xaa9470);
    function inst(geo,mat,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0) {
      const key=geo.uuid+mat.uuid;
      if(!batches.has(key)) batches.set(key,{geo,mat,items:[]});
      batches.get(key).items.push({x,y,z,sx,sy,sz,rx,ry,rz});
    }
    function box(mat,x,y,z,sx,sy,sz,ry=0){inst(k.box,mat,x,y,z,sx,sy,sz,0,ry,0);}
    function palm(x,z,h=7,base=0){
      const roadMargin=8;if(!island.containsCircle(x,z,2)||roads.some(road=>Math.abs(x-road)<roadMargin||Math.abs(z-road)<roadMargin)||island.distanceToCoastRoad(x,z)<6)return false;
      prop(x,z,.35,'tree');
      inst(k.cylinder,trunk,x,base+h*.48,z,.24,h,.24,0,0,.04);
      for(let a=0;a<7;a++) {
        const angle=a*Math.PI*2/7;
        inst(k.cone,a%2?palmMat:palmLight,x+Math.sin(angle)*1.4,base+h-.2,z+Math.cos(angle)*1.4,.65,4.7,.22,Math.cos(angle)*1.14,0,-Math.sin(angle)*1.14);
      }
      inst(k.sphere,shadowMat,x,base+h-.5,z,.55,.55,.55);return true;
    }
    function bush(x,z,size=1.4,base=0){inst(k.sphere,palmLight,x,base+size*.65,z,size,size*.8,size);}
    function bench(x,z,angle=0,base=0){
      prop(x,z,1.1);
      box(trunk,x,base+.65,z,2.7,.20,.72,angle);
      const dx=Math.sin(angle)*.34,dz=Math.cos(angle)*.34;
      box(trunk,x-dx,base+1.1,z-dz,2.7,.70,.14,angle);
      for(const s of [-1,1])box(material(0x314b52),x+Math.cos(angle)*s,base+.30,z-Math.sin(angle)*s,.14,.6,.6,angle);
    }
    function lamp(x,z,ang=0){
      inst(k.cylinder,material(0x34515b),x,3.7,z,.09,7.4,.09);
      box(material(0x34515b),x+Math.sin(ang)*.7,7.35,z+Math.cos(ang)*.7,.12,.12,1.5,ang);
      box(lightMat,x+Math.sin(ang)*1.3,7.25,z+Math.cos(ang)*1.3,.8,.15,.7,ang);
    }
    function sign(text,x,y,z,w,angle,bg){
      const c=document.createElement('canvas');c.width=512;c.height=128;
      const q=c.getContext('2d');q.fillStyle=bg||'#203c4c';q.fillRect(0,0,512,128);
      q.strokeStyle='#fcba95';q.lineWidth=6;q.strokeRect(9,9,494,110);
      q.fillStyle='#fff0ce';q.font='bold 49px sans-serif';q.textAlign='center';q.textBaseline='middle';q.fillText(text,256,67,470);
      const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
      const mat=new T.MeshStandardMaterial({map:tex,emissive:0xffffff,emissiveMap:tex,emissiveIntensity:.32,roughness:.5});
      const m=new T.Mesh(new T.PlaneGeometry(w,w/4),mat);m.position.set(x,y,z);m.rotation.y=angle;scene.add(m);signs.push(mat);
      m.name=text; m.userData.kind='sign'; return m;
    }
    function facadeSign(text,x,y,z,w,bg){
      let nearest=buildings[0],distance=Infinity;
      for(const b of buildings){const dx=(b.minX+b.maxX)/2-x,dz=b.maxZ-z;const d=dx*dx+dz*dz;if(d<distance){distance=d;nearest=b;}}
      const width=Math.min(w,nearest.maxX-nearest.minX-2);
      const height=Math.max(width/8+.3,Math.min(y,nearest.height-width/8-.5));
      const mesh=sign(text,(nearest.minX+nearest.maxX)/2,height,nearest.maxZ+.12,width,0,bg);
      mesh.userData.mount='facade';mesh.userData.building=buildings.indexOf(nearest);
    }
    function building(x,z,w,d,h,color,style){
      const face=material(color),tower=style===3&&h>55,baseHeight=tower?8:h;
      const upperW=tower?w*(.62+rand()*.10):w,upperD=tower?d*(.62+rand()*.12):d;
      buildings.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,height:h,tower});
      if(tower){
        box(face,x,baseHeight/2,z,w,baseHeight,d);
        box(face,x,(h+baseHeight)/2,z,upperW,h-baseHeight,upperD);
        box(cream,x,baseHeight+.15,z,w+.35,.34,d+.35);
      }else box(face,x,h/2,z,w,h,d);
      box(cream,x,h+.2,z,upperW+.7,.65,upperD+.7);
      box(cream,x,1.1,z,w+.4,.9,d+.4);
      if(style===1){
        box(face,x,h+1.8,z,w*.65,3,d*.65);
        box(cream,x,h+3.4,z,w*.68,.45,d*.68);
        box(face,x,h+4,z,w*.32,1.5,d*.35);
      }
      for(let y=4;y<h-1;y+=3.6){
        const fw=tower&&y>baseHeight?upperW:w,fd=tower&&y>baseHeight?upperD:d;
        if(style===2)box(cream,x,y-1.3,z,fw+.2,.25,fd+.2);
        for(let wx=x-fw/2+1.7;wx<x+fw/2-1;wx+=3.2)for(const s of [-1,1])box(rand()<.67?windowLit:windowDark,wx,y,z+s*(fd/2+.025),1.25,1.75,.05);
        for(let wz=z-fd/2+1.7;wz<z+fd/2-1;wz+=3.2)for(const s of [-1,1])box(rand()<.67?windowLit:windowDark,x+s*(fw/2+.025),y,wz,.05,1.75,1.25);
      }
      box(windowDark,x,1.4,z+d/2+.04,1.6,2.6,.09);
      // Modular street level: every parcel gets an entrance and awning.
      const accent=material(style===1?0xf18b70:style===2?0x62b8ae:tower?0xffa66f:0xe5b657);
      box(accent,x,2.95,z+d/2+.65,Math.min(4.8,w*.55),.22,1.25);
      for(const s of [-1,1])box(cream,x+s*Math.min(2.15,w*.24),1.65,z+d/2+.32,.18,3.2,.45);
      if(style===2&&h>12)for(let by=6;by<h-2;by+=7){
        const bw=tower&&by>baseHeight?upperW:w;
        box(cream,x,by,z+(tower&&by>baseHeight?upperD:d)/2+.58,Math.min(bw*.66,11),.22,1.1);
        box(accent,x,by+.62,z+(tower&&by>baseHeight?upperD:d)/2+1.04,Math.min(bw*.66,11),.08,.08);
      }
      if(style===1&&w>15){
        box(windowDark,x-w*.28,1.7,z+d/2+.13,w*.25,2.5,.08);
        box(windowDark,x+w*.28,1.7,z+d/2+.13,w*.25,2.5,.08);
      }
      if(tower){
        // Staggered crown makes each skyscraper readable in the skyline.
        box(face,x,h+2,z,upperW*.72,3.6,upperD*.72);
        box(accent,x,h+4.1,z,upperW*.42,.6,upperD*.42);
        inst(k.cylinder,material(0xd2b8a2),x,h+10,z,.16,12,.16);
      }else if(h>27){
        box(material(0x8eaaa7),x+w*.24,h+.85,z-d*.18,2.5,1.2,3.6);
        inst(k.cylinder,material(0xd2b8a2),x-w*.2,h+2,z+d*.18,1.4,3,1.4);
      }
    }
    const waterMat=new T.MeshStandardMaterial({color:0x2ba7af,roughness:.28,metalness:.28,transparent:true,opacity:.94});
    const island=BN.createIsland(T,scene,{water:waterMat,land:material(0x83a68c),sand:material(0xe9d4a6),road:asphalt,cream});
    const water=island.water;
    // Canal and streets are clipped by the island instead of exposing a square slab.
    for(let z=-285;z<286;z+=10)if(island.containsCircle(119,z,13))box(material(0x348f9a),119,.065,z,26,.05,10.5);
    for(const r of roads){
      for(let t=-285;t<286;t+=10){
        if(island.containsCircle(r,t,13)){box(material(0xb5c4b3),r,.065,t,24,.10,10.5);box(asphalt,r,.13,t,14,.07,10.5);if(!roads.some(v=>Math.abs(t-v)<13))box(material(0xe7cf80),r,.185,t,.18,.02,5);}
        if(island.containsCircle(t,r,13)){box(material(0xb5c4b3),t,.072,r,10.5,.11,24);box(asphalt,t,.14,r,10.5,.07,14);if(!roads.some(v=>Math.abs(t-v)<13))box(material(0xe7cf80),t,.19,r,5,.02,.18);}
      }
      if(island.containsCircle(119,r,15)){
        box(material(0x9db8b6),119,.22,r,29,.22,20);box(asphalt,119,.35,r,29,.03,14);
        for(const s of [-1,1]){box(cream,119,1,r+s*9.2,29,.45,.3);for(let x=107;x<133;x+=4)box(cream,x,.65,r+s*9.2,.25,1.0,.25);}
      }
    }
    // A covered arterial segment creates a real drivable tunnel without blocking the road graph.
    const tunnel={minX:12,maxX:68,minZ:230,maxZ:250,z:240};tunnels.push(tunnel);
    const tunnelConcrete=material(0x6f8584),tunnelDark=material(0x263b42);
    box(tunnelConcrete,40,6.5,240,56,1.0,20);
    box(tunnelConcrete,40,3.2,230.8,56,6.4,1.6);
    box(tunnelConcrete,40,3.2,249.2,56,6.4,1.6);
    box(tunnelDark,40,6.0,240,52,.12,16);
    for(let x=16;x<=64;x+=8){box(lightMat,x,5.65,240,2.8,.10,.55);}
    for(const x of roads)for(const z of roads){
      if(!island.containsCircle(x,z,14))continue;
      for(const sign of [-1,1]) {
        for(let s=-5;s<=5;s+=1.5){box(white,x+s,.195,z+sign*9.2,.7,.025,2.8);box(white,x+sign*9.2,.20,z+s,2.8,.025,.7);}
      }
      lamp(x+10.5,z+11.0,Math.PI);
      if((x+z)%160===0)lamp(x-10.5,z-11.0,0);
      for(const s of [-1,1]){
        box(material(0x36565a),x+s*9.8,2.1,z-s*9.5,.18,4.2,.18);
        box(material(0x203d45),x+s*9.8,4.3,z-s*9.5,.45,.80,.36);
        box(trafficVertical,x+s*9.8,4.3,z-s*9.5+s*.19,.24,.24,.035);
        box(material(0x203d45),x+s*9.49,4.3,z-s*9.5,.36,.80,.45);
        box(trafficHorizontal,x+s*9.49+s*.19,4.3,z-s*9.5,.035,.24,.24);
      }
    }
    const colors=[0xebad98,0x9fcac1,0xe9cf9b,0xe6c3b5,0x91bbc8,0xc0b5cc,0xe9ded0,0xc5cbb9];
    const towerSlots=new Set(['2:1:1','2:1:7','2:2:4','2:3:2','2:3:8','3:1:4','3:1:7','3:3:4','3:3:8','3:4:4','4:1:1','4:2:4','4:2:7','4:3:1','6:1:4','6:3:1','6:5:4']);
    const reservedSlots=new Set(['1:5:5','4:3:2','4:3:5','3:4:1','4:4:0']);
    for(let ix=0;ix<8;ix++)for(let iz=0;iz<8;iz++){
      const minX=ix===0?-298:roads[ix-1]+12,maxX=ix===7?298:roads[ix]-12;
      const minZ=iz===0?-298:roads[iz-1]+12,maxZ=iz===7?298:roads[iz]-12;
      const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,cellW=maxX-minX,cellD=maxZ-minZ;
      // The eastern strip remains beach; the canal strip remains water and promenades.
      if(ix===7)continue;
      if(ix===5){
        box(material(0x639e79),94,.18,cz,14,.18,cellD);
        for(let z=minZ+7;z<maxZ-3;z+=13)palm(94,z,6+rand()*2);
        continue;
      }
      const park=(ix===2&&iz===5)||(ix===3&&iz===2)||(ix===1&&iz===4)||(ix===4&&iz===5);
      if(park){
        const halfX=cellW/2,halfZ=cellD/2,hill=ix===1&&iz===4;
        if(hill){hills.push({x:cx,z:cz,rx:halfX-3,rz:halfZ-3,height:6});inst(k.round,material(0x5c956f),cx,0,cz,halfX-3,6,halfZ-3);}
        box(material(0x639e79),cx,.18,cz,cellW,.18,cellD);
        parks.push({x:cx,z:cz,halfX,halfZ});prop(cx,cz,3.7);
        // Reserved park parcel: every tree, bench and fountain stays inside this boundary.
        for(let x=minX+2;x<=maxX-2;x+=4){box(cream,x,.45,minZ+.7,.3,.7,.3);box(cream,x,.45,maxZ-.7,.3,.7,.3);}
        for(let z=minZ+2;z<=maxZ-2;z+=4){box(cream,minX+.7,.45,z,.3,.7,.3);box(cream,maxX-.7,.45,z,.3,.7,.3);}
        if(hill){
          for(let x=minX+3;x<maxX-2;x+=2.2)box(material(0xd3c5a3),x,getElevation(x,cz)+.20,cz,2.3,.08,2.6);
          for(let z=minZ+3;z<maxZ-2;z+=2.2)box(material(0xd3c5a3),cx,getElevation(cx,z)+.21,z,2.6,.08,2.3);
        }else{
          box(material(0xd3c5a3),cx,.29,cz,3,.04,cellD-4);
          box(material(0xd3c5a3),cx,.29,cz,cellW-4,.04,3);
        }
        for(let i=0;i<13;i++){
          const a=i*2.399,r=.30+rand()*.58;
          const tx=cx+Math.cos(a)*(halfX-6)*r,tz=cz+Math.sin(a)*(halfZ-6)*r,base=getElevation(tx,tz);
          const bx=cx+Math.cos(a+.7)*(halfX-7)*r,bz=cz+Math.sin(a+.7)*(halfZ-7)*r;
          palm(tx,tz,5.5+rand()*4,base);bush(bx,bz,.8+rand()*.8,getElevation(bx,bz));
        }
        for(let i=0;i<56;i++){
          const gx=cx+(rand()-.5)*(cellW-7),gz=cz+(rand()-.5)*(cellD-7);if(Math.hypot(gx-cx,gz-cz)<5)continue;
          inst(k.cone,i%3?palmMat:palmLight,gx,getElevation(gx,gz)+.32,gz,.08+rand()*.08,.45+rand()*.35,.08+rand()*.08,0,rand()*6.28,0);
        }
        const b1={x:cx+halfX*.38,z:cz+halfZ*.30},b2={x:cx-halfX*.38,z:cz-halfZ*.30};bench(b1.x,b1.z,0,getElevation(b1.x,b1.z));bench(b2.x,b2.z,Math.PI,getElevation(b2.x,b2.z));
        const centerY=getElevation(cx,cz);inst(k.cylinder,cream,cx,centerY+.5,cz,3.6,.7,3.6);inst(k.cylinder,waterMat,cx,centerY+.9,cz,3.1,.06,3.1);inst(k.cone,cream,cx,centerY+1.9,cz,.5,2.3,.5);
        continue;
      }
      const downtown=ix>=2&&ix<=4&&iz>=1&&iz<=3,coastal=ix===6,alleyCell=downtown&&(ix+iz)%2===0,columns=alleyCell?2:downtown?3:2;
      const gapX=2.2,gapZ=2.4,colW=(cellW-gapX*(columns-1))/columns,rowD=(cellD-gapZ*2)/3;
      const buildW=colW-.2,buildD=rowD-.8;
      let slot=0;
      for(let col=0;col<columns;col++)for(let row=0;row<3;row++,slot++){
        const key=ix+':'+iz+':'+slot;
        if(reservedSlots.has(key))continue;
        const x=minX+colW/2+col*(colW+gapX),z=minZ+rowD/2+row*(rowD+gapZ);
        if(!island.containsCircle(x,z,Math.hypot(buildW/2,buildD/2)+1)||island.distanceToCoastRoad(x,z)<Math.hypot(buildW/2,buildD/2)+6)continue;
        const parking=(ix*5+iz*3)%11===0&&slot===5;
        if(parking){
          lots.push({x,z});box(asphalt,x,.2,z,buildW,.05,buildD);
          for(let line=-buildW/2+2;line<buildW/2;line+=3.4)box(white,x+line,.24,z,.12,.02,buildD*.76);
          box(material(0x2b62a8),x-buildW/2+.7,2.1,z+buildD/2-.2,1.3,1.4,.12);
          continue;
        }
        const tower=towerSlots.has(key);
        const h=tower?86+((ix*17+iz*11+slot*7)%40):downtown?32+rand()*39:coastal?20+rand()*42:10+rand()*25;
        const style=tower?3:Math.floor(rand()*3);
        building(x,z,buildW,buildD,h,colors[(ix*3+iz+slot)%colors.length],style);
      }
      if(alleyCell){
        alleys.push({x:cx,z:cz,half:cellD/2});
        box(material(0x2f4046),cx,.2,cz,gapX,.05,cellD);
        for(const s of [-1,1]){box(material(0xe7b53c),cx-1.55,.5,cz+s*(cellD/2-.7),.35,1,.35);box(material(0xe7b53c),cx+1.55,.5,cz+s*(cellD/2-.7),.35,1,.35);}
      }
    }
    const clearOfGridRoad=(x,z,margin)=>roads.every(road=>Math.abs(x-road)>=margin&&Math.abs(z-road)>=margin);
    // Coastal furniture is generated from the real polygon instead of a fixed x coordinate.
    // Every recorded footprint is checked against its intended surface before geometry is emitted.
    for(const segment of island.beachSegments){
      for(const t of [.2,.5,.8]){
        const point=island.coastPoint(segment,t,.952);
        if(!island.containsCircle(point.x,point.z,2)||island.distanceToCoastRoad(point.x,point.z)<7||!clearOfGridRoad(point.x,point.z,9))continue;
        if(palm(point.x,point.z,7+rand()*3))shoreProps.push({kind:'palm',x:point.x,z:point.z,r:2,surface:'land'});
      }
      const seat=island.coastPoint(segment,.5,.948);
      if(island.containsCircle(seat.x,seat.z,1.5)&&island.distanceToCoastRoad(seat.x,seat.z)>7&&!roads.some(road=>Math.abs(seat.x-road)<9||Math.abs(seat.z-road)<9)){
        bench(seat.x,seat.z,seat.angle+Math.PI/2);shoreProps.push({kind:'bench',x:seat.x,z:seat.z,r:1.5,surface:'land'});
      }
      for(const t of [.28,.72]){
        const point=island.coastPoint(segment,t,.99),radius=4;
        if(!island.containsBeachCircle(point.x,point.z,radius)||island.distanceToCoastRoad(point.x,point.z)<radius+6)continue;
        const tx=Math.sin(point.angle),tz=Math.cos(point.angle),chairX=point.x+tx*2.2,chairZ=point.z+tz*2.2;
        beachProps.push({kind:'umbrella-set',x:point.x,z:point.z,r:radius,surface:'sand',segment});
        inst(k.cylinder,trunk,point.x,1.3,point.z,.06,2.6,.06);
        inst(k.cone,material((segment+Math.round(t*10))%2?0xe99383:0xa6d1bc),point.x,2.8,point.z,2.4,.7,2.4);
        box(white,chairX,.3,chairZ,2,.15,3,point.angle);
      }
    }
    facadeSign('CAFÉ ONDA',-198,5.5,-172.8,11,'#425956');
    facadeSign('HOTEL MARÉ',-53,8.0,-91.6,11,'#ad6671');
    facadeSign('RÁDIO CAJU',40,8.8,-23.7,13,'#3f6d79');
    // Four activity landmarks use distinct silhouettes that stay readable at street height.
    const radio={x:40,z:-24};
    box(material(0xf18b70),radio.x,3.4,radio.z+8.8,15,.35,2);
    box(material(0x274e5d),radio.x,1.8,radio.z+9.9,5.2,3.4,.18);
    inst(k.cylinder,material(0x314f58),radio.x,22,radio.z,0.18,36,0.18);
    for(let y=8;y<38;y+=6)box(material(0xd8c6a1),radio.x,y,radio.z,4,.12,.12,Math.PI/4);
    inst(k.cone,material(0xff8a68),radio.x,40,radio.z,1.1,3.5,1.1);
    const market={x:253,z:145};
    box(material(0x73c7b6),market.x,2.2,market.z,13,4.4,10);
    box(cream,market.x,4.7,market.z,15,.6,12);
    for(let x=market.x-5;x<=market.x+5;x+=5)box(windowDark,x,2.2,market.z+5.1,3.5,2.6,.1);
    sign('MERCADO MARÉ ALTA',market.x,6.2,market.z+6.1,16,Math.PI,'#286260');
    const workshop={x:-52,z:40};
    box(material(0x254d55),workshop.x,3,workshop.z,20,6,14);
    box(material(0xff9b67),workshop.x-10.3,5.8,workshop.z,1.2,.45,16,Math.PI/2);
    box(windowDark,workshop.x-10.1,2.7,workshop.z,.12,4.4,10);
    sign('OFICINA DO CANAL',workshop.x-10.5,7.2,workshop.z,17,-Math.PI/2,'#a84f3f');
    buildings.push({minX:workshop.x-10,maxX:workshop.x+10,minZ:workshop.z-7,maxZ:workshop.z+7,height:6,landmark:'garage'});
    const pier={x:260,z:-40};
    box(trunk,pier.x,.65,pier.z,24,1.1,8);
    for(const x of [pier.x-10,pier.x, pier.x+10])for(const z of [pier.z-3,pier.z+3])box(trunk,x,-1.2,z,.45,4,.45);
    box(material(0xf0dfbf),pier.x+7,5.2,pier.z,5,9.5,5);
    box(material(0xf18b70),pier.x+7,10.4,pier.z,7,1,7);
    inst(k.cylinder,material(0x314f58),pier.x+7,15.5,pier.z,.13,10,.13);
    sign('PÍER FAROL',pier.x-3,3.8,pier.z+4.2,10,0,'#3f6d79');
    const finale=new T.Group();finale.position.set(pier.x,0,pier.z);finale.visible=false;scene.add(finale);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,r=5+i%2*1.5;part(T,k.sphere,new T.MeshStandardMaterial({color:i%2?0xff805b:0x8de3cf,emissive:i%2?0xff805b:0x8de3cf,emissiveIntensity:2}),Math.sin(a)*r,4+Math.sin(a*2),Math.cos(a)*r,.22,.22,.22,finale);}
    const beachSign=sign('PRAIA AURORA',224,4.1,30,13,Math.PI/2,'#386d6d');
    beachSign.userData.mount='posts';
    for(const z of [25,35])box(trunk,223.9,2.1,z,.20,4.2,.20);
    shoreProps.push({kind:'beach-sign',x:224,z:30,r:6.5,surface:'land'});
    facadeSign('ALUGA SOL',-212,6,65.4,10,'#a77465');
    facadeSign('CALOR & CAOS',200,7,145.5,14,'#755a71');
    const puddleMaterial=new T.MeshStandardMaterial({color:0x6caab0,roughness:.18,metalness:.35,transparent:true,opacity:0,depthWrite:false});
    const puddles=[];
    [[-80,-205,5,2.2],[0,115,4,1.8],[80,-45,6,2.1],[160,205,5,2.4],[240,-110,7,2.2],[-240,35,4,1.7]].filter(([x,z])=>island.containsCircle(x,z,3)).forEach(([x,z,sx,sz])=>{
      const mesh=new T.Mesh(new T.CircleGeometry(1,20),puddleMaterial);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.205,z);mesh.scale.set(sx,sz,1);scene.add(mesh);puddles.push(mesh);
    });
    // Bus shelters and planters create recognizable corners without blocking the roadway.
    [[-230,-149],[91,171],[170,-69],[251,91]].filter(([x,z])=>island.containsCircle(x,z,3)&&island.distanceToCoastRoad(x,z)>=6.2).forEach(([x,z],i)=>{
      prop(x,z,1.2);box(material(0x34515b),x,1.5,z,4,.18,2.2,i%2?Math.PI/2:0);box(windowDark,x,2.3,z,4,2.2,.10,i%2?Math.PI/2:0);box(cream,x,3.5,z,4.5,.25,2.6,i%2?Math.PI/2:0);
    });
    [[-229,-110],[91,110],[171,30],[253,-227]].filter(([x,z])=>island.containsCircle(x,z,2)&&island.distanceToCoastRoad(x,z)>=5.7).forEach(([x,z])=>{prop(x,z,.7);inst(k.cylinder,material(0xc9896b),x,.55,z,.75,1.1,.75);bush(x,z,1.05);});
    for(const b of batches.values()){
      const mesh=new T.InstancedMesh(b.geo,b.mat,b.items.length),tmp=new T.Object3D();
      b.items.forEach((o,i)=>{tmp.position.set(o.x,o.y,o.z);tmp.rotation.set(o.rx,o.ry,o.rz);tmp.scale.set(o.sx,o.sy,o.sz);tmp.updateMatrix();mesh.setMatrixAt(i,tmp.matrix);});
      mesh.instanceMatrix.needsUpdate=true;
      mesh.receiveShadow=true;mesh.castShadow=b.geo===k.box && b.items.length<500 && b.mat!==windowLit && b.mat!==windowDark;
      scene.add(mesh);
    }
    parks.forEach((p,i)=>{
      const dog=BN.createAnimal(T,'dog');dog.position.set(p.x+8,.3,p.z+8);scene.add(dog);animals.push({g:dog,type:'dog',x:p.x,z:p.z,phase:i*2,speed:.25});
      for(let j=0;j<4;j++){const bug=BN.createAnimal(T,'butterfly');bug.position.set(p.x,.7,p.z);scene.add(bug);animals.push({g:bug,type:'butterfly',x:p.x+6,z:p.z+6,phase:rand()*20,speed:.5+rand()});}
      for(let j=0;j<2;j++){const bird=BN.createAnimal(T,'gull');scene.add(bird);animals.push({g:bird,type:'gull',x:p.x,z:p.z,phase:rand()*20,speed:.16+rand()*.06,park:true});}
    });
    for(let i=0;i<8;i++){const bird=BN.createAnimal(T,'gull');scene.add(bird);animals.push({g:bird,type:'gull',x:280,z:-240+i*65,phase:rand()*20,speed:.13+rand()*.08});}
    const fireGeo=new T.BufferGeometry(), fireCount=70,firePos=new Float32Array(fireCount*3),fireBase=[];
    for(let i=0;i<fireCount;i++){const p=parks[i%parks.length];const x=p.x+(rand()-.5)*35,z=p.z+(rand()-.5)*35,y=getElevation(x,z)+1+rand()*2;fireBase.push({x,y,z,phase:rand()*10});firePos.set([x,y,z],i*3);}
    fireGeo.setAttribute('position',new T.BufferAttribute(firePos,3));
    const fireMat=new T.PointsMaterial({color:0xeaff98,size:.22,transparent:true,opacity:0,depthWrite:false});
    const fireflies=new T.Points(fireGeo,fireMat);scene.add(fireflies);
    function isBlocked(x,z,r=1){
      if(!island.containsCircle(x,z,r))return true;
      if(x+r>106&&x-r<132&&!roads.some(a=>Math.abs(z-a)<8-r))return true;
      if(buildings.some(b=>x+r>b.minX&&x-r<b.maxX&&z+r>b.minZ&&z-r<b.maxZ))return true;
      if(tunnels.some(t=>x+r>t.minX&&x-r<t.maxX&&((z-r<t.minZ+1.6&&z+r>t.minZ)||(z-r<t.maxZ&&z+r>t.maxZ-1.6))))return true;
      // Anything as wide as a car stops at the park bollards.
      if(r>=1&&parks.some(p=>Math.abs(x-p.x)<p.halfX-1&&Math.abs(z-p.z)<p.halfZ-1))return true;
      const gx=Math.floor(x/16),gz=Math.floor(z/16);
      for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
        const list=props.get((gx+i)*1000+gz+j);if(!list)continue;
        for(const q of list){const dx=x-q.x,dz=z-q.z,rr=r+q.r;if(dx*dx+dz*dz<rr*rr)return true;}
      }
      return false;
    }
    let frame=0;
    function update(dt,opts){
      const time=opts.time||0,night=Math.max(0,Math.min(1,opts.night||0)),rain=opts.rain||0;
      windowLit.emissiveIntensity=night*1.35;
      windowLit.color.setRGB(.30+night*.16,.42+night*.03,.46-night*.17);
      lightMat.emissiveIntensity=.05+night*2.5;
      k.head.emissiveIntensity=.12+night*3.2;
      const phase=Math.floor(time/8)%2;
      trafficVertical.color.setHex(phase===0?0xff4c40:0x63ef98);
      trafficHorizontal.color.setHex(phase===1?0xff4c40:0x63ef98);
      trafficVertical.emissive.copy(trafficVertical.color);
      trafficHorizontal.emissive.copy(trafficHorizontal.color);
      trafficVertical.emissiveIntensity=trafficHorizontal.emissiveIntensity=.8+night;
      asphalt.roughness=.96-rain*.64;
      puddleMaterial.opacity=rain*.48;
      puddles.forEach((mesh,i)=>{mesh.visible=rain>.06;mesh.scale.z=1+Math.sin(time*.8+i)*.03;});
      signs.forEach(m=>m.emissiveIntensity=.32+night*1.6);
      waterMat.color.setHex(night>.65?0x153f59:0x2ba7af);island.update(time,night,rain);
      for(const a of animals){
        const t=time*a.speed+a.phase;
        if(a.type==='dog'){
          a.g.position.set(a.x+Math.sin(t)*11,getElevation(a.x+Math.sin(t)*11,a.z+Math.cos(t)*11)+.30,a.z+Math.cos(t)*11);a.g.rotation.y=t+Math.PI/2;
          a.g.userData.legs.forEach((l,i)=>l.rotation.x=Math.sin(time*6+i*Math.PI)*.26);
        }else if(a.type==='gull'){
          const gx=a.x+Math.sin(t)*26,gz=a.z+Math.cos(t)*26;a.g.position.set(gx,getElevation(gx,gz)+12+Math.sin(t*2)*3,gz);a.g.rotation.y=t+Math.PI/2;
          a.g.userData.wings.forEach((w,i)=>w.rotation.z=Math.sin(time*3+a.phase)*(i?-.25:.25));
        }else{
          const gx=a.x+Math.sin(t)*3,gz=a.z+Math.cos(t*1.3)*3;a.g.position.set(gx,getElevation(gx,gz)+1.1+Math.sin(t*2)*.45,gz);
          a.g.visible=night<.8 && rain<.7;a.g.rotation.y=t;
          a.g.userData.wings.forEach((w,i)=>w.rotation.z=Math.sin(time*27)*(i?-1:1));
        }
      }
      fireMat.opacity=Math.max(0,night-.35)*1.3*(1-rain*.8);
      if(finale.visible)finale.rotation.y=time*.28;
      if((frame++%3)===0){
        fireBase.forEach((p,i)=>{firePos[i*3]=p.x+Math.sin(time+p.phase)*.6;firePos[i*3+1]=p.y+Math.sin(time*1.7+p.phase)*.4;firePos[i*3+2]=p.z+Math.cos(time*.8+p.phase)*.6;});
        fireGeo.attributes.position.needsUpdate=true;
        const v=island.water.geometry.attributes.position;
        for(let i=0;i<v.count;i++)v.setY(i,Math.sin(v.getX(i)*.05+time)*.14+Math.cos(v.getZ(i)*.045+time*.7)*.11);
        v.needsUpdate=true;
      }
    }
    function getDistrict(x,z){return x>250?'Praia Aurora':x>85&&x<150?'Canal das Garças':x<70&&z<0?'Centro Solar':z>60&&x<0?'Jardim Maré':'Costa Coral';}
    return {roads,buildings,bounds,spawn:{x:12,z:14},isBlocked,update,getDistrict,getElevation,island,parks,alleys,lots,tunnels,hills,solidProps,beachProps,shoreProps,counts:{buildings:buildings.length,skyscrapers:buildings.filter(b=>b.tower).length,animals:animals.length,insects:fireCount+animals.filter(a=>a.type==='butterfly').length,beachProps:beachProps.length,shoreProps:shoreProps.length},water,setFinale:visible=>{finale.visible=Boolean(visible);},materials:{windowLit,asphalt,trafficVertical,trafficHorizontal,headlights:k.head}};
  };
})();
