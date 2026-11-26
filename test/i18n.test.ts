import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { errorText, interpolate, makeTranslator, resolveHour12, resolveLanguage, type Messages } from '../src/utils/i18n';
import {
  computeNextRun, describeSchedule, formatDateTime, formatHM, from12h, to12h, weekdayShort, type TimeFormat,
} from '../src/utils/time';

const loadMessages = (dir: string): Messages => JSON.parse(fs.readFileSync(path.join('_locales', dir, 'messages.json'), 'utf8'));
const PT = loadMessages('pt_BR');
const EN = loadMessages('en_US');
const tPt = makeTranslator(PT);
const tEn = makeTranslator(EN);
const F = {
  pt24: { locale: 'pt-BR', hour12: false },
  en12: { locale: 'en-US', hour12: true },
  pt12: { locale: 'pt-BR', hour12: true },
  en24: { locale: 'en-US', hour12: false },
} satisfies Record<string, TimeFormat>;
const norm = (x: string) => x.replace(/\s/g, ' ');
let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

t('resumo da regra (pt-BR, 24h)', () => {
  assert.equal(describeSchedule({ mode: 'interval', everyMinutes: 90, windowStart: '08:00', windowEnd: '20:00' }, tPt, F.pt24), 'A cada 1 h 30 min, entre 08:00 e 20:00');
  assert.equal(describeSchedule({ mode: 'fixed', times: ['13:00', '09:00'], days: [1, 3] }, tPt, F.pt24), 'Às 09:00, 13:00 — seg, qua');
  assert.equal(describeSchedule({ mode: 'fixed', times: ['09:00'], days: [] }, tPt, F.pt24), 'Às 09:00 — todos os dias');
});
t('resumo da regra (en-US, 12h)', () => {
  assert.equal(norm(describeSchedule({ mode: 'interval', everyMinutes: 120, windowStart: '08:00', windowEnd: '20:00' }, tEn, F.en12)), 'Every 2 h, between 8:00 AM and 8:00 PM');
  assert.equal(norm(describeSchedule({ mode: 'fixed', times: ['18:00', '09:00'], days: [1, 3] }, tEn, F.en12)), 'At 9:00 AM, 6:00 PM — Mon, Wed');
});
t('resumo da regra: formato de hora independe do idioma', () => {
  assert.equal(norm(describeSchedule({ mode: 'fixed', times: ['18:00'], days: [] }, tPt, F.pt12)), 'Às 6:00 PM — todos os dias');
  assert.equal(describeSchedule({ mode: 'fixed', times: ['18:00'], days: [] }, tEn, F.en24), 'At 18:00 — every day');
});

t('formatHM: 24h e 12h, inclusive meia-noite e meio-dia', () => {
  assert.equal(formatHM('18:00', F.pt24), '18:00');
  assert.equal(formatHM('00:05', F.pt24), '00:05');
  assert.equal(norm(formatHM('18:00', F.en12)), '6:00 PM');
  assert.equal(norm(formatHM('00:00', F.en12)), '12:00 AM');
  assert.equal(norm(formatHM('12:30', F.en12)), '12:30 PM');
  assert.equal(formatHM('00:00', F.en24), '00:00');
});
t('formatDateTime: respeita locale e 12h/24h; null vira traço', () => {
  const ts = new Date('2026-03-04T18:05:00').getTime();
  assert.equal(norm(formatDateTime(ts, F.pt24)), '04/03/2026, 18:05');
  assert.equal(norm(formatDateTime(ts, F.en12)), '03/04/2026, 6:05 PM');
  assert.equal(formatDateTime(null, F.pt24), '—');
});
t('weekdayShort por idioma', () => {
  assert.equal(weekdayShort(0, F.pt24), 'dom');
  assert.equal(weekdayShort(0, F.en12), 'Sun');
});
t('to12h/from12h: ida e volta preserva TODOS os 1440 horários (nunca corrompe o storage)', () => {
  for (let m = 0; m < 1440; m++) {
    const hm = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const p = to12h(hm);
    assert.ok(p.hour >= 1 && p.hour <= 12);
    assert.equal(from12h(p.hour, p.minute, p.pm), hm);
  }
  assert.deepEqual(to12h('00:00'), { hour: 12, minute: 0, pm: false });
  assert.deepEqual(to12h('12:00'), { hour: 12, minute: 0, pm: true });
  assert.equal(from12h(12, 0, false), '00:00');
  assert.equal(from12h(12, 0, true), '12:00');
});
t('agenda guardada em "HH:mm" é calculada igual, qualquer que seja o formato de exibição', () => {
  const s = { mode: 'fixed', times: ['18:00'], days: [] } as const;
  const d = new Date(computeNextRun(s, new Date('2026-03-04T10:00:00')));
  assert.equal(`${d.getHours()}:${d.getMinutes()}`, '18:0');
});

