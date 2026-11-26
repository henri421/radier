/**
 * Les textes affiches, en francais et en anglais. PUR. Aucun texte ne se lit au chargement d'un module :
 * toujours `textes()` ou `phrase()` au moment du rendu. Indices en notation (`q_Rd`).
 */

import { langueCourante, traducteur, type RegleDePhrase } from 'aedificium-ui';

const FR = {
  messages: {
    rienAExporter: 'Aucun calcul valide à exporter : corriger la saisie.',
    nouvelleVersion: 'Une nouvelle version est disponible. Recharger maintenant ?',
    calcul: 'Calcul en cours…',
  },
  refus: {
    nombre: (champ: string, brut: string) => `Le champ « ${champ} » n’est pas un nombre lisible (« ${brut} »).`,
    element: (element: string, champ: string, brut: string) =>
      `${element} : le champ « ${champ} » n’est pas un nombre lisible (« ${brut} »).`,
    poteau: (n: number) => `Poteau ${n}`,
    voile: (n: number) => `Voile ${n}`,
    format: (recu: string, attendu: string) => `Format de fichier inconnu (« ${recu} ») : attendu « ${attendu} ».`,
    champs: {
      Lx: 'L_x', Ly: 'L_y', t: 'Épaisseur t', E: 'E du béton', nu: 'ν du béton', k: 'k', maillage: 'Maillage',
      bordLargeur: 'Largeur de la bande de bord', bordFacteur: 'Facteur sur k en bord',
      surfG: 'Charge répartie G', surfQ: 'Charge répartie Q', qRd: 'q_Rd', wAdm: 'Tassement admissible',
      betaAdm: 'Distorsion admissible',
    },
  },
  page: { elementAbsent: (s: string) => `Élément de page absent : ${s}.` },
  vues: { w: 'Tassement', p: 'Pression', infX: 'm*x inf.', infY: 'm*y inf.', supX: 'm*x sup.', supY: 'm*y sup.', ELS: 'ELS' },
  dessin: {
    aria: 'Vue en plan du radier',
    titre: { w: 'Tassement (mm)', p: 'Pression du sol (kPa)', infX: 'm*x face inférieure (kN·m/m)', infY: 'm*y face inférieure (kN·m/m)', supX: 'm*x face supérieure (kN·m/m)', supY: 'm*y face supérieure (kN·m/m)' },
    longueur: (n: string, v: string) => `${n} = ${v} m`,
    decolle: 'zone décollée',
  },
  vue: {
    nonCalculable: 'non calculable',
    gouvernant: 'gouvernant',
    aideK: (k: string) => `k = 0,65·E′/(B·(1 − ν²)) = ${k} kN/m³ (B.16), B = petit côté.`,
    rigidite: 'Rigidité relative',
    rigiditeCorps: (ks: string, etat: string) => `K_s = ${ks} : ${etat}.`,
    rigide: 'radier rigide (K_s > 10)',
    souple: 'radier souple (K_s < 0,05)',
    intermediaire: 'entre 0,05 et 10, l’interaction est nécessaire (5.2.4.2)',
    elu: 'ELU',
    els: 'ELS',
    pression: (comb: string) => `Pression du sol · ${comb}`,
    pressionCorps: (p: string, q: string) => `p_max,d = ${p} kPa ≤ q_Rd = ${q} kPa.`,
    pressionSans: (p: string) => `p_max,d = ${p} kPa (q_Rd non saisi).`,
    decollement: 'Décollement',
    decollementCorps: (comb: string, f: string) => `${comb} : ${f} % des nœuds décollés.`,
    aucunDecollement: 'Aucun : tout le radier reste en contact.',
    moments: 'Moments de calcul',
    momentsCorps: (ix: string, iy: string, sx: string, sy: string, comb: string) =>
      `Face inférieure : m*x = ${ix}, m*y = ${iy} kN·m/m ; face supérieure : ${sx} et ${sy} kN·m/m (combinaison ${comb}, lissés sous les poteaux). Ferraillage et poinçonnement : outils EC2 et Poinçonnement.`,
    tassement: 'Tassement maximal',
    tassementCorps: (w: string, a: string, wmin: string) => `w_max = ${w} mm ≤ ${a} mm ; w_min = ${wmin} mm.`,
    tassementSans: (w: string, wmin: string) => `w_max = ${w} mm ; w_min = ${wmin} mm.`,
    distorsion: 'Distorsion entre poteaux',
    distorsionCorps: (b: string, p1: string, p2: string, a: string) => `β = 1/${b} entre ${p1} et ${p2} ≤ 1/${a}.`,
    distorsionSans: 'Moins de deux poteaux alignés : sans objet.',
    alertes: 'Alertes',
    poteaux: 'Tassements des poteaux',
    momentsTableau: 'Moments de calcul',
    hypotheses: 'Hypothèses',
    coefficients: 'Coefficients et sources',
  },
  note: {
    titreEntrees: 'Données',
    element: 'Radier',
    legende: (v: string) => `Vue en plan à l’échelle : ${v}.`,
    colonnesPoteaux: ['Poteau', 'x (m)', 'y (m)', 'G (kN)', 'Q (kN)', 'w ELS (mm)'],
    titrePoteaux: 'Tassements des poteaux (ELS)',
    titreMoments: 'Moments de calcul de Wood-Armer (kN·m/m), ELU',
    colonnesMoments: ['Moment', 'Pic au nœud', 'Lissé sous poteaux (retenu)'],
    lignesMoments: ['m*x face inférieure', 'm*y face inférieure', 'm*x face supérieure', 'm*y face supérieure'],
    titreCombinaisons: 'Résultats par combinaison',
    colonnesCombinaisons: ['Combinaison', 'γ_G', 'γ_Q', 'ΣF (kN)', 'p_max (kPa)', 'w_max (mm)', 'décollé (%)', 'taux'],
    clauses: { pression: 'EN 1997-3:2025, 5.6.3', tassement: 'EN 1997-3:2025, 5.5.4', distorsion: 'EN 1997-3:2025, 5.5.4' },
    verifPression: (comb: string) => `Pression du sol · ${comb}`,
    verifTassement: 'Tassement maximal',
    verifDistorsion: 'Distorsion entre poteaux',
    hypotheses: [
      'Interaction sol-structure par un modèle de ressorts équivalents (EN 1997-3:2025, 5.2.4.2), répartition des pressions sous radier souple (5.5.6).',
      'Plaque mince de Kirchhoff d’épaisseur constante, élastique linéaire non fissurée ; éléments rectangulaires ACM à 12 degrés de liberté.',
      'Ressorts de Winkler indépendants ; k justifié par k = 0,65·E′/(B·(1 − ν²)) (B.16) ; des ressorts uniformes sous-estiment les effets de bord (5.5.6, note 3).',
      'Décollement : les ressorts tendus sont retirés et le calcul refait jusqu’à stabilité de la zone de contact.',
      'Charges de poteaux réparties sur leur section ; rigidité de la superstructure non prise en compte.',
      'Moments de calcul de Wood-Armer (Wood 1968) pour un ferraillage orthogonal ; sous un poteau, moyenne sur (a + 2t) × (b + 2t), le pic au nœud dépendant du maillage.',
      'Distorsion β = |Δw|/distance entre poteaux voisins alignés, à l’ELS caractéristique.',
      'Non traités : contour quelconque, ouvertures, épaisseur variable, sol couplé, radier sur pieux, ferraillage, poinçonnement, gonflement, effets dynamiques.',
    ],
    combinaisons: {
      1: 'Combinaisons de l’approche retenue (EN 1997-1:2004), jeu « structure » pour les actions ; k non pondéré. ELS : G + Q.',
      2: 'Combinaisons (a) et (b) de l’EN 1997-1:2024 (EN 1990:2023, VC1 et VC3), jeu « structure » ; k non pondéré. ELS : G + Q.',
    },
    coefficients: 'Coefficients',
  },
};

