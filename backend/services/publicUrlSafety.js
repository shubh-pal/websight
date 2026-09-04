const dns = require('dns').promises;
const net = require('net');

function isPublicIp(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const [a, b] = address.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 0 || b === 168)) return false;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
    if (a === 203 && b === 0 && address.startsWith('203.0.113.')) return false;
    return true;
  }

  if (family === 6) {
    const normalized = address.toLowerCase();
    return normalized !== '::' && normalized !== '::1'
      && !normalized.startsWith('fc')
      && !normalized.startsWith('fd')
      && !normalized.startsWith('fe80:')
      && !normalized.startsWith('::ffff:127.')
      && !normalized.startsWith('::ffff:10.')
      && !normalized.startsWith('::ffff:192.168.');
  }

  return false;
}

function parsePublicUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) {
    throw new Error('url must be a non-empty URL no longer than 2048 characters');
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch (_) {
    throw new Error('url must be a valid absolute URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('url must use http or https');
  }
  if (parsed.username || parsed.password) {
    throw new Error('url must not include credentials');
  }
  if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.localhost')
    || parsed.hostname.endsWith('.local') || parsed.hostname.endsWith('.internal')) {
    throw new Error('url must resolve to a public host');
  }
  if (net.isIP(parsed.hostname) && !isPublicIp(parsed.hostname)) {
    throw new Error('url must resolve to a public IP address');
  }

  return parsed;
}

async function assertSafePublicUrl(value, lookup = dns.lookup) {
  const parsed = parsePublicUrl(value);
  if (net.isIP(parsed.hostname)) return parsed;

  let addresses;
  try {
    addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
  } catch (_) {
    throw new Error('url host could not be resolved');
  }

  if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new Error('url must resolve only to public IP addresses');
  }
  return parsed;
}

module.exports = { assertSafePublicUrl, isPublicIp, parsePublicUrl };
