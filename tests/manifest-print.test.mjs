import test from 'node:test';
import assert from 'node:assert/strict';
import { manifestPrintHtml } from '../src/utils/manifest-print-layout.ts';
import { manifestPaper } from '../src/utils/manifest-template.ts';

const document = {
 id: 'preview', number: '202611130001', merchant: '示例商户', kg: 128,
 vehicles: ['川A·DEMO01'], drivers: ['示例司机'],
 carrier: { name: '示例收运单位', seal: '/carrier.png' },
 processor: { name: '示例处理单位', seal: '/processor.png' },
 collectionDate: '2026-11-13 08:10:00', processingDate: '2026-11-13',
};

test('三等分连续纸按241mm×11英寸的三分之一声明页面，不把复写联数作为页数', () => {
 assert.equal(manifestPaper.widthMm, 241);
 assert.ok(Math.abs(manifestPaper.heightMm - 93.1333333333) < 0.0001);
 const html = manifestPrintHtml(document);
 assert.ok(html.includes(`size: 241mm ${manifestPaper.heightMm}mm`));
 assert.equal((html.match(/<main /g) ?? []).length, 1);
 assert.equal((html.match(/<tr>/g) ?? []).length, 6);
 assert.ok(html.includes('<table>'));
 assert.ok(html.includes('128 kg'));
 assert.equal((html.match(/<img /g) ?? []).length, 2);
 assert.ok(!html.includes('<canvas'));
 assert.ok(!html.includes('image/jpeg'));
});

test('原生打印转义商户、编号、单位与章URL，时间缺失留白', () => {
 const html = manifestPrintHtml({ ...document, merchant: '<script>alert(1)</script>',
  number: '"编号&', collectionDate: undefined, processingDate: undefined,
  carrier: { name: '<收运>', seal: 'x" onerror="alert(1)' },
 });
 assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(html.includes('&quot;编号&amp;'));
 assert.ok(html.includes('src="x&quot; onerror=&quot;alert(1)"'));
 assert.ok(html.includes('<th>收运时间</th><td></td><th>接收时间</th><td></td>'));
});
