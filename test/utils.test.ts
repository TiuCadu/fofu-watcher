import assert from 'node:assert/strict';
import { diffLines } from '../src/utils/diff';
import { normalizeText } from '../src/utils/normalize';
import { computeNextRun, fixedTimes, inWindow, isDnd } from '../src/utils/time';

const D = (s: string) => new Date(s); 
const iso = (ms: number) => { const d = new Date(ms); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

t('fixed: próximo horário do mesmo dia', () => {
  const s = { mode: 'fixed', times: ['09:00', '13:00', '18:00'], days: [] } as const;
  assert.equal(iso(computeNextRun(s, D('2026-03-04T10:00:00'))), '2026-03-04 13:00');
});
t('fixed: estritamente depois (não repete o horário atual)', () => {
  const s = { mode: 'fixed', times: ['09:00', '13:00'], days: [] } as const;
  assert.equal(iso(computeNextRun(s, D('2026-03-04T13:00:00'))), '2026-03-05 09:00');
});
t('fixed: respeita dias da semana (só seg/sex)', () => {
  const s = { mode: 'fixed', times: ['08:00'], days: [1, 5] } as const;
  assert.equal(iso(computeNextRun(s, D('2026-03-04T10:00:00'))), '2026-03-06 08:00'); 
  assert.equal(iso(computeNextRun(s, D('2026-03-06T09:00:00'))), '2026-03-09 08:00'); 
});
t('regressão: horário escolhido sem clicar em "Adicionar" é salvo junto com os já adicionados', () => {
  assert.deepEqual(fixedTimes(['09:00'], '17:00', true), ['09:00', '17:00']);
});
t('fixedTimes: seletor não mexido não acrescenta horário', () => {
  assert.deepEqual(fixedTimes(['09:00'], '12:00', false), ['09:00']);
});
t('fixedTimes: só o seletor mexido (sem nenhum adicionado) já vale; sem mexer, lista vazia continua vazia', () => {
  assert.deepEqual(fixedTimes([], '17:00', true), ['17:00']);
  assert.deepEqual(fixedTimes([], '09:00', false), []); 
});
t('fixedTimes: sem duplicar, ordenado e ignorando valor inválido', () => {
  assert.deepEqual(fixedTimes(['17:00', '09:00'], '09:00', true), ['09:00', '17:00']);
  assert.deepEqual(fixedTimes(['17:00'], '25:00', true), ['17:00']);
  assert.deepEqual(fixedTimes([], 'x', true), []);
});
t('interval: soma o intervalo', () => {
  const s = { mode: 'interval', everyMinutes: 30, windowStart: null, windowEnd: null } as const;
  assert.equal(iso(computeNextRun(s, D('2026-03-04T10:00:00'))), '2026-03-04 10:30');
});
t('interval: fora da janela pula para o início da janela', () => {
  const s = { mode: 'interval', everyMinutes: 60, windowStart: '08:00', windowEnd: '20:00' } as const;
  assert.equal(iso(computeNextRun(s, D('2026-03-04T19:30:00'))), '2026-03-05 08:00');
  assert.equal(iso(computeNextRun(s, D('2026-03-04T05:00:00'))), '2026-03-04 08:00'); 
  assert.equal(iso(computeNextRun(s, D('2026-03-04T12:00:00'))), '2026-03-04 13:00');
});
t('janela que cruza a meia-noite', () => {
  assert.ok(inWindow(23 * 60, 22 * 60, 7 * 60));
  assert.ok(inWindow(3 * 60, 22 * 60, 7 * 60));
  assert.ok(!inWindow(12 * 60, 22 * 60, 7 * 60));
});
t('não perturbe', () => {
  const st = { sound: true, dndEnabled: true, dndStart: '22:00', dndEnd: '07:00' };
  assert.ok(isDnd(st, D('2026-03-04T23:10:00')));
  assert.ok(!isDnd(st, D('2026-03-04T12:00:00')));
  assert.ok(!isDnd({ ...st, dndEnabled: false }, D('2026-03-04T23:10:00')));
});

t('normalização: espaços e quebras não geram diferença', () => {
  assert.equal(normalizeText('  Olá   mundo \n\n\n  linha 2\t', false), 'Olá mundo\nlinha 2');
});
t('voláteis: datas, horas, contadores e tokens são ignorados', () => {
  const a = normalizeText('Atualizado em 04/03/2026 às 10:15\n1.234 visualizações\ntoken a1b2c3d4e5f6g7h8i9j0k1\nPreço R$ 10', true);
  const b = normalizeText('Atualizado em 05/03/2026 às 11:42\n1.300 visualizações\ntoken zz9y8x7w6v5u4t3s2r1q0p\nPreço R$ 10', true);
  assert.equal(a, b);
  assert.notEqual(normalizeText('Preço R$ 10', true), normalizeText('Preço R$ 12', true));
});
t('voláteis desligado: datas contam como mudança', () => {
  assert.notEqual(normalizeText('em 04/03/2026', false), normalizeText('em 05/03/2026', false));
});

t('diff: linhas adicionadas e removidas', () => {
  const d = diffLines(['a', 'b', 'c'], ['a', 'x', 'c', 'd']);
  assert.deepEqual(d, [{ t: 'del', line: 'b' }, { t: 'add', line: 'x' }, { t: 'add', line: 'd' }]);
});
t('diff: iguais => vazio', () => assert.deepEqual(diffLines(['a', 'b'], ['a', 'b']), []));
t('diff: arquivo grande não estoura', () => {
  const a = Array.from({ length: 4000 }, (_, i) => `linha ${i}`);
  const b = a.map((l, i) => (i % 500 === 0 ? l + ' mudou' : l));
  assert.equal(diffLines(a, b).length, 16);
});

console.log(`\n${n} testes passaram.`);
