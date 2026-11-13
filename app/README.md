# IIR Innovation Radar — MVP v0.1

운영 주소: https://iir-innovation-radar.shnboy.workers.dev/

**실제 구성:** Cloudflare Workers + D1 + Cron. 성능/신속한 운영을 우선해 초기 UI는 경량 HTML/CSS/JS로 작성했으며 React/Vite로 만들었다고 주장하지 않습니다. RUBRIC v0.2.0의 100점 배점은 유지하고, 승인된 바이오 범위·분기 운영 규칙은 STANDARD v0.3 및 BIO_QUARTERLY_POLICY에 버전별로 기록했습니다.

## 로컬 개발 / 배포

Node.js 22.18+와 cf CLI 사용. `npm install`, `npm test`, `npm run build`, `npm run deploy` 순서. cf 로그인은 본인 계정으로 수행합니다. `scripts/build.mjs`는 `web.html`을 `worker.js`에 주입하여 `dist/worker.mjs`를 생성합니다. `dist`는 .gitignore 처리합니다. API로 첫 배포를 수행했으며 GitHub 푸시가 자동 배포된다고 가정하지 않습니다.

Cloudflare DB: `iir-investment-radar` (APAC). 신규 환경에서는 `migrations/0001_init.sql`, `0002_historical_seed.sql`, `0003_market_close.sql`, `0004_bio_quarterly.sql`, `0005_q4_candidate_intake.sql`, `0006_us_company_only.sql` 순서로 적용. 초기 가격은 2026-11-09 **역사적 조사값**이고 검증 전 SEC 신호입니다.

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

## 미국 주식 마지막 거래일 종가 (v0.2)

- 2026-11-12 첫 조회 시 **2026-11-11 정규장 종가 10종목**을 Yahoo Finance v8 chart의 `interval=1d` 종가에서 확인하고 D1 `market_snapshots`에 저장. 원본 `companies.seed_price_usd`, `seed_price_asof=2026-11-09`는 절대 덮어쓰지 않음.
- 공개 후보 API는 `latest_close_usd`, `latest_close_date`, `latest_close_source`를 반환하고, 데이터가 없을 때 과거 11/9 가격을 현 시세처럼 대체하지 않음. 상세 API의 `market_prices`에도 날짜별 저장.
- SEC와 별도의 `market_close` 작업이 동일 Cron 일정에 따라 최대 10개 티커를 회차별로 조회. 최대 49초, 티커당 5.2초, 한 요청당 재시도 0회, 120초 DB 작업 임대, 진행 cursor 체크포인트. 실패 시 마지막 정상 가격을 **기준일과 함께** 유지. 거래시간 뉴욕 정규장 종료 30분 전에는 해당 날짜 미완료 일봉을 저장하지 않음.
- 제공처: Yahoo Finance chart v8 공개 일봉 (비공식/문서화되지 않은 인터페이스, 서비스 정책 또는 차단에 따라 중단될 수 있음). 가격은 **실시간·시간외 시세가 아님**. 일별 스냅샷은 가격 제공자마다 주식분할 처리 등이 다를 수 있어 역사적 수익률 계산 기준이 아님. 업무 상 안정적인 사용 또는 재배포에 라이선스가 필요하면 정식 시세 API로 교체.
- DB 마이그레이션은 `0003_market_close.sql`을 추가 실행. 첫날의 초기 갱신분은 수동으로 저장하였으며 `market.last_success_at`은 **Cron API가 성공했을 때만** 생성됨. 상태 확인: `GET /api/status`.
- 향후 신규 기업이 10개보다 늘어나면 `market_close`는 티커 정렬 순서대로 회차당 10개를 조회하고 다음 회차에 이어서 진행. 휴장일에도 마지막 거래일이 명시됨.
- 서버측 관리자 인증이 구성된 환경에서만 `POST /api/admin/market-refresh` 및 `POST /api/admin/market-stop` 사용 가능.

## 분기형 바이오·기술혁신주 이중 레이더 (v0.3)

