export function createDispatcher(sinks = []) {
	if (!Array.isArray(sinks)) {
		console.warn("[BRS] Sinks must be an array. Resetting to empty.");
		sinks = [];
	}

	return {
		async dispatch(threat, context = {}) {
			const activeSinks = sinks.filter(sink => {
				try {
					return !sink.shouldHandle || sink.shouldHandle(threat, context);
				} catch (err) {
					console.error("[BRS] Sink filter check failed:", err);
					return false;
				}
			});

			if (activeSinks.length === 0) {
				return { processed: 0, failures: 0 };
			}

			const results = await Promise.allSettled(
				activeSinks.map(async (sink, index) => {
					if (typeof sink.send !== 'function') {
						throw new Error(`Sink #${index} is missing 'send' method`);
					}

					const sinkName = sink.name || `Sink#${index}`;

					try {
            const result = await sink.send(threat, context);
						return { sinkName, result };
					} catch (err) {
						err.sinkName = sinkName;
						throw err;
					}
				})
			);

			const failures = results.filter(r => r.status === "rejected");

			if (failures.length > 0) {
				console.warn(`[BRS] ${failures.length}/${activeSinks.length} sinks failed.`);
				
				failures.forEach(f => {
					const name = f.reason.sinkName || "Unknown Sink";
					console.error(`[BRS] - [${name}] Failed:`, f.reason.message || f.reason);
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