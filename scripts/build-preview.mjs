import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { demoRecords } from '../lib/demo.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>readFile(path.join(root,'public',name),'utf8');
function bundle(source, binding){
 const names=[...source.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g)].map(m=>m[1]);
 const clean=source.replace(/^import .*?;\s*$/gm,'').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class)\b)/g,'');
 return `const ${binding} = (() => {\n${clean}\nreturn {${names.join(',')}};\n})();`;
}
const moduleSources=await Promise.all(['core.js','systemone.js','catalog.js','i18n.js','demo.js'].map(read));
const moduleNames=['C','S','catalogModule','i18nModule','demoModule'];
const scripts=moduleSources.map((source,i)=>bundle(source,moduleNames[i])).join('\n');
const app=(await read('app.js')).replace(/^import .*?;\s*$/gm,'');
const script=`${scripts}\nconst {DOMAINS,WORKFLOWS,PROFILES}=catalogModule;\nconst {UI,WEEKDAYS,policyText}=i18nModule;\nconst {addDemoData}=demoModule;\n${app}`;
const html=await read('index.html'),css=await read('styles.css'),connectedCSS=await read('connected-scoped.css');
const today=new Date().toISOString().slice(0,10);
const sample={fr:demoRecords(today,'fr'),en:demoRecords(today,'en')};
for(const lang of ['fr','en']){
 const config=`window.ESSENTIEL_PREVIEW=true;window.ESSENTIEL_LANG=${JSON.stringify(lang)};window.ESSENTIEL_DEMO=${JSON.stringify(sample)};`;
 const built=html.replace('lang="fr"',`lang="${lang}"`).replace('<link rel="stylesheet" href="/styles.css">',`<style>${css}</style>`).replace('<link rel="stylesheet" href="/connected-scoped.css">',`<style>${connectedCSS}</style>`).replace('<link rel="modulepreload" href="/connected.js">','').replace('<script type="module" src="/app.js"></script>','').replace('</body>',`<script type="module">\n${(config+'\n'+script).replace(/<\/script/gi,'<\\/script')}\n</script></body>`);
 await writeFile(path.join(root,`preview-${lang}.html`),built);
 if(lang==='fr')await writeFile(path.join(root,'preview.html'),built);
}
console.log('Built self-contained FR and EN previews. No external dependencies or provider calls.');
