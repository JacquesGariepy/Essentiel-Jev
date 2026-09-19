/** Server-side Google OAuth configuration. Provider URLs never come from the JSON file. */
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fail } from './common.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function googleConfig(env = process.env) {
  const explicitType = String(env.GOOGLE_OAUTH_CLIENT_TYPE || '').trim().toLowerCase();
  if (explicitType && !['web', 'desktop'].includes(explicitType)) {
    fail('CONFIG_INVALID', 'GOOGLE_OAUTH_CLIENT_TYPE must be web or desktop.');
  }
  let source = null, fileType = '';
  if (env.GOOGLE_CLIENT_CONFIG_FILE) {
    try {
      const filename = path.resolve(root, env.GOOGLE_CLIENT_CONFIG_FILE);
      if (statSync(filename).size > 65536) throw new Error('limit');
      const raw = JSON.parse(readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
      if (!raw || typeof raw !== 'object' || Boolean(raw.installed) === Boolean(raw.web)) throw new Error('type');
      source = raw.installed || raw.web;
      if (typeof source !== 'object' || Array.isArray(source)) throw new Error('object');
      fileType = raw.installed ? 'desktop' : 'web';
    } catch {
      fail('CONFIG_INVALID', 'Cannot read GOOGLE_CLIENT_CONFIG_FILE. Use an OAuth client JSON containing installed or web, not a service-account key.');
    }
    if (explicitType && explicitType !== fileType) {
      fail('CONFIG_INVALID', 'GOOGLE_OAUTH_CLIENT_TYPE does not match the Google client JSON.');
    }
    // A file is a complete configuration source. Do not mix credentials from two clients.
    if ((env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID !== source.client_id) ||
        (env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CLIENT_SECRET !== source.client_secret)) {
      fail('CONFIG_INVALID', 'Google environment credentials conflict with GOOGLE_CLIENT_CONFIG_FILE. Keep one configuration source.');
    }
  }
  const clientId = source ? source.client_id : (env.GOOGLE_CLIENT_ID || '');
  const clientSecret = source ? (source.client_secret || '') : (env.GOOGLE_CLIENT_SECRET || '');
  if (typeof clientId !== 'string' || typeof clientSecret !== 'string' ||
      clientId.length > 4096 || clientSecret.length > 4096 || /[\r\n]/.test(clientId + clientSecret) ||
      (source && !clientId.trim())) {
    fail('CONFIG_INVALID', 'Invalid Google OAuth client credentials.');
  }
  return { clientId: clientId.trim(), clientSecret: clientSecret.trim(), clientType: explicitType || fileType || 'web' };
}
