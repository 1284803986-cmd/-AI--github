import argparse
import hashlib
import json
import re
from pathlib import Path


TARGET_CATEGORIES = {"practice", "student_sheet", "textbook", "lesson_plan", "knowledge"}
ANSWER_MARKERS = ("参考答案", "答案", "【答案】", "解析", "【分析】", "【详解】", "详解", "分析")
SKIP_MARKERS = ("温故知新", "新课先知", "预习检验", "每日口算", "教材第")
QUESTION_HINTS = (
    "计算", "口算", "填", "写", "数", "画", "连", "圈", "比", "选", "判断", "解决",
    "多少", "几", "求", "列式", "应用", "比较", "括号", "____", "（ ）", "( )", "=",
)
BAD_TEXT_RE = re.compile(
    r"eq\\a|EQ\\F|INCLUDEPICTURE|file:///|\.jpg|\.png|RichOle|导学|知识点讲解|预习指南|"
    r"教材第\d+页|主题图|共\d+分|每题\d+分|第\d+题|"
    r"温故|新课|先知|预习|检验|每日|口算|参考|第[一二三四五六七八九十]+单元|"
    r"[一二三四五六七八九十]+、|选择题|判断题|填空题|计算题|应用题|"
    r"看图|图中|下图|上图|涂色|涂一涂|圈一圈|画一画|连一连|连线"
)
BAD_EXTRA_RE = re.compile(
    r"jpg|jpeg|png|\(?\d+分\)?|（\d+分）|\([1-9]\)|（[1-9]）|①|②|③|④|⑤|"
    r"填空。|先仔细观察|照样子|找出规律|按照|按要求完成|"
    r"【分析】|【详解】|【提示】|【知识加油站】|【对应练习|【典型例题】|【考点|【方法点拨】|"
    r"知识加油站|对应练习|典型例题|方法点拨|附加|图见详解|来源:|学科网|Z&xx|月度自主|阶段知识|"
    r"基础巩固|能力提升|创新能力|自主测评|综合测评|期中|期末|欢乐游乐园|综合算式|"
    r"下面.*图形|下面.*图|下面（）图|下面是|哪个方向看到|从.*看到|在下面的里|在里填|填数。|填序号|Ｋ|□里应该填|"
    r"竖式计算|验算|计算下面各题|你的座位|从右数.*从左数|"
    r"用字母表示|交换律：|结合律：|运算性质：|主持人|议一议|（三）|圈起来|圈出|够吗|"
    r"条形图|扇形图|折线统计图|A．B|A.B|B．C|B.C|C．D|C.D|无法判"
)
MERGED_STEM_RE = re.compile(r"(?:^|[^0-9])\d{1,3}[\.．](?!\d)|[一二三四五六七八九十]+、(?:选择题|判断题|填空题|计算题|应用题)|[A-D][\.．、].*[0-9]{1,3}[\.．](?!\d)")
IMAGE_DEPENDENT_RE = re.compile(r"如图|看图|图中|下图|上图|下面图形|下面.*图|从上面|从左面|从正面|涂色|圈一圈|圈起来|圈出|画一画|连一连|连线|哪个方向看到|下面钟面|钟面上|形成的角|条形图|扇形图|折线统计图")
VISUAL_KEEP_RE = re.compile(r"长方体|正方体|圆柱|立体图形|钟面|钟表|时针|分针")
ATTACHABLE_VISUAL_RE = re.compile(
    r"在长方体的下面画|在不是圆柱的下面画|从左边数起，第（\s*）个和第（\s*）个都是圆柱|"
    r"从左边数圆柱是第（\s*）个，球是第（\s*）个|在下面钟面上画出时针和分针"
)

