# IIR SEC Form 4 수집 장애 분석·복구 계획 (2026-11-17, KST)

## 결론과 증거의 등급

**검증 완료:** 과거 수집기의 경로 구성에 결함이 있었다. `www.sec.gov/submissions/...` 대신 `data.sec.gov/submissions/...`를 사용해야 하며, 제출된 Form 4의 XSL 화면 주소 대신 실제 XML 원문을 파싱해야 한다. 2026-11-17 08:30 KST에 기록된 `SEC_HTTP_404`는 이 수정들이 배포되기 이전의 기록이다.

**검증 완료:** Cloudflare 동일 계정에 일시 설치한 별도 진단 Worker에서 `data.sec.gov/submissions/CIK0000926282.json`, `www.sec.gov/Archives/edgar/data/926282/000119312526458287/ownership.xml`, `www.sec.gov/files/company_tickers.json`을 각각 **HTTP 200**으로 읽었다(약 174ms/200ms/23ms). Cloudflare 전체에 대한 SEC 일괄 접근 차단은 확인되지 않았다. 진단 Worker는 바로 삭제했다. 이 시험은 실제 본 수집기의 데이터 저장 성공을 증명하지는 않는다.

**미확인:** 운영 `sec_form4` 작업이 새 코드로 완주한 기록은 아직 없다. 해당 작업은 2026-11-17 13:33 KST 최종 배포 시점까지 여전히 이전 실행의 `FAILED / SEC_HTTP_404`를 가리켰다. 이번 작업 중 추가한 임시 단일 Cron은 실행되지 않아 즉시 제거했으며, 기존 두 정기 Cron만 유지했다.

## 확인한 결함과 수정 내용

| 단계 | 발생했던 문제 | 반영 조치 |
|---|---|---|
| SEC 공시 목록 | 잘못된 API 호스트로 404 | `data.sec.gov/submissions/` 사용 |
| Form 4 문서 | XSL HTML을 원문 XML로 오인 가능 | 파일명을 원문 `ownership.xml` 등으로 정규화 |
| 종목 식별 | 활성 후보 CIK 13개 누락 및 PRCT 회사 CIK 오등록 | 운영 20개 CIK 등록, PRCT 회사 CIK 0001588978, CADL SEC 10-Q 출처 보완 |
| 기관/사람 CIK 혼동 | 보고의무자 CIK가 회사 CIK와 다를 수 있음 | SEC submissions의 **발행회사** CIK·티커, XML의 `issuerCik`·`issuerTradingSymbol` 검증 |
| 중복 | 기존 `UNIQUE(cik,accession_number)`만으로 CIK가 다른 동일 접수번호 중복 가능 | 글로벌 접수번호 UNIQUE 인덱스 `0008_sec_accession_uniqueness.sql` + 코드 조회 조건 변경 |
| 중단·재시도 | 이전 예산·실행 제한 검토 필요 | 요청 단위 예산, 기업별 오류 최대 2개, 회차 39초, D1 잠금·cursor 유지 |
| 오류 분석 | `SEC_HTTP_404`만으로 실패 대상을 알기 어려움 | `SUBMISSIONS`/`FORM4_XML`/`TICKER_MAP` 단계별 HTTP 오류와 타임아웃 표시 |
| UI 신호 | DB 공시 미수집과 미검증 P 신호가 섞여 보임 | `NOT_COLLECTED`, `FORM4_NO_P`, `UNVERIFIED` 구분. 단, 정밀한 마지막 기업별 조회시각은 추후 개선 필요 |
| 바이오 위험/반증 | 폭과 줄바꿈 불명확 | 245px 열 폭, `white-space:normal`, `overflow-wrap:anywhere`, `word-break:break-word` 적용. 실제 브라우저 10개 중 9개 여러 줄 확인 |

운영 데이터 변경은 **비파괴적**으로 진행. 기존 거래·공시·가격·10+10 후보 보존. 이전 PRCT Form 4의 제출자 CIK 0001440660은 기업 발행회사 CIK와 다르더라도 반드시 오류라고 볼 수 없으므로 이력 삭제 금지.

## 다음 실제 Cron의 합격 조건

- 기존 일정: UTC 11:30 월~금 = **한국시간 20:30 월~금**, UTC 23:30 월~금 = **한국시간 익일 08:30 화~토**.
- 2026-11-17 20:30 KST 이후 `GET /api/status`와 아래 SQL을 확인.
- `last_attempt_at_utc`가 배포 이후 시간이 되어야 '새 코드 실행'으로 볼 수 있음.
- `pipeline_runs`에서 `state`, `cursor`, `checked_count`, `changed_count`, `error_summary` 확인.
- Form 4가 없는 회차는 `checked_count=0`도 가능하므로, 상태·cursor와 기업별 근거를 함께 봐야 함. P 매수 미검출을 '내부자 매수 없음'으로 단정하지 않음.
- 기술 SERV·OUST·TMDX는 알파벳 순 후보 수집상 앞부분에 없으므로 **1회 Cron 성공만으로 전체 20개 검증을 주장하지 않음**. 회차당 최대 5개사, 8개 Form4, 요청 최대 18회, 실패시 cursor 복구. 전체 한 바퀴가 완료되어야 후보군 커버리지를 주장할 수 있음.

