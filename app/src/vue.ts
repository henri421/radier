/** Presentation du resultat : cartes de verification, volets, tableaux de saisie. Mise en forme pure : aucun calcul. */

import { type BlocResultat, echapper, type LigneResultat, lireNombre, nombreAffiche, notationHtml, tauxAffiche } from 'aedificium-ui';
import { rigiditeRelative, type Champ } from '../../src/radier';
import type { Calcul, Resultat, Saisie } from './form';
import { phrase, textes } from './textes';

const aff = (v: number, d: number): string => (Number.isFinite(v) ? nombreAffiche(v, d) : textes().vue.nonCalculable);
const sym = (s: string): string => notationHtml(s);
const texte = (s: string): string => notationHtml(phrase(s));
const brut = (v: string): string => echapper(v);

function largeur(v: number): string {
  if (Number.isNaN(v)) return '0';
  if (!Number.isFinite(v)) return v > 0 ? '100' : '0';
  return String(Math.min(100, Math.max(0, Math.round(v * 1000) / 10)));
}

const ligne = (symbole: string, libelle: string, valeur: string): LigneResultat => ({ symbole, libelle, valeur });

/** Indice du noeud le plus proche d'un point (lecture du champ, pas d'interpolation). */
export function noeudLePlusProche(c: Champ, x: number, y: number): number {
  let best = 0;
  let dmin = Infinity;
  for (let i = 0; i < c.xs.length; i += 1) {
    if (!c.dans[i]) continue;
    const d = (c.xs[i] - x) * (c.xs[i] - x) + (c.ys[i] - y) * (c.ys[i] - y);
    if (d < dmin) { dmin = d; best = i; }
  }
  return best;
}

/** « 1/472 » pour une distorsion ; tiret si nulle. */
const unSur = (b: number): string => (b > 0 && Number.isFinite(b) ? aff(1 / b, 0) : '—');
const point = (p: [number, number]): string => `(${aff(p[0], 2)} ; ${aff(p[1], 2)})`;

// ---------------------------------------------------------------------------------------------
// Entrees
// ---------------------------------------------------------------------------------------------

export function entreesParSection(c: Calcul): Record<'geometrie' | 'materiaux' | 'charges', LigneResultat[]> {
  const d = c.donnees;
  const ch = textes().refus.champs;
  const geometrie = [
    ligne('L_x', ch.Lx, `${aff(d.Lx, 3)} m`),
    ligne('L_y', ch.Ly, `${aff(d.Ly, 3)} m`),
    ...(d.contour ? [ligne('', ch.contour, d.contour.map((p) => point(p)).join(' – '))] : []),
    ...((d.ouvertures ?? []).length > 0 ? [ligne('', ch.ouvertures, (d.ouvertures ?? []).map((o) => o.map((p) => point(p)).join(' – ')).join(' ; '))] : []),
    ligne('t', ch.t, `${aff(d.t, 3)} m`),
    ligne('h', ch.maillage, `${aff(d.maillage, 3)} m`),
  ];
  const materiaux = [
    ligne('E', ch.E, `${aff(d.E / 1e6, 2)} GPa`),
    ligne('ν', ch.nu, aff(d.nu, 3)),
    ligne('k', ch.k, `${aff(d.k, 0)} kN/m³`),
    ...(d.bord === null ? [] : [ligne('', ch.bordLargeur, `${aff(d.bord.largeur, 2)} m`), ligne('', ch.bordFacteur, aff(d.bord.facteur, 2))]),
  ];
  const charges = [
    ligne('g', ch.surfG, `${aff(d.surface.g, 2)} kPa`),
    ligne('q', ch.surfQ, `${aff(d.surface.q, 2)} kPa`),
  ];
  return { geometrie, materiaux, charges };
}

// ---------------------------------------------------------------------------------------------
// Resultats (CSV)
// ---------------------------------------------------------------------------------------------

