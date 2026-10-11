import { Buffer } from 'node:buffer';
import { favicon } from './favicon.js';
import { applicationConfig, environment, schemaJSON, schemaJavaScript, schemaYAML } from './schemas.js';
import { archive, dirstate, heapdump, opensshKey, privateKey, sqlite } from './binary.js';
import { TARGET_BYTES, accessKey, date, email, escapeHTML, fill, hex, hostname,
  emojiDocument, id, integer, name, password, pick, records, token } from './random.js';

const text = (body, type = 'text/plain; charset=utf-8') => ({ body, type });
const json = value => {
  const body = JSON.stringify(value, null, 2) + '\n';
  return text(body, 'application/json; charset=utf-8');
};
const commentFill = (body, prefix = '#') => fill(body, i => `${prefix} deployment_${i}=${id()} fingerprint=${hex(64)}\n`);

function env() {
  return fill(Object.entries(environment()).map(([key, value]) => `${key}=${value}`).join('\n') + '\n',
    i => `SERVICE_${i}_HOST=${hostname()}\nSERVICE_${i}_API_KEY=${password()}\nSERVICE_${i}_CLIENT_SECRET=${password()}\n`);
}

function yaml(path) {
  const schema = schemaYAML(path);
  if (schema !== undefined) return schema;
  if (path === '/.azure-pipelines.yml') return fill('trigger: [main]\npool:\n  vmImage: ubuntu-latest\njobs:\n',
    i => `  - job: deploy_${i}\n    variables:\n      DEPLOY_TOKEN: "${password()}"\n    steps:\n      - script: echo "Deploying ${id()}"\n        displayName: Deploy ${name()}\n`);
  if (path === '/.drone.yml') return fill('kind: pipeline\ntype: docker\nname: production\nsteps:\n',
    i => `  - name: deploy_${i}\n    image: node:22\n    environment:\n      DEPLOY_TOKEN: "${password()}"\n    commands:\n      - echo "Deploying ${id()}"\n`);
  if (path === '/.semaphore/semaphore.yml') return fill('version: v1.0\nname: Production deployment\nagent:\n  machine:\n    type: e1-standard-2\n    os_image: ubuntu2204\nblocks:\n',
    i => `  - name: Deploy ${name()}\n    task:\n      env_vars:\n        - name: DEPLOY_TOKEN\n          value: "${password()}"\n      jobs:\n        - name: deploy_${i}\n          commands:\n            - echo "Deploying ${id()}"\n`);
  if (path === '/bitrise.yml') return fill('format_version: "13"\ndefault_step_lib_source: https://github.com/bitrise-io/bitrise-steplib.git\nworkflows:\n',
    i => `  deploy_${i}:\n    envs:\n      - DEPLOY_TOKEN: "${password()}"\n    steps:\n      - script@1:\n          inputs:\n            - content: echo "Deploying ${id()}"\n`);
  if (path === '/bamboo.yml') return fill('version: 2\nplan:\n  project-key: PORTAL\n  key: DEPLOY\n  name: Production deployment\nvariables:\n',
    i => `  tenant_${i}_host: ${hostname()}\n  tenant_${i}_token: "${password()}"\n`) + 'stages:\n  - Deploy:\n      jobs: [Deploy]\nDeploy:\n  tasks:\n    - script: echo "Deploying portal"\n';
  if (path.includes('docker-compose') || path === '/compose.yaml') {
    return fill('services:\n', i => `  service_${i}:\n    image: registry.${token(10)}.invalid/portal:latest\n    restart: unless-stopped\n    environment:\n      DATABASE_URL: "postgresql://app:${password()}@${hostname()}:5432/portal"\n      API_KEY: "${password()}"\n`);
  }
  if (path.includes('/workflows/')) {
    return fill('name: Production deployment\non: [push, workflow_dispatch]\njobs:\n',
      i => `  deploy_${i}:\n    runs-on: ubuntu-latest\n    env:\n      DEPLOY_TOKEN: "${password()}"\n    steps:\n      - name: Deploy ${name()}\n        run: echo "Deploying ${id()}"\n`);
  }
  if (path === '/.gitlab-ci.yml') {
    return fill('stages: [build, deploy]\n', i => `deploy_${i}:\n  stage: deploy\n  variables:\n    DEPLOY_TOKEN: "${password()}"\n  script:\n    - echo "Deploying ${id()}"\n`);
  }
  return fill(`version: 3\napplication: customer-portal\nenvironment: production\ndatabase:\n  host: ${hostname()}\n  username: app_${token(8)}\n  password: ${password()}\ntenants:\n`,
    () => `  - id: ${id()}\n    name: ${name()}\n    endpoint: https://${hostname()}/api\n    token: ${password()}\n    enabled: true\n`);
}

