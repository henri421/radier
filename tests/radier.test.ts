// Tests d'acceptation du noyau du radier (PLAN-radier.md, T1). Ecrits par Claude le 26/11/2026.
// Attendus : python tests/reference/attendus.py (reference numpy du meme modele). A ne pas modifier.
import { describe, expect, it } from 'vitest';
import {
  analyseRadier,
  distorsion,
  kSubgrade,
  kzzSurAire,
  momentsDeCalcul,
  rigiditeRelative,
  verifierRadier,
  woodArmer,
  type DonneesRadier,
} from '../src/radier';

const proche = (v: number, attendu: number, tol = 1e-6) =>
  expect(Math.abs(v - attendu)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(attendu)));

const BASE = {
  t: 0.6, E: 33e6, nu: 0.2, maillage: 0.5, poidsPropre: true, decollement: true, bord: null, voiles: [],
  verifications: { qRd: 250, wAdm: 0.075, betaAdm: 1 / 500 },
  norme: { generation: 2 as const, cc: 'CC2' as const },
};

function exemple(): DonneesRadier {
  const poteaux = [];
  for (const x of [1, 6, 11]) {
    for (const y of [1, 6.5, 11.5, 17]) {
      poteaux.push({ x, y, a: 0.4, b: 0.4, G: x === 6 ? 1600 : 900, Q: x === 6 ? 600 : 300 });
    }
  }
  return { ...BASE, Lx: 12, Ly: 18, k: (0.65 * 40e3) / (12 * (1 - 0.09)), surface: { g: 3, q: 2.5 }, poteaux };
}

