# 시니어그램 Apple 등록 진행 기록

2026-11-17 준비 시작. App Store Connect에서 실제 생성한 앱: [시니어그램 6835936697](https://appstoreconnect.apple.com/apps/6835936697/distribution).

## 완료한 등록 준비

- 전용 App ID `app.jininova.seniorgram` 등록 및 앱 항목 생성. 기존 미션·보이스그램·지니캡 앱은 수정하지 않았다.
- 기본 언어 한국어, SKU `seniorgram-ios-001`, 버전 1.0.0.
- 앱 설명·프로모션 문구·키워드·지원 URL·저작권·심사 메모 저장. 로그인 필요 해제, 수동 출시 선택.
- 부제 ‘마음을 전하는 쉬운 인사 카드’, 기본 카테고리 그래픽 및 디자인, 추가 카테고리 라이프스타일 저장.
- 지니팀 공식 홈페이지에 공개된 운영자·지원 이메일·전화로 심사 연락처 작성. 앱에서 자동 이메일·문자를 발송하지 않았다.
- 실제 SwiftUI Xcode 프로젝트와 8개 단위/2개 UI 시험 작성 및 실행. 최종 실행에서 전부 통과했다.
- iPhone 전용 지원 안내와 개인정보 안내 배포. 두 페이지 모두 HTTP 200 및 배포 본문 대조 통과. 웹판과 iPhone판의 데이터 처리가 다름을 명시했다.
- 연령 설문 저장(글로벌 기본 4+), 개인정보 ‘수집 안 함’ 응답 초안 저장. 개인정보 응답의 ‘게시’는 하지 않았다. 직접 제작한 카드의 외부 공유를 고려해 연령 설문의 사용자 생성 콘텐츠에는 ‘예’, 소셜 피드·앱 내 채팅에는 ‘아니요’로 응답했다.
- TestFlight 시험 설명·지원 이메일·베타 심사 연락처·심사 메모 저장. TestFlight 화면은 아직 ‘빌드 없음’이다.
- 실제 iPhone 17 Pro 시뮬레이터에서 촬영한 1206×2622 RGB PNG 3장 준비. 사진이나 화면 내용을 편집·늘림·합성하지 않았다. App Store Connect 업로드는 아직이다.

## 검증 결과

[최종 iOS 검증 #3](https://github.com/bidomoon/jini-seniorgram/actions/runs/44115543351), 소스 `23cd633d290f81ad67046073c656cd03b28a78af`: Xcode 26.6, iOS 26.5, iPhone 17 Pro. 단위 시험 8개와 UI 시험 2개가 실패 0으로 통과했고, iPhone 기기용 Release 컴파일도 성공했다. 이는 서명·실기기 실행·TestFlight 업로드 증거가 아니다. 동일 소스의 기존 웹 회귀 시험·TypeScript·웹 빌드도 CI에서 통과했다.

첫 실행은 Debug의 `ENABLE_TESTABILITY` 누락으로 시험 모듈 가져오기에 실패했다. 설정을 수정했고, 중간 대기 실행을 최종 소스로 대체했다. 최종 코드에는 권한 창이 잠시 화면을 비활성화해도 사용자가 시작한 음성 권한 요청을 유지하는 처리와 현행 마이크 권한 API도 포함한다. 실제 음성 인식·Photos 선택/저장·공유 앱 최종 수신은 실기기 검증이 남아 있다.

기계 판독 결과와 촬영 원본 해시는 [verification.json](../ios/AppStore/verification.json)에, 실제 화면 3장은 [screenshots/ko-KR](../ios/AppStore/screenshots/ko-KR)에 있다. 전체 xcresult와 빌드 로그는 해당 Actions 실행의 `seniorgram-ios-3` artifact에 있으며 14일 보관된다.

## 다음 단계

서명된 Archive 검증 및 App Store Connect 업로드, TestFlight/실기기 시험, 준비한 스크린샷 최종 검수와 업로드, 개인정보·연령 등급·콘텐츠 권리·배포 설정의 최종 대조가 남아 있다. 이 작업 환경에는 Xcode와 소유자의 서명 인증서가 없어 서명된 IPA는 만들지 않았다. Mac의 Xcode에서 기존 개발자 계정을 연결해야 한다. Xcode Cloud 최초 연결도 Xcode에서 시작해야 한다. 새 인증서나 API 비밀키를 임의로 만들거나 다른 앱의 비밀키를 재사용하지 않았다. 아직 심사 제출·승인·App Store 공개·유료 구독 판매는 하지 않았다.

코드와 Mac 작업 순서는 [ios/README.md](../ios/README.md), 등록 문구 원본은 [metadata.json](../ios/AppStore/ko-KR/metadata.json)에 있다. 개인 인증서·키·프로비저닝 프로필은 저장소에 보관하지 않는다.
