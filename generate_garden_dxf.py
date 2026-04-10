import ezdxf
from ezdxf.enums import TextEntityAlignment
import math

doc = ezdxf.new("R2010")
msp = doc.modelspace()

# --- Rectangle: origin (0,0), 10000 x -2500 cm (Y inverted) ---
msp.add_lwpolyline(
    [(0, 0), (10000, 0), (10000, -2500), (0, -2500), (0, 0)],
    close=True,
    dxfattribs={"layer": "BOUNDARY"},
)

# --- Size mappings (diameters in cm) ---
SIZE_MAP = {"mic": 120, "mediu": 200, "mare": 300}

# --- Tree data: (name, size, x, y) ---
trees = [
    ("prun", "mare", 50, -880),
    ("prun", "mediu", 300, -100),
    ("mar", "mare", 1320, -1020),
    ("prun", "mic", 1400, -80),
    ("prun", "mic", 1500, -100),
    ("prun", "mare", 210, -1260),
    ("prun", "mic", 90, -1390),
    ("prun", "mediu", 50, -1660),
    ("prun", "mediu", 50, -2020),
    ("gutui", "mediu", 440, -1420),
    ("gutui", "mediu", 1120, -1200),
    ("gutui", "mediu", 700, -1600),
    ("mar", "mare", 2000, -1460),
    ("prun", "mediu", 1190, -1990),
    ("prun", "mare", 1460, -1970),
    ("prun", "mare", 890, -1930),
    ("prun", "mare", 490, -1900),
    ("visin", "mare", 4000, 0),
]

# Create layers
doc.layers.add("TREES", color=3)       # green
doc.layers.add("LABELS", color=7)      # white/black
doc.layers.add("BOUNDARY", color=7)
doc.layers.add("STALP", color=5)       # blue
doc.layers.add("POARTA", color=1)      # red
doc.layers.add("ROAD", color=8)        # gray
doc.layers.add("PARKING", color=9)     # light gray
doc.layers.add("CABIN_LIGHT", color=3)  # light green
doc.layers.add("CABIN_DARK", color=94)  # dark green
doc.layers.add("CABIN_OUTLINE", color=7)

# --- Draw trees ---
for name, size, x, y in trees:
    radius = SIZE_MAP[size] / 2
    letter = name[0].upper()

    # Circle
    msp.add_circle(
        center=(x, y),
        radius=radius,
        dxfattribs={"layer": "TREES"},
    )

    # Label (first letter) centered in circle
    msp.add_text(
        letter,
        height=radius * 0.8,
        dxfattribs={"layer": "LABELS"},
    ).set_placement((x, y), align=TextEntityAlignment.MIDDLE_CENTER)

# --- Stalp at (0, 260): 30cm square centered ---
sx, sy = 0, -260
half = 15  # 30/2
msp.add_lwpolyline(
    [
        (sx - half, sy - half),
        (sx + half, sy - half),
        (sx + half, sy + half),
        (sx - half, sy + half),
    ],
    close=True,
    dxfattribs={"layer": "STALP"},
)
msp.add_text(
    "S",
    height=20,
    dxfattribs={"layer": "LABELS"},
).set_placement((sx, sy), align=TextEntityAlignment.MIDDLE_CENTER)

# --- Poarta clanta at (0, -1280): red line going down 140cm ---
px, py = 0, -1280
msp.add_line(
    start=(px, py),
    end=(px, py - 140),
    dxfattribs={"layer": "POARTA"},
)
msp.add_text(
    "Poarta",
    height=30,
    dxfattribs={"layer": "POARTA"},
).set_placement((px + 10, py - 70), align=TextEntityAlignment.LEFT)

# --- Road: gray filled rectangle from (0,-2100) to (5000,-2500) ---
road_hatch = msp.add_hatch(color=8, dxfattribs={"layer": "ROAD"})
road_hatch.paths.add_polyline_path(
    [(0, -2100), (5000, -2100), (5000, -2500), (0, -2500)], is_closed=True
)
msp.add_lwpolyline(
    [(0, -2100), (5000, -2100), (5000, -2500), (0, -2500)],
    close=True,
    dxfattribs={"layer": "ROAD"},
)
msp.add_text(
    "Road",
    height=40,
    dxfattribs={"layer": "ROAD"},
).set_placement((2500, -2300), align=TextEntityAlignment.MIDDLE_CENTER)

