import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRegisteredCollectionPoints } from '../src/utils/collection-point-scope.ts';
import { collectionPointOrganization as org } from '../src/mock/collection-scope.ts';
const official = { id: 313, merchantId: 1345, fenceId: 'fence-313', org, status: 1, name: '正式名称', address: '正式地址' };
const point = { ...official, name: '地图旧名称', lng: 103.8, lat: 30.6, fenceLnglats: '103.8,30.6;103.81,30.6;103.8,30.61', fenceRadius: 0 };

test('只接受本机构正式档案及其绑定商户和围栏，排除清淳等额外地图围栏', () => {
  const invalid = [
    { ...point, id: 'foreign', name: '清淳家园1期' },
    { ...point, org: '其他机构' }, { ...point, merchantId: 999 },
    { ...point, fenceId: 'old-fence' },
  ];
  const result = selectRegisteredCollectionPoints([point, ...invalid], [official]);
  assert.equal(result.excluded, invalid.length);
  assert.deepEqual(result.rows, [{ ...point, ...official }]);
  assert.equal(selectRegisteredCollectionPoints([point], [{ ...official, org: '其他机构' }]).rows.length, 0);
});

test('不按名称或经纬度范围误删正式多边形，名称地址取正式档案', () => {
  const outside = { ...point, id: '313', merchantId: '1345', lng: 103.986767, lat: 30.709556 };
  const result = selectRegisteredCollectionPoints([outside], [official]);
  assert.equal(result.excluded, 0);
  assert.equal(result.rows[0].lng, outside.lng);
  assert.equal(result.rows[0].fenceLnglats, outside.fenceLnglats);
  assert.equal(result.rows[0].name, official.name);
  assert.equal(result.rows[0].address, official.address);
});

test('重复正式 ID 拒绝加载，避免无法确定实际商户绑定', () => {
  assert.throws(() => selectRegisteredCollectionPoints([point], [official, { ...official, merchantId: 999 }]), /重复 ID/);
});
