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

test('passes non-app requests through to static assets', async () => {
  const env = environment();
  const response = await worker.fetch(new Request('https://createmore.asia/not-a-file'), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'static asset');
  assert.equal(env.requests.length, 1);
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
