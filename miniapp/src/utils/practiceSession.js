import Taro from "@tarojs/taro";
import { normalizeQuestionType } from "./question";

const SESSIONS_KEY = "practice_sessions";
const LATEST_KEY = "latest_practice_session_id";
const SESSION_CONTENT_VERSION = 4;

export function getPracticeSessions() {
  try {
    const saved = Taro.getStorageSync(SESSIONS_KEY);
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

export function getPracticeSession(sessionId) {
  if (!sessionId) return null;
  const session = getPracticeSessions()[sessionId] || null;
  if (session && !isCurrentContentSession(session)) {
    removePracticeSession(sessionId);
    return null;
  }
  return session;
}

export function removePracticeSession(sessionId) {
  if (!sessionId) return;
  const sessions = getPracticeSessions();
  delete sessions[sessionId];
  Taro.setStorageSync(SESSIONS_KEY, sessions);
  if (Taro.getStorageSync(LATEST_KEY) === sessionId) {
    Taro.removeStorageSync(LATEST_KEY);
  }
}

export function getLatestDoingPracticeSession() {
  const sessions = Object.values(getPracticeSessions()).filter((item) => item?.status === "doing" && isCurrentContentSession(item));
  return sessions.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] || null;
}

export function findDoingPracticeSession(meta) {
  const normalizedType = normalizeQuestionType(meta.typeId || meta.type);
  return Object.values(getPracticeSessions()).find((item) =>
    item?.status === "doing" &&
    isCurrentContentSession(item) &&
    item.grade === meta.grade &&
    item.subject === meta.subject &&
    item.semester === meta.semester &&
    item.chapterName === meta.unit &&
    normalizeQuestionType(item.typeId || item.questionType) === normalizedType
  ) || null;
}

export function hasSessionProgress(session) {
  if (!session) return false;
  const submitted = session.submittedMap || {};
  const correct = session.correctMap || {};
  const wrong = session.wrongMap || {};
  const answers = Array.isArray(session.answers) ? session.answers : [];
  return (
    Object.keys(submitted).length > 0 ||
    Object.keys(correct).length > 0 ||
    Object.keys(wrong).length > 0 ||
    answers.some((answer) => String(answer ?? "").trim().length > 0) ||
    Number(session.currentIndex || 0) > 0
  );
}

export function createPracticeSession(meta, questions) {
  const normalizedType = normalizeQuestionType(meta.typeId || meta.type);
  const safeQuestions = (Array.isArray(questions) ? questions : []).map((question) => ({
    ...question,
    packageId: question.packageId || meta.packageId,
    grade: question.grade || meta.grade,
    subject: question.subject || meta.subject,
    semester: question.semester || meta.semester,
    textbook: question.textbook || meta.textbook,
    unitId: question.unitId || meta.unitId || meta.unit,
    unit: question.unit || meta.unit,
    lesson: question.lesson || meta.lesson,
    knowledgePointId: question.knowledgePointId || meta.knowledgePointId,
    knowledge_point: question.knowledge_point || meta.knowledgePoint,
    typeId: normalizeQuestionType(question.typeId || question.type || question.question_type || normalizedType),
    question_type: normalizeQuestionType(question.question_type || question.type || normalizedType),
    type: normalizeQuestionType(question.type || question.question_type || normalizedType),
    difficulty: question.difficulty || meta.difficulty
  }));
  const now = Date.now();
  const session = {
    sessionId: `practice_${now}_${Math.random().toString(36).slice(2, 8)}`,
    packageId: meta.packageId,
    grade: meta.grade,
    term: meta.semester,
    semester: meta.semester,
    subject: meta.subject,
    textbook: meta.textbook,
    chapterId: meta.unitId || meta.unit,
    unitId: meta.unitId || meta.unit,
    chapterName: meta.unit,
    lesson: meta.lesson,
    knowledgePointId: meta.knowledgePointId,
    knowledgePoint: meta.knowledgePoint,
    typeId: normalizedType,
    questionType: normalizedType,
    difficulty: meta.difficulty,
    totalCount: safeQuestions.length,
    questions: safeQuestions,
    currentIndex: 0,
    contentVersion: SESSION_CONTENT_VERSION,
    answers: safeQuestions.map(() => ""),
    checks: safeQuestions.map(() => undefined),
    submittedMap: {},
    correctMap: {},
    wrongMap: {},
    createdAt: now,
    updatedAt: now,
    status: "doing"
  };
  savePracticeSession(session);
  return session;
}

function isCurrentContentSession(session) {
  return Number(session?.contentVersion || 0) >= SESSION_CONTENT_VERSION;
}

export function savePracticeSession(session) {
  if (!session?.sessionId) return null;
  const sessions = getPracticeSessions();
  const next = { ...session, updatedAt: Date.now() };
  sessions[next.sessionId] = next;
  Taro.setStorageSync(SESSIONS_KEY, sessions);
  Taro.setStorageSync(LATEST_KEY, next.sessionId);
  return next;
}

export function updatePracticeSession(sessionId, patch) {
  const old = getPracticeSession(sessionId);
  if (!old) return null;
  return savePracticeSession({ ...old, ...patch });
}

export function buildSessionPatch({ currentIndex, answers, checks }) {
  const submittedMap = {};
  const correctMap = {};
  const wrongMap = {};
  const safeChecks = Array.isArray(checks) ? checks : [];
  safeChecks.forEach((check, index) => {
    if (!check?.recorded) return;
    submittedMap[index] = true;
    if (check.correct) correctMap[index] = true;
    if (!check.correct) wrongMap[index] = true;
  });
  return { currentIndex, answers: Array.isArray(answers) ? answers : [], checks: safeChecks, submittedMap, correctMap, wrongMap };
}

export function getSessionProgress(session) {
  const submitted = session?.submittedMap || {};
  const done = Object.keys(submitted).length;
  return { done, total: session?.totalCount || session?.questions?.length || 0 };
}
