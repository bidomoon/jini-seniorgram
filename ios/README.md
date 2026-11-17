# 시니어그램 iPhone 앱 등록 준비

2026-11-17 KST. App Store Connect 앱 ID **6835936697**. 현재 ‘제출 준비 중’; 심사 제출·배포·TestFlight 업로드는 하지 않았다.

| 항목 | 값 |
|---|---|
| 앱 이름 | 시니어그램 |
| Bundle ID | `app.jininova.seniorgram` |
| Developer Team | `5H4Z8667H6` |
| SKU | `seniorgram-ios-001` |
| 기본 언어 | 한국어 |
| 첫 버전 | 1.0.0 (빌드 1) |
| 지원 기기 | iPhone, iOS 17 이상, 세로 화면 |
| 프로젝트 | `Seniorgram.xcodeproj`, shared scheme `Seniorgram` |

## 이번 네이티브 시험본

SwiftUI 카드 제작, 선택 사진 가져오기, 1080 PNG 출력, 암호화된 기기 파일 보호를 사용하는 로컬 작품 보관, Photos 추가 저장, iOS 공유창, 한국어 기기 내 음성 인식(지원 기기에서만), 큰 글씨 설정을 구현했다. 웹사이트를 여는 래퍼가 아니다. AI·카카오 계정·공개 피드·구독·영상은 이 시험본에 포함되지 않는다. 웹 버전 개발은 별도로 유지된다.

보관함 인덱스가 읽히지 않으면 쓰기를 차단한다. 중복 보관을 막고, 한도 초과 시 기존 데이터를 덮어쓰지 않는다. 삭제는 확인 후 해당 작품에만 적용한다. 선택 사진은 25MB 제한·1600px 다운샘플링을 적용한다. 마이크는 명시적 입력 시작 시만 사용하며 화면 이탈·비활성화·45초 경과 시 중지한다.

## 검증

`.github/workflows/ios.yml`에서 표준 macOS runner로 Xcode 26 이상을 확인하고, 실제 프로젝트를 시뮬레이터에서 빌드·시험한다. 8개 단위 시험은 한국어 요청 분류·문자 제한·1080 PNG·재실행 보관·중복·한도·손상 인덱스 보호·개별 삭제를 점검한다. 2개 UI 시험은 카드 작성→보관→재실행→재열기와 마이크 자동 시작 방지를 점검한다. 실기기용 Release도 **서명 없이 컴파일**한다. 이 작업은 서명된 IPA나 TestFlight 빌드가 아니다.

최종 [Actions 실행 #3](https://github.com/bidomoon/jini-seniorgram/actions/runs/44115543351)에서 Xcode 26.6 / iPhone 17 Pro / iOS 26.5로 단위 8개·UI 2개가 실패 0으로 통과했다. 서명 없는 iPhone 기기용 Release 컴파일도 성공했다. 증거는 `AppStore/verification.json`과 원본 화면 3장(`AppStore/screenshots/ko-KR`)이다. 마이크 인식 정확도, 실제 사진 선택·Photos 저장, 카카오톡 최종 수신, 작은 iPhone·큰 글씨·VoiceOver는 실기기 확인이 필요하다.

## Mac에서 서명하고 TestFlight에 올리기

1. Xcode 26 이상 설치 후 `ios/Seniorgram.xcodeproj`를 연다.
2. Xcode 설정의 Accounts에 기존 Apple Developer 계정으로 로그인한다. 인증서를 저장소나 채팅에 올리지 않는다.
3. Seniorgram 타깃의 Signing & Capabilities에서 Team `5H4Z8667H6`, Bundle ID `app.jininova.seniorgram`, Automatically manage signing을 확인한다.
4. 본인 iPhone을 연결하고 Run으로 기기 기능을 확인한다. 권한 거절, 앱 재시작, 통화/다른 녹음, 사진 가져오기와 저장, 공유 취소, 실제 수신, 큰 글씨까지 확인한다.
5. 대상 ‘Any iOS Device (arm64)’로 Product > Archive. Organizer에서 Validate App 후 App Store Connect로 업로드한다. 같은 버전을 다시 업로드할 때는 Build 번호를 올린다.
6. App Store Connect 6835936697의 TestFlight에서 처리 완료를 기다리고 내부 시험을 진행한다. 외부 시험은 Apple의 별도 Beta App Review가 필요할 수 있다.
7. 실제 실행 화면만 스크린샷으로 사용한다. 아래 미완료 항목을 마치고 최종 설명을 실제 빌드와 대조한 뒤 심사에 제출한다.

## 심사 전 미완료 항목

- 서명된 아카이브 검증·업로드 및 TestFlight/실기기 시험.
- 실제 iPhone 화면에서 스크린샷 준비·업로드, 출시용 아이콘 최종 검수. 현재 App Store Connect 필수 슬롯은 Dynamic Island 중형 iPhone이며 세로 1179×2556 또는 1206×2622 PNG/JPEG를 허용한다. CI는 설치된 최신 iOS의 일반 Pro 기기를 우선 선택하며, 실제 출력 파일의 크기를 확인한 후 등록에 사용한다. 이미지를 늘리거나 가짜 화면으로 대체하지 않는다.
- App Privacy 응답 최종 검토. 현재 코드 기준 운영자 자동 수집 없음; 문의는 사용자가 외부 이메일/전화로 직접 시작한다. 필드 선택과 공개 완료를 구분한다.
- 연령 등급 설문: 공개 UGC·메신저·광고·구독 없음. 외부 공유창은 앱 내 공개 커뮤니티가 아니다. 최종 빌드와 대조하여 응답한다.
- 지원 안내·개인정보 URL의 실배포 확인. 연락처는 지니팀 공식 홈페이지 공개 연락처를 사용한다(2026-11-17 확인).
- Apple 필수 입력(연락처·콘텐츠 권리·수출 규정·국가·가격 등)과 계정 계약 상태 확인. 새 유료 계약 체결이나 결제는 별도 승인 대상이다.
- 출시 버전에서는 시험본 문구를 정리하고 검증된 기능만 설명한다. 유료 구독 판매를 추가하려면 StoreKit·서버 구매 검증·복원·해지 안내 및 실결제 검증을 별도로 완료한다.

## 정책 확인 출처

- [Apple SDK requirements](https://developer.apple.com/news/upcoming-requirements/): Xcode 26 / iOS 26 SDK 이상.
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): 완결성, 최소 기능, 계정·결제·개인정보 요건.
- [On-device speech](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition): 기기 지원 확인 후 기기 내 인식만 요구.
- [Privacy manifest TN3183](https://developer.apple.com/documentation/technotes/tn3183-adding-required-reason-api-entries-to-your-privacy-manifest): 앱 전용 글씨 설정에 UserDefaults CA92.1 선언.
- [Apple 스크린샷 규격](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications): 등록 화면의 필수 중형 iPhone 슬롯과 대조했다.
- [Xcode Cloud 최초 연결](https://developer.apple.com/documentation/xcode/configuring-your-first-xcode-cloud-workflow): 최초 프로젝트 연결은 Mac의 Xcode에서 시작한다.
- [지니팀 공개 연락처](https://jinimarketing.com/): 지원용 이메일·전화·운영자 확인. 문의 회신 속도는 임의로 보장하지 않는다.

한국어 등록 문구는 `AppStore/ko-KR/metadata.json`에 있다. 개인 인증서·프로비저닝 프로필·App Store Connect API 비밀키는 저장소에 넣지 않는다.
