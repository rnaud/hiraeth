"""Approved furnace mechanic, #588: rolled cream shirt, rust bib and secured tools."""
import math
import bpy
import bmesh
import numpy as np
from mathutils import Vector
import outfit_approved_kit as A
import outfit_kit as K
import tailor as T
import rig as R
import garments as G
import outfit_sea_tailoring as D

ATLAS_SIZE = 1024
ID = 'furnace-mechanic'
NAME = 'Furnace mechanic'
SHEET = 'references/characters/traveller-outfits/furnace-mechanic/approved-reference.png'
PAL = dict(cream=(227,211,179), rust=(187,105,66), cuff=(202,124,81),
           leather=(80,66,48), brass=(188,151,76), boot=(137,108,75), ink=(48,39,31))
BOOTS = 'MechanicBoots'
PIECES = {
    'MechanicTrousers': A.piece(covers=['MechanicShirt', 'MechanicBib']),
    'MechanicShirt': A.piece(outside=['MechanicTrousers'], covers=['MechanicBib']),
    'MechanicBib': A.piece(2, outside=['MechanicShirt', 'MechanicTrousers'], gap=0.008),
}
ZONES = {'MechanicTrousers':['rust'], 'MechanicShirt':['cream','cream'],
         'MechanicBib':['rust'], 'ToolBelt':['leather','brass'],
         'ToolPouch':['leather','brass'], 'BibStraps':['rust','brass'],
         'ShirtDetails':['cream','brass'], BOOTS:['boot']}
BUILDERS = {
    'MechanicTrousers': lambda c,j: A.trousers(c,j,0.025),
}


def shirt(cage,J,sleeve=.53,roll_from=.45):
    # (#680: the mechanic's sheet rolls its sleeves at the forearm; the festival traveller keeps .46 / .38)
    bm=G.cut(cage,lambda v,p:(p==A.PART['torso'] and v.co.z>=.94)
             or (p==A.PART['arm'] and abs(v.co.x)<=sleeve),
             keep_face=lambda f:not(f.calc_center_median().y<-.02
                 and f.calc_center_median().z>1.365
                 and abs(f.calc_center_median().x)<(f.calc_center_median().z-1.365)*.5))
    G.inflate(bm,lambda p,part:.024 if part==A.PART['arm'] else .020)
    for loop in G.boundary_loops(bm):
        c=sum((v.co for v in loop),Vector())/len(loop)
        if c.z>1.30 and abs(c.x)<.12:
            out=G.radial((0,c.y))
            before=set(bm.faces)
            stand=G.extrude(bm,loop,lambda p,v:p+Vector((0,0,.008))+out(p)*.002)
            G.extrude(bm,stand,lambda p,v:p+out(p)*.010-Vector((0,0,.015)))
            # The collar opens at the throat; do not bridge its two front ends
            # into a stiff square ring across the shirt opening.
            front=[f for f in bm.faces if f not in before
                   and abs(f.calc_center_median().x)<.057
                   and f.calc_center_median().y<c.y]
            bmesh.ops.delete(bm,geom=front,context='FACES')
        elif abs(c.x)>.30:
            for v in bm.verts:
                k=max(0,min(1,(abs(v.co.x)-roll_from)/.07))
                if v.co.x*c.x>0:
                    v.co.y=c.y+(v.co.y-c.y)*(1-.2*k)
                    v.co.z=c.z+(v.co.z-c.z)*(1-.2*k)
            radial=lambda p:(p-Vector((p.x,c.y,c.z))).normalized()
            sx=math.copysign(1,c.x)
            roll=G.extrude(bm,loop,lambda p,v:p+radial(p)*.009+Vector((sx*.008,0,0)))
            G.extrude(bm,roll,lambda p,v:p-Vector((sx*.025,0,0)))
    return A.orient(bm)


BUILDERS['MechanicShirt']=shirt


def bib(cage, J):
    bm = A.vest(cage, J, gap=0.040, hem=1.015, opening=-1)
    # The torso's own surface forms the bib and shoulder straps; opening the
    # armholes avoids a rigid bridge between sleeve and chest during a stride.
    gone = []
    for f in bm.faces:
        p = f.calc_center_median()
        if p.z>1.29 or (abs(p.x)>.105 and p.z>1.12):   # (#680: the sheet's narrower bib)
            gone.append(f)
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    return bm


BUILDERS['MechanicBib'] = bib
RELIEF = {
    'MechanicShirt':[D.cloth_relief('shirt')],
    'MechanicTrousers':[D.cloth_relief('trousers',thigh_amount=.35),
                        T.raised(T.rect((.13,0,.77),(1,0,0),(0,0,1),.050,.075),height=.004,facing=(0,-1,0)),
                        T.raised(T.rect((-.13,0,.77),(1,0,0),(0,0,1),.050,.075),height=.004,facing=(0,-1,0))],
    'MechanicBib': [D.cloth_relief('vest'),
                    T.raised(T.rect((0,0,1.19),(1,0,0),(0,0,1),.045,.042),height=.004,facing=(0,-1,0)),
                    T.raised(T.rect((0,0,1.227),(1,0,0),(0,0,1),.046,.010),height=.003,facing=(0,-1,0))],
}


