import Taro from "@tarojs/taro";

const WRONG_BOOK_KEY = "wrongBookItems";

export function normalizeAnswer(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[，。；：]/g, "")
    .toLowerCase();
}

export function isAnswerCorrect(userAnswer, rightAnswer) {
  const user = normalizeAnswer(userAnswer);
  const right = normalizeAnswer(rightAnswer);
  if (!user || !right) return false;
  return user === right;
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
  const nextItem = {
    id: key,
    question: question.question,
    answer: question.answer || "",
    explanation: question.explanation || "",
    knowledge_point: question.knowledge_point || "",
    difficulty: question.difficulty || "",
    question_type: question.question_type || question.type || "",
    type: question.type || question.question_type || "",
    common_mistake: question.common_mistake || "",
    parent_tip: question.parent_tip || "",
    userAnswer,
    source,
    updatedAt: new Date().toISOString()
  };

  const oldIndex = items.findIndex((item) => item.id === key);
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
  if (isAnswerCorrect(userAnswer, question?.answer)) {
    return { correct: true, items: removeWrongQuestion(question) };
  }
  return { correct: false, items: upsertWrongQuestion(question, userAnswer, source) };
}

export function buildQuestionKey(question) {
  return normalizeAnswer(question?.question || "");
}
