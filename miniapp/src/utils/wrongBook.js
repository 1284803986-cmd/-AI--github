import Taro from "@tarojs/taro";
import { getQuestionAnswer, getQuestionExplanation, getQuestionId, getQuestionStem, getQuestionType, normalizeOptions } from "./question";

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
  return Array.isArray(saved) ? saved.map(normalizeWrongItem) : [];
}

export function setWrongBook(items) {
  Taro.setStorageSync(WRONG_BOOK_KEY, items);
}

export function upsertWrongQuestion(question, userAnswer = "", source = "练习") {
  if (!getQuestionStem(question)) return getWrongBook();

  const items = getWrongBook();
  const key = buildQuestionKey(question);
  const oldIndex = items.findIndex((item) => item.id === key);
  const oldItem = oldIndex >= 0 ? items[oldIndex] : null;
  const now = new Date().toISOString();
  const nextItem = {
    id: key,
    questionId: getQuestionId(question, key),
    packageId: question.packageId || "",
    grade: question.grade || "",
    subject: question.subject || "",
    semester: question.semester || question.term || "",
    textbook: question.textbook || "",
    unitId: question.unitId || question.chapterId || "",
    unit: question.unit || question.chapterName || "",
    lesson: question.lesson || "",
    knowledgePointId: question.knowledgePointId || "",
    knowledge_point: question.knowledge_point || question.knowledgePoint || "",
    question: getQuestionStem(question),
    options: normalizeOptions(question),
    answer: getQuestionAnswer(question),
    correctAnswer: getQuestionAnswer(question),
    explanation: getQuestionExplanation(question),
    difficulty: question.difficulty || "",
    question_type: getQuestionType(question),
    type: getQuestionType(question),
    typeId: question.typeId || getQuestionType(question),
    common_mistake: question.common_mistake || "",
    parent_tip: question.parent_tip || "",
    wrongCount: (oldItem?.wrongCount || oldItem?.errorCount || 0) + 1,
    errorCount: (oldItem?.wrongCount || oldItem?.errorCount || 0) + 1,
    lastWrongAt: now,
    lastPracticedAt: now,
    lastResult: "wrong",
    mastered: false,
    userAnswer,
    source,
    updatedAt: now,
    createdAt: oldItem?.createdAt || now
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
  return getWrongBook().some((item) => item.id === key && !item.mastered);
}

export function updateWrongBookByAnswer(question, userAnswer, source = "练习") {
  const result = evaluateAnswer(userAnswer, getQuestionAnswer(question), question);
  if (result.correct) {
    return { correct: true, items: markWrongQuestionPracticed(question, userAnswer, true), mastered: hasWrongQuestionRecord(question) };
  }
  return { correct: false, items: upsertWrongQuestion(question, userAnswer, source) };
}

export function buildQuestionKey(question) {
  const packageId = question?.packageId || "unknown-package";
  const unitId = question?.unitId || question?.chapterId || "unknown-unit";
  const knowledgePointId = question?.knowledgePointId || "unknown-point";
  const questionId = getQuestionId(question);
  if (questionId) {
    return [packageId, unitId, knowledgePointId, questionId].join("|");
  }
  const stemKey = normalizeAnswer(getQuestionStem(question));
  const typeKey = getQuestionType(question, "unknown-type");
  return [packageId, unitId, knowledgePointId, typeKey, stemKey].join("|");
}

export function markWrongQuestionPracticed(question, userAnswer = "", correct = true) {
  const key = typeof question === "string" ? question : buildQuestionKey(question);
  const now = new Date().toISOString();
  const next = getWrongBook().map((item) => {
    if (item.id !== key) return item;
    return {
      ...item,
      userAnswer: userAnswer || item.userAnswer,
      lastPracticedAt: now,
      lastResult: correct ? "correct" : "wrong",
      mastered: correct ? true : item.mastered,
      updatedAt: now
    };
  });
  setWrongBook(next);
  return next;
}

export function markWrongQuestionMastered(question, mastered = true) {
  const key = typeof question === "string" ? question : buildQuestionKey(question);
  const now = new Date().toISOString();
  const next = getWrongBook().map((item) => item.id === key ? { ...item, mastered, updatedAt: now } : item);
  setWrongBook(next);
  return next;
}

export function hasWrongQuestionRecord(question) {
  const key = typeof question === "string" ? question : buildQuestionKey(question);
  return getWrongBook().some((item) => item.id === key);
}

export function toPracticeQuestion(item) {
  return {
    id: item.questionId || item.id,
    questionId: item.questionId || item.id,
    packageId: item.packageId,
    grade: item.grade,
    subject: item.subject,
    semester: item.semester,
    textbook: item.textbook,
    unitId: item.unitId,
    unit: item.unit,
    lesson: item.lesson,
    knowledgePointId: item.knowledgePointId,
    knowledge_point: item.knowledge_point,
    question: item.question,
    options: item.options || [],
    answer: item.correctAnswer || item.answer,
    correctAnswer: item.correctAnswer || item.answer,
    explanation: item.explanation,
    difficulty: item.difficulty,
    question_type: item.question_type || item.type,
    type: item.type || item.question_type,
    typeId: item.typeId || item.type || item.question_type,
    common_mistake: item.common_mistake,
    parent_tip: item.parent_tip
  };
}

function normalizeWrongItem(item) {
  const wrongCount = item.wrongCount || item.errorCount || 0;
  return {
    ...item,
    questionId: item.questionId || item.id,
    question: item.question || item.stem || item.title || "",
    options: Array.isArray(item.options) ? item.options : [],
    correctAnswer: item.correctAnswer || item.answer || "",
    answer: item.answer || item.correctAnswer || "",
    explanation: item.explanation || item.analysis || "",
    question_type: item.question_type || item.type || item.typeId || "",
    type: item.type || item.question_type || item.typeId || "",
    typeId: item.typeId || item.type || item.question_type || "",
    wrongCount,
    errorCount: wrongCount,
    lastWrongAt: item.lastWrongAt || item.updatedAt || item.createdAt || "",
    mastered: Boolean(item.mastered)
  };
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
