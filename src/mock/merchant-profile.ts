import {currentOrganization} from './manifest-templates.ts';
import type { DemoState, Merchant } from './types.ts';
export function merchantProfile(state: DemoState, merchant: Merchant) {
  const bins = state.bins.filter(b => b.merchantId === merchant.id && b.status === '在用');
  return {
    ...merchant,
    organization: currentOrganization.name,
    bucket120: merchant.allocatedBins?.[120] ?? bins.filter(b => b.spec === 120).length,
    bucket240: merchant.allocatedBins?.[240] ?? bins.filter(b => b.spec === 240).length,
    bucket660: merchant.allocatedBins?.[660] ?? bins.filter(b => b.spec === 660).length,
    license: merchant.license ?? '示例门店外观、营业场所照片（模拟附件说明，无真实商户影像）',
  };
}
export const merchantPhoto = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300"><rect width="480" height="300" fill="#eef2f7"/><path d="M140 180h200v-85H140zm-10-85h220l-25-35H155z" fill="#c4cedc"/><text x="240" y="230" text-anchor="middle" font-size="22" fill="#58677c">商户照片 · 模拟占位</text></svg>');
