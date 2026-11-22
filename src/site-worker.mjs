const CANONICAL_HOST = 'createmore.asia';
const APP_ORIGIN = 'https://app.createmore.asia';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === 'www.createmore.asia') {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === '/app' || url.pathname.startsWith('/app/')) {
      const path = url.pathname.replace(/^\/app(?=\/|$)/, '') || '/';
      const destination = new URL(path, APP_ORIGIN);
      destination.search = url.search;
      return Response.redirect(destination.toString(), 302);
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
