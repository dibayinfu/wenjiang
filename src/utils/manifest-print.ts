import type { DailyManifest } from '../mock/daily-manifests';
import { manifestPrintHtml } from './manifest-print-layout';
import { manifestPaper } from './manifest-template';

export async function printManifest(document: DailyManifest) {
 const frame = window.document.createElement('iframe');
 frame.title = '联单打印';
 frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${manifestPaper.widthMm}mm;height:${manifestPaper.heightMm}mm;border:0`;
 const ready = new Promise<void>((resolve, reject) => {
  frame.onload = () => resolve();
  frame.onerror = () => reject(new Error('打印页面加载失败'));
 });
 frame.srcdoc = manifestPrintHtml(document);
 window.document.body.appendChild(frame);
 const cleanup = () => { clearTimeout(timer); frame.remove(); };
 const timer = window.setTimeout(cleanup, 300000);
 try {
  await ready;
  const target = frame.contentDocument!;
  await target.fonts.ready;
  await Promise.all([...target.images].map(image => image.decode()));
  frame.contentWindow!.addEventListener('afterprint', cleanup, { once: true });
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
 } catch (error) {
  cleanup();
  throw error;
 }
}
