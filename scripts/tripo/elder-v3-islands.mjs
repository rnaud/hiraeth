// Below the feathered thighs, source topology separates both legs from the tail.
// Weld UV duplicates for connectivity, without altering the exported geometry.
export function elderIslands(pos,index){
 const N=pos.length/3,parent=Array.from({length:N},(_,i)=>i),cache=new Map(),cut=.235;
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const join=(a,b)=>parent[root(a)]=root(b);
 for(let i=0;i<N;i++){if(pos[i*3+1]>=cut)continue;const key=[pos[i*3],pos[i*3+1],pos[i*3+2]].map(x=>x.toFixed(5)).join();if(cache.has(key))join(i,cache.get(key));else cache.set(key,i);}
 for(let i=0;i<index.length;i+=3)for(let j=0;j<3;j++){const a=index[i+j],b=index[i+(j+1)%3];if(pos[a*3+1]<cut&&pos[b*3+1]<cut)join(a,b);}
 const groups=new Map();for(let i=0;i<N;i++)if(pos[i*3+1]<cut){const key=root(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
 const regions=new Uint8Array(N);
 for(const ids of groups.values()){if(ids.length<100)continue;const min=k=>Math.min(...ids.map(i=>pos[i*3+k])),max=k=>Math.max(...ids.map(i=>pos[i*3+k]));let label=0;
  if(min(1)<.07&&max(0)<0)label=1;else if(min(1)<.07&&min(0)>0)label=2;else if(min(2)<-.13&&min(0)>-.1&&max(0)<.1)label=3;
  if(label)for(const i of ids)regions[i]=label;
 }
 return regions;
}
