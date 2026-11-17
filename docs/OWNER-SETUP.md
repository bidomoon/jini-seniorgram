# 시니어그램 실제 연결 순서

2026-11-17 09:30 KST 점검. 운영 주소는 https://jini-seniorgram.netlify.app 이며 Sites 주소는 이전 비공개 시험본입니다. GitHub의 변경만으로 Sites 시험본이 자동 갱신되지는 않습니다.

## 1. 시니어그램 전용 회원 DB

매버릭은 AXWorks(Pro) 조직의 서울 지역 전용 DB 생성(기본 월 US$10 추가, 사용량·세금 별도)과 시니어그램 Netlify 서버에 카카오 키 등록을 승인했습니다. 동일한 범위·비용에 대한 승인을 다시 요청하지 않습니다. 2026-11-17 재개 시 프로젝트 목록을 먼저 확인하고, 월 US$10 견적을 재조회한 뒤 전용 프로젝트 `jini-seniorgram`(ref: `ricajdduwdmfjunkdihw`, 서울 `ap-northeast-2`)을 생성했습니다. 현재 상태는 `ACTIVE_HEALTHY`입니다. 재개 시 이 프로젝트를 사용하며 새 프로젝트를 추가 생성하지 않습니다.

전용 DB에 기존 SQL 마이그레이션 4개와 `sg_schema_migrations` 원장을 설치했습니다. 실제 DB에서 17개 테이블의 RLS 활성화, anon/authenticated 역할의 읽기·쓰기 차단, 필수 열, 적용 마이그레이션을 확인했습니다. 검증 결과 `migrationsReady`, `privateTablesProtected`, `clientAccessBlocked`, `requiredColumnsPresent`가 모두 true입니다. 회원 레코드는 0건이며 실제 카카오 로그인은 아직 시험하지 않았습니다.

Netlify의 `DATABASE_URL`은 아직 미등록입니다. 관리 화면이 Supabase 로그인으로 전환되어 프로젝트별 풀러 연결 주소와 TLS 인증서 확인이 막혔습니다. 사용자의 같은 Chrome에 Supabase 로그인 탭을 열고 보존했습니다. 로그인 후 Connect에서 서버리스용 트랜잭션 풀러 주소를 확인하고, 전용 최소 권한 서버 역할을 만들어 암호를 비밀값으로 보관한 뒤 실제 Node pg 연결까지 검사합니다. postgres 관리자 비밀번호 변경이나 기존 앱 DB 사용은 하지 않습니다. `PRODUCT_SCHEMA_VERSION`과 `BILLING_SCHEMA_VERSION`은 실제 서버 연결 검사 후 설정합니다.

- 권장 이름: `jini-seniorgram`, 지역: 서울(지원 여부 확인).
- DB 비밀번호와 연결 문자열은 채팅·GitHub·프런트엔드에 넣지 않습니다.
- Netlify Functions의 `DATABASE_URL`에 서버 전용 연결 문자열을 등록합니다. 호스팅에 맞는 TLS 인증서 검증과 연결 방식을 확인합니다.
- 승인된 전용 DB에서 다음 순서로 실행합니다. 데이터 삭제나 기존 테이블 초기화는 하지 않습니다.

```sh
MIGRATION_CONFIRM=seniorgram-dedicated-database node scripts/migrate-postgres.mjs
node scripts/verify-postgres.mjs
```

검증 결과 `ready: true`일 때 `PRODUCT_SCHEMA_VERSION=3`, `BILLING_SCHEMA_VERSION=1`을 설정합니다. 회원 데이터는 Netlify 서버 API로만 처리합니다. 브라우저의 Supabase anon/authenticated 역할에 `sg_` 테이블 권한을 주지 않습니다. 마이그레이션은 해당 테이블의 RLS를 활성화하고 이 역할들의 권한을 회수합니다. 신규 테이블 추가 시에도 같은 보호가 필요합니다.

## 2. 카카오 로그인

2026-11-15 19:38 KST, 사용자의 연결된 Chrome 브라우저에서 시니어그램 전용 앱을 생성했습니다. 앱 ID는 `1651457`, 회사 지니팀, 분류 교육입니다. 카카오 측 로그인 사용 설정은 ON이며 REST API 키에 아래 Redirect URI를 저장했습니다. 클라이언트 시크릿은 기본 활성 상태를 유지했습니다. 키 값은 이 문서나 소스에 기록하지 않습니다.

2026-11-17 같은 Chrome에서 기존 REST 키와 활성 클라이언트 시크릿을 읽어 Netlify 운영 환경에 비밀값으로 등록했습니다. 키를 재발급하거나 보안 기능을 끄지 않았습니다. 연결 도구의 Functions 전용 범위 저장은 403을 반환했습니다. 현재 요금제의 화면에서는 세부 범위 선택이 잠겨 있어 기본 비밀값 범위(Builds, Functions, Runtime)로 저장했습니다. Production에만 값이 있고 Dev/Deploy Preview/Branch/Agent 환경 값은 비어 있음을 연결 도구로 재확인했습니다. 공개 소스와 프런트엔드에는 키를 넣지 않았습니다. 환경변수 변경은 다음 배포부터 적용됩니다.

서버의 로그인 공개 플래그는 아직 닫혀 있습니다. DB 연결 문자열, 초대 시험 계정 지정, 연결 해제 웹훅, 최종 개인정보 고지와 실제 로그인 검증이 남아 있습니다. 카카오 콘솔의 ON이나 키 등록은 실제 회원 로그인이 된다는 뜻이 아닙니다.

