import { Buffer } from 'node:buffer';
import { TARGET_BYTES, accessKey, email, hex, hostname, id, integer, name, password, token } from './random.js';

// All provider IDs and credentials below are fabricated locally.
export function environment() {
  return {
    APP_NAME: name(), APP_ENV: 'production', APP_DEBUG: 'false',
    APP_KEY: `base64:${Buffer.from(token(32)).toString('base64')}`, APP_URL: `https://${hostname()}`,
    DB_CONNECTION: 'pgsql', DB_HOST: hostname(), DB_PORT: '5432', DB_DATABASE: name(),
    DB_USERNAME: `app_${token(8)}`, DB_PASSWORD: password(),
    DATABASE_URL: `postgresql://app:${password()}@${hostname()}:5432/portal`,
    REDIS_HOST: hostname(), REDIS_PORT: '6379', REDIS_PASSWORD: password(),
    AWS_ACCESS_KEY_ID: accessKey(), AWS_SECRET_ACCESS_KEY: password(), AWS_DEFAULT_REGION: 'us-east-1',
    AWS_BUCKET: name(), MAIL_MAILER: 'smtp', MAIL_HOST: hostname(), MAIL_PORT: '587',
    MAIL_USERNAME: email(), MAIL_PASSWORD: password(), MAIL_ENCRYPTION: 'tls',
    JWT_SECRET: password(), SESSION_SECRET: password(), STRIPE_SECRET_KEY: `sk_live_${password()}`,
    STRIPE_WEBHOOK_SECRET: `whsec_${password()}`, GITHUB_TOKEN: `ghp_${token(36)}`,
    SENTRY_DSN: `https://${hex(32)}@${hostname()}/${integer()}`, ENCRYPTION_KEY: hex(64),
    AZURE_TENANT_ID: id(), AZURE_SUBSCRIPTION_ID: id(), AZURE_CLIENT_ID: id(), AZURE_CLIENT_SECRET: password(),
    AZURE_STORAGE_ACCOUNT: token(20), AZURE_STORAGE_KEY: Buffer.from(token(64)).toString('base64'),
    AZURE_STORAGE_CONNECTION_STRING: `DefaultEndpointsProtocol=https;AccountName=${token(20)};AccountKey=${Buffer.from(token(64)).toString('base64')};EndpointSuffix=${hostname()}`,
    AZURE_OPENAI_API_KEY: hex(32), AZURE_OPENAI_ENDPOINT: `https://${hostname()}/`,
    AZURE_OPENAI_DEPLOYMENT: name(), AZURE_OPENAI_API_VERSION: '2024-10-21',
    AZURE_KEY_VAULT_URL: `https://${hostname()}/`, AZURE_SERVICE_BUS_CONNECTION_STRING:
      `Endpoint=sb://${hostname()}/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=${Buffer.from(token(32)).toString('base64')}`,
    AZURE_COSMOS_ENDPOINT: `https://${hostname()}:443/`, AZURE_COSMOS_KEY: Buffer.from(token(64)).toString('base64'),
    GOOGLE_CLOUD_PROJECT: name(), GCLOUD_PROJECT: name(), GCP_PROJECT_ID: name(),
    GOOGLE_APPLICATION_CREDENTIALS: `/run/secrets/${name()}-service-account.json`,
    GOOGLE_API_KEY: `AIza${token(35, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_')}`,
    GCP_SERVICE_ACCOUNT_EMAIL: `${name()}@${name()}.iam.gserviceaccount.com`, GCP_PRIVATE_KEY_ID: hex(40),
    GCP_CLIENT_ID: `1${token(20, '0123456789')}`, GCP_CLIENT_SECRET: `GOCSPX-${password()}`,
    GCP_REFRESH_TOKEN: `1//${token(120)}`, GCP_STORAGE_BUCKET: name(),
    GEMINI_API_KEY: `AIza${token(35, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_')}`,
    OPENAI_API_KEY: `sk-proj-${token(140, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_')}`,
    OPENAI_ORG_ID: `org-${token(24)}`, OPENAI_PROJECT_ID: `proj_${token(24)}`,
    OPENAI_BASE_URL: `https://${hostname()}/v1`, OPENAI_ADMIN_KEY: `sk-admin-${password()}`,
    ANTHROPIC_API_KEY: `sk-ant-api03-${token(95, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_')}`,
    ANTHROPIC_AUTH_TOKEN: password(), ANTHROPIC_BASE_URL: `https://${hostname()}`,
    ANTHROPIC_WORKSPACE_ID: id(), CLAUDE_API_KEY: `sk-ant-api03-${password()}`,
    CLOUDFLARE_API_TOKEN: password(), CLOUDFLARE_API_KEY: hex(37), CLOUDFLARE_EMAIL: email(),
    CLOUDFLARE_ACCOUNT_ID: hex(32), CLOUDFLARE_ZONE_ID: hex(32),
    CLOUDFLARE_R2_ACCESS_KEY_ID: hex(32), CLOUDFLARE_R2_SECRET_ACCESS_KEY: hex(64),
    CLOUDFLARE_R2_ENDPOINT: `https://${hostname()}`, CLOUDFLARE_TURNSTILE_SECRET_KEY: `0x${hex(38)}`,
  };
}

export function environmentDocument() {
  const value = environment();
  let size = Buffer.byteLength(JSON.stringify(value));
  for (let i = 0; size < TARGET_BYTES; i++) {
    for (const [suffix, content] of Object.entries({ HOST: hostname(), API_KEY: password(), CLIENT_SECRET: password() })) {
      const key = `SERVICE_${i}_${suffix}`;
      value[key] = content;
      size += key.length + content.length + 6;
    }
  }
  return value;
}
