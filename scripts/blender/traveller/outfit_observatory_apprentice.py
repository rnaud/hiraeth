"""Approved observatory apprentice, #588: hip-length wrap jacket, secured brass tube."""
import math
import numpy as np
import bpy
import rig as R
from mathutils import Vector
import outfit_approved_kit as A
import outfit_kit as K
import tailor as T

ID='observatory-apprentice'
ATLAS_SIZE = 1024
NAME='Observatory apprentice'
SHEET='references/characters/traveller-outfits/observatory-apprentice/approved-reference.png'
PAL=dict(plum=(132,105,119),cream=(230,214,179),trouser=(57,78,70),
         leather=(137,98,50),brass=(177,147,80),boot=(173,151,114),ink=(43,37,36))
BOOTS='ApprenticeBoots'
PIECES={'ApprenticeTrousers':A.piece(covers=['WrapJacket']),
        'WrapJacket':A.piece(2,outside=['ApprenticeTrousers'],gap=0.008)}
ZONES={'ApprenticeTrousers':['trouser'],'WrapJacket':['plum','cream'],
       'Belt':['leather','brass'],'Instrument':['brass','leather','ink'],'Lapels':['cream'],BOOTS:['boot']}
BUILDERS={'ApprenticeTrousers':lambda c,j:A.trousers(c,j,0.020),
          'WrapJacket':lambda c,j:A.shirt(c,j,sleeve=0.57,fullness=0.014,cuff_roll=0.004,cuff_return=0.016)}


def belt(ctx):
    bm=A.empty()
    K.band(bm,ctx['cage'],A.PART['torso'],1.005,1.035,0.035,n=40,thick=0.005)
    pts,c=K.ring_of(ctx['cage'],A.PART['torso'],1.02)
    p,d=K.on_ring(pts,c,-math.pi/2,0.043,1.02)
    K.torus(bm,p,d,0.018,0.003,seg=20,sides=6,mat=1)
    return bm


def instrument(ctx):
    bm=A.empty()
    # Compact telescope held by two straps against the hip, never a swinging tail.
    p=Vector((0.22,-0.025,0.99))
    # Nested barrels, raised focusing collar and recessed dark lens; a cradle
    # joins the instrument to the belt instead of leaving a floating cylinder.
    T.lathe(bm,p+Vector((0,0,-.085)),(0,0,1),
            [(0,.021),(.006,.026),(.017,.026),(.020,.022),
             (.105,.022),(.109,.026),(.125,.026),(.130,.019),
             (.158,.019),(.162,.023),(.170,.023)],segments=24)
    T.lathe(bm,p+Vector((0,0,.0855)),(0,0,1),[(0,.018),(.001,.018)],segments=24,mat=2)
    for z in [-.045,.045]:
        T.lathe(bm,p+Vector((0,0,z)),(0,0,1),[(0,.023),(.012,.023)],segments=24,mat=1)
        K.box(bm,p+Vector((-.025,.018,z+.006)),(.026,.013,.018),bevel=.003,mat=1)
    K.box(bm,(.195,.001,1.028),(.035,.019,.034),bevel=.004,mat=1)
    return bm


PROPS={'Belt':dict(build=belt,bone='pelvis',layer=3,hem=None),
       'Instrument':dict(build=instrument,bone='pelvis',layer=3,hem=None)}
SHADE={name:None for name in ZONES}
SKIN_CUT=[]
RELIEF={'WrapJacket':[A.cloth_relief('shirt')],
        'ApprenticeTrousers':[A.cloth_relief('trousers')]}


def lapels(ctx):
    bm=A.empty(); shirt=ctx['made']['WrapJacket']
    A.facing_patch(bm,shirt,[(-.075,-.12,1.442),(.018,-.13,1.410),(-.022,-.15,1.322)],n=9)
    A.facing_patch(bm,shirt,[(.065,-.12,1.448),(.085,-.13,1.410),(.008,-.15,1.355)],n=7)
    return bm


PROPS['Lapels']=dict(build=lapels,layer=3,hem=.003)
SHADE['Lapels']=None


def reweight(name,ob,arm,J):
    if name=='Lapels':R.set_weights(ob,K.copy_weights(ob,bpy.data.objects['WrapJacket']))


def paint(piece,zone,P,N,J):
    out=A.seam_paint(PAL,ZONES,piece,zone,P,N,J)
    if piece=='WrapJacket':
        x,y,z=P.T
        front=np.clip(-N[:,1]*3,0,1)
        seam=K.band_mask(x+(1.42-z)*0.40,0.002,0.001)*front*(z>1.03)*(z<1.43)
        out=out*(1-seam[:,None]*0.75)+np.array(PAL['ink'])/255*seam[:,None]*0.75
        cuff=np.clip((np.abs(x)-0.51)/0.008,0,1)
        out=out*(1-cuff[:,None])+np.array(PAL['cream'])/255*cuff[:,None]
    if piece == 'WrapJacket': out=A.cloth_ink(out,P,J,PAL,'shirt')
    elif piece == 'ApprenticeTrousers': out=A.cloth_ink(out,P,J,PAL,'trousers')
    return out
