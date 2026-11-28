export const APP_URL = 'https://jizhengzhixing-official.pages.dev/';

const TRUSTED_HOSTS = new Set([
  'jizhengzhixing-official.pages.dev',
  'jizhengzhixing.zedi-li070614.workers.dev',
  'jizhengzhixing-mobile-preview.zedi-li070614.workers.dev',
]);

export function isTrustedAppUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:'
      && url.username === ''
      && url.password === ''
      && url.port === ''
      && TRUSTED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function isSafeExternalUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:'
      && url.username === ''
      && url.password === '';
  } catch {
    return false;
  }
}
