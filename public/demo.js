import * as C from './core.js';
/** Synthetic local fixtures, never a provider fallback or personal facts about the user. */
export function addDemoData(workspace, records, lang = 'fr') {
  const L = (fr, en) => lang === 'fr' ? fr : en;
  const today = C.localDay(), date = n => C.addDays(today, n);
  for (const key of ['records','tasks','routines','transactions','subscriptions','savings','lists','notes','decisions']) workspace[key] = workspace[key].filter(x => !x.synthetic && x.mode !== 'demo');
  workspace.records.push(...records.map(r => ({ ...r, synthetic: true })));
  const task = (key,title,en,domain,due,minutes,priority=1,sourceId='') => C.normalizeTask({ id:'sample-'+key,title:L(title,en),domain,due,minutes,priority,energy:2,sourceId,synthetic:true });
  const tasks = [
    task('school','Confirmer la sortie scolaire','Confirm the school trip','family',date(2),10,0,'demo-school'),
    task('email','Vérifier la demande d’accès au compte','Verify the account-access request','safety',today,15,0,'demo-credentials'),
    task('budget','Faire le point sur mon budget','Review my monthly budget','money',today,20,1),
    task('work','Relire la proposition du projet','Review the project proposal','work',date(7),45,1,'demo-work'),
    task('shopping','Préparer les courses de la semaine','Prepare the weekly shopping list','food',today,15,1),
    task('friend','Organiser une sortie avec un proche','Arrange an outing with a friend','relationships',date(1),15,1),
    task('learn','Terminer un exercice d’apprentissage','Complete a learning exercise','learning',date(4),30,2),
    task('home','Vérifier les consignes d’entretien','Review the maintenance instructions','home','',20,2)
  ];
  workspace.tasks.push(...tasks);
  workspace.routines.push(...[
    {id:'sample-routine-reset',title:L('Préparer demain en quelques minutes','Spend a few minutes preparing tomorrow'),minutes:7,days:[0,1,2,3,4,5,6],domain:'time',checks:[date(-1),date(-2)]},
    {id:'sample-routine-creative',title:L('Un moment de pratique créative','A moment of creative practice'),minutes:20,days:[2,4,6],domain:'creative',checks:[]},
    {id:'sample-routine-break',title:L('Faire une pause choisie','Take a self-chosen break'),minutes:10,days:[0,1,2,3,4,5,6],domain:'health',checks:[date(-1)]}
  ].map(v=>C.normalizeRoutine({...v,synthetic:true})));
  workspace.transactions.push(...[
    {id:'sample-income',title:L('Revenu de démonstration','Demonstration income'),amountMinor:340000,direction:'income',category:L('Revenus','Income')},
    {id:'sample-housing',title:L('Logement — exemple','Housing — example'),amountMinor:110000,direction:'expense',category:L('Logement','Housing')},
    {id:'sample-groceries',title:L('Épicerie — exemple','Groceries — example'),amountMinor:11245,direction:'expense',category:L('Alimentation','Food')},
    {id:'sample-transport',title:L('Transport — exemple','Transport — example'),amountMinor:5500,direction:'expense',category:L('Transport','Transport')}
  ].map(v=>C.normalizeTransaction({...v,currency:'CAD',date:today,synthetic:true})));
  workspace.subscriptions.push(...[
    {id:'sample-stream',title:L('Service vidéo fictif','Fictional video service'),amountMinor:1499,cadence:'monthly',renewal:date(5)},
    {id:'sample-storage',title:L('Stockage fictif','Fictional storage'),amountMinor:299,cadence:'monthly',renewal:date(12)},
    {id:'sample-club',title:L('Adhésion fictive','Fictional membership'),amountMinor:7200,cadence:'yearly',renewal:date(40)}
  ].map(v=>C.normalizeSubscription({...v,currency:'CAD',synthetic:true})));
  workspace.savings.push(C.normalizeSaving({id:'sample-saving',title:L('Une escapade choisie','A self-chosen getaway'),targetMinor:120000,savedMinor:35000,monthlyMinor:10000,currency:'CAD',synthetic:true}));
  workspace.lists.push(...[
    {id:'sample-list-tomato',title:L('Tomates','Tomatoes'),quantity:'4',kind:'shopping',list:L('Courses de la semaine','Weekly shopping')},
    {id:'sample-list-bread',title:L('Pain','Bread'),quantity:'1',kind:'shopping',list:L('Courses de la semaine','Weekly shopping')},
    {id:'sample-list-rice',title:L('Riz','Rice'),quantity:'500 g',kind:'pantry',list:L('Placard','Cupboard'),date:date(90)},
    {id:'sample-list-meal',title:L('Bol de riz et légumes','Rice and vegetable bowl'),kind:'meal',list:L('Cette semaine','This week'),date:today,ingredients:L('Carottes\nPetits pois\nRiz','Carrots\nPeas\nRice')},
    {id:'sample-list-pack',title:L('Chargeur du téléphone','Phone charger'),quantity:'1',kind:'packing',list:L('Prochaine escapade','Next getaway')}
  ].map(v=>C.normalizeListItem({...v,synthetic:true})));
  workspace.notes.push(...[
    {id:'sample-note-appointment',kind:'note',domain:'health',title:L('Préparer mon prochain rendez-vous','Prepare my next appointment'),body:L('Exemple fictif.\nNoter mes questions.\nConfirmer les documents demandés.\nConserver les instructions reçues sans les modifier.','Fictional example.\nWrite down my questions.\nConfirm requested documents.\nKeep received instructions without changing them.'),tags:L('rendez-vous, préparation','appointment, preparation')},
    {id:'sample-note-idea',kind:'idea',domain:'creative',title:L('Un projet pour le plaisir','A project for enjoyment'),body:L('Créer un petit carnet de recettes personnelles. Commencer par trois recettes que je connais déjà.','Create a small collection of personal recipes. Start with three recipes I already know.'),tags:L('création, personnel','creative, personal')},
    {id:'sample-note-docs',kind:'document',domain:'legacy',title:L('Où retrouver les documents','Where to find documents'),body:L('Exemple d’index, pas un coffre de secrets.\nConserver uniquement l’emplacement des originaux et les dates vérifiées.','Example index, not a secret vault.\nKeep only original locations and verified dates.'),location:L('Emplacement à compléter','Location to fill in'),tags:L('documents','documents')}
  ].map(v=>C.normalizeNote({...v,synthetic:true})));
  workspace.decisions.push(C.normalizeDecision({id:'sample-decision',title:L('Choisir mon prochain projet personnel','Choose my next personal project'),domain:'goals',context:L('Exemple de matrice renseignée à la main. Aucun score n’est produit par Jev.','Example matrix filled in by hand. No score was produced by Jev.'),constraints:L('Utiliser le matériel que je possède déjà.','Use equipment I already own.'),currency:'CAD',budgetMinor:null,synthetic:true,
    criteria:[{id:'interest',name:L('Intérêt personnel','Personal interest'),weight:3},{id:'feasibility',name:L('Faisabilité actuelle','Current feasibility'),weight:2},{id:'use',name:L('Utilité pour moi','Usefulness to me'),weight:1}],
    options:[{id:'portfolio',name:L('Petit site personnel','Small personal website'),description:L('Projet limité à trois pages.','A project limited to three pages.'),gate:'yes',scores:{interest:4,feasibility:5,use:4}},{id:'photo',name:L('Carnet photo','Photo journal'),description:L('Rassembler une sélection de photos déjà prises.','Collect a selection of existing photographs.'),gate:'yes',scores:{interest:5,feasibility:4,use:3}},{id:'course',name:L('Parcours d’apprentissage','Learning project'),description:L('Un exercice court, trois fois par semaine.','A short exercise, three times a week.'),gate:'yes',scores:{interest:4,feasibility:3,use:5}}]}));
  workspace.plan=C.planDay(workspace.tasks,{day:today,minutes:120,energy:2,reserve:20});
  return workspace;
}
