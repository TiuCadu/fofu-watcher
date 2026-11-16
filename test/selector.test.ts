import assert from 'node:assert/strict';
import { buildSelector, cssEscape, isStableToken, type SelNode } from '../src/utils/selector';

class El implements SelNode {
  parentElement: El | null = null;
  children: El[] = [];
  constructor(public tagName: string, public id = '', public classList: string[] = [], public attrs: Record<string, string> = {}) {}
  getAttribute(n: string) { return this.attrs[n] ?? null; }
  add(...kids: El[]) { for (const k of kids) { k.parentElement = this; this.children.push(k); } return this; }
}
const e = (tag: string, o: { id?: string; cls?: string[]; attrs?: Record<string, string> } = {}, ...kids: El[]) =>
  new El(tag.toUpperCase(), o.id, o.cls, o.attrs).add(...kids);

const all = (root: El): El[] => [root, ...root.children.flatMap(all)];

function matchCompound(el: El, comp: string): boolean {
  let rest = comp;
  const tag = rest.match(/^[a-z][a-z0-9]*/i);
  if (tag) { if (el.tagName.toLowerCase() !== tag[0].toLowerCase()) return false; rest = rest.slice(tag[0].length); }
  while (rest) {
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^#((?:\\.|[\w-])+)/))) { if (el.id !== m[1].replace(/\\(.)/g, '$1')) return false; }
    else if ((m = rest.match(/^\.((?:\\.|[\w-])+)/))) { if (!el.classList.includes(m[1].replace(/\\(.)/g, '$1'))) return false; }
    else if ((m = rest.match(/^\[([\w-]+)="((?:\\.|[^"\\])*)"\]/))) { if (el.attrs[m[1]] !== m[2].replace(/\\(.)/g, '$1')) return false; }
    else if ((m = rest.match(/^:nth-of-type\((\d+)\)/))) {
      const sib = el.parentElement!.children.filter((c) => c.tagName === el.tagName);
      if (sib.indexOf(el) + 1 !== Number(m[1])) return false;
    } else throw new Error(`mini-motor não entende: ${rest}`);
    rest = rest.slice(m[0].length);
  }
  return true;
}
function matchChain(el: El, segs: string[], i: number): boolean {
  if (!matchCompound(el, segs[i])) return false;
  if (i === 0) return true;
  return !!el.parentElement && matchChain(el.parentElement, segs, i - 1);
}
const query = (root: El, sel: string): El[] => {
  const segs = sel.split(' > ');
  return all(root).filter((n) => matchChain(n, segs, segs.length - 1));
};

const price = e('span', { cls: ['price'] });
const hero = e('div', { id: 'hero' }, e('p'), e('p'));
const root = e('html', {}, e('head'),
  e('body', {},
    e('header', {}, e('h1', { cls: ['title'] })),
    e('main', {},
      e('div', { cls: ['card'] }, e('span', { cls: ['name'] }), price),
      e('div', { cls: ['card'] }, e('span', { cls: ['name'] }), e('span', { cls: ['price'] })),
      e('div', { cls: ['card', 'css-1x2y3z', 'is-active'] }, e('span', { cls: ['name'] }), e('span', { cls: ['price'] })),
    ),
    hero,
    e('section', { attrs: { 'data-testid': 'promo' } }, e('span'), e('span', { cls: ['badge'] })),
    e('div', { id: 'react-12345', cls: ['sc-abc123'] }, e('em')),
    e('ul', {}, e('li'), e('li'), e('li'), e('li'), e('li')),
  ));
const count = (sel: string) => query(root, sel).length;

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

t('cssEscape: caracteres especiais e dígito inicial', () => {
  assert.equal(cssEscape('price'), 'price');
  assert.equal(cssEscape('a:b.c'), 'a\\:b\\.c');
  assert.equal(cssEscape('1abc'), '\\31 abc');
  assert.equal(cssEscape('ação'), 'ação');
});
t('isStableToken: rejeita ids/classes gerados automaticamente', () => {
  for (const ok of ['price', 'main-nav', 'card', 'col-12']) assert.ok(isStableToken(ok), ok);
  for (const bad of ['react-12345', ':r1:', 'a1b2c3d4e5f6', '550e8400-e29b-41d4', 'ember1234', '']) assert.ok(!isStableToken(bad), bad);
});
t('id estável vence tudo', () => {
  assert.equal(buildSelector(hero, count), '#hero');
});
t('id gerado automaticamente é ignorado', () => {
  const el = root.children[1].children[4]; 
  const sel = buildSelector(el, count);
  assert.ok(!sel.includes('react-12345'), sel);
  assert.deepEqual(query(root, sel), [el]);
});
t('atributo de teste estável é usado (data-testid)', () => {
  const section = root.children[1].children[3];
  assert.equal(buildSelector(section, count), '[data-testid="promo"]');
});
t('classe única e legível vira tag.classe', () => {
  const h1 = root.children[1].children[0].children[0];
  assert.equal(buildSelector(h1, count), 'h1.title');
});
t('classes de hash e de estado não entram no seletor', () => {
  const card3 = root.children[1].children[1].children[2];
  const sel = buildSelector(card3, count);
  assert.ok(!/css-1x2y3z|is-active/.test(sel), sel);
  assert.deepEqual(query(root, sel), [card3]);
});
t('elemento repetido é desambiguado subindo pelos ancestrais (e por posição)', () => {
  const sel = buildSelector(price, count);
  assert.deepEqual(query(root, sel), [price]);
  assert.ok(sel.includes(' > '), sel);
});
t('lista de irmãos iguais usa :nth-of-type', () => {
  const li3 = root.children[1].children[5].children[2];
  const sel = buildSelector(li3, count);
  assert.ok(sel.includes(':nth-of-type(3)'), sel);
  assert.deepEqual(query(root, sel), [li3]);
});
t('PROPRIEDADE: para TODO elemento da página o seletor gerado acha exatamente aquele elemento', () => {
  for (const el of all(root)) {
    if (el.tagName === 'HTML') continue;
    const sel = buildSelector(el, count);
    assert.deepEqual(query(root, sel), [el], `falhou para <${el.tagName.toLowerCase()}> com "${sel}"`);
  }
});
t('seletores gerados são curtos (no máximo 4 níveis nesta página)', () => {
  for (const el of all(root)) {
    if (el.tagName === 'HTML') continue;
    assert.ok(buildSelector(el, count).split(' > ').length <= 4);
  }
});

console.log(`\n${n} testes do seletor passaram.`);
