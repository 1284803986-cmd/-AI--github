export function getPracticeQuestions(result) {
  if (!result) return [];
  return result.questions || [...(result.similar_questions || []), ...(result.variation_questions || [])];
}

export function normalizeQuestions(items = [], selectedType = "") {
  return items.map((item, index) => normalizeQuestion(item, selectedType, index));
}

export function normalizeQuestion(question = {}, selectedType = "", index = 0) {
  const type = normalizeQuestionType(selectedType || getQuestionType(question, "填空题"));
  const next = {
    ...question,
    id: getQuestionId(question, index + 1),
    questionId: getQuestionId(question, index + 1),
    question: getQuestionStem(question),
    options: normalizeOptions(question),
    answer: getQuestionAnswer(question),
    explanation: getQuestionExplanation(question),
    question_type: type,
    type
  };

  if (isChoiceType(type)) {
    next.options = normalizeOptions(next);
  }

  if (isJudgeType(type) && !["正确", "错误"].includes(String(next.answer || "").trim())) {
    next.question = `判断：${getQuestionStem(question)} 的参考答案是“${getQuestionAnswer(question)}”，这个说法是否正确？`;
    next.answer = "正确";
  }

  return next;
}

export function getQuestionId(question = {}, fallback = "") {
  return question.questionId || question.question_id || question.id || fallback;
}

export function getQuestionStem(question = {}) {
  return question.question || question.stem || question.title || "";
}

export function getQuestionType(question = {}, fallback = "") {
  return normalizeQuestionType(question.questionType || question.question_type || question.type || question.typeId || fallback);
}

export function normalizeQuestionType(value = "") {
  const raw = String(value || "").trim();
  const text = raw.toLowerCase().replace(/[\s_-]+/g, "");
  if (!text) return "";

  if (
    raw.includes("判断") ||
    ["judge", "truefalse", "trueorfalse", "tf", "判断题"].includes(text)
  ) return "判断题";

  if (
    raw.includes("选择") ||
    ["choice", "singlechoice", "multiplechoice", "select", "option", "选择题"].includes(text)
  ) return "选择题";

  if (
    raw.includes("填空") ||
    ["blank", "fillblank", "fillintheblank", "填空题"].includes(text)
  ) return "填空题";

  if (
    raw.includes("计算") ||
    ["calculation", "calculate", "compute", "math", "计算题"].includes(text)
  ) return "计算题";

  if (
    raw.includes("应用") ||
    ["application", "wordproblem", "storyproblem", "应用题"].includes(text)
  ) return "应用题";

  if (
    raw.includes("变式") ||
    ["variant", "variation", "similar", "变式题"].includes(text)
  ) return "变式题";

  return raw;
}

export function getQuestionAnswer(question = {}) {
  return question.answer || question.correctAnswer || question.correct_answer || "";
}

export function getQuestionExplanation(question = {}) {
  return question.explanation || question.analysis || question.solution || "";
}

export function getQuestionImage(question = {}) {
  return question.image || question.imageUrl || question.image_url || "";
}

export function normalizeOptions(question = {}) {
  if (Array.isArray(question.options) && question.options.length) return question.options;
  if (Array.isArray(question.choices) && question.choices.length) return question.choices;

  const right = String(getQuestionAnswer(question) || "").trim();
  if (["A", "B", "C", "D"].includes(right)) {
    return ["A. 选项A", "B. 选项B", "C. 选项C", "D. 选项D"];
  }
  if (!right) return [];

  const number = Number(right.replace(/[^\d.-]/g, ""));
  if (Number.isFinite(number)) {
    const values = [];
    for (const item of [number, number + 1, Math.max(0, number - 1), number + 2, number + 3, number + 4]) {
      const text = Number(item.toFixed(2)).toString();
      if (!values.includes(text)) values.push(text);
      if (values.length >= 4) break;
    }
    return values.map((item, index) => `${["A", "B", "C", "D"][index]}. ${item}`);
  }

  return [`A. ${right}`, "B. 以上都不对", "C. 无法确定", "D. 题目条件不足"];
}

export function isChoiceType(type = "") {
  return normalizeQuestionType(type) === "选择题";
}

export function isJudgeType(type = "") {
  return normalizeQuestionType(type) === "判断题";
}
