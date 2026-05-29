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


FONT_22 = font(22)
FONT_26 = font(26)
FONT_30 = font(30)


def canvas(title):
    img = Image.new("RGB", (900, 460), "#ffffff")
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((18, 18, 882, 442), radius=24, outline="#cbd5e1", width=3, fill="#fbfdff")
    draw.text((40, 32), title, fill="#0f172a", font=FONT_30)
    return img, draw


def draw_cuboid(draw, x, y, w=110, h=70, d=34, fill="#bfdbfe"):
    draw.rectangle((x, y, x + w, y + h), fill=fill, outline="#1d4ed8", width=3)
    draw.polygon([(x + w, y), (x + w + d, y - d), (x + w + d, y + h - d), (x + w, y + h)], fill="#93c5fd", outline="#1d4ed8")
    draw.polygon([(x, y), (x + d, y - d), (x + w + d, y - d), (x + w, y)], fill="#dbeafe", outline="#1d4ed8")


def draw_cube(draw, x, y, size=82, fill="#fecaca"):
    draw_cuboid(draw, x, y, size, size, 30, fill)


def draw_cylinder(draw, x, y, w=86, h=105, fill="#bbf7d0"):
    draw.ellipse((x, y, x + w, y + 34), fill="#dcfce7", outline="#15803d", width=3)
    draw.rectangle((x, y + 17, x + w, y + h), fill=fill, outline="#15803d", width=3)
    draw.ellipse((x, y + h - 17, x + w, y + h + 17), fill="#bbf7d0", outline="#15803d", width=3)


def draw_sphere(draw, x, y, r=48, fill="#fde68a"):
    draw.ellipse((x, y, x + r * 2, y + r * 2), fill=fill, outline="#b45309", width=3)
    draw.arc((x + 18, y + 12, x + r * 2 - 18, y + r * 2 - 12), 80, 280, fill="#f59e0b", width=2)
    draw.ellipse((x + 28, y + 22, x + 48, y + 38), fill="#fff7ed", outline=None)


def draw_item_label(draw, x, y, label):
    draw.text((x, y), label, fill="#475569", font=FONT_22)


def save(img, name):
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    path = ASSET_DIR / name
    img.save(path)
    return f"{ASSET_PREFIX}/{name}"


def shape_row_image(name, title, marks=False):
    img, draw = canvas(title)
    xs = [70, 230, 390, 550, 710]
    labels = ["①", "②", "③", "④", "⑤"]
    drawers = [
        lambda x: draw_cylinder(draw, x + 18, 162),
        lambda x: draw_cuboid(draw, x, 190),
        lambda x: draw_sphere(draw, x + 12, 180),
        lambda x: draw_cube(draw, x + 6, 186),
        lambda x: draw_cylinder(draw, x + 18, 162),
    ]
    for x, label, fn in zip(xs, labels, drawers):
        fn(x)
        draw_item_label(draw, x + 42, 330, label)
        draw.rounded_rectangle((x - 4, 360, x + 118, 406), radius=10, outline="#cbd5e1", width=2, fill="#ffffff")
        if marks:
            draw.text((x + 36, 366), "（  ）", fill="#334155", font=FONT_26)
    return save(img, name)


