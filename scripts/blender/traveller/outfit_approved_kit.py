"""Tailoring shared by the five approved October 20 outfits (#588).

Cut on the existing traveller cage, retain its rig and hands. New cloth albedo
uses flat colour and fine seam marks, without baked directional illumination.
"""
import math
import bmesh
import numpy as np
from mathutils import Vector
import garments as G
import outfit_kit as K
import tailor as T
from loft import smoothstep

PART = G.PART


def orient(bm):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    score = sum(f.normal.dot(sum((G.normal(bm, v) for v in f.verts), Vector())) for f in bm.faces)
    if score < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    return bm


def shirt(cage, J, sleeve=0.46, fullness=0.012, cuff_roll=0.009, cuff_return=0.023, collar=True):
    """Rolled forearm sleeves, fitted torso and a small folded shirt collar."""
    bm = G.cut(cage, lambda v, p: (p == PART['torso'] and v.co.z >= 0.94)
               or (p == PART['arm'] and abs(v.co.x) <= sleeve))
    G.inflate(bm, lambda p, part: fullness + (0.007 if part == PART['arm'] else 0.003))
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z > 1.30 and abs(c.x) < 0.12:
            if not collar: continue
            out = G.radial((0, c.y))
            stand = G.extrude(bm, loop, lambda p, v: p + Vector((0, 0, 0.018)) + out(p) * 0.004)
            fold = G.extrude(bm, stand, lambda p, v: p + out(p) * 0.014 - Vector((0, 0, 0.025)))
            for f in bm.faces:
                if all(v in set(stand + fold) for v in f.verts):
                    f.material_index = 1
        elif abs(c.x) > 0.25:
            # Soft rolled cuff; loop normals follow the arm's original rest axis.
            radial = lambda p: (p - Vector((p.x, c.y, c.z))).normalized()
            sx = math.copysign(1, c.x)
            roll = G.extrude(bm, loop, lambda p, v: p + radial(p) * cuff_roll + Vector((sx * 0.009, 0, 0)))
            end = G.extrude(bm, roll, lambda p, v: p - Vector((sx * cuff_return, 0, 0)))
            for f in bm.faces:
                if all(v in set(loop + roll + end) for v in f.verts):
                    f.material_index = 1
    return orient(bm)


def trousers(cage, J, fullness=0.012):
    """Connected trousers with gathered ankles; no intersecting tube patches."""
    bm = G.cut(cage, lambda v, p: (p == PART['torso'] and v.co.z <= 1.09)
               or (p == PART['leg'] and v.co.z >= 0.235))
    G.inflate(bm, lambda p, part: 0.010 + fullness * smoothstep(0.25, 0.42, p.z))
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z > 0.7:
            continue
        out = G.radial((c.x, c.y))
        rim = G.extrude(bm, loop, lambda p, v: p + out(p) * 0.005 + Vector((0, 0, 0.004)))
        G.extrude(bm, rim, lambda p, v: p + Vector((0, 0, 0.025)))
    return orient(bm)


def vest(cage, J, gap=0.030, hem=0.98, opening=0.025):
    bm = G.cut(cage, lambda v, p: p == PART['torso'] and v.co.z >= 0.94,
               keep_face=lambda f: not (f.calc_center_median().y < 0 and
                   abs(f.calc_center_median().x) < opening +
                   max(0, f.calc_center_median().z - 1.22) * 0.30))
    G.inflate(bm, lambda p, part: gap)
    for v in bm.verts:
        if v.co.z < 1.02:
            v.co.z += (hem - 0.94) * smoothstep(1.02, 0.94, v.co.z)
    return orient(bm)


def empty():
    bm = bmesh.new()
    bm.verts.layers.int.new('part')
    for k in ('nx', 'ny', 'nz'):
        bm.verts.layers.float.new(k)
    return bm


def seam_paint(palette, zones, piece, zone, P, N, J):
    """Neutral flat albedo: restrained grain, seams and stitching only."""
    colors = np.array([palette[k] for k in zones[piece]], dtype=float) / 255
    out = colors[np.clip(zone.astype(int), 0, len(colors) - 1)]
    x, y, z = P.T
    ink = np.array(palette['ink']) / 255
    front = np.clip(-N[:, 1] * 3, 0, 1)
    # Narrow construction seams; no broad lighting or AO colour fields.
    if 'Shirt' in piece:
        line = K.band_mask(x, 0.0012, 0.0008) * front * (z > 1.0) * (z < 1.42)
        out = out * (1 - line[:, None] * 0.65) + ink * line[:, None] * 0.65
    if 'Trousers' in piece or 'Overalls' in piece:
        line = K.band_mask(x, 0.0012, 0.0008) * front * (z > 0.88) * (z < 1.08)
        out = out * (1 - line[:, None] * 0.6) + ink * line[:, None] * 0.6
    out *= 0.985 + np.random.default_rng(588).random((len(P), 1)) * 0.025
    return np.clip(out, 0, 1)


