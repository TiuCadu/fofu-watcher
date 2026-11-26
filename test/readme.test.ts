import assert from 'node:assert/strict';
import fs from 'node:fs';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

// README.md (pt-BR) e README.en.md (en) precisam ter o mesmo conteúdo: estes testes
// pegam a divergência de estrutura (seção, bloco de código) que
// aparece quando só um dos dois é editado.
const pt = fs.readFileSync('README.md', 'utf8');
const en = fs.readFileSync('README.en.md', 'utf8');

const withoutCode = (s: string) => s.replace(/^```[\s\S]*?^```/gm, '');
const headingLevels = (s: string) => withoutCode(s).match(/^#+(?= )/gm) ?? [];
const codeBlocks = (s: string) => s.match(/^```[\s\S]*?^```/gm) ?? [];

t('README pt/en: mesma sequência de títulos (mesmas seções e subseções)', () => {
  assert.deepEqual(headingLevels(en), headingLevels(pt));
});

t('README pt/en: mesma quantidade de blocos de código', () => {
  assert.equal(codeBlocks(en).length, codeBlocks(pt).length);
});

console.log(`${n} testes ok`);
