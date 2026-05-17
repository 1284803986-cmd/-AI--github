import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentDir = join(__dirname, "..", "..", "content");

let cache;

export async function loadContentPackage() {
  if (cache) return cache;

  const [knowledgeRaw, templatesRaw] = await Promise.all([
    readFile(join(contentDir, "knowledge_points.json"), "utf-8"),
    readFile(join(contentDir, "question_templates.json"), "utf-8")
  ]);

  const knowledge = JSON.parse(knowledgeRaw);
  const templates = JSON.parse(templatesRaw);

  cache = {
    ...knowledge,
    templates: templates.templates
  };
  return cache;
}

export function findKnowledgePoint(contentPackage, nameOrId) {
  const keyword = String(nameOrId || "").trim();
  return contentPackage.knowledge_points.find((item) => item.id === keyword || item.name === keyword)
    || contentPackage.knowledge_points.find((item) => item.name.includes(keyword) || keyword.includes(item.name))
    || contentPackage.knowledge_points[0];
}

export function templatesFor(contentPackage, knowledgePoint, questionType) {
  const all = contentPackage.templates.filter((item) => item.knowledge_point_id === knowledgePoint.id);
  const typed = all.filter((item) => item.question_type === questionType);
  return typed.length ? typed : all;
}

export function ensureInPackage(input, contentPackage) {
  const scope = contentPackage.scope;
  return {
    ...input,
    grade: scope.grade,
    semester: scope.semester,
    subject: scope.subject,
    textbook: scope.textbook,
    unit: input.unit || scope.unit,
    knowledgePoint: input.knowledgePoint || contentPackage.knowledge_points[0].name
  };
}
