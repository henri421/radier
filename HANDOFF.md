# HANDOFF — radier sur ressorts (PLAN-radier.md)

Une section par tâche : fichiers modifiés, décisions, points douteux, statut des tests.

## T1 — noyau

**Fichiers modifiés.** `src/radier.ts` (créé).

**Décisions.**
- Port fidèle de `tests/reference/radier.py` : élément ACM 12 ddl (Gauss 3×3), ressorts
  `k·A_trib` avec bande de bord, charges intégrées exactement sur les cellules tributaires,
  voiles découpés en morceaux, décollement itératif (`actif = w > 0`, `iterations = résolutions − 1`),
  moments nodaux moyennés, Wood-Armer, moments de calcul et distorsion.
- Résolution en bande uniquement : stockage de la demi-bande supérieure, élimination de Gauss sans
  pivotement. Largeur `bw = 3·(n_x + 2) + 2` (écart maximal entre ddl d'un élément : nœuds
  `(i,j)` et `(i+1,j+1)`, soit `3·(n_x+1)+2`).
- Numérotation interne `i + j·(n_x+1)`, ddl `3n + c` ; `xs`/`ys` renseignés par nœud.
- Combinaisons via `sol-ec7` (`combinaisons2g`/`combinaisons1g`, profils `profil2g`/`profil1g`/
  `profilAnb2022`), jeu `structure`, `γ_G`/`γ_Q` lus dans `gG_dst`/`gQ_dst`.
- Aucune matrice pleine, aucune constante numérique hors plan/sol-ec7.

**Points douteux.**
1. **Test `aides` (ligne 129) probablement faux.** La formule du plan appliquée à
   `kzzSurAire(40e3, 0.3, 12, 18)` donne `2278.6244658840015` ; l'attendu `1879.865184354301`
   vaut exactement la même formule avec `Es = 33e3` (rapport 33/40 = 0,825, écart mesuré
   `398.7592815297005`). L'attendu semble donc généré avec 33e3 au lieu de 40e3. Test non modifié,
   conformément aux règles ; T1 reste à 9/10 tant que l'attendu n'est pas corrigé.
2. **Typecheck ligne 140 du test.** `proche(a.taux, …)` passe `number | null` (type prévu par le
   plan pour `CombinaisonRadier.taux`) à un paramètre `number` : TS2345. Le test n'est pas modifié ;
   il faudrait `a.taux!` (comme `r.service.tauxW!` ligne 142).

**Statut des tests.**
- `npx vitest run tests/radier.test.ts` : **9 passés, 1 échec** (seul le point 1 ci-dessus).
- `npx tsc --noEmit -p .` : `src/radier.ts` sans erreur ; seule erreur pertinente
  `tests/radier.test.ts(140,12)` (point 2) ; les erreurs de `tests/app` et `app/src` sont attendues
  (T2–T4 non commencées).
- Aucun commit effectué.

## Audit T1 et T2–T4 (séance Claude, 26/11/2026)

**Audit T1.** Tests relancés : 10/10 après correction de deux erreurs du maître dans `tests/radier.test.ts`,
signalées à juste titre par l'exécutant : l'attendu de `kzzSurAire(40e3, 0.3, 12, 18)` vaut 2278,62
(1879,87 correspondait à E = 33 MPa), et `a.taux!` à la ligne 140. Résolution en bande vérifiée, aucune
matrice pleine. Messages d'erreur du noyau remis en phrases complètes pour la traduction.

**T2–T4, écrits par la séance Claude** (consigne « finir vite ») : `app/src/form.ts`, `textes.ts`,
`dessin.ts` (carte en plan, cellule tributaire par nœud, échelle séquentielle pour w et p, divergente
pour les moments), `export.ts`, `vue.ts`, `note.ts`, `main.ts`, `style.css` (repris de maconnerie,
barre des feuilles comprise), `index.html` FR et EN.

**Points douteux.**
- Tassement d'un poteau lu au nœud le plus proche de son centre (pas d'interpolation).
- Les valeurs par défaut gardent la virgule décimale dans la page anglaise (comme les autres outils) ;
  `lireNombre` lit les deux.
- La page anglaise évite « generation », « element » et « resistance », que le contrôle d'affichage
  commun prend pour des mots français sans accent.

**Statut.** `npm test` : 24/24 ; `npm run typecheck` : propre ; `npm run build` : propre.
Banc local FR et EN : aucune erreur de console, valeurs identiques à la référence
(p_max 182,4 kPa, w_max 55,3 mm, β = 1/475 gouvernant).

## Itération « voiles et contour quelconque » (séance Claude, 26/11/2026)

Demande de l'utilisateur : une version à voiles et des cas plus courants que le rectangle sous poteaux.

**Fichiers.** `src/radier.ts` (contour et ouvertures, mailles actives, distorsion le long des voiles),
`app/src/form.ts` (champs `contour` et `ouvertures`, `saisieExempleVoiles`, `grilleVoiles`), `textes.ts`,
`dessin.ts` (seules les mailles du radier, contour et ouvertures tracés), `vue.ts`, `note.ts`, `main.ts`,
`index.html` FR et EN ; tests `tests/radier-contour.test.ts` et `tests/app/radier-contour-app.test.ts`.

**Décisions.**
- Maillage rectangulaire sur la boîte L_x × L_y ; une maille est active si son centre est dans le contour
  et hors des ouvertures. Nœuds hors du radier bloqués (w = 0, sans effet). Contour oblique en escalier,
  alerte si l'aire maillée s'écarte de plus de 2 % de l'aire vraie.
- Bande de bord mesurée depuis le contour et les ouvertures.
- Poteau dont la section déborde du radier, voile qui passe sur une ouverture ou hors du contour : refusés.
- Distorsion : en plus des poteaux voisins alignés, entre points consécutifs de chaque voile (2 m au plus).
  Vérification renommée « Distorsion angulaire » (noyau, textes, test T3 ajusté).

**Points douteux.**
- Sous les voiles, les moments sont nodaux et sensibles au maillage (aucun lissage) ; c'est dit sur la carte.
- L'aide au choix de k prend B = petit côté de la boîte, pas la largeur d'une aile du contour.

**Statut.** `npm test` : 34/34 ; typecheck propre ; banc local FR et EN vérifié sur l'exemple à voiles.
