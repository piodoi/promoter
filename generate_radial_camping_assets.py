from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "data" / "camping_design"

SITE_WIDTH = 50.0
SITE_HEIGHT = 21.0
ROAD_WIDTH = 4.0

CENTER_TREE = (10.0, -1.5)
INTERIOR_FOCUS = (1.5, -0.3)

CABIN_WIDTH = 5.0
CABIN_DEPTH = 4.0
DECK_DEPTH = 1.8
PATH_WIDTH = 1.2
CONTAINER_WIDTH = 8.0
CONTAINER_DEPTH = 6.0


@dataclass
class Cabin:
    name: str
    center_x: float
    center_y: float
    front_deg: float
    footprint: list[list[float]]
    deck: list[list[float]]


def round_point(point: tuple[float, float] | list[float]) -> list[float]:
    return [round(point[0], 4), round(point[1], 4)]


def axis_aligned_rectangle(center_x: float, center_y: float, width: float, depth: float) -> list[list[float]]:
    half_width = width / 2.0
    half_depth = depth / 2.0
    return [
        round_point((center_x - half_width, center_y - half_depth)),
        round_point((center_x + half_width, center_y - half_depth)),
        round_point((center_x + half_width, center_y + half_depth)),
        round_point((center_x - half_width, center_y + half_depth)),
    ]


def oriented_rectangle(
    center_x: float,
    center_y: float,
    side_x: float,
    side_y: float,
    front_x: float,
    front_y: float,
    width: float,
    depth: float,
) -> list[list[float]]:
    half_width = width / 2.0
    half_depth = depth / 2.0
    corners = []
    for local_x, local_y in [
        (-half_width, -half_depth),
        (half_width, -half_depth),
        (half_width, half_depth),
        (-half_width, half_depth),
    ]:
        x = center_x + side_x * local_x + front_x * local_y
        y = center_y + side_y * local_x + front_y * local_y
        corners.append([round(x, 4), round(y, 4)])
    return corners


def place_cabin(center_x: float, center_y: float, target_x: float, target_y: float, name: str) -> Cabin:
    dx = target_x - center_x
    dy = target_y - center_y
    length = math.hypot(dx, dy)
    front_x = dx / length
    front_y = dy / length
    side_x = -front_y
    side_y = front_x
    footprint = oriented_rectangle(center_x, center_y, side_x, side_y, front_x, front_y, CABIN_WIDTH, CABIN_DEPTH)
    deck_center_x = center_x - front_x * (CABIN_DEPTH / 2.0 + DECK_DEPTH / 2.0)
    deck_center_y = center_y - front_y * (CABIN_DEPTH / 2.0 + DECK_DEPTH / 2.0)
    deck = oriented_rectangle(deck_center_x, deck_center_y, side_x, side_y, front_x, front_y, CABIN_WIDTH, DECK_DEPTH)
    return Cabin(
        name=name,
        center_x=round(center_x, 4),
        center_y=round(center_y, 4),
        front_deg=round(math.degrees(math.atan2(front_y, front_x)), 3),
        footprint=footprint,
        deck=deck,
    )


def build_layout() -> dict:
    cabin_points = [
        ("C1", -8.8, 1.2),
        ("C2", -4.8, 3.0),
        ("C3", -0.8, 4.0),
        ("C4", 3.2, 3.0),
        ("C5", 7.2, 1.2),
        ("C6", 11.2, -1.0),
    ]
    cabins = [asdict(place_cabin(x, y, INTERIOR_FOCUS[0], INTERIOR_FOCUS[1], name)) for name, x, y in cabin_points]

    left_edge = -SITE_WIDTH / 2.0
    top_edge = SITE_HEIGHT / 2.0
    container_top_left_x = left_edge + 5.0
    container_top_left_y = top_edge - 4.0
    container_center_x = container_top_left_x + CONTAINER_WIDTH / 2.0
    container_center_y = container_top_left_y - CONTAINER_DEPTH / 2.0
    container = {
        "name": "CT1",
        "center_x": round(container_center_x, 4),
        "center_y": round(container_center_y, 4),
        "width": CONTAINER_WIDTH,
        "depth": CONTAINER_DEPTH,
        "top_left": round_point((container_top_left_x, container_top_left_y)),
        "footprint": axis_aligned_rectangle(container_center_x, container_center_y, CONTAINER_WIDTH, CONTAINER_DEPTH),
    }

    road_segments = [
        {"name": "north", "footprint": axis_aligned_rectangle(0.0, top_edge - ROAD_WIDTH / 2.0, SITE_WIDTH, ROAD_WIDTH)},
        {"name": "east", "footprint": axis_aligned_rectangle(SITE_WIDTH / 2.0 - ROAD_WIDTH / 2.0, 0.0, ROAD_WIDTH, SITE_HEIGHT)},
        {"name": "south", "footprint": axis_aligned_rectangle(0.0, -top_edge + ROAD_WIDTH / 2.0, SITE_WIDTH, ROAD_WIDTH)},
    ]

    foot_path = [
        round_point((-10.5, -0.4)),
        round_point((-8.0, 0.6)),
        round_point((-5.5, 1.2)),
        round_point((-3.0, 0.7)),
        round_point((-0.5, -0.2)),
        round_point((2.0, -0.8)),
        round_point((4.5, -0.5)),
        round_point((7.0, -0.9)),
        round_point((10.0, -1.8)),
    ]

    return {
        "site": {
            "width": SITE_WIDTH,
            "height": SITE_HEIGHT,
            "center_tree": {
                "x": CENTER_TREE[0],
                "y": CENTER_TREE[1],
                "trunk_radius": 0.45,
                "canopy_radius": 2.6,
            },
            "interior_focus": round_point(INTERIOR_FOCUS),
            "path_width": PATH_WIDTH,
            "road_width": ROAD_WIDTH,
        },
        "cabins": cabins,
        "container": container,
        "road_segments": road_segments,
        "foot_path": foot_path,
        "notes": {
            "description": "Organic sine-line cabin arrangement inside a 50 x 21 m lot, clear of the perimeter road.",
            "assumption": "Cabins face the shared interior focus rather than a circular center.",
        },
    }