export function blocsResultat(c: Calcul, r: Resultat): BlocResultat[] {
  const v = textes().vue;
  const n = textes().note;
  const blocs: BlocResultat[] = r.combinaisons.map((k) => ({
    titre: `${v.elu} ${k.nom}`,
    lignes: [
      ligne('γ_G', '', aff(k.gG, 3)),
      ligne('γ_Q', '', aff(k.gQ, 3)),
      ligne('ΣF', '', `${aff(k.champ.Ftot, 1)} kN`),
      ligne('p_max', '', `${aff(k.pmax, 1)} kPa`),
      ligne('w_max', '', `${aff(Math.max(...k.champ.w) * 1000, 1)} mm`),
      ligne('', v.decollement, `${aff(k.decolle * 100, 1)} %`),
      ...(k.taux === null ? [] : [ligne('', textes().vue.pression(k.nom), tauxAffiche(k.taux))]),
    ],
    note: null,
  }));
  blocs.push({
    titre: n.titreMoments,
    lignes: [
      ligne('m*x,inf', n.lignesMoments[0], aff(r.moments.infX, 1)),
      ligne('m*y,inf', n.lignesMoments[1], aff(r.moments.infY, 1)),
      ligne('m*x,sup', n.lignesMoments[2], aff(r.moments.supX, 1)),
      ligne('m*y,sup', n.lignesMoments[3], aff(r.moments.supY, 1)),
    ],
    note: null,
  });
  const s = r.service;
  blocs.push({
    titre: v.els,
    lignes: [
      ligne('w_max', '', `${aff(s.wmax * 1000, 1)} mm`),
      ligne('w_min', '', `${aff(s.wmin * 1000, 1)} mm`),
      ligne('β', '', s.entre === null ? '—' : `1/${unSur(s.beta)}`),
    ],
    note: null,
  });
  blocs.push({
    titre: n.titrePoteaux,
    lignes: c.donnees.poteaux.map((p, i) =>
      ligne(`P${i + 1}`, point([p.x, p.y]), `${aff(s.champ.w[noeudLePlusProche(s.champ, p.x, p.y)] * 1000, 1)} mm`)),
    note: null,
  });
  return blocs;
}

// ---------------------------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------------------------

interface Carte { titre: string; clause: string; corps: string; controle: number | null; gouvernant: boolean; verification: string }

function rendreCarte(c: Carte): string {
  const classes = ['verdict'];
  if (c.controle === null) classes.push('constat');
  else if (c.controle > 1) classes.push('depasse');
  const badge = c.gouvernant ? ` <span class="badge">${textes().vue.gouvernant}</span>` : '';
  const barre = c.controle === null ? '' : `<div class="jauge"><i style="width:${largeur(c.controle)}%"></i></div><span class="taux">${tauxAffiche(c.controle)}</span>`;
  const corps = c.controle !== null && c.controle > 1 ? c.corps.replace('≤', '&gt;') : c.corps;
  return `<div class="${classes.join(' ')}" data-verification="${echapper(c.verification)}">` +
    `<h3><span>${c.titre}${badge}</span><span class="clause">${echapper(c.clause)}</span></h3>${barre}<p>${corps}</p></div>`;
}

