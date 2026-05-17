import dotenv from "dotenv";
import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAssignment,
  createSubmission,
  getAssignmentByCode,
  getAssignmentById,
  getAssignments,
  getSubmissionById,
  getSubmissionsByAssignment,
  markSubmissionViewed
} from "./assignments.js";
import { ensureInPackage, findKnowledgePoint, loadContentPackage, templatesFor } from "./content.js";
import { mockPaper, mockTextbookQuestions, mockWrongQuestion } from "./mock.js";
import { generateWithAI } from "./openai.js";
import { paperPrompt, textbookPrompt, wrongQuestionPrompt } from "./prompts.js";
import { appendHistory, deleteHistory, getHistory } from "./storage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", "..", ".env") });
dotenv.config({ path: join(__dirname, "..", ".env"), override: false });

const app = express();
const port = process.env.PORT || 8787;

app.use((_request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  next();
});
app.use((request, _response, next) => {
  console.log(`${request.method} ${request.path}`);
  next();
});
app.options("*", (_request, response) => response.sendStatus(204));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(join(__dirname, "..", "data", "uploads")));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, app: "primary-ai-question-assistant" });
});

app.get("/api/content-package", async (_request, response, next) => {
  try {
    response.json(await loadContentPackage());
  } catch (error) {
    next(error);
  }
});

app.post("/api/generate/textbook", async (request, response, next) => {
  try {
    const input = requireFields(request.body, ["grade", "semester", "subject", "textbook", "unit", "knowledgePoint", "type", "difficulty", "count"]);
    input.count = clampNumber(input.count, 1, 50);
    const contentPackage = await loadContentPackage();
    const scopedInput = ensureInPackage(input, contentPackage);
    const knowledgePoint = findKnowledgePoint(contentPackage, scopedInput.knowledgePoint);
    const templates = templatesFor(contentPackage, knowledgePoint, scopedInput.type);
    const context = { contentPackage, knowledgePoint, templates };
    response.json(await generateOrMock(textbookPrompt(scopedInput, context), () => mockTextbookQuestions(scopedInput, context)));
  } catch (error) {
    next(error);
  }
});

app.post("/api/generate/wrong-question", async (request, response, next) => {
  try {
    const input = requireFields(request.body, ["originalQuestion"]);
    input.wrongAnswer = String(request.body.wrongAnswer || "");
    const contentPackage = await loadContentPackage();
    const context = { contentPackage };
    response.json(await generateOrMock(wrongQuestionPrompt(input, context), () => mockWrongQuestion(input, context)));
  } catch (error) {
    next(error);
  }
});

