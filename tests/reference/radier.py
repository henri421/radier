"""Reference de calcul du radier sur ressorts (PLAN-radier.md). numpy seul, lance sans -I.

Modele (a reproduire exactement par src/radier.ts) :
- plaque mince de Kirchhoff, element rectangulaire ACM (12 ddl), maillage regulier nx x ny ;
- ddl par noeud : w (vers le bas, m), tx = dw/dy, ty = -dw/dx ;
- ressorts de Winkler aux noeuds, raideur k(x, y) * aire tributaire, sans traction si `decollement` ;
- charges integrees exactement sur la cellule tributaire de chaque noeud (rectangles) ; voiles decoupes
  en morceaux affectes au noeud dont la cellule contient le milieu du morceau ;
- moments aux noeuds : moyenne des valeurs nodales des elements voisins ; m > 0 : face inferieure tendue ;
- Wood-Armer (Wood 1968) ; moment de calcul : max des valeurs nodales hors des carres des poteaux et des
  moyennes sur le carre (a + 2t) x (b + 2t) de chaque poteau.
Unites : m, kN, kPa.
"""
import numpy as np

GAMMA_BETON = 25.0


def matrice_acm(a, b, D, nu):
    def P(x, y):
        return np.array([1, x, y, x * x, x * y, y * y, x**3, x * x * y, x * y * y, y**3, x**3 * y, x * y**3])

    def Px(x, y):
        return np.array([0, 1, 0, 2 * x, y, 0, 3 * x * x, 2 * x * y, y * y, 0, 3 * x * x * y, y**3])

    def Py(x, y):
        return np.array([0, 0, 1, 0, x, 2 * y, 0, x * x, 2 * x * y, 3 * y * y, x**3, 3 * x * y * y])

    C = []
    for (x, y) in [(0, 0), (a, 0), (a, b), (0, b)]:
        C += [P(x, y), Py(x, y), -Px(x, y)]
    Ci = np.linalg.inv(np.array(C, dtype=float))

    def Bc(x, y):
        wxx = np.array([0, 0, 0, 2, 0, 0, 6 * x, 2 * y, 0, 0, 6 * x * y, 0])
        wyy = np.array([0, 0, 0, 0, 0, 2, 0, 0, 2 * x, 6 * y, 0, 6 * x * y])
        wxy = np.array([0, 0, 0, 0, 1, 0, 0, 2 * x, 2 * y, 0, 3 * x * x, 3 * y * y])
        return np.array([-wxx, -wyy, -2 * wxy]) @ Ci

    Dm = D * np.array([[1, nu, 0], [nu, 1, 0], [0, 0, (1 - nu) / 2]])
    g, wg = np.polynomial.legendre.leggauss(3)
    K = np.zeros((12, 12))
    for i, gx in enumerate(g):
        for j, gy in enumerate(g):
            x, y = a * (gx + 1) / 2, b * (gy + 1) / 2
            B = Bc(x, y)
            K += B.T @ Dm @ B * wg[i] * wg[j] * a * b / 4
    return K, Bc, Dm


def resoudre_bande(K, F, bw):
    """K dense symetrique, elimination de Gauss limitee a la bande (equivalente a TS)."""
    n = len(F)
    A = K.copy()
    b = F.copy()
    for k in range(n):
        piv = A[k, k]
        if not piv > 0:
            raise ValueError('pivot')
        m = min(n - 1, k + bw)
        f = A[k + 1:m + 1, k] / piv
        A[k + 1:m + 1, k:m + 1] -= np.outer(f, A[k, k:m + 1])
        b[k + 1:m + 1] -= f * b[k]
    u = np.zeros(n)
    for i in range(n - 1, -1, -1):
        m = min(n - 1, i + bw)
        u[i] = (b[i] - A[i, i + 1:m + 1] @ u[i + 1:m + 1]) / A[i, i]
    return u


def recouvrement(a0, a1, b0, b1):
    return max(0.0, min(a1, b1) - max(a0, b0))


