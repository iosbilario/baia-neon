/* SPDX-License-Identifier: MIT */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const show = (id,visible) => $(id).classList.toggle('hidden',!visible);
  const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
  const lerp = (a,b,t) => a+(b-a)*t;
  const dist = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
  const wrap = a => Math.atan2(Math.sin(a),Math.cos(a));
  const smooth = (a,b,x) => { const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t); };
  function fatal(error) { $('fatalMessage').textContent=String(error.message||error);show('loading',false);show('fatal',true);console.error(error); }
  window.addEventListener('error', e=>fatal(e.error||e.message));
  try {
    if(!window.THREE||!BN.createWorld)throw new Error('Um arquivo local está ausente. Extraia o ZIP inteiro antes de abrir index.html.');
    const cfg=BN.CONFIG,canvas=$('game');
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,cfg.pixelRatioCap));
    renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,0.25,1350);
    scene.background=new THREE.Color(0xa5c8ca);scene.fog=new THREE.Fog(0xa5c8ca,160,650);
    const hemi=new THREE.HemisphereLight(0xd4ebf1,0x756550,2.2);scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xffd3a1,3.1);sun.position.set(-110,190,110);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-100,right:100,top:100,bottom:-100,near:1,far:600});sun.shadow.bias=-0.0005;sun.shadow.normalBias=0.15;scene.add(sun);scene.add(sun.target);
    const world=BN.createWorld(THREE,scene),audio=new BN.Audio();
    const human=BN.createHuman(THREE,0xf58d67,0x845638);scene.add(human);
    const player={x:world.spawn.x,z:world.spawn.z,heading:0,health:100,invincible:0,car:null,speed:0,stun:0,grenades:4,fireCooldown:0,aimTime:0,cause:''};
    human.position.set(player.x,0,player.z);
    let seed=cfg.seed;
    function rand() {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    const cars=[],peds=[],keys=new Set();
    let mode='intro',helpReturn='menu',introTime=0,elapsed=0,hour=cfg.startHour,night=0,rain=0,rainTarget=0,weatherTimer=55;
    let orbitYaw=Math.PI,orbitPitch=.48,dragging=false,lastPointer={x:0,y:0},toastTime=0,missionIndex=0,hudTimer=0,collisionCooldown=0,footstep=0,missionCooldown=0;
    let frameCount=0,fpsAccum=0,measuredFPS=60,quality='normal',carCull=175,pedCull=110;
    // v1.0 city systems: quality tiers, input devices, roadblocks.
    const qualityCtl=new BN.AdaptiveQuality(),streets=world.streets;let wrongWayTime=0,missionRoute=[],missionRouteStamp=-9,missionRouteKey='';
    let deathTime=0,lastShotCrime=-99,lastHitCrime=-99,chatTimer=0,shake=0,boomTime=0,hitFlash=0,downPointer={x:0,y:0};const rnd=Math.random;
    let aiming=false,pointerPauseSuppressed=false;const mouseSensitivity=.0026,touch={x:0,y:0,primary:false,secondary:false,third:false,lookId:null,padId:null};
    const cameraGoal=new THREE.Vector3(),lookGoal=new THREE.Vector3(),cameraOffset=new THREE.Vector3(),lookAhead={x:0,z:0};
    const aimPointer={x:innerWidth*.5,y:innerHeight*.4},aimNdc=new THREE.Vector2(0,.2),aimRaycaster=new THREE.Raycaster(),aimPoint3=new THREE.Vector3();
    function setAimPointer(x,y){aimPointer.x=clamp(x,0,innerWidth);aimPointer.y=clamp(y,0,innerHeight);aimNdc.set(aimPointer.x/innerWidth*2-1,-(aimPointer.y/innerHeight)*2+1);$('aim').style.left=aimPointer.x+'px';$('aim').style.top=aimPointer.y+'px';}
    const touchDevice=()=>Boolean(window.navigator&&window.navigator.maxTouchPoints>0&&(!window.matchMedia||window.matchMedia('(pointer:coarse)').matches));
    if(touchDevice()&&document.body)document.body.classList.add('touch-device');
    function centerAim(){setAimPointer(innerWidth*.5,innerHeight*.42);}
    function requestPointer(){if(mode==='play'&&!touchDevice()&&canvas.requestPointerLock&&document.pointerLockElement!==canvas){try{const result=canvas.requestPointerLock();if(result&&result.catch)result.catch(()=>{});}catch(_){}}}
    function releasePointer(){if(document.exitPointerLock&&document.pointerLockElement===canvas){pointerPauseSuppressed=true;document.exitPointerLock();}}
    function clearTouch(){touch.x=touch.y=0;touch.primary=touch.secondary=touch.third=false;touch.lookId=touch.padId=null;$('touchStick').style.transform='translate(-50%,-50%)';}
    // ---- v1.0 input devices: keyboard, touch and gamepad share one set of adaptive prompts ----
    let padSettings={};try{padSettings=JSON.parse(localStorage.getItem('baia-neon-gamepad')||'{}')||{};}catch(_){padSettings={};}
    function applyPrompts(kind){if(document.body&&document.body.classList){['keyboard','touch','gamepad'].forEach(k=>document.body.classList.toggle('input-'+k,k===kind));}$('keyHints').innerHTML=BN.Prompts.hintsHtml(kind);}
    const inputMode=new BN.InputMode(applyPrompts);
    const gamepad=new BN.GamepadInput({getGamepads:()=>window.navigator&&window.navigator.getGamepads?window.navigator.getGamepads():[],settings:padSettings,onChange:(kind,id)=>{
      if(kind==='connected')toast('Controle conectado · '+String(id||'gamepad').slice(0,34));
      else{toast('Controle desconectado');if(mode==='play'&&inputMode.mode==='gamepad')setMode('pause');inputMode.note('keyboard');}
    }});
    gamepad.attach(window);
    function savePadSettings(){try{localStorage.setItem('baia-neon-gamepad',JSON.stringify(gamepad.settings));}catch(_){}}
    function padLabels(){$('toggleVibration').textContent='VIBRAÇÃO DO CONTROLE: '+(gamepad.settings.vibration?'LIGADA':'DESLIGADA');$('cycleDeadzone').textContent='ZONA MORTA DO ANALÓGICO: '+Math.round(gamepad.settings.stickDead*100)+'%';}
    function rumble(strong,weak,ms){return gamepad.rumble(strong,weak,ms);}
    // Three cars that answer the first corner differently: grip, steering, brakes and toughness.
    const VEHICLES={
      compact:{radius:1.1,name:'MARÉ COMPACTO',accel:14,top:30,grip:9,steer:1.75,brake:5,tough:.75,scale:[1,1,1],price:0,note:'Curva rápido, cabe nas vielas, amassa fácil'},
      sedan:{radius:1.55,name:'SEDÃ ATLÂNTICO',accel:11.5,top:32,grip:11.5,steer:1.3,brake:6.5,tough:1.4,scale:[1.06,1.02,1.16],price:900,note:'Estável e resistente, lento para virar'},
      sport:{radius:1.55,name:'ESPORTIVO BRISA 78',accel:17,top:38,grip:6.2,steer:1.6,brake:5,tough:1,scale:[1.04,.86,1.1],price:1600,note:'Retomada forte, traseira solta'}
    };
    const upgrades={brakes:false,tires:false,cargo:false},garageOwned=new Set(['compact']);
    const catalogues={vehicles:Object.keys(VEHICLES),upgrades:Object.keys(upgrades),campaignIds:cfg.campaign.map(item=>item.id)};
    const loaded=BN.Save.load(localStorage,catalogues),saved=loaded.data;
    const hasProgress=loaded.migrated||Boolean(saved.savedAt||saved.balance||saved.completed||saved.campaign.completed.length||Object.keys(saved.raceRecords).length||Object.values(saved.upgrades).some(Boolean)||saved.owned.length>1);
    let balance=saved.balance,completed=saved.completed,reputation=saved.reputation;
    for(const k in upgrades)upgrades[k]=Boolean(saved.upgrades[k]);
    saved.owned.forEach(t=>{if(VEHICLES[t])garageOwned.add(t);});
    Object.assign(player,{ammo:saved.ammo,reserve:saved.reserve,reload:0,grenades:saved.grenades,health:saved.health});
    const campaign=new BN.Campaign(cfg.campaign,saved.campaign);
    if(campaign.state.status==='finished'&&world.setFinale)world.setFinale(true);
    const raceRecords=saved.raceRecords||{};
    let tutorialSeen=saved.tutorialSeen,cameraMotion=saved.cameraMotion,audioVolume=saved.audioVolume;audio.volume=audioVolume;
    let routeDestination=null,routePoints=[],dialogueTime=0,activeRace=null,raceIndex=0,photoReturn='play',mapReturn='play',photoClean=false,adultRide=null;
    function progressData(){return {schemaVersion:BN.Save.SCHEMA_VERSION,balance,completed,reputation,upgrades,owned:[...garageOwned],car:starterCar.type,ammo:player.ammo,reserve:player.reserve,grenades:player.grenades,health:Math.max(25,Math.round(player.health)),campaign:campaign.state,raceRecords,tutorialSeen,cameraMotion,audioVolume};}
    // Progress writes only at meaningful events. The untouched v1 key remains available to older builds.
    function save(){try{BN.Save.persist(localStorage,progressData());}catch(e){toast('Não foi possível salvar neste navegador.');}}
    function toast(text){$('toast').textContent=text;$('toast').classList.add('show');toastTime=4.5;}
    function dialogue(speaker,text){$('dialogueSpeaker').textContent=speaker;$('dialogueText').textContent=text;show('dialogue',true);dialogueTime=6;}
    if(loaded.migrated)setTimeout(()=>toast('Progresso v0.2 preservado e migrado com cópia de recuperação.'),0);
    function setMode(next){mode=next;show('intro',next==='intro');show('menu',next==='menu');show('hud',(next==='play'||next==='pause'||next==='garage'||next==='map')&&!photoClean);show('pause',next==='pause');show('help',next==='help');show('wasted',next==='dead');show('garage',next==='garage');show('cityMap',next==='map');show('photoMode',next==='photo');show('touchControls',next==='play');keys.clear();clearTouch();dragging=false;aiming=false;if(next!=='play')releasePointer();}
    function menuStats(){$('statMoney').textContent='R$ '+balance;$('statJobs').textContent=completed;$('statCars').textContent=garageOwned.size+'/'+Object.keys(VEHICLES).length;$('statUps').textContent=Object.values(upgrades).filter(Boolean).length+'/'+Object.keys(upgrades).length;}
    const build=BN.BUILD_INFO||{version:cfg.version,tag:'development',sha:'development'};
    const versionLabel='v'+build.version+(build.tag==='development'?' dev':'');
    $('menuVersion').textContent=versionLabel;$('pauseVersion').textContent=versionLabel;$('play').innerHTML=(hasProgress?'CONTINUAR':'JOGAR')+' <span>↗</span>';
    function endIntro(){menuStats();setMode('menu');introTime=cfg.introDuration;}
    function play(){setMode('play');centerAim();requestPointer();audio.beep(587,.16);if(!tutorialSeen){tutorialSeen=true;dialogue('DORA DENDÊ · APRESENTADORA DA RÁDIO CAJU','Eu falo, você dirige. Entre no carro coral com E e me busque na Praia Aurora. M abre o mapa.');toast('O progresso é salvo automaticamente neste navegador.');save();}else toast('Progresso retomado · M abre o mapa.');updateMission();}
    function primaryAction(){if(player.car){if(!tryCompanionRide()){audio.horn();peds.forEach(p=>{if(!p.dead&&!p.frozen&&dist(p,player)<18){p.panic=3;p.fear=null;p.cower=false;}});}}else fire();}
    function togglePause(){if(mode==='play')setMode('pause');else if(mode==='pause'){setMode('play');centerAim();requestPointer();}}
    function help(){helpReturn=mode;setMode('help');}
    function createCar(x,z,color,isTraffic=false,heading=0,owned=false,type='compact'){const mesh=BN.createCar(THREE,color,false),sc=VEHICLES[type].scale;mesh.scale.set(sc[0],sc[1],sc[2]);scene.add(mesh);mesh.position.set(x,0,z);mesh.rotation.y=heading;const c={x,z,heading,speed:0,lat:0,type,color,baseY:sc[1],mesh,traffic:isTraffic,owned,path:[],waypoint:0,damage:0,hitCooldown:0,home:{x,z,heading},wreck:false,wreckTime:0,scared:0,stuck:0,byPlayer:false};cars.push(c);return c;}
    function setCarType(c,type,color){const sc=VEHICLES[type].scale;scene.remove(c.mesh);if(color!==undefined)c.color=color;c.mesh=BN.createCar(THREE,c.color,false);c.type=type;c.baseY=sc[1];c.mesh.scale.set(sc[0],sc[1],sc[2]);c.mesh.position.set(c.x,0,c.z);c.mesh.rotation.y=c.heading;scene.add(c.mesh);}
    const starterCar=createCar(5.7,14,0xe98668,false,0,true,VEHICLES[saved.car]&&garageOwned.has(saved.car)?saved.car:'compact');
    createCar(-9,84,0x9bc5b1,false,Math.PI/2,false,'sedan');createCar(244,14,0xf1cc78,false,0,false,'sport');createCar(-154,-10,0xa9b7cf,false,0);
    // Traffic follows the directed street graph: one-way streets are respected and turns are picked at every crossing.
    for(let i=0;i<cfg.traffic;i++){
      const nav=streets.spawnNav(i,rand),c=createCar(nav.start.x,nav.start.z,[0xf1d3a0,0x5d8d8a,0xb27d81,0xdedbc5,0x5d6d89][i%5],true,0,false,i%3===1?'sedan':'compact');
      c.nav=nav;c.path=[nav.waypoint];c.waypoint=0;c.speed=8+rand()*4;c.heading=Math.atan2(nav.waypoint.x-c.x,nav.waypoint.z-c.z);
    }
    // Parked cars line the curbs mid-block, away from crossings and the canal.
    for(let i=0,made=0;i<120&&made<28;i++){
      const r=world.roads,road=r[Math.floor(rand()*r.length)],block=r[Math.floor(rand()*(r.length-1))],along=block+20+rand()*40,side=rand()<.5?1:-1,vertical=rand()<.5;
      const x=vertical?road+side*5.6:along,z=vertical?along:road+side*5.6;
      if((x>92&&x<146)||world.isBlocked(x,z,1.5)||cars.some(c=>dist(c,{x,z})<9))continue;
      createCar(x,z,[0xd9a441,0x4f7f9a,0xc9cfd2,0x8a5a7a,0x6fa37a,0x2f3b46,0xc96f4a][made%7],false,vertical?(side>0?Math.PI:0):(side>0?Math.PI/2:-Math.PI/2),false,made%5===4?'sport':made%2?'sedan':'compact');made++;
    }
    world.lots.forEach((l,i)=>{[[-6,'sedan',0x6fa37a],[2,'compact',0xd9a441],[6,i%2?'sport':'sedan',0x8a5a7a]].forEach(([dx,type,color])=>{if(!world.isBlocked(l.x+dx,l.z,1.2))createCar(l.x+dx,l.z,color,false,0,false,type);});});
    // Pedestrians keep to sidewalk lines 11 m from each road axis. Some live in parks, some jog.
    const SW=11,nearestRoad=v=>world.roads.reduce((a,b)=>Math.abs(b-v)<Math.abs(a-v)?b:a);
    function placePed(p,avoidPlayer){
      if(p.kind==='park'){const h=p.home;p.x=h.x+(rand()-.5)*20;p.z=h.z+(rand()-.5)*20;p.tx=p.x;p.tz=p.z;if(!world.isBlocked(p.x,p.z,.6))return;p.kind='walker';}
      for(let k=0;k<14;k++){
        const r=world.roads,road=r[Math.floor(rand()*r.length)],a=-255+rand()*510,vertical=rand()<.5,line=road+(rand()<.5?SW:-SW),x=vertical?line:a,z=vertical?a:line;
        if(world.isBlocked(x,z,.6)||(avoidPlayer&&dist({x,z},player)<80))continue;
        p.x=x;p.z=z;p.vertical=vertical;p.line=line;return;
      }
    }
    for(let i=0;i<cfg.population;i++){
      const mesh=BN.createHuman(THREE,[0x72b8a0,0xf5d295,0xd78b9c,0xe1e5d0,0x85a4c1,0xc98a4b,0x7d6fb0][i%7],[0x68483b,0xb88460,0xe6bd96,0x905e47][i%4]);scene.add(mesh);
      const kind=world.parks.length&&i%6===5?'park':i%9===4?'jogger':'walker';
      const p={x:252,z:-250+(i%60)*8,mesh,vertical:true,line:252,dir:rand()<.5?-1:1,speed:kind==='jogger'?3.1:.9+rand()*.8,phase:rand()*6,panic:0,down:0,hitCooldown:0,health:100,dead:false,deadTime:0,wait:0,chat:0,chatCd:rand()*25,turnCd:0,kind,home:world.parks[i%Math.max(1,world.parks.length)],jay:rand()<.12,fear:null,cower:false,frozen:false};
      placePed(p,false);peds.push(p);
    }
    let ending='dead';
    function endScene(kind,title,cause){
      roadblocks.clear('ended');
      // Nothing from the lost run may follow the player to the respawn.
      peds.concat(cars).forEach(w=>w.call=null);callers=[];grenades.forEach(g=>{g.t=0;g.m.visible=false;});
      police.units.forEach(u=>{u.foot=false;u.back=false;if(u.officer)u.officer.visible=false;});
      if(job)failJob(kind==='busted'?'você foi preso':'você não chegou');
      if(campaign&&campaign.state.status==='active')applyCampaignEvent(campaign.fail(kind==='busted'?'você foi preso':'você não chegou'));
      ending=kind;deathTime=0;$('wastedTitle').textContent=title;$('wastedCause').textContent=cause;$('wastedText').style.opacity=0;$('wasted').classList.toggle('busted',kind==='busted');setMode('dead');}
    function caught(){
      if(mode!=='play')return;const c=player.car;if(c){c.speed=0;player.car=null;}
      player.stun=0;human.visible=true;human.rotation.set(0,player.heading,0);human.position.set(player.x,world.getElevation(player.x,player.z),player.z);animateHuman(human,0,0);human.userData.arms.forEach(a=>a.rotation.x=-2.9);
      endScene('busted','RODOU','Preso em flagrante · multa de R$ 100');audio.beep(196,.5,'square',.2);
    }
    const police=new BN.Police(world,()=>{const mesh=BN.createCar(THREE,0xe7eee7,true);scene.add(mesh);return mesh;},caught,toast);
    const cityLife=BN.createCityLife(THREE,scene,world,toast);
    // Roadblocks: two cruisers laid across a street ahead of a hot chase, with a gap a car can pass through.
    const roadblockMeshes=new Map();
    const roadblocks=new BN.RoadblockManager(world,{
      build:b=>{
        const meshes=b.cars.map(car=>{const mesh=BN.createCar(THREE,0xe7eee7,true);mesh.position.set(car.x,0,car.z);mesh.rotation.y=car.heading+(car.side>0?Math.PI:0);scene.add(mesh);return mesh;});
        roadblockMeshes.set(b.id,meshes);toast('Bloqueio policial à frente · há espaço para desviar');
      },
      remove:b=>{(roadblockMeshes.get(b.id)||[]).forEach(m=>scene.remove(m));roadblockMeshes.delete(b.id);}
    });
    function updateRoadblocks(dt){
      const car=player.car,dir=car?{x:Math.sin(car.heading),z:Math.cos(car.heading)}:(police.lastDir||{x:0,z:1});
      roadblocks.update(dt,{level:police.level,state:police.state,driving:Boolean(car),target:player,dir});
      for(const [id,meshes] of roadblockMeshes)meshes.forEach((m,i)=>{m.visible=dist(m.position,player)<carCull;(m.userData.lights||[]).forEach((l,j)=>{if(l.material)l.material.emissiveIntensity=Math.sin(elapsed*16+j*Math.PI+i)>0?4:.1;});});
    }
    function contextAction(){if(nearGarage()){openGarage();return;}if(!player.car&&cityLife.interact(player))return;enterExit();}
    function tryCompanionRide(){
      if(!player.car||adultRide)return false;
      const companion=cityLife.nearestCompanion(player,13);if(!companion)return false;
      if(balance<120){toast('A companhia custa R$ 120. Falta dinheiro.');return true;}
      balance-=120;adultRide={companion,quiet:0};cityLife.boardCompanion(companion);save();updateMission();toast('Companhia a bordo · pare num estacionamento ou na praia.');return true;
    }
    function updateCompanionRide(dt){
      if(!adultRide)return;
      if(!player.car){cityLife.releaseCompanion(adultRide.companion);adultRide=null;canvas.style.filter='';toast('A companhia desceu.');return;}
      const quiet=player.x>265||world.lots.some(l=>dist(player,l)<11);
      if(!quiet||player.speed>1||police.level>0){adultRide.quiet=0;canvas.style.filter='';player.car.mesh.rotation.z=0;return;}
      adultRide.quiet+=dt;
      if(adultRide.quiet>1){const fade=smooth(1,2.2,adultRide.quiet)*(1-smooth(5.5,7,adultRide.quiet));canvas.style.filter='brightness('+(1-fade*.72).toFixed(2)+')';player.car.mesh.rotation.z=Math.sin(elapsed*7)*.025;}
      if(adultRide.quiet>=7){player.car.mesh.rotation.z=0;canvas.style.filter='';cityLife.releaseCompanion(adultRide.companion);adultRide=null;toast('Encontro encerrado · a noite continua.');save();}
    }
    // A crime only reaches the police when an officer sees it or a witness finishes a phone call.
    // The vehicle the police believe the suspect is using. null means on foot.
    let crimeCount=0,knownCar=null,alleyHint=-99;
    const CRIME_TYPES=Object.freeze({
      vehicle_theft:{label:'Furto de veículo',weight:2,violent:false},vehicle_robbery:{label:'Roubo de veículo',weight:2,violent:false},radio_car_theft:{label:'Furto do carro da rádio',weight:2,violent:false},
      dangerous_collision:{label:'Colisão perigosa',weight:1,violent:false},hit_and_run:{label:'Atropelamento',weight:3,violent:true},fatal_hit:{label:'Atropelamento fatal',weight:3,violent:true},
      gunfire:{label:'Disparos em via pública',weight:1,violent:true},armed_assault:{label:'Agressão armada',weight:2,violent:true},homicide:{label:'Homicídio',weight:3,violent:true},explosion:{label:'Explosão',weight:4,violent:true},
      police_shot:{label:'Policial baleado',weight:3,violent:true},police_killed:{label:'Policial morto',weight:4,violent:true},police_attack:{label:'Ataque a viatura',weight:3,violent:true},police_collision:{label:'Colisão com viatura',weight:2,violent:true},police_destroyed:{label:'Viatura destruída',weight:4,violent:true},
      test:{label:'Ocorrência de teste',weight:2,violent:false}
    });
    function crime(code,direct){
      const occurrence=CRIME_TYPES[code];if(!occurrence)throw new Error('Código de ocorrência desconhecido: '+code);
      const {label,weight,violent}=occurrence;crimeCount++;
      peds.forEach(p=>{if(!p.dead&&!p.frozen&&dist(p,player)<35&&p.panic<=0){p.panic=5;p.fear=null;p.cower=false;}});
      const sees=u=>{const e=u.foot?{x:u.fx,z:u.fz}:u;return dist(e,player)<cfg.policeSight&&BN.hasLineOfSight(e,player,world.buildings);};
      if(direct||police.units.some(sees)){knownCar=player.car;police.report(label,weight,player,violent);return;}
      let witness=null,best=1e9;
      for(const p of peds){if(p.dead||p.down>0)continue;const d=dist(p,player);if(d>42||!BN.hasLineOfSight(p,player,world.buildings))continue;const score=d-(p.call?100:0);if(score<best){best=score;witness=p;}}
      if(!witness)witness=cars.find(c=>c.traffic&&!c.wreck&&dist(c,player)<32&&BN.hasLineOfSight(c,player,world.buildings));
      if(!witness){toast(label+' · Ninguém viu');return;}
      witness.call={t:witness.call?witness.call.t:3.5+rnd()*2,code,label,weight:(witness.call?witness.call.weight:0)+weight,x:player.x,z:player.z,violent:violent||Boolean(witness.call&&witness.call.violent),car:player.car};
      toast(label+' · Uma testemunha está ligando para a polícia');
    }
    const callMarks=Array.from({length:6},()=>{const m=new THREE.Mesh(new THREE.OctahedronGeometry(.28),new THREE.MeshBasicMaterial({color:0xffd23f}));m.visible=false;scene.add(m);return m;});
    let callers=[];
    function updateCalls(dt){
      callers=[];
      for(const w of peds.concat(cars)){
        if(!w.call)continue;
        if(w.dead||w.down>0||w.wreck){w.call=null;toast('Testemunha silenciada. A ligação caiu.');continue;}
        w.call.t-=dt;
        if(w.call.t<=0){knownCar=w.call.car;police.report(w.call.label,w.call.weight,{x:w.call.x,z:w.call.z},w.call.violent);w.call=null;}else callers.push(w);
      }
      callMarks.forEach((m,i)=>{const w=callers[i];m.visible=Boolean(w);if(w){m.position.set(w.x,2.6+Math.sin(elapsed*6)*.12,w.z);m.rotation.y=elapsed*3;}});
    }
    // Cash dropped by the fallen, picked up on foot.
    const cashGeo=new THREE.BoxGeometry(.42,.08,.24),cashMat=new THREE.MeshStandardMaterial({color:0x5fd07a,emissive:0x1f6b35,emissiveIntensity:.6});
    const cash=Array.from({length:14},()=>{const m=new THREE.Mesh(cashGeo,cashMat);m.visible=false;scene.add(m);return {m,t:0,amount:0};});let cashNext=0;
    function dropCash(x,z){const k=cash[cashNext];cashNext=(cashNext+1)%cash.length;k.t=45;k.amount=5+Math.floor(rnd()*5)*5;k.m.position.set(x+rnd()-.5,.5,z+rnd()-.5);k.m.visible=true;}
    function updateCash(dt){for(const k of cash){if(k.t<=0)continue;k.t-=dt;k.m.rotation.y+=dt*2;if(!player.car&&Math.hypot(k.m.position.x-player.x,k.m.position.z-player.z)<1.5){balance+=k.amount;k.t=0;save();toast('+R$ '+k.amount);audio.beep(880,.1);$('balance').textContent='R$ '+balance;}if(k.t<=0)k.m.visible=false;}}
    function updateOfficers(){
      for(const u of police.units){
        if(!u.foot){if(u.officer)u.officer.visible=false;continue;}
        if(!u.officer){u.officer=BN.createHuman(THREE,0x1d3557,[0x68483b,0xb88460,0xe6bd96][u.patrolStep%3]);scene.add(u.officer);u.oh=100;}
        const o=u.officer,e={x:u.fx,z:u.fz};o.visible=dist(e,player)<140;o.position.set(u.fx,0,u.fz);o.rotation.set(0,u.fh,0);
        animateHuman(o,elapsed*11+u.patrolStep,u.fspeed>0?.7:0);if(police.level>=2&&police.violent&&u.fspeed===0&&!u.back)o.userData.arms[1].rotation.x=-Math.PI/2;
        if(player.car&&player.speed>8&&dist(e,player)<2.3){player.car.speed*=.6;audio.impact();officerDown(u,'Policial atropelado');}
      }
    }
    function officerDown(u,label){
      if(!u.officer){u.officer=BN.createHuman(THREE,0x1d3557,0xb88460);scene.add(u.officer);}
      const o=u.officer;o.visible=true;animateHuman(o,0,0);o.rotation.set(-Math.PI/2,0,rnd()*6.28);o.position.set(u.fx,.24,u.fz);bleed(u.fx,u.fz,1.3);wrecks.push({mesh:o,t:40});
      police.destroy(u);(u.mesh.userData.lights||[]).forEach(m=>{if(m.material)m.material.emissiveIntensity=.05;});
      // The empty cruiser stays behind and can be driven away.
      cars.push({x:u.x,z:u.z,heading:u.heading,speed:0,lat:0,type:'sedan',color:0xf0eee2,baseY:1,mesh:u.mesh,traffic:false,owned:false,path:[],waypoint:0,damage:u.damage,hitCooldown:0,home:{x:u.x,z:u.z,heading:u.heading},wreck:false,wreckTime:0,scared:0,stuck:0,byPlayer:false});
      crime('police_killed',true);
    }
    function attemptMove(actor,nx,nz,r){
      const steps=Math.max(1,Math.ceil(Math.hypot(nx-actor.x,nz-actor.z)/.65)),dx=(nx-actor.x)/steps,dz=(nz-actor.z)/steps;let hit=false;
      for(let i=0;i<steps;i++){if(!world.isBlocked(actor.x+dx,actor.z,r))actor.x+=dx;else hit=true;if(!world.isBlocked(actor.x,actor.z+dz,r))actor.z+=dz;else hit=true;}
      return hit;
    }
    // Cars are solid for the player on foot: an oriented box around each body.
    function carAt(x,z,r,skip){
      for(const list of [cars,police.units])for(const c of list){
        if(c===skip)continue;const dx=x-c.x,dz=z-c.z;if(Math.abs(dx)>4||Math.abs(dz)>4)continue;
        const sn=Math.sin(c.heading),cs=Math.cos(c.heading);
        if(Math.abs(dx*cs-dz*sn)<1.03+r&&Math.abs(dx*sn+dz*cs)<2.15+r)return c;
      }
      return null;
    }
    // Pedestrians give way: they are shoved aside and the player only gets a light nudge, so a crowd never pins anyone.
    const crowd=[];
    function softCrowd(){
      crowd.length=0;for(const p of peds)if(!p.dead&&p.down<=0&&Math.abs(p.x-player.x)<1.4&&Math.abs(p.z-player.z)<1.4)crowd.push(p);
      return crowd.length?BN.softPush(player,crowd,{actorRadius:.42,otherRadius:.4,canMove:(x,z,r)=>!world.isBlocked(x,z,r)&&!carAt(x,z,r,null)}):0;
    }
    function walkPlayer(nx,nz){
      const r=.42,inside=carAt(player.x,player.z,r);
      if(inside){
        // Overlapping a car (it rolled onto the player): slide out through the nearest side.
        const sn=Math.sin(inside.heading),cs=Math.cos(inside.heading),side=((player.x-inside.x)*cs-(player.z-inside.z)*sn)>=0?1:-1,px=player.x+cs*side*.25,pz=player.z-sn*side*.25;
        if(!world.isBlocked(px,pz,r)){player.x=px;player.z=pz;}
      }
      const steps=Math.max(1,Math.ceil(Math.hypot(nx-player.x,nz-player.z)/.4)),dx=(nx-player.x)/steps,dz=(nz-player.z)/steps,free=(x,z)=>!world.isBlocked(x,z,r)&&!carAt(x,z,r,inside);
      for(let i=0;i<steps;i++){if(free(player.x+dx,player.z))player.x+=dx;if(free(player.x,player.z+dz))player.z+=dz;}
    }
    function enterExit(){
      if(player.car){
        const c=player.car;if(Math.abs(c.speed)>4){toast('Reduza a velocidade para sair.');return;}
        const options=[{x:c.x+Math.cos(c.heading)*3,z:c.z-Math.sin(c.heading)*3},{x:c.x-Math.cos(c.heading)*3,z:c.z+Math.sin(c.heading)*3},{x:c.x-Math.sin(c.heading)*4,z:c.z-Math.cos(c.heading)*4}];
        const p=options.find(p=>!world.isBlocked(p.x,p.z,.5)&&!carAt(p.x,p.z,.42,c));if(!p){toast('A porta está bloqueada. Mova o carro.');return;}
        player.car=null;c.speed=0;player.x=p.x;player.z=p.z;human.visible=true;toast('A pé · Shift para correr');
      }else{
        const near=cars.filter(c=>!c.wreck&&dist(c,player)<6&&Math.abs(c.speed)<5).sort((a,b)=>dist(a,player)-dist(b,player))[0];
        if(!near){toast('Chegue perto de um carro parado.');return;}
        const jacked=near.traffic;near.traffic=false;near.lat=0;human.visible=false;player.x=near.x;player.z=near.z;orbitYaw=near.heading+Math.PI;player.car=near;
        if(jacked){
          // The driver is thrown out, runs and may be the one who calls it in.
          const drv=peds.find(p=>!p.dead&&!p.frozen&&!p.call&&p.down<=0&&dist(p,player)>110),sx=near.x+Math.cos(near.heading)*2.4,sz=near.z-Math.sin(near.heading)*2.4;
          if(drv&&!world.isBlocked(sx,sz,.6)){drv.x=sx;drv.z=sz;drv.kind='walker';drv.panic=9;drv.fear={x:near.x,z:near.z};drv.cower=false;drv.chat=0;drv.wait=0;}
        }
        if(!near.owned){near.owned=true;crime(jacked?'vehicle_robbery':'vehicle_theft');}else toast(VEHICLES[near.type].name+' · '+VEHICLES[near.type].note);
      }
    }
    function animateHuman(mesh,phase,amount){(mesh.userData.legs||[]).forEach((m,i)=>m.rotation.x=Math.sin(phase+i*Math.PI)*amount);(mesh.userData.arms||[]).forEach((m,i)=>m.rotation.x=-Math.sin(phase+i*Math.PI)*amount*.8);}
    const missionGroup=new THREE.Group();scene.add(missionGroup);
    const markerMaterial=new THREE.MeshBasicMaterial({color:0x8de3cf,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false});
    const ring=new THREE.Mesh(new THREE.TorusGeometry(4,.17,6,40),markerMaterial);ring.rotation.x=Math.PI/2;ring.position.y=.3;missionGroup.add(ring);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,14,12,1,true),new THREE.MeshBasicMaterial({color:0x8de3cf,transparent:true,opacity:.11,side:THREE.DoubleSide,depthWrite:false}));beam.position.y=7;missionGroup.add(beam);
    const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(.85),new THREE.MeshStandardMaterial({color:0x8de3cf,emissive:0x8de3cf,emissiveIntensity:1}));diamond.position.y=4;missionGroup.add(diamond);
    // ---- Campaign, contracts and time trials share one contextual objective layer. ----
    const RULES={perishable:'derrete com o tempo',fragile:'quebra em batidas',smooth:'bônus por direção suave'};
    let job=null,lastResult='';
    function contractOffers(){
      const unlocked=cfg.deliveries.filter(item=>reputation>=item.rep);
      if(unlocked.length<=3)return unlocked;
      const page=Math.floor(completed/3)%Math.ceil(unlocked.length/3),result=[];
      for(let i=0;i<Math.min(3,unlocked.length);i++)result.push(unlocked[(page*3+i)%unlocked.length]);
      return result;
    }
    function campaignTargets(){
      const objective=campaign.objective();if(!objective||objective.failed)return [];
      const landmarks=Object.values(cfg.landmarks);
      return objective.targets.filter(id=>!campaign.state.collected.includes(id)).map(id=>landmarks.find(item=>item.id===id)).filter(Boolean);
    }
    function campaignTarget(){return campaignTargets()[0]||null;}
    function raceTarget(){if(!activeRace)return null;const p=activeRace.def.points[activeRace.checkpoint];return p&&{x:p[0],z:p[1]};}
    function target(){return job?(job.stage==='pickup'?{x:job.def.px,z:job.def.pz}:job.def):(raceTarget()||campaignTarget());}
    function acceptJob(i){
      const def=contractOffers()[i];if(job||activeRace||!def||mode!=='play')return;
      job={i,def,stage:'pickup',cargo:100,time:0,limit:0,car:null,hits:0};missionIndex=i;lastResult='';
      toast(def.name+' aceito · '+(def.family==='passenger'?'Busque o passageiro':def.family==='recovery'?'Recupere o veículo':'Retire a carga de carro'));audio.beep(523,.12);updateMission();
    }
    function failJob(why){if(!job)return;lastResult=job.def.name+' perdido: '+why+'. Sem pagamento.';toast(lastResult);job=null;missionCooldown=3;updateMission();}
    // Impacts hurt fragile cargo most. Padding in the garage softens every loss.
    function cargoLoss(amount){if(!job||job.stage!=='deliver'||player.car!==job.car)return;job.cargo=Math.max(0,job.cargo-amount*(upgrades.cargo?.6:1));}
    function cargoHit(speed){if(!job||job.def.kind==='perishable')return;job.hits++;cargoLoss(speed*(job.def.kind==='fragile'?2.2:1.3));}
    function cargoShake(amount){if(job&&job.def.kind==='smooth')cargoLoss(amount);}
    function updateJob(dt){
      missionCooldown=Math.max(0,missionCooldown-dt);
      if(!job)return;
      const def=job.def,t=target(),stopped=dist(player,t)<6&&player.speed<2&&player.car&&missionCooldown===0;
      if(job.stage==='pickup'){
        if(!stopped)return;
        job.stage='deliver';job.car=player.car;job.time=0;job.limit=Math.hypot(def.x-def.px,def.z-def.pz)/9+22;missionCooldown=1.5;
        toast((def.family==='passenger'?'Passageiro a bordo':def.family==='recovery'?'Veículo recuperado':'Carga a bordo')+' · '+RULES[def.kind]);audio.beep(587,.12);updateMission();return;
      }
      job.time+=dt;
      if(job.car.wreck){failJob('o veículo do serviço foi destruído');return;}
      if(def.kind==='perishable')cargoLoss(100/job.limit*dt/(upgrades.cargo?.6:1)*(upgrades.cargo?.8:1));
      if(job.cargo<=0&&def.kind!=='smooth'){failJob(def.kind==='perishable'?'o sorvete virou sopa':'a integridade chegou a zero');return;}
      if(!stopped||player.car!==job.car||police.level>0)return;
      const base={perishable:.3,fragile:.25,smooth:.6}[def.kind],fixed=Math.round(def.reward*base),qualityPay=Math.round(def.reward*(1-base)*job.cargo/100),wetBonus=rain>.5?Math.round(def.reward*.2):0,total=fixed+qualityPay+wetBonus;
      balance+=total;completed++;reputation+=def.family==='delivery'?1:2;missionCooldown=3;
      lastResult=def.name+' · R$ '+total+' = garantido '+fixed+' + '+({perishable:'qualidade',fragile:'integridade',smooth:'conforto'}[def.kind])+' '+Math.round(job.cargo)+'% '+qualityPay+(wetBonus?' + chuva '+wetBonus:'')+(job.hits?' · '+job.hits+' batida'+(job.hits>1?'s':''):' · sem batidas');
      toast(lastResult);audio.beep(659,.3);job=null;updateMission();save();
    }
    function applyCampaignEvent(event){
      if(!event)return;
      if(event.type==='blocked'){if(missionCooldown<=0){toast(event.message);missionCooldown=2;}return;}
      balance=Math.max(0,balance-(event.spent||0));balance+=event.reward||0;reputation+=event.reputation||0;missionCooldown=1.6;
      const mission=campaign.definition(),speaker=mission&&mission.number%2===0?'NANDO HERTZ':'DORA DENDÊ';
      dialogue(speaker,event.message);audio.beep(event.type.includes('complete')?784:587,.2,'triangle',.14);
      if(event.type==='campaign-complete'&&world.setFinale)world.setFinale(true);
      routeDestination=null;routePoints=[];updateMission();save();
    }
    function updateCampaign(dt){
      if(job||activeRace)return;
      const car=player.car,roughness=car?Math.abs(car.lat)*.25+(keys.has('Space')&&Math.abs(car.speed)>8?2:0):0;
      const event=campaign.tick(dt,{roughness,damage:car?car.damage:0});if(event){applyCampaignEvent(event);return;}
      if(campaign.state.status!=='active'||missionCooldown>0)return;
      for(const landmark of campaignTargets())if(dist(player,landmark)<6&&player.speed<2){applyCampaignEvent(campaign.arrive(landmark.id,{hasCar:Boolean(player.car),balance}));break;}
    }
    function startRace(){
      if(job||activeRace||campaign.state.status==='failed')return;
      const def=cfg.races[raceIndex++%cfg.races.length];activeRace={def,checkpoint:0,time:0,vehicle:player.car&&player.car.type};lastResult='';toast(def.name+' · vá ao primeiro checkpoint');updateMission();
    }
    function updateRace(dt){
      if(!activeRace)return;activeRace.time+=dt;
      if(!player.car){toast('Contrarrelógio encerrado: você saiu do carro.');activeRace=null;updateMission();return;}
      const t=raceTarget();if(!t||dist(player,t)>7)return;
      activeRace.checkpoint++;audio.beep(700+activeRace.checkpoint*35,.08);
      if(activeRace.checkpoint<activeRace.def.points.length){updateMission();return;}
      const key=activeRace.def.id+':'+player.car.type,old=Number(raceRecords[key])||Infinity,time=activeRace.time,delta=Number.isFinite(old)?time-old:null;
      if(time<old)raceRecords[key]=Number(time.toFixed(2));
      const medals=activeRace.def.medals,medal=time<=medals[0]?'OURO':time<=medals[1]?'PRATA':time<=medals[2]?'BRONZE':'CONCLUÍDO';
      lastResult=activeRace.def.name+' · '+time.toFixed(2)+' s · '+medal+(delta===null?' · primeiro recorde':delta<0?' · '+Math.abs(delta).toFixed(2)+' s melhor':' · +'+delta.toFixed(2)+' s do recorde');
      reputation+=medal==='OURO'?3:medal==='PRATA'?2:1;activeRace=null;toast(lastResult);save();updateMission();
    }
    function updateMission(){
      const t=target();missionGroup.visible=Boolean(t);if(t)missionGroup.position.set(t.x,0,t.z);
      const campaignActive=!job&&!activeRace&&campaign.state.status!=='finished';markerMaterial.color.setHex(campaignActive?0xff805b:0x8de3cf);diamond.material.color.setHex(campaignActive?0xff805b:0x8de3cf);diamond.material.emissive.setHex(campaignActive?0xff805b:0x8de3cf);
      $('balance').textContent='R$ '+balance;
      if(job){$('missionTitle').textContent=job.def.name;$('missionText').textContent=job.stage==='pickup'?(job.def.family==='passenger'?'Busque o passageiro e pare para o embarque.':job.def.family==='recovery'?'Entre no veículo indicado.':'Retire a carga no marcador. Pare o carro dentro do círculo.'):job.def.text;return;}
      if(activeRace){$('missionTitle').textContent=activeRace.def.name;$('missionText').textContent='Checkpoint '+(activeRace.checkpoint+1)+' de '+activeRace.def.points.length+' · '+activeRace.time.toFixed(1)+' s';return;}
      const objective=campaign.objective();
      if(objective){const firstStep=objective.mission.number===1&&campaign.state.step===0;$('missionTitle').textContent=objective.failed?'Missão interrompida':'Capítulo '+objective.mission.number+' · '+objective.mission.title;$('missionText').innerHTML='<b>'+objective.text+'</b><br><span class="route-note">'+(firstStep?'M abre o mapa · o marcador coral mostra o destino':'Reputação '+reputation+' · M mapa · L corridas · P foto')+'</span>';return;}
      const offers=contractOffers();$('missionTitle').textContent='Mundo aberto · quadro de serviços';
      $('missionText').innerHTML=(lastResult?'<b>'+lastResult+'</b><br>':'')+offers.map((d,i)=>'<kbd>'+(i+1)+'</kbd> '+d.name+' · até R$ '+d.reward+' · '+RULES[d.kind]).join('<br>');
    }
    // ---- Garage: repairs, upgrades with a trade-off, supplies and other cars ----
    const garageMark=new THREE.Group();scene.add(garageMark);garageMark.position.set(cfg.garage.x,0,cfg.garage.z);
    const garageMat=new THREE.MeshBasicMaterial({color:0xffa24a,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false});
    {const r=new THREE.Mesh(new THREE.TorusGeometry(4.5,.17,6,40),garageMat);r.rotation.x=Math.PI/2;r.position.y=.3;garageMark.add(r);const b=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,12,10,1,true),new THREE.MeshBasicMaterial({color:0xffa24a,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));b.position.y=6;garageMark.add(b);}
    const nearGarage=()=>dist(player,cfg.garage)<8&&player.speed<2;
    function garageItems(){
      const c=player.car,items=[],buy=(label,note,cost,ok,fn)=>items.push({label,note,cost,ok:ok&&balance>=cost,fn});
      if(starterCar.wreck||(!c&&balance<40))buy('Resgate comunitário','Recoloca o Maré Compacto na oficina sem custo',0,true,()=>{starterCar.mesh.traverse(m=>{if(m.isMesh&&m.userData.paint)m.material=m.userData.paint;});starterCar.mesh.rotation.z=0;starterCar.mesh.scale.y=starterCar.baseY||1;starterCar.wreck=false;starterCar.damage=0;starterCar.lat=starterCar.speed=0;starterCar.x=cfg.garage.x+3;starterCar.z=cfg.garage.z+7;starterCar.mesh.position.set(starterCar.x,0,starterCar.z);starterCar.mesh.visible=true;});
      if(c)buy('Reparar '+VEHICLES[c.type].name,'Dano atual '+Math.round(Math.min(100,c.damage))+'%',40+Math.round(Math.min(100,c.damage)*.4),c.damage>1,()=>{c.damage=0;c.warned=false;c.mesh.scale.y=c.baseY;});
      if(police.level>0&&c)buy('Repintar e trocar a placa','A polícia passa a procurar o carro antigo',150,true,()=>{setCarType(c,c.type,[0x3f8f8a,0xd9a441,0x8a5a7a,0xc9cfd2,0x2f3b46][Math.floor(rnd()*5)]);knownCar={};});
      buy('Freios reforçados','Para 60% mais forte',300,!upgrades.brakes,()=>upgrades.brakes=true);
      buy('Pneus de chuva','Quase sem perda no molhado · 6% menos velocidade final',300,!upgrades.tires,()=>upgrades.tires=true);
      buy('Proteção de carga','Carga perde 40% menos · 8% menos aceleração',300,!upgrades.cargo,()=>upgrades.cargo=true);
      buy('Munição','+24 balas na reserva',60,player.reserve<240,()=>player.reserve=Math.min(240,player.reserve+24));
      buy('Granadas','+2 granadas',90,player.grenades<9,()=>player.grenades=Math.min(9,player.grenades+2));
      for(const type of ['compact','sedan','sport']){
        const v=VEHICLES[type],mine=garageOwned.has(type);if(type===starterCar.type)continue;
        buy((mine?'Buscar seu ':'Comprar ')+v.name,v.note,mine?0:v.price,!starterCar.wreck,()=>{garageOwned.add(type);setCarType(starterCar,type);starterCar.damage=0;if(player.car!==starterCar){starterCar.x=cfg.garage.x+3;starterCar.z=cfg.garage.z+7;starterCar.heading=0;starterCar.speed=starterCar.lat=0;starterCar.mesh.position.set(starterCar.x,0,starterCar.z);starterCar.mesh.rotation.y=0;}});
      }
      if(c&&c!==starterCar&&!garageOwned.has(c.type))buy('Regularizar este '+VEHICLES[c.type].name,'O modelo passa a ser seu na oficina',Math.round(VEHICLES[c.type].price*.35),true,()=>garageOwned.add(c.type));
      return items;
    }
    let garageList=[];
    function drawGarage(){
      garageList=garageItems();
      $('garageMoney').textContent='Saldo R$ '+balance;
      $('garageList').innerHTML=garageList.map((it,i)=>'<button class="shop-item" data-i="'+i+'"'+(it.ok?'':' disabled')+'><b>'+it.label+'</b><span>'+it.note+'</span><em>'+(it.cost?'R$ '+it.cost:'grátis')+'</em></button>').join('');
    }
    function garageBuy(i){const it=garageList[i];if(!it||!it.ok)return false;balance-=it.cost;it.fn();audio.beep(784,.12);save();updateMission();drawGarage();return true;}
    function openGarage(){
      if(mode!=='play'||!nearGarage())return;
      if(police.level>0&&police.visible){toast('A oficina não abre com a polícia olhando.');return;}
      setMode('garage');drawGarage();
    }
    updateMission();
    // Rain is a single dynamic buffer around the camera, independent of map size.
    const rainCount=800,rainData=new Float32Array(rainCount*6),rainGeo=new THREE.BufferGeometry();
    for(let i=0;i<rainCount;i++){const j=i*6,x=(rand()-.5)*80,y=rand()*45,z=(rand()-.5)*80;rainData.set([x,y,z,x-.25,y-1.1,z],j);}
    rainGeo.setAttribute('position',new THREE.BufferAttribute(rainData,3));
    const rainMat=new THREE.LineBasicMaterial({color:0xc4dedf,transparent:true,opacity:0,depthWrite:false});const rainMesh=new THREE.LineSegments(rainGeo,rainMat);rainMesh.frustumCulled=false;scene.add(rainMesh);
    function weather(dt){
      hour=(hour+dt*24/cfg.dayLength)%24;
      night=1-smooth(-.15,.16,Math.sin((hour-6)/24*Math.PI*2));
      weatherTimer-=dt;if(weatherTimer<=0){rainTarget=rainTarget>.5?0:1;weatherTimer=rainTarget?45+rand()*50:65+rand()*85;}
      rain=lerp(rain,rainTarget,Math.min(1,dt*.18));
      const day=new THREE.Color(0x91bec9),dusk=new THREE.Color(0xd4a1a1),dark=new THREE.Color(0x101e35);
      const sunset=Math.max(0,1-Math.abs(hour-18)/2.5);day.lerp(dusk,sunset*.72).lerp(dark,night).lerp(new THREE.Color(0x536676),rain*.35);
      scene.background.copy(day);scene.fog.color.copy(day);scene.fog.far=captureScene==='island-aerial'?1100:650-rain*210;
      hemi.intensity=lerp(2.2,.65,night)*(1-rain*.16);sun.intensity=lerp(3.1,.45,night)*(1-rain*.5);
      sun.color.set(night>.7?0xabc5ee:0xffd3a1);sun.position.set(player.x-110,190,player.z+110);sun.target.position.set(player.x,0,player.z);
      rainMat.opacity=rain*.45;rainMesh.visible=rain>.02;rainMesh.position.set(player.x,0,player.z);
      if(rainMesh.visible){for(let i=0;i<rainCount;i++){const j=i*6;rainData[j+1]-=dt*25;rainData[j+4]-=dt*25;if(rainData[j+1]<0){rainData[j+1]=45;rainData[j+4]=43.9;}}rainGeo.attributes.position.needsUpdate=true;}
      world.update(dt,{time:elapsed,night,rain,focus:player});
    }
    function updatePlayer(dt){
      collisionCooldown=Math.max(0,collisionCooldown-dt);player.invincible=Math.max(0,player.invincible-dt);if(touchDevice())aiming=!player.car&&touch.third;else if(inputMode.mode==='gamepad')aiming=!player.car&&gamepad.state.brake>.4;
      const keyboardF=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),keyboardSide=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
      const g=gamepad.state,f=clamp(keyboardF+(player.car?(touch.primary?1:0)-(touch.secondary?1:0)+g.throttle-g.brake:-touch.y-g.move.y),-1,1),side=clamp(keyboardSide+touch.x+g.move.x,-1,1);
      if(player.car){
        const c=player.car,v=VEHICLES[c.type],brake=keys.has('Space')||touch.third||Boolean(g.down.handbrake);
        // Wet asphalt costs traction, braking and grip. Rain tires recover most of it.
        const wet=rain*(upgrades.tires?.15:.5);
        c.speed+=f*v.accel*(upgrades.cargo?.92:1)*(1-wet*.45)*dt;
        c.speed*=Math.exp(-(f===0?1:.15)*dt);
        const stopping=v.brake*(upgrades.brakes?1.6:1)*(1-wet*.7);
        if(f<0&&c.speed>1)c.speed=Math.max(0,c.speed-stopping*2.4*dt);
        if(brake)c.speed*=Math.exp(-stopping*(f>0?.12:.5)*dt);
        c.speed=clamp(c.speed,-cfg.carReverse,v.top*(upgrades.tires?.94:1)*(1-Math.min(c.damage,100)*.0045));
        if(c.damage>75&&!c.warned){c.warned=true;toast('O motor pegou fogo. Saia do carro!');}
        // The body turns first. The car keeps part of its old direction until the tires bite,
        // so there is a forward and a sideways speed. The handbrake lets the rear go.
        const turn=side*v.steer*clamp(Math.abs(c.speed)/6,0,1)/(1+Math.abs(c.speed)/55)*Math.sign(c.speed||1)*(brake?1.5:1)*dt;
        c.heading-=turn;
        const sn=Math.sin(turn),cs=Math.cos(turn),fwd=c.speed*cs-c.lat*sn,lat=c.speed*sn+c.lat*cs;
        c.speed=fwd;c.lat=lat*Math.exp(-v.grip*(1-wet)*(brake?.2:1)*dt);
        c.speed*=Math.exp(-Math.abs(c.lat)*.035*dt);
        const hs=Math.sin(c.heading),hc=Math.cos(c.heading),ox=c.x,oz=c.z;
        const vx=hs*c.speed+hc*c.lat,vz=hc*c.speed-hs*c.lat;
        // Lamp posts and traffic lights fall over when hit fast enough. Slow contact still stops the car.
        for(const post of world.fixtures.impact(c.x+vx*dt,c.z+vz*dt,v.radius,Math.hypot(c.speed,c.lat),vx,vz)){
          c.damage+=post.damage/v.tough;c.speed*=post.drag;sparks(post.x,post.z,6);audio.impact();rumble(.45,.7,110);cargoLoss(post.damage);
        }
        if(streets.isWrongWay(c.x,c.z,c.heading)&&c.speed>5){wrongWayTime+=dt;if(wrongWayTime>2){wrongWayTime=-12;toast('Contramão · esta rua é de sentido único');}}
        else wrongWayTime=wrongWayTime>0?0:Math.min(0,wrongWayTime+dt);
        const hit=attemptMove(c,c.x+vx*dt,c.z+vz*dt,v.radius);
        if(hit&&v.radius>1.2&&elapsed-alleyHint>12&&world.alleys.some(a=>Math.abs(c.x-a.x)<6&&Math.abs(Math.abs(c.z-a.z)-18)<5)){alleyHint=elapsed;toast('Largo demais para a viela. Só o compacto passa.');}
        if(Math.abs(c.lat)>5){
          // Tire smoke and a shaken cargo while the car is sideways.
          if(rnd()<dt*22)puffs.emit(c.x-hs*1.6,.4,c.z-hc*1.6,rnd()-.5,.8+rnd(),rnd()-.5,.6+rnd()*.5,[.62,.62,.6],-.6);
          cargoShake(dt*(Math.abs(c.lat)-5)*2.2);
        }
        if(brake&&Math.abs(c.speed)>10)cargoShake(dt*10);
        // Slow contact with another vehicle stops the car instead of passing through it.
        for(const list of [cars,police.units])for(const o of list){if(o===c)continue;const d=Math.hypot(o.x-c.x,o.z-c.z);if(d<2.5&&d<Math.hypot(o.x-ox,o.z-oz)){c.x=ox;c.z=oz;c.lat=0;if(Math.abs(c.speed)<=5)c.speed=0;break;}}
        const impact=Math.hypot(c.speed,c.lat);
        if(hit&&impact>5){if(collisionCooldown===0){hurt(Math.min(15,impact*.35),'batida de carro');c.damage+=impact*.8/v.tough;cargoHit(impact);sparks(c.x+hs*2,c.z+hc*2,10);audio.impact();collisionCooldown=.8;}c.speed*=-.2;c.lat=0;}
        else if(hit)c.lat*=.5;
        player.x=c.x;player.z=c.z;player.heading=c.heading;player.speed=Math.hypot(c.speed,c.lat);
        if(!dragging&&cameraMotion)orbitYaw+=wrap(c.heading+Math.PI-orbitYaw)*Math.min(1,dt*2.1);
        c.mesh.position.set(c.x,0,c.z);c.mesh.rotation.y=c.heading;
        (c.mesh.userData.wheels||[]).forEach(w=>w.rotation.x+=c.speed*dt*2);
      }else{
        const stunned=player.stun>0;player.stun=Math.max(0,player.stun-dt);
        const input=stunned?0:Math.hypot(side,f),speed=keys.has('ShiftLeft')||keys.has('ShiftRight')||touch.secondary||g.down.handbrake?cfg.runSpeed:cfg.walkSpeed;
        const previousX=player.x,previousZ=player.z;let dx=0,dz=0;
        if(input){dx=(-Math.sin(orbitYaw)*f+Math.cos(orbitYaw)*side)/input;dz=(-Math.cos(orbitYaw)*f-Math.sin(orbitYaw)*side)/input;walkPlayer(player.x+dx*speed*dt,player.z+dz*speed*dt);if(player.aimTime<=0)player.heading=Math.atan2(dx,dz);}
        if(!input&&carAt(player.x,player.z,.42))walkPlayer(player.x,player.z);
        softCrowd();
        player.speed=dt>0?Math.hypot(player.x-previousX,player.z-previousZ)/dt:0;const groundY=world.getElevation(player.x,player.z);human.position.set(player.x,groundY,player.z);human.rotation.y=player.heading;
        animateHuman(human,elapsed*speed*1.7,input?.45:0);footstep-=dt;
        player.fireCooldown=Math.max(0,player.fireCooldown-dt);player.aimTime=Math.max(0,player.aimTime-dt);
        if(player.reload>0){player.reload-=dt;if(player.reload<=0){const n=Math.min(12-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;player.reload=0;}}
        if(player.aimTime>0)human.userData.arms[1].rotation.x=-Math.PI/2;
        human.rotation.x=stunned?-1.25:0;human.position.y=groundY+(stunned?.3:0);
        if(input&&footstep<=0){audio.beep(90,.04,'triangle',.035);footstep=.32;}
      }
      if(player.health<=0)die();
      else if(police.level===0)player.health=Math.min(100,player.health+dt*.8);
    }
    // ---- Action layer: pooled effects, weapons, damage and death ----
    const BLOOD=[.5,.02,.04],SPARK=[1,.8,.3],SMOKE=[.23,.23,.25],FIRE=[1,.22,0];
    function makeParticles(count,size){
      const pos=new Float32Array(count*3).fill(-50),col=new Float32Array(count*3),geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
      const mesh=new THREE.Points(geo,new THREE.PointsMaterial({size,vertexColors:true,transparent:true,opacity:.92,depthWrite:false}));mesh.frustumCulled=false;scene.add(mesh);
      const list=Array.from({length:count},()=>({life:0}));let next=0;
      return {
        emit(x,y,z,vx,vy,vz,life,color,grav){const q=list[next];next=(next+1)%count;q.x=x;q.y=y;q.z=z;q.vx=vx;q.vy=vy;q.vz=vz;q.life=q.max=life;q.color=color;q.grav=grav;},
        update(dt){
          for(let i=0;i<count;i++){
            const q=list[i],j=i*3;if(q.life<=0)continue;
            q.life-=dt;q.vy-=q.grav*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;
            if(q.y<.2&&q.grav>0){q.y=.2;q.vx=q.vy=q.vz=0;}
            if(q.life<=0){pos[j+1]=-50;continue;}
            const fade=Math.min(1,q.life/q.max*1.6);pos[j]=q.x;pos[j+1]=q.y;pos[j+2]=q.z;col[j]=q.color[0]*fade;col[j+1]=q.color[1]*fade;col[j+2]=q.color[2]*fade;
          }
          geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;
        }
      };
    }
    const bits=makeParticles(280,.17),puffs=makeParticles(240,1.5);
    function sparks(x,z,n){for(let i=0;i<n;i++)bits.emit(x,1,z,(rnd()-.5)*7,1+rnd()*4,(rnd()-.5)*7,.4,SPARK,14);}
    function spray(x,z,n){for(let i=0;i<n;i++)bits.emit(x,1+rnd()*.5,z,(rnd()-.5)*5,1.5+rnd()*3,(rnd()-.5)*5,.9,BLOOD,12);}
    const bloodMat=new THREE.MeshStandardMaterial({color:0x7a0b14,roughness:.35,transparent:true,opacity:.9,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
    const bloodGeo=new THREE.CircleGeometry(1,12),bloodPool=Array.from({length:40},()=>{const m=new THREE.Mesh(bloodGeo,bloodMat);m.rotation.x=-Math.PI/2;m.visible=false;scene.add(m);return {m,size:0,now:0};});let bloodNext=0;
    function bleed(x,z,size){const b=bloodPool[bloodNext];bloodNext=(bloodNext+1)%bloodPool.length;b.m.position.set(x,.21,z);b.size=size;b.now=.15;b.m.scale.setScalar(.15);b.m.visible=true;spray(x,z,14);}
    const tracers=Array.from({length:10},()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xfff0b0,transparent:true,opacity:0}));l.frustumCulled=false;scene.add(l);return l;});let tracerNext=0;
    function tracer(ax,ay,az,bx,by,bz){const l=tracers[tracerNext];tracerNext=(tracerNext+1)%tracers.length;l.geometry.attributes.position.array.set([ax,ay,az,bx,by,bz]);l.geometry.attributes.position.needsUpdate=true;l.material.opacity=1;}
    const boomLight=new THREE.PointLight(0xffa040,0,70);scene.add(boomLight);
    const boomBall=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:0xffc368,transparent:true,opacity:0,depthWrite:false}));boomBall.visible=false;scene.add(boomBall);
    const burnt=new THREE.MeshStandardMaterial({color:0x151617,roughness:1}),wrecks=[];
    const gun=new THREE.Mesh(new THREE.BoxGeometry(.08,.15,.34),new THREE.MeshStandardMaterial({color:0x1b1d22,roughness:.5}));gun.position.set(0,-.58,.12);human.userData.arms[1].add(gun);
    const grenades=Array.from({length:3},()=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.17,8,6),new THREE.MeshStandardMaterial({color:0x2c3a2a}));m.visible=false;scene.add(m);return {m,t:0};});
    function hurt(amount,cause){if(mode!=='play'||amount<=0)return;player.health-=amount;player.cause=cause;hitFlash=.35;rumble(clamp(amount/18,.25,1),clamp(amount/28,.15,.8),clamp(amount*14,90,380));}
    // Gunfire and blasts scare people and drivers around the source.
    function alarm(at,radius){
      for(const p of peds){if(p.dead||p.frozen||dist(p,at)>radius)continue;p.panic=6+rnd()*5;p.fear={x:at.x,z:at.z};p.cower=rnd()<.2;p.chat=0;p.wait=0;}
      for(const c of cars)if(c.traffic&&dist(c,at)<radius)c.scared=9;
    }
    function killPed(p,byPlayer,label){
      p.dead=true;p.deadTime=38;p.down=0;p.panic=0;p.health=0;p.hitCooldown=8;p.mesh.scale.y=1;p.mesh.rotation.set(-Math.PI/2,0,rnd()*6.28);p.mesh.position.set(p.x,world.getElevation(p.x,p.z)+.24,p.z);animateHuman(p.mesh,0,0);
      bleed(p.x,p.z,1.1+rnd()*.6);dropCash(p.x,p.z);if(byPlayer)crime(label==='fatal_hit'?'fatal_hit':'homicide');
    }
    function burn(mesh){mesh.traverse(m=>{if(m.isMesh){m.userData.paint=m.material;m.material=burnt;}});mesh.rotation.z=.06;mesh.scale.y*=.86;}
    function explode(x,z,byPlayer,radius=10){
      const at={x,z};boomBall.position.set(x,1.5,z);boomBall.visible=true;boomLight.position.set(x,4,z);boomTime=.5;shake=Math.max(shake,clamp(1.3-dist(at,player)/55,0,1));
      for(let i=0;i<40;i++){const a=rnd()*6.28,v=3+rnd()*9;puffs.emit(x,1,z,Math.cos(a)*v,2+rnd()*8,Math.sin(a)*v,.5+rnd()*.6,FIRE,-2);}
      for(let i=0;i<28;i++){const a=rnd()*6.28,v=1+rnd()*4;puffs.emit(x,1.5,z,Math.cos(a)*v,3+rnd()*4,Math.sin(a)*v,1.8+rnd()*1.6,SMOKE,-1.5);}
      for(let i=0;i<34;i++){const a=rnd()*6.28,v=6+rnd()*12;bits.emit(x,1,z,Math.cos(a)*v,4+rnd()*9,Math.sin(a)*v,1.2,SPARK,18);}
      audio.beep(48,.9,'sawtooth',.6);audio.beep(31,1.3,'triangle',.6);
      for(const p of peds){if(p.dead)continue;const d=dist(p,at);if(d<radius*.7)killPed(p,byPlayer,'Explosão fatal');else if(d<radius*1.4){p.down=4;p.health-=40;}}
      for(const c of cars){const d=dist(c,at);if(d<radius&&!c.wreck){c.damage+=110*(1-d/radius)+15;if(byPlayer)c.byPlayer=true;}}
      for(const u of police.units){const d=dist(u,at);if(d<radius){u.damage+=110*(1-d/radius)+15;if(byPlayer)u.byPlayer=true;}}
      for(const u of police.units.slice())if(u.foot&&Math.hypot(u.fx-x,u.fz-z)<radius*.7)officerDown(u,'police_killed');
      const d=dist(player,at),reach=radius*1.2;if(d<reach&&player.invincible===0)hurt((player.car?55:125)*(1-d/reach),'explosão');
      alarm(at,75);if(byPlayer)crime('explosion');
    }
    function resolveAim(){
      camera.updateMatrixWorld();aimRaycaster.setFromCamera(aimNdc,camera);
      const ray=aimRaycaster.ray;let best=null,bestD=70;
      const look=(o,kind,size,y)=>{aimPoint3.set(o.x,y,o.z);const dx=aimPoint3.x-ray.origin.x,dy=aimPoint3.y-ray.origin.y,dz=aimPoint3.z-ray.origin.z,along=dx*ray.direction.x+dy*ray.direction.y+dz*ray.direction.z;if(along<1||along>=bestD||ray.distanceSqToPoint(aimPoint3)>size*size||!BN.hasLineOfSight(player,o,world.buildings))return;best={o,kind,y};bestD=along;};
      peds.forEach(p=>{if(!p.dead)look(p,'ped',.72,1.15);});cars.forEach(c=>look(c,'car',1.45,.85));police.units.forEach(u=>{look(u,'cop',1.45,.95);if(u.foot)look({x:u.fx,z:u.fz,unit:u},'officer',.72,1.15);});
      if(best)return {best,ex:best.o.x,ey:best.y,ez:best.o.z};
      const horizontal=Math.hypot(ray.direction.x,ray.direction.z)||1,fx=ray.direction.x/horizontal,fz=ray.direction.z/horizontal;let d=2;
      for(;d<70;d+=2){const x=player.x+fx*d,z=player.z+fz*d;if(world.buildings.some(b=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ))break;}
      return {best:null,ex:player.x+fx*d,ey:1.3,ez:player.z+fz*d};
    }
    function fire(){
      if(player.car||player.fireCooldown>0||player.stun>0||player.reload>0||mode!=='play')return;
      if(player.ammo<=0){reload();return;}
      player.ammo--;player.fireCooldown=.26;player.aimTime=.4;
      const {best,ex,ey,ez}=resolveAim();
      $('aim').classList.toggle('target',Boolean(best));
      player.heading=Math.atan2(ex-player.x,ez-player.z);human.rotation.y=player.heading;
      const mx=player.x+Math.sin(player.heading)*.7,mz=player.z+Math.cos(player.heading)*.7;
      tracer(mx,1.4,mz,ex,ey,ez);for(let i=0;i<4;i++)bits.emit(mx,1.4,mz,(rnd()-.5)*3,rnd()*2,(rnd()-.5)*3,.12,SPARK,0);
      audio.beep(170,.07,'square',.32);audio.beep(85,.14,'sawtooth',.3);
      alarm(player,45);
      const witnesses=peds.some(p=>!p.dead&&dist(p,player)<55)||police.units.some(u=>dist(u,player)<80);
      if(witnesses&&elapsed-lastShotCrime>8){lastShotCrime=elapsed;crime('gunfire');}
      if(!best){sparks(ex,ez,5);return;}
      const o=best.o;
      if(best.kind==='officer'){
        const u=o.unit;u.oh=(u.oh===undefined?100:u.oh)-55;spray(o.x,o.z,10);
        if(u.oh<=0)officerDown(u,'police_killed');else crime('police_shot',true);
      }else if(best.kind==='ped'){
        o.health-=55;spray(o.x,o.z,10);
        if(o.health<=0)killPed(o,true,'homicide');
        else{o.panic=10;o.cower=false;o.fear={x:player.x,z:player.z};if(elapsed-lastHitCrime>4){lastHitCrime=elapsed;crime('armed_assault');}}
      }else{
        o.damage+=best.kind==='cop'?9:13;o.byPlayer=true;sparks(o.x,o.z,8);
        if(best.kind==='cop'){if(elapsed-lastHitCrime>4){lastHitCrime=elapsed;crime('police_attack',true);}}else if(o.traffic)o.scared=10;
      }
    }
    function reload(){
      if(player.car||player.reload>0||player.ammo>=12)return;
      if(player.reserve<=0){toast('Sem munição. A oficina vende.');audio.beep(120,.06,'square',.1);return;}
      player.reload=1.3;audio.beep(420,.05,'triangle',.12);
    }
    function throwGrenade(){
      if(player.car||player.stun>0||mode!=='play')return;
      if(player.grenades<=0){toast('Sem granadas. A oficina vende.');return;}
      const g=grenades.find(g=>g.t<=0);if(!g)return;
      const fx=-Math.sin(orbitYaw),fz=-Math.cos(orbitYaw);player.grenades--;player.heading=Math.atan2(fx,fz);player.aimTime=.3;
      g.x=player.x+fx;g.y=1.5;g.z=player.z+fz;g.vx=fx*15;g.vy=6.5;g.vz=fz*15;g.t=2.2;g.m.visible=true;audio.beep(300,.08,'triangle',.1);
    }
    function policeFire(dt){
      if(police.level<2||!police.violent||!police.visible)return;
      for(const u of police.units){
        u.fire=(u.fire===undefined?1.5:u.fire)-dt;if(u.fire>0)continue;
        const e=u.foot?{x:u.fx,z:u.fz}:u;if((!u.foot&&police.level<4)||u.back)continue;
        if(dist(e,player)>42||!BN.hasLineOfSight(e,player,world.buildings))continue;
        u.fire=.9+rnd()*.8;const hit=rnd()<(player.car?.5:.38),miss=hit?0:4;
        tracer(e.x,1.3,e.z,player.x+(rnd()-.5)*miss,1.2,player.z+(rnd()-.5)*miss);audio.beep(150,.06,'square',.18);
        if(hit&&player.invincible===0){if(player.car){player.car.damage+=5;sparks(player.x,player.z,5);hurt(2,'tiros da polícia');}else{spray(player.x,player.z,5);hurt(9,'tiros da polícia');}}
      }
    }
    // Smoke above 40% damage, fire above 75%. A burning engine keeps getting worse.
    function carWear(c,dt){
      const d=c.damage;if(d<=0)return;
      c.mesh.scale.y=(c.baseY||1)*(1-Math.min(d,100)*.0012);
      if(d>75)c.damage+=dt*5;
      if(d>40&&dist(c,player)<140&&rnd()<dt*(d>75?16:5)){const hx=c.x+Math.sin(c.heading)*1.6,hz=c.z+Math.cos(c.heading)*1.6;puffs.emit(hx,1.1,hz,rnd()-.5,1.5+rnd()*1.5,rnd()-.5,1.2+rnd(),d>75&&rnd()<.6?FIRE:SMOKE,-1);}
    }
    function wreckCar(c){
      c.wreck=true;c.wreckTime=40;c.wasTraffic=c.traffic;c.traffic=false;c.speed=0;c.warned=false;burn(c.mesh);
      if(player.car===c){player.car=null;human.visible=true;}
      explode(c.x,c.z,c.byPlayer,9);
    }
    // The tow truck is off screen: a wreck returns repaired once the player is away.
    function towCar(c){
      if(dist(c,player)<70){c.wreckTime=4;return;}
      c.mesh.traverse(m=>{if(m.isMesh&&m.userData.paint)m.material=m.userData.paint;});c.mesh.rotation.z=0;c.mesh.scale.y=c.baseY||1;c.lat=0;
      c.wreck=false;c.damage=0;c.byPlayer=false;c.speed=0;
      if(c.wasTraffic&&c.path.length){c.traffic=true;let k=0;c.path.forEach((q,i)=>{if(dist(q,player)>dist(c.path[k],player))k=i;});c.x=c.path[k].x;c.z=c.path[k].z;c.waypoint=(k+1)%c.path.length;}
      else{c.x=c.home.x;c.z=c.home.z;c.heading=c.home.heading;}
      c.mesh.position.set(c.x,0,c.z);c.mesh.rotation.y=c.heading;
    }
    function updateFx(dt){
      bits.update(dt);puffs.update(dt);shake=Math.max(0,shake-dt*1.6);hitFlash=Math.max(0,hitFlash-dt);
      for(const l of tracers)if(l.material.opacity>0)l.material.opacity=Math.max(0,l.material.opacity-dt*7);
      for(const b of bloodPool)if(b.m.visible&&b.now<b.size){b.now=Math.min(b.size,b.now+dt*.5);b.m.scale.setScalar(b.now);}
      if(boomTime>0){boomTime=Math.max(0,boomTime-dt);const f=boomTime/.5;boomBall.scale.setScalar(1+(1-f)*9);boomBall.material.opacity=f*.8;boomBall.visible=f>0;boomLight.intensity=f*700;}
      for(const g of grenades){
        if(g.t<=0)continue;g.t-=dt;g.vy-=20*dt;const nx=g.x+g.vx*dt,nz=g.z+g.vz*dt;
        if(world.buildings.some(b=>nx>b.minX&&nx<b.maxX&&nz>b.minZ&&nz<b.maxZ)){g.vx*=-.4;g.vz*=-.4;}else{g.x=nx;g.z=nz;}
        g.y+=g.vy*dt;if(g.y<.2){g.y=.2;g.vy*=-.35;g.vx*=.55;g.vz*=.55;}
        g.m.position.set(g.x,g.y,g.z);if(g.t<=0){g.m.visible=false;explode(g.x,g.z,true);}
      }
      for(let i=wrecks.length-1;i>=0;i--){wrecks[i].t-=dt;if(wrecks[i].t<=0){scene.remove(wrecks[i].mesh);wrecks.splice(i,1);}}
    }
    function die(){
      if(mode!=='play')return;const c=player.car;if(c){c.speed=0;player.car=null;}
      police.reset();human.visible=true;animateHuman(human,0,0);human.position.set(player.x,world.getElevation(player.x,player.z)+.24,player.z);human.rotation.set(-Math.PI/2,0,player.heading);
      bleed(player.x,player.z,1.7);player.health=0;endScene('dead','SE FUDEU','Causa: '+(player.cause||'puro azar'));
      audio.beep(110,1.6,'sawtooth',.25);audio.beep(55,2.4,'triangle',.3);
    }
    function respawn(){
      const busted=ending==='busted';player.health=100;player.invincible=4;player.stun=0;if(busted){player.grenades=0;player.reserve=0;}player.ammo=Math.max(player.ammo,busted?12:6);player.reload=0;player.speed=0;balance=Math.max(0,balance-(busted?100:150));
      player.x=world.spawn.x;player.z=world.spawn.z;orbitYaw=Math.PI;human.rotation.set(0,0,0);human.position.set(player.x,world.getElevation(player.x,player.z),player.z);
      canvas.style.filter='';setMode('play');toast(busted?'Solto sob fiança · R$ 100. Granadas e munição reserva ficaram na delegacia.':'Alta do pronto-socorro · R$ 150 de conta hospitalar.');updateMission();save();
    }
    function updateTraffic(dt,interactive){
      for(const c of cars){
        c.hitCooldown=Math.max(0,c.hitCooldown-dt);
        if(c.wreck){c.wreckTime-=dt;if(c.wreckTime<=0)towCar(c);}
        else{carWear(c,dt);if(c.damage>=100)wreckCar(c);}
        if(c.traffic&&c!==player.car){
          const goal=c.path[c.waypoint],dx=goal.x-c.x,dz=goal.z-c.z,length=Math.hypot(dx,dz),hx=dx/(length||1),hz=dz/(length||1);
          // The closest crossing cycles between a north/south and east/west green.
          const r=world.roads,rx=r.reduce((a,b)=>Math.abs(b-c.x)<Math.abs(a-c.x)?b:a),rz=r.reduce((a,b)=>Math.abs(b-c.z)<Math.abs(a-c.z)?b:a);
          const phase=Math.floor(elapsed/8)%2,vertical=Math.abs(dz)>Math.abs(dx),toCross=Math.hypot(c.x-rx,c.z-rz);
          c.scared=Math.max(0,c.scared-dt);
          const red=c.scared===0&&phase===(vertical?0:1)&&toCross>6&&toCross<15;
          // Drivers brake for what is in their lane, with real stopping distance.
          const ahead=(o,reach)=>{const ox=o.x-c.x,oz=o.z-c.z,along=ox*hx+oz*hz;return along>1.5&&along<reach&&Math.abs(ox*hz-oz*hx)<2.1;};
          let blocked=interactive&&c.scared===0&&ahead(player,9);
          if(!blocked&&c.stuck<5)for(const o of cars){if(o!==c&&ahead(o,8)&&Math.abs(o.speed)<c.speed+1){blocked=true;c.stuck+=dt;break;}}
          if(!blocked)c.stuck=c.stuck>=5?(c.stuck>7?0:c.stuck+dt):0;
          const target=blocked||red?0:(c.scared>0?15:9.5)*(1-Math.min(c.damage,100)*.004);
          c.speed+=clamp(target-c.speed,-13*dt,5*dt);
          const step=Math.min(Math.max(0,c.speed)*dt,length);
          if(length>.1){c.x+=hx*step;c.z+=hz*step;c.heading=Math.atan2(dx,dz);}
          if(length<2&&c.nav){streets.advance(c.nav,rand);c.path=[c.nav.waypoint];c.waypoint=0;}
          c.mesh.position.set(c.x,0,c.z);c.mesh.rotation.y=c.heading;
          (c.mesh.userData.wheels||[]).forEach(w=>w.rotation.x+=c.speed*dt*2);
        }
        c.mesh.visible=mode==='intro'||mode==='menu'||dist(c,player)<carCull||c===player.car;
        if(interactive&&c!==player.car&&dist(c,player)<(player.car?2.8:2.1)&&c.hitCooldown===0){
          if(player.car){
            const v=Math.abs(player.car.speed);
            if(v>5){if(!c.wreck)crime('dangerous_collision');hurt(6,'batida de carro');cargoHit(v);if(!c.wreck){c.damage+=8+v*.5;c.byPlayer=true;}player.car.damage+=(6+v*.4)/VEHICLES[player.car.type].tough;player.car.lat=0;sparks(c.x,c.z,12);player.car.speed*=-.3;c.hitCooldown=2;audio.impact();}
            else if(c.speed>4){player.car.speed=0;c.speed=0;c.hitCooldown=2;}
          }else if(c.speed>3&&player.invincible===0){
            // The player can be run over: damage grows with the speed of the car.
            hurt(c.speed*4.2,'atropelamento');player.invincible=1.2;player.stun=1;c.hitCooldown=1.5;
            attemptMove(player,player.x+Math.sin(c.heading)*2.5,player.z+Math.cos(c.heading)*2.5,.45);c.speed*=.3;spray(player.x,player.z,8);audio.impact();toast('Atropelado. Olhe antes de atravessar.');
          }
        }
      }
    }
    function updatePeds(dt,interactive){
      chatTimer-=dt;const social=chatTimer<=0;if(social)chatTimer=.6;
      const lightPhase=Math.floor(elapsed/8)%2;
      for(const p of peds){
        p.hitCooldown=Math.max(0,p.hitCooldown-dt);p.panic=Math.max(0,p.panic-dt);p.chatCd-=dt;p.turnCd-=dt;
        const far=dist(p,player);
        p.mesh.visible=mode==='intro'||mode==='menu'||far<pedCull;
        if(p.dead){p.deadTime-=dt;if(p.deadTime<=0&&far>70){p.dead=false;p.health=100;p.mesh.rotation.set(0,0,0);placePed(p,true);}continue;}
        if(p.down>0){p.down-=dt;p.mesh.rotation.z=Math.PI/2;p.mesh.position.set(p.x,world.getElevation(p.x,p.z)+.4,p.z);if(p.down<=0){p.mesh.rotation.z=0;p.mesh.position.y=world.getElevation(p.x,p.z);p.panic=Math.max(p.panic,5);p.fear=null;p.cower=false;}}
        else{
          let dx=0,dz=0,speed=0,pose='';
          if(p.frozen){}
          else if(p.panic>0){
            if(p.cower)pose='cower';
            else{const f=p.fear||player,d=dist(p,f)||1;dx=(p.x-f.x)/d;dz=(p.z-f.z)/d;speed=4.6;}
          }
          else if(p.call){pose='call';p.mesh.rotation.y=Math.atan2(player.x-p.x,player.z-p.z);}
          else if(p.chat>0){p.chat-=dt;pose='chat';}
          else if(p.wait>0)p.wait-=dt;
          else if(p.kind==='park'){
            // Park regulars stroll between random spots and linger.
            const tx=p.tx-p.x,tz=p.tz-p.z,d=Math.hypot(tx,tz);
            if(d<.6){p.wait=2+rand()*8;p.tx=p.home.x+(rand()-.5)*30;p.tz=p.home.z+(rand()-.5)*30;}else{dx=tx/d;dz=tz/d;speed=p.speed;}
          }else{
            dx=p.vertical?0:p.dir;dz=p.vertical?p.dir:0;speed=p.speed;
            // Drift back to the sidewalk after a scare.
            const off=p.line-(p.vertical?p.x:p.z);if(Math.abs(off)>.15){if(p.vertical)dx=clamp(off,-1,1);else dz=clamp(off,-1,1);}
            const along=p.vertical?p.z:p.x,r=nearestRoad(along),rel=(along-r)*p.dir;
            // At the curb, wait for the cross traffic to get a red light.
            if(!p.jay&&rel<-7.2&&rel>-8.6&&lightPhase===(p.vertical?0:1))speed=0;
            // At a corner, sometimes take the crossing sidewalk.
            if(p.turnCd<=0&&Math.abs(Math.abs(along-r)-SW)<.25){
              p.turnCd=5;
              if(rand()<.4){const line=r+Math.sign(along-r)*SW;if(p.vertical)p.z=line;else p.x=line;p.vertical=!p.vertical;p.line=line;p.dir=rand()<.5?-1:1;dx=dz=0;}
            }
            if(p.kind==='walker'&&rand()<dt*.025)p.wait=1.5+rand()*4;
            // Step back from a fast car coming straight at them.
            const c=player.car;
            if(interactive&&c&&player.speed>8&&far<12&&(p.x-c.x)*Math.sin(c.heading)+(p.z-c.z)*Math.cos(c.heading)>0&&rand()<dt*4){p.panic=2.5;p.fear={x:c.x,z:c.z};p.cower=false;}
          }
          if(speed>0){
            const nx=p.x+dx*speed*dt,nz=p.z+dz*speed*dt,out=v=>Math.abs(v)>265;
            if(!world.isBlocked(nx,nz,.6)&&!out(nx)&&!out(nz)){p.x=nx;p.z=nz;}
            else if(p.panic>0){if(!world.isBlocked(nx,p.z,.6)&&!out(nx))p.x=nx;else if(!world.isBlocked(p.x,nz,.6)&&!out(nz))p.z=nz;}
            else if(p.kind==='park'){p.tx=p.home.x+(rand()-.5)*30;p.tz=p.home.z+(rand()-.5)*30;}
            else p.dir*=-1;
            p.mesh.rotation.y=Math.atan2(dx,dz);
          }
          p.mesh.position.set(p.x,world.getElevation(p.x,p.z),p.z);p.mesh.scale.y=pose==='cower'?.62:1;
          animateHuman(p.mesh,elapsed*speed*(speed>3?2.4:5)+p.phase,speed>0?(speed>3?.75:.35):0);
          const arms=p.mesh.userData.arms||[];
          if(pose==='chat'&&arms[0])arms[0].rotation.x=-.9+Math.sin(elapsed*5+p.phase)*.35;
          if(pose==='cower')arms.forEach(a=>a.rotation.x=-2.7);
          if(p.call&&arms[0])arms[0].rotation.x=-2.5;
          if(social&&!p.frozen&&p.panic<=0){
            // Neighbors stop for a short chat. A body on the ground sends witnesses running.
            for(const o of peds){
              if(o===p)continue;const d=dist(o,p);
              if(o.dead){if(d<10&&o.deadTime>30){p.panic=5;p.fear={x:o.x,z:o.z};p.cower=false;break;}}
              else if(d<1.9&&p.chatCd<=0&&o.chatCd<=0&&p.kind==='walker'&&o.kind==='walker'&&o.panic<=0&&o.down<=0&&!o.frozen){
                p.chat=o.chat=4+rand()*6;p.chatCd=o.chatCd=35+rand()*30;p.mesh.rotation.y=Math.atan2(o.x-p.x,o.z-p.z);o.mesh.rotation.y=Math.atan2(p.x-o.x,p.z-o.z);break;
              }
            }
          }
        }
        if(interactive&&player.car&&player.speed>4&&far<2.5&&p.hitCooldown===0&&p.down<=0){
          player.car.damage+=3;player.car.speed*=.6;cargoHit(7);audio.impact();spray(p.x,p.z,8);
          if(player.speed>13)killPed(p,true,'fatal_hit');
          else{p.down=5;p.hitCooldown=8;p.health-=35;if(p.health<=0)killPed(p,true,'fatal_hit');else crime('hit_and_run');}
        }
      }
    }
    function updateCamera(dt){
      if(captureScene){
        const shots={
          'city-aerial':{position:[255,155,215],look:[-45,28,-55]},
          'city-street':{position:[7,7,52],look:[0,18,-95]},
          'city-night':{position:[175,92,135],look:[-45,28,-55]},
          'city-life':{position:[-157,38,180],look:[-158,2,128]},
          'city-hill':{position:[-235,22,325],look:[-275,3,275]},
          'city-tunnel':{position:[82,3.2,240],look:[40,2.6,240]},
          'city-garage':{position:[-82,5.2,40],look:[-52,3.2,40]},
          'island-aerial':{position:[345,265,355],look:[0,4,0]},
          'island-horizon':{position:[0,8,-248],look:[0,16,-700]},
          'city-cyclist':{position:[-148,3.2,-217],look:[-157,1.1,-228]},
          'model-character':{position:[15.8,2.9,19.6],look:[12,1.05,14]},
          'model-car':{position:[10.5,2.8,20.5],look:[5.7,.78,14]},
          day:{position:[310,26,85],look:[253,3,145]},
          night:{position:[330,24,-95],look:[286,4,-160]}
        },shot=shots[captureScene]||shots.day;
        camera.position.set(...shot.position);lookGoal.set(...shot.look);camera.lookAt(lookGoal);return;
      }
      if(mode==='intro'){
        const t=clamp(introTime/cfg.introDuration,0,1);
        if(t<.34){const q=t/.34;cameraGoal.set(365-q*75,100-q*28,210-q*90);lookGoal.set(70,15,10);}
        else if(t<.68){const q=(t-.34)/.34;cameraGoal.set(230-q*65,40-q*13,-215+q*105);lookGoal.set(0,15,-60);}
        else{const q=(t-.68)/.32;cameraGoal.set(-50+q*66,20-q*11,30-q*49);lookGoal.set(12,2,12);}
        camera.position.lerp(cameraGoal,1-Math.exp(-dt*2));camera.lookAt(lookGoal);
      }else if(mode==='menu'||mode==='help'&&helpReturn==='menu'){
        const t=elapsed*.035;cameraGoal.set(365+Math.sin(t)*30,145,150+Math.cos(t)*45);lookGoal.set(0,20,0);camera.position.lerp(cameraGoal,1-Math.exp(-dt*.8));camera.lookAt(lookGoal);
      }else if(mode==='dead'){
        // Slow orbit that rises around the body.
        const groundY=world.getElevation(player.x,player.z),a=orbitYaw+deathTime*.3,rad=4.5+deathTime*.55;cameraGoal.set(player.x+Math.sin(a)*rad,groundY+1.4+deathTime*.5,player.z+Math.cos(a)*rad);lookGoal.set(player.x,groundY+.4,player.z);camera.position.lerp(cameraGoal,.07);camera.position.y=Math.max(camera.position.y,world.getElevation(camera.position.x,camera.position.z)+.65);camera.lookAt(lookGoal);
      }else{
        const shoulder=aiming&&!player.car,radius=player.car?10.8+player.speed*.12:shoulder?5.4:7.2,height=player.car?4.8:shoulder?3.15:3.7;
        cameraOffset.set(Math.sin(orbitYaw)*radius,Math.max(2,height+(orbitPitch-.48)*8),Math.cos(orbitYaw)*radius);
        if(shoulder){cameraOffset.x+=Math.cos(orbitYaw)*.82;cameraOffset.z-=Math.sin(orbitYaw)*.82;}
        const groundY=world.getElevation(player.x,player.z);lookGoal.set(player.x,groundY+(player.car?1.2:shoulder?1.48:1.25),player.z);
        // Look a little ahead of the travel direction and open the view with speed.
        if(player.car){const c=player.car,k=Math.min(7,player.speed*.22),hs=Math.sin(c.heading),hc=Math.cos(c.heading),vx=hs*c.speed+hc*c.lat,vz=hc*c.speed-hs*c.lat,m=Math.hypot(vx,vz)||1;lookAhead.x+=(vx/m*k-lookAhead.x)*Math.min(1,dt*3);lookAhead.z+=(vz/m*k-lookAhead.z)*Math.min(1,dt*3);}else{lookAhead.x*=Math.exp(-dt*4);lookAhead.z*=Math.exp(-dt*4);}
        lookGoal.x+=lookAhead.x;lookGoal.z+=lookAhead.z;
        const fov=55+(player.car?Math.min(13,player.speed*.4):0);if(Math.abs(camera.fov-fov)>.05){camera.fov+=(fov-camera.fov)*Math.min(1,dt*2.5);camera.updateProjectionMatrix();}
        let fraction=1;
        for(let i=1;i<=12;i++){const f=i/12,px=player.x+cameraOffset.x*f,pz=player.z+cameraOffset.z*f,py=lookGoal.y+cameraOffset.y*f;if(world.buildings.some(b=>px>b.minX-.5&&px<b.maxX+.5&&pz>b.minZ-.5&&pz<b.maxZ+.5&&py<b.height+.5)){fraction=Math.max(.15,(i-1)/12);break;}}
        cameraGoal.copy(lookGoal).addScaledVector(cameraOffset,fraction);cameraGoal.y=Math.max(cameraGoal.y,world.getElevation(cameraGoal.x,cameraGoal.z)+.65);camera.position.lerp(cameraGoal,1-Math.exp(-dt*8));camera.position.y=Math.max(camera.position.y,world.getElevation(camera.position.x,camera.position.z)+.65);camera.lookAt(lookGoal);
        if(shake>0&&cameraMotion){camera.position.x+=(rnd()-.5)*shake;camera.position.y+=(rnd()-.5)*shake*.6;}
      }
    }
    const map=$('minimap'),largeMap=$('largeMap');
    function paintMap(canvas,large){
      const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,sx=w/640,sz=h/640,px=x=>(x+320)*sx,pz=z=>(z+320)*sz,coast=world.island.coastline;
      const coastPath=scale=>{ctx.beginPath();coast.forEach((point,i)=>{const x=px(point.x*scale),z=pz(point.z*scale);i?ctx.lineTo(x,z):ctx.moveTo(x,z);});ctx.closePath();};
      ctx.fillStyle='#173a45';ctx.fillRect(0,0,w,h);coastPath(1.035);ctx.fillStyle='#d8c58f';ctx.fill();coastPath(.965);ctx.fillStyle='#2e4948';ctx.fill();ctx.save();coastPath(.965);ctx.clip();
      ctx.fillStyle='#173a45';for(let z=-300;z<300;z+=8)if(world.island.containsPoint(119,z))ctx.fillRect(px(106),pz(z),26*sx,8*sz);
      ctx.strokeStyle='#7a8780';ctx.lineWidth=large?5:2.7;world.roads.forEach(r=>{ctx.beginPath();ctx.moveTo(px(-295),pz(r));ctx.lineTo(px(295),pz(r));ctx.moveTo(px(r),pz(-295));ctx.lineTo(px(r),pz(295));ctx.stroke();});
      ctx.fillStyle='#3f7a5a';world.parks.forEach(p=>ctx.fillRect(px(p.x-26),pz(p.z-27),52*sx,54*sz));
      ctx.fillStyle='#405957';world.buildings.forEach(b=>ctx.fillRect(px(b.minX),pz(b.minZ),(b.maxX-b.minX)*sx,(b.maxZ-b.minZ)*sz));
      ctx.strokeStyle='#e7b53c';ctx.lineWidth=large?3:1.4;world.alleys.forEach(a=>{ctx.beginPath();ctx.moveTo(px(a.x),pz(a.z-a.half));ctx.lineTo(px(a.x),pz(a.z+a.half));ctx.stroke();});
      // Arrows on one-way streets, then the mission GPS under the player-chosen route.
      ctx.fillStyle='#c9d6cf';world.roads.forEach((r,i)=>{[['x',streets.dirX(i)],['z',streets.dirZ(i)]].forEach(([axis,d])=>{if(!d)return;for(let j=0;j<world.roads.length-1;j++){const mid=(world.roads[j]+world.roads[j+1])/2,x=axis==='x'?r:mid,z=axis==='x'?mid:r,k=large?7:3.2,ax=axis==='x'?0:d,az=axis==='x'?d:0;ctx.beginPath();ctx.moveTo(px(x)+ax*k,pz(z)+az*k);ctx.lineTo(px(x)-ax*k-az*k*.8,pz(z)-az*k-ax*k*.8);ctx.lineTo(px(x)-ax*k+az*k*.8,pz(z)-az*k+ax*k*.8);ctx.closePath();ctx.fill();}});});
      if(missionRoute.length>1&&!routePoints.length){ctx.strokeStyle='#8de3cf99';ctx.lineWidth=large?5:2.4;ctx.lineJoin='round';ctx.setLineDash&&ctx.setLineDash([large?10:5,large?7:4]);ctx.beginPath();missionRoute.forEach((p,i)=>i?ctx.lineTo(px(p.x),pz(p.z)):ctx.moveTo(px(p.x),pz(p.z)));ctx.stroke();ctx.setLineDash&&ctx.setLineDash([]);}
      if(routePoints.length>1){ctx.strokeStyle='#8de3cf';ctx.lineWidth=large?7:3;ctx.lineJoin='round';ctx.beginPath();routePoints.forEach((p,i)=>i?ctx.lineTo(px(p.x),pz(p.z)):ctx.moveTo(px(p.x),pz(p.z)));ctx.stroke();}
      if(police.level>0){ctx.fillStyle='#e1876c22';ctx.beginPath();ctx.arc(px(police.lastSeen.x),pz(police.lastSeen.z),40*Math.min(sx,sz),0,Math.PI*2);ctx.fill();}
      if(police.state==='search')police.units.forEach(p=>{if(!p.respond)return;const x=p.foot?p.fx:p.x,z=p.foot?p.fz:p.z,a=Math.PI/2-(p.foot?p.fh:p.heading);ctx.fillStyle='#6fb6ff55';ctx.beginPath();ctx.moveTo(px(x),pz(z));ctx.arc(px(x),pz(z),45*Math.min(sx,sz),a-1.05,a+1.05);ctx.closePath();ctx.fill();});
      police.units.forEach(p=>{ctx.fillStyle=p.respond?'#ff8a6d':'#7da2b4';ctx.fillRect(px(p.x)-2,pz(p.z)-2,4,4);});
      const markers=Object.values(cfg.landmarks);markers.forEach(point=>{ctx.fillStyle=point.id==='garage'?'#ffa24a':'#ff805b';ctx.beginPath();ctx.arc(px(point.x),pz(point.z),large?6:2.5,0,Math.PI*2);ctx.fill();if(large&&['radio','market','garage','pier'].includes(point.id)){ctx.fillStyle='#fff1cf';ctx.font='bold 12px sans-serif';ctx.fillText(point.name,px(point.x)+9,pz(point.z)-7);}});
      ctx.fillStyle='#ffd23f';callers.forEach(person=>{ctx.beginPath();ctx.arc(px(person.x),pz(person.z),large?5:2.5,0,Math.PI*2);ctx.fill();});
      const m=target();ctx.strokeStyle='#8de3cf';ctx.lineWidth=large?5:2;if(m){ctx.beginPath();ctx.arc(px(m.x),pz(m.z),large?11:5,0,Math.PI*2);ctx.stroke();}
      ctx.save();ctx.translate(px(player.x),pz(player.z));ctx.rotate(-player.heading);ctx.fillStyle='#fff1cf';ctx.beginPath();ctx.moveTo(0,large?10:5);ctx.lineTo(large?-7:-3.5,large?-7:-3.5);ctx.lineTo(large?7:3.5,large?-7:-3.5);ctx.closePath();ctx.fill();ctx.restore();
      if(large){ctx.fillStyle='#fff1cf';ctx.font='bold 15px sans-serif';ctx.fillText('CENTRO SOLAR',px(-190),pz(-245));ctx.fillText('CANAL DAS GARÇAS',px(92),pz(270));ctx.fillText('PRAIA AURORA',px(205),pz(-250));}ctx.restore();
    }
    // GPS for the current mission follows the one-way graph. It refreshes only when the target moves or every two seconds.
    function updateMissionRoute(){
      const m=target();if(!m||mode!=='play'){missionRoute=[];missionRouteKey='';return;}
      const key=Math.round(m.x)+':'+Math.round(m.z);
      if(key===missionRouteKey&&elapsed-missionRouteStamp<2)return;
      missionRouteKey=key;missionRouteStamp=elapsed;missionRoute=BN.Navigation.route(player,m,world.roads,streets);
    }
    function drawMap(){paintMap(map,false);}
    function drawLargeMap(){paintMap(largeMap,true);}
    function openMap(){if(!['play','pause'].includes(mode))return;mapReturn=mode==='pause'?'pause':'play';setMode('map');drawLargeMap();}
    function chooseRoute(x,z){const safe=world.island.clampPoint(clamp(x,-295,295),clamp(z,-295,295),4);routeDestination=safe;routePoints=BN.Navigation.route(player,routeDestination,world.roads,streets);toast('Destino marcado · rota pelas ruas e pontes');drawLargeMap();}
    function updateHud(){
      $('district').textContent=world.getDistrict?world.getDistrict(player.x,player.z):'Baía Neon';
      $('clock').textContent=String(Math.floor(hour)).padStart(2,'0')+'h'+String(Math.floor(hour%1*60)).padStart(2,'0')+' · '+(rain>.35?'Chuva tropical':night>.5?'Noite na baía':'Céu aberto');
      const blink=police.state==='search'&&Math.floor(elapsed*3)%2===0;$('heatPips').innerHTML=Array.from({length:5},(_,i)=>'<i class="'+(i<police.level&&!blink?'on':'')+'"></i>').join('');
      $('policeState').textContent=police.capture>0?'PARE E SERÁ DETIDO':police.level===0&&callers.length?'TESTEMUNHA AO TELEFONE':({patrol:'CIDADE TRANQUILA',dispatch:'VIATURAS A CAMINHO',chase:police.visible&&player.car?'SEU CARRO FOI IDENTIFICADO':'EM PERSEGUIÇÃO',search:police.disguise?'PROCURAM O VEÍCULO ANTERIOR':'FORA DE VISTA · SAIA DA REGIÃO'}[police.state]);
      $('escapeProgress').style.width=(police.search/police.searchTime()*100)+'%';
      $('vehicleName').textContent=player.car?VEHICLES[player.car.type].name:'A PÉ';$('speed').innerHTML=Math.round(player.speed*3.6)+' <small>KM/H</small>';
      $('arsenal').textContent=player.car?'DANO DO CARRO · '+Math.round(Math.min(100,player.car.damage))+'%':(player.reload>0?'RECARREGANDO':'PISTOLA '+player.ammo+'/'+player.reserve)+' · GRANADAS '+player.grenades;$('aim').style.opacity=player.car?0:(aiming||player.aimTime>0?1:.28);
      $('touchPrimary').textContent=player.car?'ACELERAR':'ATIRAR';$('touchSecondary').textContent=player.car?'FREAR':'CORRER';$('touchThird').textContent=player.car?'FREIO\nDE MÃO':'MIRA';$('touchContext').textContent=nearGarage()?'OFICINA':player.car?'SAIR DO CARRO':cars.some(c=>!c.wreck&&dist(c,player)<6)?'ENTRAR NO CARRO':'INTERAGIR';
      $('healthValue').textContent=Math.max(0,Math.ceil(player.health));$('healthFill').style.width=clamp(player.health,0,100)+'%';
      const m=target(),distance=m?dist(player,m):Infinity;
      if(job)$('missionDistance').textContent=job.stage==='pickup'?'Retirada a '+Math.round(distance)+' m':'Destino a '+Math.round(distance)+' m · '+({perishable:'qualidade',fragile:'integridade',smooth:'conforto'}[job.def.kind])+' '+Math.round(job.cargo)+'%'+(job.def.kind==='perishable'?' · '+Math.max(0,Math.ceil(job.limit*(job.cargo/100)*(upgrades.cargo?1.25:1)))+' s':'');
      else if(activeRace)$('missionDistance').textContent='Checkpoint a '+Math.round(distance)+' m · recorde salvo por veículo';
      else if(campaign.objective())$('missionDistance').textContent=(campaign.objective().failed?'Y para repetir':'Próxima ação a '+Math.round(distance)+' m')+' · reputação '+reputation;
      else $('missionDistance').textContent='Oficina a '+Math.round(dist(player,cfg.garage))+' m · L inicia um contrarrelógio';
      let interaction='';if(player.car&&Math.abs(player.car.speed)<4)interaction='E para sair do carro';else if(!player.car&&cars.some(c=>!c.wreck&&dist(c,player)<6&&Math.abs(c.speed)<5))interaction='E para entrar no carro';
      if(distance<10&&job)interaction=!player.car?'Este serviço exige um carro':job.stage==='pickup'?'Pare dentro do círculo para embarcar ou carregar':player.car!==job.car?'O serviço está no outro carro':police.level>0?'Despiste a polícia antes da conclusão':'Pare dentro do círculo para concluir';
      else if(distance<10&&activeRace)interaction='Atravesse o checkpoint na ordem indicada';
      else if(distance<10&&campaign.objective())interaction=campaign.objective().failed?'Y para repetir do checkpoint':!player.car&&campaign.step()&&campaign.step().requiresCar?'Entre num carro para continuar':'Pare no marcador coral';
      if(!player.car&&(cityLife.cyclists.some(c=>c.down<=0&&c.group.visible&&dist(c,player)<3.2)||cityLife.actors.some(a=>a.mesh.visible&&a.state==='idle'&&dist(a,player)<2.8)))interaction='E para conversar';
      if(adultRide)interaction=player.car&&player.speed<1?'Procure um estacionamento ou a praia':'Companhia a bordo';
      if(nearGarage())interaction='ENTER para abrir a oficina';
      show('interaction',Boolean(interaction));$('interaction').textContent=BN.Prompts.localize(interaction,inputMode.mode);updateMissionRoute();drawMap();
    }
    function download(name,blob){const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    function exportSave(){download('baia-neon-progresso-v'+cfg.version+'.json',new Blob([BN.Save.exportProgress(progressData(),build)],{type:'application/json'}));toast('Progresso exportado. Guarde o arquivo em local seguro.');}
    function importSaveFile(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const imported=BN.Save.importProgress(String(reader.result),catalogues);BN.Save.persist(localStorage,imported);toast('Progresso validado e importado. Recarregando…');setTimeout(()=>location.reload(),500);}catch(error){toast(error.message);}};reader.readAsText(file);}
    function openPhoto(){if(!['play','pause'].includes(mode))return;photoReturn=mode==='pause'?'pause':'play';photoClean=false;document.body.classList.remove('photo-clean');setMode('photo');}
    function closePhoto(){document.body.classList.remove('photo-clean');photoClean=false;setMode(photoReturn);if(photoReturn==='play'){centerAim();requestPointer();}}
    function capturePhoto(){const finish=blob=>{if(blob)download('baia-neon-'+Date.now()+'.png',blob);toast('Captura salva no computador.');};if(canvas.toBlob)canvas.toBlob(finish,'image/png');else finish(null);}
    $('skipIntro').onclick=endIntro;$('play').onclick=play;$('replayIntro').onclick=()=>{introTime=0;setMode('intro');};
    $('resume').onclick=()=>{setMode('play');centerAim();requestPointer();};$('backMenu').onclick=()=>{menuStats();setMode('menu');};$('menuHelp').onclick=help;$('pauseHelp').onclick=help;
    $('openMapPause').onclick=openMap;$('closeMap').onclick=()=>{setMode(mapReturn);if(mapReturn==='play'){centerAim();requestPointer();}};largeMap.onclick=e=>{const rect=largeMap.getBoundingClientRect();chooseRoute((e.clientX-rect.left)/rect.width*640-320,(e.clientY-rect.top)/rect.height*640-320);};
    $('photoFromPause').onclick=openPhoto;$('closePhoto').onclick=closePhoto;$('capturePhoto').onclick=capturePhoto;$('togglePhotoHud').onclick=()=>{photoClean=!photoClean;document.body.classList.toggle('photo-clean',photoClean);};
    $('toggleCameraMotion').textContent='MOVIMENTO DE CÂMERA: '+(cameraMotion?'LIGADO':'DESLIGADO');$('toggleCameraMotion').onclick=()=>{cameraMotion=!cameraMotion;$('toggleCameraMotion').textContent='MOVIMENTO DE CÂMERA: '+(cameraMotion?'LIGADO':'DESLIGADO');save();};
    $('exportSave').onclick=exportSave;$('menuExport').onclick=exportSave;$('importSave').onclick=()=>$('importSaveFile').click();$('menuImport').onclick=()=>$('importSaveFile').click();$('importSaveFile').onchange=e=>importSaveFile(e.target.files&&e.target.files[0]);
    $('closeGarage').onclick=()=>{setMode('play');centerAim();requestPointer();};$('garageList').onclick=e=>{const b=e.target&&e.target.closest?e.target.closest('button'):null;if(b)garageBuy(Number(b.getAttribute('data-i')));};
    $('closeHelp').onclick=()=>{setMode(helpReturn);if(helpReturn==='play'){centerAim();requestPointer();}};$('sound').onclick=()=>{$('sound').textContent=audio.toggle()?'SOM LIGADO':'SOM DESLIGADO';};
    window.addEventListener('keydown',e=>{
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
      inputMode.note('keyboard');
      if(e.repeat){if(mode==='play')keys.add(e.code);return;}
      if(e.code==='Escape'){if(mode==='intro')endIntro();else if(mode==='help'){setMode(helpReturn);if(helpReturn==='play'){centerAim();requestPointer();}}else if(mode==='garage'){setMode('play');centerAim();requestPointer();}else if(mode==='map'){setMode(mapReturn);if(mapReturn==='play'){centerAim();requestPointer();}}else if(mode==='photo')closePhoto();else togglePause();return;}
      if(mode==='photo'){if(e.code==='KeyP')closePhoto();if(e.code==='ArrowLeft')orbitYaw+=.12;if(e.code==='ArrowRight')orbitYaw-=.12;if(e.code==='ArrowUp')orbitPitch=clamp(orbitPitch-.08,.1,1.1);if(e.code==='ArrowDown')orbitPitch=clamp(orbitPitch+.08,.1,1.1);return;}
      if(mode!=='play')return;keys.add(e.code);
      if(e.code==='KeyE')contextAction();
      if(e.code==='KeyH')help();
      if(e.code==='KeyM')openMap();
      if(e.code==='KeyP')openPhoto();
      if(e.code==='KeyL')startRace();
      if(e.code==='KeyY')applyCampaignEvent(campaign.retry());
      if(e.code==='KeyX'&&campaign.definition()&&campaign.definition().id==='carro-radio'&&campaign.step()&&campaign.step().target==='regular-lot'&&dist(player,cfg.landmarks.regularLot)<10){const event=campaign.arrive('regular-lot',{hasCar:Boolean(player.car),balance,ignoreCost:true});crime('radio_car_theft');applyCampaignEvent(event);}
      if(e.code==='KeyR')reload();
      if(e.code==='Enter')openGarage();
      if(/^Digit[1-3]$/.test(e.code))acceptJob(Number(e.code.slice(5))-1);
      if(e.code==='KeyT'){rainTarget=rainTarget>.5?0:1;weatherTimer=90;toast(rainTarget?'Chuva a caminho · Aderência reduzida':'O céu começa a abrir');}
      if(e.code==='KeyN'){hour=night>.5?12:22;toast(hour===22?'A noite chegou à baía':'Manhã aberta na cidade');}
      if(e.code==='KeyF')primaryAction();
      if(e.code==='KeyG')throwGrenade();
    });
    $('toggleVibration').onclick=()=>{gamepad.configure({vibration:!gamepad.settings.vibration});savePadSettings();padLabels();rumble(.5,.5,150);};
    $('cycleDeadzone').onclick=()=>{const steps=[.1,.15,.2,.25,.3],next=steps.find(v=>v>gamepad.settings.stickDead+.001)||steps[0];gamepad.configure({stickDead:next,lookDead:next});savePadSettings();padLabels();};
    applyPrompts('keyboard');padLabels();applyQuality();
    window.addEventListener('keyup',e=>keys.delete(e.code));
    window.addEventListener('pointerdown',e=>inputMode.note(e&&e.pointerType==='touch'?'touch':'keyboard'),true);
    window.addEventListener('blur',()=>{if(BN.debug&&BN.debug.keepFocus)return;keys.clear();clearTouch();dragging=false;if(mode==='play')setMode('pause');});
    document.addEventListener('visibilitychange',()=>{if(BN.debug&&BN.debug.keepFocus)return;if(document.hidden&&mode==='play')setMode('pause');});
    document.addEventListener('pointerlockchange',()=>{if(pointerPauseSuppressed){pointerPauseSuppressed=false;return;}if(!touchDevice()&&mode==='play'&&document.pointerLockElement!==canvas)setMode('pause');});
    canvas.addEventListener('pointerdown',e=>{
      if(mode==='photo'){dragging=true;lastPointer={x:e.clientX,y:e.clientY};if(canvas.setPointerCapture)canvas.setPointerCapture(e.pointerId);return;}
      if(mode!=='play'||touchDevice())return;centerAim();
      if(document.pointerLockElement!==canvas){requestPointer();return;}
      if(e.button===2)aiming=true;else if(e.button===0)fire();
    });
    canvas.addEventListener('pointermove',e=>{
      if(mode==='play'&&document.pointerLockElement===canvas){orbitYaw-=e.movementX*mouseSensitivity;orbitPitch=clamp(orbitPitch+e.movementY*mouseSensitivity*.72,.1,1.1);centerAim();return;}
      if(mode==='photo'&&dragging){orbitYaw-=(e.clientX-lastPointer.x)*.006;orbitPitch=clamp(orbitPitch+(e.clientY-lastPointer.y)*.003,.1,1.1);lastPointer={x:e.clientX,y:e.clientY};}
    });
    canvas.addEventListener('pointerup',e=>{if(mode==='photo')dragging=false;if(e.button===2)aiming=false;});canvas.addEventListener('contextmenu',e=>e.preventDefault());
    const bindTouchHold=(id,key,onPress)=>{const element=$(id),end=e=>{if(e&&e.preventDefault)e.preventDefault();touch[key]=false;element.classList.remove('pressed');};element.addEventListener('pointerdown',e=>{e.preventDefault();touch[key]=true;element.classList.add('pressed');if(element.setPointerCapture)element.setPointerCapture(e.pointerId);if(onPress)onPress();});element.addEventListener('pointerup',end);element.addEventListener('pointercancel',end);};
    bindTouchHold('touchPrimary','primary',()=>{if(!player.car)fire();});bindTouchHold('touchSecondary','secondary');bindTouchHold('touchThird','third');
    $('touchContext').addEventListener('pointerdown',e=>{e.preventDefault();$('touchContext').classList.add('pressed');contextAction();});$('touchContext').addEventListener('pointerup',()=>$('touchContext').classList.remove('pressed'));$('touchPause').addEventListener('pointerdown',e=>{e.preventDefault();togglePause();});
    const pad=$('touchPad'),stick=$('touchStick');function movePad(e){const rect=pad.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,limit=rect.width*.34,dx=e.clientX-cx,dy=e.clientY-cy,length=Math.hypot(dx,dy)||1,scale=Math.min(1,limit/length),px=dx*scale,py=dy*scale;touch.x=clamp(dx/limit,-1,1);touch.y=clamp(dy/limit,-1,1);stick.style.transform='translate(calc(-50% + '+px+'px),calc(-50% + '+py+'px))';}
    pad.addEventListener('pointerdown',e=>{e.preventDefault();touch.padId=e.pointerId;if(pad.setPointerCapture)pad.setPointerCapture(e.pointerId);movePad(e);});pad.addEventListener('pointermove',e=>{if(e.pointerId===touch.padId)movePad(e);});const endPad=e=>{if(e.pointerId!==touch.padId)return;touch.padId=null;touch.x=touch.y=0;stick.style.transform='translate(-50%,-50%)';};pad.addEventListener('pointerup',endPad);pad.addEventListener('pointercancel',endPad);
    const lookZone=$('touchLook');lookZone.addEventListener('pointerdown',e=>{e.preventDefault();touch.lookId=e.pointerId;lastPointer={x:e.clientX,y:e.clientY};if(lookZone.setPointerCapture)lookZone.setPointerCapture(e.pointerId);});lookZone.addEventListener('pointermove',e=>{if(e.pointerId!==touch.lookId)return;orbitYaw-=(e.clientX-lastPointer.x)*.006;orbitPitch=clamp(orbitPitch+(e.clientY-lastPointer.y)*.004,.1,1.1);lastPointer={x:e.clientX,y:e.clientY};centerAim();});const endLook=e=>{if(e.pointerId===touch.lookId)touch.lookId=null;};lookZone.addEventListener('pointerup',endLook);lookZone.addEventListener('pointercancel',endLook);
    window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();centerAim();});
    centerAim();
    let previous=performance.now();camera.position.set(390,110,230);show('loading',false);setMode('intro');
    // Gamepad: sticks and triggers are read inside updatePlayer; buttons and the camera stick are handled here.
    function pollGamepad(dt){
      const g=gamepad.poll();if(!g.connected)return;
      if(g.active)inputMode.note('gamepad');
      const p=g.pressed;
      if(mode==='intro'){if(p.interact||p.pause)endIntro();}
      else if(mode==='menu'){if(p.interact||p.pause)play();}
      else if(mode==='play'){
        if(p.pause){togglePause();return;}
        const speed=gamepad.settings.lookSpeed;
        if(g.look.x||g.look.y){orbitYaw-=g.look.x*speed*dt;orbitPitch=clamp(orbitPitch+g.look.y*speed*.72*dt,.1,1.1);dragging=false;}
        if(p.interact)contextAction();
        if(p.map)openMap();
        if(p.retry)applyCampaignEvent(campaign.retry());
        if(p.fire||(p.rt&&!player.car))primaryAction();
        if(p.reload)reload();
        if(p.grenade)throwGrenade();
        if(p.left)acceptJob(0);if(p.up)acceptJob(1);if(p.right)acceptJob(2);
        if(p.down)startRace();
      }
      else if(mode==='pause'){if(p.pause||p.handbrake)togglePause();}
      else if(mode==='map'){if(p.handbrake||p.map||p.pause)$('closeMap').onclick();}
      else if(mode==='garage'){if(p.handbrake||p.pause)$('closeGarage').onclick();}
      else if(mode==='help'){if(p.handbrake||p.interact||p.pause)$('closeHelp').onclick();}
      else if(mode==='photo'){if(p.handbrake||p.pause)closePhoto();}
    }
    function applyQuality(){
      const t=qualityCtl.current,shadowsChanged=renderer.shadowMap.enabled!==t.shadows;
      quality=t.id;renderer.setPixelRatio(Math.min(devicePixelRatio||1,t.pixelRatio,cfg.pixelRatioCap));renderer.shadowMap.enabled=t.shadows;
      if(sun.shadow.mapSize.x!==t.shadowSize){sun.shadow.mapSize.set(t.shadowSize,t.shadowSize);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}
      if(shadowsChanged)scene.traverse(o=>{const m=o.material;if(m)(Array.isArray(m)?m:[m]).forEach(x=>{x.needsUpdate=true;});});
      camera.far=t.far;camera.updateProjectionMatrix();scene.fog.far=t.fogFar;carCull=t.carCull;pedCull=t.pedCull;world.setDetail(t);
    }
    function frame(now){
      const dt=clamp((now-previous)/1000,0,.05);previous=now;tick(dt);requestAnimationFrame(frame);
    }
    function tick(dt){
      pollGamepad(dt);
      // Death plays in slow motion before the hospital respawn.
      if(mode==='dead'){
        deathTime+=dt;dt*=.3;const g=smooth(0,1.3,deathTime),k=smooth(.9,1.7,deathTime);
        canvas.style.filter='grayscale('+(.9*g).toFixed(2)+') contrast('+(1+.2*g).toFixed(2)+') brightness('+(1-.25*g).toFixed(2)+')';
        $('wastedText').style.opacity=k;$('wastedText').style.transform='scale('+(1.7-.7*k).toFixed(3)+')';
        if(deathTime>(ending==='busted'?5:7))respawn();
      }
      if(!['pause','help','garage','map','photo'].includes(mode)){
        elapsed+=dt;weather(dt);updateFx(dt);$('vignette').classList.toggle('hit',hitFlash>0);
        if(mode==='intro'){introTime+=dt;$('introProgress').style.width=clamp(introTime/cfg.introDuration*100,0,100)+'%';
          const part=Math.floor(introTime/6);const captions=[['O SOL SE PÕE. A CIDADE ACORDA.','Todo mundo tem<br>um plano por aqui.'],['NEM TODO ATALHO TERMINA BEM.','Alguns planos<br>vêm com sirenes.'],['UMA CIDADE PEQUENA. UMA NOITE LONGA.','Bem-vindo<br>à Baía Neon.']];
          const caption=captions[Math.min(2,part)];$('introCaption').innerHTML='<span class="eyebrow">'+caption[0]+'</span><h2>'+caption[1]+'</h2>';
          if(introTime>=cfg.introDuration)endIntro();
        }
        if(mode==='play'){
          updatePlayer(dt);
          // Description of the suspect: swapping or leaving the car unseen leaves the police looking for the old one.
          if(police.level>0){if(police.visible)knownCar=player.car;else if(player.car!==knownCar&&!police.disguise){police.disguise=true;toast(knownCar?'Ninguém viu a troca. A polícia ainda procura o veículo anterior.':'Ninguém viu você entrar no carro. A polícia procura alguém a pé.');}}
          police.update(dt,player,player.speed);updateRoadblocks(dt);updateTraffic(dt,true);updatePeds(dt,true);cityLife.update(dt,{time:elapsed,focus:player,night,rain});
          const urbanHit=cityLife.checkVehicleHit(player.car,player.speed);if(urbanHit&&collisionCooldown===0){player.car.damage+=6;player.car.speed*=.55;collisionCooldown=1.5;audio.impact();crime('hit_and_run');toast(urbanHit.kind==='cyclist'?'Ciclista atropelado · uma testemunha pediu socorro':'Pessoa atingida perto do parque');}
          policeFire(dt);updateCalls(dt);updateOfficers();updateCash(dt);
          for(const p of police.units.slice()){
            p.mesh.visible=dist(p,player)<180;carWear(p,dt);
            if(p.damage>=100){if(p.officer)scene.remove(p.officer);burn(p.mesh);p.mesh.visible=true;wrecks.push({mesh:p.mesh,t:40});police.destroy(p);explode(p.x,p.z,p.byPlayer,9);if(p.byPlayer)crime('police_destroyed',true);continue;}
            if(player.car&&dist(p,player)<3.2&&Math.abs(player.car.speed)>6&&collisionCooldown===0){crime('police_collision',true);cargoHit(Math.abs(player.car.speed));p.damage+=14;p.byPlayer=true;player.car.damage+=10;sparks(p.x,p.z,12);player.car.speed*=-.25;hurt(7,'batida em viatura');collisionCooldown=2;audio.impact();}
            else if(!player.car&&p.speed>8&&dist(p,player)<2.3&&player.invincible===0){hurt(24,'atropelamento por viatura');player.invincible=1.2;player.stun=.8;spray(player.x,player.z,8);audio.impact();}
          }
          updateJob(dt);updateCampaign(dt);updateRace(dt);updateCompanionRide(dt);
          hudTimer-=dt;if(hudTimer<=0){updateHud();hudTimer=.1;}
        }else{updateTraffic(dt,false);updatePeds(dt,false);}
        garageMark.scale.setScalar(1+Math.sin(elapsed*2+1)*.03);diamond.rotation.y+=dt;diamond.position.y=4+Math.sin(elapsed*2)*.25;ring.scale.setScalar(1+Math.sin(elapsed*2)*.04);
      }
      updateCamera(dt);
      audio.update(dt,{driving:Boolean(player.car),speed:player.car?player.car.speed:0,siren:police.level>0&&police.units.some(p=>dist(p,player)<80),playing:mode==='play',rain:mode==='pause'?0:rain,cinematic:mode==='intro'||mode==='menu'});
      if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('show');}
      if(dialogueTime>0){dialogueTime-=dt;if(dialogueTime<=0)show('dialogue',false);}
      renderer.render(scene,camera);
      frameCount++;fpsAccum+=dt;if(fpsAccum>3){measuredFPS=frameCount/fpsAccum;frameCount=0;fpsAccum=0;const changed=qualityCtl.evaluate(measuredFPS);if(changed!==null)applyQuality();}
    }
    requestAnimationFrame(frame);
    // Development helpers are exposed only for local acceptance runs.
    if(new URLSearchParams(location.search).get('test')==='1')BN.debug={
      getState:()=>({mode,hour,night,rain,rainTarget,quality,fps:measuredFPS,player:{x:player.x,z:player.z,health:player.health,driving:!!player.car,speed:player.speed,grenades:player.grenades},police:{state:police.state,level:police.level,visible:police.visible,search:police.search,capture:police.capture,lastSeen:{...police.lastSeen}},missionIndex,balance,completed,reputation,crimes:crimeCount,campaign:{...campaign.state},race:activeRace?{id:activeRace.def.id,checkpoint:activeRace.checkpoint,time:activeRace.time}:null,job:job?{stage:job.stage,cargo:job.cargo,kind:job.def.kind}:null,counts:{cars:cars.length,pedestrians:peds.length,police:police.units.length,...world.counts,...cityLife.counts},render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}}),
      teleport:(x,z)=>{player.x=x;player.z=z;if(player.car){player.car.x=x;player.car.z=z;player.car.speed=0;}human.position.set(x,world.getElevation(x,z),z);},
      setHour:h=>hour=h,setRain:r=>{rain=rainTarget=r;weatherTimer=100;},crime:()=>crime('test',true),witnessCrime:()=>crime('test'),clearPolice:()=>{police.reset();peds.concat(cars).forEach(w=>w.call=null);},
      fire,resolveAim,setAimPointer,throwGrenade,explode,hurt,touch,getControls:()=>({aimPointer:{...aimPointer},orbitYaw,orbitPitch,aiming}),requestPointer,contextAction,tryCompanionRide,updateCompanionRide,getCompanionRide:()=>adultRide,setYaw:a=>orbitYaw=a,acceptJob,getJob:()=>job,getResult:()=>lastResult,openGarage,garageBuy,garageItems:()=>garageList,upgrades,VEHICLES,setCarType,setBalance:v=>{balance=v;},setReputation:v=>{reputation=v;},reload,campaign,updateCampaign,startRace,updateRace,getRoute:()=>routePoints,chooseRoute,save,progressData,
      putPedestrianAhead:()=>{const p=peds[0],c=player.car||player;p.frozen=true;p.dead=false;p.health=100;p.panic=0;p.mesh.rotation.set(0,0,0);p.x=c.x+Math.sin(c.heading)*9;p.z=c.z+Math.cos(c.heading)*9;p.speed=0;p.down=0;p.hitCooldown=0;p.mesh.position.set(p.x,world.getElevation(p.x,p.z),p.z);return {x:p.x,z:p.z};},
      gamepad,inputMode,qualityCtl,roadblocks,streets,applyQuality,pollGamepad,softCrowd,keepFocus:false,step:(seconds,dt=1/60)=>{for(let t=0;t<seconds;t+=dt)tick(dt);},press:(code,down=true)=>{if(down)keys.add(code);else keys.delete(code);},enterExit,getMode:()=>mode,skipIntro:endIntro,world,cityLife,police,player,human,cars,peds,renderer,scene,camera
    };
    const params=new URLSearchParams(location.search),captureScene=params.get('capture'),acceptanceScene=params.get('acceptance');
    if(params.get('touch')==='1'&&document.body)document.body.classList.add('touch-preview');
    if(params.get('hill')==='1'&&BN.debug){tutorialSeen=true;endIntro();play();const hill=world.hills[0];BN.debug.teleport(hill.x+hill.rx*.55,hill.z+6);BN.debug.setYaw(0);$('toast').classList.remove('show');toastTime=0;for(let i=0;i<180;i++)tick(1/60);}
    if(captureScene&&BN.debug){tutorialSeen=true;endIntro();play();if(params.get('vehicle')==='1'){BN.debug.teleport(starterCar.x,starterCar.z+3);enterExit();}$('toast').classList.remove('show');toastTime=0;const cityShot=captureScene.startsWith('city-'),islandShot=captureScene.startsWith('island-'),modelShot=captureScene.startsWith('model-'),nightShot=captureScene.includes('night');hour=nightShot?22:17.5;rain=rainTarget=(captureScene==='night'||captureScene==='island-horizon')?1:0;if(!modelShot)BN.debug.teleport(captureScene==='city-life'?-160:captureScene==='city-hill'?-275:captureScene==='city-cyclist'?-157:cityShot||islandShot?0:nightShot?280:240,captureScene==='city-life'?128:captureScene==='city-hill'?275:captureScene==='city-cyclist'?-225:cityShot||islandShot?0:nightShot?-110:80);if(cityShot||islandShot||modelShot)show('hud',false);if(captureScene==='city-cyclist')human.visible=false;for(let i=0;i<180;i++)tick(1/60);}
    if(acceptanceScene&&BN.debug){
      tutorialSeen=true;endIntro();play();BN.debug.teleport(starterCar.x,starterCar.z+3);enterExit();
      const go=id=>{const place=Object.values(cfg.landmarks).find(item=>item.id===id);BN.debug.teleport(place.x,place.z);if(player.car)player.car.speed=player.car.lat=0;missionCooldown=0;applyCampaignEvent(campaign.arrive(id,{hasCar:Boolean(player.car),balance}));missionCooldown=0;};
      go('presenter');go('radio');go('regular-lot');go('radio');go('archive-beach');go('archive-north');go('radio');go('technician');
      applyCampaignEvent(campaign.fail('ensaio de falha'));applyCampaignEvent(campaign.retry());go('antenna');go('radio');go('market');go('pier');
      startRace();for(const point of cfg.races[0].points){BN.debug.teleport(point[0],point[1]);updateRace(.2);}
      chooseRoute(-240,240);BN.debug.teleport(cfg.garage.x,cfg.garage.z);openGarage();const brakeIndex=garageList.findIndex(item=>item.label.includes('Freios'));if(brakeIndex>=0)garageBuy(brakeIndex);$('closeGarage').onclick();save();
      const restored=BN.Save.load(localStorage,catalogues).data,report={campaignStatus:campaign.state.status,missions:campaign.state.completed.length,rewards:campaign.state.rewarded.length,failedRetries:campaign.state.delays,balance,reputation,routeSegments:routePoints.length,raceRecords:Object.keys(raceRecords).length,brakes:upgrades.brakes,savedCampaign:restored.campaign.status,schemaVersion:restored.schemaVersion};
      const pre=document.createElement('pre');pre.id='acceptance-report';pre.textContent='ACEITE V03\n'+JSON.stringify(report,null,2);Object.assign(pre.style,{position:'fixed',inset:'40px',zIndex:'200',padding:'28px',margin:'0',background:'#101d26',color:'#8de3cf',font:'18px/1.5 monospace',whiteSpace:'pre-wrap'});document.body.appendChild(pre);document.title='ACCEPTANCE '+JSON.stringify(report);
    }
  }catch(error){fatal(error);}
})();
