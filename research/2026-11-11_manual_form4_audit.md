# IIR | 2026-11-11 최초 수동 Form 4 근거 등록 현황

- 작성/확인: 2026-11-11 KST
- 최초 연구 기준: RUBRIC v0.2.0 (기준서 및 기존 2026-11-09 스냅샷 미수정)
- 수집 방식: 수동 SEC 문서 검색 및 공개된 Form 4 거래 표 대조. 일괄 자동수집 성공을 의미하지 않음
- D1 저장: 18개 공시 관련 기록 / 22개 P 취득 거래 행 / 10개 기존 후보
- 분류: SEC 원문에서 P 거래·주식수·신고가격 확인 = `P_CONFIRMED_PLAN_UNCHECKED`. 제삼자 집계에서 확인한 ADTN 2건은 `SECONDARY_P_UNVERIFIED`; SEC 직접 원문을 확인했다는 의미가 아님
- 여전히 미확인: 10b5-1, 시장/사적 취득 분류, 독립 매수 주체, 정정 Form 4/A, 공시 접수시각 UTC. 일부 공시는 상장사와 신고자 CIK 디렉터리 경로가 다름
- 위험: 공개된 기본 매수집계 `companies.buy_amount_usd`를 이번 일부 원문 금액 합으로 대체하지 않음. 사용자는 진입 적합성과 공시 사실을 별도로 검토할 것
- 가격: 웹 상세 화면의 TradingView 공식 차트 임베드에서 기간을 선택. 외부 사업자의 가격을 D1로 무단 복제하지 않았음

## 수동 자료 목록

