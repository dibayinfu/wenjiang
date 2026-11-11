export interface RouteSample {
  position: [number, number];
  timestamp: number;
  course?: number;
}

export interface RouteFrame {
  position: [number, number];
  timestamp: number;
  heading: number;
}

export function routeTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'string') return;
  const text = value.trim().replace(' ', 'T').replaceAll('/', '-');
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/.exec(text);
  if (!parts) return;
  const [, year, month, day, hour, minute, second = '00', fraction, zone = '+08:00'] = parts;
  const calendar = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
  const normalized = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  if (calendar.toISOString().slice(0, 19) !== normalized) return;
  const timestamp = Date.parse(`${normalized}${fraction ? `.${fraction}` : ''}${zone}`);
  if (Number.isFinite(timestamp)) return timestamp;
}

export function formatRouteTime(timestamp: number, full = false) {
  const text = new Date(timestamp + 8 * 3600000).toISOString().replace('T', ' ').slice(0, 19);
  return full ? text : text.slice(11);
}

export function routeFrame(samples: RouteSample[], timestamp: number): RouteFrame {
  const time = Math.max(samples[0]!.timestamp, Math.min(timestamp, samples.at(-1)!.timestamp));
  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (samples[middle]!.timestamp <= time) low = middle;
    else high = middle - 1;
  }
  const from = samples[low]!;
  const to = samples[low + 1] ?? from;
  const fraction = to.timestamp > from.timestamp ? (time - from.timestamp) / (to.timestamp - from.timestamp) : 0;
  const position: [number, number] = [
    from.position[0] + (to.position[0] - from.position[0]) * fraction,
    from.position[1] + (to.position[1] - from.position[1]) * fraction,
  ];
  const previous = samples[Math.max(0, low - 1)]!;
  const start = from === to ? previous.position : from.position;
  const end = to.position;
  const radians = Math.PI / 180;
  const longitudeDelta = (end[0] - start[0]) * radians;
  const latitude1 = start[1] * radians;
  const latitude2 = end[1] * radians;
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2);
  const x = Math.cos(latitude1) * Math.sin(latitude2) - Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta);
  const heading = x === 0 && y === 0 ? from.course ?? 0 : (Math.atan2(y, x) / radians + 360) % 360;
  return { position, timestamp: time, heading };
}