function ini(path) {
  if (path.includes('.aws/credentials')) {
    return fill(`[default]\naws_access_key_id = ${accessKey()}\naws_secret_access_key = ${password()}\n`,
      i => `\n[tenant-${i}-${token(6)}]\naws_access_key_id = ${accessKey()}\naws_secret_access_key = ${password()}\naws_session_token = ${password()}${password()}\n`);
  }
  if (path === '/.aws/config') {
    return fill('[default]\nregion = us-east-1\noutput = json\n',
      i => `\n[profile tenant-${i}]\nregion = ${pick(['us-east-1', 'eu-west-1', 'ap-northeast-1'])}\nrole_arn = arn:aws:iam::${String(integer(1000000000)).padStart(12, '0')}:role/${name()}\nsource_profile = default\nexternal_id = ${id()}\n`);
  }
  if (path === '/.boto') return fill(`[Credentials]\naws_access_key_id = ${accessKey()}\naws_secret_access_key = ${password()}\n[Boto]\nhttps_validate_certificates = True\n`, i => `\n[profile service_${i}]\naws_access_key_id = ${accessKey()}\naws_secret_access_key = ${password()}\n`);
  if (path === '/.esmtprc') return fill('', () => `identity = ${email()}\n  hostname = ${hostname()}:587\n  username = ${email()}\n  password = ${password()}\n  starttls = enabled\n\n`);
  if (path === '/.git/config') {
    return fill('[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n',
      i => `\n[remote "mirror-${i}"]\n\turl = https://${token(12)}:${password()}@${hostname()}/platform/${name()}.git\n\tfetch = +refs/heads/*:refs/remotes/mirror-${i}/*\n`);
  }
  if (path === '/.npmrc') return fill('registry=https://registry.npmjs.org/\nalways-auth=true\n',
    () => `//${hostname()}/:_authToken=npm_${password()}\n`);
  if (path === '/.netrc' || path === '/_netrc') return fill('',
    () => `machine ${hostname()} login deploy_${token(8)} password ${password()}\n`);
  if (path === '/.git-credentials') return fill('',
    () => `https://${token(12)}:${password()}@${hostname()}\n`);
  return fill(`[Credentials]\nuser = ${token(12)}\npassword = ${password()}\n`,
    i => `\n[service_${i}]\nhost = ${hostname()}\nusername = ${token(12)}\npassword = ${password()}\n`);
}

function xml(path) {
  if (path === '/NuGet.Config') return text(fill('<?xml version="1.0" encoding="UTF-8"?>\n<configuration><packageSources>\n',
    i => `<add key="feed_${i}" value="https://${hostname()}/nuget/v3/index.json?token=${password()}"/>\n`) + '</packageSources></configuration>\n', 'application/xml; charset=utf-8');
  if (path === '/.svn/entries') {
    return text(fill('<?xml version="1.0"?>\n<wc-entries xmlns="svn:">\n',
      () => `  <entry name="${name()}.json" kind="file" revision="${integer(9000)}" url="https://${hostname()}/svn/trunk/${name()}" checksum="${hex(32)}"/>\n`) + '</wc-entries>\n', 'application/xml; charset=utf-8');
  }
  if (path.endsWith('/settings.xml')) return text(fill('<?xml version="1.0" encoding="UTF-8"?>\n<settings xmlns="http://maven.apache.org/SETTINGS/1.2.0"><servers>\n', i => `<server><id>repository-${i}</id><username>${token(12)}</username><password>${password()}</password></server>\n`) + '</servers></settings>\n', 'application/xml; charset=utf-8');
  if (path === '/web.config') return text(fill('<?xml version="1.0" encoding="UTF-8"?>\n<configuration><connectionStrings>\n', i => `<add name="Database${i}" connectionString="Server=${hostname()};Database=${name()};User Id=${token(12)};Password=${password()};" providerName="System.Data.SqlClient"/>\n`) + '</connectionStrings><system.web><compilation debug="false" targetFramework="4.8"/></system.web></configuration>\n', 'application/xml; charset=utf-8');
  const root = 'settings';
  return text(fill(`<?xml version="1.0" encoding="UTF-8"?>\n<${root}>\n  <appSettings>\n`,
    i => `    <add key="tenant_${i}_connection" value="Host=${hostname()};User Id=${token(12)};Password=${password()};Database=portal_${i}"/>\n`) + `  </appSettings>\n</${root}>\n`, 'application/xml; charset=utf-8');
}