describe('T1 noyau du radier', () => {
  it('charge uniforme sans poids propre : w = q/k, p = q, moments nuls', () => {
    const d: DonneesRadier = { ...BASE, Lx: 6, Ly: 4, t: 0.5, E: 30e6, k: 2e4, poidsPropre: false, surface: { g: 50, q: 0 }, poteaux: [] };
    const c = analyseRadier(d, 1, 1);
    expect([c.nx, c.ny]).toEqual([12, 8]);
    for (const w of c.w) proche(w, 0.0025, 1e-9);
    for (const p of c.p) proche(p, 50, 1e-7);
    for (const m of [...c.mx, ...c.my, ...c.mxy]) expect(Math.abs(m)).toBeLessThan(1e-6);
    proche(c.R, 1200, 1e-9);
  });

  it('charge concentree au centre d une grande dalle : Westergaard a 1 %', () => {
    const E = 30e6, t = 0.3, nu = 0.2, k = 2e4, P = 100;
    const D = (E * t ** 3) / (12 * (1 - nu * nu));
    const l = (D / k) ** 0.25;
    const L = 12 * l, h = L / 48, c = L / 2;
    const d: DonneesRadier = {
      ...BASE, Lx: L, Ly: L, t, E, nu, k, maillage: h, poidsPropre: false, decollement: false,
      surface: { g: 0, q: 0 }, poteaux: [{ x: c, y: c, a: h, b: h, G: P, Q: 0 }],
    };
    const r = analyseRadier(d, 1, 1);
    const w0 = Math.max(...r.w);
    expect(Math.abs(w0 / (P / (8 * Math.sqrt(k * D))) - 1)).toBeLessThan(0.01);
    proche(r.R, P, 1e-8);
  });

  it('exemple de la maquette, ELU (a) : valeurs de la reference', () => {
    const d = exemple();
    const c = analyseRadier(d, 1.35, 1.5);
    expect([c.nx, c.ny, c.iterations]).toEqual([24, 36, 0]);
    proche(c.R, 31618.8);
    proche(c.Ftot, 31618.8);
    proche(Math.max(...c.w), 0.07661249986140469);
    proche(Math.min(...c.w), 0.053804214075263964);
    proche(Math.max(...c.p), 182.41071395572547);
    proche(c.w[0], 0.07649, 1e-3);
    const m = momentsDeCalcul(d, c);
    proche(m.calcul.infX, 462.64658605999136);
    proche(m.calcul.infY, 207.5061812400872);
    proche(m.calcul.supX, -289.6536731161004);
    proche(m.calcul.supY, -526.4074633269128);
    proche(m.pic.infX, 994.8016855573386);
    proche(m.pic.infY, 727.2221329225151);
  });

  it('exemple, ELS : tassements et distorsion entre poteaux voisins', () => {
    const d = exemple();
    const c = analyseRadier(d, 1, 1);
    proche(Math.max(...c.w), 0.05527, 1e-3);
    proche(Math.min(...c.w), 0.03886, 1e-3);
    const b = distorsion(d, c);
    proche(b.beta, 0.00211, 2e-3);
    expect(b.entre).toEqual([[1, 1], [1, 6.5]]);
  });

  it('bande de bord : k x 2 sur 1,5 m', () => {
    const d = { ...exemple(), bord: { largeur: 1.5, facteur: 2 } };
    const c = analyseRadier(d, 1, 1);
    proche(Math.max(...c.w), 0.03913, 1e-3);
    proche(Math.max(...c.p), 186.34663, 1e-6);
    proche(c.R, 22828);
    const b = distorsion(d, c);
    expect(b.entre).toEqual([[1, 1], [1, 6.5]]);
  });

  it('voile excentre sur un radier raide : decollement, longueur de contact 3 (L/2 - e)', () => {
    const d: DonneesRadier = {
      ...BASE, Lx: 6, Ly: 2, t: 1.5, E: 30e6, k: 1e4, maillage: 0.25, poidsPropre: false,
      surface: { g: 0, q: 0 }, poteaux: [], voiles: [{ x1: 4.5, y1: 0, x2: 4.5, y2: 2, g: 500, q: 0 }],
    };
    const c = analyseRadier(d, 1, 1);
    expect(c.iterations).toBe(2);
    proche(c.R, 1000, 1e-8);
    proche(Math.max(...c.p), 221.37792, 1e-5);
    const leves = c.xs.filter((_, i) => !c.actif[i]);
    expect(Math.max(...leves)).toBe(1.25);
    proche(c.actif.filter((a) => !a).length / c.actif.length, 0.24, 1e-9);
    // la pression rigide vaudrait 2P / (3 (L/2 - e) B) = 222,2 kPa
    expect(Math.abs(Math.max(...c.p) / 222.222 - 1)).toBeLessThan(0.01);
  });

  it('Wood-Armer : cas elementaires', () => {
    expect(woodArmer(10, 4, 3)).toEqual({ infX: 13, infY: 7, supX: 0, supY: 0 });
    // m_x + |m_xy| < 0 : m*_x inf = 0 et m*_y inf = m_y + m_xy^2/|m_x|
    const r = woodArmer(-10, 4, 2);
    expect(r.infX).toBe(0);
    proche(r.infY, 4 + 4 / 10, 1e-12);
    // m_y - |m_xy| > 0 : m*_y sup = 0 et m*_x sup = m_x - m_xy^2/|m_y|
    proche(r.supX, -11, 1e-12);
    expect(r.supY).toBe(0);
  });

  it('aides : k (B.16), K_zz/(B L) (B.19), K_s (B.15)', () => {
    proche(kSubgrade(40e3, 0.3, 12), (0.65 * 40e3) / (12 * 0.91), 1e-12);
    proche(kzzSurAire(40e3, 0.3, 12, 18), 2278.6244658840015, 1e-9);
    proche(rigiditeRelative(33e6, 0.2, 40e3, 0.3, 12, 18, 0.6), 0.13172551625356485, 1e-9);
  });

  it('verifierRadier : combinaisons (a) et (b), ELS, taux', () => {
    const r = verifierRadier(exemple());
    expect(r.combinaisons.map((c) => c.nom)).toEqual(['(a)', '(b)']);
    const a = r.combinaisons[0];
    expect(a.coefficients.find((k) => k.nom === 'γ_G')?.valeur).toBe(1.35);
    expect(a.coefficients.find((k) => k.nom === 'γ_Q')?.valeur).toBe(1.5);
    proche(a.pmax, 182.41071395572547);
    proche(a.taux!, 182.41071395572547 / 250);
    proche(r.service.wmax, 0.05527, 1e-3);
    proche(r.service.tauxW!, 0.05527 / 0.075, 1e-3);
    proche(r.service.tauxBeta!, 0.00211 * 500, 2e-3);
    expect(r.gouvernant.taux).toBeGreaterThan(1);
    proche(r.moments.infX, 462.64658605999136);
    expect(r.moments.combinaison).toBe('(a)');
  });

  it('refus', () => {
    const d = exemple();
    expect(() => verifierRadier({ ...d, t: 0 })).toThrow(/paisseur/);
    expect(() => verifierRadier({ ...d, k: -1 })).toThrow(/k/);
    expect(() => verifierRadier({ ...d, nu: 0.5 })).toThrow();
    expect(() => verifierRadier({ ...d, poteaux: [{ x: 13, y: 1, a: 0.4, b: 0.4, G: 1, Q: 0 }] })).toThrow(/Poteau 1/);
    expect(() => verifierRadier({ ...d, maillage: 0.01 })).toThrow(/maillage/i);
    expect(() => verifierRadier({ ...d, maillage: 13 })).toThrow(/maillage/i);
  });
});
