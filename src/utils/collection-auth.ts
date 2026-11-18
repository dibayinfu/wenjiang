import { reactive } from 'vue';
import { CollectionApi } from './collection-api.ts';

const TOKEN_KEY = 'wenjiang:collection-api-token';
function readToken() {
  try { return localStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; }
}
export const collectionAuth = reactive({ token: readToken(), visible: false });
type Waiter = { resolve(): void; reject(error: Error): void };
const waiters = new Set<Waiter>();

export function clearCollectionToken() {
  collectionAuth.token = '';
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* 内存状态仍清除 */ }
}
export function completeCollectionLogin(token: string) {
  if (!token.trim()) throw new Error('登录接口未返回有效 Token。');
  // 只保存 Token，不保存账号密码或短信验证码。
  try { localStorage.setItem(TOKEN_KEY, token); }
  catch { throw new Error('浏览器禁止本地存储，请允许本站保存 Token 后重试。'); }
  collectionAuth.token = token;
  collectionAuth.visible = false;
  for (const waiter of [...waiters]) waiter.resolve();
}
export function cancelCollectionLogin() {
  collectionAuth.visible = false;
  for (const waiter of [...waiters]) waiter.reject(new Error('已取消登录，可重新更新或切换本地数据。'));
}
function requireCollectionLogin(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  collectionAuth.visible = true;
  return new Promise((resolve, reject) => {
    const finish = () => {
      waiters.delete(waiter);
      signal.removeEventListener('abort', abort);
      if (!waiters.size) collectionAuth.visible = false;
    };
    const waiter: Waiter = {
      resolve() { finish(); resolve(); },
      reject(error) { finish(); reject(error); },
    };
    const abort = () => waiter.reject(new DOMException('已取消加载', 'AbortError'));
    waiters.add(waiter);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export const collectionApi = new CollectionApi({
  getToken: () => collectionAuth.token,
  clearToken: clearCollectionToken,
  login: requireCollectionLogin,
});
