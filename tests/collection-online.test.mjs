import assert from 'node:assert/strict';
import test from 'node:test';
import { CollectionApi } from '../src/utils/collection-api.ts';
import { collectionToday, nextCollectionDate, validateCollectionDate, createCollectionOnlineLoader } from '../src/utils/collection-online.ts';
import { collectionPointOrganization } from '../src/mock/collection-scope.ts';
import { collectionVehicles } from '../src/mock/collection-vehicles.ts';
import { collectionFenceGeometry } from '../src/utils/collection-fence-geometry.ts';

const registeredPoint = { id: 1, name: '点位', merchantId: 1, org: collectionPointOrganization, status: 1 };
const mapPoint = { ...registeredPoint, lng: 103.8, lat: 30.6 };
const academy = { ...registeredPoint, id: 105, name: '学院 A', fenceId: 'geofence-1316745240329195520', lng: 103.831556, lat: 30.694759, fenceRadius: 30, fenceLnglats: '103.831556,30.694759' };
const signal = () => new AbortController().signal;
const json = data => new Response(JSON.stringify({ code: 0, data }), { headers: { 'Content-Type': 'application/json' } });
function setup(fetcher) {
  let token = 'test-token'; let prompts = 0;
  const api = new CollectionApi({
    getToken: () => token,
    clearToken: () => { token = ''; },
    login: async () => { prompts++; token = 'new-token'; },
  }, fetcher);
  return { api, token: () => token, prompts: () => prompts };
}

test('新版地图接口不含围栏时批量补全：香香米使用原始 30 米，跨日复用且更新重新读取', async () => {
  const point = { ...registeredPoint, id: 289, name: '温江区香香米快餐店（收集点）', fenceId: 'fence-289', lng: 103.81, lat: 30.70, fenceLnglats: '' };
  const second = { ...point, id: 290, fenceId: 'fence-290' };
  let calls = 0;
  const client = setup(async url => {
    if (url.pathname === '/api/collectionPoints') return json({ totalCount: 2, list: [point, second] });
    if (url.pathname === '/api/collectionPoint/mapPoints') return json([point, second]);
    if (url.pathname === '/api/collectionPoint/fences') {
      calls++;
      assert.equal(url.searchParams.get('ids'), '289,290');
      return json([second, point].map(row => ({ id: row.id, fenceId: row.fenceId, fenceRadius: 30, fenceLnglats: '103.81,30.70' })));
    }
    if (url.pathname === '/api/plateRecord/details') return json({ totalCount: 0, list: [] });
    return json({ positions: [] });
  });
  const load = createCollectionOnlineLoader(client.api);
  const result = await load(collectionVehicles[0], '2026-11-10', signal(), false, () => {}, client.token);
  assert.equal(result.layers.fences.status, 'complete');
  const actual = result.batches.fences.points.find(p => p.rows.some(row => row.id === '289'));
  assert.equal(actual.fence.radius, 30);
  assert.equal(collectionFenceGeometry(actual, 0).radius, 30);
  await load(collectionVehicles[0], '2026-11-11', signal(), false, () => {}, client.token);
  assert.equal(calls, 1);
  await load(collectionVehicles[0], '2026-11-11', signal(), true, () => {}, client.token);
  assert.equal(calls, 2);
});

test('绑定围栏加载失败、缺失或不一致时明确报错，不悄悄使用 50 米参考圆', async () => {
  for (const response of [null, [], [{ id: 1, fenceId: 'wrong', fenceRadius: 30 }], [{ id: 1, fenceId: 'bound', fenceRadius: -1 }]]) {
    const point = { ...mapPoint, fenceId: 'bound' };
    const client = setup(async url => {
      if (url.pathname === '/api/collectionPoints') return json({ totalCount: 1, list: [point] });
      if (url.pathname === '/api/collectionPoint/mapPoints') return json([point]);
      if (url.pathname === '/api/collectionPoint/fences') {
        if (response === null) throw new Error('网络错误');
        return json(response);
      }
      if (url.pathname === '/api/plateRecord/details') return json({ totalCount: 0, list: [] });
      return json({ positions: [] });
    });
    const result = await createCollectionOnlineLoader(client.api)(collectionVehicles[0], '2026-11-10', signal(), false, () => {}, client.token);
    assert.equal(result.layers.fences.status, 'error');
    assert.equal(result.batches.fences, undefined);
    assert.equal(result.layers.records.status, 'complete');
  }
});