# --- Parking: lighter gray filled rectangle from (4000,-1800) to (5000,-2100) ---
park_hatch = msp.add_hatch(color=9, dxfattribs={"layer": "PARKING"})
park_hatch.paths.add_polyline_path(
    [(2000, -1800), (3000, -1800), (3000, -2100), (2000, -2100)], is_closed=True
)
msp.add_lwpolyline(
    [(2000, -1800), (3000, -1800), (3000, -2100), (2000, -2100)],
    close=True,
    dxfattribs={"layer": "PARKING"},
)
msp.add_text(
    "Parking",
    height=40,
    dxfattribs={"layer": "PARKING"},
).set_placement((4500, -1950), align=TextEntityAlignment.MIDDLE_CENTER)

# --- Cabins: 700x500 cm, two-tone roof, rotated copies ---
def rotate_point(px, py, cx, cy, angle_deg):
    """Rotate point (px,py) around (cx,cy) by angle_deg (CCW)."""
    rad = math.radians(angle_deg)
    dx, dy = px - cx, py - cy
    nx = dx * math.cos(rad) - dy * math.sin(rad)
    ny = dx * math.sin(rad) + dy * math.cos(rad)
    return (cx + nx, cy + ny)

def draw_cabin(msp, origin_x, origin_y, angle_deg, label):
    """Draw a cabin at origin rotated by angle_deg (trigonometric/CCW).
    Cabin is 700 wide x 500 tall, split into two halves along X (top/bottom).
    """
    w, h = 700, 500
    # Unrotated corners relative to origin (top-left)
    # Full rectangle
    corners = [
        (origin_x, origin_y),
        (origin_x + w, origin_y),
        (origin_x + w, origin_y - h),
        (origin_x, origin_y - h),
    ]
    # Top half (light green) - upper 250
    top_half = [
        (origin_x, origin_y),
        (origin_x + w, origin_y),
        (origin_x + w, origin_y - h / 2),
        (origin_x, origin_y - h / 2),
    ]
    # Bottom half (dark green) - lower 250
    bot_half = [
        (origin_x, origin_y - h / 2),
        (origin_x + w, origin_y - h / 2),
        (origin_x + w, origin_y - h),
        (origin_x, origin_y - h),
    ]
    # Center for rotation
    cx = origin_x + w / 2
    cy = origin_y - h / 2

    # Rotate all points
    r_corners = [rotate_point(x, y, cx, cy, angle_deg) for x, y in corners]
    r_top = [rotate_point(x, y, cx, cy, angle_deg) for x, y in top_half]
    r_bot = [rotate_point(x, y, cx, cy, angle_deg) for x, y in bot_half]
    r_center = rotate_point(cx, cy, cx, cy, angle_deg)

    # Light green half (top)
    h1 = msp.add_hatch(color=3, dxfattribs={"layer": "CABIN_LIGHT"})
    h1.paths.add_polyline_path(r_top, is_closed=True)

    # Dark green half (bottom)
    h2 = msp.add_hatch(color=94, dxfattribs={"layer": "CABIN_DARK"})
    h2.paths.add_polyline_path(r_bot, is_closed=True)

    # Outline
    msp.add_lwpolyline(r_corners, close=True, dxfattribs={"layer": "CABIN_OUTLINE"})
    # Ridge line (middle divider)
    r_mid_l = rotate_point(origin_x, origin_y - h / 2, cx, cy, angle_deg)
    r_mid_r = rotate_point(origin_x + w, origin_y - h / 2, cx, cy, angle_deg)
    msp.add_line(start=r_mid_l, end=r_mid_r, dxfattribs={"layer": "CABIN_OUTLINE"})

    # Label
    msp.add_text(
        label,
        height=40,
        dxfattribs={"layer": "LABELS"},
    ).set_placement(r_center, align=TextEntityAlignment.MIDDLE_CENTER)

# 3 cabins: base rotation 10°, each +60°, each +1000cm in X
cabin_configs = [
    (1500, -1000, 10, "Cabin 1"),
    (2500, -1000, 70, "Cabin 2"),
    (3500, -1000, 130, "Cabin 3"),
]
for cx, cy, angle, label in cabin_configs:
    draw_cabin(msp, cx, cy, angle, label)

# Save
output_path = "data/garden_layout.dxf"
doc.saveas(output_path)
print(f"DXF saved to {output_path}")
