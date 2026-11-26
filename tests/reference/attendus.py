"""Attendus des tests d'acceptation (PLAN-radier.md). Lance : python tests/reference/attendus.py > attendus.json
Les valeurs sont recopiees dans tests/radier.test.ts (CAS_*)."""
import json
import sys
import os
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from radier import analyse, moments_de_calcul, pic, distorsion  # noqa: E402

BASE = dict(t=0.6, E=33e6, nu=0.2, maillage=0.5, poidsPropre=True, decollement=True, bord=None, voiles=[])


def exemple(**kw):
    xs, ys = [1.0, 6.0, 11.0], [1.0, 6.5, 11.5, 17.0]
    d = dict(BASE, Lx=12.0, Ly=18.0, k=0.65 * 40e3 / (12 * (1 - 0.3**2)), surface=(3.0, 2.5),
             poteaux=[(x, y, 0.4, 0.4, 1600.0 if x == 6 else 900.0, 600.0 if x == 6 else 300.0) for x in xs for y in ys])
    d.update(kw)
    return d


def resume(d, gG, gQ):
    r = analyse(d, gG, gQ)
    W = r['w']
    beta = distorsion(d, r)
    return dict(
        nx=r['nx'], ny=r['ny'], iterations=r['it'], R=r['R'], Ftot=r['Ftot'],
        wmax=float(W.max()), wmin=float(W.min()), pmax=float(r['p'].max()),
        decolle=float(1 - r['actif'].mean()), calcul=moments_de_calcul(d, r), pic=pic(r),
        beta=beta[0], betaEntre=[beta[1], beta[2]],
        w00=float(W[0]), wCentre=float(W[(r['ny'] // 2) * (r['nx'] + 1) + r['nx'] // 2]),
    )


out = {}
# 1. Uniforme sans poids propre : w = q/k partout, moments nuls.
u = dict(BASE, Lx=6.0, Ly=4.0, t=0.5, E=30e6, k=2e4, poidsPropre=False, surface=(50.0, 0.0), poteaux=[])
out['uniforme'] = resume(u, 1.0, 1.0)
# 2. Exemple de la maquette, ELU (a) CC2 et ELS.
out['exemple_a'] = resume(exemple(), 1.35, 1.5)
out['exemple_els'] = resume(exemple(), 1.0, 1.0)
# 3. Bande de bord 1,5 m, k x 2.
out['bord'] = resume(exemple(bord=(1.5, 2.0)), 1.0, 1.0)
# 4. Voile excentre sur un radier raide : decollement.
v = dict(BASE, Lx=6.0, Ly=2.0, t=1.5, E=30e6, k=1e4, poidsPropre=False, surface=(0.0, 0.0), poteaux=[],
         voiles=[(4.5, 0.0, 4.5, 2.0, 500.0, 0.0)], maillage=0.25)
out['voile_decolle'] = resume(v, 1.0, 1.0)
r = analyse(v, 1.0, 1.0)
ligne = r['actif'].reshape(r['ny'] + 1, r['nx'] + 1)[0]
out['voile_decolle']['xContact'] = float(r['xs'][~ligne].max()) if (~ligne).any() else 0.0
json.dump(out, sys.stdout, indent=1)
