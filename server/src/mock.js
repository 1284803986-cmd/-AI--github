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
  const answer = calculateAnswer(question, template.answer_rule, values);
  return {
    id,
    question,
    answer,
    explanation: `${template.answer_rule} 本题要点：${knowledgePoint.description}`,
    knowledge_point: knowledgePoint.name,
    difficulty,
    question_type: template.question_type,
    type: template.question_type,
    common_mistake: pick(knowledgePoint.common_mistakes, id - 1),
    parent_tip: buildParentTip(knowledgePoint)
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
  const m = (id % 5) + 3;
  const n = (id % 4) + 2;
  const product = m * n;
  const divisor = (id % 4) + 3;
  const quotient = (id % 5) + 4;
  const remainder = id % divisor;
  const dividend = divisor * quotient + remainder;
  const thousands = (id % 7) + 1;
  const hundreds = (id * 2) % 10;
  const tens = (id * 3) % 10;
  const ones = (id * 4 + 1) % 10;
  const num4 = thousands * 1000 + hundreds * 100 + tens * 10 + ones;
  const num4b = num4 + ((id % 2 === 0 ? -1 : 1) * ((id % 6) + 12));
  const addend1 = 230 + id * 17;
  const addend2 = 140 + id * 23;
  const carry1 = 368 + id * 11;
  const carry2 = 257 + id * 13;
  const subtrahend = 120 + id * 9;
  const minuend = subtrahend + 260 + id * 7;
  const borrow2 = 168 + id * 8;
  const borrow1 = borrow2 + 501 + id * 6;
  const diff = minuend - subtrahend;
  return {
    a: (base + 0.5).toFixed(1),
    a2: (base + 0.25).toFixed(2),
    b: (id + 1.8).toFixed(1),
    b2: (id + 1.75).toFixed(2),
    c: (id + 0.6).toFixed(1),
    hour: (id % 9) + 1,
    m,
    n,
    product,
    total: product * 2,
    divisor,
    quotient,
    remainder,
    dividend,
    thousands,
    hundreds,
    tens,
    ones,
    num4,
    num4b,
    addend1,
    addend2,
    carry1,
    carry2,
    subtrahend,
    minuend,
    borrow1,
    borrow2,
    diff
  };
}

function fillTemplate(template, values) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

function calculateAnswer(question, rule, values) {
  if (question.includes("判断")) return rule.includes("错误") ? "错误" : "正确";
  if (question.includes("是否正确")) return rule;
  if (question.includes("几个？") && question.includes("还剩")) return `${values.quotient} 个，剩 ${values.remainder} 个`;
  if (question.includes("几袋？还剩几个")) return `${values.quotient} 袋，还剩 ${values.remainder} 个`;
  if (question.includes("至少需要几条船")) return `${values.quotient + (values.remainder ? 1 : 0)} 条`;
  if (question.includes("每人分几颗")) return `${Math.floor(values.total / values.n)} 颗`;
  if (question.includes("可以扎几束")) return `${Math.floor(values.total / values.m)} 束`;
  if (question.includes("每个班分到几个")) return `${Math.floor((values.total - values.remainder) / values.n)} 个`;
  if (question.includes("结束时间比开始时间晚了多少分钟")) return `${values.m} 分钟`;
  if (question.includes("一共有多少支")) return `${values.m * values.n} 支`;
  if (question.includes("写出一道除法算式")) return String(values.n);
  if (question.includes("现在有多少本")) return `${values.minuend - values.subtrahend + values.m} 本`;
  if (question.includes("还剩多少张")) return `${values.m + values.n - values.divisor} 张`;
  if (question.includes("还剩几个任务")) return `${values.total - values.m - values.m * values.n} 个`;
  if (question.includes("由 ____ 个千")) return `${values.thousands}，${values.hundreds}，${values.tens}，${values.ones}`;
  if (question.includes("组成的数")) return String(values.num4);
  if (question.includes("接近整百数")) return String(Math.round(values.num4 / 100) * 100);
  if (question.includes("填“>”“<”")) return values.num4 > values.num4b ? ">" : values.num4 < values.num4b ? "<" : "=";
  if (question.includes("÷") && question.includes("……")) return `${values.quotient} …… ${values.remainder}`;
  if (question.includes("×")) return format(firstNumber(question) * secondNumber(question));
  if (question.includes("÷")) return format(firstNumber(question) / secondNumber(question));
  if (question.includes("一共") && question.includes("米")) return `${format(firstNumber(question) + secondNumber(question))} 米`;
  if (question.includes("一共")) return `${format(firstNumber(question) + secondNumber(question))} 元`;
  if (question.includes("现在长")) return `${format(Number(values.a) - Number(values.b) + Number(values.c))} 米`;
  if (question.includes("+") || question.includes("-")) return formatArithmetic(question);
  return rule;
}

function buildParentTip(knowledgePoint) {
  if (knowledgePoint.subject === "数学" && knowledgePoint.grade === "二年级") {
    return "让孩子先说清题目里的数量关系，再列式计算，最后检查单位和答语。";
  }
  return "让孩子先说明小数点为什么要对齐，再动笔计算。";
}

function firstNumber(text) {
  return Number(text.match(/\d+(?:\.\d+)?/)?.[0] || 0);
}

function secondNumber(text) {
  return Number(text.match(/\d+(?:\.\d+)?/g)?.[1] || 0);
}

function formatArithmetic(text) {
  const expr = text.match(/(\d+(?:\.\d+)?)(?:\s*)([+\-])(?:\s*)(\d+(?:\.\d+)?)(?:\s*([+\-])\s*(\d+(?:\.\d+)?))?/) || [];
  const first = Number(expr[1] || 0);
  const second = Number(expr[3] || 0);
  let value = expr[2] === "-" ? first - second : first + second;
  if (expr[4] && expr[5]) value = expr[4] === "-" ? value - Number(expr[5]) : value + Number(expr[5]);
  return format(value);
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
