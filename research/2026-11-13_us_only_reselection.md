# 2026Q4 미국법인·미국본사·NYSE/Nasdaq 보통주 전용 레이더 재선별

**판정일: 2026-11-13 | 기준서: STANDARD v0.3.2 / RUBRIC v0.2.0 유지**

> 요청: 한국의 미국주식 해외거래 환경에서 접근하기 쉬운 미국 상장 기업으로 두 레이더를 재구성. 이전 승인대로 기술혁신주 10개 + 바이오 혁신주 10개 유지. 한국 증권사별 실거래 지원 여부는 계좌로 확인해야 하며, 이 연구는 매수 추천이 아니다.

## 필터 기준
- 미국에서 설립된 미국 법인 **그리고** 현재 미국 본사 **그리고** NYSE/Nasdaq 보통주 상장.
- 미국에 주식을 상장했다고 해서 미국 기업인 것은 아니다. ADR·외국 법인·유럽/일본 등 해외 본사 제외. 케이맨제도 법인 GFS도 제외.
- 법인 설립국/본사국/주 거래소/근거 링크를 `company_listing_verification`에 등록하고, 공시와 시세 수집에서도 `US_CONFIRMED`만 사용.
- 과거 평가 기록은 남기되 목록에서 해외기업 제거. 국적/법인 소재지 확인과 국내 브로커별 주문가능 여부는 별개의 판단이다.