export function verdictsHtml(c: Calcul, r: Resultat): string {
  const v = textes().vue;
  const d = c.donnees;
  const gouv = (nom: string) => r.gouvernant.taux > 0 && r.gouvernant.verification === nom;
  let html = '';

  const Es = lireNombre(c.saisie.Esol);
  const nuS = lireNombre(c.saisie.nuSol);
  if (Es !== null && nuS !== null && Es > 0) {
    const ks = rigiditeRelative(d.E, d.nu, Es * 1000, nuS, Math.min(d.Lx, d.Ly), Math.max(d.Lx, d.Ly), d.t);
    const etat = ks > 10 ? v.rigide : ks < 0.05 ? v.souple : v.intermediaire;
    html += `<div class="groupe">${echapper(v.rigidite)}</div>`;
    html += rendreCarte({ titre: sym('K_s'), clause: 'B.14, (B.15)', corps: texte(v.rigiditeCorps(aff(ks, 3), etat)), controle: null, gouvernant: false, verification: 'rigidite' });
  }

  html += `<div class="groupe">${echapper(v.elu)}</div>`;
  for (const k of r.combinaisons) {
    const nom = `Pression du sol · ${k.nom}`;
    html += rendreCarte({
      titre: echapper(v.pression(k.nom)),
      clause: '5.6.3',
      corps: d.verifications.qRd === null ? texte(v.pressionSans(aff(k.pmax, 1))) : texte(v.pressionCorps(aff(k.pmax, 1), aff(d.verifications.qRd, 1))),
      controle: k.taux,
      gouvernant: gouv(nom),
      verification: nom,
    });
  }
  const decolles = r.combinaisons.filter((k) => k.decolle > 0);
  html += rendreCarte({
    titre: echapper(v.decollement), clause: v.elu,
    corps: decolles.length === 0 ? echapper(v.aucunDecollement) : decolles.map((k) => echapper(v.decollementCorps(k.nom, aff(k.decolle * 100, 1)))).join(' '),
    controle: null, gouvernant: false, verification: 'decollement',
  });
  const m = r.moments;
  html += rendreCarte({
    titre: echapper(v.moments), clause: 'Wood-Armer',
    corps: texte(v.momentsCorps(aff(m.infX, 1), aff(m.infY, 1), aff(m.supX, 1), aff(m.supY, 1), d.poteaux.length > 0 ? v.lisses(m.combinaison) : v.sansPoteaux(m.combinaison))),
    controle: null, gouvernant: false, verification: 'moments',
  });

  html += `<div class="groupe">${echapper(v.els)}</div>`;
  const s = r.service;
  html += rendreCarte({
    titre: echapper(v.tassement), clause: '5.5.4',
    corps: d.verifications.wAdm === null
      ? texte(v.tassementSans(aff(s.wmax * 1000, 1), aff(s.wmin * 1000, 1)))
      : texte(v.tassementCorps(aff(s.wmax * 1000, 1), aff(d.verifications.wAdm * 1000, 1), aff(s.wmin * 1000, 1))),
    controle: s.tauxW, gouvernant: gouv('Tassement maximal'), verification: 'Tassement maximal',
  });
  html += rendreCarte({
    titre: echapper(v.distorsion), clause: '5.5.4',
    corps: s.entre === null
      ? echapper(v.distorsionSans)
      : texte(v.distorsionCorps(unSur(s.beta), point(s.entre[0]), point(s.entre[1]), d.verifications.betaAdm === null ? '—' : unSur(d.verifications.betaAdm))),
    controle: s.entre === null ? null : s.tauxBeta, gouvernant: gouv('Distorsion angulaire'), verification: 'Distorsion angulaire',
  });

  if (r.alertes.length > 0) {
    html += `<div class="alertes"><h3>${echapper(v.alertes)}</h3><ul>${r.alertes.map((a) => `<li>${texte(a)}</li>`).join('')}</ul></div>`;
  }
  return html;
}

// ---------------------------------------------------------------------------------------------
// Volets
// ---------------------------------------------------------------------------------------------

