import assert from 'node:assert/strict';
import fs from 'node:fs';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

// README.md (pt-BR) e README.en.md (en) precisam ter o mesmo conteúdo: estes testes
// pegam a divergência de estrutura (seção, bloco de código, total de testes) que
// aparece quando só um dos dois é editado.
const pt = fs.readFileSync('README.md', 'utf8');
const en = fs.readFileSync('README.en.md', 'utf8');

const withoutCode = (s: string) => s.replace(/^```[\s\S]*?^```/gm, '');
const headingLevels = (s: string) => withoutCode(s).match(/^#+(?= )/gm) ?? [];
const codeBlocks = (s: string) => s.match(/^```[\s\S]*?^```/gm) ?? [];
const testCount = (s: string) => s.match(/<!-- test-count -->(\d+)<!-- \/test-count -->/)?.[1];

t('README pt/en: mesma sequência de títulos (mesmas seções e subseções)', () => {
  assert.deepEqual(headingLevels(en), headingLevels(pt));
});

t('README pt/en: mesma quantidade de blocos de código', () => {
  assert.equal(codeBlocks(en).length, codeBlocks(pt).length);
});

t('README pt/en: os dois mostram o total de testes, com o mesmo número', () => {
  assert.ok(testCount(pt), 'README.md sem o marcador test-count');
  assert.ok(testCount(en), 'README.en.md sem o marcador test-count');
  assert.equal(testCount(en), testCount(pt));
});

console.log(`${n} testes ok`);
