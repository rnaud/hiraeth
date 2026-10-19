"""A contact sheet of preview PNGs (same size), in Blender (no PIL here); written as PNG (sips makes the JPEG):
  Blender --background --factory-startup --python sheet.py -- <out.png> <columns> <a.png> <b.png> ...
"""
import bpy, sys
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
out, cols, files = argv[0], int(argv[1]), argv[2:]
imgs = [bpy.data.images.load(f) for f in files]
w, h = imgs[0].size
rows = (len(imgs) + cols - 1) // cols
canvas = np.ones((rows * h, cols * w, 4), dtype=np.float32)
for i, im in enumerate(imgs):
    px = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)
    r, c = rows - 1 - i // cols, i % cols      # (Blender's pixels run bottom-up)
    canvas[r * h:(r + 1) * h, c * w:(c + 1) * w] = px
sheet = bpy.data.images.new('sheet', cols * w, rows * h)
sheet.pixels[:] = canvas.ravel()
sheet.filepath_raw = out
sheet.file_format = 'PNG'

sheet.save_render(out)
