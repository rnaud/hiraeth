"""Gravity ranger (#590): cropped olive flight jacket, coral stand collar, gravity hardware (#684: its jacket with the
shoulder pad, collar, crescents and dials, its trousers and its boots cut out of its Tripo figure, re-meshed, fitted on
him and painted flat from the figure's colour map in the sheet's colours)."""
import numpy as np
import outfit_approved_kit as A
import shape_target as ST

ID='gravity-ranger'
ATLAS_SIZE=1024
NAME='Gravity ranger'
SHEET='references/characters/traveller-outfits/gravity-ranger/approved-reference.png'
# (#684) every colour is the sheet's own flat area (its median, sampled away from line work and shading)
PAL=dict(olive=(162,157,128), coral=(237,134,107), cuff=(80,75,70), trouser=(100,93,87), pocket=(150,145,118),
         cream=(237,227,205), metal=(70,66,58), cyan=(118,211,213), boot=(166,149,163), sole=(65,54,50), ink=(36,40,35))
BOOTS=None             # (#684: his boots are the shape target's own, a piece below)
# (#684) the shape target: the #682 Tripo figure of this sheet, placed on him and unposed (shape_target.py). The
# jacket (its collar, shoulder pad, crescents and dials with it), the trousers and the boots are cut out of the figure's
# own surface by its colour map and height, cleaned, re-meshed, fitted just outside his body and painted from the map
# in the sheet's flat colours; his head, hair, hands and body stay the game's.
SHAPE=dict(target='data/characters/tripo-outfits/gravity-ranger/preview.glb',
           colours=dict(olive=PAL['olive'],coral=PAL['coral'],cuff=PAL['cuff'],trouser=PAL['trouser'],
                        pocket=PAL['pocket'],cream=PAL['cream'],metal=PAL['metal'],cyan=PAL['cyan'],boot=PAL['boot'],
                        sole=PAL['sole'],skin=(218,150,112),hair=(10,9,9)),
           reach_wrists=True,
           paint={'GravityJacket':dict(classes=dict(olive='olive',pocket='olive',coral='coral',cuff='cuff',cream='cream',
                                                    metal='metal',cyan='cyan',trouser='cuff'),default='olive',
                                       # (the dark knit: the forearms; elsewhere it is the shell's shade. The sheet's waistband is olive)
                                       limits=dict(cuff=lambda p:abs(p[0])>.44,trouser=lambda p:abs(p[0])>.44,
                                                   coral=lambda p:p[2]>1.33 and abs(p[0])<.13,metal=lambda p:p[2]>1.25)),
                  'GravityTrousers':dict(classes=dict(trouser='trouser',pocket='pocket',olive='pocket',cuff='cuff'),default='trouser',
                                         limits=dict(cuff=lambda p:p[2]>1.0 or p[2]<.32,
                                                     pocket=lambda p:abs(p[0])>.13 and .62<p[2]<.97,olive=lambda p:abs(p[0])>.13 and .62<p[2]<.97)),
                  'GravityBoots':dict(classes=dict(boot='boot',sole='sole',metal='metal',cyan='cyan',cuff='sole',trouser='sole'),default='boot',
                                      limits=dict(sole=lambda p:p[2]<.04,cuff=lambda p:p[2]<.04,trouser=lambda p:p[2]<.04))})
WRIST=0.672            # (past it: crumbs of the figure's hands, shaded like cloth, beyond the cuffs)
HEM=1.066              # the jacket's hem on the figure (its colour map on a 5 cm grid: shape_views.py)
BOOT_TOP=0.215         # the boots' tops
BOOT_LEVEL=0.212       # the boots' tops, cut level
CUFF_LEVEL=0.25        # the trousers' cuffs, cut level above the fold where the figure's cuff turns under
ZONES={'GravityTrousers':['trouser'],'GravityJacket':['olive'],'GravityBoots':['boot']}


BOOT=('boot','sole','metal','cyan')
BUILDERS={'GravityTrousers':ST.shell(lambda c,l:ST.cloth(l) and CUFF_LEVEL-.03<c.z<=HEM+.02,
                                  lambda J:[(0,0,HEM,'below'),(J['foot_l'].x,.03,CUFF_LEVEL,'above'),(-J['foot_l'].x,.03,CUFF_LEVEL)],under=(0,0,HEM)),
          # (the jacket without the figure's elbows, which its A-pose left by the waist; cut level on its rib's outer face,
          #  above the crease where the figure's rib turns in to the trousers)
          'GravityJacket':ST.shell(lambda c,l:ST.cloth(l) and c.z>HEM-.02 and not (c.z<1.2 and abs(c.x)>.19) and abs(c.x)<WRIST,
                                lambda J:[(0,.02,1.50),(J['hand_l'].x-.01,.04,1.37),(-J['hand_l'].x+.01,.04,1.37),(0,0,HEM+.014,'above')]),
          # (the boots below a level top, whatever colour the figure painted there but its skin: the ankle inside the collar)
          'GravityBoots':ST.shell(lambda c,l:ST.cloth(l) and c.z<BOOT_LEVEL+.03,
                               lambda J:[(J['foot_l'].x,.03,BOOT_LEVEL,'below'),(-J['foot_l'].x,.03,BOOT_LEVEL)])}
PIECES={'GravityTrousers':A.piece(1,covers=['GravityJacket'],levels=0,gap=.004,retopo=15000),
        'GravityBoots':A.piece(1,levels=0,gap=.003,retopo=6000),
        'GravityJacket':A.piece(2,outside=['GravityTrousers'],levels=0,gap=.005,retopo=22000)}
PROPS={}
RELIEF={}
SHADE={name:None for name in ZONES}
SKIN_CUT=[]
KEEP_AREAS=['neck']
# (the figure's jacket and trousers stand off his body unevenly, so the rays that measure what they cover miss in
#  places; they cover his trunk and arms whole, and his body there is left out, never coming through when he moves)
EXTRA_HIDES=['chest','belly','upperarm.L','upperarm.R','forearm_upper.L','forearm_upper.R']


def paint(piece,zone,P,N,J):
    # (every piece is painted from the shape target's colour map: outfit.py, SHAPE['paint'])
    return np.tile(np.array(PAL[ZONES[piece][0]])/255,(len(P),1))


def paint_after(piece,col,zone,P,N,J):
    """The shoulder pad whole in its cream: its plate is one surface with the jacket in the figure, and the map's
    shade on its far side reads as olive (the box: the figure's pad on its colour-map grid, shape_views.py)."""
    if piece!='GravityJacket':
        return col
    x,y,z=P.T
    pad=(x>-.335)&(x<-.095)&(z>1.315)&(z<1.475)&(N[:,2]>-.3)
    keep=np.all(np.isclose(col,np.array(PAL['cyan'])/255),1)|np.all(np.isclose(col,np.array(PAL['metal'])/255),1)
    col=col.copy()
    col[pad&~keep]=np.array(PAL['cream'])/255
    return col
