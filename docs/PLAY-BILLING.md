# Google Play 구독 검증 · 복원

2026-11-15 구현. **코드 및 로컬 검증과 실제 구매 성공은 별개입니다. 현재 판매와 구매 연결은 닫혀 있습니다.**

## 구현 범위

- 서버가 Google Play Developer API `purchases.subscriptionsv2.get`으로 구매를 확인합니다. 브라우저의 상품·가격·만료일·알림 종류를 이용권 근거로 삼지 않습니다.
- 첫 복원 시 로그인한 회원에게 구매를 연결하고 이후 다른 회원으로 이전하지 않습니다. 구매 토큰은 AES-256-GCM으로 암호화하며 로그, URL, 프런트 저장소에 남기지 않습니다.
- 미승인 유효 구매는 Google 승인 확인 후 이용권을 지급합니다. 확인 실패는 트랜잭션을 롤백합니다.
- 동일 주문의 재복원은 사용 횟수를 초기화하지 않습니다. 갱신 주문은 새 기간을 지급하며 이전 기간을 회수합니다. 보류·중지·만료는 이용권을 회수하고 유예·해지 후 남은 기간은 유지합니다.
- 연결된 이전 구매는 폐기 표시로 보호합니다. 교체된 토큰을 뒤늦게 복원해도 이용권을 다시 지급하지 않습니다.
- 서명된 Pub/Sub OIDC 알림은 audience, 발신 서비스 계정 이메일, 앱 패키지를 확인한 뒤 최신 구매를 다시 조회합니다. 중복·역순 알림의 종류로 지급하지 않습니다.
- 기존 maintenance 일정에서 명시적으로 활성화한 경우에만 30분 이상 확인하지 않은 구매를 회당 최대 2건 재확인합니다. 별도의 정기 작업을 추가하지 않았으며 현재 비활성입니다.
- ‘내 이용권 · 도움말 → Google Play 구매 복원’에서 복원합니다. 일반 브라우저는 이미 연결한 구독 상태만 조회합니다. 신규 구매·청구 버튼은 구현하지 않았습니다.
- 자동 갱신이 해지된 것으로 최근 확인된 구독은 남은 기간 중에도 탈퇴할 수 있습니다. 탈퇴 시 암호화된 토큰을 지우고 중복 사용 방지용 해시 결합 기록을 남깁니다. 탈퇴는 스토어 구독을 취소하지 않습니다.

## 운영 연결 전 준비

1. 전용 DB의 모든 마이그레이션을 적용하고 `scripts/verify-postgres.mjs`를 통과시킵니다. `PRODUCT_SCHEMA_VERSION=3`, `BILLING_SCHEMA_VERSION=1`은 검증 후 설정합니다.
2. Play Console의 패키지와 월 구독 상품·기본 요금제·가격을 확정합니다. 현재 가격안 9,900원/19,900원은 상용 상품 등록 완료를 뜻하지 않습니다. 각 요금제의 이미지·영상 제공 횟수는 원가 확인 후 확정합니다. 테스트의 10장/2편은 가상 수치입니다.
3. 전용 서비스 계정에 이 앱의 구매 조회·관리 권한만 부여합니다. JSON 자격 파일은 GitHub·채팅·공개 폴더·대형 환경변수에 넣지 않습니다. Netlify의 서버 전용 `seniorgram-private` store의 고정 키 `play-service-account`에 보관합니다. 런타임이 이 고정 객체만 읽으며 공개 읽기/쓰기 API는 없습니다. 스토어는 같은 사이트의 모든 배포가 공유하므로 운영 권한을 가진 코드와 배포 접근자를 제한합니다.
4. Functions의 **production 문맥에만** 아래 설정을 적용합니다. Preview에는 실제 DB·운영 권한을 주지 않습니다.

