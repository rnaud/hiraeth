"""Fitted segmented suit armour for the solar voyager and comet pathfinder."""
import math
import bmesh
import numpy as np
from mathutils import Vector
import garments as G
import outfit_approved_kit as A
import outfit_sea_tailoring as D
import outfit_kit as K
import tailor as T


def suit(cage,J):
    bm=G.cut(cage,lambda v,p:(p==A.PART['torso'] and v.co.z>=.99)
             or (p==A.PART['arm'] and abs(v.co.x)<=.64))
    G.inflate(bm,lambda p,part:.014 if part==A.PART['arm'] else .017)
    for loop in G.boundary_loops(bm):
        c=sum((v.co for v in loop),Vector())/len(loop)
        if c.z>1.30 and abs(c.x)<.12:
            out=G.radial((0,c.y))
            stand=G.extrude(bm,loop,lambda p,v:p+Vector((0,0,.038))+out(p)*.003)
            G.extrude(bm,stand,lambda p,v:p+out(p)*.006-Vector((0,0,.006)))
        elif abs(c.x)>.3:
            sx=math.copysign(1,c.x)
            radial=lambda p:(p-Vector((p.x,c.y,c.z))).normalized()
            cuff=G.extrude(bm,loop,lambda p,v:p+radial(p)*.006)
            G.extrude(bm,cuff,lambda p,v:p-Vector((sx*.025,0,0)))
    return A.orient(bm)


def panel(bm,ob,outline,mat=0,offset=.012,projection='closest'):
    """Curved shell with an actual return edge, fitted to the garment surface."""
    before=set(bm.faces)
    centre=sum((Vector(p) for p in outline),Vector())/len(outline)
    side=-1 if centre.y<0 else 1
    def project(p,off):
        if projection=='closest':
            return D.projected(ob,p,off)
        if projection=='top':
            origin,direction=Vector((p.x,p.y,3)),Vector((0,0,-1))
        else:
            origin,direction=Vector((p.x,side*2,p.z)),Vector((0,-side,0))
        ok,q,n,_=ob.ray_cast(origin,direction)
        if ok:
            return q+n*off,n
        return D.projected(ob,p,off)
    for a,b in zip(outline,outline[1:]+outline[:1]):
        D.triangle_on(bm,ob,[centre,a,b],mat=mat,offset=offset,n=4,projector=project)
    faces=[f for f in bm.faces if f not in before]
    verts=list({v for f in faces for v in f.verts})
    bmesh.ops.remove_doubles(bm,verts=verts,dist=.00001)
    faces=[f for f in bm.faces if f not in before]
    bm.normal_update()
    # Solidify's miter extension can explode on a nearly collapsed boundary.
    # A bounded normal extrusion keeps every shell vertex within four mm.
    normals={tuple(v.co):v.normal.copy().normalized() for f in faces for v in f.verts}
    result=bmesh.ops.extrude_face_region(bm,geom=faces,use_keep_orig=True)
    for v in result['geom']:
        if isinstance(v,bmesh.types.BMVert):
            v.co+=normals.get(tuple(v.co),Vector((0,side,0)))*.004
    bmesh.ops.recalc_face_normals(bm,faces=[f for f in bm.faces if f not in before])
    bm.normal_update()


def rivet(bm,ob,p,mat=1,r=.006,inset=False):
    q,n=D.projected(ob,p,.021)
    K.torus(bm,q,n,r,.0025,seg=18,sides=6,mat=mat)
    if inset:
        T.lathe(bm,q-n*.002,n,[(0,r*.72),(.004,r*.72)],segments=18,mat=mat)


def seams(ob,J):
    # Narrow sewn suit panels: volume rather than painted shadows.
    report={}
    for s in [-1,1]:
        report[str(s)]=T.raised(T.strap((s*.105,0,1.04),(s*.14,0,1.36),(0,-1,0),.012),
                               height=.002,facing=(0,-1,0))(ob,J)
    return report


