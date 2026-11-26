// Gera as imagens das lojas (Chrome Web Store e Microsoft Edge Add-ons) em store/images/:
//   screenshot-N-pt|en.png (1280×800), promo-440x280-pt|en.png e logo-300.png.
// Monta cada imagem a partir dos prints dos READMEs (docs/screenshots/, gerados por
// `npm run screenshots`) e a fotografa num Edge headless. Não usa a extensão nem dados reais.
//
// Uso: npm run store-images   ·   Outro Edge/Chromium: EDGE_PATH="C:/caminho/msedge.exe"
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeIcon } from './icon.mjs';

const root = path.resolve(import.meta.dirname, '..');
const shots = path.join(root, 'docs', 'screenshots');
const out = path.join(root, 'store', 'images');
const browser = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
if (!fs.existsSync(browser)) throw new Error(`navegador não encontrado: ${browser} (defina EDGE_PATH)`);
fs.mkdirSync(out, { recursive: true });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fofu-store-'));
const iconFile = path.join(tmp, 'icon.png');
fs.writeFileSync(iconFile, makeIcon(256));
fs.writeFileSync(path.join(out, 'logo-300.png'), makeIcon(300));
console.log('ok  store/images/logo-300.png (300x300)');

const img = (file) => pathToFileURL(path.join(shots, file)).href;
const icon = pathToFileURL(iconFile).href;

const text = {
  pt: {
    s1: ['Monitore qualquer site', 'Preço, estoque, edital, vagas: escolha a parte da página e a agenda.'],
    s2: ['Veja exatamente o que mudou', 'O histórico mostra as linhas removidas e adicionadas em cada mudança.'],
    s3: ['Tudo pelo ícone da barra', 'Status de cada site, "Verificar agora" e "Adicionar esta página".'],
    promo: ['Avisa quando um site muda', 'Tudo local, sem telemetria'],
  },
  en: {
    s1: ['Monitor any website', 'Prices, stock, announcements, jobs: pick the part of the page and the schedule.'],
    s2: ['See exactly what changed', 'The history shows the removed and added lines of every change.'],
    s3: ['Everything from the toolbar', 'Status of each site, "Check now" and "Add this page".'],
    promo: ['Get notified when a site changes', 'Fully local, no telemetry'],
  },
};

const css = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #fff;
         background: radial-gradient(circle at 20% 0%, #6366f1 0%, #4338ca 45%, #1e1b4b 100%); }
  .slide { display: flex; flex-direction: column; align-items: center; height: 100%; padding: 44px 56px 0; }
  h1 { font-size: 46px; font-weight: 700; letter-spacing: -0.5px; }
  p { font-size: 22px; opacity: .85; margin-top: 10px; }
  .stage { flex: 1; min-height: 0; width: 100%; display: flex; justify-content: center; align-items: flex-start; gap: 36px; margin-top: 34px; }
  .stage img { border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.45); max-height: 100%; }
  .row { display: flex; align-items: center; gap: 18px; }
`;

const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;
const slide = ([title, sub], stage) => page(`<div class="slide"><h1>${title}</h1><p>${sub}</p><div class="stage">${stage}</div></div>`);

function render(name, html, width, height) {
  const file = path.join(tmp, `${name}.html`);
  fs.writeFileSync(file, html);
  const dest = path.join(out, `${name}.png`);
  const r = spawnSync(browser, [
    '--headless=new', `--user-data-dir=${path.join(tmp, 'profile')}`, '--hide-scrollbars', '--force-device-scale-factor=1',
    '--allow-file-access-from-files', `--window-size=${width},${height}`, `--screenshot=${dest}`, pathToFileURL(file).href,
  ], { stdio: 'ignore', timeout: 60_000 });
  if (r.status !== 0 || !fs.existsSync(dest)) throw new Error(`falha ao gerar ${name}.png`);
  console.log(`ok  store/images/${name}.png (${width}x${height})`);
}

try {
  for (const lang of ['pt', 'en']) {
    const t = text[lang];
    render(`screenshot-1-${lang}`, slide(t.s1, `<img src="${img(`sites-${lang}.png`)}" style="width:1000px">`), 1280, 800);
    render(`screenshot-2-${lang}`, slide(t.s2, `<img src="${img(`history-${lang}.png`)}" style="width:1080px">`), 1280, 800);
    render(`screenshot-3-${lang}`, slide(t.s3, `<img src="${img(`popup-${lang}.png`)}" style="width:420px">`), 1280, 800);
    render(`promo-440x280-${lang}`, page(`
      <div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 30px">
        <div class="row"><img src="${icon}" style="width:64px;height:64px"><h1 style="font-size:34px">Fofu Watcher</h1></div>
        <p style="font-size:21px;margin-top:16px;opacity:1;font-weight:600">${t.promo[0]}</p>
        <p style="font-size:16px;margin-top:4px">${t.promo[1]}</p>
      </div>`), 440, 280);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
