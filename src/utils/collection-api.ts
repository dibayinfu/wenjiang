export const COLLECTION_API_BASE = 'https://car.r10iot.com';
export type ApiRow = Record<string, unknown>;

export function isApiObject(value: unknown): value is ApiRow {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export interface CollectionSession {
  getToken(): string;
  clearToken(): void;
  login(signal: AbortSignal): Promise<void>;
}

export class CollectionApi {
  private session: CollectionSession;
  private fetcher: typeof fetch;
  private loginInFlight?: Promise<void>;
  constructor(session: CollectionSession, fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init)) {
    this.session = session;
    this.fetcher = fetcher.bind(globalThis);
  }

  async authenticate(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (this.loginInFlight) {
      try { await this.loginInFlight; }
      catch (error) {
        signal.throwIfAborted();
        if (!(error instanceof Error) || error.name !== 'AbortError') throw error;
        // 旧日期请求取消了登录等待时，新日期可重新发起自己的登录。
      }
    }
    if (!this.session.getToken()) await this.login(signal);
    signal.throwIfAborted();
  }

  private async login(signal: AbortSignal): Promise<void> {
    if (this.loginInFlight) return this.authenticate(signal);
    const pending = this.session.login(signal);
    this.loginInFlight = pending;
    try { await pending; }
    finally { if (this.loginInFlight === pending) this.loginInFlight = undefined; }
  }

  async request(path: string, params: Record<string, string>, signal: AbortSignal, body?: ApiRow, authenticated = true): Promise<ApiRow> {
    let prompted = false;
    if (authenticated && !this.session.getToken()) {
      await this.authenticate(signal);
      prompted = true;
    }
    for (;;) {
      signal.throwIfAborted();
      const url = new URL(path, COLLECTION_API_BASE);
      url.search = new URLSearchParams(params).toString();
      const token = authenticated ? this.session.getToken() : '';
      const headers: Record<string, string> = { 'Accept-Language': 'zh-CN' };
      if (token) { headers.token = token; headers.btoken = token; }
      if (body) headers['Content-Type'] = 'application/json';
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), 30000);
      const abort = () => timeout.abort();
      signal.addEventListener('abort', abort, { once: true });
      let response: Response;
      let payload: unknown;
      try {
        response = await this.fetcher(url, {
          method: body ? 'POST' : 'GET', headers, credentials: 'omit',
          body: body ? JSON.stringify(body) : undefined, signal: timeout.signal,
        });
        const text = await response.text();
        try { payload = JSON.parse(text); } catch { payload = undefined; }
      } catch (error) {
        signal.throwIfAborted();
        if (timeout.signal.aborted) throw new Error('接口请求超时，请重新更新。');
        throw new Error('接口请求失败，请检查网络及接口跨域配置。', { cause: error });
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      }
      signal.throwIfAborted();
      const code = isApiObject(payload) ? Number(payload.code) : NaN;
      if (authenticated && (response.status === 401 || code === 401)) {
        // 其他并发请求已完成登录时，先使用新 Token，避免旧响应清除新会话。
        if (!prompted && token !== this.session.getToken() && this.session.getToken()) {
          prompted = true;
          continue;
        }
        this.session.clearToken();
        if (prompted) throw new Error('登录状态无效，请重新登录后更新。');
        await this.login(signal);
        prompted = true;
        continue;
      }
      if (!response.ok || !isApiObject(payload) || ![0, 200].includes(code)) {
        const message = isApiObject(payload) ? payload.msg ?? payload.message : undefined;
        throw new Error(typeof message === 'string' ? message : `接口返回异常（HTTP ${response.status}）。`);
      }
      if (authenticated && this.loginInFlight) await this.authenticate(signal);
      return payload;
    }
  }

  async all(path: string, params: Record<string, string>, signal: AbortSignal, progress?: (count: number, total?: number) => void, field: 'list' | 'positions' = 'list', onPage?: (rows: ApiRow[], total?: number) => void): Promise<ApiRow[]> {
    const rows: ApiRow[] = [];
    const pages = new Set<string>();
    const ids = new Set<string>();
    let expected: number | undefined;
    for (let page = 1; page <= 10000; page++) {
      const payload = await this.request(path, { ...params, isExport: 'false', pageNum: String(page), pageSize: '5000' }, signal);
      const data = payload.data;
      const list = Array.isArray(data) ? data : isApiObject(data) ? data[field] : undefined;
      if (!Array.isArray(list) || !list.every(isApiObject)) throw new Error(`${path} 未返回有效的数据列表。`);
      const rawTotal = isApiObject(data) ? data.totalCount ?? data.total : undefined;
      const total = rawTotal === undefined ? undefined : Number(rawTotal);
      if (total !== undefined && (!Number.isSafeInteger(total) || total < 0)) throw new Error('接口分页总数无效。');
      if (expected !== undefined && total !== expected) throw new Error('分页期间数据总数发生变化，请重新更新。');
      expected = total;
      if (isApiObject(data) && data.currPage !== undefined && Number(data.currPage) !== page) throw new Error('接口返回页码与请求不一致，无法确认数据完整性。');
      if (list.length) {
        const fingerprint = JSON.stringify(list);
        if (pages.has(fingerprint)) throw new Error('接口重复返回同一页，无法确认数据完整性。');
        pages.add(fingerprint);
        for (const row of list) {
          if (row.id === undefined || row.id === null) continue;
          const id = String(row.id);
          if (ids.has(id)) throw new Error('接口分页存在重复记录，请重新更新。');
          ids.add(id);
        }
        rows.push(...list);
      }
      if (expected !== undefined && rows.length > expected) throw new Error('接口数据条数超过分页总数，请重新更新。');
      if (!list.length && expected !== undefined && rows.length !== expected) throw new Error('分页数据未取完整，请重新更新。');
      if (list.length || page === 1) onPage?.([...rows], expected);
      progress?.(rows.length, expected);
      if (expected !== undefined && rows.length === expected) return rows;
      if (!list.length) {
        if (expected !== undefined && rows.length !== expected) throw new Error('分页数据未取完整，请重新更新。');
        return rows;
      }
      // 数组响应是无分页的全集；对象列表无总数时继续取到空页，兼容服务端限制 pageSize。
      if (Array.isArray(data)) return rows;
      // 现网轨迹默认一次返回 positions；若提供分页总数，仍逐页取完整。
      if (field === 'positions' && expected === undefined) return rows;
    }
    throw new Error('接口分页次数异常，已停止加载。');
  }
}
