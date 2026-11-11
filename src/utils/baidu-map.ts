import { routeColors } from './route-playback';
import { gcj02ToBd09 } from './collection-coordinates';
import type { CollectionMap } from './collection-map';
import { baiduThemeStyle, type MapStyleRule, type MapTheme } from './map-themes';

type Position = [number, number];
interface Point { lng: number; lat: number }
interface Overlay { initialize?(map: NativeMap): HTMLElement; draw?(): void }
interface NativePolyline extends Overlay { setPath(path: Point[]): void }
interface NativeCircle extends Overlay {
  addEventListener(event: string, handler: () => void): void;
  setRadius(value: number): void;
  setStrokeColor(value: string): void;
  setStrokeWeight(value: number): void;
  setFillColor(value: string): void;
  setFillOpacity(value: number): void;
}
interface NativeMap {
  centerAndZoom(point: Point, zoom: number): void;
  setMapStyleV2(options: { styleJson?: MapStyleRule[]; version?: 'v3' }): void;
  addEventListener(event: string, handler: () => void): void;
  removeEventListener(event: string, handler: () => void): void;
  loadMapStyleFiles(callback: () => void): void;
  enableScrollWheelZoom(): void;
  getZoom(): number;
  addOverlay(overlay: Overlay): void;
  removeOverlay(overlay: Overlay): void;
  getPanes(): { markerPane: HTMLElement };
  pointToOverlayPixel(point: Point): { x: number; y: number };
  setViewport(points: Point[], options: Record<string, unknown>): void;
  checkResize(): void;
  destroy(): void;
}
interface BaiduApi {
  MapConfig: { tileDomain: string[]; apiHost: string };
  Map: new (element: HTMLElement) => NativeMap;
  Point: new (lng: number, lat: number) => Point;
  Overlay: new () => Overlay;
  Circle: new (center: Point, radius: number, options: Record<string, unknown>) => NativeCircle;
  Polyline: new (path: Point[], options: Record<string, unknown>) => NativePolyline;
}
let loader: Promise<BaiduApi> | undefined;
let callbackId = 0;

export function loadBaiduJsApi(): Promise<BaiduApi> {
  const host = window as typeof window & { BMapGL?: BaiduApi; [key: string]: unknown };
  if (host.BMapGL?.Map) return Promise.resolve(host.BMapGL);
  if (loader) return loader;
  // 与高德地图一致，原型浏览器 Key 随代码构建，供 GitHub Pages 自动部署使用。
  const key = 'c4CzvrGrG3Bhf30rsc1F9HewunMGWlEs';
  loader = new Promise<BaiduApi>((resolve, reject) => {
    const script = document.createElement('script');
    const callback = `__wenjiangBaiduReady${++callbackId}`;
    const cleanup = () => { window.clearTimeout(timer); delete host[callback]; script.remove(); };
    const fail = (message: string) => { cleanup(); reject(new Error(message)); };
    const timer = window.setTimeout(() => fail('百度地图加载超时，请检查网络及 Key 的域名白名单后重试。'), 15000);
    host[callback] = () => {
      cleanup();
      if (host.BMapGL?.Map) resolve(host.BMapGL);
      else reject(new Error('百度地图初始化失败，请检查浏览器类型 Key 与域名白名单。'));
    };
    script.async = true;
    script.src = `https://api.map.baidu.com/api?v=1.0&type=webgl&s=1&ak=${encodeURIComponent(key)}&callback=${callback}`;
    script.onerror = () => fail('百度地图加载失败，请检查网络后重试。');
    document.head.appendChild(script);
  }).catch(error => { loader = undefined; throw error; });
  return loader;
}

