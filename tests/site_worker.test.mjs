import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/site-worker.mjs';

function environment() {
  const requests = [];
  return {
    requests,
    ASSETS: {
      fetch: async request => {
        requests.push(request.url);
        return new Response('static asset', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      }
    }
  };
}

test('serves the static website and adds baseline security headers', async () => {
  const env = environment();
  const response = await worker.fetch(new Request('https://createmore.asia/'), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'static asset');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(env.requests.length, 1);
});

test('redirects www to the canonical apex host and preserves path and query', async () => {
  const env = environment();
  const response = await worker.fetch(new Request('https://www.createmore.asia/features/?from=share'), env);
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), 'https://createmore.asia/features/?from=share');
  assert.equal(env.requests.length, 0);
});

test('redirects the /app entry to the dedicated application subdomain', async () => {
  const env = environment();
  const response = await worker.fetch(new Request('https://createmore.asia/app'), env);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://app.createmore.asia/');
  assert.equal(env.requests.length, 0);
});

test('preserves nested application paths and query parameters', async () => {
  const env = environment();
  const response = await worker.fetch(new Request('https://createmore.asia/app/api/chat?mode=wenlv'), env);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://app.createmore.asia/api/chat?mode=wenlv');
  assert.equal(env.requests.length, 0);
});
