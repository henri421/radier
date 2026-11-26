// Tests d'acceptation de l'application radier (PLAN-radier.md, T2 a T4). Ecrits par Claude le 26/11/2026.
// Purs (aucun jsdom). A ne pas modifier.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { constatsAffichage, definirLangue, texteVisible } from 'aedificium-ui';
import {
  ajouterPoteau,
  ajouterVoile,
  grillePoteaux,
  lireSaisie,
  proposerK,
  relire,
  retirerPoteau,
  saisieParDefaut,
  serialiser,
  verifier,
  type Saisie,
} from '../../app/src/form';
import { carteRadier } from '../../app/src/dessin';
import { noteDuCalcul } from '../../app/src/note';

const lire = (c: string): string => readFileSync(fileURLToPath(new URL(c, import.meta.url)), 'utf8');
const cartouche = { projet: 'P', element: 'E', date: '2026-11-26' };
function calcul(s: Saisie) {
  const l = lireSaisie(s);
  if (!l.ok) throw new Error(l.message);
  return l.calcul;
}
afterEach(() => definirLangue('fr'));

describe('T2 saisie', () => {
  it('par defaut : le cas de la maquette', () => {
    const s = saisieParDefaut();
    expect([s.Lx, s.Ly, s.t, s.E, s.nu, s.maillage]).toEqual(['12', '18', '0,6', '33', '0,2', '0,5']);
    expect([s.k, s.Esol, s.nuSol, s.bord, s.decollement, s.poidsPropre]).toEqual(['2381', '40', '0,3', false, true, true]);
    expect([s.surfG, s.surfQ, s.qRd, s.wAdm, s.betaAdm, s.generation, s.consequences]).toEqual(['3', '2,5', '250', '75', '1/500', '2e', 'CC2']);
    expect(s.poteaux).toHaveLength(12);
    expect(s.poteaux[0]).toEqual({ x: '1', y: '1', a: '0,4', b: '0,4', G: '900', Q: '300' });
    expect(s.poteaux[4]).toEqual({ x: '6', y: '1', a: '0,4', b: '0,4', G: '1600', Q: '600' });
    expect(s.voiles).toEqual([]);
  });
  it('lecture : donnees du noyau en kPa et m', () => {
    const d = calcul(saisieParDefaut()).donnees;
    expect([d.Lx, d.Ly, d.t, d.E, d.nu, d.k, d.maillage]).toEqual([12, 18, 0.6, 33e6, 0.2, 2381, 0.5]);
    expect(d.verifications).toEqual({ qRd: 250, wAdm: 0.075, betaAdm: 0.002 });
    expect(d.bord).toBe(null);
    expect(d.norme).toEqual({ generation: 2, cc: 'CC2' });
    expect(d.surface).toEqual({ g: 3, q: 2.5 });
  });
  it('limites vides : null ; bande de bord cochee', () => {
    const s = { ...saisieParDefaut(), qRd: '', wAdm: ' ', betaAdm: '', bord: true, bordLargeur: '1,5', bordFacteur: '2' };
    const d = calcul(s).donnees;
    expect(d.verifications).toEqual({ qRd: null, wAdm: null, betaAdm: null });
    expect(d.bord).toEqual({ largeur: 1.5, facteur: 2 });
  });
  it('1re generation : approche recommandee ou ANB', () => {
    expect(calcul({ ...saisieParDefaut(), generation: '1re', approche1: 'DA3' }).donnees.norme).toEqual({ generation: 1, profil: 'recommande', approche: 'DA3' });
    expect(calcul({ ...saisieParDefaut(), generation: '1re', profilNormatif: 'anb2022', risque: 'eleve' }).donnees.norme).toEqual({ generation: 1, profil: 'anb', risque: 'eleve' });
  });
  it('refus nommant le champ, le poteau ou le voile', () => {
    const a = lireSaisie({ ...saisieParDefaut(), t: 'x' });
    expect(a.ok).toBe(false);
    const s = saisieParDefaut();
    s.poteaux[2].G = 'abc';
    const b = lireSaisie(s);
    expect(!b.ok && b.message).toMatch(/Poteau 3/);
    const v = ajouterVoile(saisieParDefaut());
    v.voiles[0].g = '?';
    const c = lireSaisie(v);
    expect(!c.ok && c.message).toMatch(/Voile 1/);
  });
  it('verifier : le noyau sur le cas par defaut', () => {
    const r = verifier(calcul(saisieParDefaut()));
    expect(r.combinaisons.map((c) => c.nom)).toEqual(['(a)', '(b)']);
    expect(Math.abs(r.combinaisons[0].pmax / 182.4 - 1)).toBeLessThan(0.01);
  });
  it('poteaux, voiles, grille, proposition de k', () => {
    let s = ajouterPoteau(saisieParDefaut());
    expect(s.poteaux).toHaveLength(13);
    s = retirerPoteau(s, 0);
    expect(s.poteaux).toHaveLength(12);
    s = grillePoteaux(saisieParDefaut(), '2 ; 10', '3 ; 9 ; 15');
    expect(s.poteaux.map((p) => [p.x, p.y])).toEqual([['2', '3'], ['2', '9'], ['2', '15'], ['10', '3'], ['10', '9'], ['10', '15']]);
    expect(s.poteaux[5].G).toBe('900');
    expect(proposerK(saisieParDefaut())).toBe('2381');
    expect(proposerK({ ...saisieParDefaut(), Esol: '' })).toBe(null);
  });
  it('fichier : aller-retour ; valeurs absentes = defauts', () => {
    const s = ajouterVoile({ ...saisieParDefaut(), bord: true, generation: '1re' as const });
    expect(relire(serialiser(s))).toEqual(s);
    const brut = JSON.parse(serialiser(saisieParDefaut())) as Record<string, unknown>;
    delete brut.maillage;
    delete brut.voiles;
    const r = relire(JSON.stringify(brut));
    expect(r.maillage).toBe('0,5');
    expect(r.voiles).toEqual([]);
    expect(() => relire(JSON.stringify({ format: 'pieux/1' }))).toThrow();
  });
});

