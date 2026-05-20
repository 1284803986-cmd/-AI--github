import Taro from "@tarojs/taro";

const WRONG_BOOK_KEY = "wrongBookItems";

export function normalizeAnswer(value) {
  return String(value ?? "")
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .trim()
    .replace(/\s+/g, "")
    .replace(/[，,、。；;：:]/g, "")
    .replace(/还剩|余/g, "剩")
    .toLowerCase();
}

export function isAnswerCorrect(userAnswer, rightAnswer) {
  return evaluateAnswer(userAnswer, rightAnswer).status !== "wrong";
}

export function evaluateAnswer(userAnswer, rightAnswer, question = {}) {
  const user = normalizeAnswer(userAnswer);
  const right = normalizeAnswer(rightAnswer);
  if (!user || !right) return { status: "wrong", correct: false, formatWarning: false };
  if (user === right) return { status: "correct", correct: true, formatWarning: false };

  const userNumbers = extractNumbers(userAnswer);
  const rightNumbers = extractNumbers(rightAnswer);
  const sameNumbers = numbersEqual(userNumbers, rightNumbers);
  if (!sameNumbers) return { status: "wrong", correct: false, formatWarning: false };

  if (isObjectiveChoiceAnswer(rightAnswer)) {
    return { status: "wrong", correct: false, formatWarning: false };
  }

  const text = `${question?.question || ""}${question?.knowledge_point || ""}${question?.type || ""}${question?.question_type || ""}${rightAnswer}`;
  if (isRemainderAnswer(text) || isMathExpressionAnswer(text) || rightNumbers.length > 0) {
    return {
      status: "format_warning",
      correct: true,
      formatWarning: true,
      message: "结果是对的，注意把单位写完整。"
    };
  }

  return { status: "wrong", correct: false, formatWarning: false };
}

export function getWrongBook() {
  const saved = Taro.getStorageSync(WRONG_BOOK_KEY);
  return Array.isArray(saved) ? saved : [];
}

export function setWrongBook(items) {
  Taro.setStorageSync(WRONG_BOOK_KEY, items);
}

export function upsertWrongQuestion(question, userAnswer = "", source = "练习") {
  if (!question?.question) return getWrongBook();

  const items = getWrongBook();
  const key = buildQuestionKey(question);
  const oldIndex = items.findIndex((item) => item.id === key);
  const oldItem = oldIndex >= 0 ? items[oldIndex] : null;
  const nextItem = {
    id: key,
    question: question.question,
    answer: question.answer || "",
    explanation: question.explanation || "",
    unit: question.unit || "",
    lesson: question.lesson || "",
    knowledge_point: question.knowledge_point || "",
    difficulty: question.difficulty || "",
    question_type: question.question_type || question.type || "",
    type: question.type || question.question_type || "",
    common_mistake: question.common_mistake || "",
    parent_tip: question.parent_tip || "",
    errorCount: (oldItem?.errorCount || 0) + 1,
    mastered: false,
    userAnswer,
    source,
    updatedAt: new Date().toISOString()
  };

  if (oldIndex >= 0) {
    const next = [...items];
    next[oldIndex] = { ...items[oldIndex], ...nextItem };
    setWrongBook(next);
    return next;
  }

  const next = [nextItem, ...items];
  setWrongBook(next);
  return next;
}

export function removeWrongQuestion(question) {
  const key = typeof question === "string" ? question : buildQuestionKey(question);
  const next = getWrongBook().filter((item) => item.id !== key);
  setWrongBook(next);
  return next;
}

export function hasWrongQuestion(question) {
  const key = typeof question === "string" ? question : buildQuestionKey(question);
  return getWrongBook().some((item) => item.id === key);
}

export function updateWrongBookByAnswer(question, userAnswer, source = "练习") {
  const result = evaluateAnswer(userAnswer, question?.answer, question);
  if (result.correct) {
    return { correct: true, items: removeWrongQuestion(question) };
  }
  return { correct: false, items: upsertWrongQuestion(question, userAnswer, source) };
}

export function buildQuestionKey(question) {
  return normalizeAnswer(question?.question || "");
}

function extractNumbers(value) {
  return String(value ?? "")
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .match(/\d+(?:\.\d+)?/g)?.map((item) => Number(item)) || [];
}

function numbersEqual(left, right) {
  if (!left.length || left.length !== right.length) return false;
  return left.every((value, index) => Math.abs(value - right[index]) < 0.000001);
}

function isObjectiveChoiceAnswer(value) {
  return /^[A-D]$/i.test(String(value ?? "").trim());
}

function isRemainderAnswer(text) {
  return /有余数的除法|余数|还剩|剩几个|可以装几袋|分几组还剩几个|剩/.test(text);
}

function isMathExpressionAnswer(text) {
  return /应用题|计算题|[+\-×÷]/.test(text);
}
