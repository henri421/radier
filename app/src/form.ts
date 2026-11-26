/**
 * La saisie, en chaines, et sa conversion en donnees du noyau. PUR. Aucun calcul ici : le noyau fait foi.
 */

import { lireNombre } from 'aedificium-ui';
import type { Approche, ClasseConsequences, Risque } from 'sol-ec7';
import { kSubgrade, verifierRadier, type DonneesRadier, type ResultatRadier } from '../../src/radier';
import { textes } from './textes';

export interface SaisiePoteau { x: string; y: string; a: string; b: string; G: string; Q: string }
export interface SaisieVoile { x1: string; y1: string; x2: string; y2: string; g: string; q: string }

export interface Saisie {
  Lx: string;
  Ly: string;
  t: string;
  /** Module du beton (GPa). */
  E: string;
  nu: string;
  poidsPropre: boolean;
  maillage: string;
  /** Module de reaction (kN/m3). */
  k: string;
  /** Aide au choix de k : module du sol (MPa) et coefficient de Poisson. */
  Esol: string;
  nuSol: string;
  bord: boolean;
  bordLargeur: string;
  bordFacteur: string;
  decollement: boolean;
  poteaux: SaisiePoteau[];
  voiles: SaisieVoile[];
  surfG: string;
  surfQ: string;
  qRd: string;
  /** Tassement admissible (mm). */
  wAdm: string;
  /** Distorsion admissible : « 1/500 » ou un decimal. */
  betaAdm: string;
  generation: '1re' | '2e';
  consequences: string;
  profilNormatif: string;
  approche1: string;
  risque: string;
}

export interface Calcul {
  saisie: Saisie;
  donnees: DonneesRadier;
}
export type Resultat = ResultatRadier;
export type Lecture = { ok: true; calcul: Calcul } | { ok: false; message: string };

const FORMAT = 'radier/1';

/** Le cas de la maquette, nombres ecrits a la francaise. */
export function saisieParDefaut(): Saisie {
  const poteaux: SaisiePoteau[] = [];
  for (const x of ['1', '6', '11']) {
    for (const y of ['1', '6,5', '11,5', '17']) {
      poteaux.push({ x, y, a: '0,4', b: '0,4', G: x === '6' ? '1600' : '900', Q: x === '6' ? '600' : '300' });
    }
  }
  return {
    Lx: '12',
    Ly: '18',
    t: '0,6',
    E: '33',
    nu: '0,2',
    poidsPropre: true,
    maillage: '0,5',
    k: '2381',
    Esol: '40',
    nuSol: '0,3',
    bord: false,
    bordLargeur: '1,5',
    bordFacteur: '2',
    decollement: true,
    poteaux,
    voiles: [],
    surfG: '3',
    surfQ: '2,5',
    qRd: '250',
    wAdm: '75',
    betaAdm: '1/500',
    generation: '2e',
    consequences: 'CC2',
    profilNormatif: 'recommande',
    approche1: 'DA1',
    risque: 'normal',
  };
}

class Refus extends Error {}

function nb(brut: string, champ: string): number {
  const v = lireNombre(brut);
  if (v === null) throw new Refus(textes().refus.nombre(champ, brut));
  return v;
}

function nbElement(brut: string, element: string, champ: string): number {
  const v = lireNombre(brut);
  if (v === null) throw new Refus(textes().refus.element(element, champ, brut));
  return v;
}

/** Champ facultatif : vide -> null. */
function facultatif(brut: string, champ: string): number | null {
  return brut.trim() === '' ? null : nb(brut, champ);
}

/** « 1/500 » ou un decimal ; vide -> null. */
function fraction(brut: string, champ: string): number | null {
  const t = brut.trim();
  if (t === '') return null;
  const m = /^(.+)\/(.+)$/.exec(t);
  if (m === null) return nb(t, champ);
  const num = lireNombre(m[1]);
  const den = lireNombre(m[2]);
  if (num === null || den === null || den === 0) throw new Refus(textes().refus.nombre(champ, brut));
  return num / den;
}

function choix<T extends string>(valeur: string, autorisees: readonly T[], defaut: T): T {
  return (autorisees as readonly string[]).includes(valeur) ? (valeur as T) : defaut;
}

const CONSEQUENCES: readonly ClasseConsequences[] = ['CC1', 'CC2', 'CC3'];
const APPROCHES: readonly Approche[] = ['DA1', 'DA2', 'DA3'];
const RISQUES: readonly Risque[] = ['faible', 'normal', 'eleve'];

export function lireSaisie(s: Saisie): Lecture {
  try {
    const c = textes().refus.champs;
    const e = textes().refus;
    const poteaux = s.poteaux.map((p, i) => {
      const n = e.poteau(i + 1);
      return {
        x: nbElement(p.x, n, 'x'), y: nbElement(p.y, n, 'y'), a: nbElement(p.a, n, 'a'), b: nbElement(p.b, n, 'b'),
        G: nbElement(p.G, n, 'G'), Q: nbElement(p.Q, n, 'Q'),
      };
    });
    const voiles = s.voiles.map((v, i) => {
      const n = e.voile(i + 1);
      return {
        x1: nbElement(v.x1, n, 'x₁'), y1: nbElement(v.y1, n, 'y₁'), x2: nbElement(v.x2, n, 'x₂'), y2: nbElement(v.y2, n, 'y₂'),
        g: nbElement(v.g, n, 'g'), q: nbElement(v.q, n, 'q'),
      };
    });
    const wAdm = facultatif(s.wAdm, c.wAdm);
    const donnees: DonneesRadier = {
      Lx: nb(s.Lx, c.Lx),
      Ly: nb(s.Ly, c.Ly),
      t: nb(s.t, c.t),
      E: nb(s.E, c.E) * 1e6,
      nu: nb(s.nu, c.nu),
      k: nb(s.k, c.k),
      maillage: nb(s.maillage, c.maillage),
      poidsPropre: s.poidsPropre,
      decollement: s.decollement,
      bord: s.bord ? { largeur: nb(s.bordLargeur, c.bordLargeur), facteur: nb(s.bordFacteur, c.bordFacteur) } : null,
      poteaux,
      voiles,
      surface: { g: nb(s.surfG, c.surfG), q: nb(s.surfQ, c.surfQ) },
      verifications: { qRd: facultatif(s.qRd, c.qRd), wAdm: wAdm === null ? null : wAdm / 1000, betaAdm: fraction(s.betaAdm, c.betaAdm) },
      norme: lireNorme(s),
    };
    return { ok: true, calcul: { saisie: s, donnees } };
  } catch (err) {
    if (err instanceof Refus) return { ok: false, message: err.message };
    throw err;
  }
}

