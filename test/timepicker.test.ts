import assert from 'node:assert/strict';
import { mountTimePicker } from '../src/utils/timepicker';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

class FakeEl {
  tag: string;
  className = '';
  attrs: Record<string, string> = {};
  children: (FakeEl | string)[] = [];
  listeners: Record<string, (() => void)[]> = {};
  private _value = '';
  constructor(tag: string) { this.tag = tag; }
  get value(): string {
    if (this.tag !== 'select') return this._value;
    return this._value === '' && !this.touched ? (this.options()[0] ?? '') : this._value;
  }
  set value(v: string) {
    this.touched = true;
    this._value = this.tag === 'select' && !this.options().includes(v) ? '' : v;
  }
  private touched = false;
  options() { return this.children.filter((c): c is FakeEl => c instanceof FakeEl && c.tag === 'option').map((o) => o.value); }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  addEventListener(type: string, fn: () => void) { (this.listeners[type] ??= []).push(fn); }
  append(...c: (FakeEl | string)[]) { this.children.push(...c); }
  replaceChildren(...c: (FakeEl | string | null)[]) { this.children = c.filter((x): x is FakeEl | string => x != null); }
  choose(v: string) { this.value = v; for (const fn of this.listeners.change ?? []) fn(); }
}
(globalThis as any).document = { createElement: (tag: string) => new FakeEl(tag) };

const tr = (key: string) => `[${key}]`;
const selects = (host: FakeEl) => {
  const span = host.children[0] as FakeEl;
  const s = span.children.filter((c): c is FakeEl => c instanceof FakeEl && c.tag === 'select');
  return { span, hour: s[0], min: s[1], ampm: s[2] as FakeEl | undefined };
};
const mount = (value: string, hour12: boolean) => {
  const host = new FakeEl('div');
  const tp = mountTimePicker(host as unknown as HTMLElement, value, hour12, tr);
  return { host, tp, ...selects(host) };
};

t('24h: hora 00–23, minutos 00–59, sem AM/PM, e mostra o valor recebido', () => {
  const { tp, span, hour, min, ampm } = mount('09:05', false);
  assert.equal(hour.options().length, 24);
  assert.equal(hour.options()[0], '00');
  assert.equal(hour.options()[23], '23');
  assert.equal(min.options().length, 60);
  assert.equal(ampm, undefined);
  assert.equal(span.className, 'tp');
  assert.deepEqual(span.children.filter((c) => typeof c === 'string'), [':']);
  assert.equal(hour.value, '09');
  assert.equal(min.value, '05');
  assert.equal(tp.get(), '09:05');
});
t('12h: hora 1–12 e AM/PM; o valor continua "HH:mm" em 24h', () => {
  const { tp, hour, min, ampm } = mount('13:05', true);
  assert.deepEqual(hour.options(), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  assert.deepEqual(ampm!.options(), ['AM', 'PM']);
  assert.equal(hour.value, '1');
  assert.equal(min.value, '05');
  assert.equal(ampm!.value, 'PM');
  assert.equal(tp.get(), '13:05');
});
t('12h: meia-noite é 12 AM e meio-dia é 12 PM', () => {
  const meiaNoite = mount('00:30', true);
  assert.equal(meiaNoite.hour.value, '12');
  assert.equal(meiaNoite.ampm!.value, 'AM');
  const meioDia = mount('12:00', true);
  assert.equal(meioDia.hour.value, '12');
  assert.equal(meioDia.ampm!.value, 'PM');
});
t('valor inválido ou vazio vira 00:00', () => {
  for (const bad of ['', '24:00', '9:05', '12:60', 'abc']) assert.equal(mount(bad, false).tp.get(), '00:00', bad);
});
t('24h: escolher hora e minuto atualiza get()', () => {
  const { tp, hour, min } = mount('09:05', false);
  hour.choose('18');
  assert.equal(tp.get(), '18:05');
  min.choose('45');
  assert.equal(tp.get(), '18:45');
});
t('12h: escolher hora/minuto/período converte para 24h', () => {
  const { tp, hour, min, ampm } = mount('09:05', true);
  ampm!.choose('PM');
  assert.equal(tp.get(), '21:05');
  hour.choose('12');
  assert.equal(tp.get(), '12:05');
  ampm!.choose('AM');
  assert.equal(tp.get(), '00:05');
  min.choose('59');
  assert.equal(tp.get(), '00:59');
});
t('set() muda o valor e os selects (24h e 12h)', () => {
  const a = mount('09:05', false);
  a.tp.set('23:59');
  assert.equal(a.tp.get(), '23:59');
  assert.equal(a.hour.value, '23');
  assert.equal(a.min.value, '59');
  const b = mount('09:05', true);
  b.tp.set('23:59');
  assert.equal(b.tp.get(), '23:59');
  assert.equal(b.hour.value, '11');
  assert.equal(b.ampm!.value, 'PM');
});
t('rótulos de acessibilidade vêm do tradutor (sem texto fixo)', () => {
  const { hour, min, ampm } = mount('09:05', true);
  assert.equal(hour.attrs['aria-label'], '[hourLabel]');
  assert.equal(min.attrs['aria-label'], '[minuteLabel]');
  assert.equal(ampm!.attrs['aria-label'], '[periodLabel]');
  assert.equal(hour.className, 'tp-sel');
});
t('montar de novo substitui o conteúdo do host (não duplica)', () => {
  const host = new FakeEl('div');
  mountTimePicker(host as unknown as HTMLElement, '09:05', false, tr);
  mountTimePicker(host as unknown as HTMLElement, '10:00', true, tr);
  assert.equal(host.children.length, 1);
  assert.equal(selects(host).ampm?.tag, 'select');
});

console.log(`${n} testes ok`);
