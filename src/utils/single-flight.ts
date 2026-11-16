export function singleFlight<K, A extends unknown[], V>(fn: (key: K, ...args: A) => Promise<V>): (key: K, ...args: A) => Promise<V> {
  const inflight = new Map<K, Promise<V>>();
  return (key, ...args) => {
    const running = inflight.get(key);
    if (running) return running;
    const p = fn(key, ...args).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  };
}
