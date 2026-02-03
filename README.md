# Browser Runtime Security (BRS)
Team : Think Twice?

<img width="1090" height="401" alt="image" src="https://github.com/user-attachments/assets/b1c171ea-adb9-4a6c-bedf-5b36dd82a6a5" />
<img width="1188" height="550" alt="image" src="https://github.com/user-attachments/assets/563ac0ef-aa82-40f2-bd80-86082b910e09" />
<img width="1163" height="607" alt="image" src="https://github.com/user-attachments/assets/2affd405-e58f-44ac-8e4c-b053d9899c03" />
<img width="1168" height="583" alt="image" src="https://github.com/user-attachments/assets/bab7d645-b6b6-46f5-897c-1cb10c33841d" />


브라우저 안에서 **링크/폼/네트워크 요청이 실행 직전에 바뀌는 런타임 변조(Runtime Tampering)** 를 탐지하고,  
단순 경고가 아니라 **왜 위험한지(근거, Evidence)** 까지 남기는 보안 플랫폼입니다.

- **Chrome Extension (Sensor)**: DOM/네트워크/프로토타입 변조를 감지하고 이벤트·덤프를 수집
- **Backend (AWS)**: 이벤트 저장(DynamoDB), 스크립트 덤프 저장(S3 등), 집계/조회 API
- **Dashboard (React)**: 세션 타임라인, 이벤트 상세(Evidence), 통계/트렌드 시각화
- **PoC 모음**: 서버는 정상인데 브라우저에서만 진실이 바뀌는 공격 시나리오 재현

---

## Links

> 아래 URL은 현재 프로젝트에서 사용 중인 배포/엔드포인트입니다.

- Dashboard (deploy): https://browser-runtime-security.vercel.app/app/user_front/
- Events Ingest API (Extension → Backend): https://*****.execute-api.ap-northeast-2.amazonaws.com/prod/events
- Dumps Ingest API (Extension → Backend): https://*****.execute-api.ap-northeast-2.amazonaws.com/prod/dumps
- Query API (Dashboard → Backend): https://***.execute-api.ap-northeast-2.amazonaws.com/prod

---

## Quick Start (Local Demo)

### 0) Requirements
- Node.js (PoC/Collector/Dashboard 실행용)
- Google Chrome (확장프로그램 로드)
- PoC들은 기본적으로 **3000번 포트**를 사용합니다. (대시보드 dev server도 기본 3000이라 충돌 가능)

### 1) Run Local Collector (event/dump receiver)
확장프로그램이 보낸 이벤트/덤프를 로컬 파일로 저장하는 수집기입니다.

```bash
cd collector-local
npm install
npm start
# http://localhost:8080
```

### 2) Point Extension to Local Collector
`extension-sensor/config.js`에서 로컬 endpoint를 사용하도록 변경합니다.

```js
// extension-sensor/config.js
// 로컬 데모용
API_ENDPOINT: "http://localhost:8080/events",
DUMPS_ENDPOINT: "http://localhost:8080/dumps",
```

> 현재 파일은 AWS endpoint가 기본값으로 들어있을 수 있습니다. 로컬 데모에서는 위 값을 활성화하세요.

### 3) Load Chrome Extension (MV3)
1. `chrome://extensions` 접속  
2. **Developer mode(개발자 모드)** ON  
3. **Load unpacked(압축해제된 확장 프로그램 로드)** 클릭  
4. `extension-sensor/` 폴더 선택

기본 동작 대상(match patterns)은 아래와 같습니다.
- `http://localhost:3000/*`
- `http://127.0.0.1:3000/*`
- `https://*.onrender.com/*`

PoC는 `http://localhost:3000` 기준으로 작성되어 있으니 **localhost로 접근**하는 것을 권장합니다.

### 4) Run one PoC and trigger an event
예: **PoC-D (클릭 직전 href 바꿔치기)**

```bash
cd poc-d-href-swap
npm install
npm start
# listening on :3000
```

브라우저에서 `http://localhost:3000` 접속 후 링크를 클릭하면,  
확장프로그램이 클릭 순간의 `href` 변조를 감지하여 이벤트를 기록합니다.

