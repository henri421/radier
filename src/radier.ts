/**
 * Noyau de calcul du radier sur ressorts (PLAN-radier.md, lot F).
 *
 * Port fidele de tests/reference/radier.py : plaque mince de Kirchhoff,
 * element ACM a 12 ddl, ressorts de Winkler sans traction, resolution en bande.
 * Unites : m, kN, kPa.
 */
import { combinaisons1g, combinaisons2g, profil1g, profil2g, profilAnb2022 } from 'sol-ec7';

export interface Poteau { x: number; y: number; a: number; b: number; G: number; Q: number }
export interface Voile { x1: number; y1: number; x2: number; y2: number; g: number; q: number }
export type Norme = { generation: 2; cc: 'CC1' | 'CC2' | 'CC3' }
  | { generation: 1; profil: 'recommande'; approche: 'DA1' | 'DA2' | 'DA3' }
  | { generation: 1; profil: 'anb'; risque: 'faible' | 'normal' | 'eleve' };
export interface DonneesRadier {
  Lx: number; Ly: number; t: number; E: number /* kPa */; nu: number;
  k: number /* kN/m3 */; maillage: number; poidsPropre: boolean; decollement: boolean;
  bord: { largeur: number; facteur: number } | null; poteaux: Poteau[]; voiles: Voile[];
  surface: { g: number; q: number };
  /** Contour du radier (polygone, m), dans [0 ; L_x] × [0 ; L_y] ; absent ou null : le rectangle entier. */
  contour?: [number, number][] | null;
  /** Ouvertures (polygones, m), retirees du radier. */
  ouvertures?: [number, number][][];
  verifications: { qRd: number | null; wAdm: number | null /* m */; betaAdm: number | null }; norme: Norme;
}
export interface Champ {
  nx: number; ny: number; xs: number[] /* abscisse de chaque noeud */; ys: number[];
  w: number[]; p: number[]; mx: number[]; my: number[]; mxy: number[]; actif: boolean[];
  iterations: number; R: number; Ftot: number;
  /** Noeud appartenant au radier (au moins une maille active). */
  dans: boolean[];
  /** Maille active, indice i + j·n_x. */
  cellules: boolean[];
  /** Aire maillee (m²). */
  aire: number;
}
export interface MomentsWA { infX: number; infY: number; supX: number; supY: number }
export interface CombinaisonRadier {
  nom: string; coefficients: { nom: string; valeur: number; source: string }[];
  gG: number; gQ: number; champ: Champ; moments: { calcul: MomentsWA; pic: MomentsWA };
  pmax: number; decolle: number /* fraction de noeuds */; taux: number | null;
}
export interface ResultatRadier {
  generation: 1 | 2; combinaisons: CombinaisonRadier[];
  service: { champ: Champ; wmax: number; wmin: number; pmax: number; beta: number;
    entre: [[number, number], [number, number]] | null; tauxW: number | null; tauxBeta: number | null };
  moments: MomentsWA & { combinaison: string }; gouvernant: { verification: string; taux: number };
  alertes: string[];
}

const GAMMA_BETON = 25.0;

// ---------------------------------------------------------------------------
// Petites matrices (12 x 12 au plus)
// ---------------------------------------------------------------------------

function zeros(n: number, m: number): number[][] {
  return Array.from({ length: n }, () => new Array<number>(m).fill(0));
}

function matMul(A: number[][], B: number[][]): number[][] {
  const n = A.length, k = B.length, m = B[0].length;
  const C = zeros(n, m);
  for (let i = 0; i < n; i++) {
    for (let l = 0; l < k; l++) {
      const a = A[i][l];
      if (a === 0) continue;
      for (let j = 0; j < m; j++) C[i][j] += a * B[l][j];
    }
  }
  return C;
}

/** transpose(A) * B */
function matTMul(A: number[][], B: number[][]): number[][] {
  const k = A.length, n = A[0].length, m = B[0].length;
  const C = zeros(n, m);
  for (let l = 0; l < k; l++) {
    for (let i = 0; i < n; i++) {
      const a = A[l][i];
      if (a === 0) continue;
      for (let j = 0; j < m; j++) C[i][j] += a * B[l][j];
    }
  }
  return C;
}

function matVec(A: number[][], x: number[]): number[] {
  const n = A.length, m = A[0].length;
  const y = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < m; j++) s += A[i][j] * x[j];
    y[i] = s;
  }
  return y;
}

