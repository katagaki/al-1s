import { Buffer } from 'node:buffer';
import { privateKey } from './binary.js';
import { environment, environmentDocument } from './environment.js';
export { environment } from './environment.js';
import { TARGET_BYTES, accessKey, date, email, fill, hex, hostname, id, integer, name, password, token } from './random.js';

// Structure comes from the named format; values are generated, never loaded.
// Grow a schema's own collection instead of adding unrelated top-level filler.
function collection(seed, field, row, array = false, keyFor = i => `service_${i}_${token(8)}`) {
  const entries = array ? [] : {};
  let size = Buffer.byteLength(JSON.stringify(seed));
  for (let i = 0; size < TARGET_BYTES; i++) {
    const value = row(i);
    if (array) {
      entries.push(value);
      size += Buffer.byteLength(JSON.stringify(value)) + 1;
    } else {
      const key = keyFor(i);
      entries[key] = value;
      size += Buffer.byteLength(JSON.stringify(key)) + Buffer.byteLength(JSON.stringify(value)) + 2;
    }
  }
  return { ...seed, [field]: entries };
}
const secret = () => ({ username: token(12), password: password(), api_key: password() });
const largeToken = () => fill('', () => token(1024), TARGET_BYTES);
const region = 'us-east-1';
const pool = () => `${region}_${token(9, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')}`;

export function applicationConfig() {
  return collection({
    environment: 'production', server: { host: hostname(), port: 8080 },
    database: { client: 'postgresql', host: hostname(), port: 5432, database: name(), user: token(12), password: password() },
    redis: { host: hostname(), port: 6379, password: password(), db: 0 },
    auth: { jwtSecret: password(), sessionSecret: password(), tokenExpiration: 3600 },
    smtp: { host: hostname(), port: 587, secure: false, auth: { user: email(), pass: password() } },
  }, 'services', () => ({ baseUrl: `https://${hostname()}`, ...secret(), timeout: 30000 }));
}

