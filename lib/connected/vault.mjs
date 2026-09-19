import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, rename, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { AppError, fail, text } from './common.mjs';

const fresh = () => ({version:1, accounts:{}, snapshots:{}, actions:[], selections:{}});
/** Single-user local vault. The passphrase/key is never persisted or returned to a browser. */
export class Vault {
  constructor(filename) { this.filename=filename; this.data=existsSync(filename)?null:fresh(); this.key=null; this.salt=null; this.queue=Promise.resolve(); }
  status() { return {locked:!this.data, persistent:Boolean(this.key)||existsSync(this.filename), exists:existsSync(this.filename)}; }
  state() { if(!this.data)fail('VAULT_LOCKED','Unlock the local encrypted vault first.',423); return this.data; }
  async unlock(password) {
    if (this.key) return;
    text(password,'vault passphrase',256,true);
    if(password.length<12)fail('WEAK_PASSPHRASE','Use a vault passphrase of at least 12 characters.');
    if(existsSync(this.filename)) {
      try {
        if((await stat(this.filename)).size>20_000_000)fail('INVALID_VAULT','Vault too large.');
        const envelope=JSON.parse(await readFile(this.filename,'utf8'));
        if(envelope.version!==1 || envelope.kdf!=='scrypt-16384-8-1')throw new Error('format');
        const salt=Buffer.from(envelope.salt,'base64'),iv=Buffer.from(envelope.iv,'base64'),tag=Buffer.from(envelope.tag,'base64');
        if(salt.length!==16||iv.length!==12||tag.length!==16)throw new Error('format');
        const key=scryptSync(password,salt,32,{N:16384,r:8,p:1});
        const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(Buffer.from('essentiel-connected-v1'));decipher.setAuthTag(tag);
        const data=JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]).toString('utf8'));
        if(data.version!==1||!data.accounts||!data.snapshots||!Array.isArray(data.actions)||!data.selections)throw new Error('format');
        for(const a of data.actions)if(a.status==='executing'){a.status='uncertain';a.error='Process stopped during external execution. Check the provider; no automatic retry.';}
        this.key=key;this.salt=salt;this.data=data;
      } catch { throw new AppError('VAULT_UNLOCK_FAILED','Wrong passphrase or damaged vault. No data was replaced.',400); }
    } else {this.state(); this.salt=randomBytes(16);this.key=scryptSync(password,this.salt,32,{N:16384,r:8,p:1});}
    await this.save();
  }
  async save() {
    this.state();
    if(!this.key)return;
    const plain=Buffer.from(JSON.stringify(this.data));
    if(plain.length>15_000_000)fail('VAULT_LIMIT','Vault capacity reached; export receipts and reduce cached sources.');
    const key=Buffer.from(this.key),salt=Buffer.from(this.salt);
    const write = async () => {
      const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('essentiel-connected-v1'));
      const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);key.fill(0);plain.fill(0);
      const serialized=JSON.stringify({version:1,kdf:'scrypt-16384-8-1',salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')});
      await mkdir(path.dirname(this.filename),{recursive:true,mode:0o700});
      const temp=this.filename+'.tmp';await writeFile(temp,serialized,{mode:0o600});await rename(temp,this.filename);
    };
    const op=this.queue.catch(()=>{}).then(write);this.queue=op;await op;
  }
  async lock() {
    if(!this.key)fail('PERSISTENCE_REQUIRED','Enable the encrypted vault before locking; memory-only data would be lost.');
    await this.save();this.data=null;this.key.fill(0);this.key=null;this.salt=null;
  }
  async erase() {await this.queue.catch(()=>{});if(this.key)this.key.fill(0);this.key=null;this.salt=null;this.data=fresh();for(const f of [this.filename,this.filename+'.tmp'])await unlink(f).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