export type Textes = typeof FR;

const EN: Textes = {
  messages: {
    rienAExporter: 'No valid calculation to export: correct the input.',
    nouvelleVersion: 'A new version is available. Reload now?',
    calcul: 'Calculating…',
  },
  refus: {
    nombre: (champ: string, brut: string) => `The field “${champ}” is not a readable number (“${brut}”).`,
    element: (element: string, champ: string, brut: string) =>
      `${element}: the field “${champ}” is not a readable number (“${brut}”).`,
    poteau: (n: number) => `Column ${n}`,
    voile: (n: number) => `Wall ${n}`,
    format: (recu: string, attendu: string) => `Unknown file format (“${recu}”): expected “${attendu}”.`,
    champs: {
      Lx: 'L_x', Ly: 'L_y', t: 'Thickness t', E: 'Concrete E', nu: 'Concrete ν', k: 'k', maillage: 'Mesh',
      bordLargeur: 'Edge strip width', bordFacteur: 'Factor on k at the edge',
      surfG: 'Distributed load G', surfQ: 'Distributed load Q', qRd: 'q_Rd', wAdm: 'Allowable settlement',
      betaAdm: 'Allowable distortion',
    },
  },
  page: { elementAbsent: (s: string) => `Missing page element: ${s}.` },
  vues: { w: 'Settlement', p: 'Pressure', infX: 'm*x bottom', infY: 'm*y bottom', supX: 'm*x top', supY: 'm*y top', ELS: 'SLS' },
  dessin: {
    aria: 'Plan view of the raft',
    titre: { w: 'Settlement (mm)', p: 'Ground pressure (kPa)', infX: 'm*x bottom face (kN·m/m)', infY: 'm*y bottom face (kN·m/m)', supX: 'm*x top face (kN·m/m)', supY: 'm*y top face (kN·m/m)' },
    longueur: (n: string, v: string) => `${n} = ${v} m`,
    decolle: 'uplifted zone',
  },
  vue: {
    nonCalculable: 'not computable',
    gouvernant: 'governing',
    aideK: (k: string) => `k = 0.65·E′/(B·(1 − ν²)) = ${k} kN/m³ (B.16), B = shorter side.`,
    rigidite: 'Relative stiffness',
    rigiditeCorps: (ks: string, etat: string) => `K_s = ${ks}: ${etat}.`,
    rigide: 'rigid raft (K_s > 10)',
    souple: 'flexible raft (K_s < 0.05)',
    intermediaire: 'between 0.05 and 10, interaction is needed (5.2.4.2)',
    elu: 'ULS',
    els: 'SLS',
    pression: (comb: string) => `Ground pressure · ${comb}`,
    pressionCorps: (p: string, q: string) => `p_max,d = ${p} kPa ≤ q_Rd = ${q} kPa.`,
    pressionSans: (p: string) => `p_max,d = ${p} kPa (q_Rd not input).`,
    decollement: 'Uplift',
    decollementCorps: (comb: string, f: string) => `${comb}: ${f} % of nodes uplifted.`,
    aucunDecollement: 'None: the whole raft stays in contact.',
    moments: 'Design moments',
    momentsCorps: (ix: string, iy: string, sx: string, sy: string, comb: string) =>
      `Bottom face: m*x = ${ix}, m*y = ${iy} kN·m/m; top face: ${sx} and ${sy} kN·m/m (combination ${comb}, smoothed under columns). Reinforcement and punching: EC2 and Punching tools.`,
    tassement: 'Maximum settlement',
    tassementCorps: (w: string, a: string, wmin: string) => `w_max = ${w} mm ≤ ${a} mm; w_min = ${wmin} mm.`,
    tassementSans: (w: string, wmin: string) => `w_max = ${w} mm; w_min = ${wmin} mm.`,
    distorsion: 'Distortion between columns',
    distorsionCorps: (b: string, p1: string, p2: string, a: string) => `β = 1/${b} between ${p1} and ${p2} ≤ 1/${a}.`,
    distorsionSans: 'Fewer than two aligned columns: not applicable.',
    alertes: 'Warnings',
    poteaux: 'Column settlements',
    momentsTableau: 'Design moments',
    hypotheses: 'Assumptions',
    coefficients: 'Factors and sources',
  },
  note: {
    titreEntrees: 'Input',
    element: 'Raft',
    legende: (v: string) => `Plan view to scale: ${v}.`,
    colonnesPoteaux: ['Column', 'x (m)', 'y (m)', 'G (kN)', 'Q (kN)', 'w SLS (mm)'],
    titrePoteaux: 'Column settlements (SLS)',
    titreMoments: 'Wood-Armer design moments (kN·m/m), ULS',
    colonnesMoments: ['Moment', 'Nodal peak', 'Smoothed under columns (used)'],
    lignesMoments: ['m*x bottom face', 'm*y bottom face', 'm*x top face', 'm*y top face'],
    titreCombinaisons: 'Results per combination',
    colonnesCombinaisons: ['Combination', 'γ_G', 'γ_Q', 'ΣF (kN)', 'p_max (kPa)', 'w_max (mm)', 'uplifted (%)', 'ratio'],
    clauses: { pression: 'EN 1997-3:2025, 5.6.3', tassement: 'EN 1997-3:2025, 5.5.4', distorsion: 'EN 1997-3:2025, 5.5.4' },
    verifPression: (comb: string) => `Ground pressure · ${comb}`,
    verifTassement: 'Maximum settlement',
    verifDistorsion: 'Distortion between columns',
    hypotheses: [
      'Soil-structure interaction by an equivalent spring model (EN 1997-3:2025, 5.2.4.2), bearing pressure under a flexible raft (5.5.6).',
      'Thin Kirchhoff plate of constant thickness, linear elastic, uncracked; 12-DOF rectangular ACM elements.',
      'Independent Winkler springs; k justified by k = 0.65·E′/(B·(1 − ν²)) (B.16); uniform springs underestimate edge effects (5.5.6, Note 3).',
      'Uplift: springs in tension are removed and the analysis repeated until the contact zone is stable.',
      'Column loads spread over their section; stiffness of the superstructure not considered.',
      'Wood-Armer design moments (Wood 1968) for orthogonal reinforcement; under a column, mean over (a + 2t) × (b + 2t), the nodal peak depending on the mesh.',
      'Distortion β = |Δw|/distance between neighbouring aligned columns, at characteristic SLS.',
      'Not covered: arbitrary outline, openings, variable thickness, coupled soil, piled raft, reinforcement, punching, swelling, dynamic effects.',
    ],
    combinaisons: {
      1: 'Combinations of the chosen approach (EN 1997-1:2004), “structure” set for actions; k not factored. SLS: G + Q.',
      2: 'Combinations (a) and (b) of EN 1997-1:2024 (EN 1990:2023, VC1 and VC3), “structure” set; k not factored. SLS: G + Q.',
    },
    coefficients: 'Factors',
  },
};

