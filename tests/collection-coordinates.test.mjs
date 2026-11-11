import assert from 'node:assert/strict';
import test from 'node:test';
import { bd09ToGcj02, gcj02ToBd09, wgs84ToGcj02 } from '../src/utils/collection-coordinates.ts';

test('百度显示坐标转换与既有收集点转换互逆，输入保持不变', () => {
  for (const position of [[103.816102, 30.708059], [116.33329238367239, 39.99222508006676]]) {
    const original = [...position];
    const baidu = gcj02ToBd09(position);
    assert.ok(Math.abs(baidu[0] - position[0] - 0.0065) < 0.0005);
    assert.ok(Math.abs(baidu[1] - position[1] - 0.006) < 0.0005);
    const restored = bd09ToGcj02(baidu);
    assert.ok(Math.abs(restored[0] - position[0]) < 0.000002);
    assert.ok(Math.abs(restored[1] - position[1]) < 0.000002);
    assert.deepEqual(position, original);
  }
});

test('同位置 WGS-84 轨迹与 BD-09 收集点在百度地图上保持重合', () => {
  const record = wgs84ToGcj02([116.32715, 39.990912]);
  const fence = [116.3399238215671, 39.99790384183681];
  const displayed = gcj02ToBd09(record);
  for (let i = 0; i < 2; i++) assert.ok(Math.abs(displayed[i] - fence[i]) < 0.000002);
});
