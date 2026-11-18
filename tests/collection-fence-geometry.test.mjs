import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseFenceImport } from '../src/utils/collection-import.ts';
import { collectionFenceGeometry } from '../src/utils/collection-fence-geometry.ts';
import { unmatchedCollectionRows } from '../src/utils/collection-matching.ts';
import { bd09ToGcj02, gcj02ToBd09, wgs84ToGcj02 } from '../src/utils/collection-coordinates.ts';

const boundary = '103.828268,30.694981;103.828581,30.694711;103.828268,30.694441;103.827954,30.694711';
const expectedBd = [103.8369165, 30.698034];
const row = {
  id: 313, name: '柳贺居（六合居）（收集点）', merchantName: '柳贺居',
  fenceId: 'geofence-1317211332394749952', lng: 103.83768, lat: 30.697826,
  fenceRadius: 30, fenceLnglats: boundary,
};
const parse = (rows, options) => parseFenceImport(JSON.stringify({ data: { list: rows } }), options);
const close = (a, b, tolerance = 1e-6) => a.forEach((value, i) => assert.ok(Math.abs(value - b[i]) < tolerance));

test('圆形围栏优先取转换后边界的外接矩形中心，保留原始登记坐标及30米半径', () => {
  const result = parse([row], { legacyCorrections: false, pointCoordinateSystem: 'wgs84' });
  const point = result.points[0];
  assert.deepEqual(point.sourcePosition, [row.lng, row.lat]);
  assert.deepEqual(point.mapSourcePosition, expectedBd);
  assert.deepEqual(point.position, bd09ToGcj02(expectedBd));
  assert.equal(point.geometrySource, 'boundary');
  assert.equal(point.fence.type, 'circle');
  assert.equal(point.fence.radius, 30);
  assert.equal(collectionFenceGeometry(point, 0), point.fence);
  assert.equal(collectionFenceGeometry(point, 50).radius, 50);
  close(gcj02ToBd09(point.position), expectedBd);
});

test('绘制和商户匹配共用真实围栏；旧圆心不再误命中，核验半径可主动覆盖', () => {
  const fence = parse([row]).points[0];
  const atCenter = { position: fence.position, rows: [{ merchantName: row.merchantName }] };
  const atOld = { position: bd09ToGcj02([row.lng, row.lat]), rows: atCenter.rows };
  const fortyMetersAway = { position: [fence.position[0], fence.position[1] + 40 / 6371000 * 180 / Math.PI], rows: atCenter.rows };
  const result = unmatchedCollectionRows([atCenter, atOld, fortyMetersAway], [fence], 0);
  assert.equal(result.get(atCenter).length, 0);
  assert.equal(result.get(atOld).length, 1);
  assert.equal(result.get(fortyMetersAway).length, 1);
  assert.equal(unmatchedCollectionRows([fortyMetersAway], [fence], 50).get(fortyMetersAway).length, 0);
});

test('手动导入旧格式柳贺居时按围栏ID与原坐标校正，保留原文件', () => {
  const text = readFileSync(new URL('../src/mock/collection-history/261117/商户收集点261117.json', import.meta.url), 'utf8');
  const source = JSON.parse(text).data.list.find(value => value.id === 313);
  const point = parse([source]).points[0];
  assert.equal(point.geometrySource, 'verified');
  assert.deepEqual(point.mapSourcePosition, expectedBd);
  assert.equal(point.fence.radius, 30);
  assert.deepEqual(point.sourcePosition, [103.83768, 30.697826]);
  for (const other of [{ ...source, lng: 103.84 }, { ...source, fenceId: 'other' }]) {
    assert.equal(parse([other]).points[0].geometrySource, 'reference');
  }
});

test('有效围栏边界可独立绘制，登记坐标缺失不再跳过真实围栏', () => {
  const result = parse([{ ...row, lng: null, lat: null }]);
  assert.equal(result.skipped, 0);
  assert.equal(result.points[0].sourcePosition, undefined);
  assert.deepEqual(result.points[0].mapSourcePosition, expectedBd);
});

test('多边形保留真实边界，匹配不再以外接圆代替；同中心不同围栏不合并', () => {
  const polygon = { ...row, fenceRadius: 0 };
  const result = parse([row, polygon]);
  assert.equal(result.points.length, 2);
  const point = result.points.find(value => value.fence.type === 'polygon');
  assert.equal(point.fence.path.length, 4);
  assert.equal(collectionFenceGeometry(point), point.fence);
  const inside = { position: point.position, rows: [{ merchantName: row.merchantName }] };
  const outside = { position: bd09ToGcj02([row.lng, row.lat]), rows: inside.rows };
  const matches = unmatchedCollectionRows([inside, outside], [point]);
  assert.equal(matches.get(inside).length, 0);
  assert.equal(matches.get(outside).length, 1);
});

test('无边界旧文件明确回退参考圆，在线缺边界按原系统WGS-84点位转换', () => {
  const plain = { id: 1, name: '参考点', lng: 103.8, lat: 30.7 };
  const old = parse([plain]).points[0];
  assert.equal(old.geometrySource, 'reference');
  assert.equal(old.fence, undefined);
  assert.equal(collectionFenceGeometry(old).radius, 50);
  assert.deepEqual(old.position, bd09ToGcj02([plain.lng, plain.lat]));
  const online = parse([plain], { pointCoordinateSystem: 'wgs84', legacyCorrections: false }).points[0];
  close(online.position, wgs84ToGcj02([plain.lng, plain.lat]));
});

test('实时几何优先于旧校正快照，边界数组及数值字符串均可读取', () => {
  const changed = { ...row, fenceRadius: '20', fenceLnglats: ['103.8,30.7', '103.801,30.7', '103.8,30.701'] };
  const point = parse([changed]).points[0];
  assert.equal(point.geometrySource, 'boundary');
  assert.equal(point.fence.radius, 20);
  assert.notDeepEqual(point.mapSourcePosition, expectedBd);
});