def dxf_pair(code: int | str, value: int | float | str) -> str:
    return f"{code}\n{value}\n"


def dxf_circle(x: float, y: float, radius: float, layer: str) -> str:
    return "".join(
        [
            dxf_pair(0, "CIRCLE"),
            dxf_pair(8, layer),
            dxf_pair(10, round(x, 4)),
            dxf_pair(20, round(y, 4)),
            dxf_pair(30, 0.0),
            dxf_pair(40, round(radius, 4)),
        ]
    )


def dxf_text(x: float, y: float, text: str, height: float, layer: str) -> str:
    return "".join(
        [
            dxf_pair(0, "TEXT"),
            dxf_pair(8, layer),
            dxf_pair(10, round(x, 4)),
            dxf_pair(20, round(y, 4)),
            dxf_pair(30, 0.0),
            dxf_pair(40, height),
            dxf_pair(1, text),
        ]
    )


def dxf_lwpolyline(points: list[list[float]], layer: str, closed: bool = False, width: float | None = None) -> str:
    data = [
        dxf_pair(0, "LWPOLYLINE"),
        dxf_pair(8, layer),
        dxf_pair(90, len(points)),
        dxf_pair(70, 1 if closed else 0),
    ]
    if width is not None:
        data.append(dxf_pair(43, round(width, 4)))
    for x, y in points:
        data.extend([dxf_pair(10, round(x, 4)), dxf_pair(20, round(y, 4))])
    return "".join(data)


def add_closed_shape(points: list[list[float]], layer: str) -> str:
    return dxf_lwpolyline(points, layer, closed=True)


def write_dxf(layout: dict, output_path: Path) -> None:
    entities: list[str] = []
    half_width = SITE_WIDTH / 2.0
    half_height = SITE_HEIGHT / 2.0
    site = [[-half_width, -half_height], [half_width, -half_height], [half_width, half_height], [-half_width, half_height]]

    entities.append(add_closed_shape(site, "SITE"))
    for segment in layout["road_segments"]:
        entities.append(add_closed_shape(segment["footprint"], "ROAD"))
    entities.append(dxf_lwpolyline(layout["foot_path"], "PATH", width=PATH_WIDTH))
    entities.append(dxf_circle(layout["site"]["center_tree"]["x"], layout["site"]["center_tree"]["y"], layout["site"]["center_tree"]["canopy_radius"], "TREE"))
    entities.append(dxf_circle(layout["site"]["center_tree"]["x"], layout["site"]["center_tree"]["y"], layout["site"]["center_tree"]["trunk_radius"], "TREE"))
    entities.append(dxf_text(-half_width + 1.0, half_height - 1.2, "CAMPING MASTERPLAN", 0.7, "TEXT"))
    entities.append(dxf_text(-half_width + 1.0, half_height - 2.2, "Sine-line cabin layout", 0.45, "TEXT"))

    for cabin in layout["cabins"]:
        entities.append(add_closed_shape(cabin["footprint"], "CABIN"))
        entities.append(add_closed_shape(cabin["deck"], "DECK"))
        entities.append(dxf_text(cabin["center_x"], cabin["center_y"], cabin["name"], 0.35, "TEXT"))

    entities.append(add_closed_shape(layout["container"]["footprint"], "CONTAINER"))
    entities.append(dxf_text(layout["container"]["center_x"], layout["container"]["center_y"], layout["container"]["name"], 0.45, "TEXT"))

    dxf = "".join(
        [
            dxf_pair(0, "SECTION"),
            dxf_pair(2, "HEADER"),
            dxf_pair(9, "$INSUNITS"),
            dxf_pair(70, 6),
            dxf_pair(0, "ENDSEC"),
            dxf_pair(0, "SECTION"),
            dxf_pair(2, "ENTITIES"),
            *entities,
            dxf_pair(0, "ENDSEC"),
            dxf_pair(0, "EOF"),
        ]
    )
    output_path.write_text(dxf, encoding="ascii")