app.post("/api/generate/paper", async (request, response, next) => {
  try {
    const input = requireFields(request.body, ["subject", "grade", "textbook", "unitRange", "count", "totalScore", "difficultyRatio"]);
    input.count = clampNumber(input.count, 1, 100);
    input.totalScore = clampNumber(input.totalScore, 1, 300);
    const contentPackage = await loadContentPackage();
    const scopedInput = ensureInPackage({ ...input, unit: input.unitRange, knowledgePoint: input.unitRange }, contentPackage);
    const context = { contentPackage };
    response.json(await generateOrMock(paperPrompt(scopedInput, context), () => mockPaper(scopedInput, context)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/history", async (_request, response, next) => {
  try {
    response.json({ items: await getHistory() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/history", async (request, response, next) => {
  try {
    const input = requireFields(request.body, ["type", "payload"]);
    response.json(await appendHistory(input.type, input.payload));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/history/:id", async (request, response, next) => {
  try {
    response.json(await deleteHistory(request.params.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/export", async (request, response, next) => {
  try {
    const { format, payload } = requireFields(request.body, ["format", "payload"]);
    const file = buildExportFile(format, payload);
    response.json(file);
  } catch (error) {
    next(error);
  }
});

app.post("/api/assignments", async (request, response, next) => {
  try {
    const input = requireFields(request.body, ["grade", "semester", "subject", "textbook", "knowledgePoint", "difficulty", "count"]);
    input.unit = request.body.unit || input.knowledgePoint;
    input.type = request.body.type || "计算题";
    input.count = clampNumber(input.count, 1, 50);
    const contentPackage = await loadContentPackage();
    const scopedInput = ensureInPackage(input, contentPackage);
    const knowledgePoint = findKnowledgePoint(contentPackage, scopedInput.knowledgePoint);
    const templates = templatesFor(contentPackage, knowledgePoint, scopedInput.type);
    const context = { contentPackage, knowledgePoint, templates };
    const result = await generateOrMock(textbookPrompt(scopedInput, context), () => mockTextbookQuestions(scopedInput, context));
    const assignment = await createAssignment({
      ...scopedInput,
      title: result.title || `${scopedInput.grade}${scopedInput.subject}${scopedInput.knowledgePoint}作业`,
      questions: result.questions || [],
      questionCount: result.questions?.length || scopedInput.count,
      status: "published"
    });
    response.json({ assignment });
  } catch (error) {
    next(error);
  }
});

app.get("/api/assignments", async (_request, response, next) => {
  try {
    const assignments = await getAssignments();
    const items = assignments
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(({ questions, ...item }) => ({
        ...item,
        questionCount: item.questionCount || questions?.length || 0
      }));
    response.json({ success: true, assignments: items });
  } catch (error) {
    next(error);
  }
});

app.get("/api/assignments/code/:code", async (request, response, next) => {
  try {
    const assignment = await getAssignmentByCode(request.params.code);
    if (!assignment) return response.status(404).json({ message: "未找到对应作业码" });
    response.json({ assignment });
  } catch (error) {
    next(error);
  }
});

app.get("/api/assignments/:id", async (request, response, next) => {
  try {
    const assignment = await getAssignmentById(request.params.id);
    if (!assignment) return response.status(404).json({ message: "未找到作业" });
    response.json({ assignment });
  } catch (error) {
    next(error);
  }
});

app.post("/api/assignments/:id/submissions", async (request, response, next) => {
  try {
    const input = requireFields(request.body, ["studentName"]);
    const submission = await createSubmission(request.params.id, { ...request.body, studentName: input.studentName });
    if (!submission) return response.status(404).json({ message: "未找到作业" });
    response.json({ submission });
  } catch (error) {
    next(error);
  }
});

app.post("/api/assignments/:id/upload", async (request, response, next) => {
  try {
    const submission = await createSubmission(request.params.id, {
      studentName: request.body.studentName || "未填写",
      submitType: "图片上传",
      images: request.body.images || []
    });
    if (!submission) return response.status(404).json({ message: "未找到作业" });
    response.json({ submission });
  } catch (error) {
    next(error);
  }
});

app.get("/api/assignments/:id/submissions", async (request, response, next) => {
  try {
    response.json({ items: await getSubmissionsByAssignment(request.params.id) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/submissions/:id", async (request, response, next) => {
  try {
    const submission = await getSubmissionById(request.params.id);
    if (!submission) return response.status(404).json({ message: "未找到提交记录" });
    response.json({ submission });
  } catch (error) {
    next(error);
  }
});

app.post("/api/submissions/:id/viewed", async (request, response, next) => {
  try {
    const submission = await markSubmissionViewed(request.params.id);
    if (!submission) return response.status(404).json({ message: "未找到提交记录" });
    response.json({ submission });
  } catch (error) {
    next(error);
  }
});

app.get("/api/assignments/:id/export", async (request, response, next) => {
  try {
    const assignment = await getAssignmentById(request.params.id);
    if (!assignment) return response.status(404).json({ message: "未找到作业" });
    response.json(buildAssignmentExportFile(assignment, request.query.format || "word", request.query.type || "student"));
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  const status = error.name === "ValidationError" ? 400 : 500;
  response.status(status).json({
    message: status === 400 ? "参数格式不正确" : "服务暂时不可用",
    detail: error.message
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

async function generateOrMock(prompt, mockFactory) {
  if (!process.env.OPENAI_API_KEY) return mockFactory();
  try {
    return await generateWithAI(prompt);
  } catch (error) {
    console.warn("OpenAI 调用失败，已降级为本地 mock：", error.message);
    return mockFactory();
  }
}

function requireFields(body, fields) {
  const input = {};
  for (const field of fields) {
    const value = body?.[field];
    if (value === undefined || value === null || value === "") {
      const error = new Error(`缺少字段：${field}`);
      error.name = "ValidationError";
      throw error;
    }
    input[field] = typeof value === "string" ? value.trim() : value;
  }
  return input;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    const error = new Error("数字字段格式不正确");
    error.name = "ValidationError";
    throw error;
  }
  return Math.min(max, Math.max(min, number));
}

function buildExportFile(format, payload) {
  const fileNameBase = sanitizeFileName(payload.fileName || payload.title || "小学AI出题助手");
  const html = buildExportHtml(payload);
  if (format === "word") {
    return {
      fileName: `${fileNameBase}.doc`,
      mimeType: "application/msword",
      base64: Buffer.from(html, "utf-8").toString("base64")
    };
  }
  return {
    fileName: `${fileNameBase}.pdf`,
    mimeType: "application/pdf",
    base64: Buffer.from(buildSimplePdfText(payload), "utf-8").toString("base64"),
    message: "体验版 PDF 为简化导出，正式上线前会替换为完整 PDF 模板。"
  };
}

function buildExportHtml(payload) {
  const questions = payload.result?.questions || [...(payload.result?.similar_questions || []), ...(payload.result?.variation_questions || [])];
  const title = escapeHtml(payload.title || payload.fileName || "小学 AI 出题助手");
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,'Microsoft YaHei',sans-serif;line-height:1.8;color:#111827}h1,h2{color:#1f2937}.meta{color:#475569}.q{margin:12px 0}</style></head><body><h1>${title}</h1><p class="meta">年级：${escapeHtml(payload.grade || "")}　科目：${escapeHtml(payload.subject || "")}　知识点：${escapeHtml(payload.knowledgePoint || "")}</p><h2>学生版题目</h2>${questions.map((q, i) => `<p class="q">${i + 1}. ${escapeHtml(q.question)}</p>`).join("")}<h2>答案页</h2>${questions.map((q, i) => `<p class="q">${i + 1}. ${escapeHtml(q.answer || "")}</p>`).join("")}<h2>解析页</h2>${questions.map((q, i) => `<p class="q">${i + 1}. ${escapeHtml(q.explanation || "")}</p>`).join("")}</body></html>`;
}

function buildSimplePdfText(payload) {
  const text = `${payload.title || payload.fileName || "小学 AI 出题助手"}\n年级：${payload.grade || ""} 科目：${payload.subject || ""} 知识点：${payload.knowledgePoint || ""}\n体验版 PDF 导出占位，正式上线前替换为完整 PDF 模板。`;
  return `%PDF-1.1\n1 0 obj<<>>endobj\n2 0 obj<< /Length ${text.length + 32} >>stream\nBT /F1 12 Tf 50 750 Td (${text.replace(/[()]/g, "")}) Tj ET\nendstream endobj\n3 0 obj<< /Type /Page /Parent 4 0 R /Contents 2 0 R >>endobj\n4 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n5 0 obj<< /Type /Catalog /Pages 4 0 R >>endobj\ntrailer<< /Root 5 0 R >>\n%%EOF`;
}

function buildAssignmentExportFile(assignment, format, type) {
  const safeFormat = format === "pdf" ? "pdf" : "word";
  const safeType = type === "teacher" ? "teacher" : "student";
  const title = `${assignment.title}-${safeType === "teacher" ? "教师版" : "学生版"}`;
  const html = buildAssignmentHtml(assignment, safeType);
  if (safeFormat === "word") {
    return {
      fileName: `${sanitizeFileName(title)}.doc`,
      mimeType: "application/msword",
      base64: Buffer.from(html, "utf-8").toString("base64")
    };
  }
  return {
    fileName: `${sanitizeFileName(title)}.pdf`,
    mimeType: "application/pdf",
    base64: Buffer.from(buildSimpleAssignmentPdfText(assignment, safeType), "utf-8").toString("base64"),
    message: "体验版 PDF 为简化导出，正式上线前可替换为完整 PDF 模板。"
  };
}

function buildAssignmentHtml(assignment, type) {
  const showAnswer = type === "teacher";
  const questions = assignment.questions || [];
  const meta = `科目：${assignment.subject || ""}　年级：${assignment.grade || ""}　学期：${assignment.semester || ""}　教材：${assignment.textbook || ""}　知识点：${assignment.knowledgePoint || ""}　作业码：${assignment.code || ""}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,'Microsoft YaHei',sans-serif;line-height:1.8;color:#111827;padding:24px}h1,h2{color:#1f2937}.meta{color:#475569}.q{margin:14px 0}.answer{color:#334155}.tip{color:#92400e}</style></head><body><h1>${escapeHtml(assignment.title || "小学 AI 作业")}</h1><p class="meta">${escapeHtml(meta)}</p><h2>学生版题目</h2>${questions.map((q, i) => `<p class="q">${i + 1}. ${escapeHtml(q.question)}</p>`).join("")}${showAnswer ? `<h2>答案与解析</h2>${questions.map((q, i) => `<div class="q"><p>${i + 1}. ${escapeHtml(q.question)}</p><p class="answer">答案：${escapeHtml(q.answer || "")}</p><p class="answer">解析：${escapeHtml(q.explanation || "")}</p><p class="tip">易错点：${escapeHtml(q.common_mistake || "")}</p><p class="tip">家长提示：${escapeHtml(q.parent_tip || "")}</p></div>`).join("")}` : ""}</body></html>`;
}

function buildSimpleAssignmentPdfText(assignment, type) {
  const lines = [
    `${assignment.title || "小学 AI 作业"} ${type === "teacher" ? "教师版" : "学生版"}`,
    `作业码：${assignment.code || ""}`,
    `科目：${assignment.subject || ""} 年级：${assignment.grade || ""} 知识点：${assignment.knowledgePoint || ""}`,
    ...(assignment.questions || []).map((q, index) => `${index + 1}. ${q.question}${type === "teacher" ? ` 答案：${q.answer || ""} 解析：${q.explanation || ""}` : ""}`)
  ];
  const text = lines.join("\n").replace(/[()]/g, "");
  return `%PDF-1.1\n1 0 obj<<>>endobj\n2 0 obj<< /Length ${text.length + 32} >>stream\nBT /F1 12 Tf 50 750 Td (${text}) Tj ET\nendstream endobj\n3 0 obj<< /Type /Page /Parent 4 0 R /Contents 2 0 R >>endobj\n4 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n5 0 obj<< /Type /Catalog /Pages 4 0 R >>endobj\ntrailer<< /Root 5 0 R >>\n%%EOF`;
}

function sanitizeFileName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, "_");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
}
