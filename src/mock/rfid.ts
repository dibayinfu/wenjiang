// RFID按字符串保存，保留编码前导零：14位批次＋8位编码。
export const RFID_BATCH = "5350445A572502";
export const UNRECOGNIZED_RFID = "0".repeat(22);
export function mockRfid(pointIndex: number, binIndex: number) {
  return `${RFID_BATCH}${String(33436 + pointIndex * 100 + binIndex).padStart(8, '0')}`;
}
export function validRfid(value: string) {
  return /^[0-9A-F]{14}\d{8}$/.test(value) && value !== UNRECOGNIZED_RFID;
}
export function migrateRfid(value: string) {
  const legacy = /^(?:DEMO|HIST)-RFID-(?:PT)?(\d+)-(\d+)$/.exec(value);
  if (legacy) return mockRfid(Number(legacy[1]) - 1, Number(legacy[2]) - 1);
  return value === 'UNKNOWN-DEMO-TAG' ? UNRECOGNIZED_RFID : value;
}