| 티커 | 신고자 | 거래일(최초) | P 거래 행 | 확인된 신고금액(USD) | 확인 수준 | SEC 관련 링크 |
|---|---|---|---:|---:|---|---|
| ADTN | Thomas R Stanton | 2026-11-06 | 1 | $600,900 | 보조집계 대조 / SEC 거래행 미열람 | [Form 4](https://www.sec.gov/Archives/edgar/data/926282/000119312526454019/0001193125-26-454019-index.htm) |
| ADTN | Timothy P Santo | 2026-11-06 | 1 | $74,188.22 | 보조집계 대조 / SEC 거래행 미열람 | [Form 4](https://www.sec.gov/Archives/edgar/data/926282/000119312526454020/0001193125-26-454020-index.htm) |
| AMRC | George P Sakellaris | 2026-08-07 | 3 | $180,920 | SEC P 거래행 확인 / 계획매매 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/1488139/000162828026055891/xslF345X06/wk-form4_1786490560.xml) |
| AMRC | George P Sakellaris | 2026-08-28 | 1 | $66,390 | SEC P 거래행 확인 / 계획매매 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/1488139/000162828026059708/xslF345X06/wk-form4_1788264569.xml) |
| ANIX | Lewis H Titterton Jr | 2026-09-23 | 1 | $131,906.84 | SEC P 거래행 확인 / 계획매매 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/1499254/000149315226044250/xslF345X03/ownership.xml) |
| APTV | Paul M Meister | 2026-08-05 | 1 | $4,999,958.88 | SEC P 거래행 확인 / 계획매매 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/1521332/000119312526337965/xslF345X03/ownership.xml) |
| APTV | Kevin P Clark | 2026-08-10 | 1 | $2,502,684.22 | SEC P 거래행 확인 / 계획매매 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/1521332/000119312526344586/xslF345X03/ownership.xml) |
| APTV | Sean O Mahoney | 2026-08-11 | 3 | $552,683.2 | SEC P 거래행 확인 / 계획매매 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/1521332/000119312526346801/xslF345X06/ownership.xml) |
| APTV | Hakan Agnevall | 2026-08-13 | 1 | $199,182.1 | SEC P 거래행 확인 / 계획매매 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/1521332/000119312526354007/xslF345X03/ownership.xml) |
| ENPH | Badrinarayanan Kothandaraman | 2026-11-02 | 1 | $267,514 | SEC P 거래행 확인 / 계획매매 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/1463101/000154377726000006/xslF345X06/wk-form4_1793656765.xml) |
| ENPH | Shanker Trivedi | 2026-11-03 | 1 | $30,590 | SEC P 거래행 확인 / 계획매매 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/1463101/000133788726000007/xslF345X06/wk-form4_1793743455.xml) |
| GFS | Ganesh Moorthy | 2026-11-05 | 1 | $93,700 | SEC P 거래행 확인 / 계획매매 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/1218184/000162828026071813/wk-form4_1794006357.xml) |
| GFS | Jack Lazar | 2026-11-06 | 1 | $380,000 | SEC P 거래행 확인 / 계획매매 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/1709048/000170904826000266/wk-form4_1794262871.xml) |
| IMSR | Simon Irish | 2026-10-13 | 1 | $50,818.3 | SEC P 거래행 확인 / 계획매매 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/2019804/000119312526421089/xslF345X03/ownership.xml) |
| PRCT | Larry L Wood | 2026-08-07 | 1 | $498,315 | SEC P 거래행 확인 / 계획매매 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/1440660/000162828026054970/xslF345X06/wk-form4_1786356427.xml) |
| SOPH | Ross Muken | 2026-11-06 | 1 | $137,188 | SEC P 거래행 확인 / 계획매매 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/1840706/000184070626000351/wk-form4_1794258350.xml) |
| SOPH | George Cardoza | 2026-11-06 | 1 | $141,200 | SEC P 거래행 확인 / 계획매매 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/1840706/000184070626000352/wk-form4_1794258359.xml) |
| XRAY | Michael J Barber | 2026-06-11 | 1 | $150,004.88 | SEC P 확인 / 사적취득 여부 미확인 | [Form 4](https://www.sec.gov/Archives/edgar/data/818479/000081847926000208/xslF345X06/form4.xml) |

## 현 단계에서 확인된 차이/주의

1. **APTV Sean Mahoney:** 2026-08-11 Form 4에 P 거래가 4,000주·6,000주·1,000주 **합계 11,000주**로 기록되어 있다. 2026-11-09 초기 스크리닝의 "이사 10,000주" 또는 약 $50만 집계와 일치하지 않으므로 후속 확인 시 원문 기준으로 검토할 것. 과거 스냅샷 자체는 그대로 유지.
2. **AMRC:** George Sakellaris가 서로 다른 두 공시에 반복 등장한다. 이 자료의 공시 건수와 독립 매수자 수는 같지 않다.
3. **ADTN:** CEO Stanton의 Form 4에는 매수 P 외에 기타 F/M 거래도 함께 신고되어 있을 수 있다. 본 DB에는 P 거래만 추렸다. 이 2건은 원문 직접 재검증 전이므로 클러스터 확정 금지.
4. **XRAY:** 코드 P는 확인했지만 사적 취득/인센티브 거래 여부 추가 검증 필요. 신고자의 숫자가 곧 독립적 시장 매수자의 숫자가 아님.
5. **PRCT:** Larry Wood 매수는 신탁 간접보유로 표기됨. 단독 거래이며 클러스터 아님.
6. **IMSR:** 예시로 CEO Simon Irish 2026-10-13 매수를 저장했으며, 다른 신고자 2명에 대한 전건 점검은 후속 검증 필요.
7. **기술·재무 및 현재 매수 적합성:** 오늘 수동 입력은 Form 4 부분 증거 축적이며 기술/재무 점수를 채우지 않았다.

## 이후 할 일

- SEC 원문/4A 전건 대조, 10b5-1 플래그, 공시 접수 시각 및 관계자 중복 제거
- 종목별 최신 10-Q/현금 소진/ATM 위험, 기술 난제 및 이벤트 일정 추가
- 가격 차트 이용조건/제공사 표시 유지. 가격 데이터 공급원 라이선스를 확보하기 전까지 자체 가격 DB와 자동 가격 점수는 미연결 유지
- SEC 자동수집은 서버 비밀 `SEC_CONTACT_EMAIL` 설정 후 실제 성공 여부 검증
