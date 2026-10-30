import type { DailyManifest } from '../mock/daily-manifests';
export const manifestNotes='注：1.本联单由餐厨垃圾收运单位向区（市）县城市管理部门申请领取。2.餐厨垃圾产生单位交运时，应当如实填写联单有关内容，经收运单位验收签章后，留存联单第一联。3.收运单位应当按规定将餐厨垃圾随同余下的四联联单运抵处理单位。4.处理单位应当验收运来的餐厨垃圾，核实联单填写的内容，加盖公章后，将联单第二联交收运单位留存；将第三联自留存档；将第四联、第五联分别按规定报送区（市）县城市管理部门和食品药品监督管理、质监、商务、农业等部门备案。';
export async function renderManifestPage(d:DailyManifest){
 const c=document.createElement('canvas');c.width=1324;c.height=1630;const ctx=c.getContext('2d')!;
 ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#111';ctx.strokeStyle='#222';ctx.lineWidth=2;
 const font=(size:number)=>{ctx.font=`${size}px "Songti SC",SimSun,"Noto Serif CJK SC",serif`;};
 function text(value:string,x:number,y:number,width:number,height:number,size=31){font(size);let lines:string[]=[];let line='';for(const ch of value){if(ch==='\n'){lines.push(line);line='';continue;}if(ctx.measureText(line+ch).width>width-30){lines.push(line);line='';}line+=ch;}lines.push(line);while(lines.length*(size+6)>height-12&&size>16){size-=2;font(size);lines=[];line='';for(const ch of value){if(ch==='\n'){lines.push(line);line='';continue;}if(ctx.measureText(line+ch).width>width-30){lines.push(line);line='';}line+=ch;}lines.push(line);}lines.forEach((t,i)=>ctx.fillText(t,x+15,y+(height-lines.length*(size+6))/2+size+i*(size+6)));}
 font(54);ctx.textAlign='center';ctx.fillText(d.template?.title??'成都市餐厨垃圾管理联单',662,145,1200);ctx.textAlign='left';font(30);ctx.fillText('No：',475,260);font(23);ctx.fillText(d.number??d.id,570,260);ctx.beginPath();ctx.moveTo(570,270);ctx.lineTo(1100,270);ctx.stroke();
 const x=28,right=1266;const ys=[276,376,476,577,677,777,877,984,1083,1205,1316];
 ctx.strokeRect(x,ys[0]!,right-x,ys.at(-1)!-ys[0]!);
 for(let i=1;i<ys.length-1;i++){ctx.beginPath();ctx.moveTo(i===6?342:x,ys[i]!);ctx.lineTo(right,ys[i]!);ctx.stroke();}
 function vertical(xx:number,top:number,bottom:number){ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,bottom);ctx.stroke();}
 vertical(342,276,677);vertical(824,476,677);vertical(1018,476,677);vertical(520,677,1316);vertical(342,777,984);
 text('产生单位（盖章）',x,276,314,100);text(d.merchant,342,276,924,100);
 text('收运单位（盖章）',x,376,314,100);text(d.carrier.name,342,376,924,100);
 text('收运车辆',x,476,314,101);text(d.template?.showVehicles===false?'':d.vehicles.join('、'),342,476,482,101,25);text('收运人',824,476,194,101);text(d.template?.showCarrierPerson===false?'':(d.vehicleDrivers?.map(p=>`${p.vehicle}：${p.driver}`).join('；')??d.drivers?.join('、')??'司机待接入'),1018,476,248,101,25);
 text('处理单位（盖章）',x,577,314,100);text(d.processor.name,342,577,482,100,27);text('接收人',824,577,194,100);text(d.receiver??'',1018,577,248,100,25); // 无实际接收证据时留白，不把默认人员当签收人。
 text('种        类',x,677,492,100);text('交运量',520,677,746,100);
 text('餐厨垃圾',x,777,314,207);text('餐厨垃圾',342,777,178,100,29);text('废弃食用\n油脂',342,877,178,107,29);
 text((d.kg/1000).toFixed(3)+' 吨',520,777,746,100);text(d.oilKg===undefined?'吨':(d.oilKg/1000).toFixed(3)+' 吨',520,877,746,107);
 text('总        量',x,984,492,99);text(((d.kg+(d.oilKg??0))/1000).toFixed(3)+' 吨',520,984,746,99); // 当前模板业务范围仅餐厨垃圾。
 const dateText=(value?:string,time=false)=>value?`${value.slice(0,4)}年 ${value.slice(5,7)}月 ${value.slice(8,10)}日${time&&value.length>=16?` ${value.slice(11,13)}时 ${value.slice(14,16)}分`:''}`:'年       月       日';
 text('收运单位接收日期',x,1083,492,122);text(dateText(d.collectionDate,true),535,1083,731,122,27);
 text('处理单位接收日期',x,1205,492,111);text(dateText(d.processingDate),535,1205,731,111,27);
 for(const [unit,xx,yy] of [[d.carrier,1060,378],[d.processor,650,578]] as const){if(!unit.seal)continue;try{const img=new Image();img.src=unit.seal;await img.decode();ctx.drawImage(img,xx,yy,95,95);}catch{}}
 font(27);let line='',row=0;for(const char of (d.template?.notes??manifestNotes)){if(ctx.measureText(line+char).width>1238){ctx.fillText(line,28,1350+row*35);row++;line='';}line+=char;}ctx.fillText(line,28,1350+row*35);
 font(18);ctx.fillStyle='#777';ctx.fillText('产品原型模拟文书 · 非正式凭证',28,1600);return c;
}
