import assert from 'node:assert/strict';
import { upsertSite } from '../src/utils/site-list';
import type { Site } from '../src/utils/types';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

const site = (id: string, name = id): Site => ({
  id, url: `https://${id}.example/`, name, selector: '', ignoreVolatile: true, enabled: true,
  schedule: { mode: 'interval', everyMinutes: 30, windowStart: null, windowEnd: null },
  nextRun: null, lastCheck: null, status: 'pending', unseen: false, failures: 0, lastError: null,
  baseText: null, baseHash: null, history: [],
});

t('regressão: clicar em Salvar várias vezes no mesmo formulário não duplica o site', () => {
  const sites: Site[] = [site('outro')];
  const draft = 'id-do-formulario';
  upsertSite(sites, site(draft, 'Produto'));
  upsertSite(sites, site(draft, 'Produto'));
  upsertSite(sites, site(draft, 'Produto'));
  assert.deepEqual(sites.map((s) => s.id), ['outro', draft]);
});
t('o 2º salvamento atualiza os dados em vez de criar outro (mantém a posição)', () => {
  const sites: Site[] = [site('a'), site('b')];
  upsertSite(sites, site('a', 'A renomeado'));
  assert.deepEqual(sites.map((s) => `${s.id}:${s.name}`), ['a:A renomeado', 'b:b']);
});
t('id novo é adicionado no fim', () => {
  const sites: Site[] = [site('a')];
  assert.equal(upsertSite(sites, site('c')), 'added');
  assert.equal(upsertSite(sites, site('c')), 'updated');
  assert.deepEqual(sites.map((s) => s.id), ['a', 'c']);
});

console.log(`${n} testes da lista de sites passaram.`);
