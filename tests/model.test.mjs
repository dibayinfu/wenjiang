import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceTask,
  chinaDate,
  createSeed,
  dispatchTask,
  isDemoState,
  summarize,
  vehicles,
} from "../src/mock/model.ts";
import { encodeCsv } from "../src/utils/csv.ts";

const date = "2026-10-29";
test("模拟任务关联完整，汇总与明细一致", () => {
  const seed = createSeed(date);
  assert.equal(seed.merchants.length, 28);
  assert.equal(seed.tasks.length, 24);
  assert.ok(isDemoState(seed, date));
  const stats = summarize(seed);
  assert.equal(stats.completed + stats.pending + stats.running, stats.total);
  assert.equal(stats.completed, 12);
  assert.equal(stats.servicedMerchants, 12);
  assert.equal(
    stats.totalKg,
    seed.tasks
      .filter((t) => t.status === "已完成")
      .reduce((n, t) => n + t.actualKg, 0),
  );
});

test("任务只能向前推进，完成后重复操作不会增加收运量", () => {
  const seed = createSeed(date);
  const task = seed.tasks.find((t) => t.status === "待收运");
  const before = summarize(seed);
  assert.equal(advanceTask(seed, task.id), true);
  assert.equal(task.status, "收运中");
  assert.equal(advanceTask(seed, task.id), true);
  assert.equal(summarize(seed).totalKg, before.totalKg + task.plannedKg);
  assert.equal(summarize(seed).completed, before.completed + 1);
  assert.equal(advanceTask(seed, task.id), false);
  assert.equal(summarize(seed).totalKg, before.totalKg + task.plannedKg);
  assert.ok(isDemoState(seed, date));
});

test("拒绝重复派单、停用商户和无效车辆，完成任务后可再次派单", () => {
  const seed = createSeed(date);
  const unfinished = seed.tasks.find((t) => t.status === "待收运");
  assert.throws(
    () => dispatchTask(seed, unfinished.merchantId, vehicles[0].plate),
    /已有未完成任务/,
  );
  assert.throws(
    () =>
      dispatchTask(
        seed,
        seed.merchants.find((m) => !m.enabled).id,
        vehicles[0].plate,
      ),
    /有效/,
  );
  assert.throws(
    () => dispatchTask(seed, seed.tasks[0].merchantId, "invalid"),
    /有效/,
  );
  const newTask = dispatchTask(
    seed,
    seed.tasks[0].merchantId,
    vehicles[0].plate,
  );
  assert.equal(newTask.status, "待收运");
  assert.equal(newTask.date, date);
  assert.equal(new Set(seed.tasks.map((t) => t.id)).size, seed.tasks.length);
  assert.ok(isDemoState(seed, date));
});

test("恢复缓存时拒绝旧日期、缺少字段、重复编号和悬空关联", () => {
  const seed = createSeed(date);
  assert.equal(isDemoState(seed, "2026-10-30"), false);
  assert.equal(isDemoState({ ...seed, merchants: [null] }, date), false);
  const duplicate = structuredClone(seed);
  duplicate.tasks.push(duplicate.tasks[0]);
  assert.equal(isDemoState(duplicate, date), false);
  const bad = structuredClone(seed);
  bad.tasks[0].merchantId = "missing";
  assert.equal(isDemoState(bad, date), false);
  const partial = structuredClone(seed);
  delete partial.merchants[0].name;
  assert.equal(isDemoState(partial, date), false);
  assert.equal(isDemoState(null, date), false);
});

test("按北京时间生成当日日期，避免跨时区漂移", () => {
  assert.equal(chinaDate(new Date("2026-10-28T16:01:00Z")), date);
  assert.equal(chinaDate(new Date("2026-10-29T15:59:00Z")), date);
});

test("CSV 保留中文、逗号、换行和引号，并处理公式注入", () => {
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