def build_html(layout: dict) -> str:
    layout_json = json.dumps(layout, separators=(",", ":"))
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Camping Area 3D Viewer</title>
    <style>
        :root {{
            --sky: #d7e6d1;
            --panel: rgba(249, 245, 236, 0.92);
            --ink: #233126;
        }}

        body {{
            margin: 0;
            overflow: hidden;
            background: radial-gradient(circle at 30% 20%, #e5eee2 0%, #c8d9cb 45%, #95b09f 100%);
            font-family: Georgia, "Times New Roman", serif;
        }}

        #info {{
            position: absolute;
            top: 20px;
            left: 20px;
            background: var(--panel);
            padding: 16px 20px;
            border-radius: 14px;
            box-shadow: 0 12px 36px rgba(17, 29, 20, 0.16);
            color: var(--ink);
            max-width: 360px;
            z-index: 1;
        }}

        #info h1 {{
            margin: 0 0 6px 0;
            font-size: 1.15rem;
            letter-spacing: 0.04em;
        }}

        #info p {{
            margin: 0.3rem 0;
            font-size: 0.94rem;
            line-height: 1.35;
        }}

        #loading {{
            position: absolute;
            inset: 0;
            display: grid;
            place-items: center;
            color: white;
            font-size: 1.35rem;
            background: linear-gradient(135deg, rgba(40, 61, 45, 0.25), rgba(25, 38, 29, 0.48));
            z-index: 2;
        }}
    </style>
    <script type="importmap">
        {{
            "imports": {{
                "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
                "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
            }}
        }}
    </script>
