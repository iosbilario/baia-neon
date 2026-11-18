/* SPDX-License-Identifier: MIT */
(function () {
  'use strict';
  const BN = window.BN = window.BN || {};
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  function nearestNode(point, roads) {
    let best = null;
    for (const x of roads) for (const z of roads) {
      const candidate = {x, z}, score = distance(point, candidate);
      if (!best || score < best.score) best = {...candidate, score};
    }
    return {x: best.x, z: best.z};
  }
  function snapToRoad(point, roads) {
    const nearestX = roads.reduce((best, value) => Math.abs(value - point.x) < Math.abs(best - point.x) ? value : best, roads[0]);
    const nearestZ = roads.reduce((best, value) => Math.abs(value - point.z) < Math.abs(best - point.z) ? value : best, roads[0]);
    return Math.abs(nearestX - point.x) <= Math.abs(nearestZ - point.z) ? {x: nearestX, z: point.z} : {x: point.x, z: nearestZ};
  }
  function route(start, destination, roads, streets) {
    if (streets && streets.route) return streets.route(start, destination);
    if (!start || !destination || !Array.isArray(roads) || !roads.length) return [];
    const roadStart = snapToRoad(start, roads), roadEnd = snapToRoad(destination, roads);
    const first = nearestNode(roadStart, roads), last = nearestNode(roadEnd, roads);
    const nodes = roads.flatMap((x, ix) => roads.map((z, iz) => ({x, z, ix, iz, key: ix + ':' + iz})));
    const byKey = new Map(nodes.map(node => [node.key, node]));
    const open = new Set(nodes.map(node => node.key)), costs = new Map(), previous = new Map();
    nodes.forEach(node => costs.set(node.key, Infinity));
    const startNode = nodes.find(node => node.x === first.x && node.z === first.z);
    const endNode = nodes.find(node => node.x === last.x && node.z === last.z);
    costs.set(startNode.key, 0);
    while (open.size) {
      let current = null;
      for (const key of open) if (!current || costs.get(key) < costs.get(current)) current = key;
      if (current === endNode.key || costs.get(current) === Infinity) break;
      open.delete(current);
      const node = byKey.get(current);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const neighbour = byKey.get((node.ix + dx) + ':' + (node.iz + dz));
        if (!neighbour || !open.has(neighbour.key)) continue;
        const score = costs.get(current) + distance(node, neighbour);
        if (score < costs.get(neighbour.key)) { costs.set(neighbour.key, score); previous.set(neighbour.key, current); }
      }
    }
    const path = [];
    let cursor = endNode.key;
    while (cursor) { path.unshift(byKey.get(cursor)); if (cursor === startNode.key) break; cursor = previous.get(cursor); }
    const points = [roadStart, ...path.map(({x, z}) => ({x, z})), roadEnd];
    return points.filter((point, index) => index === 0 || distance(point, points[index - 1]) > 0.1);
  }
  BN.Navigation = Object.freeze({nearestNode, snapToRoad, route});
})();
