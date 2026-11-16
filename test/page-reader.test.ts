import assert from 'node:assert/strict';
import { isLoginRedirect, readRenderedText, shortUrl } from '../src/utils/page-reader';

let n = 0;
const t = async (name: string, fn: () => void | Promise<void>) => { await fn(); n++; console.log('ok  ', name); };

await t('regressão: Mercado Livre redirecionando para account-verification é login/verificação', () => {
  assert.ok(isLoginRedirect('https://lista.mercadolivre.com.br/fone-bluetooth',
    'https://www.mercadolivre.com.br/gz/account-verification?go=https%3A%2F%2Flista.mercadolivre.com.br%2Ffone-bluetooth'));
});
await t('outros logins/captchas comuns são detectados', () => {
  assert.ok(isLoginRedirect('https://loja.com/produto/1', 'https://loja.com/login?next=/produto/1'));
  assert.ok(isLoginRedirect('https://site.com/a', 'https://accounts.site.com/signin'));
  assert.ok(isLoginRedirect('https://site.com/a', 'https://site.com/captcha'));
});
await t('redirecionamentos normais não contam (https, barra final, mesma página, sem pista de login)', () => {
  assert.ok(!isLoginRedirect('http://site.com/a', 'https://site.com/a/'));
  assert.ok(!isLoginRedirect('https://site.com/a', 'https://site.com/a#x'));
  assert.ok(!isLoginRedirect('https://site.com/a', 'https://site.com/pt-br/a'));
  assert.ok(!isLoginRedirect('https://site.com/login', 'https://site.com/login/'), 'monitorar a própria página de login é permitido');
  assert.ok(!isLoginRedirect('lixo', 'https://site.com/login'));
});
await t('shortUrl: host + caminho, sem parâmetros, com limite', () => {
  assert.equal(shortUrl('https://www.mercadolivre.com.br/gz/account-verification?go=x'), 'www.mercadolivre.com.br/gz/account-verification');
  assert.equal(shortUrl('https://a.com/' + 'x'.repeat(100), 20).length, 20);
});

type FakeEl = { innerText: string };
function fakePage(frames: Array<{ body: string; matches?: Record<string, string[]> }>, url = 'https://loja.com/p') {
  let i = 0;
  const take = () => frames[Math.min(i++, frames.length - 1)];
  (globalThis as any).location = { href: url };
  (globalThis as any).document = {
    get body() { return { innerText: take().body }; },
    querySelectorAll(sel: string): FakeEl[] {
      if (sel.includes('!')) throw new Error('SyntaxError');
      return (take().matches?.[sel] ?? []).map((x) => ({ innerText: x }));
    },
  };
}
async function run(sel: string, frames: Parameters<typeof fakePage>[0], waitMs = 500) {
  fakePage(frames);
  return readRenderedText(sel, waitMs, 1);
}

await t('espera o trecho aparecer (conteúdo montado por JavaScript depois do carregamento)', async () => {
  const r = await run('.preco', [{ body: 'carregando' }, { body: 'carregando' }, { body: 'R$ 99', matches: { '.preco': ['R$ 99'] } }]);
  assert.deepEqual(r, { ok: true, text: 'R$ 99', url: 'https://loja.com/p' });
});
await t('espera o texto parar de mudar antes de ler', async () => {
  const r = await run('.preco', [{ body: '', matches: { '.preco': ['R$'] } }, { body: '', matches: { '.preco': ['R$ 9'] } }, { body: '', matches: { '.preco': ['R$ 99'] } }]);
  assert.ok(r.ok && r.text === 'R$ 99', JSON.stringify(r));
});
await t('página inteira usa o texto visível do body; vários elementos viram várias linhas', async () => {
  assert.equal((await run('', [{ body: 'Olá mundo' }])).ok, true);
  const r = await run('li', [{ body: '', matches: { li: ['um', 'dois'] } }]);
  assert.ok(r.ok && r.text === 'um\ndois');
});
await t('seletor que nunca aparece: errSelectorNotFound (com a URL final, para detectar login)', async () => {
  const r = await run('.nada', [{ body: 'x' }], 60);
  assert.deepEqual(r, { ok: false, key: 'errSelectorNotFound', url: 'https://loja.com/p' });
});
await t('seletor inválido: errSelectorInvalid', async () => {
  const r = await run('a!!', [{ body: 'x' }], 60);
  assert.equal(!r.ok && r.key, 'errSelectorInvalid');
});

console.log(`${n} testes do modo "ler abrindo a página" passaram.`);
