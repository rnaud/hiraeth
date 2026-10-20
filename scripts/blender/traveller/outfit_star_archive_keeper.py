"""Approved compact star archive keeper (#590), tailored on the v2 body.

Plum fitted jacket, ivory asymmetric yoke/standing collar, dark teal trousers,
gold inlaid seams and a secured faceted archive crystal at the waist.
"""
import math
import bmesh
import bpy
import numpy as np
from mathutils import Vector
import garments as G
import outfit_kit as K
import outfit_approved_kit as A
import tailor as T
import rig as R

ID='star-archive-keeper'
ATLAS_SIZE = 1024
NAME='Star archive keeper'
SHEET='references/characters/traveller-outfits/star-archive-keeper/approved-reference.png'
PAL=dict(plum=(115,85,117),ivory=(232,218,185),teal=(48,78,80),gold=(221,171,71),
         leather=(147,133,101),crystal=(161,198,207),rose=(191,153,175),boot=(210,194,159),ink=(37,32,38))
BOOTS='ArchiveBoots'
PIECES={'ArchiveTrousers':A.piece(covers=['ArchiveJacket']),
        'ArchiveJacket':A.piece(2,outside=['ArchiveTrousers'],covers=['ArchiveYoke'],gap=0.007)}
ZONES={'ArchiveTrousers':['teal'],'ArchiveJacket':['plum','ivory'],
       'ArchiveYoke':['ivory'],'ArchiveCollar':['ivory','gold'],
       'ArchiveBelt':['leather','gold','crystal','rose'],BOOTS:['boot']}


def jacket(cage,J):
    bm=A.shirt(cage,J,sleeve=0.58,fullness=0.010,cuff_roll=0.003,cuff_return=0.012,collar=False)
    return bm


def yoke(ctx):
    bm=A.empty(); jacket=ctx['made']['ArchiveJacket']
    # The ivory facing stays between the shoulder seams, folding asymmetrically
    # down the chest; the fitted jacket's shoulder caps remain plum.
    for corners in [
        [(-.055,-.12,1.475),(.055,-.12,1.475),(-.095,-.15,1.405)],
        [(.055,-.12,1.475),(-.095,-.15,1.405),(.055,-.15,1.315)],
        [(.055,-.12,1.475),(.055,-.15,1.315),(.105,-.13,1.435)],
        [(-.055,.15,1.475),(.055,.15,1.475),(-.105,.16,1.425)],
        [(.055,.15,1.475),(-.105,.16,1.425),(0,.16,1.385)],
        [(.055,.15,1.475),(0,.16,1.385),(.105,.16,1.425)],
    ]:A.facing_patch(bm,jacket,corners,n=9,offset=.008)
    return bm


BUILDERS={'ArchiveTrousers':lambda c,j:A.trousers(c,j,0.018),
          'ArchiveJacket':jacket}


def collar(ctx):
    bm=A.empty()
    # Standing fabric collar, open under the chin, with a folded upper edge.
    rings=[]
    for radius,z in [(0.063,1.455),(0.066,1.505),(0.063,1.515),(0.059,1.505)]:
        rings.append([bm.verts.new((radius*math.cos(a),0.014+radius*math.sin(a),z))
                      for a in np.linspace(-math.pi/2+0.20,3*math.pi/2-0.20,30)])
    for a,b in zip(rings,rings[1:]):
        for k in range(29):bm.faces.new((a[k],a[k+1],b[k+1],b[k]))
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    for x in [-0.09,0.09]:
        K.box(bm,(x,-0.069,1.445),(0.021,0.008,0.026),bevel=0.003,mat=1)
    return bm


def belt(ctx):
    bm=A.empty()
    K.band(bm,ctx['cage'],A.PART['torso'],1.005,1.045,0.035,n=40,thick=0.006)
    pts,c=K.ring_of(ctx['cage'],A.PART['torso'],1.025)
    p,d=K.on_ring(pts,c,-math.pi/2,0.047,1.025)
    # Octagonal metal frame and triangular crystal facets. This remains firmly
    # attached to the belt instead of swinging from a cord.
    outline=[(-.030,-.040),(.030,-.040),(.040,-.026),(.040,.026),
             (.025,.044),(-.025,.044),(-.040,.026),(-.040,-.026)]
    back=[bm.verts.new(p+Vector((x,0,z))) for x,z in outline]
    rim=[bm.verts.new(p+Vector((x*.82,-.009,z*.84))) for x,z in outline]
    peak=bm.verts.new(p+Vector((.003,-.024,0)))
    for k in range(8):
        f=bm.faces.new((back[k],back[(k+1)%8],rim[(k+1)%8],rim[k]));f.material_index=1
        f=bm.faces.new((rim[k],rim[(k+1)%8],peak));f.material_index=2+k%2
    bm.faces.new(list(reversed(back))).material_index=0
    for side in [-1,1]:
        K.box(bm,p+Vector((side*.077,.004,0)),(.025,.008,.035),bevel=.004,mat=1)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    return bm


PROPS={'ArchiveYoke':dict(build=yoke,layer=3,hem=.003),
       'ArchiveCollar':dict(build=collar,bone='spine_03',layer=3,hem=0.004),
       'ArchiveBelt':dict(build=belt,bone='pelvis',layer=3,hem=None)}
RELIEF={'ArchiveJacket':[A.cloth_relief('shirt',0.7)],
        'ArchiveTrousers':[A.cloth_relief('trousers',0.8)]}
SHADE={name:None for name in ZONES}
SKIN_CUT=[]


def reweight(name,ob,arm,J):
    if name=='ArchiveYoke':
        R.set_weights(ob,K.copy_weights(ob,bpy.data.objects['ArchiveJacket']))


def paint(piece,zone,P,N,J):
    out=A.seam_paint(PAL,ZONES,piece,zone,P,N,J)
    x,y,z=P.T
    ax=np.abs(x)
    front=np.clip(-N[:,1]*3,0,1)
    gold=np.array(PAL['gold'])/255
    if piece=='ArchiveJacket':
        # Thin gold construction inlays follow the front wrap and sleeve panels.
        line=K.band_mask(x-(0.01+(1.38-z)*0.19),0.005,0.001)*front*(ax<.20)*(z<1.39)*(z>1.02)
        line+=K.band_mask(y-0.015,0.004,0.001)*(ax>.24)*np.clip(N[:,2]*3,0,1)
        out=out*(1-np.clip(line,0,1)[:,None])+gold*np.clip(line,0,1)[:,None]
        cuff=(ax>.53).astype(float)
        out=out*(1-cuff[:,None])+np.array(PAL['ivory'])/255*cuff[:,None]
    elif piece=='ArchiveTrousers':
        line=K.band_mask(y-0.025,0.004,0.001)*np.clip(np.abs(N[:,0])*2,0,1)*(z>.3)*(z<.92)
        out=out*(1-line[:,None])+gold*line[:,None]
    if piece == 'ArchiveJacket': out=A.cloth_ink(out,P,J,PAL,'shirt')
    elif piece == 'ArchiveTrousers': out=A.cloth_ink(out,P,J,PAL,'trousers')
    return np.clip(out,0,1)
