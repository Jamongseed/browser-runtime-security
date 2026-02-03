export async function runWithLock(lockName, callback) {
  if (navigator.locks && typeof navigator.locks.request === 'function') {
    return navigator.locks.request(lockName, async () => {
      try {
        return await callback();
      } catch (err) {
        console.error(`[BRS] Error occurred in lock: ${lockName}`, err);
        throw err;  
      }
    });
  } else {
    // 락을 못 쓰는 환경이면 동시성 제어는 포기하더라도 기능은 수행
    return await callback();
  }
}