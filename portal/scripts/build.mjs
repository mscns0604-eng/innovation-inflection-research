import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=(name)=>readFileSync(path.join(root,name),'utf8');
const html=read('index.html');
const template=read('worker.template.js');
const manifest=JSON.parse(read('links.json'));

function assert(condition,message){if(!condition)throw new Error('PORTAL_BUILD_INVALID: '+message)}
assert(manifest.schema_version===1,'manifest schema_version must be 1');
assert(typeof manifest.updated_at==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(manifest.updated_at),'missing version date');
assert(Array.isArray(manifest.items)&&manifest.items.length>=1&&manifest.items.length<=60,'service count out of range');
const ids=new Set(),urls=new Set();
for(const item of manifest.items){
 assert(item&&typeof item==='object','item must be object');
 assert(typeof item.id==='string'&&/^[a-z0-9-]{3,64}$/.test(item.id),'invalid id');
 assert(!ids.has(item.id),'duplicate id: '+item.id);
 ids.add(item.id);
 assert(typeof item.title==='string'&&item.title.length>=1&&item.title.length<=80,'invalid title: '+item.id);
 assert(typeof item.description==='string'&&item.description.length<=200,'description too long: '+item.id);
 assert(['invest','realestate','test','docs'].includes(item.category),'invalid category: '+item.id);
 assert(['tech','bio','auction','test','docs'].includes(item.visual),'invalid visual: '+item.id);
 assert(['production','preview','resource'].includes(item.environment),'invalid environment: '+item.id);
 assert(typeof item.href==='string'&&item.href.length<=1800,'invalid URL');
 const u=new URL(item.href);
 assert(u.protocol==='https:'&&!u.username&&!u.password,'only credential-free https links allowed');
 assert(!urls.has(u.href),'duplicate URL: '+item.id);
 urls.add(u.href);
}
assert((html.match(/__PORTAL_LINKS__/g)||[]).length===1,'HTML links placeholder count');
assert((template.match(/__PORTAL_HTML__/g)||[]).length===1,'Worker HTML placeholder count');
assert((template.match(/__PORTAL_RELEASE__/g)||[]).length===1,'Worker release placeholder count');

// Prevent a future manually edited link description from prematurely closing the inline script.
const safeData=JSON.stringify(manifest).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const page=html.replace('__PORTAL_LINKS__',()=>safeData);
const revision=createHash('sha256').update(page).digest('hex').slice(0,12);
const release=manifest.updated_at+'-'+revision;
const worker=template.replace('__PORTAL_HTML__',()=>JSON.stringify(page)).replace('__PORTAL_RELEASE__',()=>JSON.stringify(release));
assert(!worker.includes('__PORTAL_HTML__')&&!worker.includes('__PORTAL_RELEASE__'),'unexpanded worker placeholders');
assert(worker.length<=250000,'Worker exceeds expected size');
const dist=path.join(root,'dist');
mkdirSync(dist,{recursive:true});
writeFileSync(path.join(dist,'worker.mjs'),worker);
console.log(JSON.stringify({result:'ok',output:'portal/dist/worker.mjs',release,defaultLinks:manifest.items.length,bytes:worker.length}));
