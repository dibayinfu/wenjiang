import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseCollectionImport, parseFenceImport, parseRouteImport } from '../src/utils/collection-import.ts';
import { gcj02ToBd09 } from '../src/utils/collection-coordinates.ts';

test('收运明细、商户围栏和轨迹按各自的源坐标系转换到高德坐标', () => {
  const gps = { lng: 116.32715, lat: 39.990912 };
  const fence = { name: '收集点', lng: 116.3399238215671, lat: 39.99790384183681 };
  const sample = { longitude: gps.lng, latitude: gps.lat, valid: false, validPos: false };
  const collection = parseCollectionImport(JSON.stringify({ data: { list: [gps, gps] } }));
  const fences = parseFenceImport(JSON.stringify({ data: { list: [fence] } }));
  const route = parseRouteImport(JSON.stringify({ data: { positions: [sample, sample, { ...sample, longitude: 116.328 }] } }));

  const expected = [116.33329238367239, 39.99222508006676];
  assert.equal(collection.points.length, 1);
  assert.equal(collection.points[0].rows.length, 2);
  assert.equal(route.path.length, 2);
  assert.deepEqual(route.path[0], collection.points[0].position);
  for (const position of [collection.points[0].position, fences.points[0].position]) {
    assert.ok(Math.abs(position[0] - expected[0]) < 0.000002);
    assert.ok(Math.abs(position[1] - expected[1]) < 0.000002);
  }
});

test('同坐标的不同收集点保留各自的商户、地址和更新时间供单独选择', () => {
  const rows = [1, 2, 3].map(id => ({
    id, name: `收集点${id}`, merchantName: `商户${id}`, address: `地址${id}`,
    updateTime: `2026-11-09 08:00:0${id}`, lng: 103.816102, lat: 30.708059,
  }));
  const result = parseFenceImport(JSON.stringify({ data: { list: rows } }));
  assert.equal(result.points.length, 1);
  assert.equal(result.points[0].rows.length, 3);
  assert.deepEqual(result.points[0].rows.map(row => [row.name, row.merchantName, row.address, row.updateTime]), rows.map(row => [row.name, row.merchantName, row.address, row.updateTime]));
});

test('学院 A 在两个历史日期和手动导入中使用真实系统地图位置，两种底图保持一致', () => {
  for (const date of ['261110', '261111']) {
    const file = readFileSync(new URL(`../src/mock/collection-history/${date}/商户收集点${date}.json`, import.meta.url), 'utf8');
    const result = parseFenceImport(file);
    const original = JSON.parse(file).data.list.find(row => row.id === 105);
    const point = result.points.find(point => point.rows.some(row => row.name === original.name));
    const manual = parseFenceImport(JSON.stringify({ data: { list: [original] } }));
    assert.deepEqual(manual.points[0], point);
    assert.equal(result.corrected, 12);
    assert.equal(result.skipped, date === '261111' ? 2 : 0);
    assert.deepEqual(point.sourcePosition, [103.831556, 30.694759]);
    assert.deepEqual(point.mapSourcePosition, [103.81781280217406, 30.695696372735583]);
    // 高德期望坐标来自已核验百度位置，不从收运 GPS 推断。
    assert.ok(Math.abs(point.position[0] - 103.811408) < 0.000002);
    assert.ok(Math.abs(point.position[1] - 30.689444) < 0.000002);
    const baidu = gcj02ToBd09(point.position);
    assert.ok(Math.abs(baidu[0] - point.mapSourcePosition[0]) < 0.000002);
    assert.ok(Math.abs(baidu[1] - point.mapSourcePosition[1]) < 0.000002);
  }
});

test('校正不覆盖后续修改的坐标，也不应用到其他围栏或缺少围栏 ID 的数据', () => {
  const base = { name: '学院 A', fenceId: 'geofence-1316745240329195520', lng: 103.831556, lat: 30.694759 };
  for (const row of [{ ...base, lng: 103.82 }, { ...base, fenceId: 'other-fence' }, { ...base, fenceId: undefined }]) {
    const result = parseFenceImport(JSON.stringify({ data: { list: [row] } }));
    assert.equal(result.corrected, 0);
    assert.equal(result.points[0].mapSourcePosition, undefined);
    const baidu = gcj02ToBd09(result.points[0].position);
    assert.ok(Math.abs(baidu[0] - row.lng) < 0.000002);
    assert.ok(Math.abs(baidu[1] - row.lat) < 0.000002);
  }
});
