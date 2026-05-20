import Taro from "@tarojs/taro";

const DAILY_KEY = "practiceDailyStats";
const LAST_KEY = "lastPracticeSession";
const PROGRESS_KEY = "chapterPracticeProgress";

export function todayKey() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayStats() {
  const all = Taro.getStorageSync(DAILY_KEY) || {};
  const item = all[todayKey()] || { total: 0, correct: 0 };
  return {
    total: Number(item.total) || 0,
    correct: Number(item.correct) || 0,
    accuracy: item.total ? Math.round((item.correct / item.total) * 100) : 0
  };
}

export function getLastPracticeSession() {
  return Taro.getStorageSync(LAST_KEY) || null;
}

export function recordPracticeAnswer(meta, question, correct, progress = {}) {
  const all = Taro.getStorageSync(DAILY_KEY) || {};
  const key = todayKey();
  const old = all[key] || { total: 0, correct: 0 };
  const next = {
    total: old.total + 1,
    correct: old.correct + (correct ? 1 : 0),
    updatedAt: Date.now()
  };
  all[key] = next;
  Taro.setStorageSync(DAILY_KEY, all);

  Taro.setStorageSync(LAST_KEY, {
    grade: meta.grade,
    subject: meta.subject,
    semester: meta.semester,
    textbook: meta.textbook,
    unit: meta.unit,
    lesson: meta.lesson,
    knowledgePoint: meta.knowledgePoint,
    type: meta.type,
    difficulty: meta.difficulty,
    done: progress.done || 0,
    total: progress.total || 0,
    lastQuestion: question?.question || "",
    updatedAt: Date.now()
  });
}

export function readChapterProgress() {
  return Taro.getStorageSync(PROGRESS_KEY) || {};
}

export function getProgressCount(meta) {
  const key = [meta.grade, meta.subject, meta.semester, meta.unit, meta.type].filter(Boolean).join("|");
  return readChapterProgress()[key]?.done || 0;
}
