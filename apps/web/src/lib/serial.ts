export interface SerialQueue {
  run<T>(task: () => Promise<T>): Promise<T>;
}

/** One task at a time, in call order. A failed task does not block the next one. */
export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const result = tail.then(() => task());
      tail = result.catch(() => undefined);
      return result;
    },
  };
}
