# Ruleset Schema (ruleset-v1)

이 문서는 `rulesets/*.json` 형태의 룰셋 파일이 가져야 할 구조(스키마)와 각 필드의 의미를 정의합니다.  
목표는 탐지 정책을 코드(content.js)에서 분리하여, 팀 단위로 룰을 쉽게 추가/수정/리뷰할 수 있게 만드는 것입니다.

---

## 1. 룰셋을 분리하는 이유

- 정책(룰) 변경 = 코드 변경이 되면 PR이 불필요하게 많아지고, 역할 분리가 어렵습니다.
- 환경/조직별로 정책이 달라질 수 있습니다.
  - 데모/PoC: 관대한 점수
  - 실서비스/엄격모드: 점수 상향, allowlist/denylist 강화
  - 탐지 정책은 코드가 아니라 룰셋으로 관리합니다.
  - 환경별 룰 프로파일을 바꿀 수 있습니다.

---

## 2. 파일 위치/네이밍 규칙

- 기본 위치: `rulesets/`
- 예시:
  - `rulesets/default-v1.json`
  - `rulesets/strict-v1.json`
- `rulesetId`는 파일명과 맞추는 것을 권장합니다.

---

## 3. 런타임 이벤트(payload) 개요

현재 `content.js`는 아래와 같은 형태의 이벤트를 Background로 전송합니다:

- `type`: 이벤트 종류 (예: `DYN_SCRIPT_INSERT`, `FORM_SUBMIT`)
- `ts`: 발생 시각 (epoch ms)
- `page`: 현재 페이지 URL
- `origin`: 현재 페이지 origin
- `targetOrigin`: 목적지 origin (해당되는 이벤트만)
- `scoreDelta`: 점수 (현재는 content.js 하드코딩이지만, 목표는 룰셋 기반 산정)
- `severity`: `LOW|MEDIUM|HIGH`
- `ruleId`: 분류 ID (예: `PHISHING_FORM_MISMATCH`)
- `data`: 이벤트별 데이터
- `evidence`: 증거(로그/분석용)

룰셋은 기본적으로 `type` + `data.*` 조건을 이용해 rule을 매칭합니다.

---

## 4. 룰셋 최상위 구조

### 4.1 Top-level fields

| 필드 | 타입 | 필수 | 설명 |
|---|---:|:---:|---|
| schemaVersion | string | O | 스키마 버전 (예: `ruleset-v1`) |
| rulesetId | string | O | 룰셋 ID (예: `default-v1`) |
| name | string | O | 룰셋 이름 |
| description | string | X | 룰셋 설명 |
| enabled | boolean | O | 룰셋 활성화 여부 |
| updatedAt | string | X | 갱신일(자유 형식) |
| scoring | object | X | 점수→severity 기본 기준(선택) |
| eventTypes | array | X | 수집/처리하는 이벤트 목록(설명용) |
| rules | array | O | 룰 목록 |

---

## 5. scoring 구조(선택)

`scoring.severityThresholds`는 점수로 기본 severity를 추정할 때 사용합니다.  
단, rule의 action에서 severity를 명시하면 그것을 우선합니다.

예시:

```json
"severityThresholds": {
  "LOW": { "minScore": 0, "maxScore": 24 },
  "MEDIUM": { "minScore": 25, "maxScore": 49 },
  "HIGH": { "minScore": 50, "maxScore": 9999 }
}