export async function schemaJSON(path) {
  if (/\/application_default_credentials\.json$/.test(path)) return {
    type: 'authorized_user', client_id: `${integer()}.${token(24)}.apps.googleusercontent.com`,
    client_secret: `GOCSPX-${password()}`, refresh_token: `1//${largeToken()}`,
    quota_project_id: name(), universe_domain: 'googleapis.com',
  };
  if (/service.?account|serviceAccount|adminsdk|gcp-|google-(?:credentials|key)|firebase-key|\/sa\.json|\/keyfile\.json/.test(path)) {
    const project = name();
    const client = `${name()}@${project}.iam.gserviceaccount.com`;
    const key = await privateKey();
    return { type: 'service_account', project_id: project, private_key_id: hex(40),
      private_key: fill(key, () => key), client_email: client, client_id: `1${token(20, '0123456789')}`,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth', token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(client)}`,
      universe_domain: 'googleapis.com' };
  }
  if (path === '/.env.json') return environmentDocument();
  if (['/admin/auth.json', '/backups/auth.json'].includes(path)) return collection({
    'github-oauth': { 'github.com': `ghp_${token(36)}` },
  }, 'http-basic', () => ({ username: token(12), password: password() }), false, () => hostname());
  if (['/credentials.json', '/secrets.json', '/key.json'].includes(path)) return collection({
    database: secret(), aws: { access_key_id: accessKey(), secret_access_key: password() },
    jwt: { secret: password(), algorithm: 'HS256' }, stripe: { secret_key: `sk_live_${password()}` },
  }, 'services', secret);
  if (path === '/firebase.json') return collection({
    functions: [{ source: 'functions', codebase: 'default' }],
    firestore: { rules: 'firestore.rules', indexes: 'firestore.indexes.json' },
    storage: { rules: 'storage.rules' },
  }, 'hosting', i => ({ target: `site-${i}-${token(8)}`, public: 'dist',
    ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
    rewrites: [{ source: '**', destination: '/index.html' }],
    headers: [{ source: '/api/**', headers: [{ key: 'X-API-Key', value: password() }] }] }), true);
  if (path === '/host.json') return { version: '2.0', functionTimeout: '00:05:00',
    extensions: { http: { routePrefix: 'api', maxConcurrentRequests: 100, maxOutstandingRequests: 200 } },
    extensionBundle: { id: 'Microsoft.Azure.Functions.ExtensionBundle', version: '[4.0.0, 5.0.0)' },
    logging: { logLevel: { default: 'Information', ...collection({}, 'categories', () => 'Information', false,
      i => `Function.Service${i}_${token(8)}`).categories } },
  };
  if (path === '/vercel.json') return collection({ version: 2,
    rewrites: [{ source: '/api/:path*', destination: `https://${hostname()}/:path*` }],
    env: environment(),
  }, 'functions', () => ({ memory: 1024, maxDuration: 30, includeFiles: `config/${name()}.json` }), false,
    i => `api/service-${i}-${token(8)}.js`);
  if (path === '/.amplifyrc') return { projectName: name(), version: '1.0',
    frontend: 'javascript', providers: ['awscloudformation'],
    javascript: { framework: 'react', config: { SourceDir: 'src', DistributionDir: 'build',
      BuildCommand: fill('npm run build -- ', i => `--define:MOCK_SERVICE_${i}_SECRET=${password()} `),
      StartCommand: 'npm start' } },
  };
  if (path === '/awsconfiguration.json') return collection({ UserAgent: 'aws-amplify/6.0', Version: '1.0',
    IdentityManager: { Default: {} }, CognitoUserPool: { Default: {
      PoolId: pool(), AppClientId: token(26), AppClientSecret: password(), Region: region } },
    CredentialsProvider: { CognitoIdentity: { Default: { PoolId: `${region}:${id()}`, Region: region } } },
  }, 'AppSync', () => ({ ApiUrl: `https://${hostname()}/graphql`, Region: region,
    AuthMode: 'API_KEY', ApiKey: `da2-${token(26)}` }));
  if (path === '/ws-config.json') return collection({ host: hostname(), port: 6001,
    authEndpoint: '/broadcasting/auth', encrypted: true,
  }, 'apps', () => ({ id: id(), key: token(20), secret: password(), enableClientMessages: false }), true);
  if (path === '/storage/ovh-backups.json') return collection({}, 'backups', () => ({
    id: id(), created_at: date(), filename: `${name()}.sql.gz`, size: integer(100000000),
    container: name(), region: 'GRA', storage_url: `https://${hostname()}/v1/${id()}`,
    username: token(12), password: password(), checksum: hex(64),
  }), true);
  if (path === '/debug/vars') return collection({ cmdline: ['/usr/local/bin/portal', '--config', '/etc/portal/config.json'],
    memstats: { Alloc: integer(100000000), TotalAlloc: integer(100000000), Sys: integer(100000000),
      Lookups: integer(), Mallocs: integer(), Frees: integer(), HeapAlloc: integer(), NumGC: integer(100) },
  }, 'request_counts', () => integer());
  if (path === '/wp-json/logtivity/v1/options') return collection({ api_key: password(),
    site_url: `https://${hostname()}`, enabled: true, log_retention_days: 30,
  }, 'options', () => ({ enabled: true, webhook_url: `https://${hostname()}`, api_key: password() }));
  if (path.startsWith('/actuator/')) {
    if (path.endsWith('/caches')) return { cacheManagers: { cacheManager: collection({}, 'caches',
      () => ({ target: 'org.springframework.cache.concurrent.ConcurrentMapCache' })) } };
    if (path.endsWith('/conditions')) return { contexts: { application: {
      parentId: null, positiveMatches: collection({}, 'matches', () => [{
        condition: 'OnPropertyCondition', message: `@ConditionalOnProperty (${name()}.enabled=true) matched`,
      }]).matches, negativeMatches: {}, unconditionalClasses: [],
    } } };
    if (path.endsWith('/loggers')) return collection({ levels: ['OFF', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'],
      groups: { web: { configuredLevel: null, members: ['org.springframework.web'] } },
    }, 'loggers', () => ({ configuredLevel: 'INFO', effectiveLevel: 'INFO' }));
    if (path.endsWith('/httptrace')) return collection({}, 'traces', () => ({
      timestamp: date(), principal: null, session: null, timeTaken: integer(1000),
      request: { method: 'GET', uri: `https://${hostname()}/api/${id()}`,
        headers: { authorization: [`Bearer ${password()}`], accept: ['application/json'] }, remoteAddress: null },
      response: { status: 200, headers: { 'content-type': ['application/json'] } },
    }), true);
  }
  return undefined;
}

export function schemaJavaScript(path) {
  if (path === '/aws-exports.js') {
    const config = collection({ aws_project_region: region, aws_cognito_region: region,
      aws_cognito_identity_pool_id: `${region}:${id()}`, aws_user_pools_id: pool(),
      aws_user_pools_web_client_id: token(26), aws_appsync_graphqlEndpoint: `https://${hostname()}/graphql`,
      aws_appsync_region: region, aws_appsync_authenticationType: 'API_KEY', aws_appsync_apiKey: `da2-${token(26)}`,
    }, 'aws_cloud_logic_custom', () => ({ name: name(), endpoint: `https://${hostname()}`, region }), true);
    return `const awsmobile = ${JSON.stringify(config, null, 2)};\nexport default awsmobile;\n`;
  }
  const config = path.endsWith('/env.js')
    ? environmentDocument() : applicationConfig();
  const prefix = path.endsWith('/env.js') ? 'window.__ENV__ = ' : 'module.exports = ';
  return `${prefix}${JSON.stringify(config, null, 2)};\n`;
}

// JSON-quoted strings are also valid YAML scalars; indentation preserves nesting.
export function toYAML(value, indent = 0) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) return value.map(item => typeof item === 'object' && item !== null
    ? `${pad}-\n${toYAML(item, indent + 2)}` : `${pad}- ${JSON.stringify(item)}\n`).join('');
  return Object.entries(value).map(([key, item]) => typeof item === 'object' && item !== null
    ? `${pad}${JSON.stringify(key)}:${Object.keys(item).length ? '\n' + toYAML(item, indent + 2) : ' {}\n'}`
    : `${pad}${JSON.stringify(key)}: ${JSON.stringify(item)}\n`).join('');
}

