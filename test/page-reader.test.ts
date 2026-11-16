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

type Btn = { innerText: string; value?: string; click(): void; getBoundingClientRect?: () => { width: number; height: number } };
function gatePage(opts: { buttons: (click: () => void) => Btn[]; productAfterClick?: boolean; productFromStart?: boolean }) {
  const state = { clicks: 0 };
  const onClick = () => { state.clicks++; };
  const buttons = opts.buttons(onClick);
  const product = () => opts.productFromStart || (opts.productAfterClick && state.clicks > 0);
  (globalThis as any).location = { href: 'https://loja.com/produto' };
  (globalThis as any).document = {
    get body() { return { innerText: product() ? 'Produto R$ 99' : 'Atenção Você é maior de 18 anos? Sim Não' }; },
    querySelectorAll(sel: string) {
      if (sel === '.preco') return product() ? [{ innerText: 'R$ 99' }] : [];
      if (sel.includes('button') || sel === 'body *') return product() ? [] : buttons;
      return [];
    },
  };
  return state;
}
const btn = (innerText: string, click: () => void, size = 30): Btn => ({ innerText, click, getBoundingClientRect: () => ({ width: size, height: size }) });

await t('regressão: aviso de idade — clica em "Sim" e então lê o preço que só aparece depois', async () => {
  const st = gatePage({ buttons: (c) => [btn('Não', () => {}), btn('Sim', c)], productAfterClick: true });
  const r = await readRenderedText('.preco', 300, 1, 'Sim');
  assert.deepEqual(r, { ok: true, text: 'R$ 99', url: 'https://loja.com/produto' });
  assert.equal(st.clicks, 1, 'clica uma única vez');
});
await t('sem "clicar antes", o aviso esconde o preço (errSelectorNotFound) — o problema original', async () => {
  gatePage({ buttons: (c) => [btn('Sim', c)], productAfterClick: true });
  const r = await readRenderedText('.preco', 60, 1);
  assert.equal(!r.ok && r.key, 'errSelectorNotFound');
});
await t('texto do botão ignora maiúsculas e espaços; não clica em "Não" nem em botões invisíveis', async () => {
  let wrong = 0;
  const st = gatePage({ buttons: (c) => [btn('  SIM ', () => { wrong++; }, 0), btn('Não', () => { wrong++; }), btn('  sim\n', c)], productAfterClick: true });
  const r = await readRenderedText('.preco', 300, 1, 'Sim');
  assert.ok(r.ok);
  assert.equal(st.clicks, 1);
  assert.equal(wrong, 0, 'não clicou no invisível nem no "Não"');
});
await t('botão com value (input type=button) também é encontrado', async () => {
  const st = gatePage({ buttons: (c) => [{ innerText: '', value: 'Aceitar', click: c }], productAfterClick: true });
  assert.ok((await readRenderedText('.preco', 300, 1, 'Aceitar')).ok);
  assert.equal(st.clicks, 1);
});
await t('se o site já lembrou a resposta (trecho na tela, sem aviso), lê sem esperar o botão', async () => {
  const st = gatePage({ buttons: () => [], productFromStart: true });
  const t0 = Date.now();
  const r = await readRenderedText('.preco', 2000, 1, 'Sim');
  assert.ok(r.ok && r.text === 'R$ 99');
  assert.equal(st.clicks, 0);
  assert.ok(Date.now() - t0 < 1000, 'não esperou os 2 s do botão');
});
await t('botão que nunca aparece não vira erro: segue lendo (página inteira)', async () => {
  gatePage({ buttons: () => [], productFromStart: true });
  const r = await readRenderedText('', 50, 1, 'Sim');
  assert.ok(r.ok && r.text === 'Produto R$ 99');
});

console.log(`${n} testes do modo "ler abrindo a página" passaram.`);
