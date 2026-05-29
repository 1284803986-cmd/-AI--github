import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


BANK_PATH = Path("content/extracted_question_bank.json")
ASSET_DIR = Path("miniapp/src/assets/generated/questions")
ASSET_PREFIX = "/assets/generated/questions"


def font(size):
    for path in [
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\simsun.ttc",
    ]:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


FONT_18 = font(18)
FONT_22 = font(22)
FONT_26 = font(26)
FONT_30 = font(30)


def canvas(title, size=(900, 520)):
    img = Image.new("RGB", size, "#ffffff")
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((18, 18, size[0] - 18, size[1] - 18), radius=24, outline="#cbd5e1", width=3, fill="#fbfdff")
    draw.text((42, 34), title, fill="#0f172a", font=FONT_30)
    return img, draw


def save(img, name):
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    path = ASSET_DIR / name
    img.save(path)
    return f"{ASSET_PREFIX}/{name}"


def draw_grid(draw, x, y, cols, rows, cell=42, color="#cbd5e1"):
    for c in range(cols + 1):
        xx = x + c * cell
        draw.line((xx, y, xx, y + rows * cell), fill=color, width=1)
    for r in range(rows + 1):
        yy = y + r * cell
        draw.line((x, yy, x + cols * cell, yy), fill=color, width=1)


def draw_cuboid(draw, x, y, w=96, h=66, d=30, fill="#bfdbfe"):
    draw.rectangle((x, y, x + w, y + h), fill=fill, outline="#1d4ed8", width=3)
    draw.polygon([(x + w, y), (x + w + d, y - d), (x + w + d, y + h - d), (x + w, y + h)], fill="#93c5fd", outline="#1d4ed8")
    draw.polygon([(x, y), (x + d, y - d), (x + w + d, y - d), (x + w, y)], fill="#dbeafe", outline="#1d4ed8")


def draw_cube(draw, x, y, size=74, label=""):
    draw_cuboid(draw, x, y, size, size, 26, "#fde68a")
    if label:
        draw.text((x + 28, y + 24), label, fill="#92400e", font=FONT_26)


def draw_cylinder(draw, x, y, w=92, h=130):
    draw.ellipse((x, y, x + w, y + 34), fill="#dcfce7", outline="#15803d", width=3)
    draw.rectangle((x, y + 17, x + w, y + h), fill="#bbf7d0", outline="#15803d", width=3)
    draw.ellipse((x, y + h - 17, x + w, y + h + 17), fill="#bbf7d0", outline="#15803d", width=3)


def draw_sphere(draw, x, y, r=43):
    draw.ellipse((x, y, x + r * 2, y + r * 2), fill="#fecaca", outline="#b91c1c", width=3)
    draw.arc((x + 15, y + 12, x + r * 2 - 15, y + r * 2 - 12), 80, 280, fill="#ef4444", width=2)


def solid_selection_image():
    img, draw = canvas("观察立体图形，按题目要求作答")
    xs = [82, 240, 398, 556, 714]
    labels = ["A", "B", "C", "D", "E"]
    drawers = [
        lambda x: draw_cube(draw, x + 8, 190, 78),
        lambda x: draw_cylinder(draw, x + 12, 155, 82, 118),
        lambda x: draw_cuboid(draw, x, 204, 110, 64, 30),
        lambda x: draw_sphere(draw, x + 10, 188, 48),
        lambda x: draw_cylinder(draw, x + 12, 155, 82, 118),
    ]
    for x, label, drawer in zip(xs, labels, drawers):
        drawer(x)
        draw.rounded_rectangle((x, 338, x + 118, 392), radius=10, outline="#cbd5e1", width=2, fill="#ffffff")
        draw.text((x + 48, 350), label, fill="#334155", font=FONT_26)
    return save(img, "visual_solid_selection.png")


