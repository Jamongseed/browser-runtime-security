// src/features/admin_front/detail/index.js
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import TitleCard from "../../../components/Cards/TitleCard";
import { getEventDetail, getRuleDescription } from "../../aws/AwsSearch";
import { setInstallId } from "../../../app/auth";

/** -----------------------------
 * Utils
 * ------------------------------ */
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function fmtTs(ts) {
  const n = toNum(ts);
  if (!n) return "-";
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString("ko-KR");
}
function relTime(tsMs) {
  const n = toNum(tsMs);
  if (!n) return "";
  const diff = Date.now() - n;
  if (!Number.isFinite(diff)) return "";
  const abs = Math.abs(diff);
  const sec = Math.round(abs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  const label =
    day >= 1 ? `${day}일` : hr >= 1 ? `${hr}시간` : min >= 1 ? `${min}분` : `${sec}초`;
  return diff >= 0 ? `${label} 전` : `${label} 후`;
}
function sevBadgeClass(sev) {
  const s = String(sev || "").toUpperCase();
  if (s === "HIGH") return "badge badge-error";
  if (s === "MEDIUM") return "badge badge-warning";
  if (s === "LOW") return "badge badge-success";
  return "badge";
}
function sevKo(sev) {
  const s = String(sev || "").toUpperCase();
  if (s === "HIGH") return "고위험";
  if (s === "MEDIUM") return "주의";
  if (s === "LOW") return "정보";
  return "알 수 없음";
}
function clampText(s, max = 1200) {
  const t = String(s ?? "");
  return t.length > max ? t.slice(0, max) + "…" : t;
}
function safeJsonParse(v) {
  if (v == null) return null;
  if (typeof v === "object") return v;
  if (typeof v !== "string") return { raw: String(v) };
  try {
    return JSON.parse(v);
  } catch {
    return { raw: v };
  }
}
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
function hostFromUrl(urlLike) {
  if (!urlLike) return "";
  try {
    return new URL(urlLike).hostname;
  } catch {
    return "";
  }
}


function normalizeSrc(raw = {}) {
  // 다양한 센서/수집기에서 키 이름이 조금씩 달라져도 VM이 깨지지 않도록 alias를 정규화
  const chain = raw.chain || {};
  return {
    ...raw,

    // url alias (script/iframe/sw 등)
    url: raw.url ?? raw.abs ?? raw.src ?? raw.href,
    abs: raw.abs ?? raw.url ?? raw.src,
    src: raw.src ?? raw.url ?? raw.abs,
    scriptUrl: raw.scriptUrl ?? raw.scriptURL ?? raw.abs ?? raw.url,
    swScriptUrl: raw.swScriptUrl ?? raw.scriptUrl ?? raw.scriptURL ?? raw.abs ?? raw.url,

    // form alias
    action: raw.action ?? raw.actionResolved ?? raw.actionAttr ?? raw.formAction,
    actionOrigin: raw.actionOrigin ?? raw.targetOrigin,
    pageOrigin: raw.pageOrigin ?? raw.origin,

    // cross-site 의미를 분리해서 보존
    crossSite: raw.crossSite ?? raw.cross_site,
    initiatorCrossSite: raw.initiatorCrossSite ?? raw.initiator_cross_site,

    // chain alias
    chain: {
      ...chain,
      norm: chain.norm ?? raw.norm,
      reinjectCount: chain.reinjectCount ?? raw.reinjectCount,
      startedAt: chain.startedAt ?? raw.startedAt,
      incidentId: chain.incidentId ?? raw.incidentId,
      scriptId: chain.scriptId ?? raw.scriptId,
    },
  };
}


function shouldShowValue(value, options = {}) {
  const {
    hideZero = true,
    hideDash = true,
    hideFalse = false,
  } = options;

  if (value == null) return false;
  if (hideDash && value === "-") return false;
  if (hideZero && typeof value === "number" && value === 0) return false;
  if (hideFalse && value === false) return false;

  return true;
}

/** -----------------------------
 * UI atoms
 * ------------------------------ */
function Section({ title, children }) {
  return (
    <div className="card bg-base-100 border">
      <div className="card-body gap-3">
        <div className="font-bold">{title}</div>
        {children}
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint }) {
  return (
    <div className="p-3 rounded-xl border bg-base-100">
      <div className="text-xs opacity-60">{label}</div>
      <div className="mt-1 text-lg font-bold">{value ?? "-"}</div>
      {hint ? <div className="mt-1 text-xs opacity-60">{hint}</div> : null}
    </div>
  );
}

function KV({ k, v, copy, mono, link, hideZero = true, hideDash = true }) {
  // ✅ 0 / "-" / null 이면 행 자체 숨김
  if (!shouldShowValue(v, { hideZero, hideDash })) return null;

  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-base-200">
      <div className="text-xs opacity-60 min-w-[140px]">{k}</div>
      <div className="flex-1 text-left">
        {link ? (
          <a className="link link-primary break-all" href={link} target="_blank" rel="noreferrer">
            {String(v)}
          </a>
        ) : (
          <div className={`break-all`}>{String(v)}</div>
        )}
      </div>
      {copy ? (
        <button className="btn btn-xs btn-ghost" onClick={() => copyToClipboard(copy)}>
          Copy
        </button>
      ) : null}
    </div>
  );
}

function JsonViewer({ title, obj, raw }) {
  const [mode, setMode] = useState("tree"); // tree | raw
  const pretty = useMemo(() => {
    if (mode === "raw") return raw || "";
    try {
      return obj ? JSON.stringify(obj, null, 2) : raw || "";
    } catch {
      return raw || "";
    }
  }, [mode, obj, raw]);

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-base-200 border-b">
        <div className="text-sm font-semibold">{title}</div>
        <div className="flex items-center gap-2">
          <button
            className={`btn btn-xs ${mode === "tree" ? "btn-neutral" : "btn-ghost"}`}
            onClick={() => setMode("tree")}
          >
            Tree
          </button>
          <button
            className={`btn btn-xs ${mode === "raw" ? "btn-neutral" : "btn-ghost"}`}
            onClick={() => setMode("raw")}
          >
            Raw
          </button>
          <button
            className="btn btn-xs btn-outline"
            onClick={async () => {
              const ok = await copyToClipboard(pretty || "");
              alert(ok ? "Copied" : "Copy failed");
            }}
          >
            Copy
          </button>
        </div>
      </div>
      <pre className="p-3 text-xs break-all overflow-auto max-h-[520px] bg-base-100">
        {pretty || "-"}
      </pre>
    </div>
  );
}

/** -----------------------------
 * ✅ Next step: type → category → VM (single-file integration)
 * ------------------------------ */

// 1) Category enum (고정)
const EventCategory = {
  SYSTEM: "system",
  MIRRORING: "xhr_mirroring",
  INJECTED_SCRIPT_SCORE: "scoring",
  DOM_INJECTION: "dom_injection",
  PERSISTENCE: "persistence",
  FORM_FLOW: "form_flow",
  NETWORK: "network",
  CODE_EXEC: "code_exec",
  XSS_DATA: "xss_data",
  UI_HIJACK: "ui_hijack",
  PROTO_TAMPER: "proto_tamper",
  MUTATION_OBSERVER: "mutation_observer",
  UNKNOWN: "unknown",
};

