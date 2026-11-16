import assert from 'node:assert/strict';
import { isHttpUrl } from '../src/utils/url';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

t('isHttpUrl: aceita http e https', () => {
  assert.ok(isHttpUrl('https://example.com/a?b=1#c'));
  assert.ok(isHttpUrl('http://localhost:8080/'));
});
t('isHttpUrl: rejeita esquemas perigosos e lixo', () => {
  for (const bad of ['javascript:alert(1)', 'file:///C:/x', 'chrome://extensions', 'data:text/html,hi', 'ftp://x.com', 'example.com', '']) {
    assert.ok(!isHttpUrl(bad), bad);
  }
});

console.log(`${n} testes ok`);
