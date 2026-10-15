// Option 4, approved 15 October 2026. Source: f24ca4ef-8d15-499e-86b7-aa56024167a8, image 2.
export const MAKERS_MARK_ID = 'corner';
const corner = [['M', 25, 94], ['L', 24, 12], ['Q', 45, 10, 74, 12], ['L', 73, 27], ['Q', 60, 31, 46, 29], ['L', 45, 94]];
export const MAKERS_MARK_PATHS = [corner, [['M', 57, 47], ['Q', 65, 44, 73, 47], ['L', 73, 94], ['L', 56, 94]]];
export const MAKERS_MARK_SVG = '<svg class="glyph" width="18" height="24" fill="currentColor" viewBox="12 4 72 96" role="img" aria-label="the makers’ mark: an open corner and a short upright">' + MAKERS_MARK_PATHS.map(p => '<path stroke="none" d="' + p.map(c => c.join(' ')).join(' ') + ' Z"/>').join('') + '</svg>';
/** Sampled closed contours, centred in a square, x right and y up. */
export function markContours(size = 1) {
  const polys = MAKERS_MARK_PATHS.map(path => {
    const points = []; let x = 0, y = 0;
    for (const [op, ...p] of path) {
      if (op === 'Q') {
        const [cx,cy,ex,ey]=p, sx=x, sy=y;
        for(let i=1;i<=8;i++){const t=i/8,u=1-t; points.push([u*u*sx+2*u*t*cx+t*t*ex,u*u*sy+2*u*t*cy+t*t*ey]);}
        x=ex;y=ey;
      } else { [x,y]=p;points.push([x,y]); }
    }
    return points;
  });
  const all=polys.flat(), xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),k=size/Math.max(x1-x0,y1-y0);
  return polys.map(ps=>ps.map(([x,y])=>[(x-(x0+x1)/2)*k,((y0+y1)/2-y)*k]));
}
