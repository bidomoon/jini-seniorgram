# 시니어그램 Apple 등록 진행 기록

2026-11-17 준비 시작. App Store Connect에서 실제 생성한 앱: [시니어그램 6835936697](https://appstoreconnect.apple.com/apps/6835936697/distribution).

## 완료한 등록 준비

- 전용 App ID `app.jininova.seniorgram` 등록 및 앱 항목 생성. 기존 미션·보이스그램·지니캡 앱은 수정하지 않았다.
- 기본 언어 한국어, SKU `seniorgram-ios-001`, 버전 1.0.0.
- 앱 설명·프로모션 문구·키워드·지원 URL·저작권·심사 메모 저장. 로그인 필요 해제, 수동 출시 선택.
- 부제 ‘마음을 전하는 쉬운 인사 카드’, 기본 카테고리 그래픽 및 디자인, 추가 카테고리 라이프스타일 저장.
- 지니팀 공식 홈페이지에 공개된 운영자·지원 이메일·전화로 심사 연락처 작성. 앱에서 자동 이메일·문자를 발송하지 않았다.
- 실제 SwiftUI Xcode 프로젝트와 8개 단위/2개 UI 시험 작성. GitHub Actions macOS에서 검증 시작. 아래 기록 전에는 시험 성공을 전제하지 않는다.
- iPhone 전용 지원 안내와 개인정보 안내 작성. 웹판과 iPhone판의 데이터 처리가 다름을 명시했다.

## 확인 중

[iOS 검증 실행 #1](https://github.com/bidomoon/jini-seniorgram/actions/runs/44111041714): Xcode 버전 및 프로젝트 형식 검사는 통과. 시뮬레이터 실행·단위/UI 시험·서명 없는 기기 Release 빌드는 결과 확인 중이다.

## 다음 단계

서명된 Archive 검증 및 App Store Connect 업로드, TestFlight/실기기 시험, 실제 실행 스크린샷, 개인정보·연령 등급·콘텐츠 권리·배포 설정의 최종 대조가 남아 있다. 아직 심사 제출·승인·App Store 공개·유료 구독 판매는 하지 않았다.

코드와 Mac 작업 순서는 [ios/README.md](../ios/README.md), 등록 문구 원본은 [metadata.json](../ios/AppStore/ko-KR/metadata.json)에 있다. 개인 인증서·키·프로비저닝 프로필은 저장소에 보관하지 않는다.