export function textes(): Textes {
  return langueCourante() === 'en' ? EN : FR;
}

/** Phrases du noyau (refus, alertes, sources) traduites en anglais. */
const EXACTES: Record<string, string> = {
  'Le radier se soulève entièrement.': 'The raft lifts off entirely.',
  'Le décollement ne se stabilise pas en 100 itérations.': 'Uplift does not stabilise within 100 iterations.',
  'Système instable : le radier n’est pas soutenu.': 'Unstable system: the raft is not supported.',
  'Élément dégénéré : matrice singulière.': 'Degenerate element: singular matrix.',
  'La longueur L_x doit être strictement positive.': 'The length L_x must be strictly positive.',
  'La largeur L_y doit être strictement positive.': 'The width L_y must be strictly positive.',
  "L'épaisseur t doit être strictement positive.": 'The thickness t must be strictly positive.',
  'Le module E doit être strictement positif.': 'The modulus E must be strictly positive.',
  'Le coefficient de raideur k doit être strictement positif.': 'The subgrade modulus k must be strictly positive.',
  'Le coefficient de Poisson ν doit être dans [0 ; 0,5[.': 'Poisson’s ratio ν must lie in [0; 0.5).',
  'Le maillage h doit être strictement positif.': 'The mesh size h must be strictly positive.',
  'Maillage trop fin : plus de 20 000 nœuds.': 'Mesh too fine: more than 20,000 nodes.',
  'Le maillage est plus grand que le radier.': 'The mesh size exceeds the raft.',
  'Bande de bord : la largeur doit être positive ou nulle et le facteur strictement positif.':
    'Edge strip: the width must be zero or positive and the factor strictly positive.',
};
const REGLES: RegleDePhrase[] = [
  [/^Poteau (\d+) : les dimensions a et b doivent être strictement positives\.$/, (_m, n) => `Column ${n}: dimensions a and b must be strictly positive.`],
  [/^Poteau (\d+) : hors du radier\.$/, (_m, n) => `Column ${n}: outside the raft.`],
  [/^Voile (\d+) : hors du radier\.$/, (_m, n) => `Wall ${n}: outside the raft.`],
  [/^Voile (\d+) : longueur nulle\.$/, (_m, n) => `Wall ${n}: zero length.`],
  [/^Voile (\d+) : (.*)$/, (_m, n, r) => `Wall ${n}: ${r}`],
  [/^Poteau (\d+) : (.*)$/, (_m, n, r) => `Column ${n}: ${r}`],
  [/^(.+) : (\d+(?:[.,]\d+)?) % des nœuds décollés\.?$/, (_m, c, f) => `${c}: ${f} % of nodes uplifted.`],
];
export const phrase = traducteur(EXACTES, REGLES);