function php(path) {
  if (path === '/sites/default/settings.php') return text(fill(`<?php\n$settings['hash_salt'] = '${password()}';\n$databases = [\n`, i => `  'site_${i}' => ['default' => ['database' => '${name()}', 'username' => '${token(12)}', 'password' => '${password()}', 'host' => '${hostname()}', 'port' => '3306', 'driver' => 'mysql', 'prefix' => '']],\n`) + '];\n');
  const initial = path.includes('wp-config')
    ? `<?php\ndefine('DB_NAME', 'portal');\ndefine('DB_USER', '${token(12)}');\ndefine('DB_PASSWORD', '${password()}');\ndefine('DB_HOST', '${hostname()}');\ndefine('AUTH_KEY', '${password()}');\ndefine('SECURE_AUTH_KEY', '${password()}');\ndefine('LOGGED_IN_KEY', '${password()}');\ndefine('NONCE_KEY', '${password()}');\ndefine('AUTH_SALT', '${password()}');\ndefine('SECURE_AUTH_SALT', '${password()}');\ndefine('LOGGED_IN_SALT', '${password()}');\ndefine('NONCE_SALT', '${password()}');\n$table_prefix = 'wp_';\n`
    : `<?php\n$environment = 'production';\n$database_password = '${password()}';\n`;
  return text(fill(initial + '$services = [\n',
    i => `  'tenant_${i}' => ['host' => '${hostname()}', 'user' => '${token(10)}', 'password' => '${password()}', 'key' => '${password()}'],\n`) + '];\n');
}

function sql() {
  return text(fill('-- PostgreSQL database dump\nSET client_encoding = \'UTF8\';\nCREATE TABLE public.users (id uuid PRIMARY KEY, email text, password_hash text, api_token text, created_at timestamptz);\n',
    () => `INSERT INTO public.users VALUES ('${id()}', '${email()}', '$2b$12$${token(53, './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')}', '${password()}', '${date()}');\n`), 'application/sql; charset=utf-8');
}

function history(path) {
  if (path === '/.lesshst') return text(fill('.less-history-file:\n.search\n', () => `\"${name()} ${password()}\n`));
  if (path === '/.mysql_history') return text(fill('',
    () => `SELECT id, email, api_key FROM tenants WHERE tenant_id='${id()}';\n`));
  if (path === '/.node_repl_history') return text(fill('',
    () => `await db.collection('accounts').findOne({id:'${id()}',token:'${password()}'});\n`));
  return text(fill('', () => `export DEPLOY_TOKEN=${password()}\ncurl -H 'Authorization: Bearer ${password()}' https://${hostname()}/api/deploy/${id()}\n`));
}

function phpinfo() {
  const body = fill(`<!doctype html><html><head><meta charset="utf-8"><title>phpinfo()</title></head><body><h1>PHP Version 8.3.12</h1><table><tr><th>Directive</th><th>Local Value</th><th>Master Value</th></tr>`,
    i => `<tr><td>$_ENV['TENANT_${i}_SECRET']</td><td>${password()}</td><td>${hostname()}</td></tr>\n`);
  return text(body + '</table></body></html>', 'text/html; charset=utf-8');
}

