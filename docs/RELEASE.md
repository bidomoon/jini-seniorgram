## 2026-09-26 — v13 voice integration

- Initialize voice controller from the app closure with live state getters. The former separate script referenced inaccessible variables.
- Separate voice-command status ID from card voice-recording status; preserve both features.
- Korean dictation, editable review, spoken confirmation, image/video creation, image editing, gallery and channel sharing preparation. Text controls preserved.
- No automatic SNS publication: prepare owned media and open an explicit share dialog; OS share requires a physical button action and destination app completion.
- Clear recognition callbacks on stop/cancel/page hide; prevent duplicate starts and stale callbacks. Keep generation flags and quotas unchanged.
- Validation: mocked voice integration (creation confirmation, cancellation, duplicate prevention, shared state and channel handoff), existing API/jobs regressions, JS syntax and production build. No paid API calls this release.
- Outstanding: real Android/iPhone microphone and sharing QA; production generation remains disabled, Veo credentials pending. This is not a fully hands-free Instagram publishing release.

# 시니어그램 출시 상태 / 2026-09-26

## 제품 목표
65세 이상 이용자가 짧은 생활 언어 한 문장으로 이미지를 만들고 저장·공유한다.
목표 경험은 ChatGPT/Gemini 대화창처럼 간단한 생성과 수정이며, 현재 동등한 품질이나 사용성이 검증된 것은 아니다.
영상 목표는 실제 장면과 소리를 생성하는 Gemini 수준이다. 현재 구현된 움직이는 카드는 이 목표와 다르다.

## 구현 및 배포 설정
- 새 그림 / 영상 카드 / 예시 카드 / 우리 피드 진입. 카드·사진·녹음·브라우저 영상 보존.
- OpenAI 텍스트 안전검사와 이미지 생성 서버 경로. D1 이용량·게시물·좋아요·신고·차단, R2 게시 이미지.
- OPENAI_API_KEY는 기존에 사용자가 등록한 값을 서버 비밀 설정으로 연결했다. 클라이언트와 소스에 키를 포함하지 않는다.
- GENERATION_ENABLED=false, GENERATION_DAILY_LIMIT=10, OPENAI_IMAGE_MODEL=gpt-image-2.
- 개인 체험 요청 월 10회, 전체 이미지 요청 일 10회, 개인 게시 요청 일 10회. 실패도 요청량에 포함된다. 유료 상품 포함량 확정은 아니다.
- 기존 소유자 비공개 접근을 유지한다. 공개 SNS나 스토어 출시본이 아니다.

## 이번 고품질 개선
- 이미지 품질 low → high, 1024×1024 PNG. 임의의 인사 카드 구성 대신 이용자가 요청한 장면과 한글을 우선한다.
- 스타일은 기본값 ‘알아서 어울리게’이며, 변경 선택은 접어두었다.
- 로그인 필요 응답에는 로그인 링크를 표시한다.
- 고품질 이미지 응답 제한을 115초에서 300초로 늘렸다. 안전검사 제한은 30초다. 대기 시간 표시와 화면 이탈 경고를 추가했다.
- 요청 ID 중복 차단, 불확실한 결과의 자동 유료 재시도 금지를 유지한다.
- 입력 문장·요청 ID는 이 브라우저에 보관한다. v10부터 새 생성은 아래의 공급자 비동기 작업과 내 작품 보관함으로 처리한다.
- 300초 설정이 실제 서비스의 모든 네트워크·호스팅 제한을 해결한다는 뜻은 아니다. 변경 후 실생성 성공 검증이 필요하다.

## 실제 API 시험 결과
2026-09-26 07:54 UTC에 현행 서버 라우트를 로컬 시험 환경에서 실행해 실제 OpenAI API로 생성 한 번을 요청했다.
이용자 식별과 D1은 시험용 메모리 상태이며 운영 사이트의 로그인부터 저장까지를 검증한 것은 아니다.

| 항목 | 결과 |
|---|---|
| 입력 | 햇살이 드는 정원, 흰 강아지, 꽃바구니, 한글 ‘오늘도 행복하세요’ |
| 모델 / 설정 | gpt-image-2 / high / 1024×1024 / PNG / 1장 |
| 안전검사 | HTTP 200, 약 14.7초 |
| 전체 요청 | 약 129.7초 후 HTTP 502 |
| 이미지 단계 | 당시 115초 제한 안에 응답을 받지 못함 |
| 결과 파일 / 화질 | 파일 없음 / 평가 불가 |
| 비용 | 생성 결과·사용량 응답이 없어 실제 과금 여부·금액 확인 불가 |
| 추가 호출 | 자동 재생성 없음 |

