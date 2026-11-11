import assert from 'node:assert/strict';
import test from 'node:test';
import { baiduThemeStyle, readMapThemes, saveMapThemes } from '../src/utils/map-themes.ts';

test('分别保存双地图偏好，异常缓存回退到既有浅色主题', () => {
  let cache = null;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => cache, setItem: (_, value) => { cache = value; },
  } });
  try {
    assert.deepEqual(readMapThemes(), { amap: 'light', baidu: 'blue' });
    saveMapThemes({ amap: 'normal', baidu: 'light' });
    assert.deepEqual(readMapThemes(), { amap: 'normal', baidu: 'light' });
    cache = '{"amap":"green","baidu":"warm"}';
    assert.deepEqual(readMapThemes(), { amap: 'light', baidu: 'blue' });
    cache = '{broken';
    assert.deepEqual(readMapThemes(), { amap: 'light', baidu: 'blue' });
    globalThis.localStorage.getItem = () => { throw new Error('blocked'); };
    globalThis.localStorage.setItem = () => { throw new Error('blocked'); };
    assert.deepEqual(readMapThemes(), { amap: 'light', baidu: 'blue' });
    assert.doesNotThrow(() => saveMapThemes({ amap: 'normal', baidu: 'light' }));
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('百度默认主题清除定制规则，淡色主题使用独立配色且不共享可变规则', () => {
  assert.deepEqual(baiduThemeStyle('normal'), []);
  const colors = ['blue', 'light'].map(theme => baiduThemeStyle(theme).find(rule => rule.featureType === 'land').stylers.color);
  assert.equal(new Set(colors).size, 2);
  const rules = baiduThemeStyle('blue');
  rules[0].stylers.color = '#000000ff';
  assert.equal(baiduThemeStyle('blue')[0].stylers.color, '#f5f6f7ff');
});
