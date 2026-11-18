/* SPDX-License-Identifier: MIT */
// v1.0 "Cidade Física": pure logic with no WebGL dependency, so every mechanism can be tested in Node.
// Gamepad input, adaptive prompts, one-way street graph, breakable fixtures, soft crowd contact,
// police roadblocks and gradual quality tiers.
(function () {
  'use strict';
  const BN = window.BN = window.BN || {};
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const noop = () => {};

  // ---------------------------------------------------------------- Gamepad
  // Radial dead zone: direction is kept, magnitude is rescaled so the output starts at 0 just past the dead zone.
  function radialDeadzone(x, y, dead) {
    const magnitude = Math.hypot(x, y), d = clamp(dead, 0, .9);
    if (!(magnitude > d)) return {x: 0, y: 0};
    const scaled = Math.min(1, (magnitude - d) / (1 - d));
    return {x: x / magnitude * scaled, y: y / magnitude * scaled};
  }
  function axisDeadzone(value, dead) {
    const d = clamp(dead, 0, .9), a = Math.abs(value);
    return a > d ? Math.sign(value) * Math.min(1, (a - d) / (1 - d)) : 0;
  }
  // Standard-mapping button indexes.
  const PAD = Object.freeze({interact: 0, handbrake: 1, fire: 2, retry: 3, reload: 3, prev: 4, next: 5, lt: 6, rt: 7, map: 8, pause: 9, run: 10, grenade: 10, horn: 11, up: 12, down: 13, left: 14, right: 15});
  const PAD_DEFAULTS = Object.freeze({stickDead: .18, lookDead: .15, triggerDead: .06, lookSpeed: 2.6, vibration: true});
  const clean = {x: 0, y: 0};
  function neutralState() {
    return {connected: false, id: '', move: {...clean}, look: {...clean}, throttle: 0, brake: 0, down: {}, pressed: {}, released: {}, active: false};
  }
  class GamepadInput {
    constructor(options = {}) {
      this.getPads = options.getGamepads || (() => []);
      this.onChange = options.onChange || noop;
      this.settings = {...PAD_DEFAULTS, ...(options.settings || {})};
      this.index = -1; this.id = ''; this.last = {}; this.state = neutralState(); this.lastRumble = -1;
    }
    configure(patch) {
      const s = this.settings;
      if (patch.stickDead !== undefined) s.stickDead = clamp(Number(patch.stickDead) || 0, .02, .6);
      if (patch.lookDead !== undefined) s.lookDead = clamp(Number(patch.lookDead) || 0, .02, .6);
      if (patch.triggerDead !== undefined) s.triggerDead = clamp(Number(patch.triggerDead) || 0, 0, .5);
      if (patch.lookSpeed !== undefined) s.lookSpeed = clamp(Number(patch.lookSpeed) || 1, .5, 6);
      if (patch.vibration !== undefined) s.vibration = Boolean(patch.vibration);
      return s;
    }
    pickPad(list) {
      const pads = Array.from(list || []).filter(p => p && p.connected !== false);
      return pads.find(p => p.index === this.index) || pads[0] || null;
    }
    // Called once per frame. Hot-plug is detected here, so no event is required for correctness.
    poll() {
      let list = [];
      try { list = this.getPads() || []; } catch (_) { list = []; }
      const pad = this.pickPad(list);
      if (!pad) {
        if (this.index !== -1) { const id = this.id; this.index = -1; this.id = ''; this.last = {}; this.state = neutralState(); this.onChange('disconnected', id); }
        return this.state;
      }
      if (pad.index !== this.index || pad.id !== this.id) { this.index = pad.index; this.id = pad.id || ''; this.last = {}; this.onChange('connected', this.id); }
      const s = this.settings, axes = pad.axes || [], buttons = pad.buttons || [];
      const value = i => { const b = buttons[i]; return b ? (typeof b === 'number' ? b : (b.value !== undefined ? b.value : (b.pressed ? 1 : 0))) : 0; };
      const isDown = i => { const b = buttons[i]; if (!b) return false; if (typeof b === 'object' && b.pressed !== undefined) return b.pressed; return value(i) > .5; };
      const move = radialDeadzone(axes[0] || 0, axes[1] || 0, s.stickDead), look = radialDeadzone(axes[2] || 0, axes[3] || 0, s.lookDead);
      const throttle = axisDeadzone(value(PAD.rt), s.triggerDead), brake = axisDeadzone(value(PAD.lt), s.triggerDead);
      const down = {}, pressed = {}, released = {};
      let active = move.x !== 0 || move.y !== 0 || look.x !== 0 || look.y !== 0 || throttle > 0 || brake > 0;
      for (const name of Object.keys(PAD)) {
        const now = isDown(PAD[name]), before = Boolean(this.last[name]);
        down[name] = now; if (now && !before) pressed[name] = true; if (!now && before) released[name] = true;
        if (now) active = true; this.last[name] = now;
      }
      this.state = {connected: true, id: this.id, move, look, throttle, brake, down, pressed, released, active};
      return this.state;
    }
    // Rumble is optional hardware. Every failure path is silent.
    rumble(strong, weak, ms, now = Date.now()) {
      if (!this.settings.vibration || this.index < 0) return false;
      if (now - this.lastRumble < 60) return false;
      let pad = null;
      try { pad = Array.from(this.getPads() || []).find(p => p && p.index === this.index); } catch (_) { return false; }
      if (!pad) return false;
      const duration = clamp(ms || 100, 20, 600), strongMagnitude = clamp(strong, 0, 1), weakMagnitude = clamp(weak === undefined ? strong : weak, 0, 1);
      try {
        const actuator = pad.vibrationActuator;
        if (actuator && typeof actuator.playEffect === 'function') {
          const result = actuator.playEffect(actuator.type || 'dual-rumble', {startDelay: 0, duration, strongMagnitude, weakMagnitude});
          if (result && typeof result.catch === 'function') result.catch(noop);
          this.lastRumble = now; return true;
        }
        const haptic = pad.hapticActuators && pad.hapticActuators[0];
        if (haptic && typeof haptic.pulse === 'function') {
          const result = haptic.pulse(Math.max(strongMagnitude, weakMagnitude), duration);
          if (result && typeof result.catch === 'function') result.catch(noop);
          this.lastRumble = now; return true;
        }
      } catch (_) { /* unsupported or revoked actuator */ }
      return false;
    }
    // Optional convenience for the browser: events only nudge a rescan on the next poll.
    attach(win) {
      if (!win || !win.addEventListener) return;
      const rescan = () => { if (this.index === -1) this.last = {}; };
      win.addEventListener('gamepadconnected', rescan);
      win.addEventListener('gamepaddisconnected', rescan);
    }
  }

  // Which device the player used last decides every on-screen prompt.
  class InputMode {
    constructor(onChange) { this.mode = 'keyboard'; this.onChange = onChange || noop; }
    note(kind) {
      if (!['keyboard', 'touch', 'gamepad'].includes(kind) || kind === this.mode) return false;
      this.mode = kind; this.onChange(kind); return true;
    }
  }
  const HINTS = {
    keyboard: [['WASD', 'mover'], ['E', 'veículo'], ['M', 'mapa'], ['H', 'ajuda'], ['ESC', 'pausa']],
    gamepad: [['L', 'mover'], ['R', 'câmera'], ['A', 'interagir'], ['RT', 'acelerar/atirar'], ['X', 'atirar no carro'], ['LB/RB', 'trocar arma'], ['SELECT', 'mapa'], ['START', 'pausa']],
    touch: [['ANALÓGICO', 'mover'], ['INTERAGIR', 'veículo'], ['ARMA', 'trocar']]
  };
  const Prompts = {
    hints(mode) { return (HINTS[mode] || HINTS.keyboard).map(([key, text]) => ({key, text})); },
    hintsHtml(mode) { return Prompts.hints(mode).map(h => '<span><kbd>' + h.key + '</kbd> ' + h.text + '</span>').join(''); },
    // Rewrites keyboard wording of contextual prompts for the active device.
    localize(text, mode) {
      if (!text || mode === 'keyboard') return text;
      if (mode === 'gamepad') return text.replace(/\bENTER\b/g, 'A').replace(/\bE para\b/g, 'A para').replace(/\bY para\b/g, 'Y para').replace(/\bX para\b/g, 'X para');
      return text.replace(/\bENTER para abrir a oficina\b/g, 'Toque OFICINA para abrir').replace(/\bE para (.+)$/g, 'Toque INTERAGIR para $1').replace(/\bY para repetir\b/g, 'Toque REPETIR').replace(/\bENTER\b/g, 'INTERAGIR');
    }
  };

  // ---------------------------------------------------------------- One-way streets
  // oneWay.x[v] gives the direction along +z of the road at constant x=v; oneWay.z[v] gives the direction
  // along +x of the road at constant z=v. Missing or 0 means two-way.
  const LANE = 2.6;
  const key = (ix, iz) => ix + ':' + iz;
  class Streets {
    constructor(roads, oneWay = {}) {
      this.roads = roads.slice(); this.oneWay = {x: {...(oneWay.x || {})}, z: {...(oneWay.z || {})}};
      this.cache = new Map();
    }
    dirX(ix) { return Math.sign(this.oneWay.x[this.roads[ix]] || 0); }
    dirZ(iz) { return Math.sign(this.oneWay.z[this.roads[iz]] || 0); }
    node(ix, iz) { return {ix, iz, x: this.roads[ix], z: this.roads[iz]}; }
    isOneWayLine(axis, value) { return Boolean(this.oneWay[axis][value]); }
    // Directed neighbours of a crossing.
    neighbours(ix, iz) {
      const k = key(ix, iz); if (this.cache.has(k)) return this.cache.get(k);
      const out = [], n = this.roads.length, dz = this.dirZ(iz), dx = this.dirX(ix);
      if (ix + 1 < n && dz >= 0) out.push(this.node(ix + 1, iz));
      if (ix - 1 >= 0 && dz <= 0) out.push(this.node(ix - 1, iz));
      if (iz + 1 < n && dx >= 0) out.push(this.node(ix, iz + 1));
      if (iz - 1 >= 0 && dx <= 0) out.push(this.node(ix, iz - 1));
      this.cache.set(k, out); return out;
    }
    allowed(a, b) { return this.neighbours(a.ix, a.iz).some(n => n.ix === b.ix && n.iz === b.iz); }
    stronglyConnected() {
      const n = this.roads.length, reach = (start, reverse) => {
        const seen = new Set([key(start.ix, start.iz)]), stack = [start];
        while (stack.length) {
          const c = stack.pop();
          for (let ix = 0; ix < n; ix++) for (let iz = 0; iz < n; iz++) {
            if (Math.abs(ix - c.ix) + Math.abs(iz - c.iz) !== 1) continue;
            const from = reverse ? this.node(ix, iz) : c, to = reverse ? c : this.node(ix, iz);
            if (this.allowed(from, to) && !seen.has(key(ix, iz))) { seen.add(key(ix, iz)); stack.push(this.node(ix, iz)); }
          }
        }
        return seen.size === n * n;
      };
      const origin = this.node(0, 0);
      return reach(origin, false) && reach(origin, true);
    }
    // Lane offset (right-hand traffic in this world's axes) for a unit heading.
    laneOffset(hx, hz) { return {x: -hz * LANE, z: hx * LANE}; }
    // Position a car aims for at crossing `cur`, coming from `prev` and leaving to `next`.
    waypoint(prev, cur, next) {
      const hin = {x: Math.sign(cur.x - prev.x), z: Math.sign(cur.z - prev.z)}, hout = next ? {x: Math.sign(next.x - cur.x), z: Math.sign(next.z - cur.z)} : hin;
      const oi = this.laneOffset(hin.x, hin.z), oo = this.laneOffset(hout.x, hout.z);
      return {x: cur.x + (oi.x || oo.x), z: cur.z + (oi.z || oo.z)};
    }
    pickNext(cur, prev, rng) {
      const options = this.neighbours(cur.ix, cur.iz), forward = prev ? options.filter(n => !(n.ix === prev.ix && n.iz === prev.iz)) : options;
      const list = forward.length ? forward : options;
      return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
    }
    // A traffic car's navigation state: it drives towards `cur`, then `next`.
    spawnNav(index, rng) {
      const n = this.roads.length;
      for (let attempt = 0; attempt < 40; attempt++) {
        const prev = this.node(Math.floor(rng() * n), Math.floor(rng() * n)), options = this.neighbours(prev.ix, prev.iz);
        if (!options.length) continue;
        const cur = options[Math.min(options.length - 1, Math.floor(rng() * options.length))];
        return this.makeNav(prev, cur, rng);
      }
      return this.makeNav(this.node(0, 0), this.neighbours(0, 0)[0], rng);
    }
    makeNav(prev, cur, rng) {
      const next = this.pickNext(cur, prev, rng), h = {x: Math.sign(cur.x - prev.x), z: Math.sign(cur.z - prev.z)}, o = this.laneOffset(h.x, h.z);
      return {prev, cur, next, start: {x: prev.x + o.x, z: prev.z + o.z}, waypoint: this.waypoint(prev, cur, next)};
    }
    advance(nav, rng) {
      const prev = nav.cur, cur = nav.next, next = this.pickNext(cur, prev, rng);
      nav.prev = prev; nav.cur = cur; nav.next = next; nav.waypoint = this.waypoint(prev, cur, next);
      return nav;
    }
    // Which one-way line contains the point, and is the heading against it?
    roadAt(x, z, halfWidth = 7) {
      const hits = [];
      for (const v of this.roads) {
        if (Math.abs(x - v) <= halfWidth) hits.push({axis: 'x', value: v});
        if (Math.abs(z - v) <= halfWidth) hits.push({axis: 'z', value: v});
      }
      return hits;
    }
    isWrongWay(x, z, heading) {
      const hx = Math.sin(heading), hz = Math.cos(heading);
      const onX = this.roads.find(v => Math.abs(x - v) <= 5), onZ = this.roads.find(v => Math.abs(z - v) <= 5);
      // At a crossing the player may be turning, so only mid-block counts.
      if (onX !== undefined && onZ !== undefined) return false;
      if (onX !== undefined) { const d = Math.sign(this.oneWay.x[onX] || 0); return d !== 0 && hz * d < -.6; }
      if (onZ !== undefined) { const d = Math.sign(this.oneWay.z[onZ] || 0); return d !== 0 && hx * d < -.6; }
      return false;
    }
    // Segment a point on the road grid belongs to: nodes that can be entered from it, and the nodes that reach it.
    segmentOf(point) {
      const roads = this.roads, nearest = v => roads.reduce((best, r, i) => Math.abs(r - v) < Math.abs(roads[best] - v) ? i : best, 0);
      const ix = nearest(point.x), iz = nearest(point.z);
      const onVertical = Math.abs(point.x - roads[ix]) <= Math.abs(point.z - roads[iz]);
      // Points beyond the last crossing are pulled onto the grid so every leg stays on a street.
      const edge = v => clamp(v, roads[0], roads[roads.length - 1]);
      const snapped = onVertical ? {x: roads[ix], z: edge(point.z)} : {x: edge(point.x), z: roads[iz]};
      const along = onVertical ? snapped.z : snapped.x, dir = onVertical ? this.dirX(ix) : this.dirZ(iz);
      let lo = -1;
      for (let i = 0; i < roads.length; i++) if (roads[i] <= along + 1e-9) lo = i;
      const hi = lo >= 0 && Math.abs(roads[lo] - along) < 1e-9 ? lo : Math.min(roads.length - 1, lo + 1);
      const nodeAt = i => onVertical ? this.node(ix, i) : this.node(i, iz);
      const a = lo >= 0 ? nodeAt(lo) : null, b = nodeAt(Math.max(hi, 0));
      return {snapped, onVertical, dir, a, b, lo, hi};
    }
    // Directed shortest route as a list of points. Every leg obeys the one-way graph.
    route(start, destination) {
      if (!start || !destination) return [];
      const s = this.segmentOf(start), e = this.segmentOf(destination), n = this.roads.length;
      const cost = new Map(), previous = new Map(), done = new Set();
      const seed = (node, c) => { const k = key(node.ix, node.iz); if (!(cost.get(k) <= c)) { cost.set(k, c); previous.set(k, null); } };
      // Leaving the start point along its own road: forward end if one-way, both ends otherwise.
      const exits = [];
      if (s.a && s.a.ix === s.b.ix && s.a.iz === s.b.iz) exits.push(s.a);
      else {
        const lower = s.a, upper = s.b;
        if (lower && (s.dir <= 0)) exits.push(lower);
        if (s.dir >= 0) exits.push(upper);
      }
      if (!exits.length) exits.push(...[s.a, s.b].filter(Boolean));
      exits.forEach(node => seed(node, dist(s.snapped, node)));
      // Direct run when both points share the segment in an allowed direction.
      const sameLine = s.onVertical === e.onVertical && (s.onVertical ? Math.abs(s.snapped.x - e.snapped.x) < 1e-6 : Math.abs(s.snapped.z - e.snapped.z) < 1e-6);
      if (sameLine) {
        const a = s.onVertical ? s.snapped.z : s.snapped.x, b = e.onVertical ? e.snapped.z : e.snapped.x, sign = Math.sign(b - a);
        const sameBlock = e.lo === s.lo && e.hi === s.hi;
        if (sameBlock && (s.dir === 0 || sign === 0 || sign === s.dir)) return [s.snapped, e.snapped];
      }
      // The last leg enters the destination segment from a node that is allowed to drive towards it.
      const entries = new Map();
      const addEntry = (node, goesForward) => { if (node && (e.dir === 0 || e.dir === (goesForward ? 1 : -1))) entries.set(key(node.ix, node.iz), node); };
      if (e.a && e.a.ix === e.b.ix && e.a.iz === e.b.iz) entries.set(key(e.a.ix, e.a.iz), e.a);
      else { addEntry(e.a, true); addEntry(e.b, false); }
      if (!entries.size) [e.a, e.b].filter(Boolean).forEach(node => entries.set(key(node.ix, node.iz), node));
      const open = new Set(cost.keys());
      let goal = null, goalCost = Infinity;
      while (open.size) {
        let current = null;
        for (const k of open) if (current === null || cost.get(k) < cost.get(current)) current = k;
        open.delete(current); done.add(current);
        const [cx, cz] = current.split(':').map(Number), here = this.node(cx, cz);
        if (entries.has(current)) { const total = cost.get(current) + dist(here, e.snapped); if (total < goalCost) { goalCost = total; goal = current; } }
        if (cost.get(current) >= goalCost) break;
        for (const next of this.neighbours(cx, cz)) {
          const nk = key(next.ix, next.iz); if (done.has(nk)) continue;
          const c = cost.get(current) + dist(here, next);
          if (!(cost.get(nk) <= c)) { cost.set(nk, c); previous.set(nk, current); open.add(nk); }
        }
      }
      if (goal === null) return [];
      const nodes = []; for (let k = goal; k; k = previous.get(k)) { const [ix, iz] = k.split(':').map(Number); nodes.unshift(this.node(ix, iz)); }
      const points = [s.snapped, ...nodes.map(nd => ({x: nd.x, z: nd.z})), e.snapped];
      return points.filter((p, i) => i === 0 || dist(p, points[i - 1]) > .1);
    }
    // Check that every consecutive pair of points of a route is a legal move.
    routeIsLegal(points) {
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        const dx = Math.sign(Math.round(b.x - a.x)), dz = Math.sign(Math.round(b.z - a.z));
        if (dx !== 0 && dz !== 0) return false;
        const mid = {x: (a.x + b.x) / 2, z: (a.z + b.z) / 2}, lineX = this.roads.find(v => Math.abs(a.x - v) < .01 && Math.abs(b.x - v) < .01), lineZ = this.roads.find(v => Math.abs(a.z - v) < .01 && Math.abs(b.z - v) < .01);
        if (dz !== 0 && lineX !== undefined) { const d = Math.sign(this.oneWay.x[lineX] || 0); if (d && d !== dz) return false; }
        if (dx !== 0 && lineZ !== undefined) { const d = Math.sign(this.oneWay.z[lineZ] || 0); if (d && d !== dx) return false; }
        if (mid.x === undefined) return false;
      }
      return true;
    }
  }

  // ---------------------------------------------------------------- Breakable fixtures
  const FIXTURE_KINDS = Object.freeze({lamp: {r: .32, breakSpeed: 7, damage: 3, drag: .86}, signal: {r: .3, breakSpeed: 6, damage: 4, drag: .84}});
  class FixtureRegistry {
    constructor(options = {}) { this.items = []; this.cells = new Map(); this.restoreAfter = options.restoreAfter || 150; this.fallTime = options.fallTime || .7; this.dirty = false; }
    add(x, z, kind = 'lamp') {
      const def = FIXTURE_KINDS[kind] || FIXTURE_KINDS.lamp;
      const item = {x, z, kind, r: def.r, breakSpeed: def.breakSpeed, damage: def.damage, drag: def.drag, state: 'up', fall: 0, dirX: 0, dirZ: 1, timer: 0, id: this.items.length};
      this.items.push(item);
      const k = Math.floor(x / 16) * 1000 + Math.floor(z / 16);
      if (!this.cells.has(k)) this.cells.set(k, []);
      this.cells.get(k).push(item);
      return item;
    }
    near(x, z, r, visit) {
      const gx = Math.floor(x / 16), gz = Math.floor(z / 16);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const list = this.cells.get((gx + i) * 1000 + gz + j); if (!list) continue;
        for (const q of list) visit(q);
      }
    }
    // Upright fixtures are solid. Fallen ones are flat on the ground and no longer block.
    blocked(x, z, r) {
      let hit = false;
      this.near(x, z, r, q => { if (!hit && q.state === 'up') { const rr = r + q.r, dx = x - q.x, dz = z - q.z; if (dx * dx + dz * dz < rr * rr) hit = true; } });
      return hit;
    }
    // A vehicle moving at `speed` touches upright fixtures near (x,z). Fast enough: they fall away from the motion.
    impact(x, z, r, speed, vx = 0, vz = 0) {
      const knocked = [];
      this.near(x, z, r, q => {
        if (q.state !== 'up') return;
        const rr = r + q.r + .15, dx = q.x - x, dz = q.z - z;
        if (dx * dx + dz * dz >= rr * rr || Math.abs(speed) < q.breakSpeed) return;
        let mx = vx, mz = vz, length = Math.hypot(mx, mz);
        if (length < .01) { mx = dx; mz = dz; length = Math.hypot(mx, mz) || 1; }
        q.dirX = mx / length; q.dirZ = mz / length; q.state = 'falling'; q.fall = 0; q.timer = 0; knocked.push(q); this.dirty = true;
      });
      return knocked;
    }
    update(dt, focus) {
      for (const q of this.items) {
        if (q.state === 'falling') { q.fall = Math.min(1, q.fall + dt / this.fallTime); this.dirty = true; if (q.fall >= 1) { q.state = 'down'; q.timer = 0; } }
        else if (q.state === 'down') {
          q.timer += dt;
          if (q.timer > this.restoreAfter && (!focus || dist(q, focus) > 30)) { q.state = 'up'; q.fall = 0; this.dirty = true; }
        }
      }
    }
    // Ease-in fall angle for rendering.
    angle(q) { return q.state === 'up' ? 0 : (q.state === 'down' ? 1 : q.fall * q.fall) * 1.52; }
    count(state) { return this.items.filter(q => q.state === state).length; }
  }

  // ---------------------------------------------------------------- Soft crowd contact
  // Moves pedestrians away from an actor and gives the actor only a mild nudge, so contact never pins anyone.
  function softPush(actor, others, options = {}) {
    const ar = options.actorRadius || .42, pr = options.otherRadius || .4, canMove = options.canMove || (() => true);
    const pushOther = options.pushOther === undefined ? .85 : options.pushOther, pushActor = options.pushActor === undefined ? .05 : options.pushActor, max = options.maxStep || .35;
    let touched = 0, nudgeX = 0, nudgeZ = 0;
    for (const o of others) {
      if (o.dead || o.down > 0) continue;
      const dx = o.x - actor.x, dz = o.z - actor.z, d = Math.hypot(dx, dz), min = ar + pr;
      if (d >= min) continue;
      touched++;
      const nx = d > .001 ? dx / d : (o.id % 2 ? 1 : -1), nz = d > .001 ? dz / d : 0, overlap = min - d;
      const step = Math.min(max, overlap * pushOther), tx = o.x + nx * step, tz = o.z + nz * step;
      if (canMove(tx, tz, pr)) { o.x = tx; o.z = tz; }
      else {
        // Wall behind the pedestrian: slide sideways instead of resisting.
        const sx = o.x - nz * step, sz = o.z + nx * step, ox = o.x + nz * step, oz = o.z - nx * step;
        if (canMove(sx, sz, pr)) { o.x = sx; o.z = sz; } else if (canMove(ox, oz, pr)) { o.x = ox; o.z = oz; }
      }
      nudgeX -= nx * Math.min(max, overlap * pushActor); nudgeZ -= nz * Math.min(max, overlap * pushActor);
      o.shoved = (o.shoved || 0) + 1;
    }
    const nudgeLength = Math.hypot(nudgeX, nudgeZ), nudgeCap = options.maxNudge || .04;
    if (nudgeLength > nudgeCap) { nudgeX *= nudgeCap / nudgeLength; nudgeZ *= nudgeCap / nudgeLength; }
    if (touched && (nudgeX || nudgeZ) && canMove(actor.x + nudgeX, actor.z + nudgeZ, ar)) { actor.x += nudgeX; actor.z += nudgeZ; }
    return touched;
  }

  // ---------------------------------------------------------------- Police roadblocks
  const nearestIndex = (list, v) => list.reduce((best, r, i) => Math.abs(r - v) < Math.abs(list[best] - v) ? i : best, 0);
  const CAR_CIRCLES = [-1.1, 1.1];
  function blockCircles(car) {
    // Cars are laid across the street, so their length runs along the perpendicular axis.
    const along = car.across === 'x' ? {x: 1, z: 0} : {x: 0, z: 1};
    return CAR_CIRCLES.map(o => ({x: car.x + along.x * o, z: car.z + along.z * o, r: 1.1}));
  }
  // Chooses a street position ahead of the suspect, mid-block, on free asphalt, with a gap wide enough for a car.
  function planRoadblock(world, from, dir, options = {}) {
    const roads = world.roads, min = options.min || 80, max = options.max || 170, step = options.step || 6, gap = options.gap || 5.2, margin = options.crossMargin || 18, limit = options.limit || 250;
    const ix = nearestIndex(roads, from.x), iz = nearestIndex(roads, from.z), vertical = Math.abs(from.x - roads[ix]) <= Math.abs(from.z - roads[iz]);
    const line = vertical ? roads[ix] : roads[iz], along0 = vertical ? from.z : from.x, component = vertical ? dir.z : dir.x;
    const first = Math.sign(component) || 1, offset = gap / 2 + 2.15;
    for (const sign of [first, -first]) {
      for (let d = min; d <= max; d += step) {
        const a = along0 + sign * d; if (Math.abs(a) > limit) continue;
        if (roads.some(r => Math.abs(a - r) < margin)) continue;
        const x = vertical ? line : a, z = vertical ? a : line;
        const cars = [-1, 1].map(side => ({x: vertical ? x + side * offset : x, z: vertical ? z : z + side * offset, heading: vertical ? Math.PI / 2 : 0, across: vertical ? 'x' : 'z', side}));
        const circles = cars.flatMap(blockCircles);
        if (circles.some(c => world.isBlocked(c.x, c.z, c.r))) continue;
        // The street itself and the gap between the cruisers must be open.
        const probes = [-gap / 2 + .6, 0, gap / 2 - .6].map(o => ({x: vertical ? x + o : x, z: vertical ? z : z + o}));
        if (probes.some(p => world.isBlocked(p.x, p.z, 1.15))) continue;
        return {x, z, vertical, line, gap, cars, distance: d};
      }
    }
    return null;
  }
  class RoadblockManager {
    constructor(world, hooks = {}, options = {}) {
      this.world = world; this.hooks = hooks; this.blocks = []; this.cooldown = 0; this.serial = 0;
      this.options = options; this.maxBlocks = options.maxBlocks || 2; this.interval = options.interval || 30; this.minLevel = options.minLevel || 3;
      if (!world.dynamicSolids) world.dynamicSolids = [];
    }
    build(plan) {
      const block = {id: ++this.serial, x: plan.x, z: plan.z, vertical: plan.vertical, gap: plan.gap, cars: plan.cars, solids: [], age: 0};
      for (const car of plan.cars) for (const c of blockCircles(car)) { const solid = {x: c.x, z: c.z, r: c.r, owner: block.id}; block.solids.push(solid); this.world.dynamicSolids.push(solid); }
      this.blocks.push(block); if (this.hooks.build) this.hooks.build(block); return block;
    }
    remove(block, reason) {
      // Mutate in place: the world keeps a reference to this array.
      const solids = this.world.dynamicSolids;
      for (let i = solids.length - 1; i >= 0; i--) if (solids[i].owner === block.id) solids.splice(i, 1);
      this.blocks = this.blocks.filter(b => b !== block);
      if (this.hooks.remove) this.hooks.remove(block, reason);
    }
    clear(reason = 'ended') { for (const b of this.blocks.slice()) this.remove(b, reason); }
    update(dt, info) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      // The chase is over once the heat is gone or the police are back on patrol.
      if (info.level === 0 || info.state === 'patrol') { this.clear('ended'); return; }
      const canBuild = info.level >= this.minLevel && info.state === 'chase' && info.driving;
      for (const b of this.blocks.slice()) {
        b.age += dt;
        const ahead = (b.x - info.target.x) * info.dir.x + (b.z - info.target.z) * info.dir.z;
        if (ahead < -45 || dist(b, info.target) > 330) this.remove(b, 'passed');
      }
      if (canBuild && this.blocks.length < this.maxBlocks && this.cooldown <= 0) {
        const plan = planRoadblock(this.world, info.target, info.dir, this.options);
        if (plan && !this.blocks.some(b => dist(b, plan) < 60)) { this.build(plan); this.cooldown = this.interval; } else this.cooldown = 4;
      }
    }
  }

  // ---------------------------------------------------------------- Gradual quality
  const QUALITY_TIERS = Object.freeze([
    Object.freeze({id: 'normal', pixelRatio: 1.5, shadows: true, shadowSize: 1024, carCull: 175, pedCull: 110, far: 1350, fogFar: 650, detailRange: 1e9, detail: 1, waterEvery: 3}),
    Object.freeze({id: 'medio', pixelRatio: 1.15, shadows: true, shadowSize: 512, carCull: 140, pedCull: 85, far: 900, fogFar: 520, detailRange: 220, detail: .6, waterEvery: 4}),
    Object.freeze({id: 'leve', pixelRatio: 1, shadows: false, shadowSize: 512, carCull: 105, pedCull: 65, far: 650, fogFar: 380, detailRange: 120, detail: 0, waterEvery: 6})
  ]);
  class AdaptiveQuality {
    constructor(options = {}) {
      this.tiers = options.tiers || QUALITY_TIERS; this.tier = 0; this.good = 0; this.upNeeded = options.upNeeded || 4; this.sinceUp = 99; this.cooldown = 0;
      this.emergencyFps = options.emergencyFps || 28; this.lowFps = options.lowFps || 44; this.highFps = options.highFps || 57;
    }
    get current() { return this.tiers[this.tier]; }
    // One call per measured window (about 3 s). Returns the new tier index when it changed.
    evaluate(fps) {
      const before = this.tier; this.sinceUp++; this.cooldown = Math.max(0, this.cooldown - 1);
      const last = this.tiers.length - 1;
      if (fps < this.emergencyFps) { this.tier = last; this.good = 0; }
      else if (fps < this.lowFps && this.tier < last && this.cooldown === 0) { this.tier++; this.good = 0; }
      else if (fps >= this.highFps && this.tier > 0) {
        this.good++;
        if (this.good >= this.upNeeded) { this.tier--; this.good = 0; this.sinceUp = 0; this.cooldown = 2; }
      } else if (fps < this.highFps) this.good = 0;
      if (this.tier > before) {
        this.cooldown = 2;
        // A step down right after a step up means the higher tier is not sustainable: wait longer next time.
        if (this.sinceUp <= 6) this.upNeeded = Math.min(32, this.upNeeded * 2);
      }
      return this.tier !== before ? this.tier : null;
    }
  }

  Object.assign(BN, {radialDeadzone, axisDeadzone, PAD, GamepadInput, InputMode, Prompts, Streets, FixtureRegistry, FIXTURE_KINDS, softPush, planRoadblock, RoadblockManager, AdaptiveQuality, QUALITY_TIERS});
})();
