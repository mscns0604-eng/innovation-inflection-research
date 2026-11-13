/**
 * IIR Cloudflare Worker - v0.1
 * Build: node scripts/build.mjs (injects web.html in __IIR_HTML__)
 * Public read-only API; admin mutations disabled until a server-side token is set.
 */
const PAGE = __IIR_HTML__;
const RUBRIC_VERSION = 'v0.2.0';
const WEIGHTS = Object.freeze({insider:25,theme:20,technology:20,external_validation:10,financial:10,price:10,macro:5});
const JOB = 'sec_form4';
const MARKET_JOB = 'market_close';
const MARKET_SOURCE = 'YAHOO_CHART_V8';
const MARKET_BATCH = 10;
const MARKET_RUN_MS = 49000;
const MARKET_REQUEST_MS = 5200;
const MAX_QUARTER_CARRY = 40;
const MAX_COMPANIES = 5;
const MAX_FILINGS = 8;
const MAX_REQUESTS = 18;
const MAX_RUN_MS = 39000;
const SEC_TIMEOUT_MS = 4800;
const SOURCE_ROOT = 'https://www.sec.gov';
const ALLOW_SORT = {priority:"COALESCE(s.review_rank,101) ASC, CASE COALESCE(s.research_status,c.research_status) WHEN 'RESEARCH_PRIORITY' THEN 0 WHEN 'CONDITIONAL' THEN 1 WHEN 'WATCH' THEN 2 ELSE 3 END, c.trade_last_date DESC",ticker:"c.ticker ASC",amount:"c.buy_amount_usd DESC",recent:"c.trade_last_date DESC"};
const JSON_HEADERS = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'};
const iso = () => new Date().toISOString();
function json(data,code=200){return new Response(JSON.stringify(data),{status:code,headers:JSON_HEADERS})}
export function scoreRange(row){
 let confirmed=0,knownMax=0;
 for(const [key,max] of Object.entries(WEIGHTS)){
  const value=row[key];
  if(value===null||value===undefined)continue;
  if(!Number.isInteger(value)||value<0||value>max)throw new Error('INVALID_SCORE_'+key);
  confirmed+=value;knownMax+=max;
 }
 return {confirmed_score:knownMax?confirmed:null,possible_score:knownMax?confirmed+(100-knownMax):null,coverage_pct:knownMax};
}
function displayRow(r){
 const range=scoreRange({...r,theme:r.theme_score});
 return {...r,...range,score_version:RUBRIC_VERSION};
}
function validTicker(s){return typeof s==='string'&&/^[A-Z][A-Z0-9.-]{0,9}$/.test(s)}
export function quarterFor(at=new Date()){
 if(!(at instanceof Date)||!Number.isFinite(at.getTime()))throw Error('INVALID_QUARTER_TIME');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit'}).formatToParts(at).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return parts.year+'Q'+(Math.floor((Number(parts.month)-1)/3)+1);
}
export function previousQuarter(id){
 if(!/^20\d{2}Q[1-4]$/.test(id))throw Error('INVALID_QUARTER');
 const y=Number(id.slice(0,4)),q=Number(id.slice(5));
 return q===1?(y-1)+'Q4':y+'Q'+(q-1);
}
function quarterDates(id){
 if(!/^20\d{2}Q[1-4]$/.test(id))throw Error('INVALID_QUARTER');
 const year=Number(id.slice(0,4)),q=Number(id.slice(5));
 const start=new Date(Date.UTC(year,(q-1)*3,1)).toISOString().slice(0,10);
 const end=new Date(Date.UTC(year,q*3,0)).toISOString().slice(0,10);
 return {start,end};
}
async function ensureQuarter(db,source){
 const id=quarterFor(),prev=previousQuarter(id),dates=quarterDates(id);
 await db.prepare("INSERT OR IGNORE INTO research_quarters(quarter_id,start_date,end_date) VALUES(?,?,?)").bind(id,dates.start,dates.end).run();
 // Unreviewed and explicitly continued candidates roll into the next quarter; EXCLUDED never does.
 // Idempotent, bounded to 40 new records per invocation; subsequent Cron cycles resume.
 const result=await db.prepare("INSERT OR IGNORE INTO research_quarter_entries(quarter_id,company_ticker,track,origin,review_status,carried_from_quarter,next_check_date,next_check_trigger) SELECT ?,old.company_ticker,old.track,'CARRYOVER','RESEARCHING',old.quarter_id,old.next_check_date,old.next_check_trigger FROM research_quarter_entries old JOIN companies c ON c.ticker=old.company_ticker JOIN company_listing_verification lv ON lv.company_ticker=c.ticker AND lv.eligibility_status='US_CONFIRMED' AND lv.incorporation_country='US' AND lv.headquarters_country='US' WHERE old.quarter_id=? AND old.review_status IN ('RESEARCHING','CARRY_FORWARD') AND c.eligible_status IN ('ELIGIBLE','CONDITIONAL') AND NOT EXISTS(SELECT 1 FROM research_quarter_entries newer WHERE newer.quarter_id=? AND newer.company_ticker=old.company_ticker) ORDER BY old.company_ticker LIMIT ?").bind(id,prev,id,MAX_QUARTER_CARRY).run();
 if(result.meta?.changes)console.log(JSON.stringify({job:'quarter_rollover',quarter:id,previous:prev,carried:result.meta.changes,source}));
 return {quarter_id:id,carried:result.meta?.changes||0};
}
async function getQuarterState(db,url){
 const current=quarterFor(),id=url.searchParams.get('quarter')||current;
 if(!/^20\d{2}Q[1-4]$/.test(id))return json({error:'INVALID_QUARTER'},400);
 const [q,counts,available]=await Promise.all([
  db.prepare('SELECT * FROM research_quarters WHERE quarter_id=?').bind(id).first(),
  db.prepare("SELECT q.track,q.origin,q.review_status,COUNT(*) AS n FROM research_quarter_entries q JOIN companies c ON c.ticker=q.company_ticker JOIN company_listing_verification lv ON lv.company_ticker=c.ticker AND lv.eligibility_status='US_CONFIRMED' WHERE q.quarter_id=? AND q.review_status<>'EXCLUDED' AND c.eligible_status IN ('ELIGIBLE','CONDITIONAL') GROUP BY q.track,q.origin,q.review_status").bind(id).all(),
  db.prepare('SELECT quarter_id FROM research_quarters ORDER BY quarter_id DESC LIMIT 12').all()
 ]);
 return json({current_quarter:current,view_quarter:id,quarter:q||null,totals:counts.results||[],available_quarters:(available.results||[]).map(x=>x.quarter_id),rollover_rule:'NON_EXCLUDED_CARRYOVER',separate_hold_list:false,discovery_automation:'NOT_CONFIGURED',last_checked_at_utc:iso()});
}
function corsSafe(request){return new URL(request.url).origin}
async function adminAllowed(request,env){
 if(!env.ADMIN_TOKEN||env.ADMIN_TOKEN.length<24)return false;
 const header=request.headers.get('authorization')||'';
 if(!header.startsWith('Bearer '))return false;
 const offered=header.slice(7);
 if(offered.length>512)return false;
 const sha=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const a=await sha(offered),b=await sha(env.ADMIN_TOKEN);
 let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 return diff===0;
}
async function listCandidates(db,url){
 const rawPage=Number(url.searchParams.get('page')||1),rawLimit=Number(url.searchParams.get('limit')||50);
 if(!Number.isSafeInteger(rawPage)||rawPage<1||rawPage>10000||!Number.isSafeInteger(rawLimit)||rawLimit<1||rawLimit>100)return json({error:'INVALID_PAGINATION'},400);
 const mode=url.searchParams.get('mode')||'ALL_ELIGIBLE';
 const quarter=url.searchParams.get('quarter')||quarterFor();
 const quarterOnly=url.searchParams.get('quarter_only')==='1';
 if(!/^20\d{2}Q[1-4]$/.test(quarter)||!['0','1',null].includes(url.searchParams.get('quarter_only')))return json({error:'INVALID_QUARTER'},400);
 if(!['ALL_ELIGIBLE','NON_BIO','QUALIFIED_BIO'].includes(mode))return json({error:'INVALID_MODE'},400);
 const sort=url.searchParams.get('sort')||'priority';
 if(!ALLOW_SORT[sort])return json({error:'INVALID_SORT'},400);
 const baseWhere=mode==='ALL_ELIGIBLE'?"c.eligible_status IN ('ELIGIBLE','CONDITIONAL')":"c.eligible_status IN ('ELIGIBLE','CONDITIONAL') AND c.bio_mode = ?";
 const where=baseWhere+" AND lv.eligibility_status='US_CONFIRMED' AND lv.incorporation_country='US' AND lv.headquarters_country='US' AND lv.primary_exchange IN ('NYSE','NASDAQ')"+(quarterOnly?" AND qe.quarter_id IS NOT NULL AND qe.review_status <> 'EXCLUDED'":"");
 const args=mode==='ALL_ELIGIBLE'?[]:[mode];
 const tradeAggregate=" LEFT JOIN (SELECT f.company_ticker AS ticker, SUM(t.shares) AS buy_shares, SUM(t.shares*t.price_usd) AS buy_cost, MIN(t.price_usd) AS min_buy_price_usd, MAX(t.price_usd) AS max_buy_price_usd, MIN(t.trade_date) AS first_buy_date, MAX(t.trade_date) AS last_buy_date, COUNT(*) AS buy_trade_rows, COUNT(DISTINCT COALESCE(NULLIF(t.reporting_owner_name,''),t.reporting_owner_key)) AS buy_named_owner_count, SUM(CASE WHEN t.verification_status='SECONDARY_P_UNVERIFIED' THEN 1 ELSE 0 END) AS secondary_trade_rows FROM insider_transactions t JOIN filings f ON f.id=t.filing_id WHERE t.code='P' AND t.shares>0 AND t.price_usd>0 GROUP BY f.company_ticker) bt ON bt.ticker=c.ticker";
 const marketJoin=" LEFT JOIN market_snapshots ms ON ms.rowid=(SELECT p.rowid FROM market_snapshots p WHERE p.company_ticker=c.ticker AND p.close_usd>0 ORDER BY p.price_date DESC,p.retrieved_at_utc DESC LIMIT 1)";
 const bioJoin=" LEFT JOIN bio_profiles bp ON bp.company_ticker=c.ticker LEFT JOIN (SELECT company_ticker,GROUP_CONCAT(topic_code,'|') AS bio_tags,MAX(CASE evidence_level WHEN 'PRIMARY_CONFIRMED' THEN 0 ELSE 1 END) AS unverified_topic FROM bio_company_topics GROUP BY company_ticker) btopic ON btopic.company_ticker=c.ticker";
 const quarterJoin=" LEFT JOIN research_quarter_entries qe ON qe.company_ticker=c.ticker AND qe.quarter_id='"+quarter+"'";
 const common=' FROM companies c INNER JOIN company_listing_verification lv ON lv.company_ticker=c.ticker LEFT JOIN score_snapshots s ON s.id=(SELECT s2.id FROM score_snapshots s2 WHERE s2.company_ticker=c.ticker ORDER BY s2.asof_utc DESC,s2.id DESC LIMIT 1)'+tradeAggregate+marketJoin+bioJoin+quarterJoin+' WHERE '+where;
 const count=await db.prepare('SELECT COUNT(*) n'+common).bind(...args).first();
 const fields='c.*,CASE WHEN bt.buy_shares>0 THEN ROUND(bt.buy_cost/bt.buy_shares,6) ELSE NULL END AS insider_avg_buy_price_usd,bt.min_buy_price_usd,bt.max_buy_price_usd,bt.first_buy_date,bt.last_buy_date,bt.buy_trade_rows,bt.buy_named_owner_count,bt.secondary_trade_rows,s.insider,s.theme AS theme_score,s.technology,s.external_validation,s.financial,s.price,s.macro,s.asof_utc AS score_asof_utc,s.review_rank,s.research_status AS reviewed_research_status,s.entry_risk_status,s.reason_summary AS current_reason_summary,(SELECT COUNT(*) FROM candidate_signals cs WHERE cs.company_ticker=c.ticker) AS live_p_count,(SELECT MAX(disclosed_at_utc) FROM candidate_signals cs WHERE cs.company_ticker=c.ticker) AS latest_sec_disclosure,ms.close_usd AS latest_close_usd,ms.price_date AS latest_close_date,ms.source_name AS latest_close_source,ms.retrieved_at_utc AS latest_close_retrieved_at,bp.classification_status AS bio_classification_status,bp.inclusion_basis AS bio_inclusion_basis,btopic.bio_tags,btopic.unverified_topic,(SELECT ba.asset_name FROM bio_assets ba WHERE ba.company_ticker=c.ticker ORDER BY ba.id LIMIT 1) AS bio_lead_asset,(SELECT ba.phase_label FROM bio_assets ba WHERE ba.company_ticker=c.ticker AND ba.phase_verified=1 ORDER BY ba.id LIMIT 1) AS bio_lead_phase,qe.quarter_id AS research_quarter,qe.origin AS quarter_origin,qe.review_status AS quarter_review_status,qe.carried_from_quarter,qe.next_check_date,qe.next_check_trigger,lv.primary_exchange AS primary_exchange,lv.incorporation_country AS incorporation_country,lv.headquarters_country AS headquarters_country,lv.verified_on AS listing_verified_on,lv.verification_source_url AS listing_source_url';
 // c.theme is a theme description; read the optional score as theme_score.
 const rows=await db.prepare('SELECT '+fields+common+' ORDER BY '+ALLOW_SORT[sort]+' LIMIT ? OFFSET ?').bind(...args,rawLimit,(rawPage-1)*rawLimit).all();
 return json({items:(rows.results||[]).map(displayRow),total:count?.n||0,page:rawPage,limit:rawLimit,quarter});
}
async function candidateDetail(db,ticker){
 if(!validTicker(ticker))return json({error:'INVALID_TICKER'},400);
 const c=await db.prepare("SELECT c.*,lv.primary_exchange AS primary_exchange,lv.verification_source_url AS listing_source_url,lv.verified_on AS listing_verified_on FROM companies c INNER JOIN company_listing_verification lv ON lv.company_ticker=c.ticker AND lv.eligibility_status='US_CONFIRMED' AND lv.incorporation_country='US' AND lv.headquarters_country='US' AND lv.primary_exchange IN ('NYSE','NASDAQ') WHERE c.ticker=? AND c.eligible_status IN ('ELIGIBLE','CONDITIONAL')").bind(ticker).first();
 if(!c)return json({error:'NOT_FOUND'},404);
 const [filings,scores,events,signals,trades,prices,assets,topics,quarterHistory,bioEvents,proofs]=await Promise.all([
  db.prepare('SELECT accession_number,filing_type,accepted_at_utc,source_url,parse_status FROM filings WHERE company_ticker=? ORDER BY accepted_at_utc DESC LIMIT 25').bind(ticker).all(),
  db.prepare('SELECT * FROM score_snapshots WHERE company_ticker=? ORDER BY asof_utc DESC LIMIT 15').bind(ticker).all(),
  db.prepare('SELECT * FROM catalysts WHERE company_ticker=? ORDER BY target_start LIMIT 20').bind(ticker).all(),
  db.prepare('SELECT signal_type,disclosed_at_utc,aggregate_buy_usd,status,source_url FROM candidate_signals WHERE company_ticker=? ORDER BY disclosed_at_utc DESC LIMIT 30').bind(ticker).all(),
  db.prepare('SELECT t.reporting_owner_name,t.trade_date,t.code,t.shares,t.price_usd,t.value_usd,t.direct_indirect,t.plan_10b5_1,t.purchase_kind,t.verification_status,f.source_url FROM insider_transactions t JOIN filings f ON f.id=t.filing_id WHERE f.company_ticker=? ORDER BY t.trade_date DESC,t.id DESC LIMIT 50').bind(ticker).all(),
  db.prepare('SELECT price_date,close_usd,adjustment_type,source_name,retrieved_at_utc FROM market_snapshots WHERE company_ticker=? ORDER BY price_date DESC LIMIT 15').bind(ticker).all(),
  db.prepare('SELECT id,asset_name,modality,asset_kind,phase_label,phase_verified,evidence_level,source_url,checked_at_utc FROM bio_assets WHERE company_ticker=? ORDER BY id LIMIT 30').bind(ticker).all(),
  db.prepare('SELECT topic_code,evidence_level,source_url,note FROM bio_company_topics WHERE company_ticker=? ORDER BY topic_code').bind(ticker).all(),
  db.prepare('SELECT quarter_id,track,origin,review_status,carried_from_quarter,next_check_date,next_check_trigger,decision_reason,last_reviewed_at_utc FROM research_quarter_entries WHERE company_ticker=? ORDER BY quarter_id DESC LIMIT 12').bind(ticker).all(),
  db.prepare('SELECT asset_id,event_kind,description,target_start,target_end,date_confidence,outcome,source_url FROM bio_milestones WHERE company_ticker=? ORDER BY target_start LIMIT 30').bind(ticker).all(),
  db.prepare('SELECT title,url,source_type,event_date,published_at_utc,claim_type FROM evidence WHERE company_ticker=? ORDER BY event_date DESC LIMIT 15').bind(ticker).all()
 ]);
 return json({company:c,filings:filings.results,scores:(scores.results||[]).map(s=>({...s,...scoreRange(s)})),catalysts:events.results,signals:signals.results,insider_trades:trades.results||[],market_prices:prices.results||[],bio_assets:assets.results||[],bio_topics:topics.results||[],bio_milestones:bioEvents.results||[],research_quarters:quarterHistory.results||[],evidence:proofs.results||[],rubric_version:RUBRIC_VERSION});
}
async function getStatus(db,env){
 const [s,m,summary]=await Promise.all([
  db.prepare('SELECT job_name,last_attempt_at_utc,last_success_at_utc,last_error,cursor,enabled,last_run_state,error_count FROM pipeline_state WHERE job_name=?').bind(JOB).first(),
  db.prepare('SELECT last_attempt_at_utc,last_success_at_utc,last_error,last_run_state,enabled FROM pipeline_state WHERE job_name=?').bind(MARKET_JOB).first(),
  db.prepare("SELECT COUNT(DISTINCT m.company_ticker) AS covered,MAX(m.price_date) AS latest_price_date FROM market_snapshots m INNER JOIN companies c ON c.ticker=m.company_ticker INNER JOIN company_listing_verification lv ON lv.company_ticker=c.ticker AND lv.eligibility_status='US_CONFIRMED' WHERE m.close_usd>0 AND c.eligible_status IN ('ELIGIBLE','CONDITIONAL')").first()
 ]);
 let state='NOT_CONFIGURED';
 if(!s?.enabled||env.AUTOMATION_ENABLED==='false')state='DISABLED';
 else if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.SEC_CONTACT_EMAIL||''))state='NOT_CONFIGURED';
 else state=s?.last_run_state||'NEVER_RUN';
 return json({version:'iir-mvp-0.1',rubric_version:RUBRIC_VERSION,seed_asof:'2026-11-09',historical_seed:true,
  sec:{state,last_attempt_at:s?.last_attempt_at_utc||null,last_success_at:s?.last_success_at_utc||null,
  last_error:s?.last_error||null,checkpoint:s?.cursor||0,auto_enabled:!!s?.enabled&&env.AUTOMATION_ENABLED!=='false'},
  market:{state:!m?.enabled||env.AUTOMATION_ENABLED==='false'?'DISABLED':(m?.last_run_state||'NEVER_RUN'),last_attempt_at:m?.last_attempt_at_utc||null,last_success_at:m?.last_success_at_utc||null,last_error:m?.last_error||null,covered:summary?.covered||0,latest_price_date:summary?.latest_price_date||null},technology:{state:'MANUAL_REVIEW'},server_time_utc:iso()});
}
async function listSignals(db,url){
 const since=url.searchParams.get('since')||'2026-01-01';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(since))return json({error:'INVALID_SINCE'},400);
 const r=await db.prepare("SELECT cs.* FROM candidate_signals cs JOIN companies c ON c.ticker=cs.company_ticker JOIN company_listing_verification lv ON lv.company_ticker=c.ticker AND lv.eligibility_status='US_CONFIRMED' WHERE substr(cs.disclosed_at_utc,1,10)>=? AND c.eligible_status IN ('ELIGIBLE','CONDITIONAL') ORDER BY cs.disclosed_at_utc DESC,cs.id DESC LIMIT 100").bind(since).all();
 return json({items:r.results||[],count:r.results?.length||0});
}
function xmlValue(block,tag){
 const match=block.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>[\\s\\S]*?<value(?:\\s[^>]*)?>([\\s\\S]*?)<\\/value>[\\s\\S]*?<\\/'+tag+'>','i'));
 if(match)return match[1].trim();
 const m=block.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([^<]*)<\\/'+tag+'>','i'));
 return m?m[1].trim():'';
}
export function parseForm4(xml){
 if(typeof xml!=='string'||xml.length>2_500_000||!/<ownershipDocument[\s>]/i.test(xml))return {status:'UNSUPPORTED_XML',transactions:[]};
 const owner=(xml.match(/<reportingOwner>[\s\S]*?<\/reportingOwner>/i)||[''])[0];
 const ownerCik=xmlValue(owner,'rptOwnerCik'),ownerName=xmlValue(owner,'rptOwnerName');
 const matches=xml.match(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/gi)||[];
 const transactions=[];
 for(let i=0;i<Math.min(matches.length,40);i++){
  const m=matches[i],code=xmlValue(m,'transactionCode'),direction=xmlValue(m,'transactionAcquiredDisposedCode');
  if(code!=='P'||direction!=='A')continue;
  const tradeDate=xmlValue(m,'transactionDate'),shares=Number(xmlValue(m,'transactionShares')),price=Number(xmlValue(m,'transactionPricePerShare'));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)||!Number.isFinite(shares)||shares<=0||!Number.isFinite(price)||price<0)continue;
  const directIndirect=xmlValue(m,'directOrIndirectOwnership');
  transactions.push({ownerCik,ownerName,tradeDate,shares,price,value:Number((shares*price).toFixed(2)),directIndirect,identity:String(i)+'|'+tradeDate+'|'+shares+'|'+price});
 }
 return {status:matches.length>40?'PARTIAL_UNVERIFIED':'UNVERIFIED',transactions};
}
async function secText(path,ctx){
 if(++ctx.requests>MAX_REQUESTS)throw Error('REQUEST_BUDGET_EXCEEDED');
 if(Date.now()>ctx.deadline)throw Error('TIME_BUDGET_EXCEEDED');
 const email=ctx.email;
 const target=SOURCE_ROOT+path,headers={'User-Agent':'IIR-Research/0.1 contact '+email,'Accept':'application/json, application/xml, text/xml, */*'};
 let attempts=0;
 while(attempts<2){
  attempts++;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),SEC_TIMEOUT_MS);
  try{
   const res=await fetch(target,{headers,signal:controller.signal,redirect:'manual'});
   if([401,403,429].includes(res.status))throw Error('SEC_HTTP_'+res.status+'_STOP');
   if(res.status>=500&&attempts<2){await new Promise(r=>setTimeout(r,300));continue}
   if(!res.ok)throw Error('SEC_HTTP_'+res.status);
   const len=Number(res.headers.get('content-length')||0);
   if(len>2_500_000)throw Error('SEC_RESPONSE_TOO_LARGE');
   const body=await res.text();
   if(body.length>2_500_000)throw Error('SEC_RESPONSE_TOO_LARGE');
   return body;
  }catch(e){if(attempts>=2||!/fetch failed|AbortError|SEC_HTTP_5\d\d/i.test(String(e)))throw e}
  finally{clearTimeout(timeout)}
 }
 throw Error('SEC_UNEXPECTED_RETRY');
}
async function checkEnabled(db){
 const s=await db.prepare('SELECT enabled FROM pipeline_state WHERE job_name=?').bind(JOB).first();
 if(!s?.enabled)throw Error('EMERGENCY_STOP');
}
async function processCompany(db,c,ctx,lookup){
 await checkEnabled(db);
 let cik=c.cik;
 if(!cik){
  const mapped=lookup?.get(c.ticker);
  if(!mapped)return {checked:0,changed:0};
  cik=String(mapped).padStart(10,'0');
  await db.prepare('UPDATE companies SET cik=? WHERE ticker=? AND cik IS NULL').bind(cik,c.ticker).run();
 }
 const sub=JSON.parse(await secText('/submissions/CIK'+cik+'.json',ctx));
 const filings=sub?.filings?.recent;
 if(!filings||!Array.isArray(filings.form))throw Error('INVALID_SEC_SUBMISSIONS');
 let checked=0,changed=0;
 for(let i=0;i<filings.form.length&&checked<2&&ctx.files<MAX_FILINGS;i++){
  if(!['4','4/A'].includes(filings.form[i]))continue;
  const accession=filings.accessionNumber?.[i],name=filings.primaryDocument?.[i],accepted=filings.acceptanceDateTime?.[i]||null,filingDate=filings.filingDate?.[i];
  if(!accession||!name||!/^[\w.-]{1,120}$/.test(name)||!/^\d{10}-\d{2}-\d{6}$/.test(accession))continue;
  if(filingDate&&filingDate<'2026-08-01')continue;
  checked++;ctx.files++;
  const exists=await db.prepare('SELECT id FROM filings WHERE cik=? AND accession_number=?').bind(cik,accession).first();
  if(exists)continue;
  const url='/Archives/edgar/data/'+Number(cik)+'/'+accession.replace(/-/g,'')+'/'+name;
  const body=await secText(url,ctx);
  const parsed=parseForm4(body);
  const sourceUrl=SOURCE_ROOT+url;
  await db.prepare('INSERT OR IGNORE INTO filings(cik,company_ticker,accession_number,filing_type,accepted_at_utc,published_at_utc,source_url,fetched_at_utc,parse_status) VALUES(?,?,?,?,?,?,?,?,?)')
   .bind(cik,c.ticker,accession,filings.form[i],accepted,accepted,sourceUrl,iso(),parsed.status).run();
  const file=await db.prepare('SELECT id FROM filings WHERE cik=? AND accession_number=?').bind(cik,accession).first();
  if(!file)throw Error('FILINGS_WRITE_MISSING');
  for(const t of parsed.transactions){
   await db.prepare('INSERT OR IGNORE INTO insider_transactions(filing_id,transaction_identity,reporting_owner_key,reporting_owner_name,trade_date,code,shares,price_usd,value_usd,direct_indirect,verification_status) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .bind(file.id,t.identity,t.ownerCik||t.ownerName,t.ownerName,t.tradeDate,'P',t.shares,t.price,t.value,t.directIndirect,'UNVERIFIED').run();
  }
  if(parsed.transactions.length){
   const signalKey=cik+':'+accession+':P';
   const total=parsed.transactions.reduce((s,t)=>s+t.value,0);
   await db.prepare('INSERT OR IGNORE INTO candidate_signals(company_ticker,signal_key,signal_type,disclosed_at_utc,actor_count_independent,aggregate_buy_usd,status,source_url) VALUES(?,?,?,?,?,?,?,?)')
    .bind(c.ticker,signalKey,'UNVERIFIED',accepted,null,Number(total.toFixed(2)),'UNVERIFIED',sourceUrl).run();
  }
  changed++;
 }
 return {checked,changed};
}
async function runRefresh(env,source){
 const db=env.DB;
 if(env.AUTOMATION_ENABLED==='false')return {state:'DISABLED'};
 const email=(env.SEC_CONTACT_EMAIL||'').trim();
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
  await db.prepare("UPDATE pipeline_state SET last_run_state='NOT_CONFIGURED',last_error='SEC_CONTACT_EMAIL secret not configured' WHERE job_name=?").bind(JOB).run();
  return {state:'NOT_CONFIGURED'};
 }
 const id=crypto.randomUUID(),now=iso(),lease=new Date(Date.now()+120_000).toISOString();
 const taken=await db.prepare("UPDATE pipeline_state SET lock_owner=?,lease_expires_at_utc=?,last_attempt_at_utc=?,last_run_state='RUNNING' WHERE job_name=? AND enabled=1 AND (lease_expires_at_utc IS NULL OR lease_expires_at_utc < ?)")
   .bind(id,lease,now,JOB,now).run();
 if(!taken.meta?.changes)return {state:'ALREADY_RUNNING_OR_STOPPED'};
 const ctx={requests:0,files:0,email,deadline:Date.now()+MAX_RUN_MS};
 let checked=0,changed=0,cursor=0,state='SUCCESS',err='';
 try{
  await db.prepare("INSERT INTO pipeline_runs(id,job_name,started_at_utc,state,version) VALUES(?,?,?,'RUNNING','1')").bind(id,JOB,now).run();
  const list=await db.prepare("SELECT c.ticker,c.cik FROM companies c JOIN company_listing_verification lv ON lv.company_ticker=c.ticker AND lv.eligibility_status='US_CONFIRMED' AND lv.incorporation_country='US' AND lv.headquarters_country='US' WHERE c.eligible_status IN ('ELIGIBLE','CONDITIONAL') ORDER BY c.ticker ASC LIMIT 100").all();
  const companies=list.results||[],count=companies.length;
  const st=await db.prepare('SELECT cursor FROM pipeline_state WHERE job_name=?').bind(JOB).first();
  cursor=st?.cursor||0;if(cursor>=count)cursor=0;
  if(count>0){
   let lookup=null;
   if(companies.slice(cursor,cursor+MAX_COMPANIES).some(c=>!c.cik)){
    const tickerJSON=JSON.parse(await secText('/files/company_tickers.json',ctx));
    lookup=new Map(Object.values(tickerJSON).map(x=>[String(x.ticker).toUpperCase(),x.cik_str]));
   }
   const end=Math.min(count,cursor+MAX_COMPANIES);
   for(let i=cursor;i<end;i++){
    if(ctx.files>=MAX_FILINGS||Date.now()>ctx.deadline)break;
    const r=await processCompany(db,companies[i],ctx,lookup);
    checked+=r.checked;changed+=r.changed;cursor=i+1;
    await db.prepare('UPDATE pipeline_state SET cursor=? WHERE job_name=? AND lock_owner=?').bind(cursor,JOB,id).run();
   }
   if(cursor>=count)cursor=0;
  }
 }catch(e){state='FAILED';err=String(e?.message||e).slice(0,170)}
 finally{
  try{
   await db.prepare('UPDATE pipeline_runs SET finished_at_utc=?,state=?,checked_count=?,changed_count=?,cursor=?,error_code=?,error_summary=? WHERE id=?')
    .bind(iso(),state,checked,changed,cursor,state==='FAILED'?'INGESTION_FAILED':null,err||null,id).run();
   await db.prepare("UPDATE pipeline_state SET lock_owner=NULL,lease_expires_at_utc=NULL,cursor=?,last_run_state=?,last_error=?,error_count=CASE WHEN ?='SUCCESS' THEN 0 ELSE error_count+1 END,last_success_at_utc=CASE WHEN ?='SUCCESS' THEN ? ELSE last_success_at_utc END WHERE job_name=? AND lock_owner=?")
    .bind(cursor,state,err||null,state,state,iso(),JOB,id).run();
  }catch(e){console.error(JSON.stringify({job:JOB,error:'PERSIST_FAILURE',message:String(e).slice(0,120)}))}
 }
 console.log(JSON.stringify({job:JOB,source,state,checked,changed,requests:ctx.requests,error:err}));
 return {state,checked,changed,requests:ctx.requests,error:err};
}