</head>
<body>
    <div id="loading">Loading sine-line layout...</div>
    <div id="info">
        <h1>Camping Masterplan</h1>
        <p>Cabins now follow a soft sine-like line and face the shared interior.</p>
        <p>The circular center is removed and replaced with a small brown footpath.</p>
        <p>Site dimensions remain 50 m by 21 m.</p>
    </div>

    <script type="module">
        import * as THREE from 'three';
        import {{ OrbitControls }} from 'three/addons/controls/OrbitControls.js';

        const layout = {layout_json};

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xd7e6d1);
        scene.fog = new THREE.FogExp2(0xd7e6d1, 0.01);

        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 300);
        camera.position.set(34, 26, 28);

        const renderer = new THREE.WebGLRenderer({{ antialias: true }});
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2 - 0.05;
        controls.target.set(0, 1.4, 0);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.76);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xfff0d0, 1.25);
        sunLight.position.set(28, 40, 16);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.left = -35;
        sunLight.shadow.camera.right = 35;
        sunLight.shadow.camera.top = 25;
        sunLight.shadow.camera.bottom = -25;
        scene.add(sunLight);

        const matGround = new THREE.MeshStandardMaterial({{ color: 0x738b5b, roughness: 1.0 }});
        const matRoad = new THREE.MeshStandardMaterial({{ color: 0x98938a, roughness: 0.95 }});
        const matPath = new THREE.MeshStandardMaterial({{ color: 0x9c6f43, roughness: 1.0 }});
        const matDeck = new THREE.MeshStandardMaterial({{ color: 0xb98d60, roughness: 0.9 }});
        const matCabin = new THREE.MeshStandardMaterial({{ color: 0x815736, roughness: 0.82 }});
        const matContainer = new THREE.MeshStandardMaterial({{ color: 0xbfc7c9, roughness: 0.7, metalness: 0.28 }});
        const matRoof = new THREE.MeshStandardMaterial({{ color: 0x2d2926, roughness: 0.72 }});
        const matGlass = new THREE.MeshStandardMaterial({{ color: 0xb7d7d3, emissive: 0x26443e, emissiveIntensity: 0.3 }});
        const matTreeTrunk = new THREE.MeshStandardMaterial({{ color: 0x60412d, roughness: 1.0 }});
        const matTreeLeaf = new THREE.MeshStandardMaterial({{ color: 0x3f6b38, roughness: 1.0 }});

        const ground = new THREE.Mesh(new THREE.PlaneGeometry(layout.site.width, layout.site.height), matGround);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const border = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.PlaneGeometry(layout.site.width, layout.site.height)),
            new THREE.LineBasicMaterial({{ color: 0xf2f1e9, transparent: true, opacity: 0.6 }})
        );
        border.rotation.x = -Math.PI / 2;
        border.position.y = 0.06;
        scene.add(border);

        function makeRectangle(points, material, y = 0.03) {{
            const shape = new THREE.Shape();
            shape.moveTo(points[0][0], points[0][1]);
            for (let index = 1; index < points.length; index += 1) {{
                shape.lineTo(points[index][0], points[index][1]);
            }}
            shape.closePath();
            const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.y = y;
            mesh.receiveShadow = true;
            scene.add(mesh);
            return mesh;
        }}

        function makePath(points, width, material, y) {{
            const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, y, z)));
            const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(40, points.length * 10), width / 2, 12, false), material);
            mesh.receiveShadow = true;
            scene.add(mesh);
            return mesh;
        }}

        function rotationFromFront(frontDeg) {{
            return Math.PI / 2 - frontDeg * Math.PI / 180;
        }}

        function addCabin(cabin) {{
            const group = new THREE.Group();
            group.position.set(cabin.center_x, 0, cabin.center_y);
            group.rotation.y = rotationFromFront(cabin.front_deg);

            const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3.1, 4), matCabin);
            body.position.y = 1.55;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            const roof = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.28, 4.6), matRoof);
            roof.position.set(0, 3.35, 0.05);
            roof.rotation.x = -0.08;
            roof.castShadow = true;
            group.add(roof);

            const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.8), matGlass);
            frontGlass.position.set(0, 1.8, -2.01);
            group.add(frontGlass);

            const deck = new THREE.Mesh(new THREE.BoxGeometry(5, 0.22, 1.8), matDeck);
            deck.position.set(0, 0.12, -2.9);
            deck.castShadow = true;
            deck.receiveShadow = true;
            group.add(deck);

            scene.add(group);
            makeRectangle(cabin.deck, matDeck, 0.03);
        }}

        function addContainer(container) {{
            const group = new THREE.Group();
            group.position.set(container.center_x, 0, container.center_y);

            const body = new THREE.Mesh(new THREE.BoxGeometry(container.width, 3, container.depth), matContainer);
            body.position.y = 1.5;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            const roof = new THREE.Mesh(new THREE.BoxGeometry(container.width + 0.2, 0.18, container.depth + 0.2), matRoof);
            roof.position.y = 3.12;
            roof.castShadow = true;
            group.add(roof);

            scene.add(group);
        }}

        function addTree(x, z, scale = 1) {{
            const group = new THREE.Group();
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * scale, 0.52 * scale, 3 * scale, 7), matTreeTrunk);
            trunk.position.y = 1.5 * scale;
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            group.add(trunk);

            const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 * scale, 1), matTreeLeaf);
            canopy.position.y = 4.2 * scale;
            canopy.castShadow = true;
            canopy.receiveShadow = true;
            group.add(canopy);

            const canopy2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 * scale, 1), matTreeLeaf);
            canopy2.position.set(1.0 * scale, 5.0 * scale, 0.5 * scale);
            canopy2.castShadow = true;
            group.add(canopy2);

            group.position.set(x, 0, z);
            scene.add(group);
        }}

        layout.road_segments.forEach((segment) => makeRectangle(segment.footprint, matRoad, 0.02));
        makePath(layout.foot_path, layout.site.path_width, matPath, 0.05);
        layout.cabins.forEach(addCabin);
        addContainer(layout.container);
        addTree(layout.site.center_tree.x, layout.site.center_tree.y, 1.1);
        [[-16, -4.8, 0.8], [18, 4.8, 0.75], [18, -5.4, 0.8], [-10, 5.0, 0.7]].forEach(([x, z, scale]) => addTree(x, z, scale));

        window.addEventListener('resize', () => {{
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }});

        document.getElementById('loading').style.display = 'none';

        function animate() {{
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }}

        animate();
    </script>
</body>
</html>
'''


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    layout = build_layout()
    (OUTPUT_DIR / "radial_cabins_layout.json").write_text(json.dumps(layout, indent=2), encoding="utf-8")
    write_dxf(layout, OUTPUT_DIR / "radial_cabins_layout.dxf")
    (OUTPUT_DIR / "camping-area-3d.html").write_text(build_html(layout), encoding="utf-8")

    print(OUTPUT_DIR / "radial_cabins_layout.json")
    print(OUTPUT_DIR / "radial_cabins_layout.dxf")
    print(OUTPUT_DIR / "camping-area-3d.html")


if __name__ == "__main__":
    main()