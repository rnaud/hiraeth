"""Gravity ranger (#590): cropped olive flight jacket, coral stand collar, gravity hardware (#684: drawn to its Tripo
figure's shape, the pockets and pack plate where the figure has them, painted flat)."""
import math
import bmesh
import bpy
import numpy as np
from mathutils import Vector
import garments as G
import outfit_approved_kit as A
import outfit_kit as K
import tailor as T
from loft import smoothstep
from outfit_sea_tailoring import projected, strap_on, triangle_on, cloth_relief, surface_weights

ID='gravity-ranger'
ATLAS_SIZE=1024
NAME='Gravity ranger'
SHEET='references/characters/traveller-outfits/gravity-ranger/approved-reference.png'
# (#684) every colour is the sheet's own flat area (its median, sampled away from line work and shading)
PAL=dict(olive=(162,157,128), coral=(237,134,107), cuff=(80,75,70), trouser=(100,93,87), pocket=(150,145,118),
         cream=(237,227,205), metal=(70,66,58), cyan=(118,211,213), boot=(166,149,163), sole=(65,54,50), ink=(36,40,35))
BOOTS='GravityBoots'
PAINT_BOOTS=True       # (#684: his boots painted flat in the sheet's colours, not the base atlas's shading)
# (#684) the shape target: the #682 Tripo figure of this sheet (shape_target.py), placed on him and unposed; its
# colours only say which garment is where. The jacket, trousers and boots are drawn to the shell where it is their
# colour; the details are built crisp where its colour map has them (shape_views.py's renders on a 5 cm grid).
SHAPE=dict(target='data/characters/tripo-outfits/gravity-ranger/preview.glb',
           colours=dict(olive=PAL['olive'],coral=PAL['coral'],cuff=PAL['cuff'],trouser=PAL['trouser'],
                        pocket=PAL['pocket'],cream=PAL['cream'],metal=PAL['metal'],cyan=PAL['cyan'],boot=PAL['boot'],
                        sole=PAL['sole'],skin=(218,150,112),hair=(10,9,9)),
           pieces={'GravityJacket':dict(accept=['olive','pocket','coral','cuff'],out=.05,inward=.03,sigma=.032),
                   'GravityTrousers':dict(accept=['trouser','pocket','cuff','sole'],out=.045,inward=.03,sigma=.028),
                   'GravityBoots':dict(accept=['boot','sole','metal','cyan'],out=.035,inward=.01,sigma=.012)})
PIECES={'GravityTrousers':A.piece(covers=['GravityJacket']),
        'GravityJacket':A.piece(2,outside=['GravityTrousers'],gap=0.008)}
ZONES={'GravityTrousers':['trouser'],'GravityJacket':['olive','coral','cuff'],
       'GravityShoulder':['cream','metal','cyan'],'GravityPack':['cream','metal','cyan'],
       'GravityBelt':['cuff','metal'],'GravityCuffs':['metal','cyan'],
       'GravityLapels':['olive','cuff'],'GravityBootPanels':['boot','metal','cyan'],BOOTS:['boot']}
# (#684: the shape target's cargo pockets, on the outer side of each thigh, their flaps above)
POCKETS=[(s,(s*.165,.035,.80)) for s in (-1,1)]


def panel(bm,ob,outline,mat=0,offset=.010,n=4):
    """Projected armor shell with a bounded normal return, never a sharp-miter extrusion."""
    before=set(bm.faces)
    centre=sum((Vector(p) for p in outline),Vector())/len(outline)
    for a,b in zip(outline,outline[1:]+outline[:1]):
        triangle_on(bm,ob,[centre,a,b],mat=mat,offset=offset,n=n)
    verts=list({v for f in bm.faces if f not in before for v in f.verts})
    bmesh.ops.remove_doubles(bm,verts=verts,dist=.00001)
    faces=[f for f in bm.faces if f not in before]
    edges={e for f in faces for e in f.edges}
    border=[e for e in edges if sum(f in faces for f in e.link_faces)==1]
    inner={v:bm.verts.new(v.co-projected(ob,v.co,0)[1]*.004) for v in {v for f in faces for v in f.verts}}
    for f in faces:
        back=bm.faces.new([inner[v] for v in reversed(f.verts)]);back.material_index=mat
    for e in border:
        a,b=e.verts
        side=bm.faces.new([a,b,inner[b],inner[a]]);side.material_index=mat
    bm.normal_update()


