import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRouteImport } from '../src/utils/collection-import.ts';
import { formatRouteTime, routeFrame, routeTimestamp } from '../src/utils/route-playback.ts';

const parse = positions => parseRouteImport(JSON.stringify({ data: { positions } }));

test('轨迹按北京时间解析并排序，保留原地停留采样及真实时间间隔', () => {
  const point = { longitude: 103.8, latitude: 30.7 };
  const result = parse([
    { ...point, longitude: 103.801, fixTime: '2026-11-11 08:02:00' },
    { ...point, fixTime: '2026-11-11 08:01:00' },
    { ...point, fixTime: '2026-11-11 08:00:00' },
  ]);
  assert.equal(result.samples.length, 3);
  assert.equal(result.path.length, 2);
  assert.equal(result.playbackIssue, undefined);
  assert.equal(result.samples[2].timestamp - result.samples[0].timestamp, 120000);
  assert.equal(formatRouteTime(result.samples[0].timestamp, true), '2026-11-11 08:00:00');
  const stopped = routeFrame(result.samples, result.samples[0].timestamp + 30000);
  assert.deepEqual(stopped.position, result.samples[0].position);
  const moving = routeFrame(result.samples, result.samples[0].timestamp + 90000);
  assert.equal(moving.position[0], (result.samples[1].position[0] + result.samples[2].position[0]) / 2);
});

test('拖动到端点、重复时间和方向插值均有确定结果', () => {
  const samples = [
    { position: [103.8, 30.7], timestamp: 0 },
    { position: [103.801, 30.7], timestamp: 10000 },
    { position: [103.802, 30.7], timestamp: 10000 },
  ];
  assert.deepEqual(routeFrame(samples, -100).position, samples[0].position);
  assert.ok(Math.abs(routeFrame(samples, 5000).heading - 90) < 0.001);
  assert.deepEqual(routeFrame(samples, 10000).position, samples[2].position);
  assert.deepEqual(routeFrame(samples, 11000).position, samples[2].position);
});

test('无时间旧文件仍可绘图，缺时间或起止时间相同会给出播放说明', () => {
  const point = { longitude: 103.8, latitude: 30.7 };
  const noTime = parse([point, { ...point, longitude: 103.801 }]);
  assert.equal(noTime.path.length, 2);
  assert.equal(noTime.samples.length, 0);
  assert.match(noTime.playbackIssue, /缺少有效时间/);
  const sameTime = parse([{ ...point, deviceTime: '2026-11-11 08:00:00' }, { ...point, longitude: 103.801, deviceTime: '2026-11-11 08:00:00' }]);
  assert.match(sameTime.playbackIssue, /起止时间相同/);
  assert.equal(routeTimestamp('2026-02-30 08:00:00'), undefined);
  assert.equal(routeTimestamp('2026-11-11 25:00:00'), undefined);
  assert.equal(routeTimestamp('bad'), undefined);
  assert.equal(routeTimestamp('2026-11-11 08:00:00'), routeTimestamp('2026-11-11T00:00:00Z'));
});