def straps(ctx):
    bm=A.empty(); shirt=ctx['made']['MechanicShirt']; bib=ctx['made']['MechanicBib']
    for s in [-1,1]:
        D.strap_on(bm,shirt,[(s*.08,-.16,1.26),(s*.14,-.13,1.38),(s*.155,-.06,1.45),
                           (s*.155,.04,1.45),(s*.13,.11,1.38),(s*.03,.15,1.20)],width=.030)
        p,n=D.projected(bib,(s*.08,-.30,1.27),.012)
        K.torus(bm,p,n,.011,.0025,seg=16,sides=6,mat=1)
    return bm,D.garment_weights(bm,ctx,shirt)


def shirt_details(ctx):
    bm=A.empty(); ob=ctx['made']['MechanicShirt']
    for z in [1.32,1.365]:
        p,n=D.projected(ob,(0,-.25,z),.005)
        K.torus(bm,p,n,.003,.001,seg=10,sides=4,mat=1)
    return bm,D.garment_weights(bm,ctx,ob)


def belt(ctx):
    bm = A.empty()
    K.band(bm,ctx['cage'],A.PART['torso'],1.005,1.035,0.060,n=40,thick=0.005)
    D.hug_band(bm,[ctx['made']['MechanicBib'],ctx['made']['MechanicShirt'],ctx['made']['MechanicTrousers']])
    pts,c = K.ring_of(ctx['cage'],A.PART['torso'],1.02)
    p,d=D.projected(ctx['made']['MechanicBib'],(0,-.3,1.02),.01)
    K.torus(bm,p,d,0.015,0.003,seg=20,sides=6,mat=1)
    return bm,D.garment_weights(bm,ctx,ctx['made']['MechanicShirt'])


def tools(ctx):
    bm = A.empty()
    # A close-fitting hip pouch; the tools sit inside it, supported by the belt.
    # (#680: the sheet's leather tool apron, wider and longer, still close on the hip)
    K.box(bm,(0.190,-0.072,0.950),(0.100,0.040,0.185),bevel=0.008)
    K.box(bm,(0.190,-0.095,0.955),(0.092,0.008,0.080),bevel=0.003)
    for x,h in [(0.174,0.090),(0.197,0.115),(0.219,0.083)]:
        K.box(bm,(x,-0.086,1.005+h/2),(0.009,0.012,h),bevel=0.002,mat=1)
    # Open-ended spanner and two screwdriver grips, no hanging chains.
    for x in [0.190,0.204]:
        K.box(bm,(x,-0.086,1.122),(0.008,0.014,0.022),bevel=0.002,mat=1)
    for x in [0.174,0.219]:
        K.box(bm,(x,-0.086,1.095 if x<0.2 else 1.087),(0.014,0.017,0.028),bevel=0.004)
    return bm


PROPS = {'ToolBelt':dict(build=belt,layer=3,hem=None),
         'ToolPouch':dict(build=tools,bone='pelvis',layer=3,hem=None),
         'BibStraps':dict(build=straps,layer=3,hem=None),
         'ShirtDetails':dict(build=shirt_details,layer=3,hem=.003)}
SHADE = {name:None for name in ZONES}
SKIN_CUT = []


def reweight(name, ob, arm, J):
    if name == 'MechanicBib':
        R.set_weights(ob,K.copy_weights(ob,bpy.data.objects['MechanicShirt']))


def paint(piece,zone,P,N,J):
    out = A.seam_paint(PAL,ZONES,piece,zone,P,N,J)
    x,y,z = P.T
    front = np.clip(-N[:,1]*3,0,1)
    ink = np.array(PAL['ink'])/255
    if piece == 'MechanicBib':
        # Pocket outline and two brass strap catches are graphic construction
        # details, not painted illumination.
        pocket = ((K.band_mask(np.abs(x)-.045,.0015,.0008)*(z>1.148)*(z<1.232))
                  + K.band_mask(z-1.148,.0015,.0008)*(np.abs(x)<.045)
                  + K.band_mask(z-1.232,.0015,.0008)*(np.abs(x)<.045))*front
        out = out*(1-pocket[:,None]*.65)+ink*pocket[:,None]*.65
        catch = (np.abs(np.abs(x)-.08)<.012)*(np.abs(z-1.285)<.009)*front
        out = out*(1-catch[:,None])+np.array(PAL['brass'])/255*catch[:,None]
    if piece == 'MechanicTrousers':
        cuff = z<.275
        out[cuff] = np.array(PAL['cuff'])/255
        # Reinforced knee patches and side pocket seams.
        patch = (np.abs(np.abs(x)-.125)<.055)*(z>.46)*(z<.60)*front
        out = out*(1-patch[:,None]*.08)
        seam = (K.band_mask(z-.60,.0015,.001)+K.band_mask(z-.46,.0015,.001))*patch
        out = out*(1-seam[:,None]*.5)+ink*seam[:,None]*.5
    return np.clip(out,0,1)
