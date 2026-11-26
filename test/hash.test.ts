import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256Hex } from '../src/utils/hash';

let n = 0;
const t = async (name: string, fn: () => void | Promise<void>) => { await fn(); n++; console.log('ok  ', name); };

await t('sha256Hex: vetores conhecidos (texto vazio e "abc")', async () => {
  assert.equal(await sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
await t('sha256Hex: 64 dígitos hexadecimais minúsculos (zeros à esquerda preservados)', async () => {
  for (const s of ['a', 'Fofu', 'x'.repeat(1000)]) assert.match(await sha256Hex(s), /^[0-9a-f]{64}$/, s);
});
await t('sha256Hex: texto com acentos e emoji é codificado em UTF-8 (igual ao node:crypto)', async () => {
  for (const s of ['ação', 'Preço: R$ 1.299,90', '日本語', '🚀 lançamento', 'linha 1\nlinha 2\r\n']) {
    assert.equal(await sha256Hex(s), createHash('sha256').update(s, 'utf8').digest('hex'), s);
  }
});
await t('sha256Hex: textos diferentes geram impressões diferentes; o mesmo texto, a mesma', async () => {
  assert.equal(await sha256Hex('mesmo texto'), await sha256Hex('mesmo texto'));
  assert.notEqual(await sha256Hex('R$ 10'), await sha256Hex('R$ 11'));
  assert.notEqual(await sha256Hex('a'), await sha256Hex('a '));
});

console.log(`${n} testes ok`);
