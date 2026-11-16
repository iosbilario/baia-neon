/* SPDX-License-Identifier: MIT */
window.BN = window.BN || {};
BN.CONFIG = Object.freeze({
  title: 'Baía Neon', seed: 5216, version: '0.1.0',
  citySize: 600, dayLength: 720, introDuration: 18,
  startHour: 17.4, walkSpeed: 5.2, runSpeed: 8.7,
  carSpeed: 32, carReverse: 10, carAcceleration: 14,
  population: 64, traffic: 14, maxPolice: 5,
  policeSight: 60, policeLoseSight: 3, policeSearchTime: 16,
  targetFPS: 60, pixelRatioCap: 1.5,
  // Each contract has a pickup, a destination and its own cargo rule.
  deliveries: [
    { name: 'Sorvete em risco', kind: 'perishable', px: 0, pz: -200, x: 240, z: 225, reward: 260, text: 'Caixa térmica furada. Cada segundo derrete o pagamento.' },
    { name: 'Reunião dos flamingos', kind: 'fragile', px: 80, pz: -120, x: -240, z: 175, reward: 300, text: 'Figurino enorme de plumas. Cada batida arranca um pedaço.' },
    { name: 'Café depois das seis', kind: 'smooth', px: 160, pz: 120, x: -160, z: -225, reward: 240, text: 'Xícaras cheias. Freada brusca e derrapagem derramam o bônus.' }
  ],
  garage: { x: -74.3, z: 40 }
});