| 설정 | 의미 |
| --- | --- |
| `PLAY_BILLING_ENABLED=true` | 검증·복원 시험 활성화 |
| `PLAY_CREDENTIALS_READY=true` | 전용 자격 파일의 서버 저장·권한 검증 완료 표시 |
| `PLAY_TOKEN_KEY` | 안전하게 생성한 32바이트 키의 base64. 기존 암호문 마이그레이션 없이 바꾸면 복원이 깨집니다. |
| `PLAY_PACKAGE_NAME` | 기본값 `app.jininova.seniorgram`, Play 등록값과 일치 |
| `PLAY_IMAGE_PRODUCT`, `PLAY_VIDEO_PRODUCT` | 서로 다른 실제 구독 상품 ID |
| `PLAY_IMAGE_LIMIT`, `PLAY_VIDEO_IMAGE_LIMIT`, `PLAY_VIDEO_LIMIT` | 확정한 월 제공 횟수, 양의 정수 |
| `PLAY_PUSH_AUDIENCE` | `https://jini-seniorgram.netlify.app/api/billing/play/notifications` |
| `PLAY_PUSH_EMAIL` | Pub/Sub push OIDC에 쓰는 전용 서비스 계정 이메일 |
| `PLAY_SYNC_ENABLED=true` | 기존 maintenance에서 제한된 재확인 허용 |
| `PLAY_LIVE_VERIFIED=true` | 실구매·갱신·환불 검증 완료 후 운영자만 설정 |

5. Play Console의 RTDN Pub/Sub를 위 HTTPS 주소와 인증된 OIDC push로 연결하고 개발자 API 접근 권한을 확인합니다. 시험 구매로 복원·재설치·다른 기기·다른 카카오 계정·승인 실패·갱신·유예·보류·해지·환불·만료를 검증합니다. 민감한 영수증은 시험 증빙에서 가립니다.
6. 실사용 활성화에는 이미지·영상 서비스 준비 상태도 필요합니다. 실제 구매 시험, 구독 해지·환불 운영 절차와 최종 개인정보 고지를 검증하기 전 판매를 열지 않습니다.

## 계정 결합의 한계

현재 Android TWA의 Digital Goods API가 제공하는 구매 토큰을 최초로 명시적 복원한 카카오 계정에 결합합니다. Android Browser Helper가 결제 시 obfuscated account ID를 전달하는 경로는 현재 연결되어 있지 않습니다. Google 구매에 그 값이 있으면 서버가 일치 여부를 확인하지만, 값이 없는 구매를 카카오 계정과 사전에 묶었다고 주장하지 않습니다. 토큰은 비밀번호처럼 보호하고, 신규 구매 도입 전 이 계정 결합 방식과 계정 전환 시나리오를 실제 기기에서 확인해야 합니다.

## 검증과 미완료

`tests/play-billing.cjs`: 실제 PostgreSQL 엔진(PGlite), 가상 Google 응답. 인증·CSRF·계정 결합·암호화·중복 지급·갱신·해지·보류·만료·알림·교체 토큰·탈퇴를 검증합니다.

`tests/play-restore.cjs`: 가상 Digital Goods API로 복원 UI, 명시적 동의, 중복 탭 방지, 일반 브라우저와 미연결 상태를 확인합니다. 실제 결제나 Google API 호출은 없습니다.

남은 작업: 전용 DB·카카오·Play 자격 연결, 허가된 생성 비용 시험, 최종 제공량·가격·개인정보 고지 확정, 신규 구독 구매 경로, 서명 앱 및 실제 기기 검증, Play 심사. 로컬 테스트 통과를 판매 가능 상태로 취급하지 않습니다.

## 근거

- [Google Play 구독 수명 주기](https://developer.android.com/google/play/billing/lifecycle/subscriptions)
- [Subscriptions v2 API](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2)
- [인증된 Pub/Sub push](https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions)
- [TWA Play 결제](https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing)
- [Android Browser Helper 계정 식별값 지원 이슈](https://github.com/GoogleChrome/android-browser-helper/issues/583)
