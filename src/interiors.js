/* SPDX-License-Identifier: MIT */
// v1.0 "Portas Abertas": four walk-in interiors (Rádio Caju, Oficina do Canal, Mercado Maré Alta, Píer Farol).
// Everything but build() is pure logic with no WebGL, so it runs in Node tests. Each interior is a small room placed in a
// "pocket" far outside the island (beyond the camera far plane, so the city costs nothing while inside). The room is
// built on demand the first time the player enters and then reused. Collision inside is a clamp plus a few AABBs.
// Decision: the fourth interior is the Píer Farol (not the Hotel Maré) because the campaign finale already happens there.
(function () {
  'use strict';
  const BN = window.BN = window.BN || {};
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const POCKET_Z = 3000, WALL = 4.2, FADE = .25;
  const SHOP = Object.freeze({
    kit: {id: 'kit', name: 'Kit médico', price: 60, effect: 'heal'},
    ammo: {id: 'ammo', name: 'Caixa de munição', price: 50, effect: 'ammo'},
    grenade: {id: 'grenade', name: 'Granadas (2)', price: 80, effect: 'grenade'}
  });
  const DEFS = Object.freeze({
    radio: {
      id: 'radio', name: 'Rádio Caju', origin: {x: 3000, z: POCKET_Z}, hx: 7, hz: 5.5,
      door: {x: 40, z: -12.8}, outside: {x: 40, z: -11, heading: 0},
      light: {color: 0xffc58f, ground: 0x4a2f2a, intensity: 1.5, lamp: 0xff8a68},
      colors: {floor: 0x3b2f33, wall: 0x6b4a46, accent: 0xf18b70},
      solids: [{id: 'desk', x: 0, z: -2.5, hx: 3, hz: .7, h: 1}, {id: 'booth', x: 4.6, z: -2.6, hx: 1.8, hz: 2.2, h: 3.2, glass: true}, {id: 'sofa', x: -5, z: 2, hx: .8, hz: 1.5, h: .9}],
      stations: [
        {id: 'mic', kind: 'task', x: 4.6, z: .6, r: 1.4, label: 'Microfone da cabine', verb: 'Fazer o plantão ao vivo', time: 6, reward: 90, rep: 0, cooldown: 120},
        {id: 'board', kind: 'contract', x: -5.5, z: -4.3, r: 1.5, label: 'Quadro de serviços', verb: 'Pegar um serviço do quadro'}
      ]
    },
    garage: {
      id: 'garage', name: 'Oficina do Canal', origin: {x: 3060, z: POCKET_Z}, hx: 8, hz: 6,
      door: {x: -64.5, z: 34}, outside: {x: -65.6, z: 34, heading: -Math.PI / 2},
      light: {color: 0xe9f0e0, ground: 0x3a403c, intensity: 1.7, lamp: 0xfff1cf},
      colors: {floor: 0x2d3638, wall: 0x254d55, accent: 0xff9b67},
      solids: [{id: 'lift', x: 0, z: -1, hx: 2.4, hz: 1.4, h: 1.1}, {id: 'shelves', x: -6.2, z: -4, hx: 1.4, hz: .6, h: 2.4}, {id: 'bench', x: 5.5, z: -5.2, hx: 2, hz: .6, h: 1}, {id: 'counter', x: -4.5, z: 3.4, hx: 1.8, hz: .5, h: 1}],
      stations: [
        {id: 'bench', kind: 'task', x: 5.5, z: -3.9, r: 1.4, label: 'Bancada de montagem', verb: 'Montar a peça na bancada', time: 5, reward: 70, rep: 0, cooldown: 90},
        {id: 'counter', kind: 'garage', x: -4.5, z: 2.1, r: 1.5, label: 'Balcão da oficina', verb: 'Abrir a oficina'}
      ]
    },
    market: {
      id: 'market', name: 'Mercado Maré Alta', origin: {x: 3120, z: POCKET_Z}, hx: 8, hz: 6,
      door: {x: 253, z: 153.2}, outside: {x: 253, z: 154.6, heading: 0},
      light: {color: 0xfff2d6, ground: 0x40524c, intensity: 1.8, lamp: 0xfff6dd},
      colors: {floor: 0x4a5a55, wall: 0x73c7b6, accent: 0x286260},
      solids: [{id: 'shelfA', x: -4.5, z: -1.2, hx: 2.5, hz: .5, h: 1.8}, {id: 'shelfB', x: 4.5, z: -1.2, hx: 2.5, hz: .5, h: 1.8}, {id: 'till', x: 5.5, z: 3, hx: 1.8, hz: .6, h: 1}],
      stations: [
        {id: 'shop-kit', kind: 'shop', item: 'kit', x: -5, z: -4.4, r: 1.3, label: 'Prateleira: Kit médico', verb: 'Comprar Kit médico'},
        {id: 'shop-ammo', kind: 'shop', item: 'ammo', x: 0, z: -4.4, r: 1.3, label: 'Prateleira: Munição', verb: 'Comprar Caixa de munição'},
        {id: 'shop-grenade', kind: 'shop', item: 'grenade', x: 5, z: -4.4, r: 1.3, label: 'Prateleira: Granadas', verb: 'Comprar Granadas (2)'}
      ]
    },
    pier: {
      id: 'pier', name: 'Píer Farol', origin: {x: 3180, z: POCKET_Z}, hx: 6, hz: 5,
      // The lighthouse stands on the deck over water, so the walkable door sits at the pier root on land.
      door: {x: 250, z: -40}, outside: {x: 248.6, z: -40, heading: -Math.PI / 2},
      light: {color: 0xffe2b0, ground: 0x2a3a46, intensity: 1.4, lamp: 0xffd88a},
      colors: {floor: 0x6a5a48, wall: 0xf0dfbf, accent: 0x3f6d79},
      solids: [{id: 'lens', x: 0, z: -2, hx: 1, hz: 1, h: 1.4}, {id: 'chart', x: -4.3, z: -4.4, hx: 1.2, hz: .5, h: 1}, {id: 'column', x: 4.6, z: -3.2, hx: .5, hz: .5, h: 4.2}],
      stations: [
        {id: 'lamp', kind: 'task', x: 0, z: .2, r: 1.4, label: 'Lanterna do farol', verb: 'Acender a lanterna do farol', time: 6, reward: 120, rep: 1, cooldown: 150},
        {id: 'chart', kind: 'race', x: -4.3, z: -3.1, r: 1.4, label: 'Mesa de cartas', verb: 'Marcar um contrarrelógio'}
      ]
    }
  });
  const ORDER = Object.freeze(['radio', 'garage', 'market', 'pier']);
  const toWorld = (def, p) => ({x: def.origin.x + p.x, z: def.origin.z + p.z});
  const toLocal = (def, p) => ({x: p.x - def.origin.x, z: p.z - def.origin.z});
  const exitDoor = def => ({x: 0, z: def.hz - .8, r: 1.9});
  const entrySpawn = def => toWorld(def, {x: 0, z: def.hz - 2.4});
  // Collision in local coordinates: the walls clamp the actor and each solid is an AABB grown by the actor radius.
  function blockedLocal(def, x, z, r) {
    if (Math.abs(x) > def.hx - r || Math.abs(z) > def.hz - r) return true;
    return def.solids.some(s => Math.abs(x - s.x) < s.hx + r && Math.abs(z - s.z) < s.hz + r);
  }
  function blocked(def, wx, wz, r = .42) { const p = toLocal(def, {x: wx, z: wz}); return blockedLocal(def, p.x, p.z, r); }
  // Moves the actor in small steps, sliding along walls and furniture. Returns true when something stopped it.
  function walk(def, actor, nx, nz, r = .42) {
    const steps = Math.max(1, Math.ceil(Math.hypot(nx - actor.x, nz - actor.z) / .3)), dx = (nx - actor.x) / steps, dz = (nz - actor.z) / steps;
    let hit = false;
    for (let i = 0; i < steps; i++) {
      if (!blocked(def, actor.x + dx, actor.z, r)) actor.x += dx; else hit = true;
      if (!blocked(def, actor.x, actor.z + dz, r)) actor.z += dz; else hit = true;
    }
    return hit;
  }
  // Interior camera: third person like the street camera, but pulled inside the walls and under the ceiling.
  function cameraFor(def, player, yaw, pitch = .48) {
    const local = toLocal(def, player), dist = 6, margin = .55;
    const place = angle => ({x: clamp(local.x + Math.sin(angle) * dist, -def.hx + margin, def.hx - margin), z: clamp(local.z + Math.cos(angle) * dist, -def.hz + margin, def.hz - margin)});
    let camera = place(yaw);
    if (Math.hypot(camera.x - local.x, camera.z - local.z) < 3.4) camera = place(yaw + Math.PI);
    const cy = clamp(3.2 + (pitch - .48) * 3, 2.3, WALL - .4), pos = toWorld(def, camera);
    return {position: {x: pos.x, y: cy, z: pos.z}, look: {x: player.x, y: 1.25, z: player.z}};
  }
  // Campaign targets that live in interiors: "in-<id>" is entering, "do-<id>" is finishing a task inside.
  const isInteriorTarget = id => /^(in|do)-/.test(String(id)) && ORDER.includes(String(id).slice(3));
  function targetPoint(targetId) { const def = isInteriorTarget(targetId) && DEFS[String(targetId).slice(3)]; return def ? {id: targetId, name: def.name, x: def.door.x, z: def.door.z} : null; }
  const find = (def, id) => def.stations.find(s => s.id === id);

  class Session {
    constructor(saved) {
      const src = saved && typeof saved === 'object' ? saved : {};
      this.current = null; this.transition = null; this.fade = 0; this.task = null; this.cooldown = {};
      this.visited = new Set(Array.isArray(src.visited) ? src.visited.filter(id => ORDER.includes(id)) : []);
      this.done = {};
      if (src.done && typeof src.done === 'object') for (const key of Object.keys(src.done)) if (/^[a-z]+:[a-z-]+$/.test(key) && ORDER.includes(key.split(':')[0])) this.done[key] = clamp(Math.floor(Number(src.done[key]) || 0), 0, 9999);
    }
    get active() { return this.current !== null; }
    def() { return this.current ? DEFS[this.current] : null; }
    serialize() { return {visited: ORDER.filter(id => this.visited.has(id)), done: {...this.done}}; }
    nearDoor(p) { return ORDER.map(id => DEFS[id]).find(d => Math.hypot(p.x - d.door.x, p.z - d.door.z) < 2.6) || null; }
    nearStation(p) {
      const def = this.def(); if (!def) return null;
      const l = toLocal(def, p);
      return def.stations.filter(s => Math.hypot(l.x - s.x, l.z - s.z) < s.r).sort((a, b) => Math.hypot(l.x - a.x, l.z - a.z) - Math.hypot(l.x - b.x, l.z - b.z))[0] || null;
    }
    nearExit(p) { const def = this.def(); if (!def) return false; const l = toLocal(def, p), e = exitDoor(def); return Math.hypot(l.x - e.x, l.z - e.z) < e.r; }
    prompt(p) {
      if (this.transition) return '';
      const def = this.def();
      if (!def) { const d = this.nearDoor(p); return d ? 'E para entrar · ' + d.name : ''; }
      if (this.task) return 'Fique perto para concluir · ' + Math.ceil(this.task.left) + ' s';
      const s = this.nearStation(p);
      if (s) { const left = this.cooldown[def.id + ':' + s.id]; return left > 0 ? s.label + ' · volte em ' + Math.ceil(left) + ' s' : 'E · ' + s.verb + (s.kind === 'shop' ? ' · R$ ' + SHOP[s.item].price : ''); }
      return this.nearExit(p) ? 'E para sair · ' + def.name : '';
    }
    begin(to) { this.transition = {to, t: 0, swapped: false}; this.task = null; }
    // Returns an event, or null when there is nothing to interact with here.
    interact(p, ctx = {}) {
      if (this.transition) return {type: 'busy'};
      const def = this.def();
      if (!def) {
        const door = this.nearDoor(p); if (!door) return null;
        if (ctx.wanted > 0) return {type: 'blocked', message: 'A porta está trancada. Despiste a polícia antes de entrar.'};
        this.begin(door.id); return {type: 'enter-start', id: door.id};
      }
      if (this.task) return {type: 'busy'};
      const s = this.nearStation(p);
      if (s) {
        const key = def.id + ':' + s.id;
        if (s.kind === 'task') {
          if (this.cooldown[key] > 0) return {type: 'cooldown', id: s.id, left: this.cooldown[key], message: s.label + ': volte em ' + Math.ceil(this.cooldown[key]) + ' s.'};
          this.task = {interior: def.id, station: s, left: s.time}; return {type: 'task-start', id: s.id, time: s.time, message: s.verb + '…'};
        }
        if (s.kind === 'shop') {
          const item = SHOP[s.item];
          if ((ctx.balance || 0) < item.price) return {type: 'blocked', message: 'Faltam R$ ' + (item.price - (ctx.balance || 0)) + ' para ' + item.name + '.'};
          return {type: 'purchase', item, interior: def.id, station: s.id};
        }
        return {type: 'hook', hook: s.kind, interior: def.id, station: s.id};
      }
      if (this.nearExit(p)) { this.begin(null); return {type: 'exit-start', id: def.id}; }
      return null;
    }
    // Called by the game once an effect of the purchase really happened.
    confirmPurchase(interior, item) { const key = interior + ':' + item.id; this.done[key] = (this.done[key] || 0) + 1; }
    update(dt, p) {
      const events = [];
      for (const key of Object.keys(this.cooldown)) { this.cooldown[key] = Math.max(0, this.cooldown[key] - dt); if (this.cooldown[key] === 0) delete this.cooldown[key]; }
      if (this.task) {
        const l = toLocal(DEFS[this.task.interior], p), s = this.task.station;
        if (Math.hypot(l.x - s.x, l.z - s.z) > s.r + .6) { this.task = null; events.push({type: 'task-cancel', message: 'Você se afastou. Tarefa interrompida.'}); }
        else {
          this.task.left -= dt;
          if (this.task.left <= 0) {
            const interior = this.task.interior, key = interior + ':' + s.id;
            this.task = null; this.done[key] = (this.done[key] || 0) + 1; this.cooldown[key] = s.cooldown;
            events.push({type: 'task-done', id: s.id, interior, reward: s.reward, rep: s.rep, message: s.label + ' concluído · +R$ ' + s.reward});
          }
        }
      }
      const tr = this.transition;
      if (tr) {
        tr.t += dt; this.fade = clamp(tr.t < FADE ? tr.t / FADE : 1 - (tr.t - FADE) / FADE, 0, 1);
        if (!tr.swapped && tr.t >= FADE) {
          tr.swapped = true;
          if (tr.to) { this.current = tr.to; this.visited.add(tr.to); const s = entrySpawn(DEFS[tr.to]); events.push({type: 'entered', id: tr.to, spawn: {x: s.x, z: s.z, heading: Math.PI}}); }
          else { const def = this.def(); this.current = null; events.push({type: 'exited', id: def.id, spawn: {...def.outside}}); }
        }
        if (tr.t >= FADE * 2) { this.transition = null; this.fade = 0; }
      }
      return events;
    }
    // Death, jail or a reload: leave without a transition.
    forceExit() { const def = this.def(); this.current = null; this.transition = null; this.fade = 0; this.task = null; return def ? {...def.outside} : null; }
  }

  // ---- Scene builder (the only part that needs THREE). Geometry is one shared unit box; materials are cached by colour.
  function build(T, def) {
    const group = new T.Group(), box = new T.BoxGeometry(1, 1, 1), cache = new Map();
    const mat = (color, emissive = 0, glass = false) => {
      const key = color + ':' + emissive + ':' + glass;
      if (!cache.has(key)) cache.set(key, emissive ? new T.MeshStandardMaterial({color, emissive, emissiveIntensity: 1.4}) : new T.MeshStandardMaterial({color, roughness: .85, transparent: glass, opacity: glass ? .35 : 1}));
      return cache.get(key);
    };
    const add = (m, x, y, z, sx, sy, sz) => { const mesh = new T.Mesh(box, m); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); group.add(mesh); return mesh; };
    const c = def.colors, hx = def.hx, hz = def.hz;
    add(mat(c.floor), 0, -.05, 0, hx * 2, .1, hz * 2);
    add(mat(0x20282b), 0, WALL + .05, 0, hx * 2, .1, hz * 2);
    add(mat(c.wall), 0, WALL / 2, -hz, hx * 2, WALL, .2); add(mat(c.wall), -hx, WALL / 2, 0, .2, WALL, hz * 2); add(mat(c.wall), hx, WALL / 2, 0, .2, WALL, hz * 2); add(mat(c.wall), 0, WALL / 2, hz, hx * 2, WALL, .2);
    add(mat(c.accent), 0, .25, -hz + .12, hx * 2, .5, .08);
    const e = exitDoor(def); add(mat(0x1a1f22), e.x, 1.2, hz - .05, 2, 2.4, .12); add(mat(c.accent, c.accent), e.x, 2.55, hz - .08, 2.4, .12, .1);
    for (const s of def.solids) add(mat(s.glass ? 0x9fd6d8 : c.accent, 0, !!s.glass), s.x, s.h / 2, s.z, s.hx * 2, s.h, s.hz * 2);
    for (const s of def.stations) add(mat(0x8de3cf, 0x8de3cf), s.x, .06, s.z, s.r * .8, .04, s.r * .8);
    // Readable low-poly furniture: each room keeps its own silhouette instead of looking like an empty coloured box.
    if (def.id === 'radio') {
      add(mat(0x172a31), 0, 1.08, -2.15, 5.2, .16, .9);
      for (const x of [-1.8, 0, 1.8]) add(mat(0x8de3cf, 0x8de3cf), x, 1.45, -2.55, 1.1, .65, .08);
      for (let x = -2.2; x <= 2.2; x += .55) add(mat(x % 1.1 ? 0xff805b : 0xffd26f, 0xff805b), x, 1.22, -1.85, .16, .06, .16);
      add(mat(0x26343a), -5, 1.05, 2, 1.4, .28, 2.5);
    } else if (def.id === 'garage') {
      for (const x of [-2.2, 2.2]) add(mat(0x334a50), x, 1.7, -1, .24, 3.4, 3.1);
      add(mat(0xffc45f, 0xff9b67), 0, 3.25, -1, 4.8, .18, .3);
      for (let z = -5; z <= 4; z += 1.1) add(mat(z % 2.2 ? 0x20282b : 0xff9b67), -6.1, 1.2, z, .35, .28, .7);
      for (const x of [4.4, 5.5, 6.6]) add(mat(0x20282b), x, .45, -5.1, .7, .7, .45);
    } else if (def.id === 'market') {
      for (const x of [-4.5, 4.5]) for (const y of [.45, 1.05, 1.65]) add(mat(0xf2dfb5), x, y, -1.2, 5.1, .1, 1.15);
      const product = [0xff805b, 0x8de3cf, 0xffd26f];
      for (const [xi, x] of [-5.8, -4.5, -3.2, 3.2, 4.5, 5.8].entries()) for (const [yi, y] of [.7, 1.25].entries()) add(mat(product[(xi + yi) % 3]), x, y, -1.15, .55, .35, .65);
      add(mat(0x172a31), 5.5, 1.15, 3, 3.2, .18, 1.1);
    } else if (def.id === 'pier') {
      add(mat(0xffd88a, 0xffd88a), 0, 2.2, -2, .7, 1.7, .7);
      for (const x of [-4, -2, 0, 2, 4]) add(mat(0x9fd6d8, 0, true), x, 2.4, -hz + .08, 1.4, 1.3, .08);
      add(mat(0x3f6d79), -4.3, 1.08, -4.05, 2.2, .12, 1.5);
      for (const z of [-1.4, 0, 1.4]) add(mat(0xffd88a, 0xffd88a), 4.6, 1.2, z, .18, 2.2, .18);
    }
    // Interior lighting: emissive ceiling lamps. The scene lights are re-tinted by the game while inside (no extra
    // lights are added, so entering never recompiles the city materials).
    for (const x of [-hx / 2, hx / 2]) for (const z of [-hz / 2, hz / 2]) add(mat(def.light.lamp, def.light.lamp), x, WALL - .1, z, 1.2, .1, .5);
    group.position.set(def.origin.x, 0, def.origin.z); group.visible = false;
    return group;
  }

  BN.Interiors = Object.freeze({DEFS, ORDER, SHOP, WALL, FADE, Session, blocked, walk, cameraFor, toWorld, toLocal, exitDoor, entrySpawn, isInteriorTarget, targetPoint, find, build});
})();