// 2) type → category (늘어나는 곳은 여기 + VM(필요하면))
const TYPE_TO_CATEGORY = {
  // system
  SENSOR_READY: EventCategory.SYSTEM,

  // mirroring
  XHR_MIRRORING_SUSPECT: EventCategory.MIRRORING,

  // score
  INJECTED_SCRIPT_SCORE: EventCategory.INJECTED_SCRIPT_SCORE,

  // DOM/script/iframe
  DYN_SCRIPT_INSERT: EventCategory.DOM_INJECTION,
  DYN_IFRAME_INSERT: EventCategory.DOM_INJECTION,
  IFRAME_INSERT: EventCategory.DOM_INJECTION,
  HIDDEN_IFRAME_INSERT: EventCategory.DOM_INJECTION,

  // persistence
  SW_REGISTER: EventCategory.PERSISTENCE,
  SW_REGISTRATIONS_PRESENT: EventCategory.PERSISTENCE,
  SW_PERSISTENCE_ACTIVE: EventCategory.PERSISTENCE,
  PERSISTENCE_REINJECT: EventCategory.PERSISTENCE,

  // form/phishing
  FORM_SUBMIT: EventCategory.FORM_FLOW,
  FORM_ACTION_PARSE_FAIL: EventCategory.FORM_FLOW,

  // network
  SUSP_NETWORK_CALL: EventCategory.NETWORK,

  // code exec / obfuscation
  SUSP_ATOB_CALL: EventCategory.CODE_EXEC,
  SUSP_EVAL_CALL: EventCategory.CODE_EXEC,
  SUSP_FUNCTION_CONSTRUCTOR_CALL: EventCategory.CODE_EXEC,

  // xss / sensitive data
  SUSP_DOM_XSS: EventCategory.XSS_DATA,
  SENSITIVE_DATA_ACCESS: EventCategory.XSS_DATA,

  // ui hijack
  INVISIBLE_LAYER_DETECTED: EventCategory.UI_HIJACK,
  LINK_HREF_SWAP_DETECTED: EventCategory.UI_HIJACK,

  // proto tamper
  PROTO_TAMPER: EventCategory.PROTO_TAMPER,

  // mutation observer
  MUTATION_OBSERVER_REGISTER: EventCategory.MUTATION_OBSERVER,
  MUTATION_OBSERVER_TRIGGER: EventCategory.MUTATION_OBSERVER,
};

// KPI 표준 포맷(단순화)
function kpiText(key, label, value, hint) {
  return { key, label, kind: "text", value: value ?? "-", hint };
}
function kpiNum(key, label, value, hint) {
  const v = value == null ? "-" : value;
  return { key, label, kind: "number", value: v, hint };
}
function kpiBool(key, label, value, hint) {
  return { key, label, kind: "bool", value: !!value, hint };
}
function formatKpiValue(k) {
  if (!k) return "-";
  if (k.kind === "bool") return k.value ? "true" : "false";
  return k.value ?? "-";
}

// VM builders
function buildXhrMirroringSuspectVM({ detail, summary, parsedPayload, ruleOneLine }) {
  const det = detail?.details || parsedPayload || {};
  const d = det?.data || {};
  const net = d.network || {};
  const proto = d.proto || {};
  const an = d.analysis || {};
  const ev = d.evidence || d?.evidence || {};
  const chain = d.chain || {};

  const api = net.api || null;                 // fetch/xhr
  const method = net.method || null;           // GET/POST
  const crossSite = net.crossSite ?? null;     // true/false
  const url = net.abs || net.url || null;
  const targetOrigin = net.targetOrigin || null;

  const protoTarget = proto.target || null;    // XMLHttpRequest.prototype.send
  const protoRuleId = proto.ruleId || null;
  const protoSeverity = proto.severity || null;
  const dtMs = d.dtMs ?? null;
  const windowMs = d.windowMs ?? null;

  const suspicionScore = an.suspicionScore ?? null;
  const suspicionBand = an.suspicionBand || null;

  const stackHead = ev.stackHead || null;

  const incidentId = chain.incidentId || null;
  const scriptNorm = chain.norm || null;
  const scriptId = chain.scriptId || null;
  const reinjectCount = chain.reinjectCount ?? null;
  const startedAt = chain.startedAt ?? null;

  // 상단 KPI (필요한 것만)
  const kpis = [
    kpiNum("risk", "Risk Score", summary.scoreDelta ?? null, "scoreDelta"),
    kpiText("api", "API", api, "fetch/xhr 등"),
    kpiText("method", "Method", method, "GET/POST 등"),
    kpiBool("crossSite", "Cross-site", crossSite, "외부 도메인 전송 여부"),
  ].filter((k) => shouldShowValue(k.value, { hideZero: true, hideDash: true }));

  // Activity: 사건에서 “바로 판단에 필요한 값”
  const activityRows = [
    { label: "network.url", value: url },
    { label: "network.targetOrigin", value: targetOrigin },
    { label: "network.crossSite", value: crossSite },
    { label: "network.method", value: method },
    { label: "network.api", value: api },
    { label: "windowMs", value: windowMs },
    { label: "dtMs", value: dtMs },
    { label: "analysis.suspicionScore", value: suspicionScore },
    { label: "analysis.suspicionBand", value: suspicionBand },
  ].filter((r) => shouldShowValue(r.value, { hideZero: true, hideDash: true }));

  // Attribution: “누가 후킹했나 / 어떤 체인인가”
  const attributionRows = [
    { label: "proto.target", value: protoTarget },
    { label: "proto.ruleId", value: protoRuleId },
    { label: "proto.severity", value: protoSeverity },
    { label: "evidence.stackHead", value: stackHead },
    { label: "chain.norm", value: scriptNorm },
    { label: "chain.scriptId", value: scriptId },
    { label: "chain.incidentId", value: incidentId },
    { label: "chain.reinjectCount", value: reinjectCount },
  ].filter((r) => shouldShowValue(r.value, { hideZero: true, hideDash: true }));

  // 추천 조치 (항상 2~3줄 + 조건부)
  const recommendations = [
    {
      when: true,
      text: "XHR/Fetch 미러링 의심 이벤트입니다. 후킹(proto)과 네트워크 호출(network)을 함께 보고 실제 유출 경로인지 판단하세요.",
    },
    {
      when: true,
      text: "stackHead/initiator(로더) 기준으로 주입 주체를 추적하고, 동일 incidentId로 연관 이벤트를 묶어 타임라인으로 확인하세요.",
    },
    {
      when: !!protoTarget,
      text: `후킹 대상 확인: ${protoTarget} (${protoRuleId || "-"}) — 브라우저 통신 API를 가로채는 패턴일 수 있습니다.`,
    },
    {
      when: crossSite === true,
      text: `Cross-site 전송 감지: ${targetOrigin || "-"} — 외부 도메인으로 데이터가 전송될 가능성이 있어 우선순위를 높게 두세요.`,
    },
    {
      when: String(method || "").toUpperCase() === "POST",
      text: "POST 요청은 데이터 전송 가능성이 큽니다. body/헤더에 민감 정보가 포함되는지 확인하세요(가능하면 샘플링/마스킹 저장).",
    },
    {
      when: reinjectCount != null && reinjectCount > 0,
      text: `재주입 징후(reinjectCount=${reinjectCount}): 지속성/반복 주입 패턴 가능. chain.norm 기준으로 동일 로더를 탐색하세요.`,
    },
    {
      when: suspicionScore != null,
      text: `의심 점수: ${suspicionScore} (${suspicionBand || "-"}) — 점수 상승 요인(후킹+외부전송+체인)을 우선 확인하세요.`,
    },
  ].filter((r) => r.when);

  return {
    category: "mirroring",
    title: `의심 네트워크 호출`,
    oneLine:
      ruleOneLine ||
      "XHR 요청/응답이 복제되어 외부로 전송될 수 있는 정황이 감지되었습니다(정보 유출 위험).",
    kpis,
    activityRows,
    attributionRows,
    evidenceObj: det,
    recommendations,
  };
}

