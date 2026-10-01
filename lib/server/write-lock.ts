/**
 * Per-project write serialization (Blueprint §8.4).
 *
 * "Write locks: SemaphoreSlim(1,1) per project for all write operations.
 * Reads: lock-free, parallel."
 *
 * That is an in-process lock, and this is the same thing: a FIFO mutex keyed by
 * project id, so a document `$inc` or a file upload for project A can never
 * interleave with another write for project A, while every other project — and
 * every read — proceeds in parallel.
 *
 * Scope note: this is per process, exactly like the spec's semaphore. A
 * multi-instance deployment additionally relies on the database's own row
 * locking (Postgres `UPDATE` takes a row lock; SQLite serializes writers), which
 * is why the lock is an ordering aid rather than the only correctness boundary.
 * The queue is unbounded on purpose: a bounded queue would need a rejection
 * policy, and dropping a write is worse than waiting for it.
 */

const chains = new Map<string, Promise<void>>();
const depths = new Map<string, number>();

/** Wait until this project has no write in flight, run `fn`, then release. */
export async function withProjectWriteLock<T>(projectId: number, fn: () => Promise<T>): Promise<T> {
  const key = String(projectId);
  const previous = chains.get(key) ?? Promise.resolve();
  // A fresh promise everyone behind us waits on; the previous holder resolves it.
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  chains.set(
    key,
    previous.then(() => current),
  );
  depths.set(key, (depths.get(key) ?? 0) + 1);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    const remaining = (depths.get(key) ?? 1) - 1;
    if (remaining <= 0) {
      depths.delete(key);
      chains.delete(key);
    } else {
      depths.set(key, remaining);
    }
  }
}

/** Number of writers currently queued or running for a project (tests). */
export function writeLockDepth(projectId: number): number {
  return depths.get(String(projectId)) ?? 0;
}

/** True when a project has no write in flight. */
export function isWriteLockIdle(projectId: number): boolean {
  return writeLockDepth(projectId) === 0;
}
