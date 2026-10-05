"""
The MakeHuman parametric body packed for the game (scripts/makehuman/build.py --pack): body.json
(what is where, the bones, the corners of the macro space) and body.bin (little-endian arrays).

The shape space: every vertex of the body, the eyes and both eyebrows, and every bone's head, of
each macro sample (MakeHuman's corners of gender x age x muscle x weight, height and proportions at
each gender and age), as one vector; their mean and principal components (int16, a scale each),
enough that no corner is off by more than MAX_ERR; each corner's coefficients (float32). The
targets on the reference (a belly, wider hips, the face's targets) are sparse deltas (the vertices
they move, int16). The face's shape keys likewise. The hair: each style's triangles and its binding
to the low body (the triangle, two barycentric weights, the offset; hair.py).
"""
import json, os, glob
import numpy as np

HEAD_ERR = 0.0045      # m: the worst point of the head (the face, the eyes, the brows) at any corner after compression
P99_ERR = 0.004        # m: and 99 % of all points within this (the worst are a few at the crotch of the extreme corners)
STRONG = 8             # the first components are int16, the rest int8
MIN_DELTA = 0.00008    # m: a target or a key moves a vertex at least this much to be stored
KMAX = 48


class Bin:
    def __init__(self):
        self.parts, self.meta, self.size = [], {}, 0

    def add(self, name, arr, dtype, scale=None):
        a = np.ascontiguousarray(np.asarray(arr).astype(dtype))
        pad = (-self.size) % 4
        if pad:
            self.parts.append(b'\0' * pad); self.size += pad
        self.meta[name] = {'type': np.dtype(dtype).name, 'offset': self.size, 'length': int(a.size), **({'scale': float(scale)} if scale is not None else {})}
        self.parts.append(a.tobytes()); self.size += a.nbytes
        return self.meta[name]

    def q16(self, name, arr):
        """int16 with a scale (value = int * scale)."""
        m = float(np.abs(arr).max()) or 1.0
        s = m / 32767
        return self.add(name, np.round(np.asarray(arr) / s), np.int16, s)

    def q8(self, name, arr):
        """int8 with a scale."""
        m = float(np.abs(arr).max()) or 1.0
        s = m / 127
        return self.add(name, np.round(np.asarray(arr) / s), np.int8, s)


def head_box(H):
    """The head's extent (m): width, height, depth."""
    return [round(float(x), 5) for x in (H.max(0) - H.min(0))]


