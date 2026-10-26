"""Void navigator (#590; #684: drawn to its Tripo figure's shape, its harness rebuilt where the figure has it, painted flat)."""
import math
import bpy
import numpy as np
from mathutils import Vector
import outfit_approved_kit as A
import outfit_kit as K
import tailor as T
from outfit_sea_tailoring import cloth_relief, projected, strap_on, hug_band
from outfit_gravity_ranger import tailored_jacket, tailored_trousers, disc, garment_weights, arm_cuffs, panel

ID='void-navigator'
ATLAS_SIZE=1024
NAME='Void navigator'
SHEET='references/characters/traveller-outfits/void-navigator/approved-reference.png'
# (#684) every colour is the sheet's own flat area (its median, sampled away from line work and shading); the
# game's ink and light do the shading
PAL=dict(navy=(78,79,96),black=(61,57,51),trouser=(89,82,76),knee=(121,112,102),cream=(237,218,194),
         metal=(118,115,104),cyan=(129,210,211),boot=(238,232,211),sole=(67,62,56),ink=(31,35,41))
BOOTS='NavigatorBoots'
PIECES={'NavigatorTrousers':A.piece(covers=['NavigatorJacket']),
        'NavigatorJacket':A.piece(2,outside=['NavigatorTrousers'],gap=0.007)}
ZONES={'NavigatorTrousers':['trouser'],'NavigatorJacket':['navy','navy','navy'],
       'NavigationHarness':['cream','metal','cyan','black'],'NavigationBelt':['cream','metal','cyan','black'],
       'NavigationCuffs':['navy','cyan'],BOOTS:['boot']}
PAINT_BOOTS=True       # (#684: his boots painted flat in the sheet's colours, not the base atlas's shading)
# (#684) the shape target: the #682 Tripo figure of this sheet (shape_target.py), placed on him and unposed. Its
# colours only say which garment is where (classified against the sheet's colours); its paint, face and hair are
# never used. The jacket, trousers and boots are drawn to the shell where it is their colour. The details below are
# built crisp where the shell's colour map has them (read off shape_views.py's class-map renders on a 5 cm grid).
SHAPE=dict(target='data/characters/tripo-outfits/void-navigator/preview.glb',
           colours=dict(navy=PAL['navy'],black=PAL['black'],trouser=PAL['trouser'],knee=PAL['knee'],
                        cream=PAL['cream'],boot=PAL['boot'],sole=PAL['sole'],metal=PAL['metal'],cyan=PAL['cyan'],
                        skin=(224,153,112),hair=(10,9,9)),
           pieces={'NavigatorJacket':dict(accept=['navy','black'],out=.045,inward=.03,sigma=.032),
                   'NavigatorTrousers':dict(accept=['trouser','knee','black','sole'],out=.04,inward=.03,sigma=.028),
                   BOOTS:dict(accept=['boot','cream','sole','metal','cyan','black'],out=.035,inward=.01,sigma=.012)})
BUILDERS={'NavigatorTrousers':lambda c,j:tailored_trousers(c,j,0.006),
          'NavigatorJacket':lambda c,j:tailored_jacket(c,j,0.009,1.098)}


def plate(bm,coat,pts,back=False,mat=0,offset=.011,n=4):
    """A hard plate on the jacket: a polygon (x, z) seen from the front (or the back), projected and closed."""
    panel(bm,coat,[_on(coat,x,z,back) for x,z in pts],mat=mat,offset=offset,n=n)


def _on(ob,x,z,back):
    """The garment's surface at (x, z), seen from the front or the back: a ray along y."""
    o=Vector((x,1.0 if back else -1.0,z))
    ok,p,_,_=ob.ray_cast(o,Vector((0,-1 if back else 1,0)))
    if not ok:       # (over the shoulder's top the ray passes above it: the nearest point of the cloth)
        ok,p,_,_=ob.closest_point_on_mesh(Vector((x,.07 if back else -.03,z)))
    return p