### 5) View results
확장프로그램에는 로컬 대시보드가 포함되어 있습니다.

- Options UI: `extension-sensor/local_dashboard/brs-options-panel.html`
- Local dashboard: `extension-sensor/local_dashboard/dashboard.html`

또는 `SYSTEM_CONFIG.USE_SERVER_DASHBOARD=false` 설정으로 로컬 대시보드가 자동으로 열리게 할 수 있습니다.

---

## Components

### 1) Extension Sensor (`extension-sensor/`)
빌드 과정 없이 그대로 Chrome에 로드합니다.

**핵심 파일**
- `content.js`: page_hook 브릿지 + rule engine 적용
- `page_hook.js`: 페이지 컨텍스트에서 MutationObserver/프로토타입 등을 후킹(근거 수집)
- `detectors/*`: DOM 변화/행위 탐지기
- `background.js`: 이벤트 전송(HTTP Sink), 알림, 덤프 전송 등

**설정**
- `extension-sensor/config.js`
  - `SYSTEM_CONFIG.API_ENDPOINT`: 이벤트 수집 endpoint
  - `SYSTEM_CONFIG.DUMPS_ENDPOINT`: 스크립트 덤프 수집 endpoint
  - `SYSTEM_CONFIG.USE_SERVER_DASHBOARD`: 서버 대시보드(배포) 사용 여부
  - `SYSTEM_CONFIG.AWS_DASHBOARD_URL`: 서버 대시보드 주소

### 2) Local Collector (`collector-local/`)
로컬 환경에서 이벤트/덤프를 파일로 저장합니다.

**Run**
```bash
cd collector-local
npm install
npm start
# http://localhost:8080
```

**Endpoints**
- `POST /events` : 이벤트 수집
- `GET  /events` : 최근 이벤트 조회
- `POST /dumps`  : 스크립트 덤프 수집(sha256 기준 중복 처리 + 파일 저장)
- `GET  /dumps`  : 최근 덤프 메타 조회

**Storage**
- `collector-local/storage/dumps/*.js` (스크립트 원문)
- `collector-local/storage/dumps/*.json` (원본 이벤트)
- `collector-local/storage/dumps/*.meta.json` (중복/점수/상태 메타)

### 3) Backend (AWS Lambda source) (`aws/`)
이 레포에는 이벤트 **Ingest**와 **Query/Aggregates** Lambda 소스가 포함되어 있습니다.

#### 3-1) Events Ingest
- File: `aws/BRS_Events_Ingest.mjs`
- Role: 확장프로그램 이벤트를 DynamoDB에 저장 + 집계 테이블 업데이트

**Key env**
- `TABLE_NAME` (default: `Threat_Events`)
- `AGG_TABLE`
- `EVENT_SHARDS` (default: 8)
- `ALLOW_ORIGIN` (CORS)

#### 3-2) Events Query
- File: `aws/BRS_Events_Query.mjs`
- Role: 대시보드에서 이벤트 목록/상세 조회 (ruleset i18n 표시 지원)

**Routes (expected)**
- `GET /events`
- `GET /events/body`
- `GET /events/by-install`
- `GET /events/by-domain`
- `GET /events/by-rule`
- `GET /events/by-sev`

#### 3-3) Aggregates / Trends
- File: `aws/BRS_Events_Aggregates.mjs`
- Role: 도메인/룰/심각도 집계, 트렌드 조회

**Routes (expected)**
- `GET /aggregates/topn/domains-range`
- `GET /aggregates/topn/rules-range`
- `GET /aggregates/severity-range`
- `GET /trends/domain`
- `GET /trends/rule`
 
> 로컬은 `collector-local/`이 담당하고, 배포 환경에서 `/dumps` 처리가 별도 구성되어 있습니다.

### 4) Dashboard (React) (`src/`)
루트는 DaisyUI 기반 Admin 템플릿을 바탕으로 한 React 대시보드입니다.

**Run**
```bash
npm install
npm start
```

**Note**
- React dev server는 기본 3000 포트 사용 → PoC(3000)와 충돌 가능  
  → PoC 데모 중에는 배포 대시보드 사용 또는 포트 변경을 권장합니다.

