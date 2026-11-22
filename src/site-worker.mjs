const APP_ORIGIN = 'https://app.createmore.asia';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/app' || url.pathname.startsWith('/app/')) {
      const path = url.pathname.replace(/^\/app(?=\/|$)/, '') || '/';
      const destination = new URL(path, APP_ORIGIN);
      destination.search = url.search;
      return Response.redirect(destination.toString(), 302);
    }

    return env.ASSETS.fetch(request);
  }
};
