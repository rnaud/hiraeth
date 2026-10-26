"""Void navigator (#590): close-cut navy jacket and articulated ivory navigation harness."""
import math
import bpy
import numpy as np
from mathutils import Vector
import outfit_approved_kit as A
import outfit_kit as K
import tailor as T
from outfit_sea_tailoring import cloth_relief, projected, strap_on, triangle_on, surface_weights, hug_band
from outfit_gravity_ranger import tailored_jacket, tailored_trousers, surface, strap, disc, boot_panels, garment_weights, arm_cuffs, panel

ID='void-navigator'
ATLAS_SIZE=1024
NAME='Void navigator'
SHEET='references/characters/traveller-outfits/void-navigator/approved-reference.png'
PAL=dict(navy=(53,65,91),black=(47,49,48),trouser=(86,86,88),cream=(227,219,197),
         metal=(82,91,91),cyan=(112,218,225),boot=(222,216,198),ink=(31,35,41))
BOOTS='NavigatorBoots'
PIECES={'NavigatorTrousers':A.piece(covers=['NavigatorJacket']),
        'NavigatorJacket':A.piece(2,outside=['NavigatorTrousers'],gap=0.007)}
ZONES={'NavigatorTrousers':['trouser'],'NavigatorJacket':['navy','navy','navy'],
       'NavigationHarness':['cream','metal','cyan'],'NavigationBelt':['cream','metal','cyan'],
       'NavigationBootPanels':['cream','metal','cyan'],'NavigationCuffs':['navy','cyan'],   # (#680: forearm plates in the sleeve's navy, as the sheet)
       BOOTS:['boot']}
BUILDERS={'NavigatorTrousers':lambda c,j:tailored_trousers(c,j,0.006),
          'NavigatorJacket':lambda c,j:tailored_jacket(c,j,0.009,1.065)}


def segments(bm,coat,cage,a,b,back=False,width=0.023):
    # Separate hard segments joined by dark flexures, so it reads as fitted equipment rather than painted straps.
    aa=np.array(a);bb=np.array(b)
    direction=bb-aa;cross=np.array([-direction[1],direction[0]])
    cross=cross/np.linalg.norm(cross)*width*.87
    outline=[surface(cage,float(q[0]),float(q[1]),back) for q in [aa-cross,aa+cross,bb+cross,bb-cross]]
    panel(bm,coat,outline,mat=1,offset=.006,n=4)
    # (#680: one continuous ivory strap a run, as the sheet's, its studs at the ends: no dark flexures between)
    for t0,t1 in [(0,1)]:
        p0=aa*(1-t0)+bb*t0;p1=aa*(1-t1)+bb*t1
        direction=p1-p0;cross=np.array([-direction[1],direction[0]])
        cross=cross/np.linalg.norm(cross)*width
        corners=[p0-cross*.88,p0+cross*.88,p1+cross,p1-cross]
        outline=[surface(cage,float(q[0]),float(q[1]),back) for q in corners]
        panel(bm,coat,outline,offset=.017,n=4 if t1==1 else 2)
        for t in [.05,.95]:
            x=p0[0]*(1-t)+p1[0]*t;z=p0[1]*(1-t)+p1[1]*t
            p,n=projected(coat,surface(cage,x,z,back),.022)
            T.lathe(bm,p,n,[(0,.0025),(.0015,.0025)],segments=10,mat=1)


def harness(ctx):
    bm=A.empty();c=ctx['cage'];coat=ctx['made']['NavigatorJacket']
    for s in [-1,1]:
        segments(bm,coat,c,(s*.115,1.445),(s*.019,1.292))
        segments(bm,coat,c,(s*.019,1.255),(s*.115,1.10))
        segments(bm,coat,c,(s*.115,1.445),(s*.018,1.285),True)
        front=surface(c,s*.115,1.445,False,.039);back=surface(c,s*.115,1.445,True,.039)
        pts=[front,Vector((s*.115,front.y*.4,1.475)),Vector((s*.115,0.02,1.48)),Vector((s*.115,back.y*.7,1.465)),back]
        strap_on(bm,coat,pts,width=.040,mat=0)
        # Raised seam down the outer edge of each shoulder strap.
        pts2=[p+Vector((s*.015,0,.005)) for p in pts]
        strap_on(bm,coat,pts2,width=.0024,mat=1)
    segments(bm,coat,c,(0,1.255),(0,1.08),True,width=.018)
    p,n=projected(coat,surface(c,0,1.275,False),.012)
    disc(bm,p,n,.032)
    p,n=projected(coat,surface(c,0,1.275,True),.012)
    disc(bm,p,n,.025)
    # Slim status windows secured on the chest and between the shoulder blades.
    for x,z,back in [(.082,1.403,False),(0,1.405,True)]:
        pts=[surface(c,x,z-.027,back,.026),surface(c,x,z+.027,back,.026)]
        strap_on(bm,coat,pts,width=.006,mat=2)
    return bm,garment_weights(bm,ctx,coat)


