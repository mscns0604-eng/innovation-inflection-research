import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker, {scoreRange,parseForm4,parseLatestYahooClose,quarterFor,previousQuarter,secSourceUrl,rawForm4DocumentName,cikFromVerifiedSecUrl,secIssuerIdentityMatches,form4IssuerMatches,parseRegisteredTrial,calendarPhaseGroup} from '../dist/worker.mjs';

test('missing components remain unknown, not zero', () => {
 const r=scoreRange({});
 assert.deepEqual(r,{confirmed_score:null,possible_score:null,coverage_pct:0});
});
test('partial score preserves a possible interval', () => {
 const r=scoreRange({insider:20,theme:15,technology:13,financial:6});
 assert.deepEqual(r,{confirmed_score:54,possible_score:79,coverage_pct:75});
});
test('confirmed zero is different from unknown', () => {
 const r=scoreRange({macro:0});
 assert.deepEqual(r,{confirmed_score:0,possible_score:95,coverage_pct:5});
});
test('reject invalid dimension and prevent inflated scores', () => {
 assert.throws(()=>scoreRange({insider:26}),/INVALID_SCORE/);
});
test('parse only Form4 acquired P; no automatic verification', () => {
 const xml='<ownershipDocument><reportingOwner><reportingOwnerId><rptOwnerCik>1234</rptOwnerCik><rptOwnerName>Owner</rptOwnerName></reportingOwnerId></reportingOwner>'+
 '<nonDerivativeTransaction><transactionDate><value>2026-11-09</value></transactionDate><transactionCoding><transactionCode>P</transactionCode></transactionCoding><transactionAmounts><transactionShares><value>100</value></transactionShares><transactionPricePerShare><value>2</value></transactionPricePerShare><transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode></transactionAmounts></nonDerivativeTransaction>'+
 '<nonDerivativeTransaction><transactionDate><value>2026-11-09</value></transactionDate><transactionCoding><transactionCode>M</transactionCode></transactionCoding><transactionAmounts><transactionShares><value>100</value></transactionShares><transactionPricePerShare><value>0</value></transactionPricePerShare><transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode></transactionAmounts></nonDerivativeTransaction></ownershipDocument>';
 const r=parseForm4(xml);
 assert.equal(r.status,'UNVERIFIED');
 assert.equal(r.transactions.length,1);
 assert.equal(r.transactions[0].value,200);
 assert.equal(r.transactions[0].ownerCik,'1234');
});
test('SEC submissions and raw Form 4 use the correct official host and safe document path',()=>{
 assert.equal(secSourceUrl('/submissions/CIK0000926282.json'),'https://data.sec.gov/submissions/CIK0000926282.json');
 assert.equal(secSourceUrl('/files/company_tickers.json'),'https://www.sec.gov/files/company_tickers.json');
 assert.equal(rawForm4DocumentName('xslF345X06/ownership.xml'),'ownership.xml');
 assert.equal(rawForm4DocumentName('ownership.xml'),'ownership.xml');
 assert.equal(secSourceUrl('/Archives/edgar/data/926282/000119312526458287/'+rawForm4DocumentName('xslF345X06/ownership.xml')),'https://www.sec.gov/Archives/edgar/data/926282/000119312526458287/ownership.xml');
 assert.equal(rawForm4DocumentName('../../secrets'),null);
 assert.throws(()=>secSourceUrl('https://attacker.invalid/'),/SEC_INVALID_SOURCE_PATH/);
});
test('CIK from primary SEC filing source must be verified against submissions ticker',()=>{
 assert.equal(cikFromVerifiedSecUrl('https://www.sec.gov/Archives/edgar/data/1588978/000158897826000009/prct-20251231.htm'),'0001588978');
 assert.equal(cikFromVerifiedSecUrl('https://www.sec.gov/Archives/edgar/data/1832483/000183248326000051/serv-20260930.htm'),'0001832483');
 assert.equal(cikFromVerifiedSecUrl('https://evil.invalid/Archives/edgar/data/1832483/000183248326000051/x.xml'),null);
 assert.equal(cikFromVerifiedSecUrl('https://ir.candeltx.com/resources/investor-faqs/'),null);
 assert.equal(secIssuerIdentityMatches({cik:1588978,tickers:['PRCT']},'PRCT','0001588978'),true);
 assert.equal(secIssuerIdentityMatches({cik:1440660,tickers:['PRCT']},'PRCT','0001588978'),false);
 assert.equal(secIssuerIdentityMatches({cik:1588978,tickers:['OTHER']},'PRCT','0001588978'),false);
 assert.equal(secIssuerIdentityMatches({cik:1588978,tickers:[]},'PRCT','0001588978'),false);
});
test('Form 4 reported issuer must match the target ticker and corporate CIK',()=>{
 const xml='<ownershipDocument><issuer><issuerCik>1588978</issuerCik><issuerTradingSymbol>PRCT</issuerTradingSymbol></issuer></ownershipDocument>';
 assert.equal(form4IssuerMatches(xml,'PRCT','0001588978'),true);
 assert.equal(form4IssuerMatches(xml,'OTHER','0001588978'),false);
 assert.equal(form4IssuerMatches(xml,'PRCT','0001440660'),false);
 assert.equal(form4IssuerMatches('<html>error</html>','PRCT','0001588978'),false);
});
test('bio risk column has explicit wrapping and bounded width',()=>{
 const html=readFileSync(new URL('../web.html',import.meta.url),'utf8');
 assert.match(html,/#bio-table td:nth-child\(8\) \.risk\{[^}]*white-space:normal;overflow-wrap:anywhere;word-break:break-word/);
 assert.match(html,/#bio-table th:nth-child\(8\),#bio-table td:nth-child\(8\)\{width:245px;min-width:245px;max-width:245px;white-space:normal\}/);
});
test('SEC source records are checked before CIK is persisted, and NONE is not claimed as a confirmed absence',()=>{
 const code=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 const secIdentity=code.indexOf('if(!secIssuerIdentityMatches(sub,c.ticker,cik))');
 const cikUpdate=code.indexOf('UPDATE companies SET cik=?');
 assert.ok(secIdentity>0&&cikUpdate>secIdentity);
 assert.match(code,/sec_form4_count/);
 assert.match(code,/FORM4_NO_P/);
 assert.match(code,/NOT_COLLECTED/);
 assert.match(code,/perCompanyErrors>=2/);
});
test('Form 4 accession is globally deduplicated even when owner and issuer CIK differ',()=>{
 const code=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 const migration=readFileSync(new URL('../migrations/0008_sec_accession_uniqueness.sql',import.meta.url),'utf8');
 assert.match(code,/SELECT id,company_ticker FROM filings WHERE accession_number=\? LIMIT 1/);
 assert.match(code,/SEC_ACCESSION_ISSUER_CONFLICT/);
 assert.match(code,/SELECT id FROM filings WHERE company_ticker=\? AND accession_number=\? LIMIT 1/);
 assert.match(migration,/CREATE UNIQUE INDEX IF NOT EXISTS idx_filings_accession_unique ON filings\(accession_number\)/);
 assert.doesNotMatch(migration,/^\s*DELETE\s+FROM\s+filings/im);
});
test('SEC error page cannot become a signal',()=>{
 assert.deepEqual(parseForm4('HTTP 403'),{status:'UNSUPPORTED_XML',transactions:[]});
});
test('rubric version and sum visible',async()=>{
 const r=await worker.fetch(new Request('https://iir.example/api/meta/rubric'),{});
 assert.equal(r.status,200);
 const j=await r.json();
 assert.equal(j.version,'v0.2.0');
 assert.equal(Object.values(j.weights).reduce((a,b)=>a+b,0),100);
});
test('unauthenticated write is rejected before D1 access',async()=>{
 const r=await worker.fetch(new Request('https://iir.example/api/admin/refresh',{method:'POST'}),{});
 assert.equal(r.status,403);
});
test('initial page says historical, not current quote',async()=>{
 const r=await worker.fetch(new Request('https://iir.example/'),{});
 assert.equal(r.status,200);
 const t=await r.text();
 assert.match(t,/2026-11-09/);
 assert.match(t,/과거 조사/);
 assert.match(t,/api\/candidates/);
});

test('dashboard inline JavaScript is syntactically valid and unique', () => {
 const html=readFileSync(new URL('../web.html',import.meta.url),'utf8');
 const scripts=Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi));
 assert.equal(scripts.length,1,'unexpected duplicated scripts');
 assert.doesNotThrow(()=>new Function(scripts[0][1]));
 assert.equal((html.match(/async function load\(\)/g)||[]).length,1,'duplicate load handlers');
 assert.match(scripts[0][1],/fetchBounded/);
});