- 공식 승인: 저장소 루트의 `BIO_QUARTERLY_POLICY.md`; 치매/노화/암/탈모/실질 바이오 AI 태그, 전임상 포함, 화장품·보조제 제외, 일반 의료로봇은 기술 탭에 남김.
- 동일 D1에 연구 분기 `research_quarters`, 분기별 회사 `research_quarter_entries`, 바이오 프로필·태그·자산·임상·마일스톤 테이블을 별도 추가. 기존 내역과 이력 절대 덮어쓰기 금지.
- 2026Q4 기존 후보 10개는 `LEGACY_SEED` 8 TECH/2 BIO, **2026Q4에 새로 발굴했다고 간주하지 않음**.
- `GET /api/quarter`는 분기 ID와 상태 통계를, `GET /api/candidates?mode=QUALIFIED_BIO&quarter_only=1`은 현분기 바이오 목록을 반환. `GET /api/candidates/:ticker`는 파이프라인·태그·마일스톤·분기 이력 정보(검증 전은 비워둠)를 반환.
- 분기 경계에서 `RESEARCHING`/`CARRY_FORWARD`만 회차당 40개씩 신규 분기 `CARRYOVER`로 자동 이월. `EXCLUDED`는 자동 이월하지 않으며 과거 이력에 남김. **보류 전용 목록은 없음**. 이월은 연구 완료나 임상 성공을 의미하지 않음.
- **아직 자동 신규 기업 발굴·임상 연구 평가·관리자 편집 화면은 미구현**; 해당 영역을 자동화된 것처럼 표현하지 않음.

## 2026-11-13 후보 20개 운영 화면 (v0.3.1)

- 기술혁신 10개 (기존 8 + 신규 SERV/AUR), 바이오 10개 (기존 2 + 신규 VYGR/ACIU/BIOA/MANE/CGON/RXRX/AURA/CADL).
- 두 탭은 같은 D1/시장가/SEC 이력 사용. 기술 탭은 기존 다크블루 팔레트, 바이오 탭은 명도를 유사하게 유지한 딥 버건디(화면 배경 `#170d14`)로 분리. 기술·바이오 화면 URL은 `?view=tech`, `?view=bio`.
- 바이오 태그 DEMENTIA/AGING/CANCER/ALOPECIA/APPLIED_AI, 임상 프로그램/단계/예상 이벤트, 근거 원문 링크 제공. **노화 경로 표적 ≠ 사람의 수명 연장 입증**, **MANE 신규 제형 ≠ 새로운 모낭재생 기전**.
- 2026Q4 신규 회사 10개는 모두 분기 `NEW, RESEARCHING` / 기술 우선 B경로 / SEC 내부자 거래 미확인. `seed_price_usd=NULL`, `seed_price_asof=NULL`, `signal_type=NONE`. 주가나 매수 신호 임의 입력 금지.
- 01~10은 두 탭 내부의 현재 목록 순번으로 투자 추천·점수·공식 연구순위가 아님. 기존 점수는 별도의 과거 평가 근거로 보존.
- 연구 근거: `research/2026-11-13_q4_candidate_intake.md`. 회사 IR 발표는 **기업 주장의 원문 출처**이며 독립 확인을 마친 임상 성공을 뜻하지 않는다.
- 새로운 티커의 최근 종가는 Cron 가격 수집이 성공하면 저장·표시되며, 그 전까지 **종가 수집 대기**로 표시한다. 클라우드 운영에서 자동 시세 수집의 실제 성공은 `GET /api/status`로 별도 확인.
- 브라우저 테스트: 10+10 탭 전환, 치매/암/노화/탈모 필터, 버건디/기존 다크 테마, 원문 링크, 신규가격 미수집 표시 검증.

## 아직 미구현

보장된 정식 라이선스 시세 API, 사람 검증 편집 화면, React/Vite + Workers Static Assets 전환, AI 기술평가, SEC 실제 네트워크 성공 확인. 거짓 점수/계약일 생성 금지. 자료의 역사적 시점과 마지막 성공 시각을 분리합니다.

## 미국 본사·법인 레이더만 표시 (v0.3.2 / 2026-11-13)

- `app/migrations/0006_us_company_only.sql`에서 **기술 10 + 바이오 10** 유지: 제외 APTV/GFS/SOPH/ACIU, 신규 OUST/TMDX/ANVS/FATE. 기존 공시·가격·점수·분기 연구 데이터 보존, 삭제 금지.
- `company_listing_verification` 24개 티커에 미국 법인·본사 국가, NYSE/Nasdaq 시장, SEC 또는 공식 기업 IR 출처, 확인일 기록. 미국 법인+미국 본사+미국 거래소 보통주만 `US_CONFIRMED`.
- 후보·연구상세·신호·수집 API는 `company_listing_verification` 활성 자격 필터를 강제하며, 자격 미확인 종목은 신규 발굴 시 바로 화면에 노출되지 않음.
- **IMSR**: 캐나다에서 시작했지만 2024년 델라웨어로 미국 법인 재설립, 미국 Charlotte 본사이므로 유지 (SEC 2026 Form 10-Q).
- ANVS: 2026년 10월 NYSE 상장요건 통지 및 11월 증자·워런트 위험이 큰 **고위험 조사 후보**. 01~10은 추천/확정 수익순위 아님.
- 국내 증권사별 매매 가능 여부는 실시간 검증하지 않으므로 포털/레이더 모두 거래가능 확답을 제공하지 않음.
- 연구 기록: `research/2026-11-13_us_only_reselection.md`.
