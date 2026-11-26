/**
 * Carte en plan du radier, en SVG. PUR : uniquement des coordonnees et des couleurs.
 * Repere : x vers la droite, y vers le haut (inverse du repere SVG). Une seule echelle en x et en y.
 * Chaque noeud est colore sur sa cellule tributaire (h × h, coupee au bord).
 */

import { nombreAffiche, notationSvg } from 'aedificium-ui';
import { woodArmer, type Champ } from '../../src/radier';
import type { Calcul, Resultat } from './form';
import { textes } from './textes';

export type VueCarte = 'w' | 'p' | 'infX' | 'infY' | 'supX' | 'supY';
export interface OptionsCarte {
  vue: VueCarte;
  /** 'ELS' ou le nom d'une combinaison ELU, par exemple '(a)'. */
  combinaison: string;
  poteaux: boolean;
  maillage: boolean;
  decolle: boolean;
}

const LARGEUR = 380;
const HAUTEUR = 440;
const PAD = { gauche: 40, droite: 96, haut: 34, bas: 40 };

/** Nombre fini, ou 0 : jamais de NaN ni d'Infinity dans un attribut. */
const a = (v: number): string => (Number.isFinite(v) ? String(Number(v.toFixed(2))) : '0');
const nb = (v: number, dec: number): string => (Number.isFinite(v) ? nombreAffiche(v, dec) : '—');

/** Champ de la combinaison demandee ; ELS par defaut. */
export function champDeVue(r: Resultat, combinaison: string): Champ {
  if (combinaison === 'ELS') return r.service.champ;
  return (r.combinaisons.find((c) => c.nom === combinaison) ?? r.combinaisons[0])?.champ ?? r.service.champ;
}

/** Valeurs nodales affichees : w en mm, p en kPa, moments de Wood-Armer en kN·m/m. */
export function valeursDeVue(c: Champ, vue: VueCarte): number[] {
  if (vue === 'w') return c.w.map((w) => w * 1000);
  if (vue === 'p') return [...c.p];
  return c.mx.map((mx, i) => woodArmer(mx, c.my[i], c.mxy[i])[vue]);
}

