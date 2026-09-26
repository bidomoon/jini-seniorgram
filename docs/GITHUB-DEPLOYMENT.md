# 시니어그램 소스와 배포

- GitHub: https://github.com/bidomoon/jini-seniorgram (사용자가 생성한 공개 저장소)
- 운영 웹앱: https://maeum-card.jinimarketing.chatgpt.site
- 현재 서버: Sites / Cloudflare Worker, D1(DB), R2(BUCKET), Sites 인증

## 개발

Node.js 22.13 이상과 package.json의 pnpm 버전을 사용합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

현재 웹 UI는 `public/studio`, API는 `app/api/sg`, DB 마이그레이션은 `drizzle`입니다.
GitHub Actions는 main 변경과 PR에서 음성·API 회귀 테스트, 타입 검사, 빌드를 실행합니다.
테스트에는 실제 AI API 키가 필요 없고 유료 생성 요청을 보내지 않습니다.

## Netlify 체험판

지니노바(`jini-nova`) 팀의 `jini-seniorgram` 프로젝트를 사용합니다.
`node scripts/build-netlify.mjs`로 브라우저 카드/음성 기능을 `netlify-dist`에 빌드합니다.
Netlify에 카카오 OAuth·세션·테스트 결제 함수가 배포되지만 실제 카카오 앱 키와 회원 DB 연결이 필요합니다. AI 생성·서버 작품 저장·피드는 아직 연결 전입니다. UI에 이 제한을 표시하고 서버 API는 이용 불가로 응답합니다.
GitHub 자동 배포 연결 여부는 Netlify의 저장소 설정에서 확인해야 하며, 수동 소스 배포만으로 자동 연결되지는 않습니다.

## 배포 경계

GitHub Actions는 **검사 전용**입니다. GitHub에 커밋하는 것만으로 운영 사이트가 자동 변경되지 않습니다.
현재 운영 배포는 동일 소스를 Sites 저장소에 반영하고, 검증한 빌드 버전을 Sites 배포 도구로 게시합니다.
저장소 이전만으로 네트리파이·렌더의 로그인/DB/파일 저장 연결이 만들어지지는 않습니다.
다른 서버로 이전할 경우 인증과 D1/R2 어댑터를 먼저 구현하고 실제 저장·조회 시험을 통과해야 합니다.
특히 `oai-authenticated-user-id`는 Sites의 신뢰할 수 있는 게이트웨이에서만 신뢰합니다.
다른 호스팅에서 외부 요청 헤더를 그대로 신뢰하면 안 됩니다.

## 비밀 설정

API 키는 운영 서버의 비밀 환경변수로만 관리합니다. 공개 GitHub 파일, 프런트 코드, Actions 로그에 넣지 않습니다.
현재 이미지 생성은 OpenAI 연결 이후 운영 플래그로 제한하고, 영상은 Google 연결이 추가로 필요합니다.
GitHub 연결 작업은 생성 플래그, 이용 한도, 기존 비공개 웹앱의 접근 범위를 변경하지 않습니다.

## 동기화

현재 제품 소스·템플릿 이미지·마이그레이션·잠금파일을 공개 저장소로 동기화합니다.
개발 캐시(`*.tsbuildinfo`)와 내부 실제 API 실행 영수증(`docs/test-results`)은 공개 복사에서 제외합니다.
원본 Sites 소스의 전체 이력이나 계정별 런타임 데이터는 복사하지 않습니다.
운영 코드 수정 시 양쪽 최신 커밋을 확인하고 같은 변경을 반영한 뒤 Sites 배포 성공 상태를 확인합니다.

출시 개발 현황 및 연결 항목은 [2026-10-26 출시 작업표](LAUNCH-2026-10-26.md)를 참고하세요.
카카오 로그인 버튼은 카카오디벨로퍼스 공식 리소스(`https://developers.kakao.com/tool/images/resource/preview/login-complete-ko.svg`)를 사용합니다.
