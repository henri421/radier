# PLAN — Radier sur ressorts (lot F, étape 10)

Conçu par Claude le 26/11/2026. Maquette : `plan-webaedificium/maquette-radier.html`.
Référence de calcul : `tests/reference/radier.py`, attendus : `python tests/reference/attendus.py`.

## 1. Spécifications

### Objectif
Nouvel outil de la suite : un radier rectangulaire d'épaisseur constante sur ressorts de Winkler,
chargé par des poteaux, des voiles et une charge répartie. Il rend les tassements, la pression du sol,
la zone décollée et les moments de calcul de Wood-Armer, et vérifie p_max,d ≤ q_Rd, w_max ≤ w_adm et
β ≤ β_adm.

### Décisions de l'utilisateur (21 et 26/11/2026)
- Outil à part (dépôt `radier`), page FR et `/en/`, gabarit de la suite (comme pieux).
- Plaque rectangulaire en éléments finis (Kirchhoff, élément ACM à 12 ddl), maillage régulier.
- Sol : Winkler, k uniforme ; bande de bord facultative (largeur et facteur saisis, 5.5.6 note 3) ;
  ressorts sans traction si « décollement » (coché par défaut). Aide : k = 0,65 E′/(B(1−ν²)) (B.16),
  K_zz/(B·L) (B.19) pour comparaison, K_s (B.15).
- Sorties : pressions, tassements, moments de Wood-Armer ; ferraillage et poinçonnement renvoyés aux
  outils EC2 et Poinçonnement.
- **Moment de calcul sous poteau : lissé sur (a + 2t) × (b + 2t)** (choix du 26/11) ; le pic au nœud
  est affiché pour mémoire.

### Modèle (à reproduire exactement : les attendus en dépendent)
- **Maillage** : n_x = ⌈L_x/h − 1e-9⌉, n_y = ⌈L_y/h − 1e-9⌉ (au moins 1) ; pas a = L_x/n_x, b = L_y/n_y.
  Nœuds numérotés i + j·(n_x + 1) dans les sorties (x varie le plus vite). Refus si (n_x+1)(n_y+1) > 20 000
  (« maillage trop fin ») ou si h > min(L_x, L_y) (« maillage plus grand que le radier »).
- **Élément ACM** (rectangle a × b, nœuds (0,0), (a,0), (a,b), (0,b)) : w = polynôme à 12 termes
  [1, x, y, x², xy, y², x³, x²y, xy², y³, x³y, xy³] ; ddl par nœud (w, ∂w/∂y, −∂w/∂x) ;
  courbures κ = (−w,xx ; −w,yy ; −2w,xy) ; D = E t³/(12(1−ν²)), matrice D·[[1, ν, 0], [ν, 1, 0], [0, 0, (1−ν)/2]] ;
  intégration de Gauss 3 × 3. w est compté vers le bas ; m > 0 tend la face inférieure.
- **Ressorts** : au nœud, k·A_trib (A_trib = cellule [x ± a/2] × [y ± b/2] bornée au radier). Bande de
  bord : k × facteur si la distance du nœud au bord < largeur − 1e-9.
- **Charges** (intégrées sur la cellule tributaire de chaque nœud, exactement) :
  - répartie : γ_G·(g + 25·t si poids propre) + γ_Q·q (kPa) ;
  - poteau : (γ_G G + γ_Q Q)/(a b) sur son rectangle a × b ;
  - voile : longueur L découpée en m = ⌈L/(min(a,b)/4)⌉ morceaux égaux, chaque morceau
    (γ_G g + γ_Q q)·L/m au nœud i = clamp(⌊x_m/a + 0,5⌋), j = clamp(⌊y_m/b + 0,5⌋).
- **Résolution** : matrice en bande (aucune matrice pleine), élimination de Gauss sans pivotement ;
  la numérotation interne est libre (le long du petit côté conseillé). Pivot ≤ 0 : refus « radier
  instable ».
