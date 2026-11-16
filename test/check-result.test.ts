import assert from 'node:assert/strict';
import { describeCheckResult } from '../src/utils/check-result';
import fs from 'node:fs';
import path from 'node:path';
import { makeTranslator, type Messages } from '../src/utils/i18n';
import type { CheckNowResponse } from '../src/utils/types';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

const load = (dir: string): Messages => JSON.parse(fs.readFileSync(path.join('_locales', dir, 'messages.json'), 'utf8'));
const tr = makeTranslator(load('pt_BR'));
const trEn = makeTranslator(load('en_US'));
const ok = (outcome: 'baseline' | 'unchanged' | 'changed'): CheckNowResponse => ({ ok: true, result: { outcome } });

t('regressão: "Verificar agora" sempre devolve um texto (mesmo sem mudança)', () => {
  for (const o of ['baseline', 'unchanged', 'changed'] as const) {
    const r = describeCheckResult(ok(o), tr);
    assert.ok(r.text.length > 10 && !r.isError, o);
  }
  assert.notEqual(describeCheckResult(ok('unchanged'), tr).text, describeCheckResult(ok('changed'), tr).text);
});
t('erro da verificação aparece traduzido e marcado como erro', () => {
  const r = describeCheckResult({ ok: true, result: { outcome: 'error', error: { key: 'errHttp', params: { status: 403 } } } }, tr);
  assert.ok(r.isError);
  assert.ok(r.text.includes('403'), r.text);
});
t('regressão: resposta ausente ou falha do worker não é ignorada em silêncio', () => {
  assert.ok(describeCheckResult(undefined, tr).isError);
  const r = describeCheckResult({ ok: false, error: 'boom' }, trEn);
  assert.ok(r.isError && r.text.includes('boom'), r.text);
});

t('detalhe: mostra o tamanho lido e a impressão, para provar que o conteúdo mudou entre cliques', () => {
  const r = describeCheckResult({ ok: true, result: { outcome: 'unchanged', info: { chars: 1234, hash: 'abcd1234' } } }, tr);
  assert.ok(r.detail?.includes('abcd1234') && r.detail.includes('1'), r.detail);
  assert.equal(describeCheckResult(ok('changed'), tr).detail, undefined);
});

console.log(`${n} testes de resultado da verificação passaram.`);
