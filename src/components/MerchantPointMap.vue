<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import { IconFullscreen, IconFullscreenExit, IconRefresh, IconMinus, IconPlus, IconList, IconClose, IconEdit } from '@arco-design/web-vue/es/icon';
import { loadAmapCluster, type AMapNamespace, type AMapInstance, type AMapMarker, type AMapCluster, type ClusterRender } from '../utils/amap';
import type { Point } from '../mock/operations';
import { pointLocation, WENJIANG_CENTER } from '../mock/point-location';
import { lineColors, merchantMapStyle } from '../mock/merchant-map';
import { demo, merchantName } from '../mock/store';
import { currentOrganization } from '../mock/manifest-templates';
import { collectionLines } from '../mock/collection-lines';
const props=defineProps<{points:Point[];selectedId:string}>();
const emit=defineEmits<{select:[id:string];edit:[point:Point]}>();
const container=ref<HTMLElement>();
const frame=ref<HTMLElement>();
const loading=ref(false);
const error=ref('');
const theme=ref('whitesmoke');
const fullscreen=ref(false);
let amap:AMapNamespace|undefined;
let map:AMapInstance|undefined;
let cluster:AMapCluster|undefined;
const legendVisible=ref(false);
const selectedPoint=computed(()=>props.points.find(point=>point.id===props.selectedId));
const selectedStyle=computed(()=>selectedPoint.value ? merchantMapStyle(demo,selectedPoint.value.merchantId) : undefined);
let disposed=false;
let observer:ResizeObserver|undefined;
const markerTargets=new WeakMap<AMapMarker,string|undefined>();
const boundMarkers=new WeakSet<AMapMarker>();
function resetView(){emit('select','');map?.setZoomAndCenter(13,WENJIANG_CENTER);}
function bindMarker(marker:AMapMarker){
  if(boundMarkers.has(marker))return;
  boundMarkers.add(marker);
  marker.on('click',()=>{
    const id=markerTargets.get(marker);
    if(id)emit('select',id);
    else {const position=marker.getPosition();map?.setZoomAndCenter(Math.min(18,(map?.getZoom()??13)+2),[position.getLng(),position.getLat()]);}
  });
}
function draw(){
  if(!map||!amap?.MarkerCluster)return;
  cluster?.setMap(null);
  cluster=new amap.MarkerCluster(map,props.points.map(point=>({lnglat:pointLocation(point),pointId:point.id})),{
    gridSize:65,maxZoom:16,averageCenter:true,
    renderClusterMarker:({marker,count}:ClusterRender)=>{
      markerTargets.set(marker,undefined);
      const node=document.createElement('div');node.className='merchant-cluster-marker';node.textContent=String(count);node.title=`${count}个收集点，点击放大`;node.setAttribute('aria-label',node.title);
      marker.setOffset(new amap!.Pixel(-19,-19));marker.setContent(node);bindMarker(marker);
    },
    renderMarker:({marker,data}:ClusterRender)=>{
      const row=Array.isArray(data)?data[0]:data;
      const point=props.points.find(point=>point.id===row?.pointId);
      if(!point)return;
      markerTargets.set(marker,point.id);
      const style=merchantMapStyle(demo,point.merchantId);
      const node=document.createElement('div');node.className=`merchant-map-marker${point.id===props.selectedId?' selected':''}`;
      node.dataset.pointId=point.id;node.style.backgroundColor=style.color;node.textContent=String(style.buckets);node.title=`${point.name} · ${style.line} · ${style.buckets}个桶`;node.setAttribute('aria-label',node.title);
      marker.setOffset(new amap!.Pixel(-13,-13));marker.setContent(node);bindMarker(marker);
    },
  });
}
async function init(){
  if(loading.value||map)return;
  loading.value=true;error.value='';
  try{
    amap=await loadAmapCluster();
    if(disposed||!container.value)return;
    map=new amap.Map(container.value,{center:WENJIANG_CENTER,zoom:13,viewMode:'2D',resizeEnable:true,mapStyle:`amap://styles/${theme.value}`,animateEnable:false});
    draw();observer=new ResizeObserver(()=>map?.resize());observer.observe(container.value);
  }catch(cause){error.value=cause instanceof Error?cause.message:'地图加载失败';}
  finally{loading.value=false;}
}
function zoom(delta:number){if(map)map.setZoomAndCenter(Math.min(20,Math.max(3,map.getZoom()+delta)),props.points.find(p=>p.id===props.selectedId)?pointLocation(props.points.find(p=>p.id===props.selectedId)!):WENJIANG_CENTER);}
function fullscreenChanged(){fullscreen.value=document.fullscreenElement===frame.value;nextTick(()=>map?.resize());}
async function toggleFullscreen(){if(document.fullscreenElement)await document.exitFullscreen();else await frame.value?.requestFullscreen();}
watch(()=>props.points,()=>{draw();},{deep:true});
watch(()=>props.selectedId,()=>{const point=props.points.find(point=>point.id===props.selectedId);if(point)map?.setZoomAndCenter(Math.max(map.getZoom(),16),pointLocation(point));container.value?.querySelectorAll<HTMLElement>('.merchant-map-marker').forEach(node=>node.classList.toggle('selected',node.dataset.pointId===props.selectedId));});
watch(()=>demo.merchants.map(m=>[m.lineId,m.allocatedBins]),()=>{draw();},{deep:true});
watch(theme,value=>map?.setMapStyle(`amap://styles/${value}`));
onMounted(()=>{document.addEventListener('fullscreenchange',fullscreenChanged);void init();});
function cleanup(){disposed=true;observer?.disconnect();cluster?.setMap(null);cluster=undefined;map?.destroy();map=undefined;}
onActivated(()=>{disposed=false;void init();});
onDeactivated(cleanup);
onBeforeUnmount(()=>{cleanup();document.removeEventListener('fullscreenchange',fullscreenChanged);});
</script>
<template>
  <div ref="frame" class="merchant-map-frame">
    <div ref="container" class="merchant-amap" aria-label="成都市温江区商户收集点高德地图"/>
    <div class="map-stat"><span>收集点</span><strong>{{points.length}}</strong><small>个</small></div>
    <div class="map-tools"><a-select v-model="theme" aria-label="地图主题" size="small" style="width:84px" :options="[{label:'标准',value:'normal'},{label:'浅色',value:'whitesmoke'},{label:'深色',value:'dark'}]"/><a-tooltip content="刷新地图视野"><a-button size="small" aria-label="刷新地图" @click="resetView"><IconRefresh/></a-button></a-tooltip><a-button size="small" :aria-label="fullscreen?'退出全屏':'全屏地图'" @click="toggleFullscreen"><IconFullscreenExit v-if="fullscreen"/><IconFullscreen v-else/></a-button></div>
    <div class="map-zoom"><a-button size="small" aria-label="放大地图" @click="zoom(1)"><IconPlus/></a-button><a-button size="small" aria-label="缩小地图" @click="zoom(-1)"><IconMinus/></a-button></div>
    <div class="map-legend-toggle"><a-tooltip content="线路图例"><a-button size="small" aria-label="线路颜色图例" :aria-expanded="legendVisible" :type="legendVisible?'primary':'secondary'" @click="legendVisible=!legendVisible"><IconList/></a-button></a-tooltip></div>
    <section v-if="legendVisible" class="line-legend" aria-label="线路颜色图例内容"><div class="legend-heading"><strong>线路图例</strong><a-button type="text" size="mini" aria-label="关闭线路图例" @click="legendVisible=false"><IconClose/></a-button></div><div class="legend-grid"><span v-for="(line,index) in collectionLines" :key="line.id"><i :style="{background:lineColors[index]}"/>{{line.name}}</span><span><i style="background:#86909c"/>未设置线路</span></div><p>单点数字：商户桶数<br/>聚合数字：收集点数量</p></section>
    <aside v-if="selectedPoint && selectedStyle" class="map-detail" aria-label="收集点详情">
      <div class="detail-heading"><h3>{{selectedPoint.name.replace(/收集点\d*$/,'')}}</h3><a-space :size="2"><a-tooltip content="编辑收集点"><a-button type="text" size="mini" aria-label="编辑收集点" @click="emit('edit',selectedPoint)"><IconEdit/></a-button></a-tooltip><a-button type="text" size="mini" aria-label="关闭收集点详情" @click="emit('select','')"><IconClose/></a-button></a-space></div>
      <div class="detail-body"><span class="line-badge" :style="{color:selectedStyle.color,borderColor:selectedStyle.color}">{{selectedStyle.line}}</span><div class="bucket-total"><span>商户垃圾桶数</span><strong>{{selectedStyle.buckets}}<small> 个</small></strong></div><a-descriptions :column="1" layout="vertical"><a-descriptions-item label="所属商户">{{merchantName(selectedPoint.merchantId)}}</a-descriptions-item><a-descriptions-item label="点位分类">{{selectedPoint.category || '—'}}</a-descriptions-item><a-descriptions-item label="预估垃圾量">{{Number(selectedPoint.estimatedKg).toFixed(2)}} 千克</a-descriptions-item><a-descriptions-item label="地址">{{selectedPoint.address}}</a-descriptions-item><a-descriptions-item label="所属机构">{{currentOrganization.name}}</a-descriptions-item></a-descriptions></div>
    </aside>
    <div v-if="loading||error" class="map-feedback"><a-spin v-if="loading"/><span>{{error||'高德地图加载中'}}</span><a-button v-if="error" size="small" @click="init">重试</a-button></div>
  </div>
