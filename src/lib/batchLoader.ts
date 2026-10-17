/**
 * A tiny request-scoped batch loader (the DataLoader idea): every `load(id)` made while a
 * GraphQL response is being resolved is collected and fetched with ONE query, and repeated ids
 * are served from cache. The session dashboard resolves each game's court and both teams; without
 * this that was 3 database queries per game (90+ for a 30-game night) on every refresh.
 */
export interface BatchLoader<V> {
  load(id: string): Promise<V | undefined>;
  /** In the order of `ids`; ids that weren't found are left out. */
  loadMany(ids: readonly unknown[]): Promise<V[]>;
}

export function createBatchLoader<V>(
  fetchMany: (ids: string[]) => Promise<V[]>,
  idOf: (value: V) => string
): BatchLoader<V> {
  const cache = new Map<string, Promise<V | undefined>>();
  let pending: Map<string, (v: V | undefined) => void> | null = null;
  let failPending: Array<(e: unknown) => void> = [];

  const flush = async () => {
    const batch = pending!;
    const fails = failPending;
    pending = null;
    failPending = [];
    try {
      const found = await fetchMany([...batch.keys()]);
      const byId = new Map(found.map((v) => [idOf(v), v]));
      for (const [id, resolve] of batch) resolve(byId.get(id));
    } catch (err) {
      for (const id of batch.keys()) cache.delete(id); // let a later load try again
      for (const reject of fails) reject(err);
    }
  };

  const load = (id: string): Promise<V | undefined> => {
    const key = String(id);
    const hit = cache.get(key);
    if (hit) return hit;
    if (!pending) {
      pending = new Map();
      // After the current tick, so every resolver started in it joins the same batch.
      setTimeout(() => void flush(), 0);
    }
    const queue = pending;
    const promise = new Promise<V | undefined>((resolve, reject) => {
      queue.set(key, resolve);
      failPending.push(reject);
    });
    cache.set(key, promise);
    return promise;
  };

  return {
    load,
    async loadMany(ids) {
      const values = await Promise.all(ids.map((id) => load(String(id))));
      return values.filter((v): v is Awaited<V> => v !== undefined) as V[];
    },
  };
}
