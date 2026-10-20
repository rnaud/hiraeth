"""Approved festival traveller, #588: cropped patchwork vest and tucked woven sash."""
import math
import bpy
import bmesh
import numpy as np
from mathutils import Vector
import garments as G
import outfit_approved_kit as A
import outfit_kit as K
import rig as R
import tailor as T
import outfit_sea_tailoring as D
from outfit_furnace_mechanic import shirt as open_shirt, shirt_details as mechanic_shirt_details

ATLAS_SIZE = 1024
ID = 'festival-traveller'
NAME = 'Festival traveller'
SHEET = 'references/characters/traveller-outfits/festival-traveller/approved-reference.png'
PAL = dict(cream=(231,216,184), coral=(216,129,102), ochre=(220,170,83),
           teal=(69,110,101), sash=(154,108,77), plum=(141,121,142),
           boot=(142,117,82), ink=(53,43,36))
BOOTS = 'FestivalBoots'
PIECES = {
    'FestivalTrousers': A.piece(covers=['FestivalShirt','PatchworkVest']),
    'FestivalShirt': A.piece(outside=['FestivalTrousers'],covers=['PatchworkVest']),
    'PatchworkVest': A.piece(2,outside=['FestivalShirt','FestivalTrousers'],gap=.008),
}
ZONES = {'FestivalTrousers':['teal'],'FestivalShirt':['cream','cream'],
         'PatchworkVest':['coral'],'FestivalSash':['sash','teal','plum'],
         'FestivalCollar':['cream','ochre'],BOOTS:['boot']}
BUILDERS = {
    'FestivalTrousers':lambda c,j:A.trousers(c,j,.024),
    'FestivalShirt':open_shirt,
}


def vest(cage,J):
    bm = A.vest(cage,J,gap=.040,hem=1.005,opening=.025)
    gone = [f for f in bm.faces if abs(f.calc_center_median().x)>.135
            and 1.24<f.calc_center_median().z<1.39]
    bmesh.ops.delete(bm,geom=gone,context='FACES')
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
    for loop in G.boundary_loops(bm):
        c=sum((v.co for v in loop),Vector())/len(loop)
        if abs(c.x)>.12:
            # A continuous tailored oval, not the staircase left by deleting
            # cage faces. The shoulder seam and lower armhole retain clearance.
            for v in loop:
                angle=math.atan2((v.co.y-.015)/.11,(v.co.z-1.34)/.118)
                v.co.y=.015+.11*math.sin(angle)
                v.co.z=1.34+.118*math.cos(angle)
    return A.orient(bm)


BUILDERS['PatchworkVest'] = vest
RELIEF={'FestivalShirt':[D.cloth_relief('shirt')],
        'FestivalTrousers':[D.cloth_relief('trousers',thigh_amount=.35)],
        'PatchworkVest':[D.cloth_relief('vest'),
                         T.raised(T.rect((-.095,0,1.09),(1,0,0),(0,0,1),.037,.025),height=.003,facing=(0,-1,0)),
                         T.raised(T.rect((.095,0,1.09),(1,0,0),(0,0,1),.037,.025),height=.003,facing=(0,-1,0))]}


def collar(ctx):
    return mechanic_shirt_details({**ctx,'made':{**ctx['made'],'MechanicShirt':ctx['made']['FestivalShirt']}})


def sash(ctx):
    bm = A.empty()
    K.band(bm,ctx['cage'],A.PART['torso'],1.005,1.043,.060,n=48,thick=.003)
    D.hug_band(bm,[ctx['made']['FestivalShirt'],ctx['made']['PatchworkVest'],ctx['made']['FestivalTrousers']])
    # Two short folded ends tucked into the wrap, rather than dangling ribbons.
    K.box(bm,(.13,-.123,1.014),(.026,.020,.055),bevel=.004,mat=1)
    K.box(bm,(.158,-.111,1.020),(.017,.018,.044),bevel=.003,mat=2)
    return bm,D.garment_weights(bm,ctx,ctx['made']['FestivalShirt'])


PROPS = {'FestivalSash':dict(build=sash,layer=3,hem=None),
         'FestivalCollar':dict(build=collar,layer=3,hem=.003)}
SHADE = {name:None for name in ZONES}
SKIN_CUT = []


def reweight(name,ob,arm,J):
    if name=='PatchworkVest':
        R.set_weights(ob,K.copy_weights(ob,bpy.data.objects['FestivalShirt']))


def paint(piece,zone,P,N,J):
    out = A.seam_paint(PAL,ZONES,piece,zone,P,N,J)
    x,y,z = P.T
    ink = np.array(PAL['ink'])/255
    if piece=='PatchworkVest':
        # Large irregular panels run around the actual vest surface; fine
        # stitches cross each seam. No tone gradients are baked into the atlas.
        u = np.arctan2(y,x)
        q = (z + .65*x*np.sign(y))*8.5 + .5*(x>0)
        panel = np.floor(q).astype(int)%2
        out[:] = np.array([PAL['coral'],PAL['ochre']])[panel]/255
        seam = K.band_mask(np.sin(q*np.pi),.025,.012)
        out = out*(1-seam[:,None]*.72)+ink*seam[:,None]*.72
        stitch = K.band_mask(np.sin(q*np.pi),.13,.02)*(np.sin(u*90)>0.55)
        out = out*(1-stitch[:,None]*.7)+np.array(PAL['cream'])/255*stitch[:,None]*.7
    elif piece=='FestivalSash':
        cloth = zone==0
        u = np.arctan2(y,x)
        weave = K.band_mask(np.sin(u*25+(z-1)*100),.09,.04)*cloth
        out = out*(1-weave[:,None]*.50)+np.array(PAL['ochre'])/255*weave[:,None]*.50
        border = (K.band_mask(z-1.001,.003,.001)+K.band_mask(z-1.044,.003,.001))*cloth
        out = out*(1-border[:,None]*.55)+ink*border[:,None]*.55
    return np.clip(out,0,1)
