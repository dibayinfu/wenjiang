import { routeColors } from './route-playback';
import { loadAmapJsApi } from './amap';
import { loadBaiduCollectionMap } from './baidu-map';
import { amapThemeStyles, defaultMapThemes, type MapProvider, type MapTheme } from './map-themes';
export type { MapProvider } from './map-themes';

type Position = [number, number];
export interface MapCircle {
  setRadius(radius: number): void;
  setOptions(options: Record<string, unknown>): void;
}
export interface CollectionMap {
  setTheme(theme: MapTheme): Promise<void>;
  destroy(): void;
  resize(): void;
  fit(): void;
  getZoom(): number;
  locate(zoom: number, position: Position): void;
  route(path: Position[]): { setProgress(path: Position[]): void };
  marker(position: Position, content: HTMLElement, offset: Position, click?: () => void, zIndex?: number): { setPosition(position: Position): void };
  circle(position: Position, radius: number, style: Record<string, unknown>, click: () => void): MapCircle;
  labels(items: { position: Position; text: string; color: string; offset: Position; click: () => void }[]): () => void;
}

export async function createCollectionMap(provider: MapProvider, element: HTMLElement, center: Position, theme: MapTheme = defaultMapThemes[provider]): Promise<CollectionMap> {
  if (provider === 'baidu') return loadBaiduCollectionMap(element, center);
  const api = await loadAmapJsApi();
  const map = new api.Map(element, { center, zoom: 17, viewMode: '2D', mapStyle: `amap://styles/${amapThemeStyles[theme]}` });
  return {
    setTheme: async value => { map.setMapStyle(`amap://styles/${amapThemeStyles[value]}`); },
    destroy: () => map.destroy(),
    resize: () => map.resize(),
    fit: () => map.setFitView(undefined, true, [40, 40, 40, 40]),
    getZoom: () => map.getZoom(),
    locate: (zoom, position) => map.setZoomAndCenter(zoom, position),
    route(path) {
      map.add(new api.Polyline({ path, strokeColor: routeColors.remaining, strokeOpacity: 1, strokeWeight: 5,
        lineJoin: 'round', lineCap: 'round', showDir: true, bubble: true, zIndex: 8 }));
      const completed = new api.Polyline({ path: [path[0], path[0]], strokeColor: routeColors.completed,
        strokeOpacity: 1, strokeWeight: 5, lineJoin: 'round', lineCap: 'round', showDir: true, bubble: true, zIndex: 9 });
      let visible = false;
      return { setProgress(progress) {
        if (progress.length < 2) { if (visible) completed.setMap(null); visible = false; return; }
        completed.setPath(progress);
        if (!visible) completed.setMap(map);
        visible = true;
      } };
    },
    marker(position, content, offset, click, zIndex) {
      const marker = new api.Marker({ position, content, offset: new api.Pixel(...offset), zIndex });
      if (click) marker.on('click', click);
      marker.setMap(map);
      return marker;
    },
    circle(position, radius, style, click) {
      const circle = new api.Circle({ ...style, center: position, radius, cursor: 'pointer' });
      circle.on('click', click);
      circle.setMap(map);
      return circle;
    },
    labels(items) {
      const layer = new api.LabelsLayer({ collision: false, allowCollision: false, zIndex: 120 });
      layer.add(items.map(item => {
        const label = new api.LabelMarker({ position: item.position, text: { content: item.text,
          direction: item.offset[1] > 0 ? 'bottom' : 'top', offset: item.offset,
          style: { fontSize: 12, fillColor: item.color, strokeColor: '#fff', strokeWidth: 3 } } });
        label.on('click', item.click);
        return label;
      }));
      map.add(layer);
      return () => layer.setMap(null);
    },
  };
}
