import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync(process.execPath,[path.join(root,'scripts/build.mjs')],{timeout:12000,stdio:'pipe'});
const manifest=JSON.parse(readFileSync(path.join(root,'links.json'),'utf8'));
const page=readFileSync(path.join(root,'index.html'),'utf8');
const worker=(await import('../dist/worker.mjs')).default;

test('public links are unique and group correctly',()=>{
 assert.equal(manifest.items.length,6);
 assert.equal(manifest.items.filter(x=>x.environment==='production').length,3);
 assert.equal(manifest.items.filter(x=>x.environment==='preview').length,2);
 assert.equal(new Set(manifest.items.map(x=>x.href)).size,manifest.items.length);
 assert.equal(manifest.items.filter(x=>x.category==='invest').length,2);
 assert.ok(manifest.items.some(x=>x.href.includes('auction-radar-v02.shnboy.workers.dev')));
});
test('worker serves a complete portable portal page',async()=>{
 const r=await worker.fetch(new Request('https://portal.example/'));
 assert.equal(r.status,200);
 assert.match(r.headers.get('content-type'),/text\/html/);
 const content=await r.text();
 assert.match(content,/투자 레이더/);
 assert.match(content,/바이오/);
 assert.match(content,/auction-radar-v02/);
 assert.doesNotMatch(content,/__PORTAL_LINKS__/);
 assert.equal((content.match(/function render\(\)/g)||[]).length,1);
});
test('no worker writes, safe 404 and dedicated health endpoint',async()=>{
 const post=await worker.fetch(new Request('https://portal.example/',{method:'POST'}));
 assert.equal(post.status,405);
 const bad=await worker.fetch(new Request('https://portal.example/admin'));
 assert.equal(bad.status,404);
 const h=await worker.fetch(new Request('https://portal.example/health'));
 assert.equal(h.status,200);
 assert.equal((await h.json()).status,'ok');
});
test('personal links are browser-local and separately exportable',()=>{
 assert.match(page,/workspace_portal_custom_v1/);
 assert.match(page,/workspace_portal_pins_v1/);
 assert.match(page,/portal-my-links-backup\.json/);
 assert.match(page,/normalizeCustom/);
});
