export async function withRetry(fn, maxRetries = 3, delay = 500) {
  let lastErr;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === maxRetries - 1) break;

      const waitTime = delay * Math.pow(2, i);
      console.warn(`[BRS] Attempt ${i + 1} failed. Retrying in ${waitTime}ms...`);

      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  throw lastErr;
}