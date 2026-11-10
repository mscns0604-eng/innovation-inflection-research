/**
 * IIR Cloudflare Worker - v0.1
 * Build: node scripts/build.mjs (injects web.html in __IIR_HTML__)
 * Public read-only API; admin mutations disabled until a server-side token is set.
 */
const PAGE = __IIR_HTML__;
const RUBRIC_VERSION = 'v0.2.0';
const WEIGHTS = Object.freeze({insider:25,theme:20,technology:20,external_validation:10,financial:10,price:10,macro:5});
const JOB = 'sec_form4';
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
 if(!['ALL_ELIGIBLE','NON_BIO','QUALIFIED_BIO'].includes(mode))return json({error:'INVALID_MODE'},400);
 const sort=url.searchParams.get('sort')||'priority';
 if(!ALLOW_SORT[sort])return json({error:'INVALID_SORT'},400);
 const where=mode==='ALL_ELIGIBLE'?"c.eligible_status IN ('ELIGIBLE','CONDITIONAL')":"c.eligible_status IN ('ELIGIBLE','CONDITIONAL') AND c.bio_mode = ?";
 const args=mode==='ALL_ELIGIBLE'?[]:[mode];
 const common=' FROM companies c LEFT JOIN score_snapshots s ON s.id=(SELECT s2.id FROM score_snapshots s2 WHERE s2.company_ticker=c.ticker ORDER BY s2.asof_utc DESC,s2.id DESC LIMIT 1) WHERE '+where;
 const count=await db.prepare('SELECT COUNT(*) n'+common).bind(...args).first();
 const fields='c.*,s.insider,s.theme AS theme_score,s.technology,s.external_validation,s.financial,s.price,s.macro,s.asof_utc AS score_asof_utc,s.review_rank,s.research_status AS reviewed_research_status,s.entry_risk_status,s.reason_summary AS current_reason_summary,(SELECT COUNT(*) FROM candidate_signals cs WHERE cs.company_ticker=c.ticker) AS live_p_count,(SELECT MAX(disclosed_at_utc) FROM candidate_signals cs WHERE cs.company_ticker=c.ticker) AS latest_sec_disclosure';
 // c.theme is a theme description; read the optional score as theme_score.
 const rows=await db.prepare('SELECT '+fields+common+' ORDER BY '+ALLOW_SORT[sort]+' LIMIT ? OFFSET ?').bind(...args,rawLimit,(rawPage-1)*rawLimit).all();
 return json({items:(rows.results||[]).map(displayRow),total:count?.n||0,page:rawPage,limit:rawLimit});
}
async function candidateDetail(db,ticker){
 if(!validTicker(ticker))return json({error:'INVALID_TICKER'},400);
 const c=await db.prepare('SELECT * FROM companies WHERE ticker=?').bind(ticker).first();
 if(!c)return json({error:'NOT_FOUND'},404);
 const [filings,scores,events,signals,trades]=await Promise.all([
  db.prepare('SELECT accession_number,filing_type,accepted_at_utc,source_url,parse_status FROM filings WHERE company_ticker=? ORDER BY accepted_at_utc DESC LIMIT 25').bind(ticker).all(),
  db.prepare('SELECT * FROM score_snapshots WHERE company_ticker=? ORDER BY asof_utc DESC LIMIT 15').bind(ticker).all(),
  db.prepare('SELECT * FROM catalysts WHERE company_ticker=? ORDER BY target_start LIMIT 20').bind(ticker).all(),
  db.prepare('SELECT signal_type,disclosed_at_utc,aggregate_buy_usd,status,source_url FROM candidate_signals WHERE company_ticker=? ORDER BY disclosed_at_utc DESC LIMIT 30').bind(ticker).all(),
  db.prepare('SELECT t.reporting_owner_name,t.trade_date,t.code,t.shares,t.price_usd,t.value_usd,t.direct_indirect,t.plan_10b5_1,t.purchase_kind,t.verification_status,f.source_url FROM insider_transactions t JOIN filings f ON f.id=t.filing_id WHERE f.company_ticker=? ORDER BY t.trade_date DESC,t.id DESC LIMIT 50').bind(ticker).all()
 ]);
 return json({company:c,filings:filings.results,scores:(scores.results||[]).map(s=>({...s,...scoreRange(s)})),catalysts:events.results,signals:signals.results,insider_trades:trades.results||[],rubric_version:RUBRIC_VERSION});
}
async function getStatus(db,env){
 const s=await db.prepare('SELECT job_name,last_attempt_at_utc,last_success_at_utc,last_error,cursor,enabled,last_run_state,error_count FROM pipeline_state WHERE job_name=?').bind(JOB).first();
 let state='NOT_CONFIGURED';
 if(!s?.enabled||env.AUTOMATION_ENABLED==='false')state='DISABLED';
 else if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.SEC_CONTACT_EMAIL||''))state='NOT_CONFIGURED';
 else state=s?.last_run_state||'NEVER_RUN';
 return json({version:'iir-mvp-0.1',rubric_version:RUBRIC_VERSION,seed_asof:'2026-11-09',historical_seed:true,
  sec:{state,last_attempt_at:s?.last_attempt_at_utc||null,last_success_at:s?.last_success_at_utc||null,
  last_error:s?.last_error||null,checkpoint:s?.cursor||0,auto_enabled:!!s?.enabled&&env.AUTOMATION_ENABLED!=='false'},
  market:{state:'NOT_CONFIGURED',last_success_at:null},technology:{state:'MANUAL_REVIEW'},server_time_utc:iso()});
}
async function listSignals(db,url){
 const since=url.searchParams.get('since')||'2026-01-01';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(since))return json({error:'INVALID_SINCE'},400);
 const r=await db.prepare('SELECT * FROM candidate_signals WHERE substr(disclosed_at_utc,1,10)>=? ORDER BY disclosed_at_utc DESC,id DESC LIMIT 100').bind(since).all();
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
   const res=await fetch(target,{headers,signal:controller.signal,redirect:'error'});
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
  const list=await db.prepare('SELECT ticker,cik FROM companies ORDER BY ticker ASC LIMIT 100').all();
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
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  try{
   if(url.pathname==='/api/admin/refresh'||url.pathname==='/api/admin/stop'){
    if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
    if(!await adminAllowed(request,env))return json({error:'ADMIN_AUTH_REQUIRED'},403);
    if(url.pathname.endsWith('/stop')){
     await env.DB.prepare('UPDATE pipeline_state SET enabled=0 WHERE job_name=?').bind(JOB).run();
     return json({ok:true,stopped:true});
    }
    return json(await runRefresh(env,'MANUAL'));
   }
   if(request.method!=='GET')return json({error:'METHOD_NOT_ALLOWED'},405);
   if(url.pathname==='/api/status')return getStatus(env.DB,env);
   if(url.pathname==='/api/candidates')return listCandidates(env.DB,url);
   if(url.pathname==='/api/signals')return listSignals(env.DB,url);
   if(url.pathname==='/api/meta/rubric')return json({version:RUBRIC_VERSION,weights:WEIGHTS,validated_predictive_model:false});
   const mt=url.pathname.match(/^\/api\/candidates\/([A-Za-z0-9.-]+)(\/history)?$/);
   if(mt){
    const ticker=mt[1].toUpperCase();
    if(mt[2]){
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
  ctx.waitUntil(runRefresh(env,'CRON').catch(e=>console.error(JSON.stringify({event:'cron_error',error:String(e).slice(0,180)}))));
 }
};
