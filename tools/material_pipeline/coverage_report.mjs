import fs from "node:fs";

const bank = JSON.parse(fs.readFileSync("content/extracted_question_bank.json", "utf8"));
const MIN_VISIBLE_TYPE_QUESTIONS = 5;
const packageFiles = [
  "content/knowledge_points.json",
  ...fs.readdirSync("content/packages")
    .filter((file) => file.endsWith(".json"))
    .map((file) => `content/packages/${file}`)
];

const counts = new Map();
const typeCounts = new Map();
for (const question of bank.questions || []) {
  const key = `${question.package_id}::${question.knowledge_point_id}`;
  counts.set(key, (counts.get(key) || 0) + 1);
  const typeKey = `${key}::${question.question_type}`;
  typeCounts.set(typeKey, (typeCounts.get(typeKey) || 0) + 1);
}

const rows = [];
for (const file of packageFiles) {
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!pkg.package_id || !Array.isArray(pkg.knowledge_points)) continue;
  for (const point of pkg.knowledge_points) {
    const count = counts.get(`${pkg.package_id}::${point.id}`) || 0;
    const visibleTypes = [...typeCounts]
      .filter(([key, value]) => key.startsWith(`${pkg.package_id}::${point.id}::`) && value >= MIN_VISIBLE_TYPE_QUESTIONS)
      .map(([key]) => key.split("::").slice(2).join("::"));
    rows.push({
      packageId: pkg.package_id,
      grade: pkg.scope?.grade,
      semester: pkg.scope?.semester,
      unit: point.unit,
      knowledgePoint: point.name,
      count,
      visibleTypes,
      visible: visibleTypes.length > 0
    });
  }
}

const report = {
  totalQuestions: bank.questions?.length || 0,
  generatedDiagramQuestions: bank.stats?.generated_diagram_questions || 0,
  visibleKnowledgePoints: rows.filter((row) => row.visible).length,
  hiddenKnowledgePoints: rows.filter((row) => !row.visible).length,
  zeroKnowledgePoints: rows.filter((row) => row.count === 0).length,
  lowKnowledgePoints: rows.filter((row) => row.count > 0 && row.count < 3).length,
  visibleTypeGroups: rows.reduce((sum, row) => sum + row.visibleTypes.length, 0),
  books: Object.fromEntries(
    [...groupBy(rows, (row) => `${row.grade}${row.semester}`)].map(([book, items]) => [
      book,
      {
        visible: items.filter((row) => row.visible).length,
        hidden: items.filter((row) => !row.visible).length,
        questions: items.reduce((sum, row) => sum + row.count, 0)
      }
    ])
  ),
  hidden: rows.filter((row) => !row.visible)
};

fs.writeFileSync(".tools/material_work/coverage_report.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  totalQuestions: report.totalQuestions,
  visibleKnowledgePoints: report.visibleKnowledgePoints,
  hiddenKnowledgePoints: report.hiddenKnowledgePoints,
  zeroKnowledgePoints: report.zeroKnowledgePoints,
  lowKnowledgePoints: report.lowKnowledgePoints
}, null, 2));

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}
