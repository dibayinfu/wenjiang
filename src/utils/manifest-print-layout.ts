import type { DailyManifest } from '../mock/daily-manifests';
import { manifestPaper, manifestTitle } from './manifest-template.ts';

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({
 '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

// 预览、直接打印、另存PDF共用原生文字与表格，不再将整张联单转成图片。
export function manifestPrintHtml(d: DailyManifest) {
 const seal = (source: string, label: string) => source
  ? `<img class="seal" src="${escape(source)}" alt="${label}印章">` : '';
 const fullRow = (label: string, value: string, stamp = '') =>
  `<tr><th>${label}</th><td colspan="3">${escape(value)}${stamp}</td></tr>`;
 const pairedRow = (label: string, value: string, otherLabel: string, otherValue: string) =>
  `<tr><th>${label}</th><td>${escape(value)}</td><th>${otherLabel}</th><td>${escape(otherValue)}</td></tr>`;
 const vehicles = d.template?.showVehicles === false ? '' : d.vehicles.join('、');
 const drivers = d.template?.showCarrierPerson === false ? '' :
  (d.drivers?.join('、') ?? d.vehicleDrivers?.map(item => item.driver).join('、') ?? '');
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>${escape(`${d.number ?? d.id} ${manifestTitle}`)}</title>
<style>
@page { size: ${manifestPaper.widthMm}mm ${manifestPaper.heightMm}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: white; color: black; }
body { font-family: SimSun, "Songti SC", "Noto Serif CJK SC", serif; font-size: 10pt; }
.paper { width: ${manifestPaper.widthMm}mm; height: ${manifestPaper.heightMm}mm; padding: 7mm 16mm; display: flex; flex-direction: column; justify-content: center; break-inside: avoid; }
.company { text-align: center; font-size: 11pt; line-height: 5mm; margin: 0; font-weight: normal; }
h1 { text-align: center; font-size: 13pt; line-height: 6mm; margin: 0 0 1mm; }
.number { text-align: right; font-size: 9pt; line-height: 5mm; margin: 0 0 1mm; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 0.25mm solid black; }
col.label { width: 16%; } col.value { width: 34%; }
tr { height: 8mm; break-inside: avoid; }
th, td { border: 0.25mm solid black; padding: 1mm 2mm; text-align: left; vertical-align: middle; font-weight: normal; line-height: 1.2; overflow-wrap: anywhere; }
td { position: relative; }
.seal { position: absolute; right: 1mm; top: 50%; transform: translateY(-50%); width: 22mm; height: 22mm; object-fit: contain; }
</style></head><body><main class="paper">
<p class="company">成都市温江城投顺源生态环境建设有限公司</p>
<h1>餐厨垃圾收运五联单</h1>
<p class="number">流水号：${escape(d.number ?? d.id)}</p>
<table><colgroup><col class="label"><col class="value"><col class="label"><col class="value"></colgroup><tbody>
${fullRow('产生单位', d.merchant)}
${fullRow('收运单位', d.carrier.name, seal(d.carrier.seal, '收运单位'))}
${pairedRow('收运车辆', vehicles, '收运人', drivers)}
${fullRow('处理单位', d.processor.name, seal(d.processor.seal, '处理单位'))}
${fullRow('餐厨垃圾', `${d.kg} kg`)}
${pairedRow('收运时间', d.collectionDate ?? '', '接收时间', d.processingDate ?? '')}
</tbody></table></main></body></html>`;
}
