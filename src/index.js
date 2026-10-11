import { Buffer } from 'node:buffer';
import routes from './routes.json' with { type: 'json' };
import { generate } from './formats.js';
import { HTML_BYTES, date, escapeHTML, fill, id, integer, name, token } from './random.js';

export { routes };

function notFound(path) {
  const seed = id();
  const prefix = '/archive/' + seed + '/';
  const opening = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Index of ${escapeHTML(path)}</title>
<style>body{max-width:960px;margin:64px auto;padding:0 24px;font:15px/1.6 ui-monospace,monospace;color:#d6dce5;background:#11151b}h1{font-size:24px}a{color:#93b9ef}ul{padding:0;list-style:none}li{display:grid;grid-template-columns:1fr 190px 100px;border-bottom:1px solid #29313c;padding:10px 0}small{color:#929eae}@media(max-width:650px){li{grid-template-columns:1fr}body{margin:24px auto}}</style>
</head><body><h1>Index of ${escapeHTML(path)}</h1><p>The requested resource was not found. Archived entries:</p><ul>\n`;
  const content = fill(opening, () => {
    // This namespace is absent from the exact route manifest: every link stays a 404.
    const entry = `${name()}-${token(16)}.${['json', 'sql', 'bak', 'tar.gz'][integer(4)]}`;
    return `<li><a rel="nofollow" href="${prefix}${entry}">${entry}</a><small>${date().slice(0, 19).replace('T', ' ')}</small><small>${integer(900000) + 10000} bytes</small></li>\n`;
  }, HTML_BYTES);
  return content + '</ul><footer><p>404 — resource unavailable</p></footer></body></html>\n';
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path;
    try { path = decodeURIComponent(url.pathname); } catch { path = url.pathname; }
    const matched = Object.hasOwn(routes, path);
    const headers = {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    };
    if (matched && request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed\n', { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
    }
    const payload = matched ? await generate(path, routes[path])
      : { body: notFound(path), type: 'text/html; charset=utf-8' };
    headers['Content-Type'] = payload.type;
    headers['Content-Length'] = String(Buffer.byteLength(payload.body));
    return new Response(request.method === 'HEAD' ? null : payload.body, {
      status: matched ? 200 : 404, headers,
    });
  },
};
