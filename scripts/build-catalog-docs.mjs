/** Generate the bilingual inventory from the shipped executable catalog. */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DOMAINS, WORKFLOWS, PROFILES } from '../public/catalog.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const lang of ['en','fr']){
 const fr=lang==='fr';
 let text=fr?'# Les besoins couverts — Essentiel 0.2\n\n':'# Human needs covered — Essentiel 0.2\n\n';
 text+=fr?'**28 domaines, 112 parcours activables, 448 étapes éditables.** Inventaire généré depuis le même catalogue que l’application. Chaque parcours devient quatre tâches locales après revue et confirmation. Aucun service externe n’est contacté. Les dates et durées sont choisies, non déduites. Ces domaines sont facultatifs et extensibles ; il ne s’agit pas d’un modèle universel des désirs humains.\n\n':'**28 domains, 112 activatable workflows, 448 editable steps.** Generated from the same catalog as the application. Each workflow becomes four local tasks after review and confirmation. No external service is contacted. Dates and durations are chosen, not inferred. The domains are optional and extensible, not a universal model of human desire.\n\n';
 text+=fr?'## Utilisation\n\nEspaces de vie → domaine → parcours → modifier les étapes → choisir une date facultative et les dépendances → confirmer. Une date de départ vide laisse les tâches non datées. Les outils tâches, listes, décisions et carnet restent disponibles pour un besoin absent du catalogue. Un parcours décrit une procédure humaine, pas une intégration automatique à une banque, un professionnel, un organisateur ou une plateforme.\n\n':'## Use\n\nLife spaces → domain → workflow → edit the steps → choose an optional first date and dependencies → confirm. A blank first date creates undated tasks. Tasks, lists, decisions and notebook remain available for needs outside the catalog. A workflow describes a human procedure, not an automatic integration with a bank, professional, organizer or platform.\n\n';
 for(const [i,d]of DOMAINS.entries()){
  text+=`## ${String(i+1).padStart(2,'0')} — ${d.title[lang]}\n\n${d.description[lang]}\n\n`;
  if(d.caution[lang])text+=`**${fr?'Limite':'Boundary'} :** ${d.caution[lang]}\n\n`;
  for(const f of WORKFLOWS.filter(f=>f.domain===d.id)){
   text+=`### ${f.title[lang]}\n\n${fr?'Identifiant':'ID'}: \`${f.id}\`\n\n${fr?'Résultat attendu':'Intended outcome'}: ${f.outcome[lang]}\n\n`;
   f.steps.forEach((s,j)=>text+=`${j+1}. ${s[lang]}.\n`);text+='\n';
  }
 }
 text+=fr?'## Profils de départ facultatifs\n\n':'## Optional starting profiles\n\n';
 for(const p of PROFILES){text+=`**${p.title[lang]}** — ${p.domains.length?p.domains.map(id=>DOMAINS.find(d=>d.id===id).title[lang]).join(', '):(fr?'Tous les domaines.':'All domains.')}\n\n`;}
 await writeFile(path.join(root,`docs/HUMAN_NEEDS_${lang.toUpperCase()}.md`),text);
}
console.log('Generated both full human-needs inventories from the application catalog.');