def tailored_jacket(cage,J,fullness=0.016,hem=1.065):
    """Cropped connected shell; standing collar, ribbed waist, narrow wrist cuffs and sewn folds."""
    bm=G.cut(cage,lambda v,p:(p==A.PART['torso'] and v.co.z>=0.94) or
             (p==A.PART['arm'] and abs(v.co.x)<=0.625))
    G.inflate(bm,lambda p,part:fullness+(0.006 if part==A.PART['arm'] else 0.004))
    for v in bm.verts:
        p=v.co
        if abs(p.x)<0.21 and p.z<1.05:p.z+=(hem-0.94)*smoothstep(1.05,0.94,p.z)
        # Shallow gathers at the bent sleeve and waist, in geometry, never baked lighting.
        arm=math.exp(-((abs(p.x)-0.47)/0.12)**2) if abs(p.x)>0.24 else 0
        waist=math.exp(-((p.z-1.065)/0.07)**2)*min(1,abs(p.x)/0.12) if abs(p.x)<0.2 else 0
        fold=0.0038*arm*math.sin(abs(p.x)*104+p.z*19)+0.003*waist*math.sin(p.x*74+p.z*43)
        p+=G.normal(bm,v)*fold
    for loop in G.boundary_loops(bm):
        c=sum((v.co for v in loop),Vector())/len(loop)
        if c.z>1.3 and abs(c.x)<0.12:
            out=G.radial((0,c.y))
            edge=G.extrude(bm,loop,lambda p,v:p+Vector((0,0,0.052-0.02*max(0,1-abs(p.x)/0.035)*(p.y<c.y))))
            inner=G.extrude(bm,edge,lambda p,v:p-out(p)*0.004-Vector((0,0,0.004)))
            for f in bm.faces:
                if all(v in set(loop+edge+inner) for v in f.verts):f.material_index=1
        elif abs(c.x)>0.25:
            radial=lambda p:(p-Vector((p.x,c.y,c.z))).normalized()
            sx=math.copysign(1,c.x)
            edge=G.extrude(bm,loop,lambda p,v:p+radial(p)*0.003-Vector((sx*0.028,0,0)))
            for f in bm.faces:
                if all(v in set(loop+edge) for v in f.verts):f.material_index=2
        elif c.z<1.2:
            edge=G.extrude(bm,loop,lambda p,v:p+Vector((0,0,-0.028))+G.radial((0,c.y))(p)*0.001)
            for f in bm.faces:
                if all(v in set(loop+edge) for v in f.verts):f.material_index=2
    return A.orient(bm)


def tailored_trousers(cage,J,fullness=0.01):
    bm=A.trousers(cage,J,fullness)
    for v in bm.verts:
        p=v.co
        fold=(math.exp(-((p.z-0.33)/0.07)**2)+0.45*math.exp(-((p.z-0.54)/0.07)**2))*0.003
        p+=G.normal(bm,v)*fold*math.sin(p.z*115+p.x*27)
    return A.orient(bm)


def surface(cage,x,z,back=False,off=0.032):
    pts,c=K.ring_of(cage,A.PART['torso'],z)
    side=sorted((p for p in pts if (p.y>=c.y)==back),key=lambda p:p.x)
    y=float(np.interp(x,[p.x for p in side],[p.y for p in side]))
    return Vector((x,y+(off if back else -off),z))


def strap(bm,cage,a,b,back=False,width=0.014,mat=0):
    points=[surface(cage,a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t,back) for t in np.linspace(0,1,12)]
    T.ribbon(bm,points,lambda p:(0,1 if back else -1,0),width,thick=0.0035,mat=mat)


def disc(bm,p,normal,r=0.018):
    n=Vector(normal)
    T.lathe(bm,p,n,[(0,r*0.8),(0.003,r),(0.008,r),(0.011,r*0.78)],segments=24,mat=1)
    K.torus(bm,Vector(p)+n*0.012,n,r*0.65,0.0025,seg=24,sides=6,mat=0)
    T.lathe(bm,Vector(p)+n*0.012,n,[(0,r*0.4),(0.002,r*0.4)],segments=20,mat=2)


def garment_weights(bm,ctx,coat):
    # Match the final garment's smoothed body+skin transfer before sampling its details.
    import outfit as pipeline
    pipeline.BONES=ctx['bones']
    before=set(coat.modifiers)
    pipeline.weight_from(ctx['arm'],[ctx['body'],ctx['skin']],coat)
    for mod in list(coat.modifiers):
        if mod not in before: coat.modifiers.remove(mod)
    return surface_weights(bm,coat)