t('resolveLanguage: auto segue o navegador; manual vence', () => {
  assert.equal(resolveLanguage('auto', 'en-GB'), 'en-US');
  assert.equal(resolveLanguage('auto', 'en'), 'en-US');
  assert.equal(resolveLanguage('auto', 'pt-PT'), 'pt-BR');
  assert.equal(resolveLanguage('auto', 'es'), 'pt-BR');
  assert.equal(resolveLanguage('pt-BR', 'en-US'), 'pt-BR');
  assert.equal(resolveLanguage('en-US', 'pt-BR'), 'en-US');
});
t('resolveHour12: padrão por idioma, sempre editável de forma independente', () => {
  assert.equal(resolveHour12('auto', 'pt-BR'), false);
  assert.equal(resolveHour12('auto', 'en-US'), true);
  assert.equal(resolveHour12('12', 'pt-BR'), true);
  assert.equal(resolveHour12('24', 'en-US'), false);
});
t('interpolate e tradutor (chave ausente devolve a chave)', () => {
  assert.equal(interpolate('Olá {name}, {n}x', { name: 'Ana', n: 3 }), 'Olá Ana, 3x');
  assert.equal(interpolate('sem {param}'), 'sem {param}');
  assert.equal(tPt('naoExiste'), 'naoExiste');
  assert.equal(tEn('notifChangedMsg', { name: 'Loja' }), 'Loja has changed.');
  assert.equal(tPt('notifChangedMsg', { name: 'Loja' }), 'Loja mudou.');
});
t('errorText: traduz {key, params}; string antiga passa direto', () => {
  assert.equal(errorText(tPt, { key: 'errHttp', params: { status: 404 } }), 'HTTP 404');
  assert.equal(errorText(tEn, { key: 'errNetwork' }), 'Network failure: site is down or you are offline');
  assert.equal(errorText(tEn, 'Erro antigo'), 'Erro antigo');
  assert.equal(errorText(tEn, null), '');
});
t('dicionários pt_BR e en_US têm exatamente as mesmas chaves e parâmetros', () => {
  const ks = (m: Messages) => Object.keys(m).sort();
  assert.deepEqual(ks(PT), ks(EN));
  const params = (x: string) => [...x.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const k of Object.keys(PT)) {
    assert.ok(PT[k].message.trim() && EN[k].message.trim(), `mensagem vazia: ${k}`);
    assert.equal(params(PT[k].message), params(EN[k].message), `parâmetros diferentes em: ${k}`);
  }
});
t('toda chave usada no código (t(...), data-i18n*, key:) existe nos dois idiomas', () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else files.push(p);
    }
  };
  walk('src');
  const used = new Set<string>();
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    if (f.endsWith('.ts')) {
      for (const m of src.matchAll(/\bt\(\s*'([A-Za-z0-9]+)'/g)) used.add(m[1]);
      for (const m of src.matchAll(/\bkey:\s*'([A-Za-z0-9]+)'/g)) used.add(m[1]);
    }
    if (f.endsWith('.html')) for (const m of src.matchAll(/data-i18n(?:-[a-z-]+)?="([A-Za-z0-9]+)"/g)) used.add(m[1]);
  }
  assert.ok(used.size > 20, `varredura achou poucas chaves (${used.size})`);
  for (const k of used) {
    assert.ok(k in PT, `falta em pt_BR: ${k}`);
    assert.ok(k in EN, `falta em en_US: ${k}`);
  }
});
t('manifest usa mensagens do chrome.i18n e default_locale existe', () => {
  const mf = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  assert.equal(mf.default_locale, 'pt_BR');
  assert.equal(mf.name, '__MSG_extName__');
  assert.equal(mf.description, '__MSG_extDescription__');
  for (const m of [PT, EN]) assert.ok('extName' in m && 'extDescription' in m);
});

console.log(`\n${n} testes de i18n/hora passaram.`);
