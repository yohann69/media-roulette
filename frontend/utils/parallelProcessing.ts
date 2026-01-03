/**
 * Process items in parallel batches with a maximum concurrency
 * Uses a proper semaphore-like pattern to limit concurrent operations
 */
export async function processInBatches<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  maxConcurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const executing: Array<{ promise: Promise<void>; index: number }> = [];

  const processItem = async (item: T, index: number): Promise<void> => {
    try {
      const result = await processor(item, index);
      results[index] = result;
    } catch (error) {
      console.error(`Error processing item ${index}:`, error);
      throw error;
    }
  };

  // Process all items with concurrency limit
  for (let i = 0; i < items.length; i++) {
    const promise = processItem(items[i], i);
    executing.push({ promise, index: i });

    // When we reach max concurrency, wait for at least one to finish
    if (executing.length >= maxConcurrency) {
      // Wait for any promise to complete
      await Promise.race(executing.map(e => e.promise));
      
      // Remove completed promises by checking which results are now set
      // We iterate backwards to safely remove items
      for (let j = executing.length - 1; j >= 0; j--) {
        if (results[executing[j].index] !== undefined) {
          executing.splice(j, 1);
          break; // Remove only one at a time
        }
      }
      
      // Fallback: if we couldn't find a completed one, remove the first
      // (this shouldn't happen often, but handles edge cases)
      if (executing.length >= maxConcurrency) {
        executing.shift();
      }
    }
  }

  // Wait for all remaining promises to complete
  await Promise.all(executing.map(e => e.promise));
  return results;
}
