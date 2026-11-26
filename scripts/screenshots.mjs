// Gera os prints dos READMEs (docs/screenshots/*-pt.png e *-en.png).
// Abre a extensão já compilada (dist/) num Edge headless com perfil temporário (apagado no fim)
// e preenche com sites fictícios. Não toca no navegador nem nos dados do usuário.
//
// Uso: npm run screenshots   (compila e gera)
//      node scripts/screenshots.mjs [pasta-de-saída]   (usa o dist/ atual)
// Outro Edge/Chromium: EDGE_PATH="C:/caminho/msedge.exe". O Chrome comum não serve:
// desde a versão 137 ele ignora --load-extension.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const outDir = path.resolve(process.argv[2] ?? path.join(root, 'docs', 'screenshots'));
const browser = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9337;

if (!fs.existsSync(path.join(dist, 'manifest.json'))) throw new Error('dist/ não existe: rode `npm run build` antes.');
if (!fs.existsSync(browser)) throw new Error(`navegador não encontrado: ${browser} (defina EDGE_PATH)`);
fs.mkdirSync(outDir, { recursive: true });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fofu-shots-'));
const edge = spawn(browser, [
  '--headless=new', `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`,
  `--load-extension=${dist}`, `--disable-extensions-except=${dist}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = async (p, method = 'GET') => (await fetch(`http://127.0.0.1:${PORT}${p}`, { method })).json();

/** Cliente mínimo do Chrome DevTools Protocol (WebSocket global do Node 22+). */
async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let n = 0;
  const wait = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((r, j) => {
    const id = ++n;
    wait.set(id, (m) => (m.error ? j(new Error(`${method}: ${m.error.message}`)) : r(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  return { send, close: () => ws.close() };
}

/** Sites fictícios (domínios exemplo.*) cobrindo os status Alterado, Sem mudança e Erro. */
function demoSites(pt) {
  const now = Date.now();
  const min = 60_000;
  const h = 60 * min;
  const base = { selector: '', ignoreVolatile: true, enabled: true, unseen: false, failures: 0, lastError: null, baseText: 'x', baseHash: 'x' };
  return [
    { ...base, id: 's1', url: 'https://loja.exemplo.com/fone-bluetooth', name: pt ? 'Fone Bluetooth — Loja Exemplo' : 'Bluetooth headphones — Example Store', selector: '.preco',
      schedule: { mode: 'fixed', times: ['09:00', '18:00'], days: [0, 1, 2, 3, 4, 5, 6] }, nextRun: now + 3 * h, lastCheck: now - 12 * min, status: 'changed', unseen: true,
      history: [
        { ts: now - 12 * min, omitted: 0, diff: [
          { t: 'del', line: pt ? 'R$ 199,90 à vista' : '$199.90' }, { t: 'add', line: pt ? 'R$ 179,90 à vista' : '$179.90' },
          { t: 'del', line: pt ? 'Últimas 5 unidades' : 'Last 5 units' }, { t: 'add', line: pt ? 'Últimas 2 unidades' : 'Last 2 units' },
        ] },
        { ts: now - 26 * h, omitted: 0, diff: [{ t: 'del', line: pt ? 'Indisponível' : 'Out of stock' }, { t: 'add', line: pt ? 'R$ 199,90 à vista' : '$199.90' }] },
      ] },
    { ...base, id: 's2', url: 'https://concursos.exemplo.org/edital-2026', name: pt ? 'Edital do concurso' : 'Exam announcement', selector: '#resultados',
      schedule: { mode: 'interval', everyMinutes: 30, windowStart: '08:00', windowEnd: '20:00' }, nextRun: now + 18 * min, lastCheck: now - 12 * min, status: 'ok',
      history: [{ ts: now - 3 * 24 * h, omitted: 0, diff: [{ t: 'add', line: pt ? 'Resultado preliminar publicado' : 'Preliminary results published' }] }] },
    { ...base, id: 's3', url: 'https://vagas.exemplo.com/desenvolvedor', name: pt ? 'Vagas de desenvolvedor' : 'Developer jobs', readMode: 'tab', selector: '.lista-vagas',
      schedule: { mode: 'interval', everyMinutes: 60, windowStart: null, windowEnd: null }, nextRun: now + 41 * min, lastCheck: now - 19 * min, status: 'ok', history: [] },
    { ...base, id: 's4', url: 'https://blog.exemplo.net/', name: pt ? 'Blog de notícias' : 'News blog',
      schedule: { mode: 'fixed', times: ['07:30'], days: [1, 2, 3, 4, 5] }, nextRun: now + 14 * h, lastCheck: now - 2 * h,
      status: 'error', failures: 3, lastError: { key: 'errHttp', params: { status: 503 } }, history: [] },
  ];
}

try {
  // O id da extensão vem do service worker do Fofu Watcher (o Edge tem extensões internas também).
  let extId;
  for (let i = 0; i < 60 && !extId; i++) {
    await sleep(500);
    try {
      extId = (await json('/json/list'))
        .map((t) => t.url.match(/^chrome-extension:\/\/([a-p]{32})\/background\/service-worker\.js$/)?.[1])
        .find(Boolean);
    } catch { /* navegador ainda subindo */ }
  }
  if (!extId) throw new Error('a extensão não carregou (o navegador pode estar bloqueando --load-extension)');
  const ext = (p) => `chrome-extension://${extId}/${p}`;

  const target = await json(`/json/new?${ext('options/options.html')}`, 'PUT');
  const c = await cdp(target.webSocketDebuggerUrl);
  await c.send('Page.enable');
  await c.send('Runtime.enable');
  // O perfil temporário nunca concedeu acesso aos sites fictícios; sem isto todo card mostraria
  // "Sem permissão de acesso", que o usuário real não vê (a permissão é pedida ao salvar o site).
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: 'if (globalThis.chrome?.permissions) chrome.permissions.contains = async () => true;' });
  const ev = (expression) => c.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  const viewport = (width, height) => c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });

  /** Abre a página na largura dada e captura a altura inteira do conteúdo (em 2x). */
  async function shot(file, width, url, after = '') {
    await viewport(width, 800);
    await c.send('Page.navigate', { url });
    await sleep(1500);
    if (after) { await ev(after); await sleep(800); }
    await viewport(width, 100); // senão a altura medida nunca fica menor que a janela
    await sleep(300);
    const height = Math.ceil((await ev('document.documentElement.scrollHeight')).result.value);
    await viewport(width, height);
    await sleep(300);
    const { data } = await c.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } });
    fs.writeFileSync(path.join(outDir, file), Buffer.from(data, 'base64'));
    console.log(`ok  ${path.relative(root, path.join(outDir, file))} (${width}x${height})`);
  }

  for (const [lang, suf] of [['pt-BR', 'pt'], ['en-US', 'en']]) {
    await c.send('Page.navigate', { url: ext('options/options.html') });
    await sleep(1000);
    const data = { sites: demoSites(lang === 'pt-BR'), settings: { language: lang, hourFormat: '24', sound: true, dndEnabled: true, dndStart: '22:00', dndEnd: '07:00' } };
    // Sem alarms: nenhuma verificação de verdade roda enquanto os prints são tirados.
    await ev(`chrome.alarms.clearAll().then(() => chrome.storage.local.set(${JSON.stringify(data)}))`);
    await shot(`popup-${suf}.png`, 400, ext('popup/popup.html'));
    await shot(`sites-${suf}.png`, 1000, ext('options/options.html'));
    await shot(`history-${suf}.png`, 1000, ext('options/options.html'), `document.querySelector('.tab[data-tab=history]').click()`);
  }
  c.close();
} finally {
  edge.kill();
  await sleep(1000);
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