export async function loadBaiduCollectionMap(element: HTMLElement, center: Position): Promise<CollectionMap> {
  const api = await loadBaiduJsApi();
  // 当前 GL SDK 默认的 apimaponline 底图域名返回 403，改用可访问的百度官方域名。
  // 配置必须在创建 Map 前设置，保证本地与 HTTPS Pages 均使用 HTTPS 底图。
  api.MapConfig.tileDomain = [0, 1, 2, 3].map(index => `https://maponline${index}.bdimg.com`);
  api.MapConfig.apiHost = 'https://api.map.baidu.com';
  const point = (position: Position) => new api.Point(...gcj02ToBd09(position));
  const map = new api.Map(element);
  map.centerAndZoom(point(center), 17);
  map.enableScrollWheelZoom();
  // 增量主题以默认样式为基础，首次进入时先等待默认样式文件就绪。
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('百度底图样式加载超时，请重试。')), 15000);
      map.loadMapStyleFiles(() => { window.clearTimeout(timer); resolve(); });
    });
  } catch (error) { map.destroy(); throw error; }
  const bounds: Point[] = [];
  let cancelTheme: (() => void) | undefined;
  function setTheme(theme: MapTheme): Promise<void> {
    cancelTheme?.();
    // 空配置直接恢复默认；传空 styleJson 会额外请求完整的默认样式。
    if (theme === 'normal') { map.setMapStyleV2({}); return Promise.resolve(); }
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        window.clearTimeout(timer);
        map.removeEventListener('style_loaded', loaded);
        cancelTheme = undefined;
      };
      const loaded = () => { cleanup(); resolve(); };
      const timer = window.setTimeout(() => {
        cleanup();
        map.setMapStyleV2({});
        reject(new Error('主题加载超时，已恢复默认主题，请重试。'));
      }, 12000);
      cancelTheme = () => { cleanup(); resolve(); };
      map.addEventListener('style_loaded', loaded);
      // 增量样式由 SDK 合并到默认样式，减少全量样式传输导致的超时。
      try { map.setMapStyleV2({ styleJson: baiduThemeStyle(theme), version: 'v3' }); }
      catch (error) { cleanup(); map.setMapStyleV2({}); reject(error); }
    });
  }
  function marker(position: Position, content: HTMLElement, offset: Position, click?: () => void, zIndex = 100) {
    let current = point(position);
    const overlay = new api.Overlay();
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `position:absolute;z-index:${zIndex};`;
    wrapper.append(content);
    if (click) wrapper.addEventListener('click', event => { event.stopPropagation(); click(); });
    overlay.initialize = () => { map.getPanes().markerPane.append(wrapper); return wrapper; };
    overlay.draw = () => {
      const pixel = map.pointToOverlayPixel(current);
      wrapper.style.left = `${pixel.x + offset[0]}px`;
      wrapper.style.top = `${pixel.y + offset[1]}px`;
    };
    map.addOverlay(overlay);
    return {
      setPosition(position: Position) { current = point(position); overlay.draw?.(); },
      remove() { map.removeOverlay(overlay); },
    };
  }
  return {
    setTheme,
    destroy: () => { cancelTheme?.(); map.destroy(); },
    resize: () => map.checkResize(),
    fit: () => { if (bounds.length) map.setViewport(bounds, { margins: [40, 40, 40, 40], enableAnimation: false }); },
    getZoom: () => map.getZoom(),
    locate: (zoom, position) => map.centerAndZoom(point(position), zoom),
    route(path) {
      const points = path.map(point);
      bounds.push(...points);
      map.addOverlay(new api.Polyline(points, { strokeColor: routeColors.remaining, strokeOpacity: 1, strokeWeight: 5 }));
      const completed = new api.Polyline([points[0]!, points[0]!], { strokeColor: routeColors.completed, strokeOpacity: 1, strokeWeight: 5 });
      let visible = false;
      // GL 折线无 showDir 选项；按屏幕间距绘制方向箭头，避免长轨迹生成大量 DOM。
      const arrows = new api.Overlay();
      const layer = document.createElement('div');
      layer.style.pointerEvents = 'none';
      arrows.initialize = () => { map.getPanes().markerPane.append(layer); return layer; };
      arrows.draw = () => {
        layer.replaceChildren();
        let distance = 0;
        for (let i = 1, count = 0; i < points.length && count < 200; i++) {
          const a = map.pointToOverlayPixel(points[i - 1]!);
          const b = map.pointToOverlayPixel(points[i]!);
          distance += Math.hypot(b.x - a.x, b.y - a.y);
          if (distance < 80) continue;
          distance = 0;
          const arrow = document.createElement('i');
          arrow.style.cssText = `position:absolute;left:${b.x}px;top:${b.y}px;width:9px;height:9px;border-top:2px solid white;border-right:2px solid white;filter:drop-shadow(0 0 1px ${routeColors.completed});transform:translate(-50%,-50%) rotate(${Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 45}deg);`;
          layer.append(arrow);
          count++;
        }
      };
      map.addOverlay(arrows);
      return { setProgress(progress) {
        if (progress.length < 2) { if (visible) map.removeOverlay(completed); visible = false; return; }
        completed.setPath(progress.map(point));
        if (!visible) map.addOverlay(completed);
        visible = true;
      } };
    },
    marker(position, content, offset, click, zIndex) {
      bounds.push(point(position));
      return marker(position, content, offset, click, zIndex);
    },
    circle(position, radius, style, click) {
      bounds.push(point(position));
      const circle = new api.Circle(point(position), radius, { ...style, enableClicking: true });
      circle.addEventListener('click', click);
      map.addOverlay(circle);
      return {
        setRadius: value => circle.setRadius(value),
        setOptions(options) {
          if (typeof options.strokeColor === 'string') circle.setStrokeColor(options.strokeColor);
          if (typeof options.strokeWeight === 'number') circle.setStrokeWeight(options.strokeWeight);
          if (typeof options.fillColor === 'string') circle.setFillColor(options.fillColor);
          if (typeof options.fillOpacity === 'number') circle.setFillOpacity(options.fillOpacity);
        },
      };
    },
    labels(items) {
      const labels = items.map(item => {
        const label = document.createElement('span');
        label.textContent = item.text;
        label.style.cssText = `position:absolute;white-space:nowrap;transform:translate(-50%,${item.offset[1] < 0 ? '-100%' : '0'});font-size:12px;color:${item.color};text-shadow:0 0 3px white,0 0 3px white;cursor:pointer;`;
        return marker(item.position, label, item.offset, item.click, 120);
      });
      return () => labels.forEach(label => label.remove());
    },
  };
}
