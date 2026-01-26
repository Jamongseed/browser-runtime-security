import { useMemo } from "react";
import { Link } from "react-router-dom";
import TitleCard from "../../components/Cards/TitleCard";

function Stat({ label, value, hint }) {
  return (
    <div className="p-4 rounded-2xl border bg-base-100">
      <div className="text-xs opacity-60">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint ? <div className="mt-1 text-xs opacity-60">{hint}</div> : null}
    </div>
  );
}

function Feature({ title, desc }) {
  return (
    <div className="p-4 rounded-2xl border bg-base-100">
      <div className="font-bold">{title}</div>
      <div className="mt-2 text-sm opacity-80 leading-relaxed">{desc}</div>
    </div>
  );
}

function Badge({ children }) {
  return (
    <span className="badge badge-outline text-xs py-3 px-3">{children}</span>
  );
}

export default function AdminMainPage() {
  const quickStats = useMemo(
    () => [
      { label: "탐지 범위", value: "Client-side", hint: "브라우저 런타임 감지" },
      { label: "분석 구조", value: "SOC View", hint: "Summary/Context/Activity/Evidence" },
      { label: "룰 규모", value: "~200", hint: "ruleId 기반 유형 분류" },
      { label: "스코어링", value: "Signals+Combo", hint: "scoring-model-v1" },
    ],
    [],
  );

  const features = useMemo(
    () => [
      {
        title: "Runtime Detection",
        desc: "브라우저 내부에서 발생하는 DOM 변조, 스크립트 주입, 네트워크 후킹, UI 하이재킹 신호를 실시간 감지합니다.",
      },
      {
        title: "Event Scoring",
        desc: "단일 이벤트가 아니라 여러 시그널과 조합(combo) 기반으로 점수를 산정해 ‘왜 위험한지’를 한눈에 설명합니다.",
      },
      {
        title: "Attack PoC Library",
        desc: "클릭 하이재킹, JIT href swap, XHR mirroring, SW persistence 등 실제 공격 시나리오를 PoC로 재현합니다.",
      },
      {
        title: "SOC-Oriented Detail",
        desc: "보안 담당자가 빠르게 판단할 수 있도록 이벤트 상세를 Summary/Context/Activity/Attribution/Evidence로 구조화합니다.",
      },
    ],
    [],
  );

  return (
    <TitleCard title="BRS" topMargin="mt-2">
      {/* HERO */}
      <div className="rounded-2xl border bg-base-100 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge>Browser Runtime Security</Badge>
              <Badge>Client-side Detection</Badge>
              <Badge>PoC 기반</Badge>
              <Badge>SOC View</Badge>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold">
              브라우저 런타임 악성행위 탐지 대시보드
            </h1>
            <p className="mt-3 text-sm md:text-base opacity-80 leading-relaxed">
              클라이언트 단에서 발생하는 스크립트 주입, UI 하이재킹, 네트워크 탈취를
              실시간으로 탐지·분석합니다. 이벤트를 구조화해 보안 담당자가 “왜 위험한지”를
              근거 중심으로 빠르게 판단할 수 있도록 돕습니다.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link className="btn btn-primary" to="/app/admin_front/events">
                이벤트 대시보드
              </Link>
              <Link className="btn btn-outline" to="/app/poc">
                PoC 시나리오
              </Link>
              <Link className="btn btn-ghost" to="/app/admin_front/events?severity=HIGH">
                최근 고위험 보기 →
              </Link>
            </div>

            <div className="mt-4 text-xs opacity-60">
              ※ 데모/연구 목적의 PoC 기반 프로젝트입니다. 실서비스 적용 시 정책(차단/알림/저장)과 개인정보 처리 기준을 별도 정의하세요.
            </div>
          </div>

          {/* 우측 요약 카드 */}
          <div className="w-full md:w-[360px]">
            <div className="p-4 rounded-2xl border bg-base-100">
              <div className="font-bold">빠른 시작</div>
              <div className="mt-2 text-sm opacity-80">
                1) PoC 실행 → 2) 이벤트 생성 → 3) 상세에서 근거 확인
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Link className="btn btn-sm btn-primary" to="/app/poc">
                  PoC 열기
                </Link>
                <Link className="btn btn-sm btn-outline" to="/app/admin_front/events">
                  이벤트 목록
                </Link>
              </div>

              <div className="divider my-4" />

              <div className="text-xs opacity-60 mb-1">추천 흐름</div>
              <div className="text-sm">
                <div className="flex items-center justify-between py-1">
                  <span className="opacity-70">분류</span>
                  <span className="font-mono">ruleId/type</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="opacity-70">묶기</span>
                  <span className="font-mono">incidentId</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="opacity-70">판단</span>
                  <span className="font-mono">hits/combo</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STAT */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickStats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} hint={s.hint} />
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {features.map((f) => (
          <Feature key={f.title} title={f.title} desc={f.desc} />
        ))}
      </div>
    </TitleCard>
  );
}