- **Décollement** : on part de tous les ressorts actifs ; après chaque résolution, actif = (w > 0) ; on
  recommence tant que l'ensemble change, au plus 100 fois (sinon refus « décollement non convergé »).
  `iterations` = nombre de résolutions moins 1. Sans décollement : une seule résolution.
- **Pression** p = k·w (kPa) aux nœuds actifs, 0 ailleurs. R = Σ k A_trib w (actifs), F_tot = Σ forces nodales.
- **Moments aux nœuds** : moyenne, sur les éléments voisins, de D·B(nœud)·u_e.
- **Wood-Armer** : face inférieure m*_x = m_x + |m_xy|, m*_y = m_y + |m_xy| ; si m*_x < 0 : m*_x = 0,
  m*_y = m_y + m_xy²/|m_x| ; sinon si m*_y < 0 : m*_y = 0, m*_x = m_x + m_xy²/|m_y| ; puis bornés à ≥ 0.
  Face supérieure symétrique (signes opposés, bornés à ≤ 0). |·| au dénominateur borné à 1e-12.
- **Moments de calcul** : par composante (inf_x, inf_y, sup_x, sup_y), extrême de l'ensemble
  {valeurs nodales hors de tous les carrés de poteau} ∪ {moyenne des nœuds de chaque carré}, le carré d'un
  poteau étant |x − x_p| ≤ a/2 + t + 1e-9 et |y − y_p| ≤ b/2 + t + 1e-9. `pic` = extrêmes nodaux bruts.