## 제거 (4개)
| 티커 | 상장/설립 | 본사 | 제외 근거 |
| --- | --- | --- | --- |
| **APTV** | NYSE / 저지섬 | 스위스 샤프하우젠 | [SEC Aptiv 10-K](https://www.sec.gov/Archives/edgar/data/1521332/000152133226000009/aptv-20251231.htm) |
| **GFS** | Nasdaq / 케이맨제도 | 미국 뉴욕 Malta | [SEC GlobalFoundries 20-F](https://www.sec.gov/Archives/edgar/data/1709048/000170904826000022/gfs-20251231.htm) — 미국 본사여도 외국 법인 |
| **SOPH** | Nasdaq / 스위스 | 스위스 Rolle | [SEC SOPHiA 20-F](https://www.sec.gov/Archives/edgar/data/1840706/000184070626000006/soph-20251231.htm) |
| **ACIU** | Nasdaq / 스위스 | 스위스 Lausanne | [AC Immune IR FAQ](https://ir.acimmune.com/stock-information/faq) |

> **IMSR 유지 사유:** 본래 캐나다에서 사업 시작했으나 2024년 미국 델라웨어 법인으로 이전했으며 미국 Charlotte, NC 본사, Nasdaq IMSR 보통주. [SEC Terrestrial Energy 2026 10-Q](https://www.sec.gov/Archives/edgar/data/2019804/000110465926094085/tmb-20260630x10q.htm).

## 기술혁신주 10개
| 티커 | 기술군 | 2026Q4 구분 |
| --- | --- | --- |
| ADTN | 광통신 / 50G PON | 기존 |
| AMRC | 분산 전력 제어 / 마이크로그리드 | 기존 |
| AUR | 무인 화물 운송 | 기존 |
| ENPH | 마이크로인버터 / 분산 ESS | 기존 |
| IMSR | 용융염 원자로 | 기존; 미국 재등록 완료 |
| **OUST** | **3D 라이다 / 로봇·Physical AI** | **NEW** |
| PRCT | HYDROS 수술 로봇 | 기존 |
| SERV | 배송 로봇 | 기존 |
| **TMDX** | **OCS 장기이식 및 살아 있는 장기 보존·평가** | **NEW** |
| XRAY | 디지털 의료기기 | 기존 |

**OUST** (Nasdaq / Delaware / San Francisco): 2026년 3분기 센서 출하, 라이다·카메라 통합 기반 AI 로봇 인지 상용화 확인. [SEC Form 10-K](https://www.sec.gov/Archives/edgar/data/1816581/000162828026013313/oust-20251231.htm) · [2026 Q3 기업 IR](https://investors.ouster.com/news-releases/news-release-details/ouster-announces-results-third-quarter-2026). *반증:* 대량 출하 대비 수익성, 차세대 제품 경쟁력·시장 가격 및 자금조달.

**TMDX** (Nasdaq / Massachusetts / Andover): OCS 장기이식 의료기술과 National OCS Program 상용화. 2026 Q3 실적 및 FDA IDE 진척 확인. [SEC Form 10-K](https://www.sec.gov/Archives/edgar/data/1756262/000119312526067032/tmdx-20251231.htm) · [2026 Q3 기업 IR](https://investors.transmedics.com/news-releases/news-release-details/transmedics-reports-third-quarter-2026-financial-results). *반증:* 확대되는 서비스 비용, 신규 적응증 임상·허가·주가 선반영 위험.

## 바이오 혁신주 10개
| 티커 | 관심 기술 | 2026Q4 구분 |
| --- | --- | --- |
| ANIX | 🎗 암 / 백신 및 세포치료 | 기존 |
| **ANVS** | **🧠 알츠하이머 / buntanetap 3상** | **NEW · 고위험** |
| AURA | 🎗 안구암 / bel-sar | 기존 |
| BIOA | 🧬 노화 관련 염증 기전 / NLRP3 | 기존 |
| CADL | 🎗 전립선암 / 바이러스 면역치료 | 기존 |
| CGON | 🎗 방광암 / 종양용해 바이러스 | 기존 |
| **FATE** | **🎗 항암 / iPSC 유래 범용 NK 세포치료 FT836** | **NEW** |
| MANE | 🌱 탈모 / 경구 서방형 미녹시딜 | 기존 |
| RXRX | 🎗 암 · ✦ AI 활용 신약개발 | 기존 |
| VYGR | 🧠 알츠하이머 / 타우 표적 치료 | 기존 |

**ANVS** (NYSE / Delaware / Malvern PA): 알츠하이머 치료 후보 **buntanetap**, 미국 상장 알츠하이머 임상 3상. [SEC 2025 10-K](https://www.sec.gov/Archives/edgar/data/1477845/000110465926027751/anvs-20251231x10k.htm) · [기업 발표 목록](https://www.annovisbio.com/press-release). **매우 높은 위험:** 2026-10-30 NYSE 상장요건 통지, 2026-11 유상증자·워런트 희석, 3상 결과 미확정. 이는 임상 효능 확정/투자추천이 아니다.

**FATE** (Nasdaq / Delaware / San Diego CA): iPSC 유래 세포치료의 여러 파이프라인 중 **FT836**를 암 관련 연구로 분리. 회사의 2026년 주력은 자가면역이므로 **항암 프로그램과 구분**. 2026-11-05 발표에서 암/자가면역을 모두 설명. [SEC Form 10-Q](https://www.sec.gov/Archives/edgar/data/1434316/000119312526448543/fate-20260930.htm) · [2026 Q3 기업 IR](https://ir.fatetherapeutics.com/news-releases/news-release-details/fate-therapeutics-reports-third-quarter-2026-financial-results). *반증:* 소표본 항암 임상·개발 우선순위 이동·신규 투자/현금 소진.

## 데이터 처리와 후속 점검
- 추가 4개는 `NEW`, `RESEARCHING` 분기 조사 후보이고, 내부자 매수량/매수일/종가/점수는 검증 전이므로 가상 입력하지 않았다.
- 제외 4개는 `FOREIGN_ISSUER_EXCLUDED`, `research_quarter_entries.review_status=EXCLUDED`. 기존 `filings`, `candidate_signals`, `score_snapshots`, `market_snapshots`는 삭제하지 않았다.
- 실제 거래는 대한민국 증권사의 미국주식 검색창에서 보통주 `OUST, TMDX, ANVS, FATE` 등에 대한 **주문 가능 여부를 직접 확인**할 것. 모든 증권사가 상장 보통주를 일률적으로 취급한다고 보증하지 않는다.
- 상장상태·법인소재 변경 시 재검증 및 제외 필요. 미국 법인과 미국 본사 정보 없이 단순 NASDAQ 상장만으로 목록에 넣지 않는다.