def shelf_image(name):
    img, draw = canvas("观察货架，按层数和方向填空")
    shelf = (95, 105, 805, 360)
    draw.rounded_rectangle(shelf, radius=10, outline="#64748b", width=4, fill="#f8fafc")
    for y in [190, 275]:
        draw.line((105, y, 795, y), fill="#94a3b8", width=4)
    for x in [270, 450, 630]:
        draw.line((x, 115, x, 350), fill="#cbd5e1", width=2)
    items = [
        ("排球", 145, 130, "sphere"),
        ("羽毛球拍", 330, 125, "racket"),
        ("圆柱", 520, 120, "cylinder"),
        ("长方体盒", 680, 135, "cuboid"),
        ("球", 160, 225, "sphere"),
        ("正方体", 335, 235, "cube"),
        ("圆柱", 520, 218, "cylinder"),
        ("书盒", 690, 235, "cuboid"),
    ]
    for label, x, y, kind in items:
        if kind == "sphere":
            draw_sphere(draw, x, y, 33)
        elif kind == "cylinder":
            draw_cylinder(draw, x, y, 58, 72)
        elif kind == "cube":
            draw_cube(draw, x, y + 12, 54)
        elif kind == "cuboid":
            draw_cuboid(draw, x, y + 20, 76, 46, 22)
        else:
            draw.ellipse((x, y + 8, x + 55, y + 72), outline="#7c3aed", width=5)
            draw.line((x + 40, y + 62, x + 96, y + 105), fill="#7c3aed", width=5)
        draw.text((x - 6, y + 92), label, fill="#334155", font=FONT_22)
    draw.text((110, 376), "从左往右数，最上面是第1层。", fill="#475569", font=FONT_22)
    return save(img, name)


def clock_image(name, hour, minute, title):
    img, draw = canvas(title)
    cx, cy, r = 450, 245, 145
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill="#ffffff", outline="#2563eb", width=5)
    for n in range(1, 13):
        angle = math.radians(n * 30 - 90)
        tx = cx + math.cos(angle) * (r - 28)
        ty = cy + math.sin(angle) * (r - 28)
        text = str(n)
        bbox = draw.textbbox((0, 0), text, font=FONT_22)
        draw.text((tx - (bbox[2] - bbox[0]) / 2, ty - 12), text, fill="#0f172a", font=FONT_22)
    minute_angle = math.radians(minute * 6 - 90)
    hour_angle = math.radians(((hour % 12) + minute / 60) * 30 - 90)
    draw.line((cx, cy, cx + math.cos(hour_angle) * 78, cy + math.sin(hour_angle) * 78), fill="#ef4444", width=8)
    draw.line((cx, cy, cx + math.cos(minute_angle) * 112, cy + math.sin(minute_angle) * 112), fill="#0f172a", width=5)
    draw.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), fill="#2563eb")
    return save(img, name)


def attach():
    bank = json.loads(BANK_PATH.read_text(encoding="utf-8"))
    image_map = {
        "在长方体的下面画": shape_row_image("shape_mark_cuboid.png", "在长方体的下面画“√”", True),
        "在不是圆柱的下面画": shape_row_image("shape_not_cylinder.png", "在不是圆柱的下面画“×”", True),
        "从左边数起": shape_row_image("shape_count_cylinder.png", "数一数：哪些是圆柱？", False),
        "从左边数圆柱": shape_row_image("shape_count_cylinder_ball.png", "从左边数，圆柱和球分别是第几个？", False),
        "排球在第": shelf_image("shape_shelf_sports.png"),
        "羽毛球拍在第": shelf_image("shape_shelf_racket.png"),
        "在下面钟面上画出时针和分针": clock_image("clock_blank_10_30.png", 10, 30, "钟面练习：观察时针和分针"),
    }
    attached = 0
    for question in bank.get("questions", []):
        question.pop("image", None)
        question.pop("image_source", None)
        text = question.get("question", "")
        point = question.get("knowledge_point", "")
        for key, image in image_map.items():
            is_shape = point == "长方体正方体圆柱球"
            is_clock = "钟面" in text or "时针" in text or "分针" in text
            if key in text:
                question["image"] = image
                question["image_source"] = "generated_diagram"
                if "在长方体的下面画" in text:
                    question["question"] = "在长方体的下面画“√”。"
                elif "在不是圆柱的下面画" in text:
                    question["question"] = "在不是圆柱的下面画“×”。"
                elif "在下面钟面上画出时针和分针" in text:
                    question["question"] = "在下面钟面上画出时针和分针。"
                attached += 1
                break
    bank.setdefault("stats", {})["generated_diagram_questions"] = attached
    BANK_PATH.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"attached": attached, "asset_dir": str(ASSET_DIR)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    attach()
