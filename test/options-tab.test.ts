import assert from 'node:assert/strict';
import { pickOptionsContext } from '../src/utils/options-tab';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

const BASE = 'chrome-extension://abc/options/options.html';
const ctx = (documentUrl: string | undefined, tabId = 7, windowId = 1) => ({ documentUrl, tabId, windowId });

t('regressão: "Adicionar esta página" reaproveita a aba de opções aberta (não abre outra)', () => {
  assert.equal(pickOptionsContext([ctx('chrome-extension://abc/popup/popup.html', 3), ctx(BASE, 7)], BASE)?.tabId, 7);
});
t('reconhece a aba de opções mesmo com parâmetros (?add=…) ou âncora', () => {
  assert.equal(pickOptionsContext([ctx(`${BASE}?add=https%3A%2F%2Fx.com&name=X`, 9)], BASE)?.tabId, 9);
  assert.equal(pickOptionsContext([ctx(`${BASE}#history`, 4)], BASE)?.tabId, 4);
});
t('sem aba de opções aberta: nada (cria uma nova)', () => {
  assert.equal(pickOptionsContext([ctx('chrome-extension://abc/diff/diff.html?site=1')], BASE), undefined);
  assert.equal(pickOptionsContext([], BASE), undefined);
});
t('ignora contextos sem aba e páginas parecidas que não são as opções', () => {
  assert.equal(pickOptionsContext([ctx(BASE, -1)], BASE), undefined);
  assert.equal(pickOptionsContext([ctx(undefined)], BASE), undefined);
  assert.equal(pickOptionsContext([ctx(`${BASE}.bak`)], BASE), undefined);
});

console.log(`${n} testes da aba de opções passaram.`);