</template>
<style scoped>
.merchant-map-frame{position:relative;height:640px;min-height:440px;border-radius:6px;overflow:hidden;background:var(--color-fill-2);border:1px solid var(--color-border-2)}.merchant-map-frame:fullscreen{height:100vh;width:100vw}.merchant-amap{height:100%;width:100%}.map-stat,.map-tools,.map-zoom{position:absolute;z-index:10;background:var(--color-bg-2);box-shadow:0 2px 10px #00000014;border-radius:6px;display:flex;align-items:center;gap:10px;padding:10px 12px}.map-stat{top:16px;left:16px}.map-stat strong{font-size:24px;color:rgb(var(--primary-6))}.map-stat small{color:var(--color-text-3)}.map-tools{top:12px;right:12px;gap:5px;padding:5px 6px}.map-zoom{bottom:30px;left:12px;flex-direction:column;gap:2px;padding:3px}.map-tools :deep(.arco-btn),.map-zoom :deep(.arco-btn){width:24px;min-width:24px;height:24px;padding:0}.map-tools :deep(.arco-icon),.map-zoom :deep(.arco-icon){font-size:12px}.map-tools :deep(.arco-select-view){height:24px;font-size:12px;padding:0 8px}.map-feedback{position:absolute;inset:0;z-index:20;display:flex;gap:12px;align-items:center;justify-content:center;background:var(--color-bg-2)}:deep(.merchant-map-marker){width:26px;height:26px;box-sizing:border-box;border:2px solid white;border-radius:50%;color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px #1d212940;cursor:pointer}:deep(.merchant-map-marker.selected){box-shadow:0 0 0 4px #165dff44;transform:scale(1.12)}:deep(.merchant-cluster-marker){width:38px;height:38px;box-sizing:border-box;border:4px solid #dce8ff;border-radius:50%;background:#165dff;color:white;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px #1d212930;cursor:pointer}@media(max-width:700px){.map-tools{top:72px;left:12px;right:auto;gap:5px}.map-stat{left:12px}}

.map-legend-toggle{position:absolute;bottom:30px;left:50px;z-index:10;background:var(--color-bg-2);padding:3px;border-radius:5px;box-shadow:0 2px 10px #00000014}.map-legend-toggle :deep(.arco-btn){width:24px;min-width:24px;height:24px;padding:0}.map-legend-toggle :deep(.arco-icon){font-size:12px}.line-legend{position:absolute;bottom:70px;left:50px;z-index:15;width:220px;padding:12px;background:var(--color-bg-2);border-radius:6px;box-shadow:0 3px 14px #0002}.legend-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.legend-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px 14px;font-size:12px}.legend-grid span{display:flex;align-items:center;gap:8px}.legend-grid i{height:10px;width:10px;border-radius:50%;flex-shrink:0}.line-legend p{color:var(--color-text-3);font-size:12px;line-height:20px;margin:12px 0 0}.map-detail{position:absolute;z-index:12;top:62px;right:12px;max-height:calc(100% - 78px);width:300px;max-width:calc(100% - 80px);background:var(--color-bg-2);border-radius:6px;box-shadow:0 3px 14px #0002;overflow:auto}.detail-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:12px 14px;border-bottom:1px solid var(--color-border-2)}.detail-heading h3{flex:1;min-width:0;margin:0;font-size:16px;line-height:24px}.detail-body{padding:12px 14px}.line-badge{display:inline-block;padding:2px 8px;border:1px solid;border-radius:3px;font-size:12px}.bucket-total{display:flex;align-items:center;justify-content:space-between;margin:10px 0;padding:8px 10px;background:var(--color-fill-1);border-radius:4px}.bucket-total span{font-size:12px;color:var(--color-text-3)}.bucket-total strong{font-size:22px}.bucket-total small{font-size:12px;font-weight:400}@media(max-width:700px){.map-detail{top:116px;width:270px;max-height:calc(100% - 132px)}.line-legend{left:12px}}
</style>
