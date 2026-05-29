import Taro from "@tarojs/taro";
import { createPracticeSession } from "./practiceSession";
import { getQuestionAnswer, getQuestionExplanation, getQuestionId, getQuestionStem, getQuestionType, normalizeOptions, normalizeQuestionType } from "./question";

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
  if (question?.source_mode === "extracted" && !right) {
    return { status: user ? "completed" : "wrong", correct: Boolean(user), formatWarning: true };
  }
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

export function getWrongBookFilterOptions(items = getWrongBook(), filters = {}) {
  const filtered = getUniqueWrongBookItems(filterWrongBookItems(items, filters, ["type", "knowledgePoint"]));
  return {
    grades: uniqueOptions(filtered, (item) => item.grade),
    subjects: uniqueOptions(filtered, (item) => item.subject),
    semesters: uniqueOptions(filtered, (item) => item.semester),
    units: uniqueOptions(filtered, (item) => item.unit),
    types: uniqueOptions(filtered, (item) => item.type),
    knowledgePoints: uniqueOptions(filtered, (item) => item.knowledge_point || item.knowledgePoint)
  };
}

export function getWrongBookChapterSummary(filters = {}) {
  const groups = {};
  getUniqueWrongBookItems(filterWrongBookItems(getWrongBook(), filters, ["unit", "type", "knowledgePoint"])).forEach((item) => {
    const key = buildChapterKey(item);
    if (!groups[key]) {
      groups[key] = {
        key,
        unitId: item.unitId || "",
        packageId: item.packageId || "",
        grade: item.grade || "",
        subject: item.subject || "",
        semester: item.semester || "",
        textbook: item.textbook || "",
        unit: item.unit || "未记录章节",
        total: 0,
        mastered: 0,
        unmastered: 0,
        wrongCount: 0,
        lastWrongAt: "",
        typeMap: {}
      };
    }
    groups[key].total += 1;
    groups[key].mastered += item.mastered ? 1 : 0;
    groups[key].unmastered += item.mastered ? 0 : 1;
    groups[key].wrongCount += Number(item.wrongCount) || 0;
    if (!groups[key].lastWrongAt || new Date(item.lastWrongAt).getTime() > new Date(groups[key].lastWrongAt).getTime()) {
      groups[key].lastWrongAt = item.lastWrongAt || "";
    }
    const type = normalizeQuestionType(item.typeId || item.type) || "未记录题型";
    groups[key].typeMap[type] = (groups[key].typeMap[type] || 0) + 1;
  });

  return Object.values(groups)
    .map((item) => ({
      ...item,
      progress: item.total ? Math.round((item.mastered / item.total) * 100) : 0,
      weakTypes: Object.entries(item.typeMap)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
    }))
    .sort((a, b) => b.unmastered - a.unmastered || b.wrongCount - a.wrongCount);
}

export function getWrongBookItemsByChapter(chapterKey, filters = {}) {
  return getUniqueWrongBookItems(filterWrongBookItems(getWrongBook(), filters).filter((item) => buildChapterKey(item) === chapterKey));
}

export function createWrongBookPracticeSession(items = [], chapter = {}) {
  const safeItems = getUniqueWrongBookItems(Array.isArray(items) ? items : []);
  if (!safeItems.length) return null;
  const first = safeItems[0];
  const questions = safeItems.map(toPracticeQuestion);
  return createPracticeSession({
    packageId: first.packageId || chapter.packageId || "",
    grade: first.grade || chapter.grade || "二年级",
    subject: first.subject || chapter.subject || "数学",
    semester: first.semester || chapter.semester || "下册",
    textbook: first.textbook || chapter.textbook || "人教版",
    unitId: first.unitId || chapter.unitId || "",
    unit: first.unit || chapter.unit || "错题重练",
    lesson: first.lesson || "",
    knowledgePointId: first.knowledgePointId || "",
    knowledgePoint: first.knowledge_point || first.knowledgePoint || "",
    typeId: first.typeId || first.type || "错题",
    type: first.type || first.question_type || "错题",
    difficulty: first.difficulty || "基础"
  }, questions);
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
    question_type: normalizeQuestionType(getQuestionType(question)),
    type: normalizeQuestionType(getQuestionType(question)),
    typeId: normalizeQuestionType(question.typeId || getQuestionType(question)),
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
  const typeKey = normalizeQuestionType(getQuestionType(question, "unknown-type"));
  const answerKey = normalizeAnswer(getQuestionAnswer(question));
  return [packageId, unitId, knowledgePointId, typeKey, stemKey, answerKey].join("|");
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
  const type = normalizeQuestionType(item.typeId || item.type || item.question_type);
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
    question_type: type,
    type,
    typeId: type,
    common_mistake: item.common_mistake,
    parent_tip: item.parent_tip
  };
}