/** Inverse par Gauss-Jordan avec pivot partiel (comme np.linalg.inv). */
function inverse(M: number[][]): number[][] {
  const n = M.length;
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    }
    if (Math.abs(A[piv][col]) < 1e-300) throw new Error('Élément dégénéré : matrice singulière.');
    if (piv !== col) { const tmp = A[col]; A[col] = A[piv]; A[piv] = tmp; }
    const d = A[col][col];
    for (let c = 0; c < 2 * n; c++) A[col][c] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      if (f === 0) continue;
      for (let c = 0; c < 2 * n; c++) A[r][c] -= f * A[col][c];
    }
  }
  return A.map((row) => row.slice(n));
}

// ---------------------------------------------------------------------------
// Element ACM
// ---------------------------------------------------------------------------

function pRow(x: number, y: number): number[] {
  return [1, x, y, x * x, x * y, y * y, x ** 3, x * x * y, x * y * y, y ** 3, x ** 3 * y, x * y ** 3];
}
function pxRow(x: number, y: number): number[] {
  return [0, 1, 0, 2 * x, y, 0, 3 * x * x, 2 * x * y, y * y, 0, 3 * x * x * y, y ** 3];
}
function pyRow(x: number, y: number): number[] {
  return [0, 0, 1, 0, x, 2 * y, 0, x * x, 2 * x * y, 3 * y * y, x ** 3, 3 * x * y * y];
}

interface ElementAcmi {
  Ke: number[][];
  Bc: (x: number, y: number) => number[][];
  Dm: number[][];
}

function elementAcm(a: number, b: number, D: number, nu: number): ElementAcmi {
  const C: number[][] = [];
  for (const [x, y] of [[0, 0], [a, 0], [a, b], [0, b]] as [number, number][]) {
    C.push(pRow(x, y), pyRow(x, y), pxRow(x, y).map((v) => -v));
  }
  const Ci = inverse(C);

  const raw = (x: number, y: number): number[][] => {
    const wxx = [0, 0, 0, 2, 0, 0, 6 * x, 2 * y, 0, 0, 6 * x * y, 0];
    const wyy = [0, 0, 0, 0, 0, 2, 0, 0, 2 * x, 6 * y, 0, 6 * x * y];
    const wxy = [0, 0, 0, 0, 1, 0, 0, 2 * x, 2 * y, 0, 3 * x * x, 3 * y * y];
    return [wxx.map((v) => -v), wyy.map((v) => -v), wxy.map((v) => -2 * v)];
  };
  const Bc = (x: number, y: number): number[][] => matMul(raw(x, y), Ci);

  const Dm = [
    [D, D * nu, 0],
    [D * nu, D, 0],
    [0, 0, D * (1 - nu) / 2],
  ];

  // Gauss-Legendre 3 points.
  const g = [-Math.sqrt(3 / 5), 0, Math.sqrt(3 / 5)];
  const wg = [5 / 9, 8 / 9, 5 / 9];
  const Ke = zeros(12, 12);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const x = a * (g[i] + 1) / 2;
      const y = b * (g[j] + 1) / 2;
      const Bi = Bc(x, y);
      const Kij = matMul(matTMul(Bi, Dm), Bi);
      const w = wg[i] * wg[j] * a * b / 4;
      for (let r = 0; r < 12; r++) {
        for (let c = 0; c < 12; c++) Ke[r][c] += Kij[r][c] * w;
      }
    }
  }
  return { Ke, Bc, Dm };
}

// ---------------------------------------------------------------------------
// Resolution en bande (aucune matrice pleine)
// ---------------------------------------------------------------------------

function resoudreBande(A: Float64Array, b: Float64Array, n: number, bw: number): Float64Array {
  const stride = bw + 1;
  for (let k = 0; k < n; k++) {
    const piv = A[k * stride];
    if (!(piv > 0)) throw new Error('Système instable : le radier n’est pas soutenu.');
    const m = Math.min(n - 1, k + bw);
    for (let i = k + 1; i <= m; i++) {
      // A[i][k] = A[k][i] (matrice symetrique) : stocke dans la bande haute.
      const f = A[k * stride + (i - k)] / piv;
      if (f === 0) continue;
      const jmax = Math.min(m, i + bw);
      for (let j = i; j <= jmax; j++) {
        A[i * stride + (j - i)] -= f * A[k * stride + (j - k)];
      }
      b[i] -= f * b[k];
    }
  }
  const u = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    const m = Math.min(n - 1, i + bw);
    let s = b[i];
    for (let j = i + 1; j <= m; j++) s -= A[i * stride + (j - i)] * u[j];
    u[i] = s / A[i * stride];
  }
  return u;
}

