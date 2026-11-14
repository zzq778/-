/* 吉政知行 · 个人信息模块（v0.5）
   在「我的」里增加一栏「个人信息」：性别、年龄用滚轮选择，
   手机号、职业、单位直接填写。资料只写入本机 localStorage，
   不上传服务器，也不会随 /api/chat 的提问发送。
   独立成文件的原因：app.js 已经很长，个人信息是纯本地功能，
   与 AI 导办链路无关，单独维护更方便按分支合并。
*/
(() => {
  'use strict';
  if (window.JZZX_PROFILE) return;

  const KEY = 'jzzx-profile-v01';
  const GENDERS = ['男', '女', '不便透露'];
  const UNSET = '未填写';
  const AGES = Array.from({ length: 120 }, (_, i) => String(i + 1));
  const STEP = 44; // 与 .wheel-option 的高度一致，滚轮按行吸附
  const PHONE = /^1[3-9]\d{9}$/;
  const LABELS = { gender: '性别', age: '年龄', phone: '手机号', job: '职业', unit: '单位' };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const blank = () => ({ gender: '', age: null, phone: '', job: '', unit: '' });

  // 读取时逐字段校正，避免旧数据或手改 localStorage 把非法值带进界面
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
      const age = Number(raw.age);
      return {
        gender: GENDERS.includes(raw.gender) ? raw.gender : '',
        age: Number.isInteger(age) && age >= 1 && age <= 120 ? age : null,
        phone: PHONE.test(String(raw.phone || '')) ? String(raw.phone) : '',
        job: text(raw.job, 20),
        unit: text(raw.unit, 30)
      };
    } catch {
      return blank();
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        gender: GENDERS.includes(data.gender) ? data.gender : '',
        age: data.age ?? null,
        phone: String(data.phone || ''),
        job: text(data.job, 20),
        unit: text(data.unit, 30)
      }));
      return true;
    } catch {
      return false; // 隐私模式或本地文件可能没有存储权限，界面仍然可用，只是不落盘
    }
  }

  // 设置栏副标题：只显示性别、年龄、职业、单位，手机号不在入口外露
  function summary(p) {
    const bits = [p.gender, p.age ? `${p.age} 岁` : '', p.job, p.unit].filter(Boolean);
    return bits.length ? bits.join(' · ') : '性别、年龄、手机号、职业、单位';
  }

  function validate(v) {
    if (v.phone && !PHONE.test(v.phone)) return { ok: false, error: '手机号应为 11 位有效号码，或留空' };
    if (v.age !== null && !(v.age >= 1 && v.age <= 120)) return { ok: false, error: '年龄需在 1 到 120 之间' };
    return { ok: true, value: v };
  }

  function wheel(field, options, value, unsetLabel) {
    const items = (unsetLabel ? [{ v: '', t: unsetLabel }] : []).concat(options.map((o) => ({ v: o, t: o })));
    const body = items.map((it) => `<button type="button" class="wheel-option" role="option" data-value="${esc(it.v)}" aria-selected="false">${esc(it.t)}</button>`).join('');
    return `<div class="wheel-row"><div class="wheel" data-wheel="${field}" data-value="${esc(value)}" role="listbox" aria-label="${LABELS[field]}" tabindex="0"><span class="wheel-pad" aria-hidden="true"></span>${body}<span class="wheel-pad" aria-hidden="true"></span></div><span class="wheel-band" aria-hidden="true"></span></div>`;
  }

  function sheet() {
    const p = load();
    const close = '<button type="button" class="close-round" data-action="modal-close" aria-label="关闭"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5 19 19M19 5 5 19"/></svg></button>';
    return `<div class="sheet-header"><strong>个人信息</strong>${close}</div>
      <p class="sheet-desc">只保存在这台设备的浏览器里，不上传服务器，也不随 AI 提问发送；随时可以修改。</p>
      <form id="personalForm" class="personal-form" novalidate>
        <div class="personal-field"><span>性别</span>${wheel('gender', GENDERS, p.gender, UNSET)}</div>
        <div class="personal-field"><span>年龄</span>${wheel('age', AGES, p.age === null ? '' : String(p.age), UNSET)}</div>
        <label class="personal-field"><span>手机号</span><input class="input-row" name="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="11" placeholder="选填，11 位手机号" value="${esc(p.phone)}" /></label>
        <label class="personal-field"><span>职业</span><input class="input-row" name="job" maxlength="20" placeholder="例如：学生、教师、退休人员" value="${esc(p.job)}" /></label>
        <label class="personal-field"><span>单位</span><input class="input-row" name="unit" maxlength="30" placeholder="例如：吉林大学、某社区服务中心" value="${esc(p.unit)}" /></label>
        <button class="primary" type="submit">保存个人信息</button>
        <p class="sheet-legal">演示资料：不做真实性校验，也不作为任何办事凭证；清除站点数据即删除。</p>
      </form>`;
  }

  // 把静态标记变成可滚动的滚轮：吸附到整行、高亮居中项、支持键盘上下键
  function enhance(root) {
    if (!root) return;
    root.querySelectorAll('[data-wheel]').forEach((el) => {
      const options = [...el.querySelectorAll('.wheel-option')];
      if (!options.length) return;
      let current = 0;
      const apply = (index) => {
        current = Math.min(options.length - 1, Math.max(0, index));
        options.forEach((o, i) => {
          const on = i === current;
          o.classList.toggle('on', on);
          o.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        el.dataset.value = options[current].dataset.value || '';
      };
      const place = (index, smooth) => {
        const top = index * STEP;
        if (smooth && el.scrollTo) el.scrollTo({ top, behavior: 'smooth' });
        else el.scrollTop = top;
        apply(index);
      };
      const sync = () => apply(Math.round(el.scrollTop / STEP));
      const start = Math.max(0, options.findIndex((o) => (o.dataset.value || '') === (el.dataset.value || '')));
      el.scrollTop = start * STEP;
      apply(start);
      // 字体或弹层动画可能改变布局，下一帧再定位一次
      requestAnimationFrame(() => { el.scrollTop = start * STEP; sync(); });
      let frame = 0;
      el.addEventListener('scroll', () => {
        if (frame) return;
        frame = requestAnimationFrame(() => { frame = 0; sync(); });
      }, { passive: true });
      options.forEach((o, i) => o.addEventListener('click', () => place(i, true)));
      el.addEventListener('keydown', (e) => {
        const step = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }[e.key];
        if (step) { e.preventDefault(); place(current + step, true); }
        else if (e.key === 'Home') { e.preventDefault(); place(0, true); }
        else if (e.key === 'End') { e.preventDefault(); place(options.length - 1, true); }
      });
    });
    const phone = root.querySelector('input[name="phone"]');
    if (phone) phone.addEventListener('input', () => {
      const digits = phone.value.replace(/\D/g, '').slice(0, 11);
      if (digits !== phone.value) phone.value = digits;
    });
  }

  function read(root) {
    if (!root) return { ok: false, error: '个人信息模块未加载' };
    const form = root.querySelector('#personalForm');
    if (!form) return { ok: false, error: '表单未渲染，请重新打开' };
    const picked = (field) => {
      const el = root.querySelector(`[data-wheel="${field}"]`);
      return el ? (el.dataset.value || '') : '';
    };
    const field = (name) => String(form.elements?.[name]?.value ?? '');
    const gender = picked('gender');
    return validate({
      gender: GENDERS.includes(gender) ? gender : '',
      age: picked('age') ? Number(picked('age')) : null,
      phone: field('phone').replace(/\D/g, '').slice(0, 11),
      job: text(field('job'), 20),
      unit: text(field('unit'), 30)
    });
  }

  window.JZZX_PROFILE = Object.freeze({ KEY, GENDERS, AGES, UNSET, STEP, load, save, summary, validate, sheet, enhance, read });
})();
