/** Run from the project root. Default is a local dry run. --send opts in to a billed external request. */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { makeLabPresets, validateRequest, validateTypedAnswers, reviewAnswers, refundChecks } from '../public/systemone.js';
import { askJev } from '../lib/provider.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
if(existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
const args=new Set(process.argv.slice(2));
if([...args].some(arg=>!['--send','--refund'].includes(arg)))throw new Error('Usage: node examples/native-system-one.mjs [--refund] [--send]');
const preset=makeLabPresets('en')[args.has('--refund')?1:0];
const request={model:process.env.JEV_MODEL||'jev-1.13.0',...validateRequest(preset)};
if(!args.has('--send')){
  console.log(JSON.stringify({mode:'dry-run',sent:false,request},null,2));
}else{
  if(!process.env.TYPESAFE_API_KEY)throw new Error('TYPESAFE_API_KEY is missing. No request sent.');
  const raw=await askJev({apiKey:process.env.TYPESAFE_API_KEY,...request});
  const answers=validateTypedAnswers(raw,request.questions);
  console.log(JSON.stringify({mode:'live',model:raw.model,usage:raw.usage,answers,review:reviewAnswers(answers),...(args.has('--refund')?{checks:refundChecks(request.state,answers)}:{})},null,2));
}