def plane_shape_image():
    img, draw = canvas("观察平面图形，选择合适答案")
    shapes = [
        ("圆", "ellipse", 90, 180, "#fecaca"),
        ("正方形", "square", 250, 170, "#bfdbfe"),
        ("长方形", "rect", 420, 190, "#bbf7d0"),
        ("三角形", "tri", 600, 170, "#fde68a"),
        ("平行四边形", "para", 720, 190, "#ddd6fe"),
    ]
    for label, kind, x, y, fill in shapes:
        if kind == "ellipse":
            draw.ellipse((x, y, x + 95, y + 95), fill=fill, outline="#334155", width=3)
        elif kind == "square":
            draw.rectangle((x, y, x + 95, y + 95), fill=fill, outline="#334155", width=3)
        elif kind == "rect":
            draw.rectangle((x, y, x + 130, y + 75), fill=fill, outline="#334155", width=3)
        elif kind == "tri":
            draw.polygon([(x + 55, y), (x, y + 105), (x + 120, y + 105)], fill=fill, outline="#334155")
        else:
            draw.polygon([(x + 30, y), (x + 140, y), (x + 110, y + 78), (x, y + 78)], fill=fill, outline="#334155")
        draw.text((x + 10, 330), label, fill="#334155", font=FONT_22)
    return save(img, "visual_plane_shapes.png")


def observe_object_image():
    img, draw = canvas("从不同位置观察同一组物体")
    draw_cube(draw, 330, 215, 78, "1")
    draw_cube(draw, 410, 215, 78, "2")
    draw_cube(draw, 490, 215, 78, "3")
    draw_cube(draw, 410, 135, 78, "4")
    arrows = [("前面", 450, 390, 450, 320), ("左面", 210, 250, 310, 250), ("上面", 450, 88, 450, 125)]
    for label, x1, y1, x2, y2 in arrows:
        draw.line((x1, y1, x2, y2), fill="#2563eb", width=5)
        draw.polygon([(x2, y2), (x2 - 10, y2 + 18), (x2 + 10, y2 + 18)], fill="#2563eb")
        draw.text((x1 - 26, y1 + 8), label, fill="#1d4ed8", font=FONT_22)
    draw.text((622, 190), "A", fill="#334155", font=FONT_26)
    draw.rectangle((660, 180, 712, 232), fill="#e0f2fe", outline="#0284c7", width=2)
    draw.rectangle((714, 180, 766, 232), fill="#e0f2fe", outline="#0284c7", width=2)
    draw.text((622, 274), "B", fill="#334155", font=FONT_26)
    draw.rectangle((660, 264, 712, 316), fill="#e0f2fe", outline="#0284c7", width=2)
    draw.rectangle((660, 318, 712, 370), fill="#e0f2fe", outline="#0284c7", width=2)
    return save(img, "visual_observe_blocks.png")


def symmetry_translation_image():
    img, draw = canvas("在方格纸上完成轴对称和平移")
    x, y, cell = 140, 112, 40
    draw_grid(draw, x, y, 14, 9, cell)
    axis_x = x + 7 * cell
    draw.line((axis_x, y, axis_x, y + 9 * cell), fill="#ef4444", width=4)
    draw.text((axis_x + 10, y + 8), "对称轴", fill="#ef4444", font=FONT_22)
    pts = [(x + 2 * cell, y + 2 * cell), (x + 4 * cell, y + 2 * cell), (x + 4 * cell, y + 5 * cell), (x + 3 * cell, y + 6 * cell), (x + 2 * cell, y + 5 * cell)]
    draw.polygon(pts, fill="#bfdbfe", outline="#1d4ed8")
    draw.line((x + 500, y + 270, x + 620, y + 270), fill="#16a34a", width=5)
    draw.polygon([(x + 620, y + 270), (x + 600, y + 258), (x + 600, y + 282)], fill="#16a34a")
    draw.text((x + 498, y + 286), "向右平移3格", fill="#166534", font=FONT_22)
    return save(img, "visual_symmetry_translation_grid.png")


