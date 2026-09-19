/** Safe provider diagnostics. Never expose raw response bodies, tokens, resource IDs or request URLs. */
import { AppError } from './common.mjs';
export const GOOGLE_APIS = Object.freeze({
  mail:{name:'Gmail API',service:'gmail.googleapis.com'},
  calendar:{name:'Google Calendar API',service:'calendar-json.googleapis.com'},
  tasks:{name:'Google Tasks API',service:'tasks.googleapis.com'},
  files:{name:'Google Drive API',service:'drive.googleapis.com'}
});
const KNOWN_REASONS = new Set([
  'SERVICE_DISABLED','API_DISABLED','accessNotConfigured','ACCESS_TOKEN_SCOPE_INSUFFICIENT','insufficientPermissions',
  'domainPolicy','ORG_RESTRICTION_VIOLATION','ACCESS_BLOCKED_BY_ADMIN','admin_policy_enforced',
  'rateLimitExceeded','userRateLimitExceeded','dailyLimitExceeded','quotaExceeded','RATE_LIMIT_EXCEEDED','RESOURCE_EXHAUSTED',
  'authError','invalid_grant','invalid_client','UNAUTHENTICATED','PERMISSION_DENIED','forbidden','accessDenied','ErrorAccessDenied',
  'Authorization_RequestDenied','ErrorInvalidUser','invalidAuthenticationToken','InvalidAuthenticationToken',
  'ErrorMailboxNotEnabledForRESTAPI','backendError','SERVICE_UNAVAILABLE','notFound','badRequest','conditionNotMet'
]);
const STATUS = new Set(['PERMISSION_DENIED','UNAUTHENTICATED','RESOURCE_EXHAUSTED','UNAVAILABLE','NOT_FOUND','INVALID_ARGUMENT','FAILED_PRECONDITION','INTERNAL']);
export function providerContext(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'gmail.googleapis.com') return {provider:'google',service:'mail'};
    if (u.hostname === 'tasks.googleapis.com') return {provider:'google',service:'tasks'};
    if (u.hostname === 'www.googleapis.com' && u.pathname.startsWith('/calendar/')) return {provider:'google',service:'calendar'};
    if (u.hostname === 'www.googleapis.com' && u.pathname.startsWith('/drive/')) return {provider:'google',service:'files'};
    if (['oauth2.googleapis.com','www.googleapis.com'].includes(u.hostname)) return {provider:'google',service:'identity'};
    if (['graph.microsoft.com','login.microsoftonline.com'].includes(u.hostname)) return {provider:'microsoft',service:'identity'};
  } catch {}
  return {provider:'unknown',service:'unknown'};
}
export function googleConsoleUrl(service, project='') {
  const api=GOOGLE_APIS[service];
  if(!api)return '';
  const u=new URL('https://console.cloud.google.com/apis/library/'+api.service);
  if (/^(?:\d{6,30}|[a-z][a-z0-9-]{4,61}[a-z0-9])$/.test(project)) u.searchParams.set('project',project);
  return u.href;
}
/** Return only allowlisted fields. Google ErrorInfo activationUrl is intentionally ignored. */
export function providerError(url, status, data, retryHeader='') {
  const ctx=providerContext(url),raw=data?.error;
  const obj=raw && typeof raw==='object' ? raw : {};
  const entries=Array.isArray(obj.errors)?obj.errors.slice(0,20):[];
  const details=Array.isArray(obj.details)?obj.details.slice(0,20):[];
  const infos=details.filter(d=>d?.['@type']==='type.googleapis.com/google.rpc.ErrorInfo');
  const candidates=[...infos.map(d=>d.reason),...entries.map(e=>e?.reason),typeof raw==='string'?raw:obj.code,obj.status];
  const reasons=[...new Set(candidates.filter(r=>typeof r==='string'&&KNOWN_REASONS.has(r)))];
  const has=(...names)=>names.some(n=>reasons.includes(n));
  const message=typeof obj.message==='string'?obj.message.slice(0,10000):'';
  let category='provider_error',code='PROVIDER_ERROR';
  if(ctx.provider==='google'&&(has('SERVICE_DISABLED','API_DISABLED','accessNotConfigured')||
    (/API has not been used in project \d+ before or it is disabled/i.test(message)&&status===403))) {category='api_disabled';code='GOOGLE_API_DISABLED';}
  else if(has('ACCESS_TOKEN_SCOPE_INSUFFICIENT','insufficientPermissions') || (status===403&&/insufficient authentication scopes/i.test(message))) {category='insufficient_scopes';code='PERMISSION_REQUIRED';}
  else if(has('domainPolicy','ORG_RESTRICTION_VIOLATION','ACCESS_BLOCKED_BY_ADMIN','admin_policy_enforced')) {category='admin_policy';code='ADMIN_POLICY';}
  else if(status===429||has('rateLimitExceeded','userRateLimitExceeded','dailyLimitExceeded','quotaExceeded','RATE_LIMIT_EXCEEDED','RESOURCE_EXHAUSTED')) {category='quota';code='RATE_LIMITED';}
  else if(status===401||has('invalid_grant','UNAUTHENTICATED','authError','InvalidAuthenticationToken','invalidAuthenticationToken')) {category='reauthorize';code='REAUTHORIZE';}
  else if(has('invalid_client')) {category='client_configuration';code='OAUTH_CLIENT_INVALID';}
  else if(status===403) {category='forbidden';code='PERMISSION_DENIED';}
  else if(status>=500) {category='temporary';code='PROVIDER_ERROR';}
  else if(status===404) {category='not_found';code='PROVIDER_ERROR';}
  // Consumer comes from structured metadata only, not from a message, URL or untrusted project guess.
  const consumer=infos.map(d=>d.metadata?.consumer).find(v=>typeof v==='string'&&/^projects\/\d{6,30}$/.test(v));
  const project=consumer?consumer.slice(9):'';
  const retrySeconds=/^\d{1,6}$/.test(String(retryHeader))?Math.min(86400,Number(retryHeader)):null;
  const detail={provider:ctx.provider,service:ctx.service,httpStatus:status,category,
    reason:reasons[0]||'UNSPECIFIED',reasons,status:STATUS.has(obj.status)?obj.status:'',
    api:ctx.provider==='google'?(GOOGLE_APIS[ctx.service]?.name||'Google OAuth'):'Microsoft Graph / OAuth',
    project,consoleUrl:ctx.provider==='google'?googleConsoleUrl(ctx.service,project):'',
    retryable:['quota','temporary'].includes(category),retryAfterSeconds:retrySeconds};
  const summaries={api_disabled:'The Google API is disabled in the OAuth project.',insufficient_scopes:'The granted token lacks an authorization scope required by this operation.',admin_policy:'An organization policy blocks this application or service.',quota:'The provider rejected this request because of a usage or rate limit.',reauthorize:'The account must be authorized again.',client_configuration:'The OAuth client configuration was rejected.',forbidden:'The provider refused this operation; the exact cause is not identified.',temporary:'The provider encountered a temporary error.',not_found:'The requested provider resource was not found.',provider_error:'The provider rejected the request.'};
  const error=new AppError(code,`${summaries[category]} HTTP ${status}${detail.reason!=='UNSPECIFIED'?' · '+detail.reason:''}.`,status===429?429:502);
  error.providerStatus=status;error.diagnostic=detail;return error;
}
export function safeDiagnostic(error) {
  // Diagnostics originate exclusively in providerError. Raw Error objects are never serialized.
  return error?.diagnostic ? structuredClone(error.diagnostic) : undefined;
}
