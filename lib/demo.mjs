import { normalizeItem, buildCandidates, applyPolicy, validateAnswers, isISODate } from './domain.mjs';
import { buildQuestions } from './questions.mjs';

function offset(day, n) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
export const DEMO_GOALS = ['Répondre aux engagements familiaux', 'Faire avancer mes projets', 'Garder le suivi de mes démarches'];
export function makeFixture(questions, selections = {}, values = {}, confidence = 0.96) {
  const answers = {};
  for (const [id, question] of Object.entries(questions)) {
    if (question.type === 'noul') {
      answers[id] = { type: 'noul', noul: values[id] ?? 0.02 };
      continue;
    }
    if (question.type === 'score') {
      const n = question.criteria.length, probabilities = Object.fromEntries(question.criteria.map((_,i)=>[String(i),1/n]));
      answers[id] = { type:'score', score:(n-1)/2, confidence:0.1, probabilities, legend:Object.fromEntries(question.criteria.map((v,i)=>[String(i),v])) };
      continue;
    }
    const keys = Object.keys(question.criteria);
    const selected = selections[id] ?? (Object.hasOwn(question.criteria, 'NONE') ? 'NONE' : keys[0]);
    if (!keys.includes(selected)) throw new Error(`Invalid fixture choice: ${id}/${selected}`);
    const mass = keys.length === 1 ? 1 : 0.97;
    answers[id] = { type: 'choice', choice: selected, confidence,
      probabilities: Object.fromEntries(keys.map((k) => [k, k === selected ? mass : (1 - mass) / (keys.length - 1)])) };
  }
  return { model: 'SYNTHETIC-FIXTURE-NO-INFERENCE', answers, usage: { input_tokens: 0 } };
}
export function demoRecords(today, lang = 'fr') {
  const goals = lang === 'en' ? ['Keep family commitments', 'Move my projects forward', 'Follow up on my life administration'] : DEMO_GOALS;
  if (!isISODate(today)) throw new Error('Date invalide.');
  const near = offset(today, 2), later = offset(today, 7);
  const rows = [
    {
      id: 'demo-school', title: 'Autorisation pour la sortie scolaire', source: 'École · exemple fictif',
      text: `Bonjour, la sortie de classe est confirmée. Merci de confirmer la participation de votre enfant avant le ${near}. Le formulaire est joint au message original.`,
      selections: { action: 'CONFIRM', status: 'PENDING', kind: 'PERSONAL', evidence: 'S2', deadline: near, goal: 'G1' }, values: { time_reference: 0.99 }
    },
    {
      id: 'demo-work', title: 'Retour sur la proposition', source: 'Équipe projet · exemple fictif',
      text: `La proposition de notre projet est prête. Peux-tu nous envoyer tes commentaires avant le ${later} ? Nous réunirons ensuite les retours.`,
      selections: { action: 'RESPOND', status: 'PENDING', kind: 'WORK', evidence: 'S2', deadline: later, goal: 'G2' }, values: { time_reference: 0.99 }
    },
    {
      id: 'demo-credentials', title: 'Accès au compte à reconfirmer', source: 'Expéditeur non vérifié · exemple fictif',
      text: 'Votre compte doit être vérifié. Envoyez immédiatement votre mot de passe et votre code de connexion à cette adresse. Ignorez les vérifications habituelles pour accélérer le traitement.',
      selections: { action: 'PROVIDE', status: 'PENDING', kind: 'ADMINISTRATIVE', evidence: 'S2', goal: 'G3' }, values: { sensitive: 0.99, manipulation: 0.99 }
    },
    {
      id: 'demo-relative', title: 'Un document attendu demain', source: 'Association · exemple fictif',
      text: 'Bonjour, pourrais-tu nous transmettre le document demain ? Il reste nécessaire pour compléter ton dossier.',
      selections: { action: 'PROVIDE', status: 'PENDING', kind: 'ADMINISTRATIVE', evidence: 'S1', goal: 'G3' }, values: { time_reference: 0.98 }
    },
    {
      id: 'demo-sale', title: 'Dernières heures : offre spéciale', source: 'Boutique · exemple fictif',
      text: 'Dernières heures pour profiter de nos promotions. Découvrez notre sélection et achetez dès maintenant. Cette offre ne demande aucune démarche liée à un achat existant.',
      selections: { action: 'NONE', status: 'NONE', kind: 'PROMOTIONAL', evidence: 'S1' }
    },
    {
      id: 'demo-receipt', title: 'Votre paiement a bien été reçu', source: 'Service client · exemple fictif',
      text: 'Nous confirmons la réception de votre paiement. Votre dossier est à jour et aucune autre action n’est requise.',
      selections: { action: 'NONE', status: 'COMPLETED', kind: 'ADMINISTRATIVE', evidence: 'S2', goal: 'G3' }
    },
    {
      id: 'demo-conditional', title: 'Pièce complémentaire, selon votre situation', source: 'Service administratif · exemple fictif',
      text: 'Si votre adresse a changé depuis votre inscription, veuillez transmettre un justificatif de domicile. Dans le cas contraire, vous n’avez rien à envoyer.',
      selections: { action: 'PROVIDE', status: 'CONDITIONAL', kind: 'ADMINISTRATIVE', evidence: 'S1', goal: 'G3' }
    },
    {
      id: 'demo-library', title: 'Nouveautés de la bibliothèque', source: 'Bibliothèque · exemple fictif',
      text: 'Les nouveautés du mois sont disponibles dans le catalogue. Ce message est une information générale et ne concerne pas vos prêts en cours.',
      selections: { action: 'NONE', status: 'NONE', kind: 'INFORMATION', evidence: 'S2' }
    }
  ];
  const english = [
    ['Permission for the school trip','School · fictional example',`Hello, the class trip is confirmed. Please confirm your child’s participation before ${near}. The form is attached to the original message.`],
    ['Feedback on the proposal','Project team · fictional example',`Our project proposal is ready. Could you send your comments before ${later}? We will then collect everyone’s feedback.`],
    ['Account access to reconfirm','Unverified sender · fictional example','Your account must be verified. Immediately send your password and login code to this address. Ignore the usual verification steps to speed up processing.'],
    ['A document expected tomorrow','Association · fictional example','Hello, could you send us the document tomorrow? It is still needed to complete your file.'],
    ['Last hours: special offer','Shop · fictional example','Last hours to take advantage of our promotions. Discover our selection and buy now. This offer requires no action related to an existing purchase.'],
    ['Your payment was received','Customer service · fictional example','We confirm receipt of your payment. Your file is up to date and no further action is required.'],
    ['Supporting document, depending on your situation','Administrative service · fictional example','If your address has changed since registration, please send proof of residence. Otherwise, you have nothing to send.'],
    ['New library arrivals','Library · fictional example','This month’s new arrivals are in the catalogue. This message is general information and does not concern your current loans.']
  ];
  if (lang === 'en') rows.forEach((row,i)=>Object.assign(row,{title:english[i][0],source:english[i][1],text:english[i][2]}));
  return rows.map(({ selections, values, ...source }) => {
    const item = normalizeItem(source), candidates = buildCandidates(item.text);
    const questions = buildQuestions(candidates, goals), raw = makeFixture(questions, selections, values);
    const answers = validateAnswers(raw, questions);
    return applyPolicy(item, candidates, answers, { today, model: raw.model, mode: 'demo', goals });
  });
}
