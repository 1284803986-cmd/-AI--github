import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bankPath = join(__dirname, "..", "..", "content", "extracted_question_bank.json");
const MIN_VISIBLE_POINT_QUESTIONS = 3;
const MIN_VISIBLE_TYPE_QUESTIONS = 5;

let cache;

export async function loadExtractedBank() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(bankPath, "utf-8"));
  } catch {
    cache = { questions: [], stats: {} };
  }
  return cache;
}

export async function getExtractedQuestions(input, contentPackage, knowledgePoint) {
  const bank = await loadExtractedBank();
  const count = Math.max(1, Math.min(50, Number(input.count) || 10));
  const type = String(input.type || "").trim();
  const typedBase = (bank.questions || []).filter((item) => baseMatch(item, input, type));
  const bookBase = (bank.questions || []).filter((item) => baseMatch(item, input, ""));
  const base = typedBase.length ? typedBase : bookBase;
  const exact = knowledgePoint ? base.filter((item) => item.knowledge_point_id === knowledgePoint.id || item.knowledge_point === knowledgePoint.name) : [];
  const unit = base.filter((item) => input.unit && item.unit === input.unit);
  const fallbackUnit = bookBase.filter((item) => input.unit && item.unit === input.unit);
  const pool = mergePools(exact, unit, fallbackUnit);
  const scored = pool
    .map((item) => ({ item, score: scoreQuestion(item, input, contentPackage, knowledgePoint, type) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || stableOrder(a.item.id, input) - stableOrder(b.item.id, input));

  const picked = uniqueByStem(scored.map((row) => row.item)).slice(0, count);
  return {
    title: `${input.grade}${input.subject}${input.knowledgePoint}摘录练习`,
    grade: input.grade,
    semester: input.semester,
    subject: input.subject,
    textbook: input.textbook,
    unit: input.unit,
    source: "extracted_question_bank",
    questions: picked.map((item, index) => normalizeExtractedQuestion(item, index + 1, input, contentPackage, knowledgePoint))
  };
}

export async function getExtractedPaper(input, contentPackage) {
  const bank = await loadExtractedBank();
  const count = Math.max(1, Math.min(100, Number(input.count) || 20));
  const scored = (bank.questions || [])
    .filter((item) => item.grade === input.grade && item.subject === input.subject)
    .filter((item) => !input.semester || item.semester === input.semester)
    .map((item) => ({ item, score: scoreQuestion(item, input, contentPackage, null, "") }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || stableOrder(a.item.id, input) - stableOrder(b.item.id, input));
  const picked = uniqueByStem(scored.map((row) => row.item)).slice(0, count);
  const score = Math.max(1, Math.floor(Number(input.totalScore || count) / Math.max(1, picked.length || count)));
  return {
    title: `${input.grade}${input.subject}${input.unitRange || input.unit || ""}摘录试卷`,
    grade: input.grade,
    subject: input.subject,
    textbook: input.textbook,
    unit: input.unitRange || input.unit,
    total_score: Number(input.totalScore || score * picked.length),
    source: "extracted_question_bank",
    questions: picked.map((item, index) => ({ ...normalizeExtractedQuestion(item, index + 1, input, contentPackage, null), score }))
  };
}

export async function getExtractedTypeMap() {
  const bank = await loadExtractedBank();
  const map = new Map();
  const pointCounts = new Map();
  const typeCounts = new Map();
  for (const item of bank.questions || []) {
    if (!item.package_id || !item.knowledge_point_id || !item.question_type) continue;
    const key = `${item.package_id}::${item.knowledge_point_id}`;
    const typeKey = `${key}::${item.question_type}`;
    pointCounts.set(key, (pointCounts.get(key) || 0) + 1);
    typeCounts.set(typeKey, (typeCounts.get(typeKey) || 0) + 1);
  }
  for (const [typeKey, count] of typeCounts) {
    if (count < MIN_VISIBLE_TYPE_QUESTIONS) continue;
    const parts = typeKey.split("::");
    const key = parts.slice(0, 2).join("::");
    if ((pointCounts.get(key) || 0) < MIN_VISIBLE_POINT_QUESTIONS) continue;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(parts.slice(2).join("::"));
  }
  return map;
}

function baseMatch(item, input, type) {
  if (item.grade !== input.grade) return false;
  if (item.semester !== input.semester) return false;
  if (item.subject !== input.subject) return false;
  if (type && item.question_type !== type) return false;
  return true;
}

function scoreQuestion(item, input, contentPackage, knowledgePoint, type) {
  let score = 1;
  if (item.package_id && item.package_id === contentPackage?.package_id) score += 20;
  if (knowledgePoint && item.knowledge_point_id === knowledgePoint.id) score += 60;
  if (knowledgePoint && item.knowledge_point === knowledgePoint.name) score += 30;
  if (input.unit && item.unit === input.unit) score += 20;
  if (input.knowledgePoint && (item.knowledge_point === input.knowledgePoint || String(item.question || "").includes(input.knowledgePoint))) score += 20;
  if (type && item.question_type === type) score += 30;
  if (String(item.question || "").length < 12) score -= 3;
  if (String(item.question || "").length > 180) score -= 2;
  return score;
}

function normalizeExtractedQuestion(item, id, input, contentPackage, knowledgePoint) {
  return {
    ...item,
    id,
    question_id: item.id,
    question: normalizeQuestionText(item.question),
    answer: item.answer || "",
    explanation: item.explanation || "摘录自本地教材资料。",
    knowledge_point: item.knowledge_point || knowledgePoint?.name || input.knowledgePoint,
    difficulty: item.difficulty || input.difficulty || "基础",
    question_type: item.question_type || input.type,
    type: item.type || item.question_type || input.type,
    common_mistake: "摘录题请结合原资料答案核对。",
    parent_tip: "这是资料原题摘录，先让孩子独立完成，再对照原资料或老师讲解核对。",
    packageId: item.package_id || contentPackage?.package_id,
    unitId: item.unit_id,
    unit: item.unit || input.unit,
    source_mode: "extracted"
  };
}

function normalizeQuestionText(text) {
  const value = String(text || "").trim();
  if (!value) return value;
  if (/[。！？?）]$/.test(value) || value.endsWith("=")) return value;
  if (/多少|几|吗|哪|谁|什么|怎样|如何|对不对$/.test(value)) return `${value}？`;
  return `${value}。`;
}

function uniqueByStem(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = String(item.question || "")
      .replace(/\d+(?:\.\d+)?/g, "#")
      .replace(/[一二三四五六七八九十百千万]+/g, "#")
      .replace(/[，。！？?、；;：:\s（）()]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function mergePools(...pools) {
  const seen = new Set();
  const result = [];
  for (const pool of pools) {
    for (const item of pool || []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

function stableOrder(id, input) {
  const text = `${input.grade}|${input.semester}|${input.unit}|${input.knowledgePoint}|${input.type}|${id}`;
  let value = 0;
  for (let i = 0; i < text.length; i += 1) value = (value * 31 + text.charCodeAt(i)) >>> 0;
  return value;
}