function normalizeWrongItem(item) {
  const wrongCount = item.wrongCount || item.errorCount || 0;
  const type = normalizeQuestionType(item.typeId || item.type || item.question_type);
  return {
    ...item,
    questionId: item.questionId || item.id,
    question: item.question || item.stem || item.title || "",
    options: Array.isArray(item.options) ? item.options : [],
    correctAnswer: item.correctAnswer || item.answer || "",
    answer: item.answer || item.correctAnswer || "",
    explanation: item.explanation || item.analysis || "",
    question_type: type,
    type,
    typeId: type,
    wrongCount,
    errorCount: wrongCount,
    lastWrongAt: item.lastWrongAt || item.updatedAt || item.createdAt || "",
    mastered: Boolean(item.mastered)
  };
}

function uniqueOptions(items, getter) {
  return [...new Set(items.map(getter).filter(Boolean))];
}

function getUniqueWrongBookItems(items = []) {
  const map = new Map();
  items.filter(Boolean)
    .sort(compareWrongBookItems)
    .forEach((item) => {
      const key = buildQuestionKey(item);
      if (!map.has(key)) {
        map.set(key, item);
      } else {
        map.set(key, mergeWrongBookDuplicate(map.get(key), item));
      }
    });
  return [...map.values()];
}

function mergeWrongBookDuplicate(left, right) {
  const newest = compareTime(right, left) >= 0 ? right : left;
  const older = newest === right ? left : right;
  const wrongCount = (Number(left?.wrongCount || left?.errorCount) || 0) + (Number(right?.wrongCount || right?.errorCount) || 0);
  return {
    ...older,
    ...newest,
    wrongCount,
    errorCount: wrongCount,
    mastered: Boolean(newest.mastered),
    lastWrongAt: latestTimeValue(left?.lastWrongAt, right?.lastWrongAt) || newest.lastWrongAt || older.lastWrongAt || "",
    updatedAt: latestTimeValue(left?.updatedAt, right?.updatedAt) || newest.updatedAt || older.updatedAt || "",
    userAnswer: newest.userAnswer || older.userAnswer
  };
}

function compareWrongBookItems(a, b) {
  if (Boolean(a.mastered) !== Boolean(b.mastered)) return a.mastered ? 1 : -1;
  const wrongDiff = (Number(b.wrongCount) || 0) - (Number(a.wrongCount) || 0);
  if (wrongDiff) return wrongDiff;
  const bTime = new Date(b.lastWrongAt || b.updatedAt || b.createdAt || 0).getTime() || 0;
  const aTime = new Date(a.lastWrongAt || a.updatedAt || a.createdAt || 0).getTime() || 0;
  return bTime - aTime;
}

function compareTime(a, b) {
  const left = new Date(a?.updatedAt || a?.lastPracticedAt || a?.lastWrongAt || a?.createdAt || 0).getTime() || 0;
  const right = new Date(b?.updatedAt || b?.lastPracticedAt || b?.lastWrongAt || b?.createdAt || 0).getTime() || 0;
  return left - right;
}

function latestTimeValue(left, right) {
  const leftTime = new Date(left || 0).getTime() || 0;
  const rightTime = new Date(right || 0).getTime() || 0;
  return leftTime >= rightTime ? left : right;
}

function buildChapterKey(item = {}) {
  return [
    item.packageId || "unknown-package",
    item.grade || "unknown-grade",
    item.subject || "unknown-subject",
    item.semester || "unknown-semester",
    item.unitId || item.unit || "unknown-unit"
  ].join("|");
}

function filterWrongBookItems(items = [], filters = {}, ignoreKeys = []) {
  const ignore = new Set(ignoreKeys);
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (!ignore.has("grade") && filters.grade && filters.grade !== "全部" && item.grade !== filters.grade) return false;
    if (!ignore.has("subject") && filters.subject && filters.subject !== "全部" && item.subject !== filters.subject) return false;
    if (!ignore.has("semester") && filters.semester && filters.semester !== "全部" && item.semester !== filters.semester) return false;
    if (!ignore.has("unit") && filters.unit && filters.unit !== "全部" && item.unit !== filters.unit && item.unitId !== filters.unit && buildChapterKey(item) !== filters.unit) return false;
    if (!ignore.has("type") && filters.type && filters.type !== "全部" && normalizeQuestionType(item.typeId || item.type) !== normalizeQuestionType(filters.type)) return false;
    if (!ignore.has("knowledgePoint") && filters.knowledgePoint && filters.knowledgePoint !== "全部") {
      const point = item.knowledge_point || item.knowledgePoint || item.knowledgePointId;
      if (point !== filters.knowledgePoint && item.knowledgePointId !== filters.knowledgePoint) return false;
    }
    if (filters.mastered === "已掌握" && !item.mastered) return false;
    if (filters.mastered === "未掌握" && item.mastered) return false;
    return true;
  });
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
