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
				return { processed: 0, failures: 0, results: [] };
			}

			const rawResults = await Promise.allSettled(
				activeSinks.map(async (sink, index) => {
					if (typeof sink.send !== 'function') {
						throw new Error(`Sink #${index} is missing 'send' method`);
					}

					const sinkName = sink.name || `Sink#${index}`;

					try {
            const result = await sink.send(threat, context);
						return { sinkName, result	 };
					} catch (err) {
						if (err && typeof err === 'object') err.sinkName = sinkName;
						throw err;
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