def shoulder(ctx):
    bm=A.empty();coat=ctx['made']['GravityJacket']
    # One continuous crown, curved around the upper arm rather than disconnected flat badges.
    rows=[]
    for x in np.linspace(-.12,-.345,9):
        row=[]
        for angle in np.linspace(-2.5,2.1,17):
            p=(x,.052+.10*math.sin(angle),1.392-(abs(x)-.157)*.12+.105*math.cos(angle))
            row.append(bm.verts.new(projected(coat,p,.012)[0]))
        rows.append(row)
    for a,b in zip(rows,rows[1:]):
        for k in range(16):bm.faces.new([a[k],a[k+1],b[k+1],b[k]])
    for _ in range(3):
        border=[v for v in bm.verts if any(len(e.link_faces)==1 for e in v.link_edges)]
        moved={}
        for v in border:
            near=[e.other_vert(v) for e in v.link_edges if len(e.link_faces)==1]
            q=v.co*.5+sum((n.co for n in near),Vector())*(.5/len(near))
            moved[v]=projected(coat,q,.012)[0]
        for v,q in moved.items():v.co=q
    bm.normal_update()
    for face in bm.faces:
        if face.normal.dot(projected(coat,face.calc_center_median(),0)[1])<0:face.normal_flip()
    faces=list(bm.faces);border=[e for e in bm.edges if len(e.link_faces)==1]
    inner={v:bm.verts.new(v.co-projected(coat,v.co,0)[1]*.004) for v in list(bm.verts)}
    for face in faces:bm.faces.new([inner[v] for v in reversed(face.verts)])
    for edge in border:
        a,b=edge.verts;bm.faces.new([a,b,inner[b],inner[a]])
    p,n=projected(coat,(-.185,-.11,1.42),.012)
    disc(bm,p,n,.014)
    stripe=[projected(coat,p,.019)[0] for p in [(-.30,-.12,1.39),(-.30,-.12,1.42)]]
    T.ribbon(bm,stripe,lambda p:projected(coat,p,0)[1],.0025,.0015,mat=2)
    return bm,garment_weights(bm,ctx,coat)


def pack(ctx):
    bm=A.empty();c=ctx['cage']
    for s in [-1,1]:
        strap(bm,c,(s*0.11,1.44),(s*0.075,1.29),back=True,width=0.015,mat=1)
        points=[surface(c,s*(0.072+0.035*math.cos(t)),1.345+0.09*math.sin(t),True,0.044) for t in np.linspace(-1.2,1.2,19)]
        T.ribbon(bm,points,lambda p:(0,1,0),0.018,thick=0.008,mat=0)
        disc(bm,surface(c,s*0.085,1.345,True,0.055),(0,1,0),0.018)
    # (#684) the dark pack plate between the crescents, as the shape target's back has it
    for k,(x0,x1,z0,z1) in enumerate([(-.07,.07,1.325,1.41)]):
        pts=[surface(c,x0,z0,True,.040),surface(c,x1,z0,True,.040),surface(c,x1,z1,True,.040),surface(c,x0,z1,True,.040)]
        K.box(bm,sum(pts,Vector())/4,(x1-x0,.010,z1-z0),bevel=.004,mat=1)
    return bm


def belt(ctx):
    bm=A.empty();c=ctx['cage'];K.band(bm,c,A.PART['torso'],1.008,1.034,0.027,n=48,thick=0.004)
    p=surface(c,0,1.02,False,0.037)
    K.box(bm,p,(0.039,0.008,0.026),bevel=0.004,mat=1)
    K.box(bm,p+Vector((0,-0.005,0)),(0.025,0.003,0.013),bevel=0.002,mat=0)
    return bm


def arm_cuffs(ctx,coat_name):
    bm=A.empty();coat=ctx['made'][coat_name]
    for side in [-1,1]:
        # Three hard segments leave flexible joints along the forearm.
        for lo,hi in [(.515,.545),(.551,.581),(.587,.617)]:
            panel(bm,coat,[(side*lo,-.07,1.43),(side*hi,-.065,1.43),
                          (side*hi,-.08,1.355),(side*lo,-.085,1.355)],offset=.009)
        p,n=projected(coat,(side*.567,-.09,1.39),.017)
        K.torus(bm,p,n,.011,.0025,seg=20,sides=6,mat=1)
        strap_on(bm,coat,[(side*.60,-.09,1.38),(side*.60,-.08,1.415)],width=.004,mat=1)
    return bm,garment_weights(bm,ctx,coat)


def cuffs(ctx):
    return arm_cuffs(ctx,'GravityJacket')


