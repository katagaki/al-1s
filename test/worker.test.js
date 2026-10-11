import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import worker, { routes } from '../src/index.js';
import { TARGET_BYTES, HTML_BYTES } from '../src/random.js';

const request = (path, options) => worker.fetch(new Request(`https://example.invalid${path}`, options));

test('all 393 routes return substantial generated content in the advertised format', async () => {
  assert.equal(Object.keys(routes).length, 393);
  for (const path of Object.keys(routes)) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    const body = Buffer.from(await response.arrayBuffer());
    assert.ok(body.length >= TARGET_BYTES, `${path}: only ${body.length} bytes`);
    assert.equal(Number(response.headers.get('content-length')), body.length, path);
    if (response.headers.get('content-type').startsWith('application/json')) {
      assert.doesNotThrow(() => JSON.parse(body), path);
    }
    if (path.endsWith('.map')) assert.equal(JSON.parse(body).version, 3);
    if (path === '/.svn/wc.db') assert.equal(body.subarray(0, 16).toString(), 'SQLite format 3\0');
    if (path === '/backup.zip') assert.equal(body.readUInt32LE(0), 0x04034b50);
    if (path === '/backup.tar.gz') {
      const tar = gunzipSync(body);
      assert.equal(tar.subarray(257, 262).toString(), 'ustar');
    }
    if (path === '/actuator/heapdump') assert.equal(body.subarray(0, 19).toString(), 'JAVA PROFILE 1.0.2\0');
    if (path === '/server.key' || path === '/.ssh/id_rsa') {
      assert.equal(createPrivateKey(body).asymmetricKeyType, 'rsa');
    }
  }
});

test('requests generate different data rather than sharing a cached document', async () => {
  for (const path of ['/.env', '/secrets.json', '/backup.zip', '/.svn/wc.db', '/.git/HEAD', '/.ssh/id_ed25519']) {
    const a = Buffer.from(await (await request(path)).arrayBuffer());
    const b = Buffer.from(await (await request(path)).arrayBuffer());
    assert.notDeepEqual(a, b, path);
  }
});

test('unmatched paths return 404 HTML with only dead generated index links', async () => {
  const a = await request('/missing%3Cscript%3E');
  assert.equal(a.status, 404);
  assert.match(a.headers.get('content-type'), /text\/html/);
  const body = await a.text();
  assert.ok(Buffer.byteLength(body) >= HTML_BYTES);
  assert.match(body, /&lt;script&gt;/);
  assert.doesNotMatch(body, /<script>/);
  const links = [...body.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  assert.ok(links.length > 100);
  for (const link of links) assert.equal(Object.hasOwn(routes, link), false);
  assert.equal((await request(links[0])).status, 404);
  assert.notEqual(await (await request('/missing')).text(), await (await request('/missing')).text());
  assert.equal((await request('/missing', { method: 'POST' })).status, 404);
});

test('HEAD, query strings, encoded paths and unsupported methods retain HTTP semantics', async () => {
  const head = await request('/.env', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.ok(Number(head.headers.get('content-length')) >= TARGET_BYTES);
  const missing = await request('/missing', { method: 'HEAD' });
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), '');
  assert.equal((await request('/%2eenv')).status, 200);
  assert.equal((await request('/.env?download=1')).status, 200);
  assert.equal((await request('/.env', { method: 'POST' })).status, 405);
  assert.equal((await request('/.env/child')).status, 404);
});