PINYIN_RE = re.compile(r"^[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňɡɑɑ̄ɑ́ɑ̌ɑ̀ê]+$")
NUMBERED_RE = re.compile(r"(?=(?:^|[^0-9])([0-9]{1,2})[\.．、])")
CALC_RE = re.compile(r"(?<![0-9])\d{1,4}(?:\.\d+)?(?:\s*[+\-＋－−×÷*/]\s*\d{1,4}(?:\.\d+)?){1,4}\s*=")
OPTION_RE = re.compile(r"[A-D][\.．、]")
BLOCK_START_RE = re.compile(r"^【(?:典型例题|对应练习)\d*】$")
BLOCK_STOP_RE = re.compile(r"^【|^解析|^答案|^解答|^方法点拨|^考点|^提示")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def compact_text(text: str) -> str:
    lines = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if PINYIN_RE.fullmatch(line):
            continue
        if line in {"。", "，", ",", ".", "．"}:
            continue
        lines.append(line)
    compact = "".join(lines)
    compact = compact.replace("()", "（ ）").replace("( )", "（ ）")
    compact = re.sub(r"\s+", "", compact)
    return compact


def before_answers(text: str) -> str:
    cut = len(text)
    for marker in ANSWER_MARKERS:
        index = text.find(marker)
        if index >= 0:
            cut = min(cut, index)
    return text[:cut]


def split_numbered(text: str):
    matches = list(NUMBERED_RE.finditer(text))
    if not matches:
        return []
    chunks = []
    for idx, match in enumerate(matches):
        start = match.start()
        if start > 0 and not text[start].isdigit():
            start += 1
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        chunk = text[start:end].strip("。；;，, ")
        chunk = re.sub(r"^[0-9]{1,2}[\.．、]", "", chunk).strip()
        if chunk:
            chunks.append(chunk)
    return chunks


def clean_question(text: str) -> str:
    text = re.sub(r"【(?:典型例题|对应练习)\d*】", "", text)
    text = re.sub(r"^(?:%s)+" % "|".join(map(re.escape, SKIP_MARKERS)), "", text)
    text = text.strip("。；;，, ")
    text = re.sub(r"教材第\d+页(?:例\d+)?", "", text)
    text = re.sub(r"^\([0-9]\)", "", text)
    return text


def classify(text: str) -> str:
    if "判断" in text or "对的" in text or "错的" in text:
        return "判断题"
    if "选择" in text or OPTION_RE.search(text):
        return "选择题"
    if CALC_RE.search(text) or "计算" in text or "口算" in text:
        return "计算题"
    if "解决" in text or "多少" in text or "几" in text or "求" in text or "列式" in text:
        return "应用题"
    if "填" in text or "____" in text or "（ ）" in text:
        return "填空题"
    return "综合题"


def useful(text: str) -> bool:
    if len(text) < 6 or len(text) > 180:
        return False
    if BAD_TEXT_RE.search(text) or BAD_EXTRA_RE.search(text):
        return False
    if MERGED_STEM_RE.search(text) or len(re.findall(r"？|\?", text)) > 1:
        return False
    if re.search(r"^\d+[：:]", text) or re.search(r"[。；;]\d", text):
        return False
    if re.search(r"[（(]\s*[）)]", text) and len(re.findall(r"[（(]\s*[）)]", text)) > 3:
        return False
    if IMAGE_DEPENDENT_RE.search(text) and not ATTACHABLE_VISUAL_RE.search(text):
        return False
    if re.search(r"^从[左右](?:边)?数", text) and not ATTACHABLE_VISUAL_RE.search(text):
        return False
    if ATTACHABLE_VISUAL_RE.search(text):
        return True
    if text.count("（") != text.count("）") or text.count("(") != text.count(")"):
        return False
    if re.search(r"\d{5,}", text):
        return False
    if text.endswith(("可能", "第（", "第(", "小", "还", "（", "(", "=", "＝", "○", "□", "△", "：", ":", "+", "-", "＋", "－", "×", "÷")):
        return False
    if re.search(r"比（\s*）$", text):
        return False
    if re.search(r"(面积|周长|体积)\s*[=＝]", text) and "（" not in text and "？" not in text and "?" not in text:
        return False
    if re.search(r"[A-D][\.．、][^A-D]{0,3}$", text):
        return False
    if any(key in text for key in ("例如", "比值是", "等于以上")) and not any(mark in text for mark in ("（", "）", "？", "?", "____")):
        return False
    if re.match(r"^\d+(?:\.\d+)?(?:元|米|厘米|千克|克|平方厘米|平方米|度|°)[。；;，,]", text):
        return False
    if re.match(r"^（\s*）比（\s*）(?:多|少)", text):
        return False
    if not any(mark in text for mark in ("？", "?", "。", "=", "＝", "（）", "____", "________")) and not text.endswith(("多少", "几个", "几")):
        return False
    if text.count("（") + text.count("(") > 5:
        return False
    if len(re.findall(r"[○◯]", text)) >= 4 or len(re.findall(r"____", text)) >= 2:
        return False
    if len(re.findall(r"[一二三四五六七八九十][、.．]", text)) >= 2:
        return False
    qtype = classify(text)
    if qtype == "应用题" and len(re.findall(r"\d+", text)) < 2:
        return False
    if qtype == "填空题" and "（" in text and "）" not in text:
        return False
    if any(marker in text for marker in ("学习目标", "教学目标", "教学过程", "教师活动", "学生活动")):
        return False
    if any(marker in text for marker in ("教学重点", "教学难点", "学情", "教材分析", "设计意图", "课时目标")):
        return False
    if any(marker in text for marker in ("形如", "一般地", "通常", "可以写成", "叫作", "称为")):
        return False
    if any(marker in text for marker in ("style.visibility", "ppt_x", "ppt_y", "visibilit", "选自《", "教学课件")):
        return False
    if any(marker in text for marker in ("答：", "原式＝", "课堂总结", "探索新知", "归纳总结", "深化知", "典型知识点")):
        return False
    if re.search(r"[厘毫千分平立]。?$", text):
        return False
    return any(hint in text for hint in QUESTION_HINTS)


