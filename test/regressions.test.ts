import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));

t('regressão: iconUrl das notificações usa chrome.runtime.getURL (caminho relativo quebra no service worker)', () => {
  for (const f of files('src')) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/iconUrl\s*:\s*([^,\n}]+)/g)) {
      assert.match(m[1], /chrome\.runtime\.getURL\(/, `${f}: iconUrl ${m[1].trim()}`);
    }
  }
});

t('regressão: falha ao notificar não derruba a verificação (o resultado continua sendo "mudou")', () => {
  const src = fs.readFileSync('src/background/checker.ts', 'utf8');
  assert.match(src, /await notify\(updated, 'changed'\)\.catch\(/, 'notify(changed) precisa de .catch');
  assert.match(src, /await notify\(updated, 'error'\)\.catch\(/, 'notify(error) precisa de .catch');
});

console.log(`${n} testes de regressão passaram.`);
