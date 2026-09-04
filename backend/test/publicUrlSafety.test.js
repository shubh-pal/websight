const test = require('node:test');
const assert = require('node:assert/strict');
const { assertSafePublicUrl, parsePublicUrl } = require('../services/publicUrlSafety');

test('accepts a public HTTPS URL', async () => {
  const url = await assertSafePublicUrl('https://example.com/path', async () => [{ address: '93.184.216.34', family: 4 }]);
  assert.equal(url.href, 'https://example.com/path');
});

test('rejects credentials and non-HTTP protocols', () => {
  assert.throws(() => parsePublicUrl('https://user:pass@example.com'), /credentials/);
  assert.throws(() => parsePublicUrl('file:///etc/passwd'), /http or https/);
});

test('rejects local and private-network targets', async () => {
  assert.throws(() => parsePublicUrl('http://localhost:3000'), /public host/);
  await assert.rejects(
    assertSafePublicUrl('https://example.com', async () => [{ address: '10.0.0.1', family: 4 }]),
    /public IP addresses/
  );
});