describe('T3 dessin et note', () => {
  const c = calcul(saisieParDefaut());
  const r = verifier(c);

  it('carte en plan : cellules, poteaux, echelle, sans NaN', () => {
    const svg = carteRadier(c, r, { vue: 'w', combinaison: 'ELS', poteaux: true, maillage: false, decolle: true });
    for (const role of ['carte', 'poteau', 'echelle']) expect(svg).toContain(`data-role="${role}"`);
    expect(svg.match(/data-role="poteau"/g)).toHaveLength(12);
    expect(svg).not.toMatch(/NaN|Infinity/);
    for (const vue of ['p', 'infX', 'infY', 'supX', 'supY'] as const) {
      const s = carteRadier(c, r, { vue, combinaison: '(a)', poteaux: false, maillage: true, decolle: false });
      expect(s).not.toContain('data-role="poteau"');
      expect(s).not.toMatch(/NaN|Infinity/);
    }
  });
  it('voile et zone decollee dessines', () => {
    const s = saisieParDefaut();
    s.poteaux = [];
    s.voiles = [{ x1: '10', y1: '0', x2: '10', y2: '18', g: '400', q: '0' }];
    s.surfG = '0'; s.surfQ = '0'; s.poidsPropre = false; s.t = '1,5';
    const cc = calcul(s);
    const rr = verifier(cc);
    expect(rr.combinaisons[0].decolle).toBeGreaterThan(0);
    const svg = carteRadier(cc, rr, { vue: 'p', combinaison: '(a)', poteaux: true, maillage: false, decolle: true });
    expect(svg).toContain('data-role="voile"');
    expect(svg).toContain('data-role="decolle"');
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
  it('note : methode citee, tableaux, figure, conclusions', () => {
    const n = noteDuCalcul(c, r, cartouche);
    const texte = JSON.stringify(n);
    for (const m of ['5.2.4.2', '5.5.6', 'B.16', 'Wood']) expect(texte).toContain(m);
    expect(n.cartouche.outil).toBe('radier');
    expect(texte).toMatch(/"titre":"Tassements des poteaux[^"]*"/);
    expect(texte).toMatch(/"titre":"Moments de calcul[^"]*"/);
    expect(Object.values(n.sections).flat().some((e) => e.type === 'figure')).toBe(true);
    expect(n.verifications.map((v) => v.nom)).toEqual(['Pression du sol · (a)', 'Pression du sol · (b)', 'Tassement maximal', 'Distorsion angulaire']);
    const sans = calcul({ ...saisieParDefaut(), qRd: '', wAdm: '', betaAdm: '' });
    expect(noteDuCalcul(sans, verifier(sans), cartouche).verifications).toEqual([]);
  });
});

describe('T4 page', () => {
  const page = lire('../../app/index.html');
  const en = lire('../../app/en/index.html');
  const main = lire('../../app/src/main.ts');
  it('champs, zones, actions', () => {
    for (const k of Object.keys(saisieParDefaut())) {
      if (['poteaux', 'voiles', 'generation'].includes(k)) continue;
      expect(page).toContain(`data-champ="${k}"`);
      expect(en).toContain(`data-champ="${k}"`);
    }
    for (const r of ['erreur', 'poteaux', 'voiles', 'carte', 'verdicts', 'volets', 'projet', 'element', 'ouvrir']) expect(page).toContain(`data-role="${r}"`);
    for (const a of ['exporter-note-pdf', 'exporter-note', 'exporter-carte', 'exporter-resultats', 'enregistrer', 'reinitialiser', 'ajouter-poteau', 'ajouter-voile', 'grille-poteaux', 'proposer-k']) expect(page).toContain(`data-action="${a}"`);
    expect(page).toContain('<h1>Radier</h1>');
    expect(en).toContain('lang="en"');
  });
  it('hors perimetre annonce, affichage propre FR et EN', () => {
    const t = texteVisible(page);
    for (const m of ['poinçonnement', 'ouvertures', 'pieux']) expect(t).toContain(m);
    expect(constatsAffichage(t)).toEqual([]);
    expect(constatsAffichage(texteVisible(en))).toEqual([]);
  });
  it('main.ts passe par les modules purs et ne calcule rien', () => {
    for (const f of ['lireSaisie(', 'verifier(', 'carteRadier(', 'noteDuCalcul(', 'noteDeCalculHtml(', 'svgAutonome(', 'resultatsEnCsv(']) expect(main).toContain(f);
    expect(main).toContain("'radier/saisie'");
    for (const f of [main, lire('../../app/src/vue.ts'), lire('../../app/src/form.ts')]) expect(f).not.toMatch(/Math\.(sqrt|pow|exp|log|tan)/);
  });
});