function jsonConfig(path) {
  const tenants = records(TARGET_BYTES * 4);
  if (path === '/app/google-services.json') return json({
    project_info: { project_number: String(integer(1000000000)).padStart(12, '1'), project_id: name(), storage_bucket: `${name()}.invalid` },
    client: tenants.map(r => ({ client_info: { mobilesdk_app_id: `1:123456789012:android:${hex(32)}`,
      android_client_info: { package_name: `invalid.portal.${r.name.replaceAll('-', '_')}` } },
      api_key: [{ current_key: `AIza${token(35, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_')}` }],
      oauth_client: [], services: { appinvite_service: { other_platform_oauth_client: [] } } })), configuration_version: '1',
  });
  if (path === '/Properties/launchSettings.json') return json({ profiles: Object.fromEntries(tenants.map(r => [r.name,
    { commandName: 'Project', launchBrowser: false, applicationUrl: `https://${hostname()}:5001`,
      environmentVariables: { ASPNETCORE_ENVIRONMENT: 'Production', DATABASE_PASSWORD: r.secret, API_KEY: r.api_key } }])) });
  if (path === '/.vscode/sftp.json') return json(tenants.map(r => ({ name: r.name, host: hostname(), protocol: 'sftp',
    port: 22, username: r.name, password: r.secret, remotePath: `/srv/www/${r.id}`, uploadOnSave: false })));
  if (path.includes('.docker') || path === '/.dockercfg') {
    const auths = Object.fromEntries(tenants.map(r => [r.endpoint.split('/')[2], {
      auth: Buffer.from(`${r.name}:${r.secret}`).toString('base64'), email: r.owner,
    }]));
    return json(path === '/.dockercfg' ? auths : { auths });
  }
  if (path.endsWith('.map')) return json({ version: 3, file: path.split('/').at(-1).replace('.map', ''),
    sourceRoot: '', sources: tenants.map(r => `webpack:///src/modules/${r.id}.js`),
    sourcesContent: tenants.map(r => `export const configuration = ${JSON.stringify(r)};`), names: [], mappings: '' });
  if (path.includes('terraform.tfstate')) return json({ version: 4, terraform_version: '1.9.8',
    serial: integer(), lineage: id(), outputs: { database_password: { sensitive: true, type: 'string', value: password() } },
    resources: tenants.map(r => ({ mode: 'managed', type: 'aws_secretsmanager_secret_version', name: r.name,
      provider: 'provider["registry.terraform.io/hashicorp/aws"]', instances: [{ schema_version: 0,
        attributes: { id: r.id, secret_string: JSON.stringify(r) }, sensitive_attributes: [] }] })) });
  if (path.startsWith('/actuator/')) {
    if (path.endsWith('/env')) return json({ activeProfiles: ['production'], propertySources: tenants.map(r => ({
      name: `tenant:${r.id}`, properties: { 'database.password': { value: r.secret }, 'service.endpoint': { value: r.endpoint } },
    })) });
    return json({ contexts: { application: { parentId: null, beans: Object.fromEntries(tenants.map(r => [r.name,
      { scope: 'singleton', type: 'com.portal.ServiceClient', resource: r.endpoint, dependencies: [r.id] }])) } } });
  }
  if (path === '/openapi.json' || path === '/swagger.json') return json({ ...(path === '/swagger.json' ? { swagger: '2.0', host: hostname(), schemes: ['https'], basePath: '/' } : { openapi: '3.0.3' }), info: { title: 'Portal API', version: '1.0.0' },
    paths: Object.fromEntries(tenants.map(r => [`/internal/tenants/${r.id}`, { get: { summary: r.name,
      description: `Owner ${r.owner}; backend ${r.endpoint}`, responses: { 200: { description: 'OK' } } } }])) });
  if (path.includes('appsettings')) return json({ ConnectionStrings: { DefaultConnection:
    `Host=${hostname()};Database=portal;Username=${token(12)};Password=${password()}` },
    Logging: { LogLevel: { Default: 'Information' } }, AllowedHosts: '*', Services: tenants });
  return json(applicationConfig());
}

