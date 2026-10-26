"""Approved storm courier, #588: fitted rain jacket, folded hood, hip pouch."""
import numpy as np
import bmesh
import bpy
import rig as R
import outfit_sea_tailoring as S
from mathutils import Vector
import outfit_approved_kit as A
import outfit_kit as K
import garments as G
import tailor as T

ID = 'storm-courier'
ATLAS_SIZE = 1024
NAME = 'Storm courier'
SHEET = 'references/characters/traveller-outfits/storm-courier/approved-reference.png'
PAL = dict(rain=(136,164,150), cream=(226,211,177), trouser=(106,105,108),
           leather=(137,117,76), brass=(190,158,94), boot=(185,165,127), ink=(42,47,40))
BOOTS = 'CourierBoots'
PIECES = {'CourierTrousers':A.piece(covers=['RainJacket']),
          'RainJacket':A.piece(2,outside=['CourierTrousers'],gap=0.008)}
ZONES = {'CourierTrousers':['trouser'], 'RainJacket':['rain','cream'],
         'FoldedHood':['rain'], 'CourierPouch':['leather','brass'],
         'Toggles':['leather','brass'], BOOTS:['boot']}
BUILDERS = {'CourierTrousers':lambda c,j:A.trousers(c,j,0.020),
            'RainJacket':lambda c,j:A.shirt(c,j,sleeve=0.54,fullness=0.019)}
# (#680: the sheet's cream shirt shows at the collar and in rolled sleeves under the jacket's: its bands cream)
INSIDE_ZONES = {'RainJacket': ('cream', 0.92)}


def hood(ctx):
    bm=A.empty()
    jacket=bpy.data.objects['RainJacket']
    # A folded hood has a wide shoulder rim and a tapered low point. Both
    # layers follow the jacket; the slight centre ridge is sewn cloth volume.
    rows=[]
    for j in range(13):
        t=j/12
        width=.150*(1-t)+.020*t
        row=[]
        for k in range(17):
            u=(k/16)*2-1
            p=Vector((u*width,.20,1.445-.200*t+.010*u*u))
            q,n=S.projected(jacket,p,.012)
            q+=n*(.006+.034*(1-u*u)*np.sin(np.pi*min(1,.15+t*1.2)))
            row.append(bm.verts.new(q))
        rows.append(row)
    for j in range(12):
        for k in range(16):
            bm.faces.new((rows[j][k],rows[j+1][k],rows[j+1][k+1],rows[j][k+1]))
    # Sewn folded rim supplies a readable hood opening, secured at the collar.
    T.ribbon(bm,[v.co.copy() for v in rows[0]],lambda p:S.projected(jacket,p,0)[1],.009,thick=.003)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    return bm


def toggles(ctx):
    bm=A.empty()
    for x,z in [(0.02,1.37),(0.055,1.285)]:
        pts,c=K.ring_of(ctx['cage'],A.PART['torso'],z)
        p,d=K.on_ring(pts,c,-np.pi/2,0.043,z)
        p.x=x
        p,d=S.projected(bpy.data.objects['RainJacket'],p,.007)
        K.box(bm,p,(0.067,0.012,0.020),bevel=0.005,mat=0)
        for dx in [-0.022,0.022]:
            K.torus(bm,p+Vector((dx,-0.008,0)),(0,-1,0),0.004,0.0015,seg=12,sides=4,mat=1)
    return bm


def pouch(ctx):
    bm=A.empty()
    pts,c=K.ring_of(ctx['cage'],A.PART['torso'],1.01)
    p,d=K.on_ring(pts,c,-0.58,0.048,0.96)
    rot=K.face_rot(d)
    K.box(bm,p,(0.11,0.047,0.12),rot,bevel=0.012)
    K.box(bm,p+d*0.028+Vector((0,0,0.027)),(0.115,0.012,0.055),rot,bevel=0.008)
    K.torus(bm,p+d*0.038,(d.x,d.y,0),0.012,0.003,seg=16,sides=6,mat=1)
    return bm


PROPS = {'FoldedHood':dict(build=hood,bone='spine_03',layer=3,hem=None),
         'Toggles':dict(build=toggles,bone='spine_03',layer=3,hem=None),
         'CourierPouch':dict(build=pouch,bone='pelvis',layer=3,hem=None)}
SHADE = {name:None for name in ZONES}
SKIN_CUT = []
RELIEF = {'RainJacket':[A.cloth_relief('shirt')],
          'CourierTrousers':[A.cloth_relief('trousers')]}


def paint(piece,zone,P,N,J):
    out=A.seam_paint(PAL,ZONES,piece,zone,P,N,J)
    if piece=='RainJacket':
        # The diagonal storm flap is secured flush along its seam.
        x,y,z=P.T
        seam=K.band_mask(x-(1.40-z)*0.48,0.0013,0.0008)*np.clip(-N[:,1]*3,0,1)*(z>1.05)*(z<1.40)
        out=out*(1-seam[:,None]*0.65)+np.array(PAL['ink'])/255*seam[:,None]*0.65
        # (#680: the jacket's sleeve ends at the elbow, the cream shirt's rolled sleeve below it)
        cuff=np.clip((np.abs(x)-0.435)/0.006,0,1)
        out=out*(1-cuff[:,None])+np.array(PAL['cream'])/255*cuff[:,None]
    if piece == 'RainJacket': out=A.cloth_ink(out,P,J,PAL,'shirt')
    elif piece == 'CourierTrousers': out=A.cloth_ink(out,P,J,PAL,'trousers')
    return out


def reweight(name,ob,arm,J):
    if name in ('FoldedHood','Toggles'):
        R.set_weights(ob,K.copy_weights(ob,bpy.data.objects['RainJacket']))
