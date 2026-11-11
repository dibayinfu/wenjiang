export type MapProvider = 'amap' | 'baidu';
export type MapTheme = 'normal' | 'light' | 'blue';
export interface MapStyleRule { featureType: string; elementType: string; stylers: Record<string, string> }

export const mapThemeOptions: Record<MapProvider, { value: MapTheme; label: string }[]> = {
  amap: [
    { value: 'normal', label: '默认' }, { value: 'light', label: '月光银' },
    { value: 'blue', label: '远山黛' },
  ],
  baidu: [
    { value: 'normal', label: '默认' }, { value: 'blue', label: '浅灰淡蓝' },
    { value: 'light', label: '柔和银灰' },
  ],
};
export const amapThemeStyles: Record<MapTheme, string> = {
  normal: 'normal', light: 'light', blue: 'whitesmoke',
};

// 百度 GL 使用本地样式规则，无需额外申请或发布 styleId。
export function baiduThemeStyle(theme: MapTheme): MapStyleRule[] {
  if (theme === 'normal') return [];
  const palettes = {
    blue: { land: '#f5f6f7ff', water: '#e2edf2ff', green: '#edf2edff', road: '#e4e7ebff' },
    light: { land: '#f6f6f6ff', water: '#e7eaedff', green: '#eff0efff', road: '#e3e5e7ff' },
  };
  const palette = palettes[theme];
  return [
    { featureType: 'land', elementType: 'geometry', stylers: { color: palette.land } },
    { featureType: 'water', elementType: 'geometry', stylers: { color: palette.water } },
    { featureType: 'green', elementType: 'geometry', stylers: { color: palette.green } },
    { featureType: 'building', elementType: 'geometry.fill', stylers: { color: '#eceff1ff' } },
    { featureType: 'building', elementType: 'geometry.stroke', stylers: { color: '#e1e5e8ff' } },
    { featureType: 'road', elementType: 'geometry.fill', stylers: { color: '#ffffffff' } },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: { color: '#e0e5e9ff' } },
    { featureType: 'highway', elementType: 'geometry.fill', stylers: { color: palette.road } },
    { featureType: 'highway', elementType: 'geometry.stroke', stylers: { color: '#d4dbe1ff' } },
    { featureType: 'arterial', elementType: 'geometry.fill', stylers: { color: '#ffffffff' } },
    { featureType: 'arterial', elementType: 'geometry.stroke', stylers: { color: '#dfe4e8ff' } },
    { featureType: 'railway', elementType: 'geometry.fill', stylers: { color: '#dce1e6ff' } },
    { featureType: 'railway', elementType: 'geometry.stroke', stylers: { color: '#eef0f2ff' } },
  ];
}

// 本次收敛主题选项并调整默认值，旧版本偏好不覆盖新的初始配置。
const storageKey = 'wenjiang-collection-map-themes-v2';
export const defaultMapThemes: Record<MapProvider, MapTheme> = { amap: 'light', baidu: 'blue' };
export function readMapThemes(): Record<MapProvider, MapTheme> {
  const themes = { ...defaultMapThemes };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (saved && typeof saved === 'object') {
      for (const provider of ['amap', 'baidu'] as const) {
        const value = (saved as Record<string, unknown>)[provider];
        if (mapThemeOptions[provider].some(option => option.value === value)) themes[provider] = value as MapTheme;
      }
    }
  } catch { /* 本地存储不可用或损坏时，使用既有浅色主题。 */ }
  return themes;
}
export function saveMapThemes(themes: Record<MapProvider, MapTheme>) {
  try { localStorage.setItem(storageKey, JSON.stringify(themes)); } catch { /* 不影响当前页面切换。 */ }
}