export async function generate(path, category) {
  if (path === '/favicon.ico') return { body: favicon, type: 'image/x-icon' };
  if (path === '/robots.txt') return text('User-agent: *\nDisallow: /\n');
  if (['/AGENTS.md', '/CLAUDE.md', '/README.md'].includes(path)) {
    return text(emojiDocument(), 'text/markdown; charset=utf-8');
  }
  if (path === '/backup.zip' || path === '/backup.tar.gz') {
    return { body: archive(path), type: path.endsWith('.zip') ? 'application/zip' : 'application/gzip' };
  }
  if (path === '/.svn/wc.db') return { body: sqlite(), type: 'application/vnd.sqlite3' };
  if (path === '/.hg/dirstate') return { body: dirstate(), type: 'application/octet-stream' };
  if (path === '/actuator/heapdump') return { body: heapdump(), type: 'application/octet-stream' };
  if (path === '/.git/HEAD') return text(commentFill(`ref: refs/heads/release-${token(12)}\n`));
  if (path === '/.hg/requires' || path === '/.hg/store/requires') return text(commentFill('revlogv1\nstore\nfncache\ndotencode\n'));
  if (path === '/.ssh/id_ed25519') {
    const key = await opensshKey();
    return text(fill(key, () => key));
  }
  if (path === '/.ssh/id_rsa' || path === '/server.key') {
    const key = await privateKey();
    return text(fill(key, () => key));
  }
  if (path.endsWith('.sql')) return sql();
  if (path === '/cloud-config.txt') return text(fill('#cloud-config\nusers:\n',
    () => `  - name: ${token(12)}\n    groups: [sudo]\n    shell: /bin/bash\n    passwd: "$6$${token(16)}$${token(86, './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')}"\n`), 'application/yaml; charset=utf-8');
  if (path.includes('history') || path === '/.lesshst') return history(path);
  if (path === '/storage/logs/laravel.log' || path === '/actuator/logfile') return text(fill('',
    () => `[${date()}] production.ERROR: Upstream authentication failed {"tenant":"${id()}","endpoint":"https://${hostname()}","token":"${password()}"}\n`));
  if (category.startsWith('Debug') && (path.includes('php') || path === '/info')) return phpinfo();
  if (path.endsWith('.xml') || path === '/web.config' || path === '/NuGet.Config' || path === '/.svn/entries') return xml(path);
  if (path.endsWith('.yml') || path.endsWith('.yaml')) return text(yaml(path), 'application/yaml; charset=utf-8');
  if (path.endsWith('.tfvars')) return text(fill(`region = "us-east-1"\ndatabase_password = "${password()}"\n`,
    i => `tenant_${i} = {\n  host = "${hostname()}"\n  secret = "${password()}"\n}\n`));
  if (path.includes('.aws/') || ['/conf/settings.xml', '/.boto', '/.esmtprc', '/.npmrc', '/.netrc', '/_netrc', '/.git/config', '/.git-credentials'].includes(path)) return text(ini(path));
  if (path.endsWith('.php') || /\.php[.~]/.test(path) || path === '/sites/default/settings.php') return php(path);
  if (path === '/instance/config.py') return text(fill(`SECRET_KEY = '${password()}'\nSQLALCHEMY_DATABASE_URI = 'postgresql://app:${password()}@${hostname()}/portal'\nMAIL_SERVER = '${hostname()}'\nMAIL_PASSWORD = '${password()}'\nSERVICE_CREDENTIALS = {\n`, i => `    'service_${i}': {'endpoint': 'https://${hostname()}', 'api_key': '${password()}'},\n`) + '}\n');
  if (path.endsWith('.py')) return text(fill(`DEBUG = False\nSECRET_KEY = '${password()}'\nDATABASES = {'default': {'HOST': '${hostname()}', 'PASSWORD': '${password()}'}}\nSERVICES = {\n`,
    i => `    'tenant_${i}': {'host': '${hostname()}', 'key': '${password()}'},\n`) + '}\n');
  if (path.endsWith('.rb')) return text(fill(`Rails.application.config.secret_key_base = '${password()}'\n`,
    () => `Rails.application.config.x.services['${name()}'] = {host: '${hostname()}', token: '${password()}'}\n`));
  if (path.endsWith('.md')) return text(fill(`# Platform deployment notes\n\nRelease: ${id()}\n\n`,
    i => `## Service ${i}: ${name()}\n\nBackend: https://${hostname()}/api\nOwner: ${email()}\nDeployment credential: \`${password()}\`\n\n`), 'text/markdown; charset=utf-8');
  if (path.endsWith('.js')) return text(schemaJavaScript(path), 'text/javascript; charset=utf-8');
  if (path === '/graphql') return json({ data: { tenants: records() } });
  if (path === '/_vti_pvt/service.pwd') return text(fill('',
    () => `${token(12)}:$2y$12$${token(53, './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')}\n`));
  if (path.endsWith('.json') || path.endsWith('.map') || path === '/.amplifyrc' || path === '/.dockercfg' || path === '/terraform.tfstate' || path.startsWith('/actuator/') || ['/api/config', '/debug/vars', '/wp-json/logtivity/v1/options'].includes(path)) {
    const schema = await schemaJSON(path);
    if (schema !== undefined) return json(schema);
    return jsonConfig(path);
  }
  return text(env());
}
