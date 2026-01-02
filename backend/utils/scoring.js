/**
 * Calculate score based on time taken
 * Formula: 1000 * e^(-0.0008 * time_taken_ms)
 * @param {number} timeTakenMs Time taken in milliseconds
 * @returns {number} Score (0 if time is invalid)
 */
function calculateScore(timeTakenMs) {
    if (timeTakenMs <= 0 || !isFinite(timeTakenMs)) {
        return 0;
    }

    // Score formula: 1000 * e^(-0.0008 * time_taken_ms)
    const score = 1000 * Math.exp(-0.0008 * timeTakenMs);

    // Round to nearest integer
    return Math.round(score);
}

module.exports = { calculateScore };