const CLAIR: [number, number, number] = [242, 241, 236];
const BLEU: [number, number, number] = [30, 90, 168];
const ROUGE: [number, number, number] = [168, 68, 42];
const melange = (c1: number[], c2: number[], t: number): string => {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * u)).join(',')})`;
};

/** Echelle de couleurs : sequentielle pour w et p, divergente autour de 0 pour les moments. */
function couleurs(vue: VueCarte, v: number[]): { min: number; max: number; couleur: (x: number) => string } {
  let min = Infinity;
  let max = -Infinity;
  for (const x of v) {
    if (x < min) min = x;
    if (x > max) max = x;
  }
  if (!Number.isFinite(min)) { min = 0; max = 0; }
  if (vue === 'w' || vue === 'p') {
    const e = max - min > 1e-9 * Math.max(1, Math.abs(max)) ? max - min : 1;
    return { min, max, couleur: (x) => melange(CLAIR, BLEU, 0.08 + (0.92 * (x - min)) / e) };
  }
  const m = Math.max(Math.abs(min), Math.abs(max)) || 1;
  return { min: -m, max: m, couleur: (x) => (x >= 0 ? melange(CLAIR, BLEU, x / m) : melange(CLAIR, ROUGE, -x / m)) };
}

export function carteRadier(calcul: Calcul, r: Resultat, o: OptionsCarte): string {
  const t = textes().dessin;
  const d = calcul.donnees;
  const champ = champDeVue(r, o.combinaison);
  const v = valeursDeVue(champ, o.vue);
  const ech = couleurs(o.vue, v.filter((_, n) => champ.dans[n]));

  const S = Math.min(LARGEUR / d.Lx, HAUTEUR / d.Ly);
  const W = d.Lx * S;
  const H = d.Ly * S;
  const X = (x: number) => PAD.gauche + x * S;
  const Y = (y: number) => PAD.haut + (d.Ly - y) * S;
  const hx = d.Lx / champ.nx;
  const hy = d.Ly / champ.ny;
  /** Quarts des mailles actives autour de chaque noeud : l'aire tributaire, coupee au contour. */
  const quarts: { n: number; x0: number; y0: number }[] = [];
  for (let j = 0; j < champ.ny; j += 1) {
    for (let i = 0; i < champ.nx; i += 1) {
      if (!champ.cellules[j * champ.nx + i]) continue;
      for (const [di, dj] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
        quarts.push({ n: (j + dj) * (champ.nx + 1) + i + di, x0: (i + di * 0.5) * hx, y0: (j + dj * 0.5) * hy });
      }
    }
  }
  const quart = (q: { x0: number; y0: number }) =>
    `x="${a(X(q.x0))}" y="${a(Y(q.y0 + hy / 2))}" width="${a((hx / 2) * S + 0.3)}" height="${a((hy / 2) * S + 0.3)}"`;
  const contour: [number, number][] = d.contour ?? [[0, 0], [d.Lx, 0], [d.Lx, d.Ly], [0, d.Ly]];
  const polygone = (poly: [number, number][], classe: string) =>
    `<polygon class="${classe}" points="${poly.map(([x, y]) => `${a(X(x))},${a(Y(y))}`).join(' ')}"/>`;

  const parts: string[] = [];
  parts.push(`<text x="${a(PAD.gauche)}" y="20" class="titre-carte">${notationSvg(t.titre[o.vue])}</text>`);
  parts.push('<g data-role="carte">');
  for (const q of quarts) parts.push(`<rect ${quart(q)} fill="${ech.couleur(v[q.n])}"/>`);
  parts.push('</g>');

  if (o.maillage) {
    parts.push('<g data-role="maillage" class="maillage">');
    for (let j = 0; j < champ.ny; j += 1) {
      for (let i = 0; i < champ.nx; i += 1) {
        if (champ.cellules[j * champ.nx + i]) parts.push(`<rect x="${a(X(i * hx))}" y="${a(Y((j + 1) * hy))}" width="${a(hx * S)}" height="${a(hy * S)}"/>`);
      }
    }
    parts.push('</g>');
  }

  if (o.decolle && champ.actif.some((x, n) => champ.dans[n] && !x)) {
    parts.push(`<g data-role="decolle" class="decolle"><title>${t.decolle}</title>`);
    for (const q of quarts) if (!champ.actif[q.n]) parts.push(`<rect ${quart(q)}/>`);
    parts.push('</g>');
  }

  parts.push(polygone(contour, 'contour'));
  for (const ouv of d.ouvertures ?? []) parts.push(polygone(ouv, 'contour ouverture'));

  for (const w of d.voiles) {
    parts.push(`<line data-role="voile" class="voile" x1="${a(X(w.x1))}" y1="${a(Y(w.y1))}" x2="${a(X(w.x2))}" y2="${a(Y(w.y2))}"/>`);
  }
  if (o.poteaux) {
    for (const p of d.poteaux) {
      const l = Math.max(p.a * S, 3);
      const h = Math.max(p.b * S, 3);
      parts.push(`<rect data-role="poteau" class="poteau" x="${a(X(p.x) - l / 2)}" y="${a(Y(p.y) - h / 2)}" width="${a(l)}" height="${a(h)}"/>`);
    }
  }

  // Cotes
  const yc = Y(0) + 22;
  parts.push(`<line class="cote" x1="${a(X(0))}" y1="${a(yc)}" x2="${a(X(d.Lx))}" y2="${a(yc)}"/>`);
  parts.push(`<text class="cote" x="${a(X(d.Lx / 2))}" y="${a(yc + 13)}" text-anchor="middle">${notationSvg(t.longueur('L_x', nb(d.Lx, 2)))}</text>`);
  const xc = X(0) - 14;
  parts.push(`<line class="cote" x1="${a(xc)}" y1="${a(Y(0))}" x2="${a(xc)}" y2="${a(Y(d.Ly))}"/>`);
  parts.push(`<text class="cote" x="${a(xc - 4)}" y="${a(Y(d.Ly / 2))}" text-anchor="middle" transform="rotate(-90 ${a(xc - 4)} ${a(Y(d.Ly / 2))})">${notationSvg(t.longueur('L_y', nb(d.Ly, 2)))}</text>`);

  // Echelle de couleurs
  const ex = X(d.Lx) + 22;
  const eh = Math.min(H, 220);
  const n = 24;
  parts.push('<g data-role="echelle" class="echelle">');
  for (let k = 0; k < n; k += 1) {
    const val = ech.max - ((ech.max - ech.min) * (k + 0.5)) / n;
    parts.push(`<rect x="${a(ex)}" y="${a(PAD.haut + (eh * k) / n)}" width="14" height="${a(eh / n + 0.3)}" fill="${ech.couleur(val)}"/>`);
  }
  parts.push(`<rect class="contour-echelle" x="${a(ex)}" y="${a(PAD.haut)}" width="14" height="${a(eh)}"/>`);
  const dec = o.vue === 'w' ? 1 : 0;
  parts.push(`<text class="cote" x="${a(ex + 18)}" y="${a(PAD.haut + 9)}">${nb(ech.max, dec)}</text>`);
  if (ech.min < 0 && ech.max > 0) parts.push(`<text class="cote" x="${a(ex + 18)}" y="${a(PAD.haut + eh / 2 + 4)}">0</text>`);
  parts.push(`<text class="cote" x="${a(ex + 18)}" y="${a(PAD.haut + eh)}">${nb(ech.min, dec)}</text>`);
  parts.push('</g>');

  const largeur = PAD.gauche + W + PAD.droite;
  const hauteur = PAD.haut + H + PAD.bas;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${a(largeur)} ${a(hauteur)}" role="img" aria-label="${t.aria}">${parts.join('')}</svg>`;
}
