"""Draw the app's small vector-style observatory emblem using only stdlib."""
import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'public' / 'icons'
INK = (43, 33, 31)
SKY = (111, 159, 211)
SAND = (239, 219, 184)
GOLD = (216, 162, 74)
CREAM = (255, 246, 220)


def pixel(x, y):
    color = SKY
    horizon = 0.66 + 0.06 * math.sin(x * 7)
    if y > horizon:
        color = SAND
    if abs(y - horizon) < 0.009:
        color = INK
    # Broad, stepped tower and dark open chamber, inside the icon safe zone.
    for left, right, top, bottom in [(0.29, 0.71, 0.70, 0.80), (0.33, 0.67, 0.58, 0.70), (0.37, 0.63, 0.48, 0.58)]:
        if left <= x <= right and top <= y <= bottom:
            color = INK if min(x-left, right-x, y-top, bottom-y) < 0.009 else CREAM
    if 0.455 < x < 0.545 and 0.51 < y < 0.58:
        color = INK
    if 0.49 < x < 0.51 and 0.29 < y < 0.48:
        color = INK
    r = math.hypot(x - 0.5, y - 0.32)
    if 0.095 < r < 0.145:
        color = INK if r < 0.105 or r > 0.135 else GOLD
    return color


def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))


def draw(size):
    raw = bytearray()
    for row in range(size):
        raw.append(0)
        for col in range(size):
            samples = [pixel((col + dx) / size, (row + dy) / size) for dx in (0.25, 0.75) for dy in (0.25, 0.75)]
            raw.extend(round(sum(p[c] for p in samples) / 4) for c in range(3))
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    data += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    (OUT / f'icon-{size}.png').write_bytes(data)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (180, 192, 512):
        draw(size)
