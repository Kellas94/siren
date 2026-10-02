import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export async function launchDesktop({ root = resolve('.'), executable = resolve(root, 'node_modules/electron/dist/electron.exe'), packaged = false, extraArgs = [] } = {}) {
  const socket = createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const child = spawn(executable, [...(packaged ? [] : [root]), `--remote-debugging-port=${port}`, ...extraArgs], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; let exited = false;
  child.on('error', error => { exited = true; logs += `\nOwned Electron launch failed: ${error.code}`; });
  child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; }); child.on('exit', () => { exited = true; });
  let target; let lastDiscovery = null;
  try {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (exited) throw new Error('Electron exited before driver attachment: ' + logs.slice(-4000));
      try { lastDiscovery = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })).json(); target = lastDiscovery.find(t => t.type === 'page' && t.url === 'siren://app/app.html'); } catch (error) { lastDiscovery = { error: error.message }; }
      if (target) break;
      await delay(200);
    }
    if (!target) throw new Error('No owned Electron page: ' + logs.slice(-4000) + '\nDiscovery: ' + JSON.stringify(lastDiscovery));
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    let serial = 0; const pending = new Map(); const events = [];
    ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id) { const p = pending.get(m.id); if (p) { clearTimeout(p.timer); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } }
      else events.push(m);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 20000);
      pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
    });
    await send('Runtime.enable'); await send('Page.enable');
    const evaluate = async expression => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
      return r.result.value;
    };
    const waitFor = async expression => {
      const until = Date.now() + 30000;
      while (Date.now() < until) { if (await evaluate(expression)) return; await delay(100); }
      throw new Error('UI condition not met: ' + expression);
    };
    const screenshot = async path => { const r = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path, Buffer.from(r.data, 'base64')); };
    const click = async selector => {
      const point = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing control'); const r=e.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2;const h=document.elementFromPoint(x,y);return {x,y,hit:r.width>0&&r.height>0&&e.contains(h),cover:h?.id||h?.className||h?.tagName};})()`);
      if (!point.hit) throw new Error('Occluded control: ' + selector + ' by ' + point.cover);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    };
    return { pid: child.pid, send, evaluate, waitFor, screenshot, click, events, logs: () => logs,
      close: async () => { ws.close(); if (!exited) { child.kill(); await Promise.race([new Promise(r => child.once('exit', r)), delay(5000)]); } } };
  } catch (error) { if (!exited) child.kill(); throw error; }
}
