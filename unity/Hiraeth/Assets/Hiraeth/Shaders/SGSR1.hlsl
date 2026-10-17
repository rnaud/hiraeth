//============================================================================================================
//
//
//                  Copyright (c) 2023, Qualcomm Innovation Center, Inc. All rights reserved.
//                              SPDX-License-Identifier: BSD-3-Clause
//
//============================================================================================================
//
// Snapdragon Game Super Resolution 1 (https://github.com/SnapdragonStudios/snapdragon-gsr, sgsr/v1/include/hlsl:
// sgsr1_mobile.h and the texture glue of sgsr1_shader_mobile.hlsl), for Hiraeth's Upscale.shader (issue #392).
// Changed here: the glue reads Unity's _UpSrc (an sRGB target, read back linear) and takes what it reads to gamma 2.0,
// as SGSR's thresholds are for display values; the user configuration as shipped (RGBA, no edge direction).
//
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
// following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following
//    disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the
//    following disclaimer in the documentation and/or other materials provided with the distribution.
//
// 3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote
//    products derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
// INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
// SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
// WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// SPDX-License-Identifier: BSD-3-Clause

#ifndef HIRAETH_SGSR1
#define HIRAETH_SGSR1

////////////////////////
// USER CONFIGURATION //
////////////////////////

/*
* Operation modes:
* RGBA -> 1
* RGBY -> 3
* LERP -> 4
*/
#define OperationMode 1

/*
* If set, will use edge direction to improve visual quality
* Expect a minimal cost increase
*/
// (Hiraeth, issue #392: on. Without it the one-texel ink lines come out stippled and stair-stepped along diagonals, the
// same on the device and in a line-for-line CPU run of this file: the clamp of twice the filtered luma to the nearest
// four texels snaps a thin dark line to them one output pixel at a time. With the edge's direction the kernel stretches
// along the line and the lines stay whole.)
#define UseEdgeDirection

#define EdgeThreshold 8.0/255.0

#define EdgeSharpness 2.0

// ---- the glue (sgsr1_shader_mobile.hlsl), on Unity's texture: gamma 2.0 out of the sRGB page
half4 SGSRGamma(half4 v) { return sqrt(max(v, half4(0, 0, 0, 0))); }
half4 SGSRRH(float2 p) { return SGSRGamma((half4)GATHER_RED_TEXTURE2D_X(_UpSrc, sampler_LinearClamp, p)); }
half4 SGSRGH(float2 p) { return SGSRGamma((half4)GATHER_GREEN_TEXTURE2D_X(_UpSrc, sampler_LinearClamp, p)); }
half4 SGSRBH(float2 p) { return SGSRGamma((half4)GATHER_BLUE_TEXTURE2D_X(_UpSrc, sampler_LinearClamp, p)); }
half4 SGSRAH(float2 p) { return (half4)GATHER_ALPHA_TEXTURE2D_X(_UpSrc, sampler_LinearClamp, p); }
half4 SGSRRGBH(float2 p) { return SGSRGamma((half4)SAMPLE_TEXTURE2D_X_LOD(_UpSrc, sampler_LinearClamp, p, 0)); }
half4 SGSRH(float2 p, uint channel)
{
    if (channel == 0) return SGSRRH(p);
    if (channel == 1) return SGSRGH(p);
    if (channel == 2) return SGSRBH(p);
    return SGSRAH(p);
}

// ///////SGSR_GL_Mobile.frag/////////////////////////////////////////
half fastLanczos2(half x)
{
	half wA = x- half(4.0);
	half wB = x*wA-wA;
	wA *= wA;
	return wB*wA;
}

#if defined(UseEdgeDirection)
half2 weightY(half dx, half dy, half c, half3 data)
#else
half2 weightY(half dx, half dy, half c, half data)
#endif
{
#if defined(UseEdgeDirection)
	half std = data.x;
	half2 dir = data.yz;

	half edgeDis = ((dx*dir.y)+(dy*dir.x));
	half x = (((dx*dx)+(dy*dy))+((edgeDis*edgeDis)*((clamp(((c*c)*std),0.0,1.0)*0.7)+-1.0)));
#else
	half std = data;
	half x = ((dx*dx)+(dy* dy))* half(0.5) + clamp(abs(c)*std, 0.0, 1.0);
#endif

	half w = fastLanczos2(x);
	return half2(w, w * c);
}

