"""Void navigator (#590; #684: its jacket with the harness, its trousers with the belt and its boots cut out of its Tripo
figure, re-meshed, fitted on him and painted flat from the figure's colour map in the sheet's colours)."""
import numpy as np
import outfit_approved_kit as A
import shape_target as ST

ID='void-navigator'
ATLAS_SIZE=1024
NAME='Void navigator'
SHEET='references/characters/traveller-outfits/void-navigator/approved-reference.png'
# (#684) every colour is the sheet's own flat area (its median, sampled away from line work and shading); the
# game's ink and light do the shading
PAL=dict(navy=(78,79,96),black=(61,57,51),trouser=(89,82,76),knee=(121,112,102),cream=(237,218,194),
         metal=(118,115,104),cyan=(129,210,211),boot=(238,232,211),sole=(67,62,56),ink=(31,35,41))
BOOTS=None             # (#684: his boots are the shape target's own, a piece below)
# (#684) the shape target: the #682 Tripo figure of this sheet, placed on him and unposed (shape_target.py). The
# jacket (with the harness's plates and discs, which the figure made one surface with it), the trousers (with the belt
# and its disc) and the boots are cut out of the figure's own surface by its colour map and height, cleaned,
# re-meshed, fitted just outside his body and painted from the map in the sheet's flat colours; his head, hair, hands
# and body stay the game's.
SHAPE=dict(target='data/characters/tripo-outfits/void-navigator/preview.glb',
           colours=dict(navy=PAL['navy'],black=PAL['black'],trouser=PAL['trouser'],knee=PAL['knee'],
                        cream=PAL['cream'],boot=PAL['boot'],sole=PAL['sole'],metal=PAL['metal'],cyan=PAL['cyan'],
                        skin=(224,153,112),hair=(10,9,9)),
           reach_wrists=True,
           paint={'NavigatorJacket':dict(classes=dict(navy='navy',black='black',cream='cream',metal='metal',cyan='cyan',
                                                      boot='cream',knee='cream',trouser='navy'),default='navy',
                                         # (the dark inset down the front only; elsewhere black is the shell's shade)
                                         limits=dict(black=lambda p:abs(p[0]-.012)<.06 and p[1]<0 and p[2]<1.47,
                                                     metal=lambda p:abs(p[0])<.25)),
                  'NavigatorTrousers':dict(classes=dict(trouser='trouser',knee='knee',cream='cream',metal='metal',cyan='cyan',
                                                        black='trouser',sole='trouser',boot='cream'),default='trouser',
                                           limits=dict(knee=lambda p:p[2]<.78,metal=lambda p:p[2]>.95,
                                                       cream=lambda p:p[2]>.95 or (p[0]<-.08 and p[2]>.8))),
                  'NavigatorBoots':dict(classes=dict(boot='boot',cream='boot',sole='sole',black='sole',metal='sole',
                                                     cyan='cyan',trouser='sole',knee='boot'),default='boot',
                                        limits=dict(sole=lambda p:p[2]<.035 or p[2]>.17,black=lambda p:p[2]<.035 or p[2]>.17,
                                                    metal=lambda p:p[2]<.035 or p[2]>.17,trouser=lambda p:p[2]<.035 or p[2]>.17))})
WRIST=0.672            # (past it: crumbs of the figure's hands, shaded like cloth, beyond the cuffs)
HEM=1.095              # the jacket's hem on the figure (its colour map on a 5 cm grid: shape_views.py)
BOOT_LEVEL=0.205       # the boots' tops, cut level
CUFF_LEVEL=0.29       # the trousers' cuffs, cut level above the fold where the figure's cuff turns under
ZONES={'NavigatorTrousers':['trouser'],'NavigatorJacket':['navy'],'NavigatorBoots':['boot']}
BUILDERS={'NavigatorTrousers':ST.shell(lambda c,l:ST.cloth(l) and CUFF_LEVEL-.03<c.z<=HEM+.02,
                                    lambda J:[(0,0,HEM,'below'),(J['foot_l'].x,.03,CUFF_LEVEL,'above'),(-J['foot_l'].x,.03,CUFF_LEVEL)],
                                    under=(0,0,HEM)),
          'NavigatorJacket':ST.shell(lambda c,l:ST.cloth(l) and c.z>HEM-.02 and not (c.z<1.2 and abs(c.x)>.19) and abs(c.x)<WRIST,
                                  lambda J:[(0,.02,1.50),(J['hand_l'].x-.01,.04,1.37),(-J['hand_l'].x+.01,.04,1.37),(0,0,HEM+.012,'above')]),
          'NavigatorBoots':ST.shell(lambda c,l:ST.cloth(l) and c.z<BOOT_LEVEL+.03,
                                 lambda J:[(J['foot_l'].x,.03,BOOT_LEVEL,'below'),(-J['foot_l'].x,.03,BOOT_LEVEL)])}
PIECES={'NavigatorTrousers':A.piece(1,covers=['NavigatorJacket'],levels=0,gap=.004,retopo=15000),
        'NavigatorBoots':A.piece(1,levels=0,gap=.003,retopo=6000),
        'NavigatorJacket':A.piece(2,outside=['NavigatorTrousers'],levels=0,gap=.007,retopo=24000)}
PROPS={}
RELIEF={}
SHADE={name:None for name in ZONES}
# (his skin piece's forearms under the sleeves left out: lowered, the wrist came 14 mm through the cuff)
SKIN_CUT=[dict(absx=(0.45,0.674),z=(1.2,1.6))]
KEEP_AREAS=['neck']
# (the jacket and trousers cover his trunk and arms whole: his body there is left out, never coming through)
EXTRA_HIDES=['chest','belly','upperarm.L','upperarm.R','forearm_upper.L','forearm_upper.R']


def paint(piece,zone,P,N,J):
    # (every piece is painted from the shape target's colour map: outfit.py, SHAPE['paint'])
    return np.tile(np.array(PAL[ZONES[piece][0]])/255,(len(P),1))
