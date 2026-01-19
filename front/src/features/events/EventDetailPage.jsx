// features/events/EventDetailPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getEventBody } from "./eventApi";

export default function EventDetailPage() {
  const { eventId: rawEventId } = useParams();
  const eventId = useMemo(() => decodeURIComponent(rawEventId || ""), [rawEventId]);

  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const from = sp.get("from");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setError("");
      try {
        const res = await getEventBody({ eventId });
        if (!alive) return;
        setBody(res);
      } catch (e) {
        if (!alive) return;
        setError(String(e?.message || e));
        setBody(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (eventId) run();
    return () => {
      alive = false;
    };
  }, [eventId]);

  const payloadJson = body?.payload?.payloadJson;
  const truncated = Boolean(body?.payload?.payloadTruncated);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => navigate(from ? decodeURIComponent(from) : -1)}>
          ← Back
        </button>
        <div style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>
          {eventId}
        </div>
      </div>

      {loading && <div style={{ opacity: 0.7 }}>loading…</div>}
      {error && <div style={{ color: "crimson" }}>{error}</div>}

      {!loading && !error && body && (
        <div style={{ display: "grid", gap: 12 }}>
          <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>META</div>
            <pre style={{ margin: 0, fontSize: 12, overflow: "auto" }}>
              {JSON.stringify(body.meta, null, 2)}
            </pre>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700 }}>PAYLOAD</div>
              {truncated && (
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  (payloadTruncated=true)
                </div>
              )}
            </div>
            <pre style={{ margin: 0, fontSize: 12, overflow: "auto" }}>
              {JSON.stringify(payloadJson, null, 2)}
            </pre>
          </section>
        </div>
      )}
    </div>
  );
}
