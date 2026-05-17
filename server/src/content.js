import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentDir = join(__dirname, "..", "..", "content");
const packagesDir = join(contentDir, "packages");

let cache;

export async function loadContentPackage(input = {}) {
  const catalog = await loadContentCatalog();
  return selectPackage(catalog.packages, input);
}

export async function loadContentCatalog() {
  if (cache) return cache;

  const [knowledgeRaw, templatesRaw, sourcesRaw] = await Promise.all([
    readFile(join(contentDir, "knowledge_points.json"), "utf-8"),
    readFile(join(contentDir, "question_templates.json"), "utf-8"),
    readOptionalFile(join(contentDir, "textbook_sources.json"), "{\"sources\":[]}")
  ]);

  const knowledge = JSON.parse(knowledgeRaw);
  const templates = JSON.parse(templatesRaw);
  const sources = JSON.parse(sourcesRaw);
  const packageFiles = await readPackageFiles();
  const packages = [
    normalizePackage({ ...knowledge, templates: templates.templates, sources: sources.sources || [] }),
    ...packageFiles.map(normalizePackage)
  ];

  cache = {
    packages,
    options: buildCatalogOptions(packages),
    ...packages[0]
  };
  return cache;
}

export function findKnowledgePoint(contentPackage, nameOrId) {
  const keyword = String(nameOrId || "").trim();
  return findExactKnowledgePoint(contentPackage, keyword)
    || (keyword ? contentPackage.knowledge_points.find((item) => item.name.includes(keyword) || keyword.includes(item.name)) : null)
    || contentPackage.knowledge_points[0];
}

export function templatesFor(contentPackage, knowledgePoint, questionType) {
  const all = contentPackage.templates.filter((item) => item.knowledge_point_id === knowledgePoint.id);
  const typed = all.filter((item) => item.question_type === questionType);
  if (typed.length) return typed;
  if (all.length) return all;

  const sameUnitPointIds = new Set(
    (contentPackage.knowledge_points || [])
      .filter((item) => item.unit_id === knowledgePoint.unit_id)
      .map((item) => item.id)
  );
  const sameUnit = contentPackage.templates.filter((item) => sameUnitPointIds.has(item.knowledge_point_id));
  const sameUnitTyped = sameUnit.filter((item) => item.question_type === questionType);
  return sameUnitTyped.length ? sameUnitTyped : sameUnit.length ? sameUnit : contentPackage.templates;
}

export function ensureInPackage(input, contentPackage) {
  const scope = contentPackage.scope;
  const knowledgePoint = findKnowledgePoint(contentPackage, input.knowledgePoint);
  const unit = findUnitForPoint(contentPackage, knowledgePoint) || findUnitByName(contentPackage, input.unit) || contentPackage.units?.[0];
  const lesson = findLessonForPoint(unit, knowledgePoint) || findLessonByName(unit, input.lesson) || unit?.lessons?.[0];
  return {
    ...input,
    grade: scope.grade,
    semester: scope.semester,
    subject: scope.subject,
    textbook: scope.textbook,
    unit: unit?.name || knowledgePoint?.unit || scope.unit,
    lesson: lesson?.name || input.lesson || "",
    knowledgePoint: knowledgePoint?.name || contentPackage.knowledge_points[0]?.name || input.knowledgePoint
  };
}

async function readOptionalFile(path, fallback) {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return fallback;
  }
}

async function readPackageFiles() {
  try {
    const files = (await readdir(packagesDir)).filter((file) => file.endsWith(".json")).sort();
    return Promise.all(files.map(async (file) => JSON.parse(await readFile(join(packagesDir, file), "utf-8"))));
  } catch {
    return [];
  }
}

function normalizePackage(contentPackage) {
  return {
    ...contentPackage,
    options: buildOptions(contentPackage, contentPackage.templates || [])
  };
}

function selectPackage(packages, input = {}) {
  if (!packages.length) return { knowledge_points: [], templates: [], options: buildOptions({}, []) };
  const knowledgePackage = input.knowledgePoint
    ? packages.find((item) => findExactKnowledgePoint(item, input.knowledgePoint))
    : null;
  if (knowledgePackage) return knowledgePackage;

  const scored = packages
    .map((item) => ({ item, score: packageScore(item, input) }))
    .sort((a, b) => b.score - a.score);
  return scored[0].item;
}

