import assert from 'node:assert/strict';
import test from 'node:test';
import { collectionSearchSuggestions, searchCollectionPoints } from '../src/utils/collection-search.ts';

test('RFID 搜索保留前导零、忽略大小写并按坐标去重', () => {
  const point = { rows: [{ rfid: '000AbC123', merchantName: '商户甲' }, { rfid: '000AbC456', merchantName: '商户乙' }] };
  const other = { rows: [{ rfid: 'ABC123', merchantName: '商户丙' }] };
  const fence = { rows: [{ merchantName: '000ABC' }] };
  assert.deepEqual(searchCollectionPoints([point, other], [fence], 'rfid', ' 000abc '), [{ kind: 'records', point }]);
  assert.deepEqual(searchCollectionPoints([point, other], [fence], 'rfid', '商户甲'), []);
});

test('补全值去重并保留完整 RFID，选择补全后仅定位该值而非相似名称', () => {
  const point = { rows: [{ merchantName: ' 商户甲 ', rfid: '000AbC123' }, { merchantName: '商户甲', rfid: '000AbC123' }] };
  const other = { rows: [{ merchantName: '商户甲分店', rfid: '000AbC1234' }] };
  const fence = { rows: [{ merchantName: '商户甲' }, { merchantName: '—' }] };
  assert.deepEqual(collectionSearchSuggestions([point, other], [fence], 'merchant', '甲'), ['商户甲', '商户甲分店']);
  assert.deepEqual(collectionSearchSuggestions([point, other], [fence], 'rfid', '000abc'), ['000AbC123', '000AbC1234']);
  assert.deepEqual(collectionSearchSuggestions([point], [fence], 'merchant', ''), []);
  assert.deepEqual(searchCollectionPoints([point, other], [fence], 'merchant', '商户甲', true), [{ kind: 'fences', point: fence }, { kind: 'records', point }]);
  assert.deepEqual(searchCollectionPoints([point, other], [fence], 'rfid', '000AbC123', true), [{ kind: 'records', point }]);
});

test('商户名称搜索优先选中收集点，同时保留收运点且仅按所属商户名称匹配', () => {
  const point = { rows: [{ merchantName: '商户甲分店', rfid: '0001' }, { merchantName: '商户甲分店', rfid: '0002' }] };
  const fence = { rows: [{ merchantName: '商户甲', name: '收集点一' }] };
  const other = { rows: [{ merchantName: '—', name: '商户甲' }] };
  assert.deepEqual(searchCollectionPoints([point], [fence, other], 'merchant', '甲'), [{ kind: 'fences', point: fence }, { kind: 'records', point }]);
  assert.deepEqual(searchCollectionPoints([point], [], 'merchant', '商户甲分店', true), [{ kind: 'records', point }]);
  assert.deepEqual(searchCollectionPoints([point], [fence], 'merchant', ' '), []);
  assert.deepEqual(searchCollectionPoints([point], [fence], 'merchant', '未登记商户'), []);
});