// ---------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------

export function kSubgrade(Es: number, nu: number, B: number): number {
  return 0.65 * Es / (B * (1 - nu * nu));
}

export function kzzSurAire(Es: number, nu: number, B: number, L: number): number {
  const b = Math.min(B, L);
  const l = Math.max(B, L);
  const G = Es / (2 * (1 + nu));
  return G * b / (1 - nu) * (0.73 + 1.54 * (b / l) ** 0.75) / (b * l);
}

export function rigiditeRelative(Ef: number, nuf: number, Eg: number, nug: number, B: number, L: number, t: number): number {
  return 5.57 * (Ef / Eg) * ((1 - nug * nug) / (1 - nuf * nuf)) * Math.sqrt(B / L) * (t / L) ** 3;
}

// ---------------------------------------------------------------------------
// Geometrie du contour
// ---------------------------------------------------------------------------

type Poly = [number, number][];

function contourDe(d: DonneesRadier): Poly {
  return d.contour && d.contour.length > 0 ? d.contour : [[0, 0], [d.Lx, 0], [d.Lx, d.Ly], [0, d.Ly]];
}

/** Point dans un polygone (pair-impair). */
export function dansPolygone(x: number, y: number, poly: Poly): boolean {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

function distanceSegment(x: number, y: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l2)) : 0;
  return Math.hypot(x - x1 - t * dx, y - y1 - t * dy);
}

/** Distance d'un point au bord d'un polygone. */
function distanceBord(x: number, y: number, poly: Poly): number {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    m = Math.min(m, distanceSegment(x, y, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
  }
  return m;
}

/** Aire d'un polygone (formule du lacet), en valeur absolue. */
export function airePolygone(poly: Poly): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return Math.abs(s) / 2;
}

