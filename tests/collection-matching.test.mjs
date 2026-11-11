import assert from 'node:assert/strict';
import test from 'node:test';
import { collectionMerchantNames, unmatchedCollectionCounts } from '../src/utils/collection-matching.ts';

const position = [103.8, 30.7];
const fence = { position, rows: [{ merchantName: '商户甲' }, { merchantName: '商户乙' }] };

test('按商户名称和空间同时匹配，重合坐标逐条判断，缺少商户名计未匹配', () => {
  const point = { position, rows: [' 商户甲 ', '商户乙', '商户丙', '—', ''].map(merchantName => ({ merchantName })) };
  const result = unmatchedCollectionCounts([point], [fence], 50);
  assert.equal(result.get(point), 3);
  assert.deepEqual(collectionMerchantNames([...point.rows, { merchantName: '商户乙' }]), ['商户甲', '商户乙', '商户丙']);
  assert.equal(unmatchedCollectionCounts([point], [], 50).size, 0);
});

test('同名商户也必须位于当前半径内，重叠围栏任意一个符合即匹配', () => {
  const point = { position: [position[0], position[1] + 60 / 6371000 * 180 / Math.PI], rows: [{ merchantName: '商户甲' }] };
  assert.equal(unmatchedCollectionCounts([point], [fence], 30).get(point), 1);
  assert.equal(unmatchedCollectionCounts([point], [fence], 50).get(point), 1);
  assert.equal(unmatchedCollectionCounts([point], [fence], 100).get(point), 0);
  const containing = { position: point.position, rows: [{ merchantName: '商户丙' }] };
  assert.equal(unmatchedCollectionCounts([point], [fence, containing], 50).get(point), 1);
  assert.equal(unmatchedCollectionCounts([point], [fence, { ...containing, rows: [{ merchantName: '商户甲' }] }], 50).get(point), 0);
});
