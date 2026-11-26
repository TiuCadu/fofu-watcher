import assert from 'node:assert/strict';
import { deleteHistory, sitesWithHistory } from '../src/utils/history';
import type { HistoryEntry, Site } from '../src/utils/types';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

const entry = (ts: number): HistoryEntry => ({ ts, diff: [{ t: 'add', line: `linha ${ts}` }], omitted: 0 });
const site = (id: string, ts: number[], extra: Partial<Site> = {}): Site => ({
  id, url: `https://${id}.example/`, name: id, selector: '', ignoreVolatile: true, enabled: true,
  schedule: { mode: 'interval', everyMinutes: 30, windowStart: null, windowEnd: null },
  nextRun: null, lastCheck: null, status: ts.length ? 'changed' : 'ok', unseen: ts.length > 0, failures: 0, lastError: null,
  baseText: 'base', baseHash: 'abc', history: ts.map(entry), ...extra,
});

t('só sites com mudanças registradas aparecem no Histórico (mantendo a ordem)', () => {
  const list = [site('a', []), site('b', [3, 2]), site('c', []), site('d', [1])];
  assert.deepEqual(sitesWithHistory(list).map((s) => s.id), ['b', 'd']);
  assert.deepEqual(sitesWithHistory([site('x', [])]), []);
});

t('excluir selecionadas remove só as escolhidas', () => {
  const s = site('a', [30, 20, 10]);
  assert.equal(deleteHistory(s, new Set([20])), 1);
  assert.deepEqual(s.history.map((e) => e.ts), [30, 10]);
  assert.equal(s.unseen, true, 'ainda há mudanças: o "não visto" continua');
  assert.equal(s.status, 'changed');
});

t('excluir todas esvazia o histórico e zera o "não visto" (badge)', () => {
  const s = site('a', [30, 20, 10]);
  assert.equal(deleteHistory(s, 'all'), 3);
  assert.deepEqual(s.history, []);
  assert.equal(s.unseen, false);
  assert.equal(s.status, 'ok');
  assert.equal(sitesWithHistory([s]).length, 0, 'sem histórico, o site some da aba Histórico');
});

t('excluir todas as selecionadas uma a uma também zera o "não visto"', () => {
  const s = site('a', [30, 20]);
  deleteHistory(s, new Set([30, 20]));
  assert.equal(s.unseen, false);
  assert.equal(s.status, 'ok');
});

t('regressão: exclui pela data (ts), não pelo índice, mesmo se uma mudança nova entrou no topo', () => {
  const s = site('a', [20, 10]);
  const chosen = new Set([10]);
  s.history.unshift(entry(30));
  deleteHistory(s, chosen);
  assert.deepEqual(s.history.map((e) => e.ts), [30, 20]);
});

t('excluir histórico não mexe na versão base nem no status de erro', () => {
  const s = site('a', [10], { status: 'error', failures: 2, lastError: { key: 'errNetwork' } });
  deleteHistory(s, 'all');
  assert.equal(s.baseText, 'base');
  assert.equal(s.baseHash, 'abc');
  assert.equal(s.status, 'error');
  assert.equal(s.failures, 2);
});

t('seleção vazia ou ts inexistente não remove nada', () => {
  const s = site('a', [10]);
  assert.equal(deleteHistory(s, new Set()), 0);
  assert.equal(deleteHistory(s, new Set([999])), 0);
  assert.equal(s.history.length, 1);
  assert.equal(s.unseen, true);
});

console.log(`${n} testes de histórico passaram.`);
