import argparse
import hashlib
import json
import os
import re
from pathlib import Path


BOOK_RE = re.compile(r"(?P<grade>[1-6])(?P<semester>[上下])-小学(?P<subject>[^\\/]+?)人教版")


def detect_book(path: Path):
    text = str(path)
    match = BOOK_RE.search(text)
    if not match:
        return None
    subject = match.group("subject").strip()
    return {
        "grade_num": int(match.group("grade")),
        "grade": ["", "一年级", "二年级", "三年级", "四年级", "五年级", "六年级"][int(match.group("grade"))],
        "semester": "上册" if match.group("semester") == "上" else "下册",
        "subject": subject,
        "textbook": "人教版",
        "book_key": f"g{match.group('grade')}_{'up' if match.group('semester') == '上' else 'down'}_{subject}",
    }


def classify(path: Path):
    text = str(path)
    if "知识" in text or "清单" in text or "总结" in text or "归纳" in text:
        return "knowledge"
    if "教案" in text or "教学设计" in text:
        return "lesson_plan"
    if "学案" in text or "任务单" in text or "导学案" in text:
        return "student_sheet"
    if "作业" in text or "练习" in text or "习题" in text or "试卷" in text or "测试" in text:
        return "practice"
    if "课件" in text:
        return "slides"
    if "电子" in text or "课本" in text or "原文" in text:
        return "textbook"
    return "other"


def file_id(path: Path):
    return hashlib.sha1(str(path).encode("utf-8", "surrogatepass")).hexdigest()[:16]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=r"D:\教材")
    parser.add_argument("--out", default=r".tools\material_work\manifest.jsonl")
    args = parser.parse_args()

    root = Path(args.root)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    for dirpath, _, filenames in os.walk(root):
        for name in filenames:
            path = Path(dirpath) / name
            book = detect_book(path)
            suffix = path.suffix.lower()
            try:
                stat = path.stat()
            except OSError:
                continue
            row = {
                "id": file_id(path),
                "path": str(path),
                "name": path.name,
                "extension": suffix,
                "size": stat.st_size,
                "category": classify(path),
                "extractable": suffix in {".docx", ".pptx", ".pdf", ".txt"},
                **(book or {}),
            }
            rows.append(row)

    with out.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    stats = {}
    for row in rows:
        key = (row.get("book_key") or "unknown", row["extension"])
        stats[key] = stats.get(key, 0) + 1
    print(json.dumps({
        "files": len(rows),
        "extractable": sum(1 for row in rows if row["extractable"]),
        "books": sorted(set(row.get("book_key") for row in rows if row.get("book_key"))),
        "manifest": str(out),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
