import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseCollectionPointSnapshot, parseFenceImport } from '../src/utils/collection-import.ts';
import { selectRegisteredCollectionPoints } from '../src/utils/collection-point-scope.ts';
import { collectionFenceGeometry } from '../src/utils/collection-fence-geometry.ts';

const text = readFileSync(new URL('../src/mock/collection-point-snapshot.json', import.meta.url), 'utf8');
const snapshot = JSON.parse(text);
const registeredRows = selectRegisteredCollectionPoints(snapshot.data.list, snapshot.registry.list).rows;

test('本地快照全部收集点与在线解析的中心、形状、半径完全一致，不再依赖逐点补丁', () => {
  const local = parseCollectionPointSnapshot(text);
  const online = parseFenceImport(JSON.stringify({ data: { list: registeredRows } }), { legacyCorrections: false, pointCoordinateSystem: 'wgs84' });
  assert.equal(local.total, snapshot.data.totalCount);
  assert.equal(local.skipped, 0);
  assert.equal(local.corrected, 0);
  assert.deepEqual(local.points, online.points);
  assert.equal(local.points.reduce((count, point) => count + point.rows.length, 0), snapshot.data.totalCount);
  assert.ok(local.points.every(point => point.geometrySource === 'boundary'));
  assert.ok(local.points.some(point => point.fence.type === 'polygon'));
  assert.match(local.fileName, /本地收集点快照/);
});

test('本地快照覆盖柳贺居和其他商户，显示与匹配共用原始围栏', () => {
  const local = parseCollectionPointSnapshot(text);
  for (const row of registeredRows) {
    const expected = parseFenceImport(JSON.stringify({ data: { list: [row] } }), { legacyCorrections: false, pointCoordinateSystem: 'wgs84' }).points[0];
    const actual = local.points.find(point => point.rows.some(value => value.name === row.name));
    assert.ok(actual, `缺少收集点 ${row.id}`);
    assert.deepEqual(actual.position, expected.position);
    assert.deepEqual(collectionFenceGeometry(actual), expected.fence);
  }
  const liuheju = local.points.find(point => point.rows.some(row => row.name.includes('柳贺居')));
  assert.deepEqual(liuheju.mapSourcePosition, [103.8369165, 30.698034]);
  assert.equal(liuheju.fence.radius, 30);
  assert.equal(liuheju.geometrySource, 'boundary');
  assert.ok(liuheju.rows[0].address.includes('柳城大道'));
});

test('快照明确坐标系、采集时间及总数，损坏或不完整时拒绝按旧坐标显示', () => {
  assert.throws(() => parseCollectionPointSnapshot(JSON.stringify({ ...snapshot, pointCoordinateSystem: 'bd09' })), /坐标系/);
  assert.throws(() => parseCollectionPointSnapshot(JSON.stringify({ ...snapshot, capturedAt: 'invalid' })), /采集时间/);
  assert.throws(() => parseCollectionPointSnapshot(JSON.stringify({ ...snapshot, data: { ...snapshot.data, totalCount: 99999 } })), /条数不完整/);
});

test('本地快照拒绝混入无正式档案的额外围栏', () => {
  const extra = { ...snapshot.data.list[0], id: 'foreign', name: '清淳家园1期' };
  const invalid = { ...snapshot, data: { totalCount: snapshot.data.list.length + 1, list: [...snapshot.data.list, extra] } };
  assert.throws(() => parseCollectionPointSnapshot(JSON.stringify(invalid)), /正式档案核验/);
  assert.throws(() => parseCollectionPointSnapshot(JSON.stringify({ ...snapshot, registry: undefined })), /正式收集点档案/);
});
