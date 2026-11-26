// Saisie du contour, des ouvertures et des voiles (iteration « voiles et contour quelconque », 26/11/2026).
import { describe, expect, it } from 'vitest';
import { grilleVoiles, lireSaisie, relire, saisieExempleVoiles, saisieParDefaut, serialiser, verifier } from '../../app/src/form';
import { carteRadier } from '../../app/src/dessin';
import { noteDuCalcul } from '../../app/src/note';

describe('contour, ouvertures, voiles', () => {
  it('lecture du contour et des ouvertures (rectangle ou points)', () => {
    const l = lireSaisie({ ...saisieParDefaut(), contour: '0 ; 0 / 12 ; 0 / 12 ; 9 / 6 ; 9 / 6 ; 18 / 0 ; 18', ouvertures: '7 ; 2 ; 9 ; 4 / 1 ; 3 ; 3 ; 3 ; 2 ; 5' });
    if (!l.ok) throw new Error(l.message);
    expect(l.calcul.donnees.contour).toEqual([[0, 0], [12, 0], [12, 9], [6, 9], [6, 18], [0, 18]]);
    expect(l.calcul.donnees.ouvertures).toEqual([[[7, 2], [9, 2], [9, 4], [7, 4]], [[1, 3], [3, 3], [2, 5]]]);
    const vide = lireSaisie(saisieParDefaut());
    expect(vide.ok && vide.calcul.donnees.contour).toBe(null);
    expect(vide.ok && vide.calcul.donnees.ouvertures).toEqual([]);
  });
  it('refus : point a une seule valeur, ouverture a cinq valeurs, nombre illisible', () => {
    for (const s of [{ contour: '0 ; 0 / 12 / 0 ; 18' }, { ouvertures: '1 ; 2 ; 3 ; 4 ; 5' }, { contour: '0 ; x / 1 ; 1 / 0 ; 1' }]) {
      const l = lireSaisie({ ...saisieParDefaut(), ...s });
      expect(l.ok).toBe(false);
    }
  });
  it('exemple a voiles : calculable, voiles et ouverture dessines, distorsion le long des voiles', () => {
    const s = saisieExempleVoiles();
    expect(relire(serialiser(s))).toEqual(s);
    const l = lireSaisie(s);
    if (!l.ok) throw new Error(l.message);
    const r = verifier(l.calcul);
    expect(r.service.entre).not.toBe(null);
    expect(r.alertes).toEqual([]);
    const svg = carteRadier(l.calcul, r, { vue: 'w', combinaison: 'ELS', poteaux: true, maillage: true, decolle: true });
    expect(svg.match(/data-role="voile"/g)).toHaveLength(8);
    expect(svg).toContain('class="contour ouverture"');
    expect(svg).not.toMatch(/NaN|Infinity/);
    const n = noteDuCalcul(l.calcul, r, { projet: '', element: '', date: '2026-11-26' });
    expect(n.verifications.map((v) => v.nom)).toContain('Distorsion angulaire');
    expect(JSON.stringify(n)).toContain('Contour');
  });
  it('grille de voiles : une file par abscisse et par ordonnee', () => {
    const s = grilleVoiles(saisieExempleVoiles(), '0,1 ; 10', '0,1 ; 7,9');
    expect(s.voiles.map((v) => [v.x1, v.y1, v.x2, v.y2])).toEqual([
      ['0,1', '0,1', '0,1', '7,9'], ['10', '0,1', '10', '7,9'], ['0,1', '0,1', '10', '0,1'], ['0,1', '7,9', '10', '7,9'],
    ]);
    expect(s.voiles[0].g).toBe('80');
  });
});