def bar_chart_image():
    img, draw = canvas("某地区城镇、乡村人口统计图")
    origin = (110, 400)
    draw.line((origin[0], origin[1], 810, origin[1]), fill="#334155", width=3)
    draw.line((origin[0], origin[1], origin[0], 110), fill="#334155", width=3)
    for i, value in enumerate([0, 20, 40, 60, 80, 100]):
        yy = origin[1] - value * 2.6
        draw.line((origin[0] - 6, yy, 810, yy), fill="#e2e8f0", width=1)
        draw.text((54, yy - 12), str(value), fill="#475569", font=FONT_18)
    years = [2000, 2005, 2010, 2015]
    town = [36, 43, 55, 68]
    village = [72, 66, 57, 48]
    for i, year in enumerate(years):
        base_x = 170 + i * 150
        for offset, value, color in [(0, town[i], "#2563eb"), (34, village[i], "#f97316")]:
            h = value * 2.6
            draw.rectangle((base_x + offset, origin[1] - h, base_x + offset + 28, origin[1]), fill=color)
            draw.text((base_x + offset - 2, origin[1] - h - 24), str(value), fill="#334155", font=FONT_18)
        draw.text((base_x - 8, 418), str(year), fill="#334155", font=FONT_18)
    draw.rectangle((620, 92, 642, 112), fill="#2563eb")
    draw.text((650, 88), "城镇", fill="#334155", font=FONT_22)
    draw.rectangle((720, 92, 742, 112), fill="#f97316")
    draw.text((750, 88), "乡村", fill="#334155", font=FONT_22)
    return save(img, "visual_population_bar_chart.png")


def line_chart_image():
    img, draw = canvas("一周平均气温折线统计图")
    origin = (110, 400)
    draw.line((origin[0], origin[1], 810, origin[1]), fill="#334155", width=3)
    draw.line((origin[0], origin[1], origin[0], 110), fill="#334155", width=3)
    days = ["一", "二", "三", "四", "五", "六", "日"]
    values = [18, 21, 20, 24, 27, 26, 23]
    pts = []
    for i, (day, value) in enumerate(zip(days, values)):
        x = 150 + i * 95
        y = origin[1] - value * 9
        pts.append((x, y))
        draw.text((x - 8, 418), day, fill="#334155", font=FONT_22)
        draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill="#2563eb")
        draw.text((x - 10, y - 34), str(value), fill="#334155", font=FONT_18)
    draw.line(pts, fill="#2563eb", width=4)
    draw.text((52, 104), "℃", fill="#475569", font=FONT_22)
    return save(img, "visual_temperature_line_chart.png")


def chart_types_image():
    img, draw = canvas("选择合适的统计图")
    draw.text((70, 105), "条形统计图", fill="#334155", font=FONT_22)
    for i, h in enumerate([70, 120, 90]):
        draw.rectangle((92 + i * 46, 305 - h, 122 + i * 46, 305), fill="#2563eb")
    draw.line((70, 305, 235, 305), fill="#334155", width=2)
    draw.line((70, 160, 70, 305), fill="#334155", width=2)

    draw.text((330, 105), "折线统计图", fill="#334155", font=FONT_22)
    pts = [(330, 280), (380, 230), (430, 245), (480, 190), (530, 205)]
    draw.line(pts, fill="#16a34a", width=4)
    for x, y in pts:
        draw.ellipse((x - 6, y - 6, x + 6, y + 6), fill="#16a34a")
    draw.line((310, 305, 555, 305), fill="#334155", width=2)
    draw.line((310, 160, 310, 305), fill="#334155", width=2)

    draw.text((640, 105), "扇形统计图", fill="#334155", font=FONT_22)
    cx, cy, r = 715, 235, 76
    draw.pieslice((cx - r, cy - r, cx + r, cy + r), 0, 120, fill="#f97316", outline="#ffffff", width=3)
    draw.pieslice((cx - r, cy - r, cx + r, cy + r), 120, 245, fill="#2563eb", outline="#ffffff", width=3)
    draw.pieslice((cx - r, cy - r, cx + r, cy + r), 245, 360, fill="#22c55e", outline="#ffffff", width=3)
    draw.text((170, 390), "比较数量用条形，看变化用折线，看部分与整体关系用扇形。", fill="#475569", font=FONT_22)
    return save(img, "visual_chart_type_choice.png")