function buildInjectedScriptScoreVM({ detail, summary, parsedPayload, ruleOneLine }) {
  const det = detail?.details || {};
  const data = det?.data || parsedPayload?.data || {};

  const score = data.score ?? summary.scoreDelta ?? null;
  const modelId = data.modelId || "-";
  const modelUpdatedAt = data.modelUpdatedAt || "-";

  const hits = Array.isArray(data.hits) ? data.hits : [];
  const comboHits = Array.isArray(data.comboHits) ? data.comboHits : [];
  const comboBonus = data.comboBonus ?? 0;

  // top hit 3개 (가중치 큰 순)
  const topHits = [...hits].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,3);

  const chain = data.chain || {};
  const chainNorm = chain.norm || null;

  return {
    title: `악성 스크립트 주입 점수(${modelId})`,
    oneLine:
      ruleOneLine ||
      `총점 ${score}점 (hits ${hits.length}개, combo ${comboHits.length}개 +${comboBonus}) — 스크립트 주입/후킹/유출 조합 가능`,
    category: "scoring",

    // ✅ KPI는 “왜 점수가 큰지” 중심
    kpis: [
      kpiNum("score", "Total Score", score),
      kpiText("model", "Model", `${modelId} (${modelUpdatedAt})`, "scoring model"),
      kpiNum("hits", "Signals", hits.length, "hit count"),
      kpiText("combo", "Combo", comboHits.length ? `+${comboBonus} (${comboHits.length})` : "-", "combo bonus"),
    ].filter(k => shouldShowValue(k.value, { hideZero: true, hideDash: true })),

    // ✅ Activity는 “근거 목록”을 보여줘야 함
    activityRows: [
      { label: "url", value: data.url || det.page || summary.page || null },
      { label: "norm", value: data.norm || null },
      { label: "sha256", value: data.sha256 || null },
      { label: "length", value: data.length ?? null },
      { label: "truncated", value: data.truncated ?? null },
      { label: "comboBonus", value: comboBonus || null },
      { label: "chain.norm", value: chainNorm },
      { label: "chain.incidentId", value: chain.incidentId || null },
      { label: "chain.scriptId", value: chain.scriptId || null },
      { label: "chain.reinjectCount", value: chain.reinjectCount ?? null },
    ].filter(r => shouldShowValue(r.value, { hideZero: true, hideDash: true })),

    // ✅ Evidence 탭에서 hits/combos를 표 형태로 보여주기 위해 vm에 “tables” 같은 확장 필드를 넣는 게 베스트
    tables: [
      {
        key: "top_hits",
        title: "Top Signals",
        columns: ["id", "axis", "signal", "score", "reason"],
        rows: topHits.map(h => [h.id, h.axis, h.signal, h.score, h.reason]),
      },
      {
        key: "all_hits",
        title: `All Signals (${hits.length})`,
        columns: ["id", "axis", "category", "signal", "score"],
        rows: hits
          .sort((a,b)=>(b.score||0)-(a.score||0))
          .map(h => [h.id, h.axis, (h.category||"").replace("\n"," "), h.signal, h.score]),
      },
      {
        key: "combos",
        title: `Combo Hits (+${comboBonus})`,
        columns: ["comboId", "title", "bonus", "requires"],
        rows: comboHits.map(c => [c.comboId, c.title, c.bonus, (c.requires||[]).join(", ")]),
      },
    ],

    // ✅ 추천조치는 “가장 위험한 조합”을 바로 때려줘야 함
    recommendations: [
      { when: true, text: "이 이벤트는 ‘행위’가 아니라 ‘스코어링 결과’입니다. Signals/Combo를 근거로 즉시 조사 우선순위를 올리세요." },
      { when: true, text: `sha256(${data.sha256 || "-"}) 기준으로 동일 스크립트 재발 여부(다른 session/install) 검색을 권장합니다.` },

      // 강한 조합(예: network hook → exfil)
      { when: comboHits.some(c => (c.requires||[]).includes("A_XHR_OPEN_SEND_OVERRIDE") && (c.requires||[]).includes("A_FETCH_XHR_ABS_URL")),
        text: "Network hook → exfil 조합 감지: XHR/fetch 후킹으로 모든 요청을 가로채 외부로 전송 가능. 차단/격리 우선." },

      // overlay/clickjacking 시그널이 포함되면
      { when: hits.some(h => h.id === "B_FULLSCREEN_OVERLAY"),
        text: "Fullscreen overlay 시그널 포함: 클릭 하이재킹(UI redress) 가능. UI_HIJACK 이벤트와 같은 incidentId로 연관 분석." },

      // injection/loader 시그널 포함 시
      { when: hits.some(h => String(h.id||"").includes("SCRIPT") || String(h.id||"").includes("IFRAME")),
        text: "주입/로더 시그널 포함: 동적 <script>/<iframe> 삽입이 의심됩니다. initiator(삽입 주체)와 로드된 origin allowlist를 확인하세요." },

      // chain.norm이 있으면 체인 추적
      { when: !!chainNorm, text: `loader chain 추적: chain.norm(${chainNorm})를 기준으로 로더→페이로드 흐름을 타임라인으로 확인하세요.` },
    ].filter(r => r.when),
  };
}

function buildDomMutationVM({ detail, summary, ruleOneLine }) {
  const ms = summary.mutationSummary || {};
  const chain = summary.chain || {};
  const addedScripts = ms.addedScripts ?? null;
  const addedWithSrc = ms.addedWithSrc ?? null;
  const mutationCount = ms.mutationCount ?? null;
  const reinjectCount = chain.reinjectCount ?? null;

  return {
    title:
      summary.severity
        ? `${sevKo(summary.severity)}: DOM/스크립트 변조 의심`
        : "DOM/스크립트 변조 의심",
    oneLine: ruleOneLine || "DOM 변경 패턴에서 의심 행위가 감지되었습니다.",
    category: EventCategory.MUTATION_OBSERVER,
    kpis: [
      kpiNum("risk", "Risk Score", summary.scoreDelta),
      kpiNum("dom_mutations", "DOM Mutations", mutationCount, "mutationCount"),
      kpiNum("scripts_added", "Scripts Added", addedScripts, `with src: ${addedWithSrc ?? "-"}`),
      kpiNum("reinject", "Reinject", reinjectCount, "reinjectCount"),
    ],
    activityRows: [
      { label: "mutationCount", value: mutationCount ?? "-" },
      { label: "addedScripts", value: addedScripts ?? "-" },
      { label: "addedWithSrc", value: addedWithSrc ?? "-" },
      { label: "removedNodes", value: ms.removedNodes ?? "-" },
      { label: "addedIframes", value: ms.addedIframes ?? "-" },
      { label: "typeCounts.childList", value: ms.typeCounts?.childList ?? "-" },
    ],
    recommendations: [
      {
        when: (addedScripts ?? 0) > 0,
        text: `페이지에 동적으로 스크립트가 추가되었습니다(총 ${addedScripts ?? "-"}건). 정상 동작인지, 악성 스크립트 삽입 시도인지 확인이 필요합니다.`,
      },
      {
        when: (addedWithSrc ?? 0) > 0,
        text: `외부 출처에서 스크립트가 로드되었습니다(총 ${addedWithSrc ?? "-"}건). 승인되지 않은 도메인일 경우 공격 가능성이 있습니다.`,
      },
      {
        when: (ms.addedIframes ?? 0) > 0,
        text: `동적으로 iframe이 추가되었습니다(총 ${ms.addedIframes ?? "-"}건). 클릭재킹 또는 외부 콘텐츠 주입 가능성을 점검하세요.`,
      },
      {
        when: (mutationCount ?? 0) >= 10,
        text: `짧은 시간 내 다수의 DOM 변경이 발생했습니다(mutations=${mutationCount}). 자동화된 주입 또는 변조 패턴일 수 있습니다.`,
      },
      {
        when: (ms.removedNodes ?? 0) > 0 && (addedScripts ?? 0) > 0,
        text: `DOM 요소 제거 이후 스크립트가 추가되었습니다(removedNodes=${ms.removedNodes ?? "-"}). 은폐 목적의 변조 시나리오를 점검하세요.`,
      },
      {
        when: (reinjectCount ?? 0) > 0,
        text: `스크립트 제거 이후 재주입이 반복되는 패턴이 탐지되었습니다(재주입 횟수: ${reinjectCount ?? "-"}). 지속성(persistence) 공격 기법일 가능성이 높습니다.`,
      },
    ],
  };
}

