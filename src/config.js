/* SPDX-License-Identifier: MIT */
window.BN = window.BN || {};
BN.CONFIG = Object.freeze({
  title: 'Baía Neon', seed: 5216, version: '0.4.0',
  citySize: 600, dayLength: 720, introDuration: 18,
  startHour: 17.4, walkSpeed: 5.2, runSpeed: 8.7,
  carSpeed: 32, carReverse: 10, carAcceleration: 14,
  population: 64, traffic: 14, maxPolice: 5,
  policeSight: 60, policeLoseSight: 3, policeSearchTime: 16,
  targetFPS: 60, pixelRatioCap: 1.5,
  landmarks: Object.freeze({
    radio: {id:'radio', name:'Rádio Caju', x:40, z:0},
    market: {id:'market', name:'Mercado Maré Alta', x:240, z:145},
    garage: {id:'garage', name:'Oficina do Canal', x:-74.3, z:40},
    pier: {id:'pier', name:'Píer Farol', x:286, z:-160},
    presenter: {id:'presenter', name:'Dora Dendê', x:240, z:-120},
    technician: {id:'technician', name:'Nando Hertz', x:-160, z:80},
    antenna: {id:'antenna', name:'Antena da Caju', x:80, z:-240},
    archiveNorth: {id:'archive-north', name:'Arquivo do Centro', x:-160, z:-80},
    archiveBeach: {id:'archive-beach', name:'Depósito da Orla', x:240, z:225},
    regularLot: {id:'regular-lot', name:'Estacionamento Solar', x:-9, z:84}
  }),
  // The contract board rotates catalogue entries in groups of three.
  deliveries: Object.freeze([
    {id:'sorvete', family:'delivery', name:'Sorvete em risco', kind:'perishable', px:0, pz:-200, x:240, z:225, reward:260, rep:0, text:'Caixa térmica furada. Cada segundo derrete o pagamento.'},
    {id:'flamingos', family:'delivery', name:'Reunião dos flamingos', kind:'fragile', px:80, pz:-120, x:-240, z:175, reward:300, rep:0, text:'Figurino enorme de plumas. Cada batida arranca um pedaço.'},
    {id:'cafe', family:'delivery', name:'Café depois das seis', kind:'smooth', px:160, pz:120, x:-160, z:-225, reward:240, rep:0, text:'Xícaras cheias. Freada brusca e derrapagem derramam o bônus.'},
    {id:'passageira-orla', family:'passenger', name:'Carona para a Aurora', kind:'smooth', px:-80, pz:160, x:240, z:80, reward:290, rep:2, text:'Passageira a bordo. Condução suave preserva a gorjeta.'},
    {id:'turista-radio', family:'passenger', name:'Ouvinte perdido', kind:'smooth', px:240, pz:-80, x:40, z:0, reward:320, rep:3, text:'O passageiro quer chegar à Rádio Caju sem virar notícia.'},
    {id:'recupera-seda', family:'recovery', name:'Sedã fora de hora', kind:'fragile', px:-9, pz:84, x:-74.3, z:40, reward:360, rep:4, text:'Leve o sedã recuperado à oficina com o mínimo de dano.'},
    {id:'recupera-brisa', family:'recovery', name:'Brisa desaparecido', kind:'fragile', px:244, pz:14, x:-74.3, z:40, reward:430, rep:6, text:'Recupere o esportivo e entregue inteiro. A polícia reage se alguém perceber.'}
  ]),
  races: Object.freeze([
    {id:'volta-centro', name:'Volta do Centro', medals:[58,72,92], points:[[-80,-240],[0,-240],[80,-160],[80,-80],[0,0],[-80,-80],[-80,-240]]},
    {id:'pontes-caju', name:'Circuito das Pontes', medals:[70,88,112], points:[[80,160],[160,160],[240,80],[160,0],[80,-80],[0,0],[80,160]]},
    {id:'aurora', name:'Reta da Aurora', medals:[48,62,82], points:[[240,-240],[240,-160],[240,-80],[240,0],[240,80],[240,160],[240,240]]}
  ]),
  campaign: Object.freeze([
    {id:'voz-atrasada', number:1, title:'A voz chegou atrasada', reward:320, reputation:3, outro:'Dora chegou a tempo de reclamar do trânsito no ar.', steps:[
      {target:'presenter', text:'Entre no carro coral com E e siga o marcador coral até Dora, na Praia Aurora.', requiresCar:true, checkpoint:true, done:'Dora embarcou. “Se esse banco ranger, eu narro ao vivo.”'},
      {target:'radio', text:'Leve Dora à Rádio Caju. Dirija com suavidade.', requiresCar:true}
    ]},
    {id:'carro-radio', number:2, title:'O carro da rádio', reward:380, reputation:4, outro:'O carro voltou para a Caju. A história do documento fica para outro programa.', steps:[
      {target:'regular-lot', text:'Vá ao Estacionamento Solar. A retirada regular custa R$ 120 ou pressione X para assumir o risco.', requiresCar:false, cost:120, checkpoint:true},
      {target:'radio', text:'Leve o carro identificado até a Rádio Caju.', requiresCar:true}
    ]},
    {id:'acervo-ambulante', number:3, title:'Acervo ambulante', reward:460, reputation:5, outro:'Fitas, antenas e uma cafeteira chegaram quase na mesma ordem.', steps:[
      {targets:['archive-north','archive-beach'], text:'Recolha os equipamentos em dois pontos, na ordem que preferir.', requiresCar:true, checkpoint:true},
      {target:'radio', text:'Entregue o acervo na Rádio Caju.', requiresCar:true}
    ]},
    {id:'sinal-por-um-fio', number:4, title:'Sinal por um fio', reward:520, reputation:6, outro:'Nando salvou o sinal com um cabo, fita coral e opinião demais.', steps:[
      {target:'technician', text:'Busque Nando Hertz no Jardim Maré.', requiresCar:true, checkpoint:true},
      {target:'antenna', text:'Leve Nando à antena antes do prazo. Escolha bem a rota.', requiresCar:true, deadline:95}
    ]},
    {id:'ultima-frequencia', number:5, title:'Última frequência', reward:700, reputation:8, outro:'A última transmissão virou a primeira do novo estúdio no Píer Farol.', steps:[
      {target:'radio', text:'Encontre Dora e Nando na Rádio Caju.', requiresCar:true, checkpoint:true},
      {target:'market', text:'Recolha a última caixa no Mercado Maré Alta.', requiresCar:true},
      {target:'pier', text:'Conclua a mudança no estúdio provisório do Píer Farol.', requiresCar:true}
    ]}
  ]),
  garage: {x:-74.3, z:40}
});
