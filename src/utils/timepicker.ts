import { from12h, to12h } from './time';
import type { Translate } from './time';
import { h } from './ui';

export interface TimePicker {
  get(): string;
  set(hm: string): void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export function mountTimePicker(host: HTMLElement, value: string, hour12: boolean, t: Translate): TimePicker {
  let cur = /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '00:00';

  const sel = (label: string, opts: [string, string][], onInput: (v: string) => void) => {
    const s = h('select', { 'aria-label': label, class: 'tp-sel' }, ...opts.map(([v, text]) => h('option', { value: v }, text)));
    s.addEventListener('change', () => onInput(s.value)); 
    return s;
  };

  let hourSel: HTMLSelectElement, minSel: HTMLSelectElement, ampmSel: HTMLSelectElement | null = null;

  const read12 = () => from12h(Number(hourSel.value), Number(minSel.value), ampmSel!.value === 'PM');
  const read24 = () => `${hourSel.value}:${minSel.value}`;
  const sync = () => { cur = hour12 ? read12() : read24(); };

  minSel = sel(t('minuteLabel'), range(0, 59).map((m) => [pad(m), pad(m)]), sync);
  if (hour12) {
    hourSel = sel(t('hourLabel'), range(1, 12).map((x) => [String(x), String(x)]), sync);
    ampmSel = sel(t('periodLabel'), [['AM', 'AM'], ['PM', 'PM']], sync);
  } else {
    hourSel = sel(t('hourLabel'), range(0, 23).map((x) => [pad(x), pad(x)]), sync);
  }

  const set = (hm: string) => {
    cur = hm;
    if (hour12) {
      const p = to12h(hm);
      hourSel.value = String(p.hour);
      minSel.value = pad(p.minute);
      ampmSel!.value = p.pm ? 'PM' : 'AM';
    } else {
      hourSel.value = hm.slice(0, 2);
      minSel.value = hm.slice(3, 5);
    }
  };

  host.replaceChildren(
    h('span', { class: 'tp' }, hourSel, ':', minSel, ampmSel),
  );
  set(cur);
  return { get: () => cur, set };
}
