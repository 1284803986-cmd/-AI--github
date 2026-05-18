import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
const uploadDir = join(dataDir, "uploads");
const assignmentsPath = join(dataDir, "assignments.json");
const submissionsPath = join(dataDir, "submissions.json");

export async function createAssignment(payload) {
  const assignments = await readJson(assignmentsPath, []);
  const now = new Date().toISOString();
  const assignment = {
    id: crypto.randomUUID(),
    code: createCode(assignments),
    title: payload.title || `${payload.grade || ""}${payload.subject || ""}${payload.knowledgePoint || "作业"}`,
    subject: payload.subject,
    grade: payload.grade,
    semester: payload.semester,
    textbook: payload.textbook,
    unit: payload.unit,
    lesson: payload.lesson,
    knowledgePoint: payload.knowledgePoint,
    type: payload.type,
    difficulty: payload.difficulty,
    questionCount: payload.questionCount || payload.questions?.length || 0,
    questions: payload.questions || [],
    createdAt: now,
    status: payload.status || "published"
  };
  await writeJson(assignmentsPath, [assignment, ...assignments]);
  return assignment;
}

export async function getAssignments() {
  return readJson(assignmentsPath, []);
}

export async function getAssignmentById(id) {
  const assignments = await getAssignments();
  return assignments.find((item) => item.id === id);
}

export async function getAssignmentByCode(code) {
  const assignments = await getAssignments();
  return assignments.find((item) => String(item.code).toUpperCase() === String(code).trim().toUpperCase());
}

export async function updateAssignmentStatus(id, status) {
  const assignments = await getAssignments();
  let updated = null;
  const next = assignments.map((item) => {
    if (item.id !== id) return item;
    updated = { ...item, status };
    return updated;
  });
  if (!updated) return null;
  await writeJson(assignmentsPath, next);
  return updated;
}

export async function createSubmission(assignmentId, payload) {
  const assignment = await getAssignmentById(assignmentId);
  if (!assignment) return null;

  const submissions = await readJson(submissionsPath, []);
  const imagePaths = await saveImages(payload.images || [], assignmentId);
  const submission = {
    id: crypto.randomUUID(),
    assignmentId,
    assignmentCode: assignment.code,
    studentName: String(payload.studentName || "未填写").trim(),
    submitType: payload.submitType || (imagePaths.length ? "图片上传" : "在线答题"),
    answers: payload.answers || [],
    imagePaths,
    submittedAt: new Date().toISOString(),
    status: "待批改",
    teacherComment: payload.teacherComment || ""
  };
  await writeJson(submissionsPath, [submission, ...submissions]);
  return submission;
}

export async function getSubmissionsByAssignment(assignmentId) {
  const submissions = await readJson(submissionsPath, []);
  return submissions.filter((item) => item.assignmentId === assignmentId);
}

export async function getSubmissionById(id) {
  const submissions = await readJson(submissionsPath, []);
  return submissions.find((item) => item.id === id);
}

export async function markSubmissionViewed(id) {
  const submissions = await readJson(submissionsPath, []);
  const next = submissions.map((item) => item.id === id ? { ...item, status: "已查看" } : item);
  await writeJson(submissionsPath, next);
  return next.find((item) => item.id === id);
}

async function saveImages(images, assignmentId) {
  if (!Array.isArray(images) || images.length === 0) return [];
  await mkdir(uploadDir, { recursive: true });
  const paths = [];
  for (const image of images.slice(0, 6)) {
    const ext = safeExt(image.name || "") || ".jpg";
    const fileName = `${assignmentId}-${crypto.randomUUID()}${ext}`;
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, Buffer.from(String(image.base64 || ""), "base64"));
    paths.push(`/uploads/${fileName}`);
  }
  return paths;
}

function safeExt(name) {
  const ext = extname(name).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : "";
}

function createCode(assignments) {
  const used = new Set(assignments.map((item) => item.code));
  let code = "";
  do {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (used.has(code));
  return code;
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return fallback;
  }
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}