def extract_from_text(text: str):
    compact = compact_text(before_answers(text))
    questions = []
    seen = set()
    for stem, qtype in extract_marker_blocks(text):
        if useful(stem) and stem not in seen:
            seen.add(stem)
            questions.append((stem, qtype))
    for chunk in split_numbered(compact):
        chunk = clean_question(chunk)
        calcs = CALC_RE.findall(chunk)
        if calcs:
            for calc in calcs:
                q = f"计算：{re.sub(r'\\s+', '', calc)}"
                if q not in seen:
                    seen.add(q)
                    questions.append((q, "计算题"))
            continue
        if useful(chunk) and chunk not in seen:
            seen.add(chunk)
            questions.append((chunk, classify(chunk)))
    return questions


def extract_marker_blocks(text: str):
    lines = [line.strip() for line in before_answers(text).splitlines()]
    questions = []
    current = []
    for line in lines:
        if not line:
            continue
        if BLOCK_START_RE.match(line):
            if current:
                add_block_question(questions, current)
            current = [line]
            continue
        if current and BLOCK_STOP_RE.match(line) and not BLOCK_START_RE.match(line):
            add_block_question(questions, current)
            current = []
            continue
        if current:
            current.append(line)
    if current:
        add_block_question(questions, current)
    return questions


def add_block_question(questions, lines):
    text = compact_text("\n".join(lines))
    text = clean_question(text)
    if text:
        questions.append((text, classify(text)))


def load_packages(packages_dir: Path):
    packages = []
    for path in sorted(packages_dir.glob("*.json")):
        data = load_json(path)
        scope = data.get("scope", {})
        points = data.get("knowledge_points", [])
        units = data.get("units", [])
        packages.append({
            "file": path.name,
            "package_id": data.get("package_id"),
            "grade": scope.get("grade"),
            "semester": scope.get("semester"),
            "subject": scope.get("subject"),
            "units": units,
            "points": points,
        })
    fallback = packages_dir.parent / "knowledge_points.json"
    if fallback.exists():
        data = load_json(fallback)
        if data.get("package_id") and not any(item.get("package_id") == data.get("package_id") for item in packages):
            scope = data.get("scope", {})
            packages.append({
                "file": fallback.name,
                "package_id": data.get("package_id"),
                "grade": scope.get("grade"),
                "semester": scope.get("semester"),
                "subject": scope.get("subject"),
                "units": data.get("units", []),
                "points": data.get("knowledge_points", []),
            })
    return packages