function packageScore(contentPackage, input) {
  const scope = contentPackage.scope || {};
  let score = 0;
  if (input.grade && input.grade === scope.grade) score += 8;
  if (input.semester && input.semester === scope.semester) score += 4;
  if (input.subject && input.subject === scope.subject) score += 8;
  if (input.textbook && input.textbook === scope.textbook) score += 2;
  if (input.unit && (input.unit === scope.unit || (contentPackage.units || []).some((unit) => unit.name === input.unit))) score += 12;
  if (input.knowledgePoint && findExactKnowledgePoint(contentPackage, input.knowledgePoint)) score += 50;
  return score;
}

function findExactKnowledgePoint(contentPackage, nameOrId) {
  const keyword = String(nameOrId || "").trim();
  if (!keyword) return null;
  return (contentPackage.knowledge_points || []).find((item) => item.id === keyword || item.name === keyword) || null;
}

function findUnitByName(contentPackage, unitName) {
  return (contentPackage.units || []).find((item) => item.name === unitName);
}

function findUnitForPoint(contentPackage, knowledgePoint) {
  if (!knowledgePoint) return null;
  return (contentPackage.units || []).find((unit) => unit.id === knowledgePoint.unit_id || unit.name === knowledgePoint.unit);
}

function findLessonByName(unit, lessonName) {
  return (unit?.lessons || []).find((item) => item.name === lessonName);
}

function findLessonForPoint(unit, knowledgePoint) {
  if (!knowledgePoint) return null;
  return (unit?.lessons || []).find((lesson) => lesson.id === knowledgePoint.lesson_id || (lesson.knowledge_point_ids || []).includes(knowledgePoint.id));
}

function buildOptions(knowledge, templates) {
  const points = knowledge.knowledge_points || [];
  const unique = (items) => [...new Set(items.filter(Boolean))];
  return {
    grades: unique(points.map((item) => item.grade)),
    semesters: unique(points.map((item) => item.semester)),
    subjects: unique(points.map((item) => item.subject)),
    textbooks: unique(points.map((item) => item.textbook)),
    units: (knowledge.units || []).map((unit) => ({
      id: unit.id,
      name: unit.name,
      lessons: (unit.lessons || []).map((lesson) => ({
        id: lesson.id,
        name: lesson.name,
        knowledgePoints: points
          .filter((point) => (lesson.knowledge_point_ids || []).includes(point.id))
          .map((point) => ({ id: point.id, name: point.name }))
      }))
    })),
    knowledgePoints: points.map((item) => ({
      id: item.id,
      name: item.name,
      unitId: item.unit_id,
      lessonId: item.lesson_id,
      recommendedQuestionTypes: item.recommended_question_types || [],
      difficultyLevels: item.difficulty_levels || []
    })),
    questionTypes: unique(templates.map((item) => item.question_type)),
    difficulties: unique(points.flatMap((item) => item.difficulty_levels || []))
  };
}

function buildCatalogOptions(packages) {
  const unique = (items) => [...new Set(items.filter(Boolean))];
  const points = packages.flatMap((item) => item.options?.knowledgePoints || []);
  return {
    grades: unique(packages.map((item) => item.scope?.grade)),
    semesters: unique(packages.map((item) => item.scope?.semester)),
    subjects: unique(packages.map((item) => item.scope?.subject)),
    textbooks: unique(packages.map((item) => item.scope?.textbook)),
    packages: packages.map((item) => ({
      packageId: item.package_id,
      packageName: item.package_name,
      scope: item.scope
    })),
    units: packages.flatMap((item) => (item.options?.units || []).map((unit) => ({ ...unit, packageId: item.package_id, scope: item.scope }))),
    knowledgePoints: points,
    questionTypes: unique(packages.flatMap((item) => item.options?.questionTypes || [])),
    difficulties: unique(packages.flatMap((item) => item.options?.difficulties || []))
  };
}
