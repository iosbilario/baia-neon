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
      cone: new T.ConeGeometry(1, 1, 6),
      sphere: new T.IcosahedronGeometry(1, 0),
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
    const paint=police?0xf0eee2:(color===undefined?0x32bab5:color);
    g.add(solid(T,[
      {x:0,y:.63,z:0,sx:1.9,sy:.62,sz:4.1,color:paint},
      {x:0,y:.98,z:-.24,sx:1.75,sy:.25,sz:2.5,color:paint},
      {x:0,y:1.28,z:-.27,sx:1.53,sy:.55,sz:1.9,color:0x193d4a},
      {x:0,y:1.58,z:-.30,sx:1.64,sy:.13,sz:2.05,color:paint},
      {x:0,y:.73,z:2.09,sx:1.82,sy:.17,sz:.13,color:0xc1cbd0},
      {x:0,y:.67,z:-2.09,sx:1.82,sy:.15,sz:.13,color:0x3d535b},
      {x:0,y:.77,z:2.17,sx:.55,sy:.14,sz:.03,color:0x172c37},
      {x:-.91,y:1.10,z:.38,sx:.20,sy:.18,sz:.25,color:paint},
      {x:.91,y:1.10,z:.38,sx:.20,sy:.18,sz:.25,color:paint},
      {x:-.91,y:.90,z:-.28,sx:.05,sy:.1,sz:1.4,color:police?0x124555:paint},
      {x:.91,y:.90,z:-.28,sx:.05,sy:.1,sz:1.4,color:police?0x124555:paint}
    ]));
    const wheels=[];
    for(const x of [-.96,.96])for(const z of [-1.25,1.25]) {
      const wheel=new T.Group();
      const tire=part(T,k.cylinder,k.rubber,0,0,0,.39,.22,.39,wheel); tire.rotation.z=Math.PI/2;
      wheel.position.set(x,.39,z); g.add(wheel); wheels.push(wheel);
    }
    const headlights=[], lights=[];
    for(const x of [-.65,.65]) {
      headlights.push(part(T,k.box,k.head,x,.86,2.09,.43,.22,.06,g));
      part(T,k.box,k.red,x,.86,-2.09,.45,.16,.04,g);
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
    g.add(solid(T,[
      {y:1.12,sx:.48,sy:.60,sz:.29,color:shirt},
      {y:1.57,sx:.29,sy:.33,sz:.29,color:skin},
      {y:1.75,z:-.02,sx:.31,sy:.10,sz:.32,color:0x20242d},
      {y:.80,sx:.43,sy:.16,sz:.28,color:0x284451}
    ]));
    const legs=[],arms=[];
    for(const x of [-.14,.14]) {
      const leg=new T.Group(); leg.position.set(x,.78,0);
      leg.add(solid(T,[{y:-.31,sx:.17,sy:.62,sz:.19,color:0x284451},{y:-.66,z:.06,sx:.20,sy:.13,sz:.31,color:0xeee8ce}]));
      g.add(leg); legs.push(leg);
      const arm=new T.Group();arm.position.set(Math.sign(x)*.32,1.35,0);
      arm.add(solid(T,[{y:-.13,sx:.16,sy:.28,sz:.19,color:shirt},{y:-.39,sx:.13,sy:.28,sz:.15,color:skin}]));
      g.add(arm); arms.push(arm);
    }
    g.userData={legs,arms}; return g;
  };
  BN.createAnimal = function(T,type) {
    const k=kit(T), g=new T.Group();
    if(type==='gull' || type==='bird') {
      g.add(solid(T,[{geo:k.sphere,y:0,sx:.33,sy:.16,sz:.6,color:0xf1eee7},{geo:k.sphere,y:.15,z:.44,sx:.15,sy:.15,sz:.16,color:0xffffff},{y:.12,z:.64,sx:.08,sy:.08,sz:.22,color:0xeab449}]));
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
    const buildings=[], batches=new Map(), signs=[], animals=[], parks=[], alleys=[], lots=[];
    // Small solid objects (trunks, benches, fountains) live in a coarse grid so the check stays cheap.
    const props=new Map();
    function prop(x,z,r){const key=Math.floor(x/16)*1000+Math.floor(z/16);if(!props.has(key))props.set(key,[]);props.get(key).push({x,z,r});}
    let seed=631842;
    function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    const bounds={minX:-300,maxX:300,minZ:-300,maxZ:300};
    const matCache={};
    function material(color,roughness=.88) {const key=color+'_'+roughness;return matCache[key]||(matCache[key]=new T.MeshStandardMaterial({color,roughness,flatShading:true}));}
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
    function palm(x,z,h=7){
      prop(x,z,.35);
      inst(k.cylinder,trunk,x,h*.48,z,.24,h,.24,0,0,.04);
      for(let a=0;a<7;a++) {
        const angle=a*Math.PI*2/7;
        inst(k.cone,a%2?palmMat:palmLight,x+Math.sin(angle)*1.4,h-.2,z+Math.cos(angle)*1.4,.65,4.7,.22,Math.cos(angle)*1.14,0,-Math.sin(angle)*1.14);
      }
      inst(k.sphere,shadowMat,x,h-.5,z,.55,.55,.55);
    }
    function bush(x,z,size=1.4){inst(k.sphere,palmLight,x,size*.65,z,size,size*.8,size);}
    function bench(x,z,angle=0){
      prop(x,z,1.1);
      box(trunk,x,.65,z,2.7,.20,.72,angle);
      const dx=Math.sin(angle)*.34,dz=Math.cos(angle)*.34;
      box(trunk,x-dx,1.1,z-dz,2.7,.70,.14,angle);
      for(const s of [-1,1])box(material(0x314b52),x+Math.cos(angle)*s,.30,z-Math.sin(angle)*s,.14,.6,.6,angle);
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
      const face=material(color);
      buildings.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,height:h});
      box(face,x,h/2,z,w,h,d);
      box(cream,x,h+.2,z,w+.7,.65,d+.7);
      box(cream,x,1.1,z,w+.4,.9,d+.4);
      if(style===1){
        box(face,x,h+1.8,z,w*.65,3,d*.65);
        box(cream,x,h+3.4,z,w*.68,.45,d*.68);
        box(face,x,h+4,z,w*.32,1.5,d*.35);
      }
      for(let y=4;y<h-1;y+=3.6){
        if(style===2)box(cream,x,y-1.3,z,w+.2,.25,d+.2);
        for(let wx=x-w/2+2;wx<x+w/2-1;wx+=3.6)for(const s of [-1,1])box(rand()<.67?windowLit:windowDark,wx,y,z+s*(d/2+.025),1.5,1.8,.05);
        for(let wz=z-d/2+2;wz<z+d/2-1;wz+=3.6)for(const s of [-1,1])box(rand()<.67?windowLit:windowDark,x+s*(w/2+.025),y,wz,.05,1.8,1.5);
      }
      box(windowDark,x,1.4,z+d/2+.04,1.6,2.6,.09);
      // Modular street-level silhouette: entrance, awning and occasional balconies.
      const accent=material(style===1?0xf18b70:style===2?0x62b8ae:0xe5b657);
      box(accent,x,2.95,z+d/2+.65,4.8,.22,1.25);
      for(const s of [-1,1])box(cream,x+s*2.15,1.65,z+d/2+.32,.18,3.2,.45);
      if(style===2&&h>12)for(let by=6;by<h-2;by+=7){
        box(cream,x,by,z+d/2+.58,Math.min(w*.66,11),.22,1.1);
        box(accent,x,by+.62,z+d/2+1.04,Math.min(w*.66,11),.08,.08);
      }
      if(style===1&&w>18){
        box(windowDark,x-w*.28,1.7,z+d/2+.13,w*.28,2.5,.08);
        box(windowDark,x+w*.28,1.7,z+d/2+.13,w*.28,2.5,.08);
      }
      if(h>27){
        box(material(0x8eaaa7),x+w*.24,h+.85,z-d*.18,2.5,1.2,3.6);
        inst(k.cylinder,material(0xd2b8a2),x-w*.2,h+2,z+d*.18,1.4,3,1.4);
      }
    }
    const waterMat=new T.MeshStandardMaterial({color:0x2ba7af,roughness:.28,metalness:.28,transparent:true,opacity:.94});
    const waterGeo=new T.PlaneGeometry(1800,1800,30,30);waterGeo.rotateX(-Math.PI/2);
    const water=new T.Mesh(waterGeo,waterMat);water.position.set(0,-.5,0);scene.add(water);
    const land=part(T,k.box,material(0x83a68c),0,-.4,0,600,.7,600,scene);land.receiveShadow=true;
    box(material(0xe9d4a6),280,.025,0,40,.10,600);
    box(material(0x96b49b),-280,.02,0,40,.09,600);
    box(material(0x348f9a),119,.065,0,26,.05,600);
    for(const r of roads){
      box(material(0xb5c4b3),r,.065,0,24,.10,600);
      box(asphalt,r,.13,0,14,.07,600);
      box(material(0xb5c4b3),0,.072,r,600,.11,24);
      box(asphalt,0,.14,r,600,.07,14);
      for(let z=-294;z<300;z+=13){
        if(roads.some(v=>Math.abs(z-v)<13))continue;
        box(material(0xe7cf80),r,.185,z,.18,.02,5);
      }
      for(let x=-294;x<300;x+=13){
        if(roads.some(v=>Math.abs(x-v)<13))continue;
        box(material(0xe7cf80),x,.19,r,5,.02,.18);
      }
      box(material(0x9db8b6),119,.22,r,29,.22,20);
      box(asphalt,119,.35,r,29,.03,14);
      for(const s of [-1,1]){
        box(cream,119,1,r+s*9.2,29,.45,.3);
        for(let x=107;x<133;x+=4)box(cream,x,.65,r+s*9.2,.25,1.0,.25);
      }
    }
    for(const x of roads)for(const z of roads){
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
    for(let ix=0;ix<8;ix++)for(let iz=0;iz<8;iz++){
      const cx=-280+ix*80,cz=-280+iz*80;
      if(cx>250)continue;
      const park=(ix===2&&iz===5)||(ix===3&&iz===2)||(ix===5)||(ix===0&&iz%3===1);
      if(park){
        const px=cx===120?94:cx;
        const pw=cx===120?14:52;
        box(material(0x639e79),px,.18,cz,pw,.18,54);
        if(cx!==120){
          parks.push({x:cx,z:cz});prop(cx,cz,3.7);
          // Bollards: parks are for walking. Cars stay out, people and officers on foot get in.
          for(let t=-26;t<=26;t+=4){for(const s of [-1,1]){box(cream,cx+t,.45,cz+s*27,.3,.7,.3);box(cream,cx+s*26,.45,cz+t,.3,.7,.3);}}
          box(material(0xd3c5a3),cx,.29,cz,3,.04,54);
          box(material(0xd3c5a3),cx,.29,cz,54,.04,3);
          for(let i=0;i<7;i++){const a=i*2.4;palm(cx+Math.sin(a)*20,cz+Math.cos(a)*20,5+rand()*4);bush(cx+Math.cos(a)*14,cz+Math.sin(a)*14,1+rand());}
          bench(cx+6,cz+4);bench(cx-6,cz-4,Math.PI);
          inst(k.cylinder,cream,cx,.5,cz,3.6,.7,3.6);inst(k.cylinder,waterMat,cx,.9,cz,3.1,.06,3.1);
          inst(k.cone,cream,cx,1.9,cz,.5,2.3,.5);
        }else{for(let j=-20;j<=20;j+=20)palm(94,cz+j,7);}
        continue;
      }
      const downtown=cx<70&&cx>-180&&cz<60&&cz>-220;
      const w=19+rand()*5,d=20+rand()*6;
      const positions=[[cx-13,cz-13],[cx+13,cz+13]];
      if(downtown&&rand()>.50){
        const h=38+rand()*37,color=colors[Math.floor(rand()*colors.length)];
        if((ix+iz)%2===0){
          // A tower split by a 3 m service alley from street to street. Only a narrow car fits.
          building(cx-9.5,cz,16,33,h,color,1);building(cx+9.5,cz,16,33,h*(.72+rand()*.25),colors[Math.floor(rand()*colors.length)],1);
          alleys.push({x:cx,z:cz,half:28});
          box(material(0x2f4046),cx,.2,cz,3,.05,56);
          for(const s of [-1,1]){box(material(0xe7b53c),cx-1.9,.5,cz+s*27,.5,1,.5);box(material(0xe7b53c),cx+1.9,.5,cz+s*27,.5,1,.5);box(material(0xe7b53c),cx,.22,cz+s*25,3,.03,.6);}
        }else building(cx,cz,35,33,h,color,1);
      }else{
        for(const p of positions)building(p[0],p[1],w,d,8+rand()*(downtown?30:14),colors[Math.floor(rand()*colors.length)],Math.floor(rand()*3));
      }
      palm(cx-25,cz+23,6+rand()*3);palm(cx+25,cz-23,6+rand()*3);
      // Some open corners are public parking: a place to leave one car and take another.
      if(!alleys.some(a=>a.x===cx&&a.z===cz)&&!(downtown&&buildings.length&&buildings[buildings.length-1].maxX-buildings[buildings.length-1].minX>30)&&(ix*3+iz)%4===0){
        const lx=cx+14,lz=cz-14;lots.push({x:lx,z:lz});
        box(asphalt,lx,.2,lz,20,.05,18);
        for(let i=-2;i<=2;i++)box(white,lx+i*4,.24,lz,.15,.02,9);
        box(material(0x2b62a8),lx-9,2.4,lz+9.5,1.6,1.6,.15);box(white,lx-9,2.4,lz+9.6,.9,1.0,.04);box(trunk,lx-9,.8,lz+9.5,.14,1.6,.14);
      }
      if(rand()<.4)bench(cx-20,cz+26);
    }
    for(let z=-280;z<300;z+=22){palm(264,z,7+rand()*3);if(z%44===-16)bench(272,z,Math.PI/2);}
    for(let z=-250;z<300;z+=65){
      inst(k.cylinder,trunk,283,1.3,z,.06,2.6,.06);
      inst(k.cone,material(z%2===0?0xe99383:0xa6d1bc),283,2.8,z,2.4,.7,2.4);
      box(white,283,.3,z+3,2,.15,3);
    }
    for(let z=-270;z<300;z+=80){
      prop(291,z,2.6);
      box(material(0xefb3a1),291,2,z,3.6,2.5,4.4);
      box(cream,291,3.45,z,4.6,.25,5.0);
      box(windowDark,289.15,2.5,z,.04,.8,2.4);
      for(const x of [289.7,292.3])for(const zz of [-1.5,1.5])box(trunk,x,.7,z+zz,.18,1.5,.18);
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
    const workshop={x:-74.3,z:40};
    box(material(0x254d55),workshop.x,3,workshop.z,18,6,12);
    box(material(0xff9b67),workshop.x,5.8,workshop.z+6.3,20,.45,1.2);
    box(windowDark,workshop.x,2.7,workshop.z+6.1,10,4.4,.12);
    sign('OFICINA DO CANAL',workshop.x,7.2,workshop.z+6.5,17,0,'#a84f3f');
    const pier={x:286,z:-160};
    box(trunk,pier.x,.65,pier.z,24,1.1,8);
    for(const x of [pier.x-10,pier.x, pier.x+10])for(const z of [pier.z-3,pier.z+3])box(trunk,x,-1.2,z,.45,4,.45);
    box(material(0xf0dfbf),pier.x+7,5.2,pier.z,5,9.5,5);
    box(material(0xf18b70),pier.x+7,10.4,pier.z,7,1,7);
    inst(k.cylinder,material(0x314f58),pier.x+7,15.5,pier.z,.13,10,.13);
    sign('PÍER FAROL',pier.x-3,3.8,pier.z+4.2,10,0,'#3f6d79');
    const finale=new T.Group();finale.position.set(pier.x,0,pier.z);finale.visible=false;scene.add(finale);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,r=5+i%2*1.5;part(T,k.sphere,new T.MeshStandardMaterial({color:i%2?0xff805b:0x8de3cf,emissive:i%2?0xff805b:0x8de3cf,emissiveIntensity:2}),Math.sin(a)*r,4+Math.sin(a*2),Math.cos(a)*r,.22,.22,.22,finale);}
    const beachSign=sign('PRAIA AURORA',266,4.1,10,13,Math.PI/2,'#386d6d');
    beachSign.userData.mount='posts';
    for(const z of [5,15])box(trunk,265.9,2.1,z,.20,4.2,.20);
    facadeSign('ALUGA SOL',-212,6,65.4,10,'#a77465');
    facadeSign('CALOR & CAOS',200,7,145.5,14,'#755a71');
    const puddleMaterial=new T.MeshStandardMaterial({color:0x6caab0,roughness:.18,metalness:.35,transparent:true,opacity:0,depthWrite:false});
    const puddles=[];
    [[-80,-205,5,2.2],[0,115,4,1.8],[80,-45,6,2.1],[160,205,5,2.4],[240,-110,7,2.2],[-240,35,4,1.7]].forEach(([x,z,sx,sz])=>{
      const mesh=new T.Mesh(new T.CircleGeometry(1,20),puddleMaterial);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.205,z);mesh.scale.set(sx,sz,1);scene.add(mesh);puddles.push(mesh);
    });
    // Bus shelters and planters create recognizable corners without blocking the roadway.
    [[-229,-149],[91,171],[171,-69],[251,91]].forEach(([x,z],i)=>{
      prop(x,z,1.2);box(material(0x34515b),x,1.5,z,4,.18,2.2,i%2?Math.PI/2:0);box(windowDark,x,2.3,z,4,2.2,.10,i%2?Math.PI/2:0);box(cream,x,3.5,z,4.5,.25,2.6,i%2?Math.PI/2:0);
    });
    [[-213,-67],[13,93],[173,13],[253,-227]].forEach(([x,z])=>{prop(x,z,.7);inst(k.cylinder,material(0xc9896b),x,.55,z,.75,1.1,.75);bush(x,z,1.05);});
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
    });
    for(let i=0;i<8;i++){const bird=BN.createAnimal(T,'gull');scene.add(bird);animals.push({g:bird,type:'gull',x:280,z:-240+i*65,phase:rand()*20,speed:.13+rand()*.08});}
    const fireGeo=new T.BufferGeometry(), fireCount=70,firePos=new Float32Array(fireCount*3),fireBase=[];
    for(let i=0;i<fireCount;i++){const p=parks[i%parks.length];const x=p.x+(rand()-.5)*35,z=p.z+(rand()-.5)*35,y=1+rand()*2;fireBase.push({x,y,z,phase:rand()*10});firePos.set([x,y,z],i*3);}
    fireGeo.setAttribute('position',new T.BufferAttribute(firePos,3));
    const fireMat=new T.PointsMaterial({color:0xeaff98,size:.22,transparent:true,opacity:0,depthWrite:false});
    const fireflies=new T.Points(fireGeo,fireMat);scene.add(fireflies);
    function isBlocked(x,z,r=1){
      if(x-r<bounds.minX||x+r>bounds.maxX||z-r<bounds.minZ||z+r>bounds.maxZ)return true;
      if(x+r>106&&x-r<132&&!roads.some(a=>Math.abs(z-a)<8-r))return true;
      if(buildings.some(b=>x+r>b.minX&&x-r<b.maxX&&z+r>b.minZ&&z-r<b.maxZ))return true;
      // Anything as wide as a car stops at the park bollards.
      if(r>=1&&parks.some(p=>Math.abs(x-p.x)<26&&Math.abs(z-p.z)<27))return true;
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
      waterMat.color.setHex(night>.65?0x153f59:0x2ba7af);
      for(const a of animals){
        const t=time*a.speed+a.phase;
        if(a.type==='dog'){
          a.g.position.set(a.x+Math.sin(t)*11,.30,a.z+Math.cos(t)*11);a.g.rotation.y=t+Math.PI/2;
          a.g.userData.legs.forEach((l,i)=>l.rotation.x=Math.sin(time*6+i*Math.PI)*.26);
        }else if(a.type==='gull'){
          a.g.position.set(a.x+Math.sin(t)*26,12+Math.sin(t*2)*3,a.z+Math.cos(t)*26);a.g.rotation.y=t+Math.PI/2;
          a.g.userData.wings.forEach((w,i)=>w.rotation.z=Math.sin(time*3+a.phase)*(i?-.25:.25));
        }else{
          a.g.position.set(a.x+Math.sin(t)*3,1.1+Math.sin(t*2)*.45,a.z+Math.cos(t*1.3)*3);
          a.g.visible=night<.8 && rain<.7;a.g.rotation.y=t;
          a.g.userData.wings.forEach((w,i)=>w.rotation.z=Math.sin(time*27)*(i?-1:1));
        }
      }
      fireMat.opacity=Math.max(0,night-.35)*1.3*(1-rain*.8);
      if(finale.visible)finale.rotation.y=time*.28;
      if((frame++%3)===0){
        fireBase.forEach((p,i)=>{firePos[i*3]=p.x+Math.sin(time+p.phase)*.6;firePos[i*3+1]=p.y+Math.sin(time*1.7+p.phase)*.4;firePos[i*3+2]=p.z+Math.cos(time*.8+p.phase)*.6;});
        fireGeo.attributes.position.needsUpdate=true;
        const v=waterGeo.attributes.position;
        for(let i=0;i<v.count;i++)v.setY(i,Math.sin(v.getX(i)*.05+time)*.14+Math.cos(v.getZ(i)*.045+time*.7)*.11);
        v.needsUpdate=true;
      }
    }
    function getDistrict(x,z){return x>250?'Praia Aurora':x>85&&x<150?'Canal das Garças':x<70&&z<0?'Centro Solar':z>60&&x<0?'Jardim Maré':'Costa Coral';}
    return {roads,buildings,bounds,spawn:{x:12,z:14},isBlocked,update,getDistrict,parks,alleys,lots,counts:{buildings:buildings.length,animals:animals.length,insects:fireCount+animals.filter(a=>a.type==='butterfly').length},water,setFinale:visible=>{finale.visible=Boolean(visible);},materials:{windowLit,asphalt,trafficVertical,trafficHorizontal,headlights:k.head}};
  };
})();