def bar(bm,coat,a,b,width,back=False,mat=0,offset=.011,cut=0.0):
    """A strap plate from a to b (x, z), `width` wide; its ends cut square or (cut) bevelled."""
    a=np.array(a);b=np.array(b);d=b-a;d/=np.linalg.norm(d);s=np.array([-d[1],d[0]])*width/2
    pts=[a-s+d*cut,a+s,b+s,b-s-d*cut] if cut else [a-s,a+s,b+s,b-s]
    plate(bm,coat,[tuple(p) for p in pts],back,mat,offset)


def window(bm,coat,x,z0,z1,back=False):
    """A slim cyan status window, standing on the cloth."""
    strap_on(bm,coat,[_on(coat,x,z0,back),_on(coat,x,z1,back)],width=.007,mat=2)


def harness(ctx):
    """The harness as the shell has it (#684): an X of broad ivory plates over the chest from the shoulder pads to a
    large disc on the sternum, his right lower arm to his side, his left down by the inset to the hem; over the
    shoulders broad straps with pads; on the back a Y to a smaller disc and a long tail plate cut to a point."""
    bm=A.empty();coat=ctx['made']['NavigatorJacket']
    for s in (-1,1):
        bar(bm,coat,(s*.122,1.425),(s*.032,1.302),.046,cut=.008)               # the X's upper arms
        bar(bm,coat,(s*.122,1.44),(s*.03,1.322),.042,True,cut=.008)          # the back's Y
        # the shoulder strap over the top, its pad front and back
        front=_on(coat,s*.135,1.455,False);back=_on(coat,s*.135,1.455,True)
        pts=[front,Vector((s*.135,front.y*.45,1.488)),Vector((s*.135,.03,1.494)),Vector((s*.135,back.y*.7,1.48)),back]
        strap_on(bm,coat,pts,width=.056,mat=0)
    bar(bm,coat,(-.03,1.268),(-.142,1.162),.042,cut=.008)                     # his right lower arm, to his side
    bar(bm,coat,(.038,1.27),(.074,1.105),.036,cut=.006)                       # his left, down by the inset
    plate(bm,coat,[(-.03,1.292),(.03,1.292),(.032,1.15),(.013,1.112),(-.013,1.112),(-.032,1.15)],True)  # the tail
    for back,z,r in ((False,1.288,.040),(True,1.31,.027)):
        p,n=projected(coat,_on(coat,.008 if not back else 0,z,back),.017)
        disc(bm,p,n,r)
    window(bm,coat,.078,1.37,1.44)
    window(bm,coat,.105,1.255,1.30)
    window(bm,coat,0,1.38,1.445,True)
    return bm,garment_weights(bm,ctx,coat)


def belt(ctx):
    """A broad ivory belt under the cropped jacket, its big navigation disc at his left front, a pouch module at his
    right hip, and the holster strap down his right thigh."""
    bm=A.empty();c=ctx['cage'];tr=ctx['made']['NavigatorTrousers']
    K.band(bm,c,A.PART['torso'],1.0,1.048,.03,n=64,thick=.006,mat=0)
    hug_band(bm,[tr])
    p,n=projected(tr,_on(tr,.098,1.026,False),.02)
    disc(bm,p,n,.046)
    for x in (-.03,.03):                                                       # the buckle's two plates
        K.box(bm,_on(tr,x,1.024,False)+Vector((0,-.012,0)),(.034,.008,.034),bevel=.003,mat=0)
    q=_on(tr,-.115,1.022,False)
    K.box(bm,q+Vector((0,-.014,0)),(.05,.016,.042),bevel=.004,mat=1)          # the pouch module
    K.box(bm,q+Vector((0,-.023,-.002)),(.036,.004,.026),bevel=.002,mat=0)
    strap_on(bm,tr,[_on(tr,-.118,1.008,False),_on(tr,-.14,.93,False),_on(tr,-.152,.86,False)],width=.013,mat=0)
    return bm,garment_weights(bm,ctx,tr)

