import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceTask,
  finishTask,
  chinaDate,
  createSeed,
  isDemoState,
  summarize,
} from "../src/mock/model.ts";
import { handleAlert, records, shiftDate } from "../src/mock/operations.ts";
import {
  aggregateRows,
  periodRange,
  reportRecords,
} from "../src/mock/reporting.ts";
import { encodeCsv } from "../src/utils/csv.ts";
const date = "2026-10-29";
test("23台车辆、商户点位设备关联完整，统计与明细一致", () => {
  const s = createSeed(date);
  assert.equal(s.fleet.length, 23);
  assert.equal(s.merchants.length, 28);
  assert.equal(s.tasks.length, 24);
  assert.equal(s.points.length, 28);
  assert.ok(isDemoState(s, date));
  const stats = summarize(s);
  assert.equal(stats.completed, 12);
  assert.equal(stats.completed + stats.pending + stats.running, stats.total);
  assert.equal(
    stats.totalKg,
    reportRecords(s, date, "日").reduce((n, r) => n + r.kg, 0),
  );
});
test("收运只能向前推进，录入净重后只累加一次，非法重量不改变状态", () => {
  const s = createSeed(date);
  const task = s.tasks.find((t) => t.status === "待收运");
  const before = summarize(s).totalKg;
  assert.throws(() => finishTask(s, task.id, 100), /收运中/);
  assert.equal(advanceTask(s, task.id), true);
  assert.equal(advanceTask(s, task.id), false);
  for (const kg of [-1, Infinity, NaN, 10001])
    assert.throws(() => finishTask(s, task.id, kg), /净重/);
  assert.equal(task.status, "收运中");
  finishTask(s, task.id, 123.4);
  assert.equal(summarize(s).totalKg, before + 123.4);
  assert.throws(() => finishTask(s, task.id, 123.4), /收运中/);
  assert.equal(summarize(s).totalKg, before + 123.4);
  assert.ok(isDemoState(s, date));
  const zero = s.tasks.find((t) => t.status === "收运中");
  finishTask(s, zero.id, 0);
  assert.equal(zero.actualKg, 0);
});
test("告警处理必填、日志留痕、关闭后拒绝重复修改", () => {
  const s = createSeed(date);
  assert.throws(() => handleAlert(s, "AL001", "已关闭", "", ""), /处理人/);
  handleAlert(s, "AL001", "处理中", "示例处理人", "已联系司机");
  assert.equal(s.alerts[0].status, "处理中");
  handleAlert(s, "AL001", "已关闭", "示例处理人", "已复核");
  assert.equal(s.alerts[0].logs.length, 3);
  assert.throws(
    () => handleAlert(s, "AL001", "处理中", "示例处理人", "再次打开"),
    /已关闭/,
  );
  assert.ok(isDemoState(s, date));
});
test("日周月季度年周期与分组守恒，历史不含未来", () => {
  const s = createSeed(date);
  assert.deepEqual(periodRange(date, "周"), ["2026-10-26", "2026-11-01"]);
  assert.deepEqual(periodRange(date, "季度"), ["2026-10-01", "2026-12-31"]);
  assert.deepEqual(periodRange(date, "月"), ["2026-10-01", "2026-10-31"]);
  assert.deepEqual(periodRange("2024-02-29", "月"), [
    "2024-02-01",
    "2024-02-29",
  ]);
  assert.deepEqual(periodRange(date, "年"), ["2026-01-01", "2026-12-31"]);
  for (const period of ["日", "周", "月", "季度", "年"]) {
    const rs = reportRecords(s, date, period);
    const total = rs.reduce((n, r) => n + r.kg, 0);
    for (const dim of ["车辆", "商户", "收运点"])
      assert.equal(
        aggregateRows(s, rs, dim).reduce((n, r) => n + r.kg, 0),
        total,
      );
  }
  assert.equal(reportRecords(s, "2027-10-29", "日").length, 0);
  assert.equal(
    records(s).filter((r) => r.date === shiftDate(date, -1)).length,
    24,
  );
});
test("缓存拒绝过期、重复编号、悬空关联和新增字段损坏", () => {
  const seed = createSeed(date);
  assert.equal(isDemoState(seed, "2026-10-30"), false);
  assert.equal(isDemoState(null, date), false);
  for (const mutate of [
    (s) => s.tasks.push(s.tasks[0]),
    (s) => (s.tasks[0].merchantId = "missing"),
    (s) => delete s.merchants[0].name,
    (s) => (s.points[0].merchantId = "bad"),
    (s) => (s.fleet[0].battery = NaN),
    (s) => (s.history[0].kg = "broken"),
    (s) => (s.alerts[0].logs = null),
    (s) => (s.devices[0].vehicle = "missing"),
    (s) => delete s.warningRules,
    (s) => (s.bins[1].rfid = s.bins[0].rfid),
  ]) {
    const bad = structuredClone(seed);
    mutate(bad);
    assert.equal(isDemoState(bad, date), false);
  }
});
test("北京时间和CSV公式注入防护", () => {
  assert.equal(chinaDate(new Date("2026-10-28T16:01:00Z")), date);
  assert.equal(chinaDate(new Date("2026-10-29T15:59:00Z")), date);
  const csv = encodeCsv([
    ["商户", "地址"],
    ["=1+1", '测试,"地址"\n第二行'],
    ["  @SUM(1)", 3],
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"\'  @SUM(1)"'));
  assert.ok(csv.includes('"测试,""地址""\n第二行"'));
});

test("桶数明确录入，逐桶拆分与四类报表守恒，待核验不入有效量", async () => {
  const { weighingRows } = await import("../src/mock/sanitation.ts");
  const { sanitationReport } = await import("../src/mock/reporting.ts");
  const s = createSeed(date);
  const rs = reportRecords(s, date, "日");
  const kg = rs.reduce((a, r) => a + r.kg, 0);
  const buckets = rs.reduce((a, r) => a + r.buckets, 0);
  const events = weighingRows(s, rs);
  assert.equal(events.filter((e) => e.status === "有效").length, buckets);
  assert.equal(events.filter((e) => e.status === "待核验").length, 2);
  assert.equal(
    Math.round(
      events.filter((e) => e.status === "有效").reduce((a, e) => a + e.kg, 0) *
        100,
    ),
    Math.round(kg * 100),
  );
  for (const view of ["车辆收运汇总", "收集点报表", "商户报表"]) {
    const report = sanitationReport(s, rs, view);
    assert.equal(
      report.reduce((a, r) => a + r.kg, 0),
      kg,
    );
    assert.equal(
      report.reduce((a, r) => a + r.buckets, 0),
      buckets,
    );
  }
  const today = sanitationReport(s, rs, "车辆收运汇总");
  assert.equal(today[0].planned, 6);
  assert.equal(today[0].completed, 3);
  assert.equal(today[0].rate, 50);
  const historic = sanitationReport(
    s,
    reportRecords(s, shiftDate(date, -1), "日"),
    "车辆收运汇总",
  );
  assert.equal(historic[0].planned, null);
  assert.equal(historic[0].rate, null);
  const task = s.tasks.find((t) => t.status === "收运中");
  assert.throws(() => finishTask(s, task.id, 80, new Date(), 0), /桶数/);
  finishTask(s, task.id, 80, new Date(), 7);
  assert.equal(task.buckets, 7);
  assert.ok(isDemoState(s, date));
});
test("垃圾桶RFID和编号唯一，桶归属必须与收集点商户一致", async () => {
  const { saveBin, validateBin } = await import("../src/mock/sanitation.ts");
  const s = createSeed(date);
  const b = { ...s.bins[0], id: "NEW-BIN", code: "NEW-CODE", rfid: "5350445A57250299999999" };
  assert.equal(validateBin(s, b), undefined);
  saveBin(s, b);
  assert.ok(isDemoState(s, date));
  assert.throws(() => saveBin(s, { ...b, id: "DUP" }), /唯一/);
  assert.match(validateBin(s, { ...b, pointId: s.points[1].id }), /属于/);
});
test("排班冲突拦截和批量保存原子性，计划保存不产生执行记录", async () => {
  const { saveSchedules, validateSchedule } =
    await import("../src/mock/sanitation.ts");
  const s = createSeed(date);
  const before = s.schedules.length;
  const jobs = s.tasks.length;
  const same = { ...s.schedules[0], id: "CONFLICT" };
  assert.match(validateSchedule(s, same), /重叠/);
  const future = { ...same, id: "FUTURE", date: shiftDate(date, 1) };
  assert.throws(() => saveSchedules(s, [future, same]), /重叠/);
  assert.equal(s.schedules.length, before);
  saveSchedules(s, [future]);
  assert.equal(s.schedules.length, before + 1);
  assert.equal(s.tasks.length, jobs);
  assert.ok(isDemoState(s, date));
});
test("预警阈值边界、零基数、停用和过滤车辆", async () => {
  const { evaluateRule } = await import("../src/mock/sanitation.ts");
  const s = createSeed(date);
  const r = s.warningRules[0];
  const sample = { vehicle: s.fleet[0].plate, baseline: 100, current: 70 };
  assert.equal(evaluateRule(r, sample).hit, true);
  assert.equal(evaluateRule(r, { ...sample, baseline: 0 }).hit, false);
  assert.equal(evaluateRule({ ...r, enabled: false }, sample).hit, false);
  assert.equal(
    evaluateRule({ ...r, excludedVehicles: [sample.vehicle] }, sample).hit,
    false,
  );
  const weight = s.warningRules[2];
  assert.equal(
    evaluateRule(weight, { vehicle: sample.vehicle, weight: 260 }).hit,
    false,
  );
  assert.equal(
    evaluateRule(weight, { vehicle: sample.vehicle, weight: -5 }).hit,
    true,
  );
  assert.equal(
    evaluateRule(weight, { vehicle: sample.vehicle, weight: 261 }).hit,
    true,
  );
});

test("告警与关联作业同车同点，采集标签快照不随资产编辑改变", async () => {
  const { weighingRows } = await import("../src/mock/sanitation.ts");
  const s = createSeed(date);
  for (const a of s.alerts.filter((a) => a.taskId)) {
    const t = s.tasks.find((t) => t.id === a.taskId);
    assert.equal(a.vehicle, t.vehicle);
    assert.equal(a.pointId, t.pointId);
    assert.equal(a.merchantId, t.merchantId);
  }
  const before = weighingRows(s, reportRecords(s, date, "日"), false)[0];
  s.bins[0].rfid = "5350445A57250299999998";
  const after = weighingRows(s, reportRecords(s, date, "日"), false)[0];
  assert.equal(after.rfid, before.rfid);
});

test("商户使用16条业务线路字典，拒绝无效归属并兼容旧缓存未分线", async () => {
  const { collectionLines, validCollectionLine } =
    await import("../src/mock/collection-lines.ts");
  const s = createSeed(date);
  assert.equal(collectionLines.length, 16);
  assert.equal(new Set(collectionLines.map((l) => l.id)).size, 16);
  assert.ok(
    s.merchants.every((m) => collectionLines.some((l) => l.id === m.lineId)),
  );
  assert.ok(isDemoState(s, date));
  s.merchants[0].lineId = "unknown";
  assert.equal(isDemoState(s, date), false);
  delete s.merchants[0].lineId;
  assert.ok(isDemoState(s, date));
  assert.equal(validCollectionLine(""), true);
});

test('地磅独立快照、同日多次合并、车牌归一、去重及准确率边界', async () => {
  const { compareWeighbridge, validWeighbridge } = await import('../src/mock/weighbridge.ts');
  const s = createSeed(date);
  assert.ok(s.weighbridge.length > 0);
  assert.ok(s.weighbridge.every(validWeighbridge));
  const base = { id:'wb1',sourceId:'local1',device:'test',date,vehicle:'川A·WJ001',tareKg:8000,grossKg:9000,netKg:1000,weighedAt:`${date} 12:00:00`,syncedAt:`${date} 12:00:10` };
  const second = {...base,id:'wb2',sourceId:'local2',grossKg:8500,netKg:500};
  let c = compareWeighbridge([base,base,second],date,'川aWJ001',1530);
  assert.equal(c.items.length,2);
  assert.equal(c.netKg,1500);
  assert.equal(c.accuracy,98);
  assert.equal(compareWeighbridge([base],date,base.vehicle,1000).accuracy,100);
  assert.equal(compareWeighbridge([base],date,base.vehicle,1020).accuracy,98);
  assert.equal(compareWeighbridge([base],date,base.vehicle,2500).accuracy,0);
  assert.equal(c.differenceKg,30);
  assert.equal(compareWeighbridge([base],date,base.vehicle,980).accuracy,98);
  assert.equal(compareWeighbridge([base],date,base.vehicle,0).accuracy,0);
  assert.equal(compareWeighbridge([base],date,'其他车',20).netKg,null);
  assert.equal(compareWeighbridge([base],shiftDate(date,1),base.vehicle,20).accuracy,null);
  c = compareWeighbridge([{...base,netKg:0,grossKg:8000}],date,base.vehicle,0);
  assert.equal(c.accuracy,null);
  assert.equal(c.status,'净重为0');
  c = compareWeighbridge([{...base,grossKg:9999}],date,base.vehicle,1000);
  assert.equal(c.status,'地磅数据异常');
  assert.equal(c.netKg,null);
  assert.equal(c.accuracy,null);
  const snapshot = JSON.stringify(s.weighbridge);
  s.tasks[0].actualKg += 10;
  assert.equal(JSON.stringify(s.weighbridge),snapshot);
  assert.ok(isDemoState(s,date));
  s.weighbridge.push({...s.weighbridge[0]});
  assert.equal(isDemoState(s,date),false);
  s.weighbridge = [{...base,netKg:-1}];
  assert.equal(isDemoState(s,date),false);
  delete s.weighbridge;
  assert.ok(isDemoState(s,date));
});

test('商户完整演示资料及配桶数量兼容旧数据，不修改RFID资产', async () => {
  const { merchantProfile } = await import('../src/mock/merchant-profile.ts');
  const s = createSeed(date);
  const m = s.merchants[0];
  const oldBins = JSON.stringify(s.bins);
  const original = merchantProfile(s,m);
  assert.equal(original.phone,m.phone);
  assert.equal(original.address,m.address);
  assert.equal(original.bucket120,s.bins.filter(b=>b.merchantId===m.id && b.status==='在用' && b.spec===120).length);
  m.allocatedBins = {120:3,240:2,660:0};
  assert.equal(merchantProfile(s,m).bucket120,3);
  assert.equal(JSON.stringify(s.bins),oldBins);
  assert.ok(isDemoState(s,date));
  m.allocatedBins[120] = -1;
  assert.equal(isDemoState(s,date),false);
});

test('地磅称重流水、毛皮时间独立保存并兼容旧记录', async () => {
  const { validWeighbridge } = await import('../src/mock/weighbridge.ts');
  const s = createSeed(date);
  const rows = s.weighbridge;
  assert.equal(new Set(rows.map(r=>r.weighingNo)).size,rows.length);
  assert.ok(rows.every(r=>r.weighingNo.startsWith('DEMO-') && r.tareAt !== r.grossAt && r.syncedAt !== r.grossAt));
  const row = {...rows[0]};
  assert.ok(validWeighbridge(row));
  assert.equal(validWeighbridge({...row,tareAt:'错误时间'}),false);
  assert.equal(validWeighbridge({...row,weighingNo:''}),false);
  delete row.weighingNo; delete row.tareAt; delete row.grossAt;
  assert.ok(validWeighbridge(row));
});

test('联单生成幂等、作废不复号、快照及季度重量守恒', async()=>{
 const {createManifestState,issueManifest,quarterRows,escapeHtml}=await import('../src/mock/manifests.ts');
 const s=createManifestState();const input={kind:'单次联单',key:'event1',merchant:'示例',period:date,kg:100,createdAt:date,html:'待生成编号'};
 const first=issueManifest(s,input);assert.equal(issueManifest(s,input).id,first.id);assert.equal(s.documents.length,1);
 first.status='已作废';const next=issueManifest(s,input);assert.notEqual(next.id,first.id);assert.equal(s.documents.length,2);
 s.units[0].name='新单位';assert.equal(first.html,first.id);
 const data=createSeed(date);const q=quarterRows(data,2026,4);assert.equal(q.start,'2026-10-01');assert.equal(q.end,'2026-12-31');
 assert.equal(q.rows.reduce((sum,r)=>sum+r.months.reduce((a,b)=>a+b,0),0),records(data).filter(r=>r.date>=q.start&&r.date<=q.end).reduce((sum,r)=>sum+r.kg,0));
 assert.equal(escapeHtml('<script>'),'&lt;script&gt;');
});

test('租户模板启用互斥、保存版本、深拷贝与跨租户拒绝',async()=>{
 const {newManifestTemplate,saveTemplate,validateTemplate}=await import('../src/mock/manifest-templates.ts');
 const list=[];const draft=newManifestTemplate();draft.enabled=true;const first=saveTemplate(list,draft);
 const snapshot=JSON.parse(JSON.stringify(first));
 const copy=newManifestTemplate();copy.name='第二个模板';copy.enabled=true;const second=saveTemplate(list,copy);
 assert.equal(list.filter(t=>t.enabled).length,1);assert.equal(first.enabled,false);
 second.title='新的标题';const updated=saveTemplate(list,second);assert.equal(updated.version,2);assert.equal(snapshot.title,draft.title);
 draft.units[0].name='未保存改动';assert.notEqual(list[0].units[0].name,draft.units[0].name);
 assert.ok(validateTemplate({...newManifestTemplate(),tenantId:'other'}));
 assert.throws(()=>saveTemplate(list,{...newManifestTemplate(),tenantId:'other'}));
});

test('地区模板固定内容、机构单位默认值和收运司机快照',async()=>{
 const {newManifestTemplate,saveTemplate,regionLayouts}=await import('../src/mock/manifest-templates.ts');
 const t=newManifestTemplate();assert.equal(t.units[0].name,'山高十方环保能源集团有限公司成都温江分公司');assert.equal(t.units[1].name,'成都市温江城投顺源生态环境建设有限公司');assert.equal(t.processingDatePolicy,'actual');assert.equal(t.zeroTime,false);
 t.title='不应自定义标题';t.notes='不应自定义脚注';t.showVehicles=false;
 const saved=saveTemplate([],t);assert.equal(saved.title,regionLayouts[0].title);assert.equal(saved.notes,regionLayouts[0].notes);assert.equal(saved.showVehicles,true);
 const state=createSeed(date);const r=records(state).find(r=>r.date===date);assert.ok(r.driver);const driver=r.driver;state.fleet.find(v=>v.plate===r.vehicle).driver='变更司机';assert.equal(r.driver,driver);
});

test('联单展示编号按机构日期递增、可跨机构重号并拦截9999上限',async()=>{
 const {nextManifestNumber}=await import('../src/mock/manifest-number.ts');
 const docs=[{organizationId:'a',number:'202610300001'},{organizationId:'b',number:'202610300009'}];
 assert.equal(nextManifestNumber('2026-10-30','a',docs),'202610300002');
 assert.equal(nextManifestNumber('2026-10-30','c',docs),'202610300001');
 assert.equal(nextManifestNumber('2026-10-31','a',docs),'202610310001');
 assert.throws(()=>nextManifestNumber('2026-10-30','a',[{organizationId:'a',number:'202610309999'}]));
});

test('联单模板两家单位印章必填，校验失败不保存或切换启用',async()=>{
 const {newManifestTemplate,saveTemplate,validateTemplate}=await import('../src/mock/manifest-templates.ts');
 const list=[];const t=newManifestTemplate();t.enabled=true;saveTemplate(list,t);const before=JSON.stringify(list);
 const missing=newManifestTemplate();missing.enabled=true;missing.units[0].seal='';
 assert.match(validateTemplate(missing),/收运单位PNG印章/);assert.throws(()=>saveTemplate(list,missing));assert.equal(JSON.stringify(list),before);
 missing.units[0].seal=t.units[0].seal;missing.units[1].seal='';assert.match(validateTemplate(missing),/处置单位PNG印章/);
});

test('地磅列表配置校验、机构启用互斥及原始单位转换',async()=>{
 const {saveWeighbridgeConfig,validateWeighbridgeConfig,sourceWeightToKg}=await import('../src/mock/weighbridge-config.ts');
 const rows=[];const base={id:'',organizationId:'a',source:'本地主机增量同步',unit:'千克',enabled:true};
 const first=saveWeighbridgeConfig(rows,base,['a','b']);saveWeighbridgeConfig(rows,{...base,source:'云平台对接',unit:'吨'},['a','b']);assert.equal(first.enabled,false);assert.equal(rows.filter(r=>r.enabled).length,1);
 saveWeighbridgeConfig(rows,{...base,organizationId:'b'},['a','b']);assert.equal(rows.filter(r=>r.enabled).length,2);
 assert.ok(validateWeighbridgeConfig({...base,source:'其他'},['a']));assert.throws(()=>saveWeighbridgeConfig(rows,{...base,organizationId:'无权限'},['a']));
 assert.equal(sourceWeightToKg(1.25,'吨'),1250);assert.equal(sourceWeightToKg(1250,'千克'),1250);
});

test('街道字典校验及商户日报组合筛选',async()=>{
 const {streetDictionary,validMerchantStreet,merchantMatchesFilters}=await import('../src/mock/merchant-dictionaries.ts');
 assert.equal(streetDictionary.length,6);assert.ok(validMerchantStreet('柳城街道'));assert.ok(validMerchantStreet('永宁街道'));assert.equal(validMerchantStreet(''),false);
 const merchant={lineId:'CL01',street:'柳城街道',enabled:true,businessStatus:'营业中'};
 const filter={line:'CL01',street:'柳城街道',status:'运营中'};
 assert.ok(merchantMatchesFilters(merchant,filter));assert.equal(merchantMatchesFilters(merchant,{...filter,status:'已停止'}),false);
 assert.equal(merchantMatchesFilters(merchant,{...filter,line:'CL02'}),false);assert.equal(merchantMatchesFilters(merchant,{...filter,street:'金马街道'}),false);
 assert.ok(merchantMatchesFilters({...merchant,enabled:false},{...filter,status:'已停止'}));
 const state=createSeed(date);state.merchants[0].street='金马街道';assert.ok(isDemoState(state,date));state.merchants[0].street='';assert.equal(isDemoState(state,date),false);
});

test('商户日报30天日均不含当天、未收运日计0且不受列表查询范围影响',async()=>{
 const {dailyAverageLookup,sanitationReport}=await import('../src/mock/reporting.ts');
 const base=records(createSeed(date))[0];
 const lookup=dailyAverageLookup([{...base,date:'2026-09-01',merchantId:'other',kg:1},{...base,date:'2026-09-30',merchantId:'m',kg:300},{...base,date:'2026-10-01',merchantId:'m',kg:999}]);
 assert.equal(lookup('m','2026-10-01'),10);assert.equal(lookup('none','2026-10-01'),0);assert.equal(lookup('m','2026-09-15'),null);
 const s=createSeed(date);const today=records(s).filter(r=>r.date===date);const reports=sanitationReport(s,today,'商户报表');
 const row=reports[0];const source=records(s).filter(r=>r.merchantId===row.merchantId&&r.date>=shiftDate(date,-30)&&r.date<date);
 assert.equal(row.dailyAverageKg,Math.round(source.reduce((sum,r)=>sum+r.kg,0)/30*100)/100);
});

test('联单示例保留真实交接日期，缺失留白且不回写快照',async()=>{
 const {manifestExample}=await import('../src/mock/manifest-example.ts');
 const d={id:'id',key:'key',date:'2026-10-29',merchant:'示例商户',kg:128,vehicles:['示例车辆'],carrier:{id:'c',name:'收运',receiver:'',seal:''},processor:{id:'p',name:'处理',receiver:'',seal:''},generatedAt:'2026-10-30'};
 const snapshot=JSON.stringify(d);const result=manifestExample(d);
 assert.equal(result.collectionDate,undefined);assert.equal(result.processingDate,undefined);
 const actual=manifestExample({...d,collectionDate:'2026-10-29 07:12:00',processingDate:'2026-10-30'});assert.equal(actual.collectionDate,'2026-10-29 07:12:00');assert.equal(actual.processingDate,'2026-10-30');assert.equal(result.receiver,'示例接收人');assert.ok(result.vehicleDrivers[0].driver);assert.equal(result.oilKg,0);assert.equal(JSON.stringify(d),snapshot);
});


test("车辆线路只取最佳一条，换车保持归属，完全无命中才未匹配", async () => {
  const { sanitationReport, matchTrajectoryRoutes } = await import("../src/mock/reporting.ts");
  const state = createSeed(date);
  const routes = [{ id: "CL01", pointIds: [state.points[0].id] }, { id: "CL16", pointIds: [state.points[1].id] }];
  routes.forEach(route => { state.merchants.find(m => m.id === state.points.find(p => p.id === route.pointIds[0]).merchantId).lineId = route.id; });
  const template = records(state)[0];
  const rows = routes.map((route, i) => ({ ...template, id: `trajectory-${i}`, date,
    pointId: route.pointIds[0], vehicle: "川A换车示例", kg: 100 + i }));
  const result = sanitationReport(state, rows, "车辆收运汇总");
  assert.equal(result.length, 1);
  assert.equal(result[0].kg, 201);
  assert.deepEqual(result[0].routeIds, ["CL01"]);
  assert.equal(result[0].routeUnmatched, false);
  assert.deepEqual(matchTrajectoryRoutes(state, [{ ...rows[0], vehicle: "川A另一辆车" }]).routeIds, [routes[0].id]);
  assert.equal(matchTrajectoryRoutes(state, [{ ...rows[0], pointId: "未知轨迹点" }]).routeName, "未匹配");
  assert.equal(result[0].routeName, "1号线");
  const extraPoint = state.points[2];
  state.merchants.find(m => m.id === extraPoint.merchantId).lineId = "CL16";
  const extra = { ...rows[1], pointId: extraPoint.id };
  assert.equal(matchTrajectoryRoutes(state, [...rows, extra, extra]).routeName, "16号线");
  assert.equal(matchTrajectoryRoutes(state, [rows[0], { ...rows[1], pointId: "未知点" }]).routeName, "1号线");
  state.merchants.find(m => m.id === state.points[0].merchantId).lineId = "";
  assert.equal(matchTrajectoryRoutes(state, [rows[0]]).routeName, "未匹配");
});


test("RFID统一批次编码格式，未识别为22个0且兼容旧缓存", async () => {
 const { validRfid, migrateRfid, UNRECOGNIZED_RFID } = await import('../src/mock/rfid.ts');
 const { weighingRows, validateBin } = await import('../src/mock/sanitation.ts');
 const state = createSeed(date);
 assert.ok(state.bins.every(b => validRfid(b.rfid)));
 assert.equal(state.bins[0].rfid, '5350445A57250200033436');
 assert.ok(weighingRows(state, records(state), false).every(r => validRfid(r.rfid)));
 assert.equal(UNRECOGNIZED_RFID, '0000000000000000000000');
 assert.equal(migrateRfid('DEMO-RFID-1-1'), state.bins[0].rfid);
 assert.equal(migrateRfid('UNKNOWN-DEMO-TAG'), UNRECOGNIZED_RFID);
 assert.ok(state.weighExceptions.some(r => r.rfid === UNRECOGNIZED_RFID));
 assert.match(validateBin(state, {...state.bins[0], rfid: UNRECOGNIZED_RFID}), /RFID/);
});


test("商户收集点地图编辑校验和保存共用数据，失败不改原点", async () => {
 const {saveMerchantPoint} = await import('../src/mock/merchant-points.ts');
 const state = createSeed(date);
 const point = state.points[0];
 const original = {...point};
 const draft = {...point, name: '地图编辑示例', x: 65, y: 30};
 assert.equal(point.name, original.name);
 saveMerchantPoint(state, draft);
 assert.equal(point.name, draft.name);
 assert.equal(point.x, 65);
 assert.throws(()=>saveMerchantPoint(state,{...draft,x:NaN}), /地图范围/);
 assert.equal(point.x, 65);
 assert.throws(()=>saveMerchantPoint(state,{...draft,merchantId:'不存在的商户'}), /所属商户/);
 assert.throws(()=>saveMerchantPoint(state,{...draft,name:'  '}), /名称和地址/);
 saveMerchantPoint(state,{...draft,id:'PT-TEST-NEW',name:'新收集点'});
 assert.equal(state.points.filter(p=>p.id==='PT-TEST-NEW').length,1);
 assert.throws(()=>saveMerchantPoint(state,{...draft,id:'PT-TEST-DUP'}), /同名/);
});


test("高德收集点GCJ-02坐标保存及旧缓存兼容", async () => {
 const {pointLocation} = await import('../src/mock/point-location.ts');
 const {saveMerchantPoint} = await import('../src/mock/merchant-points.ts');
 const state=createSeed(date);const point=state.points[0];
 const fallback=pointLocation(point);
 assert.ok(fallback[0]>103.7 && fallback[0]<104);
 assert.ok(fallback[1]>30.5 && fallback[1]<30.9);
 saveMerchantPoint(state,{...point,longitude:103.837,latitude:30.696});
 assert.deepEqual(pointLocation(point),[103.837,30.696]);
 assert.throws(()=>saveMerchantPoint(state,{...point,latitude:100}),/经纬度/);
 assert.throws(()=>saveMerchantPoint(state,{...point,longitude:undefined}),/经纬度/);
 assert.deepEqual(pointLocation(point),[103.837,30.696]);
});


test("温江地图200点随机且稳定，线路颜色与商户桶数同源", async () => {
 const {ensureMerchantMapPoints,merchantMapStyle,lineColors}=await import('../src/mock/merchant-map.ts');
 const {pointLocation}=await import('../src/mock/point-location.ts');
 const state=createSeed(date);const before=records(state).length;
 ensureMerchantMapPoints(state);
 assert.equal(state.points.length,200);
 const locations=state.points.map(pointLocation);
 assert.equal(new Set(locations.map(p=>p.join(','))).size,200);
 assert.ok(locations.every(([lng,lat])=>lng>103.8&&lng<103.9&&lat>30.65&&lat<30.77));
 ensureMerchantMapPoints(state);
 assert.equal(state.points.length,200);
 assert.deepEqual(state.points.map(pointLocation),locations);
 assert.equal(records(state).length,before);
 assert.equal(new Set(lineColors).size,16);
 const merchant=state.merchants[0];merchant.allocatedBins={120:3,240:4,660:2};
 const style=merchantMapStyle(state,merchant.id);
 assert.equal(style.buckets,9);
 assert.equal(style.line,'1号线');
 merchant.lineId='CL16';assert.notEqual(merchantMapStyle(state,merchant.id).color,style.color);
 merchant.lineId='';assert.equal(merchantMapStyle(state,merchant.id).color,'#86909c');
});


test("收集点完整编辑表单与围栏保存独立快照，非法输入不落库", async () => {
 const {saveMerchantPoint}=await import('../src/mock/merchant-points.ts');
 const state=createSeed(date);const original=state.points[0];
 const circle={type:'circle',center:[103.837,30.696],radius:120};
 const draft={...original,name:'编辑收集点示例',organizationId:'demo-wenjiang-branch',category:'小区',estimatedKg:120.5,note:'模拟备注',fence:circle};
 saveMerchantPoint(state,draft);
 assert.equal(original.note,'模拟备注');assert.equal(original.category,'小区');
 assert.equal(original.estimatedKg,120.5);
 circle.radius=999;assert.equal(original.fence.radius,120);
 const snapshot=JSON.stringify(original);
 for(const invalid of [{...draft,estimatedKg:-1},{...draft,category:''},{...draft,organizationId:'other'},{...draft,fence:{type:'circle',center:[0,0],radius:0}},{...draft,fence:{type:'polygon',path:[[103.83,30.69],[103.84,30.7]]}}]){
  assert.throws(()=>saveMerchantPoint(state,invalid));assert.equal(JSON.stringify(original),snapshot);
 }
 const polygon={type:'polygon',path:[[103.83,30.69],[103.84,30.69],[103.84,30.7]]};
 saveMerchantPoint(state,{...draft,fence:polygon});
 assert.deepEqual(original.fence,polygon);
 polygon.path[0][0]=0;assert.equal(original.fence.path[0][0],103.83);
 assert.ok(isDemoState(state,date));
});


test("编辑收集点允许切换商户，保留历史商户快照并同步当前桶归属", async () => {
 const {saveMerchantPoint}=await import('../src/mock/merchant-points.ts');
 const {merchantMapStyle}=await import('../src/mock/merchant-map.ts');
 const state=createSeed(date), point=state.points[0], merchant=state.merchants[1];
 const history=records(state).map(row=>({...row}));
 saveMerchantPoint(state,{...point,merchantId:merchant.id});
 assert.equal(point.merchantId,merchant.id);
 assert.ok(state.bins.filter(bin=>bin.pointId===point.id).every(bin=>bin.merchantId===merchant.id));
 assert.equal(merchantMapStyle(state,point.merchantId).line,'2号线');
 assert.deepEqual(records(state),history);
 assert.ok(isDemoState(state,date));
});


test("商户日报日期快捷范围覆盖月初跨年及闰年，近7天含今日", async () => {
 const {merchantDateRange}=await import('../src/mock/reporting.ts');
 assert.deepEqual(merchantDateRange('2026-10-30','昨日'),['2026-10-29','2026-10-29']);
 assert.deepEqual(merchantDateRange('2026-10-30','今日'),['2026-10-30','2026-10-30']);
 assert.deepEqual(merchantDateRange('2026-10-30','近7天'),['2026-10-24','2026-10-30']);
 assert.deepEqual(merchantDateRange('2026-10-30','本月'),['2026-10-01','2026-10-30']);
 assert.deepEqual(merchantDateRange('2026-01-01','昨日'),['2025-12-31','2025-12-31']);
 assert.deepEqual(merchantDateRange('2024-03-01','昨日'),['2024-02-29','2024-02-29']);
 assert.deepEqual(merchantDateRange('2026-11-01','本月'),['2026-11-01','2026-11-01']);
});

test("商户月报逐日、月合计和日报同源，未来日期留空，筛选不影响口径", async () => {
 const {merchantMonthlyReport,monthDates,sumRecordKg}=await import('../src/mock/summary-reports.ts');
 const state=createSeed('2026-10-30');
 const rows=merchantMonthlyReport(state,'2026-10');
 const source=records(state).filter(row=>row.date.startsWith('2026-10'));
 const cents=values=>values.reduce((sum,value)=>sum+Math.round(value*100),0);
 assert.equal(cents(rows.map(row=>row.kg)),Math.round(sumRecordKg(source)*100));
 assert.equal(rows.reduce((sum,row)=>sum+row.buckets,0),source.reduce((sum,row)=>sum+row.buckets,0));
 for(const row of rows){assert.equal(cents(Object.values(row.days).filter(value=>value!==null)),Math.round(row.kg*100));assert.equal(row.days['2026-10-31'],null);assert.equal(row.collectionDays,new Set(row.items.map(item=>item.date)).size);}
 const merchant=state.merchants[0];
 assert.deepEqual(merchantMonthlyReport(state,'2026-10',{merchantId:merchant.id}),[rows.find(row=>row.id===merchant.id)]);
 assert.ok(merchantMonthlyReport(state,'2026-10',{lineId:'CL01'}).every(row=>state.merchants.find(m=>m.id===row.id).lineId==='CL01'));
 assert.equal(monthDates('2024-02').length,29);assert.equal(monthDates('2026-02').length,28);assert.deepEqual(monthDates('2026-13'),[]);
});

test("区域月报按街道逐日汇总，与商户月报及有效流水总量一致", async () => {
 const {regionMonthlyReport,merchantMonthlyReport,sumRecordKg}=await import('../src/mock/summary-reports.ts');
 const state=createSeed('2026-10-30');
 const rows=regionMonthlyReport(state,'2026-10');
 const source=records(state).filter(row=>row.date.startsWith('2026-10'));
 assert.equal(rows.length,6);assert.equal(new Set(rows.map(row=>row.id)).size,6);
 assert.equal(rows.reduce((sum,row)=>sum+Math.round(row.kg*100),0),Math.round(sumRecordKg(source)*100));
 assert.equal(rows.reduce((sum,row)=>sum+row.buckets,0),source.reduce((sum,row)=>sum+row.buckets,0));
 assert.equal(new Set(rows.flatMap(row=>row.items.map(item=>item.id))).size,source.length);
 for(const row of rows){assert.equal(row.days['2026-10-31'],null);assert.equal(Object.values(row.days).reduce((sum,value)=>sum+Math.round((value??0)*100),0),Math.round(row.kg*100));}
 const street=regionMonthlyReport(state,'2026-10','柳城街道');
 assert.equal(street.length,1);
 const merchantRows=merchantMonthlyReport(state,'2026-10',{street:'柳城街道'});
 for(const date of Object.keys(street[0].days))assert.equal(street[0].days[date],date>state.date?null:merchantRows.reduce((sum,row)=>sum+Math.round((row.days[date]??0)*100),0)/100);
 const empty=rows.find(row=>row.area==='金马街道');assert.equal(empty.kg,0);assert.equal(empty.days['2026-10-01'],0);
 state.merchants[0].street='';const unknown=regionMonthlyReport(state,'2026-10').find(row=>row.area==='未设置街道');assert.ok(unknown.kg>0);
 assert.ok(regionMonthlyReport(state,'2026-11').every(row=>Object.values(row.days).every(value=>value===null)));
 assert.equal(Object.keys(regionMonthlyReport(state,'2024-02')[0].days).length,29);
 assert.deepEqual(regionMonthlyReport(state,'2026-13'),[]);
});

test("旧模拟缓存移除旧行政字段并补齐街道，历史重量和资产不变", async () => {
 const {migrateMerchantStreet}=await import('../src/mock/merchant-dictionaries.ts');
 const state=createSeed(date);const before=JSON.stringify(records(state));const assets=JSON.stringify(state.bins);
 state.merchants[0]={...state.merchants[0],street:'',township:'legacy'};
 state.merchants=state.merchants.map(migrateMerchantStreet);
 assert.equal(state.merchants[0].street,'柳城街道');assert.equal('township' in state.merchants[0],false);
 assert.equal(JSON.stringify(records(state)),before);assert.equal(JSON.stringify(state.bins),assets);
 assert.ok(isDemoState(state,date));
 assert.equal(migrateMerchantStreet({street:'',address:'永宁街道示例地址'}).street,'永宁街道');
});


test("月报趋势区分无历史和真实零值，汇总不丢失精度",async()=>{
 const {monthlyDailyTotals}=await import('../src/mock/summary-reports.ts');
 const dates=['2026-10-01','2026-10-02','2026-10-03'];
 assert.deepEqual(monthlyDailyTotals(dates,[{days:{[dates[0]]:null,[dates[1]]:0,[dates[2]]:1.11}},{days:{[dates[0]]:null,[dates[1]]:0,[dates[2]]:2.22}}]).map(day=>day.kg),[null,0,3.33]);
 assert.ok(monthlyDailyTotals(dates,[]).every(day=>day.kg===null));
});
test("补绑收集点只补齐未知归属，已识别商户快照不随档案调整",async()=>{
 const {resolveWeighingPoint,weighingRows}=await import('../src/mock/sanitation.ts');
 const {merchantProfile}=await import('../src/mock/merchant-profile.ts');
 const {currentOrganization}=await import('../src/mock/manifest-templates.ts');
 const state=createSeed(date);const row=weighingRows(state,records(state).filter(row=>row.date===date),false)[0];
 const other=state.points.find(point=>point.merchantId!==row.merchantId);
 state.collectionPointBindings={[row.id]:other.id};
 const resolved=resolveWeighingPoint(state,row);
 assert.equal(resolved.pointId,other.id);assert.equal(resolved.merchantId,row.merchantId);
 assert.equal(resolveWeighingPoint(state,{...row,merchantId:''}).merchantId,other.merchantId);
 assert.equal(merchantProfile(state,state.merchants[0]).organization,currentOrganization.name);
});
