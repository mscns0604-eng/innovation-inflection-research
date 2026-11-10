# IIR Innovation Radar — MVP v0.1

운영 주소: https://iir-innovation-radar.shnboy.workers.dev/

**실제 구성:** Cloudflare Workers + D1 + Cron. 성능/신속한 운영을 우선해 초기 UI는 경량 HTML/CSS/JS로 작성했으며 React/Vite로 만들었다고 주장하지 않습니다. 원본 STANDARD / RUBRIC / 기타 연구 기준서는 변경하지 않았습니다.

## 로컬 개발 / 배포

Node.js 22.18+와 cf CLI 사용. `npm install`, `npm test`, `npm run build`, `npm run deploy` 순서. cf 로그인은 본인 계정으로 수행합니다. `scripts/build.mjs`는 `web.html`을 `worker.js`에 주입하여 `dist/worker.mjs`를 생성합니다. `dist`는 .gitignore 처리합니다. API로 첫 배포를 수행했으며 GitHub 푸시가 자동 배포된다고 가정하지 않습니다.

Cloudflare DB: `iir-investment-radar` (APAC). 신규 환경에서는 `migrations/0001_init.sql`, `migrations/0002_historical_seed.sql` 순서로 적용. 초기 가격은 2026-11-09 **역사적 조사값**이고 검증 전 SEC 신호입니다.

## 공개 API

- `GET /api/status` — SEC·주가·기술 데이터 각 갱신 상태
- `GET /api/candidates?page=1&limit=50&mode=ALL_ELIGIBLE&sort=priority` — 점수 범위·확인율 포함
- `GET /api/candidates/:ticker`, `GET /api/candidates/:ticker/history` — 상세·스냅샷
- `GET /api/signals?since=2026-11-01` — SEC 신규 공시의 미검증 후보
- `GET /api/meta/rubric` — 100점 기준 v0.2.0
- `POST /api/admin/refresh`, `POST /api/admin/stop` — 관리자 토큰 미설정 시 403

## 자동 갱신

UTC `30 23 * * MON-FRI`(KST 화~토 08:30), UTC `30 11 * * MON-FRI`(KST 월~금 20:30). Cron 등록은 자동수집 성공을 보장하지 않습니다.

서버 비밀 `SEC_CONTACT_EMAIL`: **실제 연락 가능한 이메일**을 Worker secret으로 등록해야 공시 수집을 시도합니다. 이 값이 없다면 `NOT_CONFIGURED`로 안전 중단. 계정 이메일을 본인 허락 없이 공개 코드에 넣지 않습니다. `ADMIN_TOKEN`: 24자 이상 랜덤 문자열로 서버에만 저장하며 브라우저·Public GitHub에 저장하지 않습니다.

하나의 SEC 작업은 대상 최대 5개사, 새 공시 8건, 요청 18회, 총 39초, 요청당 4.8초, 재시도 최대 2회로 제한합니다. 401/403/429는 즉시 중지. D1 lease 120초, cursor checkpoint, accession/거래 중복키, 긴급 중지 enabled=0, 실패 시 이전 정상 데이터 보존. 원문 P 코드는 *미검증*으로만 저장하고 사적 거래, 10b5-1, 4/A 수정, 관련자 독립성은 확인 전 확정하지 않습니다.

## 아직 미구현

현재 시세 공급원, 사람 검증 편집 화면, React/Vite + Workers Static Assets 전환, AI 기술평가, SEC 실제 네트워크 성공 확인. 거짓 점수/계약일 생성 금지. 자료의 역사적 시점과 마지막 성공 시각을 분리합니다.