function buildDomInjectionVM({ detail, summary, parsedPayload, ruleOneLine }) {
  const det = detail?.details || {};
  const data = det?.data || {};
  const pData = parsedPayload?.data || {};
  const src = normalizeSrc({ ...pData, ...data });

  const type = det.type || parsedPayload?.type || summary.type || "UNKNOWN";

  // 기대 가능한 필드(없어도 - 처리)
  const url = src.url || src.abs || src.src || "-";
  const targetOrigin = src.targetOrigin || src.targetHost || summary.targetHost || "-";
  const crossSite = src.crossSite ?? null;
  const initiatorCrossSite = src.initiatorCrossSite ?? null;
  const initiatorOrigin = src.initiatorOrigin || "-";

  const hidden = src.hidden ?? src.isHidden ?? (type === "HIDDEN_IFRAME_INSERT" ? true : null);

  const oneLine =
    ruleOneLine ||
    (type.includes("IFRAME")
      ? `iframe 삽입 감지${hidden ? " (숨김)" : ""}`
      : "동적 스크립트 삽입 감지");

  return {
    title: summary.severity ? `${sevKo(summary.severity)}: 스크립트/iframe 삽입` : "스크립트/iframe 삽입",
    oneLine,
    category: EventCategory.DOM_INJECTION,
    kpis: [
      kpiNum("risk", "Risk Score", summary.scoreDelta),
      kpiText("pattern", "Pattern", type, "삽입 유형"),
      kpiBool("cross_site", "Cross-site", crossSite, "대상 URL이 cross-site"),
      kpiBool("initiator_cross_site", "Initiator Cross-site", initiatorCrossSite, "외부 출처 트리거"),
      kpiText("target", "Target", targetOrigin, "전송/대상 도메인"),
    ],
    activityRows: [
      { label: "url/src", value: url },
      { label: "targetOrigin", value: targetOrigin },
      { label: "crossSite", value: crossSite == null ? "-" : String(!!crossSite) },
      { label: "hidden", value: hidden == null ? "-" : String(!!hidden) },
      { label: "initiatorUrl", value: src.initiatorUrl || summary.initiatorUrl || "-" },
      { label: "initiatorOrigin", value: initiatorOrigin },
      { label: "initiatorCrossSite", value: initiatorCrossSite == null ? "-" : String(!!initiatorCrossSite) },
      { label: "chain.norm", value: src.chain?.norm || summary.chain?.norm || "-" },
    ],
    recommendations: [
      { when: true, text: "동적 삽입은 주입/공급망 리스크가 있으니 삽입 대상 URL, initiator를 확인하세요." },
      { when: initiatorCrossSite === true || crossSite === true, text: "외부 출처 트리거/삽입: 공급망/주입 가능성(initiator/allowlist 검토)." },
      { when: hidden === true, text: "숨김 iframe: 클릭 하이재킹/피싱 유도 채널일 수 있습니다(즉시 조사)." },
    ],
  };
}

function buildPersistenceVM({ detail, summary, parsedPayload, ruleOneLine }) {
  const det = detail?.details || {};
  const data = det?.data || {};
  const pData = parsedPayload?.data || {};
  const src = normalizeSrc({ ...pData, ...data });

  const type = det.type || parsedPayload?.type || summary.type || "UNKNOWN";

  const scope = src.scope || src.swScope || "-";
  const scriptUrl = src.abs || src.injectSrc || src.scriptUrl || src.scriptURL || src.abs || src.swScriptUrl || src.url || "-";
  const initiatorCrossSite = src.initiatorCrossSite ?? null;
  const initiatorOrigin = src.initiatorOrigin || "-";
  const hasRegistrations = src.registrationsCount ?? src.count ?? null;
  const reinjectCount = src.reinjectCount ?? summary.chain?.reinjectCount ?? null;
  const chainNorm = src.norm || summary.chain?.norm || "-";

  const oneLine =
    ruleOneLine ||
    (type.includes("SW")
      ? "Service Worker 기반 지속성(persistence) 징후"
      : "재주입/지속성(reinject) 패턴 감지");

  return {
    title: summary.severity ? `${sevKo(summary.severity)}: 지속성(persistence) 의심` : "지속성(persistence) 의심",
    oneLine,
    category: EventCategory.PERSISTENCE,
    kpis: [
      kpiNum("risk", "Risk Score", summary.scoreDelta),
      kpiText("pattern", "Pattern", type, "persistence 유형"),
      kpiBool("initiator_cross_site", "Initiator Cross-site", initiatorCrossSite, "외부 출처 트리거"),
      kpiText("sw_script", "SW Script", scriptUrl, "scriptURL/abs"),
      kpiText("sw_scope", "Scope", scope, "SW scope"),
      kpiNum("registrations", "SW Reg", hasRegistrations, "registrationsCount"),
      kpiNum("reinject", "Reinject", reinjectCount, "reinjectCount"),
    ],
    activityRows: [
      { label: "swScope", value: scope },
      { label: "swScriptUrl", value: scriptUrl },
      { label: "initiatorUrl", value: src.initiatorUrl || summary.initiatorUrl || "-" },
      { label: "initiatorOrigin", value: initiatorOrigin },
      { label: "initiatorCrossSite", value: initiatorCrossSite == null ? "-" : String(!!initiatorCrossSite) },
      { label: "registrationsCount", value: hasRegistrations ?? "-" },
      { label: "reinjectCount", value: reinjectCount ?? "-" },
      { label: "injectSrc", value: src.injectSrc || "-" },
      { label: "chain.norm", value: chainNorm },
      { label: "chain.incidentId", value: src.chain?.incidentId || "-" },
      { label: "chain.scriptId", value: src.chain?.scriptId || "-" },
      { label: "chain.startedAt", value: src.chain?.startedAt ? fmtTs(src.chain.startedAt) : "-" },
    ],
    recommendations: [
      { when: true, text: "지속성 징후: SW 등록/활성 여부를 확인하고, 의심 스크립트 URL을 추적하세요." },
      { when: reinjectCount != null && reinjectCount > 0, text: "재주입 패턴: 반복 이벤트/동일 installId에서 연속 발생 여부를 확인하세요." },
      { when: initiatorCrossSite === true, text: "외부 출처에서 SW 등록을 트리거: supply-chain/주입 가능성(initiatorOrigin/initiatorUrl 우선 확인)." },
      { when: chainNorm && chainNorm !== "-", text: "chain.norm을 기준으로 동일 공격 체인을 묶어 분석하세요(incident/timeline 필요)." },
    ],
  };
}

function buildFormFlowVM({ detail, summary, parsedPayload, ruleOneLine }) {
  const det = detail?.details || {};
  const data = det?.data || {};
  const pData = parsedPayload?.data || {};
  const src = normalizeSrc({ ...pData, ...data });

  const type = det.type || parsedPayload?.type || summary.type || "UNKNOWN";

  const action = src.action || "-";
  const targetOrigin = src.actionOrigin || src.targetOrigin || summary.targetHost || "-";
  const pageOrigin = src.pageOrigin || summary.origin || "-";
  const mismatch = src.mismatch ?? src.crossOrigin ?? src.crossSite ?? null;
  const protoTamperSeen = src.protoTamperSeen ?? src.protoTampered ?? null;
  const initiatorCrossSite = src.initiatorCrossSite ?? null;
  const initiatorOrigin = src.initiatorOrigin || "-";

  const oneLine =
    ruleOneLine ||
    (mismatch === true
      ? "폼 제출 대상이 표시/기대값과 불일치합니다(피싱 가능성)"
      : "폼 제출 이벤트가 감지되었습니다");

  return {
    title: summary.severity ? `${sevKo(summary.severity)}: 폼 제출/피싱 의심` : "폼 제출/피싱 의심",
    oneLine,
    category: EventCategory.FORM_FLOW,
    kpis: [
      kpiNum("risk", "Risk Score", summary.scoreDelta),
      kpiBool("mismatch", "Mismatch", mismatch, "표시/대상 불일치"),
      kpiBool("proto", "Proto Tamper", protoTamperSeen, "후킹/변조 징후"),
      kpiText("target", "Target", targetOrigin, "전송 대상"),
    ],
    activityRows: [
      { label: "form.action", value: action },
      { label: "pageOrigin", value: pageOrigin },
      { label: "targetOrigin", value: targetOrigin },
      { label: "mismatch", value: mismatch == null ? "-" : String(!!mismatch) },
      { label: "protoTamperSeen", value: protoTamperSeen == null ? "-" : String(!!protoTamperSeen) },
      { label: "initiatorUrl", value: src.initiatorUrl || summary.initiatorUrl || "-" },
      { label: "initiatorOrigin", value: initiatorOrigin },
      { label: "initiatorCrossSite", value: initiatorCrossSite == null ? "-" : String(!!initiatorCrossSite) },
      { label: "chain.norm", value: src.chain?.norm || summary.chain?.norm || "-" },
    ],
    recommendations: [
      { when: true, text: "폼 제출은 자격증명 탈취와 직결됩니다(action/targetOrigin/initiator를 우선 확인하세요)." },
      { when: mismatch === true, text: "Mismatch가 true면 피싱 가능성이 높습니다(즉시 차단/탐지 확장 검토)." },
      { when: protoTamperSeen === true, text: "proto tamper 동반: 후킹 기반 탈취 가능성(관련 이벤트 탐색 권장)." },
    ],
  };
}

