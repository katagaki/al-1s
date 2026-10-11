import { Buffer } from 'node:buffer';

// Every value is fabricated. No environment variables or remote data are read.
const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
let entropy = new Uint8Array(0);
let entropyOffset = 0;
export const TARGET_BYTES = 128 * 1024;
export const HTML_BYTES = 32 * 1024;
export const EMOJI_BYTES = 1024 * 1024;

export function emojiDocument() {
  // Each symbol is one four-byte Unicode code point, avoiding broken surrogates.
  const symbols = ['😀', '😎', '🤖', '👻', '🐱', '🦊', '🐼', '🐙', '🌸', '🌈', '🍉', '🍕', '🎲', '🚀', '🔥', '💎'];
  return fill('', () => Array.from(token(1024, '0123456789abcdef'),
    c => symbols[parseInt(c, 16)]).join(''), EMOJI_BYTES);
}

export function token(length = 32, characters = alphabet) {
  if (entropyOffset + length > entropy.length) {
    entropy = crypto.getRandomValues(new Uint8Array(65536));
    entropyOffset = 0;
  }
  const bytes = entropy.subarray(entropyOffset, entropyOffset + length);
  entropyOffset += length;
  return Array.from(bytes, value => characters[value % characters.length]).join('');
}

export const id = () => crypto.randomUUID();
export const hex = (length = 40) => token(length, '0123456789abcdef');
export const pick = values => values[crypto.getRandomValues(new Uint32Array(1))[0] % values.length];
export const integer = (max = 100000) => crypto.getRandomValues(new Uint32Array(1))[0] % max;
const dictionary = [
  'atlas', 'harbor', 'cedar', 'quartz', 'meridian', 'acorn', 'alder', 'alpine',
  'amber', 'anchor', 'apex', 'arbor', 'arch', 'aspen', 'aurora', 'avenue',
  'banyan', 'basalt', 'bay', 'beacon', 'birch', 'blossom', 'boulder', 'bridge',
  'brook', 'canyon', 'cascade', 'catalyst', 'citadel', 'clover', 'cobalt', 'comet',
  'compass', 'coral', 'cove', 'crest', 'cypress', 'delta', 'dune', 'echo',
  'elm', 'ember', 'estuary', 'evergreen', 'falcon', 'fern', 'fjord', 'flint',
  'forest', 'frost', 'garden', 'garnet', 'glacier', 'glen', 'granite', 'grove',
  'haven', 'hazel', 'hearth', 'heron', 'horizon', 'indigo', 'iris', 'island',
  'ivy', 'jade', 'jasper', 'juniper', 'lagoon', 'lake', 'lantern', 'laurel',
  'linden', 'lotus', 'lumen', 'maple', 'marble', 'marsh', 'meadow', 'mesa',
  'meteor', 'mist', 'moss', 'nectar', 'nebula', 'oak', 'oasis', 'obsidian',
  'ocean', 'olive', 'onyx', 'opal', 'orbit', 'orchard', 'otter', 'pearl',
  'pebble', 'pine', 'plateau', 'plum', 'prairie', 'prism', 'raven', 'reef',
  'ridge', 'river', 'robin', 'ruby', 'sage', 'sapphire', 'sequoia', 'shore',
  'sierra', 'slate', 'solstice', 'sparrow', 'spruce', 'summit', 'terrace', 'thistle',
  'timber', 'topaz', 'valley', 'violet', 'vista', 'willow', 'wren', 'zephyr',
];
export const name = () => `${pick(dictionary)}-${token(8)}`;
export const hostname = () => `${name()}.internal.invalid`;
export const email = () => `${token(12)}@${name()}.invalid`;
export const date = () => new Date(Date.now() - integer(86400 * 30) * 1000).toISOString();
export const password = () => token(40, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_');
export const accessKey = () => `AKIA${token(16, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')}`;
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);

// Bounded generation makes response cost independent of the requested URL.
export function fill(initial, line, target = TARGET_BYTES) {
  const parts = [initial];
  let size = Buffer.byteLength(initial);
  for (let i = 0; size < target; i++) {
    const value = line(i);
    parts.push(value);
    size += Buffer.byteLength(value);
  }
  return parts.join('');
}

export function records(target = TARGET_BYTES) {
  const result = [];
  let bytes = 0;
  while (bytes < target) {
    const row = {
      id: id(), name: name(), owner: email(), enabled: true,
      endpoint: `https://${hostname()}/v1/${token(12)}`,
      api_key: `sk_live_${password()}`, secret: password(),
      region: pick(['us-east-1', 'eu-west-1', 'ap-northeast-1']),
      created_at: date(), checksum: hex(64),
    };
    bytes += Buffer.byteLength(JSON.stringify(row));
    result.push(row);
  }
  return result;
}
