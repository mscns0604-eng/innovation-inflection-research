import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker, {scoreRange,parseForm4,parseLatestYahooClose,quarterFor,previousQuarter} from '../dist/worker.mjs';

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