function buildCodeExecVM({ detail, summary, parsedPayload, ruleOneLine }) {
  const det = detail?.details || {};
  const data = det?.data || {};
  const pData = parsedPayload?.data || {};
  const src = normalizeSrc({ ...pData, ...data });

  const type = det.type || parsedPayload?.type || summary.type || "UNKNOWN";

  const api = src.api || type;
  const stackHead = src.stackHead || "-";
  const initiatorUrl = src.initiatorUrl || summary.initiatorUrl || "-";
  const initiatorCrossSite = src.initiatorCrossSite ?? summary.mismatch ?? null;

  const oneLine =
    ruleOneLine ||
    (type === "SUSP_EVAL_CALL"
      ? "eval 호출이 감지되었습니다(동적 코드 실행)"
      : type === "SUSP_FUNCTION_CONSTRUCTOR_CALL"
        ? "Function 생성자 호출이 감지되었습니다(동적 코드 실행)"
        : "atob 호출이 감지되었습니다(난독화 가능)");

  return {
    title: summary.severity ? `${sevKo(summary.severity)}: 동적 코드 실행 의심` : "동적 코드 실행 의심",
    oneLine,
    category: EventCategory.CODE_EXEC,
    kpis: [
      kpiNum("risk", "Risk Score", summary.scoreDelta),
      kpiText("api", "API", api, "eval/function/atob"),
      kpiBool("cross_site", "Cross-site Initiator", initiatorCrossSite, "외부 기원"),
      kpiText("initiator", "Initiator", initiatorUrl, "호출 위치"),
    ],
    activityRows: [
      { label: "type", value: type },
      { label: "initiatorUrl", value: initiatorUrl },
      { label: "initiatorCrossSite", value: initiatorCrossSite == null ? "-" : String(!!initiatorCrossSite) },
      { label: "stackHead", value: stackHead },
    ],
    recommendations: [
      { when: true, text: "동적 코드 실행은 악성 스크립트/난독화의 핵심 신호입니다(initiator/stack을 우선 확인)." },
      { when: initiatorCrossSite === true, text: "외부 기원 스크립트가 동적 실행을 유발: 공급망/주입 가능성(차단/allowlist)." },
    ],
  };
}

function buildXssDataVM({ detail, summary, parsedPayload, ruleOneLine }) {
  const det = detail?.details || {};
  const data = det?.data || {};
  const pData = parsedPayload?.data || {};
  const src = normalizeSrc({ ...pData, ...data });

  const type = det.type || parsedPayload?.type || summary.type || "UNKNOWN";

  const sink = src.sink || src.vector || "-";
  const target = src.target || src.key || src.cookieName || "-";
  const initiatorUrl = src.initiatorUrl || summary.initiatorUrl || "-";

  const oneLine =
    ruleOneLine ||
    (type === "SUSP_DOM_XSS"
      ? "DOM XSS 의심 패턴이 감지되었습니다"
      : "민감 데이터 접근이 감지되었습니다");

  return {
    title: summary.severity ? `${sevKo(summary.severity)}: XSS/민감데이터 의심` : "XSS/민감데이터 의심",
    oneLine,
    category: EventCategory.XSS_DATA,
    kpis: [
      kpiNum("risk", "Risk Score", summary.scoreDelta),
      kpiText("pattern", "Pattern", type, "XSS/Data"),
      kpiText("sink", "Sink/Vector", sink, "dangerous sink"),
      kpiText("target", "Target", target, "cookie/key"),
    ],
    activityRows: [
      { label: "sink/vector", value: sink },
      { label: "target", value: target },
      { label: "initiatorUrl", value: initiatorUrl },
      { label: "stackHead", value: src.stackHead || "-" },
    ],
    recommendations: [
      { when: true, text: "XSS/민감 데이터 접근은 피해 직결입니다(initiator 차단, 관련 스크립트/DOM 흐름 확인)." },
      { when: type === "SUSP_DOM_XSS", text: "DOM XSS 의심 시 sink/입력 경로를 추적하고 CSP/정화 로직을 점검하세요." },
    ],
  };
}

function parseProtoTarget(target) {
  const t = String(target || "");
  const match = t.match(/^([A-Za-z0-9_$.]+)\.prototype\.([A-Za-z0-9_$]+)$/);
  if (match) {
    const objRaw = match[1];
    const prop = match[2] || "-";

    const obj = objRaw === "XHR" ? "XMLHttpRequest"
      : objRaw === "Form" ? "HTMLFormElement"
      : objRaw;

    const family =
      obj === "XMLHttpRequest" ? "xhr"
      : obj === "HTMLFormElement" ? "form"
      : "other";

    return { family, prop, obj: `${obj}.prototype` };
  }
  // Backward compatibility for legacy strings
  if (t.startsWith("XHR.prototype.")) {
    return { family: "xhr", prop: t.split("XHR.prototype.")[1] || "-", obj: "XMLHttpRequest.prototype" };
  }
  if (t.startsWith("XMLHttpRequest.prototype.")) {
    return { family: "xhr", prop: t.split("XMLHttpRequest.prototype.")[1] || "-", obj: "XMLHttpRequest.prototype" };
  }
  if (t.startsWith("HTMLFormElement.prototype.")) {
    return { family: "form", prop: t.split("HTMLFormElement.prototype.")[1] || "-", obj: "HTMLFormElement.prototype" };
  }

  return { family: "other", prop: "-", obj: "-" };
}
function buildProtoTamperVM({ detail, summary, parsedPayload, ruleOneLine }) {
  const det = detail?.details || {};
  const data = det?.data || {};
  const pData = parsedPayload?.data || {};
  const src = normalizeSrc({ ...pData, ...data });

  const target = src.target || src.where || "-";
  const parsed = parseProtoTarget(target);

  const type = det.type || parsedPayload?.type || summary.type || "UNKNOWN";

  const prop = src.prop || src.property || src.targetProp || (parsed.prop !== "-" ? parsed.prop : "-");
  const obj = src.obj || src.object || (parsed.obj !== "-" ? parsed.obj : "-");
  const initiatorUrl = src.initiatorUrl || summary.initiatorUrl || "-";
  const initiatorCrossSite = src.initiatorCrossSite ?? summary.mismatch ?? null;

  const oneLine =
    ruleOneLine ||
    `브라우저 API 후킹(proto tamper) 징후: ${obj}.${prop}`;

  if (parsed.family === "xhr") return buildProtoTamperXhrVM({ detail, summary, parsedPayload, ruleOneLine, src, parsed });
  if (parsed.family === "form") return buildProtoTamperFormVM({ detail, summary, parsedPayload, ruleOneLine, src, parsed });

  return {
    title: summary.severity ? `${sevKo(summary.severity)}: API 후킹/변조 의심` : "API 후킹/변조 의심",
    oneLine,
    category: EventCategory.PROTO_TAMPER,
    kpis: [
      kpiNum("risk", "Risk Score", summary.scoreDelta),
      kpiText("prop", "Property", `${obj}.${prop}`, "tampered target"),
      kpiBool("cross_site", "Cross-site Initiator", initiatorCrossSite, "외부 기원"),
      kpiText("initiator", "Initiator", initiatorUrl, "변조 위치"),
    ],
    activityRows: [
      { label: "object", value: obj },
      { label: "property", value: prop },
      { label: "initiatorUrl", value: initiatorUrl },
      { label: "initiatorCrossSite", value: initiatorCrossSite == null ? "-" : String(!!initiatorCrossSite) },
      { label: "stackHead", value: src.stackHead || "-" },
    ],
    recommendations: [
      { when: true, text: "proto tamper는 다른 공격(폼 탈취/네트워크 유출/리다이렉트)의 기반입니다(연관 이벤트 탐색 필수)." },
      { when: initiatorCrossSite === true, text: "외부 기원 후킹: 공급망/주입 가능성(차단/검증 우선)." },
    ],
  };
}

