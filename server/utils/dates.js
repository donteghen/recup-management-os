const TZ = 'Africa/Douala';
function localParts(d) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .filter(x => x.type !== 'literal')
      .map(x => [x.type, x.value])
  );
}
function localDate(d = new Date()) {
  const p = localParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}
function offsetMinutes(d) {
  const p =
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset', year: 'numeric' })
      .formatToParts(d)
      .find(x => x.type === 'timeZoneName')?.value || 'GMT+01:00';
  const m = p.match(/GMT([+-])(\d{2}):?(\d{2})/);
  return m ? (Number(m[2]) * 60 + Number(m[3])) * (m[1] === '+' ? 1 : -1) : 60;
}
function localDayStart(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return new Date(probe.getTime() - offsetMinutes(probe) * 60000);
}
function bounds(period, anchor = new Date()) {
  const ld = localDate(anchor),
    [y, m, d] = ld.split('-').map(Number);
  let startLocal;
  if (period === 'day') startLocal = new Date(Date.UTC(y, m - 1, d));
  else if (period === 'week') {
    const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    startLocal = new Date(Date.UTC(y, m - 1, d + (w === 0 ? -6 : 1 - w)));
  } else if (period === 'month') startLocal = new Date(Date.UTC(y, m - 1, 1));
  else throw new Error('period must be day, week or month');
  const next =
    period === 'day'
      ? new Date(startLocal.getTime() + 86400000)
      : period === 'week'
        ? new Date(startLocal.getTime() + 7 * 86400000)
        : new Date(Date.UTC(startLocal.getUTCFullYear(), startLocal.getUTCMonth() + 1, 1));
  const a = startLocal.toISOString().slice(0, 10),
    b = next.toISOString().slice(0, 10);
  return { start: localDayStart(a), end: localDayStart(b), localStart: a, localEnd: b };
}
module.exports = { TZ, localDate, bounds };
