export async function runWithLock(lockName, callback) {
  if (navigator.locks && typeof navigator.locks.request === 'function') {
    return navigator.locks.request(lockName, callback);
  } else {
    // 락을 못 쓰는 환경이면 동시성 제어는 포기하더라도 기능은 수행
    return callback();
  }
}