import argparse
import html
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
SPACE_RE = re.compile(r"[ \t\r\f\v]+")
NEWLINE_RE = re.compile(r"\n{3,}")


def clean_text(text: str) -> str:
    text = html.unescape(text or "")
    text = CONTROL_RE.sub("", text)
    text = SPACE_RE.sub(" ", text)
    lines = [line.strip() for line in text.splitlines()]
    text = "\n".join(line for line in lines if line)
    return NEWLINE_RE.sub("\n\n", text).strip()


def xml_text(data: bytes) -> str:
    try:
        root = ET.fromstring(data)
    except ET.ParseError:
        return ""
    chunks = []
    for node in root.iter():
        if node.text:
            chunks.append(node.text)
        if node.tail:
            chunks.append(node.tail)
    return "\n".join(chunks)


def extract_docx(path: Path) -> str:
    parts = []
    with zipfile.ZipFile(path) as zf:
        names = zf.namelist()
        targets = [n for n in names if n.startswith("word/") and n.endswith(".xml")]
        priority = ["word/document.xml"] + [n for n in targets if n != "word/document.xml"]
        for name in priority:
            if name in names:
                parts.append(xml_text(zf.read(name)))
    return clean_text("\n".join(parts))


def extract_pptx(path: Path) -> str:
    parts = []
    with zipfile.ZipFile(path) as zf:
        names = sorted(n for n in zf.namelist() if n.startswith("ppt/slides/slide") and n.endswith(".xml"))
        for name in names:
            parts.append(xml_text(zf.read(name)))
    return clean_text("\n".join(parts))


def extract_pdf(path: Path) -> str:
    sys.path.insert(0, str(Path.cwd() / ".tools" / "pymupdf"))
    import fitz  # type: ignore

    parts = []
    with fitz.open(path) as doc:
        for page in doc:
            parts.append(page.get_text("text"))
    return clean_text("\n".join(parts))


def extract_txt(path: Path) -> str:
    for enc in ("utf-8", "gb18030", "utf-16", "latin1"):
        try:
            return clean_text(path.read_text(encoding=enc, errors="ignore"))
        except Exception:
            pass
    return ""


def extract(path: Path, ext: str) -> str:
    if ext == ".docx":
        return extract_docx(path)
    if ext == ".pptx":
        return extract_pptx(path)
    if ext == ".pdf":
        return extract_pdf(path)
    if ext == ".txt":
        return extract_txt(path)
    return ""


def should_focus(row, mode):
    if mode == "all":
        return True
    if row.get("category") in {"knowledge", "lesson_plan", "student_sheet", "textbook"}:
        return True
    name = row.get("name", "")
    return any(key in name for key in ["目录", "全册", "单元", "知识", "整理", "复习"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default=r".tools\material_work\manifest.jsonl")
    parser.add_argument("--out-dir", default=r".tools\material_work\texts")
    parser.add_argument("--report", default=r".tools\material_work\extract_report.jsonl")
    parser.add_argument("--mode", choices=["focus", "all"], default="focus")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    report_path = Path(args.report)
    done = set()
    if report_path.exists():
        for line in report_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            try:
                row = json.loads(line)
                if row.get("status") == "ok":
                    done.add(row["id"])
            except Exception:
                continue

    count = 0
    with Path(args.manifest).open("r", encoding="utf-8") as src, report_path.open("a", encoding="utf-8") as report:
        for line in src:
            row = json.loads(line)
            if not row.get("extractable") or row["id"] in done or not should_focus(row, args.mode):
                continue
            if args.limit and count >= args.limit:
                break
            count += 1
            out_file = out_dir / f"{row['id']}.txt"
            try:
                text = extract(Path(row["path"]), row["extension"])
                if len(text) > 250_000:
                    text = text[:250_000]
                out_file.write_text(text, encoding="utf-8")
                status = {
                    **row,
                    "status": "ok",
                    "text_path": str(out_file),
                    "chars": len(text),
                    "lines": text.count("\n") + (1 if text else 0),
                }
            except Exception as exc:
                status = {**row, "status": "error", "error": f"{type(exc).__name__}: {exc}"}
            report.write(json.dumps(status, ensure_ascii=False) + "\n")
            if count % 100 == 0:
                print(json.dumps({"processed": count, "last": row["path"]}, ensure_ascii=True), flush=True)

    print(json.dumps({"processed_this_run": count, "report": str(report_path), "texts": str(out_dir)}, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
