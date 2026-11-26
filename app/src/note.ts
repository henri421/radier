/**
 * Contenu de la note de calcul commune (`noteDeCalculHtml` d'aedificium-ui). PUR : aucun calcul.
 */

import { avertissement2eGeneration, type ElementNote, type LigneResultat, type NoteDeCalcul, type VerificationNote, nombreAffiche, tauxAffiche } from 'aedificium-ui';
import type { Calcul, Resultat } from './form';
import { carteRadier } from './dessin';
import { phrase, textes } from './textes';
import { entreesParSection, lignesMoments, lignesPoteaux } from './vue';
import { VERSION_OUTIL } from './version';

const NORME_1RE = 'EN 1997-1:2004';
const NORME_1RE_ANB = 'EN 1997-1:2004, NBN EN 1997-1 ANB:2022';
const NORMES_2E = 'EN 1997-3:2025, EN 1990:2023';

const bloc = (titre: string, lignes: LigneResultat[]): ElementNote => ({ type: 'bloc', bloc: { titre, lignes, note: null } });
const f = (v: number, d: number): string => (Number.isFinite(v) ? nombreAffiche(v, d) : '—');

function verificationsDe(c: Calcul, r: Resultat): VerificationNote[] {
  const n = textes().note;
  const v = c.donnees.verifications;
  const liste: VerificationNote[] = [];
  for (const k of r.combinaisons) {
    if (k.taux !== null) liste.push({ nom: n.verifPression(phrase(k.nom)), clause: n.clauses.pression, taux: k.taux, ok: k.taux <= 1 });
  }
  if (v.wAdm !== null && r.service.tauxW !== null) {
    liste.push({ nom: n.verifTassement, clause: n.clauses.tassement, taux: r.service.tauxW, ok: r.service.tauxW <= 1 });
  }
  if (v.betaAdm !== null && r.service.tauxBeta !== null && r.service.entre !== null) {
    liste.push({ nom: n.verifDistorsion, clause: n.clauses.distorsion, taux: r.service.tauxBeta, ok: r.service.tauxBeta <= 1 });
  }
  return liste;
}

export function noteDuCalcul(c: Calcul, r: Resultat, cartouche: { projet: string; element: string; date: string }): NoteDeCalcul {
  const t = textes();
  const n = t.note;
  const d = c.donnees;
  const e = entreesParSection(c);
  const norme = d.norme;
  const elu = r.moments.combinaison !== '' ? r.moments.combinaison : (r.combinaisons[0]?.nom ?? 'ELS');

  const poteaux: ElementNote = { type: 'tableau', titre: n.titrePoteaux, entetes: [...n.colonnesPoteaux], lignes: lignesPoteaux(c, r) };
  const voiles: ElementNote[] = d.voiles.length === 0 ? [] : [{
    type: 'tableau',
    entetes: ['n°', 'x₁ (m)', 'y₁ (m)', 'x₂ (m)', 'y₂ (m)', 'g (kN/m)', 'q (kN/m)'],
    lignes: d.voiles.map((w, i) => [String(i + 1), f(w.x1, 2), f(w.y1, 2), f(w.x2, 2), f(w.y2, 2), f(w.g, 1), f(w.q, 1)]),
  }];
  const combinaisons: ElementNote = {
    type: 'tableau',
    titre: n.titreCombinaisons,
    entetes: [...n.colonnesCombinaisons],
    lignes: [
      ...r.combinaisons.map((k) => [
        phrase(k.nom), f(k.gG, 2), f(k.gQ, 2), f(k.champ.Ftot, 0), f(k.pmax, 1), f(Math.max(...k.champ.w) * 1000, 1),
        f(k.decolle * 100, 1), k.taux === null ? '—' : tauxAffiche(k.taux),
      ]),
      [t.vue.els, '1', '1', f(r.service.champ.Ftot, 0), f(r.service.pmax, 1), f(r.service.wmax * 1000, 1),
        f((r.service.champ.actif.filter((a) => !a).length / r.service.champ.actif.length) * 100, 1), r.service.tauxW === null ? '—' : tauxAffiche(r.service.tauxW)],
    ],
  };
  const moments: ElementNote = { type: 'tableau', titre: n.titreMoments, entetes: [...n.colonnesMoments], lignes: lignesMoments(r) };
  const coefficients = r.combinaisons.map((k) =>
    bloc(`${n.coefficients}, ${phrase(k.nom)}`, k.coefficients.map((x) => ({ symbole: x.nom, libelle: phrase(x.source), valeur: nombreAffiche(x.valeur, 3) }))));

  const optionsCarte = { poteaux: true, maillage: false, decolle: true };
  return {
    cartouche: {
      version: VERSION_OUTIL,
      projet: cartouche.projet,
      element: cartouche.element.trim() === '' ? n.element : cartouche.element,
      date: cartouche.date,
      norme: norme.generation === 2 ? NORMES_2E : norme.profil === 'anb' ? NORME_1RE_ANB : NORME_1RE,
      outil: 'radier',
    },
    sections: {
      geometrie: [
        bloc(n.titreEntrees, e.geometrie),
        { type: 'figure', svg: carteRadier(c, r, { vue: 'w', combinaison: 'ELS', ...optionsCarte }), legende: n.legende(`${t.dessin.titre.w}, ${t.vue.els}`) },
      ],
      materiaux: [bloc(n.titreEntrees, e.materiaux)],
      hypotheses: [{ type: 'liste', items: [...n.hypotheses] }],
      charges: [bloc(n.titreEntrees, e.charges), poteaux, ...voiles],
      combinaisons: [{ type: 'liste', items: [n.combinaisons[r.generation]] }, ...coefficients],
      calculs: [
        combinaisons,
        moments,
        { type: 'figure', svg: carteRadier(c, r, { vue: 'p', combinaison: elu, ...optionsCarte }), legende: n.legende(`${t.dessin.titre.p}, ${phrase(elu)}`) },
        { type: 'figure', svg: carteRadier(c, r, { vue: 'infX', combinaison: elu, ...optionsCarte }), legende: n.legende(`${t.dessin.titre.infX}, ${phrase(elu)}`) },
        { type: 'figure', svg: carteRadier(c, r, { vue: 'supY', combinaison: elu, ...optionsCarte }), legende: n.legende(`${t.dessin.titre.supY}, ${phrase(elu)}`) },
      ],
    },
    verifications: verificationsDe(c, r),
    avertissements: [...(norme.generation === 2 ? [avertissement2eGeneration()] : []), ...r.alertes.map((a) => phrase(a))],
  };
}
