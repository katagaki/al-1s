import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import worker, { routes } from '../src/index.js';
import { TARGET_BYTES, HTML_BYTES, EMOJI_BYTES } from '../src/random.js';

const request = (path, options) => worker.fetch(new Request(`https://example.invalid${path}`, options));

test('all 394 decoy routes, favicon.ico and robots.txt return their intended content', async () => {
  assert.equal(Object.keys(routes).length, 396);
  for (const path of Object.keys(routes)) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    const body = Buffer.from(await response.arrayBuffer());
    if (path === '/robots.txt') assert.equal(body.toString(), 'User-agent: *\nDisallow: /\n');
    else if (path !== '/favicon.ico') assert.ok(body.length >= TARGET_BYTES, `${path}: only ${body.length} bytes`);
    assert.equal(Number(response.headers.get('content-length')), body.length, path);
    if (response.headers.get('content-type').startsWith('application/json')) {
      assert.doesNotThrow(() => JSON.parse(body), path);
      assert.ok(Buffer.byteLength(JSON.stringify(JSON.parse(body))) >= TARGET_BYTES,
        `${path}: minimum size must come from JSON content, not whitespace`);
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

test('favicon serves an ICO image with matching HEAD headers and method restrictions', async () => {
  const response = await request('/favicon.ico');
  assert.equal(response.headers.get('content-type'), 'image/x-icon');
  const body = Buffer.from(await response.arrayBuffer());
  assert.equal(body.readUInt16LE(0), 0);
  assert.equal(body.readUInt16LE(2), 1);
  assert.equal(body.readUInt16LE(4), 3);
  for (let i = 0; i < 3; i++) {
    const entry = 6 + i * 16;
    const offset = body.readUInt32LE(entry + 12);
    assert.equal(body.subarray(offset, offset + 8).toString('hex'), '89504e470d0a1a0a');
    assert.ok(offset + body.readUInt32LE(entry + 8) <= body.length);
  }
  const head = await request('/favicon.ico?version=1', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('content-length'), String(body.length));
  assert.equal((await request('/favicon.ico', { method: 'POST' })).status, 405);
});

test('documentation decoys contain exactly one MiB of fresh, valid emoji', async () => {
  for (const path of ['/AGENTS.md', '/CLAUDE.md', '/README.md']) {
    const a = await (await request(path)).text();
    assert.equal(Buffer.byteLength(a), EMOJI_BYTES, path);
    assert.equal(Array.from(a).length, EMOJI_BYTES / 4);
    assert.match(a, /^\p{Extended_Pictographic}+$/u);
    assert.doesNotMatch(a, /\uFFFD/);
    assert.notEqual(a, await (await request(path)).text());
    const head = await request(path, { method: 'HEAD' });
    assert.equal(await head.text(), '');
    assert.equal(Number(head.headers.get('content-length')), EMOJI_BYTES);
  }
  assert.equal((await request('/robots.txt')).status, 200);
  assert.equal((await request('/robots.txt', { method: 'POST' })).status, 405);
});

test('named files and endpoints retain their recognizable schemas with fabricated credentials', async () => {
  const json = async path => (await request(path)).json();
  const env = await (await request('/.env')).text();
  for (const key of ['DB_PASSWORD', 'AWS_SECRET_ACCESS_KEY', 'JWT_SECRET', 'MAIL_PASSWORD', 'STRIPE_SECRET_KEY',
    'AZURE_CLIENT_SECRET', 'AZURE_OPENAI_API_KEY', 'GCP_CLIENT_SECRET', 'GOOGLE_API_KEY', 'GEMINI_API_KEY',
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_R2_SECRET_ACCESS_KEY']) {
    assert.match(env, new RegExp(`^${key}=.+$`, 'm'));
  }
  const envJSON = await json('/.env.json');
  assert.match(envJSON.AWS_ACCESS_KEY_ID, /^AKIA[A-Z0-9]{16}$/);
  assert.equal(typeof envJSON.DB_PASSWORD, 'string');
  assert.equal(envJSON.services, undefined);
  assert.match(envJSON.OPENAI_API_KEY, /^sk-proj-/);
  assert.match(envJSON.ANTHROPIC_API_KEY, /^sk-ant-api03-/);
  assert.match(envJSON.AZURE_TENANT_ID, /^[a-f0-9-]{36}$/);
  assert.match(envJSON.CLOUDFLARE_ACCOUNT_ID, /^[a-f0-9]{32}$/);
  assert.notEqual(envJSON.OPENAI_API_KEY, (await json('/.env.json')).OPENAI_API_KEY);
  const account = await json('/service-account.json');
  assert.equal(account.type, 'service_account');
  assert.equal(account.services, undefined);
  assert.match(account.client_email, new RegExp(`@${account.project_id}\\.iam\\.gserviceaccount\\.com$`));
  assert.equal(createPrivateKey(account.private_key).asymmetricKeyType, 'rsa');
  assert.match(account.client_x509_cert_url, /metadata\/x509\//);
  const adc = await json('/application_default_credentials.json');
  assert.equal(adc.type, 'authorized_user');
  assert.ok(adc.client_secret && adc.refresh_token);
  assert.equal(adc.private_key, undefined);
  const firebase = await json('/firebase.json');
  assert.ok(Array.isArray(firebase.hosting));
  assert.equal(firebase.hosting[0].rewrites[0].destination, '/index.html');
  assert.equal(firebase.firestore.rules, 'firestore.rules');
  const host = await json('/host.json');
  assert.equal(host.version, '2.0');
  assert.equal(host.logging.logLevel.default, 'Information');
  const vercel = await json('/vercel.json');
  assert.equal(vercel.version, 2);
  assert.match(Object.keys(vercel.functions)[0], /^api\/.+\.js$/);
  assert.ok(vercel.env.DB_PASSWORD);
  assert.ok((await json('/awsconfiguration.json')).CognitoUserPool.Default.AppClientSecret);
  const google = await json('/app/google-services.json');
  assert.match(google.client[0].api_key[0].current_key, /^AIza/);
  const docker = await json('/.docker/config.json');
  assert.ok(Buffer.from(Object.values(docker.auths)[0].auth, 'base64').toString().includes(':'));
  assert.equal((await json('/swagger.json')).swagger, '2.0');
  assert.equal((await json('/openapi.json')).openapi, '3.0.3');
  assert.ok((await json('/actuator/beans')).contexts.application.beans);
  assert.ok((await json('/actuator/caches')).cacheManagers.cacheManager.caches);
  assert.ok((await json('/actuator/conditions')).contexts.application.positiveMatches);
  assert.ok((await json('/actuator/env')).propertySources[0].properties);
  assert.ok((await json('/actuator/loggers')).loggers);
  const trace = (await json('/actuator/httptrace')).traces[0];
  assert.ok(trace.request.headers.authorization[0].startsWith('Bearer '));
  assert.equal(trace.response.status, 200);
  assert.match(await (await request('/.env.yaml')).text(), /"DB_PASSWORD": ".+"/);
  assert.match(await (await request('/application.yml')).text(), /"spring":/);
  assert.match(await (await request('/config/database.yml')).text(), /"primary":/);
  assert.match(await (await request('/aws-exports.js')).text(), /"aws_user_pools_id":/);
  assert.match(await (await request('/env.js')).text(), /^window\.__ENV__ = /);
  assert.match(await (await request('/conf/settings.xml')).text(), /<servers>.*<username>/s);
  assert.match(await (await request('/sites/default/settings.php')).text(), /\$databases =/);
});

test('requests generate different data rather than sharing a cached document', async () => {
  for (const path of ['/.env', '/secrets.json', '/backup.zip', '/.svn/wc.db', '/.git/HEAD', '/.ssh/id_ed25519', '/livewire/livewire.js']) {
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
  assert.match(body, /<link rel="icon" href="\/favicon.ico"/);
  const links = [...body.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(match => match[1]);
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
