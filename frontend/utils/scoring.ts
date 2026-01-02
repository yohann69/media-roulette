/**
 * Calculate score based on time taken
 * Formula: 1000 * e^(-0.0008 * time_taken_ms)
 * @param timeTakenMs Time taken in milliseconds
 * @returns Score (0 if time is invalid)
 */
export function calculateScore(timeTakenMs: number): number {
  if (timeTakenMs <= 0 || !isFinite(timeTakenMs)) {
    return 0;
  }
  
  // Score formula: 1000 * e^(-0.0008 * time_taken_ms)
  const score = 1000 * Math.exp(-0.0008 * timeTakenMs);
  
  // Round to nearest integer
  return Math.round(score);
}

/**
 * Get maximum possible score (when time is 0ms)
 */
export function getMaxScore(): number {
  return calculateScore(0);
}

