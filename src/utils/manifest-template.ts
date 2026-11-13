import type { DailyManifest } from '../mock/daily-manifests';

// 标准磅单1.html：表格宽688px，所有行高合计274px；按96dpi换算。
export const manifestPage = { width: 688, height: 274, scale: 3 } as const;
export const manifestTitle = '成都市温江城投顺源生态环境建设有限公司 餐厨垃圾收运五联单';
export const manifestNotes = '';

export async function renderManifestPage(d: DailyManifest) {
 const { width, height, scale } = manifestPage;
 const canvas = document.createElement('canvas');
 canvas.width = width * scale;
 canvas.height = height * scale;
 const ctx = canvas.getContext('2d')!;
 ctx.scale(scale, scale);
 ctx.fillStyle = '#fff';
 ctx.fillRect(0, 0, width, height);
 // 保持纸张尺寸，正文等比缩小并居中，统一增加四周打印留白。
 const contentScale = 0.88;
 ctx.translate(width * (1 - contentScale) / 2, height * (1 - contentScale) / 2);
 ctx.scale(contentScale, contentScale);
 ctx.fillStyle = '#000';
 ctx.strokeStyle = '#000';
 ctx.lineWidth = 0.75;
 ctx.textBaseline = 'middle';
 const font = (size: number, bold = false) => {
  ctx.font = `${bold ? 'bold ' : ''}${size}px "Songti SC",SimSun,"Noto Serif CJK SC",serif`;
 };
 function text(value: string, x: number, y: number, available: number, size = 13) {
  font(size);
  // 长名称、多车辆及多人时优先折为两行，保持在单元格内。
  let lines: string[] = [];
  while (size >= 7) {
   font(size);
   lines = [''];
   for (const char of value) {
    const last = lines.length - 1;
    if (ctx.measureText(lines[last] + char).width > available) lines.push(char);
    else lines[last] += char;
   }
   if (lines.length <= 2) break;
   size -= 0.5;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y - 12, available, 24);
  ctx.clip();
  lines.forEach((line, i) => ctx.fillText(line, x, y + (i - (lines.length - 1) / 2) * (size + 1)));
  ctx.restore();
 }
 ctx.textAlign = 'center';
 font(14);
 ctx.fillText('成都市温江城投顺源生态环境建设有限公司', width / 2, 15);
 font(17, true);
 ctx.fillText('餐厨垃圾收运五联单', width / 2, 36);
 ctx.textAlign = 'left';
 text(`流水号：${d.number ?? d.id}`, 444, 55, 236, 11);
 const left = 1, right = 680, top = 66, rowHeight = 32, rowCount = 6;
 ctx.strokeRect(left, top, right - left, rowHeight * rowCount);
 const line = (x1: number, y1: number, x2: number, y2: number) => {
  ctx.beginPath();ctx.moveTo(x1, y1);ctx.lineTo(x2, y2);ctx.stroke();
 };
 for (let i = 1; i < rowCount; i++) line(left, top + i * rowHeight, right, top + i * rowHeight);
 line(111, top, 111, top + rowHeight * rowCount);
 for (const index of [2, 5]) {
  line(340, top + rowHeight * index, 340, top + rowHeight * (index + 1));
  line(450, top + rowHeight * index, 450, top + rowHeight * (index + 1));
 }
 const row = (index: number, label: string, value: string, available = 550) => {
  const y = top + rowHeight * (index + 0.5);
  text(label, 9, y, 96);
  text(value, 119, y, available);
 };
 const pairedRow = (index: number, label: string, value: string, otherLabel: string, otherValue: string) => {
  const y = top + rowHeight * (index + 0.5);
  row(index, label, value, 213);
  text(otherLabel, 348, y, 94);
  text(otherValue, 458, y, 214);
 };
 row(0, '产生单位', d.merchant);
 row(1, '收运单位', d.carrier.name, 503);
 pairedRow(2, '收运车辆', d.template?.showVehicles === false ? '' : d.vehicles.join('、'),
  '收运人', d.template?.showCarrierPerson === false ? '' : (d.drivers?.join('、') ?? d.vehicleDrivers?.map(p => p.driver).join('、') ?? ''));
 row(3, '处理单位', d.processor.name, 503);
 row(4, '餐厨垃圾', `${d.kg} kg`);
 // 沿用快照精度：仅有日期时不虚构时分，缺失时留白。
 pairedRow(5, '收运时间', d.collectionDate ?? '', '接收时间', d.processingDate ?? '');
 for (const [unit, index] of [[d.carrier, 1], [d.processor, 3]] as const) {
  if (!unit.seal) continue;
  try {
   const image = new Image();image.src = unit.seal;await image.decode();
   const size = 72, ratio = Math.min(size / image.width, size / image.height);
   ctx.drawImage(image, right - 6 - size + (size - image.width * ratio) / 2, top + rowHeight * (index + 0.5) - image.height * ratio / 2, image.width * ratio, image.height * ratio);
  } catch { /* 印章加载失败时保留正文。 */ }
 }
 return canvas;
}
