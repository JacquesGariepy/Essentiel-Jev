import { createHash, randomUUID } from 'node:crypto';

export class AppError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
export const fail = (code, message, status) => { throw new AppError(code, message, status); };
export const uid = () => randomUUID();
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const enc = value => encodeURIComponent(String(value)).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
export function text(value, name, max = 4000, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || value.includes('\0')) fail('INVALID_INPUT', `Invalid ${name}.`);
  return value.trim();
}
export function providerId(value) { if (!['google', 'microsoft'].includes(value)) fail('INVALID_PROVIDER', 'Unsupported provider.'); return value; }
export function iso(value, name = 'date') {
  const m = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,7})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!m || +m[2]>23 || +m[3]>59 || +m[4]>59 || (m[5]!=='Z' && (+m[6]>23 || +m[7]>59)) || !Number.isFinite(Date.parse(value))) fail('INVALID_DATE', `Invalid ${name}; an explicit UTC offset is required.`);
  calendarDate(m[1]);
  return new Date(value).toISOString();
}
function calendarDate(value) {
  const t = typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(value+'T00:00:00Z') : NaN;
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0,10)!==value) fail('INVALID_DATE','Invalid calendar date.');
  return value;
}
export function dateOnly(value) {
  if (typeof value!=='string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) fail('INVALID_DATE','Choose a calendar date between 2000 and 2099.');
  return calendarDate(value);
}
/** RFC 2047 encoded words: preserve Unicode code points across folded headers. */
export function mimeSubject(value) {
  const chunks=[];let chunk='';
  for (const point of value) {
    if (Buffer.byteLength(chunk+point,'utf8')>42) { chunks.push(chunk);chunk=''; }
    chunk+=point;
  }
  if(chunk)chunks.push(chunk);
  return chunks.map(c=>`=?UTF-8?B?${Buffer.from(c,'utf8').toString('base64')}?=`).join('\r\n ');
}
export function email(value) {
  const v = text(value, 'recipient', 254, true);
  if (!/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$/i.test(v) || /[\r\n]/.test(v)) fail('INVALID_EMAIL', 'Enter one explicit email address (international domains must be punycoded).');
  return v;
}
export function extractAddress(value) {
  const match = String(value || '').match(/<?([A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?/i);
  try { return match ? email(match[1]) : ''; } catch { return ''; }
}
export function safeLink(value, provider) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password) return '';
    const h = u.hostname.toLowerCase();
    const allowed = provider === 'google' ? ['google.com', 'googleusercontent.com'] : ['outlook.com', 'office.com', 'office365.com', 'live.com', 'sharepoint.com', 'microsoft.com', 'onedrive.com'];
    return allowed.some(d => h === d || h.endsWith('.' + d)) ? u.href : '';
  } catch { return ''; }
}
/** Plain-text preview only: never render remote HTML, remote pixels or active content. */
export function plainHTML(value) {
  return String(value || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?\s*>|<\/(?:p|div|li|tr)>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
export function zonedInstant(value, zone = 'UTC') {
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(value)) return iso(value);
  if (zone === 'UTC' || zone === 'Etc/UTC') return iso(value + 'Z');
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(value);
  if (!match) fail('UNKNOWN_TIME', 'Provider returned an unsupported time.');
  const [year,month,day,hour,minute,second] = match.slice(1).map(Number);
  const target = Date.UTC(year,month-1,day,hour,minute,second);
  const f = new Intl.DateTimeFormat('en-CA', {timeZone:zone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  let t = target;
  for (let i=0;i<4;i++) {
    const p = Object.fromEntries(f.formatToParts(new Date(t)).map(x=>[x.type,x.value]));
    const represented = Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
    if (represented === target) return new Date(t).toISOString();
    t += target - represented;
  }
  fail('UNKNOWN_TIME', 'Provider returned a non-existent or unsupported local time.');
}
export function freeSlots(events, from, to, minutes = 30, now = Date.now()) {
  const lo = Math.max(Date.parse(iso(from)), now), hi = Date.parse(iso(to));
  if (!(hi > lo) || hi-lo > 7*86400000 || !Number.isInteger(minutes) || minutes<5 || minutes>480) return [];
  const busy = events.filter(x=>x.busy !== false).map(x=>[Date.parse(x.start),Date.parse(x.end)]).filter(([a,b])=>b>lo&&a<hi).sort((a,b)=>a[0]-b[0]);
  const windows=[]; let cursor=lo;
  for(const [a,b] of busy){if(a>cursor)windows.push([cursor,Math.min(a,hi)]);cursor=Math.max(cursor,b);if(cursor>=hi)break;}
  if(cursor<hi)windows.push([cursor,hi]);
  const result=[], step=minutes*60000;
  for (const [a,b] of windows) { const start=Math.ceil(a/300000)*300000; if(start+step<=b)result.push({start:new Date(start).toISOString(),end:new Date(start+step).toISOString(),freeUntil:new Date(b).toISOString()}); }
  return result.slice(0,20);
}