def belt(ctx):
    bm=A.empty();c=ctx['cage']
    K.band(bm,c,A.PART['torso'],.985,1.018,.03,n=56,thick=.005,mat=0)
    hug_band(bm,[ctx['made']['NavigatorJacket'],ctx['made']['NavigatorTrousers']])
    p=surface(c,-.09,1.0,False,.043)
    disc(bm,p,(0,-1,0),.035)
    # A compact side module and the belt's fastening tongue, resting on the belt rather than floating off it.
    p=surface(c,.10,1.0,False,.039)
    K.box(bm,p,(.045,.009,.028),bevel=.004,mat=1)
    K.box(bm,p+Vector((0,-.006,0)),(.033,.004,.018),bevel=.002,mat=0)
    return bm,garment_weights(bm,ctx,ctx['made']['NavigatorJacket'])

PROPS={'NavigationCuffs':dict(build=lambda c:arm_cuffs(c,'NavigatorJacket'),layer=3,hem=None),
       'NavigationHarness':dict(build=harness,layer=3,hem=None),
       'NavigationBelt':dict(build=belt,layer=3,hem=None),
       'NavigationBootPanels':dict(build=boot_panels,layer=3,hem=None)}
RELIEF={'NavigatorJacket':[cloth_relief('shirt'),
    T.raised(T.strap((-.125,0,1.08),(-.075,0,1.14),(0,-1,0),.005),height=.003,facing=(0,-1,0)),
    T.raised(T.strap((.125,0,1.08),(.075,0,1.14),(0,-1,0),.005),height=.003,facing=(0,-1,0))],
    'NavigatorTrousers':[cloth_relief('trousers'),
    T.raised(T.rect((-.145,0,.825),(1,0,0),(0,0,1),.027,.075),height=.0025,facing=(0,-1,0)),
    T.raised(T.rect((.145,0,.825),(1,0,0),(0,0,1),.027,.075),height=.0025,facing=(0,-1,0))]}
SHADE={name:None for name in ZONES}
SKIN_CUT=[]
KEEP_AREAS=['neck']


def paint(piece,zone,P,N,J):
    out=A.seam_paint(PAL,ZONES,piece,zone,P,N,J);x,y,z=P.T
    front=np.clip(-N[:,1]*3,0,1)
    if piece=='NavigatorJacket':
        # (#680: the sheet's sleeves navy to a narrow ivory band at the wrist)
        brace=(np.abs(x)>.595)*(z>1.25)
        out=out*(1-brace[:,None])+np.array(PAL['cream'])/255*brace[:,None]
        # The dark front inset and zip are narrow, backed by the continuous jacket.
        inset=(np.abs(x)<.040)*(z>1.045)*(z<1.46)*front
        out=out*(1-inset[:,None])+np.array(PAL['black'])/255*inset[:,None]
        zipline=K.band_mask(x,.001,.0006)*front*(z>1.045)*(z<1.47)
        out=out*(1-zipline[:,None]) + np.array(PAL['metal'])/255*zipline[:,None]
        stitch=(K.band_mask(np.abs(x)-.064,.0008,.0005)+K.band_mask(np.abs(x)-.14,.0008,.0005))*front*(z>1.05)*(z<1.3)
        out*=1-np.clip(stitch,0,1)[:,None]*.35
    if piece=='NavigatorTrousers':
        # Narrow cyan inset at each secured thigh pocket; angular reinforced knees stay dark.
        line=K.band_mask(np.abs(x)-.145,.0018,.0007)*(z>.81)*(z<.88)*front
        out=out*(1-line[:,None])+np.array(PAL['cyan'])/255*line[:,None]
        # (#680: the sheet's lighter grey knee panels, angled, and its cyan strip down the thigh)
        knee=(z>.42+.25*np.abs(np.abs(x)-.12))*(z<.60-.2*np.abs(np.abs(x)-.12))*front
        out=out*(1-knee[:,None]*.6)+np.array((128,128,128))/255*knee[:,None]*.6
        strip=K.band_mask(np.abs(x)-.165,.002,.0008)*(z>.62)*(z<.78)*front
        out=out*(1-strip[:,None])+np.array(PAL['cyan'])/255*strip[:,None]
    return out
