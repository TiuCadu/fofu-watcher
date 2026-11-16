import assert from 'node:assert/strict';
import { singleFlight } from '../src/utils/single-flight';
import { computeNextRun, DUE_GRACE_MS, isDue } from '../src/utils/time';
import type { Schedule } from '../src/utils/types';

let n = 0;
const t = async (name: string, fn: () => void | Promise<void>) => { await fn(); n++; console.log('ok  ', name); };

const MIN = 60_000;
const interval = (everyMinutes: number, windowStart: string | null = null, windowEnd: string | null = null): Schedule =>
  ({ mode: 'interval', everyMinutes, windowStart, windowEnd });

function simulate(schedule: Schedule, ticks: number, work = 2000, start = new Date(2026, 0, 5, 10, 0, 0).getTime()): number[] {
  const site = { enabled: true, schedule, nextRun: start as number | null, lastCheck: null as number | null };
  const runs: number[] = [];
  for (let i = 0; i < ticks; i++) {
    const tick = start + i * MIN;
    if (!isDue(site, tick)) continue;
    const end = tick + work;
    runs.push(i);
    site.lastCheck = end;
    site.nextRun = computeNextRun(schedule, new Date(end));
  }
  return runs;
}

await t('regressão: intervalo de 1 min verifica a cada tick (não vira 2 min)', () => {
  assert.deepEqual(simulate(interval(1), 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});
await t('regressão: intervalo de 5 min verifica a cada 5 ticks (não vira 6 min)', () => {
  assert.deepEqual(simulate(interval(5), 21), [0, 5, 10, 15, 20]);
});
await t('folga mesmo com verificação lenta (25 s)', () => {
  assert.deepEqual(simulate(interval(1), 6, 25_000), [0, 1, 2, 3, 4, 5]);
});
await t('isDue: sem nextRun vence na hora; pausado nunca vence', () => {
  assert.ok(isDue({ enabled: true, schedule: interval(1), nextRun: null, lastCheck: null }, 0));
  assert.ok(!isDue({ enabled: false, schedule: interval(1), nextRun: 0, lastCheck: null }, 10));
});
await t('horário fixo não roda adiantado (18:00 não dispara às 17:59:40)', () => {
  const fixed: Schedule = { mode: 'fixed', times: ['18:00'], days: [] };
  const at1800 = new Date(2026, 0, 5, 18, 0, 0).getTime();
  const s = { enabled: true, schedule: fixed, nextRun: at1800, lastCheck: at1800 - 86_400_000 };
  assert.ok(!isDue(s, at1800 - 20_000));
  assert.ok(isDue(s, at1800 + 1));
});
await t('janela do intervalo não abre adiantada (próxima às 08:00 não roda às 07:59:40)', () => {
  const sch = interval(30, '08:00', '20:00');
  const lastCheck = new Date(2026, 0, 5, 19, 50).getTime();
  const nextRun = computeNextRun(sch, new Date(lastCheck)); 
  assert.equal(new Date(nextRun).getHours(), 8);
  const s = { enabled: true, schedule: sch, nextRun, lastCheck };
  assert.ok(!isDue(s, nextRun - 20_000), 'salto de janela não usa folga');
  assert.ok(isDue(s, nextRun));
});
await t('folga é menor que o tick (nunca roda 2x no mesmo minuto)', () => {
  assert.ok(DUE_GRACE_MS > 0 && DUE_GRACE_MS < MIN);
});

await t('regressão: clique durante uma verificação em andamento recebe o MESMO resultado', async () => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const run = singleFlight(async (id: string) => { calls++; await gate; return `mudou:${id}`; });
  const auto = run('a');      
  const manual = run('a');    
  release();
  assert.equal(await auto, 'mudou:a');
  assert.equal(await manual, 'mudou:a', 'o clique não pode ver "sem mudanças" por ter rodado depois');
  assert.equal(calls, 1);
});
await t('singleFlight: sites diferentes rodam em paralelo; depois de terminar, roda de novo', async () => {
  let calls = 0;
  const run = singleFlight(async (id: string) => { calls++; return id; });
  assert.deepEqual(await Promise.all([run('a'), run('b')]), ['a', 'b']);
  await run('a');
  assert.equal(calls, 3);
});
await t('singleFlight: erro libera a vaga para a próxima tentativa', async () => {
  let calls = 0;
  const run = singleFlight(async () => { calls++; if (calls === 1) throw new Error('falhou'); return 'ok'; });
  await assert.rejects(run('a'));
  assert.equal(await run('a'), 'ok');
});

console.log(`${n} testes de agendamento passaram.`);