test('分页遵循服务端总数与实际分页，每页带车辆，不依赖请求 pageSize', async () => {
  const calls = [];
  const { api } = setup(async (url, init) => {
    calls.push(url);
    assert.equal(init.headers.token, 'test-token');
    assert.equal(init.headers.btoken, 'test-token');
    assert.equal(url.searchParams.get('truckIdIn'), 'truck-1');
    assert.equal(url.searchParams.get('pageSize'), '5000');
    return json({ totalCount: 5, list: Number(url.searchParams.get('pageNum')) === 1 ? [{ id: 1 }, { id: 2 }] : Number(url.searchParams.get('pageNum')) === 2 ? [{ id: 3 }, { id: 4 }] : [{ id: 5 }] });
  });
  assert.deepEqual((await api.all('/api/plateRecord/details', { truckIdIn: 'truck-1' }, signal())).map(row => row.id), [1, 2, 3, 4, 5]);
  assert.equal(calls.length, 3);
});

test('无总数列表读到空页；数组响应表示全集', async () => {
  let count = 0;
  const { api } = setup(async () => json({ list: ++count < 3 ? [{ id: count }] : [] }));
  assert.equal((await api.all('/points', {}, signal())).length, 2);
  const other = setup(async () => json([{ id: 1 }]));
  assert.deepEqual(await other.api.all('/points', {}, signal()), [{ id: 1 }]);
});

test('重复页、提前空页、变化的总数不会被当成加载成功', async () => {
  const repeated = setup(async () => json({ totalCount: 3, list: [{ id: 1 }] }));
  await assert.rejects(repeated.api.all('/points', {}, signal()), /重复/);
  let calls = 0;
  const empty = setup(async () => json({ totalCount: 3, list: calls++ ? [] : [{ id: 1 }] }));
  await assert.rejects(empty.api.all('/points', {}, signal()), /未取完整/);
  calls = 0;
  const changed = setup(async () => json({ totalCount: calls++ ? 4 : 3, list: [{ id: calls }] }));
  await assert.rejects(changed.api.all('/points', {}, signal()), /总数发生变化/);
});

test('HTTP 200 业务码401触发登录、更新请求头后重试，不无限重试', async () => {
  let calls = 0;
  const client = setup(async (url, init) => {
    if (!calls++) return new Response(JSON.stringify({ code: 401, msg: 'invalid token' }));
    assert.equal(init.headers.token, 'new-token');
    return json({ list: [] });
  });
  await client.api.request('/points', {}, signal());
  assert.equal(client.prompts(), 1);
  const invalid = setup(async () => new Response(JSON.stringify({ code: 401 })));
  await assert.rejects(invalid.api.request('/points', {}, signal()), /登录状态无效/);
  assert.equal(invalid.prompts(), 1);
});

test('HTTP 401 非 JSON 响应也能触发登录；轨迹提供总数时逐页取全', async () => {
  let calls = 0;
  const client = setup(async () => calls++ ? json({ positions: [] }) : new Response('Unauthorized', { status: 401 }));
  await client.api.request('/route', {}, signal());
  assert.equal(client.prompts(), 1);
  const paged = setup(async url => json({ totalCount: 2, currPage: Number(url.searchParams.get('pageNum')), positions: [{ longitude: Number(url.searchParams.get('pageNum')), latitude: 30 }] }));
  assert.equal((await paged.api.all('/route', {}, signal(), undefined, 'positions')).length, 2);
});

test('取消请求后不继续分页、不弹登录框', async () => {
  const controller = new AbortController(); let calls = 0;
  const client = setup(async () => {
    calls++; controller.abort(); return json({ totalCount: 2, list: [{ id: 1 }] });
  });
  await assert.rejects(client.api.all('/points', {}, controller.signal), { name: 'AbortError' });
  assert.equal(calls, 1);
  assert.equal(client.prompts(), 0);
});

