import { manifestSealCaptions } from '../mock/manifest-seals.ts';

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({
 '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

// 每个字独立沿圆周排版；打印时保留SVG文字、线条及星形，不使用位图。
export function manifestSealSvg(kind: 'carrier' | 'processor', unitName: string) {
 const title = kind === 'carrier' ? unitName : manifestSealCaptions.processor;
 const chars = Array.from(title);
 const sweep = chars.length > 16 ? 248 : 210;
 const letters = chars.map((char, index) => {
  const angle = -90 - sweep / 2 + (chars.length > 1 ? index * sweep / (chars.length - 1) : sweep / 2);
  const radians = angle * Math.PI / 180;
  const x = 150 + 117 * Math.cos(radians), y = 150 + 117 * Math.sin(radians);
  return `<text transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${(angle + 90).toFixed(3)})">${escape(char)}</text>`;
 }).join('');
 const points = Array.from({ length: 10 }, (_, i) => {
  const radians = (-90 + i * 36) * Math.PI / 180, radius = i % 2 === 0 ? 42 : 17;
  return `${(150 + radius * Math.cos(radians)).toFixed(3)},${(139 + radius * Math.sin(radians)).toFixed(3)}`;
 }).join(' ');
 return `<svg xmlns="http://www.w3.org/2000/svg" class="seal seal-${kind}" viewBox="0 0 300 300" role="img" aria-label="${escape(title)} ${manifestSealCaptions.purpose}">
<title>${escape(title)} ${manifestSealCaptions.purpose}</title>
<circle cx="150" cy="150" r="143" fill="none" stroke="#c71925" stroke-width="6"/>
<g fill="#c71925" font-family="SimHei,Microsoft YaHei,PingFang SC,sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="central" font-size="${chars.length > 16 ? 21 : 27}">${letters}</g>
<polygon fill="#c71925" points="${points}"/>
<text x="150" y="229" fill="#c71925" font-family="SimHei,Microsoft YaHei,PingFang SC,sans-serif" font-size="26" font-weight="700" text-anchor="middle">${manifestSealCaptions.purpose}</text>
</svg>`;
}
