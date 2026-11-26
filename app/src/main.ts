/**
 * Cablage de l'interface du radier.
 *
 * Ce module ne calcule RIEN : il tient la saisie, appelle le noyau par `form`,
 * et confie la mise en forme aux modules purs.
 */

import {
  avertissement2eGeneration,
  blocsEnTexte,
  brancherFeuilles,
  definirLangue,
  langueDuDocument,
  nombreAffiche,
  noteDeCalculHtml,
  notationHtml,
  ouvrirOuTelecharger,
  resultatsEnCsv,
  svgAutonome,
  telecharger,
  telechargerNotePdf,
  type BarreFeuilles,
  type Json,
} from 'aedificium-ui';
import {
  ajouterPoteau,
  ajouterVoile,
  grillePoteaux,
  lireSaisie,
  proposerK,
  relire,
  retirerPoteau,
  retirerVoile,
  saisieParDefaut,
  serialiser,
  verifier,
  type Calcul,
  type Resultat,
  type Saisie,
} from './form';
import { carteRadier, type OptionsCarte, type VueCarte } from './dessin';
import { STYLES_TRACE } from './export';
import { noteDuCalcul } from './note';
import { textes } from './textes';
import { blocsResultat, entreesParSection, messageDErreur, poteauxHtml, verdictsHtml, voilesHtml, voletsHtml } from './vue';
import './style.css';

definirLangue(langueDuDocument(document));

const CLE_SAISIE = 'radier/saisie';
const CLE_CARTOUCHE = 'radier:cartouche';

function exige<T extends Element>(selecteur: string): T {
  const e = document.querySelector<T>(selecteur);
  if (e === null) throw new Error(textes().page.elementAbsent(selecteur));
  return e;
}

const formulaire = exige<HTMLFormElement>('#formulaire');
const zones = {
  erreur: exige<HTMLElement>('[data-role="erreur"]'),
  poteaux: exige<HTMLElement>('[data-role="poteaux"]'),
  voiles: exige<HTMLElement>('[data-role="voiles"]'),
  carte: exige<HTMLElement>('[data-role="carte"]'),
  vues: exige<HTMLElement>('[data-role="vues"]'),
  combinaisons: exige<HTMLElement>('[data-role="combinaisons"]'),
  verdicts: exige<HTMLElement>('[data-role="verdicts"]'),
  volets: exige<HTMLElement>('[data-role="volets"]'),
  aideK: exige<HTMLElement>('[data-role="aide-k"]'),
};
const champProjet = exige<HTMLInputElement>('[data-role="projet"]');
const champElement = exige<HTMLInputElement>('[data-role="element"]');

type Racine = Record<string, unknown>;

function charger(): Saisie | null {
  try {
    const t = window.localStorage.getItem(CLE_SAISIE);
    return t === null ? null : relire(t);
  } catch {
    return null;
  }
}

function memoriser(): void {
  try {
    window.localStorage.setItem(CLE_SAISIE, serialiser(saisie));
  } catch {
    // Stockage indisponible : la page fonctionne sans.
  }
}

function lireCartouche(): { projet: string; element: string } {
  try {
    const t = window.localStorage.getItem(CLE_CARTOUCHE);
    if (t === null) return { projet: '', element: '' };
    const c = JSON.parse(t) as { projet?: unknown; element?: unknown };
    return { projet: typeof c.projet === 'string' ? c.projet : '', element: typeof c.element === 'string' ? c.element : '' };
  } catch {
    return { projet: '', element: '' };
  }
}

let saisie: Saisie = charger() ?? saisieParDefaut();
let dernier: { calcul: Calcul; resultat: Resultat } | null = null;
let barre: BarreFeuilles | null = null;
let vue: VueCarte = 'w';
let combinaison = 'ELS';

function ecrireSaisie(): void {
  for (const e of formulaire.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-champ]')) {
    const cle = e.dataset.champ;
    if (cle === undefined) continue;
    const v = (saisie as unknown as Racine)[cle];
    if (e instanceof HTMLInputElement && e.type === 'checkbox') e.checked = v === true;
    else e.value = String(v);
  }
  rendreTables();
  ajusterAffichage();
}

function rendreTables(): void {
  zones.poteaux.innerHTML = poteauxHtml(saisie);
  zones.voiles.innerHTML = voilesHtml(saisie);
}

function montrerErreur(message: string | null): void {
  zones.erreur.hidden = message === null;
  zones.erreur.innerHTML = message === null ? '' : notationHtml(message);
}

