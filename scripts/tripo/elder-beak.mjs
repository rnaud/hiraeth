// Separate the fused source beak along its measured mouth seam. Both cut rims
// retain source UVs; matching inner surfaces close each half before articulation.
export function splitElderBeak(position,normal,uv,index,{height=.604,slope=.61,base=.20,start=.215,full=.245,minY=.50}={}){
 const positions=Array.from(position),normals=Array.from(normal),uvs=Array.from(uv),indices=[],sides=Array(position.length/3).fill(0),cuts=[],cache=new Map();
 const point=i=>positions.slice(i*3,i*3+3),seam=p=>p[1]-(height-slope*(p[2]-base));
 const add=(p,n,t,side)=>{const i=positions.length/3;positions.push(...p);normals.push(...n);uvs.push(...t);sides.push(side);return i;};
 const crossing=(a,b,side)=>{
  const key=`${Math.min(a,b)}:${Math.max(a,b)}:${side}`;if(cache.has(key))return cache.get(key);
  const pa=point(a),pb=point(b),t=seam(pa)/(seam(pa)-seam(pb));
  const mix=(array,size)=>Array.from({length:size},(_,k)=>array[a*size+k]*(1-t)+array[b*size+k]*t);
  const p=mix(positions,3),i=add(p,mix(normals,3),mix(uvs,2),side);cache.set(key,i);if(side===1)cuts.push(i);return i;
 };
 for(let at=0;at<index.length;at+=3){
  const tri=Array.from(index.slice(at,at+3)),ps=tri.map(point);
  const beak=ps.every(p=>p[2]>start&&p[1]>minY&&(seam(p)>-.025||p[2]>full));
  if(!beak){indices.push(...tri);continue;}
  // Original vertices belong rigidly to the appropriate beak half as well.
  tri.forEach(i=>sides[i]=seam(point(i))>=0?1:-1);
  for(const side of [1,-1]){
   const poly=[];
   for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],inside=seam(point(a))*side>=0,next=seam(point(b))*side>=0;if(inside)poly.push(a);if(inside!==next)poly.push(crossing(a,b,side));}
   for(let k=1;k<poly.length-1;k++)indices.push(poly[0],poly[k],poly[k+1]);
  }
 }
 // The bill seam is a narrow convex outline. Hull ignores duplicate UV seams
 // and makes a watertight interior without changing the textured exterior.
 const unique=new Map(cuts.map(i=>{const p=point(i);return [`${p[0].toFixed(6)},${p[2].toFixed(6)}`,i];}));
 const sorted=[...unique.values()].sort((a,b)=>positions[a*3]-positions[b*3]||positions[a*3+2]-positions[b*3+2]);
 const cross=(a,b,c)=>(positions[b*3]-positions[a*3])*(positions[c*3+2]-positions[a*3+2])-(positions[b*3+2]-positions[a*3+2])*(positions[c*3]-positions[a*3]);
 const hull=[];for(const i of sorted){while(hull.length>=2&&cross(hull.at(-2),hull.at(-1),i)<=0)hull.pop();hull.push(i);}const count=hull.length;for(const i of sorted.slice(0,-1).reverse()){while(hull.length>count&&cross(hull.at(-2),hull.at(-1),i)<=0)hull.pop();hull.push(i);}hull.pop();
 for(const side of [1,-1]){
  const cap=hull.map(i=>add(point(i),[0,-side,-slope*side],uvs.slice(i*2,i*2+2),side));
  for(let k=1;k<cap.length-1;k++)indices.push(...(side===1?[cap[0],cap[k],cap[k+1]]:[cap[0],cap[k+1],cap[k]]));
 }
 return {position:new Float32Array(positions),normal:new Float32Array(normals),uv:new Float32Array(uvs),index:new Uint32Array(indices),sides,cutVertices:cuts.length,capVertices:hull.length*2};
}
