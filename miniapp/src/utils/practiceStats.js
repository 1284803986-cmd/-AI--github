import Taro from "@tarojs/taro";
import { getQuestionId, getQuestionStem, normalizeQuestionType } from "./question";
import { getWrongBook } from "./wrongBook";
import { debugLog } from "./debug";

const DAILY_KEY = "practiceDailyStats";
const LAST_KEY = "lastPracticeSession";
const PROGRESS_KEY = "chapterPracticeProgress";
const RECORDS_KEY = "practiceAnswerRecords";
const MAX_RECORDS = 500;

export function todayKey() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayStats() {
  const all = safeGetStorage(DAILY_KEY, {});
  const item = all[todayKey()] || { total: 0, correct: 0 };
  return {
    total: Number(item.total) || 0,
    correct: Number(item.correct) || 0,
    accuracy: item.total ? Math.round((item.correct / item.total) * 100) : 0
  };
}

export function getLastPracticeSession() {
  return safeGetStorage(LAST_KEY, null);
}

export function recordPracticeAnswer(meta, question, correct, progress = {}) {
  const normalizedType = normalizeQuestionType(meta.typeId || meta.type);
  const all = safeGetStorage(DAILY_KEY, {});
  const key = todayKey();
  const old = all[key] || { total: 0, correct: 0 };
  const next = {
    total: old.total + 1,
    correct: old.correct + (correct ? 1 : 0),
    updatedAt: Date.now()
  };
  all[key] = next;
  Taro.setStorageSync(DAILY_KEY, all);

  const record = {
    id: `answer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    packageId: meta.packageId,
    grade: meta.grade,
    subject: meta.subject,
    semester: meta.semester,
    textbook: meta.textbook,
    unitId: meta.unitId,
    unit: meta.unit,
    lesson: meta.lesson,
    knowledgePointId: meta.knowledgePointId,
    knowledgePoint: meta.knowledgePoint,
    typeId: normalizedType,
    type: normalizedType,
    difficulty: meta.difficulty,
    source: meta.source || "practice",
    done: progress.done || 0,
    total: progress.total || 0,
    questionId: getQuestionId(question),
    isCorrect: Boolean(correct),
    lastQuestion: getQuestionStem(question),
    updatedAt: Date.now()
  };
  Taro.setStorageSync(LAST_KEY, record);
  appendPracticeRecord(record);
  debugLog("[题型进度调试] answer record", {
    packageId: record.packageId,
    unitId: record.unitId,
    knowledgePointId: record.knowledgePointId,
    typeId: record.typeId,
    questionId: record.questionId,
    isCorrect: record.isCorrect
  });
}

export function readChapterProgress() {
  return safeGetStorage(PROGRESS_KEY, {});
}

export function getProgressCount(meta) {
  const key = [meta.grade, meta.subject, meta.semester, meta.unit, meta.type].filter(Boolean).join("|");
  return readChapterProgress()[key]?.done || 0;
}

export function getTypeProgress(meta = {}) {
  const normalizedType = normalizeQuestionType(meta.typeId || meta.type);
  debugLog("[题型进度调试] normalized type", {
    inputType: meta.type,
    inputTypeId: meta.typeId,
    normalizedType
  });

  const recordsDone = getPracticeRecords().filter((item) => {
    const source = String(item.source || "");
    if (source === "wrongBook" || source.includes("错题")) return false;
    if (meta.packageId && item.packageId !== meta.packageId) return false;
    if (meta.grade && item.grade !== meta.grade) return false;
    if (meta.subject && item.subject !== meta.subject) return false;
    if (meta.semester && item.semester !== meta.semester) return false;
    if (meta.unitId && item.unitId !== meta.unitId) return false;
    if (!meta.unitId && meta.unit && item.unit !== meta.unit) return false;
    return normalizeQuestionType(item.typeId || item.type) === normalizedType;
  }).length;

  const legacyKey = [meta.grade, meta.subject, meta.semester, meta.unit, normalizedType].filter(Boolean).join("|");
  const legacyDone = Number(readChapterProgress()[legacyKey]?.done) || 0;
  const done = Math.max(recordsDone, legacyDone);
  const result = { done, recordsDone, legacyDone, typeId: normalizedType };
  debugLog("[题型进度调试] type progress result", {
    packageId: meta.packageId,
    unitId: meta.unitId,
    unit: meta.unit,
    typeId: normalizedType,
    result
  });
  return result;
}

export function getPracticeRecords() {
  const saved = safeGetStorage(RECORDS_KEY, []);
  return Array.isArray(saved) ? saved.map(normalizeRecord).filter(Boolean) : [];
}

export function getLearningStats() {
  const records = getPracticeRecords();
  const wrongItems = getWrongBook();
  const today = getTodayStats();
  const recordTotal = records.length;
  const dailyFallback = readDailyTotals();
  const total = recordTotal || dailyFallback.total;
  const correct = recordTotal ? records.filter((item) => item.isCorrect).length : dailyFallback.correct;
  const wrong = Math.max(0, total - correct);
  const masteredWrong = wrongItems.filter((item) => item.mastered).length;
  const unmasteredWrong = Math.max(0, wrongItems.length - masteredWrong);
  const recent = records[0]?.updatedAt || getLastPracticeSession()?.updatedAt || 0;

  return {
    summary: {
      todayTotal: today.total,
      total,
      correct,
      wrong,
      accuracy: calcAccuracy(correct, total),
      wrongBookTotal: wrongItems.length,
      masteredWrong,
      unmasteredWrong,
      recentPracticeAt: recent
    },
    dimensions: {
      grade: aggregateDimension(records, wrongItems, "grade", "年级"),
      subject: aggregateDimension(records, wrongItems, "subject", "学科"),
      semester: aggregateDimension(records, wrongItems, "semester", "上下册"),
      unit: aggregateDimension(records, wrongItems, "unit", "章节"),
      knowledgePoint: aggregateDimension(records, wrongItems, "knowledgePointId", "知识点", (item) => item.knowledgePoint || item.knowledge_point),
      type: aggregateDimension(records, wrongItems, "typeId", "题型", (item) => item.type)
    },
    weakPoints: buildWeakPoints(records, wrongItems),
    recentRecords: records.slice(0, 12)
  };
}

function appendPracticeRecord(record) {
  const records = [record, ...getPracticeRecords()].slice(0, MAX_RECORDS);
  Taro.setStorageSync(RECORDS_KEY, records);
}

function readDailyTotals() {
  const all = safeGetStorage(DAILY_KEY, {});
  return Object.values(all).reduce((sum, item) => ({
    total: sum.total + (Number(item?.total) || 0),
    correct: sum.correct + (Number(item?.correct) || 0)
  }), { total: 0, correct: 0 });
}

function normalizeRecord(item) {
  if (!item || typeof item !== "object") return null;
  const normalizedType = normalizeQuestionType(item.typeId || item.type);
  return {
    ...item,
    grade: item.grade || "未记录",
    subject: item.subject || "未记录",
    semester: item.semester || "未记录",
    unitId: item.unitId || "",
    unit: item.unit || "未记录章节",
    knowledgePointId: item.knowledgePointId || "",
    knowledgePoint: item.knowledgePoint || item.knowledge_point || "未记录知识点",
    typeId: normalizedType || "未记录题型",
    type: normalizedType || "未记录题型",
    isCorrect: Boolean(item.isCorrect),
    source: item.source || "practice",
    updatedAt: Number(item.updatedAt) || 0
  };
}

function aggregateDimension(records, wrongItems, field, fallbackLabel, labelGetter) {
  const map = {};
  records.forEach((item) => {
    const key = item[field] || item[labelField(field)] || "未记录";
    const label = labelGetter?.(item) || item[labelField(field)] || key || fallbackLabel;
    if (!map[key]) map[key] = createStatRow(key, label);
    map[key].total += 1;
    map[key].correct += item.isCorrect ? 1 : 0;
    map[key].wrong += item.isCorrect ? 0 : 1;
  });

  wrongItems.forEach((item) => {
    const key = item[field] || item[labelField(field)] || "未记录";
    const label = labelGetter?.(item) || item[labelField(field)] || key || fallbackLabel;
    if (!map[key]) map[key] = createStatRow(key, label);
    map[key].wrongBook += 1;
    map[key].mastered += item.mastered ? 1 : 0;
    map[key].unmastered += item.mastered ? 0 : 1;
  });

  return Object.values(map)
    .map((item) => ({ ...item, accuracy: calcAccuracy(item.correct, item.total) }))
    .sort((a, b) => b.total - a.total || b.wrongBook - a.wrongBook);
}

function buildWeakPoints(records, wrongItems) {
  const map = {};
  wrongItems.forEach((item) => {
    const key = [item.unitId || item.unit, item.knowledgePointId || item.knowledge_point, item.typeId || item.type].filter(Boolean).join("|") || item.id;
    if (!map[key]) {
      map[key] = {
        key,
        unit: item.unit || "未记录章节",
        knowledgePoint: item.knowledge_point || "未记录知识点",
        type: item.type || item.question_type || "未记录题型",
        wrongCount: 0,
        wrongBook: 0,
        mastered: 0,
        unmastered: 0,
        total: 0,
        correct: 0,
        wrong: 0,
        accuracy: 0
      };
    }
    map[key].wrongCount += Number(item.wrongCount || item.errorCount || 1);
    map[key].wrongBook += 1;
    map[key].mastered += item.mastered ? 1 : 0;
    map[key].unmastered += item.mastered ? 0 : 1;
  });

  records.forEach((item) => {
    const key = [item.unitId || item.unit, item.knowledgePointId || item.knowledgePoint, item.typeId || item.type].filter(Boolean).join("|");
    if (!key || !map[key]) return;
    map[key].total += 1;
    map[key].correct += item.isCorrect ? 1 : 0;
    map[key].wrong += item.isCorrect ? 0 : 1;
  });

  return Object.values(map)
    .map((item) => ({ ...item, accuracy: calcAccuracy(item.correct, item.total) }))
    .sort((a, b) =>
      b.unmastered - a.unmastered ||
      b.wrongCount - a.wrongCount ||
      a.accuracy - b.accuracy
    )
    .slice(0, 10);
}

function labelField(field) {
  const map = {
    knowledgePointId: "knowledgePoint",
    typeId: "type"
  };
  return map[field] || field;
}

function createStatRow(key, label) {
  return {
    key,
    label,
    total: 0,
    correct: 0,
    wrong: 0,
    accuracy: 0,
    wrongBook: 0,
    mastered: 0,
    unmastered: 0
  };
}

function calcAccuracy(correct, total) {
  return total ? Math.round((correct / total) * 100) : 0;
}

function safeGetStorage(key, fallback) {
  try {
    const value = Taro.getStorageSync(key);
    return value === undefined || value === null || value === "" ? fallback : value;
  } catch {
    return fallback;
  }
}