def puzzle_grid_image():
    img, draw = canvas("四连方拼成 4×4 正方形")
    x, y, cell = 155, 120, 58
    draw_grid(draw, x, y, 4, 4, cell)
    colors = ["#bfdbfe", "#bbf7d0", "#fde68a", "#fecaca"]
    pieces = [
        [(0, 0), (1, 0), (0, 1), (0, 2)],
        [(0, 0), (1, 0), (2, 0), (1, 1)],
        [(0, 0), (0, 1), (1, 1), (2, 1)],
        [(0, 0), (1, 0), (1, 1), (1, 2)],
    ]
    for idx, cells in enumerate(pieces):
        px = 470 + (idx % 2) * 150
        py = 138 + (idx // 2) * 135
        for cx, cy in cells:
            draw.rectangle((px + cx * 32, py + cy * 32, px + (cx + 1) * 32, py + (cy + 1) * 32), fill=colors[idx], outline="#334155", width=2)
        draw.text((px, py + 100), f"图形{idx + 1}", fill="#334155", font=FONT_18)
    draw.text((110, 385), "把右侧四个四连方不重叠地放入左侧方格。", fill="#475569", font=FONT_22)
    return save(img, "visual_tetromino_puzzle.png")


def coordinate_image():
    img, draw = canvas("在方格纸上描点并平移图形")
    x, y, cell = 150, 96, 42
    draw_grid(draw, x, y, 12, 9, cell)
    draw.line((x, y + 8 * cell, x + 12 * cell, y + 8 * cell), fill="#334155", width=3)
    draw.line((x + cell, y, x + cell, y + 9 * cell), fill="#334155", width=3)
    points = {"A(6,7)": (6, 7), "B(9,5)": (9, 5), "C(9,3)": (9, 3), "D(6,3)": (6, 3)}
    poly = []
    for label, (cx, cy) in points.items():
        px = x + cx * cell
        py = y + (8 - cy) * cell
        poly.append((px, py))
        draw.ellipse((px - 6, py - 6, px + 6, py + 6), fill="#ef4444")
        draw.text((px + 8, py - 20), label, fill="#334155", font=FONT_18)
    draw.line(poly + [poly[0]], fill="#2563eb", width=4)
    draw.text((560, 370), "向左平移5格", fill="#166534", font=FONT_22)
    return save(img, "visual_coordinate_translation.png")


def rectangle_rotation_image():
    img, draw = canvas("长方形绕边旋转形成圆柱")
    draw.rectangle((130, 185, 370, 305), fill="#dbeafe", outline="#1d4ed8", width=4)
    draw.line((130, 165, 130, 330), fill="#ef4444", width=5)
    draw.text((190, 145), "长 20 cm", fill="#334155", font=FONT_22)
    draw.text((382, 230), "宽 10 cm", fill="#334155", font=FONT_22)
    draw.arc((90, 135, 410, 355), 300, 60, fill="#16a34a", width=5)
    draw.text((130, 345), "绕红色边旋转一周", fill="#166534", font=FONT_22)
    draw_cylinder(draw, 610, 155, 110, 180)
    draw.text((590, 365), "得到圆柱", fill="#334155", font=FONT_26)
    return save(img, "visual_rectangle_rotation_cylinder.png")


def circle_sprinkler_image():
    img, draw = canvas("旋转喷灌形成圆形区域")
    cx, cy, r = 450, 270, 145
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill="#dcfce7", outline="#16a34a", width=4)
    draw.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), fill="#2563eb")
    draw.line((cx, cy, cx + r, cy), fill="#ef4444", width=5)
    draw.text((cx + 48, cy + 12), "10 m", fill="#ef4444", font=FONT_26)
    draw.text((280, 430), "喷头旋转一周，喷灌区域是一个圆。", fill="#334155", font=FONT_22)
    return save(img, "visual_circle_sprinkler.png")