test('北京时间日期范围与跨年次日计算正确', () => {
  assert.equal(collectionToday(new Date('2026-11-17T16:00:00Z')), '2026-11-18');
  assert.equal(nextCollectionDate('2026-12-31'), '2027-01-01');
  assert.doesNotThrow(() => validateCollectionDate('2026-11-10'));
  for (const date of ['2026-11-09', '2026-02-30', '2099-11-18', '261110']) assert.throws(() => validateCollectionDate(date));
});

test('收集点地图和正式档案并行核验、不逐点取详情；缓存跨日复用，更新强制刷新', async () => {
  const vehicle = collectionVehicles[0]; const paths = [];
  const client = setup(async url => {
    paths.push(url.pathname);
    if (url.pathname === '/api/collectionPoints') return json({ totalCount: 1, list: [academy] });
    if (url.pathname === '/api/collectionPoint/mapPoints') {
      assert.equal(url.searchParams.has('truckIdIn'), false);
      return json([academy]);
    }
    if (url.pathname === '/api/plateRecord/details') {
      assert.equal(url.searchParams.get('truckIdIn'), vehicle.truckId);
      assert.equal(url.searchParams.get('startDate'), url.searchParams.get('endDate'));
      return json({ totalCount: 0, list: [] });
    }
    assert.equal(url.searchParams.get('truckid'), vehicle.truckId);
    assert.equal(url.searchParams.get('imei'), vehicle.imei);
    return json({ positions: [] });
  });
  const load = createCollectionOnlineLoader(client.api);
  const first = await load(vehicle, '2026-11-10', signal(), false, () => {}, client.token);
  assert.equal(first.batches.fences.corrected, 0);
  assert.deepEqual(first.batches.fences.points[0].sourcePosition, [103.831556, 30.694759]);
  assert.equal(first.batches.route, undefined);
  assert.match(first.warnings[0], /暂无可显示路线/);
  await load(vehicle, '2026-11-11', signal(), false, () => {}, client.token);
  assert.equal(paths.filter(path => path === '/api/collectionPoint/mapPoints').length, 1);
  await load(vehicle, '2026-11-11', signal(), true, () => {}, client.token);
  assert.equal(paths.filter(path => path === '/api/collectionPoint/mapPoints').length, 2);
  assert.deepEqual(paths, [
    '/api/collectionPoints', '/api/collectionPoint/mapPoints', '/api/plateRecord/details', '/api/gps/travelPath',
    '/api/plateRecord/details', '/api/gps/travelPath',
    '/api/collectionPoints', '/api/collectionPoint/mapPoints', '/api/plateRecord/details', '/api/gps/travelPath',
  ]);
});

test('地图全集直接展示；非所选车辆、跨日记录及轨迹不显示', async () => {
  const vehicle = collectionVehicles[0];
  const client = setup(async url => {
    if (url.pathname === '/api/collectionPoints') return json({ totalCount: 1, list: [registeredPoint] });
    if (url.pathname === '/api/collectionPoint/mapPoints') return json([mapPoint]);
    if (url.pathname === '/api/plateRecord/details') return json({ totalCount: 3, list: [
      { plateNumber: vehicle.label, createTime: '2026-11-10 08:00:00', lng: 103.8, lat: 30.6 },
      { plateNumber: '其他车辆', createTime: '2026-11-10 08:00:00' },
      { plateNumber: vehicle.label, createTime: '2026-11-11 00:00:00' },
    ] });
    return json({ positions: [
      { carnum: vehicle.label, fixTime: '2026-11-10 08:00:00', longitude: 103.8, latitude: 30.6 },
      { carnum: vehicle.label, fixTime: '2026-11-10 09:00:00', longitude: 103.9, latitude: 30.6 },
      { carnum: vehicle.label, fixTime: '2026-11-11 00:00:00', longitude: 103.9, latitude: 30.6 },
    ] });
  });
  const result = await createCollectionOnlineLoader(client.api)(vehicle, '2026-11-10', signal(), false, () => {}, client.token);
  assert.equal(result.batches.records.total, 1);
  assert.equal(result.batches.fences.skipped, 0);
  assert.equal(result.batches.route.total, 2);
  assert.match(result.warnings.join(' '), /排除 2 条/);
});

