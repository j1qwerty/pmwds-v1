const MAX_CONCURRENT_READS = 3;

type QueueJob<T> = {
  run: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

let activeReads = 0;
const queue: QueueJob<unknown>[] = [];
const inFlight = new Map<string, Promise<unknown>>();

function drainQueue() {
  while (activeReads < MAX_CONCURRENT_READS && queue.length > 0) {
    const job = queue.shift();
    if (!job) return;

    activeReads += 1;
    job.run()
      .then(job.resolve)
      .catch(job.reject)
      .finally(() => {
        activeReads -= 1;
        drainQueue();
      });
  }
}

/**
 * Coalesces identical GET/HEAD requests and caps read concurrency.
 * Mutations are intentionally handled outside this coordinator.
 */
export function runCoordinatedRead<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = new Promise<T>((resolve, reject) => {
    queue.push({ run, resolve, reject } as QueueJob<unknown>);
    drainQueue();
  }).finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, promise);
  return promise;
}