def limb_panels(ctx,shirt,trousers,coral=False):
    bm=A.empty(); upper=ctx['made'][shirt]; lower=ctx['made'][trousers]
    ankle_vertices=set()
    for s in [-1,1]:
        # Forearm bracers stop short of elbow and wrist bending zones.
        panel(bm,upper,[(s*.455,-.08,1.40),(s*.645,-.07,1.39),
                        (s*.665,-.075,1.34),(s*.475,-.09,1.32)],mat=0,projection='depth')
        # Front shin shells leave a free gap below the articulated knee cap.
        panel(bm,lower,[(s*.095,-.15,.46),(s*.16,-.15,.46),
                        (s*.17,-.12,.27),(s*.12,-.11,.215),(s*.085,-.12,.28)],mat=0,projection='depth')
        panel(bm,lower,[(s*.095,-.15,.565),(s*.165,-.15,.55),
                        (s*.17,-.15,.51),(s*.13,-.16,.49),(s*.09,-.15,.52)],mat=2 if coral else 0,projection='depth')
        before_ankle=set(bm.verts)
        ankle_guard(bm,s,mat=0)
        ankle_vertices.update(set(bm.verts)-before_ankle)
        rivet(bm,upper,(s*.51,-.15,1.375),r=.012,inset=True)
        rivet(bm,lower,(s*.13,-.2,.545),r=.012,inset=True)
    upper_weights=D.garment_weights(bm,ctx,upper)
    lower_weights=D.garment_weights(bm,ctx,lower)
    body_weights=D.surface_weights(bm,ctx['body'])
    return bm,[body_weights[i] if v in ankle_vertices else upper_weights[i] if abs(v.co.x)>.35 else lower_weights[i] for i,v in enumerate(bm.verts)]


def neutral_paint(palette,zones,piece,zone,P,N,J):
    out=A.seam_paint(palette,zones,piece,zone,P,N,J)
    if 'Suit' in piece:
        x,y,z=P.T
        front=np.clip(-N[:,1]*3,0,1)
        centre=K.band_mask(x,.0015,.0008)*front*(z>1.02)*(z<1.45)
        out=D.stitched(out,centre,palette['ink'],.7)
    return out


def shoulder_shell(bm,ob,s,mat=0):
    """Broad articulated crown, sampled radially around the upper arm."""
    rows=[]
    for i in range(9):
        t=i/8; x=s*(.145+.165*t)
        row=[]
        for j in range(17):
            a=-1.85+j/16*3.70
            radial=Vector((0,math.sin(a),math.cos(a)))
            centre=Vector((x,.05,1.39-.018*t))
            ok,q,n,_=ob.ray_cast(centre+radial*2,-radial)
            if not ok: q,n=D.projected(ob,centre+radial*.085,0)
            # Raised crown tapers to a close return at both ends.
            p=q+n*(.008+.010*math.sin(math.pi*t))
            row.append(bm.verts.new(p))
        rows.append(row)
    for i in range(8):
        for j in range(16):
            f=bm.faces.new((rows[i][j],rows[i+1][j],rows[i+1][j+1],rows[i][j+1]));f.material_index=mat
            f.normal_update()
            c=f.calc_center_median(); radial=Vector((0,c.y-.05,c.z-1.38))
            if f.normal.dot(radial)<0: f.normal_flip()
    bm.normal_update()


def ankle_guard(bm,s,mat=0):
    """Boot shaft connects the shoe opening to the lower shin shell."""
    rows=[]
    for z,rx,ry in [(.075,.061,.075),(.10,.059,.068),(.16,.052,.060),(.285,.058,.068)]:
        row=[]
        for j in range(24):
            a=j/24*math.tau
            row.append(bm.verts.new((s*.132+rx*math.cos(a),.022+ry*math.sin(a),z)))
        rows.append(row)
    for i in range(3):
        for j in range(24):
            k=(j+1)%24
            f=bm.faces.new((rows[i][j],rows[i][k],rows[i+1][k],rows[i+1][j]));f.material_index=mat
    bm.normal_update()
