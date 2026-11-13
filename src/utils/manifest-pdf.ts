import type { DailyManifest } from '../mock/daily-manifests';
import { printManifest } from './manifest-print';

// 交由浏览器“另存为PDF”输出原生文字，避免JPEG整页PDF的栅格化与压缩损失。
export async function downloadManifestPdf(document: DailyManifest) {
 await printManifest(document);
}
