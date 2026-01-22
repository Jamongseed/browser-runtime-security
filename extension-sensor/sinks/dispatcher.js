import { SINK_CONFIG } from '../config.js';

export function createDispatcher(sinks = []) {
  if (!Array.isArray(sinks)) {
    console.warn("[BRS] Sinks must be an array. Resetting to empty.");
    sinks = [];
  }

  return {
    sinks,
    async dispatch(threat, context = {}) {
      const activeSinks = sinks.filter((sink, index) => {
        const sinkName = sink.name || `Sink#${index}`;
        try {
          return !sink.shouldHandle || sink.shouldHandle(threat, context);
        } catch (err) {
          console.error(`[BRS] [${sinkName}] Sink filter check failed:`, err);
          return false;
        }
      });

      if (activeSinks.length === 0) {
        return { processed: 0, failures: 0, results: [] };
      }

      const rawResults = await Promise.allSettled(
        activeSinks.map(async (sink, index) => {
          const sinkName = sink.name || `Sink#${index}`;

          if (typeof sink.send !== 'function') {
            throw new Error(`[${sinkName}] Sink is missing 'send' method`);
          }

          // 데이터 오염 방지를 위해 각 Sink에게 복사본 제공
          let clonedThreat, clonedContext;
          try {
            clonedThreat = structuredClone(threat);
            clonedContext = structuredClone(context);
          } catch (e) {
            // 복사 실패시 원본 사용
            clonedThreat = threat;
            clonedContext = context;
          }

          let timeoutId;
          try {
            const result = await Promise.race([
              sink.send(clonedThreat, clonedContext),
              new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                  reject(new Error(`Timeout (${SINK_CONFIG.TIMEOUT_MS}ms) exceeded`))
                }, SINK_CONFIG.TIMEOUT_MS);
              })
            ]);
            return { sinkName, result };
          } catch (err) {
            if (err && typeof err === 'object') {
              try { err.sinkName = sinkName; } catch (_) { }
            }
            throw err;
          } finally {
            if (timeoutId) clearTimeout(timeoutId);
          }
        })
      );

      const results = rawResults.map(r => {
        if (r.status === "fulfilled") {
          return {
            status: "fulfilled",
            sinkName: r.value.sinkName,
            result: r.value.result
          };
        } else {
          const err = r.reason;
          return {
            status: "rejected",
            sinkName: err?.sinkName || "Unknown Sink",
            error: err?.message || String(err) || "Unknown Sink"
          };
        }
      })

      const failures = results.filter(r => r.status === "rejected");

      if (failures.length > 0) {
        console.warn(`[BRS] ${failures.length}/${activeSinks.length} sinks failed.`);

        failures.forEach(f => {
          console.error(`[BRS] - [${f.sinkName}] Failed:`, f.error);
        });
      }

      return {
        processed: activeSinks.length,
        failures: failures.length,
        results
      };
    }
  };
}