function ajusterAffichage(): void {
  for (const b of formulaire.querySelectorAll<HTMLButtonElement>('[data-generation]')) {
    b.setAttribute('aria-pressed', String(b.dataset.generation === saisie.generation));
  }
  const bandeau = document.querySelector<HTMLElement>('[data-role="bandeau-2e-gen"]');
  if (bandeau !== null) {
    bandeau.hidden = saisie.generation !== '2e';
    bandeau.textContent = avertissement2eGeneration();
  }
  for (const g of formulaire.querySelectorAll<HTMLElement>('[data-groupe]')) g.hidden = g.dataset.groupe !== saisie.generation;
  for (const z of formulaire.querySelectorAll<HTMLElement>('[data-si-profil]')) z.hidden = z.dataset.siProfil !== saisie.profilNormatif;
  for (const z of formulaire.querySelectorAll<HTMLElement>('[data-si-bord]')) z.hidden = !saisie.bord;
  const k = proposerK(saisie);
  zones.aideK.innerHTML = k === null ? '' : notationHtml(textes().vue.aideK(nombreAffiche(Number(k), 0)));
}

function options(): OptionsCarte {
  const coche = (cle: string) => exige<HTMLInputElement>(`[data-option="${cle}"]`).checked;
  return { vue, combinaison, poteaux: coche('poteaux'), maillage: coche('maillage'), decolle: coche('decolle') };
}

/** Boutons de vue et de combinaison, puis la carte. Le tassement se lit a l'ELS, le reste a l'ELU. */
function renduCarte(): void {
  if (dernier === null) {
    zones.vues.innerHTML = '';
    zones.combinaisons.innerHTML = '';
    zones.carte.innerHTML = '';
    return;
  }
  const r = dernier.resultat;
  const t = textes().vues;
  const noms = [...r.combinaisons.map((k) => k.nom), 'ELS'];
  if (!noms.includes(combinaison)) combinaison = 'ELS';
  const vues: VueCarte[] = ['w', 'p', 'infX', 'infY', 'supX', 'supY'];
  zones.vues.innerHTML = vues.map((v) => `<button type="button" data-vue="${v}" aria-pressed="${v === vue}">${notationHtml(t[v])}</button>`).join('');
  zones.combinaisons.innerHTML = noms.map((n) => `<button type="button" data-combinaison="${n}" aria-pressed="${n === combinaison}">${n === 'ELS' ? t.ELS : n}</button>`).join('');
  zones.carte.innerHTML = carteRadier(dernier.calcul, r, options());
}

function viderResultats(): void {
  dernier = null;
  zones.verdicts.innerHTML = '';
  zones.volets.innerHTML = '';
  renduCarte();
}

function recalculer(): void {
  if (barre?.dansUnProjet()) barre.signaler();
  else memoriser();
  ajusterAffichage();
  const lecture = lireSaisie(saisie);
  if (!lecture.ok) {
    montrerErreur(lecture.message);
    return viderResultats();
  }
  let resultat: Resultat;
  try {
    resultat = verifier(lecture.calcul);
  } catch (e) {
    montrerErreur(messageDErreur(e));
    return viderResultats();
  }
  montrerErreur(null);
  dernier = { calcul: lecture.calcul, resultat };
  zones.verdicts.innerHTML = verdictsHtml(lecture.calcul, resultat);
  zones.volets.innerHTML = voletsHtml(lecture.calcul, resultat);
  renduCarte();
}

/** Recalcul differe : le noyau prend quelques dizaines de millisecondes, la frappe reste fluide. */
let minuterie: ReturnType<typeof setTimeout> | null = null;
function recalculerBientot(): void {
  if (minuterie !== null) clearTimeout(minuterie);
  minuterie = setTimeout(() => { minuterie = null; recalculer(); }, 250);
}

