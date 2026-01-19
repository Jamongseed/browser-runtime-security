import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import TitleCard from "../../components/Cards/TitleCard";
import { parseQuery, buildQuery } from "../common/query";
import { getEventList } from "../aws/AwsSearch";

/* =======================
 * util
 * ======================= */
function toYMD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getDefaultRange(days = 30) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { startDay: toYMD(start), endDay: toYMD(end) };
}

function severityBadgeClass(sev) {
  const s = String(sev || "").toUpperCase();
  if (s === "HIGH") return "badge-error";
  if (s === "MEDIUM") return "badge-warning";
  return "badge-success";
}

const SEV_OPTIONS = ["HIGH", "MEDIUM", "LOW"];

/* =======================
 * Component
 * ======================= */
export default function EventListPage() {
  const location = useLocation();
  const navigate = useNavigate();

  /* -----------------------
   * 기본값 & URL query
   * ----------------------- */
  const query = useMemo(() => parseQuery(location.search), [location.search]);
  const defaultRange = useMemo(() => getDefaultRange(30), []);

  /* -----------------------
   * filter state (기본 조회값)
   * ----------------------- */
  const [startDay, setStartDay] = useState(
    query.start || defaultRange.startDay
  );
  const [endDay, setEndDay] = useState(
    query.end || defaultRange.endDay
  );
  const [severities, setSeverities] = useState(
    query.sev.length ? query.sev : ["HIGH", "MEDIUM", "LOW"]
  );
  const [domainInclude, setDomainInclude] = useState(query.domain || "");
  const [domainExclude, setDomainExclude] = useState(query.domainNot || "");
  const [ruleInclude, setRuleInclude] = useState(query.ruleId || "");
  const [ruleExclude, setRuleExclude] = useState(query.ruleIdNot || "");
  const [installId, setInstallId] = useState(query.installId || "");

  /* -----------------------
   * list / ui state
   * ----------------------- */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  /* =======================
   * 데이터 조회 (기본 + 필터)
   * ======================= */
  useEffect(() => {
    let alive = true;

    async function fetchEvents() {
      setLoading(true);
      try {
        const list = await getEventList({
          startDay,
          endDay,
          severities,
          domainInclude,
          domainExclude,
          ruleInclude,
          ruleExclude,
          installId,
          limit: 100,        // ✅ 기본 100개
          newest: true,      // (서버가 지원한다면)
        });

        if (!alive) return;

        // ✅ 최신순 정렬 (보험)
        const sorted = [...list].sort(
          (a, b) =>
            new Date(b.ts).getTime() - new Date(a.ts).getTime()
        );

        setRows(sorted);
      } catch (e) {
        if (!alive) return;
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchEvents();
    return () => { alive = false; };
  }, [
    startDay,
    endDay,
    severities,
    domainInclude,
    domainExclude,
    ruleInclude,
    ruleExclude,
    installId,
  ]);

  /* =======================
   * Apply → URL 반영
   * ======================= */
  const applyFilters = () => {
    const qs = buildQuery({
      start: startDay,
      end: endDay,
      sev: severities,
      domain: domainInclude,
      domainNot: domainExclude,
      ruleId: ruleInclude,
      ruleIdNot: ruleExclude,
      installId,
    });
    navigate(`/app/events${qs}`);
  };

  /* =======================
   * Severity toggle
   * ======================= */
  const toggleSeverity = (sev) => {
    setSeverities((prev) => {
      if (prev.includes(sev)) {
        const next = prev.filter((s) => s !== sev);
        return next.length ? next : prev;
      }
      return [...prev, sev];
    });
  };

  /* =======================
   * Render
   * ======================= */
  return (
    <TitleCard title="Event List" topMargin="mt-2">
      {/* ===== Filters ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-4">
        <div className="lg:col-span-2">
          <div className="text-xs opacity-60">start</div>
          <input
            className="input input-sm input-bordered w-full"
            value={startDay}
            onChange={(e) => setStartDay(e.target.value)}
          />
        </div>

        <div className="lg:col-span-2">
          <div className="text-xs opacity-60">end</div>
          <input
            className="input input-sm input-bordered w-full"
            value={endDay}
            onChange={(e) => setEndDay(e.target.value)}
          />
        </div>

        <div className="lg:col-span-3">
          <div className="text-xs opacity-60">Severity</div>
          <div className="flex gap-2">
            {SEV_OPTIONS.map((s) => (
              <button
                key={s}
                className={`btn btn-xs ${
                  severities.includes(s) ? "btn-primary" : "btn-ghost"
                }`}
                onClick={() => toggleSeverity(s)}
                type="button"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="text-xs opacity-60">Domain include</div>
          <input
            className="input input-sm input-bordered w-full"
            value={domainInclude}
            onChange={(e) => setDomainInclude(e.target.value)}
          />
        </div>

        <div className="lg:col-span-2">
          <div className="text-xs opacity-60">Domain exclude</div>
          <input
            className="input input-sm input-bordered w-full"
            value={domainExclude}
            onChange={(e) => setDomainExclude(e.target.value)}
          />
        </div>

        <div className="lg:col-span-2">
          <div className="text-xs opacity-60">RuleId include</div>
          <input
            className="input input-sm input-bordered w-full"
            value={ruleInclude}
            onChange={(e) => setRuleInclude(e.target.value)}
          />
        </div>

        <div className="lg:col-span-2">
          <div className="text-xs opacity-60">RuleId exclude</div>
          <input
            className="input input-sm input-bordered w-full"
            value={ruleExclude}
            onChange={(e) => setRuleExclude(e.target.value)}
          />
        </div>

        <div className="lg:col-span-3">
          <div className="text-xs opacity-60">installId (exact)</div>
          <input
            className="input input-sm input-bordered w-full font-mono"
            value={installId}
            onChange={(e) => setInstallId(e.target.value)}
          />
        </div>

        <div className="lg:col-span-2 flex items-end">
          <button
            className="btn btn-sm btn-primary w-full"
            onClick={applyFilters}
            type="button"
          >
            Apply
          </button>
        </div>
      </div>

      {/* ===== Table ===== */}
      <div className="overflow-x-auto w-full">
        <table className="table w-full">
          <thead>
            <tr>
              <th>ts</th>
              <th>severity</th>
              <th>scoreDelta</th>
              <th>domain</th>
              <th>page</th>
              <th>ruleId</th>
              <th>installId</th>
              <th>eventId</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, idx) => (
              <tr key={`${e.eventId}-${idx}`} className="hover">
                <td className="font-mono text-xs">{e.ts}</td>
                <td>
                  <span className={`badge badge-sm ${severityBadgeClass(e.severity)}`}>
                    {e.severity}
                  </span>
                </td>
                <td className="font-mono">{e.scoreDelta}</td>
                <td className="font-mono break-all">{e.domain}</td>
                <td className="truncate max-w-xs">{e.page}</td>
                <td className="font-mono">{e.ruleId}</td>
                <td className="font-mono">{e.installId}</td>
                <td className="font-mono">
                  <Link to={`/app/events/${e.eventId}`} className="link link-primary">
                    {e.eventId}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {loading && (
          <div className="py-4 text-center opacity-60">로딩 중…</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="py-6 text-center text-gray-400">
            조회된 이벤트가 없습니다.
          </div>
        )}
      </div>
    </TitleCard>
  );
}
