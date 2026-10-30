<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue';
import {IconSearch,IconPlus,IconMinus} from '@arco-design/web-vue/es/icon';
import {Message} from '@arco-design/web-vue';
import {loadEditorAmap,type EditorAmap,type MouseTool,type MapShape,type SearchPoi} from '../utils/amap-editor';
import type {AMapInstance,AMapMarker} from '../utils/amap';
import type {PointFence} from '../mock/operations';
const props=defineProps<{position:[number,number];fence?:PointFence}>();
const emit=defineEmits<{pick:[position:[number,number]];fence:[value:PointFence|undefined];address:[value:string]}>();
const element=ref<HTMLElement>();
const loading=ref(false),error=ref(''),keyword=ref(''),searching=ref(false);
const results=ref<SearchPoi[]>([]);
const shapeType=ref<'circle'|'polygon'>('polygon');
const drawing=ref(false);
const hint=computed(()=>drawing.value ? shapeType.value==='circle'?'按住鼠标拖动绘制圆形，松开完成':'依次点击绘制多边形，双击完成' : '点击地图定位收集点；可绘制收集范围');
let amap:EditorAmap|undefined,map:AMapInstance|undefined,marker:AMapMarker|undefined,tool:MouseTool|undefined,shape:MapShape|undefined;
let observer:ResizeObserver|undefined,disposed=false,searchVersion=0;
const paint={strokeColor:'#165DFF',strokeWeight:2,fillColor:'#165DFF',fillOpacity:.15};
function drawPosition(){
  if(!map||!amap)return;
  marker?.setMap(null);
  marker=new amap.Marker({position:props.position,title:'收集点位置'});marker.setMap(map);
}
function drawFence(){
  shape?.setMap(null);shape=undefined;
  if(!map||!amap||!props.fence)return;
  shape=props.fence.type==='circle'?new amap.Circle({...paint,center:props.fence.center,radius:props.fence.radius}):new amap.Polygon({...paint,path:props.fence.path});
  shape.setMap(map);
}
function cancelDrawing(){tool?.close(true);drawing.value=false;drawFence();}
function startDrawing(){
  if(!tool)return;
  tool.close(true);shape?.setMap(null);drawing.value=true;
  if(shapeType.value==='circle')tool.circle(paint);else tool.polygon(paint);
}
function clearFence(){cancelDrawing();emit('fence',undefined);}
function setShapeType(value:'circle'|'polygon'){cancelDrawing();shapeType.value=value;}
function choosePoi(poi:SearchPoi){
  if(!poi.location)return;
  const position:[number,number]=[poi.location.getLng(),poi.location.getLat()];
  emit('pick',position);map?.setZoomAndCenter(16,position);
  emit('address',`${poi.pname??''}${poi.cityname??''}${poi.adname??''}${poi.address??''}${poi.name}`);
  results.value=[];keyword.value=poi.name;
}
function search(){
  if(!keyword.value.trim()||!amap?.PlaceSearch||searching.value)return;
  searching.value=true;const version=++searchVersion;
  const searcher=new amap.PlaceSearch({city:'成都市温江区',citylimit:true,pageSize:5});
  const timeout=window.setTimeout(()=>{if(!disposed&&version===searchVersion){searchVersion++;searching.value=false;Message.warning('地址搜索超时，请重试');}},12000);
  searcher.search(keyword.value.trim(),(status,result)=>{
    window.clearTimeout(timeout);if(disposed||version!==searchVersion)return;
    searching.value=false;results.value=status==='complete'?(result.poiList?.pois??[]).filter(p=>p.location):[];
    if(!results.value.length)Message.info('未找到地址，请调整关键字或直接在地图选点');
  });
}
async function init(){
  if(loading.value||map)return;loading.value=true;error.value='';
  try{
    amap=await loadEditorAmap();if(disposed||!element.value)return;
    map=new amap.Map(element.value,{center:props.position,zoom:15,viewMode:'2D',resizeEnable:true});
    tool=new amap.MouseTool!(map);
    tool.on('draw',event=>{
      if(!drawing.value)return;
      if(shapeType.value==='circle'){
        const center=event.obj.getCenter?.();const radius=event.obj.getRadius?.();
        if(center&&radius){const position:[number,number]=[center.getLng(),center.getLat()];emit('fence',{type:'circle',center:position,radius:Math.round(radius)});emit('pick',position);}
      }else{
        const path=event.obj.getPath?.().map(p=>[p.getLng(),p.getLat()] as [number,number])??[];
        if(path.length>=3)emit('fence',{type:'polygon',path});
      }
      tool?.close(true);drawing.value=false;
    });
    map.on('click',event=>{if(!drawing.value)emit('pick',[Number(event.lnglat.getLng().toFixed(6)),Number(event.lnglat.getLat().toFixed(6))]);});
    drawPosition();drawFence();observer=new ResizeObserver(()=>map?.resize());observer.observe(element.value);
  }catch(cause){error.value=(cause as Error).message;}finally{loading.value=false;}
}
function zoom(delta:number){if(map)map.setZoomAndCenter(Math.min(20,Math.max(3,map.getZoom()+delta)),props.position);}
watch(()=>props.position,drawPosition,{deep:true});watch(()=>props.fence,drawFence,{deep:true});
onMounted(()=>{void init();});
onBeforeUnmount(()=>{disposed=true;searchVersion++;observer?.disconnect();tool?.close(true);marker?.setMap(null);shape?.setMap(null);map?.destroy();});
</script>
<template>
  <div class="point-edit-map">
    <div ref="element" class="edit-amap" aria-label="收集点位置和范围编辑地图"/>
    <div class="geometry-toolbar">
      <div class="address-search"><a-input v-model="keyword" placeholder="输入关键字搜索温江区地址" aria-label="地图地址搜索" allow-clear @press-enter="search"><template #suffix><a-button type="text" size="mini" aria-label="搜索地图地址" :loading="searching" @click="search"><IconSearch/></a-button></template></a-input>
        <div v-if="results.length" class="search-results"><button v-for="(poi,index) in results" :key="index" type="button" @click="choosePoi(poi)"><strong>{{poi.name}}</strong><span>{{poi.address}}</span></button></div>
      </div>
      <div class="drawing-tools"><a-button-group><a-button :type="shapeType==='circle'?'primary':'secondary'" size="small" @click="setShapeType('circle')">圆形</a-button><a-button :type="shapeType==='polygon'?'primary':'secondary'" size="small" @click="setShapeType('polygon')">多边形</a-button></a-button-group><a-button size="small" :disabled="!drawing" @click="cancelDrawing">取消绘制</a-button><a-button size="small" type="primary" :disabled="loading||!!error" @click="startDrawing">开始绘制</a-button></div>
    </div>
    <div class="map-edit-hint">{{hint}}<a-button v-if="fence" type="text" size="mini" @click="clearFence">清除范围</a-button></div>
    <div class="edit-zoom"><a-button size="mini" aria-label="编辑地图放大" @click="zoom(1)"><IconPlus/></a-button><a-button size="mini" aria-label="编辑地图缩小" @click="zoom(-1)"><IconMinus/></a-button></div>
    <div v-if="loading||error" class="geometry-feedback"><a-spin v-if="loading"/><span>{{error||'高德地图加载中'}}</span><a-button v-if="error" size="small" @click="init">重试</a-button></div>
  </div>
