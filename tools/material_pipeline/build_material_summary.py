import argparse
import collections
import json
import re
from pathlib import Path


STOP_WORDS = {
    "学生", "教师", "教学", "学习", "问题", "过程", "活动", "知识", "能力", "方法",
    "通过", "进行", "能够", "理解", "掌握", "认识", "解决", "设计", "练习", "答案",
    "核心", "素养", "目标", "分析", "要求", "数学", "人教版", "年级", "上册", "下册",
}

NOISE_PATH_KEYS = [
    "教师工作包", "工作计划", "工作总结", "班主任", "班队会", "主题班会", "安全",
    "语文", "英语", "体育", "音乐", "美术", "德育", "少先队", "中小学教师职业道德",
    "豫剧", "秦香莲", "蝴蝶杯", "穆桂英", "红娘", "对花枪", "去水印",
]

HEAD_RE = re.compile(r"第[一二三四五六七八九十0-9]+[单章节课时].{0,28}|[0-9]+[.、]\s*[^\n]{2,30}|《[^》]{2,24}》")
TERM_RE = re.compile(r"[\u4e00-\u9fffA-Za-z0-9]{2,12}")


def load_report(path):
    rows = []
    for line in Path(path).read_text(encoding="utf-8", errors="ignore").splitlines():
        try:
            row = json.loads(line)
        except Exception:
            continue
        if row.get("status") == "ok" and row.get("chars", 0) > 0:
            path_text = row.get("path", "")
            if any(key in path_text for key in NOISE_PATH_KEYS):
                continue
            rows.append(row)
    return rows


def score_row(row):
    category_score = {
        "knowledge": 20,
        "lesson_plan": 12,
        "student_sheet": 10,
        "textbook": 10,
        "practice": 6,
        "slides": 4,
        "other": 1,
    }.get(row.get("category"), 1)
    name = row.get("name", "")
    bonus = 0
    for key in ["全册", "知识", "清单", "总结", "归纳", "单元", "教案", "学案", "任务单"]:
        if key in name:
            bonus += 3
    return category_score + bonus + min(10, row.get("chars", 0) // 5000)


def terms_from(text):
    counter = collections.Counter()
    for term in TERM_RE.findall(text):
        if len(term) < 2 or term in STOP_WORDS or term.isdigit():
            continue
        if re.fullmatch(r"[A-Za-z0-9]+", term):
            continue
        counter[term] += 1
    return counter


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", default=r".tools\material_work\extract_report.jsonl")
    parser.add_argument("--out", default=r"content\material_summaries.json")
    args = parser.parse_args()

    rows = load_report(args.report)
    by_book = collections.defaultdict(list)
    for row in rows:
        by_book[row.get("book_key", "unknown")].append(row)

    result = {
        "version": "2026-05-29",
        "note": "由 D:\\教材 本地资料自动抽取生成，保存统计摘要、候选章节标题和高频知识词，不保存教材原文。",
        "books": []
    }

    for book_key, items in sorted(by_book.items()):
        if book_key == "unknown":
            continue
        selected = sorted(items, key=score_row, reverse=True)[:80]
        headings = collections.Counter()
        terms = collections.Counter()
        for row in selected:
            text_path = row.get("text_path")
            if not text_path:
                continue
            text = Path(text_path).read_text(encoding="utf-8", errors="ignore")
            for head in HEAD_RE.findall(text[:120_000]):
                head = re.sub(r"\s+", " ", head).strip(" 　：:。")
                if 2 <= len(head) <= 36:
                    headings[head] += 1
            terms.update(terms_from(text[:120_000]))

        first = selected[0] if selected else items[0]
        result["books"].append({
            "book_key": book_key,
            "grade": first.get("grade"),
            "semester": first.get("semester"),
            "subject": first.get("subject"),
            "textbook": first.get("textbook"),
            "extracted_files": len(items),
            "selected_files": len(selected),
            "categories": dict(collections.Counter(row.get("category") for row in items)),
            "top_headings": [name for name, _ in headings.most_common(80)],
            "top_terms": [name for name, _ in terms.most_common(120)],
            "sample_sources": [
                {
                    "path": row.get("path"),
                    "category": row.get("category"),
                    "chars": row.get("chars"),
                }
                for row in selected[:20]
            ],
        })

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"books": len(result["books"]), "out": str(out)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