function entier(brut: string | undefined): number | null {
  if (brut === undefined) return null;
  const n = Number(brut);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function lireEdition(cible: EventTarget | null): void {
  if (!(cible instanceof HTMLInputElement || cible instanceof HTMLSelectElement)) return;
  const d = cible.dataset;
  if (d.champ !== undefined) {
    const v = cible instanceof HTMLInputElement && cible.type === 'checkbox' ? cible.checked : cible.value;
    (saisie as unknown as Racine)[d.champ] = v;
  } else if (d.poteau !== undefined && d.sous !== undefined) {
    const i = entier(d.poteau);
    if (i === null || i >= saisie.poteaux.length || !(d.sous in saisie.poteaux[i])) return;
    (saisie.poteaux[i] as unknown as Record<string, string>)[d.sous] = cible.value;
  } else if (d.voile !== undefined && d.sous !== undefined) {
    const i = entier(d.voile);
    if (i === null || i >= saisie.voiles.length || !(d.sous in saisie.voiles[i])) return;
    (saisie.voiles[i] as unknown as Record<string, string>)[d.sous] = cible.value;
  } else {
    return;
  }
  recalculerBientot();
}

formulaire.addEventListener('input', (e) => lireEdition(e.target));
for (const o of document.querySelectorAll<HTMLInputElement>('[data-option]')) o.addEventListener('input', () => renduCarte());

function cartouche(): { projet: string; element: string; date: string } {
  return { projet: champProjet.value, element: champElement.value, date: new Date().toISOString().slice(0, 10) };
}

document.addEventListener('click', (evenement) => {
  const cible = evenement.target;
  if (!(cible instanceof HTMLElement)) return;
  const bouton = cible.closest('button');
  if (bouton === null) return;
  const d = bouton.dataset;

  if (d.generation === '1re' || d.generation === '2e') {
    saisie = { ...saisie, generation: d.generation };
    return recalculer();
  }
  if (d.vue !== undefined) {
    vue = d.vue as VueCarte;
    if (vue === 'w') combinaison = 'ELS';
    else if (combinaison === 'ELS' && dernier !== null && dernier.resultat.combinaisons.length > 0) combinaison = dernier.resultat.moments.combinaison || dernier.resultat.combinaisons[0].nom;
    return renduCarte();
  }
  if (d.combinaison !== undefined) {
    combinaison = d.combinaison;
    return renduCarte();
  }

  const action = d.action;
  if (action === undefined) return;
  if (action === 'proposer-k') {
    const k = proposerK(saisie);
    if (k === null) return;
    saisie = { ...saisie, k };
    ecrireSaisie();
    return recalculer();
  }
  if (action === 'ajouter-poteau') { saisie = ajouterPoteau(saisie); rendreTables(); return recalculer(); }
  if (action === 'retirer-poteau') {
    const i = entier(d.poteau);
    if (i === null) return;
    saisie = retirerPoteau(saisie, i); rendreTables(); return recalculer();
  }
  if (action === 'ajouter-voile') { saisie = ajouterVoile(saisie); rendreTables(); return recalculer(); }
  if (action === 'retirer-voile') {
    const i = entier(d.voile);
    if (i === null) return;
    saisie = retirerVoile(saisie, i); rendreTables(); return recalculer();
  }
  if (action === 'grille-poteaux') {
    const xs = exige<HTMLInputElement>('[data-role="grille-x"]').value;
    const ys = exige<HTMLInputElement>('[data-role="grille-y"]').value;
    saisie = grillePoteaux(saisie, xs, ys); rendreTables(); return recalculer();
  }
  if (action === 'enregistrer') return telecharger('radier.json', serialiser(saisie), 'application/json;charset=utf-8');
  if (action === 'reinitialiser') { saisie = saisieParDefaut(); ecrireSaisie(); return recalculer(); }

  if (!action.startsWith('exporter-')) return;
  if (dernier === null) return montrerErreur(textes().messages.rienAExporter);
  const e = dernier;
  if (action === 'exporter-note' || action === 'exporter-note-pdf') {
    const note = noteDuCalcul(e.calcul, e.resultat, cartouche());
    if (action === 'exporter-note-pdf') void telechargerNotePdf('radier-note.pdf', note, STYLES_TRACE).catch(() => ouvrirOuTelecharger('radier-note.html', noteDeCalculHtml(note, STYLES_TRACE)));
    else ouvrirOuTelecharger('radier-note.html', noteDeCalculHtml(note, STYLES_TRACE));
  } else if (action === 'exporter-carte') {
    telecharger('radier-carte.svg', svgAutonome(carteRadier(e.calcul, e.resultat, options()), STYLES_TRACE), 'image/svg+xml;charset=utf-8');
  } else if (action === 'exporter-resultats') {
    const en = entreesParSection(e.calcul);
    const blocs = [
      { titre: textes().note.titreEntrees, lignes: [...en.geometrie, ...en.materiaux, ...en.charges], note: null },
      ...blocsResultat(e.calcul, e.resultat),
    ];
    telecharger('radier-resultats.csv', resultatsEnCsv(blocsEnTexte(blocs)), 'text/csv;charset=utf-8');
  }
});

exige<HTMLInputElement>('[data-role="ouvrir"]').addEventListener('change', async (e) => {
  const entree = e.target as HTMLInputElement;
  const f = entree.files?.[0];
  entree.value = '';
  if (f === undefined) return;
  try {
    saisie = relire(await f.text());
  } catch (err) {
    return montrerErreur(messageDErreur(err));
  }
  ecrireSaisie();
  recalculer();
});

const cartoucheMemorise = lireCartouche();
champProjet.value = cartoucheMemorise.projet;
champElement.value = cartoucheMemorise.element;
for (const champ of [champProjet, champElement]) {
  champ.addEventListener('input', () => {
    try {
      window.localStorage.setItem(CLE_CARTOUCHE, JSON.stringify({ projet: champProjet.value, element: champElement.value }));
    } catch {
      // Stockage indisponible.
    }
  });
}

ecrireSaisie();
recalculer();

barre = brancherFeuilles({
  app: 'radier',
  nomApp: document.querySelector('header h1')?.textContent ?? 'radier',
  conteneur: exige<HTMLElement>('[data-role="feuilles"]'),
  lire: () => JSON.parse(serialiser(saisie)) as Json,
  charger: (d) => {
    saisie = d === null ? saisieParDefaut() : relire(JSON.stringify(d));
    ecrireSaisie();
    recalculer();
  },
});

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  void import('./pwa').then((m) => m.enregistrerServiceWorker());
}