def analyse(d, gG, gQ):
    """d : dict (Lx, Ly, t, E, nu, k, maillage, poidsPropre, decollement, bord: None | (largeur, facteur),
    poteaux: [(x, y, a, b, G, Q)], voiles: [(x1, y1, x2, y2, g, q)], surface: (g, q))."""
    Lx, Ly, t, E, nu = d['Lx'], d['Ly'], d['t'], d['E'], d['nu']
    nx, ny = max(1, int(np.ceil(Lx / d['maillage'] - 1e-9))), max(1, int(np.ceil(Ly / d['maillage'] - 1e-9)))
    a, b = Lx / nx, Ly / ny
    D = E * t**3 / (12 * (1 - nu * nu))
    Ke, Bc, Dm = matrice_acm(a, b, D, nu)
    nnx = nx + 1
    N = (nx + 1) * (ny + 1)
    node = lambda i, j: j * nnx + i
    xs = np.arange(nx + 1) * a
    ys = np.arange(ny + 1) * b
    K = np.zeros((3 * N, 3 * N))
    for j in range(ny):
        for i in range(nx):
            ns = [node(i, j), node(i + 1, j), node(i + 1, j + 1), node(i, j + 1)]
            dofs = [3 * n + c for n in ns for c in range(3)]
            K[np.ix_(dofs, dofs)] += Ke
    cel = {}
    trib = np.zeros(N)
    kn = np.zeros(N)
    F = np.zeros(3 * N)
    g_s, q_s = d['surface']
    p_surf = gG * (g_s + (GAMMA_BETON * t if d['poidsPropre'] else 0)) + gQ * q_s
    for j in range(ny + 1):
        for i in range(nx + 1):
            x0, x1 = max(0.0, xs[i] - a / 2), min(Lx, xs[i] + a / 2)
            y0, y1 = max(0.0, ys[j] - b / 2), min(Ly, ys[j] + b / 2)
            n = node(i, j)
            cel[n] = (x0, x1, y0, y1)
            trib[n] = (x1 - x0) * (y1 - y0)
            kk = d['k']
            if d['bord'] is not None:
                l, fac = d['bord']
                dist = min(xs[i], Lx - xs[i], ys[j], Ly - ys[j])
                if dist < l - 1e-9:
                    kk *= fac
            kn[n] = kk * trib[n]
            f = p_surf * trib[n]
            for (px, py, pa, pb, G, Q) in d['poteaux']:
                ox = recouvrement(x0, x1, px - pa / 2, px + pa / 2)
                oy = recouvrement(y0, y1, py - pb / 2, py + pb / 2)
                f += (gG * G + gQ * Q) / (pa * pb) * ox * oy
            F[3 * n] = f
    for (x1, y1, x2, y2, g, q) in d['voiles']:
        L = np.hypot(x2 - x1, y2 - y1)
        m = max(1, int(np.ceil(L / (min(a, b) / 4))))
        for s in range(m):
            xm = x1 + (x2 - x1) * (s + 0.5) / m
            ym = y1 + (y2 - y1) * (s + 0.5) / m
            i = min(nx, max(0, int(np.floor(xm / a + 0.5))))
            j = min(ny, max(0, int(np.floor(ym / b + 0.5))))
            F[3 * node(i, j)] += (gG * g + gQ * q) * L / m
    bw = 3 * (nnx + 1) + 2
    actif = np.ones(N, bool)
    for it in range(100):
        A = K.copy()
        idx = 3 * np.arange(N)
        A[idx, idx] += np.where(actif, kn, 0.0)
        u = resoudre_bande(A, F, bw)
        w = u[0::3]
        nouv = (w > 0) if d['decollement'] else np.ones(N, bool)
        if (nouv == actif).all():
            break
        actif = nouv
    else:
        raise ValueError('decollement non converge')
    p = np.where(actif, kn * w / trib, 0.0)
    M = np.zeros((N, 3))
    cnt = np.zeros(N)
    for j in range(ny):
        for i in range(nx):
            ns = [node(i, j), node(i + 1, j), node(i + 1, j + 1), node(i, j + 1)]
            ue = np.concatenate([u[3 * n:3 * n + 3] for n in ns])
            for (x, y), n in zip([(0, 0), (a, 0), (a, b), (0, b)], ns):
                M[n] += Dm @ (Bc(x, y) @ ue)
                cnt[n] += 1
    M /= cnt[:, None]
    return dict(nx=nx, ny=ny, a=a, b=b, xs=xs, ys=ys, w=w, p=p, M=M, actif=actif, it=it,
                R=float(np.sum(np.where(actif, kn * w, 0.0))), Ftot=float(F[0::3].sum()))