PROPS={'NavigationCuffs':dict(build=lambda c:arm_cuffs(c,'NavigatorJacket'),layer=3,hem=None),
       'NavigationHarness':dict(build=harness,layer=3,hem=None),
       'NavigationBelt':dict(build=belt,layer=3,hem=None)}
# the knee bands and shin panels raised on the trousers as the shell has them: each knee's band rising to the outside
KNEE=[(s,(s*.205,0,.628),(s*.045,0,.532)) for s in (-1,1)]
SHIN=[(s,(s*.172,0,.392)) for s in (-1,1)]
RELIEF={'NavigatorJacket':[cloth_relief('shirt')],
        'NavigatorTrousers':[cloth_relief('trousers')]+
        [T.raised(T.strap(a,b,(0,-1,0),.024),height=.0035,facing=(0,-1,0)) for s,a,b in KNEE]+
        [T.raised(T.strap(a,b,(0,1,0),.024),height=.0035,facing=(0,1,0)) for s,a,b in KNEE]+
        [T.raised(T.rect(c,(0,1,0),(0,0,1),.03,.065),height=.003,facing=(s,0,0),where=lambda P,s=s:(s*P[:,0]>.1)*1.0) for s,c in SHIN]+
        [T.raised(T.strap((.158,0,.40),(.158,0,.47),(1,0,0),.009),height=.004,facing=(1,0,0),where=lambda P:(P[:,0]>.1)*1.0)]}
SHADE={name:None for name in ZONES}
SKIN_CUT=[]
KEEP_AREAS=['neck']


def paint(piece,zone,P,N,J):
    """Flat colour zones in the sheet's colours (no light, no shade, no grain): the game's ink and light shade them."""
    cols=np.array([PAL[k] for k in ZONES[piece]],dtype=float)/255
    out=cols[np.clip(zone.astype(int),0,len(cols)-1)]
    x,y,z=P.T
    put=lambda mask,key:out.__setitem__(mask,np.array(PAL[key])/255)
    front=N[:,1]<-.2
    if piece=='NavigatorJacket':
        put((np.abs(x)>.595)&(z>1.25),'cream')                                   # the ivory band at each wrist
        put((x>-.036)&(x<.062)&(z>1.07)&front&(np.abs(x)<.2),'black')           # the dark inset, a little to his left
        put((np.abs(x-.013)<.0012)&(z>1.07)&(z<1.47)&front,'metal')              # its zip
        for sx in (-1,1):                                                        # ivory bars on the upper sleeves
            put((np.abs(np.abs(x)-.30)<.035)&(z>1.43)&(sx*x>0),'cream')
    if piece=='NavigatorTrousers':
        for s,a,b in KNEE:
            for nrm in ((0,-1,0),(0,1,0)):
                sdf,_=T.strap(a,b,nrm,.024)
                put((sdf(P)<0)&((N@np.array(nrm))>.25),'knee')
        for s,c in SHIN:
            sdf,_=T.rect(c,(0,1,0),(0,0,1),.03,.065)
            put((sdf(P)<0)&(s*N[:,0]>.25)&(s*x>.1),'knee')
        sdf,_=T.strap((-.165,.02,.77),(-.165,.02,.835),(-1,0,0),.0045)           # the cyan strip down his right thigh
        put((sdf(P)<0)&(N[:,0]<-.3)&(x<-.1),'cyan')
        sdf,_=T.strap((.158,0,.40),(.158,0,.47),(1,0,0),.009)                    # the ivory strap on his left shin
        put((sdf(P)<0)&(N[:,0]>.3)&(x>.1),'cream')
    if piece==BOOTS:
        out[:]=np.array(PAL['boot'])/255
        put(z<.032,'sole')                                                       # the dark sole and its rand
        put(z>.19,'sole')                                                        # the dark collar at the top
        side=np.abs(x)-np.abs(J['foot_l'].x)
        put((side>.035)&(z>.07)&(z<.15)&(np.abs(y-.0)<.012),'cyan')               # the cyan panel on each outer side
    return out
