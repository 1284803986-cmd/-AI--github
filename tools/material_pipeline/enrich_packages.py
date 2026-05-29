import json
from pathlib import Path


KEY_TO_PACKAGE = {
    "g1_up_数学": "content/packages/g1_math_up_rj_2026.json",
    "g1_down_数学": "content/packages/g1_math_down_rj_2026.json",
    "g2_up_数学": "content/packages/g2_math_up_rj_2026.json",
    "g2_down_数学": "content/packages/g2_math_down_rj_2026.json",
    "g2_down_数学__legacy": "content/packages/g2_math_down_2025.json",
    "g3_up_数学": "content/packages/g3_math_up_rj_2026.json",
    "g3_down_数学": "content/packages/g3_math_down_rj_2026.json",
    "g4_up_数学": "content/packages/g4_math_up_rj_2026.json",
    "g4_down_数学": "content/knowledge_points.json",
    "g5_up_数学": "content/packages/g5_math_up_rj_2026.json",
    "g5_down_数学": "content/packages/g5_math_down_rj_2026.json",
    "g6_up_数学": "content/packages/g6_math_up_rj_2026.json",
    "g6_down_数学": "content/packages/g6_math_down_rj_2026.json",
}


def main():
    summary = json.loads(Path("content/material_summaries.json").read_text(encoding="utf-8"))
    by_key = {book["book_key"]: book for book in summary["books"]}
    for key, file_name in KEY_TO_PACKAGE.items():
        summary_key = key.replace("__legacy", "")
        book = by_key.get(summary_key)
        path = Path(file_name)
        if not book or not path.exists():
            continue
        pkg = json.loads(path.read_text(encoding="utf-8"))
        extraction_summary = {
            "source": "D:\\教材",
            "extracted_files": book["extracted_files"],
            "selected_files": book["selected_files"],
            "categories": book["categories"],
            "top_terms": book["top_terms"][:50],
            "top_headings": book["top_headings"][:30],
        }
        pkg["extraction_summary"] = extraction_summary
        sources = pkg.setdefault("sources", [])
        source_id = f"{pkg.get('package_id', key)}_extracted_summary"
        sources[:] = [item for item in sources if item.get("id") != source_id]
        sources.append({
            "id": source_id,
            "source_type": "local_material_text_extraction",
            "name": "D:\\教材 自动抽取摘要",
            "use": f"已抽取 {book['extracted_files']} 份可读资料，用于细化知识点、常见易错点和原创题模板。",
        })
        path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    default_pkg = json.loads(Path("content/knowledge_points.json").read_text(encoding="utf-8"))
    if "sources" in default_pkg:
        Path("content/textbook_sources.json").write_text(
            json.dumps({"sources": default_pkg["sources"]}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