function extractEndpointFromCode(code) {
  if (!code || typeof code !== "string") return null;

  // fetch("https://...")
  const fetchMatch = code.match(/fetch\s*\(\s*["'`](https?:\/\/[^"'`]+)["'`]/i);
  if (fetchMatch) return fetchMatch[1];

  // xhr.open("POST", "https://...")
  const xhrMatch = code.match(/\.open\s*\([^,]+,\s*["'`](https?:\/\/[^"'`]+)["'`]/i);
  if (xhrMatch) return xhrMatch[1];

  return null;
}

function buildProtoTamperXhrVM({ summary, ruleOneLine, src, parsed }) {
  const an = src.analysis || {};
  const ev = src.evidence || {};
  const targetFull =
    (parsed.obj && parsed.prop && parsed.obj !== "-" && parsed.prop !== "-")
      ? `${parsed.obj}.${parsed.prop}`
      : (src.target || "-");
  const initiator = an?.head?.file || an?.head?.url || an?.head || ev?.scriptUrl || "-";
  const endpoint = ev?.url || ev?.dest || ev?.endpoint || an?.endpoint || extractEndpointFromCode(an?.head) ||extractEndpointFromCode(initiator) || "-";

  return {
    title: summary.severity ? `${sevKo(summary.severity)}: XHR 프로토타입 변조 의심` : "XHR 프로토타입 변조 의심",
    oneLine: ruleOneLine || `XHR ${parsed.prop} 후킹 의심`,
    category: EventCategory.PROTO_TAMPER,
    kpis: [
      kpiNum("risk", "Risk Score", summary.scoreDelta),
      kpiText("target", "Target", targetFull, "XHR 핵심 네트워크 메서드"),
      kpiText("endpoint", "Endpoint", endpoint, "External data exfiltration"),
      kpiBool("isNative", "Is Native", src.isNative, "native 여부"),
    ],
    activityRows: [
      { label: "data.target", value: src.target || "-" },
      { label: "analysis.suspicionScore", value: an.suspicionScore ?? "-" },
      { label: "analysis.head", value: an.head ?? "-" },
      { label: "analysis.initiator", value: initiator }, // KPI와 동일 값
      { label: "data.isNative", value: src.isNative ?? "-" }, // 여기로 이동
      { label: "evidence.desc", value: ev.desc ? JSON.stringify(ev.desc) : "-" },
    ],
    recommendations: [
      { when: true, text: "XHR 핵심 메서드 후킹은 유출/미러링과 결합될 가능성이 높습니다(허용 SDK allowlist, initiator/스택 확인)." }, // PoC-E 논지 :contentReference[oaicite:20]{index=20}
      { when: true, text: "가능하면 동일 세션의 외부 스크립트 로드(DYN_SCRIPT_INSERT)와 함께 체인으로 보세요." }, // PoC-E 체인 :contentReference[oaicite:21]{index=21}
    ],
  };
}

function buildProtoTamperFormVM({ summary, ruleOneLine, src, parsed }) {
  return {
    title: summary.severity ? `${sevKo(summary.severity)}: 폼 제출 프로토타입 변조 의심` : "폼 제출 프로토타입 변조 의심",
    oneLine: ruleOneLine || `Form ${parsed.prop} 후킹 의심`,
    category: EventCategory.PROTO_TAMPER,
    kpis: [
      kpiNum("risk", "Risk Score", summary.scoreDelta),
      kpiText("subtype", "Subtype", "form", "PROTO_TAMPER/Form"),
      kpiText("target", "Target", parsed.prop, "submit/requestSubmit"),
      kpiBool("isNative", "Is Native", src.isNative, "native 여부"),
    ],
    activityRows: [
      { label: "data.target", value: src.target || "-" }, // PoC-F :contentReference[oaicite:24]{index=24}
      { label: "valueHead", value: src.valueHead || "-" },
      { label: "prevFp", value: src.prevFp || "-" },
      { label: "nextFp", value: src.nextFp || "-" },
      { label: "desc", value: src.desc ? JSON.stringify(src.desc) : "-" },
    ],
    recommendations: [
      { when: true, text: "폼 제출 API 후킹은 자격증명 유출 체인의 시작점일 수 있습니다(이후 FORM_SUBMIT / SUSP_NETWORK_CALL 연계 확인)." }, // PoC-F :contentReference[oaicite:25]{index=25}
      { when: true, text: "주의: 일부 프레임워크/보안 에이전트가 submit 주변을 건드릴 수 있으니 allowlist 정책을 같이 두는 게 안전합니다." }, // PoC-F 오탐 :contentReference[oaicite:26]{index=26}
    ],
  };
}

function buildNetworkVM({ detail, summary, parsedPayload, ruleOneLine }) {
  // 네트워크 이벤트는 details.data 또는 payloadJson.data에 핵심이 들어갈 수 있음
  const d = detail;
  const det = d?.details || {};
  const data = det?.data || {};
  const pData = parsedPayload?.data || {};

  const api = data.api || pData.api || "-";
  const method = data.method || pData.method || "-";
  const abs = data.abs || pData.abs || data.url || pData.url || "-";
  const targetOrigin = data.targetOrigin || pData.targetOrigin || "-";
  const crossSite = data.crossSite ?? pData.crossSite ?? null;

  return {
    title:
      summary.severity
        ? `${sevKo(summary.severity)}: 의심 네트워크 호출`
        : "의심 네트워크 호출",
    oneLine:
      ruleOneLine ||
      `${api} ${method} → ${targetOrigin}`.trim(),
    category: EventCategory.NETWORK,
    kpis: [
      kpiNum("risk", "Risk Score", summary.scoreDelta),
      kpiText("api", "API", api, "fetch/xhr 등"),
      kpiText("method", "Method", method, "GET/POST 등"),
      kpiBool("cross_site", "Cross-site", crossSite, "외부 도메인 전송 여부"),
    ],
    activityRows: [
      { label: "api", value: api },
      { label: "method", value: method },
      { label: "abs/url", value: abs },
      { label: "targetOrigin", value: targetOrigin },
      { label: "crossSite", value: crossSite === null ? "-" : String(!!crossSite) },
      { label: "mode", value: data.mode || pData.mode || "-" },
    ],
    recommendations: [
      {
        when: crossSite === true,
        text: "cross-site 전송이므로 유출 가능성(전송 데이터/반복 여부/initiator)을 우선 확인하세요.",
      },
      {
        when: method === "POST",
        text: "POST 요청은 데이터 전송 가능성이 높습니다(body 수집 항목을 추가 고려하세요).",
      },
    ],
  };
}

function buildUiHijackVM({ detail, summary, parsedPayload, ruleOneLine }) {
  const d = detail;
  const det = d?.details || {};
  const data = det?.data || {};
  const pData = parsedPayload?.data || {};

  // payload source merge (details 우선)
  const src = normalizeSrc({ ...pData, ...data });

  const type = det.type || parsedPayload?.type || summary.type || "UNKNOWN";

  // 공통 타이밍/트리거
  const dtMs = src.dtMs ?? src.deltaMs ?? src.withinMs ?? null; // 룰마다 다를 수 있어 방어
  const within50ms =
    src.within50ms ?? (typeof dtMs === "number" ? dtMs <= 50 : null);

  // INVISIBLE_LAYER_DETECTED 계열로 흔히 기대되는 필드들(없어도 -로 처리됨)
  const overlaySelector =
    src.overlaySelector || src.layerSelector || src.coverSelector || src.selector || null;
  const overlayOpacity = src.opacity ?? src.overlayOpacity ?? null;
  const overlayZ = src.zIndex ?? src.overlayZIndex ?? null;
  const coveredRatio = src.coveredRatio ?? src.areaRatio ?? src.coverRatio ?? null; // 0~1 or %
  const pointerEvents = src.pointerEvents ?? null;

  // LINK_HREF_SWAP_DETECTED 계열로 흔히 기대되는 필드들
  const originalHref =
    src.originalHref || src.beforeHref || src.prevHref || null;
  const newHref = src.newHref || src.afterHref || src.nextHref || null;
  const crossOriginChanged =
    src.crossOriginChanged ?? src.crossOrigin ?? src.mismatch ?? null;
  const reverted =
    src.reverted ?? src.preclickReverted ?? src.restored ?? null;

  // “누가/어디서”는 attribution에 있고, Summary oneLine은 rule 설명을 우선
  const oneLine =
    ruleOneLine ||
    (type === "LINK_HREF_SWAP_DETECTED"
      ? `링크 href가 변경되었습니다${crossOriginChanged ? " (cross-origin)" : ""}`
      : "투명/오버레이 레이어가 클릭을 가로챌 수 있습니다.");

  // KPI는 UI_HIJACK에 맞춰 “판단에 필요한 것”만 4개
  const kpis = [
    kpiNum("risk", "Risk Score", summary.scoreDelta),
    kpiText("pattern", "Pattern", type, "UI Hijack 유형"),
    kpiBool(
      "within50ms",
      "Fast Trigger",
      within50ms,
      "클릭 직전/즉시 개입(≤50ms)"
    ),
    // 링크스왑이면 cross-origin 변화, 아니면 overlay cover 정도
    type === "LINK_HREF_SWAP_DETECTED"
      ? kpiBool(
          "cross_origin",
          "Cross-origin",
          crossOriginChanged === null ? false : !!crossOriginChanged,
          "다른 출처로 변경"
        )
      : kpiText(
          "coverage",
          "Coverage",
          coveredRatio == null
            ? "-"
            : typeof coveredRatio === "number"
              ? coveredRatio <= 1
                ? `${Math.round(coveredRatio * 100)}%`
                : `${coveredRatio}%`
              : String(coveredRatio),
          "화면 덮는 비율"
        ),
  ];

  // Activity Rows: 유형별로 보여줄 필드를 다르게
  const activityRows =
    type === "LINK_HREF_SWAP_DETECTED"
      ? [
          { label: "originalHref", value: originalHref ?? "-" },
          { label: "newHref", value: newHref ?? "-" },
          {
            label: "crossOriginChanged",
            value:
              crossOriginChanged === null
                ? "-"
                : crossOriginChanged
                  ? "true"
                  : "false",
          },
          {
            label: "reverted",
            value: reverted === null ? "-" : reverted ? "true" : "false",
          },
          { label: "dtMs", value: dtMs ?? "-" },
        ]
      : [
          { label: "overlaySelector", value: overlaySelector ?? "-" },
          { label: "opacity", value: overlayOpacity ?? "-" },
          { label: "zIndex", value: overlayZ ?? "-" },
          { label: "pointerEvents", value: pointerEvents ?? "-" },
          { label: "coveredRatio", value: coveredRatio ?? "-" },
          { label: "dtMs", value: dtMs ?? "-" },
        ];

  // Recommendations: SOC 액션 기준으로 문장 생성(조건부)
  const recommendations = [
    {
      when: true,
      text:
        "클릭 하이재킹(UI redress) 의심: 사용자가 클릭한 대상과 실제 동작(이동/링크)이 일치하는지 확인하세요.",
    },
    {
      when: within50ms === true,
      text:
        "클릭 직전(≤50ms) 개입 패턴: 광고/리다이렉트/피싱 유도 가능성이 커서 우선순위를 높게 두세요.",
    },
    {
      when: type === "LINK_HREF_SWAP_DETECTED" && crossOriginChanged === true,
      text:
        "cross-origin으로 href 변경: 외부 도메인으로 유도될 가능성이 높습니다(allowlist/차단 후보).",
    },
    {
      when: type === "LINK_HREF_SWAP_DETECTED" && reverted === true,
      text:
        "pre-click revert 패턴: 사용자가 보기 직전에만 바꿨다가 되돌리는 회피 시그널일 수 있습니다.",
    },
    {
      when: type !== "LINK_HREF_SWAP_DETECTED" && coveredRatio != null,
      text:
        "오버레이 덮는 비율/투명도/포인터 이벤트 설정을 근거로 실제 클릭 가로채기인지 확인하세요.",
    },
  ];

  return {
    title:
      summary.severity
        ? `${sevKo(summary.severity)}: 클릭 하이재킹(UI) 의심`
        : "클릭 하이재킹(UI) 의심",
    oneLine,
    category: EventCategory.UI_HIJACK,
    kpis,
    activityRows,
    recommendations,
  };
}

function buildGenericVM({ summary, ruleOneLine }) {
  return {
    title:
      summary.severity ? `${sevKo(summary.severity)}: 보안 이벤트` : "보안 이벤트",
    oneLine: ruleOneLine || "이벤트 상세를 확인하세요.",
    category: EventCategory.UNKNOWN,
    kpis: [
      kpiNum("risk", "Risk Score", summary.scoreDelta),
      kpiText("type", "Type", summary.type || "-", "event type"),
      kpiText("rule", "RuleId", summary.ruleId || "-", "ruleId"),
      kpiText("target", "Target", summary.targetHost || "-", "targetOrigin/host"),
    ],
    activityRows: [],
    recommendations: [],
  };
}

function buildEventViewModel({ detail, summary, parsedPayload, ruleDescription }) {
  const type = summary.type || parsedPayload?.type || "UNKNOWN";
  const category = TYPE_TO_CATEGORY[type] || EventCategory.UNKNOWN;
  const ruleOneLine = ruleDescription?.oneLine || null;

  switch (category) {

    case EventCategory.NETWORK:
      return buildNetworkVM({ detail, summary, parsedPayload, ruleOneLine });

    case EventCategory.UI_HIJACK:
      return buildUiHijackVM({ detail, summary, parsedPayload, ruleOneLine });

    case EventCategory.DOM_INJECTION:
      return buildDomInjectionVM({ detail, summary, parsedPayload, ruleOneLine });

    case EventCategory.PERSISTENCE:
      return buildPersistenceVM({ detail, summary, parsedPayload, ruleOneLine });

    case EventCategory.FORM_FLOW:
      return buildFormFlowVM({ detail, summary, parsedPayload, ruleOneLine });

    case EventCategory.CODE_EXEC:
      return buildCodeExecVM({ detail, summary, parsedPayload, ruleOneLine });

    case EventCategory.XSS_DATA:
      return buildXssDataVM({ detail, summary, parsedPayload, ruleOneLine });

    case EventCategory.PROTO_TAMPER:
      return buildProtoTamperVM({ detail, summary, parsedPayload, ruleOneLine });

    case EventCategory.MUTATION_OBSERVER:
      return buildDomMutationVM({ detail, summary, ruleOneLine });

    case EventCategory.INJECTED_SCRIPT_SCORE:
      return buildInjectedScriptScoreVM({ detail, summary, parsedPayload, ruleOneLine });
    
    case EventCategory.MIRRORING:
      return buildXhrMirroringSuspectVM({ detail, summary, parsedPayload, ruleOneLine });
    
    default:
      return buildGenericVM({ summary, ruleOneLine });
  }
}

/** -----------------------------
 * Page
 * ------------------------------ */
export default function AdminEventDetailPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const params = useParams();

  const eventId = params.eventId || sp.get("eventId");
  const from = sp.get("from") || "";
  const installId = sp.get("installId");
  useEffect(() => {
    // 2. installId가 존재할 때만 실행
    if (installId) {
      // 3. 현재 확정된 ID를 다시 저장소에 업데이트 (동기화)
      setInstallId(installId);
    }
  }, [installId]); // URL이 바뀌거나 계산된 installId가 바뀔 때 실행

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [ruleIdState, setRuleIdState] = useState(null);
  const [ruleDescription, setRuleDescription] = useState(null);

  const currentUrlRef = useRef("");
  useEffect(() => {
    try {
      currentUrlRef.current = window.location?.href || "";
    } catch {
      currentUrlRef.current = "";
    }
  }, []);

  // ✅ Event Detail fetch (eventId 변경 시 재조회)
  useEffect(() => {
    if (!eventId) return;

    let alive = true;
    setLoading(true);
    setErr("");

    getEventDetail({ eventId })
      .then((res) => {
        if (!alive) return;
        setData(res.data);
        setRuleIdState(res.data?.ruleId || res.data?.details?.ruleId || null);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e?.message || "이벤트 조회 실패");
        setData(null);
        setRuleIdState(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [eventId]);

  // ✅ Rule description fetch
  useEffect(() => {
    if (!ruleIdState) return;
    let alive = true;

    getRuleDescription({ ruleId: ruleIdState })
      .then((res) => {
        if (!alive) return;
        setRuleDescription(res.data);
      })
      .catch(() => {
        if (!alive) return;
        setRuleDescription(null);
      });

    return () => {
      alive = false;
    };
  }, [ruleIdState]);

  const detail = data;

  // payloadJson parse (raw)
  const parsedPayload = useMemo(() => {
    const raw =
      detail?.payload?.payloadJson ||
      detail?.payload?.payload?.payloadJson ||
      detail?.payloadJson;
    return raw ? safeJsonParse(raw) : null;
  }, [detail]);

  // Summary(표시용 정규화)
  const summary = useMemo(() => {
    if (!detail) return {};
    const d = detail;
    const det = d.details || {};
    const payload = det?.data || {};
    const origin = d.origin || det.origin || "";

    return {
      tsMs: d.tsMs || det.ts || det.tsMs || null,
      type: det.type || null,
      ruleId: d.ruleId || det.ruleId || null,
      severity: det.severity || d.severity || null,
      scoreDelta: det.scoreDelta ?? d.scoreDelta ?? null,
      sessionId: det.sessionId || d.sessionId || null,
      installId: d.installId || det.installId || null,
      origin: origin || null,
      page: det.page || d.page || null,
      pageHost: origin ? hostFromUrl(origin) : hostFromUrl(det.page),
      targetHost: payload?.targetOrigin || det.targetOrigin || "",
      mismatch: payload?.initiatorCrossSite ?? payload?.crossSite ?? null,
      initiatorUrl: payload?.initiatorUrl || null,
      initiatorOrigin: payload?.initiatorOrigin || null,
      ua: det.ua || null,
      mutationSummary: payload?.summary || null,
      chain: payload?.chain || null,
    };
  }, [detail]);

  const effectiveRuleId =
    summary.ruleId || parsedPayload?.ruleId || ruleIdState || "UNKNOWN_RULE";

  // ✅ VM 생성: KPI/Activity가 여기서 결정됨(타입 바뀌어도 UI 고정)
  const vm = useMemo(() => {
    if (!detail) return null;
    return buildEventViewModel({
      detail,
      summary,
      parsedPayload,
      ruleDescription,
    });
  }, [detail, summary, parsedPayload, ruleDescription]);

  function onBack() {
    if (from) navigate(from);
    else navigate(-1);
  }

  return (
    <TitleCard title="이벤트 상세" topMargin="mt-2">
      {/* Top bar */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="text-sm opacity-70">
          <div className="break-all"></div>
          {summary.sessionId ? (
            <div className="mt-1">
              <span className="break-all"></span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm btn-primary" onClick={onBack}>
            ← 뒤로
          </button>
        </div>
      </div>

      {!eventId ? (
        <div className="p-4 border rounded-xl">
          <div className="font-semibold mb-1">eventId가 필요해요</div>
          <div className="text-sm opacity-70">
            예: <span>/app/admin_front/detail/{"{eventId}"}</span> 또는{" "}
            <span>?eventId=...</span>
          </div>
        </div>
      ) : null}

      {loading ? <div className="opacity-70">loading…</div> : null}

      {err ? (
        <div className="p-3 border border-red-300 bg-red-50 text-red-700 rounded-xl">
          <div className="font-semibold mb-1">조회 실패</div>
          <div className="text-sm break-all">{err}</div>
        </div>
      ) : null}

      {!loading && !err && detail && vm ? (
        <div className="space-y-4">
          {/* Header + KPI */}
          <div className="card bg-base-100 border">
            <div className="card-body gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={sevBadgeClass(summary.severity)}>
                      {String(summary.severity || "UNKNOWN").toUpperCase()}
                    </span>
                    <span className="text-sm opacity-70">
                      {sevKo(summary.severity)}
                    </span>
                  </div>

                  <div className="mt-2 text-lg font-bold">{vm.title}</div>

                  <div className="mt-2 text-xs opacity-70">
                    type: {summary.type || parsedPayload?.type || "-"}
                  </div>
                </div>

                <div className="text-right text-sm">
                  <div className="opacity-60">발생 시각</div>
                  <div>{fmtTs(summary.tsMs)}</div>
                  {summary.tsMs ? (
                    <div className="opacity-70">{relTime(summary.tsMs)}</div>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {vm.kpis.slice(0, 4).map((k) => (
                  <KpiCard
                    key={k.key}
                    label={k.label}
                    value={formatKpiValue(k)}
                    hint={k.hint}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <Section title="이벤트">
              <div className="mt-2 text-sm divide-y divide-base-200">
                <div className="grid grid-cols-[100px_1fr] items-start py-3">
                  <span className="opacity-60">탐지 규칙</span>
                  <span className="break-all">{effectiveRuleId}</span>
                </div>

                <div className="grid grid-cols-[100px_1fr] items-start py-3">
                  <span className="opacity-60">원인</span>
                  <span className="break-all">
                    {ruleDescription?.oneLine || "-"}
                  </span>
                </div>

                <div className="grid grid-cols-[100px_1fr] items-start py-3">
                  <span className="opacity-60">이벤트 유형</span>
                  <span className="break-all">
                    {summary.type || parsedPayload?.type || "-"}
                  </span>
                </div>

                {summary.pageHost ? (
                  <div className="grid grid-cols-[100px_1fr] items-start py-3">
                    <span className="opacity-60">위험 도메인</span>
                    <span className="break-all">{summary.pageHost}</span>
                  </div>
                ) : null}
              </div>
            </Section>

            <Section title="사용자/환경">
              <KV k="대상 페이지" v={summary.targetHost || "-"} mono />
              <KV
                k="유저 Id"
                v={summary.installId || "-"}
                mono
                copy={summary.installId || ""}
              />
              <KV
                k="세션 Id"
                v={summary.sessionId || "-"}
                mono
                copy={summary.sessionId || ""}
              />
              <KV
                k="현재 링크"
                v={currentUrlRef.current || null}
                copy={currentUrlRef.current || ""}
              />
            </Section>
          </div>
        </div>
      ) : null}
    </TitleCard>
  );
}