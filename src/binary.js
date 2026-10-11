import { Buffer } from 'node:buffer';
import { gzipSync } from 'node:zlib';
import sqliteTemplate from './sqlite-template.json' with { type: 'json' };
import { TARGET_BYTES, fill, hex, id, integer, password, token } from './random.js';

const u32 = value => { const b = Buffer.alloc(4); b.writeUInt32BE(value >>> 0); return b; };
const u64 = value => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(value)); return b; };
const sshString = value => { const b = Buffer.from(value); return Buffer.concat([u32(b.length), b]); };
const pem = bytes => `-----BEGIN PRIVATE KEY-----\n${Buffer.from(bytes).toString('base64').match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;

export async function privateKey() {
  const pair = await crypto.subtle.generateKey({
    name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256',
  }, true, ['sign', 'verify']);
  return pem(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
}

export async function opensshKey() {
  const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const pub = Buffer.from(jwk.x, 'base64url');
  const priv = Buffer.from(jwk.d, 'base64url');
  const publicBlob = Buffer.concat([sshString('ssh-ed25519'), sshString(pub)]);
  const check = integer(0xffffffff);
  const inner = Buffer.concat([
    u32(check), u32(check), sshString('ssh-ed25519'), sshString(pub),
    sshString(Buffer.concat([priv, pub])), sshString(`deploy@${token(8)}.invalid`),
  ]);
  const padding = Buffer.from(Array.from({ length: 8 - inner.length % 8 }, (_, i) => i + 1));
  const output = Buffer.concat([
    Buffer.from('openssh-key-v1\0'), sshString('none'), sshString('none'), sshString(''),
    u32(1), sshString(publicBlob), sshString(Buffer.concat([inner, padding])),
  ]);
  return `-----BEGIN OPENSSH PRIVATE KEY-----\n${output.toString('base64').match(/.{1,70}/g).join('\n')}\n-----END OPENSSH PRIVATE KEY-----\n`;
}

function tar(files) {
  const chunks = [];
  for (const [path, text] of Object.entries(files)) {
    const body = Buffer.from(text);
    const header = Buffer.alloc(512);
    header.write(path, 0, 100);
    for (const [offset, length, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000],
      [124, 12, body.length], [136, 12, Math.floor(Date.now() / 1000)]]) {
      header.write(value.toString(8).padStart(length - 1, '0') + '\0', offset, length);
    }
    header.fill(32, 148, 156);
    header[156] = 48;
    header.write('ustar\0', 257); header.write('00', 263);
    header.write('deploy', 265); header.write('deploy', 297);
    header.write(Array.from(header).reduce((a, b) => a + b, 0).toString(8).padStart(6, '0') + '\0 ', 148, 8);
    chunks.push(header, body, Buffer.alloc((512 - body.length % 512) % 512));
  }
  return Buffer.concat([...chunks, Buffer.alloc(1024)]);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const local = [], directory = [];
  let offset = 0;
  for (const [path, text] of Object.entries(files)) {
    const filename = Buffer.from(path), body = Buffer.from(text), checksum = crc32(body);
    const header = Buffer.alloc(30), central = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x21, 12); // 1980-01-01, a valid DOS date.
    header.writeUInt32LE(checksum, 14); header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(body.length, 22); header.writeUInt16LE(filename.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x21, 14); central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(body.length, 20); central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    local.push(header, filename, body); directory.push(central, filename);
    offset += header.length + filename.length + body.length;
  }
  const index = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(index.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, index, end]);
}

export function archive(path) {
  const files = {
    '.env': fill('APP_ENV=production\n', i => `TENANT_${i}_SECRET=${password()}\n`, TARGET_BYTES / 2),
    'config/services.json': JSON.stringify({ deployment: id(), key: password(), services:
      Array.from({ length: 400 }, () => ({ id: id(), secret: password(), endpoint: `${token(12)}.invalid` })) }, null, 2),
    'database/users.sql': fill('CREATE TABLE users (id TEXT, email TEXT, api_key TEXT);\n',
      () => `INSERT INTO users VALUES ('${id()}', '${token(12)}@example.invalid', '${password()}');\n`, TARGET_BYTES / 2),
  };
  let output = path.endsWith('.zip') ? zip(files) : gzipSync(tar(files));
  for (let i = 0; output.length < TARGET_BYTES; i++) {
    files[`config/tenant-secrets-${i}.env`] = fill('', j => `TENANT_${j}_TOKEN=${password()}${password()}\n`);
    output = path.endsWith('.zip') ? zip(files) : gzipSync(tar(files));
  }
  return output;
}

export function sqlite() {
  // Replacing fixed-length TEXT values preserves pages, offsets and a valid database.
  return Buffer.from(Buffer.from(sqliteTemplate, 'base64').toString('latin1')
    .replaceAll('00000000000000000000000000000000', hex(32)), 'latin1');
}

export function dirstate() {
  const parts = [Buffer.from(hex(40) + hex(40), 'hex')];
  let bytes = 40;
  while (bytes < TARGET_BYTES) {
    const filename = Buffer.from(`src/modules/${id()}/settings.json`);
    const header = Buffer.alloc(17);
    header.write('n'); header.writeInt32BE(0o100644, 1);
    header.writeInt32BE(1024 + integer(10000), 5);
    header.writeInt32BE(Math.floor(Date.now() / 1000), 9);
    header.writeInt32BE(filename.length, 13);
    parts.push(header, filename); bytes += header.length + filename.length;
  }
  return Buffer.concat(parts);
}

export function heapdump() {
  const parts = [Buffer.from('JAVA PROFILE 1.0.2\0'), u32(8), u64(Date.now())];
  let size = parts.reduce((n, b) => n + b.length, 0), serial = 1;
  while (size < TARGET_BYTES) {
    const body = Buffer.concat([u64(serial++), Buffer.from(`tenant.${token(16)}.ApiClient.secret=${password()}`)]);
    const header = Buffer.concat([Buffer.from([1]), u32(0), u32(body.length)]);
    parts.push(header, body); size += header.length + body.length;
  }
  // Empty heap segment followed by HEAP_DUMP_END; preceding UTF8 records are valid HPROF.
  parts.push(Buffer.concat([Buffer.from([0x1c]), u32(0), u32(0)]),
    Buffer.concat([Buffer.from([0x2c]), u32(0), u32(0)]));
  return Buffer.concat(parts);
}
