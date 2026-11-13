import type { DailyManifest } from '../mock/daily-manifests';
import { manifestPage, manifestTitle, renderManifestPage } from './manifest-template';

export async function printManifest(document: DailyManifest) {
 const canvas = await renderManifestPage(document);
 const frame = window.document.createElement('iframe');
 frame.title = '联单打印';
 frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:688px;height:274px;border:0';
 window.document.body.appendChild(frame);
 // 打印使用独立文档，避免后台布局及抽屉样式进入纸张。
 const cleanup = () => { clearTimeout(timer); frame.remove(); };
 const timer = window.setTimeout(cleanup, 300000);
 try {
  const target = frame.contentDocument!;
  target.title = manifestTitle;
  const style = target.createElement('style');
  style.textContent = `@page{size:${manifestPage.width / 96 * 25.4}mm ${manifestPage.height / 96 * 25.4}mm;margin:0}html,body{margin:0;padding:0}img{display:block;width:${manifestPage.width}px;height:${manifestPage.height}px}`;
  target.head.appendChild(style);
  const image = target.createElement('img');
  image.alt = manifestTitle;
  image.src = canvas.toDataURL('image/png');
  target.body.appendChild(image);
  await image.decode();
  frame.contentWindow!.addEventListener('afterprint', cleanup, { once: true });
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
 } catch (error) {
  cleanup();
  throw error;
 }
}