/** Point sur le radier : dans le contour (bord compris) et pas strictement dans une ouverture. */
function surLeRadier(x: number, y: number, d: DonneesRadier): boolean {
  const c = contourDe(d);
  if (!dansPolygone(x, y, c) && distanceBord(x, y, c) > 1e-6) return false;
  for (const o of d.ouvertures ?? []) if (dansPolygone(x, y, o) && distanceBord(x, y, o) > 1e-6) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function valider(d: DonneesRadier): void {
  if (!(d.Lx > 0)) throw new Error('La longueur L_x doit être strictement positive.');
  if (!(d.Ly > 0)) throw new Error('La largeur L_y doit être strictement positive.');
  if (!(d.t > 0)) throw new Error("L'épaisseur t doit être strictement positive.");
  if (!(d.E > 0)) throw new Error('Le module E doit être strictement positif.');
  if (!(d.k > 0)) throw new Error('Le coefficient de raideur k doit être strictement positif.');
  if (!(d.nu >= 0 && d.nu < 0.5)) throw new Error('Le coefficient de Poisson ν doit être dans [0 ; 0,5[.');
  if (!(d.maillage > 0)) throw new Error('Le maillage h doit être strictement positif.');

  const nx = Math.max(1, Math.ceil(d.Lx / d.maillage - 1e-9));
  const ny = Math.max(1, Math.ceil(d.Ly / d.maillage - 1e-9));
  if ((nx + 1) * (ny + 1) > 20000) throw new Error('Maillage trop fin : plus de 20 000 nœuds.');
  if (d.maillage > Math.min(d.Lx, d.Ly)) throw new Error('Le maillage est plus grand que le radier.');

  const polys: Poly[] = [...(d.contour && d.contour.length > 0 ? [d.contour] : []), ...(d.ouvertures ?? [])];
  for (const poly of polys) {
    if (poly.length < 3 || !(airePolygone(poly) > 0)) throw new Error('Contour ou ouverture : au moins trois points non alignés.');
    for (const [x, y] of poly) {
      if (!(x >= -1e-9 && x <= d.Lx + 1e-9 && y >= -1e-9 && y <= d.Ly + 1e-9)) {
        throw new Error('Contour ou ouverture : un point sort du rectangle L_x × L_y.');
      }
    }
  }

  d.poteaux.forEach((p, idx) => {
    if (!(p.a > 0) || !(p.b > 0)) {
      throw new Error(`Poteau ${idx + 1} : les dimensions a et b doivent être strictement positives.`);
    }
    if (p.x < 0 || p.x > d.Lx || p.y < 0 || p.y > d.Ly || !surLeRadier(p.x, p.y, d)) {
      throw new Error(`Poteau ${idx + 1} : hors du radier.`);
    }
  });
  d.voiles.forEach((v, idx) => {
    const dedans = (x: number, y: number) => x >= 0 && x <= d.Lx && y >= 0 && y <= d.Ly;
    if (!dedans(v.x1, v.y1) || !dedans(v.x2, v.y2)) {
      throw new Error(`Voile ${idx + 1} : hors du radier.`);
    }
    const L = Math.hypot(v.x2 - v.x1, v.y2 - v.y1);
    if (L === 0) {
      throw new Error(`Voile ${idx + 1} : longueur nulle.`);
    }
    const m = Math.max(2, Math.ceil(L / (d.maillage / 4)));
    for (let s = 0; s <= m; s++) {
      if (!surLeRadier(v.x1 + ((v.x2 - v.x1) * s) / m, v.y1 + ((v.y2 - v.y1) * s) / m, d)) {
        throw new Error(`Voile ${idx + 1} : hors du radier.`);
      }
    }
  });
  if (d.bord !== null) {
    if (d.bord.largeur < 0 || !(d.bord.facteur > 0)) {
      throw new Error('Bande de bord : la largeur doit être positive ou nulle et le facteur strictement positif.');
    }
  }
}

// ---------------------------------------------------------------------------
// Analyse
// ---------------------------------------------------------------------------

export function analyseRadier(d: DonneesRadier, gG: number, gQ: number): Champ {
  valider(d);
  const { Lx, Ly, t, E, nu } = d;
  const nx = Math.max(1, Math.ceil(Lx / d.maillage - 1e-9));
  const ny = Math.max(1, Math.ceil(Ly / d.maillage - 1e-9));
  const a = Lx / nx;
  const b = Ly / ny;
  const nnx = nx + 1;
  const N = nnx * (ny + 1);
  const node = (i: number, j: number) => j * nnx + i;

  const D = E * t ** 3 / (12 * (1 - nu * nu));
  const { Ke, Bc, Dm } = elementAcm(a, b, D, nu);

  const nDof = 3 * N;
  const bw = 3 * (nnx + 1) + 2;
  const stride = bw + 1;
  const base = new Float64Array(nDof * stride);

  // Mailles actives : centre dans le contour et hors des ouvertures.
  const contour = contourDe(d);
  const ouvertures = d.ouvertures ?? [];
  const cellules = new Array<boolean>(nx * ny).fill(false);
  const dans = new Array<boolean>(N).fill(false);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const xc = (i + 0.5) * a;
      const yc = (j + 0.5) * b;
      const ok = dansPolygone(xc, yc, contour) && !ouvertures.some((o) => dansPolygone(xc, yc, o));
      cellules[j * nx + i] = ok;
      if (ok) for (const n of [node(i, j), node(i + 1, j), node(i + 1, j + 1), node(i, j + 1)]) dans[n] = true;
    }
  }
  if (!cellules.some((c) => c)) throw new Error('Le contour ne couvre aucune maille.');
  // Noeuds hors du radier : degres de liberte bloques (w = 0, sans effet sur le reste).
  for (let n = 0; n < N; n++) if (!dans[n]) for (let c = 0; c < 3; c++) base[(3 * n + c) * stride] = 1;

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!cellules[j * nx + i]) continue;
      const ns = [node(i, j), node(i + 1, j), node(i + 1, j + 1), node(i, j + 1)];
      const dofs: number[] = [];
      for (const n of ns) for (let c = 0; c < 3; c++) dofs.push(3 * n + c);
      for (let r = 0; r < 12; r++) {
        for (let c = 0; c < 12; c++) {
          const dr = dofs[r];
          const dc = dofs[c];
          if (dr <= dc) base[dr * stride + (dc - dr)] += Ke[r][c];
        }
      }
    }
  }

  const xs: number[] = [];
  const ys: number[] = [];
  const trib = new Float64Array(N);
  const kn = new Float64Array(N);
  const F = new Float64Array(nDof);

  const gS = d.surface.g;
  const qS = d.surface.q;
  const pSurf = gG * (gS + (d.poidsPropre ? GAMMA_BETON * t : 0)) + gQ * qS;

  // Bords pour la bande de bord : contour et ouvertures.
  const bords: Poly[] = [contour, ...ouvertures];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const n = node(i, j);
      xs[n] = i * a;
      ys[n] = j * b;
    }
  }
  const chargePoteau = new Float64Array(d.poteaux.length);
  // Chaque maille active donne un quart a chacun de ses coins : aire, ressort, charges.
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!cellules[j * nx + i]) continue;
      for (const [di, dj] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
        const n = node(i + di, j + dj);
        const x0 = (i + di * 0.5) * a, x1 = x0 + a / 2;
        const y0 = (j + dj * 0.5) * b, y1 = y0 + b / 2;
        trib[n] += (a * b) / 4;
        let f = (pSurf * a * b) / 4;
        d.poteaux.forEach((p, k) => {
          const ox = recouvrement(x0, x1, p.x - p.a / 2, p.x + p.a / 2);
          const oy = recouvrement(y0, y1, p.y - p.b / 2, p.y + p.b / 2);
          f += (gG * p.G + gQ * p.Q) / (p.a * p.b) * ox * oy;
          chargePoteau[k] += ox * oy;
        });
        F[3 * n] += f;
      }
    }
  }
  d.poteaux.forEach((p, k) => {
    if (chargePoteau[k] < p.a * p.b * (1 - 1e-6)) throw new Error(`Poteau ${k + 1} : section en partie hors du radier.`);
  });
  for (let n = 0; n < N; n++) {
    if (!dans[n]) continue;
    let kk = d.k;
    if (d.bord !== null) {
      let dist = Infinity;
      for (const poly of bords) dist = Math.min(dist, distanceBord(xs[n], ys[n], poly));
      if (dist < d.bord.largeur - 1e-9) kk *= d.bord.facteur;
    }
    kn[n] = kk * trib[n];
  }

  /** Noeud du radier le plus proche d'un point (le noeud de grille le plus proche s'il est sur le radier). */
  const plusProcheDans = (x: number, y: number): number => {
    const i0 = Math.min(nx, Math.max(0, Math.floor(x / a + 0.5)));
    const j0 = Math.min(ny, Math.max(0, Math.floor(y / b + 0.5)));
    if (dans[node(i0, j0)]) return node(i0, j0);
    let best = -1;
    let dmin = Infinity;
    for (let n = 0; n < N; n++) {
      if (!dans[n]) continue;
      const dd = (xs[n] - x) ** 2 + (ys[n] - y) ** 2;
      if (dd < dmin) { dmin = dd; best = n; }
    }
    return best;
  };

  for (const v of d.voiles) {
    const L = Math.hypot(v.x2 - v.x1, v.y2 - v.y1);
    const m = Math.max(1, Math.ceil(L / (Math.min(a, b) / 4)));
    for (let s = 0; s < m; s++) {
      const xm = v.x1 + (v.x2 - v.x1) * (s + 0.5) / m;
      const ym = v.y1 + (v.y2 - v.y1) * (s + 0.5) / m;
      F[3 * plusProcheDans(xm, ym)] += (gG * v.g + gQ * v.q) * L / m;
    }
  }

  const actif = [...dans];
  let u: Float64Array = new Float64Array(nDof);
  let w = new Float64Array(N);
  let iterations = 0;

  for (let it = 0; it < 100; it++) {
    const A = base.slice();
    for (let n = 0; n < N; n++) {
      if (actif[n]) A[3 * n * stride] += kn[n];
    }
    u = resoudreBande(A, F.slice(), nDof, bw);
    for (let n = 0; n < N; n++) w[n] = u[3 * n];
    const nouv = d.decollement ? Array.from(w, (v, n) => dans[n] && v > 0) : [...dans];
    let change = false;
    for (let n = 0; n < N; n++) if (nouv[n] !== actif[n]) { change = true; break; }
    if (!change) { iterations = it; break; }
    for (let n = 0; n < N; n++) actif[n] = nouv[n];
    if (it === 99) throw new Error('Le décollement ne se stabilise pas en 100 itérations.');
  }

  if (!actif.some((v) => v)) throw new Error('Le radier se soulève entièrement.');

  const p = new Float64Array(N);
  let R = 0;
  let Ftot = 0;
  for (let n = 0; n < N; n++) {
    if (actif[n]) {
      p[n] = kn[n] * w[n] / trib[n];
      R += kn[n] * w[n];
    }
  }
  for (let n = 0; n < N; n++) Ftot += F[3 * n];

  // Moments aux noeuds : moyenne des elements voisins.
  const M = new Float64Array(N * 3);
  const cnt = new Float64Array(N);
  const coins: [number, number][] = [[0, 0], [a, 0], [a, b], [0, b]];
  const BcCoins = coins.map(([x, y]) => Bc(x, y));
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!cellules[j * nx + i]) continue;
      const ns = [node(i, j), node(i + 1, j), node(i + 1, j + 1), node(i, j + 1)];
      const ue: number[] = [];
      for (const n of ns) ue.push(u[3 * n], u[3 * n + 1], u[3 * n + 2]);
      for (let c = 0; c < 4; c++) {
        const m = matVec(Dm, matVec(BcCoins[c], ue));
        const n = ns[c];
        M[3 * n] += m[0];
        M[3 * n + 1] += m[1];
        M[3 * n + 2] += m[2];
        cnt[n] += 1;
      }
    }
  }

  const wOut: number[] = [];
  const pOut: number[] = [];
  const mx: number[] = [];
  const my: number[] = [];
  const mxy: number[] = [];
  for (let n = 0; n < N; n++) {
    wOut.push(w[n]);
    pOut.push(p[n]);
    const c = cnt[n] > 0 ? cnt[n] : 1;
    mx.push(M[3 * n] / c);
    my.push(M[3 * n + 1] / c);
    mxy.push(M[3 * n + 2] / c);
  }

  return {
    nx, ny, xs, ys, w: wOut, p: pOut, mx, my, mxy, actif: [...actif],
    iterations, R, Ftot, dans, cellules, aire: cellules.filter((c) => c).length * a * b,
  };
}

