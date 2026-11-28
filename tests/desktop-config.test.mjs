import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APP_URL,
  canRequestMicrophone,
  classifyNavigation,
  isSafeExternalUrl,
  isTrustedAppUrl,
} from '../desktop/config.mjs';

test('桌面应用从官网介绍页启动', () => {
  assert.equal(APP_URL, 'https://jizhengzhixing-official.pages.dev/');
});

test('官网和正式、预览助手链接留在桌面应用内', () => {
  const trusted = [
    'https://jizhengzhixing-official.pages.dev/',
    'https://jizhengzhixing-official.pages.dev/features/?from=desktop',
    'https://jizhengzhixing.zedi-li070614.workers.dev/',
    'https://jizhengzhixing-mobile-preview.zedi-li070614.workers.dev/chat',
  ];

  for (const url of trusted) assert.equal(isTrustedAppUrl(url), true, url);
});

test('欺骗性域名和不受信任子域名不能进入桌面应用', () => {
  const untrusted = [
    'https://jizhengzhixing-official.pages.dev.evil.example/',
    'https://evil-jizhengzhixing-official.pages.dev/',
    'https://cdn.jizhengzhixing-official.pages.dev/',
    'https://example.com/?next=jizhengzhixing-official.pages.dev',
  ];

  for (const url of untrusted) assert.equal(isTrustedAppUrl(url), false, url);
});

test('非 HTTPS、带凭据、非默认端口和非法 URL 均被拒绝', () => {
  const untrusted = [
    'http://jizhengzhixing-official.pages.dev/',
    'javascript:alert(1)',
    'file:///C:/Windows/System32/calc.exe',
    'https://user:pass@jizhengzhixing-official.pages.dev/',
    'https://jizhengzhixing-official.pages.dev:8443/',
    'not a url',
    '',
  ];

  for (const url of untrusted) assert.equal(isTrustedAppUrl(url), false, url);
});

test('只有不带凭据的普通 HTTPS 地址可以交给系统浏览器', () => {
  assert.equal(isSafeExternalUrl('https://www.jl.gov.cn/'), true);
  assert.equal(isSafeExternalUrl('https://user:pass@example.com/'), false);
  assert.equal(isSafeExternalUrl('http://example.com/'), false);
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false);
  assert.equal(isSafeExternalUrl('not a url'), false);
});

test('导航策略允许可信页面、外送主框架 HTTPS，并拒绝外部子框架', () => {
  const offlineUrl = 'file:///desktop/offline.html';
  assert.equal(classifyNavigation(APP_URL, true, offlineUrl), 'allow');
  assert.equal(classifyNavigation(offlineUrl, true, offlineUrl), 'allow');
  assert.equal(classifyNavigation('https://www.jl.gov.cn/', true, offlineUrl), 'external');
  assert.equal(classifyNavigation('https://www.jl.gov.cn/', false, offlineUrl), 'deny');
  assert.equal(classifyNavigation('javascript:alert(1)', true, offlineUrl), 'deny');
});

test('只有可信助手来源的纯音频媒体请求可以进入麦克风授权流程', () => {
  const assistant = 'https://jizhengzhixing-mobile-preview.zedi-li070614.workers.dev/chat';
  assert.equal(canRequestMicrophone('media', assistant, ['audio']), true);
  assert.equal(canRequestMicrophone('media', assistant, ['audio', 'video']), false);
  assert.equal(canRequestMicrophone('media', 'https://example.com/', ['audio']), false);
  assert.equal(canRequestMicrophone('geolocation', assistant, []), false);
});