test('company detail occupies the viewport and retains responsive close behavior', () => {
 const html=readFileSync(new URL('../web.html',import.meta.url),'utf8');
 assert.match(html,/\.detail\{width:100%;max-width:none;height:100vh;height:100dvh/);
 assert.match(html,/#detail-body\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(html,/@media\(max-width:950px\)\{[\s\S]*?#detail-body\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(html,/document\.body\.classList\.add\('detail-open'\)/);
 assert.match(html,/document\.body\.classList\.remove\('detail-open'\)/);
 assert.match(html,/lastDetailFocus/);
 assert.match(html,/id="close"[^>]*>목록으로 돌아가기/);
});

test('insider buy price is share-weighted and separate from fixed close in candidate API', async () => {
 const queries=[];
 const db={
  prepare(sql){
   queries.push(sql);
   return {bind(){
    return {
     first:async()=>({n:1}),
     all:async()=>({results:[{
      ticker:'TST',name:'Fixture',industry:'Test',theme:'Test theme',
      seed_price_usd:9.54,seed_price_asof:'2026-11-09',
      insider_avg_buy_price_usd:8.625,buy_trade_rows:2,
      min_buy_price_usd:8.5,max_buy_price_usd:9.0,
      secondary_trade_rows:0,theme_score:null
     }]})
    };
   }};
  }
 };
 const response=await worker.fetch(new Request('https://iir.example/api/candidates?limit=5'),{DB:db});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.total,1);
 assert.equal(body.items[0].seed_price_usd,9.54);
 assert.equal(body.items[0].seed_price_asof,'2026-11-09');
 assert.equal(body.items[0].insider_avg_buy_price_usd,8.625);
 assert.equal(body.items[0].buy_trade_rows,2);
 assert.equal(body.items[0].confirmed_score,null);
 assert.match(queries[1],/SUM\(t\.shares\*t\.price_usd\)/);
 assert.match(queries[1],/ROUND\(bt\.buy_cost\/bt\.buy_shares,6\)/);
 assert.match(queries[1],/t\.code='P' AND t\.shares>0 AND t\.price_usd>0/);
 assert.match(queries[1],/market_snapshots ms/);
});

test('latest daily close in main table and distinct historical seed in detail', () => {
 const html=readFileSync(new URL('../web.html',import.meta.url),'utf8');
 assert.match(html,/<th[^>]*>최근 종가/);
 assert.match(html,/<th[^>]*>내부자 매수단가/);
 assert.match(html,/latestCloseMarkup\(c\)/);
 assert.match(html,/2026-11-09 과거 조사 종가/);
 assert.match(html,/마지막 완료 거래일/);
 assert.ok((html.match(/colspan="11"/g)||[]).length>=2);
 assert.doesNotMatch(html,/<th[^>]*>11\/9 종가/);
});
test('parse latest Yahoo close rejects active-session bar before regular close',()=>{
 const stamps=['2026-11-11T14:30:00Z','2026-11-12T14:30:00Z'].map(x=>Date.parse(x)/1000);
 const data={chart:{result:[{meta:{symbol:'SOPH',currency:'USD',instrumentType:'EQUITY'},timestamp:stamps,indicators:{quote:[{close:[7.465,7.99]}]}}]}};
 assert.deepEqual(parseLatestYahooClose(data,'SOPH',new Date('2026-11-12T15:00:00Z')),{date:'2026-11-11',close:7.465});
 assert.deepEqual(parseLatestYahooClose(data,'SOPH',new Date('2026-11-12T22:00:00Z')),{date:'2026-11-12',close:7.99});
});
test('reject provider symbol mismatch and invalid daily close',()=>{
 const data={chart:{result:[{meta:{symbol:'IMSR',currency:'USD',instrumentType:'EQUITY'},timestamp:[Date.parse('2026-11-11T14:30:00Z')/1000],indicators:{quote:[{close:[2.56]}]}}]}};
 assert.throws(()=>parseLatestYahooClose(data,'SOPH',new Date('2026-11-12T15:00:00Z')),/MISMATCH/);
 data.chart.result[0].indicators.quote[0].close=[null];
 assert.throws(()=>parseLatestYahooClose(data,'IMSR',new Date('2026-11-12T15:00:00Z')),/NO_COMPLETED_BAR/);
});
test('do not represent an old stale bar as current',()=>{
 const data={chart:{result:[{meta:{symbol:'ANIX',currency:'USD',instrumentType:'EQUITY'},timestamp:[Date.parse('2026-10-01T14:30:00Z')/1000],indicators:{quote:[{close:[2.5]}]}}]}};
 assert.throws(()=>parseLatestYahooClose(data,'ANIX',new Date('2026-11-12T15:00:00Z')),/STALE_BAR/);
});

test('latest close remains visible in narrow-screen comparison',()=>{
 const html=readFileSync(new URL('../web.html',import.meta.url),'utf8');
 assert.equal(html.includes('th:nth-child(8),td:nth-child(8){display:none}'),false);
 assert.equal(html.includes('th:nth-child(11),td:nth-child(11){display:none}'),true);
});

test('quarter is based on US/Eastern calendar, not Korea or UTC',()=>{
 assert.equal(quarterFor(new Date('2027-01-01T02:00:00Z')),'2026Q4');
 assert.equal(quarterFor(new Date('2027-01-01T06:00:00Z')),'2027Q1');
 assert.equal(quarterFor(new Date('2026-04-01T05:00:00Z')),'2026Q2');
 assert.equal(previousQuarter('2027Q1'),'2026Q4');
 assert.equal(previousQuarter('2026Q4'),'2026Q3');
 assert.throws(()=>previousQuarter('2026Q5'),/INVALID_QUARTER/);
});
test('invalid research quarter is rejected before database read',async()=>{
 const db={prepare(){throw new Error('DB_SHOULD_NOT_BE_QUERIED')}};
 const r=await worker.fetch(new Request('https://iir.example/api/candidates?quarter=2026Q4%27%20OR%201%3D1'),{DB:db});
 assert.equal(r.status,400);
 const r2=await worker.fetch(new Request('https://iir.example/api/quarter?quarter=oops'),{DB:db});
 assert.equal(r2.status,400);
});
test('quarter API returns counts and explicit no-hold rollover rule',async()=>{
 const db={prepare(sql){
  const statement={first:async()=>({quarter_id:'2026Q4',start_date:'2026-10-01',end_date:'2026-12-31'}),all:async()=>({results: sql.includes('GROUP BY')?[{track:'BIO',origin:'LEGACY_SEED',review_status:'RESEARCHING',n:2}]:[{quarter_id:'2026Q4'}]})};
  return {...statement,bind(){return statement}};
 }};
 const r=await worker.fetch(new Request('https://iir.example/api/quarter?quarter=2026Q4'),{DB:db});
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.view_quarter,'2026Q4');
 assert.equal(data.separate_hold_list,false);
 assert.equal(data.totals[0].n,2);
 assert.equal(data.discovery_automation,'NOT_CONFIGURED');
});
test('bio and tech tabs each have one table and topic-specific controls',()=>{
 const html=readFileSync(new URL('../web.html',import.meta.url),'utf8');
 assert.equal((html.match(/id="radar-nav"/g)||[]).length,1);
 assert.equal((html.match(/id="tech-table"/g)||[]).length,1);
 assert.equal((html.match(/id="bio-table"/g)||[]).length,1);
 assert.equal((html.match(/id="bio-rows"/g)||[]).length,1);
 for(const name of ['DEMENTIA','AGING','CANCER','ALOPECIA','APPLIED_AI']){
  assert.match(html,new RegExp('data-topic="'+name+'"'));
 }
 assert.equal((html.match(/function renderBio\(\)/g)||[]).length,1);
 assert.equal((html.match(/function applyView\(/g)||[]).length,1);
 assert.match(html,/wireGridRows\(el\('bio-rows'\)\)/);
 assert.match(html,/quarter_only=1/);
 assert.match(html,/임상\/연구 단계 원문 검증 전/);
});
test('quarter rollover only carries non-excluded companies in bounded batches',()=>{
 const code=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 assert.match(code,/old\.review_status IN \('RESEARCHING','CARRY_FORWARD'\)/);
 assert.match(code,/LIMIT \?\"\)\.bind\(id,prev,id,MAX_QUARTER_CARRY\)/);
 assert.match(code,/NOT EXISTS\(SELECT 1 FROM research_quarter_entries newer/);
 assert.doesNotMatch(code,/old\.review_status IN \([^)]*'EXCLUDED'/);
});

test('2026Q4 intake adds exactly 2 tech + 8 bio research candidates without price or insider fabrication',()=>{
 const sql=readFileSync(new URL('../migrations/0005_q4_candidate_intake.sql',import.meta.url),'utf8');
 assert.equal((sql.match(/INSERT OR IGNORE INTO companies\(/g)||[]).length,10);
 assert.equal((sql.match(/'NEW','RESEARCHING'/g)||[]).length,10);
 assert.equal((sql.match(/INSERT OR IGNORE INTO bio_profiles\(/g)||[]).length,8);
 assert.equal((sql.match(/INSERT OR IGNORE INTO bio_assets\(/g)||[]).length,8);
 assert.equal((sql.match(/'NONE',NULL,NULL,NULL,NULL,NULL,NULL,0,'WATCH'/g)||[]).length,10);
 for(const code of ['SERV','AUR','VYGR','ACIU','BIOA','MANE','CGON','RXRX','AURA','CADL'])
  assert.match(sql,new RegExp("VALUES\\('"+code+"',"));
});
test('biotech view uses burgundy theme and keeps existing dark tech mode',()=>{
 const html=readFileSync(new URL('../web.html',import.meta.url),'utf8');
 assert.match(html,/body\[data-radar-view="bio"\]\{background:#170d14/);
 assert.match(html,/document\.body\.dataset\.radarView=next/);
 assert.match(html,/next==='bio'\?'#170d14':'#101723'/);
 assert.match(html,/class="list-num"/);
 assert.match(html,/function renderSourceEvidence\(d\)/);
 assert.match(html,/function safeSourceUrl\(raw\)/);
 assert.match(html,/bio_lead_phase/);
 assert.match(html,/종가 수집 대기/);
 assert.match(html,/var candidate=data\.find\(function\(c\)\{return c\.ticker===t\}\)/);
 assert.match(html,/\['NASDAQ','NYSE'\]\.includes\(exchange\)/);
 assert.match(html,/exchange\+':'\+t/);
 assert.doesNotMatch(html,/var map=\{ADTN:/);
});
test('candidate API exposes primary evidence and biotech phase separately from insider signal',()=>{
 const code=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 assert.match(code,/AS bio_lead_asset/);
 assert.match(code,/AS bio_lead_phase/);
 assert.match(code,/evidence:proofs\.results\|\|\[\]/);
 assert.match(code,/WHERE company_ticker=\? ORDER BY event_date DESC LIMIT 15/);
});

test('strict 2026 US-only replacement retains history and counts 10+10',()=>{
 const sql=readFileSync(new URL('../migrations/0006_us_company_only.sql',import.meta.url),'utf8');
 const foreign=['APTV','GFS','SOPH','ACIU'];
 const incoming=['OUST','TMDX','ANVS','FATE'];
 assert.equal((sql.match(/INSERT OR IGNORE INTO companies\(/g)||[]).length,4);
 assert.equal((sql.match(/INSERT OR IGNORE INTO research_quarter_entries\(/g)||[]).length,4);
 assert.equal((sql.match(/INSERT OR IGNORE INTO bio_assets\(/g)||[]).length,2);
 assert.equal((sql.match(/INSERT OR IGNORE INTO company_listing_verification\(/g)||[]).length,24);
 assert.equal((sql.match(/'US_CONFIRMED'/g)||[]).length>=20,true);
 assert.equal((sql.match(/UPDATE companies SET eligible_status='FOREIGN_ISSUER_EXCLUDED'/g)||[]).length,4);
 assert.equal((sql.match(/UPDATE research_quarter_entries SET review_status='EXCLUDED'/g)||[]).length,4);
 for(const ticker of foreign)assert.match(sql,new RegExp("WHERE ticker='"+ticker+"'"));
 for(const ticker of incoming)assert.match(sql,new RegExp("VALUES\\('"+ticker+"'"));
 assert.doesNotMatch(sql,/DELETE FROM companies|DROP TABLE/i);
 assert.match(sql,/CHECK\(\(eligibility_status='US_CONFIRMED' AND incorporation_country='US'/);
});
test('all public candidate pathways require verified US ownership and location',()=>{
 const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 assert.match(source,/const where=baseWhere\+" AND lv\.eligibility_status='US_CONFIRMED'/);
 assert.match(source,/JOIN company_listing_verification lv ON lv\.company_ticker=c\.ticker/g);
 assert.match(source,/headquarters_country='US'/);
 assert.match(source,/runMarketRefresh/);
 assert.match(source,/runRefresh/);
 assert.match(source,/candidateDetail/);
 assert.match(source,/getQuarterState/);
 assert.match(source,/listSignals/);
});
test('geo-only exclusion does not falsely delete original prices or filings',()=>{
 const sql=readFileSync(new URL('../migrations/0006_us_company_only.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/^\s*DELETE\b/im);
 assert.doesNotMatch(sql,/\bDROP TABLE\b/i);
 assert.match(sql,/FOREIGN_ISSUER_EXCLUDED/);
 assert.match(sql,/decision_source_url/);
});
test('US-only filter label and revised chart symbols appear in both views',()=>{
 const html=readFileSync(new URL('../web.html',import.meta.url),'utf8');
 assert.match(html,/미국 법인 · 미국 본사 · NYSE\/Nasdaq 보통주만 표시/);
 assert.match(html,/한국 증권사별 실제 주문 가능 여부는 계좌에서 확인/);
 assert.match(html,/var exchange=candidate&&candidate\.primary_exchange/);
 assert.match(html,/\['NASDAQ','NYSE'\]\.includes\(exchange\)/);
 assert.match(html,/공식 등록 확인/);
});

test('2026Q4 extra candidates are added without placeholder prices, fake SEC trades or old-row deletion',()=>{
 const sql=readFileSync(new URL('../migrations/0009_q4_five_additional.sql',import.meta.url),'utf8');
 for(const ticker of ['ABSI','CGEM','SLDP','BFLY','ENVX']){
  assert.match(sql,new RegExp("VALUES\\('"+ticker+"'"));
 }
 assert.equal(sql.split('INSERT OR IGNORE INTO companies(').length-1,5);
 assert.equal(sql.split('INSERT OR IGNORE INTO research_quarter_entries(').length-1,5);
 assert.equal((sql.match(/'NEW','RESEARCHING'/g)||[]).length,5);
 assert.match(sql,/NCT07317544/);
 assert.match(sql,/NCT05143996/);
 assert.doesNotMatch(sql,/DELETE FROM|DROP TABLE|UPDATE companies SET seed_price_usd|INSERT INTO insider_transactions/i);
});

test('per-company SEC scan state preserves last success and does not imply total lack of insider P',()=>{
 const schema=readFileSync(new URL('../migrations/0010_sec_scan_coverage.sql',import.meta.url),'utf8');
 const src=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 assert.match(schema,/CREATE TABLE IF NOT EXISTS company_sec_scan_state/);
 assert.match(src,/scan_window_days=180/);
 assert.match(src,/NEW_P_UNVERIFIED/);
 assert.match(src,/RECENT_FORM4_CONSIDERED/);
 assert.match(src,/NO_RECENT_FORM4_IN_FEED/);
 assert.match(src,/last_success_at_utc=excluded\.last_success_at_utc/);
 assert.match(src,/last_result='FAILED'/);
 assert.match(src,/bio_trials:bioTrials\.results\|\|\[\]/);
});

test('official ClinicalTrials study status parser validates NCT ID and preserves uncertainty',()=>{
 const study={protocolSection:{
  identificationModule:{nctId:'NCT07317544',briefTitle:'  ABS-201 Phase 1/2a  '},
  statusModule:{overallStatus:'RECRUITING',primaryCompletionDateStruct:{date:'2028-07'}},
  designModule:{phases:['PHASE1','PHASE2']}
 }};
 assert.deepEqual(parseRegisteredTrial(study,'NCT07317544'),{title:'ABS-201 Phase 1/2a',status:'RECRUITING',phase:'PHASE1,PHASE2',primaryCompletion:'2028-07'});
 assert.throws(()=>parseRegisteredTrial(study,'NCT05143996'),/NCT_ID_MISMATCH/);
 assert.throws(()=>parseRegisteredTrial({},'NCT07317544'),/NCT_ID_MISMATCH/);
 assert.throws(()=>parseRegisteredTrial(study,'bad-id'),/INVALID_NCT_ID/);
 assert.throws(()=>parseRegisteredTrial({...study,protocolSection:{...study.protocolSection,statusModule:{overallStatus:'<script>'}}},'NCT07317544'),/NCT_INVALID_STATUS/);
});
test('ClinicalTrials polling uses bounded official API, checkpoint, and separate pipeline state',()=>{
 const schema=readFileSync(new URL('../migrations/0011_clinical_trial_refresh.sql',import.meta.url),'utf8');
 const code=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../web.html',import.meta.url),'utf8');
 assert.match(schema,/INSERT OR IGNORE INTO pipeline_state/);
 assert.match(code,/const TRIAL_BATCH = 3/);
 assert.match(code,/const TRIAL_REQUEST_MS = 6500/);
 assert.match(code,/clinicaltrials\.gov\/api\/v2\/studies/);
 assert.match(code,/runTrialRefresh\(env,'CRON'\)/);
 assert.match(code,/TRIAL_JOB,id\)\.run\(\)/);
 assert.match(html,/공식 등록상태/);
 assert.match(html,/임상 등록정보/);
});

test('calendar eligibility does not promote phase I-only or unverified pipelines',()=>{
 assert.equal(calendarPhaseGroup('초기 임상(MAD)'),null);
 assert.equal(calendarPhaseGroup('항암 초기 임상 1상(회사 발표 기준)'),null);
 assert.equal(calendarPhaseGroup('Phase 1/2a (기업 발표)'),'MIXED_1_2');
 assert.equal(calendarPhaseGroup('임상 1/2상'),'MIXED_1_2');
 assert.equal(calendarPhaseGroup('임상 2상 (QUELL-CV / QUELL-DME)'),'PHASE2');
 assert.equal(calendarPhaseGroup('CoMpass 임상 3상'),'PHASE3');
 assert.equal(calendarPhaseGroup('남성 임상 3상 / 여성 임상 2·3상'),'PHASE3');
 assert.equal(calendarPhaseGroup(null),null);
});
test('calendar shows distinct company date ranges and registered primary completion, not false exact readout',async()=>{
 const rows={assets:[
  {asset_id:1,ticker:'BIOA',company_name:'BioAge Labs',asset_name:'BGE-102',phase_label:'임상 2상',phase_verified:1,source_url:'https://example.com/ir',checked_at_utc:'2026-11-13',indication:'염증',risk_note:'현금소진'},
  {asset_id:2,ticker:'FATE',company_name:'Fate',asset_name:'FT836',phase_label:'임상 1상',phase_verified:1,source_url:'https://example.com/ir'}
 ],milestones:[
  {event_id:5,asset_id:1,ticker:'BIOA',company_name:'BioAge Labs',asset_name:'BGE-102',phase_label:'임상 2상',description:'QUELL-CV 결과 Q4 2026',event_kind:'COMPANY_GUIDANCE',target_start:'2026-10-01',target_end:'2026-12-31',date_confidence:'COMPANY_GUIDANCE',source_url:'https://example.com/ir',indication:'염증',risk_note:'현금소진'},
  {event_id:6,asset_id:2,ticker:'FATE',company_name:'Fate',asset_name:'FT836',phase_label:'임상 1상',description:'예상 데이터',target_start:'2026-12-01',date_confidence:'MONTH_ESTIMATE'}
 ],trials:[
  {asset_id:1,ticker:'BIOA',company_name:'BioAge Labs',asset_name:'BGE-102',phase_label:'임상 2상',nct_id:'NCT12345678',public_title:'BGE-102 study',phase:'PHASE2',status:'RECRUITING',primary_completion_date:'2027-04',last_checked_at_utc:'2026-11-19T00:00:00Z',source_url:'https://clinicaltrials.gov/study/NCT12345678',indication:'염증'}
 ]};
 const env={DB:{prepare(sql){const name=sql.includes('FROM bio_milestones m JOIN')?'milestones':sql.includes('FROM bio_asset_trials bat JOIN')?'trials':'assets';return {all:async()=>({results:rows[name]})};}}};
 const res=await worker.fetch(new Request('https://iir.example/api/clinical-calendar'),env);
 assert.equal(res.status,200);
 const body=await res.json();
 assert.equal(body.events.length,2);
 assert.equal(body.undated.length,0);
 assert.equal(body.events[0].date_precision,'WINDOW_ESTIMATE');
 assert.equal(body.events[0].end_date,'2026-12-31');
 assert.equal(body.events[0].event_type,'CLINICAL_UPDATE');
 assert.equal(body.events[1].event_type,'PRIMARY_COMPLETION');
 assert.equal(body.events[1].date_precision,'REGISTRY_MONTH');
 assert.equal(body.events[1].end_date,'2027-04-30');
 assert.equal(body.meta.scope,'TRACKED_US_BIOPHARMA_ONLY');
 assert.equal(body.meta.checked_studies,1);
 assert.ok(body.events.every(x=>x.ticker!=='FATE'));
});
test('clinical calendar web route responds with filter controls and no fabricated market-wide coverage',async()=>{
 const res=await worker.fetch(new Request('https://iir.example/calendar'));
 assert.equal(res.status,200);
 const content=await res.text();
 assert.match(content,/임상 2상 이상/);
 assert.match(content,/\/api\/clinical-calendar/);
 assert.match(content,/1\/2상/);
 assert.match(content,/현재 IIR에 등록된 미국 바이오 후보/);
 assert.match(content,/임상 주요 평가 완료일은 결과 발표일이 아닙니다/);
});

test('calendar inline JavaScript is syntactically valid and bounded request is present',()=>{
 const html=readFileSync(new URL('../calendar.html',import.meta.url),'utf8');
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);
 assert.doesNotThrow(()=>new Function(scripts[0][1]));
 assert.match(html,/AbortController/);
 assert.match(html,/clearTimeout\(timeout\)/);
 assert.match(html,/Primary Completion Date/);
 assert.match(html,/DATE_CONFIRMED|DAY_CONFIRMED/);
});
