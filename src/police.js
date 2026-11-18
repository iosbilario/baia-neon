/* SPDX-License-Identifier: MIT */
(function () {
  'use strict';
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  const dist = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
  const nearest = (list,x) => list.reduce((a,b) => Math.abs(b-x)<Math.abs(a-x)?b:a);
  function segmentBox(a,b,box) {
    let low=0, high=1;
    for(const axis of ['x','z']) {
      const delta=b[axis]-a[axis], lo=box[axis==='x'?'minX':'minZ'], hi=box[axis==='x'?'maxX':'maxZ'];
      if(Math.abs(delta)<0.00001) { if(a[axis]<lo||a[axis]>hi) return false; }
      else { let t0=(lo-a[axis])/delta,t1=(hi-a[axis])/delta; if(t0>t1) [t0,t1]=[t1,t0]; low=Math.max(low,t0); high=Math.min(high,t1); if(low>high) return false; }
    }
    return high>0.02 && low<0.98;
  }
  BN.hasLineOfSight = function(a,b,buildings) { return !buildings.some(box => segmentBox(a,b,box)); };
  BN.roadPoint = function(roads,x,z) {
    const rx=nearest(roads,x), rz=nearest(roads,z);
    return Math.abs(rx-x)<Math.abs(rz-z)?{x:rx,z:clamp(z,-260,260)}:{x:clamp(x,-260,260),z:rz};
  };
  BN.roadRoute = function(roads,from,to) {
    const a=BN.roadPoint(roads,from.x,from.z),b=BN.roadPoint(roads,to.x,to.z);
    // Pick the best end of each road segment. Always choosing the nearest
    // intersection would turn a pursuing car back at every route refresh.
    if((a.x===b.x&&roads.includes(a.x))||(a.z===b.z&&roads.includes(a.z))) {
      return dist(a,b)>0.1?[a,b]:[a];
    }
    const neighbors=value=>{
      const before=roads.filter(n=>n<=value).pop(),after=roads.find(n=>n>=value);
      return [...new Set([before,after].filter(n=>n!==undefined))];
    };
    const exits=p=>{
      const nodes=[];
      if(roads.includes(p.x)) neighbors(p.z).forEach(z=>nodes.push({x:p.x,z}));
      if(roads.includes(p.z)) neighbors(p.x).forEach(x=>nodes.push({x,z:p.z}));
      return nodes;
    };
    let start,end,best=Infinity;
    for(const s of exits(a)) for(const e of exits(b)) {
      const cost=dist(a,s)+Math.abs(s.x-e.x)+Math.abs(s.z-e.z)+dist(e,b);
      if(cost<best) {best=cost;start=s;end=e;}
    }
    const route=[a,start]; let x=start.x,z=start.z;
    // Every crossing connects to its four neighbors, including canal bridges.
    while(x!==end.x) { x=roads[roads.indexOf(x)+(end.x>x?1:-1)]; route.push({x,z}); }
    while(z!==end.z) { z=roads[roads.indexOf(z)+(end.z>z?1:-1)]; route.push({x,z}); }
    route.push(b);
    return route.filter((p,i,list) => i===0||dist(p,list[i-1])>0.1);
  };
  BN.Police = class {
    constructor(world,create,onCaught,onMessage) {
      this.world=world; this.create=create; this.onCaught=onCaught; this.onMessage=onMessage;
      this.units=[]; this.heat=0; this.level=0; this.state='patrol'; this.lastSeen={x:0,z:0};
      this.unseen=0; this.search=0; this.capture=0; this.time=0; this.recentCrime=-100; this.dispatch=0;
      this.add(-160,0); this.add(160,-160);
    }
    add(x,z) { const p={x,z,heading:0,speed:0,path:[],routeTimer:0,noDirect:0,damage:0,respond:false,vel:0,patrolStep:this.units.length*5,mesh:this.create()}; p.mesh.position.set(x,0,z); this.units.push(p); }
    spawn(target) {
      const n=this.units.length,nodes=[]; for(const x of this.world.roads) for(const z of this.world.roads) { const p={x,z}; if(dist(p,target)>110&&dist(p,target)<230&&!this.units.some(u=>dist(u,p)<12))nodes.push(p); }
      // Reinforcements appear behind buildings whenever such a crossing exists.
      const hidden=nodes.filter(p=>!BN.hasLineOfSight(p,target,this.world.buildings)); if(hidden.length)nodes.splice(0,nodes.length,...hidden);
      const p=nodes[(n*7+Math.floor(this.time))%nodes.length]||{x:-240,z:-240}; this.add(p.x,p.z);
    }
    // A destroyed unit leaves the roster. Replacements arrive later from far away.
    destroy(p) { const i=this.units.indexOf(p); if(i>=0)this.units.splice(i,1); this.refill=7; }
    report(kind,weight,target,violent) {
      const was=this.level; if(violent)this.violent=true;
      // Stars follow accumulated severity: one minor crime is one star, and each
      // further star needs clearly more violence than the previous one.
      this.heat=clamp(this.heat+weight,1,22); this.level=Math.max(this.level,[1,4,8,13,19].filter(t=>this.heat>=t).length);
      this.lastSeen={x:target.x,z:target.z}; this.state='dispatch'; this.dispatch=1.2; this.search=0; this.unseen=0; this.capture=0; this.recentCrime=this.time;
      this.onMessage(kind+' · Polícia acionada');
      // Backup is not instant: extra units are called in one at a time by update().
      // Only the first call sets the delay. Later reports must not push backup further away.
      if(was===0)this.refill=Math.max(this.refill||0,6);
      this.units.forEach(p=>p.routeTimer=0);
    }
    // Time out of sight needed to lose the police. More stars, longer search.
    searchTime() { return BN.CONFIG.policeSearchTime+(Math.max(1,this.level)-1)*5; }
    reset() { this.violent=false;this.disguise=false;this.lastDir=null;this.heat=0;this.level=0;this.state='patrol';this.unseen=0;this.search=0;this.capture=0;this.dispatch=0;this.visible=false;this.units.forEach(p=>{p.routeTimer=0;p.path=[];p.speed=0;}); }
    update(dt,target,playerSpeed) {
      this.time+=dt;
      this.refill=Math.max(0,(this.refill||0)-dt);
      if(this.refill===0&&this.units.length<Math.max(2,Math.min(BN.CONFIG.maxPolice,this.level))) { this.spawn(target); this.refill=8; }
      const active=this.level>0;
      // An officer on foot sees from where they stand, not from the parked cruiser.
      const eye=p=>p.foot?{x:p.fx,z:p.fz}:p;
      // In a chase officers see all around. While searching they only see a cone
      // ahead of them, plus anything right next to them.
      const observers=this.units.filter(p=>this.sees(p,target));
      this.visible=active&&observers.length>0;
      if(active) {
        if(this.visible) {
          // Remember where the suspect was heading, for interception, and drop any disguise.
          const mx=target.x-this.lastSeen.x,mz=target.z-this.lastSeen.z,m=Math.hypot(mx,mz);
          if(m>.05&&m<3)this.lastDir={x:mx/m,z:mz/m};
          this.lastSeen={x:target.x,z:target.z}; this.unseen=0; this.search=0; this.state='chase'; this.disguise=false;
        }
        else {
          this.unseen+=dt;
          if(this.state==='dispatch') { this.dispatch-=dt; if(this.dispatch<=0)this.state='chase'; }
          else if(this.state!=='search') {
            // Units first drive to the last seen position. The area search
            // starts on arrival, or after a grace period if the spot is unreachable.
            const lose=BN.CONFIG.policeLoseSight,spot=BN.roadPoint(this.world.roads,this.lastSeen.x,this.lastSeen.z);
            const arrived=this.units.some(p=>dist(p,this.lastSeen)<14||dist(p,spot)<5);
            if(this.unseen>lose&&(arrived||this.unseen>lose+6)) this.state='search';
          }
          if(this.state==='search') {
            // A search clock only advances outside the last observed area.
            // Police looking for the wrong vehicle give up sooner.
            if(dist(target,this.lastSeen)>40&&this.time-this.recentCrime>5) this.search+=dt*(this.disguise?1.8:1);
            else this.search=0;
            if(this.search>=this.searchTime()) { this.reset(); this.onMessage('Despistou a polícia · Volte às entregas'); }
          }
        }
        const nearestUnit=Math.min(...observers.map(p=>dist(eye(p),target)));
        // An officer who reaches the suspect makes the arrest quickly. Sprinting or driving off breaks it.
        const grab=Math.abs(playerSpeed)<8&&this.units.some(p=>p.foot&&!p.back&&dist(eye(p),target)<2.6&&BN.hasLineOfSight(eye(p),target,this.world.buildings));
        if(grab) this.capture+=dt*2.2;
        else if(nearestUnit<7&&Math.abs(playerSpeed)<3&&this.visible) this.capture+=dt;
        else this.capture=Math.max(0,this.capture-dt*1.7);
        if(this.capture>3.2) { this.reset();this.onCaught();return; }
      }
      // Only as many units as stars answer the call, nearest first. The rest keep patrolling
      // unless they happen to see the suspect themselves.
      const order=this.units.slice().sort((a,b)=>dist(a,this.lastSeen)-dist(b,this.lastSeen));
      for(const p of this.units) {
        const respond=active&&(order.indexOf(p)<this.level||observers.includes(p)||!!p.foot);
        if(respond!==p.respond) {p.respond=respond;p.routeTimer=0;p.path=[];}
        const lights=p.mesh.userData.lights||[]; lights.forEach((m,i)=>{if(m.material){m.material.emissiveIntensity=p.respond?(Math.sin(this.time*16+i*Math.PI)>0?4:0.1):0.05;}});
        if(p.foot) { this.walk(p,dt,target,playerSpeed,active); continue; }
        // Close to a slow suspect the officer stops the cruiser and gets out.
        if(p.respond&&this.visible&&dist(p,target)<16&&Math.abs(playerSpeed)<12&&BN.hasLineOfSight(p,target,this.world.buildings)) {
          const sx=Math.cos(p.heading)*1.7,sz=-Math.sin(p.heading)*1.7,free=(x,z)=>!this.world.isBlocked(x,z,.5);
          const door=[{x:p.x+sx,z:p.z+sz},{x:p.x-sx,z:p.z-sz}].find(q=>free(q.x,q.z))||{x:p.x,z:p.z};
          p.foot=true;p.back=false;p.backTime=0;p.fx=door.x;p.fz=door.z;p.fh=p.heading;p.fspeed=0;p.speed=0;continue;
        }
        p.routeTimer-=dt;p.noDirect=Math.max(0,p.noDirect-dt);
        if((p.respond&&p.routeTimer<=0)||!p.path.length) {
          let goal;
          if(p.respond) {
            goal=this.lastSeen;
            // From two stars the second unit tries to cut the suspect off at a crossing ahead,
            // using only the last observed position and direction.
            if(this.level>=2&&this.state==='chase'&&this.lastDir&&order.indexOf(p)===1&&dist(p,this.lastSeen)>50)
              goal={x:clamp(this.lastSeen.x+this.lastDir.x*90,-240,240),z:clamp(this.lastSeen.z+this.lastDir.z*90,-240,240)};
            if(this.state==='search') {
              const r=this.world.roads, x=nearest(r,this.lastSeen.x),z=nearest(r,this.lastSeen.z),k=(Math.floor(this.time/7)+p.patrolStep)%4;
              goal={x:clamp(x+[80,0,-80,0][k],-240,240),z:clamp(z+[0,80,0,-80][k],-240,240)};
            }
          } else { const r=this.world.roads;p.patrolStep++;goal={x:r[(p.patrolStep*3)%r.length],z:r[(p.patrolStep*5+1)%r.length]}; }
          p.path=this.world.streets&&this.world.streets.route?this.world.streets.route(p,goal):BN.roadRoute(this.world.roads,p,goal);p.routeTimer=p.respond?2.5:18;
          while(p.path.length&&dist(p,p.path[0])<3)p.path.shift();
        }
        let goal=p.path[0];
        // With a clear view a unit leaves the route and closes in, unless that failed a moment ago.
        const direct=p.respond&&this.visible&&p.noDirect===0&&dist(p,target)<45&&BN.hasLineOfSight(p,target,this.world.buildings);
        if(direct)goal=target;
        p.speed=0;
        if(goal) {
          const dx=goal.x-p.x,dz=goal.z-p.z,len=Math.hypot(dx,dz);
          // Cruisers build up speed and brake for corners, so a fast driver can pull away.
          const speed=p.respond?15+this.level*1.5:10;
          p.vel=(p.vel||0)+clamp(speed-(p.vel||0),-20*dt,6*dt);
          const travel=Math.min(p.vel*dt,len); const nx=p.x+dx/(len||1)*travel,nz=p.z+dz/(len||1)*travel;
          // Units queue behind a lower-numbered unit instead of stacking on one spot.
          const index=this.units.indexOf(p),jam=this.units.some((q,i)=>i<index&&Math.hypot(q.x-nx,q.z-nz)<7.5&&Math.hypot(q.x-nx,q.z-nz)<dist(p,q));
          if(jam||(direct&&len<4.5)) {p.vel=0;}
          else if(!this.world.isBlocked(nx,nz,1.55)) {p.x=nx;p.z=nz;p.speed=p.vel;}
          else {p.path=[];p.routeTimer=0;p.vel=0;if(direct)p.noDirect=3;}
          if(len>0.1)p.heading=Math.atan2(dx,dz);
          if(len<3&&p.path.length){p.path.shift();if(p.path.length)p.vel=Math.min(p.vel,8);}
        }
        p.mesh.position.set(p.x,0,p.z);p.mesh.rotation.y=p.heading;
      }
    }
    // In a chase officers see all around. While searching they only see a cone ahead,
    // plus anything right next to them. A suspect in an unseen vehicle is only
    // recognized up close.
    sees(p,target) {
      const e=p.foot?{x:p.fx,z:p.fz}:p,d=dist(e,target);
      if(d>(this.disguise?24:BN.CONFIG.policeSight)||!BN.hasLineOfSight(e,target,this.world.buildings))return false;
      if(this.state!=='search'||d<14)return true;
      const a=Math.atan2(target.x-e.x,target.z-e.z)-(p.foot?p.fh:p.heading);
      return d<45&&Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<1.05;
    }
    // Foot pursuit: close in to arrest, hold distance when armed response is authorized,
    // and walk back to the cruiser when the suspect is gone.
    walk(p,dt,target,playerSpeed,active) {
      const e={x:p.fx,z:p.fz},d=dist(e,target),free=(x,z)=>!this.world.isBlocked(x,z,.5);
      const sees=active&&this.sees(p,target);
      if(!active||d>70||(Math.abs(playerSpeed)>12&&d>20)||(this.state==='search'&&dist(e,this.lastSeen)<5)) p.back=true;
      else if(sees&&d<30&&Math.abs(playerSpeed)<=12) p.back=false;
      const goal=p.back?p:(sees?target:this.lastSeen),gd=dist(e,goal);
      p.backTime=p.back?p.backTime+dt:0;
      if(p.back&&(gd<2.4||p.backTime>14)) { p.foot=false;p.back=false;p.path=[];p.routeTimer=0;return; }
      const stop=p.back?0:(sees?(this.violent&&this.level>=2?11:1.5):1);
      p.fspeed=0;
      if(gd>stop+.05) {
        const sp=6,dx=(goal.x-e.x)/gd,dz=(goal.z-e.z)/gd,step=Math.min(sp*dt,gd-stop),nx=e.x+dx*step,nz=e.z+dz*step;
        if(free(nx,nz)) {p.fx=nx;p.fz=nz;p.fspeed=sp;}
        else if(Math.abs(dx)>.15&&free(e.x+Math.sign(dx)*step,e.z)) {p.fx=e.x+Math.sign(dx)*step;p.fspeed=sp;}
        else if(Math.abs(dz)>.15&&free(e.x,e.z+Math.sign(dz)*step)) {p.fz=e.z+Math.sign(dz)*step;p.fspeed=sp;}
        p.fh=Math.atan2(dx,dz);
      } else if(sees) p.fh=Math.atan2(target.x-e.x,target.z-e.z);
    }
  };
})();
