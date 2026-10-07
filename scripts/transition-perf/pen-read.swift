// pen-read <mp4> <cx> <cy> <r>: every frame's presentation time (ms) and the loading pen's angle, one line a frame,
// "t angle" or "t -" (no pen: the game's frame, not the loader's paper). The reading of pen.mjs (the red nib's
// centroid round the pen's centre), on a screen recording of the handheld (adb shell screenrecord, H.264):
// AVFoundation decodes it here with each frame's own time (the recording only has a frame when the screen
// changed), which headless Chrome can't (its <video> draws blank into a canvas). Built by pen-android.mjs:
//   swiftc -O scripts/transition-perf/pen-read.swift -o <dir>/pen-read
import AVFoundation
import Foundation
let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let cx = Int(a[2])!, cy = Int(a[3])!, r = Int(a[4])!
let track = asset.tracks(withMediaType: .video)[0]
let reader = try! AVAssetReader(asset: asset)
let out = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(out)
reader.startReading()
while let sb = out.copyNextSampleBuffer() {
  guard let pb = CMSampleBufferGetImageBuffer(sb) else { continue }
  let t = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sb)) * 1000
  CVPixelBufferLockBaseAddress(pb, .readOnly)
  let w = CVPixelBufferGetWidth(pb), h = CVPixelBufferGetHeight(pb), row = CVPixelBufferGetBytesPerRow(pb)
  let p = CVPixelBufferGetBaseAddress(pb)!.assumingMemoryBound(to: UInt8.self)
  var sx = 0, sy = 0, n = 0
  for y in max(0, cy - r)..<min(h, cy + r) {
    for x in max(0, cx - r)..<min(w, cx + r) {
      let i = y * row + x * 4   // BGRA
      if p[i + 2] > 150 && p[i + 1] < 110 && p[i] < 100 { sx += x - cx; sy += y - cy; n += 1 }
    }
  }
  // the loader's paper (#f7ebd2-ish) at the pen's centre and in a corner; else it is the game, whatever red is there
  let c = min(cy, h - 1) * row + min(cx, w - 1) * 4, k = 20 * row + 20 * 4
  let paper = abs(Int(p[c + 2]) - 247) < 14 && abs(Int(p[c + 1]) - 235) < 14 && abs(Int(p[c]) - 210) < 18
    && abs(Int(p[k + 2]) - 247) < 14 && abs(Int(p[k]) - 210) < 18
  CVPixelBufferUnlockBaseAddress(pb, .readOnly)
  if n > 10 && paper { print(String(format: "%.2f %.2f", t, atan2(Double(sx) / Double(n), -Double(sy) / Double(n)) * 180 / Double.pi)) }
  else { print(String(format: "%.2f -", t)) }
}