def rectangle_measure_image():
    img, draw = canvas("长方形与正方形的周长、面积")
    draw.rectangle((125, 170, 405, 330), fill="#dbeafe", outline="#1d4ed8", width=4)
    draw.text((230, 338), "长", fill="#334155", font=FONT_22)
    draw.text((82, 240), "宽", fill="#334155", font=FONT_22)
    draw.rectangle((560, 170, 730, 340), fill="#bbf7d0", outline="#15803d", width=4)
    draw.text((612, 350), "边长", fill="#334155", font=FONT_22)
    draw.text((175, 405), "周长看一圈，面积看里面铺了多少。", fill="#475569", font=FONT_22)
    return save(img, "visual_rectangle_measure.png")


def triangle_image():
    img, draw = canvas("三角形的边和角")
    pts = [(225, 355), (410, 145), (595, 355)]
    draw.polygon(pts, fill="#fde68a", outline="#b45309")
    draw.line((225, 355, 595, 355), fill="#b45309", width=4)
    draw.line((225, 355, 410, 145), fill="#b45309", width=4)
    draw.line((410, 145, 595, 355), fill="#b45309", width=4)
    draw.text((400, 118), "顶点", fill="#334155", font=FONT_22)
    draw.arc((250, 315, 320, 385), 210, 355, fill="#ef4444", width=4)
    draw.arc((500, 315, 570, 385), 185, 330, fill="#2563eb", width=4)
    draw.text((250, 405), "三角形内角和是 180°", fill="#475569", font=FONT_26)
    return save(img, "visual_triangle_angles.png")


def circle_formula_image():
    img, draw = canvas("圆的半径、直径、周长和面积")
    cx, cy, r = 450, 265, 145
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill="#e0f2fe", outline="#0284c7", width=5)
    draw.line((cx, cy, cx + r, cy), fill="#ef4444", width=5)
    draw.line((cx - r, cy + 55, cx + r, cy + 55), fill="#16a34a", width=5)
    draw.ellipse((cx - 7, cy - 7, cx + 7, cy + 7), fill="#0f172a")
    draw.text((cx + 55, cy + 10), "半径 r", fill="#ef4444", font=FONT_22)
    draw.text((cx - 38, cy + 70), "直径 d", fill="#166534", font=FONT_22)
    draw.text((275, 430), "周长 C=πd，面积 S=πr²", fill="#475569", font=FONT_22)
    return save(img, "visual_circle_formula.png")


def cuboid_volume_image():
    img, draw = canvas("长方体和正方体的表面积、体积")
    draw_cuboid(draw, 160, 230, 220, 120, 70, "#bfdbfe")
    draw.text((230, 365), "长", fill="#334155", font=FONT_22)
    draw.text((400, 275), "高", fill="#334155", font=FONT_22)
    draw.text((395, 195), "宽", fill="#334155", font=FONT_22)
    draw_cube(draw, 620, 230, 105)
    draw.text((618, 365), "正方体", fill="#334155", font=FONT_22)
    draw.text((210, 430), "体积看占空间多少，表面积看所有面的面积和。", fill="#475569", font=FONT_22)
    return save(img, "visual_cuboid_volume.png")


def cylinder_cone_image():
    img, draw = canvas("圆柱和圆锥")
    draw_cylinder(draw, 205, 170, 115, 185)
    draw.text((220, 380), "圆柱", fill="#334155", font=FONT_26)
    draw.ellipse((548, 175, 682, 225), fill="#fde68a", outline="#b45309", width=3)
    draw.polygon([(548, 200), (682, 200), (615, 365)], fill="#fde68a", outline="#b45309")
    draw.arc((548, 340, 682, 390), 0, 180, fill="#b45309", width=3)
    draw.text((590, 380), "圆锥", fill="#334155", font=FONT_26)
    draw.text((245, 435), "注意底面半径、高和侧面展开。", fill="#475569", font=FONT_22)
    return save(img, "visual_cylinder_cone.png")