```sql
SELECT job_name,last_attempt_at_utc,last_success_at_utc,
       last_run_state,last_error,cursor,error_count
FROM pipeline_state ORDER BY job_name;
SELECT started_at_utc,finished_at_utc,state,checked_count,
       changed_count,cursor,error_summary
FROM pipeline_runs WHERE job_name='sec_form4'
ORDER BY started_at_utc DESC LIMIT 10;
SELECT f.company_ticker,COUNT(DISTINCT f.id) AS checked_form4,
       COUNT(t.id) AS extracted_P_trades
FROM filings f LEFT JOIN insider_transactions t ON t.filing_id=f.id
GROUP BY f.company_ticker ORDER BY f.company_ticker;
```

## 실패 코드별 조건부 조치

1. **실행 기록 자체가 없음:** Cloudflare Workers > iir-innovation-radar > Settings > Cron Trigger Events 및 Worker 로그 확인. `scheduled()` 핸들러·Cron 2개·`pipeline_state.enabled`·`AUTOMATION_ENABLED` 설정 비교. Cron 일정 변경이 즉시 실행되는 것은 아님.
2. **`SEC_HTTP_404_SUBMISSIONS`:** 대상 CIK가 현재 SEC 제출 공시 경로에 있는지 확인. `CIK##########.json`와 기업명·티커가 일치하는지 1회 점검 후 교정. 임의 CIK 대체 금지.
3. **`SEC_HTTP_404_FORM4_XML` 또는 `SEC_UNSUPPORTED_FORM4_XML`:** 제출자(보고의무자)와 발행회사 CIK가 다를 수 있음. 개별 SEC `Archives`의 `index.json` 및 실제 `primaryDocument` 확인 후 파일 링크 해결 로직 보강. HTML을 매수신호로 저장하지 않음.
4. **`SEC_HTTP_401/403/429_STOP_...`:** 실제 Worker outbound SEC 접근과 SEC 이용정책·User-Agent·요청속도 확인. 재시도 난사 금지. 공식/허가된 대체 수집 경로, 사전 검증된 데이터 제공자, 또는 별도 승인된 서버 수집기 이용 검토.
5. **`SEC_TIMEOUT_...`:** 실제 네트워크 지연이 확인된 경우에만 요청당 4.8초 상한을 완만히 조정하고, 회차당 기업·문서 수를 줄여 총 39초 제한·중복 방지·일시정지 유지.
6. **`SEC_CIK_TICKER_MISMATCH`/`SEC_FORM4_ISSUER_MISMATCH`:** 해당 기업 자동 기록 중단, SEC 원문에서 발행회사 식별값을 확인 후 기존 분류를 보존하며 승인된 정정 수행.
7. **성공하지만 'SEC 미수집' 표기:** 최근 Form4 2건에서 P가 없거나 아예 제출 공시가 없을 수 있음. 운영 단계에서 회사별 `last_checked_at`, 수집 범위/결과를 명시하는 신규 비파괴 테이블을 만드는 개선안 적용. 단일 성공 회차로 내부자 부재 확정 금지.

## 장기 개선 순서

P0: 실제 Cron 성공/실패 로그 확인, 오류 코드가 알려주는 단계만 수정. 원인 재현 없는 임의 변경 방지.
P1: 회사별 검사 이력·범위·상태 저장, '미확인'과 '검사 완료·P 미검출' 구분.
P2: SEC Form 4 보고의무자 다수·4/A 수정·10b5-1·증여·시장 외 거래를 단계별 수동 검증한 후 클러스터 판정. 검증 전 점수 NULL 유지.
P3: 관리자 인증을 **Cloudflare 비밀변수**로 안전하게 구성하고 `POST /api/admin/refresh` 수동 실행 및 중지 기능 마련. 키는 GitHub, HTML, 로그에 노출 금지. 자동실패 감시·알림은 사용자 승인 후 설정.
P4: 수집처 문제가 반복되면 SEC 정책을 준수하는 별도 fetch 실행 환경 또는 공식 데이터 제공자로 분리. 시세 파이프라인과 격리하며 복구 체크포인트·실패 횟수 상한 유지.

참고: [SEC EDGAR API](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), [SEC Archives/CIK 안내](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data), [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
