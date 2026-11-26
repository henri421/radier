// Tests d'acceptation : contour quelconque, ouvertures, distorsion le long des voiles. Ecrits par Claude le 26/11/2026.
// Chaque attendu vient d'une propriete exacte (charge uniforme, equivalence avec un rectangle plus petit).
import { describe, expect, it } from 'vitest';
import { analyseRadier, distorsion, momentsDeCalcul, verifierRadier, type DonneesRadier } from '../src/radier';

const proche = (v: number, attendu: number, tol = 1e-9) =>
  expect(Math.abs(v - attendu)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(attendu)));

const BASE: Omit<DonneesRadier, 'Lx' | 'Ly'> = {
  t: 0.5, E: 30e6, nu: 0.2, k: 2e4, maillage: 0.5, poidsPropre: false, decollement: true, bord: null,
  poteaux: [], voiles: [], surface: { g: 40, q: 0 },
  verifications: { qRd: null, wAdm: null, betaAdm: null }, norme: { generation: 2, cc: 'CC2' },
};
const L: [number, number][] = [[0, 0], [12, 0], [12, 6], [6, 6], [6, 10], [0, 10]];

describe('contour quelconque', () => {
  it('L sous charge uniforme : w = q/k, R = q·aire, moments nuls, aucun noeud hors du L', () => {
    const c = analyseRadier({ ...BASE, Lx: 12, Ly: 10, contour: L }, 1, 1);
    proche(c.aire, 12 * 6 + 6 * 4);
    proche(c.R, 40 * c.aire);
    c.w.forEach((w, n) => (c.dans[n] ? proche(w, 0.002) : expect(w).toBe(0)));
    for (const m of [...c.mx, ...c.my, ...c.mxy]) expect(Math.abs(m)).toBeLessThan(1e-6);
    // le coin rentrant (9 ; 9) n'appartient pas au radier
    const n = c.xs.findIndex((x, i) => x === 9 && c.ys[i] === 9);
    expect(c.dans[n]).toBe(false);
  });

  it('rectangle decale dans une boite plus grande : memes resultats que le rectangle seul', () => {
    const poteaux = [
      { x: 2, y: 2, a: 0.5, b: 0.5, G: 800, Q: 200 },
      { x: 6, y: 2, a: 0.5, b: 0.5, G: 1200, Q: 300 },
      { x: 2, y: 9, a: 0.5, b: 0.5, G: 500, Q: 100 },
    ];
    const seul: DonneesRadier = { ...BASE, Lx: 8, Ly: 11, poidsPropre: true, surface: { g: 5, q: 2 }, poteaux, bord: { largeur: 1, facteur: 2 } };
    const dx = 3, dy = 2;
    const decale: DonneesRadier = {
      ...seul, Lx: 14, Ly: 15,
      contour: [[dx, dy], [dx + 8, dy], [dx + 8, dy + 11], [dx, dy + 11]],
      poteaux: poteaux.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
    };
    const a = analyseRadier(seul, 1.35, 1.5);
    const b = analyseRadier(decale, 1.35, 1.5);
    proche(b.R, a.R);
    proche(Math.max(...b.w), Math.max(...a.w), 1e-8);
    proche(Math.min(...b.w.filter((_, n) => b.dans[n])), Math.min(...a.w), 1e-8);
    proche(Math.max(...b.p), Math.max(...a.p), 1e-8);
    const ma = momentsDeCalcul(seul, a);
    const mb = momentsDeCalcul(decale, b);
    for (const k of ['infX', 'infY', 'supX', 'supY'] as const) {
      proche(mb.calcul[k], ma.calcul[k], 1e-7);
      proche(mb.pic[k], ma.pic[k], 1e-7);
    }
    proche(distorsion(decale, b).beta, distorsion(seul, a).beta, 1e-8);
  });

  it('ouverture : aire retiree, w = q/k ; poteau ou voile sur l ouverture refuse', () => {
    const ouv: [number, number][] = [[4, 3], [7, 3], [7, 5], [4, 5]];
    const c = analyseRadier({ ...BASE, Lx: 12, Ly: 8, ouvertures: [ouv] }, 1, 1);
    proche(c.aire, 96 - 6);
    proche(c.R, 40 * 90);
    c.w.forEach((w, n) => c.dans[n] && proche(w, 0.002));
    const d = { ...BASE, Lx: 12, Ly: 8, ouvertures: [ouv] };
    expect(() => verifierRadier({ ...d, poteaux: [{ x: 5.5, y: 4, a: 0.4, b: 0.4, G: 100, Q: 0 }] })).toThrow(/Poteau 1/);
    expect(() => verifierRadier({ ...d, poteaux: [{ x: 4, y: 4, a: 0.4, b: 0.4, G: 100, Q: 0 }] })).toThrow(/Poteau 1/);
    expect(() => verifierRadier({ ...d, voiles: [{ x1: 1, y1: 4, x2: 11, y2: 4, g: 50, q: 0 }] })).toThrow(/Voile 1/);
    // un voile le long du bord de l'ouverture est admis
    expect(() => verifierRadier({ ...d, voiles: [{ x1: 4, y1: 3, x2: 7, y2: 3, g: 50, q: 0 }] })).not.toThrow();
  });

  it('refus : contour hors de la boite, point unique, poteau dans le coin rentrant', () => {
    const d = { ...BASE, Lx: 12, Ly: 10 };
    expect(() => verifierRadier({ ...d, contour: [[0, 0], [13, 0], [13, 10]] })).toThrow(/Contour/);
    expect(() => verifierRadier({ ...d, contour: [[0, 0], [1, 1], [2, 2]] })).toThrow(/Contour/);
    expect(() => verifierRadier({ ...d, contour: L, poteaux: [{ x: 9, y: 8, a: 0.4, b: 0.4, G: 1, Q: 0 }] })).toThrow(/Poteau 1/);
  });

  it('contour oblique : alerte sur l aire approchee en escalier', () => {
    const r = verifierRadier({ ...BASE, Lx: 10, Ly: 10, maillage: 1, contour: [[0, 0], [10, 0], [0, 10]] });
    expect(r.alertes.some((a) => a.startsWith('Contour approché par le maillage'))).toBe(true);
    const ok = verifierRadier({ ...BASE, Lx: 12, Ly: 10, contour: L });
    expect(ok.alertes).toEqual([]);
  });
});

describe('voiles', () => {
  it('distorsion le long d un voile : |Δw|/Δs entre points consecutifs', () => {
    // Radier souple, voile charge d'un seul cote : w varie le long du voile.
    const d: DonneesRadier = {
      ...BASE, Lx: 12, Ly: 4, t: 0.3, surface: { g: 0, q: 0 }, decollement: false,
      voiles: [{ x1: 0.5, y1: 2, x2: 11.5, y2: 2, g: 100, q: 0 }, { x1: 0.5, y1: 0.5, x2: 0.5, y2: 3.5, g: 300, q: 0 }],
    };
    const c = analyseRadier(d, 1, 1);
    const b = distorsion(d, c);
    expect(b.entre).not.toBe(null);
    expect(b.beta).toBeGreaterThan(0);
    // les points sont sur un voile, espaces d'au plus 2 m
    const [[x1, y1], [x2, y2]] = b.entre!;
    expect(Math.hypot(x2 - x1, y2 - y1)).toBeLessThanOrEqual(2 + 1e-9);
    // equilibre
    proche(c.R, 100 * 11 + 300 * 3, 1e-8);
  });
});