**Query API origin**
- `src/features/aws/BRSQuery.ts`에 Query API origin이 하드코딩되어 있습니다.
```ts
const API_ORIGIN = "https://****.execute-api.ap-northeast-2.amazonaws.com/prod";
```

---

## PoC Scenarios (`poc-*/`)

모든 PoC는 서버/HTML만 보면 정상인데, 런타임에서만 행동이 바뀌는 상황을 재현합니다.

### Common
```bash
# 각 PoC 폴더에서
npm install
npm run <script>
```

### PoC-A: 로그인 폼 전송지 변조 + 서드파티 프레임
- Folder: `poc-a-login/`
- Ports: MAIN 3000, THIRDPARTY 4000
```bash
cd poc-a-login
npm install
npm run dev
```

### PoC-B: 투명 레이어 클릭재킹
- Folder: `poc-b-invisible-layer/`
- Port: 3000
```bash
cd poc-b-invisible-layer
npm install
npm start
```

### PoC-C: iframe(postMessage) 트리거 → 폼 action 스왑
- Folder: `poc-c-thirdparty-iframe-postmessage/`
- Ports: MAIN 3000, THIRDPARTY 4000
```bash
cd poc-c-thirdparty-iframe-postmessage
npm install
npm start
```

### PoC-D: 클릭 직전 href 바꿔치기(pointerdown 타이밍)
- Folder: `poc-d-href-swap/`
- Port: 3000
```bash
cd poc-d-href-swap
npm install
npm start
```

### PoC-E: XHR 훅 → 원 요청은 정상 + 멀티 오리진 미러링(5001~5003)
- Folder: `poc-e-xhrMirroring/`
- Ports: MAIN 3000, HOOK 4000, COLLECTORS 5001/5002/5003
```bash
cd poc-e-xhrMirroring
npm install
npm start
```

### PoC-F: HTMLFormElement.prototype submit/requestSubmit 오버라이드 + sendBeacon 유출
- Folder: `poc-f-form-proto-submit-hook/`
- Ports: MAIN 3000, THIRDPARTY 4000
```bash
cd poc-f-form-proto-submit-hook
npm install
npm run dev
```

### PoC-G: 서비스워커 기반 지속성(persistence) + 응답 변조
- Folder: `poc-g-serviceworker-persistence/`
- Ports: VICTIM 3000, ATTACKER 4000
```bash
cd poc-g-serviceworker-persistence
npm install
npm run dev
```

(Windows)
```bash
cd poc-g-serviceworker-persistence
npm install
npm run dev:win
```

### PoC-H: 위젯 제거 트리거 → 스크립트 주입 + WebSocket 키로깅
- Folder: `poc-h-script_injection/`
- Ports: MAIN 3000, THIRDPARTY 4000, WS COLLECTOR 5000
```bash
cd poc-h-script_injection
npm install
npm start
```

### PoC-H 난독화 비교
- Folder: `PoC_H_compare/`
- Notes: 원본/난독화 스크립트 비교 실험 로그 포함

---

## Directory Structure

```text
browser-runtime-security-main/
  extension-sensor/          # Chrome Extension 센서
    local_dashboard/         # 확장프로그램 내 로컬 대시보드/옵션 UI
  aws/                       # AWS Lambda(ingest/query/aggregates) 소스
  collector-local/           # 로컬 수집기(파일 저장)
  src/                       # React 대시보드(템플릿 기반)
  poc-a-login/
  poc-b-invisible-layer/
  poc-c-thirdparty-iframe-postmessage/
  poc-d-href-swap/
  poc-e-xhrMirroring/
  poc-f-form-proto-submit-hook/
  poc-g-serviceworker-persistence/
  poc-h-script_injection/
  PoC_H_compare/
```

---

## Safety / Ethics
- 본 프로젝트의 PoC는 **학습/연구/데모 목적**입니다.
- 실제 서비스/사용자 환경에서 무단으로 실행하지 마세요.

---

## Credits
- Dashboard UI Template: https://github.com/robbins23/daisyui-admin-dashboard-template