def book_to_scope(book_key: str):
    match = re.match(r"g([1-6])_(up|down)_", book_key or "")
    if not match:
        return None, None
    grade = "一二三四五六"[int(match.group(1)) - 1] + "年级"
    semester = "上册" if match.group(2) == "up" else "下册"
    return grade, semester


def best_package(packages, row):
    grade, semester = book_to_scope(row.get("book_key", ""))
    for package in packages:
        if package["grade"] == grade and package["semester"] == semester and package["subject"] == "数学":
            return package
    return None


def infer_point(package, source_text):
    if not package:
        return None, None
    text = source_text.replace(" ", "")
    solid_terms = ("长方体", "正方体", "圆柱", "圆锥", "立体图形")
    if any(key in text for key in solid_terms) or ("球" in text and any(key in text for key in ("图形", "形状", "第（", "下面", "从左", "从右"))):
        shape_point = next((point for point in package["points"] if any(key in f"{point.get('unit','')}{point.get('name','')}" for key in solid_terms)), None)
        if shape_point:
            unit = next((item for item in package["units"] if item.get("id") == shape_point.get("unit_id") or item.get("name") == shape_point.get("unit")), None)
            return unit, shape_point
        return None, None
    best = None
    best_score = -1
    unit_by_id = {unit.get("id"): unit for unit in package["units"]}
    for point in package["points"]:
        name = str(point.get("name", ""))
        unit = str(point.get("unit", ""))
        score = 0
        if name and name in text:
            score += 80 + len(name)
        if unit and unit in text:
            score += 30 + len(unit)
        for token in re.split(r"[、和与（）()·\s]+", name):
            if len(token) >= 2 and token in text:
                score += len(token)
        for token in re.split(r"[、和与（）()·\s]+", unit):
            if len(token) >= 2 and token in text:
                score += len(token)
        if score > best_score:
            best = point
            best_score = score
    if best and best_score >= 20:
        unit = unit_by_id.get(best.get("unit_id")) or next((item for item in package["units"] if item.get("name") == best.get("unit")), None)
        return unit, best
    special = [
        (("位置", "上下", "前后", "左右", "从左", "从右", "第（"), ("位置", "左右", "上下", "前后", "第几")),
        (("比多", "比少", "多得多", "少得多", "多一些", "少一些"), ("比多少", "比较")),
        (("人民币", "元", "角", "分"), ("人民币", "元角分")),
        (("长度", "厘米", "分米", "米"), ("长度", "厘米", "分米", "米")),
        (("面积", "平方", "周长", "长方形", "正方形"), ("面积", "周长", "长方形", "正方形")),
        (("质量", "克", "千克", "吨"), ("质量", "克", "千克", "吨")),
        (("分数", "几分之", "真分数", "假分数", "通分", "约分"), ("分数", "约分", "通分")),
        (("小数", "十分位", "百分位"), ("小数",)),
        (("圆柱", "圆锥", "体积", "表面积"), ("圆柱", "圆锥", "体积", "表面积")),
        (("比例", "成正比例", "成反比例", "比例尺"), ("比例", "比例尺")),
        (("钟面", "时针", "分针", "秒针", "分钟", "小时", "经过时间"), ("时间", "钟")),
        (("余数", "除数", "被除数", "商"), ("余数", "除法")),
        (("三位数", "四位数", "千", "万", "读作", "写作", "近似数"), ("万以内", "读写", "组成", "近似")),
        (("乘", "倍", "×"), ("乘", "倍")),
        (("加", "减", "+", "-"), ("加", "减")),
    ]
    for text_keys, point_keys in special:
        if any(key in text for key in text_keys):
            matched = next(
                (
                    point for point in package["points"]
                    if any(key in f"{point.get('unit','')}{point.get('name','')}" for key in point_keys)
                ),
                None,
            )
            if matched:
                unit = next((item for item in package["units"] if item.get("id") == matched.get("unit_id") or item.get("name") == matched.get("unit")), None)
                return unit, matched
    if not best or best_score <= 0:
        return None, None
    if not best:
        return None, None
    unit = unit_by_id.get(best.get("unit_id")) or next((item for item in package["units"] if item.get("name") == best.get("unit")), None)
    return unit, best


