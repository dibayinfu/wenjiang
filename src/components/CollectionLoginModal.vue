<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, watch } from 'vue';
import { collectionApi, collectionAuth, completeCollectionLogin, cancelCollectionLogin } from '../utils/collection-auth';
import { isApiObject } from '../utils/collection-api';

const form = reactive({ username: '', password: '', code: '' });
const phase = ref<'credentials' | 'sms'>('credentials');
const phone = ref('');
const error = ref('');
const notice = ref('');
const busy = ref(false);
const sending = ref(false);
const countdown = ref(0);
let controller = new AbortController();
let interval: ReturnType<typeof setInterval> | undefined;
function stopCountdown() {
  clearInterval(interval);
  interval = undefined;
  countdown.value = 0;
}
watch(() => collectionAuth.visible, visible => {
  controller.abort();
  controller = new AbortController();
  stopCountdown();
  Object.assign(form, { username: '', password: '', code: '' });
  phase.value = 'credentials'; phone.value = ''; error.value = ''; notice.value = '';
  busy.value = false; sending.value = false;
  if (!visible) controller.abort();
});
onBeforeUnmount(() => { controller.abort(); stopCountdown(); cancelCollectionLogin(); });

function credentials() {
  // 与现网登录表单保持一致；无需载入现网 Cookie 或其他项目的凭证。
  const browser = ['Opera', 'Edge', 'Firefox', 'Chrome', 'Safari']
    .map(name => navigator.userAgent.match(new RegExp(`${name}/[\\d.]+`))?.[0])
    .find(Boolean) ?? 'Unknown';
  return { username: form.username.trim(), password: form.password, browser, type: 'USER', from: 'web' };
}
async function submit() {
  if (busy.value || sending.value) return;
  if (!form.username.trim() || !form.password) { error.value = '请输入用户名和密码。'; return; }
  if (phase.value === 'sms' && !/^\d{6}$/.test(form.code)) { error.value = '请输入 6 位短信验证码。'; return; }
  const signal = controller.signal;
  error.value = ''; notice.value = ''; busy.value = true;
  try {
    const body = credentials();
    if (phase.value === 'credentials') {
      const checked = await collectionApi.request('/api/sys/getBindPhone', {}, signal, body, false);
      if (!isApiObject(checked.data)) throw new Error('登录验证接口未返回有效状态，请稍后重试。');
      if (checked.data.isCheckPhone) {
        if (!checked.data.isBindPhone) throw new Error('账号未配置有效手机号，请联系原系统管理员。');
        phone.value = String(checked.data.phone ?? '已绑定手机号');
        phase.value = 'sms';
        return;
      }
    }
    const payload = phase.value === 'sms'
      ? await collectionApi.request('/api/sys/confirmIdentity', {}, signal, { ...body, code: form.code }, false)
      : await collectionApi.request('/api/sys/login', {}, signal, body, false);
    if (!isApiObject(payload.data) || typeof payload.data.token !== 'string') throw new Error('登录接口未返回有效 Token。');
    signal.throwIfAborted();
    completeCollectionLogin(payload.data.token);
  } catch (cause) {
    if (!signal.aborted) error.value = cause instanceof Error ? cause.message : '登录失败，请重试。';
  } finally { if (!signal.aborted) busy.value = false; }
}
async function sendCode() {
  if (countdown.value || sending.value || busy.value) return;
  const signal = controller.signal;
  sending.value = true; error.value = ''; notice.value = '';
  try {
    await collectionApi.request('/api/sys/sendCodeByUsername', {}, signal, credentials(), false);
    signal.throwIfAborted();
    notice.value = '验证码已发送，请查看绑定手机。';
    const until = Date.now() + 60000;
    countdown.value = 60;
    interval = setInterval(() => {
      countdown.value = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      if (!countdown.value) stopCountdown();
    }, 1000);
  } catch (cause) {
    if (!signal.aborted) error.value = cause instanceof Error ? cause.message : '验证码发送失败。';
  } finally { if (!signal.aborted) sending.value = false; }
}
function back() {
  stopCountdown(); phase.value = 'credentials'; form.code = ''; error.value = ''; notice.value = '';
}
</script>

<template>
  <a-modal :visible="collectionAuth.visible" title="登录收运数据平台" :width="440" :footer="false" :mask-closable="false" unmount-on-close @cancel="cancelCollectionLogin">
    <p class="login-tip">登录后在当前浏览器保存 Token，用于读取核验地图数据。</p>
    <a-form :model="form" layout="vertical" @submit-success="submit">
      <a-form-item label="用户名"><a-input v-model="form.username" autocomplete="username" :disabled="busy || phase === 'sms'" placeholder="请输入用户名" /></a-form-item>
      <a-form-item label="密码"><a-input-password v-model="form.password" autocomplete="current-password" :disabled="busy || phase === 'sms'" placeholder="请输入密码" /></a-form-item>
      <template v-if="phase === 'sms'">
        <a-alert>原系统要求短信验证，接收手机：{{ phone }}</a-alert>
        <a-form-item label="短信验证码" class="sms-field">
          <a-input v-model="form.code" :max-length="6" inputmode="numeric" autocomplete="one-time-code" placeholder="请输入 6 位验证码" :disabled="busy" />
          <a-button :loading="sending" :disabled="!!countdown || busy" @click="sendCode">{{ countdown ? `${countdown} 秒后重发` : '获取验证码' }}</a-button>
        </a-form-item>
      </template>
      <a-alert v-if="error" type="error" class="login-feedback">{{ error }}</a-alert>
      <a-alert v-if="notice" type="success" class="login-feedback">{{ notice }}</a-alert>
      <a-button type="primary" html-type="submit" long :loading="busy" :disabled="sending">{{ phase === 'sms' ? '验证并登录' : '登录' }}</a-button>
      <a-button v-if="phase === 'sms'" type="text" long :disabled="busy || sending" @click="back">返回账号登录</a-button>
    </a-form>
  </a-modal>
</template>

<style scoped>
.login-tip { margin-top: 0; color: var(--color-text-2); }
.sms-field { margin-top: 16px; }
.sms-field :deep(.arco-form-item-content-flex) { gap: 8px; }
.login-feedback { margin-bottom: 16px; }
</style>
