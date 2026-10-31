// The approved image's flat colours, measured (#800 family E): the mean of a 9 × 9 patch at each named pixel.
//
//   node pick-colours.mjs <image.png> name:x,y …
import sharp from 'sharp';

const [IN, ...spots] = process.argv.slice(2);
const { data, info } = await sharp(IN).removeAlpha().raw().toBuffer({ resolveWithObject: true });
for (const s of spots) {
  const [name, xy] = s.split(':'), [x, y] = xy.split(',').map(Number), sum = [0, 0, 0]; let n = 0;
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const k = ((y + j) * info.width + (x + i)) * 3; for (let c = 0; c < 3; c++) sum[c] += data[k + c]; n++; }
  console.log(name.padEnd(12), '#' + sum.map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join(''));
}