def angle_parallel_image():
    img, draw = canvas("角、平行线和梯形")
    draw.line((120, 330, 330, 160), fill="#2563eb", width=5)
    draw.line((120, 330, 360, 330), fill="#2563eb", width=5)
    draw.arc((145, 280, 245, 380), 270, 325, fill="#ef4444", width=5)
    draw.text((170, 350), "角", fill="#ef4444", font=FONT_26)
    draw.line((455, 170, 765, 170), fill="#16a34a", width=5)
    draw.line((455, 275, 765, 275), fill="#16a34a", width=5)
    draw.text((560, 205), "平行线", fill="#166534", font=FONT_26)
    draw.polygon([(500, 380), (720, 380), (670, 450), (540, 450)], fill="#fde68a", outline="#b45309")
    draw.text((575, 455), "梯形", fill="#334155", font=FONT_22)
    return save(img, "visual_angle_parallel.png")


def direction_route_image():
    img, draw = canvas("位置与方向")
    x, y, cell = 160, 110, 45
    draw_grid(draw, x, y, 10, 7, cell)
    draw.line((x + 5 * cell, y + 6 * cell, x + 5 * cell, y + cell), fill="#2563eb", width=4)
    draw.line((x + 5 * cell, y + 6 * cell, x + 9 * cell, y + 6 * cell), fill="#2563eb", width=4)
    draw.text((x + 5 * cell - 12, y + 6 * cell + 10), "起点", fill="#334155", font=FONT_22)
    draw.text((x + 9 * cell - 12, y + 6 * cell + 10), "东", fill="#334155", font=FONT_22)
    draw.text((x + 5 * cell + 12, y + cell - 18), "北", fill="#334155", font=FONT_22)
    draw.arc((610, 180, 750, 320), 235, 330, fill="#ef4444", width=5)
    draw.text((622, 325), "方向角", fill="#ef4444", font=FONT_22)
    return save(img, "visual_direction_route.png")


def scale_shape_image():
    img, draw = canvas("图形的放大与缩小")
    x, y, cell = 110, 135, 36
    draw_grid(draw, x, y, 6, 6, cell)
    small = [(x + cell, y + cell), (x + 3 * cell, y + cell), (x + 3 * cell, y + 3 * cell), (x + cell, y + 3 * cell)]
    draw.polygon(small, fill="#bfdbfe", outline="#1d4ed8")
    x2, y2, cell2 = 470, 95, 46
    draw_grid(draw, x2, y2, 8, 8, cell2)
    big = [(x2 + cell2, y2 + cell2), (x2 + 5 * cell2, y2 + cell2), (x2 + 5 * cell2, y2 + 5 * cell2), (x2 + cell2, y2 + 5 * cell2)]
    draw.polygon(big, fill="#bbf7d0", outline="#15803d")
    draw.line((350, 250, 445, 250), fill="#ef4444", width=5)
    draw.polygon([(445, 250), (425, 238), (425, 262)], fill="#ef4444")
    draw.text((340, 270), "按比例放大", fill="#ef4444", font=FONT_22)
    draw.text((205, 420), "形状不变，对应边按相同的比变化。", fill="#475569", font=FONT_22)
    return save(img, "visual_scale_shape.png")


def geometry_review_image():
    img, draw = canvas("图形与几何整理")
    draw.rectangle((105, 180, 245, 300), fill="#dbeafe", outline="#1d4ed8", width=4)
    draw.text((125, 315), "平面图形", fill="#334155", font=FONT_22)
    draw_cuboid(draw, 365, 220, 135, 85, 40, "#bbf7d0")
    draw.text((390, 330), "立体图形", fill="#334155", font=FONT_22)
    cx, cy, r = 690, 240, 70
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill="#fde68a", outline="#b45309", width=4)
    draw.line((cx, cy, cx + r, cy), fill="#ef4444", width=4)
    draw.text((660, 330), "圆", fill="#334155", font=FONT_22)
    draw.text((195, 410), "复习时注意周长、面积、表面积和体积的区别。", fill="#475569", font=FONT_22)
    return save(img, "visual_geometry_review.png")


