import fs from "node:fs";

const bank = JSON.parse(fs.readFileSync("content/extracted_question_bank.json", "utf8"));
const questions = bank.questions || [];

const needImageRe = /如图|看图|图中|下图|上图|下面图形|下面.*图|从上面|从左面|从正面|涂色|圈一圈|圈起来|圈出|画一画|连一连|连线|哪个方向看到|下面钟面|钟面上|形成的角|条形图|扇形图|折线统计图|统计图|观察物体|看到的形状|轴对称|平移|旋转/;
const shapeUnitRe = /图形|几何|长方形|正方形|长方体|正方体|圆柱|圆|角|三角形|平行四边形|梯形|面积|周长|体积|观察物体|位置与方向|统计图|轴对称|平移|旋转/;

const falsePositiveRe = /旋转木马/;
const missingNeed = questions.filter((question) => {
  const text = `${question.question || ""} ${question.unit || ""} ${question.knowledge_point || ""}`;
  return needImageRe.test(text) && !falsePositiveRe.test(text) && !question.image;
});
const shapeNoImage = questions.filter((question) => {
  const text = `${question.unit || ""} ${question.knowledge_point || ""}`;
  return shapeUnitRe.test(text) && !question.image;
});
const shapeWithImage = questions.filter((question) => {
  const text = `${question.unit || ""} ${question.knowledge_point || ""}`;
  return shapeUnitRe.test(text) && question.image;
});

const report = {
  total: questions.length,
  missingNeed: missingNeed.length,
  shapeNoImage: shapeNoImage.length,
  shapeWithImage: shapeWithImage.length,
  missingNeedGroups: group(missingNeed),
  shapeNoImageSamples: shapeNoImage.slice(0, 30).map((question) => ({
    id: question.id,
    grade: question.grade,
    semester: question.semester,
    unit: question.unit,
    knowledgePoint: question.knowledge_point,
    type: question.question_type,
    question: String(question.question || "").slice(0, 160)
  })),
  samples: missingNeed.slice(0, 80).map((question) => ({
    id: question.id,
    grade: question.grade,
    semester: question.semester,
    unit: question.unit,
    knowledgePoint: question.knowledge_point,
    type: question.question_type,
    question: String(question.question || "").slice(0, 160)
  }))
};

fs.mkdirSync(".tools/material_work", { recursive: true });
fs.writeFileSync(".tools/material_work/visual_audit.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));

function group(items) {
  const map = new Map();
  for (const question of items) {
    const key = `${question.grade}|${question.semester}|${question.unit}|${question.knowledge_point}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([key, count]) => ({ key, count }));
}