def main(WORK, OUT, SAMPLES, TARGETS, FACE_TARGETS, AGES, LEVELS, HIP_Y, log):
    R = json.load(open(os.path.join(WORK, 'ref.json')))
    z = np.load(os.path.join(WORK, 'ref.npz'))
    H = np.load(os.path.join(WORK, 'hair.npz'))
    S = {}
    for f in sorted(glob.glob(os.path.join(WORK, 'samples-*.npz'))):
        S.update(dict(np.load(f)))
    nb = len(R['brows'])
    parts = ['body', 'eyes'] + [f'brows{i}' for i in range(nb)] + ['bones']
    sizes = [len(z[p]) for p in parts]
    starts = np.cumsum([0] + sizes)
    def vec(sid):
        return np.concatenate([S[f'{sid}|{p}'].reshape(-1, 3) for p in parts]).ravel()
    ref_vec = np.concatenate([z[p].reshape(-1, 3) for p in parts]).ravel()
    macro = [s for s in SAMPLES if s['kind'] != 'target']
    missing = [s['id'] for s in SAMPLES if f"{s['id']}|body" not in S]
    if missing:
        raise SystemExit(f'missing samples: {missing[:5]} ... ({len(missing)})')
    X = np.array([vec(s['id']) for s in macro])
    mean = X.mean(0)
    U, sig, Vt = np.linalg.svd(X - mean, full_matrices=False)
    head = np.concatenate([z['headw'] > 0.5, np.ones(sum(sizes[1:-1]), bool), np.zeros(sizes[-1], bool)])
    for K in range(8, min(KMAX, len(macro)) + 1):
        rec = (U[:, :K] * sig[:K]) @ Vt[:K]
        e = np.sqrt(((rec - (X - mean)).reshape(len(X), -1, 3) ** 2).sum(2))
        err = {'head': float(e[:, head].max()), 'p99': float(np.percentile(e, 99)), 'max': float(e.max())}
        if err['head'] < HEAD_ERR and err['p99'] < P99_ERR:
            break
    log(f"shape space: {len(macro)} corners, {X.shape[1] // 3} points, {K} components (worst head point {err['head'] * 1000:.2f} mm, 99 % within {err['p99'] * 1000:.2f}, worst {err['max'] * 1000:.1f})")
    B = Bin()
    B.add('mean', mean, np.float32)
    for k in range(K):
        (B.q16 if k < STRONG else B.q8)(f'pc{k}', Vt[k] * sig[k])
    coef = U[:, :K]
    B.add('coef', coef, np.float32)
    nodes = [{'id': s['id'], 'kind': s['kind'], **s['macro'], 'size': float(1 / S[f"{s['id']}|s"][0])} for s in macro]
    # targets: sparse deltas against the reference (each built like it, the face's turn kept)
    targets = {}
    for name in TARGETS:
        d = (vec(f't-{name}') - ref_vec).reshape(-1, 3)
        mv = np.nonzero(np.sqrt((d ** 2).sum(1)) > MIN_DELTA)[0]
        if name in FACE_TARGETS:   # (the face's: only the head, the eyes and the brows)
            headw = np.concatenate([z['headw'], np.ones(sum(sizes[1:-1])), np.zeros(sizes[-1])])
            mv = mv[headw[mv] > 0.02]
        targets[name] = {'count': int(len(mv))}
        B.add(f't_{name}_i', mv, np.uint16)
        B.q16(f't_{name}_d', d[mv])
    # the face's shape keys (sparse, over body + eyes + brows)
    keys = {}
    for k in R['keys']:
        d = np.zeros((int(starts[-2]), 3))
        d[:sizes[0]] = z[f'key_{k}']
        if f'ekey_{k}' in z.files:
            d[starts[1]:starts[2]] = z[f'ekey_{k}']
        for i in range(nb):
            if f'bkey{i}_{k}' in z.files:
                d[starts[2 + i]:starts[3 + i]] = z[f'bkey{i}_{k}']
        mv = np.nonzero(np.sqrt((d ** 2).sum(1)) > MIN_DELTA)[0]
        keys[k] = {'count': int(len(mv))}
        B.add(f'k_{k}_i', mv, np.uint16)
        B.q16(f'k_{k}_d', d[mv])
    # topology and skin
    B.add('body_tris', z['low_tris'], np.uint16)
    B.add('eyes_tris', z['eye_tris'], np.uint16)
    for i in range(nb):
        B.add(f'brows{i}_tris', z[f'brow_tris{i}'], np.uint16)
    B.add('body_joints', z['J'], np.uint8)
    B.add('body_weights', np.round(z['W'] * 255), np.uint8)
    # the hair: triangles, the binding (triangle, barycentric weights, offset in mm/50)
    hair = {}
    for st, m in R['styles'].items():
        B.add(f'h_{st}_tris', H[f'{st}_tris'], np.uint16)
        B.add(f'h_{st}_tri', H[f'{st}_tri'], np.uint16)
        B.add(f'h_{st}_bary', np.round(H[f'{st}_bary'][:, :2] * 65535).clip(0, 65535), np.uint16)
        B.q16(f'h_{st}_off', H[f'{st}_off'])
        B.add(f'h_{st}_lock', H[f'{st}_lock'], np.uint8)
        hair[st] = m
    bones = [{'name': 'Head' if n == 'head' else n, 'parent': ('Head' if R['bones'][n]['parent'] == 'head' else R['bones'][n]['parent']), 'rotation': [round(x, 7) for x in R['bones'][n]['rotation']]}
             for n in R['bone_names'] if n in R['bones']]
    order = [n for n in R['bone_names'] if n in R['bones']]
    head_idx = [R['bone_names'].index(n) for n in order]
    meta = {
        'source': 'MakeHuman / MPFB 2.0.17 (CC0 assets: the base mesh, its targets, the low-poly eyes, eyebrows, the system hairstyles, faceunits01, visemes01); scripts/makehuman/build.py; docs/makehuman.md',
        'hipY': HIP_Y, 'ages': AGES, 'levels': LEVELS,
        'parts': {p: {'start': int(starts[i]), 'count': int(sizes[i])} for i, p in enumerate(parts)},
        'brows': R['brows'], 'K': K, 'error': err,
        'bones': bones, 'boneRows': head_idx,
        'nodes': nodes, 'targets': targets, 'faceTargets': FACE_TARGETS, 'keys': keys, 'hair': hair,
        'ref': {'size': float(1 / R['s']), 'turn': R['turn'], 'headBox': head_box(z['body'][z['headw'] > 0.5])},
        'buffers': B.meta,
    }
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'body.bin'), 'wb') as f:
        f.write(b''.join(B.parts))
    with open(os.path.join(OUT, 'body.json'), 'w') as f:
        json.dump(meta, f, separators=(',', ':'))
    import gzip
    raw = b''.join(B.parts)
    log(f'body.bin {len(raw) / 1024:.0f} KB ({len(gzip.compress(raw, 9)) / 1024:.0f} KB gzip), body.json {os.path.getsize(os.path.join(OUT, "body.json")) / 1024:.0f} KB')
    sizes_by = {}
    for k, v in B.meta.items():
        g = k.split('_')[0] if not k.startswith('pc') else 'pc'
        sizes_by[g] = sizes_by.get(g, 0) + v['length'] * np.dtype(v['type']).itemsize
    log('by part (KB):', {k: round(v / 1024) for k, v in sorted(sizes_by.items(), key=lambda x: -x[1])})