- **Distorsion** : pour chaque poteau, son plus proche voisin à droite (même y à 1e-6) et au-dessus (même
  x à 1e-6) ; w des poteaux par interpolation bilinéaire dans la cellule (i = min(n_x−1, ⌊x/a⌋)) ;
  β = |Δw|/distance ; une paire ne remplace la précédente que si β > β_max·(1 + 1e-9) + 1e-15 (les égalités de symétrie gardent la première paire dans l'ordre de la liste des poteaux, voisin à droite avant voisin au-dessus) ; `entre` = [poteau, voisin].
- **Combinaisons** : sol-ec7, jeu `structure` (γ_G = gG_dst, γ_Q = gQ_dst) :
  2e génération `combinaisons2g('a+b', cc, profil2g())` ; 1re `combinaisons1g(approche, profil1g())`,
  ANB : `combinaisons1g('DA1', profilAnb2022(risque))`. k n'est pas pondéré. ELS : G + Q.
- **Vérifications** (chaque limite peut être `null` : pas de taux) : par combinaison ELU
  taux = p_max/q_Rd ; ELS tauxW = w_max/w_adm, tauxBeta = β/β_adm. Gouvernant : le plus grand taux.
  Moments de calcul retenus : extrêmes sur les combinaisons ELU, avec le nom de la combinaison de inf_x.
- **Aides** : kSubgrade(E′, ν, B) = 0,65E′/(B(1−ν²)) ; kzzSurAire(E′, ν, B, L) = G·B/(1−ν)·(0,73 + 1,54(B/L)^0,75)/(B·L),
  G = E′/(2(1+ν)), B = min, L = max ; rigiditeRelative(E_f, ν_f, E_g, ν_g, B, L, t) =
  5,57 (E_f/E_g)(1−ν_g²)/(1−ν_f²)(B/L)^0,5 (t/L)³.

### Interfaces publiques (`src/radier.ts`, PUR)
```ts
export interface Poteau { x: number; y: number; a: number; b: number; G: number; Q: number }
export interface Voile { x1: number; y1: number; x2: number; y2: number; g: number; q: number }
export type Norme = { generation: 2; cc: 'CC1' | 'CC2' | 'CC3' }
  | { generation: 1; profil: 'recommande'; approche: 'DA1' | 'DA2' | 'DA3' }
  | { generation: 1; profil: 'anb'; risque: 'faible' | 'normal' | 'eleve' };
export interface DonneesRadier { Lx: number; Ly: number; t: number; E: number /* kPa */; nu: number;
  k: number /* kN/m3 */; maillage: number; poidsPropre: boolean; decollement: boolean;
  bord: { largeur: number; facteur: number } | null; poteaux: Poteau[]; voiles: Voile[];
  surface: { g: number; q: number };
  verifications: { qRd: number | null; wAdm: number | null /* m */; betaAdm: number | null }; norme: Norme }
export interface Champ { nx: number; ny: number; xs: number[] /* abscisse de chaque noeud */; ys: number[];
  w: number[]; p: number[]; mx: number[]; my: number[]; mxy: number[]; actif: boolean[];
  iterations: number; R: number; Ftot: number }
export interface MomentsWA { infX: number; infY: number; supX: number; supY: number }
export function analyseRadier(d: DonneesRadier, gG: number, gQ: number): Champ;
export function woodArmer(mx: number, my: number, mxy: number): MomentsWA;
export function momentsDeCalcul(d: DonneesRadier, c: Champ): { calcul: MomentsWA; pic: MomentsWA };
export function distorsion(d: DonneesRadier, c: Champ): { beta: number; entre: [[number, number], [number, number]] | null };
export function kSubgrade(Es: number, nu: number, B: number): number;
export function kzzSurAire(Es: number, nu: number, B: number, L: number): number;
export function rigiditeRelative(Ef: number, nuf: number, Eg: number, nug: number, B: number, L: number, t: number): number;
export interface CombinaisonRadier { nom: string; coefficients: { nom: string; valeur: number; source: string }[];
  gG: number; gQ: number; champ: Champ; moments: { calcul: MomentsWA; pic: MomentsWA };
  pmax: number; decolle: number /* fraction de noeuds */; taux: number | null }
export interface ResultatRadier { generation: 1 | 2; combinaisons: CombinaisonRadier[];
  service: { champ: Champ; wmax: number; wmin: number; pmax: number; beta: number;
    entre: [[number, number], [number, number]] | null; tauxW: number | null; tauxBeta: number | null };
  moments: MomentsWA & { combinaison: string }; gouvernant: { verification: string; taux: number };
  alertes: string[] }
export function verifierRadier(d: DonneesRadier): ResultatRadier;
```
`xs`/`ys` de `Champ` : une valeur PAR NŒUD (longueur (n_x+1)(n_y+1)), pas par ligne de grille.
Coefficients : noms « γ_G » et « γ_Q » avec la source de sol-ec7.
Refus (`Error`, en français) : L_x, L_y, t, E, k ≤ 0 (le message cite « épaisseur » pour t, « k » pour k) ;
ν hors [0 ; 0,5[ ; maillage (voir plus haut) ; poteau hors du radier ou a, b ≤ 0 (« Poteau n : … », n à partir
de 1) ; voile hors du radier ou de longueur nulle (« Voile n : … ») ; bande de bord : largeur < 0 ou
facteur ≤ 0 ; décollement total (tous les ressorts inactifs) : « le radier se soulève entièrement ».
Alertes : décollement > 0 dans une combinaison ELU (« (a) : 24 % des nœuds décollés ») ; K_s non calculé ici.

### Application (`app/`)
Comme pieux (gabarit de la suite, aedificium-ui) : `form.ts`, `textes.ts` (FR/EN), `vue.ts`,
`dessin.ts`, `note.ts`, `export.ts`, `main.ts`, `style.css`, `index.html`, `en/index.html`, icône.
- `Saisie` (chaînes, nombres à la française acceptés) : `Lx`, `Ly`, `t`, `E` (GPa), `nu`, `poidsPropre`,
  `maillage`, `k`, `Esol` (MPa), `nuSol`, `bord`, `bordLargeur`, `bordFacteur`, `decollement`,
  `poteaux: {x, y, a, b, G, Q}[]`, `voiles: {x1, y1, x2, y2, g, q}[]`, `surfG`, `surfQ`, `qRd`,
  `wAdm` (mm), `betaAdm` (« 1/500 » ou décimal), `generation` ('1re' | '2e'), `consequences`,
  `profilNormatif` ('recommande' | 'anb2022'), `approche1`, `risque`. Défauts : voir test T2 (la maquette).
- `lireSaisie(s)` → `{ ok: true; calcul: { saisie; donnees: DonneesRadier } } | { ok: false; message }` ;
  champs vides de q_Rd, w_adm, β_adm → null ; `bord` décoché → null ; un refus nomme le champ, ou
  « Poteau n » / « Voile n » et le champ. `verifier(calcul)` = `verifierRadier(calcul.donnees)`.
- `serialiser`/`relire` (FORMAT 'radier/1', valeurs absentes → défauts) ; `ajouterPoteau`,
  `retirerPoteau(s, i)`, `ajouterVoile`, `retirerVoile(s, i)` ; `grillePoteaux(s, xs, ys)` : xs, ys listes
  « 1 ; 6 ; 11 », remplace les poteaux par la grille, a, b, G, Q repris du premier poteau.
- `proposerK(s)` → chaîne de k (B.16 avec E′ = Esol en MPa × 1000, B = min(L_x, L_y)), arrondie à l'unité
  et écrite sans séparateur (« 2381 »), ou null si un champ est illisible.
- `dessin.ts` : `carteRadier(calcul, r, o: { vue: 'w' | 'p' | 'infX' | 'infY' | 'supX' | 'supY'; combinaison: string /* nom ou 'ELS' */;
  poteaux: boolean; maillage: boolean; decolle: boolean }): string` : vue en plan à l'échelle, une
  cellule colorée par nœud, `data-role="carte"`, un `data-role="poteau"` par poteau si coché, `data-role="voile"`,
  `data-role="decolle"` (nœuds décollés) si coché, `data-role="echelle"`. Aucun NaN ni Infinity.
- `note.ts` : `noteDuCalcul(calcul, r, cartouche): NoteDeCalcul` (outil 'radier') : cite 5.2.4.2, 5.5.6,
  B.16 et Wood-Armer ; tableaux « Tassements des poteaux » et « Moments de calcul » (pic et lissé) ;
  une figure ; vérifications « Pression du sol · <comb> » (si q_Rd), « Tassement maximal » (si w_adm),
  « Distorsion entre poteaux » (si β_adm).
- Page : maquette (saisie, carte avec boutons de vue et de combinaison, cartes de verdict, volets,
  sorties PDF/HTML/SVG/CSV/JSON), FR et EN.

### Hors périmètre
Contour quelconque, ouvertures, épaisseur variable, sol couplé, radier sur pieux, rigidité de la
superstructure, ferraillage, poinçonnement, effets dynamiques, gonflement, charges horizontales.

## 2. Tâches

| Tâche | Fichiers | Dépend de | Commande | Attendu |
|---|---|---|---|---|
| T1 noyau | `src/radier.ts` | — | `npx vitest run tests/radier.test.ts` | 10/10 |
| T2 saisie | `app/src/form.ts`, `app/src/textes.ts` | T1 | `npx vitest run tests/app/radier-app.test.ts -t "T2"` | vert |
| T3 dessin et note | `app/src/dessin.ts`, `app/src/note.ts`, `app/src/export.ts`, `app/src/version.ts` | T2 | `-t "T3"` | vert |
| T4 page | `app/index.html`, `app/en/index.html`, `app/src/main.ts`, `app/src/vue.ts`, `app/src/style.css`, `app/public/*` | T2, T3 | `npm test`, `npm run typecheck`, `npm run build` | tout vert |

Après T4 : contrôle au banc et publication par Claude.

## 3. Règles pour l'exécutant
- Ne jamais modifier `tests/` (ni la configuration des tests). Un test qui paraît faux : s'arrêter,
  le signaler dans `HANDOFF.md`.
- Pas de matrice pleine dans la résolution. Aucune valeur numérique hors de ce plan et de sol-ec7.
- S'inspirer de `../pieux/app/` (même gabarit) ; ne pas parcourir les autres dépôts.
- Décisions libres : présentation, noms internes, numérotation interne des ddl.
- Consigner chaque tâche dans `HANDOFF.md` (fichiers, décisions, points douteux, tests).
