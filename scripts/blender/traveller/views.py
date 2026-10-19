"""Preview renders for the traveller (issue #493): orthographic turnaround views, Workbench (flat colour,
an outline) or Eevee, from the command line."""
import math
import bpy
from mathutils import Vector

VIEWS = {
    # name: (direction the camera looks from, as an azimuth in degrees from the front; elevation)
    'front': (0, 0), 'three-quarter': (40, 4), 'side': (90, 0), 'back': (180, 0),
}


def setup(engine='WORKBENCH', size=(900, 1400), film=False):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH' if engine == 'WORKBENCH' else 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = film
    sc.render.image_settings.file_format = 'PNG'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    if engine == 'WORKBENCH':
        sh = sc.display.shading
        sh.light = 'STUDIO'
        sh.color_type = 'MATERIAL'
        sh.show_object_outline = True
        sh.object_outline_color = (0.08, 0.07, 0.06)
        sh.show_cavity = False
        sh.show_specular_highlight = False
        sc.display.render_aa = '8'
    world = bpy.data.worlds.get('Preview') or bpy.data.worlds.new('Preview')
    world.color = (0.93, 0.9, 0.82)
    sc.world = world
    sh = sc.display.shading
    sh.background_type = 'WORLD' if engine == 'WORKBENCH' else sh.background_type
    return sc


def camera(name='PreviewCam'):
    sc = bpy.context.scene
    ob = bpy.data.objects.get(name)
    if not ob:
        cam = bpy.data.cameras.new(name)
        cam.type = 'ORTHO'
        ob = bpy.data.objects.new(name, cam)
        sc.collection.objects.link(ob)
    sc.camera = ob
    return ob


def shoot(path, centre, height, azimuth=0, elevation=0, dist=6.0):
    """Look at `centre` from azimuth (0 = in front of him, 90 = his left side) with `height` metres in frame."""
    cam = camera()
    a, e = math.radians(azimuth), math.radians(elevation)
    # he faces -Y: in front of him is -Y; his left is +X
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    cam.location = Vector(centre) + d * dist
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    sc = bpy.context.scene
    cam.data.ortho_scale = height * max(1.0, sc.render.resolution_x / sc.render.resolution_y)
    cam.data.clip_end = dist * 3
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