function lireNorme(s: Saisie): DonneesRadier['norme'] {
  if (s.generation === '2e') return { generation: 2, cc: choix(s.consequences, CONSEQUENCES, 'CC2') };
  if (s.profilNormatif === 'anb2022') return { generation: 1, profil: 'anb', risque: choix(s.risque, RISQUES, 'normal') };
  return { generation: 1, profil: 'recommande', approche: choix(s.approche1, APPROCHES, 'DA1') };
}

/** Verification du noyau ; leve si le noyau refuse (message du noyau). */
export function verifier(calcul: Calcul): Resultat {
  return verifierRadier(calcul.donnees);
}

/** k propose par B.16 (B = plus petit cote), arrondi a l'unite ; null si un champ est illisible. */
export function proposerK(s: Saisie): string | null {
  const E = lireNombre(s.Esol);
  const nu = lireNombre(s.nuSol);
  const Lx = lireNombre(s.Lx);
  const Ly = lireNombre(s.Ly);
  if (E === null || nu === null || Lx === null || Ly === null || !(E > 0) || !(Lx > 0) || !(Ly > 0)) return null;
  return String(Math.round(kSubgrade(E * 1000, nu, Lx < Ly ? Lx : Ly)));
}

export function ajouterPoteau(s: Saisie): Saisie {
  const modele = s.poteaux[s.poteaux.length - 1] ?? { x: '1', y: '1', a: '0,4', b: '0,4', G: '0', Q: '0' };
  return { ...s, poteaux: [...s.poteaux.map((p) => ({ ...p })), { ...modele }] };
}

export function retirerPoteau(s: Saisie, i: number): Saisie {
  return { ...s, poteaux: s.poteaux.filter((_, j) => j !== i).map((p) => ({ ...p })) };
}

export function ajouterVoile(s: Saisie): Saisie {
  return { ...s, voiles: [...s.voiles.map((v) => ({ ...v })), { x1: '0', y1: '0', x2: s.Lx, y2: '0', g: '0', q: '0' }] };
}

export function retirerVoile(s: Saisie, i: number): Saisie {
  return { ...s, voiles: s.voiles.filter((_, j) => j !== i).map((v) => ({ ...v })) };
}

/** Remplace les poteaux par la grille xs × ys (listes « 1 ; 6 ; 11 ») ; a, b, G, Q du premier poteau. */
export function grillePoteaux(s: Saisie, xs: string, ys: string): Saisie {
  const liste = (t: string) => t.split(';').map((v) => v.trim()).filter((v) => v !== '');
  const m = s.poteaux[0] ?? { x: '0', y: '0', a: '0,4', b: '0,4', G: '0', Q: '0' };
  const poteaux: SaisiePoteau[] = [];
  for (const x of liste(xs)) for (const y of liste(ys)) poteaux.push({ x, y, a: m.a, b: m.b, G: m.G, Q: m.Q });
  return { ...s, poteaux };
}

export function serialiser(s: Saisie): string {
  return JSON.stringify({ format: FORMAT, ...s }, null, 2);
}

const texteOu = (v: unknown, d: string): string => (typeof v === 'string' ? v : d);
const boolOu = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);

function listeOu<T extends Record<string, string>>(v: unknown, d: T[], modele: T): T[] {
  if (!Array.isArray(v)) return d.map((x) => ({ ...x }));
  return v.map((brut) => {
    const o = (typeof brut === 'object' && brut !== null ? brut : {}) as Record<string, unknown>;
    const r = { ...modele };
    for (const k of Object.keys(modele) as (keyof T)[]) r[k] = texteOu(o[k as string], modele[k]) as T[keyof T];
    return r;
  });
}

export function relire(contenu: string): Saisie {
  const brut = JSON.parse(contenu) as Record<string, unknown>;
  if (brut.format !== FORMAT) throw new Error(textes().refus.format(String(brut.format), FORMAT));
  const d = saisieParDefaut();
  const r = { ...d } as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === 'string') r[k] = texteOu(brut[k], v);
    else if (typeof v === 'boolean') r[k] = boolOu(brut[k], v);
  }
  const s = r as unknown as Saisie;
  s.generation = brut.generation === '1re' ? '1re' : '2e';
  s.poteaux = listeOu(brut.poteaux, d.poteaux, { x: '0', y: '0', a: '0,4', b: '0,4', G: '0', Q: '0' });
  s.voiles = listeOu(brut.voiles, d.voiles, { x1: '0', y1: '0', x2: '0', y2: '0', g: '0', q: '0' });
  return s;
}