def lapels(ctx):
    bm=A.empty();coat=ctx['made']['GravityJacket']
    for side in [-1,1]:
        points=[(side*.09,-.10,1.43),(side*.035,-.12,1.45),(side*.045,-.13,1.36)]
        triangle_on(bm,coat,points,offset=.006,n=6)
        strap_on(bm,coat,[points[0],points[2]],width=.002,mat=1)
    for v in bm.verts:
        edge=any(f.material_index==1 for f in v.link_faces)
        v.co=projected(coat,v.co,.003 if edge else .002)[0]
    return bm,garment_weights(bm,ctx,coat)


def boot_panels(ctx):
    bm=A.empty();boots=bpy.data.objects['Boots']
    for side,name in [(-1,'foot_r'),(1,'foot_l')]:
        ankle=ctx['J'][name]
        x,y,z=ankle
        # A rounded ankle shell gives the technical boot its own silhouette.
        rows=[]
        for zz,rx,ry in [(.105,.052,.059),(.145,.052,.060),(.190,.037,.044)]:
            rows.append([bm.verts.new((x+rx*math.cos(t),.025+ry*math.sin(t),zz-(.012*math.cos(t)**2 if zz>.18 else 0)))
                         for t in np.linspace(0,math.tau,25)[:-1]])
        for lower,upper in zip(rows,rows[1:]):
            for k in range(24):
                bm.faces.new([lower[k],lower[(k+1)%24],upper[(k+1)%24],upper[k]])
        # The top return and segmented instep close against the existing boot.
        inner=[bm.verts.new(v.co+Vector((-math.cos(k*math.tau/24)*.004,-math.sin(k*math.tau/24)*.004,-.004))) for k,v in enumerate(rows[-1])]
        for k in range(24):bm.faces.new([rows[-1][k],rows[-1][(k+1)%24],inner[(k+1)%24],inner[k]])
        panel(bm,boots,[(x-.043,-.16,.06),(x+.043,-.16,.06),
                       (x+.045,-.065,.115),(x-.045,-.065,.115)],offset=.010)
        disc(bm,(x+side*.051,.025,.15),(side,0,0),.020)
        T.ribbon(bm,[(x,-.037,.145),(x,-.022,.188)],lambda p:(0,-1,0),.003,.002,mat=2)
    return bm,surface_weights(bm,boots)

BUILDERS={'GravityTrousers':tailored_trousers,'GravityJacket':tailored_jacket}
PROPS={'GravityShoulder':dict(build=shoulder,layer=3,hem=None),
       'GravityPack':dict(build=pack,bone='spine_03',layer=3,hem=None),
       'GravityBelt':dict(build=belt,bone='pelvis',layer=3,hem=None),
       'GravityCuffs':dict(build=cuffs,layer=3,hem=None),
       'GravityLapels':dict(build=lapels,layer=3,hem=None),
       'GravityBootPanels':dict(build=boot_panels,layer=3,hem=None)}
RELIEF={'GravityJacket':[cloth_relief('shirt'),T.raised(T.strap((-.13,0,1.08),(-.07,0,1.17),(0,-1,0),.008),height=.003,facing=(0,-1,0)),
                         T.raised(T.strap((.13,0,1.08),(.07,0,1.17),(0,-1,0),.008),height=.003,facing=(0,-1,0))],
        'GravityTrousers':[cloth_relief('trousers')]+
        [T.raised(T.rect(c,(0,1,0),(0,0,1),.045,.075),height=.005,facing=(s,0,0),where=lambda P,s=s:(s*P[:,0]>.1)*1.0) for s,c in POCKETS]+
        [T.raised(T.rect((c[0],c[1],c[2]+.088),(0,1,0),(0,0,1),.048,.016),height=.007,facing=(s,0,0),where=lambda P,s=s:(s*P[:,0]>.1)*1.0) for s,c in POCKETS]}
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
    if piece=='GravityJacket':
        put((np.abs(x)>.52)&(z>1.25),'cuff')                                    # the dark knit forearms
        put((np.abs(x-(1.42-z)*.055)<.0015)&front&(z<1.46)&(z>1.07),'metal')    # the slanted zip
    if piece=='GravityTrousers':
        for s,c in POCKETS:
            for (cz,hv) in ((c[2],.075),(c[2]+.088,.016)):
                sdf,_=T.rect((c[0],c[1],cz),(0,1,0),(0,0,1),.048,hv)
                put((sdf(P)<0)&(s*N[:,0]>.25)&(s*x>.1),'pocket')
    if piece==BOOTS:
        out[:]=np.array(PAL['boot'])/255
        put(z<.032,'sole')                                                      # the dark sole and its rand
    return out