def stable_id(text: str):
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]


def compatible_with_point(stem: str, point) -> bool:
    if not point:
        return False
    target = f"{point.get('unit','')}{point.get('name','')}"
    if any(key in target for key in ("圆的认识", "圆的周长", "圆的面积", "扇形")):
        return any(key in stem for key in ("圆", "半径", "直径", "周长", "面积", "π", "时针", "分针", "钟"))
    if any(key in target for key in ("角的度量", "量角", "画角", "角的认识", "角的分类")):
        return any(key in stem for key in ("角", "度", "°", "量角器", "三角尺", "∠"))
    if "小数加减" in target or "小数加法" in target or "小数减法" in target:
        return "小数" in stem or bool(re.search(r"\d+\.\d+", stem))
    if any(key in target for key in ("长方体", "正方体", "圆柱", "圆锥", "立体图形")):
        return any(key in stem for key in ("长方体", "正方体", "圆柱", "圆锥", "体积", "表面积", "容积", "棱长"))
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", default=r".tools\material_work\extract_report.jsonl")
    parser.add_argument("--packages-dir", default=r"content\packages")
    parser.add_argument("--out", default=r"content\extracted_question_bank.json")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    packages = load_packages(Path(args.packages_dir))
    seen = set()
    questions = []
    stats = {"files": 0, "used_files": 0, "duplicates": 0}
    type_counts = {}
    book_counts = {}

    with Path(args.report).open("r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            row = json.loads(line)
            if row.get("status") != "ok" or row.get("category") not in TARGET_CATEGORIES:
                continue
            text_path = Path(row.get("text_path", ""))
            if not text_path.exists():
                continue
            stats["files"] += 1
            package = best_package(packages, row)
            source = f"{row.get('path','')} {row.get('name','')}"
            extracted = extract_from_text(text_path.read_text(encoding="utf-8", errors="ignore"))
            file_used = False
            for stem, qtype in extracted:
                unit, point = infer_point(package, f"{stem} {source}")
                if not point:
                    continue
                if not compatible_with_point(stem, point):
                    continue
                key = re.sub(r"\d+", "#", stem)
                key = re.sub(r"[，。,.；;：:？?（）()_—\\s]+", "", key)
                # Keep genuinely different stems, but drop exact same skeleton repeated by duplicated files.
                unique_key = f"{row.get('book_key')}|{qtype}|{key}"
                if unique_key in seen:
                    stats["duplicates"] += 1
                    continue
                seen.add(unique_key)
                file_used = True
                grade, semester = book_to_scope(row.get("book_key", ""))
                question = {
                    "id": stable_id(f"{row.get('id')}|{stem}"),
                    "question": stem,
                    "answer": "",
                    "explanation": "摘录自本地教材资料，请以原资料答案或教师讲解为准。",
                    "source_mode": "extracted",
                    "question_type": qtype,
                    "type": qtype,
                    "difficulty": "基础",
                    "grade": grade,
                    "semester": semester,
                    "subject": "数学",
                    "textbook": "人教版",
                    "package_id": package["package_id"] if package else None,
                    "unit_id": unit.get("id") if unit else None,
                    "unit": unit.get("name") if unit else "",
                    "knowledge_point_id": point.get("id") if point else None,
                    "knowledge_point": point.get("name") if point else "",
                    "source_file_id": row.get("id"),
                    "source_name": row.get("name"),
                    "source_path": row.get("path"),
                }
                questions.append(question)
                type_counts[qtype] = type_counts.get(qtype, 0) + 1
                book_counts[row.get("book_key", "unknown")] = book_counts.get(row.get("book_key", "unknown"), 0) + 1
                if args.limit and len(questions) >= args.limit:
                    break
            if file_used:
                stats["used_files"] += 1
            if args.limit and len(questions) >= args.limit:
                break

    result = {
        "version": "extracted-2026-05-29",
        "mode": "source_question_extract_only",
        "stats": {**stats, "questions": len(questions), "types": type_counts, "books": book_counts},
        "questions": questions,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["stats"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
