/**
 * Workspace Portal — independent Cloudflare Worker.
 * Build from source: node portal/scripts/build.mjs
 * Only public, explicitly enumerated links. No database, cookies or remote writes.
 */
const PAGE = __PORTAL_HTML__;
const RELEASE = __PORTAL_RELEASE__;
const FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#15243e"/><rect x="12" y="12" width="17" height="17" rx="4" fill="#8fbcfa"/><rect x="35" y="12" width="17" height="17" rx="4" fill="#b2a3ff"/><rect x="12" y="35" width="17" height="17" rx="4" fill="#92ded8"/><rect x="35" y="35" width="17" height="17" rx="4" fill="#c7dbff"/></svg>';
const HEADERS = {
 'content-type':'text/html; charset=utf-8',
 'cache-control':'public, max-age=60, must-revalidate',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()',
 'x-frame-options':'DENY',
 'content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests"
};
export default {
 async fetch(request) {
  const url = new URL(request.url);
  if(request.method !== 'GET' && request.method !== 'HEAD') {
   return new Response('Method Not Allowed', {status:405,headers:{'allow':'GET, HEAD','cache-control':'no-store'}});
  }
  if(url.pathname==='/' || url.pathname==='/index.html') {
   return new Response(request.method==='HEAD'?null:PAGE,{status:200,headers:HEADERS});
  }
  if(url.pathname==='/health') {
   return new Response(request.method==='HEAD'?null:JSON.stringify({status:'ok',release:RELEASE}),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  }
  if(url.pathname==='/favicon.svg') {
   return new Response(request.method==='HEAD'?null:FAVICON,{status:200,headers:{'content-type':'image/svg+xml; charset=utf-8','cache-control':'public, max-age=86400','x-content-type-options':'nosniff'}});
  }
  return new Response('Not Found',{status:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
 }
};