test('登录会话改变时重新加载收集点，避免将旧账号缓存与新账号明细混用', async () => {
  let pointLoads = 0; let recordLoads = 0;
  const client = setup(async url => {
    if (url.pathname === '/api/collectionPoints') return json({ totalCount: 1, list: [registeredPoint] });
    if (url.pathname === '/api/collectionPoint/mapPoints') { pointLoads++; return json([mapPoint]); }
    if (url.pathname === '/api/plateRecord/details') {
      if (!recordLoads++) return new Response(JSON.stringify({ code: 401 }));
      return json({ totalCount: 0, list: [] });
    }
    return json({ positions: [] });
  });
  const result = await createCollectionOnlineLoader(client.api)(collectionVehicles[0], '2026-11-10', signal(), false, () => {}, client.token);
  assert.equal(pointLoads, 2);
  assert.equal(client.prompts(), 1);
  assert.equal(result.batches.fences.total, 1);
});

test('三类请求并行，首批明细先发布；慢轨迹失败时保留已完成图层', async () => {
  let releasePage; let releaseRoute; let reachedPage;
  const pageGate = new Promise(resolve => { releasePage = resolve; });
  const routeGate = new Promise(resolve => { releaseRoute = resolve; });
  const pageReached = new Promise(resolve => { reachedPage = resolve; });
  const started = new Set(); const updates = [];
  const row = id => ({ id, plateNumber: collectionVehicles[0].label, createTime: '2026-11-10 08:00:00', lng: 103.8, lat: 30.6 });
  const client = setup(async url => {
    started.add(url.pathname);
    if (url.pathname.endsWith('/collectionPoints')) return json({ totalCount: 1, list: [registeredPoint] });
    if (url.pathname.endsWith('/mapPoints')) return json([mapPoint]);
    if (url.pathname.endsWith('/details')) {
      const page = Number(url.searchParams.get('pageNum'));
      if (page === 2) { reachedPage(); await pageGate; }
      return json({ totalCount: 2, currPage: page, list: [row(page)] });
    }
    await routeGate;
    return new Response(JSON.stringify({ code: 500, msg: '轨迹暂不可用' }));
  });
  const pending = createCollectionOnlineLoader(client.api)(collectionVehicles[0], '2026-11-10', signal(), false, () => {}, client.token, value => updates.push(value));
  await pageReached;
  assert.equal(started.size, 4);
  const partial = updates.find(value => value.batches.records?.total === 1);
  assert.ok(partial);
  assert.equal(partial.layers.records.status, 'loading');
  assert.equal(partial.layers.route.status, 'loading');
  releasePage(); releaseRoute();
  const result = await pending;
  assert.equal(result.batches.records.total, 2);
  assert.equal(result.batches.fences.total, 1);
  assert.equal(result.layers.records.status, 'complete');
  assert.equal(result.layers.route.status, 'error');
  assert.match(result.errors.join(' '), /轨迹暂不可用/);
});

test('后续分页失败撤下该图层首批数据，不将不完整明细当作成功', async () => {
  const updates = [];
  const client = setup(async url => {
    if (url.pathname.endsWith('/collectionPoints')) return json({ totalCount: 1, list: [registeredPoint] });
    if (url.pathname.endsWith('/mapPoints')) return json([mapPoint]);
    if (url.pathname.endsWith('/details')) return json({ totalCount: 2, list: url.searchParams.get('pageNum') === '1'
      ? [{ plateNumber: collectionVehicles[0].label, createTime: '2026-11-10 08:00:00', lng: 103.8, lat: 30.6 }] : [] });
    return json({ positions: [] });
  });
  const result = await createCollectionOnlineLoader(client.api)(collectionVehicles[0], '2026-11-10', signal(), false, () => {}, client.token, value => updates.push(value));
  assert.ok(updates.some(value => value.batches.records?.total === 1));
  assert.equal(result.batches.records, undefined);
  assert.equal(result.layers.records.status, 'error');
  assert.equal(result.layers.fences.status, 'complete');
  assert.match(result.errors.join(' '), /未取完整/);
});

