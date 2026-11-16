/* SPDX-License-Identifier: MIT */
(function () {
  'use strict';
  const BN = window.BN = window.BN || {};
  class Campaign {
    constructor(definitions, saved) {
      this.definitions = definitions;
      this.state = saved;
      this.lastEvent = null;
      if (!this.state.active && definitions.length) this.state.active = definitions[0].id;
    }
    definition() { return this.definitions.find(item => item.id === this.state.active) || null; }
    step() { const mission = this.definition(); return mission && mission.steps[this.state.step] || null; }
    objective() {
      const mission = this.definition(), step = this.step();
      if (!mission || this.state.status === 'finished') return null;
      if (this.state.status === 'failed') return {mission, failed: true, text: 'A missão falhou. Pressione Y para tentar de novo.'};
      return {mission, step, text: step.text, targets: step.targets || [step.target]};
    }
    tick(dt, context) {
      if (this.state.status !== 'active') return null;
      this.state.elapsed += dt;
      const step = this.step();
      if (context && context.roughness) this.state.comfort = Math.max(0, this.state.comfort - context.roughness * dt);
      if (context && context.damage) this.state.damage = Math.max(this.state.damage, context.damage);
      if (step && step.deadline && this.state.elapsed > step.deadline) return this.fail('o prazo acabou');
      return null;
    }
    arrive(targetId, context) {
      if (this.state.status !== 'active') return null;
      const mission = this.definition(), step = this.step();
      if (!mission || !step) return null;
      const targets = (step.targets || [step.target]).filter(Boolean);
      if (!targets.includes(targetId)) return null;
      if (step.requiresCar && !(context && context.hasCar)) return {type: 'blocked', message: 'Você precisa de um carro para continuar.'};
      if (step.cost && !(context && context.ignoreCost) && (!context || context.balance < step.cost)) return {type: 'blocked', message: 'Faltam R$ ' + (step.cost - (context ? context.balance : 0)) + ' para a retirada regular.'};
      if (step.targets) {
        if (!this.state.collected.includes(targetId)) this.state.collected.push(targetId);
        if (step.targets.some(id => !this.state.collected.includes(id))) return this.event('progress', 'Ponto recolhido. Falta mais um.', {targetId});
        this.state.collected = [];
      }
      if (step.checkpoint) this.state.checkpoint = Math.min(this.state.step + 1, mission.steps.length - 1);
      const spent = context && context.ignoreCost ? 0 : (step.cost || 0);
      this.state.step += 1;
      this.state.elapsed = 0;
      if (this.state.step < mission.steps.length) return this.event('step', step.done || 'Etapa concluída.', {spent, targetId});
      return this.completeMission(mission, context || {});
    }
    completeMission(mission, context) {
      const firstCompletion = !this.state.rewarded.includes(mission.id);
      const quality = Math.max(0.55, this.state.comfort / 100) * Math.max(0.6, 1 - this.state.damage / 250);
      const reward = firstCompletion ? Math.round(mission.reward * quality) : 0;
      if (!this.state.completed.includes(mission.id)) this.state.completed.push(mission.id);
      if (firstCompletion) this.state.rewarded.push(mission.id);
      const reputation = firstCompletion ? mission.reputation : 0;
      const index = this.definitions.indexOf(mission), next = this.definitions[index + 1];
      this.state.active = next ? next.id : mission.id;
      this.state.step = 0; this.state.checkpoint = 0; this.state.elapsed = 0; this.state.comfort = 100; this.state.damage = 0;
      this.state.status = next ? 'active' : 'finished';
      return this.event(next ? 'mission-complete' : 'campaign-complete', mission.outro, {reward, reputation, firstCompletion, next: next && next.id});
    }
    fail(reason) {
      this.state.status = 'failed'; this.state.delays += 1;
      return this.event('failed', 'Missão perdida: ' + reason + '.', {reason});
    }
    retry() {
      if (this.state.status !== 'failed') return null;
      this.state.status = 'active'; this.state.step = this.state.checkpoint; this.state.elapsed = 0; this.state.comfort = 100; this.state.damage = 0; this.state.collected = [];
      return this.event('retry', 'Checkpoint retomado.', {});
    }
    event(type, message, extra) { return this.lastEvent = {type, message, ...extra}; }
  }
  BN.Campaign = Campaign;
})();
