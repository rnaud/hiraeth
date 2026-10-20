"""Approved solar voyager, #590: coral suit, segmented ivory shells and solar cell."""
import math
from functools import partial
import numpy as np
from mathutils import Vector
import outfit_approved_kit as A
import outfit_kit as K
import outfit_sea_tailoring as D
import outfit_solar_comet_kit as H
import tailor as T

ATLAS_SIZE = 1024
ID='solar-voyager'
NAME='Solar voyager'
SHEET='references/characters/traveller-outfits/solar-voyager/approved-reference.png'
PAL=dict(coral=(205,117,89),ivory=(225,216,187),ochre=(208,156,68),
         brass=(173,128,49),amber=(245,170,48),dark=(70,63,49),boot=(216,205,176),ink=(52,43,33))
PANEL=partial(H.panel,projection='depth')
BOOTS='SolarBoots'
PIECES={'SolarTrousers':A.piece(covers=['SolarSuit']),
        'SolarSuit':A.piece(outside=['SolarTrousers'],gap=.007)}
ZONES={'SolarTrousers':['coral'],'SolarSuit':['coral'],
       'SolarHarness':['ivory','brass','ochre'],'SolarBracers':['ivory','brass','coral'],
       'SolarBelt':['ivory','brass'],'SolarCell':['brass','amber','dark'],BOOTS:['boot']}
BUILDERS={'SolarTrousers':lambda c,j:A.trousers(c,j,.008),'SolarSuit':H.suit}
RELIEF={'SolarSuit':[D.cloth_relief('shirt',.3),H.seams],'SolarTrousers':[D.cloth_relief('trousers',.35)]}


def harness(ctx):
    bm=A.empty(); ob=ctx['made']['SolarSuit']
    # Overlapping diagonal breast plates, split at the flexible abdomen.
    PANEL(bm,ob,[(-.135,-.16,1.42),(-.045,-.17,1.445),(.135,-.17,1.315),
                   (.105,-.18,1.25),(.065,-.18,1.255),(-.05,-.17,1.30),(-.12,-.17,1.34)])
    PANEL(bm,ob,[(-.06,-.18,1.29),(.105,-.18,1.215),(.065,-.16,1.15),(-.015,-.16,1.085),(-.025,-.17,1.115),
                   (-.10,-.17,1.17)])
    for s in [-1,1]:
        PANEL(bm,ob,[(s*.025,.15,1.435),(s*.15,.12,1.40),(s*.14,.16,1.25),
                       (s*.04,.17,1.18),(s*.02,.16,1.29)])
        H.shoulder_shell(bm,ob,s)
    for p in [(-.1,-.25,1.39),(.08,-.25,1.29),(-.075,-.25,1.16),(0,.25,1.39)]:
        H.rivet(bm,ob,p,r=.015,inset=True)
    return bm,D.garment_weights(bm,ctx,ob)


def belt(ctx):
    bm=A.empty()
    K.band(bm,ctx['cage'],A.PART['torso'],1.0,1.035,.04,n=40,thick=.005)
    D.hug_band(bm,[ctx['made']['SolarSuit'],ctx['made']['SolarTrousers']],gap=.009)
    p,n=D.projected(ctx['made']['SolarSuit'],(0,-.3,1.02),.015)
    K.torus(bm,p,n,.014,.003,seg=18,sides=6,mat=1)
    return bm,D.garment_weights(bm,ctx,ctx['made']['SolarSuit'])


def cell(ctx):
    bm=A.empty(); base=Vector((.20,-.035,.94))
    T.lathe(bm,base,(0,0,1),[(0,.021),(.012,.026),(.022,.022),(.098,.022),(.11,.026),(.12,.021)],
            segments=20,mat=0)
    T.lathe(bm,base+Vector((0,-.003,.025)),(0,0,1),[(0,.023),(.07,.023)],segments=20,mat=1)
    for angle in [0,math.pi/2,math.pi,3*math.pi/2]:
        x,y=.027*math.cos(angle),.027*math.sin(angle)
        K.box(bm,base+Vector((x,y,.06)),(.006,.006,.10),bevel=.0015,mat=0)
    K.torus(bm,base+Vector((0,0,.02)),(0,0,1),.026,.003,seg=20,sides=6)
    K.torus(bm,base+Vector((0,0,.10)),(0,0,1),.026,.003,seg=20,sides=6)
    # Two clips attach the protected cell to the belt/hip, not a floating lantern.
    for z in [.025,.10]:
        K.box(bm,base+Vector((-.02,.025,z)),(.025,.035,.012),bevel=.003,mat=2)
    return bm


PROPS={'SolarHarness':dict(build=harness,layer=3,hem=None),
       'SolarBracers':dict(build=lambda c:H.limb_panels(c,'SolarSuit','SolarTrousers'),layer=3,hem=None),
       'SolarBelt':dict(build=belt,layer=3,hem=None),
       'SolarCell':dict(build=cell,bone='pelvis',layer=3,hem=None)}
SHADE={name:None for name in ZONES}
SKIN_CUT=[]


def paint(piece,zone,P,N,J):
    out=H.neutral_paint(PAL,ZONES,piece,zone,P,N,J)
    x,y,z=P.T
    if piece in ['SolarSuit','SolarTrousers']:
        side=(np.abs(x)>.15)*(np.abs(N[:,0])>.45)
        if piece=='SolarSuit':
            side*=z>1.20
        else:
            side*=(z>.65)
        out=out*(1-side[:,None])+np.array(PAL['ochre'])/255*side[:,None]
        if piece=='SolarSuit':
            collar=z>1.45
            out[collar]=np.array(PAL['brass'])/255
            trim=K.band_mask(z-1.47,.0018,.001)*collar
            out=D.stitched(out,trim,PAL['dark'],.65)
    return np.clip(out,0,1)