</template>
<style scoped>
.point-edit-map{position:relative;height:100%;min-height:540px;border-radius:4px;overflow:hidden;background:var(--color-fill-2)}.edit-amap{width:100%;height:100%;min-height:540px}.geometry-toolbar{position:absolute;top:12px;left:12px;right:12px;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;z-index:5}.address-search{width:270px;max-width:100%;position:relative;box-shadow:0 2px 10px #0001}.drawing-tools{display:flex;gap:6px;flex-wrap:wrap;background:var(--color-bg-2);padding:4px;border-radius:4px;box-shadow:0 2px 10px #0001}.search-results{position:absolute;top:36px;left:0;right:0;background:var(--color-bg-2);box-shadow:0 3px 12px #0002;border-radius:4px}.search-results button{border:0;background:none;display:flex;flex-direction:column;gap:4px;padding:10px 12px;text-align:left;width:100%;cursor:pointer;color:var(--color-text-1)}.search-results button:hover{background:var(--color-fill-2)}.search-results span{color:var(--color-text-3);font-size:12px}.map-edit-hint{position:absolute;left:12px;bottom:28px;max-width:calc(100% - 75px);padding:6px 10px;background:var(--color-bg-2);border-radius:4px;font-size:12px;box-shadow:0 2px 10px #0001}.edit-zoom{position:absolute;bottom:28px;right:12px;display:flex;flex-direction:column;gap:2px}.geometry-feedback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:10px;background:var(--color-bg-2);z-index:8}
</style>
