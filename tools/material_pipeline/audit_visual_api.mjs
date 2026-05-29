const base = process.env.API_BASE || "http://127.0.0.1:8787";

const visualRe = /图形|几何|长方形|正方形|长方体|正方体|圆柱|圆锥|圆|角|三角形|平行四边形|梯形|面积|周长|体积|观察物体|位置与方向|统计图|轴对称|平移|旋转|放大|缩小|数对/;

const catalog = await (await fetch(`${base}/api/content-package`)).json();
const bad = [];
const checked = [];

for (const pkg of catalog.packages || []) {
  const scope = pkg.scope || {};
  for (const point of pkg.options?.knowledgePoints || []) {
    const unit = unitFor(pkg, point);
    if (!visualRe.test(`${unit} ${point.name}`)) continue;
    for (const type of point.recommendedQuestionTypes || []) {
      const body = {
        grade: scope.grade,
        semester: scope.semester,
        subject: scope.subject,
        textbook: scope.textbook,
        unit,
        knowledgePoint: point.name,
        type,
        difficulty: "基础",
        count: 5
      };
      const response = await fetch(`${base}/api/generate/textbook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      const questions = data.questions || [];
      const missing = questions.filter((question) => !question.image);
      checked.push({ body, returned: questions.length, imageCount: questions.length - missing.length });
      if (!response.ok || questions.length < 5 || missing.length) {
        bad.push({
          body,
          status: response.status,
          returned: questions.length,
          missingImage: missing.length,
          samples: missing.slice(0, 3).map((question) => question.question)
        });
      }
    }
  }
}

const report = {
  checked: checked.length,
  badCount: bad.length,
  firstBad: bad.slice(0, 10)
};

console.log(JSON.stringify(report, null, 2));
if (bad.length) process.exit(1);

function unitFor(pkg, point) {
  return (pkg.options?.units || [])
    .find((unit) => (unit.lessons || []).some((lesson) => (lesson.knowledgePoints || []).some((kp) => kp.id === point.id)))
    ?.name || "";
}
