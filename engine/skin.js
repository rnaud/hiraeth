// three's skinning, folded into one matrix a bone for an engine's vertex shader:
//   three:  skinned = bindMatrixInverse · Σ wᵢ · boneMatrixᵢ · bindMatrix · position
//   here:   skinned = Σ wᵢ · Sᵢ · position,   Sᵢ = bindMatrixInverse · boneMatrixᵢ · bindMatrix
// (boneMatrixᵢ = bone world × its inverse bind, three's skeleton.boneMatrices.) The result is in
// the mesh's own space: the engine node carries the mesh's world matrix as for any other mesh.

/** out = a · b, 4×4 column-major (16 floats each, at offsets). */
export function mul4(a, ao, b, bo, out, oo) {
  for (let c = 0; c < 4; c++) {
    const b0 = b[bo + c * 4], b1 = b[bo + c * 4 + 1], b2 = b[bo + c * 4 + 2], b3 = b[bo + c * 4 + 3];
    for (let r = 0; r < 4; r++) out[oo + c * 4 + r] = a[ao + r] * b0 + a[ao + 4 + r] * b1 + a[ao + 8 + r] * b2 + a[ao + 12 + r] * b3;
  }
  return out;
}

const tmp = new Float32Array(16);
/** Sᵢ for n bones into out (16 n floats). */
export function skinMatrices(boneMatrices, n, bind, bindInverse, out = new Float32Array(n * 16)) {
  for (let i = 0; i < n; i++) {
    mul4(boneMatrices, i * 16, bind, 0, tmp, 0);
    mul4(bindInverse, 0, tmp, 0, out, i * 16);
  }
  return out;
}
