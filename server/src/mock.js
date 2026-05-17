import { findKnowledgePoint, templatesFor } from "./content.js";

export function mockTextbookQuestions(input, context) {
  const count = clamp(input.count, 1, 30);
  const knowledgePoint = context.knowledgePoint || findKnowledgePoint(context.contentPackage, input.knowledgePoint);
  const templates = context.templates?.length ? context.templates : templatesFor(context.contentPackage, knowledgePoint, input.type);
  return {
    title: `${input.grade}数学${knowledgePoint.name}练习`,
    grade: input.grade,
    semester: input.semester,
    subject: input.subject,
    textbook: input.textbook,
    unit: input.unit,
    questions: Array.from({ length: count }, (_, index) => buildQuestion(index + 1, knowledgePoint, templates[index % templates.length], input.difficulty || "基础"))
  };
}

export function mockWrongQuestion(input, context) {
  const knowledgePoint = inferKnowledgePoint(input.originalQuestion, context.contentPackage);
  const baseTemplates = templatesFor(context.contentPackage, knowledgePoint, "计算题");
  const variantTemplates = templatesFor(context.contentPackage, knowledgePoint, "变式题");
  return {
    title: `${knowledgePoint.name}错题同类巩固`,
    subject: "数学",
    grade_guess: "四年级",
    knowledge_point: knowledgePoint.name,
    original_analysis: buildOriginalAnalysis(input.originalQuestion, input.wrongAnswer),
    error_reason: pick(knowledgePoint.common_mistakes, 0),
    similar_questions: Array.from({ length: 5 }, (_, index) => buildQuestion(index + 1, knowledgePoint, baseTemplates[index % baseTemplates.length], "基础")),
    variation_questions: Array.from({ length: 3 }, (_, index) => buildQuestion(index + 1, knowledgePoint, variantTemplates[index % variantTemplates.length] || baseTemplates[index % baseTemplates.length], "提高"))
  };
}

export function mockPaper(input, context) {
  const count = clamp(input.count, 1, 40);
  const score = Math.max(1, Math.floor(input.totalScore / count));
  const points = context.contentPackage.knowledge_points;
  return {
    title: `${input.grade}数学${context.contentPackage.scope.unit}练习卷`,
    grade: input.grade,
    subject: input.subject,
    textbook: input.textbook,
    unit: context.contentPackage.scope.unit,
    total_score: input.totalScore,
    questions: Array.from({ length: count }, (_, index) => {
      const point = points[index % points.length];
      const type = index % 4 === 0 ? "应用题" : index % 4 === 1 ? "填空题" : index % 4 === 2 ? "判断题" : "计算题";
      const template = templatesFor(context.contentPackage, point, type)[0] || templatesFor(context.contentPackage, point)[0];
      const difficulty = index < count * 0.6 ? "基础" : index < count * 0.9 ? "提高" : "拔高";
      return { ...buildQuestion(index + 1, point, template, difficulty), score };
    })
  };
}

function buildQuestion(id, knowledgePoint, template, difficulty) {
  const values = numberSet(id);
  const question = fillTemplate(template.template, values);
  return {
    id,
    question,
    answer: calculateAnswer(question, template.answer_rule, values),
    explanation: `${template.answer_rule} 本题要点：${knowledgePoint.description}`,
    knowledge_point: knowledgePoint.name,
    difficulty,
    question_type: template.question_type,
    type: template.question_type,
    common_mistake: pick(knowledgePoint.common_mistakes, id - 1),
    parent_tip: "让孩子先说明小数点为什么要对齐，再动笔计算。"
  };
}

function inferKnowledgePoint(question, contentPackage) {
  if (question.includes("验算") || question.includes("判断")) return findKnowledgePoint(contentPackage, "小数加减法验算");
  if (question.includes("花") || question.includes("米") || question.includes("千克") || question.includes("还剩")) return findKnowledgePoint(contentPackage, "小数加减法解决实际问题");
  return findKnowledgePoint(contentPackage, "小数位数不同的小数加减法");
}

function buildOriginalAnalysis(originalQuestion, wrongAnswer) {
  const wrong = wrongAnswer ? `学生答案是 ${wrongAnswer}。` : "";
  return `${wrong}这类题需要先把小数点对齐，相同数位再加减；位数不同时可以在末尾补 0 后计算。`;
}

function numberSet(id) {
  const base = id + 3;
  return {
    a: (base + 0.5).toFixed(1),
    b: (id + 1.8).toFixed(1),
    c: (id + 0.6).toFixed(1)
  };
}

function fillTemplate(template, values) {
  return template.replaceAll("{a}", values.a).replaceAll("{b}", values.b).replaceAll("{c}", values.c);
}

function calculateAnswer(question, rule, values) {
  if (question.includes("判断")) return rule.includes("错误") ? "错误" : "正确";
  if (question.includes("是否正确")) return rule;
  if (question.includes("一共")) return `${format(Number(values.a) + Number(values.b))} 元`;
  if (question.includes("现在长")) return `${format(Number(values.a) - Number(values.b) + Number(values.c))} 米`;
  if (question.includes("+")) return format(Number(values.a) + Number(values.b));
  if (question.includes("-")) return format(Number(values.a) - Number(values.b));
  return rule;
}

function format(value) {
  return Number(value.toFixed(2)).toString();
}

function pick(list, index) {
  return list[index % list.length];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || min));
}
