import type {DailyManifest} from './daily-manifests';
// 仅补齐原型示例人员及油脂量；交接日期按快照展示，缺失留白。
export function manifestExample(document:DailyManifest):DailyManifest {
 const copy=JSON.parse(JSON.stringify(document)) as DailyManifest;
 copy.receiver=copy.receiver??'示例接收人';
 copy.oilKg=copy.oilKg??0;
 copy.drivers=copy.drivers?.map((driver,i)=>!driver||driver.includes('待接入')?`示例司机${i+1}`:driver);
 copy.vehicleDrivers=(copy.vehicleDrivers??copy.vehicles.map((vehicle,i)=>({vehicle,driver:copy.drivers?.[i]??`示例司机${i+1}`}))).map((p,i)=>({...p,driver:!p.driver||p.driver.includes('待接入')?`示例司机${i+1}`:p.driver}));
 return copy;
}