// Regular-session daily *close*, not last traded/pre-market/after-hours quote.
// Yahoo's public chart endpoint is undocumented; validation failures preserve existing D1 data.
export function parseLatestYahooClose(payload,ticker,now=new Date()){
 if(!validTicker(ticker)||!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('MARKET_INVALID_INPUT');
 const chart=payload?.chart?.result?.[0], meta=chart?.meta;
 if(!chart||String(meta?.symbol||'').toUpperCase()!==ticker||meta?.currency!=='USD'||meta?.instrumentType!=='EQUITY')throw Error('MARKET_TICKER_OR_CURRENCY_MISMATCH');
 const times=chart.timestamp,closes=chart.indicators?.quote?.[0]?.close;
 if(!Array.isArray(times)||!Array.isArray(closes)||times.length!==closes.length||times.length>40)throw Error('MARKET_INVALID_DAILY_BARS');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 const currentDate=parts.year+'-'+parts.month+'-'+parts.day,nyMinute=(Number(parts.hour)%24)*60+Number(parts.minute);
 let best=null;
 for(let i=0;i<times.length;i++){
  const stamp=times[i],close=closes[i];
  if(!Number.isFinite(stamp)||stamp*1000>now.getTime()+60000||typeof close!=='number'||!Number.isFinite(close)||close<=0||close>=1e7)continue;
  const date=new Date(stamp*1000).toISOString().slice(0,10);
  if(date>currentDate||(date===currentDate&&nyMinute<16*60+30))continue;
  if(!best||date>best.date)best={date,close:Number(close.toFixed(6))};
 }
 if(!best)throw Error('MARKET_NO_COMPLETED_BAR');
 if(now.getTime()-Date.parse(best.date+'T00:00:00Z')>14*86400000)throw Error('MARKET_STALE_BAR');
 return best;
}
async function fetchMarketClose(ticker,deadline){
 if(Date.now()>deadline)throw Error('MARKET_BUDGET_EXCEEDED');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),MARKET_REQUEST_MS);
 try{
  const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(ticker)+'?range=5d&interval=1d&includePrePost=false';
  const response=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'IIR-Research/0.2 EOD quote'},signal:controller.signal,redirect:'manual'});
  if(!response.ok)throw Error('YAHOO_HTTP_'+response.status);
  if(Number(response.headers.get('content-length')||0)>120000)throw Error('MARKET_RESPONSE_TOO_LARGE');
  const body=await response.text();
  if(body.length>120000)throw Error('MARKET_RESPONSE_TOO_LARGE');
  return parseLatestYahooClose(JSON.parse(body),ticker);
 }finally{clearTimeout(timer)}
}
async function runMarketRefresh(env,source){
 const db=env.DB;
 if(env.AUTOMATION_ENABLED==='false')return {state:'DISABLED'};
 const id=crypto.randomUUID(),now=iso(),lease=new Date(Date.now()+120000).toISOString();
 const locked=await db.prepare("UPDATE pipeline_state SET lock_owner=?,lease_expires_at_utc=?,last_attempt_at_utc=?,last_run_state='RUNNING' WHERE job_name=? AND enabled=1 AND (lease_expires_at_utc IS NULL OR lease_expires_at_utc<?)").bind(id,lease,now,MARKET_JOB,now).run();
 if(!locked.meta?.changes)return {state:'ALREADY_RUNNING_OR_STOPPED'};
 const deadline=Date.now()+MARKET_RUN_MS;
 let state='SUCCESS',ok=0,changed=0,failed=0,cursor=0,error='';
 try{
  await db.prepare("INSERT INTO pipeline_runs(id,job_name,started_at_utc,state,version) VALUES(?,?,?,'RUNNING','2')").bind(id,MARKET_JOB,now).run();
  const rs=await db.prepare("SELECT c.ticker FROM companies c JOIN company_listing_verification lv ON lv.company_ticker=c.ticker AND lv.eligibility_status='US_CONFIRMED' AND lv.incorporation_country='US' AND lv.headquarters_country='US' WHERE c.eligible_status IN ('ELIGIBLE','CONDITIONAL') ORDER BY c.ticker LIMIT 100").all();
  const companies=rs.results||[],n=companies.length;
  const st=await db.prepare('SELECT cursor FROM pipeline_state WHERE job_name=?').bind(MARKET_JOB).first();
  cursor=st?.cursor||0;if(cursor>=n)cursor=0;
  for(let i=cursor;i<Math.min(n,cursor+MARKET_BATCH);i++){
   if(Date.now()>deadline){state='PARTIAL';break}
   const ticker=companies[i].ticker;
   try{
    const price=await fetchMarketClose(ticker,deadline);
    const save=await db.prepare("INSERT INTO market_snapshots(company_ticker,price_date,close_usd,adjustment_type,source_name,retrieved_at_utc) VALUES(?,?,?,'RAW_REGULAR_CLOSE',?,?) ON CONFLICT(company_ticker,price_date,source_name) DO UPDATE SET close_usd=excluded.close_usd,retrieved_at_utc=excluded.retrieved_at_utc WHERE market_snapshots.close_usd!=excluded.close_usd")
      .bind(ticker,price.date,price.close,MARKET_SOURCE,iso()).run();
    changed+=save.meta?.changes||0;ok++;
   }catch(e){
    failed++;error=(ticker+': '+String(e?.message||e)).slice(0,180);
    if(/YAHOO_HTTP_(401|403|429)/.test(error)){state='PARTIAL';cursor=i+1;break}
   }
   cursor=i+1;
   await db.prepare('UPDATE pipeline_state SET cursor=? WHERE job_name=? AND lock_owner=?').bind(cursor,MARKET_JOB,id).run();
  }
  if(cursor>=n)cursor=0;
  if(n===0)state='EMPTY';
  else if(failed||state==='PARTIAL')state=ok?'PARTIAL':'FAILED';
 }catch(e){state='FAILED';error=String(e?.message||e).slice(0,180)}
 finally{
  try{
   await db.prepare('UPDATE pipeline_runs SET finished_at_utc=?,state=?,checked_count=?,changed_count=?,cursor=?,error_code=?,error_summary=? WHERE id=?').bind(iso(),state,ok+failed,changed,cursor,state==='FAILED'?'MARKET_REFRESH_FAILED':null,error||null,id).run();
   await db.prepare("UPDATE pipeline_state SET lock_owner=NULL,lease_expires_at_utc=NULL,cursor=?,last_run_state=?,last_error=?,error_count=CASE WHEN ?='SUCCESS' THEN 0 ELSE error_count+1 END,last_success_at_utc=CASE WHEN ?='SUCCESS' OR (?='PARTIAL' AND ?>0) THEN ? ELSE last_success_at_utc END WHERE job_name=? AND lock_owner=?").bind(cursor,state,error||null,state,state,state,ok,iso(),MARKET_JOB,id).run();
  }catch(e){console.error(JSON.stringify({job:MARKET_JOB,error:'PERSIST_FAILURE',detail:String(e).slice(0,160)}))}
 }
 console.log(JSON.stringify({job:MARKET_JOB,source,state,ok,changed,failed,error}));
 return {state,ok,changed,failed,error};
}

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  try{
   if(['/api/admin/refresh','/api/admin/stop','/api/admin/market-refresh','/api/admin/market-stop'].includes(url.pathname)){
    if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
    if(!await adminAllowed(request,env))return json({error:'ADMIN_AUTH_REQUIRED'},403);
    if(url.pathname.endsWith('/stop')){
     await env.DB.prepare('UPDATE pipeline_state SET enabled=0 WHERE job_name=?').bind(url.pathname.includes('market-')?MARKET_JOB:JOB).run();
     return json({ok:true,stopped:true});
    }
    return json(url.pathname.includes('market-')?await runMarketRefresh(env,'MANUAL'):await runRefresh(env,'MANUAL'));
   }
   if(request.method!=='GET')return json({error:'METHOD_NOT_ALLOWED'},405);
   if(url.pathname==='/api/status')return getStatus(env.DB,env);
   if(url.pathname==='/api/candidates')return listCandidates(env.DB,url);
   if(url.pathname==='/api/signals')return listSignals(env.DB,url);
   if(url.pathname==='/api/quarter')return getQuarterState(env.DB,url);
   if(url.pathname==='/api/meta/rubric')return json({version:RUBRIC_VERSION,weights:WEIGHTS,validated_predictive_model:false});
   const mt=url.pathname.match(/^\/api\/candidates\/([A-Za-z0-9.-]+)(\/history)?$/);
   if(mt){
    const ticker=mt[1].toUpperCase();
    if(mt[2]){
     const eligible=await env.DB.prepare("SELECT c.ticker FROM companies c JOIN company_listing_verification lv ON lv.company_ticker=c.ticker AND lv.eligibility_status='US_CONFIRMED' WHERE c.ticker=? AND c.eligible_status IN ('ELIGIBLE','CONDITIONAL')").bind(ticker).first();
     if(!eligible)return json({error:'NOT_FOUND'},404);
     const r=await env.DB.prepare('SELECT * FROM score_snapshots WHERE company_ticker=? ORDER BY asof_utc DESC LIMIT 100').bind(ticker).all();
     return json({ticker,items:(r.results||[]).map(x=>({...x,...scoreRange(x)}))});
    }
    return candidateDetail(env.DB,ticker);
   }
   if(url.pathname.startsWith('/api/'))return json({error:'NOT_FOUND'},404);
   if(url.pathname!=='/'&&url.pathname!=='/index.html')return json({error:'NOT_FOUND'},404);
   return new Response(PAGE,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-cache','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin','content-security-policy':"default-src 'none'; script-src 'unsafe-inline' https://s3.tradingview.com; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https://s3.tradingview.com; frame-src https://*.tradingview.com https://tradingview.com; base-uri 'none'; frame-ancestors 'none'"}});
  }catch(e){console.error(JSON.stringify({event:'api_error',path:url.pathname,error:String(e).slice(0,180)}));return json({error:'INTERNAL_ERROR',message:'데이터 요청 처리 실패'},500)}
 },
 async scheduled(event,env,ctx){
  ctx.waitUntil(Promise.allSettled([
   ensureQuarter(env.DB,'CRON').catch(e=>console.error(JSON.stringify({event:'quarter_rollover_error',error:String(e).slice(0,180)}))),
   runRefresh(env,'CRON').catch(e=>console.error(JSON.stringify({event:'sec_cron_error',error:String(e).slice(0,180)}))),
   runMarketRefresh(env,'CRON').catch(e=>console.error(JSON.stringify({event:'market_cron_error',error:String(e).slice(0,180)})))
  ]));
 }
};