export function schemaYAML(path) {
  if (/\/\.env\.ya?ml$/.test(path)) return toYAML(environmentDocument());
  if (path === '/config/database.yml') return toYAML({ production: {
    primary: { adapter: 'postgresql', encoding: 'unicode', database: name(), pool: 5,
      host: hostname(), username: token(12), password: password() },
    ...collection({}, 'databases', () => ({ adapter: 'postgresql', host: hostname(),
      database: name(), username: token(12), password: password() })).databases,
  } });
  if (path === '/application.yml') return toYAML({ spring: {
    application: { name: name() }, datasource: { url: `jdbc:postgresql://${hostname()}:5432/portal`,
      username: token(12), password: password(), driverClassName: 'org.postgresql.Driver' },
    data: { redis: { host: hostname(), port: 6379, password: password() } },
  }, server: { port: 8080 }, ...collection({}, 'integrations', () => ({ url: `https://${hostname()}`, apiKey: password() })) });
  if (path === '/serverless.yml') return toYAML(collection({ service: name(), frameworkVersion: '3',
    provider: { name: 'aws', runtime: 'nodejs22.x', region, stage: 'production', environment: environment() },
  }, 'functions', () => ({ handler: `${name()}.handler`, environment: { API_KEY: password() },
    events: [{ httpApi: { path: `/api/${id()}`, method: 'get' } }] })));
  if (path === '/_config.yml') return toYAML(collection({ title: name(), description: 'Customer portal',
    url: `https://${hostname()}`, baseurl: '', markdown: 'kramdown', theme: 'minima',
    plugins: ['jekyll-feed', 'jekyll-seo-tag'],
  }, 'collections', () => ({ output: true, permalink: `/${name()}/:path/` })));
  if (path === '/user_secrets.yml') return toYAML({ production: {
    secret_key_base: token(128), ...collection({}, 'services', secret),
    aws: { access_key_id: accessKey(), secret_access_key: password() },
  } });
  if (path === '/config.yml') return toYAML(applicationConfig());
  return undefined;
}
