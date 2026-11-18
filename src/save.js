/* SPDX-License-Identifier: MIT */
(function () {
  'use strict';
  const BN = window.BN = window.BN || {};
  const SCHEMA_VERSION = 2;
  const KEY = 'baia-neon-save-v2';
  const LEGACY_KEY = 'baia-neon-save';
  const BACKUP_KEY = 'baia-neon-save-backup-v1';
  const finite = (value, fallback, min, max) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };
  const cleanStrings = (value, allowed) => Array.isArray(value) ? [...new Set(value.filter(item => allowed.includes(item)))] : [];
  function normalize(raw, catalogues) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const vehicles = catalogues.vehicles || ['compact'];
    const upgrades = catalogues.upgrades || [];
    const campaignIds = catalogues.campaignIds || [];
    const owned = cleanStrings(source.owned, vehicles);
    if (!owned.includes('compact')) owned.unshift('compact');
    const selected = vehicles.includes(source.car) && owned.includes(source.car) ? source.car : 'compact';
    const upgradeState = {};
    upgrades.forEach(key => { upgradeState[key] = Boolean(source.upgrades && source.upgrades[key]); });
    // Additive since v1.0: weapons the player owns and their magazines. Older saves simply have none.
    const weaponIds = catalogues.weapons || ['pistol'];
    const rawArsenal = source.arsenal && typeof source.arsenal === 'object' ? source.arsenal : {};
    const weaponOwned = cleanStrings(rawArsenal.owned, weaponIds);
    if (!weaponOwned.includes('pistol')) weaponOwned.unshift('pistol');
    const weaponMags = {};
    weaponIds.forEach(id => {
      const m = rawArsenal.mags && rawArsenal.mags[id] && typeof rawArsenal.mags[id] === 'object' ? rawArsenal.mags[id] : {};
      weaponMags[id] = {ammo: finite(m.ammo, id === 'pistol' ? finite(source.ammo, 12, 0, 12) : 0, 0, 99), reserve: finite(m.reserve, id === 'pistol' ? finite(source.reserve, 36, 0, 240) : 0, 0, 300)};
    });
    // Additive since v1.0 "Portas Abertas": interiors visited and tasks done. Older saves simply have none.
    const interiorIds = catalogues.interiorIds || [];
    const rawInteriors = source.interiors && typeof source.interiors === 'object' ? source.interiors : {};
    const interiorDone = {};
    if (rawInteriors.done && typeof rawInteriors.done === 'object') Object.keys(rawInteriors.done).forEach(key => { if (interiorIds.includes(key.split(':')[0]) && /^[a-z]+:[a-z-]+$/.test(key)) interiorDone[key] = finite(rawInteriors.done[key], 0, 0, 9999); });
    const campaign = source.campaign && typeof source.campaign === 'object' ? source.campaign : {};
    return {
      schemaVersion: SCHEMA_VERSION,
      balance: finite(source.balance, 0, 0, 10000000),
      completed: finite(source.completed, 0, 0, 1000000),
      upgrades: upgradeState,
      owned,
      car: selected,
      ammo: finite(source.ammo, 12, 0, 12),
      reserve: finite(source.reserve, 36, 0, 240),
      arsenal: {owned: weaponOwned, current: weaponOwned.includes(rawArsenal.current) ? rawArsenal.current : 'pistol', mags: weaponMags},
      grenades: finite(source.grenades, 2, 0, 9),
      health: finite(source.health, 100, 25, 100),
      reputation: finite(source.reputation, 0, 0, 999),
      campaign: {
        active: campaignIds.includes(campaign.active) ? campaign.active : (campaignIds[0] || null),
        step: finite(campaign.step, 0, 0, 99),
        checkpoint: finite(campaign.checkpoint, 0, 0, 99),
        status: ['active', 'failed', 'complete', 'finished'].includes(campaign.status) ? campaign.status : 'active',
        completed: cleanStrings(campaign.completed, campaignIds),
        rewarded: cleanStrings(campaign.rewarded, campaignIds),
        collected: Array.isArray(campaign.collected) ? [...new Set(campaign.collected.filter(v => typeof v === 'string'))] : [],
        elapsed: finite(campaign.elapsed, 0, 0, 86400),
        comfort: finite(campaign.comfort, 100, 0, 100),
        damage: finite(campaign.damage, 0, 0, 1000),
        delays: finite(campaign.delays, 0, 0, 99)
      },
      interiors: {visited: cleanStrings(rawInteriors.visited, interiorIds), done: interiorDone},
      raceRecords: source.raceRecords && typeof source.raceRecords === 'object' ? source.raceRecords : {},
      tutorialSeen: Boolean(source.tutorialSeen),
      cameraMotion: source.cameraMotion !== false,
      audioVolume: finite(source.audioVolume, 0.3, 0, 1),
      savedAt: typeof source.savedAt === 'string' ? source.savedAt : null
    };
  }
  function load(storage, catalogues) {
    let source = null, migrated = false;
    try {
      const current = storage.getItem(KEY);
      if (current) source = JSON.parse(current);
      if (!source) {
        const legacy = storage.getItem(LEGACY_KEY);
        if (legacy) {
          if (!storage.getItem(BACKUP_KEY)) storage.setItem(BACKUP_KEY, legacy);
          source = JSON.parse(legacy);
          migrated = true;
        }
      }
    } catch (_) { source = null; }
    const data = normalize(source, catalogues);
    if (migrated) persist(storage, data);
    return {data, migrated};
  }
  function persist(storage, data) {
    const next = {...data, schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString()};
    storage.setItem(KEY, JSON.stringify(next));
    return next;
  }
  function exportProgress(data, build) {
    return JSON.stringify({format: 'baia-neon-progress', schemaVersion: SCHEMA_VERSION, build, progress: normalize(data, {
      vehicles: ['compact', 'sedan', 'sport'], upgrades: ['brakes', 'tires', 'cargo'],
      weapons: ['pistol', 'smg', 'shotgun'], campaignIds: ['voz-atrasada', 'carro-radio', 'acervo-ambulante', 'sinal-por-um-fio', 'ultima-frequencia', 'portas-abertas', 'peca-do-canal', 'luz-do-farol'], interiorIds: ['radio', 'garage', 'market', 'pier']
    })}, null, 2);
  }
  function importProgress(text, catalogues) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (_) { throw new Error('O arquivo não contém JSON válido.'); }
    if (!parsed || parsed.format !== 'baia-neon-progress' || !parsed.progress) throw new Error('Este arquivo não é um progresso do Baía Neon.');
    if (Number(parsed.schemaVersion) > SCHEMA_VERSION) throw new Error('Este progresso foi criado por uma versão mais nova do jogo.');
    return normalize(parsed.progress, catalogues);
  }
  BN.Save = Object.freeze({SCHEMA_VERSION, KEY, LEGACY_KEY, BACKUP_KEY, normalize, load, persist, exportProgress, importProgress});
})();