따라서 이미지 연결 완료·화질 합격·출시 준비 완료로 판정하지 않는다.
운영 사이트 진단 토큰 요청은 로그인된 이용자 신원을 제공하지 않아 401을 반환했다. 이것만으로 실제 이용자 로그인 결함이라고 단정하지 않는다.

## 영상
현재 영상은 이미지 이동·효과·자막·녹음 합성이다. 텍스트로 실제 장면을 생성하지 않는다.
v10에서 Gemini API의 Veo 3.1 Fast 요청·상태 조회·파일 보관 코드를 구현했다. Google API 키, 유료 사용 권한 및 실제 영상 검증이 필요하다.
Veo는 실제 공급자 계정과 아직 미연결이며 유료 영상 시험을 실행하지 않았다. 품질 동등성을 주장하지 않는다.
참고: https://ai.google.dev/gemini-api/docs/veo
참고: https://ai.google.dev/gemini-api/docs/pricing

## 검증 및 다음 출시 단계
서버 API 모의 시험, 클라이언트 구문 검사, TypeScript 검사를 통과했다.
시간초과 후 상태 unknown 기록과 동일 요청 ID 재호출 차단을 모의 시험으로 확인했다.
실제 API 시험 결과는 위의 실패 기록이며 모의 시험 성공과 구분한다.

1. 고품질 실생성 재검증: 파일·한글·구도·시간·실제 비용 확인. 운영 로그인 상태에서 저장·공유 흐름 확인.
2. 비동기 작업·보관·재조회·대화식 수정은 v10에서 구현했다. 실제 공급자 응답으로 연결 끊김 복구를 검증해야 한다.
3. Veo 공급자 연결 후 움직임·인물/물체 일관성·음성·출력 파일 검증.
4. Android 실기기 Chrome 및 카카오톡·인스타·틱톡·문자 공유, 큰 글씨·마이크·저장 권한 검증. iPhone 별도 검증.
5. 65세 이상 이용자의 무도움 생성·저장·공유 관찰. 오류와 완료 시간 기록.
6. 독립 인증, 탈퇴·개인정보·약관, 신고 운영, 인앱 구독·서버 영수증 검증 후 스토어 내부 테스트와 심사.

월 9,900원은 목표 가격이며 결제 미연결이다. 이미지·영상 원가와 수수료를 반영해 포함량을 확정해야 한다.
월 10만 명은 목표 MAU이며 실측 수용 능력이 아니다. 작업 큐·크레딧 원장·보관 수명·피드 페이지네이션·관측·부하 시험이 필요하다.
현재 홈 화면에 추가할 수 있는 웹앱이며 Android/iOS 네이티브 앱은 미출시다.

참고: https://developers.openai.com/api/docs/guides/image-generation


## v10: 비동기 생성과 내 작품 (2026-09-26)
### 구현
- 이미지: Responses API background=true / store=true, 기본 대화 모델 gpt-5.4-mini, 이미지 모델은 기존 gpt-image-2 / high / 1024×1024. 이미지 도구는 한 요청에 최대 1회.
- 서버에 사용자별 작업 ID와 공급자 작업 ID를 보관한다. 접수 이후에는 작업 조회만 재시도하며 유료 생성은 자동 재호출하지 않는다.
- 별도 generation_jobs 테이블과 고유 요청 인덱스 추가. 기존 게시물·이용량·요청 데이터와 기존 마이그레이션을 보존한다.
- 내 작품: 내 계정의 최근 30건 조회, 진행 확인, 완성 그림/영상 열기·파일 저장·외부 공유.
- 본인 소유의 성공한 이미지 작업만 previous_response_id로 수정 가능. 원본은 보존된다.
- 공급자가 반환한 결과를 확인할 때 R2에 보관한다. 접수/처리/완료/실패/불확실 상태를 구분한다.
- 영상: veo-3.1-fast-generate-preview, 8초, 세로 9:16, 1080p. 이미지→영상 입력은 아직 미구현이며 이번 구현은 글→영상이다.
- 안전 확인 실패 시 생성 차단. 영상 다운로드 주소 제한, Google API 키를 다른 호스트로 전달하지 않는 리디렉션 처리, 최대 40MiB와 MP4 서명 검사.
- 파일 조회는 사용자 소유권 검증, 비공개 응답 및 영상 부분 읽기(Range)를 지원한다.
- 개인 월 이미지 10회(기존 동기 경로와 합산), 영상 2회. 영상 일일 전체 상한은 별도 설정이 필수다. 실제 유료 구독 포함량 확정이 아니다.