def attach():
    bank = json.loads(BANK_PATH.read_text(encoding="utf-8"))
    assets = {
        "solid": solid_selection_image(),
        "plane": plane_shape_image(),
        "observe": observe_object_image(),
        "motion": symmetry_translation_image(),
        "bar": bar_chart_image(),
        "line": line_chart_image(),
        "chartTypes": chart_types_image(),
        "puzzle": puzzle_grid_image(),
        "coordinate": coordinate_image(),
        "rotation": rectangle_rotation_image(),
        "circle": circle_sprinkler_image(),
        "rectangle": rectangle_measure_image(),
        "triangle": triangle_image(),
        "circleFormula": circle_formula_image(),
        "cuboid": cuboid_volume_image(),
        "cylinderCone": cylinder_cone_image(),
        "angleParallel": angle_parallel_image(),
        "direction": direction_route_image(),
        "scale": scale_shape_image(),
        "geometryReview": geometry_review_image(),
    }
    attached = 0
    for question in bank.get("questions", []):
        if question.get("image"):
            continue
        text = question.get("question", "")
        unit = question.get("unit", "")
        point = question.get("knowledge_point", "")
        image = pick_image(text, unit, point, assets)
        if not image:
            continue
        question["image"] = image
        question["image_source"] = "generated_diagram"
        attached += 1
    bank.setdefault("stats", {})["generated_diagram_questions"] = sum(1 for question in bank.get("questions", []) if question.get("image_source") == "generated_diagram")
    BANK_PATH.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"attached": attached, "total_generated_diagram_questions": bank["stats"]["generated_diagram_questions"]}, ensure_ascii=False, indent=2))


def pick_image(text, unit, point, assets):
    joined = f"{text} {unit} {point}"
    if "正方体的下面画" in text or "立体图形" in joined or "圆柱" in text and ("下面" in text or "数" in text):
        return assets["solid"]
    if "平面图形" in joined or "用可以画出下面" in text:
        return assets["plane"]
    if "观察物体" in joined or "从不同位置观察" in joined or "从前面" in text or "从上面" in text or "从左面" in text or "看到" in text:
        return assets["observe"]
    if "轴对称" in joined or "平移" in joined or "旋转设计图案" in text or "数格子" in text:
        return assets["motion"]
    if "条形统计图" in joined or "城镇人口" in text or "乡村人口" in text:
        return assets["bar"]
    if "折线统计图" in joined or "气温变化" in text or "平均气温" in text or "涨跌情况" in text:
        return assets["line"]
    if "统计图" in text:
        return assets["chartTypes"]
    if "拼图" in joined or "四连方" in text or "4×4" in text:
        return assets["puzzle"]
    if "数对" in joined or "描出下列各点" in text:
        return assets["coordinate"]
    if "长方形" in text and ("旋转一周" in text or "绕着" in text) and "圆柱" in joined:
        return assets["rotation"]
    if "喷灌" in text or ("圆" in unit and "射程" in text):
        return assets["circle"]
    if "位置与方向" in joined or "方向" in joined or "路线" in joined or "数对" in joined:
        return assets["direction"]
    if "图形放大与缩小" in joined or "放大后的图形" in text:
        return assets["scale"]
    if "图形与几何" in joined:
        return assets["geometryReview"]
    if "长方体" in joined or "正方体" in joined or "体积" in joined or "表面积" in joined:
        return assets["cuboid"]
    if "圆柱" in joined or "圆锥" in joined:
        return assets["cylinderCone"]
    if "圆" in unit or "圆的" in joined or "扇形" in joined:
        return assets["circleFormula"]
    if "三角形" in joined:
        return assets["triangle"]
    if "角" in joined or "平行四边形" in joined or "梯形" in joined:
        return assets["angleParallel"]
    if "长方形" in joined or "正方形" in joined or "面积" in joined or "周长" in joined or "多边形" in joined:
        return assets["rectangle"]
    return ""


if __name__ == "__main__":
    attach()