function recouvrement(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

// ---------------------------------------------------------------------------
// Wood-Armer
// ---------------------------------------------------------------------------

export function woodArmer(mx: number, my: number, mxy: number): MomentsWA {
  const a = Math.abs(mxy);
  const eps = 1e-12;
  let ix = mx + a;
  let iy = my + a;
  const c1 = ix < 0;
  if (c1) {
    ix = 0;
    iy = my + mxy * mxy / Math.max(Math.abs(mx), eps);
  }
  const c2 = iy < 0 && !c1;
  if (c2) {
    iy = 0;
    ix = mx + mxy * mxy / Math.max(Math.abs(my), eps);
  }
  let sx = mx - a;
  let sy = my - a;
  const c3 = sx > 0;
  if (c3) {
    sx = 0;
    sy = my - mxy * mxy / Math.max(Math.abs(mx), eps);
  }
  const c4 = sy > 0 && !c3;
  if (c4) {
    sy = 0;
    sx = mx - mxy * mxy / Math.max(Math.abs(my), eps);
  }
  return {
    infX: Math.max(ix, 0),
    infY: Math.max(iy, 0),
    supX: Math.min(sx, 0),
    supY: Math.min(sy, 0),
  };
}

export function momentsDeCalcul(d: DonneesRadier, c: Champ): { calcul: MomentsWA; pic: MomentsWA } {
  const N = (c.nx + 1) * (c.ny + 1);
  const wa: MomentsWA[] = new Array(N);
  for (let n = 0; n < N; n++) wa[n] = woodArmer(c.mx[n], c.my[n], c.mxy[n]);

  const dans = new Uint8Array(N);
  const carres: number[][] = [];
  for (const p of d.poteaux) {
    const s: number[] = [];
    for (let n = 0; n < N; n++) {
      if (c.dans[n] && Math.abs(c.xs[n] - p.x) <= p.a / 2 + d.t + 1e-9
        && Math.abs(c.ys[n] - p.y) <= p.b / 2 + d.t + 1e-9) {
        s.push(n);
      }
    }
    for (const n of s) dans[n] = 1;
    if (s.length > 0) carres.push(s);
  }

  const extremes = (cle: keyof MomentsWA, f: (a: number, b: number) => number): number => {
    const vals: number[] = [];
    for (let n = 0; n < N; n++) if (!dans[n] && c.dans[n]) vals.push(wa[n][cle]);
    for (const s of carres) {
      let somme = 0;
      for (const n of s) somme += wa[n][cle];
      vals.push(somme / s.length);
    }
    if (vals.length === 0) return 0;
    let r = vals[0];
    for (let i = 1; i < vals.length; i++) r = f(r, vals[i]);
    return r;
  };

  const calcul: MomentsWA = {
    infX: extremes('infX', Math.max),
    infY: extremes('infY', Math.max),
    supX: extremes('supX', Math.min),
    supY: extremes('supY', Math.min),
  };
  const waR = wa.filter((_, n) => c.dans[n]);
  const pic: MomentsWA = {
    infX: Math.max(...waR.map((m) => m.infX)),
    infY: Math.max(...waR.map((m) => m.infY)),
    supX: Math.min(...waR.map((m) => m.supX)),
    supY: Math.min(...waR.map((m) => m.supY)),
  };
  return { calcul, pic };
}

// ---------------------------------------------------------------------------
// Distorsion angulaire (poteaux voisins alignés, points des voiles)
// ---------------------------------------------------------------------------

export function distorsion(d: DonneesRadier, c: Champ): { beta: number; entre: [[number, number], [number, number]] | null } {
  const a = d.Lx / c.nx;
  const b = d.Ly / c.ny;
  const W = c.w;
  /** w bilineaire dans une maille active contenant le point (les mailles voisines si besoin). */
  const wEn = (x: number, y: number): number => {
    const fi = x / a;
    const fj = y / b;
    const is = [Math.floor(fi), Math.floor(fi) - 1].map((i) => Math.min(c.nx - 1, Math.max(0, i)));
    const js = [Math.floor(fj), Math.floor(fj) - 1].map((j) => Math.min(c.ny - 1, Math.max(0, j)));
    let i = is[0];
    let j = js[0];
    trouve: for (const ii of is) {
      for (const jj of js) {
        if (c.cellules[jj * c.nx + ii] && fi >= ii - 1e-9 && fi <= ii + 1 + 1e-9 && fj >= jj - 1e-9 && fj <= jj + 1 + 1e-9) {
          i = ii; j = jj; break trouve;
        }
      }
    }
    const s = Math.min(1, Math.max(0, fi - i));
    const t = Math.min(1, Math.max(0, fj - j));
    return (1 - s) * (1 - t) * W[j * (c.nx + 1) + i]
      + s * (1 - t) * W[j * (c.nx + 1) + i + 1]
      + s * t * W[(j + 1) * (c.nx + 1) + i + 1]
      + (1 - s) * t * W[(j + 1) * (c.nx + 1) + i];
  };

  const P = d.poteaux.map((p) => [p.x, p.y] as [number, number]);
  let bestBeta = 0;
  let best: [[number, number], [number, number]] | null = null;

  for (const [x, y] of P) {
    const droite = P.filter((q) => Math.abs(q[1] - y) < 1e-6 && q[0] > x + 1e-9);
    const haut = P.filter((q) => Math.abs(q[0] - x) < 1e-6 && q[1] > y + 1e-9);
    for (const cand of [droite, haut]) {
      if (cand.length === 0) continue;
      let q = cand[0];
      let dmin = Math.hypot(q[0] - x, q[1] - y);
      for (let i = 1; i < cand.length; i++) {
        const di = Math.hypot(cand[i][0] - x, cand[i][1] - y);
        if (di < dmin) { dmin = di; q = cand[i]; }
      }
      const beta = Math.abs(wEn(x, y) - wEn(q[0], q[1])) / Math.hypot(q[0] - x, q[1] - y);
      if (beta > bestBeta * (1 + 1e-9) + 1e-15) {
        bestBeta = beta;
        best = [[x, y], [q[0], q[1]]];
      }
    }
  }
  // Le long de chaque voile : points espaces d'au plus 2 m, distorsion entre points consecutifs.
  for (const v of d.voiles) {
    const L = Math.hypot(v.x2 - v.x1, v.y2 - v.y1);
    const m = Math.max(1, Math.ceil(L / 2 - 1e-9));
    for (let k = 0; k < m; k++) {
      const p1: [number, number] = [v.x1 + ((v.x2 - v.x1) * k) / m, v.y1 + ((v.y2 - v.y1) * k) / m];
      const p2: [number, number] = [v.x1 + ((v.x2 - v.x1) * (k + 1)) / m, v.y1 + ((v.y2 - v.y1) * (k + 1)) / m];
      const beta = Math.abs(wEn(p1[0], p1[1]) - wEn(p2[0], p2[1])) / (L / m);
      if (beta > bestBeta * (1 + 1e-9) + 1e-15) {
        bestBeta = beta;
        best = [p1, p2];
      }
    }
  }
  return { beta: bestBeta, entre: best };
}

// ---------------------------------------------------------------------------
// Verification d'ensemble
// ---------------------------------------------------------------------------

interface CombinaisonSol {
  nom: string;
  structure: {
    gG_dst: { valeur: number; source: string };
    gQ_dst: { valeur: number; source: string };
  };
}

function combinaisonsDe(d: DonneesRadier): { generation: 1 | 2; list: CombinaisonSol[] } {
  if (d.norme.generation === 2) {
    return {
      generation: 2,
      list: combinaisons2g('a+b', d.norme.cc, profil2g()) as unknown as CombinaisonSol[],
    };
  }
  if (d.norme.profil === 'recommande') {
    return {
      generation: 1,
      list: combinaisons1g(d.norme.approche, profil1g()) as unknown as CombinaisonSol[],
    };
  }
  return {
    generation: 1,
    list: combinaisons1g('DA1', profilAnb2022(d.norme.risque)) as unknown as CombinaisonSol[],
  };
}

function maxDe(v: number[]): number {
  let m = v[0];
  for (let i = 1; i < v.length; i++) if (v[i] > m) m = v[i];
  return m;
}
function minDe(v: number[]): number {
  let m = v[0];
  for (let i = 1; i < v.length; i++) if (v[i] < m) m = v[i];
  return m;
}

export function verifierRadier(d: DonneesRadier): ResultatRadier {
  const { generation, list } = combinaisonsDe(d);
  const alertes: string[] = [];

  const combinaisons: CombinaisonRadier[] = list.map((c) => {
    const gG = c.structure.gG_dst.valeur;
    const gQ = c.structure.gQ_dst.valeur;
    const champ = analyseRadier(d, gG, gQ);
    const moments = momentsDeCalcul(d, champ);
    const pmax = maxDe(champ.p);
    const nDans = champ.dans.filter((v) => v).length;
    const decolle = champ.actif.filter((v, n) => champ.dans[n] && !v).length / nDans;
    const taux = d.verifications.qRd !== null ? pmax / d.verifications.qRd : null;
    if (decolle > 0) {
      alertes.push(`${c.nom} : ${Math.round(decolle * 100)} % des nœuds décollés`);
    }
    return {
      nom: c.nom,
      coefficients: [
        { nom: 'γ_G', valeur: gG, source: c.structure.gG_dst.source },
        { nom: 'γ_Q', valeur: gQ, source: c.structure.gQ_dst.source },
      ],
      gG, gQ, champ, moments, pmax, decolle, taux,
    };
  });

  const champService = analyseRadier(d, 1, 1);
  if ((d.contour && d.contour.length > 0) || (d.ouvertures ?? []).length > 0) {
    const vise = airePolygone(contourDe(d)) - (d.ouvertures ?? []).reduce((s, o) => s + airePolygone(o), 0);
    if (vise > 0 && Math.abs(champService.aire / vise - 1) > 0.02) {
      alertes.push(`Contour approché par le maillage : ${champService.aire.toFixed(1).replace(".", ",")} m² maillés pour ${vise.toFixed(1).replace(".", ",")} m²`);
    }
  }
  const { beta, entre } = distorsion(d, champService);
  const wmax = maxDe(champService.w);
  const wmin = minDe(champService.w.filter((_, n) => champService.dans[n]));
  const pmaxService = maxDe(champService.p);
  const tauxW = d.verifications.wAdm !== null ? wmax / d.verifications.wAdm : null;
  const tauxBeta = d.verifications.betaAdm !== null ? beta / d.verifications.betaAdm : null;

  let gouvernant = { verification: '', taux: 0 };
  let trouve = false;
  for (const c of combinaisons) {
    if (c.taux === null) continue;
    if (!trouve || c.taux > gouvernant.taux) {
      gouvernant = { verification: `Pression du sol · ${c.nom}`, taux: c.taux };
      trouve = true;
    }
  }
  if (tauxW !== null && (!trouve || tauxW > gouvernant.taux)) {
    gouvernant = { verification: 'Tassement maximal', taux: tauxW };
    trouve = true;
  }
  if (tauxBeta !== null && (!trouve || tauxBeta > gouvernant.taux)) {
    gouvernant = { verification: 'Distorsion angulaire', taux: tauxBeta };
    trouve = true;
  }

  let infX = -Infinity, infY = -Infinity, supX = Infinity, supY = Infinity;
  let combinaison = '';
  for (const c of combinaisons) {
    const m = c.moments.calcul;
    if (m.infX > infX) { infX = m.infX; combinaison = c.nom; }
    if (m.infY > infY) infY = m.infY;
    if (m.supX < supX) supX = m.supX;
    if (m.supY < supY) supY = m.supY;
  }
  const moments: MomentsWA & { combinaison: string } = {
    infX, infY, supX, supY,
    combinaison: combinaisons.length > 0 ? combinaison : '',
  };

  return {
    generation,
    combinaisons,
    service: {
      champ: champService,
      wmax, wmin, pmax: pmaxService, beta, entre, tauxW, tauxBeta,
    },
    moments,
    gouvernant,
    alertes,
  };
}