half2 edgeDirection(half4 left, half4 right)
{
	half2 dir;
	half RxLz = (right.x + (-left.z));
	half RwLy = (right.w + (-left.y));
	half2 delta;
	delta.x = (RxLz + RwLy);
	delta.y = (RxLz + (-RwLy));
	half lengthInv = rsqrt((delta.x * delta.x+ 3.075740e-05) + (delta.y * delta.y));
	dir.x = (delta.x * lengthInv);
	dir.y = (delta.y * lengthInv);
	return dir;
}

void SgsrYuvH(
	out half4 pix,
	float2 uv,
	float4 con1)
{
	int mode = OperationMode;
	half edgeThreshold = EdgeThreshold;
	half edgeSharpness = EdgeSharpness;
	if(mode == 1)
		pix.xyz = SGSRRGBH(uv).xyz;
    else
		pix.xyzw = SGSRRGBH(uv).xyzw;
	pix.w = 0;
	float xCenter;
	xCenter = abs(uv.x+-0.5);
	float yCenter;
	yCenter = abs(uv.y+-0.5);

	//todo: config the SR region based on needs
    //if ( mode!=4 && xCenter*xCenter+yCenter*yCenter<=0.4 * 0.4)
	if ( mode!=4)
	{
		float2 imgCoord = ((uv.xy*con1.zw)+ float2(-0.5,0.5));
		float2 imgCoordPixel = floor(imgCoord);
		float2 coord = (imgCoordPixel*con1.xy);
		half2 pl = (imgCoord+(-imgCoordPixel));
		half4  left = SGSRH(coord, mode);

		half edgeVote = abs(left.z - left.y) + abs(pix[mode] - left.y)  + abs(pix[mode] - left.z) ;
		if(edgeVote > edgeThreshold)
		{
			coord.x += con1.x;

			half4 right = SGSRH(coord + float2(con1.x,  0.0), mode);
			half4 upDown;
			upDown.xy = SGSRH(coord + float2(0.0, -con1.y), mode).wz;
			upDown.zw = SGSRH(coord + float2(0.0,  con1.y), mode).yx;

			half mean = (left.y+left.z+right.x+right.w)* half(0.25);
			left = left - half4(mean,mean,mean,mean);
			right = right - half4(mean, mean, mean, mean);
			upDown = upDown - half4(mean, mean, mean, mean);
			pix.w =pix[mode] - mean;

			half sum = (((((abs(left.x)+abs(left.y))+abs(left.z))+abs(left.w))+(((abs(right.x)+abs(right.y))+abs(right.z))+abs(right.w)))+(((abs(upDown.x)+abs(upDown.y))+abs(upDown.z))+abs(upDown.w)));
			half sumMean = 1.014185e+01/sum;
			half std = (sumMean*sumMean);

#if defined(UseEdgeDirection)
			half3 data = half3(std, edgeDirection(left, right));
#else
			half data = std;
#endif

			half2 aWY = weightY(pl.x, pl.y+1.0, upDown.x,data);
			aWY += weightY(pl.x-1.0, pl.y+1.0, upDown.y,data);
			aWY += weightY(pl.x-1.0, pl.y-2.0, upDown.z,data);
			aWY += weightY(pl.x, pl.y-2.0, upDown.w,data);
			aWY += weightY(pl.x+1.0, pl.y-1.0, left.x,data);
			aWY += weightY(pl.x, pl.y-1.0, left.y,data);
			aWY += weightY(pl.x, pl.y, left.z,data);
			aWY += weightY(pl.x+1.0, pl.y, left.w,data);
			aWY += weightY(pl.x-1.0, pl.y-1.0, right.x,data);
			aWY += weightY(pl.x-2.0, pl.y-1.0, right.y,data);
			aWY += weightY(pl.x-2.0, pl.y, right.z,data);
			aWY += weightY(pl.x-1.0, pl.y, right.w,data);

			half finalY = aWY.y/aWY.x;

			half max4 = max(max(left.y,left.z),max(right.x,right.w));
			half min4 = min(min(left.y,left.z),min(right.x,right.w));
			finalY = clamp(edgeSharpness*finalY, min4, max4);

			half deltaY = finalY -pix.w;

			pix.x = saturate((pix.x+deltaY));
			pix.y = saturate((pix.y+deltaY));
			pix.z = saturate((pix.z+deltaY));
		}
	}
	pix.w = 1.0;  //assume alpha channel is not used

}
#endif
