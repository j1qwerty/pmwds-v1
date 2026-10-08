const MAX_CONCURRENT_READS = 2;

/**
 * A read that never settles would hold one of only two slots forever and silently starve every
 * other GET on the page - the failure mode this queue exists to prevent. So each read races a
 * deadline: when it expires the queued caller is rejected and the slot is released, even if the
 * underlying fetch is still hanging.
 */
const READ_TIMEOUT_MS = 45_000;

type QueueJob = {
  start: () => Promise<unknown>;
  settle: (outcome: { ok: true; value: unknown } | { ok: false; error: unknown }) => void;
};

let activeReads = 0;
const queue: QueueJob[] = [];
const inFlight = new Map<string, Promise<unknown>>();

function drainQueue() {
  while (activeReads < MAX_CONCURRENT_READS && queue.length > 0) {
    const job = queue.shift();
    if (!job) return;

    activeReads += 1;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Request timed out after ${READ_TIMEOUT_MS / 1000}s.`)),
        READ_TIMEOUT_MS,
      );
    });

    Promise.race([job.start(), deadline]).then(
      (value) => job.settle({ ok: true, value }),
      (error) => job.settle({ ok: false, error }),
    ).finally(() => {
      if (timer !== undefined) clearTimeout(timer);
      activeReads -= 1;
      drainQueue();
    });
  }
}

/**
 * Coalesces identical reads and caps total GET/HEAD concurrency.
 *
 * Two components rendering the same data at once share one request instead of issuing two, which
 * is what previously made page transitions feel like a burst of queries.
 */
export function runCoordinatedRead<T>(key: string, start: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = new Promise<T>((resolve, reject) => {
    const job: QueueJob = {
      start: () => start(),
      settle: (outcome) => {
        if (outcome.ok) resolve(outcome.value as T);
        else reject(outcome.error);
      },
    };
    queue.push(job);
    drainQueue();
  }).finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, promise);
  return promise;
}

/** Drops queued reads and forgets in-flight keys. Used when the session goes away. */
export function resetCoordinatedReads() {
  queue.length = 0;
  inFlight.clear();
}