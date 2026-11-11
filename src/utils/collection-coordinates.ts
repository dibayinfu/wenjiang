type Position = [longitude: number, latitude: number];

// 本地近似公式参考 https://github.com/wandergis/coordtransform
export function wgs84ToGcj02(position: Position): Position {
  const [longitude, latitude] = position;
  if (longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271) {
    return position;
  }

  const x = longitude - 105;
  const y = latitude - 35;
  const xp = x * Math.PI;
  const yp = y * Math.PI;
  const sharedWave = (20 * Math.sin(6 * xp) + 20 * Math.sin(2 * xp)) * 2 / 3;
  const latitudeOffset = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
    + sharedWave + (20 * Math.sin(yp) + 40 * Math.sin(yp / 3)) * 2 / 3
    + (160 * Math.sin(yp / 12) + 320 * Math.sin(yp / 30)) * 2 / 3;
  const longitudeOffset = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
    + sharedWave + (20 * Math.sin(xp) + 40 * Math.sin(xp / 3)) * 2 / 3
    + (150 * Math.sin(xp / 12) + 300 * Math.sin(xp / 30)) * 2 / 3;

  const radians = latitude * Math.PI / 180;
  const radius = 6378245;
  const eccentricitySquared = 0.006693421622965943;
  const curvature = 1 - eccentricitySquared * Math.sin(radians) ** 2;
  const longitudeDegrees = longitudeOffset * Math.sqrt(curvature) * 180 / (radius * Math.cos(radians) * Math.PI);
  const latitudeDegrees = latitudeOffset * curvature ** 1.5 * 180 / (radius * (1 - eccentricitySquared) * Math.PI);
  return [longitude + longitudeDegrees, latitude + latitudeDegrees];
}

export function bd09ToGcj02([longitude, latitude]: Position): Position {
  const x = longitude - 0.0065;
  const y = latitude - 0.006;
  const scale = Math.PI * 3000 / 180;
  const radius = Math.hypot(x, y) - 0.00002 * Math.sin(y * scale);
  const angle = Math.atan2(y, x) - 0.000003 * Math.cos(x * scale);
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

// 显示层使用 BD-09，业务匹配仍统一使用 GCJ-02，避免反复转换累积误差。
export function gcj02ToBd09([longitude, latitude]: Position): Position {
  const scale = Math.PI * 3000 / 180;
  const radius = Math.hypot(longitude, latitude) + 0.00002 * Math.sin(latitude * scale);
  const angle = Math.atan2(latitude, longitude) + 0.000003 * Math.cos(longitude * scale);
  return [radius * Math.cos(angle) + 0.0065, radius * Math.sin(angle) + 0.006];
}
