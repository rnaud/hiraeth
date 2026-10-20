"""Surface-following details for the mechanic and festival outfits; no baked lighting."""
import math
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree
import tailor as T
import outfit_kit as K


def cloth_relief(kind,amount=1,thigh_amount=1):
    """Soft sewn-cloth volume, supported at cuffs, knees and waist; never negative."""
    def op(ob, J):
        P, N = T._coords(ob.data), T._normals(ob.data)
        x,y,z = P.T
        ax = np.abs(x)
        if kind == 'shirt':
            arm = T.smooth01(.18,.25,ax)
            angle = np.arctan2(z-1.37,y)
            gathers = np.exp(-((ax-.43)/.065)**2)
            d = arm * (.0025*(1+np.sin(ax*105+angle*1.5)) + .004*gathers*(1+np.sin(ax*155+angle)))
            waist = T.smooth01(1.27,1.02,z) * (1-arm)
            d += waist*.003*(1+np.sin(x*105+z*8))
        elif kind == 'trousers':
            angle = np.arctan2(y,ax-.13)
            knee = np.exp(-((z-.52)/.12)**2)
            cuff = np.exp(-((z-.29)/.055)**2)
            thigh = T.smooth01(.98,.85,z)*T.smooth01(.55,.70,z)
            d = .0035*knee*(1+np.sin(z*92+angle*1.7))
            d += .004*cuff*(1+np.sin(z*160+angle*1.3))
            d += .004*thigh_amount*thigh*(1+np.sin(angle*5+z*8))
        else:
            d = .002*T.smooth01(1.3,1.02,z)*(1+np.sin(x*65+z*18))
        T._move(ob.data,N*(d*amount)[:,None])
        return {'shapedVertices':int((d>.001).sum())}
    return op


def projected(ob, p, offset=.006):
    ok,q,n,_ = ob.closest_point_on_mesh(Vector(p))
    if not ok:
        raise RuntimeError('A garment detail has no supporting surface')
    return q+n*offset,n


def strap_on(bm,ob,anchors,width=.032,mat=0):
    points=[]
    for a,b in zip(anchors,anchors[1:]):
        a,b=Vector(a),Vector(b)
        count=max(2,math.ceil((b-a).length/.012))
        for k in range(count):
            points.append(projected(ob,a.lerp(b,k/count),.009)[0])
    points.append(projected(ob,anchors[-1],.009)[0])
    T.ribbon(bm,points,lambda p:projected(ob,p,0)[1],width/2,thick=.0025,mat=mat)


def triangle_on(bm,ob,corners,mat=0,offset=.009,n=5,projector=None):
    """A fitted triangular facing, subdivided to follow its supporting cloth."""
    a,b,c=map(Vector,corners)
    project=projector or (lambda p,off:projected(ob,p,off))
    rows={}; faces=[]
    for i in range(n+1):
        for j in range(n+1-i):
            p=a+(b-a)*(i/n)+(c-a)*(j/n)
            rows[i,j]=bm.verts.new(project(p,offset)[0])
    for i in range(n):
        for j in range(n-i):
            f=bm.faces.new([rows[i,j],rows[i+1,j],rows[i,j+1]])
            f.material_index=mat
            faces.append(f)
            if j<n-i-1:
                f=bm.faces.new([rows[i+1,j],rows[i+1,j+1],rows[i,j+1]])
                f.material_index=mat
                faces.append(f)
    bm.normal_update()
    for f in faces:
        if f.normal.dot(project(f.calc_center_median(),0)[1])<0:
            f.normal_flip()


def surface_weights(bm,ob):
    kd=KDTree(len(ob.data.vertices))
    for v in ob.data.vertices:
        kd.insert(v.co,v.index)
    kd.balance()
    W=K.weights_of(ob)
    arm=next((m.object for m in ob.modifiers if m.type=='ARMATURE' and m.object),None)
    if arm:
        deform={b.name for b in arm.data.bones if b.use_deform}
        W=[{name:w for name,w in weights.items() if name in deform} for weights in W]
    result=[]
    for v in bm.verts:
        found=kd.find_n(v.co,8); blend={}
        for _,index,d in found:
            share=1/max(d,.002)**2
            for name,weight in W[index].items():
                blend[name]=blend.get(name,0)+weight*share
        largest=sorted(blend.items(),key=lambda kv:kv[1],reverse=True)[:4]
        total=sum(w for _,w in largest)
        result.append({name:w/total for name,w in largest})
    return result


def stitched(out,mask,color,amount=.6):
    return out*(1-mask[:,None]*amount)+np.asarray(color)/255*mask[:,None]*amount


def garment_weights(bm,ctx,ob):
    """Use the very same smoothed skin field as the supporting finished garment."""
    import outfit as pipeline
    pipeline.BONES=ctx['bones']
    modifiers=set(ob.modifiers)
    pipeline.weight_from(ctx['arm'],[ctx['body'],ctx['skin']],ob)
    weights=surface_weights(bm,ob)
    for modifier in list(ob.modifiers):
        if modifier not in modifiers:
            ob.modifiers.remove(modifier)
    return weights


def hug_band(bm,garments,gap=.002):
    """Seat a belt's rings on the actual outer garments, avoiding an oversized hoop."""
    ring_size=len(bm.verts)//4
    for i,v in enumerate(bm.verts):
        radial=Vector((v.co.x,v.co.y,0)).normalized()
        points=[]
        for ob in garments:
            origin=radial*2; origin.z=v.co.z
            ok,p,_,_=ob.ray_cast(origin,-radial)
            if ok: points.append(p)
        if not points: points=[projected(ob,v.co,0)[0] for ob in garments]
        r=max(p.dot(radial) for p in points)+(gap+.003 if i//ring_size in [1,2] else gap)
        v.co.x,v.co.y=radial.x*r,radial.y*r
