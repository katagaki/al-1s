import { Buffer } from 'node:buffer';
import routes from './routes.json' with { type: 'json' };
import { generate } from './formats.js';
import { HTML_BYTES, date, escapeHTML, fill, id, integer, name, token } from './random.js';

export { routes };

function directoryIndex(path) {
  const seed = id();
  const prefix = '/archive/' + seed + '/';
  const opening = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Index of ${escapeHTML(path)}</title>
<link rel="icon" href="/favicon.ico" type="image/x-icon">
<style>html{color-scheme:light}body{margin:8px;color:#000;background:#fff;font-family:"Times New Roman",serif}h1{font-size:2em;margin:.67em 0;overflow-wrap:anywhere}a:link{color:#00e}a:visited{color:#551a8b}pre{font:13px/1.5 monospace;overflow-x:auto}hr{border:0;border-top:1px solid #888}address{font-size:14px}</style>
</head><body><h1>Index of ${escapeHTML(path)}</h1><hr><pre aria-label="Directory listing">      ${'Name'.padEnd(52)}${'Last modified'.padEnd(19)}${'Size'.padStart(5)}  Description
[DIR] <a rel="nofollow" href="${prefix}">../</a>${' '.repeat(49 + 19)}${'-'.padStart(5)}  Parent Directory
\n`;
  const content = fill(opening, () => {
    // This namespace is absent from the exact route manifest: every link serves another index.
    const entry = `${name()}-${token(16)}.${['json', 'sql', 'bak', 'tar.gz'][integer(4)]}`;
    const modified = new Date(date());
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][modified.getUTCMonth()];
    const timestamp = `${String(modified.getUTCDate()).padStart(2, '0')}-${month}-${modified.getUTCFullYear()} ${modified.toISOString().slice(11, 16)}`;
    const size = `${Math.ceil((integer(900000) + 10000) / 1024)}K`.padStart(5);
    const marker = entry.endsWith('.tar.gz') ? '[ARC]' : '[TXT]';
    return `${marker} <a rel="nofollow" href="${prefix}${entry}">${entry}</a>${' '.repeat(52 - entry.length)}${timestamp}  ${size}\n`;
  }, HTML_BYTES);
  return content + '</pre><hr><address>nginx / Apache Server</address></body></html>\n';
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
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    };
    if (matched && request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed\n', { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
    }
    const payload = matched ? await generate(path, routes[path])
      : { body: directoryIndex(path), type: 'text/html; charset=utf-8' };
    headers['Content-Type'] = payload.type;
    headers['Content-Length'] = String(Buffer.byteLength(payload.body));
    return new Response(request.method === 'HEAD' ? null : payload.body, {
      status: 200, headers,
    });
  },
};
