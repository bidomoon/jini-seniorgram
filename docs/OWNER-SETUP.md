# 시니어그램 실제 연결 순서

2026-10-04 점검. 운영 주소는 https://jini-seniorgram.netlify.app 이며 Sites 주소는 이전 비공개 시험본입니다. GitHub의 변경만으로 Sites 시험본이 자동 갱신되지는 않습니다.

## 1. 시니어그램 전용 회원 DB

연결된 Supabase 프로젝트 목록에 시니어그램 전용 프로젝트가 없습니다. 다른 앱의 DB를 임의로 사용하지 않습니다. 신규 프로젝트의 조직·지역·예상 비용을 확인한 뒤 생성합니다. 현재 연결 도구의 비용 조회 기능은 UNAVAILABLE로 응답하여 비용을 확정하지 못했습니다.

- 권장 이름: `jini-seniorgram`, 지역: 서울(지원 여부 확인).
- DB 비밀번호와 연결 문자열은 채팅·GitHub·프런트엔드에 넣지 않습니다.
- Netlify Functions의 `DATABASE_URL`에 서버 전용 연결 문자열을 등록합니다. 호스팅에 맞는 TLS 인증서 검증과 연결 방식을 확인합니다.
- 승인된 전용 DB에서 다음 순서로 실행합니다. 데이터 삭제나 기존 테이블 초기화는 하지 않습니다.

```sh
MIGRATION_CONFIRM=seniorgram-dedicated-database node scripts/migrate-postgres.mjs
node scripts/verify-postgres.mjs
```

검증 결과 `ready: true`일 때 `PRODUCT_SCHEMA_VERSION=3`을 설정합니다. 회원 데이터는 Netlify 서버 API로만 처리합니다. 브라우저의 Supabase anon/authenticated 역할에 `sg_` 테이블 권한을 주지 않습니다. 마이그레이션은 해당 테이블의 RLS를 활성화하고 이 역할들의 권한을 회수합니다. 신규 테이블 추가 시에도 같은 보호가 필요합니다.

## 2. 카카오 로그인

카카오디벨로퍼스에서 시니어그램 앱을 확인하거나 생성하고 웹 도메인과 Redirect URI를 등록합니다.

- 웹 도메인: `https://jini-seniorgram.netlify.app`
- Redirect URI: `https://jini-seniorgram.netlify.app/api/auth/kakao/callback`
- Netlify Functions 비밀값: `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`
- 일반 설정: `APP_ORIGIN=https://jini-seniorgram.netlify.app`, 준비 후 `KAKAO_LOGIN_ENABLED=true`

키를 연결한 것만으로 완료 처리하지 않습니다. 실제 두 계정으로 가입·취소·로그아웃·재로그인, 무료체험 3회 중복 지급 방지, 다른 회원의 작품 차단, 탈퇴 후 재접속을 확인합니다. 현재 잔여 횟수는 단일 이용권 원장(`sg_entitlements`)을 사용합니다.

## 3. 이미지·영상 및 저장

기존 OpenAI 키는 서버에 등록돼 있습니다. Google 영상 키는 아직 없습니다. 유료 시험 예산과 횟수 승인 후 실제 생성 테스트를 진행합니다. 새 연결을 위해 공개 생성 플래그부터 켜지 않습니다.

먼저 이미지 1건으로 실제 로그인 → 생성 → 서버 보관 → 새로고침 → 다운로드 → 휴대폰 공유를 검증합니다. 영상은 그 다음에 별도 예산으로 검증합니다. 단순 확대 효과의 영상 카드와 실제 AI 영상 생성은 구분합니다.

## 4. Google Play와 서명

Play Console 계정의 개인/조직 유형, 앱 등록 여부, 테스트 그룹을 확인합니다. 기존 패키지 후보는 `app.jininova.seniorgram`입니다. 첫 제출 전에 확정합니다.

GitHub 저장소 비밀값에 실제 업로드 키를 등록합니다.

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

`Signed Android release candidate` 워크플로에 새 버전 번호를 넣어 수동 실행합니다. 키가 없으면 빌드를 중단합니다. 이 워크플로는 AAB를 생성하고 서명을 검사하며 Play Console에 자동 제출하지 않습니다. 실제 키를 연결한 서명 빌드는 아직 실행하지 않았습니다.

Play App Signing 인증서의 SHA-256을 Netlify **Builds** 범위의 `ANDROID_APP_SIGNING_SHA256`에 등록하면 다음 빌드에서 앱↔웹 인증 파일을 생성합니다. 이 값은 업로드 키 인증서와 다를 수 있으므로 Play Console의 앱 서명 인증서를 사용합니다.

## 5. 결제와 공개

실제 구독 판매는 계속 비활성입니다. 카카오페이 시험 코드는 정기결제·해지·환불 완료를 뜻하지 않습니다. Google Play 구매 검증·복원·갱신/환불 알림 처리는 후속 개발이 필요합니다. 월 9,900원/19,900원 가격안의 제공 횟수와 생성 원가도 확정해야 합니다.

```sh
node scripts/check-release.mjs
node scripts/check-release.mjs --require-ready
```

점검 명령은 서버의 준비 상태와 Android 인증 파일만 읽습니다. 생성·결제·발송을 하지 않습니다. `--require-ready`는 하나라도 준비되지 않았으면 실패로 종료합니다. 실제 기기 시험, 실제 결제 시험, Play 심사는 이 명령으로 대체하지 않습니다. 정기 실행은 설정하지 않았습니다.

기존 일정은 10/8–10/22 비공개 테스트, 10/30 공개 목표입니다. 실제 연결·테스트 시작이 늦으면 신청 일정도 조정해야 하며, 미완료 항목을 통과로 표시하지 않습니다.
