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
const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„', ndash: '–', mdash: '—', hellip: '…', euro: '€', pound: '£', yen: '¥', cent: '¢', copy: '©', reg: '®', trade: '™', deg: '°', middot: '·', bull: '•', times: '×', divide: '÷', para: '¶', sect: '§', shy: '', zwnj: '', zwj: '', ensp: ' ', emsp: ' ', thinsp: ' ', oelig: 'œ', OElig: 'Œ', aelig: 'æ', AElig: 'Æ', szlig: 'ß', oslash: 'ø', Oslash: 'Ø', iexcl: '¡', iquest: '¿', ordm: 'º', ordf: 'ª', plusmn: '±', frac12: '½', frac14: '¼', frac34: '¾', micro: 'µ', larr: '←', rarr: '→', uarr: '↑', darr: '↓' };
const MARKS = { acute: '́', grave: '̀', circ: '̂', uml: '̈', tilde: '̃', ring: '̊', cedil: '̧' };
/** HTML character references: named (common and accented Latin letters), decimal and hexadecimal. Unknown names stay as written. */
export function decodeEntities(value) {
  return String(value ?? '').replace(/&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/g, (all, name) => {
    if (name[0] === '#') { const n = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1)); return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : all; }
    if (Object.hasOwn(ENTITIES, name)) return ENTITIES[name];
    const m = /^([A-Za-z])(acute|grave|circ|uml|tilde|ring|cedil)$/.exec(name); if (m) { const c = (m[1] + MARKS[m[2]]).normalize('NFC'); if (c.length === 1) return c; }
    return all;
  });
}
/** Readable text: CRLF to LF, no invisible runs of spaces, at most one blank line in a row. */
export function tidyText(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/[ \t ]+/g, ' ').split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** Plain-text view of HTML mail: never renders remote HTML, remote pixels or active content. Keeps paragraphs, list items and line breaks; links keep their text. */
export function plainHTML(value) {
  const s = String(value || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|head|title|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<a\b[^>]*\bhref\s*=\s*(["'])([^"']*)\1[^>]*>([\s\S]*?)<\/a\s*>/gi, (all, q, href, inner) => { const label = inner.replace(/<[^>]*>/g, '').trim(); return label || href; })
    .replace(/<li\b[^>]*>/gi, '\n• ').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(?:p|h[1-6]|blockquote|table|ul|ol)\s*>/gi, '\n\n').replace(/<\/(?:div|tr|section|article|header|footer)\s*>/gi, '\n').replace(/<\/t[dh]\s*>/gi, '\t').replace(/<(?:p|h[1-6]|blockquote|table|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return tidyText(decodeEntities(s));
}
/** Declared charset of a MIME part ("text/html; charset=iso-8859-1"); unknown labels fall back to UTF-8. */
export function decodeCharset(buffer, contentType = '') {
  const label = /charset\s*=\s*"?([A-Za-z0-9._:-]+)"?/i.exec(String(contentType))?.[1] || 'utf-8';
  try { return new TextDecoder(label.toLowerCase()).decode(buffer); } catch { return new TextDecoder('utf-8').decode(buffer); }
}
const DROP_WITH_CONTENT = 'script|iframe|frame|frameset|object|embed|applet|form|select|textarea|button|template|noscript|svg|math|audio|video|canvas';
/** Formatted mail view, server-side. Removes active and remote-loading content; the iframe route adds a strict CSP and the
 * sandbox forbids scripts, so this regex pass is one layer of three, not the only protection. */
export function sanitizeHTML(value, max = 400_000) {
  let s = String(value || '').slice(0, max).replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  s = s.replace(new RegExp(`<(${DROP_WITH_CONTENT})\\b[\\s\\S]*?<\\/\\1\\s*>`, 'gi'), '').replace(/<(script|iframe|frame|object|embed|applet|form|input|button|select|textarea|link|meta|base|svg|math|audio|video|source|track|canvas|portal)\b[^>]*>/gi, '').replace(/<\/(script|iframe|frame|frameset|object|embed|applet|form|button|select|textarea|svg|math|audio|video|canvas|portal)\s*>/gi, '');
  s = s.replace(/<([a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?>/g, (all, tag, attrs = '') => {
    const kept = []; const re = /([^\s"'=<>`/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g; let m;
    while ((m = re.exec(attrs))) {
      const name = m[1].toLowerCase(); let v = m[2] ?? ''; const raw = v.replace(/^["']|["']$/g, ''), plain = decodeEntities(raw).replace(/[\u0000- ]+/g, '').toLowerCase();
      if (name.startsWith('on') || ['srcdoc', 'formaction', 'action', 'xmlns', 'ping', 'target'].includes(name)) continue;
      if (['href', 'src', 'background', 'poster', 'xlink:href', 'lowsrc', 'dynsrc', 'cite', 'longdesc'].includes(name) && !(/^(https?:|mailto:|tel:|#|cid:)/.test(plain) || /^data:image\/(png|gif|jpe?g|webp);/.test(plain))) continue;
      if (name === 'style' && /expression\s*\(|javascript:|behaviou?r\s*:|-moz-binding|@import/i.test(decodeEntities(raw))) continue;
      kept.push(v === '' ? name : `${name}="${raw.replace(/"/g, '&quot;')}"`);
    }
    if (tag.toLowerCase() === 'a') kept.push('target="_blank"', 'rel="noopener noreferrer"');
    return `<${tag}${kept.length ? ' ' + kept.join(' ') : ''}>`;
  });
  return s;
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