### 실제 연결과 검증 범위
- 기존 OpenAI 키로 GET /v1/models/gpt-5.4-mini 및 /v1/models/gpt-image-2가 HTTP 200. 모델 접근 확인이며 생성 성공 검증이 아니다.
- 이번 변경 이후 유료 이미지/영상 생성은 호출하지 않았다. 앞선 129.7초 시간초과 시험 기록을 보존한다.
- 모의 시험 통과: 접수→진행→완료, 중복 요청 차단, 타인 조회/수정 차단, 저장 실패 후 결과 복구, 파일 부분 조회, 불확실 접수의 재호출 차단, 안전검사 실패 차단, 영상 키/활성화/한도 차단, 외부 URL 차단 및 리디렉션 키 비전달.
- 클라이언트 구문, TypeScript, 기존 API 회귀 시험 통과. 브라우저 화면·모바일 실기기·공급자 실생성은 미검증.

### 운영 설정
현재 GENERATION_ENABLED=false를 유지한다. 새 영상 기능도 기본 비활성이다.
- OPENAI_RESPONSE_MODEL: gpt-5.4-mini (생략 시 코드 기본값)
- OPENAI_IMAGE_MODEL: gpt-image-2 (기존 설정 유지)
- GEMINI_API_KEY: 서버 비밀값으로 등록 필요
- VIDEO_GENERATION_ENABLED: 승인된 유료 검증 후 true로 전환
- VIDEO_DAILY_LIMIT: 양의 정수 필요. 검증 단계 권장값 1. 미설정 시 동영상 접수 차단

### 복구의 한계
- 공급자 작업 ID를 저장하기 전에 접수 연결이 끊기면 결과를 자동으로 찾을 수 없다. unknown 표시 후 새 유료 요청은 사용자가 명시적으로 시작해야 한다.
- 자체 상시 작업자·스케줄러는 없다. 내 작품을 열어 진행을 확인할 때 공급자 결과를 가져와 보관한다.
- Veo 공급자 파일은 2일 보관이므로 그 안에 앱에서 완료 확인이 필요하다. 앱 보관 완료 후에는 자체 저장 파일을 사용한다.
- OpenAI 저장된 응답의 보관 기간/프로젝트 데이터 정책에 따라 오래된 대화식 수정이 제한될 수 있다. 저장된 그림 파일은 별도로 유지된다.
- 공개 출시 전에는 독립 인증·탈퇴/작품 삭제·보관 수명·크레딧 원장·상시 결과 수집·실패 처리 운영 정책을 완료해야 한다.

검증 명령: node tests/api.cjs / node tests/jobs.cjs / node --check public/studio/app.js / tsc --noEmit / Sites build.
공식 문서: https://developers.openai.com/api/docs/guides/background
공식 문서: https://developers.openai.com/api/docs/guides/tools-image-generation
공식 문서: https://ai.google.dev/gemini-api/docs/veo


## v11: 실제 이미지 1회 성공 (2026-09-26 17:32 KST 시작)
- 사용자 승인 범위: 유료 이미지 생성 1회. POST /v1/responses 호출 1회. 추가 생성·수정·영상 호출 없음.
- 실제 OpenAI API 결과: queued → in_progress → completed. 앱 작업 상태 succeeded.
- 전체 완료 확인까지 185,825ms(약 3분 6초), 접수까지 10,436ms. 조회 간격/네트워크 시간이 포함되므로 순수 모델 생성 시간은 아니다.
- 파일: 1024×1024 PNG, 2,048,179 bytes. 디코딩 검사 통과.
- 육안 확인: 요청한 흰 강아지·꽃바구니·햇빛 정원 반영. ‘오늘도 행복하세요’ 한글 정확. 단일 예시이며 다른 서비스와 동급 품질이라는 비교 검증은 아니다.
- 실제 앱 라우트 + 실제 OpenAI API를 사용했다. 인증 사용자, SQLite, 버킷 저장은 로컬 시험용이므로 운영 사이트의 로그인·D1·R2 또는 실기기 전체 흐름을 검증한 것은 아니다.
- 저장 파일 재조회 시 동일 바이트/SHA-256, 다른 사용자 접근 404, 동일 요청 ID 재접수 시 같은 작업 반환 및 생성 호출 추가 없음 확인.
- 이전 시간초과 시험의 실패 기록은 그대로 보존한다. 이번 성공으로 이미지 생성 경로의 실 API 연결을 확인했다.
- 이미지의 실제 청구 금액은 별도 확인 필요. 응답 usage만으로 이미지 도구 요금 전체를 계산하지 않았다.
- Google Veo 실생성, 이미지 대화식 수정 실생성은 아직 미검증. GENERATION_ENABLED=false 유지.
- 다음 운영 검증: 실제 로그인 세션에서 작업 접수→결과 보관→저장·공유, 모바일 실기기, 대기시간 개선 및 다양한 주제의 화질 평가.
- 상세 검증 기록: docs/test-results/2026-09-26-live-image.json