test('并发鉴权失效只等待一次登录，重新获取后发布同一会话数据', async () => {
  let token = 'expired'; let logins = 0; let releaseLogin; let loginStarted;
  const gate = new Promise(resolve => { releaseLogin = resolve; });
  const started = new Promise(resolve => { loginStarted = resolve; });
  const api = new CollectionApi({
    getToken: () => token, clearToken: () => { token = ''; },
    login: async () => { logins++; loginStarted(); await gate; token = 'fresh'; },
  }, async (url, init) => {
    if (init.headers.token === 'expired') return new Response(JSON.stringify({ code: 401 }));
    if (url.pathname.endsWith('/collectionPoints')) return json({ totalCount: 1, list: [registeredPoint] });
    if (url.pathname.endsWith('/mapPoints')) return json([mapPoint]);
    return json(url.pathname.endsWith('/details') ? { totalCount: 0, list: [] } : { positions: [] });
  });
  const pending = createCollectionOnlineLoader(api)(collectionVehicles[0], '2026-11-10', signal(), false, () => {}, () => token);
  await started;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(logins, 1);
  releaseLogin();
  const result = await pending;
  assert.equal(logins, 1);
  assert.deepEqual(result.errors, []);
  assert.equal(result.layers.fences.status, 'complete');
});

test('切换日期取消旧登录等待后，新请求仍可完成登录', async () => {
  let token = ''; let calls = 0;
  const api = new CollectionApi({
    getToken: () => token, clearToken() {},
    login: async loginSignal => {
      if (++calls === 1) await new Promise((resolve, reject) => {
        loginSignal.addEventListener('abort', () => reject(new DOMException('旧请求已取消', 'AbortError')), { once: true });
      });
      else token = 'fresh';
    },
  });
  const old = new AbortController();
  const oldResult = assert.rejects(api.authenticate(old.signal), { name: 'AbortError' });
  old.abort();
  await api.authenticate(signal());
  await oldResult;
  assert.equal(calls, 2);
  assert.equal(token, 'fresh');
});

test('额外地图围栏始终不发布且不提示排除数量；档案失败则不显示未核验点', async () => {
  let catalogFails = false;
  const updates = [];
  const client = setup(async url => {
    if (url.pathname.endsWith('/collectionPoints')) return catalogFails
      ? new Response(JSON.stringify({ code: 500, msg: '档案暂不可用' }))
      : json({ totalCount: 1, list: [registeredPoint] });
    if (url.pathname.endsWith('/mapPoints')) return json([mapPoint, { ...mapPoint, id: 999, name: '清淳家园1期' }]);
    return json(url.pathname.endsWith('/details') ? { totalCount: 0, list: [] } : { positions: [] });
  });
  const load = createCollectionOnlineLoader(client.api);
  const first = await load(collectionVehicles[0], '2026-11-10', signal(), false, () => {}, client.token, update => updates.push(update));
  assert.equal(first.batches.fences.total, 1);
  assert.doesNotMatch(first.warnings.join(' '), /正式收集点档案核验/);
  assert.ok(updates.every(update => !JSON.stringify(update.batches.fences ?? {}).includes('清淳')));
  const cached = await load(collectionVehicles[0], '2026-11-11', signal(), false, () => {}, client.token);
  assert.doesNotMatch(cached.warnings.join(' '), /正式收集点档案核验/);
  catalogFails = true;
  const failed = await load(collectionVehicles[0], '2026-11-11', signal(), true, () => {}, client.token);
  assert.equal(failed.batches.fences, undefined);
  assert.equal(failed.layers.fences.status, 'error');
  assert.equal(failed.layers.records.status, 'complete');
  assert.match(failed.errors.join(' '), /档案暂不可用/);
});
