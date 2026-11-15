/**
 * Runs `processor` over `items` with at most `maxConcurrency` calls in flight.
 * Results keep the order of `items`. Rejects with the first error thrown.
 */
export async function processInBatches<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  maxConcurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await processor(items[index], index);
    }
  };

  const workerCount = Math.max(1, Math.min(maxConcurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
