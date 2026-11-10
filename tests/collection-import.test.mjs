import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCollectionImport, parseFenceImport, parseRouteImport } from '../src/utils/collection-import.ts';

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
