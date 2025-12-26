# Rule Catalog (default-v1)

이 문서는 `rulesets/default-v1.json`에 정의된 룰과, 실제 runtime 이벤트(content.js/page_hook.js) 간의 매핑을 정리합니다.  
발표/데모 시 “어떤 행위를 어떤 룰이 잡는지”를 설명하기 위한 문서입니다.

---

## 1. 이벤트 생성 주체

- `content.js`
  - DOM 변경(MutationObserver) 기반: SCRIPT/IFRAME 삽입 감지
  - 사용자 입력 기반: FORM submit/click 감지
  - window.postMessage 기반: page_hook.js가 던지는 훅 이벤트 수신

- `page_hook.js`
  - `atob`, `eval`, `Function` 같은 동적 실행 계열 API 후킹(구현 범위에 따라 type이 달라질 수 있음)

---

## 2. 룰 목록 요약

| ruleId | 대응 type | 조건 요약 | 점수 | severity | 의미 |
|---|---|---|---:|---|---|
| SENSOR_READY | SENSOR_READY | 항상 | 0 | LOW | 센서/세션 시작 |
| DYN_SCRIPT_INSERT_SAME_SITE | DYN_SCRIPT_INSERT | data.crossSite=false | 5 | LOW | 동일 오리진 스크립트 삽입 |
| DYN_SCRIPT_INSERT_CROSS_SITE | DYN_SCRIPT_INSERT | data.crossSite=true | 20 | MEDIUM | 외부 스크립트 삽입 |
| IFRAME_INSERT | DYN_IFRAME_INSERT | data.hidden=false | 10 | LOW | 일반 iframe 삽입 |
| HIDDEN_IFRAME_INSERT | DYN_IFRAME_INSERT | data.hidden=true | 35 | HIGH | 숨김 iframe 삽입 |
| FORM_ACTION_MATCH | FORM_SUBMIT | data.mismatch=false | 5 | LOW | 동일 오리진 폼 제출 |
| PHISHING_FORM_MISMATCH | FORM_SUBMIT | data.mismatch=true | 50 | HIGH | 외부 오리진 폼 제출(피싱 의심) |
| FORM_ACTION_PARSE_FAIL | FORM_SUBMIT | data.parse="fail" | 10 | MEDIUM | action 파싱 실패 |
| OBFUSCATION_ATOB | SUSP_ATOB_CALL | 항상 | 10 | LOW | atob 기반 난독화/디코드 의심 |
| DYNAMIC_CODE_EVAL | SUSP_EVAL_CALL | 항상 | 25 | MEDIUM | eval 실행 |
| DYNAMIC_CODE_FUNCTION | SUSP_FUNCTION_CONSTRUCTOR_CALL | 항상 | 25 | MEDIUM | Function 생성자 실행 |
| DOM_XSS_INJECTION | SUSP_DOM_XSS | 항상 | 40 | HIGH | DOM XSS 징후 |
| COOKIE_THEFT | SENSITIVE_DATA_ACCESS | 항상 | 50 | HIGH | 민감 정보 접근 |
| NETWORK_LEAK | SUSP_NETWORK_CALL | 항상 | 15 | LOW | 의심 네트워크 호출 |

---

## 3. PoC-A(데모 사이트) 기준 매핑 예시

### 3.1 외부 스크립트 삽입 데모
- PoC-A에서 `step2_insertExternalScript()` 실행
- 생성 이벤트:
  - `type = DYN_SCRIPT_INSERT`
  - `data.crossSite = true`
- 적용 룰:
  - `ruleId = DYN_SCRIPT_INSERT_CROSS_SITE`
- 설명:
  - 외부 JS 삽입은 분석/광고/정상도 많지만, 공격 체인의 2단계 로더로도 자주 쓰임

---

### 3.2 숨김 iframe 삽입 데모
- PoC-A에서 `step3_insertHiddenIframe()` 실행
- 생성 이벤트:
  - `type = DYN_IFRAME_INSERT`
  - `data.hidden = true`
  - `data.crossSite = true`일 수도 있음(목적지에 따라)
- 적용 룰:
  - `ruleId = HIDDEN_IFRAME_INSERT`
- 설명:
  - 숨김 iframe은 사용자 모르게 페이지를 띄워 추적/피싱/리다이렉트 체인에 악용됨

---

### 3.3 폼 제출(외부 action mismatch) 데모
- PoC-A에서 `form.action`이 현재 페이지 origin과 다르게 설정된 상태에서 Submit
- 생성 이벤트:
  - `type = FORM_SUBMIT`
  - `data.mismatch = true`
- 적용 룰:
  - `ruleId = PHISHING_FORM_MISMATCH`
- 설명:
  - 로그인 폼이 외부로 전송되면 “피싱”의 대표적 패턴
  - 데모에서 바로 보여주기 좋은 룰

---

### 3.4 atob → (eval/Function) 동적 실행 데모
- PoC-A에서 `atob`로 base64 디코드 후 실행
- 생성 이벤트(후킹 구현에 따라 달라질 수 있음):
  - `type = SUSP_ATOB_CALL` → `ruleId = OBFUSCATION_ATOB`
  - `type = SUSP_EVAL_CALL` 또는 `SUSP_FUNCTION_CONSTRUCTOR_CALL`
    - `ruleId = DYNAMIC_CODE_EVAL` 또는 `DYNAMIC_CODE_FUNCTION`
- 설명:
  - 난독화 문자열을 디코드 후 실행하는 패턴은 악성 스크립트에서 매우 흔함
  - “클라이언트 런타임 보안” 느낌이 강하게 나는 데모 포인트

---

## 4. 운영/튜닝 가이드(간단)

- 점수 튜닝:
  - false positive가 많으면 `DYN_SCRIPT_INSERT_CROSS_SITE` 점수 하향 또는 severity 하향
  - 피싱 데모를 강조하려면 `PHISHING_FORM_MISMATCH`는 HIGH 유지
- 룰 추가 방향:
  - allowlist(허용 오리진 목록) 기반 예외 처리 룰
  - 동일 세션에서 특정 이벤트 조합(체인) 발생 시 누적 점수 상향 룰(상관분석)

---