- 웹 도메인: `https://jini-seniorgram.netlify.app`
- Redirect URI: `https://jini-seniorgram.netlify.app/api/auth/kakao/callback`
- Netlify Functions 비밀값: `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`
- 일반 설정: `APP_ORIGIN=https://jini-seniorgram.netlify.app`, 준비 후 `KAKAO_LOGIN_ENABLED=true`.
- 첫 연결은 초대 시험으로 진행합니다. 서버 Functions 범위의 비밀값 `KAKAO_BETA_USER_IDS`에 검증한 시험 계정의 카카오 회원번호를 쉼표로 구분해 등록합니다. 앱 ID `1651457`과 개인 회원번호를 혼동하지 않습니다. 빈 값·잘못된 값·100개 초과 목록이면 로그인이 닫힙니다. 목록 값이나 회원번호를 공개 소스·채팅에 기록하지 않습니다.
- `KAKAO_PUBLIC_SIGNUP_ENABLED`는 기본 비활성입니다. 초대 계정만 회원을 생성할 수 있으며 초대에서 제외된 기존 계정은 회원 API 접근도 차단됩니다. 일반 가입은 개인정보 고지·연결 해제 처리·실제 두 계정 검증을 마친 뒤에만 이 별도 값을 `true`로 설정합니다. 키 등록만으로 일반 가입이 열리지 않습니다.
- 2026-11-17 Chrome 연결은 정상 복구됐고 콘솔 키 읽기·서버 비밀값 등록을 완료했습니다. Supabase 관리 화면만 다시 로그인이 필요합니다. 다른 브라우저는 열지 않았습니다.

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

실제 구독 판매는 계속 비활성입니다. 카카오페이 시험 코드는 정기결제·해지·환불 완료를 뜻하지 않습니다. Google Play 구매 검증·복원·갱신/만료 알림·제한된 재확인·탈퇴 처리 코드를 구현하고 가상 응답으로 검증했습니다. 실제 자격 연결·구매 검증과 신규 구독 구매 경로는 미완료입니다. [연결·검증 안내](PLAY-BILLING.md)를 따릅니다. 월 9,900원/19,900원 가격안의 제공 횟수와 생성 원가도 확정해야 합니다.

```sh
node scripts/check-release.mjs
node scripts/check-release.mjs --require-ready
```

점검 명령은 서버의 준비 상태와 Android 인증 파일만 읽습니다. 생성·결제·발송을 하지 않습니다. `--require-ready`는 하나라도 준비되지 않았으면 실패로 종료합니다. 실제 기기 시험, 실제 결제 시험, Play 심사는 이 명령으로 대체하지 않습니다. 정기 실행은 설정하지 않았습니다.

기존 10월 공개 목표일은 지났으며 출시일은 미확정입니다. 실제 연결·필수 테스트·스토어 심사가 끝나야 공개 일정을 확정합니다. 미완료 항목을 통과로 표시하지 않습니다.


## 6. 이번 보강의 검증과 남은 작업

초대 가입 제한과 삭제 파일 정리를 추가했습니다. 전체 16개 회귀 검사, TypeScript 검사, 프레임워크 빌드, Netlify 정적 배포 빌드를 로컬에서 통과했습니다. `tests/login-admission.cjs`는 가상 카카오 응답과 로컬 PostgreSQL 엔진으로 잘못된 초대 설정·허용/거절·회원 생성 방지·기존 세션 접근 차단·개인 회원번호 미노출을 검사합니다. `tests/cleanup.cjs`는 AI 작업 설정이 꺼져도 파일 삭제가 처리되는지, 저장소 오류 시 재시도 항목이 남는지, 만료된 로그인 정보만 지우는지, 한 번에 최대 10개를 처리하는지 확인합니다. 실제 카카오·운영 DB·기기 공유 시험을 대신하지 않습니다.

기존 매분 예약 함수에서 파일 삭제와 만료 인증 정보 정리를 AI 작업 조회보다 먼저 수행하도록 분리했습니다. DB가 구성되지 않으면 실행하지 않습니다. 현재 운영 DB가 연결되지 않았으므로 실제 회원 파일 정리가 작동 중이라는 뜻이 아닙니다. 삭제 항목은 저장소 삭제 확인 후에만 원장에서 제거하며 실패 항목은 다음 실행에 다시 처리합니다. 카카오 연결 해제 웹훅과 앱 내 탈퇴 시 카카오 연결 해제 API 처리는 아직 구현·연결되지 않았으며, 일반 가입 개방 전에 완료해야 합니다. 공식 요구 사항은 [카카오 로그인 웹훅](https://developers.kakao.com/docs/ko/kakaologin/callback)과 [REST API](https://developers.kakao.com/docs/ko/kakaologin/rest-api)를 다시 확인합니다.

2026-11-17 추가 검증: `tests/database-access.cjs`, `tests/login-admission.cjs`, `tests/commerce.cjs`, `tests/accounts.cjs` 4종 통과. 실제 DB 검증은 위 1절과 같으며 로컬 가상 카카오 응답 검사를 실제 OAuth 성공으로 대체하지 않습니다. 공개 `/api/account/config`의 `loginReady`는 false입니다. AI 생성·무료체험·실결제는 계속 비활성입니다. 이번 작업은 서버 기반 설정이며 앱 화면 기능을 새로 배포한 작업이 아닙니다.
