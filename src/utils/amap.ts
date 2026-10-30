export interface AMapMarker {
  setMap(map: AMapInstance | null): void;
  setContent(content: string | HTMLElement): void;
  setOffset(offset: unknown): void;
  getPosition(): {getLng():number;getLat():number};
  on(event: string, handler: () => void): void;
}
export interface AMapInstance {
  destroy(): void;
  resize(): void;
  setMapStyle(style: string): void;
  setFitView(markers?: AMapMarker[], immediately?: boolean, padding?: number[]): void;
  setZoomAndCenter(zoom: number, center: [number, number]): void;
  getZoom(): number;
  on(event: string, handler: (event: {lnglat: {getLng(): number; getLat(): number}}) => void): void;
}
export interface ClusterPoint {lnglat:[number,number];pointId:string}
export interface ClusterRender {marker:AMapMarker;count:number;data?:ClusterPoint|ClusterPoint[]}
export interface AMapCluster {setMap(map:AMapInstance|null):void}
export interface AMapInfoWindow {open(map:AMapInstance,position:[number,number]):void;close():void;setContent(content:HTMLElement):void}
export interface AMapNamespace {
  MarkerCluster?: new(map:AMapInstance, points:ClusterPoint[], options:Record<string,unknown>)=>AMapCluster;
  InfoWindow:new(options:Record<string,unknown>)=>AMapInfoWindow;
  plugin?(names:string[],callback:()=>void):void;
  Map: new (container: HTMLElement, options: Record<string, unknown>) => AMapInstance;
  Marker: new (options: Record<string, unknown>) => AMapMarker;
  Pixel: new (x: number, y: number) => unknown;
}
let loader: Promise<AMapNamespace> | undefined;
function mapWindow() {
  return window as typeof window & {AMap?: AMapNamespace; _AMapSecurityConfig?: {securityJsCode: string}};
}
// 沿用龙安的JS API 2.0配置方式；配置从本项目环境变量注入。
export function loadAmapJsApi(): Promise<AMapNamespace> {
  const host=mapWindow();
  if (host.AMap) return Promise.resolve(host.AMap);
  if (loader) return loader;
  const key=import.meta.env.VITE_AMAP_JS_KEY || import.meta.env.VITE_AMAP_KEY;
  if (!key) return Promise.reject(new Error('缺少高德地图配置'));
  if (import.meta.env.VITE_AMAP_SECURITY_JS_CODE) host._AMapSecurityConfig={securityJsCode:import.meta.env.VITE_AMAP_SECURITY_JS_CODE};
  loader=new Promise<AMapNamespace>((resolve,reject)=>{
    const script=document.createElement('script');
    const fail=(message:string)=>{window.clearTimeout(timer);script.remove();reject(new Error(message));};
    const timer=window.setTimeout(()=>fail('高德地图加载超时，请重试'),15000);
    script.src=`https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`;
    script.async=true;
    script.onload=()=>{window.clearTimeout(timer);host.AMap?resolve(host.AMap):fail('高德地图初始化失败');};
    script.onerror=()=>fail('高德地图加载失败，请检查网络后重试');
    document.head.appendChild(script);
  }).catch(error=>{loader=undefined;throw error;});
  return loader;
}

export async function loadAmapCluster() {
  const amap=await loadAmapJsApi();
  if(amap.MarkerCluster)return amap;
  await new Promise<void>((resolve,reject)=>{
    const timer=window.setTimeout(()=>reject(new Error('地图聚合插件加载超时')),12000);
    if(!amap.plugin){window.clearTimeout(timer);reject(new Error('地图聚合插件不可用'));return;}
    amap.plugin(['AMap.MarkerCluster'],()=>{window.clearTimeout(timer);amap.MarkerCluster?resolve():reject(new Error('地图聚合插件加载失败'));});
  });
  return amap;
}
