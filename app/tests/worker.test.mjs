import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker, {scoreRange,parseForm4} from '../dist/worker.mjs';

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
 assert.match(t,/과거 조사자료/);
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
 assert.match(html,/id="close"[^>]*목록으로 돌아가기/);
});
