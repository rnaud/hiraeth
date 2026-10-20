"""Approved comet pathfinder, #590: diagonal teal shells and a secured navigation disc."""
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
ID='comet-pathfinder'
NAME='Comet pathfinder'
SHEET='references/characters/traveller-outfits/comet-pathfinder/approved-reference.png'
PAL=dict(cream=(229,214,181),coral=(201,114,89),teal=(102,137,127),
         cyan=(113,215,217),metal=(115,104,83),dark=(53,66,61),boot=(193,176,142),ink=(47,44,36))
PANEL=partial(H.panel,projection='depth')
BOOTS='PathfinderBoots'
PIECES={'PathfinderTrousers':A.piece(covers=['PathfinderSuit']),
        'PathfinderSuit':A.piece(outside=['PathfinderTrousers'],gap=.007)}
ZONES={'PathfinderTrousers':['cream'],'PathfinderSuit':['cream'],
       'CometHarness':['teal','dark','cyan'],'CometBracers':['teal','cyan','coral'],
       'PathfinderBelt':['metal','cyan'],'NavigationDisc':['metal','dark','cyan'],BOOTS:['boot']}
BUILDERS={'PathfinderTrousers':lambda c,j:A.trousers(c,j,.008),'PathfinderSuit':H.suit}
RELIEF={'PathfinderSuit':[D.cloth_relief('shirt',.3),H.seams],
        'PathfinderTrousers':[D.cloth_relief('trousers',.35)]}


def harness(ctx):
    bm=A.empty(); ob=ctx['made']['PathfinderSuit']
    PANEL(bm,ob,[(.115,-.15,1.445),(.15,-.17,1.32),(.025,-.18,1.255),
                   (-.09,-.17,1.145),(-.135,-.16,1.22),(-.065,-.18,1.34)])
    PANEL(bm,ob,[(-.13,.13,1.43),(.13,.13,1.40),(.10,.16,1.29),
                   (-.04,.17,1.19),(-.12,.15,1.29)])
    # Slim straps complete the load path around the shoulders and down to belt.
    for s in [-1,1]:
        D.strap_on(bm,ob,[(s*.11,-.15,1.4),(s*.145,-.025,1.46),
                          (s*.13,.12,1.4)],width=.018,mat=1)
    for p,r in [((.085,-.3,1.35),.015),((-.085,-.3,1.20),.011),((.06,.3,1.35),.014)]:
        q,n=D.projected(ob,p,.023)
        K.torus(bm,q,n,r,.003,seg=24,sides=6,mat=1)
        T.lathe(bm,q,n,[(0,r*.72),(.003,r*.72)],segments=24,mat=2)
    return bm,D.garment_weights(bm,ctx,ob)


def belt(ctx):
    bm=A.empty()
    K.band(bm,ctx['cage'],A.PART['torso'],1.005,1.031,.04,n=40,thick=.004)
    D.hug_band(bm,[ctx['made']['PathfinderSuit'],ctx['made']['PathfinderTrousers']],gap=.009)
    p,n=D.projected(ctx['made']['PathfinderSuit'],(0,-.3,1.02),.015)
    K.torus(bm,p,n,.012,.0025,seg=18,sides=6,mat=1)
    return bm,D.garment_weights(bm,ctx,ctx['made']['PathfinderSuit'])


def disc(ctx):
    bm=A.empty(); p=Vector((.20,-.04,1.00)); axis=Vector((.55,-.83,0)).normalized()
    T.lathe(bm,p,axis,[(0,.052),(.012,.058),(.025,.058),(.032,.048)],segments=32,mat=0)
    T.lathe(bm,p+axis*.034,axis,[(0,.040),(.004,.040)],segments=32,mat=1)
    K.torus(bm,p+axis*.04,axis,.033,.003,seg=32,sides=6,mat=2)
    for z in [-.045,.045]:
        K.box(bm,p+Vector((-.018,.015,z)),(.030,.035,.018),bevel=.004,mat=0)
    for a in [0,math.pi/2,math.pi,3*math.pi/2]:
        q=p+axis*.028+Vector((axis.y*math.cos(a)*.05,-axis.x*math.cos(a)*.05,math.sin(a)*.05))
        K.torus(bm,q,axis,.004,.0015,seg=10,sides=4,mat=1)
    return bm


PROPS={'CometHarness':dict(build=harness,layer=3,hem=None),
       'CometBracers':dict(build=lambda c:H.limb_panels(c,'PathfinderSuit','PathfinderTrousers',True),layer=3,hem=None),
       'PathfinderBelt':dict(build=belt,layer=3,hem=None),
       'NavigationDisc':dict(build=disc,bone='pelvis',layer=3,hem=None)}
SHADE={name:None for name in ZONES}
SKIN_CUT=[]


def paint(piece,zone,P,N,J):
    out=H.neutral_paint(PAL,ZONES,piece,zone,P,N,J)
    x,y,z=P.T
    if piece=='PathfinderSuit':
        coral=(np.abs(x)>.17)*(z>1.30)
        coral=np.maximum(coral,((z>1.42)|(np.abs(x)>.49))*.85)
        coral=np.maximum(coral,(np.abs(x)>.115)*(z<1.29)*(z>1.01))
        out=out*(1-coral[:,None])+np.array(PAL['coral'])/255*coral[:,None]
    elif piece=='PathfinderTrousers':
        side=(np.abs(N[:,0])>.5)*(z>.58)*(z<.97)
        out=out*(1-side[:,None])+np.array(PAL['coral'])/255*side[:,None]
    return np.clip(out,0,1)
