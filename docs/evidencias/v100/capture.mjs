// Captura de evidencias da v1.0.0 com Chrome headless e protocolo CDP (sem dependencias).
// Uso: node docs/evidencias/v100/capture.mjs [JOGAR_OFFLINE.html|index.html]
import {spawn} from 'node:child_process';
import {writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../../..');
const target = resolve(root, process.argv[2] || 'JOGAR_OFFLINE.html');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 400);
const scratch = process.env.KIROCREW_SCRATCH;
if (!scratch) throw new Error('Defina KIROCREW_SCRATCH antes de capturar evidências.');
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--remote-debugging-port=' + port, '--user-data-dir=' + scratch + '/bn-chrome-' + port,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run', '--mute-audio', '--autoplay-policy=no-user-gesture-required', 'about:blank'], {stdio: 'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = {target: target.replace(root + '/', ''), shots: [], notes: [], network: [], errors: []};

async function connect() {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {method: 'PUT'}); const p = await r.json(); if (p.webSocketDebuggerUrl) return p.webSocketDebuggerUrl; } catch (_) {} await sleep(250); }
  throw new Error('chrome did not start');
}
const ws = new WebSocket(await connect()); await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map(), handlers = [];
ws.addEventListener('close', () => { console.error('ws closed'); });
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const {res, rej} = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } else handlers.forEach(h => h(m)); });
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, {res, rej}); ws.send(JSON.stringify({id: i, method, params})); });
handlers.push(m => {
  if (m.method === 'Network.requestWillBeSent') { const u = m.params.request.url; if (!/^(file|data|blob|about):/.test(u)) report.network.push(u); }
  if (m.method === 'Inspector.targetCrashed') { report.fatal = 'renderer crashed after ' + report.shots.length + ' shots'; writeFileSync(resolve(here, 'relatorio.json'), JSON.stringify(report, null, 2)); console.error(report.fatal); chrome.kill(); process.exit(2); }
  if (m.method === 'Runtime.exceptionThrown') report.errors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
});
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
const ev = async (expression) => { const r = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text); return r.result.value; };
async function shot(name, note) { console.log('shot', name); await sleep(450); const r = await send('Page.captureScreenshot', {format: 'png'}); writeFileSync(resolve(here, name + '.png'), Buffer.from(r.data, 'base64')); report.shots.push({file: name + '.png', note}); }
async function open(label, {w = 1280, h = 800, touch = false, query = ''} = {}) {
  await send('Emulation.setDeviceMetricsOverride', {width: w, height: h, deviceScaleFactor: 1, mobile: touch});
  await send('Emulation.setTouchEmulationEnabled', {enabled: touch});
  const pageUrl=pathToFileURL(target).href+'?test=1'+query+'&shot='+encodeURIComponent(label);
  await send('Page.navigate', {url: pageUrl});
  let ready=false;
  for (let i = 0; i < 100; i++) {
    ready=await ev(`location.href===${J(pageUrl)}&&document.readyState==='complete'&&Boolean(window.BN&&BN.debug)`).catch(() => false);
    if(ready)break;
    await sleep(200);
  }
  if(!ready)throw new Error('page did not become ready: '+label);
  await ev(`window.__fast=(t)=>{const r=BN.debug.renderer,o=r.render;r.render=()=>{};try{BN.debug.step(t);}finally{r.render=o;}r.render(BN.debug.scene,BN.debug.camera);};true`);
  await ev(`(()=>{BN.debug.keepFocus=true;BN.debug.setHour(17.5);BN.debug.setRain(0);BN.debug.skipIntro();document.getElementById('play').click();for(const id of ['help']){const e=document.getElementById(id);if(e)e.classList.add('hidden');}__fast(1);return BN.debug.getMode();})()`).then(m => { if (m !== 'play') throw new Error('mode ' + m); });
  writeFileSync(resolve(here, 'relatorio.json'), JSON.stringify(report, null, 2));
  report.notes.push('cena ' + label + ': ' + w + 'x' + h + (touch ? ' toque/paisagem' : ''));
}
const J = JSON.stringify;
async function main() {
  // 1. PC
  await open('pc');
  await ev(`__fast(2)`); await shot('01-pc-a-pe', 'PC 1280x800, a pe, HUD de teclado');
  const st0 = J(await ev(`JSON.stringify(BN.debug.getState())`));
  report.state_pc = JSON.parse(JSON.parse(st0));
  // 2. celular
  await open('celular', {w: 844, h: 390, touch: true, query: '&touch=1'});
  await ev(`__fast(7)`); await shot('02-celular-paisagem-a-pe', 'Celular 844x390 paisagem, controles de toque a pe e objetivo recolhido');
  await ev(`(()=>{BN.debug.teleport(5.7,17);BN.debug.enterExit();__fast(2);})()`);
  await shot('03-celular-paisagem-no-carro', 'Celular paisagem, no carro');
  // 3. gamepad simulado
  await open('gamepad');
  await ev(`(()=>{const pad={id:'Evidence Pad (STANDARD GAMEPAD)',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};window.__pad=pad;navigator.getGamepads=()=>[pad];return true;})()`);
  await ev(`(()=>{window.__pad.axes[0]=.6;window.__pad.axes[1]=-.8;window.__pad.buttons[10]={pressed:true,touched:true,value:1};__fast(1);return true;})()`);
  await ev(`(()=>{window.__pad.buttons[10]={pressed:false,value:0};window.__pad.axes[0]=0;window.__pad.axes[1]=0;__fast(1);BN.debug.teleport(5.7,17);BN.debug.enterExit();__fast(1);window.__pad.buttons[7]={pressed:true,touched:true,value:1};window.__pad.axes[0]=.3;__fast(3);return true;})()`);
  const gp = await ev(`JSON.stringify({mode:BN.debug.inputMode.mode,connected:BN.debug.gamepad.state.connected,speed:BN.debug.getState().player.speed,driving:BN.debug.getState().player.driving})`);
  report.gamepad = JSON.parse(gp);
  await shot('04-gamepad-simulado-dirigindo', 'Gamepad injetado (navigator.getGamepads): RT acelera, prompts de controle. Estado: ' + gp);
  // 4. transito
  await open('transito');
  await ev(`(()=>{BN.debug.teleport(5.7,17);BN.debug.enterExit();BN.debug.setYaw(Math.PI);__fast(8);return true;})()`);
  await shot('05-transito-carro', 'Transito e ruas de sentido unico (setas no asfalto) vistos do carro');
  // 5. bloqueio policial
  await open('bloqueio');
  const rb = await ev(`(()=>{BN.debug.teleport(5.7,17);BN.debug.enterExit();for(let i=0;i<8;i++)BN.debug.crime();__fast(3);const p=BN.debug.player;BN.debug.roadblocks.cooldown=0;BN.debug.roadblocks.update(.1,{level:Math.max(3,BN.debug.police.level),state:'chase',driving:true,target:{x:p.x,z:p.z-40},dir:{x:0,z:1}});const b=BN.debug.roadblocks.blocks[0];if(b){BN.debug.teleport(b.x,b.z+22);BN.debug.setYaw(0);}__fast(.3);return JSON.stringify({built:BN.debug.roadblocks.blocks.length,level:BN.debug.police.level,state:BN.debug.police.state,forced:true,driving:BN.debug.getState().player.driving});})()`);
  report.roadblock = JSON.parse(rb);
  await ev(`__fast(.5)`); await shot('06-bloqueio-policial', 'Bloqueio policial atravessando a rua. Estado: ' + rb);
  // 6. combate dentro do carro
  await open('combate-carro');
  await ev(`(()=>{BN.debug.teleport(5.7,17);BN.debug.enterExit();BN.debug.loadout.unlock('smg');BN.debug.switchWeapon(0,1);__fast(1);for(let i=0;i<4;i++){BN.debug.fire();__fast(.12);}return true;})()`);
  const cb = await ev(`JSON.stringify({weapon:BN.debug.getState().player.weapon,ammo:BN.debug.getState().player.ammo,driving:BN.debug.getState().player.driving})`);
  report.combat = JSON.parse(cb);
  await shot('07-combate-dentro-do-carro', 'Tiro de dentro do carro. Estado: ' + cb);
  // 7. capotamento
  await open('capotamento');
  await ev(`(()=>{BN.debug.teleport(5.7,17);BN.debug.enterExit();const c=BN.debug.player.car;c.speed=22;c.roll.begin(1,1.2);BN.debug.startRollover(c);__fast(.3);return true;})()`);
  const ro = await ev(`JSON.stringify({roll:BN.debug.getState().player.roll})`);
  report.rollover = JSON.parse(ro);
  await shot('08-capotamento', 'Capotamento arcade em andamento. Estado: ' + ro);
  // 8. interiores
  for (const [i, key] of ['radio', 'garage', 'market', 'pier'].entries()) {
    await open('interior-' + key);
    const r = await ev(`(()=>{const d=BN.Interiors.DEFS['${key}'];BN.debug.teleport(d.door.x+.5,d.door.z);BN.debug.contextAction();__fast(1.2);const poses={radio:{x:0,z:1,yaw:-Math.PI/2},garage:{x:0,z:2.2,yaw:Math.PI},market:{x:0,z:1.2,yaw:0},pier:{x:0,z:1,yaw:-Math.PI/2}},pose=poses['${key}'],at=BN.Interiors.toWorld(d,pose);BN.debug.teleport(at.x,at.z);BN.debug.setYaw(pose.yaw);__fast(.8);const s=BN.debug.getState();return JSON.stringify({interior:s.interior});})()`);
    report.notes.push('interior ' + key + ': ' + r);
    await ev(`__fast(.6)`); await shot('09-interior-' + (i + 1) + '-' + key, 'Interior ' + key + '. Estado: ' + r);
  }
  report.final_errors = report.errors.length; report.network_requests = report.network.length;
  writeFileSync(resolve(here, 'relatorio.json'), JSON.stringify(report, null, 2));
}
try { await main(); } catch (e) { report.fatal = String(e.stack || e); writeFileSync(resolve(here, 'relatorio.json'), JSON.stringify(report, null, 2)); console.error(e); }
finally { try { ws.close(); } catch (_) {} chrome.kill(); setTimeout(() => process.exit(0), 300); }