def piece(layer=1, outside=(), covers=(), levels=2, gap=0.006, hem=0.015, **kw):
    return dict(layer=layer, outside=list(outside), covers=list(covers), levels=levels, gap=gap, hem=hem, **kw)


def cloth_relief(kind, amount=1.0):
    """Sculpt shallow fabric gathers into the fitted subdivided surface.

    Sleeve creases fan around the elbow; trouser folds gather over the knee and
    ankle, with long side drapes. These are geometry, not painted illumination.
    The neckline, wrists and garment hems remain pinned.
    """
    def apply(ob, J):
        P=T._coords(ob.data)
        N=T._normals(ob.data)
        x,y,z=P.T
        ax=np.abs(x)
        d=np.zeros(len(P))
        def ridge(distance,width,amp):
            return amp*np.exp(-(distance/width)**2)
        if kind=='shirt':
            arm=T.smooth01(0.22,0.29,ax)*T.smooth01(0.58,0.47,ax)
            for at,amp in [(0.315,0.004),(0.360,0.006),(0.405,0.004)]:
                d+=ridge(ax-at+(z-1.36)*0.35+(y-0.02)*0.28,0.012,amp)*arm
            torso=T.smooth01(0.23,0.16,ax)*T.smooth01(0.95,1.02,z)*T.smooth01(1.38,1.28,z)
            # Long shallow cloth folds toward the waist, not a regular ribbed tube.
            for side in [-1,1]:
                line=x-side*(0.08+0.035*(1.25-z))
                d+=ridge(line,0.020,0.004)*torso
            d+=ridge(z-(1.10+0.18*x),0.012,0.004)*torso
        else:
            leg=(z<0.88).astype(float)
            for at,amp in [(0.47,0.004),(0.52,0.006),(0.565,0.0035)]:
                d+=ridge(z-at+np.sign(x)*(x-np.sign(x)*0.12)*0.45+y*0.25,0.013,amp)*leg
            d+=ridge(z-0.28+y*0.4,0.015,0.005)*leg
            # A long fold outside each shin, fading before the ankle and hips.
            side=np.clip(np.abs(N[:,0]),0,1)
            d+=ridge(y-0.025,0.018,0.004)*side*T.smooth01(0.24,0.32,z)*T.smooth01(0.88,0.75,z)
        d*=amount
        T._move(ob.data,N*d[:,None])
        return {'sculpted':int((d>0.0005).sum()),'maximumMm':round(float(d.max())*1000,2)}
    apply.__name__='cloth_'+kind
    return apply


def cloth_ink(out, P, J, palette, kind, strength=0.55):
    """Neutral construction/fold strokes, without the painter's AO or lighting."""
    import inkpaint as IP
    if kind == 'shirt':
        (a,b),st=IP.elbow_folds(J,n=3)
        line,_=IP.limb_strokes(P,a,b,st,width=.0008)
        line*=T.smooth01(.26,.30,np.abs(P[:,0]))
    else:
        (a,b),st=IP.knee_folds(J,n=3)
        line,_=IP.limb_strokes(P,a,b,st,width=.0008)
        drape,_=IP.drapes(P,J,[-.65,.85],(.15,.65),width=.0007)
        line=np.maximum(line,drape*.45)
    alpha=np.clip(line*strength,0,1)[:,None]
    return out*(1-alpha)+np.asarray(palette['ink'])/255*alpha


def facing_patch(bm, ob, corners, mat=0, offset=.007, n=9):
    """Tailored facing projected along front/back, preserving its drawn outline.

    Nearest-point projection shrinks a flat pattern toward the chest centre;
    ray projection preserves its x/z cut while following the actual cloth.
    """
    front=sum(p[1] for p in corners)<0
    direction=Vector((0,1 if front else -1,0))
    def project(p):
        origin=Vector((p.x,-1 if front else 1,p.z))
        hit,q,normal,_=ob.ray_cast(origin,direction)
        if not hit:
            hit,q,normal,_=ob.closest_point_on_mesh(p)
        return q+normal*offset,normal
    a,b,c=map(Vector,corners);rows={};faces=[]
    for i in range(n+1):
        for j in range(n+1-i):
            p=a+(b-a)*(i/n)+(c-a)*(j/n)
            rows[i,j]=bm.verts.new(project(p)[0])
    for i in range(n):
        for j in range(n-i):
            f=bm.faces.new((rows[i,j],rows[i+1,j],rows[i,j+1]));faces.append(f)
            if j<n-i-1:faces.append(bm.faces.new((rows[i+1,j],rows[i+1,j+1],rows[i,j+1])))
    bm.normal_update()
    for f in faces:
        f.material_index=mat
        if f.normal.dot(project(f.calc_center_median())[1])<0:f.normal_flip()