def wood_armer(M):
    """M : (N, 3) mx, my, mxy -> (inf_x, inf_y, sup_x, sup_y), inf >= 0, sup <= 0."""
    mx, my, mxy = M[:, 0], M[:, 1], M[:, 2]
    a = np.abs(mxy)
    eps = 1e-12
    ix, iy = mx + a, my + a
    c1 = ix < 0
    ix = np.where(c1, 0.0, ix)
    iy = np.where(c1, my + mxy**2 / np.maximum(np.abs(mx), eps), iy)
    c2 = (iy < 0) & ~c1
    iy = np.where(c2, 0.0, iy)
    ix = np.where(c2, mx + mxy**2 / np.maximum(np.abs(my), eps), ix)
    sx, sy = mx - a, my - a
    c3 = sx > 0
    sx = np.where(c3, 0.0, sx)
    sy = np.where(c3, my - mxy**2 / np.maximum(np.abs(mx), eps), sy)
    c4 = (sy > 0) & ~c3
    sy = np.where(c4, 0.0, sy)
    sx = np.where(c4, mx - mxy**2 / np.maximum(np.abs(my), eps), sx)
    return np.maximum(ix, 0), np.maximum(iy, 0), np.minimum(sx, 0), np.minimum(sy, 0)


def moments_de_calcul(d, r):
    """Extremes de Wood-Armer : hors des carres des poteaux, valeurs nodales ; dans chaque carre
    (a + 2t) x (b + 2t), la moyenne des noeuds du carre. Retourne dict inf_x, inf_y, sup_x, sup_y."""
    nx, ny = r['nx'], r['ny']
    X, Y = np.meshgrid(r['xs'], r['ys'])
    X, Y = X.ravel(), Y.ravel()
    wa = wood_armer(r['M'])
    dans = np.zeros(len(X), bool)
    carres = []
    for (px, py, pa, pb, _, _) in d['poteaux']:
        s = (np.abs(X - px) <= pa / 2 + d['t'] + 1e-9) & (np.abs(Y - py) <= pb / 2 + d['t'] + 1e-9)
        dans |= s
        if s.any():
            carres.append(s)
    out = {}
    for nom, v, f in zip(['inf_x', 'inf_y', 'sup_x', 'sup_y'], wa, [max, max, min, min]):
        vals = list(v[~dans]) + [float(v[s].mean()) for s in carres]
        out[nom] = float(f(vals)) if vals else 0.0
    return out


def pic(r):
    ix, iy, sx, sy = wood_armer(r['M'])
    return dict(inf_x=float(ix.max()), inf_y=float(iy.max()), sup_x=float(sx.min()), sup_y=float(sy.min()))


def distorsion(d, r):
    """beta max entre poteaux voisins : paires dont le segment ne passe a moins de 1e-9 d'aucun autre
    poteau... version retenue : chaque poteau avec son plus proche voisin a droite (meme y a 1e-6 pres)
    et au-dessus (meme x). w des poteaux interpole bilineairement."""
    def w_en(x, y):
        i = min(r['nx'] - 1, int(x / r['a']))
        j = min(r['ny'] - 1, int(y / r['b']))
        s, t = x / r['a'] - i, y / r['b'] - j
        W = r['w'].reshape(r['ny'] + 1, r['nx'] + 1)
        return (1 - s) * (1 - t) * W[j, i] + s * (1 - t) * W[j, i + 1] + s * t * W[j + 1, i + 1] + (1 - s) * t * W[j + 1, i]
    P = [(px, py) for (px, py, *_ ) in d['poteaux']]
    best = (0.0, None, None)
    for (x, y) in P:
        droite = [q for q in P if abs(q[1] - y) < 1e-6 and q[0] > x + 1e-9]
        haut = [q for q in P if abs(q[0] - x) < 1e-6 and q[1] > y + 1e-9]
        for cand in (droite, haut):
            if not cand:
                continue
            q = min(cand, key=lambda c: np.hypot(c[0] - x, c[1] - y))
            beta = abs(w_en(x, y) - w_en(*q)) / np.hypot(q[0] - x, q[1] - y)
            if beta > best[0] * (1 + 1e-9) + 1e-15:
                best = (beta, (x, y), q)
    return best
