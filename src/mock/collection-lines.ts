// 客户确认16条业务线路；仅复用编号习惯，商户归属为虚构演示。
// 业务归属线路与作业计划中的几何路径关系尚待确认，不自动互相改写。
export const collectionLines = Array.from({ length: 16 }, (_, i) => ({
  id: `CL${String(i + 1).padStart(2, "0")}`,
  name: `${i + 1}号线`,
}));
export function validCollectionLine(value: unknown) {
  return (
    value === undefined ||
    value === "" ||
    collectionLines.some((line) => line.id === value)
  );
}