const tableau = (entetes: readonly string[], lignes: string[][]): string =>
  `<div class="defile"><table><thead><tr>${entetes.map((e, i) => `<th${i > 0 ? ' class="n"' : ''}>${notationHtml(e)}</th>`).join('')}</tr></thead>` +
  `<tbody>${lignes.map((l) => `<tr>${l.map((x, i) => `<td${i > 0 ? ' class="n"' : ''}>${echapper(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

export function lignesMoments(r: Resultat): string[][] {
  const n = textes().note;
  const k = r.combinaisons.find((x) => x.nom === r.moments.combinaison) ?? r.combinaisons[0];
  const pic = k?.moments.pic;
  const cles = ['infX', 'infY', 'supX', 'supY'] as const;
  return cles.map((c, i) => [n.lignesMoments[i], pic === undefined ? '—' : aff(pic[c], 1), aff(r.moments[c], 1)]);
}

export function lignesPoteaux(c: Calcul, r: Resultat): string[][] {
  const ch = r.service.champ;
  return c.donnees.poteaux.map((p, i) => [
    `P${i + 1}`, aff(p.x, 2), aff(p.y, 2), aff(p.G, 0), aff(p.Q, 0), aff(ch.w[noeudLePlusProche(ch, p.x, p.y)] * 1000, 1),
  ]);
}

export function voletsHtml(c: Calcul, r: Resultat): string {
  const t = textes();
  const n = t.note;
  const v = t.vue;
  const coefficients = r.combinaisons.map((k) =>
    `<p><b>${echapper(k.nom)}</b> · ${k.coefficients.map((x) => `${sym(x.nom)} = ${aff(x.valeur, 3)} <span class="source">(${texte(x.source)})</span>`).join(' ; ')}</p>`).join('');
  return `<details class="deriv" open><summary>${echapper(n.titreMoments)}</summary>${tableau(n.colonnesMoments, lignesMoments(r))}</details>` +
    `<details class="deriv"><summary>${echapper(n.titrePoteaux)}</summary>${tableau(n.colonnesPoteaux, lignesPoteaux(c, r))}</details>` +
    `<details class="deriv"><summary>${echapper(v.coefficients)}</summary><div>${coefficients}<p>${echapper(n.combinaisons[r.generation])}</p></div></details>` +
    `<details class="deriv"><summary>${echapper(v.hypotheses)}</summary><div><ul>${n.hypotheses.map((h) => `<li>${texte(h)}</li>`).join('')}</ul></div></details>`;
}

// ---------------------------------------------------------------------------------------------
// Saisie des poteaux et des voiles
// ---------------------------------------------------------------------------------------------

const entree = (attr: string, valeur: string, libelle: string): string =>
  `<input type="text" inputmode="decimal" ${attr} value="${brut(valeur)}" aria-label="${echapper(libelle)}">`;

export function poteauxHtml(s: Saisie): string {
  const e = textes().refus;
  const cles = ['x', 'y', 'a', 'b', 'G', 'Q'] as const;
  const lignes = s.poteaux.map((p, i) =>
    `<tr><td>${i + 1}</td>${cles.map((k) => `<td>${entree(`data-poteau="${i}" data-sous="${k}"`, p[k], `${e.poteau(i + 1)} ${k}`)}</td>`).join('')}` +
    `<td><button type="button" data-action="retirer-poteau" data-poteau="${i}" aria-label="${echapper(e.poteau(i + 1))}">−</button></td></tr>`).join('');
  return `<div class="defile"><table class="saisie"><thead><tr><th>n°</th><th>x</th><th>y</th><th>a</th><th>b</th><th>G</th><th>Q</th><th></th></tr></thead><tbody>${lignes}</tbody></table></div>`;
}

export function voilesHtml(s: Saisie): string {
  if (s.voiles.length === 0) return '';
  const e = textes().refus;
  const cles = ['x1', 'y1', 'x2', 'y2', 'g', 'q'] as const;
  const lignes = s.voiles.map((w, i) =>
    `<tr><td>${i + 1}</td>${cles.map((k) => `<td>${entree(`data-voile="${i}" data-sous="${k}"`, w[k], `${e.voile(i + 1)} ${k}`)}</td>`).join('')}` +
    `<td><button type="button" data-action="retirer-voile" data-voile="${i}" aria-label="${echapper(e.voile(i + 1))}">−</button></td></tr>`).join('');
  return `<div class="defile"><table class="saisie"><thead><tr><th>n°</th><th>x₁</th><th>y₁</th><th>x₂</th><th>y₂</th><th>g</th><th>q</th><th></th></tr></thead><tbody>${lignes}</tbody></table></div>`;
}

export const messageDErreur = (e: unknown): string => phrase(e instanceof Error ? e.message : String(e));
