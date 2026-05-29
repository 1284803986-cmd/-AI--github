import fs from "node:fs";

const bank = JSON.parse(fs.readFileSync("content/extracted_question_bank.json", "utf8"));
const MIN_VISIBLE_TYPE_QUESTIONS = 3;
const MIN_DELIVERABLE_TYPE_QUESTIONS = 5;
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
      .filter(([key]) => deliverableTypeCount(bank.questions || [], `${pkg.package_id}::${point.id}`, key.split("::").slice(2).join("::")) >= MIN_DELIVERABLE_TYPE_QUESTIONS)
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

function deliverableTypeCount(questions, pointKey, type) {
  const [packageId, pointId] = pointKey.split("::");
  const exactItems = questions.filter((item) => item.package_id === packageId && item.knowledge_point_id === pointId);
  const sample = exactItems.find((item) => item.question_type === type) || exactItems[0];
  if (!sample) return 0;
  const input = {
    grade: sample.grade,
    semester: sample.semester,
    subject: sample.subject,
    unit: sample.unit,
    type
  };
  const typedBase = questions.filter((item) => baseMatch(item, input, type));
  const bookBase = questions.filter((item) => baseMatch(item, input, ""));
  const base = typedBase.length ? typedBase : bookBase;
  const exact = base.filter((item) => item.knowledge_point_id === pointId || item.knowledge_point === sample.knowledge_point);
  const unit = base.filter((item) => item.unit === sample.unit);
  const fallbackUnit = bookBase.filter((item) => item.unit === sample.unit);
  return uniqueByStem(mergePools(exact, unit, fallbackUnit)).length;
}

function baseMatch(item, input, type) {
  if (item.grade !== input.grade) return false;
  if (item.semester !== input.semester) return false;
  if (item.subject !== input.subject) return false;
  if (type && item.question_type !== type) return false;
  return true;
}

function uniqueByStem(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = String(item.question || "")
      .replace(/\d+(?:\.\d+)?/g, "#")
      .replace(/[一二三四五六七八九十百千万]+/g, "#")
      .replace(/[，。！？、；;：:\s（）()]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function mergePools(...pools) {
  const seen = new Set();
  const result = [];
  for (const pool of pools) {
    for (const item of pool || []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}
