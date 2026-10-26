"""Approved frost surveyor, #588: short quilted vest and secured neck wrap."""
import numpy as np
import bpy
import bmesh
from mathutils import Vector
import outfit_approved_kit as A
import outfit_sea_tailoring as D
import outfit_kit as K
import tailor as T
import rig as R

ID = 'frost-surveyor'
ATLAS_SIZE = 1024
NAME = 'Frost surveyor'
SHEET = 'references/characters/traveller-outfits/frost-surveyor/approved-reference.png'
PAL = dict(blue=(83,108,122), cream=(229,216,185), coral=(200,115,88),
           trouser=(92,90,87), boot=(184,162,125), ink=(44,43,37))
BOOTS = 'SurveyBoots'
PIECES = {
    'SurveyTrousers': A.piece(covers=['SurveyShirt', 'SurveyVest']),
    'SurveyShirt': A.piece(outside=['SurveyTrousers'], covers=['SurveyVest']),
    'SurveyVest': A.piece(2, outside=['SurveyShirt', 'SurveyTrousers'], gap=0.008),
}
ZONES = {'SurveyTrousers':['trouser'], 'SurveyShirt':['blue','blue'],
         'SurveyVest':['cream'], 'NeckWrap':['coral'], BOOTS:['boot']}
BUILDERS = {
    'SurveyTrousers': lambda c,j: A.trousers(c,j,0.018),
    'SurveyShirt': lambda c,j: A.shirt(c,j,sleeve=0.58,fullness=0.008,cuff_roll=0.003,cuff_return=0.014),
}


def survey_vest(cage, J):
    bm = A.vest(cage,J,gap=0.028,hem=0.98,opening=-1)
    # Open the armholes below the shoulder strap. The sweater's upper-arm
    # vertices travel through this space as the elbow swings behind the body.
    gone = [f for f in bm.faces if abs(f.calc_center_median().x)>0.135
            and 1.24<f.calc_center_median().z<1.39]
    bmesh.ops.delete(bm,geom=gone,context='FACES')
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
    # Smooth the cut's boundary in the cage before subdivision; straight face
    # deletion alone leaves a stair-stepped edge that quilting exaggerates.
    rim=[v for v in bm.verts if any(e.is_boundary for e in v.link_edges)
         and abs(v.co.x)>.10 and v.co.z>1.16]
    for _ in range(5):
        moved={}
        for v in rim:
            adjacent=[e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(adjacent)==2:moved[v]=v.co.lerp((adjacent[0].co+adjacent[1].co)*.5,.45)
        for v,p in moved.items():v.co=p
    return A.orient(bm)


BUILDERS['SurveyVest'] = survey_vest


def neck_wrap(ctx):
    bm = A.empty()
    # Thin folded cloth sitting close to the neck, rather than a round tube.
    rings=[]
    for radius,z in [(0.065,1.465),(0.070,1.465),(0.064,1.510),(0.060,1.510)]:
        rings.append([bm.verts.new((radius*np.cos(a),0.012+radius*np.sin(a),
                      z+0.003*np.sin(a*3))) for a in np.linspace(0,2*np.pi,32,endpoint=False)])
    for k in range(4):
        for j in range(32):
            bm.faces.new((rings[k][j],rings[k][(j+1)%32],
                          rings[(k+1)%4][(j+1)%32],rings[(k+1)%4][j]))
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    # A short flat end tucked into the vest.
    # (#680: the sheet's two coral ends down the front, tucked into the vest's opening; nothing trails)
    vest=ctx['made']['SurveyVest']
    for x,z,length in [(0.032,1.392,0.115),(-0.004,1.400,0.085)]:
        p,d=D.projected(vest,(x,-0.30,z),0.007)
        K.box(bm,p,(0.042,0.008,length),K.face_rot(d),bevel=0.004)
    return bm


PROPS = {'NeckWrap':dict(build=neck_wrap,bone='spine_03',layer=3,hem=None)}
RELIEF = {'SurveyVest':[T.quilt([((0,0,1),[1.01,1.10,1.19,1.28,1.37,1.46],lambda P: T.smooth01(.19,.13,np.abs(P[:,0]))*T.smooth01(1.45,1.37,P[:,2]))],puff=0.0035)],   # (#680: softer, as the sheet's)
          'SurveyShirt':[A.cloth_relief('shirt',0.65)],
          'SurveyTrousers':[A.cloth_relief('trousers')]}
# Sewn lower pockets and their narrow folded mouths are part of the vest mesh.
for side in [-1,1]:
    RELIEF['SurveyVest'].extend([
        T.raised(T.rect((side*.102,0,1.075),(1,0,0),(0,0,1),.032,.041),height=.004,facing=(0,-1,0)),
        T.raised(T.rect((side*.102,0,1.112),(1,0,0),(0,0,1),.034,.006),height=.004,facing=(0,-1,0)),
    ])
SHADE = {name:None for name in ZONES}
SKIN_CUT = []


def reweight(name, ob, arm, J):
    if name == 'SurveyVest':
        # Adjacent layers follow the same skin field at the shoulder opening.
        R.set_weights(ob, K.copy_weights(ob, bpy.data.objects['SurveyShirt']))


def paint(piece,zone,P,N,J):
    out = A.seam_paint(PAL,ZONES,piece,zone,P,N,J)
    if piece == 'SurveyShirt':
        # Knit ribs, narrow and lighting neutral.
        rib = K.band_mask(np.sin(P[:,0]*220),0.07,0.04) * 0.12
        out *= 1-rib[:,None]
    if piece == 'SurveyVest':
        x,y,z=P.T
        front=np.clip(-N[:,1]*3,0,1)
        seams=K.band_mask(x,.002,.001)*(z>1.01)*(z<1.46)
        for side in [-1,1]:
            px=np.abs(x-side*.102)
            seams+=K.band_mask(px-.032,.001,.0006)*(np.abs(z-1.075)<.041)
            seams+=K.band_mask(z-1.112,.0012,.0008)*(px<.034)
            seams+=K.band_mask(z-1.034,.001,.0006)*(px<.032)
        seams=np.clip(seams*front,0,1)*.55
        out=out*(1-seams[:,None])+np.array(PAL['ink'])/255*seams[:,None]
        baffles=np.zeros(len(P))
        for row in [1.10,1.19,1.28,1.37]:
            baffles+=K.band_mask(z-row,.0011,.0007)*T.smooth01(.17,.13,np.abs(x))
        # (#680: the sheet's quilting is soft: its stitch rows in the vest's own shade, not ink)
        baffles=np.clip(baffles*np.abs(N[:,1])*0.9,0,1)[:,None]
        out=out*(1-baffles*.16)
    if piece == 'SurveyShirt': out=A.cloth_ink(out,P,J,PAL,'shirt')
    elif piece == 'SurveyTrousers': out=A.cloth_ink(out,P,J,PAL,'trousers')
    return out
