import {loadAmapJsApi, type AMapNamespace, type AMapInstance} from './amap';
export interface LngLat {getLng():number;getLat():number}
export interface MapShape {
  setMap(map:AMapInstance|null):void;
  getCenter?():LngLat;
  getRadius?():number;
  getPath?():LngLat[];
}
export interface MouseTool {
  circle(options:Record<string,unknown>):void;
  polygon(options:Record<string,unknown>):void;
  close(clear?:boolean):void;
  on(event:'draw',handler:(event:{obj:MapShape})=>void):void;
}
export interface SearchPoi {name:string;address?:string;pname?:string;cityname?:string;adname?:string;location?:LngLat}
export interface EditorAmap extends AMapNamespace {
  Circle:new(options:Record<string,unknown>)=>MapShape;
  Polygon:new(options:Record<string,unknown>)=>MapShape;
  MouseTool?:new(map:AMapInstance)=>MouseTool;
  PlaceSearch?:new(options:Record<string,unknown>)=>{search(keyword:string,callback:(status:string,result:{poiList?:{pois:SearchPoi[]};info?:string})=>void):void};
}
export async function loadEditorAmap() {
  const amap=await loadAmapJsApi() as EditorAmap;
  if(amap.MouseTool&&amap.PlaceSearch)return amap;
  await new Promise<void>((resolve,reject)=>{
    const timer=window.setTimeout(()=>reject(new Error('地图编辑工具加载超时，请重试')),12000);
    if(!amap.plugin){window.clearTimeout(timer);reject(new Error('地图编辑工具不可用'));return;}
    amap.plugin(['AMap.MouseTool','AMap.PlaceSearch'],()=>{window.clearTimeout(timer);amap.MouseTool&&amap.PlaceSearch?resolve():reject(new Error('地图编辑工具加载失败'));});
  });return amap;
}
